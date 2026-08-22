---
baseline_commit: 06224481d72a08bf38083f1b4997f6066e5f8785
---

# Story 4.8: Factor Out the Shared Deploy Mechanics

Status: ready-for-dev

<!--
Contexted 2026-08-22 against `main` at `06224481` (merge of PR #71, Story 4.7 closeout), on branch
`story-4-8/pr-1-context`. Every autonomous decision in this file is marked "autonomous, subject to
Oleg's veto" and is listed together in Dev Notes §11 so a veto costs one read, not a re-derivation.

🔴 THE STORY'S OWN AC2 IS FALSE AS WRITTEN, AND THE CORRECTION DECIDES THE MECHANISM: the epic's
fallback clause opens *"Given neither `workflow_call` nor composite actions are supported by this
Forgejo version"*. Both halves have since been measured, and they disagree with each other.
Composite actions are dead — `uses:` steps of ANY kind do not execute on the deploy runner's job
image (run 920). `workflow_call` works, and is live in this repository twice over (D21). The
fallback branch therefore does NOT fire, and the shell-script extraction the epic reaches for is
held in reserve for one specific risk (§4, R1), not adopted. See §2.

🔴 SECOND LOAD-BEARING FACT, AND IT IS THE ONE THAT KILLS THE OBVIOUS DESIGN: the `deploy` job's
own task log did NOT persist for 3 of 5 runs in Story 4.7, and still had not 24 hours later (H4).
The `action_task_step` rows are therefore the only per-step evidence channel that survives for this
job — which makes "collapse 22 steps into one `run: deploy-stand.sh`" not a stylistic choice but
the destruction of this project's primary evidence channel for the one job that needs it most. §3.
-->

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> **This story deletes nothing from what works and adds nothing that does not exist yet. It moves
> proven code, and moving proven code is how proven code stops being proven.** Every guard in
> `deploy-dev.yml` was earned on a run that failed as well as one that passed — the 404 classifier
> (run 948), the 401 classifier (runs 936/949), the bounded health poll (run 937, which left the
> stand genuinely broken until a human redispatched), the lock's WAIT/FAIL/STALE rows (runs
> 965/972/973). retro-E5 does not let a refactor inherit those rows by assertion. The refactored
> path has to earn them again, on the real runner, and the budget in §10 is sized for exactly that
> and for nothing else.
>
> The one thing that makes this story genuinely dangerous is that its failure mode is *silent*. A
> called workflow loses its own `concurrency:` block with **no group and no error** (D21). A
> renamed workflow file breaks the weekly reset's dispatch with **no error**, because that dispatch
> step is deliberately non-blocking (Story 4.6, DN1(b)). Both look exactly like success.
>
> **Everything that makes this story hard is in §1-§12. Read them before the ACs.**

---

## Story

As a developer,
I want one definition of the deployment script rather than three copies,
so that a fix applied for one environment cannot silently miss the other two.

---

## 🚨 Read this before anything else

### 1. What this story actually is, and what it is forbidden from becoming

`deploy-dev.yml` is **1875 lines** and has not been touched since Story 4.4's fix-pass
(`e0f5a75b`). Stories 4.6 and 4.7 both deliberately refused to modify it. It is the most heavily
reviewed file in this repository: three code-review rounds, ~50 findings absorbed, five guard rows
earned on live dispatches, and every one of its 30 `run:` bodies parsed clean.

**This story moves that file's mechanics into a reusable definition and proves the moved copy still
works. That is all it does.**

It is forbidden from becoming:

- **a rewrite.** Steps move byte-for-byte where they can. Where a hardcoded DEV literal becomes an
  input, the change is *that literal and nothing else on the line*. Every diff hunk that is not
  "literal → variable" or "block relocated" must be justified in the story record by name.
- **an improvement round.** Nine review-era comments in that file are stale, four step names carry
  historical run numbers, and the ref→tag scheme is lossy (`deferred-work.md`, Epic 3 follow-up).
  None of that is this story's. A refactor that also tidies is a refactor whose regression cannot
  be bisected.
- **the story that adds Slack.** Story 4.5 is PARKED by Oleg (2026-08-21). The epic amended AC1 on
  2026-08-14 specifically to remove the notification element from the shared definition. 4.5 adds
  it to the shared definition afterwards; that is the sequencing, and it is already decided.
- **the story that measures everything 4.7 could not.** Six debts were routed here. Four are
  answerable at zero or near-zero dispatch cost and this story answers them. Two are not, and this
  story **re-routes them in writing with reasons** (§8). Attempting all six is how 4.6 spent 39
  runs against a 20-24 floor.

The one addition this story does make — the post-`down` rollback — is sequenced **last, on its own
commit, after the factoring is green**, precisely so it can be dropped without unmaking anything.
See §7.

---

### 2. 🔴 AC2's premise is false, and the mechanism follows from what replaced it

The epic's AC2 reads:

> **Given** neither `workflow_call` nor composite actions are supported by this Forgejo version
> **When** the fallback is chosen
> **Then** the shared logic is extracted into a version-controlled shell script that the workflows
> invoke

Both halves of that Given have since been measured, and they do not agree:

| Mechanism | Measured verdict | Evidence |
|---|---|---|
| Local composite actions (`uses:` at STEP level) | 🔴 **Dead on the deploy runner.** `uses:` steps of any kind do not execute at all on `deploy-base-dev-preprod:2026-08-07` — silently, without an error. | Run 920 (job 2 isolates it, jobs 1 and 3 green around it); same failure class as `build.yml:107-124` |
| `workflow_call` (`uses:` at JOB level) | ✅ **Works.** Typed inputs across the boundary, `needs:` before and after, callee outputs reaching the caller byte-for-byte, `secrets: inherit`. Live twice in this repo: `ci.yml`→`build.yml`, `build-main.yml`→`build.yml`. | [D21](../../docs/migration-decisions.md#d21), probe runs 617-631 |

The distinction is not cosmetic and it is the reason the two verdicts differ: **`workflow_call` is
expanded server-side.** The callee's jobs become real `action_run_job` rows with real `runs-on`
values; the runner never sees a `uses:` at all. Run 920's finding is about what the *job image* can
execute, and it does not reach this path.

**Therefore the fallback branch of AC2 is not taken.** Recorded as a deviation, not silently
skipped — see the AC2 amendment block below.

⚠️ **What is NOT proven:** `workflow_call` has never expanded into a job whose `runs-on` is
`deploy-dev-preprod`. Both live callers land on `node-20`/`s1-build-crm`. Expansion is server-side
so the risk is low, but "low" is not "measured", and this project's own record on that distinction
is unkind. Task 1 settles it before anything else is written.

---

### 3. 🔴 Why the shell-script extraction is rejected, and it is not about taste

The obvious reading of AC2's fallback — one `deploy-stand.sh` invoked from three thin workflows —
looks attractive: it dodges D21's concurrency hazard entirely (no caller/callee relationship
exists), it dodges the `runs-on` question (each workflow declares its own literal label), and it
dodges `secrets: inherit` being all-or-nothing.

**It is rejected because of H4.**

Story 4.7 found, and confirmed 24 hours later, that `action_task.log_in_storage` remains `false`
for the `deploy` job's own log on 3 of 5 runs — while the *sibling* jobs' logs for those same runs
(preflight, clone-test — smaller, fewer steps) persisted within minutes. The `deploy` job is by far
the largest at 22 steps, and it is the one whose log does not arrive.

Which means: for the single most important job in this repository, the surviving evidence channel
is **`action_task_step` rows** — one row per step, each with its own `status` and `started`/`stopped`
timestamps, readable from Postgres whether or not the log blob ever lands. Story 4.7's entire
dominant-step attribution, its AC4 "`down` confirmedly SKIPPED" proof, and its 110-steps-green claim
all come from that table.

A monolithic script collapses 22 rows into 1. It would take the one job whose logs do not persist
and remove its last per-step evidence. **That is the decisive argument, and it should be stated in
the D-record in those terms.**

Held in reserve, not adopted: **per-step scripts** (`.forgejo/scripts/deploy/NN-name.sh`, one per
step, invoked from a `run:`), which preserve the step rows and still share the bodies. That is
fallback (c) in §4's ladder. Its cost is that the *step list itself* — the ordering that Story 4.4
Task 8.3 fixed by name — gets triplicated, which is exactly the class of drift AC1 exists to
prevent, only one level up.

---

### 4. 🔴 The one risk that can change the whole design: `runs-on` as an input

Epic AC3 requires that **deploy-runner label** be an input to the shared definition. In a
`workflow_call` callee that means:

```yaml
runs-on: ${{ inputs.runner_label }}
```

**Whether this Forgejo build interpolates expressions in `runs-on` has never been tested, read, or
recorded in this project.** Nothing in `docs/migration-decisions.md`, `deferred-work.md` or any
shipped workflow uses the form. Upstream Gitea has historically evaluated `runs-on` at job-planning
time, before most of the expression context exists, with `matrix` as the documented exception.

This is R1, and Task 1 settles it **before a single line of the callee is written**, at zero
dispatch cost, by the method this project already uses for exactly this class of question (Story
4.6 read `notifier_helper.go`, `schedule_tasks.go`, `action.go` and `api.go` off s1 to settle the
schedule and dispatch questions): read the Forgejo source/binary on the instance, then confirm on
the first real dispatch either way.

**Fallback ladder, in order, if R1 comes back negative:**

