---
baseline_commit: 598de32c
---

# Story 1.8: Prove Action Compatibility with a Smoke Workflow

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform engineer,
I want every third-party action the migration depends on exercised on this instance before
any real workflow is ported,
so that incompatibilities surface as a throwaway failure rather than as a broken pipeline.

## 🚨 Read this before anything else

This story is the **gate** the whole migration plan puts in front of Epics 2–7:
`epics.md:233-234` — "Action compatibility smoke test must run **before** any real workflow is
ported". Story 1.7 finished the runner and deliberately left the other half of Фаза 1's DoD open
for you (`docs/forgejo-migration.md:158`, and Story 1.7 Task 9.4 says so in as many words). Four
things make this story harder than it looks.

### 1. Two of your four ACs rested on infrastructure that does not exist — Oleg has now settled both

`epics.md` declares **no prerequisites** for this story. That is a hole in the epic, not a licence
to improvise. The create-story pre-flight found it by probing the live instance, and **Oleg decided
all three open points on 2026-08-11 before this story was released for dev.** They are recorded
here so you do not re-open them:

| Point | Decision (Oleg, 2026-08-11) |
|---|---|
| **AC3 — registry credential** | **Use the existing org secrets `REGISTRY_USER` + `REGISTRY_TOKEN_RW`.** They already exist on the `CRM` org and almost certainly belong to the `robot-registry` account (see §5). Story 1.10 therefore becomes "adopt and document", not "create". |
| **AC3 — network fix** | **Approved.** Add `--add-host git.crm-prionex.com:10.67.0.1` to `container.options` on s1. Back the config up first and log the edit against the write budget. |
| **AC4 — SSH to s1** | **Rescoped: deployment will run on a runner located on the target host, not over `ssh`/`scp` from a build job.** See §6. |

What remains genuinely human-only:

| Part | Who | Can the dev agent do it? |
|---|---|---|
| Any *further* change to s1's firewall or nginx ACL | **Oleg** (+ hub admin `aleksey`) | ❌ no — and none is needed now |
| Confirming with `aleksey` that `REGISTRY_TOKEN_RW` is ours to use | **Oleg** | ❌ no — Task 2.1 |
| Everything else in this story | dev agent | ✅ yes |

**Still forbidden regardless:** do not land `S1_SSH_*` into Forgejo to unblock anything. That is a
partial Story 1.12 executed out of order on a repository where **497 of 501 remote branches still
carry an executable legacy `CD.yml`** (D9) — the exact protection 1.12 is scheduled to remove
deliberately. Removing it by accident would be the worst outcome this plan can produce, and after
the AC4 rescope there is no longer any reason to go near it.

### 2. You cannot stop a run once it starts — and this story starts the longest ones yet

`POST /api/v1/repos/CRM/fe-prionex/actions/runs/{id}/cancel` → **404. The endpoint does not exist
in Forgejo 15.0.5.** Confirmed against the full swagger by Story 1.13, restated in
`deferred-work.md` naming Stories 1.7, **1.8** and 4.4 explicitly, and again in
`docs/migration-decisions.md#d9`.

Story 1.7's runs took ~30–60 s. **Yours will build and push a Docker image** — minutes, not
seconds. Budget the wall clock, and never start a run you are not prepared to watch finish.

**Never emit `runs-on: ubuntu-latest`, `s1`, `ci`, `build-crm`, `deploy-dev-preprod` or
`s2-prod-deploy`.** Those six labels belong to four foreign org runners; a stray trigger lands on
them immediately because they are idle, and you cannot call it back. Only `node-20` and
`docker-build` are yours.

> ⚠️ The `ubuntu-latest` prohibition was written into Story 2.1 and "inherited by Epics 3–7"
> (`sprint-change-proposal-2026-08-07-runners.md:98`). **Story 1.8 sits in Epic 1 and is named by
> neither clause** — yet it is the first story in the plan that authors a workflow file. AC7 below
> closes that wording gap.

### 3. The network is not what the ACs assume — three findings from live probing

All three were established on 2026-08-11 from **inside the nested `dind` engine**, i.e. from what a
job container actually is. Testing from the host or from the outer `dind` container gives false
positives — that is the method Story 1.7 had to discover the hard way (Trap 2 variant).

**(a) Egress works — AC1's mirror branch will not fire.** From a job-equivalent container:
`https://github.com` → **200**, `https://api.github.com` → **200**, `https://code.forgejo.org` →
**303**, `https://registry.npmjs.org` → **200**. Story 1.7 only proved this from the *host*; this
is the stronger test AC1 actually asks for. Re-verify, but expect a yes.

**(b) The registry is unreachable from job containers as currently wired — with a proven fix.**
Split-horizon DNS: `git.crm-prionex.com` resolves to `10.70.0.1` from the s1 host but to the
**public** `185.185.49.127` from inside a job container, and connecting there fails
(`OpenSSL SSL_read: unexpected eof`). Pointing at the internal IP alone does **not** save you —
the registry's auth realm is pinned to the public hostname:
`Www-Authenticate: Bearer realm="https://git.crm-prionex.com/v2/token", service="container_registry"`.
**Proven fix:** pin the hostname inside the job container. With
`--add-host git.crm-prionex.com:10.67.0.1`, a job-equivalent container gets `/v2/` → **401** and
`/v2/token?service=container_registry` → **401** — i.e. both reachable and correctly demanding
auth. This is a change to `container.options` in the runner's **unversioned** config on s1, so it
is a Task 2 decision, not a drive-by edit. **This finding is bigger than 1.8:** Story 3.1 pushes to
the same registry from the same runner and will hit exactly this wall.

**(c) SSH from a job container to s1 is impossible by firewall policy, not by a missing secret.**
`ufw` on s1 is **active** with `-P INPUT DROP`, and port 22 is allowed from exactly two admin
addresses (`81.4.156.7` "Ober home SSH", `194.156.248.138` "Aleksey SSH"). Docker subnets are not
among them, and a job-equivalent container times out on `10.67.0.1:22`, `10.67.0.1:2222` and
`git.crm-prionex.com:2222`. AC4 as originally written could not pass **even with a valid key**.
**This is now moot for this story** — see §6 — but keep the finding: it is why nobody should
attempt an SSH-based deploy from a build runner later, and it is evidence for the Epic 4
correct-course.

### 4. `.forgejo/workflows/` is armed, and you are the second story to put a `.yml` in it

The directory that currently suppresses the legacy `.github/workflows/` fallback becomes the
executor the moment it contains a `.yml` (`docs/forgejo-migration.md:271-275`). The invariant from
D9 is **per-commit, not per-branch**: any ref Forgejo resolves on a commit without
`.forgejo/workflows/` falls through to `.github/workflows/`.

1. Your probe workflow goes on a **throwaway branch cut from `main`** — never `main`, `staging` or
   `development`. Cutting from anywhere older loses the placeholder.
2. It carries **`on: workflow_dispatch` only** — no `push`, no `pull_request`, no `schedule`.
   (Forgejo also auto-cancels earlier runs of the same workflow on `push`/PR-synchronize even with
   no `concurrency` block — D8. Another reason for dispatch-only.)
3. **Never delete or modify `README.md`.** Adding a file beside it is safe; removing the last
   tracked file silently re-arms a PROD deploy. Baseline blob to preserve and re-verify:
   **`c9aeac2f0f0adf492d66781e3fbd330217844ee2`**, identical on all three refs.
4. **Do not use a Story 2.1 filename** — `ci.yml`, `build.yml`, `deploy-dev.yml`,
   `deploy-preprod.yml`, `deploy-prod.yml`, `dev-reset.yml` are reserved.

### 5. The platform already has service accounts the plan does not know about

`GET /orgs/CRM/members` returns three accounts: **`platform-admin`**, **`robot-deploy`**,
**`robot-registry`**. The five org secrets created `2026-08-10T10:14:26–27+02:00` —
`REGISTRY_USER`, `REGISTRY_USER_RO`, `REGISTRY_TOKEN_RW`, `REGISTRY_TOKEN_RO`,
`SLACK_CD_WEBHOOK_URL` — line up with them. `deferred-work.md` had recorded their provenance as
"still unanswered"; this is the answer: they are the hub's own platform credentials, not something
a previous story left behind.

**The plan's `ci-bot` does not exist** (`GET /users/ci-bot` → 403, and it is absent from the member
list). `epics.md:704-707` and FR10 both name `ci-bot`; the platform's equivalent is
`robot-registry`. Record the substitution — do **not** create `ci-bot`, and do not "fix" the plan
here; that is Story 1.10's business.

