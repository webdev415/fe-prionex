---
baseline_commit: 22281c33
---

# Story 1.10: Enable the Forgejo Container Registry with Scoped Credentials

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a release engineer,
I want an image registry on Forgejo with least-privilege credentials,
so that CI can publish images while servers can only read them.

## 🚨 Read this before anything else

**Most of this story is already done, by someone else, before it started.** That is not a reason to
tick boxes — it is the reason this story is mostly *verification and reconciliation*, and the one
place it can go badly wrong is by "creating" things that already exist under different names.

This is the third time this pattern has appeared in Epic 1: the deploy runners (Epic 4's
correct-course), the registry credentials (Story 1.8), and now this. **The plan describes a
greenfield the platform already built.**

### 1. What is already true, verified 2026-08-12

| The epic assumes | Reality on the instance |
|---|---|
| The registry must be enabled | **Already live.** `has_packages: true`; `GET /v2/crm/fe-prionex/tags/list` → `401` (exists, wants auth). Story 1.8 pushed two images to `git.crm-prionex.com/crm/fe-prionex` and deleted them again |
| A technical user `ci-bot` must be created | **`ci-bot` does not exist.** The org has exactly three accounts: `platform-admin`, `robot-deploy`, `robot-registry` |
| Its token is stored as org secret `REGISTRY_TOKEN` | **No secret by that name.** The five that exist are `REGISTRY_USER`, `REGISTRY_TOKEN_RW`, `REGISTRY_USER_RO`, `REGISTRY_TOKEN_RO`, `SLACK_CD_WEBHOOK_URL` |
| The `write:package` credential must be created | **`REGISTRY_TOKEN_RW` already works.** Story 1.8's `docker/login-action` authenticated with it and pushed successfully |
| s1 and s2 need read-only credentials created | **s2 is already logged in** (`/root/.docker/config.json` → `auths: ['git.crm-prionex.com']`). **s1 is not** (`auths: []`) |

**So the real work is:** decide the naming reconciliation (Task 2), give **s1** a read-only
credential, prove the read-only tokens are actually read-only, and prove a digest-identical pull on
both servers. Not "enable a registry".

### 2. 🛑 The naming decision is Oleg's, and it changes FR10

`epics.md` AC2 names `ci-bot` and `REGISTRY_TOKEN`; FR10 and NFR6 repeat `ci-bot`. Neither exists.
The platform's equivalents are `robot-registry` and `REGISTRY_TOKEN_RW`. Two honest paths:

- **(a) Adopt.** Use `robot-registry` / `REGISTRY_TOKEN_RW` / `REGISTRY_TOKEN_RO`, and amend FR10,
  NFR6 and AC2 to name them. Nothing is created; the plan is corrected to match a platform this
  team does not own. **Recommended** — it is what Epic 4's correct-course and Story 1.8 both
  concluded when they met the same situation.
- **(b) Create.** Make a `ci-bot` user and a `REGISTRY_TOKEN` secret alongside the platform's own,
  so the plan's text becomes literally true. Costs a second write-capable identity on a shared
  registry for naming reasons, and leaves two credentials where one is needed.

**Task 2 is a 🛑 HARD STOP.** Do not pick (b) by default just because the epic says `ci-bot`, and do
not pick (a) silently — either way the plan text must be amended, and that is Oleg's call.

### 3. s2 is PROD, and this story is the first to touch it

Every prior story in Epic 1 was explicitly forbidden from s2 (`epics.md:251` — «The runner must not
be hosted on s2»). **AC4 requires pulling an image on s2**, so this story does touch it — but only
to `docker pull` and `docker inspect`. Verified access: SSH to `root@175.110.122.17` works **from
the workstation**, not from s1 (`Permission denied (publickey)` — s1 cannot reach s2, which is
correct and should stay that way).

**What is running there right now:** `fe-prionex` from `ghcr.io/crm-prionex/fe-prionex:main` — the
live production frontend, still served from the legacy GitHub registry. **Do not stop it, do not
re-tag it, do not `docker compose` anything on s2.** A pull adds an image; it changes nothing that
is running. If you find yourself about to run anything that is not `pull`, `inspect`, `images` or
`login`, stop.