| | Fallback | Cost |
|---|---|---|
| (a) | `runs-on: ${{ matrix.runner_label }}` with a one-element `strategy.matrix` fed from the input. Matrix interpolation into `runs-on` is a *different* code path and is the documented-supported one upstream. | One extra `strategy:` block; job name gains a matrix suffix (which `dev-reset.yml`'s read-back does not read — it greps the **workflow** title, not the job name — verify before relying on it) |
| (b) | Two mutually exclusive jobs in the callee, each with a **literal** `runs-on`, gated by `if:` on an `environment` input. | The step list is written once and referenced twice, or duplicated once inside one file. Ugly, honest, works. ⚠️ D21: a `uses:` job's `if:` is copied DOWN into the callee — that hazard is about the CALLER's `if:`, not the callee's own job-level `if:`, which is evaluated in the callee's own context where `inputs` live. Verify, do not assume. |
| (c) | Per-step shared scripts (§3), three thin workflows, each with a literal `runs-on`. | Triplicated step list; a second checkout at the workflow's own commit |
| (d) | Literal `deploy-dev-preprod` in the callee. | **This is the failure state, not a plan.** It serves 4.3 and 5.3 (both stands are on s1, both use the same label) and leaves 6.4 — on s10, behind Story 6.10's own label — with a copy. A copy is the thing this story exists to prevent. If the ladder reaches here, STOP and escalate to Oleg. |

🔴 **Note carefully which story R1 actually bites.** DEV and PRE-PROD share one runner and one
label (`deploy-dev-preprod`, `s1-deploy-dev-preprod` id 14). Only PROD differs, and its label does
not exist yet — Story 6.10 registers it. So a negative R1 does not block this story or 5.3; it
blocks 6.4, roughly two epics out. That is an argument for recording the answer precisely and
moving on, **not** for deferring the question: an unmeasured `runs-on` is exactly the shape of
assumption that D21's own preamble names as "the second time in this project that a capability was
believed settled because a related fact was recorded."

---

### 5. 🔴 The concurrency block dies silently the moment this file becomes a callee

`deploy-dev.yml:192-196` already carries the warning, written a story in advance:

> 🔴 This block governs the DISPATCH path only, and dies SILENTLY the day Story 4.8 turns this file
> into a `workflow_call` callee — D21: a called workflow's run carries the CALLER's own auto-group;
> the callee's own `concurrency:` block produces no group and no error. Whatever 4.8 extracts must
> move this block to every caller, or lose the guard without being told.

D21's own measurement, probe runs 617/619/621 (standalone) vs 624/626/627 (called):

| | standalone | **called** |
|---|---|---|
| `concurrency_group` | `probe-callee-` | `refs/heads/…_probe-caller.yml_workflow_dispatch__auto` |
| `concurrency_type` | `1` (explicit) | `0` (auto) |

**Consequence for the design, and it is a happy one:** the constraint points the same way the
requirement does. Per-stand groups are what 5.3 and 6.4 actually need — one group per contended
stand, not one group for "deploying" in general. So the block stays where it already is, in
`deploy-dev.yml`, as a literal, unchanged; `deploy-preprod.yml` and `deploy-prod.yml` each get
their own literal; and the callee declares **no `concurrency:` block at all**, with a comment
saying why, so nobody adds one back believing it does something.

🔴 **This also disposes of the dispatch-chain option.** If the shared definition were a separate
workflow that each environment *dispatched* through the API (Story 4.6's shape), the dispatched run
would carry the SHARED workflow's own group — a single global deploy queue across three
environments — and per-stand serialization would become unexpressible. Story 4.6 chose dispatch for
a **scheduler**, where the accepted cost was "the reset's status reflects the request, not the
deploy" (DN1(a)). That cost is acceptable for a timer and unacceptable for a deploy: 5.3 and 6.4
both need the run's own status to *be* the deploy's status. Plus the read-back tax: 23 of Story
4.6's 39 runs went to getting one non-blocking confirmation step right.

**Verification is cheap and mandatory:** after the first refactored dispatch, read
`concurrency_group` and `concurrency_type` for the caller's run from Postgres. `type=1` and the
literal group means the guard survived. `type=0` means it did not, and the file lies.

---

### 6. What is DEV-specific, exactly — the parameterization surface, enumerated from the file

Story 4.3's own code review (H3) already did half of this work: **all six verification steps read
`CONTAINER_NAME` and `FRONTEND_PORT` back from `.env.deploy`** instead of a hardcoded literal. The
seam already exists. Only the *writer* of that file, and a short list of siblings, are DEV-bound.

**Becomes an input (the complete list, with the line it lives on today):**

| Today's literal | Line | Input |
|---|---|---|
| `runs-on: deploy-dev-preprod` (×5 jobs) | `:238,463,578,654,751` | `runner_label` — see §4/R1 |
| `COMPOSE_PROJECT_NAME=fe-prionex-dev` | `:1106` | `compose_project_name` |
| `CONTAINER_NAME=fe-prionex-dev` | `:1107` | `container_name` |
| `FRONTEND_PORT=127.0.0.1:8082` | `:1108` | `frontend_port` |
| `FRONTEND_NETWORK=crm-dev-network` | `:1109`, and the pre-`down` capture at `:1447` | `frontend_network` |
| `/root/crm-prionex/fe-prionex-dev` (lock dir, ×4 sites) | `:295,348,1188,1226` | `stand_dir` |
| `fe-prionex-dev-deploy-lock-` (holder prefix, ×3 sites) | `:278,1172,1305,1463` | derive from `compose_project_name`, do not add a separate input |
| tag suffix `-dev` (×6 sites in the two sanitizers) | `:683,703,790,819` | `image_env` (`dev`/`preprod`/`prod`, build.yml's own discriminator) |
| `WAIT=240` / `TTL=720` | `:1156,1163,247` | `lock_wait_seconds` / `lock_ttl_seconds`, DEV's values as defaults |
| health poll bound (120s) | `:1519` block | `health_timeout_seconds`, default 120 |
| Kong guard expects `no Route matched` | `:1802` | `expect_unrouted_api` (bool). 🔴 **Found while contexting, not inherited:** Story 4.3's own review finding L3 says this guard "hard-requires `/api/` to stay UNROUTED on this stand's Kong instance". That is true of DEV's Kong today. PRE-PROD's Kong carries **69 containers** worth of real services and PROD's will too — the signature check as written would fail every PRE-PROD deploy. This is the single parameterization item that no prior story named, and it is the kind that ships green on DEV and fails on the environment nobody tested. |

**Does NOT become an input, deliberately:**

- **the target host.** Epic AC3 says so: the runner label determines the host. There is no SSH, no
  `scp`, nothing to connect to (`ufw` admits two admin addresses on port 22).
- **`crm-kong-gateway`.** The alias is *deliberately identical across every stand* — that is the
  entire point of `CRM/api-prionex`'s commit `517e6975`, and `nginx.conf` bakes the literal into the
  image at `Dockerfile.prod:34`, unchangeable per stand. Making it an input would invite somebody to
  set it to something else, which cannot work.
- **the `concurrency:` group.** §5. It lives in each caller or it does not exist.
- **`IMAGE_REPO`** (`git.crm-prionex.com/crm/fe-prionex`). Genuinely one registry for all three
  stands. Stays as the callee's own workflow-level `env:`. (Autonomous, subject to veto — the
  alternative, an input with no default, buys fail-closed behaviour for a value that cannot
  legitimately vary.)

**Two shapes of "what to deploy", and the callee must serve both.** `deploy-dev.yml` takes a `ref`
and derives the tag with a byte-identical copy of `build.yml`'s sanitizer (because `build.yml`
exposes no `outputs:`). Story 5.3's AC requires **`image_tag` as a required input**, rejected if
absent. The callee therefore accepts BOTH `ref` and `image_tag` as optional, with a fail-closed
"exactly one of" guard as its first step, and keeps the sanitizer inside itself so the lossy
ref→tag mapping stays in one place. Each caller decides which shape it exposes to a human.

---

### 7. The post-`down` rollback — the one new mechanism, and why it is sequenced last

Routed here in writing, twice. `deferred-work.md:2847-2858`:

> ✅ **JOINT OWNERSHIP RESOLVED 2026-08-21 (Story 4.7, §8, Task 9.4) — in Story 4.8's favour, in
> writing.** … the mechanism itself moves wholly to Story 4.8, which owns the shared deploy
> definition this would naturally live inside.

The defect, from Story 4.3's review H5: once `down` has run, six later steps can fail — `up -d`, the
health poll, the anchored check, the fallback HTTP check, AC6, the Kong guard — and each leaves the
stand stopped or unhealthy, because the previous container is already removed, its digest was never
captured, and there is no `if: failure()` restore path. **Run 937 is the live proof:** the stand
stayed genuinely unhealthy until run 938 was dispatched by hand.

The cheap version, named in the entry itself: capture the running container's digest before `down`,
restore it on `if: failure()`.

**Why it belongs here rather than being re-routed again:** epic AC4 of *this* story already
requires a live proof that *"the health check still fails correctly against a stopped stand."* That
row costs one dispatch that deliberately breaks the stand. Without a rollback it also costs a
second, repair dispatch (that is exactly what runs 937→938 were). **With the rollback, one
dispatch earns both rows** — the health check fails correctly AND the stand comes back on its own.
The rollback pays for its own evidence.

**Why it is sequenced last and committed separately:** it is a genuinely new failure path added to
an already-hardened file during a refactor, which is the combination this project keeps learning
not to make. Sequencing: prove the factoring green first (Tasks 4-6), then add rollback (Task 7),
then earn the discriminating row. If budget or time runs out at Task 7, the rollback drops out
cleanly, the factoring stands, epic AC4's health row is earned the 4.3 way (break + repair, two
dispatches), and the rollback re-routes to Story 5.3 with the shared definition already in place to
receive it.

🔴 **The restore path must not be able to make things worse.** It re-renders `.env.deploy` with the
*previously running* digest and calls `up -d`, then re-polls health. If the restore itself fails,
it says so and exits nonzero — it must never mask the original failure, and the original failure's
own message must still be in the step record. And it must run while the lock is still held: place
it **before** the release step, not after.

---

### 8. The six debts routed here — what this story closes and what it hands on

The parent instruction is that each is resolved or re-routed **with a reason**. Here is the table;
the reasoning is below it.

