---
baseline_commit: 162f1722d614034037807dcd7af95752b67edf2b
---

# Story 4.3: Deploy a Feature Branch to DEV on Demand

Status: in-progress

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
  - [x] 1.0 Flip `sprint-status.yaml` `4-3-deploy-a-feature-branch-to-dev-on-demand` → `in-progress`
        before starting implementation, so the tracker never disagrees with reality mid-story.
        **Done.**

  - [x] 1.0b **🔴 Blocking-question resolution recorded here, closed by the coordinator (2026-08-20),
        before this story's own Task 3 was ever executed as originally written.** Dev Notes §10's
        table said the RO registry secrets "do not exist" and were blocking. That premise was wrong:
        `REGISTRY_USER_RO` and `REGISTRY_TOKEN_RO` are **existing ORG-level Forgejo secrets** (bot
        `robot-deploy`, scope `read:package`), provisioned by `CRM/api-prionex` — their model is
        documented on that project's own side, e.g. `api-prionex_f/docs/5-5-weekly-dev-reset-to-main.md:583`
        (org-level; the value only ever reaches a job as an environment variable, never a flag — the
        same rule this project already applies to `REGISTRY_TOKEN_RW`). **Confirmed by the
        coordinator's own query, `GET /orgs/CRM/actions/secrets` (2026-08-20):** the returned list
        includes `REGISTRY_USER`, `REGISTRY_USER_RO`, `REGISTRY_TOKEN_RW`, `SLACK_CD_WEBHOOK_URL`,
        `REGISTRY_TOKEN_RO`. Oleg's instruction — *"возьми из api-prionex_f"* — means: use this
        existing model. **Consequence: Task 3 as originally written (create repository secrets,
        mint or reuse a host-local token) is moot.** The deploy workflow consumes the two org
        secrets directly, exactly the way `build.yml` already consumes `REGISTRY_USER`/
        `REGISTRY_TOKEN_RW` — no repo-level secret declaration, no minting, no s1 dependency for
        this AC. Task 3 is rewritten below to reflect this. **Popcorn fact for Story 4.5, not acted
        on here:** `SLACK_CD_WEBHOOK_URL` is *also* org-level, per the same query — noted for
        whoever writes that story, since Story 1.13 left its value a dead `example.invalid` stub
        regardless of scope.
        **Veto points not exercised (coordinator, 2026-08-20):** Oleg did not veto the mechanism
        (D28 §4 option 5, Dev Notes §2) or the self-applying `FRONTEND_PORT=127.0.0.1:8082` (M7,
        Task 4.4) — both stand exactly as this story already recorded them.
  - [ ] 1.1 Query the pre-work baseline: highest `action_run` id before this story's first
        *implementation* push, via
        `GET https://git.crm-prionex.com/api/v1/repos/CRM/fe-prionex/actions/runs?limit=100`.
        🔴 **The token this project has used for that query is `fe_review_1_7` at `/root/.fj_token`
        on s1, and Oleg's revocation of it is PENDING** (`deferred-work.md:31-54`). If the query
        returns `401`, that is the revocation, not a bug — say so and use `fe_tmp_1_7` /
        `fe_pkg_3_6` per the standing token model, or ask. **Never print a token value**; Story 4.2's
        Completion Note 9 is the record of what happens when a `401` body echoes the presented
        string back.
        **Done, differently: this session does not touch the Forgejo API at all** (coordinator's
        standing instruction this cycle). The query above is requested from the coordinator instead
        — same D4 principle (query, not self-report), different hands on the keyboard. Baseline not
        yet known; requested alongside the Task 2 probe dispatch.
  - [x] 1.2 Declare the budget in the Dev Agent Record **before pushing anything**, using the
        arithmetic in Dev Notes §9. Do not restate "5 pushes" style flat counts — Story 4.1 declared
        5 and spent 7; Story 4.2 modelled the multiplier in advance and landed exactly on 7.
        **Done** — see Dev Agent Record → Run Budget Ledger, declared before this commit.
  - [x] 1.3 🔴 The multiplier is structural: **every push that lands while the PR is already open
        costs 2 `action_run` rows**, not 1 (`ci.yml:65-71`, measured). Cancelled runs still occupy a
        row and still count. **Modelled in the declaration.**
  - [x] 1.4 🔴 **This story is the first that also spends `workflow_dispatch` runs.** Each dispatch
        of `deploy-dev.yml` is its own `action_run` row. The retro-E5 outcome matrix (Task 8) is
        *at least four* dispatches — one pass and three discriminating failures — plus re-runs after
        every fix. Price them in the declaration explicitly; they are the largest line.
        **Modelled — the largest declared line, as directed.**
  - [x] 1.5 The merge to `main` fires **`build-main.yml`**, a different workflow from `ci.yml` (which
        ignores `main`): **+1**. The closeout PR is a second branch/PR/merge cycle: **+3**.
        **Modelled.**
  - [ ] 1.6 The ledger closes **only against a query, re-run after the merge commit lands**. A ledger
        closed at PR-open is not closed. If the query cannot be run, close it with the literal word
        **OPEN** — never a self-reported number. Final closure is the coordinator's.

