---
baseline_commit: 162f1722d614034037807dcd7af95752b67edf2b
---

# Story 4.3: Deploy a Feature Branch to DEV on Demand

Status: ready-for-dev

<!-- Contexted 2026-08-20 against `main` at 162f1722 (Story 4.2 closed the same day, PR #58).
     This story inherits TWO named blockers from Story 4.2's code review, both recorded with
     "Owner: Story 4.3": the stand directory is unreachable from a deploy job (D28 §4, five
     options, none chosen), and registry auth resolves client-side so AC4's host `docker login`
     cannot serve a deploy job (H4). Both are decided here — see Dev Notes §2 and §3. The
     mechanism choice is marked **autonomous, subject to Oleg's veto**, because it also changes
     Story 4.9's cutover shape. A third inherited deadline: the stand's pinned tag
     `sha-62e2ff8dc215-dev` is deleted from the registry ~2026-09-02, and this story's first
     successful deploy is the recorded primary path for closing that (fallback trigger
     2026-08-30, owner Oleg). -->

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want to deploy my own branch to DEV without asking anyone for approval,
so that I can validate my work on a real stand as often as I need to.

## Acceptance Criteria

**AC1 — the workflow exists and nothing gates it**

**Given** the DEV stand from Story 4.2 and images from Epic 3
**When** `.forgejo/workflows/deploy-dev.yml` is created
**Then** its trigger is `workflow_dispatch` with a `ref` input
**And** no approval or review step gates it.

**AC2 — it runs on the deploy runner, and never over SSH**

**Given** the deploy runs
**When** the workflow declares `runs-on`
**Then** it targets the deploy runner located on s1 by its label
**And** the compose file reaches the stand directory without leaving the host
**And** no SSH client, `appleboy/scp-action` or `appleboy/ssh-action` appears in the workflow.

> Amended 2026-08-11 (`sprint-change-proposal-2026-08-11-deploy-runner.md`). Was: *"When it
> connects to s1 / Then it uses native `ssh` and `scp` in `run:` steps."* "Connects to s1" no
> longer describes anything — the job already runs on s1.

> 🔴 **AMENDED 2026-08-20 (this story, from D28 §4 + its H5 amendment).** The clause *"the compose
> file reaches the stand directory"* is **not satisfiable as written** and is discharged
> differently. `s1-deploy-dev-preprod` mounts exactly three paths plus `docker.sock` into every job
> container; `/root/crm-prionex/fe-prionex-dev` is in neither `container.options` nor
> `valid_volumes`, and `/root` is `drwx------`. Discharge as: **the compose file and its five
> variables are rendered inside the job's own workspace, and the job acts on the host daemon through
> the `docker.sock` it already holds** — the resulting containers, project name, network attachment
> and port binding are byte-for-byte the stand AC1 of Story 4.2 provisioned. The host directory
> remains the stand's record and its manual/DR path; the deploy job does not read it. Full rationale
> and the four rejected alternatives: Dev Notes §2. **This is the decision D28 §4 assigns to this
> story, and it is autonomous, subject to Oleg's veto.**

**AC3 — the deploy sequence, and every step fails closed**

**Given** the deploy sequence
**When** it executes
**Then** it copies the compose file to the stand directory, runs `docker compose down`, pulls
the image, runs `docker compose up -d`, and then health-checks
**And** each step's failure aborts the deploy rather than continuing.

> 🔴 **AMENDED 2026-08-20 (this story) — the stated ORDER contradicts Story 4.7's AC4 and is
> corrected here, not silently reordered later.** Epic 4.7 requires: *"Given a branch with no built
> image / When a deploy is attempted for it / Then it fails fast with a message naming the missing
> tag / **And the stand keeps serving its previous version.**"* A `down` that precedes the pull
> leaves the stand **stopped** when the pull fails — the stand does not keep serving anything. The
> sequence implemented here is therefore **resolve → pull → `down` → `up -d` → health-check**. The
> AC's intent (each step aborts the deploy) is preserved and strengthened: nothing is torn down
> until the replacement image is provably present on the host daemon.

**AC4 — a missing image fails immediately, with no `:latest` fallback**

**Given** the requested image is missing from the registry
**When** `docker pull` runs
**Then** the deploy fails immediately
**And** it does not fall back to `:latest`, preserving the behaviour at `CD.yml:196`.

> 🔴 **EXTENDED 2026-08-20 (this story).** `:latest` is not merely un-fallen-back-to — it **does not
> exist**: `build.yml:1026` sets `PUSH_LATEST=false` ("DECIDED, not pending"), D20 §4 cancelled it.
> The real requirement is that the failure **names the true cause**: a missing tag and a missing
> credential both stop the deploy, and they are different failures with different owners. See AC7.

**AC5 — the health check is parameterized and cannot report another container's health**

**Given** the health check ported from `CD.yml:213-239` hardcodes the container name
`fe-prionex` and the port `8080`
**When** it is implemented for this stand
**Then** it polls `docker inspect -f '{{.State.Health.Status}}'` against the stand's
`CONTAINER_NAME` variable
**And** its fallback `curl` targets the stand's `FRONTEND_PORT` variable
**And** a deploy to a stopped stand reports failure rather than reporting healthy from a
different container.

> 🔴 **Two traps, both measured elsewhere in this project, both binding here.**
> (1) `docker ps --filter name=` is a **substring** match — Story 4.2 Task 7 recorded that the
> unanchored form returns the four `forgejo-runner-fe-prionex*` containers plus the stand, i.e. it
> cannot fail. Anchor it (`--filter name=^fe-prionex-dev$`) **and** additionally assert the compose
> project label, or the last clause of this AC is unprovable.
> (2) `FRONTEND_PORT` is **not a bare port number** on this stand. Oleg's M7 decision sets it to
> `127.0.0.1:8082` (compose short syntax `IP:PORT`). A fallback built as
> `curl http://localhost:${FRONTEND_PORT}/` produces `http://localhost:127.0.0.1:8082/` and fails
> for the wrong reason. Parse the host-port component; do not assume the bare form.

**AC6 — the running container is the image that was requested**

**Given** a successful deploy
**When** the stand is checked
**Then** the running container's image digest matches the requested tag.

> Branch tags are **mutable** — `build.yml` republishes `<sanitized-ref>-dev` on every build of that
> branch. "Matches the requested tag" is therefore only meaningful against the digest the registry
> served **at the moment this deploy resolved it**. Resolve the digest first, then compare the
> running container's `.Image` to that same digest. Precedent: D28 §1 did exactly this by hand
> (`sha256:6d0302ded7a1…` matched the registry's `Docker-Content-Digest`).

**AC7 — 🔴 ADDED 2026-08-20: the deploy job's own registry credential**

**Given** `docker pull` and `docker compose pull` resolve authentication from the **client's**
`config.json` and send it as `X-Registry-Auth`, and the daemon holds no credential of its own
**When** the deploy job pulls the image
**Then** the job authenticates with a **`read:package`-only** credential that it holds itself
**And** the failure mode `unauthorized` is distinguished, in the message, from `manifest unknown`
**And** the credential's absence or expiry is detected by the deploy itself rather than surfacing as
an unexplained failure with nothing pointing back at its cause.

> Source: `deferred-work.md:2597-2608` (finding H4) and `docs/migration-decisions.md#d28` §4's H4
> amendment — both say **Owner: Story 4.3**, and both say explicitly that solving the path question
> does **not** solve this one. Story 4.2's `docker login` on s1 authenticated an *interactive root
> shell*; that `config.json` is not mounted into any job container and is not created by any of
> D28's five options. The last clause also discharges the standing deferred item *"the registry
> credential has no detector, and this story is the proof that it needs one"*
> (`deferred-work.md:2706-2713`).

**AC8 — 🔴 ADDED 2026-08-20: the mechanism decision is recorded, not merely implemented**

**Given** D28 §4 records five options for how a deploy job reaches the stand and assigns the choice
to this story
**When** the mechanism is chosen
**Then** a decision record states which option was taken, what the other four cost, and what the
choice changes for Stories 4.4, 4.8 and 4.9
**And** the deferred clause of Story 4.2's AC2 (*"the `.env` is readable only by the deploy user"*,
`deferred-work.md:2610-2613`, Owner: Story 4.3) is discharged against the reader the chosen
mechanism actually produces — or recorded as moot, with the reason.

## Tasks / Subtasks

- [ ] **Task 1 — Declare the run budget before the first push (retro-D4, team agreement)**
  - [ ] 1.0 Flip `sprint-status.yaml` `4-3-deploy-a-feature-branch-to-dev-on-demand` → `in-progress`
        before starting implementation, so the tracker never disagrees with reality mid-story.
  - [ ] 1.1 Query the pre-work baseline: highest `action_run` id before this story's first
        *implementation* push, via
        `GET https://git.crm-prionex.com/api/v1/repos/CRM/fe-prionex/actions/runs?limit=100`.
        🔴 **The token this project has used for that query is `fe_review_1_7` at `/root/.fj_token`
        on s1, and Oleg's revocation of it is PENDING** (`deferred-work.md:31-54`). If the query
        returns `401`, that is the revocation, not a bug — say so and use `fe_tmp_1_7` /
        `fe_pkg_3_6` per the standing token model, or ask. **Never print a token value**; Story 4.2's
        Completion Note 9 is the record of what happens when a `401` body echoes the presented
        string back.
  - [ ] 1.2 Declare the budget in the Dev Agent Record **before pushing anything**, using the
        arithmetic in Dev Notes §9. Do not restate "5 pushes" style flat counts — Story 4.1 declared
        5 and spent 7; Story 4.2 modelled the multiplier in advance and landed exactly on 7.
  - [ ] 1.3 🔴 The multiplier is structural: **every push that lands while the PR is already open
        costs 2 `action_run` rows**, not 1 (`ci.yml:65-71`, measured). Cancelled runs still occupy a
        row and still count.
  - [ ] 1.4 🔴 **This story is the first that also spends `workflow_dispatch` runs.** Each dispatch
        of `deploy-dev.yml` is its own `action_run` row. The retro-E5 outcome matrix (Task 8) is
        *at least four* dispatches — one pass and three discriminating failures — plus re-runs after
        every fix. Price them in the declaration explicitly; they are the largest line.
  - [ ] 1.5 The merge to `main` fires **`build-main.yml`**, a different workflow from `ci.yml` (which
        ignores `main`): **+1**. The closeout PR is a second branch/PR/merge cycle: **+3**.
  - [ ] 1.6 The ledger closes **only against a query, re-run after the merge commit lands**. A ledger
        closed at PR-open is not closed. If the query cannot be run, close it with the literal word
        **OPEN** — never a self-reported number. Final closure is the coordinator's.

- [ ] **Task 1b — The workflow's own shape (AC1, AC2)**
  - [ ] 1b.1 🔴 `on:` carries **`workflow_dispatch` and nothing else.** No `push`, no
        `pull_request`, no `schedule`. A stray `push` trigger turns every commit on every feature
        branch into a live DEV deploy — the deploy is *on demand* by design, and Story 4.6 is the
        story that adds a schedule, deliberately and separately.
  - [ ] 1b.2 A single required input, `ref` (`type: string`). No `environment` choice — this
        workflow deploys DEV and only DEV; Epics 5 and 6 get their own, off Story 4.8's shared
        definition.
  - [ ] 1b.3 **No approval, no `environment:` gate, no manual review step** (AC1). D25 also applies:
        nothing here starts gating `staging` or `development`.
  - [ ] 1b.4 🔴 Set **`timeout-minutes`** on the job. `build.yml` sets 30; a deploy should be far
        tighter — Story 4.7 requires each deploy under **10 minutes**. Without it a hung pull or a
        health check that never converges holds a *shared* runner indefinitely.
        `deferred-work.md:1444-1454` records the absence of `timeout-minutes` as an open item on
        `ci.yml`; do not repeat it in the first deploy workflow.
  - [ ] 1b.5 Record the deploy's **wall-clock duration** in the completion notes. Story 4.7 needs
        five such numbers and a dominant-step attribution for any that exceed the budget; producing
        the first one here costs nothing.
  - [ ] 1b.6 Verify AC2's negative clause literally before handing off: no `ssh`, no `scp`, no
        `appleboy/ssh-action`, no `appleboy/scp-action` anywhere in the file. The job is already on
        s1; there is nothing to connect to. (`ufw` would refuse anyway — port 22 admits two admin
        addresses only.)

- [ ] **Task 2 — Probe the deploy runner before writing a line of the workflow (probe-first)**
  > Everything in this task is *unrecorded anywhere in this project*. Do not infer it. A wrong
  > assumption here does not fail loudly — see 2.2.
  - [ ] 2.1 Write a throwaway probe workflow (`workflow_dispatch` only, no inputs) with
        `runs-on: deploy-dev-preprod` and **only `run:` steps**. Confirm it is picked up at all.
  - [ ] 2.2 🔴 **Does the job image run `uses:` steps?** `deploy-base-dev-preprod:2026-08-07` is
        another team's image and its contents are recorded nowhere. `build.yml:107-124` records the
        failure shape for the `docker-build` label: an image with no Node runtime **does not fail
        informatively — it simply does not run any `uses:` step**. Probe with a trivial
        `uses: actions/checkout@v4` and check whether the step actually executed (assert on a file
        that only checkout could have created). If `uses:` does not work, `actions/checkout` and
        `docker/login-action` are both unavailable and every step must be plain `run:`.
  - [ ] 2.3 Record the job container's **identity**: `id -u`, `id -g`, `whoami`. D28 §4's H5
        amendment names this as inferred-not-measured — `1501:988` was the runner *supervisor*, not
        the job. This is the number Story 4.2's deferred AC2 clause (AC8 here) needs.
  - [ ] 2.4 Record what the job actually has: `docker version` (client and the daemon it reaches
        through the mounted socket), `docker compose version`, `git --version`, presence of `curl`,
        `jq`, `wget`. The workflow may use nothing that is not on this list.
  - [ ] 2.5 Confirm the mounted socket reaches the **host** daemon and not a nested one: the host's
        containers (`fe-prionex-dev`, the runner containers, the `crm-dev` stack) must be visible
        from `docker ps`, and `crm-dev-network` must be present in `docker network ls`.
  - [ ] 2.6 🔴 **Can `workflow_dispatch` be triggered from a non-default branch on this instance?**
        Try it from the story branch. If it cannot, the outcome matrix can only run **after** the
        workflow lands on `main` — record that ordering consequence and its ledger cost in Task 1's
        declaration rather than discovering it at the end. Note that the shipped workflow does not
        *need* branch dispatch: its `ref` input means dispatching from `main` with `ref=<feature>` is
        the intended usage.
  - [ ] 2.7 Delete the probe workflow before the implementation PR, or keep it and say why. Do not
        leave an undocumented workflow on `main`.

- [ ] **Task 3 — Provision the deploy job's registry credential (AC7)**
  - [ ] 3.1 Create repository secrets **`REGISTRY_USER_RO`** and **`REGISTRY_TOKEN_RO`**, carrying a
        **`read:package`-only** credential. Do **not** reuse `REGISTRY_TOKEN_RW` (`build.yml:238`):
        that is an org-scope `write:package` credential over 87 packages including another team's
        production, and this job runs on a **shared, four-label, multi-tenant runner**.
  - [ ] 3.2 Source of the value — two routes, both requiring someone with s1 access:
        (a) reuse `fe_reg_4_2_ro` (account `robot-registry`, scope `read:package`), whose plaintext
        is at `/root/.fj_reg_4_2.token` on s1, mode `600` (D28 §3); or (b) mint a fresh one with
        `gitea admin user generate-access-token` — the account password is not needed. **This is an
        Oleg dependency. Do not proceed silently around it** — if the secret does not exist, stop and
        say so; do not substitute the RW credential "for now".
  - [ ] 3.3 ⚠️ Whatever is minted is **standing by construction** — an admin cannot revoke another
        account's token without its password or a DB row (`deferred-work.md`, standing entry). Record
        owner and revocation trigger in `deferred-work.md` **at the moment of minting**, not at the
        end of the story. Precedent: D28 §3.
  - [ ] 3.4 While on s1, close the open item **M1**: `/root/.fj_reg_4_2.raw` — a second plaintext
        copy of the registry credential, mode/owner/contents unknown
        (`deferred-work.md:2697-2704`, *"Owner: whoever next has s1 access"*). Record its mode and
        purpose or delete it, and correct Story 4.2's Task 9.4 if something was in fact left behind.
  - [ ] 3.5 In the workflow, log in **inside the job** so the client config the pull reads is the
        **job's own**: `docker login git.crm-prionex.com -u "$REG_USER" --password-stdin` with both
        values arriving through `env:` — never `${{ }}` inside the `run:` body. If Task 2.2 proved
        `uses:` works, `docker/login-action@v3` is acceptable and matches `build.yml:233-238`;
        prefer it only if proven.
  - [ ] 3.6 Set `DOCKER_CONFIG` to a job-workspace path so the credential lands in the workspace and
        not in a shared `$HOME` on a multi-tenant runner. Remove it on both success and failure
        paths.

- [ ] **Task 4 — Render the stand in the job workspace (AC2, the mechanism)**
  - [ ] 4.1 Obtain `docker-compose.stand.yml` **from this repository at the deployed ref** — not a
        heredoc copy. It is the single source of truth consumed by Stories 4.3, 5.2 and 6.10, and a
        second copy in a workflow is the "two compose files describe one application" failure this
        project already recorded (`deferred-work.md:2370-2407`). Use `actions/checkout` if Task 2.2
        proved it works; otherwise `git clone --depth 1 --branch <ref>` in a `run:` step.
  - [ ] 4.2 Write the five required variables to an `--env-file` in the job workspace. All five, no
        defaults (D27): `COMPOSE_PROJECT_NAME=fe-prionex-dev`, `CONTAINER_NAME=fe-prionex-dev`,
        `FRONTEND_PORT=127.0.0.1:8082`, `FRONTEND_NETWORK=crm-dev-network`, `DOCKER_IMAGE=` the
        resolved ref from Task 5.
        🔴 **Set `DOCKER_IMAGE` to the digest form** — `git.crm-prionex.com/crm/fe-prionex@sha256:…`,
        the digest captured in Task 5.3 — not to the mutable tag. A concurrent build of the same
        branch can republish `<sanitized-ref>-dev` between this deploy's pull and its `up -d`, and a
        tag-form `DOCKER_IMAGE` would then start an image this run never resolved and never checked,
        while AC6's comparison still passes against whatever is running. The digest form makes that
        race impossible instead of unlikely. Record the tag alongside it, in a comment or in the
        notes, so a human reading `docker ps` can still tell what was deployed.
  - [ ] 4.3 🔴 `CONTAINER_NAME` must **not** be `fe-prionex` — `CD.yml:201` force-removes that
        literal name on every legacy deploy (`docker-compose.stand.yml:19-21`).
  - [ ] 4.4 🔴 `FRONTEND_PORT=127.0.0.1:8082` **is Oleg's M7 decision**
        (`deferred-work.md:2662-2686`), verified locally in the 4.2 fix-pass to render
        `"127.0.0.1:8082:80"` with no template change. Rendering it here makes the decision
        **self-applying and idempotent on the first deploy**, so this story does not depend on the
        manual `sed` having been run. If Oleg has already applied it, the values agree; if not, the
        first deploy applies it. Say this out loud in the completion notes — it is a state change to
        a live stand made as a side effect, and it should be visible rather than discovered.
  - [ ] 4.5 🔴 **Never create the network.** `crm-dev-network` is `external: true` and belongs to the
        `CRM/api-prionex` stack. `external: true` refusing to start is *the only loud failure
        available on this axis* (`.env.stand.example:90-116`), and auto-creating it converts that
        refusal into an empty backend-less network that comes up happily — `CD.yml:185` is exactly
        this anti-pattern. No `docker network create` appears anywhere in this workflow.
  - [ ] 4.6 🔴 **Do not gate on `docker compose config`.** `config` is blind to network existence:
        `config` exits 0 while `up -d` exits 1 with *"network … declared as external, but could not be
        found"* (D27; `deferred-work.md:2409-2422`, *Owner: Stories 4.3 and 4.8*). A pre-deploy gate
        built on `config` alone passes a stand that cannot start. `up -d` is the gate.
  - [ ] 4.7 Record the one accepted divergence: compose stores
        `com.docker.compose.project.working_dir`, which will now point at a job workspace that no
        longer exists after the run. Verify that a **manual** `docker compose … up -d` from
        `~/crm-prionex/fe-prionex-dev/` still adopts the same containers (project name is the
        identity, not the directory) — this is the DR path four later stories assume, and it must not
        have been broken by the mechanism choice.
  - [ ] 4.8 Keep the host `.env` on s1 as the manual/DR copy and state plainly, in the decision
        record, that there are now **two sources for the same five values** and that the workflow is
        authoritative for deploys. Name the drift risk; hand the reconciliation to Story 4.8 (shared
        mechanics) or 4.9 (cutover), whichever the record argues for. Do not pretend it is closed.

- [ ] **Task 5 — Resolve the tag and pull, fail-closed (AC3, AC4, AC6, AC7)**
  - [ ] 5.1 Derive the image tag from the `ref` input using a sanitizer **byte-identical** to
        `build.yml`'s: `sed -E 's/[^a-zA-Z0-9._-]+/-/g' | cut -c1-100`, refusing a leading `[.-]` and
        refusing an empty result. If the two sanitizers ever diverge, this workflow deploys a tag the
        builder never published, and the failure is `manifest unknown` with a misleading name in it.
        Tag shape: `git.crm-prionex.com/crm/fe-prionex:<sanitized-ref>-dev`.
  - [ ] 5.2 🔴 The `ref` input arrives through `env:` and is referenced as a shell variable. **No
        `${{ }}` anywhere inside a `run:` body — not even in a comment**, because Forgejo substitutes
        inside comments too (`build.yml:770-780, 812-816`). Git permits `$(...)`, backticks and
        quotes in branch names (`git check-ref-format --branch 'feat/$(id)'` exits 0), and by this
        point in the job a registry credential is in the workspace.
  - [ ] 5.3 Resolve the digest **before** pulling: query the registry for the manifest and capture
        `Docker-Content-Digest`. Keep it for AC6.
  - [ ] 5.4 🔴 **The fail-closed guard, and the reason this story owns it.** Classify the failure and
        name the true cause:
        - HTTP `401` / `unauthorized` → *"the deploy job's registry credential is missing, wrong or
          revoked"* + the fix (Task 3's secrets). This is the **detector**
          `deferred-work.md:2706-2713` says does not exist; shipping it here closes that item.
        - HTTP `404` / `manifest unknown` → *"no image was built for this ref"* + the tag name + the
          fix (push the branch so `ci.yml`'s `image` job builds it).
        - 🔴 A `-dev` tag older than 14 days may have been **deleted by retention** — same `404`,
          different cause. Say both possibilities in the message rather than asserting one.
        Anything else → fail with the raw status. Never fall back to `:latest`; `:latest` does not
        exist (`build.yml:1026`).
  - [ ] 5.5 `docker pull` the resolved reference. Only after it succeeds does anything get torn down.

- [ ] **Task 6 — Replace the stand (AC3)**
  - [ ] 6.1 `docker compose -f <workspace>/docker-compose.stand.yml --env-file <workspace>/.env down`
        — targeting the project by name, so it cannot touch another project.
  - [ ] 6.2 `… up -d`. Confirm the exit code; do not infer success from the absence of output.
  - [ ] 6.3 Confirm the network was **not** created by this run: `crm-dev-network`'s id before and
        after the deploy is the same id (Task 4.5's rule, proven rather than asserted).
  - [ ] 6.4 🔴 Serialization is **out of scope — it is Story 4.4**. Do not add `concurrency:`, do not
        add `flock`. Two simultaneous deploys colliding is a known, accepted, *named* gap until 4.4
        (`epics.md:1696-1722`; the runner's `capacity > 1` question is recorded at
        `deferred-work.md:231-233`). Record it as a non-goal so the review does not read its absence
        as an omission.

- [ ] **Task 7 — Verify the stand after deploy (AC5, AC6, and two inherited deferred items)**
  - [ ] 7.1 Poll `docker inspect -f '{{.State.Health.Status}}'` against `CONTAINER_NAME`, with a
        bounded timeout and a non-zero exit on timeout. `{{ }}` here is a Go template consumed by
        `docker`, not a Forgejo expression — it is safe inside `run:`; `${{ }}` is not.
  - [ ] 7.2 🔴 Assert the container is **this project's**: match the name **anchored**
        (`^fe-prionex-dev$`) and check
        `.Config.Labels["com.docker.compose.project"] == fe-prionex-dev`. Unanchored `--filter name=`
        is a substring match and cannot fail on this host (Story 4.2, Task 7).
  - [ ] 7.3 Fallback `curl`: parse the host-port component out of `FRONTEND_PORT` (`127.0.0.1:8082`
        → host `127.0.0.1`, port `8082`) and target that. Do not concatenate the raw value.
  - [ ] 7.4 **AC6:** compare `docker inspect -f '{{.Image}}'` of the running container to the digest
        captured in Task 5.3. Not to the tag — to the digest.
  - [ ] 7.5 🔴 **Kong alias guard, and it is recurring, not one-shot.**
        `docker exec <container> getent hosts crm-kong-gateway` must return an address. **An empty
        result is a STOP, and is NOT a reason to fall back to `crm-network`**
        (`.env.stand.example:90-116`). This discharges the deferred item at
        `deferred-work.md:2728-2734`, whose stated reason for wanting a recurring guard is that the
        backend team can force-disconnect our container while the stand keeps serving `200` on `/`,
        a dead `/api/`, and `healthy` throughout. Strengthen it the way D28 §2 did: an address alone
        proves less than an address plus Kong answering — `GET /api/` returning Kong's own
        `no Route matched` with `X-Kong-Response-Latency` is the discriminating check.
  - [ ] 7.6 Record the stand's post-deploy state for the reboot-ordering item
        (`deferred-work.md:2720-2727`, *Owner: Story 4.3 (post-deploy check) / Story 4.9*): the
        container is running, attached to the expected network **id**, and `restart: always` is in
        force. State plainly what this does **not** prove — that a reboot with the network absent
        produces a silent restart loop, which stays open for 4.9.

- [ ] **Task 8 — Live outcome matrix (retro-E5; a guard that cannot fail proves nothing)**
  > *"Every new guard ships a live outcome matrix including a discriminating run"* —
  > `epic-3-retro-2026-08-18.md:78`. Each row below is a **real dispatch on the real runner**, not a
  > local simulation. Record run id, trigger, exit code and the message the guard printed.
  - [ ] 8.1 **PASS** — an existing branch with a built image. Stand comes up healthy, digest matches.
  - [ ] 8.2 **FAIL, discriminating (AC4):** a ref with no built image → `manifest unknown` path,
        message names the missing tag, **and the stand is still serving its previous version
        afterwards** (this is the row that proves the reordering in AC3 was real).
  - [ ] 8.3 **FAIL, discriminating (AC7):** the registry credential deliberately wrong or absent →
        `unauthorized` path, message names the credential, **not** the tag. This is the row that
        proves the detector distinguishes the two causes.
  - [ ] 8.4 **FAIL, discriminating (AC5):** deploy against a stopped/absent stand, or a container
        that never becomes healthy → the health check reports failure and does **not** report healthy
        from another container. The 4.2 precedent for a real discriminating negative is D28 §2's
        throwaway container on the built-in `bridge` network (empty output, `exit 2`).
  - [ ] 8.5 Optional but cheap, and it closes AC5's last clause hard: run the anchored container
        check while a `forgejo-runner-fe-prionex*` container is present (it always is) and show that
        the **unanchored** form would have passed. Same command, both outcomes.

- [ ] **Task 9 — Record the decisions (AC8)**
  - [ ] 9.1 New D-record in `docs/migration-decisions.md` (**Russian**, D-series; next free number —
        **verify against open branches first**, D26's own opener records that a number was taken by an
        unmerged branch). It states: the mechanism chosen among D28 §4's five options and why the
        other four were rejected; the registry-credential design (AC7); the AC3 reordering and the
        4.7 clause that forced it; the `working_dir` divergence and the two-sources-of-truth risk;
        what this changes for 4.4, 4.8 and 4.9.
  - [ ] 9.2 Amend **D28** by appended block (bodies are never rewritten in this project): §4's
        question is answered, §5's deferred AC2 clause is discharged or recorded moot against the job
        identity measured in Task 2.3, and D28's *"Триггер пересмотра: Story 4.3"* is satisfied.
  - [ ] 9.3 Update `deferred-work.md`: close H4 (detector shipped), close the recurring-Kong-guard
        item, close M1 if Task 3.4 reached s1, and record the new RO token with owner + revocation
        trigger. **Leave open, explicitly:** M7's manual application (now moot-by-idempotence if the
        deploy ran — say which), `fe_review_1_7` revocation (Oleg), `fe_reg_1_10_ro` disposition
        (Oleg), reboot-ordering (4.9), concurrency (4.4).
  - [ ] 9.4 🔴 **H1 — say whether this story closed it.** The stand's pinned tag
        `sha-62e2ff8dc215-dev` is deleted from the registry **on or about 2026-09-02**; the recorded
        primary path for closing that is *"Story 4.3 ships and its first deploy publishes a fresh
        tag"*, with a **fallback trigger of 2026-08-30** for a manual redeploy by whoever holds s1
        access (`deferred-work.md:2634-2660`). If Task 8.1's PASS run landed, the item is closed by
        this story — record the tag it now runs and close it. If this story slips past 2026-08-30,
        say so and hand the fallback to Oleg **before** the date, not after.
  - [ ] 9.5 Update the `README.md` in `.forgejo/workflows/` if it still claims the directory is
        "intentionally empty of workflows" — it is stale, and this story adds the first deploy
        workflow.

- [ ] **Task 10 — Land it**
  - [ ] 10.1 Branch `story-4-3/pr-<n>-<purpose>`; PR into `main`. `main` is protected — D16, eight
        required contexts, `apply_to_admins: true`.
  - [ ] 10.2 Do not touch: `docker-compose.server.yml`, `.github/workflows/CD.yml`, `nginx.conf`,
        `Dockerfile.prod`, `.env.dev.example`. **NFR5 / D7:** the legacy stand and the GitHub side are
        untouched; the GitHub copy is alive and Oleg ports commits manually.
  - [ ] 10.3 `docker-compose.stand.yml` and `.env.stand.example` are consumed by Stories 5.2 and 6.10
        as well. If either needs a change, that is a **finding to record**, not a quiet edit.
  - [ ] 10.4 Update `sprint-status.yaml` → `review` when handing off.
  - [ ] 10.5 Re-query the run ledger **after the merge lands** and close it (Task 1.6).

## Dev Notes

### 1. What this story actually is

Everything before it built the parts: Epic 3 publishes `git.crm-prionex.com/crm/fe-prionex:<tag>-dev`
on every feature-branch push (`ci.yml:498-505` → `build.yml`), Story 4.1 parameterized the compose
file, Story 4.2 stood the stand up on s1 and proved it reaches the new DEV Kong. This story is the
first one that **connects them**, and it is the first workflow in this repository that runs on a
runner that is not `node-20`.

It is also the story two prior code-review findings were explicitly deferred *to*. Neither is
optional and neither is discoverable from the epic text:

1. **The stand directory is unreachable from a deploy job** — D28 §4, five options, none chosen.
2. **Registry auth is client-side** — D28 §4's H4 amendment; solving (1) does not solve (2).

Both are decided below. Both decisions are **autonomous, subject to Oleg's veto**.

### 2. The mechanism — decision, and why the other four lose

**Measured (D28 §4):** `s1-deploy-dev-preprod` mounts into every job container exactly
`-v /var/run/docker.sock:/var/run/docker.sock`, `-v /opt/crm-preprod:/opt/crm-preprod`,
`-v /opt/crm-dev:/opt/crm-dev`, `--add-host=git.crm-prionex.com:10.70.0.1`; `valid_volumes` is an
allowlist filtering **all** bind mounts including the operator's own `options` (proven empirically in
Story 1.6: `[/var/run/docker.sock] is not a valid volume, will be ignored`) and contains the same
three paths. `/root` is `drwx------`, and `sudo -u forgejo-runner-deploy ls …` → `Permission denied`.

**Chosen: option 5 — render the compose file and its five variables in the job's own workspace, and
act on the host daemon through the `docker.sock` the job already holds.**

Why it wins:

- `docker-compose.stand.yml` declares **no `volumes:` and no host path at all** (verify: the file is
  65 lines and the only paths in it are the healthcheck's `http://127.0.0.1:80`). The host directory
  is therefore not a *technical* requirement of bringing the stand up — it is where a human keeps the
  stand's record.
- The compose file is already in this repository, at the ref being deployed. `--env-file` needs no
  host presence.
- The containers this produces are **the same stand**: same project name, same container name, same
  external network, same port binding. Compose identifies a project by name, not by directory.
- It requires **no change to a shared, multi-tenant runner's configuration**, and therefore no
  platform-owner dependency on the critical path.

What the other four cost:

| Option | Cost |
|---|---|
| 1 — allowlist `/root/crm-prionex/fe-prionex-dev` in `options` + `valid_volumes` | 🔴 Exposes the stand path **read-write into every job container of every repository** admitted to that four-label runner — the exact inverse of what Story 4.2's deferred AC2 clause exists to provide. Needs the platform owner. |
| 2 — move the stand into the already-mounted `/opt/crm-dev` | 🔴 That is the `api-prionex` stack's own directory. Our `.env` would sit in a tree another team's jobs mount read-write and can `down` / `clean` / `rsync --delete`. Couples two teams' trees. |
| 3 — a separate `/opt/crm-fe-dev` | Same read-write-to-every-tenant exposure as option 1, plus the same platform dependency, and it moves a path four later stories cite. |
| 4 — the job bind-mounts the stand path into a helper container via `docker.sock` | Works (root-equivalent by construction, D10's documented exception, so `drwx------` does not stop it) and needs no config change — but it is a privilege-escalation shape used as routine plumbing, and it still leaves the job's own uid question load-bearing. **Retained as the credential fallback only** (§3), not as the primary path. |

**What this choice costs, stated rather than hidden:**

- It does not by itself satisfy AC1/FR26's *"the stand has a directory on the host"* framing, which
  four later stories cite. The directory continues to exist and continues to be the stand's record
  and its manual/DR path — but the deploy no longer reads it. **Story 4.9's cutover shape changes**
  accordingly, and that belongs in the decision record.
- Two sources now describe the same five values: the host `.env` and the workflow. The workflow is
  authoritative for deploys; the host copy is the DR path. **Drift is a real risk and it is not
  closed here** (Task 4.8).
- Story 4.2's deferred AC2 clause (*"the `.env` is readable only by the deploy user"*) is largely
  **moot** under this mechanism: the file the deploy reads is created and destroyed inside the job's
  own workspace and is never on the host at all. Discharge it that way, against the job identity
  actually measured in Task 2.3 — do not report the original clause as passed.

### 3. Registry auth — the constraint that solving the path does not solve

`docker pull` and `docker compose pull` resolve auth from the **client's** `~/.docker/config.json`
and send it as `X-Registry-Auth`; the daemon holds no credential of its own. Story 4.2's AC4 logged
in an *interactive root shell* on s1. That `config.json` is not in `container.options`, not in
`valid_volumes`, and is not created by any of the five path options. **A pull from the job returns
`unauthorized` under all five** until this is solved separately.

**Chosen:** the job holds its own `read:package` credential, from repository secrets
`REGISTRY_USER_RO` / `REGISTRY_TOKEN_RO`, written into a workspace-scoped `DOCKER_CONFIG` by a
`docker login` inside the job. This mirrors `build.yml:233-238`'s established pattern, keeps the
credential auditable in Forgejo rather than host-local and invisible, and does **not** put an
org-scope `write:package` token on a multi-tenant runner.

**Fallback, recorded but not shipped:** a helper container mounting `/root/.docker` read-only through
`docker.sock` (option 4's shape) would reuse the credential Story 4.2 already provisioned and need no
new secret. It is rejected as the default for two reasons: it depends on a host login that
demonstrably vanished once already, on 13 Aug, with cause unknown; and it makes routine deploys
depend on a root-equivalent escalation path.

**Dependency, named so it is not depended on silently:** the secrets do not exist yet. Someone with
s1 access must supply or mint the value (Task 3.2). If they are absent, **stop** — do not substitute
the RW credential.

### 4. The three ways this deploy can succeed and still be wrong

1. **The wrong backend.** A stand on a backend-less or legacy network serves `200` on `/`, reports
   `healthy`, and has a dead `/api/`. `nginx.conf:38-40, 49-51` resolve `crm-kong-gateway` **lazily**
   through a variable upstream and a `resolver`, precisely so nginx does not crash-loop when Kong is
   down — which is also why nothing about this fails loudly. Task 7.5 is the only guard on this axis,
   and an empty `getent` result is a **STOP**, never a fallback.
2. **Another container's health.** `docker ps --filter name=` is a substring match. On s1 the
   unanchored form matches four `forgejo-runner-fe-prionex*` containers. A health check built on it
   cannot fail. Anchor it and check the compose project label (Task 7.2).
3. **A stale image behind a mutable tag.** `<sanitized-ref>-dev` is republished on every build of that
   branch. Only a digest comparison against the digest resolved by *this* run means anything
   (Tasks 5.3 / 7.4).

### 5. The image side is already built — do not rebuild it

`ci.yml:498-505` already builds and pushes on every feature-branch push:

```yaml
  image:
    name: Build and Push Image
    needs: [lint, typecheck, test, gate]
    if: ${{ startsWith(github.ref, 'refs/heads/') }}
    uses: ./.forgejo/workflows/build.yml
    with:
      environment: dev
    secrets: inherit
```

Tag shape from `build.yml`: `…:sha-<12hex>-dev` (primary) and `…:<sanitized-ref>-dev` (branch tag),
`PUSH_LATEST=false` (`:1026`). **`build.yml` exposes no job- or workflow-level `outputs:`** — a caller
cannot receive the computed tag back. This story therefore **re-derives** the tag from the `ref`
input, which is why Task 5.1's sanitizer must be byte-identical to `build.yml`'s
(`sed -E 's/[^a-zA-Z0-9._-]+/-/g' | cut -c1-100`, refusing leading `[.-]` and empty results).

This story does **not** build anything, does not call `build.yml`, and does not chain off a build.
Deploy takes what the registry has; if nothing is there, it fails closed (AC4).

### 6. Retention — the deadline this story inherits

`build.yml:962`:

```
KEEP_RE='^(prod-current|preprod-current|latest|buildcache|v?[0-9]+\.[0-9]+\.[0-9]+.*|(pre)?prod-[0-9a-f]{7,64}|sha-[0-9a-f]{7,64}-(pre)?prod)$'
```

The only `sha-` alternative is `-(pre)?prod`. **`-dev` tags expire at 14 days** — the live
`package_cleanup_rule` (id 1, `remove_days=14`) exists **only in the Forgejo database**: no API, no
CLI, not editable from this repository. Consequences:

- The stand's current pin, `sha-62e2ff8dc215-dev` (merged 2026-08-19), is deleted **on or about
  2026-09-02**. The running container is unaffected — it holds the image locally — but any re-pull,
  reboot-after-prune, or this story's first deploy against that exact ref fails closed with
  `manifest unknown`.
- The recorded remedy is **a scheduled redeploy, not a retag** (D26's `v1.0.0-buildkit-cni`
  precedent was considered and rejected: `-dev` tags are deliberately ephemeral, D18/D20).
  **Primary path: this story's first successful deploy. Fallback trigger: 2026-08-30, owner Oleg.**
  Task 9.4 is where this gets said one way or the other.
- Generally: any `-dev` tag older than 14 days is gone. Task 5.4's `404` message must offer both
  causes — never built, or built and expired.

### 7. Non-goals — absences that are decisions, not omissions

- **Concurrency / `flock` → Story 4.4.** No `concurrency:` block, no lock. `epics.md:1696-1722`. The
  runner's `capacity > 1` question (`deferred-work.md:231-233`) is 4.4's to re-examine, not to
  delete.
- **Slack notifications → Story 4.5**, deliberately resequenced last; `SLACK_CD_WEBHOOK_URL` still
  holds Story 1.13's `example.invalid` stub.
- **Factoring the mechanics into a shared definition → Story 4.8.** Write this one deploy plainly
  and well; 4.8 refactors it and must still make a DEV deploy succeed end to end.
- **Five-branch validation and the 10-minute budget → Story 4.7.**
- **Cutover → Story 4.9.**
- **Any CI gate on `staging` / `development` → D25: not extended, and that is a decision, not an
  oversight.** Feature branches are already gated by their own push runs; the two legacy branches are
  gated by nothing and stay that way.

### 8. Conventions that bind this story

- 🔴 **No `${{ }}` inside `run:` bodies. Not anywhere, not in comments** — Forgejo substitutes inside
  comments too (`build.yml:812-816`). Values arrive via `env:` and are referenced as shell variables.
  The rationale is not stylistic: `${{ }}` is textual substitution **before** bash parses the line,
  and git permits `$(...)`, backticks and quotes in a branch name. This story takes a branch name as
  a dispatch input and holds a registry credential in the same job — it is the exact threat model
  `build.yml:770-780` was written for. Story 4.2 recorded this rule as *"binding on Story 4.3"*.
- 🔴 **Never `ubuntu-latest`, and be careful with generic labels.** `ci.yml:105`: the CRM org carries
  an idle runner under `ubuntu-latest` belonging to **another team** — naming it does not fail, it
  resolves and runs on their infrastructure. The deploy runner has four labels
  (`deploy-dev-preprod`, `dev`, `preprod`, `deploy`) and the story must pick from those four
  (`deferred-work.md:186-190`). **Use `deploy-dev-preprod`** — the most specific; `dev`, `deploy` and
  `preprod` are generic enough to invite the same class of accident.
- **Fail-closed guards name both the cause and the fix** (`4-1-…md:370-381`, item 2). Task 5.4 is the
  worked example.
- **retro-E5 (live outcome matrix):** every guard proves itself on a run that **fails** as well as one
  that passes. Task 8 is this story's matrix, and it needs *four* live rows, not one.
- **retro-D4 (run ledger):** declare before work, close only against a query, re-query after merge.
- 🔴 **`D4` and `E5` collide across two numbering schemes.** The retro action items
  (`epic-3-retro-2026-08-18.md:77-78`) are written **retro-D4** / **retro-E5** throughout. The
  D-series in `docs/migration-decisions.md` is a *different* sequence — `D4` there is stand
  parameterization, and there is no `E5` at all. Task 9.1's new record goes in the D-series; the
  run-ledger rule never goes into `migration-decisions.md`.
- **Story file in English** (`_bmad/bmm/config.yaml`); **D-records in Russian**.
- **D7 / NFR5:** nothing is done on the GitHub side, at all. `docker-compose.server.yml` is not
  edited in place — the GitHub copy is alive and Oleg ports commits manually.
- **Secrets never enter this repository.** Host-local credential files on s1 are not repository files
  and are a different prohibition — but their contents are never printed into this story either.
- **Do not prove anything by grepping a bundle or a binary.** Read the registry, the container, the
  database, or run the command.

### 9. Run budget — the shape of the declaration (Task 1)

Baseline is the highest `action_run` id before the first **implementation** push. Lines to declare:

| Line | Cost |
|---|---|
| This context push (`story-4-3/pr-1-context`, **no PR opened**) | 1 (`ci.yml` `push`; no `paths` filter, so a docs-only push is not free) |
| Implementation PR — first push (before PR exists) | 1 |
| Implementation PR — opening the PR | 1 |
| Each subsequent push while the PR is open | **2** each (`push` + `pull_request: synchronize`, `ci.yml:65-71`, measured) |
| 🔴 Each `workflow_dispatch` of `deploy-dev.yml` | **1 each** — Task 8's matrix is ≥4, plus Task 2's probes, plus every re-run after a fix. **This is the largest line and it is new to this story.** |
| Merge to `main` (`build-main.yml`) | 1 |
| Closeout PR (separate branch/PR/merge, `main` is protected) | ~3 |

Do not compress this into a single number without the arithmetic. Story 4.1 declared 5 and spent 7
because the multiplier was not modelled; Story 4.2 modelled it in advance and landed exactly on 7.
`ci.yml`'s `image` job expands `uses: ./.forgejo/workflows/build.yml` **without** creating a second
`action_run` row (measured across five pushes in Story 4.1). Cancelled runs still occupy a row.
Treat the total as a **floor, not a ceiling**.

### 10. Things that are pending on Oleg — do not depend on them silently

| Item | State | Effect on this story |
|---|---|---|
| `REGISTRY_USER_RO` / `REGISTRY_TOKEN_RO` secrets | **Do not exist** | **Blocking for AC7.** Task 3.2. Stop rather than substitute the RW credential. |
| Rebind stand port to `127.0.0.1:8082` (M7) | Decided, **not applied** on s1 | Not blocking — Task 4.4 renders the value, making the decision self-applying and idempotent. Say so in the notes; it is a live-stand state change. |
| Revoke `fe_review_1_7` | **Pending** | A ledger query using `/root/.fj_token` will start returning `401`. That is the revocation, not a bug (Task 1.1). |
| `fe_reg_1_10_ro` (id 99) disposition | Unknown custody | Not blocking. Do not assume it is dead or alive. |
| Veto on the mechanism choice (§2) | Not sought | The work proceeds on option 5; a veto changes Task 4 and the decision record, not the ACs. |
| `workflow_dispatch` from a non-default branch | **Unmeasured** | Task 2.6. If unavailable, Task 8's matrix runs after the workflow lands on `main` — declare that ordering, do not discover it. |

### Project Structure Notes

- **New file:** `.forgejo/workflows/deploy-dev.yml` — the first deploy workflow in this repository,
  and the first `runs-on` in `.forgejo/workflows/` that is not `node-20`.
- **Repository files this story touches:** `.forgejo/workflows/deploy-dev.yml`,
  `.forgejo/workflows/README.md` (stale — still claims the directory is empty of workflows),
  `docs/migration-decisions.md` (new D-record + a D28 amendment block),
  `_bmad-output/implementation-artifacts/deferred-work.md`,
  `_bmad-output/implementation-artifacts/sprint-status.yaml`, and this story file.
- **Consumed, not modified:** `docker-compose.stand.yml` (65 lines, five `:?` variables, no
  `volumes:`, no host path, `external: true` network), `.env.stand.example` (the port and network
  tables, and the silent-failure warning).
- **Must not touch:** `docker-compose.server.yml`, `.github/workflows/CD.yml`, `nginx.conf`,
  `Dockerfile.prod`, `.env.dev.example` (that file describes the **legacy** stand, `:10-12`), and the
  four existing `.forgejo/workflows/*.yml`. If `docker-compose.stand.yml` or `.env.stand.example`
  turns out to need a change, that is a **finding to record** — Stories 5.2 and 6.10 consume them.
- The real `.env` is never committed: `.gitignore:51` ignores bare `.env`; `:21-22` force-include
  `.env.example` and `.env.*.example`.

### References

- [epics.md:1649-1694](_bmad-output/planning-artifacts/epics.md#L1649-L1694) — Story 4.3 ACs and the
  2026-08-11 deploy-runner amendment to AC2
- [epics.md:1552-1558](_bmad-output/planning-artifacts/epics.md#L1552-L1558) — Epic 4 objective;
  [:1696-1722](_bmad-output/planning-artifacts/epics.md#L1696-L1722) Story 4.4 (concurrency, out of
  scope here); [:1794-1820](_bmad-output/planning-artifacts/epics.md#L1794-L1820) Story 4.7 — the AC
  that forces AC3's reordering; [:1822-1860](_bmad-output/planning-artifacts/epics.md#L1822-L1860)
  Story 4.8 (the shared definition this workflow is later refactored onto)
- [docs/migration-decisions.md#d28](docs/migration-decisions.md) — §1 the stand as provisioned, §2 the
  Kong alias proof and its discriminating negative, §3 the registry credential on s1, **§4 the five
  options and the H5/H4 amendments (this story's two blockers)**, §5 the recorded deviations
  including the deferred AC2 clause, §6 s1 addressing, §7 the resource budget
- [docs/migration-decisions.md](docs/migration-decisions.md) — D10 (deploy runner, the documented
  host-`docker.sock` exception to AD-6, s1 addressing), D14 (registry accounts and scopes), D16
  (branch protection, eight required contexts), D18/D20 (tag scheme; `latest` cancelled), D25 (no CI
  gate on `staging`/`development`), D26 (permanent-tag precedent, considered and rejected for H1),
  D27 (the stand file and its five guards; `config` is blind to network existence), and D12's
  `### AC4` (deploy runs on a runner on the target host, no SSH)
- [_bmad-output/implementation-artifacts/deferred-work.md:2528-2686](_bmad-output/implementation-artifacts/deferred-work.md#L2528-L2686)
  — the Story 4.2 findings block: the five options (`:2544-2595`), **H4 registry auth (`:2597-2608`,
  Owner: Story 4.3)**, the deferred AC2 clause (`:2610-2613`), **H1 tag expiry with the
  scheduled-redeploy plan and the 2026-08-30 fallback trigger (`:2634-2660`)**, M7's exact command
  (`:2662-2686`)
- [_bmad-output/implementation-artifacts/deferred-work.md:2690-2734](_bmad-output/implementation-artifacts/deferred-work.md#L2690-L2734)
  — *"Deferred from: code review of story-4.2"*: M1 `/root/.fj_reg_4_2.raw`; **the registry
  credential has no detector**; `fe_reg_1_10_ro` disposition; the reboot restart-loop; the network
  teardown collision and the argument for a **recurring** Kong guard
- [_bmad-output/implementation-artifacts/deferred-work.md](_bmad-output/implementation-artifacts/deferred-work.md)
  — `:31-54` `fe_review_1_7`, exposure and pending revocation; `:186-190` the deploy runner's **four**
  registered labels; `:231-233` `flock` vs `capacity > 1` (Story 4.4); `:2409-2422` `config` is not a
  gate (**Owner: Stories 4.3 and 4.8**); `:2424-2442` guards test presence, not correctness;
  `:2497-2514` the ledger undercount and the PR-open/merge lines
- [.forgejo/workflows/ci.yml:40-96](.forgejo/workflows/ci.yml#L40-L96) — both triggers and the
  measured two-runs-per-push consequence at `:65-71`;
  [:105](.forgejo/workflows/ci.yml#L105) the `ubuntu-latest` warning;
  [:490-505](.forgejo/workflows/ci.yml#L490-L505) the `gate` job (why `github.event_name` cannot be
  tested in a `uses:` job's `if:`) and the `image` job that publishes the tag this story deploys
- [.forgejo/workflows/build.yml:962](.forgejo/workflows/build.yml#L962) — `KEEP_RE`, the retention
  mirror that excludes `-dev`;
  [:768-1030](.forgejo/workflows/build.yml#L768-L1030) the tag computation and its sanitizer,
  `PUSH_LATEST=false` at `:1026`;
  [:770-780](.forgejo/workflows/build.yml#L770-L780) the `${{ }}`-in-`run:` rationale;
  [:107-124](.forgejo/workflows/build.yml#L107-L124) the label/Node-runtime failure shape Task 2.2
  probes for; [:233-238](.forgejo/workflows/build.yml#L233-L238) the registry-login pattern;
  [:421-427](.forgejo/workflows/build.yml#L421-L427) the model fail-closed `case`
- [.forgejo/workflows/build-main.yml:23-26](.forgejo/workflows/build-main.yml#L23-L26) — *"Story 4.3's
  deploy pulls fail-fast with no `:latest` fallback"*, written before this story existed
- [docker-compose.stand.yml:32-65](docker-compose.stand.yml#L32-L65) — the five `:?` variables, no
  `volumes:`, `external: true` network, the self-referential healthcheck
- [.env.stand.example:58-67](.env.stand.example#L58-L67) — the port table (`8080` legacy, `8081`
  cadvisor, `8082` new DEV, `8083` PRE-PROD); [:76-84](.env.stand.example#L76-L84) the tag shapes;
  [:90-116](.env.stand.example#L90-L116) **the one axis where a wrong value fails silently**, the
  never-create-the-network rule, and `getent hosts crm-kong-gateway` as a STOP
- [nginx.conf:30-40](nginx.conf#L30-L40), [:49-51](nginx.conf#L49-L51) — lazy-resolving
  `crm-kong-gateway:8000` upstream: why a wrong network serves `200` and `healthy` with a dead `/api/`
- [_bmad-output/implementation-artifacts/4-2-provision-the-new-dev-stand-on-s1.md](_bmad-output/implementation-artifacts/4-2-provision-the-new-dev-stand-on-s1.md)
  — the stand as built, the anchored-vs-unanchored container check, the retro-E5 discriminating
  negative, `### Review Findings` (H1/H4/H5), and Completion Note 11's ledger arithmetic
- [_bmad-output/implementation-artifacts/4-1-parameterize-the-compose-file-for-coexisting-stands.md:368-396](_bmad-output/implementation-artifacts/4-1-parameterize-the-compose-file-for-coexisting-stands.md#L368-L396)
  — *"Conventions that are not negotiable"* and the prohibition that named this story
- [_bmad-output/implementation-artifacts/epic-3-retro-2026-08-18.md:70-80](_bmad-output/implementation-artifacts/epic-3-retro-2026-08-18.md#L70-L80)
  — retro-D4 (ledger closes only against a query) and retro-E5 (live outcome matrix for every new
  guard)
- [_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-11-deploy-runner.md](_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-11-deploy-runner.md)
  — deploy runs on a runner located on the target host; `ufw` closes SSH from job containers under any
  credentials; §4.11 — the previously forbidden labels become the intended deploy targets

## Dev Agent Record

### Agent Model Used

_(to be filled by dev-story)_

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Note |
|---|---|
| 2026-08-20 | Story contexted against `main` @ `162f1722`. Inheritance from Story 4.2 bound from source (story file, `### Review Findings`, D28 + its four amendment blocks, `deferred-work.md`'s Story 4.2 findings and code-review-deferred sections). **Three decisions taken autonomously, subject to Oleg's veto:** (1) mechanism = D28 §4 option 5, render compose + the five variables in the job workspace and act through the held `docker.sock` — options 1/3 rejected for read-write exposure to every tenant on the four-label runner, option 2 for coupling the `api-prionex` tree, option 4 retained only as the credential fallback; (2) registry auth = new repo secrets `REGISTRY_USER_RO`/`REGISTRY_TOKEN_RO` with `docker login` inside the job and a workspace-scoped `DOCKER_CONFIG`, discharging H4 and shipping the credential detector the deferred list says does not exist; (3) `runs-on: deploy-dev-preprod`, the most specific of the runner's four labels. **AC3's stated order is amended** — `down` before pull contradicts Story 4.7's *"the stand keeps serving its previous version"*; sequence is resolve → pull → `down` → `up -d` → health-check. **AC7 and AC8 added** for the two inherited constraints. H1's tag-expiry deadline carried: primary path is this story's first successful deploy, fallback trigger 2026-08-30 (Oleg). M7's `127.0.0.1:8082` is rendered by the workflow, making Oleg's decision self-applying and idempotent. Concurrency/`flock` (4.4), Slack (4.5), shared definition (4.8) recorded as non-goals |
