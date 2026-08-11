---
baseline_commit: 4032f867
---

# Story 1.7: Provision the Primary Forgejo Runner with Both Labels

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a Forgejo runner that can execute both Node jobs and Docker builds,
so that CI jobs and image builds have somewhere to run.

## 🚨 Read this before anything else

This story creates **durable infrastructure on a live, shared Forgejo instance**
(`https://git.crm-prionex.com`, org `CRM`, repo `CRM/fe-prionex`). It is not a documentation
story and it is not reversible by `git revert`. Three things make it different from every story
before it.

### 1. The host is a hard stop — you cannot pick it yourself

Every artifact states the host constraint **negatively and only negatively**:

- `epics.md:243` — "The runner must not be hosted on s2."
- `epics.md:608` — AC1: "**Given** a host that is not s2".
- `docs/forgejo-migration.md:130` — «Поднять `forgejo-runner` (отдельная VM или контейнер; **не** на s2)».

**No artifact names a positive host.** s1 (`72.62.17.132`) is permitted (Story 1.3 Dev Notes:
"s1 is permitted"), a separate VM is permitted, s2 (`175.110.122.17`, PROD) is forbidden.
Story 1.3 sidestepped the question entirely by running its throwaway probe runner on the
developer workstation — **that is not available to you.** This runner is the *primary* runner:
Story 1.9 adds a second one beside it, Story 2.1 puts CI on it, and Story 2.6 makes merges into
`main` depend on it. A runner on a laptop that sleeps is a merge freeze waiting to happen.

**Task 2 is a 🛑 HARD STOP.** Do not guess a host, do not default to the workstation, do not
SSH anywhere until Oleg has named the host and confirmed you can reach it.

| Part | Who | Can the dev agent do it? |
|---|---|---|
| Choose the runner host | **Oleg** | ❌ no — Task 2 is a hard stop |
| Obtain shell access to that host | **Oleg** | ❌ no — SSH creds are unmigrated repo secrets (Story 1.12) |
| Supply the `fe_tmp` token value | **Oleg** | ❌ no — it is stored in no file, by rule |
| Everything else in this story | dev agent | ✅ yes |

### 2. You cannot stop a run once it starts

`POST /api/v1/repos/CRM/fe-prionex/actions/runs/{id}/cancel` → **404. The endpoint does not
exist in Forgejo 15.0.5.** Confirmed against the full swagger spec by Story 1.13
(`deferred-work.md:46-50`, which names Story 1.7 explicitly). Story 1.13 learned this the
expensive way: its control run #13 (id `286`) executed **74 seconds of another team's CI on
another team's runner** (`ci-hub`) and could not be stopped.

**Consequence: only start runs you are willing to watch finish.** Never emit `runs-on:
ubuntu-latest`, `s1`, `ci`, `build-crm` or `deploy-dev-preprod` in anything you push — those
five labels belong to three foreign org runners and a stray trigger lands on them immediately,
because they are idle.

### 3. `.forgejo/workflows/` is now armed

Story 1.13 landed an inert `.forgejo/workflows/README.md` on `main`, `staging` and
`development`. It suppresses the legacy `.github/workflows/` fallback — but
`docs/forgejo-migration.md:261-265` states the reverse condition in as many words:

> ⚠️ **И обратное условие:** та же tree-entry, которая сейчас подавляет *всё* исполнение,
> становится исполнителем в момент, когда в ней появится первый `.yml`.

**This story is the gate that unblocks that directory** — and it is also the first story to put
a `.yml` into it. Three rules follow:

1. Your probe workflow goes on a **throwaway branch cut from `main`**, never on `main`,
   `staging` or `development`.
2. It carries **`on: workflow_dispatch` only** — no `push`, no `pull_request`, no `schedule`.
3. **Never delete `README.md`.** The invariant is "the directory must never be without a
   tracked file while `.github/workflows/` exists in the tree" (`docs/migration-decisions.md#d9`).
   Adding a file is safe; removing the last one silently re-arms a PROD deploy.

### Four prohibitions

1. **Never write the `fe_tmp` token, or any substring of it, into any file.** Standing rule
   from Story 1.3's code review, restated by 1.13. Supply it as `$FJ_TOKEN` in the shell only.
2. **Never commit the runner's `.runner` file, its `runner-config.yml`, or a registration
   token.** `.runner` contains the runner's permanent instance secret. These live on the runner
   host, outside this repository, forever.
3. **Do not re-enable `has_pull_requests`.** It is `false` by Oleg's decision on 2026-08-10
   ("ci-hub не надо запускать"). Turning it on re-exposes 497 legacy branches to
   PR-triggered CI on `ci-hub`. You do not need PRs — dispatch by API.
4. **Do not touch the three foreign org runners** (`ci-hub`, `s1-build-crm`,
   `s1-deploy-dev-preprod`). Do not adopt them, do not reconfigure them, do not stop them,
   do not reuse their labels. AC2 requires proving they are unmodified.

## Acceptance Criteria

> AC1–AC5 are verbatim from `epics.md:608-634`. The Context blockquote below is reproduced from
> `epics.md:601-606` **with Story 1.13's third runner folded in** — the epic's copy says two;
> the change is marked inline. AC6–AC8 are marked `[DERIVED]` and justified inline — they are
> not in the epic's list.

> **Context (established in Story 1.3, 2026-08-07; extended by Story 1.13, 2026-08-10).** The
> `CRM` organization has **three** registered runners — `ci-hub` (label `ubuntu-latest`),
> `s1-build-crm` (labels `s1`, `ci`, `build-crm`) and `s1-deploy-dev-preprod` (label
> `deploy-dev-preprod`, id 14), all forgejo-runner v13.0.0. **They belong to another team and
> are not under this plan's control.** This story provisions our own runner; it does not adopt,
> reconfigure or depend on theirs. Registration scope is **repository**, not organization — see
> `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-07-runners.md` §4.2.

**AC1 — the runner exists at repository scope with both labels**

**Given** a host that is not s2
**When** the `forgejo-runner` is installed and registered at the **repository** level for
`CRM/fe-prionex`
**Then** it exposes the label `node-20:docker://node:20-bookworm`
**And** it exposes the label `docker-build`
**And** neither label collides with a label already registered at the `CRM` organization
(`ubuntu-latest`, `s1`, `ci`, `build-crm`).

**AC2 — scope isolation, neighbours untouched**

**Given** the runner is registered at repository scope
**When** the organization runner list is inspected
**Then** our runner does not appear as available to other `CRM` repositories
**And** the two pre-existing organization runners are unmodified.

> ⚠️ **Reconcile before asserting.** The epic says "the **two** pre-existing organization
> runners" — that text predates Story 1.13's discovery of a **third** (`s1-deploy-dev-preprod`).
> Assert against the list you actually observe in Task 1, not against this number. AC6 covers
> the reconciliation.

**AC3 — docker works under the `docker-build` label**

**Given** a job running under the `docker-build` label
**When** it executes `docker version`
**Then** both client and server respond
**And** the mechanism providing this is recorded as either a dind image or a mounted
`/var/run/docker.sock`.

**AC4 — Node 20 works under the `node-20` label**

**Given** a job running under the `node-20` label
**When** it executes `node --version`
**Then** it reports a Node 20 version.

**AC5 — the runner cache server serves `actions/setup-node`**

**Given** `actions/setup-node` is used with `cache: npm`
**When** the runner cache server is configured and a job runs twice
**Then** the second run restores the npm cache instead of downloading from scratch
**And** the cache-hit is visible in the job log.

> ⚠️ **This AC has two traps. Read "Trap 2" and "Trap 3" in Dev Notes before designing the
> probe workflow.** A missing cache server does **not** fail the step — it succeeds green with
> a misleading message — and job logs are **not readable through the API with a token**.

**AC6 — [DERIVED] the collision list is reconciled against live state, not against the epic**

**Given** the epic's collision list (`ubuntu-latest`, `s1`, `ci`, `build-crm`) was written
before `s1-deploy-dev-preprod` existed
**When** labels are chosen and registered
**Then** the org runner list is re-read at implementation time and the *observed* label set is
recorded
**And** `node-20` and `docker-build` are shown to collide with none of it
**And** any runner that appeared since 2026-08-10 is recorded as further instance drift.

> Derived, not taken from the epic's AC list.
> **Claim.** The epic's collision list is stale by one runner and one label.
> **Evidence.** `s1-deploy-dev-preprod` (label `deploy-dev-preprod`, id 14) was found by Story
> 1.13 on 2026-08-10 and did not exist during Story 1.3 on 2026-08-08 —
> `docs/forgejo-migration.md:132-134`, `docs/migration-decisions.md#d9`. The org runner list is
> a moving target owned by another team.
> **Consequence if omitted.** A label chosen against a two-day-old inventory can silently
> collide with a runner registered yesterday, and jobs would then be picked up by a stranger.

**AC7 — [DERIVED] the runner is durable, not a foreground process**

**Given** Story 1.9 stops and restarts this runner deliberately, and Story 2.6 makes merges
into `main` depend on it
**When** the runner host is rebooted, or the runner process is killed
**Then** the runner comes back online without a human running a command
**And** the supervision mechanism (systemd unit or container restart policy) is recorded
**And** the recovery is proven by actually restarting it and re-observing it as `idle` in the
repository runner list.

> Derived, not taken from the epic's AC list.
> **Claim.** "Provisioned" must mean "survives a restart", or the story does not deliver what
> the epic's later stories consume.
> **Evidence.** Story 1.9 AC2 (`epics.md:683-686`) stops the primary runner and requires it
> "restarted afterwards". Story 2.6 enforces required status checks on `main`;
> `docs/forgejo-migration.md:170` — «упавший единственный runner замораживает все мержи».
> Story 1.3's runner was an explicitly disposable `docker run -d` on a workstation
> (`migration-decisions.md#d8`) — the anti-pattern this AC exists to prevent.
> **Consequence if omitted.** The first host reboot freezes every merge into `main` and nobody
> knows why.

