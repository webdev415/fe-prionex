---
baseline_commit: 54322fdd
---

# Story 2.2: Trigger CI on Pull Requests and Feature Branches

Status: ready-for-dev

> **What changed since Story 2.1.** `.forgejo/workflows/ci.yml` exists on `main` and is green
> (runs 492 and 493, four jobs, ~487 s cold / ~484 s warm — `2-1-…md:388-399`). Its trigger is
> `workflow_dispatch` and nothing else (`.forgejo/workflows/ci.yml:7-8`). This story is the one
> that lets it fire by itself. **Two facts make it harder than it reads:** pull requests are
> **disabled at the repository level** on this instance, and the workflow file is on **`main`
> only** while `.forgejo/workflows/` is on three branches. Both are load-bearing — §1 and §2.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want CI to start by itself when I open a pull request or push a branch,
so that I do not have to remember to dispatch it manually.

---

## 🚨 Read this before anything else

**Enabling triggers is the whole risk of this story.** Story 2.1 wrote a workflow that could not
fire; this one removes that safety. Everything below is a way that removal goes wrong.

### 1. 🔴 Pull requests are switched off on this repository, and switching them back on re-opens a hazard that was deliberately closed

`has_pull_requests` is **`false`**. It was flipped to `true` for Story 1.13's Task 3, then reverted
the same day on Oleg's explicit instruction — «ci-hub не надо запускать»
(`docs/migration-decisions.md:552-569`). The reason is recorded there in full, and it is not
squeamishness:

> `CI.yml` триггерится на `pull_request` для `[main, staging, development]`, а Forgejo резолвит
> директорию воркфлоу **по head-коммиту PR**. На инстансе 501 удалённая ссылка, плейсхолдер несут
> только 4 из них … **любой PR, открытый с существующей фича-ветки, запускал бы легаси
> `.github/workflows/CI.yml` на чужом раннере `ci-hub`** (`migration-decisions.md:558-563`)

**497 of 501 remote branches still carry an executable legacy `.github/workflows/`**
(`deferred-work.md:122-129`). The D9 suppression is **per commit, not per branch**
(`migration-decisions.md:506-512`) — a PR's head commit that predates 2026-08-10 has no
`.forgejo/workflows/` and falls straight through to `.github/workflows/CI.yml`, which asks for
`runs-on: ubuntu-latest`, which the `CRM` org resolves to **another team's runner**. That is not
theoretical: Story 1.13's control run #13 did exactly this, for 74 seconds, on `ci-hub`
(`migration-decisions.md:481`).

**Consequence for this story, stated plainly.** AC2 and AC3 cannot be demonstrated without the PR
unit being on. Turning it on is a decision with a named prior owner and a named prior reason, and
`deferred-work.md:126-129` says the risk *"re-opens automatically if Story 2.1 or anyone else
re-enables the unit without re-checking this"*. **This story is the "anyone else".** Blocking
Open Question 1.

Current value is **«не проверено»** — last observed `false` on 2026-08-10; nothing since has
checked, and the API needs a token this agent does not have.

### 2. The workflow is on `main` only. `.forgejo/workflows/` is on three branches. Those are different facts

| ref | `.forgejo/workflows/README.md` | `.forgejo/workflows/ci.yml` | `.github/workflows/` |
|---|---|---|---|
| `main` | yes | **yes** | `CI.yml`, `CD.yml` |
| `origin/staging` | yes | **no** | `CI.yml`, `CD.yml` |
| `origin/development` | yes | **no** | `CI.yml`, `CD.yml` |

Verified with `git ls-tree -r --name-only <ref> -- .forgejo .github` at `54322fdd`, and already
recorded as a warning for this story specifically:

> ⚠️ **`.forgejo/workflows/ci.yml` is on `main` only.** … Harmless while the trigger is
> `workflow_dispatch`, but Story 2.2 adds `push` and `pull_request` — **it must decide
> deliberately which branches carry the workflow**, rather than discovering the asymmetry when a
> push to `development` runs nothing. (`deferred-work.md:646-649`)

A `push` trigger naming a branch that does not carry the file is not an error. It is **silence** —
the exact failure mode this migration keeps producing (a missing cache server does not fail a job;
an absent log looks like a passing one). Task 2 exists to close it.

### 3. Every trigger you enable spends someone else's machine

The full run is **~487 s of wall clock and four concurrent jobs**, of which `Unit Tests` is 486
(`deferred-work.md:633-639`). The host it lands on:

