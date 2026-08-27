---
baseline_commit: b6078c1fe4f248b4a28fbb2d9b1af1ee288e20e6
---

# Story 6.11: Record the PRE-PROD candidate automatically

Status: review

## Story

As the release pipeline,
I want a PRE-PROD candidate recorded as a **consequence of a successful PRE-PROD deploy** rather than by a second human dispatch carrying a verdict,
so that recording a candidate costs one act instead of two — at the price, accepted and written down, that `preprod-<sha>` now means **"this commit reached PRE-PROD"** and no longer means **"this commit was validated"**.

---

## 🔴 Read this before anything else

This story exists to **withdraw a decision this project took deliberately and defended at length**.
`#d38` §2 argued, in the file you are about to edit, that a dispatch-with-verdict recorder is the
only shape in which `preprod-<sha>` can carry the meaning FR16 reads out of it. **That argument was
not refuted. It was accepted, and its price was paid** — Oleg's decision, 2026-08-27, recorded as
[`#d51`](../../docs/migration-decisions.md#d51).

So: **do not re-argue it, and do not soften the price.** Your job is to make the withdrawal complete
and honest — including deleting a guard, and including correcting several sentences in shipped files
that stop being true the moment you land this.

**The single worst outcome of this story is a file that still says "validated".** There are at least
nine such places (AC9). A marker that silently means something weaker than the words next to it is
exactly the failure `#d2`'s residual-risk section exists to prevent.

---

## Acceptance Criteria

### AC1 — One act, not two: a successful PRE-PROD deploy records its own candidate

**Given** a `deploy-preprod.yml` dispatch with a valid `image_tag` that deploys successfully,
**When** the run finishes,
**Then** `preprod-<12hex>` is attached to the deployed digest and `preprod-current` names it, **with no second dispatch of any kind**,
**And** both markers are verified **by reading the registry directly** — not from the run's job log, and not from `$GITHUB_STEP_SUMMARY`.

> ⚠️ **The read-back requirement is not ceremony.** This instance's logs have failed to archive
> repeatedly (six `log_in_storage=f` observations across Stories 5.3/5.4), and Story 5.4's own
> verification had to read markers from the registry because *"most of the `record` job's logs had
> not archived yet by verification time"*. Plan to verify the same way — **do not let an unreadable
> log become the evidence.**

### AC2 — The verdict is gone, and G1 with it

**Given** `record-preprod-candidate.yml` after this story,
**Then** the `validated` input does not exist on **either** path, and the `G1 -- verdict must be exactly 'pass'` step is removed,
**And** `#d38` §6's matrix still carries the **struck** G1 row naming run 1215 (pass) and run 1218 (refusal) — 🔴 **marked, never deleted**: removing it would erase the evidence that the guard was ever real, which is the opposite of what `retro-E5` asks for.

> That row was already struck by `#d51`. **This AC verifies it survived your edit**, it does not ask
> you to write it again.

### AC3 — G1′ replaces it on the dispatch path only, and earns a live refusal

**Given** the dispatch path now has no guard at all where G1 stood,
**Then** an `acknowledgement` input is added to `workflow_dispatch` **only**, and a first-step guard refuses any value other than the exact literal `RECORD-PREPROD-CANDIDATE`, before any credential loads,
**And** the guard is gated `if: ${{ github.event_name == 'workflow_dispatch' }}` so it is inert on the call path,
**And** a live **refusal** row is earned (a dispatch with a wrong acknowledgement, refused on the first step with zero network calls) and a live **pass** row.

> **This is a coordinator decision, announced rather than asked, and Oleg's veto is open** — the same
> convention `#d38` §7 used. **It is NOT the old G1 and must not be described as one.** G1 asked
> *"did a human say this passed?"*. G1′ asks *"is this a deliberate dispatch rather than a stray
> one?"* — exactly the question `record-prod-image.yml`'s `acknowledgement` already asks, and for
> exactly the reason its header gives: *"a caller that always passes the literal proves nothing — it
> turns a guard into a constant"*, so it lives on the dispatch path only.
>
> **If vetoed:** the dispatch path ships with no guard in that slot, and `retro-E5`'s discriminating
> row for it is genuinely unavailable. Say so in the file rather than leaving the gap silent.

### AC4 — The dispatch path still works, for backfill

**Given** a candidate that was deployed before this story shipped, or a deploy whose automatic record failed,
**When** `record-preprod-candidate.yml` is dispatched by hand,
**Then** it records the candidate exactly as before, minus the verdict,
**And** the workflow's own description says what the dispatch path is *for* now — backfill and repair, not the normal path.

### AC5 — 🔴 The `workflow_call` input is named `candidate_tag`, and the `with:` mapping is PROVEN

**Given** `#d47`(3): **a caller's dispatch input shadows a callee input of the same name**, measured live on runs 637/640,
**And** `deploy-preprod.yml`'s dispatch input is already named `image_tag` and **cannot be renamed** (it is written into every recorded PRE-PROD procedure and into `deploy-stand.yml`'s own `with:` block),
**Then** the callee's `workflow_call` input is named **`candidate_tag`**, so no shadow is possible by construction,
**And** the run prints the resolved value and it is demonstrably the one passed through `with:`.

> 🔴 **Why not just keep `image_tag` on both paths, the way `record-prod-image.yml` does?** Because
> that file's *caller* solved the collision from the other end — `deploy-prod.yml` deliberately names
> its own dispatch input **`tag`, not `image_tag`**, and its input description says so in capitals.
> That option is closed here: our caller's name is fixed. Keeping `image_tag` on both paths would
> leave the `with:` mapping **unprovable** — the two values coincide by construction, so no
> observation could ever distinguish "the mapping works" from "the shadow supplied it". `#d47` says
> that is exactly why the defect was *"invisible in both shipped callers"*. Do not ship a third one.
>
> **Body resolution, once per job, into an env var** — never scatter the fallback across steps:
> ```yaml
>     env:
>       CANDIDATE_TAG: ${{ inputs.candidate_tag || inputs.image_tag }}
> ```
> and read `${CANDIDATE_TAG}` everywhere below.

