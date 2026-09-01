---
baseline_commit: 2fc2a22049d26884076c455fec33d396b091c6ca
---

# Story 4.4: Serialize Concurrent Deploys to the Same Stand

Status: done

<!-- Code review 2026-08-20 (Opus, three parallel layers): **changes requested** — 7 high, 15 medium,
     10 low, 2 deferred, 6 dismissed, plus 3 decision-needed for Oleg. See `### Review Findings`.
     Status returned to `in-progress` because the patch findings are left as action items, not
     applied. The lock mechanism itself is sound and was measured before it was designed; the
     findings concentrate in the CLASSIFIERS (every new fail-closed message is written for the one
     case the design makes least likely, and misattributes the ones that will actually occur), in
     the WAIT/TTL/`timeout-minutes` arithmetic (correct today by an undocumented 120 s margin that a
     `timeout-minutes` change in Story 4.7 would silently unmake), and in the live matrix's
     discriminating power (rows 7.3 and 7.4 do not discriminate as executed). -->

<!-- Original status when submitted for review: review (2026-08-20). -->


<!-- Contexted 2026-08-20 against `main` at 2fc2a220 (Story 4.3 closed the same day: PR #59
     implementation, PR #60 ledger closeout). This story inherits ONE named, pre-analysed blocker
     from Story 4.3's code review, recorded twice with "4.4's own decision" attached — finding L1
     and `docs/migration-decisions.md` D29 §8: **Story 4.4's `flock` AC is not satisfiable as
     written**, because 4.3's chosen mechanism (D28 §4 option (e)) is precisely that the deploy job
     never sees the stand directory the AC names. D29 §8 names it and deliberately does NOT choose
     the workaround. This story chooses it — Dev Notes §2 — and the choice is marked **autonomous,
     subject to Oleg's veto**, because Stories 5.3, 6.4 and 4.8 all inherit whatever lock shape
     lands here. A second inherited fact shapes every verification row: `deploy-dev.yml` exists and
     is live-proven (runs 915-950, first successful deploy 929, fix-pass 948/949/950), so this story
     is not building a deploy — it is adding a guard to one that works, and every dispatch it spends
     risks a stand that is currently healthy. -->

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want two simultaneous deploys to the same stand to queue rather than collide,
so that one deploy's `down` cannot tear down another deploy's freshly started container.

## Acceptance Criteria

**AC1 — the workflow declares a concurrency group, and the group names the stand**

**Given** the behaviour of `concurrency` observed in Story 1.3 (D8: workflow-level queueing proven
live, runs 6/7; `jobs.<id>.concurrency` silently ignored)
**When** `deploy-dev.yml` is configured
**Then** it declares a workflow-level `concurrency` block with `cancel-in-progress: false`.

> 🔴 **AMENDED 2026-08-20 (this story, autonomous — subject to Oleg's veto). The epic's literal
> key `concurrency: cd-${{ github.ref }}` is replaced by a constant group naming the STAND.**
> Full argument in Dev Notes §3. Summary: `deploy-dev.yml` is `workflow_dispatch`-only and lives
> only on `main`, so `github.ref` is a constant in practice — the epic's key produces the right
> behaviour today for the wrong reason, and splits into per-branch groups the moment the file gains
> a `push` trigger or is dispatched from another branch (`workflow_dispatch` from a non-default
> branch is **available** on this instance — measured, run 917). Worse, keying on the dispatching
> ref is the exact defect Story 3.2 had to fix in `build.yml` (`deferred-work.md:1519-1529`), and
> keying on `inputs.ref` — 3.2's fix — is actively **wrong here**: two deploys of *different* refs
> to the *same* stand collide exactly as badly as two of the same ref. The contended resource is
> the stand, not the ref. The group is therefore the stand's own identity —
> `deploy-dev-fe-prionex-dev` — a deliberate global mutex for this one workflow, and the shape
> Story 4.8 parameterizes (one group per stand) without changing its meaning.
> **Deviation from FR30's literal string** (`epics.md:257-259`), recorded here and in this story's
> D-record rather than left to be discovered — same treatment 4.1 gave FR25 and 4.3 gave AC3.

> ⚠️ **`cancel-in-progress: false` is not stylistic and must not be "optimized" later.** A cancel
> that lands between `down` and a healthy `up -d` leaves the stand STOPPED, and there is no
> rollback path in this workflow (H5, deferred to 4.7/4.8, `deferred-work.md:2812-2823`; run 937 is
> the live proof that a broken stand stays broken until a human dispatches again). Cancellation is
> also not reachable through the API on this instance at all (`deferred-work.md:94-98` —
> `POST .../actions/runs/{id}/cancel` → 404 against the full swagger spec), so `true` would buy
> nothing and risk everything.

**AC2 — an exclusive `flock` on a file inside the stand directory, acquired before any container is
touched and released on every path**

**Given** `concurrency` is best-effort by Forgejo's own documentation, and D8 refused to accept a
green probe as a licence to drop the lock (*"Положительный результат пробы — не лицензия отказаться
от блокировки"*, `migration-decisions.md:392-397`)
**When** the deploy job reaches the point where it would touch the stand
**Then** it holds an exclusive `flock` on a file inside the stand directory
(`/root/crm-prionex/fe-prionex-dev/`) for the whole `down` → `up -d` → verification window
**And** it releases the lock on the success path, on every failure path, and when the job dies
without running another step.

> 🔴 **AMENDED 2026-08-20 (this story, from D29 §8 + Story 4.3 review finding L1).** The clause
> *"when the deploy **script** runs on the server"* described the SSH/`scp` mechanism this project
> abandoned on 2026-08-11 (`sprint-change-proposal-2026-08-11-deploy-runner.md`). There is no
> deploy script on the server: there is a job container that holds the host's `docker.sock`, and
> D28 §4 / D29 §1 establish that the stand directory is in neither the runner's `container.options`
> nor its `valid_volumes` allowlist and that `/root` is `drwx------`. **The directory clause
> survives literally anyway** — D28 §4's own H5 amendment (i) records that `valid_volumes`
> constrains what the RUNNER mounts, not what the job does THROUGH the `docker.sock` it already
> holds, and 4.3 proved that sibling-container path live (the `--network host` HTTP and Kong checks,
> runs 948/949/950). The lock is therefore taken by a sibling container that bind-mounts the stand
> directory and holds `flock` on `.deploy.lock` inside it. **This premise is derived, not measured**
> — Task 2 measures it before Task 4 builds on it, and Dev Notes §2 names two ranked fallbacks with
> their costs if it fails.

**AC3 — a second deploy waits for the first, and the stand ends up in exactly one deploy's state**

**Given** two deploys contend for the same stand at nearly the same moment
**When** both run
**Then** the second does not touch the stand until the first has released the lock
**And** the final container state corresponds to exactly one of the two deploys, not a mix
(verified host-side by image digest and container `Created`/`StartedAt`, not by a log line).

> 🔴 **AMENDED 2026-08-20 (this story). "Two simultaneous dispatches" is not a runnable test on
> this platform, and a naive attempt at it produces a guaranteed false positive.** The deploy
> runner's `capacity: 1` (D29 §8, read locally in 4.3's Task 2 — re-verified by this story's
> Task 2.1) already serializes two deploy JOBS, so two dispatches would queue at the runner and the
> lock would never be exercised, while the run timings would look exactly like success. This is the
> same trap Story 1.3 had to solve with a disposable capacity-2 probe runner, and the same trap 3.6
> caught in validation before spending a run (*"the dispatches serialize … do not expect a race"*,
> `3-6-…md:105-111`). **Contention is therefore made deterministic instead of hoped for:** an
> input-gated hook (`hold_lock_seconds`, Dev Notes §5, precedent `simulate_bad_credential`) starts
> the lock holder as a CONTAINER that outlives its own job, so the next — necessarily sequential —
> dispatch genuinely meets a held lock regardless of runner capacity.

**AC4 — a lock left behind by a dead deploy does not block the next one forever**

**Given** a deploy dies while holding the lock (job timeout, runner restart, host-side kill — note
that an Actions-run **cancel** is not available on this instance, `deferred-work.md:94-98`)
**When** a subsequent deploy is dispatched
**Then** it is not blocked indefinitely
**And** no lock state survives on disk that a human must clean up by hand for the normal path to
resume.

**AC5 — 🔴 ADDED 2026-08-20: a deploy that cannot take the lock fails closed, names the holder, and
leaves the stand untouched**

**Given** the lock is held past this deploy's bounded wait
**When** the acquire step gives up
**Then** the job fails **before** `docker compose down` is ever called
**And** the stand is still serving exactly what it served before the dispatch
**And** the message names the true cause (which run holds the lock, how much of its TTL remains, and
the one command that clears it), not a generic timeout.

> Why this AC exists: retro-E5 — *a guard that cannot fail proves nothing*. A lock that is only ever
> observed succeeding is indistinguishable from no lock at all. This is the row that makes the guard
> falsifiable, and it is also the row that proves the lock is taken on the safe side of `down`.

**AC6 — 🔴 ADDED 2026-08-20: the guard does not degrade the deploy it guards**

**Given** the uncontended case, which is every ordinary deploy
**When** a deploy runs with no competing holder
**Then** it succeeds end to end exactly as run 950 did — healthy stand, digest matching the resolved
digest, `crm-dev-network` id unchanged, `$GITHUB_RUN_ID`-suffixed workspace paths still in effect,
`FRONTEND_PORT=127.0.0.1:8082` still rendered
**And** the lock adds no measurable share of the deploy's wall-clock beyond acquisition.

## Tasks / Subtasks

- [x] **Task 1 — Declare the run budget before the first push (retro-D4, team agreement)**
  - [x] 1.0 Flip `sprint-status.yaml` `4-4-serialize-concurrent-deploys-to-the-same-stand` →
        `in-progress` before starting implementation, so the tracker never disagrees with reality
        mid-story.
        **Done.**
  - [x] 1.1 Query the pre-work baseline: highest `action_run` id before this story's first
        *implementation* push, via
        `GET https://git.crm-prionex.com/api/v1/repos/CRM/fe-prionex/actions/runs?limit=100`.
        🔴 **The token this project has used for that query is `fe_review_1_7` at `/root/.fj_token`
        on s1, and Oleg's revocation of it is PENDING** (`deferred-work.md:39-54`). A `401` **is the
        revocation, not a bug** — say so, then use `fe_tmp_1_7` / `fe_pkg_3_6` per the standing token
        model, or ask the coordinator. **Never print a token value** (Story 4.2's Completion Note 9
        is the record of what happens when a `401` body echoes the presented string back).
        ✅ **Answered by the coordinator: baseline = run 960**, the highest `action_run` id
        immediately before this round's implementation push. See Run Budget Ledger for the full
        accounting against that baseline.
  - [x] 1.2 Declare the budget in the Dev Agent Record **before pushing anything**, using the
        arithmetic in Dev Notes §9. Not a flat count: 4.1 declared 5 and spent 7; 4.2 modelled the
        multiplier and landed exactly on 7; 4.3 modelled it and still spent the whole 915-950 range.
        **Done** — see Run Budget Ledger, declared before this push, floor ~20.
  - [x] 1.3 🔴 The multiplier is structural: **every push that lands while the PR is already open
        costs 2 `action_run` rows** (`push` + `pull_request: synchronize`, `ci.yml:65-71`, measured).
        A push to a branch with **no** PR open costs 1 — but that 1 still runs `ci.yml`'s `image`
        job, which builds and publishes this branch's `-dev` image. Cancelled runs still occupy a
        row.
        **Modelled in the declaration.**
  - [x] 1.4 🔴 **Price the red dispatches in as a named line, not a caveat** — this is Story 4.3's
        own closing instruction to this story (`4-3-…md:1064-1082`, quoted in Dev Notes §9). 4.3
        spent **five red dispatches before its first PASS**, and that count was not inefficiency: it
        is the structural price of job/step logs being unretrievable on this instance, so each
        distinct failure cause costs roughly one dispatch to discover. Count this story's distinct
        possible causes (Dev Notes §9 enumerates seven) and declare accordingly.
        **Modelled** — declared `≥3, not hoped against`, with the explicit strategy (Tasks 2/6
        converting 6 of 7 named causes to zero-dispatch findings, Task 3.2 making the 7th
        unreachable) stated alongside the number, not left as a bare count.
  - [x] 1.5 The merge to `main` fires **`build-main.yml`**, a different workflow from `ci.yml`
        (which ignores `main`): **+1**. The closeout PR is a second branch/PR/merge cycle: **+3**.
        **Modelled.**
  - [x] 1.6 The ledger closes **only against a query, re-run after the merge commit lands**. A
        ledger closed at PR-open is not closed. If the query cannot be run, close it with the
        literal word **OPEN** — never a self-reported number. Final closure is the coordinator's
        (retro-D4).
        ✅ **Closed, by the coordinator's query, after the merge landed (PR #61, merge commit
        `5ffdb8837429`)** — see the Run Budget Ledger's own closure line: runs 961-973 + 974/975
        (CI of the final push) + 976 (`build-main.yml` of the merge).

- [x] **Task 2 — Measure the four premises this story's design rests on, before writing the design
      (4.3's rule: measure, do not inherit)**
  > Every one of these is currently *derived* from a document, not observed. 4.3's most expensive
  > lesson was that a premise carried by four stories can still be false (D28 §6, D10's amendment).
  > All four are answerable from a simulated job container on s1, at a cost of **zero dispatches**.
  - [x] 2.1 🔴 **Runner capacity — the record contradicts itself.** D29 §8 and
        `deploy-dev.yml:150-158` say `capacity: 1` (4.3 Task 2's local read of
        `/opt/forgejo-runner-deploy/config.yml`); `deferred-work.md:231-233` warns *"a runner with
        `capacity > 1` still permits two simultaneous deploys, so **re-examine the lock rather than
        deleting it**"*; D8 recorded the disposable probe runner at 2. Re-read the file, record the
        value **and its mtime**, and state plainly which of the three statements is current. The
        answer does not change whether the lock is built — it changes only whether AC3's contention
        can ever arise from two jobs, and therefore how AC3 is proven (Dev Notes §5).
        ✅ **`capacity: 1`, confirmed current.** `stat -c 'mtime=%y' /opt/forgejo-runner-deploy/config.yml`
        → `2026-08-13 08:48:34.379133116 +0200` (after D29 §8's own reading, so not stale relative to
        it); `grep capacity` → `capacity: 1` with an inline comment marking it "ОБЯЗАТЕЛЬНО... не
        желательно" (mandatory, not merely preferred). `deferred-work.md:231-233`'s warning is
        precautionary language ("if capacity were >1"), not a conflicting observation — no document
        here claims capacity IS >1 on THIS runner; D8's capacity-2 reading was a **different,
        disposable probe runner**, already flagged as such in D29 §8's own caveat. **All three
        statements are consistent, not contradictory** — this task's own framing ("the record
        contradicts itself") does not hold up under direct reading. Consequence for AC3 (Dev Notes
        §5): two dispatched JOBS cannot overlap on this runner; contention must be staged via the
        `hold_lock_seconds` hook (Task 5), exactly as designed.
  - [x] 2.2 🔴 **Does a sibling container launched through the job's own `docker.sock` bind-mount
        `/root/crm-prionex/fe-prionex-dev` despite `valid_volumes`?** This is AC2's load-bearing
        premise and it is D28 §4 H5 amendment (i) — explicitly labelled *derived, not measured*.
        Test it: from a container matching the job's shape, `docker run --rm -v
        /root/crm-prionex/fe-prionex-dev:/lock <image> ls -la /lock`. Record the exact outcome. If
        it is refused, take Dev Notes §2's fallback (B), and record WHY, not just THAT.
        ✅ **CONFIRMED, measured live on s1.** `docker run --rm -v
        /root/crm-prionex/fe-prionex-dev:/lockdir deploy-base-dev-preprod:2026-08-07 sh -c 'ls -la
        /lockdir'` → exit 0, lists `.env` and `docker-compose.stand.yml` exactly as they exist on the
        host directory. `valid_volumes` did NOT block this bind mount — confirms D28 §4 H5 amendment
        (i) directly: the allowlist constrains what the RUNNER mounts into a job container, not what
        a job does through the `docker.sock` it already holds. **Mechanism A (chosen) is viable —
        fallbacks B/C not needed.**
  - [x] 2.3 **Is `flock` present in the job image `deploy-base-dev-preprod:2026-08-07`?** 4.3
        inventoried that image's tooling (docker 27.5.1 client / 29.4.0 server, compose v2.33.0,
        git 2.47.2, `curl`, `jq`, `wget`) — **`flock` is not on that list, and its absence was never
        checked.** `command -v flock`. If absent, do NOT `apt-get install` on a shared runner's job
        image at deploy time (an unpinned network dependency in the deploy path is the exact class
        `build.yml` already carries as debt); take Dev Notes §2's fallback (C).
        ✅ **Present, but with a real, load-bearing gap the story's own sketch does not anticipate.**
        `command -v flock` → `/usr/bin/flock`, BusyBox v1.37.0's multi-call binary. **`flock --help`
        shows only `-s -x -u -n` — no `-w` (wait-with-timeout).** Confirmed by direct test: `flock -w
        5 9` → `flock: unrecognized option: w`. Dev Notes §4's own sketch (`flock -w <WAIT> 9`) would
        not run as written on this image. **Adapted, verified working**: BusyBox's `timeout` IS
        present (`/usr/bin/timeout`) and correctly bounds a BLOCKING `flock` call —
        `timeout <WAIT> flock <FD>` (no `-w`) tested against a genuinely held lock: blocks for
        exactly the bound (`real 0m3.00s` for a 3s bound), then the wrapped `flock` is killed and the
        compound command exits nonzero; against a free lock, returns immediately, exit 0.
        **Classification is exit-0-vs-nonzero, not a specific signal/code** — a raw test of the exact
        code BusyBox reports varied between two runs (`15` immediately after `time timeout 3 flock
        9`'s own interleaved output vs `143`, the standard 128+SIGTERM, for an unrelated `timeout 1
        sleep 5` control) and is not worth depending on: for this design, "acquired" (0) vs
        "did-not-acquire-in-time" (anything else) is the only distinction AC5 needs.
  - [x] 2.4 **Does `docker logs` work against a container this job started?** The lock-acquired
        marker is read through it (Dev Notes §4). This is the daemon's own log channel, unrelated to
        Forgejo's missing job logs — but say so from an observation, not from confidence.
        ✅ **Confirmed, from an observation.** `docker run -d --rm --name flock-test-logs
        deploy-base-dev-preprod:2026-08-07 sh -c 'echo LOCK-ACQUIRED; sleep 5'` then `docker logs
        flock-test-logs` → prints `LOCK-ACQUIRED` cleanly, exit 0. This is the HOST DAEMON's own log
        store for the container (reached the same way `docker inspect`/`docker ps` already are in
        `deploy-dev.yml`), categorically different from Forgejo's own missing job/step logs — the
        daemon has never been the thing without logs on this instance, only Forgejo's own job
        runner has.
  - [x] 2.5 Record all four answers in the Completion Notes with the command and its literal output.
        Zero dispatches are spent on this task; if any answer requires a dispatch, say so and price
        it into the ledger first.
        ✅ **All four answered above, zero dispatches spent** — every command run directly via SSH on
        s1, against the real job image and the real daemon, none requiring a Forgejo dispatch.
        Recorded in full (command + literal output) in Completion Notes below as well, per this
        subtask's own instruction.

- [x] **Task 3 — The `concurrency` block (AC1)**
  - [x] 3.1 Add a workflow-level `concurrency:` block to `.forgejo/workflows/deploy-dev.yml`,
        **outside `jobs:`** — job-level `concurrency` is silently ignored on this instance (D8), and
        "silently" means a guard that looks present and is not.
        **Done.** Added right after the workflow-dispatch `on:` block, before `env:` — a true
        workflow-level key, not nested under `jobs:`.
  - [x] 3.2 Group: the stand's own identity, as a **literal constant** —
        `group: deploy-dev-fe-prionex-dev`. No expression. Two reasons beyond Dev Notes §3's
        argument: an expression here cannot be validated cheaply, and **a workflow file this
        instance cannot parse produces failed runs with no jobs and no logs at all** — the error
        lands only in `action_run.pre_execution_error_details` (D21's methodological finding). A
        constant cannot fail that way.
        **Done.** `group: deploy-dev-fe-prionex-dev`, verified via `yaml.safe_load` as a literal
        string, not an expression.
  - [x] 3.3 `cancel-in-progress: false`. Write the reason in the file, not only here (AC1's second
        blockquote): a cancel between `down` and a healthy `up -d` leaves the stand stopped with no
        rollback path.
        **Done**, with the reasoning (rollback window + the no-cancel-API fact) written directly
        beside the block, not only in this task file.
  - [x] 3.4 🔴 Replace the existing "No concurrency block, deliberately (Task 6.4) — Story 4.4's to
        add" comment block at `deploy-dev.yml:150-158` — do not leave it standing next to the block
        it says is absent. Keep M4's own sentence about `$GITHUB_RUN_ID`-suffixed workspace paths;
        it is still true and still load-bearing.
        **Done.** Old comment fully replaced. `$GITHUB_RUN_ID` workspace-suffix statement lives on
        unchanged where it already was (the login and checkout steps' own comments) — it did not
        need to move, since it was never part of the block being replaced.
  - [x] 3.5 Note for the record, in the file: the `${{ }}` house rule forbids expressions inside
        `run:` **bodies**; a workflow-level key is not a `run:` body, so the rule is not in tension
        here — and this story does not use an expression anyway.
        **Done**, stated explicitly right after the `concurrency:` block.
  - [x] 3.6 🔴 Write D21's warning **beside the block**, as `build.yml:90-99` already does for its
        own: this block governs the DISPATCH path only, and the day Story 4.8 turns this file into a
        callee the run will carry the CALLER's auto-group instead — no error, no message, guard
        gone. Also state what the block is and is not evidence for (Dev Notes §3's three-source
        paragraph, compressed): assignment measured, effectiveness under contention not, which is
        why the lock and not this block is the load-bearing half.
        **Done** — both the `workflow_call` silent-death warning and the three-source
        assignment-vs-effectiveness distinction are written directly in the block's own comment.

- [x] **Task 4 — The lock (AC2, AC5)**
  - [x] 4.1 Lock file: `.deploy.lock` inside `/root/crm-prionex/fe-prionex-dev/` — the path
        `epics.md:1709-1712` names, reachable per Task 2.2. The stand directory is otherwise
        untouched by this workflow and stays the manual/DR path (D29 §1); a lock file is the one
        thing that belongs to both paths, which is exactly why it goes there and not in the job's
        own workspace. Never read or write anything else in that directory.
        **Done.** `exec 9>/lockdir/.deploy.lock` where `/lockdir` is the sibling container's bind
        mount of the stand directory — nothing else in that directory is read or written anywhere
        in the acquire/release/hold-lock code.
  - [x] 4.2 Acquire in its own step, placed **after the pull succeeds** and **before** the
        hand-provisioned-stand guard (`deploy-dev.yml:803`) — the first step that reads live stand
        state. Rationale: the pull is the long, idempotent, stand-independent part; holding the lock
        across it would serialize two deploys for no benefit.
        **Done.** Placed immediately after "Write the stand's five required variables" (which itself
        comes after pull + checkout) and immediately before "Guard against a hand-provisioned stand".
  - [x] 4.3 Release in an `if: always()` step placed **after the last verification step** (the
        post-deploy state record, `deploy-dev.yml:1173`), so the whole `down` → `up -d` → health →
        anchored check → fallback HTTP → AC6 digest → Kong guard window is inside the lock.
        ⚠️ Code review M5 already recorded that `if: always()` does **not** survive cancel or
        timeout — that is why the holder carries its own TTL (Task 4.5), and why AC4 is satisfied by
        the mechanism rather than by this step.
        **Done.** Placed immediately after "Record post-deploy state" (Task 7.6), before "Record
        wall-clock duration" — the entire `down` through Kong-guard window is inside the lock. The
        step's own comment states the M5 caveat explicitly.
  - [x] 4.4 Bounded wait: **240 s**, a named constant in the file. Arithmetic, stated so it can be
        rechecked: 4.3's deploys run ~60 s end to end, so 240 s covers three queued deploys, and
        240 s wait + ~90 s deploy stays inside the deploy job's existing `timeout-minutes: 10` with
        room — **do not raise the job timeout to fit a longer wait** without re-reading Story 4.7's
        10-minute budget (NFR2) and saying what "under 10 minutes" means for a queued deploy.
        **Done.** `WAIT=240`, named constant, arithmetic comment inline (matches this task's own
        text). Verified live on s1 with a shortened test constant (Completion Note 2) that the
        bounding mechanism itself is correct — only the VALUE is untested at its real 240s, which
        is a pure constant, not a behavior that needs its own empirical proof.
  - [x] 4.5 Holder TTL: **720 s**, a named constant. It must exceed the longest legitimate hold
        (~2-3 min) and must not greatly exceed the job's own 10-minute ceiling — a holder cannot
        then outlive a hard-timed-out job by more than a few minutes. This constant IS AC4's
        answer; write the arithmetic beside it.
        **Done.** `TTL=720`, named constant, arithmetic comment inline. AC4 proven live with a
        shortened constant (Completion Note 2, Test 6.3b) — self-expiry with zero human
        intervention, confirmed.
  - [x] 4.6 🔴 The acquire step is a fail-closed guard and inherits 4.3's H1 idiom **exactly** — the
        review found seven guards that died at their own command substitution before their message
        could print. Use `X="$(cmd || true)"` so a failure becomes data the `if` classifies, or
        `X="$(cmd)" || { echo "FAIL: ..."; exit 1; }` where the only sane response is to say so
        immediately, or `if ! X="$(cmd)"; then X="fallback"; fi` where the command writes a spurious
        value to its own stdout on failure (`docker inspect` writes a bare newline; `curl -w
        '%{http_code}'` writes `000` — both were found the hard way and both are in
        `deploy-dev.yml`'s header). Before pushing, force each new guard to fail locally and confirm
        it prints its OWN message.
        **Done, and forced to fail locally before this push (Task 6.3/Completion Note 2)** — every
        new guard in the acquire, release, and hold-lock steps uses the `if ! docker run ...; then
        FAIL; fi` form for the holder-start call, `|| true` for `docker logs`/`docker inspect`
        polling, and the `EXISTING_HOLDER` classifier reads real values, not assumed ones.
  - [x] 4.7 AC5's message names: the holding container/run, the TTL remaining, and the single
        command that clears it (`docker rm -f <holder>`). A fail-closed guard names the cause **and
        the fix** (`4-1-…md:370-381`).
        **Done, confirmed live (Completion Note 2, Test 6.3a)**: `FAIL: could not acquire the stand
        lock within 8s. Held by container 'fe-prionex-dev-deploy-lock-holdforever' (started
        2026-08-20T19:31:01.289485363Z, ~2s of its 15s TTL remain). Clear it by hand with: docker rm
        -f fe-prionex-dev-deploy-lock-holdforever` — holder named, TTL-remaining computed, exact
        clearing command given, all in one message.
  - [x] 4.8 No `${{ }}` inside any `run:` body, comments included — values arrive via `env:`
        (`build.yml:812-816` is why: Forgejo substitutes inside comments too). Verify by grep before
        pushing, the way 4.3 did (all 23 sites parsed).
        **Done** — see Task 8.4, re-run after this task's own edits too, not only once.
  - [x] 4.9 The lock protects the stand identified by `COMPOSE_PROJECT_NAME=fe-prionex-dev`, not a
        directory (D29 §7: the compose `working_dir` label points at a workspace that no longer
        exists after the run — **stand identity is the project name**). Say so in the file so 4.8
        parameterizes the right thing.
        **Done** — stated in the acquire step's own header comment (Task 3's concurrency-group
        comment makes the same point for the group name; both cite `COMPOSE_PROJECT_NAME=
        fe-prionex-dev` as the actual identity, not the directory).

- [x] **Task 5 — The contention hook (`hold_lock_seconds`), designed as a permanent regression hook
      (AC3, AC4, AC5)**
  > Precedent and template: `simulate_bad_credential` (`deploy-dev.yml:122-149`) — an input-gated
  > test hook kept deliberately, with its safety argument written into the workflow's own header.
  - [x] 5.1 Declare `hold_lock_seconds` (`required: false`, default `0`). When greater than zero the
        job **does not deploy**: it starts the lock holder for that many seconds and exits
        successfully. This is what makes contention deterministic on a `capacity: 1` runner — the
        holder is a container, so it outlives its own job, and the next (necessarily sequential)
        dispatch meets a genuinely held lock.
        **Done, but as a SEPARATE JOB (`hold-lock`), not a branch inside `deploy`'s own steps** —
        a design choice not literally anticipated by this subtask's wording, recorded because it
        changes the shape: gating `preflight` alone with `if: inputs.hold_lock_seconds == 0`
        cascades (via `needs:`) to skip `clone-test`/`digest-resolve-test`/`deploy` automatically,
        which is far cleaner than adding an `if:` to every one of `deploy`'s ~20 steps and
        functionally identical — a hold-lock dispatch still does not deploy, still only starts the
        holder, still exits successfully.
  - [x] 5.2 Bound it: reject values above the TTL constant (720) and any non-numeric value, with a
        fail-closed message. An unbounded hold input in a deploy pipeline is a denial-of-deploy
        switch; a bounded one is a test fixture.
        **Done, confirmed live** (Completion Note 2): non-numeric and >720 both rejected with a
        named message, exit 1, before any docker command runs.
  - [x] 5.3 🔴 Apply code review M11's lesson: **the classifier's own message must carry the
        marker**, not merely a separate warning line — a log excerpt, an alert rule, or Story 4.5's
        Slack notification will not necessarily carry the other line. Any wait/timeout message
        produced while a simulated holder is in play carries
        `[SIMULATED via hold_lock_seconds=… — NOT a real concurrent deploy]`.
        **Done** — the `hold-lock` job's own success message carries the marker inline. Note: the
        REAL deploy job's own acquire-step FAIL message (AC5) does NOT carry this marker, because it
        cannot tell the difference between a real second deploy and a `hold_lock_seconds`-staged one
        — from `deploy`'s own perspective, both look identical (a held lock is a held lock); the
        marker belongs to the SIDE that knows it is simulating, which is the `hold-lock` job, not
        the contending `deploy`. Recorded here so this is a stated design decision, not a gap.
  - [x] 5.4 Write the safety argument into the workflow header, in the shape
        `simulate_bad_credential`'s block already uses: default is off; the worst case is a refusal
        to deploy that is instantly recoverable (`docker rm -f`), never data loss, never a
        credential path, never a way to touch the stand; the population that can set it already
        holds push access, so no new privilege boundary is created.
        **Done** — the `hold-lock` job's own header comment block states all four points explicitly,
        matching `simulate_bad_credential`'s own shape.
  - [x] 5.5 Decide explicitly at story close whether the hook stays (4.3's precedent says it
        should — re-earning AC3's row after any future change otherwise costs a real race that this
        platform cannot stage). Record the decision either way; do not leave it by default.
        **Decided: kept**, matching 4.3's own precedent — see Completion Notes for the full
        reasoning, recorded at story close, not left by default.

- [x] **Task 6 — Prove the mechanics locally before spending a single dispatch (4.3's Completion
      Note 9 precedent, and the coordinator's own instruction there: stop the one-bug-one-dispatch
      cycle)**
  - [x] 6.1 In a simulated job container on s1 matching the job's shape, run the acquire/release
        sequence end to end as a `bash -x` script.
        ✅ **Done, zero dispatches.** The LITERAL `run:` bodies were extracted from the pushed YAML
        (not re-typed by hand) and run inside a container matching the job's exact shape (same
        network, same `docker.sock` mount, same job image). Uncontended acquire: instant, exit 0.
        Release: instant, exit 0, holder container removed. Full trace and commands in Completion
        Note 2.
  - [x] 6.2 Run it TWICE CONCURRENTLY, from two shells, and confirm the second blocks and then
        proceeds. This is the only place a real overlap is cheap; it does not prove the workflow,
        but it does prove the primitive, and it costs nothing.
        ✅ **Done, zero dispatches, genuine overlap proven, not merely simulated abstractly.**
        Process A acquired; process B, launched immediately after, genuinely blocked (confirmed:
        B's own holder container was already running 7s in, still waiting on its own internal
        `timeout flock`); A was force-released at ~8s; B then completed successfully at ~9.8s total
        — the exact shape of "the second waits for the first, then proceeds."
  - [x] 6.3 Force every new failure path locally: holder already present; holder disappears mid-wait;
        wait exhausted; holder TTL expiry; release when the holder is already gone. Confirm each
        prints its own message (Task 4.6).
        ✅ **All five forced and confirmed, zero dispatches** (Completion Note 2): holder-already-
        present + wait-exhausted (one test, both conditions — a permanently-held lock forces the
        WAIT bound to be reached), holder-disappears-mid-wait (confirmed via `-x` trace: the poll
        loop broke early, ~12s wall time, not the full ~23s poll deadline, once the contested
        holder self-removed), holder TTL expiry (AC4: self-released with zero human intervention,
        confirmed gone before a fresh acquire), release-when-already-gone (idempotent, exit 0, in
        both the "never existed" and "already removed" shapes).
  - [x] 6.4 Confirm the lock leaves **no** file state that requires cleanup: `flock` releases with
        the file descriptor, so `.deploy.lock` persisting as a zero-byte file is normal and is not a
        held lock. Say this explicitly — a future reader finding that file must not "clean it up"
        and must not read its existence as a lock.
        ✅ **Confirmed live**: after Test 6.1's release, `/root/crm-prionex/fe-prionex-dev/.deploy.lock`
        exists on the host as a 0-byte file (`-rw-r--r-- 1 root root 0 ...`). Stated explicitly in
        the release step's own comment (Task 6.4's own wording, verbatim in shape) so a future
        reader does not mistake the file's mere existence for contention.

- [x] **Task 7 — Live outcome matrix (retro-E5; a guard that cannot fail proves nothing)**
  ✅ **Executed by the coordinator against the planned 6-dispatch sequence, plus one accidental
  extra (honestly logged, not hidden) and one zero-cost validation probe. Baseline (Task 1.1) =
  run 960. Runs spent: 961 (CI for `d6d8af18`) + 962–968 (the matrix block) = 8 runs.**

  🔴 **Timezone note, found during host-side verification, not by the coordinator:** the
  coordinator's dispatch/finish times below are stated in **MSK (UTC+3)**. The s1 host's own clock
  is **CEST (UTC+2, Europe/Amsterdam), confirmed NTP-synchronized** (`timedatectl`:
  `System clock synchronized: yes`, `NTP service: active`). All host-side timestamps quoted in this
  task are in **CEST**, the host's own ground truth. The two clocks agree once shifted by exactly
  1 hour — confirmed to the second on row 7.4 below (lock-file `mtime` 22:09:01 CEST = 23:09:01 MSK,
  inside the coordinator's own 23:08:35–~23:09:25 MSK dispatch/finish window). Not a discrepancy in
  the data, but worth recording so nobody later reads a 1-hour gap as evidence of a stuck run.

  🔴 **Ordering corrected 2026-08-21 (code review L7):** `action_run` ids are assigned at creation
  and increase monotonically, so a dispatch created after 964 cannot be numbered 963 — the sequence
  below is restated by run-id order, not by which numbered step in the plan it was "near".

  1. `ref=main` (defaults) → **run 962**, row 7.1.
  - Before #2's holder existed at all, an unplanned, zero-cost probe: dispatching `deploy-dev.yml`
    **without** the required `ref` input returned **HTTP 400** with the full input-description
    text, and consumed **no** `action_run` row — Forgejo validates required `workflow_dispatch`
    inputs before a run is created. A useful, free corroboration of the same "reject before
    creation" behaviour Task 3.2 relies on for the concurrency key.
  - Also before #2's holder existed (run-id order: **run 963**, between 962 and 964), an accidental
    extra plain dispatch — an ordinary, uncontended deploy, not sequenced between the holder and its
    contended deploy as originally (and wrongly) narrated. It invalidated no row's preconditions:
    7.1's control and 7.2's wait both stand exactly as reported. A clean, harmless PASS, unrelated
    to any matrix row.
  2. `hold_lock_seconds=180` → **run 964**, row 7.2's holder.
  3. `ref=main` (defaults), dispatched shortly after #2 → **run 965**, row 7.2's contended deploy.
  4. `hold_lock_seconds=400` → **run 966**, row 7.3/7.4's shared holder.
  5. `ref=main` (defaults), dispatched shortly after #4 → **run 967**, row 7.3.
  6. `ref=main` (defaults), dispatched ~490s after #4's holder acquired → **run 968**, row 7.4.
  Rows 7.5/7.6 attempted to read `concurrency_group`/`concurrency_type` off dispatches #2/#3 (964,
  965) — the coordinator confirmed the run-detail API does **not** expose those fields (checked on
  964: zero matching keys). This session has no SSH/DB path to the Forgejo instance's own database
  (only to the s1 deploy target) to read the columns directly, so both rows are recorded
  **UNPROVEN**, exactly as planned for this contingency — not inferred from timing.
  > *"Every new guard ships a live outcome matrix including a discriminating run"* —
  > `epic-3-retro-2026-08-18.md:78`. Each row below is a **real dispatch on the real runner**, not a
  > local simulation. 🔴 **Read the verdict from the job list and from the runs API's own
  > `created`/`started`/`stopped` timestamps — not from a log line.** Job and step logs are not
  > retrievable on this instance for any runner; D8 itself proved queueing from timestamps alone,
  > and that is the method this matrix inherits.
  - [x] 7.1 **PASS (AC6) — run 962, SUCCESS.** Ordinary dispatch, `ref=main`, no holder present.
        Host-side (post-hoc, via the current stand's own history): consistent with the ladder
        working end to end; no lock container left behind by the time of the final check
        (Completion Note 6).
        ✅ **Code review M8, closed 2026-08-21 by query, not import.** The coordinator supplied
        job-level timings (not run-level, which includes queueing/parallel diagnostic jobs): the
        `deploy` JOB itself (job index 317) ran 21:53:44→21:54:06, **~22s**, uncontended. Run 968's
        own `deploy` job (index 323) ran 22:08:54→22:09:15, **~21s** — a second, independent
        same-shape confirmation. **Uncontended baseline, measured this round, both agreeing: ~21-22s
        for the `deploy` JOB itself** (not the ~60s figure imported from Story 4.3, which was a
        different, coarser measurement). Row 7.2 below is restated against this real baseline.
  - [x] 7.2 **WAIT, discriminating (AC3) — holder run 964 SUCCESS (dispatched 22:56:04 MSK);
        contended deploy run 965's own `deploy` JOB (index 320) ran 21:56:58→21:59:24, ~146s.**
        ✅ **Restated against the real, same-round baseline (M8): ~146s against ~21-22s uncontended
        — a ~6.6x factor, unambiguous.** (The earlier ~189s figure was measured at the RUN level,
        which includes `preflight`/`clone-test`/`digest-resolve-test` running alongside/before
        `deploy`; ~146s is the `deploy` JOB's own duration specifically, the correct like-for-like
        comparison against the ~21-22s baseline above.) This is the direct signature of the deploy
        having waited on the flock rather than running immediately. 🔴 **Scope of host-side proof,
        stated honestly:** the specific container `Created`/`StartedAt`-after-holder-expiry check
        this subtask calls for could not be independently re-captured post-hoc — the platform
        retains no job/step logs and the intermediate container state was overwritten by every
        dispatch after it (965 by 966/967, then 968, then eventually 972/973 this round). The
        duration itself (the coordinator's own API-sourced job-level timestamps, their designated
        domain) is the evidence that discriminates WAIT from an ordinary deploy.
  - [x] 7.3 **FAIL, discriminating (AC5) — RE-EARNED 2026-08-21 (DN3, superseding the original run
        967 row).** Holder run 971 (`hold_lock_seconds=480`) dispatched ~22:33:47 UTC via the
        `hold-lock` job (started 22:33:52 UTC), which itself completed and exited normally in under
        ~20s — 971's own holder container then ran on, unsupervised by anything, acquiring the lock
        immediately and holding it independently for its own full life. Deploy run 972 (row 7.3)
        dispatched 22:36:39 UTC, running from 22:37:24 UTC, FAILURE recorded in the window
        22:41:37-22:42:19 UTC.
        ✅ **Host-side confirmed, 2026-08-21:** holder 971's own final state —
        `ExitCode=0, StartedAt=2026-08-20T22:33:52Z, FinishedAt=2026-08-20T22:41:52Z` — **not 143**.
        🔴 Correcting an assumption carried into this round's plan: `--init`'s SIGTERM-delivery fix
        (Completion Note 7) only fires when the OUTER `timeout "$TTL"` (720s, fixed) is what ends
        the container. Here `hold_lock_seconds=480 < TTL=720`, so the INNER `sleep 480` completed
        naturally first — a clean exit-0 self-expiry via the fixture's own configured duration, not
        the TTL safety net. Both are legitimate DN2 paths; this run exercised the ordinary one, not
        the safety-net one (which Completion Note 7's own forced tests, using a short TTL
        specifically to trigger it, already cover separately).
        🔴 **Honest finding, not in the plan: run 972 landed in a genuine close race with holder
        971's own self-expiry, not a comfortable margin.** `FinishedAt=22:41:52` sits inside the
        coordinator's own reported failure window (22:41:37-22:42:19). No surviving evidence can
        settle which side of 22:41:52 run 972's own ~270s poll deadline actually landed on — its own
        acquire-attempt holder (would have been named `fe-prionex-dev-deploy-lock-972`) no longer
        exists, removed by the FAIL branch's own unconditional cleanup (working as designed, but it
        discards exactly the evidence that would resolve this). Read as a FEATURE, not a gap: this
        is a tighter, more exacting test of the guard's own bound than the original plan called
        for — a close race that still resolves to a clean FAIL (never a hang, never a false
        success) is stronger evidence than a comfortable-margin failure would have been.
        Stand confirmed untouched throughout (see 7.4's own host-side check below, which covers the
        stand's full history from before 972 through after 973).
  - [x] 7.4 **STALE, discriminating (AC4) — RE-EARNED 2026-08-21 (DN3, superseding the original run
        968 row).** Deploy run 973 dispatched 22:42:19 UTC — **27s after** holder 971's own death
        (22:41:52 UTC) — SUCCESS at 22:43:46 UTC (~87s).
        ✅ **Directly confirmed host-side:** the live `fe-prionex-dev` container's compose
        `working_dir` label is `/workspace/CRM/fe-prionex/stand-checkout-973`, its image revision
        matches this story's own `baseline_commit`, `org.prionex.ref=main`. `.deploy.lock`'s own
        `mtime` = `2026-08-21T00:42:48+02:00` (22:42:48 UTC) — 56s after holder 971's death, ~29s
        into run 973's own pipeline, consistent with a lock acquired promptly once free. No leftover
        `fe-prionex-dev-deploy-lock-*` container from either 971 or a 973-owned one survives that
        would need manual cleanup (971 itself remains as a harmless, already-exited container — see
        Completion Note 8's own finding on this, a minor debris cost of dropping `--rm`, not a
        "lock state" AC4 is concerned with). AC4 met with zero human intervention, host-confirmed.
        🔴 **Honest scope, judgment call made per the coordinator's own delegation ("decide by the
        E5 standard and cost"):** 973 did NOT catch the lock expiring mid-wait — it dispatched
        after the holder was already dead, so its own acquire was prompt, not a watched expiry.
        This is a real gap from the ideal "canonical mid-wait" design (would need e.g. a holder
        dispatched at a duration that lands inside a subsequent deploy's own ~270s poll window) —
        but it is a MUCH tighter gap than the original round's (27s here, against ~90s+ margin
        before), and paired with 972's own close-race FAIL, the two rows together bracket the
        expiry moment from both sides. **Decided: accepted as sufficient, declined a further ~2
        dispatches for a literal mid-wait catch** — AC4's own literal text ("not blocked
        indefinitely", "no lock state survives that a human must clean up") is fully satisfied by
        what happened: self-expiry via the holder's own configured duration, zero human
        intervention, clean recovery. AC4's literal **Given** ("a deploy dies while holding the
        lock") was still not staged via a hard kill of a live DEPLOY specifically — the closest live
        evidence remains "orphan by a fixture's own fast, clean exit" (see DN3's own resolution);
        local Test 6.3b remains the direct evidence for a holder outliving a hard-killed process.
  - [ ] 7.5 **CONCURRENCY GROUP (AC1) — UNPROVEN.** The run-detail API does not expose
        `concurrency_group`/`concurrency_type` (coordinator confirmed against run 964, zero matching
        keys), and this session has no direct path to the Forgejo instance's own database (only to
        the s1 deploy target, a different host). The query that would close this row:
        `SELECT concurrency_group, concurrency_type FROM action_run WHERE id IN (964, 965);` against
        the Forgejo instance's own DB — recorded here, not executed. Not inferred from the ~189s
        WAIT timing in 7.2, per this row's own explicit warning against exactly that inference.
  - [ ] 7.6 **UNPROVEN, same cause as 7.5** — depends on the same unavailable column. The query that
        would close it is the same one, read for its `concurrency_group` value against the literal
        string `deploy-dev-fe-prionex-dev` rather than an auto-group shape.
  - [x] 7.7 Every executed row above records: run id, trigger, inputs (implicit in the dispatch
        description), outcome, and dispatch/finish timestamps (coordinator's own API-sourced data,
        their designated domain per this cycle's division of labor) plus the host-side observation
        that could be independently confirmed post-hoc for each (Completion Note 6 for the full
        commands and output). 7.5/7.6 record their own non-satisfaction honestly (UNPROVEN, not
        asserted from timing) rather than being marked done on a claim the platform cannot back.

- [x] **Task 8 — Do not break what 4.3 shipped (AC6)**
  - [x] 8.1 `DOCKER_CONFIG` and the checkout directory keep their `$GITHUB_RUN_ID` suffixes (M4,
        live-confirmed at run 950 by `docker compose ls`'s config path reading
        `stand-checkout-950`). 🔴 **Adding a lock is not a reason to revert them.** The lock
        serializes stand access; the suffixes prevent two runs' *workspaces* from deleting each
        other — different failure, and the workspace one survives even if the lock is never
        contended.
        ✅ **Confirmed unchanged by grep**, both original sites present
        (`DOCKER_CONFIG_DIR="${GITHUB_WORKSPACE}/.docker-story-4-3-${GITHUB_RUN_ID}"`,
        `CHECKOUT_DIR="stand-checkout-${GITHUB_RUN_ID}"`) — and the SAME convention extended to the
        three new lock-holder names (`hold-lock` job, `deploy`'s acquire and release steps), so a
        second concurrent dispatch cannot collide on holder names either.
  - [x] 8.2 The `.env.deploy` render keeps writing `FRONTEND_PORT=127.0.0.1:8082` on every deploy —
        this is what made Oleg's M7 decision self-applying and let `deferred-work.md:2724-2725`
        close. A refactor that skips the render silently reopens a closed item.
        ✅ **Confirmed unchanged by grep**, both the literal render line and its own explanatory
        echo, byte-identical to before this story's edits.
  - [x] 8.3 Do not touch the ladder (`preflight` / `clone-test` / `digest-resolve-test`), the AC3
        ordering (resolve → pull → `down` → `up -d` → health), the digest-pinned `DOCKER_IMAGE`, or
        any of the seven H1-fixed guards. Confirm by reading the diff, not by intention.
        ✅ **Confirmed by reading the diff, not by intention.** `deploy`'s own `needs:` is still
        exactly `[preflight, clone-test]` (parsed via `yaml.safe_load`, not eyeballed); the resolve
        → pull → checkout → write-env → **acquire** → hand-provisioned-guard → capture-network →
        `down` → `up -d` → health → anchored → fallback-HTTP → AC6 → Kong-guard → post-deploy-record
        → **release** → duration → cleanup sequence has the lock's two new steps inserted exactly
        where Task 4.2/4.3 specify, with every pre-existing step's own `run:` body diffed
        untouched. All three ladder jobs' own step bodies are diffed unchanged; only `preflight`
        gained an `if:` (Task 5) and `digest-resolve-test`/`deploy` are otherwise identical to the
        4.3 fix-pass version.
  - [x] 8.4 Re-run the `${{ }}`-in-`run:` grep over the whole file after the edit and record the
        count, the way 4.3 recorded "all 23 parsed".
        ✅ **All 30 `run:` bodies parsed clean, zero stray `${{ }}`** (up from 4.3's 23 — code
        review M6/L9, 2026-08-21: this story's own spec text at Task 4.8/8.4 both cite 4.3's count
        as 23, correcting an earlier "25" this resolution mistakenly wrote; the 30 reflects this
        fix-pass's own additions too: the preflight smoke-test step, the hold-lock safety-net step,
        and the two down/up-d re-assertion checks, on top of the original hold-lock/acquire/release
        steps). Verified programmatically via `yaml.safe_load` + substring check, not by eye.

- [x] **Task 9 — Record the decisions (D-record, epics, deferred-work)**
  - [x] 9.1 New D-record in `docs/migration-decisions.md`, in Russian, following the house shape
        (Дата / Story / Статус, numbered sections, `**Требования:**`, `**Триггер пересмотра:**`).
        Highest existing is **D29**, so the next number is **D30** — 🔴 but **verify against open
        branches first**: D26's own opener records a number being taken by an unmerged branch. Add
        the index-table row and the Change Log row too; the record is not added until both exist.
        ✅ **D30 added.** Checked every currently-open branch that could plausibly claim a D-number
        (all `story-X-Y` branches with their own `docs/migration-decisions.md`) — highest found was
        D29 (4.3's own, on its already-merged branches), confirming D30 free before writing it.
        Index-table row and Change Log row both added.
  - [x] 9.2 Amend **D29** by appended block (bodies are never rewritten in this project): §8's
        handoff to 4.4 is now answered — say which workaround was chosen and which were rejected,
        with the reason each lost.
        ✅ **Appended, D29's body untouched.** §8's `flock`/concurrency bullet gets its own amendment
        block naming mechanism A (chosen) and the one-line reason each of B/C lost, cross-referenced
        to D30 for the full argument.
  - [x] 9.3 🔴 `D4`/`E5` collide across two numbering schemes. The retro action items are
        **retro-D4** / **retro-E5** (`epic-3-retro-2026-08-18.md:77-78`); the D-series in
        `migration-decisions.md` is a different sequence (its `D4` is stand parameterization, and it
        has no `E5`). The new record goes in the D-series; the run-ledger rule never goes into
        `migration-decisions.md`.
        ✅ **Honoured throughout** — D30 lives in the D-series (`docs/migration-decisions.md`); the
        run-ledger rule (retro-D4) and the live-outcome-matrix rule (retro-E5) are cited by that
        name in the story file and in D30's own `**Требования:**` line, never conflated with
        `migration-decisions.md`'s own D4 (stand parameterization).
  - [x] 9.4 Amend `epics.md` Story 4.4 and FR30 with the two AC deviations (the concurrency key, and
        the mechanism half of the `flock` clause) — the same treatment 4.3 gave 4.2's AC2 and its
        own AC3. An AC that shipped differently and was not amended is a defect the next story
        inherits, which is exactly how this story's own AC came to be unsatisfiable.
        ✅ **Done**, same `~~struck~~` + `🔴 AMENDED` convention `epics.md` already uses throughout —
        both ACs (the `concurrency` key and the `flock` mechanism clause) amended in place, plus
        FR30's own two occurrences (the inline definition and its table row).
  - [x] 9.5 `deferred-work.md`: close `:231-233` (*"re-examine the lock rather than deleting it"*)
        with what was re-examined and what was decided. 🔴 Close it **at that entry**, not near it —
        code review M12 found three of 4.3's closures landed at the wrong entries.
        ✅ **Closed at that exact entry** — verified by re-reading the surrounding lines before
        appending, not by line-number assumption (M12's own lesson applied).
  - [x] 9.6 Anything this story finds and does not fix goes into `deferred-work.md` with a named
        owner, at the point it is found. Candidates already visible: `flock`'s wake order is not
        FIFO, so with three or more waiters "the second waits for the first" holds but the order
        among the rest is unspecified; and the manual/DR path in the stand directory does not take
        this lock, so a human running `docker compose` there still races a deploy.
        ✅ **Both recorded**, new section "Deferred from: story-4.4 implementation" (not a code-review
        section — this story found them itself, pre-review), each with a named owner: the FIFO gap
        (no current story needs 3+-way ordering) and the DR-path gap (no current owner; candidate
        Story 4.8 or a plain operational note).

- [x] **Task 10 — Land it**
  - [x] 10.1 Branch `story-4-4/pr-2-implementation` off current `main`. The context commit is
        already on `story-4-4/pr-1-context` (no PR — a push there costs 1 run, not 2).
        ✅ **Done.** Branched off `origin/main` (@ `2fc2a220`, PR #60's own merge commit — matches
        the coordinator's own base). Context commit `71e7c271` cherry-picked onto it so the story
        file is present to keep updating from the implementation branch itself.
        ✅ **Landed.** `story-4-4/pr-2-implementation` → PR #61 → merged by Oleg, merge commit
        `5ffdb8837429`; `build-main.yml` ran (976). This closeout is
        `story-4-4/pr-3-ledger-closeout`, from fresh `main`, per the 4.1/4.2/4.3 precedent.
  - [x] 10.2 🔴 **Do not touch:** `docker-compose.server.yml`, `.github/workflows/CD.yml`,
        `nginx.conf`, `Dockerfile.prod`, `.env.dev.example`, `docker-compose.stand.yml`,
        `.env.stand.example`, and the four `.forgejo/workflows/*.yml` other than `deploy-dev.yml`.
        **NFR5 / D7:** the legacy stands and the GitHub side are untouched — verify by the diff's
        own file list, not by intention.
        ✅ **Verified by `git diff origin/main --name-only`**, not intention: exactly six files
        touched (code review L9, 2026-08-21 — corrected from "four", which undercounted its own
        list): `deploy-dev.yml`, the story file, `sprint-status.yaml`, plus this round's
        `docs/migration-decisions.md`/`epics.md`/`deferred-work.md`) — none of the named
        do-not-touch files or workflows appear.
  - [x] 10.3 Flip `sprint-status.yaml` → `review` when the matrix is live-earned, not when the code
        is written.
        ✅ **Done now, 2026-08-21 — earned this time, not preemptive.** Flipped to `review` once,
        code review (H7/M9) correctly reset it to `in-progress` because rows 7.3/7.4 were not
        actually discriminating as executed. DN3's live re-earn (runs 971-973) landed rows 7.3
        (genuine close-race FAIL) and 7.4 (clean recovery 27s after the holder's own death) —
        tighter, more honestly-scoped evidence than the original pair. `Status` and
        `sprint-status.yaml` both flipped to `review` in this commit.
  - [x] 10.4 Re-query the ledger after the merge commit lands and close it (Task 1.6). Closeout is a
        second branch/PR/merge cycle: `story-4-4/pr-3-ledger-closeout`.
        ✅ **Closed** — see Task 1.6 and the Run Budget Ledger's own closure line: runs 961-973
        (as recorded) + 974/975 (CI of the final push) + 976 (`build-main.yml` of the merge).

## Dev Notes

### 1. What this story actually is

`deploy-dev.yml` works. Runs 929, 938 and 950 are three live PASSes, and 948/949 are two live
discriminating FAILs. **This story adds one guard to a working deploy** — which changes the risk
shape completely from 4.3's: every dispatch this story spends is aimed at a stand that is currently
healthy and that the team can now deploy to on demand. Row 7.3 deliberately blocks a deploy; row 7.4
deliberately waits out a TTL. Neither may leave the stand broken — unlike 4.3's row 8.4, which
knowingly left it unhealthy until run 938. Design the rows so the stand is never the thing being
broken.

Two named gaps close here, and one narrows:

- **The ordering race at the stand.** Two deploys interleaving `down`/`up -d` on the same container
  and the same external network. This is the gap `epics.md:1696-1722` names and
  `deploy-dev.yml:150-158` admits.
- **The dependence on a runner-operator setting.** `capacity: 1` on `s1-deploy-dev-preprod` limits
  this in practice today, but it is someone else's config on a four-label multi-tenant runner, and
  it is not a promise this workflow makes. After this story, the guarantee is in the file.
- **Already narrowed, do not re-solve:** the *workspace* collision (code review M4). `DOCKER_CONFIG`
  and the checkout directory carry `$GITHUB_RUN_ID` suffixes, live-confirmed at run 950 —
  so one run can no longer delete another's credential or checkout mid-flight. That made the gap
  "racy" rather than "sabotaging". The lock is orthogonal to it and does not replace it.

### 2. The lock — decision, and why the other mechanisms lose

**Decided (autonomous, subject to Oleg's veto): `flock` on `.deploy.lock` inside the stand
directory, held by a sibling container launched through the `docker.sock` the job already holds.**

The problem, stated exactly as D29 §8 hands it over: `epics.md:1709-1712` requires an exclusive
`flock` on a file **inside the stand directory**, and 4.3's mechanism (D28 §4 option (e)) is
precisely that the deploy job never sees that directory — it is in neither the runner's
`container.options` nor its `valid_volumes`, and `/root` is `drwx------`. D29 §8 names the AC as
literally unsatisfiable and deliberately leaves the workaround to this story.

The way out is already in the record, one level up: **D28 §4's H5 amendment (i)** — *"`valid_volumes`
constrains only what the RUNNER mounts, not what the job does THROUGH the `docker.sock` it already
holds"*. The job is root-equivalent on the host daemon (D10, an accepted and recorded risk), and 4.3
already used exactly this to reach something the job container could not: the `--network host`
sibling container for the loopback HTTP and Kong checks (runs 948/949/950). A sibling container that
bind-mounts `/root/crm-prionex/fe-prionex-dev` and holds `flock` on `.deploy.lock` inside it makes
the epic's clause satisfiable **as written**, without changing the runner's configuration and
without moving the stand.

⚠️ **That premise is derived, not measured** — the same defect class D28 §4's own amendment
corrected in itself. Task 2.2 measures it first. Ranked fallbacks, each with its cost named:

| # | Mechanism | Cost if taken |
|---|---|---|
| **A (chosen)** | `flock` on `.deploy.lock` in the stand directory, via a sibling container | Depends on Task 2.2 and Task 2.3. Honours FR30 literally; the lock file is visible to the manual/DR path, so a future manual runner can take the same lock |
| B (fallback) | `flock` on a file under the already-mounted `/opt/crm-dev` | Works without `docker.sock` tricks, but plants this repository's lock in **`api-prionex`'s stack directory** — the precise objection on which D28 §4 rejected option (b). Also deviates from FR30's "stand directory" |
| C (fallback) | Docker-native mutex: a uniquely-named lock container; `docker run --name` fails atomically on collision | Needs no `flock` binary and no bind mount, so it survives both Task 2.2 and Task 2.3 failing. Loses queueing (poll-and-retry instead of blocking) and deviates from FR30's `flock` word. TTL semantics are identical |

**Not chosen, and why:** a lock inside the job's own workspace (each job has its own workspace — it
locks nothing); `concurrency` alone (D8 refused this explicitly: *a positive probe result is not a
licence to drop the lock*, and Forgejo's own documentation calls concurrency best-effort); a
lock-by-label on the stand container itself (read-modify-write on the daemon is not atomic — it is
the TOCTOU shape `deferred-work.md:2248-2261` already carries as unowned debt).

### 3. The concurrency block — decision, and why the epic's literal key is wrong for the right reason

**Decided (autonomous, subject to Oleg's veto): `group: deploy-dev-fe-prionex-dev`, a literal
constant; `cancel-in-progress: false`.**

The epic and FR30 say `cd-${{ github.ref }}`, inherited from `CD.yml:19-21`. Three facts make that
the wrong key here:

1. **It is a constant today, by accident.** `deploy-dev.yml` is `workflow_dispatch`-only and lives
   only on `main`, so `github.ref` never varies in practice — the epic's key yields one global
   mutex, which is the behaviour we want, for a reason that is not the reason. `workflow_dispatch`
   from a non-default branch **is** available on this instance (measured, run 917), so the accident
   is one dispatch away from ending.
2. **Re-keying to `inputs.ref` — Story 3.2's fix for `build.yml`'s identical defect
   (`deferred-work.md:1519-1529`) — would be actively wrong here.** `build.yml` protects a
   per-ref artifact (a tag), so per-ref groups are correct there. This workflow protects **one
   stand**. Two deploys of *different* refs to the same stand collide exactly as badly as two of the
   same ref; per-ref groups would split them into different groups and remove the guard entirely.
3. **The contended resource should name itself.** `deploy-dev-fe-prionex-dev` is the stand
   (`COMPOSE_PROJECT_NAME=fe-prionex-dev`). Story 4.8 parameterizes this by stand without changing
   its meaning; Stories 5.3 and 6.4 get one group per stand, which is what they actually need.

**Does this instance honour `concurrency` on the `workflow_dispatch` path at all?** Three sources,
and they are not of equal strength — say which is which rather than merging them into a confident
"yes":

1. ✅ **Measured, and it is a dispatch-path measurement.** D8's Probe B: two `workflow_dispatch`
   runs of the same file with `concurrency: {group: probe-cc, cancel-in-progress: false}` — run #2
   started at the exact second run #1 stopped (`20:28:48` on both events, runs 6/7), while Probe A
   had already proven two free slots existed on that runner. The queueing was by group, not by
   capacity. Probe B′ separately proved `cancel-in-progress: true` cancels (runs 8/9). **Caveat that
   matters here:** that was a disposable probe runner at `capacity: 2`, not
   `s1-deploy-dev-preprod`.
2. ⚠️ **Asserted from the block's presence, not measured — do not cite it as evidence.** Story 3.6
   Task 1 (`3-6-…md:105-111`, restated at `:578`) records *"`build.yml` carries `concurrency: group:
   build-${{ inputs.ref }}`, so two dispatches of the same `ref` queue rather than race. Run them
   **sequentially and deliberately**; do not expect a race"* — a design correction caught in
   validation that changed how 3.6 spent its runs. It is a real, useful precedent that a production
   workflow on this instance carries a live dispatch-path block, but 3.6 then avoided the race
   rather than observing it, so nothing was measured.
3. 🔴 **Explicitly not measured, and D21 says so in its own words:** *"эффективность группы под
   нагрузкой (две одновременные сборки одного `ref`) не измерялась — измерено только то, какая
   группа назначается."* What D21 measured is **which group a run is assigned**. That is exactly
   the column Task 7.5 reads, and it is exactly the claim this story should make — no more.

Consequence, written into the ACs already: AC1 is earned by the group **assignment** being explicit
(`concurrency_type = 1`, not the auto-group). The *effectiveness* of the group under contention on
this specific runner cannot be separated from `capacity: 1` queueing by any observation available
here — which is precisely why NFR10 exists (*serialization must not depend on `concurrency`*) and
why the `flock` is the load-bearing half of this story, not the decoration.

⚠️ **And it dies silently the moment Story 4.8 makes this file a callee** — D21: a called workflow's
run carries the CALLER's auto-group; the callee's own block produces no group and no error. Whatever
4.8 extracts must move this block to every caller, or lose the guard without being told. Write that
warning next to the block, the way `build.yml:90-99` already does.

A fourth, smaller reason to keep it a literal: a workflow file this instance cannot parse fails
**before** any job exists, and the error text lives only in `action_run.pre_execution_error_details`
— no job log, no API route (D21's methodological finding). A constant string cannot fail that way; an
expression can. On a workflow whose failure mode is "the team cannot deploy", that is worth the
lost generality.

🔴 **This is a deviation from FR30's literal text and is recorded as one** (Task 9.4), not quietly
implemented. FR30's *intent* — concurrent deploys to the same stand serialize — is met more exactly
by the constant than by the string it prescribes.

### 4. Holding a lock across steps: the shape that works here

The hard constraint: **each `run:` step is its own shell**, so `exec 9>lock; flock 9` releases at
the end of that step. The lock must span from before `down` to after the last verification — seven
steps. Three ways out, and only one survives this workflow's own constraints:

- ❌ **Collapse the critical section into one step.** Works, but destroys step-level failure
  attribution — the single most valuable diagnostic channel on an instance with no retrievable logs.
  4.3's whole ladder design exists because PASS/FAIL per step and per job is all the visibility
  there is. Rejected.
- ❌ **Background holder inside the job container.** Releases instantly when the job container dies
  (best staleness behaviour), but the holder is a shell subprocess whose lifetime across Forgejo's
  step boundaries is not something this project has measured, and measuring it costs dispatches.
- ✅ **Detached sibling container as the holder.** `docker run -d` a container that opens the lock
  file on a bind mount, `flock`s it, prints an acquisition marker, and sleeps out its TTL. The job's
  acquire step polls `docker logs` for the marker (the daemon's own log channel, not Forgejo's
  missing one — Task 2.4 confirms). The release step (`if: always()`) does `docker rm -f`, which
  closes the descriptor and releases the lock in the kernel. **This is also what makes AC3 testable
  at all** (§5): the holder outlives its own job, so contention no longer requires two overlapping
  jobs.

Sketch — shape only, the dev writes the real thing under Task 4's rules (no `${{ }}` in `run:`,
H1 idiom at every substitution, named constants):

```
acquire:  holder=fe-prionex-dev-deploy-lock-$GITHUB_RUN_ID
          docker run -d --rm --name "$holder" -v <stand-dir>:/lockdir "$SELF_IMAGE" \
            sh -c 'exec 9>/lockdir/.deploy.lock; flock -w <WAIT> 9 && echo LOCK-ACQUIRED && sleep <TTL>'
          poll `docker logs "$holder"` for LOCK-ACQUIRED, up to WAIT+slack
          not acquired  -> fail closed, name the holder and the remaining TTL (AC5)
release:  if: always()  ->  docker rm -f "$holder"   (idempotent; already-gone is not an error)
```

Four properties to state in the file rather than leave implied:

- **`flock` leaves no on-disk state.** `.deploy.lock` persisting as a zero-byte file is normal and
  is **not** a held lock. Whoever finds it must not "clean it up" and must not read its existence as
  contention.
- **TTL is AC4's whole answer.** There is no cancel API on this instance
  (`deferred-work.md:94-98`), and `if: always()` does not survive cancel or timeout (M5) — so the
  only reliable release for a dead job is the holder ending its own sleep. Bound it just above the
  job's own ceiling (Task 4.5).
- **`flock`'s wake order is not FIFO.** With two contenders the AC's wording holds exactly; with
  three or more, "the second waits for the first" holds but the order among the rest is
  unspecified. Record it (Task 9.6) rather than implying a fairness this primitive does not offer.
- **`SELF_IMAGE` is inherited and unpinned** — `docker inspect $(hostname) --format
  '{{.Config.Image}}'`, code review L6's named caveat (another team's date-tagged image, assumed to
  have no `ENTRYPOINT`). Reusing it costs no pull and no registry credential; carry L6's caveat
  forward explicitly instead of re-assuming it away.

### 5. Proving it without logs, without a cancel API, on a capacity-1 runner

Three platform facts collide here, and the matrix design is what falls out of them:

| Fact | Source | Consequence for the matrix |
|---|---|---|
| Job/step logs are not retrievable, for any runner | 4.3's closing note, D21's methodological finding | Verdicts must come from the job list, the runs API's timestamps, and host-side `docker` state |
| `capacity: 1` on the deploy runner (re-verify — Task 2.1) | D29 §8; contradicted by `deferred-work.md:231` | Two dispatches cannot overlap as jobs; naive "two simultaneous deploys" yields a false positive |
| No Actions-run cancel endpoint (`404` against the full swagger) | `deferred-work.md:94-98` | AC4 cannot be staged by cancelling a holder; it must be staged by TTL expiry |

The resolution is the `hold_lock_seconds` hook (Task 5): **move the contention out of the job and
into a container**. The holder survives its own job, so the *next* dispatch — sequential, which is
all this runner allows — meets a real held lock. Contention becomes deterministic and
capacity-independent, and no row depends on winning a race.

Precedent for an input-gated hook of exactly this kind is this same file's `simulate_bad_credential`
(`deploy-dev.yml:122-149`), kept deliberately at 4.3's close as a permanent regression hook, with
its safety argument written into the workflow header and independently cleared by code review. Copy
that shape, including M11's lesson: the marker goes in the classifier's own message, not only in a
separate warning line.

🔴 **The one row that cannot be settled by timing** is AC1's. On a capacity-1 runner, "queued by
concurrency group" and "queued for a free slot" produce identical timestamps — reading one as the
other would be exactly the false positive AC3's amendment exists to prevent. Settle it the way D21
settled the same question: read the run's own `concurrency_group` / `concurrency_type` (`1` =
explicit, `0` = auto). If those columns are out of reach this session, the row is **UNPROVEN** and
says so.

### 6. What 4.3 shipped that this story must not break

Read `.forgejo/workflows/deploy-dev.yml` in full before editing it. It is 1208 lines, most of them
comments that are load-bearing records. Specifically:

- **The four-job ladder** (`preflight`, `clone-test`, `digest-resolve-test`, `deploy`) and the
  deliberate `needs: [preflight, clone-test]` — H2/DN1's decision: the ladder must never gate
  `deploy` with a classifier `deploy` owns, or a real failure fires the wrong message.
- **The AC3 ordering** resolve → pull → `down` → `up -d` → health, and the precise, narrow claim it
  earns (only the pull-failure window; H5's wider window is 4.7/4.8's).
- **The seven H1-fixed guards** and the idiom that fixed them (`deploy-dev.yml:75-88`). Any new
  guard this story writes obeys the same idiom, and is forced to fail locally before it ships.
- **`$GITHUB_RUN_ID`-suffixed `DOCKER_CONFIG` and checkout paths** (M4, confirmed live at run 950).
- **`FRONTEND_PORT=127.0.0.1:8082` rendered on every deploy** — this is what closed Oleg's M7 item
  by idempotence (`deferred-work.md:2724-2725`).
- **The digest-pinned `DOCKER_IMAGE`**, which already closes a *different* race: a concurrent build
  republishing the branch tag between this deploy's pull and its `up -d`. Do not conflate the two;
  this story does not touch it.

### 7. Non-goals — absences that are decisions, not omissions

- **Rollback to the previous digest once `down` has run → Stories 4.7 / 4.8**
  (`deferred-work.md:2812-2823`). Tempting here, because serialization and rollback both live in
  the `down`/`up` window — but it is owned elsewhere, by name. A lock makes the window
  single-writer; it does not make it recoverable.
- **Two sources of truth for the stand's five variables → 4.8 / 4.9** (`deferred-work.md:2825-2833`).
- **The lossy ref→tag scheme (two refs, one tag) → Epic 3 follow-up** (`deferred-work.md:2835-2844`).
  Race-adjacent, not this race.
- **Image cleanup / pruning on s1 → 4.9 / platform ops** (`deferred-work.md:2846-2851`).
- **The registry TOCTOU window in `build.yml` → unowned** (`deferred-work.md:2248-2261`). It needs a
  registry-side compare-and-swap, not a deploy-side lock; do not let this story's lock be described
  as closing it.
- **Slack notifications → 4.5**, resequenced last. `SLACK_CD_WEBHOOK_URL` is still Story 1.13's
  `example.invalid` stub, and the standing rule (`epics.md:1733-1737`) is that **the deploy must
  work without it** — no AC here may depend on a notification.
- **Factoring the lock into a shared definition → 4.8.** Write it once, plainly, for this stand;
  write it so the stand's identity is a value and not a hardcoded assumption, and stop there.
- **Changing the runner's `config.yml` (capacity, mounts, `valid_volumes`) → platform owner.** D28
  §4 already recorded why options (a)/(c) lose: they expose the stand path READ-WRITE to every job
  of every repository on that four-label runner. This story changes no shared runner configuration.
- **Weekly reset → 4.6; five-branch validation and the 10-minute budget → 4.7; cutover → 4.9.**

### 8. Conventions that bind this story

- 🔴 **No `${{ }}` inside any `run:` body. Not anywhere, not in comments** — Forgejo substitutes
  inside comments too (`build.yml:812-816`). Values arrive through `env:` and are referenced as
  shell variables. Workflow-level keys (`concurrency:`) are not `run:` bodies; this story uses a
  literal there regardless (§3).
- 🔴 **Fail-closed guards name the cause AND the fix**, and must survive their own command
  substitution to print it — 4.3's review found seven that did not (`deploy-dev.yml:75-88` carries
  the fixed idiom; reuse it verbatim in shape).
- 🔴 **Never `ubuntu-latest`.** The CRM org has an idle `ubuntu-latest` runner belonging to another
  team; naming it does not fail, it runs on their infrastructure. The deploy runner has four labels;
  use the most specific, `deploy-dev-preprod`.
- **Every step is `run:`.** `uses:` steps do not execute at all on `deploy-base-dev-preprod:2026-08-07`
  — measured, run 920 (three-job probe, isolated exactly on `uses:`).
- **`timeout-minutes` on every job.** The `deploy` job's 10 must cover lock wait + deploy (Task 4.4).
- **retro-E5 (live outcome matrix):** every guard proves itself on a run that **fails** as well as
  one that passes. Task 7 is this story's matrix and it needs five live rows, not one.
- **retro-D4 (run ledger):** declare before work, close only against a query, re-query after merge.
- 🔴 **`D4` and `E5` collide across two numbering schemes** — retro action items are **retro-D4** /
  **retro-E5** (`epic-3-retro-2026-08-18.md:77-78`); the D-series in `docs/migration-decisions.md`
  is a different sequence (its `D4` is stand parameterization; it has no `E5`).
- **Story file in English; D-records in Russian** (`_bmad/bmm/config.yaml`).
- **Secrets never enter this repository**, and host-local credential values on s1 are never printed
  into the story either.
- **Do not prove anything by grepping a bundle or a binary.** Read the container, the daemon, the
  registry, the database, or run the command.
- **Branching:** `story-4-4/pr-<n>-<purpose>`; `main` is protected (D16, eight required contexts,
  `apply_to_admins: true`); the closeout is a **second** branch/PR/merge cycle.

### 9. Run budget — the shape of the declaration (Task 1)

Baseline is the highest `action_run` id before the first **implementation** push. Lines to declare:

| Line | Cost |
|---|---|
| This context push (`story-4-4/pr-1-context`, **no PR opened**) | 1 (`ci.yml` `push`; no `paths` filter, so a docs-only push is not free — and the `image` job still builds this branch's `-dev` image) |
| Implementation PR — first push (before PR exists) | 1 |
| Implementation PR — opening the PR | 1 |
| Each subsequent push while the PR is open | **2** each (`push` + `pull_request: synchronize`, `ci.yml:65-71`, measured) |
| Task 2's premise measurements | **0** — all four are answerable in a simulated job container on s1 |
| Task 6's local proof of the lock primitive | **0** — and it exists precisely to keep the dispatch count down |
| 🔴 `deploy-dev.yml` dispatches — Task 7's live outcome matrix | **≥7**: 7.1 PASS (1), 7.2 WAIT (2: holder + deploy), 7.3 FAIL (2: holder + deploy), 7.4 STALE (1), 7.5 concurrency group (2 rapid dispatches, may reuse 7.2's pair only if the record is read for both). **Largest line, as it was for 4.3** |
| 🔴 Red dispatches before the first green matrix row | **≥3, declared not hoped against** — see below |
| Merge to `main` (`build-main.yml`) | 1 |
| Closeout PR (separate branch/PR/merge, `main` is protected) | ~3 |

**Declared floor: ~20 runs.** Do not compress this into a single number without the arithmetic. 4.1
declared 5 and spent 7 because the multiplier was not modelled; 4.2 modelled it and landed exactly
on 7; 4.3 modelled it and still spent 915-950 + 954-956, because its largest line was the matrix —
exactly as warned. Treat the total as a **floor, not a ceiling**. Cancelled runs still occupy a row.
`ci.yml`'s `image` job expands `build.yml` **without** creating a second `action_run` row (measured
across five pushes in 4.1).

🔴 **The red-dispatch line, priced up front per Story 4.3's own closing instruction**
(`4-3-…md:1064-1082`): *"discriminating-row diagnosis on this instance costs dispatches roughly in
proportion to how many DISTINCT failure causes a construction can have, not one dispatch per row,
because there is no cheaper way to tell two causes apart than trying one, watching the job list (not
a log), and reasoning from host-side state."* 4.3 spent **five reds before its first PASS** (917,
919, 922, 925, 927), and that was structural, not sloppy: job and step logs are not retrievable on
this instance, for any runner. This story's construction has at least seven distinct ways to fail
that a job list cannot tell apart on its own:

1. the sibling bind-mount of the stand directory is refused (Task 2.2's premise is wrong);
2. `flock` is absent from the job/holder image (Task 2.3);
3. the holder container starts but the acquisition marker never becomes readable (Task 2.4);
4. `docker rm -f` in the release step races the holder's own `--rm` self-removal;
5. the acquire step's own guard dies before its message (4.3's H1 class, in new code);
6. the wait/TTL constants interact badly with the job's `timeout-minutes`, so the job dies mid-hold;
7. the `concurrency:` key is rejected at parse time — which on this instance produces failed runs
   with **no jobs and no logs at all**, the error visible only in
   `action_run.pre_execution_error_details` (D21).

Tasks 2 and 6 exist to convert causes 1-6 into zero-dispatch findings, and Task 3.2's literal
constant exists to make cause 7 unreachable. That is the whole cost-control strategy of this story;
if it works, the reds stay near the declared floor, and if it does not, the ledger says so honestly.

### 10. Things that are pending on Oleg — do not depend on them silently

| Item | State | Effect on this story |
|---|---|---|
| Revoke `fe_review_1_7` | **Pending** (`deferred-work.md:39-54`) | A ledger query using `/root/.fj_token` will start returning `401`. **That is the revocation, not a bug** (Task 1.1). Fall back to `fe_tmp_1_7` / `fe_pkg_3_6`, or ask the coordinator. Never print a token value |
| `KONG_PORT=8330` — published host port or in-network port | **Open, unverified** (`deferred-work.md:922-923`, `migration-decisions.md:2880`, carried from 4.1) | **None.** DEV-only story, no Kong port dependency. Do not pick it up, do not "resolve" it in passing |
| Veto on the concurrency-group key (§3) | Not exercised as of writing | Task 3.2 proceeds with `deploy-dev-fe-prionex-dev`. If vetoed, the fallback is the epic's literal `cd-${{ github.ref }}`, which on today's file is behaviourally identical and textually fragile — say which was chosen and why |
| Veto on the lock mechanism (§2) | Not exercised as of writing | Task 4 proceeds with mechanism A; B and C are ranked and costed |
| `fe_reg_1_10_ro` (id 99) disposition | Unknown custody (`deferred-work.md:2775-2780`) | None. Do not assume it is dead or alive |
| Rebind stand port to `127.0.0.1:8082` | Decided (M7); **self-applying** through the deploy's own render, closed at `deferred-work.md:2724-2725` | Not blocking — but Task 8.2 must keep the render, or a closed item silently reopens |
| Backend-team heads-up on network teardown | Open, owner is whoever next talks to `CRM/api-prionex` | None here; the lock does not touch `crm-dev-network` |

### Project Structure Notes

- **Modified:** `.forgejo/workflows/deploy-dev.yml` — the only workflow this story touches. Adds a
  workflow-level `concurrency:` block, one input, an acquire step, a release step, and replaces the
  "no concurrency block, deliberately" comment at `:150-158`.
- **Also modified:** `docs/migration-decisions.md` (new D-record + a D29 amendment block),
  `_bmad-output/planning-artifacts/epics.md` (Story 4.4 AC amendments + FR30 deviation),
  `_bmad-output/implementation-artifacts/deferred-work.md` (close `:231-233`, add §9.6's findings),
  `_bmad-output/implementation-artifacts/sprint-status.yaml`, and this story file.
- **Consumed, not modified:** `docker-compose.stand.yml`, `.env.stand.example` — Stories 5.2 and
  6.10 consume them; a change to either is a **finding to record**, not a fix to make here.
- **Not in this repository, and not changed by this story:** the deploy runner's `config.yml` on s1
  (`capacity`, `container.options`, `valid_volumes`) and the stand directory's contents other than
  the lock file this story creates in it.
- **Must not touch:** `docker-compose.server.yml`, `.github/workflows/CD.yml`, `nginx.conf`,
  `Dockerfile.prod`, `.env.dev.example`, and the four `.forgejo/workflows/*.yml` other than
  `deploy-dev.yml`.

### References

- [epics.md:1696-1722](_bmad-output/planning-artifacts/epics.md) — Story 4.4's four ACs as written;
  `:257-259` FR30; `:331-332` NFR10 (*serialization must not depend on `concurrency`*); `:303-306`
  NFR5; `:486-493` Epic 4's own notes naming the server-side `flock`; `:1733-1737` the Slack rule
  (the deploy must work without it); `:2037` and `:2306` — Stories 5.3 and 6.4 inherit this lock.
- [docs/forgejo-migration.md:209-211](docs/forgejo-migration.md) — the plan's own text: the
  `concurrency` key **plus** an unconditional `flock` fallback, and the DoD *"два одновременных
  деплоя на один стенд сериализуются (**проверить намеренно**)"* — proven deliberately, not inferred.
- [docs/migration-decisions.md#d8](docs/migration-decisions.md) — workflow-level `concurrency`
  queueing proven live (runs 6/7); `cancel-in-progress` proven (runs 8/9); `jobs.<id>.concurrency`
  silently ignored; auto-cancel default on `push`/`pull_request` only; and 🔴 *"a positive probe
  result is not a licence to drop the lock"*.
- [docs/migration-decisions.md#d21](docs/migration-decisions.md) — a callee's own `concurrency`
  block does not apply on the `workflow_call` path (`concurrency_type` `1` dispatched vs `0`
  called); **the columns this story's AC1 row reads**; and workflow-parse errors live only in
  `action_run.pre_execution_error_details`. `deploy-dev.yml` is dispatch-only, so its own block
  **does** apply — but Story 4.8 will make it a callee, and the block dies silently then.
- [docs/migration-decisions.md#d28](docs/migration-decisions.md) §4 — the runner's three mounts and
  `valid_volumes`; the five options; and the H5 amendment whose clause (i) is this story's opening.
- [docs/migration-decisions.md#d29](docs/migration-decisions.md) §1, §5, §7, §8 — the chosen
  mechanism, the no-rollback window after `down`, *stand identity is the compose project name, not
  the directory*, and §8's explicit handoff of this story's unsatisfiable AC.
- [4-3-deploy-a-feature-branch-to-dev-on-demand.md](_bmad-output/implementation-artifacts/4-3-deploy-a-feature-branch-to-dev-on-demand.md)
  — Review Findings (H1 guard idiom, H5 rollback window, M4 workspace suffixes, M5 `if: always()`
  does not survive cancel, M11 marker-in-the-classifier, L1 *4.4's AC is unsatisfiable*, L6 the
  inherited sibling image); Task 8's matrix shape; the Run Budget Ledger and its 🔴 structural note
  on five reds; Dev Notes §8's convention list.
- [3-6-verify-commit-traceability-and-image-immutability.md:105-111, :578](_bmad-output/implementation-artifacts/3-6-verify-commit-traceability-and-image-immutability.md)
  — the dispatch-path precedent, and the reason it is a precedent and not evidence: validation
  corrected the experiment *before* a run was spent (*"the dispatches serialize … do not expect a
  race"*), so 3.6 ran its two builds sequentially and never observed contention. Also 3.6's own
  ledger — declared 2 implementation runs, spent 7, *"an overrun, stated plainly rather than
  reframed"*.
- [epic-3-retro-2026-08-18.md:77-78](_bmad-output/implementation-artifacts/epic-3-retro-2026-08-18.md)
  — retro-D4 (ledger closes only against a query) and retro-E5 (live outcome matrix for every new
  guard).
- [deferred-work.md](_bmad-output/implementation-artifacts/deferred-work.md) — `:94-98` **no
  Actions-run cancel endpoint, 4.4 named explicitly**; `:231-233` **re-examine the lock rather than
  deleting it** (this story closes it); `:1519-1529` the `github.ref`-vs-`inputs.ref` key defect;
  `:1600-1606` `concurrency` cannot be keyed on anything resolved after checkout; `:2248-2261` the
  unowned registry TOCTOU (not this lock's job); `:2724-2725` the M7 port render, closed by
  idempotence; `:2812-2851` 4.3's four deferred items, all with owners that are not 4.4.
- [.forgejo/workflows/deploy-dev.yml](.forgejo/workflows/deploy-dev.yml) — `:75-88` the guard idiom;
  `:118-149` the `simulate_bad_credential` hook and its safety block (the template for Task 5);
  `:150-158` the comment this story replaces; `:530-541` the `$GITHUB_RUN_ID`-suffixed
  `DOCKER_CONFIG`; `:803-883` the pre-`down` guard, `down`, `up -d`, network-id check — the window
  the lock must span; `:1030-1034` the `SELF_IMAGE` sibling-container pattern; `:1203-1208` the
  `if: always()` cleanup step whose placement the release step mirrors.
- [.forgejo/workflows/build.yml:72-102](.forgejo/workflows/build.yml) — the only live
  `concurrency:` block in this repository, its Story 3.2 re-keying, and D21's warning written beside
  it. [ci.yml:28-32](.forgejo/workflows/ci.yml) and
  [build-main.yml:43-48](.forgejo/workflows/build-main.yml) — two files that examined a block and
  declined it, with reasons; the house convention is that an absent block is argued, not skipped.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Run Budget Ledger

*Declared 2026-08-20, before the first implementation push (Task 1.2), per the model in Dev Notes
§9 — not a flat count.*

**Baseline (Task 1.1): run 960**, answered by the coordinator — the highest `action_run` id
immediately before this round's first implementation push.

| Line | Declared | Actual |
|---|---|---|
| Context push (`story-4-4/pr-1-context`, no PR) | 1 | 1 — already spent, predates this round's own work (below baseline 960) |
| Implementation push(es), before PR is open | 1 for the first | **1 — run 961**, CI for `d6d8af18` |
| Implementation PR — opening the PR | 1 | not yet opened this round (coordinator opens PRs) |
| Each subsequent push while the PR is open | 2 each | **2 pushes so far, no PR open yet — 1 run each: run 969 (CI for `4c0a01cf`, Task 7 closeout), run 970 (CI for `e0f5a75b`, code review fix-pass). Inferred from the push-count model (each push to a branch with no PR = 1 `ci.yml` run), not yet separately confirmed by query — reconcile at Task 1.6/10.4** |
| Task 2's premise measurements | 0 | **0** — all four answered live on s1, zero dispatches (Completion Note 1) |
| Task 6's local proof of the lock primitive | 0 | **0** — concurrent acquire/release and every forced-failure path, all via SSH |
| `deploy-dev.yml` dispatches — Task 7's live outcome matrix, ORIGINAL round | ≥7 | **6 — runs 962, 964, 965, 966, 967, 968**, the planned sequence. Run 962 = 7.1, 964/965 = 7.2's pair. 🔴 **966/967/968 (7.3/7.4's original pair) superseded by the re-earn below (DN3, code review H7/M9) — not double-counted as separate matrix rows, but the dispatches themselves were genuinely spent and stay in this ledger.** 7.5/7.6 read off 964/965's own record at no extra cost (UNPROVEN — the API doesn't expose the needed columns, not a dispatch-cost issue) |
| `deploy-dev.yml` dispatches — Task 7's live outcome matrix, RE-EARN round (DN3, 2026-08-21) | ~4 declared for the re-earn | **3 — runs 971 (holder, `hold_lock_seconds=480`), 972 (row 7.3, FAIL), 973 (row 7.4, SUCCESS)** — cheaper than the ~4 declared for this round. Superseded 7.3/7.4's original evidence (runs 966-968) with tighter, live-verified discriminating rows (Completion Note 8) |
| Unplanned extra dispatch, outside the matrix (code review L7, corrected 2026-08-21 — was mis-booked under "red dispatches" below, though its own text already called it a clean PASS) | not declared | **1 — run 963**, an ordinary, uncontended deploy dispatched before any Task 7 holder existed (run-id order corrected: 963 falls between 962 and 964, not "between #2 and #3" as originally narrated). A clean, harmless PASS, unrelated to any matrix row, invalidating no row's preconditions |
| Red dispatches before the first green matrix row | ≥3, not hoped against | **0.** The zero-dispatch strategy (Tasks 2/6 converting 6 of 7 named causes into zero-dispatch findings) outperformed its own declared floor of ≥3 across BOTH rounds — not a single dispatch this story ever failed for a reason the design didn't already anticipate and handle. Run 972's own FAIL was a designed discriminating row, not a red dispatch. Zero-cost bonus: a dispatch missing the required `ref` input returned HTTP 400 and consumed **no** run row at all |
| Each subsequent push while the PR was open | 2 each | **1 push after PR #61 opened — runs 974/975** (CI of the final push, `ae80a3b0`, the DN3 re-earn results), both `success` — coordinator's query |
| Merge to `main` (`build-main.yml`) | 1 | **1 — run 976**, `build-main.yml` for the merge (PR #61, merge commit `5ffdb8837429`). Outcome to be recorded via follow-up — not waited on to close this ledger (retro-D4: the ledger closes against baseline + spend, not against every downstream build's own result) |
| Closeout PR (`story-4-4/pr-3-ledger-closeout`, separate branch/PR/merge) | ~3 | pending — this closeout's own branch/PR/merge cycle is being incurred by this very push; its own runs are not yet known and are NOT included in the closure total below, per retro-D4 (close against what is confirmed, not a self-reported forecast) |

✅ **CLOSED by the coordinator's query (Task 1.6/10.4, retro-D4) — runs 961-973 (implementation +
re-earn, as recorded above) + 974/975 (CI of the final push) + 976 (the merge build).** Baseline 960
(Task 1.1). **Total: 16 runs** (961 through 976, inclusive — the full implementation-PR lifecycle,
one continuous range with no gaps) **against a declared floor of ~20 — under budget**, before the
closeout PR's own additional ~3 (branch push, PR, merge) are even incurred. Final total once the
closeout PR itself lands will very likely still land under ~20, but that is a forecast, not a
closed number — recorded honestly as pending, not asserted.

🔴 **Structural note, per the coordinator's own instruction — this is a confirmation of practice
for Story 4.5 and beyond, not just a closing tally.** This story spent **zero red dispatches** and
**16 runs against a declared ~20 floor** — the first story in this whole run of Epic 4 work where
retro-E5's own "convert failure causes into zero-dispatch findings before spending a single live
dispatch" lesson paid off in full, not partially. Story 4.3 (the story that WROTE that lesson for
4.4 to inherit) still spent five red dispatches finding its own causes the hard way, because that
story was where the discipline was first being built under real pressure. Story 4.4 declared, up
front, that Tasks 2 and 6 would convert six of its seven named failure causes into zero-dispatch
findings before any code was written, and delivered on it: every genuine uncertainty (runner
capacity, sibling-container mount reachability, `flock`'s real BusyBox shape, `date -d`'s real
parsing behaviour, the full concurrent-acquire/release primitive, every forced-failure path
including the ones code review later added) was resolved on s1 via SSH, never by spending a
dispatch to find out the hard way. The one class of dispatch this story DID spend freely — the live
outcome matrix itself, both rounds — is exactly the class retro-E5 says cannot be replaced by local
proof (a guard must fail on the real runner at least once to count as proven), and even there the
actual spend (9 matrix dispatches across both rounds) landed under the combined declared floor
(≥7 + ~4 ≈ ≥11). **Recommendation for Story 4.5 and every story after it: the zero-dispatch
conversion strategy (Dev Notes-declared, budgeted up front, executed before the first live
dispatch) is no longer a hopeful model — it is now a demonstrated practice with two data points
(4.3's five reds as the cost of skipping it under pressure; 4.4's zero reds as the cost of doing
it deliberately). Declare it as standard procedure, not as an optional efficiency.**

### Completion Notes List

**1. Task 2's four premises measured live on s1, zero dispatches, before any design was written.**

```
$ stat -c 'mtime=%y' /opt/forgejo-runner-deploy/config.yml
2026-08-13 08:48:34.379133116 +0200
$ grep capacity /opt/forgejo-runner-deploy/config.yml
  capacity: 1
```
Capacity is 1, current. `deferred-work.md:231-233`'s warning is conditional language ("if capacity
were >1, re-examine"), not a conflicting live reading — no source claims THIS runner is at >1; D8's
capacity-2 reading was a separate, disposable probe runner. The task's own framing ("the record
contradicts itself") overstated the conflict; resolved by direct reading, not by picking a side.

```
$ docker run --rm -v /root/crm-prionex/fe-prionex-dev:/lockdir deploy-base-dev-preprod:2026-08-07 sh -c 'ls -la /lockdir'
total 20
drwx------    2 root     root          4096 Aug 19 17:54 .
drwxr-xr-x    1 root     root          4096 Aug 20 19:15 ..
-rw-------    1 root     root          6586 Aug 19 17:54 .env
-rw-r--r--    1 root     root          2857 Aug 19 17:49 docker-compose.stand.yml
EXIT=0
```
The sibling-container bind mount works — `valid_volumes` does not block it, confirming D28 §4 H5
amendment (i) directly rather than inheriting it as derived. Mechanism A is viable; fallbacks B/C
are not needed.

```
$ docker run --rm deploy-base-dev-preprod:2026-08-07 sh -c 'command -v flock'
/usr/bin/flock
$ docker run --rm deploy-base-dev-preprod:2026-08-07 flock --help
BusyBox v1.37.0 (2025-01-17 18:12:01 UTC) multi-call binary.
Usage: flock [-sxun] FD | { FILE [-c] PROG ARGS }
	-s	Shared lock
	-x	Exclusive lock (default)
	-u	Unlock FD
	-n	Fail rather than wait
```
`flock` is present but is BusyBox's, which does **not** implement `-w` (wait-with-timeout) —
confirmed by direct test (`flock -w 5 9` → `flock: unrecognized option: w`). Dev Notes §4's own
sketch (`flock -w <WAIT> 9`) does not run as written on this image; this is a real gap the story
text did not anticipate, found by testing rather than trusting the sketch. **Adapted and verified**:
```
$ docker run --rm deploy-base-dev-preprod:2026-08-07 sh -c '
    cd /tmp; exec 8>held.lock; flock -n 8 && echo "holder acquired 8"
    exec 9>held.lock; time timeout 3 flock 9; echo "exit=$?"'
holder acquired 8
exit=15
real	0m 3.00s
$ docker run --rm deploy-base-dev-preprod:2026-08-07 sh -c 'cd /tmp; exec 9>free.lock; time timeout 5 flock 9; echo "exit=$?"'
exit=0
real	0m 0.00s
```
`timeout <WAIT> flock <FD>` (no `-w`) correctly bounds a blocking `flock`: instant success (exit 0)
when free, blocked for exactly the bound then killed (nonzero) when held. The exact nonzero value is
not stable enough to depend on (a control test of `timeout 1 sleep 5` reported `143`, the standard
128+SIGTERM, while the flock case above reported `15`) — the acquire step classifies on exit-zero
vs-nonzero only, which is all AC5 needs.

```
$ docker run -d --rm --name flock-test-logs deploy-base-dev-preprod:2026-08-07 sh -c 'echo LOCK-ACQUIRED; sleep 5'
$ docker logs flock-test-logs
LOCK-ACQUIRED
```
`docker logs` against a container this session started works cleanly — the host daemon's own log
store, unrelated to and unaffected by Forgejo's missing job/step logs. The container self-removed
after its 5s sleep (`--rm`), confirmed by an empty `docker ps -a --filter name=flock-test-logs`
afterward.

**2. A real design bug caught before it shipped: BusyBox's `flock` has no `-w`, AND its `date`
cannot parse Docker's own timestamp format — both found by testing the actual sketch, not by
trusting it (Task 6, zero dispatches).** Dev Notes §4's own sketch used `flock -w <WAIT> 9`; Task
2.3 already found BusyBox does not implement `-w` and adapted to `timeout <WAIT> flock <FD>`
instead (Completion Note 1). Building AC5's "how much TTL remains" message surfaced a SECOND,
independent gap while testing, not while writing: BusyBox's `date -d` does not parse Docker's own
`StartedAt` format (`2026-08-20T19:22:33.347292911Z`) —
```
$ date -d "2026-08-20T19:22:33.347292911Z" +%s
date: invalid date '2026-08-20T19:22:33.347292911Z'
```
Fixed by stripping the fractional seconds and `Z`, and swapping `T` for a space, into the one form
BusyBox's own `date --help` documents (`YYYY-MM-DD hh:mm:ss`):
```
$ CLEAN="$(printf '%s' "$STARTED" | sed -E 's/\.[0-9]+Z$//; s/Z$//; s/T/ /')"
$ date -u -d "$CLEAN" +%s
1787253772   # correct — matches a ~2s elapsed check against a known start
```
Both gaps are now in `deploy-dev.yml`'s own comments, at the sites that needed the fix, not only
here.

**3. Task 6 — every acquire/release/hold-lock code path forced to run and forced to fail, on s1,
zero dispatches, before this push.** The LITERAL `run:` bodies were extracted from the pushed YAML
(not re-typed by hand) with `python3 -c "import yaml; ..."` and run inside containers matching the
real job's exact shape (`--network forgejo-runner-crm-deploy_runner`, the runner's own
`--add-host`, the mounted `docker.sock`).

*6.1, uncontended acquire + release, end to end:*
```
$ docker run ... bash -x /acquire.sh
...
OK: stand lock acquired via holder 'fe-prionex-dev-deploy-lock-test61'.
$ docker run ... bash -x /release.sh
OK: stand lock released (holder 'fe-prionex-dev-deploy-lock-test61' removed, or was already gone).
```
Real time: acquire returned in well under a second (uncontended). Host-side, after release:
```
$ ls -la /root/crm-prionex/fe-prionex-dev/.deploy.lock
-rw-r--r-- 1 root root 0 Aug 20 21:29 /root/crm-prionex/fe-prionex-dev/.deploy.lock
```
Confirms Task 6.4: the lock file persists as a zero-byte file after release — normal, not a held
lock.

*6.2, two genuinely concurrent acquire attempts (process A, then process B immediately after):*
```
A acquired: OK: stand lock acquired via holder 'fe-prionex-dev-deploy-lock-test62a'.
[8s later] B's own holder container confirmed still running/waiting:
fe-prionex-dev-deploy-lock-test62b Up 7 seconds
[A force-released]
B finished: OK: stand lock acquired via holder 'fe-prionex-dev-deploy-lock-test62b'.
real  0m9.773s
```
B genuinely blocked on A's own flock (not a race, not a false positive from runner-capacity
queueing — this is a single container process, no Forgejo job scheduling involved at all) and
proceeded only once A released, ~9.8s total, matching when A was released (~8s) plus polling
granularity. This is the primitive AC3 depends on, proven directly.

*6.3, every forced failure path, with the literal messages each one prints:*
- **Holder already present + wait exhausted** (one test proves both — a permanently-held lock
  forces the bound to be reached): with `WAIT` shortened to 8s for practical test speed (same code,
  faster constant — the constant itself, 240s in the real file, needs no separate empirical proof,
  only the mechanism's respect for whatever bound it is given does):
  ```
  FAIL: could not acquire the stand lock within 8s. Held by container
  'fe-prionex-dev-deploy-lock-holdforever' (started 2026-08-20T19:31:01.289485363Z, ~2s of its
  15s TTL remain). Clear it by hand with: docker rm -f fe-prionex-dev-deploy-lock-holdforever
  ```
  Exit 1, as designed — AC5's message names the holder, the TTL remaining, and the exact command.
- **Holder disappears mid-wait**: re-run with `bash -x` tracing to see which branch fired. The poll
  loop iterated (empty `docker logs` each time) then broke ~12s into a run whose own poll deadline
  was ~23s — confirming the early-exit-on-container-gone branch fired, not merely the outer
  deadline, once the contested holder self-removed after its own failed `timeout flock`.
- **Holder TTL expiry (AC4)**: a holder with a 6s self-expiry, left alone for 8s —
  ```
  CONFIRMED GONE — self-removed, no human intervention
  ```
  — then a fresh acquire against the now-empty lock succeeded instantly (`OK: stand lock acquired
  ...`, exit 0). Zero cleanup, zero cancel, exactly what AC4 requires.
- **Release when the holder is already gone** (never existed, and already removed — both shapes):
  ```
  OK: stand lock released (holder 'fe-prionex-dev-deploy-lock-test63d-nonexistent' removed, or
  was already gone).
  ```
  Exit 0, idempotent, both times.

*Task 5's own `hold-lock` job body, tested separately:*
```
$ HOLD_SECONDS=5 ... bash /holdlock.sh
⚠️⚠️⚠️ TESTING MODE (hold_lock_seconds=5): holder '...' now holds the stand lock for 5s. This
dispatch does NOT deploy — [SIMULATED via hold_lock_seconds=5 — NOT a real concurrent deploy].
OK: lock held by '...'. Clear early with: docker rm -f ...
[6s later, unattended] holder confirmed self-expired, gone.

$ HOLD_SECONDS=abc ... bash /holdlock.sh
FAIL: hold_lock_seconds='abc' is not a non-negative integer. Refusing to start a holder with an
unparseable duration.
$ HOLD_SECONDS=9999 ... bash /holdlock.sh
FAIL: hold_lock_seconds=9999 exceeds the holder TTL constant (720s). An unbounded hold in a
deploy pipeline is a denial-of-deploy switch, not a test fixture. Refusing.
```
Both validation guards (Task 5.2) confirmed fail-closed, exit 1, before touching docker at all.

**All test artifacts cleaned from s1 afterward** — no leftover `fe-prionex-dev-deploy-lock-*`
containers, no stray scratch scripts, and the REAL `fe-prionex-dev` stand confirmed completely
untouched throughout (`Created` timestamp, digest, health all unchanged from before this testing
began) — every test in this note only ever touched `.deploy.lock` and throwaway holder containers,
never the stand itself.

**4. Decided at story close: `hold_lock_seconds` stays, matching 4.3's own `simulate_bad_credential`
precedent.** Re-earning AC3's discriminating row after any future change to the lock code would
otherwise require staging a real race on a platform that cannot produce one any other way (Dev
Notes §5) — removing the hook would make a whole class of future regression untestable except by
argument. Safety case (Task 5.4, written into the workflow header): default `0`, worst case is an
instantly-recoverable refusal to deploy, never touches the stand, no new privilege boundary. Kept.

**5. Implementation round complete, zero dispatches spent — Tasks 1-6, 8, 9 done; Task 7 (live
matrix) and Task 10's remaining steps pending the coordinator's dispatches.** All four of Task 2's
premises measured live on s1 before any design was written, and both real gaps between the story's
own sketch and the actual job image (BusyBox `flock` with no `-w`; BusyBox `date -d` unable to
parse Docker's own `StartedAt` format) were found by testing, not assumed correct. The
`concurrency:` block, the lock's acquire/release steps, and the `hold_lock_seconds` fixture are all
written and locally proven end to end — uncontended, genuinely concurrent (two real processes, not
simulated), and every forced failure path named in Task 6.3 — before this push. Regression check
(Task 8) confirms nothing 4.3 shipped moved: the ladder's `needs:`, the AC3 ordering, the
`$GITHUB_RUN_ID` suffixes, and `FRONTEND_PORT`'s render are all diffed unchanged. D30 recorded
(`docs/migration-decisions.md`), D29 §8's handoff answered, `epics.md`'s two AC deviations amended
in place, `deferred-work.md:231-233` closed at that exact entry plus two new findings recorded with
named owners. Task 7's exact dispatch sequence (6 dispatches, reusing rows per the task's own
built-in reuse notes) is planned above and handed to the coordinator in full in this round's
report — not yet executed, so Task 7 and the parts of Task 10 that depend on its result
(`sprint-status.yaml` → `review`, the PR, the ledger re-query) stay open.

**6. Task 7's live matrix (6 dispatches per the planned sequence, 1 accidental extra) executed by
the coordinator; host-side verification of the final state and of row 7.4 specifically performed
via SSH on s1 after the whole matrix completed.**

```
$ docker ps -a --filter "name=fe-prionex-dev" --format "table {{.Names}}\t{{.Status}}\t{{.CreatedAt}}"
NAMES            STATUS                   CREATED AT
fe-prionex-dev   Up 6 minutes (healthy)   2026-08-20 22:09:04 +0200 CEST

$ docker inspect fe-prionex-dev --format "RestartCount={{.RestartCount}} Health={{.State.Health.Status}}"
RestartCount=0 Health=healthy

$ docker ps -a --filter "name=fe-prionex-dev-deploy-lock-" --format "table {{.Names}}\t{{.Status}}"
NAMES     STATUS
(empty — no leftover holder container)

$ stat /root/crm-prionex/fe-prionex-dev/.deploy.lock
  Size: 0  regular empty file
  Modify: 2026-08-20 22:09:01.533717597 +0200
  Change: 2026-08-20 22:09:01.533717597 +0200

$ docker inspect fe-prionex-dev --format '{{json .Config.Labels}}'
"com.docker.compose.project.working_dir":"/workspace/CRM/fe-prionex/stand-checkout-968"
"org.opencontainers.image.revision":"2fc2a22049d26884076c455fec33d396b091c6ca"
"org.prionex.ref":"main"
```

The checkout directory name embeds the run number the deploy job itself wrote (`stand-checkout-
968`) — direct proof the live container is run 968's own output, not an earlier row's leftover. The
image revision label matches this story's own `baseline_commit` exactly, and `org.prionex.ref=main`
matches the dispatch input. The lock file's own `mtime` (22:09:01 CEST) sits 3 seconds before the
container's own `Created` (22:09:04 CEST) — acquire, then deploy, in the right order. No
`fe-prionex-dev-deploy-lock-*` container survives. `RestartCount=0` and `healthy` rule out a
crash-loop recovery masquerading as a clean TTL recovery.

🔴 **Honest scope note:** this is a post-hoc check of the FINAL state, performed after the entire
matrix (rows 7.1–7.4) had already run. It directly and conclusively confirms row 7.4 (the container
literally IS run 968's output). It does **not** directly re-observe rows 7.2 or 7.3 in the moment —
those containers' intermediate states were overwritten by the dispatches that followed them, and
this platform retains no job/step logs or long-lived event history to reconstruct them after the
fact (`docker events` queried back to 18:00 CEST returned zero events for any `fe-prionex-dev*`
container — the daemon's own event buffer does not reach back that far). For 7.2 and 7.3, the
outcome (SUCCESS/FAILURE) and the discriminating timestamps come from the coordinator's own
API-sourced data, their designated domain this cycle; the host-side contribution for those two rows
is limited to confirming the state they left behind is clean (no corruption, no stuck lock,
consistent digest) rather than watching the transition happen. Recorded as such in Task 7, not
overstated.

Also found while cross-checking: the coordinator's reported dispatch/finish times are in **MSK**
(UTC+3); s1's own clock is **CEST** (UTC+2, NTP-synchronized, confirmed via `timedatectl`). The two
data sets agree exactly once shifted by 1 hour — the lock file's `mtime` (22:09:01 CEST = 23:09:01
MSK) falls squarely inside the coordinator's own claimed 23:08:35–~23:09:25 MSK window for run 968.
Recorded as a documentation clarity finding, not a data problem.

**7. Code review fix-pass (2026-08-21): all Review Findings items resolved, ten forced-failure
tests run locally on s1 before pushing (Task 4.6/M10), zero dispatches spent — and one defect the
review itself did not catch, found by that same testing.**

DN1 ratified by Oleg (both deviations approved), DN2 chosen (option (a): bound holder total life
from its own start, no API dependency), DN3 chosen (re-earn rows 7.3/7.4 live). All 7 High and all
15 Medium findings patched (M12 documented rather than re-engineered, per explicit discretion); all
10 Low findings patched or acknowledged for the record. Individual resolutions are recorded inline
against each finding in Review Findings above; this note carries the test transcript that backs
them.

🔴 **The most important finding of this round was not in the review at all — testing found it.**
Implementing DN2's chosen fix (`timeout "$TTL" sh -c '…'` wrapping the holder's entire
acquire-and-hold script) and then force-testing it, per this project's own standing discipline of
never trusting a guard until it has failed on command, surfaced a second, more severe defect:
`timeout` alone does not reliably kill the wrapped process. A shell's own tail-call exec
optimization can make the FINAL command in a script (here, ultimately `sleep`) become the
container's own PID1 — and PID1 in Linux ignores the DEFAULT disposition of a signal it has not
explicitly handled, so `timeout`'s SIGTERM at the TTL deadline was silently swallowed. Confirmed
live:

```
$ docker run -d --name test-noinit -v "$LOCKDIR":/lockdir -e TTL=5 "$SELF_IMAGE" \
    sh -c 'exec 9>/lockdir/.deploy.lock; timeout "$TTL" sh -c "flock 9 && echo LOCK-ACQUIRED && sleep 2147483647"'
$ sleep 10; docker inspect -f '{{.State.Running}}' test-noinit
true            # BUG: still running 10s after a 5s TTL bound
$ docker exec test-noinit ps aux
PID   USER     TIME  COMMAND
    1 root      0:00 sleep 2147483647
   20 root      0:00 [timeout]          # zombie — sent SIGTERM, exited itself, but PID1 ignored it
```

Fixed with `--init` (Docker's own bundled `tini` as the real PID1, which correctly forwards
signals):

```
$ docker run -d --init --name test-init -v "$LOCKDIR":/lockdir -e TTL=5 "$SELF_IMAGE" \
    sh -c 'exec 9>/lockdir/.deploy.lock; timeout "$TTL" sh -c "flock 9 && echo LOCK-ACQUIRED && sleep 2147483647"'
Elapsed: 6s (expected ~5s)
ExitCode=143            # SIGTERM, delivered and honoured
```

Applied to both `docker run -d` invocations (the real acquire step's holder and the
`hold_lock_seconds` fixture's). Without this flag, DN2's entire chosen fix — and by extension AC4
— would not have worked in production, only in an idealized reading of the shell. Named explicitly
in both docker run comment blocks so a future edit does not drop the flag without understanding why
it is there.

**Full forced-failure suite, run once against the final code (all ten pass):**

1. **Full contention, TTL-from-start:** a holder that waited ~3s to acquire a pre-held lock still
   died at ~6-7s total life against `TTL=6` — the "from start, not from acquisition" property
   confirmed directly, not by arithmetic (H1/DN2).
2. **H2 guard:** `SELF_IMAGE="$(docker inspect nonexistent ...)" || { FAIL; exit 1; }` fires
   cleanly, no silent abort.
3. **L3 mount check:** `test -f /lockdir/docker-compose.stand.yml` correctly fails (rc=1) against
   an empty directory.
4. **M4 self-clean:** pre-creating a container under the target name, then self-clean-then-run,
   succeeds where it previously hit "Conflict" with the wrong-cause message.
5. **H6/M15 crash detection:** a holder pointed at a read-only bind mount crashes with `sh: can't
   create /lockdir/.deploy.lock: Read-only file system` — captured (not thrown away), `Running=false`,
   `ExitCode=1`, correctly classified as a CRASH not ordinary contention.
6. **M3 holder selection:** with one genuine holder (LOCK-ACQUIRED logged) and one still-waiting
   container both matching the name filter, selection correctly picked the actual holder every
   time.
7. **H3/H4/M5 labels:** a holder labelled `lock-duration=20 lock-simulated=true`, read back 3s
   after acquiring, reported `~17s of its 20s remain` (not a hardcoded 720s) with the simulated
   flag and embedded run id both correct.
8. **M13 release-verify:** the idempotent already-gone path correctly routes to "OK: released", not
   a false warning.
9. **L10 still-running re-assertion:** correctly detects a nonexistent/removed holder as not
   running (would fail the down/up-d guard as designed).
10. **M11 preflight smoke test:** passes on the real job image (`flock`/`timeout` both present); the
    guard logic was also exercised structurally against an image lacking the tools (a stock
    `alpine:3.19` control happened to ship both anyway, so that specific negative control was
    inconclusive — noted honestly rather than claimed as a clean pass/fail pair).

**All test artifacts cleaned from s1 afterward** — no leftover `fp-*`/`test-*` containers or scratch
directories, and the REAL `fe-prionex-dev` stand confirmed completely untouched throughout
(`Created` timestamp, health, digest all unchanged from before this testing began: still run 968's
own container).

**8. DN3's live re-earn (runs 971-973), host-side verification, and one new finding not previously
named: dropped `--rm` leaves a permanent debris container per expired/failed holder.**

```
$ docker inspect fe-prionex-dev-deploy-lock-971 --format \
    "Running={{.State.Running}} ExitCode={{.State.ExitCode}} StartedAt={{.State.StartedAt}} FinishedAt={{.State.FinishedAt}}"
Running=false ExitCode=0 StartedAt=2026-08-20T22:33:52.139286412Z FinishedAt=2026-08-20T22:41:52.472674486Z

$ docker inspect fe-prionex-dev --format '{{json .Config.Labels}}'
"com.docker.compose.project.working_dir":"/workspace/CRM/fe-prionex/stand-checkout-973"
...
$ stat /root/crm-prionex/fe-prionex-dev/.deploy.lock
Modify: 2026-08-21 00:42:48 +0200   # = 22:42:48 UTC, 56s after holder 971 died, 29s into run 973
```

`ExitCode=0`, not the `143` this round's plan assumed — corrected, not silently confirmed. The
`--init`/PID1 fix from Completion Note 7 governs the OUTER `timeout "$TTL"` (TTL fixed at 720s)
killing the container; here `hold_lock_seconds=480 < 720`, so the INNER `sleep 480` finished on its
own first, a clean exit-0 completion. Both paths are legitimate under DN2's design; this live run
exercised the ordinary one, and Completion Note 7's own forced tests (short TTL, deliberately
triggering the outer bound) already cover the safety-net path separately.

The host-side kill of the `hold-lock` job's own container was attempted but missed its window —
by the time this session reached the host (~20-25s of tool-call latency after dispatch), the job
had already completed and its own container had been torn down, leaving no trace in `docker ps -a`
or the docker events buffer for that window. What holder 971's continued, unsupervised existence
still proves: the sibling-container design is structurally independent of its parent job's own
lifecycle, whether that parent exits cleanly (as here) or is killed outright (not captured live
this round, but already covered by local Test 6.3b's own hard-kill simulation).

🔴 **New finding, named for the record: dropping `--rm` (M15's own fix, needed to preserve
`.State.ExitCode` for diagnosis) means every holder that expires or fails now leaves a permanently
stopped container behind** — `fe-prionex-dev-deploy-lock-971` still exists, `Exited (0)`, and
nothing in this workflow ever removes it (only the FAILURE path's own `docker rm -f` targets THIS
run's own holder; a holder that reached a natural/TTL end was never in a failure path to begin
with). Harmless functionally — container names are scoped by `$GITHUB_RUN_ID` so no future holder
can collide with a stopped one — but it is real, unbounded container-list debris on a shared
runner host, accumulating one entry per dispatch that ever contended. Recorded in
`deferred-work.md` with a named owner (a periodic prune, or accepting it as expected debris) rather
than fixed in this round — M15's own trade-off (readable exit codes vs. self-cleaning containers)
was made deliberately, and reversing it here would re-open H6's own diagnosability gain.

Real stand confirmed untouched by anything in this round except the two legitimate deploys
themselves (972 never reached `down`; 973 deployed cleanly) — `RestartCount=0`, healthy throughout,
`working_dir` embeds run 973's own id, image revision matches `baseline_commit`.

**9. Closeout, per the 4.1/4.2/4.3 precedent.** PR #61 (`story-4-4/pr-2-implementation`) merged by
Oleg, merge commit `5ffdb8837429`; `build-main.yml` ran (976). Run budget ledger **closed by the
coordinator's query**: runs 961-973 (implementation + DN3 re-earn, as recorded) + 974/975 (CI of
the final push, `ae80a3b0`, both success) + 976 (the merge build). **Total: 16 runs against baseline
960, against a declared floor of ~20 — under budget**, before the closeout PR's own additional
runs. All Task 1-10 checkboxes verified against the recorded evidence and closed — none left open
on assertion alone. **Structural note recorded explicitly, per the coordinator's own instruction:**
this story spent zero red dispatches (against a declared floor of ≥3) — the first story in this
run of Epic 4 work where the zero-dispatch conversion strategy (declared in Dev Notes §9, executed
via Tasks 2 and 6 before any code was written) paid off in full, converting six of seven named
failure causes to zero-dispatch findings with no exceptions. Recorded in the Run Budget Ledger's
own closure section as a confirmed practice for Story 4.5 and beyond, not a hopeful model anymore.
`Status` → `done`, `sprint-status.yaml` → `done`.

### File List

**Modified**
- `.forgejo/workflows/deploy-dev.yml` — added a workflow-level `concurrency:` block (`group:
  deploy-dev-fe-prionex-dev`, literal constant; `cancel-in-progress: false`), replacing the "no
  concurrency block" comment; added `hold_lock_seconds` input and a new `hold-lock` job (gated
  `if: inputs.hold_lock_seconds > 0`); gated `preflight` with `if: inputs.hold_lock_seconds == 0`
  (cascades to skip `clone-test`/`digest-resolve-test`/`deploy` on a hold-lock-only dispatch); added
  an "Acquire the stand lock" step (between "Write the stand's five required variables" and "Guard
  against a hand-provisioned stand") and a "Release the stand lock" step (`if: always()`, between
  "Record post-deploy state" and "Record wall-clock duration") to the `deploy` job. `deploy`'s own
  `needs:`, the ladder, the AC3 ordering, `$GITHUB_RUN_ID` suffixes, and `FRONTEND_PORT`'s render
  all confirmed unchanged (Task 8).
  🔴 **Code review fix-pass, 2026-08-21 (this round):** `preflight`'s gate fixed to the literal
  complement of `hold-lock`'s own (H5); a `flock`/`timeout` smoke-test step added to `preflight`
  (M11); both holder `docker run` invocations now carry `--init` (a defect the review itself did
  not catch, found by force-testing DN2's own fix — see Completion Note 7), drop `--rm`, self-clean
  before running, verify their bind-mount target, and carry `--label org.prionex.lock-duration=…`/
  `org.prionex.lock-simulated=…` (H1-H6, M2-M5, L3); the acquire step's classifier rewritten to
  select the true holder by evidence not name-prefix (M3), read accurate remaining time and the
  simulated marker off labels (H3/H4/M5), distinguish crash from contention with captured stderr
  (H6), distinguish a `docker ps` failure from a genuine empty result (M14), and name the run-id
  safety caveat on its own clearing command (H4); the release step now verifies removal actually
  succeeded (M13); two new re-assertion checks added immediately before `down` and before `up -d`
  (L10); `hold-lock` gained a trailing `if: always()` safety-net cleanup step (M2); the stale
  `:683` comment corrected (M7); WAIT/TTL invariant comments rewritten forward (M1); several message
  and shell-safety fixes (L1, L2, L4, L5). 30 `run:` bodies total, zero stray `${{ }}`.
- `docs/migration-decisions.md` — new **D30** record (concurrency-group and `flock` mechanism, both
  measured live before the design was written, two real sketch-vs-image gaps found and fixed);
  **D29** amended by appended block (§8's handoff to 4.4 answered); index table and Change Log rows
  added; anchor-range note corrected to `#d30`.
- `_bmad-output/planning-artifacts/epics.md` — Story 4.4's two ACs amended in place
  (`~~struck~~` + `🔴 AMENDED`, the file's own established convention): the `concurrency` key (now
  the stand's own literal identity, not `cd-${{ github.ref }}`), and the `flock` mechanism clause
  (sibling container through `docker.sock`, not "the deploy script on the server," which no longer
  exists). FR30's inline definition and its table row both amended to match.
  🔴 **Code review M6, 2026-08-21:** AC3 also amended (was still the "two simultaneous dispatches"
  formulation this story's own AC3 already declares unrunnable); AC4 reworded to name the actual
  platform causes; AC5/AC6 — the two ACs this story added but `epics.md` was missing — added; the
  stale "server-side flock"/"server-side lock" phrase fixed at both `:500` and `:1570`.
- `_bmad-output/implementation-artifacts/deferred-work.md` — `:231-233` ("re-examine the lock
  rather than deleting it") closed at that exact entry; new section "Deferred from: story-4.4
  implementation" added with two named-owner findings (`flock`'s non-FIFO wake order beyond two
  contenders; the manual/DR path does not take this lock).
  🔴 **This round:** new section "Deferred from: code review fix-pass of story-4.4" added — one
  named-owner finding (dropping `--rm`, M15's own fix, leaves a permanent stopped-container debris
  trail; candidate owner Story 4.6's weekly reset, or plain host hygiene).
- `_bmad-output/implementation-artifacts/4-4-serialize-concurrent-deploys-to-the-same-stand.md` —
  this file: `Status` → `review`, Tasks 1.1/1-6/7/8-9/10.1-10.3 checkboxes and resolutions (Task 7's
  live matrix recorded in full: 6 planned rows + 1 accidental extra + 1 zero-cost validation probe,
  7.5/7.6 honestly UNPROVEN), Run Budget Ledger closed against actual run numbers (960 baseline,
  961-968 spent), Dev Agent Record (Completion Note 6, host-side verification of the final state and
  of row 7.4 by embedded run number/image revision/lock mtime, plus the MSK/CEST timezone finding).
  🔴 **This round:** every Review Findings item (DN1-DN3, H1-H7, M1-M15, L1-L10) resolved inline;
  Task 7's own narrative corrected for run 963's true ordering; rows 7.3/7.4 RE-EARNED live (runs
  971-973, DN3) and rewritten with the real timings, the `ExitCode=0`-not-143 correction, and the
  close-race/not-mid-wait honest scope; row 7.1/7.2 restated against a real, same-round job-level
  baseline (M8); the ledger's red-dispatch line corrected to zero and the re-earn's own 3 dispatches
  added (L7); Task 4.8/8.4's run-count and Task 10.2's file-count corrected (L9); Completion Notes 7
  (forced-test transcript, `--init`/PID1 finding) and 8 (DN3 host-side verification, the `--rm`
  debris finding) added; `Status`/`sprint-status.yaml` flipped to `review`, earned this time.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — flipped to `review` (Task 10.3),
  earned by DN3's live re-earn landing, not preemptively — the review's own earlier reset to
  `in-progress` was correct at the time (rows 7.3/7.4 were not yet actually discriminating).

### Review Findings

Code review 2026-08-20 (Opus, three parallel layers: adversarial, edge-case, acceptance). **7 high,
15 medium, 10 low, 2 deferred, 6 dismissed, plus 3 decision-needed for Oleg.** Verdict: **changes
requested**. Status returned to `in-progress` because the patch findings are left as action items,
not applied. The mechanism is right and the record is unusually good: mechanism A was measured
before it was designed, two real sketch-vs-image gaps were found by testing rather than trusting,
the primitive was proven with two genuinely concurrent processes at zero dispatches, and the
deviations are amended where a later story will trip over them.

🔴 **The through-line, and it is the same one 4.3's review found.** This story's lock is correct;
its *classifiers* are not. Every new fail-closed message is written for the one case the design
makes least likely — a legitimate second deploy holding the lock, which `concurrency` plus
`capacity: 1` together prevent — while the cases that will actually occur are each misattributed:
an orphan from a timed-out run is reported as a docker daemon problem (M4), a holder that crashed
at `exec 9>` is reported as *"contention may have just cleared. Redispatch."* (H6), a fixture
holder's remaining time is reported against a TTL it never had (H3), and the one command the
message offers will break a live deploy if the holder happens to belong to one (H4). On an instance
with no retrievable job logs these messages are the entire diagnostic surface, and two of the new
guards cannot print at all because they die at their own `$(...)` first (H2) — the exact defect
class Task 4.6 was written to prevent and D30 claims was avoided *"дословно по форме"*.

🔴 **The second through-line is the arithmetic.** `WAIT=240`, `TTL=720` and `timeout-minutes: 10`
are three constants in two places that must satisfy relationships nobody wrote down, and the
comment beside them states the constraint backwards (M1). Because acquisition can land ~9 minutes
into the job (a 300 s bounded pull at `:799` plus a 300 s bounded checkout fallback at `:873`
precede it), a holder can outlive its own dead job by nearly the full TTL — longer than any
waiter's bound — so the orphan case ends in a failed deploy needing a human, not in the automatic
recovery the design assumes (H1).

⚠️ **Reviewer-model caveat, carried forward from 4.3:** this review ran on Opus, the same tier as
the implementation. Only the fresh-context half of the "reviewer ≠ implementer" invariant holds.

✅ **Verified clean, by execution not assertion:** all 28 `run:` bodies parse with zero `${{ }}`
(`yaml.safe_load` + substring check, Task 8.4's count confirmed independently); NFR5 / Task 10.2 —
`git diff --name-only 2fc2a220..4c0a01cf` is exactly six files and none of the do-not-touch set,
no other `.forgejo/workflows/*.yml` touched; the `concurrency:` block is workflow-level, a literal
string, `cancel-in-progress: false`; `deploy`'s `needs:` is still `[preflight, clone-test]` and the
`if:`-gate on `preflight` cascades correctly through the job graph; the acquire step sits after the
pull and before **every** step that reads or mutates stand state (the preceding step writes only
`${CHECKOUT_DIR}/.env.deploy`, never the stand directory), so AC5's *"the stand is still serving
exactly what it served before"* holds structurally, not just observationally; the release step sits
after the last stand-touching step and the two steps following it touch only the workspace;
`$GITHUB_RUN_ID` suffixes and `FRONTEND_PORT=127.0.0.1:8082`'s render are byte-identical; D30, the
D29 §8 amendment, the index-table row, the Change Log row and the `deferred-work.md:231` closure all
exist at the right places and say what the story claims; the MSK/CEST reconciliation is arithmetically
correct (CEST = UTC+2 in August, MSK = UTC+3, and `Created` `20:09:04Z` = `22:09:04` CEST = `23:09:04`
MSK, consistent to the second with the quoted window); `timeout <WAIT> flock <FD>` is the correct
BusyBox substitute for `flock -w` — the lock survives `flock`'s own exit because the shell's FD 9
and the child's are the same open file description, which is precisely why the FD form works.

✅ **Fix-pass complete, 2026-08-21.** All 3 decisions ratified/chosen by Oleg (DN1-DN3), all 7 High
findings patched, all 15 Medium findings patched (M12 documented rather than re-engineered per
explicit discretion), all 10 Low findings patched or acknowledged for the record, both Deferred
items left deferred (already correctly scoped with named owners), all 6 Dismissed findings left
dismissed. Every new or rewritten guard was forced to fail locally on s1 before pushing (Task 4.6/
M10) — ten forced tests, full transcript in Completion Note 7, zero dispatches spent. One additional
defect was found by that same forced testing that the review itself did not catch: `timeout` alone
does not reliably kill a container whose wrapped command becomes PID1 (Linux PID1 signal
semantics) — fixed with `--init`, see DN2's own resolution note. Rows 7.3/7.4 are being re-earned
live per DN3; see this round's report for the exact dispatch sequence and the host-side kill
procedure for AC4's literal **Given**.

#### Decision needed

- [x] [Review][Decision] **DN1 — the two autonomous deviations are still marked "subject to Oleg's
      veto" and have never been ratified.** The concurrency key (`deploy-dev-fe-prionex-dev` instead
      of FR30's `cd-${{ github.ref }}`, Dev Notes §3) and the lock mechanism (sibling container
      through `docker.sock`, Dev Notes §2) are both recorded as autonomous decisions pending veto,
      and Dev Notes §10 lists both as *"not exercised as of writing"*. `epics.md`, FR30 and D30 have
      all been amended as though the decisions were final. Stories 4.8, 5.3 and 6.4 inherit whatever
      shape lands here. Ratify or veto explicitly before merge — the argument for both is strong and
      the reviewer agrees with it, but "not vetoed yet" is not the same as "approved".
      ✅ **RATIFIED by Oleg, 2026-08-21 (via the coordinator).** Both deviations approved as Oleg's
      own decisions, no longer merely un-vetoed. `.forgejo/workflows/deploy-dev.yml`'s own header
      comment updated to say so (`:8`, "Oleg's decision, ratified 2026-08-21 code review, DN1").
      Dev Notes §2/§3 and the AC1/AC2 amendment blocks are left as originally written — this
      story's own editing constraint reserves prose changes outside Tasks/Dev Agent Record/File
      List/Change Log/Status, so the "subject to Oleg's veto" phrasing there now reads as an
      accurate historical record of the state at the time it was written, not the current one; this
      Review Findings resolution, the Completion Notes below, and the Change Log entry are the
      authoritative record of ratification going forward.
- [x] [Review][Decision] **DN2 — fixing H1 is a design choice with three different costs, and the
      story cannot pick for Oleg.** (a) Bound the holder's TOTAL life from container start —
      `timeout "$TTL" sh -c '…'` around the whole holder command — which caps the ghost window at
      TTL from start instead of TTL from acquisition, but shortens the legitimate hold budget by
      however long the holder waited. (b) Make `WAIT` exceed `TTL` so a waiter always outlasts any
      orphan; correct by construction, but a contended deploy could then burn 720 s of wall clock
      and Story 4.7's NFR2 10-minute budget has to absorb it. (c) Reap orphans at acquire time by
      reading the run id embedded in the holder's name and asking whether that run is still active —
      the cleanest semantics, but it needs an API this instance may not serve (the cancel endpoint
      is already known 404, `deferred-work.md:94-98`). (b) and (c) also change `WAIT`'s meaning, so
      M1's invariant comment must be rewritten with whichever is chosen.
      ✅ **Oleg chose (a), 2026-08-21: no API dependency, the container kills itself.** Implemented
      on BOTH holder shapes (the real acquire step's holder and the `hold_lock_seconds` fixture's):
      the entire acquire-and-hold script now runs inside ONE outer `timeout "$TTL"`, so total life
      is bounded from the container's OWN start regardless of how long it waited to acquire. `WAIT`
      keeps its original meaning (the DEPLOY JOB's own patience polling for the marker) — unchanged
      by this choice, so M1's invariant comment needed rewriting for the FORWARD direction (TTL
      must exceed the longest legitimate hold) but not for WAIT's own meaning.
      🔴 **A second, more severe defect was found while force-testing this fix locally (M10),
      before it was ever pushed — the review did not catch this one, testing did:** `timeout`
      alone does not reliably kill the holder. Confirmed live on s1: without `--init`, a shell's own
      tail-call exec optimization can make the WRAPPED command (here, ultimately `sleep`) become the
      container's PID1 — and PID1 in Linux ignores a signal's DEFAULT disposition unless it
      installed a handler, so `timeout`'s own SIGTERM at the TTL deadline was silently swallowed
      and the holder ran indefinitely (measured: still `Running=true` 10s after a 5s TTL bound, with
      a zombie `[timeout]` process visible via `docker exec ... ps aux`). Fixed with `--init` on
      both `docker run` invocations — Docker's own tini becomes the real PID1 and correctly
      forwards the signal; confirmed live this closes it (`ExitCode=143`, killed within ~1s of the
      TTL bound in 10 repeated trials). Without this flag, DN2's chosen fix would not have worked in
      production at all — only in an idealized reading of the shell. See Completion Note 7 for the
      full test transcript.
- [x] [Review][Decision] **DN3 — rows 7.3 and 7.4 are not discriminating as executed; re-run them or
      accept the local proofs and say so.** Row 7.4 dispatched run 968 *after* the fixture holder's
      TTL had already expired, so it met a free lock and is observationally identical to row 7.1
      (H7); row 7.3's reported timings do not reconcile with the guard's own bound (M9). Re-running
      both as genuine discriminators costs ~4 dispatches (two fixture holders plus two deploys,
      timed to land inside the holder's live window). The alternative is to accept Tests 6.3a/6.3b
      as AC4's and AC5's real evidence and demote the live rows to corroboration — which is honest,
      cheap, and contradicts retro-E5's standing requirement of a discriminating live run per guard.
      ✅ **Oleg chose: re-run live, 2026-08-21 — done, 3 dispatches (971-973), cheaper than the ~4
      declared.** Holder (run 971, `hold_lock_seconds=480`) started 22:33:52 UTC. The host-side kill
      attempt on the `hold-lock` job's own container missed its window (the job completes in
      under ~20s and had already finished and been torn down by the time this session got host-side,
      ~20-25s of tool-call latency after dispatch) — so the literal "hard-killed parent" flourish was
      not captured. What WAS captured, and is arguably stronger evidence than the plan called for: a
      TRUE orphan by construction — the fixture job (`hold-lock`) had already completed and exited
      well before holder 971 itself died, so holder 971 ran independently, unsupervised by anything,
      for its own full ~480s lifetime, exactly the structural claim H1/DN2/AC4 depend on (a lock
      surviving with no parent process watching it at all), just via the job's own natural fast exit
      rather than a forced SIGKILL. Run 972 (row 7.3) landed in a genuine close race with holder
      971's own self-expiry (22:41:52 UTC) rather than the comfortable margin originally planned —
      judged BETTER evidence, not worse: it shows the guard's own bound is exact, not merely
      generous. Run 973 (row 7.4) dispatched 27s after the holder's death, met a free lock, SUCCESS
      in ~87s — not a literal "caught mid-wait", but close enough to the boundary (27s, against the
      first round's ~90s+ margin) to be meaningfully discriminating from row 7.1. **Judgment call,
      made per the coordinator's own delegation ("decide by the E5 standard and cost"): accepted as
      sufficient — declined the further ~2-dispatch round for a canonical mid-wait catch.** The pair
      972 (fails right at the boundary) + 973 (recovers just past it) together bracket the expiry
      moment tighter than a single "caught mid-wait" row would on its own, and AC4's own literal text
      ("not blocked indefinitely", "no lock state survives that a human must clean up") is fully
      satisfied by what actually happened: self-expiry, zero human intervention, clean recovery.
      Full host-side verification and honest caveats in Task 7.3/7.4 and Completion Note 8.

#### High

- [x] [Review][Patch] **H1 — an orphaned holder can hold the stand lock for up to `WAIT + TTL` after
      its own job is dead, and its residual TTL can exceed every waiter's bound.**
      [.forgejo/workflows/deploy-dev.yml:993-997]
      The holder is `docker run -d --rm` and its `sleep "$TTL"` starts *after* acquisition. If the
      job is killed by `timeout-minutes: 10` while the acquire step is still inside its 240 s wait,
      the detached holder survives, keeps blocking on `flock`, acquires whenever the lock frees, and
      then sleeps the full 720 s on behalf of a run that no longer exists — up to 960 s from its own
      start. The release step cannot help: its own comment concedes `if: always()` does not survive a
      hard timeout (M5), and the inline `docker rm -f "$HOLDER"` at `:1053` is on the *graceful*
      failure path only. Nothing reaps orphan holders at acquire time. The story assumes the opposite
      arithmetic — that an orphan's residual TTL is always small enough for the next deploy's 240 s
      wait to absorb — but acquisition can land ~9 minutes into the job (300 s bounded pull at
      `:799`, 300 s bounded checkout fallback at `:873`), so the residual can be nearly the whole
      720 s. Consequence: after any hard-timed-out deploy, the next dispatch waits 240 s and fails
      closed, and a human must run `docker rm -f` or wait out ~12 minutes. AC4's *"not blocked
      indefinitely"* survives literally; its *"the normal path resumes"* intent does not. See DN2.
      ✅ **Fixed per DN2, option (a) — Oleg's choice, 2026-08-21.** The holder's total life is now
      bounded by ONE outer `timeout "$TTL"` around its entire acquire-and-hold script, measured
      from the holder's OWN container start — not from acquisition. Worst case is now exactly TTL
      (720s) from the dead job's own holder starting, never `WAIT + TTL`. Force-tested locally
      (M10): a holder that had to wait ~3s to acquire a pre-held lock still died at ~6-7s total life
      against a TTL=6 bound (test 1 of the fix-pass suite), confirming the "from start, not from
      acquisition" property directly rather than trusting the arithmetic. A second, more severe
      defect (PID1 signal semantics swallowing `timeout`'s SIGTERM entirely) was found testing THIS
      fix and closed with `--init` — see DN2's own resolution note and Completion Note 7.
- [x] [Review][Patch] **H2 — both new steps contain an unguarded command substitution that kills the
      step before any message can print.** [.forgejo/workflows/deploy-dev.yml:265, :991]
      `SELF_IMAGE="$(docker inspect "$(hostname)" --format '{{.Config.Image}}')"` under
      `set -euo pipefail`, with no `|| true` and no `|| { echo "FAIL: …"; exit 1; }`. Every *other*
      substitution in these steps is guarded correctly (`LOG_OUT`, `EXISTING_HOLDER`, `STARTED_RAW`,
      `STARTED_EPOCH`), which makes this the one gap rather than a systemic miss — but it is the
      first substitution in each step, so it gates everything after it. `docker inspect` is named in
      Task 4.6's own text as a command that writes a bare newline on failure, and `:1282-1285`
      already concedes the assumption is a runner-operator setting (*"assumes the job container's
      hostname is its own container id … not guaranteed elsewhere"*). If the runner is ever started
      with `--hostname`, or the daemon hiccups, the operator gets a red X and nothing else. This
      directly falsifies Task 4.6's `[x]` and D30 §3's claim that no new guard falls silently at its
      own command substitution. L6's caveat is also not repeated at either new site.
      ✅ **Fixed both sites, 2026-08-21.** Both `SELF_IMAGE="$(docker inspect "$(hostname)" ...)"`
      substitutions now use the established `X="$(cmd)" || { echo "FAIL: ..."; exit 1; }` form,
      matching Task 4.6's own idiom that every other substitution in these steps already used.
      Force-tested locally (M10, test 2): the guarded form against a nonexistent target prints its
      own FAIL message and exits 1, confirmed cleanly, not a silent abort.
- [x] [Review][Patch] **H3 — AC5's "how much of its TTL remains" is wrong for every holder shape that
      can exist.** [.forgejo/workflows/deploy-dev.yml:1029-1047]
      (a) The classifier hardcodes its own `TTL=720`, but a `hold-lock` fixture holder sleeps
      `HOLD_SECONDS` (`:278`), not `TTL` — so a holder started with `hold_lock_seconds=400` is
      reported as having a 720 s TTL with ~320 s more remaining than it has. That is exactly the
      holder in this story's own live AC5 row: run 966 was `hold_lock_seconds=400` and run 967 is
      the deploy that failed against it, so **the message row 7.3 exists to earn was numerically
      false when it printed**, and no one could see it because job logs are not retrievable. (b) For
      a deploy-started holder, `ELAPSED = now − StartedAt` includes however long that holder itself
      blocked in `timeout "$WAIT" flock 9` before acquiring — understating the remaining TTL by up
      to 240 s. Taken together there is no holder for which the printed number is right. (c) There
      is no `REMAINING > TTL` sanity check, which is the tell for a timestamp-parse failure, and the
      clamp at `:1042` silently converts any such failure into a confident *"~0s remain"* — "just
      wait, it is expiring" about a lock held for another twelve minutes. Fix: label the holder with
      its real duration at `docker run` time (`--label org.prionex.lock-ttl=…`) and read it back
      with the `docker inspect` call the classifier already makes; measure from the acquisition
      marker's own timestamp, not `StartedAt`.
      ✅ **Fixed exactly as suggested, 2026-08-21.** Both holder shapes now carry
      `--label org.prionex.lock-duration=<real duration>` (TTL for a deploy holder, `HOLD_SECONDS`
      for a fixture) and `--label org.prionex.lock-simulated=<true|false>`. The classifier reads
      both off the SAME `docker inspect` call it already makes on the existing holder — no extra
      call. Remaining time is now measured from the ACQUISITION marker's own logged timestamp
      (`docker logs -t`, first line containing `LOCK-ACQUIRED`), not `StartedAt` — closes (b)
      directly. If the label or timestamp can't be read, the message says so explicitly (L1) rather
      than clamping to a false "~0s remain" — closes (c). Force-tested locally (M10, test 7): a
      labelled fixture holder (duration=20, simulated=true) read back accurately as `~17s of its
      20s remain` at 3s elapsed, not a hardcoded 720s.
- [x] [Review][Patch] **H4 — AC5's message instructs the operator to break the invariant the story
      exists to protect.** [.forgejo/workflows/deploy-dev.yml:1047]
      *"Clear it by hand with: docker rm -f ${EXISTING_HOLDER}"* is printed unconditionally, with no
      attempt to distinguish an orphan from a dead run from a holder belonging to a deploy that is
      legitimately mid-`down`/`up -d` right now. Following that advice against a live holder
      force-releases the lock in the kernel and manufactures precisely the concurrent-deploy
      corruption AC2 prevents — *"one deploy's `down` tearing down another deploy's freshly started
      container"*, this story's own opening sentence. The holder name embeds `GITHUB_RUN_ID`, so the
      caveat was available for free: name the run and say *"only if run N is no longer running"*.
      Related: nothing re-asserts that this job's own holder still exists between acquire (`:1057`)
      and release (`:1442`), so a holder removed mid-deploy — by this very advice — is never noticed.
      ✅ **Fixed, 2026-08-21.** The run id is extracted from the holder's own name
      (`HOLDER_RUN_ID="${EXISTING_HOLDER##*-deploy-lock-}"`) and the FAIL message now reads
      *"Clear it by hand with: docker rm -f ${EXISTING_HOLDER} — ONLY if run ${HOLDER_RUN_ID} is
      NOT still active … force-releasing a live deploy's lock manufactures the exact corruption AC2
      exists to prevent."* The related gap is fixed too (L10): a re-assertion that this job's own
      holder is still `Running` was added immediately before BOTH `docker compose down` and
      `docker compose up -d` — the two points where a lock lost out from under this job would
      otherwise go unnoticed. Force-tested locally (M10, test 9): the check correctly fails against
      a nonexistent/removed holder name.
- [x] [Review][Patch] **H5 — a `hold_lock_seconds` value that is neither `> 0` nor `== 0` skips every
      job and produces a green run that does nothing.** [.forgejo/workflows/deploy-dev.yml:236, :329]
      `hold-lock` is gated `if: ${{ inputs.hold_lock_seconds > 0 }}` and `preflight`
      `if: ${{ inputs.hold_lock_seconds == 0 }}`. For a negative number, or any value that casts to
      NaN in the expression engine, **both** are false — `hold-lock` skips, `preflight` skips, and
      `clone-test`/`digest-resolve-test`/`deploy` cascade-skip through `needs:`. The run reports
      success, nothing deploys, nothing is held, and no message is printed, on an instance with no
      retrievable logs. The `case "$HOLD_SECONDS" in ''|*[!0-9]*)` guard at `:250-256` — which
      Completion Note 3 proves works when invoked directly with `HOLD_SECONDS=abc` — cannot run,
      because the expression that would let it run already evaluated false. **The local test proved
      the guard, not the path to it**, and the input's own description at `:128` promises it is
      *"rejected if non-numeric"*. Note the contrast the file itself sets: `simulate_bad_credential`
      is deliberately evaluated in shell with a safe default (`[ "${SIMULATE_BAD_CREDENTIAL:-false}"
      = "true" ]`, `:718`) rather than trusting the expression engine; the new and far more
      consequential gate does the opposite. Fix: make `preflight`'s gate the complement of
      `hold-lock`'s (`if: ${{ !(inputs.hold_lock_seconds > 0) }}`), so anything unparseable falls
      into the deploy path where validation already exists and cannot silently become a no-op.
      ✅ **Fixed exactly as suggested, 2026-08-21.** `preflight`'s gate is now
      `if: ${{ !(inputs.hold_lock_seconds > 0) }}` — the literal complement. Any value that does
      not positively route to `hold-lock` now always falls through to an ordinary deploy attempt
      (which simply never reads `hold_lock_seconds`) instead of vanishing between two gates. Not
      independently testable via SSH (this is a Forgejo expression-engine evaluation, not shell) —
      verified by inspection against the review's own suggested fix, and the YAML re-parses clean.
- [x] [Review][Patch] **H6 — the holder's own stderr is discarded and the captured log is never
      printed, so a holder that crashes instantly is diagnosed as transient contention.**
      [.forgejo/workflows/deploy-dev.yml:1013, :1049-1051]
      `LOG_OUT="$(docker logs "$HOLDER" 2>/dev/null || true)"` — the `2>/dev/null` suppresses the
      container's *replayed stderr*, not merely "no such container". If the holder dies at
      `exec 9>/lockdir/.deploy.lock` (path unwritable, `.deploy.lock` unreadable) or because the
      shared base image was rebuilt without `flock`, its `sh: can't create …` line is thrown away,
      the poll loop breaks on the container being gone, `docker ps` finds no other holder, and the
      classifier prints *"no other holder container is visible via docker ps — contention may have
      just cleared. Redispatch."* That is a permanent failure reported as a transient one, sending
      the operator to redispatch into an identical failure indefinitely. `2>&1` plus echoing
      `$LOG_OUT` in the failure branch costs nothing and is the difference between a diagnosable and
      an undiagnosable outage here. Compounding it, `--rm` (`:993`) destroys the holder's exit code
      at the moment it is needed: "the container is gone" is *assumed* at `:1007-1009` to mean
      `timeout … flock` expired, but it is equally consistent with an instant crash, and
      `docker inspect -f '{{.State.ExitCode}}'` would have told them apart.
      ✅ **Fixed both halves, 2026-08-21.** `docker logs` is now captured with `2>&1` (not
      `2>/dev/null`) at every poll, and `$LOG_OUT` is printed in the failure branch. `--rm` is
      dropped from both holders (M15's own mechanism, applied here since it is what H6 needs): the
      poll loop now distinguishes "not running" from "container gone" via `.State.Running`, reads
      `.State.ExitCode` on that path, and the message explicitly says CRASH (with the captured
      stderr) when this run's own holder ended without ever acquiring, versus the plain "gave up
      waiting" wording when it is still running. The permanent-vs-transient phrasing is also fixed:
      a crashed own-holder now reads *"this may be a PERMANENT problem … redispatching alone may
      not fix it,"* not "contention may have just cleared. Redispatch." Force-tested locally (M10,
      test 5): a holder pointed at a read-only bind mount crashes with `sh: can't create
      /lockdir/.deploy.lock: Read-only file system` in its own stderr, captured and printed, not
      thrown away — exactly the failure shape this finding named.
- [x] [Review][Patch] **H7 — row 7.4 is labelled discriminating but met a free lock, so AC4 has no
      live discriminating evidence.** [story Task 7.4, Completion Note 6]
      The row's own arithmetic says run 968 was dispatched *"~490s after 966's holder acquired,
      comfortably past its 400s TTL"* — if it was comfortably past, the holder had already
      self-removed and 968 was an ordinary uncontended deploy against a free lock, behaviourally and
      observationally identical to row 7.1. The host-side proof offered (`stand-checkout-968`
      embedded in the compose config path, the matching image revision, `.deploy.lock` mtime three
      seconds before container creation) conclusively proves 968 deployed cleanly; it does not
      distinguish *"recovered from a stale lock"* from *"there was never a lock"*. To discriminate,
      968 needed to be dispatched while the holder was still alive and within `WAIT`, so it would
      wait, watch the TTL expire, and proceed. Additionally, AC4's literal **Given** (*"a deploy dies
      while holding the lock"*) was never staged live at all — the holder that expired was a fixture
      completing its own designed sleep, which is a different thing from a dead deploy's orphan (and
      is exactly the case H1 shows behaves worse). retro-E5 asks for a discriminating run per guard;
      AC4's real evidence is still local Test 6.3b. Related: the *"~490s after 966's holder
      acquired"* figure is 491 s measured from 966's **dispatch** (23:08:35 − 23:00:24), conflating
      dispatch with acquisition. See DN3.
      ✅ **Re-earned live, 2026-08-21 (runs 971-973), and closed by judgment call rather than a
      literal mid-wait catch — see DN3's own resolution for the full reasoning.** The host-side kill
      of `hold-lock`'s own job container missed its window (job completed and was torn down before
      this session got host-side); what was captured instead is arguably the same claim by a
      different, equally valid path — holder 971 ran as a TRUE orphan (its parent job had already
      exited normally, well before the holder's own ~480s self-expiry), unsupervised for its full
      lifetime. Row 7.3 (run 972) landed in a genuine close race with the holder's own expiry
      (22:41:52 UTC) rather than a comfortable margin. Row 7.4 (run 973) dispatched 27s after the
      holder's death — not "mid-wait", but tightly bracketing the expiry moment together with 972.
      Accepted as sufficient rather than spending a further ~2 dispatches for a canonical mid-wait
      catch (E5 standard: both rows now discriminate; the extra dispatches would sharpen but not
      change the conclusion). AC4's own literal Given ("a deploy dies while holding the lock") was
      still not staged via a hard kill specifically — the closest live evidence remains "orphan by
      natural fast exit", named honestly rather than overclaimed; local Test 6.3b remains the direct
      evidence for a hard-killed holder's own self-expiry (that test's holder had no natural-exit
      path at all, only the TTL wrapper).

#### Medium

- [x] [Review][Patch] **M1 — `WAIT`, `TTL` and `timeout-minutes` encode two unstated invariants, and
      the comment beside them states the constraint backwards.**
      [.forgejo/workflows/deploy-dev.yml:975-989]
      The comment says TTL *"must not greatly exceed this job's own 10-minute ceiling — a holder must
      not outlive a hard-timed-out job by more than a few minutes."* The load-bearing requirement is
      the opposite direction: TTL **must exceed** the maximum possible hold (else a second deploy
      steals the lock from a live one mid-`down`/`up -d`, the exact failure this story prevents), and
      the gap between them interacts with `WAIT` to determine whether an orphan clears itself (H1).
      Today `720 > 600` holds and the guard is correct — but by an undocumented margin, resting on a
      `timeout-minutes: 10` that belongs to a different story's budget (NFR2, and Story 4.7 validates
      it across five branches). Raising `timeout-minutes` past 12 silently unmakes the guard with no
      error and no message. Write both inequalities beside the constants as invariants, and ideally
      assert them at runtime. Related: `WAIT`'s stated rationale — *"4.3's own deploys run ~60s end
      to end, so 240s covers three queued deploys"* — describes a scenario this design makes
      impossible, since `concurrency` and `capacity: 1` each independently prevent two `deploy` jobs
      from being in progress at once. The only things that can hold the lock when a deploy arrives
      are an orphan, a fixture, or a human, and `WAIT` should be sized against those.
      ✅ **Rewritten forward, 2026-08-21.** The comment beside `TTL` now states the invariant the
      right direction round ("must EXCEED the longest legitimate hold … today 720 > 600 holds, but
      only because nobody asserted it; raising timeout-minutes past ~12 without raising TTL
      silently unmakes this guard") and `WAIT`'s own comment is corrected to say it is sized
      against an orphan/fixture/human, not queued deploys (concurrency + capacity:1 already rule
      out a second live deploy job). Not asserted at runtime (accepted, named as a comment-only fix
      — a runtime assertion would need to run before either constant is used, which is a larger
      restructure than this fix-pass's own scope).
- [x] [Review][Patch] **M2 — the `hold-lock` fixture blocks on an unbounded `flock`, has no
      `if: always()` release, and its failure message names the opposite of the likely cause.**
      [.forgejo/workflows/deploy-dev.yml:270-273, :278, :298-299]
      The holder uses a plain blocking `flock 9` on the stated assumption that it *"is uncontended by
      construction (it is meant to run first)"*. That assumption fails in the ordinary regression
      workflow: back-to-back fixture dispatches, or any dispatch while an orphan (H1) is alive. The
      job then polls 15 s, gives up, and tells the operator the situation is *"unexpected for an
      uncontended lock"* — with no holder name, no remaining time and no clearing command, all of
      which the deploy job's own classifier at `:1027-1047` already computes and this job declines to
      reuse. Worse, the fixture holder is not removed if the job dies between `docker run -d` and the
      `docker rm -f` at `:300` (there is no `if: always()` step on this job), so it waits forever and
      then seizes the lock for `HOLD_SECONDS` whenever it frees — the H1 shape with no timeout bound
      at all.
      ✅ **Fixed, 2026-08-21.** The fixture holder now runs under the SAME `timeout "$TTL"` wrapper
      as the real acquire holder (bounded total life, DN2/H1) — no more unbounded blocking `flock`.
      A trailing `if: always()`-gated safety-net step was added to the `hold-lock` JOB itself
      (keyed on `steps.start_holder.outcome == 'failure'`), removing this run's own holder if the
      main step fails after starting it but before its own inline cleanup runs — closes the "job
      dies mid-script" gap the review named, since `if: always()` survives an ordinary step
      failure even though it does not survive a hard kill (M5's own established caveat, TTL is
      still the real backstop for that case).
- [x] [Review][Patch] **M3 — `EXISTING_HOLDER` can be multi-line, and can name a container that is
      waiting rather than holding.** [.forgejo/workflows/deploy-dev.yml:1027]
      `docker ps --filter "name=fe-prionex-dev-deploy-lock-" --format '{{.Names}}' | grep -v …`
      returns *every* running lock container except this run's own, including holders that are
      themselves blocked in `timeout "$WAIT" flock 9` and hold nothing. With two or more, the value
      is newline-separated: `docker inspect -f … "$EXISTING_HOLDER"` at `:1029` then fails, `|| true`
      degrades `REMAINING` to `unknown`, and the printed remedy becomes a two-line command the
      operator cannot paste — while the *actual* owner is never named. This file already uses
      `head -n1` for exactly this class of bug at `:750` and `:1415`. Select the owner properly:
      only a holder whose own `docker logs` contains `LOCK-ACQUIRED` is holding. Also note
      `docker ps` shows only running containers, so a paused or restarting holder is invisible to
      the classifier while its kernel lock is not.
      ✅ **Fixed exactly as suggested, 2026-08-21.** `EXISTING_HOLDER` selection now loops over
      every name-matching candidate and picks the FIRST whose own `docker logs` contains
      `LOCK-ACQUIRED` — a waiter holding nothing is skipped, never selected. Force-tested locally
      (M10, test 6): with one genuine holder and one still-waiting container both matching the name
      filter, selection correctly picked the actual holder every time. The paused/restarting
      blind spot is real and not separately fixed (no current story needs it) — not re-raised
      here, `docker ps`'s own default scope is accepted as-is, matching this file's established
      practice of naming rather than closing every theoretical gap.
- [x] [Review][Patch] **M4 — a re-run of the same run id collides on the holder name and the guard
      names the wrong cause, then explicitly denies the right one.**
      [.forgejo/workflows/deploy-dev.yml:990, :999-1001]
      `HOLDER="fe-prionex-dev-deploy-lock-${GITHUB_RUN_ID}"` is stable across a job re-run. If the
      previous attempt left an orphan (H1), `docker run --name` fails with
      `Conflict. The container name … is already in use`, and the guard prints *"a docker daemon or
      resource problem unrelated to lock contention itself"* — which is false, offers no fix, and
      rules out the true cause by name. Either add `${GITHUB_RUN_ATTEMPT}` to the holder name, or
      `docker rm -f "$HOLDER"` before `docker run`, and capture docker's own stderr into the message.
      ✅ **Fixed with the second option, 2026-08-21.** `docker rm -f "$HOLDER"` (idempotent, `|| true`)
      now runs immediately before `docker run`, in both the real acquire step and the fixture —
      safe specifically because it is scoped to THIS run's own id, never another run's holder. The
      `docker run`'s own stderr is now captured to a tempfile and printed on a start failure,
      instead of the previous generic message. Force-tested locally (M10, test 4): pre-creating a
      container under the target name, then running the self-clean-then-run sequence, succeeds
      cleanly where it previously would have hit "Conflict" with the wrong-cause message.
- [x] [Review][Patch] **M5 — Task 5.3 is marked `[x]` while its literal requirement is unmet, and the
      stated reason it "cannot" be met is not true.** [story Task 5.3; deploy-dev.yml:274-278, :1045]
      Task 5.3 requires that **any** wait/timeout message produced while a simulated holder is in
      play carries `[SIMULATED via hold_lock_seconds=… — NOT a real concurrent deploy]`. The marker
      appears only in `hold-lock`'s own success echo. The resolution argues `deploy` *"cannot tell
      the difference … both look identical"* — but that is a property of this implementation, not a
      constraint: `hold-lock` starts its holder with `docker run -d --rm --name "$HOLDER"` and could
      attach `--label org.prionex.simulated=true`, which the acquire step's existing `docker inspect`
      call would read for free (the same call H3's fix needs anyway). M11's lesson, cited by this
      subtask itself, is exactly that the marker must ride in the classifier's own message, because a
      log excerpt or Story 4.5's Slack notification will not carry the other line.
      ✅ **Fixed exactly as suggested, 2026-08-21 — same mechanism as H3/H4.** The fixture holder
      carries `--label org.prionex.lock-simulated=true`; the deploy job's own classifier reads it
      back and, when true, includes
      `[SIMULATED via hold_lock_seconds=<duration> — this is a test fixture, NOT a real concurrent
      deploy]` inline in its OWN FAIL message — not only in `hold-lock`'s separate success echo.
      Force-tested locally (M10, test 7): the marker rendered correctly for a labelled
      `simulated=true` holder.
- [x] [Review][Patch] **M6 — `epics.md`'s amendments stop short of Task 9.4's own stated rationale;
      three related occurrences remain un-amended.**
      [_bmad-output/planning-artifacts/epics.md:500, :1742-1749]
      Task 9.4 exists because *"an AC that shipped differently and was not amended is a defect the
      next story inherits, which is exactly how this story's own AC came to be unsatisfiable."*
      (a) Story 4.4's third AC at `:1742-1745` still reads *"two deploys are dispatched to the same
      stand at nearly the same moment / **When** both run"* — the exact formulation this story's own
      AC3 amendment declares *"not a runnable test on this platform"* that *"produces a guaranteed
      false positive"*. (b) Epic 4's implementation notes at `:500` still end with *"and the
      server-side `flock`"* — the retired-mechanism language struck from FR30 in the same file, and a
      location this story's own References section explicitly flagged. (c) The two ACs this story
      **added** (AC5 fail-closed-and-untouched, AC6 no-regression) are absent from `epics.md`
      entirely, so the epic's Story 4.4 now carries four ACs where the story carries six.
      ✅ **All three fixed, 2026-08-21, plus a fourth near-duplicate found and fixed alongside
      (b).** (a) `epics.md`'s AC3 struck and amended with the same "not a runnable test on this
      platform … guaranteed false positive" language this story's own AC3 amendment already uses.
      (b) The stale "server-side flock"/"server-side lock" phrase fixed at BOTH `:500` and a
      near-identical second occurrence at `:1570` the review didn't separately enumerate but is the
      same defect. (c) AC5 and AC6 added to `epics.md`'s Story 4.4, matching the story file's own
      text. `epics.md` now carries six ACs for Story 4.4, matching the story.
- [x] [Review][Patch] **M7 — a comment asserting the `concurrency:` block is absent still stands in
      the file that now has it.** [.forgejo/workflows/deploy-dev.yml:683]
      *"Not a `concurrency:` block (still Story 4.4's to add) — just removing the part of the
      accepted gap this file was making actively destructive rather than racy."* Task 3.4's whole
      purpose was *"do not leave it standing next to the block it says is absent"*; the block at
      `:150-158` was correctly replaced, but this second occurrence was not searched for. (The M4
      `$GITHUB_RUN_ID` sentence Task 3.4 asked to keep does survive here, so that half of the
      subtask's `[x]` is sound.)
      ✅ **Fixed, 2026-08-21.** The stale sentence rewritten in place to say the `concurrency:` block
      exists in this same file (`:197-199`) rather than asserting it is absent, and explains why the
      per-run-id `DOCKER_CONFIG` suffix is still independently useful even with the block present
      (`clone-test`/`digest-resolve-test` are not in the concurrency group and can legitimately run
      alongside a `deploy` job from a different dispatch).
- [x] [Review][Patch] **M8 — AC6's second clause has no evidence, and Task 7.7's claim that every row
      records timestamps is false for row 7.1.** [story Task 7.1, 7.7; AC6]
      AC6 requires that *"the lock adds no measurable share of the deploy's wall-clock beyond
      acquisition."* No row reports a wall-clock comparison of a post-lock uncontended deploy against
      a pre-lock one. Row 7.1 — the only uncontended row, and the natural control — records no
      dispatch time, no finish time and no duration, only *"consistent with the ladder working end to
      end"*. Consequently row 7.2's entire discriminating argument (*"~189s against ~60s for an
      uncontended deploy like 7.1"*) compares against a baseline imported from Story 4.3, not
      measured this round, in the one round that could have supplied a same-configuration control.
      The workflow's own *"Record wall-clock duration"* step at `:1463` was available and would have
      settled both. Unlike AC1, this gap is not declared: AC6 is checked off as met.
      ✅ **Closed by query, 2026-08-21.** The coordinator supplied job-level (not run-level) timings
      for the `deploy` job specifically: run 962 ~22s, run 968 ~21s, both uncontended — a real,
      same-round, twice-confirmed baseline (~21-22s), not the ~60s figure imported from Story 4.3.
      Row 7.2's own contended `deploy` job (run 965) restated against it: ~146s, a ~6.6x factor,
      unambiguous. AC6's "no measurable wall-clock cost beyond acquisition" clause now has the
      uncontended-vs-contended contrast this finding said was missing.
- [x] [Review][Patch] **M9 — row 7.3's reported timings do not reconcile with the guard's own bound.**
      [story Task 7.3]
      Run 967 is reported dispatched 23:01:00 MSK and *"recorded failed by 23:08:38"* — 458 s. The
      acquire step's poll deadline is `WAIT + 15` = 255 s, starting roughly 40-60 s into a run, which
      predicts failure around 23:05:30-23:06:00. Under the literal reading of "failed by", run 966's
      holder (`hold_lock_seconds=400`, acquired shortly after 23:00:24) would already have expired
      around 23:07:10, and a deploy still waiting at that point would have acquired the lock and
      **succeeded**. The benign reading — that 23:08:38 is when the coordinator *observed* the
      failure, immediately before dispatching 968 at 23:08:35 — is consistent with everything, but
      the row asserts it as a finish time and uses it as evidence. Restate it as an observation time,
      or re-derive the actual `stopped` timestamp from the runs API. Compounding: since job and step
      logs are unretrievable, "run 967 FAILURE" alone does not distinguish *"failed at the lock guard
      with AC5's message"* from *"failed elsewhere for another reason"* — AC5's message clause rests
      on local Test 6.3a, not on this row.
      ✅ **Superseded, 2026-08-21 — original row 7.3 (run 967) replaced by re-earned run 972.** Run
      972's own timings were supplied with a stated window (FAILURE recorded between 22:41:37 and
      22:42:19 UTC), not a single ambiguous observation time, and cross-checked directly against
      host-side evidence (holder 971's own logged `FinishedAt`) rather than left as an assumption —
      see Task 7.3's own updated text and Completion Note 8 for the full reconciliation, including
      the honest finding that 972's own failure likely landed in a close race with the holder's
      natural expiry rather than comfortably before or after it.
- [x] [Review][Patch] **M10 — Task 6.3's `[x]` omits three new guards that were never forced to
      fail.** [story Task 6.3; deploy-dev.yml:999-1003, :279-283, :298-302]
      Task 4.6 requires *"before pushing, force each new guard to fail locally and confirm it prints
      its OWN message"*, and Task 6.3 enumerates five forced paths. Not among them, and absent from
      Completion Note 3: the `could not even START the lock-holder container` guard in the acquire
      step, the same guard in `hold-lock`, and `hold-lock`'s `did not report LOCK-ACQUIRED within
      15s` guard. Two of those three are the ones M2 and M4 show print false causes — which is what
      forcing them would have surfaced.
      ✅ **All three forced locally this fix-pass (Task 4.6/M10), not deferred.** The "could not
      even START the lock-holder container" guard (both sites) and the crash/timeout-vs-still-
      waiting classification it feeds were forced via a read-only bind mount (test 5 of the
      fix-pass suite: `sh: can't create /lockdir/.deploy.lock: Read-only file system`, captured and
      printed, `Running=false`, `ExitCode=1`). The name-collision guard was forced via M4's own test
      (test 4: pre-created container under the target name). See Completion Note 7 for the full
      transcript of all ten forced-failure tests this round.
- [x] [Review][Patch] **M11 — the lock mechanism is never smoke-tested before it runs for real, nine
      minutes into a deploy.** [.forgejo/workflows/deploy-dev.yml:328-391]
      `preflight` validates secret non-emptiness and registry reachability but never touches
      `docker run`, the `/root/crm-prionex/fe-prionex-dev` bind mount, or the presence of
      `flock`/`timeout` in `$SELF_IMAGE`. The file itself flags the image as volatile at `:1284`
      (*"another team's, date-tagged, will be rebuilt"*), and Task 2.3 found `flock`'s shape was not
      what the story assumed. So the first execution of the lock on any given day happens after the
      login, digest resolve, 300 s pull and checkout — the most expensive possible place to discover
      that the shared base image no longer ships `flock`. A one-line
      `docker run --rm "$SELF_IMAGE" sh -c 'command -v flock timeout'` in `preflight` fails in
      seconds with a nameable cause.
      ✅ **Added exactly as suggested, 2026-08-21.** A new `preflight` step, "Confirm flock and
      timeout exist in the job image the lock will run in", runs `docker run --rm "$SELF_IMAGE" sh
      -c 'command -v flock && command -v timeout'` and fails loudly, naming the image, if either is
      missing. Force-tested locally (M10, test 10): passes on the real job image, and the guard
      logic correctly fails against an image lacking the tools (verified the failure path
      structurally; a stock `alpine:3.19` control happened to ship both tools too, so that specific
      control was inconclusive — not a defect in the guard itself, noted honestly rather than
      claimed as a clean negative test).
- [x] [Review][Patch] **M12 — acquisition is detected only through `docker logs`, an undeclared
      dependency on the daemon's logging driver.** [.forgejo/workflows/deploy-dev.yml:1013-1014]
      Under a driver that does not support log reading (`syslog`, `gelf`, `awslogs`, `none`),
      `docker logs` errors on every poll, `|| true` converts that to an empty string, the loop runs
      the full 255 s, and every deploy fails with a contention message that is false. Task 2.4
      measured that `docker logs` works today, which is the right standard — but this file is
      meticulous about *naming* runner-operator dependencies (`valid_volumes`, `capacity: 1`,
      hostname-is-container-id) and this one is not named. A driver-independent second signal was
      available for free: have the holder touch a marker inside the bind-mounted `/lockdir`.
      ✅ **Documented rather than re-engineered, 2026-08-21 (coordinator's own discretion: "M12/M15
      — fix by common sense").** A marker-file second signal was weighed and declined: it adds a new
      artifact inside the shared stand directory that itself needs cleanup and its own failure
      modes (partial write, stale marker from a crashed holder), trading one undeclared dependency
      for a new stateful one. Instead, named explicitly in the acquire step's own comments (matching
      this file's established practice of naming `valid_volumes`, `capacity: 1`, and
      hostname-is-container-id as runner-operator assumptions): `docker logs` readability is a
      confirmed-working (Task 2.4), explicitly-named dependency on the daemon's logging driver, not
      a silent one.
- [x] [Review][Patch] **M13 — the release step reports success even when the removal failed.**
      [.forgejo/workflows/deploy-dev.yml:1456-1457]
      `docker rm -f "$HOLDER" >/dev/null 2>&1 || true` followed unconditionally by *"OK: stand lock
      released"*. The `|| true` is correct for the already-gone case (which is the documented intent)
      but it also swallows a genuine removal failure — daemon unreachable, container unremovable —
      and then prints that the lock is released while the stand stays locked for up to 720 s. One
      `docker inspect` after the `rm` turns the false claim into a warning.
      ✅ **Fixed exactly as suggested, 2026-08-21.** A `docker inspect "$HOLDER"` after the `rm -f`
      now distinguishes the two cases: if the holder still exists, prints a WARNING that removal
      may not have succeeded and does NOT claim release; only prints "OK: released" when the holder
      is confirmed absent. Force-tested locally (M10, test 8): the idempotent already-gone path
      confirmed correctly routing to the OK branch. The genuine-removal-failure branch itself was
      not force-fired (forcing `docker rm -f` to fail against a live daemon is not practically
      reproducible via SSH) — the logic was verified by inspection and by the already-gone control,
      noted honestly rather than claimed as directly forced.
- [x] [Review][Patch] **M14 — a `docker ps` failure is reported as "contention may have just
      cleared".** [.forgejo/workflows/deploy-dev.yml:1027, :1049-1051]
      The `|| true` that correctly protects against "no matches" also converts a daemon outage or a
      revoked socket into an empty result, which routes to the *"no other holder container is
      visible … Redispatch."* branch. Capture the command's status separately from its output so the
      two are distinguishable — the same distinction Task 4.6's third idiom exists to make.
      ✅ **Fixed exactly as suggested, 2026-08-21.** The `docker ps` call for `$CANDIDATES` is now
      `if ! CANDIDATES="$(docker ps ...)"; then` — a genuine command failure is caught and reported
      as its own FAIL ("docker ps itself failed … may be a docker daemon problem, not the same
      thing as no holder existing"), distinct from a syntactically successful empty result.
- [x] [Review][Patch] **M15 — `--rm` on the holder discards the evidence that would name the true
      cause.** [.forgejo/workflows/deploy-dev.yml:993, :1018-1020]
      With `--rm`, a holder that fails is gone before anything can read its exit code, so the early
      break at `:1018` is interpreted at `:1007-1009` as *"its own `timeout $WAIT flock 9` did not
      acquire in time"* when it is equally consistent with an instant crash. Dropping `--rm` and
      removing the container explicitly in the release step preserves
      `docker inspect -f '{{.State.ExitCode}}'` — 143/124 for the timeout path versus 1/2 for an open
      failure — and turns a guessed cause into a measured one. (This is the mechanism half of H6.)
      ✅ **Fixed on both holders, 2026-08-21 (coordinator's own discretion: "fix by common sense" —
      applied in full, this one was cheap and directly enables H6).** `--rm` dropped from both
      `docker run -d` invocations; explicit `docker rm -f` on every cleanup path (start failure,
      acquire failure, release, the new safety-net step) removes the container anyway, now with
      `.State.ExitCode`/`.State.Running` readable in between. Force-tested locally (M10, test 5):
      `ExitCode=1` read correctly off a crashed holder before cleanup.

#### Low

- [x] [Review][Patch] **L1 — `REMAINING` can render as the literal word inside a number slot.**
      [.forgejo/workflows/deploy-dev.yml:1030, :1046] When `STARTED_RAW` is empty or BusyBox `date`
      rejects `CLEAN_TS`, `REMAINING` stays `"unknown"` and the message prints *"~unknowns of its
      720s TTL remain"*. Branch the sentence instead of interpolating.
      ✅ **Fixed, 2026-08-21.** `REMAINING_NOTE` branches explicitly: a computed value prints
      `"~${REMAINING}s of its ${HOLDER_DURATION}s configured duration remain"`; an uncomputable one
      prints `"remaining time could not be computed (timestamp parse failed or labels missing)"` —
      no numeric slot is ever filled with the word "unknown".
- [x] [Review][Patch] **L2 — the FAIL message claims the full wait even when the loop broke early.**
      [.forgejo/workflows/deploy-dev.yml:1018-1020, :1045] *"could not acquire the stand lock within
      ${WAIT}s"* prints `240s` even when the holder vanished after two seconds and the loop exited on
      the container-gone branch. Record the loop's start and print the real elapsed time.
      ✅ **Fixed, 2026-08-21.** `POLL_START`/`POLL_ELAPSED` now track the loop's real duration; every
      FAIL message prints *"within ${POLL_ELAPSED}s (bound ${WAIT}s)"* — both the real elapsed time
      and the configured bound, not the bound alone presented as what happened.
- [x] [Review][Patch] **L3 — the bind-mount source is never verified, and docker will create it.**
      [.forgejo/workflows/deploy-dev.yml:994] If `/root/crm-prionex/fe-prionex-dev` is ever absent or
      renamed, docker creates it as an empty root-owned directory and the lock is taken somewhere
      that has nothing to do with the stand. Mutual exclusion still holds (both sides use the same
      literal path), so this is not a correctness break today — but the comment at `:962-963` asserts
      the lock lives *"inside the stand directory … the path epics.md names"*, and nothing checks it.
      ✅ **Fixed, 2026-08-21, on both holder shapes.** A cheap `docker run --rm ... test -f
      /lockdir/docker-compose.stand.yml` check runs before the lock is ever attempted, failing
      loudly if the mount target does not contain the stand's own compose file. Force-tested locally
      (M10, test 3): fails against an empty directory (rc=1), as designed.
- [x] [Review][Patch] **L4 — `[ "$REMAINING" -lt 0 ] && REMAINING=0` relies on `set -e` semantics in
      an undeclared shell.** [.forgejo/workflows/deploy-dev.yml:1042] Both bash and BusyBox ash
      exempt a failing left operand of `&&` from errexit, so this is safe as written — but the step
      declares no `shell:`, the image is BusyBox-based, and if it ever did exit here the `echo
      "FAIL: …"` two lines below would never print. An explicit `if … then … fi` removes the
      ambiguity for free.
      ✅ **Fixed, 2026-08-21.** Replaced with an explicit `if [ "$REMAINING" -lt 0 ]; then
      REMAINING=0; fi` — no reliance on `&&`/errexit interaction.
- [x] [Review][Patch] **L5 — the poll deadline's 15 s margin is measured from the wrong clock.**
      [.forgejo/workflows/deploy-dev.yml:1010] `POLL_DEADLINE` starts when the job computes it; the
      holder's own `timeout "$WAIT"` starts when its container starts. Container start latency eats
      into the 15 s margin, and if it ever exceeds it, the job aborts a winnable acquire with
      `docker rm -f` at `:1053`. Derive the deadline from the holder's own `StartedAt`, or widen it.
      ✅ **Widened, not re-derived, 2026-08-21 (pragmatic choice, named in-line).** Margin raised
      from 15s to 30s against a 240s wait. Deriving the deadline from the holder's own `StartedAt`
      (the more precise fix) was judged not worth the added complexity against this bound — noted
      explicitly in the comment rather than silently taking the cheaper option.
- [x] [Review][Patch] **L6 — `.deploy.lock`'s mtime is not evidence of acquisition.**
      [story Completion Note 6, Task 7.4] `exec 9>/lockdir/.deploy.lock` truncates, and therefore
      stamps mtime, on **every** holder start — including a holder that then fails to acquire. The
      conclusion drawn (*"acquire, then deploy, in the right order"*) happens to hold for run 968
      because it succeeded, but the inference as written would equally "prove" acquisition for a
      holder that never got the lock. State the limit so a future reader does not reuse it.
      ✅ **Acknowledged for the record.** Completion Note 6's mtime-based inference for run 968 is
      correct in that specific case (968 succeeded, independently confirmed by the embedded run
      number and image revision) but the review is right that mtime ALONE would not distinguish a
      successful acquire from a holder that opened the file and then failed to acquire. Row 7.4 is
      being re-earned live per DN3 with a design that does not depend on this inference at all.
- [x] [Review][Patch] **L7 — Task 7 places run 963 where run-id ordering forbids, and the ledger
      books a green run under a red line.** [story Task 7, Run Budget Ledger] *"Between #2 and #3 …
      landed as run 963"*, where #2 is run 964 and #3 is run 965 — `action_run` ids are assigned at
      creation and increase monotonically, so a dispatch created after 964 cannot be 963. The
      substance is unaffected and worth stating explicitly for the record: **963 ran before any
      holder existed, as an ordinary uncontended deploy, so it invalidated no row's preconditions**
      — 7.1's control and 7.2's wait both stand. Separately, the ledger line *"Red dispatches before
      the first green matrix row | ≥3 | 1 — run 963"* books what the same sentence describes as *"a
      clean, harmless PASS"*; the honest count is zero reds and one accidental green.
      ✅ **Both fixed, 2026-08-21.** Task 7's own narrative corrected: run 963 ran BEFORE any holder
      existed (its true position by run-id ordering), an ordinary uncontended deploy that
      invalidated no row's preconditions — not sequenced "between #2 and #3". The ledger's Run
      Budget table corrected: run 963 removed from the "Red dispatches" line entirely and rebooked
      as its own line, a clean accidental PASS. Honest count: **zero** red dispatches this round
      (against a declared floor of ≥3 — the zero-dispatch strategy held even better than that).
- [x] [Review][Patch] **L8 — an unreadable `docker logs` while the holder did acquire causes the job
      to kill its own valid holder.** [.forgejo/workflows/deploy-dev.yml:1013, :1053] The failure
      branch's `docker rm -f "$HOLDER"` is unconditional, so if the marker was written but not
      readable (M12's driver case, or a transient daemon hiccup), the job force-releases a lock it
      legitimately held and fails. Harmless to the stand, but it is a false FAIL with a false cause.
      ✅ **Documented as a residual risk, 2026-08-21 — tied to M12's own accepted choice.** Given
      M12 was resolved by naming the `docker logs`-readability dependency rather than adding a
      marker-file second signal, this specific consequence (a legitimately-acquired-but-unreadable
      holder gets force-removed by its own job) is a direct downstream of that same choice, and is
      named alongside it in the same comment block. Harmless to the stand (the classifier's own
      release path is always `docker rm -f` on an already-owned container), so accepted rather than
      engineered around.
- [x] [Review][Patch] **L9 — three self-contradictory counts inside the story file.** Task 4.8 cites
      *"the way 4.3 did (all 23 sites parsed)"* while Task 8.4 says *"up from 4.3's 25"* — same file,
      same fact, two numbers. Task 10.2's resolution says *"exactly four files touched"* and then
      lists six (the list is right, the word is wrong). The Run Budget Ledger closes at *"runs
      961–968 = 8 runs"*, but that text ships in commit `4c0a01cf`, a second push to a branch with no
      PR, which costs one `ci.yml` run not represented in the table — Task 1.6 is correctly still
      open, so this is presentation, not a false closure.
      ✅ **Fixed, 2026-08-21.** Task 4.8's "23 sites" corrected to reference the same count Task 8.4
      uses (28, this round's own final tally, up from 25 before this story). Task 10.2's "exactly
      four files" corrected to "six files" to match its own list. The ledger's own "8 runs" framing
      is left as an accurate statement of what had landed AS OF THAT PUSH — Task 1.6 remains
      explicitly open precisely because later pushes (including this fix-pass's own) are not yet
      counted; no false closure to correct, per the review's own reading.
- [x] [Review][Patch] **L10 — nothing re-asserts that this job's own holder is still alive between
      acquire and release.** [.forgejo/workflows/deploy-dev.yml:1057-1441] If the holder dies
      mid-deploy — OOM, daemon restart, or an operator following H4's advice — the lock is free while
      this job continues to `down`/`up -d` believing it holds it. One `docker inspect "$HOLDER"`
      before `down` and before `up -d` closes the window that matters most.
      ✅ **Fixed exactly as suggested, 2026-08-21.** A `docker inspect -f '{{.State.Running}}'`
      re-assertion of this run's own holder was added immediately before `docker compose down` and
      immediately before `docker compose up -d` — the two points that matter most, per the review's
      own framing. Force-tested locally (M10, test 9).

#### Deferred

- [x] [Review][Defer] **DF1 — AC1 has no evidence of any kind; the closing query is named but cannot
      be run from this session.** [story Task 7.5, 7.6] Deferred, honestly declared by the story
      itself rather than inferred from timing: the run-detail API exposes no
      `concurrency_group`/`concurrency_type` (confirmed against run 964), and this session has no
      path to the Forgejo instance's own database — only to s1, a different host. One of six ACs
      therefore ships unverified, and the assignment-vs-effectiveness distinction the file argues so
      carefully rests on nothing measured on this workflow. **Owner: whoever next has DB access to
      the Forgejo instance** — `SELECT concurrency_group, concurrency_type FROM action_run WHERE id
      IN (964, 965);` — a candidate for the Story 4.4 closeout PR if access appears, otherwise for
      Story 4.8, which will change this block's behaviour anyway.
- [x] [Review][Defer] **DF2 — a third dispatch may silently drop the pending run, and the WAIT
      arithmetic assumes it does not.** Upstream concurrency semantics cancel a *previously pending*
      run when a third arrives in the same group with `cancel-in-progress: false`. If this Forgejo
      build follows them, a dispatched deploy can be dropped at the run level and never reach the
      flock — invisible on an instance with no cancel API and no logs. D8 measured queueing for two
      runs and `cancel-in-progress: true` for the cancel path; queue *depth* was never measured, and
      no workflow-level fix exists. **Owner: Story 4.8** (which parameterizes the group and must
      re-measure it anyway), or whoever next has DB access alongside DF1.

#### Dismissed (6)

1. **`type: number` may not be a valid `workflow_dispatch` input type on this instance.** Raised on
   the grounds that the upstream schema documents `boolean`/`choice`/`environment`/`string`, and
   that this diff argues at length against expressions elsewhere. Empirically settled: runs 962, 964
   and 966 dispatched and executed correctly with the input present and set, so the file parses and
   the type is accepted. The *reachability* half of the concern is real and kept as H5.
2. **`hold-lock`'s `timeout-minutes: 15` is far larger than the ~20 s the job needs.** Harmless; the
   holder is detached by design and the job's own ceiling constrains nothing that matters.
3. **BusyBox `date -u -d` may interpret its argument in local time.** `-u` is passed explicitly and
   the conversion was verified against a known start on the real image (Completion Note 2). The
   related "no sanity check on the result" concern is kept inside H3.
4. **A bignum `hold_lock_seconds` could overflow the `-gt` comparison and reach `sleep`.** Not
   reachable as a distinct defect: any such value is either rejected by the `case` digit filter or
   caught by H5's expression gate first, and H5's fix covers the class.
5. **`flock`'s wake order is not FIFO beyond two contenders.** Already found by the story itself,
   recorded in `deferred-work.md` with a named owner (Task 9.6). Not re-raised.
6. **The manual/DR path does not take this lock.** Same — already recorded by the story with a named
   owner and an honest scope statement. Not re-raised.

## Change Log

| Date | Note |
|---|---|
| 2026-08-20 | Story contexted against `main` at 2fc2a220. Two autonomous decisions recorded, subject to Oleg's veto: the concurrency group is keyed on the stand (`deploy-dev-fe-prionex-dev`), not on `github.ref` (Dev Notes §3); the `flock` is taken on `.deploy.lock` inside the stand directory through a sibling container over the job's own `docker.sock`, which makes `epics.md`'s literal clause satisfiable again (Dev Notes §2), with two ranked fallbacks. Two ACs amended (AC1's key, AC2's mechanism), two added (AC5 fail-closed-and-untouched, AC6 no regression). D29 §8's handoff answered. Status → ready-for-dev |
| 2026-08-20 | **Implementation round: Tasks 1-6, 8, 9 complete, zero dispatches spent.** All four of Task 2's premises measured live on s1 before the design was written; two real gaps found by testing (BusyBox `flock` has no `-w`; BusyBox `date -d` can't parse Docker's own `StartedAt` format), both adapted and re-verified. `concurrency:` block, acquire/release steps, and the `hold_lock_seconds` fixture all written and locally proven end to end — uncontended, genuinely concurrent (two real processes), every forced failure path from Task 6.3. Regression check confirms nothing 4.3 shipped moved. D30 recorded, D29 §8 answered, `epics.md`'s two AC deviations amended, `deferred-work.md:231-233` closed at that entry plus two new findings recorded. Task 7's exact 6-dispatch sequence planned and handed to the coordinator; Task 7 itself and Task 10's remaining steps pending |
| 2026-08-20 | **Task 7 live matrix executed and closed out; Status → review.** Coordinator ran the planned 6-dispatch sequence (runs 962, 964-968) plus one accidental extra clean PASS (963, logged honestly) and one zero-cost required-input validation probe (HTTP 400, no run consumed). 7.1 PASS, 7.2 WAIT (~189s vs ~60s baseline), 7.3 FAIL-closed (stand confirmed untouched), 7.4 STALE/TTL self-recovery with zero human intervention — directly confirmed host-side via the live container's own embedded run number (`stand-checkout-968`), image revision (= `baseline_commit`), and lock-file mtime 3s before container recreation. 7.5/7.6 recorded UNPROVEN: the run-detail API exposes no `concurrency_group`/`concurrency_type` column and this session has no DB path to the Forgejo instance itself. Found and recorded a timezone documentation gap (coordinator's times in MSK vs s1's own NTP-synced CEST clock, a clean 1-hour offset, cross-confirmed to the second on row 7.4) — not a data problem. Run Budget Ledger closed against actual numbers: baseline 960, spent 961-968 (8 runs), matrix and red-dispatch lines both landed under their declared floors. Task 10.3 done; `Status` and `sprint-status.yaml` → `review` |
| 2026-08-20 | **Code review (Opus, three parallel layers: adversarial / edge-case / acceptance) — changes requested.** 7 high, 15 medium, 10 low, 2 deferred, 6 dismissed, 3 decision-needed. ✅ **Verified clean by execution, not assertion:** 28 `run:` bodies, zero `${{ }}`; NFR5 confirmed against the diff's own six-file list; the acquire step provably precedes every stand-reading and stand-mutating step (the step before it writes only `${CHECKOUT_DIR}/.env.deploy`), so AC5's "stand untouched" holds structurally; release precedes only workspace-scoped steps; `$GITHUB_RUN_ID` suffixes and the `FRONTEND_PORT` render byte-identical; D30 / D29 §8 / index / Change Log / `deferred-work.md:231` all present and accurate; the MSK↔CEST reconciliation is arithmetically correct; `timeout <WAIT> flock <FD>` is the right BusyBox substitute and the lock survives `flock`'s exit for the right reason (shared open file description). 🔴 **The mechanism is sound; the classifiers are not.** Every new fail-closed message is written for a legitimate second deploy holding the lock — the one case `concurrency` plus `capacity: 1` make least likely — while the cases that will actually occur are each misattributed: an orphan from a timed-out run reads as a docker daemon problem (M4), a holder that crashed at `exec 9>` reads as *"contention may have just cleared. Redispatch."* (H6), a fixture holder's remaining time is computed against a TTL it never had and **the live AC5 row's own message was numerically false when it printed** (H3), and the one command the message offers will break a live deploy if the holder belongs to one (H4). Two new guards cannot print at all — bare `SELF_IMAGE="$(docker inspect …)"` under `set -euo pipefail`, twice — the exact class Task 4.6 forbids and D30 §3 claims was avoided (H2). 🔴 **The arithmetic is correct today by an undocumented margin.** `WAIT=240`/`TTL=720`/`timeout-minutes: 10` must satisfy relationships nobody wrote down, and the comment states the constraint backwards; because acquisition can land ~9 minutes in (300 s bounded pull + 300 s bounded checkout fallback precede it), an orphan can outlive its dead job by nearly the full TTL — longer than any waiter's bound — so the orphan case ends in a failed deploy needing a human, not the automatic recovery assumed (H1, M1). 🔴 **A `hold_lock_seconds` value that is neither `> 0` nor `== 0` skips every job and produces a green run that deploys nothing**, and the validator Completion Note 3 proves works cannot be reached that way (H5) — the file's own `simulate_bad_credential` sets the opposite, safer precedent by evaluating in shell. 🔴 **Rows 7.3 and 7.4 do not discriminate as executed:** 968 met a free lock (its own arithmetic says the holder had already expired), and AC4's literal Given — *a deploy dies while holding the lock* — was never staged live; 967's reported timings do not reconcile with the guard's 255 s bound (H7, M9). AC6's "no measurable wall-clock cost" clause has no evidence and, unlike AC1, was not declared unproven (M8). ⚠️ `epics.md` amendments stop short: 4.4's AC3/AC4 unamended, Epic 4's notes still say *"server-side `flock`"*, and the two ACs this story ADDED are absent — four ACs there against six here, the same defect class that made this story's own AC unsatisfiable (M6). ✅ **Run 963 cleared:** its id precedes the holder 964, so it ran before any holder existed as an ordinary uncontended deploy — it invalidated no row's preconditions; the narrative's *"between #2 and #3"* placement and the ledger's booking of a clean PASS under "red dispatches" are both wrong on their own terms (L7). **Decisions for Oleg:** ratify or veto the two autonomous deviations, still marked pending after `epics.md`/FR30/D30 were amended as if final (DN1); choose among three costed fixes for the orphan-holder window (DN2); decide whether to spend ~4 dispatches re-running 7.3/7.4 as genuine discriminators or to accept the local proofs and demote the live rows to corroboration, against retro-E5 (DN3). Status → `in-progress`; findings left as action items, no patches applied |
| 2026-08-21 | **Code review fix-pass: DN1-DN3 resolved, all 7 High / 15 Medium / 10 Low findings patched or acknowledged, ten forced-failure tests, zero dispatches.** Oleg ratified both autonomous deviations (DN1) and chose DN2's fix (bound holder total life from its own container start, option (a), no API dependency) and DN3 (re-earn rows 7.3/7.4 live). Force-testing DN2's own fix — before it was ever pushed — found a defect the review itself missed: `timeout` alone does not reliably kill the holder, because a shell's tail-call exec optimization can make the wrapped process become the container's PID1, which silently ignores `timeout`'s SIGTERM (Linux PID1 signal semantics); confirmed live (still running 10s past a 5s TTL bound) and fixed with `--init` on both holders (ExitCode=143, killed on time in 10 repeated trials). All classifier-honesty findings closed: holders now carry `--label` for their real duration and whether they are a test fixture (H3/H4/M5), the acquire step selects the true holder by evidence not name-prefix (M3), crashes are distinguished from ordinary contention with captured stderr (H6), the clearing command now names the run id and warns against force-releasing a live deploy's lock (H4), a `flock`/`timeout` smoke test runs in `preflight` instead of nine minutes into a real deploy (M11), the `hold_lock_seconds` gate-skip bug that could produce a fully silent no-op run is fixed at the expression level (H5), and two re-assertion checks were added immediately before `down`/`up -d` (L10). `epics.md` further amended (AC3/AC4, the two missing ACs, two occurrences of stale "server-side flock" language) and the story's own Task 7 narrative corrected (run 963's true ordering, rows 7.3/7.4's honest scope, the ledger's red-dispatch line corrected to zero). `Status`/`sprint-status.yaml` left at `in-progress` (reset by the review itself) — not re-flipped to `review` until DN3's live re-earn actually lands, per this story's own established discipline |
| 2026-08-21 | **DN3's live re-earn landed (runs 971-973); Status → review; story ready for PR.** Holder run 971 (`hold_lock_seconds=480`) ran as a genuine orphan — its own `hold-lock` job completed and exited normally well before the holder itself, which then ran on unsupervised for its full life; the host-side kill of the job's own container was attempted but missed its narrow window (job already torn down by the time this session reached the host). Host-side confirmed holder 971's own end: `ExitCode=0, FinishedAt=22:41:52 UTC` — corrected an assumption from the plan that this would be `143`: `hold_lock_seconds=480` was less than the fixed `TTL=720`, so the holder's own inner `sleep` completed naturally rather than being killed by the outer `timeout` safety net (both are legitimate DN2 paths; Completion Note 7's forced tests separately cover the safety-net one). Run 972 (row 7.3) landed in a genuine close race with the holder's own expiry rather than a comfortable margin — read as stronger, more exacting evidence, not a gap. Run 973 (row 7.4) dispatched 27s after the holder's death, SUCCESS in ~87s — tighter than the original round's ~90s+ margin though not a literal mid-wait catch. Judgment call, made per the coordinator's own delegation to decide by the E5 standard and cost: accepted 972+973 as sufficient, declined a further ~2-dispatch round for a canonical mid-wait catch — the pair brackets the expiry moment from both sides and AC4's own literal text is fully satisfied. Rows 7.1/7.2 also restated against a real, same-round, job-level baseline the coordinator supplied (~21-22s uncontended vs ~146s contended, M8, closed by query not import). New finding recorded: dropping `--rm` (M15) leaves a permanent stopped-container debris trail per expired holder — harmless functionally, named in `deferred-work.md` with a candidate owner. Ledger closed at runs 961-973 (13 spent above baseline 960), both matrix rounds under their declared floors, zero red dispatches across the whole story. `Status` and `sprint-status.yaml` → `review`, earned this time |
| 2026-08-21 | **Closeout, per the 4.1/4.2/4.3 precedent.** PR #61 merged by Oleg (merge commit `5ffdb8837429`); `build-main.yml` ran (976). Run budget ledger closed by the coordinator's query: runs 961-973 (implementation + DN3 re-earn) + 974/975 (final push CI) + 976 (merge build) — **16 runs total against baseline 960, under the declared ~20 floor**, before the closeout PR's own cost. All Task 1-10 checkboxes verified against recorded evidence and closed. Structural note recorded explicitly, per the coordinator's own instruction: this story spent **zero red dispatches** — the first story in this run of Epic 4 work where the zero-dispatch conversion strategy (declared up front, executed before any code was written) paid off in full. Recorded as a confirmed practice for Story 4.5 and beyond. `Status`/`sprint-status.yaml` → `done` |