| Debt | Verdict | Cost |
|---|---|---|
| Rollback after `down` (4.3 H5 / 4.7 §8) | **RESOLVE** — §7, Task 7 | 0 extra dispatches (shares AC4's row) |
| Cold-pull cost unmeasured (4.7 H3) | **RESOLVE** — Task 6 | 0 extra dispatches |
| Task logs not persisting for the `deploy` job (4.7 H4) | **RESOLVE** or bound negatively — Task 8 | 0 dispatches (DB + disk + source on s1) |
| The 4s job-level vs workflow-reported gap (4.7 Task 7.5) | **RESOLVE** — Task 8 | 0 dispatches |
| Queue depth > 2 pending; `flock` wake order > 2 contenders; DF2's group-vs-capacity axis | **RE-ROUTE** | would cost 4+ dispatches |
| DF2's scheduled-actor axis | **RE-ROUTE to the coordinator** | not dispatchable from here |
| D31's two-sources-of-truth for the five stand variables | **RE-ROUTE to 4.9**, one axis closed here | 0 |

**Cold pull (H3) at zero dispatch cost.** Story 4.7's per-step profile is a warm-cache artefact: its
own Task 3.5 `docker pull`ed all five images to s1 *before* the five timed deploys ran, so the
`timeout 300` pull step had nothing to fetch and duly reported "under 2s". This story's own
green-path dispatch has to happen anyway. Remove the target image from s1 first
(`docker rmi` by digest, on the host, before dispatching — never `docker image prune`), and that
same dispatch measures a genuine cold pull. The answer 4.7 owed 4.8 — *which step dominates once
these move into a shared definition* — is then measured on the shared definition itself, which is
strictly better than measuring it on the file being replaced.

**Queue depth and wake order — re-routed, and the reason is structural, not budgetary.** Measuring
pending-depth 3 needs one running run plus three simultaneously pending, i.e. 4 dispatches, to
answer a question that **this story's own change makes less relevant**: after the factoring, each
stand carries its own concurrency group and its own `flock` on its own `stand_dir`. 5.3 and 6.4 do
not share a queue with DEV or with each other. Three-way contention on one stand requires three
humans dispatching the same stand within seconds — a shape no acceptance criterion anywhere in this
plan asks for. Route unchanged: `deferred-work.md`'s existing entry, owner *"whoever next needs
more-than-two-way ordering guarantees"*, with a note that 4.8 narrowed the blast radius rather than
measuring the depth. **The group-vs-capacity axis is re-routed as structurally unmeasurable here**
and should be recorded that way rather than left open forever: both deploy runners in this plan are
`capacity: 1` (s1's today, s10's by Story 6.10's design), so group-queueing and capacity-queueing
are indistinguishable by any observation available on either host. That is precisely why NFR10
exists and why the `flock` is the load-bearing half. Say it once, plainly, and close it negative.

**DF2's scheduled-actor axis — re-routed to the coordinator, with a method.** The hazard names the
*scheduled* run (`dev-reset.yml`, `trigger_user_id = -2`) as the potentially-evictable party.
`dev-reset.yml` carries `on: schedule:` and nothing else — there is no `workflow_dispatch` on it,
so this session cannot stage it, and adding one would be a new trigger on a proven file that this
story is forbidden from touching (§1). The natural window is the first autonomous firing, Sunday
2026-08-23 02:00 UTC, which the coordinator already owns (§12). Method, recorded so it is not
improvised: if anyone wants the axis closed live, put a `hold_lock_seconds` dispatch in flight at
~01:59:30 UTC and read `action_run` for the 02:00 scheduled row afterwards — but note this deliberately
contends with the *first* autonomous reset, which is itself an unmeasured event, and confounding two
unknowns is worse than leaving one open. **Recommendation: do not stage it on 08-23. Let the first
firing be observed clean.**

**D31's two sources of truth.** The host `.env` in `~/crm-prionex/fe-prionex-dev/` (the manual/DR
path) and the workflow's render into `.env.deploy` carry the same five values with nothing keeping
them in step. This story closes **one** axis of it for free: after the factoring, the *render* is a
single definition and the per-stand values live in exactly one place per stand — the caller's
`with:` block. The remaining axis is the host DR copy, which cannot be reconciled from here without
either writing into the stand directory (unreachable except through a sibling container, and
writing there would put the workflow into the manual path's own tree) or adding a drift check (a new
guard, which §1 forbids). **Re-route to Story 4.9**, which touches the stand directory at cutover
anyway. Record the routing in the D-record so 4.9 reads it.

---

### 9. What the callers must keep, byte for byte, or the weekly reset breaks silently

`dev-reset.yml` dispatches the deploy through the API **by workflow file name**:

`POST /api/v1/repos/CRM/fe-prionex/actions/workflows/deploy-dev.yml/dispatches`

and then confirms the run exists by grepping the runs API response for the literal byte adjacency
`"id":NNN,"title":"Deploy DEV Stand"` — a shape arrived at after **four** failed live attempts
(runs 1080, 1089, 1094, 1099).

Three invariants follow, and all three fail *silently* if broken, because the dispatch step is
deliberately non-blocking and does not wait for the deploy's outcome:

1. **The file stays named `deploy-dev.yml`.** The shared callee gets a NEW file name.
2. **The workflow's `name:` stays exactly `Deploy DEV Stand`.**
3. **`deploy-dev.yml` keeps `workflow_dispatch` with a required `ref` input** of the same name and
   type. A dispatch missing a required input returns HTTP 400 and consumes no run row — the reset
   would report a failure it cannot explain.

⚠️ And the fourth, from §5: `dev-reset.yml:156-158` carries the **same literal concurrency group**
`deploy-dev-fe-prionex-dev`, deliberately, so the sweep cannot run inside a deploy's
`pull`→`up -d` window. If this story changes the group literal in `deploy-dev.yml`, it must change
it in `dev-reset.yml` in the same commit. **The conservative choice is not to change it at all.**

---

### 10. What this costs, and why nothing here can be undone

Every push to this story's branch fires a full four-job `ci.yml` run — `ci.yml` carries
`branches-ignore` and **no `paths` filter**, so a documentation-only commit costs ~540 seconds of
wall clock and four job rows. Story 4.7's review (H1/DN4) established this as a **permanent,
repeating ledger line**, priced per push, not a single flat "closeout push":

> **Going forward, "pushes to the story's own context/work branch" is a standing, repeating ledger
> line, priced per push, not a single flat line.**

This story's declaration honours that. **Declared floor — a floor, not a ceiling** (a cancelled or
evicted run still occupies a row, and **this instance has no cancel endpoint at all**, so a
dispatch issued by mistake runs to completion):

| Line | Runs | Note |
|---|---|---|
| Context branch push (this file) | 1 | `ci.yml`, one row |
| Dev-agent write-up pushes on the work branch | 4 | per DN4, priced per push, sized for four write-up rounds |
| Implementation pushes before the PR opens | 3 | callee + caller + fix rounds |
| PR open | 1 | |
| Pushes while the PR is open | 4 | 2 rounds × 2 runs (`push` + `pull_request: synchronize`) |
| **Dispatch: green path, cold pull** (AC4a, H3) | 1 | image removed from s1 first |
| **Dispatch: 401 row** (`simulate_bad_credential=true`) | 1 | fails before `down`, stand untouched |
| **Dispatch: 404 row** (ref with no image) | 1 | fails before `down`, stand untouched |
| **Dispatch: health-fails row + rollback row** (AC4b) | 1 | the unhealthy probe ref; earns two rows |
| **Dispatch: repair** | 1 | 🔴 only if the rollback did not restore. Budgeted because "it will work" is not a budget. |
| **Dispatch: lock holder fixture** (`hold_lock_seconds`) | 1 | stages contention on a capacity-1 runner |
| **Dispatch: contended deploy** (WAIT row) | 1 | the row that proves the moved lock still queues |
| Merge to `main` → `build-main.yml` | 1 | |
| Closeout PR (open + push + merge) | 3 | |
| **Declared floor** | **24** | |

**Zero-dispatch conversion is standard procedure, not an optional efficiency** (4.4 demonstrated it
at 16 runs against a ~20 floor with zero red dispatches; 4.3 paid five reds for skipping it). Every
YAML parse, every `bash -n`, every `${{ }}` scan, the whole holder/lock primitive, and the
`runs-on` question are settled locally or by read-only query **before** the first dispatch.

**retro-D4:** declare before work; **the ledger closes only against a query, re-run after the merge
commit lands.** A ledger closed at PR-open is not closed. If the query cannot be run, close it with
the literal word **OPEN** — never a self-reported number. Final closure is the coordinator's.

Closing query (baseline = highest `action_run.id` for `repo_id=16` before this story's first
implementation push, obtained by query, not by assumption):

```sql
select id, index, workflow_id, ref, event, commit_sha, status, created
from action_run where repo_id=16 and id >= <baseline> order by id;
```

plus `count(*)` and `max(index)` in the same round so no hidden run is possible.

DB access route: `ssh root@10.67.0.1 'docker exec forgejo-postgres psql -U forgejo -d forgejo -c "<SQL>"'`.
🔴 `root@10.67.0.1` **is** s1 (`hostname -I` → `185.185.49.127 172.17.0.1 10.67.0.1 …`); Story
4.6's claim that it is a different host is incorrect and was corrected by 4.7 Task 1.3.

---

### 11. Evidence channels, and which ones to trust

| Channel | Status | Use for |
|---|---|---|
| `action_run_job` rows (DB) | Reliable | job-level `started`/`stopped`, `status` |
| `action_task_step` rows (DB) | Reliable | **per-step verdicts and timings — the primary channel** (`status`: 1=SUCCESS, 2=FAILURE, 4=SKIPPED) |
| `action_run.concurrency_group` / `concurrency_type` (DB) | Reliable | §5's survival check — `type=1` explicit, `0` auto |
| zstd task log on disk | ⚠️ **Unreliable for the `deploy` job** (H4) | per-line timestamps when it exists; path `/opt/forgejo/forgejo/gitea/actions_log/<owner>/<repo>/<shard>/<task_id>.log.zst`, shard not derivable by hand — read `log_filename` from the row. Single stdout line truncated at ~64 KB. |
| Host-side `docker inspect` / `compose ls` on s1 | Reliable | stand state; the compose `working_dir` label embedding `stand-checkout-<RUN_ID>` proves which run produced the live container |
| The runs API's `created`/`started`/`stopped` | Reliable | run-level wall clock |
| A log line saying something worked | ⚠️ | never the verdict on its own |

🔴 **Read the verdict from the job list and from the timestamps — not from a log line.** And: *do
not prove anything by grepping a bundle or a binary. Read the registry, the container, the
database, or run the command.*

Three sources for any timing claim; **if they disagree by more than a second or two, that
disagreement is the finding** — record it, do not average it. That rule is what produced the 4s gap
this story now owes an answer for.

---

### 12. 🔴 Sunday 2026-08-23 02:00 UTC — do not interfere with it

The first fully autonomous firing of `dev-reset.yml` has never happened. The scheduler's own system
actor (`trigger_user_id = -2`) has fired the workflow during Story 4.6's probe window, but never the
armed file on its real schedule. The coordinator checks after 02:00:44 UTC (the measured scheduler
delay for this repository is **44 s**, not the 1 s seen on `PRIONEX_HUB`).

**Binding, inherited from Story 4.7 §12 rule 6 and extended here:**

- **Do not merge anything into `main` between 2026-08-23 01:45 and 02:30 UTC.** Every push to the
  default branch calls `CleanRepoScheduleTasks` and re-registers this repository's schedules,
  recomputing the next run from `time.Now()` (`services/actions/notifier_helper.go:542-549,:582`).
  Story 4.7 watched the row move `id=38` → `43` → `44/45` across two merges.
- **Do not dispatch a DEV deploy in that window either.** New for this story: 4.8's matrix includes
  a dispatch that deliberately leaves the stand broken. A reset firing into that state, or queued
  behind it, confounds the first autonomous firing with this story's own red row.
- A calendar spec (`M H * * D`) survives re-registration intact — the next occurrence is derived
  from the calendar. That is why the file uses one and must keep using one.

---

### Prohibitions

🚨 A prohibition here cannot be overridden by a subtask.

1. **Do not rename `.forgejo/workflows/deploy-dev.yml`, and do not change its `name: Deploy DEV Stand`.** §9. Both break the weekly reset silently.
2. **Do not modify `.forgejo/workflows/dev-reset.yml`** — except in the single case of §9's fourth invariant (a group-literal change), which the conservative design avoids entirely.
3. **Do not change the concurrency group literal `deploy-dev-fe-prionex-dev`.**
4. **Every caller declares its own workflow-level `concurrency:` block with a literal group. The callee declares none, and carries a comment saying why.** D21 — a callee's block produces no group and no error.
5. **No `${{ }}` inside any `run:` body — not even inside a shell comment.** Forgejo substitutes inside comments too (`build.yml:812-816`), and one empty token once rejected an entire workflow with no diagnostic. Values arrive through `env:` and are referenced as shell variables. Verified **by execution** (`yaml.safe_load` + substring scan over every extracted `run:` body, plus `bash -n`), not by reading.
6. **Every step inside the callee is `run:`.** `uses:` steps do not execute on `deploy-base-dev-preprod:2026-08-07` — run 920. The job-level `uses:` in a caller is the one exception and it is server-side (§2).
7. **Never `ubuntu-latest`.** It resolves to another team's idle runner.
8. **Do not raise `timeout-minutes` anywhere without raising the holder TTL in the same edit.** Story 4.4's M1 invariant: TTL (720 s) exceeds the deploy job's timeout (600 s) by an undocumented margin, and raising the timeout past ~12 minutes silently unmakes the lock guard. The refactor must make that invariant **explicit and asserted**, since both values become inputs.
9. **Do not delete `simulate_bad_credential` or `hold_lock_seconds`.** They are permanent regression hooks and this story's own outcome matrix depends on both. They move into the shared definition; they do not disappear.
10. **Do not touch `docker-compose.server.yml`, anything under `.github/`, or the legacy stand.** NFR5, D7 — "GitHub не трогаем" is a standing directive, not an inference. Verify by diff (`git diff origin/main --name-only`), not by assumption.
11. **Do not read, merge, cherry-pick or build on `story-4-5/pr-1-context`.** Parked by Oleg 2026-08-21.
12. **No credential value in a transcript, ever** — not a prefix, not a `cut -c1-30`, not an echoed 401 body. Pipe tokens directly into `curl --config -` / `docker login --password-stdin` / `GIT_CONFIG_*`. Story 4.7 violated this twice and the rotation decision is still Oleg's.
13. **Do not add Slack.** §1.
14. **Never `docker network create`. Never `docker image prune`.** The sweep in `dev-reset.yml` is anchored and targeted for a reason; s1 hosts another team's production.
15. **No dispatch and no `main` merge between 2026-08-23 01:45 and 02:30 UTC.** §12.

