# Sprint Change Proposal — The Cutover Image Comes from the Validated PRE-PROD Candidate, Not from the Running PROD Commit

**Date:** 2026-08-26
**Raised by:** Story 6.3, dev-story session 2 (the gate at its Task 2.4 fired and held)
**Decided by:** Oleg, 2026-08-26 — *«Берем тот коммит, который последний в pre-prod»*
**Reverses:** Story 6.3's Open Question 6 resolution of the same day (*«Занесу коммиты в Forgejo»*, option (a))
**Scope classification:** **Moderate** — backlog/AC reorganisation across four requirements and three stories. No code is rolled back, no epic is added or removed.

---

## 1. Issue Summary

### The problem, precisely

Story 6.3 exists to put **the code production is currently serving** into the Forgejo registry, so the
cutover can be rehearsed against it. Its own gate found that it cannot:

```
running container on s2:  ghcr.io/crm-prionex/fe-prionex:main
  org.opencontainers.image.revision = 41ab0470ab6b3df3bc332fc90f8bccaaba44dc39
  org.opencontainers.image.created  = 2026-08-22T19:47:22.014Z

in Forgejo, re-verified 2026-08-26 across 549 remote heads:
  git cat-file -e 41ab0470...^{commit}   -> fatal: Not a valid object name
  git rev-list --all | grep ^41ab0470    -> 0
  git ls-remote origin | grep 41ab0470   -> 0      (asks the server, not the local object store)
```

**The commit does not exist in the repository the build runs from.** `actions/checkout` has nothing to
fetch. This is the first *direct* proof of the GitHub/Forgejo divergence the plan had only theorised
about (`#d7`, `#d19`), and it is exactly the risk Story 6.3 was contexted to test for.

Corroborated independently and without touching s2 — the live production bundle over public HTTP:

```
VITE_BUILD_TS  = 1787428120913  -> 2026-08-22 19:48:40Z   (vite.config.ts's Date.now() define)
Last-Modified  (index.html and /assets/index-D8ZYo8qY.js)  -> 2026-08-22 19:49:08 GMT
```

Four timestamps from two channels inside one 2.5-minute window. **Production has not moved since the
identification.** (This corroborates the *build*; the *commit label* still rests on the single source
Open Question 4 accepted.)

### Why the first resolution did not hold

On 2026-08-26 Oleg chose to import the missing history (`«Занесу коммиты в Forgejo»`), explicitly
declining the nearest-ancestor compromise. Later the same day the decision changed to **build the last
validated PRE-PROD candidate instead**. This proposal records the reversal and its consequences rather
than absorbing it into the story file.

### Issue type

**Technical limitation discovered during implementation**, resolved by a **strategic decision**. Not a
misunderstanding of requirements: FR31 says what it says, and the story executed it correctly right up
to the point where the environment refused.

---

## 2. Impact Analysis

### 2.1 What the change actually is

| | Before | After |
|---|---|---|
| Commit built at `environment: prod` | `41ab0470ab6b3df3bc332fc90f8bccaaba44dc39` | **`a99ccd44c5a39345fa65eb74e87343b187e129e9`** |
| Source of that commit | s2's running image label | the last validated PRE-PROD candidate |
| Present in Forgejo? | **no** | **yes** — reachable from `origin/main` |
| Has `preprod-<sha>`? | **no, and never will** | **yes** — `preprod-a99ccd44c5a3` |

**The candidate, measured from the Forgejo package database rather than read from a document:**

```
version               | created (UTC)
preprod-00ef3be4743d  | 2026-08-24 12:19:41Z
preprod-28f7fd36b75e  | 2026-08-24 12:43:24Z
preprod-a99ccd44c5a3  | 2026-08-25 14:02:04Z
preprod-current       | 2026-08-25 14:02:07Z
```

**No `prod-*` version exists at all** — this confirms, by measurement, that nothing has ever written a
production marker and that Story 6.3's write is genuinely the first.