- s1, 125 GiB total, **8.0 GiB free**, 104 cores, load average **12.99** rising to **25.82**
  within one session (`2-1-…md:307`, `:496-498`).
- It carries **another tenant's production** (`deferred-work.md:637-639`), plus `ci-hub`,
  `s1-build-crm`, `s1-deploy-dev-preprod`, `techno-finance` and the observability stack
  (`deferred-work.md:141-146`).
- The same suite runs in ~150 s locally: the runner is roughly **3× slower**.

A `push` trigger on `[main, staging, development]` fires four jobs on **every commit that lands
there, including documentation-only commits** — and this repository's own BMAD workflow pushes
docs commits to `main` routinely (Story 1.13 alone pushed three). **FR2 does not ask for that.**
It asks for `pull_request` on `main` and `push` on *feature* branches (`epics.md:67`). Read §5.

### 4. 🔴 You cannot read a job log on this instance, so plan the evidence before the run

Established on runs 492/493 and recorded as a standing constraint:

> the API returns **404** for `actions/jobs/{id}/logs`, `actions/runs/{run}/jobs/{id}/logs` and
> `actions/tasks/{id}/logs`; the storage tree `/data/gitea/actions_log` holds 3713 files with
> highest task id **4867** while our tasks 4872–4879 are absent and their `log_in_storage` stays
> `f` — even though the database records their `log_length` … **Anything a story needs to prove
> must be made observable in the database or the filesystem, not printed to stdout.**
> (`deferred-work.md:600-611`)

Every AC below is written so it can be closed from the runs table, the tasks table, the commit
SHA a run is bound to, and the repository settings — never from a log line. If you find yourself
planning an `echo`, you have planned an unprovable claim.

### 5. Forgejo already auto-cancels superseded runs, and D8 said to account for it here by name

> **Легаси auto-cancel по умолчанию.** На событиях `push` и `pull_request` (synchronize) Forgejo
> отменяет более ранние раны того же workflow на той же ветке **даже без блока `concurrency`**.
> Это меняет смысл «CI-прогон для коммита X» … **учесть в story 2.2.**
> (`migration-decisions.md:373-376`)

This is most of AC3 for free: a new commit on an open PR cancels the previous run of the same
workflow on that ref. **Two riders.** First, "the previous result no longer gates the merge" is a
claim about *which commit a check is bound to*, and that is checkable in the database (`head_sha`
/ commit status rows) — not from the fact that something was cancelled. Second, `POST
.../actions/runs/{id}/cancel` **does not exist in this API version** (`migration-decisions.md:581-585`),
so if a run is started by accident you wait it out. Trigger carelessly and you own ~8 minutes of a
busy host with no stop button.

### 6. Story 2.2's AC cites Story 1.4, which was cancelled — and the answer survived the cancellation

`epics.md:1119` says *"Given the synchronization model documented in Story 1.4"*. Story 1.4 is
**CANCELLED** (`epics.md:574-589`) and no `1-4-…md` file exists in
`_bmad-output/implementation-artifacts/` — verified by listing the directory. **Do not treat AC4
as unsatisfiable, and do not quietly drop it.** The investigation was done and its answer is
recorded:

> **there is no mirror in either direction.** `main` matched at `e6ecfced`, `development` had
> diverged (Forgejo `372ee2c4`, GitHub `405db726`), the GitHub repository is not a fork and
> carries `mirror_url: null`, and the local `origin` points at Forgejo with no GitHub remote
> configured. The team pushes to GitHub; the Forgejo copy lags and the gap widens daily.
> (`epics.md:282-287`, restated `migration-decisions.md:618-628`)

So the AC4 question — "is any duplicate-run interaction with the GitHub pipeline accounted for?" —
has a concrete answer: **the two platforms do not exchange commits automatically, so a single
`git push` cannot start runs on both.** Duplication happens only when a human pushes the same work
to both remotes, which is the current delivery model. Both platforms' `CI.yml` fire on
`push`+`pull_request` for `[main, staging, development]` (`.github/workflows/CI.yml:3-7`;
`migration-decisions.md:462`), so that hand-carried duplication is real and must be **written
down**, not designed away — GitHub is out of scope by D7 (`migration-decisions.md:262`).

### 7. What this story does NOT need, unlike Story 2.1

**No API token.** Story 2.1's §7 was blocked on `workflow_dispatch` needing a Forgejo API token
that had been revoked by design (`2-1-…md:132-143`, Blocking Open Question 1 at `:513-515`). This
story's triggers are `push` and `pull_request`: **a git push is the dispatch.** That is a genuine
simplification and it should not be re-invented. The only thing here that still needs credentials
is reading the *evidence* (runs/tasks tables) and flipping `has_pull_requests` — §1.

