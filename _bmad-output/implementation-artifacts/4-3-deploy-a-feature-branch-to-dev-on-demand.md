---
baseline_commit: 162f1722d614034037807dcd7af95752b67edf2b
---

# Story 4.3: Deploy a Feature Branch to DEV on Demand

Status: in-progress

<!-- Code review 2026-08-20 (Opus, three parallel layers): **changes requested**. 5 high, 12 medium,
     12 low, 4 deferred, 8 dismissed, plus 3 decision-needed for Oleg — see `### Review Findings`.
     Status returned to `in-progress` because the patch findings are left as action items, not
     applied. The mechanism, the credential design and the AC amendments all hold; the findings are
     concentrated in the verification layer. -->


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
  - [x] 2.7 Delete the probe workflow before the implementation PR, or keep it and say why. Do not
        leave an undocumented workflow on `main`.
        **Kept for now, on purpose:** the redesigned three-job version is still an open, free
        confirmation offer (Task 2.2's note) and this task file still documents exactly why it
        exists. **Delete before merge** once Task 2.2 is either confirmed by a redispatch or the
        coordinator accepts the precedent-based inference as sufficient — whichever comes first.
        ✅ **Deleted, at story close.** Task 2.2's own stated condition was met (run 920 confirmed
        it, measured, negatively) — `probe-deploy-dev-preprod.yml` served its purpose and is
        removed. Nothing undocumented lands on `main`.
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
  - [x] 3.4 While on s1, close the open item **M1**: `/root/.fj_reg_4_2.raw` — a second plaintext
        copy of the registry credential, mode/owner/contents unknown
        (`deferred-work.md:2697-2704`, *"Owner: whoever next has s1 access"*). Record its mode and
        purpose or delete it, and correct Story 4.2's Task 9.4 if something was in fact left behind.
        ✅ **Found, identified, deleted.** `/root/.fj_reg_4_2.raw` — mode `600`, root-owned, 80
        bytes, mtime matching the original token-mint operation — confirmed (first bytes, and a
        `diff` against `.fj_reg_4_2.token`) to be the raw CLI output of the mint command (label text
        + the same token value), not a different credential. Served no ongoing purpose — `.token`
        is what login/testing actually reads. Deleted. A companion `.fj_reg_4_2.err` (0 bytes, empty
        stderr capture from the same mint) deleted alongside it, for the same reason. Only
        `/root/.fj_reg_4_2.token` remains on s1 now.
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

