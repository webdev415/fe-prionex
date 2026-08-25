<!-- Story 6.2. Epic 6's FIRST story (6.1 is cancelled). Written 2026-08-25 by the create-story
     context engine, from a scratchpad worktree off fresh origin/main.
     READ THE WHOLE "Read this before anything else" BLOCK BEFORE THE FIRST TASK.
     §2 is the decision this story exists to get right — whether to extend Story 5.6's shipped
     document or write a new one — and it is already decided, with the argument, in §2. §3 is the
     ordering finding: this story writes about controls that DO NOT EXIST YET, and its own AC1
     forbids describing a control that does not exist. Those two sentences are in tension by
     construction and §3 says how to hold both. §11 states what this story may not touch. -->

# Story 6.2: Publish the Production Approval Regulation

Status: review

## Story

As a tech lead,
I want the production approval rules written down before the first Forgejo release,
So that the absence of a technical gate is a managed decision rather than an unnoticed gap.

---

## 🚨 Read this before anything else

### 1. What this story is, in one paragraph

Forgejo has no equivalent of GitHub Environments with required reviewers. That was established on
day one, accepted rather than deferred, and recorded twice — `docs/forgejo-migration.md` §1.3 and
`docs/migration-decisions.md#d5`. 🔴 **Corrected, code review 2026-08-25: only `#d5` names story
6.2** (*"правило пишется в регламент (story 6.2)"*). §1.3 says only *"Это надо принять осознанно и
записать в регламент"* — no story number appears in it. The rule still lands here; the citation was
overstated. So the control on a production release is organizational, and this story is that
control: **one page saying who may approve a production release, what must be true before approval
is even sought, how the approval is recorded so it is auditable later, and what happens at the
edges — the freeze window, rollback, and an emergency.** This story writes **no workflow code**, runs
**no dispatch**, and touches **no host**. Its deliverables are one new document, one new empty
append-only ledger, one decision record, two one-line cross-references into documents other stories
own, and one acknowledgement that only a human can give.

**This is Epic 6's first story.** 6.1 is `cancelled` (no action is taken on GitHub), so nothing in
this epic has run yet. That has a consequence this story cannot wish away and §3 handles head-on:
almost every technical thing the regulation must describe — `deploy-prod.yml`, the promotion guard,
`rollback: true`, the s10 contour — **does not exist on 2026-08-25.**

### 2. 🔴 THE OVERLAP DECISION — extend 5.6's document, or write a new one

**This is the first thing a dev agent will get wrong, and it was decided here rather than left open.**

Story 5.6 shipped `docs/release-regulation.md` on 2026-08-25 (merged in PR #86) to satisfy Epic 5's
AC4. It is 75 lines. Its title is **`# PRE-PROD Release Regulation`**. Its own opening sentence says
what it is:

> *"**One page. No new gate, no new machinery.** This document states what already exists (five
> workflow legs, already shipped) and one agreement between people (scope freeze) that nothing in
> this repository enforces. Written by Story 5.6, AC4/AC10; absorbed later by Epic 7's own
> Deployment Process document, not the reverse."*
> — `docs/release-regulation.md:3-6`

Its four sections are: `The five legs` (the PRE-PROD cycle: `build.yml` → `deploy-preprod.yml` →
`RVC-v1.1` → `record-preprod-candidate.yml` → `docs/preprod-candidates.md`), `The scope-freeze
agreement` (four numbered points about a **PRE-PROD** validation window), and `Where the record
lives` (three pointers, all PRE-PROD).

**Decision: write a SEPARATE document, `docs/production-approval-regulation.md`.** The reasoning, in
full, because the decision has to survive a reviewer asking "why two files?":

1. **Different subject.** 5.6's document is about *what was already built and one agreement not to
   redeploy mid-validation*. This one is about *authority*: who may approve, who may break a freeze,
   who may roll back, who may declare an emergency. Not one sentence of 5.6's document answers any of
   those, and not one of this story's four ACs is served by anything in it.
2. **Different environment, and the title says so.** A production approval rule filed inside a
   document titled *PRE-PROD Release Regulation* is where nobody will look for it. Epic 6's whole
   premise is that PROD is a different host (s10, not s1), a different contour, a different risk.
3. **AC4 is an act performed against a named document.** *"the development and release teams have
   acknowledged it."* Acknowledgement has to attach to something with a stable identity and a stable
   scope. Bolting a production section onto a document that was already published for a different
   purpose makes "what was acknowledged" ambiguous the moment anyone asks.