### 8. The flaky test was fixed today, and that is why this story is safe to do now

`src/test/setup.ts`, commit **`54322fdd`** — Radix's FocusScope restored focus from a
`setTimeout(…, 0)` scheduled at unmount that nothing awaited; with a fresh jsdom per file the
timer fired during the *next* file and jsdom rejected the cross-realm event. Fix: an `afterEach`
that calls RTL `cleanup()` explicitly and awaits one macrotask. **Five consecutive green
full-suite runs**, against 2 failures in 6 before the fix (`deferred-work.md:612-623`).

Why it belongs in this story's preamble: 2.2 is what makes CI run **without being asked**. At the
prior 1-in-3 failure rate, automatic triggers would have put a random red check on roughly every
third push — and Story 2.6 puts required status checks on top of that. **The fix has never run on
a runner** (`2-1-…md:486-489`): it was verified locally only, because 2.1's token was revoked
before it could dispatch. **The first automatic run this story produces is that fix's first real
test.** If it is red, stop and read §5 of Story 2.1 before changing any trigger.

### Prohibitions

🚨 **A prohibition here cannot be overridden by a subtask.**

1. **Do not enable `has_pull_requests` without Oleg's explicit decision, in writing, in this
   file.** A named prior decision turned it off for a named reason (§1). Flipping it silently
   re-arms legacy CI on another team's runner for every PR opened from any of ~497 branches.
2. **Do not add a `push` trigger on `[main, staging, development]` without pricing it.** §3. If a
   protected branch must be included, the story states how many runs per week that is and why it
   is worth ~487 s × 4 jobs each on a host at load 25.
3. **No `ubuntu-latest`, anywhere, ever.** Inherited from Story 2.1 AC7 and unchanged: it resolves
   — on another team's runner.
4. **Do not remove or rename `.forgejo/workflows/README.md`, and do not let any commit you push
   land without `.forgejo/workflows/` in its tree.** D9's invariant is per-commit
   (`migration-decisions.md:506-512`); a tree without that directory falls through to
   `.github/workflows/CD.yml`, whose `deploy` job targets PROD on `main`.
5. **Do not touch `.github/workflows/`.** D7 — no action is taken on GitHub
   (`migration-decisions.md:262`); the legacy files are deleted by Story 7.2. Duplicate runs are
   *recorded* by AC4, not *fixed* by it.
6. **Do not create or push a `v*` tag.** Tags resolve the workflow directory at the tagged
   commit; a tag on any commit predating 2026-08-10 resolves legacy `CD.yml` with
   `ENV_TYPE="production"` (`migration-decisions.md:523-529`).
7. **Do not "fix" anything CI reports on its first automatic run by changing the workflow.** If
   the newly-armed trigger surfaces a red test, that is information, not a workflow bug (§8).
8. **Do not claim a trigger works because a run appeared.** A run appearing on `main` proves
   nothing about `staging`, because the file is not there (§2). Each branch class is its own
   observation.
9. **Do not enable required status checks or branch protection rules for merges.** That is Story
   2.6, and Story 2.5 must supply five consecutive green runs first (`epics.md:1180-1201`).
10. **No `echo`-based evidence.** §4.

---

## Acceptance Criteria

Source: `epics.md:1096-1122`, Story 2.2. Covers FR2 (`epics.md:67`); prerequisite for Stories 2.5
and 2.6.

**AC1 — the triggers exist and name the right refs.**
Given `.forgejo/workflows/ci.yml` from Story 2.1,
when its triggers are configured,
then it runs on `pull_request` targeting `main`,
and it runs on `push` to feature branches,
**and the set of branches that carry the workflow file is stated explicitly and matches the set
the triggers name** (added by this story — see §2; without it the AC is satisfiable by a file that
fires nowhere).

**AC2 — a pull request starts all four jobs and the results are visible on it.**
Given a pull request is opened against `main`,
when the trigger fires,
then all four jobs start automatically,
and their results are visible as checks on the pull request.
*Evidence must be a run row bound to the PR's head SHA plus the commit-status rows, not a
screenshot and not a log (§4).*

**AC3 — a new commit re-runs CI and the stale result stops gating.**
Given a new commit is pushed to an open pull request,
when the trigger fires,
then CI re-runs against the updated head,
and the previous result no longer gates the merge.
*Forgejo's default auto-cancel covers the first half (§5); the second half is a claim about which
SHA the check is bound to and must be shown as such.*