Its ledger row (`docs/preprod-candidates.md`, run 1316): verdict `pass`, **`7/12 pass, 5 BLOCKED`**,
un-waived aggregate `fail`, dispatched under the single-candidate waiver `#d40`, legitimised by `#d41`.
**That is what "validated" means for this candidate, and the approval regulation already requires the
approver to read this file rather than the tag.**

### 2.2 🟢 What this FIXES — a real contradiction in the plan closes

FR16 / Story 6.5's promotion guard refuses any release whose commit has no `preprod-<sha>`.
**`41ab0470` has none and could never acquire one** — it never went through Epic 5's cycle and never
will. So the cutover image would have failed the plan's own gate **by construction**, which is precisely
why Story 6.9 was written around `rollback: true`. Story 6.3's own §7(f) records this as a permanent
exception the story had to carry.

With `a99ccd44c5a3`, **the exception disappears.** The cutover image is a legitimately validated
candidate, and the chain build → PRE-PROD → validation → PROD is whole for the first time. This is the
single strongest argument for the change and it is not a side effect.

### 2.3 🔴 What this BREAKS — four items, each requiring an amendment

**(a) FR31's own text is now false.** *"Rebuild the running PROD commit into the Forgejo registry."*
The commit built is not the running one. FR31 must be amended, not quietly reinterpreted.

**(b) Story 6.3 AC1 and AC4 cannot be met as written.** AC1 requires the commit to be *"determined from
the running container on s2 … not assumed"* and used as the build source; AC4 requires the built image
to be *"confirmed to originate from the same commit"*. Both are now false of the artifact this story
produces. **They are not deleted — they are re-pointed** (§4.3): the s2 read stays and becomes the
*reference measurement* that makes the gap visible, instead of the build source.

**(c) FR32 and Story 6.9 lose their premise. This is the largest consequence.** FR32: *"Cutover
validated by a **no-op** `rollback: true` deploy."* Story 6.9 AC1: *"the content served before and after
the deploy is identical"*, amended 2026-08-18 to mean *"between what s2 serves and what s10 serves"*.
**With a different commit, that comparison is false by construction.** Story 6.9's stated purpose is *"so
that cutover risk is separated from release risk"* — this change **merges them back together**. The
cutover becomes the first real release.

**(d) 🔴 A trap that must be written down before 6.9 walks into it: the deploy still has to use
`rollback: true`, for a completely different reason.** One might assume that, now the guard passes, 6.9
can use the release path. It cannot. Story 6.4 AC2 makes the release path (`rollback: false`)
**rebuild** the image; `build.yml`'s `Enforce AC2` guard refuses to repoint an existing
`sha-<12hex>-prod`, and `vite.config.ts`'s `Date.now()` guarantees the rebuild differs
(`#d24` §2b). So a release-path dispatch of a commit **Story 6.3 has already built** goes red. The
`rollback: true` path survives — it is now a *mechanical* requirement rather than a *guard-bypass*
requirement, and the reason must be recorded, because it inverts.

### 2.4 🔴 The load-bearing risk this change creates: product-code age

**Measured, in Forgejo, on `origin/main`:**

```
92670958  2026-08-17  test: prove the phone origin is empty in a production build   <- migration (ours)
418dee4c  2026-08-17  style: prettier on constants.ts                               <- migration (ours)
50fb02a8  2026-08-17  fix(security): production bundles posted a JWT to localhost   <- migration (ours)
54322fdd  2026-08-13  fix(test): flush unmount timers                               <- migration (ours)
616ef3cc  2026-08-04  style(lawyer-workplace): ...                                  <- LAST from the team
```

**The last `src/` commit authored by the product team and present in Forgejo is 2026-08-04.**
Production was built **2026-08-22** from a commit Forgejo does not have.

**What is NOT measured, and is not claimed:** how far GitHub's `main` moved in product terms between
those dates. Reading GitHub is forbidden (Story 6.3 Prohibition 4, `#d7`), so the size of the gap is
**unknown from here**. One inference *is* strict and is offered as such: had GitHub's `main` not moved at
all, its HEAD would be a commit Forgejo already has — and `41ab0470` is not. **So it moved. How much of
that touched `src/` is unmeasured.**

