# PRODUCTION Approval Regulation

**One page, and it adds nothing to the pipeline.** Forgejo has no equivalent of GitHub Environments
with required reviewers, and no per-workflow permission level — a platform property, true today and
true of whatever workflow ends up dispatching a production release. **Once `deploy-prod.yml` exists
(Story 6.4; as of 2026-08-25 it does not — see below), anyone with repository write access will be
able to dispatch it** (NFR9; `#d5`). That absence of a technical gate is accepted, not deferred, and
this document is the organizational control that exists instead: who may approve a production
release, what must already be true, how the approval is recorded, and what happens at the
freeze/rollback/emergency edges. Story 6.2 (Epic 6, FR15-FR18, NFR9), 2026-08-25. **A rule, not a
piece of machinery — the same posture `docs/release-regulation.md` closes on.**

**Related, not duplicated:** `docs/release-regulation.md` (Story 5.6) covers the PRE-PROD cycle and
its scope-freeze agreement — read it for the five legs and for why the recorder is not an approval
gate; nothing here restates it. `RVC-v1.1`'s [`## The
waiver`](release-validation-checklist.md#the-waiver) defines the one waiver mechanism this project
has; the emergency procedure below reuses it rather than inventing a second.

## Who approves

**Oleg, as the release's owner** — by name, reusing an authority already written down rather than
inventing a second: `RVC-v1.1`'s waiver section names **Oleg only** and says a waiver from anyone
else *"has no effect"*. Not a role, not "whoever is around" — the same habit `deferred-work.md:23`
applies to accountability generally: *"**Owners are NAMES or STORY NUMBERS**"*.

**No delegate — a decision, not an omission** (asked at code review; Oleg, 2026-08-25: *"Оставить
как есть"*). The cost, named so it is met on the page and not during an incident: **while Oleg is
unavailable nothing can be approved, including an emergency rollback to a tag not already in
`docs/prod-releases.md`** — which this document classifies as a release. Rollback to a ledger tag
needs no approval and stays available. **Risk owner: Oleg, accepted 2026-08-25.**

## What must be true before approval is sought

A candidate recorded in the PRE-PROD registry (`preprod-<sha>`), its `RVC-v1.1` Execution Log
section written, and its row appended to `docs/preprod-candidates.md` — carrying its **derived**
verdict and **any waiver**, both visible. **A derived verdict of `fail` with no waiver covering it
is not approvable**; visibility is the precondition, not the permission.

**The approver reads `docs/preprod-candidates.md`, not only the registry tag.** `RVC-v1.1`'s waiver
carries no signal at the registry, and Story 6.5's guard — designed, not built, as of 2026-08-25
(`#d2`) — will check only that a `preprod-<sha>` tag exists, so it will not be able to tell a waived
candidate from a clean one either. The live precedent: `sha-a99ccd44c5a3-preprod` — 7/12 pass, 5
`BLOCKED`, derived verdict `fail`, dispatched `pass` only under Oleg's written waiver
(`#d40`/`#d41`) — carries **no trace of any of that on its tag**. This is a policy rule for the
approver, not a fix to the future gate; the gap itself is Story 6.5's.

## How the approval is recorded

One row in `docs/prod-releases.md`, **appended before the dispatch**, carrying the `image_tag` and
the approver's **own start and end timestamps** — both mandatory, because this document's freeze
window is defined over them and `RVC-v1.1`'s Execution Log has no end-time field to inherit. See
that file for the rest of its columns, and for how post-dispatch facts reach an append-only file.

## What the approver attests, vs what the machine proves

**As of 2026-08-25, none of this is built.** `deploy-prod.yml` does not exist (`ls
.forgejo/workflows/` — 11 entries, no PROD deploy caller); Story 6.4 will build it. The guard is
designed, not implemented (`#d2`'s own status line, read 2026-08-25 — Story 6.5 owns both the guard
and updating this citation when it ships). Story 6.10 will provision the s10 contour 6.4 targets.
Nothing here claims any of it exists today; the rules describe how it **will** be used once it does.

**Once built, the machine will prove commit identity only** — 6.5's guard will check a
`preprod-<sha>` tag exists for the dispatched commit. Under Option C the PROD image is a **separate,
byte-different build** from the one PRE-PROD served (NFR11): *"зелёная валидация на PRE-PROD — это
свидетельство об исходном коде, а не о байтах, которые поедут в прод"* (`#d2`). **The approver
attests to the decision to release. The machine will attest to commit identity. Nobody attests to
the bytes** — `#d2`'s own residual risk, not resolved here.

## The freeze window

