---
title: 'Story 5.5: Establish the Release Validation Checklist'
type: 'feature'
created: '2026-08-24'
status: 'done'
baseline_revision: '35c1a39e4b9063af272fdb5e980a31ee13b1b92e'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/deferred-work.md'
warnings: ['multiple-goals', 'oversized']
---

<intent-contract>

## Intent

**Problem:** `record-preprod-candidate.yml` already demands a `pass|fail` verdict and a free-text note before it writes `preprod-<sha>` — the tag Story 6.5 will read as *validated* — but nothing in the repository defines what that verdict is asserted against. Both existing ledger rows are ad-hoc prose about container health and digests; no file anywhere enumerates a single application-level user flow, so "validated" currently means whatever the operator felt like typing.

**Approach:** Write a versioned checklist of the frontend's critical flows with an explicit pass criterion per item, plus a fixed one-line compression of its result that fits the shipped `validation_note` input unchanged. Add the non-blocking `e2e` placeholder job to the PRE-PROD *caller* rather than the frozen shared callee, and record the real-E2E follow-up as its own Epic 7 story so it cannot be absorbed into this migration.

## Boundaries & Constraints

**Always:**
- The checklist fits `record-preprod-candidate.yml`'s existing inputs. That file is **not edited** — 5.4 shipped it, and `validated`/`validation_note` are its contract (`:201-211`).
- Every checklist item states what is checked **and** what constitutes a pass, in terms a person can execute in a browser without reading code.
- Items that cannot be executed today are marked BLOCKED with the named owner, never silently marked pass. The PRE-PROD Kong's `Access-Control-Allow-Origin` is wrong and owned by `CRM/api-prionex`, so every authenticated browser flow is blocked at source.
- `validation_note` stays a single line with no newline: the workflow prints it into a one-cell Markdown ledger row (`record-preprod-candidate.yml:982`).
- Never claim a check that could not have failed (the project has rejected that vacuity three times).
- `docs/migration-decisions.md` is Russian and needs all four edits (header anchor range `:8`, index row `:52`, body with its own `<a id="d39"></a>` before `:4646`, change-log row under `:4650`). `deferred-work.md`: append at EOF, owners are names or story numbers, never trigger conditions.
- Forgejo API dispatches and PR opening belong to the coordinator; mark those subtasks `PENDING (owner: coordinator)` rather than checking them.

**Block If:**
- The caller-side `e2e` job cannot depend on the `uses:` deploy job (no in-repo precedent exists for a normal job with `needs:` on a `workflow_call` job, and the callee declares no outputs). The only fallback puts the job inside `deploy-stand.yml`, which is read-only and inside Story 4.9's blast radius — invoking its §12 exception is not an unattended decision. HALT with `e2e job placement requires §12 exception`.
- D39 turns out to be taken on an open `story-*` branch (D35 is already held unmerged by Story 4.9). HALT with `decision number collision`.

**Never:**
- Never edit `.forgejo/workflows/deploy-stand.yml`, `deploy-preprod.yml`'s existing `deploy` job body, or `record-preprod-candidate.yml`.
- Never write, run, or scaffold an actual end-to-end test, and never add playwright/cypress/puppeteer to `package.json`. The job is a placeholder; real coverage is the follow-up story's scope.
- Never let the `e2e` job gate the deploy, and never let it fail a run.
- Never execute the checklist and record a candidate as part of this story — that is Story 5.6's rehearsal.
- Never restructure `docs/preprod-candidates.md`'s table or add columns to it.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| All items pass | Every checklist item verified green against a deployed `image_tag` | Verdict `pass`; note `RVC-v1 <tag>: N/N pass — see docs/release-validation-checklist.md`; recorder writes both markers | No error expected |
| One item fails | Any item fails its stated pass criterion | Verdict `fail`; operator dispatches with `validated=fail`; G1 refuses before any registry read, nothing is written, no `preprod-<sha>` exists, so Story 6.5's promotion guard has nothing to match | Refusal is the designed outcome, not an error |
| Item blocked | An item's dependency is unavailable (CORS origin unfixed) | Item recorded BLOCKED with owner in the execution log; it counts as neither pass nor fail and the aggregate verdict cannot be `pass` | Verdict must be `fail` or the candidate is not recorded at all |
| Deploy runs | `deploy-preprod.yml` dispatched | `e2e` job runs after `deploy`, prints its placeholder rationale, exits 0 | Job must not fail; if it errors it must not fail the workflow |
| Deploy fails | `deploy` job red | `e2e` job is skipped and the run is red on the deploy's own failure | No change to existing failure behavior |

