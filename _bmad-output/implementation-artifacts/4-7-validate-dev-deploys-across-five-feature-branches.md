---
baseline_commit: 0d4b6dfc1fc86f00104755455f0ba4cec3dab0d2
---

# Story 4.7: Validate DEV Deploys Across Five Feature Branches

Status: ready-for-dev

<!--
Contexted 2026-08-21 against `main` at `0d4b6dfc` (merge of PR #69, Story 4.6 closeout), on branch
`story-4-7/pr-1-context`. Every autonomous decision in this file is marked "autonomous, subject to
Oleg's veto" and is listed together in Dev Notes §11 so a veto costs one read, not a re-derivation.

🔴 THE STORY'S HEADLINE PREMISE IS FALSE AS WRITTEN, AND THE CORRECTION IS THE FIRST FINDING:
"five different REAL feature branches" cannot be satisfied by any of the 201 `feature/*` branches
on `origin`. Every one of them predates Story 4.1, none carries `docker-compose.stand.yml`, and
`deploy-dev.yml:1057-1062` refuses by name. See §2 — it is not a nuance, it decides the whole shape
of the story.
-->

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> **This story builds nothing, and that is the only thing protecting it.** Every mechanism it
> exercises — the digest deploy, the preflight ladder, the honest classifiers, the serialization
> lock, the weekly reset — is already live, already reviewed, already proven on a run that failed as
> well as one that passed. What is left is a measurement, and a measurement's characteristic failure
> is not missing the target: it is **producing a table of five green rows that do not mean what the
> table's own header claims.** Story 4.6 spent 39 runs against a ~20-24 floor because a four-line
> *evidence* step — not the mechanism, the step that checked it — took four live attempts to get
> right. This story's entire budget defence is that it introduces no such step. Every number in it
> comes from a channel that already works.
>
> **Everything that makes this story hard is in §1-§12. Read them before the ACs.**

---

## Story

As a tech lead,
I want evidence that the new DEV path works on real branches within the time budget,
so that cutover is a decision based on observation rather than optimism.

---

## 🚨 Read this before anything else

### 1. What this story actually is, and what it is forbidden from becoming

Nothing here needs to be built. `deploy-dev.yml` is 1875 lines, shipped by Story 4.3 and hardened by
Story 4.4's six ACs and two code-review rounds; `dev-reset.yml` is 760 lines, armed on `main`, with
its schedule proven live at five probe firings and one green armed composition (run 1099 → 1100).
The epic's remaining deploy work — factoring the shared mechanics — is **Story 4.8**, next.

So this story is not *"make DEV deploys work"*. It is **"deploy five times, under conditions that
make five green rows mean something, and record what happened."** The value is entirely in the
conditions and in the honesty of the recording.

🔴 **The constraint that follows, and it is a prohibition, not a preference: this story adds NO new
mechanism.** Not a rollback path, not a new guard, not a new evidence step inside a workflow, not a
"small" helper in a `run:` body. Story 4.6's own closeout priced what that costs
(`4-6-…md:1841-1855`): *"when adding a verification/evidence step (not the main mechanism) to an
already-hardened file, prefer the narrowest possible extraction … the evidence step's own job is to
be MORE robust than the mechanism it verifies."* Twenty-three of that story's 39 runs went to a
four-line evidence step that was not in its budget because it did not exist when the budget was
written.

**Any gap this story finds is RECORDED for Story 4.8, not patched mid-validation.** The one
exception, stated so it cannot be stretched: `correct-course` if — and only if — a discovered defect
**blocks the validation itself** (i.e. no five green deploys are obtainable without it). A defect
that merely makes the result less pretty is a finding. Autonomous, subject to Oleg's veto.

### 2. 🔴 "Five real feature branches" is UNSATISFIABLE as written — and the reason is in the deploy job

`epics.md:1981-1984` reads *"When five different **real** feature branches are deployed / Then all
five succeed."* Read literally that means five of the branches sitting on `origin` today. **Zero of
them can deploy.**

`deploy-dev.yml:1057-1062`, the step that obtains the compose file *at the deployed ref*:

```
if ! test -f "${CHECKOUT_DIR}/docker-compose.stand.yml"; then
  echo "FAIL: docker-compose.stand.yml not found at ref '${REF_IN}' (HEAD ${HEAD_SHA})."\
       "This ref predates Story 4.1's parameterized compose file, or the file was"\
       "removed/renamed at this ref."
  exit 1
fi
```

`docker-compose.stand.yml` was **added by Story 4.1**, commit `e74e9ded`, 2026-08-19. Measured at
`0d4b6dfc` across all 525 remote refs: the file exists on `main` and on the eleven `story-4-*`
branches, **and on nothing else**. The repository carries **201** `origin/feature/*` branches; the
newest ordinary feature branch is `feature/KAN-978-dismiss-on-colleague-answer` @ 2026-08-06, two
weeks before `docker-compose.stand.yml` existed.

There is a second, independent wall behind that one. `deploy-dev.yml:1071-1082` compares the pulled
image's `org.opencontainers.image.revision` against the SHA the checkout just fetched and **fails on
mismatch** — so the image must be built from *exactly* the commit being deployed. And a third:
`-dev` tags are not in the registry's `keep_pattern` and expire at **14 days**
(`deploy-dev.yml:938-939`), so even a branch that had been built in the Forgejo era would now 404.

**Binding definition for this story. A branch counts as *real* when all five hold** (shape borrowed
deliberately from Story 2.5 §2, `2-5-…md:65-74`, which met the same wall for the same reason):

1. It is cut from **`main` at the story's `baseline_commit`** — so it carries
   `docker-compose.stand.yml` and is deployable at all.
2. Its name follows **this repository's own live branch convention**, including the uppercase
   ticket-key shape the team actually uses (`feature/KAN-847-…`, `feature/SPRINT-04-68-…`) — not a
   `probe/` or `test/` name.
3. It carries **a change with independent value** — replayed from an actual historical feature
   branch where the diff applies cleanly and passes CI locally, and drawn from this project's own
   documentation/tracking artefacts otherwise. **One change per branch. Do not batch, do not pad.**
4. Its image is built by **the ordinary automatic path** — `ci.yml` on push → `image` job →
   `build.yml` — not by a hand-dispatched build. This is how a developer actually gets an image.
5. It is **deployed but not merged.** Epic 4's whole premise is deploying a branch *without* asking
   anyone; merging it would test a different claim.

🔴 **This is a deviation from the epic's literal wording and it is stated, not hidden.** Record it in
the Completion Notes with this reasoning (Task 9.2). Do not quietly redefine "real" downward, and do
not claim the literal reading was met. **What is specifically NOT met:** these are not five branches
a developer independently authored in the course of unrelated work. That supply does not exist on
Forgejo yet — the team still works on GitHub, there is no PR/branch mirror in either direction (D7),
and Epic 7 is where that lands. What *is* met: five distinct branches, five distinct images, five
distinct refs, through the identical unmodified pipeline, on the real stand.

**Argue the mix per branch, in writing.** Target — autonomous, subject to Oleg's veto — is **three
replayed from real historical feature branches, two from project artefacts**; if fewer than three
replays apply cleanly and pass locally, take fewer and say so. A replay that needs conflict
resolution or a test edit is not a replay: drop it and pick another.

🔴 **At least one of the five must carry an uppercase ticket key** — see §11, it closes an inherited
open question for free.

### 3. 🔴 The five must be five runs of the SAME pipeline, or they are not five

"Five deploys succeeded" is a claim about **one pipeline behaving the same way five times.** If
`deploy-dev.yml`, `ci.yml`, `build.yml`, `docker-compose.stand.yml` or the stand's own `.env` on s1
changes between deploy 2 and deploy 3, then deploys 1-2 measured one pipeline and 3-5 measured a
different one, and the sequence is worth nothing.

**Rule: any change to the deploy pipeline, to the compose file, or to the stand's host-side state
resets the count to zero.** If such a change becomes genuinely necessary mid-story, that is a
finding under §1: make the change, record why, and start the count over from one.

Prove it the way Story 2.5's review proved it — by **object identity**, not by "nothing was touched"
(`2-5-…md:1061-1067`): record the git blob hash of `.forgejo/workflows/deploy-dev.yml` and of
`docker-compose.stand.yml` at each of the five deployed refs and at `main`. Six refs, one distinct
value each. Anything else and the sequence restarts.

⚠️ **One thing outside your control can reset it: the Sunday 02:00 UTC reset.** See §12.

### 4. 🔴 AC2's clock: the naive measure makes the AC unfalsifiable

`deploy-dev.yml:752` sets `timeout-minutes: 10` on the `deploy` job. NFR2 is *"a DEV feature-branch
deploy completes in < 10 minutes"* (`epics.md:313`). **Measuring AC2 by the `deploy` job's own
duration therefore proves nothing:** a job that exceeds ten minutes is killed and reports failure, so
AC1 ("all five succeed") would already imply AC2, and the row could never fail. That is exactly the
false-positive class this project has caught three times (Story 1.3's capacity-2 probe, Story 3.6 in
validation, Story 4.4's AC3 amendment).

**Binding measure for AC2 — autonomous, subject to Oleg's veto:**

| Measure | Source | Role |
|---|---|---|
| **Run wall-clock** = `action_run.stopped − action_run.started` | Postgres, per run | 🔴 **THE VERDICT.** Includes the parallel ladder jobs and any queueing on the `capacity: 1` runner. This is the only one that *can* exceed 600 s while the run still reports success. |
| Deploy-job duration | `action_run_job` for the `deploy` job | Comparison against 4.4's measured uncontended baseline of **~21-22 s** (`4-4-…md:2128-2131`) |
| The workflow's own figure | the `Record wall-clock duration` step (`deploy-dev.yml:1853`), read from the task log | Cross-check; it measures step-1 to last-step *inside* the job |
| Per-step attribution | `action_task_step` + the zstd task log's per-line timestamps | §6 — the dominant-step requirement |

State pass/fail **per run against 600 s**, never on an average (`2-5-…md:416`, and its review's own
correction at `:1128-1136`). Report min, max, mean, and label the mean *reported for completeness*.
Label every number **measured, not computed**; arithmetic performed on top of direct reads is
arithmetic and must say so (`2-5-…md:1180-1182`).

🔴 **The epic's second clause is widened here, deliberately.** `epics.md:1989` asks for a dominant
step only for *"any deploy that exceeded the budget"* — which, given the measured ~21-22 s baseline,
is almost certainly none, leaving the clause vacuously closed and the number nobody has ever
measured still unmeasured. Story 4.3 owed this attribution and never produced it
(`4-3-…md:239-241` asked for it; no note in that file attributes time to pull vs. health-check vs.
`down`). **Attribute the dominant step for all five, not only for overruns.** It is now free — see
§5 — and it is the single most useful number this story can hand to Story 4.8, which will move these
steps into a shared definition and needs to know which of them costs anything.

The only candidate dominators that exist in the code: the `timeout 300` bounded pull
(`deploy-dev.yml:964`), the `timeout 300` bounded checkout fallback (`:1038`), and the **120 s**
bounded health poll (`:1542`). Nobody has measured which one wins on a cold image.

### 5. Evidence is cheap now — two capabilities that did not exist when 4.3 and 4.4 were written

Both were found during Story 4.6 and neither has been used by a story that planned around it. 4.7 is
the first adopter, and this is the reason it can promise per-step attribution at zero dispatch cost.

**(a) Job and step logs ARE readable.** The standing "logs are not retrievable" finding — which
shaped four stories' evidence strategies and forced the job-list-as-evidence contortions of 4.3 and
4.4 — was true only of the channels tried (the runs API, `$GITHUB_OUTPUT`). `action_task.log_filename`
/ `log_in_storage` point at a zstd file on local disk:

```
/opt/forgejo/forgejo/gitea/actions_log/<owner>/<repo>/<shard>/<task_id>.log.zst
```

read over SSH with `zstd -d`. One JSON object per line, step output in `content`, **timestamped per
line** — which is what makes per-step attribution possible. Confirmed live on run 1072's task
(id 9149), matching the DB-derived facts exactly (`deferred-work.md:2999-3008`).

Three caveats to carry, not rediscover:
- The shard is **not derivable by hand** — read it from `action_task.log_filename`.
- Persistence is **delayed, not immediate**. Check `log_in_storage` first; it is one query
  (`deferred-work.md:1760`).
- A single stdout line is truncated at **~64 KB** (`4-6-…md:2176-2179`). Do not plan to read back a
  large blob; you are reading step timestamps and short classifier messages, both far under it.

**(b) Forgejo's Postgres is directly queryable, read-only:**

```
ssh root@10.67.0.1 'docker exec forgejo-postgres psql -U forgejo -d forgejo -c "<SQL>"'
```

`CRM/fe-prionex` is **`repo_id = 16`**. `action_run.id` is a **single instance-wide increasing
sequence**, which is what makes "everything above the baseline id" a valid ledger rule. Columns this
story needs: `action_run(id, index, workflow_id, ref, event, trigger_event, trigger_user_id, status,
started, stopped, created, concurrency_group, concurrency_type, pre_execution_error_details)`;
`action_run_job(started, stopped, status, runner_id)`; `action_task(id, log_filename,
log_in_storage)`; `action_task_step(status)` where `1`=SUCCESS, `2`=FAILURE, `4`=SKIPPED.

🔴 **One contradiction in the record to settle rather than inherit:** `4-6-…md:1046` says *"the
Forgejo database is on a different host from s1"*, while every query in that same story runs as
`docker exec forgejo-postgres …` over SSH **to s1**. Task 1.3 states which host it actually reached.

🔴 **`id` vs `index`.** Every "run number" quoted anywhere in this repository is the global
`action_run.id`, not the per-repository `index` the web route takes. Querying by `index` for those
numbers returns zero rows. **Record both columns for every run this story creates.**

### 6. Per-step attribution — the method, spelled out so it is not improvised

For each of the five deploy runs:

1. `select id, log_filename, log_in_storage from action_task where …` for the `deploy` job's task.
2. If `log_in_storage` is false, wait and re-query — do not conclude the log does not exist.
3. `zstd -dc <path>` on s1, read the per-line timestamps, and compute the elapsed time **between
   consecutive step boundaries**.
4. Cross-check the total against `action_run_job`'s own `started`/`stopped` for that job, and
   against the workflow's own `Record wall-clock duration` line. Three sources; if they disagree by
   more than a second or two, **that disagreement is the finding** — record it, do not average it.

Do not add a timing step to the workflow. §1.

### 7. 🔴 AC3 is about a machine this session cannot reach — discharge it, do not fake it

`epics.md:1991-1994` asks that after a week of parallel operation the legacy DEV stand *"is still
running, still on its original port, and was never modified"* and that *"the developers using it
report no disruption."* Three separate problems, and the precedent for handling them is Story 4.2's
own AC5 (`4-2-…md:460-471`): **recording the substitution is the deliverable.**

1. **Wrong host.** The legacy DEV stand is on `72.62.17.132`. s1 is `185.185.49.127` (reachable from
   a dev session only as `root@10.67.0.1`). The legacy host is unreachable from here, and Story
   4.1's verdict (b) — made permanent by Oleg's 2026-08-19 «GitHub не трогаем» — forbids touching
   the GitHub deploy path that owns it. **Reporting "both stands healthy" is the failure mode this
   project has already been bitten by twice.**
2. **"A week in parallel"** is a calendar gate this story cannot span. State the observation window
   this story actually covers, in hours, and hand the week-long clause to a named owner.
3. **"Developers report no disruption"** requires a human. It is Oleg's, and it is not this story's
   to assert.

**What IS provable, and it is not nothing** — this is what AC3 is narrowed to:

- **By diff, not by intention** (the 4.6 Task 9.3 shape, `4-6-…md:962-976`): the story's whole diff
  contains nothing under `.github/`, no edit to `docker-compose.server.yml`, `nginx.conf`,
  `Dockerfile.prod` or `.env.dev.example`, and **no host literal that could reach `72.62.17.132`**.
- **The real NFR5 exposure on s1 is multi-tenancy, not the legacy stand.** s1 carries ~185
  containers under `name=crm-`, including the runner the deploy job runs inside. Capture every
  neighbour's `Created`/`StartedAt` **before the first deploy and after the last**, and prove none
  moved. This is the check that would actually catch the disaster — a `docker rm -f` or a
  `network rm` crossing stands (D27 `:2864-2865`: `docker rm -f <name>` works by name and ignores
  the compose project) — and no story has yet run it across five deploys.
- **Name anchoring, still live.** s1 holds no container named `fe-prionex` (the literal `CD.yml:201`
  force-removes on every legacy deploy). Assert it anchored at both ends; an unanchored
  `name=fe-prionex` filter matches **five** containers on s1 (`4-3-…md:534-547`).
- **`crm-dev-network`'s id unchanged** across all five — the workflow already checks this per run
  (`deploy-dev.yml:1500`); collect it as a series, not as five independent assertions.

### 8. 🔴 AC4 is narrower than it sounds, and this story does not widen it

`epics.md:1996-1999`: a branch with no built image *"fails fast with a message naming the missing
tag / And the stand keeps serving its previous version."*

The first half is structurally guaranteed and cheap. The tag→404 classifier
(`deploy-dev.yml:934-941`) fires in the **digest-resolve** step, which sits **five steps before**
`docker compose down` (`:1453`). Story 4.3 reordered the sequence to `resolve → pull → down → up -d
→ health` *specifically because of this AC* (`4-3-…md:76-83`) — a `down` before the pull would leave
the stand stopped when the pull failed.

The second half is **not** guaranteed, and this is the inherited debt. Story 4.3's code review, H5
(`4-3-…md:1639-1654`; `deferred-work.md:2824-2835`):

> Once `down` at `deploy-dev.yml:542` has run, six later steps can fail — `up -d`, the health poll,
> the anchored check, the fallback HTTP check, AC6, the Kong guard — and each leaves the stand
> stopped or unhealthy: the previous container is already removed, the previous digest was never
> captured, and there is no `if: failure()` path to restore it. **Run 937 is the live proof** — the
> stand stayed genuinely unhealthy until run 938 was dispatched by hand. Story 4.7 AC4 (*"the stand
> keeps serving its previous version"*) therefore holds for exactly one of the several ways this
> deploy can fail. … **Owner: Story 4.7 (the AC that requires it) / Story 4.8 (shared mechanics).**

⚠️ **The `:542` in that quote is the line `down` occupied when the entry was written**, before Story
4.4 added ~670 lines above it. At `baseline_commit`, `down` is at **`:1453`**. The quote is
reproduced verbatim, as this project's convention requires — do not "fix" its line number and do not
follow it to line 542.

**Decision, autonomous and subject to Oleg's veto: Story 4.7 does NOT implement the rollback, and
AC4 is narrowed in writing to the window it actually covers.** Three reasons, stated so a reviewer
can attack them:

1. A `if: failure()` digest-capture-and-restore path is a **new mechanism** in an already-hardened
   file, which §1 forbids and 4.6 priced.
2. Its live outcome matrix (retro-E5) would require deliberately breaking the stand after `down` and
   then repairing it — a red dispatch plus a repair dispatch, in a story whose deliverable is five
   *green* ones, and whose §3 rule says a mid-story change to the pipeline resets the count to zero.
3. **The evidence already exists and re-earning it would buy nothing.** Run 937 is the live proof
   that the post-`down` window has no recovery; run 938 is the live proof that a human dispatch is
   what fixes it.

The mechanism is therefore routed **wholly to Story 4.8**, which owns the shared definition where a
rollback would naturally live. Task 9.4 amends `deferred-work.md` (append under the original, never
rewrite in place — the file's own convention) to record that the joint ownership is resolved.

⚠️ **And the workflow header's own framing is already fixed, so do not validate against the wrong
sentence.** H5's patch half corrected the blanket claim *"nothing is torn down until the replacement
image is provably present"* in `deploy-dev.yml`'s header and in D29 §5. Validate against the code,
not against a sentence.

**How to stage the 404 row, at zero pushes.** Do **not** reuse Story 4.3's run-948 recipe (a raw
40-char SHA). Review M2 changed the sanitizer so a bare 7-40-hex ref now maps to
`sha-<12hex>-dev` — build.yml's own publishing form — which for a real historical commit **might
actually exist**, and the row would silently become a success. Use instead **one of the 201 real,
never-built `feature/*` branches** (§2's own wall, turned into an asset): it exists in git, its
derived tag was never published, and the 404 fires at digest-resolve before the checkout step could
ever complain about the missing compose file. One dispatch, no push, no branch created.

### 9. 🔴 AC5 — DF2, and why timing can never close it

Assigned to this story by the Story 4.6 code review (`deferred-work.md:3040-3052`):

> **DF2 — a shared concurrency group may make the SCHEDULED run the evictable party, and this
> instance's pending-queue semantics under contention have never been measured separately from
> `capacity: 1`.** … Under GitHub-compatible semantics at most one run per group may be *pending*,
> and a newer arrival evicts the older pending one — so a Sunday 02:00 firing that queues behind an
> in-flight human deploy could be cancelled by a second human dispatch, silently, with no retry
> until the following Sunday (and, per the story's own H2 finding, with nobody told). … **Owner:
> Story 4.7** (five-branch validation).

Both `deploy-dev.yml:197-199` and `dev-reset.yml:156-158` declare the identical literal group
`deploy-dev-fe-prionex-dev` with `cancel-in-progress: false`.

🔴 **The trap: this cannot be closed by timing, and five green sequential deploys close nothing.**
`deploy-dev.yml:181-190` and D30 §1 concede it outright — on a `capacity: 1` runner, "queued by
concurrency group" and "queued for a free slot" produce **identical timestamps**. Reading one as the
other is precisely the false positive Story 4.4's AC3 amendment exists to prevent. The discriminator
is the **database**: `action_run.concurrency_group` / `concurrency_type` (`1` = explicit group,
`0` = auto) and the terminal `status` of a run that never produced a job.

**Measurement design — autonomous, subject to Oleg's veto. Three dispatches, zero stand risk beyond
one ordinary main deploy:**

| # | Dispatch | Why it is safe |
|---|---|---|
| D1 | `deploy-dev.yml`, `ref=main`, defaults | An ordinary deploy of the image the stand should be serving anyway; occupies the group for its whole run (~60-190 s at run level) |
| D2 | `deploy-dev.yml`, `hold_lock_seconds=5`, fired while D1 is in flight | The `hold-lock` job **does not deploy** — `preflight`'s complementary `if:` cascade-skips the whole ladder. Its holder lives 5 s |
| D3 | identical to D2, fired immediately after D2 | Same |

Prediction under GitHub-compatible semantics: D2 goes *pending*, D3 arrives, **D2 is evicted** and
D3 takes its place. Read the answer from `action_run` for all three ids: `status`, `started`,
`stopped`, `concurrency_group`, `concurrency_type`, and whether D2 ever produced an
`action_run_job` row.

Three things this one probe buys:

- **DF2 itself**, in whichever direction it lands. If eviction is confirmed, the Sunday reset **can**
  be silently dropped — a finding for Stories 4.5/4.6/4.8, recorded, not patched here.
- **Story 4.4's AC1**, which shipped UNPROVEN because that session had no path to the Forgejo DB
  (`deferred-work.md:2909-2923`); its own recorded-but-never-executed query is
  `SELECT concurrency_group, concurrency_type FROM action_run WHERE id IN (…)`. Free by-product.
- **Queue depth beyond two**, never probed on this instance (`deferred-work.md:2924-2936`, owner 4.8)
  — partial, and say so: three is not "depth", it is depth three.

If the DB is unreachable, the row closes with the literal word **UNPROVEN**, the way 4.4 closed its
AC1. An honest UNPROVEN is worth more than an inferred PASS.

### 10. What five branches cost, what the story costs, and why nothing here can be undone

Structural facts, all measured by earlier stories, none assumed:

- **A push to a branch with no open PR costs 1 `action_run` row.** `ci.yml`'s `image` job expands
  `build.yml` through `uses:` and creates **no second row** (measured across five pushes in 4.1;
  `4-6-…md:1333-1334`). So one push per branch buys the CI gate *and* the image.
- **A push to a branch with an OPEN PR costs 2** — `push` plus `pull_request: synchronize`.
- **Opening a PR costs 1**; **merging costs 1** (`build-main.yml`).
- Every ledger in this project has been *structurally capable* of undercounting by two, because the
  declaration form counts pushes and forgets the PR-open and merge rows
  (`deferred-work.md:2513-2519`). Both are declared here as their own lines.
- **A cancelled or evicted run still occupies a row and is still a spend** (`deferred-work.md:2534-2536`).
- **There is no cancel endpoint on this instance** (`deferred-work.md:94-98`, 404 against the full
  swagger). A dispatch issued by mistake runs to completion. **Declare before spending.**
- CI cost per branch push, measured: Lint 143 s, Type Check 86 s, Unit Tests 467 s, Build 113 s,
  ~540 s wall clock (`ci.yml:6-16`), plus the image job.
- Deploy cost, measured: `deploy` job **~21-22 s** uncontended (`4-4-…md:2128-2131`); ~146 s
  contended; run level ~60 s in 4.3's coarser reading.

**Zero-dispatch conversion, declared up front** (4.4's demonstrated practice: six of seven causes
converted, zero red dispatches). Everything that could make a deploy red here is settleable *before*
any dispatch, and Task 2 does exactly that:

| # | Cause a deploy could go red | Converted how — zero dispatches |
|---|---|---|
| 1 | Branch content fails CI, so no image is built | Already enforced by the repo: `.husky/pre-commit` runs `format:check`, `lint --max-warnings=0`, `typecheck` and `test:run` on **every** commit, and `.husky/pre-push` adds `npm run build` — CI parity by construction, ~2-8 min per commit. **Do not `--no-verify`.** |
| 2 | Tag derivation mismatch between builder and deployer | Replay both sanitizers (`build.yml:850-851`, `deploy-dev.yml:797`) byte-for-byte against the five chosen names; assert identical output |
| 3 | Mixed-case tag not resolvable by the deployer | One `curl` against the registry manifest endpoint from s1 with the read-only credential, in both spellings (§11) |
| 4 | `docker-compose.stand.yml` absent at the ref | `git cat-file -e <ref>:docker-compose.stand.yml` for all five |
| 5 | `org.opencontainers.image.revision` ≠ checkout HEAD | Read the label off the published image and compare to the branch tip SHA |
| 6 | Registry credential outage (401) | `curl` the manifest endpoint from s1 before dispatching; `preflight` classifies it anyway |
| 7 | Stand already unhealthy from previous work | Host-side state check before the first dispatch |
| 8 | Runner busy with another tenant's job | Check the runner queue before dispatching |

**Eight of eight converted.** State this plainly in the ledger: *this is a validation story, so every
dispatch in the budget buys an AC row, not a diagnosis.* That is the honest form of the
zero-dispatch model for a story whose deliverable is the dispatches themselves.

**Declared floor — 20 runs. It is a floor, not a ceiling. Do not compress it into one number
without the arithmetic.**

| Line | Runs |
|---|---|
| This context push (branch, no PR open yet) | 1 |
| Context PR opened | 1 |
| Context PR merged (`build-main.yml`) | 1 |
| Five validation-branch pushes (`ci.yml` incl. the called image job) | 5 |
| Five deploy dispatches, one at a time (§3) | 5 |
| AC4's missing-image dispatch (existing branch, no push) | 1 |
| AC5/DF2 probe: D1 real deploy + D2/D3 `hold_lock_seconds=5` | 3 |
| Closeout branch push | 1 |
| Closeout PR opened | 1 |
| Closeout PR merged | 1 |
| **Declared floor** | **20** |

Named contingencies, each priced:

- every extra push to a branch with an open PR: **+2**
- every extra push to a validation branch (content fix): **+1**, *and* it invalidates that branch's
  image and its already-run deploy → **+1** more, **and the consecutive count resets to one** (§3)
- every red deploy: **+1**, and the count resets to one
- a DF2 probe that does not discriminate on the first attempt: **+3**
- 🔴 the Sunday 02:00 UTC reset firing, if it lands inside this story's id range: **+2** (the reset
  run and the `deploy-dev.yml` run it dispatches). **It counts.** A real CI-minute cost is a real
  CI-minute cost regardless of who triggered it (`4-6-…md:1519`).

**retro-D4:** declare before work; **the ledger closes only against a query, re-run after the merge
commit lands.** A ledger closed at PR-open is not closed. If the query cannot be run, close it with
the literal word **OPEN** — never a self-reported number.

### 11. Two inherited open questions this story closes at zero marginal cost

**(a) The mixed-case tag question, open since Story 3.2 and never settled.** `3-2-…md:930-937`:

> **Story 4.3 deploys DEV by `ref`.** Whatever derives a tag from a ref must produce a string that
> **matches the stored, folded form when compared case-insensitively** … ⚠️ **Someone should spend
> one `docker pull` on the mixed-case name and settle it**, rather than inherit either claim.

Story 4.3 never did — the word "lowercase" does not appear in its file. Neither sanitizer folds case
(`build.yml:850-851`, `deploy-dev.yml:797`), while `build.yml:964-968` states twice, as fact, that
*"the registry folds case on write."* Every real feature branch in this repository carries an
uppercase ticket key. **§2 rule 2 already puts at least one uppercase-bearing branch among the five**
— so this closes as a by-product of AC1, plus one free `curl` in Task 2 that asks the registry for
both spellings and records which resolve.

**(b) Story 4.4's AC1** — which group a run is actually assigned — shipped UNPROVEN for want of DB
access (`deferred-work.md:2909-2923`). §9's probe reads exactly those columns. Free.

Neither is an AC of this story. Both are recorded in the Completion Notes and swept into
`deferred-work.md` as **closed**, under the original entries, per that file's convention.

### 12. 🔴 Sunday 2026-08-23 02:00 UTC — do not interfere with it

`dev-reset.yml` is **armed** on `main`: `cron: '0 2 * * 0'`, exactly one `action_schedule` row
(id 38) and one spec (id 39, `next = 2026-08-23 02:00:00 UTC`). The measured delay between the
scheduled instant and the run's start is **44 s**, this repository's own figure across five probe
firings.

That Sunday firing is the **first autonomous, human-untriggered** one — the scheduler's own system
actor, `trigger_user_id = -2`, has fired the armed file zero times. It is the single remaining
unmeasured dimension of Story 4.6 and the **coordinator** is its named owner, checking by query the
following Monday.

**Rules this imposes on Story 4.7 — autonomous, subject to Oleg's veto:**

1. **No dispatch of any kind between 2026-08-23 01:45 and 02:30 UTC.** Both workflows share one
   concurrency group; a deploy in flight at 02:00 makes the reset the pending party, which is
   precisely DF2's hazard and would contaminate the coordinator's measurement with this story's own
   traffic.
2. **No `hold_lock_seconds` holder may be alive across that window.** Holders outlive their own job
   and are bounded only by the 720 s TTL; §9's probe uses 5 s deliberately.
3. **Finish all dispatch work before Saturday 2026-08-22 20:00 UTC, or resume after Sunday 03:00
   UTC.** State in the ledger which side of the window the work fell on.
4. If the reset fires inside this story's run-id range, **record both its runs in the ledger** and do
   not attribute them to this story's own spend — a separate, labelled line.
5. ⚠️ The reset deploys `ref=main`, which will **overwrite whatever branch the stand is serving.**
   Capture the stand's final state *before* the window, or the last of the five deploys becomes
   unobservable on the host.

---

### Prohibitions

🚨 **A prohibition here cannot be overridden by a subtask.**

1. **Do not modify `.forgejo/workflows/deploy-dev.yml`.** Not a step, not a bound, not a comment.
   §1, §3. If it genuinely must change, that is a `correct-course`, and the count resets to one.
2. **Do not modify `dev-reset.yml`, `ci.yml`, `build.yml`, `docker-compose.stand.yml`, or the
   stand's host-side `.env`.** §3, §12.
3. **Do not implement a rollback path.** §8. It is Story 4.8's, by written decision.
4. **Do not add any new evidence or timing step to any workflow.** §1, §6. The channels already
   exist.
5. **Do not raise `timeout-minutes` anywhere.** Story 4.4's M1 invariant: the holder TTL (720 s)
   exceeds the deploy job's timeout (600 s) by an *undocumented* margin, and raising the timeout past
   12 minutes silently unmakes the lock guard with no error and no message (`4-4-…md:1984-2008`).
6. **Do not push to, force-push to, or delete any pre-existing `origin` branch.** The 201
   `feature/*` branches are other people's work. AC4 *reads* one; it never writes to it.
7. **Do not touch anything under `.github/`, nor `docker-compose.server.yml`, `nginx.conf`,
   `Dockerfile.prod`, `.env.dev.example`.** NFR5 / D7 / «GitHub не трогаем».
8. **Do not touch `SLACK_CD_WEBHOOK_URL`, `KONG_PORT`, or the `story-4-5/pr-1-context` branch.**
   Story 4.5 is PARKED by Oleg's decision; that branch is unmerged and nothing may build on it. No
   notification step is written and no AC here is satisfied only when one is sent — the standing
   rule: **the deploy must work without it** (`epics.md:1825-1829`).
9. **Do not read durations from the web UI, and do not read any verdict from a step's own echo when
   the database carries it.** §4, §5.
10. **Do not report an average where the AC says "each".** §4.
11. **Do not spend an unbudgeted dispatch.** §10. There is no cancel endpoint.
12. **No `${{ }}` inside any `run:` body — not even inside a shell comment.** Forgejo substitutes
    inside comments too (`build.yml:812-816`) and one empty token once rejected an entire workflow
    with no diagnostic. Vacuously satisfied if Prohibition 1 holds; stated because a "tiny helper"
    is exactly how it gets violated.
13. **Never print a token value.** Story 4.2's own review found one in a transcript
    (`deferred-work.md:39-54`). `/root/.fj_token` holds `FJ_TOKEN=<value>`, not a bare token —
    extract with `cut -d= -f2-`. If a ledger query starts returning `401`, **that is Oleg's pending
    revocation of `fe_review_1_7`, not a bug**; fall back and record it.

---

## Acceptance Criteria

Source: `epics.md:1973-1999`. Covers **NFR2** (`epics.md:313`, deploy under 10 minutes) and **NFR5**
(`epics.md:321-325`, legacy stands untouched). Deviations from the epic's literal wording are named
in each AC and argued in §1-§12.

---

**AC1 — five distinct branches deploy green through the unmodified pipeline, and every duration is
recorded.**

**Given** `deploy-dev.yml` as shipped at `baseline_commit`, unmodified for the whole story,
**When** five branches meeting §2's binding definition are each built by the ordinary `ci.yml` →
`build.yml` path and then deployed by a single `workflow_dispatch` each, one at a time,
**Then** all five deploy runs report success,
**And** each run's wall-clock duration is recorded from `action_run.started`/`.stopped`, alongside
its `action_run.id`, `index`, `ref`, `event`, the deployed commit SHA, the resolved image digest and
the `deploy` job's own duration,
**And** the five runs are proven to have exercised one pipeline by object identity — the git blob
hash of `deploy-dev.yml` and of `docker-compose.stand.yml` is one distinct value each across all
five deployed refs and `main`.

> 🔴 **DEVIATION, STATED (this story, autonomous — subject to Oleg's veto). "Real feature branches"
> is redefined, because the literal reading is unsatisfiable.** None of the 201 `origin/feature/*`
> branches carries `docker-compose.stand.yml`, which Story 4.1 introduced on 2026-08-19 and which
> `deploy-dev.yml:1057-1062` refuses to deploy without — measured across all 525 remote refs. §2
> gives the five-clause binding definition and requires the actual mix (replayed real diffs vs.
> project artefacts) to be argued per branch. **What is specifically NOT met: these are not branches
> a developer independently authored in the course of unrelated work.** That supply does not exist on
> Forgejo (D7, no branch or PR mirror) until Epic 7.

> ⚠️ **CLARIFICATION, not deviation.** "Five branches deployed" is five deploy runs **plus** five
> `ci.yml` runs that build their images — ten rows in the ledger, not five (§10). A red `ci.yml` run
> means that branch has no image and its deploy cannot be attempted; it is a reset under §3, not a
> deploy failure.

---

**AC2 — every deploy is inside the ten-minute budget, stated per run, and every deploy's dominant
step is named.**

**Given** the five recorded durations,
**When** they are evaluated against **600 s**,
**Then** **none** exceeded it, stated **per run** and never as an average, with min, max and mean
reported and the mean explicitly demoted to "for completeness",
**And** the verdict is taken on **run wall-clock** (`action_run.stopped − action_run.started`), not
on the `deploy` job's own duration, with the job-level and workflow-reported figures recorded
alongside as cross-checks,
**And** for **each** of the five — not only for any that exceeded — the dominant step is identified
from the step-level timings and named, together with what it cost.

> 🔴 **AMENDED (this story, autonomous — subject to Oleg's veto), on two points, both argued in §4.**
> (i) **The clock.** `deploy-dev.yml:752` sets `timeout-minutes: 10` on the `deploy` job, so a
> job-level measure makes this AC an implication of AC1 and it could never fail — the same
> false-positive class Story 1.3, Story 3.6 and Story 4.4's AC3 each had to design around. Run
> wall-clock is the only available measure that can exceed the budget while the run still succeeds.
> (ii) **"any deploy that exceeded the budget"** is widened to all five. The measured uncontended
> baseline is ~21-22 s at job level (`4-4-…md:2128-2131`), so the epic's conditional clause would
> close vacuously and leave the number unmeasured for the third story running — Story 4.3 owed this
> attribution (`4-3-…md:239-241`) and never produced it. It is now free (§5, §6) and it is the
> number Story 4.8 needs before it moves these steps into a shared definition.

---

**AC3 — the legacy stand's isolation is discharged by what can actually be observed, and the
substitution is recorded rather than papered over.**

**Given** that the legacy DEV stand runs on `72.62.17.132`, a host this session cannot reach and
whose deploy path Story 4.1's verdict (b) forbids touching,
**When** this story's isolation claim is made,
**Then** it is proven by diff that nothing in this story's changes touches `.github/`,
`docker-compose.server.yml`, `nginx.conf`, `Dockerfile.prod` or `.env.dev.example`, and that no host
literal capable of reaching `72.62.17.132` appears anywhere in the diff,
**And** on s1, every neighbouring container's `Created`/`StartedAt` is captured before the first
deploy and after the last, and **none moved**,
**And** s1 holds no container named `fe-prionex` (asserted with the filter anchored at both ends),
and `crm-dev-network`'s id is the same value across all five deploys,
**And** the observation window this story actually covers is stated **in hours**, with the epic's
"a week in parallel" clause and the "developers report no disruption" clause each recorded as
**PENDING**, with a named owner and the exact question to be asked.

> 🔴 **NARROWED AND SUBSTITUTED (this story, autonomous — subject to Oleg's veto), on the Story 4.2
> AC5 precedent (`4-2-…md:460-471`): "recording the substitution is the deliverable."** The epic's
> clause assumes both stands sit on one host; they do not, and this was measured on s1 by Story 4.1.
> Two of its three requirements are structurally unavailable to this story — a machine it cannot
> reach, and a calendar week it cannot span — and the third needs a human. **Reporting "both stands
> healthy" would be the failure mode this project has already been bitten by twice.** What replaces
> them is not weaker but *different*: NFR5's real exposure on s1 is multi-tenancy — ~185 `crm-`
> containers sharing the host with the runner the deploy job runs inside — and no story has yet
> proven across five consecutive deploys that none of them moved. §7.

---

**AC4 — a branch with no built image fails fast, names the tag, and never reaches `down`; the
post-`down` window is explicitly not claimed.**

**Given** a ref that exists in git but whose derived tag was never published to the registry,
**When** a deploy is dispatched for it,
**Then** the run fails at the **digest-resolve** step with the 404 classifier
(`deploy-dev.yml:934-941`), whose message names the derived tag and both of its possible causes,
**And** `docker compose down` is **never reached** — proven from the step-level record, not argued
from the file's ordering alone,
**And** the stand's `Created`/`StartedAt` and running digest are **observed** identical immediately
before and immediately after that dispatch, with no other dispatch in between.

> 🔴 **NARROWED (this story, autonomous — subject to Oleg's veto). "The stand keeps serving its
> previous version" is claimed for the pre-`down` window ONLY, and the rollback mechanism is routed
> in full to Story 4.8.** Story 4.3's review H5 established that six steps after `down` can each
> leave the stand stopped or unhealthy with no recovery path, that the previous digest is never
> captured, and that run 937 is the live proof — and it assigned the mechanism jointly to *"Story 4.7
> (the AC that requires it) / Story 4.8 (shared mechanics)"* (`deferred-work.md:2824-2835`). **That
> joint ownership is resolved here, in writing, in 4.8's favour:** implementing it would be a new
> mechanism in an already-hardened file (§1), its retro-E5 outcome matrix would require deliberately
> breaking and repairing the stand, and the evidence it would produce already exists in runs 937/938.
> §8. Task 9.4 records the resolution in `deferred-work.md` under the original entry.

> ⚠️ **METHOD NOTE.** Do not reuse Story 4.3's run-948 recipe. Review M2 made a bare 7-40-hex ref map
> to `sha-<12hex>-dev`, build.yml's own publishing form, which for a real historical commit may
> exist — the row would silently pass as a success. Use one of the 201 real, never-built `feature/*`
> branches instead: it exists in git, its tag was never published, and it costs zero pushes (§8).

---

**AC5 — the shared concurrency group's pending/eviction behaviour is measured from the database, or
recorded UNPROVEN.**

**Given** that `deploy-dev.yml` and `dev-reset.yml` declare the identical literal concurrency group
`deploy-dev-fe-prionex-dev` with `cancel-in-progress: false`,
**When** three runs are deliberately placed in that group — one in flight and two arriving behind it
(§9's D1/D2/D3 design) —
**Then** the outcome is read from `action_run` — `status`, `started`, `stopped`,
`concurrency_group`, `concurrency_type`, and whether the second ever produced an `action_run_job`
row — and **never inferred from timing**, because on a `capacity: 1` runner group-queueing and
capacity-queueing are indistinguishable by timestamps,
**And** the finding is stated in the direction it actually landed, including its consequence for the
weekly reset's ability to be silently dropped,
**And** if the database cannot be reached, the row closes with the literal word **UNPROVEN**.

> 🔴 **ADDED (this story). Not in the epic; assigned to this story by name.** `deferred-work.md:3040-3052`
> (DF2, from the Story 4.6 code review): *"Owner: Story 4.7 (five-branch validation)."* It is an AC
> rather than a task because the trap it carries is that **five green sequential deploys look exactly
> like a closure and are not one** — §9. Two inherited items close as by-products at zero extra
> dispatch: Story 4.4's AC1 (which group a run is assigned; shipped UNPROVEN,
> `deferred-work.md:2909-2923`) and a partial answer on queue depth (`:2924-2936`, owner 4.8 —
> partial, and it must say so).

---

**AC6 — the ledger closes against a query, and every gap this story finds is routed rather than
patched.**

**Given** the run-budget declaration made before the first push (§10),
**When** the story closes,
**Then** the ledger is reconciled against a **direct query re-run after the merge commit lands**,
itemized by phase rather than compressed into a round number, with any overrun named and its cause
identified,
**And** every defect or gap found during the validation is recorded in `deferred-work.md` with a
named owner and a story number — **never a trigger condition** — and none of them is patched inside
this story,
**And** the two inherited open questions of §11 are closed under their original entries, and
`deferred-work.md`'s existing rollback entry is amended (appended to, not rewritten) with §8's
ownership resolution.

> 🔴 **ADDED (this story).** Not in the epic. It exists because a validation story's characteristic
> failure is a table of green rows with nothing behind it, and because §1's "no new mechanisms" rule
> is worthless unless the disposal route for what it forbids is itself an AC. retro-D4 supplies the
> ledger half (`epic-3-retro-2026-08-18.md:77`); `deferred-work.md:2985-2991` supplies the
> owner-must-be-a-name-or-a-story-number half.

---

## Tasks / Subtasks

### Task 1 — Bind the facts and declare the budget before spending anything (AC: all)

- [ ] 1.1 Re-read `.forgejo/workflows/deploy-dev.yml` **in full** (1875 lines; most of it is
      load-bearing comment). Confirm by execution, not by memory: the input set (`ref`,
      `simulate_bad_credential`, `hold_lock_seconds`), the four-job ladder and its `needs:`
      (`deploy: needs: [preflight, clone-test]` — `digest-resolve-test` is deliberately NON-gating,
      DN1), `timeout-minutes: 10` on `deploy`, the step order `resolve → pull → checkout → write
      vars → acquire lock → guard → down → up -d → …`, and the concurrency block at `:197-199`.
      **If any of this differs from §1-§12, stop** — the story was contexted against a file that has
      since changed and every duration figure in it is suspect.
- [ ] 1.2 Record the git blob hashes of `.forgejo/workflows/deploy-dev.yml` and
      `docker-compose.stand.yml` at `baseline_commit`. These are AC1's object-identity anchors.
- [ ] 1.3 🔴 **Establish and record the DB route, and settle the host contradiction.**
      `ssh root@10.67.0.1 'docker exec forgejo-postgres psql -U forgejo -d forgejo -c "select 1;"'`.
      State plainly **which host** the Forgejo Postgres was reached on — `4-6-…md:1046` says it is
      not s1 while every query in that same story runs `docker exec` over SSH to s1. Do not inherit
      either claim (§5).
- [ ] 1.4 **Run-budget baseline.** `select max(id) from action_run;` — instance-wide, before
      creating anything. Also record `count(*)` and `max(index)` for `repo_id=16`, so the closure can
      prove no run was created and hidden (`2-5-…md:1089-1093`). Everything above the baseline id
      belongs to this story.
      ⚠️ Token: `/root/.fj_token` holds `FJ_TOKEN=<value>`; extract with `cut -d= -f2-`. **Never
      print a value.** A `401` is Oleg's pending revocation of `fe_review_1_7`, not a bug.
- [ ] 1.5 **Write the declaration** into `### Run Budget Ledger` before the first push: §10's table
      verbatim, the named contingencies, and the eight-of-eight zero-dispatch conversion with the
      sentence *this is a validation story, so every dispatch buys an AC row, not a diagnosis.*
- [ ] 1.6 Confirm the **holder debris** state on s1 before starting: no
      `fe-prionex-dev-deploy-lock-*` container is running, and `.deploy.lock` in
      `/root/crm-prionex/fe-prionex-dev/` is a zero-byte file with no live holder. A zero-byte
      `.deploy.lock` is **normal** — `flock` releases with the file descriptor, not by deleting the
      file (`deploy-dev.yml:1848-1851`). Do not "clean it up".
- [ ] 1.7 Record the stand's pre-story state: running container name, digest, `Created`, `StartedAt`,
      published port, `crm-dev-network` id. This is AC3's and AC4's "before" row.
- [ ] 1.8 🔴 **Confirm the schedule window.** `select s.id, sp.spec, sp.next from action_schedule s
      join action_schedule_spec sp on sp.schedule_id = s.id where s.repo_id = 16;` — expect exactly
      one row, `'0 2 * * 0'`, `next = 2026-08-23 02:00:00 UTC`. Plan every dispatch against §12's
      window and state in the ledger which side of it the work fell on.

### Task 2 — Choose the five branches and prove them deployable at zero dispatch cost (AC: 1)

- [ ] 2.1 Enumerate candidate historical feature branches and shortlist by: diff size, whether the
      diff applies cleanly onto `baseline_commit`, and branch-name shape. **At least one shortlisted
      name must carry an uppercase ticket key** (§11a).
- [ ] 2.2 For each candidate, replay the diff onto a branch cut from `baseline_commit` **locally**
      and prove it green before it can ever cost a run. ⚠️ **This repository already does it for
      you**: `.husky/pre-commit` runs `format:check`, `lint --max-warnings=0`, `typecheck` and
      `test:run` on every commit, and `.husky/pre-push` adds `npm run build` — the hook's own stated
      goal is *"a clean run here implies a green CI run."* Budget **~2-8 minutes per commit** for it
      and **never pass `--no-verify`**: bypassing the hook converts a free local failure into a paid
      `ci.yml` run and, under §3, a reset of the count.
      🔴 **A replay that needs conflict resolution or a test edit is not a replay — drop it and pick
      another.** Editing a test to make a replay pass is the exact prohibition Story 2.5 carried for
      the same reason.
- [ ] 2.3 Fill the remainder from this project's own documentation/tracking artefacts — **one honest
      change per branch, no batching, no padding.** If there is nothing honest left to carry,
      **stop and say so** rather than inventing one.
      ⚠️ Story 2.5's review found that its own version of this guard was unreachable because PR N's
      content was PR N−1's evidence (`2-5-…md:1385-1393`). **Do not make any branch's content depend
      on another branch's results.** Pick all five contents up front, at Task 2, before any push.
- [ ] 2.4 Record the mix and argue it: which branches are replays, which are artefacts, and why each
      one is what it is. This is §2's "argue the mix", and it is a deliverable, not a note.
- [ ] 2.5 **Sanitizer parity, by execution.** Extract the sanitizer from `build.yml:850-851` and from
      `deploy-dev.yml:797` and run both against all five chosen branch names. Assert identical
      output, assert every output is a valid Docker tag, assert the `[.-]*` leading-character guard
      does not fire, and assert length ≤ 100. Zero dispatches. **If they differ, that is a finding —
      record it and choose different names; do not edit either workflow (Prohibition 1).**
- [ ] 2.6 Assert `git cat-file -e <ref>:docker-compose.stand.yml` for all five candidate refs.
- [ ] 2.7 🔴 **Case-folding probe (§11a), zero dispatches.** After the first uppercase-bearing
      branch's image exists (Task 3), `curl` the registry manifest endpoint from s1 with
      `REGISTRY_USER_RO`/`REGISTRY_TOKEN_RO` for **both** the mixed-case and the folded spelling of
      its tag, and record both HTTP codes and both `Docker-Content-Digest` values. Credential via
      `curl --config -` on stdin, **never argv** — s1 is multi-tenant and argv is world-readable in
      `ps auxww`. Settles the question Story 3.2 left open on 2026-08-15.

### Task 3 — Cut, push, and verify the five images (AC: 1)

- [ ] 3.1 **Repeat 3.2-3.6 five times. Do not cut branch N+1 until branch N's image is verified.**
- [ ] 3.2 Cut the branch from `baseline_commit`, apply its single change, and push. **This is the
      only push that branch may receive** — a second push invalidates the image, invalidates any
      deploy already run against it, and resets the count (§3, §10).
- [ ] 3.3 Record the `ci.yml` run: `id`, `index`, `event`, `ref`, `commit_sha`, `status`, and the
      four job durations. Expect **one** `action_run` row — the `image` job expands `build.yml`
      through `uses:` and creates none of its own.
- [ ] 3.4 If `ci.yml` is red: **that is a finding, and it is not a licence to edit a test**
      (Prohibition 2 applies to `ci.yml`; the suite is not this story's to change). Record it,
      classify it, drop the branch, pick another from Task 2's shortlist. Say so in the mix.
- [ ] 3.5 Verify the published image **before** dispatching a deploy: the tag exists, its
      `org.opencontainers.image.revision` label equals the branch tip SHA, and its digest is
      recorded. This converts zero-dispatch cause #5.
- [ ] 3.6 Verify `docker-compose.stand.yml`'s blob hash at the pushed ref equals the value from
      Task 1.2 (AC1's object identity).

### Task 4 — Run the five deploys, one at a time (AC: 1, 2)

- [ ] 4.1 **Repeat 4.2-4.7 five times. Do not dispatch deploy N+1 until deploy N has finished and its
      evidence is collected.** Serial by rule, not by accident: §3 needs five runs of one pipeline,
      and §9 needs the uncontended case kept clean so it can be compared against the contended one.
- [ ] 4.2 Dispatch `deploy-dev.yml` with `ref=<branch>` and both test inputs left at their defaults
      (`simulate_bad_credential=false`, `hold_lock_seconds=0`). Record the dispatch time in UTC.
      ⚠️ Coordinator times are MSK (UTC+3); s1's clock is CEST (UTC+2). **Write every timestamp in
      UTC and say so** — Story 4.4 lost a row to this (`4-4-…md:476-483`).
- [ ] 4.3 When it completes, read from the DB: `action_run` (`id`, `index`, `ref`, `event`, `status`,
      `created`, `started`, `stopped`) and `action_run_job` for all four jobs (`started`, `stopped`,
      `status`, `runner_id`).
- [ ] 4.4 Read the `deploy` job's task log (§5a, §6): locate the task, check `log_in_storage`, fetch
      `log_filename`, `zstd -dc` it on s1, and extract the per-step boundary timestamps plus the
      workflow's own `Deploy wall-clock duration: Ns` line.
- [ ] 4.5 Verify host-side, from s1: the running container's digest equals the digest this run
      resolved, `StartedAt` moved, `crm-dev-network`'s id is unchanged, and the container name is
      `fe-prionex-dev` (anchored).
      ⚠️ `FRONTEND_PORT` is rendered as `127.0.0.1:8082` — **host-loopback only, unreachable from
      inside any container including the job's own** (D28/D29 §5). Any HTTP check must run from a
      host shell or a sibling container with `--network host`.
- [ ] 4.6 Record the row in the evidence table (Task 7's format). **One row per deploy, written as
      the deploy completes** — not reconstructed at the end.
- [ ] 4.7 If a deploy is red: **stop the sequence.** Diagnose it from its own task log (§5a — this is
      exactly the capability that makes diagnosis free now, where 4.3 paid a dispatch per cause).
      Classify it: *branch-content* (the branch is wrong → drop it, pick another, count resets),
      *pipeline* (a real defect in shipped machinery → **record it for 4.8 and stop**, §1), or
      *infrastructure* (host/runner/registry → record and report to Oleg). **Do not patch the
      pipeline to make the sequence continue** unless the defect blocks the validation itself, which
      is a `correct-course`, not a subtask.

### Task 5 — AC4's missing-image row (AC: 4)

- [ ] 5.1 Choose a **real, never-built** `origin/feature/*` branch — one that exists in git and whose
      derived tag was never published. **Read-only: never push to it, never delete it**
      (Prohibition 6).
- [ ] 5.2 Confirm the 404 **before** dispatching: derive its tag with the Task 2.5 sanitizer and
      `curl` the registry manifest endpoint from s1 for that tag; expect `404`. Zero dispatches. **Do
      not reuse Story 4.3's 40-hex-SHA recipe** — review M2 made a bare hex ref map to
      `sha-<12hex>-dev`, which may exist (§8).
- [ ] 5.3 Capture the stand's `Created`/`StartedAt`/digest immediately before the dispatch.
- [ ] 5.4 Dispatch `deploy-dev.yml` with that ref. **Dispatch nothing else until 5.6 is done** — an
      intervening run would make the "unchanged" observation worthless, which is exactly why 4.3
      could only *argue* the stand was untouched after run 948 rather than observe it.
- [ ] 5.5 Confirm from the step-level record (`action_task_step` and the task log) that the run failed
      at the **digest-resolve** step and that `docker compose down` was never reached. Quote the 404
      classifier's literal message and confirm it names the derived tag.
- [ ] 5.6 Re-capture the stand's `Created`/`StartedAt`/digest and prove them identical to 5.3. This
      is the *observed* version of what run 948 could only argue.
- [ ] 5.7 Record explicitly that AC4 is closed for the **pre-`down` window only**, that the
      post-`down` window (six steps, no rollback, run 937 the live proof) is **not** claimed, and that
      the mechanism is routed to Story 4.8 per §8.

### Task 6 — AC5's DF2 measurement (AC: 5)

- [ ] 6.1 🔴 **Check §12's window first.** Not between 2026-08-23 01:45 and 02:30 UTC, and no holder
      alive across it.
- [ ] 6.2 Dispatch **D1**: `deploy-dev.yml`, `ref=main`, defaults. Note its `action_run.id` and the
      moment it starts running.
- [ ] 6.3 While D1 is in flight, dispatch **D2** (`hold_lock_seconds=5`) and then **D3**
      (`hold_lock_seconds=5`), in that order, as close together as the API allows. Record the wall
      time of each dispatch in UTC and the `id` each returns.
      ⚠️ `hold_lock_seconds` must be a positive integer ≤ 720. A value that is neither `>0` nor `==0`
      once produced a green run that did nothing (Story 4.4 H5); `5` is deliberate — short enough
      that a holder cannot outlive the probe, long enough to be observable.
- [ ] 6.4 Read the answer from the DB for all three ids:
      `select id, index, workflow_id, status, concurrency_group, concurrency_type, created, started,
      stopped from action_run where id in (…);`
      plus, for D2, whether any `action_run_job` row exists at all. **`concurrency_type = 1` means an
      explicit group; `0` means the auto-group.**
- [ ] 6.5 State the finding in the direction it landed. If D2 was evicted: the Sunday reset **can** be
      silently dropped when it queues behind a human deploy and a second human dispatch arrives —
      record it in `deferred-work.md` for Stories 4.5 (notification would make it visible) and 4.8
      (which re-keys the group), **and do not patch anything here.** If D2 was **not** evicted: DF2's
      premise is falsified for this Forgejo build, which is equally valuable and closes it.
- [ ] 6.6 Close **Story 4.4's AC1** as a by-product: `concurrency_group`/`concurrency_type` are now
      read for real runs of this workflow. Sweep the entry at `deferred-work.md:2909-2923` under its
      original text (§11b).
- [ ] 6.7 Record what this does **not** settle: queue depth beyond three
      (`deferred-work.md:2924-2936`, owner 4.8), and `flock`'s non-FIFO wake order beyond two
      contenders. **Partial, and it must say so.**
- [ ] 6.8 Confirm no holder container survived the probe, and that the stand is healthy and still
      serving D1's `main` image before Task 4 resumes (or, if Task 4 is already done, before the
      story's final host capture).

### Task 7 — Evaluate against the budget and attribute the dominant step (AC: 2)

- [ ] 7.1 Tabulate all five deploys. Format:
      `| # | branch | run id | run index | commit SHA | image digest | run wall-clock | deploy job | workflow-reported | dominant step | that step's cost |`
- [ ] 7.2 State pass/fail against **600 s per run**. Report min, max, mean; mark the mean *"reported
      for completeness — the verdict is per-run."*
- [ ] 7.3 Compare against the measured baselines: `deploy` job ~21-22 s uncontended
      (`4-4-…md:2128-2131`), ~146 s contended (run 965), ~87 s (run 973). **Flag anything outside,
      do not smooth it into an average.**
- [ ] 7.4 Name the dominant step for **each** of the five and say what it cost. The candidates that
      exist in code: the `timeout 300` pull (`:964`), the `timeout 300` checkout fallback (`:1038`),
      the 120 s health poll (`:1542`). **Label measured, not computed** — the per-step numbers are
      direct reads; anything derived from them is arithmetic and must say so.
- [ ] 7.5 Record the three-way agreement (run level / job level / workflow-reported). If they
      disagree by more than a second or two, **the disagreement is the finding** — record it.
- [ ] 7.6 Record job→runner distribution across the five runs, and whether any run queued behind
      another tenant's job on the `capacity: 1` deploy runner. **Queue time is inside the run
      wall-clock and therefore inside the verdict** — say so explicitly, and report `created` vs
      `started` per run so a future reader can separate them (`2-5-…md:1187-1209` is the precedent
      for doing this properly).

### Task 8 — Discharge AC3 honestly (AC: 3)

- [ ] 8.1 `git diff origin/main...HEAD --name-only` over the story's whole range. Confirm zero files
      under `.github/`, and none of `docker-compose.server.yml`, `nginx.conf`, `Dockerfile.prod`,
      `.env.dev.example`. **Verified by diff, not by intention.**
- [ ] 8.2 Grep the entire diff for host literals. Confirm `72.62.17.132` appears nowhere, and that no
      new host/IP literal was introduced anywhere.
- [ ] 8.3 Compare s1's neighbour census taken at Task 1.7 against one taken after the last deploy:
      every container's `Created` and `StartedAt`, for all containers on the host. **None may have
      moved** except `fe-prionex-dev` itself and the runner's own ephemeral job containers. Report the
      count and the diff, not a summary sentence.
- [ ] 8.4 Assert, anchored at both ends, that s1 holds no container named `fe-prionex`. Record the
      literal command — an unanchored filter matches five containers on this host
      (`4-3-…md:534-547`).
- [ ] 8.5 Record `crm-dev-network`'s id as a series across all five deploys, from each run's own
      "Confirm the network was NOT created by this run" step.
- [ ] 8.6 State the observation window **in hours**, from the first branch push to the final host
      capture, in UTC.
- [ ] 8.7 Record the two PENDING clauses with named owners and the exact questions:
      **(a)** "a week of parallel operation" → **coordinator**, folded into the same Monday check that
      already owns the Sunday 2026-08-23 scheduler firing — one reader, one query, two questions;
      **(b)** "the developers using it report no disruption" → **Oleg**, with the literal question to
      put to the team. Neither may be asserted by this story.
- [ ] 8.8 Record the substitution itself, in the Story 4.2 AC5 shape: what was asked, what could not
      be reached and why, what was measured instead, and why the replacement is not weaker.

### Task 9 — Record, route findings, and hand forward (AC: 6, all)

- [ ] 9.1 Write the full evidence table, the AC verdicts, and every measurement into
      `### Completion Notes List`. Every number carries its source column and its query.
- [ ] 9.2 🔴 Restate §2's deviation on "real" explicitly, with its reasoning **and with the part that
      is not met** — not just the parts that are. Story 2.5's Task 6.2 is the precedent, and its
      review found that the first pass understated the deviation actually taken.
- [ ] 9.3 Record **every** gap found during the validation in `deferred-work.md`, appended as a new
      `## Deferred from: story-4.7 validation (2026-08-…)` section with a preamble stating how many
      findings the validation produced and why these ones are somebody else's. Number them `DF1`,
      `DF2`, … within the section (the newest convention, from the 4.6 review). 🔴 **Every owner must
      be a name or a story number, never a trigger condition** (`deferred-work.md:2985-2991`).
- [ ] 9.4 Amend the rollback entry at `deferred-work.md:2824-2835`: **append** the §8 resolution under
      the original — joint ownership resolved in Story 4.8's favour, with the three reasons — and
      never rewrite the original in place. The file's own convention: closures go under the original,
      and the original stays.
- [ ] 9.5 Sweep §11's two inherited questions closed under their original entries: the mixed-case tag
      question (Story 3.2's *"someone should spend one `docker pull`…"*) and Story 4.4's AC1.
- [ ] 9.6 Write the D-record. Next free number is **D32** — verify against open branches first. In
      **Russian**, matching `docs/migration-decisions.md`; the story file stays in English per
      `_bmad/bmm/config.yaml`. Include the `**Требования:**` footer citing this story's ACs, D29, D30,
      D31 and retro **D4**/**E5**, and a `**Триггер пересмотра:**` line naming Story 4.8.
      ⚠️ **retro-D4/retro-E5 are NOT the D-series `D4`.** The D-series `D4` is stand parameterization
      and there is no `E5` in it. Write the run-ledger rule nowhere near `migration-decisions.md`'s
      own `D4`.
- [ ] 9.7 Hand forward to Story 4.8, explicitly and in one place: the per-step cost profile (Task 7.4
      — the number 4.8 needs before it moves these steps), the rollback ownership (§8), DF2's verdict
      (Task 6.5), and whatever Task 9.3 routed.

### Task 10 — Close (AC: all)

- [ ] 10.1 Re-run the ledger query **after the merge commit lands** and reconcile: declared floor 20
      vs. actual, itemized **by phase**, plus `count(*)` and `max(index)` moving by exactly the same
      amount so no hidden run is possible. Name any overrun and its cause; do not round it away.
      **A ledger closed at PR-open is not closed.** If the query cannot be run, close it with the
      literal word **OPEN**.
- [ ] 10.2 List the Sunday-reset runs separately if they fell inside the id range — counted, but on
      their own labelled line (§12 rule 4).
- [ ] 10.3 Confirm Prohibition 1-5 held by execution: `git diff origin/main...HEAD --name-only`
      contains **no** file under `.forgejo/workflows/`, and no `docker-compose.stand.yml`. If it does,
      §3's reset rule fired and the story must say so.
- [ ] 10.4 State which AC rows closed on evidence, which closed **vacuously** (a condition that never
      obtained), and which closed **UNPROVEN**. **Do not close an AC you did not close.**
- [ ] 10.5 Record the five validation branches by name in the File List and hand their eventual
      deletion to Story 4.9's cutover as a one-line chore. Their `-dev` tags expire on their own at
      14 days (not in `keep_pattern`); no registry cleanup is needed or permitted.
- [ ] 10.6 Fill `### Open Questions for Review`, split **Blocking** / **Non-blocking**, each item
      opening with a bold claim sentence and naming its owner inline.

---

## Dev Notes

🔴 **Two numbered sequences exist in this file and they are not the same.** A bare **`§N`** always
means the pre-AC block *"Read this before anything else"* (§1-§12), which is where every argument
lives and which the ACs and Prohibitions cite. A reference written **`Dev Notes §N`** means a
subsection below (§1-§11), which is reference material, not argument. Nothing below re-argues
anything above; if the two ever disagree, the pre-AC block wins and the disagreement is a defect in
this file.

### 1. The one-paragraph version

Five branches cut from `main`, each carrying one honest change, each built by the ordinary push →
`ci.yml` → `build.yml` path, each deployed by one dispatch of an unmodified `deploy-dev.yml`, one at
a time. Durations read from Postgres, per-step attribution read from the zstd task log, host state
read over SSH to s1. Plus one 404 row on a never-built real branch, and one three-dispatch probe that
settles whether a shared concurrency group evicts a pending run. Nothing is built. Every gap found is
written down and handed to Story 4.8.

### 2. The deploy path as shipped — the map you are validating

`.forgejo/workflows/deploy-dev.yml`, 1875 lines, at `baseline_commit`. Four jobs plus a test fixture:

| Job | `needs:` | timeout | What it proves |
|---|---|---|---|
| `hold-lock` | — (`if: inputs.hold_lock_seconds > 0`) | 15 | Story 4.4's contention fixture. **Does not deploy** |
| `preflight` | — (`if:` complement of the above) | 3 | Org secrets non-empty; registry reachable; `flock`/`timeout` exist in the job image |
| `clone-test` | `preflight` | 3 | The authenticated `git fetch` the deploy will perform |
| `digest-resolve-test` | `preflight` | 3 | **Diagnostic, deliberately NOT gating** (DN1) |
| `deploy` | `[preflight, clone-test]` | **10** | Everything |

`deploy`'s step order — the thing AC2 and AC4 both depend on:

```
Record start time → validate/sanitize ref → docker login → RESOLVE DIGEST (404/401 classifiers)
→ pull (timeout 300) → obtain docker-compose.stand.yml at the ref (+ revision-label cross-check)
→ write the five .env vars → acquire stand lock → hand-provisioned-stand guard
→ capture network id → DOWN → up -d → confirm network not created → health poll (120 s)
→ anchored container assertion → fallback HTTP check → digest match (AC6) → Kong alias guard
→ post-deploy state → release lock (always) → record wall-clock → remove DOCKER_CONFIG (always)
```

🔴 **`digest-resolve-test` is NOT in `deploy`'s `needs:`** — Oleg's DN1 decision. It stays as an
ungated parallel diagnostic so a dispatch's verdict on `deploy` is always earned by `deploy`'s own
classifiers and never masked by a sibling job's. This is why AC4's row is real: Story 4.3's first
attempt (run 935) had `deploy` **SKIPPED** by the gate, its own classifier never printed, and the
review rejected the row. Run 948 re-earned it after DN1's fix.

The classifiers, verbatim, because AC4 quotes one of them:

- **404** (`:934-941`) — *"registry returned 404 Not Found resolving ${TAG}. Two possible causes,
  both stated because this session cannot tell them apart: (a) no image was ever built for this ref
  … or (b) a -dev tag older than 14 days was deleted by the live retention rule."*
- **401** (`:925-932`) — names the credential, explicitly says *NOT that the image is missing*, and
  carries `${SIMULATED_MARKER}` when `simulate_bad_credential=true`.
- **000** transport, and `*)` unclassified raw status, which *"never falls back to :latest, which
  does not exist."*

### 3. Infrastructure facts

| Fact | Value | Source |
|---|---|---|
| s1, from a dev session | `root@10.67.0.1` (= `s1.private.crm-prionex.com`); `185.185.49.127:22` **times out** | D28 §6; `.claude/settings.json` allows `Bash(ssh root@10.67.0.1:*)` |
| Deploy runner label | `deploy-dev-preprod` | `deploy-dev.yml:238` etc. |
| Deploy runner capacity | **1** — `/opt/forgejo-runner-deploy/config.yml`, re-measured by 4.4 Task 2.1 | D30 §4 |
| Stand directory | `/root/crm-prionex/fe-prionex-dev/` (`0700`) — **not readable by the deploy job**, only through a sibling container over `docker.sock` | D28 §4, D30 §2 |
| Container / project | `fe-prionex-dev` — 🔴 **never `fe-prionex`**; `CD.yml:201` force-removes that literal name | D27 |
| Port | `127.0.0.1:8082` — **host-loopback only, unreachable from inside any container** | D28 (Oleg's M7), D29 §5 |
| Network | `crm-dev-network`; Kong reachable as `crm-kong-gateway` → `172.22.0.53` | D28 |
| Registry | `git.crm-prionex.com/crm/fe-prionex`; org secrets `REGISTRY_USER_RO`/`REGISTRY_TOKEN_RO` (bot `robot-deploy`, `read:package`) | D29 §3 |
| `-dev` tag retention | **14 days** — not in `keep_pattern` | `build.yml`, `deploy-dev.yml:938-939` |
| `repo_id` | `CRM/fe-prionex` = **16** (`PRIONEX_HUB` = 8, `api-prionex` = 15) | `4-6-…md:1032-1033` |
| Ports on s1 | 8080 legacy · 8081 cadvisor · 8082 new DEV · 8083 PRE-PROD | `.env.stand.example:58-67` |
| Clocks | coordinator MSK (UTC+3); s1 CEST (UTC+2). **Write everything in UTC** | `4-4-…md:476-483` |
| Local CI parity | `.husky/pre-commit` = `format:check` + `lint --max-warnings=0` + `typecheck` + `test:run`; `.husky/pre-push` adds `build`. ~2-8 min per commit. **Never `--no-verify`** | `.husky/pre-commit` |
| No cancel endpoint | `POST …/actions/runs/{id}/cancel` → 404 against the full swagger | `deferred-work.md:94-98` |
| Registry manifest read | `GET https://git.crm-prionex.com/v2/crm/fe-prionex/manifests/<tag>` with `Accept:` for both manifest and index media types | `deploy-dev.yml:899-906` |

### 4. Measured baselines this story is checked against

| What | Value | Source |
|---|---|---|
| `deploy` job, uncontended | **~21-22 s** (runs 962, 968) | `4-4-…md:2128-2131` |
| `deploy` job, contended behind a 180 s holder | **~146 s** (run 965); run level ~189 s | `4-4-…md:527-540` |
| `deploy` job, after a holder expired | **~87 s** (run 973) | `4-4-…md:569-595` |
| Deploy run level, 4.3's coarser reading | ~60 s | `4-3-…md:1038-1053` |
| `ci.yml` full run | ~540 s (Lint 143 · Type Check 86 · Unit Tests 467 · Build 113) | `ci.yml:6-16` |
| CI wall clock per PR, Story 2.5's five | 646-653 s | `deferred-work.md:1206-1209` |
| Scheduler delay, this repo | **44 s** across five probe firings | `4-6-…md:651-660` |
| Bounds inside `deploy` | pull `timeout 300`; checkout fallback `timeout 300`; health poll **120 s** | `:964`, `:1038`, `:1542` |

🔴 **Job-level and run-level are different numbers and must never be mixed.** Story 4.4's review M8
had to correct exactly that (`4-4-…md:2117-2133`). AC2's verdict is run level; the job level is the
comparison.

### 5. Anti-patterns for this story

- **Measuring AC2 with the `deploy` job's own duration.** §4 — the job's own 10-minute timeout makes
  the AC unfalsifiable, and AC1 would already imply it.
- **Reading the budget verdict off an average.** §4. The AC says "each".
- **Inferring concurrency behaviour from timestamps.** §9. On a `capacity: 1` runner it is the same
  observation as a queue for a free slot; this is the false positive Story 1.3, Story 3.6 and Story
  4.4 each had to design around.
- **Treating five green deploys as evidence about concurrency.** They are evidence about the deploy.
- **Reporting "both stands healthy" for AC3.** §7. Twice bitten.
- **Arguing the stand was untouched after the 404 instead of observing it.** §8, Task 5.6. Story 4.3
  could only argue it because runs 949 and 950 followed immediately.
- **Reusing the 40-hex-SHA recipe for the 404 row.** §8 — the sanitizer changed under it.
- **Patching a defect found mid-validation.** §1. Record it for 4.8.
- **Adding a "tiny" evidence step to a workflow.** §1. Story 4.6 spent 23 runs on four lines of one.
- **Letting branch N's content depend on branch N−1's results.** Task 2.3 — Story 2.5's own
  anti-padding guard was unreachable for exactly this reason.
- **Editing a test to make a replayed diff pass.** Task 2.2. The replay is wrong, not the suite.
- **Quoting a run "number" without saying whether it is `id` or `index`.** §5.
- **Reconstructing the evidence table at the end.** Task 4.6 — write each row as it happens; a
  reconstruction is a memory, not a measurement.

### 6. Previous story intelligence

- **Story 4.1** created `docker-compose.stand.yml` as a **new** file, leaving
  `docker-compose.server.yml` untouched to the byte, under the rule *«непроверенное считается
  живым»*. That single decision is why §2's wall exists. It also found that `docker compose config`
  is **blind to network existence** — only an actual `up` catches it (D27), which is why five real
  `up`s are worth something.
- **Story 4.2** provisioned the stand and met AC3/AC5's unreachable-host problem first. Its verdict —
  *"recording the substitution is the deliverable"* — is the template this story's AC3 follows.
- **Story 4.3** built the deploy, spent **five red dispatches** before its first PASS, and closed
  with the note every story since has budgeted against: on this instance, telling two causes apart
  costs a dispatch each **because logs are unreadable**. 🔴 **That premise is now partly false**
  (§5a) — which is why this story can promise per-step attribution for free, and why a red deploy
  here should cost a *log read*, not a re-dispatch.
- **Story 4.4** serialized the deploy, converted six of seven failure causes to zero-dispatch
  findings, and closed at **16 runs against a ~20 floor with zero red dispatches**. Its practice is
  now standard, not optional. It also left AC1 **UNPROVEN** for want of DB access — this story closes
  it in passing.
- **Story 4.6** armed the weekly reset, found both of §5's capabilities, and overran its floor by
  60-95% on a four-line evidence step. Its lesson is §1's prohibition.
- **Story 2.5** is the structural twin — Epic 2's five-consecutive-real-PRs validation. Its shape is
  borrowed throughout: the binding redefinition of "real", the immutability rule, the per-run verdict,
  the "measured, not computed" label, and the ledger reconciliation that proves no run was hidden.

### 7. Non-goals — absences that are decisions, not omissions

- **Rollback after `down` → Story 4.8.** §8. Decided in writing, not skipped.
- **Slack notification → Story 4.5**, parked by Oleg. No step is written, no AC depends on one, and
  `story-4-5/pr-1-context` is not read, merged, cherry-picked or built upon.
- **Factoring the shared deploy mechanics → Story 4.8.** This story deliberately hands it a cost
  profile (Task 7.4) rather than pre-empting the refactor.
- **Extending the CI gate to `staging`/`development`** — closed by D25, not extended.
- **Queue depth beyond three, and `flock`'s wake order beyond two contenders → Story 4.8.** Task 6.7
  says so rather than implying the probe settled more than it did.
- **Merging the five branches.** Epic 4's premise is deploying without merging; merging would test a
  different claim.
- **Deleting the five branches → Story 4.9's cutover.** Task 10.5.

### 8. Conventions that bind this story

- **Story file in English** per `_bmad/bmm/config.yaml`; **D-records in Russian** matching
  `docs/migration-decisions.md`. Next free number **D32** — verify against open branches first.
- **Branch** `story-4-7/pr-<n>-<purpose>`; PR into `main`. `main` is protected with eight required
  contexts and `apply_to_admins: true` (D16).
- 🔴 **`D4`/`E5` collide across two numbering schemes.** The retro action items are **retro-D4** /
  **retro-E5** (`epic-3-retro-2026-08-18.md:77-78`). The D-series in `docs/migration-decisions.md` is
  a different sequence — its `D4` is stand parameterization and it has no `E5`.
- **retro-D4 (run ledger):** declare before work; close only against a query; **re-query after the
  merge.**
- **retro-E5 (live outcome matrix):** every new guard proves itself on a run that fails as well as
  one that passes. 🔴 **This story ships no new guard**, so E5 is discharged by exercising the
  existing ones' failing branch — AC4's 404 row — rather than by inventing a new pair. Say that
  explicitly rather than letting E5 look unaddressed.
- **`deferred-work.md`:** append at EOF, never rewrite in place; closures go **under** the original;
  superseded text is struck (`~~…~~`), not deleted; owners are names or story numbers, never trigger
  conditions; a section routing more than one item opens with a preamble stating how many findings
  the round produced and why these are somebody else's.
- **No `${{ }}` in any `run:` body**, comments included. Vacuously satisfied under Prohibition 1.

### 9. Things pending on Oleg — do not depend on them silently

| Item | State | Effect on this story |
|---|---|---|
| Revoke `fe_review_1_7` | **Pending** (`deferred-work.md:39-54`) | A ledger query via `/root/.fj_token` will start returning `401`. **That is the revocation, not a bug.** Fall back to `fe_tmp_1_7`/`fe_pkg_3_6`; record it; never print a value |
| `SLACK_CD_WEBHOOK_URL` restore | **Pending**; Story 1.13 overwrote it with `example.invalid`, which also broke `CRM/api-prionex` | **None.** Do not "fix it in passing" — the value is shared with another team's pipeline |
| `KONG_PORT=8330` — published host port or in-network? | **Open, unverified** | **None.** Do not pick it up. The Kong alias guard runs on every deploy and is not this story's to change |
| Story 4.5 PARKED; `story-4-5/pr-1-context` @ `badbb1ac` unmerged | Parked by Oleg, 2026-08-21 | 🔴 Do not read, merge, cherry-pick or build on it |
| "Developers report no disruption" (AC3) | **Not asked** | AC3's PENDING clause (b). Task 8.7 supplies the literal question |
| Vetoes on §2's binding definition, §4's clock, §7's substitution, §8's rollback routing, §9's probe design, §12's window | Not exercised | All six stand as recorded. Dev Notes §11 is the one-read list |

### 10. Sunday 2026-08-23 02:00 UTC — restated here because it is easy to skip

`dev-reset.yml` is armed: one `action_schedule` row (id 38), one spec (id 39, `'0 2 * * 0'`,
`next = 2026-08-23 02:00:00 UTC`), 44 s measured delay. That firing is the **coordinator's**, and it
is the first with the scheduler's own actor (`trigger_user_id = -2`). §12 is binding: no dispatch
01:45-02:30 UTC, no holder alive across it, and the reset's own two runs get their own labelled
ledger line if they land inside the range. **The reset deploys `ref=main` and will overwrite whatever
the stand is serving** — capture the final host state before the window.

### 11. The autonomous decisions in this story, in one place (for a one-read veto)

1. **§2** — "real feature branch" redefined by five binding clauses; target mix three replays / two
   artefacts; at least one uppercase-bearing name.
2. **§4** — AC2's verdict is **run** wall-clock against 600 s, not the `deploy` job's; and the
   dominant-step clause is widened from "any that exceeded" to all five.
3. **§7** — AC3 narrowed and substituted; the week-long clause and the "no disruption" clause are
   recorded PENDING with named owners rather than asserted.
4. **§8** — AC4 narrowed to the pre-`down` window; the rollback mechanism routed **wholly to Story
   4.8**, resolving the joint 4.7/4.8 ownership in writing.
5. **§9** — DF2 measured by a three-dispatch D1/D2/D3 probe read from the database, never from
   timing; it closes with **UNPROVEN** if the DB is unreachable.
6. **§12** — a hard no-dispatch window around the Sunday firing, and the reset's runs counted on
   their own line.

Each is *autonomous, subject to Oleg's veto*. A veto on 1, 2 or 4 changes the ACs; a veto on 3, 5 or
6 changes only the tasks.

---

### Project Structure Notes

**Files this story writes:**

- `_bmad-output/implementation-artifacts/4-7-validate-dev-deploys-across-five-feature-branches.md`
  (this file)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status transitions only)
- `_bmad-output/implementation-artifacts/deferred-work.md` (Task 9.3, 9.4, 9.5 — appended)
- `docs/migration-decisions.md` (Task 9.6 — **D32**, in Russian)
- Five validation branches, each carrying **one** change (Task 3) — content per Task 2

**Files this story must NOT write** (Prohibitions 1, 2, 6, 7):

`.forgejo/workflows/**` (all of them) · `docker-compose.stand.yml` · `docker-compose.server.yml` ·
`.github/**` · `nginx.conf` · `Dockerfile.prod` · `.env.dev.example` · `vitest.config.ts` ·
anything under `src/` on the story branch · any pre-existing `origin` branch

⚠️ **The circularity to avoid** (Story 2.5's review found it): this story's own file is a legitimate
carrier of "one honest change" for a validation branch **only if the change is chosen at Task 2,
before any push, and does not consist of this story's own accumulating evidence.** Evidence about
run N cannot be branch N+1's payload.

---

### References

- `_bmad-output/planning-artifacts/epics.md:1973-1999` — Story 4.7's four ACs, the source of AC1-AC4
- `_bmad-output/planning-artifacts/epics.md:313` (NFR2) · `:321-325` (NFR5) · `:349-350` (NFR10)
- `_bmad-output/planning-artifacts/epics.md:498-505` — Epic 4's FR/NFR coverage
- `_bmad-output/planning-artifacts/epics.md:1825-1829` — "the deploy must work without it" (Slack)
- `.forgejo/workflows/deploy-dev.yml:115-131` — the three inputs
- `.forgejo/workflows/deploy-dev.yml:155-199` — the `concurrency:` block and its assignment-vs-effectiveness note (§9's premise)
- `.forgejo/workflows/deploy-dev.yml:176` — `cancel-in-progress: false`, and H5's forward reference to 4.7/4.8
- `.forgejo/workflows/deploy-dev.yml:752` — `timeout-minutes: 10` (§4's whole argument)
- `.forgejo/workflows/deploy-dev.yml:761-823` — the ref sanitizer (§11a's other half)
- `.forgejo/workflows/deploy-dev.yml:863-955` — digest resolve and the 404/401/000/`*)` classifiers
- `.forgejo/workflows/deploy-dev.yml:957-968` — the bounded pull; `:1038` the bounded checkout fallback
- `.forgejo/workflows/deploy-dev.yml:1057-1062` — 🔴 the compose-file refusal that falsifies "five real branches"
- `.forgejo/workflows/deploy-dev.yml:1071-1085` — the `org.opencontainers.image.revision` cross-check
- `.forgejo/workflows/deploy-dev.yml:1453` — `down`; `:1542` the 120 s health poll; `:1853` the wall-clock step
- `.forgejo/workflows/dev-reset.yml:132-158` — the cron and the shared concurrency group
- `.forgejo/workflows/dev-reset.yml:88-100` — the self-deadlock warning (do not reintroduce it)
- `.forgejo/workflows/ci.yml:6-16` — the measured CI cost; `:41-66` `push` + `branches-ignore`; `:489-505` the `gate` and `image` jobs
- `.forgejo/workflows/build.yml:850-895` — the builder's sanitizer; `:964-968` "the registry folds case on write"
- `_bmad-output/implementation-artifacts/4-2-…md:460-471` — AC3's precedent: recording the substitution is the deliverable
- `_bmad-output/implementation-artifacts/4-3-…md:76-83` — the AC3 reordering, made *for this story's AC4*
- `_bmad-output/implementation-artifacts/4-3-…md:239-241` — the duration/dominant-step debt 4.3 owed and never paid
- `_bmad-output/implementation-artifacts/4-3-…md:502-513` — run 948, the re-earned 404 row
- `_bmad-output/implementation-artifacts/4-3-…md:534-547` — the unanchored `name=fe-prionex` filter matching five containers
- `_bmad-output/implementation-artifacts/4-3-…md:1639-1654` — H5, the post-`down` rollback gap
- `_bmad-output/implementation-artifacts/4-4-…md:476-483` — the MSK/CEST clock trap
- `_bmad-output/implementation-artifacts/4-4-…md:906-932` — proving things without logs, and the row timing cannot settle
- `_bmad-output/implementation-artifacts/4-4-…md:1984-2008` — M1: the TTL/timeout margin, Prohibition 5
- `_bmad-output/implementation-artifacts/4-4-…md:2117-2133` — M8: job level ≠ run level; the ~21-22 s baseline
- `_bmad-output/implementation-artifacts/4-6-…md:829-836` — job logs ARE readable (§5a)
- `_bmad-output/implementation-artifacts/4-6-…md:1841-1855` — the evidence-step lesson (§1's prohibition)
- `_bmad-output/implementation-artifacts/4-6-…md:962-976` — the NFR5-by-diff shape AC3 copies
- `_bmad-output/implementation-artifacts/2-5-…md:51-98` — the binding redefinition of "real"
- `_bmad-output/implementation-artifacts/2-5-…md:119-131` — the immutability rule (§3)
- `_bmad-output/implementation-artifacts/2-5-…md:206-228` — the DB-only evidence rule and the `id`/`index` trap
- `_bmad-output/implementation-artifacts/2-5-…md:1089-1107` — the ledger reconciliation that proves no run was hidden
- `_bmad-output/implementation-artifacts/3-2-…md:914-941` — 🔴 the mixed-case tag question, open since 2026-08-15
- `_bmad-output/implementation-artifacts/deferred-work.md:94-98` — no cancel endpoint
- `_bmad-output/implementation-artifacts/deferred-work.md:2824-2835` — the rollback entry §8 resolves
- `_bmad-output/implementation-artifacts/deferred-work.md:2909-2923` — Story 4.4's AC1, UNPROVEN
- `_bmad-output/implementation-artifacts/deferred-work.md:2924-2936` — queue depth never measured (owner 4.8)
- `_bmad-output/implementation-artifacts/deferred-work.md:2985-2991` — owners must be names, not triggers
- `_bmad-output/implementation-artifacts/deferred-work.md:2999-3008` — the readable-logs entry
- `_bmad-output/implementation-artifacts/deferred-work.md:3032-3039` — DF1, the unlocked manual/DR path
- `_bmad-output/implementation-artifacts/deferred-work.md:3040-3052` — 🔴 DF2, this story's AC5
- `_bmad-output/implementation-artifacts/deferred-work.md:2513-2519` — the PR-open/merge lines every ledger forgot
- `_bmad-output/implementation-artifacts/epic-3-retro-2026-08-18.md:77-78` — retro-D4, retro-E5
- `docs/migration-decisions.md#d27` (`:2761-2950`) — the new compose file; `docker compose config` is blind to networks
- `docs/migration-decisions.md#d28` (`:2954-3156`) — the stand, `127.0.0.1:8082`, the unreachable stand directory
- `docs/migration-decisions.md#d29` (`:3160-3335`) — the deploy; §5's narrow claim; §8's handoff
- `docs/migration-decisions.md#d30` (`:3339-3445`) — the group and the lock; §1's assignment-vs-effectiveness; §4's capacity-1 argument
- `docs/migration-decisions.md#d31` (`:3449-3634`) — the weekly reset, the schedule, the sweep

---

## Dev Agent Record

### Agent Model Used

_To be filled by the dev agent._ Story context produced by Opus 5 coordinating, with parallel
research subagents over the 4.3/4.4/4.6 story records, `deferred-work.md`, the D-records and the
Story 2.5 precedent; every load-bearing claim re-verified first-hand against the repository at
`0d4b6dfc` before it entered this file. Model split per Oleg's standing instruction: create-story
Opus, dev-story Sonnet, code-review Opus.

🔴 **A subagent report is not evidence.** Every number in this story's evidence table must be
obtained first-hand by the dev agent from the database, the task log, or the host.

### Debug Log References

_To be filled by the dev agent._

### Run Budget Ledger

_Declared at Task 1.5, before the first push, per the model in Dev Notes §10 — a floor, not a flat
count. Baseline to be recorded at Task 1.4. **Closes only against a query re-run after the merge
commit lands** (retro-D4)._

### Completion Notes List

_To be filled by the dev agent._

### File List

_To be filled by the dev agent._

---

## Open Questions for Review

### Blocking

_None known at creation time. Every precondition is verified present at `0d4b6dfc`: `deploy-dev.yml`
and `dev-reset.yml` are on `main`, the stand is provisioned, the org registry secrets exist, s1 is
reachable, and both new evidence channels are documented with the exact commands._

### Non-blocking

1. **The five branches are cut from `main` and carry replayed or project-owned changes, not a
   developer's independent feature work** (§2). That supply does not exist on Forgejo until Epic 7
   moves the team onto it. The validation tests the deploy pipeline completely; it does not test a
   developer's workflow. Whether that gap matters to the cutover decision is **Oleg's** call, not
   this story's.
2. **AC3 cannot observe the legacy stand at all** (§7). Two of its three clauses are recorded PENDING
   with named owners — the week-long observation to the **coordinator** (folded into the Monday check
   that already owns the Sunday scheduler firing), the "no disruption" question to **Oleg**. If the
   cutover decision needs either answered before Story 4.9, that scheduling is Oleg's.
3. **AC4 is closed for the pre-`down` window only, by written decision** (§8). The post-`down` window
   has no rollback and run 937 is the live proof. Routed wholly to **Story 4.8**. If Oleg wants the
   rollback in 4.7 instead, that is a veto on §8 and it changes the story's shape — it would add a
   mechanism, an outcome matrix, a deliberate break-and-repair of the stand, and it would reset §3's
   count.
4. **AC5 may close UNPROVEN** (§9). The probe is designed and safe, but it depends on reaching
   Forgejo's Postgres, and the record contradicts itself about which host that database is on
   (Task 1.3). An honest UNPROVEN is the acceptable outcome; an inferred PASS is not.
5. **The five branches are left on `origin` after the story closes** (Task 10.5), with deletion handed
   to Story 4.9's cutover. Their `-dev` image tags expire on their own at 14 days. If Oleg prefers
   them deleted at closeout, that costs nothing and no run — say so and it is done.
6. **This story deliberately does not exercise `simulate_bad_credential`.** AC7's 401 path was earned
   live by Story 4.3 at run 949 and re-earning it would buy a duplicate row at the cost of a
   dispatch. Named here so the absence reads as a decision rather than an oversight.
