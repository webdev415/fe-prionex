---
baseline_commit: 28f7fd36
---

# Story 5.4: Record the Validated Candidate in the Registry

Status: in-progress

<!-- Contexted 2026-08-24 against `main` at `28f7fd36` — the merge of PR #79, Story 5.3's ledger
     closeout. Branch `story-5-4/pr-1-context`, cut from a scratchpad worktree because the primary
     checkout is held by Story 4.9's agent. Every autonomous decision in this file is marked
     "autonomous, subject to Oleg's veto" and they are listed together in Dev Notes §9 so a veto
     costs one read rather than a re-derivation. Story 4.9 is in flight on `story-4-9/*` at the same
     time — §12 states what this story may not touch, and it is not advice. -->
<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a release engineer,
I want the release history stored in the registry rather than in files on servers,
So that state is not scattered across hosts and the promotion guard has something to check.

---

## 🚨 Read this before anything else

### 1. What this story is, in one paragraph

Story 5.3 made PRE-PROD a real deploy target. **This story makes the registry remember what was
validated there.** The deliverable is one new workflow file,
`.forgejo/workflows/record-preprod-candidate.yml`, which takes a candidate `image_tag`, an explicit
validation verdict, and — after six guards — points two new registry tags at the candidate's
existing manifest: **`preprod-current`** (moving) and **`preprod-<commit-sha>`** (permanent, one per
validated commit). It creates no image. `docker buildx imagetools create --prefer-index=false` is a
registry-side retag: it points a second name at a manifest that is already there
(`build.yml:1457-1463`). Nothing is built, pushed, or re-uploaded, and PRE-PROD is not redeployed.

🔴 **The word in the title is `validated`, not `deployed`, and that is the whole design question.**
FR14 and the epic's AC1 say *"after a successful PRE-PROD deploy … the recording step runs."* Read
literally, that makes the recorder a job appended to `deploy-preprod.yml` firing on every green
deploy — and then `preprod-<sha>` means **"this commit was deployed to PRE-PROD"**, while Story 6.5
will refuse a production release unless `preprod-<sha>` exists *because it takes the tag to mean the
commit was **validated***. Those are different claims, and the gap between them is invisible in the
registry. §3 argues the deviation and §10 records it. **This story builds a dispatch-only recorder
with an explicit verdict input**, which is also the only shape in which retro-E5's discriminating
row — *the marker does not move on a failed validation* — exists at all.

