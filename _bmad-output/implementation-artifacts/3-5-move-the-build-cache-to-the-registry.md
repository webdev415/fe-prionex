---
baseline_commit: 1b76effa
---

# Story 3.5: Move the Build Cache to the Registry

Status: done

> **What this story is, as the plan wrote it.** `CD.yml` used `cache-from/to: type=gha`, which does
> not exist off GitHub. FR9 says replace it with
> `type=registry,ref=git.crm-prionex.com/crm/fe-prionex:buildcache`.
>
> 🔴 **Two things must be read before any of that is believed.** The workflow as shipped **cannot**
> do it — `driver: docker` has no cache export, and that line is LOAD-BEARING for a different reason
> (§1). And the story's own premise — *"so that build time does not regress"* — **is not what the
> measurements show** (§2). The real justification is different, smaller, and honest, and it is
> written down below so this story is not built on a sentence nobody checked.

---

## Story

As a developer,
I want image builds to reuse layers across runs,
So that build time does not regress now that GitHub's cache backend is unavailable.

> ⚠️ **The "so that" clause is false as written, and §2 replaces it with the measured one.** Build
> time has not regressed and is not the constraint. What is true, and narrower than it first looks:
> the two runners do not share layers, so an **identical-tree** build landing on the other runner
> pays full price for what was just built. A source-changed build pays full price either way,
> because `npm run build` dominates.

---

## What you are changing, in one screen

| # | Change | Why |
|---|---|---|
| 1 | **Settle whether a registry cache is reachable at all** — before writing anything | §1. `driver: docker` has no cache export, and it is there for a reason that has not gone away |
| 2 | **Re-derive the benefit and decide whether to proceed** | §2. The stated premise does not survive measurement; the real one is worth ~5–8 runner-minutes/day and **zero** developer wall-clock |
| 3 | Add `cache-from` / `cache-to` in whatever shape (1) proved possible | AC1 |
| 4 | Fix the digest assertion, which is already primed to fail on the shape (1) will produce | §3 — this story is named in the failure message |
| 5 | Measure cold vs warm and record both | AC2, AC3 |

---

## 🚨 Read this before anything else

### 1. 🔴 The blocker is this story's first task, and it was handed over deliberately

`build.yml` sets `driver: docker` on `setup-buildx-action`, marked 🚨 LOAD-BEARING, with an
instruction not to remove it. The reason (D17, and Story 1.8's evidence):

> the action's default `driver=docker-container` builds and pushes from its OWN BuildKit container,
> which does NOT inherit this job container's `--add-host git.crm-prionex.com:10.67.0.1` mapping —
> the push dies with a bare `EOF` against the registry's TLS endpoint

And the cost, which nobody recorded until Story 3.1's review found it:

> But the **`docker` driver has no cache export** — `--cache-to type=registry` is unsupported on
> it; it needs `docker-container`, or a daemon with the containerd snapshotter enabled. […]
> `driver: docker` appears 38 times across the artifacts and the cache-export limitation zero times.

*(Elision marked. The first draft spliced two sentences and silently dropped the middle clause —
the one naming both alternatives — while presenting the result as a quote.)*

So AC1 as written is **unreachable against the workflow as shipped**. This is not a surprise to be
discovered on day two; it is Task 1.

**Routes, and what is known about each.** `deferred-work.md` named three. Two more are named here
because they are cheaper and nobody has written them down.

| # | Route | What is known |
|---|---|---|
| a | Give the dind daemon's BuildKit container what it needs to reach the registry so `docker-container` works | **Measured 2026-08-16, and the first version of this row got the mechanism WRONG — see the note below.** The dind container's own `/etc/hosts` holds only localhost entries. Resolution goes: dind's `resolv.conf` → `nameserver 127.0.0.11` (Docker's embedded DNS) → the s1 host's resolver → the **host's** `/etc/hosts`, which carries `10.70.0.1 git.crm-prionex.com`. So this is a **DNS** path, not a file one. |
| b | Enable the containerd snapshotter on the dind daemon | **Measured 2026-08-16:** `forgejo-runner-fe-prionex-dind` has **no `/etc/docker/daemon.json`**, so the snapshotter is off. Turning it on is a daemon config change plus a restart of a runner shared with another tenant's work. |
| c | Native `docker build` / `docker push` with a hand-rolled cache | Loses `build-push-action` entirely, including the digest output the assertion depends on |
| d | **`cache-to: type=inline`** — untried, unnamed anywhere | Embeds cache metadata in the image manifest instead of a separate tag. Needs no `buildcache` tag at all. ⚠️ **Deviates from AC1, which names `type=registry,ref=…:buildcache` explicitly** — so it is a decision to record, not a shortcut to take quietly. Also: inline cache carries only final-layer metadata, so it may not restore the `npm ci` layer AC3 asks about. Test that specifically. |
| e | **Keep `driver: docker`, use `cache-from` only** — untried | Import without export. Requires something else to populate the tag. Probably a dead end; ruled out cheaply. |

