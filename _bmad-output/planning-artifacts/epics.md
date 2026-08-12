---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - docs/forgejo-migration.md
  - .github/workflows/CI.yml
  - .github/workflows/CD.yml
  - Dockerfile.prod
  - docker-compose.server.yml
  - nginx.conf
  - README.md
decisions:
  blocker_1_1: 'Option C — migrate as-is, rebuild per environment; artifact promotion deferred as tech debt'
  scope: 'Phases 0-8 in full'
---

# fe-prionex Forgejo CI/CD Migration - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for the migration of the
`fe-prionex` frontend delivery pipeline from GitHub Actions to Forgejo Actions,
decomposing the requirements from `docs/forgejo-migration.md` (which serves as both PRD
and Architecture for this infrastructure effort) into implementable stories.

**Target topology:** s1 — DEV + PRE-PROD, s2 — PROD.
**Hard constraint:** existing DEV and PROD stands must not be touched during migration;
the new pipeline is built in parallel and switched over only at the final step.

**External dependency: the GitHub transition (recorded 2026-08-07).** No action of any kind is
taken on GitHub by this plan — not on its workflows, settings, secrets, or credentials. GitHub
is left running exactly as it is today. Moving delivery and content across to Forgejo is owned
by Oleg and tracked outside this plan.

Two consequences the plan depends on and cannot itself guarantee:

- **Forgejo must hold current code.** Epics 2-6 build CI, image builds and deploys on Forgejo,
  so they test and ship whatever Forgejo holds. Forgejo currently lags GitHub — `development`
  is at `372ee2c4` there versus `405db726` on GitHub as of 2026-08-07. Until the transition
  happens, a Forgejo pipeline may be exercising code that is not what the team is actually
  writing.
- **Two pipelines can reach production.** The legacy GitHub CD deploys to s2 on a merge to
  `main` and is not disabled (Story 6.1, cancelled). From the moment Forgejo can also deploy
  to s2, concurrent deploys from two independent pipelines are possible.

Both are accepted risk for the duration, not solved problems.

**Locked decision (Blocker 1.1 = Option C):** the application is migrated as-is. Vite
environment variables stay baked in at build time, so a distinct image is built per
environment. Artifact promotion PRE-PROD → PROD is **not** achieved in this migration and
is recorded as explicit technical debt. Every requirement below that would have depended
on a single promotable artifact is adjusted accordingly and marked `[C]`.

## Requirements Inventory

### Functional Requirements

**CI (Phase 3)**

FR1: A Forgejo workflow `.forgejo/workflows/ci.yml` runs four independent jobs — `lint`
(`npm run lint` + `npm run format:check`), `typecheck` (`npm run typecheck`), `test`
(`npm run test:run`), `build` (`npm run build`) — on the `node-20` runner label.

FR2: CI triggers on `pull_request` targeting `main` and on `push` to feature branches.

FR3: CI publishes the coverage report as a workflow artifact; the `codecov` upload step is
removed entirely.

FR4: Direct pushes to `main` are rejected; merging into `main` requires passing Forgejo
status checks.

**Image build and registry (Phases 2, 4)**

FR5: A Forgejo workflow `.forgejo/workflows/build.yml` runs on the `docker-build` runner
label and builds/pushes the image to `git.crm-prionex.com/crm/fe-prionex`.

FR6: The build workflow triggers on push to any branch (including feature branches), push
to `main`, and tag `v*`, plus `workflow_dispatch` with a `ref` input.

FR7: Tagging scheme — `sha-<short>` on every build, `<branch>`, semver tags from `v*`, and
`latest` only from `main`.

FR8: `[C]` The build workflow takes a target environment (`dev` / `preprod` / `prod`) and
injects `VITE_API_BASE_URL` and `VITE_WS_URL` as `--build-arg` per environment. Images for
different environments built from the same commit are distinct and must carry an
environment discriminator in the tag (e.g. `sha-<short>-dev`).

FR9: Build cache uses `type=registry,ref=<registry>/fe-prionex:buildcache` instead of
`type=gha`.

FR10: The Forgejo Container Registry is enabled, a `ci-bot` technical user holds a
`write:package` token, and s1/s2 hold `read:package` tokens only.

FR11: Registry retention removes `<branch>` tags after 14 days while guaranteeing that
tags currently referenced by a running stand — and the previous N rollback targets — are
never deleted.

**Deployment (Phases 5, 6, 7)**

FR12: `deploy-dev.yml` triggers on `workflow_dispatch` with a `ref` input; any developer
may deploy any feature branch to DEV without approval.

FR13: `deploy-preprod.yml` triggers **only** on `workflow_dispatch` with a mandatory
`image_tag` input; no automatic triggers exist.

FR14: After a successful PRE-PROD deploy the workflow retags the image in the registry as
`preprod-current` and `preprod-<sha>` via `docker buildx imagetools create`, making the
registry the single source of truth for release history.

FR15: `deploy-prod.yml` triggers on `workflow_dispatch` with an `image_tag` input and an
optional `rollback: bool` input.

FR16: `[C]` The promotion guard checks that the **commit SHA** encoded in `image_tag` has a
corresponding `preprod-<sha>` tag in the registry — i.e. that this commit was validated on
PRE-PROD. It cannot assert image identity, because under Option C the PROD image is rebuilt
and is byte-different from the PRE-PROD image. The guard is skipped when `rollback: true`.

FR17: `[C]` `deploy-prod.yml` rebuilds the image with production build-args before
deploying (no pure `docker pull` promotion). On `rollback: true` it pulls an existing
previously deployed prod tag without rebuilding.

FR18: After a successful PROD deploy the workflow retags the deployed image as
`prod-current` in the registry.

FR19: **AMENDED (2026-08-11, `sprint-change-proposal-2026-08-11-deploy-runner.md`).** All deploy
workflows run on a deploy runner located on the target host and follow the sequence: place the
compose file in the stand directory → `docker compose down` → `docker pull` (fail-fast, **no**
fallback to `:latest`) → `docker compose up -d` → health check. **No step connects to the host
over SSH.** ~~All deploy workflows follow the sequence: scp compose file → …~~

FR20: The health check polls `docker inspect -f '{{.State.Health.Status}}'` against a
**parameterized** container name, with a fallback `curl` against the **parameterized**
published port.

FR21: A post-PROD-deploy smoke check verifies availability, container health, critical
paths via `curl`, and the absence of ERROR entries in the last 5 minutes of logs.

FR22: Slack start / success / failure notifications are sent via `curl` to the incoming
webhook, replacing `slackapi/slack-github-action`.

FR23: `dev-reset.yml` runs on a Sunday `schedule`, deploys `main` to DEV, and runs
`docker image prune`.

FR24: Rollback is performed by running `deploy-prod.yml` with a previous `image_tag` and
`rollback: true`.

**Infrastructure and coexistence (Phases 1, 2, 5, 6)**

FR25: `docker-compose.server.yml` is parameterized — `COMPOSE_PROJECT_NAME`,
`CONTAINER_NAME`, `FRONTEND_PORT` — so DEV (`8082`) and PRE-PROD (`8081`) coexist on s1
alongside the untouched legacy stand.

FR26: Stand directories are separated: `~/crm-prionex/fe-prionex-dev/` and
`~/crm-prionex/fe-prionex-preprod/`.

FR27: PRE-PROD runs on its own Docker network (`crm-network-preprod`) with its own Kong
gateway, so `crm-kong-gateway` name resolution cannot leak the PRE-PROD frontend onto the
DEV backend.

FR28: A Forgejo runner is registered at the `CRM` organization level with two labels:
`node-20:docker://node:20-bookworm` for CI jobs and `docker-build` (dind or mounted
`/var/run/docker.sock`) for image builds.

FR29: A second runner is online before required status checks are enabled on `main`.

FR30: Concurrent deploys to the same stand serialize via `concurrency: cd-${{ github.ref }}`
with `cancel-in-progress: false`, **plus** a server-side `flock` on a file in the stand
directory that does not depend on the Forgejo version.

**Cutover and decommissioning (Phases 7, 8)**

FR31: `[C]` The commit currently running in PROD is identified from the running container on
s2 and **rebuilt** into the Forgejo registry under `sha-<commit>` and `prod-current` to enable
a cutover deploy. The image is not pulled from ghcr — no action is taken on GitHub, and that
includes its registry — so the cutover deploy is commit-identical but not byte-identical to
what production currently serves.

FR32: The cutover is validated by running `deploy-prod.yml` with `rollback: true` against
that imported tag — exercising the full mechanism without changing what is served.

FR33: **CANCELLED (2026-08-07).** ~~The GitHub `deploy` job is disabled at the start of the
PROD phase; GitHub Actions remains CI-only for 1-2 release cycles, then `.github/workflows/`
is deleted.~~ No action is taken on GitHub. Deleting the workflow files from the repository is
covered by Story 7.2; nothing else here survives.

FR34: **CANCELLED (2026-08-07).** ~~Deployment SSH keys and ghcr tokens are removed from
GitHub Secrets and revoked; SSH keys that were stored in GitHub Secrets are rotated.~~ No
action is taken on GitHub. Key rotation on the servers is covered by Story 7.5; the secrets
and ghcr tokens stay where they are.

### NonFunctional Requirements

NFR1: A full CI run completes in ≤ 15 minutes.

NFR2: A DEV feature-branch deploy completes in < 10 minutes.

NFR3: Rollback time equals `docker pull` + container restart — no rebuild on the rollback
path.

NFR4: Every image is immutable and traceable to the exact commit that produced it via its
`sha-<short>` tag.

NFR5: The existing DEV and PROD stands remain fully operational and untouched throughout
phases 0–6; Forgejo deploys only to newly created stands.

NFR6: Registry credentials on s1/s2 are read-only (`read:package`); only `ci-bot` holds
`write:package`.

NFR7: **NARROWED (2026-08-11, `sprint-change-proposal-2026-08-11-deploy-runner.md`).** Deployment
no longer authenticates to s2 over SSH (FR19), so **no new deployment key is required**. The
existing key stays authorized on s2 as an **administrative access path only**; it is not a delivery
credential, and its rotation is Story 7.5's concern rather than a prerequisite for any deploy.
~~s2 receives a **new** SSH key~~; the old key is not revoked until Phase 8 completes, to
avoid losing access.

NFR8: No silent URL fallbacks — the `CD.yml:49,59` style defaults to the production API are
removed, so a missing secret fails the build instead of shipping a wrong bundle.

NFR9: There is no technical approval gate for PROD in Forgejo — anyone with write access can
dispatch `deploy-prod.yml`. The control is organizational and must be written into the
regulation.

NFR10: `concurrency` support may be silently absent on the Forgejo instance; deploy
serialization must not depend on it.

NFR11: `[C]` The image deployed to PROD is not the artifact validated on PRE-PROD. This
violates the "PROD receives the exact version validated in PRE-PROD" principle and is
accepted, documented, and tracked as technical debt.

### Additional Requirements

Technical and infrastructure requirements extracted from the plan that shape story content:

- Forgejo version check: `[actions] ENABLED=true`, and whether `concurrency` is supported
  (Gitea gained it in 1.24; on Forgejo it may be ignored **silently**, with no error).
- Action compatibility smoke test must run **before** any real workflow is ported:
  `checkout`, `setup-node`, `upload-artifact`, `docker/build-push-action`.
- `actions/upload-artifact@v4` had a known Gitea/Forgejo artifact-API v4 incompatibility;
  verify on the instance, fall back to `v3` if broken.
- Third-party actions are referenced by full URL (`uses: https://github.com/actions/checkout@v6`),
  which requires egress to github.com from the runner; mirrors on `code.forgejo.org` are the
  alternative.
