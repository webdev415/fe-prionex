---
baseline_commit: 9eb433f6
---

# Story 1.9: Provision the Second Runner

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a second runner online before merges depend on Forgejo checks,
so that one runner failing does not freeze every merge into `main`.

## 🚨 Read this before anything else

This story duplicates infrastructure that already exists and works. That makes it the *easiest*
story in Epic 1 to do correctly and the easiest to do carelessly — everything you need was learned
the hard way by Stories 1.7 and 1.8, and all of it is written down. Four things matter most.

### 1. AC1's second clause is wrong, and following it literally will waste your time

The epic says «**And** both runners appear as online in the **organization** runner list.» That text
predates `sprint-change-proposal-2026-08-07-runners.md` §4.2, which moved registration from
organization to **repository** scope. Story 1.7's AC2 requires the opposite of what AC1 now asks:
*"our runner does not appear as available to other `CRM` repositories"* — verified repeatedly, most
recently on 2026-08-11.

**A repository-scoped runner will never appear in `GET /orgs/CRM/actions/runners`.** It appears in
`GET /repos/CRM/fe-prionex/actions/runners`. AC4 below restates the clause against the right list.
Do not "fix" this by registering at org scope — that would undo a deliberate decision and expose
our runner to every repository in `CRM`.

### 2. You do NOT need a new subnet, and therefore no escalation to `aleksey`

Story 1.7 had to get `192.168.226.0/24` added to the nginx ACL on a shared production host,
coordinated with the hub administrator. **You do not repeat that.** Verified 2026-08-12:

- `192.168.226.0/24` is already in the ACL and is **ours**.
- Inside it, only `.2` (`dind`) and `.3` (`runner`) are taken. `.4`–`.254` are free.

So the second runner belongs in the **same compose project, on the same network**, taking a free
address. Giving it its own project and subnet (`.227`) would need an ACL edit, another
administrator round-trip, and buys nothing.

🛑 **If you find yourself about to edit `/etc/nginx/sites-available/forgejo-platform`, stop.** That
is a shared production host and a Task 2 escalation, not a step.

### 3. Everything Stories 1.7 and 1.8 paid for, you inherit

Do not rediscover any of this. Each line cost a failed run or a code-review finding:

| Fact | Consequence for you |
|---|---|
| A **bare label is not host mode** — it resolves to `docker://node:22-bookworm` | Register with the **full spec**: `node-20:docker://node:20-bookworm,docker-build:docker://code.forgejo.org/oci/docker:cli`. Story 1.7 got this wrong, both jobs failed, and it cost a re-registration and a `DELETE` |
| `--no-interactive` **does not read stdin** on this image | Use the interactive form: `printf '<url>\n<token>\n<name>\n<labels>\n' \| docker run --rm -i … forgejo-runner register --config …` |
| The API reports labels **bare** and cannot discriminate | Verify against `.runner` on the host, not the API. **Never commit `.runner`** — it holds the runner's permanent instance secret |
| `docker exec … docker …` fails on the `dind` sidecar | It has **no unix socket**. Use `-H tcp://localhost:2375` |
| `docker kill` does **not** trigger the restart policy; `docker exec … kill -9 1` **silently no-ops** | A genuine crash test signals the **host-side PID** from `docker inspect --format '{{.State.Pid}}'` |
| Job containers cannot reach the registry by name | `--add-host git.crm-prionex.com:10.67.0.1` in `container.options` — split-horizon DNS resolves it publicly otherwise |
| `docker/build-push-action` fails even with that | buildx spawns its **own** BuildKit container. Use `driver: docker` on `setup-buildx-action` so the push goes through the daemon |
| A missing cache server **does not fail a job** | It goes green and caches nothing. Assert on a cache **hit**, never on step colour |
| There is **no cancel endpoint** | Only start runs you are willing to watch finish |

### 4. Do not cite AD-6 as an absolute rule

Story 1.7 justified the DinD architecture with «хостовый `docker.sock` не монтируется ни в один
сервис, никогда». Direct inspection during its code review found **six** runner projects on s1, and
`/opt/forgejo-runner-deploy` mounts the host socket deliberately with the risk accepted in its own
compose banner. The real rule: **build runners use DinD; the deploy runner is a documented
exception.** Your runner is a build runner, so DinD is right — but cite the rule correctly.