### 4. What Stories 1.7–1.9 paid for, you inherit

| Fact | Why it matters here |
|---|---|
| The registry is unreachable from **job containers** by name — split-horizon DNS | Only relevant if you push from a workflow. `--add-host git.crm-prionex.com:10.67.0.1` is already in `container.options` |
| `docker/build-push-action` needs `driver: docker` on `setup-buildx-action` | buildx otherwise pushes from its own BuildKit container, which lacks the host mapping |
| The registry path is **lowercase** `crm`, while the git remote is `/CRM/` | `git.crm-prionex.com/crm/fe-prionex` is correct per the OCI spec. **Do not "fix" it** |
| `DELETE /packages/{owner}/container/{name}/{version}` works and returns `204` | It needs a **`write:package`**-scoped token; `write:repository` gets `403`. This is how Story 1.8 cleaned up its throwaway tags |
| Secret **values** are write-only in Forgejo | You cannot read `REGISTRY_TOKEN_RO` to test it. Testing it means using it where it is already deployed, or minting an equivalent and testing that |
| There is no cancel endpoint | Only start runs you are willing to watch finish |

### Prohibitions

1. **Never write any token into any file in this repository.** Five are already live
   (`fe_tmp_1_7`, `fe_review_1_7`, `fe_ac3_close`, `fe_pkg_cleanup`, `fe_story19`) and one earlier
   token twice vanished from the host unexplained — see Open Questions.
2. **Nothing on s2 except `pull` / `inspect` / `images` / `login`.** It runs production.
3. **Do not touch the running `fe-prionex` container on s2**, or its `ghcr.io` image. Story 6.3
   rebuilds the production commit into the Forgejo registry; that is not this story.
4. **Do not create `ci-bot` before Task 2 is answered.**
5. **Do not change the runners.** They are Stories 1.7/1.9's deliverables and 1.8's evidence base.
6. **Do not delete anything from the registry** except a throwaway tag this story itself pushed.

## Acceptance Criteria

> AC1–AC4 are verbatim from `epics.md:716-742`. AC5–AC6 are marked `[DERIVED]` and justified inline.

**AC1 — the registry accepts pushes at the target path**

**Given** the Forgejo instance
**When** the Container Registry is enabled
**Then** the target path `git.crm-prionex.com/crm/fe-prionex` accepts pushes.

> ✅ **Already true before this story.** `has_packages: true`, `/v2/crm/fe-prionex/tags/list` → `401`,
> and Story 1.8 pushed `smoke-1-8-remedy-b` and `-d` there and deleted them again. Close it by
> re-observing, and **record that it was pre-existing rather than enabled here** — the epic assumed
> this story would enable it.

**AC2 — a write-capable technical identity, stored as an organization secret**

**Given** a technical user `ci-bot`
**When** its token is created
**Then** the token carries `write:package` scope
**And** it is stored as the organization-level secret `REGISTRY_TOKEN`.

> 🛑 **Neither `ci-bot` nor `REGISTRY_TOKEN` exists — see §2.** The platform's equivalents are
> `robot-registry` and `REGISTRY_TOKEN_RW`, and the latter is *proven* to push (Story 1.8). Task 2
> settles which name wins; whichever it is, `epics.md` FR10, NFR6 and this AC must be amended to
> match, because right now three artifacts name an account that does not exist.

**AC3 — server credentials are read-only, provably**

**Given** s1 and s2 need to pull images
**When** their registry credentials are created
**Then** those tokens carry `read:package` scope only
**And** an attempt to push using a server token is rejected.

> ⚠️ Half-done and unverified. **s2 already holds a credential** (`auths: ['git.crm-prionex.com']`);
> **s1 holds none** (`auths: []`). Nobody has checked whether the s2 credential is read-only. The
> second clause — *push is rejected* — is the one that matters and the one nothing has tested.

**AC4 — the same image pulls identically on both servers**

**Given** `Dockerfile.prod` builds locally
**When** the resulting image is pushed to the Forgejo registry and then pulled from both s1
and s2
**Then** both pulls succeed
**And** the image digest is identical on both servers.