⚠️ **Forgejo secret values are write-only, so you cannot verify `REGISTRY_TOKEN_RW` before using
it.** The first `docker/login-action` step *is* the test. If it fails, that is a credential
finding, not an action-compatibility finding — say which in the verdict. Also note repo-level
secrets are currently `[]`; whether org secrets are exposed to workflows in this repository is
itself something your probe run establishes. Record it either way — Story 1.12 depends on the
answer.

⚠️ `SLACK_CD_WEBHOOK_URL` is a non-resolving `example.invalid` stub: Story 1.13 overwrote it on a
false reading of `CD.yml`, and since values are write-only the original is **unrecoverable**.
Restoration is deferred. Do not touch it and do not treat its presence as evidence of anything.

### 6. Deployment will not use SSH — AC4 is rescoped

**Oleg's decision, 2026-08-11: «деплой по runner».** Deployment runs on a runner located on the
**target host**, driving that host's own Docker daemon locally — not `ssh`/`scp` from a build job.

This is not a new invention; it is what this hub already does, which is why §3(c)'s firewall wall
exists and nobody had hit it before:

- `/opt/forgejo-runner-deploy` on s1 mounts the host `docker.sock` deliberately, with a banner in
  its own compose file — «🚨🚨🚨 Хостовой docker.sock … Это НЕ dind» / «Деплойный раннер получает
  хостовой docker.sock — риск принят». It is the documented exception to the build-runner rule.
- Org runner `s1-deploy-dev-preprod` (id 14) and the org account `robot-deploy` exist for exactly
  this.

**Consequence for AC4, and it is a simplification:** `appleboy/scp-action` and `appleboy/ssh-action`
are "confirmed as not needed" **because the architecture no longer performs SSH at all** — a
stronger result than proving native `ssh`/`scp` would have been. Task 3 records this; there is no
SSH probe to run.

🚨 **Consequence beyond this story — do not absorb it silently.** `FR19` (`epics.md:128-130`,
"scp compose file → `docker compose down` → `docker pull` … → health check") and **Story 4.3 AC2**
(`epics.md:1301-1304`, "it uses native `ssh` and `scp` in `run:` steps") now describe the wrong
mechanism, and Stories 5.3 and 6.4 inherit it. **Oleg's decision: record it here, run
`correct-course` for Epic 4 separately.** Task 8.5 files the entry; this story does not amend
`epics.md`.

### Six prohibitions

1. **Never write any API token, or any substring of it, into any file.** Standing rule from Story
   1.3's code review, restated by 1.13 and 1.7. Shell only.
2. **Do not re-enable `has_pull_requests`.** It is `false` by Oleg's decision; turning it on
   re-exposes 497 legacy branches to PR-triggered CI on `ci-hub`. Dispatch by API instead.
3. **Do not touch the foreign runners** (`ci-hub`, `s1-build-crm`, `s1-deploy-dev-preprod`,
   `s2-prod-deploy`), do not reuse their labels, do not adopt or reconfigure them.
4. **Do not change the runner's labels, cache config, capacity or image pin.** They are Story 1.7's
   deliverable. The one config change this story may need (`--add-host`) is gated on Task 2.
5. **Do not cite AD-6 as an absolute rule.** Story 1.7's code review falsified it: s1 carries
   **six** runner projects and `/opt/forgejo-runner-deploy` mounts the host `docker.sock`
   deliberately. The real rule is "build runners use DinD; the deploy runner is a documented
   exception". See `docs/migration-decisions.md#d10`.
6. **Do not bump Node 20.** It is EOL and delisted; Oleg reviewed it on 2026-08-11 and chose to
   leave it. Recorded in `deferred-work.md`; not a finding to re-raise.

## Acceptance Criteria

> AC1–AC4 are verbatim from `epics.md:645-668`. AC5–AC7 are marked `[DERIVED]` and justified
> inline — they are not in the epic's list.

**AC1 — `checkout` and `setup-node` resolve by full URL, and egress is confirmed**

**Given** a disposable smoke workflow
**When** it runs on the `node-20` label
**Then** `actions/checkout@v6` and `actions/setup-node@v4` resolve and succeed via their full
`https://github.com/...` URLs
**And** the runner's egress to github.com is confirmed, or a `code.forgejo.org` mirror is
substituted and recorded.

**AC2 — the artifact action is verified against the instance, not against a green step**

**Given** the same smoke workflow
**When** it uploads a file with `actions/upload-artifact@v4`
**Then** the artifact is retrievable from the run page
**And** if the artifact API v4 incompatibility manifests, the fallback to `v3` is applied and
recorded.

> ⚠️ **This AC has a verification problem you must solve before designing the workflow.** There is
> **no Actions-artifacts API on this instance** — the full swagger has 314 paths and the only
> artifact-shaped ones are `GET /orgs/{org}/quota/artifacts` and `GET /user/quota/artifacts`, which
> are storage quotas, not artifact listing or download. "Retrievable from the run page" is
> therefore a **web-UI** assertion needing session-cookie auth (Story 1.3's finding, the same trap
> as job logs). Read "Trap 2" in Dev Notes before you decide how to close this.

**AC3 — the `docker/*` family is exercised against a throwaway image**

**Given** a smoke workflow on the `docker-build` label
**When** it runs `docker/setup-buildx-action`, `docker/login-action`, `docker/metadata-action`
and `docker/build-push-action` against a throwaway image
**Then** the image is pushed to the registry successfully
**And** any action that fails to resolve is recorded together with its native `run:`
replacement.

> 🚨 **Read "Trap 1" before writing a single line of this job.** The `docker-build` label is backed
> by `code.forgejo.org/oci/docker:cli`, which carries **no Node runtime** — so every one of these
> four JS actions fails under that label with an error that looks like action-incompatibility and
> is not one. Story 1.7 hit exactly this and wrote the rule "`docker-build` job: `run:` steps only,
> no `uses:` of any kind". Reconciling AC3's literal wording with that fact is Task 4, and it is a
> design decision, not a runtime discovery.

**AC4 — native `ssh`/`scp` replace the `appleboy/*` actions**

**Given** the plan calls for replacing `appleboy/scp-action` and `appleboy/ssh-action`
**When** the smoke test covers SSH connectivity
**Then** native `ssh` and `scp` in a `run:` step reach s1 successfully
**And** the `appleboy/*` actions are confirmed as not needed.

> ✅ **Rescoped by Oleg's decision, 2026-08-11 — read §6 before acting on the text above.**
> Deployment will run on a runner located on the target host, not over SSH from a build job, so
> there is **no SSH probe to run**. The AC's second clause — "the `appleboy/*` actions are confirmed
> as not needed" — is closed by the architecture rather than by a connectivity test, which is a
> stronger result. The first clause is recorded as superseded, not as failed. §3(c) explains why an
> SSH probe could not have passed anyway: `ufw` denies port 22 to everything but two admin IPs.
> Task 3 records all of this; `epics.md` is **not** amended here — Epic 4 gets its own
> `correct-course`.

**AC5 — [DERIVED] every action under test gets a per-action recorded verdict, not a green run**

**Given** Story 2.1 and Story 3.1 consume this story's conclusions by reference
**When** the smoke workflow completes
**Then** each action in the Table 1.4 inventory carries a definite verdict — *resolves* /
*does not resolve* / *replaced by design* / *«не проверено»* — recorded in
`docs/migration-decisions.md`
**And** for every action that does not resolve, a concrete native `run:` replacement is recorded
beside it
**And** the artifact action's verdict names a specific version (`v4` or the `v3` fallback).

> Derived, not taken from the epic's AC list.
> **Claim.** A green run is not a consumable deliverable; two downstream stories need per-action
> facts by reference.
> **Evidence.** `epics.md:872` (Story 2.1 AC5) — "the artifact-action version proven in Story 1.8
> is used". `epics.md:1048-1051` (Story 3.1 AC3) — "Given any action from the `docker/*` family
> failed to resolve in Story 1.8 … the recorded native `run:` replacement is used instead".
> **Consequence if omitted.** Story 2.1 cannot pin an artifact version and Story 3.1 cannot write
> `build.yml` without re-running this story's work.

**AC6 — [DERIVED] the scaffolding is gone and the D9 invariant is intact**

