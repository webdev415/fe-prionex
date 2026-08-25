---
title: 'Story 5.5: Establish the Release Validation Checklist'
type: 'feature'
created: '2026-08-24'
status: 'review'  # fix-pass (2026-08-25) addressed all 25 patch findings + 3 decisions from code review pass 2; followup_review_recommended stays true since the 3 decisions are recorded, not re-litigated
baseline_revision: '35c1a39e4b9063af272fdb5e980a31ee13b1b92e'
final_revision: '9338edf1'  # will be updated to this fix-pass's own final content commit below, before push
review_loop_iteration: 2
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
| All items pass | Every checklist item verified green against a deployed `image_tag` | Verdict `pass`; note `RVC-v1 <tag>: 12/12 pass — detail in docs/release-validation-checklist.md` (🔴 corrected, code review of this fix-pass: this row's own placeholder `N/N pass — see …` predates the shipped canonical format — `12` is the fixed item count for `RVC-v1`, never a variable `N`, and the shipped connector is `— detail in`, not `— see`); recorder writes both markers | No error expected |
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
- [x] `.forgejo/workflows/deploy-preprod.yml` -- **Done, run 1281** (coordinator, post-merge — dispatched after PR #83 merged rather than before, a deviation from the plan recorded honestly in D39 §4 and the workflow's own header). `ref=main`, `image_tag=sha-28f7fd36b75e-preprod`. Jobs 10719 "Deploy PRE-PROD via the shared definition" then 10720 "E2E placeholder (runs no test, never gates)" — both SUCCESS. `e2e` ran after `deploy` and did not gate it; the platform accepted `needs:` on the `uses:` job (no HALT, D21's rejection mode did not occur).

**Acceptance Criteria:**
- Given the project has no end-to-end tests and only vitest, when the validation approach is defined, then `docs/release-validation-checklist.md` exists with a numbered item per critical flow, and each item states both what is checked and what constitutes a pass.
- Given the deploy workflow, when the `e2e` placeholder job is added after the health check, then it exists, runs after the deploy job, cannot fail the run, and its purpose and the intent to replace it with real tests are documented in the workflow file itself.
- Given automated end-to-end coverage is out of scope here, when the story closes, then a separate follow-up story for real E2E tests exists in both `epics.md` and `sprint-status.yaml` with its own ACs, and is referenced from `deferred-work.md`.
- Given a candidate has been deployed, when the checklist is executed, then its outcome is recorded against that specific `image_tag` in the checklist's execution log and compressed into a single-line `validation_note` that the shipped recorder accepts unchanged.
- Given any checklist item fails, when the operator records the candidate, then the verdict is `fail`, `record-preprod-candidate.yml`'s G1 refuses before any registry write, and no `preprod-<sha>` exists for that commit — so promotion to PROD has nothing to match.
- Given the PRE-PROD Kong's CORS origin is still wrong, when the checklist is published, then every item depending on a browser-issued API call is marked BLOCKED with `CRM/api-prionex` named as owner, and no such item can be reported as passed.

## Spec Change Log

## Review Triage Log

### 2026-08-25 — Review pass 2 (post-merge, range `35c1a39e..9faceae2`)
- intent_gap: 0
- bad_spec: 0
- patch: 25: (high 3, medium 12, low 10)
- defer: 3: (high 0, medium 1, low 2)
- dismiss: 4
- decision_needed: 3: (high 3)
- **Nothing was patched by this pass.** The story is already merged; the findings are records and
  the fixes belong to a follow-up PR. Full text in `## Review Findings — code review pass 2` at EOF.
- New evidence folded in, unavailable when the story was written: the confirming dispatch was not
  run before the merge (the PR description required it in those words) and was run after, from
  `main` — **run 1281, SUCCESS**, jobs `10719` deploy then `10720` e2e. Caller-side placement is
  **proven**; job-level `continue-on-error` was **not** exercised and cannot be by an echo-only body.
  Every artifact still says `PENDING`/unproven, so the records now underclaim (D4: the query exists,
  the ledger row does not). Nothing overclaims.

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

Shape of the note the checklist must produce (one line, no newline). 🔴 **Corrected, code review of
this fix-pass: `6/9` below is a pre-implementation placeholder that violates the shipped checklist's
own invariant (`P + D + F + B == 12`, not 9) — replaced with the shipped canonical shape:**

```
RVC-v1 sha-28f7fd36b75e-preprod: 2/12 pass, 2 degraded (F3 F12), 8 BLOCKED (F4 F5 F6 F7 F8 F9 F10 F11) (CORS, CRM/api-prionex; restricted-role account, Oleg) — detail in docs/release-validation-checklist.md
```

A `fail` needs no new machinery: G1 already refuses it before any registry read, so "a failed item blocks promotion" is a property of what is already shipped. The checklist's job is to make the verdict *derived* rather than *asserted* — state that explicitly rather than adding a gate.


---

**Implementation notes appended by the dev-auto run, 2026-08-24 (baseline `35c1a39e`).**

**D39 number check, actually performed.** `git fetch --all`, then `git grep -n -iE 'id="d39"|## D39\.|#d39' <ref> -- docs/migration-decisions.md` over **every** ref in the repository (all local branches and all `refs/remotes/origin/*`), not only `story-*`. Zero hits. Maxima observed: `origin/main` and the working tree stop at `d38`; `story-4-9/pr-1-context` holds `d35`; `story-7-6/pr-1-add-story` stops at `d19`. Local `refs/heads/main` is stale at `62e2ff8d` and stops at `d27` — noted so a later reader does not treat it as evidence. **No collision; D39 taken.**

**`RVC-v1` is twelve flow items plus two preconditions.** F1 shell over TLS, F2 bundle carries the PRE-PROD env values, F3 unauthenticated route guard, F4 login and its six refusal paths, F5 client list → detail, F6 payments, F7 telephony, F8 import + bulk ops, F9 permission gating, F10 messaging/SMS, F11 AI assistant, F12 public `/pay`. ~~P1 (stand serves this digest and is healthy) is asserted by the recorder's own G4/G5, so it is listed rather than executed twice~~ 🔴 **Corrected, code review of this fix-pass (2026-08-25): this is the falsified claim P1's own text was written specifically to correct, and this triage-log paragraph never caught up.** The shipped checklist's P1 section says, in its own words, "**Who checks it: you do**", and gives two reasons the G4/G5 delegation is wrong: G4/G5 run at *record* time, after the checklist is already finished, and on a `fail` verdict G1 refuses before G4/G5 ever run at all — so on exactly the runs where something went wrong, the precondition would never be checked by anyone under the delegated reading. P1 is executed BY HAND, at the start of validation. P2 (you are not looking at a cached bundle) is a condition on the validator. `N` in the note format is **12** — preconditions are not counted, and the checklist says so explicitly.

Today's executability split: `EXECUTABLE` F1, F2; `EXECUTABLE, degraded` F3, F12; `BLOCKED — owner: CRM/api-prionex, CORS origin` F4-F11 (eight). ~~So the concrete note today is `RVC-v1 <tag>: 4/12 pass, 8 BLOCKED (CORS, CRM/api-prionex) — detail in docs/release-validation-checklist.md`, and it accompanies `validated=fail`, not `pass`.~~ 🔴 **Corrected, code review of this fix-pass: this triage paragraph's own arithmetic is wrong against the shipped checklist and repeats the exact overstatement the checklist's own review removed.** F3 and F12 are `pass (degraded)`, not `pass` — counting them as whole passes is the overstatement `<D>` exists to prevent. The shipped checklist's own worked example is
`RVC-v1 <tag>: 2/12 pass, 2 degraded (F3 F12), 8 BLOCKED (F4 F5 F6 F7 F8 F9 F10 F11) (CORS, CRM/api-prionex) — detail in docs/release-validation-checklist.md`, and it accompanies `validated=fail`, not `pass`.

**F2 is the item worth having.** It needs no API call at all, so the CORS defect does not reach it, and it is the only check anywhere in the pipeline that can catch a wrong baked-in URL: `src/lib/api.ts:4-7` resolves an absolute `VITE_API_BASE_URL` into the bundle, so a wrong hostname builds green, deploys green and passes the container health check. ~~Its pass criterion includes the absence of the `http://localhost:8005` `VITE_WS_URL` fallback, which is falsifiable by construction.~~ 🔴 **Corrected, code review of this fix-pass: `localhost:8005` is not the `VITE_WS_URL` fallback — it never was.** `src/lib/api.ts:7` and `useDialerSocket.ts:9` both fall back to `localhost:8000`; `localhost:8005` belongs to four *other* hooks (`useCallWebSocket.ts:14`, `useCallStateUpdates.ts:13`, `useIncomingCall.ts:8`, `useNotificationSocket.ts:8`) — this triage paragraph attributed the wrong string to the wrong mechanism, the same misattribution the checklist's own text was rewritten to correct. Both strings are required absent, for different reasons, and the checklist's own F2 criterion 2 states both correctly.

🔴 **A collision this story found and did NOT settle.** `RVC-v1` says an aggregate `pass` requires every item to be `pass` and that `BLOCKED` is not a `pass`; eight items are `BLOCKED`; therefore the only honest aggregate verdict today is `fail`; and G1 refuses `fail` before any registry read, writing nothing. **Story 5.6 is required to record a candidate.** Both requirements are shipped and both are correct, and they are not simultaneously satisfiable while the CORS origin is wrong. Two exits: the CORS fix lands first, or 5.6 records under an explicitly documented, explicitly time-boxed waiver naming `RVC-v1` and listing the waived items. Silently typing `pass` is ruled out by the checklist and by D39 §6. **Owner: Oleg** — it is a scope decision, not an implementation one. Filed in `deferred-work.md` at EOF, in D39 §6, and in the checklist itself.

`docs/preprod-candidates.md`'s two existing rows say `pass` and would not under `RVC-v1`. They are **not** rewritten (append-only ledger; rows are never reinterpreted), and no column and no row was added by this story. `RVC-v1` governs candidates recorded from its publication onward and says so in its own text.

**The `e2e` job.** `deploy-preprod.yml` gained a header section and a sibling `e2e:` job — ~~72 added lines~~ 🔴 **Corrected, code review of this fix-pass: the actual shipped diff is `+151 -0`, not `72 0` — this triage paragraph understated its own diff by half.** **zero removed lines** (`git diff` shows no `-` line): the existing `deploy:` job body is byte-identical. `needs: deploy`, ~~`runs-on: node-20`~~ 🔴 **Corrected: the shipped file uses `runs-on: deploy-dev-preprod`, not `node-20` — and the rationale below is the one the checklist's own code review REVERSED, not confirmed.** `timeout-minutes: 5`, `continue-on-error: true`, one `run:` step of nothing but `echo` plus a guarded step-summary write. ~~`node-20` and not `deploy-dev-preprod` deliberately: the job has nothing to do on the stand, and the deploy runner is capacity-1 (D30/D32), so parking a no-op there would serialize it against real deploys for no benefit.~~ The shipped choice is `deploy-dev-preprod`, not `node-20`: a placeholder queued behind the shared, busier `node-20` CI runner would hold this workflow's own `cancel-in-progress: false` PRE-PROD concurrency group and block the next dispatch — a hotfix included — which is the actual rationale; see `deploy-preprod.yml`'s own header and `docs/migration-decisions.md#d39` §4 for the corrected argument (including this fix-pass's own correction of a second false claim in that same rationale, that reusing the deploy runner "adds no new dependency").

**Task 11 is `PENDING (owner: coordinator)` and was not attempted.** The dev agent did not touch the Forgejo API, dispatch anything, or SSH anywhere. The exact status: *the confirming dispatch of `deploy-preprod.yml` — verifying that `e2e` ran after `deploy` and did not gate it — is `PENDING (owner: coordinator)`; if the instance rejects an ordinary job carrying `needs:` on a `uses:` job, HALT with `e2e job placement requires §12 exception` rather than moving the job into the read-only `deploy-stand.yml`.* Parsing is not scheduling: `yaml.safe_load` succeeding says nothing about whether this instance's scheduler accepts the construct, and D21's failure mode is a rejection **before any job exists**, visible only in `action_run.pre_execution_error_details`. Also filed as an open ⚠️ in `deferred-work.md`.

**Follow-up story is 7.7**, "Replace the E2E Placeholder with Real End-to-End Coverage" — `epics.md` (~~six~~ 🔴 **corrected, code review of this fix-pass: the shipped story carries `nine` `**Given**` blocks, not six — counted directly in `epics.md`** — nine Given/When/Then criteria, appended after 7.6) and `sprint-status.yaml` (`7-7-replace-the-e2e-placeholder-with-real-end-to-end-coverage: backlog`, with an eight-line comment naming Story 5.5 as origin and mirroring 7.6's "a deferred line reads as 'someone will notice'" reasoning). One of its criteria requires that removing `continue-on-error: true` happen in the **same** change that installs real tests, so the job that finally proves something is also the job that can fail the run.

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

- ~~`python3 -c "import yaml,sys; yaml.safe_load(open('.forgejo/workflows/deploy-preprod.yml'))"` → no output, **exit 0**. Parsed shape: `jobs = ['deploy', 'e2e']`; `e2e.needs = deploy`, `runs-on = node-20`, `continue-on-error = True`, `timeout-minutes = 5`; `deploy.uses = ./.forgejo/workflows/deploy-stand.yml` with its `with:` block intact.~~ 🔴 **Corrected, code review of this fix-pass: `runs-on` in the shipped, parsed file is `deploy-dev-preprod`, not `node-20`.** This "Actual output" line asserted a value that does not match the file it claims to have parsed — presented as measured output, it was not. Re-run: no output, **exit 0**. Parsed shape: `jobs = ['deploy', 'e2e']`; `e2e.needs = deploy`, `runs-on = deploy-dev-preprod`, `continue-on-error = True`, `timeout-minutes = 5`; `deploy.uses = ./.forgejo/workflows/deploy-stand.yml` with its `with:` block intact.
- Run-body gate heredoc → `run bodies checked: 2` (both `deploy`'s inherited step-shape and `e2e`'s own), **exit 0**. Every `run:` body in the file contains no `$`+`{{`, begins with `set -euo pipefail`, and has no backslash-continued assignment.
- ~~`grep -c '^' docs/release-validation-checklist.md` → **413** (file exists, non-zero).~~ 🔴 **Corrected, code review of this fix-pass: 413 does not match the shipped file at any point in this story's history.** The file the story actually shipped (before this fix-pass's own further edits) was **653** lines; after this fix-pass's own patches to the checklist (P1/P2 abort shape, invariant disclosure, F2 reference-instant pin, item-id traceability for `<D>`/`<B>`, and others) it is **818** lines. Both later numbers are honest re-counts, not a claim that the file has always been this size.
- `grep -n 'd39' docs/migration-decisions.md` → hits at the header anchor range (`#d38` → `#d39`), the index-table row, `<a id="d39"></a>`, the `## D39. …` heading, §1's own re-check text, and the change-log row(s). 🔴 **Corrected, code review of this fix-pass:** the specific line numbers previously cited here (`:4658`, `:4896`) had already drifted before this fix-pass even started — this file's own edits above shift them further still. Cited by search string, not line number, per Dev Notes §8's own instruction not to add a third stale citation.
- `npm run lint` → **exit 0**. `npm run typecheck` → **exit 0**. No `src/` file was touched, so this proves only that nothing regressed.

**Manual checks:**

- `git diff --name-only HEAD` filtered for `deploy-stand.yml`, `record-preprod-candidate.yml`, `build.yml`, `deploy-dev.yml`, `dev-reset.yml`, `src/`, `package.json` → **no matches.** None of the frozen files changed. 🔴 **Corrected, code review of this fix-pass: an earlier version of this line also listed `preprod-candidates.md` in this "no matches" set — false, and contradicted two paragraphs below by the story's own "Actual output" (`11 0`).** `preprod-candidates.md` is not frozen and was never claimed to be structurally frozen — the story adds a prose paragraph to it, deliberately no row and no column. Removed from this list; its own diff is checked separately below.
- `git diff .forgejo/workflows/deploy-preprod.yml` → 72 insertions, **0 deletions**; the existing `deploy:` job body is untouched.
- `docs/preprod-candidates.md` gained no column and no row.
- No playwright / cypress / puppeteer / webdriver dependency was added; `package.json` is unmodified.


## Auto Run Result

Status: done. One outstanding item is owned by the coordinator and is named below, not hidden.

Committed as `92a8c8ef` (status flip, its own commit per the project's convention) and `472c03c7`
(the implementation). The pre-commit hook ran full CI parity on each: format:check, lint
`--max-warnings=0`, typecheck, and 229 test files / 1924 tests, all green. Not pushed; Oleg opens and
merges the PR.

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

1. 🔴 **RESOLVED, 2026-08-25 (code review fix-pass): the confirming dispatch happened, after the merge, not
   before it as this story's own PR description required.** Coordinator dispatch: `deploy-preprod.yml`,
   `ref=main`, `image_tag=sha-28f7fd36b75e-preprod` — **run 1281, SUCCESS**. Jobs `10719` "Deploy PRE-PROD
   via the shared definition" then `10720` "E2E placeholder (runs no test, never gates)", both SUCCESS. D21's
   rejection mode (no job, no log, only `action_run.pre_execution_error_details`) did **not** occur; the HALT
   condition never triggered. **An ordinary job carrying `needs:` on a `workflow_call` job schedules on this
   instance — proven, not merely parsed.** The dispatch's second purpose — observing whether job-level
   `continue-on-error` is honoured — was **not** and **could not** be answered by this echo-only body; see
   Risk 5 below, which replaces the unanswered half of this risk. That the dispatch ran after merge rather
   than before is recorded honestly here rather than silently absorbed — a deviation from the plan, not a
   defect in the result.
2. 🔴 **`RVC-v1` and Story 5.6 are not simultaneously satisfiable while the CORS origin is wrong.** Eight of
   twelve items are BLOCKED on the PRE-PROD Kong's `Access-Control-Allow-Origin`, owned by `CRM/api-prionex`.
   Under `RVC-v1` the only honest aggregate verdict today is `fail`, and G1 refuses `fail` before any registry
   read — yet 5.6's rehearsal is required to record a candidate. Both requirements are correct, and code
   review's second pass (2026-08-25) restated rather than re-litigated this. The two exits are the CORS fix
   landing first, or 5.6 recording under a documented, time-boxed waiver naming `RVC-v1` and listing the
   waived items. **Owner: Oleg** — a scope decision, not an implementation one. **The "CORS fix lands first"
   exit is now reachable, not merely theoretical: the ask was sent 23.08.2026** (tracked ASKED in
   `docs/preprod-infrastructure-requirement.md`'s status block, Oleg's decision 2026-08-25), though no
   response has arrived yet. Story 5.6 does not start until either the neighbouring team responds and closes
   the blocker, or Oleg makes an explicit decision to proceed under the waiver exception — whichever comes
   first is Oleg's call.
3. `docs/preprod-candidates.md`'s two existing `pass` rows would not qualify under `RVC-v1`. They are
   deliberately not rewritten; the mismatch is now recorded in both files so a later reader does not read it
   as an undetected defect.
4. **RESOLVED, 2026-08-25:** `sprint-status.yaml` and this spec's own `status:` field both flip to `review`
   as part of this fix-pass, now that the confirming dispatch (Risk 1) has actually happened and the 25 patch
   findings from code review pass 2 have been addressed. `followup_review_recommended` stays `true` — Oleg's
   three decisions are recorded, not resolved, by this pass.
5. 🔴 **NEW, code review's own decision (Oleg's veto open): `continue-on-error: true` is PERMANENTLY
   UNMEASURED BY DESIGN, and the instruction to observe it on a dispatch is removed, not repeated.** Run 1281
   (Risk 1) could not measure this flag — the step body was `echo`s plus a guarded redirect that cannot fail
   on a green run, so asking the same dispatch to observe it asked for a measurement the job's own body made
   structurally unreachable. Fixed instead: the redirect now carries `\|\| true`, making "the step body
   cannot fail on its own" literally true rather than an argument resting on the very flag it was describing.
   The flag remains, genuinely redundant belt-over-braces, not a load-bearing observation. Removing it or
   measuring it deliberately (on a throwaway workflow) remains Story 7.7's own AC.

---

## Review Findings — code review pass 2 (post-merge), 2026-08-25

**Range reviewed:** `35c1a39e..9faceae2` (PR #83, already merged to `main`). Three layers ran in
parallel — adversarial, edge-case, acceptance-audit — all three returned; no layer failed.

**Triage:** 3 `decision-needed`, 25 `patch`, 3 `defer`, 4 dismissed as noise.
**Nothing was patched by this pass.** The findings are records; the fixes belong to a follow-up PR.

### New evidence folded in, which the story did not have when it was written

The confirming dispatch (Task 11, `PENDING (owner: coordinator)`) was **not** run before the merge,
which the PR description required in its own words ("🔴 One dispatch is required BEFORE merge"). The
coordinator ran it **after** the merge, from `main`: **run 1281, SUCCESS.** Its job list —
job `10719` *"Deploy PRE-PROD via the shared definition"*, then job `10720` *"E2E placeholder (runs
no test, never gates)"* — settles the first of the two questions the dispatch was meant to answer:

- ✅ **An ordinary job carrying `needs:` on a `workflow_call` job DOES schedule on this instance.**
  D21's rejection mode (a workflow refused before any job exists, visible only in
  `action_run.pre_execution_error_details`) did **not** occur. The Block If is discharged; no §12
  exception is needed; the caller-side placement is proven, not merely parsed.
