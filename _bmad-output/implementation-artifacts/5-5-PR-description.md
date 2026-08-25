# Story 5.5: Establish the Release Validation Checklist

Story 5.4 shipped a recorder that demands a `pass|fail` verdict and a note before it mints
`preprod-<sha>` — the tag Story 6.5 reads as *validated*. Nothing in the repository said what that
verdict was asserted against. Both existing ledger rows are ad-hoc prose about container health and
digests. This PR gives the word a definition, and the definition is deliberately uncomfortable: it
says out loud that no candidate can honestly pass today.

## `RVC-v1` — the checklist

`docs/release-validation-checklist.md`, new. Two preconditions and twelve numbered flow items
derived from the real route map (`src/routes/index.tsx`), the auth store and the API client — not
from imagination. Each item carries three things: what is checked, what constitutes a pass, and
whether it is executable today. Four legal verdicts, because three were not enough: `pass`,
`pass (degraded)`, `fail`, `BLOCKED`.

The note that reaches the recorder is one line in a fixed format with the invariant
**`P + D + F + B == 12`**, so any ledger row can be checked by addition:

```
RVC-v1 <image_tag>: <P>/12 pass, <D> degraded, <F> fail (<ids>), <B> BLOCKED (<cause>, <owner>) — detail in docs/release-validation-checklist.md
```

The recorder's input contract was **fitted, not changed**: `record-preprod-candidate.yml` was never
opened. The note is one line because `:982` prints it into a single Markdown table cell — and
because nothing there rejects a newline or a `|`, which the checklist now states as an unenforced
convention rather than pretending it is a guard.

## The `e2e` placeholder went into the CALLER

`+151 lines, 0 removed` in `deploy-preprod.yml`. The `deploy:` job is byte-identical and
`deploy-stand.yml` was never opened — no §12 exception was requested or needed.

The epic asks for the job "after the health check". `needs: deploy` places it after the **entire**
terminal job, which is a superset. 🔴 **A correction worth carrying forward:** the health check
(`deploy-stand.yml:1907`) is **not** the callee's last gating step — `:1995`, `:2035`, `:2098` and
`:2144` still follow it. The first draft of this story asserted otherwise in three separate
documents; the review caught it. The conclusion survived, the premise did not. The consequence a
future reader needs: **no caller-side job can occupy a position between the health check and those
four** without editing the read-only callee.

`runs-on: deploy-dev-preprod`, not `node-20`: with `needs: deploy` and `cancel-in-progress: false`,
a placeholder queued behind a saturated shared CI runner would hold the PRE-PROD concurrency group
and block the next dispatch — including a hotfix — on a job that asserts nothing. `timeout-minutes`
bounds execution, not queue wait.

`continue-on-error: true` is carried with its history attached: `dev-reset.yml:450-462` removed this
construct as an unmeasured platform assumption, and `ci.yml:190-191` records it as deliberately
unused on Forgejo. It is kept here, named UNMEASURED at job level, over a body that cannot fail on
its own.

## Measured, not assumed

The bundle was built twice, and the measurement changed the artifact rather than decorating it.

| | `localhost:8000` | `localhost:8005` | `VITE_BUILD_TS` | PRE-PROD API host |
|---|---|---|---|---|
| PRE-PROD values set | 0 files | 0 files | 0 files | 3 files |
| `VITE_WS_URL` unset (negative control) | **1 file** | **2 files** | — | — |

Two things fell out. F2 is a discriminator **proven able to fail**, not one asserted to work. And
the original F2 criterion 4 was deleted: it told the validator to search the bundle for the
identifier `VITE_BUILD_TS`, which `vite.config.ts:7-8` substitutes away — zero hits on a *correct*
bundle. It could neither be executed nor fail. It is now a decodable 13-digit epoch that must be at
or after the candidate's build.

## Review

Two adversarial passes. **32 patches applied (1 high, 17 medium, 14 low), 2 deferred, 0 intent gaps,
0 spec loopbacks.** Beyond the premise above: F9 claimed every dashboard route is permission-wrapped
(`/dashboard/profile` is not); F12 claimed its executable half needs no API call (`easypayApi.ts:17,30`
builds from `API_BASE_URL`); the note's failing example accounted for 11 of 12 items; F3 and F12 were
counted as whole passes while having no legal verdict value.