> 🔴 **A correction worth reading before trusting anything else in this section.** The first draft of
> row (a) asserted the dind resolved the registry "from its **own `/etc/hosts`**" and marked it
> *Measured*. It was not measured — it was inferred from a successful `getent`, which proves that
> resolution works and says nothing about where it comes from. The dind's `/etc/hosts` has no such
> entry. Caught by validation before this story was handed over.
>
> **The correction changes the guidance, and in the story's favour.** Because the path is DNS, a
> BuildKit container that can reach `127.0.0.11` resolves the name too — so `driver-opts:
> network=host` may fix naming as well as routing, which the first draft said it could not. That is
> now the **cheapest thing to try first**, not a dead end. It also fits Story 1.8's evidence: a
> BuildKit container on the default bridge does not get the embedded resolver, falls back to public
> DNS, reaches the wrong address and dies with the bare `EOF`.
>
> ⚠️ Still unproven either way. Try it; do not inherit this paragraph as fact the way the first
> draft asked you to inherit the last one.

🔴 **Whatever route is taken, prove the PUSH still works before anything else.** The registry-`EOF`
failure is what `driver: docker` exists to avoid, and it is silent in the wrong way — it looks like
a network flake. Story 1.8 spent a story on it.

### 2. 🔴 The premise does not survive measurement, and the honest justification is different

The user story says the cache exists *"so that build time does not regress"*. Measured on this
instance, 2026-08-16, across 26 runs (`action_run_job`, `stopped - started`):

| job | mean seconds |
|---|---|
| `test` | **512** |
| `lint` | 138 |
| `build` (npm) | 110 |
| `typecheck` | 85 |
| **`image.build-and-push`** — all rows | 56 |
| **`image.build-and-push`** — **rows that actually ran** | **~90** |

⚠️ **The 56 is a denominator artifact and the first draft reported it as a job cost.** Ten of those
26 rows are pull-request skips at 0 s. Over builds that executed the mean is **~90 s**, which makes
`typecheck` (85 s) the cheapest job, not the image build. Corrected by validation.

**What survives, and it is the part that matters: the image build is not on the critical path.** It
runs `needs: [lint, typecheck, test, gate]`, so the run cannot finish before `test`'s 512 seconds
regardless. Making it free would shorten a CI *run* by its own ~90 s and would shorten the **merge
gate by zero** — the image job is not among the required contexts on `main` (D16).

**And a layer cache already exists.** The dind daemon keeps layers between runs. The variance gives
it away, and the cause is exactly identifiable:

| run | ref | runner | seconds |
|---|---|---|---|
| 648 | branch | s1-fe-prionex-**2** | 104 |
| 650 | `main`, the merge of 648's commit | s1-fe-prionex-**1** | 106 |
| 651 | branch | s1-fe-prionex-**1** | 106 |
| 653 | `main`, the merge of 651's commit | s1-fe-prionex-**1** | **24** |
| 654 | branch | s1-fe-prionex-**2** | 107 |
| 656 | `main`, the merge of 654's commit | s1-fe-prionex-**1** | 107 |

**Same runner → 24 s. Different runner → ~106 s.** Six consecutive runs, no exception. The merge
commit's tree is identical to the branch tip, so every layer is a hit — *if the layers are on that
machine*.

**So the real justification, stated so this story can be judged on it:** a registry cache buys
**runner-to-runner sharing**. It buys **no developer-visible wall-clock at all**.

