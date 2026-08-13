---
baseline_commit: 043b3765
---

# Story 3.1: Build and Publish an Image to the Forgejo Registry

Status: ready-for-dev

> **What this story is, and what it is not.** It is the first story that writes into the container
> registry from a workflow. Every push before today was made **by hand from a shell** — Story 1.10's
> `reg-check-1-10` was built with `DOCKER_HOST=ssh://root@10.67.0.1 docker build`
> (`docs/migration-decisions.md:1175-1177`), not by a job. **No image has ever been pushed to
> `crm/fe-prionex` by a Forgejo workflow.** The one workflow that reached the push stage failed
> (`1-8-…md:656-659`). It is **not** the tagging story — Story 3.2 owns the scheme
> (`epics.md:1271-1300`); 3.1 owns building and publishing at all.
>
> **Two prerequisites are already solved on paper and must not be rediscovered:** the label question
> (§1) and the buildx driver (§2). Read both before opening an editor.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want my commit turned into a container image stored in the Forgejo registry,
so that it can be deployed without depending on ghcr.io.

---

## 🚨 Read this before anything else

### 1. 🔴 The epic's own AC1 names a runner label on which this workflow cannot run

`epics.md:1248` opens with *"**Given** the `docker-build` runner label from Story 1.7"*, and FR5
(`epics.md:77-78`) says the workflow *"runs on the `docker-build` runner label"*. **Both are wrong
about this instance, and it was proved in Story 1.8.**

`docker-build` is registered as `docker-build:docker://code.forgejo.org/oci/docker:cli`
(`docs/runners/docker-compose.yml`, `GITEA_RUNNER_LABELS`; authoritative registration recorded at
`1-7-…md:358`, `:387`). That image carries a docker CLI and **no Node runtime**, so **no `uses:`
step of any kind executes under it** — not `actions/checkout`, not `docker/setup-buildx-action`, not
`docker/login-action`. Story 1.8 recorded the decision verbatim in the probe file itself:

> `docker-build`'s image has no Node runtime (Trap 1), so every `uses:` step in this file targets
> `node-20`, and the docker CLI is supplied via a `run:` step reaching the nested daemon that
> `container.options` already hands to every job container regardless of label.
> (`1-8-…md:1102-1106`)

Its code review filed this as a defect **written against this story by name**:

> **Фаза 4 still instructs Story 3.1 to run the `docker/*` actions on the `docker-build` label** —
> the exact thing this story proved impossible … **Story 3.1 will read them and author a workflow
> that cannot work** (`1-8-…md:686`)

That patch landed. `docs/forgejo-migration.md:204` and `:351` now say **`node-20` + docker CLI via a
`run:` step, NOT `docker-build`**. `epics.md:1248` and FR5 (`epics.md:77-78`) were **never amended**
and still say `docker-build`. **This story must state the deviation in writing** — the way Story 2.2
handled its dangling Story 1.4 citation (`2-2-…md:236-238`) — not silently pick one.

The last load-bearing sentence: **the nested daemon is reachable from every job container regardless
of label**, because `-e DOCKER_HOST=tcp://172.17.0.1:2375` is in `container.options`
(`docs/runners/config.yml:62`). So `node-20` loses nothing but the label name.

### 2. 🔴 `--add-host` is necessary but not sufficient. `driver: docker` is the fix, and it is proven

`--add-host git.crm-prionex.com:10.67.0.1` is permanent in `container.options` on **both** runners
(`docs/runners/config.yml:62`; D12 at `docs/migration-decisions.md:903-910` calls the line
*"предназначена жить постоянно"* precisely because of this story). It is **not enough**:

> `docker/setup-buildx-action` creates a builder with `driver=docker-container`, so buildx pushes
> from its **own BuildKit container**. `container.options` applies only to the *job* container, so
> the builder never gets the host mapping … and the connection dies.
> (`deferred-work.md:218-222`; the failure verbatim at `1-8-…md:657-659`:
> `failed to push … Head "https://…/v2/…/blobs/sha256:…": EOF`)

**Resolved, and by measurement:**

> ✅ **RESOLVED 2026-08-11 — `driver: docker` is the fix; Story 3.1 keeps `docker/build-push-action`.**
> Proven by a follow-up probe (run index 22, task 2639, all steps green): `setup-buildx-action` with
> `driver: docker` pushes through the `dind` daemon, which resolves `git.crm-prionex.com` correctly
> (`10.70.0.1`, reachable) — only containers *spawned by* the daemon resolve publicly …
> Native `docker build` + `docker push` from the job container also works and stands as the AC5
> replacement if the action is ever dropped. (`deferred-work.md:203-209`)

Both remedies are green (`1-8-…md:672-680`). **Two riders this story must carry:**

- ⚠️ **The YAML that proved it exists in no git ref.** `.forgejo/workflows/probe-actions.yml` lived
  only on the deleted `probe/action-compat` branch; `git log --all` finds nothing (verified again at
  `043b3765`). The appendix at `1-8-…md:1068-1258` is the **pre-review** file — its `probe-docker-push`
  job has **no `driver: docker`** (`:1223-1225`) and was **never dispatched**. The `ac3` job that
  closed AC3 must be **re-authored from prose**. Assume nothing about its exact shape beyond the two
  sentences quoted above.
- ⚠️ `deferred-work.md:210-211` says *"Either alone is insufficient"*. The **`driver: docker` half is
  proven**; the claim that `--add-host` is also required for the push is an inference, not a control —
  the recorded mechanism is that the *daemon* resolves correctly on its own. Do not remove
  `--add-host` to find out: it is a shared-runner config line and other things depend on it.

### 3. 🔴 The build must be native amd64. Cross-building kills it

> 🚨 **Находка: кросс-билд `--platform linux/amd64` под QEMU на рабочей станции (Mac, arm64) падает
> на `npm run build`** — `esbuild` крашится под эмуляцией (`Socket.afterClose`, `exit code: 1`).
> (`docs/migration-decisions.md:1176-1178`)

s1 is `x86_64` and both dinds run on it, so a workflow build **is** native — provided nothing adds
`--platform`, `platforms:` or `docker/setup-qemu-action`. Prohibition 5.

### 4. 🔴 Every tag you push is governed by a live retention rule, and it does not do what its name suggests

`package_cleanup_rule` id 1 is **enabled** on owner `CRM`, type `container`
(`docs/migration-decisions.md:1520`). Exact fields, copied from the restoration block at
`docs/migration-decisions.md:1541-1561` (the rule lives **only in the Forgejo database** — no API,
no CLI, not reconstructable from this repository):