**Consequence.** Story 6.9's traffic switch points users at s10. If s10 serves `a99ccd44c5a3` and the
team's work since early August has not reached Forgejo, **the switch is a product regression for
users** — no longer a cutover risk, an incident. **The import problem is not solved by this change; it
moves from Story 6.3 to Story 6.9**, where it is more expensive because users are attached to the
outcome.

This proposal therefore does not merely amend text: it **adds a named, owned gate** (§4.6).

### 2.5 What is NOT affected

- **Option C / NFR11** — unchanged. PROD is rebuilt rather than promoted either way; the deviation and
  its record stand exactly as `#d2` states them.
- **NFR5** — unchanged, and now easier: Forgejo still never touches s2, and s2 is no longer even the
  build's source of truth.
- **NFR3 (rollback without rebuild), FR17, FR18, FR24** — unchanged.
- **Epics 1–5** — closed and untouched. **Epic 7** — untouched.
- **Story 6.4, 6.5, 6.6, 6.7, 6.8, 6.10** — no AC changes. 6.5 *gains* a passable case; 6.10's ordering
  constraint before 6.4 is unchanged (6.10 merged its context on 2026-08-26 as PR #90 and is
  `ready-for-dev`; the contour is **not** provisioned yet).
- **`.forgejo/workflows/record-prod-image.yml`** — the recorder Story 6.3 shipped in session 2 is
  **commit-agnostic**. It takes a `sha-<12hex>-prod` tag and validates it against its own labels. It
  needs **no change**, and its four pure-shell guards remain valid. This is the main reason the change
  is Moderate rather than Major.
- **No architecture / UX / PRD artifacts exist** in `planning-artifacts` — `epics.md` carries the FR/NFR
  tables, the same condition under which the nine prior proposals in this folder were written.

### 2.6 Risk ledger — both directions

| Risk | Direction | Note |
|---|---|---|
| Cutover image fails the plan's own promotion guard | 🟢 **removed** | `preprod-a99ccd44c5a3` exists (measured) |
| Story 6.3 blocked indefinitely on an external import | 🟢 **removed** | commit present and reachable |
| Cutover no longer separates cutover risk from release risk | 🔴 **new** | FR32/6.9's premise; §4.5 |
| Traffic switch serves product code older than what users have | 🔴 **new, load-bearing** | §2.4; gated by §4.6 |
| A release-path dispatch of an already-built commit goes red | 🔴 **new, latent** | §2.3(d); recorded, not discovered |
| Two productions in parallel until the switch | ⚪ unchanged | `#d23` |

---

## 3. Recommended Approach: **Direct Adjustment** (Option 1)

**Options evaluated:**

| Option | Verdict |
|---|---|
| **1. Direct Adjustment** — amend FR31, FR32, Story 6.3's AC1/AC4, Story 6.9's ACs; add one named gate | ✅ **RECOMMENDED.** Effort **Low–Medium**, risk **Medium** (all of it in §2.4, and the gate is what contains it). No work is discarded; the shipped recorder is unaffected. |
| **2. Rollback** — revert Story 6.3's sessions 1–2 | ❌ **Not viable and not needed.** Nothing reached production; no tag was minted; the artifact produced (`record-prod-image.yml`) is commit-agnostic and survives the change intact. There is nothing whose reversal simplifies anything. |
| **3. MVP review** — reduce or redefine scope | ❌ **Not required for the MVP**, which is *delivery runs on Forgejo* and remains achievable. But it is **not fully N/A**: the *traffic-switch* half of Epic 6 acquires a product-regression precondition. **Folded into Option 1 as the §4.6 gate rather than treated as a scope cut.** |

**Justification.** The change removes a real contradiction (§2.2) and unblocks a story that is otherwise
stopped on a dependency no story owns. Its cost is concentrated in one place — the traffic switch — and
that cost is *containable by a precondition*, not by rewriting the epic. Every amendment below is
additive and dated; nothing is rewritten in place, per this project's standing rule.