🔴 **How much runner time, corrected — the first draft said ~20 min/day and its own table refuted
it.** The 82-second saving does **not** accrue to "roughly half of all builds". Look at run 651: a
*new commit* on runner 19, which had just built run 650 and therefore had warm dependency layers —
still **106 s**, because `npm run build` dominates and a source change invalidates it no matter
where the layers live. The saving accrues only to **identical-tree builds that land on the other
runner** — merge builds, cross-runner. In the measured window that is about 2 of 15 executed builds.

**Realistic prize: ~5–8 runner-minutes/day, not ~20.** That is the number Task 2.3 escalates, and
it is small enough that "cancel this story" is a serious answer rather than a rhetorical one.

⚠️ **That may still be worth doing. It is a materially smaller prize than the story implies, and it
should be weighed against the cost in §5 before the work starts, not after.** If the answer is
"not worth it", cancelling this story with the measurement recorded is a legitimate outcome and a
better one than a week spent on `docker-container`. Escalate that judgement rather than deciding it
silently.

### 3. The digest assertion is already primed to fail, and it names this story

`build.yml`'s final step asserts every tag resolves to the run's digest. It currently refuses a
manifest **index** with a message that says, verbatim:

> `If you are reading this, the driver changed — this is Story 3.5's to fix.`

Why it will fire: dropping `driver: docker` for `docker-container` makes `build-push-action` use
buildx's default `provenance=mode=min`, which emits an **index of two manifests** (image +
attestation) even for a single platform. `steps.build.outputs.digest` is then the index digest,
while `docker manifest inspect -v` returns the index's *children* — none of which carries the index
digest. Comparing them fails **every correct build**.

Two fixes, and the cheap one is not the obvious one:

- `docker buildx imagetools inspect --format '{{.Manifest.Digest}}'` returns the index digest. This
  is what the failure message suggests.
- ⚠️ **Or set `provenance: false` on `build-push-action`** and keep a single manifest, leaving the
  assertion untouched. Nobody has written this down. It is one line, and it removes the whole
  problem — at the cost of dropping provenance attestations, which nothing in this plan consumes.
  **Decide in writing which, and say why.**

### 4. AC4 is already answered, and the answer is weaker than it reads

> ✅ **Decided 2026-08-13 (Story 1.11): exempt.** `buildcache` is named explicitly in `keep_pattern`
> and is never deleted regardless of age, so Story 3.5 needs no regeneration path. ⚠️ Pattern-read,
> never exercised against the running rule.

*(Quoted in full after validation caught the first draft dropping "so Story 3.5 needs no
regeneration path" — a conclusion handed to this story — and bolding a caveat the source does not
bold. Dropping a qualifier while copying is the failure mode that inverted an earlier story's
decision; it is worth the pedantry.)*

That caveat matters more now than when it was written. Story 3.4 established that **the retention
rule has never been observed doing anything at all** — the repository is too young for anything to
have reached 14 days, and the first observation possible is **2026-08-29** (`build-check-3-1`; see
`deferred-work.md`). So "exempt" rests on reading a pattern, and the pattern's enforcement rests on
a rule nobody has yet seen delete a single row.

**This story does not need to resolve that** — `buildcache` being *wrongly* deleted is a
regenerable inconvenience, not a permanent-tag disaster. But do not restate "confirmed exempt" as
though it were observed. Cite the pattern, name the caveat, move on.

### 5. Cost, stated before it is spent

Story 3.4 reported its budget five times and was low five times, including in the sentence
announcing it had stopped being low. So: **state the expected number of runs and dispatches here,
before Task 1, and close the ledger with `SELECT count(*) FROM action_run`, not from memory.**

What is already known to cost:
- Every push to every branch now builds an image (Story 3.4). Any change to `build.yml` is exercised
  ~30×/day whether or not this story asks for it.
- A `docker-container` experiment that breaks the push breaks **every branch build**, not just the
  experiment. Do it on a probe branch and be ready to revert in one commit.
- Restarting the dind daemon (route b) affects the other tenant's runner on the same host.

### Prohibitions

1. **Do not remove `driver: docker` without first proving the push works under the replacement.**
   That is the whole reason it is there. A push that dies with a bare `EOF` looks like a flake.
2. **Do not weaken the digest assertion to make a new manifest shape fit.** Fix the comparison or
   remove the shape; do not lower the bar.
3. **Do not touch the `keep_pattern` guard or the permanence guard** in the tags step. `buildcache`
   is in `keep_pattern`; if this story ever pushes that tag from `build.yml` itself, the permanence
   guard will refuse it — and that guard is correct. Push the cache tag through buildx's
   `cache-to`, which does not go through the tags step at all.