**Given** the verification required a workflow file, a throwaway branch and a throwaway image
**When** the story completes
**Then** the probe branch is deleted locally and on `origin`, and no `.forgejo/workflows/*.yml`
exists on `main`, `staging` or `development`
**And** `.forgejo/workflows/README.md` is still present and byte-identical (`c9aeac2f…`) on all
three refs, verified **both** git-side and server-side
**And** `.github/workflows/` is byte-for-byte unchanged
**And** any throwaway image pushed by AC3 is deleted from the registry, or its retention is
explicitly recorded as accepted.

> Derived, not taken from the epic's AC list.
> **Claim.** Story 1.7's teardown standard applies, extended to cover a durable artifact 1.7 never
> created: an image in a shared registry.
> **Evidence.** `docs/forgejo-migration.md` §4's final file set contains **no** smoke workflow, so
> the file is transient by design. `docs/migration-decisions.md#d9`'s invariant is per-commit.
> Story 1.11's retention policy covers `<branch>` tags and `*-current` only — a smoke image
> matching neither pattern would persist indefinitely with no owner.
> **Consequence if omitted.** A stray `.yml` on `main` becomes live CI the moment Story 1.12 lands
> secrets; an orphan image squats in the registry namespace Epic 3 is about to define.

**AC7 — [DERIVED] no job targets a foreign runner**

**Given** four foreign org runners are idle and will execute anything addressed to their labels
**When** the smoke workflow is authored
**Then** no job uses `ubuntu-latest`, `s1`, `ci`, `build-crm`, `deploy-dev-preprod` or
`s2-prod-deploy`
**And** every job that ran is attributed to runner `id: 19` by direct evidence.

> Derived, not taken from the epic's AC list.
> **Claim.** The `ubuntu-latest` prohibition is textually scoped to Epic 2 and "Epics 3–7"; Epic 1
> is named by neither, and this is the first Epic 1 story to author a workflow.
> **Evidence.** `sprint-change-proposal-2026-08-07-runners.md:98, 336-340, 386`. The hazard is
> stated at `…-runners.md:59-63`: a stray job runs "on **another team's runner**, consuming their
> capacity without their knowledge". Story 1.13 did exactly this for 74 seconds and could not stop
> it.
> **Consequence if omitted.** An uncancellable run on someone else's hardware, and no way to prove
> which runner produced your evidence.

## Tasks / Subtasks

### Task 1 — Pre-flight: re-verify live state before changing anything (AC: 1, 7)

- [ ] 1.1 Obtain an API token. **Do not mint a new one blindly** — a token already exists on s1 at
      `/root/.fj_token` (mode `600`, minted during Story 1.7's code review with Oleg's
      authorisation, scopes `write:repository,read:organization`). Source it in the shell
      (`. /root/.fj_token`). If it has been revoked, mint one with
      `docker exec -u git forgejo gitea admin user generate-access-token -u platform-admin -t <name> --scopes write:repository,read:organization`
      **and open a tracked revocation entry in `deferred-work.md` in the same commit** — two live
      tokens already exist where the model calls for one.
- [ ] 1.2 Re-verify the instance: `GET /api/forgejo/v1/version` → expect `15.0.5+gitea-1.22.0`;
      `GET /repos/CRM/fe-prionex` → expect `has_actions: true`, `has_pull_requests: false`,
      `has_packages: true`, `default_branch: main`. Record any drift; do not adapt silently.
- [ ] 1.3 Re-read the runner lists. Expect repo: exactly `id: 19`, `status: idle`. Expect org:
      ids 10, 12, 14, 17 and **not** ours. Any new runner is drift — record it, add its labels to
      the forbidden set, do not adapt silently.
- [ ] 1.4 Confirm the runner still carries the full label spec. The API returns labels **bare** and
      cannot discriminate; the authoritative record is
      `/opt/forgejo-runner-fe-prionex/data/runner/.runner` on s1, which must read
      `["node-20:docker://node:20-bookworm", "docker-build:docker://code.forgejo.org/oci/docker:cli"]`.
      **Never commit that file** — it holds the runner's permanent instance secret.
- [ ] 1.5 Re-confirm egress **from inside the nested engine**, not from the host:
      `docker exec forgejo-runner-fe-prionex-dind docker -H tcp://localhost:2375 run --rm curlimages/curl:latest …`
      🚨 `docker exec … docker …` without `-H tcp://localhost:2375` **fails** — the `dind` sidecar
      runs with no unix socket at all. Expect github.com 200, code.forgejo.org 303,
      registry.npmjs.org 200.
- [ ] 1.6 Re-verify the git baseline: `git log --oneline -1` = `598de32c`, working tree clean,
      `git ls-files .forgejo` = exactly `.forgejo/workflows/README.md`, and its blob is
      `c9aeac2f0f0adf492d66781e3fbd330217844ee2` on `main`, `staging` and `development`.
- [ ] 1.7 Record the run counters **before** you start: `GET .../actions/runs` → `total_count`
      (16 at story creation, latest run id 337 / index 16) and `GET .../actions/tasks` →
      `total_count` (24). 🚨 Tasks are jobs, not runs — never compare the two numbers.
- [ ] 1.8 **Declare the write budget** and hold to it, enumerating every mutating call: (a) probe
      branch push + N `--no-verify` commits on it; (b) M workflow dispatches — each irreversible;
      (c) any image push to the registry — a **durable, external** write, the largest blast radius
      in this story; (d) probe branch deletion; (e) the closing commits to `main`. Anything outside
      this list is recorded openly, not silently. Close the ledger out at the end, not mid-session
      — both 1.13's and 1.7's budgets were found stale in review.

### Task 2 — Wire the registry path decided by Oleg (AC: 3)

> **Decided 2026-08-11, both points. Do not re-open; execute and record.**

- [ ] 2.1 Use the existing org secrets **`REGISTRY_USER` + `REGISTRY_TOKEN_RW`** for
      `docker/login-action` against `git.crm-prionex.com`. They are platform credentials belonging
      to the hub (see §5), not artefacts of a previous story. ⚠️ **Ask Oleg to confirm with
      `aleksey` that they are ours to use before the first push** — this is the one remaining
      human-only item, and it costs one message. Values are write-only and unverifiable in advance:
      the first login step is the test. A failure there is a **credential** finding, not an
      action-compatibility one — label it correctly in the verdict.
- [ ] 2.2 Apply the approved network fix: add `--add-host git.crm-prionex.com:10.67.0.1` to
      `container.options` in `/opt/forgejo-runner-fe-prionex/config.yml`, keeping the existing
      `-e DOCKER_HOST=tcp://172.17.0.1:2375` intact. **Back the file up first**, log the edit
      against the Task 1.8 write budget, restart the runner, and confirm it returns to `idle`.
      Without this the registry is simply unreachable from job containers — §3(b).
      **Do not widen the nginx ACL or the firewall.** Neither is needed: the runner's subnet
      `192.168.226.0/24` is already allowed, and the problem is name resolution, not access.
- [ ] 2.3 Hand the changed state to Story 1.9 documented — that story inherits this config and
      `deferred-work.md` already tracks the directory as unversioned. Record the exact line added,
      where the backup lives, and whether it should persist (it should: Story 3.1 needs it too).
- [ ] 2.4 Record the target path as **`git.crm-prionex.com/crm/fe-prionex`** — lowercase `crm` is
      correct per the OCI spec even though the git remote is `/CRM/`. Do not "fix" it. Your
      throwaway tag must sit **outside** Epic 3's namespaces (`sha-*`, `<branch>`, `v*`, `latest`,
      `buildcache`, `preprod-*`, `prod-*`).

### Task 3 — Record the AC4 rescope; run no SSH probe (AC: 4)

> **Decided 2026-08-11: «деплой по runner». There is no SSH test in this story.** Read §6.

- [ ] 3.1 Record the decision and its basis: deployment runs on a runner on the **target host**,
      driving that host's Docker daemon locally. The hub already works this way —
      `/opt/forgejo-runner-deploy` mounts the host `docker.sock` with the risk accepted in its own
      compose banner, org runner `s1-deploy-dev-preprod` (id 14) and account `robot-deploy` exist
      for it.
- [ ] 3.2 Close AC4's second clause on the architecture, not on a probe: `appleboy/scp-action` and
      `appleboy/ssh-action` are **not needed because nothing performs SSH**. This is stronger than
      the epic's intended evidence. Note that the plan had already pre-decided them as replacements
      rather than candidates — `docs/forgejo-migration.md:104`, `:201`, `:296`, `epics.md:240-241`
      — so no verdict is lost.
