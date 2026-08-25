<!-- Story 6.2. Epic 6's FIRST story (6.1 is cancelled). Written 2026-08-25 by the create-story
     context engine, from a scratchpad worktree off fresh origin/main.
     READ THE WHOLE "Read this before anything else" BLOCK BEFORE THE FIRST TASK.
     §2 is the decision this story exists to get right — whether to extend Story 5.6's shipped
     document or write a new one — and it is already decided, with the argument, in §2. §3 is the
     ordering finding: this story writes about controls that DO NOT EXIST YET, and its own AC1
     forbids describing a control that does not exist. Those two sentences are in tension by
     construction and §3 says how to hold both. §11 states what this story may not touch. -->

# Story 6.2: Publish the Production Approval Regulation

Status: ready-for-dev

## Story

As a tech lead,
I want the production approval rules written down before the first Forgejo release,
So that the absence of a technical gate is a managed decision rather than an unnoticed gap.

---

## 🚨 Read this before anything else

### 1. What this story is, in one paragraph

Forgejo has no equivalent of GitHub Environments with required reviewers. That was established on
day one, accepted rather than deferred, and recorded twice — `docs/forgejo-migration.md` §1.3 and
`docs/migration-decisions.md#d5`, both of which name **story 6.2** as the place the resulting rule
gets written. So the control on a production release is organizational, and this story is that
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

**Measured:** `_bmad/bmm/config.yaml` carries `tracking_system: file-system` and
`project_key: NOKEY`. The string `tracker` appears in `_bmad-output/planning-artifacts/epics.md`
**exactly once — in Story 6.2's own AC**. There is no Jira project, no issue tracker of any kind
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
75 lines and that is the benchmark, not a floor.

