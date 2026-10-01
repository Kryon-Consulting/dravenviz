"""`pnpm test:pdf` driver: one DravenViz report, one real A4 PDF from DravenPDF, and the checks.

Run through `pnpm test:pdf` (which packs the library first), or directly after `pnpm pack:local`:

    uv run python examples/dravenpdf/run_pdf_check.py

Exit codes: 0 pass, 1 a check failed, 3 a prerequisite is missing (prints `UNVERIFIED: <reason>`),
4 everything that could run passed but part of the evidence could not be proven (prints
`UNVERIFIED: ...`; today only when the frame probe found no working method).
"""

from __future__ import annotations

import json
import math
import re
import shutil
import subprocess
import sys
import tempfile
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

import pypdfium2 as pdfium
import pypdfium2.raw as raw
from PIL import Image

import client
import negative
import pdfgeo
import support
from support import ROOT, EXIT_FAIL, EXIT_PASS, EXIT_PREREQ, EXIT_UNVERIFIED

HERE = support.HERE
EVIDENCE = ROOT / "evidence" / "pdf"
RESULTS_MD = ROOT / "docs" / "plans" / "slice-1-pdf-probe-results.md"
CALIBRATION = HERE / "frame_calibration.json"
REPORT = ROOT / "fixtures" / "reports" / "report-slice1.json"
TARBALL = ROOT / ".pack" / "draven-viz-0.1.0.tgz"
DPI = 150
SUPERSAMPLE = 2  # must equal SUPERSAMPLE in tests/pdf/compare.ts
A4_PT = (595.0, 842.0)
PAGE_MARGIN_PT = 16 / 25.4 * 72  # @page margin in report.css
FRAME_WIDTH_MM = 178.0
FRAME_ASPECT = 680 / 320
MISSING_FONT = "fonts/NotoSans-Regular.woff2"
NEGATIVE_TIMEOUT_MS = 8000

# Expected text beyond the chart titles (which come from the specs).
EXTRA_TEXT = ["Partial week", "Target", "Not measured", "Collection paused"]

# Role limits in effective pt (design section 7), with the rounding tolerance.
TITLE_RANGE = (12.0, 14.0)
MIN_PT = {
    "tick": 9.0,
    "axis-title": 9.0,
    "legend": 9.0,
    "annotation": 9.0,
    "reference": 9.0,
    "direct": 9.0,
    "note": 8.0,
    "caption": 8.0,
}
PT_TOLERANCE = 0.05
READY_PT_TOLERANCE = 0.15
READY_KEY = {
    "title": "title",
    "tick": "label",
    "axis-title": "label",
    "legend": "label",
    "annotation": "label",
    "reference": "label",
    "direct": "label",
    "note": "caption",
    "caption": "caption",
}
QUAD_EPS = 0.5  # pt: link rects are pixel snapped
OVERLAP_LIMIT = 0.25  # pt^2


@dataclass
class Check:
    name: str
    status: str  # pass | fail | unverified
    detail: str = ""
    attempts: int | None = None  # renders made, for checks that call DravenPDF


@dataclass
class Run:
    checks: list[Check] = field(default_factory=list)

    def add(self, name: str, ok: bool | None, detail: str = "", attempts: int | None = None) -> bool:
        status = "unverified" if ok is None else ("pass" if ok else "fail")
        self.checks.append(Check(name, status, detail, attempts))
        suffix = f" ({attempts} attempt{'s' if attempts != 1 else ''})" if attempts else ""
        print(f"  [{status.upper():10}] {name}" + (f": {detail}" if detail else "") + suffix)
        return ok is not False


def norm(text: str) -> str:
    return re.sub(r"\s+", "", text)


# ----------------------------------------------------------------------------- probe results


def load_method() -> tuple[str, dict]:
    """The frame method proven by the probe. The driver refuses to run on anything else."""
    if not RESULTS_MD.is_file() or not CALIBRATION.is_file():
        raise SystemExit(
            f"{RESULTS_MD.relative_to(ROOT)} or frame_calibration.json is missing: run probe_frames.py"
        )
    text = RESULTS_MD.read_text()
    chosen = re.search(r"^- Chosen method: `([a-z-]+)`", text, re.M)
    proven = re.search(r"^- Proven: (yes|no)", text, re.M)
    calibration = json.loads(CALIBRATION.read_text())
    if chosen is None or proven is None:
        raise SystemExit("the probe results file does not name a method")
    method = chosen.group(1)
    if method != calibration["method"]:
        raise SystemExit("the probe results and frame_calibration.json disagree; rerun probe_frames.py")
    if method not in ("link-dest", "markers", "none"):
        raise SystemExit(f"unknown frame method {method!r}")
    if method != "none" and proven.group(1) != "yes":
        raise SystemExit("the probe results do not name a proven method")
    return method, calibration


