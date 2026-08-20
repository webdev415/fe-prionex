---
baseline_commit: 2fc2a22049d26884076c455fec33d396b091c6ca
---

# Story 4.4: Serialize Concurrent Deploys to the Same Stand

Status: ready-for-dev

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

- [ ] **Task 1 — Declare the run budget before the first push (retro-D4, team agreement)**
  - [ ] 1.0 Flip `sprint-status.yaml` `4-4-serialize-concurrent-deploys-to-the-same-stand` →
        `in-progress` before starting implementation, so the tracker never disagrees with reality
        mid-story.
  - [ ] 1.1 Query the pre-work baseline: highest `action_run` id before this story's first
        *implementation* push, via
        `GET https://git.crm-prionex.com/api/v1/repos/CRM/fe-prionex/actions/runs?limit=100`.
        🔴 **The token this project has used for that query is `fe_review_1_7` at `/root/.fj_token`
        on s1, and Oleg's revocation of it is PENDING** (`deferred-work.md:39-54`). A `401` **is the
        revocation, not a bug** — say so, then use `fe_tmp_1_7` / `fe_pkg_3_6` per the standing token
        model, or ask the coordinator. **Never print a token value** (Story 4.2's Completion Note 9
        is the record of what happens when a `401` body echoes the presented string back).
  - [ ] 1.2 Declare the budget in the Dev Agent Record **before pushing anything**, using the
        arithmetic in Dev Notes §9. Not a flat count: 4.1 declared 5 and spent 7; 4.2 modelled the
        multiplier and landed exactly on 7; 4.3 modelled it and still spent the whole 915-950 range.
  - [ ] 1.3 🔴 The multiplier is structural: **every push that lands while the PR is already open
        costs 2 `action_run` rows** (`push` + `pull_request: synchronize`, `ci.yml:65-71`, measured).
        A push to a branch with **no** PR open costs 1 — but that 1 still runs `ci.yml`'s `image`
        job, which builds and publishes this branch's `-dev` image. Cancelled runs still occupy a
        row.
  - [ ] 1.4 🔴 **Price the red dispatches in as a named line, not a caveat** — this is Story 4.3's
        own closing instruction to this story (`4-3-…md:1064-1082`, quoted in Dev Notes §9). 4.3
        spent **five red dispatches before its first PASS**, and that count was not inefficiency: it
        is the structural price of job/step logs being unretrievable on this instance, so each
        distinct failure cause costs roughly one dispatch to discover. Count this story's distinct
        possible causes (Dev Notes §9 enumerates seven) and declare accordingly.
  - [ ] 1.5 The merge to `main` fires **`build-main.yml`**, a different workflow from `ci.yml`
        (which ignores `main`): **+1**. The closeout PR is a second branch/PR/merge cycle: **+3**.
  - [ ] 1.6 The ledger closes **only against a query, re-run after the merge commit lands**. A
        ledger closed at PR-open is not closed. If the query cannot be run, close it with the
        literal word **OPEN** — never a self-reported number. Final closure is the coordinator's
        (retro-D4).