### AC6 — 🔴 The record does NOT fire on a dispatch that deployed nothing

**Given** `deploy-stand.yml:500` gates `preflight` (and the `deploy` chain behind it) on `if: ${{ !(inputs.hold_lock_seconds > 0) }}`,
**And** `#d21`, measured on run 631: **a skipped `uses:` wrapper job reports `success`**,
**Then** a `deploy-preprod.yml` dispatch with `hold_lock_seconds > 0` deploys nothing while its own `deploy` job reports `success` — so `if: needs.deploy.result == 'success'` **alone is not a sufficient gate**,
**And** the `record` job's condition additionally excludes that path,
**And** a live discriminating row is earned: a `hold_lock_seconds > 0` dispatch in which the `record` job is **skipped**.

> 🔴 **This is the defect this story is most likely to ship if it is written from the happy path.**
> The failure is quiet and confidently wrong: the stand is serving whatever it was already serving,
> G5 finds that digest present, the record fires, and `preprod-current` is moved by a run that
> deployed nothing. Nothing goes red.
>
> ⚠️ **`simulate_bad_credential` is NOT the same case and needs no extra clause** — it makes the
> deploy genuinely **fail**, so `needs.deploy.result == 'success'` already excludes it. Do not add a
> clause for it; an unnecessary condition is a claim that something was checked.

### AC7 — G5 is kept, and is described as what it now is

**Given** the record now runs immediately after the deploy, on the same stand, in the same run,
**Then** G5 (*the stand must be healthy and demonstrably serving this exact digest*) is **kept** — it is nearly free and it still catches a concurrent overwrite between the deploy and the read,
**And** the file no longer describes it as independent evidence: on the call path it is **trivially true**, because the deploy that just succeeded is what put that digest there.

> `#d51` §6 and `#d38` §2's amendment both already say this. The file must not contradict them.

### AC8 — A green deploy whose record did not land is disclosed

**Given** `deploy-preprod.yml`'s `deploy` succeeded and its `record` did not,
**Then** a `record-outcome` job fires, states what is true right now, names the exact repair dispatch, and reds the run,
**And** it reads the callee's `workflow_call` **outputs** — not a log line — to say which of the two markers landed.

> This is a direct twin of `deploy-prod.yml`'s own `record-outcome` job (Story 6.6). **Copy its
> shape, including the write-order sentence** — history FIRST, pointer second, so a partial state is
> readable: *"if the history tag is written and the pointer is not, the pointer is STALE and the
> history is correct"*. `record-preprod-candidate.yml` §6 already uses that same order for the same
> reason.
>
> ⚠️ The callee must therefore **declare `workflow_call.outputs`**, mapped from `jobs.record.outputs`.
> A callee that declares no `outputs:` block hands the caller nothing — this is the plumbing area
> `#d48` records as *"having surprised this project"* (D8, D21), and Story 6.6 shipped an AC that
> required an output the prescribed block could not produce. Do not repeat it: declare
> `jobs.record.outputs` **and** `on.workflow_call.outputs`, both.

### AC9 — Every sentence that stops being true is corrected

**Then** none of the following still claims a verdict, a validation, or a broken CORS:

| # | File | What is stale |
|---|---|---|
| 1 | `record-preprod-candidate.yml:1` | `name: Record a validated PRE-PROD candidate` |
| 2 | `record-preprod-candidate.yml` header | the whole `── workflow_dispatch-only, with a required verdict — deliberately NOT a step in a deploy ──` block, including its *"If vetoed: this becomes a third job in `deploy-preprod.yml`"* clause — **which is now what happened** |
| 3 | `record-preprod-candidate.yml` header | `── What "validated" covers ──`: *"a human asserted a verdict"* |
| 4 | `record-preprod-candidate.yml` header | same block: *"PRE-PROD's Kong answers a static, wrong `Access-Control-Allow-Origin` … unfixed"* — 🔴 **measured FIXED**, twice: `docs/preprod-candidates.md` recorded it 2026-08-25, and it was re-measured 2026-08-27 with `GET` |
| 5 | `record-preprod-candidate.yml` "Print AC6's boundary" step | *"a human asserted a verdict and named what they checked"* and *"PRE-PROD's Kong CORS is known-broken"* — this one is **printed on every run**, so it is the most visible falsehood in the set |
| 6 | `deploy-prod.yml:386` | `name: "Promotion guard -- refuse a commit PRE-PROD never validated"` |
| 7 | `deploy-prod.yml:446` | `Commit ${HEX} was never recorded as validated on PRE-PROD` |
| 8 | `deploy-prod.yml:473` | `unvalidated commit into production.` |
| 9 | `deploy-prod.yml:488` | `**What this proves:** a PRE-PROD validation marker exists for this commit.` |

**And** #9's replacement makes the **stronger** statement, not a hedge. The success message already
carries the weaker one — *"Not that the validation was clean. A waiver leaves NO signal at the
registry"* (`:495`). After this story the truth is harsher: **there is no validation signal at all.**
The message's structure already has the slot.

> 🔴 **`deploy-prod.yml`'s `derive` job must stay BYTE-IDENTICAL.** It is Story 6.5's seam and `#d48`
> §12 froze it. Your four edits are at `:386/:446/:473/:488`, all inside `guard`. **Extract `derive`
> before and after and compare** — Story 6.6 did exactly this check three times and it is cheap.