**AC4 — the duplicate-run question is answered rather than inherited.**
Given ~~the synchronization model documented in Story 1.4~~ — **Story 1.4 is CANCELLED
(`epics.md:574-589`); its finding stands and is cited in its place: there is no mirror between
GitHub and Forgejo in either direction (`epics.md:282-287`)** —
when triggers are configured,
then any duplicate-run interaction with the GitHub pipeline is accounted for,
and the expected behaviour during the parallel period is recorded.

**AC5 — [DERIVED, not in the epic] the cost of arming the triggers is stated before they are
armed.**
Given a shared host at load average 12.99–25.82 with 8.0 GiB free, carrying another tenant's
production,
when triggers are enabled,
then the story records how many runs per week the chosen trigger set is expected to create and
which classes of commit (including documentation-only commits) will start four jobs.
*Derived from §3 and `deferred-work.md:141-146`; Story 2.4 owns the 15-minute budget, this owns
the arrival rate.*

---

## Tasks / Subtasks

### Task 1 — Bind the state before changing a trigger (AC: 1, 2, 5)

- [ ] 1.1 Re-verify which refs carry which files:
      `git ls-tree -r --name-only <ref> -- .forgejo .github` for `main`, `origin/staging`,
      `origin/development`. Expected at `54322fdd`: `ci.yml` on `main` only (§2). Record actual.
- [ ] 1.2 Read `has_pull_requests` on `CRM/fe-prionex` and record the value with a timestamp. Last
      observed `false` on 2026-08-10 (`migration-decisions.md:565-566`); anything since is
      «не проверено».
- [ ] 1.3 Record the current run count on this repository as the run-budget baseline. Story 2.1
      left it at **run 493** (`2-1-…md:396-399`); the baseline before 2.1 was 31 total runs
      (`2-1-…md:316`).
- [ ] 1.4 Record host state at start: free memory and load average on s1. 2.1 saw 12.99 → 25.82
      inside one session (`2-1-…md:496-498`); if it is materially worse, say so before adding
      automatic load.
- [ ] 1.5 Confirm `.github/workflows/CI.yml` still triggers `push`+`pull_request` on
      `[main, staging, development]` (`:3-7`) — AC4 is written against that exact block.

### Task 2 — Decide, in writing, which branches carry `ci.yml` and which refs the triggers name (AC: 1, 5)

🚨 Nothing in Task 3 may be written until this task's output is in this file.