# ----------------------------------------------------------------------------- bundle


def read_report() -> list[dict]:
    entries = []
    for item in json.loads(REPORT.read_text()):
        fixture_file = ROOT / "fixtures" / "valid" / f"{item['fixture']}.json"
        entries.append(
            {
                "fixture": item["fixture"],
                "namespace": item["namespace"],
                "spec": json.loads(fixture_file.read_text()),
                "specSha256": support.sha256_file(fixture_file),
            }
        )
    return entries


def build_bundle(work: Path, entries: list[dict]) -> tuple[Path, dict]:
    """Extract the tarball, copy the manifest assets next to the report files, write charts.json."""
    recorded = (Path(f"{TARBALL}.sha256")).read_text().split()[0]
    if support.sha256_file(TARBALL) != recorded:
        raise SystemExit(f"{TARBALL.name} does not match its .sha256 file; run pnpm pack:local")
    package = support.extract_tarball(TARBALL, work / "tgz")
    bundle = work / "bundle"
    manifest = support.stage_assets(package, bundle)
    for name in ("index.html", "bootstrap.js", "report.css"):
        shutil.copyfile(HERE / "bundle" / name, bundle / name)
    (bundle / "charts.json").write_text(
        json.dumps([{"spec": e["spec"], "namespace": e["namespace"]} for e in entries])
    )
    slots = re.findall(r'data-chart-slot="([^"]+)"', (bundle / "index.html").read_text())
    if slots != [e["namespace"] for e in entries]:
        raise SystemExit(f"index.html slots {slots} do not match the report namespaces")
    return bundle, manifest


# ----------------------------------------------------------------------------- frames


@dataclass
class Frame:
    ns: str
    page: int  # 0-based
    rect: pdfgeo.Rect
    # How the link's destination was tied to this namespace's token (ruling R35): distance from the
    # offset-corrected destination to the winning token, and to the next-nearest token on that page.
    residual_pt: float | None = None
    runner_up_pt: float | None = None


def locate_frames(
    run: Run, pdf: pdfium.PdfDocument, namespaces: list[str], cal: dict
) -> dict[str, Frame] | None:
    off = cal["linkDest"]["destOffsetPt"]
    tol = cal["linkDest"]["destTolerancePt"]
    links = [lk for pi in range(len(pdf)) for lk in pdfgeo.page_links(pdf, pi)]
    tokens = [t for pi in range(len(pdf)) for t in pdfgeo.page_tokens(pdf, pi, namespaces) if t.kind == "T"]
    found: dict[str, list[Frame]] = {ns: [] for ns in namespaces}
    problems: list[str] = []
    for lk in links:
        if lk.dest_page is None or lk.dest_x is None or lk.dest_y is None:
            problems.append(f"link on page {lk.page + 1} has no destination")
            continue
        cx, cy = lk.dest_x - off["dx"], lk.dest_y - off["dy"]
        near = [t for t in tokens if t.page == lk.dest_page]
        if not near:
            problems.append(f"link on page {lk.page + 1} points to page {lk.dest_page + 1} without tokens")
            continue
        ranked = sorted(near, key=lambda t: math.hypot(cx - t.box[0], cy - t.box[3]))
        best = ranked[0]
        residual = math.hypot(cx - best.box[0], cy - best.box[3])
        runner_up = math.hypot(cx - ranked[1].box[0], cy - ranked[1].box[3]) if len(ranked) > 1 else None
        if residual > tol:
            problems.append(f"link on page {lk.page + 1}: nearest token {best.text} is {residual:.2f} pt away")
            continue
        found[best.ns].append(Frame(best.ns, lk.page, lk.rect, residual, runner_up))
    for ns, frames in found.items():
        if len(frames) != 1:
            problems.append(f"{ns}: found {len(frames)} frames, expected exactly 1")
    ok = not problems
    run.add("every report instance has exactly one frame (link-dest)", ok, "; ".join(problems[:4]))
    if not ok:
        return None
    result = {ns: frames[0] for ns, frames in found.items()}
    bad: list[str] = []
    for ns, fr in result.items():
        l, b, r, t = fr.rect
        width_mm, height_pt = (r - l) * pdfgeo.MM_PER_PT, t - b
        aspect = (r - l) / height_pt
        if abs(width_mm - FRAME_WIDTH_MM) > 0.5:
            bad.append(f"{ns} width {width_mm:.2f} mm")
        if abs(aspect / FRAME_ASPECT - 1) > 0.005:
            bad.append(f"{ns} aspect {aspect:.4f}")
    run.add(
        "each frame is 178 mm wide (+-0.5 mm) at aspect 680:320 (+-0.5 %)",
        not bad,
        "; ".join(bad) or f"{len(result)} frames",
    )
    return result


