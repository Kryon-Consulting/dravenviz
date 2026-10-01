"""The same bundle through DravenPDF's Python library instead of the HTTP service.

Used only when `dravenpdf serve` cannot start. The result is marked `path: "library"`.

    uv run python library_fallback.py --bundle-dir ./bundle --out report.pdf
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from dravenpdf import Renderer, RenderOptions

from client import PDF_OPTIONS, bundle_files


def render_bundle_library(bundle_dir: Path, options: dict, chromium: Path | None = None) -> bytes:
    """`Renderer.from_html(index_html, options, assets={path: bytes})`, then the same strict
    checks as the HTTP client: no resource errors and no page errors."""
    html = (bundle_dir / "index.html").read_text(encoding="utf-8")
    assets = {
        p.relative_to(bundle_dir).as_posix(): p.read_bytes()
        for p in bundle_files(bundle_dir)
        if p != bundle_dir / "index.html"
    }
    kwargs = {"executable_path": chromium} if chromium else {}
    with Renderer(**kwargs) as renderer:
        doc = renderer.from_html(html, RenderOptions(**options), assets=assets)
    report = doc.render_report
    if report is not None and (report.resource_problems or report.page_errors):
        raise RuntimeError(f"render problems: {report.summary()}")
    return doc.to_bytes()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle-dir", type=Path, default=Path(__file__).parent / "bundle")
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    pdf = render_bundle_library(args.bundle_dir, PDF_OPTIONS)
    args.out.write_bytes(pdf)
    print(f"wrote {args.out} ({len(pdf)} bytes, path: library)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