```
enabled = true   type = container   match full name = true   keep count = 0   remove days = 14
remove_pattern  fe-prionex/.+
keep_pattern    fe-prionex/(prod-current|preprod-current|latest|buildcache|v?\d+\.\d+\.\d+.*|(pre)?prod-[0-9a-f]{7,64}|sha-[0-9a-f]{7,64}-(pre)?prod|sha256:[0-9a-f]{64})
```

**Three consequences for this story, each with a different sign:**

1. **Any tag this story pushes that does not match a `keep_pattern` alternative expires in 14 days.**
   A bare `sha-<short>` is *not* protected — `epics.md:197` states it flatly. That is by design, and
   for a first-publish probe it is a *feature*: the rule is the cleanup, and cleanup by hand needs a
   `write:package` token whose revocation is a dead end (§6).
2. **The 14-day threshold is «не проверено».** The experiment ran at `remove_days = 0` because the
   registry cannot backdate a push and database writes were forbidden
   (`1-11-…md:269-276`; `docs/migration-decisions.md:1520`). What is proven is the *mechanism*, not
   the number.
3. ⚠️ **Do not repeat the brief's version of the storage claim.** Story 1.11 concluded *"cleanup
   rules never delete digest-named container versions … deleting a tag reclaims no storage. Ever."*
   (`1-11-…md:739-751`). Its own **code review contradicted that**:
   > 🔴 **The AC6 finding "cleanup rules operate on tagged versions only" is under-evidenced and
   > must be re-run before anything depends on it.** It is contradicted by Story 1.11's own record:
   > `_upload` was untagged **and** internal and was deleted. (`deferred-work.md:543-549`)
   **Nothing in this story may depend on either answer.** If you need storage reclaimed, the route
   is `DELETE /packages/{owner}/{type}/{name}/{version}` (`deferred-work.md:535-542`), not the rule.

### 5. 🔴 A probe branch now costs a full CI run on top of whatever you are testing

Story 2.2 armed `push` on **every branch except `main`/`staging`/`development`**
(`.forgejo/workflows/ci.yml:39-45`). So a probe branch cut from `main` carries `ci.yml` and **every
push to it starts four CI jobs**. Measured on run 505: Lint 143 s, Type Check 86 s, Unit Tests 467 s,
Build 113 s, whole run **468 s** (`2-2-…md:627-632`). There is **no cancel endpoint on this API
version** (`docs/migration-decisions.md:581-585` via `2-2-…md:123-125`) — an accidental run is ~8
minutes of a shared host you cannot stop.

The host: s1, 125 GiB total with **7.2 GiB free**, 104 cores, load average **11.07 / 17.14 / 14.79**
at Story 2.2's measurement (`2-2-…md:575`), carrying **another tenant's production**
(`deferred-work.md:141-146`). **The budget in Task 3 must count CI runs and build runs separately.**

### 6. Dispatching needs a token this repository does not have, and the exit must be planned first

`epics.md:1256` requires the first trigger to be `workflow_dispatch` **with a `ref` input**, proven
by a manual dispatch. That is the same wall Story 2.1 hit (`2-1-…md:132-143`, Blocking Open Question
1 at `:513-515`): dispatching needs a Forgejo API token, and none currently exists — Story 1.12's
`fe_1_12_secrets` was revoked by a database row at its close (`docs/migration-decisions.md:1530`).

🚨 **Minting is not the hard part; unminting is.** An admin **cannot** revoke another account's
token by any scripted route — `gitea admin user` has no delete subcommand,
`DELETE /users/{username}/tokens/{token}` needs basic auth **as that account**, and the web UI shows
only the logged-in user's own tokens (`deferred-work.md:272-280`). The only exit is deleting the
`access_token` row. Story 1.11 declared **zero** tokens and minted two (`deferred-work.md:505-510`).
**Plan the exit before the mint, in writing, in this file.** Blocking Open Question 1.

### 7. You cannot read a job log here, so make the workflow itself the evidence

> the API returns **404** for `actions/jobs/{id}/logs`, `actions/runs/{run}/jobs/{id}/logs` and
> `actions/tasks/{id}/logs`; the storage tree `/data/gitea/actions_log` holds 3713 files with
> highest task id **4867** while our tasks 4872–4879 are absent and their `log_in_storage` stays
> `f` … **Anything a story needs to prove must be made observable in the database or the
> filesystem, not printed to stdout.** (`deferred-work.md:600-611`)

Two routes remain, and this story has both:

- **The registry itself** — `package` / `package_version` tables, or the packages API
  (`GET /packages/CRM/container/fe-prionex/<tag>` returned `200` with `creator.login` and
  `created_at` in Story 1.10, `docs/migration-decisions.md:1185-1187`).
- **A step that fails closed.** Story 1.12's rule: a check that cannot fail proves nothing
  (`2-1-…md:330-333`), and its inverse is the tool here — an in-job
  `docker manifest inspect … || exit 1` turns **green job status** into evidence, because red is the
  only other outcome. Story 1.8's `ac3` used exactly that (`1-8-…md:1255-1257`).

### 8. `Dockerfile.prod`'s build-arg contract has no defaults, and Vite will not complain

`Dockerfile.prod:19-22` declares `ARG VITE_API_BASE_URL` / `ARG VITE_WS_URL` with **no default** and
promotes both to `ENV`. `npm run build` is `tsc -b && vite build`; with the variables absent Vite
bakes `undefined` and **the build still passes**. Story 3.3 owns real values via OpenBao
(`epics.md:1312-1321`). This story must pass **explicit literal placeholders** — Story 1.10's
precedent is `VITE_API_BASE_URL=https://reg-check-1-10.invalid/api`,
`VITE_WS_URL=wss://reg-check-1-10.invalid/ws`, *"значения намеренно фиктивные, образ тестирует
реестр, а не бандл, и не является деплойным артефактом"* (`docs/migration-decisions.md:1188-1190`).
**No `||` fallback anywhere** — D6/NFR8, and the exact construct `2-1-…md:44` names as a mine.

### Prohibitions