- ❌ **Whether job-level `continue-on-error` is honoured was NOT answered, and cannot be by this
  job.** The placeholder body is `echo`s and a guarded redirect; on a green run the flag is never
  reached. The workflow header names this observation as the dispatch's second purpose — an
  observation that is impossible by construction on the very job that carries the flag.

Consequence for the records: the repository now **underclaims**. `deploy-preprod.yml`'s header
(🔴 "WHAT IS NOT PROVEN HERE"), `docs/migration-decisions.md#d39` §4, its index row `:53`, its
change-log row `:4981`, `deferred-work.md`'s ⚠️ entry and this spec's Residual Risk 1 all still say
the construct is unproven and the dispatch is `PENDING`. Under D4 a ledger closes only against a
query; the query exists (run 1281) and no ledger row carries it. It does **not** overclaim anywhere
— no artifact yet asserts the dispatch happened.

### Findings

**`decision-needed`** — the correct fix is not derivable without Oleg.

- [x] [Review][Decision] **Resolved — Oleg's decision (2026-08-25): both requirement documents marked "направлено" (23.08.2026, ASKED, addressees CRM/api-prionex for CORS both environments, aleksey for DEV vhost). "Ask open" language kept but now points at the updated status block.** The CORS ask was never sent, and two shipped documents say it is open.
  `docs/release-validation-checklist.md` ("The CORS blocker") states *"**The ask is already open**
  with that team"*, and `docs/migration-decisions.md#d39` §6 states *"внешний ask открыт"*. The
  repository's own record says otherwise: `docs/preprod-infrastructure-requirement.md:5-7` —
  *"Кому направлено: (не заполнено — требование ещё не направлено)"*, *"Дата направления: (не
  заполнено)"*, *"Статус: **не направлено**"* — and `:11` *"Документ подготовлен, но **не
  отправлен**."* The same PR records the truth in `deferred-work.md` (*"The ask itself
  (`docs/preprod-infrastructure-requirement.md` §2.5) is still marked **не направлено**. **Owner:
  Oleg** for sending it."*), so the merge ships both statements. This is the premise the entire
  BLOCKED state rests on: a validator reading the checklist concludes somebody else is already
  working the blocker that makes 8 of 12 items unexecutable, when nobody has been told. Two exits:
  send the ask, or correct both operator-facing documents to say it has not been sent and name the
  owner. **Owner: Oleg.**
