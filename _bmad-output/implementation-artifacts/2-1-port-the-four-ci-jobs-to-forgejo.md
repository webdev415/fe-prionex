---
baseline_commit: 43e14341
---

# Story 2.1: Port the Four CI Jobs to Forgejo

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the same four quality checks I have on GitHub running on Forgejo,
so that moving platforms does not reduce the feedback I get on my code.

---

## 🚨 Read this before anything else

**This is the first story that puts an executable workflow on a protected branch.** Everything in
Epic 1 was infrastructure, probes on throwaway branches, and documents. `.forgejo/workflows/` on
`main`, `staging` and `development` currently holds exactly one file — Story 1.13's inert
`README.md` — and the D9 invariant has been re-confirmed against that fact five times. This story
adds the second file, and it is one that runs.

### 1. The port is not a copy. Four things in `CI.yml` cannot come across.

Read `.github/workflows/CI.yml` first. Then note what must change, and why:

| `CI.yml` | Why it cannot be ported as-is |
|---|---|
| `runs-on: ubuntu-latest` ×4 (`:12`, `:34`, `:53`, `:82`) | The `CRM` org has an idle `ubuntu-latest` runner **belonging to another team**. A ported workflow naming it would execute our CI on their infrastructure. AC7 forbids it outright. |
| `actions/upload-artifact@v4` (`:101-106`) | **Does not resolve on this instance.** Story 1.8 got `GHESNotSupportedError: @actions/artifact v2.0.0+, upload-artifact@v4+ … are not currently supported on GHES`. The pin proven to work is **`@v3`** (D12). |
| `codecov/codecov-action@v4` (`:74-78`) and `npm run test:coverage` (`:70-72`) | Removed entirely by FR3. **They are not this story's to port** — Story 2.3 reintroduces coverage as an artifact. This story's `test` job runs `npm run test:run` and stops. |
| `VITE_API_BASE_URL: ${{ secrets.VITE_API_BASE_URL \|\| 'http://localhost:80' }}` (`:96-99`) | A silent fallback, which NFR8 and D6 both forbid carrying over. See §3 — this needs a decision, not a copy. |

### 2. 🔴 The artifact you upload cannot currently be downloaded, and that is on the record

Story 1.8 proved `upload-artifact@v3` **uploads**: the action's own log said
`Container for artifact … successfully created` and `Artifact has been finalized`. It did **not**
prove retrieval, and could not: **there is no Actions-artifacts API on this instance** — 314 swagger
paths, none of them artifacts, and the quota endpoints (`/orgs/{org}/quota/artifacts`,
`/user/quota/artifacts`) return **404**. `retention-days: 1` was accepted without error; whether it
is honoured is «не проверено» because the session was shorter than a day.

**What this means for this story:** AC5 asks you to upload `dist/`. You can satisfy that and record
it honestly. **Do not write that the artifact is available, downloadable, or retrievable** — Story
2.3's AC ("the coverage artifact is downloadable") is where that claim has to be earned, and it is
currently unsupported. If you find a working retrieval route, that is a finding worth more than the
story.

### 3. The build job needs a value for `VITE_API_BASE_URL`, and there is no obviously right one

`npm run build` is `tsc -b && vite build`. Vite will build with the variable absent — it just bakes
`undefined` into the bundle. So the job will pass either way, which is exactly the failure mode
NFR8 exists to prevent.

Three candidate answers, and this story must pick one **in writing** before the workflow is written:

- **(a) A CI-only literal** (e.g. `http://ci.invalid`), with a comment saying the CI build is a
  compile check and its bundle is never shipped. Cheapest, honest, and no dependency.
- **(b) Read from OpenBao** via the step proved in Story 1.12 (see its appendix). Correct-looking,
  but it makes every CI run depend on OpenBao and the Alpine mirror, on a `node-20` image where the
  OpenBao client is **not** packaged (Debian has no `openbao` package — that was decided for the
  `docker-build`/Alpine image, D15).
- **(c) Omit it entirely** and let the bundle carry `undefined`.

**Recommendation: (a).** Story 3.3 owns per-environment builds and is where real values belong; CI's
`build` job exists to prove the code compiles and bundles, not to produce a deployable. **Whichever
is chosen, no `||` fallback may appear in the workflow** — that is the specific construct D6 and
NFR8 name as a mine.

### 4. The test job asks for an 8 GB heap, and where that memory comes from is not where you would look

