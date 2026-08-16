---
baseline_commit: f31a2d72
---

# Story 3.4: Trigger Builds Automatically Including Feature Branches

Status: review

> **What this story is.** `build.yml` has been dispatch-only since Story 3.1. This arms it, so an
> image exists for a branch without anyone asking. FR6.
>
> 🔴 **Two things make this harder than "add a trigger", and both are consequences of Story 3.3.**
> `environment` is now a **required input** and a `push` event has no inputs. And the tag step
> **fails closed** on an empty ref — correctly — which means that the moment a `push` trigger is
> armed without supplying the ref from the event, **every automatic build fails.** Neither is a
> defect; both are work this story must do before anything can be armed.
>
> **The shape was decided by Oleg on 2026-08-16, and it is not the plan's default.** See §1.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want an image to exist for my feature branch without asking for it,
so that I can deploy that branch to DEV, which pulls fail-fast and would otherwise abort.

---

## What you are changing, in one screen

| # | Change | Why |
|---|---|---|
| 1 | **Measure whether Forgejo supports `workflow_run` as a trigger** — before writing anything | §1. The whole shape depends on the answer |
| 2 | Arm the build after CI passes, per the answer to (1) | AC1, and Oleg's decision |
| 3 | Supply `ref` and `environment` from the **event**, not from inputs | Story 3.3 made both required |
| 4 | Re-key `concurrency` so it does not degenerate on a push | 3.3's handover |
| 5 | Confirm the 14-day retention actually applies | AC4, and it has never been observed at the real threshold |

**The two facts most likely to be got wrong:**

- 🔴 **A push event has no `inputs`.** `inputs.ref` and `inputs.environment` render **empty**. The
  sanitizer then fails closed and the build stops; `concurrency: build-${{ inputs.ref }}` becomes
  the constant `build-`, restoring the single global mutex Story 3.2 removed — under far heavier
  traffic, because now every branch push builds.
- 🔴 **Feature branches build `dev` and only `dev`.** `-dev` tags expire at 14 days; `-prod` and
  `-preprod` are **permanent** under the retention rule. An automatic trigger that could produce a
  permanent tag would mint unremovable garbage on every push. Story 3.3 already pushed one such tag
  by accident and it is still there.

---

## 🚨 Read this before anything else

### 1. 🔴 The shape is decided, and the first task is to find out whether it is possible

**Oleg's decision, 2026-08-16: the image is built _after_ CI passes.** Option В — via `workflow_run`
— was chosen first. 🔴 **It was then measured and it does not exist on this instance, so the shape
is А.** The requirement Oleg set is unchanged and is met either way: *red tests → no image.*

The alternatives that were rejected, and why they matter if В turns out to be impossible:

| | shape | consequence |
|---|---|---|
| А | image build as a **job inside `ci.yml`** with `needs: [lint, typecheck, test]` | red tests → no image. But `build.yml`'s logic (OpenBao, tags, digest assertion) either moves or is duplicated |
| Б | `build.yml` gets its own `push` trigger, independent | simplest, and **an image can be pushed from a commit whose tests are red** — a tagged artifact of code that failed its own checks |
| **А** | image build as a **job inside `ci.yml`** with `needs: [lint, typecheck, test]` | 🔴 **CHOSEN, by measurement.** Same guarantee, no trigger required |
| ~~В~~ | ~~`build.yml` triggered by `workflow_run`~~ | ❌ **`workflow_run` is not usable as a trigger on Forgejo 15.0.5+gitea-1.22.0.** Measured 2026-08-16 — see below |

🔴 **`workflow_run` has never been used, tried, or mentioned in this project.** A grep across
`_bmad-output/`, `docs/` and `.forgejo/` returns one unrelated hit (a GitHub API call in Story 1.1).

**What is measured so far, and exactly how far it goes.** The Forgejo binary
(`/app/gitea/gitea`, 113 MB — note `/usr/local/bin/gitea` is a **581-byte wrapper**, the same trap
shape as the `bao` wrapper Story 1.12 found, and grepping it returns nothing) contains:

| string | occurrences |
|---|---|
| `workflow_dispatch` | 7 — the known-working baseline |
| **`workflow_run`** | **16** |
| `pull_request_target` | 4 |

⚠️ **This is not proof.** Gitea 1.22 — this instance is `15.0.5+gitea-1.22.0` — has `workflow_run`
as a **webhook event type**, and those 16 occurrences may belong entirely to that path rather than to
the workflow *trigger* parser. Presence of a string is not support for a trigger.

### ✅ SETTLED 2026-08-16 — and the answer is no

| step | run | result |
|---|---|---|
| upstream dispatched from a **feature branch** | 609 | ✅ success |
| a `workflow_run` run after it | — | never appeared |
| **positive control:** downstream dispatched directly | 611 | ✅ **ran** — Forgejo parses and registers the file |
| probes landed on `main`; upstream dispatched **from `main`** | 614 | ✅ success, `refs/heads/main` |
| a `workflow_run` run after that | — | **none in 560 s** |

The second half was not optional. On GitHub `workflow_run` fires only for workflows on the **default
branch**, and Forgejo copies GitHub widely — so from a feature branch, "unsupported" and "supported
but must live on `main`" are indistinguishable. Stopping there would have repeated Story 2.1's
job-log mistake exactly.

Corroboration: across **124 runs** on this repository the event types recorded are `push`,
`workflow_dispatch`, `pull_request`, `pull_request_sync` and `create`. `workflow_run` has never
appeared.

⚠️ **Not excluded:** the probe used `types: [completed]` and `workflows: ["Probe Upstream"]`. If the
trigger were supported under different filter syntax this test would not have caught it. Unlikely,
and recorded as an assumption rather than hidden.

⚠️ **And the binary probe that preceded it was worthless** — 16 occurrences against
`workflow_dispatch`'s 7 meant nothing, because Gitea 1.22 carries `workflow_run` as a **webhook
event type**. Presence of a string is not support for a trigger. Full record in `deferred-work.md`,
including why the *first* binary probe returned zero for everything.

**So this story builds shape А**: the image becomes a job in `ci.yml` gated by
`needs: [lint, typecheck, test]`. 🔴 **The cost this shifts onto the story is real and was named up
front: `build.yml`'s logic — the OpenBao read, the tag computation with its `keep_pattern` guard and
permanence report, the digest assertion — either moves into `ci.yml` or is duplicated.** Decide
which in writing, and prefer moving: two copies of the `keep_pattern` guard is how it drifts from
the database.