- [x] [Review][Decision] **Resolved — option (a)+(c) combined, code review's own decision (Oleg's veto open): flag kept, relabelled PERMANENTLY UNMEASURABLE-in-place, instruction to observe it on a dispatch removed; `|| true` added to the step-summary redirect so the "echos cannot fail" claim is genuinely true.** `continue-on-error: true` is unmeasured AND unmeasurable where it sits.
  `deploy-preprod.yml`'s header holds both *"the step body's only statements are `echo`s, so it
  cannot fail on its own and the flag should never be exercised"* and *"it is the SECOND thing the
  coordinator's confirming dispatch must observe"*. Those cannot both be acted on; run 1281 proved
  it by answering the first question and not the second. The project removed the step-level form as
  an unmeasured assumption (`dev-reset.yml:450-462`, code review H4) and records the construct as
  deliberately unused (`ci.yml:190-191`). Three exits: (a) remove the flag now — the body's `echo`s
  are the actual protection, and E5 says a guard that cannot be exercised is not a guard; (b)
  measure it once deliberately on a throwaway workflow and record the row in D39; (c) keep it and
  relabel it PERMANENTLY UNMEASURABLE-in-place, deleting the instruction to observe it on a
  dispatch. Doing none is the current state. **Owner: Oleg**, with (a)/(b) already routed to Story
  7.7's own AC.