</intent-contract>

## Code Map

- `.forgejo/workflows/deploy-preprod.yml:94-113` -- single-job caller (`deploy:` → `uses: ./.forgejo/workflows/deploy-stand.yml`); the `e2e` placeholder is added as a sibling job here
- `.forgejo/workflows/deploy-stand.yml:1907` -- `Poll health status, bounded timeout`, the callee's health check. It is **not** the last gating step: `:1995`, `:2035`, `:2098` and `:2144` still follow it in the same job. No `id:`, and the callee declares no `outputs:`. READ-ONLY
- `.forgejo/workflows/record-preprod-candidate.yml:201-211` -- `validated` (choice `pass`/`fail`) and `validation_note` (required, whitespace-stripped non-empty at `:454-467`); the contract to fit. NOT EDITED
- `.forgejo/workflows/record-preprod-candidate.yml:231-249` -- G1: refuses `fail` before any registry read; this is the mechanism by which a failed item blocks promotion
- `docs/preprod-candidates.md:18-21` -- 6-column append-only ledger, human-written; the note is one table cell
- `docs/release-validation-checklist.md` -- **new**, the story's primary deliverable
- `src/routes/index.tsx:246-732` -- the real route map the flow list is derived from
- `src/pages/auth/LoginPage.tsx:28-54`, `src/stores/authStore.ts:128-346` -- login/2FA/force-login/locked/IP-denied states
- `src/lib/api.ts:5-6` -- absolute `VITE_API_BASE_URL` baked at build; why a wrong hostname builds clean and fails only in a browser
- `docs/migration-decisions.md:8,52,4646,4650` -- D39's four edit sites (Russian)
- `_bmad-output/implementation-artifacts/deferred-work.md` -- EOF append; `:4020-4040` is an existing open item whose owner is a trigger condition naming 5.5
- `_bmad-output/planning-artifacts/epics.md` Epic 7 (`:2822-3008`), `_bmad-output/implementation-artifacts/sprint-status.yaml:1160-1171` -- where the real-E2E follow-up story is added, following Story 3.3's precedent for 7.6

## Tasks & Acceptance

**Execution:**
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- flip `5-5-...` to `in-progress` in its own commit -- the project's status convention, 5.4 Task 1.1's lesson
- [x] `docs/migration-decisions.md` -- confirm D39 free by `git fetch` + grep across every open `story-*` branch, not just `main` -- D35 is held unmerged by Story 4.9; a collision HALTs
- [x] `docs/release-validation-checklist.md` -- create: version `RVC-v1`; a numbered item per critical flow, each with *what is checked* and *what constitutes a pass*; a BLOCKED marker with owner for items the CORS defect prevents; the single-line `validation_note` format; an append-only `## Execution Log` keyed by `image_tag` carrying per-item verdicts; an explicit statement that a failed item blocks promotion and how -- the deliverable
- [x] `docs/release-validation-checklist.md` -- populate the flow list from the real application: login incl. 2FA/force-login/locked/IP-denied, client list → client detail, payment record/cancel/receipt, dialer + call handling, client import and bulk operations, permission gating, messaging/SMS, AI assistant, public `/pay` -- inventing flows would make the checklist unexecutable
- [x] `.forgejo/workflows/deploy-preprod.yml` -- add a sibling `e2e:` job with `needs: deploy`, `runs-on: node-20`, one `run:` step that prints why it exists and exits 0; header comment in house style naming it a placeholder, citing the follow-up story, and stating it never gates -- AC2; caller-side placement avoids the frozen callee
- [x] `.forgejo/workflows/deploy-preprod.yml` -- mechanical gates before any dispatch: `yaml.safe_load` parses; no `${{ }}` in any `run:` body; `set -euo pipefail` first line; no backslash-continued assignment -- the repo's standing YAML traps
- [x] `_bmad-output/planning-artifacts/epics.md` -- add the real-E2E follow-up as a new Epic 7 story with Given/When/Then ACs -- AC3 demands a recorded, non-absorbed follow-up; a story rather than a deferred line, per the reasoning recorded for 7.6
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- register the new Epic 7 story as `backlog` with a comment block naming this story as its origin -- so it is discoverable where sprint work is read
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- append at EOF: a pointer to the new story, and a re-owner of the `:4020-4040` M7 item from its trigger-condition owner to a story number -- the file's own owner convention
- [x] `docs/migration-decisions.md` -- write D39 (Russian) recording what "validated" is asserted against, the caller-side placement of the placeholder and why, and the disclosure that no browser-path item is executable until the CORS origin is fixed; all four edits -- the project's decision-record convention
- [ ] `.forgejo/workflows/deploy-preprod.yml` -- `PENDING (owner: coordinator)`: dispatch once and confirm the `e2e` job ran after `deploy` and did not gate it; if the platform rejects `needs:` on the `uses:` job, HALT per Block If -- the dev agent does not touch the Forgejo API

