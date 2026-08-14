---
baseline_commit: 8e10a6fa
---

# Story 2.5: Validate CI Stability Across Five Consecutive Real Pull Requests

Status: ready-for-dev

> **This story spends more shared infrastructure than any story before it, and it is the only story
> in Epic 2 whose deliverable can be faked without anyone noticing.** Ten CI runs, ~85 minutes of
> wall clock, ~9200 job-seconds on a host that carries another tenant's production — and the output
> is a table that says "green, green, green, green, green". The failure mode is not missing the
> target. It is **producing that table without the runs behind it being what the AC describes**:
> reruns quietly not counted, a flake reclassified as "a code thing", a branch cut from the wrong
> place, or the pipeline edited halfway through so the five runs are not five runs of the same
> pipeline.
>
> **Everything that makes this story hard is in §1–§8. Read them before the ACs.**

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a tech lead,
I want evidence that Forgejo CI is stable on real work before it can block merges,
so that turning on required checks does not turn a flaky pipeline into a delivery outage.

---

## 🚨 Read this before anything else

### 1. 🔴 The pipeline is unblocked, the budget is met, and the only open question is *stability*

Everything this story depends on is already in place and measured. Nothing here needs to be built.

| Precondition | State | Source |
|---|---|---|
| `pull_request` trigger armed on `ci.yml` | ✅ live, `branches: [main]`, added 2026-08-14 | `ci.yml:47-57` |
| `push` trigger armed | ✅ live, `branches-ignore: [main, staging, development]` | `ci.yml:41-46` |
| `has_pull_requests` (repo PR unit) | ✅ **ON, and staying on** — Oleg, 2026-08-14 | `deferred-work.md:825-833` |
| PRs actually work end to end | ✅ proven — PR #2, runs 513–516, 4/4 green ×4 | `2-2-…md:760-780` |
| Two runners online, `node-20`, capacity 2 each | ✅ | D10, D13, `2-4-…md:909-920` |
| 15-minute budget | ✅ **513 s against 900 s — 387 s (43%) of margin** (run 534, warm) | `2-4-…md`, `deferred-work.md:946-953` |
| Evidence route (`ssh root@10.67.0.1` → `psql`) | ✅ used first-hand by Stories 1.12, 2.4, 3.1 — key-based, no password | `2-4-…md`, `1-12-…md:539`, `3-1-…md:706` |
| API token for PR create/merge | ✅ `fe_tmp_1_7`, host-local on s1 at `/root/.fj_token`, mode 600 | `deferred-work.md:298-306` |
| The flaky test that threatened this story | ✅ **fixed** at `54322fdd`; 5 consecutive full-suite runs green after the fix, against 2 failures in 6 before | `deferred-work.md:670-682` |

**So the story is not "make CI stable". It is "run CI five times, under conditions that make the
result mean something, and record what happened."** The value is entirely in the *conditions*.

### 2. 🔴 "Five consecutive real pull requests" — what "real" has to mean here, and why

The epic says *"five consecutive **real** pull requests are opened in Forgejo"* (`epics.md:1205`).
Read literally that means five PRs from developers doing their day job. **That cannot happen.**

**D7: nothing is done on the GitHub side, and there is no mirror in either direction.** The team
still works on GitHub; Forgejo holds a lagging copy; pull requests are platform objects and are not
mirrored (`migration-decisions.md#d7`, `2-2-…md:740-744`). Waiting for a developer to open a real PR
in Forgejo is waiting for something the migration has not reached yet — Epic 7 is where that lands.

**The word "real" is therefore doing a different job than it looks like.** It is there to rule out
the cheap way to satisfy this AC: five throwaway commits that touch nothing, pushed to five probe
branches, opened and closed. That proves the runner is alive and nothing else.

**Binding definition for this story. A pull request counts as *real* when all five hold:**

1. It is opened **in Forgejo**, against **`main`**.
2. Its branch is cut from **current `main` HEAD** at the moment of cutting (§3 — this is a safety
   requirement, not a formality).
3. It carries a change **that would have been committed to `main` anyway** — it has independent
   value and survives on its merits if this story never existed.
4. It is **merged** into `main`, not closed. A PR that is opened, watched, and thrown away is a
   probe with extra steps.
5. It is opened, run, and merged **before the next one is cut** — strictly sequential (§6).

> **This is a deviation from the epic's literal wording and it is stated, not hidden.** Record it in
> the Dev Agent Record as such, with this reasoning. Do not quietly redefine "real" downward and do
> not silently claim the literal reading was met.

**Where the five real changes come from.** This project commits to `main` several times per story;
that flow is the supply. Candidates, each independently worth landing:

- this story file's own progress records (Dev Agent Record, task checkboxes, evidence table);
- `deferred-work.md` — the handoff entries this story owes Story 2.6;
- `docs/migration-decisions.md` — the changelog row every story adds;
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status transitions;
- any genuinely pending documentation correction found along the way.

**One change per PR.** Do not batch. Do not pad. If the fifth PR has nothing honest to carry, **stop
and say so** rather than inventing a fifth change — an invented change makes the PR synthetic, which
is exactly what the definition above exists to prevent.

⚠️ **A docs-only PR still exercises the whole pipeline.** All four jobs run on every commit
regardless of what changed — `Unit Tests` runs the full 1921-test suite whether the diff touched
`src/` or a markdown file. For this story's purpose (does the pipeline behave the same way five times
in a row) a docs-only PR is a complete test. It is *not* a test that CI catches bad code; that was
Story 2.1's job and it is closed.

### 3. 🔴 Every branch must be cut from current `main`, and this is a safety requirement

**497 of 501 remote branches carry an executable legacy `.github/workflows/CI.yml` at their head.**
D9's suppression — the `.forgejo/workflows/` placeholder that stops Forgejo falling through to
`.github/workflows/` — is resolved **at the commit being run**, not at `main`
(`deferred-work.md:825-849`, `migration-decisions.md#d9`).

**Consequence:** a PR opened from one of those 497 branches runs `.github/workflows/CI.yml` — four
jobs on `ubuntu-latest`, which on this instance resolves to **`ci-hub`, another team's runner**. Oleg
has said plainly it must not be triggered (*"ci-hub не надо запускать"*, `deferred-work.md:126-129`).

The four PR runs of 2026-08-14 avoided this **only because the probe branch was cut from current
`main`** (`deferred-work.md:836-838`). Nothing in the repository prevents the other outcome. The
guard is procedural and it is yours: **cut from `main`, verify the head before pushing, every time.**

⚠️ **Related and separate:** `ci.yml` lives on **`main` only** — `staging` and `development` carry
only the placeholder README (`2-2-…md:824-829`, `:838-840`). A branch cut from either produces **no
CI run at all, silently — no error, just nothing.** Cutting from `main` also avoids this. There is no
scenario in this story where cutting from anything other than `main` is correct.

### 4. 🔴 The five runs must be five runs of *the same pipeline*, or they are not consecutive

This is the most easily broken and least obvious requirement in the story.

"Five consecutive green runs" is a claim about **one pipeline behaving the same way five times**. If
`ci.yml`, `vitest.config.ts`, `package.json`, `package-lock.json` or anything under `src/` changes
between PR 2 and PR 3, then PRs 1–2 measured one pipeline and PRs 3–5 measured a different one, and
the sequence is worth nothing.

**Rule: any change to the pipeline definition or to the code under test resets the counter to zero.**
This is why §2's PR content list is documentation and story artefacts — they are outside the
pipeline's inputs by construction. If a change to `ci.yml` becomes genuinely necessary mid-story,
that is a finding: make the change, record why, and **start the count over from one.**

### 5. 🔴 Three failure classes, not two — and the epic only names two

AC2 splits failures into *"an infrastructure reason rather than a code reason"* (`epics.md:1209`).
**That binary has a hole in the middle, and the thing that falls through it is the exact thing this
story exists to detect.** A flaky test is neither: the code is fine (it passes on a re-run) and the
infrastructure is fine (nothing was down). Under a two-way split it gets filed as "a code thing",
the counter does not reset, and the story certifies a pipeline that fails one run in three. **That is
the precise failure this repository already lived through** — `DocumentUploadModal.test.tsx` failed
2 runs in 6 on 2026-08-13, with all 1921 tests passing, and *"both CI runs in Story 2.1 happened to
be green, which is what a 33% flake looks like when you sample twice"* (`deferred-work.md:675-682`).