---

## Acceptance Criteria

**Given** the reuse support established in Story 1.3
**When** the shared mechanics are factored out
**Then** the copy, `down`, fail-fast pull, `up -d`, parameterized health check, lock and ~~Slack~~
steps live in a single reusable definition
**And** the mechanism used is the one Story 1.3 proved works on this instance.

> ⚠️ **2026-08-14 (epic):** the shared definition is factored **without** the notification step.
> Story 4.5 is resequenced to last and adds it afterwards — a deploy must work without it.
>
> 🔴 **AMENDED 2026-08-22 — "the mechanism Story 1.3 proved" is not the right citation.** Story
> 1.3's Probe C was read for two years of stories as having settled `workflow_call`. **It had not**
> — it declared no inputs, no secrets, no outputs, no `concurrency` block and one trigger, and
> Story 1.3's own table listed `secrets: inherit` under *"expectations to test against, not
> findings"* (`deferred-work.md:1860-1875`). The mechanism this story uses is the one **D21** proved
> (Story 3.4, probe runs 617-631, live twice in this repository since). The AC is satisfied in
> substance — the mechanism was established by test on this instance — and the citation is
> corrected in writing rather than left pointing at a probe that proves less than it is credited
> with.

---

**Given** neither `workflow_call` nor composite actions are supported by this Forgejo version
**When** the fallback is chosen
**Then** the shared logic is extracted into a version-controlled shell script that the workflows
invoke
**And** the triplication is confined to a thin invocation rather than the whole procedure.

> 🔴 **PREMISE FALSIFIED — this AC's Given is not met, and the fallback is therefore NOT taken
> (2026-08-22).** Composite actions are dead on the deploy runner (run 920); `workflow_call` works
> (D21). See §2 for the table and §3 for why the shell-script shape is the wrong answer even where
> it is available — it would collapse the 22 `action_task_step` rows that are the only surviving
> per-step evidence for the one job whose logs do not persist (H4).
>
> ⚠️ **The fallback is not discarded, it is held in reserve.** §4's ladder keeps a per-step script
> variant as option (c), reachable only if R1 (`runs-on` as an input) comes back negative AND
> options (a) and (b) also fail. If the ladder is ever descended, this AC becomes live again
> exactly as written — including its second clause, which is the real requirement: **the
> triplication is confined to a thin invocation rather than the whole procedure.**

---

**Given** the shared definition
**When** it is parameterized
**Then** deploy-runner label, stand directory, container name, port, environment label and image
tag are all inputs
**And** no target host is passed, because the runner label determines the host
**And** no environment-specific value is embedded in it.

> ⚠️ **ADDED 2026-08-22 — four parameters the epic's list does not name, all of them real.**
> `compose_project_name` and `frontend_network` (two of the five variables
> `docker-compose.stand.yml` requires and neither of which is covered by "container name" or
> "port"); the lock/health constants `lock_wait_seconds` / `lock_ttl_seconds` /
> `health_timeout_seconds` (which must be inputs because Prohibition 8's invariant now spans two
> inputs and has to be asserted, not assumed); and **`expect_unrouted_api`** — see §6. The Kong
> guard's `no Route matched` signature check encodes *DEV's Kong configuration today* as an
> invariant, and PRE-PROD's Kong runs 69 containers of real services. Unparameterized, it fails
> every PRE-PROD deploy, and it fails them in Story 5.3, not here.
>
> 🔴 **NARROWED 2026-08-22 — the concurrency group is deliberately NOT an input.** A callee's own
> `concurrency:` block is silently void (D21, §5). The group lives in each caller as a literal, one
> per stand. Making it an input would produce a parameter that reads as load-bearing and does
> nothing — the exact failure shape D8 already recorded for job-level `concurrency:`.
>
> ⚠️ **METHOD NOTE — "deploy-runner label is an input" is the single riskiest clause in this
> story.** §4/R1. It is settled in Task 1 before any of the callee is written, and it has a
> four-rung fallback ladder whose bottom rung is an escalation to Oleg, not a workaround.

---

**Given** `deploy-dev.yml` from Story 4.3
**When** it is refactored onto the shared definition
**Then** a DEV deploy still succeeds end to end
**And** the health check still fails correctly against a stopped stand.

> ⚠️ **METHOD NOTE — how "a stopped stand" is staged, and why it is not `docker stop`.** The deploy
> runs `down` then `up -d`, so a hand-stopped container is recreated before the health poll ever
> reads it. The proven stage is Story 4.3's own: dispatch the ref `test/4-3-unhealthy-probe`, whose
> published image fails its own healthcheck — that is what run 937 did, and it left the stand
> genuinely unhealthy until run 938 repaired it by hand. 🔴 **Verify the probe image still exists
> before planning around it:** `-dev` tags expire at **14 days** under `package_cleanup_rule` id 1,
> and that rule lives only in the Forgejo DB — no API, no CLI. The probe image was published around
> 2026-08-20. If it has expired, the branch must be re-pushed to rebuild it (which costs a `ci.yml`
> run plus a `build.yml` expansion — budget it before spending it).
>
> ⚠️ **This row is also the rollback row (§7).** With Task 7's restore path in place, the same
> dispatch proves the health check fails correctly AND that the stand returns to its previous
> digest without a human. Without Task 7, it costs a second, repair dispatch. Both outcomes are
> budgeted in §10.
>
> 🔴 **retro-E5 applies to this whole story, not just to this AC.** *"Every new guard ships a live
> outcome matrix including a discriminating run."* A refactor does not ship new guards — it ships
> **the same guards on a new path**, and a guard on an unexercised path is exactly a guard that
> cannot fail. The full matrix this story owes is in Task 6, and it is the largest line in the
> budget on purpose.

---

**Given** the shared definition exists
**When** the remaining deploy workflows are written in Epics 5 and 6
**Then** they consume it rather than copying it.

> 🔴 **NARROWED 2026-08-22 — this AC cannot be closed by this story, and pretending otherwise is
> the failure mode.** `deploy-preprod.yml` and `deploy-prod.yml` do not exist; Stories 5.3 and 6.4
> write them. What this story CAN discharge, and must:
> **(a)** the callee's input surface is complete for both consumers — checked line by line against
> Story 5.3's ACs (`image_tag` required and rejected-if-absent; the lock on the PRE-PROD stand
> directory; fails before stopping the running container on a missing tag) and Story 6.4's (a
> different `runs-on` label on s10; an optional `rollback` boolean whose true path pulls without
> rebuilding — note that path needs no build step, so it is a *caller* concern, not a callee one);
> **(b)** a caller skeleton is committed — as a fully commented block inside the shared definition's
> own header, not as a fourth workflow file that would sit in `.forgejo/workflows/` with no trigger
> and no purpose;
> **(c)** `epics.md` 5.3 and 6.4 are amended in place wherever the shipped shape differs from what
> they assume — Story 4.4's L1 is the precedent: *an AC that shipped differently and was not
> amended is a defect the next story inherits*;
> **(d)** [D33](../../docs/migration-decisions.md) records the contract, because a D-record is what
> 5.3 and 6.4 will actually read.
> Two sibling projects copied their deploy into their reset and booked the debt. This project
> refused that twice already (Story 4.6 AC3 by name). Discharging (a)-(d) is how the refusal stays
> refused.

---

## Tasks / Subtasks

### Task 1 — Settle R1 and bind the facts before writing a line (AC: 3, all)

- [ ] 1.1 Record the baseline: highest `action_run.id` for `repo_id=16` **by query**, before the
      first implementation push. Record it in the Run Budget Ledger. Do not estimate it.
- [ ] 1.2 🔴 **R1: does this Forgejo build interpolate `${{ }}` in `runs-on`?** Settle it read-only
      on s1 first — the source/binary, the same way Story 4.6 settled the schedule and dispatch
      questions. Record the file and line you read, or record honestly that the code could not be
      located. Then record which rung of §4's ladder the design takes and why. **Do not spend a
      dispatch on this before the callee exists** — the first real dispatch confirms it for free.
- [ ] 1.3 Confirm `workflow_call` expansion has never targeted `deploy-dev-preprod` (it has not)
      and state the residual risk in one sentence. Expansion is server-side; the risk is that the
      *label* resolution for an expanded job differs from a dispatched one. Nothing to do but name
      it and watch the first dispatch.
- [ ] 1.4 Verify the probe image for AC4's failing row still exists: resolve `test/4-3-unhealthy-probe`'s
      `-dev` tag against the registry with the read-only credential. If expired (14-day rule),
      decide and record the replacement plan and its extra cost **before** Task 6 depends on it.
- [ ] 1.5 Verify the two org secrets still reach this repo (`REGISTRY_USER_RO`, `REGISTRY_TOKEN_RO`)
      and note the `fe_review_1_7` revocation state — if a ledger query returns `401`, **that is the
      revocation, not a bug**; fall back to `fe_tmp_1_7`, record it, never print a value.
- [ ] 1.6 Confirm the deploy runner is still `capacity: 1` and that its four labels are unchanged.
      The lock's whole argument rests on the first; §4's ladder rests on the second.
- [ ] 1.7 Read `deploy-dev.yml` end to end **before editing it**. Produce the step inventory:
      22 `deploy` steps + 5 jobs, each tagged `MOVES` / `MOVES WITH A LITERAL REPLACED` /
      `STAYS IN THE CALLER`. This inventory is the diff review's own checklist and the story's proof
      that nothing was dropped in transit.