## 🔴 One dispatch is required BEFORE merge

Nothing in this repository has ever run an ordinary job carrying `needs:` on a `workflow_call` job.
`ci.yml:498-502` proves only the opposite direction. `yaml.safe_load` parsing is not scheduling, and
D21's failure mode is a workflow this instance refuses **before any job exists**, visible only in
`action_run.pre_execution_error_details`.

- **Workflow:** `deploy-preprod.yml`, **ref:** `story-5-5/pr-1-context` (non-default-branch dispatch
  is already proven, run 917).
- **`image_tag`:** `sha-28f7fd36b75e-preprod` — the candidate `preprod-current` already points at,
  so this is a redeploy of the image the stand is already serving. `simulate_bad_credential=false`,
  `hold_lock_seconds=0`.
- **Observe two things, not one:** (1) `e2e` ran after `deploy` and did not gate the run;
  (2) whether job-level `continue-on-error` is honoured on this instance.
- **If the instance rejects it:** HALT with `e2e job placement requires §12 exception`. Do **not**
  move the job into `deploy-stand.yml` — that decision is not an unattended one.

Ledger: this is 1 dispatch plus the CI-push rows for this branch.

## Two open items, named rather than hidden

1. 🔴 **`RVC-v1` and Story 5.6 are not simultaneously satisfiable while the CORS origin is wrong.**
   Eight of twelve items are `BLOCKED` on PRE-PROD Kong's `Access-Control-Allow-Origin`, owned by
   `CRM/api-prionex`. Under `RVC-v1` the only honest aggregate verdict is `fail`; G1 refuses `fail`
   before any registry read; yet 5.6's rehearsal must record a candidate. Both requirements are
   shipped and both are correct. Two exits: the CORS fix lands first, or 5.6 records under a
   documented, time-boxed waiver naming `RVC-v1` and listing the waived items. Silently typing
   `pass` is ruled out by the checklist and by D39. **Owner: Oleg** — scope, not implementation.
   Re-measured `2026-08-25T08:09:43Z` on **routed** endpoints (`OPTIONS /api/v1/auth/login` → `200`):
   still `http://localhost:8320`, with two negative controls. Unchanged.
2. **F9 has a second blocker that is not CORS.** It needs an account with a restricted role, and
   there is no evidence one exists on PRE-PROD. Fixing CORS alone yields 11 of 12, not 12.
   **Owner: Oleg.**

## Bookkeeping

- **D39** (`docs/migration-decisions.md`, Russian), all four required edits, including a section
  holding the measured bundle facts. Number re-checked across every ref — D35 remains held by the
  unmerged `story-4-9/pr-1-context`.
- **Story 7.7**, "Replace the E2E Placeholder with Real End-to-End Coverage", added to `epics.md`
  and `sprint-status.yaml`. No follow-up for real E2E existed anywhere in the repository — the
  epic's own AC required one and nothing satisfied it. It carries a trial-run location and a
  mandatory run-ledger declaration, because "five consecutive green runs" of a dispatch-only
  workflow is otherwise unpriced and unreachable.
- `deferred-work.md`: M7's owner moved off a trigger condition onto a story number; two new deferred
  items (the unguarded `profile` route; job-level `continue-on-error` unmeasured).
- `docs/preprod-candidates.md`: one prose paragraph pointing at the checklist. **No table row or
  column touched** — the two existing `pass` rows would not qualify under `RVC-v1` and are
  deliberately not reinterpreted.

## Blast radius

Touched: `deploy-preprod.yml` (additive only), five documentation/bookkeeping files, two new files.
Confirmed untouched: `deploy-stand.yml`, `record-preprod-candidate.yml`, `build.yml`, `deploy-dev.yml`,
`dev-reset.yml`, `ci.yml`, all of `src/`, `package.json`. The pre-commit hook ran full CI parity on
every commit: `format:check`, `lint --max-warnings=0`, `typecheck`, and **229 test files / 1924
tests**, green each time.

`sprint-status.yaml` is deliberately left at `in-progress`, not `review`: flipping it while the
confirming dispatch is outstanding would misrepresent readiness.