- **AMENDED (2026-08-11).** `appleboy/scp-action` and `appleboy/ssh-action` are not ported and
  not replaced by an SSH equivalent: deployment runs on a deploy runner located on the target
  host, so **no workflow performs SSH at all**.
  ~~replaced with native `ssh`/`scp` in `run:` steps rather than ported.~~
- A runner cache server is required for `actions/setup-node` with `cache: npm`.
- The runner must not be hosted on s2.
- Secret migration map **(AMENDED 2026-08-11)**: `REGISTRY_TOKEN` (org),
  `SLACK_CD_WEBHOOK_URL` (org). **No SSH secrets are migrated** — deployment runs on the target
  host and needs none; ~~`S1_SSH_HOST/USER/KEY` (repo), `S2_SSH_HOST/USER/KEY` (repo, new key)~~.
  Ports are **not** migrated into CI variables — they already live in per-stand server `.env`
  files.
- `github.server_url` / `github.repository` / `github.run_id` work unchanged in Forgejo and
  produce a valid run URL.
- **Answered 2026-08-07 (Story 1.4, cancelled):** GitHub and Forgejo are **not** synchronized
  in either direction. `main` matched at `e6ecfced`, `development` had diverged (Forgejo
  `372ee2c4`, GitHub `405db726`), the GitHub repository is not a fork and carries
  `mirror_url: null`. Pull requests are platform objects and are not mirrored either way.
  The team pushes to GitHub; the Forgejo copy lags and the gap widens daily.
- Known live bug in the current GitHub CD: pushing a `v*` tag evaluates `environment: dev`
  at `CD.yml:124` while `set-env` resolves `DEPLOY_ENV=production` at `CD.yml:150`, so the
  production gate is bypassed by pushing a tag. Note the gate is nominal today — the
  `production` environment carries no protection rules — and the tag path also fails at the
  `docker pull` in `CD.yml:191`, but only *after* the scp step has already written to the
  production server. Story 1.1 removed the `v*` trigger in the repository (commit `09591984`)
  but is **cancelled**: the file only takes effect on GitHub, where no action is taken, so the
  bypass stays open there. Accepted risk.
- ~~Interim regulation is needed for who updates the legacy DEV stand.~~ **Dropped 2026-08-07
  (Story 1.5, cancelled):** the legacy stand keeps running on `development` via the GitHub CD
  with no planned end date, since the GitHub transition is owned outside this plan. Two DEV
  stands will coexist indefinitely and this plan does not say which is authoritative.
- `[C]` `Dockerfile.prod` keeps its `ARG VITE_API_BASE_URL` / `ARG VITE_WS_URL` build-time
  contract unchanged; no `entrypoint.sh` runtime-config layer is introduced.
- `[C]` `VITE_API_BASE_URL_PREPROD` / `VITE_WS_URL_PREPROD` must be added as repo variables
  alongside the existing `_DEV` / `_PROD` pairs.

### UX Design Requirements

Not applicable. This is an infrastructure and delivery-pipeline migration with no user
interface surface. No UX design contract exists for this effort, and none is required.

### FR Coverage Map

| FR | Epic | Coverage |
|---|---|---|
| FR1 | Epic 2 | Four independent CI jobs on the `node-20` label |
| FR2 | Epic 2 | CI triggers on PR to `main` and push to feature branches |
| FR3 | Epic 2 | Coverage published as artifact, codecov removed |
| FR4 | Epic 2 | `main` protected, required status checks enforced |
| FR5 | Epic 3 | `build.yml` on the `docker-build` label pushes to the Forgejo registry |
| FR6 | Epic 3 | Build triggers include feature branches, `main`, `v*`, dispatch |
| FR7 | Epic 3 | Tag scheme `sha-<short>` / `<branch>` / semver / `latest` |
| FR8 | Epic 3 | `[C]` Per-environment build-args and tag discriminator |
| FR9 | Epic 3 | Registry-backed build cache replaces `type=gha` |
| FR10 | Epic 1 | Container Registry enabled, `ci-bot` write token, read-only server tokens |
| FR11 | Epic 1 | Retention policy that never deletes deployed or rollback-target tags |
| FR12 | Epic 4 | `deploy-dev.yml` dispatch with `ref`, no approval required |
| FR13 | Epic 5 | `deploy-preprod.yml` dispatch-only with mandatory `image_tag` |
| FR14 | Epic 5 | Retag to `preprod-current` / `preprod-<sha>` after successful deploy |
| FR15 | Epic 6 | `deploy-prod.yml` dispatch with `image_tag` + optional `rollback` |
| FR16 | Epic 6 | `[C]` Promotion guard by commit SHA against `preprod-<sha>` |
| FR17 | Epic 6 | `[C]` Rebuild on the release path, pull-only on the rollback path |
| FR18 | Epic 6 | Retag to `prod-current` after successful deploy |
| FR19 | Epic 4 | Deploy sequence: scp → down → fail-fast pull → up → health check |
| FR20 | Epic 4 | Health check parameterized by container name and published port |
| FR21 | Epic 6 | Post-deploy PROD smoke check incl. log scan for ERROR |
| FR22 | Epic 4 | Slack start/success/failure via `curl` |
| FR23 | Epic 4 | Weekly scheduled DEV reset to `main` + image prune |
| FR24 | Epic 6 | Rollback via previous `image_tag` with `rollback: true` |
| FR25 | Epic 4 | `docker-compose.server.yml` parameterized for coexisting stands |
| FR26 | Epic 4 | Separate stand directories on s1 |
| FR27 | Epic 5 | Dedicated `crm-network-preprod` with its own Kong |
| FR28 | Epic 1 | Org-level runner with `node-20` and `docker-build` labels |
| FR29 | Epic 1 | Second runner online before required checks are enabled |
| FR30 | Epic 4 | `concurrency` plus version-independent server-side `flock` |
| FR31 | Epic 6 | `[C]` Rebuild the running PROD commit into the Forgejo registry (ghcr unreachable) |
| FR32 | Epic 6 | Cutover validated by a no-op `rollback: true` deploy |
| FR33 | — | **Cancelled** — no action on GitHub. File deletion only, via Story 7.2 |
| FR34 | — | **Cancelled** — no action on GitHub. Server-side key rotation only, via Story 7.5 |

## Epic List

### Epic 1: Forgejo Delivery Foundation

A developer can run a workflow on a Forgejo runner and push/pull an image from the Forgejo
Container Registry, with platform capability proven by a smoke test before any real
workflow is ported to it. Covers plan phases 0-2: locking the open decisions, establishing
how GitHub and Forgejo are synchronized, the interim regulation for the legacy DEV stand,
Forgejo version and `concurrency` verification, action-compatibility smoke testing, secret
migration, and a retention policy that cannot delete a rollback target.

**FRs covered:** FR10, FR11, FR28, FR29

**Implementation notes:** Story 1.1 originally closed the live GitHub CD defect where pushing
a `v*` tag bypasses the production gate (`CD.yml:124` vs `CD.yml:150`). It is **cancelled** —
the 2026-08-07 decision that no action is taken on GitHub makes any repository-side fix inert
there. The defect is instead closed by Story 6.1, by ending delivery to GitHub entirely. The
exposure during the intervening window is recorded as accepted risk under Story 1.1.

### Epic 2: Forgejo CI as the Quality Gate

A developer gets lint, typecheck, test, and build feedback inside Forgejo on every pull
request, and `main` is protected against direct pushes and unverified merges.

**FRs covered:** FR1, FR2, FR3, FR4
**NFRs addressed:** NFR1 (full run within 15 minutes)

**Implementation notes:** Required status checks must not be enabled until a second runner
is online (FR29, Epic 1) — a single runner failure would otherwise freeze all merges.

### Epic 3: Traceable Image Build and Publish

Every commit becomes an immutable image in the Forgejo registry, traceable to its exact
SHA — including commits on feature branches, without which DEV deployment is impossible
because the deploy workflow pulls fail-fast.

**FRs covered:** FR5, FR6, FR7, FR8, FR9
**NFRs addressed:** NFR4 (immutability and commit traceability), NFR8 (no silent URL fallbacks)

**Implementation notes:** `[C]` Under Option C one commit produces up to three distinct
images, so the tag needs an environment discriminator. `Dockerfile.prod` keeps its existing
build-arg contract unchanged.

### Epic 4: DEV Environment on Forgejo

Any developer can deploy any feature branch to a new DEV stand on s1 without approval,
while the legacy DEV stand keeps running untouched.

**FRs covered:** FR12, FR19, FR20, FR22, FR23, FR25, FR26, FR30
**NFRs addressed:** NFR2 (deploy under 10 minutes), NFR5 (legacy stands untouched), NFR10
(serialization independent of `concurrency` support)

**Implementation notes:** This epic establishes the reusable deployment mechanics consumed
by Epics 5 and 6: parameterized compose, **execution on a deploy runner located on the target
host** (amended 2026-08-11; was ~~native `ssh`/`scp` instead of `appleboy/*`~~),
fail-fast `docker pull` with no `:latest` fallback, health check parameterized by container
name and port, Slack via `curl`, and the server-side `flock`.

### Epic 5: PRE-PROD Release Candidate Environment

A release engineer can deploy a specific image tag to a dedicated PRE-PROD stand backed by
its own Kong gateway, and the validation is recorded in the registry as the release history.

**FRs covered:** FR13, FR14, FR27

**Implementation notes:** The only epic with an external dependency — a second Kong stand on
s1 owned by the backend/infrastructure team. Without it, `crm-kong-gateway` name resolution
on the shared network sends the PRE-PROD frontend to the DEV backend and the validation is
fictional. Release scope freeze is a process agreement, not a technical guarantee, and is
deliberately excluded from acceptance criteria.

### Epic 6: Production Release and Verified Rollback

A release reaches production through Forgejo, rollback is proven in practice rather than in
theory, and the cutover happens without changing what production serves.

**FRs covered:** FR15, FR16, FR17, FR18, FR21, FR24, FR31, FR32
**NFRs addressed:** NFR3 (rollback without rebuild), NFR7 (old s2 key retained), NFR9 (no
technical approval gate — organizational control), NFR11 (`[C]` promotion principle violated)

**Implementation notes:** `[C]` This is where the Option C compromise becomes visible: the
PROD image is rebuilt rather than promoted, the guard degrades from image identity to commit
identity, and the deviation is recorded as tracked technical debt.

### Epic 7: Forgejo as the Single Source of Delivery

Forgejo is the only pipeline anyone works with, the documentation describes the process that
actually runs, and the keys that were held in GitHub Secrets no longer open anything.

**FRs covered:** none. FR33 and FR34 are cancelled; Stories 7.2 and 7.5 remain as work the epic still does

**Implementation notes:** Reduced by the 2026-08-07 decision that no action is taken on
GitHub. Stories 7.1 and 7.4 are cancelled; 7.2 is reduced to deleting the legacy workflow
files from the repository. GitHub itself is left running as it is — see *External dependency:
the GitHub transition* in the Overview. The old s2 SSH key is not revoked until this epic
completes.

---

## Epic 1: Forgejo Delivery Foundation

A developer can run a workflow on a Forgejo runner and push/pull an image from the Forgejo
Container Registry, with platform capability proven by a smoke test before any real workflow
is ported. All open decisions from plan phase 0 are recorded, and the credentials the later
epics depend on exist with correctly scoped permissions.

### Story 1.1: Close the Tag-Based Production Gate Bypass in the Current GitHub CD

As a release engineer,
I want pushing a `v*` tag to stop silently deploying to production without the required
reviewers,
So that the production approval gate cannot be circumvented during the weeks the legacy
pipeline is still live.

