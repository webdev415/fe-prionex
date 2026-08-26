# Story 6.4: Deploy to Production by Dispatch

Status: ready-for-dev

<!-- Epic 6, FR15/FR17/FR24. Contexted 2026-08-26 off origin/main @ 308ea152.
     Prerequisite Story 6.10 is `done`; Story 6.3 is `done` and left the image this story deploys.
     §2, §3 and §4 are the three findings that decide how this story is built. Read them first. -->

## Story

As a release engineer,
I want to deploy a named release to production from Forgejo, and to roll one back without rebuilding,
So that production delivery no longer depends on GitHub.

---

## 🚨 Read this before anything else

### 1. What this story is, in one paragraph

Write `.forgejo/workflows/deploy-prod.yml`: a **dispatch-only caller** that deploys the PROD stand on
**s10** through the shared definition `deploy-stand.yml`. Two paths. **`rollback: true`** pulls an
existing `-prod` tag and starts it — no build. **`rollback: false`** (the release path) **rebuilds** the
commit at `environment: prod` first, because Option C bakes the production `VITE_*` values into the
bundle, and only then deploys. Everything the deploy itself does — lock, compose render, fail-fast pull,
health, Kong probe — already exists in `deploy-stand.yml` and **is not rewritten here.**

### 2. 🔴 THE SHAPE PROBLEM — this caller needs TWO callees, and no caller in this repository does that

`deploy-dev.yml` and `deploy-preprod.yml` are each **one job, one `uses:`**. Their whole body is:

```yaml
jobs:
  deploy:
    uses: ./.forgejo/workflows/deploy-stand.yml
    with: { … }
    secrets: inherit
```

**This story cannot copy that shape**, because on the release path something has to build first, and
`deploy-stand.yml` **builds nothing** — it deploys an image that already exists. So `deploy-prod.yml` is
the project's **first two-callee caller**:

```
job build   → uses: ./.forgejo/workflows/build.yml        if: rollback is not true
job deploy  → uses: ./.forgejo/workflows/deploy-stand.yml  needs: build (but must run when build is skipped)
```

🔴 **The `needs:` + `if:` interaction is the trap, and D21 already bit this project once.** A skipped
`needs:` dependency normally makes the dependent job **skip too**. The deploy job must run on **both**
paths, so its `if:` has to admit "build succeeded **or** build was skipped" explicitly. Get this wrong
and the rollback path silently does nothing while the run reports green — the worst available outcome
for a production workflow.

⚠️ **`#d21` also established that a `uses:` job's `if:` is copied down into the callee and re-evaluated
there.** Test the skip behaviour before trusting it; do not reason it out.

### 3. 🔴 `build.yml` HAS NO `workflow_call` OUTPUTS — the tag must be derived twice and must agree

Measured on `origin/main` @ `308ea152`: `build.yml`'s `workflow_call` block declares **`ref` and
`environment` and nothing else.** There is **no `outputs:`**. A caller therefore **cannot learn which
tag the build published.**

This is not a defect to fix here — `deploy-stand.yml` already lives with it, and its own `image_env`
input says so in those words:

> *"the callee's own copy of the sanitizer must resolve the **SAME** tag `build.yml` published, or a
> real image 404s as if it were missing."*

**Consequence for this story:** on the release path the tag is computed **twice** — once inside
`build.yml` from `git rev-parse HEAD`, once by whatever this caller passes to `deploy-stand.yml` — and
**the two must be byte-identical.** The failure mode when they diverge is a `404` on a pull, which reads
as *"the image was never built"* rather than *"you asked for the wrong name"*.

🔴 **`#d18` §3 names this exact class:** *«если любая выведет тег из полного 40-символьного SHA, цель
отката и гейт разойдутся молча»*. The short SHA is **12** characters, pinned, and Story 6.5's guard will
compare these strings byte for byte.

### 4. 🔴 THE RELEASE PATH CANNOT BE EXERCISED ON THE IMAGE WE ALREADY HAVE

Story 6.3 built `a99ccd44c5a39345fa65eb74e87343b187e129e9` at `environment: prod` and published
`sha-a99ccd44c5a3-prod` (`sha256:f30c794123ba…a3f3`). **A release-path dispatch of that same commit will
go RED**, and not because of anything this story does wrong:

- the release path calls `build.yml`;
- `build.yml`'s `Enforce AC2` step reads the existing digest of `sha-<12>-prod` **before** the build and
  refuses to repoint it (`#d24`);
- `vite.config.ts`'s `Date.now()` makes every rebuild of a commit produce **different bytes**, so the
  digests differ **by construction**.

