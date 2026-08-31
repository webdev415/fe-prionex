---
baseline_commit: 54322fdd
---

# Story 2.2: Trigger CI on Pull Requests and Feature Branches

Status: done

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

### Task 1 — Bind the state before changing a trigger (AC: 1, 2, 5) ✅

- [x] 1.1 Re-verify which refs carry which files:
      `git ls-tree -r --name-only <ref> -- .forgejo .github` for `main`, `origin/staging`,
      `origin/development`. Expected at `54322fdd`: `ci.yml` on `main` only (§2). Record actual.
- [x] 1.2 Read `has_pull_requests` on `CRM/fe-prionex` and record the value with a timestamp. Last
      observed `false` on 2026-08-10 (`migration-decisions.md:565-566`); anything since is
      «не проверено».
- [x] 1.3 Record the current run count on this repository as the run-budget baseline. Story 2.1
      left it at **run 493** (`2-1-…md:396-399`); the baseline before 2.1 was 31 total runs
      (`2-1-…md:316`).
- [x] 1.4 Record host state at start: free memory and load average on s1. 2.1 saw 12.99 → 25.82
      inside one session (`2-1-…md:496-498`); if it is materially worse, say so before adding
      automatic load.
- [x] 1.5 Confirm `.github/workflows/CI.yml` still triggers `push`+`pull_request` on
      `[main, staging, development]` (`:3-7`) — AC4 is written against that exact block.

### Task 2 — Decide, in writing, which branches carry `ci.yml` and which refs the triggers name (AC: 1, 5) ✅

🚨 Nothing in Task 3 may be written until this task's output is in this file.

- [x] 2.1 Choose and justify the `push` shape. The options, with what each costs:
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
- [x] 2.2 Choose whether `ci.yml` is propagated to `staging` and `development`. State the
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
- [x] 2.3 Confirm the `pull_request` clause targets **`main`** only, per FR2 and AC1. Do not widen
      it to `[main, staging, development]` by symmetry with `.github/workflows/CI.yml:6-7` — that
      file's shape is not a requirement, it is the thing being replaced.
- [x] 2.4 Decide whether a workflow-level `concurrency` block is added. Forgejo auto-cancels on
      `push` and `pull_request`(synchronize) **without** one (§5), and job-level `concurrency` is
      ignored silently (`migration-decisions.md:368-371`). If none is added, say that the
      behaviour relied on is the default and where it is documented.
- [x] 2.5 State whether `workflow_dispatch` is retained alongside the new triggers.
      Recommendation: **retain it** — it costs nothing, and it is the only route left if a trigger
      turns out not to fire. Note it needs a token this agent does not have (§7).

### Task 3 — Declare the budget and the write list before spending either (AC: 5) ✅

- [x] 3.1 State the number of CI runs this story expects to create, before creating any. Three
      Epic-1 stories overran undeclared budgets, and Story 1.11 declared **zero** tokens and minted
      two (`deferred-work.md:505-510`); Story 2.1 declared 2 dispatches and spent 2
      (`2-1-…md:385-386`) — match that discipline. Remember each run is ~487 s with no cancel
      endpoint (§5).
- [x] 3.2 List every write to shared state this story will make: branch pushes (which refs), and
      the `has_pull_requests` flip if it happens. Story 1.13 allowed itself two writes and made
      three unplanned ones (`deferred-work.md:117-121`).
- [x] 3.3 Resolve Blocking Open Question 1 (`has_pull_requests`, §1) with Oleg **before** writing
      the trigger block, and record the decision and its author here. If the answer is no, AC2 and
      AC3 close as «не проверено» with the reason named — that is an acceptable outcome and a far
      better one than flipping the switch unilaterally.
- [x] 3.4 If it is enabled, state the exit: when it goes back to `false`, or the explicit decision
      that it stays on as a permanent capability. `migration-decisions.md:567-568` anticipated
      exactly this moment («Story 2.1, если ей потребуется PR-triggered CI как постоянная
      возможность, включает юнит заново осознанно»). Plan the exit before the switch, per the
      standing token lesson.

### Task 4 — Write the trigger block (AC: 1) ✅

- [x] 4.1 Replace `on: workflow_dispatch:` (`.forgejo/workflows/ci.yml:7-8`) with the Task 2
      decision. Everything below `jobs:` is untouched — this story changes **triggers only**.
- [x] 4.2 Keep the existing comment block at `:3-6` truthful: it currently explains why triggers
      are absent. Rewrite it to explain which triggers exist and why those refs, citing §2 and §3.
      A stale comment here is worse than none — it is the first thing the next reader trusts.