**Use this taxonomy. Classify before you continue, and record the classification with its evidence.**

| Class | What it looks like | Effect on the count |
|---|---|---|
| **Infrastructure** | No runner picked the job up; runner or `dind` died mid-run; network failure reaching `git.crm-prionex.com`, the npm registry, or `code.forgejo.org` (action download); cache server unreachable; host OOM-kill (**not** a `NODE_OPTIONS` heap error, which is code); run exceeded 900 s under host contention; Forgejo aborted the run for a non-user reason | 🔴 **Counter resets to zero.** Root-cause and fix before continuing — AC2 requires it |
| **Flake** | A job failed and the **identical commit** is green on a re-run, **or** the failure does not reproduce locally at that exact SHA, **or** it is an unhandled error with every test passing | 🔴 **Counter resets to zero.** Root-cause before continuing. **Not** a code failure |
| **Code** | Lint/format violation, `tsc` error, a genuine failing assertion, a build error — **and it reproduces locally at that SHA** | ⚪ Counter does **not** reset; that PR does not count toward the five. CI behaved correctly |

**Two guards on the "code" class, because it is the escape hatch that would make AC1 unfalsifiable:**

- **"Reproduces locally at that SHA" is mandatory evidence, not an impression.** Check the commit
  out, run the failing command, record the output. No local reproduction → it is a **flake**.
- **At most one code-class exclusion across the whole story.** A second one means either the
  changes are careless or the classification is wrong. **Stop and escalate** rather than excluding a
  third.

### 6. 🔴 What one PR costs, what five cost, and why they are sequential

**One commit on a PR branch produces TWO runs** — one `push` (branch ref), one `pull_request`
(`refs/pull/N/head`). Measured 2026-08-14 across runs 513–516: **~964 s of wall clock and ~1620
job-seconds for a single commit** (`deferred-work.md:851-854`, `2-2-…md:787-791`). FR2 asks for both
triggers; this is the price of the requirement as written, not a misconfiguration.

🔴 **The two runs do not overlap — they queue, and that is why one PR costs ~16 minutes rather than
~8.** Each run is four jobs; there are only **four job slots** across the two runners (capacity 2
each). The `push` run fills all four, and the `pull_request` run waits. The measured 964 s is
461 s + 503 s **summed**, not `max()` — runs 513 and 514 on the same commit `839e9051`
(`2-2-…md:766-771`). **Plan the session around ~16 min per PR, not ~8.**

| | |
|---|---|
| Runs per PR (one commit) | **2** |
| Wall clock per PR | **~964 s** (~16 min) — the two runs **queue**, they do not overlap |
| Job-seconds per PR | **~1840** at the current ~920/run |
| **Five PRs, zero resets** | **10 runs, ~80–85 min wall clock, ~9200 job-seconds** |
| Each reset | +2 runs, +~16 min, and the count restarts from **one** |

**Sequential, one PR at a time.** Two reasons, both binding: (a) "five **consecutive**" is a claim
about a sequence, and overlapping PRs have no sequence; (b) there are only **four job slots** across
two runners at capacity 2 — two concurrent PRs put 16 jobs into 4 slots, and every duration measured
becomes a measurement of queueing rather than of the pipeline, which destroys AC3's evidence.

**There is no cancel endpoint.** `POST .../actions/runs/{id}/cancel` returns 404 against the full
swagger spec (`deferred-work.md:82-86`, `migration-decisions.md:581-585`). A run started by mistake
runs to completion — ~510 s of a shared host with no stop button. **Declare the budget in Task 2
before spending any of it** (the standing discipline: Story 2.1 declared 2 and spent 2; Story 2.4
declared 1 and spent 1).

### 7. 🔴 "Without manual reruns" is the load-bearing half of AC1, and it needs an operational rule

*"all five produce green CI runs without manual reruns"* (`epics.md:1206`). Operationally:

- **A run must be green on its first and only execution.** Do not use Forgejo's *Rerun*.
- **Pushing a new commit to fix a red run is not a rerun** — it is a new commit and produces new
  runs bound to a new SHA. That is legitimate; whether the *old* red run resets the counter is
  decided by §5's taxonomy, not by the fact that a fix followed.
- **The one sanctioned re-run is diagnostic, not corrective**: §5 says a flake is identified by
  re-running the identical commit. If you do that, the re-run is **evidence, not a retry** — the
  counter has already reset by then. Record it as diagnostic.
- **Restarting a runner or its `dind` to get a green run is infrastructure intervention**, which
  means the failure was infrastructure-class, which means the counter reset. It does not launder.

### 8. 🔴 Evidence comes from the database. There are no job logs, and this story hands its evidence to 2.6

**Job logs are unretrievable on this instance** — 404 on `actions/jobs/{id}/logs`,
`actions/runs/{run}/jobs/{id}/logs` and `actions/tasks/{id}/logs`; `log_in_storage` stays `f` even
where `log_length` is recorded (`deferred-work.md:651-662`, `2-4-…md`). Every number in this file
must come from **the database, the filesystem, or a runner container log** — never from step output.

**Route** (`2-4-…md`, `1-12-…md:539`, `3-1-…md:706`):

```
ssh root@10.67.0.1 'docker exec -i forgejo-postgres psql -U forgejo -d forgejo -c "<SQL>"'
```

- `repo_id` for `CRM/fe-prionex` = **16** — re-confirm, do not hardcode from here.
- Tables: `action_run`, `action_run_job`, `action_task`, `commit_status`, `pull_request`.
- ⚠️ **Trap, and it cost Story 2.4 a wrong first query:** the "run numbers" cited everywhere in this
  repository (492, 505, 513–516, 522, 531, 534) are **`action_run.id`** — the global row id — **not
  the per-repo `index`.** Querying by `index` for those numbers returns 0 rows. Record both columns
  for every run this story creates so the ambiguity dies here.
- ⚠️ **Verify column names against the live schema before building a query on them.** A Haiku
  subagent in Story 2.2 assumed a `has_pull_requests` column that does not exist (Forgejo keys unit
  enablement through `repo_unit` by `type`), hit a real error, and **stopped instead of guessing** —
  that is the required behaviour (`2-2-…md:696-703`).

🔑 **The free deliverable for Story 2.6.** AC3 says the evidence matters *"since enabling required
status checks depends on it"* (`epics.md:1217`). Story 2.6 must choose among **eight** status
contexts, not four — statuses are named per event, so `CI / Lint (push)` and `CI / Lint
(pull_request)` are different contexts, and marking the wrong set produces a gate that either never
goes green or never blocks anything (`deferred-work.md:855-859`, `2-2-…md:793-796`,
`epics.md:1229-1239`). **These ten runs produce those context strings as a by-product.** Harvest them
from `commit_status` verbatim — exact strings, per event, bound to head SHAs — and hand them over.
That closes the hardest part of 2.6's amended AC1 at zero extra cost, and it is the difference
between 2.6 typing context names from job names (which the amendment explicitly forbids) and reading
them off real rows.

---

### Prohibitions

🚨 **A prohibition here cannot be overridden by a subtask.**

1. **Do not edit `.forgejo/workflows/ci.yml`** — not the triggers, not the jobs, not a `concurrency`
   block. §4: changing the pipeline mid-count invalidates the count. Triggers are Story 2.2's
   deliverable and are already correct.
2. **Do not edit `vitest.config.ts`, `package.json`, `package-lock.json`, or anything under `src/`.**
   §4. A red test run is a **finding**, not a licence to edit the suite — Story 2.4 carried the same
   prohibition for the same reason.
3. **Do not cut a branch from anything except current `main`.** §3 — `ci-hub` and silent no-CI both
   live down that path.
4. **Do not use Forgejo's "Rerun"** to turn a red run green. §7.
5. **Do not classify a non-reproducing failure as a code failure.** §5 — that is the flake class and
   it resets the counter.
6. **Do not run two PRs at once.** §6 — four job slots; concurrency destroys AC3's durations.
7. **Do not open a PR from any pre-existing branch.** §3 — 497 of 501 carry the legacy workflow.
8. **Do not read, quote or promise any number from a job log.** §8 — logs reach neither API nor disk.
9. **Do not spend an unbudgeted run.** §6 — declare in Task 2 first; there is no cancel endpoint.
10. **Do not change any runner configuration and do not take a runner offline.** Failover under
    required checks is **Story 2.6 AC6's** experiment, not this story's. Reading `config.yml`,
    `.runner` and `docker logs` is expected; writing is not.