# ----------------------------------------------------------------------------- text content


def text_matches(pdf: pdfium.PdfDocument, needle: str) -> list[tuple[int, pdfgeo.Point]]:
    """(page, centre of the match) for every occurrence of `needle` in the text layer."""
    out = []
    for pi in range(len(pdf)):
        tp = pdf[pi].get_textpage()
        text = tp.get_text_range()
        for m in re.finditer(re.escape(needle), text):
            boxes = [tp.get_charbox(i, loose=True) for i in range(m.start(), m.end())]
            out.append(
                (
                    pi,
                    (
                        (min(b[0] for b in boxes) + max(b[2] for b in boxes)) / 2,
                        (min(b[1] for b in boxes) + max(b[3] for b in boxes)) / 2,
                    ),
                )
            )
    return out


def table_bands(frames: dict[str, Frame], page_height: float) -> dict[str, tuple[int, float, float]]:
    """Each instance's data table: below its frame, down to the next frame on the page (or the
    bottom margin). Returned as (page, y_top, y_bottom)."""
    bands = {}
    for ns, fr in frames.items():
        below = [o.rect[3] for o in frames.values() if o.page == fr.page and o.rect[3] < fr.rect[1] - 1]
        bands[ns] = (fr.page, fr.rect[1], max(below, default=PAGE_MARGIN_PT))
    return bands


def attribute(
    matches: list[tuple[int, pdfgeo.Point]], frames: dict[str, Frame], bands: dict
) -> tuple[dict[str, dict[str, int]], int]:
    per: dict[str, dict[str, int]] = {ns: {"frame": 0, "table": 0} for ns in frames}
    stray = 0
    for page, (x, y) in matches:
        for ns, fr in frames.items():
            if fr.page == page and pdfgeo.point_in_rect((x, y), fr.rect, 1.0):
                per[ns]["frame"] += 1
                break
            bp, top, bottom = bands[ns]
            if bp == page and bottom <= y <= top:
                per[ns]["table"] += 1
                break
        else:
            stray += 1
    return per, stray


def check_text(run: Run, pdf: pdfium.PdfDocument, entries: list[dict], frames: dict[str, Frame] | None) -> None:
    titles: dict[str, list[str]] = {}
    for e in entries:
        titles.setdefault(e["spec"]["title"], []).append(e["namespace"])
    page_height = pdf[0].get_size()[1]
    bands = table_bands(frames, page_height) if frames else None
    for title, namespaces in titles.items():
        matches = text_matches(pdf, title)
        want = len(namespaces) * 2
        detail = f"{len(matches)} found, {len(namespaces)} instance(s) x 2 expected"
        ok = len(matches) == want
        if frames and bands:
            per, stray = attribute(matches, {ns: frames[ns] for ns in frames}, bands)
            wrong = [ns for ns in namespaces if per[ns] != {"frame": 1, "table": 1}]
            elsewhere = [ns for ns in frames if ns not in namespaces and (per[ns]["frame"] or per[ns]["table"])]
            ok = ok and not wrong and not stray and not elsewhere
            if wrong or stray or elsewhere:
                detail += f"; wrong instances {wrong}, stray {stray}, other instances {elsewhere}"
        run.add(f'title "{title}" appears {want} times (SVG title + table caption per instance)', ok, detail)
    for needle in EXTRA_TEXT:
        matches = text_matches(pdf, needle)
        ok: bool | None = len(matches) >= 1
        detail = f"{len(matches)} found"
        if frames and bands and matches:
            _, stray = attribute(matches, frames, bands)
            if stray:
                ok = False
                detail += f"; {stray} outside every frame and table"
        run.add(f'text "{needle}" is present and inside a frame or table', ok, detail)


# ----------------------------------------------------------------------------- labels