### AC10 — `docs/preprod-candidates.md` stops describing a procedure that no longer happens

**Given** that file states the recording procedure as *"dispatch `record-preprod-candidate.yml` with `validated=pass`, confirm it went green, then append the row it prints — «record a candidate» is the two steps together, not the dispatch alone"*,
**And** that after this story **nobody dispatches anything** on the normal path,
**Then** the file says what is true now: the marker is minted automatically, the human ledger line is appended **after the fact**, and the `Verdict` column no longer derives from a workflow input,
**And** the file states plainly that **no workflow writes it** — that is unchanged and is not opened here.

> ⚠️ **Scope fence.** Generating this ledger by query is **Story 6.12's** shape, and 6.12 is scoped to
> `docs/prod-releases.md`. **Do not build a generator here.** This AC is prose only: a file whose
> stated procedure silently stops happening is worse than one that admits the gap. If you conclude
> the PRE-PROD ledger needs the same treatment, **file it in `deferred-work.md`**, do not build it.

### AC11 — 🔴 The 14th defect is LATENT here, and this story is the named trigger

**Given** `#d48` recorded a fourteenth defect in `record-prod-image.yml` that no review had found: `EXISTS` produced as a tri-state, consumed as `[ "$EXISTS" = "true" ]`, so **any** non-`true` value fell through to the write while the log printed *"for the first time"*,
**And** that the trigger list it names includes, verbatim, *"a dropped `$GITHUB_OUTPUT` write, a step rename, **a `workflow_call` refactor of exactly the kind this story performs**"*,
**Then** both `EXISTS` consumptions in `record-preprod-candidate.yml` (`:729` for `preprod-<sha>`, `:865` for `preprod-current`) require a literal `true` or `false` and **fail on anything else**, including empty,
**And** the failure message says that an empty value means a **broken probe**, not an absent tag — because absence here unlocks a permanent registry write.

> ⚠️ **Measure before you assume, and this measurement is already done — the finding is narrower than
> `#d48` might lead you to expect.** The PRE-PROD probes are **not** the tri-state defect:
> `:709-716` and `:795-802` classify strictly — `200` → `true`, `404` → `false`, **anything else is a
> hard `exit 1`**. They fail **closed**. A 401, a 500, a timeout — all refuse.
>
> 🔴 **The one path that survives that** is the probe step succeeding while its `$GITHUB_OUTPUT`
> write does not reach the consumer. Then `EXISTS` is **empty**, `[ "$EXISTS" = "true" ]` is false,
> and both writes take their "did not exist / creating" branch: `preprod-<sha>` attaches with no
> `PRE_DIGEST` protection, and `preprod-current` takes the *create* path instead of the *move* path,
> skipping G-backwards' meaningful branch and the MOVE disclosure.
>
> **Today that path is not reachable in any way this project has observed. This story's own
> `workflow_call` refactor is exactly what `#d48` warns arms it.** Fix it while you are in the file;
> it is four lines and it is the cheapest item in this story.

> ⚠️ **And a correction to what you may read elsewhere.** Story 6.6's review carried a finding
> claiming the sibling's existence probes *"have neither the empty-credential pre-check nor 401
> classification"*. Read against the code, that is **not a defect here**: an empty credential yields
> a `401`, and `401` lands in the `*)` arm, which is a hard failure. The probes name the code rather
> than the class, which is a **message-quality** point, not a fail-open. **Do not "fix" a
> fail-closed guard into something more complicated.** `#d48` already recorded that three of that
> review's thirteen findings pointed at a sibling pattern that does not exist.


---

## Tasks / Subtasks

- [x] **Task 1 — Read before writing (AC: all)**
  - [x] 1.1 Read `record-preprod-candidate.yml` **completely** (983 lines). Its header is ~190 lines of authoring documentation and is load-bearing: several sections are the *only* record of why a guard is shaped as it is.
  - [x] 1.2 Read `deploy-preprod.yml` completely (293 lines), especially the `e2e` job's header — it states three invariants for a job appended after `deploy`, and **two of them apply to `record` as well**: never fail a run for a non-reason, and never hold the PRE-PROD concurrency group waiting on a contended runner.
  - [x] 1.3 Read `record-prod-image.yml`'s `on:` block and `deploy-prod.yml`'s `record`/`record-outcome` jobs. **This is the model.** Do not invent a second shape.
  - [x] 1.4 Read [`#d51`](../../docs/migration-decisions.md#d51) §§2, 5, 6 and [`#d38`](../../docs/migration-decisions.md#d38) §2 (with its withdrawal note) and §6.

- [x] **Task 2 — `record-preprod-candidate.yml`: the call path (AC: 2, 3, 4, 5, 8)**
  - [x] 2.1 Delete the `validated` input and the G1 step.
  - [x] 2.2 Add `acknowledgement` to `workflow_dispatch` and the G1′ guard, gated on `github.event_name == 'workflow_dispatch'`. 🔴 The gating expression is the one `#d21` measured on run 631: inside an expanded callee `github.event_name` is `workflow_call`, so the guard is inert there — **cite the run number in the comment**, because a reviewer has already raised the opposite objection once (`6-6-…md`, patch item on §5) and the rebuttal must live in the file.
  - [x] 2.3 Add the `workflow_call` block: input `candidate_tag` (required), `allow_backwards_move` defaulting **true** on this path (a deploy just happened; the move is intentional by construction) and false on dispatch.
  - [x] 2.4 Make `validation_note` **optional** on dispatch, and on the call path generate it automatically as a line naming the run — so the ledger line the last step prints is still complete.
  - [x] 2.5 Declare `jobs.record.outputs` **and** `on.workflow_call.outputs` for the two write outcomes (history and current), mirroring `record-prod-image.yml`'s four-output block.
  - [x] 2.6 Resolve `CANDIDATE_TAG` once per job into an env var (AC5) and replace every `${{ inputs.image_tag }}` read in the body.

- [x] **Task 3 — `deploy-preprod.yml`: the `record` and `record-outcome` jobs (AC: 1, 6, 8)**
  - [x] 3.1 Add `record`, `needs: deploy`, `uses: ./.forgejo/workflows/record-preprod-candidate.yml`, `with: candidate_tag: ${{ inputs.image_tag }}`, `secrets: inherit`.
  - [x] 3.2 🔴 The condition must exclude the hold-lock path (AC6), not merely check `success`. Write the reason in a comment naming `deploy-stand.yml`'s own `if:` and `#d21` run 631.
  - [x] 3.3 Add `record-outcome`, modelled on `deploy-prod.yml`'s, reading the callee's outputs.
  - [x] 3.4 ⚠️ **`runs-on` for `record-outcome`:** read `deploy-preprod.yml`'s `e2e` header before choosing. It rejects `node-20` for a specific reason (a job queued behind the shared CI runner holds this workflow's PRE-PROD concurrency group at `cancel-in-progress: false`, blocking the next dispatch including a hotfix) and then **corrects its own argument** for `deploy-dev-preprod` too. Make the same trade knowingly and say which you made.