`test:run` is `cross-env NODE_OPTIONS=--max-old-space-size=8192 vitest run`. The runner **container**
is capped at `mem_limit: 2g` (`docker-compose.yml:112`, `:183`). **That cap does not apply to the
job.** Job containers are created inside the nested `dind`, and neither `dind` nor `dind2` declares
any resource limit — measured from inside a job-equivalent container: `104` CPUs and `128454` MB
total visible, i.e. the host's, uncapped.

So the heap is available. Two things follow that the AC actually cares about:

- **Record observed peak usage**, as AC4 requires — it is currently unknown, and Story 2.4's budget
  and Epic 5's stand sizing both inherit the number.
- **The host is shared and busy.** At measurement: 125 GiB total, **8.0 GiB free**, load average
  **12.99** across 104 cores, uptime 125 days. Four concurrent 8 GB-heap jobs are not free, and s1
  also carries another tenant's production.

### 5. 🔴 The test suite is not reliably green, and this session has first-hand evidence

Running `npm run test:run` through this repository's pre-commit hook **four times today**, one run
failed while every test passed:

```
Test Files  228 passed (228)
     Tests  1921 passed (1921)
    Errors  1 error
Uncaught Exception
TypeError: Failed to execute 'dispatchEvent' on 'EventTarget': parameter 1 is not of type 'Event'.
 ❯ Timeout._onTimeout node_modules/@radix-ui/react-focus-scope/dist/index.mjs:92:21
 originated in "src/pages/ClientManagement/components/__tests__/DocumentUploadModal.test.tsx"
```

A jsdom/radix timer fires after its element is gone; vitest counts it as an unhandled error and
exits non-zero. **1 in 4 observed.** This is not a Forgejo problem and this story does not have to
fix it — but it must be **recorded**, because Story 2.5 requires *five consecutive green runs* and
a 25% per-run failure rate makes that roughly a coin toss. Enabling required checks (2.6) on top of
it would block merges at random. Put it in `deferred-work.md` with that consequence spelled out.

### 6. The cache is reachable, and its absence would be silent

`http://192.168.226.3:34568/` answers `404` from a job-equivalent container inside dind 1 — a route
that does not exist, which is a **reachable server**, not a broken one. Note two traps already
recorded: a **missing cache server does not fail a job** (`docs/runners/README.md`, D10/D13 trap
table), and each runner has its **own** cache host (`.3` and `.4`). So "CI passed" is not evidence
the cache worked. If this story claims caching works, it claims it from a measured second run, not
from a green tick.

Also: `force_pull: true` is set on both runners. `node:20-bookworm` is cached in **both** dinds
(measured), but `force_pull` may re-pull anyway — worth watching, since Story 2.4 has a 15-minute
budget to defend.

### 7. Dispatching this workflow needs something we do not currently have

AC6 requires the first commit to be `workflow_dispatch`-only and all four jobs confirmed green
**via a manual dispatch**. Dispatching needs a Forgejo API token; Story 1.12's was revoked at the
end of its Task 5 by design, and minting one is not available to the dev agent. Story 1.12 worked
around this by triggering on push pinned to a probe branch — **that workaround does not apply here**,
because AC6 names `workflow_dispatch` specifically.