- [x] [Review][Decision] **Restated, not re-litigated, per the coordinator's own instruction: the "CORS fix lands first" exit is now reachable (ask sent 23.08.2026); Story 5.6 does not start until the neighbouring team responds or Oleg makes an explicit waiver decision.** `RVC-v1` and Story 5.6 remain not simultaneously satisfiable. Restated,
  not re-litigated — the story filed this itself in three places and assigned it to Oleg. The
  2026-08-25 re-measurement on **routed** endpoints (`OPTIONS /api/v1/auth/login` → `200`, still
  `Access-Control-Allow-Origin: http://localhost:8320`, two negative controls) closed the last
  escape hatch: the blocker is real and static. Nothing about the merge changes the two exits (CORS
  fix first, or a documented time-boxed waiver). Coupled to the first decision above: exit one is
  not reachable while the ask is unsent. **Owner: Oleg.**

**`patch`** — unambiguous, not applied by this pass.

- [x] [Review][Patch] **Fixed: a failed P1/P2 now aborts validation before F1 begins, with its own fixed note shape (`precondition failed (<P1|P2>) — validation aborted, no items executed`) that does not range over 12 at all — see "How to execute it" and the note format's fourth shape.** A failed precondition is invisible in every artifact anyone reads — nothing
  makes `P1`/`P2` `fail` force the aggregate to `fail` [docs/release-validation-checklist.md — "How
  to execute it", "The `validation_note` format", "Execution Log"]. `P + D + F + B == 12` ranges over
  F1…F12 only and the aggregate rule says *"`pass` requires all twelve to be a full `pass`"*, so
  `P1 = fail` plus twelve passes yields a well-formed `RVC-v1 <tag>: 12/12 pass`, `validated=pass`
  and a minted `preprod-<sha>` against a stand that was serving a different digest — precisely the
  outcome P1's own text says it exists to prevent (*"your twelve verdicts describe a different
  artifact"*). Fix: make a failed precondition abort validation, and say so in the note format.
- [x] [Review][Patch] **Fixed: D39 §3 rewritten to the canonical shipped format (`<D>`/`<F>` clauses, parameterized cause/owner, P1/P2-abort note shape, invariant scope note).** `docs/migration-decisions.md#d39` §3 ships the **pre-review** `validation_note`
  format [docs/migration-decisions.md — D39 §3]. It reads `RVC-v1 <image_tag>: <P>/12 pass, <B>
  BLOCKED (CORS, CRM/api-prionex) — detail in …`: no `<D>`, no `<F>`, and the cause/owner hardcoded
  — which the checklist explicitly forbids (*"The cause and owner are **parameters, not literals**:
  do not hardcode `(CORS, CRM/api-prionex)`"*). A note written from D39 can never satisfy the
  invariant D39's own §6 cites. Two review patches were applied to the checklist and not propagated
  to the decision record, which is the file the workflow header points a reader at.
- [x] [Review][Patch] **Fixed: all six falsified facts strike-and-annotated in place (P1 delegation, 4/12 pass count, localhost:8005 misattribution, 72 lines/node-20, grep -c 413, runs-on=node-20 in Actual output) — per the project's own no-retroactive-rewrite rule.** The spec's own "Implementation notes" and "Verification / Actual output"
  sections record falsified facts as measured output
  [_bmad-output/implementation-artifacts/spec-5-5-…md]. Six, all contradicted by the merged tree or
  by the spec's own Review Triage Log: `runs-on = node-20` presented as the parsed shape of a
  `yaml.safe_load` of the shipped file (shipped: `deploy-dev-preprod`), with a rationale — *"`node-20`
  and not `deploy-dev-preprod` deliberately"* — that the review reversed; **72 added lines** stated
  twice (actual `151 0`); `grep -c '^' docs/release-validation-checklist.md` → **413** (actual
  **653**); *"the concrete note today is `4/12 pass, 8 BLOCKED`"* (the shipped checklist says
  `2/12 pass, 2 degraded, 8 BLOCKED`, and counting degraded as pass is the exact overstatement the
  review removed); *"P1 … is **asserted by the recorder's own G4/G5**"* (the shipped file says
  *"Who checks it: you do"* and gives two reasons that delegation is wrong); `localhost:8005`
  called the `VITE_WS_URL` fallback (`useDialerSocket.ts:9` is `localhost:8000`). Also the checked
  task text still reads `runs-on: node-20`. Fix: strike-and-annotate in place, per this project's
  own no-retroactive-rewrite rule.
- [x] [Review][Patch] **Resolved: the reviewer's own commit already flipped `status:` to `in-progress`; this fix-pass flips it to `review` now that the findings are addressed. `final_revision` updated at this pass's own final commit.** The spec asserts three different readiness states and a stale provenance
  [_bmad-output/implementation-artifacts/spec-5-5-…md frontmatter and body]. *"**Nothing was
  committed.** … Oleg commits."* and *"Committed as `92a8c8ef` … and `472c03c7`"* both stand;
  `final_revision: '472c03c7'` predates the merged content by three commits and a day
  (`ecd7dc94`, `0c6360ad`, `00aa3533`); `status: 'done'` contradicts `sprint-status.yaml`'s
  deliberate `in-progress` and the spec's own Residual Risk 4.
- [x] [Review][Patch] **Fixed in both `deploy-preprod.yml`'s own comment and D39 §4: the false "adds no new dependency"/"already holds" claims replaced with the real reachable-queue argument, choice kept, argument corrected.** The `runs-on: deploy-dev-preprod` rationale is false as written
  [.forgejo/workflows/deploy-preprod.yml — the `runs-on` comment block]. It claims *"The deploy
  runner is already required by this run, so reusing it adds no new dependency of any kind"* and
  that the cost is *"paid on a runner this run already holds"*. A run does not hold a runner across
  job boundaries, and `deploy-dev-preprod` is shared by `deploy-dev.yml:75`, `dev-reset.yml:166` and
  `record-preprod-candidate.yml:227`, all under **different** concurrency groups. Reachable path:
  `deploy` finishes and releases the capacity-1 slot → a DEV deploy claims it → `e2e` queues →
  `timeout-minutes: 5` bounds execution, not queue wait (the same comment says so) → the run stays
  in-progress → `cancel-in-progress: false` holds the PRE-PROD group → the next dispatch, a hotfix
  included, is blocked. That is verbatim the failure the comment rejects `node-20` for. The
  *choice* is still defensible (`node-20` is busier); the *argument* is not. Fix the argument.
- [x] [Review][Patch] **Fixed: `|| true` added to the `$GITHUB_STEP_SUMMARY` redirect, making the claim literally true rather than resting on the UNMEASURED flag.** *"The step body's only statements are `echo`s, so it cannot fail on its own"*
  is false [.forgejo/workflows/deploy-preprod.yml — `continue-on-error` header block and the `run:`
  body]. The body ends `{ … } >> "$GITHUB_STEP_SUMMARY"` under `set -euo pipefail`. `${GITHUB_STEP_SUMMARY:-}`
  guards *unset/empty*, not set-but-unwritable, missing directory, or full disk — any of which exits
  the step non-zero. So invariant (1) ("must never fail a run") rests entirely on the flag the same
  header calls UNMEASURED, on a directly reachable path. Fix: `|| true` on the redirect, which makes
  the `echo`s-cannot-fail argument true and the flag genuinely redundant.
- [x] [Review][Patch] **Fixed: D39's Триггер пересмотра corrected (CORS fix snaps `BLOCKED` from seven items, not F9); `epics.md` Story 7.7 AC3 corrected to exclude F9 explicitly, with the reasoning stated.** "Fixing CORS alone does not unblock F9" is undone in two other shipped files.
  D39's **Триггер пересмотра** says the CORS fix *"снимает `BLOCKED` с F4-F11 и делает агрегатный
  `pass` достижимым"* — F9 included; `epics.md` Story 7.7's third criterion says *"**Given** the
  PRE-PROD Kong's CORS origin is fixed … **Then** the authenticated flows (`F4` …, `F5`, `F6`,
  `F9`) pass"*. Both are the precise mistake the checklist patched out (*"so the dependency does not
  stay invisible inside somebody else's blocker and get assumed resolved when the CORS ask closes"*).
- [x] [Review][Patch] **Fixed: the checklist now states explicitly that the invariant is a convention, not a check, with a stated weakness example (4/12 arithmetically valid under misclassification).** The invariant `P + D + F + B == 12` is never marked unenforced, while the pipe
  and newline rules are [docs/release-validation-checklist.md — "The `validation_note` format"].
  The doc says *"Nothing checks either rule"* for the two shape rules and then presents the
  invariant as *"any note that does not satisfy it is wrong on its face"* with no such disclosure.
  Nothing anywhere enforces it: `record-preprod-candidate.yml:454-467` rejects only a blank note.
  Worse, it is a weak check — this spec's own `4/12 pass, 8 BLOCKED` example satisfies the
  arithmetic while misclassifying two degraded items as full passes. Say so: an unenforced
  convention that catches addition errors, never misclassification.
- [x] [Review][Patch] **Fixed: the combined shape is now marked "unexercised, not demonstrated" — G1 refuses before any note is written on the aggregate-fail path.** The note format has no live row and cannot get one on any reachable path today
  [docs/release-validation-checklist.md — "The three shapes"; AC4]. The combined shape is called
  *"the very first note Story 5.6 will write"*, but under the aggregate verdict the same file
  mandates today (`fail`), G1 exits as the first step of the first job — before the note-validation
  step at `:455-468` and long before the ledger row at `:982`. No note is written at all. AC4's
  *"compressed into a single-line `validation_note` that the shipped recorder accepts unchanged"* is
  therefore **read-verified, not exercised** — and the read-verification is sound (measured: 185
  chars, one line, no `|`, env-passed at `:456`/`:941`, `:982` cited exactly). Mark the fit as
  unexercised rather than as demonstrated.
- [x] [Review][Patch] **Fixed: added as a third unenforced convention alongside the pipe/newline rules, with the exact failure mode named.** Nothing reconciles the `image_tag` inside the note with the dispatched
  `image_tag` [docs/release-validation-checklist.md — format spec; record-preprod-candidate.yml:982].
  G2/G3 validate the *input* tag's shape only; the note passes through untouched. Dispatching tag B
  with a note naming tag A passes every guard and writes a ledger row that contradicts itself. Add
  it to the file's own list of unenforced conventions alongside the pipe and the newline.
- [x] [Review][Patch] **Fixed: heading format changed to `image_tag` + UTC timestamp (minute precision), which cannot collide on a same-day re-validation. Template updated to match.** The Execution Log key still collides on same-day re-validation
  [docs/release-validation-checklist.md — "Execution Log"]. The stated re-validation trigger is the
  CORS fix, after which F4-F11 become executable — a redeploy and re-validation on the same date is
  the expected case, not an exotic one. Two sections then share tag *and* date and *"the later date
  governs"* produces no ordering, while *"Never edit a section after it is written"* forbids repair.
  Add a UTC time or a sequence suffix to the heading.
- [x] [Review][Patch] **Fixed: pinned to the `build.yml` run's own `started` timestamp (the earliest of the three candidate instants), with where to read it stated. P2's own text updated to match.** F2 criterion 4 / P2's reference point is unpinned
  [docs/release-validation-checklist.md — F2 c4, P2; vite.config.ts:7-8]. `String(Date.now())` is
  evaluated when the vite config is *read* — before bundling, before `docker build` completes,
  before the image exists. The criterion requires the decoded epoch to be *"at or after the build
  time of the candidate image (the `build.yml` run that produced `image_tag`)"*. Run start, run end
  and image `created` are three different instants; on the most natural reading a perfectly correct
  bundle decodes to an *earlier* value and fails. P2 inherits this as its entire pass condition.
  Pin the reference instant, and say where the validator reads it — "How to execute it" grants only
  a tag and a browser.
- [x] [Review][Patch] **Fixed: heading and body narrowed to what was actually controlled — only criteria 2-3's `VITE_WS_URL`-unset half; c3's empty-string case, c2's other absences, and c4 were never controlled, stated explicitly.** The section titled *"F2's discriminators were measured, and were proven able
  to fail"* overclaims its own table [docs/release-validation-checklist.md]. The negative control
  varied `VITE_WS_URL` **unset** only. The build-timestamp column is `—` for that row, so criterion
  4 was never controlled; criterion 3's justifying case is the **empty string**, which takes the
  other branch of `!== undefined` and was never built; the absence of `api.crm.dev.crm-prionex.online`
  (c2) and of `http://localhost:5173` (c5) was never controlled either. Verified in the tree:
  `VITE_BUILD_TS` reaches the bundle through exactly one reference, `src/lib/i18n.ts:9`, and no
  measurement records how many quoted 13-digit integers a real bundle contains — so the search rule
  has no stated match count, unlike criterion 1 which does ("**3** files"). Narrow the heading to
  what was actually measured.
- [x] [Review][Patch] **Fixed: explicit statement added — no fifth verdict, no incomplete aggregate; a partial run (other than a P1/P2 abort) has no legal note at all under this format.** A partially executed checklist has no legal verdict
  [docs/release-validation-checklist.md — the four-verdict table]. An item nobody reached is not
  `pass`, not `fail` (*"executed and did not meet its criterion"*), and not `BLOCKED` (*"could not
  be executed **at all**"*, and it must name an owner). There is no fifth verdict and no incomplete
  aggregate, yet the note is only well-formed at 12. The only way out is to mis-record unreached
  items as `BLOCKED` with an invented owner — the misattribution the same page warns against.
- [x] [Review][Patch] **Fixed: added as prerequisite 4 in "How to execute it", with a `BLOCKED` fallback for a validator without repository-settings access.** F2 criterion 5 demands access the checklist does not grant
  [docs/release-validation-checklist.md — F2 c5 vs "How to execute it"]. It requires reading the
  Forgejo repository variable `vars.VITE_OPERATOR_PHONE_URL_PREPROD` (*"check the variable, do not
  guess"*), while the prerequisites list only a tag, a browser and two application accounts. F2 is
  declared `EXECUTABLE` and defines no degraded wording, so a validator without repository-settings
  access has no legal verdict for it.
- [x] [Review][Patch] **Fixed, all four: Story 7.7's Given count corrected to nine (spec, deferred-work.md); deferred-work.md's "Four items" corrected to six (recounted); PR description's "two new files" corrected to four (recounted via `git diff --diff-filter=A`).** Four counts in shipped text do not match the artifacts they count. Story 7.7
  has **9** `**Given**` blocks; the spec, `deferred-work.md` and the PR description all say *"six
  Given/When/Then criteria"*. The new `deferred-work.md` section says *"Four items leave the story
  open"* and carries **six** bullets. The PR description's blast radius says *"two new files"*; the
  diff adds **four**.
- [x] [Review][Patch] **Fixed in both files: replaced with the actual four-line object literal (lines 275-278), substance unchanged.** A verbatim code quote is a reconstruction [docs/release-validation-checklist.md
  F9 and deferred-work.md, citing `src/routes/index.tsx:277-279`]. The object literal is at
  **275-278** with `path: 'profile'` on **276**, spread over four lines, not the one-line form
  quoted. The substance — no `PermissionRoute` wrapper — is correct and verified. In a change whose
  own text argues line numbers rot, shipping a fabricated verbatim is the wrong direction.
- [x] [Review][Patch] **Fixed: the `grep -n 'd39'` claim reworded to avoid a specific unproducible match; `preprod-candidates.md`'s false inclusion in the "no matches" frozen-file list removed, its real diff (11 0) cross-referenced instead.** Two "Actual output" lines in Verification are unproducible or wrong
  [_bmad-output/implementation-artifacts/spec-5-5-…md]. A case-sensitive `grep -n 'd39'` cannot
  match `## D39.`, and the change-log row is at `:4981`, not `:4896`. Separately, a Manual check
  claims `docs/preprod-candidates.md` had *"no matches"* in `git diff --name-only` while the Auto
  Run Result in the same file reports `11 0` for it. The substantive constraint held — prose only,
  no row and no column — but the check record is false.
- [x] [Review][Patch] **Fixed: all three sinks named (`:982`, `:972`, and the Execution Log's own `Evidence / why` cells) in the checklist's own text.** The no-pipe / one-line rule is scoped to one of three sinks
  [docs/release-validation-checklist.md — "The `validation_note` format"]. The same value is also
  interpolated into a Markdown cell at `record-preprod-candidate.yml:972`
  (`echo "| validation_note | ${VALIDATION_NOTE} |"`) and into the Execution Log's own
  `Evidence / why` cells. Only `:982` is named.
- [x] [Review][Patch] **Fixed: `<D-ids>` and `<B-ids>` added to the format, template, worked examples, and D39 §3, matching `<F>`'s existing traceability.** `<B>` and `<D>` carry no item ids while `<F>` does
  [docs/release-validation-checklist.md — format spec]. When the CORS ask closes, a reader of
  `docs/preprod-candidates.md` cannot tell from the row which of the eight were blocked on it and
  which on the missing restricted-role account — the exact traceability the same paragraph asks to
  preserve.
- [x] [Review][Patch] **Fixed: search string narrowed to the indented, valued form, with the decoy line named explicitly so a reader is not surprised by the double hit.** `grep this file for `runner_label:`` returns a decoy
  [.forgejo/workflows/deploy-preprod.yml — the `runs-on` comment]. Two hits: `:24`, quoting
  `runner_label: deploy-preprod-preprod` — a label the same file records as non-existent — and
  `:157`, the real one. The replacement for a rotting line number is an ambiguous search naming two
  different labels.
- [x] [Review][Patch] **Fixed, both: the "none needed" bullet now carries no Owner field at all (a closed record, not a condition); the M7 re-owner rule's conditional successor clause removed, owner is `Story 5.6` with no standing fallback.** Two `deferred-work.md` owners drift from the Always constraint (*"owners are
  names or story numbers, never trigger conditions"*). One new bullet ends *"**Owner: none needed —
  closed disposition.**"*; the M7 re-owner rule reintroduces a conditional — *"ownership moves to
  the next story that dispatches this workflow"* — the same shape the correction removed, mitigated
  only by *"named explicitly at 5.6's closeout"*.
- [x] [Review][Patch] **Fixed: both corrected to the canonical shipped shape (I/O matrix row 1 now `12/12 pass — detail in …`; Design Notes example now satisfies `P+D+F+B==12`).** Two further note-format variants ship alongside the canonical one
  [spec I/O & Edge-Case Matrix row 1: `N/N pass — **see** …`; spec Design Notes: `6/9 pass, 3
  BLOCKED`]. The canonical form is `<P>/12 pass … — **detail in** …`. `6/9` violates the invariant
  the same story shipped.
- [x] [Review][Patch] **Disclosed, not fixed (correctly — `RVC-v1` does not edit `record-preprod-candidate.yml`): the offset between the Execution Log's own timestamp and the recorder's `$(date -u +%Y-%m-%d)` is now named explicitly in the checklist.** The ledger row's date is the recorder's date, not the validation date
  [record-preprod-candidate.yml:982 `$(date -u +%Y-%m-%d)` vs the Execution Log heading]. Validation
  finishing 23:50 UTC with the recorder dispatched at 00:10 dates the row one day after the section
  that justifies it, and the same-tag tie-break then runs on a date the ledger does not share.
- [x] [Review][Patch] **Disclosed: a fourth unenforced-convention paragraph added, naming the worst-case admissible length and stating it is a disclosure gap, not a live defect.** No stated or enforced length bound on `validation_note`
  [docs/release-validation-checklist.md — format spec]. `<F> fail (<ids>)` admits twelve ids and
  `<B> BLOCKED (…)` admits twelve semicolon-separated pairs; the only recorder guard is the blank
  check. Truncation or rejection of an over-long dispatch input is neither stated nor bounded. (The
  realistic worst case measured here is well under any plausible limit; this is a disclosure gap,
  not a live defect.)

**`defer`** — real, not caused by this change or not actionable now. Also filed in `deferred-work.md`.

- [x] [Review][Defer] Story 7.7's first criterion prices *"image size on the `node-20` runner"* while
  Story 5.5 established that a job with `needs: deploy` in this same workflow must not run on
  `node-20` [_bmad-output/planning-artifacts/epics.md, Story 7.7 AC1 vs
  .forgejo/workflows/deploy-preprod.yml] — deferred to Story 7.7
- [x] [Review][Defer] Both of the `e2e` job's output channels are documented unreliable in its own
  comments (job logs *"frequently never archive"*, step-summary persistence *"still unverified"*),
  so a permanently green job in the run list is its only durable signal — the shape `ci.yml:190-191`
  records as harmful [.forgejo/workflows/deploy-preprod.yml] — deferred to Story 7.7
- [x] [Review][Defer] A `fail` verdict leaves no trace in `docs/preprod-candidates.md`, so the
  append-only ledger cannot distinguish "validated and rejected" from "never validated"
  [.forgejo/workflows/record-preprod-candidate.yml:231-249, 982] — deferred, pre-existing (Story 5.4)

### Dismissed as noise (4)

`/dashboard/profile` unwrapped (the story already found, filed and owner-assigned it); *"roughly 60
dashboard routes"* (hedged, and 61 is the total `path:` count including non-dashboard routes); the
`localhost:5173` string being outside criterion 2's required-absent list (folded into the F2
measurement finding); *"the combined shape is the **only** shape"* being contradicted by the very
next example (folded into the no-live-row finding).

### What held up under all three layers

`deploy-stand.yml`, `record-preprod-candidate.yml`, `build.yml`, `deploy-dev.yml`, `dev-reset.yml`,
`ci.yml`, all of `src/` and `package.json` are absent from the merged diff. `deploy-preprod.yml` is
`+151 -0` — zero deleted lines, so the `deploy:` job is provably byte-identical and no §12 exception
was needed or taken. `docs/preprod-candidates.md` gained prose only: no row, no column. No browser
test dependency was added. The `e2e` `run:` body contains no `$`+`{{` anywhere including its
comments, begins with `set -euo pipefail`, and passes no value through interpolation. The
`deploy-stand.yml:1907` correction is **verified accurate**: `:1995` *Assert the healthy container
is THIS project's, anchored*, `:2035` *Fallback HTTP check*, `:2098` *AC6 — running image matches
the resolved digest*, `:2144` *Kong alias guard* and `:2251` *Record post-deploy state* all follow
the health poll in the same terminal job, and **no document still carries the falsified premise** —
all four sites (`deploy-preprod.yml:74-76`, D39 §4, the spec's Code Map, the PR description) carry
the corrected superset argument. The `validation_note`↔recorder fit is real by reading: `:982` is
exactly the ledger-row printer, the note is env-passed at `:456`/`:941` (no shell injection), and the
canonical line measures 185 characters with no newline and no `|`. AC1, AC3 and AC5 are satisfied by
the shipped artifacts; AC2 is now satisfied **and proven** by run 1281; AC4 is satisfied by reading
only; AC6 is satisfied for F4-F11 but not literally for F3/F12, whose `pass (degraded)` class is a
deliberate and defensible review patch that was never reflected back into the AC text.