def strip_tokens(objs: list[pdfgeo.TextObj], ns: str) -> tuple[list[pdfgeo.TextObj], list[str]]:
    """Remove the instrumentation tokens `DVF<ns>TL` / `DVF<ns>BR` (runs of glyph objects)."""
    problems = []
    objs = list(objs)
    for token in (f"DVF{ns}TL", f"DVF{ns}BR"):
        for start in range(len(objs)):
            acc = ""
            for end in range(start, len(objs)):
                acc += norm(objs[end].text)
                if acc == token:
                    del objs[start : end + 1]
                    break
                if not token.startswith(acc):
                    break
            else:
                continue
            break
        else:
            problems.append(f"token {token} not found")
    return objs, problems


def group_labels(objs: list[pdfgeo.TextObj], labels: list[dict]) -> tuple[list[list[pdfgeo.TextObj]], list[str]]:
    groups: list[list[pdfgeo.TextObj]] = []
    problems: list[str] = []
    pos = 0
    for label in labels:
        want = norm(label["text"])
        acc, grp = "", []
        while pos < len(objs) and len(acc) < len(want):
            acc += norm(objs[pos].text)
            grp.append(objs[pos])
            pos += 1
        if acc != want:
            problems.append(f'label {label["labelId"]}: expected "{want}", PDF objects give "{acc}"')
            return groups, problems
        while pos < len(objs) and norm(objs[pos].text) == "":
            grp.append(objs[pos])
            pos += 1
        groups.append(grp)
    if pos < len(objs):
        problems.append(f"{len(objs) - pos} text object(s) left unassigned, first: \"{objs[pos].text}\"")
    return groups, problems


def centre(quad: list[pdfgeo.Point]) -> pdfgeo.Point:
    return (sum(p[0] for p in quad) / 4, sum(p[1] for p in quad) / 4)


def bbox(quad: list[pdfgeo.Point]) -> pdfgeo.Rect:
    xs, ys = [p[0] for p in quad], [p[1] for p in quad]
    return (min(xs), min(ys), max(xs), max(ys))