| # | Candidate content | Verdict | Where its substance comes from |
|---|---|---|---|
| 1 | **Who may approve a production release** | ✅ **IN — AC2.** Oleg, as the release's owner. Not a role, a name — the same authority `RVC-v1.1`'s waiver section already states as a rule (*"Only **Oleg, as the release's owner**"*). Reuse that authority, do not invent a second one. | `docs/release-validation-checklist.md`, `## The waiver` |
| 2 | **How the approval is recorded, auditably** | ✅ **IN — AC2.** One row in `docs/prod-releases.md`, appended before the dispatch, carrying the `image_tag`. §4. | `docs/preprod-candidates.md` precedent |
| 3 | **What must be true before approval is even sought** | ✅ **IN.** A recorded candidate exists (`preprod-<sha>` in the registry), its `RVC-v1.1` Execution Log section is written, and its row in `docs/preprod-candidates.md` is appended — with its **derived** verdict and **any waiver** visible. | `RVC-v1.1`; Epic 5's shipped cycle |
| 4 | 🔴 **The waiver is invisible at the promotion gate — so the approver reads the ledger, not just the tag** | ✅ **IN, and this is the single most valuable sentence in the document.** `RVC-v1.1` says it outright: a waiver *"carries no signal at the registry … so a promotion gate reading only the registry cannot tell a waived candidate from a clean one"*. 6.5's guard checks that `preprod-<sha>` **exists**. It cannot see that seven of twelve items passed and five were waived. **A rule that the approver must read `docs/preprod-candidates.md` before approving is a policy fix for a gap no technical fix in 6.5 closes** — and it does not step on 6.5's work. | `docs/release-validation-checklist.md`, `## The waiver`, last paragraph |
| 5 | **What the approver attests vs what the machine proved** | ✅ **IN — AC3, and it is 5.6's own distinction applied one environment up.** The machine proves *"a `preprod-<sha>` tag exists for this commit"*. It does **not** prove the artifact was validated — under Option C the PROD image is a **separate build, byte-different** from the one PRE-PROD served. `#d2`'s own sentence is the one to quote: *"зелёная валидация на PRE-PROD — это свидетельство об исходном коде, а не о байтах, которые поедут в прод."* The approver attests to the **decision to release**; the machine attests to **commit identity**; nobody attests to the bytes. | `docs/migration-decisions.md#d2`; NFR11 |
| 6 | **The freeze window, and who may break it** | ✅ **IN.** Distinct from 5.6's PRE-PROD freeze and stated **as a difference, with a link**, not as a copy. PRE-PROD's window runs P1 → recorder. **PROD's window runs from the approval row being appended to the smoke check passing** (6.7), and inside it no other dispatch targets the PROD stand. Who may break it: **only Oleg, and the break is recorded in the same ledger row.** | `docs/release-regulation.md`, `## The scope-freeze agreement` (link, do not copy) |
| 7 | **Rollback authority** | ✅ **IN, and it needs its own rule precisely because the guard is skipped.** FR16/`#d2`: *"При `rollback: true` гейт пропускается — намеренно"*. So a rollback dispatch has **no** technical barrier at all. The rule: **restoring a tag already present in `docs/prod-releases.md` is not a new release and needs no new approval** — it returns the system to a state already approved — **but it is recorded in the ledger after the fact.** A rollback to a tag **not** in the ledger is a release and needs Oleg. 🔴 **And one sentence of honest small print, because it is what makes rollback authority meaningful at all: rollback depends on the previous `prod-<sha>` tag still existing, and the retention rule that is supposed to protect it has NEVER been observed deleting — or keeping — anything.** `#d38` §9 marks it **UNPROVEN by execution**; the first date it can be observed is **2026-08-29** and that dated item still has **no owner**. Compounding it, `#d7`: every pre-migration image lives in ghcr and is unreachable, so **the rollback horizon starts at zero at cutover** and Story 6.8 must be proven **before** the first real release, not after. | `#d2`, `#d38` §9, `#d7`, FR24, Stories 6.6/6.8 |
| 8 | **How an emergency / hotfix differs** | ✅ **IN, and the honest answer is that there is no forward hotfix path today.** A hotfix that skips PRE-PROD has no `preprod-<sha>`, so 6.5's guard refuses it. The emergency procedure is therefore **(1) roll back, (2) fix through the normal cycle.** If a genuine forward hotfix is ever unavoidable it requires a `preprod-<sha>`, i.e. an abbreviated `RVC-v1.1` run under **Oleg's written waiver — `RVC-v1.1`'s existing mechanism, not a second one invented here.** Reuse; do not duplicate. | `RVC-v1.1` `## The waiver`; FR16 |
| 9 | 🔴 **Two production stands will serve at once, and the document must say which is authoritative** | ✅ **IN — one short section.** 6.1 is cancelled: GitHub still deploys to s2 on a merge to `main`. NFR5 **as amended 2026-08-18** makes the guarantee absolute — *"Forgejo never deploys to s2 at all"* — so the two pipelines target **different hosts**, and between Story 6.9's no-op deploy and the external traffic switch **both stands are live**. The regulation states which one users are on and that a Forgejo release changes nothing for them until the switch. | epics.md Epic 6 preamble; Story 6.9's 2026-08-18 amendment; NFR5 |
| 10 | 🔴 **The approver records his own start and end time** | ✅ **IN — one line, and it repairs a hole the PRE-PROD side could not.** `RVC-v1.1`'s Execution Log has a `Started (UTC)` field and **no end-time field**, so *"one continuous session" is unverifiable from the record that governs it*, and the human validator's own observations carry **no timestamp anywhere** — meaning they cannot be placed inside the P1-to-recorder bracket the scope freeze is defined over, *"they almost certainly were, but by inference."* **This document's own freeze window (item 6) has exactly the same shape, so the ledger row carries both timestamps and the hole does not repeat.** *(Fixing `RVC-v1.1` itself is `RVC-v2`'s — not touched here.)* | `deferred-work.md`, `RVC-v2` item |
| 11 | 🔴 **The approval record must state the waiver explicitly, in a defined place** | ✅ **IN — it is item 4's enforcement half.** The shipped `validation_note` carries a `— waiver <Dnn>, <scope> —` clause **that `RVC-v1.1`'s Format block does not define**, so *"the next waived note may legally omit it and **hide a waiver**"* — an open `RVC-v2` item. The production ledger does not inherit that hole: **`Waiver?` is a mandatory column with a defined legal value** (`none`, or the `D`-number with its scope), and a row with the cell blank is not a valid approval record. | `deferred-work.md`, `RVC-v2` item; §4 |
| 12 | 🔴 **What the neighbouring team's PROD gate does, and honestly how ours compares** | ✅ **IN — two sentences, no more.** `CRM/api-prionex` already gates its own production promotion: manual `workflow_dispatch` with an **explicit release sha, never derived from a branch head**, and `ops/deploy/validate-preprod-digests.sh` comparing the **digests of the containers actually running on PRE-PROD** against the release manifest — *"Digests, not tags: a tag can be moved, a digest cannot. **There is no bypass flag.**"* Ours proves **commit** identity and has a bypass (`rollback: true`). Epic 6.5's own AC requires our guard to be positioned as **the frontend half of that existing pattern**, not an independent mechanism. **Saying so in the regulation is honesty about our own weaker position; building their check is 6.5's, not this story's.** | `deferred-work.md`; epics.md Story 6.5 AC2 |
| 13 | Tag protection, and whether the `v*` rule belongs here | ⚠️ **NAMED, NOT DECIDED — routed to Oleg as an Open Question.** `deferred-work.md` asks in so many words whether the tag rule (*"cut `v*` only from commits carrying `.forgejo/workflows/"*) *"belongs in the Story 6.2 production-approval regulation (Story 1.13's Open Question 5)"*, and records that **there is no tag protection at all**. 🔴 **But `#d18`/`#d20` dropped semver outright — zero tags of any kind exist in this repository and no story consumes one** — so a rule about cutting `v*` tags would govern nothing. **Recommendation: it does not belong here.** Recorded as Open Question 4 rather than silently dropped, because the question was asked of this story by name. | `deferred-work.md`; `#d18`, `#d20` |
| 14 | `secrets: inherit`, `KONG_PORT` on PROD, M7's eight unexercised recorder branches | ❌ **OUT — named in §7, resolved nowhere.** These are engineering decisions owned by 6.4. An approval regulation that tries to settle them is scope creep, and `#d33` §6 DN1 says `secrets: inherit` is a decision required **before Story 6.4 starts**, not during it. | §7 |
| 15 | A new gate, a new checklist, a new machine-readable format, a notification step | ❌ **OUT.** 5.6's document closes with *"This document adds no gate and no machinery. It states an agreement, not a control."* Same posture here. NFR9 is the reason there is no gate to add; **Story 4.5 being parked is the reason there is no notification to describe** — today the approval and the deploy outcome reach a human only if someone pastes a log excerpt, and the standing rule from four stories is that **no deploy story may block on the channel** (§7 item 5). | `docs/release-regulation.md:75`; `deferred-work.md` |

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
this project has rejected four times** (D34 §3; Story 5.1's review; Story 5.2's H2; Prohibition 14
below). **Say that in the Dev Agent Record in those words.**

