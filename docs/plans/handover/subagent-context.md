# Shared context for every DravenViz subagent (read after your brief)

Project: DravenViz (`@draven/viz`), a standalone TypeScript chart library. Repo root: /home/user/dravenviz
Branch: claude/bold-curie-c2mkvc (commit here; do NOT push, do NOT change branch; the controller pushes).

Authority order: docs/spec.md (product brief) > docs/design.md (the contract, revision 4) > the slice plan
docs/plans/2026-09-30-slice-1-line-vertical-slice.md. Section references "§n" mean docs/design.md.
Read only the design sections your brief cites (use Grep/Read with offsets) — do not read the whole plan.

## Global Constraints (verbatim from the plan)

- The package is `@draven/viz`, `"private": true`, `"license": "UNLICENSED"`, and must never be published (§1 D13).
- `src/core` has no DOM, no React and no Recharts. `recharts` is imported only under `src/render/recharts`. Public `.d.ts` files mention no Recharts type (§2).
- Recharts `3.10.1` exact; React, ReactDOM and react-is `19.3.0` in development; peers are `^18.3.0 || ^19.0.0` for react, react-dom and react-is, all optional (§3).
- JSON Schema `schema/viz-spec-v1.schema.json` (draft 2020-12) is the source of truth, with `additionalProperties: false` everywhere (§5, D5).
- Null means missing, never zero. Nothing is silently aggregated, sorted, clamped or dropped.
- Dates: date-only strings are calendar days (UTC). Date-times must carry `Z` or an offset. The machine timezone is never read (D15). Percent format means percentage points (D16).
- Default readiness timeout is 10,000 ms. Font loading, dimension checks and layout are all inside that bound (§9).
- Print text sizes at 178 mm printed width: title 12–14 pt, labels at least 9 pt, captions at least 8 pt; `effective_pt = size × 504.57 / viewBoxWidth` (§7).
- Exported SVG contains no `class`, `style` attribute, `foreignObject`, `script`, animation, event attribute or `recharts` string (§10).
- DravenViz-authored code (`src/`, and compiled `dist/core|react|print`) contains no `eval`, `new Function`, `innerHTML` or `dangerouslySetInnerHTML`.
- Default limits: 16 series, 10,000 Cartesian points, 250 bar categories, 32 slices, 2,500 cells, 2 MiB of JSON (§6).
- Consumers get the library only from `.pack/draven-viz-0.1.0.tgz` (§16.1). No workspace members, no source aliases.
- Visual baselines are candidates until the owner approves them in `tests/visual/REVIEW.md` (D4). Never self-approve.
- Missing PDF prerequisites exit with code 3 and print `UNVERIFIED:`, never a pass (§13).

## Environment facts (verified by the controller)

- Node v22.22.0. pnpm on PATH is 10.28.0; the project pins `packageManager: "pnpm@10.33.0"` — use `corepack pnpm` or
  `npx -y pnpm@10.33.0` if the pinned version is enforced. npm registry reachable (outbound via proxy; CA bundle
  /root/.ccr/ca-bundle.crt — never disable TLS verification).
- Chromium revision 1194 preinstalled: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
  (`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`). Do NOT run `playwright install`.
- Python: system 3.11; `uv` 0.8.17 installed and Python 3.12.11 installed via `uv python install 3.12`.
- GitHub reachable: Noto font release zip and `https://github.com/Kryon-Consulting/dravenpdf` (commit 7a249e0) resolve.
- 4 CPUs, 15 GB RAM. Use the scratchpad for temp files:
  /tmp/claude-0/-home-user-dravenviz/75ef0d62-97d4-5a21-a130-622a93c18315/scratchpad
- Commit messages must end with these two lines (after a blank line):
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_018iqW6812dhq4NdckJcaAET
  Never include a model identifier anywhere else in committed content.