**Timeline impact:** Story 6.3 unblocks immediately. Story 6.9 gains a precondition it did not have and
should be assumed slower, not faster.

---

## 4. Detailed Change Proposals

### 4.1 `epics.md` — FR31 (amendment note appended; the row's text is struck, not deleted)

> | FR31 | Epic 6 | `[C]` Rebuild ~~the running PROD commit~~ **the last validated PRE-PROD candidate** into the Forgejo registry as `sha-<commit>`, `prod-current` **and `prod-<sha>`** (ghcr unreachable; amended 13.08) 🔴 **AMENDED 2026-08-26** (`sprint-change-proposal-2026-08-26-cutover-candidate.md`). The running PROD commit `41ab0470ab6b3df3bc332fc90f8bccaaba44dc39` is **absent from the Forgejo repository** — measured across 549 remote heads and against the server itself — so it cannot be checked out and cannot be built. The cutover image is built from `a99ccd44c5a39345fa65eb74e87343b187e129e9` instead, which **has** `preprod-a99ccd44c5a3` and therefore satisfies FR16 rather than requiring an exception to it. **The cost is FR32 (see below) and the product-code gap in §2.4 of that proposal.** |

### 4.2 `epics.md` — FR32 (amended; this is the requirement the change actually costs)

> | FR32 | Epic 6 | Cutover validated by a ~~no-op~~ **`rollback: true`** deploy 🔴 **AMENDED 2026-08-26.** The word **no-op** is withdrawn and not replaced by a synonym. Under FR31 as amended the cutover image is built from a **different commit** than the one legacy production serves, so the deploy changes what the new stand serves and **the cutover is the first real release.** `rollback: true` is still required, but for a **mechanical** reason that has nothing to do with the promotion guard: the release path rebuilds (Story 6.4 AC2), and `build.yml`'s `Enforce AC2` refuses to repoint an existing `sha-<12hex>-prod` because `vite.config.ts`'s `Date.now()` makes every rebuild differ (`#d24` §2b). A release-path dispatch of a commit Story 6.3 already built **goes red**. |

### 4.3 `epics.md` — Story 6.3, ACs 1 and 4 (re-pointed, not deleted)

**AC1 — OLD:**
> **Given** production currently runs an image from ghcr.io
> **When** the running commit is identified
> **Then** it is determined from the running container on s2 — via its image labels or the recorded deployment — not assumed from a branch name
> **And** the identification is evidenced rather than asserted.

**AC1 — NEW:**
> **Given** production currently runs an image from ghcr.io
> **When** the running commit is identified
> **Then** it is determined from the running container on s2 — via its image labels or the recorded deployment — not assumed from a branch name
> **And** the identification is evidenced rather than asserted
> **And** 🔴 **AMENDED 2026-08-26: this identification is the story's REFERENCE MEASUREMENT, not its build source.** It is recorded so the distance between what production serves and what the cutover image contains is **visible and dated**, instead of implicit. **The build source is the last validated PRE-PROD candidate** (FR31 as amended).

*Rationale:* the s2 read has already been performed and is good evidence. Deleting AC1 would throw away
the only measurement that makes §2.4's gap legible. Re-pointing keeps its value and removes its false
claim.

**AC4 — OLD:**
> **Given** the rebuilt image
> **When** it is compared with what production serves
> **Then** it is confirmed to originate from the same commit
> **And** it is recorded that it is **not** byte-identical, because it was rebuilt …

**AC4 — NEW:**
> **Given** the built image
> **When** it is compared with what production serves
> **Then** it is recorded that it originates from a **DIFFERENT COMMIT** — `a99ccd44c5a3…` against s2's `41ab0470…` — with both values pasted, and with the reason the running commit could not be used (absent from Forgejo, measured)
> **And** the **product-code distance** is stated with what is measured and what is not: Forgejo's newest team-authored `src/` commit is **2026-08-04**; production was built **2026-08-22**; **how much of that delta is product code is UNMEASURED, because reading GitHub is forbidden**
> **And** it is recorded that the image is **not** byte-identical to anything production has served, which is true by construction (`vite.config.ts`, `Date.now()`, `#d24` §2b) and must never be presented as a measured comparison.