🚨 **A prohibition here cannot be overridden by a subtask.** (`deferred-work.md:298-302` — this rule
exists because Story 1.10's Task 6.3 overrode one.)

1. **No `runs-on: ubuntu-latest`, ever.** It resolves — on another team's `ci-hub` runner
   (`2-1-…md:41`). Inherited unchanged from Story 2.1 AC7.
2. **No `uses:` step under `runs-on: docker-build`.** §1. It has no Node runtime; the step does not
   fail informatively, the job does.
3. **Nothing outside `crm/fe-prionex`.** The `crm/` namespace is shared: **87 packages / 620
   versions**, of which only `fe-prionex` is ours (`deferred-work.md:256-260`). No push, no delete,
   no tag under `api-prionex/*`, `hub-*`, `infra/*`, `ci-probe*`.
4. **Do not push any tag matching `keep_pattern`.** `latest`, `prod-current`, `preprod-current`,
   `buildcache`, semver, `(pre)?prod-<sha>`, `sha-<sha>-(pre)?prod` are **permanent** and belong to
   Stories 3.2, 3.5, 5.4, 6.3 and 6.6. A permanent tag pushed by a first-publish probe cannot be
   removed without a token (§6) and will be read as real by whoever looks next.
5. **No `--platform`, no `platforms:`, no `docker/setup-qemu-action`.** §3.
6. **No `cache-from` / `cache-to` of any kind, and specifically no `type=gha`.** FR9 and Story 3.5
   own the registry cache (`epics.md:1376-1387`); `type=gha` does not work off GitHub
   (`docs/forgejo-migration.md:108`).
7. **Do not implement the tagging scheme.** No `<branch>` tag, no semver, no `latest`, no
   `docker/metadata-action` tag matrix. Story 3.2 (`epics.md:1271-1300`). One tag is enough to prove
   a push.
8. **No `||` fallback and no hardcoded real API/WS URL** in the workflow. §8, D6, NFR8. Real values
   are Story 3.3's, and they come from OpenBao, not from a literal.
9. **Do not modify `Dockerfile.prod`, `nginx.conf`, `.dockerignore`, `package.json` or anything under
   `src/`.** Story 3.3's AC (`epics.md:1342-1347`) requires the build-time contract *used unchanged*.
   That includes not "fixing" `Dockerfile.prod:13`'s odd `npm ci --only=production=false` — see Dev
   Notes.
10. **Do not add `push`, `pull_request` or `tags:` triggers to `build.yml` in the commit that lands.**
    That is Story 3.4 (`epics.md:1349-…`, FR6). A `tags:` clause is separately dangerous: a tag on
    any commit predating 2026-08-10 resolves legacy `CD.yml` with `ENV_TYPE="production"`
    (`2-2-…md:191-193`).
11. **Do not touch `.forgejo/workflows/ci.yml`.** Story 2.2 landed its trigger block on `main` as
    `fed828d1` and it is proven (`2-2-…md:661-679`); the comment at `.forgejo/workflows/ci.yml:35-38`
    is marked LOAD-BEARING for a measured reason.
12. **Do not let any commit you push land without `.forgejo/workflows/` in its tree.** D9's invariant
    is **per commit**, not per branch (`docs/migration-decisions.md:506-512`); an empty tree falls
    through to `.github/workflows/CD.yml`, whose `deploy` job targets PROD on `main`.
13. **Do not touch `.github/workflows/`.** D7 — no action is taken on GitHub
    (`docs/migration-decisions.md:262`); Story 7.2 deletes the legacy files.
14. **Do not mint a Forgejo API token before its deletion route is written into this file.** §6.

---

## Acceptance Criteria

Source: `epics.md:1240-1269`, Story 3.1. Covers **FR5** (`epics.md:77-78`). Prerequisite for Stories
3.2, 3.3, 3.4, 3.5 and 3.6. Not FR6/FR7/FR8/FR9 — those are 3.4/3.2/3.3/3.5.

**AC1 — the workflow exists, authenticates and builds `Dockerfile.prod`.**
Given ~~the `docker-build` runner label from Story 1.7~~ — 🔴 **amended by this story: `docker-build`
carries no Node runtime, so no `uses:` step runs under it (`1-8-…md:1102-1106`), and the amendment is
already in `docs/forgejo-migration.md:204`. The label used must be stated explicitly with its
reason** —
when `.forgejo/workflows/build.yml` is created,
then it checks out the code, sets up buildx, logs in to `git.crm-prionex.com` using
~~`REGISTRY_TOKEN`~~ **`REGISTRY_USER` / `REGISTRY_TOKEN_RW`** (`REGISTRY_TOKEN` and `ci-bot` never
existed — `epics.md:1251`, D14 at `docs/migration-decisions.md:1141-1145`), and builds
`Dockerfile.prod`,
**and the build-args are explicit non-production literals with no `||` fallback** (added by this
story — §8; without it a bundle carrying `undefined` passes the AC).

**AC2 — an image reaches `git.crm-prionex.com/crm/fe-prionex`, proven server-side.**
Given AC1's workflow ran,
then the resulting image is pushed to `git.crm-prionex.com/crm/fe-prionex`,
**and its presence is confirmed from the registry itself** — `package_version` row or
`GET /packages/CRM/container/fe-prionex/<tag>` → `200` with `creator.login` and `created_at` — **not
from a step's exit code and not from a log line** (added by this story — §7; the client's exit code
was explicitly rejected as sufficient in Story 1.10, `docs/migration-decisions.md:1184`).

**AC3 — dispatch-only at first, and a real dispatch proves the push.**
Given the workflow is being developed,
when it is first committed,
then its only trigger is `workflow_dispatch` with a `ref` input,
and a successful push to the registry is confirmed via manual dispatch.
*🔴 Needs a Forgejo API token that does not currently exist — §6, Blocking Open Question 1. If the
route taken is a temporary push trigger on a probe branch (Story 1.12's workaround,
`docs/migration-decisions.md:1529`), the deviation is recorded here, the shipped file still carries
`workflow_dispatch` + `ref` and nothing else, and the AC closes as **partially «не проверено»** with
the reason named — as Story 2.2 did for AC2/AC3 (`2-2-…md:719-724`).*

**AC4 — the `docker/*` question is answered from evidence, not from the epic's stale premise.**
Given ~~any action from the `docker/*` family failed to resolve in Story 1.8~~ — 🔴 **that premise is
false and was corrected the same week: all four `docker/*` actions resolve
(`docs/migration-decisions.md:1517`, `1-8-…md:654`); what failed was the *push*, for a diagnosed
reason, and both remedies are green (`deferred-work.md:203-209`)** —
when the workflow is written,
then either `docker/setup-buildx-action@v3` **with `driver: docker`** or the native
`docker build` + `docker push` replacement is used, the choice is justified in writing,
and no unresolvable action remains in the file.