> **CANCELLED — not applicable (decided 2026-08-07).** Superseded by the decision that no
> action is ever taken on GitHub. `.github/workflows/CD.yml` takes effect only on GitHub, so
> no repository-side change can close this defect there. The bypass is instead closed by
> Story 6.1, which stops delivering commits to GitHub at all — an unreachable workflow cannot
> be triggered by a tag or anything else.
>
> **The fix itself is kept**, in commit `09591984`: the `v*` trigger is removed from
> `on.push`, the tag clause is removed from the deploy job `if:`, and the `environment`
> expression, its Slack-payload copy and `set-env` are collapsed onto one discriminator. It is
> correct, it costs nothing to carry, and it travels to Forgejo with the rest of the tree. It
> is simply inert with respect to GitHub.
>
> **Accepted risk.** Until Story 6.1 completes, GitHub still receives commits and its CD is
> live (it deployed `development` on 2026-08-07 and production on 2026-08-05). For that
> window the tag bypass remains open on GitHub and cannot be closed. Practically bounded by
> the fact that no `v*` tag has ever existed in this repository (`git tag` empty, GitHub
> `/tags` returns `[]`) and that the tag path aborts at `docker pull` — though only after scp
> has already written to the production server.
>
> Original investigation, evidence and the superseded acceptance criteria are preserved in
> `{implementation_artifacts}/1-1-close-the-tag-based-production-gate-bypass-in-the-current-github-cd.md`.

**Acceptance Criteria:**

**Given** `.github/workflows/CD.yml`
**When** a `v*` tag is pushed
**Then** no `CD` workflow run is created at all
**And** the deploy job's `if:` condition no longer admits `refs/tags/v*`.

**Given** the `set-env` step at `CD.yml:140-153` and the `environment` expression at
`CD.yml:123-124`
**When** the workflow runs for any ref that can still trigger it (`main`, `development`, or
`workflow_dispatch`)
**Then** `DEPLOY_ENV` and the `environment` name agree on the same target
**And** no branch of the `if/elif/else` can produce a mismatch between them.

**Given** the fix has been applied
**When** a test `v*` tag is pushed
**Then** no workflow run appears
**And** the observed behaviour is recorded in the migration notes.

### Story 1.2: Record the Migration Decisions and the Option C Technical Debt

As a tech lead,
I want the locked phase-0 decisions and their consequences written down in the repository,
So that every later story is built on a stated contract rather than on recollection.

**Acceptance Criteria:**