**AC5 — [DERIVED] the plan is reconciled with the platform, not silently diverged from**

**Given** `epics.md` FR10, NFR6 and AC2 name `ci-bot` and `REGISTRY_TOKEN`, neither of which exists
**When** Task 2's decision is taken
**Then** those three places are amended to name whatever is actually used
**And** the provenance of the five `REGISTRY_*`/`SLACK_*` org secrets is recorded as settled —
they are the hub's platform credentials, confirmed with `aleksey` on 2026-08-11.

> Derived, not taken from the epic's AC list.
> **Claim.** A plan that names a non-existent account is a trap for every later story that reads it.
> **Evidence.** Story 1.9's AC1 carried a stale organization-runner-list clause that had to be
> annotated at the source *after* the fact; Story 1.8 found `epics.md:233-234` already shifted.
> Leaving `ci-bot` in three places repeats that pattern deliberately.
> **Consequence if omitted.** Story 3.1 logs in with `REGISTRY_TOKEN` — a secret that does not
> exist — and fails at `docker/login-action` with an error that looks like an action problem.

**AC6 — [DERIVED] the throwaway image is removed and the namespace is left clean**

**Given** AC4 requires pushing a real `Dockerfile.prod` build
**When** the story completes
**Then** the tag it pushed is deleted from the registry (`DELETE …/packages/CRM/container/fe-prionex/<tag>` → `204`)
**And** the tag used sits outside Epic 3's namespaces (`sha-*`, `<branch>`, `v*`, `latest`,
`buildcache`, `preprod-*`, `prod-*`)
**And** nothing this story pushed remains on s1 or s2 beyond the pulled image layers.

> Derived, not taken from the epic's AC list.
> **Claim.** Epic 3 is about to define the tag namespace; a leftover from Epic 1 squats in it.
> **Evidence.** Story 1.11 — the very next story — writes the retention policy, and its rules cover
> `<branch>` tags and `*-current` only. A tag matching neither pattern would persist forever with
> no owner. Story 1.8 hit this and deleted both its tags.
> **Consequence if omitted.** The first thing the retention story has to reason about is a mystery
> tag from the story before it.

## Tasks / Subtasks

### Task 1 — Pre-flight: observe what already exists (AC: 1, 3)

- [ ] 1.1 Source the token on s1 (`. /root/.fj_token`). ⚠️ **If it is missing, stop and report** —
      it has vanished twice for reasons nobody established. Do not silently mint a sixth.
- [ ] 1.2 Record the registry's live state: `has_packages`, `GET /v2/` → `401`,
      `GET /v2/crm/fe-prionex/tags/list`, and the current package list
      (`GET /packages/CRM?type=container` — needs a `read:package` token, `write:repository` gets
      `403`).
- [ ] 1.3 Record the org account list (`GET /orgs/CRM/members`) and the org secret names. Confirm
      `ci-bot` still absent and `REGISTRY_TOKEN` still absent — if either appeared since
      2026-08-12, that is drift and changes Task 2.
- [ ] 1.4 Record each server's starting credential state: `/root/.docker/config.json` on s1
      (expect `auths: []`) and on s2 (expect `auths: ['git.crm-prionex.com']`). **Do not modify s2's
      yet** — Task 4 decides whether it needs replacing.
- [ ] 1.5 Declare the write budget and **bind every number**: N registry pushes, M tag deletions,
      one credential written on s1, K commits. Story 1.9's budget could not be checked because its
      count was left as an unbound letter; close the ledger at the end, not mid-session.

### Task 2 — 🛑 HARD STOP: settle the naming with Oleg (AC: 2, 5)

- [ ] 2.1 🛑 Present §2's two paths — **(a) adopt** `robot-registry`/`REGISTRY_TOKEN_RW` and amend
      the plan, or **(b) create** `ci-bot`/`REGISTRY_TOKEN` to match the plan's text. State the cost
      of (b) plainly: a second write-capable identity on a shared registry, created for naming
      reasons, which then has to be kept in sync with the platform's own.