**AC5 — concurrency is declared and its basis is stated.**
Given two builds of the same ref could race to push identical tags,
when concurrency is configured,
then the workflow declares a **workflow-level** `concurrency` group `build-${{ github.ref }}` with
`cancel-in-progress: false`,
and the behaviour observed in Story 1.3 determines whether this is relied upon or treated as
best-effort.
*Story 1.3's answer is a definite **yes** for workflow-level queueing and a definite **no** for
job-level (`docs/migration-decisions.md:326-343`, `:368-371`; `1-3-…md:113-116`). Writing the block
at job level would be silently ignored.*

**AC6 — [DERIVED, not in the epic] the registry is left in a state the next reader can trust.**
Given the retention rule protects specific tag shapes and expires everything else at 14 days (§4),
and `crm/fe-prionex` currently holds 7 versions (`1-11-…md:828`) including seeded test material,
when this story finishes,
then the tag it pushed is named, its fate under `keep_pattern` is stated, and the disposal of
`sha-a1b2c3d-prod` (id 1930) is **decided explicitly** — deleted, or deliberately left with the
owner named (`deferred-work.md:550-552`).
*Derived from §4 and Prohibition 4; Story 3.2 inherits whatever tag vocabulary exists when it starts.*

---

## Tasks / Subtasks

### Task 1 — Bind the state before writing YAML (AC: 1, 2, 5)

- [ ] 1.1 Confirm both runners are online, carry `node-20` **and** `docker-build`, and that
      `container.options` on **both** still contains `--add-host git.crm-prionex.com:10.67.0.1` and
      `-e DOCKER_HOST=tcp://172.17.0.1:2375` (`docs/runners/config.yml:62`). This file is a
      **record, not a deployment mechanism** — it drifts (`docs/runners/docker-compose.yml` header).
      Read the host, not the repo copy. ⚠️ **And read the *effective* config, not the file:** the
      `--add-host openbao:…` line was written into both host configs and **neither runner has been
      restarted, so that change is not in effect** (`deferred-work.md:585-590`). The
      `git.crm-prionex.com` mapping *is* in effect — its runner restart happened in Story 1.8
      (`docs/migration-decisions.md:903-910`) — but the two lines now have different statuses in the
      same file, which is exactly how a "verified" config check goes wrong.
- [ ] 1.2 Record the run-count baseline before anything: `action_run` for repo 16, `total`, `max(id)`,
      `max(index)`. Story 2.2 left it at run **505** / index 34 (`2-2-…md:611`, `:574`).
- [ ] 1.3 Record host state: free memory and load average on s1. Story 2.2 saw 7.2 GiB free, load
      11.07/17.14/14.79 (`2-2-…md:575`). **Also record free disk on the dind volumes** — this is the
      first story that builds a real image inside `dind-storage`, and nothing has measured it.
- [ ] 1.4 Record the current contents of `crm/fe-prionex`: every `package_version` with id, name and
      `created_unix`. Expected 7 (`1-11-…md:828`), including `sha-a1b2c3d-prod` (id 1930). This is
      AC2's and AC6's before-picture and cannot be reconstructed afterwards.
- [ ] 1.5 Confirm `REGISTRY_USER` / `REGISTRY_TOKEN_RW` still exist at `CRM` org scope and that the
      repository still has no repo-level copy. Org secrets reaching workflows here is **proven**
      (`deferred-work.md:238-242`) — confirm the secrets are still there, do not re-prove the
      mechanism.

### Task 2 — Decide the label question in writing (AC: 1, 4) — 🚨 nothing in Task 5 may be written first

- [ ] 2.1 Choose and justify:
      - **(a) `runs-on: node-20`, docker CLI installed by a `run:` step, `docker/*` actions.** The
        proven path — Story 1.8's `ac3` job ran here (`1-8-…md:1347`: *"Every job in the probe
        workflow pinned `runs-on` to `node-20` only"*) and the amended plan already says so
        (`docs/forgejo-migration.md:204`, `:351`). Cost: an `apt-get install docker.io` per job
        (`1-8-…md:1218-1221`), i.e. a dependency on Debian mirrors inside every build, and a
        documented deviation from FR5's literal text.
      - **(b) `runs-on: docker-build`, `run:` steps only.** Matches FR5's label literally. Cost:
        **no `actions/checkout`**, so the build context must be produced by hand (a `git clone` with
        a credential, which needs a token — §6). Nothing in this migration has ever done that.
      - **(c) Re-register `docker-build` against an image carrying both Node and the docker CLI.**
        Makes FR5 true. Cost: labels are fixed at *registration* time on this runner
        (`docs/runners/config.yml:19-24` — `labels: []` is deliberate), so this means re-registering
        both production runners on a shared host. Out of proportion to this story.
      **Recommendation: (a)**, with the deviation from `epics.md:1248` / FR5 written into this file
      and a `⚠️`-annotation added at `epics.md:1248` the way Story 1.10's review annotated FR10
      (`docs/migration-decisions.md:1150-1155`).
- [ ] 2.2 If (a): state where the docker CLI comes from and what happens when the mirror is
      unreachable. `apt-get install docker.io` is the only recorded method (`1-8-…md:1218-1221`);
      note that `docker.io` on bookworm ships **no buildx plugin** — `setup-buildx-action` supplies
      it — so dropping the action means also supplying buildx, or using plain `docker build`.
- [ ] 2.3 Decide remedy **(b) `driver: docker`** or remedy **(d) native `docker build` + `docker
      push`** for the push (§2). Both are green (`1-8-…md:676-678`). **Recommendation: (b)** —
      `deferred-work.md:203` states the resolution as *"Story 3.1 keeps `docker/build-push-action`"*.
      Record that the `driver: docker` line is **the** load-bearing line in the file and add a
      🚨 LOAD-BEARING comment beside it, the way `.forgejo/workflows/ci.yml:35-38` marks
      `branches-ignore`.

### Task 3 — Declare the budget before spending it (AC: 3) — 🚨 before any push, any dispatch, any mint

- [ ] 3.1 State, as integers, before creating anything:
      **CI runs** this story will cause (every probe-branch push starts four jobs, ~468 s — §5),
      **build runs**, **image pushes**, **registry deletions**, **tokens minted**, **commits to
      protected branches**. Precedent both ways: Story 2.1 declared 2 dispatches and spent 2
      (`2-1-…md:385-386`); Story 2.2 declared 2 pushes / 1 run and matched exactly
      (`2-2-…md:599-602`); Story 1.11 declared **zero** tokens and minted two
      (`deferred-work.md:505-510`).
      **Suggested opening figures, to be confirmed or replaced:** ≤2 probe-branch pushes (⇒ ≤2 CI
      runs, ≈16 min wall clock), ≤3 build runs, **1** image tag pushed, 0–1 registry deletions,
      **0 or 1** tokens, 1 commit to `main` at the end.