- [x] **Task 1b — The workflow's own shape (AC1, AC2)** — Implemented in
      `.forgejo/workflows/deploy-dev.yml` (this push). Written, not yet live-verified — that is
      Task 8's job, not this task's.
  - [x] 1b.1 🔴 `on:` carries **`workflow_dispatch` and nothing else.** No `push`, no
        `pull_request`, no `schedule`. A stray `push` trigger turns every commit on every feature
        branch into a live DEV deploy — the deploy is *on demand* by design, and Story 4.6 is the
        story that adds a schedule, deliberately and separately.
  - [x] 1b.2 A single required input, `ref` (`type: string`). No `environment` choice — this
        workflow deploys DEV and only DEV; Epics 5 and 6 get their own, off Story 4.8's shared
        definition.
  - [x] 1b.3 **No approval, no `environment:` gate, no manual review step** (AC1). D25 also applies:
        nothing here starts gating `staging` or `development`.
  - [x] 1b.4 🔴 Set **`timeout-minutes`** on the job. `build.yml` sets 30; a deploy should be far
        tighter — Story 4.7 requires each deploy under **10 minutes**. Without it a hung pull or a
        health check that never converges holds a *shared* runner indefinitely.
        `deferred-work.md:1444-1454` records the absence of `timeout-minutes` as an open item on
        `ci.yml`; do not repeat it in the first deploy workflow.
  - [x] 1b.5 Record the deploy's **wall-clock duration** in the completion notes. Story 4.7 needs
        five such numbers and a dominant-step attribution for any that exceed the budget; producing
        the first one here costs nothing.
  - [x] 1b.6 Verify AC2's negative clause literally before handing off: no `ssh`, no `scp`, no
        `appleboy/ssh-action`, no `appleboy/scp-action` anywhere in the file. The job is already on
        s1; there is nothing to connect to. (`ufw` would refuse anyway — port 22 admits two admin
        addresses only.)

