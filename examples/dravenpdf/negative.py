"""Expected-rejection and control renders for the negative checks, with the retry rule.

A render can stall in a sandboxed Chromium (HTTP 504 after the whole budget) for reasons that have
nothing to do with the bundle. The rule that keeps a real failure from turning into a pass:

* if a render returns bytes on ANY attempt, the check fails at once (no retry);
* otherwise at most one retry, and only when the attempt failed with an error code other than the
  expected one;
* the attempt count is always recorded.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

import client

Render = Callable[[], bytes]


@dataclass
class Outcome:
    ok: bool
    attempts: int
    detail: str


def expect_rejection(render: Render, expected_code: str, expected_status: int | None = None) -> Outcome:
    """`render()` must raise `client.RenderRejected` with `expected_code` (and status, if given)."""
    detail = ""
    for attempt in (1, 2):
        try:
            data = render()
        except client.RenderRejected as exc:
            detail = f"HTTP {exc.status} {exc.code}: {exc.message[:120]}"
            if exc.code == expected_code and (expected_status is None or exc.status == expected_status):
                return Outcome(True, attempt, detail)
            # a different error code: allow exactly one more try
            continue
        except Exception as exc:  # noqa: BLE001
            return Outcome(False, attempt, f"{type(exc).__name__}: {exc}")
        return Outcome(False, attempt, f"a PDF was returned ({len(data)} bytes)")
    return Outcome(False, 2, f"{detail} (expected {expected_code}; second attempt too)")


def expect_success(render: Render, retry_status: int = 504) -> tuple[bytes | None, int, str]:
    """`render()` must return bytes; one retry on `retry_status` only. Returns (bytes, attempts, detail)."""
    detail = ""
    for attempt in (1, 2):
        try:
            return render(), attempt, ""
        except client.RenderRejected as exc:
            detail = str(exc)
            if exc.status != retry_status:
                return None, attempt, detail
        except Exception as exc:  # noqa: BLE001
            return None, attempt, f"{type(exc).__name__}: {exc}"
    return None, 2, f"{detail} (second attempt too)"