- [ ] **Task 2 — Measure the four premises this story's design rests on, before writing the design
      (4.3's rule: measure, do not inherit)**
  > Every one of these is currently *derived* from a document, not observed. 4.3's most expensive
  > lesson was that a premise carried by four stories can still be false (D28 §6, D10's amendment).
  > All four are answerable from a simulated job container on s1, at a cost of **zero dispatches**.
  - [ ] 2.1 🔴 **Runner capacity — the record contradicts itself.** D29 §8 and
        `deploy-dev.yml:150-158` say `capacity: 1` (4.3 Task 2's local read of
        `/opt/forgejo-runner-deploy/config.yml`); `deferred-work.md:231-233` warns *"a runner with
        `capacity > 1` still permits two simultaneous deploys, so **re-examine the lock rather than
        deleting it**"*; D8 recorded the disposable probe runner at 2. Re-read the file, record the
        value **and its mtime**, and state plainly which of the three statements is current. The
        answer does not change whether the lock is built — it changes only whether AC3's contention
        can ever arise from two jobs, and therefore how AC3 is proven (Dev Notes §5).
  - [ ] 2.2 🔴 **Does a sibling container launched through the job's own `docker.sock` bind-mount
        `/root/crm-prionex/fe-prionex-dev` despite `valid_volumes`?** This is AC2's load-bearing
        premise and it is D28 §4 H5 amendment (i) — explicitly labelled *derived, not measured*.
        Test it: from a container matching the job's shape, `docker run --rm -v
        /root/crm-prionex/fe-prionex-dev:/lock <image> ls -la /lock`. Record the exact outcome. If
        it is refused, take Dev Notes §2's fallback (B), and record WHY, not just THAT.
  - [ ] 2.3 **Is `flock` present in the job image `deploy-base-dev-preprod:2026-08-07`?** 4.3
        inventoried that image's tooling (docker 27.5.1 client / 29.4.0 server, compose v2.33.0,
        git 2.47.2, `curl`, `jq`, `wget`) — **`flock` is not on that list, and its absence was never
        checked.** `command -v flock`. If absent, do NOT `apt-get install` on a shared runner's job
        image at deploy time (an unpinned network dependency in the deploy path is the exact class
        `build.yml` already carries as debt); take Dev Notes §2's fallback (C).
  - [ ] 2.4 **Does `docker logs` work against a container this job started?** The lock-acquired
        marker is read through it (Dev Notes §4). This is the daemon's own log channel, unrelated to
        Forgejo's missing job logs — but say so from an observation, not from confidence.
  - [ ] 2.5 Record all four answers in the Completion Notes with the command and its literal output.
        Zero dispatches are spent on this task; if any answer requires a dispatch, say so and price
        it into the ledger first.

- [ ] **Task 3 — The `concurrency` block (AC1)**
  - [ ] 3.1 Add a workflow-level `concurrency:` block to `.forgejo/workflows/deploy-dev.yml`,
        **outside `jobs:`** — job-level `concurrency` is silently ignored on this instance (D8), and
        "silently" means a guard that looks present and is not.
  - [ ] 3.2 Group: the stand's own identity, as a **literal constant** —
        `group: deploy-dev-fe-prionex-dev`. No expression. Two reasons beyond Dev Notes §3's
        argument: an expression here cannot be validated cheaply, and **a workflow file this
        instance cannot parse produces failed runs with no jobs and no logs at all** — the error
        lands only in `action_run.pre_execution_error_details` (D21's methodological finding). A
        constant cannot fail that way.
  - [ ] 3.3 `cancel-in-progress: false`. Write the reason in the file, not only here (AC1's second
        blockquote): a cancel between `down` and a healthy `up -d` leaves the stand stopped with no
        rollback path.
  - [ ] 3.4 🔴 Replace the existing "No concurrency block, deliberately (Task 6.4) — Story 4.4's to
        add" comment block at `deploy-dev.yml:150-158` — do not leave it standing next to the block
        it says is absent. Keep M4's own sentence about `$GITHUB_RUN_ID`-suffixed workspace paths;
        it is still true and still load-bearing.
  - [ ] 3.5 Note for the record, in the file: the `${{ }}` house rule forbids expressions inside
        `run:` **bodies**; a workflow-level key is not a `run:` body, so the rule is not in tension
        here — and this story does not use an expression anyway.
  - [ ] 3.6 🔴 Write D21's warning **beside the block**, as `build.yml:90-99` already does for its
        own: this block governs the DISPATCH path only, and the day Story 4.8 turns this file into a
        callee the run will carry the CALLER's auto-group instead — no error, no message, guard
        gone. Also state what the block is and is not evidence for (Dev Notes §3's three-source
        paragraph, compressed): assignment measured, effectiveness under contention not, which is
        why the lock and not this block is the load-bearing half.

- [ ] **Task 4 — The lock (AC2, AC5)**
  - [ ] 4.1 Lock file: `.deploy.lock` inside `/root/crm-prionex/fe-prionex-dev/` — the path
        `epics.md:1709-1712` names, reachable per Task 2.2. The stand directory is otherwise
        untouched by this workflow and stays the manual/DR path (D29 §1); a lock file is the one
        thing that belongs to both paths, which is exactly why it goes there and not in the job's
        own workspace. Never read or write anything else in that directory.
  - [ ] 4.2 Acquire in its own step, placed **after the pull succeeds** and **before** the
        hand-provisioned-stand guard (`deploy-dev.yml:803`) — the first step that reads live stand
        state. Rationale: the pull is the long, idempotent, stand-independent part; holding the lock
        across it would serialize two deploys for no benefit.
  - [ ] 4.3 Release in an `if: always()` step placed **after the last verification step** (the
        post-deploy state record, `deploy-dev.yml:1173`), so the whole `down` → `up -d` → health →
        anchored check → fallback HTTP → AC6 digest → Kong guard window is inside the lock.
        ⚠️ Code review M5 already recorded that `if: always()` does **not** survive cancel or
        timeout — that is why the holder carries its own TTL (Task 4.5), and why AC4 is satisfied by
        the mechanism rather than by this step.
  - [ ] 4.4 Bounded wait: **240 s**, a named constant in the file. Arithmetic, stated so it can be
        rechecked: 4.3's deploys run ~60 s end to end, so 240 s covers three queued deploys, and
        240 s wait + ~90 s deploy stays inside the deploy job's existing `timeout-minutes: 10` with
        room — **do not raise the job timeout to fit a longer wait** without re-reading Story 4.7's
        10-minute budget (NFR2) and saying what "under 10 minutes" means for a queued deploy.
  - [ ] 4.5 Holder TTL: **720 s**, a named constant. It must exceed the longest legitimate hold
        (~2-3 min) and must not greatly exceed the job's own 10-minute ceiling — a holder cannot
        then outlive a hard-timed-out job by more than a few minutes. This constant IS AC4's
        answer; write the arithmetic beside it.
  - [ ] 4.6 🔴 The acquire step is a fail-closed guard and inherits 4.3's H1 idiom **exactly** — the
        review found seven guards that died at their own command substitution before their message
        could print. Use `X="$(cmd || true)"` so a failure becomes data the `if` classifies, or
        `X="$(cmd)" || { echo "FAIL: ..."; exit 1; }` where the only sane response is to say so
        immediately, or `if ! X="$(cmd)"; then X="fallback"; fi` where the command writes a spurious
        value to its own stdout on failure (`docker inspect` writes a bare newline; `curl -w
        '%{http_code}'` writes `000` — both were found the hard way and both are in
        `deploy-dev.yml`'s header). Before pushing, force each new guard to fail locally and confirm
        it prints its OWN message.
  - [ ] 4.7 AC5's message names: the holding container/run, the TTL remaining, and the single
        command that clears it (`docker rm -f <holder>`). A fail-closed guard names the cause **and
        the fix** (`4-1-…md:370-381`).
  - [ ] 4.8 No `${{ }}` inside any `run:` body, comments included — values arrive via `env:`
        (`build.yml:812-816` is why: Forgejo substitutes inside comments too). Verify by grep before
        pushing, the way 4.3 did (all 23 sites parsed).
  - [ ] 4.9 The lock protects the stand identified by `COMPOSE_PROJECT_NAME=fe-prionex-dev`, not a
        directory (D29 §7: the compose `working_dir` label points at a workspace that no longer
        exists after the run — **stand identity is the project name**). Say so in the file so 4.8
        parameterizes the right thing.

- [ ] **Task 5 — The contention hook (`hold_lock_seconds`), designed as a permanent regression hook
      (AC3, AC4, AC5)**
  > Precedent and template: `simulate_bad_credential` (`deploy-dev.yml:122-149`) — an input-gated
  > test hook kept deliberately, with its safety argument written into the workflow's own header.
  - [ ] 5.1 Declare `hold_lock_seconds` (`required: false`, default `0`). When greater than zero the
        job **does not deploy**: it starts the lock holder for that many seconds and exits
        successfully. This is what makes contention deterministic on a `capacity: 1` runner — the
        holder is a container, so it outlives its own job, and the next (necessarily sequential)
        dispatch meets a genuinely held lock.
  - [ ] 5.2 Bound it: reject values above the TTL constant (720) and any non-numeric value, with a
        fail-closed message. An unbounded hold input in a deploy pipeline is a denial-of-deploy
        switch; a bounded one is a test fixture.
  - [ ] 5.3 🔴 Apply code review M11's lesson: **the classifier's own message must carry the
        marker**, not merely a separate warning line — a log excerpt, an alert rule, or Story 4.5's
        Slack notification will not necessarily carry the other line. Any wait/timeout message
        produced while a simulated holder is in play carries
        `[SIMULATED via hold_lock_seconds=… — NOT a real concurrent deploy]`.
  - [ ] 5.4 Write the safety argument into the workflow header, in the shape
        `simulate_bad_credential`'s block already uses: default is off; the worst case is a refusal
        to deploy that is instantly recoverable (`docker rm -f`), never data loss, never a
        credential path, never a way to touch the stand; the population that can set it already
        holds push access, so no new privilege boundary is created.
  - [ ] 5.5 Decide explicitly at story close whether the hook stays (4.3's precedent says it
        should — re-earning AC3's row after any future change otherwise costs a real race that this
        platform cannot stage). Record the decision either way; do not leave it by default.

- [ ] **Task 6 — Prove the mechanics locally before spending a single dispatch (4.3's Completion
      Note 9 precedent, and the coordinator's own instruction there: stop the one-bug-one-dispatch
      cycle)**
  - [ ] 6.1 In a simulated job container on s1 matching the job's shape, run the acquire/release
        sequence end to end as a `bash -x` script.
  - [ ] 6.2 Run it TWICE CONCURRENTLY, from two shells, and confirm the second blocks and then
        proceeds. This is the only place a real overlap is cheap; it does not prove the workflow,
        but it does prove the primitive, and it costs nothing.
  - [ ] 6.3 Force every new failure path locally: holder already present; holder disappears mid-wait;
        wait exhausted; holder TTL expiry; release when the holder is already gone. Confirm each
        prints its own message (Task 4.6).
  - [ ] 6.4 Confirm the lock leaves **no** file state that requires cleanup: `flock` releases with
        the file descriptor, so `.deploy.lock` persisting as a zero-byte file is normal and is not a
        held lock. Say this explicitly — a future reader finding that file must not "clean it up"
        and must not read its existence as a lock.

- [ ] **Task 7 — Live outcome matrix (retro-E5; a guard that cannot fail proves nothing)**
  > *"Every new guard ships a live outcome matrix including a discriminating run"* —
  > `epic-3-retro-2026-08-18.md:78`. Each row below is a **real dispatch on the real runner**, not a
  > local simulation. 🔴 **Read the verdict from the job list and from the runs API's own
  > `created`/`started`/`stopped` timestamps — not from a log line.** Job and step logs are not
  > retrievable on this instance for any runner; D8 itself proved queueing from timestamps alone,
  > and that is the method this matrix inherits.
  - [ ] 7.1 **PASS (AC6)** — an ordinary dispatch, `ref=main`, no holder present. Stand healthy,
        digest matches the resolved digest, network id unchanged, no lock container left behind.
        This is also the control row: *did adding the guard break the deploy it guards*.
  - [ ] 7.2 **WAIT, discriminating (AC3)** — dispatch #1 with `hold_lock_seconds` set to a value
        comfortably inside the wait bound (e.g. 180); it returns quickly, leaving the holder alive.
        Dispatch #2 immediately, normal. Expect: #2 **SUCCEEDS**, and its `stopped - started` is
        roughly (remaining hold + normal deploy duration), against ~60 s for row 7.1. Confirm
        host-side that the container's `Created`/`StartedAt` fall AFTER the holder's expiry — that
        is the clause *"the final container state corresponds to exactly one of the two deploys"*,
        proven by timestamps and digest rather than asserted.
  - [ ] 7.3 **FAIL, discriminating (AC5)** — dispatch #1 with `hold_lock_seconds` set beyond the
        wait bound (e.g. 400 against a 240 s wait). Dispatch #2, normal. Expect: #2 **FAILS at the
        acquire step**, and — the discriminating half — **the stand is untouched**: still healthy,
        still serving the same digest, `Created` unchanged. Verify the stand host-side BEFORE and
        AFTER, not only after. This is the row that proves the lock is a gate and that it sits on
        the safe side of `down`.
  - [ ] 7.4 **STALE, discriminating (AC4)** — after 7.3's holder expires by its own TTL, with **no
        human intervention and no cancel** (there is no cancel API), dispatch normally. Expect:
        **SUCCESS**, no leftover holder container, no manual cleanup. If instead the holder must be
        removed by hand for this row to pass, AC4 is NOT met and the TTL design is wrong — record
        that outcome rather than helping it along.
  - [ ] 7.5 **CONCURRENCY GROUP (AC1), and the honest limit on what it can prove.** Two rapid
        dispatches. 🔴 **Timing cannot discriminate here**: on a `capacity: 1` runner, queueing by
        runner capacity and queueing by concurrency group look identical, and reading the second as
        the first is precisely the false positive AC3's amendment warns about. The discriminator is
        the run's own record — `action_run.concurrency_group` / `concurrency_type` (`1` = explicit,
        `0` = auto), the exact columns D21 used to measure the `workflow_call` drop. If those
        columns are not reachable this session, record the row as **UNPROVEN** and say which query
        would close it — do not infer it from queueing.
  - [ ] 7.6 Cheap and it closes AC1's other half: confirm from the same record that a dispatch of
        this workflow carries the **explicit** group, not the auto-group of the form
        `refs/heads/…_deploy-dev.yml_workflow_dispatch__auto`. D21's table is the reference shape.
  - [ ] 7.7 Every row records: run id, trigger, inputs, per-job outcome, `started`/`stopped`, and the
        host-side observation that settles it. A row whose evidence is "the job was green" proves
        the job was green (D21: a green wrapper job proves nothing about what ran beneath it).

- [ ] **Task 8 — Do not break what 4.3 shipped (AC6)**
  - [ ] 8.1 `DOCKER_CONFIG` and the checkout directory keep their `$GITHUB_RUN_ID` suffixes (M4,
        live-confirmed at run 950 by `docker compose ls`'s config path reading
        `stand-checkout-950`). 🔴 **Adding a lock is not a reason to revert them.** The lock
        serializes stand access; the suffixes prevent two runs' *workspaces* from deleting each
        other — different failure, and the workspace one survives even if the lock is never
        contended.
  - [ ] 8.2 The `.env.deploy` render keeps writing `FRONTEND_PORT=127.0.0.1:8082` on every deploy —
        this is what made Oleg's M7 decision self-applying and let `deferred-work.md:2724-2725`
        close. A refactor that skips the render silently reopens a closed item.
  - [ ] 8.3 Do not touch the ladder (`preflight` / `clone-test` / `digest-resolve-test`), the AC3
        ordering (resolve → pull → `down` → `up -d` → health), the digest-pinned `DOCKER_IMAGE`, or
        any of the seven H1-fixed guards. Confirm by reading the diff, not by intention.
  - [ ] 8.4 Re-run the `${{ }}`-in-`run:` grep over the whole file after the edit and record the
        count, the way 4.3 recorded "all 23 parsed".

- [ ] **Task 9 — Record the decisions (D-record, epics, deferred-work)**
  - [ ] 9.1 New D-record in `docs/migration-decisions.md`, in Russian, following the house shape
        (Дата / Story / Статус, numbered sections, `**Требования:**`, `**Триггер пересмотра:**`).
        Highest existing is **D29**, so the next number is **D30** — 🔴 but **verify against open
        branches first**: D26's own opener records a number being taken by an unmerged branch. Add
        the index-table row and the Change Log row too; the record is not added until both exist.
  - [ ] 9.2 Amend **D29** by appended block (bodies are never rewritten in this project): §8's
        handoff to 4.4 is now answered — say which workaround was chosen and which were rejected,
        with the reason each lost.
  - [ ] 9.3 🔴 `D4`/`E5` collide across two numbering schemes. The retro action items are
        **retro-D4** / **retro-E5** (`epic-3-retro-2026-08-18.md:77-78`); the D-series in
        `migration-decisions.md` is a different sequence (its `D4` is stand parameterization, and it
        has no `E5`). The new record goes in the D-series; the run-ledger rule never goes into
        `migration-decisions.md`.
  - [ ] 9.4 Amend `epics.md` Story 4.4 and FR30 with the two AC deviations (the concurrency key, and
        the mechanism half of the `flock` clause) — the same treatment 4.3 gave 4.2's AC2 and its
        own AC3. An AC that shipped differently and was not amended is a defect the next story
        inherits, which is exactly how this story's own AC came to be unsatisfiable.
  - [ ] 9.5 `deferred-work.md`: close `:231-233` (*"re-examine the lock rather than deleting it"*)
        with what was re-examined and what was decided. 🔴 Close it **at that entry**, not near it —
        code review M12 found three of 4.3's closures landed at the wrong entries.
  - [ ] 9.6 Anything this story finds and does not fix goes into `deferred-work.md` with a named
        owner, at the point it is found. Candidates already visible: `flock`'s wake order is not
        FIFO, so with three or more waiters "the second waits for the first" holds but the order
        among the rest is unspecified; and the manual/DR path in the stand directory does not take
        this lock, so a human running `docker compose` there still races a deploy.

- [ ] **Task 10 — Land it**
  - [ ] 10.1 Branch `story-4-4/pr-2-implementation` off current `main`. The context commit is
        already on `story-4-4/pr-1-context` (no PR — a push there costs 1 run, not 2).
  - [ ] 10.2 🔴 **Do not touch:** `docker-compose.server.yml`, `.github/workflows/CD.yml`,
        `nginx.conf`, `Dockerfile.prod`, `.env.dev.example`, `docker-compose.stand.yml`,
        `.env.stand.example`, and the four `.forgejo/workflows/*.yml` other than `deploy-dev.yml`.
        **NFR5 / D7:** the legacy stands and the GitHub side are untouched — verify by the diff's
        own file list, not by intention.
  - [ ] 10.3 Flip `sprint-status.yaml` → `review` when the matrix is live-earned, not when the code
        is written.
  - [ ] 10.4 Re-query the ledger after the merge commit lands and close it (Task 1.6). Closeout is a
        second branch/PR/merge cycle: `story-4-4/pr-3-ledger-closeout`.

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

*To be declared before the first implementation push (Task 1.2), per the model in Dev Notes §9 —
not a flat count. Baseline (Task 1.1) goes here first.*

### Completion Notes List

### File List

## Change Log

| Date | Note |
|---|---|
| 2026-08-20 | Story contexted against `main` at 2fc2a220. Two autonomous decisions recorded, subject to Oleg's veto: the concurrency group is keyed on the stand (`deploy-dev-fe-prionex-dev`), not on `github.ref` (Dev Notes §3); the `flock` is taken on `.deploy.lock` inside the stand directory through a sibling container over the job's own `docker.sock`, which makes `epics.md`'s literal clause satisfiable again (Dev Notes §2), with two ranked fallbacks. Two ACs amended (AC1's key, AC2's mechanism), two added (AC5 fail-closed-and-untouched, AC6 no regression). D29 §8's handoff answered. Status → ready-for-dev |
