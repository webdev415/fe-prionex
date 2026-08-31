# Sprint Change Proposal — 2026-08-26 (Story 6.8 cancelled)

**Project:** fe-prionex — Forgejo CI/CD migration
**Raised by:** Oleg
**Trigger story:** 6.8 — Roll Back Production to a Previous Release
**Scope classification:** **Minor** — removes a verification story whose subject was already
built and already exercised live. No requirement loses its mechanism; one measurement loses its
owner.
**Status:** **Decided by Oleg, 2026-08-26.** Applied to `epics.md`, `sprint-status.yaml`,
`deferred-work.md` and `docs/production-approval-regulation.md`.

> ⚠️ **What this document does and does not claim.** Oleg's instruction was one word: cancel.
> **The rationale below is reconstructed from the artifacts, not transcribed from him** — every
> claim in it is cited to a run number or a file, and nothing here should be read as his stated
> reason. If his reason was a different one, this record is still factually correct about what
> the cancellation leaves behind, which is the part a later reader needs.

---

## 1. Issue Summary

Story 6.8 was written on 2026-08-07, when `deploy-prod.yml` did not exist. Its job was to be the
**first** rollback: build confidence in a path that had never run, measure it, and write the
procedure down.

By the time it came up in the queue, Story 6.4 had done the first two of those three things as a
side effect of proving its own ACs:

| What 6.8 was for | What already happened | Evidence |
|---|---|---|
| A rollback path that skips the guard and pulls without rebuilding | Built and shipped | `.forgejo/workflows/deploy-prod.yml`, three jobs, `build` gated `if: needs.derive.outputs.is_rollback != 'true'` |
| A real rollback executed against the production stand | **Executed twice** | Runs **634** and **642** — `build` skipped, deploy executed, stand healthy, backend resolves. Story 6.4 AC3 ✅ MET |
| The rollback path treated as the safe one to exercise first | Already the project's practice | Story 6.4 Task 4: *"The rollback path is dispatched FIRST — it builds nothing"*; Story 6.6 §8 budgets **three more** `rollback: true` dispatches |

A rehearsal story whose rehearsal has already been performed twice, with two more scheduled in the
next story, is not carrying its own weight.

## 2. Impact Analysis

### Epic impact

| Epic | Impact |
|---|---|
| Epics 1-5 | None. |
| Epic 6 — Production Release and Verified Rollback | Drops from 9 planned stories to 8, of which 6.1 was already cancelled. **The epic's goal sentence — *"rollback is proven in practice rather than in theory"* — survives intact**, because 6.4's live dispatches are what proves it. |
| Epic 7 — Forgejo as the Single Source of Delivery | Story 7.5's s2-key-removal gate named 6.8 by number; reworded to name the proof rather than the story. Story 7.1's cancellation text named 6.8 as where rollback lives; repointed to 6.4. |

### Requirement impact

| Requirement | Before | After |
|---|---|---|
| **FR24** — rollback via previous `image_tag` with `rollback: true` | Mapped to Epic 6, proven by 6.8 | ✅ **Met by Story 6.4.** FR24 as written is a statement about the mechanism, and the mechanism ships and has run. |
| **NFR3** — rollback time equals pull + restart, **no rebuild** | Both halves owned by 6.8 | 🟡 **Split.** *No rebuild*: ✅ proven — the `build` job is visibly skipped in 634 and 642. *Time measured and recorded*: ⚠️ **ORPHANED — no owner story.** |
| **NFR7** — old s2 key retained until the Forgejo path is proven | Gated on 6.8 + 6.9 | Gate reworded: rollback proof = 6.4's dispatches, cutover = 6.9. No weakening. |

### The five AC clauses, one by one