def check_labels(
    run: Run, pdf: pdfium.PdfDocument, frames: dict[str, Frame], browser: dict, entries: list[dict]
) -> dict:
    """Logical labels, effective font size and oriented geometry for every instance."""
    pdf_size = pdf[0].get_size()
    printable = (
        PAGE_MARGIN_PT - QUAD_EPS,
        PAGE_MARGIN_PT - QUAD_EPS,
        pdf_size[0] - PAGE_MARGIN_PT + QUAD_EPS,
        pdf_size[1] - PAGE_MARGIN_PT + QUAD_EPS,
    )
    page_objs = {pi: pdfgeo.text_objects(pdf[pi]) for pi in range(len(pdf))}
    summary: dict[str, dict] = {}
    grouping_problems: list[str] = []
    size_problems: list[str] = []
    ready_problems: list[str] = []
    clip_problems: list[str] = []
    overlap_problems: list[str] = []
    role_pts: dict[str, list[float]] = {}
    fonts_seen: set[str] = set()
    worst_overlap = 0.0
    for inst in browser["instances"]:
        ns = inst["namespace"]
        fr = frames[ns]
        inside = [
            o for o in page_objs[fr.page]
            if o.quad and pdfgeo.point_in_rect(centre(o.quad), fr.rect, QUAD_EPS)
        ]
        inside, token_problems = strip_tokens(inside, ns)
        groups, problems = group_labels(inside, inst["labels"])
        grouping_problems += [f"{ns}: {p}" for p in token_problems + problems]
        if problems:
            continue
        label_quads: list[tuple[str, list[list[pdfgeo.Point]]]] = []
        for label, grp in zip(inst["labels"], groups, strict=True):
            real = [o for o in grp if norm(o.text)]
            fonts_seen.update(o.font for o in real)
            sizes = [o.size_pt for o in real]
            if max(sizes) - min(sizes) > 0.01:
                size_problems.append(f"{ns} {label['labelId']}: sizes {min(sizes):.3f}..{max(sizes):.3f}")
            pt = sum(sizes) / len(sizes)
            role = label["role"]
            role_pts.setdefault(role, []).append(pt)
            if role == "title":
                if not (TITLE_RANGE[0] - PT_TOLERANCE <= pt <= TITLE_RANGE[1] + PT_TOLERANCE):
                    size_problems.append(f"{ns} title {pt:.2f} pt outside 12-14")
            elif role in MIN_PT:
                if pt < MIN_PT[role] - PT_TOLERANCE:
                    size_problems.append(f"{ns} {role} '{label['text']}' {pt:.2f} pt < {MIN_PT[role]}")
            else:
                size_problems.append(f"{ns} unknown role {role}")
            expected = (inst["effectivePt"] or {}).get(READY_KEY.get(role, ""))
            if expected is None:
                ready_problems.append(f"{ns} {role}: no ReadyInfo.effectivePt")
            elif abs(pt - expected) > READY_PT_TOLERANCE:
                ready_problems.append(f"{ns} {role} {pt:.2f} pt vs ReadyInfo {expected:.2f}")
            label_quads.append((label["labelId"], [o.quad for o in real]))
            for quad in (o.quad for o in real):
                for v in quad:
                    if not pdfgeo.point_in_rect(v, fr.rect, QUAD_EPS) or not pdfgeo.point_in_rect(v, printable):
                        clip_problems.append(f"{ns} {label['labelId']} vertex ({v[0]:.1f}, {v[1]:.1f})")
                        break
        for i in range(len(label_quads)):
            for j in range(i + 1, len(label_quads)):
                area = 0.0
                for qa in label_quads[i][1]:
                    ba = bbox(qa)
                    for qb in label_quads[j][1]:
                        bb = bbox(qb)
                        if ba[2] <= bb[0] or bb[2] <= ba[0] or ba[3] <= bb[1] or bb[3] <= ba[1]:
                            continue
                        area += pdfgeo.intersection_area(qa, qb)
                worst_overlap = max(worst_overlap, area)
                if area > OVERLAP_LIMIT:
                    overlap_problems.append(f"{ns} {label_quads[i][0]} x {label_quads[j][0]}: {area:.2f} pt2")
        summary[ns] = {"labels": len(inst["labels"]), "objects": len(inside)}
    run.add(
        "chart text is set in the embedded bundled font (Noto Sans), not a fallback",
        bool(fonts_seen) and all("Noto" in f for f in fonts_seen),
        ", ".join(sorted(fonts_seen)),
    )
    labels_total = sum(v["labels"] for v in summary.values())
    run.add(
        "PDF text objects map one-to-one onto the browser label manifest",
        not grouping_problems,
        "; ".join(grouping_problems[:3]) or f"{labels_total} labels in {len(summary)} frames",
    )
    roles = ", ".join(f"{r} {min(v):.2f}-{max(v):.2f}" for r, v in sorted(role_pts.items()))
    run.add("effective font size per role within the print limits", not size_problems and not grouping_problems, "; ".join(size_problems[:3]) or roles)
    run.add("effective font size agrees with ReadyInfo.effectivePt (+-0.15 pt)", not ready_problems and not grouping_problems, "; ".join(ready_problems[:3]) or "all roles")
    run.add("no label region leaves its frame or the printable area", not clip_problems and not grouping_problems, "; ".join(clip_problems[:3]) or "oriented quads inside")
    run.add(
        "no two labels overlap (oriented quads, <= 0.25 pt2)",
        not overlap_problems and not grouping_problems,
        "; ".join(overlap_problems[:3]) or f"largest overlap {worst_overlap:.3f} pt2",
    )
    return {"roles": {r: [min(v), max(v)] for r, v in role_pts.items()}, "worstOverlapPt2": worst_overlap}


# ----------------------------------------------------------------------------- rendering


def render_frame(page: pdfium.PdfPage, rect: pdfgeo.Rect) -> Image.Image:
    """The frame rect at 150 dpi with the frame's top-left corner exactly at pixel (0, 0).

    Rendered at SUPERSAMPLE x 150 dpi through a matrix (so the sub-pixel origin is exact) and
    box-filtered down; tests/pdf/compare.ts does the same on the browser side.
    """
    height = page.get_size()[1]
    left, bottom, right, top = rect
    scale = DPI / 72
    w, h = round((right - left) * scale), round((top - bottom) * scale)
    ww, hh = w * SUPERSAMPLE, h * SUPERSAMPLE
    bitmap = pdfium.PdfBitmap.new_native(ww, hh, raw.FPDFBitmap_BGR)
    bitmap.fill_rect((255, 255, 255, 255), 0, 0, ww, hh)
    s = scale * SUPERSAMPLE
    matrix = raw.FS_MATRIX(s, 0, 0, s, -left * s, -(height - top) * s)
    raw.FPDF_RenderPageBitmapWithMatrix(bitmap.raw, page.raw, matrix, raw.FS_RECTF(0, 0, ww, hh), 0)
    return bitmap.to_pil().convert("RGB").resize((w, h), Image.BOX)


