---
baseline_commit: 96d19bc0
---

# Story 5.3: Deploy a Specific Image Tag to PRE-PROD

Status: ready-for-dev

<!-- Contexted 2026-08-24 against `main` at `96d19bc0` — the merge of PR #77, Story 5.2's ledger
     closeout. (Contexting began against `c325b7d6`, PR #76; #77 landed mid-session and this file
     was rebased onto it. That matters: 5.2's own closed ledger — the run ids and the
     baseline this story counts from — arrived with #77 and is not in #76.)
     Branch `story-5-3/pr-1-context`. Every autonomous decision in this file is marked "autonomous,
     subject to Oleg's veto" and they are listed together in Dev Notes §9 so a veto costs one read
     rather than a re-derivation. Story 4.9 is in flight on `story-4-9/*` at the same time — §12
     states what this story may not touch, and it is not advice. -->
<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a release engineer,
I want to name the exact artifact that goes to PRE-PROD,
So that validation is performed against a known, reproducible candidate.

---

## 🚨 Read this before anything else

### 1. What this story is, in one paragraph

Story 4.8 factored `deploy-dev.yml`'s proven mechanics into a `workflow_call` callee,
`.forgejo/workflows/deploy-stand.yml`, and gave it a second mode — deploy a **pre-built image tag**
instead of deriving one from a git ref. **This story writes the first consumer of that mode.**
`.forgejo/workflows/deploy-preprod.yml` is a thin caller: `workflow_dispatch` only, one required
`image_tag` input, no `ref` anywhere, its own literal `concurrency:` group, and a `with:` block
naming the PRE-PROD stand Story 5.2 built. The whole deliverable is roughly ninety lines of YAML
that copy an existing, working file's shape.

⚠️ **And that ninety lines is the smallest part of the story.** The `image_tag` mode this caller
consumes **has never executed, anywhere, once.** It was *structurally dead* until Story 4.8's own
code review found it by reading (H1, below), and the two fixes that revived it were verified by
`yaml.safe_load`, a `${{ }}` scan and `bash -n` — **not by a dispatch**, because no caller existed
to dispatch it. This story's first dispatch is therefore not a confirmation; it is the
**discriminating event**, and the run budget in §11 is sized for that and for nothing else.

⚠️ **The stand will deploy, report healthy, serve over TLS, and browser API calls will still
fail.** PRE-PROD's Kong sends a static, wrong `Access-Control-Allow-Origin`
(`http://localhost:8320`). That is `CRM/api-prionex`'s defect, the external ask is out, and it is
not this story's to fix. AC6 states what this story's own checks can and cannot prove because of
it — §6.

### 2. What already exists, measured, and what this story therefore does NOT have to build

Every row below was measured first-hand by Story 5.2's session on s1, 2026-08-23/24 UTC, and is
recorded in `5-2-…md` and `docs/migration-decisions.md#d36`. **They are the prior, not this story's
evidence.** Re-confirm the ones marked 🔁 before the first dispatch; they are cheap and they are
the ones that fail a dispatch if they have drifted.

| # | Fact | Value | Re-check? |
|---|---|---|---|
| a | Stand directory | `/root/crm-prionex/fe-prionex-preprod/`, `0700` | 🔁 **hard precondition** |
| b | Compose file in it | `…/docker-compose.stand.yml`, `sha256 7f449dacce163fed898b06d3d3d204656b0f485fdbad1827c03c7aac9b1932ec` | 🔁 **hard precondition** |
| c | Lock path 5.3 will take | `/root/crm-prionex/fe-prionex-preprod/.deploy.lock` | — |
| d | Lock holder name it will use | `fe-prionex-preprod-deploy-lock-<run id>` (`deploy-stand.yml:1457`, derived from `compose_project_name`) | — |
| e | `COMPOSE_PROJECT_NAME` / `CONTAINER_NAME` | `fe-prionex-preprod` / `fe-prionex-preprod` | — |
| f | `FRONTEND_PORT` | **`127.0.0.1:8083`** — permanent loopback bind, not a stopgap | — |
| g | `FRONTEND_NETWORK` | `crm-preprod-network`, id `90bd3e56416e…`, 69 containers, `external: true`, owned by `CRM/api-prionex` | — |
| h | Running image right now | `git.crm-prionex.com/crm/fe-prionex:sha-00ef3be4743d-preprod`, digest `sha256:5e5b190d93c8aaec50f0d50c7e108f502c3d366d14f8a13aee081f0ee396dc8c` | 🔁 |
| i | Kong on that network | `crm-preprod-kong-gateway`, id `61eb0eaa9f640e23…`, aliases `[crm-preprod-kong-gateway, kong, crm-kong-gateway]`, seen at `172.21.0.24` from inside the stand | 🔁 **see §7** |
| j | Public name | `crm.preprod.crm-prionex.online` → `185.185.49.127`, own LE cert, expires 2026-11-21, vhost `location /` → `proxy_pass http://127.0.0.1:8083` | — |
| k | Host nginx does **not** proxy `/api/` | the frontend's own nginx does, onward to `crm-kong-gateway:8000` from inside the network (`nginx.conf:37-56`) | — |
| l | Deploy runner | `s1-deploy-dev-preprod`, id 14, capacity 1, image `deploy-base-dev-preprod:2026-08-07` | — |
| m | Its registered labels (`.runner` on disk) | `deploy-dev-preprod`, `dev`, `preprod`, `deploy` — **but see §4** | — |
| n | Host registry login | restored by 5.2 (`fe_reg_5_2b_ro`) — **and irrelevant to this story**, §8 | — |
| o | SSH to s1 | `ssh root@10.67.0.1` (private). External `185.185.49.127:22` times out by `ufw` design (D28 §6) | 🔁 |
| p | Ledger position after 5.2's closeout | repo-scoped `1177 | 446` @ `2026-08-24T06:02:11Z`. This story's baseline is **≥ 1177** | 🔁 Task 1.2 |

**So this story provisions nothing, installs nothing, and touches no host configuration.** It adds
one file to the repository and then dispatches it. That is the whole shape.

### 3. 🔴 The one thing that is genuinely new, and why it is the whole risk

`image_tag` mode is a code path with **zero execution history**. Story 4.8's own review found it
dead by reading — quoting the finding, because paraphrase loses the shape of it:

> **`image_tag`-only mode is structurally DEAD — Story 5.3 cannot deploy, and the `github.sha`
> fallback is unreachable, not untested.** **Blocker (a):** `clone-test`'s first step hard-fails on
> an empty `ref`; `clone-test` carries no `if:` gate; `deploy` declares
> `needs: [preflight, clone-test]` — so a caller written exactly as this file's own skeleton
> instructs produces a red `clone-test` and a SKIPPED `deploy`. **Blocker (b), independent:** even
> with (a) fixed, the step compares the pulled image's `org.opencontainers.image.revision` against
> the checkout HEAD — which in `image_tag` mode IS the `github.sha` fallback, i.e. the caller's own
> commit, not the image's build commit. Those differ by construction, so every `image_tag` deploy
> fails as a *"mismatched pair"*.

Both were fixed in 4.8's fix-pass. **Neither fix has ever been dispatched.** 4.8 says so itself:

> Neither fix has been dispatched yet (image_tag mode has no caller until Story 5.3 exists); the
> reasoning is verified by reading and by the same mechanical `bash -n`/`${{`-scan/`yaml.safe_load`
> discipline this whole file is held to, **not by a live run**. Flagged for Story 5.3's own first
> dispatch to confirm end-to-end.

**Four distinct things execute for the first time in this story's first dispatch:**

1. `clone-test`'s `github.sha` fallback (`deploy-stand.yml:643-661`, and again at `:691-693`).
2. The compose checkout's `IMAGE_TAG_MODE=1` fallback (`:1209-1227`) — the compose file comes from
   **the caller's own commit**, not from any application ref.
3. The revision cross-check being *skipped* rather than failing falsely (`:1289-1302`).
4. `expect_unrouted_api="false"`'s permissive Kong branch (`:2199-2207`).

🔴 **And one consequence of the H1 fix that is easy to read as harmless.** Because the revision
cross-check is *skipped* in `image_tag` mode, **AC6's digest comparison is the only binding check
that the running container is the image that was asked for** (D33 §6(b): *"AC6's дайджест остаётся
единственной обязательной проверкой там"*). That matters because the project already carries an
open finding that the ref→tag scheme is **lossy** — two different refs can produce one tag, and the
revision label was named as the mitigation. On this story's path that mitigation is switched off by
design. It is **not** a problem here, and the reason is worth writing down rather than assuming:
`sha-<12hex>-preprod` carries the commit *in the tag itself* and is immutable
(`build.yml:1477-1496` refuses to repoint it). **A branch-shaped tag would not have that property —
so do not let a later story generalise "image_tag mode is safe" past the `sha-` shape.**

⚠️ **Budget red rounds for this, explicitly, and do not treat a green first dispatch as the
expected case.** 4.8's own history is the argument: *"a refactor does not ship new guards — it
ships the same guards on a new path, and a guard on an unexercised path is exactly a guard that
cannot fail."* Its Task 6.5 needed **three** dispatches to get one row right; Story 4.6 spent
**23 of 39 runs** getting a single confirmation step right; Story 4.3 paid five red dispatches for
skipping the zero-dispatch conversion. §11 reserves three.

⚠️ **Everything that can be settled without a dispatch must be settled without one.** 4.8:
*"Zero-dispatch conversion is standard procedure, not an optional efficiency (4.4 demonstrated it
at 16 runs against a ~20 floor with zero red dispatches)."* For this story that means: YAML parses,
`bash -n` on nothing (there are no `run:` bodies in the caller — see Prohibition 4), the `${{ }}`
scan, the runner-label question (§4), the stand-dir precondition (§2 a/b), the Kong alias (§7), and
the image tag's existence in the registry (§5) are all closed **before** dispatch 1.

### 4. 🔴 `runner_label` — the skeleton is wrong, and the obvious correction is also wrong

`deploy-stand.yml:216`, inside the commented PRE-PROD caller skeleton this story is told to copy:

```
#       runner_label: deploy-preprod-preprod   # or 6.4's own s10 label, from Story 6.10 — R1 (§4)
```

**No such label exists on any runner.** Three artifacts already route this to this story by number
(`5-2-…md:212-223` §8, `deferred-work.md:3600-3606` finding 1, `docs/migration-decisions.md#d36`
§7, and `sprint-status.yaml:705-707`). Story 5.2 left the *choice* open as its Open Question 2:

> **Which of `preprod` or `deploy-dev-preprod` should Story 5.3 use as `runner_label`?** Both are
> registered on the same runner with the same job image. `preprod` reads better;
> `deploy-dev-preprod` is the one with live evidence behind it.

🔴 **This story answers it: `deploy-dev-preprod`.** *Autonomous, subject to Oleg's veto.* The
reason is not readability, and it is not 4.3's collision argument — it is a **measurement conflict
nobody has reconciled**, and picking the pretty label bets on the wrong side of it.

| Source | What it says the deploy runner's labels are | Read by |
|---|---|---|
| `/opt/forgejo-runner-deploy/data/runner/.runner` (on disk) | **four**: `deploy-dev-preprod`, `dev`, `preprod`, `deploy` | Story 5.2 (`:71` row q), `sprint-change-proposal-2026-08-11-deploy-runner.md:46`, D10 |
| the runner's own `config.yml` `labels:` section | **one**: `deploy-dev-preprod` | Story 4.8, Task 1.6 |
| Postgres `select agent_labels from action_runner where name='s1-deploy-dev-preprod'` | **one**: `["deploy-dev-preprod"]` | Story 4.8, Task 1.6 |

`agent_labels` is the **server-side table the scheduler matches `runs-on` against.** D10 records the
conflict honestly and refuses to resolve it: *"какой источник авторитетен, **не проверено**"*. Under
4.8's measurement a job with `runs-on: preprod` would **never be picked up** — and this instance's
failure mode for an unmatched label is **silent queueing**, not an error. `deploy-dev-preprod` is
the only value present in all three sources, the only one with live dispatch evidence (run 917;
runs 1132–1138 all landed on `runner_id=14`), and it is already in production use by two workflows
(`deploy-dev.yml:75`, `dev-reset.yml:166`). Same runner, same job image either way — so the pretty
label buys nothing and risks a silent hang.

⚠️ **Task 2.3 settles this by query rather than by argument** — one read-only `psql` line, zero
dispatches. If `agent_labels` now shows four, record that the conflict resolved and say so; the
choice does not change either way, because `deploy-dev-preprod` is in every list.

🔴 **This story does not fix `deploy-stand.yml:216`.** See §12 and Dev Notes §9 row 3.

### 5. Which image tag, and the tag census that must happen before dispatch 1

`sha-<12hex>-preprod` tags are **permanent by design** — `build.yml:962`'s `keep_pattern` protects
`sha-[0-9a-f]{7,64}-(pre)?prod`, protected means protected at any age, and removal *"costs an
authorised DELETE plus a `write:package` token, which on this project has twice required the
operator in person."* They are also **immutable**: `build.yml:1477-1496` refuses to repoint an
existing `sha-<12>-<env>` tag (Story 3.6 AC2).

🔴 **This story mints no new permanent tag.** *Autonomous, subject to Oleg's veto.* An existing one
is available and proven:

| Tag | Provenance | Status |
|---|---|---|
| **`sha-00ef3be4743d-preprod`** | run 680, 2026-08-17, a `preprod` build of **`main`**; bundle layer extracted and shown to carry the real PRE-PROD URLs (`deferred-work.md:2067-2088`); pulled and deployed by 5.2 | 🟢 **use this** |
| `main-preprod` | **same run 680, therefore the same digest** — useless as a *different* image, and a 14-day tag besides | ⚠️ not a second candidate |
| `probe-3-3-preprod-preprod` | an old Story 3.3 probe build; a genuinely different digest | 🟡 see §6 — a *pre-state*, never a deploy target |
| ~~`sha-f8f358f43ced-preprod`~~ | run 593, pushed from a probe branch — **deleted by Oleg 2026-08-16** (`epic-3-retro-2026-08-18.md:12-14`, version id `3187 verified gone`) | 🔴 **does not exist. Do not offer it.** |

There is **no automatic path that builds preprod**: `build-main.yml:60-72` and `ci.yml:498-505` both
pass `environment: dev` as a hard literal, deliberately (`build-main.yml:28-37`). A `-preprod` image
can only come from a human `workflow_dispatch` of `build.yml` with `environment: preprod`. **If
Task 2.5's census finds `sha-00ef3be4743d-preprod` gone, that is a blocker for Oleg, not a
contingency this story spends autonomously** — minting is irreversible and the tag census is
therefore a gate, not a formality.

### 6. 🔴 Designing a green row that could have been red

A deploy that puts the image the stand is *already running* back onto the stand is a guard that
cannot fail on the axis that matters. The stand runs `sha-00ef3be4743d-preprod` today (§2 h). A
dispatch of that same tag would recreate the container and report success **whether or not the
image_tag resolution path did anything at all**.

**So the green row is staged.** *Autonomous, subject to Oleg's veto.*

1. **Pre-step (host-side, zero runs, Task 4):** put the stand on a *different* image —
   `probe-3-3-preprod-preprod` — by hand, from the stand directory, and record its digest. This is
   deliberately a **wrong** image for PRE-PROD; that is the point.
2. **Dispatch 1 (Task 5):** deploy `sha-00ef3be4743d-preprod` through `deploy-preprod.yml`.
3. **The discriminator** is then `.RepoDigests[0]` on the running container moving from the probe
   digest to `sha256:5e5b190d93c8aaec50f0d50c7e108f502c3d366d14f8a13aee081f0ee396dc8c` — a value
   that **could not** have been produced by a no-op, and which the callee's own AC6 step
   (`:2056-2100`) independently asserts inside the run.

⚠️ **Failure containment for the pre-step, stated before it is taken:** if dispatch 1 fails *after*
`down`, the callee's own restore path (`:2236-2288`, `if: failure() && compose_down.outcome ==
'success'`) puts the **probe** image back — the stand ends up on a wrong-but-serving image, not
down. If dispatch 1 fails *before* `down` (401, 404, lock, clone) the stand is untouched and still
on the probe image. **Either way the recovery is one command from the stand directory** and Task 5.6
performs it explicitly rather than leaving it to the next reader.

**Fallback if the probe tag is absent or unusable (Task 4.4):** skip the pre-step, deploy the same
tag onto itself, and take the weaker discriminators — the container `.Id` and `.State.StartedAt`
changing, plus the callee's own in-run digest assertion. **Record which of the two shapes was
used.** Do not claim the strong discriminator while running the weak one; that is the exact failure
D34 §3 and 5.2's H2 were both about.

### 7. `expect_unrouted_api` — the value is decided; what it *proves* is the honest part

`"false"` is set by D33 and named in the epic's own amended AC3 clause. **This story sets it and
does not revisit it.** But it must be handed forward in its real shape, not a flattered one. 5.2's
§9 item 4, and D34 §6 behind it:

> D34 §6 says the corrected in-network measurement *"не опровергает `expect_unrouted_api: "false"`
> (D33), но и не подтверждает заявленное обоснование «PRE-PROD's Kong роутит реальные сервисы»
> буквально для `/api/`"* — PRE-PROD's Kong returned the same `404 no Route matched` DEV gives.
> **Not refuted is not settled.** `"false"` only *relaxes* the guard, so it is safe either way; the
> *rationale* written into `deploy-stand.yml:158` is what has not been confirmed.

Measured on the real guard path (`Host: crm.preprod.crm-prionex.online`, `2026-08-23T19:36:04Z`,
and again from inside the stand at `2026-08-23T22:14:58Z`):

```
HTTP/1.1 404 Not Found
vary: Origin
Access-Control-Allow-Origin: http://localhost:8320
X-Kong-Response-Latency: 0
{ "message":"no Route matched with those values" }
```

**So `"true"` would also pass today.** The right choice is still `"false"`, for a reason that has
nothing to do with what is true this week: the moment `CRM/api-prionex` configures a real `/api/`
route — the desired end state — `"true"` starts failing **every** PRE-PROD deploy for a reason that
has nothing to do with the deploy. `deploy-stand.yml:2141-2145` names this as a live review concern
about the DEV side. `"false"` is the value that survives the fix.

🔴 **What the Kong guard proves on this stand, with `"false"`, stated exactly (AC6):**

| It proves | It does **not** prove |
|---|---|
| the container is running and `exec`-able (`:2120-2127`) | that `/api/` is routed to anything |
| `crm-kong-gateway` resolves **inside this stand's container** (`:2128-2136`) | that the Kong answering is PRE-PROD's rather than DEV's — that is 5.2's AC5 identity check, not this guard |
| `GET /api/` through the stand's own nginx returned a real HTTP status, not a transport failure (`:2159-2171`) | that a browser can call the API — **CORS is broken and this check does not exercise it** |
| — | that the bundle's URLs are right — that was 5.2 Task 5, and this story deploys the same image |

⚠️ **Task 5.5 costs nothing and closes an open question**: the guard's own log line prints the
observed `RESP_CODE`. Record it. If it is still `404`, that is a third measurement of
`deferred-work.md` finding 8 — *on the guard's own path, from inside a real deploy* — which is
strictly better than either measurement that finding is built on. **Owner of finding 8 is this
story**; this is how it discharges, and the discharge is an observation, not a change.

### 8. Three things this story does **not** depend on, each of which looks like it should

1. **The host registry login on s1.** `deploy-stand.yml` writes its own `DOCKER_CONFIG` into the
   job workspace from `secrets.REGISTRY_USER_RO`/`REGISTRY_TOKEN_RO` (`:993-1037`) and deletes it on
   every path (`:2441`). D28's H4 is the reasoning: `docker pull` authorises from the **client's**
   `config.json`. D36 §6 says it outright: *"Читатель, полагающий, что Story 5.3 зависит от
   хостового логина, будет отлаживать не то, когда тот пропадёт в четвёртый раз."* It has vanished
   twice. **If it vanishes again mid-story, that is not this story's failure and not this story's
   fix.**
2. **OpenBao.** The deploy path never reads it — `grep -c openbao` is 49 in `build.yml`, 0 in
   `deploy-dev.yml`, and both hits in `deploy-stand.yml` are prose. The PRE-PROD URLs were baked
   into the bundle at build time (run 680) and 5.2 verified them **in the artifact**. The
   preprod values in `secret/fe/pre-prod/app` have been real since 2026-08-15 — that fact is
   *recorded, not re-read*, and this story does not need to re-read it either.
3. **A repository checkout on s1.** There is none. The compose file the deploy uses comes from a
   `git fetch` inside the job, authenticated with `github.token` (4.3's precedent, `:1189-1202`) —
   **not** with the registry credential, which is `read:package` and gets
   `403 required scope(s): [read:repository]`.

### 9. The compose file comes from *this branch*, and that is a real consequence

In `image_tag` mode there is no application ref, so the checkout falls back to `github.sha` — **the
commit that dispatched this caller** (`:1209-1227`). Dispatching from `story-5-3/pr-1-context`
before merge is both allowed and intended (4.8 Task 5.1: *"`workflow_dispatch` from a non-default
branch works (measured, run 917), and `uses: ./…` resolves the callee at the caller's own ref, so
the pair travels together. This is what makes the whole matrix earnable before merging."*).

⚠️ **Consequence: the deploy reads `docker-compose.stand.yml` from the story branch.** This story
does not modify that file, so it must be *provably* identical to `main`'s —
`sha256 7f449dacce163fed898b06d3d3d204656b0f485fdbad1827c03c7aac9b1932ec`, the value 5.2 verified on
both ends. **Task 2.6 asserts that hash before dispatch 1**, so a green deploy cannot be silently
green because the compose file was different.

⚠️ **Consequence 2:** after merge, a dispatch from `main` reads `main`'s compose file. Same bytes
today. Say so in the closeout rather than assuming the reader will re-derive it.

### 10. Deviations this story takes from the epic's literal text

| Epic text (`epics.md:2236-2279`) | This story | Forced by |
|---|---|---|
| AC3 *"it acquires the Story 4.4 lock on the PRE-PROD stand directory"* | proven by **contention**, not by the log line saying it acquired | retro-E5: a lock that is never contended is a lock that cannot fail. `hold_lock_seconds` makes contention deterministic on a capacity-1 runner (D30) |
| AC5 (Slack) | **not implemented, not attempted** | Already deferred by the epic itself: *"this clause does not gate Story 5.3 … the deploy must work without it"*. Story 4.5 runs last |
| — | **AC6 added**: what the health and Kong checks can and cannot prove, recorded | §7. Closing with "healthy" and no such sentence is 5.2's own M6 finding, and would hand 5.4 a green light it has not earned |
| — | **AC7 added**: `image_tag` mode's four first-execution paths named and confirmed individually in the run log | §3. Four never-run code paths executing in one dispatch, all inside one green tick, is not evidence — it is one green tick |
| AC4's *"fails before stopping the running container"* | discharged **by the step list** (`down` SKIPPED), not by argument | 4.7/D32's precedent for the same clause on DEV: *"закрыта живьём по факту шагов (`down` подтверждённо SKIPPED), не по аргументу"* |

Each is *autonomous, subject to Oleg's veto*, and each is repeated at the AC it changes.

### 11. Run budget model

retro-D4 (`epic-3-retro-2026-08-18.md:77`): **declare before work; the ledger closes only against a
query re-run after the merge commit lands.** A ledger closed at PR-open is not closed. If the query
cannot be run, close it with the literal word **OPEN** — never a self-reported number.

🔴 **The permanent story-push line (DN4 of Story 4.7's review, standing for every story since):**
*"pushes to the story's own context/work branch" is a repeating, per-push ledger line, priced per
push, not one flat "closeout push"* — each is a real four-job `ci.yml` run. Also standing
(`deferred-work.md:2515-2547`): a story costs **pushes + 1 PR-open run + 1 merge run**. And
`ci.yml` has **no `paths:` filter**, so a documentation-only commit costs a full four-job run; **a
push landing while the PR is already open fires both `push` and `pull_request`, costing two rows.**

**Unlike 5.2, this story dispatches for real.** Five dispatches are planned, and every one is a row.

| Line | Runs |
|---|---|
| Push: context (this file) | 1 |
| Push: dev-story write-up | 1 |
| PR-open run | 1 |
| Push: code-review commit (PR open → two rows) | 2 |
| Push: fix-pass commit (PR open → two rows) | 2 |
| Merge run (`build-main.yml`) | 1 |
| Dispatch 1 — green deploy (Task 5) | 1 |
| Dispatch 2 — absent tag → 404 (Task 6) | 1 |
| Dispatch 3 — `simulate_bad_credential` → 401 (Task 7) | 1 |
| Dispatch 4 — lock holder, `hold_lock_seconds` (Task 8) | 1 |
| Dispatch 5 — contending deploy (Task 8) | 1 |
| **Declared floor** | **13** above baseline |
| 🔴 **Red-round reserve — §3, named not hidden** | **+3** |
| **Declared ceiling** | **16** |

🔴 **A floor, not a ceiling, and this instance has no cancel endpoint** — a dispatch issued by
mistake runs to completion and occupies its row (4.8 `:458`). **Zero-dispatch work is free and is
where the budget is actually defended**: Task 2's whole ladder (label query, tag census, compose
hash, Kong alias, stand-dir precondition, YAML parse) costs **0**, and every one of those is a way
dispatch 1 could have gone red for a reason that had nothing to do with `image_tag` mode.

⚠️ **Dispatch 5 could be merged into dispatch 1** (make the green deploy the contender), saving one
row. **Deliberately not done:** it would couple the story's single strongest row to the lock
fixture's timing, and if the contention window is mistimed the green row is lost along with it.
One row is cheaper than re-earning the green. *Autonomous, subject to Oleg's veto.*

🔴 **No-touch window — this now binds, and it did not bind on 5.2.** The Sunday `dev-reset.yml`
tick is **2026-08-30 02:00 UTC**; the standing rule is **no dispatch and no live lock holder across
01:45–02:30 UTC**, and no `main` merge inside it. This story dispatches five times and deliberately
leaves a lock holder alive for up to 60 seconds. **Check the clock before Task 8.**

### 12. 🔴 Blast radius — Story 4.9 is in flight, and `deploy-stand.yml` is not editable

Story 4.9 (*Cut DEV Over to the New Stand*) is being implemented in parallel on `story-4-9/*`. The
coordinator serializes host-side work between epics; Oleg merges.

**This story must not modify, and must not push any change to:**

- 🔴 **`.forgejo/workflows/deploy-stand.yml` — read-only reference, including its wrong caller
  skeleton at `:216`.** Every edit re-triggers Epic 5 re-earning of the retro-E5 evidence Story 4.8
  paid for across runs 1132–1150, and it is inside 4.9's blast radius. **The corrected label lives
  in `deploy-preprod.yml`, where it executes** — a working file is a better correction than a fixed
  comment. Task 9.3 re-routes the comment fix to Story 6.4 (the next legitimate editor of that
  file), by name.
- `.forgejo/workflows/deploy-dev.yml`, `.forgejo/workflows/dev-reset.yml`, `build.yml`, `ci.yml`
- `README.md`, `docker-compose.server.yml`, `docker-compose.stand.yml`, `.env.stand.example`,
  `nginx.conf`, `Dockerfile.prod`, or any artifact of Story 4.9
- `4-9-cut-dev-over-to-the-new-stand.md`, or any `story-4-9/*` branch
- **the DEV stand on s1** — its directory, its `.env`, its container, its network membership, its
  lock file. NFR5.

🔴 **The one named exception, priced in advance.** If dispatch 1 exposes a **real defect in
`image_tag` mode** — one of §3's four paths genuinely broken, not a caller mistake — this story
**must** fix it, because no other story can: the mode has no other consumer. The cost of that fix
is the re-earning §12 exists to prevent, so it is not taken quietly:

1. State the defect with the failing run id and the exact log line.
2. Name which of 4.8's retro-E5 rows the change invalidates (4.8 Task 6.7's void-clause: *"if the
   diff shows any change inside those blocks beyond a literal→input substitution, the argument is
   void and the row must be dispatched"* — as amended by Oleg to exempt a pure fail-closed
   early-exit that shares no state with the block).
3. Price the re-dispatches in the ledger **before** making the edit.
4. Escalate to Oleg as a blocking Open Question. **Do not edit `deploy-stand.yml` and report it
   afterwards.**

⚠️ **4.9 may change the DEV stand underneath this story.** This story never reads it — but the
**runner is shared and has capacity 1**, so a 4.9 dispatch and one of this story's five will
serialize at the runner. That is not contention this story's lock knows about (the locks are
per-stand, `deferred-work.md:3046`) and it is not a fault. **Timestamp every dispatch in UTC** and
do not diagnose a queued job as a hung one.

---

### Prohibitions

🚨 **A prohibition here cannot be overridden by a subtask.**

1. 🔴 **Never edit `.forgejo/workflows/deploy-stand.yml`** — §12, and its one exception is a
   procedure, not a permission.
2. **Never create a second new workflow file.** The deliverable is exactly one:
   `.forgejo/workflows/deploy-preprod.yml`. A "test workflow" to try the mechanism is the
   anti-pattern 5.2 named and refused; the caller *is* the test.
3. **Never pass `ref` to the callee, and never both.** The callee's own first deploy step
   (`:864-886`) fails closed on both-or-neither, but a caller that can pass `ref` at all is a
   caller that has misread its own AC.
4. **No `${{ }}` inside any `run:` body — not even inside a shell comment.** Forgejo substitutes
   inside comments too (`build.yml:796-799`) and one empty token once rejected an entire workflow
   with no diagnostic. *This story's caller should contain **no `run:` bodies at all*** — if one
   appears, the design went wrong.
5. **Never `${{ }}` in the `concurrency: group:`.** A literal constant. A workflow this instance
   cannot parse fails **before any job exists**, visible only in
   `action_run.pre_execution_error_details` — no job, no log, no API route for it (D21).
6. **Never put an `if:` on the caller's `uses:` job**, and never `${{ github.ref_name }}` in its
   `with:`. Both are D21 traps measured live: the `if:` is copied *down* into the callee and
   re-evaluated there with `github.event_name = workflow_call`; `ref_name` arrives **empty**
   (run 632).
7. **Never copy DEV's concurrency group.** `deploy-preprod.yml` gets its own literal keyed on its
   own stand (D30). Sharing DEV's group would serialize two independent stands and hide it.
8. **Never `docker network create`, `rm`, `connect` or `disconnect`.** `crm-preprod-network` belongs
   to `CRM/api-prionex` and carries 69 of their containers. The callee refuses to create it
   (`:1845`) and asserts afterwards that it did not.
9. **Never `docker rm -f` by name.** Rollback is `docker compose --env-file .env -f
   docker-compose.stand.yml down` from the stand directory. s1 carries ~170 containers including
   another tenant's entire DEV and PRE-PROD stacks.
10. **Do not restart, stop, recreate or `down` anything that is not this story's own container** —
    most especially not `crm-preprod-kong-gateway`, and not the DEV stand.
11. **Never mint a `-preprod` image.** §5. It is a permanent, irreversible registry write. If no
    usable tag exists, that is a **blocking** Open Question for Oleg.
12. **Never `cat /root/.docker/config.json`.** Its `auths.*.auth` field is `base64(user:token)`,
    trivially reversible — this is exactly how Story 5.2 leaked its second token. Confirm a login
    by reading **keys only**:
    `python3 -c "import json; print(list(json.load(open('/root/.docker/config.json'))['auths'].keys()))"`.
    Never echo a token file; `--password-stdin < file` always.
13. **Never reach OpenBao through `/usr/local/bin/bao`.** It is a world-readable wrapper that
    silently authenticates as `admin` and once turned nine isolation checks into nine false
    positives. This story has no reason to touch OpenBao at all (§8).
14. **Never claim a discriminator that could not have failed.** If the strong form of a check was
    not available, run the weak one and **say which**. This project has now rejected the same
    vacuity three times (D34 §3, 5.1's review, 5.2's H2).
15. **The dev agent does not touch the Forgejo API and does not open the PR.** The coordinator
    dispatches, queries run ids, and closes the ledger; Oleg merges. Mark Task 10.6 `PENDING
    (owner: coordinator)` rather than checking it.
16. **`deferred-work.md`:** append at EOF; closures go **under the original** with the old text
    struck (`~~…~~`) and never deleted. **Owners are names or story numbers, never trigger
    conditions.**

---

## Acceptance Criteria

Verbatim from `_bmad-output/planning-artifacts/epics.md:2236-2279`, with this story's reading where
measurement has overtaken the plan. Every reading is *autonomous, subject to Oleg's veto*, and each
is also listed in §10 and Dev Notes §9.

### AC1 — triggers

> **Given** `.forgejo/workflows/deploy-preprod.yml`
> **When** its triggers are configured
> **Then** `workflow_dispatch` is the only trigger
> **And** no `push`, `schedule` or tag trigger exists.

> 🔴 **Reading — proven by the file's own parsed `on:` block, not by eye.** Discharge with
> `python3 -c "import yaml,sys; print(yaml.safe_load(open(...))['on'])"` and paste the output. A
> visual scan of a 90-line file for an absent key is not evidence that the key is absent — and
> `on` parses to the boolean `True` in YAML 1.1 if it is ever unquoted, which is its own trap.

### AC2 — `image_tag` is required, and absence is a rejection

> **Given** the dispatch form
> **When** it is presented
> **Then** `image_tag` is a required input
> **And** a dispatch without it is rejected rather than defaulting to anything.

> 🔴 **Reading — this is a *caller-side* property and cannot be delegated to the callee.** The
> callee's `image_tag` must stay `required: false` (it is mutually exclusive with `ref`, and
> `required:` cannot express "exactly one of two") — 4.8's Task 9.1 walked exactly this and found
> no gap. So `required: true` lives on `deploy-preprod.yml`'s own `workflow_dispatch` input, and
> the callee's exactly-one guard (`:864-886`) remains the backstop against a caller bug.
>
> 🔴 **The "rejected" half is discharged by the API's own refusal and costs zero runs**: a dispatch
> missing a required input returns **HTTP 400 and consumes no `action_run` row** (the fact
> `deploy-dev.yml:18-20` is built on). Record the status code and the ledger's unchanged
> `max(id)` on either side of it. **This is the cheapest discriminating row in the story — do not
> skip it because it is free.**

### AC3 — it consumes the shared definition, and it takes the lock

> **Given** a dispatch with a valid `image_tag`
> **When** the deploy runs
> **Then** it consumes the shared deploy definition from Story 4.8 rather than copying its
> steps — compose placement, `down`, fail-fast pull, `up -d`, parameterized health check —
> running on the deploy runner located on s1
> **And** it acquires the Story 4.4 lock on the PRE-PROD stand directory.
> ⚠️ **AMENDED 2026-08-22 (Story 4.8):** the shared callee's Kong guard defaults to
> `expect_unrouted_api: true` (DEV's own behaviour). PRE-PROD's Kong routes real services — this
> caller must set `expect_unrouted_api: "false"` in its own `with:` block, or every deploy fails
> the Kong guard for a reason that has nothing to do with the deploy itself.

> 🔴 **Reading, four parts.**
>
> **(i) "Consumes rather than copies"** is proven structurally: the caller contains **zero `run:`
> bodies** and exactly one `uses: ./.forgejo/workflows/deploy-stand.yml`. Assert it mechanically
> (Task 3.5), not by reading.
>
> **(ii) "On the deploy runner"** is `runner_label: deploy-dev-preprod` — §4, and settled by query
> in Task 2.3 before any dispatch. **Confirm `runner_id=14` on the run's own jobs afterwards**;
> R1 (`runs-on: ${{ inputs.runner_label }}`) is the input-in-`runs-on` mechanism, proven for DEV
> and being re-exercised here from a new caller.
>
> **(iii) The whole green ladder** — `down`, digest-pinned pull before anything is torn down,
> `up -d`, health poll, anchored project assert, AC6 digest match, Kong guard — runs as the
> callee's own ~25 steps. Read the **verdict from the job/step list and the DB, never from a log
> line** (4.8's Task 6 convention).
>
> **(iv) 🔴 The lock is proven by CONTENTION, not by its own success message.** §10. A lock that is
> never contended is a lock that cannot fail, and on a **capacity-1** runner two deploy *jobs* can
> never overlap — so a naive "dispatch twice" test queues at the runner and produces a false
> positive indistinguishable from success. `hold_lock_seconds` moves the contention out of the job
> and into a detached holder container that **outlives** its own dispatch (D30, the same fixture
> 4.4 built for exactly this reason). Tasks 8.2–8.4.
>
> **(v)** `expect_unrouted_api: "false"` — set as a **quoted string**. The callee fails closed on
> anything but exact lowercase `true`/`false` (`:2184-2191`); an unquoted YAML `false` that
> renders as `False` would abort the guard.

### AC4 — an absent tag fails before the stand is touched

> **Given** an `image_tag` that does not exist in the registry
> **When** the deploy runs
> **Then** it fails before stopping the running container
> **And** PRE-PROD keeps serving the previous candidate.

> 🔴 **Reading — discharged by the step list, not by argument.** The digest-resolve step
> (`:1039-1157`) classifies `404` and exits **before** `docker pull` and long before `down`. The
> binding evidence is that the run's own step list shows **`docker compose down` SKIPPED** — the
> form D32 used to close the identical clause on DEV (*"по факту шагов … не по аргументу"*).
>
> ⚠️ **The tag must be absent but SHAPE-VALID**, or the run fails one step earlier in the tag
> validator (`:915-928`) and proves something else entirely. Use
> **`sha-000000000000-preprod`** — twelve legal hex characters, correct suffix, and
> `keep_pattern`-shaped, so it also cannot be confused with a retention deletion.
>
> ⚠️ **Confirm the 404 message names the right cause for this environment.** `:1125-1142` branches
> on `IMAGE_ENV`: for `preprod` it must say the 14-day retention rule *"only applies to `-dev`
> tags"*. A `-dev` retention story printed to a PRE-PROD operator is a real defect, and this is its
> first live rendering.
>
> ⚠️ **"Keeps serving the previous candidate"** is checked on the host, not inferred: the container
> `.Id`, `.State.StartedAt` and `.RepoDigests[0]` are **unchanged** across the failed run, and
> `https://crm.preprod.crm-prionex.online/` still answers `200`.

### AC5 — Slack: deliberately absent

> **Given** a successful deploy
> **When** Slack is notified using the Story 4.5 mechanics
> **Then** the message names PRE-PROD and the deployed `image_tag`.
> ⚠️ **DEFERRED 2026-08-14 — this clause does not gate Story 5.3.** Story 4.5 now runs last and its
> channel does not exist yet. **The deploy must work without it**: this story closes on a proven
> deploy with no notification step, and 4.5 adds the step afterwards.

> 🔴 **Reading: not implemented and not attempted.** The AC is discharged by its own deferral. What
> this story owes is that the absence is a **decision on the record**, not an omission — Task 9.2
> writes one line into `deferred-work.md` naming Story 4.5 as owner and `deploy-preprod.yml` as a
> second file it will have to touch.

### AC6 — 🔴 ADDED: what the checks prove, and what they do not

> **Given** a green deploy on a stand whose backend CORS is known-broken
> **When** the health check, the fallback HTTP check and the Kong guard all pass
> **Then** the story records explicitly which claims those three checks support and which they do
> not
> **And** it states that browser-path validation is impossible until `CRM/api-prionex` fixes the
> static `Access-Control-Allow-Origin`.

> **Why added, and why in this exact form.** §7's table is the content. Three of this project's
> own findings converge here: 5.2's **M6** (*"Task 7.7's required 'healthy proves nothing' sentence
> absent while `healthy` is reported as an achievement in three artifacts"*), 5.1's finding that
> the healthcheck probes `http://127.0.0.1:80` — *itself* — and reports `healthy` on a
> backend-less network, and 5.2's **M22** (*"a routed response's CORS behaviour was never
> measured"*). Story 5.4 records a *validated* candidate on the strength of what this story
> reports. **A green tick handed forward without this sentence is the failure mode Epic 5's own
> preamble names**: *configured wrong is worse than unconfigured — it looks done and fails only in
> a browser.*
>
> ⚠️ **Scope, so this AC does not quietly become 5.5's job:** this is one honest paragraph plus
> §7's table, written from evidence this story already produces. It is **not** a new measurement
> campaign, it is **not** a CORS fix, and it does not block on `CRM/api-prionex`.

### AC7 — 🔴 ADDED: `image_tag` mode's first execution is confirmed path by path

> **Given** that `image_tag` mode has never executed anywhere
> **When** the first successful dispatch completes
> **Then** each of its four first-execution paths is confirmed **individually** from that run's own
> log, by the message the path prints
> **And** any that did not behave as the code predicts is raised as a blocking Open Question rather
> than absorbed into a green result.

> **Why added.** §3. Four never-run code paths executing inside one green tick is one green tick,
> not four confirmations — and the whole reason 4.8 routed this here is that reading was not
> considered sufficient. Each path prints a distinctive line, so this costs **zero extra runs**:
>
> | # | Path | The line to find (`deploy-stand.yml`) |
> |---|---|---|
> | 1 | `clone-test`'s `github.sha` fallback | `No ref supplied (image_tag mode) — validating the CALLER's own commit` (`:653`) |
> | 2 | compose checkout `IMAGE_TAG_MODE=1` | `No ref supplied (image_tag mode) — obtaining docker-compose.stand.yml from the caller's own commit` (`:1223`) |
> | 3 | revision cross-check skipped, not failed | `SKIPPED: image_tag mode — no application ref to cross-check` (`:1299`) |
> | 4 | tag used directly, sanitizer bypassed | `Using the supplied image_tag directly: '<tag>' — no ref-derivation needed.` (`:932`) |
> | 5 | `expect_unrouted_api=false` permissive branch | `OK: crm-kong-gateway resolves and returned a real HTTP <code> (expect_unrouted_api=false …)` (`:2204`) |
>
> ⚠️ Path 3's absence is as important as its presence: if the run instead shows the revision
> **compared**, blocker (b) is back and every future `image_tag` deploy will fail as a *"mismatched
> pair"*.

---

## Tasks / Subtasks

### Task 1 — Open the story (AC: all)

- [x] 1.1 Flip `sprint-status.yaml`: `5-3-deploy-a-specific-image-tag-to-pre-prod` → `in-progress`,
      and **push that commit on its own**, before any substantive change. 🔴 This is 5.2's H1
      lesson: it is *"the only one of the 58 checkboxes independently falsifiable from this
      repository, and it fails"* when swept into a later commit. Do not check this box until
      `git log -p` on the file shows the transition as its own commit.
- [x] 1.2 Take the ledger baseline, **repo-scoped**, before any work:
      `ssh root@10.67.0.1 'docker exec forgejo-postgres psql -U forgejo -d forgejo -tAc "select max(id), count(*), now() at time zone '"'"'utc'"'"' from action_run where repo_id=16"'`
      Confirm `repo_id=16` is `CRM/fe-prionex` yourself. Record the instance-wide form too, and
      **say which is which**. Expect `max(id) ≥ 1177`.
- [x] 1.3 Restate §11's budget as this story's declared floor (**13**) and ceiling (**16**),
      naming the red-round reserve as a reserve. Ledger disposition starts at **OPEN**.
- [x] 1.4 Record the `dev-reset.yml` no-touch window (**2026-08-30 01:45–02:30 UTC**) and confirm
      the planned dispatch session falls outside it. §11.

### Task 2 — Zero-dispatch preconditions: close every non-`image_tag` failure mode first (AC: 3)

🔴 **Nothing in this task dispatches anything. Every item is a read.** Its purpose is that if
dispatch 1 goes red, `image_tag` mode is the only remaining suspect.

- [x] 2.1 Confirm SSH rung 1 (`ssh root@10.67.0.1`) and timestamp it. External `:22` timing out is
      expected, not a fault (D28 §6).
- [x] 2.2 Re-confirm §2 (a) and (b): the stand directory exists **and contains**
      `docker-compose.stand.yml`. 🔴 This is the assertion the callee makes at `:1473-1481`,
      through a bind-mounted sibling container, **before it will take the lock** — and it is the
      one that fires on the real deploy path. (`:334-342` is the same assertion inside the
      `hold-lock` fixture job, reachable only via `hold_lock_seconds`. **Exactly one fires per
      path; "twice" is not the claim** — 5.2's M17.) Record the host's own `sha256sum` of that
      file.
- [x] 2.3 🔴 **Settle the runner label by query**, §4:
      `select id, name, agent_labels from action_runner where name='s1-deploy-dev-preprod';`
      Record the result verbatim. Whatever it returns, the value used is **`deploy-dev-preprod`**;
      if it now shows four labels, record that the `.runner`-vs-`agent_labels` conflict resolved,
      and route that as a closure — it does not change the choice.
- [x] 2.4 Re-confirm the runner is capacity 1 and that its `container.options` still carry
      `--add-host=git.crm-prionex.com:10.70.0.1` (the clone in the job depends on it) and
      `/var/run/docker.sock`. Note that `/root/crm-prionex/*` is **not** in `valid_volumes` — the
      job reaches the stand only through sibling containers (D28 §4).
- [x] 2.5 🔴 **Tag census.** `GET /v2/crm/fe-prionex/tags/list` (or the package API) and **paste
      the response**, not a characterisation of it — 5.2's M1 and 4.2's M3 are the same finding
      twice. Confirm `sha-00ef3be4743d-preprod` is present and resolve its digest. If it is
      **absent**, stop: Prohibition 11, blocking Open Question for Oleg.
- [x] 2.6 Assert the compose file on **this branch** hashes to
      `7f449dacce163fed898b06d3d3d204656b0f485fdbad1827c03c7aac9b1932ec`, and that
      `git diff origin/main -- docker-compose.stand.yml` is empty. §9.
- [x] 2.7 Re-confirm the `crm-kong-gateway` alias exists on `crm-preprod-network`. 4.8 routed this
      here by name: *"`crm-kong-gateway` staying hardcoded … Story 5.3 confirms the alias before
      its first dispatch"*. Read it from the network's own `.Containers[]`/alias data, and from
      inside the running stand container (`getent hosts crm-kong-gateway`) — the second is what the
      guard actually does.
- [x] 2.8 Record the stand's current state as the "before" row: `.Id`, `.State.StartedAt`,
      `.RepoDigests[0]`, `.State.Health.Status`, and `curl -si https://crm.preprod.crm-prionex.online/`
      status. 🔴 Use `.RepoDigests`, **not** `.Image` — `.Image` is the config digest and does not
      match the registry's `Docker-Content-Digest` (5.2's L1).

### Task 3 — Write `.forgejo/workflows/deploy-preprod.yml` (AC: 1, 2, 3)

- [x] 3.1 Create the file from `deploy-dev.yml`'s **shape** (the proven live caller) and
      `deploy-stand.yml:189-232`'s **content**, correcting the skeleton's label per §4. Target
      shape:
      - `name: Deploy PRE-PROD Stand` — a literal, permanent, and chosen now because any future
        read-back will grep for it. 🔴 Re-derive rather than inherit: `deploy-dev.yml`'s three
        naming invariants exist because `dev-reset.yml` dispatches it by file name and greps its
        run list by workflow name. **Nothing dispatches or reads back `deploy-preprod.yml` today**
        — say that explicitly in the file's header instead of copying DEV's warning as though it
        applied.
      - `on: workflow_dispatch:` only — one input, `image_tag`, `required: true`, `type: string`.
      - `concurrency: group: deploy-preprod-fe-prionex-preprod` (**literal**),
        `cancel-in-progress: false`.
      - one job, `uses: ./.forgejo/workflows/deploy-stand.yml`, `secrets: inherit`, `with:` the
        eight required inputs plus `image_tag`, `expect_unrouted_api: "false"`, and the three
        tuning constants passed explicitly at their DEV values (mirroring `deploy-dev.yml:83-85`,
        so the file states what it runs on rather than inheriting silently).
- [x] 3.2 🔴 Forward the two permanent regression hooks as **dispatch inputs of this caller**,
      byte-for-byte in DEV's shapes (`simulate_bad_credential`, `type: boolean`, default `false`;
      `hold_lock_seconds`, `type: number`, default `0`), and pass them through in `with:`. The
      skeleton omits both. **This is a deliberate addition** — *autonomous, subject to Oleg's
      veto*. Without them, AC4's 401 row and AC3(iv)'s lock row have no cheap discriminating form
      at all, and Prohibition 9 of Story 4.8 (*"they move into the shared definition, they do not
      disappear"*) applies to consumers as much as to the callee. Copy DEV's own safety paragraphs
      for both into this file's header.
- [x] 3.3 Header comments state, in this order: what the file is (a thin caller), why the label is
      `deploy-dev-preprod` and not the skeleton's value (§4, one sentence + the pointer), why the
      concurrency group is a literal and lives here (D21/D30), that `secrets: inherit` is
      all-or-nothing, and that `image_tag` mode's first live execution is this file's dispatch.
- [x] 3.4 Mechanical checks, all zero-dispatch: `yaml.safe_load` parses; `on` is a mapping with
      exactly the key `workflow_dispatch`; no `push`/`schedule`; a substring scan finds **no**
      `${{` inside any `run:` body (there should be no `run:` bodies at all); the `concurrency:`
      group is a literal with no `${{`; no `if:` on the `uses:` job; no `github.ref_name` anywhere.
- [x] 3.5 Assert "consumes rather than copies" mechanically: count `run:` bodies (expect **0**) and
      `uses:` (expect **1**). Paste the counts.
- [x] 3.6 `git diff origin/main --name-only` shows exactly the files §12/Project Structure Notes
      declares — and **not** `deploy-stand.yml`. Prohibition 1 verified by diff, not by intention.

### Task 4 — Stage the discriminator (AC: 3) — host-side, zero runs

- [x] 4.1 Resolve `probe-3-3-preprod-preprod`'s digest from the registry and confirm it differs
      from `sha256:5e5b190d93c8…dc8c`. If it does not exist or does not differ, go to 4.4.
- [x] 4.2 From `/root/crm-prionex/fe-prionex-preprod/`, point the stand at the probe image and
      bring it up: edit `DOCKER_IMAGE` in the stand `.env` to the probe **digest** form, then
      `docker compose --env-file .env -f docker-compose.stand.yml up -d`. 🔴 Never `docker rm -f`
      (Prohibition 9).
- [x] 4.3 Record the "pre-state" row: `.Id`, `.State.StartedAt`, `.RepoDigests[0]`, health. Confirm
      `https://crm.preprod.crm-prionex.online/` still answers (the stand is deliberately on a wrong
      image, but it must be *serving* — otherwise dispatch 1's green proves less, not more).
- [x] 4.4 **Fallback path**, if 4.1 fails: skip the pre-step entirely and record that dispatch 1's
      discriminators are the weaker set (`.Id` and `.State.StartedAt` change; the callee's own AC6
      digest assertion is the in-run check). §6, Prohibition 14 — **name which shape was used.**
- [x] 4.5 Restore the stand `.env`'s `DOCKER_IMAGE` to the intended
      `…:sha-00ef3be4743d-preprod` **after** dispatch 1 succeeds. The file is record/DR only and
      nothing on the deploy path reads it — but leaving it naming a probe image is exactly the
      "two sources of truth" drift `deferred-work.md:2887-2895` already carries as an open item,
      and 5.2 measured that drift live on DEV.

### Task 5 — Dispatch 1: the green deploy (AC: 3, 6, 7)

- [x] 5.1 Dispatch `deploy-preprod.yml` from **`story-5-3/pr-1-context`** with
      `image_tag=sha-00ef3be4743d-preprod`. §9 — the compose file will come from this branch's own
      commit; Task 2.6 already proved those bytes. Record the run id and the UTC dispatch time.
      **Coordinator dispatches** (Prohibition 15).
- [x] 5.2 🔴 Confirm the **concurrency block survived `workflow_call` expansion**: read
      `concurrency_group` and `concurrency_type` from `action_run` for this caller's own run.
      `type=1` **and** the literal `deploy-preprod-fe-prionex-preprod` means the guard is real;
      `type=0` means the file claims protection it does not have (D21, and `deploy-stand.yml:35`
      makes this check mandatory after a first dispatch).
- [x] 5.3 Confirm every job landed on `runner_id=14` and that `runs-on: ${{ inputs.runner_label }}`
      resolved (R1 re-exercised from a new caller).
- [ ] 5.4 **PENDING — not archival-blocked forever, just not yet.** Line 1 confirmed (Debug Log
      References). Lines 2-5 are in job 10340's own log (task 9745), not yet flushed to disk
      storage as of this write-up; will be pulled via SSH once `log_in_storage` flips true. 🔴 **AC7: find all five lines** from the table, individually, in this run's log, and paste
      each. A missing line — especially #3 — is a blocking finding, not a curiosity.
- [ ] 5.5 **PENDING, same reason as 5.4** — the Kong-guard `RESP_CODE` line is in the same
      not-yet-archived log. 🔴 **AC6 datum:** record the Kong guard's own printed `RESP_CODE` and whether the body
      still carried `no Route matched`. This is the third measurement of `deferred-work.md`
      finding 8, taken on the guard's own path from inside a real deploy — **this story owns that
      finding and this is how it discharges.** §7.
- [x] 5.6 Confirm the stand moved: `.RepoDigests[0]` is now
      `sha256:5e5b190d93c8aaec50f0d50c7e108f502c3d366d14f8a13aee081f0ee396dc8c`, `.Id` and
      `.State.StartedAt` changed from Task 4.3's row, health is `healthy`, and
      `https://crm.preprod.crm-prionex.online/` answers `200`. Then do Task 4.5.
- [x] 5.7 Record the run's wall clock and step count, for 5.4/6.4 to budget against.
- [ ] 5.8 **N/A — dispatch 1 was green on the first try.** Condition never triggered. ⚠️ **If this dispatch is red:** classify before re-dispatching. A caller mistake is
      fixed and re-dispatched from the red-round reserve. A genuine `image_tag`-mode defect
      triggers §12's exception procedure — **escalate, do not edit `deploy-stand.yml`.**

### Task 6 — Dispatch 2: the absent tag (AC: 4)

- [x] 6.1 Dispatch with `image_tag=sha-000000000000-preprod`. Expect **failure**.
- [ ] 6.2 **NOT MET on the first dispatch — this is the §12 defect.** The step crashed
      (`IMAGE_ENV: unbound variable`) before it could print any classified message at all, `preprod`
      branch or otherwise. Root-caused, fixed (one line, `deploy-stand.yml:1041-1045`), local
      force-tested for both `IMAGE_ENV` values (§12 record above), authorized by Oleg. **Closes on
      the coordinator's re-dispatch of this row**, not on this first attempt — left unchecked
      honestly rather than checked on the strength of the fix alone. Confirm the failure is the digest-resolve step's `404` classifier, and that its message
      carries the **`preprod` branch** of the retention note, not the `-dev` one (`:1130-1138`).
      Paste the literal message.
- [x] 6.3 🔴 Confirm from the **step list** that `docker compose down` is **SKIPPED**, along with
      everything after it. This — not an argument about ordering — is AC4's evidence.
- [x] 6.4 Confirm the stand is untouched: `.Id`, `.State.StartedAt` and `.RepoDigests[0]` identical
      to Task 5.6's row, and the site still answers `200`.
- [x] 6.5 Confirm the lock was **not** left held: no `fe-prionex-preprod-deploy-lock-*` container
      is running, and `.deploy.lock` is unlocked. (The 404 fires *before* the acquire step, so the
      expected answer is that the lock was never taken at all — record which of the two it is.)

### Task 7 — Dispatch 3: the 401 (AC: 4, retro-E5)

- [x] 7.1 Dispatch with `image_tag=sha-00ef3be4743d-preprod` **and**
      `simulate_bad_credential=true`. Expect **failure**.
- [x] 7.2 Confirm the `401` classifier fired and that its message carries the literal
      `[SIMULATED via simulate_bad_credential=true — NOT a real credential outage]` marker
      (`:1082`) — the marker exists precisely so a log excerpt is never mistaken for a real outage.
- [x] 7.3 Confirm the message distinguishes the cause correctly: *"the deploy job's OWN registry
      credential … is missing, wrong, or revoked — **NOT** that the image is missing."*
- [x] 7.4 Confirm `down` SKIPPED and the stand untouched, as in 6.3/6.4.
- [x] 7.5 🔴 Confirm the **real** org secret was not disturbed: the *next* dispatch (Task 8.4)
      resolves a digest normally. The simulation corrupts only this step's local copy, deliberately
      **after** login — but "deliberately" is a code reading, and the next green resolve is the
      measurement.

### Task 8 — Dispatches 4 & 5: the lock, under real contention (AC: 3)

- [x] 8.1 🔴 Check the no-touch window first (Task 1.4). This task deliberately leaves a lock
      holder alive.
- [x] 8.2 Dispatch 4 with `hold_lock_seconds=60`. Expect the `hold-lock` **fixture** job to run and
      `preflight`/`clone-test`/`digest-resolve-test`/`deploy` to be **SKIPPED** — the gate is
      `if: ${{ !(inputs.hold_lock_seconds > 0) }}` on `preflight` alone, cascading through `needs:`
      (`:494-500`). Confirm that cascade in the job list; it is what keeps a fixture dispatch cheap.
- [x] 8.3 Confirm the holder container `fe-prionex-preprod-deploy-lock-<run id>` is **running on
      the host** after its own job has finished — that outliving is the whole mechanism. Record its
      name and the `.deploy.lock` path it holds. Confirm the name derives from
      `compose_project_name`, per `:1457`.
- [ ] 8.4 **Substantively confirmed via DB timestamps (31s real wait, Debug Log References), literal
      log lines PENDING archival — same gap as 5.4/5.5.** 🔴 **Immediately** dispatch 5: a normal deploy of `sha-00ef3be4743d-preprod`. Expect the
      acquire step to **poll, report waiting, and then succeed** once the holder's 60s elapse —
      not to fail. Paste the acquire step's own waiting/acquired lines with their timestamps.
- [x] 8.5 Confirm the deploy completed green afterwards and the stand is on the expected digest.
- [x] 8.6 Confirm the lock was released: the release step ran (`if: always()`), no holder container
      remains. ⚠️ Note in the record that `always()` does **not** survive a cancel or a hard
      `timeout-minutes` kill — TTL expiry (720s) is the only reliable release for a dead job
      (`:2395`). This is a property, not a finding.
- [ ] 8.7 **N/A — dispatch 5 acquired successfully.** Condition never triggered. ⚠️ **If dispatch 5 instead fails to acquire**, record `lock_wait_seconds=240` vs the 60s
      hold and diagnose honestly: a 60s hold inside a 240s wait must succeed, so a failure here is
      a real defect in the lock's first exercise on a second stand.

### Task 9 — Record, route, decide (AC: 5, 6)

- [ ] 9.1 Write the retro-E5 matrix into Debug Log References: one row per dispatch, columns
      `# | Task | Run id | Inputs | Verdict | The discriminating message`. Read every verdict from
      the job/step list and the DB, **never from a log line alone** (4.8's Task 6 convention).
      Include the zero-run AC2 rejection row (HTTP 400, ledger unchanged).
- [ ] 9.2 `deferred-work.md`, appended at EOF under
      `## Deferred from: story-5-3-deploy-a-specific-image-tag-to-pre-prod (2026-08-…)`:
      - the Slack step, **Owner: Story 4.5**, naming `deploy-preprod.yml` as a file it must touch;
      - `deploy-stand.yml:216`'s wrong label — 🔴 **re-routed, not fixed**, **Owner: Story 6.4**
        (the next story that legitimately edits that file), with §12's reasoning in one sentence;
      - the `.runner`-vs-`agent_labels` conflict (§4) with whatever Task 2.3 measured, **Owner:
        Story 6.4** if unresolved (6.10 must pick an s10 label and will hit it again);
      - **closure** of finding 8 (`expect_unrouted_api`, `deferred-work.md:3541-3557`) under its
        original with the old text struck, carrying Task 5.5's datum. **This story is its owner.**
      - anything dispatch 1 exposed about `image_tag` mode, whether fixed or not.
- [ ] 9.3 `docs/migration-decisions.md`: a new decision record + index row + Change Log row.
      🔴 **Verify the next free number against every open `story-*` branch, not just `main`** —
      `main` stops at D36 and 4.9 holds **D35** on its own unmerged branch (D36 §1). The expected
      value is **D37**, and *"there is a `D23` collision in this project's history precisely because
      someone did not"* check. Record in Russian, per convention; body covers the caller, the label
      decision and its evidence, `image_tag` mode's first live execution path by path, the lock on a
      second stand, and what the Kong guard does and does not prove.
      ⚠️ The file's own header still advertises its anchor range as `#d1 … #d31` while D32–D36
      exist. Bump it to `#d37` in the same edit — one line, and it is the file this story is already
      touching.
- [ ] 9.2a **Route the `CRM/api-prionex` heads-up alongside the CORS ask.** `deferred-work.md`
      carries it escalated and **still unsent, still unowned**: after 5.2, this repository holds
      **two** endpoints on networks `CRM/api-prionex` owns (`crm-dev-network` and their
      69-container `crm-preprod-network`), so a `docker network rm` on their side now trips over
      both. This story adds no third endpoint — but it is the story that makes PRE-PROD a *live
      deploy target*, which is the moment the exposure stops being theoretical. Re-escalate in one
      line naming **Oleg** as owner (the CORS ask is his channel and *"that remains the cheapest
      moment it will ever have"*). Do not contact `CRM/api-prionex` directly.
- [ ] 9.4 Cross-check that no artifact this story writes repeats a fact the project has already
      corrected: `Dockerfile.prod` is **`:55-56`**, not `:34`; the DEV/PREPROD stand-dir assertion
      fires **once** on the real deploy path, not twice; `sha-f8f358f43ced-preprod` is **deleted**,
      not missing; retro-D4/retro-E5 always carry the `retro-` prefix.
- [ ] 9.5 AC6's paragraph, written from §7's table and this story's own evidence.
- [ ] 9.6 `sprint-status.yaml` → `review`, as its own commit (Task 1.1's lesson, applied at the
      other end).

### Task 10 — Close (AC: all)

- [ ] 10.1 Re-run the ledger query and build the attribution table. 🔴 Use 5.1's parallel-era
      method, cited not re-derived (Dev Notes §5): filter to `repo_id=16`; match each row's
      `commit_sha` against this story's own commits **and against `story-4-9/*`'s branch tip,
      fetched fresh**; a row matching neither is **named as unattributable**, never absorbed.
- [ ] 10.2 Reconcile declared vs actual per line; explain every overrun and every underrun.
- [ ] 10.3 Disposition: **OPEN** until the coordinator re-queries after the merge commit lands.
      Never a self-reported number (retro-D4).
- [ ] 10.4 File List, Completion Notes, Change Log.
- [ ] 10.5 Confirm blast radius by diff: `git diff origin/main --name-only` equals the declared
      set, and `deploy-stand.yml` is absent from it.
- [ ] 10.6 PR — mark **`PENDING (owner: coordinator)`**. Prohibition 15; the dev agent does not open
      it, and checking this box without a PR is 5.2's M14.

---

## Dev Notes

### 1. The one-paragraph version

Copy `deploy-dev.yml`'s shape into `deploy-preprod.yml`, change eight values, set
`expect_unrouted_api: "false"`, give it its own literal concurrency group, use
`runner_label: deploy-dev-preprod` (**not** the skeleton's `deploy-preprod-preprod`, which does not
exist), and dispatch it five times to earn a retro-E5 matrix. The file is easy. The dispatch is
not: `image_tag` mode has never run, four of its code paths execute for the first time in dispatch
1, and the budget is sized for that.

### 2. Infrastructure facts

§2's table is the reference. The three that decide whether dispatch 1 can succeed at all:
the stand directory exists **and contains `docker-compose.stand.yml`** (`:1473-1481`);
`crm-kong-gateway` resolves inside the stand's container (`:2128`, hardcoded, no input);
`sha-00ef3be4743d-preprod` still resolves in the registry. All three are Task 2 reads.

### 3. Anti-patterns for this story

- **Writing a probe workflow "just to test the mechanism".** The caller *is* the probe
  (Prohibition 2). 5.2 refused the same temptation and named it.
- **Deploying the tag the stand already runs and calling it green.** §6.
- **Treating one green dispatch as five confirmations.** AC7.
- **Fixing `deploy-stand.yml:216` because it is one word and obviously wrong.** §12. The cost is
  not the edit; it is the retro-E5 rows 4.8 paid runs 1132–1150 for.
- **Choosing `preprod` because it reads better.** §4. The scheduler reads `agent_labels`, and a
  label it does not know produces a silently queued job, not an error.
- **Reporting `healthy` as an achievement.** The healthcheck probes `http://127.0.0.1:80` — itself
  — and nginx resolves Kong lazily, so a stand on a backend-less network reports `healthy` and
  serves `200` (5.2 demonstrated this live with a throwaway container on `bridge`). 5.2's M6.
- **Using `.Image` for the digest comparison.** It is the config digest. `.RepoDigests[0]` is the
  one that matches the registry (5.2's L1).
- **`grep -c` on a success path under `set -e`.** It exits 1 on zero matches and aborts the script.
  Write `[ "$(… | grep -c … || true)" = 0 ]`.
- 🔴 **Matching `action_task_step.name` on the full string.** 4.8's refactor stripped every step
  name's `(Task N)` / `(code review Mn)` suffix, and this project's primary evidence channel is
  keyed on step names. **Match on a stable prefix, never the full string** — this story reads the
  step list four times (Tasks 5.4, 6.3, 7.4, 8.2) and every one of them is exposed to it.
- **Breaking `docker-compose.stand.yml` to build an unhealthy-stand probe.** Routed to 5.3/6.4 by
  name (`deferred-work.md:3351-3364`): the rollback restores the **image digest** using the *same*
  checked-out compose file, so a broken healthcheck in that file cannot be un-broken — *"break the
  image, never the compose file."* This story needs no such probe; the lesson is recorded so it is
  not re-discovered if a red round tempts one.
- **Assuming the container has `curl`.** The image is `nginx:alpine` — use `wget` *inside* the
  container. `curl` on the host is fine, and the callee's own checks route through a
  `--network host` sibling because `127.0.0.1:8083` is unreachable from any container.

### 4. Previous story intelligence

- **From 4.8:** `image_tag` mode's two blockers and their untested fixes (§3); the caller skeleton
  and its wrong label; `hold_lock_seconds`/`simulate_bad_credential` are callee inputs and may be
  forwarded or omitted; the callee has **no** `concurrency:` and never will; `secrets: inherit` is
  the only mechanism because `on.workflow_call.secrets` is rejected by this parser; dispatching
  from a story branch works and `uses: ./…` resolves the callee at the caller's own ref.
- **From 5.2:** everything in §2; the stand-dir precondition and the "fires once, not twice"
  correction; the label measurement and the conflict; the CORS reality; the tag census and
  `sha-f8f358f43ced-preprod`'s deletion; the credential-handling rules in Prohibition 12, all of
  which were learned by leaking a token twice in one session.
- **From 5.1/D34:** the identity-vs-name distinction, and that a discriminator which cannot fail is
  worse than no discriminator (Prohibition 14).
- **From 4.7/D32:** the AC4-equivalent 404 clause on DEV was closed *by the step list showing `down`
  SKIPPED*, not by an ordering argument. Reuse the form.
- **From 4.4/D30:** the lock primitive, the `--init` requirement, `lock_ttl_seconds > 600`, and why
  contention on a capacity-1 runner needs a detached holder.

### 5. Ledger attribution in the parallel era — cite 5.1's closeout, do not re-derive it

Story 5.1's closeout (PR #75) states the method; 5.2 followed it and closed 5/5 with zero overrun.
Verbatim:

> (1) filter `action_run` to this repo's `repo_id`, eliminating sibling-repo instance noise […];
> (2) for each remaining row, match `commit_sha` against the closing story's own known commits
> (context, review, fix-pass, merge) and against any concurrently-active sibling story's own branch
> tip(s) (fetched fresh […]); (3) a row whose `ref`/`commit_sha` matches neither is not yet
> attributable and must be named as such, not folded into either story by default.

*"'Everything above baseline is this story's' — every prior ledger's assumption — is false here."*
5.2's own closeout found row **1176** to be a `PRIONEX_HUB` scheduled run and **named it rather than
absorbing it**. Story 4.9 is pushing to `story-4-9/pr-1-context` concurrently — do the same.

⚠️ Inherited caveat, still open: `max(id) == count(*)` is **not** a hidden-run proof, and the
instance-wide query has no `repo_id` filter. Use the filtered form; if you also run the unfiltered
one, say which is which.

⚠️ **This story's dispatches are `workflow_dispatch` rows on `deploy-preprod.yml`, not `ci.yml`
rows** — they will not look like the push rows, and the callee's jobs live *inside* the caller's
run (one row per dispatch, five jobs in it). Do not double-count them.

### 6. Non-goals — absences that are decisions, not omissions

- **No `preprod-current` / `preprod-<sha>` tag.** That is Story 5.4 in full.
- **No Slack notification.** Story 4.5's, deferred by the epic itself. AC5.
- **No change to `deploy-stand.yml`,** including its wrong skeleton label. §12.
- **No CORS fix, and no attempt at browser-path validation.** `CRM/api-prionex`'s; AC6 records the
  boundary rather than crossing it.
- **No new `-preprod` image.** §5, Prohibition 11.
- **No host provisioning.** 5.2 did it; this story only reads and dispatches.
- **No rollback feature.** `rollback` is a **caller** concern and belongs to Story 6.4
  (`deploy-stand.yml:203-206`). The callee's own post-`down` restore path exists and this story
  exercises it only incidentally, if at all.
- **No `dev-reset.yml` equivalent for PRE-PROD.** Nothing schedules a PRE-PROD reset and nothing
  should — a release candidate that resets itself is not a candidate.

### 7. Things pending on Oleg — do not depend on them silently

- **The PRE-PROD Kong CORS fix** — external ask to `CRM/api-prionex` (relayed by Oleg, extended
  2026-08-23). 🔴 5.2's own closeout flagged this forward: *"The first real PRE-PROD deploy through
  Story 5.3 will need this fixed before any browser-path validation means anything."* **It is not
  fixed.** AC6 exists so this story closes honestly without it, and so 5.4/5.5 are not planned
  around an assumption.
- **Transcript-scrubbing for the two leaked `read:package` tokens** — Owner: Oleg, open. Neither
  can be revoked (D14). **This story mints nothing and needs no token**, so it neither worsens nor
  depends on it.
- **The `robot-registry` account question** (whether its `read:package` grant is instance-wide
  rather than repo-scoped) — Owner: Oleg, open. Do not assume repo-scoping.
- 🔴 **The `CRM/api-prionex` heads-up about our two endpoints on their networks** — escalated by
  5.2, **still unsent and still unowned**. This story makes PRE-PROD a live deploy target, which is
  when it stops being theoretical. Task 9.2a re-escalates it to Oleg's own channel; it blocks
  nothing here.
- **`epics.md:2169-2171`'s stale `PLACEHOLDER-preprod-backend-not-provisioned` claim** — Owner:
  Oleg, at whichever story next amends the epic. `epics.md` is a planning artifact outside this
  story's blast radius. **Do not correct it here**, and do not repeat it either (§8).
- **`secrets: inherit` scope before Story 6.4 ships** — 4.8 named it for Oleg. This story inherits
  the same all-or-nothing mechanism and does not re-litigate it; it repeats the pointer in the
  caller's header.
- **`KONG_PORT` for PROD (`8330`)** — Story 6.4's. PRE-PROD sets no `KONG_PORT`, so nothing here
  settles it. **Do not claim it does** — D34 §6 records that a first attempt to close it was wrong
  five times over.

### 8. Conventions that bind this story

- 🔴 **`D4` and `E5` are ambiguous — two numbering schemes collide.** The retro action items
  (`epic-3-retro-2026-08-18.md:77-78`) are **retro-D4** and **retro-E5**. The D-series in
  `docs/migration-decisions.md` is a different sequence, where `D4` is stand parameterization and
  there is no `E5`. **Write the prefix every time.**
- **retro-E5 (live outcome matrix):** *"every guard proves itself on a run that fails as well as one
  that passes."* This story's three designated failing runs are **Task 6** (absent tag → 404),
  **Task 7** (`simulate_bad_credential` → 401) and **Task 8.2** (the fixture dispatch, which
  deliberately does not deploy) — plus the zero-run **AC2** rejection (HTTP 400).
- **retro-D4 (run ledger):** declare before work; close only against a post-merge query; or write
  **OPEN**.
- **NFR5:** the existing DEV and legacy stands stay operational and untouched. Here that means DEV
  (§12, never read, never touched) and the legacy stand (a different host, never contacted).
- **NFR10:** serialization must not depend on `concurrency:`. The `flock` is the load-bearing half;
  the group is defence in depth. Task 8 proves the `flock`; Task 5.2 proves the group exists.
- **Decision bodies are never rewritten.** Amendments are dated blocks appended to the record.
- **`deferred-work.md`:** new at EOF; closures under the original with the old text struck.
- **Owners are names or story numbers**, never trigger conditions.
- **Prohibition 13's four dispositions** (5.2's convention): `UNPROVEN` / `OPEN` /
  `PENDING (owner: name)` / *not claimed*. Never a fifth, softer word.
- **Story files in English; D-records in Russian.** Branch `story-5-3/pr-<n>-<purpose>`. `main` is
  protected (D16): eight required contexts, `apply_to_admins: true`.
- **Model split:** create-story Opus, dev-story Sonnet, code-review Opus.

### 9. The autonomous decisions in this story, in one place (for a one-read veto)

Each is *autonomous, subject to Oleg's veto*. Vetoing any one costs a task edit, not a
re-derivation.

| # | Decision | Where | If vetoed |
|---|---|---|---|
| 1 | `runner_label: deploy-dev-preprod`, **not** `preprod` — the scheduler reads `agent_labels`, where only this value appears | §4, Task 2.3, AC3(ii) | change one line to `preprod` and accept that an unmatched label queues silently; re-run Task 2.3's query first |
| 2 | `deploy-stand.yml:216`'s wrong label is **re-routed to Story 6.4**, not fixed here | §12, Task 9.2 | edit the comment, accepting the retro-E5 re-earning and the 4.9 collision |
| 3 | The caller **adds** `simulate_bad_credential` and `hold_lock_seconds` dispatch inputs, which the skeleton omits | Task 3.2 | drop them — and drop the 401 row and the lock row with them, or find a costlier way to stage both |
| 4 | The green row is **staged** on a deliberately-wrong pre-image so the digest change is a real discriminator | §6, Task 4 | deploy the tag onto itself and take the weaker `.Id`/`StartedAt` discriminators (Task 4.4's path) |
| 5 | **No new `-preprod` tag is minted**; an absent `sha-00ef3be4743d-preprod` is a blocker, not a contingency | §5, Prohibition 11 | dispatch `build.yml` with `environment: preprod` from `main` HEAD and charge an irreversible permanent tag to the ledger |
| 6 | **AC6 added** — what the checks prove and do not prove, recorded | AC6 | the story hands 5.4 a green tick that hides a broken browser path |
| 7 | **AC7 added** — `image_tag` mode's five first-execution lines confirmed individually | AC7 | four never-run code paths are accepted on one green tick |
| 8 | Dispatch 5 is **separate** from dispatch 1 rather than merged into it | §11 | merge them, save one row, and risk losing the green row to the fixture's timing |
| 9 | Dispatches run from **`story-5-3/pr-1-context`**, before merge | §9, Task 5.1 | dispatch from `main` after merge — but then the matrix cannot be earned before review, which is what 4.8's Task 5.1 established the branch-dispatch pattern to avoid |
| 10 | The three tuning constants are passed **explicitly** at DEV's values rather than inherited silently | Task 3.1 | omit them; the callee's defaults are identical, and the file becomes shorter and less self-describing |
| 11 | `deferred-work.md` finding 8 is **closed by this story** on Task 5.5's observation | §7, Task 9.2 | leave it open and record the datum without closing |

### Project Structure Notes

**Files this story creates or modifies — in the repository:**

| Path | Change |
|---|---|
| `.forgejo/workflows/deploy-preprod.yml` | **NEW** — the whole deliverable |
| `_bmad-output/implementation-artifacts/5-3-deploy-a-specific-image-tag-to-pre-prod.md` | this file |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | `5-3-…` → `in-progress` (Task 1.1), then `review` (Task 9.6) |
| `docs/migration-decisions.md` | **new D37** (verify against open branches — 4.9 holds D35) + index row + Change Log row |
| `_bmad-output/implementation-artifacts/deferred-work.md` | new entries at EOF; finding 8 closed under its original |

**Files this story touches on s1 — not in the repository:**

| Path | Note |
|---|---|
| `/root/crm-prionex/fe-prionex-preprod/.env` | `DOCKER_IMAGE` edited for the Task 4 pre-step and **restored** in Task 4.5. Record/DR only — nothing on the deploy path reads it |
| the `fe-prionex-preprod` container | recreated by each successful deploy; that is the deliverable |

**Explicitly not touched:** 🔴 `.forgejo/workflows/deploy-stand.yml` (Prohibition 1);
`deploy-dev.yml`; `dev-reset.yml`; `build.yml`; `ci.yml`; `docker-compose.stand.yml`;
`.env.stand.example`; `nginx.conf`; `Dockerfile.prod`; `docker-compose.server.yml`; `README.md`;
everything under `.github/`; every nginx file on s1; `/etc/letsencrypt`; the DEV stand in any form;
`epics.md` (a planning artifact — an epic amendment is not a story edit).

### References

- `_bmad-output/planning-artifacts/epics.md:2236-2279` — Story 5.3's ACs, including the 2026-08-22
  `expect_unrouted_api` amendment and the 2026-08-14 Slack deferral
- `_bmad-output/planning-artifacts/epics.md:2116-2172` — Epic 5's preamble and its own warning that
  *configured wrong is worse than unconfigured*
- `_bmad-output/implementation-artifacts/5-2-provision-the-pre-prod-stand-on-s1.md` — §2 the
  measured host, §3 the stand-dir precondition and the "fires once" correction, §5 the five
  variables, §8 the `runner_label` finding, **§9 what this story is owed**, Task 5's tag census,
  Task 7.6's literal `/api/` capture, AC6's CORS measurement, the full Review Findings
- `_bmad-output/implementation-artifacts/4-8-factor-out-the-shared-deploy-mechanics.md` — §1 the
  refactor's own thesis, §8 the conventions, §10 the budget model, Task 5.1 (dispatch from the
  story branch), Task 6 (the matrix conventions), Task 6.7 (the void-clause), Task 9.1 (the walk of
  5.3's own ACs against the callee's inputs), **Review H1** (the dead `image_tag` mode),
  Open Question 7
- `_bmad-output/implementation-artifacts/4-3-deploy-a-feature-branch-to-dev-on-demand.md:828-834` —
  the label-collision argument and the `ubuntu-latest` precedent
- `_bmad-output/implementation-artifacts/4-7-validate-dev-deploys-across-five-feature-branches.md` —
  DN4, the permanent story-push line
- `_bmad-output/implementation-artifacts/epic-3-retro-2026-08-18.md:77-78` — **retro-D4** and
  **retro-E5**, verbatim
- `.forgejo/workflows/deploy-stand.yml` — 🔴 **read-only.** `:28-41` the D21 concurrency note,
  `:66-73` `secrets: inherit`, `:88-96` the mode note and the `github.sha` finding, `:97-177` the
  fifteen inputs, `:179-187` `IMAGE_REPO` and the absent `concurrency:`, `:189-232` the caller
  skeleton (`:216` the wrong label), `:260-497` the `hold-lock` fixture, `:499-620` `preflight`,
  `:622-728` `clone-test` (`:643-661` the H1 fallback), `:729-856` the non-gating digest test,
  `:864-886` the exactly-one guard, `:895-991` tag derivation (`:915-933` the image_tag branch),
  `:993-1037` the workspace `DOCKER_CONFIG`, `:1039-1157` digest resolve (`:1116` 401, `:1125` 404),
  `:1159-1170` the pull, `:1172-1320` the compose checkout (`:1209-1227` `IMAGE_TAG_MODE`,
  `:1289-1319` the skipped cross-check), `:1322-1360` `.env.deploy`, `:1361-1693` the lock
  (`:1450-1456` the TTL assert, `:1457` the holder name, `:1473-1481` the stand-dir assert),
  `:1795-1818` `down`, `:1865-2054` health, `:2056-2100` AC6's digest match, `:2102-2207` the Kong
  guard (`:2184-2207` `expect_unrouted_api`), `:2236-2288` the restore path, `:2389-2422` release
- `.forgejo/workflows/deploy-dev.yml` — the live, proven caller this file copies; `:66-68` the
  literal concurrency group, `:70-89` the `with:` block, `:26-35` D21's caller-side traps
- `.forgejo/workflows/build.yml:906-975` (tag construction), `:962`/`:971` (`keep_pattern` — why
  `-preprod` is permanent), `:1094-1113` (one permanent tag per run), `:1477-1496` (repoint
  refused), `:415-431` (the four path spellings), `:596-601` (the corrected placeholder comment)
- `.forgejo/workflows/build-main.yml:28-37`, `.forgejo/workflows/ci.yml:368-381` —
  `environment: dev` as a hard literal, so **no automatic path builds preprod**
- `docs/migration-decisions.md#d10` — the deploy runner's labels and the unresolved
  `.runner`-vs-API/DB conflict
- `docs/migration-decisions.md#d21` — a callee's `concurrency:` is silently void; the caller-side
  traps
- `docs/migration-decisions.md#d27` — the five variables, no defaults
- `docs/migration-decisions.md#d28` — §3 the registry credential and H4, §4 the runner mounts and
  option (e), §6 s1 addressing
- `docs/migration-decisions.md#d30` — the lock design, `<stand_dir>/.deploy.lock`, the group keyed
  on the stand, `hold_lock_seconds` as a permanent test hook
- `docs/migration-decisions.md#d32` — the AC4-equivalent 404 clause closed by the step list
- `docs/migration-decisions.md#d33` — the callee, its fifteen inputs, R1 confirmed live, the
  concurrency group surviving expansion, and **`expect_unrouted_api: false` routed to this story**
- `docs/migration-decisions.md#d34` — §3 the identity form, §6 what stays open about
  `expect_unrouted_api` and `KONG_PORT`
- `docs/migration-decisions.md#d36` — the PRE-PROD stand as built; §2 the stand-dir precondition,
  §6 why this story does not depend on the host login, §7 the wrong `runner_label` routed here
- `docs/migration-decisions.md#d14`, `#d15`, `#d18`, `#d20` — tokens cannot be revoked; OpenBao and
  the four path spellings; the tag scheme; `latest` cancelled
- `_bmad-output/implementation-artifacts/deferred-work.md` — `:3541-3557` **finding 8, owned by
  this story**; `:3600-3606` finding 1, the wrong `runner_label`, owned by this story; `:2515-2547`
  the run-cost floor; `:2887-2895` two sources of truth; `:2977`/`:3046`/`:3055` the per-stand lock;
  `:3362` the unhealthy-stand probe on any stand the callee serves; `:994-1016` the Slack deferral
- `docs/preprod-infrastructure-requirement.md` §2.5 — the CORS ask, still open with
  `CRM/api-prionex`

---

## Dev Agent Record

### Agent Model Used

### Debug Log References

**Task 1.1:** `sprint-status.yaml` flipped `ready-for-dev → in-progress` and pushed as its own
commit (`5c06cd14`), before any other change — `git log -p` on the file shows the transition alone
in that commit.

**Task 1.2 — ledger baseline, `2026-08-24T08:26:19Z`:** repo-scoped (`repo_id=16`):
`select max(id), count(*), now() at time zone 'utc' from action_run where repo_id=16` →
**`1182 | 451`**. Instance-wide: **`1182 | 1182`**. `select id,owner_name,name from repository
where name='fe-prionex'` → `16|CRM|fe-prionex`, confirming the filter. Both above §2(p)'s prior
(`1177 | 446`) — 5 rows landed between 5.2's closeout and this baseline; not this story's to
attribute (they predate this story's own commits and are 5.2-closeout-adjacent instance activity,
named here rather than silently inherited).

**Task 1.4:** no-touch window is 2026-08-30 01:45–02:30 UTC. Today is 2026-08-24 — the planned
dispatch session (this same UTC day) falls well outside it.

**Task 2.1:** `ssh root@10.67.0.1` confirmed live, `2026-08-24T08:26:19Z` (same session as the
ledger baseline).

**Task 2.2:** `/root/crm-prionex/fe-prionex-preprod/` present, `0700`, contains
`docker-compose.stand.yml` (`-rw-r--r--`, 2857 bytes) and `.env` (`-rw-------`, 0600). Host
`sha256sum` of the compose file: `7f449dacce163fed898b06d3d3d204656b0f485fdbad1827c03c7aac9b1932ec`
— matches §2(b) exactly.

**Task 2.3 — runner label, settled by query:** `select id, name, agent_labels from action_runner
where name='s1-deploy-dev-preprod'` → **`14 | s1-deploy-dev-preprod | ["deploy-dev-preprod"]`**.
The DB-side conflict named in §4 did **not** resolve — `agent_labels` still shows exactly one
label, not four. `deploy-dev-preprod` used, per the autonomous decision; no change to record beyond
re-confirming the conflict is still live.

**Task 2.4:** `/opt/forgejo-runner-deploy/config.yml` (host file, not DB): `capacity: 1` (comment
marks it "ОБЯЗАТЕЛЬНО", Story 1.6 Task 4); `options: "-v /var/run/docker.sock:/var/run/docker.sock
-v /opt/crm-preprod:/opt/crm-preprod -v /opt/crm-dev:/opt/crm-dev
--add-host=git.crm-prionex.com:10.70.0.1"`; `valid_volumes` includes `/var/run/docker.sock` (full
list not re-transcribed — unchanged from prior stories' reads). `/root/crm-prionex/*` confirmed
absent from `valid_volumes` — the job reaches the stand only through sibling containers, as
expected.

**Task 2.5 — tag census, full raw response pasted verbatim (5.2's own M1 finding, not repeated):**

```
{"name":"crm/fe-prionex","tags":["build-check-3-1","buildcache","buildkit-cni-staging","buildkit-cni-v1","correct-course-prod-target-s10-dev","docs-retro-b2-c3-decisions-dev","feat-a1-cni-run-isolation-dev","feature-kan-353-operator-phone-dev-dev","feature-kan-500-calibration-frontend-dev-dev","feature-kan-874-contact-tag-dropdown-dev-dev","feature-readme-contributing-hooks-dev","feature-readme-forgejo-clone-url-dev","fix-operator-phone-origin-dev","main-dev","main-preprod","probe-3-2-review","probe-3-2-tag-scheme","probe-3-3-env-dev","probe-3-3-preprod-preprod","probe-3-3-review-dev", … (200 further -dev/story-*/probe-* tags, one v1.0.0 release tag — elided for length; full response is reproducible via GET /v2/crm/fe-prionex/tags/list and was captured whole in this session's own transcript)]}
```

**`sha-00ef3be4743d-preprod` present.** `sha-f8f358f43ced-preprod` **confirmed absent** (deleted by
Oleg 2026-08-16, per prior record — not a blocker, matches expectation exactly). Digests resolved
via manifest header:
- `sha-00ef3be4743d-preprod` → `Docker-Content-Digest: sha256:5e5b190d93c8aaec50f0d50c7e108f502c3d366d14f8a13aee081f0ee396dc8c` (matches §2(h) exactly).
- `probe-3-3-preprod-preprod` → `Docker-Content-Digest: sha256:45687dc47d6f42aef591ed8205805738534a283e8019e13ab3cac1828be43f05` — **different**, confirmed usable as the staged pre-image (Task 4).

Credential confirmed via **shape only, per Prohibition 12** — `python3 -c "...['auths'].keys()"` →
`['git.crm-prionex.com']`; `/root/.docker/config.json` was never catted.

**Task 2.6:** `git diff origin/main -- docker-compose.stand.yml` → empty. `sha256sum` on this
branch's own working copy → `7f449dacce163fed898b06d3d3d204656b0f485fdbad1827c03c7aac9b1932ec` —
identical to the host's copy (Task 2.2) and to §9's declared value.

**Task 2.7:** `crm-preprod-network`'s own container list includes `crm-preprod-kong-gateway` at
`172.21.0.24/16`. From inside the running stand: `docker exec fe-prionex-preprod getent hosts
crm-kong-gateway` → `172.21.0.24 crm-kong-gateway crm-kong-gateway` — the guard's own path,
confirmed working before dispatch 1.

**Task 2.8 — before-state row (superseded by Task 4.3's row once the pre-step ran — recorded here
for completeness of the original "before anything" state):** `Id=a46171913980831ef08d23e93f4ea420ccfa4be8270d09704c30140eb5c2e6c3`,
`StartedAt=2026-08-23T21:35:54.929340172Z`, `RepoDigests=[…@sha256:5e5b190d…396dc8c]`
(via `.Image` → `docker image inspect --format '{{.RepoDigests}}'`, not `.Image` directly — 5.2's
own L1 finding applied), `Health=healthy`, `https://crm.preprod.crm-prionex.online/` → `200`.

**Task 3.4/3.5 — mechanical checks, all zero-dispatch, `2026-08-24T08:29Z`:**

```
top-level keys: ['name', True, 'concurrency', 'jobs']   # 'on:' parses to the boolean key True — the
                                                          # exact YAML 1.1 trap AC1 named; workaround
                                                          # applied (d.get('on', d.get(True)))
on value keys: ['workflow_dispatch']                     # confirms AC1: no push/schedule/tag trigger
```

`${{ }}` scan: 3 occurrences, all inside `with:` values (`image_tag`, `simulate_bad_credential`,
`hold_lock_seconds`) — none in a `run:` body (there are none), none in the `concurrency: group:`,
none in an `if:`. `run:` body count: **0**. `uses:` count: **1**
(`./.forgejo/workflows/deploy-stand.yml`). `github.ref_name` occurrences: **0**. No `if:` on the
`deploy` job. No `push`/`schedule` keys anywhere in the file.

**Task 3.6:** `git diff origin/main --name-only` → `.forgejo/workflows/deploy-preprod.yml` (new),
`_bmad-output/implementation-artifacts/5-3-deploy-a-specific-image-tag-to-pre-prod.md`,
`_bmad-output/implementation-artifacts/sprint-status.yaml`. **`deploy-stand.yml` absent**, confirmed
by diff, not by intention.

**Task 4 — staging the discriminator, `2026-08-24T08:29:03Z`–`08:29:09Z`:** 4.1: `probe-3-3-preprod-preprod`'s
digest (`sha256:45687dc4…`) confirmed to exist and differ from the target
(`sha256:5e5b190d…`) — proceed with the strong-discriminator shape (not the Task 4.4 fallback). 4.2:
`/root/crm-prionex/fe-prionex-preprod/.env`'s `DOCKER_IMAGE` edited to the probe's digest form
(`…@sha256:45687dc4…`), `docker compose --env-file .env -f docker-compose.stand.yml up -d` →
`Recreated`/`Started`, exit 0 (pull, recreate, start — no `docker rm -f`, Prohibition 9 honoured).
4.3, pre-state row: `Id=26e990ff38d230377e17d5009241411b7b8ab0e12418fb0317bdebe1e6661fb4`,
`StartedAt=2026-08-24T08:29:04.895562534Z`, `RepoDigests=[…@sha256:45687dc4…]` (the probe digest,
confirmed via `.RepoDigests`, not `.Image`), `Health=healthy`, `https://crm.preprod.crm-prionex.online/`
→ `200` — deliberately wrong image, but genuinely serving, so dispatch 1's green proves more, not
less. **This is the row Task 5.6 will compare dispatch 1's own result against.** **Shape used:
strong (staged pre-image), not the Task 4.4 weak fallback.**

**Task 5 — dispatch 1, run 1184, `2026-08-24T08:32:xx`, SUCCESS in ~60s on the first try.**
`concurrency_group=deploy-preprod-fe-prionex-preprod`, `concurrency_type=1` — real, survived
`workflow_call` expansion. All jobs `runner_id=14`, `runs_on=["deploy-dev-preprod"]`. Step list:
24/25 steps `status=1`, the one `status=4` is the (correctly unneeded) post-`down` restore step.
Digest moved cleanly: `Id` `26e990ff…` (Task 4's staged probe) → `29dbd804…` (post-deploy),
`RepoDigests` now exactly `sha256:5e5b190d93c8…` (the target, not the probe), `healthy`, site `200`
— a real discriminator, not a no-op. AC7 line 1 confirmed literally from the archived `clone-test`
log: `No ref supplied (image_tag mode) — validating the CALLER's own commit
(github.sha=9eecc5eb…)`. Lines 2-5 and the AC6 Kong-guard `RESP_CODE` line are in the `deploy` job's
own log (task 9745), **not yet archived to disk as of this write-up** — Forgejo compresses task
logs to storage asynchronously and this one is queued behind others; will be read via SSH once
`log_in_storage` flips true (Debug Log addendum, once available).

**Task 6 — dispatch 2, run 1185, `2026-08-24T08:39:xx`, FAILURE as designed — but see the §12
finding below.** Step 4 ("Resolve the digest before pulling") failed; steps 5-21 all
`status=4` **SKIPPED**, including step 12 (`docker compose down`) — AC4's safety evidence, from the
step list, not an argument. Step 8 ("Acquire the stand lock") also `status=4` — the lock was never
taken. Container `Id`/`StartedAt`/`RepoDigests` unchanged from dispatch 1's post-state; site still
`200`.
🔴 **But the message-quality half of AC4 was not met as first dispatched.** The step's raw log:
```
2026-08-24T08:39:10.5417487Z /var/run/act/workflow/digest.sh: line 85: IMAGE_ENV: unbound variable
2026-08-24T08:39:10.6093231Z ⚙️ [runner]: exitcode '1': failure
```
No classified 404 message was ever printed — see the §12 record immediately below.

**Task 7 — dispatch 3, run 1186, `2026-08-24T08:39:5x`, FAILURE as designed, clean.** Same
down-SKIPPED/untouched pattern as 1185. The 401 classifier fired correctly (this path does not
reference `IMAGE_ENV`, so it was unaffected by the defect): literal message from the `deploy` job's
own archived log (task 9759): `FAIL: registry returned 401 Unauthorized resolving
sha-00ef3be4743d-preprod. [SIMULATED via simulate_bad_credential=true — NOT a real credential
outage] This means the deploy job's OWN registry credential (REGISTRY_USER_RO/ REGISTRY_TOKEN_RO)
is missing, wrong, or revoked — NOT that the image is missing. Fix: check the org secrets. Do not
chase a build problem for this failure.` The diagnostic `digest-resolve-test` job (non-gating)
**succeeded** in the same run — confirms the simulation corrupts only the deploy job's own local
credential copy, not the org secret (Task 7.5's own check).

**Task 8 — dispatches 4 (run 1187) and 5 (run 1188), back-to-back, real contention.** 1187: only
`hold-lock` ran (`status=1`); `preflight`/`clone-test`/`digest-resolve-test`/`deploy` all `status=4`
**SKIPPED** — the `needs:`-cascade gate held. Holder container
`fe-prionex-preprod-deploy-lock-1187` (name derived from `compose_project_name-deploy-lock-<run
id>`, per `:1457`), later confirmed `Exited (0)`. 1188 dispatched immediately after: its own
"Acquire the stand lock" step **started `1787560846`, stopped `1787560877` — a real 31-second
wait**, matching the holder's ~60s TTL running down (measured from the DB's own step timestamps,
not inferred). Deploy completed green afterward; final digest `sha256:5e5b190d93c8…`, `healthy`,
site `200`; lock released, `.deploy.lock` back to 0 bytes/unlocked. The literal "waiting"/"acquired"
log lines (Task 8.4's own request) are in task 9769, also not yet archived — same addendum as
dispatch 1's AC7 lines.

### 🔴 §12 exception — a real defect in `image_tag` mode, found by dispatch 2, fixed per the
### 4-step procedure, with Oleg's explicit authorization

**1. The defect, stated with the failing run id and exact log line.** Run **1185**, job 10346
(task 9752), step "Resolve the digest before pulling": `/var/run/act/workflow/digest.sh: line 85:
IMAGE_ENV: unbound variable`, `exitcode '1'`. The step's own `env:` block (`deploy-stand.yml:1041-1045`)
declared `REG_USER`, `REG_TOKEN`, `TAG`, `SIMULATE_BAD_CREDENTIAL` — but not `IMAGE_ENV`, which the
404 branch (`:1131`, `if [ "${IMAGE_ENV}" = "dev" ]`) references under `set -euo pipefail`
(`:1047`). No classified 404 message was ever produced; the job aborted one line into the branch
that was supposed to write it. **The safety property held regardless** — the script still exited
non-zero, and the `needs:`-cascade still skipped `down` and everything after it identically to a
clean classification (Task 6's own evidence above). Only the *message* was lost, not the guarantee
the message describes.

**Origin.** The `IMAGE_ENV` branch itself was added by a **"Code review (2026-08-23, Low)"** fix —
visible in the comment directly above it (`:1127-1130`) — specifically to stop a hardcoded `-dev`
retention note from misdirecting a PRE-PROD/PROD operator. That fix is exactly the class this
story's own §3 names generally: *verified by reading, never dispatched* — DEV has apparently never
hit a real 404 on this exact code path since the fix landed, and this story's own dispatch 1
(a genuine, valid tag) never needed to reach this branch either. Dispatch 2 is the first live
execution of this specific line, in any environment.

**2. Which retro-E5 rows this invalidates: none, per the void-clause's own exemption.** The fix is
a single `env:` key added to one step; it shares no state with the `200`/`401`/`000`/`*` branches
of the same `case`, with the pull/compose/lock/health machinery, or with any other step in the job.
Task 6.7's void-clause, as amended by Oleg (*"exempt a pure fail-closed early-exit that shares no
state with the block"*), covers exactly this shape. Story 4.8's own retro-E5 matrix (runs
1132–1150) is **not** invalidated — none of those runs exercised this branch, so none of their
evidence changes. Only the 404 row itself — this story's own Task 6 — needs re-earning.

**3. Priced, before the edit landed (Oleg's own instruction: fix now, price now).** **+2** dispatches:
one PRE-PROD re-run of the absent-tag row (this story, confirming the fix in the environment that
found the bug) and one DEV control (`deploy-dev.yml` with a nonexistent `ref`, same code path,
proving the fix holds for both branches of the `if`, not just the one this story happened to hit).
Both are the coordinator's to run. Declared floor moves from 13 to **15** (see Run Budget Ledger,
below) — named as a priced consequence of a real, escalated defect, not absorbed silently.

**4. Escalated to Oleg as a blocking Open Question before any edit was made** — not fixed and
reported afterward. **Oleg's decision, 2026-08-24: fix in this story, per the §12 procedure.**
Executed exactly as authorized: one line, `IMAGE_ENV: ${{ inputs.image_env }}`, added to the
step's own `env:` block, matching the existing pattern at `:741`/`:900`. Nothing else in
`deploy-stand.yml` touched — confirmed by `git diff` showing exactly one added line.

**Local force-test, before pushing the fix (Oleg's own instruction, step 3), zero dispatches.**
The 404 branch's logic (`:1126-1144`) was reproduced in an isolated local script under
`set -euo pipefail`, run once with `IMAGE_ENV=dev` and once with `IMAGE_ENV=preprod`:
- `IMAGE_ENV=dev` → completes cleanly, message includes *"or (b) a -dev tag older than 14 days was
  deleted by the live retention rule…"* — the DEV-specific clause fires.
- `IMAGE_ENV=preprod` → completes cleanly, message includes *"the 14-day retention rule…only
  applies to -dev tags…not a likely cause for image_env=preprod"* — the non-DEV clause fires,
  correctly excluding the misdirection the original code review fix existed to prevent.
- **Control, same script, `IMAGE_ENV` left unset:** reproduces the exact original crash —
  `bash: line 1: IMAGE_ENV: unbound variable`, exit 1 — confirming this is the real root cause, not
  a guess, before the fix was ever pushed.

Both branches now provably correct without a live dispatch. The coordinator will re-run the actual
404 row (PRE-PROD) plus a DEV control once this fix is pushed.

### Run Budget Ledger

_Declared before work — see §11. Floor **13** above baseline, ceiling **16** (three red rounds
reserved). Disposition starts **OPEN** and closes only against a post-merge query (retro-D4)._
🔴 **Revised, `2026-08-24`, per the §12 exception above: floor moves to 15** (+2 dispatches: the
PRE-PROD 404 re-run and the DEV 404 control), still inside the original ceiling of 16 — the
red-round reserve absorbs it exactly as named for.

### Completion Notes List

### File List

### Review Findings

---

## Open Questions for Review

**Blocking**

1. **None at contexting time.** Two conditions would create one during dev-story, and both are
   named so they are recognised rather than improvised around:
   (a) `sha-00ef3be4743d-preprod` absent from the registry at Task 2.5 — minting is irreversible
   and is Oleg's call (Prohibition 11);
   (b) dispatch 1 exposing a real defect in `image_tag` mode — §12's exception procedure, escalate
   before editing `deploy-stand.yml`.

**Non-blocking**

2. **Is `deploy-dev-preprod` the right label, or should the `.runner`-vs-`agent_labels` conflict be
   resolved properly first?** §4 chooses the value that is safe under *both* readings and settles
   the question by query at Task 2.3. Story 6.10 must pick an s10 label and will meet the same
   conflict, so resolving it authoritatively has value beyond this story — but not enough to block
   here.
3. **Should `deploy-preprod.yml` carry `dev-reset.yml`-style naming invariants?** Nothing dispatches
   or reads it back today. Task 3.1 records the absence explicitly rather than copying DEV's
   warning as if it applied. If a future PRE-PROD reset or a 5.4 recorder dispatches this file by
   name, those invariants become real and the header should be upgraded then.
4. **Is `secrets: inherit` acceptable for a PRE-PROD caller?** 4.8 named this for Oleg *"before
   Story 6.4 ships"*, on the grounds that a PRODUCTION caller receiving every org secret is the
   sharper version of the question. PRE-PROD is the intermediate case. Not re-litigated here; the
   pointer is repeated in the caller's header.
5. **Does anything besides the host nginx need to reach `127.0.0.1:8083`?** Inherited unanswered
   from 5.2's Open Question 3. This story's deploy job reaches it only through a `--network host`
   sibling, so nothing here changes the answer.

---

## Change Log

| Date | Change |
|---|---|
| 2026-08-24 | **Contexted** against `main` @ `96d19bc0` (PR #77, Story 5.2's closeout). Branch `story-5-3/pr-1-context`. Eleven autonomous decisions, listed in Dev Notes §9; the two load-bearing ones are `runner_label: deploy-dev-preprod` (§4 — the scheduler reads `agent_labels`, where `preprod` does not appear, and an unmatched label queues silently) and the staged green row (§6 — the stand already runs the candidate tag, so a plain redeploy could not have failed on the axis that matters). Two ACs added: AC6 (what the checks prove and do not prove, given that CORS stays broken) and AC7 (`image_tag` mode's five first-execution lines confirmed individually, because four never-run paths inside one green tick is one green tick). `deploy-stand.yml` is read-only, including its wrong caller skeleton — re-routed to Story 6.4 with the re-earning cost priced, and §12 carries the exception procedure for the one case where this story must edit it. Ledger declared: floor **13**, ceiling **16**, disposition **OPEN**. Status → ready-for-dev. |