**Therefore AC2 needs a commit that has NEVER been built at `environment: prod`.**

🔴 **MEASURED 2026-08-26, at context time, because this is the one thing that can stop the story —
and the answer is the bad one:**

```
sha-*-prod tags in the registry:   sha-a99ccd44c5a3-prod      ← exactly ONE, and it is the cutover image
preprod-current            -> sha256:a62e868786cd…2086b2
preprod-a99ccd44c5a3       -> sha256:a62e868786cd…2086b2      ← the SAME digest
sha-a99ccd44c5a3-preprod   -> sha256:a62e868786cd…2086b2
```

**`preprod-current` points at `a99ccd44c5a3` — the very commit already built at prod.** There is **no
validated PRE-PROD candidate that has not been built at `environment: prod`**, so the release path
cannot be exercised against one.

**It can still be exercised — but only by minting a SECOND permanent `sha-<12hex>-prod` tag for a
commit that is not a release candidate**, and that is an irreversible act with a real price:
`keep_pattern` protects the shape forever, and removal needs an authorised `DELETE` with a
`write:package` token, which on this project has twice required the operator in person.

**Three ways out, and the choice is Oleg's (Open Question 2):**
1. **Wait for the next validated candidate** — AC2 is exercised on a real release, at zero extra cost,
   whenever Epic 5's cycle produces one.
2. **Spend a permanent tag deliberately** on `main`'s current head to prove the path now — the cost is
   named, recorded, and paid once.
3. **Record AC2 as unearnable in this story**, with the reason, and let Story 6.9's own release prove
   it. 🔴 **But then the FIRST time the release path ever runs is against production**, which is
   precisely the arrangement Epic 6's preamble calls a one-way door.

⚠️ **This also means the rollback path is the ONLY path that can be exercised against the existing
cutover image** — which is exactly what `#d46` recorded for Story 6.9, for this same mechanical reason
and not because a guard would refuse.

### 5. The `with:` block — every value is already measured, none needs inventing

`deploy-stand.yml`'s callable contract, and this story's values:

| Input | Value | Where it comes from |
|---|---|---|
| `runner_label` | **`e1-rung3-prod-deploy`** | Story 6.10. 🔴 **Never `s10`/`e1-rung3`** — those are the CI runner whose jobs execute in dind and can never reach the host stand |
| `compose_project_name` | `fe-prionex-prod` | the stand `.env` Story 6.10 wrote on s10 |
| `container_name` | `fe-prionex-prod` | same. 🔴 **Never the literal `fe-prionex`** — `CD.yml:201` force-removes that name on every legacy deploy, and `docker rm -f` is name-based and project-independent |
| `frontend_port` | **`8080`**, bare | measured free on s10. 🔴 **NOT `127.0.0.1:8080`** — DEV and PRE-PROD bind loopback because nothing outside the host reaches them; PROD traffic arrives **from the hypervisor**, so a loopback binding makes the stand unreachable by design |
| `frontend_network` | **`crm-prod-network`** | exists on s10; `crm-prod-kong-gateway` carries the alias **`crm-kong-gateway`** that `nginx.conf` resolves. 🔴 **Never `crm-network`** — the legacy backend |
| `stand_dir` | `/root/crm-prionex/fe-prionex-prod` | created by Story 6.10, with the **load-bearing** `docker-compose.stand.yml` the callee asserts before taking the lock |
| `image_env` | `prod` | |
| `image_tag` | from the dispatch input | mutually exclusive with `ref` — **exactly one** |
| `expect_unrouted_api` | **`"false"`** | PROD's Kong runs real services, like PRE-PROD's. `"true"` would demand Kong's *"no Route matched"* signature and fail against a working route |
| `lock_wait_seconds` / `lock_ttl_seconds` / `health_timeout_seconds` | `"240"` / `"720"` / `"120"` | DEV's defaults, which PRE-PROD also took. 🔴 `lock_ttl_seconds` **must exceed** the callee's own `timeout-minutes` (10 = 600s) — the callee asserts this and fails closed |

**`concurrency`: its own literal group**, e.g. `deploy-prod-fe-prionex-prod`. 🔴 **Never copy another
stand's group and never use an expression** — Story 5.3's Prohibition 7.

### 6. 🔴 `secrets: inherit` — the decision THIS story owns

Story 6.3 deliberately avoided it and said so: *"the caller/callee decision — including
`secrets: inherit` — is Story 6.4's to make, not this file's to pre-empt."*

**The facts, so it is decided rather than inherited by habit:**
- `deploy-stand.yml` **cannot** declare `on.workflow_call.secrets` — the parser rejects it (`#d21`).
  **Callers must pass `secrets: inherit` or the callee gets nothing.**