- [x] 4.3 Grep the finished file for `ubuntu-latest` (excluding the deliberate comment at `:13-18`)
      and for `||`. Both must be empty. Inherited from Story 2.1's Task 4.8 and unchanged.
- [x] 4.4 Confirm no `tags:` clause was introduced (Prohibition 6) and that `.forgejo/workflows/`
      remains non-empty in every commit this story creates (Prohibition 4).

### Task 5 — Prove `push` on a feature branch (AC: 1, 5) ✅

- [x] 5.1 Push a branch that matches the chosen `push` shape and carries the new `ci.yml`. Record
      the branch name, SHA, push time in UTC, and the run index before and after.
- [x] 5.2 Record the created run: id, index, event (`push`), the SHA it is bound to, the four task
      ids, per-job status and duration, and which runner took each. Runner attribution comes from
      each runner's **container log**, not the job log — the Story 1.9 method, re-used in 1.12 and
      2.1 (`2-1-…md:334-339`). Job logs are unreadable (§4).
- [x] 5.3 Compare the whole-run duration against 2.1's 487 s / 484 s (`2-1-…md:394`, `:399`).
      A large delta is Story 2.4's input, and this is the first run under automatic triggering.
- [x] 5.4 🔴 **This is the fix from §8 running on a runner for the first time.** Record the
      `Unit Tests` result explicitly against `54322fdd`. Green is evidence the fix survives the
      runner; red means the flake was never fixed and Stories 2.5/2.6 are back where they were —
      either way it is the single most valuable observation in this story.
- [x] 5.5 **Negative control, and it is not optional.** Push a commit to a ref the triggers do
      **not** name and record that the run index is unchanged. Without it, AC1 is a claim that
      something fires, with no evidence anything is scoped. Story 1.13's push verdict has no
      control of its own and that gap is still open (`deferred-work.md:109-116`) — do not repeat
      it. Pick a ref that is safe: a throwaway branch, never a protected one.

### Task 6 — Prove `pull_request` (AC: 2, 3) — **gated on Task 3.3** — 🚫 deferred at the time, ✅ **EXECUTED 2026-08-14**

✅ **Close-out 2026-08-15.** The gate opened the day after this story closed: Oleg enabled the
pull-request unit specifically to test the behaviour, the `pull_request` clause went into `ci.yml`
(`ec445428`), and PR #2 was opened, exercised with a second commit, and cleaned up. Every subtask
below was performed and its evidence is in the Dev Agent Record under **"AC2 and AC3 — CLOSED
2026-08-14"** (runs 513–516). The boxes are ticked against that evidence rather than re-run.
⚠️ Two things the original deferral warned about survived the execution and are **not** closed by
it: the ~497-branch legacy-fallback window that enabling the unit re-opens, and `has_pull_requests`
being left enabled — a state change this story's exit plan (Task 3.4) intended to reverse. Both are
Oleg's, both are in `deferred-work.md`.

**Original deferral, kept for the record.** Task 3.3 resolved to "no": `has_pull_requests` stays `false`.
Oleg's standing decision from 2026-08-10 is unchanged, and this session's own brief repeated the
prohibition explicitly (do not enable `has_pull_requests`, do not PATCH the repository, do not
open a pull request) — re-enabling the unit re-arms legacy CI on another team's `ci-hub` runner for
any PR opened from any of the ~497 branches whose head commit predates the `.forgejo/workflows/`
placeholder. AC2 and AC3 close as «не проверено» per Task 3.3's own instruction: that is the
acceptable outcome the task anticipated, not a shortfall.

- [x] 6.1 Only if `has_pull_requests` is enabled by decision. Open a PR from the Task 5 branch to
      `main`. Both the head commit and the base must carry `.forgejo/workflows/ci.yml`, or the
      head falls through to legacy CI on `ci-hub` (§1). — PR #2, from `probe/2-2-pr-check`, cut
      from current `main`. All four runs are `workflow_id = ci.yml`; the legacy workflow never
      fired.
- [x] 6.2 Record the run created by the `pull_request` event: id, event type, head SHA, four task
      ids, statuses. Confirm from the database that the checks are **bound to the head SHA**. —
      Run 514, `pull_request`, `refs/pull/2/head`, `839e9051`, 4/4 green, 503 s. `commit_status`
      rows carry per-event contexts (`CI / Lint (pull_request)` etc.) bound to the head SHA.
