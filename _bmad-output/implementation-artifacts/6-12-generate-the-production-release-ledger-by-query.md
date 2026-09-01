---
baseline_commit: 58708ec7
---

# Story 6.12: Generate the production release ledger by query

Status: in-progress

## Story

As the production release record,
I want `docs/prod-releases.md` **derived from `action_run`** instead of typed by hand,
so that every cell the instance already knows is read from the instance, and the only cells left to a person are the two no machine can know.

---

## 🟢 The measurement that was supposed to gate this story is DONE, and it does not gate it

The proposal and `#d51` §10 both said: **measure `action_run` retention first; that number gates the
rest of the story.** It was measured on 2026-08-27, during story creation, directly against the
Forgejo database on s1. Do not re-measure it as Task 1 — read this instead, then verify the one
clause marked ⚠️.

| Question | Measured answer |
|---|---|
| Do run rows outlive their logs? | 🟢 **Always.** 2082 `action_task` rows carry `log_in_storage=false`, and **all 2082** still have a live `action_run` row. Zero exceptions. |
| Has any log actually *expired*? | **No.** `log_expired=true` count is **zero**. The 2082 missing logs are this instance's known **delayed archival**, not retention. |
| Has any run row been deleted from this repo? | 🟢 **No.** `repo_id=16` holds indexes **1 → 732, count 732 — no gaps.** The very first run this repository ever had is still there. |
| Is a retention policy configured? | **No.** `app.ini` has **no `[actions]` section and no `RETENTION`/`cleanup` keys at all** — Forgejo's defaults apply, and its `cleanup_actions` cron touches **logs and artifacts**, never run rows. |

**This is exactly the property `#d51` §3 needed and argued for. It is now measured.**

⚠️ **The honest limit, and the one thing left to verify.** The instance is ~27 days old, so "nothing
has been deleted" is consistent with both *"rows are never deleted"* and *"rows would be deleted at
some horizon nobody has reached yet"*. The config carries no such key, and Forgejo's cleanup job is
documented against logs and artifacts — but **`#d38` §9 is this project's standing lesson about
exactly this shape of claim** (a retention rule verified by reading the rule rather than by watching
it act). Task 1 is therefore reduced from *"measure it"* to *"confirm against Forgejo's source or
docs that `cleanup_actions` cannot delete `action_run` rows, and record the answer in `#d51` §10"*.

---

## 🔴 The finding that changes this story's shape

`docs/prod-releases.md` says, on its own face: **"This table has no rows as of 2026-08-27. No
production release has ever been approved."**