11. **Do not touch `.github/workflows/`.** D7; Story 7.2 owns those files. Bulk remediation of the
    497 branches is **not** this story's job — §3's procedural guard is sufficient for five PRs cut
    from `main`, and that is the recorded scope boundary.
12. **Do not flip `has_pull_requests`.** It is ON by Oleg's decision of 2026-08-14
    (`deferred-work.md:825-833`). Turning it off is a decision, not cleanup.
13. **No `ubuntu-latest`** and **no `upload-artifact@v4`** in anything this story touches
    (another team's runner; `GHESNotSupportedError`, D12).

---

## Acceptance Criteria

Source: `epics.md:1196-1217`. Covers **NFR1** (`epics.md:235`: *"A full CI run completes in ≤ 15
minutes"*). Deviations from the epic's literal wording are named in each AC and justified in §1–§8.

**AC1 — five consecutive real pull requests produce green CI runs with no manual reruns, and every
run's duration is recorded.**
Given the `pull_request` and `push` triggers live from Story 2.2 (`ci.yml:40-57`) and the pull-request
unit enabled,
when five pull requests meeting §2's definition of *real* are opened against `main`, one at a time,
then **every run bound to each PR's head SHA is 4/4 green** — both the `push` run and the
`pull_request` run — with no use of *Rerun*,
and each run's wall-clock duration is recorded from `action_run.started`/`.stopped`, with its
`action_run.id`, `index`, `event`, `commit_sha`, and per-job durations from `action_run_job` /
`action_task`,
and the five PRs are merged into `main`.

> **Clarification, not deviation.** "Five pull requests" is five PRs, which is **ten runs** — each
> commit fires both triggers (§6). All ten must be green; a red `push` run beside a green
> `pull_request` run on the same SHA is a failed PR.

**AC2 — an infrastructure-class or flake-class failure resets the count, and the root cause is fixed
before continuing.**
Given any run in the sequence that is not green,
when it is classified using §5's three-class taxonomy with its evidence recorded,
then an **infrastructure** or **flake** classification **resets the consecutive counter to zero**,
and the root cause is identified and fixed before the count restarts,
and a **code** classification excludes that PR from the count without resetting it — **only** where
the failure is shown to reproduce locally at that exact SHA, and **at most once** in this story.

> **Deviation, stated.** The epic names two classes (`epics.md:1209`); this story uses three. §5
> gives the reason: the two-class split files a flaky test under "code", and a flaky test is the
> exact defect this story exists to detect. This is the story's most consequential judgement call.

**AC3 — no run exceeded the 15-minute budget, and the evidence is recorded for Story 2.6.**
Given five green consecutive pull requests,
when the ten durations are reviewed against the 900 s budget from Story 2.4,
then **none exceeded 900 s**, stated per run rather than as an average,
and the spread is compared against Story 2.4's baseline (513–558 s, ±45 s of host-load noise —
`deferred-work.md:946-953`), with any run outside that band flagged rather than smoothed,
and the evidence is recorded in this file and handed forward in `deferred-work.md`.

**AC4 — the eight status-check contexts are harvested verbatim and handed to Story 2.6.**
Given ten runs across five head SHAs,
when `commit_status` is queried for those SHAs,
then the **exact context strings** are recorded per event — expected `CI / {Lint,Type Check,Unit
Tests,Build}` in both `(push)` and `(pull_request)` forms, eight in total — read off real rows, not
transcribed from job names,
and each is recorded with its `state` and the SHA it bound to,
and any discrepancy between the expected eight and what the rows actually show is reported as a
finding.

> **Addition, stated.** This AC is not in the epic. It exists because `epics.md:1217` makes this
> story's evidence the precondition for Story 2.6, and `epics.md:1236-1239` requires 2.6 to verify
> context names *"against `commit_status` rows from a real run rather than typed from the workflow's
> job names"*. These runs are those real runs. Collecting the strings now costs one query; not
> collecting them costs Story 2.6 a run.

---

## Tasks / Subtasks

### Task 1 — Bind the facts before spending anything (AC: 1, 2, 3)

- [x] 1.1 Confirm the working tree is clean and at `main` HEAD (`8e10a6fa` at story-creation time;
      re-read it, do not assume). Record the SHA every branch will be cut from.
- [x] 1.2 Confirm `.forgejo/workflows/ci.yml` matches Dev Notes: four jobs, all `runs-on: node-20`
      (`:67`, `:91`, `:110`, `:252`), `test` runs `npm run test:coverage:ci` (`:160`), triggers at
      `:40-57` with `pull_request: branches: [main]` present. **If any of this differs, stop** — §4.
- [x] 1.3 Confirm the repository pull-request unit is enabled: `repo_unit` for repo 16 carries a row
      of `type = 3`. Read-only (Prohibition 12). Record the value and the timestamp.
- [x] 1.4 Confirm both runners are online, still carry `node-20`, still report `capacity: 2` —
      read-only (Prohibition 10). Route: `ssh root@10.67.0.1`, `docker logs forgejo-runner-fe-prionex`
      and `…-2`, config under `/opt/forgejo-runner-fe-prionex/`.
- [x] 1.5 Re-confirm `repo_id` for `CRM/fe-prionex` (expected **16**) and record `max(id)`,
      `max(index)` and `count(*)` from `action_run` as the run-budget baseline, **before creating
      any run**.
- [x] 1.6 Verify the columns you intend to query exist, against the live schema:
      `\d action_run`, `\d action_run_job`, `\d action_task`, `\d commit_status`, `\d pull_request`.
      Do not build a query on an assumed column (§8).
- [x] 1.7 Record host state before spending: load average and free memory on s1. Story 2.4 recorded
      load 11–17 / ~7.2 GiB free; this story spends ~5× what 2.4 did.
- [x] 1.8 Confirm both access routes work **before** opening PR 1, so a failure surfaces at zero cost
      rather than with a PR half-open: (a) `ssh root@10.67.0.1` reaches the host and
      `docker exec -i forgejo-postgres psql …` answers; (b) the token at `/root/.fj_token` is still
      valid — `GET /api/v1/repos/CRM/fe-prionex` returns 200. Do **not** copy the token into any
      repository file, this story file included.
- [x] 1.9 Read `main`'s branch protection settings (read-only) and record them, so Task 3.8's merge
      attempt has a stated expectation rather than a surprise. This is also the state Story 2.6
      starts from.

### Task 2 — Declare the budget and the plan before spending either (AC: 1, 3)

- [x] 2.1 State, in writing in the Dev Agent Record **before creating any run**: five PRs, one commit
      each, **10 runs expected**, ~9200 job-seconds, ~80–85 min wall clock, plus the cost of any
      reset (+2 runs each). Match the discipline of Stories 2.1 (declared 2, spent 2) and 2.4
      (declared 1, spent 1).
- [x] 2.2 Name the five changes each PR will carry, against §2's definition, **before opening PR 1**.
      If you cannot name five honest changes, say so now rather than at PR 5 — §2.
- [x] 2.3 State the branch-naming scheme and confirm each will be cut from `main` HEAD (§3).
- [x] 2.4 Record the classification rule from §5 verbatim into the Dev Agent Record, so the taxonomy
      is fixed **before** a red run makes it tempting to reinterpret.

### Task 3 — Run the sequence, one PR at a time (AC: 1, 2)

**Repeat 3.1–3.9 five times. Do not start PR N+1 until PR N is merged.**

- [ ] 3.1 Cut the branch from **current `main`** and verify its head SHA equals `main`'s (§3).
- [ ] 3.2 Commit exactly one change (§2). Push the branch — this fires the `push` run.
- [ ] 3.3 Open the pull request against `main` — this fires the `pull_request` run.
      **Method:** `POST /api/v1/repos/CRM/fe-prionex/pulls` with
      `Authorization: token $(cat /root/.fj_token)` from s1, body `{"head":"<branch>","base":"main",
      "title":…,"body":…}`. This route is proven — Story 1.13 created PR #1 and Story 2.2 created
      PR #2 through it. Record the returned PR `index`. The web UI is an acceptable fallback; if you
      use it, say so, because a UI action is not reproducible from this record.
- [ ] 3.4 Record both runs from the database: `id`, `index`, `event`, `ref`, `commit_sha`, `status`,
      `started`, `stopped`, wall clock; and per-job `action_run_job` / `action_task` rows with
      `runner_id` and durations. **Do not read durations from the web UI** (§8).
- [ ] 3.5 Confirm `workflow_id` is `ci.yml` for **both** runs. A run of `.github/workflows/CI.yml`
      here means §3's guard failed — **stop, do not continue the sequence, record it as
      infrastructure-class** and report to Oleg (`ci-hub` was triggered).
- [ ] 3.6 If either run is not 4/4 green: classify per §5, record the evidence (including the local
      reproduction attempt for any code claim), apply the counter rule from AC2, and **stop the
      sequence** until the root cause is fixed. Do not use *Rerun* (Prohibition 4).
- [ ] 3.7 Query `commit_status` for the head SHA and record every context string verbatim with its
      `state` (AC4). Do this per PR — the strings are cheap now and expensive to reconstruct later.
- [ ] 3.8 Merge the PR into `main`. **Method:**
      `POST /api/v1/repos/CRM/fe-prionex/pulls/{index}/merge`, same token.
      ⚠️ **`main` carries branch protection** (`migration-decisions.md:579-580`) and no story has yet
      merged a PR into it through the API — **this is the first time.** If the merge is refused,
      **that is a finding, not a blocker**: record the exact error, hand it to Story 2.6 (which owns
      branch protection), and ask Oleg to merge. Do **not** work around it by force-pushing to `main`
      or by disabling protection.
- [ ] 3.9 Confirm the merge produced **no run** — `main` is in `branches-ignore` (`ci.yml:41-46`).
      Check by SHA, not by absence from a listing; `refs/heads/main` has never produced a run and
      that invariant was established at `fed828d1` (`2-2-…md:754`). A run here is a finding.

### Task 4 — Evaluate against the budget (AC: 3)

- [ ] 4.1 Tabulate all ten runs: id, index, event, SHA, PR number, four job durations, whole-run wall
      clock, runner ids per job.
- [ ] 4.2 State pass/fail against 900 s **per run**, not on the average. Report min, max, mean.
- [ ] 4.3 Compare the spread against Story 2.4's 513–558 s baseline. Flag any run outside it and say
      whether the explanation is host load (check the `started` timestamp against host load) or
      something else. Do not smooth an outlier into an average (`deferred-work.md:946-953`).
- [ ] 4.4 Record whether `push` and `pull_request` runs for the same SHA differ systematically —
      Story 2.2 measured 461 s vs 503–510 s, i.e. the PR run ran ~45 s slower on the same commit
      (`2-2-…md:766-771`). Five paired observations either confirm that as real or dissolve it into
      noise. State which, and label it measured, not computed.
- [ ] 4.5 Record job→runner distribution across ten runs. Story 2.4 saw a clean 2/2 split on nine
      runs; ten more either confirm it or find the exception.

### Task 5 — Harvest the status contexts for Story 2.6 (AC: 4)

- [ ] 5.1 Collate the `commit_status` rows from Task 3.7 across all five head SHAs.
- [ ] 5.2 List the **distinct** context strings with their event. Expect eight. **Report the actual
      count**, whatever it is.
- [ ] 5.3 If the count is not eight, or the strings differ from `CI / {Lint,Type Check,Unit
      Tests,Build}` in `(push)`/`(pull_request)` form, that is a finding for Story 2.6 and for
      `epics.md:1229-1239` — record it prominently, do not normalise it.
- [ ] 5.4 Record whether every context reached a terminal `state` on every run, and whether any run
      produced a context that no other run produced.

### Task 6 — Record and hand forward (AC: all)

- [ ] 6.1 Write the full evidence table into this file's Dev Agent Record: ten runs, provenance for
      every number, and the declared-vs-spent budget reconciliation.
- [ ] 6.2 Record the §2 deviation on "real" explicitly, with its reasoning, in the Completion Notes.
- [ ] 6.3 Record the §5 three-class taxonomy as used, including any classification actually made and
      the evidence behind it. If no run failed, say that plainly — an unexercised taxonomy is still
      worth recording, because Story 2.6 inherits it.
- [ ] 6.4 Add a `## Handed to Story 2.6 by Story 2.5` section to `deferred-work.md` carrying: the
      eight context strings verbatim, the budget verdict, the paired `push`/`pull_request` finding,
      the 497-branch hazard restated in 2.6's terms (**a PR from a stale branch produces legacy CI
      contexts and never the `CI /` ones — once required checks are on, such a PR can never go
      green**), and anything Task 5.3 found.
