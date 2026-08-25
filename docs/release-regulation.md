# PRE-PROD Release Regulation

**One page. No new gate, no new machinery.** This document states what already exists (five
workflow legs, already shipped) and one agreement between people (scope freeze) that nothing in
this repository enforces. Written by Story 5.6, AC4/AC10; absorbed later by Epic 7's own
Deployment Process document, not the reverse.

## The five legs

| # | Leg | Workflow | What it does |
|---|---|---|---|
| 1 | Mint the candidate | `.forgejo/workflows/build.yml` | Builds `sha-<12hex>-preprod` for a given commit, `environment: preprod`. |
| 2 | Put it on the stand | `.forgejo/workflows/deploy-preprod.yml` | Deploys that exact tag to the PRE-PROD stand, in `image_tag` mode — no application `ref`, no ambiguity about which artifact is running. |
| 3 | Validate | `docs/release-validation-checklist.md` (`RVC-v1`) | Executed by hand, in one continuous session. Not a workflow — a human checklist with a derived verdict. |
| 4 | Record | `.forgejo/workflows/record-preprod-candidate.yml` | Mints `preprod-<12hex>` and moves `preprod-current`, but only on a `pass` verdict; refuses `fail` before any registry write. |
| 5 | Append the ledger row | `docs/preprod-candidates.md` | Hand-written, append-only, one row per recorded (or refused) candidate — the row the recorder's own last step prints. |

Full identifiers, exact inputs, and timing data for each leg: this story's own §5.

## The scope-freeze agreement

**1. Nothing technically prevents a redeploy mid-validation.** `deploy-preprod.yml` is
dispatchable by anyone with repository write access, at any moment, including the middle of a
validation session. NFR9 says the same about PROD; it is equally true here. **There is no gate,
and this document does not add one.**

**2. The agreement itself:** between the moment P1 is executed (validation's own first step) and
the moment the recorder is dispatched, **no `deploy-preprod.yml` dispatch is issued for this stand
by anyone.** It is an agreement between people, enforced by nothing in the software.

**3. The partial technical backstop, named honestly — including its hole.** The recorder's `G5`
guard requires the stand to be demonstrably serving the candidate's own digest **at record time**,
so a redeploy left in place during validation makes the recording fail — late, loudly, and safely.
But `G5` **brackets** the validation window; it does not **cover** it. A tag deployed
mid-validation and then **reverted** before the recorder runs passes `G5` cleanly, while the twelve
`RVC-v1` verdicts just collected describe a stand that was serving something else for part of the
session. P1-at-start plus `G5`-at-end is a bracket with a gap in the middle, and **only the
agreement in point 2 closes that gap** — nothing technical does. `RVC-v1` makes the identical
argument about its own precondition `P1` and the recorder's `G4`/`G5`, for the identical reason
(see `RVC-v1`'s own P1 section).

**4. The recorder is not an approval gate.** Per NFR9: anyone with repository write access can
dispatch `record-preprod-candidate.yml`, and nothing in the software forces the `validated` input
typed at dispatch time to actually reflect what `RVC-v1` was executed against. `RVC-v1` makes the
verdict **derived** from twelve stated, individually-failable criteria rather than **asserted** by
whatever the operator felt — it does not make it **enforced**. Overstating that distinction would
be the same vacuity this project has already rejected three times (see `RVC-v1`'s own equivalent
disclaimer, and D34 §3 / Story 5.1's / Story 5.2's review findings).

## Where the record lives

- **What "validated" is checked against:** `docs/release-validation-checklist.md`, marker `RVC-v1`.
- **What was actually recorded, and when:** `docs/preprod-candidates.md` — append-only, one row per
  recorded candidate (a second table, "Rejected candidates", covers a refused verdict).
- **Why this shape, and the decisions behind it:** `docs/migration-decisions.md#d39` (`RVC-v1`
  itself) and this story's own decision record, once assigned a `D` number.

This document adds no gate and no machinery. It states an agreement, not a control.