*Rationale:* AC4's discriminating content survives and gets stronger — a **commit-identity** comparison
that can fail, now stated in the direction that is actually true. The prohibition against claiming a
vacuous byte-comparison (Story 6.3 Prohibition 7, five prior rejections) is preserved verbatim.

### 4.4 `epics.md` — Story 6.3, title note (the story key is NOT renamed)

Append under the story heading:

> 🔴 **Scope amended 2026-08-26** (`sprint-change-proposal-2026-08-26-cutover-candidate.md`). The title
> still reads *"Rebuild the Running Production Commit"*; **the story now builds the last validated
> PRE-PROD candidate.** The title and the story key
> (`6-3-rebuild-the-running-production-commit-into-the-forgejo-registry`) are **deliberately left
> unchanged** — the key names a branch, a story file and a `sprint-status.yaml` row that are all in
> flight, and renaming them costs more than the mismatch does. **Read the ACs, not the title.**

### 4.5 `epics.md` — Story 6.9 (AC1 replaced; the story's own purpose statement amended)

**AC1 — OLD:**
> **Given** the image imported in Story 6.3
> **When** `deploy-prod.yml` is dispatched against it with `rollback` true
> **Then** the deploy pulls that image from the Forgejo registry and restarts the stand
> **And** the content served before and after the deploy is identical.

**AC1 — NEW:**
> **Given** the image built in Story 6.3 from the validated PRE-PROD candidate
> **When** `deploy-prod.yml` is dispatched against `sha-<12hex>-prod` with `rollback` **true**
> **Then** the deploy pulls that image from the Forgejo registry and starts the s10 stand
> **And** 🔴 **the content s10 serves is NOT identical to what s2 serves, and this is expected, not a defect** — they are different commits (FR31 as amended). **The identity comparison is withdrawn**; what is asserted instead is that **s10 serves the image Story 6.3 recorded**, verified by digest against `prod-<12hex>`
> **And** `rollback: true` is used for the mechanical reason in FR32 as amended — **not** because the promotion guard would refuse this commit; it would now pass.

**Amendment to the story's own framing note:**

> 🔴 **AMENDED 2026-08-26.** This story was written *"so that cutover risk is separated from release
> risk"*. **Under FR31 as amended that separation no longer exists** — the cutover deploy carries a
> commit change with it, so it is the first real release and both risks land together. **The separation
> is not recoverable** without importing the running commit, which was the alternative Oleg declined.
> **Stated plainly here rather than left for 6.9 to discover.**

### 4.6 `epics.md` — Story 6.9, 🔴 NEW acceptance criterion (the gate this change requires)

> **Given** the traffic switch points users at a stand serving a **different commit** than the one they
> are served today, and Forgejo's newest team-authored `src/` commit is **2026-08-04** while production
> was built **2026-08-22**
> **When** the switch is planned
> **Then** the product-code delta between what s2 serves and what s10 serves is **measured and written
> down before the switch, not after** — and if the delta contains team work absent from Forgejo, **the
> switch does not happen until that work is in Forgejo**
> **And** the owner of that import is named — **Oleg** — with the state recorded as `PENDING`, `OPEN` or
> the work done; no fourth, softer word
> **And** it is stated that this precondition **did not exist before 2026-08-26** and was created by
> this change, so it is not read as an oversight in the original plan.

*Rationale:* §2.4. Without this, the cheapest failure mode of the whole epic is a silent product
regression at the moment of highest visibility. A `deferred-work.md` line is too weak — this belongs in
an AC because it gates an action, and the plan's own convention is that owners are names or story
numbers.

### 4.7 `epics.md` — Epic 6 implementation notes (append)

