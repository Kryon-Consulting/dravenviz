"""PDF side of `pnpm visual:calibrate` (design section 16.2).

Renders the slice-1 report N times through DravenPDF (one server, one bundle), rasterizes every
chart frame of each PDF with the same code `pnpm test:pdf` uses (`run_pdf_check.render_frame`) and
writes `<out>/run-<i>/<namespace>.png` plus a copy of the bundle to `<out>/bundle`. The comparisons
themselves (PDF vs PDF, browser vs PDF) are made by `tests/visual/calibrate.ts`.

    uv run python examples/dravenpdf/calibrate_pdf.py --out <dir> [--runs 10]

Exit codes as `run_pdf_check.py`: 0 done, 1 failure, 3 missing prerequisite (`UNVERIFIED:`).
"""

from __future__ import annotations

import argparse
import shutil
import sys
import tempfile
from pathlib import Path

import pypdfium2 as pdfium

import client
import run_pdf_check as drv
import support

MAX_ATTEMPTS = 3


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--runs", type=int, default=10)
    args = parser.parse_args()
    try:
        chromium = support.check_prerequisites()
    except support.Unverified as exc:
        print(f"UNVERIFIED: {exc}")
        return support.EXIT_PREREQ
    method, calibration = drv.load_method()
    if method != "link-dest":
        print(f"UNVERIFIED: frame method {method} cannot locate frames")
        return support.EXIT_PREREQ
    entries = drv.read_report()
    namespaces = [e["namespace"] for e in entries]
    out: Path = args.out
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir(parents=True)
    with tempfile.TemporaryDirectory(prefix="dv-cal-") as tmp:
        work = Path(tmp)
        bundle, _ = drv.build_bundle(work, entries)
        shutil.copytree(bundle, out / "bundle")
        # A sandboxed Chromium stalls on roughly 1 render in 10 and the stall can persist for the
        # whole server, so each attempt starts a fresh DravenPDF server; at most MAX_ATTEMPTS per run.
        for i in range(args.runs):
            data: bytes | None = None
            detail = ""
            for attempt in range(1, MAX_ATTEMPTS + 1):
                try:
                    with support.dravenpdf_server(chromium, work / f"server-{i}-{attempt}.log") as (url, key):
                        data = client.render_bundle(url, key, bundle, client.PDF_OPTIONS)
                    break
                except support.ServerStartError as exc:
                    print(f"UNVERIFIED: DravenPDF server could not start: {exc}")
                    return support.EXIT_PREREQ
                except client.RenderRejected as exc:
                    detail = str(exc)
                    if exc.status != 504:
                        break
                    print(f"render {i}: attempt {attempt} stalled (504); restarting the server")
            if data is None:
                print(f"FAIL: render {i} failed: {detail}")
                return support.EXIT_FAIL
            pdf = pdfium.PdfDocument(data)
            frames = drv.locate_frames(drv.Run(), pdf, namespaces, calibration)
            if frames is None:
                print(f"FAIL: render {i}: frames not located")
                return support.EXIT_FAIL
            run_dir = out / f"run-{i}"
            run_dir.mkdir()
            for ns, fr in frames.items():
                crop = drv.render_frame(pdf[fr.page], fr.rect)
                crop.save(run_dir / f"{ns}.png", dpi=(drv.DPI, drv.DPI))
            print(f"render {i}: {len(pdf)} pages, {len(data)} bytes, {attempt} attempt(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