- `deploy-preprod.yml` and `deploy-dev.yml` both use `secrets: inherit` today. It works.
- `deploy-stand.yml`'s own header records the cost: it *"references only `REGISTRY_USER_RO`/
  `REGISTRY_TOKEN_RO`"*, while `inherit` hands the callee **every** org secret — including
  **`REGISTRY_TOKEN_RW`**, a `write:package` credential over a namespace holding another team's
  production packages.
- On the release path the **build** callee genuinely needs the OpenBao AppRole secrets and the RW push
  credential. So `inherit` is not avoidable there.

**The real question is narrow: does the DEPLOY job need `inherit` too, or only the BUILD job?** They are
separate `uses:` jobs and can be given different `secrets:` blocks. **Recommended: `inherit` on both,
matching the two shipped callers, and record the RW exposure as accepted rather than discovered.**
Open Question 1.

### 7. The seam for Story 6.5, and what must NOT be built here

Story 6.5 adds the promotion guard: extract the commit from `image_tag`, require `preprod-<sha>` in the
registry, refuse otherwise, and **skip the whole check when `rollback` is true**. **This story does not
build that guard** (§12). What it must do is leave the seam obvious: the release path already has to
extract a commit from `image_tag` in order to rebuild, so **that extraction is where 6.5's guard lands**,
and it should be a distinct, named step rather than an inline expression.

⚠️ **Story 6.3's cutover image has no `preprod-<sha>`** — it was built from a candidate that *does*, so
it would pass; but do not build any of 6.5's logic on that observation. §12.

### 8. Previous story intelligence — what Epic 6 has already paid for

**From Story 6.3 (done 2026-08-26):**
- The image this story's rollback path will deploy: **`sha-a99ccd44c5a3-prod`**, digest
  `sha256:f30c794123ba…a3f3`, with `prod-a99ccd44c5a3` and `prod-current` on the same manifest.
  🔴 **Neither marker is deployable** — `deploy-stand.yml` refuses any tag not ending in `-prod`.
- **The first `environment: prod` build in this project's history ran green** (run 598, 14/14, 384 s),
  including the first-ever read of `secret/fe/prod/app` and the first `fe-prod` AppRole login. **The
  prod build path is proven end to end** — this story does not have to prove it again.
- **`vars.VITE_OPERATOR_PHONE_URL_PROD` is set** (`https://phone.crm-prionex.online`) and a prod build
  **fails closed** without it. ⚠️ `deferred-work.md` names Story 6.4 as the owner of **re-verifying that
  value is still current** rather than assuming the 2026-08-17 measurement holds — URLs and Kong routes
  have drifted in this project before.
- 🔴 **26 code-review findings from 6.3 are carried, owner Story 6.6, not this story.** Do not fix
  `record-prod-image.yml` here. §12.

**From Story 6.10 (done 2026-08-26):** the runner is a **host process** with the `:host` executor and
`docker_host: unix:///var/run/docker.sock`; `capacity: 1`. ⚠️ **That capacity is another team's config
value and can be raised without telling this project — it is NOT a reason to trust the lock less or
more.** And 🔴 **nothing in the deploy path asserts which host it is running on**; an org-scoped label is
a string, and the guarantee that it resolves to s10 lives in a config this project does not own.

**From Story 5.3 (`deploy-preprod.yml`), the file this one is closest to:** its body is ~40 lines under
~136 lines of header. **The header is where the reasoning lives**, and that ratio is the house style.

### 9. 🔴 retro-E5 — what this story owes, and what it cannot earn

**retro-E5:** *"every new guard ships with a live outcome matrix (one run per branch incl. a
discriminating run)."* This story ships a caller with **at least two branches** and therefore owes a
matrix. **Story 6.3 shipped its guards with NO discriminating run** (its AC6, recorded UNMET) — do not
repeat that silently; if a row cannot be earned, label it.

| Branch | Pass row | Discriminating row | Earnable? |
|---|---|---|---|
| `rollback: true` — pull, no build | a real dispatch of `sha-a99ccd44c5a3-prod` | — | ✅ **live, and it is the cutover rehearsal Story 6.9 needs** |
| `rollback: false` — rebuild then deploy | **needs a commit never built at prod** (§4) | — | ⚠️ **live only if §4's precondition is secured** |
| build job skipped, deploy still runs | the `rollback: true` row proves it | a run where the deploy job is wrongly skipped | ✅ the pass row IS the discriminating evidence for §2's trap |
| `image_tag` not ending `-prod` | — | the callee's own tag↔environment guard refuses | ✅ **free** — `sha-a99ccd44c5a3-preprod` already exists |
| lock contention | — | two dispatches in quick succession | ⚠️ costs a second run; decide, do not skip silently |