4. **5.6's document is a just-shipped artifact of another story, and this project freezes those.**
   `docs/release-validation-checklist.md` (5.5's) was frozen by 5.6's own §12 to append-only. The
   same discipline applies here by precedent, and it is the reason the ONLY edit this story makes to
   `docs/release-regulation.md` is **one cross-reference line** — a pointer, not a rewrite.
5. **Epic 7 absorbs both anyway.** `docs/release-regulation.md:5-6` already says Story 7.3's
   Deployment Process document absorbs it "not the reverse". Two clean, single-scope inputs are a
   better handover to 7.3 than one document with two identities.

**And the other half of the instruction, which matters just as much: do not duplicate what 5.6
wrote.** The production document **cites** 5.6's document and `RVC-v1.1` by link for the five legs,
the scope-freeze argument, and the "the recorder is not an approval gate" reasoning. It **restates
nothing**. Where the production rule genuinely differs from the PRE-PROD one (the freeze window's
endpoints, the authority to break it), it says *how it differs* and links to the original, rather
than copying the original and editing it. **A reviewer will diff the two files: any sentence that
appears in both, other than a link, is a defect.**

Anti-pattern, named because it is the tempting middle path: **do not "harmonise" the two documents
by moving 5.6's scope-freeze section into a shared file.** That is a rewrite of a shipped artifact
dressed as refactoring, it costs a re-review of Epic 5's AC4, and it is out of scope.

### 3. 🔴 THE ORDERING FINDING — this story describes controls that do not exist, and its own AC1 forbids that

**Measured, this session, against `origin/main` at `dbec399d`:**

| Thing the regulation must describe | Exists on 2026-08-25? | Owner story |
|---|---|---|
| `.forgejo/workflows/deploy-prod.yml` | ❌ **No.** `ls .forgejo/workflows/` returns 11 files; `deploy-prod.yml` is not among them. | 6.4 |
| The commit-identity promotion guard (FR16) | ❌ **No.** `docs/migration-decisions.md#d2` header reads verbatim: *"**Статус: спроектировано, не реализовано — обновить в story 6.5.**"* | 6.5 |
| `rollback: true` as a dispatch input | ❌ **No** — it is an input of the workflow that does not exist. | 6.4 |
| The PROD deploy contour on s10 | ❌ **No.** 6.10, which `sprint-status.yaml` records **MUST complete before 6.4**. | 6.10 |
| The rebuilt `prod-current` / `prod-<sha>` cutover image | ❌ **No.** | 6.3 |
| "anyone with write access can dispatch it" | ⚠️ **Inherited, not measurable here** — see the evidence table in §9. | — |

**AC1's second clause is a trap:** *"And it does not describe any technical control that does not
exist."* Read literally against the table above, almost the whole regulation is unwritable. Read as
intended — and this reading is the one the epic's own user story supports (*"written down **before
the first Forgejo release**"*) — it forbids **claiming a control is in place**, not forbidding a
dated forward reference. **The rule this story adopts, and it is a Prohibition below:** every
reference to an unbuilt control is written in a **dated, explicitly-forward form** with its owning
story named — *"Story 6.5 will build a guard that …; as of 2026-08-25 no such guard exists"* — and
**never in the present tense.** A present-tense sentence about `deploy-prod.yml` in this document is
a defect, not a style preference.

**Was the order right? Yes — 6.2 goes first. But two dependencies are real and are handled in-story,
not assumed away.** The finding, for the record:

- **`sprint-status.yaml` states exactly one ordering constraint inside Epic 6** — `6-10` before
  `6-4`, *"same precedent as 1.13 before 1.12"*. **Nothing constrains 6.2**, and **6.2 has no
  dependency on 6.3 or on 6.10**: neither the s10 contour nor the rebuilt cutover image changes who
  may approve a release or how the approval is recorded. Checked, not assumed.
- **The one real forward dependency is on 6.5, and it is a loop.** 6.2 AC3 requires the regulation to
  describe what the promotion guard does and does not prove — which it takes from `#d2`. 6.5's own
  last AC requires that *"the Option C technical debt record from Story 1.2 is reviewed … updated to
  describe the guard as implemented"*. So **6.5 rewrites the source this document quotes.** The
  regulation must therefore carry a **dated citation with a named revision owner** (*"as `#d2` reads
  on 2026-08-25; Story 6.5 updates it when the guard ships, and this section is revised then"*),
  never a bare quote that silently goes stale. That is cheap here and expensive later.
- **Two later stories consume what this one writes**, which is a further argument for its position:
  `epics.md:2903` — Story 7.3's own Given clause is *"**Given** the production approval rules from
  Story 6.2"* — and `epics.md:2849` routes a decommissioning step to be handled *"under the
  regulation in Story 6.2"*. Writing it late would leave both dangling.
- **6.2 could equally have run after 6.4/6.5, and that would be worse**, not better: NFR9's entire
  point is that the organizational control is what exists *instead of* a technical gate. Running 6.2
  after 6.4 means the capability to dispatch a production deploy exists before the rule governing it.
  The document being ahead of the machinery is the intended state.
- **AC4 is an external human dependency and the story cannot close without it.** *"the development
  and release teams have acknowledged it"* is an act only Oleg can perform or delegate, and it has
  **exactly the shape Story 1.6's unsent requirement had**. The project's rule for that shape is
  written down twice and **should be cited in those words rather than paraphrased into a slogan**:
  `#d11` — *«**Обязательство по дате: отсутствует.** Не «ожидается» — требование не отправлено,
  поэтому ответа не может быть в принципе. Дата, выведенная из сроков спринта или порядка эпиков,
  была бы выдуманной»* — and `deferred-work.md`'s own conventions block: **"Owners are NAMES or
  STORY NUMBERS, never trigger conditions."** Together: **a request with no channel, no named
  recipient and no owner creates no obligation and no date; an owner that is a condition rather than
  a name is a defect signal.** So the acknowledgement is asked on **day one** (Task 1.4), as one
  message through the coordinator, with a named owner and a recorded date — not discovered at
  closeout. ⚠️ **And the same rule turns back on the regulation itself: an approval whose approver is
  "whoever is around" is, by this project's own convention, not an approval — which is why §5 item 1
  names a person, not a role.**
  **HALT mapping** (the `sprint-status.yaml` enum has no `blocked` value):
  if the acknowledgement has not arrived when everything else is done, this row **STAYS
  `in-progress`** and the blocking condition is named in the comment immediately above it. It is not
  flipped to `done`, not to `backlog`, and not to a value the enum does not define.

### 4. 🔴 "The tracker" does not exist — AC2's one unresolvable word, and what replaces it

AC2: *"it names who approves a production release, **and where that approval is recorded in the
tracker**."* `#d5` says the same: *"апрув фиксируется в трекере"*.

**Measured:** 🔴 **the file named here was wrong, and the error shipped — corrected by code review
2026-08-25.** `_bmad/bmm/config.yaml` carries **neither** key (it is fourteen lines: `user_name`,
the two artifact paths, the two languages, `user_skill_level`, `project_knowledge`).
`tracking_system: file-system` and `project_key: NOKEY` live in
`_bmad-output/implementation-artifacts/sprint-status.yaml:72-73`. **The conclusion is unchanged and
independently re-verified — there is no tracker — but this line said "Measured" about a file that
was never opened, and both `docs/prod-releases.md` and `D42` §2 inherited the citation from here.**
The string `tracker` appears in `_bmad-output/planning-artifacts/epics.md`
**exactly once — in Story 6.2's own AC**, re-confirmed by `grep -rn -i tracker` over the whole of
`planning-artifacts/`. There is no Jira project, no issue tracker of any kind
carrying this migration's work. Every ledger this project has built — `docs/preprod-candidates.md`,
`docs/migration-decisions.md`, `deferred-work.md` — is a file in this repository.

**And there is a second, harder reason the record cannot live in a run log:** this instance **does
not reliably archive job logs.** `log_in_storage = 'f'` has been observed on the same two tasks
across **seven consecutive checks over six sessions and three stories**, with no trend toward
archival, and `$GITHUB_STEP_SUMMARY` persistence here is recorded **UNPROVEN** even after a real
dispatch exercised it. `docs/preprod-candidates.md` exists *because of* that finding — it is Story
5.4's code-review D1, resolved into a three-tier model (registry = identity and permanence;
**the file = the authoritative human-readable record**; job log = best-effort). An approval record
that survives only in a run log is not a record.

**Decision: the approval record is a new append-only file, `docs/prod-releases.md`, created empty by
this story** with its header, its column definitions and a prose statement that it has no rows —
**exactly** the shape 5.6 used for the "Rejected candidates" table (*"an empty table is stated in
this prose, not represented as a row, because a row here is never rewritten and a placeholder row
would have to be rewritten the first time this table is genuinely used"*,
`docs/preprod-candidates.md:118-123`). AC2's *"the approval record must reference the specific
`image_tag`"* becomes a mandatory column. `#d5`'s word "трекер" is read as "the project's own
durable record", and the substitution is **recorded in the new decision record**, not made silently.

⚠️ **Do not create the ledger's first row.** No production release has been approved. An empty table
plus one prose sentence is the whole of it.

### 5. What the regulation must actually say — assessed item by item

Each item below was assessed against what this project's own history argues for; the verdict column
is binding. **The target is one page that gets read, not a manual that does not** — 5.6's document is
75 lines at `dbec399d` (79 after this story's own cross-reference line lands) and that is the
benchmark, not a floor.

| # | Candidate content | Verdict | Where its substance comes from |
|---|---|---|---|
| 1 | **Who may approve a production release** | ✅ **IN — AC2.** Oleg, as the release's owner. Not a role, a name — the same authority `RVC-v1.1`'s waiver section already states as a rule (*"Only **Oleg, as the release's owner**"*). Reuse that authority, do not invent a second one. | `docs/release-validation-checklist.md`, `## The waiver` |
| 2 | **How the approval is recorded, auditably** | ✅ **IN — AC2.** One row in `docs/prod-releases.md`, appended before the dispatch, carrying the `image_tag`. §4. | `docs/preprod-candidates.md` precedent |
| 3 | **What must be true before approval is even sought** | ✅ **IN.** A recorded candidate exists (`preprod-<sha>` in the registry), its `RVC-v1.1` Execution Log section is written, and its row in `docs/preprod-candidates.md` is appended — with its **derived** verdict and **any waiver** visible. | `RVC-v1.1`; Epic 5's shipped cycle |
| 4 | 🔴 **The waiver is invisible at the promotion gate — so the approver reads the ledger, not just the tag** | ✅ **IN, and this is the single most valuable sentence in the document.** `RVC-v1.1` says it outright: a waiver *"carries no signal at the registry … so a promotion gate reading only the registry cannot tell a waived candidate from a clean one"*. 6.5's guard checks that `preprod-<sha>` **exists**. It cannot see that seven of twelve items passed and five were waived. **A rule that the approver must read `docs/preprod-candidates.md` before approving is a policy fix for a gap no technical fix in 6.5 closes** — and it does not step on 6.5's work. | `docs/release-validation-checklist.md`, `## The waiver`, last paragraph |
| 5 | **What the approver attests vs what the machine proved** | ✅ **IN — AC3, and it is 5.6's own distinction applied one environment up.** The machine proves *"a `preprod-<sha>` tag exists for this commit"*. It does **not** prove the artifact was validated — under Option C the PROD image is a **separate build, byte-different** from the one PRE-PROD served. `#d2`'s own sentence is the one to quote: *"зелёная валидация на PRE-PROD — это свидетельство об исходном коде, а не о байтах, которые поедут в прод."* The approver attests to the **decision to release**; the machine attests to **commit identity**; nobody attests to the bytes. | `docs/migration-decisions.md#d2`; NFR11 |
| 6 | **The freeze window, and who may break it** | ✅ **IN.** Distinct from 5.6's PRE-PROD freeze and stated **as a difference, with a link**, not as a copy. PRE-PROD's window runs P1 → recorder. **PROD's window runs from the approval row being appended to the smoke check passing** (6.7), and inside it no other dispatch targets the PROD stand. Who may break it: **only Oleg, and the break is recorded in the ledger** — 🔴 by a superseding row,
not by editing the original, which is append-only (code review 2026-08-25). | `docs/release-regulation.md`, `## The scope-freeze agreement` (link, do not copy) |
| 7 | **Rollback authority** | ✅ **IN, and it needs its own rule precisely because the guard is skipped.** FR16/`#d2`: *"При `rollback: true` гейт пропускается — намеренно"*. So a rollback dispatch has **no** technical barrier at all. The rule: **restoring a tag already present in `docs/prod-releases.md` is not a new release and needs no new approval** — it returns the system to a state already approved — **but it is recorded in the ledger after the fact.** A rollback to a tag **not** in the ledger is a release and needs Oleg. 🔴 **And one sentence of honest small print, because it is what makes rollback authority meaningful at all: rollback depends on the previous `prod-<sha>` tag still existing, and the retention rule that is supposed to protect it has NEVER been observed deleting — or keeping — anything.** `#d38` §9 marks it **UNPROVEN by execution**; the first date it can be observed is **2026-08-29** and that dated item still has **no owner**. Compounding it, `#d7`: every pre-migration image lives in ghcr and is unreachable, so **the rollback horizon starts at zero at cutover** and Story 6.8 must be proven **before** the first real release, not after. | `#d2`, `#d38` §9, `#d7`, FR24, Stories 6.6/6.8 |
| 8 | **How an emergency / hotfix differs** | ✅ **IN, and the honest answer is that there is no forward hotfix path today.** A hotfix that skips PRE-PROD has no `preprod-<sha>`, so 6.5's guard refuses it. The emergency procedure is therefore **(1) roll back, (2) fix through the normal cycle.** If a genuine forward hotfix is ever unavoidable it requires a `preprod-<sha>`, i.e. an abbreviated `RVC-v1.1` run under **Oleg's written waiver — `RVC-v1.1`'s existing mechanism, not a second one invented here.** Reuse; do not duplicate. | `RVC-v1.1` `## The waiver`; FR16 |
| 9 | 🔴 **Two production stands will serve at once, and the document must say which is authoritative** | ✅ **IN — one short section.** 6.1 is cancelled: GitHub still deploys to s2 on a merge to `main`. NFR5 **as amended 2026-08-18** makes the guarantee absolute — *"Forgejo never deploys to s2 at all"* — so the two pipelines target **different hosts**, and between Story 6.9's no-op deploy and the external traffic switch **both stands are live**. The regulation states which one users are on and that a Forgejo release changes nothing for them until the switch. | epics.md Epic 6 preamble; Story 6.9's 2026-08-18 amendment; NFR5 |
| 10 | 🔴 **The approver records his own start and end time** | ✅ **IN — one line, and it repairs a hole the PRE-PROD side could not.** `RVC-v1.1`'s Execution Log has a `Started (UTC)` field and **no end-time field**, so *"one continuous session" is unverifiable from the record that governs it*, and the human validator's own observations carry **no timestamp anywhere** — meaning they cannot be placed inside the P1-to-recorder bracket the scope freeze is defined over, *"they almost certainly were, but by inference."* **This document's own freeze window (item 6) has exactly the same shape, so the ledger row carries both timestamps and the hole does not repeat.** *(Fixing `RVC-v1.1` itself is `RVC-v2`'s — not touched here.)* | `deferred-work.md`, `RVC-v2` item |
| 11 | 🔴 **The approval record must state the waiver explicitly, in a defined place** | ✅ **IN — it is item 4's enforcement half.** The shipped `validation_note` carries a `— waiver <Dnn>, <scope> —` clause **that `RVC-v1.1`'s Format block does not define**, so *"the next waived note may legally omit it and **hide a waiver**"* — an open `RVC-v2` item. The production ledger does not inherit that hole: **`Waiver?` is a mandatory column with a defined legal value** (`none`, or the `D`-number with its scope), and a row with the cell blank is not a valid approval record. | `deferred-work.md`, `RVC-v2` item; §4 |
| 12 | 🔴 **What the neighbouring team's PROD gate does, and honestly how ours compares** | ✅ **IN — two sentences, no more.** `CRM/api-prionex` already gates its own production promotion: manual `workflow_dispatch` with an **explicit release sha, never derived from a branch head**, and `ops/deploy/validate-preprod-digests.sh` comparing the **digests of the containers actually running on PRE-PROD** against the release manifest — *"Digests, not tags: a tag can be moved, a digest cannot. **There is no bypass flag.**"* Ours proves **commit** identity and has a bypass (`rollback: true`). Epic 6.5's own AC requires our guard to be positioned as **the frontend half of that existing pattern**, not an independent mechanism. **Saying so in the regulation is honesty about our own weaker position; building their check is 6.5's, not this story's.** | `deferred-work.md`; epics.md Story 6.5 AC2 |
| 13 | Tag protection, and whether the `v*` rule belongs here | ⚠️ **NAMED, NOT DECIDED — routed to Oleg as an Open Question.** `deferred-work.md` asks in so many words whether the tag rule (*"cut `v*` only from commits carrying `.forgejo/workflows/"*) *"belongs in the Story 6.2 production-approval regulation (Story 1.13's Open Question 5)"*, and records that **there is no tag protection at all**. 🔴 **But `#d18`/`#d20` dropped semver outright — zero tags of any kind exist in this repository and no story consumes one** — so a rule about cutting `v*` tags would govern nothing. **Recommendation: it does not belong here.** Recorded as Open Question 4 rather than silently dropped, because the question was asked of this story by name. | `deferred-work.md`; `#d18`, `#d20` |
| 14 | `secrets: inherit`, `KONG_PORT` on PROD, M7's eight unexercised recorder branches | ❌ **OUT — named in §7, resolved nowhere.** These are engineering decisions owned by 6.4. An approval regulation that tries to settle them is scope creep, and `#d33` §6 DN1 says `secrets: inherit` is a decision required **before Story 6.4 starts**, not during it. | §7 |
| 15 | A new gate, a new checklist, a new machine-readable format, a notification step | ❌ **OUT.** 5.6's document closes with *"This document adds no gate and no machinery. It states an agreement, not a control."* Same posture here. NFR9 is the reason there is no gate to add; **Story 4.5 being parked is the reason there is no notification to describe** — today the approval and the deploy outcome reach a human only if someone pastes a log excerpt, and the standing rule from four stories is that **no deploy story may block on the channel** (§7 item 5). | `docs/release-regulation.md`'s closing line (`:75` at `dbec399d`, `:79` after this story's edit); `deferred-work.md` |

### 6. Previous story intelligence — what Epic 6 inherits, verified this session

Verified against `origin/main` @ `dbec399d`, `sprint-status.yaml`'s own "WHAT EPIC 6 INHERITS" block,
and the shipped files themselves. **This story consumes all of it read-only.**

- **`preprod-current` → `sha-a99ccd44c5a3-preprod`**, digest `sha256:a62e8687…`
  (`docs/preprod-candidates.md:74`). **Three** recorded candidates; the file states plainly that the
  registry gives the **set** and **git gives the order** — `preprod-current` **moves backwards
  silently** and recency cannot be inferred from it. *(That is 6.5's problem, not this document's —
  but it is why item 4 above tells the approver to read the ledger.)*
- **`RVC-v1.1`** (`docs/release-validation-checklist.md`, 1088 lines): P1/P2 + twelve items F1-F12,
  a per-item verdict, an unconditional aggregation rule, the `validation_note` format, and — new in
  v1.1, 2026-08-25, `#d41` — an **explicit waiver clause**: who may issue it (**Oleg only**; *"A
  waiver issued by anyone else, including the dev agent that executes this checklist, has no
  effect"*), what it may cover (a `BLOCKED` item, **and** a `fail` arising **solely** from a broken
  external dependency), its mandatory attributes (**date, author, every covered item with cause and
  owner, scope that is time-boxed AND single-candidate, true counts preserved in the note**), and its
  effect: **"the waiver changes what gets dispatched, never what is derived."**
- **`docs/preprod-candidates.md`** — the readable ledger, append-only, two tables (recorded /
  rejected), rows never re-judged after the fact. **This story's `docs/prod-releases.md` is modelled
  on it, deliberately.**
- **`deploy-stand.yml`** — the shared `workflow_call` callee (Story 4.8), with `image_tag` mode and
  the **tag↔environment guard** (a tag must end in `-${IMAGE_ENV}` or the deploy fails before it
  acts — it is what stops a `-dev` tag reaching PROD). 6.4 writes a **thin caller**.
- **`record-preprod-candidate.yml`** — six guards before any registry write; **G1** refuses
  `validated: fail` as the first step of the first job, before any read.
- **The full cycle has been exercised once, end to end** (Story 5.6, 2026-08-25): R1 build.yml run
  1308 → R2 deploy-preprod.yml run 1310 → live validation → R3 recorder run 1316. Wall clock
  **38 min 41 s**. Aggregate **7/12 pass, 5 BLOCKED**, derived verdict `fail`, dispatched `pass`
  **only** under Oleg's written single-candidate waiver `#d40`, legitimised retroactively by `#d41`.
  **That is the concrete history the regulation's item-4 rule exists for.**

### 7. Things pending on Oleg — do not depend on them silently

None of these blocks this story. All are named so the dev agent does not re-discover them, re-ask
them, or quietly build the regulation on top of one.

1. **AC4's acknowledgement** (dev + release teams). **This one the story does depend on** — asked day
   one, Task 1.4, HALT mapping in §3.
2. **The `CRM/api-prionex` Debt-migration bug report** — root cause of `RVC-v1.1` F5's `fail`, the
   defect `#d41`'s new waiver clause was written for. Relay pending with Oleg. Not this story's.
3. **The unrotated seed admin credential on PRE-PROD** — found by 5.6, internet-reachable, owner
   Oleg, open.
4. **DEV's frontend vhost/TLS** — a different ask, owner `aleksey`; it blocks Story **4.9**, which is
   in flight in parallel. Irrelevant to this story's content; relevant to §11.
5. **Story 4.5 (Slack)** — PARKED by Oleg 2026-08-21, context branch unmerged, and the original
   `SLACK_CD_WEBHOOK_URL` is **unrecoverable** (Forgejo secret values are write-only). Epic 6's Story
   6.4 Slack AC is already marked **DEFERRED, does not gate**, and the standing rule four stories
   depend on is *"**the deploy must work without it**"* — 4.3, 4.8, 5.3 and 6.4 are written and closed
   with **no** notification step. **Consequence the regulation states rather than papers over: today
   a PROD deploy's start, success and failure reach a human only if someone pastes a log excerpt by
   hand. The regulation must not make any notification a step in the approval procedure**
   (Prohibition 5).
6. **`secrets: inherit`** — 6.4's mandatory first decision. A PROD caller of the shared callee would
   receive **every org secret, including `REGISTRY_TOKEN_RW`, which has write access over another
   team's packages.** Named here; decided by 6.4.
7. **`KONG_PORT` on PROD — unmeasured since 2026-08-13.** And PROD's Kong has **never been probed for
   the static-CORS defect** that was found on PRE-PROD and then found again on DEV. *"Probe it before
   6.4, not after."*
8. **M7 — eight unexercised branches in `record-preprod-candidate.yml`**, re-owned to Story **6.4** at
   5.6's closeout. Not forced here.
9. 📅 **The registry retention rule has never been observed deleting — or keeping — anything.** The
   first date it can be observed is **2026-08-29**, four days out, and that dated item still has
   **no owner**. Its own escalation clause: *"**Epic 5 and Epic 6 both rely on `keep_pattern`
   protecting `prod-current`/`preprod-current` and on everything else expiring. Escalate rather than
   record.**" And *"do not judge this by the log at all"* — every outcome in the cleanup path is
   `log.Debug` and the instance runs `LEVEL = info`; **judge it by rows in `package_version`.**
   **Not this story's to observe — but it is why §5 item 7 puts a sentence of small print into the
   rollback section rather than promising a rollback depth nobody has verified.**
10. 🔴 **`main` has `required_approvals: 0`** (`#d16`). Branch protection blocks direct pushes — for
    everyone, `apply_to_admins: true` — but **a merged PR is not an approval of anything**, and the
    regulation must not let a reader infer that it is. Two independent facts, not one.
11. 🔑 **Two registry tokens leaked into agent transcripts and cannot be revoked** (an admin cannot
    revoke another account's token on this instance). Both `read:package` only, neither value reached
    a committed artifact. Transcript scrubbing is the only remaining mitigation and the decision is
    **open with Oleg**. Not this story's; named so it is not rediscovered.

### 8. Conventions that bind this story

- **retro-D4** (`epic-3-retro-2026-08-18.md:77`, status `adopted`): *"run-budget ledgers close only
  against a query (actions/runs API or DB count); a self-report without a query means the ledger is
  open."* **Declare before work; close only against a query re-run AFTER the merge commit lands.** If
  the query cannot be run, close with the literal word **OPEN**.
- 🔴 **The permanent story-push ledger line** (DN4 of Story 4.7's review, standing since): *"pushes to
  the story's own context/work branch" is a repeating, per-push ledger line, priced per push, not one
  flat "closeout push"* — each is a real four-job `ci.yml` run. Standing floor: a story costs
  **pushes + 1 PR-open run + 1 merge run**. `ci.yml` has **no `paths:` filter**, so a
  **documentation-only commit costs a full four-job run**, and **a push landing while the PR is
  already open fires both `push` and `pull_request` — two rows.** Forgejo's `push` fires once per
  *push*, not per commit, so batch.
- **retro-E5** (`epic-3-retro-2026-08-18.md:78`, status `adopted`): *"every new guard ships with a
  live outcome matrix (one run per branch incl. a discriminating run)."* **§9 states plainly how much
  of that a documentation-only story can honestly earn — which is: almost none. Say so; do not
  manufacture it.**
- **Commit attribution in the parallel era:** the **coordinator** runs API queries, issues dispatches
  and closes ledgers; **the dev agent** does git and file work; **Oleg** merges. Subtasks owned by the
  coordinator are marked **`PENDING (owner: coordinator)`**, never checked `[x]`. The ledger method,
  in three steps: **filter `action_run` to `repo_id=16` first**, then match each remaining row's
  `commit_sha` against this story's own known commits, and **a row whose `ref`/`commit_sha` matches
  neither is not attributable and must be named as such** — never absorbed. An overrun is
  **renegotiated explicitly with a new stated ceiling**, never silently absorbed at the merge.
- **"Announce, don't ask twice"** (`#d38` §7): a vetoable autonomous act is announced to Oleg through
  the coordinator **verbatim, before** it happens, and then executed without waiting for an explicit
  confirmation — absence of a veto is the answer. **That is exactly the contract the Dev Notes §5
  veto table is under**, and it is why Task 1.4 sends one consolidated message rather than a
  question.
- **NFR5:** the existing DEV and PROD stands stay fully operational and untouched. As amended
  2026-08-18 the PROD half is **absolute** — Forgejo never deploys to s2 at all. **This story touches
  no host at all, so NFR5 is satisfied by construction — say that, do not claim to have tested it.**
- **No `${{ }}` inside any `run:` body, including inside its comments** (D21). This story writes no
  workflow code; the prohibition stands anyway.
- **Frozen files** (§11) — `deploy-stand.yml`, `deploy-preprod.yml`, `record-preprod-candidate.yml`,
  `dev-reset.yml`, `deploy-dev.yml` are **read-only**. A real defect needs a **priced exception**, and
  the procedure is Story 5.3's §12, verbatim — it is a procedure, not a permission.

### 9. 🔴 retro-E5 for a documentation-only story — stated plainly, not manufactured

**This story introduces no guard, no check, no workflow, and no code path. There is nothing that can
fail, so there is no live outcome matrix to produce, and inventing one would be exactly the vacuity
this project has rejected four times** (D34 §3; Story 5.1's review; Story 5.2's H2; Prohibition 7
below). **Say that in the Dev Agent Record in those words.**

What *is* honestly available, and what the story does instead — **every row costs zero runs**:

| Claim the regulation makes | Status | How it is evidenced, or why it cannot be |
|---|---|---|
| "Anyone with repository write access can dispatch a production deploy" | **INHERITED — dated, not re-measured** | It is a property of the *platform*, established 2026-08-07 (`#d5`, `forgejo-migration.md` §1.3) and restated by NFR9. `deploy-prod.yml` does not exist, so it cannot be measured against the real target. **Cite the dated source; do not claim a fresh measurement.** |
| "`deploy-prod.yml` does not exist as of 2026-08-25" | ✅ **MEASURED, zero runs** | `ls .forgejo/workflows/` — 11 files, enumerated in the Dev Agent Record. **Paste the listing; do not characterise it** (Prohibition 9). |
| "The promotion guard is designed, not built" | ✅ **MEASURED, zero runs** | `docs/migration-decisions.md#d2`'s own status header, quoted verbatim. |
| "A waived candidate is indistinguishable from a clean one at the registry" | ⚠️ **NOT MEASURABLE AS SPECIFIED — corrected by code review 2026-08-25** | This row asked for the three rows of `docs/preprod-candidates.md` vs **the three `preprod-*` marker names**. Those marker values are not in that file at all (`grep -nE 'preprod-[0-9a-f]{6,}' docs/preprod-candidates.md` → no match), so the comparison specified here cannot be run from the repository, and Task 3.3 silently substituted the `sha-<12hex>-preprod` build tags. **What is true, and is what the document actually rests on: the invisibility is true BY CONSTRUCTION** — the waiver is written only into `Note` free text and into `#d40`/`#d41`, and no code path writes it to any tag. Established by reading the construction, not by a check that could have failed. See Task 3.3. |
| "A waiver exists and has been used once" | ✅ **MEASURED, zero runs** | `#d40` (the waiver), `#d41` (its mechanism), `RVC-v1.1` `## The waiver`, and candidate #3's `Note` cell — four independent artifacts, all on `main`. |

🔴 **A negative control was specified here and DOES NOT EXIST — corrected by code review,
2026-08-25, rather than left standing as the story's own trap.** The context author proposed:
take the cleanest candidate and the waived one and show their registry tags carry the same
information, on the reasoning that *"if that comparison ever showed a difference, the rule would be
wrong."* **It could not have shown a difference.** Both axes are fixed by construction —
`build.yml:933` emits every tag from one template (`sha-${SHORT_SHA}-${ENV_SUFFIX}`), and
`record-preprod-candidate.yml:231-249`'s **G1** refuses `validated: fail` before any registry read,
so the recorded-candidates table can only ever hold `pass` rows (refusals go to the separate, empty
`## Rejected candidates` table). A check whose outcome is guaranteed is precisely the vacuity
Prohibition 7 forbids, and this file proposed one while forbidding it four lines above.
**The honest position, and the one the story ships: the waiver's invisibility at the registry is
true BY CONSTRUCTION — nothing on any code path writes a waiver to a tag — and Story 6.2
establishes it by reading the construction. This story earns NO retro-E5 row and NO negative
control. Run the comparison anyway (it is free, and it documents the construction), label it a
documentary observation, and do not call it a control.** See Task 3.3.

### 10. Run budget model

Declared **before** work, per retro-D4. **This story dispatches nothing and touches no host: every
row below is a `ci.yml` run caused by a git push, not by any deliberate dispatch.**

| Line | Runs |
|---|---|
| Push: context (this file) | 1 |
| Push: dev-story write-up | 1 |
| PR-open run | 1 |
| Push: code-review commit (PR open → **two** rows) | 2 |
| Push: fix-pass commit (PR open → **two** rows) | 2 |
| Merge run (`build-main.yml`) | 1 |
| **Declared floor** (context + dev-story + PR-open + merge) | **4** above baseline |
| **Declared ceiling** (with one review round and one fix-pass) | **8** |

**Disposition: OPEN.** Closed only by the coordinator, against a query re-run **after** the merge
commit lands, attributing each row by `commit_sha`/`ref` — never by id range, and never by
self-report. Filter `action_run` to `repo_id=16` (`fe-prionex`) first; Story 4.9 is pushing to the
same instance concurrently and **its rows are named and excluded, never absorbed** (the method is
Story 5.1's closeout; it has held cleanly three times).

🔴 **A floor, not a ceiling, and this instance has no cancel endpoint.** Nothing here should ever
need a dispatch — **if a task appears to require one, that is a scope error, not a budget question.**

🔴 **No-touch window.** The Sunday `dev-reset.yml` tick is **02:00 UTC**; the standing rule is **no
dispatch, no live lock holder and no `main` merge across 01:45–02:30 UTC.** Next tick:
**2026-08-30.** This story dispatches nothing, so only the **merge** is affected — hand that
constraint to the coordinator rather than assuming it will be noticed.

### 11. 🔴 Blast radius, frozen files, and the §12 exception procedure

Story 4.9 (*Cut DEV Over to the New Stand*) is being implemented in parallel on `story-4-9/*` and
holds **D35** on its unmerged branch — which is why `docs/migration-decisions.md` on `main` jumps
from D34 to D36, deliberately. **This story runs from a scratchpad worktree; the primary checkout is
4.9's.** ✅ **RESOLVED 2026-08-25: PR #87 merged, and this branch took it by MERGE, not rebase.**
Epic 5's closeout landed as `aae711b1` (`522ac5f3` + the PR merge commit), moving `origin/main` from
`dbec399d` to `aae711b1` and closing Epic 5 at 6/6. **The instruction above said "rebase"; it was
written before this branch had a PR.** PR 88 is open and its history has already been code-reviewed,
so rewriting it was not available — `origin/main` was merged in instead, one conflict
(`sprint-status.yaml`), resolved by keeping both sides whole. Recorded in the Change Log, as the
instruction required.

**This story must not modify, and must not push any change to:**

- 🔴 **`.forgejo/workflows/deploy-stand.yml`** — read-only. Every edit re-triggers the retro-E5
  evidence Story 4.8 paid for, and it sits inside 4.9's blast radius.
- 🔴 **`.forgejo/workflows/deploy-preprod.yml`** — 5.3's and 5.5's shipped artifact.
- 🔴 **`.forgejo/workflows/record-preprod-candidate.yml`** — 5.4's shipped artifact.
- 🔴 **`.forgejo/workflows/dev-reset.yml`**, **`.forgejo/workflows/deploy-dev.yml`** — 4.6's and 4.3's,
  both inside 4.9's blast radius.
- `.forgejo/workflows/build.yml`, `ci.yml`, `build-main.yml`, and **every other file under
  `.forgejo/workflows/`**. **This story creates no workflow file, including `deploy-prod.yml`** —
  that is Story 6.4's, and writing even a skeleton here would be exactly the "technical control that
  does not exist" AC1 forbids.
- 🔴 **`docs/release-validation-checklist.md`** — 5.5's/`#d41`'s shipped artifact. **No item's text,
  id or pass criterion may move**; changing one bumps the marker and that is a story, not a keystroke.
  This document **cites** it. **Not one character is edited.**
- 🔴 **`docs/release-regulation.md`** — 5.6's shipped artifact. **Exactly one edit is permitted: one
  cross-reference line** pointing at the new production document (§2, point 4). Nothing else — no
  retitle, no reorganisation, no "harmonisation".
- 🔴 **`docs/preprod-candidates.md`** — append-only, and **this story appends nothing**. It reads the
  three rows and cites them.
- `README.md`, `docker-compose.server.yml`, `docker-compose.stand.yml`, `.env.stand.example`,
  `nginx.conf`, `Dockerfile.prod`, `epics.md`, or any artifact of Story 4.9.
- `4-9-cut-dev-over-to-the-new-stand.md`, or any `story-4-9/*` branch.
- **Any host.** No SSH, no `docker` verb, no `psql`, no s1, no s2, no s10. **NFR5 is satisfied by
  construction**, and the honest phrasing is exactly that — not "verified untouched".

**The §12 exception procedure** (Story 5.3's, verbatim by reference): a frozen file may be edited only
for a **real, demonstrated defect**, and only after the exception is **priced** — the defect stated,
the blast radius named, the re-earned evidence budgeted — and recorded before the edit. **It is a
procedure, not a permission.** No defect in scope for this story is expected to require one; if one
appears, it is an Open Question for Oleg, not a keystroke.

### 12. Boundaries — five things this story must not absorb

1. **It does not write, skeleton, or scaffold `deploy-prod.yml`.** Story 6.4.
2. **It does not build, design or specify the promotion guard.** Story 6.5. It *describes what the
   designed guard will and will not prove*, quoting `#d2` with a date.
3. **It does not decide `secrets: inherit`.** Story 6.4's mandatory first decision.
4. **It does not touch s10, probe PROD's Kong, or measure `KONG_PORT`.** Stories 6.10 / 6.4.
5. **It does not amend `RVC-v1.1`, `docs/preprod-candidates.md`, or Epic 5's regulation** beyond the
   single permitted cross-reference line. §11.

### Prohibitions

🚨 **A prohibition here cannot be overridden by a subtask.**

1. 🔴 **Never write a present-tense sentence about a control that does not exist.** §3. Every
   reference to `deploy-prod.yml`, the promotion guard, `rollback: true` or the s10 contour is
   **dated and forward-formed**, with its owning story named. This is AC1's second clause and it is
   the single most likely defect in this story.
2. 🔴 **Never restate a sentence `docs/release-regulation.md` or `RVC-v1.1` already contains.** Link
   it. §2. A reviewer will diff the files.
3. 🔴 **Never edit `docs/release-validation-checklist.md`, `docs/preprod-candidates.md`, or any
   `.forgejo/workflows/*.yml`.** §11. The one permitted edit outside this story's own new files is a
   single cross-reference line in `docs/release-regulation.md`.
4. 🔴 **Never invent a second waiver mechanism.** `RVC-v1.1` `## The waiver` already defines who may
   issue one, what it may cover, and its mandatory attributes. The emergency path **reuses** it. A
   parallel mechanism would be a second source of truth about who may authorise what.
5. 🔴 **Never write a rule that requires a Slack notification, a tracker ticket, or any system this
   project does not have.** §4, §7. If a rule cannot be executed on 2026-08-25 with the tools that
   exist, it is not a rule, it is a wish.
6. 🔴 **Never add a gate.** NFR9: there is none, and this document does not create one. 5.6's closing
   sentence is the posture: *"This document adds no gate and no machinery. It states an agreement,
   not a control."*
7. 🔴 **Never claim a check that could not have failed.** This project has rejected that vacuity four
   times (D34 §3, 5.1's review, 5.2's H2, 5.4's H1). §9 states exactly what this story can and cannot
   evidence. **If only the weak form is available, run it and say which.**
8. 🔴 **Never soften a disposition.** The four words are `UNPROVEN`, `OPEN`, `PENDING (owner: name)`,
   or the claim is simply not made. There is no fifth, softer word.
9. 🔴 **Paste the artifact, do not characterise it.** The same finding has been made three times
   (4.2 M3, 5.2 M1, 5.4 M10).
10. 🔴 **The dev agent does not touch the Forgejo API and does not open the PR.** The coordinator
    dispatches, queries run ids and closes the ledger; Oleg merges. Mark those subtasks
    **`PENDING (owner: coordinator)`** rather than checking them. Story 5.2's **M14** exists because a
    subtask was checked `[x]` with no PR anywhere in the record.
11. 🔴 **Never `${{ }}` inside any `run:` body, including inside its comments** (D21). *(This story
    writes no workflow code — the prohibition stands anyway, for any §12 exception.)*
12. 🔴 **Never touch a host.** No SSH, no `docker`, no `psql`. §11.
13. 🔴 **Never add a row to `docs/prod-releases.md`.** It ships empty, with its emptiness stated in
    prose. §4.
14. 🔴 **Never check AC4 off on an inference.** "Acknowledged" means a quoted, dated, attributed
    statement from Oleg (or a person he names), pasted into the Dev Agent Record. Silence is not
    acknowledgement, and neither is a merged PR.

---

## Acceptance Criteria

The epic's four ACs are carried in full as **AC1-AC4**. **AC5-AC8 are 🔴 ADDED** — they make the
epic's ACs measurable in the world of 2026-08-25, in which none of the machinery the regulation
describes exists yet, and they discharge the overlap decision the instruction singles out as the most
important thing to get right.

### AC1 — The absence of a gate is stated, and no imaginary control is described *(epic AC1)*
**Given** Forgejo has no equivalent of GitHub Environments with required reviewers
**When** the regulation is written
**Then** it states plainly that anyone with write access to the repository can dispatch
`deploy-prod.yml`
**And** it does not describe any technical control that does not exist — **which, on 2026-08-25,
means every reference to `deploy-prod.yml`, the promotion guard, `rollback: true` and the s10 contour
is dated and explicitly forward-formed, with its owning story named, and none is written in the
present tense (§3, Prohibition 1).**

### AC2 — Who approves, and where the approval is recorded *(epic AC2)*
**Given** approval must still happen
**When** the regulation is written
**Then** it names who approves a production release, and where that approval is recorded
**And** it states that the approval record must reference the specific `image_tag`
**And** 🔴 **because this project has no tracker (`tracking_system: file-system`,
`project_key: NOKEY`) and this instance does not reliably archive job logs, the record is
`docs/prod-releases.md` — a new append-only file in this repository, created by this story with its
header, its columns and a prose statement that it holds no rows. The substitution for `#d5`'s word
"трекер" is recorded in this story's decision record, not made silently (§4).**

### AC3 — What the guard does and does not prove, and the rollback bypass *(epic AC3)*
**Given** the commit-identity promotion guard specified by FR16 and recorded in `#d2` is the only
technical barrier
**When** the regulation is written
**Then** it describes what that guard does and does not prove — **that it proves the *commit* passed
PRE-PROD, never that the *artifact* did, because under Option C the PROD image is a separate,
byte-different build (NFR11)**
**And** it states that `rollback: true` bypasses it by design
**And** 🔴 **`#d2` is cited with the date on which it was read and with Story 6.5 named as the story
that will update it, because 6.5's own last AC rewrites the source this document quotes (§3).**

### AC4 — Published, and acknowledged *(epic AC4)*
**Given** the regulation is complete
**When** it is published
**Then** it lives in the repository documentation
**And** the development and release teams have acknowledged it — 🔴 **as a quoted, dated, attributed
statement pasted into the Dev Agent Record, asked on day one through the coordinator (Task 1.4), with
the HALT mapping in §3 applying if it does not arrive. Silence is not acknowledgement (Prohibition
14).**

### AC5 — 🔴 ADDED: the overlap with Story 5.6 is resolved explicitly, and no sentence is duplicated
**Given** `docs/release-regulation.md` already exists, shipped by Story 5.6 for Epic 5's AC4
**When** this story's document is written
**Then** it is a **separate file**, `docs/production-approval-regulation.md`, and the reasoning for
separating rather than extending is recorded in both the story and the decision record (§2)
**And** `docs/release-regulation.md` receives **exactly one cross-reference line** and no other edit
**And** the new document **cites** 5.6's document and `RVC-v1.1` by link for the five legs, the
scope-freeze argument and the "the recorder is not an approval gate" reasoning, **restating none of
it** — a `diff` of the two files finds no shared sentence other than a link.

### AC6 — 🔴 ADDED: the waiver's invisibility at the promotion gate is stated as a rule for the approver
**Given** `RVC-v1.1`'s waiver *"carries no signal at the registry … so a promotion gate reading only
the registry cannot tell a waived candidate from a clean one"*
**When** the regulation states what must be true before approval is sought
**Then** it requires the approver to read `docs/preprod-candidates.md` — the candidate's **derived**
verdict and **any waiver** — and not merely to confirm that `preprod-<sha>` exists
**And** it names the concrete precedent: candidate `sha-a99ccd44c5a3-preprod`, **7/12 pass, 5
BLOCKED**, derived `fail`, dispatched `pass` under `#d40`/`#d41`, with **no trace of that on its
registry tag**
**And** the document does **not** attempt to fix this technically — that gap is filed against Story
6.5 and this is a policy statement, not a duplicate mechanism (§5 item 4).

### AC7 — 🔴 ADDED: the edges are covered — freeze window, rollback authority, emergency
**Given** an approval regulation is only useful at its edges
**When** the regulation is written
**Then** it states the **PROD freeze window** (approval row appended → smoke check passes) **as a
difference from 5.6's PRE-PROD window, by link, not by copy**, and names **Oleg** as the only person
who may break it, with the break recorded in the ledger (🔴 **amended by the code-review fix-pass:
the original said "in the same ledger row", which contradicts the ledger's own append-only rule —
the row is appended before the dispatch and never rewritten, so a break is carried by a superseding
row that names the one it completes**)
**And** it states **rollback authority**: restoring a tag already recorded in `docs/prod-releases.md`
is not a new release and needs no new approval, but is recorded after the fact; a rollback to a tag
**not** in the ledger is a release and needs Oleg
**And** it states that **there is no forward hotfix path today** — a hotfix without a `preprod-<sha>`
is refused by the guard, so the emergency procedure is roll back first and fix through the normal
cycle; a genuine forward hotfix requires an abbreviated `RVC-v1.1` run under **`RVC-v1.1`'s own
existing waiver mechanism**, never a second one invented here (Prohibition 4)
**And** it states in one short section that **two production stands will serve simultaneously** —
GitHub to s2, Forgejo to s10, NFR5 as amended making that absolute — and which one is authoritative
for users until the external traffic switch.

### AC8 — 🔴 ADDED: the document is one page, and the story's evidential honesty is stated rather than manufactured
**Given** the project prefers one page that gets read over a manual that does not, and 5.6's
regulation is 75 lines at `dbec399d`
**When** the regulation is published
**Then** it is of comparable length — **a hard ceiling of 120 lines, raised twice on 2026-08-25 with
each reason recorded separately rather than the substance cut: to 125 by the code-review fix-pass,
then to 130 when Oleg's D2 answer added a new authority rule** — with every deferral,
open item and long argument living in the decision record or in this story file rather than in the
document. 🔴 **Why the ceiling moved, since a "hard" ceiling that moves silently is worthless:** the
review required the document to (a) date its s10/smoke-check references instead of stating them in
the present tense, (b) attribute the `CRM/api-prionex` paragraph to a dated, named source instead of
an uncited quote, (c) replace a citation to `#d11` that did not support its sentence, and (d) state
the freeze window's closing condition on the failure path. Those cost twelve lines of provenance.
The alternative was deleting sourcing to hit a number, which trades a true document for a short one.
Dev Notes §5 decision 10 named exactly this fallback: *"Raise the ceiling; nothing else changes."*
🔴 **Second raise, 125 → 130, and it is a different kind of reason — recorded separately so the two
are not blurred into one soft ceiling.** The first raise bought *provenance* for rules already
present. The second buys a **rule that did not exist before**: Oleg's D2 answer (*"Оставить как
есть"*) established that there is no delegate, and an approval regulation whose entire authority
model rests on one named person must say on its own page what happens when that person is
unavailable — including that an emergency rollback to a non-ledger tag is blocked. That is core
governing content, not *"a deferral, an open item or a long argument"*, which is what AC8's own
sentence sends to the decision record. Every reviewer-facing annotation was trimmed out of the
document first, and it still needs the space. **Shipped at 127 lines.**
**And** 🔴 **the Dev Agent Record states plainly that this story introduces no guard and therefore
earns almost no retro-E5 evidence, lists the five zero-run documentary checks of §9 with their
artifacts pasted, and labels each as documentary rather than live. 🔴 **Amended by the code-review
fix-pass, 2026-08-25: the check this clause originally called "the negative control" could not have
failed, so there is none to label. The Dev Agent Record states that this story earns NO negative
control — which is what Prohibition 7 actually requires when only the weak form is available.**

---

## Tasks / Subtasks

### Task 1 — Open the story honestly, and ask for AC4 on day one (AC: 4) — **costs 1 push row**
- [x] 1.1 **Done.** `sprint-status.yaml` `6-2-…` flipped to `in-progress` and pushed on its own
      commit (`d05d71b9`), before any content edit — Story 5.2's Task 1.1 lesson applied, not
      repeated.
- [x] 1.2 **Confirmed at context time, and superseded later the same day — both states recorded.**
      `epic-6` reads `in-progress` (set by the create-story context). PR #87 (Story 5.6's
      ledger-closeout, `522ac5f3` on `story-5-6/pr-3-ledger-closeout`) had **not** merged as of this
      session's `origin/main` fetch (`dbec399d` unchanged) — no rebase needed at that point.
      ✅ **It merged later in the cycle, 2026-08-25, as `aae711b1`, and this branch took it: see the
      Change Log and §11.** Epic 5 is now `done` (6/6). **Taken by MERGE rather than the rebase this
      subtask anticipated** — PR 88 was already open and reviewed by then, so its history could not
      be rewritten.
- [ ] 1.3 **`PENDING (owner: coordinator)`** — unchecked by code review 2026-08-25, per
      Prohibition 10 (a coordinator-owned subtask is marked PENDING, never `[x]`; Story 5.2's M14).
      **Declared by the dev agent, to be closed by the coordinator** — the dev agent does not query
      the API or touch a host (Prohibition 10/12). Floor **4**, ceiling **8**, disposition **OPEN**
      (§10). 🔴 The fix-pass that cleared this checkbox left the sentence truncated ("Declared: —");
      repaired on the second review pass.
- [ ] 1.4 **Superseded by the coordinator's own explicit sequencing, relayed before this session
      began: all fifteen autonomous decisions (Dev Notes §5) are already ratified — Oleg did not
      veto.** The §2 separate-file decision and the §4 `docs/prod-releases.md` decision therefore
      needed no further one-read veto ask; both were built as specified. **AC4's acknowledgement
      ask is handled on the coordinator's own instructed sequencing instead: sent *after* the
      regulation is complete, as the finished text itself, rather than before Task 4 as this
      subtask originally specified** — the coordinator asked for the final text so Oleg reads and
      confirms the actual document, not a plan for one. See Task 7.3 and the Debug Log for the
      message as sent. `PENDING (owner: Oleg, via coordinator)`. 🔴 **Checkbox cleared by code
      review 2026-08-25 — a subtask whose own body reads `PENDING` may not also be `[x]`
      (Prohibition 10, Story 5.2's M14). The acknowledgement itself landed; it is recorded at Task
      7.3, which is where it belongs.**
- [x] 1.5 **Re-verified, not trusted from context.** `git fetch --all`; `git grep -n '^## D[0-9]'`
      across every `origin/story-*` and `origin/main` ref → highest hit **D41** (`main`), no
      collision on any open branch (including `story-4-9/*`, which holds `D35`). **Next free: D42.**
      Confirmed, matches the context-time value.

### Task 2 — Read the documents you must not duplicate, and prove you read them (AC: 5) — **0 runs**
- [x] 2.1 **Done.** `docs/release-regulation.md` read end to end (75 lines → now 79 after this
      story's own one-line cross-reference). Section headings: `# PRE-PROD Release Regulation`
      (title), `## The five legs`, `## The scope-freeze agreement`, `## Where the record lives` —
      three `##` sections under one title, matching the story's own "four section headings" count.
- [x] 2.2 **Done.** `docs/release-validation-checklist.md`'s `## The waiver` read end to end. The
      three clauses, quoted: **who may issue** — *"Only **Oleg, as the release's owner**… A waiver
      issued by anyone else, including the dev agent that executes this checklist, has no
      effect."* **What it may cover** — item 2: *"A `fail` that arose **solely** from a broken
      external dependency unrelated to the artifact being validated."* **Effect** — *"the waiver
      changes what gets dispatched, never what is derived."*
- [x] 2.3 **Done.** `docs/preprod-candidates.md` (126 lines) read — both tables (the pass table with
      three rows, the empty "Rejected candidates" table), the three-tier header model (registry =
      identity/permanence, file = authoritative record, job log = best-effort), and candidate #3's
      `Note` cell (`sha-a99ccd44c5a3-preprod`, 7/12 pass, 5 `BLOCKED`, waiver `D40`).
- [x] 2.4 **Done.** `#d1` (Option C), `#d2` (quoted below), `#d5` (*"апрув фиксируется в
      трекере"*), `#d40`, `#d41` all read; `docs/forgejo-migration.md` §1.1, §1.3 read. **`#d2`'s
      status header, verbatim:** *"Статус: спроектировано, не реализовано — обновить в story 6.5."*
- [x] 2.5 **Written — no overlap found, §2's decision holds.** 5.6's document covers *what was
      already built on PRE-PROD and one PRE-PROD scope-freeze agreement*; this one covers *who may
      approve a PROD release, how the approval is recorded, and the PROD freeze/rollback/emergency
      authority model* — disjoint subjects, disjoint environments. The one sentence that links
      them: *"PROD has its own, separate regulation — see `docs/production-approval-regulation.md`
      (Story 6.2)… nothing below extends to PROD"* (the line added to `docs/release-regulation.md`,
      Task 6.1). Folded into `D42` §1.

### Task 3 — Gather the zero-run evidence §9 specifies (AC: 1, 6, 8) — **0 runs, and that is the point**
- [x] 3.1 **Done — pasted verbatim, not characterised.** `ls .forgejo/workflows/`:
      ```
      README.md
      build-buildkit-cni-image.yml
      build-main.yml
      build.yml
      ci.yml
      deploy-dev.yml
      deploy-preprod.yml
      deploy-stand.yml
      dev-reset.yml
      record-preprod-candidate.yml
      verify-cni-netns-isolation.yml
      ```
      Eleven entries. **No `deploy-prod.yml`.**
- [x] 3.2 **Done.** `#d2`'s status line, verbatim: *"Статус: спроектировано, не реализовано —
      обновить в story 6.5."*
- [x] 3.3 **Done — a documentary observation. 🔴 Originally written up as a "negative control";
      downgraded by code review 2026-08-25, see the correction at the end of this subtask.** Three `preprod-*` tags from
      `docs/preprod-candidates.md`, side by side with their ledger rows:
      | Tag | Verdict column | Waived? |
      |---|---|---|
      | `sha-00ef3be4743d-preprod` | `pass` | no |
      | `sha-28f7fd36b75e-preprod` | `pass` | no |
      | `sha-a99ccd44c5a3-preprod` | `pass` | **yes — `D40`/`D41`, 7/12 pass, 5 `BLOCKED`** |
      All three tags share the identical shape `sha-<12hex>-preprod`; all three `Verdict` cells
      read the identical literal `pass`. Nothing in the tag or the Verdict column distinguishes the
      waived candidate from the two unwaived ones — the distinguishing fact lives only in the
      `Note` cell's free text. **This supports the regulation's central rule (item 4): a promotion
      gate reading only the tag cannot tell a waived candidate from a clean one.** **Documentary,
      not live** — this is a comparison of already-committed files, not a dispatch or a probe.
      🔴 **DOWNGRADED BY CODE REVIEW, 2026-08-25 — this is NOT a negative control, and §9's claim
      that "if that comparison ever showed a difference, the rule would be wrong" was wrong: the
      comparison could not have shown one.** Both axes are fixed by construction, so neither could
      have come out the other way:
      (a) the tag shape is emitted by a single template — `build.yml:933`,
      `TAGS="${IMAGE}:sha-${SHORT_SHA}-${ENV_SUFFIX}"` — so all three tags share a shape
      necessarily, not observably;
      (b) the `Verdict` column of that table can only ever read `pass`, because
      `record-preprod-candidate.yml:231-249`'s **G1** refuses `validated: fail` as the first step of
      the first job (*"FAIL(G1): validated=fail -- this is a real refusal, not a bug"*) and refused
      candidates go to the SEPARATE `## Rejected candidates` table (`docs/preprod-candidates.md:83`),
      which is empty.
      ⚠️ **Second defect, same check:** §9 specified *"the three rows … vs the three `preprod-*`
      **marker** names"*. No `preprod-<12hex>` marker value appears anywhere in
      `docs/preprod-candidates.md` (`grep -nE 'preprod-[0-9a-f]{6,}'` → no match), so the specified
      comparison was not possible; build tags were substituted without the substitution being named.
      **Honest restatement, per Prohibition 7's own escape hatch ("if only the weak form is
      available, run it and say which"): the waiver's invisibility at the registry is TRUE BY
      CONSTRUCTION — the waiver is recorded only in `Note` free text and in `#d40`/`#d41`, and no
      code path writes it to a tag — and this story establishes it by reading the construction, not
      by a check that could have falsified it. Story 6.2 earns NO negative control. Saying so is
      the answer; manufacturing one is what Prohibition 7 forbids.**
- [x] 3.4 **Done.** The four artifacts: `#d40` (the first written waiver), `#d41` (`RVC-v1.1`'s
      mechanism, legitimising `#d40`), `docs/release-validation-checklist.md`'s `## The waiver`,
      and candidate #3's `Note` cell in `docs/preprod-candidates.md`.
- [x] 3.5 **Said explicitly: zero runs spent by Task 3 in its entirety.** Every check above is a
      file read.

### Task 4 — Write `docs/production-approval-regulation.md` (AC: 1, 2, 3, 6, 7, 8) — **0 runs**
- [x] 4.1 — 4.13 **Done.** `docs/production-approval-regulation.md` written, covering every item:
      header with cross-links to `docs/release-regulation.md` and `RVC-v1.1`'s waiver (4.1); who
      approves, by name (4.2); preconditions for seeking approval (4.3); the ledger-not-tag rule
      with the `sha-a99ccd44c5a3-preprod` precedent named (4.4); how the approval is recorded
      (4.5); attested-vs-observed with `#d2` quoted and dated, Story 6.5 named as reviser (4.6); no
      technical gate, dated forward form throughout (4.7); the freeze window, by link not copy
      (4.8); rollback authority, with the retention-rule caveat (4.9); emergency/hotfix reusing
      `RVC-v1.1`'s waiver (4.10); the two-production-stands section (4.11); the approver's own
      start/end time as a mandatory ledger field, not prose alone (4.12); the two-sentence
      comparison with `CRM/api-prionex`'s own gate (4.13).
- [x] 4.14 **Counted: 110 lines at `811a9b8c`** (after Prohibition-1 fixes added a few lines back),
      under the then-hard ceiling of 120; no argument needed cutting into `D42`.
      🔴 **Superseded by the code-review fix-pass, 2026-08-25: the shipped file is 127 lines against
      a ceiling raised 120 → 125 → 130,** the reason recorded in AC8 and Dev Notes §5 decision 10. The review's
      dating, sourcing and citation fixes cost the difference, and cutting provenance to hold 120
      would have made the document shorter and less true.
- [x] 4.15 **`diff`'d programmatically against `docs/release-regulation.md`** (sentence-level
      comparison, inline code stripped). 🔴 **This subtask's original claim of "zero shared
      sentences" was FALSE and is corrected here rather than quietly re-run (code review,
      2026-08-25).** The drafting check caught the CLOSING line ("adds no gate and no machinery")
      and never looked at the OPENING one: both files began with the byte-identical
      **`**One page. No new gate, no new machinery.**`** — `docs/release-regulation.md:3` and
      `docs/production-approval-regulation.md:3` — two shared non-link sentences, which AC5 defines
      as a defect in exactly those words. Fixed: the new document's opening rewritten to
      *"**One page, and it adds nothing to the pipeline.**"*; the comparison re-run and now
      genuinely clean (`EXACT SHARED: none`). **The lesson is Prohibition 9's: "verified
      programmatically" with no output pasted is a claim, not evidence.**

### Task 5 — Create `docs/prod-releases.md`, empty (AC: 2) — **0 runs**
- [x] 5.1 **Done.** Header states the file, its purpose, the three-tier model it inherits from
      `docs/preprod-candidates.md`, and the append-only/never-rewritten discipline in the same
      words that file uses for itself.
- [x] 5.2 **Done.** Columns (🔴 **ten after the code-review fix-pass added `prod_tag`**; nine at
      `811a9b8c`, which is why the rollback rule had nothing to key on): `Date (UTC) | image_tag |
      Candidate | prod_tag | Approved by | Waiver? | Approval start (UTC) | Approval end (UTC) |
      Deploy run id | Note` — each with a defined legal
      value, including `Deploy run id`'s legal text for a rollback-with-no-new-approval row
      (`N/A — rollback to a ledger tag, no new approval`), on the precedent Task 5.2 named.
- [x] 5.2a **Done.** `Waiver?` documented as mandatory with exactly two legal shapes (`none`, or
      the `D`-number and its scope) and an explicit statement that a blank cell is not a valid
      record.
- [x] 5.3 **Done — no row added.** Prose states the table has no rows and why no placeholder row
      exists (the same reasoning `docs/preprod-candidates.md`'s "Rejected candidates" table gives
      for itself).
- [x] 5.4 **Done.** `docs/prod-releases.md` links to the regulation in its own header paragraph;
      the regulation links to `docs/prod-releases.md` in "How the approval is recorded" and in
      "Where the record lives".

### Task 6 — Cross-references and the decision record (AC: 3, 5) — **0 runs**
- [x] 6.1 **Done.** One cross-reference statement added to `docs/release-regulation.md`, immediately
      after its own opening paragraph. No other edit to that file — `git diff --stat` shows 4
      insertions, 0 deletions.
- [x] 6.2 **Done.** `D42` written in `docs/migration-decisions.md`: the separate-document decision
      and its five reasons (§1); the tracker→`docs/prod-releases.md` substitution (§2); the
      approval/freeze/rollback/emergency authority model, with the waiver-reuse statement explicit
      (§3); the tag-protection question answered "does not belong here" with its reason (§4).
      Index-table row and Change Log row added.
- [x] 6.3 **Done.** A forward note appended directly under `#d2`'s own body (before its closing
      `---`), not at EOF: Story 6.2 has quoted `#d2` as of 2026-08-25, and Story 6.5 — which already
      owns `#d2`'s own update — must also revise `docs/production-approval-regulation.md`'s
      corresponding section when the gate ships. `#d2`'s own body is otherwise untouched.
- [x] 6.4 **Done.** `deferred-work.md` new EOF section `## Deferred from: Story 6.2 (2026-08-25)`:
      AC4's acknowledgement recorded as outstanding, owner **Oleg, via the coordinator** (a name and
      a channel, not a trigger condition, per Story 5.2's H4), no invented date (per `#d11`'s own
      convention for an unanswered dependency of this shape).

### Task 7 — Close (AC: all) — **1 dev-story push + PR-open + merge rows**
- [x] 7.1 **Done — graded below, against shipped files, not intention.** See the AC grading in
      Completion Notes.
- [x] 7.2 **Done, in §9's own words:** this story introduces no guard, no check, no workflow and no
      code path — there is nothing that can fail, so there is no live outcome matrix to produce,
      and inventing one would be the vacuity this project has rejected four times. The five checks
      it does have (Task 3) are documentary: file reads and one comparison over already-committed
      files, not a dispatch. 🔴 **Corrected by code review 2026-08-25: that comparison was
      originally called a negative control and is not one — both of its axes are fixed by
      construction. This story earns none, and Task 3.3 and §9 now say so.**
- [x] 7.3 **Landed, 2026-08-25 — pasted below, with the attested-vs-observed distinction this
      project holds everywhere.** Oleg's reply, verbatim, relayed by the coordinator:

      > Подтверждаю

      **Approver:** Oleg Kuksa (`geloniel@gmail.com`). **Date:** 2026-08-25.

      🔴 **Critical honesty caveat, stated in the record rather than smoothed over
      (attested vs observed — AC3's own distinction, applied to how this acknowledgement itself was
      obtained):** Oleg confirmed **on the coordinator's paraphrase**, not by reading
      `docs/production-approval-regulation.md` directly. The paraphrase was in Russian, covered
      every section (who approves / what must be true before / ledger-not-tag / how it is recorded
      / what the approver attests vs the machine / the freeze window / rollback authority with the
      unobserved-retention caveat / hotfix = roll-back-and-fix / the two stands / the comparison
      with the neighbouring team), and explicitly carried the live precedent
      `sha-a99ccd44c5a3-preprod` (7/12 pass, 5 `BLOCKED`, derived `fail`, dispatched `pass` under
      the waiver, no trace on the tag). **This is recorded as "confirmed by paraphrase", not as
      "read the document"** — the same register 5.6 held for Oleg's own browser-pass attestation.
      **The question was put with three options; two were explicitly declined, not defaulted
      past:** amending the rollback rule, and authorising a forward hotfix path. Both were **not
      chosen** — meaning the rollback rule (a tag from the ledger needs no new approval; a tag not
      in the ledger does) and the no-forward-hotfix finding stand **confirmed explicitly**, not by
      silence. Recorded here as a signal, per the coordinator's own instruction, not left implicit.

      ---

      ✅ **RESOLVED 2026-08-25 — code review decision D1, both halves, answered by Oleg and pasted
      here rather than summarised.**

      **(a) "The development and release teams" — the owner's own statement about who they are.**
      Epic AC4 requires that *"the development and release teams have acknowledged it."* Asked
      directly whether his single confirmation covers that plural, Oleg replied, verbatim:

      > Я и есть команда

      **Approver:** Oleg Kuksa (`geloniel@gmail.com`). **Date:** 2026-08-25. **This is recorded as
      an explicit statement by the owner about the composition of the teams, not as an assumption
      by the reviewer and not as a workaround around the word "teams".** AC4 is satisfied because
      the set of teams named by that AC has exactly one member, and that fact is on record in his
      own words. Had the set had more than one member, one person's confirmation would have been
      partial coverage; it does not, so it is full coverage. Nothing is inferred from silence.

      **(b) The paraphrase itself, now on the record.** Code review found that the only artifact
      pasted anywhere was the single word `Подтверждаю`, while every statement about *what had been
      confirmed* described a paraphrase that appeared nowhere — an attestation pointing at material
      that did not exist in the record (Prohibition 9). The coordinator has supplied it. **Below is
      the text to which `Подтверждаю` was given, exactly as sent — not edited, not translated, not
      abridged.**

      > **Текст, по которому дано подтверждение (координатор → Олег, 2026-08-25).**
      >
      > **Кто одобряет:** Олег, поимённо, как владелец релиза. Одобрение без названного
      > одобряющего — не одобрение.
      >
      > **Что должно быть истинно до запроса одобрения:** кандидат записан в PRE-PROD-реестре
      > (`preprod-<sha>`), его Execution Log по `RVC-v1.1` написан, строка в
      > `docs/preprod-candidates.md` добавлена — с **выведенным** вердиктом и **любым вайвером**,
      > оба видимы.
      >
      > **Главное правило:** *одобряющий читает леджер кандидатов, а не только тег в реестре.*
      > Вайвер не оставляет следа в реестре, и гард продвижения из 6.5 будет проверять лишь
      > существование тега — он тоже не отличит вайвернутого кандидата от чистого. Живой прецедент
      > прямо в тексте: `sha-a99ccd44c5a3-preprod` — 7/12 pass, 5 BLOCKED, выведенный `fail`,
      > диспатчен `pass` только под твоим письменным вайвером — и **по тегу этого не видно**.
      >
      > **Как фиксируется:** одна строка в `docs/prod-releases.md`, **добавляется до диспатча**,
      > несёт `image_tag`.
      >
      > **Что свидетельствует одобряющий против машины:** машина докажет только идентичность
      > коммита. При Option C прод-образ — отдельная, побайтово другая сборка. **Одобряющий
      > свидетельствует о решении релизить. Машина — об идентичности коммита. О байтах не
      > свидетельствует никто.**
      >
      > **Окно заморозки:** от добавления строки одобрения до прохождения smoke-check (6.7).
      > Внутри окна никакой другой диспатч не целится в прод-стенд. **Ломать окно вправе только
      > ты, и слом пишется в ту же строку леджера.**
      >
      > **Право отката:** восстановление тега, **уже записанного** в леджер, — не новый релиз и
      > одобрения не требует. Откат на тег, **которого в леджере нет**, — это релиз, и требует
      > тебя. Честная приписка: откат зависит от выживания тега `prod-<sha>`, а правило ретенции
      > **ни разу не наблюдалось** что-либо удаляющим или сохраняющим — 6.8 обязана доказать откат
      > до первого настоящего релиза.
      >
      > **Хотфикс:** форвардного пути нет. Процедура — **откатись, потом чини через обычный
      > цикл**. Если форвардный хотфикс когда-нибудь неизбежен — он требует `preprod-<sha>` по
      > сокращённому прогону под **существующим вайвером RVC-v1.1**, а не под вторым механизмом.
      >
      > **Два прод-стенда до переключения трафика:** GitHub продолжает деплоить на s2, Forgejo
      > туда не ходит никогда. Между 6.9 и переключением оба стенда живые; пользователи видят
      > сборку s2. Регламент правит только путём Forgejo→s10.
      >
      > **Сравнение с соседями:** их прод-промоушен уже сверяет **дайджесты** контейнеров, реально
      > работающих на их PRE-PROD, и «обхода нет». Наш гард (когда 6.5 его построит) докажет только
      > идентичность **коммита** и будет нести штатный обход `rollback: true`.
      >
      > Весь текст написан **будущим временем с датой**: `deploy-prod.yml` не существует (11 файлов
      > в `.forgejo/workflows/`, прод-каллера нет), гард 6.5 спроектирован, но не реализован —
      > регламент нигде не притворяется, что механика уже есть.

      ⚠️ **What was confirmed, versus what now ships — stated because the code review changed the
      document after the confirmation was given, and a reader must not mistake the block above for
      the current rule.** The **authority model Oleg confirmed is unchanged**: who approves, the
      ledger-not-tag rule, the precondition, attested-vs-observed, the rollback split (a ledger tag
      needs no new approval, a non-ledger tag does), no forward hotfix path, the two stands, the
      comparison with the neighbours. **Three record-keeping specifics in the quoted text were
      subsequently corrected by the review and now read differently in
      `docs/production-approval-regulation.md` and `docs/prod-releases.md`:**

      1. *"слом пишется в **ту же строку** леджера"* → the break is recorded in the ledger by a
         **superseding row that names the row it completes**. The quoted form contradicted the
         file's own append-only rule (the row is appended before the dispatch and never rewritten)
         — review finding 26.
      2. *"правило ретенции ни разу не наблюдалось что-либо удаляющим **или сохраняющим**"* → the
         source (`#d38` §9) says only *never observed deleting*; "or keeping" is an entailment of
         "verified by compilation, not by execution", and is now written as one — finding 10.
      3. *"несёт `image_tag`"* → the row carries `image_tag` **and** the approver's own start and
         end timestamps, and the ledger gained a `prod_tag` column so the rollback rule has
         something to match against — findings 6, 12 and 25.

      **None of the three changes what Oleg was asked to authorise; all three make the record able
      to hold what the rules require.** They are named here rather than absorbed, so that the
      question "was he shown what shipped?" has a written answer: he was shown the authority model
      that shipped, and three mechanical details were tightened afterwards by review.

      🔴 **Task 4.15's no-duplication check does NOT range over this block, and the exclusion is
      recorded rather than taken silently.** The block is a paraphrase *of*
      `docs/production-approval-regulation.md`, so it necessarily restates it — that is what makes
      it evidence. Task 4.15's rule (AC5, Prohibition 2) is a rule about **two published regulations
      not duplicating each other**: its subjects are `docs/release-regulation.md` and
      `docs/production-approval-regulation.md`. This block is neither; it is a quotation of
      confirmed material living in the story's own Dev Agent Record, and it is for exactly this
      reason that it was pasted **into the spec and not into the regulation**. Re-verified after
      insertion: the 4.15 comparison of the two regulations still returns **zero shared
      sentences**, because neither regulation file was touched.
- [x] 7.4 **Done.** Dev Agent Record, File List and Change Log updated below.
- [x] 7.5 **Done.** `sprint-status.yaml`'s `6-2-…` row flipped to `review` and pushed — 7.3 landed.
      `PENDING (owner: coordinator)` for PR-open; **Oleg merges** (Prohibition 10).
- [ ] 7.6 **`PENDING (owner: coordinator)`**, against a query re-run after the merge commit lands —
      no merge has happened yet.

---

## Dev Notes

### 1. The one-paragraph version

Write one page saying who approves a production release, what must already be true, how the approval
is recorded so it can be audited later, and what happens at the freeze/rollback/emergency edges. Put
it in a **new** file because 5.6's regulation is PRE-PROD by title and by scope, and **link** to 5.6's
document rather than restating it. Create the empty ledger the approval gets recorded in, because
this project has no tracker and this instance loses job logs. Write every reference to unbuilt
machinery in a dated, forward form, because none of it exists yet and AC1 forbids pretending
otherwise. Ask for the acknowledgement on day one. Touch no host, dispatch nothing, edit no workflow.

### 2. Infrastructure facts, in one place

| Fact | Value | Source, verified 2026-08-25 |
|---|---|---|
| `origin/main` at context time | `dbec399d` (5.6's PR #86 merge) | `git log origin/main` |
| Epic 5 closeout PR | ✅ **#87 MERGED 2026-08-25 as `aae711b1`** — Epic 5 `done` (6/6); `origin/main` `dbec399d` → `aae711b1`; taken into this branch by **merge**, not rebase (PR 88 already open and reviewed) | coordinator |
| Next free decision number | **D42** (`main` holds D41; 4.9 holds D35 unmerged) | scan of all `origin/story-*` branches |
| `deploy-prod.yml` | **does not exist** | `ls .forgejo/workflows/` → 11 files |
| Promotion guard | **designed, not built** | `#d2` status header |
| PROD target | **s10** = VM `e1-rung3`, `192.168.122.11`, behind jump `62.112.10.55`; moved from s2 on 2026-08-18 | `sprint-change-proposal-2026-08-18-prod-target.md` |
| PROD contour readiness | **not provisioned** — Story 6.10, which must complete before 6.4 | `sprint-status.yaml` Epic 6 block |
| `preprod-current` | `sha-a99ccd44c5a3-preprod`, digest `sha256:a62e8687…` | `docs/preprod-candidates.md:74` |
| Recorded candidates | **3**, ordered by git log, not by the registry | same file |
| Checklist marker | **`RVC-v1.1`** (bumped from `RVC-v1` on 2026-08-25 by `#d41`) | `docs/release-validation-checklist.md:1` |
| Tracker | **none** — `tracking_system: file-system`, `project_key: NOKEY` | 🔴 `sprint-status.yaml:72-73` — **corrected by code review 2026-08-25; this row originally named `_bmad/bmm/config.yaml`, which contains neither key** |
| Job-log archival | **unreliable** — `log_in_storage='f'` seven consecutive checks; `$GITHUB_STEP_SUMMARY` **UNPROVEN** | Stories 5.3/5.4/5.6 |

### 3. Anti-patterns for this story

1. **Restating 5.6.** The tempting failure. Every sentence about the five legs, the PRE-PROD scope
   freeze, or "the recorder is not an approval gate" is already written. **Link.**
2. **Present tense about `deploy-prod.yml`.** *"`deploy-prod.yml` requires an `image_tag`"* is false
   on 2026-08-25 and violates AC1's second clause. *"Story 6.4 will build `deploy-prod.yml` with a
   required `image_tag` input (FR15); as of 2026-08-25 it does not exist"* is true.
3. **Inventing a second waiver.** `RVC-v1.1` has one, with an authority, a coverage rule and mandatory
   attributes. Reuse it.
4. **Writing a procedure nobody can execute.** No tracker, no Slack (4.5 parked), no reliable job
   logs. Every step of the regulation must be executable with files in this repository.
5. **Manufacturing E5 evidence.** §9. A documentation story earns almost none. Saying so is the
   correct answer and the project has rejected the alternative four times.
6. **Absorbing 6.4's or 6.5's work.** Skeletoning the workflow, specifying the guard, or "just
   deciding" `secrets: inherit`. §12.
7. **Fixing the waiver-invisibility gap technically.** It is filed against Story 6.5. **6.2's
   contribution is a rule for the approver, and that is not a duplicate of 6.5's mechanism — it is the
   only thing that covers the gap until 6.5 ships, and it still covers the residue afterwards.**

### 4. Previous story intelligence — what Epic 5 paid for, that this story spends

- **Story 5.6** proved the whole PRE-PROD cycle end to end in 38 min 41 s, and its honest outcome —
  derived `fail`, dispatched `pass` under a written waiver — is the **concrete case** the regulation's
  central rule (§5 item 4) exists for. Without it, "read the ledger, not the tag" is a hypothetical.
- **Story 5.6's code review** produced five decisions, one of which (**D5 in its review**) is exactly
  *"the waiver is invisible at Story 6.5's promotion gate"* — filed as a cross-story item with **owner
  Story 6.5**. This story does **not** close it. It writes the policy half and says so.
- **Story 5.5** (`RVC-v1`) established that a verdict is **derived**, not asserted — and stated the
  limit in the same breath: *"it does not make it **enforced**."* That distinction transfers to PROD
  unchanged and is the honest shape of AC3's attested-vs-observed clause.
- **Story 5.4** established the three-tier record model (registry / file / job log) after finding that
  job logs do not survive here. **`docs/prod-releases.md` inherits that model directly**, and §4's
  argument is 5.4's argument.
- **Stories 5.1 and 5.2** established the review findings this story's Prohibitions 7 and 9 encode: a
  check that cannot fail is not evidence, and a characterisation is not an artifact.

### 5. The autonomous decisions in this story, in one place (for a one-read veto)

Every row was decided by the story author without asking, is defensible on the evidence cited, and is
**subject to Oleg's veto**.

| # | Decision | Why | If vetoed |
|---|---|---|---|
| 1 | **A separate file, `docs/production-approval-regulation.md`, rather than a production section inside 5.6's `docs/release-regulation.md`.** | §2, five reasons: different subject, PRE-PROD title, AC4 attaches to a named document, 5.6's artifact is freshly shipped and frozen by precedent, and Epic 7's 7.3 absorbs both anyway. | Name the target and the content moves into 5.6's document as a new section, with its title amended so a reader can find it. |
| 2 | **`docs/release-regulation.md` gets exactly one cross-reference line and no other edit.** | §2 point 4; the same append-only discipline 5.6 applied to 5.5's checklist. | Authorise a wider edit and the two documents can be reorganised together — but that is a re-review of Epic 5's AC4. |
| 3 | **AC2's "the tracker" is read as `docs/prod-releases.md`, a new append-only file in this repository.** | §4. There is no tracker (`file-system`, `NOKEY`), "tracker" appears once in the whole plan — in this AC — and job logs do not survive on this instance. | Name the real tracker and the record moves there; the regulation's wording changes, the rule does not. |
| 4 | **The ledger ships EMPTY, its emptiness stated in prose, with no placeholder row.** | §4; `docs/preprod-candidates.md:118-123`'s stated reason: a row here is never rewritten, so a placeholder would have to be. | Add a synthetic first row and accept that it will need rewriting. |
| 5 | **The approver is Oleg, by name, reusing the authority `RVC-v1.1`'s waiver section already states.** | §5 item 1. Inventing a second authority creates a second source of truth about who may authorise what. | Name a different approver or a delegation rule; the document takes it verbatim. |
| 6 | **Rollback to a tag already in the ledger needs no new approval; to a tag not in it, it is a release and needs Oleg.** | §5 item 7. The guard is skipped on `rollback: true` by design (`#d2`), so this is the only control on that path. | Require approval for every rollback and accept the added incident time, or drop the distinction entirely. |
| 7 | **There is no forward hotfix path, and a genuine one reuses `RVC-v1.1`'s waiver rather than a new mechanism.** | §5 item 8, Prohibition 4. The guard refuses a commit with no `preprod-<sha>`; the waiver is the only authorised way to reach one on short notice. | Authorise a distinct emergency mechanism and it becomes its own story — it is a gate, and gates are not written here. |
| 8 | **"The approver reads `docs/preprod-candidates.md`, not just the tag" is a RULE, not a note.** | §5 item 4. `RVC-v1.1` states the invisibility outright; candidate #3 is the live precedent. | Downgrade it to advisory and accept that a waived candidate can be approved by someone who never saw the waiver. |
| 9 | **Every reference to unbuilt machinery is dated and forward-formed; no present tense.** | §3, AC1's second clause read as "do not claim a control is in place". | Read AC1 literally instead and the regulation cannot mention `deploy-prod.yml` at all — which makes AC1's first clause unwritable. |
| 10 | **The document has a hard ceiling of 120 lines; overflow goes to D42, never a cut rule.** 🔴 **Raised twice on 2026-08-25, each with its own recorded reason — 120 → 125 by the code-review fix-pass (dating, sourcing and citation provenance for rules already present), then 125 → 130 when Oleg's D2 answer added the no-delegate rule and its cost, which is governing content rather than an argument to be filed elsewhere. Shipped at 127.** Cutting provenance or an authority rule to hold a number would trade a true document for a short one. Recorded here and in AC8, never applied silently. | §5 preamble; 5.6's is 75 lines and the project's stated preference is one page that gets read. | Raise the ceiling; nothing else changes — the branch this fix-pass actually took. |
| 11 | **This story earns almost no retro-E5 evidence and says so, offering five documentary checks instead.** | §9. Four prior rejections of the alternative (D34 §3, 5.1, 5.2 H2, 5.4 H1). | Require live evidence and the story needs a dispatch it currently has no reason to make. |
| 12 | **The approval record carries the approver's own start AND end time.** | §5 item 10. `RVC-v1.1` has a start field and no end field, so "one continuous session" is unverifiable on the PRE-PROD side and the validator's own observations carry no timestamp at all. The PROD freeze window has the same shape. | Drop the end field and accept that the freeze window is unverifiable from its own record. |
| 13 | **`Waiver?` is a mandatory column with a defined legal value (`none`, or the `D`-number with its scope); a blank cell is not a valid approval record.** | §5 item 11. `RVC-v1.1`'s note format does not define the waiver clause, so a waived note may legally omit it and **hide a waiver** — an open `RVC-v2` item. The production ledger does not inherit that hole. | Make it optional and accept that a waived release can be recorded as if it were clean. |
| 14 | **The tag-protection question `deferred-work.md` asks of this story by name gets the answer "does not belong here", with the reason recorded — not silence.** | §5 item 13. `#d18`/`#d20` dropped semver; **zero tags exist** and no story consumes one, so a `v*` rule would govern nothing. | Include it and the regulation acquires a section about tags this project does not cut. |
| 15 | **Decision number D42, re-verified across all branches at Task 1.5 rather than trusted from here.** | Story 4.9 holds D35 unmerged; that is exactly how a collision happens. | — |

### 6. Non-goals — absences that are decisions, not omissions

- **No workflow file is created, including a skeleton `deploy-prod.yml`.** Story 6.4.
- **No technical guard, check or gate.** NFR9; 5.6's closing posture.
- **No dispatch, no host contact, no `psql`.** §11.
- **No row in either ledger.** `docs/prod-releases.md` ships empty; `docs/preprod-candidates.md` is
  read and cited, never appended to.
- **No amendment to `RVC-v1.1`.** Changing an item bumps the marker; that is a story.
- **No resolution of `secrets: inherit`, `KONG_PORT` on PROD, or M7's eight branches.** §7, §12.

### 7. The ordering finding, restated for the record

**Verdict: 6.2 is correctly Epic 6's first story. No re-order is proposed.** `sprint-status.yaml`
states exactly one ordering constraint inside Epic 6 (**6.10 before 6.4**) and it does not touch 6.2;
**6.2 has no dependency on 6.3 or 6.10**, because neither the s10 contour nor the rebuilt cutover
image changes who may approve a release or how the approval is recorded. What *is* real, and is
handled inside the story rather than by re-ordering:

1. **6.2 writes about machinery that 6.4/6.5/6.8/6.10 build**, and AC1's own second clause forbids
   describing a control that does not exist. Held by §3's dated-forward-form rule (Prohibition 1).
2. **6.5 rewrites `#d2`, the source AC3 quotes.** Held by dating the citation and naming 6.5 as the
   reviser, plus a forward note appended under `#d2` itself (Task 6.3).
3. **AC4's acknowledgement is a human dependency** with no technical substitute. Held by asking on day
   one and by the §3 HALT mapping.

### Project Structure Notes

**Files this story creates:**
- `docs/production-approval-regulation.md` — new, one page, hard ceiling 120 lines — 🔴 raised to
  125 by the code-review fix-pass and to 130 by Oleg's D2 answer, shipped at 127 (AC1-AC3, AC5-AC8).
- `docs/prod-releases.md` — new, empty append-only ledger with header and column definitions (AC2).

**Files this story appends to (append-only, never rewritten):**
- `docs/migration-decisions.md` — **D42**, plus a forward note **under `#d2`** (Task 6.3), never at EOF.
- `_bmad-output/implementation-artifacts/deferred-work.md` — only if AC4 is still outstanding at close.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status transitions only.
- this file's own Dev Agent Record, File List and Change Log.

**Files this story edits, by exactly one line:**
- `docs/release-regulation.md` — one cross-reference line, nothing else. **Prohibition 3.**

**Files this story reads and must not modify:** `docs/release-validation-checklist.md`,
`docs/preprod-candidates.md`, every `.forgejo/workflows/*.yml`, `epics.md`, `README.md`,
`Dockerfile.prod`, `nginx.conf`, and anything belonging to Story 4.9.

**Working location:** a scratchpad worktree off fresh `origin/main`. The primary checkout belongs to
Story 4.9's dev agent. ✅ **PR #87 merged 2026-08-25 (`aae711b1`); taken by MERGE, not rebase —
PR 88 was already open and code-reviewed, so its history could not be rewritten.**

### References

- `_bmad-output/planning-artifacts/epics.md` — Epic 6 preamble and its accepted-risk block; **Story
  6.2's four ACs**; Stories 6.3, 6.4, 6.5, 6.7, 6.8, 6.9, 6.10 for what the regulation forward-refers
  to; **FR15, FR16, FR17, FR18, FR24**; **NFR5** (as amended 2026-08-18), **NFR9**, **NFR11**.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — the Epic 6 block and its **"WHAT EPIC
  6 INHERITS"** comment; the 6.10-before-6.4 constraint; Story 4.5's parked status.
- `docs/release-regulation.md` — Story 5.6's PRE-PROD regulation. **The document this one must not
  duplicate.** Its four sections, its opening scope sentence, and its closing posture.
- `docs/release-validation-checklist.md` — **`RVC-v1.1`**: P1/P2, F1-F12, the aggregation rule, the
  `validation_note` format, `## How a failed item blocks promotion`, and **`## The waiver`** (who may
  issue, what it may cover, mandatory attributes, effect on the aggregate, and **its invisibility at
  the registry**).
- `docs/preprod-candidates.md` — the readable ledger, its three-tier header, the three recorded
  candidates, the empty "Rejected candidates" table and **its stated reason for having no placeholder
  row** (`:118-123`) — the model for `docs/prod-releases.md`.
- `docs/migration-decisions.md` — **#d1** (Option C), **#d2** (the promotion guard proves the commit,
  not the artifact; the `rollback: true` bypass; *"свидетельство об исходном коде, а не о байтах"*;
  status **спроектировано, не реализовано**), **#d3** (the open tech-debt to Option A), **#d5** (no
  technical approval gate; names **story 6.2** as the place the rule is written), **#d23** (PROD moves
  to s10), **#d38** (the recorder's contract and six guards), **#d39** (`RVC-v1`), **#d40** (the first
  written waiver), **#d41** (`RVC-v1.1`, the waiver mechanism). **D35 is absent from `main` by
  design** — Story 4.9 holds it on an unmerged branch.
- `docs/forgejo-migration.md` — **§1.1** (the Option C decision and its rejected alternatives),
  **§1.3** (*"Прямо: технического гейта на PROD не будет … Это надо принять осознанно и записать в
  регламент."*).
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-18-prod-target.md` — s2 → s10, the
  jump-host path, and what was measured on the host.
- `_bmad-output/implementation-artifacts/5-6-exercise-the-full-release-cycle-on-an-empty-release.md`
  — the executed cycle, its honest verdict, its Review Findings' five decisions (including the
  waiver-invisibility item, owner Story 6.5).
- `_bmad-output/implementation-artifacts/spec-5-5-establish-the-release-validation-checklist.md` —
  derived-not-asserted, and the limit stated in the same breath.
- `_bmad-output/implementation-artifacts/5-4-record-the-validated-candidate-in-the-registry.md` — the
  six guards, and the code-review **D1** that produced the three-tier record model.
- `_bmad-output/implementation-artifacts/deferred-work.md` — the open items listed in §7, plus four
  that shape the document's content directly: the **waiver-invisibility** item (owner Story 6.5); the
  **`CRM/api-prionex` PROD-gate comparison** (*"Digests, not tags … There is no bypass flag"*, with
  its own "Consequence for Story 6.5" note); the two **`RVC-v2`** items — the Execution Log's missing
  **end-time field** and the **undefined waiver clause** in the note format; and the
  **tag-protection question asked of Story 6.2 by name** (Story 1.13's Open Question 5). Its own
  conventions block — **"Owners are NAMES or STORY NUMBERS, never trigger conditions"** — and its
  warning that line citations in it are not maintained: **verify any `file:line` before acting on it.**
- `_bmad-output/implementation-artifacts/epic-3-retro-2026-08-18.md:77-78` — **retro-D4** and
  **retro-E5**, verbatim.
- `_bmad-output/implementation-artifacts/5-3-…md` §12 — the priced-exception procedure, verbatim.

---

## Dev Agent Record

### Agent Model Used

_(dev-story: Sonnet, per the standing model split — create-story Opus, dev-story Sonnet,
code-review Opus.)_

### Debug Log References

- **Task 1.5, D-number re-check, 2026-08-25:** `git fetch --all`; `git grep -n '^## D[0-9]'`
  across every `origin/story-*` ref and `origin/main` → highest hit `D41` (`main`). No collision.
  Next free: **D42**.
- **Task 1.2, PR #87 check:** `git fetch origin main` → `dbec399d`, unchanged from context time.
  Story 5.6's ledger-closeout (`522ac5f3`, `story-5-6/pr-3-ledger-closeout`) has not merged. No
  rebase performed.
- **Task 1.2, re-check after the code review, 2026-08-25:** PR #87 **has** merged.
  `git fetch origin main` → **`aae711b1`** (`522ac5f3` + the PR merge commit); merge base with this
  branch remains `dbec399d`; `git diff --stat dbec399d..origin/main` → two files, 106 insertions
  (`sprint-status.yaml` +75/−1 and Story 5.6's own spec). **`git merge --no-ff origin/main`** →
  exactly one conflict, `sprint-status.yaml`, at the `epic-6:` line; Story 5.6's spec merged clean
  (only `main` touched it). Resolved keeping **both** sides whole. Epic 5 now reads `done`, 6/6.
- **Task 4.15, programmatic diff, 2026-08-25:** sentence-level comparison of
  `docs/production-approval-regulation.md` against `docs/release-regulation.md` (inline code
  spans stripped before comparison, to avoid false negatives/positives from shared identifiers) →
  zero common sentences on the second pass. First pass found one — the closing "This document adds
  no gate and no machinery. It states an agreement, not a control." sentence, copied verbatim into
  the new document twice — both instances rephrased before the check was re-run clean.
  🔴 **CORRECTED, code review 2026-08-25: that "clean" result was wrong.** The splitter dropped
  sentences shorter than its minimum length, so the shared opening
  `**One page. No new gate, no new machinery.**` (`release-regulation.md:3` /
  `production-approval-regulation.md:3`) was never compared; it was found by `grep`, not by the
  comparison that was supposed to find it. The opening was rewritten and the comparison re-run
  clean: `A sentences: 43  B sentences: 49` / `=== EXACT SHARED ===` (empty) /
  `=== NEAR (>=0.7 jaccard) ===` (empty).
  🔴 **SECOND CORRECTION, same session, second review pass — this entry itself overstated its
  evidence and is fixed rather than left standing.** An earlier version of this line claimed the
  re-run was done "with the short-sentence floor removed". **It was not:** the reviewer's script
  keeps its `len(s) > 12` floor, so the pasted `43/49` counts are of *filtered* units, and a
  hypothetical second short shared sentence would still be invisible to it. What was actually
  established is narrower and is all that is claimed now: (a) the specific shared opening is gone,
  by `grep`; (b) no shared sentence **above the floor** exists; (c) two independent second-pass
  reviewers re-ran their own splitters **without** a floor and found **zero** shared sentences —
  one shared **heading**, `## Where the record lives`, which AC5 does not cover (it says
  "sentence", and the bullets under the two headings differ). **The conclusion holds; the original
  description of how it was reached did not.** Exactly the defect this story's own finding 1 is
  about, reproduced by the fix for finding 1 — which is why it is written down.
- **Task 1.4, the consolidated message actually sent this session, verbatim (relayed to the
  coordinator, 2026-08-25):** *"Story 6.2's finished regulation is attached in full below (110
  lines) — `docs/production-approval-regulation.md`. Per AC4, I need the development and release
  teams' acknowledgement: a quoted, dated, attributed statement that they have read and accept it.
  Please relay the full text to Oleg for his confirmation."* Sent alongside the complete text of
  `docs/production-approval-regulation.md`. **No reply had arrived by the time this story file was
  first saved this session** — Task 7.3 was left unchecked accordingly and `sprint-status.yaml`
  stayed `in-progress`. 🔴 **Superseded by the second commit (`811a9b8c`) and corrected here, code
  review 2026-08-25: this entry was left stale and contradicted both Task 7.3 and the shipped
  `sprint-status.yaml`.** The reply landed the same day; see Task 7.3. ⚠️ **Also reconciled, since
  the two do not match: the ask as sent requested the coordinator "relay the full text", and was
  sent alongside the complete 110-line document — but the confirmation that came back was given on
  the coordinator's Russian paraphrase, not on the text. The ask was not fulfilled as sent, and
  that is recorded, not smoothed** (see Review Findings D1).

### Completion Notes List

1. **Tasks 1-6 executed in full this session.** Ledger baseline and PR-open/merge/ledger-close
   subtasks correctly left `PENDING (owner: coordinator)` per Prohibition 10 — this story touches
   no host and queries no API (Prohibition 12). D-number re-verified independently (`D42` free
   across every open branch, not merely trusted from context). The fifteen autonomous decisions in
   Dev Notes §5 were already ratified by Oleg before this session started (relayed by the
   coordinator) — no further one-read veto ask was needed for those; only AC4's acknowledgement
   remained to be sought, and the coordinator's own explicit sequencing moved that ask to *after*
   the document was finished rather than before Task 4, so Oleg confirms the actual text.
2. **`docs/production-approval-regulation.md` written — 110 lines at `811a9b8c`; 🔴 127 after the
   code-review fix-pass and Oleg's D2 answer, against a ceiling raised 120 → 125 → 130, each raise
   with its own recorded reason (AC8).** Covers every item in Dev Notes §5's assessment table: who approves (Oleg, by name,
   reusing `RVC-v1.1`'s waiver authority — no second one invented); what must be true before
   approval; the ledger-not-tag rule with the live `sha-a99ccd44c5a3-preprod` precedent named;
   how the approval is recorded; attested-vs-observed with `#d2` quoted and dated; no technical
   gate, every forward reference dated and forward-formed (Prohibition 1 — the story's own
   most-likely trap, and it was hit, not just avoided: a first draft used present-tense verbs
   ("anyone… can dispatch `deploy-prod.yml`", "the guard checks…", "`rollback: true` bypasses…",
   "a hotfix… is refused") describing machinery that does not exist yet. A `grep` sweep after the
   first draft caught six such sentences; all six were rewritten to a dated, forward form
   ("once `deploy-prod.yml` exists (Story 6.4)… will be able to", "the guard… will check", "is
   designed to bypass… once it exists") and the sweep re-run clean. Named here rather than
   presented as though the correct form was reached in one pass); the freeze window
   by link, not copy; rollback authority with the honest retention-rule caveat; the no-forward-
   hotfix-path finding, reusing `RVC-v1.1`'s waiver (Prohibition 4); the two-stands section; the
   approver's own start/end time as a mandatory ledger column (closing the hole `RVC-v1.1`'s own
   Execution Log has); and the two-sentence comparison with `CRM/api-prionex`'s stronger gate.
   🔴 **Two corrections from code review, 2026-08-25, both recorded rather than absorbed:**
   (a) **the grep sweep was file-scoped and incomplete** — it covered
   `docs/production-approval-regulation.md` only, missed AC1's *s10-contour* clause entirely, and
   never ran over `docs/prod-releases.md`, which shipped two undated present-tense sentences about
   `deploy-prod.yml`; all of them are now dated and forward-formed.
   (b) **the claim "the approver's own start/end time as a mandatory ledger column" was not
   delivered as stated** — both columns existed but their legal value read only `a timestamp`, only
   `Waiver?` carried a mandatory clause, and the regulation's "How the approval is recorded"
   section never mentioned timestamps at all. Both are now explicitly mandatory and the regulation
   names them.
   **Programmatic sentence-level diff against `docs/release-regulation.md`: the drafting run
   reported zero duplication and was WRONG — the shared opening line survived it. See Task 4.15.
   Corrected, re-run, and now genuinely clean.**
3. **`docs/prod-releases.md` created, empty, on the `docs/preprod-candidates.md` "Rejected
   candidates" precedent** — no placeholder row, its emptiness stated in prose, `Waiver?` mandatory
   with exactly two legal shapes so a waived PROD release can never be recorded as if it were clean
   (Prohibition 13 held; §5 item 11's enforcement half delivered).
4. **Cross-references and decision record closed.** `docs/release-regulation.md` received exactly
   one added statement, no other edit (`git diff --stat`: 4 insertions, 0 deletions).
   `docs/migration-decisions.md#d42` records the full decision; `#d2` received a forward note under
   its own body (not at EOF, not rewriting it) naming both `#d2`'s own revision owner (Story 6.5)
   and this document's corresponding section as needing revision together. `deferred-work.md`
   records AC4's outstanding acknowledgement with a named owner (Oleg, via the coordinator), no
   invented date.
5. **Retro-E5 stated plainly, not manufactured (§9, Task 7.2):** this story introduces no guard, no
   check, no workflow, no code path. There is nothing that can fail, so there is no live outcome
   matrix — inventing one would repeat a vacuity this project has rejected four times. The five
   checks this story can honestly earn are documentary (Task 3), and there are **five**, listed
   here in full because AC8 asks for the list and the first draft named only four: (1) the
   `ls .forgejo/workflows/` listing, pasted verbatim at Task 3.1 — eleven entries, no
   `deploy-prod.yml`; (2) `#d2`'s status line quoted verbatim at Task 3.2; (3) the three-tag /
   three-verdict comparison at Task 3.3; (4) the four waiver artifacts enumerated at Task 3.4
   (`#d40`, `#d41`, `RVC-v1.1` `## The waiver`, candidate #3's `Note` cell); (5) the zero-run
   statement at Task 3.5. Artifacts are pasted at Task 3; this list points at them.
   🔴 **Corrected by code review, 2026-08-25: check (3) was described as a negative control and is
   not one** — both of its axes are fixed by construction (`build.yml:933`'s single tag template;
   G1's refusal of `validated: fail` at `record-preprod-candidate.yml:231-249`), so it could not
   have come out the other way. **This story earns no negative control at all, and that — not a
   relabelled tautology — is the honest retro-E5 answer.** See Task 3.3.
6. ✅ **AC4 landed, 2026-08-25 — HALT lifted, story closes to `review`.** Oleg's reply, verbatim:
   *"Подтверждаю"* — approver Oleg Kuksa (`geloniel@gmail.com`), dated 2026-08-25, relayed by the
   coordinator. **Recorded honestly as "confirmed by paraphrase", not "read the document directly"**
   (Task 7.3's own caveat) — the coordinator's Russian paraphrase covered every section and named
   the live `sha-a99ccd44c5a3-preprod` precedent explicitly. Two of the three offered options
   (amend the rollback rule; authorise a forward hotfix) were **explicitly declined**, which
   confirms the rollback and no-forward-hotfix rules as written, on the record, not by silence.
   `sprint-status.yaml`'s `6-2-…` row flipped to `review` and pushed. `PENDING (owner:
   coordinator)` for PR-open; Oleg merges; ledger close stays `PENDING (owner: coordinator)`
   against a post-merge query.

**AC grading (Task 7.1), against shipped evidence:**

| AC | Verdict | Evidence |
|---|---|---|
| AC1 | ✅ MET **after the review fix-pass** | First clause met as shipped. 🔴 Second clause was NOT met at `811a9b8c`: the freeze-window sentence, the `binds Forgejo→s10` sentence and two sentences in `docs/prod-releases.md` were present-tense and undated — the drafting `grep` sweep was file-scoped and never covered AC1's s10-contour clause. All four rewritten dated/forward-formed in this pass |
| AC2 | ✅ MET **after the review fix-pass** | Approver named; ledger created; substitution recorded in `D42`. 🔴 Three defects fixed this pass: the "measured" citation `_bmad/bmm/config.yaml` contains **neither** cited key (they live in `sprint-status.yaml:72-73`); the `image_tag` column's meaning and its own legal value contradicted each other and named a tag family absent from the file cited; and no column recorded the `prod-<sha>` the rollback rule keys on |
| AC3 | ✅ MET | `#d2` quoted and dated; Story 6.5 named as reviser; `rollback: true` bypass stated |
| AC4 | ✅ **MET — and the two residues are now closed, not carried** | Oleg's verbatim reply pasted at Task 7.3, dated, attributed; the confirmed-by-paraphrase caveat appears in **all eight** places the attestation appears (`deferred-work.md` ×1, this file ×6, `sprint-status.yaml` ×1 — counted, not estimated), and nothing anywhere implies he read the file. 🔴 Two residues named, not smoothed: the **paraphrase itself is never pasted** (Prohibition 9 — the only artifact on record is the one word `Подтверждаю`), and epic AC4 says *"the development and release **teams**"* while the record carried one individual nowhere stated to speak for both. ✅ **Both closed 2026-08-25 (review decision D1):** the paraphrase is pasted verbatim at Task 7.3, and Oleg stated the team composition himself — *"Я и есть команда"* — so AC4's plural is satisfied by a set of size one, on the owner's own testimony rather than by inference |
| AC5 | 🔴 **NOT MET at `811a9b8c`; MET after the review fix-pass** | Separate file ✅, one cross-reference line ✅. **Zero shared sentences was FALSE** — both documents opened with the byte-identical `**One page. No new gate, no new machinery.**`, two shared non-link sentences, which AC5 itself defines as a defect. Opening rewritten, comparison re-run clean. See Task 4.15 |
| AC6 | ✅ MET | Ledger-not-tag rule stated as a rule, with the live precedent named |
| AC7 | ✅ MET | Freeze window, rollback authority, emergency/hotfix, two stands — all four present |
| AC8 | ✅ MET **after the review fix-pass** | **127 lines against a ceiling raised 120 → 125 → 130, with the reason recorded in AC8 and Dev Notes §5 decision 10** (was 110; the review's dating, sourcing and citation fixes cost twelve lines of provenance, and the neighbour/freeze/rollback paragraphs were re-tightened to claw back what tightening could honestly claw back). 🔴 The retro-E5 statement was honest in the general but overstated in the particular: the one item called a "negative control" could not have failed. Corrected in §9, Task 3.3 and Completion Note 5 — this story earns **no** negative control, and now says so |

### File List

- `docs/production-approval-regulation.md` — new, **127 lines** (110 at `811a9b8c`; the code-review
  fix-pass added dating/sourcing/citation provenance and Oleg's D2 answer added the no-delegate rule;
  ceiling raised 120 → 125 → 130), AC1-AC3/AC5-AC8
- `docs/prod-releases.md` — new, empty append-only ledger with header and column definitions, AC2
- `docs/release-regulation.md` — one cross-reference statement added, no other edit (Prohibition 3)
- `docs/migration-decisions.md` — `D42` added; forward note appended under `#d2` (not rewritten)
- `_bmad-output/implementation-artifacts/deferred-work.md` — new EOF section, AC4's outstanding
  acknowledgement, owner Oleg via the coordinator
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `6-2-…` flipped to `in-progress`
  (own commit, `d05d71b9`)
- `_bmad-output/implementation-artifacts/6-2-publish-the-production-approval-regulation.md` — this
  story file (Tasks 1-6 complete, Task 7 partial, Dev Agent Record, Open Questions, Change Log)

### Review Findings

**Code review (Opus, three adversarial layers — Blind Hunter, Edge Case Hunter, Acceptance Auditor —
plus the reviewer's own factual verification), 2026-08-25, against `811a9b8c` from an isolated
scratchpad worktree.** This is a documentation-only story, so the review criterion was **truthfulness
of claims**, not code correctness: every assertion in a shipped document was resolved against the
repository rather than taken from the story's own record.

**Two adversarial passes were run, and the second one was not a formality — it found fifteen further
defects, five of them high, and every one of those five was introduced by the first pass's own
fixes.** That is recorded here rather than folded silently into the totals, because a fix-pass that
does not get re-reviewed is just a second draft.

**Total applied: 35 numbered findings — pass 1: 20 (7 high / 10 medium / 3 low); pass 2: 15
(5 high / 5 medium / 5 low). Deferred: 7, each with a named owner. Decisions routed to Oleg: 2.**

#### Decisions needed (owner: Oleg) — ✅ **BOTH ANSWERED AND APPLIED, 2026-08-25**

Both came back the same day, in Oleg's own words, and both are recorded as his decisions rather than
as the reviewer's reading of them. **D1** is closed by two verbatim statements plus the missing
artifact; **D2** is closed as an explicitly accepted risk with its cost written on the page.

- ✅ **D1 — RESOLVED. Both halves answered.** **(a)** Asked whether one confirmation covers epic
  AC4's plural, Oleg replied verbatim *"Я и есть команда"* — recorded as **the owner's own statement
  about the composition of the teams**, dated 2026-08-25, not as an assumption and not as a
  workaround around the word "teams": AC4 is satisfied because the set of teams it names has exactly
  one member, on his own testimony. **(b)** The coordinator supplied the paraphrase, and it is now
  pasted **verbatim, unedited and untranslated** at Task 7.3 under the heading *"текст, по которому
  дано подтверждение"* — the attestation no longer points at material that exists nowhere.
  ⚠️ Recorded alongside it, because it is a real fact rather than a tidy one: **three record-keeping
  specifics in the confirmed text were changed by this review after Oleg confirmed it** (the freeze
  break moved from "the same ledger row" to a superseding row; `#d38` §9's "or keeping" became an
  entailment rather than a finding; the ledger row gained the two timestamps and `prod_tag`). The
  **authority model he authorised is unchanged** — the three deltas make the record able to hold the
  rules, and each is enumerated at Task 7.3 rather than absorbed.
  🔴 **Task 4.15's scope, recorded not assumed:** the pasted block is a paraphrase *of* the
  regulation and therefore restates it by construction. Task 4.15 (AC5, Prohibition 2) is a rule
  about **two published regulations not duplicating each other** — its subjects are
  `docs/release-regulation.md` and `docs/production-approval-regulation.md`. The block is a
  quotation of confirmed material in the story's Dev Agent Record, which is why it was pasted into
  the spec and **not** into the regulation. **Re-verified after insertion: zero shared sentences
  between the two regulations, both regulation files untouched by this edit.**
- ✅ **D2 — RESOLVED as an accepted risk, not as an omission.** Oleg, verbatim: *"Оставить как
  есть"*. **There is no delegate**, and the regulation now says so on its own page, in "Who
  approves", with the cost stated concretely rather than as a general caveat: **while Oleg is
  unavailable nothing can be approved, and that includes an emergency rollback to a tag not already
  in `docs/prod-releases.md`**, which this document itself classifies as a release. A rollback to a
  tag already in the ledger needs no approval and stays available — so the blocked case is precisely
  the unplanned one. **Risk owner: Oleg. Accepted 2026-08-25.** Written into the regulation rather
  than filed in `deferred-work.md` alone, because a person reading the regulation during an incident
  is exactly the person who needs to know it.

**Superseded — the original statement of both, kept for the record:**

- **D1 — AC4's acknowledgement: the paraphrase itself was never pasted, and the epic AC says
  "teams".** The only artifact on record is the single word *"Подтверждаю"*. Everything else —
  *"the paraphrase covered every section"*, *"named the live precedent explicitly"*, *"two of three
  options were explicitly declined"* — is characterisation of material that is not in the record,
  which is what Prohibition 9 exists to stop. Separately, epic AC4 requires *"the development and
  release **teams** have acknowledged it"*, and the record carries one individual who is nowhere
  stated to speak for both. The confirmed-by-paraphrase caveat IS present in **all eight** places the
  attestation appears (`deferred-work.md` ×1, this file ×6, `sprint-status.yaml` ×1 — counted, not
  estimated), and nothing anywhere implies Oleg read the file — that part is clean.
  **What is needed:** either the coordinator pastes the paraphrase as sent, or Oleg states that he
  is the development and release team for this project's purposes. **Owner: Oleg, via the
  coordinator.** Not patched: only they hold the text.
  *(Answered: both — "Я и есть команда", and the paraphrase supplied and pasted. See above.)*
- **D2 — delegation when the sole named approver is unavailable.** Every authority path in the
  regulation is one person: approval, breaking the freeze, and a non-ledger rollback all require
  Oleg. There is no delegation rule, so his absence blocks even an emergency rollback. Naming a
  delegate is a policy choice, not a defect the reviewer may decide. **Owner: Oleg.**
  *(Answered: "Оставить как есть" — see the resolution above.)*

#### Patch — applied

**High (7).**
1. **AC5 / Prohibition 2 — the two regulations shared two verbatim sentences, and the check that
   said otherwise was false in five places.** Both files opened
   `**One page. No new gate, no new machinery.**` (`release-regulation.md:3` /
   `production-approval-regulation.md:3`). AC5 defines a shared non-link sentence as a defect in
   exactly those words. The drafting check fixed the *closing* line and never compared the *opening*
   one (its splitter dropped sentences under its length floor). Opening rewritten; comparison re-run
   with the floor removed and output pasted; Task 4.15, the Debug Log, `D42` §1, the `D42` changelog
   row and the AC grading all corrected.
2. **AC2's load-bearing citation names a file that contains neither key.** `docs/prod-releases.md`
   and `D42` §2 both asserted `_bmad/bmm/config.yaml` carries `tracking_system: file-system` and
   `project_key: NOKEY`, under the word *"Измерено"*. That file has neither; both live in
   `sprint-status.yaml:72-73`. The conclusion (no tracker) survives — `tracker` does occur exactly
   once in the plan, at `epics.md:2471` — but a measurement that was never taken had entered a file
   this project forbids rewriting retroactively. Corrected in both.
3. **The job-log justification contradicted the project's own SETTLED finding, and its count was
   inflated.** *"job logs do not reliably archive (`log_in_storage='f'` on seven consecutive
   checks)"* — but `deferred-work.md`'s Story 3.3 section settled on 2026-08-16 that archival here is
   **delayed, not absent** (`4128 t` against `461 f`; the rows Story 2.1 called permanently absent
   are `t` today), and the real figure is **six** observations across 5.3/5.4 (`epics.md:3150`).
   Rewritten to the claim the evidence supports: a log that may not be readable when an approval must
   be checked. The argument for keeping the record in a file survives on delay alone.
4. **`#d11` was cited for a convention it does not contain.** The regulation sourced *"an approval
   without a named approver is not an approval"* to `#d11`, which is the PRE-PROD infrastructure
   requirement and the rule against inventing dates — no approver, name or role appears in it. This
   is the same defect shape 5.6's review found in `D40` §1, which produced `D41`. Re-sourced to
   `deferred-work.md`'s conventions block, *"Owners are NAMES or STORY NUMBERS, never trigger
   conditions."*
5. **The ledger's `image_tag` column contradicted its own legal value and the regulation two
   sections away.** Meaning said *"the exact `preprod-<sha>` tag being promoted"*; legal value said
   *"must exist in `docs/preprod-candidates.md`"* — but that file tabulates only `sha-<12hex>-preprod`
   build tags and contains no `preprod-<12hex>` marker anywhere. Worse, `preprod-<sha>` markers are
   explicitly **not deployable** (`record-preprod-candidate.yml:143-148`: neither marker ends in
   `-preprod`, so `deploy-stand.yml:1060-1070`'s tag↔environment guard refuses both), and under
   Option C nothing is "promoted" at all — the PROD deploy rebuilds. Both columns redefined.
6. **The rollback rule's predicate had no referent.** *"Restoring a tag already recorded in
   `docs/prod-releases.md`"* keys on a `prod-<sha>`, and not one of the nine columns recorded one —
   so the load-bearing distinction between "rollback, no new approval" and "release, needs Oleg" was
   undecidable against the artifact it names. Added a `prod_tag` column and pointed the rule at it.
7. **The ledger could not be filled as the regulation instructed.** The row is appended *before* the
   dispatch, yet `Deploy run id` is *"the run this approval authorised"*, `Approval end (UTC)` is a
   post-hoc fact, and the freeze-break and after-the-fact rollback rules both require writing into a
   row the same file says is *"never rewritten or reinterpreted after the fact"*. Added `pending`
   legal values and a stated rule that post-dispatch facts arrive as a **superseding row** naming the
   row it completes — which is what append-only costs.

**Medium (10).**
8. **AC1's second clause was not met at `811a9b8c`.** The drafting `grep` sweep was file-scoped and
   keyed on `deploy-prod.yml`/`guard`/`rollback`, missing AC1's *s10-contour* clause entirely: the
   freeze-window sentence (*"PROD's window runs…"*), the *"binds Forgejo→s10"* sentence, *"both
   stands are live"*, and two sentences in `docs/prod-releases.md` were present-tense and undated.
   All rewritten dated and forward-formed with owning stories named.
9. **The `CRM/api-prionex` paragraph was stated as present-tense fact with an uncited quote.** It is
   a second-hand observation of another team's repository, established **2026-08-14**
   (`epics.md:2600-2603`, `deferred-work.md:1055-1058`), unverifiable from here. Now labelled as an
   observation, dated, sourced, and the quote restored to its full form.
10. **`#d38` §9 was embellished.** The source says the retention rule was never observed *deleting*
    anything; the regulation added *"or keeping"* as if it were part of the finding. Rewritten so
    that only the source's own disposition marker (`UNPROVEN by execution`) is quoted, the
    "never observed deleting anything" half matches the source, and the "keeping" half is now an
    explicit **entailment** of "verified by compilation, not by execution" rather than a second
    observation. 🔴 *Second pass: the first version of this item claimed the passage was "quoted
    verbatim instead". It is not — only the two-word marker is verbatim, the rest is paraphrase.
    Corrected here.*
11. **`Waiver?`'s legal value dropped the time box `RVC-v1.1` makes mandatory** (*"time-boxed AND
    single-candidate. Both, not either"*) — reproducing precisely the omission `#d41` was written to
    correct. Both halves now required.
12. **The approver's start/end timestamps were claimed mandatory and were not.** Task 4.12 and Dev
    Notes §5 decision 12 rest on them; both columns read only `a timestamp`, and the regulation's
    "How the approval is recorded" section never mentioned them. Now mandatory in both places.
13. **Prohibition 10 — subtasks 1.3 and 1.4 were checked `[x]` while their own bodies read
    `PENDING (owner: coordinator)`.** This is the exact ambiguity Story 5.2's M14 was raised about.
    Both unchecked; the acknowledgement itself stays recorded at Task 7.3, where it belongs.
14. **A stale Debug Log entry contradicted the same file's Task 7.3 and the shipped
    `sprint-status.yaml`**, still reading *"No reply had arrived… `sprint-status.yaml` stays
    `in-progress`"*. Superseded and reconciled — including the mismatch that the ask requested the
    **full text** be relayed while the answer came on a paraphrase.
15. **`forgejo-migration.md` §1.3 does not name Story 6.2.** The story's opening claimed both founding
    sources name it; only `#d5` does. §1.3 says only *"записать в регламент"*.
16. **Completion Note 5 listed four documentary checks where AC8 requires five.** All five now
    enumerated with pointers to their pasted artifacts.
17. **Three procedural paths the regulation left with no rule** (from the edge-case layer, applied
    because each is unambiguous): a derived `fail` with no covering waiver is now explicitly not
    approvable; the freeze window now closes on the smoke check's outcome *whatever it is* — a failed
    check, a failed deploy or a dispatch never made all end it, because a window with no terminating
    event on the failure path is not a rule; and the freeze is stated to bind the s10 stand only, so a
    GitHub→s2 merge deploy is outside it.

**Low (3).**
18. `(Prohibition 16)` cited at §9 — the list has fourteen entries. Corrected to Prohibition 9.
19. The anti-vacuity rule cited as *"Prohibition 14 below"* — it is Prohibition 7.
20. The `#d11` quote in `deferred-work.md` silently dropped *"или порядка эпиков"* mid-quote with no
    ellipsis; and two citations to `docs/release-regulation.md:75` went stale the moment this story's
    own cross-reference line moved that closing line to `:79`. Both restored/dated.

#### 🔴 The retro-E5 correction, called out separately because it is this story's own trap

**§9 specified a "negative control" that does not exist, and Task 3.3 reported it as passed.** The
proposed check — three candidate tags, same shape, same `Verdict` — **could not have come out the
other way on either axis**: `build.yml:933` emits every tag from one template
(`sha-${SHORT_SHA}-${ENV_SUFFIX}`), and `record-preprod-candidate.yml:231-249`'s **G1** refuses
`validated: fail` before any registry read, so the recorded-candidates table can only ever hold
`pass` rows (refusals go to the separate, empty `## Rejected candidates` table). §9 asserted *"if
that comparison ever showed a difference, the rule would be wrong"* — it could not have shown one.
The file proposed a check that could not fail four lines after forbidding exactly that (Prohibition
7). A second defect in the same check: §9 specified the three `preprod-*` **marker** names, which do
not appear in `docs/preprod-candidates.md` at all, so build tags were substituted without the
substitution being named.

**Corrected position, per Prohibition 7's own escape hatch:** the waiver's invisibility at the
registry is **true by construction** — no code path writes a waiver to a tag — and Story 6.2
establishes it by reading the construction, not by a falsifiable check. **This story earns no
negative control and no retro-E5 row, and now says so in §9, Task 3.3 and Completion Note 5.**
Answering the question honestly was always the correct move; the first draft answered it correctly
in general and then manufactured one in particular.

#### Pass 2 — fifteen defects the fix-pass itself introduced, or left behind

Re-reviewed by two fresh adversarial layers against the patched tree, plus the reviewer's own
re-verification of every citation the fix-pass added.

**High (5) — all five are the fix-pass's own work.**
21. **The correction to the inflated "seven checks" claim miscited its own replacement evidence.**
    It cited *"`#d38`-эпоха `:4751`"*, but D38 spans `:4394-4658` — line 4751 is inside **D39 §4**.
    A correction about miscitation that miscites is the worst available outcome; re-pointed to
    `docs/migration-decisions.md:4751`, inside `#d39`.
22. **The Debug Log claimed the duplication check was re-run "with the short-sentence floor
    removed". It was not.** The reviewer's splitter keeps its `len(s) > 12` floor, so the pasted
    `43/49` counts are of filtered units and the shared opening was actually found by `grep`, not by
    the comparison meant to find it. Rewritten to claim only what was established — and the
    conclusion now rests on two independent second-pass reviewers who *did* run floor-free splitters
    and found zero shared sentences. **This is finding 1 reproduced by the fix for finding 1.**
23. **The `Waiver?` column's new example invented a calendar date.** It read
    `D40, single-candidate, expires 2026-09-01`; `grep -n "2026-09"` across the decision record, the
    checklist and the candidate ledger returns nothing. `D40`'s missing expiry is a real open gap
    owned by `RVC-v2` — illustrating the fix with a fabricated date papers over exactly the defect
    the fix exists to expose. Replaced with a placeholder that is visibly a placeholder.
24. **`Approval end (UTC)` was declared `pending`-at-append in prose and mandatory-timestamp-only in
    its column, and the regulation contradicted both.** Substantively the prose was simply wrong:
    the approval *ends* before the dispatch, so neither timestamp is a post-dispatch fact and
    neither ever needed a `pending` form. Two of the fix-pass's own patches (7 and 12) collided and
    neither was reconciled.
25. **`prod_tag` and the rollback rule named two incompatible tag shapes two sentences apart.** The
    column's legal value invoked `deploy-stand.yml`'s guard refusing anything not ending `-prod`,
    while the rollback caveat keyed on a `prod-<sha>` — which does not end in `-prod`, by the
    identical argument the fix-pass itself made about `preprod-<sha>` in finding 5. The column now
    records the dispatched tag verbatim and explicitly leaves the shape to Story 6.4/6.6, and the
    rollback caveat points at that recorded value instead of a shape.

**Medium (5).**
26. **`D42` §3, AC7's own criterion text and §5 item 6 all still said a freeze break is "recorded in
    the same ledger row"** — contradicting the append-only, superseding-row rule the fix-pass had
    just written into `docs/prod-releases.md`. Propagated to all three.
27. **§9's evidence table still graded the impossible comparison ✅ MEASURED.** Only the paragraph
    below the table had been rewritten. The row now states that the comparison it specifies cannot
    be run from the repository, and what the document actually rests on instead.
28. **Five live "110 lines / under the 120-line ceiling" claims survived a fix-pass that corrected
    that exact fact elsewhere** — Task 4.14, Completion Note 2's opener, the File List, Project
    Structure Notes, and `sprint-status.yaml`, which ended up asserting both "110 lines" and
    "shipped 124" inside one file. All updated; the two genuinely historical Change Log rows are
    left frozen, per this project's own append-only convention.
29. **Task 5.2's column list still enumerated nine columns** after `prod_tag` made it ten.
30. **The replacement citation for `#d11` was better but still not exact.** `deferred-work.md:23`'s
    conventions block governs **owner fields in that ledger** and even records an explicit
    exception; it is not a rule about approvals. Rewritten to cite `RVC-v1.1`'s waiver section —
    which really does name Oleg and really does say a waiver from anyone else *"has no effect"* —
    as the authority, with the conventions block cited as precedent for naming a person, labelled
    as exactly that.

**Low (5).**
31. Clearing the 1.3 checkbox left a truncated sentence (*"Declared: —"*). Repaired.
32. The "Verified clean" block quoted `git diff --name-only` but reported the count from
    `git diff --name-only dbec399d` — six versus seven. Both are now named with what each returns.
33. **"Every markdown table in the three shipped docs is column-consistent" was false.**
    `docs/migration-decisions.md` carries five pre-existing column-inconsistent changelog rows from
    Stories 2.1/3.6/4.6/5.5. Untouched by this story and not its to fix — but the claim as written
    did not hold, and is now scoped to the two documents this story creates.
34. Patch item 10 claimed `#d38` §9 was **"quoted verbatim instead"**. Only the two-word disposition
    marker is verbatim; the rest is paraphrase. The item now says so.
35. `docs/prod-releases.md`'s reference to the Story 6.7 smoke check was named but neither dated nor
    forward-formed. Dated.

**Noted, not a defect:** both second-pass reviewers, running floor-free splitters, found exactly one
shared unit between the two regulations — the **heading** `## Where the record lives`
(`release-regulation.md:65` / `production-approval-regulation.md:115`). AC5 covers a shared non-link
**sentence**; a shared section heading on two documents that both end with a pointer list is not
duplication of content, and the bullets underneath them differ entirely. Recorded so that the next
reviewer does not have to rediscover it and wonder whether it was missed.

#### Deferred — real, not this story's to settle

- **Rollback to a tag whose approval carried a time-boxed waiver**, after the box expires — arguably
  a new release. Interacts with `RVC-v1.1`'s waiver scope; **owner: Story 6.5**.
- **Two rollbacks back to back**: the ledger gives the set of approved tags, not what is live, so the
  second target is ambiguous — the same silent-ordering defect already recorded for `preprod-current`.
  **Owner: Story 6.8**, which must prove rollback anyway.
- **An emergency during the first-ever PROD release**, when the ledger is empty and the rollback
  horizon starts at zero (`#d7`): both limbs of the emergency procedure are unavailable at exactly
  the highest-risk moment. The regulation names the horizon problem; the procedure is **6.8's**.
- **Registry/ledger divergence** — a `preprod-<sha>` in the registry with no row, or the reverse.
  **Owner: Story 6.5**, whose guard reads the registry.
- **Which document governs GitHub→s2 releases, and how a divergence between the two live stands is
  reconciled.** The regulation now disclaims s2 explicitly but names no document that covers it;
  Story 6.1 is cancelled, so there may be none. **Owner: Story 7.3**, which absorbs both regulations.
- **`prod_tag`'s exact shape** (`prod-<12hex>` marker vs `sha-<12hex>-prod` build tag) is **Story
  6.4/6.6's**; the column records what was dispatched and does not pre-decide it.
- **`docs/preprod-candidates.md`'s own header names `preprod-<sha>` markers that the file never
  tabulates.** Pre-existing, outside this story's append-only reach. **Owner: Story 6.5.**

#### Verified clean — stated because a review that only lists defects is not a review

Frozen files untouched (`git diff --name-only dbec399d` — **seven** files across the whole story;
the fix-pass alone touches **six**, the difference being `docs/release-regulation.md`, which the
fix-pass did not need to change — no `.forgejo/workflows/*`, no `release-validation-checklist.md`,
no `preprod-candidates.md`) — Prohibition 3 ✅. 🔴 *The first draft of this line quoted the shorter
command and the longer command's count; corrected on the second pass, because a verification line
that mis-states its own command is the defect this review is about.* No row added to
`docs/prod-releases.md` — Prohibition 13 ✅. No second waiver mechanism — Prohibition 4 ✅. No gate
added — Prohibition 6 ✅. No host touched — Prohibition 12 ✅. `sprint-status.yaml` parses and its
`6-2-…` row reads `review` ✅. **Every markdown table in the two documents this story creates**
(`docs/production-approval-regulation.md`, `docs/prod-releases.md`) is column-consistent ✅ — 🔴
*scoped down on the second pass: the first draft said "the three shipped docs", which is false,
because `docs/migration-decisions.md` carries five pre-existing column-inconsistent changelog rows
from Stories 2.1/3.6/4.6/5.5. They are untouched by this story and are not its to fix, but the
claim as written did not hold.*
**D42 is genuinely free**: `git grep '^## D[0-9]'` across **every** remote ref returns a maximum of
D41 anywhere but this branch (`story-4-9/pr-1-context` holds D35, as the story says) ✅. Every anchor
resolves — `#d2`, `#d5`, `#d11`, `#d38`, `#d40`, `#d41`, `#d42` all have a matching `<a id=…>`, and
`release-validation-checklist.md#the-waiver` resolves to `## The waiver` at `:805` ✅. **The `#d2`
Russian quote is character-for-character verbatim** against `migration-decisions.md:135-136` ✅, dated,
with Story 6.5 named as reviser and a forward note placed inside `#d2`'s body rather than at EOF ✅.
**The `sha-a99ccd44c5a3-preprod` precedent is exact**: `7/12 pass, 5 BLOCKED (F5 F6 F7 F8 F10)`,
derived verdict `fail` by `RVC-v1`'s unconditional rule (`P=7 ≠ 12`), dispatched `pass` under `D40`
— confirmed against `docs/preprod-candidates.md:74`, `release-validation-checklist.md:1038` and the
Execution Log's own counts line ✅. The `ls .forgejo/workflows/` listing pasted at Task 3.1 matches
the tree exactly, eleven entries, no `deploy-prod.yml` ✅.

---

## Open Questions for Review

0. ✅ **RESOLVED, 2026-08-25 — the two code-review decisions.** **D1:** the paraphrase Oleg actually
   answered is now pasted verbatim at Task 7.3, and epic AC4's plural is settled by his own words,
   *"Я и есть команда"* — the set of teams has one member, stated by the owner rather than inferred.
   **D2:** no delegate, *"Оставить как есть"* — an accepted risk with a named owner, a date, and its
   cost written into the regulation itself (while Oleg is unavailable, an emergency rollback to a
   non-ledger tag is blocked along with everything else).
1. ✅ **RESOLVED, 2026-08-25.** AC4's acknowledgement landed: *"Подтверждаю"* — Oleg Kuksa
   (`geloniel@gmail.com`), 2026-08-25, relayed by the coordinator. **Recorded as "confirmed by
   paraphrase"**, not "read the document directly" — the coordinator's Russian paraphrase covered
   every section and named the live `sha-a99ccd44c5a3-preprod` precedent explicitly; the same
   attested-vs-observed register 5.6 held. Full text at Task 7.3.
2. ✅ **RESOLVED before this session started.** All fifteen autonomous decisions in Dev Notes §5
   were relayed to Oleg and none was vetoed — confirmed by the coordinator's own message at the
   start of this dev-story session. Both §2 (separate file) and §4 (`docs/prod-releases.md`) stand
   as written; Task 4 proceeded on them without a further ask.
3. 🔴 **Does the tag-protection rule belong in this regulation?** `deferred-work.md` asks the
   question of Story 6.2 **by name** (Story 1.13's Open Question 5): whether the rule *"cut `v*`
   only from commits carrying `.forgejo/workflows/"* belongs here, alongside the facts that **there
   is no tag protection at all** and that `development` carries no branch-protection rule.
   **Recommendation: no** — `#d18`/`#d20` dropped semver outright, **zero tags of any kind exist in
   this repository**, and no story consumes one, so the rule would govern nothing. Recorded rather
   than dropped, because it was asked of this story by name. **`PENDING (owner: Oleg)`.**
4. **Does the regulation bind the legacy s2 pipeline at all?** §5 item 9 states which stand is
   authoritative; it deliberately does **not** claim authority over a GitHub merge, because no action
   is taken on GitHub (`#d7`) and Story 6.1 is cancelled for that reason. If Oleg wants the rule to
   cover s2 releases too, that is a wider scope than this story's ACs and should be said.

## Change Log

| Date | Change |
|---|---|
| 2026-08-25 | **`origin/main` merged in after Epic 5 closed — recorded here because §11 required the integration to be recorded, and because the instruction it supersedes said "rebase".** PR #87 (Story 5.6's ledger-closeout) merged while this story was in code review, moving `origin/main` `dbec399d` → **`aae711b1`** and closing **Epic 5 at 6/6**. §11, Task 1.2, Dev Notes §2, Project Structure Notes and `sprint-status.yaml` all said "rebase when it merges" — written before this branch had a PR. **PR 88 was already open and its history already code-reviewed, so rewriting it was not available: `origin/main` was taken by `git merge --no-ff`, not by rebase.** All five stale instructions corrected in place rather than left to read as unfollowed. **One conflict, `sprint-status.yaml` at the `epic-6:` line, resolved by keeping BOTH sides whole and neither absorbed:** `main`'s new "UPDATE FROM STORY 5.6" comment block is preserved verbatim as 5.6's closeout wrote it, and the *value* is this story's `in-progress` rather than `main`'s `backlog` — the two are not in conflict on the merits, since `main` wrote that block while Epic 6 had not started and Story 6.2 (Epic 6's first, 6.1 cancelled) started it. A merge-resolution comment records that reasoning at the line itself instead of leaving a block that ends in `backlog` sitting above a value of `in-progress`. Story 5.6's own spec file merged clean (only `main` touched it). Verified after the merge: YAML parses, `epic-5` `done` with all six 5-x rows `done`, `5-6` `done`, `epic-6` `in-progress`, `6-2` `review`, and the merge brought nothing into this story's seven files beyond the conflict resolution itself. |
| 2026-08-25 | **Code-review decisions D1 and D2 answered by Oleg and applied — both recorded as his decisions, not as the reviewer's reading of them.** **D1(a):** asked whether one confirmation satisfies epic AC4's *"the development and release teams"*, Oleg answered verbatim **«Я и есть команда»**. Recorded as the owner's own statement about team composition, dated 2026-08-25 — AC4 is met because the set of teams it names has exactly one member, on his testimony, not by an assumption and not by working around the word "teams". **D1(b):** the coordinator supplied the paraphrase that `Подтверждаю` actually answered, and it is pasted **verbatim, unedited, untranslated** at Task 7.3 under «текст, по которому дано подтверждение (координатор → Олег, 2026-08-25)» — before this, the attestation pointed at material that existed nowhere (Prohibition 9). ⚠️ Recorded next to it rather than smoothed: **three record-keeping specifics inside the confirmed text were changed by this review after he confirmed it** — the freeze break moved from "the same ledger row" to a superseding row, `#d38` §9's "or keeping" became an entailment rather than a finding, and the ledger row gained the two timestamps plus `prod_tag`. The authority model he authorised is unchanged; the three deltas only make the record able to hold the rules, and each is enumerated at Task 7.3. **Task 4.15's scope was carved out explicitly, not silently:** the pasted block is a paraphrase OF the regulation and restates it by construction, so it was pasted into the spec and never into the regulation; 4.15's subjects are the two published regulations, and re-verification after insertion confirms **zero shared sentences** between them, both regulation files untouched. **D2:** Oleg answered **«Оставить как есть»** — there is no delegate. Written into the regulation's own "Who approves" section as an accepted risk with its cost stated concretely: while Oleg is unavailable nothing can be approved, **including an emergency rollback to a tag not already in the ledger**, which the document itself classifies as a release — so the blocked case is precisely the unplanned one; a rollback to a ledger tag needs no approval and stays available. Risk owner Oleg, accepted 2026-08-25; mirrored into `deferred-work.md` as an ACCEPTED RISK and into `D42` §3. AC8's ceiling raised a second time, 125 → 130 (shipped **127**), and the reason is deliberately recorded as a DIFFERENT kind from the first raise: the first bought provenance for rules already present, the second holds a rule that did not exist before. Every reviewer-facing annotation was trimmed out of the regulation first. |
| 2026-08-25 | **Code review (Opus, three adversarial layers + independent fact-verification): changes requested, all applied this same pass.** **Two adversarial passes, and the second one earned its keep: 35 numbered findings applied in total — pass 1: 20 (7 high / 10 medium / 3 low); pass 2: 15 (5 high / 5 medium / 5 low), and all five of pass 2's highs were introduced by pass 1's own fixes.** 7 deferred with named owners, 2 decisions routed to Oleg. **The four that mattered, all defects of TRUTH rather than of code, which is the only kind a documentation story can have:** (1) AC5 was NOT met — both regulations opened with the byte-identical "One page. No new gate, no new machinery.", and the Task 4.15 check that reported "zero shared sentences" had a length floor that never compared the opening line; the claim had already propagated into D42, the D42 changelog row and sprint-status. (2) `_bmad/bmm/config.yaml` was cited under the word "Измерено" for two keys it does not contain — they live in sprint-status.yaml:72-73 — and the false citation had entered docs/migration-decisions.md, a file this project forbids rewriting retroactively. (3) The job-log argument for creating the ledger contradicted the project's own SETTLED 2026-08-16 finding (archival is DELAYED, not absent: 4128 t vs 461 f) and inflated six observations to seven. (4) `#d11` was cited for a named-approver convention it does not contain — the same defect shape that produced D41 one story earlier. **Also: AC1's second clause was not met** (the drafting grep sweep was file-scoped and missed AC1's own s10-contour clause, plus two present-tense sentences in docs/prod-releases.md); **the ledger could not be filled as instructed** (row appended before the dispatch, yet Deploy run id / Approval end / freeze-break / after-the-fact rollback all require post-dispatch facts in a row the file says is never rewritten — fixed with `pending` values and a superseding-row rule); **and the rollback rule keyed on a `prod-<sha>` no column recorded** — a `prod_tag` column added. 🔴 **The retro-E5 correction is the one worth remembering: §9 specified a "negative control" that could not have failed on either axis** (build.yml:933's single tag template; G1 refusing `validated: fail` before any registry read, so the recorded table can only ever hold `pass`), and it proposed it four lines after Prohibition 7 forbids exactly that. This story earns NO negative control, and §9, Task 3.3 and Completion Note 5 now say so. AC8's 120-line ceiling raised to 125 (shipped at 122) with the reason recorded — the review's dating, sourcing and citation fixes cost twelve lines of provenance, and cutting sourcing to hold a number would trade a true document for a short one. Frozen files, Prohibitions 3/4/6/12/13, the D42 number, every anchor, the #d2 quote and the sha-a99ccd44c5a3-preprod precedent all verified clean across both passes. 🔴 **Pass 2 then found 15 more, five of them high, and every one of those five was introduced by pass 1's own fixes** -- a miscitation inside the miscitation correction (#d38 cited for line 4751, which is in #d39), a Debug Log claim that the duplication check had been re-run "with the short-sentence floor removed" when it had not, an INVENTED expiry date (`expires 2026-09-01`) in the Waiver? example illustrating the very rule against invented dates, an `Approval end (UTC)` cell declared both pending-at-append and mandatory-timestamp-only, and a `prod_tag` column whose legal value contradicted the rollback rule two sentences later. All fixed and recorded item by item as findings 21-35. Final: 35 applied, 7 deferred with owners, 2 decisions for Oleg; the regulation ships at 127 lines. **The reusable lesson: a fix-pass that is not re-reviewed is just a second draft.** |
| 2026-08-25 | **Dev-story Tasks 1-6 executed in full; Task 7 partially -- HALT on AC4.** `docs/production-approval-regulation.md` written (110 lines, under the 120-line ceiling): who approves, preconditions, the ledger-not-tag rule with the sha-a99ccd44c5a3-preprod precedent, how approval is recorded, attested-vs-observed, no technical gate (every forward reference dated, six present-tense slips caught by a grep sweep and fixed), the freeze window, rollback authority, emergency/hotfix reusing RVC-v1.1's waiver, two production stands, and the two-sentence comparison with CRM/api-prionex's gate. Zero shared sentences with docs/release-regulation.md (programmatic diff). `docs/prod-releases.md` created empty, no placeholder row, Waiver? mandatory. docs/release-regulation.md received exactly one cross-reference line. D42 written in migration-decisions.md; a forward note appended under #d2 without rewriting it. deferred-work.md records AC4 as outstanding, owner Oleg via the coordinator. All fifteen autonomous decisions in Dev Notes Sec.5 were already ratified before this session (no veto) -- confirmed by the coordinator. The finished regulation text was sent to the coordinator for Oleg's confirmation; no reply had landed by the time this file was saved. Per the story's own Sec.3 HALT mapping, sprint-status.yaml's 6-2 row stays in-progress, Task 7.3/7.5/7.6 left unchecked. |
| 2026-08-25 | **AC4 landed -- HALT lifted, Status -> review.** Oleg's verbatim reply: "Подтверждаю" -- Oleg Kuksa (geloniel@gmail.com), dated 2026-08-25, relayed by the coordinator. Recorded honestly as confirmed-by-paraphrase, not read-the-document-directly: the coordinator's Russian paraphrase covered every section and named the live sha-a99ccd44c5a3-preprod precedent explicitly. Two of three offered options (amend the rollback rule; authorise a forward hotfix) were explicitly declined, confirming both rules as written, on the record, not by silence. Task 7.3 pastes the full attestation; deferred-work.md's Story 6.2 entry closed under the original, struck not deleted; sprint-status.yaml's 6-2 row flipped to review and pushed. PR-open PENDING (owner: coordinator); Oleg merges. |
| 2026-08-25 | Story created. Context bound against `origin/main` at `dbec399d` from a scratchpad worktree -- the primary checkout belongs to Story 4.9's dev agent. **SS2 decides the overlap with Story 5.6's `docs/release-regulation.md`: a SEPARATE file, one cross-reference line into 5.6's document, and no restated sentence -- five reasons recorded (different subject; the PRE-PROD title; AC4 attaches to a named document; 5.6's artifact is freshly shipped and frozen by precedent; Epic 7's 7.3 absorbs both anyway).** SS3 records the ordering finding: `sprint-status.yaml` constrains only 6.10-before-6.4, 6.2 depends on neither 6.3 nor 6.10, two later stories (7.3 and the decommissioning note) consume what 6.2 writes, and the real dependencies -- unbuilt machinery vs AC1's second clause, 6.5 rewriting `#d2`, AC4's human acknowledgement -- are handled in-story rather than by re-ordering. SS4 records that "the tracker" in AC2 has no referent (`tracking_system: file-system`, `project_key: NOKEY`, the word appears once in the whole plan -- in this AC) and resolves it to a new append-only `docs/prod-releases.md`, on the three-tier precedent 5.4 established after job logs proved unreliable here. Four ACs added (AC5-AC8). SS9 states plainly that a documentation-only story earns almost no retro-E5 evidence and offers five zero-run documentary checks instead, one of them a real negative control. Fifteen autonomous decisions listed for a one-read veto. |