- [ ] 3.3 Record AC4's first clause as **superseded, not failed**, and keep §3(c)'s firewall
      evidence: `ufw` would have denied the probe anyway. That evidence is what makes the Epic 4
      correct-course well-founded rather than a preference.
- [ ] 3.4 🚨 **Do not amend `epics.md` here.** FR19 and Story 4.3 AC2 now describe the wrong
      mechanism, and Stories 5.3 and 6.4 inherit it — but Oleg's decision is to fix that through a
      separate `correct-course`. File the entry in Task 8.5 and stop there. Absorbing an epic-wide
      change into an Epic 1 smoke-test story is exactly the scope creep the plan's own
      change-control process exists to prevent.

### Task 4 — Decide how the `docker/*` actions get a Node runtime (AC: 3, 5)

- [ ] 4.1 🚨 **This is the story's central design decision. Make it deliberately, before writing
      YAML.** AC3 says "on the `docker-build` label", but that label's image
      (`code.forgejo.org/oci/docker:cli`) has no Node runtime, so all four `docker/*` JS actions
      fail there with an error that mimics action-incompatibility. Three options, all legitimate:
      - **(a) Run them on `node-20` and supply the docker CLI in a `run:` step.** Verified viable
        during story creation: a `node:20-bookworm` job container reports `node --version` =
        **v20.20.2**, has no docker CLI, **and reaches the nested daemon** — a raw HTTP call to
        `172.17.0.1:2375/version` returned `Server 27.5.1, api 1.47`. `container.options` hands
        `DOCKER_HOST` to *every* job container regardless of label, so the daemon is already there.
        This deviates from AC3's literal label wording — record it as a deviation.
      - **(b) Record all four as "do not resolve under the `docker-build` label" and supply native
        `run:` replacements.** This satisfies AC3's own second clause literally and is the cheapest
        honest answer, but it tells Story 3.1 less than (a) would.
      - **(c) Change the label's backing image** to one carrying both Node and the docker CLI.
        ⚠️ This modifies Story 1.7's deliverable and the runner's registration — highest blast
        radius, needs Task 2-level approval, and is almost certainly the wrong call for a smoke test.
      **Recommended: (a), with (b) as the recorded fallback for any action that still fails.**
- [ ] 4.2 Whichever is chosen, state plainly in the record which of AC3's four actions were proven
      **as actions** and which were proven only as `run:` equivalents. Do not let a `run:`
      replacement read as an action that resolved.
- [ ] 4.3 🚨 Do not misdiagnose. A missing Node runtime produces
      `The runs.using key in action.yml must be one of: [...], got nodeNN` or an equally
      action-shaped failure. That is an **environment** fact, not an action-compatibility verdict.
      Story 1.3 hit the mirror of this with runner image `:6` and `checkout@v6` (`got node24`) and
      recorded it in D8. Distinguish the two in every verdict you write.

### Task 5 — Author the smoke workflow (AC: 1, 2, 3, 7)

- [ ] 5.1 Cut the probe branch from `main` at `598de32c`: `git switch -c probe/action-compat main`.
      Verify the name matches no `push` filter and no tag pattern on any ref before pushing.
      Convention from 1.3/1.13/1.7 is `probe/<subject>`.
- [ ] 5.2 Add `.forgejo/workflows/probe-actions.yml`. 🚨 **Do not delete or modify `README.md`.**
      🚨 **Do not use a Story 2.1 filename.** Requirements:
      - `on: workflow_dispatch` **only**. If you take inputs, remember `workflow_dispatch` inputs
        arrive as **strings** — compare `== 'true'`, never as a boolean.
      - Every job pins `runs-on` to `node-20` or `docker-build`. Nothing else. (AC7)
      - Third-party actions referenced by **full URL** — `uses: https://github.com/actions/checkout@v6`
        — per `epics.md:237-239`. Pin every action by tag; prefer a SHA where the upstream tag
        moves (`docker/*@vN` and `appleboy/ssh-action@v1` are moving major tags). This matters more
        here than anywhere else in the plan: see Trap 5.
      - 🚨 Use block scalars (`run: |`) for any `run:` containing a colon-space. Story 1.3's probe D
        failed first on a YAML parse error in the story's own verbatim template
        (`mapping values are not allowed in this context`) and nearly recorded it as an action
        finding.
- [ ] 5.3 🚨 **Encode every assertion into exit status.** Job logs are not readable via the API
      (web-UI routes need session-cookie auth); job *status* is, via
      `GET /repos/CRM/fe-prionex/actions/tasks`. A green step proves nothing on this forge — see
      Trap 3. Each action under test needs a following `run:` step that fails the job unless the
      action's **observable effect** is present:
      - `checkout` → assert a known file from the repo exists in the workspace.
      - `setup-node` → `node --version | grep -q '^v20\.'`.
      - `upload-artifact` → assert on whatever the action itself returns; see Task 6 for why the
        step's exit code alone cannot close AC2.
      - `docker/*` → `docker manifest inspect <pushed tag>` or an equivalent that proves the image
        exists in the registry, not that the step was green.
- [ ] 5.4 Commit on the probe branch. ✅ `--no-verify` **is** expressly permitted here (branch cut
      from `main`, throwaway, never merged, adds no code the hooks can check) — but log each such
      commit against the Task 1.8 write budget. It is **forbidden** on `main`.
- [ ] 5.5 Push the branch and dispatch by API:
      `POST /repos/CRM/fe-prionex/actions/workflows/probe-actions.yml/dispatches` with
      `{"ref":"probe/action-compat"}` → expect **204**.
      🚨 The Actions UI enumerates dispatchable workflows from the **default branch only**, so the
      "Run workflow" button will never list this file. That is expected. Story 1.3's old advice to
      "temporarily land the probe on the default branch" is **forbidden** now — API dispatch is
      proven (1.3 once, 1.7 twice) and landing a `.yml` on `main` is exactly what AC6 prohibits.

### Task 6 — Close AC2 against the instance, not against a green step (AC: 2, 5)

- [ ] 6.1 🚨 **Establish how you will verify retrieval before you upload anything.** There is no
      Actions-artifacts API on this instance — 314 swagger paths, and the only artifact-shaped ones
      are storage quotas. Decide and record which channel you will use:
      - the web UI with session-cookie auth (the only route that literally matches "the run page"),
      - a download URL captured from the upload action's own outputs, if it emits one,
      - or an explicit «не проверено» for the retrieval clause, with the upload proven and the
        reason stated.
- [ ] 6.2 Upload a small file with `actions/upload-artifact@v4` and attempt retrieval by the chosen
      channel. Record the artifact name, size and the exact retrieval method.
- [ ] 6.3 🚨 **A silent no-op is the expected failure mode, not a red step.** The known v4 breakage
      is in the artifact **API**, and Trap 3 shows how this forge fails: `actions/setup-node`'s
      cache gate is literally `return !!process.env['ACTIONS_CACHE_URL']` and short-circuits to a
      green step with a misleading GHES message. Assume `upload-artifact` can do the same. If the
      step is green but nothing is retrievable, that is the incompatibility manifesting — apply the
      `v3` fallback and record both results.
- [ ] 6.4 Record the verdict as a **version pin** Story 2.1 can cite verbatim: `v4` works, or `v4`
      is broken in this specific way and `v3` is the pin. Also note whether `retention-days` is
      honoured — `CI.yml:106` sets it and nothing in the plan has verified it.

### Task 7 — Capture evidence to the house standard (AC: 1, 2, 3, 5, 7)

- [ ] 7.1 For **every** dispatch record: run **index and id**, event, `created` / `started` /
      `stopped` **with timezone**, and duration. Per job: **id**, name, status. Story 1.7 was caught
      in review leaving a job id as a placeholder — write the full table the first time.
- [ ] 7.2 Attribute every job to runner `id: 19` by direct evidence. Story 1.7's method: the
      runner-side debug log carries `[<workflow name>/<job name>]` prefixes, and the repo runner
      list contains exactly one runner. ⚠️ Story 1.7 reverted `log.level`/`log.job_level` to `info`
      in its Task 10.5 — if you need runner-side log evidence you must raise it to `debug` and
      **revert it again** at teardown. Log the edit against the write budget.
- [ ] 7.3 Timezone convention: the API returns `+02:00`, `date -u` logs are UTC. Record both and
      label which is which, as D9 does.