- [ ] 2.1 Choose and justify the `push` shape. The options, with what each costs:
      - **(a) `branches-ignore: [main, staging, development]`** — fires on every branch that is
        not one of the three long-lived ones. This is FR2 read literally ("push to *feature*
        branches", `epics.md:67`), and it is the only option that does **not** put four jobs on a
        shared host for a documentation commit to `main` (§3). Cost: `branches-ignore` support on
        Forgejo 15.0.5 is **«не проверено»** — prove it, do not assume it.
      - **(b) `branches: ['**']`** — everything, including the three protected branches. Simplest
        to write, most expensive to run; must be priced under AC5 if chosen.
      - **(c) name feature-branch prefixes explicitly** (e.g. `KAN-*/**`) — matches this
        repository's actual naming, but silently skips anything named differently, which is the
        §2 failure mode in a new costume.
      **Recommendation: (a)**, with (c) rejected for silence and (b) rejected on cost.
- [ ] 2.2 Choose whether `ci.yml` is propagated to `staging` and `development`. State the
      consequence of the choice explicitly, because both directions have one:
      - Leave it on `main` only → **a feature branch cut from `staging` or `development` runs no
        CI at all**, and nothing says so. Push produces silence, not an error (§2).
      - Propagate → two more pushes to CD-triggering refs. Proven safe by D9 (three pushes, zero
        runs, `migration-decisions.md:483-485`), and both heads already carry the placeholder, but
        it is still two writes to shared protected branches and must be declared under Task 3.
      **Recommendation: propagate**, so the three long-lived branches are symmetric and any branch
      cut from any of them inherits CI. **Whichever is chosen, record that ~497 pre-existing
      branches carry neither `ci.yml` nor `.forgejo/workflows/` at all** (`deferred-work.md:122-129`)
      — for those, a push runs nothing and a PR runs *legacy* CI on `ci-hub` (§1).
- [ ] 2.3 Confirm the `pull_request` clause targets **`main`** only, per FR2 and AC1. Do not widen
      it to `[main, staging, development]` by symmetry with `.github/workflows/CI.yml:6-7` — that
      file's shape is not a requirement, it is the thing being replaced.
- [ ] 2.4 Decide whether a workflow-level `concurrency` block is added. Forgejo auto-cancels on
      `push` and `pull_request`(synchronize) **without** one (§5), and job-level `concurrency` is
      ignored silently (`migration-decisions.md:368-371`). If none is added, say that the
      behaviour relied on is the default and where it is documented.
- [ ] 2.5 State whether `workflow_dispatch` is retained alongside the new triggers.
      Recommendation: **retain it** — it costs nothing, and it is the only route left if a trigger
      turns out not to fire. Note it needs a token this agent does not have (§7).

### Task 3 — Declare the budget and the write list before spending either (AC: 5)

- [ ] 3.1 State the number of CI runs this story expects to create, before creating any. Three
      Epic-1 stories overran undeclared budgets, and Story 1.11 declared **zero** tokens and minted
      two (`deferred-work.md:505-510`); Story 2.1 declared 2 dispatches and spent 2
      (`2-1-…md:385-386`) — match that discipline. Remember each run is ~487 s with no cancel
      endpoint (§5).
- [ ] 3.2 List every write to shared state this story will make: branch pushes (which refs), and
      the `has_pull_requests` flip if it happens. Story 1.13 allowed itself two writes and made
      three unplanned ones (`deferred-work.md:117-121`).
- [ ] 3.3 Resolve Blocking Open Question 1 (`has_pull_requests`, §1) with Oleg **before** writing
      the trigger block, and record the decision and its author here. If the answer is no, AC2 and
      AC3 close as «не проверено» with the reason named — that is an acceptable outcome and a far
      better one than flipping the switch unilaterally.
- [ ] 3.4 If it is enabled, state the exit: when it goes back to `false`, or the explicit decision
      that it stays on as a permanent capability. `migration-decisions.md:567-568` anticipated
      exactly this moment («Story 2.1, если ей потребуется PR-triggered CI как постоянная
      возможность, включает юнит заново осознанно»). Plan the exit before the switch, per the
      standing token lesson.

### Task 4 — Write the trigger block (AC: 1)

- [ ] 4.1 Replace `on: workflow_dispatch:` (`.forgejo/workflows/ci.yml:7-8`) with the Task 2
      decision. Everything below `jobs:` is untouched — this story changes **triggers only**.
- [ ] 4.2 Keep the existing comment block at `:3-6` truthful: it currently explains why triggers
      are absent. Rewrite it to explain which triggers exist and why those refs, citing §2 and §3.
      A stale comment here is worse than none — it is the first thing the next reader trusts.
- [ ] 4.3 Grep the finished file for `ubuntu-latest` (excluding the deliberate comment at `:13-18`)
      and for `||`. Both must be empty. Inherited from Story 2.1's Task 4.8 and unchanged.
- [ ] 4.4 Confirm no `tags:` clause was introduced (Prohibition 6) and that `.forgejo/workflows/`
      remains non-empty in every commit this story creates (Prohibition 4).

### Task 5 — Prove `push` on a feature branch (AC: 1, 5)

- [ ] 5.1 Push a branch that matches the chosen `push` shape and carries the new `ci.yml`. Record
      the branch name, SHA, push time in UTC, and the run index before and after.
- [ ] 5.2 Record the created run: id, index, event (`push`), the SHA it is bound to, the four task
      ids, per-job status and duration, and which runner took each. Runner attribution comes from
      each runner's **container log**, not the job log — the Story 1.9 method, re-used in 1.12 and
      2.1 (`2-1-…md:334-339`). Job logs are unreadable (§4).
- [ ] 5.3 Compare the whole-run duration against 2.1's 487 s / 484 s (`2-1-…md:394`, `:399`).
      A large delta is Story 2.4's input, and this is the first run under automatic triggering.
- [ ] 5.4 🔴 **This is the fix from §8 running on a runner for the first time.** Record the
      `Unit Tests` result explicitly against `54322fdd`. Green is evidence the fix survives the
      runner; red means the flake was never fixed and Stories 2.5/2.6 are back where they were —
      either way it is the single most valuable observation in this story.
- [ ] 5.5 **Negative control, and it is not optional.** Push a commit to a ref the triggers do
      **not** name and record that the run index is unchanged. Without it, AC1 is a claim that
      something fires, with no evidence anything is scoped. Story 1.13's push verdict has no
      control of its own and that gap is still open (`deferred-work.md:109-116`) — do not repeat
      it. Pick a ref that is safe: a throwaway branch, never a protected one.

### Task 6 — Prove `pull_request` (AC: 2, 3) — **gated on Task 3.3**

- [ ] 6.1 Only if `has_pull_requests` is enabled by decision. Open a PR from the Task 5 branch to
      `main`. Both the head commit and the base must carry `.forgejo/workflows/ci.yml`, or the
      head falls through to legacy CI on `ci-hub` (§1).
- [ ] 6.2 Record the run created by the `pull_request` event: id, event type, head SHA, four task
      ids, statuses. Confirm from the database that the checks are **bound to the head SHA** —
      that is what AC2's "visible as checks on the pull request" and AC3's "no longer gates the
      merge" both actually assert.
- [ ] 6.3 Push a second commit to the same PR head. Record: a new run appears against the new SHA,
      and the earlier run's state. Expect auto-cancel of the superseded run **without** a
      `concurrency` block (§5) — if it does **not** cancel, that contradicts
      `migration-decisions.md:373-376` and is a finding worth more than the AC.
- [ ] 6.4 Record which SHA each commit-status row points at, before and after. This is AC3's
      second half and the only part that is not free.
- [ ] 6.5 Close and delete the PR branch. Execute Task 3.4's exit for `has_pull_requests`.

### Task 7 — Answer AC4 in writing (AC: 4)

- [ ] 7.1 Record that **Story 1.4 is cancelled** and that AC4's citation is dangling, and cite the
      surviving finding in its place: no mirror in either direction, GitHub `mirror_url: null`,
      local `origin` is Forgejo with no GitHub remote (`epics.md:282-287`,
      `migration-decisions.md:618-628`). Do not leave the AC reading as if 1.4 produced a document.
- [ ] 7.2 Write the parallel-period duplicate-run table: for each of `push to main`,
      `push to feature branch`, `PR to main`, state what fires on Forgejo and what fires on GitHub
      (`.github/workflows/CI.yml:3-7`), and note that a single `git push` reaches only one platform
      because there is no mirror. Duplication is a property of the humans, not the triggers.
- [ ] 7.3 State plainly that this is **recorded, not remediated**: D7 forbids action on GitHub
      (`migration-decisions.md:262`) and Story 7.2 owns deleting the legacy files.

### Task 8 — Record (AC: all)

- [ ] 8.1 Update `deferred-work.md:646-649` — that entry exists to warn this story about the
      `main`-only asymmetry. Close it with what was decided, or restate it precisely if the
      asymmetry is deliberately kept.
- [ ] 8.2 Record the `has_pull_requests` outcome in `deferred-work.md`, whichever way it went,
      with the owner and the exit. It is a repository-level setting with cross-tenant consequences.
- [ ] 8.3 Record the run-arrival estimate from AC5 — Story 2.4 (budget) and Story 4.2 (host
      resource confirmation) both inherit it.
- [ ] 8.4 Record the §8 result: whether `54322fdd` held up on a runner. Stories 2.5 and 2.6 are
      built entirely on that answer.
- [ ] 8.5 A changelog row in `docs/migration-decisions.md`. Note that D9's shape has changed
      again: `.forgejo/workflows/` on `main` now contains a workflow that **fires by itself** —
      every prior story asserted it fires on nothing.

### Task 9 — Close (AC: all)

- [ ] 9.1 Commit; update `sprint-status.yaml`
      (`2-2-trigger-ci-on-pull-requests-and-feature-branches`) to `review`.

---

## Dev Notes

### Exact source facts (verified at `54322fdd`)

**`.forgejo/workflows/ci.yml` — the file this story edits.**

```
:3-6   comment: "workflow_dispatch only, deliberately… Story 2.2 is where push/pull_request
       triggers get added."
:7-8   on:
         workflow_dispatch:
:10    jobs:  — lint (:11), typecheck (:41), test (:60), build (:118)
:19,:43,:62,:120   runs-on: node-20   (all four)
:95    run: npm run test:run:ci      (16384 MB ceiling; local `test:run` stays at 8192)
:157   uses: actions/upload-artifact@v3
:145   VITE_API_BASE_URL: http://ci.invalid   (no `||` fallback)
```

**`.github/workflows/CI.yml` — read only, never edited (D7).**

```
:3-7   on:
         push:         branches: [main, staging, development]
         pull_request: branches: [main, staging, development]
:12,:34,:53,:82   runs-on: ubuntu-latest   ×4
```

Identical on all three Forgejo refs (`migration-decisions.md:462`). `.github/workflows/CD.yml`
differs per ref and has **no** `pull_request` trigger on any of them
(`migration-decisions.md:456-464`).

**Branch/file matrix** — §2 table, from `git ls-tree -r --name-only <ref> -- .forgejo .github`.

**Repository settings.** `has_pull_requests: false` as of 2026-08-10
(`migration-decisions.md:565-566`). Branch protection exists on `main` and `staging` only —
`enable_push: true`, `enable_push_whitelist: false`, `apply_to_admins: false`, i.e. ordinary
pushes stay free and only force-push/branch-deletion are blocked for non-admins;
`development` has **no rule** and tag protection was never configured
(`migration-decisions.md:570-580`).

**Story 2.1's measured baseline** (`2-1-…md:388-399`): run 492 cold — Lint 174 s, Type Check 121 s,
Unit Tests **486 s**, Build 151 s, whole run **487 s**; run 493 warm — 163/105/483/143, whole run
**484 s**. Warm cache saved 3 seconds of 487 (`deferred-work.md:633-639`). Job assignment flipped
between the two runs, so both runners execute all four job types.

### Anti-patterns for this story

- **Copying `.github/workflows/CI.yml`'s trigger block.** It names `push` on three protected
  branches. That file is the thing being replaced, not the specification (§3, FR2 at `epics.md:67`).
- **Enabling `has_pull_requests` because the AC needs a PR.** §1. It has a prior owner, a prior
  decision, and a documented blast radius across ~497 branches.
- **Naming a branch in a `push` trigger without checking the file is on it.** Produces silence,
  which every prior story in this migration has been caught by at least once (§2).
- **Treating "a run appeared" as proof the trigger is correctly scoped.** Needs the negative
  control in Task 5.5.
- **Planning evidence that prints.** Job logs are unreachable (§4).
- **Adding a `concurrency` block to get behaviour that is already the default**, then reporting
  the default as the block's effect — a test that cannot fail proves nothing (Story 1.12's
  lesson, `2-1-…md:330-333`).
