# PRODUCTION Approval Regulation

**One page. No new gate, no new machinery.** Forgejo has no equivalent of GitHub Environments with
required reviewers, and no per-workflow permission level — a platform property, true today and true
of whatever workflow ends up dispatching a production release. **Once `deploy-prod.yml` exists
(Story 6.4; as of 2026-08-25 it does not — see below), anyone with repository write access will be
able to dispatch it** (NFR9; `docs/migration-decisions.md#d5`). That absence of a technical gate is
accepted, not deferred, and this document is the organizational control that exists instead:
who may approve a production release, what must already be true, how the approval is recorded, and
what happens at the freeze/rollback/emergency edges. Written by Story 6.2 (Epic 6, FR15-FR18, NFR9),
2026-08-25. **Same posture as `docs/release-regulation.md`'s own closing line: this document is a rule, not a piece of machinery.**

**Related, not duplicated:** `docs/release-regulation.md` (Story 5.6) covers the PRE-PROD cycle and
its own scope-freeze agreement — read it for the five legs and for why the recorder is not an
approval gate; nothing here restates it. `docs/release-validation-checklist.md`'s
[`## The waiver`](release-validation-checklist.md#the-waiver) (`RVC-v1.1`) defines the one waiver
mechanism this project has; the emergency procedure below reuses it rather than inventing a second.

## Who approves

**Oleg, as the release's owner** — by name, the same authority `RVC-v1.1`'s waiver section already
states as a rule. Not a role, and not "whoever is around": an approval without a named approver is
not an approval, by this project's own standing convention (`docs/migration-decisions.md#d11`).

## What must be true before approval is sought

A candidate recorded in the PRE-PROD registry (`preprod-<sha>`), its `RVC-v1.1` Execution Log
section written, and its row appended to `docs/preprod-candidates.md` — carrying its **derived**
verdict and **any waiver**, both visible.

**The approver reads `docs/preprod-candidates.md`, not only the registry tag.** `RVC-v1.1`'s waiver
carries no signal at the registry, and Story 6.5's promotion guard — designed, not built, as of
2026-08-25 (`#d2`) — will check only that a `preprod-<sha>` tag exists, so it will not be able to
tell a waived candidate from a clean one either. The live precedent: `sha-a99ccd44c5a3-preprod` —
7/12 pass, 5 `BLOCKED`, derived verdict `fail`, dispatched `pass` only under Oleg's written waiver
(`#d40`/`#d41`) — carries **no trace of any of that on its tag**. This is a policy rule for the
approver, not a fix to the future gate; the gap itself is Story 6.5's.

## How the approval is recorded

One row in `docs/prod-releases.md`, **appended before the dispatch**, carrying the `image_tag`. See
that file for its columns.

## What the approver attests, vs what the machine proves

**As of 2026-08-25, none of this is built.** `deploy-prod.yml` does not exist (`ls
.forgejo/workflows/` — 11 files, no PROD deploy caller); Story 6.4 will build it. The commit-identity
promotion guard is designed, not implemented (`#d2`'s own status line, read 2026-08-25 — Story 6.5
owns both the guard and updating this citation when it ships). Story 6.10 will provision the s10
contour Story 6.4 targets. Nothing in this document claims any of it exists today; the rules below
describe how it **will** be used once it does.

**Once built, the machine will prove commit identity only** — Story 6.5's guard will check that a
`preprod-<sha>` tag exists for the dispatched commit. Under Option C the PROD image is a
**separate, byte-different build** from the one PRE-PROD served (NFR11): *"зелёная валидация на
PRE-PROD — это свидетельство об исходном коде, а не о байтах, которые поедут в прод"* (`#d2`).
**The approver attests to the decision to release. The machine will attest to commit identity.
Nobody attests to the bytes** — that residual risk is `#d2`'s own, not resolved here.

## The freeze window

Distinct from 5.6's PRE-PROD window (P1 → recorder) — see `docs/release-regulation.md`, `## The
scope-freeze agreement`, and do not re-derive it here. **PROD's window runs from the approval row
being appended to the smoke check (Story 6.7) passing**; no other dispatch targets the PROD stand
inside it. **Only Oleg may break it, and the break is recorded in the same ledger row.**

## Rollback authority

`rollback: true` is designed to bypass the promotion guard once it exists (`#d2`). **Restoring a tag already
recorded in `docs/prod-releases.md` is not a new release and needs no new approval** — it returns
the system to a state already approved, and is recorded in the ledger after the fact. **A rollback
to a tag not in the ledger is a release and needs Oleg.** One caveat, honestly stated: rollback
depends on the target `prod-<sha>` tag still existing, and the registry retention rule has **never
been observed** deleting or keeping anything (`#d38` §9, `UNPROVEN by execution`) — Story 6.8 must
prove rollback works before the first real release, not assume it.

## Emergency / hotfix

**There is no forward hotfix path today.** Once Story 6.5's guard exists, a hotfix with no
`preprod-<sha>` will be refused by it. Until then and after, the procedure is the same:
**(1) roll back, (2) fix through the normal cycle.** If a genuine
forward hotfix is ever unavoidable, it requires a `preprod-<sha>`, produced by an abbreviated
`RVC-v1.1` run under **`RVC-v1.1`'s own existing waiver mechanism** — the one this project has, not
a second one.

## Two production stands, until the traffic switch

Story 6.1 is cancelled: GitHub still deploys to s2 on a merge to `main`, and NFR5 (amended
2026-08-18) makes the separation absolute — Forgejo never deploys to s2 at all. Between Story 6.9's
no-op Forgejo deploy and the external traffic switch, **both stands are live**; users stay on s2's
build until the switch happens, and a Forgejo release changes nothing they see before then. This
regulation binds Forgejo→s10 releases only; it does not claim authority over the GitHub→s2 path.

## How this compares to `CRM/api-prionex`'s own PROD gate

Their production promotion already runs on an explicit release sha (never a branch head) and
compares the **digests** of the containers actually running on PRE-PROD against the release
manifest — *"there is no bypass flag"*. Ours, once Story 6.5 ships it, will prove only **commit**
identity and will carry a bypass (`rollback: true`) by design. Story 6.5's guard is meant to sit as
the frontend half of their existing pattern, not an independent one; building the comparison is
6.5's work, not this document's.

## Where the record lives

- **What "validated" is checked against, for the candidate this release promotes:**
  `docs/release-validation-checklist.md`, `RVC-v1.1`.
- **What was approved, when, by whom, and whether it carried a waiver:** `docs/prod-releases.md`.
- **Why this shape:** `docs/migration-decisions.md#d42`.

As with its PRE-PROD sibling, nothing above is a gate — it is an authority rule, written down.