**Acceptance Criteria:**
- Given the project has no end-to-end tests and only vitest, when the validation approach is defined, then `docs/release-validation-checklist.md` exists with a numbered item per critical flow, and each item states both what is checked and what constitutes a pass.
- Given the deploy workflow, when the `e2e` placeholder job is added after the health check, then it exists, runs after the deploy job, cannot fail the run, and its purpose and the intent to replace it with real tests are documented in the workflow file itself.
- Given automated end-to-end coverage is out of scope here, when the story closes, then a separate follow-up story for real E2E tests exists in both `epics.md` and `sprint-status.yaml` with its own ACs, and is referenced from `deferred-work.md`.
- Given a candidate has been deployed, when the checklist is executed, then its outcome is recorded against that specific `image_tag` in the checklist's execution log and compressed into a single-line `validation_note` that the shipped recorder accepts unchanged.
- Given any checklist item fails, when the operator records the candidate, then the verdict is `fail`, `record-preprod-candidate.yml`'s G1 refuses before any registry write, and no `preprod-<sha>` exists for that commit — so promotion to PROD has nothing to match.
- Given the PRE-PROD Kong's CORS origin is still wrong, when the checklist is published, then every item depending on a browser-issued API call is marked BLOCKED with `CRM/api-prionex` named as owner, and no such item can be reported as passed.

## Spec Change Log

## Review Triage Log