- [ ] 7.4 🚨 Do not infer anything from job status transitions. Forgejo bug
      [#10259](https://codeberg.org/forgejo/forgejo/issues/10259) makes a job blocked by a
      concurrency group report `waiting`, identical to one waiting for a free slot. Use timestamps.

### Task 8 — Record the outcome (AC: 5)

- [ ] 8.1 🚨 **The `D11` anchor is contested.** Story 1.6 reserved `D11` after Story 1.7 took `D10`;
      Story 1.6 is `ready-for-dev` and not yet written. Decide explicitly: take `D11` and renumber
      1.6 to `D12`, or take `D12` and leave 1.6's reservation intact. **If you renumber, fix
      positional instructions too, not just tokens** — Story 1.7's renumber was token-only and left
      1.6's line references pointing at the wrong slots, which its code review had to repair.
      Recommended: **take `D12`**, leaving 1.6's reservation untouched; the cost of a gap is zero
      and the cost of another renumber is demonstrated.
- [ ] 8.2 Write the entry: the per-action verdict table (AC5), the artifact version pin, the
      `docker/*` outcome including which were proven as actions vs as `run:` equivalents, the
      registry reachability finding and its fix, the SSH/firewall finding, and every «не проверено»
      with its reason.
- [ ] 8.3 Follow the file's conventions: Russian prose, English identifiers; explicit
      `<a id="dNN"></a>` anchor; D1–D10 untouched; index-table row added after the D10 row;
      **extend the anchor range in the header paragraph at `docs/migration-decisions.md:8`** —
      omitting this has been a review finding twice; changelog row appended
      (`| Дата | Story | Изменение |`, `DD.MM.YYYY`, bare dotted story number).
- [ ] 8.4 Amend `docs/forgejo-migration.md` Фаза 1 by **marking, not rewriting**: the DoD clause
      «все actions из таблицы 1.4 либо резолвятся, либо заменены на `run:`» is the one this story
      closes or updates (`:158`). ⚠️ Use the `✅` annotation alone — **do not add strikethrough**;
      that file already uses `~~…~~` with two conflicting meanings and Story 1.7's review flagged it.
      Also mark Table 1.4 rows with their verdicts.
- [ ] 8.5 Add to `deferred-work.md` everything this story surfaced but does not own:
      - 🚨 **The Epic 4 correct-course** — FR19 (`epics.md:128-130`) and Story 4.3 AC2
        (`epics.md:1301-1304`) specify `ssh`/`scp` deployment, which Oleg's «деплой по runner»
        decision supersedes; Stories 5.3 and 6.4 inherit the same mechanism. Owner: Oleg. Include
        §3(c)'s firewall evidence so the proposal is grounded in a fact, not a preference.
      - The **registry DNS finding and its fix** as a **Story 3.1 prerequisite** — 3.1 pushes to
        the same registry from the same runner and fails identically without `--add-host`.
      - The **`ci-bot` vs `robot-registry` substitution** for Story 1.10, and the resolved
        provenance of the five org secrets (close the existing "still unanswered" entry rather than
        adding a second one).
      - Whether org secrets proved visible to workflows in this repository — Story 1.12 depends on
        the answer.
      - Any token opened in Task 1.1, with owner and revocation trigger.
- [ ] 8.6 🚨 **Citation discipline.** Prefer anchors (`#dNN`) to line numbers. If you insert lines
      into a cited file, re-verify **every** citation into that file across the repository, not
      only the ones you wrote — Story 1.7 shifted `docs/forgejo-migration.md` by 10 lines and broke
      six of its own citations plus one in `deferred-work.md`. Count before asserting: if you claim
      "N citations updated", list N.

### Task 9 — Tear down and verify the invariant (AC: 6)

- [ ] 9.1 Delete the probe branch **after** the last dispatch completes, not before:
      `git push origin --delete probe/action-compat` and `git branch -D probe/action-compat`.
      Confirm with `git branch -a` **and** `GET /repos/CRM/fe-prionex/branches`.
- [ ] 9.2 Verify the D9 invariant **both ways**, as Story 1.7's review required: git-side
      (`git ls-tree` on all three refs → blob `c9aeac2f…`, no `.yml`) **and** server-side
      (`GET .../contents/.forgejo/workflows?ref=<r>` for `main`, `staging`, `development`).
- [ ] 9.3 `git diff 598de32c -- .github/workflows/` → must be empty. This story makes zero changes
      under `.github/`.
- [ ] 9.4 Delete the throwaway image from the registry if one was pushed, or record its retention as
      explicitly accepted with an owner. It matches no Story 1.11 retention pattern and would
      otherwise persist forever in the namespace Epic 3 is about to define.
- [ ] 9.5 🚨 **Do not revert Task 2.2's `--add-host` line — it is meant to persist.** Story 3.1
      pushes to the same registry from the same runner and needs it. Confirm it survived any runner
      restart, and that the config on s1 matches what Task 2.3 recorded. Revert only changes this
      story made *for its own convenience* (e.g. the log level, Task 9.6).
- [ ] 9.6 Restore `log.level`/`log.job_level` to `info` if Task 7.2 raised them. Confirm the daemon
      log shows no `[DEBUG]` lines afterwards and the runner is still `idle`.
- [ ] 9.7 Commit in **two** commits split by area, per the house convention:
      `docs(migration): …` for `docs/` and `chore(bmad): …` for `_bmad-output/`. Run the full husky
      suite on `main` — `--no-verify` is forbidden there. Known flake: a Radix `focus-scope` timer
      test is intermittently flaky in a different file each time; **retry once** before treating it
      as a regression. Verify fast-forward first
      (`git merge-base --is-ancestor origin/main HEAD`).
- [ ] 9.8 After **every** push, re-check `GET .../actions/runs` → `total_count` against the Task 1.7
      baseline and confirm no run was created. Story 1.7's review found this check had covered only
      the first of three pushes.
- [ ] 9.9 Update `sprint-status.yaml`: `1-8-…` → `review`, and this file's `Status:` line. Verify
      the prior value before writing — Story 1.7 claimed a verified prior value that git disproved.

## Dev Notes

### What this story produces

1. **A per-action verdict table** in `docs/migration-decisions.md` — the durable deliverable. Two
   downstream stories consume it by reference.
2. **An artifact-action version pin** (`v4`, or `v3` with the v4 failure mode recorded) that Story
   2.1 cites.
3. **Native `run:` replacements** for every action that does not resolve, which Story 3.1 uses.
4. **Amendments to `docs/forgejo-migration.md`** Table 1.4 and the Фаза 1 DoD, turning "проверить"
   into recorded fact.
5. **One durable change on s1** — the `--add-host` line in `container.options` (Task 2.2, approved).
   It stays: Story 3.1 needs it too. Everything else in the repository is transient — the probe
   workflow and its branch are gone by the end.
6. **A `deferred-work.md` entry that triggers a `correct-course` for Epic 4** — deployment is no
   longer SSH-based, so FR19 and Story 4.3 AC2 need rewriting. This story files the finding and
   does not act on it.

### The argument in one paragraph — memorize this

Every workflow Epics 2–7 will write depends on actions nobody has yet run on this forge. Story 1.7
proved the runner executes *something*; this story proves *what*. The danger is not that an action
fails loudly — it is that this forge fails **quietly**: `setup-node`'s cache gate short-circuits to
a green step with a misleading message when the cache server is unreachable, and the artifact API's
known v4 breakage is of the same family. So every assertion must be encoded into exit status, and
every claim must rest on an observable effect rather than a step's colour. Everything dangerous in
this story comes from one root — **you can start a run and you cannot stop it** — so every trigger
must be one you chose deliberately, on a branch nobody else uses, with a label only you own.

### 🚨 Five traps that break the obvious implementation

**Trap 1 — the `docker-build` label cannot run any `uses:` at all.**
Its image is `code.forgejo.org/oci/docker:cli` — docker CLI, **no Node runtime**. Every JS action
(`checkout`, `setup-node`, and all four `docker/*`) fails there with an error that reads like
action-resolution failure and is not one. Story 1.7 wrote the rule after hitting it: "`docker-build`
job: **`run:` steps only — no `uses:` of any kind**". This collides head-on with AC3, which names
four JS actions under that label. **Task 4 resolves it.** The mirror of this trap, from the other
side, is Story 1.3's finding that runner image `:6` cannot run `actions/checkout@v6`
(`must be one of: [composite docker node12 node16 node20 go sh], got node24`) — same class, one
layer down: an environment fact wearing an action-compatibility costume.

**Trap 2 — "retrievable from the run page" has no API behind it.**
The full swagger has 314 paths and **no Actions-artifacts endpoints** — only
`GET /orgs/{org}/quota/artifacts` and `GET /user/quota/artifacts`, which are storage quotas. The
run page is web UI, and web-UI routes on this instance need **session-cookie auth**, not a bearer
token (Story 1.3's Debug Log, restated by 1.7 Task 6.3). Job *status* is readable
(`GET .../actions/tasks`); job logs and artifacts are not. Decide your verification channel in
Task 6.1 **before** uploading, and if none is available, say «не проверено» with the reason rather
than letting an upload's green step read as retrieval.

**Trap 3 — a broken integration succeeds green on this forge.**
`actions/setup-node@v4` delegates to `@actions/cache` 4.0.3, whose gate is literally
`return !!process.env['ACTIONS_CACHE_URL']`; the toolkit's `isGhes()` is always true on Forgejo, so
it short-circuits to the GHES branch, logs
`Cache action is only supported on GHES version >= 3.5...` — **and the step goes green.** Assume
every action can no-op this way. Assert on effects: a file present, a version string matched, a
manifest inspectable in the registry.

**Trap 4 — there is no cancel endpoint.**
`POST .../actions/runs/{id}/cancel` → 404 in this version, confirmed against the full swagger. Only
start runs you are willing to see finish, and remember yours are the longest in the plan so far
because they build an image. There is likewise no `forgejo-runner unregister`; the v13 subcommand
set is `register`, `create-runner-file`, `daemon`, `one-job`, `exec`, `validate`,
`generate-config`, `cache-server`.

**Trap 5 — this story pulls more untrusted third-party code onto the runner than any other.**
`docs/migration-decisions.md#d10` records the residual risk plainly: the `dind` sidecar runs
`--privileged` with `dockerd -H tcp://0.0.0.0:2375 --tls=false`, unauthenticated, and its address
is handed to **every** job container via `DOCKER_HOST`. So any job — including a third-party action
fetched from github.com on a **moving tag** — gets root-equivalent control of a privileged daemon
on a multi-tenant production hub. This story deliberately fetches ten such actions. **Pin every
action by tag, and prefer a SHA where the upstream tag moves** (`docker/*@vN`,
`appleboy/ssh-action@v1`, `slackapi/slack-github-action@v3.0.3` are all moving refs).

### The action inventory you must cover

`docs/forgejo-migration.md:99-111` (Table 1.4) is the authoritative list, and it is **broader than
the four ACs**. Verdicts required for all of it (AC5):

| Action | Where used today | Plan's disposition | 1.8's job |
|---|---|---|---|
| `actions/checkout@v6` | `CI.yml:15,37,56,85`, `CD.yml:38,136` | full URL, needs github.com egress | **prove** (AC1) |
| `actions/setup-node@v4` | `CI.yml:18,40,59,88` | same | **prove** (AC1) |
| `actions/upload-artifact@v4` | `CI.yml:102` | known artifact-API v4 breakage; fall back to `v3` | **prove + version pin** (AC2) |
| `docker/setup-buildx-action@v3` | `CD.yml:80` | needs docker access on the runner | **prove or replace** (AC3) |
| `docker/login-action@v3` | `CD.yml:83` | same; Forgejo token, not `GITHUB_TOKEN` | **prove or replace** (AC3) |
| `docker/metadata-action@v5` | `CD.yml:91` | same | **prove or replace** (AC3) |
| `docker/build-push-action@v5` | `CD.yml:103` | same | **prove or replace** (AC3) |
| `appleboy/scp-action@v0.1.7` | `CD.yml:155` | **replaced by design** — native `scp` | confirm not needed (AC4) |
| `appleboy/ssh-action@v1` | `CD.yml:168,213` | **replaced by design** — native `ssh` | confirm not needed (AC4) |
| `codecov/codecov-action@v4` | `CI.yml:75` | **removed** — coverage becomes an artifact | out of scope; record as "removed by design" |
| `slackapi/slack-github-action@v3.0.3` | `CD.yml:127,248,258` | **replaced** by `curl` (FR22) | out of scope; Story 4.5 |
| `cache-from/to: type=gha` | `CD.yml:113-114` | does not work off GitHub → `type=registry` | not an action; **do not use `type=gha`** in the smoke build |
| `github.server_url` / `repository` / `run_id` | `CD.yml:263` | available, URL format matches | cheap optional assertion — echo the constructed run URL |

Фаза 1's DoD is a **two-way exit**: «все actions из таблицы 1.4 либо **резолвятся**, либо
**заменены на `run:`**» (`docs/forgejo-migration.md:158`). "Replaced by design" is a legitimate
verdict for the `appleboy/*`, codecov and Slack rows — but it must be *written*, not assumed.

### Live-instance facts (probed 2026-08-11 during story creation — re-verify in Task 1)

- Instance `https://git.crm-prionex.com`, **`15.0.5+gitea-1.22.0`**. Anonymous API refused
  (`REQUIRE_SIGNIN_VIEW`); header form is `Authorization: token $FJ_TOKEN`, **not** `Bearer`.
- Repo `CRM/fe-prionex`: `has_actions: true`, `has_pull_requests: **false**`,
  **`has_packages: true`**, `default_branch: main`, `repo_id: 16`. Remote
  `ssh://git@git.crm-prionex.com:2222/CRM/fe-prionex.git`. **No GitHub remote.**
- **Registry is live.** `/v2/` → `401` (not 404). Auth realm:
  `Bearer realm="https://git.crm-prionex.com/v2/token", service="container_registry", scope="*"`.
  Packages API exists (7 swagger paths, incl. `GET /packages/{owner}` and
  `GET /packages/{owner}/{type}/{name}/{version}`) but needs a `read:package`-scoped token — the
  Story-1.7 token returns `403: token does not have at least one of required scope(s): [read:package]`.
- **No Actions-artifacts API.** 314 swagger paths; artifact-shaped ones are quota endpoints only.
- **Runners:** ours `id: 19` (`s1-fe-prionex-1`, repo scope, `repo_id: 16`, `idle`, v13.0.0).
  Foreign org runners: `ci-hub` id 10 (`ubuntu-latest`), `s1-build-crm` id 12 (`s1`,`ci`,
  `build-crm`, seen `active` — genuinely shared), `s1-deploy-dev-preprod` id 14
  (`deploy-dev-preprod`), `s2-prod-deploy` id 17 (on **s2/PROD**).
- **Counters:** `GET .../actions/runs` → `total_count = 16`, latest run **id 337 / index 16**.
  `GET .../actions/tasks` → `total_count = 24`. Tasks are jobs; never compare the two.
- **Egress from a job-equivalent container** (inside the nested engine): `github.com` **200**,
  `api.github.com` **200**, `code.forgejo.org` **303**, `registry.npmjs.org` **200**.
- **Registry from a job-equivalent container:** `git.crm-prionex.com` resolves to the **public**
  `185.185.49.127` (split-horizon — the host resolves it to `10.70.0.1`) and the connection fails.
  With `--add-host git.crm-prionex.com:10.67.0.1`: `/v2/` → **401**, token endpoint → **401**.
- **The nested daemon is reachable from a `node-20` job container:** `node:20-bookworm` reports
  `v20.20.2`, has **no** docker CLI, and a raw HTTP call to `172.17.0.1:2375/version` returns
  `Server 27.5.1, api 1.47`.
- **s1 firewall:** `ufw` active, `-P INPUT DROP`; `22/tcp` allowed from `81.4.156.7` and
  `194.156.248.138` only. From a job container, `10.67.0.1:22`, `10.67.0.1:2222` and
  `git.crm-prionex.com:2222` all time out.
- **nginx ACL** (`/etc/nginx/sites-available/forgejo-platform`) allows `10.67.0.0/24`,
  `10.70.0.0/24` and `192.168.221–226.0/24`. Our runner's subnet `192.168.226.0/24` was added by
  Story 1.7. **Do not widen it.**
- **Hosts:** s1 = `72.62.17.132` external / `10.67.0.1` internal (same machine, reconciled in
  `#d10`). s2 = `175.110.122.17` (PROD, forbidden).
- Endpoints known **absent**: `POST .../actions/runs/{id}/cancel`, `GET /api/v1/settings/actions`,
  anything Actions-artifact-shaped.
- **Org accounts:** `platform-admin`, `robot-deploy`, `robot-registry`. **`ci-bot` does not exist**
  (`GET /users/ci-bot` → 403, absent from the member list) despite FR10 and `epics.md:704-707`
  naming it — `robot-registry` is the platform's equivalent. Record the substitution; creating
  `ci-bot` is Story 1.10's call, not yours.
- **Org secrets (names only — values are write-only):** `REGISTRY_USER`, `REGISTRY_USER_RO`,
  `REGISTRY_TOKEN_RW`, `REGISTRY_TOKEN_RO` (all `2026-08-10T10:14:27+02:00`) and
  `SLACK_CD_WEBHOOK_URL` (`…:26`). **Repo-level secrets: `[]` — none.** Whether org secrets reach
  workflows in this repository is something your probe run establishes; record it, Story 1.12
  depends on it.
- `SLACK_CD_WEBHOOK_URL` is a non-resolving `example.invalid` stub whose original value is
  **unrecoverable** — Story 1.13 overwrote it on a false reading of `CD.yml` and Forgejo secrets
  are write-only. Do not touch it, and do not treat its presence as evidence of anything.

### The runner as Story 1.7 left it — do not change it

```yaml
runner:  { labels: [], capacity: 2 }
container:
  docker_host: "tcp://dind:2375"                    # runner → nested engine
  options: "-e DOCKER_HOST=tcp://172.17.0.1:2375"   # what every JOB container sees
  network: ""
  valid_volumes: []
cache:   { host: "192.168.226.3", proxy_port: 34568 }
log:     { level: info, job_level: info }
```

Labels, from `.runner` on the host (the API returns them **bare** and cannot discriminate):
`node-20:docker://node:20-bookworm`, `docker-build:docker://code.forgejo.org/oci/docker:cli`.
Sidecar `dind`: `docker:27.5.1-dind`, privileged, `dockerd -H tcp://0.0.0.0:2375 --tls=false`,
**no unix socket** — so `docker exec … docker …` on s1 needs `-H tcp://localhost:2375` or it fails
with "Cannot connect to the Docker daemon". Network `192.168.226.0/24`, static IPs `dind = .2`,
`runner = .3`. Supervision `restart: unless-stopped` (compose, not systemd); `docker.service` is
`enabled` at boot. Compose project `/opt/forgejo-runner-fe-prionex/` — **unversioned; it is the
only record.**

### Verified repository facts (checked at `598de32c`)

```
HEAD / origin/main                598de32c  chore(bmad): story 1.7 code review — findings applied
working tree                      clean
git ls-files .forgejo             .forgejo/workflows/README.md      (the only entry)
.forgejo/workflows/README.md      blob c9aeac2f0f0adf492d66781e3fbd330217844ee2 on all three refs
package-lock.json                 present at root, lockfileVersion 3  (setup-node hashes it)
package.json                      no `engines` field; no .nvmrc / .node-version
Node pins                         CI.yml:20,42,61,90 = '20'; Dockerfile.prod:5 = node:20-alpine
CI.yml                            4 parallel jobs, all runs-on: ubuntu-latest, no `needs:`
CI.yml:102-106                    upload-artifact@v4, name: dist, path: dist/, retention-days: 1
CD.yml:24-26                      REGISTRY: ghcr.io, IMAGE_NAME: crm-prionex/fe-prionex
CD.yml:113-114                    cache-from/to: type=gha   (does not work off GitHub)
registry target (plan)            git.crm-prionex.com/crm/fe-prionex   (lowercase is correct)
epics.md:636-668                  Story 1.8, the four ACs
epics.md:233-241                  the Additional Requirements that generate them
docs/forgejo-migration.md:99-111  Table 1.4 — the authoritative action inventory
docs/forgejo-migration.md:158     the Фаза 1 DoD clause this story closes
```

### Anti-patterns for this story

- ❌ **Emitting `runs-on: ubuntu-latest`** — or `s1`, `ci`, `build-crm`, `deploy-dev-preprod`,
  `s2-prod-deploy`. Idle foreign runners execute immediately and you cannot cancel.
- ❌ **Putting a workflow file on `main`, `staging` or `development`** — including "temporarily",
  which Story 1.3's notes suggest and this story forbids.
- ❌ **Deleting or editing `.forgejo/workflows/README.md`.**
- ❌ **Reporting a missing Node runtime as an action-compatibility verdict** (Trap 1).
- ❌ **Claiming an artifact is retrievable because the upload step was green** (Traps 2, 3).
- ❌ **Using `cache-from/to: type=gha`** in the smoke build — it cannot work here.
- ❌ **Minting a token without opening its revocation entry**, or writing any token into any file.
- ❌ **Landing `S1_SSH_*` into Forgejo** to unblock AC4. That is Story 1.12, and doing it early
  removes the accidental protection keeping 497 legacy branches from deploying.
- ❌ **Widening the nginx ACL or the firewall** without Oleg **and** `aleksey`.
- ❌ **Changing the runner's labels, cache config or image pin**, or relying on `:latest` (it does
  not exist) or `:6` (cannot run node24 actions).
- ❌ **Citing AD-6 as an absolute rule** — it was falsified by Story 1.7's code review.
- ❌ **Leaving a throwaway image in the registry** with no owner and no retention rule that covers
  it.
- ❌ **`--no-verify` on a `main` commit.** Permitted only on the probe branch, logged against the
  budget.

### Previous story intelligence

**Story 1.7 (done, code-reviewed) — the runner.** Left you a working runner and a probe pattern
proven twice. Its review is required reading for the evidence standard: it was caught leaving a job
id as a placeholder, claiming a verified `sprint-status` value that git disproved, understating its
write budget by half, breaking six of its own citations by inserting 10 lines into a cited file,
and asserting AD-6 as an absolute rule that direct host inspection falsified. **Its record-keeping
failures are the ones you are most likely to repeat.** Its probe mechanics — branch from `main`,
`workflow_dispatch` only, API dispatch → 204, assertions in exit status, evidence from the
runner-side debug log — are the ones to copy verbatim.

**Story 1.3 (done) — capabilities.** Established: `:latest` does not exist; `:6` cannot run
`checkout@v6` (`got node24`); job logs need session-cookie auth so `docker logs` at
`job_level: debug` is the log source; the Actions UI enumerates dispatchable workflows from the
**default branch only** while API dispatch works on any ref; a YAML colon-space bug in the story's
own template masqueraded as a capability failure. It also named 1.8 as the owner of exactly this
class of problem: *"If the `actions/checkout` step itself fails to resolve, that is a **Story 1.8
action-availability problem**."*

**Story 1.13 (done) — the placeholder.** Proved the fallback suppression on three branch heads and
recorded it as D9. Its expensive lesson: control run #13 (id 286) ran **74 seconds of another
team's CI on `ci-hub`** and could not be stopped. Its invariant — per-commit, not per-branch — is
why your probe branch must be cut from `main`.

**Story 1.6 (`ready-for-dev`, not started).** Not a dependency, but it has reserved `D11` — the
anchor collision Task 8.1 resolves. Its coordinates were repaired during Story 1.7's code review
after the earlier D10→D11 renumber was found to be token-only.

### Git intelligence

```
598de32c  chore(bmad): story 1.7 code review — findings applied, story done   ← origin/main
f5196efe  docs(migration): address code review findings for story 1.7
9f75b89e  chore(bmad): story 1.7 — record Oleg's decision on Task 5.3 (no host reboot)
c1170987  chore(bmad): story 1.7 to review — runner s1-fe-prionex-1 live, both labels proven
68855066  docs(migration): record D10 — s1-fe-prionex-1 runner (node-20, docker-build)
```

Conventions the history shows, and that you must follow: Conventional Commits with a scope; **no
`KAN-###`** prefix; a clean split between `docs(migration): …` for `docs/` and `.forgejo/` and
`chore(bmad): …` for `_bmad-output/`; a separate `address code review findings for story N` commit
rather than amending history.

⚠️ **New process expectation, and you are the first story it applies to.** Story 1.7's review
deferred this: story files must be committed **at create-story time**, before any dev work, so that
self-reported deviations are auditable — Story 1.7's file was born already at `Status: review` and
its whole history is two post-execution commits. Commit this file now, as
`chore(bmad): create story 1.8 …`. Also: **do not move to `review` with any `[ ]` subtask open.**

### Latest technical information

- **forgejo-runner v13.0.0** is the pin and must not change. Supported action runtimes on v13
  include `node24` (`checkout@v6` works); v6.4.0 did not.
- **`actions/checkout@v6`** is the newest pin in the tree. `code.forgejo.org` mirrors may lag on a
  v6 tag — if you fall back to a mirror, verify the tag exists before concluding anything about
  compatibility.
- **`actions/setup-node@v4`** = v4.4.0, bundling `@actions/cache` 4.0.3. Cache hit line:
  `Cache restored from key: node-cache-<os>-<arch>-npm-<hash>`; miss: `npm cache is not found`.
  The cache server is Story 1.7's proven deliverable — **do not re-prove it** (`epics.md:631-634`
  assigns it there), but expect it to work.