- [x] 6.3 Push a second commit to the same PR head. Record: a new run appears against the new SHA,
      and the earlier run's state. — Second commit `f82eb9b2` produced runs 515 (`push`, 461 s) and
      516 (`pull_request`, 510 s). ⚠️ **The auto-cancel expectation was not tested**: the second
      commit followed the first run to completion, so nothing was superseded and there was no
      opportunity to observe a cancel. D8's claim is neither confirmed nor contradicted here.
- [x] 6.4 Record which SHA each commit-status row points at, before and after. — Statuses for
      `f82eb9b2` bind separately from `839e9051`'s: checks attach to a commit, not to a branch, so
      the stale result stops gating by construction. This is AC3's second half.
- [x] 6.5 Close and delete the PR branch. Execute Task 3.4's exit for `has_pull_requests`. —
      ⚠️ **Half done.** PR #2 was closed and the branch deleted local and remote. Task 3.4's exit
      was **not** executed: `has_pull_requests` was deliberately left **enabled**, because turning
      it back off is a decision rather than cleanup and it is Oleg's. Story 2.5 then depended on it
      being on, and Story 2.6's gate now does too — so the exit is not merely unexecuted, it has
      been overtaken. The ~497-branch legacy-fallback window it was meant to re-close stays open.

### Task 7 — Answer AC4 in writing (AC: 4) ✅

- [x] 7.1 Record that **Story 1.4 is cancelled** and that AC4's citation is dangling, and cite the
      surviving finding in its place: no mirror in either direction, GitHub `mirror_url: null`,
      local `origin` is Forgejo with no GitHub remote (`epics.md:282-287`,
      `migration-decisions.md:618-628`). Do not leave the AC reading as if 1.4 produced a document.
- [x] 7.2 Write the parallel-period duplicate-run table: for each of `push to main`,
      `push to feature branch`, `PR to main`, state what fires on Forgejo and what fires on GitHub
      (`.github/workflows/CI.yml:3-7`), and note that a single `git push` reaches only one platform
      because there is no mirror. Duplication is a property of the humans, not the triggers.
- [x] 7.3 State plainly that this is **recorded, not remediated**: D7 forbids action on GitHub
      (`migration-decisions.md:262`) and Story 7.2 owns deleting the legacy files.

### Task 8 — Record (AC: all) ✅

- [x] 8.1 Update `deferred-work.md:646-649` — that entry exists to warn this story about the
      `main`-only asymmetry. Close it with what was decided, or restate it precisely if the
      asymmetry is deliberately kept.
- [x] 8.2 Record the `has_pull_requests` outcome in `deferred-work.md`, whichever way it went,
      with the owner and the exit. It is a repository-level setting with cross-tenant consequences.
- [x] 8.3 Record the run-arrival estimate from AC5 — Story 2.4 (budget) and Story 4.2 (host
      resource confirmation) both inherit it.
- [x] 8.4 Record the §8 result: whether `54322fdd` held up on a runner. Stories 2.5 and 2.6 are
      built entirely on that answer.
- [x] 8.5 A changelog row in `docs/migration-decisions.md`. Note that D9's shape has changed
      again: `.forgejo/workflows/` on `main` now contains a workflow that **fires by itself** —
      every prior story asserted it fires on nothing.

### Task 9 — Close (AC: all) ✅ (commit itself left to the parent — see Dev Agent Record)

- [x] 9.1 Commit; update `sprint-status.yaml`
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

Sonnet 5 (dev coordination, all decisions and evidence interpretation). Haiku, nested via the
Agent tool, for pure mechanical fact-gathering (SSH + `psql` queries in Task 1: repo id, unit
table, run-count baseline, host memory/load, UTC timestamps) — see the note at the end of this
section on how that went.

### Debug Log References

**Task 1 baseline (2026-08-13, ~18:02 UTC / 20:02 CEST).**

| fact | value |
|---|---|
| `.forgejo`/`.github` on `main` | `.forgejo/workflows/{README.md,ci.yml}`, `.github/workflows/{CD.yml,CI.yml}` — matches §2 |
| `.forgejo`/`.github` on `origin/staging` | `.forgejo/workflows/README.md` only (no `ci.yml`), `.github/workflows/{CD.yml,CI.yml}` |
| `.forgejo`/`.github` on `origin/development` | same as `staging` |
| `has_pull_requests` | repo id 16 (`CRM/fe-prionex`); `repo_unit` carries types 1,2,4,5,8,9,10 — **type 3 (pull requests) is absent**, i.e. still `false`. Re-verified 2026-08-13, supersedes the 2026-08-10 observation |
| run baseline | `action_run` for repo 16: `total=33`, `max(id)=493`, `max(index)=33` — matches Story 2.1's "left at run 493" exactly |
| host state | `free -h`: 7.2 GiB free of 125 GiB (was 8.0 GiB in 2.1 — slightly worse, not materially); `uptime`: load average **11.07, 17.14, 14.79** (2.1 saw 12.99→25.82) — comparable, not a stop condition |
| `.github/workflows/CI.yml` trigger | confirmed identical on `main`, `origin/staging`, `origin/development`: `push`+`pull_request` on `[main, staging, development]` |
| Forgejo version | `15.0.5+gitea-1.22.0` |

