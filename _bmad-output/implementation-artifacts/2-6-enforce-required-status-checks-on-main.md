---
baseline_commit: 694f6a06
---

# Story 2.6: Enforce Required Status Checks on Main

Status: ready-for-dev

> **This is the first story in the project that can lock the team out of its own release branch, and
> the first whose success depends on a Forgejo semantic nobody has tested.**
>
> Two things make it different from everything before it. **(1)** Oleg decided on 2026-08-14 that the
> rule applies to admins (§2). From the moment it lands, *nobody* — including Oleg, including this
> story's own token — can push directly to `main`, and every commit goes through a pull request.
> **(2)** The eight-context gate that Story 2.5's review recommended rests on an assumption: that a
> required context with **no status row** blocks a merge. **If Forgejo instead treats a missing
> context as not-applicable, the gate does not protect against anything and the whole design is
> wrong.** §4 makes proving that semantic a precondition, not an afterthought.
>
> **Read §1–§8 and the Prohibitions before the ACs. Write the rollback down before the first write.**

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a tech lead,
I want `main` to reject direct pushes and unverified merges,
so that nothing reaches the release branch without passing the gate.

---

## 🚨 Read this before anything else

### 1. 🔴 What exists today, and what this story changes

A protection rule on `main` **already exists** — created by Story 1.13 on 2026-08-10 — and it is
**completely permissive**. It gates nothing. Read as of 2026-08-14 (`2-5-…md:731-739`):

| Field | Current | This story sets | Why |
|---|---|---|---|
| `rule_name` | `main` | unchanged | the rule exists; **update it, do not create a second one** |
| `enable_status_check` | **`false`** | **`true`** | the gate itself — AC1 |
| `status_check_contexts` | **`null`** | **the eight strings, verbatim** (§3) | AC1; the choice is §3's whole subject |
| `enable_push` | **`true`** | **`false`** | AC2 — "the push is rejected by the server". `true` + no whitelist means *everyone* may push |
| `apply_to_admins` | **`false`** | **`true`** | §2 — Oleg's decision, 2026-08-14 |
| `required_approvals` | `0` | **unchanged (`0`)** | out of scope. Prohibition 4 |
| `enable_push_whitelist` | `false` | unchanged | not needed once `enable_push` is `false` |
| `enable_merge_whitelist` | `false` | unchanged | out of scope |
| `require_signed_commits` | `false` | unchanged | out of scope |

Preconditions, all verified:

| Precondition | State | Source |
|---|---|---|
| Two runners online (FR29, `epics.md:198`) | ✅ ids **19** and **20**, both `node-20`, capacity 2 — four slots | D10, D13 |
| CI proven stable (Story 2.5) | ✅ ten runs, 10/10 green, no reruns (`attempt = 1` on all 40 jobs), min 512 s / max 567 s vs 900 s | `2-5-…md` |
| The eight context strings | ✅ harvested verbatim from `commit_status` on five head SHAs, 40/40 `success` | `2-5-…md`, `deferred-work.md` |
| Branch-protection API reachable | ✅ `GET .../branch_protections` → 200; `POST` proven by Story 1.13 | `2-5-…md:731-739`, `1-13-…md` |
| PR create + merge via API | ✅ five for five, first attempt each | `2-5-…md` |

### 2. 🔴 `apply_to_admins: true` — the decision, what it costs, and how to undo it

**Decided by Oleg, 2026-08-14, in response to this story being written.** The rule applies to admins.

**Why it had to be decided rather than defaulted.** The only identity this project has is Oleg's
account, and it is a repository admin; the API token `fe_tmp_1_7` is scoped to it. With
`apply_to_admins: false` the rule exempts the only identity available, so **AC2, AC3 and AC4 could
not be tested at all** — every push and merge in the test would be performed by an exempt actor, and
the story would close on evidence that proves nothing. Story 2.5 already demonstrated this shape from
the other side: its five merges into "protected" `main` succeeded on the first attempt precisely
because the merging identity was exempt.

**What it costs, stated plainly:**

- **Direct `git push` to `main` stops working — for everyone, Oleg included.** Combined with
  `enable_push: false`, that is the point of AC2.
- **Every commit to `main` now goes through a pull request**, and each PR costs **two CI runs** —
  one `push`, one `pull_request` — at **~646–653 s (~11 min) per PR**, measured across Story 2.5's
  five PRs. A one-line documentation fix costs a full CI cycle.
- **This story's own closing commits are subject to the gate it just installed.** That is not a
  problem to engineer around — it is AC4's evidence, arriving for free (§7).

🔑 **The rollback, and write it down before the first write.** Branch-protection settings are
**not themselves protected** by `apply_to_admins` — a repository admin can always change the rule.
Recovery from any lock-out is a single `PATCH` restoring the snapshot taken in Task 1.
**Take that snapshot verbatim before touching anything** (Task 1.3). It is the whole safety net.

### 3. 🔴 Require all eight contexts. The epic's reasoning was inverted, and the correction matters

The epic's AC1 (`epics.md:1229-1239`, amended 2026-08-14) says the two sets *"fail in opposite
directions"* and asks for **a named, explicitly chosen subset**. Story 2.5's original handoff went
further and recommended the four `(pull_request)` contexts. **Story 2.5's code review reversed that,
with a counterexample from the database, and the reversal is the single most load-bearing fact in
this story.**

**The eight strings, verbatim from `commit_status`** — do not retype them from job names, that is
what `epics.md:1236-1239` explicitly forbids:

```
CI / Lint (push)                CI / Lint (pull_request)
CI / Type Check (push)          CI / Type Check (pull_request)
CI / Unit Tests (push)          CI / Unit Tests (pull_request)
CI / Build (push)               CI / Build (pull_request)
```

Forgejo composes a context as `<workflow name> / <job name> (<event>)`.

🔴 **Why a four-`(pull_request)` gate is dangerous.** Legacy `.github/workflows/CI.yml` carries
`name: CI` and job names `Lint`, `Type Check`, `Unit Tests`, `Build` — **byte-identical to the
Forgejo workflow**. It therefore writes **the same four `(pull_request)` context strings**. D9's
suppression resolves **per commit**, and ~497 of 501 branches have heads predating the
`.forgejo/workflows/` placeholder, so a PR from any of them executes the legacy file on
**`ci-hub` (runner id 10), another team's runner**.

**The counterexample was in the database the whole time:** `action_run` id **286** (2026-08-10),
`workflow_id = CI.yml`, all four jobs on runner id 10, writing `CI / Lint (pull_request)` = success,
`CI / Type Check (pull_request)` = success, and two failures — real `commit_status` rows with the
same context strings.

**So the risk is a falsely-green merge, not a permanently-red PR.** Under a four-context gate, a
stale-branch PR whose legacy `ci-hub` run happens to be green **satisfies the gate completely**.

🔑 **Why the `(push)` half is the protection.** A stale branch cannot produce `(push)` contexts:
the legacy workflow's `push` trigger is limited to `branches: [main, staging, development]`, so
pushing a stale *feature* branch fires nothing at all. The four `(push)` contexts are the half a
stale branch cannot forge. **Require all eight.**

⚠️ **The documented side effect, accepted:** a PR whose *head* is `staging` or `development` can
never satisfy the gate — those branches are in `ci.yml`'s `branches-ignore` and carry only the
placeholder README, so they produce neither `(push)` nor `(pull_request)` contexts. Feature-branch
PRs, which is every PR this workflow actually opens, are unaffected. Record this; do not engineer
around it.

### 4. 🔴 The gate rests on an untested semantic. Prove it before trusting it.

Everything in §3 assumes: **a required context with no `commit_status` row blocks the merge.**

If Forgejo instead treats a missing context as not-applicable and merges anyway, then the `(push)`
half provides **no protection at all**, the stale-branch PR sails through, and the eight-context
choice is decoration. **Nobody has tested this on this instance.** The repository has evidence for
what a *failing* context does (it blocks — that is AC3) and **none at all** for a *missing* one.

🔑 **Cheap, safe test — no stale branch, no `ci-hub`, no extra CI run.** Temporarily add a **ninth**
context to `status_check_contexts` that can never exist — e.g. `CI / Does Not Exist (push)` — while
a pull request with all eight genuinely green is open. Then attempt the merge:

- **Blocked** → a missing context blocks. §3's design is sound. Remove the ninth context, merge.
- **Merged** → a missing context does **not** block. 🔴 **Stop.** The eight-context gate does not
  defend against stale branches; the finding is bigger than this story and Oleg must decide what to
  do. Record it as the primary finding and do not paper over it.

