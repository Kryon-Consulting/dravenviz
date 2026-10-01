"""Part A of Task 16: which method finds a chart's frame in a DravenPDF PDF?

Renders `probe/` (7 instances of `line-weekly-flow`, namespaces p1..p7, on 3 pages, with the
caption link targets in reverse order and a magenta ground-truth outline per frame) through the
same server and options as the report, then measures two candidate methods against the outline:

* `link-dest`: the link annotation rect of each frame, identity resolved through the link's
  destination to the `DVT<ns>` token.
* `markers`: the `DVF<ns>TL` / `DVF<ns>BR` tokens with calibrated corner offsets.

Writes `evidence/pdf/probe/probe.pdf`, `probe.json`, `frame_calibration.json` and
`docs/plans/slice-1-pdf-probe-results.md`. Run it after `pnpm pack:local`:

    cd examples/dravenpdf && uv run python probe_frames.py
"""

from __future__ import annotations

import json
import math
import shutil
import statistics
import sys
import tempfile
from pathlib import Path

import pypdfium2 as pdfium

import client
import pdfgeo
import support

PROBE_NS = [f"p{i}" for i in range(1, 8)]
EDGE_TOL = 0.25  # pt: link rect edge vs ground truth
MARKER_TOL = 0.25  # pt: marker residual after subtracting the mean offset
DEST_TOL = 2.0  # pt: destination vs token
MAGENTA = (255, 0, 255)
OUT = support.ROOT / "evidence" / "pdf" / "probe"
RESULTS_MD = support.ROOT / "docs" / "plans" / "slice-1-pdf-probe-results.md"
CALIBRATION = support.HERE / "frame_calibration.json"


def build_probe_bundle(work: Path) -> Path:
    package = support.extract_tarball(support.ROOT / ".pack" / "draven-viz-0.1.0.tgz", work / "tgz")
    bundle = work / "bundle"
    support.stage_assets(package, bundle)
    for name in ("bootstrap.js", "report.css"):
        shutil.copyfile(support.HERE / "bundle" / name, bundle / name)
    for name in ("index.html", "probe.css", "charts.json"):
        shutil.copyfile(support.HERE / "probe" / name, bundle / name)
    return bundle


def dist_to_rect(p: pdfgeo.Point, r: pdfgeo.Rect) -> float:
    dx = max(r[0] - p[0], 0, p[0] - r[2])
    dy = max(r[1] - p[1], 0, p[1] - r[3])
    return math.hypot(dx, dy)