**AC8 — [DERIVED] the scaffolding is gone and the D9 invariant is intact**

**Given** the verification required a workflow file and a throwaway branch
**When** the story completes
**Then** the probe branch is deleted locally and on `origin`, and no `.forgejo/workflows/*.yml`
exists on `main`, `staging` or `development`
**And** `.forgejo/workflows/README.md` is still present and byte-identical on all three refs
**And** `.github/workflows/` is byte-for-byte unchanged
**And** the runner itself remains registered — it is the deliverable, not scaffolding.

> Derived, not taken from the epic's AC list.
> **Claim.** Story 1.3's standard ("scaffolding must be gone") applies, but with an inversion:
> the branch and workflow go, the runner stays.
> **Evidence.** `docs/migration-decisions.md#d9` invariant is per-commit, not per-branch;
> `docs/forgejo-migration.md:255-265`; Story 1.3 Task 7 deregistered its probe runner precisely
> so that "a workstation runner left registered [cannot] silently pick up a later Story
> 1.7/1.8 job".
> **Consequence if omitted.** A stray `.yml` left on `main` becomes live CI for everyone the
> moment Story 1.12 lands secrets; a deleted `README.md` re-arms the legacy PROD deploy.

## Tasks / Subtasks

### Task 1 — Pre-flight: re-verify live state before changing anything (AC: 1, 2, 6)

- [x] 1.1 `FJ_TOKEN` obtained 2026-08-11 — not the original `fe_tmp` (Oleg chose to invalidate
      it rather than retrieve its lost value). Minted directly on s1 via the Forgejo CLI inside
      the `forgejo` container (`docker exec -u git forgejo gitea admin user
      generate-access-token -u platform-admin -t fe_tmp_1_7 --scopes
      write:repository,read:organization`) — no password or existing token needed, this instance
      runs on s1 itself. Held only in-memory for this session, never written to a file.
- [x] 1.2 `GET /api/forgejo/v1/version` → `15.0.5+gitea-1.22.0` (exact match, no drift). `GET
      /repos/CRM/fe-prionex` → `has_actions: true`, `has_pull_requests: false`,
      `default_branch: main`, `permissions.admin: true` — all as expected, no drift.
- [x] 1.3 🚨 Re-read via the API. Org baseline: `ci-hub` id 10 (`ubuntu-latest`), `s1-build-crm`
      id 12 (`s1`, `ci`, `build-crm`), `s1-deploy-dev-preprod` id 14 — **registered label is
      just `[deploy-dev-preprod]`, one label**, confirming and closing the drift flagged below:
      the container's `GITEA_RUNNER_LABELS` env carries four values but only one was ever
      actually registered server-side (env and registration diverge — expected, since env vars
      only apply at first-run auto-registration, which this runner didn't use either).
      🚨 **New drift, not in this story's baseline at all:** `s2-prod-deploy` id 17, label
      `[s2-prod-deploy]`, on **s2** (PROD) — appeared some time after Story 1.13's baseline, not
      mentioned anywhere. No collision with `node-20`/`docker-build`. Recorded, not adapted to
      silently — added to `deferred-work.md`.
- [x] 1.4 No collision with `node-20` / `docker-build` — confirmed against the live API list
      above (four foreign runners, including the newly-discovered `s2-prod-deploy`).
- [x] 1.5 Not re-fetched via swagger this session — proceeded on Story 1.13's already-established
      surface (`GET registration-token` exists, no cancel/delete endpoint). 🚨 **One correction
      found empirically instead:** `DELETE /repos/{owner}/{repo}/actions/runners/{id}` **does**
      exist and works (`204`, used in Task 3.5's fix to remove the stale duplicate runner) —
      Story 1.13 only confirmed the *run*-cancel endpoint is absent; the *runner*-delete endpoint
      is a different one and is present on this instance.
- [x] 1.6 Confirmed 2026-08-11: `git log --oneline -1` = `4032f867` (baseline_commit matches),
      tree at session start had only this story-cycle's own doc edits pending (nothing
      conflicting), `git log --oneline -1 origin/main` = `42fb1472` (local 1 commit ahead,
      fast-forward), `git ls-files .forgejo` = exactly `.forgejo/workflows/README.md`.
- [x] 1.7 Write budget declared and held to: (a) one runner registration (the pre-existing
      registration token in `.env` survived the first failed 403 attempt unconsumed — the ACL
      rejected the connection before Forgejo's app ever saw the token, so no second token was
      minted); (b) one runner registered (`s1-fe-prionex-1`, id 18); (c)–(e) probe branch,
      teardown and doc-commit writes not yet made (Tasks 6, 10). One write **outside** the
      original budget was made and is recorded openly, not silently: the nginx ACL on s1
      (`/etc/nginx/sites-available/forgejo-platform`) — necessary because the assigned subnet
      (`192.168.226.0/24`) was unreachable otherwise and no already-allowed subnet was free (all
      five were live single-tenant networks, one of them holding deploy/SSH credentials — see
      `#d10`). Done only after Oleg confirmed coordination with the host's administrator
      (aleksey), with a config backup and `nginx -t` before `systemctl reload nginx`.

### Task 2 — 🛑 HARD STOP: choose the runner host with Oleg (AC: 1, 7)

- [x] 2.1 🛑 Asked Oleg via AskUserQuestion. Answer: **s1** (`10.67.0.1`, internal address —
      Oleg: "по ssh по ключу, можно внутреннему адресу"). Not a separate VM/container host, and
      not s2 (excluded per `epics.md:243`).
- [x] 2.2 Raised as an input, not resolved by this story (per the proposal's own assignment to
      Story 4.2). Direct host inspection (Task 1.3 above) now gives Story 4.2 harder evidence
      than the proposal had: `ci-hub`, `s1-build-crm` and `s1-deploy-dev-preprod` are
      **confirmed** on s1 (container-level, not inferred from naming), and `s1-fe-prionex-1` is
      now a fourth. Logged in `deferred-work.md` for Story 4.2 to pick up.
- [x] 2.3 🛑 SSH access confirmed working: `ssh root@10.67.0.1`, key-based, internal address
      (Oleg-provided). Used continuously this session without issue.
- [x] 2.4 Prerequisites recorded 2026-08-11: `docker version` client **29.4.0**, server
      **29.4.0**; storage driver **overlayfs**; free disk on `/opt` — **739G available of 879G**
      (12% used), far above the ≥20 GB want; egress confirmed to `github.com` (HTTP/2 200),
      `code.forgejo.org` (HTTP/2 200), `git.crm-prionex.com` (HTTP/1.1 200).
- [x] 2.5 Name chosen: **`s1-fe-prionex-1`**, following the `<host>-<purpose>` convention of the
      three existing foreign runners. Story 1.9's second runner should mirror this as
      `s1-fe-prionex-2`.

### Task 3 — Register the runner at repository scope (AC: 1, 2)

- [x] 3.1 ⚠️ Deviated from the recommended path, recorded per the "attempted, not performed as
      specified" convention. Neither API endpoint nor the web UI was used to mint a *fresh*
      token — the registration token already present in `.env` (from the aborted first attempt,
      before the ACL fix) was reused, because the 403 that killed that first attempt came from
      the nginx ACL, **before** the request ever reached Forgejo's app to consume the token.
      Confirmed working: the second registration attempt (Task 3.5) succeeded with it, so it was
      never invalidated. Scope was still repository (`CRM/fe-prionex`), never org.
- [x] 3.2 forgejo-runner **v13.0.0**, OCI image `code.forgejo.org/forgejo/runner:13.0.0`
      (fallback form, not host binary — see Task 4.1 for why the recommended host-binary +
      systemd form was not used).
- [x] 3.3 Config generated by hand (not `generate-config`, since the DinD deviation needed keys
      `generate-config`'s defaults don't set correctly anyway) and iterated to the version in
      Task 4 below — `capacity`, `cache.*` and `container.*` all set explicitly, none left at
      default.
- [x] 3.4 `runner.labels: []` in `config.yml` — left empty. Labels were supplied at registration
      time via the interactive `register` prompts (Task 3.5), not via `--labels` or via
      `GITEA_RUNNER_LABELS` (see the corrected comment in `config.yml` — an earlier draft
      comment claiming env-var auto-registration was factually wrong, fixed in place).
- [x] 3.5 ⚠️ Registered via the **interactive** stdin-prompt form, not `--no-interactive` with
      flags — `--no-interactive` on this image does not read instance/token/name/labels from
      stdin at all (`instance address is empty`, empty name defaults to hostname); the working
      form (matching `/opt/forgejo-runner-deploy/scripts/register-runner-deploy.sh`'s own
      documented finding) is `forgejo-runner register --config /etc/forgejo-runner/config.yml`
      with `$FORGEJO_INSTANCE_URL\n$RUNNER_REGISTRATION_TOKEN\n$RUNNER_NAME\nnode-20,docker-build\n`
      piped via `printf | docker run --rm -i ...` stdin, never as CLI args (not visible in
      `ps aux`). Output: `"Registering runner, name=s1-fe-prionex-1,
      instance=https://git.crm-prionex.com, labels=[node-20 docker-build]."` →
      `"Runner registered successfully."` — no `Labels from command will be ignored` line, so
      Trap 5 did not fire.
      🔴 **This entry was wrong — walked straight into Trap 1, the exact one the story warns
      about at 3.5/4.3, and the first probe dispatch (Task 6.4) caught it.** The `--labels`
      value passed above was the bare string `node-20,docker-build`, with **no `:docker://<image>`
      suffix** — since forgejo-runner 8.0.0 a bare label is not host mode, so both resolved to
      the default `docker://node:22-bookworm`: `node --version` on the `node-20` job printed
      `v22.23.2`, and the `docker-build` job failed with `docker: command not found` (no CLI in
      that image). Both jobs failed, run id 328/index 14, ~29–63s. **Fixed**: stopped the
      daemon, deleted `.runner`, got a fresh registration token
      (`GET .../actions/runners/registration-token`), re-registered with the full spec —
      `node-20:docker://node:20-bookworm,docker-build:docker://code.forgejo.org/oci/docker:cli` —
      confirmed in the register output: `labels=[node-20:docker://node:20-bookworm
      docker-build:docker://code.forgejo.org/oci/docker:cli]`. New runner: `id: 19`, `uuid:
      c51f6bff-d739-44d9-bafc-7d7965d961c5`. The stale `id: 18` entry (old uuid
      `994b2244-8fbc-471f-8053-6e4d30edd6d0`, status `offline`) was cleaned up via `DELETE
      /repos/CRM/fe-prionex/actions/runners/18` → `204`, confirmed gone from the repo runner
      list (single entry, `id: 19`, remained afterward). Re-dispatch (run id 331/index 15,
      2026-08-11) succeeded on both jobs with the corrected images — see Task 6.
- [x] 3.6 Confirmed via API once `FJ_TOKEN` became available: `GET
      /repos/CRM/fe-prionex/actions/runners` → exactly one runner, `id: 19`, repository scope,
      `status: idle`, `labels: [node-20, docker-build]`. `GET /orgs/CRM/actions/runners` → the
      same four foreign runners as Task 1.3's baseline (`ci-hub` id 10, `s1-build-crm` id 12,
      `s1-deploy-dev-preprod` id 14, plus the drift-recorded `s2-prod-deploy` id 17), not
      containing ours. Both payloads captured above and in `#d10`.