### 10. Run budget model — declared before work

| Line | Floor | Ceiling |
|---|---|---|
| Context push (this file) | 1 | 1 |
| dev-story pushes | 1 | 3 |
| PR rows | 2 | 2 |
| Merge row (`build-main.yml`) | 1 | 1 |
| **Dispatch: `rollback: true` (the real one)** | **1** | **2** |
| **Dispatch: `rollback: false` release path** | **1** | **3** |
| Discriminating dispatches (§9) | 1 | 3 |
| Review fix-pass push | 0 | 2 |
| Closeout PR | 0 | 3 |
| **Total** | **8** | **20** |

**Closure rule:** by query against `action_run`, grouped by `run_number`, **attributed by
`commit_sha`** — 🔴 **and dispatch runs carry the DISPATCH REF as `commit_sha`, not what they built.**
Story 6.3 nearly lost its most consequential run to exactly that; name such rows separately.

### 11. 🔴 Blast radius and frozen files

**Written by this story:** `.forgejo/workflows/deploy-prod.yml` (**NEW**, the only code artifact);
`docs/migration-decisions.md` (a decision record); `sprint-status.yaml`; this file.

**FROZEN — read-only, and editing one to make this story easier is the worst available move:**
- 🔴 **`.forgejo/workflows/deploy-stand.yml`** — Story 4.8's shipped artifact and the whole point of
  this story is to *consume* it. If it seems to need a change, that is a finding, not a commit.
- 🔴 **`.forgejo/workflows/build.yml`** — carries the AC2 immutability guard §4 depends on.
- 🔴 **`record-prod-image.yml`** — Story 6.3's, with 26 open findings owned by **6.6**.
- `record-preprod-candidate.yml`, `deploy-preprod.yml`, `deploy-dev.yml`, `dev-reset.yml`, `ci.yml`,
  `build-main.yml`; `Dockerfile.prod`, `vite.config.ts`, `nginx.conf`, `docker-compose*.yml`, `src/`;
  `docs/production-approval-regulation.md`, `docs/prod-releases.md`, `docs/release-regulation.md`,
  `docs/release-validation-checklist.md`, `docs/preprod-candidates.md`; all of `.github/workflows/`.

**Hosts:** s10 is written **only** by the deploy job itself, through the runner. **No hand-run compose,
no manual `docker` on the stand.** s2 is not touched at all — NFR5.

### 12. Boundaries — six things this story must not absorb

1. **The promotion guard.** Story 6.5. Leave the seam (§7), build nothing.
2. **The `prod-current` / `prod-<sha>` retag after deploy.** Story 6.6 — and it inherits
   `record-prod-image.yml` plus its 26 findings.
3. **The smoke check.** Story 6.7. The callee's own health and Kong probes are not it.
4. **Proving rollback as a rehearsal with measured timing.** Story 6.8.
5. **The cutover and the traffic switch.** Story 6.9, and the switch is external.
6. **Slack.** Story 4.5, explicitly deferred — *"the production deploy must work, and must be
   provable, without any notification."*

### Prohibitions

🚨 **A prohibition here cannot be overridden by a subtask.**

1. 🔴 **Never edit `deploy-stand.yml` or `build.yml`.** §11.
2. 🔴 **Never dispatch the release path against a commit already built at `environment: prod`.** §4. It
   cannot succeed, and it moves the mutable `<sanitized-ref>-prod` tag away from the protected image.
3. 🔴 **Never bind `frontend_port` to `127.0.0.1` for PROD.** §5. It would make the stand unreachable
   from the hypervisor by construction, and the health check — which probes the container itself —
   would still report success.
4. 🔴 **Never pass `crm-network`** as `frontend_network`. It is the legacy backend, and a wrong network
   fails **silently**: nginx resolves Kong lazily, the healthcheck probes itself, and the stand reports
   `healthy` while serving a backend nobody intended.
5. 🔴 **Never target `s10` or `e1-rung3` as `runner_label`.** Those jobs execute in dind and cannot
   reach the host stand.
6. 🔴 **Never `${{ }}` inside any `run:` body, including its comments** (`#d21`).
7. 🔴 **Never claim a check that could not have failed**, and never present a construction-fixed
   outcome as measured. Story 6.3's review found this **five times**; do not make it six.
8. 🔴 **Never mark a coordinator-owned subtask `[x]`.** Story 6.3's review finding 1 — use `[»]` with
   `[coordinator-executed]`, and keep the run id.