def measure(pdf: pdfium.PdfDocument) -> dict:
    pages = len(pdf)
    # Ground truth in reading order: page, then top to bottom. DOM order is p1..p7.
    truth: list[dict] = []
    for pi in range(pages):
        rects = sorted(pdfgeo.stroked_rects(pdf[pi], MAGENTA), key=lambda r: -r[3])
        truth += [{"page": pi, "rect": r} for r in rects]
    if len(truth) != len(PROBE_NS):
        raise RuntimeError(f"found {len(truth)} ground-truth rectangles, expected {len(PROBE_NS)}")
    for t, ns in zip(truth, PROBE_NS, strict=True):
        t["ns"] = ns

    links = [link for pi in range(pages) for link in pdfgeo.page_links(pdf, pi)]
    tokens = [tok for pi in range(pages) for tok in pdfgeo.page_tokens(pdf, pi, PROBE_NS)]
    caption_tokens = [t for t in tokens if t.kind == "T"]

    # ---- link-dest
    rows: list[dict] = []
    for t in truth:
        same_page = [lk for lk in links if lk.page == t["page"]]
        link = min(same_page, key=lambda lk: pdfgeo.rect_edge_error(lk.rect, t["rect"]))
        rows.append({**t, "link": link})
    if len({id(r["link"]) for r in rows}) != len(rows):
        raise RuntimeError("two frames matched the same link")
    for r in rows:
        r["edge_error"] = pdfgeo.rect_edge_error(r["link"].rect, r["rect"])
        dest = (r["link"].dest_x, r["link"].dest_y)
        if r["link"].dest_page is None or None in dest:
            raise RuntimeError(f"link of {r['ns']} has no destination")
        same = [c for c in caption_tokens if c.page == r["link"].dest_page]
        # Literal rule: the token whose char box contains or is nearest to the destination.
        nearest = min(same, key=lambda c: dist_to_rect(dest, c.box))  # type: ignore[arg-type]
        r["literal_ns"] = nearest.ns
        r["literal_distance"] = dist_to_rect(dest, nearest.box)  # type: ignore[arg-type]
    offsets_x, offsets_y = [], []
    for r in rows:
        tok = next(c for c in caption_tokens if c.ns == r["ns"])
        # dest is the token's top-left position shifted by a constant: measure the shift.
        offsets_x.append(r["link"].dest_x - tok.box[0])
        offsets_y.append(r["link"].dest_y - tok.box[3])
    # Mid-range: the shift is constant up to one pixel of layout snapping.
    dest_dx = (min(offsets_x) + max(offsets_x)) / 2
    dest_dy = (min(offsets_y) + max(offsets_y)) / 2
    for r in rows:
        cx, cy = r["link"].dest_x - dest_dx, r["link"].dest_y - dest_dy
        same = [c for c in caption_tokens if c.page == r["link"].dest_page]
        best = min(same, key=lambda c: math.hypot(cx - c.box[0], cy - c.box[3]))
        r["resolved_ns"] = best.ns
        r["resolved_distance"] = math.hypot(cx - best.box[0], cy - best.box[3])
    caption_order = [c.ns for c in sorted(caption_tokens, key=lambda c: (c.page, -c.box[3]))]
    link_dest = {
        "edge_error_max": max(r["edge_error"] for r in rows),
        "edge_ok": all(r["edge_error"] <= EDGE_TOL for r in rows),
        "literal_correct": sum(r["literal_ns"] == r["ns"] for r in rows),
        "literal_distance_max": max(r["literal_distance"] for r in rows),
        "literal_ok": all(r["literal_ns"] == r["ns"] and r["literal_distance"] <= DEST_TOL for r in rows),
        "dest_offset": {"dx": dest_dx, "dy": dest_dy},
        "offsets_x": offsets_x,
        "offsets_y": offsets_y,
        "resolved_correct": sum(r["resolved_ns"] == r["ns"] for r in rows),
        "resolved_distance_max": max(r["resolved_distance"] for r in rows),
        "resolved_unique": len({r["resolved_ns"] for r in rows}) == len(rows),
        "caption_order": caption_order,
        "frame_order": PROBE_NS,
    }
    link_dest["resolved_ok"] = (
        link_dest["resolved_correct"] == len(rows)
        and link_dest["resolved_unique"]
        and link_dest["resolved_distance_max"] <= DEST_TOL
        and caption_order != PROBE_NS  # identity is not enumeration order
    )
    link_dest["pass"] = bool(link_dest["edge_ok"] and link_dest["resolved_ok"])

    # ---- markers
    by = {(t.ns, t.kind): t for t in tokens if t.kind in ("TL", "BR")}
    raw_tl, raw_br = [], []
    for r in rows:
        tl, br = by[(r["ns"], "TL")], by[(r["ns"], "BR")]
        if tl.page != r["page"] or br.page != r["page"]:
            raise RuntimeError(f"markers of {r['ns']} are not on the frame's page")
        gl, gb, gr, gt = r["rect"]
        raw_tl.append((tl.box[0] - gl, tl.box[3] - gt))
        raw_br.append((br.box[2] - gr, br.box[1] - gb))
    mean_tl = (statistics.fmean(p[0] for p in raw_tl), statistics.fmean(p[1] for p in raw_tl))
    mean_br = (statistics.fmean(p[0] for p in raw_br), statistics.fmean(p[1] for p in raw_br))
    residuals = [
        (abs(p[0] - mean_tl[0]), abs(p[1] - mean_tl[1])) for p in raw_tl
    ] + [(abs(p[0] - mean_br[0]), abs(p[1] - mean_br[1])) for p in raw_br]
    markers = {
        "tl_offset": {"dx": mean_tl[0], "dy": mean_tl[1]},
        "br_offset": {"dx": mean_br[0], "dy": mean_br[1]},
        "raw_tl": raw_tl,
        "raw_br": raw_br,
        "residual_max": max(max(r) for r in residuals),
    }
    markers["pass"] = bool(markers["residual_max"] <= MARKER_TOL)

    return {
        "pages": pages,
        "frames": [
            {
                "ns": r["ns"],
                "page": r["page"] + 1,
                "truthPt": list(r["rect"]),
                "linkRectPt": list(r["link"].rect),
                "edgeErrorPt": r["edge_error"],
                "dest": [r["link"].dest_page + 1, r["link"].dest_x, r["link"].dest_y],
                "literalNs": r["literal_ns"],
                "literalDistancePt": r["literal_distance"],
                "resolvedNs": r["resolved_ns"],
                "resolvedDistancePt": r["resolved_distance"],
            }
            for r in rows
        ],
        "linkDest": link_dest,
        "markers": markers,
    }


