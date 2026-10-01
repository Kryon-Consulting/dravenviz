"""Task 20 helper: DravenPDF HTTP numbers for `pnpm measure` (design section 18, scenario P4).

    uv run python examples/dravenpdf/measure_pdf.py --mode size    --out size-pdf.json
    uv run python examples/dravenpdf/measure_pdf.py --mode latency --out latency-pdf.json

Reuses the test:pdf machinery instead of copying it: `run_pdf_check.read_report` / `build_bundle`
(bundle assembly from the packed tarball), `support.dravenpdf_server` (uv serve, free port, random
API key, /readyz wait, warm-up render, stop) and `client.render_bundle` (the HTTP call).

Latency rule (recorded in evidence/perf/README.md): the server is warmed first, then 5 warm-up
renders, then 30 measured renders at concurrency 1. A render that stalls (HTTP 504 after the whole
30 s budget, seen about once in ten renders in the sandbox) is NOT dropped: its duration is recorded
under `stalls` (a rare 422 "Chromium redirect control failed" goes under `otherTransientFailures`), the stall rate is stalls / (stalls + renders), and the same sample is retried. The
30 `samples` are therefore successful renders; p50/p95 are computed over them, and the stall
accounting is reported beside them.
"""

from __future__ import annotations

import argparse
import json
import sys
import tempfile
import time
from pathlib import Path

import pypdfium2 as pdfium

import client
import run_pdf_check
import support

WARMUP = 5
SAMPLES = 30
MAX_CONSECUTIVE_STALLS = 5


# Besides the 504 stall, the sandbox Chromium sometimes loses its DevTools session mid-render and
# DravenPDF answers 422 render_failed "Chromium redirect control failed" (seen once in ~100 renders).
# It is the same kind of environmental failure, so it is retried and reported, never dropped.
TRANSIENT_422 = "redirect control failed"
other_transient: list[dict] = []


def timed_render(url: str, key: str, bundle: Path, stalls: list[float]) -> tuple[float, bytes]:
    """One successful render: (milliseconds, pdf). A 504 is recorded in `stalls` and retried; the
    422 above is recorded in `other_transient` and retried."""
    for _ in range(MAX_CONSECUTIVE_STALLS):
        started = time.perf_counter()
        try:
            data = client.render_bundle(url, key, bundle, client.PDF_OPTIONS)
        except client.RenderRejected as exc:
            elapsed = (time.perf_counter() - started) * 1000
            if exc.status == 504:
                stalls.append(elapsed)
            elif exc.status == 422 and TRANSIENT_422 in exc.message:
                other_transient.append({"status": 422, "message": exc.message, "ms": elapsed})
            else:
                raise
            continue
        return (time.perf_counter() - started) * 1000, data
    raise RuntimeError(f"{MAX_CONSECUTIVE_STALLS} consecutive stalled renders")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    parser.add_argument("--mode", choices=["size", "latency"], required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    try:
        chromium = support.check_prerequisites()
    except support.Unverified as exc:
        print(f"UNVERIFIED: {exc}")
        return support.EXIT_PREREQ
    entries = run_pdf_check.read_report()
    with tempfile.TemporaryDirectory(prefix="dv-measure-") as tmp:
        work = Path(tmp)
        bundle, _ = run_pdf_check.build_bundle(work, entries)
        with support.dravenpdf_server(chromium, work / "server.log") as (url, key):
            warm_stalls: list[float] = []
            if args.mode == "size":
                _, data = timed_render(url, key, bundle, warm_stalls)
                pages = len(pdfium.PdfDocument(data))
                args.out.write_text(json.dumps({"fixture": "report-slice1", "bytes": len(data), "pages": pages}))
                print(f"report-slice1.pdf: {len(data)} bytes, {pages} pages")
                return 0
            for _ in range(WARMUP):
                timed_render(url, key, bundle, warm_stalls)
            stalls: list[float] = []
            samples: list[float] = []
            for _ in range(SAMPLES):
                ms, _ = timed_render(url, key, bundle, stalls)
                samples.append(ms)
            result = {
                "samples": samples,
                "warmupStalls": len(warm_stalls),
                "stalls": {
                    "count": len(stalls),
                    "rate": len(stalls) / (len(stalls) + len(samples)),
                    "durationsMs": stalls,
                },
                "otherTransientFailures": other_transient,
            }
            args.out.write_text(json.dumps(result))
            print(f"P4: {len(samples)} samples, {len(stalls)} stall(s), {len(warm_stalls)} warm-up stall(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