4. **Do not add a second registry credential.** `REGISTRY_TOKEN_RW` already has what a cache push
   needs.
5. **Do not report a cache "working" from a build that was fast for another reason.** Same-runner
   reuse already gives 24 s. A warm-cache claim must be made on a run that landed on the *other*
   runner, or it proves nothing — this is the specific way this story can lie to itself.

---

## Acceptance Criteria

Verbatim from `epics.md`, with this story's reading where measurement has overtaken the plan.

**AC1 — the cache is registry-backed.**

**Given** `CD.yml:115-116` uses `cache-from: type=gha` and `cache-to: type=gha,mode=max`
**When** the Forgejo build workflow is configured
**Then** it uses `type=registry,ref=git.crm-prionex.com/crm/fe-prionex:buildcache` instead
**And** no `type=gha` reference remains.

*Reading: the second half is already true — no `type=gha` exists anywhere in `.forgejo/`. The first
half is blocked by §1 and may prove impossible in this exact shape; `type=inline` (route d) would
satisfy the intent and not the letter. **If the letter cannot be met, that is a recorded deviation
with a reason, not a failure** — but it must be decided and written, not drifted into.*

**AC2 — cold then warm, both measured.**

**Given** a cold cache
**When** a build runs and then an unchanged build runs again
**Then** the second build reuses layers from the registry cache
**And** both durations are measured and recorded.

*Reading: 🔴 **"cold" and "warm" must be forced, not observed.** The dind daemon already caches
locally, so a second build on the same runner is ~24 s with or without this story's work. The
measurement is only meaningful across **different runners** — see Prohibition 5. State which runner
each measurement ran on, from `action_task.runner_id`.*

**AC3 — the dependency layer survives a source change.**

**Given** only application source changed
**When** a build runs
**Then** the `npm ci` dependency layer is restored from cache rather than reinstalled.

*Reading: achievable with `Dockerfile.prod` as it stands — `COPY package*.json ./` and
`RUN npm ci` both precede `COPY . .`, so a source-only change does not invalidate them. ⚠️ Note
`type=inline` may not carry this layer; if route (d) is chosen, test AC3 specifically rather than
assuming.*

**AC4 — the cache tag survives retention.**

**Given** the buildcache tag lives in the same repository as release images
**When** the retention policy from Story 1.11 is reviewed
**Then** the buildcache tag is confirmed either exempt from cleanup or safe to regenerate. ✅ **Decided 2026-08-13 (Story 1.11): exempt.** `buildcache` is named explicitly in `keep_pattern` and is never deleted regardless of age, so Story 3.5 needs no regeneration path. ⚠️ Pattern-read, never exercised against the running rule.

*Reading: answered by pattern-reading in Story 1.11 and **not by observation** — see §4. Restate the
caveat; do not upgrade it.*

**AC5 — [DERIVED] the push still works.** Given `driver: docker` exists to make the registry push
succeed, when the driver changes for any reason, then a push to the registry is demonstrated to
still work **before** any cache measurement is trusted, and the evidence is a tag in
`package_version`, not a green job.

---

## Tasks / Subtasks

### Task 1 — Settle whether a registry cache is reachable (AC: 1, 5)

- [x] 1.1 Re-read §1 and confirm the two instance facts still hold: dind has no
      `/etc/docker/daemon.json`, and it resolves `git.crm-prionex.com` from its own `/etc/hosts`. *Done — both confirmed, and the second one corrected the story's own text: the dind's `/etc/hosts` has only localhost entries, and the name arrives by DNS.*
- [x] 1.2 On a **probe branch**, try route (a): `docker-container` with whatever supplies the NAME
      to the BuildKit container. 🔴 **Prove the push first** — a tag in `package_version` — before
      looking at cache behaviour at all. *Done — route (a) WORKS. Run 660: `docker-container` + `network=host`, both tags in `package_version`, full export in the log.*
- [x] 1.3 If (a) fails, try (d) `type=inline`, which needs no driver change. Cheapest remaining
      route; test AC3 against it specifically. *Not needed — (a) worked. `type=inline` untried and unnecessary.*
