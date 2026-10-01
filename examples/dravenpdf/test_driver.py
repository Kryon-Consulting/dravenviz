"""Unit tests for the driver's negative-check logic (no Chromium, no server).

    uv run --project examples/dravenpdf python -m unittest discover -s examples/dravenpdf -p 'test_*.py'

`pnpm test:pdf` runs them before the real render.
"""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest import mock

import client
import library_fallback
import negative
import run_pdf_check as driver
import support

PDF = b"%PDF-1.7 fake"


def rejected(status: int, code: str) -> client.RenderRejected:
    return client.RenderRejected(status, code, "msg")


def scripted(*steps: object):
    """A render that plays `steps` in order: bytes are returned, exceptions are raised."""
    calls = {"n": 0}

    def render() -> bytes:
        step = steps[min(calls["n"], len(steps) - 1)]
        calls["n"] += 1
        if isinstance(step, Exception):
            raise step
        return step  # type: ignore[return-value]

    render.calls = calls  # type: ignore[attr-defined]
    return render


class ExpectRejection(unittest.TestCase):
    def test_pdf_on_first_attempt_fails_without_retry(self) -> None:
        render = scripted(PDF, rejected(504, "render_timeout"))
        out = negative.expect_rejection(render, "render_timeout", 504)
        self.assertFalse(out.ok)
        self.assertEqual((out.attempts, render.calls["n"]), (1, 1))

    def test_pdf_on_retry_fails(self) -> None:
        render = scripted(rejected(422, "render_failed"), PDF)
        out = negative.expect_rejection(render, "render_timeout", 504)
        self.assertFalse(out.ok)
        self.assertEqual(out.attempts, 2)
        self.assertIn("PDF was returned", out.detail)

    def test_expected_code_first_try_passes_with_one_attempt(self) -> None:
        render = scripted(rejected(504, "render_timeout"))
        out = negative.expect_rejection(render, "render_timeout", 504)
        self.assertEqual((out.ok, out.attempts, render.calls["n"]), (True, 1, 1))

    def test_a_different_code_is_retried_once_then_passes(self) -> None:
        render = scripted(rejected(500, "internal"), rejected(504, "render_timeout"))
        out = negative.expect_rejection(render, "render_timeout", 504)
        self.assertEqual((out.ok, out.attempts), (True, 2))

    def test_a_different_code_twice_fails_after_two_attempts(self) -> None:
        render = scripted(rejected(500, "internal"))
        out = negative.expect_rejection(render, "render_timeout", 504)
        self.assertEqual((out.ok, out.attempts, render.calls["n"]), (False, 2, 2))

    def test_status_must_match_when_given(self) -> None:
        out = negative.expect_rejection(scripted(rejected(422, "render_timeout")), "render_timeout", 504)
        self.assertFalse(out.ok)

    def test_a_non_rejection_error_fails_without_retry(self) -> None:
        render = scripted(RuntimeError("boom"), rejected(504, "render_timeout"))
        out = negative.expect_rejection(render, "render_timeout", 504)
        self.assertEqual((out.ok, out.attempts, render.calls["n"]), (False, 1, 1))


class ExpectSuccess(unittest.TestCase):
    def test_retries_once_on_504_only(self) -> None:
        data, attempts, _ = negative.expect_success(scripted(rejected(504, "render_timeout"), PDF))
        self.assertEqual((data, attempts), (PDF, 2))
        data, attempts, _ = negative.expect_success(scripted(rejected(422, "render_incomplete"), PDF))
        self.assertEqual((data, attempts), (None, 1))


def fake_library(bundle: Path, options: dict, chromium: Path | None = None) -> bytes:
    """Stands in for DravenPDF's Python API: a missing font times out, a missing stylesheet is
    incomplete, an intact bundle renders."""
    if not (bundle / driver.MISSING_FONT).exists():
        raise client.RenderRejected(504, "render_timeout", "RenderTimeoutError: no ready flag")
    if not (bundle / "dravenviz.css").exists():
        raise client.RenderRejected(422, "render_incomplete", "IncompleteRenderError: 404")
    return PDF


class LibraryFallback(unittest.TestCase):
    """Forced ServerStartError: the negative checks still run (through the library API)."""

    def run_fallback(self, library) -> driver.Run:
        run = driver.Run()
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp)
            bundle = work / "bundle"
            (bundle / "fonts").mkdir(parents=True)
            for name in ("index.html", "dravenviz.css", driver.MISSING_FONT):
                (bundle / name).write_bytes(b"x")
            start_error = support.ServerStartError("forced")
            with (
                mock.patch.object(support, "dravenpdf_server", side_effect=start_error),
                mock.patch.object(library_fallback, "render_bundle_library_checked", library),
                mock.patch.object(driver, "run_browser_failure", lambda run, broken: run.add("browser failure", True)),
            ):
                data, path_used, attempts = driver.render_report(run, Path("/chromium"), bundle, work)
        self.assertEqual((data, path_used, attempts), (PDF, "library", 1))
        return run

    def test_negative_checks_run_through_the_library_api(self) -> None:
        run = self.run_fallback(fake_library)
        names = " | ".join(c.name for c in run.checks)
        self.assertIn("RenderTimeoutError", names)
        self.assertIn("IncompleteRenderError", names)
        self.assertEqual([c.status for c in run.checks], ["pass"] * len(run.checks))
        self.assertTrue(all(c.attempts == 1 for c in run.checks if "browser" not in c.name))

    def test_a_library_that_returns_a_pdf_for_a_broken_bundle_fails(self) -> None:
        run = self.run_fallback(lambda bundle, options, chromium=None: PDF)
        failed = [c.name for c in run.checks if c.status == "fail"]
        self.assertEqual(len(failed), 2)  # missing font and missing stylesheet
        self.assertTrue(any("missing font" in n for n in failed))
        self.assertTrue(any("missing stylesheet" in n for n in failed))


if __name__ == "__main__":
    unittest.main()