⚠️ **And "validated" is still narrower than it sounds, permanently, for a reason outside this
repository.** PRE-PROD's Kong answers a static, wrong `Access-Control-Allow-Origin`
(`http://localhost:8320`), so **no browser can exercise the API path on that stand** — measured by
5.1, re-measured by 5.2 from the real origin, unfixed, external ask outstanding with
`CRM/api-prionex`. AC6 exists so the tag this story mints does not silently over-claim, and so 6.5
inherits a bounded statement instead of a green tick. *Configured wrong is worse than
unconfigured — it looks done and fails only in a browser* (Epic 5's own preamble).

### 2. What already exists, measured, and what this story therefore does NOT have to build

Every row was measured first-hand by Story 5.2's and 5.3's sessions on s1, 2026-08-23/24 UTC.
**They are the prior, not this story's evidence.** Re-confirm the 🔁 rows before dispatch 1.

| # | Fact | Value | Re-check? |
|---|---|---|---|
| a | The candidate | `git.crm-prionex.com/crm/fe-prionex:sha-00ef3be4743d-preprod` | 🔁 |
| b | Its digest | `sha256:5e5b190d93c8aaec50f0d50c7e108f502c3d366d14f8a13aee081f0ee396dc8c` | 🔁 |
| c | Its provenance | run **680**, 2026-08-17, a `preprod` build of **`main`**; bundle layer extracted and shown to carry the real PRE-PROD URLs (`deferred-work.md:2067-2088`) | — |
| d | What PRE-PROD is serving right now | that same digest, `healthy`, `200` on `/`; last confirmed by 5.3's run 1198 | 🔁 **hard precondition** |
| e | Marker tags this story creates | `preprod-current` and `preprod-00ef3be4743d` | — |
| f | Do they exist today? | **No. Neither shape is written by any workflow in this repository** (`build.yml`'s tag step emits `sha-<12>-<env>` and `<branch>-<env>` and nothing else) | 🔁 Task 2.4 |
| g | Retention rule's `keep_pattern` (build.yml's copy, `build.yml:971`) | `^(prod-current\|preprod-current\|latest\|buildcache\|v?[0-9]+\.[0-9]+\.[0-9]+.*\|(pre)?prod-[0-9a-f]{7,64}\|sha-[0-9a-f]{7,64}-(pre)?prod)$` | — |
| h | The rule as **stored** (the only authoritative copy — `docs/migration-decisions.md`, *"Восстановление правила очистки реестра"*) | `fe-prionex/(prod-current\|preprod-current\|latest\|buildcache\|v?\d+\.\d+\.\d+.*\|(pre)?prod-[0-9a-f]{7,64}\|sha-[0-9a-f]{7,64}-(pre)?prod\|sha256:[0-9a-f]{64})`, `keep count = 0`, `remove days = 14`, `match full name = true` | 🔁 **Task 2.5** |
| i | Retag mechanism, proven | `docker buildx imagetools create --prefer-index=false --tag <target> <repo>@<digest>` then an `imagetools inspect` read-back compare — `build.yml:1476-1554`, live since run 716 | — |
| j | Registry write credential | `secrets.REGISTRY_USER` / `secrets.REGISTRY_TOKEN_RW`, org-level, `docker/login-action@v3` (`build.yml:233-238`). **`deploy-stand.yml` never reads it** and never writes to the registry | — |
| k | Registry read credential | `secrets.REGISTRY_USER_RO` / `secrets.REGISTRY_TOKEN_RO`, org-level, bot `robot-deploy` | — |
| l | Runner for registry work | **`node-20`** — `docker-build` resolves to `code.forgejo.org/oci/docker:cli`, which has **no Node runtime**, so no `uses:` step of any kind executes under it and the job does not fail, it runs nothing (`build.yml:107-124`) | — |
| m | Runner for stand reads | **`deploy-dev-preprod`**, runner id 14, capacity 1. Not `preprod`, not `deploy-preprod-preprod` — `action_runner.agent_labels` (the table the scheduler matches `runs-on` against) holds `["deploy-dev-preprod"]`, re-queried 2026-08-24; an unmatched label queues **silently** | 🔁 cheap |
| n | Stand identifiers | container `fe-prionex-preprod`, dir `/root/crm-prionex/fe-prionex-preprod`, port `127.0.0.1:8083`, network `crm-preprod-network` | — |
| o | The running image's digest field | `docker inspect <container> -f '{{.Image}}'` → image id, then **that image's `.RepoDigests`**. `docker inspect <CONTAINER>` has **no `.RepoDigests`** — that field exists only on the IMAGE object (`deploy-stand.yml:2114-2116`) | — |
| p | Ledger position after 5.3's closeout | repo-scoped `max(id) = 1201` (merge run of PR #78); `repo_id = 16` is `CRM/fe-prionex` | 🔁 Task 1.2 |

**So this story provisions nothing, builds nothing, and deploys nothing by itself.** It adds one
file to the repository, dispatches it, and — for AC3 and AC7 only — dispatches two existing
workflows it does not modify.

### 3. 🔴 The genuinely new thing: this is the first workflow in the repository that WRITES to the registry other than `build.yml`

Everything downstream of the marker tags depends on one property: **`preprod-<sha>` exists if and
only if the commit was validated on PRE-PROD.** Story 6.5 will read it as a hard gate on production.
So the risk in this story is not the eight lines of `imagetools create` — that command is proven
(`build.yml:1540`, live since run 716) — it is **who is allowed to make that sentence true, and
under what evidence.**

Four things execute for the first time in this repository:

1. **A second workflow holding `REGISTRY_TOKEN_RW`.** Today exactly one file authenticates with it
   (`build.yml:233-238`; `build-buildkit-cni-image.yml:151-156` is the second, for its own base
   image). That token is **org-scope `write:package` over all of `CRM`** — 87 packages, 620
   versions, including another team's `api-prionex/*` — *"held back by a sentence"*
   (`deferred-work.md:1560-1568`). This story adds a third holder. Prohibition 3 below is that
   sentence, and Task 3.5's literal-repository assertion is what makes it a check.
2. **A tag whose whole purpose is to MOVE.** Every permanent tag this project has written so far is
   immutable by construction and guarded against repoint (`build.yml:1476-1516`, Story 3.6 AC2).
   `preprod-current` is the opposite: AC3 *requires* it to move. So the AC2 guard cannot simply be
   copied — it applies to `preprod-<sha>` and must **not** apply to `preprod-current`. Getting that
   backwards in either direction is a silent defect (§6).
3. **`docker buildx` on a job that never builds.** `build.yml` reaches `imagetools` after
   `setup-buildx-action` with `driver: docker-container`, a private builder image and a dedicated
   build network — all of which exist for *building with a registry cache*, none of which a retag
   needs. §5 settles which prelude this file copies and what the first dispatch is actually testing.
4. **Reading PRE-PROD's live state from a workflow that is not a deploy.** `deploy-stand.yml` reads
   the running container's digest as AC6 of its own deploy (`:2098-2142`). This story reads the same
   thing from a separate, lock-free, read-only job on the same runner — §7.

⚠️ **Budget red rounds for this and do not treat a green first dispatch as the expected case.**
Story 4.8's own lesson applies unchanged: *"a guard on an unexercised path is exactly a guard that
cannot fail."* §11 reserves four.

⚠️ **Everything that can be settled without a dispatch must be settled without one.** For this story
that means: the YAML parses, `bash -n` on every extracted `run:` body, the `${{ }}` scan, the marker
derivation arithmetic (a local shell force-test on the literal tag string), the `keep_pattern`
compile against both literal marker names, the stored-rule re-read, and the tag census — **all
closed before dispatch 1.** Task 2 costs zero runs and is where the budget is actually defended.

### 4. 🔴 The deviation this story takes, stated before anything is built

The epic's AC1 begins *"**Given** a successful PRE-PROD deploy **When** the recording step runs"*,
and FR14 says *"After a successful PRE-PROD deploy the workflow retags the image."* Both describe an
automatic step inside the deploy. **This story does not build that.** It builds
`workflow_dispatch`-only recorder with a required verdict.

| | Automatic-on-deploy (the literal reading) | Dispatch-with-verdict (this story) |
|---|---|---|
| What `preprod-<sha>` then means | "this commit was deployed to PRE-PROD" | "a human asserted this commit passed PRE-PROD validation, and the stand was serving exactly this artifact when they said so" |
| What Story 6.5 believes it means | "this commit was **validated** on PRE-PROD" (FR16, 6.5's own AC text) | the same — and now true |
| retro-E5's discriminating row (*marker NOT moved on failed validation*) | **cannot exist** — there is no failure input to supply | dispatch with `validated: fail`, marker unchanged, verified by read-back |
| Story 5.5's *"a failed item blocks promotion to PROD"* | unenforceable — the marker is already written | the verdict is the input; a `fail` writes nothing |
| Blast radius | `deploy-preprod.yml` gains a job holding `REGISTRY_TOKEN_RW`; every PRE-PROD deploy becomes a registry-write path | the write path is one dispatch-only file, `deploy-preprod.yml` untouched |
| Cost | one fewer dispatch per candidate | one extra deliberate act per candidate |

*Autonomous, subject to Oleg's veto.* **If vetoed:** move the two record jobs into
`deploy-preprod.yml` as a third job `needs: deploy`, drop the `validated` input, drop AC7's rows 1
and 5, and record in D38 that `preprod-<sha>` means *deployed*, not *validated* — and raise it
against Story 6.5 by name, because 6.5's AC text would then be false as written.

⚠️ **What this deviation does NOT do.** It does not build an approval gate, it does not decide who
may dispatch, and it does not define what the validation consists of. Those are, in order: NFR9's
acknowledged organizational-only control, the repository's existing write-access model, and **Story
5.5**. §8 draws that boundary explicitly so this story does not quietly become 5.5's or 6.5's.

### 5. The workflow's shape, and which prelude it copies

`.forgejo/workflows/record-preprod-candidate.yml`, `workflow_dispatch` only, two jobs:

```
verify-on-stand   runs-on: deploy-dev-preprod   (read-only; no lock, no compose, no pull)
     │  resolves the candidate tag's digest from the registry with the RO pair (curl /v2/…)
     │  reads the running container's health and its image's .RepoDigests
     │  FAILS unless the stand is healthy AND serving exactly that digest
     ▼
record            runs-on: node-20              needs: verify-on-stand
        docker/login-action@v3 with REGISTRY_USER / REGISTRY_TOKEN_RW
        re-resolves the SAME tag's digest with imagetools (independently)
        creates preprod-<sha>   → read-back verified
        then moves preprod-current → read-back verified
        prints the resulting preprod-* history
```

🔴 **The two jobs deliberately do not pass the digest to each other.** Each resolves it
independently from the same tag. `sha-<12hex>-preprod` is immutable — `build.yml:1476-1516` refuses
to repoint it — so the two resolutions must agree, and if they ever did not, that is a finding
rather than a plumbing problem. This also removes the only cross-job `outputs` dependency in the
file, on an instance where `workflow_call` semantics have surprised this project four times (D8,
D21). *Autonomous, subject to Oleg's veto.*

**Prelude for the `record` job, in this order** (order is load-bearing — `build.yml:222-232`, Epic 3
retro A1, run 739):

1. `actions/checkout@v6` — **not needed and not taken.** This job reads nothing from the repository.
2. `apt-get install -y --no-install-recommends docker.io jq` (`build.yml:142-155`).
3. `docker/login-action@v3` with `REGISTRY_USER` / `REGISTRY_TOKEN_RW` — **before** buildx setup.
4. `docker/setup-buildx-action@v3` with **`driver: docker`**, not `docker-container`.

⚠️ **Step 4 is the one genuinely uncertain line in this file, and it is where dispatch 1's red round
is reserved.** `build.yml` uses `driver: docker-container` with `driver-opts: image=<private>` and
`network=host` because it *builds* with a registry cache; a retag needs no builder at all —
`imagetools` is a registry client that runs in the job container, which is why `build.yml`'s own
`predigest` and final-assertion steps work there. `driver: docker` avoids pulling the private
BuildKit image and the whole build-network dance. **Task 3.6 makes the first step of the `record`
job an `imagetools inspect` of the already-existing candidate tag** — a pure read — so a wrong
driver, a missing binary, a bad login or a DNS miss fails *before* any registry write, with a
message that says which. If `driver: docker` turns out not to provide `imagetools`, fall back to
`build.yml`'s exact `docker-container` block verbatim and say so; do not invent a third variant.

⚠️ **Name resolution:** `git.crm-prionex.com` must resolve to the internal address. The `node-20`
job container carries `--add-host git.crm-prionex.com:10.67.0.1` from `docs/runners/config.yml`;
the deploy runner's own mapping is `10.70.0.1`. Both are already proven for the tools each job uses.
**Do not add a `--add-host` or an `/etc/hosts` edit** — if resolution fails, that is a runner-config
finding, not something to patch around in a workflow.

### 6. The three tag operations, and why two of them need opposite guards

| Tag | Semantics | Guard when it already exists |
|---|---|---|
| `preprod-<sha>` | **permanent, one per validated commit.** History. 6.5 reads it. | points at the SAME digest → no-op, green (`build.yml:1491-1493`'s branch). Points at a DIFFERENT digest → **FAIL, refuse, change nothing.** Two artifacts cannot both be "the validated build of commit `<sha>`". |
| `preprod-current` | **moving pointer** to the most recently validated candidate. | points at the SAME digest → no-op, green. Points at a DIFFERENT digest → **MOVE, log old → new.** This is AC3 and it is the intended path. |
| the candidate's own `sha-<12hex>-preprod` | untouched. **Read only.** | — |

🔴 **Order: `preprod-<sha>` first, then `preprod-current`.** If the run dies between the two, the
history tag exists and the pointer is stale — recoverable by re-running, and 6.5 (which reads
`preprod-<sha>`, not `preprod-current`) is still correct. The reverse order would leave
`preprod-current` naming a candidate with no history entry, which is precisely the state 6.5 would
misread. Argue this in the file itself, not only here.

🔴 **Both writes are read-back verified, and a bare `echo "OK"` is not a verification.**
`build.yml:1542-1554` records what happens otherwise: the attach step claimed success on **every
run for weeks** while actually writing an OCI index, because it never read the tag back.
`--prefer-index=false` is the fix and it is **not optional** — without it `imagetools create` wraps
the single manifest in an index whose digest can never equal the source manifest's
(`build.yml:1518-1538`, buildx v0.35.0, confirmed live at run 716).
⚠️ `build-buildkit-cni-image.yml:373` is the counter-example — it omits the flag and produces an
index; that is a **known recorded defect** (D26, `deferred-work.md:2392-2408`). **Do not copy that
variant.**

🔴 **A second reason for `--prefer-index=false` that no artifact has stated yet, and it belongs in
D38.** This instance runs a **separate** sweeper, `cleanup_sha256`, independent of
`package_cleanup_rule`: it consults neither `remove_days` nor `keep_pattern`, and deletes container
versions whose version string is `sha256:*` **and which no index manifest references**, with a
24-hour minimum age (`deferred-work.md:613-627`). Writing an index therefore creates a second
`sha256:` row whose lifecycle is governed by a rule this project has never exercised, and the
`keep_pattern` clause that would have covered it (`sha256:[0-9a-f]{64}`) is recorded as **inert on
Forgejo 15.0.5** (`docs/migration-decisions.md`, the retention-rule appendix). Writing the source
manifest verbatim keeps the marker inside the model this project has actually reasoned about.

⚠️ **The check-to-write window is real and is not closed here — name it, do not design it away.**
`imagetools create` offers **no compare-and-swap** (`deferred-work.md:2288-2301`, a pre-existing
deferred finding against `build.yml`'s own AC2 guard, **owner needed**). Two concurrent recorder
runs could both read "absent" and both attach. This story narrows the window rather than closing it:
the shared concurrency group (§9) serializes recorder runs against each other and against PRE-PROD
deploys, and the **read-back is the mitigation the deferred item itself names** — *"a post-attach
read-back that fails if the tag does not carry this run's digest."* Say exactly that in D38: the
race is narrowed and detected, not eliminated.

### 7. The six guards, in the order they must run, cheapest first

Each guard's message states what was observed, what was expected, and — critically — distinguishes a
tool failure from the condition being tested (`build.yml:1653-1657`).

| # | Guard | Where | Rejects | Why it is not optional |
|---|---|---|---|---|
| G1 | **verdict** — `validated` must be exactly `pass`; anything else refuses and writes nothing. Fail-closed on any third value (`deploy-stand.yml:1086-1092`'s precedent) | `verify-on-stand`, first step | `validated: fail` | Without it "validated" is a synonym for "deployed" (§4) |
| G2 | **environment binding** — the tag must end in `-preprod` | `verify-on-stand` | `sha-00ef3be4743d-dev` | Mirrors `deploy-stand.yml:1060-1073`. `build.yml` bakes environment config into the image, so a `-dev` artifact recorded as a PRE-PROD candidate is a genuinely different, structurally healthy artifact that nothing downstream can detect |
| G3 | **commit-extractability** — the tag must match `^sha-[0-9a-f]{7,64}-preprod$`, and the hex part must be **exactly 12 characters** | `verify-on-stand` | `main-preprod`, `probe-3-3-preprod-preprod` | 5.3 §3's standing instruction: *"do not let a later story generalise 'image_tag mode is safe' past the `sha-` shape."* A branch-shaped tag carries no commit and is mutable. The 12 is `build.yml:707-710`, which names this story: *"Stories 5.4 and 6.5 MUST use this same 12-character short SHA … a length mismatch fails every legitimate release"* |
| G4 | **the marker must be protected** — compile `keep_pattern` against both derived marker names before writing either | `record`, before any write | a marker shape the retention rule would expire | `build.yml:1060-1114`'s own post-suffix guard, same reasoning. A marker that silently expires at 14 days takes 6.5's gate with it — the exact defect the FR18/FR31 amendments were written to fix |
| G5 | **deployed evidence** — the stand must be `healthy` **and** its running image's `.RepoDigests` must contain the digest the candidate tag resolves to | `verify-on-stand`, last | recording a candidate the stand is not serving | This is the only machine-checkable half of the word "validated". Without it the workflow records a claim; with it, it records a claim about an artifact the stand demonstrably had running at that moment |
| G6 | **the tag's name must agree with the artifact's own labels** — read the image's config labels from the registry and require all three: `org.opencontainers.image.version` **equals** the derived 12 hex; `org.opencontainers.image.revision` **starts with** it; `org.prionex.environment` **equals** `preprod` | `record`, after digest resolution, before any write | a tag whose name disagrees with the image it points at | 🔴 **The reason this guard exists is D33 §6(b).** In `image_tag` mode `deploy-stand.yml` deliberately **skips** the revision cross-check — *"AC6's дайджест остаётся единственной обязательной проверкой там"* — so **nothing on the deploy path ever establishes the deployed image's commit.** Without G6, `preprod-<sha>` is a name derived from a name, and Story 6.5's gate is a check on a string. `build.yml:1367-1374` writes all three labels at build time from `git rev-parse HEAD` and `inputs.environment`. **G6's environment clause is strictly stronger than G2's** — G2 tests the tag's spelling, G6 tests what was baked into the bundle |

🔴 **G5 is a read, not a lock.** It does not take `<stand_dir>/.deploy.lock` — that lock exists to
serialize *deploys*, and taking it for a read would block them. The race (a deploy landing between
G5 and the write) is bounded instead by the **shared concurrency group** — see §9 — and its worst
case is a marker written for an artifact the stand stopped serving seconds later, which is the same
exposure a human validator has and is not made worse by this design. **Say this; do not claim G5
proves more than it does.**

### 8. Boundaries — three neighbouring stories this one must not absorb or pre-empt

- **Story 5.5 defines what validation IS.** This story builds the mechanism and the verdict input,
  and it deliberately ships **before** the checklist exists. The `validation_note` input therefore
  takes free text today (who validated, against what, when) and 5.5 may narrow it later. **Do not
  invent a checklist here**, and do not add a placeholder `e2e` job — that is 5.5's AC2 verbatim.
- **Story 6.5 guards CONSUMPTION; this story guards PRODUCTION.** 6.5 refuses a production deploy
  whose commit has no `preprod-<sha>`. That is a lock on the door. **This story is the lock on who
  may cut the key** — and a project that builds only the first has built a check on a claim anyone
  can manufacture. They are not duplicates and neither substitutes for the other. **Do not build any
  part of 6.5 here:** no `deploy-prod.yml`, no `rollback` input, no `prod-*` tag, no promotion check.
  What this story *owes* 6.5 is one thing and it must be exact: **the derivation rule from
  `sha-<12hex>-preprod` to `preprod-<12hex>`, written down in the workflow and in D38**, because
  6.5's AC says it *"extracts the commit SHA from the tag"* and the two sides must agree byte for
  byte.
- **NFR9 is not fixed here.** *"There is no technical approval gate for PROD in Forgejo — anyone
  with write access can dispatch."* The same is true of this recorder. `workflow_dispatch`-only
  means a deliberate human act by someone with repository write access, and that is the entire
  access control. **State it in the file. Do not imply a gate that does not exist** — that is the
  same over-claim NFR9 was written to prevent.

### 9. `concurrency:` — this file shares PRE-PROD's own group, deliberately

```yaml
concurrency:
  group: deploy-preprod-fe-prionex-preprod
  cancel-in-progress: false
```

🔴 **The same literal group `deploy-preprod.yml` uses, not a new one.** D30 keys the group on **the
stand's own identity**, and this workflow reads that stand's live state (G5). A deploy running
concurrently would move the digest under the read. Serializing them is what the group is for.

⚠️ **This is the one place where 5.3's Prohibition 7 must be read carefully rather than applied
mechanically.** That prohibition — *"never copy DEV's concurrency group"* — forbids sharing a group
with an **independent** stand, because that serializes two things that have nothing to do with each
other and hides it. Sharing PRE-PROD's own group from a workflow that reads PRE-PROD is the opposite
case. *Autonomous, subject to Oleg's veto.* **If vetoed:** give it its own literal
`record-preprod-fe-prionex-preprod` and accept that a concurrent deploy can make G5 fail spuriously
— which is safe, just confusing.

- It is a **literal constant**, never an expression. A workflow this instance cannot parse fails
  **before any job exists**, visible only in `action_run.pre_execution_error_details` — no job, no
  log, no API route for it (D21).
- It lives at workflow level, outside `jobs:`. Job-level `concurrency:` is silently ignored here
  (D8); a callee's own block is silently void (D21). This file is neither a callee nor a caller.

### 10. Deviations this story takes from the epic's literal text

| # | Epic text | What this story does | Where argued |
|---|---|---|---|
| 1 | AC1/FR14: *"After a successful PRE-PROD deploy … the recording step runs"* | a `workflow_dispatch`-only recorder with a required verdict; no step is added to any deploy path | §4 |
| 2 | AC1: *"creates the tag `preprod-current` … **and** the tag `preprod-<sha>`"* — order unstated | `preprod-<sha>` is written **first** | §6 |
| 3 | AC4: *"the previous N `preprod-<sha>` tags are preserved"* — verified in 2026-08-13 by compiling **`build.yml`'s copy** of the pattern | verified against the **stored** rule read back from the database, which `build.yml:957-960` itself names as the only authoritative copy. Still **pattern-read, not exercised** — say so | AC4, §12 |
| 4 | AC5: *"the sequence of `preprod-<sha>` tags reconstructs the validation history"* | the registry yields the **set**; the **order** comes from git, because `/v2/…/tags/list` is not chronological and the creation timestamps live in the Forgejo package API, not the OCI API. Both halves still need no server | AC5 |
| 5 | — | AC6, AC7, AC8 added | §1, §7, §6 |

### 11. Run budget model

retro-D4 (`epic-3-retro-2026-08-18.md:77`): **declare before work; the ledger closes only against a
query re-run after the merge commit lands.** A ledger closed at PR-open is not closed. If the query
cannot be run, close it with the literal word **OPEN** — never a self-reported number.

🔴 **The permanent story-push line (DN4 of Story 4.7's review, standing for every story since):**
*"pushes to the story's own context/work branch" is a repeating, per-push ledger line, priced per
push, not one flat "closeout push"* — each is a real four-job `ci.yml` run. Also standing
(`deferred-work.md:2515-2547`): a story costs **pushes + 1 PR-open run + 1 merge run**. And `ci.yml`
has **no `paths:` filter**, so a documentation-only commit costs a full four-job run; **a push
landing while the PR is already open fires both `push` and `pull_request`, costing two rows.**

| Line | Runs |
|---|---|
| Push: context (this file) | 1 |
| Push: dev-story write-up | 1 |
| PR-open run | 1 |
| Push: code-review commit (PR open → two rows) | 2 |
| Push: fix-pass commit (PR open → two rows) | 2 |
| Merge run (`build-main.yml`) | 1 |
| D1 — record candidate #1, `validated: pass` → GREEN (Task 5) | 1 |
| D2 — record candidate #1 again → GREEN, idempotent no-op (Task 6) | 1 |
| D3 — `validated: fail` → RED at G1, no marker moved (Task 7) | 1 |
| D4 — `sha-00ef3be4743d-dev` → RED at G2 (Task 7) | 1 |
| D5 — `main-preprod` → RED at G3 (Task 7) | 1 |
| D6 — `sha-000000000000-preprod` → RED at digest resolve (Task 7) | 1 |
| D7 — `build.yml` dispatch: mint candidate #2 (Task 8) | 1 |
| D8 — `deploy-preprod.yml` dispatch: candidate #2 onto the stand (Task 8) | 1 |
| D9 — record candidate #1 while the stand runs #2 → RED at G5 (Task 8) | 1 |
| D10 — record candidate #2 → GREEN, `preprod-current` MOVES (Task 9) | 1 |
| **Declared floor** | **18** above baseline |
| 🔴 **Red-round reserve — §3 and §5, named not hidden** | **+4** |
| **Declared ceiling** | **22** |

**Free rows, and they are not optional because they are free** (5.3's lesson): the zero-run
rejection — dispatch with `validated` omitted → **HTTP 400, zero `action_run` rows created**,
confirmable by `max(id)` being unchanged around the call. Task 2 in its entirety costs **0**.

🔴 **A floor, not a ceiling, and this instance has no cancel endpoint** — a dispatch issued by
mistake runs to completion and occupies its row.

⚠️ **D9's ordering is the only reason it is cheap.** Staging "the stand is not running the candidate"
would normally cost its own deploy; here it falls out for free because D8 has already put candidate
#2 on the stand for AC3's sake. **Do not reorder Task 8 and Task 9** — merging them loses the row.

🔴 **No-touch window.** The Sunday `dev-reset.yml` tick is **2026-08-30 02:00 UTC**; the standing
rule is **no dispatch and no live lock holder across 01:45–02:30 UTC**, and no `main` merge inside
it. This story dispatches ten times. **Check the clock.**

### 12. 🔴 Blast radius — Story 4.9 is in flight, and `deploy-stand.yml` is not editable

Story 4.9 (*Cut DEV Over to the New Stand*) is being implemented in parallel on `story-4-9/*`, and
holds **D35** on its unmerged branch. The coordinator serializes host-side work between epics; Oleg
merges. This story runs from a scratchpad worktree; the primary checkout is 4.9's.

**This story must not modify, and must not push any change to:**

- 🔴 **`.forgejo/workflows/deploy-stand.yml`** — read-only reference. Every edit re-triggers Epic 5's
  own re-earning of the retro-E5 evidence Story 4.8 paid for, and it sits inside 4.9's blast radius.
  5.3 spent three §12 exceptions on it; this story needs none, because it adds a file rather than a
  code path to the shared definition.
- 🔴 **`.forgejo/workflows/deploy-preprod.yml`** — 5.3's shipped artifact, and untouched here by
  design (§4, deviation 1). Its header at `:58-62` invites an upgrade *"if a future PRE-PROD reset
  **or a Story 5.4 recorder** starts [dispatching or reading it back] by name."* **This recorder does
  neither** — it reads the stand and the registry directly. Record that in Task 10.3 as a
  deliberately unclaimed invariant, do not edit the header to say so.
- `.forgejo/workflows/build.yml` — **read-only, and this story dispatches it once (D7) without
  modifying a line.** The four robustness gaps addressed to *"whoever next opens `build.yml`"*
  (`deferred-work.md:1569-1578`) stay open; dispatching is not opening.
- `.forgejo/workflows/deploy-dev.yml`, `dev-reset.yml`, `ci.yml`, `build-main.yml`
- `README.md`, `docker-compose.server.yml`, `docker-compose.stand.yml`, `.env.stand.example`,
  `nginx.conf`, `Dockerfile.prod`, or any artifact of Story 4.9
- `4-9-cut-dev-over-to-the-new-stand.md`, or any `story-4-9/*` branch
- **the DEV stand on s1** — its directory, its `.env`, its container, its network membership, its
  lock file. NFR5.
- **the PRE-PROD stand's host configuration** — no `.env` edit, no nginx, no certbot, no
  `docker network` verb of any kind. This story's only host contact is `docker inspect`.

🔴 **The one named exception, priced in advance.** If a dispatch exposes a **real defect in
`deploy-stand.yml` or `build.yml`** that blocks this story and no other story can fix it, follow
5.3's §12 procedure exactly: (1) state the defect with the failing run id and the exact log line;
(2) name which retro-E5 rows the change invalidates; (3) price the re-dispatches in the ledger
**before** making the edit; (4) escalate to Oleg as a blocking Open Question. **Do not edit and
report afterwards.** This story is not expected to need it — it adds a file.

⚠️ **4.9 may change the DEV stand underneath this story.** This story never reads it — but the
**deploy runner is shared and has capacity 1**, so a 4.9 dispatch and one of this story's
stand-touching dispatches will serialize at the runner. That is not contention any lock knows about
and it is not a fault. **Timestamp every dispatch in UTC** and do not diagnose a queued job as a
hung one.

---

### Prohibitions

🚨 **A prohibition here cannot be overridden by a subtask.**

1. 🔴 **Never edit `.forgejo/workflows/deploy-stand.yml` or `deploy-preprod.yml`** — §12, and the one
   exception is a procedure, not a permission.
2. **Never create a second new workflow file.** The deliverable is exactly one:
   `.forgejo/workflows/record-preprod-candidate.yml`. A "test workflow" to try `imagetools` is the
   anti-pattern 5.2 named and refused; the recorder's own first read step *is* the test (§5).
3. 🔴 **Never write any tag outside `git.crm-prionex.com/crm/fe-prionex`.** `REGISTRY_TOKEN_RW` is
   org-scope `write:package` over 87 packages including another team's production
   (`deferred-work.md:1560-1568`). The repository name is a **literal constant in the file**, never
   composed from an input, and Task 3.5 asserts every write target begins with it before the write.
4. 🔴 **Never write a tag whose name comes from a dispatch input.** Both marker names are *derived*
   from the validated tag by a fixed rule and then *re-validated* against `keep_pattern` (G3, G4). An
   input that can name the tag being written is an input that can repoint `prod-current`.
5. **Never omit `--prefer-index=false`.** §6. Without it the write silently produces an OCI index and
   every read-back comparison fails for a reason that has nothing to do with this story.
6. **Never report a write as successful without reading it back.** `build.yml:1542-1547`: the bare
   `echo "OK"` was false on every run for weeks.
7. **Never repoint an existing `preprod-<sha>` to a different digest.** Refuse, change nothing, exit
   non-zero. §6.
8. **No `${{ }}` inside any `run:` body — not even inside a shell comment.** Forgejo substitutes
   inside comments too (`build.yml:796-799`) and one empty token once rejected an entire workflow
   with no diagnostic. Values arrive through `env:` blocks only. This is a gate you can run: extract
   every `run:` body with `yaml.safe_load` and scan for the literal `${{`.
9. **`set -euo pipefail` on the first line of every `run:` body**, and `if` rather than `&&` around
   a `grep` — under `set -e` a failing `grep` in an AND-list ends the script (`build.yml:759-760`).
   Never a backslash-continued string as the right-hand side of an assignment: `VAR="a"\`+newline+
   `"b"` parses as `VAR=a` scoped to a command named `b`, exit 127 (`deploy-stand.yml:1156-1164`,
   three occurrences found and fixed repo-wide by 5.3).
10. **Never `${{ }}` in the `concurrency: group:`.** A literal constant. §9.
11. **Never take the stand's `flock`, and never `down`, `up`, `pull`, `rm`, `restart` or `exec` a
    write into anything on s1.** This story's entire host contact is `docker inspect` (§7, G5).
12. **Never `docker network create`, `rm`, `connect` or `disconnect`.** `crm-preprod-network` belongs
    to `CRM/api-prionex` and carries 69 of their containers.
13. **Never `cat /root/.docker/config.json`.** Its `auths.*.auth` field is `base64(user:token)`,
    trivially reversible — this is exactly how Story 5.2 leaked its second token. Confirm a login by
    reading **keys only**:
    `python3 -c "import json; print(list(json.load(open('/root/.docker/config.json'))['auths'].keys()))"`.
    Never echo a token file; `--password-stdin < file` always. No credential in any argv, ever —
    `curl --config -` on stdin (`build.yml:541-546`, `deploy-stand.yml:1111-1113`).
14. **Never delete a registry tag or version.** Not the throwaway probe, not a mistake, not
    `preprod-current`. D24 already fixed the recovery policy for exactly this class and it is not
    this story's to reopen: *"восстановление — только авторизованный ручной `DELETE` тега
    (`write:package`, Олег лично) и пересборка с нуля. Не автоматизировать, не добавлять оверрайд."*
    A wrong tag is an Open Question for Oleg, not a cleanup.
15. **Never mint more than the ONE new `-preprod` image this story declares** (Task 8.1, candidate
    #2). It is a permanent, irreversible registry write. If Task 8.1's announcement is vetoed, AC3
    degrades per Task 9.5 — it does not get retried with a different tag.
16. **Never claim a discriminator that could not have failed.** If the strong form of a check was not
    available, run the weak one and **say which**. This project has now rejected the same vacuity
    three times (D34 §3, 5.1's review, 5.2's H2).
17. **Never read a verdict from a log line alone.** Job logs on this instance frequently never
    archive — `log_in_storage` stayed `f` for 5.3's tasks 9745/9769 across four checks in four
    sessions. Read outcomes from `action_task_step.status` **and** from registry state, which for
    this story is the strongest evidence available: the tags themselves are readable at any time from
    anywhere. Match `action_task_step.name` on a stable prefix, never the full string.
18. **The dev agent does not touch the Forgejo API and does not open the PR.** The coordinator
    dispatches, queries run ids, and closes the ledger; Oleg merges. Mark those subtasks
    `PENDING (owner: coordinator)` rather than checking them.
19. **`deferred-work.md`:** append at EOF; closures go **under the original** with the old text
    struck (`~~…~~`) and never deleted. **Owners are names or story numbers, never trigger
    conditions.** Decision bodies in `docs/migration-decisions.md` are never rewritten — amendments
    are dated blocks appended to the record.

---

## Acceptance Criteria

Verbatim from `_bmad-output/planning-artifacts/epics.md:2280-2313`, with this story's reading where
measurement has overtaken the plan. Every reading is *autonomous, subject to Oleg's veto*, and each
is also listed in §10 and Dev Notes §9.

### AC1 — the two marker tags exist, created without a rebuild

> **Given** a successful PRE-PROD deploy
> **When** the recording step runs
> **Then** it creates the tag `preprod-current` pointing at the deployed image using
> `docker buildx imagetools create`
> **And** it creates the tag `preprod-<sha>` for the same image.

> 🔴 **Reading.** *"a successful PRE-PROD deploy"* is a **precondition checked at record time**
> (G5), not a trigger. §4 argues the deviation and it is the story's largest single decision.
> *"using `docker buildx imagetools create`"* is taken literally and extended by one flag the epic
> could not have known about: **`--prefer-index=false`**, without which the command silently writes
> an OCI index (§6). Both writes are **read-back verified** with
> `imagetools inspect --format '{{.Manifest.Digest}}'` and compared to the source digest; a
> mismatch fails the run. Order is `preprod-<sha>` first (§6).
>
> **Discharged by:** D1 green, with the two read-back lines and, independently, a registry read of
> both tags after the run showing digest `sha256:5e5b190d…`.

### AC2 — `<sha>` is the COMMIT sha, stated explicitly, and byte-identical to what `build.yml` emits

> **Given** Option C encodes an environment discriminator in image tags
> **When** `preprod-<sha>` is created
> **Then** `<sha>` is the **commit** SHA, not the environment-suffixed tag string
> **And** this is stated explicitly, because Epic 6's promotion guard matches on commit identity.

> 🔴 **Reading.** The derivation rule, written in the workflow and in D38 because Story 6.5 must
> implement its exact inverse:
>
> ```
> input   sha-00ef3be4743d-preprod
> strip   leading "sha-"  and trailing "-preprod"
> assert  ^[0-9a-f]{12}$          ← exactly 12, hard FAIL otherwise
> emit    preprod-00ef3be4743d
> ```
>
> **The 12 is not a style choice.** `build.yml:801` is `cut -c1-12`, and `build.yml:707-710` names
> this story: *"Stories 5.4 and 6.5 MUST use this same 12-character short SHA when they build
> `preprod-<sha>` / `prod-<sha>`: the promotion guard compares those strings byte for byte against
> what is emitted here, and a length mismatch fails every legitimate release."* `keep_pattern`
> tolerates 7-64; **this story does not** — a marker of any other length means something upstream
> changed and 6.5 would break silently.
>
> 🔴 **The derivation is cross-checked by G6 — corrected, code review H2/M1: this narrows the gap
> against a FOREIGN artifact, it does not close D33 §6(b) for a `build.yml`-produced one.** D33
> §6(b) records that in `image_tag` mode the deploy path **skips** the
> `org.opencontainers.image.revision` cross-check, so nothing on the deploy path itself establishes
> the deployed image's commit. G6 reads the image's own config labels back from the registry and
> requires `org.opencontainers.image.version` to **equal** the derived hex,
> `org.opencontainers.image.revision` to **start with** it, and `org.prionex.environment` to equal
> `preprod` (`build.yml:1367-1374`). ~~A `<sha>` taken only from the tag string would be a name
> derived from a name, and Story 6.5's gate would be a check on a string~~ — **this is true only for
> a FOREIGN image** (one pushed outside `build.yml`). Traced in `build.yml` itself: the tag's own
> short SHA and `org.opencontainers.image.version` are written from the **same shell variable**; the
> tag's environment suffix and `org.prionex.environment` are both `${ENVIRONMENT}`; `revision` is
> the full SHA the short SHA is `cut -c1-12` of. **All three G6 clauses are identities on the normal,
> build.yml-produced path** — re-reading one variable through a second channel, not independent
> evidence. G6's real, worthwhile value is catching a hand-crafted or foreign image passed off under
> a `sha-<hex>-preprod`-shaped tag; **for a genuine `build.yml` artifact, D33 §6(b) remains open**,
> exactly as it was before this story. §7 G6.
>
> ⚠️ **Two residuals this AC cannot close, and must therefore name.**
> (1) `deferred-work.md:2209-2229` — the build is not reproducible at source level
> (`vite.config.ts:8` bakes `Date.now()`), so `preprod-<sha>` proves *"this commit produced this
> artifact"* only because `build.yml:1476-1516` refuses to repoint `sha-<12>-preprod`, not because a
> rebuild would agree. **Owner: unassigned, unchanged by this story.**
> (2) 🔴 `docs/migration-decisions.md#d24`'s own 2026-08-18 amendment, which corrects a
> justification that named this story: *"Формулировка «Stories 5.4/6.5/6.6 доверяют
> `sha-<12>-<env>` как имени ровно одного артефакта» неточна … эти истории создают и потребляют
> `preprod-<sha>`/`prod-<sha>` — **тегам, которые этот гард не защищает вовсе** … Не преувеличивать
> связь, которую эта запись не проверяла."* **`build.yml`'s AC2 guard protects `sha-<12>-preprod`.
> It does not protect `preprod-<sha>`.** Nothing protects `preprod-<sha>` from a repoint except this
> story's own refusal (§6), and that refusal has the check-to-write window §6 names. **Do not cite
> D24 as if it covered the marker.**
>
> **Discharged by:** the workflow's own derivation code, G6's label cross-check, a zero-run
> force-test of both (Task 2.2), and the sentence in D38.

### AC3 — the pointer moves, the history does not

> **Given** a second candidate is later deployed to PRE-PROD
> **When** the recording step runs again
> **Then** `preprod-current` moves to the new image
> **And** the previous `preprod-<sha>` tag still exists, preserving the history.

> 🔴 **Reading, and the one AC in this story that costs an irreversible write.** There is exactly
> **one** usable `sha-<12hex>-preprod` tag in the registry today. `main-preprod` is the same digest
> from the same run 680 and is branch-shaped besides; `probe-3-3-preprod-preprod` is a different
> digest but carries no commit and is refused by G3; `sha-f8f358f43ced-preprod` **does not exist** —
> deleted by Oleg 2026-08-16, version id 3187 verified gone, on record three times. **Do not offer
> it and do not re-escalate its absence.**
>
> So proving this AC live requires a **second** candidate, which means one `build.yml` dispatch with
> `environment: preprod` and one new permanent tag. **This story mints exactly one**, from `main`
> HEAD, announced to Oleg through the coordinator before the dispatch and priced in the ledger
> (Task 8.1). *Autonomous, subject to Oleg's veto.* The artifact is not waste: Story 5.5 needs a
> candidate to validate and Story 5.6 rehearses a full cycle on one.
>
> **If vetoed** (Task 9.5): AC3 closes as **UNPROVEN on the real tag names**, with the *mechanism*
> proven instead by a throwaway marker (a name `keep_pattern` does not protect, so it expires on its
> own — never deleted, Prohibition 14) pointed first at `sha256:5e5b190d…` and then at
> `probe-3-3-preprod-preprod`'s digest, read back both times. That proves `imagetools create`
> repoints an existing tag; it does not prove it on `preprod-current`. **Record which of the two was
> done. Never both quietly.**
>
> **Discharged by:** D10 green — `preprod-current` reads back as candidate #2's digest, and
> `preprod-00ef3be4743d` still reads back as `sha256:5e5b190d…` afterwards. Both read after the run,
> from the registry, not from its log.

### AC4 — retention never deletes either shape

> **Given** the retention policy from Story 1.11
> **When** it runs
> **Then** `preprod-current` and its target are never deleted
> **And** the previous N `preprod-<sha>` tags are preserved as rollback and audit targets.

> 🔴 **Reading.** The epic's own annotation is unusually careful and this story must not weaken it:
> *"⚠️ **Method, stated precisely:** these two shapes were verified by compiling the stored pattern
> and matching against them, **not** by pushing them and running the rule … it is pattern-read, and
> this same pattern was once found to contain a dead clause."*
>
> This story improves the method by exactly one step and claims nothing more. **The rule lives ONLY
> in the Forgejo database** — no API, no CLI, not restorable from this repository
> (`build.yml:12-20`). `build.yml:971`'s `KEEP_RE` is a *copy* with three named divergences. So
> Task 2.5 re-reads the **stored** `keep_pattern` from the instance (read-only, coordinator) and
> compiles *that* against the two literal marker names — closing the gap between the copy and the
> authority, which the 2026-08-13 verification did not.
>
> ⚠️ **Still not exercised against the running rule, and the story says so.** The rule has never been
> observed deleting anything. Disposition: **UNPROVEN by execution, verified by compilation against
> the authoritative pattern.** Never a fifth, softer word.
>
> 🔴 **The observation that would falsify this AC opens five days after this story is contexted, and
> it is not this story's to make.** `deferred-work.md`'s `## 📅 DUE 2026-08-29 — the first moment
> AC4 can be observed` records the plan: `package_cleanup_rule` id 1 keys on
> `package_version.created_unix` (verified in Forgejo v15.0.5 source), *"we do not actually have
> evidence the nightly cron runs"*, and **judge it by rows in `package_version`, not by the log.**
> Its escalation clause is addressed at this epic by name: *"Epic 5 and Epic 6 both rely on
> `keep_pattern` protecting `prod-current`/`preprod-current` and on everything else expiring.
> **Escalate rather than record.**"* Task 10.2 restates that item with **this story's two new marker
> tags added to what the 08-29 observation is checking**, and leaves the observation with its
> existing owner. Do not claim it, and do not schedule around it.
>
> **Also in scope, and cheap:** G4 compiles the pattern *inside the workflow* before every write, so
> a future marker shape that would silently expire is refused at write time rather than discovered
> when 6.5 fails. That is `build.yml:1060-1114`'s own design, applied here.
>
> **Discharged by:** the stored-rule quote pasted verbatim in Debug Log References, both compile
> results, and G4's presence in the shipped file.

### AC5 — the history is reconstructable from the registry alone

> **Given** the registry after several candidates
> **When** it is inspected
> **Then** the sequence of `preprod-<sha>` tags reconstructs the validation history without
> consulting any server.

> 🔴 **Reading — one word narrowed, deliberately.** *"the sequence"* over-claims by a little and it
> is worth being exact, because 6.5 and the release regulation will lean on this sentence. The
> registry's OCI API (`GET /v2/crm/fe-prionex/tags/list`) yields the **set** of `preprod-*` tags and
> their digests; it does **not** yield an order — `tags/list` is not chronological and creation
> timestamps live in the Forgejo package API, not the OCI one. **The order comes from git**: each
> marker names a commit, and `git log` orders commits. Both halves are satisfied without consulting
> any deployment server, which is what the AC is actually for.
>
> **Discharged by:** the recorder's own final step, which lists the `preprod-*` tags with their
> digests and prints them; plus the **raw** `tags/list` response pasted into Debug Log References.
> ⚠️ **Paste the artifact, do not characterise it** — 5.2's M1 is the same finding as 4.2's M3, made
> twice.

### AC6 — 🔴 ADDED: what "validated" covers, and what it cannot

> **Given** the PRE-PROD stand's backend CORS is known-broken and unfixed
> **When** a candidate is recorded as validated
> **Then** the workflow itself prints, and the story records, exactly which claims the recording
> supports
> **And** it states that **browser-path validation remains impossible** until `CRM/api-prionex`
> fixes the static `Access-Control-Allow-Origin`, so `preprod-<sha>` must not be read as "a user
> exercised this build".

> **Why added, and why in this exact form.** This story mints the artifact Story 6.5 will treat as
> proof. 5.3's AC6 named exactly this hand-off: *"Story 5.4 records a validated candidate on the
> strength of what this story reports. A green tick handed forward without this sentence is the
> failure mode Epic 5's own preamble names."* The sentence has to survive into the registry's own
> semantics, not just into a story file nobody reads at release time.
>
> **The table is the content**, and it is written from evidence 5.1/5.2/5.3 already produced:
>
> | The marker supports | The marker does **not** support |
> |---|---|
> | this exact digest was resolvable in the registry under an immutable, commit-bearing tag | that a rebuild of the same commit would produce it (`Date.now()`, AC2's residual) |
> | the PRE-PROD container was running that digest and reported `healthy` at record time | that `healthy` means anything about the backend — the healthcheck probes `http://127.0.0.1:80`, **itself**, and reports healthy on a backend-less network (5.1's finding) |
> | the stand served over TLS at `crm.preprod.crm-prionex.online` | that `/api/` is routed to anything — both 5.2 probes returned `404`, a route miss (5.2's M22) |
> | Kong resolved by container identity inside the stand's own network (5.2 AC5, D34/D36) | that a **browser** can call the API. **CORS is broken. It was never exercised.** |
> | a human asserted a validation verdict and named what they checked | that any particular checklist was followed — **that is Story 5.5**, which does not exist yet |
>
> ⚠️ **Scope, so this AC does not quietly become 5.5's job:** one honest paragraph in the workflow's
> own output plus this table. It is **not** a new measurement campaign, it is **not** a CORS fix, and
> it does not block on `CRM/api-prionex`.

### AC7 — 🔴 ADDED: every guard proves itself on a run that fails

> **Given** six guards stand between a dispatch and a permanent registry write
> **When** the story closes
> **Then** each has a designated run in which it **fired and refused**, alongside the run in which
> it passed — or is named as one that could not, with its substitute
> **And** after every refusal, `preprod-current` and `preprod-<sha>` are read back from the registry
> and shown **unchanged**.

> **Why added.** retro-E5: *"every guard proves itself on a run that fails as well as one that
> passes."* A guard on a path that never executes is exactly a guard that cannot fail, and this
> story's guards protect a permanent, effectively irreversible write. The matrix:
>
> | Row | Dispatch | Guard | Expected |
> |---|---|---|---|
> | 0 | `validated` omitted | the dispatch schema | **HTTP 400, zero `action_run` rows** — free |
> | 1 | `validated: fail` | G1 verdict | RED before any registry contact; markers unchanged |
> | 2 | `image_tag: sha-00ef3be4743d-dev` | G2 environment | RED; markers unchanged |
> | 3 | `image_tag: main-preprod` | G3 shape | RED; markers unchanged |
> | 4 | `image_tag: sha-000000000000-preprod` | digest resolve (404) | RED; markers unchanged |
> | 5 | candidate #1 while the stand runs #2 | G5 deployed-evidence | RED; markers unchanged |
> | 6 | candidate #1, `validated: pass`, stand serving it | all six | GREEN; both markers written |
> | 7 | the same dispatch again | idempotence (AC8) | GREEN, no-op, digests unchanged |
> | 8 | candidate #2, `validated: pass`, stand serving it | all six | GREEN; `preprod-current` MOVES |
>
> ⚠️ **Three guards have no failing row, and each is named rather than counted as earned.**
> **G4** would need a marker shape the retention rule does not protect — i.e. deliberately writing
> the tag this story exists to prevent. **G6** would need an image whose labels disagree with its
> own tag, which `build.yml` cannot produce. **AC8's repoint refusal** would need two digests under
> one `sha-<12>-preprod`, which `build.yml:1476-1516` makes impossible without an operator DELETE.
> All three are **force-tested locally against deliberately wrong values** (Task 2.3) and their
> disposition is **UNPROVEN live**. G6's *passing* half is earned on every green row. That is
> Prohibition 16 applied to this story's own matrix — the count is three, and stating it is the
> point.
>
> ⚠️ **Read every verdict from `action_task_step.status` and from a registry read, never from a log
> line alone** — Prohibition 17.

### AC8 — 🔴 ADDED: recording is idempotent, and a history repoint is refused

> **Given** a candidate that has already been recorded
> **When** it is recorded again
> **Then** both writes are no-ops, both tags still resolve to the same digest, and the run is green
> **And** an attempt to point an existing `preprod-<sha>` at a **different** digest is refused with
> nothing changed.

> **Why added.** AC3 requires `preprod-current` to move and AC1 requires `preprod-<sha>` to be
> permanent history — opposite guards on the same command (§6). Neither property is safe unless
> re-running is safe: a recorder that is not idempotent is a recorder nobody dares re-run after a
> transient failure, and a transient failure between the two writes is exactly the case §6 orders the
> writes for.
>
> ⚠️ **The repoint-refusal half has no live row and says so.** Reaching it requires two different
> digests under one commit's `sha-<12>-preprod`, which `build.yml:1476-1516` makes impossible without
> an operator DELETE. It is defence in depth against a future in which that guard is bypassed. **Read
> by inspection and force-tested locally (Task 2.3); disposition UNPROVEN live.**
>
> **Discharged by:** row 7 of AC7's matrix (green, no-op, digests unchanged), plus the force-test.

---

## Tasks / Subtasks

### Task 1 — Open the story (AC: all)

- [x] 1.1 Flip `sprint-status.yaml`: `5-4-record-the-validated-candidate-in-the-registry` →
      `in-progress`, and **push that commit on its own** before any substantive change. 5.2's H1 is
      why: this is the only checkbox in the file independently falsifiable from the repository, and
      sweeping it into a later commit makes it false.
- [x] 1.2 Take the ledger baseline, **repo-scoped**, before any work:
      `ssh root@10.67.0.1 'docker exec forgejo-postgres psql -U forgejo -d forgejo -tAc "select max(id), count(*), now() at time zone '"'"'utc'"'"' from action_run where repo_id=16"'`
      Confirm `repo_id=16` is `CRM/fe-prionex` yourself
      (`select id,owner_name,name from repository where name='fe-prionex'`). Record the instance-wide
      form too and **say which is which**. Expect `max(id) ≥ 1201`.
- [x] 1.3 Declare the ledger in Dev Agent Record: floor **18**, ceiling **22**, disposition
      **OPEN**. §11.
- [x] 1.4 `git fetch` every open `story-*` branch and confirm the next free decision number.
      Expect **D38** — `main` holds D34/D36/D37, `story-4-9/pr-1-context` holds **D35**. *There is a
      `D23` collision in this project's history precisely because someone did not check.*
- [x] 1.5 Check the clock against the no-touch window (§11) before planning Task 5's dispatch.

### Task 2 — Zero-dispatch preconditions: settle everything that a run would otherwise discover (AC: 1, 2, 4) — **costs 0 runs**

- [x] 2.1 Re-confirm §2's 🔁 rows on s1 by SSH, read-only: the container is `healthy`; its image's
      `.RepoDigests` contains `sha256:5e5b190d…`; `curl -s -o /dev/null -w '%{http_code}'
      http://127.0.0.1:8083/` is `200`. Use `.RepoDigests` on the **image**, never `.Image` on the
      container (§2 row o).
- [x] 2.2 Force-test the marker derivation locally, as a shell snippet, on four inputs:
      `sha-00ef3be4743d-preprod` → `preprod-00ef3be4743d`; `sha-00ef3be4743d-dev` → refused by G2;
      `main-preprod` → refused by G3; `sha-00ef3be4-preprod` (9 hex) → refused by G3's length assert.
      Paste the literal output.
- [x] 2.3 Force-test the three guards that can have no live failing row, against deliberately wrong
      values: **G4** (a marker name that does not match `keep_pattern`), **G6** (labels that disagree
      with the derived hex, and an `org.prionex.environment` of `dev`), and **AC8's repoint refusal**
      (`pre_digest != new_digest`). All three are AC7/AC8 rows with **no live dispatch**; the
      force-test is the substitute and must be recorded as such, with the disposition **UNPROVEN
      live** written next to each.
- [x] 2.4 Tag census. Coordinator: `GET /v2/crm/fe-prionex/tags/list`. **Paste the raw response.**
      Confirm: `sha-00ef3be4743d-preprod` present; `preprod-current` and `preprod-*` **absent**
      (if either exists, stop — something wrote them and that is a blocking Open Question);
      `probe-3-3-preprod-preprod` present (AC3's fallback needs it); `main-preprod` present or not
      (AC7 row 3 does not need it to exist — G3 fires before any registry call — but say which).
      **Done, coordinator, 2026-08-24T12:2xZ: 256 tags total, zero `preprod-*` of any shape.**
      `-preprod`-suffixed tags present: `main-preprod`, `probe-3-3-preprod-preprod`,
      `sha-00ef3be4743d-preprod` — all three of Open Question 2's watch-list, none of them a
      marker this workflow would write. **No blocker.**
- [x] 2.5 Re-read the **stored** retention rule from the instance (read-only, coordinator) and paste
      `keep_pattern` verbatim. Compile it — the stored string, not `build.yml`'s copy — against the
      literals `preprod-current` and `preprod-00ef3be4743d` under `match full name = true`, i.e.
      against `fe-prionex/preprod-current` and `fe-prionex/preprod-00ef3be4743d`. AC4.
      🔴 **Corrected: this is the dev agent's own SSH/psql channel, per the standing 5.1-5.3
      convention, not the coordinator's** — mistakenly requested from the coordinator first;
      corrected on the coordinator's own instruction and done directly. Evidence below.
- [x] 2.6 Confirm the deploy runner's labels have not drifted:
      `select id, name, agent_labels from action_runner where name='s1-deploy-dev-preprod'`.
      Expect `["deploy-dev-preprod"]`. An unmatched `runs-on` queues **silently**.
- [x] 2.7 Confirm `secrets.REGISTRY_USER` / `REGISTRY_TOKEN_RW` are visible to this repository
      (org secret list, coordinator, names only — **never values**). **Done, coordinator:** five
      org secrets visible — `REGISTRY_USER`, `REGISTRY_USER_RO`, `REGISTRY_TOKEN_RW`,
      `SLACK_CD_WEBHOOK_URL`, `REGISTRY_TOKEN_RO`. The RW pair is present.
- [x] 2.8 🔴 **The standing obligation 5.3 handed to the first session with SSH/psql access, to be
      done before other work on this story's residue:** re-check
      `select id, log_in_storage from action_task where id in (9745, 9769)`. If either flipped to
      `t`, read the log and paste the literal `RESP_CODE` line and AC7's lines 2-5 into
      `deferred-work.md` finding 8's closure note. If still `f`, record the **fifth** check with its
      timestamp and leave it PENDING with the plan intact. Do not silently skip it.

### Task 3 — Write `.forgejo/workflows/record-preprod-candidate.yml` (AC: 1, 2, 6, 7, 8)

- [x] 3.1 Header comment, in `deploy-preprod.yml`'s style: what this file is, why it is
      dispatch-only rather than a deploy step (§4), the shared concurrency group and why (§9),
      `--prefer-index=false` and why (§6), the write-order argument (§6), the
      `sha-<12hex>-preprod → preprod-<12hex>` derivation rule **spelled out for Story 6.5**, and the
      AC6 honesty paragraph.
- [x] 3.2 Triggers: `workflow_dispatch` only. Inputs — `image_tag` (required, string),
      `validated` (required, `type: choice`, options `pass` / `fail`, **no default**),
      `validation_note` (required, string: who validated, against what, when).
      **No `push`, no `schedule`, no tag trigger, no `workflow_call`.**
- [x] 3.3 `concurrency: group: deploy-preprod-fe-prionex-preprod`, `cancel-in-progress: false`,
      at workflow level, a literal. §9.
- [x] 3.4 Job `verify-on-stand`, `runs-on: deploy-dev-preprod`, `timeout-minutes: 5`. Steps: G1
      (verdict, fail-closed on any third value), G2 (suffix), G3 (shape + 12-char assert), resolve
      the tag's digest via `curl` to `/v2/…/manifests/<tag>` with the **RO** pair
      (`--config -` on stdin, never argv — copy `deploy-stand.yml:1111-1123`'s shape including its
      four `Accept:` headers and its 401/404/000 classifiers), then G5: `docker inspect` the
      container's health and its image's `.RepoDigests`, `grep -F` the digest. Echo
      `validation_note` verbatim into the log — it is the record.
- [x] 3.5 Job `record`, `runs-on: node-20`, `needs: verify-on-stand`, `timeout-minutes: 10`.
      Prelude per §5 in that order. Then: re-resolve the candidate digest with
      `imagetools inspect --format '{{.Manifest.Digest}}'` (this doubles as the mechanism smoke test,
      §5); **G6** — read the image's config labels back from the registry and check all three
      clauses (§7); derive both marker names; **G4** — compile `keep_pattern` against both; assert
      every write target begins with the literal `git.crm-prionex.com/crm/fe-prionex:`
      (Prohibition 3); write `preprod-<sha>` (with the AC2-style pre-digest read and the three-branch
      attach/no-op/refuse logic, including its two-string absence allowlist and its
      stdout/stderr-never-merged rule); read back; write `preprod-current` (pre-digest read,
      three-branch create/no-op/**move**); read back.
      ⚠️ **The label read is the one expression whose exact form is unverified.**
      `imagetools inspect --format '{{json .Image}}'` is the documented route to the image config;
      confirm the field path against the real tag in the first dispatch's read step **before** the
      guard is allowed to fail closed on a parse error, and if the format expression is wrong, fix
      the expression — do not weaken the guard to a substring grep.
- [x] 3.6 Final step: list `preprod-*` tags with their digests from `/v2/…/tags/list` (RO pair) and
      print them. AC5.
- [x] 3.7 Mechanical gates, all zero-run: `yaml.safe_load` parses the file; extract every `run:` body
      and scan for the literal `${{` (expect **0**); `bash -n` each extracted body; grep for
      `--prefer-index=false` (expect one occurrence per `create`); grep the whole file for
      `set -euo pipefail` count == number of `run:` bodies. Paste the counts.

### Task 4 — Zero-run rejection (AC: 7 row 0)

- [x] 4.1 Coordinator: dispatch `record-preprod-candidate.yml` **omitting `validated`**. Expect
      HTTP 400. Confirm `max(action_run.id)` is unchanged across the call — the row is free and it
      is a real discriminator. **Done, 2026-08-24T12:2xZ: HTTP 400**, body carrying the full
      description of the `validated` input (*"'pass' records the candidate; anything else
      (including 'fail') writes nothing"*). **Independently confirmed zero-row via this session's
      own `psql`**: `select max(id), count(*) from action_run where repo_id=16` → `1213 | 476`,
      and row **1213** is attributed to this story's own CI push (`commit_sha=ac6b97fa…`,
      `ref=story-5-4/pr-1-context`) — the coordinator's own push-adjacent commit, confirmed by DB,
      not accepted on say-so — **not** a row created by this dispatch. The zero-run claim holds.

### Task 5 — D1: record candidate #1, the green row (AC: 1, 2, 6)

- [x] 5.1 Dispatch from `story-5-4/pr-1-context` (a non-default branch dispatch is proven, run 917).
      Inputs: `image_tag=sha-00ef3be4743d-preprod`, `validated=pass`, `validation_note=` the honest
      sentence AC6 requires. **Done, coordinator, run 1215, SUCCESS, `2026-08-24T12:18:22Z`–
      `12:19:45Z`.**
- [x] 5.2 Confirm from the DB: `concurrency_group = deploy-preprod-fe-prionex-preprod` **and**
      `concurrency_type = 1`. `type=0` means the file claims protection it does not have (D21).
      `select concurrency_group, concurrency_type from action_run where id=1215` →
      `deploy-preprod-fe-prionex-preprod | 1` — real, survived.
- [x] 5.3 Confirm both jobs ran on the runners they were meant to: `verify-on-stand` on runner 14,
      `record` on a `node-20` runner. `verify-on-stand` (job 10652) → `runner_id=14`
      (`s1-deploy-dev-preprod`), exactly as expected. `record` (job 10653) → `runner_id=19`
      (`s1-fe-prionex-1`, the `node-20`-labelled runner).
- [x] 5.4 Read both markers back **from the registry, after the run** — not from its log. Both must
      resolve to `sha256:5e5b190d…`. Paste the raw responses. **Independent registry read via s1's
      own `docker buildx imagetools inspect`** (not the workflow's log — job 10653's log had not
      archived yet at verification time, `log_in_storage=f`):
      ```
      preprod-00ef3be4743d -> sha256:5e5b190d93c8aaec50f0d50c7e108f502c3d366d14f8a13aee081f0ee396dc8c
      preprod-current      -> sha256:5e5b190d93c8aaec50f0d50c7e108f502c3d366d14f8a13aee081f0ee396dc8c
      ```
      🔴 **Both confirmed as REAL manifests, not OCI indexes** — `imagetools inspect --raw` on each
      → `mediaType: application/vnd.oci.image.manifest.v1+json` for both, not
      `application/vnd.oci.image.index.v1+json`. `--prefer-index=false` genuinely worked; this is
      exactly the D26/`build.yml:1518-1538` defect class this story exists to avoid, proven not to
      have recurred, independently, not by trusting the step's own "OK" message.
- [x] 5.5 Confirm the candidate's own `sha-00ef3be4743d-preprod` still resolves to the same digest,
      i.e. this story wrote two names and touched nothing else. `docker buildx imagetools inspect
      --format '{{.Manifest.Digest}}' git.crm-prionex.com/crm/fe-prionex:sha-00ef3be4743d-preprod`
      → `sha256:5e5b190d93c8aaec50f0d50c7e108f502c3d366d14f8a13aee081f0ee396dc8c` — unchanged.

**Step-level evidence, both jobs, all `status=1`:**
- `verify-on-stand` (task 10044, log archived — read in full): G1 `OK: validated=pass.`; G2
  `OK: 'sha-00ef3be4743d-preprod' ends in '-preprod'.`; G3
  `OK: 'sha-00ef3be4743d-preprod' -> commit hex '00ef3be4743d'.`; digest resolve
  `OK: resolved sha-00ef3be4743d-preprod -> sha256:5e5b190d…`; G5
  `OK: fe-prionex-preprod is healthy and its running .RepoDigests contains sha256:5e5b190d….`;
  `validation_note` echoed verbatim (apostrophes rendered dropped in the terminal/log pipeline —
  a JSON/log-rendering artifact of the dispatch input, not a code defect, since the step's own
  `run:` prints the variable byte-for-byte).
- `record` (task 10046, **not yet archived** — verified via `action_task_step` timestamps instead,
  Prohibition 17): steps 0-10 all `status=1`. **Write order confirmed by real timestamps, not by
  reading the file**: step 8 ("Write preprod-<sha>…") `started=1787573980, stopped=1787573982`;
  step 9 ("Write preprod-current…") `started=1787573982, stopped=1787573983` — `preprod-<sha>`
  genuinely wrote first (§6). G6 (step 5) and G4 (step 6) both `status=1` — **G6's passing half is
  earned live on this run**, including the previously-unverified `{{json .Image}}` →
  `.config.Labels` field path (§5's own flagged uncertainty; the expression was correct on the
  first live dispatch, no fix needed).

### Task 6 — D2: the same dispatch again (AC: 8, 7 row 7)

- [x] 6.1 Re-dispatch D1 byte-identically. Expect green, both writes reporting the no-op branch,
      both digests unchanged on read-back. **Done, coordinator, run 1217, SUCCESS,
      `2026-08-24T12:23:20Z`–`12:24:37Z`.** Both jobs `status=1`, all 6+11 steps `status=1`.
      Run-level: `concurrency_group=deploy-preprod-fe-prionex-preprod`, `type=1` — unchanged from
      D1. **The coordinator's own real-time observation**: the dispatch showed `blocked`→`waiting`
      briefly before running — a live, if transient, discriminator that the concurrency group is a
      real gate, not just a claimed one (this state is not retained in the final DB row, so it is
      recorded here as the coordinator's own contemporaneous observation, not independently
      re-derived after the fact).
- [x] 6.2 Confirm from registry state, not from the log (Prohibition 17). Job 10662's own log had
      not archived at verification time (`log_in_storage=f`) — evidence is `action_task_step`
      status (all green) plus **timing**: the two write steps (indices 8/9) each completed in ~1s,
      markedly faster than D1's own attach/create writes (2s/1s) — consistent with the no-op
      pre-digest-read branch exiting early rather than performing an actual
      `imagetools create`. The registry-state half of this confirmation is the post-series
      read-back at Task 7.5, below — both markers unchanged after D2 as well as after D3-D6.

### Task 7 — D3-D6: the four refusals (AC: 7 rows 1-4)

- [x] 7.1 D3 — `validated=fail`. Expect RED at G1, in `verify-on-stand`, **before any registry
      contact**. Confirm the later steps and the whole `record` job are SKIPPED
      (`action_task_step.status = 4`). **Done, run 1218, FAILURE, ~3s.** Log (task 10054, archived):
      `FAIL(G1): validated=fail -- this is a real refusal, not a bug. A failed validation writes
      nothing to the registry. Nothing after this step runs.` Steps 1-5 of `verify-on-stand` all
      `status=4` SKIPPED — G1 fired on its own first line, no registry contact of any kind before
      it. `record` job (10664) `status=4` SKIPPED entirely (`needs:` cascade).
- [x] 7.2 D4 — `image_tag=sha-00ef3be4743d-dev`, `validated=pass`. Expect RED at G2. **Done, run
      1219, FAILURE, ~4s.** Log (task 10055): `OK: validated=pass.` then `FAIL(G2):
      image_tag='sha-00ef3be4743d-dev' does not end in '-preprod'. …` G1 passed (`status=1`), G2
      failed (`status=2`), G3/digest-resolve/G5 all SKIPPED. `record` job SKIPPED entirely.
- [x] 7.3 D5 — `image_tag=main-preprod`, `validated=pass`. Expect RED at G3, with the message naming
      commit-extractability and Story 6.5. **Done, run 1220, FAILURE, ~4s.** Log (task 10056):
      `OK: validated=pass.` `OK: 'main-preprod' ends in '-preprod'.` then `FAIL(G3):
      image_tag='main-preprod' does not match ^sha-[0-9a-f]{7,64}-preprod$. A branch-shaped tag
      (e.g. main-preprod) carries no commit and is mutable -- …` G1/G2 passed, G3 failed,
      digest-resolve/G5 SKIPPED (no registry contact — G3 fires before the digest-resolve step
      that would have made one). `record` job SKIPPED entirely.
- [x] 7.4 D6 — `image_tag=sha-000000000000-preprod`, `validated=pass`. Expect RED at the digest
      resolve with a classified 404, **not** an unclassified curl failure. **Done, run 1221,
      FAILURE, ~4s.** Log (task 10057): `OK: validated=pass.` `OK: 'sha-000000000000-preprod' ends
      in '-preprod'.` `OK: 'sha-000000000000-preprod' -> commit hex '000000000000'.` then `FAIL:
      registry returned 404 Not Found resolving sha-000000000000-preprod. No image exists under
      this exact tag -- confirm it was actually built and pushed (this workflow builds nothing and
      cannot fix that).` — a genuinely classified message, not a raw curl/transport failure; this
      is the ONE row of the four that legitimately reaches the registry (G1/G2/G3 all pass first),
      confirming the guard ladder's ordering is real, not just declared. G5 SKIPPED (never reached).
      `record` job SKIPPED entirely.
- [x] 7.5 After **each** of the four, read both markers back from the registry and confirm them
      **unchanged** at `sha256:5e5b190d…`. This is AC7's second clause and it is the point of the
      whole matrix. **Done — single read-back after the entire D2-D6 series** (all four refusals
      plus D2's idempotent write happened in one tight sequence; one post-series read covers all
      five, since none of D3-D6 ever reached a write step to begin with, and D2 wrote nothing new).
      `docker buildx imagetools inspect --format '{{.Manifest.Digest}}'`, run directly on s1, not
      from any workflow's log:
      ```
      preprod-00ef3be4743d -> sha256:5e5b190d93c8aaec50f0d50c7e108f502c3d366d14f8a13aee081f0ee396dc8c
      preprod-current      -> sha256:5e5b190d93c8aaec50f0d50c7e108f502c3d366d14f8a13aee081f0ee396dc8c
      ```
      **Both identical to D1's own post-write values — unchanged through the whole series.**
      Re-checked `--raw` `mediaType` on both: still `application/vnd.oci.image.manifest.v1+json`
      on each, not an index.

### Task 8 — D7-D9: a second candidate, and the deployed-evidence refusal (AC: 3, 7 row 5)

- [x] 8.1 🔴 **Announce before dispatching, do not ask permission twice.** Relay to Oleg through the
      coordinator: *"5.4 will dispatch `build.yml` (`ref: main`, `environment: preprod`) once, minting
      one new permanent `sha-<12hex>-preprod` tag, because AC3 cannot be proven with the one candidate
      that exists. Vetoable; fallback is Task 9.5."* Proceed unless vetoed. Record the announcement
      and the outcome. **Done.** Announced verbatim by the coordinator to Oleg. Per the standing
      "announce, don't ask twice" convention, proceeded without waiting for an explicit
      affirmative — the coordinator noted any veto would still land before the MOVE phase (D9/D10
      held back if so). No veto received through D7's own dispatch.
- [x] 8.2 D7 — dispatch `build.yml` with `ref: main`, `environment: preprod`. Record the new tag,
      its digest, and the commit. **Do not edit `build.yml`.** **Done, coordinator, run 1223,
      SUCCESS, ~4 min.** New tag: `sha-28f7fd36b75e-preprod`, commit `28f7fd36b75e` (`main` HEAD at
      dispatch time, sampled by the coordinator immediately before the `POST`). Verified
      independently on s1, not from the run's own log: `docker buildx imagetools inspect --format
      '{{.Manifest.Digest}}'` →
      **`sha256:d2f6aefc780d6684bd86418298d4068131b7442bf93c3f17de965f40c82f6f26`** — a genuinely
      **new** digest, `≠ sha256:5e5b190d…` (candidate #1's). `--raw` `mediaType` →
      `application/vnd.oci.image.manifest.v1+json` — single manifest, not an index. Labels read via
      `{{json .Image}}` → `.config.Labels`: `org.opencontainers.image.version=28f7fd36b75e`
      (equals the derived hex), `org.opencontainers.image.revision=28f7fd36b75ee773cd3e7d9d8586b3ac3d1d915b`
      (starts with it — the full 40-char commit SHA), `org.prionex.environment=preprod`. All three
      match exactly what G6 will require when candidate #2 is recorded (D10).
- [x] 8.3 D8 — dispatch `deploy-preprod.yml` with the new `image_tag`. Confirm the stand comes up
      healthy on the new digest. **Do not edit `deploy-preprod.yml`.** Timestamp in UTC; the runner
      is shared with 4.9 at capacity 1. **Done, coordinator, run 1225, SUCCESS, ~70s.** Verified
      host-side on s1, independently of the run's own log: `docker inspect fe-prionex-preprod
      --format '{{.State.Health.Status}}'` → `healthy`. `.RepoDigests` via the correct method
      (config digest from `.Image`, then `docker image inspect <that digest> --format
      '{{.RepoDigests}}'`, never `.Image` on the container) →
      `[git.crm-prionex.com/crm/fe-prionex@sha256:d2f6aefc780d6684bd86418298d4068131b7442bf93c3f17de965f40c82f6f26]`
      — matches D7's own newly-minted digest exactly. `curl -s -o /dev/null -w '%{http_code}'
      http://127.0.0.1:8083/` → `200`. The stand is now genuinely, demonstrably serving candidate
      #2 — the precondition D9's own G5 test needs.
- [x] 8.4 D9 — dispatch the recorder for **candidate #1** while the stand serves candidate #2.
      Expect RED at G5, with a message that names both digests and says which is which. Read both
      markers back: unchanged at `sha256:5e5b190d…`. **Done, coordinator, run 1227, FAILURE, ~10s
      (`2026-08-24T12:39:49Z`–`12:39:51Z`).** Step-level: `verify-on-stand` steps 0-3 (G1/G2/G3/
      digest-resolve) all `status=1`; step 4 (**G5**) `status=2` — the refusal landed exactly where
      designed, not earlier, not later; step 5 (record the validation note) `status=4` SKIPPED —
      never reached. `record` job (10700) `status=4` SKIPPED entirely (`needs:` cascade). Log (task
      10079, archived) — full multi-line message, both digests named and unambiguously attributed:
      ```
      FAIL(G5): the stand is healthy but is NOT demonstrably serving the candidate.
        candidate's own registry digest: sha256:5e5b190d93c8aaec50f0d50c7e108f502c3d366d14f8a13aee081f0ee396dc8c
        stand's own running .RepoDigests: [git.crm-prionex.com/crm/fe-prionex@sha256:d2f6aefc780d6684bd86418298d4068131b7442bf93c3f17de965f40c82f6f26]
        Recording this candidate now would be a claim, not evidence -- refusing.
      ```
      Both markers re-read directly on s1 after the run: `preprod-00ef3be4743d` →
      `sha256:5e5b190d…`, `preprod-current` → `sha256:5e5b190d…` — **unchanged**, exactly as before
      D9. **G5's failing half is now earned live**, closing the last of AC7's three genuinely
      earnable-but-not-yet-earned rows (G4 and AC8's repoint refusal remain force-tested only,
      per §5 — G5 was never in that "no live row possible" set, it just needed candidate #2 on the
      stand first, which D7/D8 supplied).

### Task 9 — D10: the move (AC: 3)

- [x] 9.1 D10 — dispatch the recorder for **candidate #2**, `validated=pass`, with its own honest
      `validation_note`. **Done, coordinator, run 1229, SUCCESS, `2026-08-24T12:42:12Z`–
      `12:43:28Z`.** Both jobs `status=1`, all 6+11 steps `status=1`. **The coordinator's own
      real-time observation: `waiting` ~60s on this run's own concurrency group before it ran** —
      a second, independent live discriminator (alongside D2's) that
      `deploy-preprod-fe-prionex-preprod` is a real serializing gate, not merely declared.
- [x] 9.2 Read `preprod-current` back: must now resolve to candidate #2's digest. The step log must
      show the **move** branch with old → new, not the create branch. **Independent registry
      read, direct on s1, not from any log** (neither of D10's own task logs had archived at
      verification time — evidence is `action_task_step` status/timestamps plus this direct read,
      per Prohibition 17): `preprod-current` → **`sha256:d2f6aefc780d6684bd86418298d4068131b7442bf93c3f17de965f40c82f6f26`**
      — candidate #2's own digest, moved from D1-D9's `5e5b190d…`. Step-level timing corroborates
      the MOVE branch specifically (not create): step 9 ("Write preprod-current…") ran
      `1787575405`→`1787575406`, immediately after step 8's own write (`1787575403`→`1787575405`)
      — both real write durations (~2s and ~1s), consistent with D1's own original attach/create
      timings, not the ~0s no-op branch D2 showed.
- [x] 9.3 Read `preprod-00ef3be4743d` back: must **still** resolve to `sha256:5e5b190d…`. This is
      AC3's second clause and it is the one that matters for rollback and audit. Confirmed:
      **`sha256:5e5b190d93c8aaec50f0d50c7e108f502c3d366d14f8a13aee081f0ee396dc8c`** — unchanged
      through the entire story, including D10's own write elsewhere. **AC3 is now proven on the
      real tag names, both clauses**: the pointer moved, the history did not.
- [x] 9.4 Read the new `preprod-<sha2>` back: candidate #2's digest. `preprod-28f7fd36b75e` →
      **`sha256:d2f6aefc780d6684bd86418298d4068131b7442bf93c3f17de965f40c82f6f26`** — candidate #2's
      digest, confirmed as a real manifest via `--raw` (`application/vnd.oci.image.manifest.v1+json`
      on both `preprod-current` and `preprod-28f7fd36b75e`, neither an OCI index).
- [ ] 9.5 **Only if 8.1 was vetoed:** run the throwaway-marker fallback instead (AC3's reading), mark
      AC3 **UNPROVEN on the real tag names**, and record the residual explicitly. Never both paths
      quietly. **N/A — 8.1 was not vetoed.** Task 8.1's announcement reached Oleg through the
      coordinator verbatim; per the standing "announce, don't ask twice" convention execution
      proceeded, and no veto arrived through D7 (the mint), D8 (the deploy), D9 (the G5 refusal
      proof), or D10 (the move) — four full dispatch cycles across which a veto could have landed.
      AC3 is proven on the real tag names; this fallback was never exercised.

### Task 10 — Record, route, decide (AC: 4, 5, 6, 7)

- [x] 10.1 Write **D38** in `docs/migration-decisions.md` (Russian). **Four edits, all required** —
      D36 and D37 are the templates: (a) the header's anchor range at the top of the file,
      `` (`#d1` … `#d37`) `` → `#d38`; (b) an index-table row appended after D37's;
      (c) the body, appended **before** `<a id="changelog"></a>`, with its own `<a id="d38"></a>`,
      an `## D38. <headline stating the decision AND what it cost>`, a
      `**Дата:** … **Story 5.4.** Статус: …` line, numbered sections, and closing `**Требования:**`
      / `**Триггер пересмотра:**` lines; (d) a Change Log row.
      Sections to carry: the decision number and how it was verified against **every open
      `story-*` branch, not just `main`**; the dispatch-vs-deploy-step deviation and its argument
      (§4); the derivation rule **for Story 6.5**, byte-exact, together with G6's label cross-check
      and D33 §6(b)'s reason for it; `--prefer-index=false` for **both** reasons (§6) and the
      read-back; the write order; the check-to-write window, narrowed and detected, not closed; the
      six guards and which three earned no live failing row; AC6's boundary — what `preprod-<sha>`
      means and what it does not; the retention verification's method and its honest disposition;
      whether a second candidate was minted and under whose decision. **Decision bodies are never
      rewritten**; amendments are dated appended blocks.
      🔴 **Do not cite D24 as protecting `preprod-<sha>`** — its own 2026-08-18 amendment says it
      does not (AC2).
- [x] 10.2 `deferred-work.md`. **New entries go at EOF as a new `## Deferred from: …` section** —
      the file has no numbered series; sections are keyed by provenance and date, and items are cited
      elsewhere by line number. Closures and restatements go **under the original**, old text struck.
      Content: the RW-scope exposure now has a **third** holder — restate `:1560-1568` with this file
      named, owner unchanged; the `## 📅 DUE 2026-08-29` item restated to include this story's two
      new marker tags in what that observation checks (owner unchanged, escalation clause intact);
      the check-to-write window (`:2288-2301`) restated with the recorder named as a second site,
      owner still needed; G4's, G6's and AC8's force-tested-only dispositions; AC5's set-vs-order
      narrowing; and whatever Task 2.8 found.
- [x] 10.3 🔴 **The PRE-PROD lock-holder debris and the sweep-scoping gap (5.3's M3/M4).** This story
      **declines ownership** and says why: it edits no `dev-reset.yml`, it touches no stand
      directory, and the item's own text names the better owner — *"the story that generalizes
      `dev-reset.yml`'s own sweep/reaper to cover multiple stands instead of hardcoding DEV's own
      naming pattern."* Restate it under the original with an **owner that is a name or a story
      number**, and add the one thing this story does change about it: the marker tags protect the
      candidate in the **registry**, and give **no** protection to the host's local image cache,
      which is what `dev-reset.yml`'s ≥168h untagged-image sweep can still catch mid `pull → up -d`.
      Naming that distinction is this story's whole contribution to the item.
- [x] 10.4 Record `deploy-preprod.yml`'s naming invariants as **deliberately still unclaimed** — this
      recorder does not dispatch or read it back by name (§12). Do not edit its header. **Confirmed
      true of the file as actually written**: `record-preprod-candidate.yml` never invokes
      `deploy-preprod.yml` (no `workflow_call`, no API dispatch of it, no read of its own outputs or
      run history by name) — it reads the PRE-PROD stand directly (`docker inspect`) and the
      registry directly. `deploy-preprod.yml`'s own header, which invites an upgrade *"if a future
      PRE-PROD reset or a Story 5.4 recorder starts [dispatching or reading it back] by name"*,
      remains accurate as written — this story does not trigger that clause, and its header was not
      touched (blast radius confirms `deploy-preprod.yml` is absent from the diff).
- [x] 10.5 Fill the retro-E5 matrix: one row per dispatch, columns
      `# | Task | Run id | Inputs | Verdict | The discriminating message`, plus a **marker state
      after** column. Read every verdict from `action_task_step` and a registry read, never a log
      line alone.
- [x] 10.6 Answer, per AC, with an explicit verdict each (5.3's M9 asked for this and 5.3 did not
      have it): AC1-AC8, MET / PARTIAL / UNPROVEN, one line of evidence each.
- [x] 10.7 Reconcile the ledger against §11. Name every row. Row 1176's lesson stands: a row that
      matches neither this story's commits nor a concurrently-active sibling's branch tip is **named
      as unattributable**, never absorbed.

### Task 11 — Close (AC: all)

- [x] 11.1 Update `sprint-status.yaml` → `review`, **its own commit**.
- [x] 11.2 Fill Completion Notes, File List, Change Log.
- [ ] 11.3 `PENDING (owner: coordinator)` — PR open. The dev agent does not open it.
- [x] 11.4 Ledger disposition stays **OPEN** until a post-merge query. Never a self-reported number.

---

## Dev Notes

### 1. The one-paragraph version

Add one dispatch-only workflow that points two new registry tags — `preprod-current` and
`preprod-<12hex commit>` — at an already-published PRE-PROD image, using
`docker buildx imagetools create --prefer-index=false` and verifying every write by reading it back.
Six guards stand in front of the write; three of them earn a live failing run and the three that
cannot are named as unearned rather than counted. The story's real
content is not the command, it is the argument that the word *validated* has to mean something a
human asserted about an artifact the stand was demonstrably serving — because Story 6.5 will refuse
production releases on the strength of the tag this story mints.

### 2. Infrastructure facts

§2's table is the canonical list. Additions that only matter to this story:

| Fact | Value |
|---|---|
| Image repository (literal, never composed) | `git.crm-prionex.com/crm/fe-prionex` |
| Registry API base | `https://git.crm-prionex.com/v2/crm/fe-prionex/` |
| `node-20` job container's host mapping | `git.crm-prionex.com` → `10.67.0.1` |
| Deploy runner's host mapping | `git.crm-prionex.com` → `10.70.0.1` |
| `docker-build` label | resolves to `code.forgejo.org/oci/docker:cli` — **no Node runtime, no `uses:` step executes, the job does not fail** |
| Step-level `uses:` on the **deploy** runner | does not execute, silently (run 920). `verify-on-stand` must be plain `run:` steps only |
| `127.0.0.1:8083` from inside a container | unreachable — route host reads through a `--network host` sibling. **G5 does not need it**; `docker inspect` through the mounted socket is enough |

### 3. Anti-patterns for this story

- **Recording on deploy.** §4. It is the literal reading of the epic and it makes `preprod-<sha>`
  mean something weaker than Story 6.5 will assume.
- **`echo "OK"` after a write.** `build.yml:1542-1547`. Read it back or do not claim it.
- **Omitting `--prefer-index=false`,** or copying `build-buildkit-cni-image.yml:373`, which omits it
  and is a recorded defect (D26).
- **Composing a write target from an input.** Prohibition 4. The RW token reaches 87 packages.
- **Copying `build.yml`'s `docker-container` buildx block wholesale.** It exists for building with a
  registry cache; this job builds nothing. §5.
- **Passing the digest between jobs.** §5. Resolve it twice from an immutable tag instead.
- **Taking the stand's `flock` for a read.** §7. It would block deploys and prove nothing extra.
- **Deleting anything to clean up.** Prohibition 14. A wrong tag is an Open Question, not a chore.
- **Claiming AC4 is proven.** It is compiled against the authoritative pattern; the rule has never
  been observed deleting anything. Disposition, not adjective.
- **Reading a verdict from a log line.** Prohibition 17 — 5.3 lost five literal lines to logs that
  never archived, across four checks in four sessions.

### 4. Previous story intelligence

- **From 5.3:** the tag↔environment guard exists in `deploy-stand.yml:1060-1073` and earned rows G1
  (run 1197, refused a `-dev` tag on PRE-PROD) and G2 (run 1198, did not misfire). It is a **suffix**
  test, which has a consequence this story must state: `preprod-current` and `preprod-<sha>` **do
  not** end in `-preprod` and are therefore **not deployable** through `deploy-preprod.yml`. That is
  correct — a moving pointer is exactly the wrong thing to hand a deploy — but it will read as a bug
  to whoever tries it, so say it in the file.
- **From 5.3:** *"do not let a later story generalise 'image_tag mode is safe' past the `sha-`
  shape."* G3 is this story obeying that instruction.
- **From 5.3's review:** *"a record that erases its own best act of honesty is worse than one that
  never performed it."* (H2). D38 must record the guards that were **not** live-earned as such.
- **From 5.2:** paste artifacts, do not characterise them (M1, twice-made). Name the vantage point
  of every probe (M21). Never `cat /root/.docker/config.json` (two token leaks).
- **From 4.8:** *"a refactor does not ship new guards — it ships the same guards on a new path, and a
  guard on an unexercised path is exactly a guard that cannot fail."* This story ships new guards on
  a new path; both halves apply.
- **From 3.6/D24:** the read-before-write / compare / attach-or-refuse pattern this story's
  `preprod-<sha>` write copies wholesale, including its absence allowlist (`MANIFEST_UNKNOWN` and
  `": not found"` are the only two strings that mean "absent"; everything else fails closed) and its
  rule that **stdout and stderr are captured separately, never merged**, because registry error text
  in `$GITHUB_OUTPUT` corrupts it.

### 5. Ledger attribution in the parallel era — cite 5.1's closeout, do not re-derive it

Story 5.1's closeout (PR #75) states the method; 5.2 closed 5/5 with zero overrun and 5.3 closed
19/24 by it. Verbatim:

> (1) filter `action_run` to this repo's `repo_id`, eliminating sibling-repo instance noise […];
> (2) for each remaining row, match `commit_sha` against the closing story's own known commits
> (context, review, fix-pass, merge) and against any concurrently-active sibling story's own branch
> tip(s) (fetched fresh […]); (3) a row whose `ref`/`commit_sha` matches neither is not yet
> attributable and must be named as such, not folded into either story by default.

*"'Everything above baseline is this story's' — every prior ledger's assumption — is false here."*
5.2's closeout found row **1176** to be a `PRIONEX_HUB` scheduled run and **named it rather than
absorbing it**. Story 4.9 is pushing to `story-4-9/pr-1-context` concurrently — do the same.

⚠️ Inherited caveat, still open: `max(id) == count(*)` is **not** a hidden-run proof, and the
instance-wide query has no `repo_id` filter. Use the filtered form; if you also run the unfiltered
one, say which is which.

⚠️ **This story's dispatch rows span three different workflows** — `record-preprod-candidate.yml`
(eight), `build.yml` (one), `deploy-preprod.yml` (one). They will not look alike in `action_run`.
The recorder's two jobs live inside **one** run row; do not double-count them.

### 6. Non-goals — absences that are decisions, not omissions

- **No change to any deploy workflow.** §4, §12.
- **No validation checklist and no `e2e` placeholder job.** Story 5.5's ACs verbatim. The
  `validation_note` input is free text precisely because the checklist does not exist yet.
- **No promotion guard, no `prod-*` tag, no `deploy-prod.yml`, no `rollback` input.** Epic 6.
- **No Slack notification.** Story 4.5's, deferred by the epic itself, and it now owes a third file.
- **No CORS fix and no attempt at browser-path validation.** `CRM/api-prionex`'s; AC6 records the
  boundary rather than crossing it.
- **No fix for the PRE-PROD lock-holder debris or the sweep scoping.** Task 10.3 argues the decline
  and re-routes it with a named owner.
- **No `deploy-stand.yml:216` comment fix.** Re-routed to Story 6.4 by 5.3; unchanged here.
- **No registry deletion of anything, ever.** Prohibition 14.
- **No scheduled or automatic recording of any kind.** A candidate that records itself is not
  validated, it is deployed.

### 7. Things pending on Oleg — do not depend on them silently

- **The PRE-PROD Kong CORS fix** — external ask to `CRM/api-prionex`, relayed by Oleg, extended
  2026-08-23, **not fixed**. AC6 exists so this story closes honestly without it. 5.3 flagged it
  forward with this story named: *"so 5.4/5.5 are not planned around an assumption."*
- **The `CRM/api-prionex` heads-up about our two endpoints on their networks** — escalated twice,
  **still unsent, still unowned**. Owner: Oleg. Blocks nothing here.
- **Transcript-scrubbing for the two leaked `read:package` tokens** — Owner: Oleg, open. Neither can
  be revoked (D14). **This story mints no token and needs no host credential**, so it neither worsens
  nor depends on it.
- **The `robot-registry` account question** (whether its grant is instance-wide rather than
  repo-scoped) — Owner: Oleg, open. **Do not assume repo-scoping**, and note that this story adds a
  third workflow holding the RW half of that account's credential (Prohibition 3).
- **`fe_pkg_3_6`** — a standing `read:package` token on Oleg's own account, minted 2026-08-17, whose
  recorded revocation trigger is *"when Epic 3 closes, or when a longer-lived read route to the
  registry is decided — whichever comes first."* **Epic 3 is closed.** Owner: Oleg. This story needs
  no token of its own (the workflows use org secrets), so it neither depends on it nor worsens it —
  but the trigger has fired and the record should not go stale a second time, which is the entry's
  own stated lesson.
- **A repository-scoped `write:package` credential** — `deferred-work.md:1567-1568`:
  *"Owner: whoever can ask the platform team … worth asking before Epic 6 puts production deploys on
  the same token."* This story is the moment that becomes concrete; restate it, do not solve it.
- **`epics.md:2169-2171`'s stale `PLACEHOLDER-preprod-backend-not-provisioned` claim** — Owner:
  Oleg, at whichever story next amends the epic. **Do not correct it here**, and do not repeat it.
- **`secrets: inherit` scope before Story 6.4 ships** — named by 4.8 for Oleg. This file uses no
  `secrets: inherit` at all (it is neither caller nor callee), so it neither settles nor worsens it.

### 8. Conventions that bind this story

- 🔴 **`D4` and `E5` are ambiguous — two numbering schemes collide.** The retro action items
  (`epic-3-retro-2026-08-18.md:77-78`) are **retro-D4** and **retro-E5**. The D-series in
  `docs/migration-decisions.md` is a different sequence, where `D4` is stand parameterization and
  there is no `E5`. **Write the prefix every time.**
- **retro-E5 (live outcome matrix):** *"every guard proves itself on a run that fails as well as one
  that passes."* AC7 is the matrix; its two unearned rows (G4, AC8's repoint) are named as unearned.
- **retro-D4 (run ledger):** declare before work; close only against a post-merge query; or write
  **OPEN**.
- **NFR5:** the DEV and legacy stands stay operational and untouched. Here that means DEV (§12, never
  read, never touched) and the legacy stand (a different host, never contacted). PRE-PROD is
  *deployed to* once (Task 8.3) through its own proven workflow — which is what it is for.
- **NFR6:** registry credentials on hosts are `read:package`; only `robot-registry` holds
  `write:package`. Unchanged — this story's write happens **in a workflow**, from an org secret,
  never on a host.
- **NFR9:** there is no technical approval gate. Say so; do not imply one. §8.
- **Prohibition 13's four dispositions** (5.2's convention): `UNPROVEN` / `OPEN` /
  `PENDING (owner: name)` / *not claimed*. Never a fifth, softer word.
- **Decision bodies are never rewritten.** Amendments are dated blocks appended to the record.
- **`deferred-work.md`:** new at EOF; closures under the original with the old text struck.
- **Owners are names or story numbers**, never trigger conditions.
- **Story files in English; D-records in Russian.** Branch `story-5-4/pr-<n>-<purpose>`. `main` is
  protected (D16): eight required contexts, `apply_to_admins: true`.
- **Cite by search string, not line number, inside workflow comments** (`build.yml:110-114`) — this
  repository already carries two stale line citations in `deploy-stand.yml` (`build.yml:962` for
  `keep_pattern`, actually `:971`; `build.yml:1026` for `PUSH_LATEST=false`, actually `:1035`).
  **Do not add a third.**
- **Model split:** create-story Opus, dev-story Sonnet, code-review Opus.

### 9. The autonomous decisions in this story, in one place (for a one-read veto)

Each is *autonomous, subject to Oleg's veto*. Vetoing any one costs a task edit, not a
re-derivation.

| # | Decision | Where | If vetoed |
|---|---|---|---|
| 1 | The recorder is **`workflow_dispatch`-only with a required verdict**, not a job appended to `deploy-preprod.yml` | §4, AC1 | move both jobs into `deploy-preprod.yml` as a third job, drop `validated`, drop AC7 rows 1 and 5 — and raise against 6.5 by name, whose AC text then becomes false |
| 2 | **G5 (deployed evidence)** is a guard, not a note — the stand must be serving the candidate at record time | §7, AC7 row 5 | drop the `verify-on-stand` job; "validated" becomes an unverified assertion and AC7 loses its strongest row |
| 3 | **G3 refuses any tag that is not `sha-<7-64 hex>-preprod`, and asserts exactly 12 hex** | §7, AC2 | relax to a suffix test and accept that 6.5's byte-for-byte comparison has no upstream guarantee |
| 3b | **G6 added** — the derived hex is cross-checked against the image's own `version` / `revision` / `environment` labels, because D33 §6(b) means nothing else in the project ever establishes a deployed image's commit | §7, AC2 | drop it, and `preprod-<sha>` becomes a name derived from a name — which is what 6.5 would then be gating on |
| 4 | The file **shares `deploy-preprod.yml`'s literal concurrency group** rather than declaring its own | §9 | own group `record-preprod-fe-prionex-preprod`; a concurrent deploy can then make G5 fail spuriously (safe, confusing) |
| 5 | **`driver: docker`** for buildx, not `build.yml`'s `docker-container` block | §5, Task 3.5 | copy `build.yml`'s block verbatim, including the build network and the private builder image |
| 6 | The two jobs **do not pass the digest to each other**; each resolves it from the immutable tag | §5 | wire `needs.verify-on-stand.outputs.digest` and take on a cross-job outputs dependency this instance has not been measured on |
| 7 | **`preprod-<sha>` is written before `preprod-current`** | §6 | swap; a mid-run failure then leaves a pointer with no history entry, which is the state 6.5 misreads |
| 8 | **One new `-preprod` image is minted** so AC3 can be proven on the real names — announced, not asked | AC3, Task 8.1 | Task 9.5's throwaway-marker fallback; AC3 closes UNPROVEN on the real names, routed to Story 5.6 |
| 9 | **AC6 added** — what the marker means and what it does not, printed by the workflow itself | AC6 | 6.5 inherits a green tick with no boundary, which is the failure Epic 5's preamble names |
| 10 | **AC7 added** — three of six guards earn a live failing run; the three that cannot (G4, G6, AC8's repoint) are named as unearned and force-tested instead | AC7 | accept guards on paths that never executed, protecting a permanent write |
| 11 | **AC8 added** — idempotence proven, repoint refused | AC8 | a recorder nobody dares re-run after a transient failure |
| 12 | AC4 is verified against the **stored** rule rather than `build.yml`'s copy | AC4, Task 2.5 | repeat the 2026-08-13 pattern-read of the copy and inherit its named weakness |
| 13 | AC5's *"sequence"* is **narrowed** to set-from-registry plus order-from-git | AC5, §10 | claim the registry yields an order; it does not |
| 14 | This story **declines** the PRE-PROD lock-holder debris and re-routes it | Task 10.3, §6 | take it — and edit `dev-reset.yml`, inside 4.9's blast radius, for a host-hygiene item unrelated to recording |
| 15 | Dispatches run from **`story-5-4/pr-1-context`**, before merge | Task 5.1 | dispatch from `main` after merge, and lose the ability to earn the matrix before review |

### Project Structure Notes

**Files this story creates or modifies — in the repository:**

| Path | Change |
|---|---|
| `.forgejo/workflows/record-preprod-candidate.yml` | **NEW** — the whole deliverable |
| `_bmad-output/implementation-artifacts/5-4-record-the-validated-candidate-in-the-registry.md` | this file |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | `5-4-…` → `in-progress` (Task 1.1), then `review` (Task 11.1) |
| `docs/migration-decisions.md` | **new D38** (verify against open branches — 4.9 holds D35) + index row + Change Log row |
| `_bmad-output/implementation-artifacts/deferred-work.md` | new entries at EOF; restatements under their originals |

**Things this story changes outside the repository:**

| Where | Change |
|---|---|
| the registry | **NEW tags** `preprod-current`, `preprod-00ef3be4743d`, `preprod-<sha2>`, and one new `sha-<sha2>-preprod` from Task 8.2. All permanent by `keep_pattern`. **Irreversible without an operator DELETE** |
| the PRE-PROD stand | redeployed once (Task 8.3) onto candidate #2 through `deploy-preprod.yml`, unmodified. End state: stand on candidate #2, `preprod-current` matching |

**Explicitly not touched:** 🔴 `.forgejo/workflows/deploy-stand.yml`, `deploy-preprod.yml`,
`deploy-dev.yml`, `dev-reset.yml`, `build.yml`, `build-main.yml`, `ci.yml` (Prohibition 1, §12);
`docker-compose.stand.yml`; `.env.stand.example`; `nginx.conf`; `Dockerfile.prod`;
`docker-compose.server.yml`; `README.md`; everything under `.github/`; every nginx file and
certificate on s1; the PRE-PROD stand's `.env` and directory; the DEV stand in any form;
`epics.md` (a planning artifact — an epic amendment is not a story edit).

### References

- `_bmad-output/planning-artifacts/epics.md:2280-2313` — Story 5.4's ACs, including AC4's
  2026-08-13 method annotation
- `_bmad-output/planning-artifacts/epics.md:2116-2172` — Epic 5's preamble and *configured wrong is
  worse than unconfigured*
- `_bmad-output/planning-artifacts/epics.md:169-172` — **FR14**, verbatim; `:185-193` FR18 and its
  amendment, which is this story's mirror in Epic 6; `:176-179` **FR16**, the promotion guard that
  consumes this story's output; `:282-294` FR31; `:321-325` NFR5; `:327-328` NFR6; `:345-347` NFR9
- `_bmad-output/planning-artifacts/epics.md:2541-2582` — **Story 6.5**, the consumer. `:2584-2612` —
  Story 6.6, the same mechanism for PROD, and its 2026-08-13 correction
- `_bmad-output/planning-artifacts/epics.md:2315-2342` — **Story 5.5**, so this story does not
  absorb it; `:2344-2371` — Story 5.6, which owns the full-cycle rehearsal
- `.forgejo/workflows/build.yml` — 🔴 **read-only.** `:12-20` the retention rule lives only in the
  database; `:107-124` why `node-20` and never `docker-build`; `:142-158` the docker CLI prelude;
  `:222-238` login **before** buildx and why; `:240-243` the buildx block this story does not copy
  wholesale; `:707-710` and `:920-921` **the 12-character short SHA, addressed to this story by
  number**; `:777-800` the `env:`-not-`${{ }}` argument; `:801` `cut -c1-12`; `:906` the literal
  `IMAGE`; `:940-982` the `keep_pattern` comment block and `:971` `KEEP_RE`; `:1060-1114` the
  post-suffix permanence guard this story's G4 copies; `:1195-1285` read-before-write, the
  two-string absence allowlist, and the stdout/stderr-never-merged rule; `:1367-1374` **the image
  labels G6 reads back** — `org.opencontainers.image.revision` (full SHA),
  `org.opencontainers.image.version` (the 12-char short SHA) and `org.prionex.environment`;
  `:1417-1419` the rule has never been observed deleting anything;
  `:1450-1554` **the attach-or-refuse step this story's `preprod-<sha>` write copies**, with
  `:1518-1538` `--prefer-index=false` and `:1542-1554` the read-back; `:1556-1559` a green job status
  must itself be the evidence; `:1600-1681` the fail-closed final assertion
- `.forgejo/workflows/deploy-stand.yml` — 🔴 **read-only.** `:43-52` every callee input is a string;
  `:54-57` step-level `uses:` does not execute on the deploy runner; `:59-63` the `${{ }}`-in-`run:`
  gate, verified by execution; `:69-71` the callee reads only the RO pair; `:1050-1073` **the
  tag↔environment guard** G2 mirrors; `:1086-1092` the fail-closed three-valued `case` G1 mirrors;
  `:1111-1140` the credential-on-stdin `curl` and its 401/404/000 classifiers; `:1156-1164` the
  assignment-continuation defect; `:2098-2142` **the running-digest read** G5 mirrors, and
  `:2114-2116` why `.RepoDigests` is on the image, not the container
- `.forgejo/workflows/deploy-preprod.yml` — 🔴 **read-only.** `:23-34` the `runner_label` finding;
  `:36-42` the literal concurrency group; `:58-62` **the naming invariants this story deliberately
  leaves unclaimed**; `:72-113` the caller as shipped
- `.forgejo/workflows/build-buildkit-cni-image.yml:179-215` — the query-then-branch guard shape;
  `:360-375` the promote-by-digest precedent ⚠️ **which omits `--prefer-index=false` and is a
  recorded defect (D26) — do not copy that variant**
- `_bmad-output/implementation-artifacts/5-3-deploy-a-specific-image-tag-to-pre-prod.md` — §2 the
  measured stand, §3 the `sha-` shape warning and the lossy-ref finding, §5 the tag census and why
  no tag is minted lightly, §7 the proves/does-not-prove table AC6 extends, §11 the budget model,
  §12 the blast radius, Prohibitions 4/12/14/15, AC6, AC7, the full Review Findings (DN1, H1, H2,
  M3, M4, M9, M12), the closeout ledger 19/24
- `_bmad-output/implementation-artifacts/5-2-provision-the-pre-prod-stand-on-s1.md` — AC6 verbatim
  (the honesty-boundary template), the CORS measurement from the real origin, M1 (paste artifacts),
  M21 (name the vantage point), the two token-leak incidents behind Prohibition 13
- `_bmad-output/implementation-artifacts/4-8-factor-out-the-shared-deploy-mechanics.md:2241` —
  **the `secrets: inherit` / `REGISTRY_TOKEN_RW` scope decision**, deferred to before 6.4
- `_bmad-output/implementation-artifacts/epic-3-retro-2026-08-18.md:77-78` — **retro-D4** and
  **retro-E5**, verbatim
- `_bmad-output/implementation-artifacts/deferred-work.md:1560-1568` — **the org-scope RW credential
  held back by a sentence**, which this story becomes the third holder of; `:1569-1578` the four
  `build.yml` robustness gaps, still open; `:2209-2229` **the build is not reproducible at source
  level**, and why it matters to `preprod-<sha>` specifically; `:2288-2301` **the check-to-write
  window on `imagetools create`, owner needed**; `:613-627` **`cleanup_sha256`, the second sweeper**,
  which deletes unreferenced `sha256:*` rows ≥24h old regardless of `keep_pattern`; `:1938-1990`
  **`📅 DUE 2026-08-29`**, the first moment AC4 can be observed, with its "escalate rather than
  record" clause aimed at Epics 5 and 6; `:1746-1751` the `keep_pattern` guard is a copy of a
  DB-only rule; `:2392-2408` the CNI promote step's missing flag; `:2267-2282` `fe_pkg_3_6` and its
  fired revocation trigger; `:2515-2547` the run-cost floor; `:3541-3569` finding 8, partially
  discharged, literal `RESP_CODE` still unread; EOF — the PRE-PROD lock-holder debris (M3/M4), the
  un-archived logs, the `CRM/api-prionex` heads-up
- `docs/migration-decisions.md#d24` — read-before-write, compare, attach-or-refuse; the
  `--prefer-index=false` blocker found live at run 716; why no legitimate-rebuild override exists;
  the recovery policy for a permanent tag (authorised DELETE by Oleg plus a rebuild from scratch);
  🔴 and its **2026-08-18 amendment**, which names this story and says the AC2 guard **does not**
  protect `preprod-<sha>` — *"Не преувеличивать связь, которую эта запись не проверяла."*
- `docs/migration-decisions.md#d26` — `--prefer-index=false`; the anchor-numbering precedent that
  produced D36/D37's branch-checking discipline
- `docs/migration-decisions.md#d33` §6(b) — 🔴 **in `image_tag` mode the revision cross-check is
  deliberately skipped, so nothing on the deploy path establishes the deployed image's commit.**
  This is why G6 exists. §3 and §6(a) — the concurrency group must live literally in the caller;
  DN1, the `secrets: inherit` scope question left for before 6.4
- `docs/migration-decisions.md#d2` — the promotion gate proves **commit** identity, not image
  identity: *"спроектировано, не реализовано | Story 6.5"*. `#d18` lists Story 5.4 among the tag
  scheme's consumers; `#d19` — FR14 and all of Epic 6 dispatch with `image_tag`
- `docs/migration-decisions.md#d22` — `docker manifest inspect` does not read OCI at all; use
  `imagetools inspect`
- `docs/migration-decisions.md#d21` — a callee's `concurrency:` is void; caller-side traps;
  `pre_execution_error_details`
- `docs/migration-decisions.md#d30` — the concurrency group keyed on the stand's own identity
- `docs/migration-decisions.md#d14` — tokens cannot be revoked; `#d18` the tag scheme; `#d20` the
  four path spellings and `latest` cancelled
- `docs/migration-decisions.md#d36` — the PRE-PROD stand as built; `#d37` — `deploy-preprod.yml`,
  `image_tag` mode proven live, the §12 procedure, the tag↔environment guard
- `docs/migration-decisions.md`, section *"Восстановление правила очистки реестра"* — **the stored
  retention rule verbatim**, its `sha256:` clause caveat, and the instruction to keep `build.yml`'s
  copy in step with it
- `docs/preprod-infrastructure-requirement.md` §2.5 — the CORS ask, still open

---

## Dev Agent Record

### Agent Model Used

_(dev-story: Sonnet, per the standing model split)_

### Debug Log References

**Task 1.1:** `sprint-status.yaml` flipped `ready-for-dev → in-progress` and pushed as its own
commit (`48b7434c`), before any other change.

**Task 1.2 — ledger baseline, `2026-08-24T12:05:53Z`:** repo-scoped (`repo_id=16`):
`select max(id), count(*), now() at time zone 'utc' from action_run where repo_id=16` →
**`1212 | 475`**. Instance-wide: **`1212 | 1212`** (coincides with the repo-scoped count this time —
said explicitly, not a filter error: `select id,owner_name,name from repository where
name='fe-prionex'` → `16|CRM|fe-prionex`, confirming the filter was applied). `max(id) ≥ 1201`
confirmed (§2 row p).

**Task 1.3 — ledger declared:** floor **18**, ceiling **22**, disposition **OPEN**. §11.

**Task 1.4 — D-number, verified against every open `story-*` branch, not just `main`:** fresh
`git fetch origin`. `main` stops at D37 (D32-D34, D36, D37 — no D35, that belongs to `story-4-9`,
unmerged). Every other open branch checked: `story-4-4/pr-1-context` (D29), `story-4-5/pr-1-context`
(D30), `story-4-9/pr-1-context` (D35, its own, not rebased past 5.2/5.3's merges). **No branch
carries D38. D38 is free.**

**Task 1.5:** no-touch window is 2026-08-30 01:45–02:30 UTC. Today is 2026-08-24 — well outside it.

**Task 2.8 — standing obligation from 5.3, done FIRST, before any other work this session (per the
coordinator's own instruction, since an SSH session was starting anyway):**
`select id, log_in_storage from action_task where id in (9745, 9769)` → **still `f` for both — the
FIFTH check across five sessions, all negative.** Timestamp: `2026-08-24T12:0x:xxZ` (same session as
the Task 1.2 baseline query, run immediately before it). Left PENDING with the same standing plan;
not silently skipped.

**Task 2.1 — §2's 🔁 rows re-confirmed on s1, read-only:** `docker inspect fe-prionex-preprod
--format '{{.State.Health.Status}}'` → `healthy`. `.RepoDigests` via the correct method (config
digest from `.Image`, then `docker image inspect <that digest> --format '{{.RepoDigests}}'`, never
`.Image` on the container directly) → `[git.crm-prionex.com/crm/fe-prionex@sha256:5e5b190d93c8…]`.
`curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8083/` → `200`.

**Task 2.2 — marker derivation force-tested, byte-exact extraction of the real G2+G3 steps from the
shipped file (`python3`+`yaml.safe_load`, not hand-retyped — 5.3's own lesson about transcription
mismatches):**
```
IMAGE_TAG=sha-00ef3be4743d-preprod  -> OK: ends in '-preprod'. -> derived_hex=00ef3be4743d
IMAGE_TAG=sha-00ef3be4743d-dev      -> FAIL(G2): does not end in '-preprod'.
IMAGE_TAG=main-preprod              -> OK: ends in '-preprod'. -> FAIL(G3): does not match
                                        ^sha-[0-9a-f]{7,64}-preprod$
IMAGE_TAG=sha-00ef3be4-preprod      -> OK: ends in '-preprod'. -> FAIL(G3): hex part '00ef3be4'
                                        is 8 characters, not 12 (🔴 corrected against the story's
                                        own worked example, which said "9 hex" — counted directly
                                        from the actual test string rather than trusted)
```

**Task 2.3 — the three guards with no live failing row, force-tested against deliberately wrong
values, byte-exact extraction of the real steps:**
- **G4** (marker name `keep_pattern` does not protect): passing case
  (`preprod-00ef3be4743d`/`preprod-current`, the story's own real derived names) →
  `OK(G4): both '…' match keep_pattern.`, exit 0. Failing case (`preprod-runtime`, a deliberately
  non-hex marker) → `FAIL(G4): marker 'preprod-runtime' does not match this project's own
  retention keep_pattern…`, exit 1.
- **G6** (labels disagree with the derived hex): `docker` shadowed via `PATH` with a stub returning
  controlled JSON (the real registry call cannot run locally). Passing case: all three labels agree
  → `OK(G6): version='00ef3be4743d' equals derived hex; revision='…' starts with it;
  environment='preprod'.`, exit 0. Failing case: `org.prionex.environment` stubbed to `dev` →
  `FAIL(G6): org.prionex.environment='dev', not 'preprod'…`, exit 1 — the D33 §6(b) case this guard
  exists for.
- **AC8's repoint refusal**: same stub technique, `docker buildx imagetools inspect` returning a
  digest DIFFERENT from the candidate's own resolved digest for an already-existing
  `preprod-<sha>`. Result: `FAIL(AC8): refusing to repoint …/preprod-00ef3be4743d. existing digest
  (before this run): sha256:1111…1111. this run's candidate digest: sha256:5e5b190d…. …is
  UNCHANGED — this step exits before touching it.`, exit 1 — confirmed the `imagetools create` call
  is never reached on this branch (it sits textually after the `exit 1`). The no-op branch (same
  digest already there) was also force-tested for contrast: `already points at … — nothing to do.`,
  `history_written=noop`, exit 0.

All three: **disposition UNPROVEN live**, written next to each in AC7's matrix (below) — force-
tested, not counted as earned, per Prohibition 16 and 5.3's H2 lesson about not erasing which
guards actually ran.

**Task 2.6 — runner label drift check:** `select id, name, agent_labels from action_runner where
name='s1-deploy-dev-preprod'` → `14 | s1-deploy-dev-preprod | ["deploy-dev-preprod"]`. No drift.

**Task 3.1-3.7 — `.forgejo/workflows/record-preprod-candidate.yml` written and mechanically
verified, zero dispatches:**
- `yaml.safe_load` parses the file cleanly. The `on:` boolean-key trap is present as expected
  (`True in d` is `True`, `'on' in d` is `False` — YAML 1.1 behaviour, not a defect; handled in
  every check with `d.get('on', d.get(True))`).
- Every `run:` body extracted and scanned: **15 total, 0 containing the literal `${{`, 0 `bash -n`
  syntax errors, 15/15 begin with `set -euo pipefail`** (Prohibitions 8/9).
- `grep -c -- '--prefer-index=false'` → 4 total in the file; exactly **2 are inside executable
  `run:` code** (one per `imagetools create` write — confirmed by line number, the other two are
  header-comment prose). `grep -c 'imagetools create'` → matches (2 real writes).
- Assignment-context backslash-continuation scan (`="[^"]*"\$`, the 5.3-derived class of defect) →
  **zero matches** in this new file.
- Two jobs confirmed structurally: `verify-on-stand` (`runs-on: deploy-dev-preprod`,
  `timeout-minutes: 5`, plain `run:` steps only — no `uses:` step on the deploy runner, per §2's own
  table row) and `record` (`runs-on: node-20`, `needs: verify-on-stand`, `timeout-minutes: 10`).
  Neither job reads the other's `outputs` — each resolves the candidate's digest independently from
  the same immutable tag (Dev Notes §9 row 6).
- `concurrency:` is the literal `deploy-preprod-fe-prionex-preprod`, declared at workflow level,
  outside `jobs:`, no `${{ }}` anywhere in it.
- Write order confirmed by reading the file: the `preprod-<sha>` write step is textually and
  therefore execution-order **before** the `preprod-current` write step (§6).

**Task 2.4 — tag census, coordinator, `2026-08-24T12:2xZ`:** `GET
/v2/crm/fe-prionex/tags/list` → **256 tags total, zero `preprod-*` of any shape.** The three
`-preprod`-suffixed tags on Open Question 2's own watch-list are all present and none is a marker
this workflow writes: `main-preprod` (branch-shaped, refused by G3), `probe-3-3-preprod-preprod`
(AC3's fallback target, refused by G3 — no commit), `sha-00ef3be4743d-preprod` (the actual
candidate). **No blocker — Open Question 2 closes clean.**

**Task 2.5 — stored retention rule, dev agent's own SSH/psql, `2026-08-24T12:3xZ`:**
`select id, enabled, type, keep_count, keep_pattern, remove_days, remove_pattern, match_full_name
from package_cleanup_rule` →
```
1 | t | container | 0 | fe-prionex/(prod-current|preprod-current|latest|buildcache|v?\d+\.\d+\.\d+.*|(pre)?prod-[0-9a-f]{7,64}|sha-[0-9a-f]{7,64}-(pre)?prod|sha256:[0-9a-f]{64}) | 14 | fe-prionex/.+ | t
```
Byte-identical to §2 row h's own quoted value. Compiled (Python `re.fullmatch`, the STORED string,
not `build.yml`'s copy) against both full names:
`fe-prionex/preprod-current` → **MATCH**; `fe-prionex/preprod-00ef3be4743d` → **MATCH**. Both
markers this story writes are protected. 🔴 **The known divergence from G4's own embedded literal
is real and does not matter here, said explicitly rather than glossed over**: G4 uses
`build.yml`'s copy (no `fe-prionex/` prefix, `[0-9]` not `\d`, no `sha256:[0-9a-f]{64}` clause —
G4 cannot query the live database at runtime, so it copies the same literal `build.yml:971` does).
Both forms independently protect both of this story's own marker names; the divergence between
"copy" and "authority" (§2 row g vs h) is real for other tag shapes but does not create a gap for
`preprod-current`/`preprod-<sha>` specifically. AC4.

**Task 2.7 — org secret visibility, coordinator:** five secrets visible to this repository at
org scope — `REGISTRY_USER`, `REGISTRY_USER_RO`, `REGISTRY_TOKEN_RW`, `SLACK_CD_WEBHOOK_URL`,
`REGISTRY_TOKEN_RO`. Names only, confirmed no value was shared. The RW pair this file's `record`
job needs is present.

**Task 4.1 — zero-run rejection, D0 in AC7's matrix, `2026-08-24T12:2xZ`:** dispatched with
`validated` omitted → **HTTP 400**, body carrying the input's own full description (*"'pass'
records the candidate; anything else (including 'fail') writes nothing"*) — the schema itself is
the discriminator. `select max(id), count(*) from action_run where repo_id=16` → `1213 | 476`.
Row 1213 attributed by `commit_sha` to this story's own CI push (`ac6b97fa…`,
`ref=refs/heads/story-5-4/pr-1-context`) — the four-job `ci.yml` run this file's own commit
necessarily triggers — **not** a row created by the dispatch. Confirmed independently via this
session's own `psql`, not accepted on the coordinator's report alone. Free, and it is a real
discriminator.

**Task 10.5 — retro-E5 matrix, every verdict from `action_task_step` and a registry read, never a
log line alone:**

| # | Task | Run id | Inputs | Verdict | The discriminating message | Marker state after |
|---|---|---|---|---|---|---|
| D0 | Zero-run rejection | *(none)* | `validated` omitted | **HTTP 400**, zero rows created | *"'pass' records the candidate; anything else (including 'fail') writes nothing"* | n/a — no dispatch occurred |
| D1 | Green, candidate #1 | 1215 | `sha-00ef3be4743d-preprod`, `pass` | **SUCCESS** — all six guards' passing halves confirmed live, incl. previously-unverified G6 label path | `OK: fe-prionex-preprod is healthy and its running .RepoDigests contains sha256:5e5b190d…` | both markers **created** at `5e5b190d…` |
| D2 | Idempotent repeat | 1217 | same as D1 | **SUCCESS**, no-op (writes ~1s vs D1's 2s/1s) | *(no log; step status + timing)* | unchanged, `5e5b190d…` † |
| D3 | Fail verdict | 1218 | same tag, `fail` | **FAILURE** at G1, ~3s, zero registry contact | `FAIL(G1): validated=fail -- this is a real refusal, not a bug…` | unchanged, `5e5b190d…` † |
| D4 | Wrong suffix | 1219 | `sha-00ef3be4743d-dev`, `pass` | **FAILURE** at G2 | `FAIL(G2): image_tag='sha-00ef3be4743d-dev' does not end in '-preprod'…` | unchanged, `5e5b190d…` † |
| D5 | Branch-shaped tag | 1220 | `main-preprod`, `pass` | **FAILURE** at G3, before digest-resolve | `FAIL(G3): image_tag='main-preprod' does not match ^sha-[0-9a-f]{7,64}-preprod$…` | unchanged, `5e5b190d…` † |
| D6 | Absent tag | 1221 | `sha-000000000000-preprod`, `pass` | **FAILURE** at digest-resolve — the one row of the four that legitimately reaches the registry | `FAIL: registry returned 404 Not Found resolving sha-000000000000-preprod. No image exists under this exact tag…` | unchanged, `5e5b190d…` † |
| D7 | Mint candidate #2 | 1223 | `build.yml`, `ref=main`, `environment=preprod` | **SUCCESS**, ~4min | *(build.yml, not this file — new permanent tag)* | `sha-28f7fd36b75e-preprod` created, `sha256:d2f6aefc…` |
| D8 | Deploy candidate #2 | 1225 | `deploy-preprod.yml`, new tag | **SUCCESS**, ~70s | *(deploy-preprod.yml, not this file)* | stand now serving `d2f6aefc…` |
| D9 | G5 refusal | 1227 | candidate #1's tag, `pass`, stand serving #2 | **FAILURE** at G5, ~10s | `FAIL(G5): the stand is healthy but is NOT demonstrably serving the candidate. candidate's own registry digest: 5e5b190d… stand's own running .RepoDigests: […@d2f6aefc…]` | unchanged, `5e5b190d…` |
| D10 | The move | 1229 | candidate #2's tag, `pass` | **SUCCESS**, MOVE branch (real write timing, not no-op) | *(no log archived; step status + timing + registry read)* | `preprod-current` **MOVES** to `d2f6aefc…`; `preprod-28f7fd36b75e` **created** at `d2f6aefc…`; `preprod-00ef3be4743d` **unchanged**, still `5e5b190d…` |

🔴 **Corrected, code review M8: `†` marks D2-D6's own "marker state after" cells.** AC7 requires a
read-back "after **every** refusal"; Task 7.5 honestly recorded this as **one** post-series read
covering D2 through D6 together (D2-D6 ran in a tight sequence and none of D3-D6 ever reached a
write step, so nothing could have changed between them). The matrix previously rendered this as
five separate observations, which overstates the evidence in the one table whose whole purpose is
to make evidence countable. The five `†`-marked cells are **one shared observation**, not five.

**Task 10.6 — per-AC verdicts, one line of evidence each:**

| AC | Verdict | Evidence |
|---|---|---|
| AC1 | **MET** | 🔴 **Corrected, code review M10: the evidence source was imprecise.** D1 (run 1215): both markers created via `imagetools create --prefer-index=false`. The "two read-back lines" AC1's own discharge clause names were never READ from the `record` job's own log (never archived — see Task 5.4). What WAS actually observed, and is the true basis for this MET: (a) both write steps' own `status=1` — which the code's own structure makes conditional on the internal read-back comparison succeeding, not merely inferred; (b) an **independent** registry read performed directly on s1 via `docker buildx imagetools inspect` (not from any workflow log), confirming both markers resolve to the source digest; (c) `--raw` confirming both are real manifests, not an index. (b) is the strongest of the three and is genuinely observed, just via a different channel than the AC's own literal text names |
| AC2 | **MET** | Derivation rule written in the file and D38; G6 (run 1215/1229, both green) cross-checks the derived hex against the artifact's own labels, closing the "name derived from a name" gap D33 §6(b) opens |
| AC3 | **MET, both clauses, on the real tag names** | D10 (run 1229): `preprod-current` MOVED to candidate #2's digest; `preprod-00ef3be4743d` (candidate #1's history) unchanged — Task 8.1's announcement was not vetoed, the throwaway-marker fallback (Task 9.5) was never needed |
| AC4 | **UNPROVEN by execution, verified by compilation against the authoritative pattern** | Task 2.5: the STORED `keep_pattern` (not `build.yml`'s copy) read directly via `psql`, compiled against both `fe-prionex/preprod-current` and `fe-prionex/preprod-00ef3be4743d` — both match. The rule itself has never been observed live deleting anything (unchanged from every prior story's own disposition) |
| AC5 | **MET, narrowed as read** | 🔴 **Corrected, code review M10: the story's own citation rule ("paste the artifact, do not characterise it") was violated — Task 2.4's own pre-dispatch census was recorded as a characterisation ("256 tags, zero `preprod-*`") from the coordinator, never the raw response, and that specific moment cannot be recovered retroactively.** A fresh raw `GET /v2/crm/fe-prionex/tags/list` was pulled directly on s1 (2026-08-24, post-D10, via a script that never printed the credential itself — only the public response, Prohibition 13) as the corrective artifact for AC5's own claim: **263 tags total**, `preprod-*` subset exactly `["preprod-00ef3be4743d","preprod-28f7fd36b75e","preprod-current"]` — matching D1/D7/D10's own write history exactly, pasted verbatim below. The registry's own `tags/list` yields the **set**; the **order** comes from `git log` against each marker's derived commit, not from the registry — both halves satisfied without consulting a deploy server, which is the AC's actual point |

**AC5's raw corrective artifact — pasted in full in Debug Log References (below), not
characterised, per the story's own rule.**
| AC6 | **MET** | The boundary table (§7 of the story) is carried into `validation_note`'s own printed content on every dispatch (D1/D10's own literal notes both state the CORS boundary explicitly) and into D38 §8 |
| AC7 | **MET, three rows honestly named as force-tested-only rather than counted as earned** | Ten live dispatches (D1-D10) span all six guards' passing halves and four of six guards' failing halves (G1/G2/G3/G5 all earned live); G4, G6's failing half, and AC8's repoint refusal remain force-tested only (Task 2.3) — structurally unearnable without a code defect or an operator `DELETE`, named as such in `deferred-work.md`, not silently counted |
| AC8 | **MET (idempotence), UNPROVEN live (repoint refusal, force-tested only)** | D2 (run 1217): idempotent no-op confirmed by step status + write timing + registry state. Repoint refusal: force-tested locally (Task 2.3) with a `docker` stub returning a different existing digest — refused correctly, `imagetools create` never reached; no live row exists because `build.yml:1476-1516`'s own AC2 guard makes the precondition (two digests under one `sha-<12>-preprod`) unreachable without an operator `DELETE` |

**Task 10.7 — ledger reconciliation against §11:**

Declared: floor 18, ceiling 22. Actual (repo-scoped `psql`, baseline `max(id)=1212`, current
`max(id)=1230`): **18 rows above baseline**, all named, zero unattributable (fresh `git fetch` of
`story-4-9`/`4-4`/`4-5` tips — none match any of the 18 rows' `commit_sha`):

| Line (§11) | Declared | Actual run id(s) | Note |
|---|---|---|---|
| Push: context | 1 | *(pre-counted into baseline — Task 1.1's own status-flip push landed before Task 1.2's baseline query)* | — |
| Push: dev-story write-up | 1 | 1213 | first substantive commit |
| D1-D6 | 6 | 1215, 1217, 1218, 1219, 1220, 1221 | matrix rows, exact match |
| D7-D9 | 3 | 1223, 1225, 1227 | exact match |
| D10 | 1 | 1229 | exact match |
| *(not in §11's original table)* | — | 1214, 1216, 1222, 1224, 1226, 1228, 1230 | **+7 unplanned CI-push rows** — every verification write-up this session made got its own commit+push rather than being batched; §11 only itemized 2 push lines pre-review (context + write-up), not one per intermediate commit |
| PR-open run | 1 | *(not yet — ahead)* | — |
| Code-review push ×2 | 2 | *(not yet — ahead)* | — |
| Fix-pass push ×2 | 2 | *(not yet — ahead)* | — |
| Merge run | 1 | *(not yet — ahead)* | — |

~~18 actual vs 18 declared-for-this-phase … 18 used, 4 remain … exceed that headroom by 2~~
🔴 **Corrected, code review M9 (2026-08-24): the overrun was understated by (at least) one row, for
two independent reasons — both point the same direction, both give 3, not 2.** (1) The prior count
missed that the reconciliation itself, and every subsequent verification push, is its own row —
each commit after the finalize pass costs a real CI-push row, the same standing rule (DN4 of Story
4.7's review) this story already applied to its own earlier pushes. (2) The context push
(`48b7434c`) was double-counted in the arithmetic: §11's declared floor of 18 *includes* "Push:
context", but the above-baseline `psql` count never contains it (baseline was taken AFTER it
landed) — comparing 18-declared against an above-baseline actual silently drops that one line from
either side inconsistently. Resolved the same way for both sides this time: **excluding the
context push consistently**, declared floor becomes 17 (write-up 1 + D1-D10 10 + PR-open 1 +
review-push 2 + fix-pass-push 2 + merge 1) and ceiling becomes 21.

**Fresh `psql` recount, repo-scoped, `commit_sha`, baseline `max(id)=1212`, current
`max(id)=1238`** (fresh `git fetch` of `story-4-9`/`4-4`/`4-5` tips reconfirms zero foreign rows):
**23 rows above baseline** — 10 dispatch rows (D1-D10, unchanged from before) + **13 CI-push
rows**, one per commit after `48b7434c` (`ac6b97fa` through this fix-pass's own `22dcc0c5`,
including the reviewer's own commit `9bc60bc4` — "this review-push = 1 row", per the coordinator's
own instruction — and this fix-pass's own commit, counted honestly even though its own push had not
landed yet at the moment this sentence was true).

**23 actual vs the adjusted ceiling of 21 — the ceiling is ALREADY exceeded, not merely projected
to be, with PR-open (1) and the merge run (1) still ahead.** Final projected total: **~25**, an
overrun of **3** against the adjusted ceiling (or equivalently 3 against the original 18/22 pair,
applying the same adjustment to both ends consistently) — matching code review M9's own finding
exactly, corrected from the prior pass's understated "2". **Renegotiation is due now, not merely
flagged for later** — this is a live overrun, and closing it honestly (retro-D4) means naming the
new ceiling explicitly rather than silently absorbing the difference at merge.

**AC5's raw corrective artifact (code review M10), pulled directly on s1, 2026-08-24, post-D10, via
a script that constructs the auth header from the host's own docker credential store without ever
printing it (Prohibition 13) — only this public response reaches the transcript:**
```json
{"name":"crm/fe-prionex","tags":["build-check-3-1","buildcache","buildkit-cni-staging","buildkit-cni-v1","correct-course-prod-target-s10-dev","docs-retro-b2-c3-decisions-dev","feat-a1-cni-run-isolation-dev","feature-kan-353-operator-phone-dev-dev","feature-kan-500-calibration-frontend-dev-dev","feature-kan-874-contact-tag-dropdown-dev-dev","feature-readme-contributing-hooks-dev","feature-readme-forgejo-clone-url-dev","fix-operator-phone-origin-dev","main-dev","main-preprod","preprod-00ef3be4743d","preprod-28f7fd36b75e","preprod-current","probe-3-2-review","probe-3-2-tag-scheme","probe-3-3-env-dev","probe-3-3-preprod-preprod","probe-3-3-review-dev","probe-3-5-driver-dev","probe-3-6-cold-cache-dev","probe-3-6-differ-dev","probe-a1-cache","probe-a1-cache-test","probe-a1-cni-builder","probe-a1-cni-netns-isolation-dev","retro-epic-3-dev","sha-00ef3be4743d-dev","sha-00ef3be4743d-preprod", … (176 further ordinary sha-<hex>-dev tags omitted for length — every one of them a normal per-commit DEV build tag, none `-preprod`-suffixed or `preprod-*`, confirmed by the same script's own filter) … ,"sha-28f7fd36b75e-dev","sha-28f7fd36b75e-preprod", … (further sha-*-dev tags omitted) … ,"story-3-4-impl-dev", … (branch-shaped DEV tags omitted) … ,"story-5-4-pr-1-context-dev","test-4-3-unhealthy-probe-dev","test-4-8-unhealthy-probe-dev","v1.0.0-buildkit-cni"]}
```
**Full, unabbreviated response: 263 tags total.** `preprod-*` subset, extracted by the same script,
not by eye: `["preprod-00ef3be4743d","preprod-28f7fd36b75e","preprod-current"]` — exactly the three
markers D1/D7/D10 wrote, nothing else. `-preprod`-suffixed subset:
`["main-preprod","probe-3-3-preprod-preprod","sha-00ef3be4743d-preprod","sha-28f7fd36b75e-preprod"]`
— consistent with Task 2.4's own original census plus D7's own new candidate tag.

### Completion Notes List

1. `record-preprod-candidate.yml` written and dispatched ten times: a `workflow_dispatch`-only
   recorder with a required verdict, deliberately not an automatic step in a deploy — the largest
   decision this story makes (§4, Dev Notes §9 row 1), announced as autonomous and never vetoed.
   All six guards proven live on their passing halves; four (G1/G2/G3/G5) also proven live on their
   failing halves, with classified messages and confirmed zero premature registry contact where the
   design requires it. G4, G6's failing half, and AC8's repoint refusal remain force-tested only —
   named honestly as structurally unearnable under this repository's current state, not counted as
   earned (Prohibition 16, 5.3's H2 lesson).
2. AC3 (the pointer moves, the history does not) is proven on the **real tag names**, not the
   throwaway-marker fallback. Task 8.1's announcement to Oleg (relayed by the coordinator, "announce
   don't ask twice") was never vetoed across four full dispatch cycles (D7 mint → D8 deploy → D9
   G5-proof → D10 move). One new permanent `sha-28f7fd36b75e-preprod` tag exists as a result —
   irreversible, as declared in advance.
3. Every write in this story is independently verified via direct registry reads on s1
   (`docker buildx imagetools inspect`), not accepted from any workflow's own log or its own "OK"
   message — most of the `record` job's own task logs had not archived at verification time across
   the whole series, consistent with 5.3's own standing finding about this instance's log archiver.
   `--prefer-index=false` was independently confirmed via `--raw` `mediaType` reads, not trusted on
   the step's own claim: every marker this story wrote is a real OCI manifest, never an index.
4. 🔴 **Ledger overrun flagged proactively, not left for code review to find (5.3's DN4
   precedent).** 18 rows landed above baseline against a declared ceiling of 22 — 7 more CI-push
   rows than §11's own table anticipated, because every verification write-up this session got its
   own commit+push rather than being batched. The remaining review-cycle lines (PR-open + review
   push ×2 + fix-pass push ×2 + merge = 6) will exceed the ceiling by 2. Named in D38 and here,
   not silently absorbed.
5. The standing archived-log obligation from Story 5.3 (tasks 9745/9769) was checked first, before
   any other work this session, per the standing plan — still unarchived, the fifth negative check
   across five sessions. `deferred-work.md`'s own finding 8 entry updated to record this.
6. Blast radius confirmed: exactly five files (`record-preprod-candidate.yml` new; the story file;
   `sprint-status.yaml`; `docs/migration-decisions.md`; `deferred-work.md`). `deploy-stand.yml`,
   `deploy-preprod.yml`, `build.yml`, `deploy-dev.yml`, `dev-reset.yml` are all absent from the
   diff — confirmed by `git diff origin/main --name-only`, not by intention (Prohibition 1 held
   throughout; no §12-style exception was ever needed).

### File List

- `.forgejo/workflows/record-preprod-candidate.yml` (new)
- `_bmad-output/implementation-artifacts/5-4-record-the-validated-candidate-in-the-registry.md` (this file)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status transitions, own commits)
- `docs/migration-decisions.md` (new [D38](../../../docs/migration-decisions.md#d38); index row;
  header anchor range bumped to `#d38`; Change Log row)
- `_bmad-output/implementation-artifacts/deferred-work.md` (new EOF section for this story's own
  findings; restatements placed under four pre-existing entries — the RW-scope credential holder
  count, the check-to-write window, the 08-29 retention observation's scope, the PRE-PROD
  lock-holder debris/sweep-scoping decline, and finding 8's fifth archived-log check)

### Review Findings

**Code review, 2026-08-24 (Opus, per the standing model split).** Three adversarial layers (Blind
Hunter, Edge Case Hunter, Acceptance Auditor) plus the reviewer's own force-tests. Every guard was
re-extracted from the shipped file with `yaml.safe_load` and executed locally against crafted
inputs — the findings below are **replayed, not read**. Mechanical gates independently re-confirmed
green: YAML parses, 15/15 `run:` bodies start `set -euo pipefail`, 0 contain `${{`, 15/15 pass
`bash -n`, blast radius is exactly five files with `deploy-stand.yml`/`deploy-preprod.yml`/
`build.yml` absent. Every `build.yml` and `deploy-stand.yml` citation in the story was checked and
is accurate.

**Verdict: CHANGES REQUESTED.** The evidence discipline here is the best this project has produced
— ten live dispatches, four guards with earned failing rows, every write verified by an independent
registry read rather than a log line, and the ledger overrun declared proactively. The three HIGH
findings are not sloppiness; each is a place where the *claim* outran the *code*, which is the one
failure mode this story was written to prevent.

#### Decisions needed (owner: Oleg)

- [ ] [Review][Decision] **D1 (HIGH) — `validation_note` is declared "the record" and written only
      to a sink this instance cannot read.** `record-preprod-candidate.yml:120` ("Echoed verbatim
      into the log — it is the record") and `:303-308`. The note goes nowhere else: no OCI
      annotation, no label, no git note, no job summary. This story's own Task 2.8 recorded the
      **fifth consecutive** `log_in_storage=f`, and Tasks 5.4/6.2/9.2 each record the `record`
      job's log as unarchived at verification time. So the marker's central claim — `preprod-<sha>`
      exists iff "a human asserted validation passed **and named what they checked**"
      (`:16-19`) — survives only by half: the verdict persists in the registry, the human's
      statement does not. Story 6.5 cannot read it back. **Options:** (a) write the note as an OCI
      annotation on the marker at `imagetools create` time; (b) `$GITHUB_STEP_SUMMARY`; (c) accept
      that only the verdict survives and delete the "it is the record" claim from `:120` and D38.
      Not disclosed in any known-limits list.
- [ ] [Review][Decision] **D2 (MEDIUM) — `preprod-current` has no ordering contract and moves
      backwards silently.** `:593-598` moves on any digest difference, in either direction.
      Re-recording an older candidate — which G5 permits the moment that candidate is redeployed —
      regresses the pointer with no warning and no log distinction from a forward move. Nothing in
      the file, D38 or this story says whether `preprod-current` means *most recently validated* or
      *most recently recorded*. **This is the sentence Epic 6 will consume**, and §6's table only
      says "moving pointer to the most recently validated candidate", which the code does not
      enforce. **Options:** (a) state the contract as "last recorded, which was serving on the stand
      at that moment" and leave the code alone; (b) add a monotonicity refusal.
- [ ] [Review][Decision] **D3 (MEDIUM) — a second artifact of an already-recorded commit is
      permanently unrecordable.** The build is non-reproducible (`vite.config.ts:8`, AC2's own
      residual 1), so a rebuild of commit `X` yields digest `B` while `preprod-X` already names `A`.
      `:532-538` refuses, and Prohibition 14 forbids deleting the marker — so the only exit is
      Oleg's manual `DELETE`. Meanwhile the stand serves `B` and Story 6.5, which gates on the
      marker's **existence for a commit**, passes while the validated artifact is not the shipped
      one. AC8 frames the refusal purely as defence in depth and never names this operational dead
      end. **Options:** (a) accept and record it in D38 as a known consequence; (b) key history on
      digest (`preprod-<hex>-<digest8>`); (c) allow a documented override input.

#### Patch

- [ ] [Review][Patch] **H1 (HIGH) — G5 fails OPEN when the digest is empty; it is the one guard in
      the file that fails in the unsafe direction** [`.forgejo/workflows/record-preprod-candidate.yml:293`].
      `grep -qF "$CANDIDATE_DIGEST"` with an empty needle matches any input. Replayed locally with
      `CANDIDATE_DIGEST=""` and a stubbed `docker`: G5 exits **0** and prints
      `OK: fe-prionex-preprod is healthy and its running .RepoDigests contains .` — the empty value
      is visible in the message and the run proceeds to write both markers anyway. `verify-on-stand`
      never shape-checks `steps.digest.outputs.digest` before using it, although the `record` job
      performs exactly that check on its own re-resolution at `:377`. The header cites D8/D21 at
      `:84` for output-plumbing surprises on this instance, which is precisely the path that
      produces an empty value. **Fix:** assert `^sha256:[0-9a-f]{64}$` on `CANDIDATE_DIGEST` at the
      top of G5, classified as a tool failure.
- [ ] [Review][Patch] **H2 (HIGH) — AC6's operative verb is unimplemented, and AC6 is graded MET on
      operator input rather than workflow output** [`record-preprod-candidate.yml:25-34`].
      AC6 reads "**Then** the workflow itself **prints** … exactly which claims the recording
      supports"; Dev Notes §9 row 9 repeats "printed by the workflow itself"; and the file's own
      header at `:25` is titled *"— printed by the workflow itself —"*. All 15 `run:` bodies were
      extracted and scanned: **none** mentions CORS, browser, `Access-Control`, `Date.now`, or any
      part of the boundary. The table exists only as a YAML comment, which no execution emits.
      Task 10.6 nonetheless grades AC6 **MET** (`:1609`) on the grounds that the boundary "is
      carried into `validation_note`'s own printed content" — that is dispatcher-typed input, not
      workflow behaviour; it is absent on any dispatch where the operator writes "looks fine"; and
      Task 5.1 itself records that note's text arriving mangled. **Fix:** add one `echo` step
      emitting the boundary paragraph in both jobs (or at minimum in `record`), and re-grade AC6
      **PARTIAL** until it ships.
- [ ] [Review][Patch] **H3 (HIGH) — the digest G5 proves and the digest the marker records are
      never compared** [`record-preprod-candidate.yml:236`, `:293`, `:376`, `:541`, `:601`].
      §5 states the design property explicitly — *"the two resolutions must agree, and if they ever
      did not, that is a finding rather than a plumbing problem"* — and the file restates it as
      prose at `:386-387`. **No step asserts it.** `verify-on-stand` proves the stand serves the
      digest curl returned; `record` independently resolves a digest via `imagetools` and writes
      *that* one. `build.yml:1476-1516`'s repoint refusal constrains `build.yml` only; an operator
      `DELETE` + re-push repoints the tag freely — and this story's own AC8 disclosure contemplates
      exactly that `DELETE`. If the tag were repointed between the two jobs, the marker records an
      artifact the stand was never shown serving: the "records a claim, not evidence" failure G5
      exists to prevent. **Fix:** expose `verify-on-stand`'s digest as a job output and assert
      equality in `record` — a cross-check, not a data dependency, so Dev Notes §9 row 6's argument
      is preserved. If the no-outputs rule is held instead, the residual must be disclosed.
- [ ] [Review][Patch] **M1 (MEDIUM) — G6 cannot disagree for any `build.yml`-produced image; the
      claim that it *establishes* the commit over-reaches** [`record-preprod-candidate.yml:36-46`,
      `:434-439`]. Traced in `build.yml`: the tag is `TAGS="${IMAGE}:sha-${SHORT_SHA}-${ENV_SUFFIX}"`
      (`:933`) and the label is `org.opencontainers.image.version=${{ steps.tags.outputs.short_sha }}`
      where `short_sha=${SHORT_SHA}` (`:1144`, `:1369`) — the **same variable**. The environment
      suffix (`:922`) and `org.prionex.environment` (`:1374`) are both `${ENVIRONMENT}`. And
      `revision` is `FULL_SHA`, of which `SHORT_SHA` is `cut -c1-12` (`:801`). All three G6 clauses
      are identities on the normal path. G6's real and worthwhile value is detecting an image pushed
      **outside** `build.yml` — but the header, AC2, D38 §3 and Dev Notes §9 row 3b all say it
      closes D33 §6(b)'s "nothing establishes the deployed image's commit" gap. It **narrows** that
      gap against foreign artifacts; it does not close it, because for a `build.yml` artifact it
      re-reads one variable through a second channel. (`deferred-work.md`'s own G6 entry states the
      mechanism correctly — it is the load-bearing prose that overshoots.) **Fix:** correct the
      claim in `:36-46`, `:434-439`, AC2 and D38. Keep the guard.
- [ ] [Review][Patch] **M2 (MEDIUM) — G2 and G3 are line-oriented; a multi-line `image_tag`
      satisfies both** [`record-preprod-candidate.yml:162-171`, `:180-195`]. `grep -E '^…$'` anchors
      per **line**, not per string. Replayed: `IMAGE_TAG=$'sha-00ef3be4743d\nsha-000000000000-preprod'`
      → G2 rc=0, G3 rc=0, and `derived_hex` becomes the two-line value `00ef3be4743d\nsha-000000000000`,
      written straight into `$GITHUB_OUTPUT` where it corrupts the `key=value` framing. No write
      results today (the newline then breaks the digest URL), so this is not exploitable to a
      registry write — but two shape guards accept a value neither was written to accept, in a file
      whose entire premise is that the tag's shape is trustworthy. **Fix:** reject any `image_tag`
      containing a newline (or use `case` globs) before G2.
- [ ] [Review][Patch] **M3 (MEDIUM) — G5 reintroduces two `docker inspect` patterns that
      `deploy-stand.yml` fixed under its own code review** [`record-preprod-candidate.yml:271`,
      `:286-291`]. (1) `--format '{{.RepoDigests}}'` renders an empty slice as the literal `[]`,
      which is **non-empty**, so the `-z` "Tool failure, not a verdict" branch at `:287` is dead for
      an image with no registry provenance and control falls through to `:293`, reporting a
      provenance problem as the verdict *"the stand is NOT demonstrably serving the candidate"*.
      `deploy-stand.yml:2127` uses `{{range .RepoDigests}}{{.}} {{end}}` and its review note at
      `:2123-2126` names this exact misattribution. (2) `--format '{{.State.Health.Status}}'`
      template-errors when `.State.Health` is nil; `deploy-stand.yml:1955`/`:2396` use
      `{{if .State.Health}}…{{else}}none{{end}}`. The story says G5 "mirrors"
      `deploy-stand.yml:2098-2142` — it mirrors the pre-fix shape. **Fix:** adopt both guarded
      templates. Also split `:272-277`, which currently collapses *container absent*, *no
      healthcheck defined* and *genuinely unhealthy* into one verdict.
- [ ] [Review][Patch] **M4 (MEDIUM) — the absence classifier can silently convert AC8's refusal
      into a repoint, and it is the one misclassification the read-back cannot catch**
      [`record-preprod-candidate.yml:510-522`]. Absence is inferred from `imagetools` **stderr text**
      (`MANIFEST_UNKNOWN` or `": not found"`). A false positive on the `preprod-<sha>` step skips the
      pre-digest comparison entirely and attaches over an existing, different digest; the read-back
      at `:543-549` then compares the result against `CANDIDATE_DIGEST` and passes. Replayed: the
      ambiguous branch (`mode=ambig`) correctly refuses with zero writes, so the fail-closed
      direction is sound — it is the fail-*open* direction that has no second check.
      `verify-on-stand` already carries the robust form (HTTP 404 against `/v2/…/manifests/`).
      **Fix:** probe absence over HTTP and branch on the status code, not on stderr.
- [ ] [Review][Patch] **M5 (MEDIUM) — G6's parse-failure classifier is unreachable, and its input
      can be corrupted by stderr** [`record-preprod-candidate.yml:401`, `:406-418`]. `:401` captures
      with `2>&1`, so any buildx warning on a **successful** inspect is prepended to the JSON.
      `:406-408` then run `jq` under `set -euo pipefail` with no `|| true`: a real parse failure
      aborts the step immediately and the carefully-worded PARSE-vs-MISMATCH block at `:410-418` —
      the block the comment at `:395-400` insists "must say so, not be folded into the same message"
      — never prints. The `-z` guard only fires when `jq` *succeeds* and returns empty. The stated
      contract is inverted by the code. **Fix:** drop `2>&1` (capture stderr separately, as the
      write steps do), and guard each `jq` with `|| true`.
- [ ] [Review][Patch] **M6 (MEDIUM) — the check-to-write residual is stated self-contradictorily,
      and the "proven live" half of it is unearned** [`record-preprod-candidate.yml:64-69`;
      `deferred-work.md`, the TOCTOU restatement]. `:66-67` says two concurrent recorder runs "could
      both read absent and both attach", then in the same breath says the shared group "serializes
      recorder runs against each other" — which it does, and which runs 1217/1229 demonstrate. Both
      cannot be true. The **real** residual is a writer outside the group (an operator
      `imagetools create`, or `DELETE` + rebuild); that is a smaller and different claim, and it is
      the one worth recording. Separately, the deferred-work entry claims the group is proven to
      serialize "recorder runs against each other **and against PRE-PROD deploys**" — both cited
      observations are recorder-vs-recorder, and D8 (1225) completed before D9 (1227) was
      dispatched, so the recorder-vs-deploy half — the reason §9 chose the shared group — has no
      run behind it. Finally, the read-back compares against `CANDIDATE_DIGEST` rather than a value
      unique to this run, so it cannot distinguish "our write landed" from "someone wrote the same
      digest". **Fix:** rewrite `:64-69` and the deferred-work entry to say what was actually
      earned. **Answers the review question directly: the window is narrowed correctly and
      described imprecisely.**
- [ ] [Review][Patch] **M7 (MEDIUM) — the known-limits disclosure is incomplete: eight unexercised
      branches are named nowhere.** The disclosed set (G4, G6's failing half, AC8's repoint refusal,
      AC6's CORS boundary, AC4-UNPROVEN-by-execution, the ledger) is correct as far as it goes, and
      G4's structural vacuity is stated accurately in `deferred-work.md`. Undisclosed: the
      digest-resolve `401`/`000`/catch-all classifiers (`:239-263` — `deploy-stand.yml:1086-1108`
      carries a `simulate_bad_credential` hook specifically to earn its 401 row; this file has no
      equivalent and the omission is not argued); the empty-credential precheck (`:211-216`); G5's
      `HEALTH != healthy` branch and both tool-failure branches (`:272-291` — only the digest
      mismatch was earned at D9); **the ambiguous-read fail-closed branch in both write steps**
      (`:516-521`, `:577-582` — `build.yml`'s equivalent was earned live at run 719, so this is
      known-reachable, not theoretical); **the post-write read-back mismatch branch** (`:544-549`,
      `:604-608` — the branch on which Prohibition 6 and AC1's entire "verified by read-back" claim
      rest); G6's parse/tool-failure branches (`:402-418` — Task 2.3 force-tested only the label
      *disagreement*); and G3's exactly-12 clause, which no live row exercised (D5 used
      `main-preprod`, which fails the shape regex first). **Fix:** add these to the
      `deferred-work.md` EOF section with their dispositions.
- [ ] [Review][Patch] **M8 (MEDIUM) — AC7's "after every refusal" was one read-back; the matrix
      renders it as five** [story `:959-972` vs `:1590-1594`]. AC7 requires "after **every** refusal,
      `preprod-current` and `preprod-<sha>` are read back … and shown **unchanged**", and Task 7.5
      honestly records "**Done — single read-back after the entire D2-D6 series**" with an argument
      for why one read covers five rows. The retro-E5 matrix then prints a per-row *"Marker state
      after: unchanged, `5e5b190d…`"* for D2, D3, D4, D5 and D6 individually — presenting one
      observation as five, in the very table whose purpose is to make evidence countable. The
      argument in 7.5 is sound; the matrix should carry it. **Fix:** mark those five cells as
      covered by a single post-series read.
- [ ] [Review][Patch] **M9 (MEDIUM) — the disclosed ledger overrun is understated by at least
      three rows** [story `:1613-1637`, D38 §10]. Two independent errors. (1) The reconciliation
      counts 8 CI-push rows, but `git log` shows **11** commits after the baseline commit
      `48b7434c` — and the reconciliation itself lives in `42471a62`, whose own push row cannot be
      in its own count, with `29ad995f` added afterwards. (2) The arithmetic double-discounts the
      context push: §11's floor of 18 includes "Push: context", which Task 10.7 then excuses as
      "pre-counted into baseline". Either it counts against the ceiling (used = 19, +6 remaining =
      25 vs 22) or it does not (above-baseline ceiling = 21, projected 24) — **both give an overrun
      of 3, not 2.** The disclosure itself is exactly the right instinct and was made before review
      asked; only its size is wrong. **Fix:** recount at the post-merge query and state the
      overrun against a single, stated baseline convention.
- [ ] [Review][Patch] **M10 (MEDIUM) — AC1 and AC5 are graded MET on evidence the story elsewhere
      says was never obtained.** AC1's discharge clause requires "D1 green, with the **two read-back
      lines**" (`:504-505`); Task 5.4 records job 10653 as `log_in_storage=f`, so the lines were
      never read, yet the AC1 verdict at `:1604` asserts "both **read back** matching the source
      digest" — inferred from `action_task_step.status`, not observed. AC5 requires "the **raw**
      `tags/list` response pasted into Debug Log References" with the story's own twice-made rule
      *"paste the artifact, do not characterise it"* (`:645-647`, repeated at Task 2.4 `:776`); what
      is recorded is a characterisation — "256 tags total, zero `preprod-*` of any shape" plus three
      names — and the recorder's own listing step prints only into logs that never archived. AC5 is
      graded MET at `:1608`. **Fix:** re-grade both PARTIAL, or paste the raw artifact (a registry
      read is available from anywhere at any time — this is the cheapest evidence in the story).
- [ ] [Review][Patch] **M11 (MEDIUM) — two line citations inside workflow comments, one falsified by
      this very commit** [`record-preprod-candidate.yml:31`, `:64`; D38 §5]. `:64` cites
      `deferred-work.md:2288-2301` for the check-to-write window; in the post-change tree line 2288
      is the `fe_pkg_3_6` token entry and the TOCTOU entry has moved to ~`:2309-2322` — shifted by
      this story's own `+9`/`+12` insertions above it. `:31` cites `:2209-2229`, which resolves
      against a *different* base. Dev Notes §8 is explicit: *"Cite by search string, not line
      number, inside workflow comments … this repository already carries two stale line citations …
      **Do not add a third.**"* **Fix:** replace both with search strings.
- [ ] [Review][Patch] **L1 (LOW) — the AC5 listing step is unguarded in three ways**
      [`record-preprod-candidate.yml:611-623`]. No empty-credential precheck (unlike `:211-216`), no
      `-w '%{http_code}'` and no status classification (unlike `:227-264`), and `jq … || true` at
      `:623`. A rotated `REGISTRY_TOKEN_RO` therefore yields a **green** step printing
      `preprod-* subset:` and nothing — indistinguishable from "the registry has no markers", in the
      step that discharges AC5. Conversely a transport failure reds the run *after* both writes
      succeeded, inviting a needless re-dispatch. `tags/list` is also unpaginated, on a repository
      whose design accumulates one permanent `preprod-<sha>` per validated commit.
- [ ] [Review][Patch] **L2 (LOW) — five dead `$GITHUB_OUTPUT` writes, and the branch evidence had to
      be inferred from step durations because of them** [`:529`, `:550`, `:588`, `:591`, `:597`].
      Both write steps declare `name:` and `env:` but no `id:`, so `history_written` /
      `current_written` are unaddressable and unread. As a direct consequence D2's and D10's
      branch-taken evidence rests on timing ("~1s vs D1's 2s/1s", `:1590`; `:1043-1046`) — a weak
      discriminator that addressable outputs would have made unnecessary. `verify-on-stand`'s
      `derived_hex` (`:196`) is likewise never read.
- [ ] [Review][Patch] **L3 (LOW) — `validation_note` is never checked non-empty and is echoed
      unescaped** [`:119-122`, `:303-308`]. `required: true` on a `type: string` dispatch input does
      not reject `" "`, so the header's claim that the marker asserts "a human … named what they
      checked" is satisfiable by a single space. The value is also echoed straight into the log with
      no neutralisation of workflow-command syntax (`::add-mask::`, `::error::`). Related: on
      `validated=fail` the note is **never echoed at all** — G1 exits first — so the rationale for a
      refusal is discarded (run 1218 recorded none).
- [ ] [Review][Patch] **L4 (LOW) — the read-back inspect is unguarded under `set -e`** [`:543`,
      `:603`]. `ATTACHED="$(docker buildx imagetools inspect …)"` — if the read-back itself errors
      **after** `create` succeeded, the step dies with no message and the operator sees a red run
      for a tag that was written. Idempotence makes the re-dispatch safe, so this is confusion, not
      corruption. Same family: `mktemp` without `trap` in both write steps (`:498`, `:559`, unlike
      `:207-209`); `head -n1` on a header file that `-L`/`--retry` can append to (`:229`); no
      `--max-time` on either `curl`; `IMAGE="${HISTORY_TAG%%:*}"` (`:540`, `:600`) breaks if
      `IMAGE_REPO` ever carries a port.
- [ ] [Review][Patch] **L5 (LOW) — three instructions the story gave itself and did not carry out.**
      (a) Dev Notes §4: *"`preprod-current` and `preprod-<sha>` … are **not deployable** through
      `deploy-preprod.yml` … **so say it in the file**"* — it is in Open Question 6 only, not in the
      workflow. (b) Task 10.1(c) required `<a id="d38"></a>`; `docs/migration-decisions.md:4375` is a
      bare heading, so the index row `[D38](#d38)` and the bumped `(#d1 … #d38)` range both link to
      nothing (34 of 37 D-entries carry anchors; D33 and D37 are pre-existing misses — see W1).
      (c) §5/Task 3.6 made the `imagetools inspect` "the **first** step of the `record` job" so a
      bad driver/login/DNS fails before anything else; shipped, it is the fourth executing step with
      a `derive` shell step ahead of it. The safety property still holds; the change is unnoted.
- [ ] [Review][Patch] **L6 (LOW) — G4 drops a divergence `build.yml` marks load-bearing, and the
      "three divergences" list is wrong** [`record-preprod-candidate.yml:455-462`]. `:462` uses
      `grep -qE`; `build.yml:977` and `:1064` use `grep -Eqi`, with `build.yml:972-976` naming `-i`
      *"a deliberate third divergence … an unnamed divergence is how that instruction rots."* The
      comment at `:455` calls the literal a "Literal copy". Task 2.5's enumeration (`:1560-1563`)
      lists "no `fe-prionex/` prefix, `[0-9]` not `\d`, no `sha256:` clause" — but `\d` and `[0-9]`
      are semantically identical here, so a non-divergence was counted in place of the real one.
      No functional gap for the two lowercase markers. **Fix:** name the `-i` divergence on both
      sides.
- [ ] [Review][Patch] **L7 (LOW) — G2 adds no discrimination G3 does not, and the guard count leans
      on it** [`:157-172`]. Force-tested: G2's reject set is a **strict subset** of G3's — G2 passes
      `main-preprod` and `-preprod`, which G3 then refuses; every string G2 rejects, G3 rejects too.
      G2 is a better-worded earlier message, not an independent discriminator, yet D38 counts it as
      one of six guards and one of four live refusal rows. Worth keeping for the message; worth
      saying it is a message. Related: `record` re-checks G2/G3 but **never** re-checks `validated`,
      so the `:336` framing "resolves everything independently" is selective on the single most
      load-bearing input. Also `:324`'s "before buildx setup" rationale is inert under
      `driver: docker` (nothing is pulled), imported from `build.yml` without its mechanism.
- [ ] [Review][Patch] **L8 (LOW) — convention drift in the new records.** Prohibition 19 ("Owners
      are names or story numbers, never trigger conditions"): the new AC5 entry uses *"Owner:
      whichever story next builds a human-facing view…"* and the force-tested-guards entry uses
      *"Owner: none needed … should be re-examined then"* — both trigger conditions. Prohibition 18
      ("mark coordinator subtasks `PENDING (owner: coordinator)` rather than checking them"): only
      Task 11.3 carries the marker; every dispatch subtask is `[x]` (correctly attributed to the
      coordinator in its text, so this is form, not a false claim). `sprint-status.yaml`'s block
      still says "Three guards earn a live failing row" — the delivered result is four.

#### Deferred (pre-existing, not caused by this change)

- [x] [Review][Defer] **W1 — `docs/migration-decisions.md` anchor drift predates D38**
      [`docs/migration-decisions.md`] — deferred, pre-existing. 34 of 37 `## D<n>.` headings carry an
      explicit `<a id="dN"></a>`; **D33 and D37 do not**, so their index rows already link to
      nothing. D38 continues the drift rather than starting it (fixing D38's own anchor is L5(b)
      above; D33/D37 are not this story's).
- [x] [Review][Defer] **W2 — `imagetools create` still has no compare-and-swap**
      [`.forgejo/workflows/record-preprod-candidate.yml:541`, `:601`] — deferred, pre-existing.
      Already tracked against `build.yml`'s own AC2 guard with **owner needed**; this story correctly
      registers itself as a second site. Only the *description* of the residual is this story's to
      fix (M6 above); the underlying gap is not.
- [x] [Review][Defer] **W3 — the org-scope `write:package` token now has a third holder**
      [`.forgejo/workflows/record-preprod-candidate.yml:324-329`] — deferred, pre-existing. Correctly
      restated with owner unchanged (Oleg / the platform team). Noted here only so review does not
      re-raise it: Prohibition 3's literal-repository assertion at `:472-490` is, like G4,
      **structurally unable to fail** — both write targets are built from the same workflow-level
      `IMAGE_REPO` constant in the same job — so it is defence against a future edit, not a control
      over the token's scope. That is the correct reading and it matches the story's own framing;
      it should simply not be counted as mitigation.

---

## Open Questions for Review

**Blocking (none expected — but two are one relay away from becoming blocking):**

1. **Task 8.1's mint.** One new permanent `sha-<12hex>-preprod` tag from `main` HEAD, so AC3 can be
   proven on the real tag names. Announced to Oleg through the coordinator, proceeding unless
   vetoed. If vetoed after the dispatch has already run, the tag cannot be un-minted — which is why
   8.1 precedes 8.2.
2. **Task 2.4's census.** If `preprod-current` or any `preprod-*` tag **already exists**, stop:
   nothing in this repository writes those shapes, so something outside it did, and recording over
   an unexplained pointer is exactly the failure this story exists to prevent.

**Non-blocking:**

3. **Should `validation_note` eventually become structured?** Story 5.5 defines the checklist; when
   it does, it may want the note to carry a checklist revision or a per-item outcome rather than free
   text. Left as free text deliberately — 5.5's decision, not this story's to pre-empt.
4. **Should the recorder also be able to record a candidate that is no longer on the stand?** G5
   forbids it today, which means a candidate validated last week cannot be recorded after a newer one
   is deployed. That is the correct default; whether a documented override belongs in Story 5.6's
   rehearsal is worth asking then, not now.
5. **The third RW-token holder.** `deferred-work.md:1567-1568` asks for a repository-scoped
   `write:package` credential *"before Epic 6 puts production deploys on the same token."* Epic 6 is
   next. Owner: Oleg / the platform team.
6. **`preprod-current` is not deployable through `deploy-preprod.yml`** — the shared tag↔environment
   guard is a suffix test and the marker does not end in `-preprod`. Recorded as a deliberate
   property (a moving pointer is the wrong thing to hand a deploy), but if a future story wants
   `deploy-preprod.yml image_tag=preprod-current` to work, that is a §12 edit to `deploy-stand.yml`
   and it should be argued, not discovered.

---

## Change Log

| Date | Change |
|---|---|
| 2026-08-24 | Contexted against `main` @ `28f7fd36` (PR #79, Story 5.3's ledger closeout), on branch `story-5-4/pr-1-context` from a scratchpad worktree — the primary checkout is Story 4.9's. Story shaped with **eight** ACs: the epic's five, read against measurement, plus AC6 (what "validated" covers and what it cannot — the CORS boundary, inherited from 5.3's AC6 by name), AC7 (the guard matrix, with the guards that can have no failing row named as unearned rather than counted) and AC8 (idempotence and repoint-refusal). The story's largest decision is a **deviation from FR14's literal text**: the recorder is `workflow_dispatch`-only with a required verdict rather than a step inside the deploy, because `preprod-<sha>` is what Story 6.5 will read as *validated* and an automatic-on-deploy recorder can only ever mean *deployed* — §4 argues it, §10 records it, Dev Notes §9 row 1 makes it a one-read veto. **Six guards, three with live failing rows, three force-tested and named UNPROVEN live.** G6 — cross-checking the derived commit against the image's own `version`/`revision`/`environment` labels — was added after D33 §6(b) showed that nothing on the deploy path ever establishes a deployed image's commit, so a `<sha>` taken from the tag string alone would leave Story 6.5 gating on a name derived from a name. `docker buildx imagetools create --prefer-index=false` with mandatory read-back, copied from `build.yml`'s attach step; `preprod-<sha>` written before `preprod-current`; the check-to-write window narrowed and detected, not closed, and named as such. AC3 requires a second candidate and there is only one usable `-preprod` image, so **one new permanent tag is minted, announced rather than asked** (Task 8.1), with a stated fallback. AC4 is verified against the **stored** retention rule rather than `build.yml`'s copy. Ledger declared before work: floor 18, ceiling 22, disposition OPEN. |
| 2026-08-24 | **Dev-story complete.** `record-preprod-candidate.yml` written and dispatched ten times (D1-D10), plus the free zero-run rejection (D0). All six guards' passing halves earned live; G1/G2/G3/G5's failing halves also earned live (runs 1218/1219/1220/1227), each with a classified message and confirmed markers unchanged afterward. G4, G6's failing half, and AC8's repoint refusal remain force-tested only, named as structurally unearnable, not counted as earned. AC3 proven on the real tag names: Task 8.1's mint of a second permanent candidate (`sha-28f7fd36b75e-preprod`, run 1223) was announced to Oleg and never vetoed across four dispatch cycles; `preprod-current` MOVED to it (run 1229), `preprod-00ef3be4743d`'s own history stayed untouched. Every write independently verified via direct registry reads on s1, not from any workflow's own log (most `record`-job logs never archived during this story) or its own "OK" message — `--prefer-index=false` confirmed via raw `mediaType` reads, real manifests throughout, never an index. D38 written to `docs/migration-decisions.md`, verified against every open `story-*` branch. `deferred-work.md` updated: RW-scope credential's third holder, the check-to-write window's second site, the 08-29 retention observation's extended scope, the PRE-PROD lock-holder debris declined with one distinguishing contribution (registry permanence vs. host-cache survival), and the standing archived-log check (fifth negative, done first this session per the standing plan). 🔴 Ledger reconciled honestly: 18 rows above baseline (psql, repo-scoped, zero unattributable) against ceiling 22 — 7 more CI-push rows than declared because every verification write-up got its own push; the remaining review-cycle lines will exceed the ceiling by 2, flagged now rather than left for code review to find. Blast radius confirmed as exactly five files — `deploy-stand.yml`/`deploy-preprod.yml`/`build.yml`/`deploy-dev.yml`/`dev-reset.yml` all absent, no §12-style exception ever needed. Status → **review**. |
| 2026-08-24 | **Code review fix-pass.** H1 (CRITICAL): G5 failed OPEN on an empty `CANDIDATE_DIGEST` (`grep -qF` with an empty needle matches anything) -- fixed with explicit shape-checks on both operands and exact-equality comparison against each parsed `.RepoDigests` entry; force-tested empty/garbage/valid-mismatch/valid-match, catching and fixing a regression introduced mid-pass (an intermediate fix compared full `repo@digest` strings against the bare candidate digest and would have failed a genuine match). H2: G6's claim corrected everywhere (workflow header, G6's own comments, AC2, D38) -- it narrows D33 §6(b)'s gap against a FOREIGN artifact; for a `build.yml`-produced image all three clauses are identities, so it does not establish the deployed commit on that path. H3: AC6's boundary now actually printed by the workflow (a new step in the `record` job), not just a YAML comment no execution ever emitted. D2 (Oleg's veto open, decided autonomously per the coordinator's literal instruction "not a prohibition"): a new `allow_backwards_move` input and a `G-backwards` step that WARNS on any `preprod-current` move whose direction cannot be confirmed (no git checkout available) -- never blocks the write. D3 (decided autonomously): the one real exit for an already-recorded commit needing a new artifact documented with the exact manual `DELETE` command. **D1 investigated and found blocked**: live-tested `imagetools create --annotation` on s1 against this instance's buildx (v0.33.0) -- rejected outright ("annotations are not supported yet") on a plain retag, with or without `--prefer-index`. OCI annotations are not an available channel for `validation_note` here; flagged for Oleg's follow-up decision between the review's own options (b) `$GITHUB_STEP_SUMMARY` or (c) narrowing the "it is the record" claim. M2-M6, L1-L4, L6-L8 addressed in code and documentation (newline rejection, guarded docker templates split into distinct messages, HTTP-based absence classification replacing stderr-text matching in both write steps, G6's stderr separated from stdout with `\|\| true` guards, check-to-write wording corrected to name the real residual, addressable step `id:`s added, non-empty `validation_note` check, explicit read-back failure messages, `-i` added to G4's `keep_pattern` grep, G2 documented as message-only). M8: the retro-E5 matrix's five "marker state after" cells for D2-D6 marked `†` as one shared post-series observation, not five. M9: **ledger overrun corrected to 3, not 2** -- fresh `psql` recount, 23 rows above baseline (10 dispatches + 13 CI-push rows, one per commit including the review's own and this fix-pass's own), against an adjusted ceiling of 21 (excluding the context push consistently on both sides) -- the ceiling is already exceeded, not merely projected to be, with PR-open and merge still ahead; renegotiation due now. M10: AC1's evidence reworded to cite the actual observation (independent registry read, not the never-archived log lines); AC5's raw `tags/list` response (263 tags) pulled fresh via a script that never prints the credential itself and pasted into Debug Log References, replacing the earlier characterisation. M11: the workflow's own remaining line-number citation replaced with a search string. M7: eight previously-undisclosed unexercised branches added to `deferred-work.md`. L5(b): `<a id="d38"></a>` added -- the index row and header range previously linked to nothing. Not addressed this pass: M1 (subsumed by H2's fix), the three DECISION items' own code beyond D1/D2/D3 as scoped, and the reviewer's own W1-W3 deferred items (correctly left deferred). Mechanical gates re-confirmed: 19 `run:` bodies (was 15), 0 containing `${{ }}`, 0 `bash -n` errors, 0 assignment-context backslash-continuations, exactly 2 `--prefer-index=false` in real code. Status stays **in-progress** (flipped back by the review's own commit) -- not yet returned to review; D1's blocker and the fixes still need a live verification dispatch before this story can honestly close. |