- [ ] 2.2 Record the decision **and the rejected option with its reason**, in the story and in the
      decision record. Do not present the chosen path as the only one that existed.
- [ ] 2.3 If (a): amend `epics.md` FR10 (`:94-95`), NFR6 (`:209-210`) and Story 1.10's AC2 by
      **marking, not rewriting** — struck text stays, `⚠️` annotation with the date and this
      story's name. If (b): create the account and secret, and record why the platform's existing
      pair was not used.

### Task 3 — Prove the write credential (AC: 1, 2)

- [ ] 3.1 Build `Dockerfile.prod` **locally** — the AC says so, and it is the honest test: it
      exercises the real image, not a smoke `alpine`. Tag it outside Epic 3's namespaces, e.g.
      `git.crm-prionex.com/crm/fe-prionex:reg-check-1-10`.
      ⚠️ `Dockerfile.prod` takes `VITE_API_BASE_URL` / `VITE_WS_URL` build-args and bakes them in
      (D1, Option C). Values do not matter here — you are testing the registry, not the bundle —
      but pass something explicit rather than letting them default, and say in the record that the
      image is not a deployable artifact.
- [ ] 3.2 `docker login git.crm-prionex.com` with the chosen write credential and push.
      🚨 If you push **from a workflow** instead of locally, you need `--add-host` (already set) and
      `driver: docker` on `setup-buildx-action` — without the latter buildx pushes from its own
      BuildKit container and fails with an `EOF` on the blob HEAD. Story 1.8 diagnosed this.
- [ ] 3.3 Confirm the push server-side, not from the client's exit code: `GET /packages/CRM/container/fe-prionex/reg-check-1-10`
      and/or `docker manifest inspect`. Record the digest — AC4 compares against it.

### Task 4 — Prove the read-only credentials are read-only (AC: 3)

- [ ] 4.1 🚨 **This is the AC that nothing has ever tested, and the only one with a real chance of
      failing.** The clause is «an attempt to push using a server token **is rejected**».
- [ ] 4.2 Establish what s2's existing credential actually is. Its value is not readable from
      Forgejo (secrets are write-only) but `/root/.docker/config.json` on s2 holds the auth it was
      logged in with. **Determine its scope by behaviour, not by name**: attempt a push with it to
      a throwaway tag and require a `401`/`403`. A successful push here is a **finding**, not a
      failure of the story — record it loudly, because it would mean production holds a
      write-capable registry credential.
- [ ] 4.3 Give **s1** a read-only credential — it currently has none, so nothing on s1 can pull.
      Use `REGISTRY_USER_RO`/`REGISTRY_TOKEN_RO` (or the Task 2 equivalent). `docker login` writes
      to `/root/.docker/config.json`; that file is `600` and host-local, which is the correct place
      — **it is not "writing a token into a file" in the sense Prohibition 1 forbids**, which is
      about this repository. Say so in the record so the next story does not misread the precedent.
- [ ] 4.4 Repeat the rejection test on s1's new credential. Both servers must fail to push and
      succeed to pull.
- [ ] 4.5 Record both results as definite yes/no. If a scope cannot be established, write
      «не проверено» and say what would establish it.

### Task 5 — Prove the digest is identical on both servers (AC: 4)

- [ ] 5.1 Pull `reg-check-1-10` on **s1** and record `docker inspect --format '{{index .RepoDigests 0}}'`.
- [ ] 5.2 Pull it on **s2** and record the same. 🚨 s2 is PROD — `pull` and `inspect` only.
- [ ] 5.3 Compare the two digests **and** compare both against the digest recorded at push time
      (Task 3.3). Three-way agreement is the evidence; two-way is weaker and the AC's wording
      («identical on both servers») would be satisfied by two copies of the same wrong thing.
- [ ] 5.4 Record the pull method on each host — whether it used the credential from Task 4 or an
      ambient one already present. On s2 that distinction matters: it was already logged in before
      this story.

### Task 6 — Clean up (AC: 6)