### 2026-08-24 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 32: (high 1, medium 17, low 14)
- defer: 2: (high 0, medium 2, low 0)
- reject: 2: (high 0, medium 0, low 2)
- addressed_findings:
  - `[high]` `[patch]` F2's build-timestamp criterion was both unexecutable and unfalsifiable — `vite.config.ts:7-8` substitutes `VITE_BUILD_TS` away via `define`, so the identifier has 0 hits in a correct bundle (measured). Replaced with a decodable 13-digit epoch that must be at or after the candidate's build time.
  - `[medium]` `[patch]` The placement rationale asserted the health check was the callee's last gating step, in three shipped places plus this spec. False — `deploy-stand.yml:1995/2035/2098/2144` follow it. Corrected everywhere to a superset argument; the conclusion and the derived code are unchanged.
  - `[medium]` `[patch]` `continue-on-error: true` re-introduced a construct `dev-reset.yml:450-462` (code review H4) removed as unmeasured and `ci.yml:190-191` records as deliberately unused on Forgejo — at job level, which is less proven than the step level removed. Kept, but now cited, named UNMEASURED, and added as a second observation for the confirming dispatch.
  - `[medium]` `[patch]` `runs-on: node-20` made a PRE-PROD deploy depend on the shared CI runner; with `needs: deploy` and `cancel-in-progress: false` a queued placeholder holds the PRE-PROD concurrency group and blocks the next dispatch. Moved to `deploy-dev-preprod`, the runner the run already requires.
  - `[medium]` `[patch]` F2 named `localhost:8005` as the dialer's fallback; it is `localhost:8000` (`useDialerSocket.ts:9`). Both strings now required absent, with a negative-control build recorded as evidence.
  - `[medium]` `[patch]` An empty-string `VITE_WS_URL` passes the `!== undefined` guard, so the bundle looks clean while no socket connects. Criterion now requires the literal expected value.
  - `[medium]` `[patch]` F9 claimed every dashboard route is permission-wrapped; `/dashboard/profile` (`src/routes/index.tsx:277-279`) is not. Corrected and named, so the item cannot produce a false `fail`.
  - `[medium]` `[patch]` F9's blockage was attributed wholly to Kong's CORS origin, hiding a second dependency — no restricted-role account is known to exist on PRE-PROD. Split into two owners; fixing CORS alone does not unblock F9.
  - `[medium]` `[patch]` F12 claimed its executable half needs no call to our API; `easypayApi.ts:17,30` builds from `API_BASE_URL`, so validate is CORS-blocked too. Reclassified as render-only.
  - `[medium]` `[patch]` F3 and F12 were counted as whole passes while having no legal verdict value. Added `pass (degraded)` and a `<D>` clause so the note stops overstating coverage.
  - `[medium]` `[patch]` The note format's failing example accounted for 11 of 12 items and had no combined fail+blocked form — the only shape possible until CORS is fixed, i.e. the first one Story 5.6 will write. Fixed, with the invariant `P + D + F + B == 12` stated and the cause/owner parameterized.
  - `[medium]` `[patch]` Nothing rejects a `|` or a newline in `validation_note` (`record-preprod-candidate.yml:454-467` checks only for blankness) though `:982` pastes it into a Markdown table cell. Both rules stated as conventions, and named as unenforced.
  - `[medium]` `[patch]` "What this checklist does NOT cover" omitted its largest gap: ~60 dashboard routes exist, F1-F12 touch about a dozen. Untouched areas now enumerated.
  - `[medium]` `[patch]` Both preconditions were unfalsifiable — P2 had no observable build identifier, P1 delegated to guards that run at record time and never run at all on a `fail`. P2 folded into the epoch procedure; P1 now executed by hand.
  - `[medium]` `[patch]` `docs/preprod-candidates.md` had no pointer back to the checklist, so its two `pass` rows carried no signal that a criterion now exists under which neither qualifies. One prose paragraph added; no row or column touched.
  - `[medium]` `[patch]` Story 7.7's "five consecutive green runs" was unpriced against this project's run ledger and unreachable, since the placeholder is the only e2e slot. Trial-run location and a mandatory ledger declaration added, plus an AC for the missing path from suite output to `validation_note`.
  - `[low]` `[patch]` Fourteen further corrections: stale line citations replaced with search strings in D39 §7 and in `deferred-work.md`'s owner-precedent claim (the three cited precedents were not that class; the exact match went uncited), "229 component tests" → "229 component test files" in two places, D39 §2's six-vs-five enumeration, F1's CORS-error exemption, Execution Log keyed by tag *and* date, the RVC version-bump policy for executability changes, the operator-phone authority, the `<B>`-clause drop literal, a `$GITHUB_STEP_SUMMARY` mirror for a job whose logs frequently never archive, and the `sprint-status.yaml` HALT-status mapping.

## Design Notes

The `e2e` job goes in `deploy-preprod.yml`, not `deploy-stand.yml`. The callee is shared with DEV, is declared read-only by its own caller (`deploy-preprod.yml:10-21`), and sits inside Story 4.9's blast radius (`:32`); its §12 exception is a procedure, not a permission. "After the health check" is still satisfied, and by a superset: `needs: deploy` runs after the **entire** terminal `deploy` job, so it lands strictly after the health check `:1907` *and* after the four assertions that still follow it (`:1995` anchored identity, `:2035` fallback HTTP, `:2098` digest match, `:2144` Kong alias guard). The corollary a later reader needs: no caller-side job can occupy a position *between* the health check and those four — reaching one would require editing the read-only callee under its §12 exception. `ci.yml:498-502` proves a caller may mix a `uses:` job with ordinary jobs; the untested half is a normal job depending on a `uses:` job, which is why the live dispatch is a task and its failure is a Block If.