9. 🔴 **Never soften a disposition.** `UNPROVEN`, `OPEN`, `PENDING (owner: name)`, or the claim is not
   made. There is no fifth word.
10. 🔴 **Paste the artifact, do not characterise it** — including the full step table of every dispatch.
    Story 6.3's review found run 600 characterised where run 598 was pasted.
11. 🔴 **Never write to s10 by hand.** §11.
12. 🔴 **Never add Slack.** §12 item 6.

---

## Acceptance Criteria

### AC1 — Triggers and inputs *(epic AC1)*

**Given** `.forgejo/workflows/deploy-prod.yml`
**When** its triggers are configured
**Then** `workflow_dispatch` is the **only** trigger
**And** it accepts a **required `image_tag`** input and an **optional `rollback`** boolean input
**And** its `concurrency` group is its own literal, shared with no other stand and containing no
expression.

### AC2 — The release path rebuilds, and says so *(epic AC2)*

**Given** Option C requires a production-specific bundle
**When** a release deploy runs with `rollback` false
**Then** it rebuilds the image at `environment: prod`, so the production `VITE_API_BASE_URL` and
`VITE_WS_URL` are baked in
**And** the workflow output **states explicitly that this is a rebuild, not a promotion of the PRE-PROD
artifact**
**And** 🔴 it is exercised against a commit **never previously built at `environment: prod`** (§4), with
that precondition **verified and pasted before the dispatch**, not assumed.

### AC3 — The rollback path pulls and does not build *(epic AC3)*

**Given** a rollback deploy runs with `rollback` true
**When** it executes
**Then** it pulls the existing tag without rebuilding
**And** **no build job runs on this path** — proven from the run's own job list, not from the absence of
a message
**And** the deploy job **still runs** despite its build dependency being skipped (§2).

### AC4 — Target, mechanism, and no SSH *(epic AC4)*

**Given** the deploy targets **s10**
**When** the workflow declares `runs-on` — via `deploy-stand.yml`'s `runner_label`
**Then** it names **`e1-rung3-prod-deploy`**, the label Story 6.10 recorded, **not** `s10`/`e1-rung3`
**And** **no SSH credential is used anywhere**, so production access cannot be lost by a key change.

### AC5 — It consumes the shared definition and takes the lock *(epic AC5, Slack clause deferred)*

**Given** the deploy sequence
**When** it executes
**Then** it consumes `deploy-stand.yml` rather than reimplementing any part of it, and the Story 4.4
lock is acquired on the production stand — **shown from the run, not asserted**
**And** ⚠️ the Slack clause of this epic AC **does not gate this story** (deferred 2026-08-14): the
production deploy must work and be provable **without any notification**.

### AC6 — 🔴 ADDED: the two-callee shape is proven on both paths

**Given** this is the repository's first caller with two callees and a conditional build (§2)
**When** both paths have run
**Then** the `rollback: true` run shows the build job **skipped** and the deploy job **executed**
**And** the `rollback: false` run shows **both** executed, in order
**And** the `if:`/`needs:` interaction is **verified by observation**, not by reasoning — `#d21`
established that a `uses:` job's `if:` is re-evaluated inside the callee.

### AC7 — 🔴 ADDED: the tag is derived twice and the two derivations are shown to agree

**Given** `build.yml` publishes no `workflow_call` outputs (§3)
**When** the release path runs
**Then** the tag this caller hands `deploy-stand.yml` and the tag `build.yml` actually published are
**both read from the registry and shown to be the same string**
**And** the **12**-character short SHA is used, matching `build.yml` byte for byte (`#d18` §3)
**And** the failure mode is recorded: a divergence surfaces as a `404` that reads like *"never built"*.

### AC8 — 🔴 ADDED: `secrets: inherit` is a recorded decision, not a default

**Given** `deploy-stand.yml` cannot declare `on.workflow_call.secrets` and callers must pass
`secrets: inherit` or the callee gets nothing (`#d21`)
**When** this caller is written
**Then** the `secrets:` block of **each** job is stated with its reason
**And** the cost is named: `inherit` hands the callee **every** org secret, including
**`REGISTRY_TOKEN_RW`**, a `write:package` credential over another team's packages
**And** whether the **deploy** job needs `inherit` at all — as opposed to only the **build** job — is
answered explicitly.

### AC9 — 🔴 ADDED: the outcome matrix ships with real run ids

**Given** retro-E5, and that Story 6.3 shipped its guards with **no** discriminating run (its AC6,
recorded UNMET)
**When** this story closes
**Then** §9's matrix carries **real run ids**, and every row that could not be earned is labelled
**with its reason** — never left blank and never inferred
**And** no row is claimed whose outcome was fixed by construction (Prohibition 7).