This costs one API round trip and zero CI runs, and it converts the story's central assumption into
a measurement. Do it **before** closing AC1.

### 5. 🔴 Which write verb works is unknown — find out before you need it

`GET` and `POST` on `branch_protections` are proven (`2-5-…md:731-739`, Story 1.13).
**`PATCH` and `DELETE` on `branch_protections/{name}` have never been attempted on this instance.**

- **Try `PATCH /api/v1/repos/CRM/fe-prionex/branch_protections/main` first.** It is the only verb
  that changes the rule without a window in which `main` is unprotected.
- **If `PATCH` is unsupported** (404/405/501 — record the exact status and body), the fallback is
  `DELETE` then `POST`. That fallback leaves a gap with no rule at all. **Declare it before doing
  it, do it in one immediate sequence, and verify by `GET` afterwards.** Do not leave the repository
  in the gap while investigating something else.
- **Whatever the verb, read the rule back with `GET` and compare field by field.** A write that
  returns 200 and stores something different is the failure mode that would make every later test
  meaningless.

### 6. 🔴 AC6 stops a runner. That is a write to shared infrastructure, and the naive way does not work

AC6 requires one runner deliberately stopped, with merges still proceeding via the other. Story 1.9
already did this and recorded exactly how — **and recorded that two obvious methods silently fail**:

- ❌ `docker kill forgejo-runner-fe-prionex` — treated as an intentional stop; `restart: unless-stopped`
  does **not** fire. Story 1.7's first durability test was a false negative for exactly this reason.
- ❌ `docker exec forgejo-runner-fe-prionex kill -9 1` — **silently no-ops in this image**; reports
  `exit=0` and the container keeps running (D10 footnote).
- ✅ Signal the **host-side PID**, and suspend the restart policy first, or the runner is back in
  **~327 ms – 1 s** and you have proven nothing:

```
docker update --restart=no forgejo-runner-fe-prionex
PID=$(docker inspect --format '{{.State.Pid}}' forgejo-runner-fe-prionex)
kill -9 $PID
docker inspect --format '{{.State.Status}} {{.State.ExitCode}}' forgejo-runner-fe-prionex   # expect: exited 137
```

🔑 **Write the revert down before the kill, and execute it immediately after the test:**

```
docker update --restart=unless-stopped forgejo-runner-fe-prionex
docker start forgejo-runner-fe-prionex
```

⚠️ **The API lies about runner state.** Story 1.9 observed `GET .../actions/runners` reporting
runner 19 as `idle` while the host showed it `exited` — the status is heartbeat-stale. **Trust
`docker inspect`, not the API,** for whether a runner is actually down.

⚠️ **Cost.** With one runner down there are **two job slots, not four**. A PR's eight jobs serialise
into ~2 waves per run; `Unit Tests` alone is ~510 s. Budget **~20–25 min** for the AC6 PR against
~11 min normally. Declare it (Task 2).

⚠️ **s1 carries another tenant's production and five other runner projects.** Each runner project is
its own compose project with its own network, so stopping ours does not touch theirs — but the
docker daemon is shared. Stop **runner 1 only**, revert immediately, and never leave the session with
a runner down.

### 7. 🔴 Order of operations — the gate applies to this story's own commits

Once AC1 lands, this story cannot push its own record to `main`. That is by design and it produces
AC4's evidence for free, but only if the order is right:

1. **Snapshot and rollback first** (Task 1) — before any write.
2. **Prove the semantic** (§4, Task 4) — before trusting the gate.
3. **AC2, AC3** — the negative tests. AC3 needs a deliberately **red** PR (§8).
4. **AC4 and AC6** — the positive tests, carried by the story's own real record commits, in the
   spirit Story 2.5 established: a PR carries a change that would have been committed anyway.
5. **Close.** The final commit goes through a PR like everything else now does.

🚨 **If the gate blocks this story's own closing PR for a reason you did not intend, that is a
finding — record it and roll back per Task 1.3. Do not disable the gate to get your work merged**
(Prohibition 8). Turning the gate off to close a story about turning the gate on is the one outcome
that would make this file worthless.

### 8. How to produce a deliberately red check for AC3, cheaply and reversibly

AC3 needs a PR with a failing required check. Nothing in this repository's documentation can fail
`lint` — `format:check` only covers `src/**` and ESLint ignores markdown.

**Use a throwaway TypeScript file on a probe branch that is never merged.** `lint` is
`eslint . --max-warnings=0`, so a single unused binding fails it. **The `lint` job is ~140 s**, and
the gate blocks as soon as one required context is `failure` — **you do not need to wait for the
full ~510 s run** to attempt the merge and observe the block.