Shape of the note the checklist must produce (one line, no newline):

```
RVC-v1 sha-28f7fd36b75e-preprod: 6/9 pass, 3 BLOCKED (CORS, CRM/api-prionex) — detail in docs/release-validation-checklist.md
```

A `fail` needs no new machinery: G1 already refuses it before any registry read, so "a failed item blocks promotion" is a property of what is already shipped. The checklist's job is to make the verdict *derived* rather than *asserted* — state that explicitly rather than adding a gate.


---

**Implementation notes appended by the dev-auto run, 2026-08-24 (baseline `35c1a39e`).**

**D39 number check, actually performed.** `git fetch --all`, then `git grep -n -iE 'id="d39"|## D39\.|#d39' <ref> -- docs/migration-decisions.md` over **every** ref in the repository (all local branches and all `refs/remotes/origin/*`), not only `story-*`. Zero hits. Maxima observed: `origin/main` and the working tree stop at `d38`; `story-4-9/pr-1-context` holds `d35`; `story-7-6/pr-1-add-story` stops at `d19`. Local `refs/heads/main` is stale at `62e2ff8d` and stops at `d27` — noted so a later reader does not treat it as evidence. **No collision; D39 taken.**

**`RVC-v1` is twelve flow items plus two preconditions.** F1 shell over TLS, F2 bundle carries the PRE-PROD env values, F3 unauthenticated route guard, F4 login and its six refusal paths, F5 client list → detail, F6 payments, F7 telephony, F8 import + bulk ops, F9 permission gating, F10 messaging/SMS, F11 AI assistant, F12 public `/pay`. P1 (stand serves this digest and is healthy) is asserted by the recorder's own G4/G5, so it is listed rather than executed twice; P2 (you are not looking at a cached bundle) is a condition on the validator. `N` in the note format is **12** — preconditions are not counted, and the checklist says so explicitly.

Today's executability split: `EXECUTABLE` F1, F2; `EXECUTABLE, degraded` F3, F12; `BLOCKED — owner: CRM/api-prionex, CORS origin` F4-F11 (eight). So the concrete note today is `RVC-v1 <tag>: 4/12 pass, 8 BLOCKED (CORS, CRM/api-prionex) — detail in docs/release-validation-checklist.md`, and it accompanies `validated=fail`, not `pass`.

**F2 is the item worth having.** It needs no API call at all, so the CORS defect does not reach it, and it is the only check anywhere in the pipeline that can catch a wrong baked-in URL: `src/lib/api.ts:4-7` resolves an absolute `VITE_API_BASE_URL` into the bundle, so a wrong hostname builds green, deploys green and passes the container health check. Its pass criterion includes the absence of the `http://localhost:8005` `VITE_WS_URL` fallback, which is falsifiable by construction.

🔴 **A collision this story found and did NOT settle.** `RVC-v1` says an aggregate `pass` requires every item to be `pass` and that `BLOCKED` is not a `pass`; eight items are `BLOCKED`; therefore the only honest aggregate verdict today is `fail`; and G1 refuses `fail` before any registry read, writing nothing. **Story 5.6 is required to record a candidate.** Both requirements are shipped and both are correct, and they are not simultaneously satisfiable while the CORS origin is wrong. Two exits: the CORS fix lands first, or 5.6 records under an explicitly documented, explicitly time-boxed waiver naming `RVC-v1` and listing the waived items. Silently typing `pass` is ruled out by the checklist and by D39 §6. **Owner: Oleg** — it is a scope decision, not an implementation one. Filed in `deferred-work.md` at EOF, in D39 §6, and in the checklist itself.