What *is* honestly available, and what the story does instead — **every row costs zero runs**:

| Claim the regulation makes | Status | How it is evidenced, or why it cannot be |
|---|---|---|
| "Anyone with repository write access can dispatch a production deploy" | **INHERITED — dated, not re-measured** | It is a property of the *platform*, established 2026-08-07 (`#d5`, `forgejo-migration.md` §1.3) and restated by NFR9. `deploy-prod.yml` does not exist, so it cannot be measured against the real target. **Cite the dated source; do not claim a fresh measurement.** |
| "`deploy-prod.yml` does not exist as of 2026-08-25" | ✅ **MEASURED, zero runs** | `ls .forgejo/workflows/` — 11 files, enumerated in the Dev Agent Record. **Paste the listing; do not characterise it** (Prohibition 16). |
| "The promotion guard is designed, not built" | ✅ **MEASURED, zero runs** | `docs/migration-decisions.md#d2`'s own status header, quoted verbatim. |
| "A waived candidate is indistinguishable from a clean one at the registry" | ✅ **MEASURED, zero runs** | The three rows of `docs/preprod-candidates.md` vs the three `preprod-*` marker names. Candidate #3 was recorded under waiver `#d40`; **its tag carries no trace of that.** This is the document's central claim and it is checkable against files already in the repository. |
| "A waiver exists and has been used once" | ✅ **MEASURED, zero runs** | `#d40` (the waiver), `#d41` (its mechanism), `RVC-v1.1` `## The waiver`, and candidate #3's `Note` cell — four independent artifacts, all on `main`. |

