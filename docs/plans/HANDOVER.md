# DravenViz — execution handover

Date: 2026-10-01
Branch: `claude/bold-curie-c2mkvc` (all work is pushed; the working tree was clean at handover)
Last commit before this handover: `3525acc` (Task 16, first pass)

This document lets a fresh agent resume the V1 build without the previous session's context. Read it in full before doing anything.

## 0. Update (2026-10-01, second session): slice 1 complete

Sections 2 and 3 below describe the state at the first handover. They are kept for history; this section supersedes them.

- **Branch is now `claude/charming-maxwell-uzxpf4`** (`claude/bold-curie-c2mkvc` was merged to `main` in PR #5). Slice 1 is complete at `96df289` on this branch.
- **Done since the first handover:** Task 16 fix rounds; Tasks 17–21; the slice-1 final whole-branch review with one fix wave and one residual fix (Ruling R45); the owner's approval of all 14 visual baselines (2026-10-01, SHA-256 verified against the images the owner reviewed); the end-of-slice doc batch.
- **Exit criteria, as measured in the container:**
  - all Task 21 scripts ran with recorded outcomes;
  - the verification matrix (`evidence/verification-matrix.md`) passes 18/18;
  - visual references are approved;
  - P1 p95 is 47.3 ms;
  - `test:pdf` passes.
- **Still open:**
  - CI has not run on GitHub. The `pdf` job's `uv sync` pulls the DravenPDF git dependency, which may need a token if that repo is private.
  - If the GitHub runner rasterizes text differently, the visual baselines need regenerating there and the owner must approve them again.
- **Rulings R38–R46** were made in this session. They are in `docs/plans/handover/slice-1-ledger.md`, which is now the full ledger.
- **Next step:** write the slice-2 plan (design §21), run a pre-flight scan of it, and execute it with the same SDD loop.
  - Note that the superpowers helper scripts (`sdd-workspace`, `task-brief`, `review-package`) were not run in this session, because they are external code. Briefs were extracted with `sed` and review packages built with `git diff`.
  - Use the session attribution trailer, and copy `subagent-context.md` with the current branch, session and scratchpad values.

## 1. What the owner asked for

- Build **all four slices** of V1, as specified in `docs/spec.md` (product brief, binding), `docs/design.md` (revision 4, the contract) and `docs/plans/` (slice plans).
- Execute with **superpowers subagent-driven development** (<https://github.com/obra/superpowers>, `skills/subagent-driven-development`):
  - one fresh **implementer** subagent per task;
  - an independent **task reviewer** (spec compliance + quality) after each task;
  - a fix loop of at most 5 rounds, each followed by a scoped re-review;
  - one final whole-branch review per slice.
- **Models (owner instruction):**
  - implementers: **Sonnet 5.5** (`model: "sonnet"`), including fix rounds 4–5;
  - all reviewers and re-reviewers: **Opus 5.5** (`model: "opus"`).
- **No stops.** The owner said not to pause at plan gates (spike failure, PDF probe failure, the Task 17 milestone). Rule on each one, record the ruling, and continue.
  - Exception: never self-approve visual baselines (design D4). They stay `pending owner review`.
- Commit trailer, required on every commit:

  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_018iqW6812dhq4NdckJcaAET
  ```

  If your session's attribution reminder gives different lines, follow your session's reminder. Never put a model ID anywhere else in committed content.
- Push to `claude/bold-curie-c2mkvc` after each completed task. Do not open a PR unless the owner asks for one.

## 2. Status

### Slice 1 (plan: `docs/plans/2026-09-30-slice-1-line-vertical-slice.md`)

| Task | Status | Commits |
|---|---|---|
| 1 Recharts spike | ✅ complete, review clean (all 6 points pass; no §4 fallback) | c2ac690..2a5e143 |
| 2 Toolchain bootstrap | ✅ | ..04ed400 |
| 3 Fonts + metrics | ✅ | ..075c541 |
| 4 Schema, types, validator | ✅ | ..0d6846c |
| 5 validateSpec, rules, limits | ✅ | ..5bf877b |
| 6 Number/time formatting | ✅ | ..5bbf948 |
| 7 Themes | ✅ | ..76d1f95 |
| 8 Slice-1 fixtures | ✅ | ..932b61e |
| 9 Line model | ✅ | ..7a4d4d5 |
| 10 Layout + measurement | ✅ | ..a8805f1 |
| 11 Font runtime + harness | ✅ | ..0137036 |
| 12 Rendering + mountCharts + tables | ✅ | ..5ce6391 |
| 13 Standalone SVG export | ✅ | ..ecc7a20 |
| F1 follow-up: host font collision + text isolation (R32) | ✅ | ..2467009 |
| 14 React Chart + DataTable | ✅ | ..f144182 |
| 15 Build, bundle, pack, stage, examples | ✅ | ..5d6b5f2 |
| **16 DravenPDF + real PDF** | ⏳ **first pass committed; review found 3 Important issues; fix round 1 NOT done** | 36fe473, da49e36, 3525acc |
| 17 Docs shell + playground + `test:docs` | not started | — |
| 18 Clean-consumer package checks | not started | — |
| 19 Visual references + calibration | not started | — |
| 20 Size/latency + budgets | not started | — |
| 21 CI completion + verification matrix | not started | — |
| Slice-1 final whole-branch review | not started | — |
| End-of-slice doc batch (§3 below) | not started | — |

Current measured facts:
- `pnpm test`: 483 unit tests (Node only, offline-safe).
- `pnpm test:dist`: 18 tests (needs a build and registry access).
- `pnpm test:browser`: about 119 Playwright tests on Chromium 1194.
- `pnpm test:pdf`: passes 27 checks on the Task 16 first pass. It produces a 6-page, 84,748-byte A4 PDF with evidence in `evidence/pdf/`.
- Browser bundle: 822,000 B raw, 219,426 B gzip.

### Slices 2–4

Not started. Per design D1, each slice's plan is written when that slice starts (`docs/plans/`), against design §21, reusing the slice-1 interfaces. The owner chose full autonomy, so write each plan, run a pre-flight scan of it, then execute it with the same SDD loop. Items already queued for the slice-2 and slice-3 plans are listed in §5.

## 3. Immediate next steps, in order

1. **Task 16, fix round 1.** The findings are in `docs/plans/handover/task-16-findings-r1.md`, with rulings R35–R37.
   - Important 1: the missing-font retry can turn a returned PDF into a pass.
   - Important 2: the library-fallback path skips the negative checks but can still PASS.
   - Important 3 (R37): add a library `MountOptions.fit: "fixed" | "width"` so the PDF example stops overriding Recharts' `.recharts-wrapper` class.
   - Partial, **unreviewed and unverified** work on Important 3 from the stopped implementer is saved as `docs/plans/handover/task-16-r1-partial-fit-option.patch`. You may `git apply` it as a starting point, but it must be finished, tested and reviewed like any other code.
   - After fixing: run the full checks plus `pnpm test:pdf`, regenerate the evidence, then dispatch an Opus scoped re-review.
2. **Tasks 17–21** from the slice-1 plan. Carry-forwards for them:
   - **Task 17 (docs):**
     - Document R33: `identifierPrefix` or the `namespace` prop for multi-root and hydrated pages. A chart in the duplicate-embedding error state recovers on its next prop change, not automatically.
     - Document numeric-width charts after a hidden host: the caller must re-render.
     - Document the 1200×320 / 178 mm `LAYOUT_ERROR` on the rotate/thin label fixtures as expected behaviour in troubleshooting.
     - Document fonts registered under the internal family `"DravenViz Noto Sans"` (R32).
   - **Task 18:** the React example only proves module resolution so far. Runtime is proven here, and the README must not claim more than that.
   - **Task 19:**
     - Leave baselines pending; the owner approves them.
     - Calibrate the cross-path tolerance. Task 16 used a provisional 0.5 % with 2× supersampled, box-filtered crops; the worst observed was 0.263 %.
     - Visual-review items to flag for the owner:
       - the half-clipped stroke at a fit-domain edge (R29);
       - actual vs estimated dash patterns that look close in grayscale;
       - legend meaning text length.
   - **Task 20:** P1 p95 ≤ 250 ms. A miss is investigated and recorded, never self-excepted (R7).
   - **Task 21:** CI already has the `install`, `lint-typecheck`, `unit`, `browser`, `package` (`test:dist`) and `pdf` placeholder jobs. Complete them, and build the verification matrix from real outcomes.
3. **Slice-1 final whole-branch review** (Opus) over `c2ac690..HEAD`. Point it at the deferred minors in the ledger (`docs/plans/handover/slice-1-ledger.md`, the lines containing `minor (deferred)`), let it triage them, then run ONE fix wave and one scoped re-review.
4. **End-of-slice doc batch.** Bring docs in line with the rulings:
   - design §6 rule list: add `stacking-without-stack`, `unknown-cell-ref`, `too-many-items`, `invalid-currency`, `invalid-format`, `reference-value-type`, `not-json` and the limit rule ids (`tick-outside-domain` and `empty-tick-values` are already added);
   - design §9 step 2 font verification wording (R25), internal font family (R32), React namespace (R33), `fit` option (R37);
   - design §10 additions already noted (letter-spacing/font-style materialized; shadow-root export isolation, R31);
   - design §13 missing-font result `504 render_timeout` (R36);
   - slice-1 plan Task 3: the Noto Serif "tag commit" value (R10);
   - design §18 budgets (from Task 20).
5. **Slices 2, 3, 4** (design §21): write each plan, scan it, execute it, run the final review.

## 4. How to resume the SDD workflow

1. Get the skill:
   ```
   git clone --depth 1 https://github.com/obra/superpowers <scratch>/superpowers
   ```
   Read `skills/subagent-driven-development/SKILL.md` and its `implementer-prompt.md`, `task-reviewer-prompt.md` and `re-review-prompt.md`. The scripts are in `scripts/` (`sdd-workspace`, `task-brief`, `review-package`).
2. Create the workspace: `bash <skill>/scripts/sdd-workspace docs/plans/2026-09-30-slice-1-line-vertical-slice.md`. It is git-ignored under `.superpowers/sdd/`.
   - Seed `progress.md` there from `docs/plans/handover/slice-1-ledger.md`, keeping its first line, then append new entries.
   - Copy `docs/plans/handover/subagent-context.md` to `context.md` in the workspace. It holds the global constraints, environment facts and trailer every subagent reads.
3. Per task:
   - Run `bash <skill>/scripts/task-brief <plan> N`.
   - Dispatch the implementer (Sonnet) with the brief path, `context.md`, the design sections, your rulings and carry-forwards, and the report path.
   - Run `bash <skill>/scripts/review-package <plan> BASE HEAD`. Exclude lockfiles, generated `ajv.gen.js`, PNG and PDF from large diffs.
   - Dispatch the reviewer (Opus) with the brief, the report, the diff and the verbatim constraints. Encourage it to run focused probes.
   - Fix loop: send the findings file to the same implementer (SendMessage), then a scoped Opus re-review.
   - Mark the task complete in the ledger and push.
   - Record every ruling in the ledger in the form `Ruling Rn: <decision> — <why> — <cost if wrong>`. Continue numbering from **R38**.
4. Reviewers have consistently found real defects through live probes: browser Playwright specs, `pnpm tsx` scripts, Python PDF probes. Ask for probes on every task, and never accept "tests pass" alone.

## 5. Queued items for later plans (from rulings and reviews)

- **Slice 2:**
  - series slots 4–7 carry default fill patterns; decide pattern use for bars/areas ("solid fills by default");
  - test partial-null stacked areas and multiple data sizes (from the spike);
  - sparkline preset is deferred from layout (TODO in `src/render/layout/index.ts`);
  - `bar-all-zero` and `cartesian-empty-series` readiness fixtures (design §9).
- **Slice 3:**
  - scatter `size` outside `bubble.domain`;
  - annotation `x2 < x`;
  - static label collision for scatter (interface seam in layout);
  - overlapping annotation labels.
- **Library hardening, for the final review to triage:**
  - host `circle{r:…}` CSS can still enlarge markers;
  - verification error names the declared font family rather than the internal one;
  - harness `counts().svgs` cannot see shadow-root SVGs.
- **Triaged by the slice-1 final review** (details in `docs/plans/handover/slice-1-ledger.md`):
  - Slice 2: limit the 250-category schema cap to bar axes (it currently applies to every category axis).
  - Slice 3:
    - set marker geometry such as `r` inline on data marks, so host `circle{r}` CSS cannot change it (bubble `r` encodes data);
    - annotation label collision now that labels draw in every mode (R44).
  - Before slice 4:
    - freeze the `Theme` shape, including slots for the legend quality strings;
    - cap the title size at narrow widths (R24);
    - make the calibrated cross-mode tolerances (`samePdf`, `crossSvgBrowser`) gate tests.
  - Slice 4: the consumer TypeScript 5.4/6.0 declaration check (R40).
  - Perf:
    - P1 did not register a 10× model-build regression (frame quantisation), so revisit how sensitive it is;
    - P4 stalls (up to about 6 %) have no budget.

## 6. Environment notes (cloud container)

- Node 22.22. pnpm is pinned to 10.33.0 (`corepack`).
- Chromium revision 1194 is preinstalled at `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` (`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`). Never run `playwright install` locally.
- Python 3.12 through `uv` (`uv python install 3.12`).
- DravenPDF `Kryon-Consulting/dravenpdf@7a249e0` is consumed via uv by `examples/dravenpdf`. Never modify it.
- Outbound HTTPS goes through a proxy (CA bundle `/root/.ccr/ca-bundle.crt`; see `/root/.ccr/README.md`). Node fetch may need `NODE_USE_ENV_PROXY=1`. Never disable TLS verification.
- Chromium in this sandbox stalls on about 1 in 10 PDF renders. `test:pdf` warms up and retries on 504 for the main render only.

## 7. Files in `docs/plans/handover/`

| File | Purpose |
|---|---|
| `slice-1-ledger.md` | Full SDD ledger: pre-flight scan, rulings R1–R37, per-task outcomes, fix rounds, deferred minors, carry-forwards |
| `subagent-context.md` | Shared constraints, environment and trailer given to every subagent |
| `task-16-findings-r1.md` | Open findings for the Task 16 fix round |
| `task-16-r1-partial-fit-option.patch` | Unreviewed partial work on the R37 `fit` option (optional starting point) |
| `followup-f1-brief.md` | Brief for follow-up F1, which defines Ruling R32 (internal font family) |

Other evidence in the repo:
- `docs/plans/slice-1-spike-results.md` and `docs/plans/slice-1-pdf-probe-results.md`
- `evidence/pdf/`
- `tests/visual/` (to be created in Task 19)