`docs/preprod-candidates.md`'s two existing rows say `pass` and would not under `RVC-v1`. They are **not** rewritten (append-only ledger; rows are never reinterpreted), and no column and no row was added by this story. `RVC-v1` governs candidates recorded from its publication onward and says so in its own text.

**The `e2e` job.** `deploy-preprod.yml` gained a header section and a sibling `e2e:` job — 72 added lines, **zero removed lines** (`git diff` shows no `-` line): the existing `deploy:` job body is byte-identical. `needs: deploy`, `runs-on: node-20`, `timeout-minutes: 5`, `continue-on-error: true`, one `run:` step of nothing but `echo`. `node-20` and not `deploy-dev-preprod` deliberately: the job has nothing to do on the stand, and the deploy runner is capacity-1 (D30/D32), so parking a no-op there would serialize it against real deploys for no benefit.

**Task 11 is `PENDING (owner: coordinator)` and was not attempted.** The dev agent did not touch the Forgejo API, dispatch anything, or SSH anywhere. The exact status: *the confirming dispatch of `deploy-preprod.yml` — verifying that `e2e` ran after `deploy` and did not gate it — is `PENDING (owner: coordinator)`; if the instance rejects an ordinary job carrying `needs:` on a `uses:` job, HALT with `e2e job placement requires §12 exception` rather than moving the job into the read-only `deploy-stand.yml`.* Parsing is not scheduling: `yaml.safe_load` succeeding says nothing about whether this instance's scheduler accepts the construct, and D21's failure mode is a rejection **before any job exists**, visible only in `action_run.pre_execution_error_details`. Also filed as an open ⚠️ in `deferred-work.md`.

**Follow-up story is 7.7**, "Replace the E2E Placeholder with Real End-to-End Coverage" — `epics.md` (six Given/When/Then criteria, appended after 7.6) and `sprint-status.yaml` (`7-7-replace-the-e2e-placeholder-with-real-end-to-end-coverage: backlog`, with an eight-line comment naming Story 5.5 as origin and mirroring 7.6's "a deferred line reads as 'someone will notice'" reasoning). One of its criteria requires that removing `continue-on-error: true` happen in the **same** change that installs real tests, so the job that finally proves something is also the job that can fail the run.

**`deferred-work.md`**: the M7 entry's owner was re-phrased in place from a trigger condition to **Story 5.6** (5.6, not 5.5 — 5.5 dispatches that workflow zero times; 5.6's rehearsal runs the whole cycle through the workflows and is the next thing that dispatches the recorder at all). Nothing was struck: this is an owner-phrasing correction, the same class the file records at `:3526`, `:3678`, `:3882`, not a closure. A new `## Deferred from: Story 5.5 (2026-08-24)` section was appended at EOF with four entries.

**Nothing was committed.** The `sprint-status.yaml` status flip is **staged and not committed** (`git add` after the flip, before every other edit), so `git diff --cached` is exactly that one change and `git diff` is everything else. Oleg commits.

## Verification

**Commands:**
- `python3 -c "import yaml,sys; yaml.safe_load(open('.forgejo/workflows/deploy-preprod.yml'))"` -- expected: no output, exit 0
- `python3 - <<'PY'` heredoc: load `deploy-preprod.yml` with `yaml.safe_load`, collect every
  job's `steps[].run` body, and assert none contains the two-character sequence `$` + `{{` and that
  each begins with `set -euo pipefail` -- expected: prints nothing and exits 0
- `grep -c '^' docs/release-validation-checklist.md` -- expected: non-zero, file exists
- `grep -n 'd39' docs/migration-decisions.md` -- expected: hits at the anchor, the index row and the change log
- `npm run lint && npm run typecheck` -- expected: exit 0; no `src/` file is touched, so this only proves nothing regressed

**Manual checks (if no CLI):**
- `.forgejo/workflows/deploy-stand.yml` and `record-preprod-candidate.yml` are unchanged: `git diff --name-only` lists neither.
- `docs/preprod-candidates.md` gains no column and no row from this story.
- Every checklist item can be read by someone who has never seen the codebase and executed in a browser.