**Task 2/3 decisions (recorded before Task 4, per Task 3.3's requirement).**

- **`push` shape:** option (a), `branches-ignore: [main, staging, development]` — Oleg's standing
  instruction, matching the story's own recommendation. **Empirically proven supported**, not
  assumed — see the mechanism-proof row below.
- **`pull_request`:** absent. `has_pull_requests` stays `false` — Oleg's standing decision, and
  this session's brief repeated the prohibition explicitly (no PATCH, no PR opened). Exit: none
  needed: the unit was never flipped, so there is nothing to revert.
- **Propagation to `staging`/`development` (Task 2.2):** **declined this session.** Both refs keep
  only `README.md`. Reason: propagating means two additional pushes to protected, CD-triggering
  branches, and this session was scoped not to push new commits to `main`/`staging`/`development`
  directly (all such writes were to be left for the parent to review and land — see the note on the
  `main` commit below). **Stated consequence, per Task 2.2's own requirement:** a feature branch cut
  from `staging` or `development` today carries no `.forgejo/workflows/ci.yml` and a push to it
  produces silence — no run, no error. This is an open item, not a hidden one; recorded in
  `deferred-work.md` and left for the parent/a follow-up to decide when the `main` commit lands.
- **`concurrency` block:** not added. Forgejo's default auto-cancel (D8) already covers superseded
  runs on the same ref for `push`; adding a block to get behaviour that's already the default was
  Story 1.12's mistake, not repeated here.
- **`workflow_dispatch`:** retained alongside `push`.
- **Budget declared before spending (Task 3.1/3.2):** 2 pushes to a disposable probe branch cut
  from `main`, 0 pushes to `main`/`staging`/`development`, 0 PRs, 0 `has_pull_requests` writes.
  Expected runs: 0 from the first push (self-excluding config), 1 from the second (real config).
  **Spent exactly as declared:** 2 pushes, 1 run (id 505). No overrun.

**Task 5 — mechanism proof and the positive run, on a disposable branch (`probe/2-2-push-trigger`,
cut from local `main` at `da135963`, which already carried the unpushed `54322fdd` fix — deleted,
local and remote, after Task 5 closed).**

| step | what was pushed | event | run created? | evidence |
|---|---|---|---|---|
| **Mechanism proof (negative)** | commit `84e0e201`: the real trigger block, **plus** the probe branch's own name added to `branches-ignore` (test-only, disposable) | `push` to `refs/heads/probe/2-2-push-trigger`, 2026-08-13 18:07:24–~18:07:35 UTC | **No.** `SELECT ... FROM action_run WHERE repo_id=16 ORDER BY id DESC LIMIT 5` immediately after showed `max(id)=493`, unchanged. Re-confirmed after the second push: `SELECT count(*) WHERE repo_id=16` = 34 total (33 baseline + exactly 1, the positive run below); a targeted query for any run with `commit_sha = '84e0e201…'` returned **0 rows**. Not "the count didn't move" — no row for that commit exists at all, for this repo, ever. | proves `branches-ignore` actually excludes a named ref, not assumed |
| **Positive test** | commit `d26d667d`: same file with the self-exclusion line removed — identical to what ships | `push` to `refs/heads/probe/2-2-push-trigger`, 2026-08-13 18:11:40–18:12:05 UTC | **Yes**, within ~8s: run **505**, index 34, event `push`, ref `refs/heads/probe/2-2-push-trigger`, `commit_sha = d26d667d…` (the pushed HEAD, correctly bound) | proves the same trigger fires when the branch is not excluded |

**Method note, answering the coordinator's question directly.** The negative result is not "nothing
happened, therefore it's excluded" on its own — that would be the weak form. It is backed by three
things together: (1) the query is filtered by `repo_id`, so it is not "the global top-5 didn't
change," it is "this repository created zero runs in the window"; (2) a direct query for the exact
commit SHA of the excluded push returns zero rows, closing the gap between "didn't observe a run"
and "no run was ever created for that push"; (3) the **same mechanism, same branch, same
environment**, with only the exclusion line removed, produced a run within ~8 seconds on the very
next push — so the absence isn't slow propagation or a query race, it's the trigger declining to
fire. That paired design (self-excluding push → positive push) is what makes the negative half
strong evidence rather than the "empty result ≠ safety" trap Story 1.11 flagged.

**Task 5 — the positive run's full evidence table (run 505, `push`, bound to `d26d667d…`, total
468 s):**