- [ ] 1.8 Declare the run budget (§10's table) in the Dev Agent Record before the first push.

### Task 2 — Write the shared definition (AC: 1, 3)

- [ ] 2.1 Create `.forgejo/workflows/deploy-stand.yml`. `on: workflow_call:` and **nothing else** —
      no `workflow_dispatch` (that would make it independently dispatchable with no concurrency
      group at all), no `push`, no `schedule`.
- [ ] 2.2 Declare the typed inputs from §6's table. Every one **required with no default** except
      the tuning constants (`lock_wait_seconds` 240, `lock_ttl_seconds` 720,
      `health_timeout_seconds` 120) and `expect_unrouted_api` (default `true`, DEV's behaviour
      today). A missing stand identity must fail closed, exactly as `docker-compose.stand.yml`'s own
      five `${VAR:?…}` guards do.
- [ ] 2.2a 🚨 **Input TYPES on the `workflow_call` half are a live trap with a catastrophic,
      invisible failure mode.** `build.yml:44-51` records it from measurement: `type: choice` is not
      a legal `workflow_call` input type, and declaring it **makes Forgejo reject the whole FILE at
      pre-execution** — no job, no log, the error visible only in
      `action_run.pre_execution_error_details` (D21/D22-era finding). `deploy-dev.yml` today declares
      `simulate_bad_credential` as `type: boolean` and `hold_lock_seconds` as `type: number` on its
      **dispatch** half; whether either is legal on the **call** half has never been measured on this
      instance. **Decision (autonomous, subject to Oleg's veto): declare every callee input as
      `type: string`** and validate/coerce inside the job — which the file already does for
      `hold_lock_seconds` ("rejected if non-numeric", Story 4.4 Task 5.2). This is exactly the
      downgrade `build.yml` already made for `environment` (`choice` → `string`, validated by a
      fail-closed `case` default), it costs nothing, and it removes a whole-file rejection from the
      risk surface. The caller keeps its richer dispatch types unchanged, exactly as `build.yml` does.
- [ ] 2.11 Map epic AC1's named elements onto the shipped steps and assert coverage explicitly in the
      record — *the copy* (obtain `docker-compose.stand.yml` at the deployed ref + write the five
      variables), *`down`*, *fail-fast pull* (resolve digest → pull, nothing torn down until it
      succeeds), *`up -d`*, *parameterized health check* (bounded poll + anchored assert + fallback
      HTTP, all reading identity back from `.env.deploy`), *lock* (acquire/release). ~~Slack~~ is
      excluded by the epic's own 2026-08-14 amendment. An element that cannot be pointed at a step is
      a gap, not a naming difference.
- [ ] 2.3 🔴 **Fail-closed "exactly one of `ref` / `image_tag`" as the first step of the deploy job.**
      §6. Both supplied, or neither, is a hard stop with a message naming which caller sent what.
      This is the seam 5.3 needs and the one place a wrong answer is silent.
- [ ] 2.4 Move the five jobs (`hold-lock`, `preflight`, `clone-test`, `digest-resolve-test`,
      `deploy`) with their `needs:` graph intact. 🔴 `deploy` needs `[preflight, clone-test]` and
      **not** `digest-resolve-test` — that was Oleg's decision (DN1, Story 4.3): the diagnostic
      issues the same request with the same credential and re-adding it to `needs:` masks AC4's 404
      and AC7's 401 classifiers behind a sibling job's generic failure.
- [ ] 2.5 Preserve the canonical step order, which Story 4.4 Task 8.3 fixed by name:
      resolve → pull → checkout → write-env → **acquire** → hand-provisioned-guard →
      capture-network → `down` → `up -d` → health → anchored → fallback-HTTP → AC6 → Kong-guard →
      post-deploy-record → **release** → duration → cleanup.
- [ ] 2.6 Collapse the **duplicated holder-launch block**: the `docker run -d --init … flock …`
      construction exists twice today (`:295-350` in the fixture, `:1188-1227` in the acquire step)
      with the same constants and the same BusyBox workarounds. One definition. 🔴 Keep `--init`
      (PID 1 swallows `timeout`'s SIGTERM without it — measured) and keep the absence of `--rm`
      (M15: `.State.ExitCode` must survive for diagnosis).
- [ ] 2.7 Assert Prohibition 8's invariant **in the file**: `lock_ttl_seconds` must exceed the
      deploy job's own timeout. Today that is `720 > 600` and it holds only because nobody asserted
      it. Now that both are configurable, assert it and fail closed.
- [ ] 2.8 🔴 **No `concurrency:` block in the callee**, with a comment block explaining that one
      would be silently void (D21) and that the group lives in every caller.
- [ ] 2.9 Keep `IMAGE_REPO` as the callee's workflow-level `env:` (§6). One registry, all stands.
- [ ] 2.10 Header comment block: the mechanism, the D21 caller-owns-concurrency rule, the
      `uses:`-does-not-execute rule, the `${{ }}` rule, the M1 TTL invariant, and §5's
      dispatch-chain rejection. ⚠️ **History belongs in comments, not in job names** — Story 4.3's
      L12 warned that 4.8 would inherit job names carrying run numbers and story tasks. Strip
      story/run references from `name:` fields as they move; keep them in comments. This is the one
      "tidying" §1 explicitly permits, because the names become permanent across three environments.

### Task 3 — Refactor `deploy-dev.yml` into a thin caller (AC: 3, 4)

- [ ] 3.1 Reduce it to: `name: Deploy DEV Stand` (unchanged), its three `workflow_dispatch` inputs
      (unchanged names and types), its literal `concurrency:` block (unchanged), and one job with
      `uses: ./.forgejo/workflows/deploy-stand.yml`, `with:` the DEV values, `secrets: inherit`.
      🔴 **All three dispatch inputs are forwarded**, not just `ref`: `simulate_bad_credential` and
      `hold_lock_seconds` are the permanent regression hooks this story's own matrix rows 6.3 and 6.6
      depend on (Prohibition 9). Forwarding a `boolean`/`number` dispatch input into a `string`
      callee input (Task 2.2a) is an expression in `with:`, which works — but verify the rendered
      value is what the callee's own validator expects, because `hold_lock_seconds`'s gate is
      `> 0` and Story 4.6's H5 finding was precisely that *"a value falling between two gates
      produces a green run that deploys nothing."*
- [ ] 3.2 🔴 Verify §9's three invariants by inspection and say so in the record: file name,
      workflow `name:`, and the `ref` input's name/type/required-ness. The weekly reset depends on
      all three and would fail silently.
- [ ] 3.3 ⚠️ `secrets: inherit` is all-or-nothing (`on.workflow_call.secrets` is rejected by the
      parser and repo secrets are not ambient in a callee — D21). The callee therefore receives
      every org secret including `REGISTRY_TOKEN_RW` and the OpenBao credentials. It references
      only `REGISTRY_USER_RO` / `REGISTRY_TOKEN_RO`. **State this explicitly in the header, and flag
      it for Story 6.4**, where a production caller inherits production credentials on every DEV-shaped
      code path.
- [ ] 3.4 ⚠️ D21: a `uses:` job's `if:` is copied DOWN into the expanded callee and re-evaluated
      there, where `github.event_name` is `workflow_call`. **Do not put an `if:` on the caller's
      `uses:` job.** The `hold_lock_seconds` gating lives inside the callee, on the callee's own
      jobs, where `inputs` are in scope.
- [ ] 3.5 ⚠️ `${{ github.ref_name }}` in a caller's `with:` reaches the callee **empty** (D21, run
      632). If the caller needs to pass a branch, derive it in bash from `GITHUB_REF` — never
      through `with:`.
- [ ] 3.6 Verify by execution before pushing: `yaml.safe_load` both files, extract every `run:`
      body, scan for `${{`, `bash -n` each one. Report the counts (`deploy-dev.yml` had 30 clean
      bodies at baseline).
- [ ] 3.7 `git diff origin/main --name-only` — confirm nothing under `.github/`,
      `docker-compose.server.yml` or `dev-reset.yml` is touched (NFR5/D7, Prohibitions 2 and 10).

### Task 4 — Prove the primitive locally, at zero dispatch cost (AC: 4)

- [ ] 4.1 On s1, re-run Story 4.4's lock primitive tests against the **moved** holder block: acquire,
      release, two genuinely simultaneous processes, the TTL-bounded orphan, and the forced-failure
      paths. Same tests, new code location.
- [ ] 4.2 Render the callee's `.env.deploy` writer with DEV's inputs by hand and diff it byte-for-byte
      against `deploy-dev.yml`'s baseline output. Any difference is a defect, not a style choice.
- [ ] 4.3 🔴 Do not use `docker compose config` as a proof of anything. It renders exit 0 against a
      network that does not exist; only `up` refuses (Story 4.1, matrix row 7 —
      `deferred-work.md:2409-2422`, which names this story as an owner precisely so it is not
      reached for here).
- [ ] 4.4 Verify the ref→tag sanitizer moved byte-identically: `sed -E 's/[^a-zA-Z0-9._-]+/-/g' | cut -c1-100`,
      plus the bare-SHA → `sha-<12hex>-<env>` branch. `build.yml` exposes no `outputs:`, so a drift
      here produces a tag that does not exist and a 404 that blames the registry.
- [ ] 4.5 Remove the target image from s1 by digest before Task 6.1's dispatch, so that dispatch
      measures a **cold** pull (H3, §8). `docker rmi` by explicit id. **Never** `docker image prune`.

### Task 5 — Push, open the PR, and land the factoring (AC: 1, 3)

- [ ] 5.1 Push. 🔴 Dispatches in Task 6 read the workflow file from the **story branch**, not from
      `main` — `workflow_dispatch` from a non-default branch works (measured, run 917), and
      `uses: ./…` resolves the callee at the caller's own ref, so the pair travels together. This is
      what makes the whole matrix earnable **before** merging.
- [ ] 5.2 Open the PR. Record run ids for the push and the PR-open rows as they occur, not at the end.

### Task 6 — Re-earn the outcome matrix on the refactored path (AC: 4; retro-E5)

Each row is a **real dispatch on the real runner**, dispatched with the story branch as the outer
ref. For each row record: run id, trigger, inputs, the job list's own verdict, the discriminating
message the guard printed, and dispatch/finish timestamps from the API. Read the verdict from the
job list and the DB, never from a log line.

- [ ] 6.1 **PASS (AC4a) — a DEV deploy still succeeds end to end, on a cold pull.** Inner `ref=main`.
      Record: the full 22-step `action_task_step` sequence, the container's `working_dir` label
      carrying `stand-checkout-<RUN_ID>`, the digest identity (AC6), and the **cold pull duration**
      (§8, H3's answer).
- [ ] 6.2 🔴 **The concurrency survival check — zero extra dispatches, and the single most important
      query in this story.** For 6.1's run read `concurrency_group` and `concurrency_type` from
      `action_run`. **`type=1` and the literal `deploy-dev-fe-prionex-dev` means the caller's block
      survived. `type=0` means the guard is gone and the file lies.** If it comes back `0`, stop and
      re-read §5 — something about the caller/callee relationship is not what D21 measured.
- [ ] 6.3 **FAIL, discriminating (AC7) — the 401 row.** `simulate_bad_credential=true`. Confirm the
      classifier's `[SIMULATED …]` marker is present and that `down` never ran (step status SKIPPED).
- [ ] 6.4 **FAIL, discriminating (AC4/404) — the missing-image row.** A ref with no published image.
      Confirm the message names the missing tag, and that the stand kept serving (host-side
      `docker inspect` before/after: same container id, same digest).
- [ ] 6.5 **FAIL, discriminating (AC5) — the health check fails correctly against a stopped stand.**
      The `test/4-3-unhealthy-probe` ref (Task 1.4 confirmed it). This dispatch deliberately breaks
      the stand. 🔴 **Do not run it inside 2026-08-23 01:45-02:30 UTC** (§12).
- [ ] 6.6 **WAIT, discriminating (Story 4.4 AC3) — the moved lock still queues.** Dispatch the
      `hold_lock_seconds` fixture, then a real deploy behind it. Baseline for comparison: the
      uncontended `deploy` job is ~21-23 s; the contended one was ~146 s (~6.6×). Record both.
- [ ] 6.7 Rows the story does **not** re-earn live, argued rather than dispatched, and each argument
      recorded: the anchored `docker ps` demonstration (host-side, no dispatch — Story 4.3's 8.5),
      the lock's FAIL and STALE rows (4.4's 7.3/7.4 — the acquire/release block moves byte-identically
      and its holder-detection logic is unchanged; the object identity is provable by diff). 🔴 If the
      diff shows **any** change inside those blocks beyond a literal→input substitution, the argument
      is void and the row must be dispatched.

### Task 7 — Add the post-`down` rollback, separately committed (AC: 4; §7)

🔴 **Do not start this task until Task 6 is green.** If it is dropped, say so in the record and
re-route the mechanism to Story 5.3 in `deferred-work.md` with the reason.

- [ ] 7.1 Capture the running container's image digest **before** `down` (read `.Image`, then
      inspect that — `docker inspect <container>` has no `.RepoDigests`, measured run 925).
      Handle the legitimate empty case: there may be no previous container at all.
- [ ] 7.2 Add an `if: failure()` restore step placed **after** the six steps that can fail post-`down`
      and **before** the lock release. Re-render `.env.deploy` with the captured digest, `up -d`,
      re-poll health.
- [ ] 7.3 🔴 The restore must never mask the original failure: the job still exits nonzero, and the
      original failure's own message stays in its own step's record. A restore that itself fails
      says so plainly and does not retry.
- [ ] 7.4 ⚠️ `if: always()` / `if: failure()` do **not** survive a cancel or a `timeout-minutes`
      expiry (Story 4.4 M5). State that limit in the file rather than implying the restore is
      unconditional.
- [ ] 7.5 Earn its discriminating row on the **same** dispatch as 6.5: the health check fails AND the
      stand comes back to its previous digest with no human. Record the before/after digests from
      the host. If the restore does not work, record that honestly and spend the budgeted repair
      dispatch.

### Task 8 — Answer the two measurement debts at zero dispatch cost (AC: all; §8)

- [ ] 8.1 **H4 — why the `deploy` job's task log does not persist.** Investigate through the DB and
      the disk, not by inference. Suggested line of attack, in order: (a) query `action_task` for
      `repo_id=16` and correlate `log_in_storage=false` against `log_size`, `log_length`, step count
      and job name across every run this repository has produced — is the correlation size-shaped,
      name-shaped, or neither? (b) check the named `log_filename` paths on disk and the parent
      directory's shard layout; (c) check the Forgejo log-storage code path on the instance for the
      write/rename/commit sequence and any size threshold. Deliverable: a stated cause **or** a
      stated bounded negative naming exactly what was excluded. 🔴 A guess recorded as a finding is
      worse than an open item.
- [ ] 8.2 **The 4s gap.** Three sources on 6.1's own run: `action_run_job` `started`/`stopped`, the
      per-line timestamps in the task log if it persisted, and the workflow's own
      `Record wall-clock duration` line. The callee path adds one new comparison the dispatch path
      could not offer: the delta between a *called* job's scheduling overhead and a *dispatched*
      one's. If the gap is the same on both, it is container startup; if it differs, it is the
      expansion. Either answer closes the item.
- [ ] 8.3 If either resists, close it with the literal word **OPEN** and re-route it with an owner.
      Neither is worth a dispatch.

### Task 9 — Discharge AC5's forward contract (AC: 5)

- [ ] 9.1 Walk Story 5.3's ACs line by line against the callee's input surface. Confirm: `image_tag`
      required-and-rejected-if-absent is expressible; the lock takes the PRE-PROD `stand_dir`; a
      missing tag fails before stopping the running container; `expect_unrouted_api: false` is
      available. Record any gap **as a gap**, in `epics.md`, not in a comment here.
- [ ] 9.2 Walk Story 6.4's ACs the same way. Confirm: a different `runner_label` (R1 — §4 — this is
      where a negative answer actually bites), the `rollback` boolean's no-build path is a **caller**
      concern, and `secrets: inherit` handing production credentials to a shared callee is named
      (Task 3.3).
- [ ] 9.3 Commit the caller skeleton as a commented block in `deploy-stand.yml`'s header. Not a
      fourth workflow file.
- [ ] 9.4 Amend `epics.md` 5.3 and 6.4 in place wherever the shipped shape differs from what they
      assume. Story 4.4's L1 is the precedent: *an AC that shipped differently and was not amended is
      a defect the next story inherits.*
- [ ] 9.5 ⚠️ **KONG_PORT does not block this story, and say so explicitly.** The Kong guard resolves
      `crm-kong-gateway` by name and probes `/api/` through the stand's own nginx — no port literal
      is involved. The open `KONG_PORT=8330` question (published host port or in-network?) belongs
      to 6.4-era work. What 4.8 hands forward instead is `expect_unrouted_api` (§6), which is the
      thing that would actually have broken 5.3.

### Task 10 — Record, route, and close (AC: all)

- [ ] 10.1 Write [D33](../../docs/migration-decisions.md) in Russian, following the house rules: a
      new index-table row **and** a Change Log row, or the record is not added; bodies are never
      rewritten, only amended by an appended block; verify D33 is still the next free number against
      open branches before claiming it. Contents: the mechanism choice and the three rejections with
      their measured reasons (composite actions/run 920; dispatch-chain/§5; monolithic
      script/H4-§3); R1's answer and which ladder rung was taken; the caller-owns-concurrency rule
      and 6.2's measured confirmation; the full parameter surface including `expect_unrouted_api`;
      the rollback's presence or documented absence; H3's cold-pull number; H4's and the 4s gap's
      answers or their bounded negatives.
  - 🔴 **`D4`/`E5` collide across two numbering schemes.** The retro action items
    (`epic-3-retro-2026-08-18.md:77-78`) are **retro-D4** / **retro-E5**. The D-series in
    `docs/migration-decisions.md` is a different sequence — its `D4` is stand parameterization and
    it has no `E5`. Write `retro-D4` / `retro-E5` when you mean the retro's.
- [ ] 10.2 Append to `deferred-work.md` at EOF — never rewrite in place; closures go **under** the
      original; superseded text is struck (`~~…~~`), not deleted; owners are names or story numbers,
      never trigger conditions. Route: the queue-depth/wake-order/group-vs-capacity items (§8, with
      the by-construction narrowing), DF2's scheduled-actor axis (to the coordinator, with the
      recommendation NOT to stage it on 08-23), D31's two-sources-of-truth (to Story 4.9, with the
      one axis this story closed), and the rollback if Task 7 was dropped.
