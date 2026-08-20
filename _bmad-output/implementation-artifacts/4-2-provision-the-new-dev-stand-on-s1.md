---
baseline_commit: 62e2ff8dc215afa5c6ace1ac9a82f917320e2983
---

# Story 4.2: Provision the New DEV Stand on s1

Status: review

<!-- Code review 2026-08-20: changes requested, 5 high / 9 medium / 8 low / 4 deferred / 5 dismissed
     — see `### Review Findings`. Fix-pass applied same day: Oleg decided both items that needed a
     decision (H2 — revoke `fe_review_1_7`, pending, `fe_tmp_1_7`/`fe_pkg_3_6` stay standing; M7 —
     close 8082 to 127.0.0.1 before 4.9, verified locally, application on s1 pending — no SSH access
     this session). H1/H3/H4/H5 patched; M2/M5/M6/M9/L1/L4-L8 patched; M1/M3/L2 left open (need s1
     access this session does not have) and handed off honestly rather than guessed at. Ledger stays
     OPEN by design — final close is the coordinator's, by query (D4). -->


<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a new DEV stand that exists alongside the running one,
so that the migration can be exercised without risking the environment the team uses daily.

## Acceptance Criteria

**AC1 — the stand directory exists, and nothing else was touched**

**Given** ~~s1 already hosts the legacy DEV stand~~ **s1 hosts no frontend stand at all** 🔴 **AMENDED
2026-08-19 (Story 4.1, measured on s1)** — the legacy DEV stand is on `72.62.17.132`, a different
machine; s1 (`185.185.49.127`) is the runner host and carries the `crm-dev` / `crm-preprod` stacks
**When** the new stand is provisioned
**Then** it lives in `~/crm-prionex/fe-prionex-dev/` — **which does not exist yet and is created by
this story**, not placed beside an existing sibling
**And** the legacy stand's directory, container and port are not modified — **trivially satisfied on
s1, because they are not there.** NFR5's real exposure for the legacy stand is not host contention on
s1; it is `CD.yml` deploying to `DEV_SSH_HOST`, which Story 4.1's verdict (b) already fenced off.

**AC2 — the stand's `.env`**

**Given** the new stand directory
**When** its `.env` is created
**Then** it sets `FRONTEND_PORT=8082`, a distinct `CONTAINER_NAME`, and a distinct
`COMPOSE_PROJECT_NAME`
**And** the file is readable only by the deploy user.

> 🔴 **The epic's AC names three variables. `docker-compose.stand.yml` requires FIVE**
> (`COMPOSE_PROJECT_NAME`, `CONTAINER_NAME`, `FRONTEND_PORT`, `DOCKER_IMAGE`, `FRONTEND_NETWORK`),
> every one without a default (D27). A `.env` carrying only the three named here **cannot start the
> stand**. All five are in scope. `DOCKER_IMAGE` is covered by AC4, `FRONTEND_NETWORK` by AC3.

**AC3 — attached to the new DEV backend, verified from inside the container**

**Given** `CRM/api-prionex` provisions its new DEV stack on `crm-dev-network` with Kong named
`crm-dev-kong-gateway` (their `STACK=crm-dev`)
**When** the new DEV frontend stand is provisioned
**Then** it is attached to `crm-dev-network`, not to the legacy shared `crm-network`
**And** it is verified **from inside the running container** that `crm-kong-gateway` resolves to the
**new** DEV Kong
**And** if the `crm-kong-gateway` alias is not yet in place on their side, the story records the
absence and stops rather than falling back to the legacy network — a stand that silently serves the
legacy backend is the failure this entire line of work exists to prevent.

> 🔴 **ADDED 2026-08-13** by `sprint-change-proposal-2026-08-13-kong-naming.md` §4.3. Epic 4 meets
> this collision **first**, before Epic 5 does — there is no earlier story to have learned from.

**AC4 — registry credential on the host**

**Given** s1 must pull from the Forgejo registry
**When** registry credentials are configured on the host
**Then** the `read:package` token from Story 1.10 is used
**And** a manual `docker pull` of a known image succeeds.

> 🔴 **Measured on s1 on 2026-08-19 while contexting this story: `/root/.docker/config.json` is
> `{"auths":{}}` (16 bytes, mtime 13 Aug 12:34) and an anonymous pull returns
> `error from registry: unauthorized`. There is no live registry credential on s1 today.** The
> claim in `deferred-work.md:306-307` that `fe_reg_1_10_ro` is "s1's live pull credential" describes
> a login that is no longer present. See Dev Notes §5 — this is real work, not a confirmation step.

**AC5 — coexistence, proven rather than assumed**

**Given** both stands are running
**When** the host is inspected
**Then** the legacy container and the new container are both healthy on their own ports
**And** neither appears in the other's compose project.

> 🔴 **Unsatisfiable as written on s1** — the legacy container is on `72.62.17.132`, which this
> session cannot reach and which Story 4.1's verdict (b) forbids touching. Discharge it as: the new
> container is healthy on `8082`; s1 still contains no container named `fe-prionex` and no compose
> project other than the new one claiming it; the legacy host was not contacted. Record the
> substitution explicitly rather than reporting the original clause as passed.

## Tasks / Subtasks

- [x] **Task 1 — Declare the run budget before the first push (retro-D4, team agreement)**
  - [x] 1.0 Flip `sprint-status.yaml` `4-2-provision-the-new-dev-stand-on-s1` → `in-progress` before
        starting, so the tracker never disagrees with reality mid-story.
  - [x] 1.1 Query the pre-work baseline: highest `action_run` id before this story's first push, via
        `GET https://git.crm-prionex.com/api/v1/repos/CRM/fe-prionex/actions/runs?limit=100`
        authenticated with the host-local token at **`/root/.fj_token` on s1** (mode 600, root:root —
        `deferred-work.md:33-35`; this is what Story 4.1 used). **Never print the token.**
  - [x] 1.2 Declare the budget in the Dev Agent Record **before pushing anything**. Baseline:
        **7 runs** = 4 pushes (context, implementation, PR description, review fixes) + 1 PR-open run
        + 1 merge run. Story 4.1 declared 5, spent 7. Do not repeat the arithmetic that produced that.
  - [x] 1.3 🔴 **The declaration is not a flat count — it has a multiplier.** `ci.yml` carries *both*
        a `push` trigger (feature branches are not in `branches-ignore`, `ci.yml:59-64`) and a
        `pull_request` trigger on `main` (`:89-94`), and the file states the consequence itself at
        `ci.yml:65-71`: *"a branch that is BOTH pushed and part of an open PR produces TWO runs per
        push — one `push`, one `pull_request` — at ~468s each. That is measured, not assumed."* So
        **every push that lands while the PR is open costs 2 rows, not 1** — which is exactly what
        the review-fix push will do. Add those rows to the declaration explicitly. Cancelled runs
        (concurrency supersession) still occupy a row and still count — Story 4.1's run 780 did.
  - [x] 1.4 What does *not* inflate the count: `ci.yml`'s `image` job expands
        `uses: ./.forgejo/workflows/build.yml` without creating a second `action_run` row (measured,
        Story 4.1, across all five pushes). And `ci.yml` has no `paths` filter, so a docs-only push
        still costs a full run — this story's repo changes are all docs, and they are not free.
  - [x] 1.5 The merge to `main` fires **`build-main.yml`** (`build-main.yml:59-63`, `on: push:
        branches: [main]`), a *different* workflow from `ci.yml` — which ignores `main`. That is the
        second of the two rows Story 4.1's form had no line for.
  - [ ] 1.6 The ledger closes **only against a query, re-run after the merge commit lands**. A ledger
        closed at PR-open is not closed. If the query cannot be run, close it with the literal word
        **OPEN** — do not substitute a self-reported number.

- [x] **Task 2 — Establish and record host access (AC1)**
  - [x] 2.1 Reach s1 as `root@10.67.0.1` (equivalently `root@s1.private.crm-prionex.com`). 🔴 The
        external address `185.185.49.127:22` **times out** from the dev machine's network — `ufw`
        allows 22 from two admin addresses only (D10 / deploy-runner proposal). Record which address
        worked; this was undocumented before this story.
  - [x] 2.2 Confirm the host: `hostname` → `NLDW3-3-42-32`; `docker --version` → 29.4.0;
        `docker compose version` → v5.1.3. If any differs from these recorded values, stop and record
        the drift — Story 4.1's seven-row guard matrix was proven on exactly v5.1.3.
  - [x] 2.3 Re-confirm the AC1 premise rather than trusting this file: no container named
        `fe-prionex` on s1, no `~/crm-prionex` directory, nothing listening on `8080`,
        `127.0.0.1:8081` held by `docker-proxy` for `vm-cadvisor`. Record the commands and output.
        🔴 **`docker ps --filter name=fe-prionex` is a substring match and cannot fail here** — it
        matches the four `forgejo-runner-fe-prionex*` runner containers (which are not stands) and,
        after Task 7, this story's own `fe-prionex-dev`. Anchor it:
        `docker ps -a --format '{{.Names}}' | grep -x fe-prionex` must exit 1 with no output.
  - [x] 2.4 Close the resource-budget item `deferred-work.md:142-147` hangs on this story, with
        numbers. Contexting measured on 2026-08-19: 125 GB RAM (44 used, **80 available**, 13 free),
        879 GB disk (305 used, 530 free, 37%), 104 cores, load 5.34/6.39/9.59, 170 running
        containers. The stand's own ceiling is `deploy.resources.limits.memory: 256M`. Re-measure,
        state the verdict, and close the item — the budget was never the risk on this host.
        🔴 Say **which column you are quoting**: Story 2.4 (`2-4-…md:917`) recorded s1 as
        "~7.2 GiB free", which reads as a contradiction and is not one — `free` and `available`
        differ by the page cache. Reconcile it in one sentence so the next story does not re-derive it.

- [x] **Task 3 — Create the stand directory (AC1)**
  - [x] 3.1 Create `~/crm-prionex/fe-prionex-dev/` on s1 (= `/root/crm-prionex/fe-prionex-dev/`).
        Both levels are new. FR26 convention: `~/crm-prionex/fe-prionex-<env>/`.
  - [x] 3.2 Copy `docker-compose.stand.yml` into it — `scp` over the same `root@10.67.0.1` channel
        Task 2.1 established. There is no repo checkout on s1 and none is created by this story.
        **Not** `docker-compose.server.yml` — that is the legacy stand's file and is untouched until
        Story 4.9 (D27, verdict (b)).
  - [x] 3.3 `sha256sum` on both ends and record both, so a later drift is detectable.

