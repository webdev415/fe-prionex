# PRODUCTION release approvals

Append-only ledger, one row per PRODUCTION release. This is the **authoritative record** of which
account dispatched a production release, when, and against which candidate — 🔴 **the words "who
approved" and "validated" were both removed 2026-08-27** ([`#d51`](migration-decisions.md#d51)):
the dispatch **is** the approval, this file records it afterwards, and it attributes an **account**
rather than a person — this project has no
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

🔴 **REWRITTEN 2026-08-27** ([`#d51`](migration-decisions.md#d51),
`_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-27-approval-automation.md`).
~~A row is appended by hand, before the `deploy-prod.yml` dispatch, by whoever records the
approval.~~ **Rows are GENERATED, after the dispatch, from `action_run`.** Eight of the ten columns
are read from the instance over the REST API; `Waiver?` and `Note` are merged from a human side-file
keyed by run id. Story 6.12 builds the generator.

**Why a generated file is still the authoritative record.** The reason this file exists is that a
record living only in a job log is not readable when it is needed (six `log_in_storage=f`
observations, Stories 5.3/5.4). **`action_run` rows are not job logs** and are not subject to that;
they are the same surface `retro-D4` already blessed — *ledgers close by query*. What the file adds
is durability past whatever `action_run`'s retention turns out to be.

**A row here is still never rewritten or reinterpreted after the fact, even by later events** — the
exact discipline `docs/preprod-candidates.md` states for its own two tables. Regeneration is
idempotent because its inputs are immutable run records; a correction is still a **new row**, never a
deletion or an edit.

🟢 **What this DELETES.** The `pending — dispatch not yet made` values for `prod_tag` and
`Deploy run id` are gone — the row is written when both are known. So is the requirement that every
post-dispatch fact arrive as a **superseding row naming the row it completes**: that protocol existed
only because the row preceded the dispatch. Append-only is unchanged; what goes away is that the
*ordinary* release needed two rows.

🔴 **What this COSTS, on the face of the file rather than in a decision record.** Measured 2026-08-27
across all 717 runs in this repository: `trigger_user` takes exactly two values — `platform-admin`
(705) and `forgejo-actions` (12). **There is no per-person attribution on this instance.** The
`Approved by` column is renamed `Dispatched by (account)` and **does not say which person acted** —
it cannot distinguish Oleg from the agent, which dispatch through the same admin account. See
`docs/production-approval-regulation.md`, `## How the approval is recorded`.

⚠️ **Open, to be measured before this file is first generated:** `action_run` retention on this
instance. The committed output is the archive, but the horizon must be a **measured number, not an
assumption** — `#d38` §9's retention rule, never observed either deleting or keeping anything, stands
here as the precedent for why.

🔴 **SUPERSEDED 2026-08-27 ([`#d51`](migration-decisions.md#d51)) — kept because it records why the
machinery below existed, and the machinery is what got deleted.** ~~Consequence, stated rather than
left to be discovered (code review, 2026-08-25): the row is
appended before the dispatch, so two of its cells cannot yet be known.~~ `Deploy run id` and
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
| `prod_tag` | **The PROD tag this release is identified by afterwards — the value the regulation's rollback rule keys on.** Without it, "a tag already recorded in `docs/prod-releases.md`" has nothing to match against | the tag exactly as dispatched, **recorded verbatim and not normalised**, ~~or `pending — dispatch not yet made`~~ 🔴 **that legal value is REMOVED 2026-08-27** ([`#d51`](migration-decisions.md#d51)) — the row is generated after the dispatch, so the tag is always known; source is `event_payload.inputs.tag`, verbatim. 🔴 Deliberately not pinned to a shape: PRE-PROD carries **two** (the `sha-<12hex>-preprod` build tag, which is what deploys, and the `preprod-<12hex>` marker, which `record-preprod-candidate.yml:143-148` says is **not** deployable), and which of the matching PROD forms a rollback targets is **Story 6.4/6.6's to settle**. Whatever is dispatched, `deploy-stand.yml:1060-1070`'s tag↔environment guard will refuse a deploy tag not ending `-prod`. 🔴 **SETTLED 2026-08-27 (Story 6.6, [D48](migration-decisions.md#d48)): `prod_tag` is `sha-<12hex>-prod`.** It is the only deployable form — `deploy-prod.yml`'s `derive` job refuses `prod-current` and `prod-<12hex>` outright as *"a RECORD, not a deployable reference"*, so the rollback rule this column exists to serve can only ever key on the `sha-…-prod` form. ⚠️ **The plan conflated two senses of "rollback target" and they are now separated**: `prod-<12hex>` is what **keeps the artifact alive and protected** (without it there is nothing to roll back TO — `keep_pattern` expires the 40-hex sanitized-ref form at 14 days), while `sha-<12hex>-prod` is what a rollback **dispatches**. `#d18` §3 and `deferred-work.md` said only the first and are amended alongside this |
| `Dispatched by (account)` | 🔴 **RENAMED 2026-08-27** from `Approved by` ([`#d51`](migration-decisions.md#d51)). The account that dispatched the release. **Not a person** — see the header | `trigger_user.login`, read from `action_run`. In practice `platform-admin` for every run this instance has ever recorded. The rule that an approver is **a name — never a role, never "whoever is around"** is unchanged as a rule and is stated in `docs/production-approval-regulation.md`; this column simply stops claiming to record one |
| `Waiver?` | Whether the candidate's `RVC-v1.1` verdict was waived. ⚠️ **Human-only — carried in the side-file keyed by run id, not derivable from any run record**, and since 2026-08-27 no workflow reads the verdict at all ([`#d41`](migration-decisions.md#d41)) | `none`, or the `D`-number and **both halves of the scope `RVC-v1.1` requires — *"time-boxed AND single-candidate. Both, not either"*** (e.g. `D43, single-candidate, expires <YYYY-MM-DD>` — a placeholder shape, **not** a real waiver: no `D`-number in this repository currently carries an expiry date) — **mandatory, a blank cell is not a valid approval record.** 🔴 Code review 2026-08-25, two passes: the first draft's example carried only `single-candidate`, reproducing the exact omission `#d41` was written to correct; the second draft then illustrated the fix with `D40, single-candidate, expires 2026-09-01`, **inventing a date `D40` and `#d41` do not record** — the precise defect this project has ruled out twice. `D40`'s missing calendar date is a real, open gap owned by `RVC-v2`, and this column must not paper over it with a fabricated example |
| `Dispatch start (UTC)` | 🔴 **RENAMED 2026-08-27** from `Approval start (UTC)`. When the `deploy-prod.yml` run started — the freeze window's opening event since [`#d51`](migration-decisions.md#d51) | the run's `started`, read from `action_run`. 🟢 Machine-recorded, so the window is now verifiable from the instance rather than from the approver's own account of when they began reading |
| `Deploy end (UTC)` | 🔴 **RENAMED 2026-08-27** from `Approval end (UTC)`. When the run stopped | the run's `stopped`, read from `action_run`. ⚠️ This is **not** the freeze window's closing event — the window closes on the smoke job's outcome (`#d50`), which may differ |
| `Deploy run id` | The `deploy-prod.yml` run this row records | `index_in_repo`, read from `action_run` (this is the number the UI shows, e.g. **705**; the API's `id` is a different, larger number — 1618 for that same run). 🔴 **The `pending — dispatch not yet made` legal value is REMOVED 2026-08-27** — the row is generated after the dispatch, so the run id is always known. `N/A — rollback to a ledger tag, no new approval` remains legal per the regulation's rollback rule |
| `Note` | Anything to put on record — a break of the freeze window, an emergency/rollback context, etc. ⚠️ **Human-only, carried in the side-file.** A freeze-window break lives here, because a break is by definition not derivable from a run record | free text, one line, no pipe character (it would shift every later column, the same rule `RVC-v1.1`'s `validation_note` format states for itself) |

**How to regenerate this file** (Story 6.12):

```sh
FORGEJO_TOKEN=$(tr -d '"\r\n' < ~/.config/forgejo/token) npm run ledger:prod
```

**Read scope is enough — never hand it the registry RW token.** It writes only the region between
the `BEGIN/END GENERATED LEDGER` markers below; everything outside them is hand-written prose and a
missing marker is a hard failure rather than a full-file overwrite. Two consecutive runs produce a
byte-identical file. `npm run ledger:prod -- --self-test` runs its fixtures and touches no network.

**The two cells no machine can know** — `Waiver?` and `Note` — come from
`docs/prod-releases-annotations.json`, keyed by the **deploy run id** (the number the UI shows, not
the API's own `id`). A run with no entry renders empty cells and the generator still exits 0: a
missing annotation is the normal case for a fresh release.

⚠️ **"Generated" does not mean "committed automatically."** `#d51` §2 measured that `main` carries
`enable_push: false` with an empty push whitelist, so **no workflow can commit this file** and the
repository-write credential Story 5.4 declined would not have helped. A person runs the command and
merges the diff. What the tooling removes is the transcription, not the human.

🔴 **THE LEDGER HAS AN EPOCH, AND 21 EXISTING DISPATCHES ARE DELIBERATELY NOT ROWS HERE**
(Story 6.12, 2026-08-27). `action_run` holds **21 `deploy-prod.yml` dispatches**, nine of them
successful. **Every one is a rehearsal or a proof, not a release** — `#d47` and `#d48` record them
in those words, and two of the three permanent PROD images they produced are described there as
*"доказательства, не релизы"*.

The generator excludes every run started before **`2026-08-27T11:58:58Z`**, the merge of
[`#d51`](migration-decisions.md#d51) (commit `89ddca51`). That instant is the boundary **on the
merits and not for tidiness**: *"the dispatch IS the approval"* became true when that commit landed,
so a dispatch made before it was not an approval of anything. The latest of the 21 (run 705) started
`08:58:22Z`, hours earlier.

⚠️ **Without that cut the generator would manufacture a 21-row release history into a file whose
next sentence says it has none.** That is the single worst thing this tooling could do, and the
epoch is a named constant in `scripts/gen-prod-ledger.mjs` with the commit in its comment — not a
bare literal someone can "clean up".

**This table has no rows as of 2026-08-27.** No production release has ever been approved.
`deploy-prod.yml` now exists (Story 6.4) and has been dispatched several times, but every one of
those runs was a rehearsal or a proof, not a release — see `#d47` and `#d48`. 🟢 **That this file was
still empty is what made 2026-08-27's change cheap: nothing recorded is being reinterpreted, and a
rule is being changed before its first use rather than after.** An empty table plus this prose is the whole of it:
no placeholder row is added, because a row here is never rewritten and a placeholder would have to be
the first time this table is genuinely used — the same reasoning `docs/preprod-candidates.md`'s own
"Rejected candidates" table states for itself.

<!-- BEGIN GENERATED LEDGER -- do not edit between these markers; see scripts/gen-prod-ledger.mjs -->

| Date (UTC) | image_tag | Candidate | prod_tag | Dispatched by (account) | Waiver? | Dispatch start (UTC) | Deploy end (UTC) | Deploy run id | Note |
|---|---|---|---|---|---|---|---|---|---|
| 2026-08-27 | `prod-current` | `—` | `prod-current` | platform-admin |  | 2026-08-27 14:41:49Z | 2026-08-27 14:41:51Z | 744 | **ROLLBACK** — restoring a tag already recorded here is not a new release and needs no new approval (see the regulation). NOT an approval row. |
| 2026-08-27 | `sha-cfbad1797d5e-prod` | `preprod-cfbad1797d5e` | `sha-cfbad1797d5e-prod` | platform-admin |  | 2026-08-27 14:59:11Z | 2026-08-27 15:03:11Z | 747 |  |
| 2026-08-27 | `sha-14ebdecb6d88-prod` | `preprod-14ebdecb6d88` | `sha-14ebdecb6d88-prod` | platform-admin |  | 2026-08-27 18:09:45Z | 2026-08-27 18:13:27Z | 766 |  |
| 2026-09-07 | `sha-e8d8fc15c067-preprod` | `—` | `sha-e8d8fc15c067-preprod` | platform-admin | none | 2026-09-07 18:11:03Z | 2026-09-07 18:25:21Z | 932 | Release of preprod-branch head e8d8fc15c067 (merge PR #115 main->preprod). PROD image sha-e8d8fc15c067-prod digest sha256:c99d87fd395356c17da35ded38bd4c1710762151902a584e025b742d76540c30; prod-current now resolves to the same digest. Run 932 green end to end (derive, guard, build, deploy, smoke, record). Public https://crm.prod.crm-prionex.online returns 200, the served bundle carries VITE_API_BASE_URL_PROD and a missing asset returns 404. RVC-v1.1 was NOT executed for this candidate: no pass/fail verdict exists, only the technical preprod-e8d8fc15c067 marker, and no waiver was issued; dispatched on Oleg's direct instruction. Rollback target: sha-14ebdecb6d88-prod digest sha256:5d705a9fdb713466bc56125444f6417d183b29ba4aa6b2a2c5a696d1b790433f from run 766. |

<!-- END GENERATED LEDGER -->
