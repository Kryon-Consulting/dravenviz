"""Minimal DravenPDF HTTP client for a DravenViz report bundle.

    DRAVENPDF_API_KEY=... python client.py --url http://127.0.0.1:8000 \\
        --charts charts.json --out report.pdf [--bundle-dir ./bundle]

Python supplies ordinary chart JSON and the document HTML; it never draws a chart or calls Node.
The bundle directory must already hold `index.html`, `bootstrap.js`, `report.css` and the DravenViz
assets copied from the packed tarball (see README.md).
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path

import httpx

# The options of design section 13. The server rejects unknown fields.
PDF_OPTIONS: dict = {
    "paper": "A4",
    "media": "print",
    "print_background": True,
    "prefer_css_page_size": True,
    "wait_until": "load",
    "wait_for_ready_flag": True,
    "fail_on_resource_errors": True,
    "fail_on_page_errors": True,
    "timeout_ms": 30000,
}


class RenderRejected(Exception):
    """The server answered with an error status."""

    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(f"HTTP {status} {code}: {message}")
        self.status = status
        self.code = code
        self.message = message


def bundle_files(bundle_dir: Path) -> list[Path]:
    return sorted(p for p in bundle_dir.rglob("*") if p.is_file())


def render_bundle(url: str, api_key: str, bundle_dir: Path, options: dict) -> bytes:
    """POST /v1/render/bundle. Each file's bundle path is its multipart filename.

    Raises `RenderRejected` for any error status, and `RuntimeError` unless both
    `X-DravenPdf-Resource-Errors` and `X-DravenPdf-Page-Errors` are `0`.
    """
    files = [
        ("files", (p.relative_to(bundle_dir).as_posix(), p.read_bytes()))
        for p in bundle_files(bundle_dir)
    ]
    if not any(name == "index.html" for _, (name, _) in files):
        raise RuntimeError(f"{bundle_dir} has no index.html")
    response = httpx.post(
        f"{url.rstrip('/')}/v1/render/bundle",
        headers={"X-API-Key": api_key},
        files=files,
        data={"options": json.dumps(options)},
        timeout=(options.get("timeout_ms", 30000) / 1000) + 30,
    )
    if response.status_code != 200:
        try:
            error = response.json()["error"]
            raise RenderRejected(response.status_code, error["code"], error["message"])
        except (ValueError, KeyError):
            raise RenderRejected(response.status_code, "unknown", response.text[:300]) from None
    for header in ("X-DravenPdf-Resource-Errors", "X-DravenPdf-Page-Errors"):
        if response.headers.get(header) != "0":
            raise RuntimeError(f"{header} is {response.headers.get(header)!r}, expected '0'")
    if not response.content.startswith(b"%PDF"):
        raise RuntimeError("the response is not a PDF")
    return response.content


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    parser.add_argument("--url", default=os.environ.get("DRAVENPDF_URL", "http://127.0.0.1:8000"))
    parser.add_argument("--charts", type=Path, required=True, help="[{spec, namespace}, ...]")
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--bundle-dir", type=Path, default=Path(__file__).parent / "bundle")
    args = parser.parse_args()
    api_key = os.environ.get("DRAVENPDF_API_KEY")
    if not api_key:
        print("DRAVENPDF_API_KEY is not set", file=sys.stderr)
        return 2
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp) / "bundle"
        shutil.copytree(args.bundle_dir, work)
        shutil.copyfile(args.charts, work / "charts.json")
        pdf = render_bundle(args.url, api_key, work, PDF_OPTIONS)
    args.out.write_bytes(pdf)
    print(f"wrote {args.out} ({len(pdf)} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
