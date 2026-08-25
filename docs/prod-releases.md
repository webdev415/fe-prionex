# PRODUCTION release approvals

Append-only ledger, one row per approved PRODUCTION release. This is the **authoritative record** of
who approved a production release, when, and against which validated candidate — this project has no
issue tracker (`_bmad/bmm/config.yaml`: `tracking_system: file-system`, `project_key: NOKEY`; the word
"tracker" appears once in the whole plan, in Story 6.2's own AC2), and this instance's job logs do not
reliably archive (`log_in_storage='f'` on seven consecutive checks). The same three-tier model
`docs/preprod-candidates.md` established applies here: the registry tag carries identity and
permanence, **this file is the authoritative human-readable record**, and the job log is best-effort
only. See `docs/production-approval-regulation.md` for the rule this file's rows exist to satisfy, and
`docs/migration-decisions.md#d42` for why "the tracker" resolved to this file rather than to anything
else.

**A row is appended by hand, before the `deploy-prod.yml` dispatch, by whoever records the approval.
A row here is never rewritten or reinterpreted after the fact, even by later events** — the exact
discipline `docs/preprod-candidates.md` states for its own two tables.

**Columns:**

| Column | Meaning | Legal values |
|---|---|---|
| `Date (UTC)` | The date the approval row was appended | any ISO date |
| `image_tag` | The exact `preprod-<sha>` tag being promoted | must exist in `docs/preprod-candidates.md` |
| `Candidate` | The candidate's own registry marker | `preprod-<12hex>`, matching `image_tag`'s commit |
| `Approved by` | Who approved | a name — never a role, never "whoever is around" |
| `Waiver?` | Whether the candidate's `RVC-v1.1` verdict was waived | `none`, or the `D`-number and its scope (e.g. `D40, single-candidate`) — **mandatory, a blank cell is not a valid approval record** |
| `Approval start (UTC)` | When the approver began reviewing `docs/preprod-candidates.md` | a timestamp |
| `Approval end (UTC)` | When the approval was given | a timestamp |
| `Deploy run id` | The `deploy-prod.yml` run this approval authorised | a run id, or `N/A — rollback to a ledger tag, no new approval` per the regulation's rollback rule |
| `Note` | Anything the approver wants on record — a break of the freeze window, an emergency/rollback context, etc. | free text, one line, no pipe character (it would shift every later column, the same rule `RVC-v1.1`'s `validation_note` format states for itself) |

**This table has no rows as of 2026-08-25.** No production release has ever been approved —
`deploy-prod.yml` does not exist yet (Story 6.4). An empty table plus this prose is the whole of it:
no placeholder row is added, because a row here is never rewritten and a placeholder would have to be
the first time this table is genuinely used — the same reasoning `docs/preprod-candidates.md`'s own
"Rejected candidates" table states for itself.

| Date (UTC) | image_tag | Candidate | Approved by | Waiver? | Approval start (UTC) | Approval end (UTC) | Deploy run id | Note |
|---|---|---|---|---|---|---|---|---|