- [ ] 3.2 Resolve Blocking Open Question 1 (§6) with Oleg **before** writing the trigger block. If a
      token is minted, **write its deletion route into this file first** — the `access_token` row is
      the only exit (`deferred-work.md:272-280`).
- [ ] 3.3 Name the probe branch and confirm it will be cut from `main` (so it carries `ci.yml` and
      `build.yml` together, and D9's per-commit invariant holds). Confirm deletion, local **and**
      remote, is part of Task 8.

### Task 4 — Decide the tag, in writing, without doing Story 3.2's job (AC: 2, 6)

- [ ] 4.1 Choose **one** tag. Options and their costs:
      - **A throwaway literal** (Story 1.10's `reg-check-1-10` precedent). Unambiguously not a
        release artifact. Cost: it matches no `keep_pattern` alternative so it self-expires at 14
        days *if* the threshold works (§4.2 «не проверено»), and deleting it sooner needs a
        `write:package` token (§6).
      - **`sha-<short>` of the built commit.** The FR7 shape 3.2 will formalise, so nothing is
        thrown away, and `epics.md:197` confirms it is **not** protected — it expires on its own.
        Cost: it looks like a real artifact to a reader before 3.2 lands.
      **Whichever is chosen, state its `keep_pattern` verdict explicitly** (§4) rather than assuming.
- [ ] 4.2 Confirm the chosen tag matches **none** of the alternatives in the `keep_pattern` quoted in
      §4. Do this by compiling the pattern and matching, not by eye — Story 1.11 shipped a **dead
      clause** in this exact pattern that was only caught by comparison against a reference
      (`docs/migration-decisions.md:1563-1567`).
- [ ] 4.3 Decide `sha-a1b2c3d-prod` (id 1930). 🔴 Note before deciding: that tag **matches**
      `sha-[0-9a-f]{7,64}-(pre)?prod` (`a1b2c3d` is 7 hex chars), so the retention rule will **never**
      remove it — it is permanent until deleted by hand. Deleting it needs a `write:package` token
      and is chargeable against Task 3.1. Deferring it is defensible; leaving it undecided is not
      (`deferred-work.md:550-552`). Same question, same answer or a different one, for
      `ci-probe` / `ci-probe-cache`, whose stated owner is *"whoever closes Epic 1"*
      (`deferred-work.md:529-534`) — **this story is not that.**

### Task 5 — Write `.forgejo/workflows/build.yml` (AC: 1, 2, 4, 5)

- [ ] 5.1 `on: workflow_dispatch:` with a `ref` input and **nothing else** (AC3, Prohibition 10).
- [ ] 5.2 Workflow-level `concurrency: {group: build-${{ github.ref }}, cancel-in-progress: false}`.
      **Not** under a job — job-level is ignored silently (`docs/migration-decisions.md:368-371`).
- [ ] 5.3 The label from Task 2.1, with the reason in a comment naming `epics.md:1248` and
      `1-8-…md:1102-1106`, so the next reader does not "correct" it back to `docker-build`.
- [ ] 5.4 `actions/checkout@v6` — proven to resolve (`docs/migration-decisions.md:969`). If the `ref`
      input is honoured, check out that ref, not the default branch.
- [ ] 5.5 Docker CLI step per Task 2.2, then `docker/setup-buildx-action@v3` **with `driver: docker`**
      (or the native equivalent from Task 2.3).
- [ ] 5.6 `docker/login-action@v3` with `registry: git.crm-prionex.com`,
      `username: ${{ secrets.REGISTRY_USER }}`, `password: ${{ secrets.REGISTRY_TOKEN_RW }}`
      (`1-8-…md:1228-1233`). No repo-level copies of either.
- [ ] 5.7 Build `Dockerfile.prod` with `context: .`, `file: ./Dockerfile.prod`, `push: true`, the
      single Task 4 tag, and **explicit literal** `VITE_API_BASE_URL` / `VITE_WS_URL` build-args
      (§8). No `cache-from`/`cache-to`, no `platforms`, no metadata tag matrix.
- [ ] 5.8 A **fail-closed** assertion step after the push:
      `docker manifest inspect <tag> || (echo … && exit 1)` (`1-8-…md:1255-1257`). Its purpose is
      that a green job is only reachable if the manifest exists — the log is unreadable (§7).
- [ ] 5.9 Grep the finished file for `ubuntu-latest`, `||`, `type=gha`, `--platform`, `platforms:`,
      `setup-qemu`, `tags:` and `latest`. Comments explaining a prohibition may contain the words;
      active configuration must not. Strip comments before grepping, as Story 2.1 did
      (`2-1-…md:403-406`).

### Task 6 — Prove it (AC: 2, 3, 4)

- [ ] 6.1 Push the probe branch. **Record the run index before and after**, and expect **one CI run**
      to appear from the push alone (§5). Do not mistake it for the build run — check `workflow`/
      `event` on the row, not the count (`docs/migration-decisions.md:490-492`).
- [ ] 6.2 Trigger `build.yml` by the Task 3.2 route. Record run id, index, event, the SHA it is bound
      to, task id, status and duration. Runner attribution comes from each runner's **container
      log** — the Story 1.9 method, re-used in 1.12, 2.1 and 2.2 (`2-2-…md:634-637`) — never from the
      job log.
- [ ] 6.3 **Record the build duration.** No image build has ever been timed on these runners; Story
      2.4's budget and Story 3.5's cold/warm comparison both start from this number.
- [ ] 6.4 Confirm AC2 **server-side**: the `package_version` row, or
      `GET /packages/CRM/container/fe-prionex/<tag>` → `200` with `creator.login` and `created_at`.
      Record the digest.
- [ ] 6.5 If a run fails, fix and re-run, and **count it against Task 3.1's declared budget** rather
      than quietly. The first dispatch of Story 1.8's own probe died on a YAML colon-space trap
      (`1-8-…md:681-684`) — a `run:` one-liner containing `: ` parses as a mapping. Use block
      scalars.

### Task 7 — Record (AC: all)

- [ ] 7.1 Close or restate `deferred-work.md:201-211` (the Story 3.1 blocker). It exists for this
      story; it must not survive it unchanged.
- [ ] 7.2 Record the Task 2.1 label decision **and** annotate `epics.md:1248` and FR5
      (`epics.md:77-78`) at source with the correction, per the precedent at
      `docs/migration-decisions.md:1150-1155`. The later stories read that line, not this file.
- [ ] 7.3 Record the build duration, the image size, and the dind disk delta — Stories 2.4, 3.5 and
      4.2 all consume them.
- [ ] 7.4 Record the AC6 decision on `sha-a1b2c3d-prod` and `ci-probe*` in `deferred-work.md`,
      whichever way it goes, with the owner.
- [ ] 7.5 Note that `docs/forgejo-migration.md:204` still ends with *"🔴 Одного этого недостаточно:
      push падает и на `node-20`…"* — stale since 2026-08-11 (`deferred-work.md:203`). Fix it or say
      why not; a plan document that contradicts a resolved blocker is how this story gets re-litigated.
- [ ] 7.6 A changelog row in `docs/migration-decisions.md`, plus a new D-record if the label decision
      is material (it changes what FR5 means).

### Task 8 — Close (AC: all)

- [ ] 8.1 Delete the probe branch, local **and** remote. Re-verify D9's invariant on `main`,
      `staging` and `development` afterwards (`git ls-tree -r --name-only <ref> -- .forgejo/workflows/`),
      and state the new shape: `main` now carries `README.md`, `ci.yml` **and** `build.yml`.
- [ ] 8.2 Re-run Task 1.4's registry inventory and diff it. State every version that appeared or
      disappeared, including untagged rows.
- [ ] 8.3 If a token was minted, execute its planned exit and record the live-token count before and
      after (`docs/migration-decisions.md:1530` records `97 → 96` as the format).
- [ ] 8.4 Close the Task 3.1 ledger: declared against actual, with the difference explained.
- [ ] 8.5 Commit; update `sprint-status.yaml`
      (`3-1-build-and-publish-an-image-to-the-forgejo-registry`) to `review`, and `epic-3` from
      `backlog` to `in-progress`.

---

## Dev Notes

### Exact source facts (verified at `043b3765`)

**`Dockerfile.prod` — 41 lines, two stages, unchanged since 2026-08-10.**

| element | line | value |
|---|---|---|
| builder stage | `:5` | `FROM node:20-alpine AS builder` |
| workdir | `:7` | `/app` |
| dependency install | `:13` | `RUN npm ci --only=production=false` |
| context copy | `:16` | `COPY . .` |
| build args | `:19-20` | `ARG VITE_API_BASE_URL`, `ARG VITE_WS_URL` — **no defaults** |
| promoted to env | `:21-22` | `ENV VITE_API_BASE_URL=$VITE_API_BASE_URL`, `ENV VITE_WS_URL=$VITE_WS_URL` |
| build | `:25` | `RUN npm run build` (= `tsc -b && vite build`) |
| runtime stage | `:28` | `FROM nginx:alpine` |
| assets | `:31` | `COPY --from=builder /app/dist /usr/share/nginx/html` |
| config | `:34` | `COPY nginx.conf /etc/nginx/conf.d/default.conf` |
| port | `:37` | `EXPOSE 80` |
| entry | `:40` | `CMD ["nginx", "-g", "daemon off;"]` |

No `--platform` anywhere. No `USER`, no `ENTRYPOINT`, no `HEALTHCHECK`. Base tags are floating
(`node:20-alpine`, `nginx:alpine`) — worth noting for Story 3.6's immutability claim, **not** worth
pinning inside this story (Prohibition 9).

⚠️ **`:13`'s `--only=production=false` is malformed npm syntax** and its effective behaviour on
npm 10.8.2 is **«не проверено»**. It evidently installs devDependencies today, because `vite`/`tsc`
are dev deps and `.github/workflows/CD.yml:102-114` has been building this file. If a build fails at
`:25` with a missing `vite`, this line is the first suspect. **Do not change it here** — Story 3.3's
AC requires the contract used unchanged (`epics.md:1342-1347`), and a Dockerfile edit inside a
first-publish story turns two variables into one experiment.

⚠️ **`.dockerignore` excludes `.git`**, so no git metadata reaches the build. Story 3.6's
"traceable to the exact SHA" (`epics.md:1236-1237`) will need a `--build-arg` or an OCI label, not
`git rev-parse` inside the image. Out of scope here; noted so 3.6 does not discover it late.

**Current build invocation, for reference only (D7 — read, never edit).**
`.github/workflows/CD.yml:102-114` — `docker/build-push-action@v5`, `file: ./Dockerfile.prod`,
`build-args: VITE_API_BASE_URL`/`VITE_WS_URL` from a branch-dependent step, `cache-from: type=gha`,
`cache-to: type=gha,mode=max`. Its per-branch fallback pattern at `:40-77` silently defaults to the
**production** API — the exact construct FR8's AC (`epics.md:1323-1327`) forbids carrying over.

**Runner facts (`docs/runners/config.yml`, `config-2.yml`, `docker-compose.yml` — records, verify on
the host).**

- Labels registered as `node-20:docker://node:20-bookworm,docker-build:docker://code.forgejo.org/oci/docker:cli`
  (`1-7-…md:358`, `:387`). Labels are fixed at registration; `labels: []` in the config is deliberate
  (`docs/runners/config.yml:19-24`).
- `container.options` on runner 1 (`:62`), byte-identical on runner 2 per Story 2.1's check
  (`2-1-…md:314-315`):
  `-e DOCKER_HOST=tcp://172.17.0.1:2375 --add-host git.crm-prionex.com:10.67.0.1 --add-host openbao:172.20.0.5`
- Two separate dinds (`dind` 192.168.226.2, `dind2` 192.168.226.5), **neither declares
  `extra_hosts`** — the daemon's own resolution of `git.crm-prionex.com` (`10.70.0.1`) is what makes
  `driver: docker` work (`deferred-work.md:205-207`), not the job container's mapping.
- `capacity: 2`, `timeout: 2h`, `force_pull: true`, `mem_limit: 2g` **on the runner container, which
  does not cap the job** — a job-equivalent container sees 104 CPUs / 128454 MB (`2-1-…md:309-310`).
- `10.67.0.1` and `10.70.0.1` are **two WireGuard interfaces of the same s1** (`wg-clients` /
  `wg-private`); nginx listens on `0.0.0.0:443` and both return `401`. The address choice is
  deliberate, not a typo (`docs/migration-decisions.md:1517`, and `1-8-…md` review).

**Registry facts.**

- Path: `git.crm-prionex.com/crm/fe-prionex` — lowercase `crm` is correct per OCI spec even though
  the git remote is `/CRM/` (`docs/migration-decisions.md:913`).
- Credentials: `REGISTRY_USER` / `REGISTRY_TOKEN_RW` on account `robot-registry`, **org scope**,
  **valid, with push rights**, and **org secrets reach workflows here without a repo-level copy** —
  all proven by `docker/login-action@v3` authenticating in Story 1.8's credentialed job
  (`deferred-work.md:228-232`, `:238-242`). `REGISTRY_TOKEN` and `ci-bot` **never existed**
  (`docs/migration-decisions.md:1141-1145`).
- `REGISTRY_TOKEN_RW`'s value is **unreadable** — Forgejo secrets are write-only — so anything
  needing the credential outside a workflow needs a freshly minted equivalent, which is what Story
  1.10 did (`docs/migration-decisions.md:1166-1170`).
- The `crm/` namespace is shared: **87 packages / 620 versions** in `CRM`, 80 of them
  `api-prionex/*` (`deferred-work.md:256-260`, `1-11-…md:363`). `crm/fe-prionex` holds **7 versions**
  (`1-11-…md:828`).
- Deletion route that actually reclaims storage:
  `DELETE /packages/{owner}/{type}/{name}/{version}` (`deferred-work.md:535-542`), needs
  `write:package` (`write:repository` gives `403` — `docs/migration-decisions.md:1237-1238`).

**Concurrency (Story 1.3 / D8).** Workflow-level `concurrency` with `cancel-in-progress: false`
queues — *"очередь подтверждена тестом, определённое «да»"* (`docs/migration-decisions.md:326-335`),
cross-checked by a cancellation probe (`:338-343`). Job-level is **ignored silently**
(`:368-371`, `1-3-…md:113-116`). Forgejo also auto-cancels superseded runs on `push` and
`pull_request` **without** any block (`:373-376`) — irrelevant here, since AC3's only trigger is
`workflow_dispatch`.

### Anti-patterns for this story

- **Writing `runs-on: docker-build` because FR5 says so.** §1. The job does not fail informatively.
- **Copying the pre-review probe from `1-8-…md:1214-1257`.** It has no `driver: docker` and was never
  dispatched. It is the version that *would have failed*.
- **Removing `--add-host` to test whether it is needed.** It is a shared-runner config line; other
  things depend on it, and the story that added it called it permanent
  (`docs/migration-decisions.md:910`).
- **Implementing the tagging scheme "while we're here".** Story 3.2. One tag proves a push.
- **Pushing `latest` or `buildcache`.** Both are `keep_pattern`-protected and therefore permanent,
  and both belong to other stories (`epics.md:1293-1296`, `:1396-1400`).
- **Adding `cache-from: type=registry` "since we're touching the registry".** Story 3.5, FR9.
- **Reporting a push because a step went green.** The client's exit code was explicitly rejected as
  sufficient in Story 1.10 (`docs/migration-decisions.md:1184`), and the log that would show more is
  unreadable (§7).
- **Planning evidence that prints.** `deferred-work.md:600-611`.
- **Minting a token first and thinking about revocation later.** `deferred-work.md:272-280`,
  `:505-510`.
- **Assuming the 14-day retention threshold is exercised.** It is configured; the experiment ran at
  `remove_days = 0` (`1-11-…md:269-276`).

### Previous story intelligence

- **1.8:** all four `docker/*` actions resolve; the push failed for a diagnosed reason; **both**
  remedies were then proven green (run index 22, task 2639). Its own review filed "Story 3.1 will
  author a workflow that cannot work" against the `docker-build` label — that is §1.
- **1.8, method:** a `run:` one-liner containing `: ` is parsed as a YAML mapping and the dispatch
  returns `HTTP 500` (`1-8-…md:681-684`). Use block scalars.
- **1.10:** cross-build under QEMU dies in `esbuild`; a native amd64 build on s1 works; a push is
  confirmed by the **server**, not the client; deleting a *tag* is not deleting an *image*.
- **1.11:** an empty result is not evidence of safety — make the property under test load-bearing.
  Its `keep_pattern` shipped with a **dead clause** that only a character-level comparison caught.
- **1.12:** the instance disagrees with the plan more often than not; a check that cannot fail proves
  nothing. Also the source of the push-pinned-to-a-probe-branch dispatch workaround
  (`docs/migration-decisions.md:1529`).
- **2.1:** job logs are unreadable, and that is a property of the instance, not of any workflow.
  Declared 2 dispatches, spent 2.
- **2.2:** `push` is now armed on every branch except the three long-lived ones — a probe branch is
  no longer free. Its negative control was made strong by querying **by SHA**, not by absence from a
  list (`2-2-…md:613-622`); reuse that shape for "no unexpected run appeared".

### Testing standards

No application code changes, so "testing" means observation, and every AC closes on one of exactly
three things or it is marked **«не проверено»** with the reason:

1. A row in `action_run` / `action_run_job` / `action_task` (id, index, event, `commit_sha`,
   `runner_id`, status, duration).
2. A row in `package` / `package_version`, or a packages-API response with `creator.login` and
   `created_at`.
3. A **fail-closed** in-job assertion, where green job status is only reachable if the property
   holds. State explicitly which property each assertion makes load-bearing.

Never a log line, never a screenshot, never a client exit code alone. Runner attribution comes from
the runners' own container logs. Timestamps in UTC, with the server's `+02:00` values recorded as
given (`docs/migration-decisions.md:473-476`). Run index **before and after** every event, plus the
id of the newest run — a count alone was recorded as a gap in D9 (`:490-492`).

### Project Structure Notes

| Path | Change |
|---|---|
| `.forgejo/workflows/build.yml` | **NEW** — the only file this story creates. Second executable workflow on `main`. |
| `.forgejo/workflows/ci.yml` | **Untouched** (Prohibition 11). |
| `.forgejo/workflows/README.md` | **Untouched.** Deleting it re-arms D9's hazard (Prohibition 12). |
| `Dockerfile.prod`, `nginx.conf`, `.dockerignore` | **Read only** (Prohibition 9). |
| `.github/workflows/CD.yml`, `CI.yml` | **Read only.** D7. |
| `epics.md` | UPDATE — ⚠️-annotate `:1248` and FR5 (`:77-78`) with the label correction (Task 7.2). Annotate in place, do not reflow: other stories cite this file by line number. |
| `docs/forgejo-migration.md` | UPDATE — `:204`'s stale "push падает и на `node-20`" (Task 7.5). |
| `deferred-work.md` | UPDATE — close/restate `:201-211`; record the AC6 disposal decision and the build-duration/disk numbers. |
| `docs/migration-decisions.md` | UPDATE — changelog row; new D-record if the label decision is material. |
| `sprint-status.yaml` | UPDATE — `3-1-…` → `review`, `epic-3` → `in-progress`. |

Nothing in `src/`, no `package.json` change, no Dockerfile change, no runner config change.

### References

- `epics.md:1234-1239` Epic 3 goal; `:1240-1269` Story 3.1 ACs; `:1271-1300` Story 3.2's scope
  boundary; `:1302-1347` Story 3.3 (build-args, `Dockerfile.prod:19-22` contract);
  `:1376-1400` Story 3.5 (`buildcache`, `type=gha`); `:1402-1431` Story 3.6 (traceability);
  `:77-92` FR5–FR9; `:94-95` FR10 with its `ci-bot` correction; `:99` FR11's defect annotation;
  `:197` `sha-<commit>` is not `keep_pattern`-protected; `:319-323` the FR coverage map.
- `docs/migration-decisions.md#d12` (`:885-1022`) — per-action verdicts (`:969-980`), the `--add-host`
  fix and why the line is permanent (`:893-914`), the registry path (`:913`);
  `#d14` (`:1139-1296`) — `robot-registry` adoption (`:1150-1155`), the QEMU cross-build failure and
  the native s1 build (`:1174-1190`), server-side push confirmation (`:1184-1187`), the tag deletion
  route (`:1237-1238`); `#d8` (`:302-427`) — concurrency proven (`:326-343`), job-level ignored
  (`:368-371`); `#d9` — per-commit invariant (`:506-512`), no cancel endpoint (`:581-585`);
  `#d7` (`:262`) — no action on GitHub; changelog `:1517` (all four `docker/*` resolve; the EOF
  diagnosis), `:1519-1521` (the retention rule); the rule-restoration block `:1535-1570`.
- `deferred-work.md:201-211` — **the Story 3.1 blocker and its resolution**; `:213-227` the original
  reasoning and the four candidate remedies; `:228-242` credentials and org-secret visibility;
  `:256-267` the shared `crm/` namespace and the untagged residue; `:272-280` token revocation is a
  dead end; `:505-510` the zero-declared/two-minted precedent; `:512-525` FR11's defect;
  `:529-534` `ci-probe` ownership; `:535-542` the real reclamation route; `:543-549` the
  under-evidenced "tagged versions only" finding; `:550-552` `sha-a1b2c3d-prod`;
  `:600-611` job logs unreadable; `:141-146` s1 contention.
- `1-8-…md:654-689` — the AC3 story end to end: all four actions resolve, the EOF failure, the
  diagnosis, the four remedies, and **both remedies proven green**; `:1102-1106` the `docker-build`
  no-Node decision; `:1214-1257` the **pre-review** probe YAML; `:1347` every job ran on `node-20`.
- `1-10-…md:78-79`, `:224-227` — the two-part registry prerequisite as Story 1.10 recorded it for
  this story.
- `1-11-…md:517-519`, `:544-556`, `:683-691`, `:739-751`, `:828` — the rule's fields, the hand-check
  table, what was actually deleted, the storage finding, the registry inventory.
- `2-1-…md`, `2-2-…md` — the evidence standard, the run-cost numbers, the budget discipline, and the
  shape of an honest deferral.
- `.forgejo/workflows/ci.yml:1-45` — the trigger block a probe branch will inherit;
  `docs/runners/config.yml:62`, `docs/runners/docker-compose.yml` — the runner records.

---

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

---

## Open Questions for Review

### Blocking

1. **The dispatch route (§6).** AC3 requires `workflow_dispatch` with a `ref` input, proven by a
   manual dispatch. No Forgejo API token exists, minting one needs Oleg, and **the exit must be
   written down before the mint** — an admin cannot revoke another account's token by any scripted
   route (`deferred-work.md:272-280`). Three acceptable answers: Oleg dispatches from the web UI;
   Oleg mints a token with the `access_token`-row exit pre-agreed; or the story uses Story 1.12's
   push-pinned-to-a-probe-branch workaround and closes AC3's dispatch clause as «не проверено» with
   the reason named. Story 2.1 left this same question open and it was never answered
   (`2-1-…md:513-515`).

2. **The runner label (§1).** `epics.md:1248` and FR5 (`epics.md:77-78`) both name `docker-build`,
   which cannot run a `uses:` step. `docs/forgejo-migration.md:204` already says `node-20`. **Two
   canonical documents disagree**, and this story writes the file that settles it. Task 2.1
   recommends `node-20` plus an annotation at source — that is a plan edit and wants an explicit
   nod, because Stories 3.3, 3.4 and 3.5 will all inherit whichever label lands.

### Non-blocking

3. **`sha-a1b2c3d-prod` (id 1930) is permanent, not merely lingering.** It matches
   `sha-[0-9a-f]{7,64}-(pre)?prod` in `keep_pattern`, so the retention rule will never remove it
   (`deferred-work.md:550-552` says to delete it before this story pushes real images; it does not
   say it is protected). Deleting it costs a `write:package` token. Task 4.3 decides; deferring is
   defensible.

4. **`ci-probe` (6 versions) and `ci-probe-cache` (1) still have no owner** — nominally *"whoever
   closes Epic 1"* (`deferred-work.md:529-534`). Epic 1 has two stories still at `review`
   (`sprint-status.yaml`: 1-6, 1-12), so that owner does not exist yet.

5. **The `deferred-work.md:210-211` claim that `--add-host` and `driver: docker` are *both* required
   has no control.** The proven mechanism is that the daemon resolves correctly by itself. Nothing
   should be changed on that basis — but the record overstates what was measured, and a later story
   may lean on it.

6. **`docs/forgejo-migration.md:204` still describes this blocker as open**, eight days after
   `deferred-work.md:203` resolved it. Task 7.5. A plan document contradicting a resolved blocker is
   how this decision gets re-litigated by whoever writes Story 3.4.

7. **Nothing has ever measured a real image build on these runners** — not duration, not image size,
   not dind disk consumption. Story 2.4 owns a 15-minute CI budget and Story 3.5 owns cache
   effectiveness; both start from numbers this story produces first. Task 1.3 and 6.3 exist for that.

8. **`Dockerfile.prod:13`'s `--only=production=false` is malformed npm syntax** whose effective
   behaviour on npm 10.8.2 is «не проверено». It works today. It is not this story's to fix
   (Prohibition 9), but it is the first suspect if the build stage fails at `:25`.