- [ ] 6.1 Delete the pushed tag: `DELETE /packages/CRM/container/fe-prionex/reg-check-1-10` → expect
      `204`. ⚠️ Needs a **`write:package`** token; `write:repository` returns `403`. Story 1.8 hit
      this and had to mint `fe_pkg_cleanup` for it.
- [ ] 6.2 Confirm it is gone (`GET …` → `404`, or absent from the package list).
- [ ] 6.3 Remove the pulled image from s1 and s2 (`docker rmi`) **only if** it is not referenced by
      anything. On s2, check first — do not `rmi` anything the running stack uses.
- [ ] 6.4 Leave s1's read-only login in place — it is a deliverable, not scaffolding. Say so
      explicitly so a later cleanup does not undo it.

### Task 7 — Record the outcome (AC: 5)

- [ ] 7.1 Take the next free decision anchor. `D13` is Story 1.9's; **`D11` remains reserved by
      Story 1.6**, which has not run. Take **`D14`** and leave the reservation intact.
- [ ] 7.2 Record: what already existed versus what this story created; the Task 2 decision with its
      rejected alternative; the scope-verification results for both servers; the digest three-way
      comparison; and every «не проверено» with a reason.
- [ ] 7.3 Conventions: Russian prose, English identifiers, explicit `<a id="d14"></a>`, index-table
      row after D13, **extend the anchor range at `docs/migration-decisions.md:8`** — omitted three
      times so far — changelog row appended.
- [ ] 7.4 Amend `docs/forgejo-migration.md` Фаза 2 items 1–2 by **marking, not rewriting** (`✅`
      annotation only, no strikethrough — that file already uses `~~…~~` with two meanings).
- [ ] 7.5 Close the `deferred-work.md` items this story consumes: the `ci-bot`/`robot-registry`
      substitution question, and the note that `REGISTRY_TOKEN_RW`'s push rights were proven.
      **Annotate, do not delete** — Story 1.9's closure dropped a human decision and two backlinks,
      and had to be restored in review.
- [ ] 7.6 Citation discipline: prefer anchors. If you insert lines into `epics.md` or
      `forgejo-migration.md`, re-verify every citation *into* that file across the repository —
      `forgejo-migration.md` moved three times on 2026-08-11 alone.

### Task 8 — Commit and verify (AC: all)

- [ ] 8.1 Two commits split by area: `docs(migration):` for `docs/`, `chore(bmad):` for
      `_bmad-output/`. Full husky suite on `main`; `--no-verify` forbidden there.
      ⚠️ Known flake: a Radix `focus-scope` timer test, **five occurrences in the last day**
      including two consecutive. If 1921 tests pass but the run exits non-zero, retry once — and if
      it fails a second time, look at the error rather than retrying blindly.
- [ ] 8.2 After every push, re-check `GET .../actions/runs` `total_count` against the Task 1
      baseline. This story creates no workflow, so it must not change.
- [ ] 8.3 Update `sprint-status.yaml` and this file's `Status:`. Verify the prior value before
      writing.

## Dev Notes

### What this story produces

1. **A verified, named write credential** for the registry — whichever Task 2 chooses — with its
   push right proven by an actual push of the real `Dockerfile.prod` image.
2. **A read-only credential on s1**, which today has none.
3. **Proof that server credentials cannot push** — the only genuinely untested clause in the story.
4. **A digest-identical pull on s1 and s2**, which is what makes "the same artifact everywhere"
   more than a claim.
5. **An amended plan** (FR10, NFR6, AC2) that names things that exist.
6. **A decision record** (`#d14`) and a marked Фаза 2.

### The argument in one paragraph

Epic 3 builds images and Epics 4–6 deploy them; both assume a registry with credentials that are
scoped correctly. The registry already exists and already works — Story 1.8 pushed to it. What has
never been checked is the half that protects production: that the credentials sitting on s1 and s2
**cannot** write. Everything else in this story is bookkeeping; that one clause is the reason the
story is in Epic 1 at all. Test it properly, and record a successful rogue push as a finding rather
than quietly re-scoping the token.

### Live-instance facts (verified 2026-08-12 — re-verify in Task 1)

- Instance `15.0.5+gitea-1.22.0`. Header is `Authorization: token $FJ_TOKEN`, **not** `Bearer`.
  Anonymous API refused.