- **`docker/*` versions in the tree:** `setup-buildx-action@v3`, `login-action@v3`,
  `metadata-action@v5`, `build-push-action@v5`. All moving major tags.
- **The plan's tag scheme** (Фаза 4, `docs/forgejo-migration.md:190`) is `sha-<short>`, `<branch>`,
  `v*`, `latest` from `main`, plus `buildcache`. **Your throwaway image must sit outside those
  namespaces** so it cannot collide with Epic 3's or be mistaken for a real build.
- **Node 20 is EOL** (2026-04-30); `node:20-bookworm` is delisted but still pulls, frozen at
  **v20.20.2** / npm 10.8.2. Reviewed by Oleg 2026-08-11: leave as is. Not a finding to re-raise.

### Testing standards

There is no automated test suite for this story — it is infrastructure, and "the test" is the smoke
workflow. The project's evidence standard applies:

- **Observation over assertion.** Every AC closed by a captured API response or a quoted log line.
  Record run **index and id**, job ids and names, `created`/`started`/`stopped` with timezone, and
  durations. Write the full table the first time — Story 1.3's first evidence pass was rejected in
  review for exactly this, and Story 1.7's was caught with a placeholder.
- **Definite yes/no.** Where a capability is probed, state it as a definite yes or no; where you
  could not check, write **«не проверено»** and say why. Story 1.13's review found D9 marked
  *nothing* «не проверено» while four items were unverified.