> 🔴 **Amended 2026-08-26.** Epic 6's opening records that *"the first Forgejo release is a one-way
> door"* and that rollback depth starts at zero. **That is now sharper, not softer**: the cutover image
> is a **different commit** from what production serves, so after the traffic switch there is no
> Forgejo-side artifact carrying the currently-served code at all. **The legacy pipeline remains the
> only route back to what users have today**, and it stays that way until the team's product work is in
> Forgejo (Story 6.9's new AC). **Do not read the passing promotion guard as a safety net it is not.**

### 4.8 `docs/migration-decisions.md` — new decision record

Append **`D46`** (verified free across every `origin/*` ref on 2026-08-26; `D44` is held by
`story-4-10/pr-1-context` and `D45` by `story-6-3/pr-1-context`). Content: everything in §§1–2 of this
proposal — the measurements, the reversal of Story 6.3's OQ6 with both decisions quoted verbatim, the
contradiction that closes, the four that break, and the §2.4 gap with its explicit unmeasured half.

⚠️ **Re-verify the number at application time.** The sweep that produced it reads refs only, and Story
6.3's Open Question 10 recorded the same sweep failing once already against a locally-authored,
unpushed record (`D43`). *That specific instance has since resolved — `bd4e4b83`/`1c54f32d` are on `main`
as of 2026-08-26 — but the method is unchanged and the process half of OQ10 stays OPEN.*

### 4.9 `_bmad-output/implementation-artifacts/sprint-status.yaml`

No status value changes. Append a handover comment above `6-3-…` recording: the build source change and
its one-line reason; that OQ6 is superseded; that the shipped `record-prod-image.yml` needs **no**
change; that FR32/6.9's no-op premise is withdrawn; the `rollback: true`-for-a-different-reason trap;
and the new 6.9 gate with owner Oleg.

### 4.10 Story 6.3's own story file (`6-3-…md`)

Amend by **dated addition**, never rewrite: §3's blocker section gains the resolution; Open Question 6
is marked **superseded 2026-08-26** with both of Oleg's decisions quoted; §7(f) — which records that the
image *"will fail Story 6.5's guard by construction"* — is **corrected**, since that is no longer true
and it is exactly the kind of stale claim this project's reviews catch; Tasks 2/4 are re-pointed at the
new commit; the retro-E5 matrix (§9) is **untouched** and stays `OPEN`.

---

## 5. Implementation Handoff

**Scope: Moderate.** Backlog and AC reorganisation; no rollback; no new or removed epic; no code change.

| Recipient | Deliverable |
|---|---|
| **Developer agent (`correct-course` applier)** | §§4.1–4.9 — the `epics.md` amendments, the `D46` record, the `sprint-status.yaml` handover |
| **Developer agent (`dev-story`, Story 6.3)** | §4.10, then re-run Task 2 against the new source commit and proceed to Task 4. `record-prod-image.yml` needs no change |
| **Oleg** | Approve this proposal; own Story 6.9's new AC (the product-code import); merge every PR |

**Sequencing.** §§4.1–4.9 land first, on their own branch, as the nine prior proposals did. Story 6.3
resumes only after — its ACs are being rewritten underneath it, and re-running Task 2 against the old
text would produce evidence against a superseded criterion.

**Success criteria.**

1. `epics.md` states, in FR31, FR32, Story 6.3's AC1/AC4 and Story 6.9's ACs, what will actually be
   built and deployed — with no surviving sentence claiming the cutover image is the running commit or
   that the cutover is a no-op.
2. Story 6.9 carries a **named, owned** precondition covering the product-code gap.
3. `D46` records the reversal with both of Oleg's decisions quoted verbatim, and states plainly which
   half of §2.4 is measured and which is not.
4. No frozen artifact is edited: `build.yml`, `record-preprod-candidate.yml`, `deploy-stand.yml`,
   `RVC-v1.1`, `docs/preprod-candidates.md` and the two regulations are untouched by this proposal.

**What this proposal deliberately does NOT do.**

- It does not settle *when* the traffic switch happens — Story 6.9's, and it is now gated.
- It does not import anything into Forgejo, and does not decide how that import happens.
- It does not touch `docs/production-approval-regulation.md`. Story 6.3 already owns one dated
  amendment to it under its own §12 exception; adding a second from here would take a §12 exception
  this proposal has not priced.
- It does not re-open Option C or NFR11.