- [x] 1.4 Rule out (e) cheaply, and cost (b) and (c) in writing rather than attempting them. *(e) ruled out by (a) succeeding; (b) and (c) not attempted and not needed.*
- [x] 1.5 Record the result either way, in `deferred-work.md` as well as here. If no route works,
      **say so and stop** — the outcome is a recorded impossibility, not a forced workaround.

### Task 2 — Re-derive the benefit and get a decision (AC: all) *Recorded in [D22](../../docs/migration-decisions.md#d22) and `deferred-work.md`.*
- [x] 2.1 Reproduce §2's measurement on current data: mean duration per job, and the
      same-runner/different-runner split for `image.build-and-push`. *Done — see the measurement table below.*
- [x] 2.2 State the benefit in runner-minutes/day and in developer wall-clock (expected: ~20 and
      **zero**). *Done: **−1.9 s per build**, under a minute a day, and zero developer wall-clock.*
- [x] 2.3 🔴 **Escalate the proceed/cancel judgement to Oleg with those two numbers.** Do not decide
      it silently in either direction.

### Task 3 — Declare the budget (AC: all) *Escalated with both numbers. **Oleg, 2026-08-16: keep it.***
- [x] 3.1 State expected CI runs and dispatches **before** Task 4, including probe branches and
      landing. Story 3.4 was low five times for want of this. *Declared before Task 4: 10–14 runs, baseline `action_run.id` 659.*
- [x] 3.2 List every tag this story could push — including `buildcache` — and compile the live
      `keep_pattern` against each.

### Task 4 — Implement the shape Task 1 proved (AC: 1, 3) *Done — `buildcache` is the only new tag and it is in `keep_pattern` by Story 1.11's decision; it does not pass through the tags step, so the permanence guard never sees it.*
- [x] 4.1 Add `cache-from` / `cache-to` in the proven shape. No `type=gha`. *Done — `type=registry,…:buildcache,mode=max`. `mode=max` deliberately: AC3 needs the builder stage's dependency layer.*
- [x] 4.2 Fix the digest assertion for the manifest shape the change produces — **or** set
      `provenance: false` to avoid the shape. Decide in writing (§3). *Done — **and the decision changed under measurement.** `provenance: false` was chosen first and did NOT fix it; see below.*
- [x] 4.3 Confirm the house rule still holds: no `${{ }}` inside any `run:` body, checked
      programmatically across all workflow files.

### Task 5 — Prove it (AC: 2, 3, 5) *Checked programmatically across all workflow files: zero `${{ }}` inside any `run:` body.*
- [x] 5.1 🔴 **Cold measurement on one runner, warm measurement on the OTHER**, with
      `action_task.runner_id` recorded for each. A same-runner warm build proves nothing
      (Prohibition 5). *Done, and cross-runner: run 662 exported on runner 20, run 663 imported on runner 19.*
- [~] 5.2 Prove AC3 directly: change one source file only, and show the `npm ci` layer was reused —
      from the build log's `CACHED` markers, not from the total duration.
      🔴 **The evidence first cited was the WRONG RUN, and it was the exact kind this story's own
      Prohibition 5 forbids.** Run 663 is the **empty commit** — nothing changed, so every step was
      `CACHED`. It proves nothing about AC3.
      The run that changed one source file is **664**, and there `#12 RUN npm ci` has **no `CACHED`
      marker at all** — it downloads 205 MB and extracts: `#12 DONE 17.0s`.
      **AC3's letter is met** (restored, not reinstalled) **and its value is negative** — see the
      Completion Notes.
- [x] 5.3 Confirm the image still lands: tags in `package_version`, and the digest assertion green.
      🔴 A green job is not evidence — Story 3.4 had two green runs that built nothing. *Done — tags in `package_version`, assertion green in run 662 onward.*
- [ ] 5.4 Delete the probe branch; verify `main` moved before deleting anything.

### Task 6 — Record (AC: all)

- [ ] 6.1 Dev Agent Record: budget declared vs spent **closed against a query**, durations with
      runner ids, the route chosen and the routes ruled out, and every «не проверено» that survives.
- [ ] 6.2 A D-record — next number after D21 — with `<a id="dNN"></a>` **above** the heading and
      **before** `<a id="changelog"></a>`; the retention section stays last. Plus a changelog row and
      a summary-table row. 🔴 Story 3.4 ticked this subtask having done none of those three things.