- [ ] 6.5 Add the changelog row to `docs/migration-decisions.md` per the standing convention.
- [ ] 6.6 If any AC could not be closed, record it as deferred with the reason — the acceptable
      outcome. Do not close an AC you did not close.

### Task 7 — Close (AC: all)

- [ ] 7.1 Update `sprint-status.yaml`: `2-5-validate-ci-stability-across-five-consecutive-real-pull-requests` → `review`.
- [ ] 7.2 Confirm the File List is complete and that nothing under Prohibitions 1, 2, 10, 11, 13 was
      touched.
- [ ] 7.3 Confirm every branch created was merged or deleted, and that no PR is left open.

---

## Dev Notes

### Exact source facts (verified at `8e10a6fa`)

| Fact | Value | Source |
|---|---|---|
| Triggers | `workflow_dispatch`; `push` with `branches-ignore: [main, staging, development]`; `pull_request` with `branches: [main]` | `ci.yml:40-57` |
| Jobs | `Lint`, `Type Check`, `Unit Tests`, `Build` — four, independent, all `runs-on: node-20` | `ci.yml:60`, `:90`, `:109`, `:251` |
| Test command | `npm run test:coverage:ci` — single pass, heap 16384 MB | `ci.yml:160` |
| Artifacts | `peak-memory-<N>mb` (7 d), `coverage` archived to one file (7 d), `dist` (1 d), all `upload-artifact@v3` | `ci.yml:213-248`, `:296-300` |
| `concurrency` block | **absent, deliberately** — Forgejo auto-cancels an earlier run of the same workflow on the same ref for `push` by default | `ci.yml:28-32`, D8 |
| `ci.yml` branch coverage | **`main` only.** `staging`/`development` carry only the placeholder README | `2-2-…md:824-829`, `:838-840` |

### Measured baseline this story is checked against

| Run | Event | Lint | Type Check | **Unit Tests** | Build | **Whole run** | Source |
|---|---|---|---|---|---|---|---|
| 505 | push | 143 s | 86 s | 467 s | 113 s | 468 s | `2-2-…md` |
| 513 / 515 | push | — | — | 460 s | — | **461 s** | `2-2-…md:766-771` |
| 514 / 516 | pull_request | — | — | — | — | **503 s / 510 s** | `2-2-…md:766-771` |
| 522 | push, with coverage | 154 s | 99 s | **539 s** | 126 s | **540 s** | `2-4-…md` |
| 531 | push | — | — | — | — | 558 s | `deferred-work.md:946-953` |
| **534** | push, warm | 139 s | 86 s | 512 s | 111 s | **513 s** | `2-4-…md` |

**900 s budget, 387 s (43%) of margin at the last measurement.** `Unit Tests` is **96–99.8% of the
critical path on every one of the nine runs measured** — the other three jobs finish inside its
shadow. The ±45 s spread on an unchanged pipeline is **host-load noise, not a trend**
(`deferred-work.md:946-953`).

⚠️ **The margin is shrinking and nothing watches it.** Story 2.3's coverage instrumentation cost
+72–79 s — a fifth of the margin — in one story. No mechanism flags a budget regression before it
lands. Not this story's to fix; this story's ten data points are the closest thing to a trend line
that exists, so record them cleanly.

### Infrastructure facts

| Fact | Value | Source |
|---|---|---|
| Runners | `s1-fe-prionex-1` (id 19, `192.168.226.3`), `s1-fe-prionex-2` (id 20, `192.168.226.4`), both on s1, repository-scoped | D10, D13, `2-4-…md:909-920` |
| Labels | `node-20:docker://node:20-bookworm`, `docker-build:docker://…docker:cli` | D10, D13 |
| Capacity | **2 concurrent jobs each — four slots total** | `1-7:427`, `1-9:247` |
| Foreign runners on the instance | `ci-hub` (`ubuntu-latest`), `s1-build-crm`, `s1-deploy-dev-preprod` — **another team's, must not be triggered** | `sprint-change-proposal-2026-08-07-runners.md`, `deferred-work.md:126-129` |
| Host s1 | 104 cores, ~125 GiB RAM, load **11–17**, ~7.2 GiB free, shared with another tenant's production | `2-4-…md:909-920` |
| Cancel endpoint | **none** — 404 against the full swagger spec | `deferred-work.md:82-86` |
| Job logs | unretrievable — 404 on three API routes; `log_in_storage` stays `f` | `deferred-work.md:651-662` |
| Artifacts API | **none** — 404; the web route works and is session-gated (a developer can download, an agent cannot) | `deferred-work.md` (SETTLED 2026-08-14) |
| DB route | `ssh root@10.67.0.1` → `docker exec -i forgejo-postgres psql -U forgejo -d forgejo`; `repo_id` **16** | `2-4-…md`, `1-12-…md:539`, `3-1-…md:706` |
| API token | `fe_tmp_1_7`, host-local at `/root/.fj_token` on s1, mode 600, `Authorization: token …`. **Never written into repository files** | `1-7` review, `deferred-work.md:298-306` |

