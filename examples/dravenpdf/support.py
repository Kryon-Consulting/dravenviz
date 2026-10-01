"""Shared helpers for the DravenPDF example: prerequisites, bundle staging and the server process.

Nothing here draws a chart. It copies files out of the packed tarball (the same logic as
`pnpm stage html`, in Python), checks what the machine has, and runs `dravenpdf serve`.
"""

from __future__ import annotations

import hashlib
import json
import os
import secrets
import shutil
import socket
import subprocess
import sys
import tarfile
import time
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

import httpx

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
DRAVENPDF_COMMIT = "7a249e0"
DEFAULT_CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"

# Exit codes of the drivers (documented in README.md).
EXIT_PASS = 0
EXIT_FAIL = 1
EXIT_PREREQ = 3  # a prerequisite is missing: prints "UNVERIFIED: <reason>"
EXIT_UNVERIFIED = 4  # everything ran, but part of the evidence could not be proven


class Unverified(Exception):
    """A prerequisite is missing. The caller prints `UNVERIFIED: <reason>` and exits 3."""


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def chromium_path() -> Path:
    path = Path(os.environ.get("PW_CHROMIUM_PATH") or DEFAULT_CHROMIUM)
    if not path.is_file():
        raise Unverified(f"Chromium not found at {path} (set PW_CHROMIUM_PATH)")
    return path


def chromium_version(path: Path) -> str:
    out = subprocess.run([str(path), "--version"], capture_output=True, text=True, check=False)
    return out.stdout.strip() or "unknown"


def check_prerequisites() -> Path:
    """Returns the Chromium path, or raises `Unverified` naming what is missing."""
    if shutil.which("uv") is None:
        raise Unverified("uv is not installed")
    if sys.version_info[:2] != (3, 12):
        raise Unverified(f"Python 3.12 is required (running {sys.version.split()[0]})")
    return chromium_path()


def extract_tarball(tarball: Path, dest: Path) -> Path:
    """Extracts the packed tarball and returns its `package/` directory."""
    dest.mkdir(parents=True, exist_ok=True)
    with tarfile.open(tarball, "r:gz") as tar:
        tar.extractall(dest, filter="data")
    return dest / "package"


def stage_assets(package_dir: Path, bundle_dir: Path) -> dict:
    """Copies every file listed in `dist/asset-manifest.json` to its manifest `path` in `bundle_dir`.

    Fails on a missing file or a sha256 mismatch. Returns the parsed manifest.
    """
    manifest = json.loads((package_dir / "dist" / "asset-manifest.json").read_text())
    if not manifest["files"]:
        raise RuntimeError("the asset manifest lists no files")
    for entry in manifest["files"]:
        source = package_dir / entry["source"]
        if not source.is_file():
            raise RuntimeError(f"manifest file {entry['source']} is missing from the tarball")
        if sha256_file(source) != entry["sha256"]:
            raise RuntimeError(f"manifest file {entry['source']} does not match its sha256")
        target = bundle_dir / entry["path"]
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
    return manifest


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


@contextmanager
def dravenpdf_server(chromium: Path, log_path: Path | None = None) -> Iterator[tuple[str, str]]:
    """Runs `uv run dravenpdf serve` on a free port with a random API key; yields `(url, key)`."""
    port = free_port()
    key = secrets.token_urlsafe(24)
    env = {**os.environ, "DRAVENPDF_API_KEY": key, "DRAVENPDF_CHROMIUM_PATH": str(chromium)}
    log = open(log_path, "wb") if log_path else subprocess.DEVNULL  # noqa: SIM115
    proc = subprocess.Popen(
        ["uv", "run", "--project", str(HERE), "dravenpdf", "serve", "--port", str(port)],
        cwd=HERE,
        env=env,
        stdout=log,
        stderr=subprocess.STDOUT,
    )
    url = f"http://127.0.0.1:{port}"
    try:
        deadline = time.monotonic() + 30
        while True:
            if proc.poll() is not None:
                raise RuntimeError(f"dravenpdf serve exited with {proc.returncode} before it was ready")
            try:
                if httpx.get(f"{url}/readyz", timeout=2).status_code == 200:
                    break
            except httpx.HTTPError:
                pass
            if time.monotonic() > deadline:
                raise RuntimeError("dravenpdf serve was not ready (/readyz 200) within 30 s")
            time.sleep(0.25)
        # Launch Chromium once before the real renders: a cold first launch has taken longer
        # than the 30 s render budget. The result is discarded.
        warm = httpx.post(
            f"{url}/v1/render/html",
            headers={"X-API-Key": key},
            json={"html": "<p>warm-up</p>", "options": {"timeout_ms": 120000}},
            timeout=150,
        )
        if warm.status_code != 200:
            raise RuntimeError(f"warm-up render failed: HTTP {warm.status_code} {warm.text[:200]}")
        yield url, key
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=15)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()
        if log_path:
            log.close()  # type: ignore[union-attr]