- **Encode assertions into exit status**, because job logs are unreadable via the API and a green
  step proves less than it appears to.
- **Retro-annotate rather than silently tick.** If a subtask was attempted but not performed as
  specified, mark it `⚠️ [x] = attempted, not performed as specified` and explain. Append
  annotations — never overwrite the original instruction text, or the tick becomes unauditable.
- The repo's own suite (`npm run lint`, `format:check`, `typecheck`, `test:run` — 1921 tests,
  `npm run build`) runs via husky hooks on any `main` commit. It is unaffected by this story.

### Project Structure Notes

- `.forgejo/workflows/` holds exactly one tracked file, `README.md`, whose entire purpose is to
  exist. Story 2.1 fills it with the six reserved filenames; this story only ever puts a file there
  on a throwaway branch, under a name outside that set.
- `.gitea/workflows/` does not exist and **must not be created** — `.forgejo/` already wins
  resolution and Story 1.13 explicitly declined to add it.
- **Language split:** `docs/` is Russian (identifiers, labels, filenames stay English); workflow
  YAML, `README.md` and story files under `_bmad-output/` are English.
- Runner artefacts (`config.yml`, `docker-compose.yml`, `.runner`) live on s1 and are **not** part
  of this repository. `.runner` holds a secret and can never be committed.