- [ ] 6.3 `deferred-work.md`: the driver verdict, and anything this story opens.
- [ ] 6.4 Amend `epics.md` **in place, no reflow** — FR9's conflict note resolves either way.

### Task 7 — Close (AC: all)

- [ ] 7.1 Commit on a branch; open a PR — `main` is gated (D16).
- [ ] 7.2 Update `sprint-status.yaml`.
- [ ] 7.3 Close the budget ledger against `SELECT count(*) FROM action_run`, not memory.
- [ ] 7.4 🔴 Merge, verify `main` moved, and only then delete the branch.

---

## Dev Notes

**Instance facts, measured 2026-08-16 and good until something changes them:**

- Runners: `s1-fe-prionex-1` (id 19) and `s1-fe-prionex-2` (id 20), both image `13.0.0`, label
  `node-20`. Two separate dind volumes — `dind-storage` ~4.9 GB, `dind2-storage` ~2.6 GB — and **no
  layer sharing between them.** That is the whole problem this story addresses.
- Host disk: 246 GB used of 878 GB. Prune is not urgent.
- `forgejo-runner-fe-prionex-dind` runs Docker **27.5.1** and has **no** `/etc/docker/daemon.json`
  (containerd snapshotter off). 🔴 **Its `/etc/hosts` does NOT carry the registry** — only localhost
  and its own hostname. The name arrives by DNS: `127.0.0.11` → the s1 host's resolver → the
  **host's** `/etc/hosts`. *(An earlier version of this line said the opposite. It is the single most
  corrected fact in this story and it was still stated the old way here, in the block a future dev
  reads first — caught by review, not by me.)*
- `buildcache` is in the live `keep_pattern` (`package_cleanup_rule` id 1) and is never removed by
  the rule — pattern-read, never observed.

**Three robustness gaps addressed to "whoever next opens `build.yml`" — that is this story.** All
three were declined by earlier stories and none is fixed:

- `apt-get install docker.io jq` is **unpinned and unretried**, against public Debian mirrors, on
  every one of ~30 builds/day. One mirror hiccup reds every branch at once.
- **No `docker image prune`.** The dind volumes grow ~0.8 GB per build — directly this story's
  business, since a layer cache changes what accumulates and where.
- Action major tags float (`@v3`, `@v5`, `@v6`).

Fixing them is not this story's job; pretending they are not there is not either. Decide in writing
whether to take any while the file is open.

⚠️ **AC1 cites `CD.yml:115-116`; the live lines are 113-114** — stale since Story 1.3. Quote the AC
as written, but do not chase the wrong lines.

⚠️ **Run ids here are `action_run.id`, not the numbers the web UI shows** (UI index = id − 490).

**What Story 3.4 handed over besides the digest trap:**

- A `uses:` job's `if:` is copied into the callee and re-evaluated where `github.event_name` is
  `workflow_call` — never test `event_name` in one. `github.ref` survives.
- A green `uses:` wrapper job means nothing about whether the callee did work; a skipped wrapper also
  reports success. **Check the registry.**
- The `build.yml` house rule: no `${{ }}` inside any `run:` body, comments included.
- `secrets: inherit` is the only way secrets reach a called workflow, and it is all-or-nothing.

---

## Open Questions for Review

### Blocking

1. 🔴 **Is this story worth doing at all?** §2 measures the prize at ~5–8 runner-minutes/day and zero
   developer wall-clock, against a first task that has already defeated one story. Task 2.3
   escalates it. **Answering "cancel, with the measurement recorded" is a legitimate close.**

### Non-blocking

2. **`provenance: false` versus fixing the digest assertion** (§3) — one line against a real change,
   and nothing in this plan consumes provenance attestations.
3. **`type=inline` as a deviation from AC1's letter** (route d) — cheaper, needs no driver change,
   may not satisfy AC3.
4. **AC4's "exempt" is pattern-read only**, and the rule has still never been observed deleting
   anything. First possible observation 2026-08-29.

---

## Dev Agent Record

### Agent Model Used

Opus 5. Context gathered by three Haiku subagents, story validated by Fable, implementation and
measurement by Opus.

### Debug Log References

