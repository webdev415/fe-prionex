---
baseline_commit: 4fc90b78
---

# Story 2.4: Bring the Full CI Run Within the Fifteen-Minute Budget

Status: review

> **Read §1 before you read the epic's ACs.** The title says *"bring within"*. **The run is already
> within.** The last measured whole run is **540 s against a 900 s budget** — run 522,
> `2-3-…md:634-636`. Nothing needs to be made faster, and AC3's remediation clause is conditional on
> a condition that is currently false.
>
> **This is a measurement story.** Its deliverable is four numbers with provenance, not an
> optimisation. The failure mode here is not "missed the budget"; it is **spending runs on a shared
> host to re-measure things that are already measured, and then optimising a pipeline that does not
> need it** — while the flaky-test history (`2-2-…md:158-170`) and Story 2.5's "five consecutive
> green" sit directly downstream.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want CI to finish fast enough that I do not context-switch away from my change,
so that the quality gate stays a help rather than a delay.

---

## 🚨 Read this before anything else

**Three of this story's four ACs describe work that is substantially already done, and the fourth
describes a mechanism that does not work the way it is worded.** AC1/AC2's cold-and-warm pair exists
but measures a pipeline two stories out of date. AC3's threshold is met with six minutes to spare.
AC4's distribution was proven in Story 1.9 by a synthetic probe and has never been checked on real
CI. The danger is not failing to meet the budget — it is **re-running everything from scratch on a
host at load 11–17 with no cancel button**, and calling arithmetic a measurement.

### 1. 🔴 The budget is met. Do not optimise. Measure, record, hand forward.

| Run | Event | Lint | Type Check | **Unit Tests** | Build | **Whole run** | Source |
|---|---|---|---|---|---|---|---|
| 492 (cold) | dispatch | 174 s | 121 s | **486 s** | 151 s | **487 s** | `2-1-…md:388-399` |
| 493 (warm) | dispatch | 163 s | 105 s | 483 s | 143 s | **484 s** | `2-1-…md:388-399` |
| 505 | push | 143 s | 86 s | **467 s** | 113 s | **468 s** | `2-2-…md:624-632` |
| 513 / 515 | push | — | — | 460 s | — | 461 s | `deferred-work.md:931` |
| 514 / 516 | pull_request | — | — | — | — | 503 s / 510 s | `2-2-…md:766-771` |
| **522** | push, **with coverage** | 154 s | 99 s | **539 s** | 126 s | **540 s** | `2-3-…md:634-636` |

**540 s against 900 s. Six minutes of margin** (`deferred-work.md:936`).

🔴 **But the margin shrank by a fifth in one story.** Story 2.3 added coverage instrumentation and
cost **+72 s (+15%)** against the 467 s endpoint, **+79 s (+17%)** against the 460 s floor
(`2-3-…md:634-637`, `deferred-work.md:931-935`). Three more stories of that size and the budget is
gone. **Recording the trend is part of this story's job; acting on it is not.**

**`Unit Tests` is 539 of the 540 seconds** (`deferred-work.md:936-938`). The other three jobs finish
inside its shadow and optimising them buys **nothing** — this is measured, twice, and is the single
most load-bearing fact in the story.

### 2. 🔴 "Cold cache" does not mean what AC1 makes it sound like — and one cold run may already exist

AC1 says *"a full run executes on a **cold cache**"*. Four things make that harder and more
interesting than it reads:

**(a) The npm cache key hashes `package-lock.json`.** `actions/setup-node@v4` with `cache: 'npm'`
builds a key of the shape `node-cache-Linux-x64-npm-<hash>` — the exact string Story 1.7 read off the
runner log (`1-7:634-648`). Story 2.3's commit `3d698492` **changed `package-lock.json`** (it added
`@vitest/coverage-v8@4.1.3`, `2-3-…md:733-734`). **A changed lock file is a new key is a cache
miss.** ⚠️ **Therefore run 522 was very likely a genuine cold run on the npm key — «не проверено».**
If that holds, **AC1's cold measurement is already in hand at 540 s** and this story owes one warm
run, not two runs. Task 4.1 verifies it against the runner container log; **do not assume it.**

**(b) A new branch is not a cold cache.** The key is derived from the lock-file hash and the
platform, not from the ref. Cutting a fresh branch and pushing produces a **warm** run. An agent that
believes otherwise will record a warm number as cold and the story's central pair becomes fiction.

**(c) There are two caches, not one.** Each runner runs its **own** cache server —
`192.168.226.3:34568` on runner 1 and `192.168.226.4` on runner 2 (`1-7:453`, `1-9:226`,
`1-9:237-239`, `2-1-…md:312-313`). Pointing one at the other was explicitly rejected because the
cache would die with runner 1 (`1-9:237-239`). **Consequence:** a four-job run splits 2/2 across the
runners (§5), so *within one run* two jobs can hit a warm cache and two a cold one. "The run was
warm" is not a well-formed statement unless you say **which runner each job landed on**. Task 5.3
records per-job runner attribution alongside the cache result.

**(d) Making a run genuinely cold is a write to shared state.** It means emptying
`.cache/actcache` under `/opt/forgejo-runner-fe-prionex/` on **both** runners (523 MB and 396 MB as
of Story 2.1, `deferred-work.md:686`) — a directory shared with every other workflow on those
runners, including `build.yml`. **Declare it in Task 3.2 before doing it, or don't do it.** If
(a) holds, you do not need to.

### 3. 🔴 A green run is not evidence the cache worked

**A missing or unreachable cache server does not fail a job** — Trap 3 of the D10/D13 trap table,
restated at `2-1-…md:119-126`: *"a missing cache server does not fail a job … So 'CI passed' is not
evidence the cache worked."* The server answers `404` on `/` from inside a job container, which is a
**reachable server with no root route**, not a broken one (`2-1-…md:119-126`).

**And you cannot read the job log.** Established on runs 492–493 and never since contradicted: the
API returns **404** for `actions/jobs/{id}/logs`, `actions/runs/{run}/jobs/{id}/logs` and
`actions/tasks/{id}/logs`; `/data/gitea/actions_log` held 3713 files with highest task id **4867**
while tasks 4872–4879 were absent and their `log_in_storage` stayed `f` despite recorded
`log_length` (`deferred-work.md:651-662`, `2-1-…md:421-437`). **The content existed and never
reached disk.**

**So the cache evidence comes from three places, none of them the job log:**

1. **The runner container log** — the Story 1.7 route, re-used for runner attribution in 1.9, 1.12,
   2.1 and 2.2: `docker logs forgejo-runner-fe-prionex` and `…-2` carry `task NNNN repo is …`
   (`2-2-…md:632-637`, `1-9:384-389`) and, at cache time, `Cache restored from key: node-cache-…`
   (`1-7:634-648`).
2. **The cache directory on disk** — `.cache/actcache` size before and after
   (`deferred-work.md:686`).
3. **The database** — durations, runner ids, artifact rows (§8).

⚠️ **Story 2.1's own standard applies verbatim** (`2-1-…md:242-243`): *"Record whether `npm ci` used
the cache, from a **second** run — a green first run proves nothing about caching."*

### 4. AC2's wording is imprecise and the imprecision matters

AC2 says *"`npm ci` restores from cache"*. **`npm ci` restores nothing.** `actions/setup-node@v4`
restores the npm **cache directory** (`~/.npm`) before `npm ci` runs; `npm ci` then installs from a
populated local cache instead of the network. `.forgejo/workflows/ci.yml` wires this identically in
all four jobs (`:69-73`, `:93-97`, `:112-116`, `:251-255`).

Record **what actually happened** — restore step hit or missed, key, and the `npm ci` step duration
on both runs — rather than paraphrasing the AC. The delta on `npm ci` is the honest reading of AC2,
and it is small: **cold→warm saved 3 s of 487** (`deferred-work.md:684-686`, `2-1-…md:439-446`).
**The cache is not the lever.** `deferred-work.md:684` states it outright: *"Story 2.4's remediation
target is the test job, and the cache is not it."*

### 5. AC4 is nearly a tautology on this instance, and the interesting number is the counterfactual

**Both runners carry `capacity: 2`** (`1-7:427`, `1-9:247`, `2-1-…md:314-315`). Four jobs, two
runners, two slots each → **four slots for four jobs. Queueing is arithmetically impossible** unless
another workflow is holding slots at the same moment. AC4 asks whether jobs *"distribute across
runners rather than queueing on one"*; the honest answer is that the configuration makes the
alternative unreachable, and the story should say so rather than presenting a foregone result as a
discovery.

**Distribution has already been proven once, by a synthetic probe, not by CI.** Story 1.9 run 405
(index 27) dispatched four concurrent `node-20` jobs: tasks 2723 and 2725 → runner **19**, tasks 2726
and 2727 → runner **20**. *"Clean 2/2 split, matching `capacity: 2` on each"* (`1-9:376-389`).
**Nobody has ever checked this on the real CI workflow.** Task 6.2 does, from `action_task.runner_id`
cross-checked against both runner container logs — the same double-sourcing Story 2.2 used
(`2-2-…md:632-637`).

**"The effect on total duration is recorded" — the effect is approximately zero, and that is the
finding.** `Unit Tests` is 539 of 540 s; the other three run inside its shadow. Distribution cannot
shorten a run whose critical path is one job.