| job | task id | runner | runner container | status | duration |
|---|---|---|---|---|---|
| Lint | 5201 | 19 | `forgejo-runner-fe-prionex` | success (1) | 143 s |
| Type Check | 5202 | 19 | `forgejo-runner-fe-prionex` | success (1) | 86 s |
| Unit Tests | 5203 | 20 | `forgejo-runner-fe-prionex-2` | success (1) | 467 s |
| Build | 5204 | 20 | `forgejo-runner-fe-prionex-2` | success (1) | 113 s |

Runner attribution cross-checked against each runner's own container log (Story 1.9 method, not the
job log): `docker logs --since 20m forgejo-runner-fe-prionex` shows `task 5201`/`5202 repo is
CRM/fe-prionex`; `forgejo-runner-fe-prionex-2` shows `5203`/`5204` — matches `action_task.runner_id`
exactly. Two-and-two distribution, consistent with runs 492/493/486.

**§8 result — the flaky-test fix, on a runner for the first time.** `Unit Tests` (task 5203, commit
`d26d667d`, which carries `54322fdd`) is **green: success, 467 s**. This is the first time
`54322fdd`'s fix has run on a Forgejo runner rather than only locally. Whole-run duration 468 s is
in line with Story 2.1's 487 s/484 s (within the runner's normal variance, not a regression).

**Comparison against 2.1's baseline:** Lint 143 s (2.1: 174/163 s, faster), Type Check 86 s (2.1:
121/105 s, faster), Unit Tests 467 s (2.1: 486/483 s, in range), Build 113 s (2.1: 151/143 s,
faster) — whole run **468 s** vs 487 s/484 s. No large delta; if anything slightly faster, likely
host-load noise rather than a systematic change.

**Landing the change on `main` and the negative control there — what happened and what didn't.**
Per this session's brief, the deliverable (`.forgejo/workflows/ci.yml`'s edit, plus the doc updates
below) was to be left uncommitted for the parent to review and land — "do not commit." Mid-task,
the coordinator asked for the trigger change to be fast-forwarded onto `main` and the resulting
push verified to create zero runs, as the direct negative control the story's own Task 5.5 and the
"done" definition ask for. **That specific `git commit` on `main` was blocked by the permission
system's auto-mode classifier** (denied outright, not a judgment call I made) — so it was not done,
and was not worked around. `main`'s working tree currently holds the finalized `.forgejo/workflows/ci.yml`
content **staged but uncommitted** (identical to the file pushed and proven on the probe branch).
~~**Consequence for the evidence:** the literal "a push landed on real `main` and created no run"
has not been observed in this session.~~

✅ **CLOSED by the parent session immediately afterwards, 2026-08-13.** The commit landed on `main`
as `fed828d1` and was pushed to `origin/main` **with the `push` trigger already armed in that very
commit** — the strongest form of this control, since the workflow being tested is the one the push
delivers. Verified in the same rigorous form used for the probe branch, by SHA rather than by
absence from a list:

```sql
select count(*) from action_run
where repo_id = (select id from repository where lower_name = 'fe-prionex')
  and commit_sha = 'fed828d142a1aa035dfd061047759ff88c476b8a';
-- 0
```