- [x] **Task 4 — The nine stale sentences (AC: 9)**
  - [x] 4.1 Items 1–5 in `record-preprod-candidate.yml`, including the printed AC6 boundary.
  - [x] 4.2 Items 6–9 in `deploy-prod.yml`.
  - [x] 4.3 Extract `deploy-prod.yml`'s `derive` job before and after; assert byte-identical.

- [x] **Task 5 — `docs/preprod-candidates.md` (AC: 10)** — prose only. No generator.

- [x] **Task 5b — Harden both `EXISTS` consumptions (AC: 11)**
  - [x] 5b.1 `record-preprod-candidate.yml:729` and `:865`: require a literal `true`/`false`, fail on anything else including empty, with a message that names a BROKEN PROBE rather than an absent tag.
  - [x] 5b.2 Do **not** touch the probe classification steps themselves (`:709-716`, `:795-802`) — they already fail closed. Changing them is scope creep against a guard that works.

- [x] **Task 6 — Earn the rows (AC: 1, 3, 6)**
  - [x] 6.1 `bash -n` every changed shell body **before** any dispatch. 🔴 Literal backticks inside a double-quoted `echo` are command substitution — this project has been bitten; use `BT="$(printf '\140')"`.
  - [x] 6.2 Live: one normal `deploy-preprod.yml` dispatch → record fires, both markers read back **from the registry** (AC1).
  - [x] 6.3 Live: one `hold_lock_seconds > 0` dispatch → `record` **skipped** (AC6).
  - [x] 6.4 Live: one hand dispatch with a wrong `acknowledgement` → refused on the first step (AC3), and one correct (AC3, AC4).
  - [x] 6.5 After every refusal, **re-read both markers from the registry** and assert unchanged — the discipline `#d38` §6 used across its whole series.

- [x] **Task 7 — Record it (AC: all)**
  - [x] 7.1 Amend `#d38` §2's withdrawal note and §6's struck G1 row **only if your implementation diverged** from what `#d51` already recorded. If it matches, change nothing and say so.
  - [x] 7.2 Write the story's own outcome matrix: every guard, its live pass row, its live refusal row, or an explicit "force-test only" / "unearned" label. `retro-E5`. **No guard ships with an empty row and no label.**
  - [x] 7.3 `deferred-work.md` for anything you found and did not fix.

---

## Dev Notes

### 1. What each touched file is today, and what must survive

**`.forgejo/workflows/record-preprod-candidate.yml` (983 lines) — UPDATE, the main subject.**
Two jobs. `verify-on-stand` (`deploy-dev-preprod`, read-only, no lock, no compose) holds G1, G2, G3,
the digest resolve, G5, and the note echo. `record` (`node-20`, `needs: verify-on-stand`, holds
`REGISTRY_TOKEN_RW`) holds the AC6 print, an independent re-derivation, an independent re-resolve,
G6, G4, the repository assertion, and the two write steps each with a read-back.

**Preserve, all of it:**
- **The two jobs deliberately do not pass the digest to each other.** Each resolves independently
  from the same immutable tag. The header explains why (workflow_call/output plumbing has surprised
  this project four times) and also **discloses the residual** — the two digests are never actually
  cross-checked, only argued to agree. Do not "improve" this into a shared output.
- **Write order: `preprod-<sha>` FIRST, then `preprod-current`.** The reverse leaves the pointer
  naming a candidate with no history entry — the exact state Story 6.5 would misread.
- **`--prefer-index=false`** on both writes, for the two independent reasons the header gives (digest
  equality, and the second sweeper `cleanup_sha256`).
- **`concurrency: deploy-preprod-fe-prionex-preprod`** — the same literal group `deploy-preprod.yml`
  uses, deliberately. ⚠️ **But see §3 below: this block does not apply on the call path at all.**
- **G-backwards WARNS and never blocks.** `allow_backwards_move` changes the message, not the exit
  code. That is Oleg's own instruction, verbatim: *"not a prohibition — rollback is legitimate, but
  must be intentional"*.

**`.forgejo/workflows/deploy-preprod.yml` (293 lines) — UPDATE.**
`deploy` (a `uses:` wrapper over `deploy-stand.yml`) and `e2e` (a placeholder that asserts nothing).
Its `on.workflow_dispatch` has four inputs; `image_tag` is required and is the only one that matters
here. **Do not rename it** (AC5).