### AC10 — 🔴 ADDED: the three inherited `deferred-work.md` items are discharged or re-owned

**Given** `deferred-work.md` names **Story 6.4** as owner of three items
**When** this story closes
**Then** each is **discharged or explicitly re-owned by name** — never silently dropped:
1. **re-verify `vars.VITE_OPERATOR_PHONE_URL_PROD` is still current** rather than trusting the
   2026-08-17 measurement;
2. **add the missing `<a id="d33"></a>` and `<a id="d37"></a>` anchors** in the same edit as this
   story's own decision record — the index rows `[D33](#d33)` and `[D37](#d37)` resolve to nothing
   today;
3. the **M7 bundle** — the unexercised branches of `record-preprod-candidate.yml` and the unusable
   *"Rejected candidates"* table. ⚠️ **This story does not dispatch the recorder**, so if it forces
   none of them, that is recorded and the item is **re-owned by name**, not left implied.

---

## Tasks / Subtasks

🔴 **Marker legend** (Story 6.3 review finding 1): **`[x]` = the dev agent did it. `[»]` = the
coordinator did, and the run id is the proof.** Coordinator-owned subtasks are **never** `[x]`.

### Task 1 — Open the story and secure §4's precondition (AC: 2) — **1 push row**
- [ ] 1.1 Branch `story-6-4/pr-1-context` off a fresh `origin/main`. Verify the decision number across
      **every** branch **and** the operator's own checkout — the ref-only sweep was wrong once already
      (Story 6.3, OQ10).
- [»] 1.2 🔴 **ANSWERED AT CONTEXT TIME, and the answer is the blocking one — see §4 for the pasted
      measurement.** Exactly one `sha-*-prod` tag exists (`sha-a99ccd44c5a3-prod`), and
      `preprod-current` resolves to the **same** commit. **No validated candidate is unbuilt at prod.**
      Re-verify at execution — a new candidate may have been recorded since — then take Oleg's answer
      to Open Question 2 before Task 5. **Do not dispatch the release path until that is settled.**
- [ ] 1.3 Declare the §10 budget as `OPEN`.

### Task 2 — Read the contract, do not infer it (AC: 4, 5) — **0 runs**
- [ ] 2.1 Read `deploy-stand.yml`'s `workflow_call` block in full and record every input this story
      passes, with its declared `required`/`default`.
- [ ] 2.2 Read `deploy-preprod.yml` end to end — it is the closest sibling and its header carries the
      reasoning. Record what this story **must** differ on: `frontend_port` **not** loopback,
      `runner_label`, `frontend_network`, and the two-callee shape.
- [ ] 2.3 Confirm from `build.yml` that `workflow_call` declares **no `outputs:`** — paste the block.

### Task 3 — Write `deploy-prod.yml` (AC: 1, 2, 3, 4, 5, 6, 7, 8) — **0 runs**
- [ ] 3.1 Triggers and inputs per AC1; own literal `concurrency` group.
- [ ] 3.2 The **build** job: `uses: ./.forgejo/workflows/build.yml`, `environment: prod`, gated
      `if:` on `rollback` not being true.
- [ ] 3.3 The **deploy** job: `uses: ./.forgejo/workflows/deploy-stand.yml`, `needs:` the build job,
      with an `if:` that admits **success OR skipped** (§2). Every `with:` value from §5.
- [ ] 3.4 A **named step or job output** that states, on the release path, that this is a **rebuild,
      not a promotion** (AC2), and on the rollback path that no build ran.
- [ ] 3.5 The commit extraction from `image_tag` as a **distinct named step** — the seam Story 6.5
      lands on (§7). **Build no guard.**
- [ ] 3.6 `secrets:` on each job, with the reason in a comment (AC8).
- [ ] 3.7 Mechanical checks **before** any dispatch: `yaml.safe_load`; **zero** `${{` in any `run:`
      body including comments; `bash -n` on every `run:` body. Paste the results.

### Task 4 — 🔴 The rollback path, first (AC: 3, 6) — **1 dispatch**
- [ ] 4.1 **`PENDING (owner: coordinator)`** — dispatch `rollback: true` with
      `image_tag: sha-a99ccd44c5a3-prod`. **This path first, deliberately:** it builds nothing, it is
      the one the cutover needs, and it exercises §2's trap where a mistake is cheapest.
- [ ] 4.2 **`PENDING (owner: coordinator)`** — paste the run's **full job list and step table**
      (Prohibition 10). Show the build job **skipped** and the deploy job **executed**.