### Anti-patterns for this story

- **Opening five throwaway PRs and calling them real.** §2 — that is the one thing "real" rules out.
- **Cutting a branch from a pre-existing branch, or from `staging`/`development`.** §3 — `ci-hub`
  gets triggered, or nothing runs at all and the silence looks like success.
- **Editing `ci.yml` or the test suite mid-sequence.** §4 — five runs of two different pipelines.
- **Filing a non-reproducing test failure as "a code thing".** §5 — that is the flake this story
  exists to catch, and the two-class wording in the epic invites exactly this mistake.
- **Clicking Rerun.** §7 — it is the one thing AC1 names as disqualifying.
- **Running PRs in parallel to save time.** §6 — 16 jobs into 4 slots; AC3's durations become
  queueing measurements.
- **Reporting the budget verdict as an average.** AC3 says *none exceeded*; an average of ten runs
  can hide one at 950 s.
- **Reading a duration from the web UI or a job log.** §8 — there is no log, and the UI is not the
  record. `action_run.started`/`.stopped` is.
- **Querying runs by `index` using the ids cited in this repository.** §8 — those are `id`. Story 2.4
  made this mistake first and corrected it before writing it down.
- **Taking a runner offline to see what happens.** That is Story 2.6 AC6's experiment. Doing it here
  manufactures an infrastructure failure and resets your own counter.
- **Bulk-remediating the 497 branches because §3 made them salient.** Prohibition 11 — out of scope,
  and cutting from `main` is sufficient for five PRs.

### Previous story intelligence

- **Story 2.1** established the four jobs, the `node-20` pin, the `@v3` artifact pin, the 16384 MB
  heap deviation recorded in the YAML rather than hidden, and the cold/warm pair 487/484 s.
- **Story 2.2** armed `push` and then `pull_request`, proved `branches-ignore` with a **negative
  control** (a push naming its own branch in `branches-ignore` produced zero runs; the identical push
  without that line produced one), and measured the two-runs-per-commit cost. It left `ci.yml` on
  `main` only. Its Open Question 6 named this story by name: *"Someone should own bulk remediation
  before Story 2.5 opens five real pull requests"* (`2-2-…md:841-843`) — §3 and Prohibition 11 answer
  it: procedurally, for five PRs, by cutting from `main`; not structurally, which stays deferred.
  Its Open Question 9 also named this story: *"an accidental run costs ~468–487 s of a shared host
  with no stop button. Worth knowing before Story 2.5 opens five PRs"* (`2-2-…md:850-852`).
- **Story 2.3** added coverage in one pass and measured its cost: **+72 s (+15%)**, the single largest
  change to this budget so far. It also recorded that an **auto-cancelled run still burns
  job-seconds** (~686 on run 520) — relevant here because a second push to a PR branch auto-cancels
  the first run and the cost is already spent.
- **Story 2.4** produced the budget number this story checks against, and established the evidence
  method: database first, runner container logs second, `bolt.db` for cache facts, and **never the
  job log**. It also recorded the `id`-vs-`index` trap (§8) and *"do not present arithmetic as
  measurement"*.
- **The standing method lesson** (`deferred-work.md:548-551`): *"job logs are unretrievable"* was
  once over-generalised into not reading the **server/runner** log either, and an answer sat in
  `docker logs` for eight hours. **Different things.**
- **Subagent lesson, twice recorded:** a Haiku subagent that hits a schema error and **stops instead
  of guessing** is behaving correctly (`2-2-…md:696-703`); a subagent report is not evidence until
  the coordinator re-runs the load-bearing query itself (`2-4-…md` Agent Model Used). Both apply
  here — every number in this story's evidence table must be verified first-hand.

### Testing standards

**This story adds no tests and changes no test configuration** (Prohibition 2). The suite is 228
files / 1921 tests, serial by config, and its role here is as the thing being run — ten times.

The flaky-test fix at `54322fdd` (`src/test/setup.ts`: explicit `cleanup()` plus a macrotask await in
`afterEach`, so Radix FocusScope unmount timers fire inside the realm that created them) is the
single reason this story is attemptable: before it, the suite failed roughly one run in three, which
made "five consecutive green" about a 13% proposition (`deferred-work.md:670-682`). It has since been
green on five consecutive local full-suite runs and on every CI run from 505 onward.

**These ten runs are the largest sample that fix has ever had.** If a test failure appears, it is a
finding of real value — treat it as §5's flake class, root-cause it, and do not reach for
`vitest.config.ts`.

### Project Structure Notes

Files this story is expected to touch:

- `_bmad-output/implementation-artifacts/2-5-…md` — this file (the primary deliverable).
- `_bmad-output/implementation-artifacts/deferred-work.md` — the handoff to Story 2.6 (Task 6.4).
- `docs/migration-decisions.md` — changelog row (Task 6.5).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status (Task 7.1).

Files this story must **not** touch: `.forgejo/workflows/ci.yml`, `vitest.config.ts`, `package.json`,
`package-lock.json`, anything under `src/`, `.github/workflows/`, and any runner configuration on s1.

**If this story finds itself editing `ci.yml`, something has gone wrong** — the triggers are correct,
and every reason to edit them is covered by a prohibition. If it is genuinely necessary, §4 applies:
the count restarts from one.

**Note on circularity, stated rather than hidden:** the changes carried by the five PRs are largely
this story's own artefacts. That is honest — they are changes that land on `main` regardless — but it
does mean the story writes its own record while producing it. Commit each PR's content as it is
known, not retroactively.

### References

- `epics.md:1196-1217` — Story 2.5 and its three ACs
- `epics.md:1219-1256` — Story 2.6, which this story gates; `epics.md:1227-1239` — the amended AC1 and
  the eight contexts
- `epics.md:235` — NFR1, *"A full CI run completes in ≤ 15 minutes"*; `epics.md:396` — traceability
- `epics.md:68` — the cost of both triggers, measured 2026-08-14 across runs 513–516
- `.forgejo/workflows/ci.yml:1-57` — name and triggers; `:60-300` — the four jobs
- `deferred-work.md:82-86` — no cancel endpoint
- `deferred-work.md:110-129` — the 497 branches carrying executable legacy workflows
- `deferred-work.md:298-306` — token model; an admin cannot revoke another account's token
- `deferred-work.md:548-551` — the runner-log-vs-job-log lesson
- `deferred-work.md:651-662` — job logs unretrievable
- `deferred-work.md:670-682` — the flaky test, its fix, and what it meant for this story
- `deferred-work.md:825-859` — pull requests stay enabled; the accepted risk; two runs per commit;
  eight contexts for Story 2.6
- `deferred-work.md:944-975` — Story 2.4's handoff to this story: the budget number and the margin
- `migration-decisions.md#d7` — no action on GitHub, no mirror in either direction
- `migration-decisions.md#d8` — Forgejo capabilities; job-level `concurrency` ignored; auto-cancel is
  the default; `migration-decisions.md:581-585` — no cancel endpoint
- `migration-decisions.md#d9` — `.forgejo/workflows/` suppresses legacy fallback, **per commit**
- `migration-decisions.md#d10`, `#d13` — the two runners, labels, capacity, per-runner cache
- `migration-decisions.md#d12` — per-action verdicts; `upload-artifact@v4` fails
- `2-2-…md:740-744` — the GitHub/Forgejo duplication analysis
- `2-2-…md:754`, `:760-799` — the `main` negative control; AC2/AC3 closure, runs 513–516, the eight
  contexts, the legacy-fallback warning, PR #2 cleanup
