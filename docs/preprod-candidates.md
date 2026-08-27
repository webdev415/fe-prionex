# PRE-PROD validated candidates

Two append-only tables: one row per **successful** `record-preprod-candidate.yml` run (below), and
one row per **refused** run (["Rejected candidates"](#rejected-candidates), added by Story 5.6,
currently scoped to a G1 refusal only — see that section's own note; ⚠️ **G1 was RETIRED on
2026-08-27 by Story 6.11, so that table can take no new rows of the kind it was built for** —
[`#d38`](migration-decisions.md#d38) §6 carries its struck row and its two live runs, 1215 and 1218). This is the
**authoritative human-readable record** of what was validated on PRE-PROD and why — the registry's
own `preprod-<sha>`/`preprod-current` tags carry identity and permanence (Story 6.5 reads those, not
this file), and the workflow's own job log / `$GITHUB_STEP_SUMMARY` are best-effort only (this
instance's logs have failed to archive repeatedly across Stories 5.3 and 5.4; whether step summaries
persist at all here was unverified before this file existed — see Story 5.4's own Review Findings,
code review D1).

🔴 **THE RECORDING PROCEDURE CHANGED ON 2026-08-27 (Story 6.11,
[`#d51`](migration-decisions.md#d51)), AND THE HALF THIS FILE DEPENDS ON IS THE HALF THAT DID NOT
BECOME AUTOMATIC.**

~~As of Story 5.4's code review fix-pass: dispatch `record-preprod-candidate.yml` with
`validated=pass`, confirm it went green, then append the row it prints — "record a candidate" is the
two steps together, not the dispatch alone.~~

**What is true now:**

- **The registry marker is automatic.** A successful `deploy-preprod.yml` run records its own
  candidate — `preprod-<12hex>` and `preprod-current` — with no dispatch of any kind. The
  `validated` input **no longer exists**.
- **This file is still written by a person, after the fact.** No workflow writes it. That is
  unchanged, and it is not an oversight waiting to be closed: `#d51` measured that `main` carries
  `enable_push: false` with an empty push whitelist, so **a direct push is refused for every
  account** and a repository-write credential would not help even if one were granted.
- ⚠️ **So the two halves have come apart.** They used to be minted by the same human act; now the
  marker appears whether or not anyone writes the row. **A missing row no longer implies a missing
  marker.** The workflow's last step still prints a ready-to-paste line in this file's exact
  format — copy it from the automatic run's summary.
- 🔴 **The `Verdict` column no longer derives from a workflow input.** Nothing in any workflow reads
  a verdict any more ([`#d41`](migration-decisions.md#d41)), so `RVC-v1.1` is now carried by **this
  file and `docs/production-approval-regulation.md` alone**, and by no machinery whatsoever. The
  automatic runs print `n/a` in that cell; a human who has actually executed `RVC-v1.1` should
  replace it with the derived verdict and the summary line.
- **`preprod-<sha>` means "this commit reached PRE-PROD", not "was validated."** Story 6.5's
  promotion guard reads it as the weaker statement; FR16 and [`#d2`](migration-decisions.md#d2) were
  narrowed in the same change.

**Rows written before 2026-08-27 are not reinterpreted.** They were recorded under a procedure in
which the marker did imply a claimed verdict, and they remain exactly as written — this ledger is
append-only and rows are never re-judged after the fact, the same discipline the paragraph below
applies to the `RVC-v1` boundary.

**What `pass` in the Verdict column is asserted against, as of 2026-08-24.** Story 5.5 published
`docs/release-validation-checklist.md`, version marker **`RVC-v1`** — twelve numbered flow items
plus two preconditions, each with its own pass criterion — and from its publication onward a row's
verdict is meant to be *derived* from it, with the `Note` cell carrying the `RVC-v1` summary line in
that file's stated format. The two rows below **predate it** and were therefore written against no
stated criterion at all; under `RVC-v1`, as it read on 2026-08-24, neither would have qualified as
`pass` (eight of its twelve items were `BLOCKED` on PRE-PROD Kong's wrong `Access-Control-Allow-Origin`,
owner `CRM/api-prionex`). They are deliberately **not** reinterpreted or rewritten — this ledger is
append-only and rows are never re-judged after the fact, even by later events. This paragraph exists
so a reader comparing the two files sees the mismatch as a dated boundary rather than an unnoticed
defect.

🔴 **Update, closeout re-measurement, 2026-08-25: the CORS blocker named above is fixed.**
`CRM/api-prionex` fixed PRE-PROD's `Access-Control-Allow-Origin`, independently re-measured this
date (non-echo, negative-controlled — see `docs/release-validation-checklist.md`'s own ["The CORS
blocker"](release-validation-checklist.md#the-cors-blocker) for the evidence). This does **not**
retroactively change either row above — they remain exactly as recorded, honest on the date they
were written. What it changes going forward: eleven of `RVC-v1`'s twelve items (all but F9, which
still needs a restricted-role account on PRE-PROD, owner Oleg) are now executable, so a real
browser-path validation is possible for the first time. **Re-validation of a current candidate under
`RVC-v1` is now possible and is the natural next step** — Story 5.6's rehearsal is the first
opportunity to actually append a row derived from a fully-executed checklist rather than the
container-health-only prose these first two rows carry.

🔴 **Corrected, code review of Story 5.6 (2026-08-25): the paragraph below originally read "a
fully-executed `RVC-v1` checklist", items that "passed live" and, further down, "a real `pass`" —
none of the three is accurate. Five of twelve items were never executed at all, and the un-waived
aggregate was `fail`. Fixed below; this is a prose correction, not a row edit — the row itself
(candidate #3, below) is untouched, as is its own `Note` cell, which was never wrong.**

**2026-08-25: Story 5.6's rehearsal wrote the first row derived from an *executed* `RVC-v1`
checklist** (not a fully-executed one) — candidate #3 below. **Nine of `RVC-v1`'s fourteen
executable points were exercised** (the twelve F-items plus P1/P2): six on Oleg Kuksa's own
aggregate browser confirmation — his verbatim answer, and the exact scope that covers, is quoted in
`docs/release-validation-checklist.md`'s Execution Log preamble, not characterised here — and three
(P1, P2, F2) measured directly by the dev agent; F4 item 6 (IP-whitelist) is a tenth point, also
measured directly by the dev agent. **Seven of the twelve `F`-items passed** (F1, F2, F3, F4, F9,
F11, F12); **five are `BLOCKED`** (F5, F6, F7, F8, F10) and were waived under a written,
single-candidate waiver, `docs/migration-decisions.md#d40` — **now legitimized by `#d41`**, which
amended `RVC-v1` to `RVC-v1.1` and gave the waiver mechanism an explicit definition it did not
previously have (D40 itself is not rewritten; `#d41` is a dated amendment). **The un-waived
aggregate verdict was `fail`** by `RVC-v1`'s own unconditional rule (`P=7 ≠ 12`); it was dispatched
as `pass` (not `true` — `validated` has no `true` option, see `record-preprod-candidate.yml:201-207`)
under the waiver alone, not because twelve criteria were met. The note's own `<B>` clause names every
blocked item with its real cause and owner, so this row does not overstate coverage the way the first
two rows (honestly) could not help but predate — but "executed" is the correct word, not
"fully-executed", and the un-waived verdict was `fail`, not a pass by any name. Full per-item detail,
including the reconciliation of the browser-pass's scope: `docs/release-validation-checklist.md`'s
own Execution Log, section `sha-a99ccd44c5a3-preprod — 2026-08-25T13:35Z`, and its preamble note.

| Date (UTC) | Candidate tag | Digest | Verdict | Note | Run id |
|---|---|---|---|---|---|
| 2026-08-24 | `sha-00ef3be4743d-preprod` | `sha256:5e5b190d93c8aaec50f0d50c7e108f502c3d366d14f8a13aee081f0ee396dc8c` | pass | Manual validation, 2026-08-24, against 5.3's run 1198 deploy: container healthy, running .RepoDigests matches sha256:5e5b190d93c8... exactly, TLS serves crm.preprod.crm-prionex.online, Kong resolves by container identity inside the stand's own network (5.2 AC5/D34/D36). Browser-path/API validation NOT performed and not possible — PRE-PROD's Kong CORS is known-broken (static wrong Access-Control-Allow-Origin), external ask to CRM/api-prionex still open. | 1215 |
| 2026-08-24 | `sha-28f7fd36b75e-preprod` | `sha256:d2f6aefc780d6684bd86418298d4068131b7442bf93c3f17de965f40c82f6f26` | pass | Manual validation, 2026-08-24, candidate #2 (main HEAD 28f7fd36b75e, minted D7): stand deployed via D8, container healthy, running .RepoDigests matches sha256:d2f6aefc7... exactly. Same CORS boundary as candidate #1 — browser-path validation not performed, not possible until CRM/api-prionex fixes Access-Control-Allow-Origin. | 1229 |
| 2026-08-25 | `sha-a99ccd44c5a3-preprod` | `sha256:a62e868786cd42811141590f919c632cf559b06ef6045dc44b0b2607bf2086b2` | pass | RVC-v1 sha-a99ccd44c5a3-preprod: 7/12 pass, 5 BLOCKED (F5 F6 F7 F8 F10) (CRM/api-prionex Debt-model migration bug, CRM/api-prionex; no direct debt-creation path, CRM/api-prionex; telephony infrastructure absent, Oleg; 3/7 bulk pages inherit F6, CRM/api-prionex; SMS gateway unconfigured, Oleg) — waiver D40, single-candidate scope — detail in docs/release-validation-checklist.md | 1316 |

**These first two rows were entered by the dev session itself, retroactively, as part of Story 5.4's
own code review fix-pass** (the file did not exist when runs 1215/1229 actually happened — the
recording convention this file establishes is being applied to this story's own already-validated
candidates as its first act, not left for the next candidate to originate it). Every row after these
two should follow the live procedure above: dispatch, confirm green, then append from the run's own
printed line.

## Rejected candidates

<a id="rejected-candidates"></a>

🔴 **New, Story 5.6, AC11; corrected in code review, 2026-08-25 (five issues, M10).**
`record-preprod-candidate.yml`'s **G1** refuses `validated: fail` as the first step of the first
job — the `record` job never runs, so the pass table above never gets a row and a rejected candidate
previously left **no trace anywhere in this file**. This table is that home, **scoped to a G1
refusal specifically** (see the scope note below — it does not yet cover every way a dispatch can be
refused). **Append-only, same as the table above: a row here is never rewritten or reinterpreted
after the fact, even by later events.**

**Chosen reading of AC11's own ambiguous clause** ("if this story's own verdict is `fail`, its own
candidate is the first row in it"), stated explicitly rather than left implicit: this story's
*derived* verdict was `fail`, but its *dispatched* verdict — the one G1 actually sees — was `pass`,
under `D40`/`#d41`'s waiver. A row belongs here only for a dispatch G1 actually refused. This
story's own candidate was never refused, so it is correctly **absent** from this table and present
in the pass table above, not both.

**Known limits, named rather than silently worked around (owner: Story 6.4, folded into
`deferred-work.md`'s M7 entry):**
1. **The `Digest` column has no source for a G1 refusal.** G1 exits before any registry read, so no
   digest exists to record. Until this is resolved, the legal value for that cell on a G1 row is the
   literal text `N/A — refused before any registry read`, not a blank cell and not an invented value.
2. A row here would currently be added by hand from the refused run's own `action_task_step`
   read-back (G1's step name and status — never a job log alone, per this story's own AC13), since a
   refused dispatch prints no ready-to-paste line the way a successful one does.
3. **Scope is G1 only.** A `pass`-verdict run refused later, at **G2-G6**, currently lands in
   neither table — a G5 refusal has already happened once in this project (Story 5.4's own live
   matrix). Extending this table (or adding a third one) to cover G2-G6 refusals is Story 6.4's to
   decide.
4. No owner is yet named to actually perform the row-write when a refusal happens — routed to Story
   6.4 alongside the digest and scope questions above, since it is the story most likely to produce
   one.

**This table has no rows as of 2026-08-25.** Story 5.6's own rehearsal dispatched the recorder once,
with `validated: pass` (dispatched under the waiver — see the corrected paragraph above; the
un-waived aggregate was `fail`, but G1 only ever sees the dispatched value) — G1 was never asked to
refuse anything, so no row exists to add, including no placeholder: an empty table is stated in this
prose, not represented as a row, because a row here is never rewritten and a placeholder row would
have to be rewritten the first time this table is genuinely used.

| Date (UTC) | Candidate tag | Digest | Verdict | Note | Recorder run id (refusal) |
|---|---|---|---|---|---|