### Prohibitions

1. **Never write any API token, or any substring of it, into any file.** Shell only. Four tokens are
   already live (`fe_tmp_1_7`, `fe_review_1_7`, `fe_ac3_close`, `fe_pkg_cleanup`) — reuse, do not
   mint, unless you also open a tracked revocation entry.
2. **Never emit `runs-on: ubuntu-latest`, `s1`, `ci`, `build-crm`, `deploy-dev-preprod` or
   `s2-prod-deploy`.** Those belong to four foreign org runners and execute immediately.
   ⚠️ Note the change: `dev`, `preprod`, `deploy` and `deploy-dev-preprod` become *intended* deploy
   targets from Epic 4 (`sprint-change-proposal-2026-08-11-deploy-runner.md`) — but not for you.
3. **Do not change runner 1.** It is Story 1.7's deliverable and Story 1.8's evidence base. Adding a
   service beside it is fine; editing its config, labels or cache is not, except where Task 5
   explicitly requires it.
4. **Do not widen the nginx ACL or the firewall.** See §2 — you do not need to.
5. **Do not register at organization scope.** Repository scope is the decision.
6. **Do not put a workflow file on `main`, `staging` or `development`**, and never delete
   `.forgejo/workflows/README.md` (blob `c9aeac2f0f0adf492d66781e3fbd330217844ee2`).

## Acceptance Criteria

> AC1–AC3 are verbatim from `epics.md:696-708`. AC4–AC7 are marked `[DERIVED]` and justified inline.

**AC1 — the second runner exists at repository scope with identical labels**

**Given** the primary runner from Story 1.7 is operational
**When** a second runner is registered at the same **repository** level
**Then** it carries the identical `node-20` and `docker-build` labels
**And** both runners appear as online in the organization runner list.

> 🚨 **The last clause is stale — see §1.** Repository-scoped runners do not appear in the
> organization list, by design and by Story 1.7's AC2. AC4 restates it correctly. Satisfy AC4; record
> that AC1's final clause was superseded by the org→repository scope change rather than silently
> ignoring it.

**AC2 — failover: the surviving runner picks up the work**

**Given** both runners are online
**When** the primary runner is deliberately stopped and a CI job is queued
**Then** the job is picked up by the second runner and completes
**And** the primary runner is restarted afterwards.

**AC3 — jobs distribute rather than serialize**

**Given** two runners are available
**When** four CI jobs are triggered simultaneously
**Then** the jobs distribute across both runners rather than serializing on one.

> ⚠️ Story 2.1 — which creates the four real CI jobs — is `backlog`. You synthesize four jobs in a
> throwaway probe workflow. With `capacity: 2` on each runner, four jobs is exactly the concurrency
> the pair provides, so a serialized result is unambiguous evidence of failure rather than of
> saturation.

**AC4 — [DERIVED] both runners are online in the *repository* runner list**

**Given** registration is at repository scope
**When** `GET /repos/CRM/fe-prionex/actions/runners` is read
**Then** it returns exactly two runners, both `idle` or `active`, with `repo_id: 16`
**And** `GET /orgs/CRM/actions/runners` contains neither of them
**And** the four foreign org runners (ids 10, 12, 14, 17) are unchanged.

> Derived, not taken from the epic's AC list.
> **Claim.** AC1's "organization runner list" clause cannot be satisfied and must not be attempted.
> **Evidence.** `sprint-change-proposal-2026-08-07-runners.md` §4.2 moved scope to repository;
> Story 1.7 AC2 requires absence from the org list; `#d10` and `#d12` record the observed state.
> **Consequence if omitted.** A dev agent reading AC1 literally re-registers at org scope, exposing
> our runners to every repository in `CRM` and undoing an approved decision.

**AC5 — [DERIVED] the failover proof is a real crash, not an operator stop**

**Given** AC2 says "deliberately stopped"
**When** the failover is demonstrated
**Then** the method is recorded explicitly — and if the intent is to prove resilience rather than
scheduling, the primary is killed by signalling its **host-side PID**, not by `docker stop`
**And** `docker exec … kill -9 1` is not used, because it silently no-ops in this image
**And** the primary is confirmed back to `idle` in the repository runner list afterwards.

