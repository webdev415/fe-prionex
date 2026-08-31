# Story 6.4: Deploy to Production by Dispatch

---
baseline_commit: 48bd6a78ade57ee06be1a25639e87691b807f999
---

Status: review

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
job derive  → plain job: extracts the commit, derives the PROD tag, normalises the boolean
job build   → uses: ./.forgejo/workflows/build.yml         if: not rollback
job deploy  → uses: ./.forgejo/workflows/deploy-stand.yml  needs: [derive, build], must run when build is skipped
```

🔴 **CORRECTED at execution, 2026-08-26 — it is THREE jobs, not two, and the reason is a second
independent constraint this section missed.** A `uses:` job's `with:` accepts **expressions only**, and
this expression language has **no substring operation**. The commit therefore **cannot be sliced out of
`image_tag` inside `with:`** — a plain job has to do it in shell and publish it as an output. So
`derive` exists for a reason unrelated to the build/deploy split, and it is also where Story 6.5's guard
lands (§7). **Two callees, three jobs.**

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

**`preprod-current` points at `a99ccd44c5a3` — the very commit already built at prod.**

🔴 **CORRECTED at execution, 2026-08-26 — the sentence that stood here was WRONG, and it was wrong in a
way that changed a decision.** It read: *"There is no validated PRE-PROD candidate that has not been
built at `environment: prod`."* **That was inferred from `preprod-current` alone.** Listing every
`preprod-*` version instead of the pointer gives:

```
preprod-00ef3be4743d     candidate #1, 2026-08-17, verdict pass   ← NOT built at prod
preprod-28f7fd36b75e     candidate #2, 2026-08-24, verdict pass   ← NOT built at prod
preprod-a99ccd44c5a3     candidate #3, 2026-08-25, verdict pass   ← IS the cutover image
preprod-current       -> a99ccd44c5a3
```

**Two validated candidates are available and unbuilt at prod.** Both are real commits in this
repository, both carry a `pass` row in `docs/preprod-candidates.md`.

🔴 **The method error, named because it is the second of its kind in one session:** a *"does any X
exist"* question was answered by reading **one** place — the moving pointer — and the negative was then
stated at full strength. The runner-location claim in Story 6.10 failed the same way hours earlier
(containers enumerated, "no agent exists" published). **A negative claim is only as strong as the
search behind it.**

**What this changes:** the release path no longer needs a **non-candidate** commit. It can run against
`28f7fd36b75e` — a genuinely validated candidate — so the permanent `sha-<12hex>-prod` it mints is
**exactly the kind a real release produces**, and the commit carries a `preprod-<sha>`, meaning Story
6.5's future guard would have admitted it too. **Oleg's option-2 decision still stands and is still
required — a permanent tag is spent — but it is spent on a legitimate release candidate rather than on
a throwaway commit, which is strictly cheaper and leaves nothing anomalous in the registry.**

✅ **RESOLVED 2026-08-26 by Oleg: option 2.** *"1. не ждать. 2. да. 3. нет."* — waiting is rejected,
recording AC2 unearnable is rejected, **a permanent tag is spent deliberately to prove the release path
now.**

**What that commits this story to — as corrected above:** dispatch the release path against
**`28f7fd36b75e`, validated candidate #2**, which mints a **second permanent `sha-<12hex>-prod`** in
the registry. **Not** a throwaway commit: the correction above removed that need, so the decision is
honoured at a lower price than it was taken at. `keep_pattern` protects that shape forever; removal needs an
authorised `DELETE` with a `write:package` token, which on this project has twice required the operator
in person. **The cost is named, accepted, and paid once.**

🔴 **And the decision is better than it first looks, because the window is closing.** Story 6.5 adds the
promotion guard: *extract the commit from `image_tag`, require `preprod-<sha>`, refuse otherwise.* A
non-candidate commit has no `preprod-<sha>` and **never will**. **So after 6.5 ships, this proof becomes
impossible** — the guard would refuse the very dispatch that proves the path. **Exercising AC2 now is
not merely convenient; it is the only remaining window**, and the alternative was letting production be
the first place the release path ever runs.

🚨 **Two hard constraints that follow from spending the tag, both Prohibition-grade:**
- 🔴 **`prod-current` MUST NOT be moved to the proof image.** It currently names the cutover image
  (`sha-a99ccd44c5a3-prod`). The proof commit is not a release and must never become "what production
  is running". `record-prod-image.yml` refuses a move by default — **do not pass
  `allow_current_move`**, and do not dispatch the recorder at all for this image.
- 🔴 **The proof image must be recorded as a PROOF, not as a release.** No row in
  `docs/prod-releases.md`; the decision record names the tag, the commit, why it exists, and that it is
  **not** a rollback target. Otherwise the next reader finds two permanent prod images and no way to
  tell which one production was ever meant to run.

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
- [x] 1.1 **Done.** Branch `story-6-4/pr-1-context` off `origin/main` @ `308ea152`; baseline commit
      `48bd6a78`. **Decision number: `D47`** — swept across every `origin/*` ref (max in `main` is
      `D46`); `D47` and `D48` both free. ⚠️ Re-verify at write time including the operator's own
      checkout — the ref-only sweep was wrong once already (Story 6.3, OQ10).
- [»] 1.2 ✅ **ANSWERED AT CONTEXT TIME, and Oleg has since decided.** Measurement pasted in §4:
      exactly one `sha-*-prod` tag exists (`sha-a99ccd44c5a3-prod`) and `preprod-current` resolves to
      the **same** commit — no validated candidate is unbuilt at prod. **Oleg chose option 2: spend a
      permanent tag and prove the release path now** (*"1. не ждать. 2. да. 3. нет."*).
      **At execution:** re-verify the `sha-*-prod` set — a new candidate may exist by then, and if one
      does, **prefer it and spend nothing.** Otherwise use `main`'s head, and **paste the commit and
      the resulting tag name before dispatching**, not after.
- [x] 1.3 **Declared `OPEN`** — floor 8, ceiling 20 (§10).

### Task 2 — Read the contract, do not infer it (AC: 4, 5) — **0 runs**
- [x] 2.1 **Done.** Every input read from `deploy-stand.yml`'s own `workflow_call` block; the seven
      required ones and the four tuning constants this story sets are tabulated in §5 with their
      sources. **`ref` and `image_tag` are mutually exclusive — exactly one**; this story passes
      `image_tag`.
- [x] 2.2 **Done.** `deploy-preprod.yml` is ~40 lines of body under ~136 of header — the house ratio.
      Confirmed the three points this story must differ on: **`frontend_port` bare, not loopback**;
      **`runner_label: e1-rung3-prod-deploy`**; and the job shape, which turned out to be **three**
      jobs rather than two (§2, corrected).
- [x] 2.3 **Confirmed by reading the block:** `build.yml`'s `workflow_call` declares `ref` and
      `environment` **and nothing else — no `outputs:`**. The tag is therefore derived twice (§3).

### Task 3 — Write `deploy-prod.yml` (AC: 1, 2, 3, 4, 5, 6, 7, 8) — **0 runs**
- [x] 3.1 **Done.** `workflow_dispatch` only; required `image_tag`, optional `rollback` boolean
      (default `false`); own literal group `deploy-prod-fe-prionex-prod`, no expression.
- [x] 3.2 **Done.** `build` → `uses: ./.forgejo/workflows/build.yml`, `environment: prod`,
      `ref: needs.derive.outputs.hex`, gated `if: needs.derive.outputs.is_rollback != 'true'`.
- [x] 3.3 **Done.** `deploy` → `uses: ./.forgejo/workflows/deploy-stand.yml`,
      `needs: [derive, build]`, and the `if:` is
      `always() && needs.derive.result == 'success' && (needs.build.result == 'success' || needs.build.result == 'skipped')`.
      🔴 **`always()` is load-bearing**: without it the expression is not evaluated at all after a
      skip, and the rollback path would silently deploy nothing while reporting green. Every `with:`
      value taken from §5.
- [x] 3.4 **Done — a named step, and it prints to both stdout and the step summary.** On the release
      path it states the image is **built here, NOT the artifact validated on PRE-PROD, and not
      byte-identical to it**, with the Option C reason and `#d2`'s own sentence that validation is
      evidence about the source, not about the bytes. On the rollback path it states no image is
      produced and the build job is skipped.
- [x] 3.5 **Done.** Extraction lives in `derive`, a distinct named job — **the seam, and no guard is
      built on it.** The header says in those words where Story 6.5's check lands and that this story
      does not build it.
- [x] 3.6 **Done.** `secrets: inherit` on **both** callee jobs, with the reason and the cost in the
      header: the parser rejects `on.workflow_call.secrets`, so a caller passes `inherit` or the
      callee gets nothing; `inherit` hands over **every** org secret including `REGISTRY_TOKEN_RW`.
      Recorded as **accepted**, matching both shipped callers.
- [x] 3.7 **Done — pasted.** `yaml.safe_load` parses: 3 jobs, 2 `run:` bodies, triggers
      `['workflow_dispatch']`. **Zero `${{` in any `run:` body**, comments included (Prohibition 6).
      `bash -n` clean on both.
      ✅ **And `derive` was exercised locally before any dispatch — 8/8 as specified:**
      ```
      PASS   sha-28f7fd36b75e-preprod + rollback=false -> hex=28f7fd36b75e, deploy_tag=sha-28f7fd36b75e-prod
      PASS   sha-a99ccd44c5a3-prod    + rollback=true  -> deploy_tag=sha-a99ccd44c5a3-prod
      PASS   ROLLBACK="True" (string) -> normalised to is_rollback=true
      REFUSE sha-a99ccd44c5a3-preprod + rollback=true  -> "names the PRE-PROD environment"
      REFUSE prod-current              -> "is a RECORD, not a deployable reference"
      REFUSE prod-a99ccd44c5a3         -> same
      REFUSE 40-hex form               -> "is '28f7…915b' (40 characters), not exactly 12"
      REFUSE main-dev                  -> "does not match ^sha-<hex>-(prod|preprod)$"
      ```
      🔴 **This is local shell verification, NOT retro-E5's live matrix** — no run id, and it never
      reached Forgejo. §9's matrix stays `OPEN` until Tasks 4-6 supply run ids. Story 6.3 conflated
      exactly these two and its AC6 was recorded UNMET; this story states the distinction instead.

### Task 4 — 🔴 The rollback path, first (AC: 3, 6) — **1 dispatch**

✅ **HALT RESOLVED 2026-08-26 — Oleg chose option 1, our own runner was provisioned, and RUN 634 is
GREEN.** The account of runs 629 and 632 is kept below unedited, because three failures each moved
the frontier and the sequence is the evidence. **Resolution and final state at the end of Task 4.3.**

🛑 **HALT AT 4.1, 2026-08-26 — RUN 629 FAILED, and the cause is architectural, not a defect in this
story's own file.**

**What DID pass, and it is the finding this task existed to produce.** §2's trap is cleared,
by observation:

```
Derive the commit and the PROD tag …            success
Rebuild the commit at environment: prod         (its "Build and Push" child: SKIPPED)   ← rollback path
Deploy to the PROD stand on s10                 EXECUTED, not skipped                   ← the trap, passed
```

**The build was skipped and the deploy still ran.** `always()` plus the explicit
success-or-skipped test does what §2 required, and the silent-no-op failure mode this story was most
afraid of **does not exist in this file.** That is AC6's core, earned on the first dispatch.

🔴 **Where it failed — `deploy-stand.yml`'s own preflight, pasted:**

```
REGISTRY_USER_RO length: 12       OK: both secrets are non-empty …
GET https://git.crm-prionex.com/v2/ -> HTTP 401 (401 expected: reachable, unauthenticated)
OK: registry is reachable and answering correctly from this runner's own execution.
error: no such object: e1-rung3
FAIL: could not self-identify this job container's own image via 'docker inspect $(hostname)'
      — cannot smoke-test the lock mechanism without knowing which image it will run in.
```

**Secrets and registry reachability both passed from s10.** The failure is the self-identification.

### 🔴 THE ROOT CAUSE: `deploy-stand.yml` REQUIRES A CONTAINER EXECUTOR; s10's RUNNER IS A HOST EXECUTOR

Measured, both runners' declared labels:

```
s1  (DEV / PRE-PROD, id 14):  deploy-dev-preprod:docker://deploy-base-dev-preprod:2026-08-07
s10 (PROD,           id 23):  e1-rung3-prod-deploy:host
```

`deploy-stand.yml` derives `SELF_IMAGE` from **its own job container** in order to launch the Story 4.4
lock holder as a **sibling container** through the `docker.sock` it holds. Under a **`:host`** executor
the steps run **directly on the machine** — there is no own container, `$(hostname)` is the machine name
`e1-rung3`, and `docker inspect` correctly reports `no such object`.

⚠️ **`deploy-stand.yml`'s own comment at that step does not contemplate this.** It attributes the
failure to *"a runner started with a non-default `--hostname`, or the docker daemon itself is
unreachable"*. **Neither is the cause here.** A host executor is a third case the file never
anticipated, and it fails closed with a message that points at the wrong two.

🔴 **This qualifies Story 6.10's AC1, which I confirmed as "met in full" hours ago.** AC1 asked for a
runner **on s10** whose jobs execute against the **host Docker daemon, not dind** — and `:host` with
`docker_host: unix:///var/run/docker.sock` satisfies exactly that, so the confirmation was true **of
AC1's text**. **AC1 never asked which EXECUTOR the runner uses**, and nobody — including me — checked
whether the runner it accepted is compatible with the shared deploy definition it exists to run.
**That is an under-specified AC, not a false measurement**, and it is worth more than this story: an AC
can be fully met and still leave the thing it was written to enable impossible.

**Three ways out. None is inside this story's blast radius (`deploy-stand.yml` is FROZEN,
Prohibition 1), so this is Oleg's call:**
1. ✅ **Register OUR OWN deploy runner on s10 with a `docker://` executor**, mirroring s1's. **This is
   the plan's own model** — `#d23` decided *«деплой-раннер на s10 провижним мы сами»*, and Story 6.10
   departed from it by adopting the neighbours'. It needs the `deploy-base-dev-preprod` image (or an
   equivalent) reachable from s10, and it touches no shipped file. **Recommended.**
2. **Ask `CRM/api-prionex` to add a container-executor label** to their runner. Cheapest in effort,
   but it makes the frontend's production deploy depend on another team's runner config a second time.
3. **Change `deploy-stand.yml`** to work under a host executor. 🔴 **Frozen here, and it would touch the
   shipped DEV and PRE-PROD deploy path** — the blast radius is every stand, not just PROD.

**Tasks 4.2-4.3, 5 and 6 do not run until this is settled.** No further dispatch is useful: every one
would fail at the same step.

- [»] 4.1 🛑 **DISPATCHED, run 629, FAILED at the callee's preflight — see the HALT above.** Dispatch
      was `rollback: true` with
      `image_tag: sha-a99ccd44c5a3-prod`. **This path first, deliberately:** it builds nothing, it is
      the one the cutover needs, and it exercises §2's trap where a mistake is cheapest.
- [»] 4.2 ✅ **Done — job list pasted in the HALT above.** Build **skipped**, deploy **executed**:
      §2's trap is cleared by observation, which is AC6's core and the one thing this dispatch bought.
- [»] 4.3 ✅ **DONE — read back from s10 itself, after RUN 634.**

      ```
      fe-prionex-prod   Up (healthy)   0.0.0.0:8080->80/tcp
      revision = a99ccd44c5a39345fa65eb74e87343b187e129e9        ← the cutover commit
      digest   = sha256:f30c794123bafbdefc5cf4ec5815e1aaf0739e6b6819117d56d495ac8efea3f3
      network  = crm-prod-network
      getent hosts crm-kong-gateway -> 172.18.0.49               ← 🔴 THE BACKEND RESOLVES
      curl 127.0.0.1:8080 -> HTTP 200
      ```

      🔴 **The Kong resolve is the check that matters, and it passed.** *"It started" is not
      evidence*: nginx resolves Kong lazily and the healthcheck probes the container itself, so a
      stand on a backend-less network reports `healthy` and serves 200 — Story 4.1 Task 6.2
      demonstrated exactly that. **An empty answer here was a STOP. It is not empty.**
      The digest matches `sha-a99ccd44c5a3-prod` and the revision label matches the commit Story 6.3
      built. **AC3 is met, and AC6's rollback half with it.**

### ✅ RESOLUTION — what it took, and what each failure bought

**Three dispatches, three different failures, each one further along than the last. The sequence is
the evidence and is not collapsed into "it works now".**

| Run | Failed at | What it bought |
|---|---|---|
| **629** | callee preflight, `docker inspect $(hostname)` | Exposed the executor incompatibility — **and proved §2's trap is clear**: build **skipped**, deploy **executed** |
| **632** | `frontend_port` format assertion, **after** `up -d` | Preflight passed on our own runner; **the stand came up healthy and the backend resolved** |
| **634** | — **SUCCESS** | Every job green; rollback path complete end to end |

**What was provisioned to get there** (Oleg's option 1, *«1 этот вариант»*): our own deploy runner on
s10 at `/opt/forgejo-runner-fe-prod`, **repository-scoped** (Story 1.7's precedent), label
`fe-prionex-prod-deploy:docker://deploy-base-dev-preprod:2026-08-07` — jobs run **in a container**
that holds the **host** `docker.sock`, mirroring s1's own deploy runner line for line.
- The executor image was moved from s1 by `docker save | docker load`; it is in **no registry**, so
  `force_pull: false`. Pinning the date tag also **decouples us** from the hub rebuilding their copy,
  which `deploy-stand.yml` itself calls volatile. All five binaries it smoke-tests — `docker`, `git`,
  `curl`, `flock`, `timeout` — verified present on this host.
- **`docker` is gid 988 on both hosts** and s1's runner runs `1501:988`, so ours runs `1000:988`.
  Without the group the daemon answers `permission denied` and the container restart-loops with a
  message that reads like the daemon is down.
- The first `register` failed to write `.runner` **after** the server had already created the
  registration; that orphan (id 25) was **deleted**, not left behind.

🔴 **And a value in this story's own §5 was wrong in FORM while right in INTENT.** §5 argued at length
that `frontend_port` must not be loopback — true, and it stands: PROD traffic arrives from the
hypervisor, and a `127.0.0.1` binding would leave the stand unreachable while the health check, which
probes the container itself, still reported `healthy` and served 200. **But from "not loopback" it
concluded "bare port", and `deploy-stand.yml` refuses a value with no host prefix.** `0.0.0.0:8080`
satisfies both. **Both halves are now in the workflow header with run 632 cited**, so the next reader
cannot re-derive one and lose the other.

⚠️ **Left standing, not swept up:** the earlier subtask text below still reads as though it were
about to dispatch. It is kept because the HALT it records is the finding, and rewriting it would
erase why the runner exists.

- [ ] 4.3-old 🛑 *(superseded by 4.3 above)* read the stand back **from s10 itself**: container name, image digest, and
      🔴 `docker exec fe-prionex-prod getent hosts crm-kong-gateway` — **empty is a STOP**, and *"it
      started" is not evidence* (Story 4.1 Task 6.2).

### Task 5 — The release path (AC: 2, 6, 7) — 🔀 **BUILD LEG PROVEN, DEPLOY LEG DEFERRED TO 6.9**

- [»] 5.0 ✅ Gate closed three times, and each attempt burned its candidate — see 5.1.
- [»] 5.1 🔀 **THREE ATTEMPTS. The build leg is proven twice; the deploy leg of the release path was
      never green, and Oleg's decision (option (в)) is to stop rather than spend a fourth permanent
      tag.**

      | Run | Build | Deploy | What it found |
      |---|---|---|---|
      | **637** `28f7fd36b75e` | ✅ | ❌ | The callee received the **dispatch's** tag, not `with:`. My first explanation — `actions/checkout` destroying `$GITHUB_OUTPUT` — was **incomplete**: the ordering fix landed and the symptom survived |
      | **639** `00ef3be4743d` | ❌ | — | 🔴 **`build.yml` cannot rebuild a commit older than 2026-08-19** — see below. **No tag was minted**: it failed before the push |
      | **640** `308ea1520c59` | ✅ | ❌ | Same input shadowing, now isolated: `deploy-stand.yml` reads its input the ordinary way, so the **callee's `inputs` were populated from the DISPATCH, not from `with:`** |

      🔴 **`build.yml` HAS AN UNDOCUMENTED FLOOR ON COMMIT AGE, and this is the finding worth most.**
      Its netns-isolation step builds `Dockerfile.netns-isolation-check`, added by `4534b6c6` on
      **2026-08-19**. Any older tree fails with `no such file or directory`. Measured:
      ```
      00ef3be4743d (2026-08-17)  NO   <- validated candidate #1, physically unbuildable
      28f7fd36b75e (2026-08-24)  yes
      a99ccd44c5a3 (2026-08-25)  yes
      ```
      **The release path can only rebuild commits from 2026-08-19 onward.** Rollback is unaffected —
      it builds nothing — but any future rebuild of an older release is impossible, and nothing
      anywhere said so.

      🔴 **THE INPUT-SHADOWING FINDING, and why this project could not have found it before.** Both
      shipped callers pass the dispatch input straight through under the **same name**, so caller
      value and dispatch value are the **same string** and the substitution is invisible and
      harmless. **This is the first caller whose `with:` value differs from its own dispatch input**,
      and that difference is the only reason the behaviour is observable at all. Fixed by naming the
      dispatch input **`tag`**, leaving nothing in the dispatch to shadow the callee's `image_tag`.
      ⚠️ **Epic AC1 says "a required `image_tag` input".** It is required and it is the image tag;
      only the NAME differs, because the epic's name cannot work here. **A deviation with its reason,
      not a silent change.**

- [»] 5.2 🔀 **Both callee jobs executed in runs 637 and 640** — `derive → build → deploy`, in order,
      with `Build and Push` **succeeding**. The deploy leg failed both times for the shadowing reason.
      **AC6's release half is therefore PARTIALLY earned and is recorded as such.**
- [»] 5.3 ✅ **AC7 earned by construction of the outcome, not by a green run.** `derive` computed
      `sha-28f7fd36b75e-prod` / `sha-308ea1520c59-prod` independently, and `build.yml` — which
      publishes no outputs — computed its own from `git rev-parse HEAD`. **Both tags exist in the
      registry under exactly the names `derive` predicted**, which is the agreement AC7 asks for:
      ```
      sha-28f7fd36b75e-prod          <- run 637
      sha-308ea1520c59-prod          <- run 640
      28f7fd36b75ee773…d915b-prod    <- the sanitized 40-hex side-effect tag, 14 days, unprotected
      308ea1520c594d13…d0a26f-prod   <- same
      ```
      Also proven here: the **full-SHA expansion works** — `build.yml` received the 40-hex form, which
      is why the sanitized side-effect tags carry it.
- [x] 5.4 ✅ **The rebuild-not-promotion statement is emitted** by `derive`'s own step to stdout and
      `$GITHUB_STEP_SUMMARY`, quoting `#d2`: validation is evidence about the source, not about the
      bytes. **AC2's statement half is met; its end-to-end half is not.**
- [x] 5.5 ✅ **`record-prod-image.yml` was NOT dispatched for any proof image, and `prod-current` was
      NOT moved.** It still names the cutover image. **No row was added to `docs/prod-releases.md`** —
      no release was approved.

🔀 **DECISION, Oleg 2026-08-26, option (в): stop here.** A green end-to-end release run costs **one
permanent tag, always** — the release path builds, and building mints the tag. Three are already
spent (one by Story 6.3, two by this story's failures). **Waiting or forcing a fourth was declined;
the release path's first end-to-end run will be Story 6.9's real cutover.**
🔴 **The cost, named rather than implied:** Epic 6's own preamble calls that arrangement a **one-way
door**. Story 6.9 will exercise the release deploy leg for the first time **on the real cutover**.
**Story 6.9 owns this.**

### Task 6 — The discriminating runs (AC: 9) — **2 dispatches, both free**

- [»] 6.1 ✅ **Two live refusals, both in `derive`, both BEFORE any callee ran** — zero builds, zero
      deploys, zero permanent tags:
      ```
      run 643  tag=sha-a99ccd44c5a39345fa65eb74e87343b187e129e9-prod
               FAIL: the hex part is 'a99ccd…129e9' (40 characters), not exactly 12
               ^ #d18 §3's silent-divergence failure, MADE TO FIRE
      run 644  tag=prod-current
               FAIL: image_tag='prod-current' is a RECORD, not a deployable reference
      ```
- [»] 6.2 ⚠️ **The lock-contention row is NOT earned, and the reason is that it could not have
      discriminated.** The s10 runner has `capacity: 1`, so two dispatches serialize **at the runner**
      before the lock is ever consulted. A naive contention test would have proven the runner, not
      Story 4.4's lock. **Labelled unearned with its reason rather than run for a green tick.**
- [»] 6.3 ✅ **§9's matrix, with real run ids:**

      | Guard / branch | Pass | Discriminating | State |
      |---|---|---|---|
      | `rollback: true`, pull, no build | **634, 642** | — | ✅ **earned twice** |
      | build skipped, deploy still runs | **629, 634, 642** | 629 showed it under a *failing* callee | ✅ **earned** — §2's trap is clear |
      | `rollback: false`, rebuild then deploy | build leg **637, 640** | — | 🔀 **partial** — deploy leg deferred to 6.9 |
      | G3 exactly-12-hex | 634, 642 | **643** | ✅ **earned live** |
      | record-tag refusal (`prod-current`) | — | **644** | ✅ **earned live** |
      | G2 `-preprod` on rollback | — | — | ⚠️ **force-tested locally only** (8/8), never dispatched |
      | commit-existence check | 637, 640 | — | ⚠️ **pass side only**; no dispatch named a missing commit |
      | lock contention | 634, 642 acquire it | — | ❌ **not earned** — `capacity: 1` makes it undiscriminating (6.2) |

### Task 7 — Record and discharge (AC: 8, 10) — **0 runs**
- [x] 7.1 ✅ **`D47` written** — the three-job shape and its `if:`/`needs:` resolution, the double tag
      derivation, `secrets: inherit` with its cost, the commit-age floor, the input shadowing, and the
      three permanent proof tags with what they are and are not.
- [x] 7.2 ✅ **AC10's three inherited items discharged or re-owned by name** — see `deferred-work.md`.

### Task 8 — Close (AC: all) — **1 push + PR + merge rows**
- [x] 8.1 ✅ **Graded below.**
- [»] 8.2 **`PENDING (owner: coordinator)`** — PR opened; **Oleg merges**.
- [»] 8.3 **`PENDING (owner: coordinator)`** — ledger closed by query at closeout. 🔴 **Dispatch runs
      carry the DISPATCH REF as `commit_sha`, not what they built** — name them separately.

---

## AC grading — against pasted evidence, not intention

| AC | Verdict | Evidence |
|---|---|---|
| **AC1** *(epic)* | 🔀 **MET with a named deviation** | `workflow_dispatch` only; required tag input; optional `rollback`; own literal concurrency group. **The input is named `tag`, not `image_tag`** — forced, see Task 5.1 |
| **AC2** *(epic)* | 🔀 **PARTIAL** | Rebuild proven twice (637, 640) and the rebuild-not-promotion statement is emitted. **The end-to-end release path was never green**; deferred to 6.9 by Oleg's option (в) |
| **AC3** *(epic)* | ✅ **MET** | Runs 634 and 642: pull, no build job, deploy executed, stand healthy, backend resolves |
| **AC4** *(epic)* | ✅ **MET** | `runner_label: fe-prionex-prod-deploy`; **no SSH credential anywhere** |
| **AC5** *(epic)* | ✅ **MET** | `deploy-stand.yml` consumed unmodified; Story 4.4's lock acquired on the production stand — pasted from run 634's own log. Slack clause deferred and non-gating |
| **AC6** | 🔀 **PARTIAL** | Skip-and-still-run proven three times. Both-executed proven in 637/640, but the release run was never green end to end |
| **AC7** | ✅ **MET** | Both derived tags exist in the registry under exactly the names `derive` predicted |
| **AC8** | ✅ **MET** | `secrets: inherit` on both callee jobs, with the parser constraint and the `REGISTRY_TOKEN_RW` exposure named in the header as accepted |
| **AC9** | 🔀 **PARTIAL** | Matrix carries real run ids; **three rows are labelled unearned with their reasons** rather than left blank |
| **AC10** | ✅ **MET** | All three inherited items discharged or re-owned by name |

**5 met, 4 partial, 1 met-with-deviation. Every partial names what is missing and who owns it.**

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
2. ✅ **RESOLVED 2026-08-26 by Oleg — option 2, verbatim: *"1. не ждать. 2. да. 3. нет."*** The
   release path is proven **now**, by deliberately spending a second permanent `sha-<12hex>-prod` on a
   non-candidate commit (`main`'s head at dispatch time). Waiting and recording-unearnable were both
   explicitly declined, so this is a choice on the record, not a default. **The window matters:** once
   Story 6.5's guard ships it will refuse any commit without a `preprod-<sha>`, and a non-candidate
   commit will never have one — **so this proof is impossible after 6.5.** See §4 for the two
   Prohibition-grade constraints that follow (never move `prod-current`; record it as a proof, never as
   a release).
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