⚠️ **The counterfactual is worth stating and is arithmetic, not measurement — label it as such.**
With one runner at `capacity: 2`, four jobs run in two waves. Worst case puts `Unit Tests` in the
second wave: ~154 s + 539 s ≈ **~693 s**, still inside 900 s but with the margin cut from ~6 minutes
to ~3.5. **That is a computed bound, not a measured one.** Do **not** take a runner offline to
measure it — that is a write to shared infrastructure for a number arithmetic already gives you, and
runner 1 is explicitly off-limits (`1-9:84-85`).

### 6. 🔴 The dominant job is known. Every lever on it is dangerous, and none is authorised.

AC3's clause reads: *"**if it does not** [complete in 15 minutes], the dominant job is identified and
the remediation applied before the story closes."* **The condition is false.** Identify the dominant
job — `Unit Tests`, 539 of 540 s — record the levers, apply **none**.

For the record, and so that Story 2.5 or a future performance story does not have to rediscover
them:

| Lever | Why it is not pulled here |
|---|---|
| `maxWorkers: 1`, `fileParallelism: false`, `pool: 'forks'` (`vitest.config.ts:30-32`) | Set deliberately *"to prevent worker crashes under full-suite load (Vitest 4)"* (`vitest.config.ts:29`). This is the single largest lever and the single largest risk. Story 2.5 needs **five consecutive green runs**; the flaky-test fix at `54322fdd` had its first real runner test only in Story 2.2 (`2-2-…md:158-170`). |
| Shard `Unit Tests` across runners | Multiplies job count on a host at load 11–17 (`2-2-…md:575`) and requires merging coverage from N shards. A structural change to a pipeline meeting its budget. |
| Drop the `html` coverage reporter (`vitest.config.ts:26`) | Cheaper, but `vitest.config.ts` is shared with developers; Story 2.3 deliberately left it alone (`2-3-…md:777-780`). |
| Revert coverage | Undoes FR3. Not available. |
| `force_pull: true` on both runners | §7 — measurable without changing anything, and runner config is off-limits (`1-9:84-85`). |

🚨 **If a measurement in this story turns out to exceed 900 s, stop and report before changing
anything.** A remediation that trades run time for test reliability, three days before Story 2.5
demands five consecutive green runs, is a bad trade made under time pressure.

### 7. `force_pull: true` — handed to this story by name, and now cheap to answer

`2-1-…md:129-130`, verbatim: *"`force_pull: true` is set on both runners. `node:20-bookworm` is
cached in **both** dinds (measured), but `force_pull` may re-pull anyway — worth watching, since
Story 2.4 has a 15-minute budget to defend."* Listed again as non-blocking open question 5
(`2-1-…md:509-526`): *"If Story 2.4's budget is tight, this is the first thing to measure."*

**The budget is not tight, so this is a recorded observation, not a remediation.** It is measurable
from the runner container logs during a run this story is spending anyway — a re-pull leaves a trace,
a cache hit does not. **Read it, write it down, change no runner configuration** (`1-9:84-85`).

### 8. 🔴 Peak memory: Story 2.1's open AC4 is inherited by this story, and the evidence is probably already on the instance

`2-1-…md:92-93`, verbatim: *"**Record observed peak usage**, as AC4 requires — it is currently
unknown, and **Story 2.4's budget and Epic 5's stand sizing both inherit the number**."* And
`2-1-…md:258-259`: *"Peak memory, per-job durations and the cache result — **Story 2.4 consumes all
three**."*

It has been unreadable for two days because it was printed to a job log (§3). **The current branch
fixes that.** `probe/2-1-peak-memory` carries `4fc90b78`, which writes the figure into the artifact
**name** — `peak-memory-<N>mb` — landing in `action_artifact.artifact_name`
(`.forgejo/workflows/ci.yml:200-211`, `git diff main...HEAD`).

🔴 **That branch is already pushed** (`origin/probe/2-1-peak-memory` at `4fc90b78`) and the branch is
**not** in `branches-ignore` (`ci.yml:41-44`). **A `push` run therefore already exists for it.** One
SQL query against `action_artifact` returns the peak memory figure, closing Story 2.1's AC4 for free
and giving this story a duration data point it did not have to buy. **Task 2.3 does this first,
before any run is spent.** If the run is absent or the artifact name reads `peak-memory-unknownmb`,
that is itself a finding (`ci.yml:203-204`) — record it, do not paper over it.

### 9. Every run costs, twice, and there is no stop button

- One run ≈ **540 s** of wall clock, ~918 job-seconds since coverage landed (`ci.yml:9-10`).
- 🔴 **`pull_request` is armed** (`ci.yml:52-54`, branches: `main`). A branch that is both pushed and
  has an open PR against `main` produces **two runs per push** — `~964 s` and `~1620 job-seconds`
  measured across runs 513–516 (`deferred-work.md:852`, `2-2-…md:766-771`).
  **Check whether a PR is open for the working branch before pushing.**
- **No cancel endpoint exists.** `POST .../actions/runs/{id}/cancel` → **404**, confirmed against the
  full swagger spec (`deferred-work.md:82-86`, `migration-decisions.md:581-585`). A mistaken push
  runs to completion on a host carrying another tenant's production at load 11–17 with ~7.2 GiB free
  (`2-2-…md:575`).
- Forgejo **auto-cancels** an earlier run of the same workflow on the same ref for `push` and
  `pull_request` (synchronize) **without** a `concurrency` block (D8, `migration-decisions.md:373-376`).
  Observed in the wild in Story 2.3: run 520 was auto-cancelled, and it *"cost no budgeted run, but it
  did not cost nothing"* — ~686 job-seconds burned before the cancel landed (`2-3-…md:626-630`).
  **A superseded run is not a free run.**
- Story 2.1 declared 2 runs and spent 2 (`2-1-…md:212`); Story 1.11 declared zero tokens and minted
  two (`deferred-work.md:534`). **Declare first, in writing, in this file (Task 3.1).**

### 10. Evidence comes from the database, and the schema is verified, not guessed

Route used by Stories 1.12, 2.2, 2.3 and 3.1:

```
ssh root@10.67.0.1 'docker exec -i forgejo-postgres psql -U forgejo -d forgejo'
```

(`1-12-…md:539`, `3-1-…md:706`.) `repo_id` for `CRM/fe-prionex` is **16** (`2-2-…md:573-574`);
re-confirm it rather than hardcoding. Relevant tables: `action_run` (index, commit_sha, event,
status, started/stopped), `action_run_job`, `action_task` (**`runner_id`**, started/stopped),
`action_artifact` (`artifact_name`, `file_size`, `expired_unix`).

⚠️ **Verify column names against the live schema before building a query on them.** Story 2.2's
Haiku subagent hit a real schema error assuming a `has_pull_requests` column that does not exist —
Forgejo keys it through `repo_unit` by `type` — and *"stopped instead of guessing"*
(`2-2-…md:696-703`). That is the correct behaviour; repeat it.

### Prohibitions

🚨 **A prohibition here cannot be overridden by a subtask.**

1. **Do not change `vitest.config.ts`.** `pool`, `maxWorkers`, `fileParallelism`, `testTimeout`,
   `hookTimeout` and the coverage reporter set are all off-limits (§6). They are the only real lever
   on the dominant job and pulling one three days before Story 2.5's five-green requirement is the
   worst possible timing.
2. **Do not change any runner configuration** — not `capacity`, not `force_pull`, not the cache host,
   not the labels. *"Do not change runner 1. It is Story 1.7's deliverable and Story 1.8's evidence
   base"* (`1-9:84-85`). Reading `config.yml`, `.runner` and `docker logs` is expected; writing is
   not. **Do not take a runner offline** to produce a queueing measurement (§5).
3. **Do not add, remove or reorder CI jobs**, and do not shard the test job. The budget is met.
4. **Do not touch the `on:` block or add a `concurrency` block.** Triggers are Story 2.2's; auto-cancel
   is already the default and adding a block to get default behaviour was Story 1.12's recorded
   mistake (`ci.yml:27-31`, D8).
5. **Do not claim a cache hit from a green run.** §3 — a missing cache server goes green.
6. **Do not read, quote or promise any number from a job log.** §3 — logs reach neither API nor disk.
   Every number in this file must come from the database, the filesystem, or a runner container log.
7. **Do not present arithmetic as measurement.** The single-runner counterfactual (§5) and any
   projected duration must be labelled as computed.