- `2-2-…md:824-829`, `:838-853` — `ci.yml` is `main`-only; Open Questions 5, 6, 9
- `2-2-…md:696-703` — the subagent schema-error lesson
- `2-4-…md` — the budget measurement, the evidence method, the `id`/`index` trap, the prohibitions
  this story inherits
- `1-12-…md:539`, `3-1-…md:706` — the database access route

---

## Dev Agent Record

### Agent Model Used

_To be filled by the dev agent. Record the coordinator model and any subagent use, per the convention
in Stories 2.2 and 2.4: a subagent's report is not evidence until the coordinator re-runs the
load-bearing query itself._

### Debug Log References

**Task 1 — facts bound 2026-08-14, ~19:13 CEST, before any run created:**

- **1.1** Working tree clean at story-open; only `sprint-status.yaml` (this story's own
  ready-for-dev→in-progress edit) and the untracked story file itself differ from HEAD. `git rev-parse
  HEAD` = `8e10a6faae25c019ebd8b8997ab69b816fd2c596`, matches the frontmatter `baseline_commit:
  8e10a6fa`. **Every branch this story cuts is cut from `8e10a6fa`** (re-verified per-branch at 3.1).
- **1.2** Read `.forgejo/workflows/ci.yml` in full. Confirmed: four jobs (`lint`, `typecheck`, `test`,
  `build`), all `runs-on: node-20`; `test` job runs `npm run test:coverage:ci` (`:160`); triggers
  `:40-57` — `workflow_dispatch`, `push` with `branches-ignore: [main, staging, development]`,
  `pull_request` with `branches: [main]`. Matches Dev Notes exactly. No stop condition triggered.
- **1.3** `select type, count(*) from repo_unit where repo_id=16 group by type` → 8 rows, types
  `{1,2,3,4,5,8,9,10}`. Type 3 (pull requests) present, count 1. Pull-request unit is enabled.
  Queried 2026-08-14T19:13Z.
- **1.4** `docker ps` on s1: `forgejo-runner-fe-prionex` (up 30h) + `forgejo-runner-fe-prionex-dind`
  (healthy, up 3d); `forgejo-runner-fe-prionex-2` (up 30h) + `-dind-2` (healthy, up 2d) — all four
  containers running. DB: `action_runner` rows 19 (`s1-fe-prionex-1`) and 20 (`s1-fe-prionex-2`), both
  `repo_id=16`, `agent_labels=["node-20","docker-build"]`, `last_online` 2026-08-14 17:15:3{6,7} UTC —
  under 2 minutes before the query, i.e. online now. (Two older/retired rows also present: id 15
  `probe-runner`, last online 2026-08-08; id 18 `s1-fe-prionex-1` superseded by id 19 — both stale,
  ignored.) `capacity` is not an `action_runner` column (confirmed against live schema, corrected the
  assumption before querying it) — it lives in `/opt/forgejo-runner-fe-prionex/config.yml` on the host:
  `capacity: 2`. One config file, two containers (`forgejo-runner-fe-prionex`,
  `forgejo-runner-fe-prionex-2`) each with their own `dind` sidecar — **four job slots confirmed.**