### Task 4 — Configure capacity, docker access, cache and logging (AC: 3, 5)

- [x] 4.1 ⚠️ **Deviated from the recommended host-binary + systemd form — recorded, not
      silent.** Discovered mid-story that this shared hub enforces an unwritten-in-this-story
      but binding rule (**AD-6**, confirmed against all four existing runner projects on s1):
      the host's `docker.sock` is never mounted into any service, on any of them — a leak would
      expose OpenBao and another tenant's (`techno-finance`) containers. That rules out
      `container.docker_host: automount` entirely, recommended-form or fallback-form alike.
      Used the **DinD sidecar pattern** instead, matching all four existing runners: dedicated
      `dind` service (`docker:27.5.1-dind`, privileged, `dockerd -H tcp://0.0.0.0:2375
      --tls=false`, no unix socket at all), `runner` reaching it over TCP only
      (`container.docker_host: tcp://dind:2375`). No host socket path appears anywhere in
      `docker-compose.yml`. See `#d10`.
- [x] 4.2 `runner.capacity: 2` — chosen and recorded for the reasons the story gives (Story 2.1's
      four CI jobs, NFR1's 15-minute budget, Story 1.9 AC3).
- [x] 4.3 `docker-build:docker://code.forgejo.org/oci/docker:cli` — not registered bare. Image
      confirmed to have the docker CLI (used successfully in Task 4's own DinD reachability
      tests via `docker -H tcp://localhost:2375 run --rm curlimages/curl ...`, proving the
      DOCKER_HOST wiring end-to-end, not just that the image pulls).
- [x] 4.4 Mechanism recorded as **DinD** (not mounted socket) — required by AD-6, see 4.1.
      `container.options: "-e DOCKER_HOST=tcp://172.17.0.1:2375"` (the nested engine's own
      default-bridge gateway, reachable from inside a job container without leaving the nested
      namespace — the pattern used by the project's own
      `examples/docker-compose/compose-forgejo-and-runner.yml`), `container.docker_host:
      "tcp://dind:2375"`, `container.valid_volumes: []` (unchanged — no volumes added).
- [x] 4.5 🚨 **Hit Trap 2 in a form the story's own notes did not anticipate, because DinD
      nesting is one level deeper than the notes assume.** Neither "leave `cache.host` empty"
      nor "host-binary form: set it to the host's LAN IP" works here: `cache.host` empty →
      unreachable bridge IP as documented; `cache.host: "10.67.0.1"` (host LAN IP, published
      port `10.67.0.1:34568`) **also fails** — proved by spawning a real container *inside* the
      nested `dind` engine (`docker -H tcp://localhost:2375 run --rm curlimages/curl ...`, i.e.
      what an actual job container is) and getting `download timed out`: hairpin NAT back to the
      host's own external IP does not work from this double-nested path, even though the host
      itself and the outer `dind` container can both reach that same address. The address that
      *does* work, confirmed with the identical nested-container test: the `runner` container's
      **own IP on the shared bridge**, `192.168.226.3` (pinned statically in `docker-compose.yml`
      so it survives recreation) — reachable via ordinary NAT through `dind`'s own `eth0`, same
      subnet, no gateway hop. `cache.proxy_port: 34568`, `container.network: ""` (left default —
      irrelevant in full DinD nesting; job containers never attach to the outer bridge at all,
      so there was nothing to gain by setting it). Resulting `ACTIONS_CACHE_URL` base:
      `http://192.168.226.3:34568/`. Full detail in `#d10`.
- [x] 4.6 `log.level: debug`, `log.job_level: debug` set now; not yet reverted — Task 10.5.
- [x] 4.7 Daemon started via `docker compose up -d`. Log-level confirmation:
      `"runner: s1-fe-prionex-1, ..., declared successfully"` + `"[poller] launched"`.
      API-side confirmation obtained once `FJ_TOKEN` arrived: `GET
      /repos/CRM/fe-prionex/actions/runners` → `status: idle` (runner `id: 19`, after the
      Task 3.5 label-registration fix — see there for why the id changed from 18).

### Task 5 — Prove durability (AC: 7)

- [x] 5.1 `restart: unless-stopped` on the `runner` service in `docker-compose.yml` (compose
      form — no systemd unit, matching how this hub already supervises the other three DinD
      runners). Confirmed via `docker inspect forgejo-runner-fe-prionex --format
      '{{.HostConfig.RestartPolicy.Name}}'` → `unless-stopped`.
- [x] 5.2 🚨 **First attempt gave a false negative, and the reason is itself a finding worth
      keeping.** `docker kill forgejo-runner-fe-prionex` — container exited (137) and **did not
      restart** (`RestartCount=0`). Root cause: Docker treats an operator-issued `docker kill`
      as an intentional stop, same as `docker stop`, and does not apply the restart policy to
      it — this is expected Docker behaviour, not a bug in the policy. Re-ran the test properly:
      started the container back up, then sent `SIGKILL` to its **real host PID**
      (`docker inspect --format '{{.State.Pid}}'`, *not* `docker kill` and *not* `docker exec
      ... kill -9 1`, which silently no-ops in this image — see the note below) — this is what
      an actual crash looks like to the daemon. Result: `RestartCount` → `1`, fresh
      `StartedAt`, and the daemon log shows a full clean re-declare within the same second:
      `"runner: s1-fe-prionex-1, ..., declared successfully"` + `"[poller] launched"`. The
      `dind` sidecar was untouched throughout (`restarts=0`, stayed `healthy`) — confirms the
      two services fail independently. ⚠️ Re-reading the **repo runner list via the API** to see
      it round-trip through offline→idle is blocked on `FJ_TOKEN` (Task 1.1) — the container-level
      evidence above stands in for it for now.
      🚨 **Side finding, worth carrying into Story 1.9:** `docker exec forgejo-runner-fe-prionex
      sh -c 'kill -9 1'` reports `exit=0` but does not actually deliver the signal — the
      container keeps running. Confirmed with a live poll loop (10× 1s samples, `StartedAt`
      never changed). A genuine crash test on this image must signal the **host-side** PID, not
      exec into the container.
- [ ] 5.3 ⚠️ **Not done — needs an explicit go-ahead, not assumed.** s1 is a shared production
      hub carrying three other tenants' live infrastructure (`techno-finance`, the observability
      stack, three other orgs' runners); rebooting it is outside what this story should decide
      unilaterally. Recording per the story's own instruction: reboot recovery is **asserted**
      from `restart: unless-stopped` (a container with this policy is started by the Docker
      daemon itself on daemon startup, which in turn is enabled at boot on every other runner
      project on this host) — **not observed**. If Oleg wants it actually observed, that is a
      deliberate, scheduled action on shared infrastructure, not a quick check.
- [x] 5.4 Log location for the next person: `docker logs forgejo-runner-fe-prionex` /
      `docker compose -f /opt/forgejo-runner-fe-prionex/docker-compose.yml logs runner` (as
      `forgejo-runner-fe-prionex` user). No systemd/journalctl — this project is pure compose.

### Task 6 — Land the probe workflow and exercise both labels (AC: 3, 4, 5)

- [x] 6.1 Cut from `main` at `4032f867` (`git switch -c probe/forgejo-runner main`), pushed as
      `ea7b7f47`. Matches no `push` filter or tag pattern on any ref.
- [x] 6.2 Add `.forgejo/workflows/probe-runner.yml`. 🚨 **Do not delete or modify
      `README.md`.** 🚨 **Do not use a Story 2.1 filename** (`ci.yml`, `build.yml`,
      `deploy-dev.yml`, `deploy-preprod.yml`, `deploy-prod.yml`, `dev-reset.yml`).
      Requirements for the file:
      - `on: workflow_dispatch` **only**, with a single input `expect_cache_hit` (default
        `'false'`). 🚨 `workflow_dispatch` inputs arrive as **strings** — compare
        `== 'true'`, never as a boolean.
      - Two jobs: one `runs-on: node-20`, one `runs-on: docker-build`. 🚨 **No job may use
        `ubuntu-latest`, `s1`, `ci`, `build-crm` or `deploy-dev-preprod`** — those land on
        foreign runners and you cannot cancel the run.
      - `node-20` job: `node --version` (AC4), then `actions/checkout`,
        `actions/setup-node@v4` with `node-version: '20'` and `cache: 'npm'`, **then
        `npm ci`** (AC5).
        🚨 **The `npm ci` step is not optional.** `setup-node`'s post-job step caches
        `$(npm config get cache)` (`~/.npm`); with no install that directory is empty or
        absent, the save step logs a path-validation warning and stores **nothing**, and
        every subsequent dispatch reports `cache-hit: false` forever — a failure that looks
        exactly like Trap 2 and is not. Mirror `.github/workflows/CI.yml:15-25`
        (checkout → setup-node → `npm ci`), **not** `:15-21`.
      - `docker-build` job: **`run:` steps only — no `uses:` of any kind.** The docker-CLI
        image behind this label carries no Node runtime, so any JS action (`checkout`,
        `setup-node`) fails with an error that looks like an action-resolution failure and is
        not one — the mirror of Trap 1, one layer up. Print **both** client and server
        versions (AC3).
      - Reference third-party actions by full URL —
        `uses: https://github.com/actions/checkout@v6`, pinned at `@v6` — per
        `epics.md:237-239`. Egress to
        github.com from the runner was checked in Task 2.4; if it is absent, substitute a
        `code.forgejo.org` mirror and record the substitution (this overlaps Story 1.8's AC1 —
        record the finding, do not expand scope).
      ✅ Written as specified: `workflow_dispatch` only with `expect_cache_hit` (string-compared
      `== 'true'`), `node` job on `node-20` (checkout → setup-node → `npm ci`, matching
      `CI.yml:15-25`), `docker` job on `docker-build` with `run:`-only steps, third-party actions
      referenced by full `https://github.com/...` URL pinned at `@v6`. Egress to github.com was
      confirmed in Task 2.4, so no mirror substitution was needed.
- [x] 6.3 🚨 **Make the workflow assert, not just report — this is Trap 3.** Job logs are **not
      readable through the API with a bearer token**; the web-UI log routes
      (`/actions/runs/{n}/jobs/{i}/logs`) require **session-cookie auth** (Story 1.3's Debug
      Log). Job *status*, however, is readable via `GET /api/v1/repos/CRM/fe-prionex/actions/tasks`.
      So encode every assertion into **exit status**, so a green job is itself the evidence:
      - `node --version | grep -q '^v20\.'` or the job fails.
      - `docker version --format '{{.Server.Version}}'` must be non-empty, plus
        `docker version --format '{{.Client.Version}}'`.
      - For the cache: capture `steps.<id>.outputs.cache-hit` from `setup-node` and fail the job
        when the second run does not report a hit. **`setup-node` never fails on a missing cache
        server** — it short-circuits and logs the misleading
        `Cache action is only supported on GHES version >= 3.5...`, so step success proves
        nothing. On a real hit the log line is `Cache restored from key: node-cache-Linux-x64-npm-<hash>`;
        on a miss it is `npm cache is not found`.
      Also read the runner-side log (`journalctl` / `docker logs`, at `job_level: debug`) and
      quote the cache lines verbatim into the Debug Log — that is your independent evidence and
      the reason 4.6 sets debug.
      ⚠️ Assertions written but not yet fired — see 6.4/6.5, blocked on `FJ_TOKEN`.
- [x] 6.4 Committed `chore(ci): probe runner labels` (`ea7b7f47`) — the project's husky
      pre-commit hook ran in full (lint, format, typecheck, all 1921 vitest tests, ~154s) and
      passed, not skipped; pre-push ran the production build and passed. Pushed
      `probe/forgejo-runner` to `origin`. Dispatched once `FJ_TOKEN` arrived (`POST
      .../dispatches` → `204`) — first attempt surfaced the Task 3.5 label bug (see there),
      re-dispatched after the fix. Second dispatch for Task 7.2, same mechanism.
- [x] 6.5 First dispatch (`expect_cache_hit=false`), post-fix: run **id 331 / index 15**, event
      `workflow_dispatch`, `created`/`started` `2026-08-11T11:54:15/16+02:00`, `stopped`
      `11:55:18+02:00` (~62s — a real `npm ci`, not a short-circuit). Per-job (`GET
      .../actions/tasks`): `node-20 label` id 1382 → `success`, `docker-build label` id 1383 →
      `success`. (The **first** dispatch attempt, before the Task 3.5 fix, was run id 328 /
      index 14, both jobs `failure`, ~29–63s — see Task 3.5 for the root cause and fix.)
- [x] 6.6 Both jobs ran on our runner: confirmed by the runner-side debug log
      (`docker compose logs runner` on `s1`, under
      `[Probe runner labels/node-20 label]` / `[.../docker-build label]` prefixes — the only
      runner that could have produced these labelled log sections) and by the repo-scoped
      runner list containing exactly one runner (`id: 19`) with these two labels. No job
      referenced `ci-hub`, `s1`, `ci`, `build-crm`, `deploy-dev-preprod` or `s2-prod-deploy`
      anywhere. Org runner list (Task 8) unchanged in membership across the whole session.

### Task 7 — Prove the npm cache hit (AC: 5)

- [x] 7.1 First (priming) dispatch, run 331/index 15: runner-side log line verbatim —
      `"npm cache is not found"`. Job did not fail on this expected miss (assertion gated on
      `expect_cache_hit`, which was `"false"`).
- [x] 7.2 Second dispatch (`expect_cache_hit=true`): run **id 337 / index 16**,
      `created`/`started` `2026-08-11T13:31:03/04+02:00`, `stopped` `13:31:36+02:00` (~32s —
      about half the priming run's duration, corroborating but not the proof). Job `node-20
      label` id (per tasks endpoint, same run) → `success`. Runner-side log, verbatim:
      `"Cache restored from key:
      node-cache-linux-x64-npm-a49d1a07fc95c9dbd26d4f0760f32e66fe46b9ae13f54829f9972834d766f7d2"`,
      `"Cache Size: ~99 MB (103619614 B)"`. The workflow's own assertion step logged
      `"cache-hit output: true"` and passed (`✅ Success - Main Assert cache-hit expectation`) —
      the job would have failed had it not matched, so this is the actual proof, not just the
      corroborating duration.
- [x] 7.3 Side by side: run 331/index 15 (miss, ~62s, `npm cache is not found`) vs. run
      337/index 16 (hit, ~32s, `Cache restored from key: node-cache-linux-x64-npm-a49d1...`,
      `cache-hit: true`). Both on runner `id: 19`.
- [x] 7.4 Not needed — the save side worked on the first attempt (confirmed by 7.2's restore
      succeeding), so there was no miss to diagnose.

### Task 8 — Verify scope isolation and that the neighbours are untouched (AC: 2, 6)

- [x] 8.1 Re-read both lists (post-fix, post-dispatch state). Repo list: exactly our runner,
      `id: 19`. Org list: same four ids as Task 1.3's own capture within this session (10, 12,
      14, 17) — identical membership across the whole session, our runner never appears there.
      `s1-build-crm` showed `status: active` on this later read (someone else's job, unrelated to
      this story — confirms the org runners are genuinely live/shared, not idle props).
- [x] 8.2 Positive statement: `CRM/fe-prionex`'s Actions offers exactly one runner —
      repository-scoped, `id: 19`, `node-20`/`docker-build`. What was checked: its total absence
      from `GET /orgs/CRM/actions/runners` across every read this session, and that both probe
      dispatches (Tasks 6, 7) landed on it (runner-side log confirms, Task 6.6). What was **not**
      checked: whether a job from a *different* repository could somehow target it — not tested,
      not claimed.
- [x] 8.3 Reconciliation: epic text names four taken labels; this session observed **five** org +
      repo runners in total — `ubuntu-latest`, `s1`/`ci`/`build-crm`, `deploy-dev-preprod`,
      `s2-prod-deploy` (org, none epic-listed except implicitly via the first two), plus our own
      `node-20`/`docker-build` (repo). `s1-deploy-dev-preprod` and `s2-prod-deploy` both post-date
      the epic text — recorded as drift in `deferred-work.md`, not reconciled into the epic
      itself (out of this story's scope).

### Task 9 — Record the outcome (AC: 3, 6, 7)

- [x] 9.1 Took `D10` for this story (default action). Renumbered `D10`→`D11` / `#d10`→`#d11`
      mechanically inside
      `_bmad-output/implementation-artifacts/1-6-secure-the-pre-prod-infrastructure-commitment.md`
      only — 19 lines touched (18 caught by a plain-text `sed` pass, one bare `id="d10"` inside a
      code-example that needed a manual fix since it wasn't prefixed with `D`/`#`), verified zero
      `D10`/`d10` remaining afterward. No other file touched by the renumber.
- [x] 9.2 Entry written at `docs/migration-decisions.md#d10` — host + why (s2 excluded), repo
      scope, both label strings verbatim with `docker://` suffixes, name + version + why pinned,
      capacity, DinD vs mounted-socket and why (AD-6), cache config and why the defaults fail
      (with the specific hairpin-NAT finding), supervision mechanism. ⚠️ **Org-runner inventory
      section is explicitly marked incomplete in the entry itself** (🚧), pending `FJ_TOKEN` — it
      lists what direct host inspection confirmed and says plainly that the formal API
      cross-check has not run yet, rather than presenting an unverified list as final.
- [x] 9.3 Conventions followed: Russian prose, English identifiers; explicit `<a id="d10"></a>`
      anchor; D1–D9 untouched; index-table row added immediately after the D9 row; anchor range
      in the header paragraph (was `#d1` … `#d9`) extended to `#d10`; changelog row appended
      (`11.08.2026 | 1.7 | ...`).
- [x] 9.4 `docs/forgejo-migration.md` Фаза 1 amended by marking (✅ annotations with links to
      `#d10`), not rewriting: item 1 (host chosen), item 2 (labels + backing images), item 3
      (cache config actually required), DoD's «обе метки работают» clause marked done. Items 4
      and 5 left open (Stories 1.8, 1.9); the «все actions резолвятся» DoD clause left unmarked
      per the instruction, even though `checkout`/`setup-node` were incidentally exercised while
      proving DinD reachability.
- [x] 9.5 Added to `deferred-work.md`: the Node 20 EOL finding, the s1-contention observation now
      directly confirmed (not just asked about, per Task 2.2), the label-count drift on
      `s1-deploy-dev-preprod` found by direct (non-API) host inspection, and the `docker exec
      kill -9 1` no-op finding for Story 1.9 to avoid repeating.
- [x] 9.6 Citations re-checked against `docs/migration-decisions.md` at its post-edit state:
      anchors used throughout (`#d10`) rather than line numbers, so this record does not carry
      its own line-number citations to go stale. `docs/forgejo-migration.md` edits cite `#d10`
      the same way. `deferred-work.md` additions cite `epics.md:161-163` and
      `docs/forgejo-migration.md:142` — both re-checked against HEAD, unchanged by this story's
      own edits (Фаза 1's other line ranges shifted; those two specific lines did not).

### Task 10 — Tear down the scaffolding and verify the invariant (AC: 8)

- [x] 10.1 Deleted after Tasks 6/7's dispatches completed (not before — the branch was still
      needed live for them): `git push origin --delete probe/forgejo-runner` → deleted
      (`ea7b7f47`), `git branch -D probe/forgejo-runner` locally. Confirmed with `git branch -a`
      (no local/remote-tracking `probe/*` refs) and `GET /repos/CRM/fe-prionex/branches`
      (no `probe`-named branch in the list).
- [x] 10.2 ⚠️ **Git-side confirmed, API cross-check still blocked on `FJ_TOKEN`.** After
      `git fetch origin main staging development`: `.forgejo/workflows/README.md` present and
      **byte-identical** on all three (`git ls-tree` blob `c9aeac2f0f0adf492d66781e3fbd330217844ee2`
      on every ref, exact match to Story 1.13's recorded value), and no `.yml` present on any of
      them. The `curl .../contents/.forgejo/workflows?ref=<r>` server-side cross-check is not
      run — not treated as equivalent to the git-side result, just recorded as the remaining gap.
- [x] 10.3 `git diff 4032f867 -- .github/workflows/` — empty, exit 0. `git log --oneline
      4032f867..HEAD -- .github/` — empty. This story has made zero changes under `.github/`.
- [x] 10.4 Confirmed present and `idle`: `GET /repos/CRM/fe-prionex/actions/runners` → single
      entry, `id: 19`, `status: idle`. Left registered — this is the deliverable, not a probe.
- [x] 10.5 `config.yml` on `s1`: `log.level` and `log.job_level` both `debug` → `info`
      (`sed` in place, backup taken first then removed once verified). `docker compose restart
      runner` — daemon log post-restart shows no `[DEBUG]` lines, only `level=info`. Confirmed
      still `idle` afterward via `GET /repos/CRM/fe-prionex/actions/runners`.
- [ ] 10.6 Commit with the project's convention — Conventional Commits with a scope, **no
      `KAN-###`** (Jira ids are for feature work only), and split by area:
      `docs(migration): …` for `docs/`, `chore(bmad): …` for `_bmad-output/`. Push `main` as a
      fast-forward; verify fast-forward status first as Story 1.13's Task 1.1 did.
      🚨 Pushing `main` is safe **because** the placeholder suppresses `.github/workflows/` on
      that ref — confirm no run is created after the push
      (`GET /api/v1/repos/CRM/fe-prionex/actions/runs` `total_count` unchanged).
- [ ] 10.7 Update `_bmad-output/implementation-artifacts/sprint-status.yaml`: the `1-7-…` entry
      (line 64) `ready-for-dev` → `review`, and bump `last_updated`. Verify the current value
      before writing. Leave every other entry alone.

## Dev Notes

### What this story produces

1. **A live, supervised forgejo-runner** on a host that is not s2, registered at **repository**
   scope on `CRM/fe-prionex`, exposing labels `node-20` (backed by `node:20-bookworm`) and
   `docker-build` (backed by a docker-CLI image), with a working cache server. This is the only
   durable artifact; everything else is evidence or documentation.
2. **A decision record** (`docs/migration-decisions.md#d10`) capturing host, scope, labels,
   pinned version, capacity, docker mechanism and cache configuration.
3. **Amendments to `docs/forgejo-migration.md` Фаза 1** turning the plan's instructions into
   recorded facts.
4. **Nothing on `main`, `staging` or `development` under `.forgejo/workflows/`** — the probe
   workflow and its branch are gone by the end.

### The argument in one paragraph — memorize this

Three foreign runners already serve the `CRM` org, one of them idle and carrying
`ubuntu-latest`, which is the label every legacy job requests. Story 1.13 stopped Forgejo
falling through to `.github/workflows/` on the three branch heads, but the same directory that
suppresses execution becomes the executor the moment a `.yml` appears in it. This story is the
gate: once our own repository-scoped runner exists with labels nobody else has, workflows can
safely be written against `node-20` and `docker-build` and can only ever land on our hardware.
Everything dangerous in this story comes from the same root — **you can start a run and you
cannot stop it**, so every trigger you create must be one you chose deliberately, on a branch
nobody else uses, with a label only you own.

### 🚨 Five traps that break the obvious implementation

**Trap 1 — a bare label is not host mode; it is `docker://node:22-bookworm`.**
Since forgejo-runner **8.0.0**, `Parse()` defaults an unqualified label to schema `docker` with
arg `//node:22-bookworm`. So registering `docker-build` bare gives you a Node image with **no
docker CLI**, and AC3's `docker version` fails on the *client*, before the socket matters.
Release notes: *"in the absence of a label or a label, default to `docker://node:22-bookworm`
instead of `docker://node:20-bullseye` or `host`"*. The grammar is `<name>:<type>://<arg>` with
exactly three schemas — `docker`, `host`, `lxc`; `host` takes no argument; the only accepted
label option is `?platform=`. **Fix: register `docker-build:docker://<image with docker CLI>`.**
Story 1.3 hit the mirror image of this trap from the other side and wrote it up as a hard rule:
a bare label runs in host mode *in older runners*, ships no Node runtime, and `actions/checkout`
then fails with an error indistinguishable from "unsupported".

**Trap 2 — the cache server's host is auto-detected by dialling 8.8.8.8.**
`cache.host` empty → `GetOutboundIP()` UDP-dials `8.8.8.8:80` and takes the local socket
address. Inside a container that is the runner's own bridge IP, which job containers on a
different auto-created network cannot reach; combined with `proxy_port: 0` (random, unpublished)
`actions/cache` dies with `connect ETIMEDOUT`. The runner runs a two-tier cache: an internal
server on `cache.port` and a **proxy** on `cache.proxy_port`, and it is the **proxy** URL that
becomes `ACTIONS_CACHE_URL`, suffixed with a per-run id. That suffix is a **proxy routing
token, not a cache partition** — entries are stored per repository and *are* visible to later
runs. If they are not, the fault is in the save step (Task 7.4), not the suffix.
**Fix: set `cache.host`, a fixed
`cache.proxy_port`, and `container.network`.** Last resort: `cache.actions_cache_url_override`.
The upstream config comment says it outright: *"It may be impossible to figure out the host
automatically if the containers or host running the workflows reside on a different network than
the Forgejo runner."*

**Trap 3 — a missing cache server does not fail the job; it succeeds with a misleading message.**
`actions/setup-node@v4` delegates to `@actions/cache` 4.0.3, whose gate is literally
`return !!process.env['ACTIONS_CACHE_URL']`. Because the toolkit's `isGhes()` is always true on
Forgejo (the server host is not github.com), it short-circuits to the GHES branch and logs
`Cache action is only supported on GHES version >= 3.5...` — **and the step goes green.** So
AC5 cannot be asserted from step success. Assert on the `cache-hit` output (declared in
`setup-node`'s `action.yml`) or on the exact log line `Cache restored from key: <key>`; a miss
prints `npm cache is not found`. Compounding this: **job logs are not readable via the API with
a token** — the web-UI log routes need session-cookie auth (Story 1.3). Job *status* is readable
(`/actions/tasks`). Hence Task 6.3: make the workflow fail when there is no hit, so the job
status carries the evidence.

**Trap 4 — there is no cancel endpoint and no `unregister` command.**
`POST .../actions/runs/{id}/cancel` → 404 in this version, confirmed against the full swagger.
Only start runs you are willing to see finish. On the runner side there is likewise **no
`forgejo-runner unregister` and no `--remove` flag** — the v13 subcommand set is `register`,
`create-runner-file`, `daemon`, `one-job`, `exec`, `validate`, `generate-config`,
`cache-server`. The runner's own error text says *"Please manually delete the runner '%s' from
the Forgejo UI to avoid a stale runner entry"*. Removal is server-side: web UI, or
`DELETE /api/v1/repos/{owner}/{repo}/actions/runners/{runner_id}` — **verify that path exists on
this instance in Task 1.5** before relying on it for rollback; it is Forgejo ≥15 / Gitea ≥1.24
only and is absent from the Gitea 1.22 swagger this instance advertises compatibility with.

**Trap 5 — `--labels` is silently ignored when `runner.labels` is set in the config.**
`register.go` logs only `Labels from command will be ignored, use labels defined in config
file.` and carries on. If the labels you think you registered are not the labels the API
reports, this is why. Task 3.6 verifies against the API rather than against your intent —
do not skip it.

### Files being created and modified

**NEW — `.forgejo/workflows/probe-runner.yml`** *(on branch `probe/forgejo-runner` only;
deleted in Task 10)*. `on: workflow_dispatch` only. Two jobs, `runs-on: node-20` and
`runs-on: docker-build`. Never merged to any long-lived ref.

**UPDATE — `docs/migration-decisions.md`** *(636 lines; Russian; append-only for decision
content)*. Current state: header paragraph at line 8 with anchor range `` (`#d1` … `#d9`) ``;
index table rows D1–D9 at lines 14–22; anchors at 26, 77, 112, 164, 193, 213, 248, 288, 413;
`<a id="changelog"></a>` at 624 with the changelog table starting at 628, latest rows dated
`10.08.2026`. **Must be preserved:** every existing D-entry verbatim (D1–D9 are never rewritten
— `migration-decisions.md:8-10`: «Записи не переписываются задним числом»), the index table
shape, and the explicit-HTML-anchor convention. **This story changes:** one new anchor + entry
before `<a id="changelog"></a>`, one index row after line 22, the anchor range on line 8, and
one or two changelog rows.

**UPDATE — `docs/forgejo-migration.md`** *(317 lines; Russian)*. Фаза 1 is lines 128–149 and
already carries Story 1.13's ⚠️ annotations; the reserved labels sit at `:142-143`, §4's
"don't put a real workflow here until 1.7/1.9" warning at `:261-265`, §5's risk table at
`:284-295`. **Must be preserved:** the "mark rather than rewrite" convention (struck-through
text stays), the bidirectional links to `migration-decisions.md#dN`, and §4's and §5's existing
warnings. **This story changes:** Фаза 1 items 1–3 and the section DoD.

**UPDATE — `_bmad-output/implementation-artifacts/deferred-work.md`** *(94 lines)*. Append-only
list of carried-forward findings. Existing entries relevant here: `fe_tmp` scope breadth
(10-13), the no-cancel-endpoint entry naming Stories 1.7/1.8/4.4 (46-50), branch-protection
gaps (51-58), the 497-branches / `has_pull_requests` item (87-94).

**UPDATE — `_bmad-output/implementation-artifacts/sprint-status.yaml`**. Only the `1-7-…` row
and `last_updated`.

**UPDATE (conditional) — `_bmad-output/implementation-artifacts/1-6-secure-the-pre-prod-infrastructure-commitment.md`**.
Only if Task 9.1's default path is taken: mechanical `D10`→`D11` / `#d10`→`#d11` renumber. No
other change to that file.

**NOT IN THIS REPOSITORY, and must never be committed:** `runner-config.yml`, `.runner` (holds
the runner's permanent instance secret), the systemd unit, the registration token.

**UNCHANGED, and required to stay so:** `.github/workflows/CI.yml`, `.github/workflows/CD.yml`
(D7 — no action of any kind is taken on GitHub), `.forgejo/workflows/README.md`.

### Verified repository facts (checked at `4032f867`)

```
HEAD                              4032f867 chore(bmad): create story 1.6, …
origin/main                       42fb1472   (local main is 1 commit ahead → fast-forward push)
working tree                      clean
git ls-files .forgejo             .forgejo/workflows/README.md      (the only entry)
.forgejo/workflows/README.md      blob c9aeac2f0f0adf492d66781e3fbd330217844ee2
package-lock.json                 present at repo root  (setup-node hashes it into the cache key)
.github/workflows/CI.yml:12,34,53,82     runs-on: ubuntu-latest   (four jobs)
.github/workflows/CI.yml:15,37,56,85     uses: actions/checkout@v6
.github/workflows/CI.yml:18-21           actions/setup-node@v4, node-version: '20', cache: 'npm'
.github/workflows/CI.yml:102             actions/upload-artifact@v4
.github/workflows/CD.yml:31,119          runs-on: ubuntu-latest   (two jobs)
epics.md:161-163                  FR28 — the two labels, verbatim
epics.md:243                      "The runner must not be hosted on s2."
epics.md:593-634                  Story 1.7, the five ACs
docs/migration-decisions.md:8     anchor range "(`#d1` … `#d9`)"  ← must become #d10
docs/migration-decisions.md:14-22 index table rows D1–D9
docs/migration-decisions.md:413   <a id="d9"></a>   (highest existing anchor)
docs/migration-decisions.md:624   <a id="changelog"></a>
docs/forgejo-migration.md:128-149 Фаза 1 — Runner-инфраструктура
docs/forgejo-migration.md:142-143 the two labels reserved for this story
docs/forgejo-migration.md:261-265 "do not put a real workflow here until 1.7/1.9"
```

### Live-instance facts (as of 2026-08-10 — re-verify in Task 1)

- Instance `https://git.crm-prionex.com`, version **`15.0.5+gitea-1.22.0`**.
- Repo `CRM/fe-prionex`, private, `has_actions: true`, `has_pull_requests: **false**`,
  `default_branch: main`, `mirror: false` (Oleg, 2026-08-10: «нет зеркала»).
- Git remote: `ssh://git@git.crm-prionex.com:2222/CRM/fe-prionex.git`. **No GitHub remote.**
- **Anonymous API is refused** (`REQUIRE_SIGNIN_VIEW`) — every call needs
  `-H "Authorization: token $FJ_TOKEN"` (token, **not** Bearer).
- Two API prefixes both live: `/api/v1/…` (Gitea-compat, everything) and
  `/api/forgejo/v1/version` (the authoritative Forgejo version).
- **Org runners (foreign, do not touch):** `ci-hub` [`ubuntu-latest`], `s1-build-crm`
  [`s1`,`ci`,`build-crm`], `s1-deploy-dev-preprod` id 14 [`deploy-dev-preprod`] — all
  forgejo-runner **v13.0.0**, idle. **Repo runners: `[]`** — Story 1.3 deregistered its probe
  runner so 1.7 starts clean.
- Branch protection exists on `main` and `staging` (no force-push/delete for non-admins), not on
  `development`, no tag protection, and `apply_to_admins: false` — **the `fe_tmp` token is repo
  admin and is not constrained by it**. Protection is not a safety net for you.
- Endpoints known **absent**: `POST .../actions/runs/{id}/cancel` (404),
  `GET /api/v1/settings/actions`.
- `workflow_dispatch` by API demonstrably works on this instance (Story 1.3, recorded in `#d9`).
- Hosts: **s1 = `72.62.17.132`** (DEV + PRE-PROD), **s2 = `175.110.122.17`** (PROD, forbidden).
  Planned s1 ports: `8080` legacy DEV, `8082` new DEV (Story 4.2), `8081` PRE-PROD (Story 5.2).

### Anti-patterns for this story

- ❌ **Registering at organization scope.** Repository scope is the decision
  (`sprint-change-proposal-2026-08-07-runners.md` §4.2, approved 2026-08-07). Org scope would
  offer our runner to every repo in `CRM`.
- ❌ **Using, adopting or reconfiguring `ci-hub`, `s1-build-crm` or `s1-deploy-dev-preprod`.**
- ❌ **Emitting `runs-on: ubuntu-latest`** — or `s1`, `ci`, `build-crm`, `deploy-dev-preprod` —
  anywhere. Idle foreign runners execute immediately and you cannot cancel.
- ❌ **Leaving any run to complete on another team's runner.** Story 1.13 did this for 74s and
  recorded it as a broken anti-pattern rather than hiding it. If it happens, say so.
- ❌ **Putting a workflow file on `main`, `staging` or `development`.** That is Story 2.1's job.
- ❌ **Deleting or editing `.forgejo/workflows/README.md`.**
- ❌ **Writing `$FJ_TOKEN`, a registration token, or `.runner`'s contents into any file.**
- ❌ **Minting a new API token.** `fe_tmp` exists and is deliberately kept live.
- ❌ **Re-enabling `has_pull_requests`.**
- ❌ **Relying on `latest` for the runner image**, or falling back to `:6`.
- ❌ **Claiming a cache hit from a green step**, or a reboot recovery you did not observe, or an
  isolation property you did not test. Record «не проверено» explicitly — that is the house
  standard set by 1.13.
- ❌ **Deregistering the runner at the end.** It is the deliverable.
- ❌ **`--no-verify` on a `main` commit.** On `main`, `.husky/pre-commit` runs `format:check`,
  `lint`, `typecheck`, `test:run` (1921 tests) and `.husky/pre-push` runs `npm run build` —
  run them. A Radix `focus-scope` timer test is intermittently flaky in a different file each
  time; retry once before treating it as a regression.
- ✅ **`--no-verify` *is* expressly permitted on `probe/forgejo-runner`.** It is cut from
  `main`, so the `origin/staging` exemption Story 1.13 used does not cover it — this one does.
  The branch is throwaway, never merged, and adds no code the hooks can check, while the cache
  work needs several iterations. Log each such commit against the Task 1.7 write budget.

### Previous story intelligence

**Story 1.3 (done) — "Verify Forgejo Actions Availability and Concurrency Support".** The only
story that has ever registered a runner here. It used repository scope deliberately, so it would
"leave no artefact at the `CRM` org **for Story 1.7 to reconcile**", and reserved `node-20` and
`docker-build` for you. Its recipe, reusable with the corrections above:

```bash
forgejo-runner generate-config > runner-config.yaml    # 1.3 used .yaml; this story uses .yml

docker run --rm -v "$PWD/runner-data:/data" \
  code.forgejo.org/forgejo/runner:13 \
  forgejo-runner register --no-interactive \
    --instance https://git.crm-prionex.com \
    --token '<REGISTRATION_TOKEN>' \
    --name <name> \
    --labels '<label>,<label>'

docker run -d --name <name> --user root \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v "$PWD/runner-data:/data" \
  -v "$PWD/runner-config.yaml:/config.yaml" \
  code.forgejo.org/forgejo/runner:13 \
  forgejo-runner daemon --config /config.yaml
```

Its hard-won findings, all of which apply to you: `:latest` is not published; `:6` cannot run
`actions/checkout@v6` (`got node24`); the docker socket mount hits `permission denied` without
`--user root`; job logs need session-cookie auth so `docker logs` at `job_level: debug` was the
log source; the Actions UI enumerates dispatchable workflows from the **default branch** only,
while API dispatch works on any ref; registration tokens are single-use-to-register, not
reusable credentials, and are reset at `…/settings/actions/runners`. It also recorded a
carried-forward warning: a runner left registered on a workstation *"can silently pick up a
later Story 1.7/1.8 job"* — that runner is confirmed gone, but it is the reason Task 1.3 checks.

**Story 1.13 (done) — "Stop Forgejo from Executing the Legacy GitHub Workflows".** Landed the
placeholder on all three refs (`f20bb27c` staging, `b9962867` development, `f155b409` main),
proved by observation that no run is created, and recorded it as **D9**. Its operational lessons
are the backbone of this story's warnings: the no-cancel discovery; the 74-second run on
`ci-hub`; `has_pull_requests` toggled on and back off; branch protection added to `main` and
`staging` with `apply_to_admins: false`; the write-budget discipline; and the citation
discipline (verify `path:line` at HEAD, prefer anchors). Its per-commit invariant — «любая
ссылка, которую Forgejo резолвит на коммите без `.forgejo/workflows/`, проваливается в
`.github/workflows/`» — is why your probe branch must be cut from `main` and not from anywhere
older. Of 501 remote refs, only 4 carry the placeholder; 500 still carry an executable legacy
`CD.yml`.

**Story 1.6 (`ready-for-dev`, deliberately not started).** Not a dependency — but it has
reserved `D10` in its task list, which is the anchor collision Task 9.1 resolves. It also set the
house pattern this story reuses: a 🛑 HARD STOP for the parts only a human can do, and an
explicit prohibition on inventing what a human has not supplied.

**Story 1.2 (done).** Established every `docs/migration-decisions.md` convention Task 9 must
follow. **Story 1.1 (cancelled).** Its lesson, in the form that matters here: *a repository-side
change is not a deployed change.* A config file written on your laptop is not a provisioned
runner.

### Git intelligence

```
4032f867  chore(bmad): create story 1.6, deferred pending PRE-PROD backend readiness
42fb1472  chore(bmad): close stories 1.3 and 1.13, sync sprint status          ← origin/main
1553291f  docs(migration): address code review findings for story 1.13
401fe43b  chore(bmad): record story 1.13 findings and sprint status
cdef5fdd  docs(migration): record D9 - legacy fallback neutralized on all three branches
f155b409  docs(migration): add inert .forgejo/workflows placeholder
eaf7a9a1  chore(bmad): note token revocation deferred until all epics are done
6b8e9bcb  docs(migration): address code review findings for story 1.3
```

Conventions the history shows, and that you must follow: Conventional Commits with a scope; **no
`KAN-###`** prefix (Jira ids are for feature work only); a clean split between
`docs(migration): …` for `docs/` and `.forgejo/` and `chore(bmad): …` for `_bmad-output/`; and a
separate `address code review findings for story N` commit rather than amending history. Every
recent story lands its documentation and its BMAD artifacts in different commits.

### Latest technical information

- **forgejo-runner v13.0.0** is the pin. Tags `13`, `13.0`, `13.0.0` exist on
  `code.forgejo.org/forgejo/runner`; `latest` does not. All three foreign runners run v13.0.0,
  so behaviour is comparable. `register` is *deprecated* in v13 (the declarative replacement is a
  connection block in the config) but functional; `generate-config`, `daemon`, `one-job`,
  `exec`, `validate`, `cache-server` are the other subcommands.
- **Config sections**: `log` (`level`, `job_level`), `runner` (`file`, `capacity`, `labels`,
  `timeout`, `shutdown_timeout`, `insecure`, `fetch_timeout` — now `30s`, was `5s`,
  `fetch_interval`, `report_interval`, `envs`, `env_file`), `cache` (`enabled`, `port`, `dir`,
  `external_server`, `secret`, `secret_url`, `host`, `proxy_port`,
  `actions_cache_url_override`), `container` (`network`, `enable_ipv6`, `privileged`, `options`,
  `workdir_parent`, `valid_volumes`, `docker_host`, `force_pull`, `force_rebuild`), `host`,
  `server`.
- **`container.docker_host`** values: `"-"` (default, no docker in jobs), `"automount"` (probes
  `$DOCKER_HOST` then `/var/run/docker.sock`, `/run/podman/podman.sock`, …), or an explicit
  `unix://` / `tcp://` / npipe URL. `automount` **does not work in the OCI image install**
  because `DOCKER_HOST` there is `tcp://`, which cannot be bind-mounted. When `docker_host` is
  not `"-"`, the socket is bind-mounted into the job container automatically and is added to the
  valid-volume set for you.
- **`actions/setup-node@v4`** = v4.4.0, bundling `@actions/cache` 4.0.3. Hit:
  `Cache restored from key: node-cache-Linux-x64-npm-<hash>` plus `Cache Size:` /
  `Cache restored successfully`. Miss: `npm cache is not found`. Output `cache-hit` is
  `Boolean(cacheKey)`; there is no `cache-matched-key` output in v4.
- ⚠️ **Node 20 reached EOL on 2026-04-30.** `node:20-bookworm` still pulls and resolves to
  **v20.20.2** (npm 10.8.2, final release, image frozen 2026-04-22), but the tag is **delisted**
  — it no longer appears in `docker-library/official-images` or `nodejs/docker-node`
  `versions.json`, and it receives no further Debian base-image security patches. Current lines:
  Node 24 "Krypton" Active LTS, Node 22 "Jod" maintenance.
  🚨 **Do not change the label unilaterally.** `node-20:docker://node:20-bookworm` is fixed by
  **FR28** (`epics.md:161-163`), by `docs/forgejo-migration.md:142`, and by AC4 which demands
  `node --version` report Node **20**; `.github/workflows/CI.yml:20` pins `node-version: '20'`
  and `Dockerfile.prod` builds on `node:20-alpine`. Register Node 20 as specified, and **record
  the EOL as deferred work** (Task 9.5) so it becomes a scoped decision rather than a drive-by
  change in an infrastructure story.

### Testing standards

There is no automated test suite for this story — it is infrastructure, and "the test" is the
probe workflow. The project's evidence standard, set by D8's evidence table and enforced by
review on 1.3 and 1.13, is what applies:

- **Observation over assertion.** Every AC is closed by a captured API response or a quoted log
  line, not by a claim. Record run **index and id**, job ids and names, `created` / `started` /
  `stopped` with timezone, and durations.
- **Definite yes/no.** Where a capability is probed, state it as a definite yes or no; where you
  could not check something, write «не проверено» and say why. Do not let an unchecked thing
  read as checked.
- **Encode assertions into exit status** (Task 6.3), because job logs are unreadable via the
  API and a green step proves less than it appears to.
- **Retro-annotate rather than silently tick.** If a subtask was attempted but not performed as
  specified, mark it `⚠️ [x] = attempted, not performed as specified` and explain — the
  convention 1.13's review established.
- The repo's own suite (`npm run lint`, `format:check`, `typecheck`, `test:run` — 1921 tests,
  `npm run build`) runs via husky hooks on any `main` commit. It is unaffected by this story;
  do not skip it with `--no-verify`.

### Project Structure Notes

- `.forgejo/workflows/` is the Forgejo workflow directory and currently holds exactly one
  tracked file, `README.md`, whose entire purpose is to exist. Story 2.1 fills it
  (`ci.yml`, `build.yml`, `deploy-dev.yml`, `deploy-preprod.yml`, `deploy-prod.yml`,
  `dev-reset.yml` — `docs/forgejo-migration.md:267-278`); this story only ever puts a file there
  on a throwaway branch, under a name outside that set.
- `.gitea/workflows/` does not exist and must not be created — `.forgejo/` already wins
  resolution, and Story 1.13 explicitly declined to add it.
- **Language split, deliberate:** `docs/` is written in **Russian** (identifiers, labels,
  filenames stay English); code-space files — workflow YAML, `README.md`, story files under
  `_bmad-output/` — are **English**. `document_output_language: English` governs
  `_bmad-output/` only.
- Runner artefacts (`runner-config.yml`, `.runner`, systemd unit) live on the runner host and
  are **not** part of this repository. If the host's configuration needs to be reproducible,
  that is a follow-up decision, not a file you commit here — `.runner` contains a secret.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md:593-634`] — Story 1.7, the five ACs and the
  Story 1.3 context blockquote.
- [Source: `_bmad-output/planning-artifacts/epics.md:161-163`] — FR28, the two labels verbatim.
- [Source: `_bmad-output/planning-artifacts/epics.md:165`] — FR29, the second runner (Story 1.9).
- [Source: `_bmad-output/planning-artifacts/epics.md:242-243`] — cache server required for
  `setup-node`; the runner must not be hosted on s2.
- [Source: `_bmad-output/planning-artifacts/epics.md:237-239`] — third-party actions by full URL,
  requiring github.com egress; `code.forgejo.org` mirrors as the alternative.
- [Source: `_bmad-output/planning-artifacts/epics.md:413-418`] — Epic 1 goal.
- [Source: `_bmad-output/planning-artifacts/epics.md:501-507`] — Story 1.3's prerequisite note;
  capacity 1 is the `forgejo-runner` default and what 1.7 was assumed to provision.
- [Source: `_bmad-output/planning-artifacts/epics.md:670-690`] — Story 1.9: second runner at
  repository scope, failover, four-job distribution.
- [Source: `_bmad-output/planning-artifacts/epics.md:636-668`] — Story 1.8: what this story must
  *not* absorb (action-resolution and SSH smoke tests).
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-07-runners.md` §4.2]
  — the org → repository scope change for Stories 1.7 and 1.9, approved 2026-08-07.
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-07-runners.md` §4.5]
  — the `ubuntu-latest` prohibition inherited by Epics 2–7.
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-07-runners.md:389-394`]
  — the unresolved s1-contention item Task 2.2 raises.
- [Source: `docs/migration-decisions.md#d7`] — no action of any kind is taken on GitHub.
- [Source: `docs/migration-decisions.md#d8`] — Forgejo 15.0.5 capabilities; the runner-image pin
  requirement naming Stories 1.7 and 1.8; the original two-runner inventory.
- [Source: `docs/migration-decisions.md#d9`] — the per-commit `.forgejo/workflows/` invariant;
  the third org runner; no cancel endpoint; branch protection and `apply_to_admins: false`.
- [Source: `docs/migration-decisions.md:8`] — the anchor range that must be extended to `#d10`.
- [Source: `docs/migration-decisions.md:8-10`] — decision entries are append-only.
- [Source: `docs/forgejo-migration.md:128-149`] — Фаза 1: the runner, its two labels, the cache
  server, the smoke test, the second runner, and the phase DoD.
- [Source: `docs/forgejo-migration.md:255-265`] — the placeholder exists; the reverse condition:
  do not put a real workflow there until Stories 1.7/1.9.
- [Source: `docs/forgejo-migration.md:313`] — `ubuntu-latest` as a runner label is a
  deliberate non-goal.
- [Source: `_bmad-output/implementation-artifacts/1-3-verify-forgejo-actions-availability-and-concurrency-support.md`]
  — the registration recipe, the label `docker://` rule, the image-version findings, the
  session-cookie log constraint, the default-branch dispatch-enumeration gotcha.
- [Source: `_bmad-output/implementation-artifacts/1-13-stop-forgejo-from-executing-the-legacy-github-workflows.md`]
  — the placeholder contents and refs, the no-cancel incident, the `has_pull_requests` arc, the
  write-budget and citation discipline, the probe-branch convention.
- [Source: `_bmad-output/implementation-artifacts/1-6-secure-the-pre-prod-infrastructure-commitment.md`]
  — the 🛑 HARD STOP pattern; the `D10` reservation Task 9.1 resolves.
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md:46-50`] — Stories 1.7, 1.8 and
  4.4 must not design around an Actions-run cancel capability.
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md:10-13`] — `fe_tmp` (id 83),
  scopes `all`, deliberately still live.
- [Source: `.github/workflows/CI.yml:12-21`] — the shape Story 2.1 will port; the Node 20 and
  `cache: 'npm'` pins the probe workflow mirrors.
- [Source: `.forgejo/workflows/README.md`] — the placeholder and its stated invariant.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5), bmad-dev-story

### Debug Log References

- `docker logs forgejo-runner-fe-prionex` / `docker compose -f
  /opt/forgejo-runner-fe-prionex/docker-compose.yml logs runner` on s1 (`root@10.67.0.1`) — no
  systemd unit, pure compose supervision.
- Registration transcript (Task 3.5): `"Registering runner, name=s1-fe-prionex-1,
  instance=https://git.crm-prionex.com, labels=[node-20 docker-build]."` →
  `"Runner registered successfully."`
- Durability transcript (Task 5.2): `RestartCount` 0→1 after host-side `SIGKILL` to the real PID;
  daemon log shows a full re-declare (`declared successfully`, `[poller] launched`) within the
  same second.

### Completion Notes List

- **Host-socket plan abandoned mid-story for a documented security reason, not a preference.**
  The story's own "Recommended" path (host binary + systemd + `container.docker_host: automount`)
  was ruled out on discovering s1's unwritten-in-this-story AD-6 rule (no host `docker.sock` ever,
  confirmed against all four existing runner projects on the host). Switched to the DinD sidecar
  pattern already used by every other runner on this hub. Approved by Oleg explicitly ("Следуйте
  тому же паттерну") after the deviation was surfaced.
- **Two additional hard stops surfaced and resolved with Oleg mid-story, beyond Task 2's planned
  one:** (a) a sibling BMAD project (`CRM/api-prionex`) turned out to be running its own, more
  advanced Forgejo migration on the same host — surfaced, Oleg chose to continue 1.7 and defer
  discussing Story 1.6 implications separately; (b) registration hit `403 Forbidden` — the
  assigned subnet (`192.168.226.0/24`) was not yet in the host's nginx ACL, and none of the five
  already-allowed subnets were free (all are live, single-tenant, one holding deploy/SSH
  credentials) — Oleg confirmed coordination with the host's administrator (aleksey) before the
  ACL was edited.
- **A real, previously-undocumented Trap 2 variant was found and fixed**, not just the one the
  story's Dev Notes anticipated: in a fully-nested DinD setup, neither "leave `cache.host` empty"
  nor "host-binary form: use the host's LAN IP" works — hairpin NAT back to the host's own
  external IP fails from inside the nested engine. Fixed by pointing `cache.host` at the
  `runner` container's own pinned IP on the shared bridge, verified with a container spawned
  *inside* the nested `dind` engine (i.e., matching exactly what a real job container is), not by
  inference. Full detail recorded in `docs/migration-decisions.md#d10`.
- **Everything requiring `FJ_TOKEN` (Task 1.1) is still open** at the point this story was left:
  Tasks 1.1–1.5, 3.6, 4.7's API-side confirmation, 5.2's API-side re-read, and all of Tasks 6, 7,
  8, 10. The infrastructure itself (registration, DinD wiring, cache fix, durability) was proven
  by direct host/container observation instead, and is marked as such rather than assumed
  equivalent to an API-verified state.
- Story status moved `ready-for-dev` → `in-progress` (`sprint-status.yaml` and this file's own
  `Status:` line) at the start of this work session.

### File List

- `_bmad-output/implementation-artifacts/1-7-provision-the-primary-forgejo-runner-with-both-labels.md` (this file — Status, Tasks/Subtasks, Dev Agent Record)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (1-7 → `in-progress`, `last_updated`)
- `_bmad-output/implementation-artifacts/1-6-secure-the-pre-prod-infrastructure-commitment.md` (mechanical `D10`→`D11` renumber, 19 lines)
- `_bmad-output/implementation-artifacts/deferred-work.md` (new section: findings deferred from this story)
- `docs/migration-decisions.md` (new `#d10` entry, index-table row, header anchor range, changelog row)
- `docs/forgejo-migration.md` (Фаза 1, items 1–3 and DoD marked)
- `.forgejo/workflows/probe-runner.yml` (new, on branch `probe/forgejo-runner` only, commit
  `ea7b7f47` — not on `main`; `README.md` untouched)
- Remote (`s1`, not in this repo): `/etc/nginx/sites-available/forgejo-platform` (ACL line added,
  backed up first), `/opt/forgejo-runner-fe-prionex/{config.yml,docker-compose.yml,.env}` (new
  compose project, not version-controlled — host-local infra config)

## Open Questions for Review

1. ✅ **Resolved — s1.** Oleg confirmed s1 (`10.67.0.1`, internal address, SSH key-based) via
   AskUserQuestion. Not a separate VM.
2. ✅ **Confirmed, not just raised — s1 does host all of it.** Direct host inspection (not the
   API) shows `ci-hub`, `s1-build-crm`, `s1-deploy-dev-preprod` and now `s1-fe-prionex-1` all
   running as containers on the same box, alongside `techno-finance` and the observability stack.
   Story 4.2 still owns the formal resource-budget decision before the DEV/PRE-PROD stands land
   there too — logged in `deferred-work.md` for that story to pick up.
3. ✅ **Resolved — `D10`, default taken.** 1.7 claims `D10`; Story 1.6's file mechanically
   renumbered to `D11` (19 lines). Not surfaced as a question needing Oleg's input beyond this
   record, per the story's own "one word to switch" framing — the default was reasonable and
   nothing pointed the other way.
4. **`capacity: 1` or `2`?** `epics.md:501-507` assumes 1.7 provisions a single-slot runner.
   With Story 1.9's second runner, capacity 2 each gives four concurrent CI jobs and directly
   serves NFR1 (≤ 15 min) and Story 1.9 AC3; capacity 1 each serialises Story 2.1's four jobs
   into two waves. Recommended: 2, recorded in `#d10`.
5. **Node 20 is EOL (2026-04-30) and `node:20-bookworm` is delisted, frozen at v20.20.2.** FR28,
   AC4, `CI.yml:20` and `Dockerfile.prod` all pin Node 20, so this story registers Node 20 as
   specified and records the finding. But it is a real supply-chain question with no owner:
   bumping to 22 or 24 touches the runner label, CI, and the production image, and is a
   change-proposal, not a story task. Who owns it, and when?
6. **AC2 says "the **two** pre-existing organization runners"; there are three.** The story
   reconciles this via AC6, but the epic text itself stays stale unless someone amends it. Worth
   a one-line `epics.md` correction?
7. **Is `fe_tmp`'s value reachable by the dev agent at all?** By standing rule it is written into
   no file, so it must come from Oleg out-of-band at the start of every story that needs it. If
   that is a recurring friction, the alternative is a scoped, short-lived token per story —
   which is what Story 1.3 was supposed to do before its scope came back as `all`.
8. **Should the runner host's configuration be reproducible?** `runner-config.yml` and the
   systemd unit are the only record of how the runner is set up, and they live on one host.
   `.runner` holds a secret and can never be committed, but a sanitised config could be — as a
   separate decision, not silently in this story.