def rasterize(pdf: pdfium.PdfDocument, frames: dict[str, Frame] | None, bundle_entries: list[dict]) -> dict[str, dict]:
    pages_dir, crops_dir = EVIDENCE / "pages", EVIDENCE / "crops"
    for d in (pages_dir, crops_dir):
        shutil.rmtree(d, ignore_errors=True)
        d.mkdir(parents=True)
    for pi in range(len(pdf)):
        img = pdf[pi].render(scale=DPI / 72).to_pil().convert("RGB")
        img.save(pages_dir / f"page-{pi + 1}.png", dpi=(DPI, DPI), optimize=True)
    crops: dict[str, dict] = {}
    for e in bundle_entries if frames else []:
        fr = frames[e["namespace"]]  # type: ignore[index]
        crop = render_frame(pdf[fr.page], fr.rect)
        path = crops_dir / f"{e['namespace']}.png"
        crop.save(path, dpi=(DPI, DPI), optimize=True)
        crops[e["namespace"]] = {"file": path, "size": list(crop.size), "sha256": support.sha256_file(path)}
    return crops


def run_compare(bundle: Path, crops_dir: Path, out: Path) -> tuple[dict, dict]:
    proc = subprocess.run(
        ["pnpm", "exec", "tsx", "tests/pdf/compare.ts", "--bundle", str(bundle), "--crops", str(crops_dir), "--out", str(out)],
        cwd=ROOT, capture_output=True, text=True, check=False,
    )  # fmt: skip
    if proc.returncode != 0:
        raise RuntimeError(f"tests/pdf/compare.ts failed: {(proc.stderr or proc.stdout)[-800:]}")
    return json.loads((out / "browser.json").read_text()), json.loads((out / "comparison.json").read_text())


RenderFn = Callable[[Path, dict], bytes]


def http_render(url: str, key: str) -> RenderFn:
    return lambda bundle, options: client.render_bundle(url, key, bundle, options)


def library_render(chromium: Path) -> RenderFn:
    import library_fallback

    return lambda bundle, options: library_fallback.render_bundle_library_checked(bundle, options, chromium)


def render_report(run: Run, chromium: Path, bundle: Path, work: Path) -> tuple[bytes, str, int]:
    """The main render through the HTTP service, or through the library when the service cannot
    start, then the negative checks through the same path. Returns (pdf, path used, attempts).

    A stalled Chromium launch in a sandbox answers 504 for the whole budget and then recovers, so
    the main render retries once on a 504 (and only then). Raises `client.RenderRejected` /
    `RuntimeError` when the report render itself fails.
    """
    try:
        with support.dravenpdf_server(chromium, work / "server.log") as (url, key):
            render = http_render(url, key)
            data, attempts, detail = negative.expect_success(lambda: render(bundle, client.PDF_OPTIONS))
            if data is None:
                raise RuntimeError(detail)
            negative_checks(run, render, bundle, work, "http")
            return data, "http", attempts
    except support.ServerStartError as exc:
        print(f"server could not start ({exc}); using the library fallback")
    render = library_render(chromium)
    data, attempts, detail = negative.expect_success(lambda: render(bundle, client.PDF_OPTIONS))
    if data is None:
        raise RuntimeError(f"the library fallback failed too: {detail}")
    # The negative checks run through DravenPDF's Python API: a missing font raises
    # RenderTimeoutError, a missing stylesheet IncompleteRenderError.
    negative_checks(run, render, bundle, work, "library")
    return data, "library", attempts


def negative_checks(run: Run, render: RenderFn, bundle: Path, work: Path, path_used: str) -> None:
    """Strict mode: a missing font or stylesheet must fail the render and return no PDF."""
    options = {**client.PDF_OPTIONS, "timeout_ms": NEGATIVE_TIMEOUT_MS}
    started = time.monotonic()
    data, attempts, detail = negative.expect_success(lambda: render(bundle, options))
    run.add(
        f"control: the intact bundle renders within {NEGATIVE_TIMEOUT_MS} ms ({path_used})",
        data is not None,
        f"{time.monotonic() - started:.1f} s" if data is not None else detail,
        attempts,
    )
    broken = work / "bundle-missing-font"
    shutil.copytree(bundle, broken)
    (broken / MISSING_FONT).unlink()
    # DravenPDF waits for window.__DRAVENPDF_READY__. The bootstrap throws on the font 404 and never
    # sets it, so the wait runs out: 504 render_timeout (ruling R36), not the 422 render_incomplete
    # that a strict check on a page that did set the flag would give. DravenPDF checks page errors
    # only after that wait and does not log them when it times out, so the page error itself is
    # proven by the browser check below, not by the server log.
    font = negative.expect_rejection(
        lambda: render(broken, options), "render_timeout", 504 if path_used == "http" else None
    )
    run.add(
        f"missing font fails the PDF render ({'504 ' if path_used == 'http' else 'RenderTimeoutError, '}render_timeout, no PDF returned) ({path_used})",
        font.ok,
        font.detail,
        font.attempts,
    )
    run_browser_failure(run, broken)
    broken_css = work / "bundle-missing-css"
    shutil.copytree(bundle, broken_css)
    (broken_css / "dravenviz.css").unlink()
    css = negative.expect_rejection(
        lambda: render(broken_css, client.PDF_OPTIONS), "render_incomplete", 422 if path_used == "http" else None
    )
    run.add(
        f"missing stylesheet fails strict resource checking ({'422 ' if path_used == 'http' else 'IncompleteRenderError, '}render_incomplete) ({path_used})",
        css.ok,
        css.detail,
        css.attempts,
    )