🔴 **One negative control is available and is not optional because it is free.** The regulation's
central rule (item 4 in §5) is *"the tag alone cannot tell you a candidate was waived"*. Its
discriminating check: take the **cleanest** candidate on record and the **waived** one, and show that
their registry tags are **the same shape and carry the same information**. If that comparison ever
showed a difference, the rule would be wrong. Run it against the already-committed files, paste both,
and say which conclusion it supports. **That is the closest thing to an E5 row this story can
legitimately earn, and it is a documentary control, not a live one — label it as such.**

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
4.9's.** Epic 5's closeout **PR #87** may merge mid-session — **rebase onto fresh `origin/main` when
it does**, and record the rebase in the Change Log the way Stories 5.2 and 5.6 did.

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
who may break it, with the break recorded in the same ledger row
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
regulation is 75 lines
**When** the regulation is published
**Then** it is of comparable length — **a hard ceiling of 120 lines** — with every deferral, open
item and long argument living in the decision record or in this story file rather than in the
document
**And** 🔴 **the Dev Agent Record states plainly that this story introduces no guard and therefore
earns almost no retro-E5 evidence, lists the five zero-run documentary checks of §9 with their
artifacts pasted, and labels the negative control as documentary rather than live (Prohibition 7).**

---

## Tasks / Subtasks

### Task 1 — Open the story honestly, and ask for AC4 on day one (AC: 4) — **costs 1 push row**
- [ ] 1.1 Flip `sprint-status.yaml` `6-2-…` → `in-progress` **before any content edit**, and push
      that transition on its own. *(Story 5.2's Task 1.1 stays permanently unchecked because this
      flip was claimed and never pushed; do not repeat it.)*
- [ ] 1.2 Confirm `epic-6` reads `in-progress` (set by this context story). If PR #87 merged
      meanwhile, **rebase onto fresh `origin/main`** and record it in the Change Log.
- [ ] 1.3 Declare the ledger baseline. **`PENDING (owner: coordinator)`** — the dev agent does not
      query the API. Record floor **4**, ceiling **8**, disposition **OPEN** (§10).
- [ ] 1.4 🔴 **Compose ONE consolidated message for Oleg and hand it to the coordinator** — do not
      drip requests. It contains: (a) the **AC4 acknowledgement ask**, naming who counts as "the
      development and release teams" and asking for a quotable, dated statement; (b) the §2
      separate-file decision, for a one-read veto; (c) the §4 `docs/prod-releases.md` decision, for
      a one-read veto; (d) the veto table in Dev Notes §5, whole. Mark
      **`PENDING (owner: Oleg, via coordinator)`**.
- [ ] 1.5 Verify the next free decision number. `main` holds **D41**; **D42** is next. 🔴 **Re-verify
      by `git fetch` across every open `story-*` branch, not just `main`** — Story 4.9 holds D35 on
      an unmerged branch and that is exactly how a collision happens. *(Checked at context time:
      max across all branches was D41; re-check, do not trust this line.)*

### Task 2 — Read the documents you must not duplicate, and prove you read them (AC: 5) — **0 runs**
- [ ] 2.1 Read `docs/release-regulation.md` end to end (75 lines). List its four section headings
      in the Dev Agent Record.
- [ ] 2.2 Read `docs/release-validation-checklist.md`'s `## The waiver` section end to end. Quote
      the three clauses the new document depends on: who may issue, what it may cover, and *"the
      waiver changes what gets dispatched, never what is derived"*.
- [ ] 2.3 Read `docs/preprod-candidates.md` (126 lines) — both tables, the header's three-tier
      model, and candidate #3's `Note` cell.
- [ ] 2.4 Read `docs/migration-decisions.md` **#d1, #d2, #d5, #d40, #d41** and
      `docs/forgejo-migration.md` **§1.1, §1.3**. Quote `#d2`'s status header verbatim.
- [ ] 2.5 🔴 **Write the one-paragraph overlap statement** that will go into D42: what 5.6's
      document covers, what this one covers, why they are separate, and the single sentence that
      links them. **If this paragraph cannot be written without overlap, the §2 decision is wrong —
      stop and raise it as an Open Question rather than writing a document that duplicates.**

### Task 3 — Gather the zero-run evidence §9 specifies (AC: 1, 6, 8) — **0 runs, and that is the point**
- [ ] 3.1 `ls .forgejo/workflows/` — **paste the listing verbatim**. It is the evidence that
      `deploy-prod.yml` does not exist.