There are **21 `deploy-prod.yml` dispatches** in `action_run`. Nine succeeded. **Every one of them is
a rehearsal or a proof** — `#d47` and `#d48` say so explicitly (*"три перманентных продовых образа,
из них два — доказательства, не релизы"*).

**A generator that emits every dispatch would manufacture a 21-row release history into a ledger
whose own prose says it has none.** That is the single worst thing this story can ship, and AC4
exists for it.

```
idx  when (+02:00)      status   inputs
629  2026-08-26 13:56   failure  {"image_tag":"sha-a99ccd44c5a3-prod","rollback":"true"}
632  2026-08-26 14:18   failure  {"image_tag":"sha-a99ccd44c5a3-prod","rollback":"true"}
634  2026-08-26 14:21   SUCCESS  {"image_tag":"sha-a99ccd44c5a3-prod","rollback":"true"}
637  2026-08-26 14:25   failure  {"image_tag":"sha-28f7fd36b75e-preprod","rollback":"false"}
639  2026-08-26 14:34   failure  {"image_tag":"sha-00ef3be4743d-preprod","rollback":"false"}
640  2026-08-26 14:43   failure  {"image_tag":"sha-308ea1520c59-preprod","rollback":"false"}
                        ─── #d47's rename lands between 640 and 642 ───
642  2026-08-26 15:05   SUCCESS  {"rollback":"true","tag":"sha-a99ccd44c5a3-prod"}
643  2026-08-26 15:18   failure  {"rollback":"true","tag":"sha-a99cc…129e9-prod"}   ← 40 hex, refused
644  2026-08-26 15:18   failure  {"rollback":"true","tag":"prod-current"}           ← a record, refused
662  2026-08-27 06:05   SUCCESS  {"rollback":"true","tag":"sha-a99ccd44c5a3-prod"}
667  2026-08-27 06:11   SUCCESS  {"rollback":"true","tag":"sha-308ea1520c59-prod"}
668  2026-08-27 06:13   SUCCESS  {"rollback":"true","tag":"sha-a99ccd44c5a3-prod"}
676  2026-08-27 06:55   SUCCESS  {"rollback":"true","tag":"sha-a99ccd44c5a3-prod"}
679  2026-08-27 07:08   SUCCESS  {"rollback":"true","tag":"sha-a99ccd44c5a3-prod"}
687  2026-08-27 07:53   failure  {"rollback":"false","tag":"sha-308ea1520c59-prod"}  ← 6.5's guard refusal
689  2026-08-27 07:55   failure  {"rollback":"false","tag":"sha-a99ccd44c5a3-preprod"}
691  2026-08-27 08:01   SUCCESS  {"rollback":"true","tag":"sha-a99ccd44c5a3-prod"}
698  2026-08-27 08:42   failure  {"rollback":"true","tag":"sha-a99ccd44c5a3-prod"}
699  2026-08-27 08:44   failure  {"rollback":"true","tag":"sha-a99ccd44c5a3-prod"}
702  2026-08-27 08:48   failure  {"rollback":"true","tag":"sha-a99ccd44c5a3-prod"}
705  2026-08-27 08:58   SUCCESS  {"rollback":"true","tag":"sha-a99ccd44c5a3-prod"}
                        ─── #d51 lands on main 13:58:58 (89ddca51) — the epoch ───
```

**Two things fall straight out of that table and neither was in the proposal:**

1. 🔴 **The input was RENAMED mid-history.** Six runs carry `inputs.image_tag`; fifteen carry
   `inputs.tag`. That is `#d47`(3)'s fix landing between runs 640 and 642. **A generator reading one
   name silently blanks the other set.** AC3.
2. 🟢 **A precise epoch exists.** `#d51` merged to `main` at **`2026-08-27T11:58:58Z`**, commit
   **`89ddca51`** — hours after the latest of the 21. A cut at that instant excludes all of them
   without a judgement call, and it is the correct boundary on the merits: *the dispatch is the
   approval* only became true when that commit landed. AC4.

---

## Acceptance Criteria

### AC1 — The retention question is closed in writing, not left open

**Then** `#d51` §10 carries the measured answer above (2082/2082 rows outlive their logs; `repo_id=16`
indexes 1→732 with no gaps; `log_expired=0`; no retention key in `app.ini`),
**And** `deferred-work.md`'s *"`action_run` retention is UNMEASURED, and it gates Story 6.12"* entry
is **closed with its measurement**, not deleted,
**And** ⚠️ the remaining clause — that Forgejo's `cleanup_actions` cannot delete run rows — is either
confirmed against its source/docs or **recorded as still argued rather than observed**, in `#d38`
§9's exact spirit.

### AC2 — A generator exists, run by a person, opening no new credential

**Given** `#d51` §2 measured that `main` carries `enable_push: false` with an **empty push whitelist**, so a direct push is refused for every account, admin included,
**Then** the generator is a **script in this repository, run by a person**, whose output is committed through the ordinary PR flow,
**And** it needs only **read** access to `/actions/runs` — the scope any repository member already has,
**And** 🔴 **no repository-write credential is created, requested, or documented as a future step.** Story 5.4 declined that class; `#d51` measured it would not have worked.

> **"Generated" means DERIVED, not committed automatically — say so in the file.** The human act
> shrinks from *"type ten cells correctly"* to *"run one command and merge the diff"*. It does not
> vanish, and a reader who expects it to vanish will conclude the tool is broken.

### AC3 — 🔴 Both input names are read, and the reason is in the code

**Given** runs 629–640 carry `inputs.image_tag` and runs 642–705 carry `inputs.tag` (`#d47`(3)'s rename),
**Then** the generator reads **`inputs.tag ?? inputs.image_tag`**, with a comment naming the rename and the run numbers on each side of it,
**And** a run carrying **neither** is not silently blanked — it is reported.

### AC4 — 🔴 The ledger has an EPOCH, and no rehearsal is ever presented as a release

**Given** all 21 existing `deploy-prod.yml` dispatches are rehearsals and proofs (`#d47`, `#d48`),
**And** *"the dispatch is the approval"* became true only when `#d51` merged,
**Then** the generator excludes every run started before **`2026-08-27T11:58:58Z`** (commit `89ddca51`),
**And** the epoch is a **named constant with that commit in its comment**, never a bare literal,
**And** `docs/prod-releases.md` states in prose that the pre-epoch dispatches exist, are recorded in `#d47`/`#d48`, and are **deliberately not rows here**.

### AC5 — The `event` field is never the filter

**Given** the API reports `event: ""` for **every** dispatch — measured across all 717 runs, the count reporting `workflow_dispatch` is **zero**,
**Then** the generator selects on `workflow_id == 'deploy-prod.yml'` **and** the presence of an `inputs` key in `event_payload`,
**And** a comment says that filtering on `event` yields an **empty ledger**, so the next reader does not "simplify" it back.

### AC6 — Pagination walks to natural termination

**Given** the API caps `limit` at **50** regardless of what is requested,
**Then** the generator walks until a page comes back empty, and **asserts** the walked count against the reported `total_count`,
**And** 🔴 it **fails loudly** on a mismatch rather than emitting a short ledger. In this project a truncated read has produced a **wrong conclusion five times**; a silently short release ledger is the worst instance of that class.

### AC7 — The run number is `index_in_repo`, not `id`

**Given** run **705** in the UI is `id` **1618** in the API,
**Then** `Deploy run id` renders `index_in_repo`, and a comment names that pair as the worked example.

### AC8 — Only the table is regenerated; the prose is preserved byte-for-byte

**Given** `docs/prod-releases.md` is mostly load-bearing prose — the three-tier model, the `#d51` amendments, the column semantics, the warning that the `Dispatched by` cell names an account and not a person,
**Then** the generated region is delimited by marker comments and **everything outside them is byte-identical before and after**,
**And** a missing marker is a hard failure, never a silent full-file overwrite.

### AC9 — Idempotent

**Then** two consecutive runs with no new dispatches produce a **byte-identical** file, verified by hash.

### AC10 — The two human cells come from a side-file and never fail the run

**Then** `Waiver?` and `Note` are merged from a side-file keyed by **run id**,
**And** a run with no entry renders **empty cells and succeeds** — a missing annotation is the normal case for a fresh release, not an error,
**And** the side-file's own format forbids the pipe character, for the reason `docs/prod-releases.md` already states about its `Note` column.

### AC11 — The account column says what it is, in the generated output

**Then** every generated row's `Dispatched by (account)` carries the account verbatim (`trigger_user.login`),
**And** the file states — as it already does in prose — that this **names an account, not a person**, and cannot distinguish Oleg from the agent.

### AC12 — Rollback dispatches are emitted and labelled, never omitted

**Given** the regulation says restoring a tag already in the ledger *"is not a new release and needs no new approval"*,
**Then** a `rollback: true` dispatch still produces a row — omitting it would lose the record of what production actually ran —
**And** the row is **labelled** as a rollback, so it is not read as a new approval.

### AC13 — 🔴 The only test available today: the ledger must come out EMPTY, and green

**Given** there are **zero** qualifying runs after the epoch,
**Then** running the generator today produces a table with **no rows**, exits **0**, and leaves the file's prose untouched,
**And** the run reports how many dispatches it examined and how many it **excluded by epoch** — so an empty ledger is visibly *"21 examined, 21 pre-epoch, 0 rows"* and never an indistinguishable *"found nothing"*.

> This is the discriminating test the story actually has. Everything else is exercised against
> synthetic input until the first real release. **Say that in the story's outcome matrix** rather
> than grading the untested paths as met.

---

## Tasks / Subtasks

- [x] **Task 1 — Close the retention question (AC: 1)**
  - [x] 1.1 Confirm against Forgejo's own source or documentation that `cleanup_actions` deletes logs and artifacts and **not** `action_run` rows. If it cannot be confirmed, say so in those words.
  - [x] 1.2 Record the measured numbers in `#d51` §10 and close `deferred-work.md`'s entry **with** its measurement.

- [x] **Task 2 — The generator (AC: 2,3,5,6,7,12)**
  - [x] 2.1 `scripts/gen-prod-ledger.mjs`, Node only, **no new dependency** (Node 22 locally, `node-20` on the runner; global `fetch` on both). Wire it as an `npm run` script alongside the existing ones.
  - [x] 2.2 Token from an env var the operator supplies from `~/.config/forgejo/token`. **Read scope only.** Never the registry RW token.
  - [x] 2.3 Walk `/actions/runs` to natural termination; assert walked == `total_count`; fail loudly on mismatch (AC6).
  - [x] 2.4 Filter: `workflow_id` + `inputs` present in `event_payload`. Never `event` (AC5).
  - [x] 2.5 Tag: `inputs.tag ?? inputs.image_tag`, comment the rename (AC3).
  - [x] 2.6 Map the eight machine cells. `Deploy run id` ← `index_in_repo` (AC7). Label rollbacks (AC12).

- [x] **Task 3 — The epoch (AC: 4)**
  - [x] 3.1 Named constant `LEDGER_EPOCH = '2026-08-27T11:58:58Z'`, comment naming commit `89ddca51` and why that instant.
  - [x] 3.2 Count and report exclusions.
  - [x] 3.3 Prose in `docs/prod-releases.md`: the 21 pre-epoch dispatches exist, are `#d47`/`#d48`'s, and are deliberately not rows.

- [x] **Task 4 — Render safely (AC: 8,9,10,11)**
  - [x] 4.1 Marker comments; hard-fail on a missing marker; prose byte-identical outside them.
  - [x] 4.2 Side-file merge by run id; missing entry ⇒ empty cells, exit 0.
  - [x] 4.3 Idempotence check by hash.

- [x] **Task 5 — Earn what can be earned (AC: 13)**
  - [x] 5.1 Run it for real: expect `21 examined, 21 pre-epoch, 0 rows`, exit 0, prose untouched.
  - [x] 5.2 Synthetic fixtures for the paths no real run can reach yet: a post-epoch success, a rollback, a run with a side-file entry, a run with neither input name, a `total_count` mismatch.
  - [x] 5.3 Outcome matrix: **label every path exercised only synthetically as such.** Do not grade a synthetic pass as a live row.

- [x] **Task 6 — Record it**
  - [x] 6.1 New decision entry for the generator's contract (epoch, filter, both input names, what the account column does not claim).
  - [x] 6.2 `deferred-work.md` for anything found and not fixed.

---

## Dev Notes

### 1. Files

| Path | State | Note |
|---|---|---|
| `scripts/gen-prod-ledger.mjs` | **NEW** | 🔴 **`scripts/` does not exist yet** — this story creates it. There is no `bin/` or `tools/` either. |
| `package.json` | UPDATE | one `scripts` entry, matching the existing naming style |
| `docs/prod-releases.md` | UPDATE | markers + the epoch prose. **Its prose is load-bearing and was rewritten two days ago by `#d51` — do not regenerate it, do not summarise it, do not tidy it.** |
| `docs/prod-releases-annotations.*` | **NEW** | the side-file for `Waiver?`/`Note` |
| `docs/migration-decisions.md` | UPDATE | `#d51` §10 (AC1) + the new entry (Task 6.1) |
| `_bmad-output/implementation-artifacts/deferred-work.md` | UPDATE | close the retention entry with its answer |

### 2. The ledger's current columns, after `#d51`

```
| Date (UTC) | image_tag | Candidate | prod_tag | Dispatched by (account) |
  Waiver? | Dispatch start (UTC) | Deploy end (UTC) | Deploy run id | Note |
```

Eight are machine-derivable; `Waiver?` and `Note` are not. `Candidate` derives from the tag's own 12
hex (`#d18` §3 — the short SHA is **exactly 12 hex**, and Stories 5.4/6.3/6.5/6.6 are all bound to
that width).

### 3. What a run record actually contains

Worked example, run **705** = API `id` **1618**:

```json
{ "id": 1618, "index_in_repo": 705, "workflow_id": "deploy-prod.yml",
  "trigger_user": { "login": "platform-admin", "is_admin": true },
  "commit_sha": "ff236c89beca…", "prettyref": "story-6-7/impl",
  "status": "…", "started": "…", "stopped": "…",
  "event": "",
  "event_payload": "{\"inputs\":{\"rollback\":\"true\",\"tag\":\"sha-a99ccd44c5a3-prod\"}, …}" }
```

⚠️ `event_payload` is a **JSON string inside JSON** — parse it, do not regex it. (A regex was used
during story creation to *survey* the 21 runs; that is not a licence to ship one.)

### 4. Traps, each already paid for by this project

| Trap | Evidence |
|---|---|
| `event` is `""` for all dispatches; the `workflow_dispatch` count is **zero** | measured across all 717 runs |
| The input name **changed mid-history** (`image_tag` → `tag`) | runs 629–640 vs 642–705; `#d47`(3) |
| `limit` caps at 50 whatever you ask | packages, tasks and runs endpoints alike |
| A truncated read has produced a **wrong conclusion five times** here | including one that made every marker look deleted |
| `index_in_repo` ≠ `id` | 705 vs 1618 |
| `trigger_user` has exactly two values across 717 runs | `platform-admin` 705, `forgejo-actions` 12 |
| Job **logs** are frequently unreadable; **run rows** are not logs | 2082 logs gone, 2082 rows alive |

### 5. Not this story

- **Any repository-write credential.** Measured useless (`#d51` §2) and declined by Story 5.4.
- **A workflow that runs the generator.** It could not commit the result; a scheduled run that
  produces something nobody can land is machinery pretending to be automation. If the cadence ever
  matters, that is a separate decision with the retention number in hand — and that number is now
  *unbounded so far*, which weakens the case for it rather than strengthening it.
- **Touching `docs/preprod-candidates.md`.** Story 6.11 left it prose-only on purpose and filed the
  question. PRE-PROD is not in scope here.
- **Backfilling the 21 rehearsals.** AC4 forbids it.

### 6. Method

**Read from the instance, not from a log.** Job status via `action_run_job` on s1 (the REST
`/runs/{id}/jobs` endpoint **404s** on this instance); logs off disk via `action_task.log_filename`
under `/opt/forgejo/forgejo/gitea/actions_log/`. **Never diagnose by re-dispatching** — Story 6.7
burned four red runs doing that, and Story 6.11's two defects were both found by reading, not
guessing.

⚠️ **And one Story 6.11 lesson that applies directly here:** `yaml.safe_load` passing is not the
same as a schema accepting. The analogue for this story is that **JSON parsing successfully is not
the same as the ledger being correct** — AC9's byte-identical check and AC13's explicit exclusion
count are what actually catch a wrong ledger.

### Project Structure Notes

- ⚠️ **`epics.md` carries no Story 6.12 section.** Opened by correct-course 2026-08-27; its spec is
  `#d51` plus `sprint-change-proposal-2026-08-27-approval-automation.md` §5. Stated so a reviewer
  looking for epic AC text knows it is absent by construction, not by omission.
- No `src/`, no application code, no workflows. A new `scripts/` directory, one `package.json` line,
  and documentation.
- Branch: `story-6-12/impl`, cut from `origin/main` at `14068f3a`.

### References

- [Source: docs/migration-decisions.md#d51] — §2 (why no credential), §3 (the eight columns), §4 (the account ceiling), §5 (the `event` trap), §10 (retention, this story closes it)
- [Source: docs/migration-decisions.md#d47] — (3) the input rename that AC3 exists for
- [Source: docs/migration-decisions.md#d48] — the prod dispatches are proofs, not releases
- [Source: docs/migration-decisions.md#d18] — §3, the short SHA is exactly 12 hex
- [Source: docs/migration-decisions.md#d38] — §9, the standing lesson about retention verified by reading rather than watching
- [Source: docs/prod-releases.md] — the file being generated; its prose must survive intact
- [Source: docs/production-approval-regulation.md] — `## How the approval is recorded`, `## Rollback authority` (AC12)
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-27-approval-automation.md] — §5, Story 6.12's scope



### Review Findings

**Code review 2026-08-27, inline.** ⚠️ **The adversarial-parallel structure was NOT run** — the three
independent layers need subagents, which were disabled. **One reviewer, same model that wrote the
code.** Floor, not ceiling.

🔴 **Two findings are HIGH, and both would make the ledger wrong on its FIRST REAL ROW.** The file
has zero rows today, so neither has a live consequence yet — which is precisely why they are worth
fixing now rather than discovering on release day.

- [ ] [Review][Patch] **`image_tag` and `prod_tag` render the IDENTICAL value, and `image_tag`'s own spec forbids what lands there** [scripts/gen-prod-ledger.mjs:218,220] — both emit `cell(tag)`, the tag as dispatched, which is a **`-prod`** tag. But `docs/prod-releases.md`'s column table defines `image_tag` as *"The PRE-PROD candidate tag whose **commit** this release promotes"*, legal value **`sha-<12hex>-preprod`**, and *"**must appear in `docs/preprod-candidates.md`'s `Candidate tag` column**"*. So every future row would violate that column's stated legal values, and anyone following the cross-reference would search the PRE-PROD ledger for a `-prod` tag and find nothing. 🟢 `prod_tag` is correct — verbatim as dispatched, which is what the regulation's rollback rule keys on. **Fix:** derive `sha-<hex>-preprod` from the same 12 hex. ⚠️ **State the rollback rule explicitly rather than deriving blindly:** a rollback promotes no candidate, so its `image_tag` is `—`, not a fabricated preprod tag.
- [ ] [Review][Patch] **A FAILED post-epoch deploy renders a row indistinguishable from a successful release** [scripts/gen-prod-ledger.mjs] — `run.status` is read **nowhere** (the only `status` in the file is the HTTP status inside `api()`). A production deploy that fails after the epoch produces a row with a populated `Deploy end (UTC)` and **nothing saying it failed**. Under `#d51` the dispatch IS the approval, so a failed attempt genuinely belongs in the ledger — but presenting it as a completed release is the worst direction for **this** file to be wrong in, and it is the file the regulation calls the authoritative record of what production ran. **Fix:** carry `run.status` into the row — the `Note` column is the natural home, alongside the existing `**ROLLBACK**` label.
- [ ] [Review][Patch] **The `Waiver?` cell renders BLANK by default, and the column's own spec calls a blank cell invalid** [scripts/gen-prod-ledger.mjs:222] — that column's legal values end with *"**mandatory, a blank cell is not a valid approval record.**"* AC10 deliberately chose *missing annotation ⇒ empty cell, exit 0*, and the annotations README says the generator *"cannot enforce that and does not pretend to"* — but the result is a generated file whose rows the file's own column table calls invalid, with **nothing visible flagging them**. Rendering `⚠️ MISSING` costs one string and makes the gap self-announcing instead of silent.
- [ ] [Review][Patch] **26 fixtures, and not one asserts the column contract** [scripts/gen-prod-ledger.selftest.mjs] — the suite checks mechanics: which input name wins, the epoch in both directions, the rollback label, `index_in_repo` vs `id`, row order, pipe escaping, fatal short reads. It never checks **what value lands in which column**. That is exactly the gap the first finding above fell through: **the suite would pass with `image_tag` and `prod_tag` swapped, or with both blank.** Add a fixture asserting a full rendered row against the column table, cell by cell.
- [x] [Review][Defer] **`api()` has no request timeout** [scripts/gen-prod-ledger.mjs] — deferred, cosmetic. A hung connection blocks a human-run script indefinitely; there is no automation depending on it finishing.


## Outcome matrix (Task 5.3, `retro-E5`)

🔴 **Exactly ONE path is proven live. Everything else is fixture, and is labelled, not graded.**

| Path | Live | Fixture | Note |
|---|---|---|---|
| all dispatches pre-epoch → empty ledger, exit 0 | 🟢 **yes** — `21 examined, 21 pre-epoch, 0 rows`, prose untouched | — | the only live path available until the first real release |
| walked count == `total_count` | 🟢 **yes** — 733/733 | — | |
| idempotence | 🟢 **yes** — two runs byte-identical | — | |
| prose outside markers preserved | 🟢 **yes** — head and tail byte-identical, 12 953 bytes | — | |
| missing marker → hard failure | 🟢 **yes** — exit **1**, file untouched | — | |
| no token / bad token → hard failure | 🟢 **yes** — exit **1** both | — | |
| legacy `image_tag` read (runs 629–640) | — | ✅ | **no live row is possible**: every run carrying it is pre-epoch by construction |
| current `tag` read | — | ✅ | |
| post-epoch release renders a row | — | ✅ | ⚠️ **unprovable until a real release exists** |
| rollback emitted **and labelled** | — | ✅ | |
| side-file merge by run id | — | ✅ | |
| missing annotation → empty cells, exit 0 | — | ✅ | |
| neither input name → **reported**, not blanked | — | ✅ | |
| rows oldest-first (API order reversed) | — | ✅ | 🟢 **verified to discriminate**: with `rows.reverse()` disabled the check goes red |
| `event` filter rejected | — | ✅ | |
| exactly-12-hex derivation (`#d18` §3) | — | ✅ | negatives use runs 643/644's real shapes |
| pipe / newline cannot shift a column | — | ✅ | |
| short read → **fatal** | — | ✅ | |

**24 fixtures, no network, `npm run ledger:prod -- --self-test`.**

🔴 **One fixture was written as a tautology** — `... ? true : true`, which cannot fail. Caught before
shipping and replaced with a real assertion, then **verified to discriminate** by disabling
`rows.reverse()` and confirming it goes red. This project has withdrawn a can-never-fail comparison
once already (`#d48`'s "half by digest"); a second is not shipped.


## Dev Agent Record

### Agent Model Used

Opus 5 (1M context). ⚠️ Off the standing convention (`dev-story` on Sonnet) — run `code-review` on a
different model.

### Debug Log References

No dispatches. Everything is a local run or a read of the instance.

- `npm run ledger:prod` — live, four times. `21 examined, 21 pre-epoch, 0 rows`, exit 0, 733/733.
- `npm run ledger:prod -- --self-test` — 24 fixtures, no network.
- Failure paths exercised for their **exit codes**, not just their messages: missing marker, absent
  token, bad token — all **1**. ⚠️ A first attempt read the exit code through a pipe and got
  `tail`'s status instead; redone.
- Repo gates: `npm run lint` and `npm run format:check` both clean.
- Retention answered against the instance's own cron registry, not by reading Forgejo's source.

### Completion Notes List

**All tasks complete.** The story shipped what it said, and the two findings that shaped it were
found during story creation rather than here — which is the intended order.

**Task 1 turned out better than "confirm from source".** The story allowed recording the
`cleanup_actions` question as *argued rather than observed*. It did not have to be: Forgejo splits
the work across **two** crons, and this instance's own registry settles it by observation —
`cleanup_actions` (logs and artifacts) has executed **26** times, and `delete_old_actions` (**the run
records themselves**) has schedule `-` and **0 executions**, with `prev` and `next` both
`0001-01-01`. The only job that could delete an `action_run` row is **off and has never run**.

⚠️ **Named as what it is:** a configuration state, not a platform guarantee. Turning
`delete_old_actions` on makes the ledger's horizon finite that same day, and the generated file is
the archive for exactly that case. `#d38` §9 is the precedent and the entry says so.

**One defect of my own, caught before shipping.** A self-test check read `... ? true : true` and
could not fail. Replaced, and then **proved to discriminate** by disabling `rows.reverse()` and
watching it go red. A test that cannot fail is worse than no test — it reports confidence it did not
earn.

**What is deliberately NOT claimed.** Exactly one path is live. The row-rendering paths — the ones
that matter on the day of the first real release — are fixture-only and **cannot** be live until that
release exists. The matrix labels them; none is graded as met.

**No new credential class.** No workflow. No scheduled job. `#d51` §2 measured that `main` refuses a
direct push from every account, so a scheduled generator would produce something nobody could land —
machinery pretending to be automation.

### File List

- `scripts/gen-prod-ledger.mjs` — **NEW**
- `scripts/gen-prod-ledger.selftest.mjs` — **NEW**
- `docs/prod-releases-annotations.json` — **NEW**
- `package.json` — MODIFIED (one `scripts` entry)
- `docs/prod-releases.md` — MODIFIED (markers, epoch prose, how-to)
- `docs/migration-decisions.md` — MODIFIED (`#d51` §10 closed; `#d52` added; index; anchor range)
- `_bmad-output/implementation-artifacts/deferred-work.md` — MODIFIED (retention entry closed **with** its measurement)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — MODIFIED
- `_bmad-output/implementation-artifacts/6-12-generate-the-production-release-ledger-by-query.md` — MODIFIED

## Change Log

| Date | Change |
|---|---|
| 2026-08-27 | dev-story: all tasks complete, status → review. Task 1 settled by OBSERVATION rather than source-reading — `delete_old_actions` (the only cron that deletes run rows) has schedule `-` and 0 executions, while `cleanup_actions` has run 26 times without removing anything. Live: 21 examined, 21 pre-epoch, 0 rows, 733/733, idempotent, prose intact, three failure paths exit 1. 24 fixtures for the paths no live run can reach. One self-test check was a tautology, caught and replaced with one proven to discriminate. |
| 2026-08-27 | Story created by create-story. Two findings during analysis that were NOT in the proposal: the dispatch input was renamed mid-history (`image_tag`→`tag`, runs 640/642), so a generator reading one name blanks the other set; and all 21 existing prod dispatches predate `#d51`, so a naive generator would manufacture a 21-row release history into a ledger whose own prose says it has none — hence the epoch (AC4). The retention measurement that was supposed to gate the story was performed during creation: nothing has ever been deleted (2082/2082 rows outlive their logs, indexes 1→732 with no gaps, no retention key in `app.ini`). |