**`.forgejo/workflows/deploy-prod.yml` (836 lines) — UPDATE, four wordings only.**
🔴 `derive` is **frozen** (`#d48` §12) — Story 6.5's rebase seam. All four edits are inside `guard`.

**`docs/preprod-candidates.md` (126 lines) — UPDATE, prose only.**

### 2. 🔴 The hold-lock hazard, spelled out because it is the one that ships silently

```
deploy-stand.yml:261   hold-lock:  if: ${{ inputs.hold_lock_seconds > 0 }}
deploy-stand.yml:500   preflight:  if: ${{ !(inputs.hold_lock_seconds > 0) }}   ← and `deploy` behind it
```

A `hold_lock_seconds > 0` dispatch therefore runs the holder fixture and **skips the deploy chain
entirely**. `#d21`, run 631: **a skipped `uses:` wrapper job reports `success`.** Story 6.6 saw the
same thing live in run 662.

So the naive gate `if: needs.deploy.result == 'success'` fires the record on a run that deployed
nothing. And it does not go red, because:

1. the stand is still serving whatever it served before,
2. if the dispatched `image_tag` happens to be that same artifact, **G5 passes**,
3. `preprod-current` is then moved by a run that deployed nothing.

**The gate must exclude the hold-lock path explicitly.** AC6 requires a live row proving it does.

### 3. ⚠️ The callee's own `concurrency:` block is NOT applied on the call path

`#d21`, verbatim: *«собственный `concurrency` вызываемого воркфлоу при вызове не применяется —
молча… Сериализацию придётся объявлять у вызывающего»*. `#d33` closed D21's central question
positively only for the **caller's** block.

Here that lands **better than it did for PROD**, and the difference is worth understanding rather
than copying the PROD conclusion:

- `record-prod-image.yml`'s own group is `record-prod-fe-prionex-prod` while the caller's is
  `deploy-prod-fe-prionex-prod` — **disjoint**, which is why `#d48` records an open window between a
  manual and an automatic record over two permanent writes with no compare-and-swap.
- `record-preprod-candidate.yml`'s own group is **already `deploy-preprod-fe-prionex-preprod` — the
  caller's group.** So on the call path the record runs under the same literal group it would have
  chosen anyway, and a manual dispatch is serialized against an automatic one.

🔴 **Verify this rather than assuming it**, and say which you did. If it holds, it is a genuine
improvement over the PROD side and belongs in the story's outcome notes. **Do not claim it because
this paragraph is encouraging.**

### 4. The check-to-write window is real, is not closed here, and must not be re-described as closed

The header's own corrected wording: `imagetools create` offers no compare-and-swap; the read-back
after each write compares against **this run's own value**, so it can only ever catch a *different*
digest landing first — it cannot distinguish "our write landed" from "another actor wrote the
identical digest". The genuinely open case is a writer **outside the group entirely** (a hand-run
`imagetools create`, or an operator `DELETE` plus rebuild), which no `concurrency:` block can
serialize against.

⚠️ An earlier draft of that header claimed two mutually exclusive things at once and was corrected in
code review. **Do not reintroduce the stronger claim.**

### 5. What `preprod-<sha>` proves after this story — the sentence to write

> This commit was **built for PRE-PROD and deployed there through the pipeline**, and the stand was
> serving exactly this digest and reporting healthy at record time.

And what it does **not** prove — all of which must survive somewhere visible:

- **That anyone validated it.** No workflow reads a verdict any more (`#d41`).
- That a rebuild of the same commit reproduces this artifact (`vite.config.ts` bakes `Date.now()`).
- That `healthy` says anything about the backend (the healthcheck probes only itself — Story 5.1).
- That any checklist was followed. `RVC-v1.1` still exists and is still the rule; it simply has **no
  machine consumer left**, so `docs/preprod-candidates.md` and the approval regulation carry it alone.

🔴 **What must be DELETED from that list: "a BROWSER cannot call the API — CORS is broken."** It was
true when written and is not true now — fixed by `CRM/api-prionex`, recorded in
`docs/preprod-candidates.md` 2026-08-25, re-measured 2026-08-27 with `GET` (an earlier `curl -I`
measurement of the same thing was **wrong** and is superseded; if you re-measure, use `GET`).

### 5b. You are editing the UNFIXED sibling of a file that just had 14 defects fixed

`record-prod-image.yml` and `record-preprod-candidate.yml` are siblings. Story 6.6 fixed thirteen
inherited findings in the PROD one **plus a fourteenth nobody had found**. The PRE-PROD one has had
no such pass.

**What that does and does not mean, measured rather than inferred** — because `#d48` records that
**three of those thirteen findings pointed at a sibling pattern that does not exist**, and were
corrected only by counting the sibling's actual code:

- ✅ **The existence probes fail CLOSED.** `200`/`404` are classified; everything else exits 1. Not
  the tri-state defect.
- 🔴 **The `$GITHUB_OUTPUT`-empty path is latent, and this story is the named trigger.** AC11.
- ⚠️ **Anything else you notice is out of scope.** Pagination shape, `Accept` headers, retry-loop
  timing — if you find something, **write it in `deferred-work.md`**. A fix-pass that is not itself
  re-reviewed is just a second draft, and this project has paid for that lesson three times.

### 6. Not this story

- **A generator for `docs/preprod-candidates.md`.** Story 6.12's shape, PROD's scope. File, do not build.
- **A repository-write credential for any workflow.** `#d51` §2: `main` has `enable_push: false` with
  an empty whitelist — a direct push is refused for **every** account. It would not work and it is
  not opened.
- **Touching `deploy-stand.yml`.** Frozen, and it declares no `workflow_call` outputs — which is why
  the record must re-resolve the digest from the tag rather than receive it.
- **Re-litigating `#d38` §2.** Decided.

### 7. Traps this project has paid for, listed so they are not paid again