> Derived, not taken from the epic's AC list.
> **Claim.** "Stopped" is ambiguous, and the two readings prove different things: `docker stop`
> proves the scheduler skips an offline runner; a crash proves the pair survives a failure.
> **Evidence.** Story 1.7's first durability test was a false negative because `docker kill` is
> treated as an intentional stop and does not trigger `restart: unless-stopped`; and
> `docker exec … kill -9 1` reports `exit=0` without delivering the signal (`deferred-work.md`).
> **Consequence if omitted.** The story reports failover that was never exercised, on a pair whose
> whole purpose is to keep merges unblocked when a runner dies unexpectedly.

**AC6 — [DERIVED] the runner configuration stops being unversioned**

**Given** `/opt/forgejo-runner-fe-prionex/` is the only record of how these runners are built, and
this story doubles it
**When** the second runner is provisioned
**Then** a sanitised copy of `config.yml` and `docker-compose.yml` is committed to this repository,
with every secret and the `.runner` file excluded
**And** the two load-bearing hardcoded values are documented where they are set —
`cache.host` (a pinned container IP) and `container.options`' `--add-host` and `DOCKER_HOST`.

> Derived, not taken from the epic's AC list.
> **Claim.** Reproducibility was deferred *to this story* by name.
> **Evidence.** `deferred-work.md`: «**The runner's host configuration is unversioned, and two
> hardcoded addresses are load-bearing — for Story 1.9** … Reviewed 2026-08-11 — Oleg: carry to
> Story 1.9, which provisions the second runner with the same pattern and is the right place to
> decide whether a sanitised config belongs in the repository.»
> **Consequence if omitted.** Two runners now exist whose only definition lives on one host, and a
> cache failure is silent (Trap 3) — nothing in the repository could detect or rebuild them.

**AC7 — [DERIVED] the scaffolding is gone and the D9 invariant is intact**

**Given** AC3 requires a probe workflow and a throwaway branch
**When** the story completes
**Then** the probe branch is deleted locally and on `origin`, and no `.forgejo/workflows/*.yml`
exists on `main`, `staging` or `development`
**And** `README.md` is present and byte-identical (`c9aeac2f…`) on all three refs, verified
**both** git-side and server-side
**And** `.github/workflows/` is byte-for-byte unchanged
**And** both runners remain registered — they are the deliverable.

> Derived, not taken from the epic's AC list. Same standard as Story 1.7 AC8 and Story 1.8 AC6,
> both of which passed cleanly; this is the third application of a proven check.

## Tasks / Subtasks

### Task 1 — Pre-flight (AC: 1, 4)

- [ ] 1.1 Source the existing token on s1: `. /root/.fj_token`. **Do not mint a new one** unless it
      is gone — four are already live and the policy question is open (see Open Questions). If you
      must mint, open a tracked revocation entry in `deferred-work.md` in the same commit.
- [ ] 1.2 Re-verify: `GET /api/forgejo/v1/version` → `15.0.5+gitea-1.22.0`; repo flags
      `has_actions: true`, `has_pull_requests: false`, `has_packages: true`, `repo_id: 16`.
- [ ] 1.3 Read both runner lists. Expect repo: exactly one runner, `id: 19`, `idle`. Expect org:
      ids 10, 12, 14, 17. **Any new runner is drift** — record it and add its labels to the
      forbidden set before writing any workflow.
- [ ] 1.4 Confirm runner 1's full label spec from `/opt/forgejo-runner-fe-prionex/data/runner/.runner`
      — the API returns labels bare and cannot discriminate. You will copy this spec exactly.
- [ ] 1.5 Confirm the subnet facts in §2 still hold: `192.168.226.0/24` in the nginx ACL, `.2` and
      `.3` taken, the rest free. If something else has claimed an address, pick another free one —
      do not renumber the existing runner.
- [ ] 1.6 Record the run/task counters before you start (`GET .../actions/runs` and
      `.../actions/tasks`). 🚨 Tasks are jobs, not runs — never compare the two numbers.