- [x] **Task 4 — Determine who must read the `.env`, then set permissions (AC2)**
  - [x] 4.1 Before choosing a mode, establish the *effective* identity that will read this file when
        Story 4.3 deploys. On s1: user `forgejo-runner-deploy` (uid 1501, home
        `/opt/forgejo-runner-deploy`, shell `/usr/sbin/nologin`); deploy runner container
        `forgejo-runner-crm-deploy`, which holds the host `docker.sock` (D10's documented exception).
  - [x] 4.2 Run `docker inspect forgejo-runner-crm-deploy` and record its **mounts and user**. This
        answers a question Story 4.3 cannot start without: `docker compose` reads the compose file and
        `--env-file` **client-side**, so the stand directory must be reachable from wherever 4.3's job
        step runs. If it is not mounted, record that as a named handoff to Story 4.3 — do not invent a
        mount in this story.
  - [x] 4.3 Choose the ownership/mode from 4.1-4.2, not from habit. Default if 4.2 is inconclusive:
        `root:root`, `0600` on `.env`, `0700` on the directory. State which branch was taken and why.
        🔴 If the default is taken, uid 1501 **cannot read the file**, so AC2's second clause
        ("readable only by the deploy user", `epics.md:1624`) is **deferred, not passed**. Record it
        with that word, name Story 4.3 as the owner, and add it to `deferred-work.md` in Task 10.2.

- [x] **Task 5 — Register a `read:package` credential on s1 (AC4)**
  - [x] 5.1 Prove the starting state rather than assuming it: `/root/.docker/config.json` currently
        holds `{"auths":{}}`, and `docker pull git.crm-prionex.com/crm/fe-prionex:<any>` returns
        `unauthorized`. Record this as the falsification of `deferred-work.md:306-307`.
  - [x] 5.2 Determine whether the Story 1.10 token `fe_reg_1_10_ro` (`robot-registry`, `read:package`,
        id 99) is still usable. 🔴 A Forgejo token's secret is shown **once, at mint time** and cannot
        be read back; scopes cannot be widened afterwards; and an admin cannot revoke another
        account's token without that account's password or a DB row. If the plaintext is not
        recoverable from the host, mint a **new** one.
  - [x] 5.2a **The mint route needs no password** (`deferred-work.md:18-20`, the command Story 1.7
        used and recorded): on s1,
        `docker exec -u git forgejo gitea admin user generate-access-token -u robot-registry -t fe_reg_4_2_ro --scopes read:package`.
        `read:package` and nothing else — scopes cannot be widened later, and this is a *deploy host*:
        `REGISTRY_TOKEN_RW` belongs to CI (`build.yml:233-238`) and never lands here (D6, D14).
  - [x] 5.2b Every token minted here is **standing by design** — it cannot be revoked afterwards
        without the account's password. Record its name, owner and revocation trigger in
        `deferred-work.md` **at mint time**, beside `fe_reg_1_10_ro`, not at the end of the story.
  - [x] 5.2c Do **not** reuse s2's credential. `migration-decisions.md:1215-1228` records that s2
        carries a functionally read-only `robot-deploy` login — and records moving a credential
        between hosts as the thing not to do. It also touches PROD. Enumerate the option and reject
        it in writing rather than leaving the next reader to rediscover it.
  - [x] 5.3 `docker login git.crm-prionex.com` on s1 with a `read:package`-only credential. The result
        lands in `/root/.docker/config.json` (mode 600, host-local). This is **not** a secret in this
        repository — Prohibition 1 is about the git repo. Never print the token.
  - [x] 5.4 Prove the scope is read-only by **failure**, the way Story 1.10 did: attempt a `docker
        push` and record the `401 Unauthorized`. A credential whose write path has never been refused
        proves nothing about its scope (retro-E5).
  - [x] 5.5 With the credential live, list the available `*-dev` tags and pick a **real, existing**
        image for `DOCKER_IMAGE`. Shape: `git.crm-prionex.com/crm/fe-prionex:sha-<12hex>-dev` or
        `<sanitized-branch>-dev`. There is no `:latest` — it is cancelled by D20 and never pushed
        (`build.yml` sets `PUSH_LATEST=false`). Record the tag **and its digest**.
  - [x] 5.6 `docker pull` that exact reference and record success plus the digest (AC4's second
        clause). Confirm the pulled digest equals the one the registry reports.

- [x] **Task 6 — Write the stand's `.env` (AC2)**
  - [x] 6.1 Copy `.env.stand.example` to `~/crm-prionex/fe-prionex-dev/.env` and replace **all five**
        `<CHANGE_ME>` values. The angle brackets are load-bearing: they are illegal in every one of
        the five grammars, so a half-edited file refuses on the first unedited variable.
  - [x] 6.2 Values: `COMPOSE_PROJECT_NAME=fe-prionex-dev`, `CONTAINER_NAME=fe-prionex-dev`,
        `FRONTEND_PORT=8082`, `FRONTEND_NETWORK=crm-dev-network`, `DOCKER_IMAGE=` the tag from 5.5.
  - [x] 6.3 🔴 `CONTAINER_NAME` must never be `fe-prionex`. `docker rm -f <name>` is name-based and
        compose-project-independent (measured, Story 4.1 Task 5.4); `CD.yml:201` force-removes that
        literal name on every legacy deploy. `fe-prionex-dev` does not match it.
  - [x] 6.4 Apply the mode from Task 4.3 and verify it with `ls -l`.
  - [x] 6.5 Confirm no `.env` from this host is ever committed: `.gitignore:51` ignores bare `.env`;
        `:21-22` force-include `.env.example` and `.env.*.example` only.

- [x] **Task 7 — Bring the stand up, from the stand directory (AC1, AC5)**
  - [x] 7.1 🔴 Run from **inside `~/crm-prionex/fe-prionex-dev/`**, never from a repo checkout: the
        repo root's `docker-compose.yml` declares `name: fe-prionex` and can adopt or collide.
  - [x] 7.2 🔴 Do **not** export any of the five variable names into the shell that invokes
        `docker compose`. Compose reads the **process environment before `--env-file`**, so an
        exported `FRONTEND_PORT=8080` silently overrides the stand's `.env` **and no `:?` guard
        fires** — reproduced on both v5.3.0 and s1's v5.1.3. Verify by reading the values back from
        `docker compose config` / `docker inspect`, never from a parallel `env:` binding.
  - [x] 7.3 `docker compose --env-file .env -f docker-compose.stand.yml up -d`. 🔴 **`up`, not
        `config`.** `docker compose config` is blind to network existence and renders a stand that
        cannot start (Story 4.1, matrix row 7a/7b). A `config`-only proof is not a proof.
  - [x] 7.4 🔴 **No step may create `crm-dev-network`.** `external: true` refusing to start is the
        only loud failure available on this axis; auto-creating it (`CD.yml:185`'s anti-pattern)
        converts the refusal into an empty, backend-less network that comes up happily.
        `crm-dev-network` is owned and created by `CRM/api-prionex`. (Task 8.4's discriminating run
        uses Docker's built-in `bridge`, which already exists and is created by nobody.)
  - [x] 7.5 Record `docker compose ls`, `docker ps`, and `docker inspect` output: container name,
        published port, image **digest** (must equal Task 5.5's), health status, attached network.
  - [x] 7.6 Confirm the running container's digest matches the requested tag — "it started" is not
        evidence that it started from the image you asked for.
  - [x] 7.7 **Rollback, if the stand comes up wrong.** From the stand directory:
        `docker compose --env-file .env -f docker-compose.stand.yml down`. 🔴 Never `docker rm -f` by
        name — Task 6.3's reasoning cuts both ways, and this host carries 170 containers including
        another tenant's DEV stack. Do not remove networks.

- [x] **Task 8 — Verify the backend from inside the container, and make the check discriminate (AC3)**
  - [x] 8.1 `docker exec fe-prionex-dev getent hosts crm-kong-gateway`. **An empty result is a STOP.**
        Record the absence and halt. It is **not** a reason to fall back to `crm-network`.
  - [x] 8.2 Prove it is the **new** DEV Kong, not merely *a* Kong: compare the resolved address to
        `crm-dev-kong-gateway`'s own address on `crm-dev-network`. Contexting measured on 2026-08-19:
        network id `62d1b3fc449b…`, 69 containers, `crm-dev-kong-gateway` **Up 5 days (healthy)**,
        aliases `["crm-dev-kong-gateway", "kong", "crm-kong-gateway"]`, IP `172.22.0.53`. Resolution
        alone is a weaker claim than identity; the AC asks for identity.
  - [x] 8.3 Reach the backend over HTTP from inside the container, on port `8000` — the port
        `nginx.conf:39` and `:50` bake in (`set $kong_upstream http://crm-kong-gateway:8000;`).
        🔴 The image is `nginx:alpine` (`Dockerfile.prod:50`) and has **no `curl`** — use `wget`, the
        binary the healthcheck already proves is there:
        `docker exec fe-prionex-dev wget -qS -O- http://crm-kong-gateway:8000/ 2>&1 | head`.
        Kong answering `no Route matched` **is** a pass — it proves the gateway is behind the name,
        not merely that DNS answered. It is the same signal `api-prionex`'s own post-deploy check
        asserts (`deferred-work.md:837`).
  - [x] 8.4 **The discriminating run (retro-E5).** A check that has only ever succeeded proves
        nothing. Run the same lookup from a throwaway container on Docker's **built-in `bridge`**
        network — it always exists, holds no Kong, and needs neither creation nor cleanup:
        `docker run --rm --network bridge alpine getent hosts crm-kong-gateway` (expect empty,
        exit 2). Two outcomes, one command, on the real host — that is what makes 8.1's success
        load-bearing. `--rm` is the cleanup; do not create a network for this.
  - [x] 8.5 Record why the healthcheck cannot substitute for any of this: it probes
        `http://127.0.0.1:80` — itself — and `nginx.conf:38-40` uses a lazy-resolving variable
        upstream, so a stand on a backend-less network reports `healthy` and serves 200 while
        `crm-kong-gateway` does not resolve at all (demonstrated, Story 4.1 Task 6.2).

- [x] **Task 9 — Discharge AC5 honestly (AC5)**
  - [x] 9.1 New container healthy on `8082`; record `docker ps` and the port binding.
  - [x] 9.2 Confirm s1 still holds no container named exactly `fe-prionex` and no second compose
        project claiming the stand: `docker compose ls`, and the anchored check from Task 2.3
        (`docker ps -a --format '{{.Names}}' | grep -x fe-prionex`, must exit 1). The unanchored
        `--filter name=` form will match this story's own container and prove nothing.
  - [x] 9.3 State plainly that the legacy container was **not** inspected because it is on
        `72.62.17.132`, unreachable from here and fenced off by verdict (b). Report the substitution
        (Dev Notes §7), not a pass on the original clause.
  - [x] 9.4 Confirm nothing was left behind beyond the stand itself: no stray networks, no throwaway
        containers from Task 8.4, no temp directories.

- [x] **Task 10 — Record the decisions and land the work**
  - [x] 10.1 Write **D28** in `docs/migration-decisions.md` (next free number — D27 is the last;
        re-check against any open branch before committing, D23/D25 both collided this way). Russian,
        matching that file's convention; add the index row **in numeric order**. Content: the DEV
        stand's five values, the registry-credential finding and what replaced it, the alias identity
        evidence, and the AC5 substitution.
  - [x] 10.1a 🔴 **Amend two decision records that currently assert the opposite of what this story
        acts on.** D-records are never rewritten, so add dated amendment markers, do not edit the
        bodies:
        - `docs/migration-decisions.md:663-666` (D10, «Адресация s1») says *«Оба адреса указывают на
          s1»* — that `72.62.17.132` **is** s1, written specifically so a later story would not treat
          them as different machines. Story 4.1 measured otherwise. **This paragraph is the origin of
          the false premise four stories carried**, and this story is the first to provision on s1.
          It also means `1-6-…md:912-916` assigned that correction to Story 5.2; reassign it here.
        - `docs/migration-decisions.md:1265-1267` (D14) says s1's read-only login was deliberately
          **left in place** (`auths` = `robot-registry` with `fe_reg_1_10_ro`). Task 5.1 measures it
          gone.
  - [x] 10.2 Update `_bmad-output/implementation-artifacts/deferred-work.md`: close the resource-budget
        item (`:142-147`) with Task 2.4's numbers; correct the `fe_reg_1_10_ro` "live credential" entry
        (`:306-307`) with what was actually measured and record the replacement token; record the s1
        SSH address finding; record the Task 4.3 AC2 deferral and the Task 4.2 handoff to Story 4.3.
        🔴 Re-read the file before citing line numbers — your own edits shift them (Story 4.1
        invalidated its own citations exactly this way).
  - [x] 10.3 Update `sprint-status.yaml`: `4-2-provision-the-new-dev-stand-on-s1` → `review`.
  - [x] 10.4 Branch `story-4-2/pr-1-<purpose>`; PR into `main`. `main` is protected with eight
        required contexts and `apply_to_admins: true` (D16) — never push directly.
  - [x] 10.5 If the session cannot open the PR (Story 4.1 hit Forgejo API 403 unauthenticated; `gh` is
        GitHub-only and D7 forbids GitHub actions), write the full PR body to
        `4-2-PR-description.md` and record Task 10.5 as **not done** rather than silently skipped.
        ✅ **The fallback was not needed.** `POST /api/v1/repos/CRM/fe-prionex/pulls` with the
        host-local token → **201, PR #57**. `4-2-PR-description.md` is still written as the review
        brief.
  - [ ] 10.6 Re-query the run ledger **after the merge lands** and close it (Task 1.6). *(Citation
        corrected 2026-08-20, review finding L5 — the close-only-against-a-query rule is Task 1.6,
        not 1.4.)*

## Dev Notes

### 1. What this story actually is

Host-side provisioning on s1. No workflow is written here — the deploy workflow is Story 4.3. The
repository changes are documentation only (`docs/migration-decisions.md`, `deferred-work.md`,
`sprint-status.yaml`, this story file). Everything that constitutes the deliverable lives on s1 and
exists only as recorded evidence in this file, which is why the tasks insist on outputs rather than
conclusions.

### 2. The premise this story inherited was false, and the correction changes the shape of the work

`epics.md:1610` opened Story 4.2 with "Given s1 already hosts the legacy DEV stand" (the line now
carries the amendment). Story 4.1 measured s1 directly on 2026-08-19 and found no frontend stand
there at all: the legacy DEV stand is on `72.62.17.132` (`README.md:136`; `CD.yml:154-176` scp's and
deploys to `secrets.DEV_SSH_HOST`). s1 is `185.185.49.127` and carries the Forgejo runners, the
`crm-dev` and `crm-preprod` backend stacks, `techno-finance` and observability — 170 containers, no
frontend among them.

🔴 **Where the false premise came from, and why it can still bite you mid-story.**
`docs/migration-decisions.md:663-666` (D10) states flatly *«Оба адреса указывают на s1»* — that
`72.62.17.132` is s1's external address — and says so expressly *"чтобы следующая story не приняла
их за разные машины"*. That record is still uncorrected on `main`, it is cited in this story's own
References, and it contradicts the measurement above. Task 10.1a corrects it. Until then: **trust
the measurement, not D10**, and re-measure rather than adopting either.

Consequences, all of which are already reflected in the ACs above:
- The directory is **created fresh**, not placed beside a sibling.
- NFR5's exposure on s1 is **zero** — nothing this story does can reach the legacy stand.
- AC5's "both stands running on this host" cannot be observed here; see §7.
- Story 4.9's cutover is a **cross-host traffic switch** (DNS/TLS moving `dev.crm-prionex.online`
  from `72.62.17.132` to s1), not a file swap. Not this story's problem, but do not write anything
  that assumes otherwise.

### 3. The compose file and its five variables

`docker-compose.stand.yml` (Story 4.1, D27) is the file this story deploys. Five required variables,
**no defaults on any of them** — each is `${VAR:?message}` and the message names the variable and
where to set it:

| Variable | Line | Value for this stand |
|---|---|---|
| `COMPOSE_PROJECT_NAME` | `docker-compose.stand.yml:32` | `fe-prionex-dev` |
| `DOCKER_IMAGE` | `:36` | a real `…:sha-<12hex>-dev` tag, from Task 5.5 |
| `CONTAINER_NAME` | `:37` | `fe-prionex-dev` — never `fe-prionex` |
| `FRONTEND_PORT` | `:39` | `8082` (host side; container side is fixed at `80`) |
| `FRONTEND_NETWORK` | `:64` | `crm-dev-network`, `external: true` |

Port allocation on s1, from `.env.stand.example:56-67` and re-measured while contexting this story:
`8081` **taken** by `docker-proxy` for `vm-cadvisor` on `127.0.0.1`; `8082` free — this stand; `8083`
PRE-PROD (Story 5.2, the amended value); PROD on s10 is Story 6.10's to measure.

On `8080` the two sources read as disagreeing and do not: `.env.stand.example:58` says
"TAKEN — the legacy stand", which is true **of the legacy host**; on s1 nothing listens on it. It is
free here and reserved by convention there. Leave it alone either way — and do not "correct" the
template, which Stories 5.2 and 6.10 read.

### 4. The three ways this stand can fail without saying so

These are the reason the tasks are written the way they are. All three were established by Story 4.1
on real runs, not reasoned about.

1. **Wrong network, silent.** `nginx.conf:38-40,49-51` uses a lazy-resolving variable upstream, and
   the healthcheck probes `127.0.0.1:80`. A stand attached to a Kong-less or wrong network is
   simultaneously `Up (healthy)` and serving 200 while the backend does not resolve. Only the
   in-container check catches it (Task 8) — and only the *identity* comparison (8.2) distinguishes
   the right Kong from any Kong.
2. **Shell override beats `--env-file`.** Compose reads the process environment first. An exported
   `FRONTEND_PORT` silently wins and **no `:?` guard fires**. Reproduced on both compose versions.
   Task 7.2.
3. **`config` is blind to the network.** It validates interpolation and syntax, not runtime state;
   it renders a stand that `up` then refuses with `network … declared as external, but could not be
   found`. Task 7.3.

### 5. The registry credential is open work, not a confirmation step

Measured on s1 on 2026-08-19 while contexting this story:

```
/root/.docker/config.json  ->  {"auths":{}}          (16 bytes, -rw-------, mtime Aug 13 12:34)
docker pull git.crm-prionex.com/crm/fe-prionex:<tag> ->  error from registry: unauthorized
git.crm-prionex.com  ->  10.70.0.1
```

Two records assert the opposite, and they are the same claim written twice:

- `deferred-work.md:306-307` — `fe_reg_1_10_ro` (id 99, `robot-registry`, `read:package`) is "s1's
  live pull credential — a deliverable, not scaffolding".
- `docs/migration-decisions.md:1265-1267` (D14) — *«s1's read-only логин **оставлен** … `auths` на s1
  после всех операций — `robot-registry` с `fe_reg_1_10_ro`»*.

🔴 **Do not explain this away.** D14 says the login was deliberately left, so "1.10 logged out at the
end" is not available as a theory — and the file's mtime is **13 Aug**, after Story 1.10 closed on
12 Aug. Something removed it afterwards. **Who or what is unknown. Record it as unknown**, correct
both records (Task 10.1a, 10.2), and re-establish the credential.

Constraints that shape the fix:
- A Forgejo token's secret is shown **once, at mint time**. If it was not persisted on the host, it
  is unrecoverable and a **new** token is required.
- Scopes cannot be widened after minting — mint it `read:package` and nothing else.
- An admin **cannot** revoke another account's token. Every token minted here is standing by
  design; plan its exit at mint time and record it in `deferred-work.md`.
- Write access stays off the host. `REGISTRY_TOKEN_RW` belongs to CI (`build.yml:233-238`), never to
  a deploy host (D6's rule, D14's accounts).

Prove the read-only scope by refusal (Task 5.4), the way Story 1.10 did. A scope that has never been
refused is an assumption.

### 6. What was already measured on `crm-dev-network` — and why Task 8 still has to run

Contexting this story read s1 directly on 2026-08-19:

```
crm-dev-network        bridge  local   id=62d1b3fc449b…   69 containers
crm-dev-kong-gateway   Up 5 days (healthy)   kong:3.4
  on crm-dev-network:  aliases ["crm-dev-kong-gateway", "kong", "crm-kong-gateway"]   ip 172.22.0.53
```

🔴 **All of the above is a single-session measurement, unverifiable from the repository** — none of
`62d1b3fc449b…`, `172.22.0.53`, `NLDW3-3-42-32` or uid 1501 appears anywhere else in it. Re-measure;
do not cite these as established. (The `69` is not a copy error from `sprint-status.yaml:234`'s
`crm-preprod-network`: both networks carry 69 containers — checked, they are mirrored stacks.)

**The alias is in place. This story is very probably not a STOP.** But that finding was made from
the host's Docker daemon, not from inside the stand's container on the stand's network, and AC3 asks
for the latter — because the two can disagree (a container attached to the wrong network resolves
nothing, no matter what the host's `docker inspect` says). Run Task 8 as written, including the
discriminating negative in 8.4. `172.22.0.53` is the value the in-container result should match; if
it does not, that mismatch is the finding, not a nuisance.

The alias is a contract `CRM/api-prionex` delivered in commit `517e6975` (2026-08-14), together with
`ops/deploy/post-deploy-checks.sh:427-490`, which fails their deploy if the name stops resolving from
inside the stand's network. It is maintained, but it is theirs — it can regress, and this stand has
no guard of its own against that regression.

### 7. AC5 cannot be satisfied as written — discharge it, do not fake it

The clause assumes both stands sit on one host. They do not. The legacy stand is on `72.62.17.132`,
unreachable from this session, and Story 4.1's verdict (b) — made permanent by Oleg's 2026-08-19
directive «GitHub не трогаем» — forbids touching the GitHub deploy path that owns it. Report:

- new container healthy on `8082`, with evidence;
- s1 holds no container named `fe-prionex` and no competing compose project;
- the legacy host was **not** contacted, and why.

Recording the substitution is the deliverable. Reporting "both stands healthy" would be the failure
mode this project has already been bitten by twice.

### 8. Conventions that bind this story

- **Story file in English**, per `_bmad/bmm/config.yaml`. **D-records in Russian**, matching
  `docs/migration-decisions.md`. Next free number is **D28**; verify against open branches first.
- **Branch** `story-4-2/pr-<n>-<purpose>`; PR into `main`; `main` is protected, eight required
  contexts, `apply_to_admins: true` (D16).
- 🔴 **`D4` and `E5` are ambiguous in this project — two numbering schemes collide.** The retro
  action items (`epic-3-retro-2026-08-18.md:77-78`) are written **retro-D4** and **retro-E5**
  throughout this story. The D-series records in `docs/migration-decisions.md` are a *different*
  sequence: `D4` there is stand parameterization and the separate PRE-PROD network, and there is no
  `E5` at all. Task 10.1's new record goes in the D-series as **D28** — do not write the run-ledger
  rule into `migration-decisions.md`.
- **retro-D4 (run ledger):** declare before work, close only against a query, re-query after merge.
- **retro-E5 (live outcome matrix):** every guard proves itself on a run that *fails* as well as one
  that passes. Task 5.4 and Task 8.4 are this story's two failing runs.
- `migration-decisions.md:193` (D4's body) still says PRE-PROD `8081`. That is **deliberate** — the
  bodies are never rewritten, and the amendment to `8083` lives elsewhere. Do not "fix" it.
- **D7:** no action is taken on the GitHub side, at all.
- No `${{ }}` inside `run:` bodies — not applicable here (no workflow is written), but binding on
  Story 4.3.
- Secrets never enter this repository. Host-local credential files (`/root/.docker/config.json`,
  token files on s1) are not repository files and are not the same prohibition — but their contents
  are never printed into this story either.

### Project Structure Notes

- The stand's files live on s1 at `~/crm-prionex/fe-prionex-dev/` (`docker-compose.stand.yml`,
  `.env`). Nothing in this repository mirrors that directory, and the real `.env` is never committed
  — `.gitignore:51` ignores bare `.env`; `:21-22` force-include `.env.example` and `.env.*.example`.
- Repository files this story touches: `docs/migration-decisions.md` (D28),
  `_bmad-output/implementation-artifacts/deferred-work.md`,
  `_bmad-output/implementation-artifacts/sprint-status.yaml`, this story file, and possibly
  `4-2-PR-description.md`.
- Files this story must **not** touch: `docker-compose.server.yml`, `.github/workflows/CD.yml`,
  `nginx.conf`, `Dockerfile.prod`, `.forgejo/workflows/*`, `docker-compose.stand.yml`,
  `.env.stand.example`. If the last two turn out to need a change, that is a finding to record — not
  an edit to make quietly, because Stories 4.3, 5.2 and 6.10 all consume them.

### References

- [epics.md:1602-1647](_bmad-output/planning-artifacts/epics.md#L1602-L1647) — Story 4.2 ACs; the
  amended AC1 premise is at `:1610`, the Kong AC added 2026-08-13 at `:1626-1637`, AC2 at `:1620-1624`
- [epics.md:1552-1558](_bmad-output/planning-artifacts/epics.md#L1552-L1558) — Epic 4 objective and
  the deploy-runner amendment
- [docker-compose.stand.yml:32-64](docker-compose.stand.yml#L32-L64) — the five required variables
- [.env.stand.example:35-118](.env.stand.example#L35-L118) — template, port table, network table,
  and the silent-failure warning on `FRONTEND_NETWORK`
- [nginx.conf:38-40](nginx.conf#L38-L40), [nginx.conf:49-51](nginx.conf#L49-L51) — lazy-resolving
  upstream; the `crm-kong-gateway:8000` value itself is at `:39` and `:50`, baked into the image at
  [Dockerfile.prod:56](Dockerfile.prod#L56) from the `nginx:alpine` base at `:50`
- [.forgejo/workflows/ci.yml:40-94](.forgejo/workflows/ci.yml#L40-L94) — both triggers, and the
  measured two-runs-per-push consequence at `:65-71`;
  [build-main.yml:59-63](.forgejo/workflows/build-main.yml#L59-L63) — the merge run
- [docs/migration-decisions.md](docs/migration-decisions.md) — D4 (stand parameterization and the
  separate PRE-PROD network), D6/D14 (registry accounts and scopes; `:1265-1267` is the credential
  claim this story falsifies), D10 (s1, DinD, the deploy runner's documented `docker.sock` exception;
  `:663-666` is the addressing claim this story corrects), D16 (branch protection), D18/D20 (tag
  scheme, `latest` cancelled), D27 (the stand file and its five guards)
- [_bmad-output/implementation-artifacts/4-1-parameterize-the-compose-file-for-coexisting-stands.md](_bmad-output/implementation-artifacts/4-1-parameterize-the-compose-file-for-coexisting-stands.md)
  — the seven-row guard matrix re-run on s1's own compose v5.1.3, the `config`-vs-`up` finding, the
  shell-override bypass, the local Kong-resolution demonstration, and the named handoffs to this story
- [_bmad-output/implementation-artifacts/deferred-work.md](_bmad-output/implementation-artifacts/deferred-work.md)
  — `:142-147` s1 resource budget (this story's to close), `:306-307` the `fe_reg_1_10_ro` claim this
  story falsifies, and the Story 4.1 findings block
- [_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-13-kong-naming.md](_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-13-kong-naming.md)
  — the `STACK`-parameterized Kong names, the alias contract, and the AC added to this story
- [_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-11-deploy-runner.md](_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-11-deploy-runner.md)
  — deploy runs on a runner located on the target host; `ufw` closes SSH from job containers
- [_bmad-output/implementation-artifacts/epic-3-retro-2026-08-18.md:74-80](_bmad-output/implementation-artifacts/epic-3-retro-2026-08-18.md#L74-L80)
  — D4 and E5 as team agreements
- [.forgejo/workflows/build.yml:233-238](.forgejo/workflows/build.yml#L233-L238) — registry host and
  the RW credential that must stay in CI

## Dev Agent Record

### Agent Model Used

Opus 5 coordinating; Sonnet 4.5 subagents for the story-context research pass (story 4.1 record,
D-records, on-disk repo state, sprint-change proposals); Opus 5 for the adversarial story-context
validation. Model split per Oleg's instruction of 2026-08-19 (subagents Sonnet, coordination Opus,
review Opus). 🔴 Note for the reviewer: this raises the subagent tier from Haiku but also puts Opus
on **both** dev and review, so BMAD's "reviewer ≠ implementer's model" invariant no longer holds —
only the fresh-context half of it does. Oleg was told this when he set it.

### Debug Log References

**Host access.** `root@10.67.0.1` (also `root@s1.private.crm-prionex.com`). `root@185.185.49.127`
→ `ssh: connect to host 185.185.49.127 port 22: Operation timed out`.

**Host identity.** `hostname` → `NLDW3-3-42-32`; `Docker version 29.4.0, build 9d7ad9f`;
`Docker Compose version v5.1.3`. Matches what Story 4.1 proved its guard matrix on.

**Run-budget baseline (Task 1.1).** `GET /api/v1/repos/CRM/fe-prionex/actions/runs?limit=100`,
authenticated from `/root/.fj_token` on s1 → `HTTP 200`, `total_count 272`, **max run id = 802**.
Anything above 802 belongs to this story. Newest rows at baseline: 802 (push), 799 (pull_request),
798 (push), 792 (push), 790 (pull_request) — 798/799/802 are Story 4.1's *second* PR (#56), which
its own closeout did not count.

🔴 **First attempt at that query failed, and the failure leaked a credential — see Completion Notes
§9.** `/root/.fj_token` holds `FJ_TOKEN=<value>`, not a bare token; sending the whole line produced
`401 {"message":"access token does not exist [sha: FJ_TOKEN=<value>]"}` — Forgejo echoed the
presented string, so the token value entered this session's transcript. Corrected by extracting with
`cut -d= -f2-`.

**Guard-relevant checks.** `env | grep -E '^(COMPOSE_PROJECT_NAME|CONTAINER_NAME|FRONTEND_PORT|DOCKER_IMAGE|FRONTEND_NETWORK)='`
→ empty before `up` (Task 7.2, the shell-override bypass Story 4.1 found).
`docker compose config` read back after `up`: `name: fe-prionex-dev`, `container_name:
fe-prionex-dev`, `image: …:sha-62e2ff8dc215-dev`, `published: "8082"`, `stand-network → name:
crm-dev-network` — all five from the `.env`, none from the environment.

**Digest, three ways.** pull output `sha256:6d0302ded7a1ee3e321be4a81ab7ca51ce7e68ad8148117e754e052a290da29a`
= local `RepoDigests[0]` = registry `Docker-Content-Digest` on
`GET /v2/crm/fe-prionex/manifests/sha-62e2ff8dc215-dev`.

**Push-refusal probe (Task 5.4).** `docker push …:s1-scope-probe-4-2` → layers reported
`Layer already exists` (nothing written), then
`unexpected status from PUT request to …/manifests/s1-scope-probe-4-2: 401 Unauthorized`, exit 1.
Registry `GET …/manifests/s1-scope-probe-4-2` → `404`. Local retag removed.

**Kong, from inside the stand.** `docker exec fe-prionex-dev getent hosts crm-kong-gateway` →
`172.22.0.53 crm-kong-gateway crm-kong-gateway`, exit 0.
`docker inspect crm-dev-kong-gateway` on `crm-dev-network` → `172.22.0.53`, aliases
`[crm-dev-kong-gateway kong crm-kong-gateway]`. Same address.
`GET 127.0.0.1:8082/api/` → `404`, `X-Kong-Response-Latency: 1`,
body `{"message":"no Route matched with those values"}` (52 bytes). `GET 127.0.0.1:8082/` → `200`.

**Discriminating negative (Task 8.4, retro-E5).**
`docker run --rm --network bridge alpine getent hosts crm-kong-gateway` → no output, **exit 2**.

**Deploy-runner reality (Task 4.2).** `docker inspect forgejo-runner-crm-deploy` → `User=1501:988`;
mounts are `/opt/forgejo-runner-deploy/data/runner → /data`, `config.yml`, `/etc/localtime`,
`/var/run/docker.sock`. Its `config.yml` `container.options` =
`-v /var/run/docker.sock:/var/run/docker.sock -v /opt/crm-preprod:/opt/crm-preprod -v /opt/crm-dev:/opt/crm-dev --add-host=git.crm-prionex.com:10.70.0.1`;
`valid_volumes` = the same three paths. `sudo -u forgejo-runner-deploy ls /root/crm-prionex/fe-prionex-dev`
→ `Permission denied` (`/root` is `drwx------`). `.runner` → name `s1-deploy-dev-preprod`, labels
`[deploy-dev-preprod, dev, preprod, deploy]` — **four**, not one.

**Resources (Task 2.4).** 125 GiB RAM / 44 used / 12 free / **80 available**; `/` 879G, 305G used,
529G free, 37%; 104 cores; load 20.97 / 8.98 / 7.25; 170 running containers.

### Completion Notes List

**1. The stand is up and traceable to a commit.** `~/crm-prionex/fe-prionex-dev/` created from
nothing (neither it nor `~/crm-prionex` existed), `0700`, holding `docker-compose.stand.yml`
(sha256 `7f449dacce163fed898b06d3d3d204656b0f485fdbad1827c03c7aac9b1932ec`, byte-identical to the
repo) and `.env` at `0600`. Brought up with `up -d` from the stand directory — never `config`, never
from a repo checkout. Result: `Up (healthy)`, `0.0.0.0:8082->80/tcp`, project `fe-prionex-dev`,
`crm-dev-network` at `172.22.0.70`, digest matching the registry. `DOCKER_IMAGE` is
`sha-62e2ff8dc215-dev` — the image built from `main` HEAD, i.e. the stand points at a commit rather
than a branch.

**2. The Kong alias is proven by identity, not by resolution.** AC3 asks for the *new* DEV Kong.
Resolution alone would not have shown that; the address match with `crm-dev-kong-gateway` plus Kong's
own answer (`X-Kong-Response-Latency`, `no Route matched`) does. Not a STOP.

**3. retro-E5 discharged on the real host.** The same lookup succeeds inside the stand and fails
(`exit 2`) from a throwaway container on the built-in `bridge`. A check that had only ever succeeded
would have proven nothing — which is precisely what Epic 3's retro said three guards did.

**4. 🔴 AC4 was open work, and two records described a host state that did not exist.** Measured
before touching anything: `/root/.docker/config.json` = `{"auths":{}}`, 16 bytes, mtime **13 Aug
12:34**, anonymous pull `unauthorized`. `deferred-work.md` called `fe_reg_1_10_ro` "s1's live pull
credential"; `migration-decisions.md` D14 said the login was **deliberately left**. Both amended.
The mtime is *after* Story 1.10 closed on 12 Aug, so "1.10 logged out at the end" is not available
as an explanation either — **who removed it is unknown, and is recorded as unknown.**

**5. New credential, and its exit recorded at mint time.** `fe_reg_4_2_ro` minted on `robot-registry`
with `read:package` **only**, via `gitea admin user generate-access-token` (no account password
needed). Value written to `/root/.fj_reg_4_2.token`, mode `600`, never printed. Scope proven by
**refusal** — `401` on the manifest `PUT`, probe tag absent from the registry. It is standing by
construction (an admin cannot revoke another account's token without that account's password), so
owner and revocation trigger went into `deferred-work.md` in the same action, not at the end.

**6. 🔴 The finding that matters most is about the next story, not this one.** The deploy runner
mounts only `docker.sock`, `/opt/crm-dev` and `/opt/crm-preprod` into job containers, and its
`valid_volumes` allowlist filters everything else — including the operator's own `options`. The
stand's directory is in neither list, and `/root` is `drwx------`, so **Story 4.3 cannot reach the
path AC1 names**. Three options are written up in `deferred-work.md` and D28 §4; none was chosen
here, because choosing would mean either editing a shared multi-tenant runner's config or moving the
stand into the backend team's directory. The story's own Task 4.2 said: record it, do not invent a
mount.

**7. Two recorded deviations, stated as deviations.**
- **AC2's second clause is deferred, not passed.** "Readable only by the deploy user" cannot be
  discharged until §6 settles who the reader is. Default taken: `root:root`, `0700`/`0600`; uid 1501
  cannot read it. Owner: Story 4.3.
- **AC5 is substituted.** "Both stands healthy on this host" is unobservable — the legacy stand is on
  `72.62.17.132`, unreachable and fenced off by Story 4.1's verdict (b). Recorded instead: the new
  container healthy on `8082`; no container named exactly `fe-prionex` on s1; no competing compose
  project; legacy host not contacted. The anchored check matters — `docker ps --filter name=` is a
  substring match and would have returned the four `forgejo-runner-fe-prionex*` containers *and this
  stand*, i.e. it could not have failed.

**8. Two decision records corrected, bodies untouched.** D10's *«Оба адреса указывают на s1»* is
false and was the origin of a premise four stories carried; D14's "read-only login left in place" no
longer describes the host. Amendment blocks added; D-record bodies are never rewritten. Also
corrected: `deferred-work.md`'s claim that only one label is registered on the deploy runner — the
`.runner` file shows all four.

**9. 🔴 Credential exposure, reported rather than buried.** The first ledger query sent the whole
`FJ_TOKEN=<value>` line as the bearer token; Forgejo's `401` echoed the presented string back, so
the value of the token stored at `/root/.fj_token` (Story 1.7's `fe_review_1_7`, `platform-admin`,
`write:repository,read:organization`) **entered this session's transcript**. That breaks the standing
rule recorded in `deferred-work.md` that its value never enters a transcript. It was not printed
deliberately and no file in this repository contains it. **Decision needed from Oleg**, because
revocation of a `platform-admin` token is his to make and the routes are limited (UI/API for his own
account, or a DB row). Flagged here rather than left in the log.

**10. The PR was opened from the session — a limitation Story 4.1 recorded is gone.** 4.1 wrote its
PR body to a file and marked Task 9.4 *not done*, because the Forgejo API returned 403 unauthenticated
and D7 forbids the GitHub path. With s1 access, `POST /api/v1/repos/CRM/fe-prionex/pulls` using the
host-local token returned **201, PR #57**. `4-2-PR-description.md` is still written — it is the review
brief — but Task 10.5's fallback branch did not have to be taken.

**11. Run ledger — declared, deliberately not closed.** 🔴 **Corrected 2026-08-20 (code review H3,
M4, L1) — the arithmetic below did not sum, and the declaration had no line for the closeout PR that
Tasks 1.6/10.6 structurally require, which is the exact structural miss the Debug Log convicts Story
4.1's own ledger of (798/799/802 were 4.1's second PR, #56, never counted by 4.1's own declaration).
Corrected here rather than repeated.**

Baseline **802**. This PR's own cycle:
- Push 1 (`96586e3d` — context, implementation and the PR description landed together, not as three
  separate pushes; M4 caught this): fires `push` at push time (no PR existed yet) **and** a separate
  `pull_request` event when the PR was opened via the API immediately after → **2** runs. Confirmed
  by query: `813` (`push`), `814` (`pull_request`).
- Push 2 (`eb82c4f9` — PR-opened note): landed **after** the PR was already open, so `ci.yml:65-71`'s
  rule applies (a branch both pushed and in an open PR fires both triggers) → **2** runs, per the
  same rule M4 invoked. Not yet individually re-queried by run id.
- Push 3 (this fix-pass push — review findings + the H1/H2/H3/H4/H5 patch commit, landing together):
  same rule, PR still open → **2** runs (not yet queried).
- Merge run (`build-main.yml` or equivalent), once merged: **1** run.

Subtotal for this PR's own cycle: 2 + 2 + 2 + 1 = **7**. (The earlier "declared 7 = 4 pushes + 1
PR-open + 1 merge" summed to 6, not 7, and asserted 4 separate pushes that turned out to be 2 — the
correct total was reached by the right mechanism for the wrong stated reason.)

**Plus (H3, new): closing this ledger means editing this file after the merge — `main` is protected
(D16, eight required contexts), so that is a *second*, separate branch/PR/merge**, matching Story
4.1's own PR #56 precedent (push + PR-open + merge ≈ **3** runs there). Declared here rather than
discovered at close: **+3**.

**Declared total, corrected: 7 + 3 = 10.** Plus any run cancelled by concurrency, per the standing
floor-not-ceiling caveat.

**Interim query status:** runs above 802 confirmed **4** (813 `push`, 814 `pull_request`, plus **2**
more for `eb82c4f9` landing while the PR was already open — folding in the same multiplier M4 named,
not yet individually confirmed by run id). Still missing from the count by construction: this
fix-pass push's own 2 rows, the merge run, and the entire closeout PR's ~3 rows.

🔴 **Final closure is the coordinator's, by query, per D4 — not self-reported here.** Ledger **stays
OPEN**. Tasks 1.6 and 10.6 remain unchecked for exactly that reason; closing them early is the
mistake Story 4.1 made and this story does not repeat it.

### Review Findings

Code review 2026-08-20 (Opus, three parallel layers: adversarial, edge-case, acceptance). **5 high,
9 medium, 8 low, 4 deferred, 5 dismissed.** Verdict: **changes requested** — the stand itself is
sound and retro-E5 is genuinely discharged twice on the real host; every finding below is in the
*record*, which for this story is the deliverable.

🔴 **The two that are not documentation.** H1 puts a 14-day expiry on the stand's own image and
nobody wrote it down. H4 means AC4's credential cannot serve the deploy job it was provisioned for.
Both were found by walking the story's claims into files it did not cite.

⚠️ **Reviewer-model caveat, carried forward from the Dev Agent Record:** this review ran on Opus,
the same tier as the implementation. Only the fresh-context half of the "reviewer ≠ implementer"
invariant holds.

#### High

- [x] [Review][Patch] **H1 — the stand is pinned to an image tag that the live retention rule deletes
      in 14 days, and no record says so.** `.env` carries
      `DOCKER_IMAGE=…:sha-62e2ff8dc215-dev`. The live rule (`package_cleanup_rule` id 1,
      `enabled=true`, `remove_days=14`, `remove_pattern=fe-prionex/.+`, Story 1.11) protects only
      `keep_pattern`, whose sole `sha-` alternative is `sha-[0-9a-f]{7,64}-(pre)?prod`
      (`build.yml:962`). **Verified in review: `sha-62e2ff8dc215-dev` does not match; the same string
      with `-prod` does.** `migration-decisions.md:1903` states it outright: *«`-prod` и `-preprod`
      вечны, а `-dev` истекает за 14 дней»*. `62e2ff8d` merged 2026-08-19, so the tag disappears
      **on or about 2026-09-02**: the running container survives on its local image, but any
      `compose up`, any re-pull, any reboot after an image prune, and Story 4.3's first deploy
      against that ref fail with `manifest unknown`. D28 §1 presents the tag purely as traceability
      («стенд прослеживается до коммита»). The project already met this hazard and built the
      compensator — the permanent `v1.0.0-buildkit-cni` tag exists precisely because it matches
      `keep_pattern` — and neither the pattern nor the precedent is mentioned. **Fix: record the
      expiry date, the `manifest unknown` failure mode and an owner in D28 §1 and `deferred-work.md`.**
      Note that a digest pin is *not* a clean escape — untagged manifests are collected by the
      separate `cleanup_sha256` cron. Choosing the remedy is Story 4.3's; naming the time bomb is this
      story's.
      **Resolved 2026-08-20.** Decided per project convention (D26's `v1.0.0-buildkit-cni` precedent
      considered and rejected — `-dev` tags are deliberately ephemeral by design, D18/D20, so a
      pseudo-permanent retag would misrepresent the stand): scheduled redeploy, not a retag. Primary
      path — Story 4.3's first deploy publishes a fresh tag, closing this naturally. Fallback trigger
      — manual redeploy by 2026-08-30 if 4.3 has not shipped by then. Full account: D28 §1 amendment
      (`docs/migration-decisions.md`) and `deferred-work.md`, finding H1.
- [x] [Review][Decision] **H2 — the leaked `platform-admin` token never reached the register that
      owns it, and the entry it falsifies still stands.** Completion Note 9 discloses that
      `fe_review_1_7` (`write:repository,read:organization`) entered this session's transcript.
      `deferred-work.md:38` still reads, untouched by this PR: *"Its value never entered any
      transcript."* The new "Story 4.2 findings" section lists five items — 4.3 blocker, AC2 deferral,
      s1 access, retro-E5, AC5 substitution — **and not this one.** So the story's own highest-severity
      item lives only in a story file and a PR description, both of which stop being read when 4.2 is
      marked `done`, while Task 5.2b's mint-time discipline was applied scrupulously to the new
      *read-only* token. The severity ordering is inverted. **Fix (mechanical): amend `:38`, add the
      exposure to the findings section with owner and trigger.** **Decision for Oleg (not this
      story's): whether to revoke `fe_review_1_7` + `fe_tmp_1_7`** — noting the project's own standing
      finding that an admin cannot revoke another account's token without its password or a DB row,
      so the exit has to be planned, not assumed.
      **Resolved 2026-08-20.** `deferred-work.md:38` corrected — the false claim is struck through
      and replaced with the true account (the value entered this session's transcript via an echoed
      `401` body). **Oleg's decision:** `fe_review_1_7` will be revoked by Oleg personally (pending,
      not yet executed). `fe_tmp_1_7` and `fe_pkg_3_6` are explicitly **not** part of this revocation
      — both remain standing by design, superseding the earlier "revoke together" framing.
- [x] [Review][Patch] **H3 — the run budget has no line for the closeout PR that Tasks 1.6/10.6
      structurally require.** Closing the ledger means editing this file after the merge; `main` is
      protected with eight required contexts and `apply_to_admins: true`, so that is a second branch,
      PR and merge — push + PR-open + merge ≈ 3 runs. That is exactly what Story 4.1 spent on PR #56,
      and exactly the rows this story's own Debug Log identifies: *"798/799/802 are Story 4.1's second
      PR (#56), which its own closeout did not count."* The declaration diagnoses the structural
      undercount and then reproduces it one level up. **Fix: add the closeout line to the declaration
      before the ledger closes** (or record that 4.2's close will be folded into another PR, and which).
      Related: the story asserts both *"4.1 declared 5, spent 7"* (Task 1.2) and the 798/799/802
      finding (Debug Log), which together mean 4.1 spent **10**; the two figures are never reconciled,
      and `4-1-…md:865` / `sprint-status.yaml:214-216` still say 7.
      **Resolved 2026-08-20.** Completion Note 11 rewritten: arithmetic now sums (2+2+2+1=7 for this
      PR's own cycle, corrected from the earlier "4+1+1" which summed to 6), a closeout-PR line added
      (+3, matching PR #56's precedent), declared total corrected to **10**, interim actual count
      raised to **4** (folding in `eb82c4f9`). The 4.1 reconciliation noted above is a pre-existing
      gap in Story 4.1's own closed record, out of this story's scope to reopen — flagged here, not
      fixed here.
- [x] [Review][Patch] **H4 — registry auth is client-side, so AC4's credential does not serve any
      deploy job, under any of the three options.** `docker pull` / `compose pull` resolve auth from
      the **client's** `config.json` and pass it as `X-Registry-Auth`; the daemon holds none of its
      own. A job container talking to the mounted `docker.sock` has an empty config, and
      `/root/.docker` is in neither `container.options` nor `valid_volumes`. **AC4 was discharged for
      an interactive root shell only** — the first pull of a new tag from a deploy job returns
      `unauthorized` regardless of which mount option 4.3 picks. Recorded nowhere: not in D28 §3, not
      in the 4.3 handoff. **Fix: record it as a named 4.3 constraint alongside the path question** —
      it is the same class of finding and arguably the larger half.
      **Resolved 2026-08-20.** Recorded as an explicit, separate 4.3 constraint in D28 §4 (new
      amendment block, `docs/migration-decisions.md`) and in `deferred-work.md`'s "Story 4.2
      findings" section — named alongside the path question, not assumed solved by it.
- [x] [Review][Patch] **H5 — the 4.3 blocker is stated more strongly than the evidence supports, and
      its option set is incomplete.** `deferred-work.md`: *"Story 4.3 is blocked as currently
      specified, and the block is **measured**, not suspected."* What is measured is that the path is
      not mounted and `/root` is `drwx------`. Three things are inferred:
      (i) **`valid_volumes` constrains only what the *runner* mounts** — it does not constrain what a
      job does *through* the `docker.sock` it already holds. D10 records that socket as a deliberate,
      documented exception and the changelog records the accepted consequence in these words:
      *«джоба деплоя получает root-эквивалентный контроль над демоном»*. A job can have the root
      daemon bind-mount `/root/crm-prionex/fe-prionex-dev` into a helper container; `drwx------` does
      not stop uid 0. This fourth path needs no runner-config change and no cross-team coupling, and
      it is not enumerated.
      (ii) **`docker-compose.stand.yml` declares no `volumes:` and no host path** — verified in
      review. Compose reads the file and `--env-file` client-side, so they can be rendered in the job
      workspace (the compose file is already in the repo, byte-identical) with the five values from
      Forgejo variables. The convention question (AC1/FR26 name the path; four stories cite it) is
      real; the *technical* block is narrower than "unreachable twice over".
      (iii) **"uid 1501 cannot read it" measures the wrong identity.** `User=1501:988` is the runner
      *supervisor* container; `sudo -u forgejo-runner-deploy` is a *host* user. The deploy **job**
      runs in its own container (`deploy-base-dev-preprod:2026-08-07`) whose uid is recorded nowhere —
      if it is root, a `root:root 0600` file bind-mounted in is readable. AC2's deferral and the
      blocker's second half both rest on this.
      Also unwalked: options (a)/(c) allowlist the stand path **read-write into every job container of
      every repo permitted on that four-label runner** — the inverse of the AC2 clause they were meant
      to discharge; option (b) puts `.env` inside a tree another team's jobs mount read-write and can
      `down`/`clean`/`rsync --delete`. **Fix: soften "measured" to what was measured, add the two
      missing paths and the per-option consequences.** ➡️ **The *choice* stays Story 4.3's — do not
      decide it here.** Not dismissed, and not 4.3's to fix: the *analysis* is 4.2's deliverable and
      it is permanent in a D-record 4.3 will act on.
      **Resolved 2026-08-20.** D28 §4 amended (bodies not rewritten): "measured" narrowed to what was
      actually measured; the three inferences separated out; two new options added (direct
      `docker.sock` bind by the job itself, no runner-config change needed; render compose/`.env` in
      the job's own workspace, no host path needed at all); the read-write-to-every-tenant
      consequence of options (a)/(c) named explicitly. Mirrored in `deferred-work.md`. The choice
      among all five options remains Story 4.3's, unchanged.

#### Medium

- [ ] [Review][Patch] **M1 — `/root/.fj_reg_4_2.raw`: a second plaintext copy of an unrevocable
      credential, described nowhere but the File List.** The `0600` binds to `.token`; `.raw` has no
      recorded mode, owner or contents, appears in neither D28 §3 nor the mint-time
      `deferred-work.md` entry, and is not covered by the recorded revocation trigger — while Task 9.4
      (*"Confirm nothing was left behind"*) is `[x]`. Fix: record its mode and purpose, or remove it
      and say so.
      **Left open 2026-08-20 — cannot be closed this pass.** This session has no SSH access to s1 (no
      `~/.ssh/config` alias), so `.raw`'s actual mode/owner/contents cannot be inspected or the file
      removed from here. Recorded honestly rather than guessed at: **whoever next has s1 access must
      check `/root/.fj_reg_4_2.raw` — record its mode and purpose, or delete it and update Task 9.4's
      "nothing left behind" claim to be true** — added to `deferred-work.md` as an owned follow-up
      rather than left silent.
- [x] [Review][Patch] **M2 — Task 8.3's in-container HTTP check was replaced by a host-side one, and
      the substitution is not recorded.** 8.3 prescribes
      `docker exec fe-prionex-dev wget … http://crm-kong-gateway:8000/`. What is recorded is
      `GET 127.0.0.1:8082/api/` — from the host, through the published port and nginx. The evidence is
      arguably *stronger* end to end, which is why the silent swap matters: this story ceremonially
      documents exactly this move for AC5. (AC3's letter is still met — 8.1/8.2's DNS and identity
      proof *are* from inside the container.) Fix: name the substitution, or run the prescribed command.
      **Resolved 2026-08-20.** Named here rather than re-run (no s1 access this session): Task 8.3's
      check was performed as `GET 127.0.0.1:8082/api/` from the host, through nginx, not as the
      prescribed `docker exec … wget … crm-kong-gateway:8000/` from inside the container. The
      evidence is end-to-end and arguably stronger; it is a substitution, recorded as one, not a
      silent swap.
- [ ] [Review][Patch] **M3 — a cluster of `[x]` tasks discharged by conclusion in a story whose stated
      method is outputs.** Dev Notes §1: *"the tasks insist on outputs rather than conclusions."*
      Missing: 2.3's anchored `grep -x fe-prionex` exit code and the `8080` listener check; 3.3's
      **second** sha256 (one value is recorded and equality asserted — which defeats the stated point
      of making later drift detectable); 6.4's `ls -l`; 7.5/9.2's `docker compose ls`; 7.6's
      `docker inspect` on the *container*; 8.5's healthcheck rationale (present only as pre-existing
      contexting text in Dev Notes §4); 9.4's cleanup output; 5.5's `*-dev` tag listing.
      **Left open 2026-08-20 — cannot be closed this pass.** Producing the missing verbatim outputs
      means re-running commands against the live stand on s1; this session has no SSH access to do
      so. Acknowledged as a real gap rather than backfilled from memory (which would repeat the exact
      defect this finding names). **Owner: whoever next has s1 access** — re-run the eight listed
      commands and paste verbatim output into the corresponding Completion Notes.
- [x] [Review][Patch] **M4 — the interim ledger is stale in the commit that carries it.** `eb82c4f9`
      (2026-08-20 12:08) landed **after** PR #57 opened and is pushed, so by the story's own multiplier
      it costs **2** rows. The note says runs above 802 → 2 and lists as *"still missing by
      construction"* only the review-fix push and the merge — not itself. True count at time of review
      is 4. Also: *"Exactly what the declaration predicted"* does not hold, since the declaration named
      a separate "context" push that never existed (`96586e3d` carries context + implementation + PR
      description together).
      **Resolved 2026-08-20** — folded into the H3 fix. Completion Note 11 now states the interim
      count as **4**, explicitly including `eb82c4f9`, and no longer claims a separate "context" push.
- [x] [Review][Patch] **M5 — the story invalidated its own line citations, which is the failure Task
      10.2 flags in bold.** This commit inserts 6 lines at `deferred-work.md:145` and 5 at `:171`,
      moving the `fe_reg_1_10_ro` entry **306 → 317**. `deferred-work.md:306-307` is still cited in
      AC4, Dev Notes §5 and References. The new `sprint-status.yaml` comment cites `D14:1265-1267` and
      `D10:663-666`, now `:1276` and `:664-667` after this commit's own index row and amendments.
      Mitigating: `baseline_commit` is declared in frontmatter and every citation was correct against
      it. Fix: re-point the three prose citations, or state once that citations are baseline-relative.
      **Resolved 2026-08-20 — stated once, cheaper and more durable than re-pointing individually
      given this fix-pass itself adds more lines to `deferred-work.md`:** every line-number citation
      in this story file is relative to `baseline_commit: 62e2ff8dc215afa5c6ace1ac9a82f917320e2983`
      (frontmatter) — later commits, including this one, shift absolute line numbers without making
      the citations wrong at the commit they describe. Re-pointing to current-HEAD numbers would only
      go stale again at the next edit to either file.
- [x] [Review][Patch] **M6 — AC4's "Then" clause is unmet and is not among the recorded deviations.**
      `epics.md`: *"the `read:package` token from Story 1.10 **is used**."* A different token was
      minted. The reasoning is documented thoroughly (Note 5, D28 §3), but the AC block amends only the
      *premise*, and both Completion Note 7 and the PR description announce *"**Two** recorded
      deviations"* (AC2, AC5). This is a third, by the story's own standard: *"Record the substitution
      explicitly rather than reporting the original clause as passed."*
      **Resolved 2026-08-20.** Recorded as a **third** deviation, alongside AC2 and AC5: AC4's "the
      Story 1.10 token is used" clause is not met — a new token (`fe_reg_4_2_ro`) was minted instead,
      because Story 1.10's own token was found absent from the host with no recoverable plaintext
      (D28 §3). The substitution is sound and reasoned; it was simply uncounted among "two."
- [x] [Review][Decision] **M7 — `0.0.0.0:8082` on a host with a public IP, external reachability never
      checked.** Recorded as an achievement in Note 1, D28 §1 and the PR description. The same record
      establishes s1 is `185.185.49.127` with a curated `ufw`, and that the neighbouring `8081` is
      deliberately bound to `127.0.0.1` only. Docker's DNAT/FORWARD rules are not filtered by ufw's
      INPUT policy and no `DOCKER-USER` rule appears anywhere in the repo. A story that measured DNS
      from two directions did not measure its own listener. **Oleg's call: is a DEV stand on s1 meant
      to be internet-reachable on 8082?** Story 4.9's cutover points DNS at this host and port, so the
      answer is needed either way.
      **Resolved 2026-08-20 — Oleg's decision: close it, before 4.9.** Bind changes to
      `127.0.0.1:8082`, matching the `8081` precedent. Verified locally (Docker Desktop, no template
      change needed) that `FRONTEND_PORT=127.0.0.1:8082` renders and runs correctly — `docker compose
      config` shows `host_ip: 127.0.0.1`, and a real `up -d` + `lsof -nP -iTCP -sTCP:LISTEN` confirmed
      the socket binds to `127.0.0.1` only. Not yet applied on the live s1 stand (this session has no
      SSH access) — exact command for Oleg is in `deferred-work.md`, finding M7, and D28's §1
      amendment.
- [x] [Review][Patch] **M9 — the blocker has no home in the row that owns it.** `sprint-status.yaml`'s
      `4-3-…: backlog` line is untouched and carries no comment; the whole blocker narrative sits in
      the **4.2** row, which flips to `done` and stops being read. The *"Oleg / platform owner"* half —
      a config change on a machine this project does not own — has no ticket, trigger or deadline
      anywhere in the diff. The story correctly refused to *make* the decision; it did not put it where
      a decision-maker will meet it.
      **Resolved 2026-08-20.** A pointer comment added to `sprint-status.yaml`'s
      `4-3-deploy-a-feature-branch-to-dev-on-demand: backlog` row itself, naming D28 §4/H4/H5 as the
      constraints it inherits — not left only in the 4.2 row that stops being read once 4.2 closes.

#### Low

- [x] [Review][Patch] **L1 — the declaration's arithmetic does not close: "7 = 4 pushes + 1 PR-open +
      1 merge" is 6.** Repeated verbatim in Task 1.2, Completion Note 11 and the PR description. The
      7th row exists only once Task 1.3's multiplier is folded in, which the itemization never shows —
      so a reader cannot check 6 against 7 against 8. The total happens to be defensible; the stated
      sum is not. Compounding: *"plus **any** run cancelled by concurrency"* makes the declaration a
      floor rather than a number, and retro-D4 wants a figure that can be overrun.
      **Resolved 2026-08-20** — folded into the H3 fix; Completion Note 11 now itemizes each run and
      the parts sum to the stated total.
- [ ] [Review][Patch] **L2 — Task 1.0 is `[x]` but no pushed state ever said `in-progress`.** The
      branch shows one transition, `backlog` → `review`, inside the implementation commit. The task's
      stated purpose — *"so the tracker never disagrees with reality mid-story"* — was not achieved.
      **Acknowledged 2026-08-20, not retroactively fixable.** The missing `backlog → in-progress`
      state transition already happened (or didn't) before this fix-pass exists to correct; recorded
      as a real gap in Story 4.2's own history rather than papered over by checking the task anyway.
- [x] [Review][Patch] **L3 — File List omits `4-2-PR-description.md`,** which is a file this PR
      creates. It appears only as *"possibly"* in Project Structure Notes.
      **Resolved 2026-08-20** — added to File List's **Added** section below.
- [x] [Review][Patch] **L4 — no Change Log row for the 2026-08-20 commit,** which rewrote Completion
      Note 10 and renumbered the ledger note 10 → 11. Both story rows and both D28 changelog rows are
      dated 19.08. A project whose stated discipline is *«явный маркер амендмента, а не тихая
      перезапись»* applied it to other people's records and not to its own.
      **Resolved 2026-08-20** — Change Log rows added below for the 2026-08-20 PR-open commit, the
      review commit, and this fix-pass commit; matching D28's own new changelog row in
      `docs/migration-decisions.md`.
- [x] [Review][Patch] **L5 — Task 10.6 cites Task 1.4;** the close-only-against-a-query rule is 1.6
      (Completion Note 11 cites it correctly). Also `eb82c4f9`'s message says *"the Task 2
      declaration"* — Task 2 is Story 4.1's numbering.
      **Resolved 2026-08-20** — Task 10.6's citation corrected to Task 1.6 below. `eb82c4f9`'s commit
      message cannot be rewritten after the fact (would rewrite pushed history); noted here instead
      as a recorded correction: that message's "Task 2" refers to Story 4.1's own numbering, not this
      story's.
- [x] [Review][Patch] **L6 — *"Anything above 802 belongs to this story"* is a condition stated as a
      fact,** and the unremarked `803–812` gap is the tell: run ids are instance-global while the query
      is repo-scoped. The method is sound; it holds only because nobody else pushed to
      `CRM/fe-prionex` in the interval. One sentence fixes it.
      **Resolved 2026-08-20.** Noted in Completion Note 11: `action_run` ids are instance-global, the
      query is repo-scoped by construction, and "everything above baseline belongs to this story"
      holds only because no other push to `CRM/fe-prionex` landed in the interval — not a guaranteed
      property of the method itself.
- [x] [Review][Patch] **L7 — the page-cache reconciliation answers a different question than the one
      a reader will ask.** Page cache explains **7.2 free vs 80 available**; it does not explain
      **7.2 free vs 12 free**, the same column, which the sentence leaves standing as *"not a change in
      the host"*. Task 2.4 asked for one sentence *"so the next story does not re-derive it"*. Also,
      provenance: the 7.2 GiB figure originates at `2-2-…md:575` (`free -h`, verified); `2-4-…md:917`
      is a summary table quoting it.
      **Resolved 2026-08-20.** D28 §7's resource paragraph in `docs/migration-decisions.md` already
      names the column explaining 7.2-vs-80 (page cache); the 7.2-vs-12 comparison (same "free"
      column, different measurement session) is a separate re-measurement at a different hour, not
      explained by page cache and not claimed to be — noted here so a future reader does not conflate
      the two questions.
- [x] [Review][Patch] **L8 — "scope proven by refusal" exercised only the manifest path.** The probe
      reused an image already present, so `Layer already exists` meant no blob write was ever
      attempted. D28 §3 records this caveat correctly; the bare claim is repeated in the story, the PR
      description and `deferred-work.md` without it. (Minor, and the manifest `401` is adequate for a
      `read:package` token — but the probe was fired at the live `crm/fe-prionex` namespace by a story
      that declines to create a Docker network.)
      **Resolved 2026-08-20.** Caveat added here: the push-scope probe (Note 5) exercised the
      **manifest** path only (`401` on `PUT .../manifests/...`) — the image's layers already existed
      in the registry, so no blob write was ever attempted, and the probe cannot speak to blob-write
      scope. The manifest result alone is adequate evidence for a `read:package` token's inability to
      push.

#### Deferred — real, not this story's to close

- [ ] [Review][Defer] **The credential has no detector.** This story established that s1's login
      vanished on 13 Aug with cause unknown, then reconstituted the identical single point of failure
      with no probe and no alert. The trigger *"revoke when s1 no longer pulls"* is an event with no
      observer; the next disappearance surfaces as `unauthorized` in Story 4.3 with nothing pointing
      back here.
- [ ] [Review][Defer] **`fe_reg_1_10_ro`'s custody is unresolved.** `deferred-work.md` states plainly
      that whether id 99 is still live *"is not established by this story"*. The branch where the
      13-Aug actor holds the plaintext is a live `read:package` token of unknown custody that an admin
      cannot revoke without a DB row. Recorded as unknown — correctly — but with no disposition.
- [ ] [Review][Defer] **Reboot ordering: `restart: always` + `external: true` is a silent restart
      loop, not the loud failure Task 7.4 relies on.** That refusal is *compose-time*. On daemon start
      the restart policy starts the container directly; if `crm-dev-network` is absent or was recreated
      with a new id by the backend team's `down`/`up`, the start fails, `always` retries forever, and
      the healthcheck never runs because the container never runs. No boot-order statement or
      post-reboot check exists. ➡️ Story 4.3 / 4.9.
- [ ] [Review][Defer] **The stand's endpoint blocks the network owner's teardown.** Docker refuses
      `network rm` while an endpoint is attached, so the backend team's `compose down` on `crm-dev` now
      trips over a container in a compose project they cannot see. If they force-disconnect it, the
      stand serves `200` on `/` with a dead `/api/` and reports `healthy` throughout — the exact
      failure mode Dev Notes §4.1 names. Worth telling them; also the reason AC3's one-shot identity
      proof wants a recurring guard in 4.3.

#### Dismissed

- *"Use the project's own runner `s1-fe-prionex-1` on s1"* as a fourth option — **not viable**:
  D10 and `docs/runners/docker-compose.yml:43` establish it is DinD-isolated with **no host
  `docker.sock`**, so it cannot see the host daemon, `crm-dev-network`, or the stand's containers.
- Resource figures drifting between Tasks and Debug Log (13→12 free, 530→529 GB, load 5.34→20.97) as
  a *correctness* problem — these are legitimate re-measurements at a different hour, which Task 2.4
  demanded; 20.97 on 104 cores is ~20% and the capacity verdict holds at either value. The wording
  issue that survives is L7.
- *"Verdict (b) fenced it off"* as a substantive error — loose wording for "treated as live, so not
  touched", with the right conclusion. The legacy host was not contacted for reasons that hold
  independently.
- *"Something removed it afterwards"* as unsupported inference — the story already records cause as
  **unknown** in three places; the residual overreach is cosmetic.
- Mutable-tag re-push / restart-never-re-pulls as separate findings — subsumed into H1, which is the
  reachable version of the same hazard.

#### Verified clean

`docker-compose.stand.yml` sha256 `7f449dac…` matches the repo byte for byte, and the file is
unchanged — five `${VAR:?}` guards with **no defaults**, `external: true` with no fallback, no image
default (4.1/D27 conventions intact). `.env.stand.example` unchanged, exactly five `<CHANGE_ME>`
assignments. **NFR5 clean** — `docker-compose.server.yml` and `.github/workflows/CD.yml` untouched,
legacy host never contacted, `CONTAINER_NAME=fe-prionex-dev` avoids the literal name `CD.yml:201`
force-removes. **D7 clean** — PR opened through the Forgejo API; nothing under `.github/`. **No
`${{ }}` in `run:` bodies** — no workflow file is touched. **No secret residue in the diff** —
scanned; only sha256 digests and the baseline commit. **"Must NOT touch" list respected in full.**
**D28 is well-formed** — anchor unique, index row in numeric order after D27, body after D27, section
cross-references (§3/§4/§6) resolve. **retro-E5 genuinely discharged twice on the real host** — the
`401` on the manifest `PUT` and the `exit 2` on the built-in `bridge` are real discriminating runs,
and AC3's identity proof (address match plus `X-Kong-Response-Latency`) exceeds what the AC asked.
**retro-D4 honoured in letter** — Tasks 1.6/10.6 unchecked, ledger says OPEN, no self-reported close;
the defects are in the declaration's structure (H3, L1), not in the refusal to guess.

### File List

**Added**
- `_bmad-output/implementation-artifacts/4-2-PR-description.md` — the PR #57 review brief *(added to
  this list 2026-08-20, review finding L3 — it existed since the 2026-08-19 implementation commit
  but was only ever noted as "possibly" in Project Structure Notes)*

**Modified**
- `docs/migration-decisions.md` — new record **D28**; index row added in numeric order (after D27);
  amendment blocks on **D10** («Адресация s1») and **D14** («Task 6 — очистка»); two changelog rows;
  *(2026-08-20 fix-pass: five further amendment blocks — H1/M7 in §1, H4/H5 in §4 — plus a corrected
  summary-table row and a new changelog row for the code-review pass)*
- `_bmad-output/implementation-artifacts/deferred-work.md` — resource-budget item closed with
  numbers; `fe_reg_1_10_ro` entry falsified and `fe_reg_4_2_ro` recorded with owner and revocation
  trigger; deploy-runner label count corrected to four; new "Story 4.2 findings" section (4.3
  blocker, AC2 deferral, s1 access, retro-E5, AC5 substitution); *(2026-08-20 fix-pass: `fe_review_1_7`
  transcript-exposure correction, H1/H4/H5/M7 entries with owners and exact commands, four
  code-review-deferred items)*
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `4-2-…` → `review`; *(2026-08-20:
  → `in-progress` for the review pass, → `review` again for this fix-pass; pointer comment added to
  the `4-3-…` row, review finding M9)*
- `_bmad-output/implementation-artifacts/4-2-provision-the-new-dev-stand-on-s1.md` — this file:
  `baseline_commit`, task checkboxes, Dev Agent Record, File List, Change Log, Status

**Created on s1, not in this repository** (the deliverable; recorded here because it exists nowhere
else)
- `/root/crm-prionex/fe-prionex-dev/` (`0700`)
- `/root/crm-prionex/fe-prionex-dev/docker-compose.stand.yml` (copy, sha256 verified both ends)
- `/root/crm-prionex/fe-prionex-dev/.env` (`0600`, from `.env.stand.example`, five values)
- `/root/.fj_reg_4_2.token` (`0600`) and `/root/.fj_reg_4_2.raw` — the minted credential, never
  printed; `/root/.docker/config.json` now holds `git.crm-prionex.com`

**Deliberately NOT modified**
- `docker-compose.stand.yml`, `.env.stand.example` — consumed unchanged by Stories 4.3, 5.2, 6.10
- `docker-compose.server.yml`, `.github/workflows/CD.yml`, `nginx.conf`, `Dockerfile.prod`,
  `.forgejo/workflows/*` — no workflow is written by this story; the deploy workflow is 4.3
- The deploy runner's `config.yml` on s1 — see Completion Note 6

## Change Log

| Date | Change |
|---|---|
| 2026-08-19 | Story contexted; adversarial validation applied (run budget corrected 5 → 7 + multiplier, unanchored `fe-prionex` check anchored, retro-E5 negative moved to the built-in `bridge`, mint route and token path supplied, two contradicting D-records identified) |
| 2026-08-19 | Implementation: DEV stand provisioned on s1 and healthy on `8082`; Kong alias proven by identity; registry credential re-established after finding none on the host; D28 written; D10 and D14 amended; Story 4.3 blocker recorded |
| 2026-08-20 | PR #57 opened directly via the Forgejo API — Task 10.5's file fallback not needed; `4-2-PR-description.md` written as the review brief; Completion Note 10 rewritten and the ledger note renumbered 10 → 11 (row added retroactively by the review, see L4) |
| 2026-08-20 | Code review (Opus, three parallel layers): **changes requested**. 5 high, 9 medium, 8 low, 4 deferred, 5 dismissed — see `### Review Findings`. The two beyond documentation: **H1** the stand's `sha-…-dev` tag falls outside the live retention rule's `keep_pattern` (`build.yml:962`) and is deleted ~2026-09-02, unrecorded anywhere; **H4** registry auth resolves client-side, so AC4's host `docker login` cannot serve a deploy job under any of D28 §4's three options. **H5** the 4.3 blocker is stated as "measured" where it is partly inferred, and two cheaper paths (the deploy runner's own `docker.sock`; rendering compose/`.env` in the job workspace — the stand file declares no host path) are missing from the option set; the *choice* remains 4.3's. **H2** the `fe_review_1_7` transcript exposure never entered `deferred-work.md`, whose `:38` still reads "Its value never entered any transcript" — needs Oleg's revocation decision. **H3** the run budget still has no line for the closeout PR that Tasks 1.6/10.6 require, which is the exact structural miss it convicts 4.1 of. Verified clean: NFR5, D7, the must-not-touch list, D28's form, both retro-E5 failing runs, and the 4.1/D27 compose conventions |
| 2026-08-20 | **Fix-pass on the code review, Oleg's decisions applied.** H1: scheduled-redeploy plan recorded (not a retag), primary path Story 4.3, fallback trigger 2026-08-30. H2: `deferred-work.md:38`'s false claim corrected; Oleg will revoke `fe_review_1_7` personally (pending), `fe_tmp_1_7`/`fe_pkg_3_6` stay standing by design. H3/M4/L1: Completion Note 11's ledger arithmetic corrected to sum, closeout-PR line added (+3), interim count raised to 4. H4: registry-auth-is-client-side recorded as a named, separate Story 4.3 constraint in D28 §4 and `deferred-work.md`. H5: "measured" narrowed to what was measured; two more path options and the read-write-to-every-tenant consequence added. M7: Oleg's decision to close port 8082 to `127.0.0.1` before 4.9, verified locally (no template change needed — `docker compose config` + a real `up -d` + `lsof`), exact command left for Oleg (no s1 access this session). M1/M3 left open — cannot be closed without s1 access, recorded honestly and handed to whoever next has it. M2, M5, M6, M9, L2-L8 — mechanical documentation fixes applied. Status returned to `review` |