| # | Clause | Disposition |
|---|---|---|
| 1 | Guard skipped, image pulled without rebuilding | ✅ Story 6.4 AC3, runs 634 + 642 |
| 2 | Elapsed = pull + restart, **duration recorded** | 🔴 **Half orphaned** — see §3 |
| 3 | Story 6.7's smoke check passes against the restored release | ➡️ **Story 6.7.** The check runs on every deploy and a rollback is a deploy; 6.7's own final AC already points a failing operator at 6.4's `rollback: true` path |
| 4 | `prod-current` points at the restored image | ➡️ **Story 6.6.** Its ledger writes run on **both** paths by its own AC (§6, which cites this very 6.8 clause as its reason), and its §8 exercise moves `prod-current` on a rollback and moves it back |
| 5 | A real rollback executed; **procedure documented** | 🟡 Execution ✅ (634, 642). Written procedure 🔴 **orphaned** — see §3 |

## 3. What is genuinely lost

Two things, both small, both now unowned, both filed in `deferred-work.md` with **Owner: Oleg**:

1. **NFR3's measured duration.** Story 6.4 §"not in scope" item 4 deferred *"proving rollback as a
   rehearsal with measured timing"* to Story 6.8 **by name**. Story 6.6 §"not in scope" item 3
   repeats the deferral and adds *"this story does not claim 6.8's ACs."* Two stories pointed at
   6.8; 6.8 now points nowhere.
2. **A single written rollback procedure.** The operational content is not missing — the regulation
   keys rollback authority on the ledger's `prod_tag`, and 6.7 routes a failing operator to the
   dispatch — but no one page says *this tag, this flag, this long*.

**Cheapest capture if either is wanted, requiring no new dispatch and no new permanent tag:**
🔴 **Updated 2026-08-27 on rebase — Story 6.6 merged in the meantime and its three `rollback: true`
dispatches are now runs 662, 667 and 668, executed. That makes FIVE live rollbacks (634, 642, 662,
667, 668) and NONE of them timed.** The reading stays free: run metadata survives on the runs API
even where this instance's job logs do not, so those three can be timed retrospectively today.
Story 6.9's cutover is itself a `rollback: true` deploy under the amended FR32 and is a later
reading. **This proposal deliberately does not attach the measurement to 6.6 or to
6.9** — re-scoping a story that is `ready-for-dev` with a frozen AC set is Oleg's call, and the
2026-08-24 reconciliation set the precedent of naming an unowned item rather than silently assigning
it.

## 4. What does NOT change

- **The accepted risk in Epic 6's preamble stands word for word.** The rollback horizon still resets
  at cutover; depth still starts at zero and grows one release at a time. That was never a property
  of Story 6.8 — the story only described it.
- **Epic 6 carries no external safety net.** Unchanged since 2026-08-07.
- **The retention rule is still UNPROVEN by execution** (`#d38` §9). Rollback depends on the recorded
  tag surviving in the registry, and the rule has been observed neither deleting nor keeping
  anything. **This is a bigger open question than the one this cancellation creates**, it predates
  it, and it is untouched by it.
- **The release path's deploy leg is still never-green** — Story 6.9 inherits that, per
  `deferred-work.md`'s own "What Story 6.9 inherits" section. Rollback being proven does not make the
  release path proven; they are different legs.

## 5. Artifacts amended

| File | Change |
|---|---|
| `_bmad-output/planning-artifacts/epics.md` | Story 6.8 → cancellation block with the five-clause disposition table; Epic 6 implementation notes annotated; Epic 6 accepted-risk box repointed to 6.4; Story 7.1's and Story 7.5's references to 6.8 reworded |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | `6-8-…: backlog` → `cancelled`, with the reason and the orphaned clause recorded above the row |
| `_bmad-output/implementation-artifacts/deferred-work.md` | New EOF section with the two orphaned items, owner and removal trigger on each |
| `docs/production-approval-regulation.md` | *Rollback authority* — the sentence *"Story 6.8 must prove rollback works before the first real release"* amended in place, with the retention caveat explicitly preserved as still unmet |

**Not amended, deliberately:** Stories 6.4 and 6.6's own files. They are closed records of what was
known when they were written, and their deferrals to 6.8 are historically accurate. This proposal is
the forwarding address.