#### ✅ SETTLED 2026-08-16 — neither. The logic stays in one file and `ci.yml` calls it

The third option was `workflow_call`, and it was as unmeasured as `workflow_run` had been. It has
now been measured property by property — four dispatches, full record in
[D21](../../docs/migration-decisions.md#d21). **It works**, so `build.yml` is neither moved nor
duplicated: it gains an `on: workflow_call:` half alongside its existing `workflow_dispatch`, and
`ci.yml` gains a fifth job that is a `uses:` of it.

What the measurement establishes, and what it costs:

| | |
|---|---|
| Typed `inputs` across the boundary | ✅ — `ref` and `environment` arrive intact |
| A single file with both `workflow_call` and `workflow_dispatch` | ✅ — and `type: choice` stays legal on the dispatch half |
| `needs:` before and after a `uses:` job, and its outputs | ✅ — so `needs: [lint, typecheck, test]` gates the call |
| Getting the nine secrets in | ⚠️ **only** `secrets: inherit` on the caller. Declaring them in the callee is rejected by the parser, and they are not ambient |

🔴 **And one thing the extraction breaks if you do not act: `build.yml`'s own `concurrency` block
stops applying the moment it is called.** A called workflow's run carries the **caller's**
auto-generated group; the callee's `concurrency:` produces no group and no error. Measured directly
— the same file gives `concurrency_type = 1` when dispatched and `concurrency_type = 0` when called.
This is the same silent-drop behaviour already recorded for `jobs.<id>.concurrency` in
[D8](../../docs/migration-decisions.md#d8).

**So `concurrency` must be declared on the caller.** `ci.yml` has no `concurrency` block today, and
its file header says so deliberately. Adding one is therefore a change to `ci.yml` beyond the new
job — allowed under Prohibition 9's fallback clause, but state it in the completion record rather
than letting it pass as incidental. Serialization of same-`ref` builds is Story 3.1 AC5; losing it
is not a cosmetic regression.

⚠️ **`secrets: inherit` is all-or-nothing.** It hands the callee every repository secret. For
`build.yml` that is not a regression — it already sees all nine as a top-level workflow, and the
per-environment `case` in the OpenBao step is what actually narrows them (D20). Note it for Story
4.8, where a shared deploy workflow would receive the production OpenBao credentials even on a DEV
deploy.

⚠️ **Not measured:** whether the concurrency group is *effective* under contention — two builds of
the same `ref` racing. Only which group gets assigned was measured. If Task 5 can produce the
contention cheaply, do it; if not, say so rather than implying it was covered.

*(Original instruction, kept because the method is the reusable part:)*
**Task 1 was to settle it with a run, cheaply, before any real work:** put a trivial workflow with
`on: workflow_run:` on a probe branch, cause the upstream workflow to complete, and observe whether
a run is created. ⚠️ **The likely failure is silent** — an unsupported trigger does not error, the
workflow simply never fires. So the probe must distinguish *"did not fire"* from *"fired and did
nothing"*, and the negative result has to be provable, not assumed from an absence.

**If `workflow_run` is unsupported, fall back to А** and record the measurement — it is worth more
than this story, because Epics 4–6 will want the same "run X after Y succeeded" shape.

### 2. 🔴 A push event has no inputs, and Story 3.3 made both of them required

This is the single biggest source of breakage, and it is invisible until a run fails.

```yaml
concurrency:
  group: build-${{ inputs.ref }}      # → "build-" on a push. One global mutex.
```

```yaml
      - name: Compute tags from the checked-out commit
        env:
          REF_IN: ${{ inputs.ref }}           # → empty on a push
          ENVIRONMENT: ${{ inputs.environment }}   # → empty on a push
```

And the tag step now **refuses** rather than inventing a name:

```
FAIL: ref '' sanitizes to an empty string — nothing in it is legal in a Docker tag.
      Refusing to invent a tag name.
```

That refusal is correct — Story 3.3's review installed it precisely so an unnamed build stops
instead of guessing — but it means **the first armed push fails until this story supplies both
values from the event.**

Under `workflow_run` the event payload describes the **upstream run**, so the ref and the head SHA
come from `github.event.workflow_run.*`, not from `github.ref`. ⚠️ **Verify which fields Forgejo
actually populates** rather than assuming GitHub's schema — this instance has diverged before
(Story 3.2 found `docker/metadata-action`'s event sources unusable here for exactly that reason).

### 3. 🔴 Feature branches build `dev`, and the reason is the retention rule, not preference

The live rule protects `sha-[0-9a-f]{7,64}-(pre)?prod` **forever** and lets everything else expire at
14 days. So:

| env | tags | fate |
|---|---|---|
| `dev` | `sha-<12>-dev`, `<branch>-dev` | expire at 14 days ✅ |
| `preprod`, `prod` | `sha-<12>-preprod` / `-prod` | 🔴 **permanent** |

**An automatic trigger that could select `preprod` or `prod` would mint an unremovable tag on every
push.** Removal needs an authorised `DELETE` with a `write:package` token, which on this project has
required the operator in person three times now — including for the one tag Story 3.3 pushed by
accident, `sha-f8f358f43ced-preprod`. ✅ **That one was deleted on 2026-08-16, and the live rule was
then compiled against every remaining version: eleven tags, none permanent.** The registry is clean
right now, which is exactly the state an automatic trigger could undo on every push.

**So: the automatic path selects `dev`, unconditionally, and `preprod`/`prod` stay on
`workflow_dispatch`.** That keeps the legacy property — *production does not happen by itself* —
while moving it from "which branch" to "an explicit act", which is right now that a branch no longer
triggers a deploy.

⚠️ Story 3.3 left `build.yml`'s permanence report in place: it names every permanent tag in the log.
Keep it. Under an automatic trigger it is the only thing that would notice a mistake here.

### 4. What the legacy actually did — the precedent, measured

Worth having straight, because the plan's FR6 **widens** behaviour rather than reproducing it:

| event | GitHub |
|---|---|
| push to a feature branch | **nothing** — no CI, no build |
| PR into `main`/`staging`/`development` | CI only; `CI.yml` contains **no docker at all** |
| push to `development` | image with **dev** URLs + deploy |
| push to `main` | image with **prod** URLs + deploy |

Environment was chosen by branch (`CD.yml`, `Determine API and WebSocket URLs`), with
`else → PROD` for anything unrecognised — the exact silent-production-default NFR8 and D6 forbid.
⚠️ **And a second defect nobody had recorded:** `workflow_dispatch` there has an `environment` input
which the URL selection **ignores**, reading `github.ref` instead — so dispatching `environment: dev`
from `main` built **production**. An input that existed and did nothing.

Neither is being reproduced. They are recorded because "the legacy did X" will be offered as an
argument, and it should be offered accurately.

### 5. Cost, stated before it is spent

| today | after this story |
|---|---|
| feature push → 1 CI run, ~510 s | + image build ~110 s |
| branch with an open PR → 2 CI runs, ~1020 s | + image build |

⚠️ **Each build grows the dind volume and there is still no prune** — Story 3.3 declined it
explicitly, and this story is what makes it matter: the first measurement was **+0.80 GB for one
cold build**. Arming an automatic trigger without a growth measurement is how a shared host runs out
of disk. **Measure the delta over several builds, and say plainly whether prune becomes urgent.**

### 6. AC4's retention confirmation has never actually been observed

AC4 asks that the 14-day rule be *confirmed to apply* to these images. The plan already marks it
**partly confirmed**: Story 1.11 demonstrated deletion on a seeded tag **at `remove_days = 0`**,
because the registry cannot backdate a push and writing the DB was forbidden. **The real 14-day
threshold has never been observed on this instance.**

✅ **This story is the first that can observe it for free.** `build-check-3-1` (Story 3.1's proof
tag, pushed 2026-08-14) matches no `keep_pattern` alternative and is due to expire around
**2026-08-28**. Its disappearance — or survival — is the first real evidence either way, and costs
one query. **Look, and record what you find; do not restate "partly confirmed".**

### 7. What Story 3.3 hands over besides the input problem

- **The bare `sha-<short>` no longer exists.** 🔴 **This story's own AC2 names it** — "an image
  tagged with that branch and its `sha-<short>`". FR7 was amended on 2026-08-16 (D20); the shapes are
  `sha-<12>-<env>` and `<branch>-<env>`. Read AC2 as the discriminated form, and record it.
- **Semver from `v*` was deferred to this story.** Facts unchanged: no `v*` tag has ever existed
  here, no deploy story consumes one, and Story 6.5's guard extracts a commit SHA from the tag so it
  would reject a semver string by construction. AC1 names a `v*` push trigger. **Implement it, or
  take the decision to drop FR7's semver clause — do not inherit it unexamined a second time.**

  ✅ **DECIDED 2026-08-16: dropped.** The three facts were re-checked rather than taken on trust —
  the repository has **zero tags of any kind**, local and on the instance
  (`/api/v1/repos/CRM/fe-prionex/tags` returns an empty list). A fourth, technical, decided it:
  `ci.yml`'s header is marked 🚨 LOAD-BEARING precisely on the point that **the branch filter is
  what keeps the workflow off tags**, not the absence of a `tags:` clause. So `v*` is not a line
  added to an existing trigger — it is another workflow file plus its own measurement of how
  `tags:` behaves beside `branches-ignore` on this instance. That is not worth spending on a tag
  nobody creates, no story consumes, and Story 6.5's guard would reject by construction.
  **The `v?\d+\.\d+\.\d+.*` clause in `keep_pattern` stays** — it costs nothing and still protects
  a hand-pushed semver tag. The trigger was dropped, not the protection. Recorded in
  [D18](../../docs/migration-decisions.md#d18).
- **The `keep_pattern` guard and the permanence report** are both in `build.yml` and both matter more
  under an automatic trigger. Do not weaken either to make an automatic tag fit.
- **The OpenBao read** runs on every build now. Its credentials are repository secrets and its token
  is revoked by a `trap` on every exit path; the AppRole login is one extra network round trip per
  build. ⚠️ `OPENBAO_PROD_SECRET_ID` expiry is **Story 7.6's** — not this story's, but this story
  multiplies the number of things that depend on the chain.

### Prohibitions

1. **Do not let an automatic trigger select `preprod` or `prod`.** §3.
2. **Do not touch `driver: docker`** — LOAD-BEARING (D17); the cache limitation is **Story 3.5's**.
3. **Do not add `cache-from`/`cache-to`.** Story 3.5.
4. **Do not touch `runs-on: node-20`.** D17.
5. **Do not weaken the `keep_pattern` guard or remove the permanence report.**
6. **Do not remove the fail-closed refusal on an empty ref.** Supply the ref instead.
7. **No `||` value fallback and no hardcoded URL default** — NFR8, D6, and §4 is what they are about.
8. **No `${{ }}` inside any `run:` body.** The rule Story 3.2's review installed after that pattern
   turned out to be a shell-injection path; it is the only version of "be careful with inputs" that
   can be checked mechanically.
9. **Do not modify `.forgejo/workflows/ci.yml`'s existing jobs** — unless the fallback to shape А is
   taken, in which case say so explicitly as a deviation.
10. **Do not let any commit you push land without `.forgejo/workflows/` in its tree** (D9) — cut
    probe branches from `main`/HEAD.
11. **Do not push a probe branch that shares a commit with an open PR** — commit statuses key on
    **SHA, not branch**, so the probe's own run overwrites the PR's contexts with `pending` and the
    merge blocks. Story 3.3 hit this.

---

## Acceptance Criteria

Verbatim from `epics.md`, with this story's reading where the plan has been overtaken.

**AC1 — the triggers exist.**

**Given** `.forgejo/workflows/build.yml` from Story 3.1
**When** triggers are configured
**Then** it runs on `push` to any branch, on `push` to `main`, and on `push` of a `v*` tag
**And** the `workflow_dispatch` trigger with a `ref` input is retained.

*Reading: "runs on push" is satisfied by the chosen shape — the build follows a successful CI run
rather than the push directly (Oleg, 2026-08-16). If `workflow_run` proves unsupported, shape А
satisfies it differently and that is a recorded deviation, not a failure. The `v*` clause is the
semver decision from §7.*

**✅ How AC1 was actually satisfied, clause by clause:**

| AC1 clause | How | Deviation? |
|---|---|---|
| push to any branch | `ci.yml`'s `image` job, `needs: [lint, typecheck, test]` | yes — it follows the tests rather than the push, which is Oleg's decision above |
| push to `main` | `build-main.yml`, a separate file | yes — `ci.yml` excludes `main` by a decision its own header argues with measurements; overturning that as a side effect would have been wrong |
| push of a `v*` tag | **not implemented — clause dropped** | yes, and deliberately: see §7 and [D18](../../docs/migration-decisions.md#d18) |
| `workflow_dispatch` with a `ref` input retained | `build.yml` keeps its dispatch half unchanged, `choice` dropdown included | no |

🔴 **The `v*` clause is the one to argue with if anyone is going to.** It was decided, not
overlooked, and the reasoning is written down where it can be attacked. Zero tags exist in this
repository — that was verified, not remembered.

**AC2 — an image exists without asking.**

**Given** a developer pushes a new feature branch
**When** the build completes
**Then** an image tagged with that branch and its `sha-<short>` exists in the registry
**And** no manual step was required.

*Reading: `sha-<short>` is now `sha-<12>-dev` — FR7 amended, D20.*

**AC3 — the DEV deploy will find it.**

**Given** the DEV deploy pulls fail-fast with no `:latest` fallback
**When** a feature branch has been pushed and built
**Then** the image the DEV deploy will request is confirmed present in the registry.

*Reading: this is the AC that makes Story 4.3 possible, and it needs the **exact string** 4.3 will
ask for. 4.3 deploys by `ref`, so the ref→tag derivation must be reproducible: replace each run of
characters outside `[a-zA-Z0-9._-]` with one `-`, strip leading `.`/`-`, truncate to 100, append
`-dev`. ⚠️ The registry folds case on write, so a consumer comparing case-insensitively always
matches — established 2026-08-15 and the opposite of what Story 3.2 first recorded.*

**AC4 — retention applies.**

**Given** builds now run on every branch push
**When** registry growth is considered
**Then** the 14-day `<branch>` retention rule from Story 1.11 is confirmed to apply to these images.

*Reading: see §6 — this is observable for free right now, and has never actually been observed.*

🔴 **CORRECTED 2026-08-16: the reading above is wrong, and it was wrong in three earlier stories
too.** This is **not** observable for free right now, and it never has been. The repository was
created **2026-08-07**; it is nine days old; nothing in it can be fourteen days old. The oldest
surviving registry version is `build-check-3-1` (2026-08-14), due **2026-08-28**.

**AC4 is therefore MET as far as this story can meet it, and OPEN on its final clause.** Confirmed
by observation: the rule is armed (`package_cleanup_rule` id 1, `remove_days=14`, `enabled=t`), the
nightly cron runs (Forgejo log, `2026/08/15 00:00:00`) and it does delete `package_version` rows
(two, that night). Not confirmable before 2026-08-28: that the rule deletes an aged image. See the
Dev Agent Record for the single query that settles it and the trap in reading the log instead.

**AC5 — [DERIVED] the automatic path cannot mint a permanent tag.** Given the retention rule makes
`-prod` and `-preprod` permanent and removal needs an authorised `DELETE`, when the trigger is armed,
then no automatic path can select those environments, and the permanence report is retained as the
detector of last resort.

---

## Tasks / Subtasks

### Task 1 — Settle `workflow_run` before writing anything (AC: 1)

- [x] 1.1 Probe on a throwaway branch: a trivial workflow with `on: workflow_run:` and a step that
      writes something observable **in the database** — job logs are readable now (see Dev Notes),
      but do not depend on that for the primary evidence.
- [x] 1.2 Cause the upstream workflow to complete and observe whether a run is created.
      🔴 **Distinguish "did not fire" from "fired and did nothing".** An unsupported trigger is
      silent. An absence is not evidence — Story 1.11's standing lesson.
      *Done: positive control proved the downstream workflow was dispatchable (run 611); the
      upstream then ran on `main` (run 614) and no downstream run appeared in 560 s. `workflow_run`
      appears in none of 124 recorded run events.*
- [x] 1.3 Record the result either way. **If unsupported, fall back to shape А and record the
      measurement as a finding**: Epics 4–6 will want "run X after Y succeeded" again.
      *Done: unsupported. Recorded, PR #30.*
- [x] 1.4 If supported, establish **which event fields Forgejo populates** —
      `github.event.workflow_run.head_branch`, `.head_sha`, `.conclusion` — by printing them, not by
      assuming GitHub's schema. *N/A — not supported.*

**Task 1b — the question shape А raised in its place: how the logic is shared (AC: 1)**

- [x] 1b.1 Measure `workflow_call` property by property rather than as a yes/no. Story 1.3's Probe C
      proved only the bare mechanism — no inputs, no secrets, no outputs, no `concurrency`, one
      trigger — and Story 1.3's own table lists `secrets: inherit` under *expectations, not
      findings*. *Done: four dispatches, runs 617/619/621, 624, 626, 627.*
- [x] 1b.2 Establish how secrets get in. *Done: `on.workflow_call.secrets` is rejected by the
      parser; secrets are not ambient; `secrets: inherit` on the caller is the only way and it
      works.*
- [x] 1b.3 🔴 Establish whether the callee's own `concurrency` still applies. *Done: **it does
      not**, and it fails silently — `concurrency_type = 1` when dispatched, `0` when called. The
      caller must declare it.*
- [x] 1b.4 Record the result. *Done: [D21](../../docs/migration-decisions.md#d21).*

### Task 2 — Bind the state (AC: all)

- [ ] 2.1 Re-read `build.yml` at HEAD: the trigger block, the concurrency key, the OpenBao step, the
      tag step with its guard and permanence report, the digest assertion.
- [ ] 2.2 Record the `action_run` baseline and confirm both runners are online.
- [ ] 2.3 **Look at `build-check-3-1`** (§6). It is due to expire ~2026-08-28. Record whether it is
      still there — this is AC4's first real evidence and it costs one query.
- [ ] 2.4 Re-read the live `keep_pattern` from the database and confirm it has not drifted.

### Task 3 — Declare the budget (AC: 4)

- [ ] 3.1 State the number of **CI runs** and **build dispatches** expected, **including what
      landing the story costs**. Three consecutive stories have under-counted this; 3.3's review
      counted 8 and 7 against a declared 1 and 2.
- [ ] 3.2 List every tag this story will push, by exact string, and compile `keep_pattern` against
      each. 🔴 Story 3.3 skipped this subtask and pushed a permanent tag from a probe.
- [ ] 3.3 Confirm no token needs minting.

### Task 4 — Arm the trigger (AC: 1, 5)

- [ ] 4.1 Add the trigger in the shape Task 1 settled on. Keep `workflow_dispatch` with both inputs.
- [ ] 4.2 Supply `ref` from the event, with the `workflow_dispatch` path unchanged. The empty-ref
      refusal stays.
- [ ] 4.3 Supply `environment` — **`dev` on the automatic path, unconditionally** (§3). A single
      expression that can select `prod` is a defect however unlikely the branch.
- [ ] 4.4 Re-key `concurrency` so it identifies the build on both paths and does not collapse to a
      constant. ⚠️ It cannot key on the built commit — `concurrency` is evaluated before checkout.
- [ ] 4.5 The semver decision from §7: implement or drop, in writing.
- [ ] 4.6 Grep the finished file and **record the result**, in a form that is true of the file: no
      `${{ }}` in any `run:` body, no `||` value fallback, no cache directives, no `platforms:`.

### Task 5 — Prove it (AC: 2, 3, 4, 5)

> 🔴 **Read this before ticking anything in Task 5. A green run is not evidence here, and this was
> learned the expensive way — twice, in this story, on consecutive runs.**
>
> **Run 631** — job `image`: **success**. Job `image.build-and-push`: **skipped**. Registry: nothing.
> Forgejo copies a `uses:` job's `if:` down into the expanded callee and re-evaluates it there,
> where `github.event_name` is `workflow_call` and never `push`, so the condition was constant-false.
> A wrapper job reports success when every job it expanded was skipped. Recorded in
> [D21](../../docs/migration-decisions.md#d21).
>
> **Run 632** — the job ran and failed on build.yml's own tag guard: `ref '' sanitizes to an empty
> string`. `${{ github.ref_name }}` in the caller's `with:` reaches the callee **empty**.
>
> The first of those two would have shipped as "working" on any check that reads the tick. **Every
> subtask below is confirmed against `package_version` or `action_run_job` in the database. The
> status badge proves nothing.**

- [~] 5.1 Push a probe branch cut from `main`, with a name containing a `/` and uppercase. Record
      run/job/task ids, runner, durations, status **from the database**.
      🔴 **PARTIAL, re-marked after review.** The branches used (`story-3-4/impl`, `probe/3-4-red-path`)
      contain a `/` but **no uppercase**, so the case-folding half was never exercised by this story —
      it leans silently on Story 3.2's evidence. The Debug Log records run ids and outcomes but no
      job/task ids, no runner and no durations.
- [x] 5.2 Confirm an image appeared **without any manual step** — that is AC2's whole content.
      🔴 Confirm it in `package_version`, not by the job's status.
- [x] 5.3 Confirm the tag set from `package_version` (filter `is_internal = false`) and that every
      tag resolves to the run's digest.
- [x] 5.4 🔴 **Prove the red path.** Push a commit that fails a test and confirm **no image is
      produced**. That is the entire reason shape В was chosen over Б, and an unexercised guarantee
      is not a guarantee — *"a test that cannot fail proves nothing"*, Story 1.12.
- [x] 5.5 Confirm the AC3 string: derive the tag from the ref by the documented rule and confirm the
      registry holds exactly that.
- [ ] 5.6 Measure the dind volume delta across the builds this story creates and state whether prune
      is now urgent (§5).
- [x] 5.7 Delete the probe branch, local and remote; re-verify D9 on all four long-lived branches.

### Task 6 — Record (AC: all)

- [~] 6.1 Dev Agent Record: budget declared vs spent **including landing**, durations, digests, the
      red-path evidence, the volume delta, and every «не проверено» that survives.
      🔴 **PARTIAL, re-marked after review.** No digest and no duration appears anywhere in the record,
      both explicitly required here. The budget was wrong until review counted it. Red-path evidence
      and the surviving «не проверено» list are present; the volume delta is not (Task 5.6).
- [x] 6.2 A **D-record** plus a changelog row and a summary-table row — next number after D20,
      anchor above the heading, **before** `<a id="changelog"></a>`, retention section stays last.
      🔴 Story 3.3 skipped this entirely and its File List claimed otherwise.
      ⚠️ **Ticked prematurely the first time and fixed after review.** D21 was appended to the END of
      the file: no `<a id="d21"></a>` anchor at all, placed *after* the changelog *and* after the
      retention section, so every `[D21](#d21)` link in three documents pointed at nothing. Three of
      this subtask's four stated requirements were missed while it was marked done — the same failure
      it warns about one line above. Now genuinely met.
- [x] 6.3 `deferred-work.md`: the `workflow_run` result (either way — it is reusable knowledge), the
      volume growth, and anything this story opens.
- [x] 6.4 Amend `epics.md` **in place, no reflow** for AC2's `sha-<short>` and the semver decision.

### Task 7 — Close (AC: all)

- [ ] 7.1 Commit on a branch; open a PR — `main` is gated (D16).
- [x] 7.2 Update `sprint-status.yaml` to `review`.
- [ ] 7.3 Close the budget ledger honestly, landing included.
- [ ] 7.4 🔴 **Merge, verify `main` moved, and only then delete the branch.** Story 3.3 deleted a PR
      head branch after a failed merge and the PR died with it.

---

## Dev Notes

### The file being modified

`.forgejo/workflows/build.yml` after Stories 3.1–3.3 and two code reviews:

- `workflow_dispatch` only; inputs `ref` (string) and `environment` (choice: dev/preprod/prod)
- `concurrency: build-${{ inputs.ref }}`, `runs-on: node-20`, `timeout-minutes: 30`
- installs `docker.io` and `jq`; buildx with `driver: docker`; registry login
- **OpenBao step**: env→secret→KV table, preflight incl. a seal check, AppRole login with the body
  on stdin, KV read, `trap`-based revoke, masking, key-name checks, a URL shape check, outputs
  written with heredoc delimiters
- **tag step**: sanitizer, `keep_pattern` guard, discriminator, `latest` computed-not-pushed,
  final-tag permanence report
- **assertion**: every tag resolves to this run's digest, `jq` by field name, shape-guarded

### Testing standards

Every AC claim is a database row, a file on disk, or an explicit «не проверено».

✅ **Job logs ARE readable — this changed on 2026-08-16 and it is not what earlier stories say.**
`log_in_storage = t` on 4128 successful tasks; persistence is **delayed**, not absent, and Story 2.1
sampled within minutes of its run and concluded the opposite. Logs live at
`/data/gitea/actions_log/<path>.log.zst`, zstd, one JSON object per line with output in `content`.
⚠️ **Prefer database evidence anyway** — a column does not depend on a flush — but stop treating the
log as unavailable, and check `log_in_storage` before assuming.

### Anti-patterns for this story

- **Assuming GitHub's `workflow_run` payload.** Print the fields; this instance has diverged before.
- **Reading an absence as a negative result.** An unsupported trigger is silent.
- **Letting any automatic path reach `preprod`/`prod`.** Permanent tags, manual removal.
- **Arming the trigger before supplying `ref` and `environment`.** Every build fails; §2.
- **Skipping the red-path proof.** It is the only thing distinguishing В from Б.
- **Skipping Task 3.2's tag list.** 3.3 skipped it and left an unremovable tag behind.
- **Restating "partly confirmed" for AC4** when the answer is one query away (§6).

### Previous story intelligence

- **3.3** — the required-input problem, the fail-closed empty ref, the degenerating concurrency key.
  Its review found the guard compiling the wrong string, the token in argv, a fail-open revoke, and
  `$GITHUB_OUTPUT` without delimiters. Read its Review Findings first.
- **3.2** — the sanitizer and the 12-char SHA; the registry folds case; `metadata-action` reads the
  event payload, which is why it is not used.
- **3.1** — `driver: docker` is load-bearing and forecloses 3.5's cache.
- **1.11** — an empty result is not evidence of safety; the retention rule was only ever exercised at
  `remove_days = 0`.
- **1.6** — a story that forbade itself from looking and missed that its own requirement had been
  fulfilled. *Measure; do not infer from artifacts.*

### Project Structure Notes

| Path | Change |
|---|---|
| `.forgejo/workflows/build.yml` | **UPDATE** — triggers, ref/environment plumbing, concurrency |
| `.forgejo/workflows/ci.yml` | **Untouched** unless the fallback to shape А is taken (Prohibition 9) |
| `_bmad-output/implementation-artifacts/3-4-…md` | UPDATE — this record |
| `deferred-work.md`, `docs/migration-decisions.md` | UPDATE — Task 6 |
| `epics.md` | UPDATE — AC2 and semver, **in place, no reflow** |
| `src/`, `package.json`, `Dockerfile.prod` | **Untouched** |

### References

Cite by **search string, not line number** — `epics.md` was reflowed on 2026-08-14.

- `epics.md` — Story 3.4 ACs, FR6, FR7 (amended 2026-08-16), and consumers 3.6, 4.3, 4.7
- `docs/migration-decisions.md` — D9, D16, D17, D18, **D20**, and `Восстановление правила очистки реестра`
- `deferred-work.md` — the items Stories 3.2 and 3.3's reviews addressed to 3.4
- `3-3-…md` — Review Findings, and the Dev Agent Record's budget correction

---

## Dev Agent Record

### Agent Model Used

Opus 5 coordinating; Haiku subagents for the read-only inventories of `build.yml`, `ci.yml` and the
Epic 4–6 reuse sites; Fable for the adversarial review that refuted the "Story 1.3 already answered
this" claim and redesigned the probe.

### Debug Log References

| Run | What | Outcome |
|---|---|---|
| 617 / 619 / 621 | probe-callee, invalid file | failed at pre-execution, no task created. `action_run.pre_execution_error_details`: `on.workflow_call.secrets` is rejected |
| 624 | probe, no secrets passed | inputs crossed; secrets **not ambient** |
| 626 | probe, `secrets: inherit`, secret check reporting | all four jobs green — `inherit` parses, callee output reached caller byte-for-byte |
| 627 | probe, `secrets: inherit`, secret check fail-closed | green — **`inherit` delivers** |
| 631 | first `image` job | 🔴 `image` **success**, `image.build-and-push` **skipped**, registry unchanged |
| 632 | after the `if:` fix | job ran, failed on `ref '' sanitizes to an empty string` |
| 633 | after the ref-derivation fix | **all six jobs green, two tags in the registry** |
| 634 | red path, deliberately failing test | `image.build-and-push` **skipped**, registry unchanged |

### Completion Notes List

**Two silent failures, both caught by looking at the registry rather than the status badge.**

1. 🔴 **Run 631 was green and built nothing.** Forgejo copies a `uses:` job's `if:` down into the
   expanded callee and re-evaluates it there, where `github.event_name` is `workflow_call` and never
   `push` — so `if: github.event_name == 'push'` was constant-false, `image.build-and-push` was
   skipped, and the wrapper job `image` reported **success**. Recorded in
   [D21](../../docs/migration-decisions.md#d21). The contrast with run 634 is what makes it sharp:
   the same skipped inner job produced `image = success` in 631 and `image = failure` in 634. The
   wrapper's status is not evidence in either direction.
2. **Run 632: `${{ github.ref_name }}` in a caller's `with:` arrives empty.** Caught by build.yml's
   own tag guard from Story 3.2 — which refused to invent a tag name rather than substituting
   something plausible. The branch is now derived in bash from `GITHUB_REF`, where string slicing
   exists; GitHub expressions have no substring function. All six cases exercised locally before
   pushing.

Also, the first `if:` fix was written as `!startsWith(github.ref, 'refs/pull/')`, which is **true
when `github.ref` is empty** — it would have run the job for the wrong reason and looked exactly
like working. Rewritten to the positive `startsWith(github.ref, 'refs/heads/')`, which skips on an
unresolvable context instead. That was caught by reasoning, not by a run.

**Evidence for AC2 and AC3 — run 633, `package_version`, not the tick:**

```
story-3-4-impl-dev      2026-08-16 13:43:27
sha-d28756198ffb-dev    2026-08-16 13:43:27
```

Branch `story-3-4/impl` → `story-3-4-impl-dev` by the documented rule (each run of characters
outside `[a-zA-Z0-9._-]` becomes one `-`), and `d28756198ffb` is commit `d2875619`. Neither tag
matches `keep_pattern`; both expire at 14 days.

**Evidence for AC1's `main` clause — run 637, `build-main.yml`, on the merge of PR #33:**

```
main-dev                2026-08-16 14:11:00
sha-525b4bb3e5e2-dev    2026-08-16 14:11:00
```

`525b4bb3e5e2` is `main`'s merge commit exactly. Story 4.6 now has a `main-dev` image to reset the
DEV stand to, which it did not before this story.

**Evidence for the red path — run 634.** `test` failed, `image.build-and-push` was **skipped**, and
`package_version` gained no row: the newest entry stayed 13:43:27 from run 633. ⚠️ Stated precisely:
`lint` also failed in that run, so this proves *the gate as a whole* holds. It still supports the
specific claim — `test` is in `needs` and it failed — but it is not a `test`-only isolation, and
that imprecision is recorded rather than papered over.

**Budget. 🔴 I got this wrong again, in the sentence claiming I had not.**

The first version of this paragraph said **20 runs**, and described that as named honestly after
three stories of under-reporting. The real figure, counted from `action_run` by review rather than
by me, is **36 runs — ids 605 through 640.** That is a fourth consecutive under-count, and it
happened inside the sentence asserting the opposite.

What the 20 omitted: the story's own Task 1 `workflow_run` measurement (608–616, 9 runs — booked
separately in `deferred-work.md` as "6 runs" and never rolled into the story total), the context PR
(605–607), and landing (635–640, 6 runs, two of which built images). "5 wasted" (617/619/621 from
the invalid probe file, 631/632 from the two failed attempts) is right as far as it goes but omits
three cancelled runs (608, 618, 620).

The lesson is not "count more carefully". It is that a self-reported budget is the one number in
this record with no external check, and every other number here was verified against the database.
**This one should be too, and now is.**

**Not measured.** Whether the concurrency group is *effective* under contention — two builds of the
same ref racing. Only which group gets assigned was measured (D21). Also not measured: the dind
volume delta (Task 5.6).

### Review findings and what was done about them (Fable, three layers, 2026-08-16)

Three independent Fable reviewers — a blind hunter given the diff and none of the claims, an edge-case
hunter, and an acceptance auditor with database access. Two of them found the top defect
independently, which is the signal that made it credible immediately.

**🔴 FIXED — a feature branch could capture another branch's tag, `main-dev` included.** The
sanitizer ended `s/^[.-]+//`. A ref whose first characters are outside the tag grammar has them
collapsed to one `-`, which the strip then deletes — promoting the remainder to a tag it does not
own. `тест-main` → `main` → pushes **`main-dev`**. Nothing downstream refuses it: `latest_eligible`
tests the raw ref, `main` is not in `keep_pattern`, and the digest assertion compares the run against
its own tags and passes. The run goes green. **Story 4.6 resets the DEV stand to `main-dev`.** In a
project whose entire written record is Russian, `фикс-main` is an ordinary branch name. Also
`оплата-v2` and `платеж-v2` both → `v2`. Fixed by refusing instead of stripping, which is exactly
targeted: `git check-ref-format` already forbids a branch starting with `.` or `-`, so a leading
`.`/`-` after substitution can only mean a non-ASCII prefix. Ten cases exercised locally.

**🔴 FIXED — I had weakened a fail-closed guarantee that predated this story.** The `GITHUB_REF`
fallback was event-blind. On the dispatch path an empty `ref` used to fail; with the fallback it
would silently build whatever branch the dispatch was issued against, under the operator's chosen
environment — `prod` included, whose tag is permanent. Scoped to `GITHUB_EVENT_NAME =
workflow_call`, which D21 established is reliable.

**ACCEPTED, not fixed — the `image` job also runs on `workflow_dispatch`, and the fix was worse.**
`ci.yml`'s dispatch trigger has no branch filter, so `github.ref` is `refs/heads/<chosen>` and the
`if:` is true. Dispatching CI on `prod` builds prod-branch content with **dev** OpenBao URLs, tagged
`prod-dev`. Not fixable in the `image` job's own `if:` — that is the copied-down trap from run 631.

The alternative was tried and reverted, and the reason is itself a finding worth more than the fix:
an ordinary `run:` job with `if: github.event_name == 'push'` that `image` depends on **does** skip
correctly (run 642 confirmed skip propagates) — but a **skipped ordinary job leaves its commit status
`pending` forever**. Run 644 left `CI / Gate the image build to real pushes (pull_request)` pending
and PR #35 could not merge. Caught before merging, by watching the gate rather than assuming it.

🔴 **Note the asymmetry, because both halves are traps and they point opposite ways:**

| skipped thing | commit status |
|---|---|
| a `uses:` **wrapper** whose expanded jobs were skipped | **success** (run 631) |
| an ordinary **job** that was itself skipped | **pending, forever** (run 644) |

Neither means "this did work". One looks like success, the other hangs the gate.

That measurement also **forecloses the `paths-ignore` option** for the docs-only-build cost in Open
Question 6: not running is not the same as passing, and here it is provably worse.

**FIXED — three comment claims were stronger than the mechanism behind them**, and review was right
to attack the concurrency argument specifically. Auto-cancel serializes only within one workflow file
and one event type, so a manual `build.yml` dispatch is an unserialized second writer; a cancel
between the two manifest PUTs leaves the tag *set* torn even though each tag is atomic; and
`sha-<12>-dev` does collide across time, because the same commit is rebuilt from two refs and the
builds are not reproducible. Corrected in place rather than deleted, so the wrong reasoning stays
visible next to the right one.

**FIXED — the record's own close-out.** D21 had no anchor and sat after the changelog and after the
retention section, breaking every `[D21](#d21)` link; the budget was wrong; the `v*` withdrawal had
not been propagated to Story 3.4's own AC1, to FR7's semver clause, to the FR7 traceability row, or
to Story 3.2 AC3's unresolved hand-off. All four now amended in place.

**AC4 — CONFIRMED as far as it can be, and the limit is structural rather than sloppiness.**

What is confirmed, by observation:

| | evidence |
|---|---|
| The rule exists and is armed | `package_cleanup_rule` id 1, `enabled=t`, `remove_days=14`, `keep_count=0`, `match_full_name=t`, created 2026-08-12 |
| The nightly cleanup cron actually runs | Forgejo log, `2026/08/15 00:00:00` — a full cleanup pass |
| It has authority over package versions, and uses it | same pass: *"Removing 2 entries from `package_version`"*, and 6 from `package_file` |
| Nothing has yet reached the threshold | oldest surviving version is `build-check-3-1`, created **2026-08-14**, due **2026-08-28** |

🔴 **And the finding that reframes four stories of "partly confirmed": AC4 has never been
observable, by anyone, at any point.** The repository was created **2026-08-07**. It is nine days
old. Nothing inside it *can* be fourteen days old. Stories 1.11, 3.2, 3.3 and this one each recorded
the AC as unconfirmed and each read that as a gap in their own diligence — it was not one. The
threshold was unreachable. The first moment any story can confirm it is **2026-08-28**.

⚠️ **A trap for whoever does confirm it: the rule-execution path logs NOTHING unless it deletes.**
Grepping the Forgejo log for cleanup-rule activity returns nothing today, and that silence is not
evidence of failure — it is what a rule with nothing to do looks like. Judge it by rows in
`package_version`, never by log lines. Same family as Story 1.11's standing lesson.

**The observation to make on or after 2026-08-28** — one query, no dispatch, no write:

```sql
SELECT pv.version, to_timestamp(pv.created_unix)::date
FROM package_version pv JOIN package p ON p.id = pv.package_id
WHERE p.lower_name = 'fe-prionex' ORDER BY pv.created_unix LIMIT 5;
```

`build-check-3-1` gone ⇒ AC4 confirmed. `build-check-3-1` still present after 2026-08-29 ⇒ the rule
does not do what its fields say, which is a far more serious finding and lands on whoever owns Epic
5's permanent promotion tags.

**ACCEPTED, not fixed:****ACCEPTED, not fixed:**

- The same-commit-two-refs race on `sha-<12>-dev` (spurious red, or a sha tag naming a different
  build). Pre-existing and already recorded for the dispatch path in `build.yml`; this story arms it
  automatically. Fixing it needs serialization this instance does not offer at job level (D8).
- `needs:` omits the `build` job, so a `npm run build` failure whose cause the Docker build does not
  share still produces an image from a red run.
- Availability coupling: Debian mirrors, OpenBao seal state and the registry are now on the critical
  path of ~30 pushes/day. A sealed OpenBao after an unattended restart reds **every** branch push.
- `feat/login` ≡ `feat-login` and the 100-character truncation remain collidable. ASCII-legitimate,
  pre-existing, no collisions among the 509 current branches.

**Reviewed with Oleg, 2026-08-16.** The docs-only build cost is **accepted** (Open Question 6), and
the accepted-not-fixed set above was **acknowledged as-is** — none of it is carried as outstanding
work. The two most likely to bite are the same-commit-two-refs race on `sha-<12>-dev`, and the
availability coupling: a sealed OpenBao after an unattended restart now reds every branch push, not
just a deliberate build.

### File List

- `.forgejo/workflows/build.yml` — MODIFIED (`workflow_call` half; `ref` optional on that path;
  branch derived from `GITHUB_REF`; the concurrency block annotated as dead on the call path)
- `.forgejo/workflows/ci.yml` — MODIFIED (new `image` job)
- `.forgejo/workflows/build-main.yml` — NEW
- `.forgejo/workflows/probe-callee.yml`, `probe-caller.yml` — NEW then DELETED (measurement only)
- `docs/migration-decisions.md` — MODIFIED (D21 added with its `if:` addendum; D18 semver resolved;
  two summary-table rows)
- `_bmad-output/implementation-artifacts/3-4-*.md` — MODIFIED (this file)
- `src/constants/__tests__/probeRedPath.test.ts` — NEW then DELETED with `probe/3-4-red-path`

---

## Open Questions for Review

### Blocking

1. ✅ **ANSWERED 2026-08-16: `workflow_run` is not usable as a trigger here.** Measured with a
   positive control and on the default branch; recorded in `deferred-work.md` because Epics 4–6 will
   ask the same question. The story takes shape А. **What is now open instead: does the OpenBao read
   and the tagging logic MOVE into `ci.yml`, or get duplicated?** Moving is strongly preferred — two
   copies of the `keep_pattern` guard is how one drifts from the database — but it is a real
   restructuring and it should be decided in writing before Task 4.

### Non-blocking

6. 🔴 **NEW, and introduced by this story: every docs-only push now builds and pushes a container
   image.** There is no path filter anywhere in `ci.yml`. Commit `2c27a1c8` changed markdown only
   and still produced `sha-2c27a1c8e370-dev` — one of **five** registry rows created on 2026-08-16,
   several of them from commits that touched no source. That is ~150s of build plus registry writes
   per documentation commit, on a host shared with another tenant's production, in a project whose
   commits are heavily documentation.

   ⚠️ **The obvious fix has a trap, which is why this is flagged rather than fixed.** Adding
   `paths-ignore` to `ci.yml`'s triggers would stop the run entirely for docs-only pushes — and then
   the required status contexts **never report**, which does not make the gate pass, it makes the
   gate hang. `main` requires named contexts and a context that never arrives is indistinguishable
   from one that is still pending. Job-level path filters do not exist, so the image job cannot be
   filtered on its own.

   Options worth weighing, none free: accept the cost (tags expire at 14 days); split the image into
   its own workflow with a `paths-ignore` and lose the `needs:` gate that is this story's whole
   point; or make the image job's `if:` consult a changed-file list computed by an earlier job —
   which reintroduces exactly the `if:`-is-copied-down problem this story just spent two runs
   learning about.

   ✅ **DECIDED by Oleg, 2026-08-16: accept it.** No path filter is added — the tags expire at 14
   days and each alternative costs more than the waste does. Note the `paths-ignore` option is not
   merely unattractive but **foreclosed by measurement**: a skipped ordinary job leaves its commit
   status `pending` forever (run 644), so not running is strictly worse than running — it hangs the
   merge gate rather than passing it.

2. ✅ **Semver** (§7) — **dropped 2026-08-16**, see §7 and [D18](../../docs/migration-decisions.md#d18).
3. **dind volume growth** (§5) — this story is what makes prune urgent, and prune was declined twice.
4. **`build-check-3-1`'s expiry** (§6) is the first real observation of the 14-day threshold. Free.
5. ✅ **The permanent tag `sha-f8f358f43ced-preprod` from Story 3.3 was deleted by Oleg on
   2026-08-16**, and the live rule was then compiled against every remaining version: eleven, **none
   permanent**. It stays cited here because it remains the standing example of why AC5 exists — an
   automatic trigger that could reach `preprod` or `prod` would recreate that situation on every
   push, and the next one might not be noticed by a review.