- **Inheriting AC4's "Story 1.4" citation silently.** The story was cancelled; the finding was not
  (§6).
- **Widening scope into required status checks.** Story 2.6, gated on Story 2.5's five green runs.

### Previous story intelligence

- **2.1:** proved the four jobs green twice and left three things this story consumes — job logs
  are unreadable, the cache is not where the time goes (`Unit Tests` is 486 of 487 s), and the
  heap-ceiling change of `54322fdd`'s neighbour commit `f7c83434` has **never run on a runner**
  (`2-1-…md:486-489`).
- **1.13:** the fact that makes this story possible at all — `.forgejo/workflows/` suppresses the
  `.github/workflows/` fallback, proven with a control on each of three branches
  (`migration-decisions.md:478-486`). It also left the two things that make this story dangerous:
  `has_pull_requests` reverted to `false`, and the invariant being **per-commit**, so 497 branches
  are still uncovered.
- **1.13, method:** never test a trigger mechanism for the first time on a protected-branch push;
  gate each push on the previous one producing no run.
- **1.12:** the instance disagrees with the plan more often than not — check, do not assume.
  Its nine-check isolation matrix was a false positive because the check could not fail.
- **1.11:** an empty result is not evidence of safety. Directly applicable to Task 5.5: "no run
  appeared" is only evidence if you have shown that a run *would* appear under the other
  condition.