- [ ] 4.3 Read the stand back **from s10 itself**: container name, image digest, and
      🔴 `docker exec fe-prionex-prod getent hosts crm-kong-gateway` — **empty is a STOP**, and *"it
      started" is not evidence* (Story 4.1 Task 6.2).

### Task 5 — The release path (AC: 2, 6, 7) — **1 dispatch, ceiling 3**
- [ ] 5.1 **`PENDING (owner: coordinator)`** — dispatch `rollback: false` against Task 1.2's commit.
- [ ] 5.2 **`PENDING (owner: coordinator)`** — paste the full job list: **both** jobs executed, in order.
- [ ] 5.3 **AC7:** read the tag `build.yml` published **from the registry**, and the tag this caller
      passed, and show they are the same string. 🔴 Read manifest digests from the **registry**, never
      from `package_property.container.digest` — Story 6.3 got that wrong and corrected it.
- [ ] 5.4 Confirm the run states **rebuild, not promotion** (AC2).

### Task 6 — The discriminating runs (AC: 9) — **1 dispatch, ceiling 3**
- [ ] 6.1 **`PENDING (owner: coordinator)`** — dispatch `image_tag: sha-a99ccd44c5a3-preprod` and show
      the callee's tag↔environment guard **refusing**. **Free — that tag already exists.**
- [ ] 6.2 Decide and record whether the lock-contention row is earned or labelled unearned **with its
      reason** (§9). **Do not leave it blank.**
- [ ] 6.3 Fill §9's matrix with real run ids. Label every unearnable row.

### Task 7 — Record and discharge (AC: 8, 10) — **0 runs**
- [ ] 7.1 Write the decision record: the two-callee shape and its `if:`/`needs:` resolution; the
      double tag derivation; the `secrets: inherit` decision with its cost; and §4's constraint on the
      release path.
- [ ] 7.2 **AC10** — in the same edit, add the missing `<a id="d33"></a>` and `<a id="d37"></a>`
      anchors; re-verify `vars.VITE_OPERATOR_PHONE_URL_PROD`; discharge or re-own the M7 bundle **by
      name**.

### Task 8 — Close (AC: all) — **1 push + PR + merge rows**
- [ ] 8.1 Grade every AC against pasted evidence, not intention.
- [ ] 8.2 **`PENDING (owner: coordinator)`** — open the PR; **Oleg merges**.
- [ ] 8.3 **`PENDING (owner: coordinator)`** — close the ledger **by query**, attributing by
      `commit_sha`, and 🔴 **name dispatch runs separately** — their `commit_sha` is the dispatch ref,
      not what they built.

---

## Dev Notes

### 1. The one-paragraph version

Write a dispatch-only caller with two jobs. Rollback pulls; release rebuilds first. Every deploy input
is already measured and listed in §5 — nothing needs inventing. The three things that will bite are: the
`if:`/`needs:` interaction on the skipped build job, the tag being derived twice with no output to
carry it, and the fact that the release path **cannot** be tested on the image we already have.

### 2. Infrastructure facts, in one place

| Fact | Value |
|---|---|
| PROD host | s10, `192.168.122.11`, via `ssh -J root@62.112.10.55` |
| Deploy runner | `e1-rung3-prod-deploy`, **host process**, `:host` executor, host `docker.sock`, `capacity: 1` |
| Stand dir | `/root/crm-prionex/fe-prionex-prod` — with the load-bearing `docker-compose.stand.yml` |
| Port / network | `8080` (bare) / `crm-prod-network`, Kong aliased `crm-kong-gateway` |
| Cutover image | `sha-a99ccd44c5a3-prod` → `sha256:f30c794123ba…a3f3` |
| Registry | `git.crm-prionex.com/crm/fe-prionex`; org secrets `REGISTRY_USER(_RO)` / `REGISTRY_TOKEN_RW(_RO)` |
| Short SHA | **12**, pinned; 6.5 compares byte for byte |

### 3. Anti-patterns for this story

- ❌ Copying `deploy-preprod.yml`'s single-`uses:` shape and discovering later that nothing builds.
- ❌ Assuming a skipped `needs:` lets the dependent job run. **Test it.**
- ❌ Passing `127.0.0.1:8080` because DEV and PRE-PROD do.
- ❌ Letting `build.yml`'s tag and this caller's tag be derived by different rules.
- ❌ Testing the release path on `a99ccd44c5a3`. It will go red for a reason that is not your bug.
- ❌ Editing `deploy-stand.yml` to make a value fit.
- ❌ Building any part of Story 6.5's guard because the extraction step is right there.

### 4. The autonomous decisions in this story, for a one-read veto