- Repo `CRM/fe-prionex`, `repo_id: 16`, `has_packages: true`, `has_pull_requests: false`.
- **Registry:** `/v2/` → `401`; `/v2/crm/fe-prionex/tags/list` → `401`. Auth realm
  `Bearer realm="https://git.crm-prionex.com/v2/token", service="container_registry"`.
- **Org accounts:** `platform-admin`, `robot-deploy`, `robot-registry`. **No `ci-bot`.**
- **Org secrets:** `REGISTRY_USER`, `REGISTRY_TOKEN_RW`, `REGISTRY_USER_RO`, `REGISTRY_TOKEN_RO`,
  `SLACK_CD_WEBHOOK_URL` — all created `2026-08-10T10:14:26–27+02:00`, confirmed with `aleksey` as
  the hub's own platform credentials. **No `REGISTRY_TOKEN`.** Repo-level secrets: `[]`.
- **Org secrets are visible to workflows in this repository** — proven by Story 1.8's
  `docker/login-action` authenticating with no repo-level copy.
- **s1** (`root@10.67.0.1`, key-based): `/root/.docker/config.json` exists with **`auths: []`**.
- **s2** (`root@175.110.122.17`, key-based **from the workstation only** — s1 → s2 is
  `Permission denied`, and should stay that way): `/root/.docker/config.json` has
  **`auths: ['git.crm-prionex.com']`**; `/v2/` → `401`; `git.crm-prionex.com` resolves to
  `10.70.0.1`; docker **29.3.0**; `/opt/forgejo-runner` present (this is `s2-prod-deploy`, id 17).
- **Running on s2 right now:** `fe-prionex` from `ghcr.io/crm-prionex/fe-prionex:main`, plus the
  `hub-prod-*` stack and `postgres:17`. **Production. Read-only.**
- `DELETE /packages/{owner}/container/{name}/{version}` → `204` with a `write:package` token;
  `403` with `write:repository`.
- Endpoints absent: `POST .../actions/runs/{id}/cancel`, any Actions-artifacts endpoint.

### Anti-patterns for this story

- ❌ **Creating `ci-bot` before Task 2 is answered**, or creating it silently because the epic says so.
- ❌ **Treating AC1 as work.** It is already true; claiming credit for enabling it is a false record.
- ❌ **Assuming s2's existing credential is read-only** because it ought to be. Test it.
- ❌ **Quietly re-scoping a token** if the rejection test fails. That is the finding.
- ❌ **Anything on s2 beyond `pull`/`inspect`/`images`/`login`.**
- ❌ **A tag inside Epic 3's namespaces**, or leaving any tag behind.
- ❌ **"Fixing" the lowercase `crm`** in the registry path.
- ❌ **Deleting `deferred-work.md` entries** when closing them — annotate above them.
- ❌ **`--no-verify` on a `main` commit.**

### Previous story intelligence

**Story 1.8 — proved the registry works.** Its `docker/login-action` authenticated with
`REGISTRY_USER`/`REGISTRY_TOKEN_RW` and its build pushed to `crm/fe-prionex`; both throwaway tags
were deleted with `204`. It also established the two things that make a workflow-side push work at
all (`--add-host` + `driver: docker`) and that the API elides information you need — labels bare,
secret values write-only.

**Story 1.9 — the record-keeping cautions.** Its review found a run id left as «`id 27`?», an
attribution table contradicted by the runner's own log, a fabricated justification, an inference
from one sample presented as measurement, and two claims that attested to their own commit. None of
those were infrastructure defects; all were evidence defects. **This story has fewer moving parts
and therefore fewer excuses.**

**Story 1.11 — your consumer, and it starts immediately after.** It writes the retention policy.
Anything you leave in the registry becomes its first problem.

### Git intelligence

```
22281c33  chore(bmad): close story 1.9 — docker-build proven on runner 2 by dispatch   ← origin/main
d9808d18  chore(bmad): apply story 1.9 code review findings
9d304353  chore(bmad): story 1.9 to review — second runner live, failover and distribution proven
8aa2ca33  docs(migration): provision second Forgejo runner, version runner config (story 1.9)
412bc533  chore(bmad): create story 1.9 — provision the second runner
```