Distinct from 5.6's PRE-PROD window (P1 → recorder) — see `docs/release-regulation.md`, `## The
scope-freeze agreement`, and do not re-derive it here. **Once the s10 contour (Story 6.10) and the
smoke check (Story 6.7) exist — neither does on 2026-08-25 — PROD's window will run from the
approval row being appended to that smoke check passing**, and no other dispatch will target the
PROD stand inside it. **It closes on that check's outcome whatever the outcome is** — a failed
check, a failed deploy or a dispatch never made all end it, and the outcome is recorded; a window
with no terminating event on the failure path is not a rule. **It binds the s10 stand only**: a
GitHub→s2 merge deploy falls outside it and is not an approved release. **Only Oleg may break it,
and the break is recorded in the ledger.**

## Rollback authority

`rollback: true` is designed to bypass the promotion guard once it exists (`#d2`). **Restoring a tag
already in `docs/prod-releases.md`'s `prod_tag` column is not a new release and needs no new
approval** — it returns the system to a state already approved, and is recorded after the fact. **A
rollback to a tag not in the ledger is a release and needs Oleg.** One caveat: rollback will depend
on that recorded tag still existing in the registry, and the retention rule has **never been
observed deleting anything** — `#d38` §9, `UNPROVEN by execution`, verified by compilation against
the stored rule rather than by execution, so it has not been observed *keeping* anything either —
rollback had to be proven working before the first real release, not assumed.

> 🔴 **AMENDED 2026-08-26 — the sentence above originally read "Story 6.8 must prove rollback works
> before the first real release, not assume it." Story 6.8 was cancelled that day**
> (`_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-26-story-6-8-cancelled.md`)
> **because the proof had already happened without it.** Story 6.4 built the `rollback: true` path
> and dispatched it live against the production stand twice — runs **634** and **642** — with the
> `build` job skipped and the stand healthy on both. The obligation in this section is therefore
> **met, and this rule stands unchanged**: restoring a ledger tag is not a new release.
>
> **The caveat above is NOT met and is unaffected by any of this.** Rollback still depends on the
> recorded tag surviving in the registry, and the retention rule has still never been observed
> either deleting or keeping anything. Two things also remain unwritten and are now owned by Oleg
> rather than by a story (`_bmad-output/implementation-artifacts/deferred-work.md`): **the measured
> rollback duration** (NFR3's second half), and **a single procedure page** stating which tag to
> dispatch, with which flag, and how long it takes.

## Emergency / hotfix

**There is no forward hotfix path today.** Once Story 6.5's guard exists, a hotfix with no
`preprod-<sha>` will be refused by it. Until then and after, the procedure is the same: **(1) roll
back, (2) fix through the normal cycle.** If a genuine forward hotfix is ever unavoidable, it
requires a `preprod-<sha>` from an abbreviated `RVC-v1.1` run under **`RVC-v1.1`'s own existing
waiver mechanism** — the one this project has, not a second one.

## Two production stands, until the traffic switch

Story 6.1 is cancelled: GitHub still deploys to s2 on a merge to `main`, and NFR5 (amended
2026-08-18) makes the separation absolute — Forgejo never deploys to s2 at all. **As of 2026-08-25
only s2 is live; the s10 contour is Story 6.10's and is not provisioned.** Between Story 6.9's no-op
Forgejo deploy and the external traffic switch **both stands will be live**; users stay on s2's
build until the switch, and a Forgejo release changes nothing they see before then. This regulation
will bind Forgejo→s10 releases only; it claims no authority over the GitHub→s2 path.

## How this compares to `CRM/api-prionex`'s own PROD gate

**An observation about another team's repository, not a control we operate and not re-measured
here** (established 2026-08-14; `epics.md:2600-2603`, `deferred-work.md:1055-1058` — nothing here
can verify it). As recorded there, their production promotion runs on an explicit release sha, never
a branch head, and `ops/deploy/validate-preprod-digests.sh` compares the **digests** of the
containers actually running on PRE-PROD against the release manifest — *"Digests, not tags: a tag
can be moved, a digest cannot. There is no bypass flag."* Ours, once Story 6.5 ships it, will prove
only **commit** identity and will carry a bypass (`rollback: true`) by design; 6.5's guard is meant
to sit as the frontend half of that pattern, not an independent one.

## Where the record lives

- **What "validated" is checked against, for the candidate this release promotes:**
  `docs/release-validation-checklist.md`, `RVC-v1.1`.
- **What was approved, when, by whom, and whether it carried a waiver:** `docs/prod-releases.md`.
- **Why this shape:** `docs/migration-decisions.md#d42`.

As with its PRE-PROD sibling, nothing above is a gate — it is an authority rule, written down.