- [ ] **Task 8 — Live outcome matrix (retro-E5; a guard that cannot fail proves nothing)** —
      reopened by code review (H2/H3/DN2): 8.2 needs re-earning now that `digest-resolve-test` no
      longer gates `deploy` (DN1's fix); 8.3's message needs reconfirming with the new simulation
      marker (M11's fix). Pending the coordinator's redispatch.
  > *"Every new guard ships a live outcome matrix including a discriminating run"* —
  > `epic-3-retro-2026-08-18.md:78`. Each row below is a **real dispatch on the real runner**, not a
  > local simulation. Record run id, trigger, exit code and the message the guard printed.
  - [x] 8.1 **PASS** — an existing branch with a built image. Stand comes up healthy, digest matches.
        **Run 929, `ref=main`, all four jobs (`preflight`/`clone-test`/`digest-resolve-test`/
        `deploy`) SUCCESS — the first successful Forgejo-native DEV deploy.** Confirmed host-side
        on s1, live: `fe-prionex-dev` running, healthy, `Created`/`StartedAt` at run 929's own
        window; its image digest is `sha256:e66149a837365b3716b4ba6082ba642bd47af9814a776f0b3da1b1cf6366c163`
        — re-resolved the `main-dev` tag against the real registry independently and got the exact
        same digest back, live, right now, confirming the deployed image is the CURRENT `main-dev`,
        not a stale cache. `docker compose ls` config path is the job's own workspace, confirming
        this run rendered and applied its own files end to end.
        **Second PASS, run 938, `ref=main` (recovery dispatch after 937's deliberate breakage).**
        SUCCESS, ~60s. Doubles as this row's own repeat-PASS AND as a live idempotent/recovery-path
        confirmation matching Completion Note 9's own local `bash -x` idempotency finding (down/up
        on an already-good digest is a clean no-op-equivalent success) — here proven against the
        HARDER case, a genuinely broken prior state, not merely an already-good one. Confirmed
        host-side, final: `fe-prionex-dev` healthy, `Created`/`StartedAt` at run 938's own window,
        digest `sha256:e66149a83...` — matching, network id unchanged since 2026-08-13, no orphaned
        containers/networks, one harmless dangling image layer from 937's own build (removed).
  - [ ] 8.2 **FAIL, discriminating (AC4):** a ref with no built image → `manifest unknown` path,
        message names the missing tag, **and the stand is still serving its previous version
        afterwards** (this is the row that proves the reordering in AC3 was real).
        🔴 **Run 935's result reopened by code review (H2/H3/DN2): `deploy` was SKIPPED, not run —
        the message that fired was `digest-resolve-test`'s own generic one, not AC4's actual
        classifier at `:394-401`, which never executed.** The story's earlier framing of the skip as
        "the intended discriminating shape" was itself an undocumented weakening of this row's
        stated requirement (*"message names the missing tag"*) — corrected, not defended. Now that
        `digest-resolve-test` no longer gates `deploy` (DN1), the same ref
        (`044bf348c3f0c7aaf16c276a2d602e908e3b3ecd`) should make `deploy` itself run and reach its
        own 404 classifier. **Pending the coordinator's re-dispatch of this exact ref** — run number
        to be recorded here once it lands.
  - [x] 8.3 **FAIL, discriminating (AC7):** the registry credential deliberately wrong or absent →
        `unauthorized` path, message names the credential, **not** the tag. This is the row that
        proves the detector distinguishes the two causes.
        **Run 936, `ref=main`, `simulate_bad_credential=true`.** Ladder all **success** (`preflight`/
        `clone-test`/`digest-resolve-test` all reflect the REAL credential, untouched by the input —
        exactly as designed) — `deploy` **FAILURE**, at the digest-resolve step's own 401
        classifier, the code this row exists to exercise. Confirms the detector fires on a
        credential problem specifically, isolated from every other guard in the chain.
        🔴 **Refinement per code review M11, not a re-earning:** the 401 classifier's message did
        not yet carry a simulation marker at run 936 — indistinguishable, in a log excerpt or an
        alert, from a real credential outage. Fixed this push (the message now appends `[SIMULATED
        via simulate_bad_credential=true — NOT a real credential outage]`). **Pending the
        coordinator's re-dispatch** of the same input to confirm the marker prints — run number to
        be recorded here once it lands.
  - [x] 8.4 **FAIL, discriminating (AC5):** deploy against a stopped/absent stand, or a container
        that never becomes healthy → the health check reports failure and does **not** report healthy
        from another container. The 4.2 precedent for a real discriminating negative is D28 §2's
        throwaway container on the built-in `bridge` network (empty output, `exit 2`).
        **Run 937, `ref=test/4-3-unhealthy-probe`.** `deploy` **FAILURE**, ~60s — the health-poll's
        own bounded fail path fired (Task 7.1), exactly as designed; the healthcheck override
        (`["CMD", "false"]`) meant the container could never report healthy, and — per this row's own
        pre-flagged, accepted consequence (Completion Note 11 and AC3's own scope) — the stand WAS
        left genuinely unhealthy afterward, not untouched; restored by run 938 immediately after.
  - [x] 8.5 Optional but cheap, and it closes AC5's last clause hard: run the anchored container
        check while a `forgejo-runner-fe-prionex*` container is present (it always is) and show that
        the **unanchored** form would have passed. Same command, both outcomes.
        **Demonstrated live on s1, host-side, no dispatch needed.** Anchored
        (`docker ps --filter "name=^fe-prionex-dev$"`) returns exactly `fe-prionex-dev`. The SAME
        filter unanchored (`name=fe-prionex`) returns FIVE containers —
        `fe-prionex-dev forgejo-runner-fe-prionex-2 forgejo-runner-fe-prionex-dind-2
        forgejo-runner-fe-prionex forgejo-runner-fe-prionex-dind` — a real, present substring-match
        hazard on this exact host, confirming Story 4.2's own finding still holds. One honest
        caveat: this workflow's own check compares for EXACT equality against the literal string
        `"fe-prionex-dev"`, not mere non-emptiness — so even fed the unanchored (5-line) output, the
        equality comparison itself would still correctly reject it. The anchoring is the correct,
        self-documenting way to express "exactly this one" rather than relying on that equality
        form's incidental safety — demonstrated, not merely asserted.
  - [x] 8.6 **Evidence of a MECHANISM, not a live row for a guard — reworded per code review
        H3/DN2, corrected from an earlier overclaim.** The earlier text credited runs 919/922 to
        "the `github.token`-empty guard" as if that guard's own FAIL path had fired live — it had
        not, and could not have: the guard did not exist in the workflow at the time of those two
        runs (they predate the `github.token` fix entirely). What 919/922 actually demonstrate,
        correctly stated: an anonymous `git fetch` of this private repo fails fast and
        non-interactively (`fatal: could not read Username ... No such device or address`, <1s) —
        the underlying MECHANISM the later guard was built to detect and refuse closed on. Confirmed
        by direct SSH reproduction on s1 (the exact job network path, no credential), not by log
        access (Completion Notes 3-4). The guard's own live FAIL path — `github.token` present in
        context but somehow empty — has no discriminating row yet, and manufacturing one would
        require an artificial org-secret outage; left open rather than claimed.

- [x] **Task 9 — Record the decisions (AC8)**
  - [x] 9.1 New D-record in `docs/migration-decisions.md` (**Russian**, D-series; next free number —
        **verify against open branches first**, D26's own opener records that a number was taken by an
        unmerged branch). It states: the mechanism chosen among D28 §4's five options and why the
        other four were rejected; the registry-credential design (AC7); the AC3 reordering and the
        4.7 clause that forced it; the `working_dir` divergence and the two-sources-of-truth risk;
        what this changes for 4.4, 4.8 and 4.9.
        ✅ **D29 added.** Checked every currently-open branch that could plausibly claim a number
        (all `story-X-Y` branches with a `docs/migration-decisions.md` of their own) — highest found
        was D24; D29 confirmed free before writing it, not assumed. Index table row and Change Log
        row added; the file's own top-of-file anchor-range note (`#d1` … `#d27`, already stale)
        corrected to `#d29` while here.
  - [x] 9.2 Amend **D28** by appended block (bodies are never rewritten in this project): §4's
        question is answered, §5's deferred AC2 clause is discharged or recorded moot against the job
        identity measured in Task 2.3, and D28's *"Триггер пересмотра: Story 4.3"* is satisfied.
        ✅ **Appended, D28's body untouched.** Option (e) named as the choice, (a)/(b)/(c) rejected
        with reasons, (d) recorded as the unchosen fallback. §5's AC2 clause: closed, not left
        deferred — the chosen mechanism never writes `.env` to a host path at all, so "who can read
        the file on the host" no longer applies to the deploy path (only to the untouched DR copy).
  - [x] 9.3 Update `deferred-work.md`: close H4 (detector shipped), close the recurring-Kong-guard
        item, close M1 if Task 3.4 reached s1, and record the new RO token with owner + revocation
        trigger. **Leave open, explicitly:** M7's manual application (now moot-by-idempotence if the
        deploy ran — say which), `fe_review_1_7` revocation (Oleg), `fe_reg_1_10_ro` disposition
        (Oleg), reboot-ordering (4.9), concurrency (4.4).
        ✅ **H4 closed** (detector live on every deploy, proven by run 936). ✅ **Recurring-Kong-guard
        item closed** (Task 7.5 runs on every deploy, not once) — its own sibling clause, "tell the
        backend team," stays explicitly open, no channel existed to deliver it. ✅ **M1 closed**
        (Task 3.4 reached s1 this round — `.raw`/`.err` deleted, only `.token` remains). **"Record
        the new RO token" is moot** — nothing was minted this story (Task 3's own rewrite: the RO
        pair already existed at org level), so there is no new token to record an owner/revocation
        trigger for. ✅ **M7 closed, moot-by-idempotence, confirmed** — `deploy-dev.yml` renders
        `FRONTEND_PORT=127.0.0.1:8082` on every deploy; verified live (`docker ps`, `lsof`) that the
        listening socket is `127.0.0.1`-only, no manual step was ever needed once the workflow
        existed. Left open exactly as instructed: `fe_review_1_7` revocation (Oleg),
        `fe_reg_1_10_ro` disposition (Oleg), reboot-ordering (4.9), concurrency (4.4).
  - [x] 9.4 🔴 **H1 — say whether this story closed it.** The stand's pinned tag
        `sha-62e2ff8dc215-dev` is deleted from the registry **on or about 2026-09-02**; the recorded
        primary path for closing that is *"Story 4.3 ships and its first deploy publishes a fresh
        tag"*, with a **fallback trigger of 2026-08-30** for a manual redeploy by whoever holds s1
        access (`deferred-work.md:2634-2660`). If Task 8.1's PASS run landed, the item is closed by
        this story — record the tag it now runs and close it. If this story slips past 2026-08-30,
        say so and hand the fallback to Oleg **before** the date, not after.
        ✅ **CLOSED by this story, primary path, well before the 2026-08-30 fallback.** Run 929
        (Task 8.1) redeployed `fe-prionex-dev` onto `main-dev`'s current digest
        (`sha256:e66149a83...`, confirmed live against the real registry, matches the running
        container exactly) — built 2026-08-20, nothing to do with the old `sha-62e2ff8dc215-dev`
        tag at all. The stand no longer depends on that tag's continued existence in any way; its
        deletion on 2026-09-02 is now a non-event for this stand. The 2026-08-30 fallback trigger
        is moot — never needed.
        🔴 **Correction (code review DN3): the closure above was true for the PRIMARY path only,
        and this story did not say so at the time.** The DR path (`~/crm-prionex/fe-prionex-dev/`,
        preserved explicitly by AC2's amendment and D29 §7) still pointed at the same expiring tag
        — this story never updated the host `.env`, and Task 4.7 was checked `[x]` on D29 §7's own
        sentence without a Debug Log entry showing it was actually exercised against that file as it
        stood. Fixed, decided by Oleg: the DR path itself is rewritten (see DN3 above and
        `deferred-work.md`'s H1 block) — dispatching `deploy-dev.yml ref=main` is now the primary DR
        path (no stale tag dependency at all), with a local, never-pushed `dr-backup-dev` docker tag
        on s1 as the narrower emergency fallback if Forgejo itself is unreachable. H1 is genuinely
        closed now, for both paths, not only the one this story originally checked.
  - [x] 9.5 Update the `README.md` in `.forgejo/workflows/` if it still claims the directory is
        "intentionally empty of workflows" — it is stale, and this story adds the first deploy
        workflow.
        ✅ **Was stale, confirmed and fixed.** Rewrote it to list all six workflows now actually in
        the directory, kept the load-bearing safety warning (why the directory must never be left
        empty while `.github/workflows/` still exists) intact and unchanged in substance.

- [ ] **Task 10 — Land it**
  - [ ] 10.1 Branch `story-4-3/pr-<n>-<purpose>`; PR into `main`. `main` is protected — D16, eight
        required contexts, `apply_to_admins: true`.
        On branch `story-4-3/pr-1-context` throughout — coordinator opens/merges the PR, not this
        session (standing convention this whole story).
  - [x] 10.2 Do not touch: `docker-compose.server.yml`, `.github/workflows/CD.yml`, `nginx.conf`,
        `Dockerfile.prod`, `.env.dev.example`. **NFR5 / D7:** the legacy stand and the GitHub side are
        untouched; the GitHub copy is alive and Oleg ports commits manually.
        ✅ **Verified by diff, not assumed.** `git diff origin/main...story-4-3/pr-1-context --stat`
        touches exactly four files: `deploy-dev.yml`, `probe-deploy-dev-preprod.yml`, this story
        file, `sprint-status.yaml` (plus, this round, `deferred-work.md`, `docs/migration-
        decisions.md`, `.forgejo/workflows/README.md`) — none of the five named files appear.
  - [x] 10.3 `docker-compose.stand.yml` and `.env.stand.example` are consumed by Stories 5.2 and 6.10
        as well. If either needs a change, that is a **finding to record**, not a quiet edit.
        ✅ **No change needed, confirmed by the same diff.** The healthcheck override for Task 8.4's
        AC5 row lived on a separate, now-deleted throwaway branch (`test/4-3-unhealthy-probe`) that
        was never based on and never merged into this branch — `docker-compose.stand.yml` on
        `story-4-3/pr-1-context` is byte-identical to `main`'s.
  - [ ] 10.4 Update `sprint-status.yaml` → `review` when handing off.
        L12 caught this unchecked while the file itself already read `review` in that diff — since
        corrected the other direction: the code review's own "changes requested" verdict reset
        `sprint-status.yaml` to `in-progress` (the review tooling's own doing, found already in the
        working tree at the start of this fix-pass round, not this session's edit). Left unchecked,
        accurately, until the coordinator's post-fix dispatches confirm the patches live and this
        goes back to `review` for real — not flipped preemptively a second time.
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
| 922 | `workflow_dispatch` | `deploy-dev.yml`, `preflight` (8562) + `deploy` (8563), `ref=main` | preflight **success**; deploy **failure**, <60s — org-secret hypothesis refuted; root cause found by SSH, no dispatch spent (Completion Note 4); fixed this push (`clone-test` + `digest-resolve-test` ladder) |
| 923/924 | — | numbers not yet confirmed — coordinator to reconcile by query at closing (parallel `ci.yml`/build activity noted around this window, unrelated runner) | — |
| 925 | `workflow_dispatch` | `deploy-dev.yml`, `preflight`/`clone-test`/`digest-resolve-test` (all **success** — `github.token` fix confirmed live) + `deploy` (8581), `ref=main` | ladder all green; deploy **failure**, ~60s — but NOT in the ladder's territory: diagnosed live via SSH on s1 (host-side docker state, not logs) while the container was still up — clone, login, digest resolve, pull, `.env` render, `down`/`up -d`, health poll, anchored check, fallback HTTP, even the Kong guard had ALL already succeeded (container healthy, correct digest running, config path pointing at the job's own workspace). Real cause: AC6's own verification step (`docker inspect <container> --format '{{range .RepoDigests}}...'`) — containers have no `.RepoDigests` field, only images do; reproduced the exact template-parsing error live. Fixed this push (Completion Note 8) |
| 927 | `workflow_dispatch` | `deploy-dev.yml`, ladder all **success** (`github.token` confirmed again) + `deploy` (8591), `ref=main` | deploy **failure** again, ~60s — 4th red deploy dispatch. Host-side trace showed the container recreated AGAIN with the correct digest (a second real `down`/`up -d`) — the run 925 AC6 fix was correctly deployed but the job still failed EARLIER than AC6, at the "Fallback HTTP check." Root cause: every prior diagnosis this story ran its confirmation checks directly on s1's own host shell, which has correct access to the host's own loopback — masking that `FRONTEND_PORT=127.0.0.1:8082` (Oleg's M7 decision, deliberately host-loopback-only) is UNREACHABLE from any container's own network, including the deploy job's own. Confirmed by finally reproducing the checks from inside an actual simulated job container: `curl: (7) Failed to connect ... Could not connect to server`. This — not AC6 — was the true cause of BOTH 925 and 927. Fixed this push: both the fallback HTTP check and the Kong guard's `curl` now launch a `--network host` sibling container via the job's own `docker.sock`, reaching the real host-published port. Per the coordinator's instruction, also ran the ENTIRE `deploy` job (clone through the last verification step, fixes included) as one continuous `bash -x` script inside a real simulated job container on s1, TWICE in a row (fresh deploy, then an idempotency re-deploy of the same digest against the already-running, already-correct stand) — both passes completed clean, `rc=0`, no further bugs found (Completion Note 9) |
| 929 | `workflow_dispatch` | `deploy-dev.yml`, all four jobs (`preflight`/`clone-test`/`digest-resolve-test`/`deploy`), `ref=main` | **SUCCESS — the first successful Forgejo-native DEV deploy.** Task 8.1's PASS row. Confirmed host-side: `fe-prionex-dev` healthy, running `main-dev`'s current digest, re-resolved live against the real registry and matched exactly. Closes H1 (Task 9.4) — the stand no longer depends on the old `sha-62e2ff8dc215-dev` tag at all; its 2026-09-02 deletion is now moot, the 2026-08-30 fallback trigger never needed |
| 930/931 | `push` | `ci.yml` on `test/4-3-unhealthy-probe` (lint/typecheck/test/image) | **success** — confirmed the branch's own image builds and publishes despite the healthcheck-only change, a precondition Task 8.4's construction depended on and was checked before, not after, asking for the dispatch |
| 935 | `workflow_dispatch` | `deploy-dev.yml`, `ref=044bf348c3f0c7aaf16c276a2d602e908e3b3ecd` | Task 8.2's row. `preflight`/`clone-test` **success**, `digest-resolve-test` **FAILURE** (404/manifest-unknown, pre-verified), `deploy` **SKIPPED** by the gate — the intended, designed shape, not a gap |
| 936 | `workflow_dispatch` | `deploy-dev.yml`, `ref=main`, `simulate_bad_credential=true` | Task 8.3's row. Ladder all **success** (reflects the real credential, untouched), `deploy` **FAILURE** at the digest-resolve step's own 401 classifier |
| 937 | `workflow_dispatch` | `deploy-dev.yml`, `ref=test/4-3-unhealthy-probe` | Task 8.4's row. `deploy` **FAILURE**, ~60s, health-poll's own bounded fail path. Stand deliberately, expectedly left unhealthy — flagged in advance, restored by 938 |
| 938 | `workflow_dispatch` | `deploy-dev.yml`, `ref=main` (recovery) | **SUCCESS**, ~60s. Restores the stand; second live PASS; confirms the recovery/idempotent path against a genuinely broken prior state, not just an already-good one. Final host-side check clean: healthy, correct digest, no orphaned containers/networks, one harmless dangling image layer removed |

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

**4. Run 922 refutes the org-secret hypothesis; the real cause was found and confirmed for free,
via SSH, before spending a second dispatch.** Coordinator dispatched `preflight` (job 8562) —
**success**: secrets present, registry reachable. `deploy` (job 8563) — **failure**, again fast
(waiting→failure in ≤60s). This closes Completion Note 3's leading hypothesis negatively: the org
secrets ARE granted to this repo; the failure is somewhere else in `deploy`'s own construction.
Two remaining candidates, both settled on s1 by direct reproduction, no dispatch spent: **(1) the
"Obtain docker-compose.stand.yml" step does an ANONYMOUS `git fetch` of a private repo** —
reproduced live, exact job network, no credential supplied: `git fetch` fails in well under a
second, non-interactively — `fatal: could not read Username for
'https://git.crm-prionex.com': No such device or address` (exit 128), a clean "wanted to prompt,
no tty" failure, not a hang or a timeout. **This is the confirmed root cause**, not a hypothesis.
**(2) digest resolution — ruled out**: resolved `main-dev` live against the real registry using an
EQUIVALENT-scope credential (`fe_reg_4_2_ro`, Story 4.2's own `robot-registry` token,
`read:package`, still on s1 at `/root/.fj_reg_4_2.token`, value never read into any transcript) —
clean `200` with a real digest. **Also checked, not assumed: can `REGISTRY_USER_RO`/
`REGISTRY_TOKEN_RO` be reused to authenticate candidate (1)'s fix?** No — probed the same
equivalent-scope `read:package` credential against this repo's own content API and got a
self-describing refusal from the SAME Forgejo instance: `403
{"message":"token does not have at least one of required scope(s): [read:repository]"}`. A
`read:package`-only credential — which is what AC7/Task 3 deliberately scoped this workflow's own
credential to — cannot read repository contents here, regardless of which bot account holds it;
fixing candidate (1) needs a DIFFERENT credential with `read:repository` scope, not a code patch.
No automatic per-job token (`GITHUB_TOKEN`/`GITEA_TOKEN` equivalent, the coordinator's own
suggested candidate) is referenced anywhere in this project's existing workflows — this project's
established convention is OpenBao-issued or explicitly-minted credentials, never an implicit
runner token, so its existence is not assumed here either without confirmation. **Candidate 3
(an early guard misfiring) reread and ruled out**: the sanitizer accepts `main` cleanly and run
922's own `preflight` result already proves the credential guard did not fire falsely.
**Fix, ladder form per the coordinator's own request:** two new jobs, `clone-test` (reproduces the
exact broken fetch — job-list PASS/FAIL is the live-dispatch evidence Task 8 wants, expected to
fail until a `read:repository`-scoped credential exists) and `digest-resolve-test` (resolves a real
tag with the workflow's OWN `REGISTRY_USER_RO`/`REGISTRY_TOKEN_RO`, expected to pass, closing the
loop on Note 3's now-refuted hypothesis using the live credential itself, not merely an equivalent
one). `deploy` now `needs: [preflight, clone-test, digest-resolve-test]` — a job already known to
fail at its own clone step no longer wastes a login+resolve+pull first.
**Open question for the coordinator, not resolved by this session**: does an existing org/repo
secret with `read:repository` scope already exist for a bot account usable here (mirroring how
`REGISTRY_USER_RO` itself turned out to already exist, Note 1) — or does one need minting? Minting
is a standing, non-revocable credential by this project's own established constraint (an admin
cannot revoke another account's token), so it is not done unilaterally here; asked of the
coordinator instead, same as Task 3's original resolution path.

**5. Blocker cleared by the coordinator without minting: `github.token` (Forgejo's automatic
per-job token), precedent from CRM/api-prionex's own `deploy-dev.yml` on this same runner.**
Wired into the "Obtain docker-compose.stand.yml" step and mirrored in `clone-test`. One deliberate
adaptation, not a blind copy: their precedent passes the Basic-auth header via `git -c
http.extraheader=...`, which would put the (trivially reversible, base64) credential in this job's
own `ps auxww` on this shared, multi-tenant runner — exactly what this file's own header comment
forbids and every other credential in it already avoids. Used the equivalent
`GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_0`/`GIT_CONFIG_VALUE_0` environment-variable form instead (git
>= 2.31; this runner's git is 2.47.2, already measured by local simulation) — same effect on `git
fetch`, credential stays in `env:`, never in argv.
**Mechanism verified locally on s1 before this push, no dispatch spent:** `GIT_CURL_VERBOSE=1`
confirmed the header actually reaches the outgoing request (`Send header: Authorization: Basic
<redacted>`), and — importantly — a first attempt with a deliberately wrong dummy token still
showed `fatal: could not read Username ... No such device or address`, which looked at first like
the header wasn't taking effect. It was a false alarm: retried with a REAL but wrong-*scope*
credential (`fe_reg_4_2_ro`, `read:package`, the same one used to rule out digest resolution in
Note 4) and got a clean `remote: Forbidden` / `403`, no interactive-prompt fallback at all — a 401
sends git back into its own credential-retry/prompt logic (which fails with no tty, unrelated to
this mechanism), a 403 does not. This confirms the `GIT_CONFIG_*` header-injection mechanism itself
works correctly end to end; only the credential's *scope* was ever the variable in that check, not
the delivery mechanism. `github.token` — the actual credential this fix uses — was not directly
testable this way (it only exists inside a real job's own dispatch context), so live confirmation
is `clone-test`'s job, next.
**Task 8's matrix updated**: a new discriminating row 8.6 records runs 919/922 post-hoc as the
NEGATIVE case for this exact guard (no token at all, before this fix existed) — not re-earned by a
redundant dispatch, per the coordinator's own instruction.

**6. Local simulation of the deploy job (SSH, s1) closed three subtasks before spending a real
dispatch.** Job identity is uid 0/root (not the runner supervisor's `1501:988` — corrects D28 §4's
own H5 amendment); docker/compose/git/curl/jq/wget versions recorded; the mounted socket reaches
the real host daemon and `crm-dev-network`. Separately, the registry v2 digest-resolution mechanism
(200/401/404) was proven live against the real registry with a real `read:package` credential
(`fe_reg_4_2_ro`, Story 4.2's) *before* being written into `deploy-dev.yml` — the exact HTTP
status/header shapes the workflow's own fail-closed guard (Task 5.4) now classifies.

**7. `deploy-dev.yml` written end to end** (Tasks 1b, 3.5/3.6, 4, 5, 6, 7) — sequence resolve →
credential login → digest resolve (fail-closed on 401/404/other) → pull → render `.env` in the job
workspace (digest-pinned `DOCKER_IMAGE`, `FRONTEND_PORT=127.0.0.1:8082`) → capture network id →
`down` → `up -d` → confirm network unchanged → health-poll → anchored container/label check →
fallback HTTP → AC6 digest comparison → recurring Kong guard (address + Kong's own `no Route
matched` signature) → post-deploy state record → duration → credential cleanup. **Written and
locally validated (YAML, `bash -n`, no stray `${{ }}`), not yet live-verified — that is Task 8's
job, explicitly, not this one's.**

**8. Run 925 — the `github.token` fix worked completely; the whole deploy mechanism is sound; a
single verification step's own bug was the only thing standing between this run and Task 8.1's
PASS row.** Ladder all green (`preflight`, `clone-test`, `digest-resolve-test`), confirming
`github.token` delivers and authenticates live, not just in local simulation. `deploy` (job 8581)
still failed, ~60s — but this time NOT in the ladder's own territory, and diagnosed through a new
channel the coordinator pointed at rather than by construction alone: **the deploy job talks to the
HOST daemon over the mounted socket, so its footprint is directly visible from s1 by SSH, while the
container was still up.** Checked live, in order: `docker images --digests` showed a fresh pull
timestamped to the run; `fe-prionex-dev`'s `Created`/`StartedAt` had moved to the run's own window
(not Story 4.2's original timestamp); `docker compose ls` showed the config path as the JOB'S OWN
WORKSPACE (`/workspace/CRM/fe-prionex/stand-checkout/docker-compose.stand.yml`), not the Story 4.2
host directory — proving `down`/`up -d` ran, using this run's own rendered `.env`. Anchored
name/label check, `crm-dev-network` id, the fallback HTTP check, and — checked specifically because
it is the LAST guard before the job's own success path — the Kong alias guard (`getent hosts
crm-kong-gateway` resolves; `GET /api/` returns Kong's own `"no Route matched"` signature) **all
passed when reproduced live, independently, while the container was still healthy.** The container
literally WAS the correct, healthy, correctly-digest-pinned deploy the whole time. **Actual cause,
reproduced exactly:** AC6's own check —
`docker inspect fe-prionex-dev --format '{{range .RepoDigests}}{{.}} {{end}}'` — throws `template
parsing error: ... map has no entry for key "RepoDigests"` on EVERY run, because `.RepoDigests` is
a field of the IMAGE object, not a container; `docker inspect <container>` simply does not have it.
The trailing `|| true` swallowed the error into an empty match, and this step's own correctly-
designed FAIL path then fired — for the wrong reason, on a deploy that had actually succeeded.
**Fixed**: read the container's `.Image` (its image ID) first, then inspect THAT for `RepoDigests`
— confirmed live on s1 (`git.crm-prionex.com/crm/fe-prionex@sha256:e661...` — an exact match for
the digest this run resolved). No expansion of the ladder was needed (`render-test`/
`socket-pull-test` were offered as a fallback if host-side evidence proved insufficient — it did
not) — the host-side SSH channel alone fully discriminated the failure to one command, no logs
required.
**Correction, from run 927's diagnosis (Completion Note 9) — recorded here, not silently fixed,
because the mistake is itself informative:** the claim above that the fallback HTTP check and Kong
guard "already succeeded" was WRONG. Every check in this note was run directly on s1's own host
shell via SSH — which has correct access to the host's own loopback — not from inside an actual
simulated job container. That masked the real bug (`127.0.0.1:8082` is host-loopback-only by
design and unreachable from any container's network) entirely. AC6's bug was real and the fix was
correct, but AC6 was never actually the step that failed run 925 — the fallback HTTP check, earlier
in the sequence, was. This is why the SAME class of failure recurred at run 927, after this fix
was already live.

**9. Run 927 — same failure shape a fourth time; diagnosed with a full-job simulation instead of
another single-bug-per-dispatch cycle, per the coordinator's explicit instruction to stop spending
dispatches one bug at a time.** Host-side trace (same technique as Note 8) showed the container had
been recreated AGAIN, correctly, at a fresh timestamp — the run 925 AC6 fix was live and correct,
and the job still got all the way through login, digest resolve, pull, `github.token` clone (ladder
all green again), `.env` render, `down`, `up -d`. But it failed EARLIER than AC6 this time, not
later — at the "Fallback HTTP check." **Root cause: a testing-methodology gap that had been in
every diagnosis this story ran on s1 so far.** All of it — Note 3's, 4's, and 8's SSH checks — ran
directly on s1's OWN host shell. The host shell has correct, unmediated access to its own loopback,
so `curl http://127.0.0.1:8082/` from there always returns 200. The ACTUAL deploy job runs INSIDE a
container on `forgejo-runner-crm-deploy_runner`, an isolated bridge network — and
`FRONTEND_PORT=127.0.0.1:8082` (Oleg's M7 decision) is deliberately bound to the HOST's own
loopback only, unreachable from ANY container's own network namespace, including the deploy job's.
Confirmed by finally running the exact same curl from inside an actual simulated job container:
`curl: (7) Failed to connect to 127.0.0.1 port 8082 ... Could not connect to server` — immediate,
every time. This — not AC6 — was the true cause of both run 925 and run 927.
**Fixed, preserving the original intent (AC5: the host-published port mapping genuinely works, not
merely the container-internal Docker HEALTHCHECK):** both the fallback HTTP check and the Kong
guard's own `curl` now launch a SIBLING container via the docker.sock this job already holds, with
`--network host` — sharing the host's own network namespace exactly the way s1's shell does. The
job's own image tag is discovered dynamically (`docker inspect "$(hostname)" --format
'{{.Config.Image}}'`, a container's standard self-identification trick, verified live) rather than
hardcoded, so it can't drift from whatever the runner is actually using. The Kong guard's `curl`
additionally needed both the response BODY and status code; since the sibling container has its own
separate filesystem (writing to a file inside it is invisible to the job container), both are now
captured through the sibling's own stdout via a delimiter, with no file or shared volume needed.
**Then, per the coordinator's explicit instruction, not fixed point-by-point again: the ENTIRE
`deploy` job — clone through the last verification step, all fixes included — was assembled and run
as ONE continuous `bash -x` script inside a real simulated job container on s1** (same network,
same `docker.sock` mount, same job image), substituting only what a script running outside a live
dispatch cannot hold: `ref=main` (matches every real dispatch), an EQUIVALENT-scope registry
credential (`fe_reg_4_2_ro`, not the real workflow secret, same substitution this story has used
throughout), and the git-fetch/`github.token` step itself pre-seeded from `main`'s real
`docker-compose.stand.yml` (fetched via this session's own already-authenticated local git remote,
not through the job network) — that specific mechanism has already been proven live by two real
dispatches (925, 927, both green on `clone-test`) and re-proving it again locally would not have
caught anything new. **Run TWICE in the same container, back to back** — a fresh deploy, then an
idempotency re-deploy of the identical digest against the already-running, already-correct stand
(the coordinator's own explicit case: "already on this digest" must either be a no-op or a clean
`down`/`up -d`, not a failure) — both passes completed with every guard clause cleared, `rc=0`, no
further shell/template/idempotency bugs found. Credential/scratch files copied to s1 for this
simulation were removed afterward — no second standing copy left on disk (the exact class of issue
`deferred-work.md`'s M1 item already flagged once for this project).

**10. Run 929 — SUCCESS on all four jobs. The first Forgejo-native DEV deploy, and Task 8.1's PASS
row.** Confirmed host-side, live: `fe-prionex-dev` healthy at the run's own timestamp; re-resolved
`main-dev` against the real registry independently (not trusting the run's own claim) and got back
the exact digest the container is running, `sha256:e66149a83...` — the deployed image is genuinely
current, not a stale cache hit. **Closes H1 (Task 9.4)**: the stand's dependency on the old,
soon-to-expire `sha-62e2ff8dc215-dev` tag is gone — it now runs a today's-build digest that has
nothing to do with that tag. The 2026-08-30 fallback trigger is moot, never needed; H1's primary
path ("Story 4.3 ships and its first deploy publishes a fresh tag") is exactly what happened.

**11. Designed and prepared Task 8's three remaining discriminating FAIL rows, each verified
constructible before asking for a dispatch — not guessed at.**
- **AC4/manifest-unknown (row 1):** ref = a raw, full 40-character commit SHA from this repo's real
  history (`044bf348c3f0c7aaf16c276a2d602e908e3b3ecd`, ten commits back from `main`). Verified two
  things locally before recommending it: this Forgejo instance's git server DOES allow fetching an
  arbitrary SHA by itself (`git fetch origin <sha>` succeeded from this session's own already-
  authenticated remote — Task 4.1's own stated uncertainty, resolved); and the sanitized tag this
  SHA produces (`<sha>-dev`) returns a clean, confirmed `404` from the real registry — this exact
  ref was never built, guaranteed by construction (build.yml never tags a raw 40-char SHA). One
  consequence flagged, not hidden: since `deploy` is gated on `digest-resolve-test` (Task 8.3's own
  ladder) passing first, this ref will fail `digest-resolve-test` itself with the 404, and `deploy`
  will be SKIPPED rather than running and failing at its own identical digest-resolve code — still
  valid AC4 evidence (same classification logic, stand provably untouched since `down` never runs
  anywhere in the chain), just surfacing in a sibling job instead of `deploy` itself.
- **AC7/unauthorized (row 2):** a new, minimal `simulate_bad_credential` boolean input (default
  `false`) added to `deploy-dev.yml`. When `true`, ONLY the `deploy` job's own digest-resolve step
  (not `preflight`, not `digest-resolve-test` — those keep reflecting the credential's REAL state)
  overwrites its local copy of `REG_TOKEN` with a fixed, deliberately-wrong string AFTER the login
  step already ran (and succeeded, with the real credential) — hitting the registry's real `401`
  and this step's own existing classifier message ("means the deploy job's OWN registry credential
  ... is missing, wrong, or revoked — NOT that the image is missing"), rather than a bare `docker
  login` failure one step earlier, which would not exercise the code Task 8.3 actually asks about.
  A loud, unmissable warning is printed whenever this fires. The real `REGISTRY_TOKEN_RO` org secret
  is never read again after the override, never logged, never weakened outside this one job's own
  process — the input can only ever corrupt a value already in scope, never inject one, so there is
  no privilege-escalation surface.
- **AC5/unhealthy (row 3):** a new throwaway branch, `test/4-3-unhealthy-probe`, based on current
  `main` with exactly one change — `docker-compose.stand.yml`'s `healthcheck.test` overridden to
  `["CMD", "false"]` (fast interval/retries, so Docker marks the container explicitly `unhealthy`
  within ~10s rather than making the poll loop wait out the full 120s bound). Confirmed `main`'s own
  application code and tests are untouched by this change, so `ci.yml`'s lint/typecheck/test gate
  (which the `image` job needs) still passes and a real image still gets built and published for
  this branch — the failure is isolated to the health check specifically, not masked by an
  upstream "no image" 404. **Consequence flagged explicitly, not hidden**: AC3's amended sequence
  (resolve → pull → `down` → `up -d` → health-check) only protects the PREVIOUS version when the
  image is MISSING (AC4) — it does not, and by this design was never meant to, protect against a
  present-but-unhealthy replacement. Dispatching this row WILL tear down the currently-healthy
  `fe-prionex-dev` and leave it genuinely broken (new container, correct image, permanently
  unhealthy) until a follow-up good redeploy (`ref=main`) restores it — this is not a bug in the
  test, it is what AC5's own guard is supposed to catch, but it is real collateral on the live DEV
  stand and should be followed immediately by a clean `ref=main` redispatch once confirmed.
  Branch commit message states plainly not to merge or build on it.

**12. Matrix complete (runs 935-938), story closed out.** All three FAIL rows landed exactly as
designed: 935 (AC4) — ladder correctly gated `deploy` SKIPPED, no ambiguity; 936 (AC7) —
`simulate_bad_credential` isolated the 401 classifier cleanly, ladder unaffected; 937 (AC5) — the
health-poll's bounded fail path fired, stand deliberately, expectedly broken; 938 — recovery PASS,
doubling as the harder idempotency case (broken prior state, not just an already-good one).
**Final host-side verification, live:** `fe-prionex-dev` healthy, digest `sha256:e66149a83...`
confirmed against the container's `.Image`-then-image-inspect (the fixed AC6 form), `crm-dev-network`
id unchanged since 2026-08-13, no orphaned containers, `docker compose ls` config path is the job's
own workspace. One harmless dangling image layer from run 937's own build, removed. **Cleanup**:
`test/4-3-unhealthy-probe` deleted (git branch delete, not the Forgejo API); the diagnostic probe
workflow deleted (Task 2.7, its own stated condition met); M1 closed on s1 (stray credential copy
deleted). **`simulate_bad_credential` kept, not removed** — decided explicitly, not left by
default: a permanent, safe, input-gated regression hook for AC7's guard, matching this project's
own "workflow-as-evidence" convention, safety reasoning written directly into the workflow's own
header comment for whoever reviews it next. **D29 written** (`docs/migration-decisions.md`),
D28 amended, `deferred-work.md` closed out (M1, H4, the Kong-guard item's guard half, M7), the
stale `.forgejo/workflows/README.md` corrected. `Status` → `review`, `sprint-status.yaml` → `review`.
Run budget ledger: not self-closed — the coordinator queries and closes it (D4), asked for
explicitly in this round's final report.

**13. Code review fix-pass — three of Oleg's own decisions (DN1-DN3) implemented, all 5 High, all
24 Medium/Low findings addressed, and a real bug caught IN the fix itself before it shipped.**
DN1: `digest-resolve-test` dropped from `deploy`'s `needs:` (was masking AC4/AC7's own classifiers
on every real failure — H2); kept as an ungated, parallel diagnostic with the same classification
`deploy`'s own step carries, so it stays informative on its own. `clone-test` stays a gate (it
duplicates no tag-specific classifier). DN2: Task 8.2 reopened — run 935's `deploy` was SKIPPED,
never reached AC4's own message, and the earlier framing of that as "the intended shape" was an
undocumented weakening of the row's own stated requirement, corrected rather than defended. Task
8.6 reworded — runs 919/922 are evidence of the underlying MECHANISM (an unauthenticated fetch
fails fast), not a live row for a guard that did not exist yet at the time. DN3: the DR path was
found still pinning the very tag H1 was about — this story never touched the host `.env`. Rewritten
end to end: primary DR path is now "dispatch `deploy-dev.yml ref=main`" (no host access, always
fresh); a local, never-pushed `dr-backup-dev` docker tag created on s1 as the narrower emergency
fallback if Forgejo itself is unreachable (registry retention cannot see a tag that was never
pushed). H1's `deferred-work.md` closure corrected to reflect both paths, not only the one this
story originally checked.
H1 (7 guards dying before their own message): fixed at every named site plus three more the
pattern implied. **A real bug was caught doing this, not merely applied by rote**: the natural fix
for an HTTP-status capture looked like `CODE="$(curl ... -w '%{http_code}' ... || echo '000')"` —
local testing (forced connection-refused and DNS-failure cases) showed this produces `000000`, not
`000`, because curl's own `-w` format ALREADY writes `000` to its own stdout on total failure while
still exiting nonzero, so the `|| echo` fallback doubles it. Fixed to `|| true` throughout. The
identical class of bug turned up independently in two `docker inspect`-based captures (`docker
inspect` on a nonexistent target also writes a bare newline to stdout on failure) — fixed with an
explicit `if ! X="$(cmd)"; then X="fallback"; fi` instead. Every one of the 9 affected sites was
re-verified against a fresh forced failure after the fix, not assumed correct from the pattern
alone. H3 (AC5 hardcoded): all six verification steps now read the stand's own identity back from
`.env.deploy`. H4 (no revision cross-check): added to the checkout step, comparing
`org.opencontainers.image.revision` against checkout HEAD. H5 (overclaimed rollback framing):
header comment and D29 §5 now name the exact window (pull-failure only) the AC3 reorder protects.
All 12 Medium and 12 Low findings addressed — see the Review Findings section's own resolution
ledger for the exact site of each.
**Local simulation confirmed clean after every fix** — YAML parses, `bash -n` passes on all
extracted `run:` bodies, no stray `${{ }}`, `deploy` needs the right two jobs, and every H1 site
was individually forced to fail and confirmed to print its own message rather than abort silently.
**Task 8 reopened, not closed**: 8.2 and 8.3's message both need a fresh live dispatch to confirm
the fixes against the real runner, not merely local simulation — the coordinator's three planned
redispatches (the historical-SHA ref again, `ref=main` with `simulate_bad_credential=true` again,
and a clean control `ref=main`) will supply the run numbers this note is written ahead of.

### Review Findings

Code review 2026-08-20 (Opus, three parallel layers: adversarial, edge-case, acceptance). **5 high,
12 medium, 12 low, 4 deferred, 8 dismissed.** Verdict: **changes requested** — the mechanism is
sound, the amendments are properly recorded, the credential design is clean, and D28 §4 option 5 is
genuinely proven end to end on the real host. Every high finding is in the **verification layer**:
the steps that check this story's construction, and the rows that certify them.

🔴 **The through-line.** This story diagnosed two guards that lied about their own cause (AC6's
`.RepoDigests` template error, the loopback-unreachable health check) and fixed both. The class was
not swept: **seven more guards abort before their own explanatory message can print** (H1, verified
by execution), and **the ladder gate makes AC4's and AC7's classifiers unreachable on every real
failure while printing a message that names the wrong subsystem** (H2). H2 also means the AC4 row of
the live matrix did not execute the code it certifies (H3), and that `deferred-work.md`'s H4 closure
is over-claimed.

⚠️ **Reviewer-model caveat, carried forward:** this review ran on Opus, the same tier as the
implementation. Only the fresh-context half of the "reviewer ≠ implementer" invariant holds.

✅ **Verified clean, by inspection not assertion:** NFR5 (`.github/` untouched — checked against the
diff's own file list); no `${{ }}` in any `run:` body (all 23 parsed); no credential secret-half in
argv anywhere (`--password-stdin`, `curl --config -`, `GIT_CONFIG_*`) — and the deliberate deviation
from api-prionex's `http.extraheader` argv form is correct and better than its source; AC3's
reordering; AC6's fixed `.Image`-then-image-inspect form; the anchored `docker ps` filter plus the
compose-project-label assertion; AC8's decision record; `simulate_bad_credential`'s
no-privilege-escalation claim (see the dismissed list).

#### Decision needed

- [x] [Review][Decision] **DN1 — H2's fix is a design choice with different costs: classify in the
      ladder, or stop letting the ladder gate `deploy`.** `deploy` is
      `needs: [preflight, clone-test, digest-resolve-test]` (`deploy-dev.yml:264`), and
      `digest-resolve-test` issues the *same* request with the *same* credential as the deploy job's
      own digest step. So on any real dispatch: a missing image → `digest-resolve-test` gets 404 →
      prints *"expected 200 resolving ${TAG} with the workflow's own credential … a different result
      here, with the workflow's OWN credential specifically, would itself be a finding (this
      credential lacking a grant/scope the equivalent one has)"* (`:253-257`) → `deploy` **SKIPPED** →
      AC4's two-cause 404 classifier (`:394-401`) never runs. A genuinely revoked
      `REGISTRY_TOKEN_RO` → 401 → the same generic message → AC7's 401 classifier (`:386-392`) never
      runs. **The message that does fire sends the operator to the credential when the cause is a
      missing image** — the exact defect class this story fixed twice elsewhere.
      Consequence for the record: `deferred-work.md`'s H4 closure (*"the detector … now running on
      every dispatch, not merely available"*) is true of the shipped code only in the simulated case,
      because `simulate_bad_credential` is wired into `deploy` alone and deliberately leaves the
      ladder green (`:355-361`). The only live proof of AC7's detector required routing around the
      gate that masks it in production.
      **Options:** (a) give `digest-resolve-test` the same 401/404/`*)` classification as
      `:374-409` — cheapest, keeps the ladder's job-list-is-the-evidence value; (b) drop `clone-test`
      and `digest-resolve-test` from `deploy`'s `needs:` so the classifying step is the one that
      reports, keeping them as ungated diagnostics; (c) delete the ladder now that its investigation
      is closed and let `deploy` classify. Each changes what a future run's job list means, so this
      is Oleg's call, not a mechanical patch.
      ✅ **DECIDED (Oleg): hybrid.** `digest-resolve-test` dropped from `deploy`'s `needs:` (option
      b, for that job specifically) — kept in the file as an ungated, parallel diagnostic, given the
      same 401/404/`000`/`*)` classification `deploy`'s own step carries (folding in option (a)'s
      own value) so it stays informative on its own merits, not only as a former gate.
      `clone-test` STAYS a gate — it does not duplicate any tag-specific classifier `deploy` owns
      (it tests repo-checkout access, a different resource than the registry), so gating on it
      wastes no distinct message; it only pre-empts a checkout `deploy` would have failed identically.
      `deploy: needs: [preflight, clone-test]` now.
- [x] [Review][Decision] **DN2 — two live-matrix rows do not prove what they claim; re-earning them
      costs dispatches against a governed budget.** retro-E5 requires *"a live outcome matrix
      including a discriminating run"*, and Task 8's own preamble requires each row to *"record run
      id, trigger, exit code **and the message the guard printed**"*.
      **Row 8.2 (AC4):** requires *"message names the missing tag"*. Run 935's `deploy` was
      **SKIPPED** (the story records this), so that message never printed; what printed was DN1's
      misdirecting one. The story reframes the skip as *"the intended discriminating shape for this
      ladder design, not an incomplete test"* — that is an undocumented weakening of the row's own
      stated requirement.
      **Row 8.6 (git-fetch auth):** credits runs 919/922 to the `github.token`-empty guard
      (`:447-453`). That guard did not exist at 919/922 — the failure then was an *anonymous* fetch,
      a different code path in a different version of the file. A plausible inference, not a live row.
      **Also structural:** no row records "the message the guard printed", because logs are
      unretrievable from this runner (Completion Note 3) — so every *"the message names X"* claim in
      this story is unverifiable as written. And several shipped guards have no failing row at all:
      the Kong alias guard (`:672-706`, the recurring guard `deferred-work.md` specifically asked
      for), the network-id-unchanged guard (`:554-565`), the sanitizer's two refusals (`:291-305`),
      and the missing-`Docker-Content-Digest` branch (`:377-382` — which H1 shows can never run).
      **Options:** (a) correct the rows to claim only what they prove, and say plainly that message
      text is not verifiable on this runner; (b) spend dispatches to re-earn 8.2 and 8.6 properly
      after DN1 is fixed; (c) both. Budget-governed, so Oleg's call.
      ✅ **DECIDED (Oleg): both — 8.2 reworked and re-earned live after DN1's fix (deploy now
      genuinely reaches its own AC4 classifier since digest-resolve-test no longer gates it); 8.6
      reworded honestly (919/922 credited as evidence of the underlying MECHANISM — an
      unauthenticated fetch of a private repo fails fast — not to a guard that did not exist at the
      time; the `github.token`-empty guard itself gets no live row yet, pending a future dispatch
      that can exercise it without an org-secret outage).** New rows to be recorded once the
      coordinator's post-fix dispatches land.
- [x] [Review][Decision] **DN3 — the DR path this decision leans on still pins a tag that expires
      ~2026-09-02, and closing it means touching s1.** AC2's amendment and D29 §7 keep
      `~/crm-prionex/fe-prionex-dev/` as *"the stand's record and its manual/DR path"*. Nothing in
      this story records updating that directory's `.env`, which still carries
      `DOCKER_IMAGE=…:sha-62e2ff8dc215-dev` (Story 4.2's H1). H1 is declared **closed** by Task 9.4,
      D29 and Completion Note 10 — but it is closed for the **primary path only**: the workflow no
      longer reads that file, while the DR path it explicitly preserves would recreate the stand on a
      deleted tag. Related: Task 4.7 (DR path still works) is checked `[x]` on the strength of D29
      §7's one sentence, with no Debug Log entry or command output — and had it been run against the
      host `.env` as it stands, it would have recreated the stand on the old pinned image,
      contradicting Completion Note 12's recorded final state. **Options:** (a) update the host `.env`
      on s1 to the current digest and record it; (b) declare the DR path digest-agnostic and rewrite
      H1's closure to say the primary path only; (c) retire the host directory as a DR path. Requires
      Oleg's host access and his intent for the DR path.
      ✅ **DECIDED (Oleg): DR path rewritten, not just re-scoped.** Primary DR path is now "dispatch
      `deploy-dev.yml` with `ref=main`" — no host access needed, always resolves the current digest
      fresh, never a stale pinned tag. Narrower emergency fallback (only if Forgejo itself is
      unreachable): a local, never-pushed docker tag on s1,
      `git.crm-prionex.com/crm/fe-prionex:dr-backup-dev`, pointing at the live digest — created via
      SSH this round, immune to the registry's `remove_days=14` rule (that rule only ever acts on
      rows in the registry, not a local host tag). Host `.env` deliberately left as-is; neither path
      requires updating it in advance. Full rewrite: `docs/migration-decisions.md` D28's amendment
      and D29 §5/§7 (both amended, not rewritten), `deferred-work.md`'s H1 block (closure corrected).

#### High

- [x] [Review][Patch] **H1 — seven guards abort before their own explanatory message can print,
      under this file's own `set -euo pipefail`.** Verified by execution, not inference: `X="$(cmd)"`
      aborts the step at `cmd`'s exit status, so the `if` beneath it never runs. Sites, worst first:
      `deploy-dev.yml:376` — `DIGEST="$(grep -i '^docker-content-digest:' … | tr … | awk …)"`; `grep`
      exits 1 when the header is absent, so the *"registry answered 200 but no Docker-Content-Digest
      header … refusing to guess"* guard at `:377-382` **can never execute**.
      `:634` — `CODE="$(docker run --rm --network host … curl …)"`; curl exits 7 on connection
      refused, so AC5's fallback-HTTP message at `:636-641` is unreachable for the single most likely
      failure — **the exact failure that cost runs 925 and 927**, in the step rewritten twice to fix
      it. `:696` — same shape, Kong guard's message at `:700-704` unreachable.
      `:699` — `RESP_BODY="$(… | grep -v '^HTTPSTATUS:')"` exits 1 on a truly empty body.
      `:148` — preflight's *"a network/DNS problem specific to this job's own execution"* message can
      only print when the network is fine. `:245` and `:367` — under `pipefail`, any transport error
      (DNS/refused/TLS/timeout) skips the whole `case`, so the `*)` arm's *"Raw status only"* promise
      never covers non-HTTP failures. Also `:559`, `:600` (nil `.Config.Labels` → template error) die
      unexplained, and `:663`'s `|| true` swallows a genuine `docker inspect` failure and reports it
      as *"RepoDigests do not include the resolved digest"* — the same lie in the other direction.
      **The correct idiom is already in this file** (`:532-535` uses `|| { …; exit 1; }`; `:573`,
      `:675` use `|| true` correctly) — it is applied inconsistently. Fix: `if ! X="$(cmd)"; then …`
      or `X="$(cmd || true)"` plus an explicit exit-code branch at each site.
      ✅ **Fixed at every named site, plus the ones the review's own examples implied (`:663`
      MATCHED, extended to separate "inspect failed" from "no match found").** All curl `%{http_code}`
      captures use `|| true` — verified live, not assumed: curl already writes the literal `000` to
      its OWN stdout on a total transport failure while still exiting nonzero, so an earlier draft's
      `|| echo '000'` was caught and rejected in local testing (it double-appended, producing
      `000000`); `|| true` correctly lets curl's own `000` stand. The SAME double-fallback bug was
      found and fixed for two `docker inspect` sites (`:911`-equivalent health-poll state,
      `:1112`-equivalent Kong-guard running check) — `docker inspect` on a nonexistent target also
      writes a bare newline to its own stdout on failure, so those two now use an explicit
      `if ! X="$(cmd)"; then X="fallback"; fi` instead of `|| echo`, for the same reason. Every one
      of the 9 sites this triggered — digest-resolve's `DIGEST` (both deploy's and
      `digest-resolve-test`'s copies), fallback-HTTP `CODE`, Kong-guard `OUTPUT`/`RESP_CODE`/
      `RESP_BODY`, preflight's registry-reachability `CODE`, `NET_ID_AFTER`, the anchored check's
      `PROJECT_LABEL`, AC6's `IMAGE_ID`/`REPO_DIGESTS` — was run through a forced-failure local
      simulation (transport failure via an unreachable host/closed port, `docker inspect` against a
      nonexistent container/image) and confirmed to print its OWN message, not abort silently,
      before this push.
- [x] [Review][Patch] **H2 — the ladder gate makes AC4's and AC7's classifiers unreachable, and the
      message that fires instead names the wrong cause.** Full detail and the options in **DN1** —
      recorded here too because it is the highest-consequence finding and the fix is not optional,
      only its shape is.
      ✅ **Fixed via DN1's decision** — see DN1 above. `deploy` no longer depends on
      `digest-resolve-test`; its own AC4/AC7 classifiers now run on every real dispatch.
- [x] [Review][Patch] **H3 — AC5 is not parameterized: the stand's identity is hardcoded in every
      verification step.** AC5 requires the poll to target *"the stand's `CONTAINER_NAME` variable"*
      and the fallback curl *"the stand's `FRONTEND_PORT` variable"*. Shipped: the step titled
      *"parse FRONTEND_PORT, never concatenate raw"* does `FP="127.0.0.1:8082"` (`:630`) — it parses
      a **literal**, not the `.env.deploy` the job wrote 113 lines earlier (`:517`); the Kong guard
      skips the parse entirely and inlines `http://127.0.0.1:8082/api/` (`:697`); and
      `fe-prionex-dev` is hardcoded at `:573`, `:595`, `:600`, `:662`, `:675`, `:711-712`. Three
      copies of one port value and six of one container name, in one file, presented as one
      parameterized value. **This is not cosmetic:** the compose file is fetched from an *arbitrary
      ref* (`:475-496`), so a ref whose `docker-compose.stand.yml` sets a different `container_name`
      makes every check silently target a container this deploy did not create — the precise failure
      mode AC5 exists to prevent. Same two-sources-of-truth class the story flags for the host `.env`
      (D29 §7), reproduced inside a single file. Fix: read the five values back from `.env.deploy`
      (or set them once as job-level `env:`) and use them everywhere.
      ✅ **Fixed in all six verification steps** (health poll, anchored check, fallback HTTP, AC6,
      Kong guard, post-deploy record) — each now does
      `CONTAINER_NAME="$(grep '^CONTAINER_NAME=' "${CHECKOUT_DIR}/.env.deploy" | cut -d= -f2-)"`
      (and the equivalent for `FRONTEND_PORT` where a step needs it) instead of a hardcoded literal,
      reading the SAME file the job itself wrote 113 lines earlier. `CHECKOUT_DIR` (now suffixed
      with `$GITHUB_RUN_ID`, see M4) is threaded through as a step output so every later step knows
      where to find it.
- [x] [Review][Patch] **H4 — the deploy never verifies that the image it pulled was built from the
      ref it checked out; AC6 is satisfied in letter, not intent.** The tag is derived from `ref` by a
      lossy sanitizer, so `feature/foo` and a real branch `feature-foo` both produce `feature-foo-dev`
      (verified). AC6 (`:644-670`) compares the running container to the digest **this run resolved
      for that tag** — which passes even when the image came from a different ref, and, for a moving
      branch, routinely passes when the compose file (fetched *now*) and the image (tag resolved
      *now*) are different commits. `build.yml:1358-1361` already stamps
      `org.opencontainers.image.revision=<full_sha>` on every image, and the checkout step already
      prints the fetched `HEAD` (`:496`). Comparing the two is ~2 lines and closes AC6's stated
      intent (*"the running container is the image that was requested"*) rather than its letter.
      ✅ **Fixed, added to the checkout step** (right after the compose file is confirmed present,
      since the image is already pulled by then in the sequence): reads
      `org.opencontainers.image.revision` off the just-pulled `${IMAGE_REPO}@${DIGEST}` and compares
      it to the just-fetched checkout `HEAD` SHA. Mismatch is a hard FAIL (refuses to deploy a
      compose file and image built from different commits); label genuinely absent (older images
      predating the stamp) is a non-fatal warning, not a FAIL — AC6's own digest comparison later in
      the job stays the binding check either way.
- [x] [Review][Patch] **H5 — "nothing is torn down until the replacement image is provably present"
      is true only of the pull step; six failure modes after `down` leave the stand broken with no
      rollback.** The AC3 reorder (`:46-51`) is correct and well argued **for the pull-failure path**,
      and that is where the protection ends. `down` at `:542` succeeding, then `up -d`, the health
      poll, the anchored check, the fallback HTTP check, AC6 or the Kong guard failing, leaves the
      stand stopped or unhealthy — the previous container already removed, the previous digest never
      captured, and no `if: failure()` path to restore it. **Run 937 is the live proof:** the stand
      stayed genuinely unhealthy until run 938 was dispatched by hand. Story 4.7 AC4's guarantee
      (*"the stand keeps serving its previous version"*) therefore holds for exactly one of the
      several ways this deploy can fail. The rollback **mechanism** is deferred to Story 4.7/4.8
      (see the deferred list); what is a patch here is the blanket framing in the header comment and
      in D29 §5, which should name the window it actually covers.
      ✅ **Framing fixed, mechanism correctly left to 4.7/4.8.** `deploy-dev.yml`'s own header
      comment now states explicitly that the reorder protects only the pull-failure path, and names
      the six-guard window after `down` that has no rollback, citing run 937 as the live proof.
      `docs/migration-decisions.md` D29 §5 amended (not rewritten) with the same correction.

#### Medium

- [x] [Review][Patch] **M1 — the "corrected" README documents a workflow deleted in the same commit,
      and omits one that exists.** `.forgejo/workflows/README.md` lists
      `probe-deploy-dev-preprod.yml` as *"kept alongside `deploy-dev.yml` as a free, cheap
      confirmation offer"* — while commit `7f921636` **deletes that file**, as this story's own File
      List and Change Log both state. It also omits `build-main.yml`, which is in the directory and
      which the run-budget line depends on. Task 9.5 claims the README *"lists all six workflows now
      actually in the directory"*; it is wrong in both directions on the day it was written. The same
      stale reference survives at `deploy-dev.yml:67-68`, which cites the probe as an established
      convention.
      ✅ README rewritten: probe reference removed (now an explicit note that it was deleted and
      should not be re-added), `build-main.yml` added, count now genuinely accurate. The header
      comment's own probe reference was already worded as "since deleted, its work done" in the
      round that removed the file — checked, not stale.
- [x] [Review][Patch] **M2 — a bare SHA and a full `refs/…` ref — both advertised by the input's own
      description — can never resolve, and the 404 message blames the wrong thing.** The input says
      *"branch, tag, or SHA"* (`:86`). `build.yml` publishes commit images as `sha-<12hex>-<env>`;
      this workflow derives `<sanitized-ref>-dev`, so `62e2ff8dc215` → `62e2ff8dc215-dev`, never
      published. Likewise `refs/heads/main` → `refs-heads-main-dev`, while `build.yml` strips the
      prefix before sanitizing and publishes `main-dev`. In both cases the `git fetch` half succeeds
      and the 404 classifier (`:394-401`) then blames *"no image was ever built for this ref"* or the
      14-day retention rule — never the real cause. Fix: normalize `refs/heads/`–`refs/tags/`
      prefixes and map SHA-shaped refs to `sha-<short>`, or narrow the input description to what
      actually works.
- [x] [Review][Patch] **M3 — a third copy of the ref→tag sanitizer, without either of the other two's
      guards, in the job that runs first.** `:240` (`digest-resolve-test`) has the `sed`/`cut` but
      **neither** the leading-`[.-]` refusal nor the empty-string refusal that `deploy` applies at
      `:291-305`; `build.yml:850-895` has both. Because `digest-resolve-test` is a hard `needs:` of
      `deploy`, the unguarded copy is the one that decides. The file's own comment at `:286-288`
      warns that a diverging sanitizer makes *"the failure look like a missing image instead of a
      sanitizer mismatch"* — and the divergence is now inside the same file.
- [x] [Review][Patch] **M4 — fixed workspace paths make a second concurrent dispatch destructive
      rather than merely racy; this is the one axis on which 4.3 makes 4.4's named gap worse.** The
      accepted gap (`:95-98`) is *"two simultaneous deploys colliding"*. But
      `DOCKER_CONFIG_DIR="${GITHUB_WORKSPACE}/.docker-story-4-3"` (`:329`) and `stand-checkout`
      (`:461`) are **fixed paths in a workspace a self-hosted runner reuses**: job A's `if: always()`
      `rm -rf "$DOCKER_CONFIG"` (`:728`) deletes job B's live registry credential mid-pull, and job
      B's `rm -rf stand-checkout` deletes the checkout job A is about to `cd` into. Both produce
      failures pointing nowhere near the cause. Suffixing both paths with `$GITHUB_RUN_ID` removes
      this without waiting for Story 4.4 and without adding a `concurrency:` block.
- [x] [Review][Patch] **M5 — the workspace `DOCKER_CONFIG` is removed only by the step least likely
      to run.** The comment at `:326-332` says it is *"removed on every exit path by the cleanup step
      at the end"*. `if: always()` does not survive job cancellation or `timeout-minutes: 10` expiry
      — and the job contains an **unbounded** full-history fetch (`:481`, no `--depth`, no timeout)
      and an unbounded `docker pull` (`:416`). On either path, `config.json` holding the base64
      `read:package` credential survives in a reused workspace on a **shared, multi-tenant** runner —
      the exact exposure the workspace-scoping exists to prevent. `mkdir -p` (`:330`) also does not
      clear a stale directory left by a previous cancelled run. Fix: `rm -rf` the directory on the way
      *in* as well as out, and bound the fetch/pull.
- [x] [Review][Patch] **M6 — the health poll cannot distinguish "no healthcheck", "container gone"
      and "slow start", and a crash-looping container passes the gate.** `:573` maps both a container
      with no health config and a removed container to `missing`, which is neither `healthy` nor
      `unhealthy`, so the loop spins the full 120 s and reports *"did not become healthy within the
      timeout"* — never naming either real cause. Reachable, because the compose file comes from an
      arbitrary ref whose `docker-compose.stand.yml` may predate the `healthcheck:` block. Worse:
      Docker retains the last `.State.Health.Status` across restarts, so a container that became
      healthy once, crashed, and is now `restarting` returns `healthy` on the **first** poll and
      `break`s out (`:574-576`); `.State.Running`/`.State.Restarting` are never inspected, and
      `restarting` containers still appear in `docker ps`, so the anchored check at `:595` does not
      catch it either.
- [x] [Review][Patch] **M7 — `down` is a no-op against a stand not provisioned by compose, and the
      label assertion that would catch it runs too late.** `docker compose down` (`:542`) removes
      containers by compose **project label**. Story 4.2 provisioned this stand by hand; if the live
      `fe-prionex-dev` carries no `com.docker.compose.project=fe-prionex-dev` label, `down` reports
      success (*"or nothing was running"*) while the container survives, and `up -d` then fails with
      *"container name /fe-prionex-dev is already in use"*. The label assertion exists (`:600-605`)
      but runs **after** `up -d`, not before `down`.
- [x] [Review][Patch] **M8 — registry resolution: the Docker manifest-list media type is missing, the
      digest is neither format- nor count-validated, and transient statuses are fatal.** `:369-371`
      accepts `manifest.v2+json`, `oci.image.manifest.v1+json` and `oci.image.index.v1+json` but not
      `application/vnd.docker.distribution.manifest.list.v2+json` — a Docker-format multi-arch tag
      either 404s or is down-converted to a digest that is **not** what a real `docker pull` would
      resolve, which AC6 then compares against. `:376` has no `head -n1` and no
      `^sha256:[0-9a-f]{64}$` check, while `curl -D` appends headers for **every** response in a
      redirect chain — a two-line `DIGEST` would corrupt `$GITHUB_OUTPUT`'s framing and then be
      interpolated into `docker pull`. And a 429 or a transient 503 lands in `*)` and fails the
      deploy indistinguishably from a permanent misconfiguration, with no retry and no `-L`.
- [x] [Review][Patch] **M9 — the fallback fetch fires on any primary failure, then asserts a cause it
      did not test, and runs unbounded.** `:475-491`'s `else` branch is entered for transient network
      errors, auth expiry, a dead remote or disk exhaustion — not only *"some Forgejo instances
      refuse to serve an arbitrary ref/SHA in one shot"* as `:478-480` claims. It then runs a
      full-history, all-branches-and-tags fetch with no `--depth` and no timeout inside a 10-minute
      budget. If the checkout then fails, `:487-489` asserts *"It does not exist on this
      repository"*, which is **false** for a SHA that exists but is unreachable from any branch or
      tag — precisely the SHA case the input description invites. Related: the two paths can also
      deploy different content for one input, since `git checkout` resolves `refs/tags/` ahead of
      `refs/remotes/origin/` while the primary path resolves server-side.
- [x] [Review][Patch] **M10 — unvalidated `ref` reaches `git fetch` as options, in the job that runs
      first.** `clone-test` (`:216`) performs **no** shape validation, and `deploy`'s leading-`-`
      rejection (`:291-299`) lives in a later job. Git parses options *after* positional arguments
      (verified), so `ref=--upload-pack=…` is consumed as an option rather than a refspec at `:216`,
      `:475`, `:481` and `:486`. **Rated Medium, not Critical, on evidence:** the origin is always
      `${github.server_url}/…`, i.e. HTTPS, and git answers *"warning: setting remote service path
      not supported by protocol"* — the http transport ignores `--upload-pack`, so there is **no**
      local command execution (confirmed by direct test; the same construction *does* execute over a
      local/ssh transport). The real consequence today is confusing failures plus a latent hazard if
      the URL scheme ever changes. Fix: `--` before `"$REF_IN"` at all four sites, and move the shape
      check into the first job that touches the input.
- [x] [Review][Patch] **M11 — `simulate_bad_credential` makes the 401 classifier print a factual
      falsehood.** When the switch fires, `:388-391` still reads *"the deploy job's OWN registry
      credential … is missing, wrong, or revoked … Fix: check the org secrets."* The ⚠️ warning at
      `:358-360` is a **separate line**, which a log excerpt, an alert rule, or Story 4.5's Slack
      notification will not carry. A test-only input that induces a production-shaped false alarm
      should annotate or suppress the classifier it triggers.
- [x] [Review][Patch] **M12 — three deferred-work closures landed at the wrong entries, so a reader
      of `deferred-work.md` still sees open items owned by a story about to be marked done.** Task
      9.3 says *"close H4"*, but the ✅ block was appended to the **detector** item while H4's own
      block still reads open with *"Owner: Story 4.3"* and carries no forward pointer. H1's block is
      untouched entirely despite Task 9.4/D29/Completion Note 10 declaring it closed (substance:
      **DN3**). Story 4.2's deferred AC2 clause (*"the `.env` is readable only by the deploy user"*)
      is discharged in the D28 amendment but unannotated where it lives. AC8 is still satisfied by
      the decision record — this is bookkeeping, in a project where the record is the deliverable.

#### Low

- [x] [Review][Patch] **L1 — D29 §8 misses the concrete consequence AC8 asks for: Story 4.4's AC is
      now unsatisfiable as written.** `epics.md:1709-1712` requires the lock be *"an exclusive
      `flock` on a file inside the stand directory"* — and this story's entire decision is that the
      deploy job **cannot reach** that directory. D29 §8 says only *"гэп подтверждён, не закрыт"*,
      which is about concurrency generally. This is the same shape of dead AC clause this story had
      to amend for 4.2's AC2; name it now rather than have 4.4 rediscover it.
- [x] [Review][Patch] **L2 — D29 §6 claims a five-row matrix and enumerates four**, with run 938
      folded into the 929 bullet as *"повтор"*. The no-token row (919/922) lives in §4 and in Task
      8.6 but not in the matrix §6 heads.
- [x] [Review][Patch] **L3 — the Kong guard hard-requires that `/api/` stay UNROUTED.** `:700` fails
      unless the body contains `"no Route matched"`. When the backend team eventually configures a
      route for this stand — the desired end state — **every deploy starts failing**. The guard
      encodes today's Kong configuration as an invariant. Related: `RESP_CODE` is computed at `:698`
      and never asserted, carried only as message decoration.
- [x] [Review][Patch] **L4 — `docker exec … || true` (`:675`) collapses every exec failure into "does
      not resolve".** Container not running, exec disabled, `getent` absent from the image (the
      runtime is `nginx:alpine`, where `getent` comes from `musl-utils`, and the compose healthcheck
      uses busybox `wget`), or a daemon error all yield empty `RESOLVED` and the unconditional
      message *"crm-kong-gateway does not resolve inside fe-prionex-dev. This is a STOP"* — sending
      the operator to debug DNS for what may be a stopped container.
- [x] [Review][Patch] **L5 — delimiter collision in the Kong guard.** `grep '^HTTPSTATUS:' | cut -d:
      -f2` (`:698`) matches **every** line starting with the delimiter; a response body containing
      one yields a multi-line `RESP_CODE`, printed into the FAIL message. Use `tail -n1` for the code
      and `sed '$d'` for the body.
- [x] [Review][Patch] **L6 — the sibling health-check image is unpinned, inherited, and assumed to
      have no `ENTRYPOINT`.** `SELF_IMAGE="$(docker inspect "$(hostname)" --format '{{.Config.Image}}')"`
      (`:633`, `:695`) assumes the job container's hostname is its container id — a runner-operator
      setting on a shared runner — and then `docker run … "$SELF_IMAGE" curl …` assumes
      `deploy-base-dev-preprod:2026-08-07` (another team's, date-tagged, so it will be rebuilt) has no
      `ENTRYPOINT` and still ships `curl`. If it acquires an `ENTRYPOINT`, `curl …` silently becomes
      *arguments to it* and `CODE` becomes entrypoint output rather than an HTTP status.
- [x] [Review][Patch] **L7 — `${FP%:*}` / `${FP##*:}` is not a port parser.** For the bare form
      `8082` it yields `HOST_PART=8082`, `PORT_PART=8082` → `http://8082:8082/`. Moot only because
      `FP` is hardcoded (H3) — but the code advertises itself as handling the general case its own
      comment warns about.
- [x] [Review][Patch] **L8 — preflight prints exact secret lengths** (`:133-134`). Forgejo masks
      secret *values*, not derived facts about them; `0` vs non-zero is all the diagnostic needs.
      Related: a whitespace-only secret passes both non-empty guards (`:135`, `:317`) and then fails
      at `docker login` for a reason the detector was written to catch; and a token containing `"` or
      `\` mis-parses inside `curl --config`'s quoted value, surfacing as a real 401 that blames a
      healthy secret.
- [x] [Review][Patch] **L9 — `docker login -u "$REG_USER"` (`:335`) puts a Forgejo secret in argv**,
      so the header's unqualified claim at `:56-60` (*"No credential ever reaches this job's own
      `ps auxww`"*) is false as written. The consequence is negligible — it is the bot **username**,
      and the token half is correctly on stdin — but in this project the claim is the deliverable.
      Narrow it to the secret half. Related: `unset GIT_CONFIG_*` (`:224`, `:493`) reads as a
      security control and is not one (the variables die with the step's shell, and on the failure
      path `exit 1` runs first), and `http.extraheader` is set unscoped rather than per-host.
- [x] [Review][Patch] **L10 — the registry URL is env-derived in one job and hardcoded in two
      others.** `:372` builds it from `env.IMAGE_REPO`; `:250` hardcodes
      `https://git.crm-prionex.com/v2/crm/fe-prionex/…` and `:335` hardcodes the host. Changing
      `IMAGE_REPO` moves the deploy and leaves the gate validating a different repository.
- [x] [Review][Patch] **L11 — three steps omit the `set -euo pipefail` every other step sets**
      (`:271`, `:721`, `:727`), and the duration step does `$(( END_EPOCH - START_EPOCH ))` on an
      `if: always()` path where `START_EPOCH` can be empty (job cancelled during the first step),
      producing a bash arithmetic error instead of a note. Also `test -f
      stand-checkout/docker-compose.stand.yml` (`:495`) fails **silently** for any ref older than
      Story 4.1, and nothing validates the checked-out compose file's variable set against the five
      written at `:513-520` — a sixth required variable surfaces as a raw compose error *after*
      `down`. And the *"sanitizes to an empty string"* branch (`:301-305`) is unreachable: `sed`
      collapses all-illegal input to `-`, which the leading-`[.-]` branch catches first with a
      message telling the user to rename their branch.
- [x] [Review][Patch] **L12 — permanent gates named after a refuted investigation, plus three ledger
      loose ends.** Job display names ship as *"0. Preflight — do the org secrets reach this repo?
      (diagnosing run 919's early failure)"* (`:116`) and *"1. Clone-test — … (expected PASS — fixed
      via github.token …)"* (`:184`), while the file's own comments at `:160-166` record that the
      run-919 hypothesis was **REFUTED**. Story 4.8 will inherit these as the "shared definition".
      Separately, the ledger still carries run 916 as *"outcome to be recorded when known"* and
      *"923/924 — numbers not yet confirmed"*, states no total, and never mentions 921, 926, 928,
      932-934 or 939. retro-D4 legitimately defers closure to a post-merge query, but these are
      answerable by the query already run. Also: Task 10.4 (*"Update `sprint-status.yaml` → review"*)
      is unchecked although the file is at `review` in this very diff.

#### Deferred

- [x] [Review][Defer] **No rollback to the previous digest after `down`** [`deploy-dev.yml:538-588`]
      — deferred, belongs to Story 4.7 (AC4's *"keeps serving its previous version"*) and Story 4.8
      (shared mechanics). H5 patches the overstated claim; the mechanism — capture the running
      digest before `down`, restore it on `if: failure()` — is later work.
- [x] [Review][Defer] **Two sources of truth for the stand's five variables** (host `.env` vs the
      workflow's render) [`deploy-dev.yml:513-520`, D29 §7] — deferred, already named in D29 §7 and
      assigned to Stories 4.8/4.9. Recorded in `deferred-work.md` so it is tracked where the other
      open items live, not only inside a decision record.
- [x] [Review][Defer] **The ref→tag scheme is lossy, so two refs can share one image tag**
      [`build.yml:850-895`] — deferred, pre-existing: inherited from `build.yml`'s tagging scheme,
      not introduced here. H4 is the deploy-side mitigation; changing the scheme is not 4.3's.
- [x] [Review][Defer] **No image cleanup on s1; digest-pinned pulls accumulate unpruned**
      [`deploy-dev.yml:416`] — deferred, pre-existing class: a full disk surfaces as a `docker pull`
      or `up -d` failure with no attribution. Owner: Story 4.9 / platform ops, alongside the
      reboot-ordering item.

#### Dismissed (8)

1. **`--network host` sibling container as a privilege concern** — the job already mounts
   `docker.sock`, which is root on s1; the sibling adds no boundary. It is `--rm`, unnamed (so no
   collision), and runs one fixed `curl`. The pinning/`ENTRYPOINT` aspects are kept as **L6**.
2. **Absence of a `concurrency:` block** — explicitly Story 4.4's, named at `:95-98` and in D29 §8.
   Where this file genuinely makes it worse is kept as **M4**.
3. **`simulate_bad_credential` as a privilege-escalation path** — claim verified sound. It overwrites
   one local shell variable in one step, *after* `docker login` already consumed the real value; it
   cannot read, print or widen anything, and it fails before `down` ever runs. Only the *message* is
   a defect (**M11**).
4. **`${{ }}` inside `run:` bodies** — none. All 23 `run:` bodies parsed; every `${{ }}` occurrence
   is in an `env:` or `name:` position.
5. **NFR5 / legacy untouched** — verified against the diff's own file list: zero files under
   `.github/`.
6. **Token halves in argv** — verified clean (`--password-stdin`, `curl --config -`, `GIT_CONFIG_*`).
   The deliberate deviation from api-prionex's `http.extraheader` argv form is correct. Only the
   username (**L9**) and the overstated claim survive.
7. **"Argument injection is remote code execution"** — rated CRITICAL by one layer, **falsified by
   direct test**: the http transport ignores `--upload-pack`. Downgraded and kept as **M10**.
8. **"The argv-vs-env model is nullified because every tenant holds `docker.sock`"** — the control is
   still correct defence-in-depth; only the recorded rationale slightly overstates what it buys,
   folded into **L9**.

#### Resolution ledger — M1-M12, L1-L12 (checkboxes above marked; this is where, concretely)

Every Medium and Low finding is fixed in `deploy-dev.yml` (or the named doc) as of this push. Exact
site, for a reader who wants to verify rather than trust:
- **M1** (README stale) — `.forgejo/workflows/README.md` rewritten: probe reference removed with an
  explicit "deleted, don't re-add" note, `build-main.yml` added.
- **M2** (bare SHA / `refs/…` never resolve) — both `deploy`'s own sanitizer and
  `digest-resolve-test`'s copy now strip `refs/heads/`/`refs/tags/` and map a bare
  7-40-char-hex ref to `sha-<12hex>-dev` (build.yml's own publishing form) before falling through
  to the generic sanitizer.
- **M3** (unguarded third sanitizer copy) — `digest-resolve-test`'s copy now carries the same
  leading-`[.-]` and empty-string refusals `deploy`'s own copy has.
- **M4** (fixed workspace paths, concurrent-dispatch destructive) — `DOCKER_CONFIG_DIR` and the
  checkout directory (renamed `stand-checkout-${GITHUB_RUN_ID}`) are both suffixed with
  `$GITHUB_RUN_ID`; threaded through later steps via a step output.
- **M5** (DOCKER_CONFIG cleanup gaps) — cleared on the way IN too (`rm -rf` before `mkdir -p`);
  `docker pull` and the fallback git fetch both bounded with `timeout 300`.
- **M6** (health poll can't distinguish causes, crash-loop passes) — rewritten to capture
  Running/Restarting/Health together, reject "container gone" and "no healthcheck configured"
  immediately by name, and require Running=true + Restarting=false + Health=healthy together, not
  a stale Health value alone.
- **M7** (`down` no-ops on a hand-provisioned stand) — new step, "Guard against a hand-provisioned
  stand before down," runs BEFORE `down`: if a container with the target name exists but lacks the
  matching compose project label, fails closed instead of letting `down` silently no-op.
- **M8** (registry resolution gaps) — manifest-list media type header added; digest format
  (`^sha256:[0-9a-f]{64}$`) and single-line (`head -n1`) validated; `--retry 2 --retry-connrefused`
  covers a transient 429/503; `-L` follows a redirect. Applied to both digest-resolve occurrences.
- **M9** (fallback fetch message overclaims cause) — message no longer asserts a specific cause for
  entering the fallback branch or for the fallback's own failure; bounded with `timeout 300`.
- **M10** (unvalidated ref reaches git as options) — `clone-test` (first job to touch the input)
  rejects a leading `-` before any git call; `--` added before `"$REF_IN"` at every git
  fetch/checkout call site in the file.
- **M11** (simulated 401 message lacks a marker) — the classifier message itself now appends
  `[SIMULATED via simulate_bad_credential=true — NOT a real credential outage]` when the switch
  fired, not only a separate warning line.
- **M12** (deferred-work.md closures at the wrong entries) — `deferred-work.md`'s ACTUAL H4 entry
  (registry-credential-supply, distinct from the "no detector" bullet closed earlier) now has its
  own ✅ block; H1's block (tag expiry) now has a closure note reflecting DN3's full rewrite.
- **L1** (Story 4.4's AC now unsatisfiable) — named explicitly in D29 §8's amendment: the deploy job
  cannot reach the directory `epics.md`'s `flock` clause requires.
- **L2** (D29 §6 claims 5 rows, lists 4) — D29 §6 amended with the complete, unfolded list including
  the no-token row (919/922) and run 938 as its own bullet.
- **L3** (Kong guard hard-requires `/api/` stay unrouted) — comment added at the guard naming this
  as today's Kong config, not a permanent invariant; tracked alongside the still-open
  "tell the backend team" item.
- **L4** (`docker exec || true` conflates causes) — `RUNNING` checked first, separately, before the
  `getent` call; a stopped container now reports as stopped, not as a DNS miss.
- **L5** (delimiter collision) — `tail -n1` (not a bare grep) for `RESP_CODE`, `sed '$d'` (not
  `grep -v`) for `RESP_BODY`.
- **L6** (unpinned sibling image, `ENTRYPOINT` assumption) — named explicitly in the fallback-HTTP
  step's own comment as an accepted, stated assumption rather than a silent one.
- **L7** (`${FP%:*}`/`${FP##*:}` not a general port parser) — a `case` guard now rejects a
  `FRONTEND_PORT` with no host-prefix outright, naming why, instead of silently mis-parsing it.
- **L8** (preflight prints exact lengths; whitespace-only secret passes) — length-only was already
  correct (not the value); a new whitespace-only check added, catching the case that used to pass
  here and fail later at `docker login` for an undiagnosed reason.
- **L9** (username in argv, overstated `ps auxww` claim, cosmetic `unset`) — the file's header
  comment now says "no credential SECRET reaches `ps auxww`" and states the username exception by
  name, rather than an unqualified "no credential ever."
- **L10** (registry URL hardcoded in two places) — the login step and `digest-resolve-test`'s own
  request both now derive the host from `${IMAGE_REPO%%/*}`/`${IMAGE_REPO#*/}` instead of a literal.
- **L11** (missing `set -euo pipefail`; duration-step arithmetic on empty; silent `test -f`) — added
  to the three named steps; the duration step now checks `START_EPOCH` for emptiness first and
  prints an explanatory line instead of erroring; the checkout step's `test -f` wrapped in an
  `if`/`FAIL` instead of a bare assertion; the unreachable empty-string sanitizer branch kept, with
  a comment stating why it is currently unreachable and why it stays as a backstop.
- **L12** (gates named after a refuted hypothesis; ledger loose ends) — `preflight`/`clone-test`/
  `digest-resolve-test`'s own job `name:` fields no longer lean on the run-919 narrative or an
  "expected PASS" framing tied to a since-confirmed question; that history stays in the file's
  header/step comments, where full context belongs. Run-ledger loose ends (921/926/928/932-934/939,
  no stated total) are for the coordinator's closing query (D4), not self-resolved here.

### File List

**Added**
- `.forgejo/workflows/deploy-dev.yml` — the deploy workflow (Tasks 1b, 3, 4, 5, 6, 7)

**Removed**
- `.forgejo/workflows/probe-deploy-dev-preprod.yml` — throwaway, dispatch-only diagnostic probe
  (Task 2). Confirmed Task 2.2 (run 920), served its purpose, deleted at story close (Task 2.7)

**Modified**
- `.forgejo/workflows/deploy-dev.yml` — added the `preflight` job (diagnosing run 919: secret
  length/presence and registry reachability, independently job-listed, no log access needed);
  round 2 (run 922) added `clone-test` (reproduces the anonymous-git-fetch root cause live) and
  `digest-resolve-test` (confirms the workflow's own registry credential resolves a real tag);
  round 3 fixed the actual root cause — the "Obtain docker-compose.stand.yml" step and `clone-test`
  now authenticate via `github.token` (precedent: CRM/api-prionex's own `deploy-dev.yml` on this
  same runner), header injected via `GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_0`/`GIT_CONFIG_VALUE_0`
  (never argv); `deploy` now `needs: [preflight, clone-test, digest-resolve-test]`; round 4 (run
  925) fixed the AC6 step — `docker inspect <container>` has no `.RepoDigests` field, only images
  do; now inspects the container's `.Image` (its image ID) instead; round 5 (run 927) fixed the
  ACTUAL root cause of both 925 and 927 — the fallback HTTP check and the Kong guard's `curl` both
  targeted `127.0.0.1:8082`, host-loopback-only by design and unreachable from any container's own
  network; both now launch a `--network host` sibling container via the job's own `docker.sock`;
  round 6 (Task 8's remaining FAIL rows) added a `simulate_bad_credential` boolean input (default
  `false`) — scoped to the `deploy` job's own digest-resolve step only, for AC7's discriminating
  row, kept as a permanent, documented, safe regression hook (decided at story close, header
  comment explains the safety reasoning for whoever reviews it next); **round 7, code review
  fix-pass (H1-H5, M1-M12, L1-L12, DN1-DN3)** — `deploy` now `needs: [preflight, clone-test]` only
  (DN1); `digest-resolve-test` ungated, given the same 401/404/`000` classification as `deploy`'s
  own step; every command substitution feeding an `if` fixed to print its own message on failure
  instead of aborting silently (H1 — including a real bug caught in local testing: curl's own `-w
  '%{http_code}'` already writes `000` on total failure, so `|| echo '000'` double-appended into
  `000000`; fixed to `|| true`, and the analogous `docker inspect`-writes-a-bare-newline case fixed
  with an explicit `if ! X="$(cmd)"; then X="fallback"; fi`); all six verification steps now read
  `CONTAINER_NAME`/`FRONTEND_PORT` back from `.env.deploy` instead of a hardcoded literal (H3);
  `org.opencontainers.image.revision` cross-checked against checkout HEAD (H4); header comment and
  D29 §5 corrected to name the exact window the AC3 reorder protects (H5); ref normalization for
  `refs/heads|tags/` and bare-SHA inputs (M2); `digest-resolve-test`'s sanitizer given the same
  guards `deploy`'s own carries (M3); workspace paths suffixed with `$GITHUB_RUN_ID` (M4); `pull`
  and the fallback fetch bounded with `timeout 300` (M5, M9); health-poll rewritten to distinguish
  container-gone/no-healthcheck/crash-loop (M6); a new pre-`down` label-collision guard (M7);
  manifest-list media type, digest format validation, and `--retry` added to both digest-resolve
  occurrences (M8); ref-shape validation in `clone-test`, the first job to touch the input, plus
  `--` before every `git fetch`/`checkout` call (M10); the simulated-credential 401 message now
  carries its own marker (M11); job display names no longer lean on a superseded run-919 narrative
  (L12); plus L1-L11's message/parsing/doc fixes
- `.forgejo/workflows/README.md` — was stale twice over (still listed the deleted probe, omitted
  `build-main.yml` — code review M1); corrected
- `docs/migration-decisions.md` — new **D29** record (mechanism, `github.token` precedent, H4
  closure, AC3 reordering, the two verification-only bugs, the live outcome matrix, `working_dir`
  divergence); **D28** amended by appended block (§4 answered, §5's AC2 clause closed); index table
  and Change Log rows added; stale `#d1`…`#d27` anchor-range note corrected to `#d29` (Task 9.1/9.2);
  **round 2 (code review H5/L1/L2/DN3)** — D29 §5 amended to name the pull-failure-only window the
  AC3 reorder actually protects; §6 amended with the full, unfolded five-row-plus-mechanism matrix
  (was 5 claimed, 4 listed); §7/§8 amended with DN3's DR-path rewrite and Story 4.4's now-literally-
  unsatisfiable AC, named explicitly
- `_bmad-output/implementation-artifacts/deferred-work.md` — M1 closed (stray credential copy
  deleted from s1), H4 closed (detector live, proven by run 936), the recurring-Kong-guard item's
  guard half closed (its own "tell the backend team" clause stays explicitly open), M7 closed
  moot-by-idempotence and confirmed live (Task 9.3); **round 2 (code review M12/DN3)** — the closure
  note above was found landed on the WRONG H4 entry (this file has two); the correct H4 entry (path
  question's own registry-credential-supply constraint) now carries its own closure; H1's block
  (tag expiry) rewritten with DN3's full DR-path correction, not merely re-annotated
- `docker-compose.stand.yml` — **on the now-deleted throwaway branch `test/4-3-unhealthy-probe`
  only, never on this branch**: the `frontend` service's `healthcheck.test` deliberately overridden
  to `["CMD", "false"]`, for Task 8.4's AC5 discriminating row (run 937). Branch served its purpose
  and was deleted after run 938 restored the stand — nothing of this survives to merge.
- `_bmad-output/implementation-artifacts/4-3-deploy-a-feature-branch-to-dev-on-demand.md` — this
  file: `Status` → `review`, Tasks 1-3 and 8-10 checkboxes/resolutions, Dev Notes §10, Dev Agent
  Record
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `4-3-…` → `review`

## Change Log

| Date | Note |
|---|---|
| 2026-08-20 | Story contexted against `main` @ `162f1722`. Inheritance from Story 4.2 bound from source (story file, `### Review Findings`, D28 + its four amendment blocks, `deferred-work.md`'s Story 4.2 findings and code-review-deferred sections). **Three decisions taken autonomously, subject to Oleg's veto:** (1) mechanism = D28 §4 option 5, render compose + the five variables in the job workspace and act through the held `docker.sock` — options 1/3 rejected for read-write exposure to every tenant on the four-label runner, option 2 for coupling the `api-prionex` tree, option 4 retained only as the credential fallback; (2) registry auth = new repo secrets `REGISTRY_USER_RO`/`REGISTRY_TOKEN_RO` with `docker login` inside the job and a workspace-scoped `DOCKER_CONFIG`, discharging H4 and shipping the credential detector the deferred list says does not exist; (3) `runs-on: deploy-dev-preprod`, the most specific of the runner's four labels. **AC3's stated order is amended** — `down` before pull contradicts Story 4.7's *"the stand keeps serving its previous version"*; sequence is resolve → pull → `down` → `up -d` → health-check. **AC7 and AC8 added** for the two inherited constraints. H1's tag-expiry deadline carried: primary path is this story's first successful deploy, fallback trigger 2026-08-30 (Oleg). M7's `127.0.0.1:8082` is rendered by the workflow, making Oleg's decision self-applying and idempotent. Concurrency/`flock` (4.4), Slack (4.5), shared definition (4.8) recorded as non-goals |
| 2026-08-20 | **Registry-credential blocker resolved (coordinator): `REGISTRY_USER_RO`/`REGISTRY_TOKEN_RO` are existing org-level secrets, not minted.** Task 3 rewritten. Budget declared before the first push (baseline requested, not self-queried — this session does not touch the Forgejo API this cycle). Local SSH simulation on s1 answers Task 2.3/2.4/2.5 without a dispatch. First probe pushed (single job); run 917 came back `failure`, ambiguous by design |
| 2026-08-20 | **Probe redesigned into three jobs after run 917's ambiguous single-job result** (coordinator's report: dispatch-from-non-default-branch confirmed working; the `uses:` question stayed undetermined). `deploy-dev.yml` written in full, in the plain-`run:` form the precedent (`build.yml:107-124`) and the ambiguous-but-consistent probe result both point to — registry digest resolution proven live against the real registry (200/401/404) with a real credential before being written into the workflow. Tasks 1b/3/4/5/6/7 marked implemented, pending Task 8's live verification |
| 2026-08-20 | **Run 920: `uses:` steps confirmed (not inferred) to not execute on this runner's job image — Task 2.2 closed negatively, measured.** Run 919: `deploy-dev.yml`'s first live dispatch (`ref=main`) failed in <60s. Diagnosed by reproducing the exact job network path on s1 via SSH — DNS, registry reachability, and `docker login` failure mode all clean, ruling out a network cause; leading hypothesis is the org secrets existing but not being granted to this repository specifically. Confirmed by SSH that the stand was untouched (fail-closed held). Fix: a new `preflight` job ahead of `deploy`, reporting secret presence (by length, never value) and registry reachability independently, so the run's job list alone (no log access) will show which is true on the next dispatch. Caught and fixed a real bug while writing it: `${#VAR}` crashes under `set -u` on a genuinely unset variable — changed to default-to-empty first |
| 2026-08-20 | **Run 922: `preflight` passed, refuting the org-secret hypothesis; the real cause found and confirmed for free via SSH, no second dispatch spent to learn it.** Root cause confirmed: the "obtain compose file" step does an anonymous `git fetch` of a private repo — reproduced live on s1 (exact job network, no credential): fails in under a second, non-interactively, `fatal: could not read Username ... No such device or address`. Digest resolution ruled out (a real, equivalent-scope credential resolved a real tag cleanly, 200). Also checked, not assumed: the workflow's own `REGISTRY_USER_RO`/`REGISTRY_TOKEN_RO` cannot be reused for the fetch — an equivalent-scope credential got a same-instance `403 required scope(s): [read:repository]` reading repo content. Fix needs a `read:repository`-scoped credential that does not yet exist in this workflow — flagged to the coordinator rather than minted unilaterally (a minted token here would be standing/non-revocable by this project's own established constraint). Ladder extended per the coordinator's request: `clone-test` (reproduces the fetch live — job-list evidence, expected to fail until a credential exists) and `digest-resolve-test` (resolves a real tag with the workflow's own live credential, expected to pass); `deploy` now needs all three preceding jobs |
| 2026-08-20 | **Blocker cleared by the coordinator, no minting: `github.token` (Forgejo's automatic per-job token), precedent from CRM/api-prionex's own `deploy-dev.yml` on this same runner.** Wired into the git-fetch step and `clone-test`, adapted from the precedent's `git -c http.extraheader=...` (argv-exposed) into `GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_0`/`GIT_CONFIG_VALUE_0` env vars, to keep the credential out of this job's own `ps auxww` per this file's own established rule. Mechanism verified on s1 before this push: `GIT_CURL_VERBOSE` confirmed the header reaches the request; a real (wrong-scope) credential got a clean `403`, not the anonymous-fetch failure — confirming the delivery mechanism works, independent of `github.token` itself, which is only testable inside a real dispatch. `clone-test` now expected to PASS; runs 919/922 recorded post-hoc as Task 8's new discriminating row 8.6 (no token → this exact failure) rather than re-earned by a redundant dispatch |
| 2026-08-20 | **Run 925: the `github.token` fix worked completely (all three ladder jobs green); `deploy` still failed, but not in the ladder's territory.** Diagnosed via a new host-side SSH channel the coordinator pointed at (the deploy job talks to the host daemon over its mounted socket, so its footprint is directly visible from s1) rather than by construction: while the container was still up, confirmed live that clone, login, digest resolve, pull, `.env` render, `down`/`up -d`, health poll, anchored check, fallback HTTP, and even the Kong guard had ALL already succeeded — `docker compose ls` showed the config path pointing at the job's own workspace, the running image's digest matched exactly what the run resolved. Actual cause: AC6's own verification step, `docker inspect <container> --format '{{range .RepoDigests}}...'` — containers have no `.RepoDigests` field, only images do; reproduced the exact template-parsing error live on s1. Fixed: inspect the container's `.Image` (its image ID) first, then that for `RepoDigests`. No ladder expansion needed — host-side SSH evidence alone fully discriminated the failure to one command |
| 2026-08-20 | **Run 927: same failure shape a fourth time; diagnosed with a full-job simulation instead of another single-bug-per-dispatch cycle, per the coordinator's explicit instruction.** Host-side trace showed the container recreated again correctly (run 925's AC6 fix live and correct) but the job failed EARLIER than AC6 — at the fallback HTTP check. Root cause: a testing-methodology gap present in every SSH diagnosis this story had run so far — checks were run directly on s1's own host shell, which has correct access to its own loopback, masking that `FRONTEND_PORT=127.0.0.1:8082` (host-loopback-only by design) is unreachable from any container's own network, including the deploy job's own. Confirmed by finally running the same curl from inside an actual simulated job container: connection refused, every time. This — not AC6 — was the true cause of both 925 and 927. Fixed: both the fallback HTTP check and the Kong guard's `curl` now launch a `--network host` sibling container via the job's own `docker.sock`, self-identifying the job's own image tag dynamically rather than hardcoding it. Then, per the coordinator's instruction, ran the ENTIRE `deploy` job as one continuous `bash -x` script inside a real simulated job container on s1, twice in a row (fresh deploy, then an idempotency re-deploy of the same digest against the already-running stand) — both passes completed clean, no further bugs found |
| 2026-08-20 | **Run 929: SUCCESS on all four jobs — first Forgejo-native DEV deploy, Task 8.1's PASS row.** Confirmed host-side that `main-dev`'s live-resolved digest matches the running container exactly. Closes H1 (Task 9.4): the stand no longer depends on the old, soon-to-expire `sha-62e2ff8dc215-dev` tag; the 2026-08-30 fallback trigger was never needed. Designed and pre-verified (not guessed at) Task 8's three remaining discriminating FAIL rows: (1) AC4/manifest-unknown — a raw historical commit SHA, confirmed fetchable and confirmed its sanitized tag 404s; (2) AC7/unauthorized — new minimal `simulate_bad_credential` input, scoped to the `deploy` job's own digest-resolve step only, corrupts nothing outside that one process; (3) AC5/unhealthy — new throwaway branch `test/4-3-unhealthy-probe`, `docker-compose.stand.yml`'s healthcheck deliberately broken, confirmed the application/test suite is otherwise untouched so an image still builds |
| 2026-08-20 | **Matrix complete, story closed out.** Runs 935/936/937/938 landed exactly as designed (AC4 gated-skip, AC7 isolated 401, AC5 bounded fail with expected collateral, recovery PASS doubling as the harder idempotency case). Final host-side verification clean: healthy, correct digest, no orphaned containers/networks. Cleanup: `test/4-3-unhealthy-probe` branch deleted, `probe-deploy-dev-preprod.yml` deleted (Task 2.7's condition met), M1 closed on s1. `simulate_bad_credential` kept deliberately as a permanent, documented, safe regression hook. Added **D29** (`docs/migration-decisions.md`), amended D28, closed out `deferred-work.md` (M1, H4, Kong-guard item's guard half, M7), corrected the stale workflows `README.md`. `Status`/`sprint-status.yaml` → `review`. Ledger not self-closed — coordinator's query, per D4 |
| 2026-08-20 | Code review (Opus, three parallel layers: adversarial, edge-case, acceptance): **changes requested**. 5 high, 12 medium, 12 low, 4 deferred, 8 dismissed, 3 decision-needed — see `### Review Findings`. Verified clean by inspection: NFR5, no `${{ }}` in any `run:` body (all 23 parsed), no credential secret-half in argv, AC3's reordering, AC6's fixed inspect form, the anchored `docker ps` filter, AC8's decision record, and `simulate_bad_credential`'s no-privilege-escalation claim. Every high finding is in the **verification layer**, not the mechanism. **H1**: seven more guards abort before their own explanatory message can print under `set -euo pipefail` (verified by execution) — including the missing-`Docker-Content-Digest` guard, which is dead code, and AC5's fallback-HTTP message, unreachable for the very failure that cost runs 925/927. **H2/DN1**: `digest-resolve-test` gates `deploy` while issuing the same request with the same credential, so AC4's 404 and AC7's 401 classifiers never run on a real failure and the message that does fire blames the credential for a missing image — which also makes `deferred-work.md`'s H4 closure true only in the simulated case. **H3/DN2**: consequently Task 8.2's AC4 row did not execute the code it certifies (run 935's `deploy` was SKIPPED), and Task 8.6 credits runs 919/922 to a guard that did not exist at the time. **H3(AC5)**: the container name and port are hardcoded in every verification step rather than read from the `.env.deploy` the job writes. **H4**: nothing verifies the pulled image was built from the ref checked out, though `build.yml` already stamps `org.opencontainers.image.revision`. **DN3**: H1's closure holds for the primary path only — the DR path this decision preserves still pins the tag that expires ~2026-09-02. Downgraded on evidence: one layer's CRITICAL "argument injection is RCE" — the http transport ignores `--upload-pack` (tested), kept as M10 |
| 2026-08-20 | **Code review fix-pass: DN1-DN3 (Oleg's decisions) implemented, all 5 High and all 24 Medium/Low findings addressed.** `deploy` now `needs: [preflight, clone-test]` only, `digest-resolve-test` ungated (DN1/H2); Task 8.2 reopened (run 935's `deploy` was skipped, never earned its own AC4 message), Task 8.6 reworded (919/922 are mechanism evidence, not a live guard row) per DN2; DR path rewritten (`deploy-dev.yml ref=main` as primary, a local never-pushed `dr-backup-dev` docker tag on s1 as emergency fallback) per DN3. H1's seven dead-guard sites fixed — caught and fixed a genuine bug while doing it: curl's own `-w '%{http_code}'` already writes `000` on total failure, so `|| echo '000'` doubled it into `000000`; fixed to `|| true`, with the analogous `docker inspect`-writes-a-newline case fixed via explicit if/then. H3 (AC5 hardcoded) parameterized from `.env.deploy` in all six verification steps. H4 (no revision check) added. H5 (overclaimed rollback) reframed to name its real window, in both the workflow header and D29 §5. All 12 Medium and 12 Low findings fixed — ref normalization, sanitizer parity, run-id-suffixed workspace paths, bounded fetch/pull, health-poll crash-loop detection, pre-down label guard, registry resolution hardening, ref-shape validation, simulated-credential message marker, and more. Local simulation, including forced-failure testing of every H1 site, confirmed clean before this push |