- **1.8:** declared its dispatch budget too vaguely to be checkable and overran it. Task 3.1.

### Testing standards

No application code changes here, so "testing" means observation. Each AC closes on a recorded
observation from a real event — run id and index, event type, the SHA the run is bound to, task
ids, per-job status and duration, runner attribution from the runners' own container logs — or it
is marked **«не проверено»** with the reason. Specifically:

- A **negative control** is required for every scoping claim (Task 5.5).
- Evidence must live in the database, the filesystem, or the repository — never in a job log (§4).
- Timestamps in UTC for events, with the server's `+02:00` values recorded as the server gives
  them, per the D8/D9 evidence standard (`migration-decisions.md:473-476`).
- Run index before **and** after each event, and the id of the newest run, not the count alone —
  D9 records that recording only `total_count` was a gap (`migration-decisions.md:490-492`).

### Project Structure Notes

| Path | Change |
|---|---|
| `.forgejo/workflows/ci.yml` | **EDIT — triggers only.** `:7-8` and the comment at `:3-6`. Nothing under `jobs:`. |
| `.forgejo/workflows/README.md` | **Untouched.** Deleting it empties the tree entry and re-arms D9's hazard (Prohibition 4). |
| `.github/workflows/CI.yml`, `CD.yml` | **Read only.** D7. |
| `_bmad-output/implementation-artifacts/deferred-work.md` | UPDATE — close/restate `:646-649`; add the `has_pull_requests` outcome, run-arrival estimate, and the §8 result. |
| `docs/migration-decisions.md` | UPDATE — changelog row; D9's shape changed again. |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | UPDATE — `:78` `backlog` → `review`. |