1. **Two jobs, not one** — forced by `deploy-stand.yml` not building (§2).
2. **`frontend_port: 8080` bare, not loopback** — PROD traffic arrives from outside the host (§5).
3. **The rollback path is dispatched FIRST** — it builds nothing and is the cheapest place to find §2's
   trap.
4. **`secrets: inherit` on both jobs**, matching the two shipped callers, with the RW exposure recorded
   as accepted — Open Question 1.

---

### Project Structure Notes

Workflows in `.forgejo/workflows/`. `.github/workflows/` is legacy and inert — never edited here
(Story 7.2 owns deletion). Decision records in `docs/migration-decisions.md` with an explicit
`<a id="dN"></a>` anchor, an index row and a changelog row. Story artifacts in
`_bmad-output/implementation-artifacts/`.

### References

- Story 6.4 epic ACs — `_bmad-output/planning-artifacts/epics.md`, *"### Story 6.4: Deploy to Production by Dispatch"*
- FR15/FR17/FR24, and **FR32 as amended by `#d46`** — same file, requirements table
- The callable contract — `.forgejo/workflows/deploy-stand.yml`, `on.workflow_call.inputs`
- The sibling caller — `.forgejo/workflows/deploy-preprod.yml`
- No `workflow_call` outputs — `.forgejo/workflows/build.yml`, `on.workflow_call`
- `#d21` (expression context, `secrets:` parser limits, `if:` copied into callees), `#d24` (AC2 repoint
  refusal), `#d18` §3 (the 12-hex rule), `#d23` + its 2026-08-26 amendment (the s10 contour),
  `#d46` (the build-source change and FR32)
- Story 6.3 — `6-3-rebuild-the-running-production-commit-into-the-forgejo-registry.md`, and its
  `### Review Findings`
- Story 6.10 — `6-10-provision-the-prod-deploy-contour-on-s10.md`, `## 📌 ACTUALIZATION`
- Inherited items — `deferred-work.md`, *"Owner: Story 6.4"* (three)

---

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

### Review Findings

---

## Open Questions for Review

1. **`secrets: inherit` on the deploy job, or only on the build job?** (§6, AC8) The build job
   genuinely needs the OpenBao and RW credentials. The deploy job's callee references only the RO pair.
   Both shipped callers use `inherit` on their single job. **Recommended: `inherit` on both, with the
   RW exposure recorded as accepted.** Cheap to narrow later; a mid-deploy failure on a missing secret
   is not cheap.
2. 🔴 **MEASURED, not open as a question of fact — open as a decision.** (§4, Task 1.2) There is
   **exactly one** `sha-*-prod` tag, and `preprod-current` points at that same commit. **No validated
   candidate is unbuilt at prod**, so AC2's release path has nothing free to run against. **Pick one:**
   **(1)** wait for the next validated candidate — zero extra cost, unknown delay; **(2)** spend a
   **permanent** `sha-<12hex>-prod` on a non-candidate commit to prove the path now — irreversible,
   removable only by an authorised `DELETE` that has twice needed you in person; **(3)** record AC2
   unearnable and let Story 6.9's real release be the first exercise — 🔴 **which makes production the
   first place this code path ever runs.** **This gates Task 5.**
3. **Should the lock-contention row be earned?** (§9, Task 6.2) It costs a second dispatch and proves
   the Story 4.4 lock on the production stand for the first time. ⚠️ Note `capacity: 1` on the runner
   serializes jobs anyway — **so a naive contention test may prove the runner, not the lock.**
4. **Does anything assert which host the deploy landed on?** Nothing does today (Story 6.10's residual).
   Adding a host-identity assertion would mean editing `deploy-stand.yml`, which is **frozen**. Leave
   it, or open it as a finding against 4.8?

## Change Log

| Date | Version | Description | Author |
|---|---|---|---|
| 2026-08-26 | 0.1 | Context created off `origin/main` @ `308ea152`, with Stories 6.3 and 6.10 both `done`. Three findings decide the shape: **(§2)** this is the repository's **first caller with two callees**, because `deploy-stand.yml` builds nothing, and the `if:`/`needs:` interaction on a skipped build job is a trap `#d21` has already sprung once; **(§3)** `build.yml` declares **no `workflow_call` outputs**, so the tag is derived twice and must agree byte for byte, the failure surfacing as a `404` that reads like *"never built"*; **(§4)** the release path **cannot be exercised on the cutover image** — `Enforce AC2` refuses the repoint and `Date.now()` guarantees different bytes — so securing a never-built-at-prod commit is Task 1, and if none exists AC2 is unearnable. Five epic ACs carried, five added. Every `with:` value is already measured — none needs inventing. | create-story (Opus) |