def run_browser_failure(run: Run, broken: Path) -> None:
    """Why the missing-font render times out: in the browser the bootstrap throws on the font 404
    and never sets the ready flag (so DravenPDF's wait for the flag runs out)."""
    out = Path(tempfile.mkdtemp(prefix="dv-fail-"))
    proc = subprocess.run(
        ["pnpm", "exec", "tsx", "tests/pdf/compare.ts", "--mode", "failure", "--bundle", str(broken), "--out", str(out)],
        cwd=ROOT, capture_output=True, text=True, check=False,
    )  # fmt: skip
    if proc.returncode != 0:
        run.add("missing font: bootstrap throws and never sets the ready flag", False, (proc.stderr or proc.stdout)[-300:])
        return
    seen = json.loads((out / "failure.json").read_text())
    shutil.rmtree(out, ignore_errors=True)
    ok = (not seen["ready"]) and bool(seen["pageErrors"]) and any("NotoSans-Regular" in f for f in seen["failedRequests"])
    run.add(
        "missing font: bootstrap throws and never sets the ready flag",
        ok,
        f"ready={seen['ready']}, {len(seen['pageErrors'])} page error(s): {(seen['pageErrors'] or [''])[0][:100]}; 404s {seen['failedRequests']}",
    )


# ----------------------------------------------------------------------------- main