Nothing in `src/`, no `package.json` change, no Dockerfile change. Possible pushes of `ci.yml` to
`origin/staging` and `origin/development` depending on Task 2.2.

### References

- `epics.md:1096-1122` — Story 2.2 ACs; `:67` FR2; `:1035-1047` Epic 2 goal; `:574-589` Story 1.4
  cancellation and its surviving finding; `:282-287` the no-mirror answer; `:1180-1201` Story 2.5's
  five-green-runs requirement, which this story's triggers feed.
- `docs/migration-decisions.md#d9` (`:428-633`) — the suppression mechanism, the per-ref legacy
  matrix (`:456-462`), the per-commit invariant (`:506-512`), `has_pull_requests` and the `ci-hub`
  exposure (`:552-569`), branch protection (`:570-580`), no cancel endpoint (`:581-585`),
  the sync-path finding (`:618-628`). `#d8` (`:373-376`) — auto-cancel, flagged "учесть в story 2.2".
  `#d7` (`:262`) — no action on GitHub.
- `deferred-work.md:646-649` — the `main`-only asymmetry, written for this story; `:600-611` job
  logs unreadable; `:633-639` where the 487 s goes; `:612-623` the flaky-test fix; `:122-129` the
  497 uncovered branches; `:141-146` s1 contention; `:109-116` the missing push control.
- `_bmad-output/implementation-artifacts/2-1-…md` — §5–§7 hazards, the run 492/493 evidence table
  (`:388-399`), and the amendment recording that the CI heap change is unproven on a runner
  (`:486-489`).
- `.forgejo/workflows/ci.yml`, `.github/workflows/CI.yml` — the two trigger blocks.

---

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

---

## Open Questions for Review

### Blocking

1. **`has_pull_requests` is `false`, and only Oleg can decide it changes (§1).** AC2 and AC3
   describe pull requests; the repository does not currently have them. Turning the unit on
   re-opens the exposure Oleg closed on 2026-08-10 with «ci-hub не надо запускать» — any PR opened
   from any of ~497 branches whose head commit predates the placeholder executes legacy
   `.github/workflows/CI.yml` on another team's runner. **Decide before Task 4, and record the
   exit before the switch, not after.** Current value is «не проверено» since 2026-08-10.
2. **Which branches carry `ci.yml` (§2, Task 2.2).** The file is on `main` only. Left as is, a
   feature branch cut from `staging` or `development` runs no CI and says nothing. Propagating
   means two pushes to CD-triggering refs — proven safe by D9, but they are shared protected
   branches and the write must be declared.

### Non-blocking

3. **`branches-ignore` support on Forgejo 15.0.5 is «не проверено».** The recommended `push`
   shape depends on it. If it turns out unsupported, Task 2.1 falls back to (b) or (c) and the
   AC5 cost estimate changes materially.
4. **The 497 uncovered branches (`deferred-work.md:122-129`) remain outside every story's scope.**
   This story makes their PR path *reachable* if Question 1 is answered yes. Someone should own
   bulk remediation before Story 2.5 opens five real pull requests.
5. **Run arrival rate vs. host budget.** Story 2.4 owns the 15-minute per-run budget; nothing owns
   runs-per-day on a host at load 25.82 with 8.0 GiB free. AC5 records the number; it does not
   assign an owner. Story 4.2 is the closest candidate (`deferred-work.md:141-146`).
6. **`development` has no branch protection** (`migration-decisions.md:579-580`) while `main` and
   `staging` do. If push triggers make `development` a CI-bearing ref, that asymmetry is worth a
   decision rather than an accident.
7. **No cancel endpoint exists in this API version** (`migration-decisions.md:581-585`). Once
   triggers are armed, an accidental run costs ~487 s of a shared host with no stop button. Worth
   knowing before Story 2.5 opens five PRs.