- Probe branch cut from current `main` (§3's stale-branch rule applies here too).
- The file lives under `src/`, exists only on the probe branch, and **is never merged**.
- Close the PR and delete the branch, local and remote, before the story ends (Prohibition 7).
- ⚠️ **There is no cancel endpoint** (`deferred-work.md:82-86`) — the red run finishes on its own
  ~510 s regardless. Budget it; do not try to stop it.

---

### Prohibitions

🚨 **A prohibition here cannot be overridden by a subtask.**

1. **Do not edit `.forgejo/workflows/ci.yml`.** The eight context strings are derived from its
   workflow name and job names; changing either silently breaks the gate you just configured.
2. **Do not set `required_approvals` above `0`**, and do not enable merge or push whitelists. Out of
   scope, and an approval requirement would deadlock a single-operator workflow.
3. **Do not touch the `staging` or `development` protection rules.** This story is scoped to `main`
   (`epics.md:1227-1256`).
4. **Do not change runner configuration**, beyond §6's documented stop-and-revert on **runner 1
   only**. Never `docker kill`, never `docker exec … kill -9 1` — both are recorded no-ops. Never end
   the session with a runner down or with `--restart=no` left set.
5. **No `ubuntu-latest`, `s1`, `ci`, `build-crm` or `deploy-dev-preprod`** in anything you push —
   those labels belong to three foreign org runners that are idle and will pick the job up
   immediately. `ci-hub` is runner id **10**.
6. **Do not open a pull request from any pre-existing branch.** §3 — ~497 of 501 carry the legacy
   workflow and route to `ci-hub`. Cut every branch from current `main`.
7. **Do not leave a probe branch, a red pull request, or a ninth context behind.** Every temporary
   artefact created for a test is removed before the story closes, and its removal is verified.
8. **Do not weaken or disable the gate to get your own work merged.** §7. If it blocks you
   unexpectedly, that is the finding.
9. **Do not read, quote or promise any number from a job log** — logs reach neither API nor disk on
   this instance. Evidence comes from the database, the filesystem, or a runner container log.
10. **Do not touch `.github/workflows/`.** D7; Story 7.2 owns those files. Bulk remediation of the
    497 branches is not this story's job either.
11. **Never write the API token into any repository file**, this story file included. It lives
    host-local at `/root/.fj_token`, mode 600, and the file holds `FJ_TOKEN=<hex>` — **strip the
    prefix**; it is not a bare token.

---

## Acceptance Criteria

Source: `epics.md:1219-1256`, amended 2026-08-14 by `sprint-change-proposal-2026-08-14.md` §4.3.
Covers **FR4** (`epics.md:77-78`) and depends on **FR29** (`epics.md:198`). Deviations are named in
each AC and justified in §1–§8.

**AC1 — required status checks are set to a named, explicitly chosen set of contexts, verified
against real rows.**
Given two runners online (Story 1.9) and CI proven stable (Story 2.5),
when branch protection is configured on `main`,
then `enable_status_check` is `true` and `status_check_contexts` holds **all eight** contexts,
and the choice of all eight — rather than either four-context subset — **is recorded with its
reason** (§3: the legacy workflow emits identical `(pull_request)` strings from `ci-hub`, so a
four-context gate admits a falsely-green stale-branch PR; the `(push)` half is the unforgeable half),
and the strings are taken **verbatim from `commit_status` rows**, not retyped from job names,
and the rule is read back with `GET` and compared field by field against what was written.

> **Deviation from the epic, stated.** The epic asks for *"a named, explicitly chosen subset"* and
> frames the two four-context sets as the alternatives. This story chooses **the full set**, and §3
> records why the epic's stated trade-off was based on an inverted premise. The `staging`/
> `development`-as-head side effect is accepted and recorded.

**AC2 — a direct push to `main` is rejected by the server.**
Given branch protection is active with `enable_push: false` and `apply_to_admins: true`,
when a direct `git push` to `main` is attempted with the project's own credentials,
then the server rejects it, and the exact rejection message is recorded,
and the attempt is made with a commit that was destined for `main` anyway, so that a failure of the
gate costs nothing beyond a commit that was going to land (§7).

**AC3 — a pull request with a failing required check cannot be merged.**
Given a pull request whose `lint` job fails (§8: a throwaway unused binding on a probe branch),
when a merge is attempted via `POST .../pulls/{index}/merge`,
then the merge is refused, and the exact status code and response body are recorded,
and the refusal is shown to be caused by the required check — by reading the `commit_status` rows for
that head SHA and confirming the failing context is one of the eight,
and the probe branch and its pull request are removed afterwards.

**AC4 — a pull request with all required checks green merges.**
Given a pull request from a branch cut from current `main`, carrying a change that would have been
committed anyway, with all eight contexts `success`,
when a merge is attempted,
then it succeeds, and the run ids, the eight context states and the merge response are recorded.

**AC5 — a required context with no status row blocks the merge (the semantic §3 depends on).**
Given a pull request with all eight contexts genuinely green,
when a ninth context that can never exist is temporarily added to `status_check_contexts` and a merge
is attempted,
then the merge is **blocked**, proving that a missing context blocks rather than being ignored,
and the ninth context is removed immediately afterwards and its removal verified by `GET`,
and if the merge instead **succeeds**, that is recorded as the story's primary finding, AC1's
eight-context justification is marked as **not established**, and Oleg is told before the story
closes.

> **Addition, stated.** This AC is not in the epic. §4 gives the reason: the entire case for the
> eight-context set rests on this semantic, no evidence for it exists on this instance, and the test
> costs one API round trip and zero CI runs. Closing AC1 without it would be closing it on an
> assumption.

**AC6 — with one runner stopped, merges still proceed via the second.**
Given required checks are enforced and both runners are online,
when runner 1 is stopped by the host-PID method with its restart policy suspended (§6) and a pull
request is then opened, run and merged,
then all eight contexts still reach `success` via runner 2 alone and the merge succeeds,
and the per-job runner attribution is recorded from `action_task.runner_id`, showing every job on
runner 20,
and the duration under half capacity is recorded against the ~11-minute two-runner baseline,
and **runner 1 is restored and verified `Running=true` with `restart: unless-stopped`** before the
story closes.

---

## Tasks / Subtasks

🚨 **Execution order is NOT the numeric order.** Task 4 consumes the green pull request that Task 6
creates, so it runs *inside* Task 6, between 6.3 and 6.4. Numbering follows the ACs; execution follows
the dependency:

```
1 → 2 → 3 → 5 → 6.1 → 6.2 → 6.3 → [4.1 → 4.2 → 4.3 → 4.4] → 6.4 → 6.5 → 7 → 8 → 9
                                   ↑ AC5 reuses Task 6's PR — zero extra CI runs
```

### Task 1 — Bind the facts and write the rollback before any write (AC: all)

- [x] 1.1 Confirm the working tree is clean and at `main` HEAD (`694f6a06` at story-creation time;
      re-read it). Confirm `.forgejo/workflows/ci.yml` is unchanged since Story 2.5 — the eight
      strings depend on it (Prohibition 1).
- [x] 1.2 Confirm both access routes: `ssh root@10.67.0.1` → `docker exec -i forgejo-postgres psql -U
      forgejo -d forgejo` answers, and the token at `/root/.fj_token` (strip `FJ_TOKEN=`) returns 200
      on `GET /api/v1/repos/CRM/fe-prionex`.
- [x] 1.3 🔑 **`GET /api/v1/repos/CRM/fe-prionex/branch_protections` and record the complete response
      body verbatim in the Dev Agent Record — every rule, every field.** This is the rollback
      snapshot and the story's safety net (§2). Write the exact `PATCH` body that would restore it,
      before making any change.
- [x] 1.4 Re-confirm `repo_id` for `CRM/fe-prionex` (expected **16**) and record `max(id)` and
      `count(*)` from `action_run` as the run-budget baseline, before creating any run.
- [x] 1.5 Re-derive the eight context strings **from the database**, not from this file:
      `SELECT DISTINCT context, state FROM commit_status WHERE sha IN (<Story 2.5's five head SHAs>)
      ORDER BY context;` Confirm exactly eight and that they match §3 character for character. If
      they differ, **stop** — the gate would be misconfigured from the first write.
- [x] 1.6 Confirm both runners are online and carry `node-20` with capacity 2 (read-only). **Re-read
      their ids — do not assume 19 and 20**; a deregister/re-register between story creation and
      execution would change them, and Task 7.4's attribution check depends on the right number.
      Record `docker inspect` state for runner 1 now, as the before-value for Task 7's revert check.
- [x] 1.7 Record host state on s1: load average, free memory. Story 2.5 ran at load 2.88–4.38, which
      was unusually low; Story 2.4 saw 11–17.

### Task 2 — Declare the budget and the write list (AC: all)

- [x] 2.1 State, in writing before any run or any write: the expected CI runs (AC3's red PR ≈ 2 runs,
      AC4's green PR ≈ 2, AC5 reuses AC4's PR at **zero** extra runs, AC6's PR ≈ 2 at half capacity,
      plus the closing PR ≈ 2 → **~8 runs**), the expected wall clock (~11 min per normal PR,
      **~20–25 min for AC6**), and every API write this story intends to make.
- [x] 2.2 State the rollback trigger explicitly: what observation would make you restore the Task 1.3
      snapshot, and confirm you can execute it without help.
- [x] 2.3 Name the real change the AC4 and closing PRs will carry (§7, Story 2.5's discipline).

### Task 3 — Configure the gate (AC: 1)

- [x] 3.1 Attempt `PATCH /api/v1/repos/CRM/fe-prionex/branch_protections/main`. Send exactly these
      four fields and nothing else — omitting a field leaves it unchanged; sending `required_approvals`
      or a whitelist field would violate Prohibition 2. `status_check_contexts` is a **JSON array of
      strings**, and the strings come from Task 1.5's query, not from this file:

      ```json
      {
        "enable_status_check": true,
        "status_check_contexts": [
          "CI / Lint (push)",
          "CI / Type Check (push)",
          "CI / Unit Tests (push)",
          "CI / Build (push)",
          "CI / Lint (pull_request)",
          "CI / Type Check (pull_request)",
          "CI / Unit Tests (pull_request)",
          "CI / Build (pull_request)"
        ],
        "enable_push": false,
        "apply_to_admins": true
      }
      ```

      Header: `Authorization: token <value>`, `Content-Type: application/json`. Record the request
      body and the full response verbatim.
- [x] 3.2 If `PATCH` is unsupported, record the exact status and body, then execute `DELETE` + `POST`
      as one immediate sequence per §5, and record the duration of the unprotected window.
- [x] 3.3 🔑 `GET` the rule back and compare **field by field** against what was sent. A 200 that
      stored something different is the failure mode that would invalidate every later test (§5).
- [x] 3.4 Record the eight strings as stored, and confirm they are byte-identical to Task 1.5's rows.
- [x] 3.5 Write the reason for choosing all eight into the Dev Agent Record (AC1), in your own words,
      grounded in run 286 — not copied from §3.

### Task 4 — Prove the missing-context semantic (AC: 5)

**Runs after Task 6's PR is green, and reuses it — it costs no CI run of its own.**

- [x] 4.1 With a pull request open and all eight contexts `success`, `PATCH` the rule to add a ninth
      context that cannot exist (e.g. `CI / Does Not Exist (push)`). Verify by `GET`.
- [x] 4.2 Attempt the merge. Record the exact status code and response body.
- [x] 4.3 Interpret per §4: blocked → the semantic holds, AC5 closes, AC1's justification stands.
      Merged → 🔴 **stop and report to Oleg**; record AC1's eight-context justification as **not
      established**, and do not close the story quietly.
- [x] 4.4 Remove the ninth context immediately and verify by `GET` that exactly the eight remain.
      This is Prohibition 7 and it is not optional.

### Task 5 — The negative tests (AC: 2, 3)

- [x] 5.1 **AC2.** Commit this story file's Task 1–3 progress (the rollback snapshot, the declared
      budget, the rule as written and read back) directly on local `main` — a commit that has to
      reach `main` regardless of how it gets there — then attempt `git push origin main`.
      **Expected: rejected.** Record the exact server response verbatim.
      - If rejected: leave the commit sitting on local `main` and carry it to `main` through Task 6's
        pull request instead. Reset local `main` to `origin/main` and cherry-pick the commit onto
        Task 6's branch, so nothing is written twice and nothing is lost.
      - If the push **succeeds**: the gate is not doing its job. The damage is nil — the commit was
        going to `main` anyway — but **stop**, record it as a finding, re-read the rule with `GET`,
        and do not proceed to AC3 until the cause is understood.
- [x] 5.2 **AC3.** Cut a probe branch from current `main`. Add a throwaway `.ts` file under `src/`
      with an unused binding (§8). Push, open the PR.
- [x] 5.3 Wait for the `lint` context to reach `failure` — ~140 s, not the full run. Confirm from
      `commit_status` that the failing context is one of the eight.
- [x] 5.4 Attempt the merge. Record the exact status code and body. Confirm refusal.
- [x] 5.5 Close the PR, delete the probe branch local and remote, and verify the throwaway file
      exists nowhere on `main`.

### Task 6 — The positive test (AC: 4)

- [x] 6.1 Cut a branch from current `main` carrying the real change named in Task 2.3. Push, open
      the PR.
- [x] 6.2 Wait for all eight contexts to reach `success`. Record run ids, indexes, events, SHAs, per-
      job durations and `runner_id` per job from the database.
- [x] 6.3 **Before merging, hand this PR to Task 4** — AC5's ninth-context test needs exactly this
      state and reusing it saves two CI runs.
- [x] 6.4 After Task 4.4 restores the eight, merge. Record the merge response.
- [x] 6.5 Confirm the merge to `main` produced **no** CI run — `main` is in `branches-ignore`. Check
      by SHA, not by absence from a listing.

### Task 7 — The failover test (AC: 6)

- [x] 7.1 Record runner 1's `docker inspect` state and its host PID **before** anything. Write the
      revert commands into the Dev Agent Record **before** executing the stop (§6).
- [x] 7.2 `docker update --restart=no`, read the host PID, `kill -9` it, and confirm
      `Status=exited, ExitCode=137` by `docker inspect` — **not** by the API, which reports stale
      state (§6).
- [ ] 7.3 Cut a branch from current `main` with a real change, push, open the PR, and let all eight
      contexts complete on runner 20 alone. Expect ~20–25 min at half capacity.
- [ ] 7.4 Record per-job `runner_id` from `action_task` and confirm **every** job ran on runner 20.
      Record the duration against the ~11-minute two-runner baseline.
- [ ] 7.5 Merge the PR. Record the response — this is AC6's actual claim: merges proceed.
- [ ] 7.6 🔑 Revert: `docker update --restart=unless-stopped`, `docker start`, then verify
      `Running=true`, `RestartCount`, and that the runner re-registers and reaches `idle`. **Record
      the verification, not just the commands.**
- [ ] 7.7 Confirm `.cache/actcache` survived the restart — Story 1.9 left this UNKNOWN and it is one
      query's worth of new knowledge.

### Task 8 — Record and hand forward (AC: all)

- [ ] 8.1 Write the full evidence into the Dev Agent Record: the before/after rule bodies, every API
      write with its response, the run table, the eight contexts as stored, the AC5 verdict, and the
      declared-vs-spent budget reconciliation.
- [ ] 8.2 Record the AC1 deviation (all eight rather than a four-context subset) and the AC5 addition,
      each with its reasoning.
- [ ] 8.3 Add a handoff section to `deferred-work.md`: the final rule state verbatim, the AC5 verdict
      and what it means for the 497-branch hazard, the cost the gate now imposes on every commit, and
      the `staging`/`development`-as-head side effect.
- [ ] 8.4 Add the changelog row to `docs/migration-decisions.md`. This decision — the gate, its
      contents and `apply_to_admins: true` — deserves a **decision record (D-number)**, not just a
      changelog line; it changes how everyone works with `main`.
- [ ] 8.5 Record whether Epic 2 is now complete (2.1–2.4 are `review`/`done`, 2.5 `done`), and what
      remains before `epic-2` could move to `done`.

### Task 9 — Close (AC: all)

- [ ] 9.1 Confirm no probe branch, no open PR, no ninth context, and no runner left stopped or with
      `--restart=no` (Prohibitions 4, 7).
- [ ] 9.2 Update `sprint-status.yaml`: `2-6-enforce-required-status-checks-on-main` → `review`.
- [ ] 9.3 The closing commit goes through a pull request like everything else now does (§7). If the
      gate blocks it unexpectedly, that is a finding — record it, do not disable the gate
      (Prohibition 8).
- [ ] 9.4 Confirm the File List is complete and nothing under the Prohibitions was touched.

---

## Dev Notes

### The API surface, and what is proven versus unknown

| Call | Status | Source |
|---|---|---|
| `GET /api/v1/repos/{o}/{r}/branch_protections` | ✅ 200, proven | `2-5-…md:731-739` |
| `POST /api/v1/repos/{o}/{r}/branch_protections` | ✅ proven — Story 1.13 created the `main` and `staging` rules | `1-13-…md`, `migration-decisions.md:572-579` |
| `PATCH /api/v1/repos/{o}/{r}/branch_protections/{name}` | ❓ **UNKNOWN — never attempted** | §5 |
| `DELETE /api/v1/repos/{o}/{r}/branch_protections/{name}` | ❓ **UNKNOWN — never attempted** | §5 |
| `POST /api/v1/repos/{o}/{r}/pulls` | ✅ five for five | `2-5-…md` |
| `POST /api/v1/repos/{o}/{r}/pulls/{index}/merge` | ✅ five for five — **but by an exempt admin**, so it has never met a gate | `2-5-…md` |
| `POST .../actions/runs/{id}/cancel` | ❌ **404** against the full swagger spec — no stop button | `deferred-work.md:82-86` |
| `actions/jobs/{id}/logs` and two sibling routes | ❌ **404**; `log_in_storage` stays `f` | `deferred-work.md:651-662` |

**BranchProtection fields observed on this instance** (`2-5-…md:731-739`): `rule_name`,
`enable_push`, `enable_push_whitelist`, `enable_merge_whitelist`, `enable_status_check`,
`status_check_contexts`, `required_approvals`, `apply_to_admins`, `require_signed_commits`.
⚠️ **These are Forgejo's names and they differ from GitHub's.** Do not import field names from
GitHub's branch-protection API — `required_status_checks`, `strict`, `contexts` do not exist here.

### Infrastructure facts

| Fact | Value | Source |
|---|---|---|
| Forgejo | 15.0.5+gitea-1.22.0, `git.crm-prionex.com`, org `CRM`, repo `fe-prionex`, `repo_id` **16** | D8, `2-5-…md` |
| Our runners | id **19** `s1-fe-prionex-1` (`192.168.226.3`), id **20** `s1-fe-prionex-2` (`192.168.226.4`), both on s1, repository-scoped, capacity **2** each | D10, D13, `1-9:224-252` |
| Containers | `forgejo-runner-fe-prionex`, `forgejo-runner-fe-prionex-2`; compose project `/opt/forgejo-runner-fe-prionex/`; separate dind each | `1-9:224-252` |
| Foreign runners | **`ci-hub` id 10** (`ubuntu-latest`), `s1-build-crm` id 12, `s1-deploy-dev-preprod` id 14, `s2-prod-deploy` id 17 — all org-scoped, another team's | `1-9`, D10 |
| Runner restart | `restart: unless-stopped`; genuine crash recovers in **327 ms – 1 s**; API runner status is heartbeat-stale | `1-9:314-349`, D10:786-792 |
| Host s1 | 104 cores, ~90 GB available, 683 GB free on `/opt`; carries five other runner projects, `techno-finance`, observability, another tenant's production | `1-9:637-639` |
| DB route | `ssh root@10.67.0.1 'docker exec -i forgejo-postgres psql -U forgejo -d forgejo -c "…"'` | `2-5-…md` |
| Token | `fe_tmp_1_7`, `/root/.fj_token` on s1, mode 600, file holds **`FJ_TOKEN=<hex>`** — strip the prefix | `2-5-…md`, `deferred-work.md:298-306` |

⚠️ **The `id` vs `index` trap.** Run numbers cited throughout this repository (286, 535–544, …) are
`action_run.id`, the global row id — **not** the per-repo `index`. Querying by `index` with those
numbers returns 0 rows. Record both for every run.

### Story 2.5's measured baseline, for comparison

Ten runs, ids 535–544, all green, `attempt = 1` on all 40 jobs. Whole-run wall clock **512–567 s**
against the 900 s budget. **Per PR: 646–653 s (~11 min)** — the two runs overlap rather than queue
end-to-end, which corrected an earlier ~964 s estimate. Session total 78.1 min for five PRs,
**8447 job-seconds**. `pull_request` runs are systematically **+41…53 s** slower than their paired
`push` runs (mean +46.8 s), and the mechanism is measured, not inferred: `Unit Tests` starts 1 s into
a `push` run and 50–56 s into a `pull_request` run, because the slots are already full.

⚠️ **Caveat Story 2.5 recorded against itself:** all ten runs were warm-cache inside one 78-minute
window at unusually low host load (2.88–4.38, versus 11–17 in Story 2.4). "Stable" is conditional on
that. Expect more spread if this story runs under normal load — and do not read a slower run as a
regression without checking the load.

### Anti-patterns for this story

- **Writing the rule before taking the rollback snapshot.** §2 — the snapshot is the whole safety net.
- **Trusting a 200 from the write.** §5 — read the rule back and compare field by field.
- **Closing AC1 without AC5.** §4 — the eight-context choice is an argument until the missing-context
  semantic is measured.
- **Retyping the eight strings from job names.** `epics.md:1236-1239` forbids it explicitly, and a
  single character's difference produces a gate that never goes green.
- **Choosing four `(pull_request)` contexts because the epic frames it as an option.** §3 — that is
  the falsely-green path, and run 286 is the counterexample.
- **`docker kill` or `docker exec … kill -9 1` for AC6.** §6 — both are recorded no-ops; you will
  measure nothing and think you measured failover.
- **Believing the API about runner state.** §6 — it reported `idle` for a runner the host showed
  `exited`.
- **Leaving the ninth context, the probe branch, the red PR, or a stopped runner behind.**
  Prohibitions 4 and 7.
- **Disabling the gate to merge the story's own closing commit.** §7, Prohibition 8.
- **Waiting for the full ~510 s red run before attempting AC3's merge.** §8 — `lint` fails at ~140 s
  and the gate blocks on the first failing required context.
- **Opening a PR from a pre-existing branch.** Prohibition 6 — ~497 of 501 route to `ci-hub`.

### Previous story intelligence

- **Story 2.5** delivered this story's entire evidence base: the eight strings, the stability proof,
  the budget number, the PR-flow mechanics, and the branch-protection snapshot. Its **code review
  reversed its own handoff** on the 497-branch hazard (§3) — the corrected version is what this story
  builds on. It also recorded the discipline this story inherits: declare the budget before spending,
  evidence from the database only, classify before continuing, and *"a subagent's report is not
  evidence until the coordinator re-runs the query"*.
- **Story 1.13** created the permissive `main` and `staging` rules on 2026-08-10 and chose
  `apply_to_admins: false` deliberately, *"to avoid locking out routine admin operations"*. **This
  story reverses that choice with Oleg's explicit decision of 2026-08-14** (§2) — note the reversal
  in the record rather than presenting `true` as though it were always the intent.
- **Story 1.9** proved failover and 2/2 distribution by **direct runner-log attribution**, not by
  elimination, and recorded the two stop methods that silently fail (§6). Its prohibition —
  *"Do not change runner 1"* — is relaxed here only for AC6's documented stop-and-revert.
- **Story 1.7** recorded the foreign-label hazard: *"a stray trigger lands on them immediately,
  because they are idle."*
- **Story 2.2** left `ci.yml` on `main` only, which is why a `staging`/`development` head produces no
  contexts at all (§3's side effect).

### Testing standards

**This story adds no tests and changes no test configuration.** The only file it creates under `src/`
is §8's throwaway lint-failure probe, which exists on a disposable branch, is never merged, and is
deleted in Task 5.5. The suite (228 files / 1921 tests) is exercised only as the thing the gate
measures.

### Project Structure Notes

Files this story is expected to touch:

- `_bmad-output/implementation-artifacts/2-6-…md` — this file (the primary deliverable).
- `_bmad-output/implementation-artifacts/deferred-work.md` — the handoff (Task 8.3).
- `docs/migration-decisions.md` — a **decision record**, not just a changelog row (Task 8.4).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status (Task 9.2).

Files this story must **not** touch: `.forgejo/workflows/ci.yml`, `.github/workflows/`,
`vitest.config.ts`, `package.json`, `package-lock.json`, anything under `src/` **on `main`**, and any
runner configuration beyond §6's stop-and-revert.

**The real deliverable is not a file — it is the state of the branch-protection rule on the server.**
The files record it. Both must agree at the end, and Task 3.3 is what makes that true.

### References

- `epics.md:1219-1256` — Story 2.6 and its five ACs, including the 2026-08-14 amendment
- `epics.md:1229-1239` — the amended AC1: eight contexts, the recorded reason, verification against
  `commit_status` rather than job names
- `epics.md:77-78` — FR4: direct pushes to `main` rejected; merges require passing checks
- `epics.md:198` — FR29: a second runner online before required checks are enabled
- `epics.md:390-401`, `:1059-1064` — Epic 2 and its implementation note on the single-runner freeze
- `epics.md:1196-1217` — Story 2.5, whose evidence this story consumes
- `sprint-change-proposal-2026-08-14.md` §4.3 — the amendment and its reasoning
- `2-5-…md:731-739` — the branch-protection snapshot and the observed field list
- `2-5-…md` — the eight contexts, the ten-run table, the budget, the review's reversal on the
  497-branch hazard, run 286
- `deferred-work.md:82-86` — no cancel endpoint
- `deferred-work.md:298-306` — token model and its file format
- `deferred-work.md:651-662` — job logs unretrievable
- `deferred-work.md` — "Handed to Story 2.6 by Story 2.5": the corrected hazard, the caveats, the
  `staging`/`development` side effect
- `migration-decisions.md#d7` — no action on GitHub, no mirror
- `migration-decisions.md#d8` — Forgejo capabilities; auto-cancel is the default
- `migration-decisions.md#d9` — `.forgejo/workflows/` suppresses legacy fallback, **per commit**
- `migration-decisions.md#d10`, `#d13` — the two runners; the `docker exec kill -9 1` no-op footnote
- `migration-decisions.md:572-579` — Story 1.13's branch-protection creation
- `1-9:83-86` — do not change runner 1; `1-9:224-252` — topology; `1-9:314-349` — the failover
  method, the restart timings, the stale API status; `1-9:376-389` — the 2/2 distribution evidence;
  `1-9:637-639` — host state
- `1-13-…md:629-642` — `apply_to_admins: false` chosen deliberately, and why

---

## Dev Agent Record

### Agent Model Used

_To be filled by the dev agent. Record the coordinator model and any subagent use; a subagent's
report is not evidence until the coordinator re-runs the load-bearing query itself._

### Debug Log References

#### Task 1.3 — Rollback snapshot (taken 2026-08-14 22:xx, before any write)

`GET /api/v1/repos/CRM/fe-prionex/branch_protections` → 200:

```json
[
  {"branch_name":"main","rule_name":"main","enable_push":true,"enable_push_whitelist":false,"push_whitelist_usernames":[],"push_whitelist_teams":[],"push_whitelist_deploy_keys":false,"enable_merge_whitelist":false,"merge_whitelist_usernames":[],"merge_whitelist_teams":[],"enable_status_check":false,"status_check_contexts":null,"required_approvals":0,"enable_approvals_whitelist":false,"approvals_whitelist_username":[],"approvals_whitelist_teams":[],"block_on_rejected_reviews":false,"block_on_official_review_requests":false,"block_on_outdated_branch":false,"dismiss_stale_approvals":false,"ignore_stale_approvals":false,"require_signed_commits":false,"protected_file_patterns":"","unprotected_file_patterns":"","apply_to_admins":false,"created_at":"2026-08-10T14:33:05+02:00","updated_at":"2026-08-10T14:33:05+02:00"},
  {"branch_name":"staging","rule_name":"staging","enable_push":true,"enable_push_whitelist":false,"push_whitelist_usernames":[],"push_whitelist_teams":[],"push_whitelist_deploy_keys":false,"enable_merge_whitelist":false,"merge_whitelist_usernames":[],"merge_whitelist_teams":[],"enable_status_check":false,"status_check_contexts":null,"required_approvals":0,"enable_approvals_whitelist":false,"approvals_whitelist_username":[],"approvals_whitelist_teams":[],"block_on_rejected_reviews":false,"block_on_official_review_requests":false,"block_on_outdated_branch":false,"dismiss_stale_approvals":false,"ignore_stale_approvals":false,"require_signed_commits":false,"protected_file_patterns":"","unprotected_file_patterns":"","apply_to_admins":false,"created_at":"2026-08-10T14:33:06+02:00","updated_at":"2026-08-10T14:33:06+02:00"}
]
```

Matches Story 2.5's `2-5-…md:731-739` snapshot exactly — `main` is unchanged since Story 1.13 created
it. `staging` is out of scope (Prohibition 3) and recorded only for completeness; it is never written.

**Rollback `PATCH` body for `main`, written before any write** (restores the four fields this story
changes):

```json
{
  "enable_status_check": false,
  "status_check_contexts": [],
  "enable_push": true,
  "apply_to_admins": false
}
```

Note: the live value of `status_check_contexts` is JSON `null`; `[]` is used in the rollback body
because the field may not accept a literal `null` on write — functionally equivalent given
`enable_status_check: false` makes the contexts list inert either way. If a literal `null` is ever
required, `DELETE` + re-`POST` of the exact snapshot body above is the fallback (§5).

#### Task 1.4 — repo_id and run-budget baseline

- `repository` row: `id = 16`, `owner_name = CRM`, `name = fe-prionex` — confirmed, matches story.
- `action_run`: `max(id) = 544`, `count(*) = 544` — matches Story 2.5's last recorded run id
  exactly. This is the pre-story baseline; every run this story creates has `id > 544`.

#### Task 1.5 — Eight context strings, re-derived from the database

Story 2.5's five head SHAs (`784d1cc9…`, `fb1e7351…`, `be0b5656…`, `20c7b2c1…`, `480df728…`) resolved
to full 40-char `commit_sha` via `action_run` (repo_id=16), then:

```sql
SELECT DISTINCT context, state FROM commit_status WHERE sha IN (<5 full SHAs>) ORDER BY context;
```

→ 16 rows (`pending` + `success` per context, transient rows included), collapsing to **exactly
eight distinct `context` values**, byte-identical to §3:

```
CI / Build (pull_request)
CI / Build (push)
CI / Lint (pull_request)
CI / Lint (push)
CI / Type Check (pull_request)
CI / Type Check (push)
CI / Unit Tests (pull_request)
CI / Unit Tests (push)
```

Confirmed: exactly eight, character-for-character match with §3. Task 1.5 gate passes — proceeding.

#### Task 1.6 — Runner identity and state (re-read, not assumed)

`action_runner` for `repo_id = 16`:

| id | name | labels | last_online (UTC) | last_active (UTC) |
|---|---|---|---|---|
| 15 | probe-runner | `["probe"]` | 2026-08-08 (stale) | 2026-08-08 |
| 18 | s1-fe-prionex-1 (old registration) | `["node-20","docker-build"]` | 2026-08-11 (stale) | 2026-08-11 |
| **19** | s1-fe-prionex-1 | `["node-20","docker-build"]` | 2026-08-14 20:10:53 | 2026-08-14 18:40:54 |
| **20** | s1-fe-prionex-2 | `["node-20","docker-build"]` | 2026-08-14 20:10:54 | 2026-08-14 18:43:12 |

Live runner ids are **19 and 20**, independently re-confirmed (ids 15 and 18 are stale prior
registrations, last seen 3–6 days ago, not candidates). Matches story's expectation but was verified,
not assumed.

Runner 1 (`forgejo-runner-fe-prionex`, runner id 19) container state **before** anything —
this is the Task 7.6 revert baseline:

```
Status=running Running=true RestartPolicy=unless-stopped Pid=906908 RestartCount=0
```

Runner 2 (`forgejo-runner-fe-prionex-2`, runner id 20):
`Status=running Running=true RestartPolicy=unless-stopped Pid=907898`

#### Task 1.7 — Host state on s1 (before any CI run this story creates)

```
load average: 7.48, 5.74, 5.08
Mem: 125Gi total, 43Gi used, 11Gi free, 73Gi buff/cache, 81Gi available
Swap: 8.0Gi total, 25Mi used
```

Between Story 2.5's window (2.88–4.38) and Story 2.4's (11–17) — moderate load, not the unusually
quiet window Story 2.5 ran in. Recorded per the anti-pattern note: a slower run this story observes
should be checked against this baseline before being read as a regression.

#### Task 2 — Declared budget and write list (before any write or run)

**2.1 — Expected runs, wall clock, API writes.**

| Test | PRs | Expected CI runs | Expected wall clock |
|---|---|---|---|
| AC3 (red probe PR) | 1 | 2 (push + pull_request) — run cannot be stopped once started (no cancel endpoint), full ~510 s completes even though merge is attempted at ~140 s | ~11 min to completion, ~140 s to attempt merge |
| AC4 (green real-change PR) | 1 | 2 | ~11 min |
| AC5 (ninth context) | 0 (reuses AC4's open PR) | **0 extra** | seconds (2 API round trips: PATCH + merge attempt) |
| AC6 (failover PR) | 1 | 2, at half capacity (2 slots not 4) | ~20–25 min |
| Closing PR (Task 7–9 record) | 1 | 2 | ~11 min |
| **Total** | **4 PRs** | **~8 runs** | **~55–70 min wall clock, session total** |

Every API write this story intends to make, declared before any of them happen:
1. `PATCH .../branch_protections/main` — set the gate (Task 3.1).
2. `git push origin main` — expected rejection (Task 5.1, AC2).
3. `POST .../pulls` × 4 — probe (AC3), real-change (AC4/AC5), failover (AC6), closing.
4. `POST .../pulls/{index}/merge` × 4 (one refused by design for AC3).
5. `PATCH .../branch_protections/main` — add the ninth context (Task 4.1), then remove it (Task 4.4).
6. `DELETE` on the probe branch ref (Task 5.5 branch cleanup) and on the AC6/closing branches after merge.
7. Host-side: `docker update --restart=no` then `kill -9 $PID` then `docker update --restart=unless-stopped` + `docker start` (Task 7, runner 1 only).

No write to `staging`/`development` protection, no write to `.forgejo/workflows/`, `.github/workflows/`,
runner config beyond the declared stop-and-revert, and no `required_approvals` or whitelist field.

**2.2 — Rollback trigger, stated explicitly.** Restore the Task 1.3 snapshot verbatim (PATCH the
rollback body above to `main`) if: (a) the `PATCH`/read-back in Task 3.3 shows stored fields
diverging from what was sent in a way that cannot be immediately corrected by re-sending; (b) AC2's
push succeeds when it should be rejected, indicating the gate is not active as configured, and the
cause is not immediately obvious; (c) this story's own closing PR is blocked by the gate for a reason
not anticipated (§7) — in that case the correct response is to record the finding, not to weaken the
gate, and roll back only if the story cannot otherwise be closed; (d) any lock-out state where no
further write can be made through the gate. Execution: a single `PATCH` with the body recorded in
Task 1.3 above, using the same token and route already proven reachable — no external help needed.

**2.3 — The real change AC4's and the closing PR carry.** Following Story 2.5's discipline (every PR
carries a change that would have been committed anyway — the story file's own record), this story's
own file (Dev Agent Record progress, Task checkboxes, Completion Notes) is the real change:
- **AC2's commit** (Task 5.1): the Task 1–3 progress recorded in this file so far (rollback snapshot,
  budget, gate configuration and read-back) — this has to reach `main` regardless of transport.
- **AC4's PR** (Task 6.1): continues the same file with Task 4/5/6 progress and evidence — the natural
  next chunk of the story's own record, exactly as Story 2.5 carried its own progress through five PRs.
- **AC6's PR** (Task 7): Task 7's failover evidence, same file.
- **The closing PR** (Task 9): Task 8/9 evidence, `deferred-work.md`'s handoff, and
  `docs/migration-decisions.md`'s new decision record, plus `sprint-status.yaml`.
No throwaway application code is committed to `main` at any point except AC3's disposable probe file,
which is deleted before the story ends (Prohibition 7).

#### Task 3 — Configure the gate (AC1)

**3.1 — `PATCH .../branch_protections/main`, request body:**

```json
{
  "enable_status_check": true,
  "status_check_contexts": [
    "CI / Lint (push)", "CI / Type Check (push)", "CI / Unit Tests (push)", "CI / Build (push)",
    "CI / Lint (pull_request)", "CI / Type Check (pull_request)", "CI / Unit Tests (pull_request)", "CI / Build (pull_request)"
  ],
  "enable_push": false,
  "apply_to_admins": true
}
```

**Response: HTTP 200.** `PATCH` is supported — no fallback needed, Task 3.2 not exercised:

```json
{"branch_name":"main","rule_name":"main","enable_push":false,"enable_push_whitelist":false,"push_whitelist_usernames":[],"push_whitelist_teams":[],"push_whitelist_deploy_keys":false,"enable_merge_whitelist":false,"merge_whitelist_usernames":[],"merge_whitelist_teams":[],"enable_status_check":true,"status_check_contexts":["CI / Lint (push)","CI / Type Check (push)","CI / Unit Tests (push)","CI / Build (push)","CI / Lint (pull_request)","CI / Type Check (pull_request)","CI / Unit Tests (pull_request)","CI / Build (pull_request)"],"required_approvals":0,"enable_approvals_whitelist":false,"approvals_whitelist_username":[],"approvals_whitelist_teams":[],"block_on_rejected_reviews":false,"block_on_official_review_requests":false,"block_on_outdated_branch":false,"dismiss_stale_approvals":false,"ignore_stale_approvals":false,"require_signed_commits":false,"protected_file_patterns":"","unprotected_file_patterns":"","apply_to_admins":true,"created_at":"2026-08-10T14:33:05+02:00","updated_at":"2026-08-14T22:13:01+02:00"}
```

**3.3 — independent `GET .../branch_protections/main` (separate call, not the PATCH response reused):**

Byte-identical to the PATCH response above. Field-by-field: `enable_push` false✓, `enable_status_check`
true✓, `status_check_contexts` the same 8 strings in the same order✓, `apply_to_admins` true✓,
`required_approvals` unchanged at 0✓, `enable_push_whitelist`/`enable_merge_whitelist`/
`require_signed_commits` unchanged at false✓, `rule_name`/`branch_name` unchanged✓. **No divergence
— the write stored exactly what was sent.**

**3.4 —** the 8 stored strings compared against Task 1.5's database rows: identical set, identical
spelling, identical spacing (`CI / <Job> (<event>)`). Byte-identical, confirmed.

#### Task 6.1–6.2 — Positive-test PR (AC4), opened and green

Branch `story-2-6/pr-1-review-fix-and-gate-config` cut from `origin/main` (`0ba3e7e3`), carrying two
real changes (§7, Task 2.3): Story 2.5's unpushed review-findings fix (`c8ddfbca`, was `694f6a06`
before rebase) and this story's own Task 1–5 record (rollback snapshot, budget, gate write/read-back,
AC2/AC3 evidence). PR opened via API → **HTTP 201**, **PR #9**, `head.sha =
4e0441b63466a2fc96eee3f80de50746357a748e`.

Two runs: `action_run.id 547` (`push`, `index 57`) and `548` (`pull_request`, `index 58`), both bound
to `4e0441b6…`. Both reached terminal state (`status = 1`, success) — `547` wall clock **600 s**,
`548` **601 s** (started 1786739661/1786739797, stopped 1786740261/1786740398 — Unix epoch seconds).
Slightly above Story 2.5's 512–567 s range but under the 900 s budget and consistent with the higher
host load recorded in Task 1.7 (7.48 vs Story 2.5's 2.88–4.38) — not read as a regression, per the
Dev Notes anti-pattern.

**All eight contexts `success`**, confirmed directly from `commit_status` (`DISTINCT ON (context)`,
latest row per context):

```
CI / Build (pull_request)       success
CI / Build (push)               success
CI / Lint (pull_request)        success
CI / Lint (push)                success
CI / Type Check (pull_request)  success
CI / Type Check (push)          success
CI / Unit Tests (pull_request)  success
CI / Unit Tests (push)          success
```

**Per-job runner attribution and duration**, joined `action_run_job.run_id → action_run.id` and
`action_task.job_id → action_run_job.id` (the first join attempt used `action_task.job_id =
action_run.id` directly, which happened to return plausible-looking numbers by coincidence — caught
and corrected before being recorded as evidence):

| run | job | attempt | runner_id | duration (s) |
|---|---|---|---|---|
| 547 (push) | Build | 1 | 19 | 111 |
| 547 (push) | Lint | 1 | 19 | 134 |
| 547 (push) | Type Check | 1 | 20 | 86 |
| 547 (push) | Unit Tests | 1 | 20 | 511 |
| 548 (pull_request) | Build | 1 | 19 | 109 |
| 548 (pull_request) | Lint | 1 | 19 | 134 |
| 548 (pull_request) | Type Check | 1 | 20 | 82 |
| 548 (pull_request) | Unit Tests | 1 | 19 | 509 |

All eight jobs `attempt = 1` — no reruns. Both runners (19, 20) drew jobs — this PR ran at full
two-runner capacity, before Task 7 stops runner 1. PR left **open** at this point — Task 6.3 hands it
to Task 4 for the ninth-context test before merging.

#### Task 4 — Prove the missing-context semantic (AC5) — the story's central finding

With PR #9 open and all eight contexts `success` (Task 6.2), `PATCH` added a ninth context that can
never exist:

```json
{"status_check_contexts": [
  "CI / Lint (push)", "CI / Type Check (push)", "CI / Unit Tests (push)", "CI / Build (push)",
  "CI / Lint (pull_request)", "CI / Type Check (pull_request)", "CI / Unit Tests (pull_request)", "CI / Build (pull_request)",
  "CI / Does Not Exist (push)"
]}
```

**HTTP 200**, and an independent `GET` confirmed all 9 strings stored verbatim, including the
impossible one.

**Merge attempt**, `POST /pulls/9/merge` with `{"Do":"merge"}`:

```
HTTP 405
{"message":"not allowed to merge [reason: Not all required status checks successful]","url":"https://git.crm-prionex.com/api/swagger"}
```

**Blocked** — byte-identical refusal message to AC3's red-check test. `GET /pulls/9` confirmed
`state: open`, `merged: false` immediately after. **The missing-context semantic holds: a required
context with no `commit_status` row blocks the merge exactly like a `failure` row does.** §3's design
is sound — the `(push)` half of the eight-context set is genuinely unforgeable by a stale branch, not
decoration. AC1's eight-context justification **stands**, established by direct measurement rather
than assumption.

Immediately after, `PATCH` removed the ninth context (request body: the original eight strings only,
`status_check_contexts` field only — no other field touched). Independent `GET` confirmed **exactly
eight** remain, byte-identical to Task 3's set, in the same order. No ninth context left behind.

#### Task 6.4–6.5 — Merge and post-merge check

`POST /pulls/9/merge` with `{"Do":"merge"}` after Task 4.4 restored the eight → **HTTP 200**.
Independent `GET /pulls/9` confirmed `state: closed`, `merged: true`, `merged_at:
2026-08-14T22:58:47+02:00`, `merge_commit_sha: 3fc7f92d5c6af47b7911b245a0662543971a16e2`,
`merged_by: platform-admin`. **AC4 satisfied**: a PR with all eight contexts green merged
successfully once the ninth-context probe was cleared.

Post-merge, queried `action_run` for `commit_sha = '3fc7f92d5c6af47b7911b245a0662543971a16e2'` (the
merge commit) → **0 rows**. No CI run was created for the merge to `main`, confirmed by SHA per Task
6.5 — `main` sits in `ci.yml`'s `branches-ignore`, consistent with every prior story's observation.

#### Task 7.1 — Runner 1 state before the stop, and the revert written down first

`docker inspect forgejo-runner-fe-prionex` (re-read fresh immediately before touching anything, not
reused from Task 1.6):

```
Status=running Running=true RestartPolicy=unless-stopped Pid=906908 RestartCount=0
StartedAt=2026-08-13T11:42:41.120223671Z
```

Unchanged from Task 1.6's baseline — same PID, same restart policy, `RestartCount: 0`. This is
runner id **19** (`s1-fe-prionex-1`), confirmed by the `/data/.runner` mapping in Task 1.6.

**Revert commands, written down before the stop, per §6:**

```
docker update --restart=unless-stopped forgejo-runner-fe-prionex
docker start forgejo-runner-fe-prionex
```

**Stop method, per §6 — host-side PID only, restart policy suspended first:**

```
docker update --restart=no forgejo-runner-fe-prionex
PID=$(docker inspect --format '{{.State.Pid}}' forgejo-runner-fe-prionex)
kill -9 $PID
docker inspect --format '{{.State.Status}} {{.State.ExitCode}}' forgejo-runner-fe-prionex   # expect: exited 137
```

`docker kill` and `docker exec … kill -9 1` are **not used** — both are recorded no-ops on this image
(Story 1.9, §6). Verification is by `docker inspect` throughout, never by the Forgejo API, which
Story 1.9 observed reporting stale `idle` for a host-dead runner.

#### Task 7.2 — Runner 1 stopped, confirmed by `docker inspect`

Executed exactly the sequence above: `docker update --restart=no`, PID read fresh as `906908`
(matching Task 7.1), `kill -9 906908`. **Result:** `Status=exited ExitCode=137 Running=false` —
signal 9 (128+9=137), confirmed by `docker inspect`, not the API. Runner 1 (id 19) is down. Task 7.3
opens the failover PR next, while only runner 20 is available.

### Completion Notes List

#### AC1 — why all eight contexts, not a four-context subset

The rule now requires all eight `CI / <job> (<event>)` contexts, not the four `(pull_request)`
contexts the epic originally floated as one of two named alternatives. The reason is a concrete
counterexample already sitting in the database: `action_run` id 286, run on 2026-08-10 against the
**legacy** `.github/workflows/CI.yml` — a file with the exact same workflow name (`CI`) and the exact
same four job names (`Lint`, `Type Check`, `Unit Tests`, `Build`) as the Forgejo-native workflow. That
legacy file executed on `ci-hub` (runner id 10, a different team's infrastructure) and wrote
`commit_status` rows with the identical context strings a `pull_request` run on our own runners would
produce — two of its four jobs came back `success`. If the gate only required the four
`(pull_request)` contexts, a PR opened from any of the ~497 stale branches that still carry the legacy
workflow could get a "green" gate from a run that never touched our own CI at all, on infrastructure
we don't control.

The four `(push)` contexts close that hole, because they cannot be forged the same way: the legacy
workflow's `push` trigger only fires on `main`, `staging`, `development`, so pushing a stale feature
branch produces no `(push)` contexts whatsoever. Requiring all eight means a stale branch can satisfy
at most half the gate — the half that was never protective to begin with — and is blocked by the
other half. That's the whole argument: eight contexts isn't "more caution," it's the minimum set that
actually distinguishes "our CI ran and passed" from "some CI with the same job names ran somewhere."

Verified: `enable_status_check: true`, all eight strings present, taken from `commit_status` (Task
1.5) rather than retyped from job names, and the write was read back independently (Task 3.3) and
matched field by field. `apply_to_admins: true` per Oleg's 2026-08-14 decision (§2) — the rule now
binds every identity, including the one this story's own token uses.

#### AC2 — direct push to `main` rejected

Committed this file's Task 1–3 progress (`9c9763ec`) directly on local `main` (the commit had to
reach `main` regardless of transport), then `git push origin main`. Also carried forward a genuine
pre-existing unpushed commit (`694f6a06`, Story 2.5's review-findings fix, sitting on local `main`
since before this story started, local ahead of `origin/main` by one commit at session start) — both
commits were subject to the same push attempt.

**Server response:**
```
remote: Forgejo: Not allowed to push to protected branch main
remote:
To ssh://git.crm-prionex.com:2222/CRM/fe-prionex.git
 ! [remote rejected]   main -> main (pre-receive hook declined)
error: failed to push some refs to 'ssh://git.crm-prionex.com:2222/CRM/fe-prionex.git'
```

Rejected as expected, by the server's pre-receive hook — not a client-side refusal. `enable_push:
false` + `apply_to_admins: true` blocks the project's own token exactly as designed; no exemption.
Per Task 5.1's contingency, local `main` was reset to `origin/main` and both commits were carried
forward by cherry-pick onto branch `story-2-6/pr-1-review-fix-and-gate-config` (cut from
`origin/main`), which becomes Task 6's real-change PR. Nothing lost, nothing written twice.

#### AC3 — pull request with a failing required check cannot be merged

Probe branch `story-2-6/probe-ac3-red-check` cut from `origin/main` (`0ba3e7e3`), one throwaway file
`src/__probe_ac3__/probe.ts` with an unused top-level binding. Pushed and PR opened via API →
**HTTP 201**, PR #8, `index = 8`, `head.sha = 7a6e78f38a5c203831c35f2c850c255e9b9c4d0a`.

Two runs created: `action_run.id 545` (`push`, index 55) and `546` (`pull_request`, index 56), both
bound to `7a6e78f3…`. Polled `commit_status` every 10 s; `CI / Lint (push)` reached `failure` at
~80 s (well inside the ~140 s estimate) — confirmed via direct query, one of the eight required
contexts. (`CI / Type Check (push)` and `CI / Build (push)` also failed shortly after, since the
unused binding trips `tsc`'s `noUnusedLocals` too — extra, not required, evidence that the check is
real.)

**Merge attempt**, `POST /pulls/8/merge` with `{"Do":"merge"}`:

```
HTTP 405
{"message":"not allowed to merge [reason: Not all required status checks successful]","url":"https://git.crm-prionex.com/api/swagger"}
```

Refusal confirmed, and the reason string names required status checks explicitly — not a generic
conflict or permission error. Cleaned up: PR #8 closed via `PATCH {"state":"closed"}` (verified
`state: closed`, `merged: false`), remote branch deleted (`DELETE .../branches/...` → `204`), local
branch deleted, `git fetch --prune` confirms the remote ref is gone. `git ls-tree -r origin/main`
confirms `src/__probe_ac3__/` exists nowhere on `main`.

**Note on local hooks vs. the probe:** the repo's local `pre-commit` and `pre-push` hooks run the same
`lint --max-warnings=0` / `tsc -b` checks CI does, so they also reject the probe file — by design,
since it exists solely to fail those checks. `git commit --no-verify` and `git push --no-verify` were
used for this one disposable, never-merged probe commit only; every other commit and push in this
story went through the hooks normally. This is the deliberate mechanism §8 describes, not a
shortcut around review — the whole point of AC3 is a commit that fails these exact checks remotely.

#### AC4 — a pull request with all required checks green merges

PR #9 (`story-2-6/pr-1-review-fix-and-gate-config` → `main`), all eight contexts `success` (Task
6.2), merged via `POST /pulls/9/merge` → **HTTP 200**; confirmed by independent `GET`: `merged:
true`, `merge_commit_sha: 3fc7f92d…`. Post-merge, `action_run` has zero rows for that SHA — the merge
itself triggered no CI run (`main` is in `branches-ignore`). Run ids 547/548, contexts and per-job
runner attribution are in the Task 6.1–6.2 Debug Log entry above.

#### AC5 — the missing-context semantic, measured (this story's central finding)

**Verdict: BLOCKED.** A required context with no `commit_status` row blocks the merge, exactly like a
`failure` row does — Forgejo does not treat "never ran" as "not applicable." Full evidence in the
Task 4 Debug Log entry above: ninth context `CI / Does Not Exist (push)` added to the eight while
PR #9 sat fully green, merge attempted, refused with the identical `405` / "Not all required status
checks successful" message AC3 produced for an actual failure. Ninth context removed and verified
gone within the same round trip.

**What this means for AC1.** §4 stated plainly: everything in §3 rests on this semantic being true.
It is. That means the `(push)` half of the eight-context set is genuinely unforgeable by a stale
branch carrying only the legacy workflow — a stale branch produces zero `(push)` contexts, and zero
now provably blocks rather than being silently ignored. AC1's eight-context justification is
**established**, not merely argued. Had the merge instead succeeded, this would be the opposite
report: a finding for Oleg that the entire gate design admits the 497-branch hazard regardless of
context count, and AC1 would be recorded as not established. That branch did not occur.

_AC6 notes follow as Task 7 completes below._

### File List

_Every file touched, with status. Confirm the throwaway `src/` probe file is absent from `main`._

---

## Open Questions for Review

### Blocking

_None at creation time. `apply_to_admins` was the one blocking decision and Oleg resolved it on
2026-08-14 (§2): **`true`**._

### Non-blocking

1. **AC5 could invalidate AC1's reasoning.** If a missing context does not block, the eight-context
   set defends against nothing and the 497-branch hazard is wide open under any gate. That is a
   finding for Oleg, and possibly a new story, not something this story can resolve.
2. **The 497 stale branches still have no owner.** Story 2.2's Open Question 6 asked for one and
   still has none. This story makes the hazard *material* rather than theoretical: before today a
   stale-branch PR was merely untidy; after today it interacts with a merge gate.
3. **Every commit to `main` now costs two CI runs.** Nothing owns runs-per-day on a shared host —
   Story 2.2's Open Question 7, still unassigned. The gate raises the floor.
4. **`staging` and `development` keep permissive rules**, and `development` has none at all. Out of
   scope here, but the asymmetry is now sharper: `main` is gated and its neighbours are not.
5. **Story 2.5's stability evidence is warm-cache from one low-load window.** The gate is now built
   on it. If CI turns out flakier under normal load, merges block at random — which is precisely the
   delivery outage Story 2.5 existed to prevent.