**Given** blocker 1.1 has been resolved as Option C
**When** the decision record is written
**Then** it states that Vite variables stay build-time baked, that a distinct image is built
per environment, and that PROD does not receive the artifact validated on PRE-PROD
**And** it names the violated principle explicitly ("PROD receives the exact version
validated in PRE-PROD").

**Given** Option C degrades the phase-7 promotion guard
**When** the record is written
**Then** it documents that the guard can only assert commit identity via `preprod-<sha>`, not
image identity
**And** it records the runtime-config approach (Option A) as the tracked remediation with the
work it would require.

**Given** the decision record exists
**When** a developer opens the repository documentation
**Then** the record is discoverable from `docs/` and linked from the migration plan.

### Story 1.3: Verify Forgejo Actions Availability and Concurrency Support

As a platform engineer,
I want the Forgejo instance's Actions capabilities established by observation,
So that workflow design does not rest on assumptions that fail silently.

> **Prerequisite note (added 2026-08-08, story 1.3).** Unlike Story 1.9, which gates explicitly
> on Story 1.7 being operational (line 678), this story carries no prerequisite clause even
> though AC2 and AC4 require a runner with **capacity ≥ 2** to distinguish concurrency-group
> queueing from ordinary capacity contention — a single-slot runner (the `forgejo-runner`
> default, and what Story 1.7 provisions) returns a guaranteed false positive on the AC2 probe.
> Story 1.3 resolved this by provisioning its own disposable probe runner instead of depending
> on Story 1.7 — see [migration-decisions.md#d8](../../docs/migration-decisions.md#d8).

**Acceptance Criteria:**

**Given** the Forgejo instance configuration
**When** the check is performed
**Then** `[actions] ENABLED=true` is confirmed
**And** the exact Forgejo version is recorded.

**Given** a test workflow declaring `concurrency` with `cancel-in-progress: false`
**When** two runs of that workflow are triggered against the same ref in quick succession
**Then** it is recorded whether the second run queued behind the first or ran in parallel
**And** the result is stated as a definite yes/no, because unsupported `concurrency` is
ignored without raising an error.

**Given** the concurrency probe result
**When** it shows `concurrency` is not honoured
**Then** the finding is flagged as confirming the need for the server-side `flock` in Epic 4.

**Given** three deploy workflows will otherwise duplicate the same deployment script
**When** reuse mechanisms are probed
**Then** it is established by test whether this instance supports `workflow_call` reusable
workflows and whether it supports local composite actions
**And** the result is recorded as a definite yes/no for each, since it determines how the
shared deploy mechanics are factored out.

### Story 1.4: Document the GitHub-Forgejo Synchronization Model

As a developer,
I want to know exactly what is mirrored between GitHub and Forgejo and in which direction,
So that I can tell which triggers will fire on which platform during the parallel period.

> **CANCELLED — out of scope (decided 2026-08-07).** The plan takes no action on GitHub and
> does not run a parallel period across both platforms, so the synchronization model is no
> longer something it needs to reason about. Moving delivery across is owned outside the plan
> — see *External dependency: the GitHub transition* in the Overview.
>
> The investigation was in fact already carried out on 2026-08-07 while working Story 1.1, and
> its answer is recorded there and in the Overview rather than lost: **there is no mirror in
> either direction.** `main` matched at `e6ecfced`, `development` had diverged (Forgejo
> `372ee2c4`, GitHub `405db726`), the GitHub repository is not a fork and carries
> `mirror_url: null`, and the local `origin` points at Forgejo with no GitHub remote
> configured. The team pushes to GitHub; the Forgejo copy lags and the gap widens daily.

### Story 1.5: Publish the Interim Regulation for the Legacy DEV Stand

As a developer,
I want written instructions on how the legacy DEV stand is updated during the migration,
So that the `development` branch does not go stale or get updated by two conflicting routes.

> **CANCELLED — out of scope (decided 2026-08-07).** The regulation governed how the legacy
> DEV stand is kept updated through the GitHub pipeline until cutover. The plan takes no action
> on GitHub and does not schedule a cutover, so it has nothing to regulate there: the legacy
> stand simply keeps working exactly as it does today, driven by the `development` branch and
> the GitHub CD, for as long as that continues.
>
> **What this leaves open**, deliberately and outside the plan: two DEV stands will coexist
> with no planned end date — the legacy one and the Forgejo one built in Epic 4 — and nothing
> here says which is authoritative or who retires the old one. That belongs to the GitHub
> transition owned outside this plan.

### Story 1.6: Secure the PRE-PROD Infrastructure Commitment

As a release engineer,
I want a confirmed commitment from the platform team for the PRE-PROD backend environment,
So that Epic 5 is not blocked waiting on another team's queue.

**Acceptance Criteria:**

**Given** PRE-PROD requires isolation from DEV at the network level
**When** the requirement is submitted to the backend/infrastructure team
**Then** it specifies a dedicated Docker network `crm-network-preprod` and its own Kong
gateway instance on s1
**And** it explains that a shared `crm-network` makes `crm-kong-gateway` resolve to the DEV
backend, rendering PRE-PROD validation fictional.

**Given** PRE-PROD needs to be reachable
**When** the requirement is submitted
**Then** it includes the DNS name `preprod.crm-prionex.online` and its TLS certificate
**And** it includes the published port allocation `8081` on s1.

**Given** the requirement has been submitted
**When** the platform team responds
**Then** a committed delivery date is recorded
**And** the dependency is tracked as an explicit blocker on Epic 5.

### Story 1.7: Provision the Primary Forgejo Runner with Both Labels

As a developer,
I want a Forgejo runner that can execute both Node jobs and Docker builds,
So that CI jobs and image builds have somewhere to run.

**Acceptance Criteria:**

> **Context (established in Story 1.3, 2026-08-07).** The `CRM` organization already has two
> registered runners — `ci-hub` (label `ubuntu-latest`) and `s1-build-crm` (labels `s1`, `ci`,
> `build-crm`), both on forgejo-runner v13.0.0. **They belong to another team and are not under
> this plan's control.** This story still provisions our own runner; it does not adopt,
> reconfigure or depend on theirs. Registration scope changed from organization to repository —
> see `{planning_artifacts}/sprint-change-proposal-2026-08-07-runners.md`.

**Given** a host that is not s2
**When** the `forgejo-runner` is installed and registered at the **repository** level for
`CRM/fe-prionex`
**Then** it exposes the label `node-20:docker://node:20-bookworm`
**And** it exposes the label `docker-build`
**And** neither label collides with a label already registered at the `CRM` organization
(`ubuntu-latest`, `s1`, `ci`, `build-crm`).

**Given** the runner is registered at repository scope
**When** the organization runner list is inspected
**Then** our runner does not appear as available to other `CRM` repositories
**And** the two pre-existing organization runners are unmodified.

**Given** a job running under the `docker-build` label
**When** it executes `docker version`
**Then** both client and server respond
**And** the mechanism providing this is recorded as either a dind image or a mounted
`/var/run/docker.sock`.

**Given** a job running under the `node-20` label
**When** it executes `node --version`
**Then** it reports a Node 20 version.

**Given** `actions/setup-node` is used with `cache: npm`
**When** the runner cache server is configured and a job runs twice
**Then** the second run restores the npm cache instead of downloading from scratch
**And** the cache-hit is visible in the job log.

### Story 1.8: Prove Action Compatibility with a Smoke Workflow

As a platform engineer,
I want every third-party action the migration depends on exercised on this instance before
any real workflow is ported,
So that incompatibilities surface as a throwaway failure rather than as a broken pipeline.

**Acceptance Criteria:**

**Given** a disposable smoke workflow
**When** it runs on the `node-20` label
**Then** `actions/checkout@v6` and `actions/setup-node@v4` resolve and succeed via their full
`https://github.com/...` URLs
**And** the runner's egress to github.com is confirmed, or a `code.forgejo.org` mirror is
substituted and recorded.

**Given** the same smoke workflow
**When** it uploads a file with `actions/upload-artifact@v4`
**Then** the artifact is retrievable from the run page
**And** if the artifact API v4 incompatibility manifests, the fallback to `v3` is applied and
recorded.

**Given** a smoke workflow on the `docker-build` label
**When** it runs `docker/setup-buildx-action`, `docker/login-action`, `docker/metadata-action`
and `docker/build-push-action` against a throwaway image
**Then** the image is pushed to the registry successfully
**And** any action that fails to resolve is recorded together with its native `run:`
replacement.

**Given** deployment runs on a deploy runner located on the target host (amended FR19)
**When** the action inventory is reconciled
**Then** the `appleboy/*` actions are confirmed as not needed, because no workflow performs SSH
**And** no SSH connectivity probe is run.

> Amended 2026-08-11 (`sprint-change-proposal-2026-08-11-deploy-runner.md`). Was: *"When the smoke
> test covers SSH connectivity / Then native `ssh` and `scp` in a `run:` step reach s1
> successfully."* Story 1.8's pre-flight established that `ufw` on s1 denies port 22 to everything
> but two administrative addresses, so that probe could not have passed at any credential — which
> is the evidence that grounded the mechanism change. The remaining clause is closed by the
> architecture, which is stronger than a connectivity test would have been.

### Story 1.9: Provision the Second Runner

As a developer,
I want a second runner online before merges depend on Forgejo checks,
So that one runner failing does not freeze every merge into `main`.

**Acceptance Criteria:**

**Given** the primary runner from Story 1.7 is operational
**When** a second runner is registered at the same **repository** level
**Then** it carries the identical `node-20` and `docker-build` labels
**And** ~~both runners appear as online in the organization runner list~~ — ⚠️ **устарело
(2026-08-12, code review story 1.9).** Регистрация переведена на уровень **репозитория**
(`sprint-change-proposal-2026-08-07-runners.md` §4.2), а AC2 story 1.7 прямо требует отсутствия
наших раннеров в org-списке. Repo-scoped раннер там не появится никогда. Действующая проверка —
`GET /repos/CRM/fe-prionex/actions/runners`, см. AC4 story 1.9 и
[#d13](../../docs/migration-decisions.md#d13). Story 2.6 гейтит мержи на этих раннерах и читает
именно этот текст.

**Given** both runners are online
**When** the primary runner is deliberately stopped and a CI job is queued
**Then** the job is picked up by the second runner and completes
**And** the primary runner is restarted afterwards.

**Given** two runners are available
**When** four CI jobs are triggered simultaneously
**Then** the jobs distribute across both runners rather than serializing on one.

### Story 1.10: Enable the Forgejo Container Registry with Scoped Credentials

As a release engineer,
I want an image registry on Forgejo with least-privilege credentials,
So that CI can publish images while servers can only read them.

**Acceptance Criteria:**

**Given** the Forgejo instance
**When** the Container Registry is enabled
**Then** the target path `git.crm-prionex.com/crm/fe-prionex` accepts pushes.

**Given** a technical user `ci-bot`
**When** its token is created
**Then** the token carries `write:package` scope
**And** it is stored as the organization-level secret `REGISTRY_TOKEN`.

**Given** s1 and s2 need to pull images
**When** their registry credentials are created
**Then** those tokens carry `read:package` scope only
**And** an attempt to push using a server token is rejected.

**Given** `Dockerfile.prod` builds locally
**When** the resulting image is pushed to the Forgejo registry and then pulled from both s1
and s2
**Then** both pulls succeed
**And** the image digest is identical on both servers.

### Story 1.11: Implement a Retention Policy That Cannot Delete a Deployed Image

As a release engineer,
I want registry cleanup that provably spares anything a stand is running or could roll back
to,
So that housekeeping cannot destroy the rollback path.

**Acceptance Criteria:**

**Given** the registry accumulates `<branch>` tags
**When** the retention rule runs
**Then** `<branch>` tags older than 14 days are removed.

**Given** an image tag is currently referenced by `prod-current` or `preprod-current`
**When** the retention rule runs
**Then** that tag is not deleted regardless of its age
**And** the N previous rollback targets are likewise preserved.

**Given** the retention mechanism has been configured
**When** it is tested against a seeded set of tags including one aged past the threshold but
marked as deployed
**Then** the aged deployed tag survives
**And** the aged undeployed branch tag is removed
**And** the test result is recorded rather than assumed.

### Story 1.12: Migrate Secrets and Variables into Forgejo

As a developer,
I want the secrets the new workflows need present in Forgejo at the right scope,
So that later epics do not stall on missing credentials.

> **Prerequisite: Story 1.13 must be complete.** Until `.forgejo/workflows/` suppresses the
> `.github/workflows/` fallback, putting credentials into Forgejo arms the legacy `CD.yml` deploy
> job on a platform where an idle `ubuntu-latest` runner will execute it. Today that job fails
> harmlessly at `docker/login-action` only because these credentials are absent.
>
> ✅ **Amended 2026-08-11 (`sprint-change-proposal-2026-08-11-deploy-runner.md`) — this story no
> longer removes that protection.** The original text ended *"this story removes exactly that
> accidental protection"*, because it was the story that would place ~~`S1_SSH_*`, `S2_SSH_*`~~
> into Forgejo. Under the amended FR19 no SSH secret is ever created there, so the legacy deploy
> job can never reach a server regardless of the placeholder. What remains is `REGISTRY_TOKEN` and
> `SLACK_CD_WEBHOOK_URL`, neither of which lets `CD.yml` deploy — it would still fail, now at the
> `appleboy/*` steps for want of a host and key. The prerequisite on 1.13 stands on its own merits;
> the hazard it guarded against is retired.

**Acceptance Criteria:**

**Given** the secret migration map in the plan
**When** organization-level secrets are created
**Then** `REGISTRY_TOKEN` and `SLACK_CD_WEBHOOK_URL` exist at the `CRM` organization scope.

**Given** deployment runs on a deploy runner located on the target host under the amended FR19
**When** the secret set is reviewed
**Then** **no SSH secret of any kind is created in Forgejo**
**And** the rationale is recorded: a legacy `.github/workflows/CD.yml` execution can then never
reach a server, which makes D9's suppression permanent rather than procedural.

> Amended 2026-08-11 (`sprint-change-proposal-2026-08-11-deploy-runner.md`). Two AC blocks were
> deleted here — ~~`S1_SSH_HOST/USER/KEY` authenticating against s1~~ and ~~`S2_SSH_HOST/USER/KEY`
> newly generated for s2~~. This is the change that retires the plan's largest standing hazard:
> Story 1.13 named this story as the one that removes the accidental protection keeping legacy
> `CD.yml` from deploying, because it was the story that would place SSH credentials in Forgejo.
> It no longer does.

**Given** Option C requires per-environment build variables
**When** repository variables are created
**Then** `VITE_API_BASE_URL_DEV`, `VITE_WS_URL_DEV`, `VITE_API_BASE_URL_PREPROD`,
`VITE_WS_URL_PREPROD`, `VITE_API_BASE_URL_PROD` and `VITE_WS_URL_PROD` all exist
**And** no hardcoded fallback value is introduced for any of them.

**Given** ports already live in per-stand server `.env` files
**When** the variable set is reviewed
**Then** `FRONTEND_PORT` is absent from Forgejo variables
**And** the rationale (no duplicated state) is recorded.

### Story 1.13: Stop Forgejo from Executing the Legacy GitHub Workflows

As a release engineer,
I want Forgejo to ignore `.github/workflows/` before any secret or branch reaches it,
So that the legacy production-deploying pipeline cannot be triggered on a platform it was never
intended to run on.

> **Added 2026-08-07** by
> `{planning_artifacts}/sprint-change-proposal-2026-08-07-runners.md`.
> **Sequencing: must complete before Story 1.12.** May run any time after Story 1.3, and is
> listed ahead of 1.6 in the sprint plan despite its number.
>
> **Why.** Forgejo resolves the workflow directory as `.forgejo/workflows` → `.gitea/workflows`
> → `.github/workflows`, first match wins. `main` has no `.forgejo/`, so Forgejo executes
> `.github/workflows/` — where all six jobs request `runs-on: ubuntu-latest`
> (`CI.yml:12,34,53,82`, `CD.yml:31,119`), and the `CRM` organization has an idle runner
> carrying exactly that label. Any push of `main` or `development` to Forgejo is executed
> immediately. Today `CD.yml` fails at `docker/login-action` because its credentials are absent;
> Story 1.12 supplies them.

**Acceptance Criteria:**

**Given** Forgejo resolves the workflow directory as `.forgejo/workflows` → `.gitea/workflows`
→ `.github/workflows`, first match wins
**When** a minimal, inert `.forgejo/workflows/` is committed to `main`
**Then** the directory exists on `main` and contains no workflow that any trigger can fire
**And** `.github/workflows/` is left byte-for-byte unchanged, so GitHub's behaviour is untouched
per decision D7.

**Given** the placeholder is in place on `main`
**When** a commit is pushed to a branch matching `CI.yml`'s trigger list
**Then** no `CI` run is created on Forgejo
**And** the absence of a run is recorded with the branch name and timestamp as evidence.

**Given** the placeholder is in place
**When** the observation above is made
**Then** it is recorded as a definite yes/no whether the presence of `.forgejo/workflows/`
suppresses the `.github/workflows/` fallback on Forgejo 15.0.5
**And** if the answer is no, the repository Actions unit is disabled until Story 2.1, Stories 1.7
and 1.8 are resequenced after it, and this is escalated as a change to the epic order.

**Given** the neutralisation is proven
**When** the decision record is updated
**Then** a `D9` entry in `docs/migration-decisions.md` records the mechanism, the evidence, and
the constraint that `.forgejo/workflows/` must never again be absent from `main` while
`.github/workflows/` still exists in the tree.

---

## Epic 2: Forgejo CI as the Quality Gate

A developer gets lint, typecheck, test and build feedback inside Forgejo on every pull
request, and `main` is protected against direct pushes and against merges that have not
passed those checks.

### Story 2.1: Port the Four CI Jobs to Forgejo

As a developer,
I want the same four quality checks I have on GitHub running on Forgejo,
So that moving platforms does not reduce the feedback I get on my code.

**Acceptance Criteria:**

**Given** the existing `.github/workflows/CI.yml`
**When** `.forgejo/workflows/ci.yml` is created
**Then** it defines four independent jobs — `lint`, `typecheck`, `test`, `build` — that run in
parallel with no dependencies between them
**And** every job targets the `node-20` runner label.

**Given** the `lint` job
**When** it runs
**Then** it executes `npm ci`, then `npm run lint`, then `npm run format:check`
**And** an ESLint warning fails the job, because `lint` is defined as
`eslint . --max-warnings=0`.

**Given** the `typecheck` job
**When** it runs
**Then** it executes `npm run typecheck` (`tsc -b`)
**And** a type error fails the job.

**Given** the `test` job
**When** it runs
**Then** it executes `npm run test:run`
**And** the runner container provides enough memory for
`NODE_OPTIONS=--max-old-space-size=8192`, with the observed peak usage recorded.

**Given** the `build` job
**When** it runs
**Then** it executes `npm run build` and uploads `dist/` as an artifact with a 1-day retention
**And** the artifact-action version proven in Story 1.8 is used.

**Given** the workflow is being developed
**When** it is first committed
**Then** its only trigger is `workflow_dispatch`, so porting does not spam runs on every push
**And** all four jobs are confirmed green via a manual dispatch.

**Given** the `CRM` organization has a runner labelled `ubuntu-latest` that belongs to another
team
**When** the ported workflows declare `runs-on`
**Then** no workflow in `.forgejo/workflows/` uses `ubuntu-latest`
**And** every job targets a label provisioned by Story 1.7 (`node-20` or `docker-build`).

### Story 2.2: Trigger CI on Pull Requests and Feature Branches

As a developer,
I want CI to start by itself when I open a pull request or push a branch,
So that I do not have to remember to dispatch it manually.

**Acceptance Criteria:**

**Given** `.forgejo/workflows/ci.yml` from Story 2.1
**When** its triggers are configured
**Then** it runs on `pull_request` targeting `main`
**And** it runs on `push` to feature branches.

**Given** a pull request is opened against `main`
**When** the trigger fires
**Then** all four jobs start automatically
**And** their results are visible as checks on the pull request.

**Given** a new commit is pushed to an open pull request
**When** the trigger fires
**Then** CI re-runs against the updated head
**And** the previous result no longer gates the merge.

**Given** the synchronization model documented in Story 1.4
**When** triggers are configured
**Then** any duplicate-run interaction with the GitHub pipeline is accounted for
**And** the expected behaviour during the parallel period is recorded.

### Story 2.3: Publish Coverage as an Artifact Instead of Uploading to Codecov

As a developer,
I want the coverage report available from the run itself,
So that the pipeline has one fewer external dependency and coverage is still inspectable.

**Acceptance Criteria:**

**Given** the `test` job
**When** coverage is generated
**Then** `npm run test:coverage` runs after `npm run test:run`
**And** the `coverage/` output is uploaded as a workflow artifact.

**Given** the previous `codecov/codecov-action@v4` step at `CI.yml:74-78`
**When** the Forgejo workflow is reviewed
**Then** no codecov step exists
**And** no codecov token or secret is referenced.

**Given** coverage generation can be flaky
**When** `npm run test:coverage` fails
**Then** the job outcome matches the deliberate choice recorded in the story
(fail the job, or `continue-on-error` as in `CI.yml:72`)
**And** that choice is stated explicitly rather than inherited by accident.

**Given** a completed CI run
**When** a developer opens the run page
**Then** the coverage artifact is downloadable.

### Story 2.4: Bring the Full CI Run Within the Fifteen-Minute Budget

As a developer,
I want CI to finish fast enough that I do not context-switch away from my change,
So that the quality gate stays a help rather than a delay.

**Acceptance Criteria:**

**Given** the four-job CI workflow
**When** a full run executes on a cold cache
**Then** the wall-clock duration from trigger to last job completion is measured and recorded.

**Given** the runner cache server configured in Story 1.7
**When** a second run executes on the same branch
**Then** `npm ci` restores from cache
**And** the warm-cache duration is measured and recorded.

**Given** both measurements
**When** the warm-cache full run is evaluated
**Then** it completes in 15 minutes or less
**And** if it does not, the dominant job is identified and the remediation applied before the
story closes.

**Given** two runners are online from Story 1.9
**When** four jobs are triggered at once
**Then** they distribute across runners rather than queueing on one
**And** the effect on total duration is recorded.

### Story 2.5: Validate CI Stability Across Five Consecutive Real Pull Requests

As a tech lead,
I want evidence that Forgejo CI is stable on real work before it can block merges,
So that turning on required checks does not turn a flaky pipeline into a delivery outage.

**Acceptance Criteria:**

**Given** CI triggers are live from Story 2.2
**When** five consecutive real pull requests are opened in Forgejo
**Then** all five produce green CI runs without manual reruns
**And** each run's duration is recorded.

**Given** any run fails for an infrastructure reason rather than a code reason
**When** the count is evaluated
**Then** the consecutive counter resets
**And** the root cause is fixed before continuing.

**Given** five green consecutive runs have been observed
**When** the durations are reviewed
**Then** none exceeded the 15-minute budget from Story 2.4
**And** the evidence is recorded, since enabling required status checks depends on it.

### Story 2.6: Enforce Required Status Checks on Main

As a tech lead,
I want `main` to reject direct pushes and unverified merges,
So that nothing reaches the release branch without passing the gate.

**Acceptance Criteria:**

**Given** two runners are online (Story 1.9) and CI is proven stable (Story 2.5)
**When** branch protection is configured on `main`
**Then** the four CI jobs are set as required status checks.

**Given** branch protection is active
**When** a developer attempts a direct `git push` to `main`
**Then** the push is rejected by the server.

**Given** a pull request with a failing CI job
**When** a merge is attempted
**Then** the merge is blocked until the check passes.

**Given** a pull request with all four checks green
**When** a merge is attempted
**Then** the merge succeeds.

**Given** required checks are now enforced
**When** one runner is deliberately stopped
**Then** merges still proceed via the second runner
**And** the single-runner freeze risk is confirmed as mitigated.

---

## Epic 3: Traceable Image Build and Publish

Every commit becomes an immutable image in the Forgejo registry, traceable to the exact SHA
that produced it — including commits on feature branches, without which DEV deployment is
impossible because the deploy workflow pulls fail-fast with no `:latest` fallback.

### Story 3.1: Build and Publish an Image to the Forgejo Registry

As a developer,
I want my commit turned into a container image stored in the Forgejo registry,
So that it can be deployed without depending on ghcr.io.

**Acceptance Criteria:**

**Given** the `docker-build` runner label from Story 1.7
**When** `.forgejo/workflows/build.yml` is created
**Then** it checks out the code, sets up buildx, logs in to
`git.crm-prionex.com` using `REGISTRY_TOKEN`, and builds `Dockerfile.prod`
**And** the resulting image is pushed to `git.crm-prionex.com/crm/fe-prionex`.

**Given** the workflow is being developed
**When** it is first committed
**Then** its only trigger is `workflow_dispatch` with a `ref` input
**And** a successful push to the registry is confirmed via manual dispatch.

**Given** any action from the `docker/*` family failed to resolve in Story 1.8
**When** the workflow is written
**Then** the recorded native `run:` replacement is used instead
**And** no unresolvable action remains in the file.

**Given** two builds of the same ref could race to push identical tags
**When** concurrency is configured
**Then** the workflow declares `concurrency: build-${{ github.ref }}` with
`cancel-in-progress: false`
**And** the behaviour observed in Story 1.3 determines whether this is relied upon or treated
as best-effort.

### Story 3.2: Apply the Image Tagging Scheme

As a release engineer,
I want every image to carry predictable tags,
So that I can name an exact artifact when deploying and reason about what is where.

**Acceptance Criteria:**

**Given** a build of any commit
**When** tags are computed
**Then** the image always carries `sha-<short>` derived from the commit SHA.

**Given** a build from a named branch
**When** tags are computed
**Then** the image additionally carries a `<branch>` tag
**And** branch names containing characters illegal in a Docker tag are sanitized
deterministically.

**Given** a build triggered by a `v*` git tag
**When** tags are computed
**Then** the image carries the corresponding semver tags.

**Given** a build from `main`
**When** tags are computed
**Then** the image additionally carries `latest`
**And** builds from any other ref never produce `latest`.

**Given** the tag set has been produced
**When** the registry is inspected after a build
**Then** every expected tag is present and resolves to the same digest.

### Story 3.3: Build Per-Environment Images with Explicit Variables

As a release engineer,
I want each environment's image built with that environment's API and WebSocket URLs and no
hidden defaults,
So that a missing variable fails the build instead of shipping a bundle pointed at the wrong
backend.

**Acceptance Criteria:**

**Given** Option C keeps Vite variables baked in at build time
**When** the build workflow runs
**Then** it accepts a target environment of `dev`, `preprod` or `prod`
**And** it passes `VITE_API_BASE_URL` and `VITE_WS_URL` as `--build-arg` from the matching
repository variables created in Story 1.12.

**Given** the fallback pattern at `CD.yml:47-74` silently defaults to the production API
**When** the Forgejo build workflow is written
**Then** no hardcoded URL fallback exists anywhere in it
**And** an empty or missing variable fails the build with an explicit message naming the
variable.

**Given** one commit can now produce up to three different images
**When** tags are computed
**Then** each image carries an environment discriminator, for example
`sha-<short>-dev` / `-preprod` / `-prod`
**And** a bare `sha-<short>` is never ambiguous between environments.

**Given** `latest` is produced only from `main`
**When** the environment discriminator is introduced
**Then** the meaning of `latest` is decided explicitly — either bound to one environment or
dropped entirely
**And** the decision is recorded, because `docker-compose.server.yml:8` currently defaults to
a `:latest` image reference.

**Given** `Dockerfile.prod` declares `ARG VITE_API_BASE_URL` and `ARG VITE_WS_URL` at lines
19-22
**When** the build workflow is implemented
**Then** that build-time contract is used unchanged
**And** no runtime-config entrypoint is introduced, consistent with the Option C decision
recorded in Story 1.2.

### Story 3.4: Trigger Builds Automatically Including Feature Branches

As a developer,
I want an image to exist for my feature branch without asking for it,
So that I can deploy that branch to DEV, which pulls fail-fast and would otherwise abort.

**Acceptance Criteria:**

**Given** `.forgejo/workflows/build.yml` from Story 3.1
**When** triggers are configured
**Then** it runs on `push` to any branch, on `push` to `main`, and on `push` of a `v*` tag
**And** the `workflow_dispatch` trigger with a `ref` input is retained.

**Given** a developer pushes a new feature branch
**When** the build completes
**Then** an image tagged with that branch and its `sha-<short>` exists in the registry
**And** no manual step was required.

**Given** the DEV deploy pulls fail-fast with no `:latest` fallback
**When** a feature branch has been pushed and built
**Then** the image the DEV deploy will request is confirmed present in the registry.

**Given** builds now run on every branch push
**When** registry growth is considered
**Then** the 14-day `<branch>` retention rule from Story 1.11 is confirmed to apply to these
images.

### Story 3.5: Move the Build Cache to the Registry

As a developer,
I want image builds to reuse layers across runs,
So that build time does not regress now that GitHub's cache backend is unavailable.

**Acceptance Criteria:**

**Given** `CD.yml:115-116` uses `cache-from: type=gha` and `cache-to: type=gha,mode=max`
**When** the Forgejo build workflow is configured
**Then** it uses `type=registry,ref=git.crm-prionex.com/crm/fe-prionex:buildcache` instead
**And** no `type=gha` reference remains.

**Given** a cold cache
**When** a build runs and then an unchanged build runs again
**Then** the second build reuses layers from the registry cache
**And** both durations are measured and recorded.

**Given** only application source changed
**When** a build runs
**Then** the `npm ci` dependency layer is restored from cache rather than reinstalled.

**Given** the buildcache tag lives in the same repository as release images
**When** the retention policy from Story 1.11 is reviewed
**Then** the buildcache tag is confirmed either exempt from cleanup or safe to regenerate.

### Story 3.6: Verify Commit Traceability and Image Immutability

As a release engineer,
I want proof that a tag identifies exactly one artifact and points back to one commit,
So that "deploy this tag" is an unambiguous instruction and an audit can reconstruct what ran.

**Acceptance Criteria:**

**Given** a push to any branch
**When** the build completes
**Then** the registry contains an image whose `sha-<short>` tag maps to that exact commit
**And** the mapping is verifiable from the image metadata or labels without consulting the
run log.

**Given** an existing `sha-<short>` tag in the registry
**When** the same commit is built a second time
**Then** the existing tag is not silently repointed to a different digest, or if it is, the
behaviour is detected and documented as a known limitation.

**Given** an image built for a specific environment
**When** its metadata is inspected
**Then** the environment it was built for is determinable from the image itself, not only from
its tag string.

**Given** all Epic 3 stories are complete
**When** the phase-4 definition of done is evaluated
**Then** a push to any branch demonstrably produces an immutable image bound to its commit
**And** the evidence is recorded.

---

## Epic 4: DEV Environment on Forgejo

Any developer can deploy any feature branch to a new DEV stand on s1 without approval, while
the legacy DEV stand keeps serving untouched. This epic also establishes the deployment
mechanics that Epics 5 and 6 reuse: parameterized compose, **execution on a deploy runner
located on the target host** (amended 2026-08-11; was ~~native `ssh`/`scp`~~), fail-fast
pull, parameterized health check, Slack via `curl`, and the server-side lock.

### Story 4.1: Parameterize the Compose File for Coexisting Stands

As a developer,
I want the compose file to describe any stand rather than one hardcoded stand,
So that DEV, PRE-PROD and the legacy stand can run side by side on the same host.

**Acceptance Criteria:**

**Given** `docker-compose.server.yml` hardcodes `name: fe-prionex` at line 4 and
`container_name: fe-prionex` at line 9
**When** the file is parameterized
**Then** the compose project name comes from `COMPOSE_PROJECT_NAME`
**And** the container name comes from `CONTAINER_NAME`.

**Given** the published port defaults to `8080` at line 11
**When** the file is parameterized
**Then** the port comes from `FRONTEND_PORT` supplied by the stand's server-side `.env`
**And** no default silently reuses another stand's port.

**Given** line 8 defaults the image to `ghcr.io/crm-prionex/fe-prionex:latest`
**When** the file is updated
**Then** the default points at the Forgejo registry, or the default is removed so that a
missing `DOCKER_IMAGE` fails loudly
**And** the choice is consistent with the `latest` decision recorded in Story 3.3.

**Given** the network is declared external as `crm-network` at lines 33-36
**When** the file is parameterized
**Then** the network name is supplied by a variable so a stand can be attached to an isolated
network
**And** the DEV stand continues to resolve `crm-kong-gateway` on the shared `crm-network`.

**Given** the parameterized file
**When** two stands are brought up locally with different variable sets
**Then** both start without name or port collision.

### Story 4.2: Provision the New DEV Stand on s1

As a developer,
I want a new DEV stand that exists alongside the running one,
So that the migration can be exercised without risking the environment the team uses daily.

**Acceptance Criteria:**

**Given** s1 already hosts the legacy DEV stand
**When** the new stand is provisioned
**Then** it lives in `~/crm-prionex/fe-prionex-dev/`
**And** the legacy stand's directory, container and port are not modified.

**Given** the new stand directory
**When** its `.env` is created
**Then** it sets `FRONTEND_PORT=8082`, a distinct `CONTAINER_NAME`, and a distinct
`COMPOSE_PROJECT_NAME`
**And** the file is readable only by the deploy user.

**Given** s1 must pull from the Forgejo registry
**When** registry credentials are configured on the host
**Then** the `read:package` token from Story 1.10 is used
**And** a manual `docker pull` of a known image succeeds.

**Given** both stands are running
**When** the host is inspected
**Then** the legacy container and the new container are both healthy on their own ports
**And** neither appears in the other's compose project.

### Story 4.3: Deploy a Feature Branch to DEV on Demand

As a developer,
I want to deploy my own branch to DEV without asking anyone for approval,
So that I can validate my work on a real stand as often as I need to.

**Acceptance Criteria:**

**Given** the DEV stand from Story 4.2 and images from Epic 3
**When** `.forgejo/workflows/deploy-dev.yml` is created
**Then** its trigger is `workflow_dispatch` with a `ref` input
**And** no approval or review step gates it.

**Given** the deploy runs
**When** the workflow declares `runs-on`
**Then** it targets the deploy runner located on s1 by its label
**And** the compose file reaches the stand directory without leaving the host
**And** no SSH client, `appleboy/scp-action` or `appleboy/ssh-action` appears in the workflow.

> Amended 2026-08-11 (`sprint-change-proposal-2026-08-11-deploy-runner.md`). Was: *"When it
> connects to s1 / Then it uses native `ssh` and `scp` in `run:` steps."* "Connects to s1" no
> longer describes anything — the job already runs on s1.

**Given** the deploy sequence
**When** it executes
**Then** it copies the compose file to the stand directory, runs `docker compose down`, pulls
the image, runs `docker compose up -d`, and then health-checks
**And** each step's failure aborts the deploy rather than continuing.

**Given** the requested image is missing from the registry
**When** `docker pull` runs
**Then** the deploy fails immediately
**And** it does not fall back to `:latest`, preserving the behaviour at `CD.yml:196`.

**Given** the health check ported from `CD.yml:213-239` hardcodes the container name
`fe-prionex` and the port `8080`
**When** it is implemented for this stand
**Then** it polls `docker inspect -f '{{.State.Health.Status}}'` against the stand's
`CONTAINER_NAME` variable
**And** its fallback `curl` targets the stand's `FRONTEND_PORT` variable
**And** a deploy to a stopped stand reports failure rather than reporting healthy from a
different container.

**Given** a successful deploy
**When** the stand is checked
**Then** the running container's image digest matches the requested tag.

### Story 4.4: Serialize Concurrent Deploys to the Same Stand

As a developer,
I want two simultaneous deploys to the same stand to queue rather than collide,
So that one deploy's `down` cannot tear down another deploy's freshly started container.

**Acceptance Criteria:**

**Given** the behaviour of `concurrency` observed in Story 1.3
**When** `deploy-dev.yml` is configured
**Then** it declares `concurrency: cd-${{ github.ref }}` with `cancel-in-progress: false`,
matching `CD.yml:19-21`.

**Given** `concurrency` may be silently ignored by this Forgejo version
**When** the deploy script runs on the server
**Then** it acquires an exclusive `flock` on a file inside the stand directory before touching
containers
**And** it releases the lock on both success and failure paths.

**Given** two deploys are dispatched to the same stand at nearly the same moment
**When** both run
**Then** the second waits for the first to finish
**And** the final container state corresponds to exactly one of the two deploys, not a mix.

**Given** a deploy is killed mid-run while holding the lock
**When** a subsequent deploy is dispatched
**Then** it is not blocked forever by a stale lock.

### Story 4.5: Notify Slack on Deploy Start, Success and Failure

As a developer,
I want deploy outcomes announced in Slack,
So that the team sees what landed on which stand without watching the runner.

**Acceptance Criteria:**

**Given** `slackapi/slack-github-action@v3.0.3` is not being ported
**When** notifications are implemented
**Then** they are sent with `curl` to the incoming webhook in `SLACK_CD_WEBHOOK_URL`
**And** no Slack action is referenced in the workflow.

**Given** a deploy starts
**When** the start notification is sent
**Then** it names the repository, the target environment, the ref and the commit.

**Given** a deploy fails
**When** the failure notification is sent
**Then** it includes a link to the run built from `github.server_url`, `github.repository` and
`github.run_id`
**And** that link opens the correct Forgejo run page.

**Given** the webhook is unreachable or misconfigured
**When** a notification step fails
**Then** it does not fail the deploy itself, matching the `continue-on-error` behaviour at
`CD.yml:135`.

### Story 4.6: Reset DEV to Main on a Weekly Schedule

As a developer,
I want DEV to return to a known state every week,
So that a stale feature branch does not sit on the shared stand indefinitely.

**Acceptance Criteria:**

**Given** `.forgejo/workflows/dev-reset.yml`
**When** its trigger is configured
**Then** it runs on a `schedule` every Sunday
**And** it can also be dispatched manually.

**Given** the scheduled run
**When** it executes
**Then** it deploys the current `main` image to the DEV stand using the same mechanics as
Story 4.3
**And** it runs `docker image prune` on the host afterwards.

**Given** the prune step
**When** it runs
**Then** it does not remove images currently in use by the legacy stand or any other container
on s1.

**Given** the reset has run
**When** the stand is inspected
**Then** it serves the `main` build
**And** the outcome is announced in Slack.

### Story 4.7: Validate DEV Deploys Across Five Feature Branches

As a tech lead,
I want evidence that the new DEV path works on real branches within the time budget,
So that cutover is a decision based on observation rather than optimism.

**Acceptance Criteria:**

**Given** the DEV deploy workflow is complete
**When** five different real feature branches are deployed
**Then** all five succeed
**And** each deploy's wall-clock duration is recorded.

**Given** the recorded durations
**When** they are evaluated
**Then** each deploy completed in under 10 minutes
**And** any deploy that exceeded the budget has its dominant step identified and addressed.

**Given** deploys have been running for a week in parallel
**When** the legacy DEV stand is inspected
**Then** it is still running, still on its original port, and was never modified
**And** the developers using it report no disruption.

**Given** a branch with no built image
**When** a deploy is attempted for it
**Then** it fails fast with a message naming the missing tag
**And** the stand keeps serving its previous version.

### Story 4.8: Factor Out the Shared Deploy Mechanics

As a developer,
I want one definition of the deployment script rather than three copies,
So that a fix applied for one environment cannot silently miss the other two.

**Acceptance Criteria:**

**Given** the reuse support established in Story 1.3
**When** the shared mechanics are factored out
**Then** the copy, `down`, fail-fast pull, `up -d`, parameterized health check, lock and Slack
steps live in a single reusable definition
**And** the mechanism used is the one Story 1.3 proved works on this instance.

**Given** neither `workflow_call` nor composite actions are supported by this Forgejo version
**When** the fallback is chosen
**Then** the shared logic is extracted into a version-controlled shell script that the
workflows invoke
**And** the triplication is confined to a thin invocation rather than the whole procedure.

**Given** the shared definition
**When** it is parameterized
**Then** deploy-runner label, stand directory, container name, port, environment label and
image tag are all inputs
**And** no target host is passed, because the runner label determines the host (amended
2026-08-11; was ~~target host~~)
**And** no environment-specific value is embedded in it.

**Given** `deploy-dev.yml` from Story 4.3
**When** it is refactored onto the shared definition
**Then** a DEV deploy still succeeds end to end
**And** the health check still fails correctly against a stopped stand.

**Given** the shared definition exists
**When** the remaining deploy workflows are written in Epics 5 and 6
**Then** they consume it rather than copying it.

### Story 4.9: Cut DEV Over to the New Stand

As a developer,
I want DEV traffic pointed at the new stand,
So that the team uses the Forgejo-driven environment and the legacy one can be retired.

**Acceptance Criteria:**

**Given** a week of successful parallel operation from Story 4.7
**When** cutover is performed
**Then** the DEV DNS name or published port is switched to the new stand
**And** the switch is announced to the development team in advance.

**Given** the cutover has happened
**When** developers access DEV
**Then** they reach the new stand
**And** the application behaves as it did on the legacy stand.

**Given** the legacy stand is no longer receiving traffic
**When** it is decommissioned
**Then** it is stopped rather than deleted
**And** it is retained in stopped state for two weeks before removal.

**Given** a problem is found after cutover
**When** a revert is needed
**Then** the legacy stand can be restarted and traffic pointed back within the retention
window
**And** this revert path is documented.

---

## Epic 5: PRE-PROD Release Candidate Environment

A release engineer can deploy a specific image tag to a dedicated PRE-PROD stand backed by
its own Kong gateway, and the fact that a candidate was validated there is recorded in the
registry as the release history. This epic depends on the infrastructure commitment secured
in Story 1.6.

### Story 5.1: Stand Up the Isolated PRE-PROD Backend Network

As a release engineer,
I want PRE-PROD to reach a PRE-PROD backend rather than the DEV one,
So that validating a release candidate says something true about production readiness.

**Acceptance Criteria:**

**Given** the commitment secured in Story 1.6
**When** the isolated environment is created on s1
**Then** a Docker network `crm-network-preprod` exists
**And** a Kong gateway instance for PRE-PROD runs attached to it.

**Given** `nginx.conf:37-56` resolves `crm-kong-gateway` by name inside its network
**When** the PRE-PROD frontend container is attached to `crm-network-preprod`
**Then** that name resolves to the PRE-PROD Kong, not the DEV one
**And** the resolution is verified from inside the running container, not inferred from
configuration.

**Given** the DEV stand shares the host
**When** the PRE-PROD network is created
**Then** the DEV stand remains attached to `crm-network` and is unaffected
**And** no container is attached to both networks.

**Given** an end-to-end request path
**When** a request to `/api/` is issued against PRE-PROD
**Then** it is served by the PRE-PROD backend
**And** the DEV backend logs show no corresponding request.

### Story 5.2: Provision the PRE-PROD Stand on s1

As a release engineer,
I want a PRE-PROD stand reachable at its own address,
So that a release candidate can be validated the way a user would experience it.

**Acceptance Criteria:**

**Given** the parameterized compose file from Story 4.1
**When** the PRE-PROD stand is provisioned
**Then** it lives in `~/crm-prionex/fe-prionex-preprod/`
**And** its `.env` sets `FRONTEND_PORT=8081`, a distinct `CONTAINER_NAME`, a distinct
`COMPOSE_PROJECT_NAME`, and the `crm-network-preprod` network.

**Given** three stands now share s1
**When** all are running
**Then** their ports, container names and compose projects are mutually distinct
**And** none appears in another's compose project.

**Given** the DNS name and certificate from Story 1.6
**When** `preprod.crm-prionex.online` is configured
**Then** it resolves to the PRE-PROD stand
**And** it serves over TLS with a valid certificate.

**Given** the stand is provisioned
**When** registry access is configured
**Then** it uses the `read:package` token
**And** a manual pull of a `-preprod` tagged image succeeds.

### Story 5.3: Deploy a Specific Image Tag to PRE-PROD

As a release engineer,
I want to name the exact artifact that goes to PRE-PROD,
So that validation is performed against a known, reproducible candidate.

**Acceptance Criteria:**

**Given** `.forgejo/workflows/deploy-preprod.yml`
**When** its triggers are configured
**Then** `workflow_dispatch` is the only trigger
**And** no `push`, `schedule` or tag trigger exists.

**Given** the dispatch form
**When** it is presented
**Then** `image_tag` is a required input
**And** a dispatch without it is rejected rather than defaulting to anything.

**Given** a dispatch with a valid `image_tag`
**When** the deploy runs
**Then** it consumes the shared deploy definition from Story 4.8 rather than copying its
steps — compose placement, `down`, fail-fast pull, `up -d`, parameterized health check —
running on the deploy runner located on s1 (amended 2026-08-11; was ~~native `ssh`/`scp`,
compose copy~~)
**And** it acquires the Story 4.4 lock on the PRE-PROD stand directory.

**Given** an `image_tag` that does not exist in the registry
**When** the deploy runs
**Then** it fails before stopping the running container
**And** PRE-PROD keeps serving the previous candidate.

**Given** a successful deploy
**When** Slack is notified using the Story 4.5 mechanics
**Then** the message names PRE-PROD and the deployed `image_tag`.

### Story 5.4: Record the Validated Candidate in the Registry

As a release engineer,
I want the release history stored in the registry rather than in files on servers,
So that state is not scattered across hosts and the promotion guard has something to check.

**Acceptance Criteria:**

**Given** a successful PRE-PROD deploy
**When** the recording step runs
**Then** it creates the tag `preprod-current` pointing at the deployed image using
`docker buildx imagetools create`
**And** it creates the tag `preprod-<sha>` for the same image.

**Given** Option C encodes an environment discriminator in image tags
**When** `preprod-<sha>` is created
**Then** `<sha>` is the **commit** SHA, not the environment-suffixed tag string
**And** this is stated explicitly, because Epic 6's promotion guard matches on commit
identity.

**Given** a second candidate is later deployed to PRE-PROD
**When** the recording step runs again
**Then** `preprod-current` moves to the new image
**And** the previous `preprod-<sha>` tag still exists, preserving the history.

**Given** the retention policy from Story 1.11
**When** it runs
**Then** `preprod-current` and its target are never deleted
**And** the previous N `preprod-<sha>` tags are preserved as rollback and audit targets.

**Given** the registry after several candidates
**When** it is inspected
**Then** the sequence of `preprod-<sha>` tags reconstructs the validation history without
consulting any server.

### Story 5.5: Establish the Release Validation Checklist

As a release engineer,
I want a defined way to decide whether a candidate passed PRE-PROD,
So that "validated" means the same thing every release.

**Acceptance Criteria:**

**Given** the project currently has no end-to-end tests, only vitest
**When** the validation approach is defined
**Then** a written checklist of critical flows to verify manually exists
**And** each item states what is checked and what constitutes a pass.

**Given** the deploy workflow
**When** an `e2e` job is added after the health check
**Then** it exists as a placeholder that does not block the deploy
**And** its purpose and the intent to replace it with real tests are documented in the
workflow.

**Given** automated end-to-end coverage is out of scope here
**When** the story closes
**Then** a separate follow-up item for real E2E tests is recorded
**And** it is not silently absorbed into this migration's scope.

**Given** a candidate has been deployed
**When** the checklist is executed
**Then** the outcome is recorded against the specific `image_tag`
**And** a failed item blocks promotion to PROD.

### Story 5.6: Exercise the Full Release Cycle on an Empty Release

As a release engineer,
I want the whole PRE-PROD path rehearsed before it carries a real release,
So that the first real release is not also the first test of the machinery.

**Acceptance Criteria:**

**Given** all preceding Epic 5 stories are complete
**When** a release cycle is rehearsed with a change that alters nothing user-visible
**Then** the candidate is built, deployed to PRE-PROD, validated against the checklist, and
recorded in the registry
**And** every step is performed through the workflows, not manually.

**Given** the rehearsal
**When** it completes
**Then** `preprod-current` and `preprod-<sha>` exist for that candidate
**And** the total elapsed time is recorded.

**Given** the rehearsal surfaces defects in the workflows
**When** they are fixed
**Then** the rehearsal is repeated end to end rather than resumed from the failure point.

**Given** release scope freeze is a process agreement rather than a technical control
**When** the rehearsal is documented
**Then** it is stated explicitly that nothing prevents deploying a new tag to PRE-PROD during
validation
**And** the process expectation is written into the release regulation.

---

## Epic 6: Production Release and Verified Rollback

A release reaches production through Forgejo, rollback is proven in practice rather than in
theory, and the cutover happens without changing what production serves. This is where the
Option C compromise becomes visible and is recorded as tracked technical debt.

> **Accepted risk: the rollback horizon resets at cutover (recorded 2026-08-07).** Every image
> built before the migration lives in `ghcr.io/crm-prionex/fe-prionex`, and no action is taken
> on GitHub — which includes pulling from its registry. Those images are therefore
> unreachable. Rollback via Story 6.8 can only target versions built by Forgejo.
>
> The practical consequence: **the first Forgejo release is a one-way door.** Before it, the
> legacy pipeline can still put an older version back. After it, rollback depth starts at zero
> and grows one release at a time. Story 6.8 must be proven on a Forgejo-built version before
> the cutover, not after, because there is no older version to fall back to.
>
> This compounds the loss of the GitHub fallback recorded in Story 7.1 (cancelled). Together
> they mean Epic 6 carries no external safety net at all.

### Story 6.1: Disable the GitHub CD Deploy Job

> **CANCELLED — not applicable (decided 2026-08-07).** Disabling the job is an action on
> GitHub, and no action is taken on GitHub. GitHub is left running exactly as it is.
>
> The concern this story addressed is real and does not disappear: while GitHub still receives
> commits, a merge to `main` there deploys to s2 through the legacy pipeline. Once Forgejo
> also deploys to s2, **two pipelines can deploy to production independently.** Nothing in
> this plan prevents that.
>
> It is instead resolved outside the plan — see *External dependency: the GitHub transition*
> in the Overview. Until that transition happens, the overlap is accepted risk, and Epic 6
> must treat a concurrent legacy deploy as possible rather than excluded.

### Story 6.2: Publish the Production Approval Regulation

As a tech lead,
I want the production approval rules written down before the first Forgejo release,
So that the absence of a technical gate is a managed decision rather than an unnoticed gap.

**Acceptance Criteria:**

**Given** Forgejo has no equivalent of GitHub Environments with required reviewers
**When** the regulation is written
**Then** it states plainly that anyone with write access to the repository can dispatch
`deploy-prod.yml`
**And** it does not describe any technical control that does not exist.

**Given** approval must still happen
**When** the regulation is written
**Then** it names who approves a production release, and where that approval is recorded in
the tracker
**And** it states that the approval record must reference the specific `image_tag`.

**Given** the commit-identity promotion guard specified by FR16 and recorded in the decision
record from Story 1.2 is the only technical barrier
**When** the regulation is written
**Then** it describes what that guard does and does not prove
**And** it states that `rollback: true` bypasses it by design.

**Given** the regulation is complete
**When** it is published
**Then** it lives in the repository documentation
**And** the development and release teams have acknowledged it.

### Story 6.3: Rebuild the Running Production Commit into the Forgejo Registry

As a release engineer,
I want the commit production is currently serving present in the Forgejo registry,
So that the cutover can be rehearsed against the code already in production.

> **Changed (2026-08-07).** Originally this story *imported* the running image from ghcr. No
> action is taken on GitHub, and that includes pulling from its registry, so the image is
> rebuilt from the same commit instead. Under Option C production already receives a rebuilt
> image rather than the artifact validated on PRE-PROD, so this introduces no new compromise —
> it makes the story consistent with one the plan had already accepted (NFR11).

**Acceptance Criteria:**

**Given** production currently runs an image from ghcr.io
**When** the running commit is identified
**Then** it is determined from the running container on s2 — via its image labels or the
recorded deployment — not assumed from a branch name
**And** the identification is evidenced rather than asserted.

**Given** the identified commit
**When** it is built
**Then** it is built from that exact commit with the production build arguments
**And** pushed to `git.crm-prionex.com/crm/fe-prionex` tagged `sha-<commit>`.

**Given** the rebuilt image
**When** the current production state is recorded
**Then** it also carries the tag `prod-current`.

**Given** the rebuilt image
**When** it is compared with what production serves
**Then** it is confirmed to originate from the same commit
**And** it is recorded that it is **not** byte-identical, because it was rebuilt — so Story
6.9's "no-op deploy" is a no-op in code, not in bytes, and must be validated by behaviour
rather than by digest comparison.

**Given** the retention policy from Story 1.11
**When** it runs
**Then** these tags are protected as the current production and rollback targets.

### Story 6.4: Deploy to Production by Dispatch

As a release engineer,
I want to deploy a named release to production from Forgejo,
So that production delivery no longer depends on GitHub.

**Acceptance Criteria:**

**Given** `.forgejo/workflows/deploy-prod.yml`
**When** its triggers are configured
**Then** `workflow_dispatch` is the only trigger
**And** it accepts a required `image_tag` input and an optional `rollback` boolean input.

**Given** Option C requires a production-specific bundle
**When** a release deploy runs with `rollback` false
**Then** it rebuilds the image with the production `VITE_API_BASE_URL` and `VITE_WS_URL`
values
**And** the workflow output states explicitly that this is a rebuild, not a promotion of the
PRE-PROD artifact.

**Given** a rollback deploy runs with `rollback` true
**When** it executes
**Then** it pulls the existing tag without rebuilding
**And** no build step runs on this path.

**Given** the deploy targets s2
**When** the workflow declares `runs-on`
**Then** it targets the deploy runner located on s2 by its label
**And** no SSH credential is used, so production access cannot be lost by a key change.

> Amended 2026-08-11 (`sprint-change-proposal-2026-08-11-deploy-runner.md`). Was: *"Then it
> authenticates with the new `S2_SSH_KEY` from Story 1.12."* That key is no longer created —
> see the amended FR19 and Story 1.12. **Accepted trade-off, recorded by Oleg's explicit
> decision:** the s2 deploy runner holds that host's `docker.sock`, so a production deploy job
> has root-equivalent control of the s2 daemon. This is the hub's documented pattern and the
> only way this model reaches production.

**Given** the deploy sequence
**When** it executes
**Then** it consumes the shared deploy definition from Story 4.8 and acquires the Story 4.4
lock on the production stand
**And** Slack is notified on start, success and failure per Story 4.5.

### Story 6.5: Guard Promotion by Commit Identity

As a release engineer,
I want production to refuse a release whose commit was never validated on PRE-PROD,
So that the weakened promotion principle still has a real technical barrier behind it.

**Acceptance Criteria:**

**Given** an `image_tag` supplied for a release deploy
**When** the guard runs
**Then** it extracts the commit SHA from the tag and checks that `preprod-<sha>` exists in the
registry
**And** the deploy is refused if it does not.

**Given** Option C means the PROD image is rebuilt and byte-different from the PRE-PROD image
**When** the guard is documented
**Then** it states that it proves the **commit** passed PRE-PROD, not that the **artifact**
did
**And** the residual risk — a build-time variable difference reaching production unvalidated —
is named.

**Given** a deploy dispatched with `rollback` true
**When** the guard is evaluated
**Then** it is skipped, so any previously deployed production tag can always be restored.

**Given** a deliberately invalid dispatch
**When** an `image_tag` whose commit has no `preprod-<sha>` is submitted with `rollback` false
**Then** the workflow fails before touching s2
**And** the failure message names the missing `preprod-<sha>` tag.

**Given** the guard is in place
**When** the Option C technical debt record from Story 1.2 is reviewed
**Then** it is updated to describe the guard as implemented
**And** the remediation to full artifact promotion remains an open tracked item.

### Story 6.6: Record the Deployed Production Image

As a release engineer,
I want the registry to identify what production is running,
So that rollback targets and audit history do not depend on inspecting servers.

**Acceptance Criteria:**

**Given** a successful production deploy
**When** the recording step runs
**Then** it retags the deployed image as `prod-current` using `docker buildx imagetools create`.

**Given** a subsequent production deploy
**When** the recording step runs again
**Then** `prod-current` moves to the new image
**And** the previous image remains addressable by its own tag as a rollback target.

**Given** the retention policy from Story 1.11
**When** it runs
**Then** `prod-current` and the previous N production tags are never deleted.

**Given** the registry after several releases
**When** it is inspected
**Then** the production release history is reconstructable without connecting to s2.

### Story 6.7: Smoke-Check Production After Deploy

As a release engineer,
I want production verified immediately after a deploy,
So that a broken release is caught by the pipeline rather than by users.

**Acceptance Criteria:**

**Given** a completed production deploy
**When** the smoke check runs
**Then** it verifies the container reports healthy via `docker inspect` against the
parameterized container name.

**Given** the application must actually serve
**When** the smoke check runs
**Then** it issues `curl` requests against the critical paths
**And** each expected status code is asserted rather than merely logged.

**Given** errors may appear only after traffic arrives
**When** the smoke check runs
**Then** it inspects the last 5 minutes of container logs for ERROR entries
**And** their presence fails the check.

**Given** the smoke check fails
**When** the workflow completes
**Then** the run is marked failed and Slack reports the failure with the run link
**And** the operator is pointed at the `rollback: true` dispatch path already available from
Story 6.4.

### Story 6.8: Roll Back Production to a Previous Release

As a release engineer,
I want to restore the previous production release quickly,
So that a bad release is a short incident rather than a long one.

**Acceptance Criteria:**

**Given** a previously deployed production `image_tag`
**When** `deploy-prod.yml` is dispatched with that tag and `rollback` true
**Then** the promotion guard is skipped and the image is pulled without rebuilding.

**Given** the rollback executes
**When** it completes
**Then** the elapsed time is the pull plus container restart, with no build stage
**And** the measured duration is recorded.

**Given** the rollback completes
**When** the smoke check from Story 6.7 runs
**Then** it passes against the restored release.

**Given** the rollback has been performed
**When** the registry is inspected
**Then** `prod-current` points at the restored image.

**Given** this is a real rehearsal rather than a documented intention
**When** the story closes
**Then** an actual rollback has been executed against the production stand and observed to
work
**And** the procedure is documented with the observed timing.

### Story 6.9: Cut Production Over with a No-Op Deploy

As a release engineer,
I want the full production mechanism exercised without changing what production serves,
So that cutover risk is separated from release risk.

**Acceptance Criteria:**

**Given** the image imported in Story 6.3
**When** `deploy-prod.yml` is dispatched against it with `rollback` true
**Then** the deploy pulls that image from the Forgejo registry and restarts the stand
**And** the content served before and after the deploy is identical.

**Given** the no-op deploy
**When** it completes
**Then** the smoke check passes
**And** the stand is confirmed healthy and serving.

**Given** the mechanism has been proven
**When** the next real release is planned
**Then** it goes through the full Forgejo cycle — build, PRE-PROD, validation, production
**And** no manual deployment path is used.

**Given** the cutover is complete
**When** the outcome is recorded
**Then** it states that production is now delivered by Forgejo
**And** the Option C deviation from the promotion principle is restated in the release
documentation so it is not forgotten.

---

## Epic 7: Forgejo as the Single Source of Delivery

Forgejo is the only pipeline anyone works with, the documentation describes the process that
actually runs, and the keys that were held in GitHub Secrets no longer open anything.

> **Reduced by the no-GitHub-action decision (2026-08-07).** This epic originally decommissioned
> GitHub. Three of its five stories required acting on GitHub and are cancelled (7.1, 7.4) or
> reduced (7.2). What survives is everything achievable from our own side: the documentation
> (7.3) and the key rotation on the servers (7.5).

### Story 7.1: Observe Two Release Cycles with GitHub in CI-Only Mode

As a tech lead,
I want the Forgejo pipeline to carry real releases before GitHub is dismantled,
So that decommissioning is irreversible only after the replacement has proven itself.

> **CANCELLED — premise removed (decided 2026-08-07).** This story depended on Story 6.1
> putting GitHub into CI-only mode. 6.1 is cancelled and GitHub keeps running in full, so
> there is no "CI-only overlap" to observe and no decommissioning decision to gate.
>
> **The fallback it described is gone in a way worth stating plainly.** The story treated the
> still-enabled GitHub deploy job as a safety net — "could be re-enabled if the Forgejo
> pipeline failed badly". Re-enabling it would be an action on GitHub, so that net does not
> exist for us. Rollback lives entirely inside Forgejo (Story 6.8, redeploy of a previous
> `image_tag`), and Epic 6 must be proven on its own merits before production depends on it.
>
> Recording each Forgejo release cycle is still worth doing, but as ordinary release practice
> under the regulation in Story 6.2 — not as a gate on a decommissioning that will not happen.

### Story 7.2: Delete the Legacy Workflow Files

As a developer,
I want a single place where CI and CD are defined,
So that nobody has to guess which pipeline governs a change.

> **Reduced (2026-08-07).** Disabling anything in GitHub's repository settings is out of
> scope. This story now covers only the files in our tree. Deleting them changes nothing on
> GitHub: that copy keeps whatever it has.

**Acceptance Criteria:**

**Given** `.github/workflows/CI.yml` and `CD.yml` are the reference for what the Forgejo
workflows must reproduce
**When** Epics 2-6 are still in progress
**Then** the files are deliberately kept in place, so the port can be checked against them
**And** they are not deleted early.

**Given** every Forgejo workflow is in place and proven
**When** the files are removed
**Then** `.github/workflows/CI.yml` and `.github/workflows/CD.yml` are deleted
**And** the deletion goes through a pull request reviewed the normal way.

**Given** the files are removed
**When** the repository is reviewed
**Then** any remaining GitHub-specific configuration that is now dead is identified and
removed or documented as intentionally retained
**And** the retained `docs/forgejo-migration.md` record still describes what the legacy
pipeline did, so the deletion loses no history.

### Story 7.3: Publish the Updated Deployment Process Documentation

As a developer,
I want documentation that describes the process that actually runs,
So that a new team member is not onboarded onto a pipeline that no longer exists.

**Acceptance Criteria:**

**Given** the migration is complete
**When** `docs/deployment.md` is written
**Then** it describes the flow feature branch → DEV → pull request → `main` → PRE-PROD → PROD
**And** it names s1 as DEV plus PRE-PROD and s2 as PROD with their ports.

**Given** the new pipeline
**When** the documentation is written
**Then** it documents the image tagging scheme, the registry location, and the retention
policy
**And** it lists each workflow with its triggers and inputs.

**Given** the production approval rules from Story 6.2
**When** the documentation is written
**Then** it incorporates them, including the absence of a technical gate
**And** it links the Option C technical debt record from Story 1.2.

**Given** `README.md` references the old pipeline
**When** it is updated
**Then** its CI/CD section describes Forgejo
**And** no reference to GitHub Actions or ghcr.io remains except as migration history.

**Given** the documentation is published
**When** a developer follows it to deploy a branch to DEV
**Then** they succeed without asking for help.

### Story 7.4: Revoke GitHub Deployment Credentials

As a security-conscious engineer,
I want credentials removed from the platform that no longer needs them,
So that a compromised GitHub account cannot reach our servers or registry.

> **CANCELLED — not applicable (decided 2026-08-07).** Deleting GitHub Secrets and revoking
> ghcr tokens are actions on GitHub, and no action is taken on GitHub.
>
> **What compensates, and what does not:**
>
> - **SSH keys — compensated.** `DEV_SSH_KEY` and `PROD_SSH_KEY` stay in GitHub Secrets, but
>   Story 7.5 rotates the keys on the servers and removes the old ones from `authorized_keys`
>   on s1 and s2. After that the stored secrets open nothing. The secret is not deleted; it is
>   made worthless. 7.5 is now the only barrier here, so it is not optional.
> - **Host and user secrets — not compensated, low value.** `DEV_SSH_HOST`, `PROD_SSH_HOST`,
>   `DEV_SSH_USER`, `PROD_SSH_USER` remain readable. They disclose where the servers are and
>   under which account, which is reconnaissance, not access.
> - **ghcr tokens — not compensated.** Revoking them is only possible on GitHub. The package
>   `ghcr.io/crm-prionex/fe-prionex` and its publish credentials stay reachable by anyone with
>   the account or the token. **Accepted residual risk**, recorded here rather than left
>   unstated. It is also what keeps the legacy images pullable, which Story 6.3 relies on.
>
> Note the story's closing claim — "a deployment from GitHub is impossible because no workflow
> and no credentials remain" — does not hold under this decision. The workflow remains, and so
> do the credentials. What ends is only the usefulness of the SSH keys.

### Story 7.5: Rotate the SSH Keys That Were Held in GitHub Secrets

As a security-conscious engineer,
I want every key that was ever stored in GitHub Secrets replaced,
So that deleting the secret is not mistaken for the key becoming safe.

**Acceptance Criteria:**

**Given** the s1 key was stored in GitHub Secrets
**When** rotation is performed
**Then** a new key pair is generated and authorized on s1 for **administrative access**
**And** it is **not** stored in Forgejo, because no workflow uses SSH (amended FR19)
**And** administrative access with the new key is proven before the old one is removed.

> Amended 2026-08-11 (`sprint-change-proposal-2026-08-11-deploy-runner.md`). Was: *"stored as
> `S1_SSH_KEY` in Forgejo / And a deploy to DEV succeeds with the new key before the old one is
> removed."* Deployment no longer uses SSH, so there is no deploy to prove the key with and
> nothing to store. This story becomes pure security hygiene — rotating a key that was exposed in
> GitHub Secrets — rather than a delivery prerequisite.

**Given** the old s1 key
**When** the new key is proven working
**Then** the old key is removed from `authorized_keys` on s1.

**Given** the old s2 key was deliberately retained through the migration per NFR7
**When** the Forgejo production path has been proven by Story 6.8 and Story 6.9
**Then** the old s2 key is removed from `authorized_keys` on s2
**And** this is the final step of the migration, performed only after production delivery via
Forgejo is confirmed working.

**Given** all rotation is complete
**When** access is verified
**Then** deploys to DEV, PRE-PROD and PROD all succeed with the rotated keys
**And** no key that ever resided in GitHub Secrets remains authorized on any server.

**Given** the migration is finished
**When** the closing record is written
**Then** it lists what was rotated, what was revoked, and what remains as tracked technical
debt.