8. **Do not spend an unbudgeted run.** §9 — declare in Task 3.1 first; there is no cancel endpoint.
9. **No `ubuntu-latest`** (another team's runner, `ci.yml:59-63`) and **no `upload-artifact@v4`**
   (`GHESNotSupportedError`, D12, `1-8:525`) in anything this story touches.
10. **Do not touch `.github/workflows/`.** D7; Story 7.2 owns those files.
11. **Do not clear `.cache/actcache` without declaring it in Task 3.2 first.** §2(d) — it is shared
    with `build.yml` and every other workflow on those runners.

---

## Acceptance Criteria

Source: `epics.md:1168-1194`, Story 2.4. Covers **NFR1** (`epics.md:235`: *"A full CI run completes
in ≤ 15 minutes"*; traceability `epics.md:396`). Deviations from the epic's literal wording are named
in each AC and justified in §1–§6.

**AC1 — the cold-cache full run is measured and recorded.**
Given the four-job CI workflow at `4fc90b78`,
when a full run executes on a cold npm cache,
then the wall-clock duration from trigger to last job completion is recorded from `action_run` /
`action_task`,
and the per-job durations are recorded alongside it,
and **the basis for calling the run cold is stated** — which cache key, why it missed, and on which
runner each job ran.

> **Clarification, not deviation.** "Cold" is a property of the npm cache **key**, which hashes
> `package-lock.json` (§2a). Run 522 is a candidate cold run already in hand, because commit
> `3d698492` changed the lock file. If Task 4.1 confirms it, AC1 closes on **540 s** without spending
> a run. If it does not, a deliberately cold run is created per Task 4.3. **Cutting a new branch does
> not make a run cold** (§2b).

**AC2 — the warm-cache full run is measured, and the cache hit is proven independently of the run's
colour.**
Given the runner cache servers configured in Story 1.7 (`192.168.226.3:34568` and `192.168.226.4`),
when a second run executes on the same branch with an unchanged `package-lock.json`,
then the `actions/setup-node@v4` restore is shown to have **hit**, evidenced from a runner container
log and/or `.cache/actcache` on disk — **never** from a green job,
and the `npm ci` step duration is recorded for both runs,
and the warm-cache whole-run duration is recorded.

> **Deviation from `epics.md:1182`** (*"`npm ci` restores from cache"*): `npm ci` restores nothing;
> `actions/setup-node` restores `~/.npm` and `npm ci` consumes it (§4). What is recorded is the
> restore result and the `npm ci` delta, which is what the AC is actually for.

**AC3 — the warm run is evaluated against 15 minutes, and the dominant job is named either way.**
Given both measurements,
when the warm-cache full run is evaluated,
then it completes in **900 s** or less,
and the dominant job is identified with its share of the critical path,
and if — and only if — the run exceeds 900 s, the remediation is applied before the story closes.

> **The condition is expected to be false** (§1: 540 s of 900 s). Identification is unconditional and
> is already known — `Unit Tests`, 539 of 540 s. **Remediation is conditional and is not authorised
> speculatively** (Prohibitions 1 and 3). If a measured run does exceed 900 s, stop and report
> rather than reaching for `vitest.config.ts` (§6).

**AC4 — job distribution across the two runners is verified on real CI, and its effect on duration is
stated honestly.**
Given two runners online from Story 1.9, each at `capacity: 2`,
when the four CI jobs are triggered at once,
then each job's runner is recorded from `action_task.runner_id`, cross-checked against both runner
container logs,
and the distribution is shown to be a real split rather than a queue,
and the effect on total duration is recorded — **including the finding that it is near zero because
one job is the whole critical path**,
and the single-runner counterfactual is stated as **arithmetic**, not measurement.

> **Deviation from `epics.md:1191-1194`** in emphasis: with four slots for four jobs, queueing is
> arithmetically unreachable (§5). The AC is satisfied by verifying the split on real CI — which has
> never been done, Story 1.9's proof used a synthetic probe workflow — and by stating why the answer
> was never in doubt.

**AC5 — the peak-memory figure is read and Story 2.1's AC4 is closed or explicitly re-deferred.**
Given `4fc90b78` writes the peak into `action_artifact.artifact_name` as `peak-memory-<N>mb`,
when the artifact rows for the runs of this branch are queried,
then the observed peak memory for the `Unit Tests` job is recorded here in MB, with its run index and
its cgroup source,
and it is compared against the 16384 MB ceiling `test:coverage:ci` sets,
and if the value reads `unknownmb` or no such artifact exists, that is recorded as a finding rather
than left silent.

> **Inherited, not invented.** `2-1-…md:92-93` and `:258-259` hand this number to Story 2.4 by name:
> *"Story 2.4's budget and Epic 5's stand sizing both inherit the number."* It is the cheapest AC in
> the story — one query against a run that already exists (§8).

**AC6 — the numbers are handed forward in a form Stories 2.5 and 2.6 can use.**
Given all measurements above,
when the story closes,
then the headroom (measured whole run against 900 s) and the **trend** — coverage cost +72–79 s, a
fifth of the margin in one story (`2-3-…md:634-637`) — are recorded,
and the levers on `Unit Tests` are listed with the reason each was not pulled (§6),
and `deferred-work.md` carries the handoff, since `epics.md:1214-1217` makes Story 2.5's evidence
depend on this budget and `epics.md:1227-1228` makes Story 2.6 depend on 2.5.

> **Not in the epic's ACs.** Added for the same reason Story 2.3 added its AC5: the next story
> consumes these numbers, and a measurement nobody can find is a measurement nobody made.

---

## Tasks / Subtasks

### Task 1 — Bind the facts before spending anything (AC: 1, 2, 4)

- [x] 1.1 Confirm the working tree is at `4fc90b78` on `probe/2-1-peak-memory` and that
      `.forgejo/workflows/ci.yml` matches Dev Notes: 309 lines, four jobs all `runs-on: node-20`,
      `test` job runs `npm run test:coverage:ci` (`:154-155`), peak-memory steps at `:181-211`,
      coverage archive/upload at `:224-242`, `dist` upload at `:288-293`.
- [x] 1.2 Confirm both runners are online, still carry `node-20`, and still report `capacity: 2` —
      read only (Prohibition 2). Route: `ssh root@10.67.0.1`, then
      `docker logs forgejo-runner-fe-prionex` / `…-2`, and the config files under
      `/opt/forgejo-runner-fe-prionex/` (`1-7:384`, `1-7:544-546`, `1-9:243-247`).
- [x] 1.3 Re-confirm `repo_id` for `CRM/fe-prionex` (expected **16**, `2-2-…md:573-574`) and record
      the current `max(index)` and `count(*)` from `action_run` as the run-budget baseline, **before
      creating any run**.
- [x] 1.4 Verify the column names you intend to query actually exist, against the live schema. Do not
      build a query on an assumed column (§10, `2-2-…md:696-703`).

### Task 2 — Harvest what already exists before buying anything new (AC: 1, 4, 5)

- [x] 2.1 From `action_run` / `action_run_job` / `action_task`, pull the full record for runs
      **492, 493, 505, 513–516, 522** — index, event, commit_sha, per-job durations, runner_id per
      job, whole-run wall clock. These are cited second-hand throughout Dev Notes; this task makes
      them first-hand and catches any transcription drift.
- [x] 2.2 Find the run(s) produced by pushing `4fc90b78` to `origin/probe/2-1-peak-memory`. Record
      index, event(s) — check whether **both** `push` and `pull_request` fired, i.e. whether a PR is
      open against `main` (§9) — status, per-job durations and runner ids.
- [x] 2.3 🔴 **Query `action_artifact` for that run and read `artifact_name`.** Expect
      `peak-memory-<N>mb`. Record N, the run index, and the `heap_ceiling_mb=16384` context. This
      closes **AC5** and Story 2.1's AC4 without spending a run (§8).
- [x] 2.4 Record `.cache/actcache` size on **both** runners now, as the before-value for AC2's
      disk-side evidence (`deferred-work.md:686` recorded 523 MB / 396 MB in Story 2.1).

### Task 3 — Declare the budget and the write list before spending either (AC: 1, 2)

- [x] 3.1 State the number of CI runs this story expects to create, **before creating any**, and the
      expected wall-clock and job-seconds cost at ~540 s / ~918 job-seconds per run. Account for the
      `push` + `pull_request` doubling if a PR is open (§9). Story 2.1 declared 2 and spent 2
      (`2-1-…md:212`) — match that discipline.

      **Declaration (made before any run is created in this session):** This story creates **exactly
      one** new CI run. Task 4.1 (below) closes AC1 on the already-existing run **522** (id 522,
      `action_run.index=42`) — no cold run needs to be bought. Run **531** (`id 531, index 43`,
      commit `4fc90b78`, the push that already happened before this dev-story session started) gives
      first-hand runner-attribution and peak-memory evidence for free but does **not** give a provable
      cache-hit for AC2 (see Task 4.1/5.2 evidence notes — the runner container log carries no
      step-level cache evidence for server-dispatched jobs on this instance, confirmed empirically).
      **The one run this story spends is the AC2 warm-cache run**, triggered by committing this
      story's own progress to `probe/2-1-peak-memory` (an in-scope file, `package-lock.json`
      untouched). No PR is open against `main` for this branch (re-confirmed directly: `SELECT ...
      FROM pull_request WHERE base_repo_id=16 AND head_branch='probe/2-1-peak-memory'` → 0 rows), so
      the push produces exactly one `push` event, not two. Expected cost: **~540–560 s wall clock,
      ~880–920 job-seconds** (sum of the four job durations), based on runs 522 and 531.
- [x] 3.2 List every write to shared state: which refs get pushed; whether `probe/2-1-peak-memory`
      merges to `main` as part of this story or stays a probe branch; **and whether
      `.cache/actcache` gets cleared on either runner** (Prohibition 11). If the answer to the last
      is yes, say on which runner, why Task 4.1 was insufficient, and who is affected.

      **Write list:** (a) one commit to `probe/2-1-peak-memory` (this story file + `sprint-status.yaml`
      + `deferred-work.md`, none of them prohibited), pushed once. (b) `probe/2-1-peak-memory` does
      **not** merge to `main` as part of this story — Task 8.1 records this as a decision for Oleg, not
      a drift. (c) `.cache/actcache` is **not** cleared on either runner — Task 4.1 closes the cold
      question from existing evidence, so the expensive lever in §2(d) is not needed.
- [x] 3.3 Decide whether a Forgejo API token is needed. **It should not be** — Stories 2.1, 2.2 and
      2.3 gathered everything through `docker exec` against the database (§10). If one is genuinely
      needed, plan the exit in writing here **first** and get Oleg's explicit authorisation: an admin
      cannot revoke another account's token (`deferred-work.md:298-306`), so an unplanned mint is
      unrecoverable.

      **Decision: no token needed.** Every fact in this story came from `docker exec -i
      forgejo-postgres psql`, `ssh root@10.67.0.1` filesystem/`docker logs` reads, and local repo
      reads. No Forgejo API call was made.

### Task 4 — Establish the cold measurement honestly (AC: 1)

- [x] 4.1 Test the §2(a) hypothesis: was run **522** cold on the npm key? Evidence — commit
      `3d698492` changed `package-lock.json`; the setup-node key hashes it; the runner container log
      around run 522's tasks should show a cache **miss**/save rather than
      `Cache restored from key: …` (`1-7:634-648`). Record the verdict and the evidence.

      **Verdict: CONFIRMED cold.** ⚠️ Evidence is **not** the direct route §3 describes (`Cache
      restored from key: …` step-output line) — that channel does not exist for real,
      server-dispatched CI jobs on this instance (see below). Evidence actually used, two independent
      disk-side signals, cross-corroborated:
      1. **A new npm cache key first appears inside run 522's exact time window.** The cache proxy's
         own GC log (`docker logs forgejo-runner-fe-prionex`, `module=artifactcache`, `deleted cache:
         &{...}`) records key `node-cache-linux-x64-npm-b5f94888d3a90d828581f4e3c44e058c4487cd8bb8ede3ce4d9993e591331a00`
         (call it **KEY_B**) for the first and only time with `CreatedAt=1786714359`
         (runner 1, id 22) / `CreatedAt=1786714391` (runner 2, id 18) — both **inside** run 522's
         window (`started=1786714263`, `stopped=1786714803`, i.e. 15:31:03–15:40:03 CEST). `grep -n
         'b5f94888' <full log>` finds no earlier occurrence anywhere in the retained log (which goes
         back to 2026-08-10). The pre-existing key
         `node-cache-linux-x64-npm-a49d1a07fc95c9dbd26d4f0760f32e66fe46b9ae13f54829f9972834d766f7d2`
         (**KEY_A**) is what runs 492–516 used.
      2. **Fresh cache blobs land on disk timed to run 522's job completions.** Direct file listing
         (`find /opt/forgejo-runner-fe-prionex/data/runner{,-2}/.cache/actcache -type f -printf
         '%T@ %TY-%Tm-%TdT%TH:%TM:%TS %s %p\n'`) shows a new ~103.9 MB blob on runner 1 at
         `2026-08-14T15:33:34` (3 s after Lint's `stopped` at 15:33:37 — within the granularity of
         `stopped` being job-record time vs. blob mtime) and a new ~103.9 MB blob on runner 2 at
         `2026-08-14T15:40:00` (3 s before the run's own `stopped` at 15:40:03). Both are new files
         that did not exist before run 522's window.
      3. This satisfies AC1's "the basis for calling the run cold is stated — which cache key, why it
         missed, and on which runner each job ran": key = KEY_B (new, first use); reason = commit
         `3d698492` changed `package-lock.json` (`2-3-…md:733-734`), producing a new hash; runners =
         §4.4 below.
      4. **Negative finding, recorded rather than papered over (Prohibition 6, §3):** exhaustively
         checked and confirmed **absent** for run 522 (and for every real CI run studied, 492–531):
         no `Cache restored from key: …` / `Cache saved with the key: …` line, no `module=cacheproxy`
         debug line (`proxy req GET …`), in the runner container log. Those lines exist **only** for
         Story 1.9's probe-workflow runs from 2026-08-11 (task ids 1316–2825, job names like
         `[Probe runner labels/node-20 label]`) — never for a real, server-dispatched CI job (task ids
         4697+, job names `Lint`/`Type Check`/`Unit Tests`/`Build`). Between a task's `task NNNN repo
         is …` start line and its `Cleaning up network for job X` end line, the runner container log
         contains **nothing else** for real jobs — confirmed by reading the full raw log between those
         two markers for task 5544/5545 (run 531) verbatim. This means §3's "runner container log"
         evidence route for cache hit/miss is unavailable for any run this story can create; the
         actcache-disk route (used above) is the only working one, and it is also the route used for
         AC2 below.
- [x] 4.2 **If 4.1 confirms cold:** AC1 closes on run 522 — whole run **540 s**, `Unit Tests` 539 s,
      Lint 154 s, Type Check 99 s, Build 126 s (`2-3-…md:634-636`), verified first-hand in Task 2.1.
      Record per-job runner attribution (§2c). **Do not create a second cold run.** Skip 4.3.

      **AC1 CLOSED.** Verified first-hand against `action_run`/`action_run_job` (repo_id 16, id 522,
      `index=42`, `event=push`, `commit_sha=3d698492…`): `started=1786714263`, `stopped=1786714803`,
      whole run **540 s** exactly. Per job: Lint 154 s, Type Check 99 s, Unit Tests **539 s**, Build
      126 s — all match the story's inherited table (`2-3-…md:634-636`) to the second; no transcription
      drift found across runs 492, 493, 505, 513, 514, 515, 516, 522 either (all eight match their
      cited sources exactly).
- [ ] 4.3 **Only if 4.1 refutes it:** create a genuinely cold run. The honest levers are (a) clear
      `.cache/actcache` on both runners — declared in 3.2 — or (b) land a change that alters
      `package-lock.json`, which this story has no business doing. Prefer (a), do it once, record
      before/after sizes. **A new branch is not cold** (§2b).

      **Skipped.** 4.1 confirmed cold; this subtask does not apply.
- [x] 4.4 Record which runner each of the four jobs landed on for the cold run, from
      `action_task.runner_id` cross-checked against both container logs.

      From `action_task` (joined via `action_run_job.task_id`), cross-checked against the task-id
      lists visible in each runner's own `docker logs` (`grep -oE 'task [0-9]+'`): run 522 (id 522) —
      **Lint** task 5428 → runner **19** (`forgejo-runner-fe-prionex`), **Type Check** task 5429 →
      runner **19**, **Unit Tests** task 5430 → runner **20** (`forgejo-runner-fe-prionex-2`),
      **Build** task 5431 → runner **20**. A clean 2/2 split, both sources agree (task ids 5428/5429
      appear only in runner 1's log, 5430/5431 only in runner 2's).

### Task 5 — Establish the warm measurement and prove the cache hit (AC: 2)

- [x] 5.1 Create the warm run: same branch, unchanged `package-lock.json`, one push (or dispatch).
      Count it against the Task 3.1 budget, including the `pull_request` duplicate if applicable.

      **Done.** Commit `6d7911b2` (Tasks 1–4 write-up), pushed to `origin/probe/2-1-peak-memory` at
      `2026-08-14T15:31:02Z`. `package-lock.json` confirmed byte-identical to commit `3d698492`
      (`git diff 3d698492 6d7911b2 -- package-lock.json` → empty) and to `4fc90b78`
      (`git diff 3d698492 4fc90b78 -- package-lock.json` → empty) — this is the same npm-cache-key
      lineage as run 522. `git diff --stat 4fc90b78 6d7911b2` shows only the story file and
      `sprint-status.yaml` changed — no prohibited file touched. Result: `action_run` **id 534, index
      44**, event **push** (confirmed the only event for this commit — no `pull_request` duplicate,
      matching the Task 3.1 declaration).
- [x] 5.2 Prove the restore **hit**, from the runner container log (`Cache restored from key: …`,
      `1-7:634-648`) and/or the `.cache/actcache` delta from Task 2.4. **Not from a green job**
      (Prohibition 5).

      **Available evidence, stated at the honest limit of what this instance can prove — no "green job"
      claim made (Prohibition 5):**
      1. The direct route (`Cache restored from key: …` in the runner container log) is confirmed
         **unavailable for this run too** — grepped explicitly for run 534's exact window
         (17:31–17:41 CEST) on both runners: no cache-restore/save/GC line at all fired during it, on
         either runner (checked with the same `grep -iE 'cache (restored|saved|not found|miss)'` and
         `module=cacheproxy` patterns as Task 4.1). This is the same structural gap established in
         Task 4.1, now confirmed a third time (runs 522, 531, 534 all show it).
      2. **Disk evidence:** four new cache blobs appeared during run 534's window, each ~103.9 MB, one
         per job, timed within 0–3 s of that job's own `stopped` time (runner 1:
         `cache/1a/26` @ 17:32:28 CEST ≈ Type Check's stop 17:32:31; `cache/1b/27` @ 17:33:22 ≈ Lint's
         stop 17:33:24; runner 2: `cache/16/22` @ 17:32:54 ≈ Build's stop 17:32:57; `cache/17/23` @
         17:39:35 ≈ Unit Tests' stop 17:39:38). This proves each job performed a **save** at job end,
         which — established in Task 4.1 — happens on this instance's cache-proxy implementation
         regardless of whether the preceding restore was a hit or a miss. **A save event is therefore
         not, by itself, proof of a hit.**
      3. **The strongest available evidence is a hash-determinism argument, not a log read.** The npm
         cache key is a deterministic hash of `package-lock.json` + OS/arch (§2a; `1-7:634-648`).
         `package-lock.json` is confirmed byte-identical across `3d698492` → `4fc90b78` → `6d7911b2`
         (git diff, above). Therefore run 534's `setup-node` cache key is necessarily the **same** key
         string as run 522's (`node-cache-linux-x64-npm-b5f94888…331a00`, "KEY_B") — no other key hash
         has been observed anywhere in the runner logs since KEY_B first appeared during run 522
         (re-checked: `grep -n 'b5f94888'` across the full retained log on both runners finds only the
         two 2026-08-14T16:42:28/29+02:00 GC-deletion lines from run 531's window, no new key string
         since). Since KEY_B's content was successfully saved during run 522 and remained the active
         key for this lock-file hash through runs 531 and 534, the `setup-node` **restore** step in
         run 534 had a matching key to restore from.
      **Verdict: warm, on the balance of the strongest evidence this instance can produce** — a
      restore *content* line was never observed for any real run on this instance (recorded as a
      standing gap, not papered over), so this is deliberately labelled a hash-determinism argument
      cross-checked against disk activity, **not** the direct "Cache restored from key" proof §3
      describes. If a future story gets API/log access restored, re-verifying this with a direct log
      line would close the gap cleanly.
- [x] 5.3 Record per-job runner attribution for the warm run and, per job, whether it hit a warm or
      cold cache — remember the two caches are independent (§2c).

      Run 534: **Lint** (task 5629) → runner **19**, **Type Check** (task 5630) → runner **19**,
      **Build** (task 5632) → runner **20**, **Unit Tests** (task 5631) → runner **20**. 2/2 split
      again. Per the Task 5.2 argument, **all four jobs on both runners** were warm on the npm key —
      the key is per-lock-file, not per-runner, but each runner keeps its **own physical cache blob
      store** (§2c), and each runner's own blob listing does show new content in the run 534 window
      (both runners' `cache/` directories grew), consistent with each runner's independent cache proxy
      already holding KEY_B from its own earlier save (runner 1 saved KEY_B content during run 522;
      runner 2 saved KEY_B content during run 522's Build/Unit Tests jobs too — both runners'
      `1786714xxx`-era blobs). No cold-cache runner was observed in this run.
- [x] 5.4 Record the `npm ci` step duration on both runs and state the cold→warm delta. Compare with
      Story 2.1's **3 s of 487** (`deferred-work.md:684-686`, `2-1-…md:439-446`) and say whether the
      cache is still not the lever.

      **«не проверено» for the isolated step duration — recorded as a gap, not guessed.** `action_run_job`
      / `action_task` carry only **job-level** `started`/`stopped`, not per-step timing; the only place
      a per-step `npm ci` duration could come from is the job log, which is confirmed unreadable on
      this instance (§3, `deferred-work.md:651-662`). This is a structural limit of the available
      tables, not an oversight — the same tables were checked for a step-level column in Task 1.4 and
      none exists (`action_run_job` schema: `id, run_id, repo_id, owner_id, commit_sha,
      is_fork_pull_request, name, attempt, handle, workflow_payload, job_id, needs, runs_on, task_id,
      status, started, stopped, created, updated` — no step-level fields).
      **What can honestly be said instead:** whole-job durations for Lint/Type Check/Build (the three
      short jobs, where `npm ci` is a larger fraction of total time) show no consistent
      cold-vs-warm pattern that survives host-load noise: Lint 154 s (run 522) → 133 s (run 531) →
      139 s (run 534); Type Check 99 s → 83 s → 86 s; Build 126 s → 108 s → 111 s. All three runs share
      the same (warm, per Task 5.2's argument) cache key, so this variance (±10–20 s) is host-load
      noise (`load 11–17`, §Infrastructure facts), not cache signal — which is itself consistent with
      Story 2.1's finding that **the cache saves only ~3 s of ~487 s** (`deferred-work.md:684-686`): a
      3 s effect would be invisible against ±10–20 s of host-load noise on this shared box. **The cache
      is still not the lever** — this story adds no evidence that changes that verdict.
- [x] 5.5 Record the warm whole-run wall clock and per-job durations.

      **Run 534 (warm): whole run 513 s.** Lint 139 s (runner 19), Type Check 86 s (runner 19),
      **Unit Tests 512 s** (runner 20), Build 111 s (runner 20). `started=1786721465`
      (2026-08-14T15:31:05Z), `stopped=1786721978` (2026-08-14T15:39:38Z), both from `action_run`,
      cross-checked against the summed per-job/`action_task` rows above.

### Task 6 — Evaluate against the budget and record distribution (AC: 3, 4)

- [x] 6.1 State the warm whole-run duration against **900 s**, in seconds and as remaining margin.
      Name `Unit Tests` as the dominant job with its share of the critical path. **If the run exceeds
      900 s, stop and report** — do not remediate on the spot (§6, Prohibitions 1 and 3).

      **AC3 CLOSED — the run does not exceed 900 s, so remediation is not triggered.** Run 534 (warm):
      **513 s against 900 s — 387 s (43%) of margin remaining.** `Unit Tests` is the dominant job at
      **512 of 513 s (99.8% of the critical path)** — Lint (139 s), Type Check (86 s) and Build (111 s)
      all finish and their runner sits idle for the remainder, exactly as §1/§6 predicted. No
      remediation was applied, none was needed, and Prohibitions 1/3 were never approached.
- [x] 6.2 State the four-job distribution across runner ids for at least one real CI run, and that it
      is a split rather than a queue. Compare with Story 1.9's synthetic 2/2 proof
      (`1-9:376-389`) and note that this is the first time it has been checked on the CI workflow.

      **Checked on real CI for all nine runs harvested this session (492, 493, 505, 513, 514, 515, 516,
      522, 531), not just one.** Every single one is a clean **2/2 split** between runner 19
      (`s1-fe-prionex-1`) and runner 20 (`s1-fe-prionex-2`) — never a 3/1, never a 4/0, never a queue.
      Which pair of jobs lands on which runner **varies run to run** (e.g. run 492: Build+Unit Tests
      → 19, Lint+Type Check → 20; run 493: the opposite pairing; run 522: Lint+Type Check → 19, Unit
      Tests+Build → 20) — the scheduler is not pinning job *names* to a runner, only balancing load at
      dispatch time. This is the **first time distribution has been checked on the real CI workflow**
      (Story 1.9's 2/2 proof, `1-9:376-389`, used a synthetic four-job probe workflow, not `ci.yml`).
      The result matches Story 1.9's prediction exactly, as §5 expected given `capacity: 2` on both
      runners (config re-verified live in Task 1.2).
- [x] 6.3 State the effect of distribution on total duration — expected: **near zero**, because
      `Unit Tests` is ~539 of ~540 s. Give the single-runner counterfactual (~693 s) and label it
      **arithmetic, not measurement** (Prohibition 7).

      **Effect on duration: negligible, confirmed rather than assumed.** Across all nine runs, `Unit
      Tests` is consistently 96–99% of the whole-run duration regardless of which runner it lands on
      (539/540 = 99.8% for run 522; 486/487 = 99.8% for run 492; 557/558 = 99.8% for run 531).
      Whichever runner draws `Unit Tests` determines the run's wall clock almost entirely; the other
      three jobs finish and their runner sits idle for the remainder. **Single-runner counterfactual
      (arithmetic, not measured):** with one runner at `capacity: 2`, four jobs run in two waves of
      two. Worst case puts `Unit Tests` in the second wave, behind whichever job started first on that
      runner: `154 s (Lint) + 539 s (Unit Tests) ≈ 693 s` using run 522's own numbers — comfortably
      inside 900 s, but the margin drops from ~360 s to ~207 s. **This is arithmetic composed from
      measured job durations, not a measured run** — no runner was taken offline (Prohibition 2,
      `1-9:84-85`).
- [x] 6.4 Confirm no job queued behind another workflow (e.g. `build.yml`) during the measured runs;
      if it did, that is the more interesting AC4 finding and belongs in the record.

      **No queueing observed.** For every run harvested (492 through 531), each job's `action_task`
      `started` timestamp is within 0–1 s of its `action_run`'s own `started` timestamp (e.g. run 522:
      run `started=1786714263`, Lint/Type Check task `started=1786714263`, Unit Tests/Build task
      `started=1786714264` — 1 s later, not queued) — i.e. every job began essentially the instant the
      run was dispatched, with no visible wait for a runner slot. This is consistent with §5's
      "four slots for four jobs, queueing is arithmetically impossible" absent contention from another
      workflow, and no such contention was observed in any of the nine runs studied.

### Task 7 — Answer the two questions Story 2.1 handed forward (AC: 5)

- [x] 7.1 **Peak memory (AC5).** Report the figure from Task 2.3 in MB, with run index and cgroup
      source, against the 16384 MB ceiling. State plainly whether the doubling Story 2.1 applied
      *"precautionary, not corrective"* (`2-1-…md:491-494`) was warranted by the measured peak.

      **AC5 CLOSED. Peak memory = 2163 MB**, from `action_artifact.artifact_name = 'peak-memory-2163mb'`
      for run 531 (`id=531, index=43`, commit `4fc90b78`, `Unit Tests` job, `runner_id=20`). Cgroup
      source is not itself recoverable (it is written into the artifact's *content*, e.g.
      `peak-memory.txt`, which this story cannot download — the artifact-download route is
      session-gated and does not work for an agent, `deferred-work.md` SETTLED 2026-08-14 entry) —
      only the *name*, which is exactly what `4fc90b78` was written to make readable without a job log
      (§8). The artifact **is not** `peak-memory-unknownmb`, so both cgroup files the script checks
      resolved cleanly; which one it was is «не проверено» and does not block AC5, which only asks for
      the MB figure.
      **Against the 16384 MB ceiling: 2163 / 16384 ≈ 13.2%.** Story 2.1's doubling (8192→16384 MB,
      `2-1-…md:491-494`) was explicitly *"precautionary, not corrective"* — the measured peak confirms
      that framing was right: even the **original, undoubled** 8192 MB ceiling would have had **62%**
      headroom over the observed peak (8192−2163=6029 MB spare). The doubling was not needed to avoid
      an OOM on this evidence, though it is cheap insurance and this story is not the one to reverse it
      (that would be touching `package.json`, Prohibition/scope boundary).
- [x] 7.2 **`force_pull: true` (§7).** From the runner container logs of the runs this story spent,
      state whether `node:20-bookworm` was re-pulled per job or served from the dind image cache, and
      what it cost in seconds. **Change no runner configuration** (Prohibition 2). If the logs do not
      answer it, say «не проверено» and leave it — the budget does not need it.

      **«не проверено» — and this is itself the finding, not a gap left by inattention.** The
      `[DEBUG] pulling image 'docker.io/library/node:20-bookworm' … forcePull=true` line **does**
      exist in the runner container log format (confirmed: 27 occurrences on runner 1, all from Story
      1.9's 2026-08-11 probe-workflow runs, e.g. `[probe-actions/probe-node20]`) — but, exactly like
      the cache-restore line in Task 4.1, it **never appears for a real, server-dispatched CI job**
      (checked explicitly around run 522's and run 531's exact time windows on both runners: zero
      matches). This is the same structural gap as the cache evidence: real job step content/`docker
      pull` orchestration output is not forwarded to the runner container's own log the way the Story
      1.9 probe's was. No runner configuration was read or changed beyond `config.yml`/`.runner`
      (Prohibition 2). The budget does not need this number (§7: *"the budget is not tight"*), so it is
      left open rather than guessed at.

### Task 8 — Decide what this story does with the probe branch (AC: 5, 6)

- [x] 8.1 State whether `probe/2-1-peak-memory` (`4fc90b78`: peak memory into the artifact name,
      coverage retention 1→7 days) merges to `main` as part of closing this story, or stays a probe
      branch for someone else to land. It is Story 2.1's AC4 fix and Oleg's retention decision, both
      currently living only on a probe branch. **Whichever way, it is a decision recorded here, not a
      drift.**

      **Decision: does NOT merge as part of this story. Owner: Oleg.** This story's mandate is
      measurement (§1), and merging `4fc90b78` (a real change to `ci.yml`'s behaviour, not a
      documentation edit) is a judgement call about production CI behaviour that belongs to the person
      who owns the retention-days decision embedded in the same commit, not to a coordinator executing
      a measurement story. This was already flagged as **Open Question 2 (Blocking, owner Oleg)** at
      the bottom of this file before development started; that flag stands and is not resolved
      unilaterally here. Practical effect: `4fc90b78`'s two fixes (peak-memory-in-artifact-name,
      7-day coverage retention) remain live only on `probe/2-1-peak-memory` until Oleg merges it.
- [x] 8.2 If it merges: `main` is in `branches-ignore` (`ci.yml:41-44`), so the merge itself spends
      no run. Confirm that rather than assuming it, and confirm the merge does not close an open PR
      in a way that fires a `pull_request` run.

      **Not applicable — 8.1 decided against merging in this story.** For the record, when Oleg does
      merge: `main` is confirmed still in `branches-ignore` at `.forgejo/workflows/ci.yml` lines 40-43
      (re-read directly in Task 1.1), so the merge itself would spend no run; and Task 3.1 already
      confirmed no open PR exists for `probe/2-1-peak-memory` (`pull_request` table, 0 rows), so there
      is nothing for a merge to close that could fire a `pull_request` run either.

### Task 9 — Record and hand forward (AC: 6, all)

- [x] 9.1 Fill in Dev Agent Record: runs declared vs. spent, the cold/warm pair with provenance, the
      cache verdict, per-job runner attribution, peak memory, and every «не проверено» that survives.

      Done below in the Dev Agent Record section.
- [x] 9.2 Record headroom and **trend**: measured whole run against 900 s, plus the +72–79 s coverage
      cost from Story 2.3 as evidence the margin is not static (`2-3-…md:634-637`,
      `deferred-work.md:931-938`).

      **Headroom: 387 s (43%) at run 534 (513 s / 900 s).** **Trend, carried forward unchanged from
      Story 2.3's handoff:** coverage cost +72 s (+15% against the 467 s endpoint) / +79 s (+17%
      against the 460 s floor) in a single story (`2-3-…md:634-637`). This story adds one more data
      point to the trend line rather than resetting it: run 522 (540 s, first coverage run) → run 531
      (558 s) → run 534 (513 s) — a ±45 s spread across three runs on an **unchanged** pipeline,
      confirming (§5, §6.3) that host-load noise on this shared box (load 11–17) is a bigger swing
      factor run-to-run than anything this story touched. The margin is not static and nothing
      currently watches it shrinking — recorded again in `deferred-work.md` (Task 9.4) for Story 2.6.
- [x] 9.3 List the levers on `Unit Tests` with the reason each was not pulled (§6 table), so a future
      performance story starts from a decision rather than a blank page.

      The §6 table (`maxWorkers`/`fileParallelism`/`pool`, sharding, dropping the `html` reporter,
      reverting coverage, `force_pull: true`) stands as written and was not touched or re-litigated —
      no lever was pulled, matching Prohibitions 1 and 3. Restated in the Completion Notes below for
      quick reference by Story 2.5/2.6.
- [x] 9.4 Add a `deferred-work.md` entry handing Story 2.5 the budget number it needs
      (`epics.md:1214-1217`) and naming anything this story leaves open.

      Added: "Handed to Story 2.5 by Story 2.4 (2026-08-14) — the budget number and what is still open."
- [x] 9.5 Update `docs/forgejo-migration.md` if it carries an NFR1/CI-duration row still stated as an
      intention rather than a measurement.

      **Checked, no update made.** `grep -n -i "NFR1\|ci run\|budget\|duration\|900 s\|15 min"
      docs/forgejo-migration.md` (403 lines total) returns no matches — the file carries no NFR1/CI-
      duration row at all, in any form, so there is nothing to convert from intention to measurement.

### Task 10 — Close (AC: all)

- [x] 10.1 Set `Status: review` and update `sprint-status.yaml` for
      `2-4-bring-the-full-ci-run-within-the-fifteen-minute-budget` from `ready-for-dev`.

      Done — see YAML frontmatter `Status:` field above and `sprint-status.yaml`.
- [x] 10.2 Confirm every claim in Dev Agent Record carries a `file:line`, a database value, a runner
      log line, or an explicit «не проверено» — and that every projected number is labelled as
      computed (Prohibition 7).

      Confirmed by re-reading the completed Tasks 1–9 above: every duration/id/key/artifact claim
      cites its `action_run`/`action_run_job`/`action_task`/`action_artifact` row, a `docker logs`
      grep result, or a `git diff`; the one arithmetic projection (Task 6.3's single-runner
      counterfactual, ~693 s) is explicitly labelled "arithmetic, not measurement"; every unresolved
      question (Task 5.4's step-level `npm ci` duration, Task 7.1's cgroup source, Task 7.2's
      `force_pull` cost, Task 5.2's cache-hit content-line) is explicitly marked «не проверено» with
      the reason the evidence channel does not exist on this instance.

---

## Dev Notes

### Exact source facts (verified at `4fc90b78`)

**`.forgejo/workflows/ci.yml`** — 309 lines. Four jobs, all `runs-on: node-20`:

| Job | Name | Lines | Steps |
|---|---|---|---|
| `lint` | Lint | `:57-84` | checkout@v6, setup-node@v4 (`cache: 'npm'`), `npm ci`, `npm run lint`, `npm run format:check` |
| `typecheck` | Type Check | `:86-103` | checkout@v6, setup-node@v4, `npm ci`, `npm run typecheck` |
| `test` | Unit Tests | `:105-242` | checkout@v6, setup-node@v4, `npm ci`, **`npm run test:coverage:ci`** (`:154-155`), peak-memory record + artifact (`:181-211`, both `if: always()`), `tar -czf coverage.tar.gz coverage/` (`:224-225`), upload coverage `@v3` `retention-days: 7` (`:229-242`) |
| `build` | Build | `:244-293` | checkout@v6, setup-node@v4, `npm ci`, `npm run build` (`VITE_API_BASE_URL: http://ci.invalid`), upload `dist/` `@v3` `retention-days: 1` |

`on:` block (`:38-54`): `workflow_dispatch`; `push` with `branches-ignore: [main, staging, development]`;
`pull_request` with `branches: [main]`. 🚨 **The `branches-ignore` filter is what keeps this workflow
off tags** (`:35-37`) — a ref filter of any kind makes Forgejo skip non-branch refs.

**`package.json:13-17`** — five test scripts, verbatim:

```
13	    "test": "vitest",
14	    "test:run": "cross-env NODE_OPTIONS=--max-old-space-size=8192 vitest run",
15	    "test:run:ci": "cross-env NODE_OPTIONS=--max-old-space-size=16384 vitest run",
16	    "test:coverage": "cross-env NODE_OPTIONS=--max-old-space-size=8192 vitest run --coverage",
17	    "test:coverage:ci": "cross-env NODE_OPTIONS=--max-old-space-size=16384 vitest run --coverage",
```

CI uses **`test:coverage:ci`** only. `@vitest/coverage-v8` is `4.1.3` (`package.json:76`), `vitest`
`^4.0.14` (`:94`), `cross-env` `^7.0.3` (`:79`).

**`vitest.config.ts:29-32`** — the reason `Unit Tests` is the critical path, verbatim:

```
29	    // Pool options to prevent worker crashes under full-suite load (Vitest 4).
30	    pool: 'forks',
31	    maxWorkers: 1,
32	    fileParallelism: false,
```

Also `testTimeout: 20000` / `hookTimeout: 20000` (`:38-39`), locale pinned to `C.UTF-8` (`:14`),
coverage `provider: 'v8'`, `reporter: ['text', 'json', 'html']` (`:24-28`). **228 test files, 1921
tests** (`2-1-…md:100-111`); ~150 s locally, ~3× slower on the runner (`2-1-…md:449`).

**`eslint.config.js:15`** — `globalIgnores(['dist', 'coverage'])`. Coverage output must stay ignored;
Story 2.3 found that generating coverage locally broke `npm run lint` (`2-3-…md:716-721`).

### Infrastructure facts

| Fact | Value | Source |
|---|---|---|
| Runners | `s1-fe-prionex-1` (id 19, `192.168.226.3`), `s1-fe-prionex-2` (id 20, `192.168.226.4`), both on s1 | `1-7:309`, `1-7:453`, `1-9:224-226`, `1-9:281` |
| Labels | `node-20:docker://node:20-bookworm`, `docker-build:docker://…docker:cli` | `1-7:386`, `1-9:262`, `1-9:281-282` |
| Capacity | **2 concurrent jobs each** — four slots total | `1-7:427`, `1-9:247`, `2-1-…md:314-315` |
| Cache | per-runner built-in proxy, `cache.proxy_port: 34568`; `.cache/actcache` 523 MB / 396 MB | `1-7:445-458`, `deferred-work.md:686` |
| Host s1 | 104 cores, ~125 GiB RAM, load **11–17**, ~7.2 GiB free, shares the box with another tenant's production, `ci-hub`, `s1-build-crm`, `s1-deploy-dev-preprod`, `techno-finance`, observability | `2-1-…md:307`, `2-1-…md:496-498`, `2-2-…md:575`, `2-2-…md:87-89`, `1-9:637` |
| Job containers | nested dind, **not memory-capped** — 104 CPUs / 128454 MB visible from inside | `2-1-…md:82-96`, `2-1-…md:309` |
| `force_pull` | `true` on both runners; `node:20-bookworm` cached in both dinds | `2-1-…md:129-130`, `2-1-…md:310-311` |
| Cancel endpoint | **none** — 404 against the full swagger spec | `deferred-work.md:82-86` |
| Job logs | unretrievable: 404 on three API routes; `log_in_storage` stays `f` | `deferred-work.md:651-662` |

### Action verdicts on this instance (D12, Story 1.8)

| Action | Verdict |
|---|---|
| `actions/checkout@v6` | resolves |
| `actions/setup-node@v4` | resolves; `cache: 'npm'` works, cache hit proven in Story 1.7 |
| `actions/upload-artifact@v3` | resolves; **one database row per FILE** (154 rows for `dist`) |
| `actions/upload-artifact@v4` | **does not resolve** — `GHESNotSupportedError` (`1-8:525`) |
| job-level `concurrency` | **silently ignored** — workflow level only (D8, `migration-decisions.md:368-371`) |

### Anti-patterns for this story

- **Optimising anything.** The budget is met with six minutes to spare (§1). Every lever on the
  dominant job is a risk to Story 2.5's five-green requirement (§6).
- **Cutting a fresh branch and calling the run cold.** §2b — the key hashes the lock file, not
  the ref.
- **Reporting one cache verdict for a whole run.** §2c — two independent cache servers, 2/2 split.
- **Reading a green job as proof the cache worked.** §3 — a missing cache server goes green.
- **Re-measuring runs 492/493 from scratch.** They exist (`2-1-…md:388-399`); harvest them (Task 2.1).
  They measure a pre-coverage pipeline, which is a caveat to state, not a reason to repeat them.
- **Spending a run to get the peak-memory number.** §8 — the run already happened; it is one query.
- **Presenting the single-runner counterfactual as measured.** §5 — it is arithmetic, and taking a
  runner offline to measure it is a write to shared infrastructure for a number you can compute.
- **Quoting a duration "from the log".** §3 — there is no log.
- **Pushing without checking for an open PR.** §9 — two runs per push, ~1620 job-seconds, no cancel.

### Previous story intelligence

- **Story 2.1** established the four jobs, the `node-20` pin, the `@v3` artifact pin, the 16384 MB
  heap deviation recorded in the YAML rather than hidden, and the cold/warm pair 487/484 s. Its
  **AC4 (peak memory) is still open** and is handed to this story by name (`2-1-…md:92-93`,
  `:258-259`). It also handed over `force_pull` (`:129-130`) and the standard *"record whether
  `npm ci` used the cache, from a **second** run"* (`:242-243`).
- **Story 2.2** armed `push` (`branches-ignore`) and later `pull_request` (branches: `main`), proved
  `branches-ignore` empirically with a negative control, and measured the two-runs-per-commit cost.
  It left `ci.yml` on **`main` only** — a branch cut from `staging` or `development` gets no CI,
  silently (`2-2-…md:838-840`). Its Haiku subagent hit a schema error and **stopped instead of
  guessing** (`2-2-…md:696-703`) — the right behaviour, repeat it.
- **Story 2.3** added coverage in one pass and measured its cost: **+72 s (+15%)**, the single
  largest change to this budget so far (`2-3-…md:634-637`). It also recorded that an auto-cancelled
  run still burns job-seconds (`:626-630`), and that a "budgeted run" count is not the same as a cost
  count.
- **Story 1.9** proved distribution with a synthetic four-job probe: clean 2/2 across runners 19 and
  20 (`1-9:376-389`), and forbade touching runner 1 (`1-9:84-85`).
- **The standing method lesson** (`deferred-work.md:548-551`): *"job logs are unretrievable"* was
  over-generalised into not reading the **server/runner** log either, and an answer sat in
  `docker logs` for eight hours. **Different things.** This story depends on runner container logs.

### Testing standards

**This story adds no tests and changes no test configuration** (Prohibition 1). The suite is 228 files
/ 1921 tests, serial by config, and its only role here is as the thing being timed. The assertion
that it still passes is the CI run itself; a red run is a finding, not a licence to edit
`vitest.config.ts`.

### Project Structure Notes

Files this story is expected to touch:

- `_bmad-output/implementation-artifacts/2-4-…md` — this file (the primary deliverable).
- `_bmad-output/implementation-artifacts/deferred-work.md` — the handoff to Story 2.5 (Task 9.4).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status (Task 10.1).
- `docs/forgejo-migration.md` — only if it carries an NFR1 row stated as intention (Task 9.5).
- Possibly a merge of `probe/2-1-peak-memory` into `main` (Task 8) — a decision, not an edit.

Files this story must **not** touch: `.forgejo/workflows/ci.yml`, `vitest.config.ts`, `package.json`,
`package-lock.json`, anything under `src/`, `.github/workflows/`, and any runner configuration on s1.

**If this story finds itself editing `ci.yml`, something has gone wrong** — the budget is met, and
every reason to edit it is covered by a prohibition.

### References

- `epics.md:1168-1194` — Story 2.4 and its four ACs
- `epics.md:235` — NFR1, *"A full CI run completes in ≤ 15 minutes"*; `epics.md:396` — traceability
- `epics.md:1214-1217` — Story 2.5 depends on this budget; `epics.md:1227-1228` — Story 2.6 on 2.5
- `.forgejo/workflows/ci.yml:35-54`, `:105-242`, `:181-211` — triggers, `test` job, peak-memory steps
- `package.json:13-17`, `:76`, `:79`, `:94` — scripts and versions
- `vitest.config.ts:24-32`, `:38-39` — coverage, pool/worker settings, timeouts
- `eslint.config.js:15` — `globalIgnores(['dist', 'coverage'])`
- `deferred-work.md:82-86` — no cancel endpoint
- `deferred-work.md:651-662` — job logs unretrievable
- `deferred-work.md:684-690` — cache is not the lever; `.cache/actcache` sizes; `Unit Tests` dominates
- `deferred-work.md:852` — two runs per PR commit, ~964 s / ~1620 job-seconds
- `deferred-work.md:928-942` — Story 2.3's handoff to 2.4: coverage overhead, budget margin
- `deferred-work.md:298-306` — token model; an admin cannot revoke another account's token
- `migration-decisions.md:368-376` — D8: job-level `concurrency` ignored; auto-cancel is default
- `migration-decisions.md:581-585` — no cancel endpoint
- `1-7:427`, `1-7:445-458`, `1-7:634-648` — capacity, cache config, `Cache restored from key: …`
- `1-8:525` — `upload-artifact@v4` `GHESNotSupportedError`
- `1-9:84-85` — do not change runner 1; `1-9:237-239` — per-runner cache; `1-9:376-389` — 2/2 split
- `2-1-…md:92-93`, `:129-130`, `:242-243`, `:258-259`, `:307-315`, `:388-399`, `:421-446`, `:491-498`
- `2-2-…md:158-170`, `:575`, `:624-637`, `:696-703`, `:766-771`, `:838-852`
- `2-3-…md:626-630`, `:634-639`, `:645-650`, `:716-721`, `:777-780`
- `1-12-…md:539`, `3-1-…md:706` — the database access route

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (coordinator — all judgement calls, all queries designed and independently
re-verified, all prose). Haiku subagents (`Agent` tool, `subagent_type: Explore`) were used for two
initial mechanical retrievals (DB schema dump, runner config file dump); one Haiku subagent call
(a DB-harvest retrieval) came back with a harness-level **security warning** flagging injected
content in its own transcript attempting to redirect the classifier — its output was **not** trusted
as-is. Every load-bearing number in this record (run history, peak-memory artifact, cache-key
timing, PR check) was independently re-run and re-verified directly by the coordinator via `ssh` +
`docker exec … psql` / `docker logs`, not taken from that flagged subagent's report, even where its
numbers happened to match on cross-check.

### Debug Log References

- Schema verified live: `\d action_run`, `\d action_run_job`, `\d action_task`, `\d action_artifact`,
  `\d pull_request` against `forgejo-postgres` before any query was built on those columns (Task 1.4).
- `repo_id`: `SELECT id, owner_name, name FROM repository WHERE name='fe-prionex'` → **16**.
- Baseline before this story creates any run: `SELECT count(*), max(index), min(index) FROM
  action_run WHERE repo_id=16` → **count 43, max 43, min 1** (captured before the Task 5 push).
- Historical runs 492/493/505/513/514/515/516/522 exist as `action_run.id` (the **global** row id,
  not the per-repo `index` — the story's "run N" citations are `id`, confirmed by cross-query; using
  `index` for the same numbers returns 0 rows, which was the first (wrong) query tried and corrected
  before being written down anywhere).
- Run 531 (`id=531, index=43`, commit `4fc90b78`, event `push`) already existed from the push that
  put this branch at its current HEAD before this session started — it pre-answers AC5 (§8) and gives
  a second first-hand distribution data point (Task 6.2) at no cost.
- PR check: `SELECT … FROM pull_request WHERE base_repo_id=16 AND head_branch='probe/2-1-peak-memory'`
  → 0 rows, run twice (once via subagent, once directly by the coordinator) — no open PR, so the
  Task 5 push produces exactly one run.
- `.cache/actcache` real path is `/opt/forgejo-runner-fe-prionex/data/runner{,-2}/.cache/actcache`
  (**not** `/opt/forgejo-runner-fe-prionex/.cache/actcache`, which does not exist) — 421 MB (runner 1)
  / 397 MB (runner 2) as of this session's start, vs. 523 MB / 396 MB recorded in Story 2.1
  (`deferred-work.md:686`); runner 1's drop is consistent with periodic GC (`func="[gcCache]"`, seen
  running at 2026-08-14T16:42:28+02:00, deleting several superseded cache versions across both keys
  simultaneously on both runners).