def main() -> int:
    print("test:pdf: DravenViz report -> DravenPDF -> A4 PDF")
    try:
        chromium = support.check_prerequisites()
        for tool in ("node", "pnpm"):
            if shutil.which(tool) is None:
                raise support.Unverified(f"{tool} is not installed")
    except support.Unverified as exc:
        print(f"UNVERIFIED: {exc}")
        return EXIT_PREREQ
    if not TARBALL.is_file():
        print(f"FAIL: {TARBALL.relative_to(ROOT)} is missing; run pnpm pack:local")
        return EXIT_FAIL

    method, calibration = load_method()
    entries = read_report()
    namespaces = [e["namespace"] for e in entries]
    run = Run()
    print(f"frame method from the probe: {method}")
    started = time.monotonic()

    with tempfile.TemporaryDirectory(prefix="dv-pdf-") as tmp:
        work = Path(tmp)
        bundle, manifest = build_bundle(work, entries)
        try:
            data, path_used, attempts = render_report(run, chromium, bundle, work)
        except (client.RenderRejected, RuntimeError) as exc:
            print(f"FAIL: the report render failed: {exc}")
            return EXIT_FAIL

        EVIDENCE.mkdir(parents=True, exist_ok=True)
        (EVIDENCE / "report-slice1.pdf").write_bytes(data)
        pdf = pdfium.PdfDocument(data)
        w, h = pdf[0].get_size()
        run.add(
            "the PDF is A4 (595 x 842 pt +-1) with at least 1 page",
            len(pdf) >= 1 and abs(w - A4_PT[0]) <= 1 and abs(h - A4_PT[1]) <= 1,
            f"{len(pdf)} pages, {w:.1f} x {h:.1f} pt, {len(data)} bytes, path {path_used}",
        )

        frames: dict[str, Frame] | None = None
        if method == "link-dest":
            frames = locate_frames(run, pdf, namespaces, calibration)
        elif method == "markers":
            run.add("frames located by markers", None, "markers driver path is not implemented; link-dest is preferred")
        else:
            run.add("frames located (crop comparison, label geometry)", None, "no probe method passed (controller ruling R2)")

        crops = rasterize(pdf, frames, entries)
        check_text(run, pdf, entries, frames)

        comparison: dict | None = None
        label_summary: dict | None = None
        if frames:
            try:
                browser, comparison = run_compare(bundle, EVIDENCE / "crops", work / "compare")
            except RuntimeError as exc:
                run.add("browser comparison render (tests/pdf/compare.ts)", False, str(exc))
                browser = None
            if browser is not None:
                ratios = {c["namespace"]: c["ratio"] for c in comparison["comparisons"]}
                worst = max(ratios.items(), key=lambda kv: kv[1])
                run.add(
                    f"chart crops match the browser render (pixelmatch threshold {comparison['threshold']}, ratio <= {comparison['maxRatio'] * 100:.3f} %)",
                    all(v <= comparison["maxRatio"] for v in ratios.values()),
                    f"worst {worst[0]} {worst[1] * 100:.3f} %",
                )
                if any(v > comparison["maxRatio"] for v in ratios.values()):
                    diffs = EVIDENCE / "diff"
                    shutil.rmtree(diffs, ignore_errors=True)
                    shutil.copytree(work / "compare" / "diff", diffs)
                label_summary = check_labels(run, pdf, frames, browser, entries)
        else:
            for name in (
                "chart crops match the browser render",
                "PDF text objects map onto the browser label manifest",
                "effective font size per role (needs frames)",
                "label clipping and overlap on oriented quads",
            ):
                run.add(name, None, "frames not located")

        failed = [c for c in run.checks if c.status == "fail"]
        unverified = [c for c in run.checks if c.status == "unverified"]
        status = "fail" if failed else ("unverified" if unverified else "pass")
        evidence = {
            "report": "report-slice1",
            "status": status,
            "path": path_used,
            "renderAttempts": attempts,
            "frameMethod": method,
            "dravenpdf": {"commit": support.DRAVENPDF_COMMIT, "options": client.PDF_OPTIONS},
            "chromium": support.chromium_version(chromium),
            "pypdfium2": str(pdfium.version.PYPDFIUM_INFO),
            "rasterDpi": DPI,
            "package": {"tarball": TARBALL.name, "sha256": support.sha256_file(TARBALL), "version": manifest["version"]},
            "fonts": [
                {"path": f["path"], "sha256": f["sha256"]} for f in manifest["files"] if f["role"] == "font"
            ],
            "pdf": {
                "file": "report-slice1.pdf",
                "bytes": len(data),
                "sha256": support.sha256_bytes(data),
                "pages": len(pdf),
                "pageSizePt": [round(w, 2), round(h, 2)],
            },
            "instances": [
                {
                    "fixture": e["fixture"],
                    "namespace": e["namespace"],
                    "specSha256": e["specSha256"],
                    "page": frames[e["namespace"]].page + 1 if frames else None,
                    "rectPt": [round(v, 3) for v in frames[e["namespace"]].rect] if frames else None,
                    "rectMm": [round(v * pdfgeo.MM_PER_PT, 3) for v in frames[e["namespace"]].rect] if frames else None,
                    "method": method if frames else None,
                    "cropSha256": crops[e["namespace"]]["sha256"] if frames else None,
                    "identity": {
                        "residualPt": round(frames[e["namespace"]].residual_pt, 3)
                        if frames[e["namespace"]].residual_pt is not None
                        else None,
                        "runnerUpPt": round(frames[e["namespace"]].runner_up_pt, 1)
                        if frames[e["namespace"]].runner_up_pt is not None
                        else None,
                    }
                    if frames
                    else None,
                    "mismatchRatio": next(
                        (c["ratio"] for c in (comparison or {}).get("comparisons", []) if c["namespace"] == e["namespace"]),
                        None,
                    ),
                }
                for e in entries
            ],
            "labels": label_summary,
            "checks": [c.__dict__ for c in run.checks],
            "seconds": round(time.monotonic() - started, 1),
        }
        (EVIDENCE / "report-slice1.json").write_text(json.dumps(evidence, indent=2) + "\n")

    print(f"evidence: {EVIDENCE.relative_to(ROOT)}/report-slice1.pdf, report-slice1.json, pages/, crops/")
    if failed:
        print(f"FAIL: {len(failed)} check(s) failed")
        return EXIT_FAIL
    if unverified:
        print(f"UNVERIFIED: {len(unverified)} check(s) could not be proven: " + "; ".join(c.name for c in unverified))
        return EXIT_UNVERIFIED
    print("PASS")
    return EXIT_PASS


if __name__ == "__main__":
    sys.exit(main())