- Do not "fix" `CRM-Prionex` (GitHub org) or lowercase `crm` (OCI registry path) — both correct.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md:636-668`] — Story 1.8, the four ACs.
- [Source: `_bmad-output/planning-artifacts/epics.md:233-242`] — the Additional Requirements that
  generate AC1–AC4: the smoke-test-before-porting gate, the artifact v4 caveat, the full-URL
  convention and egress dependency, the `appleboy/*` replacement decision.
- [Source: `_bmad-output/planning-artifacts/epics.md:869-872`] — Story 2.1 AC5, consumer of this
  story's artifact-version verdict.
- [Source: `_bmad-output/planning-artifacts/epics.md:1048-1051`] — Story 3.1 AC3, consumer of this
  story's `docker/*` verdicts and native `run:` replacements.
- [Source: `_bmad-output/planning-artifacts/epics.md:692-712`] — Story 1.10: the registry
  credential AC3 depends on and must not absorb.
- [Source: `_bmad-output/planning-artifacts/epics.md:745-781`] — Story 1.12: the secrets AC4
  depends on and must not absorb.
- [Source: `_bmad-output/planning-artifacts/epics.md:1288-1328`] — Story 4.3, where deploy-over-SSH
  actually lands; AC4 proves connectivity only.
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-07-runners.md:98, 336-340, 386`]
  — the `ubuntu-latest` prohibition and its Epic-1 wording gap (AC7).
- [Source: `docs/forgejo-migration.md:99-111`] — Table 1.4, the authoritative action inventory.
- [Source: `docs/forgejo-migration.md:154-159`] — Фаза 1 item 4 and the DoD clause this story closes.
- [Source: `docs/forgejo-migration.md:265-275`] — the placeholder and the reverse condition: the
  directory becomes the executor at the first `.yml`.
- [Source: `docs/migration-decisions.md#d8`] — Forgejo 15.0.5 capabilities, the runner-image pin
  requirement naming Stories 1.7 and 1.8, `workflow_call` and composite-action verdicts.
- [Source: `docs/migration-decisions.md#d9`] — the per-commit `.forgejo/workflows/` invariant, the
  absence of a cancel endpoint, branch protection and `apply_to_admins: false`.
- [Source: `docs/migration-decisions.md#d10`] — the runner's full configuration, the cache finding,
  the DinD residual risk, and the AD-6 correction.
- [Source: `_bmad-output/implementation-artifacts/1-7-provision-the-primary-forgejo-runner-with-both-labels.md`]
  — the probe-workflow pattern, the five traps, the `docker-build`-has-no-Node rule, and a code
  review whose findings are the failure modes most likely to recur here.
- [Source: `_bmad-output/implementation-artifacts/1-3-verify-forgejo-actions-availability-and-concurrency-support.md`]
  — action-resolution findings, the session-cookie log constraint, the default-branch
  dispatch-enumeration gotcha.
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`] — the token model, the
  unexplained `REGISTRY_*` org secrets, the unversioned runner config, Node 20 EOL, and the
  process expectations this story is the first to inherit.
- [Source: `.github/workflows/CI.yml`, `.github/workflows/CD.yml`] — every action under test, with
  the versions and call sites the inventory table cites.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Open Questions for Review

### Resolved before release — recorded so they are not re-opened

1. ✅ **AC3's registry credential — use the existing `REGISTRY_USER` + `REGISTRY_TOKEN_RW`.**
   Oleg, 2026-08-11. The five org secrets turned out to be the hub's own platform credentials
   (accounts `robot-registry`, `robot-deploy`), not leftovers from a previous story — which also
   closes `deferred-work.md`'s "still unanswered" entry. One human-only step remains: Oleg confirms
   with `aleksey` that they are ours to use (Task 2.1).
2. ✅ **The `--add-host` runner-config change — approved.** Oleg, 2026-08-11. Task 2.2 applies it
   with a backup and logs it against the write budget.
3. ✅ **AC4 — rescoped to «деплой по runner».** Oleg, 2026-08-11. No SSH probe; the `appleboy/*`
   clause closes on the architecture. Epic 4 gets a separate `correct-course` (Task 8.5), and this
   story does not amend `epics.md`.

### Still open

4. **`D11` or `D12`?** Story 1.6 has reserved `D11` and has not run. Recommended: take `D12` and
   leave the reservation intact — a numbering gap costs nothing, and the last renumber cost a
   code-review repair.
5. **Should the token policy be settled now?** Two live tokens exist where the model calls for one
   (`fe_tmp_1_7`, `fe_review_1_7`), and this story needs a third unless it reuses one. The open
   question from Story 1.7 — one long-lived token per epic vs. a scoped short-lived token per story
   — is now costing something. Note the platform's own answer is different again: it uses named
   robot accounts (`robot-registry`, `robot-deploy`) rather than tokens on a human admin, which may
   be the model worth adopting.
6. **Does `robot-registry` have `write:package`, or only the RO pair?** Both `REGISTRY_TOKEN_RW`
   and `REGISTRY_TOKEN_RO` exist, so presumably yes — but values are write-only and the first
   `docker/login-action` step is the only way to find out. If RW turns out to be scoped narrower
   than its name suggests, that is a Story 1.10 finding, not a blocker for the other three ACs.