- [ ] **Task 2 — Probe the deploy runner before writing a line of the workflow (probe-first)**
  > Everything in this task is *unrecorded anywhere in this project*. Do not infer it. A wrong
  > assumption here does not fail loudly — see 2.2.
  - [x] 2.1 Write a throwaway probe workflow (`workflow_dispatch` only, no inputs) with
        `runs-on: deploy-dev-preprod` and **only `run:` steps**. Confirm it is picked up at all.
        **Confirmed positively, run 917 (coordinator's dispatch): the run was created and executed
        on the story branch.** Dispatch reaches this runner from a non-default branch — see 2.6.
  - [x] 2.2 🔴 **Does the job image run `uses:` steps?** `deploy-base-dev-preprod:2026-08-07` is
        another team's image and its contents are recorded nowhere. `build.yml:107-124` records the
        failure shape for the `docker-build` label: an image with no Node runtime **does not fail
        informatively — it simply does not run any `uses:` step**. Probe with a trivial
        `uses: actions/checkout@v4` and check whether the step actually executed (assert on a file
        that only checkout could have created). If `uses:` does not work, `actions/checkout` and
        `docker/login-action` are both unavailable and every step must be plain `run:`.
        ✅ **CLOSED NEGATIVELY, measured, run 920 (coordinator's dispatch of the redesigned
        three-job probe).** Job 1 ("dispatch reaches the runner, plain `run:`") — **success.** Job 2
        ("`uses:` steps actually populate the workspace — discriminating") — **failure.** Job 3
        (identity/tools cross-check) — **success**, confirming the local-simulation numbers live.
        Clean answer, exactly what the job split was for: **`uses:` steps do not execute on this
        runner's job image** — job 2 isolates that specifically, with jobs 1 and 3 both green around
        it, so the failure cannot be attributed to anything else in the same run. This matches
        `build.yml:107-124`'s precedent exactly (no Node runtime, `uses:` steps silently do not run)
        and confirms — not merely infers — that `deploy-dev.yml`'s **plain `run:` form is a
        necessity, not a caution.** Run 917's original single-job probe is now understood
        correctly in hindsight: that same mechanism was firing then too, the design just could not
        say so on its own.
  - [x] 2.3 Record the job container's **identity**: `id -u`, `id -g`, `whoami`. D28 §4's H5
        amendment names this as inferred-not-measured — `1501:988` was the runner *supervisor*, not
        the job. This is the number Story 4.2's deferred AC2 clause (AC8 here) needs.
        **Answered by local simulation** (Debug Log References) **and cross-checked by the probe's
        own last step** once dispatched: **uid 0 / gid 0 / root.**
  - [x] 2.4 Record what the job actually has: `docker version` (client and the daemon it reaches
        through the mounted socket), `docker compose version`, `git --version`, presence of `curl`,
        `jq`, `wget`. The workflow may use nothing that is not on this list.
        **Answered by local simulation** (Debug Log References): docker client 27.5.1 / server
        29.4.0, compose v2.33.0, git 2.47.2, `curl`/`jq`/`wget` all present.
  - [x] 2.5 Confirm the mounted socket reaches the **host** daemon and not a nested one: the host's
        containers (`fe-prionex-dev`, the runner containers, the `crm-dev` stack) must be visible
        from `docker ps`, and `crm-dev-network` must be present in `docker network ls`.
        **Answered by local simulation** (Debug Log References): host daemon confirmed (the
        `crm-preprod-*` stack is visible, which only the real host daemon carries), `crm-dev-network`
        present.
  - [x] 2.6 🔴 **Can `workflow_dispatch` be triggered from a non-default branch on this instance?**
        Try it from the story branch. If it cannot, the outcome matrix can only run **after** the
        workflow lands on `main` — record that ordering consequence and its ledger cost in Task 1's
        declaration rather than discovering it at the end. Note that the shipped workflow does not
        *need* branch dispatch: its `ref` input means dispatching from `main` with `ref=<feature>` is
        the intended usage.
        **Yes — measured, run 917.** Dispatch from this story's own feature branch works. No
        ordering consequence for Task 8: the matrix can run against this branch before merge if
        useful, though `deploy-dev.yml`'s own `ref` input means dispatching from `main` with
        `ref=<feature>` remains the intended day-to-day usage once merged.
  - [ ] 2.7 Delete the probe workflow before the implementation PR, or keep it and say why. Do not
        leave an undocumented workflow on `main`.
        **Kept for now, on purpose:** the redesigned three-job version is still an open, free
        confirmation offer (Task 2.2's note) and this task file still documents exactly why it
        exists. **Delete before merge** once Task 2.2 is either confirmed by a redispatch or the
        coordinator accepts the precedent-based inference as sufficient — whichever comes first.
        Not deleted in this same push so the offer stays live and dispatchable.

- [x] **Task 3 — Provision the deploy job's registry credential (AC7)** — 🔴 **Rewritten 2026-08-20,
      see Task 1.0b.** `REGISTRY_USER_RO`/`REGISTRY_TOKEN_RO` are existing ORG-level secrets
      (bot `robot-deploy`, `read:package`), confirmed live by the coordinator's own
      `GET /orgs/CRM/actions/secrets` query. Nothing is created, minted, or reused from s1 for this
      task — the subtasks below are the original ones struck through, replaced with what was
      actually done.
  - [x] ~~3.1 Create repository secrets `REGISTRY_USER_RO`/`REGISTRY_TOKEN_RO`~~ — **moot.** They
        already exist at org scope; a repo-level secret of the same name would only ever shadow the
        org one for no reason. Confirmed org-level, not repo-level, so no repo secret is declared.
  - [x] ~~3.2 Source of the value (reuse `fe_reg_4_2_ro` or mint fresh)~~ — **moot**, same reason.
        No s1 dependency for this AC. The workflow references `secrets.REGISTRY_USER_RO` /
        `secrets.REGISTRY_TOKEN_RO` directly, exactly as `build.yml:237-238` already references the
        org-level `secrets.REGISTRY_USER`/`secrets.REGISTRY_TOKEN_RW`.
  - [x] ~~3.3 Record owner/revocation trigger at mint time~~ — **moot, nothing was minted.** The
        credential is `robot-deploy`'s existing org token, owned and rotated by whoever administers
        org secrets (not this story, not Oleg-as-s1-operator specifically) — recorded as such in
        `deferred-work.md` (Task 9.3) rather than under this story's own minted-credential convention.
  - [ ] 3.4 While on s1, close the open item **M1**: `/root/.fj_reg_4_2.raw` — a second plaintext
        copy of the registry credential, mode/owner/contents unknown
        (`deferred-work.md:2697-2704`, *"Owner: whoever next has s1 access"*). Record its mode and
        purpose or delete it, and correct Story 4.2's Task 9.4 if something was in fact left behind.
  - [x] 3.5 In the workflow, log in **inside the job** so the client config the pull reads is the
        **job's own**: `docker login git.crm-prionex.com -u "$REG_USER" --password-stdin` with both
        values arriving through `env:` — never `${{ }}` inside the `run:` body. If Task 2.2 proved
        `uses:` works, `docker/login-action@v3` is acceptable and matches `build.yml:233-238`;
        prefer it only if proven.
        **Done — plain `run:` form** (Task 2.2's finding: `uses:` is not proven here), exactly the
        `docker login … --password-stdin` shape, `env:`-sourced, in `deploy-dev.yml`.
  - [x] 3.6 Set `DOCKER_CONFIG` to a job-workspace path so the credential lands in the workspace and
        not in a shared `$HOME` on a multi-tenant runner. Remove it on both success and failure
        paths.
        **Done** — `${GITHUB_WORKSPACE}/.docker-story-4-3`, exported via `$GITHUB_ENV`, removed by
        an `if: always()` cleanup step at the end of the job (both success and failure paths).

- [x] **Task 4 — Render the stand in the job workspace (AC2, the mechanism)** — Implemented in
      `.forgejo/workflows/deploy-dev.yml` (this push). Written, not yet live-verified — Task 8.
  - [x] 4.1 Obtain `docker-compose.stand.yml` **from this repository at the deployed ref** — not a
        heredoc copy. It is the single source of truth consumed by Stories 4.3, 5.2 and 6.10, and a
        second copy in a workflow is the "two compose files describe one application" failure this
        project already recorded (`deferred-work.md:2370-2407`). Use `actions/checkout` if Task 2.2
        proved it works; otherwise `git clone --depth 1 --branch <ref>` in a `run:` step.
  - [x] 4.2 Write the five required variables to an `--env-file` in the job workspace. All five, no
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
  - [x] 4.3 🔴 `CONTAINER_NAME` must **not** be `fe-prionex` — `CD.yml:201` force-removes that
        literal name on every legacy deploy (`docker-compose.stand.yml:19-21`).
  - [x] 4.4 🔴 `FRONTEND_PORT=127.0.0.1:8082` **is Oleg's M7 decision**
        (`deferred-work.md:2662-2686`), verified locally in the 4.2 fix-pass to render
        `"127.0.0.1:8082:80"` with no template change. Rendering it here makes the decision
        **self-applying and idempotent on the first deploy**, so this story does not depend on the
        manual `sed` having been run. If Oleg has already applied it, the values agree; if not, the
        first deploy applies it. Say this out loud in the completion notes — it is a state change to
        a live stand made as a side effect, and it should be visible rather than discovered.
  - [x] 4.5 🔴 **Never create the network.** `crm-dev-network` is `external: true` and belongs to the
        `CRM/api-prionex` stack. `external: true` refusing to start is *the only loud failure
        available on this axis* (`.env.stand.example:90-116`), and auto-creating it converts that
        refusal into an empty backend-less network that comes up happily — `CD.yml:185` is exactly
        this anti-pattern. No `docker network create` appears anywhere in this workflow.
  - [x] 4.6 🔴 **Do not gate on `docker compose config`.** `config` is blind to network existence:
        `config` exits 0 while `up -d` exits 1 with *"network … declared as external, but could not be
        found"* (D27; `deferred-work.md:2409-2422`, *Owner: Stories 4.3 and 4.8*). A pre-deploy gate
        built on `config` alone passes a stand that cannot start. `up -d` is the gate.
  - [x] 4.7 Record the one accepted divergence: compose stores
        `com.docker.compose.project.working_dir`, which will now point at a job workspace that no
        longer exists after the run. Verify that a **manual** `docker compose … up -d` from
        `~/crm-prionex/fe-prionex-dev/` still adopts the same containers (project name is the
        identity, not the directory) — this is the DR path four later stories assume, and it must not
        have been broken by the mechanism choice.
  - [x] 4.8 Keep the host `.env` on s1 as the manual/DR copy and state plainly, in the decision
        record, that there are now **two sources for the same five values** and that the workflow is
        authoritative for deploys. Name the drift risk; hand the reconciliation to Story 4.8 (shared
        mechanics) or 4.9 (cutover), whichever the record argues for. Do not pretend it is closed.

- [x] **Task 5 — Resolve the tag and pull, fail-closed (AC3, AC4, AC6, AC7)** — Implemented in
      `.forgejo/workflows/deploy-dev.yml` (this push), including the registry v2 digest resolution
      via `curl --config -` (never `-u`/`-H`, which would put the credential in this job's own
      `ps auxww` on a shared runner) — mechanism proven locally on s1 first (Debug Log References):
      200/401/404 all reproduced against the real registry with a real `read:package` credential
      before being written into this file. Written, not yet live-verified end to end — Task 8.
  - [x] 5.1 Derive the image tag from the `ref` input using a sanitizer **byte-identical** to
        `build.yml`'s: `sed -E 's/[^a-zA-Z0-9._-]+/-/g' | cut -c1-100`, refusing a leading `[.-]` and
        refusing an empty result. If the two sanitizers ever diverge, this workflow deploys a tag the
        builder never published, and the failure is `manifest unknown` with a misleading name in it.
        Tag shape: `git.crm-prionex.com/crm/fe-prionex:<sanitized-ref>-dev`.
  - [x] 5.2 🔴 The `ref` input arrives through `env:` and is referenced as a shell variable. **No
        `${{ }}` anywhere inside a `run:` body — not even in a comment**, because Forgejo substitutes
        inside comments too (`build.yml:770-780, 812-816`). Git permits `$(...)`, backticks and
        quotes in branch names (`git check-ref-format --branch 'feat/$(id)'` exits 0), and by this
        point in the job a registry credential is in the workspace.
  - [x] 5.3 Resolve the digest **before** pulling: query the registry for the manifest and capture
        `Docker-Content-Digest`. Keep it for AC6.
  - [x] 5.4 🔴 **The fail-closed guard, and the reason this story owns it.** Classify the failure and
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
  - [x] 5.5 `docker pull` the resolved reference. Only after it succeeds does anything get torn down.

- [x] **Task 6 — Replace the stand (AC3)** — Implemented in `.forgejo/workflows/deploy-dev.yml`
      (this push). Written, not yet live-verified — Task 8.
  - [x] 6.1 `docker compose -f <workspace>/docker-compose.stand.yml --env-file <workspace>/.env down`
        — targeting the project by name, so it cannot touch another project.
  - [x] 6.2 `… up -d`. Confirm the exit code; do not infer success from the absence of output.
  - [x] 6.3 Confirm the network was **not** created by this run: `crm-dev-network`'s id before and
        after the deploy is the same id (Task 4.5's rule, proven rather than asserted).
  - [x] 6.4 🔴 Serialization is **out of scope — it is Story 4.4**. Do not add `concurrency:`, do not
        add `flock`. Two simultaneous deploys colliding is a known, accepted, *named* gap until 4.4
        (`epics.md:1696-1722`; the runner's `capacity > 1` question is recorded at
        `deferred-work.md:231-233`). Record it as a non-goal so the review does not read its absence
        as an omission.

- [x] **Task 7 — Verify the stand after deploy (AC5, AC6, and two inherited deferred items)** —
      Implemented in `.forgejo/workflows/deploy-dev.yml` (this push). Written, not yet
      live-verified — Task 8.
  - [x] 7.1 Poll `docker inspect -f '{{.State.Health.Status}}'` against `CONTAINER_NAME`, with a
        bounded timeout and a non-zero exit on timeout. `{{ }}` here is a Go template consumed by
        `docker`, not a Forgejo expression — it is safe inside `run:`; `${{ }}` is not.
  - [x] 7.2 🔴 Assert the container is **this project's**: match the name **anchored**
        (`^fe-prionex-dev$`) and check
        `.Config.Labels["com.docker.compose.project"] == fe-prionex-dev`. Unanchored `--filter name=`
        is a substring match and cannot fail on this host (Story 4.2, Task 7).
  - [x] 7.3 Fallback `curl`: parse the host-port component out of `FRONTEND_PORT` (`127.0.0.1:8082`
        → host `127.0.0.1`, port `8082`) and target that. Do not concatenate the raw value.
  - [x] 7.4 **AC6:** compare `docker inspect -f '{{.Image}}'` of the running container to the digest
        captured in Task 5.3. Not to the tag — to the digest.
  - [x] 7.5 🔴 **Kong alias guard, and it is recurring, not one-shot.**
        `docker exec <container> getent hosts crm-kong-gateway` must return an address. **An empty
        result is a STOP, and is NOT a reason to fall back to `crm-network`**
        (`.env.stand.example:90-116`). This discharges the deferred item at
        `deferred-work.md:2728-2734`, whose stated reason for wanting a recurring guard is that the
        backend team can force-disconnect our container while the stand keeps serving `200` on `/`,
        a dead `/api/`, and `healthy` throughout. Strengthen it the way D28 §2 did: an address alone
        proves less than an address plus Kong answering — `GET /api/` returning Kong's own
        `no Route matched` with `X-Kong-Response-Latency` is the discriminating check.
  - [x] 7.6 Record the stand's post-deploy state for the reboot-ordering item
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
| `REGISTRY_USER_RO` / `REGISTRY_TOKEN_RO` secrets | ✅ **RESOLVED 2026-08-20 — already exist, org-level** (coordinator, `GET /orgs/CRM/actions/secrets`). Not repo secrets; not minted. | No longer blocking. Task 3 rewritten to consume them directly, mirroring `build.yml`'s existing `REGISTRY_USER`/`REGISTRY_TOKEN_RW` usage. |
| Rebind stand port to `127.0.0.1:8082` (M7) | Decided, **not applied** on s1 | Not blocking — Task 4.4 renders the value, making the decision self-applying and idempotent. Say so in the notes; it is a live-stand state change. |
| Revoke `fe_review_1_7` | **Pending** | A ledger query using `/root/.fj_token` will start returning `401`. That is the revocation, not a bug (Task 1.1). |
| `fe_reg_1_10_ro` (id 99) disposition | Unknown custody | Not blocking. Do not assume it is dead or alive. |
| Veto on the mechanism choice (§2) | ✅ **Not exercised (coordinator, 2026-08-20).** | Option 5 stands as recorded; Task 4 proceeds unchanged. |
| `workflow_dispatch` from a non-default branch | **Unmeasured** | Task 2.6. If unavailable, Task 8's matrix runs after the workflow lands on `main` — declare that ordering, do not discover it. |
| SLACK_CD_WEBHOOK_URL scope | 📍 **Noted, not acted on** — also org-level per the same 2026-08-20 query. For Story 4.5. | None on this story. |

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

Opus 5, dev-story cycle, 2026-08-20.

### Debug Log References

**Local simulation of the job container, via SSH on s1, before any real dispatch (Task 2.3–2.5).**
`root@10.67.0.1` reachable directly (no `~/.ssh/config` alias needed — same address Story 4.2 used).
Read `/opt/forgejo-runner-deploy/config.yml` directly: confirms D28 §4's `container.options`
(`docker.sock` + `/opt/crm-preprod` + `/opt/crm-dev` + `--add-host`) and `valid_volumes`
(the same three paths) with no drift, plus new context D28 didn't carry — `network:
forgejo-runner-crm-deploy_runner` (192.168.225.0/24, not the default bridge; nginx ACL already
allows this subnet) and `force_pull: false` (the job image is a local tag, not registry-sourced).

Ran a container reproducing the exact job shape (`deploy-base-dev-preprod:2026-08-07`, same three
bind mounts, same `--add-host`, same network):

```
$ docker run --rm --network forgejo-runner-crm-deploy_runner \
    -v /var/run/docker.sock:/var/run/docker.sock -v /opt/crm-preprod:/opt/crm-preprod \
    -v /opt/crm-dev:/opt/crm-dev --add-host=git.crm-prionex.com:10.70.0.1 \
    deploy-base-dev-preprod:2026-08-07 sh -c '...'
=== identity ===        uid=0 gid=0 whoami=root
=== docker ===          client 27.5.1, server (host daemon) 29.4.0
=== compose ===         v2.33.0
=== tools ===            git 2.47.2, curl, jq, wget all present
=== host daemon visibility ===  crm-preprod-* stack containers visible — real host daemon, not nested
=== crm-dev-network ===  present (62d1b3fc449b…)
```

**Answers Task 2.3 directly, correcting D28 §4's own H5 amendment**: the job container's identity
is **uid 0 / root**, not the `1501:988` the runner *supervisor* container runs as — D28 §4 had
already flagged this as measured-for-the-wrong-identity, and this is the actual measurement.
Answers 2.4 (tool/version inventory) and 2.5 (socket reaches the host daemon; `crm-dev-network`
visible) directly. **Does not and cannot answer 2.1/2.2** — whether `workflow_dispatch` is picked
up from a non-default branch, and whether `uses:` steps execute inside a real Forgejo Actions job
against this image, are properties of the runner *software*, not reproducible via a bare `docker
run`. `.forgejo/workflows/probe-deploy-dev-preprod.yml` (this push) exists to answer those two —
dispatch requested from the coordinator, per this project's standing division (I commit and push;
the coordinator dispatches and reports run ids).

### Run Budget Ledger

*Declared 2026-08-20, before the first implementation push (Task 1.2), per the model in Dev Notes
§9 — not a flat count.*

| Line | Runs |
|---|---|
| This push (context edits to Task 1/3/Dev Notes §10 + the probe workflow; PR not open yet) | 1 |
| Probe dispatch (`probe-deploy-dev-preprod.yml`, Task 2.1/2.2) — coordinator's | ≥1, more if it needs a fix-and-redispatch |
| Implementation push(es) after the probe's answer is known | 1 for the first, **2 each** for every subsequent push once the PR is open (`ci.yml:65-71`) |
| PR-open event | 1 (folds into the "2 each" line above for whichever push it coincides with, per Story 4.2's own measured pattern — not double-counted separately) |
| `deploy-dev.yml` dispatches — Task 8's live outcome matrix | **≥4** (one PASS row, three discriminating FAIL rows: AC4/manifest-unknown, AC7/unauthorized, AC5/unhealthy) **+ Task 2's own probe** + any re-run after a fix. **This is the largest line, per Dev Notes §9, and it is new to this story.** |
| Merge to `main` (`build-main.yml`) | 1 |
| Closeout PR (separate branch/PR/merge, `main` protected — D16) | ~3 |

**Baseline (Task 1.1): 892** (coordinator's query, highest `action_run` id before the context push).
**Confirmed spend so far, all by the coordinator's own queries, none self-reported:**

| run id | trigger | commit / event | outcome |
|---|---|---|---|
| 915 | `push` | `07fb5b24` (the context push, predates this session) | — |
| 916 | `push` | `e5856770` (this session's first push — cred resolution, budget, probe v1) | CI was still running at query time; outcome to be recorded when known |
| 917 | `workflow_dispatch` | `probe-deploy-dev-preprod.yml`, single-job version | **failure** — ambiguous by design (Task 2.2), redesigned into three jobs |
| 918 | `push` | `bcd98b4e` (`ci.yml`, deploy-dev.yml + three-job probe) | **success** |
| 919 | `workflow_dispatch` | `deploy-dev.yml`, task 8551, first live dispatch (`ref=main`) | **failure**, <60s — diagnosed (Completion Note 3), fixed this push (`preflight` job) |
| 920 | `workflow_dispatch` | `probe-deploy-dev-preprod.yml`, three-job version | job 1 success, job 2 **failure** (Task 2.2 closed negatively, measured), job 3 success |

**PR not open yet** — one row per push so far, not two; the multiplier starts applying only once a
PR exists. **Total above is a floor, not a ceiling**, per Dev Notes §9 and every prior story's own
corrected experience (4.1 declared 5, spent 7; 4.2 modelled the multiplier in advance and landed
exactly on 7). Final closure remains the coordinator's, by query, after the merge (Task 1.6).

### Completion Notes List

**1. Registry credential blocker resolved without minting anything.** Coordinator confirmed
`REGISTRY_USER_RO`/`REGISTRY_TOKEN_RO` already exist as org-level secrets (`GET
/orgs/CRM/actions/secrets`, 2026-08-20). Task 3 rewritten in place — no repo secret, no s1
dependency for AC7.

**2. `uses:` steps do not deliver a working checkout on this runner's job image (Task 2.2) —
✅ measured, run 920, not just inferred.** Run 917's single-job probe failed ambiguously; redesigned
into three separate jobs (`probe-deploy-dev-preprod.yml`) matching this project's own
job-list-is-the-evidence convention. Run 920: job 1 (plain `run:`) success, job 2 (`uses:`,
discriminating) **failure**, job 3 (identity cross-check) success — the failure isolates cleanly to
the `uses:` mechanism itself, with both neighbouring jobs green. Confirms `build.yml:107-124`'s
identical failure shape on this sibling runner/image. `deploy-dev.yml`'s plain-`run:` form
(written ahead of this confirmation, on the strength of the precedent alone) is now known to be a
necessity, not merely a cautious default.

**3. Run 919 — `deploy-dev.yml`'s first live dispatch failed in under 60 seconds, with no
retrievable log; diagnosed by construction and by SSH, not guessed at.** Job "Deploy a ref to the
DEV stand" (task 8551) ran ~16:00:28–16:00:3x local (per the runner's own container log, which
only records task start times, not step output — Forgejo job logs are not retrievable from this
runner either, same standing limitation as the CI runners). **Ruled out by direct reproduction on
s1, through the EXACT job network path** (`--network forgejo-runner-crm-deploy_runner` +
`--add-host=git.crm-prionex.com:10.70.0.1`, the same `docker run` shape Task 2's local simulation
already used): DNS resolves correctly, `curl` to the registry's `/v2/` base returns a clean `401`,
and `docker login` with *deliberately wrong* credentials fails with a clean `unauthorized` — not a
timeout, not a network error. **The network/DNS path is not the cause.**
**Leading hypothesis, not yet directly confirmed: `secrets.REGISTRY_USER_RO`/
`secrets.REGISTRY_TOKEN_RO` may exist at the ORG level (confirmed by the coordinator's own query)
without being GRANTED to this specific repository** — Forgejo, like GitHub, can scope an org
secret to selected repositories, and `REGISTRY_USER`/`REGISTRY_TOKEN_RW` already working for
`fe-prionex` does not prove the newer RO pair carries the same grant. This would produce exactly
the observed shape: the workflow's own guard (Task 3.5, "REGISTRY_USER_RO / REGISTRY_TOKEN_RO is
empty or unset") fires within the first two real steps, well under 60 seconds, and aborts before
anything touches the stand.
**Confirmed by SSH: the stand was NOT touched.** `fe-prionex-dev`'s `Created`/`StartedAt` are both
`2026-08-19T17:55:25` — unchanged since Story 4.2 first provisioned it, `State=running`,
`Health=healthy`, and `docker compose ls` still shows the project's config file as
`/root/crm-prionex/fe-prionex-dev/docker-compose.stand.yml` (the host-directory path from Story
4.2), not a job-workspace path from this run. **The fail-closed property held — nothing ran `down`
before aborting**, which is itself evidence for Task 8's matrix, even though this dispatch was not
an intentional discriminating row.
**Fix, "workflow-as-evidence" per the coordinator's own suggestion:** a new `preflight` job added
ahead of `deploy` (`needs: preflight`) — checks the two secrets' *lengths* (never their values) and
confirms registry reachability independent of credentials, entirely on its own, so its PASS/FAIL is
visible in the run's job list without any log access, exactly like the probe redesign. Bug caught
while writing it: `${#REG_USER}` alone crashes under `set -euo pipefail` ("unbound variable") if
the secret resolves to genuinely unset rather than empty — fixed to `${REG_USER:-}` first, so the
diagnostic cannot itself crash on the exact condition it exists to detect.

**4. Local simulation of the deploy job (SSH, s1) closed three subtasks before spending a real
dispatch.** Job identity is uid 0/root (not the runner supervisor's `1501:988` — corrects D28 §4's
own H5 amendment); docker/compose/git/curl/jq/wget versions recorded; the mounted socket reaches
the real host daemon and `crm-dev-network`. Separately, the registry v2 digest-resolution mechanism
(200/401/404) was proven live against the real registry with a real `read:package` credential
(`fe_reg_4_2_ro`, Story 4.2's) *before* being written into `deploy-dev.yml` — the exact HTTP
status/header shapes the workflow's own fail-closed guard (Task 5.4) now classifies.

**5. `deploy-dev.yml` written end to end** (Tasks 1b, 3.5/3.6, 4, 5, 6, 7) — sequence resolve →
credential login → digest resolve (fail-closed on 401/404/other) → pull → render `.env` in the job
workspace (digest-pinned `DOCKER_IMAGE`, `FRONTEND_PORT=127.0.0.1:8082`) → capture network id →
`down` → `up -d` → confirm network unchanged → health-poll → anchored container/label check →
fallback HTTP → AC6 digest comparison → recurring Kong guard (address + Kong's own `no Route
matched` signature) → post-deploy state record → duration → credential cleanup. **Written and
locally validated (YAML, `bash -n`, no stray `${{ }}`), not yet live-verified — that is Task 8's
job, explicitly, not this one's.**

### File List

**Added**
- `.forgejo/workflows/deploy-dev.yml` — the deploy workflow (Tasks 1b, 3, 4, 5, 6, 7)
- `.forgejo/workflows/probe-deploy-dev-preprod.yml` — throwaway, dispatch-only (Task 2); kept for
  now per Task 2.7's note, to be deleted before merge

**Modified**
- `.forgejo/workflows/deploy-dev.yml` — added the `preflight` job (diagnosing run 919: secret
  length/presence and registry reachability, independently job-listed, no log access needed);
  `deploy` now `needs: preflight`
- `_bmad-output/implementation-artifacts/4-3-deploy-a-feature-branch-to-dev-on-demand.md` — this
  file: `Status`, Task 1/2/3 checkboxes and resolutions, Dev Notes §10, Dev Agent Record
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `4-3-…` → `in-progress`

## Change Log

| Date | Note |
|---|---|
| 2026-08-20 | Story contexted against `main` @ `162f1722`. Inheritance from Story 4.2 bound from source (story file, `### Review Findings`, D28 + its four amendment blocks, `deferred-work.md`'s Story 4.2 findings and code-review-deferred sections). **Three decisions taken autonomously, subject to Oleg's veto:** (1) mechanism = D28 §4 option 5, render compose + the five variables in the job workspace and act through the held `docker.sock` — options 1/3 rejected for read-write exposure to every tenant on the four-label runner, option 2 for coupling the `api-prionex` tree, option 4 retained only as the credential fallback; (2) registry auth = new repo secrets `REGISTRY_USER_RO`/`REGISTRY_TOKEN_RO` with `docker login` inside the job and a workspace-scoped `DOCKER_CONFIG`, discharging H4 and shipping the credential detector the deferred list says does not exist; (3) `runs-on: deploy-dev-preprod`, the most specific of the runner's four labels. **AC3's stated order is amended** — `down` before pull contradicts Story 4.7's *"the stand keeps serving its previous version"*; sequence is resolve → pull → `down` → `up -d` → health-check. **AC7 and AC8 added** for the two inherited constraints. H1's tag-expiry deadline carried: primary path is this story's first successful deploy, fallback trigger 2026-08-30 (Oleg). M7's `127.0.0.1:8082` is rendered by the workflow, making Oleg's decision self-applying and idempotent. Concurrency/`flock` (4.4), Slack (4.5), shared definition (4.8) recorded as non-goals |
| 2026-08-20 | **Registry-credential blocker resolved (coordinator): `REGISTRY_USER_RO`/`REGISTRY_TOKEN_RO` are existing org-level secrets, not minted.** Task 3 rewritten. Budget declared before the first push (baseline requested, not self-queried — this session does not touch the Forgejo API this cycle). Local SSH simulation on s1 answers Task 2.3/2.4/2.5 without a dispatch. First probe pushed (single job); run 917 came back `failure`, ambiguous by design |
| 2026-08-20 | **Probe redesigned into three jobs after run 917's ambiguous single-job result** (coordinator's report: dispatch-from-non-default-branch confirmed working; the `uses:` question stayed undetermined). `deploy-dev.yml` written in full, in the plain-`run:` form the precedent (`build.yml:107-124`) and the ambiguous-but-consistent probe result both point to — registry digest resolution proven live against the real registry (200/401/404) with a real credential before being written into the workflow. Tasks 1b/3/4/5/6/7 marked implemented, pending Task 8's live verification |
| 2026-08-20 | **Run 920: `uses:` steps confirmed (not inferred) to not execute on this runner's job image — Task 2.2 closed negatively, measured.** Run 919: `deploy-dev.yml`'s first live dispatch (`ref=main`) failed in <60s. Diagnosed by reproducing the exact job network path on s1 via SSH — DNS, registry reachability, and `docker login` failure mode all clean, ruling out a network cause; leading hypothesis is the org secrets existing but not being granted to this repository specifically. Confirmed by SSH that the stand was untouched (fail-closed held). Fix: a new `preflight` job ahead of `deploy`, reporting secret presence (by length, never value) and registry reachability independently, so the run's job list alone (no log access) will show which is true on the next dispatch. Caught and fixed a real bug while writing it: `${#VAR}` crashes under `set -u` on a genuinely unset variable — changed to default-to-empty first |