- [ ] 10.3 Update `epics.md` Story 4.8's AC1/AC2/AC3/AC5 in place with the amendments this file
      records, marked `🔴 AMENDED 2026-08-22`. An amendment that lives only in a story file is
      invisible to the next create-story session.
- [ ] 10.4 Close the run ledger **by query**, re-run after the merge commit lands. If it cannot be
      run, write **OPEN**. Never a self-reported number.
- [ ] 10.5 List every autonomous decision actually taken in Dev Notes §11's format, so a veto costs
      one read.

---

## Dev Notes

🔴 **Two numbered sequences in this file.** A bare `§N` refers to the pre-AC block ("Read this
before anything else"). `Dev Notes §N` refers to the sections below.

### 1. The one-paragraph version

Extract `deploy-dev.yml`'s five jobs and 22 deploy steps into a `workflow_call` callee,
`.forgejo/workflows/deploy-stand.yml`, parameterized by the stand's identity; reduce `deploy-dev.yml`
to a thin caller that keeps its own name, its own inputs and — critically — its own `concurrency:`
block, because a callee's block is silently void. Re-earn the four guard rows and the lock's WAIT row
on the refactored path by real dispatch from the story branch. Answer the cold-pull and timing debts
for free off those same runs. Add the post-`down` rollback last, on its own commit, where it pays for
its own evidence. Hand 5.3 and 6.4 a contract that includes the one parameter nobody had named:
whether the stand's Kong is expected to have no route for `/api/`.

### 2. The deploy path as shipped — the map you are refactoring

`deploy-dev.yml`, 1875 lines, unchanged since Story 4.4's fix-pass (`e0f5a75b`).

**Trigger:** `workflow_dispatch` only. Three inputs: `ref` (required string), `simulate_bad_credential`
(boolean, default false), `hold_lock_seconds` (number, default 0).

**Workflow-level:** `concurrency: {group: deploy-dev-fe-prionex-dev, cancel-in-progress: false}`;
`env: IMAGE_REPO: git.crm-prionex.com/crm/fe-prionex`.

**Jobs**, all `runs-on: deploy-dev-preprod`:

| Job | `needs:` | `if:` | timeout | Role |
|---|---|---|---|---|
| `hold-lock` (`:235`) | — | `hold_lock_seconds > 0` | 15 | contention fixture; does not deploy |
| `preflight` (`:460`) | — | `!(hold_lock_seconds > 0)` | 3 | secrets present, registry reachable, `flock`/`timeout` exist |
| `clone-test` (`:575`) | `preflight` | — | 3 | authenticated git fetch works |
| `digest-resolve-test` (`:651`) | `preflight` | — | 3 | **non-gating** diagnostic |
| `deploy` (`:748`) | `[preflight, clone-test]` | — | 10 | the deploy |

**`deploy`'s 22 steps, in file order:** record start · validate/sanitize ref · registry login ·
resolve digest · pull · obtain `docker-compose.stand.yml` at the deployed ref · write the five
variables · **acquire lock** · hand-provisioned-stand guard · capture network id · `down` · `up -d` ·
confirm network not created · poll health · anchored container assert · fallback HTTP via a
`--network host` sibling · AC6 digest match · Kong alias guard · post-deploy record ·
**release lock** (`always()`) · duration (`always()`) · remove `DOCKER_CONFIG` (`always()`).

### 3. Infrastructure facts

| Fact | Value | Source |
|---|---|---|
| Deploy runner | `s1-deploy-dev-preprod` id 14, **`capacity: 1`**, four registered labels; use `deploy-dev-preprod` | Story 4.4 Task 2.1; D-index |
| Job image | `deploy-base-dev-preprod:2026-08-07`; runs as **uid 0 / root**; `uses:` steps do not execute | run 920 |
| Job tooling | docker client 27.5.1 / server 29.4.0, compose v2.33.0, git 2.47.2, curl, jq, wget; `flock` and `timeout` are **BusyBox v1.37.0** | Story 4.4 Task 2 |
| BusyBox traps | `flock` has no `-w` (use `timeout N flock FD`); `date -d` cannot parse Docker timestamps or offsets — do shell arithmetic instead | 4.4; 4.6 sweep bug |
| Shell | steps run as `bash --noprofile --norc -e -o pipefail` — `ash` compatibility is moot, `date` compatibility is not | run 1072's log |
| Runner mounts | `docker.sock`, `/opt/crm-preprod`, `/opt/crm-dev`, `--add-host=git.crm-prionex.com:10.70.0.1`; `/root` is `drwx------` | D28 §4 |
| `valid_volumes` | constrains what the RUNNER mounts, **not** what a job does through `docker.sock` — measured | 4.4 Task 2.2 |
| Stand | `fe-prionex-dev` on `crm-dev-network`, `127.0.0.1:8082` (host-loopback only — unreachable from any container; use a `--network host` sibling) | D28; runs 925/927 |
| Lock | `/root/crm-prionex/fe-prionex-dev/.deploy.lock`; holder `fe-prionex-dev-deploy-lock-<RUN_ID>`, `--init`, no `--rm`; `WAIT=240`, `TTL=720` | D30 |
| Registry | `git.crm-prionex.com/crm/fe-prionex`; org secrets `REGISTRY_USER_RO`/`REGISTRY_TOKEN_RO` (bot `robot-deploy`, `read:package`) | D29 |
| Repo checkout | `github.token` only — `read:package` is refused for git fetch (`403 … required scope(s): [read:repository]`); deliver via `GIT_CONFIG_COUNT`/`_KEY_0`/`_VALUE_0`, never argv | runs 919/922 |
| `-dev` tag lifetime | **14 days**, `package_cleanup_rule` id 1, DB-only — no API, no CLI | D-record / Story 1.11 |
| Forgejo | v15.0.5 (+gitea 1.22.0); `repo_id=16`; DB via `ssh root@10.67.0.1 'docker exec forgejo-postgres psql -U forgejo -d forgejo -c "…"'`; `root@10.67.0.1` **is** s1 | 4.7 Task 1.3 |
| No cancel endpoint | `POST .../actions/runs/{id}/cancel` → 404 against the full swagger. **A dispatch issued by mistake runs to completion.** | `deferred-work.md:94-98` |
| Dispatch with a missing required input | HTTP 400, **consumes no run row** | 4.4 |
| `workflow_dispatch` from a non-default branch | works — measured | run 917 |
| `ci.yml` cost | ~540 s per push; Lint ~140 s, Type Check ~85 s, Unit Tests ~470-540 s, Build ~110 s; **no `paths` filter** | 4.7 |

### 4. Measured baselines this refactor is checked against

| Quantity | Baseline | Source |
|---|---|---|
| `deploy` job, uncontended | **21-23 s** | runs 962, 968, 1118, 1121 |
| `deploy` job, contended (waiting on the lock) | **~146 s** (~6.6×) | run 965 |
| Run-level wall clock (whole run, incl. preflight/clone-test) | **41-47 s** | 4.7, five deploys |
| Workflow-self-reported duration | 18-19 s — **4 s below job-level, unexplained** | 4.7 Task 7.5 |
| Dominant step (warm cache) | confirm-network + health poll, **~5.3 s**; next-largest ~1.8 s | 4.7 Task 7.4 |
| Pull step (warm cache) | **under 2 s** — 🔴 warm-cache artefact, cold is unmeasured (H3) | 4.7, corrected post-review |
| Health poll utilization | ~4.5 % of its 120 s bound | 4.7 |
| NFR2 budget | **< 10 minutes** per DEV deploy | epics.md |
| Scheduler delay for this repo | **44 s** | 4.6 |

**The refactor's own bar:** if the refactored `deploy` job's uncontended duration lands materially
outside 21-23 s (allowing for the cold pull in 6.1, which should be *stated separately*), that is a
finding, not noise. Record it against this table.

### 5. Anti-patterns for this story

- **Proving the group survived by timing.** Two runs that did not overlap prove nothing on a
  `capacity: 1` runner. Read `concurrency_group`/`concurrency_type` from the DB. Story 4.7's review
  (M2) removed exactly this inference from a shipped story.
- **`docker compose config` as a gate.** Exit 0 against a nonexistent network. Only `up` refuses.
- **Building an evidence step that is less robust than the mechanism it verifies.** Story 4.6's
  read-back took four live attempts and 23 of 39 runs. *"Prefer the narrowest possible extraction
  (grep/byte-pattern, integer comparison) over a general-purpose parser, even a 'simple' one."*
- **`X="$(cmd)"` under `set -euo pipefail` feeding an `if`.** The step dies at `cmd` and the message
  written for that case never prints. Use `X="$(cmd || true)"` or
  `X="$(cmd)" || { echo "FAIL: …"; exit 1; }`. For `curl -w '%{http_code}'` specifically: plain
  `|| true`, never `|| echo '000'` — curl already writes `000` itself and the fallback double-appends.
- **Unanchored `docker ps --filter name=`.** Substring match; `name=fe-prionex` returns five
  containers on s1.
- **Assuming an empty result is evidence of absence.** This project's standing rule: unverified is
  treated as live.
- **Tidying while refactoring.** §1.
- **Reading a `${{ }}` rule as "not in comments too".** It is in comments too.

### 6. Previous story intelligence

- **4.3** built the pipeline and paid five red dispatches for skipping the zero-dispatch conversion.
  Its H1 (command substitution killing steps before their own message) touched 9 sites; its H3
  (verification steps reading identity back from `.env.deploy`) is the seam this story extends; its
  H5 is the rollback debt.
- **4.4** added the lock, spent **16 runs against a ~20 floor with zero red dispatches**, and found
  two real gaps *by testing* rather than by review: BusyBox `flock` has no `-w`, and PID 1 swallows
  `timeout`'s SIGTERM without `--init`. Its M1 TTL invariant becomes an explicit assertion here.
- **4.6** refused to duplicate the deploy body into the reset — *"a duplicated deploy body written
  in 4.6 is work 4.8 would have to delete"* — and instead dispatched through the API. It then spent
  23 of 39 runs getting the *confirmation* step right. Its lesson is this story's budget defence.
- **4.7** proved five deploys of one pipeline, falsified DF2's specific hazard, and left this story
  four debts with explicit reasoning about why each was not closed there. Its review's H1 produced
  the permanent per-push ledger line this story's §10 honours.

### 7. Non-goals — absences that are decisions, not omissions

- **Slack → Story 4.5 (parked).** The epic amended AC1 to exclude it on 2026-08-14.
- **Writing `deploy-preprod.yml` / `deploy-prod.yml` → Stories 5.3 / 6.4.** This story ships the
  contract and the skeleton, not the files.
- **The cutover, branch deletion, and the rebase plan for the team's 201 live branches → Story 4.9.**
  None of them carries `docker-compose.stand.yml`; all of them are undeployable until rebased past
  `e74e9ded`. That is 4.9's, in writing, and it is not this story's to touch.
- **Fixing the lossy ref→tag scheme → Epic 3 follow-up.** `feature/foo` and `feature-foo` collide on
  one tag. Real, pre-existing, out of scope.
- **Measuring pending-depth 3 and `flock` wake order beyond two → re-routed, §8.**
- **The manual/DR path taking the lock (DF1) → still unowned.** `deferred-work.md` names this story's
  factoring as *"where a wrapper would naturally live"* — but a wrapper is new workflow code for a
  human path, which is a mechanism §1 forbids. Re-route with that reason and leave the owner
  unchanged.
- **Changing `dev-reset.yml` → nothing here touches it.** §9, Prohibition 2.

### 8. Conventions that bind this story

- **retro-E5** — *"Every new guard ships a live outcome matrix including a discriminating run."*
  A refactor ships the same guards on a new path; the path is what has to be exercised. Task 6.
- **retro-D4** — declare before work; **the ledger closes only against a query, re-run after the
  merge commit lands.** §10.
- **No `${{ }}` in any `run:` body, comments included.** Verified by execution.
- **Never `ubuntu-latest`.** Use `deploy-dev-preprod` — or, here, the input that carries it.
- **Fail-closed guards name the cause AND the fix, and must survive their own command substitution
  to print it.**
- **Story files in English; D-records in Russian.** Branch `story-4-N/pr-<n>-<purpose>`. `main` is
  protected (D16): eight required contexts, `apply_to_admins: true`.
- **`deferred-work.md`:** append at EOF; closures go under the original; supersession is a
  strikethrough, not a deletion; owners are names or story numbers, never trigger conditions.
- **`docs/migration-decisions.md`:** index-table row + Change Log row or the record is not added;
  bodies are amended by appended block, never rewritten; verify the next free number against open
  branches.
- **NFR5 / D7** — the legacy GitHub side is untouched, verified **by diff**.
- **NFR10** — serialization must not depend on `concurrency:`. The `flock` is the load-bearing half;
  the group is defence in depth. This is why §8 can close the group-vs-capacity axis negatively
  without weakening anything.
- **The dev agent does not touch the Forgejo API.** The coordinator dispatches, queries run ids, and
  closes the ledger.

### 9. Things pending on Oleg — do not depend on them silently

| Item | State | Effect on this story |
|---|---|---|
| Revoke `fe_review_1_7` | **Pending** | A ledger query via `/root/.fj_token` starts returning `401`. **That is the revocation, not a bug.** Fall back to `fe_tmp_1_7` / `fe_pkg_3_6`; record it; never print a value. |
| `KONG_PORT = 8330` — published host port or in-network? | **Open, unverified** | **None — and Task 9.5 says so explicitly.** The Kong guard uses no port literal. The 6.4-era question stays 6.4's. |
| `SLACK_CD_WEBHOOK_URL` restore | **Pending**; Story 1.13 overwrote it with `example.invalid`, which also broke `CRM/api-prionex` | **None.** Do not "fix it in passing" — the value is shared with another team's pipeline. |
| Story 4.5 PARKED; `story-4-5/pr-1-context` @ `badbb1ac` unmerged | Parked 2026-08-21 | 🔴 Do not read, merge, cherry-pick or build on it. Story 4.7 crossed this once for a read-only `git diff` and it became review finding L8. |
| Rotation of `fe_reg_4_2` / `robot-deploy` after 4.7's credential exposure | **Oleg's call**, accepted as non-blocking | The same value backs `REGISTRY_USER_RO`/`REGISTRY_TOKEN_RO`; rotation means re-minting **and** updating both org secrets. An admin cannot revoke another account's token — plan the exit before the re-mint. |
| Sunday 2026-08-23 02:00 UTC first autonomous firing | Coordinator's, by query | §12. No `main` merge and no dispatch in 01:45-02:30 UTC. |
| "A week of parallel operation" / "developers report no disruption" (4.7 AC3) | Pending, coordinator/Oleg | None here; it gates Story 4.9. |

### 10. Sunday 2026-08-23 02:00 UTC — restated because it is easy to skip

The first fully autonomous reset fires at 02:00 UTC and the scheduler's own delay for this
repository is 44 s. **No push to `main` and no DEV dispatch between 01:45 and 02:30 UTC.** A merge
in that window re-registers the schedule; a dispatch in that window contends with an event nobody
has ever observed. §12 has the mechanism and the source lines.

### 11. The autonomous decisions in this story, in one place (for a one-read veto)

All marked **autonomous, subject to Oleg's veto**:

1. **`workflow_call`, not a shell script.** AC2's premise is falsified; the decisive argument against
   the script is H4, not taste. §2, §3.
2. **One callee (`deploy-stand.yml`) + thin per-environment callers, not a dispatch chain.** §5.
3. **The concurrency group stays in each caller as a literal, and is not an input.** D21. §5, AC3
   amendment.
4. **`runs-on` carried as an input, gated on R1, with a four-rung fallback ladder whose bottom rung
   escalates to Oleg rather than shipping a copy.** §4.
5. **`expect_unrouted_api` added to the parameter surface.** Not named by any prior story; without it
   Story 5.3 fails on every deploy. §6.
6. **`IMAGE_REPO` stays a callee-level `env:` rather than becoming an input.** One registry, all
   stands. §6.
7. **The callee accepts both `ref` and `image_tag`, exactly one of which must be supplied.** Serves
   4.3's shape and 5.3's required-`image_tag` shape from one definition. §6, Task 2.3.
8. **The post-`down` rollback is implemented, but sequenced last and committed separately, and drops
   cleanly to Story 5.3 if the budget runs out.** §7.
9. **Queue-depth-3, `flock` wake order beyond two, and the group-vs-capacity axis are re-routed, not
   measured** — with the by-construction narrowing that per-stand groups and per-stand locks make
   cross-stand contention unexpressible, and the negative closure that group-vs-capacity is
   unmeasurable on any `capacity: 1` runner in this plan. §8.
10. **DF2's scheduled-actor axis is re-routed to the coordinator with an explicit recommendation NOT
    to stage it on 2026-08-23**, because confounding it with the first autonomous firing is worse
    than leaving it open. §8.
11. **D31's two-sources-of-truth is re-routed to Story 4.9**, with the render axis closed here. §8.
12. **The matrix is earned from the story branch before merge** (run 917's precedent), which is what
    keeps the budget at 24 rather than doubling it. Task 5.1.
13. **Job `name:` fields are stripped of story/run references as they move** — the one tidying §1
    permits, because those names become permanent across three environments (Story 4.3's L12).
14. **Declared floor 24 runs**, with a repair dispatch budgeted for the case where the rollback does
    not restore. §10.
15. **Every callee input is declared `type: string` and validated inside the job**, rather than
    carrying the dispatch half's `boolean`/`number` types across a boundary whose type legality has
    never been measured here — and whose failure mode is whole-file rejection at pre-execution, with
    the error visible only in `action_run.pre_execution_error_details`. `build.yml` already made this
    exact downgrade for `environment`. Task 2.2a.

---

### Project Structure Notes

**Files this story writes:**

| Path | Action |
|---|---|
| `.forgejo/workflows/deploy-stand.yml` | **NEW** — the shared `workflow_call` callee |
| `.forgejo/workflows/deploy-dev.yml` | **MODIFIED** — reduced to a thin caller. 🔴 Name, workflow `name:`, inputs and `concurrency:` block unchanged (§9) |
| `docs/migration-decisions.md` | **MODIFIED** — D33 + index row + Change Log row |
| `_bmad-output/implementation-artifacts/deferred-work.md` | **MODIFIED** — appended at EOF |
| `_bmad-output/planning-artifacts/epics.md` | **MODIFIED** — 4.8's AC1/AC2/AC3/AC5 amendments; 5.3/6.4 amendments if the shipped shape differs |
| `_bmad-output/implementation-artifacts/4-8-factor-out-the-shared-deploy-mechanics.md` | **MODIFIED** — this file's own record |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | **MODIFIED** — status transitions |

**Files this story must NOT write:**

`.forgejo/workflows/dev-reset.yml` (§9, Prohibition 2) · `.forgejo/workflows/ci.yml` ·
`.forgejo/workflows/build.yml` · `.forgejo/workflows/build-main.yml` ·
`docker-compose.server.yml` · `docker-compose.stand.yml` · `.env.stand.example` ·
anything under `.github/` · anything on `story-4-5/pr-1-context`.

---

### References

- `.forgejo/workflows/deploy-dev.yml:1-113` — the header block: mechanism, registry auth, the
  `uses:`-does-not-execute finding, the AMENDED sequence and H5's narrowing, the `${{ }}` rule, the
  command-substitution rule, the ladder-gating decision
- `.forgejo/workflows/deploy-dev.yml:155-199` — the `concurrency:` block and its four-part argument,
  including `:192-196`, the warning written for this story
- `.forgejo/workflows/deploy-dev.yml:235-459` — `hold-lock`, the contention fixture (holder launch, copy 1)
- `.forgejo/workflows/deploy-dev.yml:748-1875` — the `deploy` job's 22 steps
- `.forgejo/workflows/deploy-dev.yml:1088-1118` — the five-variable render; the DEV literals
- `.forgejo/workflows/deploy-dev.yml:1119-1409` — the acquire step (holder launch, copy 2)
- `.forgejo/workflows/deploy-dev.yml:1731-1804` — the Kong alias guard and its `no Route matched`
  invariant (the `expect_unrouted_api` finding)
- `.forgejo/workflows/dev-reset.yml:132-163` — trigger, the shared literal concurrency group, the job
- `.forgejo/workflows/dev-reset.yml:478-760` — the dispatch step and the run-read-back
- `.forgejo/workflows/build.yml:21-90` — the only file in this repo carrying **both**
  `workflow_dispatch` and `workflow_call`, with the same input declared differently per half; the
  measured `type: choice` rejection and what it costs; the "no `secrets:` block, and there cannot
  be"; the 🚨 note that the `concurrency:` block below it is dead on the call path
- `.forgejo/workflows/build-main.yml` — the smallest live `workflow_call` caller in this repo; the
  shape a thin caller should resemble
- `.forgejo/workflows/ci.yml:37-80` — `branches-ignore`, **no `paths` filter**: the per-push cost model
- `.forgejo/workflows/ci.yml:498-505` — the second live caller (`uses: ./.forgejo/workflows/build.yml`,
  `secrets: inherit`)
- `docs/migration-decisions.md#d21` — `workflow_call`: what works, `secrets: inherit` all-or-nothing,
  the callee's `concurrency:` dying silently, `if:` copied down, `github.ref_name` arriving empty
- `docs/migration-decisions.md#d27` — the five mandatory stand variables with no defaults, in a NEW
  `docker-compose.stand.yml`; the recorded FR25 deviation; §"`docker rm -f <name>` works by name and
  ignores the compose project"
- `docs/migration-decisions.md#d28` — the stand, `127.0.0.1:8082`, the unreachable stand directory,
  and §4's five options with the one this deploy took
- `docs/migration-decisions.md#d29` — the deploy; §5's narrow claim; §7's two-sources-of-truth; §8's handoff
- `docs/migration-decisions.md#d30` — the group and the lock; §1's assignment-vs-effectiveness; §4's capacity-1 argument
- `docs/migration-decisions.md#d31` — the schedule, the API dispatch, the sweep
- `docs/migration-decisions.md#d32` — the five deploys, DF2's falsification and its three open axes
- `_bmad-output/implementation-artifacts/deferred-work.md:1860-1898` — `workflow_call`'s real record;
  Story 1.3's Probe C proved less than it was credited with
- `_bmad-output/implementation-artifacts/deferred-work.md:2409-2422` — `docker compose config` is
  blind to network existence; **owner: Stories 4.3 and 4.8**
- `_bmad-output/implementation-artifacts/deferred-work.md:2825-2870` — the rollback debt and its
  resolution in this story's favour; the two-sources-of-truth entry
- `_bmad-output/implementation-artifacts/deferred-work.md:2900-2990` — `flock` wake order; the
  manual/DR path; AC1's closure; queue depth
- `_bmad-output/implementation-artifacts/deferred-work.md:3067-3117` — DF1 and DF2 with all three axes
- `_bmad-output/implementation-artifacts/deferred-work.md:3140-3215` — the 4s gap, H3's warm-cache
  caveat, H4's log-persistence finding, DN4's per-push ledger line
- `_bmad-output/implementation-artifacts/4-3-deploy-a-feature-branch-to-dev-on-demand.md` — the
  pipeline's construction, run 920, runs 929/936/937/938/948/949/950, H1/H3/H5, L12
- `_bmad-output/implementation-artifacts/4-4-serialize-concurrent-deploys-to-the-same-stand.md` — the
  lock, the M1 TTL invariant, rows 7.1-7.7, the zero-dispatch conversion practice
- `_bmad-output/implementation-artifacts/4-6-reset-dev-to-main-on-a-weekly-schedule.md` — the refusal
  to duplicate, the dispatch mechanism, run 1004→1005, D31's schedule re-registration, the
  self-deadlock trap
- `_bmad-output/implementation-artifacts/4-7-validate-dev-deploys-across-five-feature-branches.md` —
  the five deploys, the three-source timing method, H1-H6, the DF2 probe, §12's Sunday rule
- `_bmad-output/planning-artifacts/epics.md:1575-1585` — Epic 4's own statement that this epic
  establishes the mechanics Epics 5 and 6 reuse
- `_bmad-output/planning-artifacts/epics.md:2001-2040` — Story 4.8's ACs as written
- `_bmad-output/planning-artifacts/epics.md:2192-2229` — Story 5.3's ACs (consumer 1)
- `_bmad-output/planning-artifacts/epics.md:2438-2490` — Story 6.4's ACs (consumer 2)
- `_bmad-output/implementation-artifacts/epic-3-retro-2026-08-18.md:77-78` — retro-D4 and retro-E5

---

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Run Budget Ledger

**Declared before work (§10). Baseline: to be obtained by query in Task 1.1 — do not estimate it.**

| Line | Runs |
|---|---|
| Context branch push | 1 |
| Dev-agent write-up pushes on the work branch (per-push line, DN4) | 4 |
| Implementation pushes before PR open | 3 |
| PR open | 1 |
| Pushes while PR open (2 rounds × 2) | 4 |
| Dispatch — green path, cold pull (6.1) | 1 |
| Dispatch — 401 row (6.3) | 1 |
| Dispatch — 404 row (6.4) | 1 |
| Dispatch — health-fails + rollback row (6.5/7.5) | 1 |
| Dispatch — repair, only if the rollback did not restore | 1 |
| Dispatch — lock holder fixture (6.6) | 1 |
| Dispatch — contended deploy (6.6) | 1 |
| Merge → `build-main.yml` | 1 |
| Closeout PR | 3 |
| **Declared floor** | **24** |

**Closed:** _(by query, re-run after the merge commit lands; the literal word OPEN if the query cannot be run)_

### Completion Notes List

### File List

### Review Findings

---

## Open Questions for Review

### Blocking

_(none identified at context time)_

### Non-blocking

1. **R1 may make epic AC3's "deploy-runner label is an input" literally unsatisfiable, and the
   fallback that preserves the AC's *intent* is uglier than the one that preserves its letter.**
   §4's rungs (b) and (c) both satisfy "no environment-specific value is embedded" while making the
   label something other than a plain input. If R1 is negative, whoever reviews should decide
   whether to amend AC3's wording or accept a rung that reads as a workaround. **Owner: Oleg, on
   Task 1.2's answer.**
2. **`secrets: inherit` hands the shared callee every org secret, including `REGISTRY_TOKEN_RW`
   (org-scope `write:package` over 87 packages, including another team's production) and the
   OpenBao credentials.** D21 flagged this for this story by name. It is not a regression today —
   `build.yml` already holds all nine as a top-level workflow — but a *production* caller in Story
   6.4 inheriting production credentials into a definition that also serves DEV is a different
   posture question than the one already accepted. **Owner: Oleg, before Story 6.4.**
3. **The Kong guard's `no Route matched` invariant is a ticking assertion even on DEV.** Story 4.3's
   L3 already said so: the moment the backend team configures a real route for `/api/`, the guard
   starts failing every DEV deploy. `expect_unrouted_api` makes it *configurable*; it does not make
   it *correct*. The still-open "tell the backend team" item in `deferred-work.md` has no owner.
   **Owner: whoever next talks to `CRM/api-prionex`.**
4. **If H4 turns out to be a size threshold in Forgejo's log storage, several of this project's
   evidence practices rest on a channel that gets less reliable as workflows grow** — and this story
   makes the `deploy` job's step count grow by however many steps the rollback adds. Worth naming at
   review even if Task 8.1 closes with a bounded negative. **Owner: this story's review round.**
5. **Nothing in this plan re-measures the concurrency group's *effectiveness* under contention,
   ever.** §8 closes that axis negatively because both deploy runners are `capacity: 1` by design.
   If anyone disagrees with closing it rather than leaving it open, the only way to settle it is a
   disposable capacity-≥2 probe runner — which is exactly what Story 1.3 did (D8) and is a
   provisioning task, not a workflow one. **Owner: Oleg, if the negative closure is unacceptable.**