| run | change under test | runner | secs | outcome |
|---|---|---|---|---|
| 660 | `docker-container` + `network=host`, **no cache** | 19 | 131 | 🔴 **push WORKS** — both tags in `package_version`. Job red on the digest assertion |
| 661 | + `cache-to/from type=registry`, `provenance: false` | 19 | 148 | `buildcache` created. Still red on the assertion |
| 662 | assertion on `imagetools` | 20 | 135 | ✅ green, all tags verified |
| 663 | **empty commit — identical tree, other runner** | 19 | **28** | ✅ every layer `CACHED`, incl. `npm ci` and `npm run build` |
| 664 | trivial source change, BuildKit already warm | 20 | 131 | ✅ green — the +25 s is steady-state, not a one-time pull |

### Completion Notes List

**Route (a) works, and the reason four stories gave for why it could not was wrong.**

`build.yml`, `deferred-work.md` and D17 all state the push fails under `docker-container` because a
BuildKit container does not inherit the job container's `--add-host`. True, and not the mechanism.
Measured: the dind's own `/etc/hosts` holds only localhost; `git.crm-prionex.com` arrives by DNS —
`127.0.0.11` (Docker's embedded resolver) → the s1 host's resolver → the **host's** `/etc/hosts`. A
BuildKit container on the default bridge loses the embedded resolver, falls back to public DNS and
dies with the bare `EOF`. `network=host` restores it and fixes the **name**, not only the route.

**AC2 and AC3 proved cross-runner, not inferred.** Run 663 ran on runner 19 with the tree run 662
had built on runner 20. The trees of runs 661 and 662 differ, so runner 19 had never built that
tree — yet `COPY . .` and `RUN npm run build` came back `CACHED`. The layers can only have come from
the registry.

**🔴 The measured outcome is break-even, and it is recorded rather than dressed up.**

| case | before | after |
|---|---|---|
| source changed (most builds) | 106 s | **131 s** |
| identical tree, other runner | 107 s | **28 s** |
| identical tree, same runner | 24 s | 28 s ⚠️ *inferred when written; confirmed later by run 670 at 27 s* |

Over the real ten-build window 645–659: **814 s before, 795 s after** — **−1.9 s per build**, under a
minute a day, against 280 MB for `buildcache`. The `docker-container` overhead is steady-state, not a
one-time BuildKit pull: run 664 ran on a runner already warm from 662 and cost the same 131 s.

**Kept anyway, decided by Oleg 2026-08-16, and not for the stopwatch.** Cross-runner merge builds go
107 s → 28 s, which is a **variance** result rather than a mean one — build time stops depending on
which runner picks the job up. A pruned dind volume or an added third runner recovers from the
registry instead of rebuilding. FR9 and AC1 close. And the project stops standing on a workaround for
a misdiagnosed problem.

🔴 **`network=host` — I understated the blast radius and asserted a false dichotomy.**

I wrote "it reduces isolation … the alternative is no registry cache at all". Review measured it.
The dind container is **privileged**, runs `dockerd -H tcp://0.0.0.0:2375 --tls=false`, and is
dual-homed onto `forgejo_forgejo` — the same segment as `forgejo-postgres`, `forgejo-valkey`,
`forgejo` itself and **`forgejo-openbao`**. The BuildKit image has no CNI, so with `network=host`
**every `RUN` step** — `npm ci` and `npm run build`, executing lifecycle scripts from any branch's
lockfile — lands in that namespace un-NAT'd, with `127.0.0.1:2375` reachable.

⚠️ Fairly: the dind API was **already** reachable from job containers
(`DOCKER_HOST=tcp://172.17.0.1:2375`). What is new is that it now applies to **build-time code from
an arbitrary branch**, and the NAT boundary is gone.

🔴 **And the dichotomy was false.** `buildx create --config` with a CNI configuration keeps host
networking for the buildkit daemon while restoring a private netns for `RUN` steps. I did not
consider it. **This is a security-posture decision and it belongs to Oleg, not to this story.**

⚠️ **`network=host` was also never isolated as a variable.** Run 660 changed the driver *and* added
the option in one commit; no run used `docker-container` without it. The mechanism is well supported
by the DNS facts, but `build.yml` says "NOT cosmetic and NOT removable" as though measured, and it
was reasoned. One run would settle it.

**🔴 The digest assertion's stated reason and its actual behaviour diverged — for the third time in
two days.** The file carried an `__INDEX__` branch added the previous day, on the theory that
changing the driver would make buildx emit a manifest index. The shape prediction was right (run 660's
log shows `exporting manifest` + `exporting attestation manifest` + `exporting manifest list`) and
irrelevant: run 661 set `provenance: false`, produced a **single** manifest, and the command still
failed —

```
unsupported manifest media type and no default available:
application/vnd.oci.image.manifest.v1+json
```

`docker manifest inspect` cannot read OCI media types at all. **The `__INDEX__` branch never executed
once.** Replaced with `docker buildx imagetools inspect`.

🚨 And it failed with a **false attribution**: "did not resolve in the registry" for a tag that the
same run had just pushed and which is in `package_version`. A fail-closed guard that misnames the
cause of its own failure sends the next reader after the registry instead of the tool.

🔴 **The mechanism I recorded for the +25 s was wrong, and the truth is worse for the change.**

I wrote it up as "`docker-container` overhead". Review measured what actually happens to the layer
AC3 is about:

| | `RUN npm ci` |
|---|---|
| run 656 — old `driver: docker`, source changed | **`CACHED`, 0 s** |
| run 664 — new driver + registry cache, source changed | **`DONE 17.0 s`** (pull + extract 205 MB) |
| run 660 — new driver, no cache at all | ~15 s (actually runs `npm ci`) |

The registry cache restores the dependency layer **more slowly than rebuilding it**, and far more
slowly than the old configuration gave it away for free. The cause is not driver overhead: with
`driver: docker` the build used the dind daemon's **persistent** image store, while
`docker-container` creates a **fresh BuildKit per job** — the logs show `buildx create` and a
matching teardown in every run. **We traded a free persistent local cache for a paid remote one.**

The totals in the table above already contain this, so the −1.9 s/build conclusion stands. The
*explanation* did not, and AC3 is closed as a success in a story that never recorded that the
mechanism it proves costs 17 seconds to buy something that used to be free.

**Post-review verification.** The review's fixes were exercised in production, not just locally:
run 673 (branch) and run **676** (`build-main.yml` on `main`) both succeeded on the user-defined
network — `main-dev` and `sha-dd97a3e2f881-dev` in `package_version`, `buildcache` refreshed, **28 s**.
The push survives without `network=host`, which is what proves the network took effect: on the
default bridge the registry resolves to the public address and the push dies.

**Closing evidence, and it arrived unprompted.** The merge of PR #40 was itself the cross-runner
case this change exists for:

| run | | runner | secs |
|---|---|---|---|
| 665 | branch, commit `1d211968` | **19** | 128 |
| 667 | `main`, the merge of that same tree | **20** | **27** |

107 s → 27 s, in production, on the first merge after landing. The variance argument used to justify
keeping a break-even change paid off immediately.

🔴 **Budget — declared 10–14, spent 19, and the honest split matters more than the total.**

```
SELECT count(*) … WHERE repo_id=16 AND id > 656   -- 19 runs (657–676): 17 success, 2 failure
```

| phase | runs | against |
|---|---|---|
| context + implementation (657–670) | **14** | 10–14 declared — **at the top of the band** |
| review round and its fixes (671–676) | **5** | **not budgeted at all** |

Two separate failures, and only one of them is the estimate:

1. **The estimate was sound.** 14 against 10–14 is what declaring before the work buys, and it is
   the reason the overrun is visible instead of arguable.
2. **I closed the ledger at 8 while the closing PR's own runs were still executing**, then used that
   number to say the process had improved — and "8" reached D22's changelog row, which is durable.
   Review caught it. Corrected there and here.
3. 🔴 **I budgeted for implementation and not for review.** Every story in this project has had a
   review round; every one of those rounds has found something; three of them found something
   blocking. **A review round is not a contingency, it is a phase**, and the next story's Task 3.1
   should budget it as one rather than discovering it as an overrun.

### File List

- `.forgejo/workflows/build.yml` — MODIFIED (driver, cache, `provenance: false`, digest assertion)
- `docs/migration-decisions.md` — MODIFIED (D22 with anchor above the heading and before the
  changelog; summary-table row; changelog row)
- `_bmad-output/planning-artifacts/epics.md` — MODIFIED (FR9's conflict resolved in place, 1 line)
- `_bmad-output/implementation-artifacts/deferred-work.md` — MODIFIED
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — MODIFIED
- `src/index.css` — touched on the probe branch only, **not landed**