| Trap | Source |
|---|---|
| A skipped `uses:` wrapper reports **success** | `#d21` run 631; seen again in run 662 |
| A dispatch input **shadows** a same-named callee input | `#d47`(3), runs 637/640 — AC5 exists for this |
| Inside an expanded callee, `github.event_name` is `workflow_call` | `#d21` run 631 — AC3's gate depends on it |
| `actions/checkout` destroys `$GITHUB_OUTPUT` from earlier steps | `#d47`(4) |
| Job logs are frequently unreadable here — **verify from the registry** | Stories 5.3/5.4, six `log_in_storage=f` |
| The packages API caps `limit` at 50 regardless of request — **walk to termination** | five wrong conclusions in this project |
| Literal backticks in a double-quoted `echo` are command substitution | caught by `bash -n` before shipping, once |
| `${{ }}` is substituted **inside shell comments** on this instance | `deploy-preprod.yml`'s `e2e` body; `#d21` |

### 8. Verification method — the one that has worked

**Reproduce locally; do not diagnose by re-dispatch.** Story 6.7 burned four red runs guessing at a
stand that was healthy, and every actual diagnosis came from running the component under `docker`
locally in about a minute. Job logs are not retrievable here. For anything shell-shaped, run it
locally first.

### Project Structure Notes