- **1.5** `select id from repository where owner_name='CRM' and name='fe-prionex'` → **16**, matches
  the story's stated expectation. `select max(id), max(index), count(*) from action_run where
  repo_id=16` → **max(id)=534, max(index)=44, count(*)=44**. This is the run-budget baseline; every
  run this story creates must have `id > 534`.
- **1.6** Schema dumped for all five tables via `\d`. Notable: `action_run` has both `id` (global,
  what every prior story's "run numbers" refer to — §8's trap) and `index` (per-repo); `commit_sha`,
  `event`, `started`, `stopped`, `ref`, `status`, `pull_request_id` all present as expected.
  `action_run_job` has `run_id`, `task_id`, `name`, `status`, `started`, `stopped` — no direct
  `runner_id` (join through `action_task.job_id` for that). `action_task` has `runner_id`, `started`,
  `stopped`, `log_in_storage`, `log_length` as expected. `commit_status` has `state`, `sha`, `context`,
  `context_hash`, `created_unix` as expected (unique on `(index, repo_id, sha)`). `pull_request` has
  `has_merged`, `merged_unix`, `head_branch`, `base_branch`, `issue_id`, `index` as expected. No
  assumed column was wrong except `action_runner.capacity` (1.4) — caught before use, per the
  Story 2.2 subagent lesson (stop instead of guessing).
- **1.7** `uptime` on s1: **load average 2.88, 3.84, 4.38**. `free -h`: **11 GiB free, 82 GiB
  available**, 42 GiB used, 74 GiB buff/cache, swap nearly idle (25 MiB of 8 GiB). This is
  substantially lighter than Story 2.4's load 11–17 / ~7.2 GiB free — favourable conditions, recorded
  as the pre-spend baseline, not assumed to hold for all ten runs.
- **1.8** (a) `ssh root@10.67.0.1` reached the host; `docker exec -i forgejo-postgres psql -U forgejo
  -d forgejo` answered every query above. (b) **Finding, not a blocker:** the first `GET
  /api/v1/repos/CRM/fe-prionex` with the raw file content as the bearer token returned **401** —
  `/root/.fj_token`'s content is `FJ_TOKEN=<hex>` (an env-file line), not a bare token string. Stripped
  the `FJ_TOKEN=` prefix (`cut -d= -f2-`) and the identical call returned **200** with
  `{"full_name":"CRM/fe-prionex","id":16,"default_branch":"main"}`. The token itself is valid and
  unchanged since Story 1.7; the file's storage format is what changed/was always this way. **Every
  API call in this story strips the `FJ_TOKEN=` prefix before use.** Token content was never printed
  in full to any transcript or file (`head -c 6` showed only `FJ_TOK`, confirming presence without
  disclosure); the Claude Code auto-mode classifier independently blocked one attempt to `cat` the
  token file outright, which is the correct outcome. Token stays host-local; not copied here.
- **1.9** `GET /api/v1/repos/CRM/fe-prionex/branch_protections` (read-only): `main` rule exists
  (`rule_name: "main"`, created 2026-08-10), but is **permissive**: `enable_push: true`,
  `enable_push_whitelist: false` (no whitelist restriction), `enable_merge_whitelist: false`,
  `enable_status_check: false`, `status_check_contexts: null`, `required_approvals: 0`,
  `apply_to_admins: false`, `require_signed_commits: false`. **Stated expectation for Task 3.8: the
  API merge is likely to succeed** — nothing in this rule blocks a push-capable token from merging;
  "protected" here does not yet mean "gated." (`staging` carries an identical permissive rule; not
  relevant to this story.) This is also exactly the starting state Story 2.6 inherits — AC6.5's
  required-checks work has not happened yet.

**Task 2 — declared 2026-08-14, before any run created:**

- **2.1 Declared budget.** Five PRs, one commit each, **10 runs expected** (one `push` + one
  `pull_request` per commit). At the current ~920 job-seconds/run baseline: **~9200 job-seconds,
  ~80–85 minutes of wall clock, spread across ~5 sequential ~16-minute PR cycles.** Each reset (an
  infrastructure- or flake-class failure, §5) costs **+2 runs, +~16 minutes, and restarts the
  consecutive count from one** — not from the PR that failed. Budget baseline before spend: `max(id)
  = 534`, `max(index) = 44`, `count(*) = 44` on `action_run` for repo 16 (Debug Log 1.5). This matches
  Story 2.1's declared-2/spent-2 and Story 2.4's declared-1/spent-1 discipline: **declared 10 (+2 per
  reset), to be reconciled against actual spend in Task 6.1.**
- **2.2 The five changes, named before PR 1 (§2's circularity, stated in Dev Notes: "commit each PR's
  content as it is known, not retroactively"):**
  1. **PR 1** — `_bmad-output/implementation-artifacts/sprint-status.yaml`: this story's own
     `ready-for-dev → in-progress` transition (already true and already made locally as of Task
     1/§2's writing — this is the sprint's accurate tracking record regardless of how the rest of the
     story turns out).
  2. **PR 2** — this story file: Task 1's bound facts and Task 2's declared plan (this section),
     committed as the record of work already done, plus PR 1's own run evidence (recorded after PR 1
     merges, before PR 2's branch is cut).
  3. **PR 3** — this story file: PR 2's run evidence, recorded after PR 2 merges.
  4. **PR 4** — this story file: PR 3's run evidence, recorded after PR 3 merges.
  5. **PR 5** — this story file: PR 4's run evidence, recorded after PR 4 merges.

  PR 5's own evidence, and the Task 4/5/6/7 synthesis (budget verdict, context-string harvest, the
  `deferred-work.md` handoff, the `migration-decisions.md` changelog row, the final `sprint-status.yaml`
  → `review` transition), are **not** carried by a sixth PR — AC1 requires exactly five PRs, and this
  repository's standing practice (visible in its own commit history) is to commit routine
  documentation and tracking updates directly to `main`, which is what Task 6/7 do. Every one of the
  five changes above is real, independently mergeable, and would land on `main` whether or not the
  rest of this story succeeded — satisfying §2's "real" definition, clause 3.
  **If PR 4 or PR 5 turns out to have nothing honest to carry (e.g. a reset collapses the evidence
  into fewer distinct commits), that will be stated plainly at the time rather than padded.**
- **2.3 Branch-naming scheme:** `story-2-5/pr-<n>-<slug>`, e.g. `story-2-5/pr-1-sprint-status-in-progress`.
  Every branch is cut from **current `main` HEAD** at the moment of cutting; the head SHA is verified
  against `git rev-parse origin/main` (after a fetch) immediately before `git checkout -b`, and again
  compared to the pushed branch's tip before opening the PR (§3, Prohibition 3, Prohibition 7 — never
  from a pre-existing branch).
- **2.4 Classification rule (§5), recorded verbatim before any run makes it tempting to reinterpret:**

  | Class | What it looks like | Effect on the count |
  |---|---|---|
  | **Infrastructure** | No runner picked the job up; runner or `dind` died mid-run; network failure reaching `git.crm-prionex.com`, the npm registry, or `code.forgejo.org` (action download); cache server unreachable; host OOM-kill (**not** a `NODE_OPTIONS` heap error, which is code); run exceeded 900 s under host contention; Forgejo aborted the run for a non-user reason | 🔴 **Counter resets to zero.** Root-cause and fix before continuing — AC2 requires it |
  | **Flake** | A job failed and the **identical commit** is green on a re-run, **or** the failure does not reproduce locally at that exact SHA, **or** it is an unhandled error with every test passing | 🔴 **Counter resets to zero.** Root-cause before continuing. **Not** a code failure |
  | **Code** | Lint/format violation, `tsc` error, a genuine failing assertion, a build error — **and it reproduces locally at that SHA** | ⚪ Counter does **not** reset; that PR does not count toward the five. CI behaved correctly |

  Guards: "reproduces locally at that SHA" requires actually checking the commit out and running the
  failing command, output recorded — no local reproduction means **flake**, not code. **At most one
  code-class exclusion in this story** — a second one is an escalation to Oleg, not a second exclusion.

Then one block per PR follows in Task 3.

---

#### PR 1/5 — `story-2-5/pr-1-sprint-status-in-progress`

- **3.1** Branch cut from `main` HEAD `8e10a6faae25c019ebd8b8997ab69b816fd2c596` (verified equal to
  `origin/main` immediately before `checkout -b`).
- **3.2** One commit, `784d1cc91ec147224bbabb92a0e27a3bb85f3fa4` — `sprint-status.yaml`:
  `2-5-… ready-for-dev → in-progress`. Pushed; local pre-commit hook ran the full local suite first
  (228 files / 1921 tests, all green, ~152 s) — this is the repo's own hook, not part of the ten CI
  runs counted here.
- **3.3** PR opened via `POST /api/v1/repos/CRM/fe-prionex/pulls` (token, `FJ_TOKEN=` prefix
  stripped) → **HTTP 201**, `index = 3`, `head.sha = 784d1cc9…`, `state = open`. API route, not the
  web UI.
- **3.4/3.5 — both runs, from `action_run` (repo 16, `commit_sha = 784d1cc9…`):**

  | id | index | event | ref | workflow_id | status | started (unix) | stopped (unix) | duration |
  |---|---|---|---|---|---|---|---|---|
  | 535 | 45 | push | `refs/heads/story-2-5/pr-1-…` | **ci.yml** | 1 (success) | 1786728307 | 1786728822 | **515 s** |
  | 536 | 46 | pull_request | `refs/pull/3/head` | **ci.yml** | 1 (success) | 1786728391 | 1786728957 | **566 s** |

  `workflow_id = ci.yml` on both — **not** `.github/workflows/CI.yml`; `ci-hub` was not triggered.
  Both runs green, no manual rerun used.

  Per-job (`action_run_job` joined to `action_task` for `runner_id`):

  | run id | job | status | duration | runner_id |
  |---|---|---|---|---|
  | 535 (push) | Lint | success | 139 s | 19 |
  | 535 (push) | Type Check | success | 83 s | 19 |
  | 535 (push) | Unit Tests | success | 514 s | 20 |
  | 535 (push) | Build | success | 111 s | 20 |
  | 536 (pull_request) | Lint | success | 136 s | 19 |
  | 536 (pull_request) | Type Check | success | 84 s | 20 |
  | 536 (pull_request) | Unit Tests | success | 510 s | 19 |
  | 536 (pull_request) | Build | success | 107 s | 20 |

  Runner split: 4 jobs to runner 19, 4 to runner 20 — clean 2/2 per run.

- **3.6** Both runs 4/4 green. No classification needed — no non-green run occurred for this PR.
- **3.7** `commit_status` for `sha = 784d1cc9…`: 24 rows total (transient `pending` rows superseded by
  final rows), **8 distinct final contexts, all `state = success`**:
  `CI / Lint (push)`, `CI / Type Check (push)`, `CI / Unit Tests (push)`, `CI / Build (push)`,
  `CI / Lint (pull_request)`, `CI / Type Check (pull_request)`, `CI / Unit Tests (pull_request)`,
  `CI / Build (pull_request)`. Matches the expected eight exactly.
- **3.8** Merge: `POST /api/v1/repos/CRM/fe-prionex/pulls/3/merge` `{"Do":"merge"}` → **HTTP 200**.
  `pull_request` row (`index=3`): `has_merged = t`, `merged_commit_id =
  2933f88a713a0687fc45e0d2c43d122e911d0c07`, `merger_id = 1`, merged
  2026-08-14 17:36:39 UTC. **The API merge into protected `main` succeeded on the first attempt** —
  the branch-protection rule read in 1.9 (`enable_push_whitelist: false`, `required_approvals: 0`)
  predicted exactly this.
- **3.9** `origin/main` after merge = `2933f88a…`. `select … from action_run where commit_sha =
  '2933f88a…'` → **0 rows**. No run on the merge commit, confirmed by SHA, not by absence from a
  listing.
- **Cleanup:** branch merged, then deleted both remotely (`git push origin --delete`) and locally.
  Confirmed no run was created by the delete (`action_run` has no id above 536 after the delete).

---

#### PR 2/5 — `story-2-5/pr-2-story-file-task1-task2-pr1-evidence`

- **3.1** Branch cut from `main` HEAD `2933f88a713a0687fc45e0d2c43d122e911d0c07` (PR 1's merge
  commit), verified equal to `origin/main` before `checkout -b`.
- **3.2** One commit, `fb1e7351c0366bf4000b284f92276363a6e22223` — this story file, Task 1 facts +
  Task 2 plan + PR 1's evidence block. Local pre-commit hook: 228/228 files, 1921/1921 tests green,
  ~145 s.
- **3.3** PR opened via API → **HTTP 201**, `index = 4`, `head.sha = fb1e7351…`, `state = open`.
- **3.4/3.5:**

  | id | index | event | ref | workflow_id | status | started | stopped | duration |
  |---|---|---|---|---|---|---|---|---|
  | 537 | 47 | push | `refs/heads/story-2-5/pr-2-…` | **ci.yml** | 1 (success) | 1786729333 | 1786729847 | **514 s** |
  | 538 | 48 | pull_request | `refs/pull/4/head` | **ci.yml** | 1 (success) | 1786729419 | 1786729986 | **567 s** |

  `ci.yml` on both, `ci-hub` not triggered. Both green, no rerun.

  | run id | job | status | duration | runner_id |
  |---|---|---|---|---|
  | 537 (push) | Lint | success | 142 s | 19 |
  | 537 (push) | Type Check | success | 85 s | 19 |
  | 537 (push) | Unit Tests | success | 513 s | 20 |
  | 537 (push) | Build | success | 115 s | 20 |
  | 538 (pull_request) | Lint | success | 136 s | 19 |
  | 538 (pull_request) | Type Check | success | 81 s | 20 |
  | 538 (pull_request) | Unit Tests | success | 511 s | 19 |
  | 538 (pull_request) | Build | success | 111 s | 20 |

  Runner split: 4/4, clean 2/2 per run.

- **3.6** Both runs 4/4 green. No classification needed.
- **3.7** `commit_status` for `sha = fb1e7351…`: **8 distinct final contexts, all `state = success`**
  — the same eight as PR 1, verbatim.
- **3.8** Merge: `POST …/pulls/4/merge` → **HTTP 200**. `has_merged = t`, `merged_commit_id =
  d19563060e5cf778650ef65864083f1943d8e71c`, merged 2026-08-14 17:54:02 UTC. Second consecutive
  first-attempt API merge into `main`.
- **3.9** `action_run` for `commit_sha = 'd1956306…'` → **0 rows**. No run on the merge commit.
- **Cleanup:** branch merged, deleted remotely and locally. No run created by the delete.

---

#### PR 3/5 — `story-2-5/pr-3-story-file-pr2-evidence`

- **3.1** Branch cut from `main` HEAD `d19563060e5cf778650ef65864083f1943d8e71c` (PR 2's merge
  commit), verified equal to `origin/main` before `checkout -b`.
- **3.2** One commit, `be0b56560eddabd3c11e124fbfccd519001dbe5d` — this story file, PR 2's evidence
  block. Local pre-commit hook: 228/228 files, 1921/1921 tests green, ~154 s.
- **3.3** PR opened via API → **HTTP 201**, `index = 5`, `head.sha = be0b5656…`, `state = open`.
- **3.4/3.5:**

  | id | index | event | ref | workflow_id | status | started | stopped | duration |
  |---|---|---|---|---|---|---|---|---|
  | 539 | 49 | push | `refs/heads/story-2-5/pr-3-…` | **ci.yml** | 1 (success) | 1786730335 | 1786730856 | **521 s** |
  | 540 | 50 | pull_request | `refs/pull/5/head` | **ci.yml** | 1 (success) | 1786730421 | 1786730985 | **564 s** |

  `ci.yml` on both, `ci-hub` not triggered. Both green, no rerun.

  | run id | job | status | duration | runner_id |
  |---|---|---|---|---|
  | 539 (push) | Lint | success | 140 s | 19 |
  | 539 (push) | Type Check | success | 85 s | 19 |
  | 539 (push) | Unit Tests | success | 520 s | 20 |
  | 539 (push) | Build | success | 110 s | 20 |
  | 540 (pull_request) | Lint | success | 136 s | 19 |
  | 540 (pull_request) | Type Check | success | 84 s | 20 |
  | 540 (pull_request) | Unit Tests | success | 508 s | 19 |
  | 540 (pull_request) | Build | success | 109 s | 20 |

  Runner split: 4/4, clean 2/2 per run.

- **3.6** Both runs 4/4 green. No classification needed.
- **3.7** `commit_status` for `sha = be0b5656…`: **8 distinct final contexts, all `state = success`**
  — the same eight, verbatim.
- **3.8** Merge: `POST …/pulls/5/merge` → **HTTP 200**. `has_merged = t`, `merged_commit_id =
  468d0d05ed728bec6d532d5210d4c66f50382691`, merged 2026-08-14 18:10:45 UTC. Third consecutive
  first-attempt API merge into `main`.
- **3.9** `action_run` for `commit_sha = '468d0d05…'` → **0 rows**. No run on the merge commit.
- **Cleanup:** branch merged, deleted remotely and locally. No run created by the delete.

---

#### PR 4/5 — `story-2-5/pr-4-story-file-pr3-evidence`

- **3.1** Branch cut from `main` HEAD `468d0d05ed728bec6d532d5210d4c66f50382691` (PR 3's merge
  commit), verified equal to `origin/main` before `checkout -b`.
- **3.2** One commit, `20c7b2c1f267a63f73d3228ff023c9d48f1f16ec` — this story file, PR 3's evidence
  block. Local pre-commit hook: 228/228 files, 1921/1921 tests green, ~146 s.
- **3.3** PR opened via API → **HTTP 201**, `index = 6`, `head.sha = 20c7b2c1…`, `state = open`.
- **3.4/3.5:**

  | id | index | event | ref | workflow_id | status | started | stopped | duration |
  |---|---|---|---|---|---|---|---|---|
  | 541 | 51 | push | `refs/heads/story-2-5/pr-4-…` | **ci.yml** | 1 (success) | 1786731334 | 1786731851 | **517 s** |
  | 542 | 52 | pull_request | `refs/pull/6/head` | **ci.yml** | 1 (success) | 1786731422 | 1786731980 | **558 s** |

  `ci.yml` on both, `ci-hub` not triggered. Both green, no rerun.

  | run id | job | status | duration | runner_id |
  |---|---|---|---|---|
  | 541 (push) | Lint | success | 138 s | **20** |
  | 541 (push) | Type Check | success | 86 s | **20** |
  | 541 (push) | Unit Tests | success | 516 s | **19** |
  | 541 (push) | Build | success | 113 s | **19** |
  | 542 (pull_request) | Lint | success | 137 s | **20** |
  | 542 (pull_request) | Type Check | success | 82 s | **19** |
  | 542 (pull_request) | Unit Tests | success | 505 s | **20** |
  | 542 (pull_request) | Build | success | 108 s | **19** |

  Runner split: still 4/4, still clean 2/2 per run — **but the assignment flipped** relative to PRs
  1–3 (there, runner 19 always drew {Lint, Type Check} and runner 20 always drew {Unit Tests,
  Build}; here runner 20 drew {Lint, Type Check} on the push run, and the split within the
  pull_request run is mixed). Recorded as observed, not smoothed into "still 2/2" — see Task 4.5.

- **3.6** Both runs 4/4 green. No classification needed.
- **3.7** `commit_status` for `sha = 20c7b2c1…`: **8 distinct final contexts, all `state = success`**
  — the same eight, verbatim.
- **3.8** Merge: `POST …/pulls/6/merge` → **HTTP 200**. `has_merged = t`, `merged_commit_id =
  25b3fc57b613a3cc6237e7368103df1ec71f01ab`, merged 2026-08-14 18:27:21 UTC. Fourth consecutive
  first-attempt API merge into `main`.
- **3.9** `action_run` for `commit_sha = '25b3fc57…'` → **0 rows**. No run on the merge commit.
- **Cleanup:** branch merged, deleted remotely and locally. No run created by the delete.

### Completion Notes List

_One section per AC. For AC1, state the §2 deviation on "real" explicitly. For AC2, record the
taxonomy as applied — including "no failure occurred" if that is the outcome. For AC3, state the
verdict per run, not as an average. For AC4, give the context strings verbatim._

### File List

_Every file touched, with status. Confirm nothing under Prohibitions 1, 2, 10, 11, 13 appears here._

---

## Open Questions for Review

### Blocking

_None known at creation time. All preconditions verified present (§1)._

### Non-blocking

1. **The five PRs carry this project's own artefacts, not a developer's feature work** (§2). That is
   the only supply available until Epic 7 moves the team onto Forgejo. It tests the pipeline
   completely and the merge flow completely; it does not test a human reviewer's workflow. Whether
   that gap matters to Story 2.6's confidence is Oleg's call, not this story's.
2. **The 497-branch legacy-fallback hazard is worked around procedurally, not closed** (§3,
   Prohibition 11). Story 2.2's Open Question 6 asked for an owner and still has none. Once Story
   2.6 turns on required checks, a PR from any stale branch produces legacy CI contexts and never the
   `CI /` ones — such a PR can never go green. **This is a bigger problem after 2.6 than before it**
   and should be recorded as 2.6's inheritance (Task 6.4).
3. **Nothing owns runs-per-day on a shared host.** Story 2.4 owns the per-run budget; this story
   spends ~9200 job-seconds in one session, roughly five times any prior story. Story 2.2's Open
   Question 7 raised this and assigned no owner.
4. **No story has yet merged a pull request into protected `main` through the API** (Task 3.8). If
   it is refused, the five merges need Oleg's hand, and the sequence stalls between PRs rather than
   failing. Worth knowing before the session starts, not at PR 1.
5. **`ci.yml` is still `main`-only.** Not exercised by this story (every branch is cut from `main`),
   but a developer cutting from `staging` or `development` gets silence rather than an error, and
   that will bite the first person who does it after 2.6.