def choose(result: dict) -> str:
    if result["linkDest"]["pass"]:
        return "link-dest"
    if result["markers"]["pass"]:
        return "markers"
    return "none"


def write_markdown(result: dict, method: str, meta: dict) -> None:
    ld, mk = result["linkDest"], result["markers"]

    def f(v: float, n: int = 3) -> str:
        return f"{v:.{n}f}"

    lines = [
        "# Slice 1 PDF frame probe: results",
        "",
        "Generated by `examples/dravenpdf/probe_frames.py`; do not edit by hand. Evidence is in",
        "`evidence/pdf/probe/`. Purpose: find out how to locate a chart instance's frame (the box of",
        "its SVG) in the PDF, by identity and geometry, so that crops are taken from the right place.",
        "",
        f"- Chosen method: `{method}`",
        f"- Proven: {'yes' if method != 'none' else 'no'}",
        f"- DravenPDF commit: `{support.DRAVENPDF_COMMIT}`; Chromium: `{meta['chromium']}`; pypdfium2: `{meta['pypdfium2']}`",
        f"- Probe PDF: {meta['bytes']} bytes, {result['pages']} pages, sha256 `{meta['sha256']}`",
        "",
        "## Setup",
        "",
        "Seven instances of `line-weekly-flow` (namespaces `p1`..`p7`) fall on three pages (3, 3 and 1)",
        "through forced page breaks. Each frame is an `<a href=\"#dvt-<ns>\">` whose box is exactly the",
        "chart. Each data-table caption holds a 1 pt `DVT<ns>` token (the link target); the captions",
        "are in reverse order (`p7`..`p1`) on the last page, so identity cannot come from enumeration",
        "order. Each frame also holds a div exactly covering it with a magenta (`#ff00ff`) border; in the",
        "PDF that is a stroked path whose bounds, inset by half the effective stroke width (stroke",
        "width times the square root of the absolute determinant of the object's matrix), are the true",
        "frame rect. All rectangles below are PDF points, origin bottom left.",
        "",
        "## Method `link-dest`",
        "",
        "Link annotation rect per frame, identity resolved through the link's destination.",
        "",
        "| ns | page | link edge error (pt) | dest (page, x, y) | literal token | literal distance (pt) | calibrated token | calibrated residual (pt) |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for fr in result["frames"]:
        d = fr["dest"]
        lines.append(
            f"| {fr['ns']} | {fr['page']} | {f(fr['edgeErrorPt'])} | ({d[0]}, {f(d[1], 2)}, {f(d[2], 2)})"
            f" | {fr['literalNs']} | {f(fr['literalDistancePt'], 2)} | {fr['resolvedNs']} | {f(fr['resolvedDistancePt'])} |"
        )
    lines += [
        "",
        f"- Link rect edge error, maximum over 7 frames: {f(ld['edge_error_max'])} pt (limit {EDGE_TOL}): **{'pass' if ld['edge_ok'] else 'fail'}**.",
        f"- Literal rule (nearest token to the destination, within {DEST_TOL} pt): {ld['literal_correct']} of 7 correct, largest distance {f(ld['literal_distance_max'], 1)} pt: **{'pass' if ld['literal_ok'] else 'fail'}**.",
        "- Why the literal rule fails: Chromium writes the destination of a named anchor shifted by the page",
        "  margin relative to the token's position (x by minus the margin, y by plus the margin; here",
        f"  16 mm = 45.35 pt). Measured shift, mid-range of 7: dx = {f(ld['dest_offset']['dx'], 2)} pt, dy = {f(ld['dest_offset']['dy'], 2)} pt.",
        f"  Per-instance dx spread {f(min(ld['offsets_x']), 2)}..{f(max(ld['offsets_x']), 2)}, dy spread {f(min(ld['offsets_y']), 2)}..{f(max(ld['offsets_y']), 2)} (one-pixel snapping).",
        f"- With that constant shift removed: {ld['resolved_correct']} of 7 resolved to the right token, all different"
        f" ({'yes' if ld['resolved_unique'] else 'no'}), largest residual {f(ld['resolved_distance_max'])} pt (limit {DEST_TOL}): **{'pass' if ld['resolved_ok'] else 'fail'}**.",
        f"- Caption order in the PDF (top to bottom): {', '.join(ld['caption_order'])}; frame order: {', '.join(ld['frame_order'])}.",
        f"- Verdict `link-dest`: **{'pass' if ld['pass'] else 'fail'}**"
        + (" (identity needs the recorded destination offset; the frame rect is the link rect itself, no calibration)." if ld["pass"] else "."),
        "",
        "## Method `markers`",
        "",
        "Offset between each token's loose character box corner (TL: top-left, BR: bottom-right) and the",
        "true frame corner, per instance (pt):",
        "",
        "| ns | TL dx | TL dy | BR dx | BR dy |",
        "| --- | --- | --- | --- | --- |",
    ]
    for ns, tl, br in zip(PROBE_NS, mk["raw_tl"], mk["raw_br"], strict=True):
        lines.append(f"| {ns} | {f(tl[0])} | {f(tl[1])} | {f(br[0])} | {f(br[1])} |")
    lines += [
        "",
        f"- Mean offsets: TL dx = {f(mk['tl_offset']['dx'])}, dy = {f(mk['tl_offset']['dy'])}; BR dx = {f(mk['br_offset']['dx'])}, dy = {f(mk['br_offset']['dy'])}.",
        f"- Largest residual after subtracting the mean: {f(mk['residual_max'])} pt (limit {MARKER_TOL}): **{'pass' if mk['pass'] else 'fail'}**.",
        "",
        "## Decision",
        "",
        f"Method: `{method}`." if method != "none" else "No method passed. Crop-based comparison and label-geometry checks are UNVERIFIED (controller ruling R2).",
        "The driver (`run_pdf_check.py`) reads this file and `frame_calibration.json`; it refuses to run when the method here is not proven.",
        "",
    ]
    RESULTS_MD.write_text("\n".join(lines))


def main() -> int:
    try:
        chromium = support.check_prerequisites()
    except support.Unverified as exc:
        print(f"UNVERIFIED: {exc}")
        return support.EXIT_PREREQ
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        bundle = build_probe_bundle(work)
        with support.dravenpdf_server(chromium, work / "server.log") as (url, key):
            data = client.render_bundle(url, key, bundle, client.PDF_OPTIONS)
    (OUT / "probe.pdf").write_bytes(data)
    pdf = pdfium.PdfDocument(data)
    result = measure(pdf)
    method = choose(result)
    meta = {
        "chromium": support.chromium_version(chromium),
        "pypdfium2": pdfium.version.PYPDFIUM_INFO.version if hasattr(pdfium.version.PYPDFIUM_INFO, "version") else str(pdfium.version.PYPDFIUM_INFO),
        "bytes": len(data),
        "sha256": support.sha256_bytes(data),
    }
    (OUT / "probe.json").write_text(
        json.dumps({"method": method, "meta": meta, **result}, indent=2) + "\n"
    )
    calibration = {
        "method": method,
        "linkDest": {
            "destOffsetPt": result["linkDest"]["dest_offset"],
            "destTolerancePt": DEST_TOL,
            "edgeTolerancePt": EDGE_TOL,
        },
        "markers": {
            "tl": result["markers"]["tl_offset"],
            "br": result["markers"]["br_offset"],
            "residualTolerancePt": MARKER_TOL,
            "passed": result["markers"]["pass"],
        },
    }
    CALIBRATION.write_text(json.dumps(calibration, indent=2) + "\n")
    write_markdown(result, method, meta)
    print(f"probe: link-dest {'pass' if result['linkDest']['pass'] else 'fail'}, "
          f"markers {'pass' if result['markers']['pass'] else 'fail'}, method {method}")
    print(f"wrote {RESULTS_MD.relative_to(support.ROOT)} and {OUT.relative_to(support.ROOT)}/")
    return 0 if method != "none" else support.EXIT_UNVERIFIED


if __name__ == "__main__":
    sys.exit(main())