- ⚠️ **`epics.md` carries no Story 6.11 section.** This story was opened by correct-course on
  2026-08-27, not by the original epic. Its specification is
  [`#d51`](../../docs/migration-decisions.md#d51) plus
  `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-27-approval-automation.md` §5.
  **Stated rather than left to be discovered** — a reviewer looking for the epic's own AC text will
  not find one, and that is not an omission in this file.
- FR14 is restored to its letter by this story; FR16 and `#d2` were narrowed by `#d51` and are not
  re-narrowed here.
- No application code, no `src/`, no `nginx.conf`. Workflows and docs only.
- Branch: `story-6-11/impl`, cut from `origin/main` at `89ddca51`.

### References

- [Source: docs/migration-decisions.md#d51] — the decision, §§2/5/6 especially
- [Source: docs/migration-decisions.md#d38] — §2 (withdrawn), §6 (matrix, G1 struck), §8a (evidence tiers)
- [Source: docs/migration-decisions.md#d21] — skipped-wrapper success; callee `concurrency` not applied; `github.event_name` inside a callee
- [Source: docs/migration-decisions.md#d47] — (3) input shadowing, (4) checkout destroys `$GITHUB_OUTPUT`
- [Source: docs/migration-decisions.md#d48] — the caller/callee `record` pattern this story mirrors; §12's frozen list
- [Source: docs/migration-decisions.md#d41] — the waiver's lost machine consumer
- [Source: .forgejo/workflows/record-preprod-candidate.yml] — the file being restructured
- [Source: .forgejo/workflows/deploy-preprod.yml] — the caller; `e2e`'s runner argument
- [Source: .forgejo/workflows/deploy-prod.yml] — `record`/`record-outcome` model; four stale wordings; frozen `derive`
- [Source: .forgejo/workflows/record-prod-image.yml] — the `workflow_call` + outputs + dispatch-only-acknowledgement model
- [Source: .forgejo/workflows/deploy-stand.yml#L261,#L500] — the hold-lock gating that AC6 rests on
- [Source: docs/preprod-candidates.md] — the ledger and its now-stale procedure
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-27-approval-automation.md] — §5, Story 6.11's scope


## Outcome matrix (Task 7.2, `retro-E5`)

**Six live dispatches, runs 722–729.** Every guard below carries a live row or an explicit label.
No guard ships with an empty row and no label.

| # | Guard / branch | Live PASS | Live REFUSAL / negative |
|---|---|---|---|
| — | **The file is schema-valid at all** | 724, 725, 727, 728, 729 | 🔴 **722** — three orphaned empty `env:` blocks, *"the workflow file is not usable"*. Nothing ran. |
| G1′ | acknowledgement, dispatch path | **729** (exact literal → proceeds) | 🔴 **724** — `NOPE`, refused on the **first step**, zero network calls, no credential loaded |
| G1′ | inert on the call path | **725, 728** — *"Skipping step 'G1'' due to `${{ github.event_name == 'workflow_dispatch' }}`"*, `event_name: workflow_call` | n/a — inertness has no refusal side. `#d21` run 631's rebuttal is now measured **here**, not just cited. |
| AC5 | `with:` mapping, not the shadow | **725, 728** — printed `inputs.candidate_tag: 'sha-…'  <- via with:` and `inputs.image_tag: '<unset>'` | n/a. 🟢 The caller's dispatch input did **not** shadow the callee's — `#d47`(3) did not reproduce on this shape. Naming it `candidate_tag` is what made that observable. |
| gate | deploy actually deployed | **728** (gate success → record ran) | 🔴 **727** — `hold_lock_seconds: 60` → gate **skipped**, both inner recorder jobs **skipped**, nothing written |
| G5 | stand serves this exact digest | **728, 729** | 🔴 **725** — earned **by accident**, and it is why run 725 wrote nothing: stand on `sha256:e17c88af…`, candidate `sha256:a62e8687…`, *"Recording this candidate now would be a claim, not evidence -- refusing."* |
| write-history | `attached` | 🟢 **728** — `preprod-cfbad1797d5e` **created** | — |
| write-history | `noop` | **729** | — |
| write-current | `moved` | 🟢 **728** — `a62e8687…` → `e17c88af…` | — |
| write-current | `noop` | **729** | — |
| — | history does **not** move when the pointer does | **728** — `preprod-a99ccd44c5a3`, `-28f7fd36b75e`, `-00ef3be4743d` all unchanged, read from the registry | — |
| G2/G3/digest-404 | shape and resolvability | **725, 728, 729** | ⚠️ **not re-earned here.** Their refusal rows are Story 5.4's (runs 1219/1220/1221) and the code is unchanged by this story. |
| G4/G6 | `keep_pattern`, artifact labels | **728, 729** | ⚠️ **force-test only**, inherited from `#d38` §6. Unchanged here. |
| AC11 | the three `EXISTS` guards | — | ⚠️ **UNEARNED, and unreachable on purpose.** They fire only when a probe step succeeds while its `$GITHUB_OUTPUT` write does not arrive. No dispatch can stage that without breaking the probe. Labelled, not claimed. |
| AC8 | `record-outcome` disclosure | — | 🔴 **UNEARNED.** No run produced `deploy=success` **and** `record=failure`. Run 725 came closest and does not count: the record failed there while `gate` did not yet exist, and `record-outcome`'s own condition correctly excluded it. |
| — | **every refusal followed by a registry re-read** | after 722, 724, 725, 727 — all five markers byte-identical each time | — |

⚠️ **Two rows are unearned and both are named above rather than quietly absent.** AC8's is the one
that matters: the disclosure job has never run. It is a `deploy-prod.yml` twin whose original has
also never fired, so the shape is inherited rather than novel — but inherited is not proven.

## What run 725 cost and what it bought

It is the only run in this story that did something it should not have, and it is the most
informative of the six.

**Cost:** a `record` job executed on a dispatch that deployed nothing.
**Why nothing was written:** G5 refused — defence in depth, not design.
**What it bought:** the discriminating pair for the platform property that caused it. In one run,
`record-outcome` (a **plain** job) and `record` (a **`uses:`** job) carried the *identical* clause
`!(inputs.hold_lock_seconds > 0)` and behaved **oppositely** — the plain one skipped correctly, the
`uses:` one ran. That is `#d21`'s copied-down `if:` rule, observed directly rather than cited.

🔴 **AC6 as written prescribed the defect.** It said *"the `record` job's condition additionally
excludes that path"*. On a `uses:` job that condition cannot work, and this story's own Dev Notes
quoted the `#d21` finding that says so — two screens earlier, in support of a different gate. The
fix is the shape Story 6.5 already used for the promotion guard, for the same reason (`#d49`).

## Note on AC6's literal wording

AC6 asked for *"a live discriminating row … in which the `record` job is **skipped**"*. **The
platform cannot display that.** In run 727 `record` reports **`success`** while both of its inner
jobs report `skipped` — `#d21` again: a skipped `uses:` wrapper reports success. The substance is
earned and observable (the inner jobs, and the untouched registry); the literal word is not
available on this instance. Recorded rather than quietly graded as met.

## Dev Agent Record

### Agent Model Used

Opus 5 (1M context). ⚠️ **Off the standing convention**, which puts `dev-story` on Sonnet; Oleg
instructed `dev-story` in this session. Recorded so the `code-review` pass is run on a different
model, which is the point of that convention.

### Debug Log References

**Six live dispatches, runs 722–729.** Job status read from `action_run_job` on s1 (the REST
`/runs/{id}/jobs` endpoint 404s here); job logs read off disk at
`/opt/forgejo/forgejo/gitea/actions_log/…` via `action_task.log_filename`, **never by
re-dispatching and guessing**. One log (run 729's write job) had not archived at verification
time — the project's own recorded property — so that run was verified from the **registry**
instead, which is the authoritative tier anyway.

Local checks, re-run after every edit: `bash -n` over all 32 `run:` bodies with `${{ }}`
neutralised; `yaml.safe_load`; an any-key-is-None scan (added after run 722); the
zero-`${{ }}`-in-run-bodies house rule; callee output wiring resolved to real step ids in the
right job; and `deploy-prod.yml`'s frozen `derive` snapshotted before/after — byte-identical.

- `bash -n` over **every** `run:` body in the three touched workflows, with `${{ }}` neutralised:
  **32 bodies, 0 failures**. Re-run after each edit, not once at the end.
- `yaml.safe_load` on all three files after every edit.
- `deploy-prod.yml`'s `derive` job snapshotted (canonicalised JSON) before the edits and compared
  after: **byte-identical**. AC9's freeze holds.
- Callee wiring asserted mechanically: `on.workflow_call.outputs` → `jobs.record.outputs` →
  three real step ids, all three in the `record` job (a job output cannot reference a step in
  another job — checked, not assumed).

### Completion Notes List

**All tasks complete.** Oleg chose the minting variant for Task 6.2 when asked. One new permanent
tag was created: **`preprod-cfbad1797d5e`**, and `preprod-current` moved onto it.

🟢 **The story's whole point is earned: run 728 recorded its own candidate with no second
dispatch**, and the registry read back directly shows `preprod-cfbad1797d5e` created,
`preprod-current` moved, and all three earlier history markers untouched.

**Two defects were found by the live runs, and both were mine.** See the outcome matrix and
"What run 725 cost and what it bought" above — the second one, AC6's prescription being
unimplementable on a `uses:` job, is the more serious: I cited the `#d21` rule that forbids it in
support of a different gate two screens earlier in the same file.

**Three findings during implementation that the story's own ACs did not enumerate. All three are
fixed; naming them is the point.**

1. 🔴 **AC11 enumerated two `EXISTS` consumptions. There are three.** The third is `G-backwards`
   (`if [ "$EXISTS" != "true" ]`). It is not cosmetic: an empty `$EXISTS` there makes the step
   report *"nothing to compare against"* and **silently skip the only warning an operator gets
   about a pointer move**. All three are guarded. Leaving one unguarded consumption of the same
   variable would have been exactly the "fix-pass that is a second draft" failure this project has
   paid for three times.

2. 🔴 **AC9 listed nine stale sentences across two files. There was a tenth place, in a third
   file, and it was worse than any of the nine.** `docs/release-validation-checklist.md` has a
   section titled **"How a failed item blocks promotion"** whose entire five-step chain runs
   through `validated=fail` → **G1** → no marker → guard has nothing to match. **This story deletes
   every step of that chain except the first.** Left alone, `RVC-v1.1` would have instructed an
   operator to dispatch an input that no longer exists, and would have asserted that a failed
   validation blocks production **when it no longer does**. The section is struck (not deleted —
   a reader who remembers the guarantee needs to see that it is gone) and replaced with *"What
   blocks promotion now: nothing in any workflow. A person, reading a file."* `#d39` §5, which
   records the same chain as a decision, is amended in the same way.

3. 🔴 **The house rule that the original file carries ZERO `${{ }}` inside any `run:` body.**
   Verified by parsing `HEAD`'s copy: **0 of 22 bodies**. My first draft added four. This is not
   stylistic — `deploy-preprod.yml`'s own `e2e` header records why (`#d21`): this instance
   substitutes inside shell **comments** too, and one empty token has rejected an entire workflow
   with no diagnostic beyond `action_run.pre_execution_error_details`. All four were moved into
   `env:` blocks. **0 of 32 bodies across all three files now.**

**Design decisions taken inside the story's latitude, each announced rather than asked (`#d38`
§7's convention), Oleg's veto open:**

- **G1′ is an `acknowledgement` guard, not a verdict guard**, and it is gated
  `if: github.event_name == 'workflow_dispatch'` so it is inert on the call path. The rebuttal to
  the objection a reviewer has already raised once — that `github.event_name` inside a callee is
  the caller's — is written **in the file**, with its run number (`#d21`, run 631), so it is not
  re-raised.
- **`validation_note` became optional and is generated on the call path.** Its previous
  fail-on-blank guard rested on *"the marker asserts a human named what they checked"*, which
  `#d51` deleted. It is now metadata, labelled *"NOT a verdict"* everywhere it is printed.
- **The `record` job resolves the note independently** rather than taking it from
  `verify-on-stand`. Six duplicated lines, and it keeps this file's stated rule that the two jobs
  pass nothing to each other — a rule whose recorded reason is that `workflow_call` output
  plumbing has surprised this project four times (D8, D21).
- **`record-outcome` runs on `deploy-dev-preprod`**, the same trade `e2e` makes, with the same
  residual inherited and restated: it can queue, and while it queues this file's PRE-PROD
  concurrency group is held.
- **The hold-lock clause is written as `!(inputs.hold_lock_seconds > 0)`**, the literal complement
  of `deploy-stand.yml:500`'s own condition, rather than `== 0`. Whatever that expression does
  with a given input, this one does the exact opposite — no second interpretation of the input's
  type is introduced.

**One claim in the story's Dev Notes §3 was checked and is argued, not observed.**
`record-preprod-candidate.yml`'s own `concurrency` group is already
`deploy-preprod-fe-prionex-preprod` — the caller's group — so on the call path the record runs
under the group it would have chosen anyway, and a hand dispatch is serialized against an automatic
one. That is a genuine improvement over the PROD side, where `#d48` records the two groups as
disjoint. **It is read off the two files. No dispatch has raced them, and the comment in
`deploy-preprod.yml` says so.**

**Task 7.1 changed nothing, and that is a finding rather than an omission:** `#d38` §6's struck G1
row and §2's withdrawal note were written by `#d51` and match what was implemented.

**A third file was corrected that no AC named** — see finding 2 above — and a **fourth** class of
stale claim surfaced only from the live runs: `docs/preprod-candidates.md` gained the first
automatic-record row (run 728) with `n/a` in the Verdict column, plus the sentence that a candidate
which FAILS validation now carries an identical marker.

**Deferred, filed rather than fixed:** AC8's `record-outcome` disclosure is unearned; the three
`EXISTS` guards are unearned and structurally unreachable by dispatch.

### File List

- `.forgejo/workflows/record-preprod-candidate.yml` — MODIFIED
- `.forgejo/workflows/deploy-preprod.yml` — MODIFIED
- `.forgejo/workflows/deploy-prod.yml` — MODIFIED (four wordings + one subordinated clause; `derive` untouched and verified so)
- `docs/preprod-candidates.md` — MODIFIED
- `docs/release-validation-checklist.md` — MODIFIED
- `docs/migration-decisions.md` — MODIFIED (`#d39` §5 amended)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — MODIFIED
- `_bmad-output/implementation-artifacts/6-11-record-the-preprod-candidate-automatically.md` — MODIFIED

## Change Log

| Date | Change |
|---|---|
| 2026-08-27 | dev-story: ALL tasks complete. Six live dispatches (722–729). Run 728 is the first automatic record: `preprod-cfbad1797d5e` created and `preprod-current` moved, with no recorder dispatch. Two of my own defects found live — an unusable-file schema error (722) and AC6's prescription being unimplementable on a `uses:` job (725), fixed with a plain `gate` job. |
| 2026-08-27 | dev-story: Tasks 1–5b complete. Three findings the ACs did not enumerate, all fixed — a third `EXISTS` consumption in `G-backwards`; `RVC-v1.1`'s entire "How a failed item blocks promotion" chain, which this story deletes; and the house rule of zero `${{ }}` in any `run:` body. Task 6 (three live dispatches) and Task 7 (the outcome matrix) remain. |
| 2026-08-27 | Story created by create-story. Ultimate context engine analysis completed — comprehensive developer guide created. AC6 (the hold-lock hazard) and AC5 (the `candidate_tag` rename) were found during analysis, not inherited from the proposal. |