**Two acceptable routes, decide before starting:** Oleg dispatches from the web UI, or Oleg mints a
`write:repository` token and the exit is planned before it is minted (D14's lesson: an admin cannot
revoke another account's token by any scripted route; the only exit is the `access_token` row).

### Prohibitions

🚨 **A prohibition here cannot be overridden by a subtask.**

1. **No job may use `ubuntu-latest`.** It is another team's runner.
2. **No `||` fallback for any `VITE_*` value.** §3.
3. **No codecov step, no codecov token, no `test:coverage`** in this story. FR3 removes it; Story
   2.3 reintroduces coverage as an artifact.
4. **`upload-artifact@v4` must not be used.** Pin `@v3` (D12).
5. **Do not claim the artifact is downloadable.** §2.
6. **Do not add `push` or `pull_request` triggers.** That is Story 2.2, and doing it here would fire
   CI on every push to three protected branches before it is proven.
7. **Do not "fix" the flaky test** as part of this story. Record it (§5); fixing it is a separate
   change with its own review.
8. **Do not touch `.github/workflows/`.** No action is taken on GitHub (D7); the legacy files are
   deleted by Story 7.2, not now.

---

## Acceptance Criteria

Source: `epics.md`, Story 2.1. Covers FR1; contributes to NFR1.

**AC1 — four independent jobs on the right label.**
Given the existing `.github/workflows/CI.yml`,
when `.forgejo/workflows/ci.yml` is created,
then it defines four independent jobs — `lint`, `typecheck`, `test`, `build` — that run in parallel
with no dependencies between them,
and every job targets the `node-20` runner label.

**AC2 — lint.** Executes `npm ci`, then `npm run lint`, then `npm run format:check`, and an ESLint
warning fails the job, because `lint` is `eslint . --max-warnings=0`.

**AC3 — typecheck.** Executes `npm run typecheck` (`tsc -b`), and a type error fails the job.

**AC4 — test.** Executes `npm run test:run`, and the runner container provides enough memory for
`NODE_OPTIONS=--max-old-space-size=8192`, **with the observed peak usage recorded**.

**AC5 — build.** Executes `npm run build` and uploads `dist/` as an artifact with a 1-day retention,
and **the artifact-action version proven in Story 1.8 is used** (`@v3` — see §2).

**AC6 — dispatch-only at first.** Its only trigger is `workflow_dispatch`, so porting does not spam
runs on every push, and all four jobs are confirmed green via a manual dispatch.

**AC7 — no foreign runner.** No workflow in `.forgejo/workflows/` uses `ubuntu-latest`, and every
job targets a label provisioned by Story 1.7 (`node-20` or `docker-build`).

---

## Tasks / Subtasks

### Task 1 — Bind the facts before writing YAML (AC: 1, 2, 3, 4, 5)

- [ ] 1.1 Re-read `.github/workflows/CI.yml` and `package.json` and confirm the script strings have
      not drifted from those recorded in Dev Notes.
- [ ] 1.2 Confirm both runners are online and carry `node-20`, and record the run count on this
      repository as the dispatch-budget baseline (**31 as of 2026-08-13**).
- [ ] 1.3 Confirm `node:20-bookworm` is present in **both** dinds — a first run that has to pull it
      distorts every duration Story 2.4 will measure.

### Task 2 — Decide the `VITE_API_BASE_URL` question in writing (AC: 5)

- [ ] 2.1 Choose (a), (b) or (c) from §3, write the choice and the rejected options into this file,
      and state plainly that no `||` fallback appears in the workflow.
- [ ] 2.2 If (b) is chosen against the recommendation, first establish that the OpenBao client can
      be installed on `node:20-bookworm` — Debian has no `openbao` package, and D15's decision was
      made for the Alpine image. Do not assume it transfers.

### Task 3 — Declare the budget before spending it (AC: 6)

- [ ] 3.1 State how many dispatches this story expects to need, before dispatching any. Three of the
      last four stories overran an undeclared or vague budget; 1.8's review found "план был 2" had
      nothing to compare against.
- [ ] 3.2 Resolve the dispatch route (§7) with Oleg before writing the workflow, not after.

### Task 4 — Write `.forgejo/workflows/ci.yml` (AC: 1, 2, 3, 4, 5, 7)

- [ ] 4.1 Four jobs, no `needs:` between them, all `runs-on: node-20`.
- [ ] 4.2 Each job: `actions/checkout@v6`, `actions/setup-node@v4` with `node-version: '20'` and
      `cache: 'npm'`, then `npm ci`. All three are proven to resolve on this instance (D12).
- [ ] 4.3 `lint`: `npm run lint` then `npm run format:check` as separate steps, so the log says
      which one failed.
- [ ] 4.4 `typecheck`: `npm run typecheck`.
- [ ] 4.5 `test`: `npm run test:run`, plus a step that records peak memory (AC4) — e.g. read
      `/sys/fs/cgroup/memory.peak` or sample RSS; whatever is used, the number goes in this file.
- [ ] 4.6 `build`: `npm run build` with the Task 2 decision applied, then `actions/upload-artifact@v3`
      with `name: dist`, `path: dist/`, `retention-days: 1`.
- [ ] 4.7 `on: workflow_dispatch` and nothing else.
- [ ] 4.8 Grep the finished file for `ubuntu-latest` and for `||` — both must return nothing.

### Task 5 — Prove it (AC: 6)

- [ ] 5.1 Commit to a branch, dispatch, and record run id, job ids, per-job duration and which
      runner executed each (attribution from the runners' container logs — the Story 1.9 method,
      re-used in 1.12).
- [ ] 5.2 All four green in one dispatch. If a job fails, fix and re-dispatch, and **count it
      against the declared budget** rather than quietly.
- [ ] 5.3 Record whether `npm ci` used the cache, from a **second** run — a green first run proves
      nothing about caching (§6).
- [ ] 5.4 Record the peak memory number from AC4.

### Task 6 — Land it (AC: 1, 6, 7)

- [ ] 6.1 Merge `.forgejo/workflows/ci.yml` to `main` with the dispatch-only trigger intact.
- [ ] 6.2 Re-confirm the D9 posture afterwards: `.forgejo/workflows/` on `main`, `staging` and
      `development` now contains `README.md` **and** `ci.yml`, and `ci.yml` fires on nothing until
      Story 2.2. State it explicitly — the invariant has changed shape and every prior story
      asserted the old shape.

### Task 7 — Record (AC: all)

- [ ] 7.1 The flaky test from §5 into `deferred-work.md`, with its consequence for Stories 2.5
      and 2.6 named.
- [ ] 7.2 The artifact-retrieval gap from §2, so Story 2.3 inherits it rather than rediscovering it.
- [ ] 7.3 Peak memory, per-job durations and the cache result — Story 2.4 consumes all three.
- [ ] 7.4 A changelog row in `docs/migration-decisions.md`.

### Task 8 — Close (AC: all)

- [ ] 8.1 Commit; update `sprint-status.yaml` to `review`.

---

## Dev Notes

### Exact source facts (verified at `43e14341`)

`.github/workflows/CI.yml` — four jobs, all `runs-on: ubuntu-latest`:

| job | line | steps |
|---|---|---|
| `lint` | 10 | checkout@v6, setup-node@v4 (node 20, `cache: 'npm'`), `npm ci`, `npm run lint`, `npm run format:check` |
| `typecheck` | 32 | checkout@v6, setup-node@v4, `npm ci`, `npm run typecheck` |
| `test` | 51 | checkout@v6, setup-node@v4, `npm ci`, `npm run test:run`, `npm run test:coverage` (`continue-on-error: true`), `codecov/codecov-action@v4` |
| `build` | 80 | checkout@v6, setup-node@v4, `npm ci`, `npm run build` (with the `VITE_API_BASE_URL` fallback), `actions/upload-artifact@v4` (`name: dist`, `path: dist/`, `retention-days: 1`) |

Triggers (`:3-7`): `push` and `pull_request` on `[main, staging, development]`. No `concurrency`,
`permissions` or `defaults` block anywhere.

`package.json` scripts, verbatim:

```
"lint":         "eslint . --max-warnings=0"
"format:check": "prettier --check \"src/**/*.{ts,tsx,css,json}\""
"typecheck":    "tsc -b"
"build":        "tsc -b && vite build"
"test:run":     "cross-env NODE_OPTIONS=--max-old-space-size=8192 vitest run"
```

No `packageManager` field, no `engines` constraint, `package-lock.json` present.

### Action verdicts on this instance (D12, Story 1.8)

| action | verdict |
|---|---|
| `actions/checkout@v6` | resolves — assert `test -f package.json` passed |
| `actions/setup-node@v4` | resolves — assert `node --version \| grep -q '^v20\.'` passed |
| `actions/upload-artifact@v4` | **does not resolve** — `GHESNotSupportedError` |
| `actions/upload-artifact@v3` | resolves; upload confirmed by the action's own log. **Retrieval «не проверено»** |
| `docker/*` | out of scope here (Epic 3) |

### Live-instance facts (measured 2026-08-13 — re-verify in Task 1)

- Host s1: 125 GiB RAM (**8.0 GiB free**), 104 cores, load average **12.99**, uptime 125 days.
- From inside a job-equivalent container: node **v20.20.2**, npm **10.8.2**, 104 CPUs and 128454 MB
  visible — **the job container is not memory-capped**, despite the runner container's `mem_limit: 2g`.
- `node:20-bookworm` cached in **both** dinds. dind 1 also holds `node:22-bookworm`, buildkit,
  alpine, curl and two leftover `smoke-1-8-*` images; dind 2 holds four images.
- Cache server `192.168.226.3:34568` → `404` from a job-equivalent container (reachable; no route at
  `/`). Runner 2's cache is a **different** host, `192.168.226.4`.
- Runners: `capacity: 2`, `timeout: 2h`, `force_pull: true`, `container.options` byte-identical on
  both (registry mapping + OpenBao mapping), `docker_host` differs (`dind` / `dind2`) as designed.
- 31 total action runs on this repository — the dispatch-budget baseline.

### Anti-patterns for this story

- **Porting `ubuntu-latest`.** It resolves, on somebody else's runner. That is worse than failing.
- **Copying `upload-artifact@v4`** because it is what `CI.yml` says. It is proven not to work here.
- **Carrying the `||` fallback across.** The whole point of NFR8.
- **Adding `push`/`pull_request` triggers "while we're here".** Story 2.2, deliberately separate.
- **Reporting the artifact as available.** Upload ≠ retrieval; retrieval has no API here.
- **Treating a green run as evidence of caching.** A missing cache server is silent by design.
- **Fixing the flaky test inside this story.** Record it; fix it under its own review.

### Previous story intelligence

- **1.12:** the instance disagrees with the plan more often than not — check, do not assume. Its
  nine-check isolation matrix was a false positive because the tool authenticated as `admin` when a
  variable was empty; **a test that cannot fail proves nothing.** Applies directly to AC4's memory
  claim and to the cache claim.
- **1.12 appendix** holds the proven OpenBao read step if Task 2 chooses (b) — but read §3 first.
- **1.11:** an empty result is not evidence of safety; make the property under test load-bearing.
- **1.9:** runner attribution comes from each runner's container log; two runners of capacity 2 mean
  four concurrent jobs cannot land on one.
- **1.8:** declared its dispatch budget too vaguely to be checkable, and overran it. Task 3.1 exists
  because of that.

### Testing standards

There is no new application code here, so "testing" means: every AC claim is a recorded observation
from a real run — run id, job id, duration, runner attribution, exit status — or it is marked
«не проверено». Peak memory is a measured number, not an estimate. Cache behaviour is established by
comparing two runs, not by one green tick.

### Project Structure Notes

| Path | Change |
|---|---|
| `.forgejo/workflows/ci.yml` | **NEW** — the only file this story creates. First executable workflow on a protected branch. |
| `.forgejo/workflows/README.md` | Untouched (Story 1.13's D9 placeholder). Its text may need a follow-up once `ci.yml` lands beside it. |
| `.github/workflows/CI.yml` | **Read only.** No action is taken on GitHub (D7). |
| `_bmad-output/implementation-artifacts/deferred-work.md` | UPDATE — flaky test, artifact retrieval. |
| `docs/migration-decisions.md` | UPDATE — changelog row. |

Nothing in `src/`, no `package.json` change, no Dockerfile change.

### References

- `epics.md` — Story 2.1 (ACs), Epic 2 goal and its implementation note ("required status checks
  must not be enabled until a second runner is online"), FR1–FR4, NFR1.
- `docs/migration-decisions.md#d12` — per-action verdicts, the artifact failure, the `--add-host`
  fix; `#d9` — the legacy-fallback invariant; `#d10`/`#d13` — runner configuration and traps;
  `#d15` — where `VITE_*` values live now.
- `docs/runners/README.md` — the two hardcoded load-bearing values, the drift checks, the silent
  cache trap.
- `deferred-work.md` — artifact retrieval, dispatch budgets, org-secret visibility.
- `_bmad-output/implementation-artifacts/1-12-…md` — appendix with the proven OpenBao read step;
  Dev Agent Record for the method rules this story inherits.

---

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

---

## Open Questions for Review

### Blocking

1. **The dispatch route (§7).** AC6 requires a manual `workflow_dispatch`, which needs a token or
   Oleg's hand in the UI. The push-to-probe-branch workaround from Story 1.12 does not satisfy this
   AC's wording.

### Non-blocking

2. **`VITE_API_BASE_URL` (§3)** — recommendation is a CI-only literal; Story 3.3 owns real values.
3. **The flaky test (§5)** threatens Story 2.5's "five consecutive green" and Story 2.6's required
   checks. Someone should own it before 2.6, not after.
4. **Artifact retrieval (§2)** has no API on this instance. Story 2.3's "downloadable" AC currently
   has no way to be satisfied; better to discover that now than in 2.3.
5. **`force_pull: true`** may re-pull `node:20-bookworm` on every job despite both dinds having it
   cached. If Story 2.4's budget is tight, this is the first thing to measure.