**Actual output, dev-auto run 2026-08-24:**

- `python3 -c "import yaml,sys; yaml.safe_load(open('.forgejo/workflows/deploy-preprod.yml'))"` → no output, **exit 0**. Parsed shape: `jobs = ['deploy', 'e2e']`; `e2e.needs = deploy`, `runs-on = node-20`, `continue-on-error = True`, `timeout-minutes = 5`; `deploy.uses = ./.forgejo/workflows/deploy-stand.yml` with its `with:` block intact.
- Run-body gate heredoc → `run bodies checked: 1`, **exit 0**. The one `run:` body in the file contains no `$`+`{{`, begins with `set -euo pipefail`, and has no backslash-continued assignment.
- `grep -c '^' docs/release-validation-checklist.md` → **413** (file exists, non-zero).
- `grep -n 'd39' docs/migration-decisions.md` → hits at **`:8`** (header anchor range widened `#d38` → `#d39`), **`:53`** (index-table row, one physical line), **`:4647`** (`<a id="d39"></a>`), **`:4649`** (`## D39. …`), **`:4658`** (§1's own re-check text), **`:4896`** (change-log row). All four required edit sites present.
- `npm run lint` → **exit 0**. `npm run typecheck` → **exit 0**. No `src/` file was touched, so this proves only that nothing regressed.

**Manual checks:**

- `git diff --name-only HEAD` filtered for `deploy-stand.yml`, `record-preprod-candidate.yml`, `preprod-candidates.md`, `build.yml`, `deploy-dev.yml`, `dev-reset.yml`, `src/`, `package.json` → **no matches.** None of the frozen files changed.
- `git diff .forgejo/workflows/deploy-preprod.yml` → 72 insertions, **0 deletions**; the existing `deploy:` job body is untouched.
- `docs/preprod-candidates.md` gained no column and no row.
- No playwright / cypress / puppeteer / webdriver dependency was added; `package.json` is unmodified.


## Auto Run Result

Status: done. One outstanding item is owned by the coordinator and is named below, not hidden.

### What was implemented

Story 5.5 gives the word "validated" a definition. `record-preprod-candidate.yml` (Story 5.4) already
demanded a `pass|fail` verdict and a free-text note before minting `preprod-<sha>` — the tag Story 6.5
reads as *validated* — but nothing said what that verdict was asserted against. This run wrote the
checklist that supplies it, added the non-blocking `e2e` placeholder to the PRE-PROD **caller** rather
than the frozen shared callee, and recorded real end-to-end coverage as its own story so it could not
be absorbed into the migration. No shipped workflow was edited; the recorder's input contract was
fitted, not changed.

### Files changed

- `docs/release-validation-checklist.md` — **new.** `RVC-v1`: preconditions P1/P2 and twelve flow items
  F1-F12 derived from the real route map, each with what is checked, what constitutes a pass, and its
  executability today; the single-line `validation_note` format with the invariant `P + D + F + B == 12`;
  an append-only Execution Log keyed by tag and date; an explicit statement of what it does not cover.
- `.forgejo/workflows/deploy-preprod.yml` — +151 lines, **0 removed**; the `deploy:` job is byte-identical.
  A sibling `e2e:` placeholder job (`needs: deploy`, `runs-on: deploy-dev-preprod`, `continue-on-error: true`,
  echo-only, mirrored to `$GITHUB_STEP_SUMMARY`) plus a header section on why the caller and what is unproven.
- `docs/migration-decisions.md` — D39 (Russian), all four required edits, including a section recording the
  measured bundle facts.
- `_bmad-output/planning-artifacts/epics.md` — Story 7.7, "Replace the E2E Placeholder with Real
  End-to-End Coverage", with its own Given/When/Then criteria, a trial-run location and a mandatory
  run-ledger declaration.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — 5.5 flipped to `in-progress`; Story 7.7
  registered `backlog` with an origin comment; the HALT-status mapping stated.
- `_bmad-output/implementation-artifacts/deferred-work.md` — M7's owner moved off a trigger condition onto
  a story number, with a re-owner rule; a new EOF section for this story.
- `docs/preprod-candidates.md` — one prose paragraph pointing at the checklist. No table row or column touched.
- `_bmad-output/implementation-artifacts/epic-5-context.md` — **new**, compiled planning context for Epic 5.

### Review findings

Two adversarial reviews ran in parallel. Deduplicated and triaged: **intent_gap 0, bad_spec 0, patch 32
(1 high, 17 medium, 14 low), defer 2, reject 2.** All 32 patches were applied — see the Review Triage Log.
Nothing was routed to `bad_spec` because no finding changed the derived artifact: the `e2e` job's placement
was correct and would have been re-derived identically; what was wrong was the *rationale* recorded for it,
in three shipped documents and in this spec. That is a textual repair, not a re-derivation.

Two findings were deferred to `deferred-work.md` as pre-existing: `/dashboard/profile` is the only dashboard
route rendered without a `PermissionRoute` wrapper, and job-level `continue-on-error` has never been measured
on this Forgejo instance.

### Verification performed

- `yaml.safe_load` parses `deploy-preprod.yml`; jobs `['deploy','e2e']`; no `${{ }}` in any `run:` body;
  every body starts with `set -euo pipefail`; no backslash-continued assignment.
- `git diff --numstat` on `deploy-preprod.yml` → `151 0`. Zero removed lines, so the `deploy:` job is
  provably untouched. Same check on `docs/preprod-candidates.md` → `11 0`, no `|`-prefixed line in the diff.
- Every frozen file confirmed absent from `git diff --name-only`: `deploy-stand.yml`,
  `record-preprod-candidate.yml`, `build.yml`, `deploy-dev.yml`, `dev-reset.yml`, `ci.yml`, `src/`, `package.json`.
- `npm run lint` and `npm run typecheck` → exit 0.
- **Measured, not assumed:** the application was built twice with `npx vite build` (vite 6.4.2, node 22.23.1).
  With the PRE-PROD values set, `localhost:8000`, `localhost:8005`, `VITE_BUILD_TS` and `import.meta.env` all
  appear in **0** files and the PRE-PROD API host in **3**. In the negative control, with `VITE_WS_URL` unset,
  `localhost:8000` appears in 1 file and `localhost:8005` in 2. F2 is therefore a discriminator that was
  proven able to fail, not one asserted to work.
- D39's number re-checked with `git fetch --all` and a grep across every ref, not only `story-*`: no collision
  (D35 remains held by the unmerged `story-4-9/pr-1-context`).

### Residual risks

1. 🔴 **The confirming dispatch is not done, and it is the coordinator's.** Nothing in this repository has ever
   run an ordinary job carrying `needs:` on a `workflow_call` job; `ci.yml:498-502` proves only the opposite
   direction. `yaml.safe_load` parsing is not scheduling. If the instance rejects it, Story 5.5 HALTs with
   `e2e job placement requires §12 exception` rather than moving the job into the read-only callee. The same
   dispatch must also observe whether job-level `continue-on-error` is honoured here.
2. 🔴 **`RVC-v1` and Story 5.6 are not simultaneously satisfiable while the CORS origin is wrong.** Eight of
   twelve items are BLOCKED on the PRE-PROD Kong's `Access-Control-Allow-Origin`, owned by `CRM/api-prionex`.
   Under `RVC-v1` the only honest aggregate verdict today is `fail`, and G1 refuses `fail` before any registry
   read — yet 5.6's rehearsal is required to record a candidate. Both requirements are correct. The two exits
   are the CORS fix landing first, or 5.6 recording under a documented, time-boxed waiver naming `RVC-v1` and
   listing the waived items. **Owner: Oleg** — a scope decision, not an implementation one.
3. `docs/preprod-candidates.md`'s two existing `pass` rows would not qualify under `RVC-v1`. They are
   deliberately not rewritten; the mismatch is now recorded in both files so a later reader does not read it
   as an undetected defect.
4. `sprint-status.yaml` is left at `in-progress`, not `review`. Flipping it would misrepresent readiness while
   the confirming dispatch is outstanding.