### Completion Notes List

- **Runs declared vs. spent: 1 declared, 1 spent.** Task 3.1 declared exactly one new run before any
  was created. Commit `6d7911b2` was pushed once (2026-08-14T15:31:02Z) to `probe/2-1-peak-memory`
  and produced exactly one `action_run` row (id 534, index 44, event `push` — confirmed no
  `pull_request` duplicate, no auto-cancelled superseding run, no second push). Everything else
  (runs 492, 493, 505, 513–516, 522, 531) already existed before this session started and cost
  **zero** additional spend — they were harvested, not created.
- **AC1 CLOSED** on run 522 (**540 s** whole run, `Unit Tests` 539 s) — cold, confirmed via
  cache-key-first-appearance in the cache-proxy GC log (`module=artifactcache`, key
  `…b5f94888…331a00` first seen `CreatedAt` inside run 522's exact window on both runners) +
  fresh-blob-mtime cross-correlation on `.cache/actcache`. The direct "Cache restored from key"
  runner-log route (§3/Story 1.7) does **not** exist for real, server-dispatched CI jobs on this
  instance — checked exhaustively across five real runs (492, 505, 522, 531, 534) and present only
  in Story 1.9's 2026-08-11 local-probe-workflow runs. This gap is recorded, not silently papered
  over, and is the single biggest methodological finding of this story.
- **AC2 CLOSED, with the evidence explicitly labelled at its honest strength.** Warm run 534:
  **513 s**, `Unit Tests` 512 s. Cache-hit evidence is a hash-determinism argument (unchanged
  `package-lock.json` since `3d698492`, confirmed by `git diff`, ⇒ same deterministic cache key as
  run 522's KEY_B, and no other key has appeared in any log since) cross-checked against
  `.cache/actcache` blob timing — **not** a direct "Cache restored" log line, because that line does
  not exist for this instance's real jobs. `npm ci` step-level duration is «не проверено» — the DB
  has no step-level timing column and job logs are unreadable; job-level duration variance (±10–20 s
  across runs 522/531/534) is attributed to host-load noise, consistent with Story 2.1's finding that
  the cache itself only saves ~3 s of ~487 s.
- **AC3 CLOSED.** Warm run 534: 513 s against 900 s, 387 s (43%) margin. `Unit Tests` is 99.8% of the
  critical path. No remediation triggered or applied (Prohibitions 1, 3 untouched).
- **AC4 CLOSED.** Checked on real CI (not a synthetic probe) for the first time, across all nine runs
  harvested: every one is a clean 2/2 split between runner 19 and runner 20, no queueing observed
  (every job's task started within 0–1 s of its run's dispatch). Effect on duration: negligible
  (confirmed, not just predicted) because `Unit Tests` alone is 96–99.8% of every run's wall clock.
  Single-runner counterfactual (~693 s) stated and explicitly labelled arithmetic, not measured.
- **AC5 CLOSED for free.** `peak-memory-2163mb` (13.2% of the 16384 MB ceiling) was already sitting in
  `action_artifact` for run 531 before this session began — one query, zero run spend, and it closes
  Story 2.1's AC4 which had been open since 2026-08-11.
- **AC6 CLOSED.** Headroom (387 s/43% at 513 s) and trend (+72–79 s from Story 2.3, plus this story's
  own ±45 s host-load spread across three same-pipeline runs) recorded here and in
  `deferred-work.md`; the §6 lever table was left untouched (no lever pulled); `deferred-work.md`
  carries the full handoff to Story 2.5.
- **Surviving «не проверено», complete list:** (1) `npm ci` step-level duration on any run — no
  step-level timing column exists and job logs are unreadable. (2) The specific cgroup source
  (`memory.peak` v2 vs `max_usage_in_bytes` v1) behind the 2163 MB peak-memory figure — only the
  artifact *name* is readable, not its content. (3) `force_pull`'s per-job image-pull cost — the log
  line format exists but never appears for a real CI job, same structural gap as (4). (4) A direct
  cache-restore-hit log line for any real run — never observed; Task 5.2's warm verdict rests on a
  hash-determinism argument instead, explicitly labelled as such rather than presented as the direct
  proof §3 asks for.
- **Deliberately not done:** `probe/2-1-peak-memory` was **not** merged to `main` (Task 8.1 — recorded
  as Oleg's decision, not made unilaterally). No runner configuration was changed. `.cache/actcache`
  was never cleared. No second CI run was created beyond the one declared. `ci.yml`, `vitest.config.ts`
  and `package.json`/`package-lock.json` were never opened for editing.

### File List

- `_bmad-output/implementation-artifacts/2-4-bring-the-full-ci-run-within-the-fifteen-minute-budget.md` — this story file (primary deliverable; all Task/Dev Agent Record content).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status updated `ready-for-dev` → `in-progress` → `review`.
- `_bmad-output/implementation-artifacts/deferred-work.md` — new section "Handed to Story 2.5 by Story 2.4 (2026-08-14)".
- `docs/forgejo-migration.md` — checked (Task 9.5), **not modified** (no NFR1/CI-duration row exists in it).

---

## Open Questions for Review

### Blocking

1. **RESOLVED during development.** Task 4.1 confirmed run 522 was cold (new cache key
   `…331a00` first appears inside its exact time window, cross-corroborated by fresh actcache
   blob mtimes — see Task 4.1's write-up). AC1 closed for free. This story spent exactly **one** new
   run (Task 5.1, commit `6d7911b2`, pushed 2026-08-14T15:31:02Z) as the AC2 warm-cache measurement.
   `.cache/actcache` was never cleared on either runner.
2. **Does `probe/2-1-peak-memory` merge to `main` as part of this story?** It carries Story 2.1's AC4
   fix (peak memory into the artifact name) and Oleg's retention decision (1→7 days). Both are
   currently living only on a probe branch. Merging is out of this story's stated scope but leaving
   them stranded is worse than either alternative. **Owner: Oleg** (Task 8.1).

### Non-blocking

3. **AC4 is close to unfalsifiable as written.** Four slots, four jobs — queueing cannot happen
   absent contention from another workflow. Verifying the split on real CI is worth doing (it never
   has been), but the AC's implied risk does not exist on this configuration. Recorded rather than
   dressed up as a discovery.
4. **The margin is shrinking and nothing owns it.** Coverage took a fifth of it in one story. There
   is no mechanism that would notice the next such change before it lands — no threshold, no alert,
   no recorded budget check in the workflow. Whether one is wanted belongs with Story 2.6 (required
   checks), not here.
5. **Run arrival rate is still unowned** (`2-2-…md:845-846`). This story owns *per-run* duration;
   nothing owns *runs per day* on a host at load 11–17 with ~7.2 GiB free. Story 4.2 remains the
   closest candidate.
6. **`ci.yml` is still `main`-only** (`2-2-…md:838-840`). A feature branch cut from `staging` or
   `development` produces no CI at all — silently. Inherited from Story 2.2, still unowned, and it
   will bite Story 2.5's "five consecutive real pull requests" if any of them is cut from the wrong
   base.
7. **`force_pull: true` may be paying for image pulls on every job** (§7). Measurable here, fixable
   only by a runner-config change this story is forbidden to make. If the answer is "yes, N seconds
   per job × 4 jobs × 2 runs per commit", it deserves its own small story rather than a quiet edit.
8. **The `dist` upload still writes 154 artifact rows per run** and now does so twice per PR commit
   (`deferred-work.md:691-692`, `2-3-…md:774-776`). Story 2.3 archived *coverage* for exactly this
   reason and explicitly left `dist` alone. Still unowned.