- [ ] 1.7 **Declare the write budget and enumerate every mutating call.** Story 1.7's and 1.8's were
      both found stale in review; 1.8's could not even be checked because its planned count was
      never bound to a number. Yours: one registration token, one runner registration, N probe
      commits, M dispatches — **bind N and M** — one branch delete, the closing commits. Close the
      ledger at the end, not mid-session.

### Task 2 — Add the second runner to the existing compose project (AC: 1)

- [ ] 2.1 Back up `/opt/forgejo-runner-fe-prionex/docker-compose.yml` and `config.yml` first, with
      a dated filename (Story 1.8's `config.yml.bak-story1.8-…` is the precedent).
- [ ] 2.2 Add a second `runner` service to the **same** compose project and the **same** network,
      with a free static address (`.4` is the obvious choice). Name it **`s1-fe-prionex-2`**, per
      Story 1.7's `<host>-<purpose>-<n>` convention.
- [ ] 2.3 🚨 **Decide and record: shared `dind` or its own?** Sharing the existing `dind` at `.2` is
      simpler and lets a runner-1 crash leave runner 2 working — which is exactly what AC2 tests.
      But it makes `dind` a single point of failure for both, which partly defeats the story's
      purpose. Giving runner 2 its own sidecar costs one more container and removes that coupling.
      **Recommended: its own `dind`.** Whichever you choose, say why, and say plainly what the
      chosen option does *not* protect against.
- [ ] 2.4 Give runner 2 its **own** `cache.host` — its own container IP, not `.3`. Each runner runs
      its own cache server; pointing runner 2 at runner 1's address would make the cache die with
      runner 1, which AC2 then wouldn't notice because a missing cache server goes green (Trap 3).
- [ ] 2.5 Copy `container.options` verbatim from runner 1, including
      `--add-host git.crm-prionex.com:10.67.0.1` and `DOCKER_HOST`. Without the first, jobs on
      runner 2 cannot reach the registry at all; Story 1.8 proved this and Story 3.1 depends on it.
- [ ] 2.6 Pin the same image, `code.forgejo.org/forgejo/runner:13.0.0`. `:latest` does not exist and
      `:6` cannot run `node24` actions. Same `capacity: 2`, same `restart: unless-stopped`.

### Task 3 — Register it at repository scope with the full label spec (AC: 1, 4)

- [ ] 3.1 Get a registration token: `GET /repos/CRM/fe-prionex/actions/runners/registration-token`.
      Registration tokens are single-use-to-register, not reusable credentials.
- [ ] 3.2 🚨 Register with the **full label spec**, not bare names:
      `node-20:docker://node:20-bookworm,docker-build:docker://code.forgejo.org/oci/docker:cli`.
      A bare label silently resolves to `docker://node:22-bookworm` — Story 1.7 shipped that
      mistake, both probe jobs failed, and fixing it cost a re-registration plus a `DELETE`.
- [ ] 3.3 Use the **interactive** stdin form; `--no-interactive` does not read stdin on this image
      (`instance address is empty`). Pipe via `printf … | docker run --rm -i …`, never as CLI args —
      arguments are visible in `ps aux`.
- [ ] 3.4 Confirm the registration output names both labels **with their `docker://` suffixes**, and
      that no `Labels from command will be ignored` line appears (that means `runner.labels` in the
      config won, Trap 5).
- [ ] 3.5 Verify against `.runner` on disk **and** the repo API list. Expect two runners, both
      `repo_id: 16`. Record both payloads.

### Task 4 — Prove failover (AC: 2, 5)

- [ ] 4.1 Author a throwaway probe workflow on a branch cut from `main`
      (`probe/second-runner`), `on: workflow_dispatch` only, filename outside Story 2.1's reserved
      set (`ci.yml`, `build.yml`, `deploy-*.yml`, `dev-reset.yml`). Only `node-20` / `docker-build`.
      🚨 Use block scalars (`run: |`) for any `run:` containing a colon-space — a one-liner with
      `: ` in it is parsed as a mapping and the dispatch fails with
      `yaml: line N: mapping values are not allowed in this context`. Story 1.3 hit this; so did
      Story 1.8's code review, which is why it is called out here.
- [ ] 4.2 Stop runner 1 (record the method, per AC5), dispatch a job, and observe it land on
      runner 2. **Attribute it by direct evidence**, not by elimination: the runner-side log carries
      `[<workflow>/<job>]` prefixes. ⚠️ Log level is `info`; raise `log.job_level` to `debug` for the
      dispatches and **revert it afterwards** (Task 7.3).
- [ ] 4.3 Restart runner 1 and confirm it returns to `idle` in the repository list.
- [ ] 4.4 🚨 The transient `offline` state may be unobservable: Forgejo's heartbeat window is far
      longer than a container restart, so a runner that recovers in ~1s never surfaces as `offline`
      (established in Story 1.7's review). If you want to observe `offline`, you must leave it
      stopped — that tests the API's timeout, not the restart policy. Record which you did.

### Task 5 — Prove distribution (AC: 3)

- [ ] 5.1 Extend the probe with **four** jobs, all `runs-on: node-20`, each doing enough work to
      overlap (a `sleep` is honest here — you are testing the scheduler, not the workload).
- [ ] 5.2 Dispatch once and record, per job: task id, name, **which runner executed it**, and
      `created`/`started`/`stopped` with timezone. Distribution is proven by two runners appearing
      in the attribution, not by total duration.
- [ ] 5.3 🚨 Do not infer scheduling from job status transitions. Forgejo bug
      [#10259](https://codeberg.org/forgejo/forgejo/issues/10259) makes a job blocked by a
      concurrency group report `waiting`, identical to one waiting for a free slot. **Use
      timestamps.**
- [ ] 5.4 With `capacity: 2` each, four jobs is exactly the pair's capacity. If they serialize onto
      one runner, that is a real failure, not saturation — say so plainly rather than hedging.

### Task 6 — Version the runner configuration (AC: 6)

- [ ] 6.1 Commit a **sanitised** copy of `config.yml` and `docker-compose.yml` into this repository
      under a path that makes their nature obvious (e.g. `docs/runners/` or
      `infra/forgejo-runner/`). Choose one, state why, and do not scatter them.
- [ ] 6.2 🚨 **Exclude every secret.** No `.runner` (it holds the permanent instance secret), no
      registration token, no `.env` values. Replace them with placeholders and a comment saying
      where the real value lives.
- [ ] 6.3 Document, at the point where each is set, the two load-bearing hardcoded values:
      `cache.host` (a pinned container IP — if the project is renumbered the cache dies **silently**,
      Trap 3) and `container.options`' `--add-host` (without it, no job can reach the registry) and
      `DOCKER_HOST`.
- [ ] 6.4 State plainly what the committed copy is **not**: it is a record, not a deployment
      mechanism. Nothing applies it automatically, and it will drift unless someone updates it.

### Task 7 — Tear down and verify (AC: 7)

- [ ] 7.1 Delete the probe branch locally and on `origin` **after** the last dispatch. Confirm with
      `git branch -a` and `GET /repos/CRM/fe-prionex/branches`.
- [ ] 7.2 Verify the D9 invariant **both** ways — git-side (`git ls-tree` on all three refs → blob
      `c9aeac2f…`, no `.yml`) and server-side
      (`GET .../contents/.forgejo/workflows?ref=<r>`). Story 1.8 did both; do not drop to one.
- [ ] 7.3 Revert `log.level`/`log.job_level` to `info` and confirm no `[DEBUG]` lines after the
      restart. ⚠️ State whether you used `--since`; a whole-stream `grep` of 0 would contradict
      evidence you drew from the same stream (a finding from Story 1.8's review).
- [ ] 7.4 `git diff 9eb433f6 -- .github/workflows/` → must be empty.
- [ ] 7.5 Confirm **both** runners are registered and `idle` at the end. They are the deliverable.
- [ ] 7.6 Two commits split by area — `docs(migration):` for `docs/`, `chore(bmad):` for
      `_bmad-output/`. Full husky suite on `main`; `--no-verify` forbidden there, permitted on the
      probe branch and logged against the budget. Known flake: a Radix `focus-scope` timer test —
      if 1921 tests pass but the run exits non-zero, **retry once** before treating it as a
      regression.
- [ ] 7.7 After **every** push, re-check the run counter against Task 1.6's baseline. Story 1.7's
      review found this check had covered only the first of three pushes.

### Task 8 — Record the outcome (AC: 4, 5, 6)

- [ ] 8.1 Take the next free decision anchor. `D12` is Story 1.8's; **`D11` is still reserved by
      Story 1.6**, which has not run. Take **`D13`** and leave the reservation intact — Story 1.7
      renumbered 1.6 once and its code review had to repair the positional instructions afterwards.
- [ ] 8.2 Record: both runners with ids and label specs, the shared-vs-own-`dind` decision and its
      reasoning, runner 2's `cache.host`, the failover method and evidence, the distribution
      evidence, and where the sanitised config now lives.
- [ ] 8.3 Follow the file's conventions: Russian prose, English identifiers, explicit
      `<a id="d13"></a>`, index-table row after D12, **extend the anchor range at
      `docs/migration-decisions.md:8`** (omitting this has been a review finding three times),
      changelog row appended.
- [ ] 8.4 Amend `docs/forgejo-migration.md` Фаза 1 item 5 («Поднять второй runner») by **marking,
      not rewriting** — `✅` annotation only, no strikethrough; that file already uses `~~…~~` with
      two conflicting meanings.
- [ ] 8.5 Close the `deferred-work.md` items this story consumes: the unversioned-config item, the
      `docker exec kill -9 1` no-op, and the Trap 1 warning. Do not re-file them.
- [ ] 8.6 🚨 **Citation discipline.** Prefer anchors to line numbers. `docs/forgejo-migration.md`
      moved **three times** on 2026-08-11 alone; if you insert lines into it, re-verify every
      citation *into* it across the repository, not only the ones you wrote. Count before asserting.
- [ ] 8.7 Update `sprint-status.yaml` and this file's `Status:`. Verify the prior value before
      writing — Story 1.7 claimed a verified prior value that git disproved.

## Dev Notes

### What this story produces

1. **A second live runner**, `s1-fe-prionex-2`, repository-scoped on `CRM/fe-prionex`, with labels
   identical to runner 1, on the existing `192.168.226.0/24` network.
2. **Evidence of failover and distribution** — the only reason the runner exists.
3. **A sanitised, version-controlled copy of the runner configuration** (AC6), which is the first
   time this project's runner definitions exist anywhere but on one host.
4. **A decision record** (`#d13`) and a marked Фаза 1 item 5.
5. **Nothing durable in the repository under `.forgejo/workflows/`.**

### The argument in one paragraph

Story 2.6 makes merges into `main` depend on Forgejo checks. From that moment a single runner is a
merge freeze waiting to happen — `docs/forgejo-migration.md` says it outright: «упавший
единственный runner замораживает все мержи». This story removes that. The work itself is a copy of
Story 1.7, which is why the risk here is not difficulty but **carelessness**: every trap that story
hit is documented, and re-hitting one would mean the documentation was never read. The one genuinely
new decision is whether the two runners share a `dind` sidecar, and it is a real trade-off rather
than a formality.

### Inherited state — runner 1 as it stands today (verified 2026-08-12)

```yaml
# /opt/forgejo-runner-fe-prionex/ — compose project, network 192.168.226.0/24
#   dind   = .2   docker:27.5.1-dind, privileged, dockerd -H tcp://0.0.0.0:2375 --tls=false
#   runner = .3   code.forgejo.org/forgejo/runner:13.0.0, restart: unless-stopped
runner:    { labels: [], capacity: 2 }
container:
  docker_host: "tcp://dind:2375"
  options: "-e DOCKER_HOST=tcp://172.17.0.1:2375 --add-host git.crm-prionex.com:10.67.0.1"
  network: ""
  valid_volumes: []
cache:     { host: "192.168.226.3", proxy_port: 34568 }
log:       { level: info, job_level: info }
```

Labels from `.runner` (the API elides the suffixes):
`node-20:docker://node:20-bookworm`, `docker-build:docker://code.forgejo.org/oci/docker:cli`.

Host headroom, measured: **104 cores, ~90 GB available memory, 683 GB free on `/opt`.** A second
runner plus sidecar is not a capacity question on this host — but s1 also carries five other runner
projects, `techno-finance` and the observability stack, so do not treat headroom as licence.

### Live-instance facts (re-verify in Task 1)

- Instance `https://git.crm-prionex.com`, `15.0.5+gitea-1.22.0`. Anonymous API refused; header is
  `Authorization: token $FJ_TOKEN`, **not** `Bearer`.
- Repo `CRM/fe-prionex`: `repo_id: 16`, `has_actions: true`, `has_pull_requests: false`,
  `has_packages: true`, `default_branch: main`.
- **Repo runners:** exactly one — `id: 19`, `s1-fe-prionex-1`, `idle`, v13.0.0.
- **Foreign org runners, do not touch:** `ci-hub` 10 (`ubuntu-latest`), `s1-build-crm` 12
  (`s1`/`ci`/`build-crm`), `s1-deploy-dev-preprod` 14, `s2-prod-deploy` 17 (on **s2**).
- **nginx ACL** allows `10.67.0.0/24`, `10.70.0.0/24`, `192.168.221–226.0/24`. Ours is `.226`.
- **`10.67.0.1` and `10.70.0.1` are both s1** — `wg-clients` and `wg-private` WireGuard interfaces.
  nginx binds `0.0.0.0:443`, so both serve the registry. This confused two review layers; it is not
  a discrepancy.
- Endpoints known **absent**: `POST .../actions/runs/{id}/cancel`, `GET /api/v1/settings/actions`,
  and **any Actions-artifacts endpoint** (314 swagger paths; only storage quotas).
- Org secrets **are** visible to workflows in this repository — proven by Story 1.8's
  `docker/login-action` authenticating with `${{ secrets.REGISTRY_* }}` and no repo-level copy.

### Anti-patterns for this story

- ❌ **Registering at organization scope** to satisfy AC1's stale clause.
- ❌ **A new subnet or an ACL edit.** `.226` is ours with free addresses.
- ❌ **Bare labels** at registration.
- ❌ **`docker stop` presented as a crash test**, or `docker exec … kill -9 1` used at all.
- ❌ **Pointing runner 2's `cache.host` at runner 1.**
- ❌ **Omitting `--add-host`** from runner 2's `container.options`.
- ❌ **Committing `.runner`, a registration token, or any `.env` value.**
- ❌ **Claiming distribution from durations** instead of per-job runner attribution.
- ❌ **Citing AD-6 as an absolute rule.**
- ❌ **Relying on `latest` for the runner image**, or falling back to `:6`.
- ❌ **`--no-verify` on a `main` commit.**

### Previous story intelligence

**Story 1.7 — the runner you are copying.** Read its Tasks 3–5 and its `### Review Findings`. Its
review found: a false-negative crash test (`docker kill` doesn't trigger the restart policy), a
write budget understated by half, six citations broken by its own edits, and AD-6 asserted from a
miscounted sample. Its *mechanics* are sound and reusable; its *record-keeping* is the cautionary
part.

**Story 1.8 — what runs on these runners.** Established that `checkout@v6`, `setup-node@v4`,
`setup-buildx@v3`, `metadata@v5`, `login@v3` and `build-push@v5` all resolve, that
`upload-artifact@v4` does **not** (`GHESNotSupportedError`, pin `v3`), and that a registry push needs
**both** `--add-host` and `driver: docker`. Its review also caught an assertion with no
discriminating power — `node --version` on a `node:20-bookworm` image — which is worth remembering
when you write AC3's four jobs: **make each job's evidence something only the intended path can
produce.**

**Story 1.6 (`ready-for-dev`, deliberately not started).** Holds the `D11` reservation Task 8.1
leaves alone.

### Git intelligence

```
9eb433f6  chore(bmad): close AC3 — driver=docker is the fix, story 1.8 done   ← origin/main
9368ff01  chore(bmad): apply story 1.8 code review findings
85bb17e8  chore(bmad): story 1.8 code review — AC3 re-dispatched, push blocker diagnosed
759aff69  chore(bmad): story 1.8 to review — smoke workflow proved 6 of 8 actions
64001a14  docs(migration): record D12 — story 1.8 action-compatibility smoke test
```

Conventional Commits with a scope; **no `KAN-###`**; `docs(migration):` for `docs/` and `.forgejo/`,
`chore(bmad):` for `_bmad-output/`; code-review findings land in their own commit rather than an
amend. **This story file is committed at create-story time**, before any dev work — the process
expectation Story 1.7's review opened and Story 1.8 was the first to meet.

### Testing standards

No automated suite applies; the probe workflow is the test. The project's evidence standard:

- **Observation over assertion.** Every AC closed by a captured API response or a quoted log line.
  Record run **index and id**, job ids and names, `created`/`started`/`stopped` with timezone,
  durations. Write the full table the first time — three stories in a row were faulted for not.
- **Definite yes/no**, and **«не проверено»** with a reason where you could not check. Never let an
  unchecked thing read as checked.
- **Attribution by direct evidence**, not elimination — this matters more here than anywhere,
  because the entire story is about *which* runner did the work.
- **Retro-annotate rather than silently tick.** `⚠️ [x] = attempted, not performed as specified`.
- Do not move to `review` with any `[ ]` subtask open.

### Project Structure Notes

- `.forgejo/workflows/` holds exactly one tracked file, `README.md`. Story 2.1 fills it; you only
  ever add a file there on a throwaway branch, under a name outside Story 2.1's reserved set.
- `.gitea/workflows/` does not exist and must not be created.
- **Language split:** `docs/` is Russian (identifiers stay English); workflow YAML and
  `_bmad-output/` story files are English.
- Runner artefacts live on s1 — except the sanitised copy AC6 introduces, which is new and
  deliberate.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md:688-708`] — Story 1.9 and its three ACs.
- [Source: `_bmad-output/planning-artifacts/epics.md:167`] — FR29, the second runner before required
  checks.
- [Source: `_bmad-output/planning-artifacts/epics.md:696-699`] — AC1, including the stale
  organization-list clause AC4 corrects.
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-07-runners.md` §4.2] —
  the org → repository scope change.
- [Source: `docs/migration-decisions.md#d10`] — runner 1's full configuration, the cache finding,
  the DinD residual risk, and the AD-6 correction.
- [Source: `docs/migration-decisions.md#d12`] — the action verdicts, the `--add-host` fix and the
  `driver: docker` requirement.
- [Source: `docs/migration-decisions.md#d9`] — the per-commit `.forgejo/workflows/` invariant and
  the absence of a cancel endpoint.
- [Source: `docs/forgejo-migration.md` Фаза 1 item 5] — «Поднять второй runner», the item this story
  closes.
- [Source: `_bmad-output/implementation-artifacts/1-7-provision-the-primary-forgejo-runner-with-both-labels.md`]
  — the registration mechanics, the five traps, and a code review whose findings are the failure
  modes most likely to recur.
- [Source: `_bmad-output/implementation-artifacts/1-8-prove-action-compatibility-with-a-smoke-workflow.md`]
  — what these runners can execute, and the probe-workflow pattern including the YAML colon-space
  trap.
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`] — the unversioned-config item
  routed to this story by name, the `kill -9 1` no-op, and the token model.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Open Questions for Review

1. **Shared `dind` or one per runner?** Task 2.3 recommends one each, so a sidecar failure cannot
   take both runners down — but that is the more expensive option and the coupling only matters if
   `dind` itself fails, which has not happened. Worth a deliberate answer rather than a default.
2. **Where do the sanitised configs live?** `docs/runners/` reads as documentation;
   `infra/forgejo-runner/` reads as infrastructure-as-code and might invite someone to think it is
   applied automatically. Task 6.4 requires saying it is not.
3. **The token policy is now overdue.** Four live tokens (`fe_tmp_1_7`, `fe_review_1_7`,
   `fe_ac3_close`, `fe_pkg_cleanup`) where the model calls for one, and one earlier token vanished
   from the host unexplained. The platform's own answer — named robot accounts (`robot-registry`,
   `robot-deploy`) rather than tokens on a human admin — is worth adopting before Story 1.12.
4. **Should `capacity` stay at 2 for both?** Four concurrent jobs matches Story 2.1's four CI jobs
   exactly, with no headroom for a second concurrent CI run. On a 104-core host that is
   conservative; raising it is cheap and reversible, but it changes what AC3 proves.