- [ ] 3.2 Quote `#d2`'s status line verbatim: *"Статус: спроектировано, не реализовано — обновить в
      story 6.5."*
- [ ] 3.3 🔴 **The negative control (§9).** Put the three `preprod-*` candidate tags side by side
      with their three ledger rows and show that the **waived** candidate (#3) and the **unwaived**
      ones are **indistinguishable by tag shape and tag content**. Paste both halves. State which
      conclusion it supports and **label it documentary, not live**.
- [ ] 3.4 Record the four artifacts that evidence the waiver's existence and single use: `#d40`,
      `#d41`, `RVC-v1.1 ## The waiver`, candidate #3's `Note` cell.
- [ ] 3.5 Zero runs are spent by this entire task. **Say so** rather than leaving it inferred.

### Task 4 — Write `docs/production-approval-regulation.md` (AC: 1, 2, 3, 6, 7, 8) — **0 runs**
- [ ] 4.1 Header: title, one-line statement of what it is and is not, the date it was written, and
      **the sentence that it adds no gate** (NFR9). Cross-link to `docs/release-regulation.md` and
      to `RVC-v1.1` immediately, so the reader knows what is *not* here.
- [ ] 4.2 **Who approves** — Oleg, as the release's owner, by name; the same authority `RVC-v1.1`'s
      waiver section names. Not a role. (AC2)
- [ ] 4.3 **What must be true before approval is sought** — a recorded candidate under `RVC-v1.1`,
      its Execution Log section written, its `docs/preprod-candidates.md` row appended with its
      **derived** verdict and **any waiver** visible. (AC2, AC6)
- [ ] 4.4 🔴 **The approver reads the ledger, not just the tag** — with the
      `sha-a99ccd44c5a3-preprod` precedent named: 7/12 pass, 5 BLOCKED, derived `fail`, dispatched
      `pass` under `#d40`, **and no trace of any of that on the tag**. (AC6)
- [ ] 4.5 **How the approval is recorded** — one row in `docs/prod-releases.md`, appended **before**
      the dispatch, carrying the `image_tag`. (AC2)
- [ ] 4.6 **Attested vs observed** — what the approver attests, what the machine proves, and what
      **nobody** attests (the bytes). Quote `#d2` and date the citation; name Story 6.5 as its
      reviser. (AC3)
- [ ] 4.7 **No technical gate** — anyone with write access can dispatch; state it plainly, cite
      NFR9 and `#d5`. Every forward reference **dated and forward-formed** (Prohibition 1). (AC1)
- [ ] 4.8 **The freeze window** — approval row appended → smoke check passes; who may break it
      (Oleg only, recorded). **By link to 5.6's section, stating the difference, not by copy.** (AC7)
- [ ] 4.9 **Rollback authority** — the guard is skipped by design; restoring a tag already in the
      ledger is not a new release; a tag not in the ledger is. (AC7)
- [ ] 4.10 **Emergency / hotfix** — no forward hotfix path exists today; roll back, then fix through
      the normal cycle; a genuine forward hotfix needs an abbreviated `RVC-v1.1` run under
      **`RVC-v1.1`'s own waiver**. (AC7, Prohibition 4)
- [ ] 4.11 **Two production stands** — GitHub→s2, Forgejo→s10, NFR5 absolute, and which is
      authoritative for users until the external traffic switch. One short section. (AC7)
- [ ] 4.12 🔴 **The approver records his own start and end time** in the ledger row — one line.
      `RVC-v1.1`'s Execution Log has a `Started (UTC)` and **no end field**, which is why "one
      continuous session" is unverifiable on the PRE-PROD side. **The PROD freeze window has the
      same shape; do not repeat the hole.** (AC7, §5 item 10)
- [ ] 4.13 🔴 **State how our guard compares with the neighbouring team's** — two sentences, no
      more. `CRM/api-prionex` gates PROD on an explicit release sha and on the **digests of
      containers actually running on PRE-PROD**, with **no bypass flag**; ours proves the **commit**
      and has a bypass. Say so; do not build theirs. (AC3, §5 item 12)
- [ ] 4.14 🔴 **Count the lines. Hard ceiling 120.** If it is over, cut argument into D42 — never
      cut a rule. (AC8)
- [ ] 4.15 🔴 **`diff` the new file against `docs/release-regulation.md`.** Any shared sentence that
      is not a link is a defect: fix it by replacing the copy with the link. (AC5)

### Task 5 — Create `docs/prod-releases.md`, empty (AC: 2) — **0 runs**
- [ ] 5.1 Header stating what the file is, that it is **append-only**, and that **a row is never
      rewritten or reinterpreted after the fact, even by later events** — the exact discipline
      `docs/preprod-candidates.md` states for itself.
- [ ] 5.2 Column definitions, with `image_tag` mandatory (AC2). Suggested and open to the dev
      agent's judgement: `Date (UTC) | image_tag | Candidate (preprod-<sha>) | Approved by |
      Waiver? | Approval start (UTC) | Approval end (UTC) | Deploy run id | Note`. **Define what a
      legal value is for each**, including the legal text when a value cannot exist — 5.6's
      `N/A — refused before any registry read` precedent.
- [ ] 5.2a 🔴 **`Waiver?` is mandatory and has a defined legal value** — `none`, or the `D`-number
      with its scope. **A blank cell is not a valid approval record.** This is the enforcement half
      of §5 item 4 and it exists because `RVC-v1.1`'s own note format leaves the waiver clause
      undefined, so a waived note may legally omit it and hide the waiver (§5 item 11).
- [ ] 5.3 🔴 State in **prose** that the table has no rows and why no placeholder row exists.
      **Do not add a row.** (Prohibition 13)
- [ ] 5.4 Cross-link: from this file to the regulation, and from the regulation to this file.

### Task 6 — Cross-references and the decision record (AC: 3, 5) — **0 runs**
- [ ] 6.1 🔴 **Exactly one line** added to `docs/release-regulation.md`, pointing at the production
      document and saying in half a sentence what lives there instead. **No other edit to that
      file.** (AC5, Prohibition 3)
- [ ] 6.2 Write **D42** in `docs/migration-decisions.md` (in Russian, matching every other record):
      the separate-document decision and its five reasons; the tracker→`docs/prod-releases.md`
      substitution and why; the approval/rollback/emergency authority model; the explicit statement
      that the emergency path **reuses `RVC-v1.1`'s waiver** rather than defining a second one; and
      that this record's `#d2`-derived section is **dated** and revised by Story 6.5. Also record
      the recommendation on the tag-protection question (§5 item 13) — *does not belong here,
      because zero tags exist and no story consumes one* — so the question `deferred-work.md` asked
      of this story by name gets an answer rather than silence.
- [ ] 6.3 🔴 Append a **forward note under `#d2`** (do **not** rewrite `#d2`): Story 6.2 has quoted
      it as of 2026-08-25, and Story 6.5 — which already owns `#d2`'s update — must also revise
      `docs/production-approval-regulation.md`'s corresponding section. *(Closures and forward notes
      go **under the original**, never at EOF — Story 5.1's review finding, and 5.2 repeated it.)*
- [ ] 6.4 Record in `deferred-work.md`, under their existing entries where they exist: the AC4
      acknowledgement if it is still outstanding, with **a named owner, never a trigger condition**
      (Story 5.2's H4).

### Task 7 — Close (AC: all) — **1 dev-story push + PR-open + merge rows**
- [ ] 7.1 Grade every AC against shipped evidence, not intention. **Any AC graded MET on evidence
      this story elsewhere says was not obtained is a review finding** (Story 5.4's M-batch).
- [ ] 7.2 Write the retro-E5 statement of §9 **in the words §9 gives**: this story introduces no
      guard, earns almost no live evidence, and the five checks it does have are documentary.
- [ ] 7.3 Paste the AC4 acknowledgement, quoted, dated, attributed. **If it has not arrived: leave
      AC4 unchecked, apply the §3 HALT mapping, keep the row `in-progress`, and name the blocker in
      the comment immediately above it.** Do not close on an inference.
- [ ] 7.4 Update this file's Dev Agent Record, File List and Change Log.
- [ ] 7.5 Flip `sprint-status.yaml` `6-2-…` → `review` (only if 7.3 landed). Push.
      **`PENDING (owner: coordinator)`** for the PR; **Oleg merges.** (Prohibition 10)
- [ ] 7.6 Ledger close — **`PENDING (owner: coordinator)`**, against a query re-run **after** the
      merge commit lands, `repo_id=16`, attributed by `commit_sha`, Story 4.9's concurrent rows
      **named and excluded, never absorbed**.

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
| Epic 5 closeout PR | **#87**, may merge mid-session — rebase | coordinator |
| Next free decision number | **D42** (`main` holds D41; 4.9 holds D35 unmerged) | scan of all `origin/story-*` branches |
| `deploy-prod.yml` | **does not exist** | `ls .forgejo/workflows/` → 11 files |
| Promotion guard | **designed, not built** | `#d2` status header |
| PROD target | **s10** = VM `e1-rung3`, `192.168.122.11`, behind jump `62.112.10.55`; moved from s2 on 2026-08-18 | `sprint-change-proposal-2026-08-18-prod-target.md` |
| PROD contour readiness | **not provisioned** — Story 6.10, which must complete before 6.4 | `sprint-status.yaml` Epic 6 block |
| `preprod-current` | `sha-a99ccd44c5a3-preprod`, digest `sha256:a62e8687…` | `docs/preprod-candidates.md:74` |
| Recorded candidates | **3**, ordered by git log, not by the registry | same file |
| Checklist marker | **`RVC-v1.1`** (bumped from `RVC-v1` on 2026-08-25 by `#d41`) | `docs/release-validation-checklist.md:1` |
| Tracker | **none** — `tracking_system: file-system`, `project_key: NOKEY` | `_bmad/bmm/config.yaml` |
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
| 10 | **The document has a hard ceiling of 120 lines; overflow goes to D42, never a cut rule.** | §5 preamble; 5.6's is 75 lines and the project's stated preference is one page that gets read. | Raise the ceiling; nothing else changes. |
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
- `docs/production-approval-regulation.md` — new, one page, hard ceiling 120 lines (AC1-AC3, AC5-AC8).
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
Story 4.9's dev agent. **Rebase when PR #87 merges.**

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

### Completion Notes List

### File List

### Review Findings

_(populated by the code-review pass: `#### Decisions needed (owner: Oleg)` then `#### Patch`.)_

---

## Open Questions for Review

1. **AC4's acknowledgement — who counts as "the development and release teams"?** This project is
   Oleg plus agent sessions plus two adjacent teams (`CRM/api-prionex`, the hub/`aleksey`). The story
   asks for a quotable, dated statement and does not presume the answer.
   **`PENDING (owner: Oleg, via coordinator)`.**
2. **The §2 separate-file decision and the §4 `docs/prod-releases.md` decision** are both offered for
   a one-read veto in Dev Notes §5 rows 1-4. Neither is expensive to reverse **before** Task 4 is
   written, and both are expensive after.
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
| 2026-08-25 | Story created. Context bound against `origin/main` at `dbec399d` from a scratchpad worktree -- the primary checkout belongs to Story 4.9's dev agent. **SS2 decides the overlap with Story 5.6's `docs/release-regulation.md`: a SEPARATE file, one cross-reference line into 5.6's document, and no restated sentence -- five reasons recorded (different subject; the PRE-PROD title; AC4 attaches to a named document; 5.6's artifact is freshly shipped and frozen by precedent; Epic 7's 7.3 absorbs both anyway).** SS3 records the ordering finding: `sprint-status.yaml` constrains only 6.10-before-6.4, 6.2 depends on neither 6.3 nor 6.10, two later stories (7.3 and the decommissioning note) consume what 6.2 writes, and the real dependencies -- unbuilt machinery vs AC1's second clause, 6.5 rewriting `#d2`, AC4's human acknowledgement -- are handled in-story rather than by re-ordering. SS4 records that "the tracker" in AC2 has no referent (`tracking_system: file-system`, `project_key: NOKEY`, the word appears once in the whole plan -- in this AC) and resolves it to a new append-only `docs/prod-releases.md`, on the three-tier precedent 5.4 established after job logs proved unreliable here. Four ACs added (AC5-AC8). SS9 states plainly that a documentation-only story earns almost no retro-E5 evidence and offers five zero-run documentary checks instead, one of them a real negative control. Fifteen autonomous decisions listed for a one-read veto. |
