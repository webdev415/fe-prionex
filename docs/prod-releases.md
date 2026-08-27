# PRODUCTION release approvals

Append-only ledger, one row per approved PRODUCTION release. This is the **authoritative record** of
who approved a production release, when, and against which validated candidate — this project has no
issue tracker (`_bmad-output/implementation-artifacts/sprint-status.yaml:72-73`:
`project_key: NOKEY`, `tracking_system: file-system`; the word
"tracker" appears once in the whole plan, in Story 6.2's own AC2), and a record that lives only in a
job log is not readable when it is needed on this instance. 🔴 **Stated precisely, code review
2026-08-25:** archival here is **delayed, not absent** — that was settled 2026-08-16
(`deferred-work.md`, Story 3.3's section: `log_in_storage` counted **4128 `t` against 461 `f`**, and
the rows Story 2.1 called permanently absent are `t` today, written over a day later). What is real
is the **six** `log_in_storage=f` observations across Stories 5.3 and 5.4 (`epics.md:3150`;
`docs/migration-decisions.md:4751`) — a log that may not be readable at the moment an approval must
be checked. That is enough to keep the record in a file, and it is the only claim made here.

The same three-tier model `docs/preprod-candidates.md` established applies here: the registry tag carries identity and
permanence, **this file is the authoritative human-readable record**, and the job log is best-effort
only. See `docs/production-approval-regulation.md` for the rule this file's rows exist to satisfy, and
`docs/migration-decisions.md#d42` for why "the tracker" resolved to this file rather than to anything
else.

**A row is appended by hand, before the `deploy-prod.yml` dispatch, by whoever records the
approval. A row here is never rewritten or reinterpreted after the fact, even by later events** —
the exact discipline `docs/preprod-candidates.md` states for its own two tables. (`deploy-prod.yml`
is Story 6.4's and does not exist as of 2026-08-25; this file describes how it **will** be used, and
holds no rows until then.)

🔴 **Consequence, stated rather than left to be discovered (code review, 2026-08-25): the row is
appended before the dispatch, so two of its cells cannot yet be known.** `Deploy run id` and
`prod_tag` are written with their `pending` value at append time. `Approval start (UTC)` and
`Approval end (UTC)` are **not** among them — the approval both begins and ends before the dispatch,
so both are real timestamps at append time and neither has a `pending` form. Every
fact that arises **after** the dispatch — the run id, the tag actually deployed, the outcome of the
smoke check Story 6.7 will build (it does not exist as of 2026-08-25), a break of the freeze window,
a rollback recorded after the fact — is carried by a **new
row that names the row it completes** in its `Note`, never by editing the original. A mistaken row is
corrected the same way: by a superseding row, never by deletion. This is what "append-only" costs,
and it is cheaper than a ledger nobody can trust.

**Columns:**

| Column | Meaning | Legal values |
|---|---|---|
| `Date (UTC)` | The date the approval row was appended | any ISO date |
| `image_tag` | The PRE-PROD candidate tag whose **commit** this release promotes | `sha-<12hex>-preprod` — must appear in `docs/preprod-candidates.md`'s `Candidate tag` column, in the validated table and not in `## Rejected candidates` |
| `Candidate` | The candidate's own permanent registry marker (`record-preprod-candidate.yml`'s, not a build tag) | `preprod-<12hex>`, carrying the same commit as `image_tag` |
| `prod_tag` | **The PROD tag this release is identified by afterwards — the value the regulation's rollback rule keys on.** Without it, "a tag already recorded in `docs/prod-releases.md`" has nothing to match against | the tag exactly as dispatched, **recorded verbatim and not normalised**, or `pending — dispatch not yet made`. 🔴 Deliberately not pinned to a shape: PRE-PROD carries **two** (the `sha-<12hex>-preprod` build tag, which is what deploys, and the `preprod-<12hex>` marker, which `record-preprod-candidate.yml:143-148` says is **not** deployable), and which of the matching PROD forms a rollback targets is **Story 6.4/6.6's to settle**. Whatever is dispatched, `deploy-stand.yml:1060-1070`'s tag↔environment guard will refuse a deploy tag not ending `-prod`. 🔴 **SETTLED 2026-08-27 (Story 6.6, [D48](migration-decisions.md#d48)): `prod_tag` is `sha-<12hex>-prod`.** It is the only deployable form — `deploy-prod.yml`'s `derive` job refuses `prod-current` and `prod-<12hex>` outright as *"a RECORD, not a deployable reference"*, so the rollback rule this column exists to serve can only ever key on the `sha-…-prod` form. ⚠️ **The plan conflated two senses of "rollback target" and they are now separated**: `prod-<12hex>` is what **keeps the artifact alive and protected** (without it there is nothing to roll back TO — `keep_pattern` expires the 40-hex sanitized-ref form at 14 days), while `sha-<12hex>-prod` is what a rollback **dispatches**. `#d18` §3 and `deferred-work.md` said only the first and are amended alongside this |
| `Approved by` | Who approved | a name — never a role, never "whoever is around" |
| `Waiver?` | Whether the candidate's `RVC-v1.1` verdict was waived | `none`, or the `D`-number and **both halves of the scope `RVC-v1.1` requires — *"time-boxed AND single-candidate. Both, not either"*** (e.g. `D43, single-candidate, expires <YYYY-MM-DD>` — a placeholder shape, **not** a real waiver: no `D`-number in this repository currently carries an expiry date) — **mandatory, a blank cell is not a valid approval record.** 🔴 Code review 2026-08-25, two passes: the first draft's example carried only `single-candidate`, reproducing the exact omission `#d41` was written to correct; the second draft then illustrated the fix with `D40, single-candidate, expires 2026-09-01`, **inventing a date `D40` and `#d41` do not record** — the precise defect this project has ruled out twice. `D40`'s missing calendar date is a real, open gap owned by `RVC-v2`, and this column must not paper over it with a fabricated example |
| `Approval start (UTC)` | When the approver began reviewing `docs/preprod-candidates.md` | a timestamp — **mandatory**; the freeze window is defined over it, and a blank cell makes the window unverifiable from its own record |
| `Approval end (UTC)` | When the approval was given | a timestamp — **mandatory** (this is the field `RVC-v1.1`'s own Execution Log lacks, and the reason "one continuous session" is unverifiable on the PRE-PROD side) |
| `Deploy run id` | The `deploy-prod.yml` run this approval authorised (Story 6.4's workflow; it does not exist as of 2026-08-25) | `pending — dispatch not yet made` at append time (the row precedes the dispatch, so no run id exists yet); a run id, or `N/A — rollback to a ledger tag, no new approval` per the regulation's rollback rule |
| `Note` | Anything the approver wants on record — a break of the freeze window, an emergency/rollback context, etc. | free text, one line, no pipe character (it would shift every later column, the same rule `RVC-v1.1`'s `validation_note` format states for itself) |

**This table has no rows as of 2026-08-25.** No production release has ever been approved —
`deploy-prod.yml` does not exist yet (Story 6.4). An empty table plus this prose is the whole of it:
no placeholder row is added, because a row here is never rewritten and a placeholder would have to be
the first time this table is genuinely used — the same reasoning `docs/preprod-candidates.md`'s own
"Rejected candidates" table states for itself.

| Date (UTC) | image_tag | Candidate | prod_tag | Approved by | Waiver? | Approval start (UTC) | Approval end (UTC) | Deploy run id | Note |
|---|---|---|---|---|---|---|---|---|---|