Conventional Commits with a scope; **no `KAN-###`**; `docs(migration):` for `docs/`,
`chore(bmad):` for `_bmad-output/`; review findings in their own commit rather than an amend.
**This story file is committed at create-story time**, before any dev work.

### Testing standards

No automated suite applies. The project's evidence standard:

- **Observation over assertion.** Every AC closed by a captured API response, a digest, or a quoted
  error — not by an exit code alone. A `docker push` that "succeeded" is not evidence the token is
  write-scoped; a `docker push` that returned `403` **is** evidence it is not.
- **Definite yes/no**, and **«не проверено»** with a reason. The list must be complete — Story 1.9's
  omitted three items and read as more complete than it was.
- **Record the rejected option**, not only the chosen one (Task 2.2).
- Do not move to `review` with any `[ ]` subtask open, and do not write a claim about a commit
  inside that commit.

### Project Structure Notes

- This story adds **no workflow file**. `.forgejo/workflows/` keeps exactly `README.md`
  (blob `c9aeac2f…`); if you never touch it, the D9 invariant is trivially preserved — confirm it
  anyway.
- `Dockerfile.prod` is built but **not committed to in any way** — no change to it, no new
  Dockerfile.
- Credentials live on the hosts (`/root/.docker/config.json`, mode `600`) and in Forgejo org
  secrets. **Neither is this repository.**
- **Language split:** `docs/` Russian, `_bmad-output/` English.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md:716-742`] — Story 1.10 and its four ACs.
- [Source: `_bmad-output/planning-artifacts/epics.md:94-95`] — FR10, which names `ci-bot`.
- [Source: `_bmad-output/planning-artifacts/epics.md:209-210`] — NFR6, which names `ci-bot` again.
- [Source: `_bmad-output/planning-artifacts/epics.md:251`] — «The runner must not be hosted on s2»,
  the constraint this story is the first to work alongside.
- [Source: `docs/forgejo-migration.md` Фаза 2] — the registry, the `ci-bot` token, and the retention
  choice Story 1.11 inherits.
- [Source: `docs/migration-decisions.md#d12`] — Story 1.8's action verdicts, the `--add-host` fix and
  the `driver: docker` requirement, and the confirmation that `REGISTRY_TOKEN_RW` authenticates.
- [Source: `docs/migration-decisions.md#d13`] — the runner pair this story's pushes would run on if
  done from a workflow.
- [Source: `_bmad-output/implementation-artifacts/1-8-prove-action-compatibility-with-a-smoke-workflow.md`]
  — the registry push mechanics and the `write:package` requirement for deletion.
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`] — the `ci-bot`/`robot-registry`
  substitution, the settled provenance of the five org secrets, and the token-count problem.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Open Questions for Review

### Blocking

1. **`ci-bot` or `robot-registry`?** Task 2. Adopting means amending FR10, NFR6 and AC2; creating
   means a second write-capable identity on a shared registry for naming reasons. Recommended:
   adopt, consistent with how Epic 4 and Story 1.8 resolved the same situation.

### Non-blocking

2. **What if s2's existing credential turns out to be write-capable?** Task 4.2 treats that as a
   finding rather than a story failure — but then someone has to decide whether to re-scope it,
   which touches a credential this team did not create, on a production host.
3. **The token count is now six** (`fe_tmp_1_7`, `fe_review_1_7`, `fe_ac3_close`, `fe_pkg_cleanup`,
   `fe_story19`, plus whatever this story needs), and one earlier token twice vanished from s1
   unexplained. The platform's own answer is named robot accounts and OpenBao. This is the last
   story before **1.12**, which migrates secrets — settling it after 1.12 means settling it too
   late.
4. **Story 6.3 rebuilds the running production commit into the Forgejo registry.** s2 currently
   runs `ghcr.io/crm-prionex/fe-prionex:main`. Nothing in this story changes that, but it is worth
   confirming that no one expects 1.10 to migrate the production image — it does not.