The newest run on the repository remained **505** (the probe branch's). So: a push to a branch named
in `branches-ignore` creates no run, observed **directly on `main` itself**, not by analogy.
**AC1 and AC5 no longer carry the indirectness caveat.** The `branches-ignore` mechanism is now
proven three ways — a named-ref exclusion producing zero rows for its SHA, the paired positive
control producing run 505 eight seconds later, and this direct observation on the real protected
ref.

**D9 invariant, reconfirmed after cleanup:** `git ls-tree -r --name-only <ref> -- .forgejo/workflows/`
— `main`: `README.md`, `ci.yml` (the trigger edit landed as `fed828d1`); `origin/staging`: `README.md` only; `origin/development`: `README.md` only. Matches
pre-story state exactly. Probe branch deleted both locally (`git branch -D`) and on the remote
(`git push origin --delete`) — the pre-push build hook still ran on the deletion push, added no run.

**AC5 — run-arrival estimate (Task 8.3).** Commit history on non-`main`/`staging`/`development`
refs: 1 commit in the last 7 days, 32 commits (across 14 distinct active branches) in the last 14
days — most of the repository's ~497 branches are inactive. By contrast, `main` itself received 68
commits in the last 7 days (routine BMAD/docs pushes) — every one of which would have fired four
jobs under a naive `branches: ['**']` or `[main, staging, development]` shape, and fires **none**
under `branches-ignore`. Treating commit count as an upper bound on push-events (a push often
batches several commits into one trigger), the chosen shape adds **up to ~16 runs/week** (32 feature-branch commits over 14 days ÷ 2, one run per commit as an upper bound since Forgejo's default auto-cancel collapses rapid pushes). 🔴 **Corrected by review 2026-08-13: the previously stated range «7–16» had an invented floor.** Nothing derived the 7, and the story's own 7-day measurement was **1**, seven times below it. The honest statement is an upper bound with a wide, bursty distribution beneath it — the last 7 days produced 1
at ~468 s each — roughly **1–2 hours of run wall-clock per week**, not the ~9 hours/week a `main`-
inclusive shape would have added at the observed docs-push rate.

**Nested-agent note.** One Haiku subagent was used for Task 1's SSH/`psql` fact-gathering. It ran
the first query, hit a real schema error (`has_pull_requests` is not a column — Forgejo stores unit
enablement in `repo_unit`, keyed by `type`), correctly stopped instead of guessing, and reported the
error back for direction rather than inventing a workaround. Given a corrected, fully-specified
follow-up prompt (repo_unit query, run-count query, host state), it executed cleanly and returned
exact, usable numbers. Verdict: nesting worked as intended for pure "run this, quote the output"
work; it does not substitute for the judgment calls (trigger shape, propagation, budget, evidence
interpretation) that stayed with the coordinating agent throughout.

### Completion Notes List

**AC1 — the triggers exist and name the right refs. ✅ CLOSED 2026-08-14; the branch-set asymmetry
below is a separate, still-open item.** 🔴 **Corrected by review 2026-08-13:** this previously read
*«mostly closed, with one stated asymmetry»*, which undercounted. AC1 has a `pull_request` clause of
its own (`epics.md:1106`), and **that clause was deferred exactly as AC2 and AC3 were** — every
deferral record written by this story names only AC2/AC3, so an AC1 marked satisfied would have
carried the `pull_request` half into the archive as done. ✅ **Closed on 2026-08-14 (recorded at
close-out 2026-08-15):** Oleg enabled the pull-request unit, the `pull_request` clause was added to
`ci.yml` targeting `main`, and it was exercised four times — see the AC2/AC3 section below and, more
heavily, Story 2.5's five real PRs. All three of AC1's clauses now exist and are proven.
⚠️ **What is NOT closed by that** is the second shortfall: the branch-set asymmetry, which is now
tracked as an Epic-wide item in `deferred-work.md` and needs Oleg's decision.
The original record follows.
`.forgejo/workflows/ci.yml` on `main` runs on `push` with `branches-ignore: [main, staging,
development]` plus `workflow_dispatch`; ~~`pull_request` is deliberately absent (see AC2)~~ — added
2026-08-14. The set of
branches carrying the file (`main` only) does **not** fully match the set the `push` trigger names
(every branch except three) — that is the known, declared consequence of choosing not to propagate
`ci.yml` to `staging`/`development` this session (Task 2.2). Concretely: a feature branch cut from
`main` gets CI (proven, see Task 5); a feature branch cut from `staging` or `development` would not,
silently, until someone propagates the file or a future story does. This is recorded, not hidden,
in `deferred-work.md`. The trigger mechanism itself is proven correct (branches-ignore excludes a
named branch, proven on the probe branch; fires otherwise, proven on run 505) on Forgejo
15.0.5+gitea-1.22.0, which was previously «не проверено».

**AC2 — a pull request starts all four jobs and the results are visible on it.** **Not closed, by
design, as the story itself anticipated.** `has_pull_requests` remains `false` — reconfirmed
2026-08-13 (repo_unit lacks type 3) — and this session was explicitly instructed not to enable it,
not to PATCH the repository, and not to open a pull request. Task 6 is recorded as deferred with
this reason. AC2 closes as «не проверено», which Task 3.3 names as an acceptable outcome, not a
shortfall.

**AC3 — a new commit re-runs CI and the stale result stops gating.** **Not closed**, for the same
reason as AC2 — this AC is written against pull-request behaviour (which commit a check is bound
to, on an open PR) and PRs are off. The `push`-side half of the same mechanism (Forgejo's D8
auto-cancel, and a run being bound to the exact head SHA of the push that created it) **was**
observed directly on run 505 (`commit_sha` = the pushed HEAD, not an ancestor), but that is evidence
for the mechanism, not a substitute for the PR-specific claim the AC makes.

**AC4 — the duplicate-run question is answered rather than inherited.** **Closed.** Story 1.4 is
cancelled; its surviving finding is cited in its place (no mirror between GitHub and Forgejo in
either direction — `main` diverged at `e6ecfced`, `development` diverged further, GitHub carries
`mirror_url: null`, local `origin` has no GitHub remote). Duplicate-run table for the parallel
period: `push to main` — Forgejo fires nothing under the new trigger (excluded by
`branches-ignore`), GitHub's `CI.yml` fires on `push`+`pull_request` for `[main, staging,
development]` unconditionally (verified identical on all three Forgejo refs); `push to a feature
branch` — Forgejo fires (proven, run 505), GitHub fires nothing (feature branches aren't named in
GitHub's trigger); `PR to main` — Forgejo fires nothing (PR unit off), GitHub fires normally. A
single `git push` reaches only one platform, since there is no mirror — duplication is a property of
a human hand-carrying the same commit to both remotes, not something the triggers create or could
fix. Per D7, this is recorded, not remediated; GitHub's legacy files are Story 7.2's to remove.

**AC5 — the cost of arming the triggers is stated before they are armed.** **Closed.** Budget
declared before any push (Task 3.1/3.2) and matched exactly (2 pushes, 1 run, 0 writes to protected
branches, 0 PRs). Run-arrival estimate recorded above: **up to ~16 runs/week** (floor corrected by review — see AC5) at ~468 s each under
the chosen `branches-ignore` shape, versus the **78** commits/week landing on `origin/main` alone (re-measured; the story first said 68) that a
`main`-inclusive shape would have charged in full — the host's 7.2 GiB free / load 11–17 was
recorded before triggering and was not materially different from Story 2.1's session.

**Outstanding from this session, for the parent:** ~~the `.forgejo/workflows/ci.yml` edit is staged
on `main`'s working tree but not committed~~ — ✅ **CLOSED 2026-08-13 by `fed828d1`** — the commit landed on `main` with the trigger armed in that very commit, and zero runs exist for its SHA (checked by SHA, not by absence from a listing); `refs/heads/main` has never produced a run. Verified again by review. Remaining: `deferred-work.md`, `docs/migration-decisions.md`,
`_bmad-output/implementation-artifacts/sprint-status.yaml` and this story file are edited but
likewise uncommitted. Landing the `main` commit and re-running the run-count query afterward (`push`
to `main` should create no run) is the one remaining piece of direct evidence this session could not
produce itself.

**AC2 and AC3 — CLOSED 2026-08-14, after Oleg enabled the pull-request unit to test it.**

The unit was `has_pull_requests: false` when this story was written, so both criteria were recorded
as deferred rather than closed. Oleg enabled it, the `pull_request` trigger was added to `ci.yml`,
and PR #2 was opened from a branch cut from current `main`.

| run | event | ref | sha | result | wall |
|---|---|---|---|---|---|
| 513 | `push` | `refs/heads/probe/2-2-pr-check` | `839e9051` | 4/4 green | 461 s |
| 514 | `pull_request` | `refs/pull/2/head` | `839e9051` | 4/4 green | 503 s |
| 515 | `push` | same branch, 2nd commit | `f82eb9b2` | 4/4 green | 461 s |
| 516 | `pull_request` | `refs/pull/2/head` | `f82eb9b2` | 4/4 green | 510 s |

**AC2** — all four jobs started automatically on the PR event, and the results are visible **as
checks**: `commit_status` rows exist with contexts `CI / Lint (pull_request)`, `CI / Build (push)`
and so on, bound to the head SHA.

**AC3** — the second commit produced runs 515 and 516 against the **new** head `f82eb9b2`, and the
statuses bind to that SHA separately from `839e9051`'s. The previous result therefore stops gating
by construction: checks attach to a commit, not to a branch.

🔴 **The legacy workflow did not fire once.** Every one of the four runs is `workflow_id = ci.yml`.
D9's suppression held — **but it held because the head commit carries `.forgejo/workflows/`.** A PR
opened from any of the ~497 branches whose head predates that placeholder would still fall through
to `.github/workflows/CI.yml` on another team's runner. Enabling the unit re-opens that window; it
is not closed by this evidence.

⚠️ **Duplication is real and it is expensive.** One commit on a PR branch costs **two runs** —
`push` and `pull_request` — 964 s of wall clock and ~1620 job-seconds for a single change. FR2 asks
for both triggers, so this is the price of the requirement as written, not a misconfiguration. If it
must come down, the lever is the `push` trigger, not this one: `pull_request` is the half that gates
merges.

🔴 **Story 2.6 inherits a choice nobody has made: there are eight required-check contexts, not
four.** Statuses are named per event — `CI / Lint (push)` and `CI / Lint (pull_request)` are
different contexts. Marking the wrong set required produces a gate that either never goes green or
never blocks anything.

**Cleanup:** PR #2 closed, branch deleted local and remote. **`has_pull_requests` was left ENABLED**
— turning it back off is a decision, not cleanup, and it is Oleg's.

### File List

- `.forgejo/workflows/ci.yml` — trigger block only, per Task 4; proven on a disposable probe branch
  and **committed to `main` as `fed828d1`**
- `_bmad-output/implementation-artifacts/2-2-trigger-ci-on-pull-requests-and-feature-branches.md` — this file (Dev Agent Record, task checkboxes, Status)
- `_bmad-output/implementation-artifacts/deferred-work.md` — updated (Task 8.1/8.2/8.3/8.4)
- `docs/migration-decisions.md` — updated (Task 8.5, changelog row)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — updated (`2-2-…` → `review`)

No files under `src/`, no `package.json`/Dockerfile changes. Probe branch `probe/2-2-push-trigger`
was created, pushed, exercised, and deleted (local + remote) entirely within this session; it does
not appear in the final tree.

---

## Open Questions for Review

### Resolved this session

1. **`has_pull_requests`.** Decided by Oleg (repeated explicitly in this session's brief): stays
   `false`. Reconfirmed live 2026-08-13 — `repo_unit` for repo 16 has no row of `type = 3`. Not
   flipped, not PATCHed. AC2/AC3 close as «не проверено» — the acceptable outcome the story itself
   named.
2. **Which branches carry `ci.yml` (§2, Task 2.2).** Decided: **`main` only, for now.**
   Propagating to `staging`/`development` was recommended by the story but declined this session
   because it means two more pushes to protected, CD-triggering branches, and this session's writes
   to `main`/`staging`/`development` were scoped to the single reviewed change already staged on
   `main`. **Consequence recorded, not hidden:** a feature branch cut from `staging` or
   `development` today gets no CI, silently. Open item for the parent or a follow-up story.
3. **`branches-ignore` support on Forgejo 15.0.5+gitea-1.22.0.** **Proven supported**, not assumed
   — see the mechanism-proof row in Debug Log References (a push naming its own branch in
   `branches-ignore` produced zero runs for this repository; the identical push without that line
   produced one, within ~8 seconds).

### Still open

4. ~~**The literal negative control on `main` itself.**~~ ✅ **CLOSED 2026-08-13 by `fed828d1`** — the commit landed on `main` with the trigger armed in that very commit, and zero runs exist for its SHA (checked by SHA, not by absence from a listing); `refs/heads/main` has never produced a run. Verified again by review.
5. **`ci.yml` is still `main`-only (§2, Task 2.2's declined half).** Propagation to `staging`/
   `development` was recommended but not executed this session (see item 2 above). A feature
   branch cut from either produces silence, not an error, until this is revisited.
6. **The 497 uncovered branches (`deferred-work.md:122-129`) remain outside every story's scope.**
   This story makes their PR path *reachable* if `has_pull_requests` is ever turned on. Someone
   should own bulk remediation before Story 2.5 opens five real pull requests.
7. **Run arrival rate vs. host budget.** Story 2.4 owns the 15-minute per-run budget; nothing owns
   runs-per-day on a host at load 11–17 with 7.2 GiB free. AC5 records an estimate (up to ~16 runs/week, floor corrected by review);
   it does not assign an owner. Story 4.2 is the closest candidate (`deferred-work.md:141-146`).
8. **`development` has no branch protection** (`migration-decisions.md:579-580`) while `main` and
   `staging` do. If push triggers make `development` a CI-bearing ref (once propagated), that
   asymmetry is worth a decision rather than an accident.
9. **No cancel endpoint exists in this API version** (`migration-decisions.md:581-585`). Once
   triggers are armed, an accidental run costs ~468–487 s of a shared host with no stop button.
   Worth knowing before Story 2.5 opens five PRs.
