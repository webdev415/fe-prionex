# Story 6.5: Guard Promotion by Commit Identity

---
baseline_commit: 0642bdd5b6e652597332beb76e4646580e7a4230
---

Status: ready-for-dev

Epic: 6 — Production Release and Verified Rollback
Story key: `6-5-guard-promotion-by-commit-identity`
Contexted: 2026-08-27, worktree off `origin/main` @ `46e7a26a` (the merge of PR #102, Story 6.6)
Requirements: **FR16**; epic ACs 1–6; consumes `deploy-prod.yml` (6.4) and `preprod-<sha>` (5.4)

## Story

As a release engineer,
I want production to refuse a release whose commit was never validated on PRE-PROD,
so that the weakened promotion principle still has a real technical barrier behind it.

---

## 🚨 Read this before anything else

### 1. What this story is, in one paragraph

`deploy-prod.yml` already extracts the commit from `image_tag` — that is the whole input the guard
needs, and it is a **named step that exists for you**. Story 6.4's header says so: *"`derive` is the
seam… The extraction is a separate named step precisely so 6.5 has somewhere obvious to land."*
Story 6.6 then left `derive` **byte-identical to `main`** on purpose so this rebase would be clean.
**Your job is a check between `derive` and `build`, plus three documents that already name you as
their reviser.** No new workflow file. No host contact. No registry writes.

### 2. 🔴 THE GUARD'S DIRECTION OF FAILURE IS THE INVERSE OF STORY 6.6's, AND THAT IS THE WHOLE DESIGN

Story 6.6's fourteenth defect — found by its own review — was a guard that **failed OPEN**: a probe
said "absent", the code believed it, and a permanent tag got written. Here the polarity flips:

| Probe answer | 6.6 (writing a marker) | 6.5 (gating a release) |
|---|---|---|
| false **404** | 🔴 dangerous — writes when it should refuse | ✅ safe — refuses a legitimate release, loud and recoverable |
| false **200** | ✅ safe — refuses to repoint | 🔴 **dangerous — admits an unvalidated commit to production** |
| anything else | must refuse | **must refuse** |

➡️ **Only a classified `200` may mean "validated". Everything else — 404, 401, 403, 000, a timeout,
an unparseable body — must REFUSE the release.** Never treat an error as existence. Never treat a
tool failure as a verdict. That is the same M4 doctrine 5.4 established and 6.6 spent a review
relearning, applied in the direction this story needs.

### 3. Where the guard goes, and the one placement that is wrong

`deploy-prod.yml`'s job graph today: `derive → build → deploy → record → record-outcome`.

**The guard must run BEFORE `build`.** On the release path `build` rebuilds the image, and
`build.yml`'s `Enforce AC2` refuses to repoint an existing `sha-<12hex>-prod` (`#d24` §2b). If the
guard sat after the build, an unvalidated commit would burn a build first and then fail — and worse,
a commit that had *already* been built would go red at the build and the operator would never learn
that the guard would have refused it anyway. **The failure must name the missing `preprod-<sha>`,
which is epic AC5's explicit requirement.**

🔴 **Do NOT implement the guard as a `uses:` job.** `#d21`, run 631, measured: **a skipped `uses:`
wrapper reports `success`.** Story 6.6 saw this live in its own run 662 — the `build` wrapper said
`success` while its inner job was `skipped`. A guard that reports green when it did not run is worse
than no guard. Use a plain job with `runs-on: node-20` and `run:` steps, exactly like `derive`.

### 4. 🔴 BOTH MATRIX ROWS ARE FREE, LIVE, AND MEASURED TODAY

Measured 2026-08-27 by a **paginated** read of the packages API (see §9 on why that word is in bold):

```
sha-a99ccd44c5a3-prod   commit a99ccd44c5a3  ->  preprod-a99ccd44c5a3  EXISTS   ✅ guard PASSES
sha-28f7fd36b75e-prod   commit 28f7fd36b75e  ->  preprod-28f7fd36b75e  EXISTS   ✅ guard PASSES
sha-308ea1520c59-prod   commit 308ea1520c59  ->  preprod-308ea1520c59  ABSENT   ❌ guard REFUSES
```

**`308ea1520c59` is the discriminating row and it costs nothing.** It is the proof image Story 6.6
minted; it was built at `environment: prod` and never went through PRE-PROD, so it is exactly the
shape FR16 exists to stop — an unvalidated commit with a perfectly well-formed `-prod` tag.

✅ **And the PASS row is earnable without deploying anything.** Dispatch `sha-a99ccd44c5a3-preprod`
with `rollback: false`: the guard **passes**, `build` then runs and `Enforce AC2` refuses to repoint
the existing `sha-a99ccd44c5a3-prod` — so the run goes red **at the build, after the guard**, which
is precisely the evidence you want and costs no deploy, no tag, no host change. **Read the job rows
to confirm the guard job is `success` and the build is where it stopped.** This is the cheapest
honest PASS row available and it should be taken deliberately, not stumbled into.

### 5. 🔴 THE DERIVATION MUST BE THE EXACT INVERSE OF STORY 5.4's — twelve, not seven-to-sixty-four

`#d18` §3 binds Stories 5.4, 6.3, 6.5 and 6.6 to the **same twelve characters**, verbatim: *"если
любая выведет тег из полного 40-символьного SHA, цель отката и гейт разойдутся молча."*

`derive` already hands you `hex`, asserted `^[0-9a-f]{12}$`. **Use `needs.derive.outputs.hex`. Do not
re-derive it, do not re-slice `inputs.tag`, do not widen to `{7,64}`.** The tag you probe is
`preprod-${hex}` and nothing else. `record-preprod-candidate.yml` mints exactly that shape; a
length mismatch fails **every legitimate release** at this gate, which is the failure `#d18` §3 was
written to prevent.

### 6. 🔴 THE WAIVER GAP IS YOURS TO DECIDE — AND YOU CANNOT CLOSE IT

`deferred-work.md` names you: *"**Owner: Story 6.5** — it must decide what a waived marker means at
its promotion gate."*

The live case: **`preprod-a99ccd44c5a3` exists and carries no waiver signal of any kind.** It was
minted on a run whose `RVC-v1` aggregate was **`fail`** — `7/12 pass, 5 BLOCKED` — and dispatched
`pass` on Oleg's written waiver alone (`#d40`/`#d41`). Story 5.4's own D1 established that the
`validation_note` never reaches the registry.

**So the guard cannot tell a waived candidate from a clean `12/12` one, and no amount of code here
changes that** — the signal is not in the tier this guard reads. Story 6.2 already wrote the policy
half: *"THE APPROVER READS `docs/preprod-candidates.md`, NOT JUST THE TAG."*

➡️ **Required: state the limit where the guard lives, in the failure message's sibling — the SUCCESS
message.** A green guard must not read as "this release was validated". It means: *a marker exists
for this commit.* Whether that marker was earned or waived is a question this gate structurally
cannot ask. **Do not invent a weaker check that appears to close it** (e.g. grepping
`docs/preprod-candidates.md` from the workflow) — that is epic AC2's explicit prohibition against
building a weaker duplicate, and it would give false assurance.

### 7. 🔴 `#d2` MUST BE UPDATED — AND IT CONTAINS AN ERROR TO CORRECT WHILE YOU ARE THERE

`#d2`'s own status line reads: **«Статус: спроектировано, не реализовано — обновить в story 6.5.»**
Epic AC6 requires you to update it. Two things, not one:

1. **Flip the status** to implemented, and keep *«remediation to full artifact promotion remains an
   open tracked item»* — the debt does not close with the guard.
2. 🔴 **Correct its rollback rationale, which is factually wrong.** `#d2` says the guard is skipped on
   rollback *«в том числе когда `preprod-<sha>` уже удалён ретеншеном»* — implying retention can
   delete it. **It cannot.** `preprod-<12hex>` matches `keep_pattern`'s `(pre)?prod-[0-9a-f]{7,64}`
   alternative and is **protected**; compiled against the stored `package_cleanup_rule` row read from
   the database on 2026-08-27 (Story 6.6's own AC3 work), where `preprod-a99ccd44c5a3` returns
   **KEEP**. The rollback skip stands on its own and needs no false prop: **a rollback restores
   something production already ran; re-validating it proves nothing.**

**Also yours, and the regulation says so in its own text:** `docs/production-approval-regulation.md`
carries **three** dated citations reading *"designed, not built, as of 2026-08-25 — Story 6.5 owns
both the guard and updating this citation when it ships"*. Update all three, dated.

### 8. Positioning against `CRM/api-prionex` — epic AC2, and it is a documentation requirement

Established 2026-08-14, **not re-measured by this story and not ours to operate**: their PROD
promotion runs on an explicit release sha, never a branch head, and
`ops/deploy/validate-preprod-digests.sh` compares the **digests of the containers actually running on
PRE-PROD** against the release manifest. *"Digests, not tags: a tag can be moved, a digest cannot.
There is no bypass flag."*

Ours proves **commit** identity and carries a bypass (`rollback: true`) by design.

➡️ **Write it as the frontend half of their pattern, and name the asymmetry honestly** — theirs is
strictly stronger on both axes. `deferred-work.md`: *"it should reference the stronger neighbouring
gate rather than invent a weaker one beside it."* **Do not soften the comparison to make ours look
closer than it is.**

### 9. Previous story intelligence — what Epic 6 has already paid for

**From Story 6.6 (`review`, merged as PR #102 / `46e7a26a`), and every line here cost something:**

- 🔴 **A truncated read bit that story FIVE TIMES, three of which changed a conclusion** — including
  one that made Story 5.4's entire registry output look deleted, and one where the Forgejo database
  was declared unreachable because a `grep` was cut by `head`. **The packages and tasks endpoints
  paginate and cap `limit` at 50 regardless of what you ask for.** Walk to natural termination.
  Your guard's own probe is a single manifest HEAD and is not affected — but **every measurement you
  make while writing evidence is.**
- 🔴 **`#d21`, run 631: a skipped `uses:` wrapper reports `success`.** §3's prohibition rests on this.
  Also: inside an expanded callee `github.event_name` is `workflow_call`, not the caller's event.
- 🔴 **`#d47`(3): a dispatch input SHADOWS a callee input of the same name.** `deploy-prod.yml`'s
  dispatch input is named **`tag`**, deliberately, so it cannot shadow `image_tag`. **Do not rename
  it.** Two runs were lost to this.
- **The probe pattern to copy** (`record-prod-image.yml`, post-review): four `Accept` media types,
  an empty-credential pre-check that names its own cause, `401`/`403` classified **apart from**
  absence, `--proto-redir '=https'`, and a status `case` where the catch-all refuses.
- **A fix-pass that is not re-reviewed is just a second draft** — recorded after 6.2, reproduced by
  6.3, and confirmed a third time when 6.6's second review found that **three of four defects in its
  shipped code had been introduced by its own previous fix-pass.**

**From Story 6.4:** `deploy-prod.yml`'s two-callee shape, the `always()` trap on `deploy`, and the
`derive` job you are landing on. **The release deploy leg has never been green** (`#d47`, Oleg's
option (в)) — Story 6.9 owns its first run, and **this story must not become that run.**

### 10. retro-E5 — what this story owes

Every new guard ships with a live outcome matrix including a discriminating run.

| Branch | Row | Earnable? |
|---|---|---|
| release, marker present | dispatch `sha-a99ccd44c5a3-preprod`, `rollback: false` — guard passes, run stops at `Enforce AC2` | ✅ **free** (§4) |
| release, marker ABSENT | dispatch `sha-308ea1520c59-prod`, `rollback: false` | ✅ **free** — the discriminating row (§4) |
| rollback → guard skipped | any `rollback: true` dispatch | ✅ **free**, and 6.6 has three already (662/676/679) |
| probe returns non-200/404 | — | ⚠️ decide: force-test the shell, or **label UNEARNED with its reason.** Do not dress a shell exercise as a live row — Story 6.3 did and its AC6 is recorded UNMET for it |

### 11. 🔴 Blast radius and frozen files

**Written by this story:** `.forgejo/workflows/deploy-prod.yml` (**UPDATE** — one new job plus header);
`docs/migration-decisions.md` (`#d2` update + a new decision record);
`docs/production-approval-regulation.md` (three dated citations);
`_bmad-output/implementation-artifacts/` — this file, `deferred-work.md`, `sprint-status.yaml`.

**🔴 FROZEN:**
- **`deploy-prod.yml`'s `derive` job** — 🔴 **read this twice.** Story 6.6 left it byte-identical
  *specifically so this story could rebase onto it*, and verified that with a separate extraction and
  comparison at its own closeout. **Consume its outputs; change nothing inside it.** If it looks like
  it needs a change, that is a finding.
- `deploy-stand.yml`, `build.yml`, `record-prod-image.yml`, `record-preprod-candidate.yml`,
  `deploy-preprod.yml`, `deploy-dev.yml`, `dev-reset.yml`, `ci.yml`, `build-main.yml`,
  `build-buildkit-cni-image.yml`, `verify-cni-netns-isolation.yml`
- `docs/prod-releases.md`, `docs/preprod-candidates.md`, `docs/release-regulation.md`,
  `docs/release-validation-checklist.md`; `src/`, `Dockerfile*`, `vite.config.ts`, `docker-compose*.yml`;
  all of `.github/workflows/`

**Hosts:** none. This story touches no host. **Registry: READ ONLY** — the guard performs one
manifest probe and writes nothing.

### 12. Boundaries

1. **The smoke check.** Story 6.7.
2. **Rollback with measured timing.** Story 6.8 — ⚠️ **its cancellation is authored in the operator's
   own checkout and may or may not have landed; check, do not assume.**
3. **The cutover and the traffic switch.** Story 6.9, and the switch is external.
4. **Fixing the waiver signal.** Not fixable here (§6). State the limit; build nothing.
5. **The eleven open mediums from Story 6.6's second review.** Not yours.

### Prohibitions

🚨 **A prohibition here cannot be overridden by a subtask.**

1. **Never let anything but a classified `200` mean "validated"** (§2). A false 200 admits an
   unvalidated commit to production; that is the only truly expensive outcome this story has.
2. **Never implement the guard as a `uses:` job** — a skipped wrapper reports `success` (`#d21`).
3. **Never edit `derive`.** Consume `needs.derive.outputs.hex` (§11).
4. **Never widen the hex to `{7,64}` or re-derive it from the tag** (`#d18` §3).
5. **Never place the guard after `build`** (§3).
6. **Never grep `docs/preprod-candidates.md` from the workflow** to chase the waiver signal — epic
   AC2's weaker-duplicate prohibition, and it would give false assurance (§6).
7. **Never let a green guard read as "this release was validated"** (§6).
8. **Never rename `deploy-prod.yml`'s `tag` dispatch input** (`#d47`(3)).
9. **Every input reaches a `run:` body through `env:`, never a `${{ }}` expression** (`#d21`).
10. **Never claim a guard branch was observed without a run id.** Label UNEARNED instead.
11. **Do not touch s2, and do not read GitHub** (NFR5, `#d7`).
12. **Do not soften the `CRM/api-prionex` comparison** (§8). Theirs is stronger on both axes.

---

## Acceptance Criteria

### AC1 — The guard extracts the commit and requires `preprod-<sha>` *(epic AC1)*

**Given** an `image_tag` supplied for a release deploy
**When** the guard runs
**Then** it takes the commit from `needs.derive.outputs.hex` (exactly 12 hex) and probes
`preprod-<hex>` in the registry
**And** the deploy is refused if it does not exist
**And** 🔴 **only a classified `200` admits the release** — `401`, `403`, `000`, a timeout, an
unparseable body and any other status all REFUSE (§2).

### AC2 — Positioned as the frontend half of an existing pattern *(epic AC2)*

**Given** `CRM/api-prionex` gates its own promotion on `ops/deploy/validate-preprod-digests.sh`
**When** this guard is documented
**Then** it is written as the **frontend half** of that pattern, citing it
**And** no weaker duplicate of their digest check is built beside it
**And** the asymmetry is named without softening: theirs compares **digests of running containers**
and has **no bypass**; ours proves **commit identity** and has `rollback: true` by design.

### AC3 — It proves the commit, not the artifact *(epic AC3)*

**Given** Option C rebuilds per environment
**When** the guard is documented
**Then** it states it proves the **commit** passed PRE-PROD, not the **artifact**
**And** the residual risk is named — a build-time variable difference reaching production unvalidated
**And** 🔴 **the waiver limit is stated where the guard lives** (§6): a green guard means a marker
exists, not that validation was clean.

### AC4 — Skipped on rollback *(epic AC4)*

**Given** a deploy dispatched with `rollback` true
**When** the guard is evaluated
**Then** it is skipped, so any previously deployed production tag can always be restored
**And** the skip is visible in the run, not silent — a guard that vanishes is indistinguishable from
one that passed.

### AC5 — A deliberately invalid dispatch is refused, with the tag named *(epic AC5)*

**Given** an `image_tag` whose commit has no `preprod-<sha>`, dispatched with `rollback` false
**When** the workflow runs
**Then** it fails **before the build job runs and before any host is touched**
**And** the failure message names the missing `preprod-<sha>` tag literally
**And** ⚠️ **AC wording amended 2026-08-27:** the epic says *"fails before touching s2"*. s2 is the
**legacy** host and NFR5 (amended 2026-08-18) forbids Forgejo touching it **at all**; the Forgejo
production stand is s10. Read as *"before the build and before the production stand"* — the epic's
intent in the epic's own amended topology. **Declared, not rewritten silently** — the same amendment
Story 6.6 made to its AC4.

### AC6 — `#d2` updated, and its error corrected *(epic AC6)*

**Given** the guard is in place
**When** `#d2` is reviewed
**Then** its status line changes from *«спроектировано, не реализовано»* to implemented, dated
**And** the remediation to full artifact promotion **remains an open tracked item**
**And** 🔴 **its rollback rationale is corrected**: `preprod-<12hex>` is **protected** by
`keep_pattern` and retention cannot delete it (§7)
**And** the three dated citations in `docs/production-approval-regulation.md` that name Story 6.5 as
their reviser are updated.

### AC7 — 🔴 ADDED: the outcome matrix ships with real run ids

**Given** retro-E5, and Story 6.3's AC6 recorded UNMET for substituting a shell exercise
**When** this story closes
**Then** §10's matrix carries a **run id** in every row it claims
**And** the PASS and REFUSE rows are **both earned live** — both are free (§4)
**And** any unearned row is labelled with its reason, never blank, never force-tested into looking
earned.

### AC8 — 🔴 ADDED: the decision record

**Given** this project's convention that a decision is recorded before it is relied on
**When** this story closes
**Then** `docs/migration-decisions.md` carries a record covering: the guard's placement and why not a
`uses:` job; the fail-direction analysis (§2); the waiver limit and why it is not closable here; the
`#d2` correction; and the matrix outcome
**And** the number is **re-verified across every `origin/*` ref, every LOCAL branch, AND the working
tree** — Story 6.3's OQ10 hole, which Story 6.6 checked deliberately and found clean. Next apparently
free number on `46e7a26a` is **D49** (`D48` is Story 6.6's).

---

## Tasks / Subtasks

### Task 1 — Open the story (AC: —) — **1 push row**

- [x] 1.1 Branch off `origin/main`. **Re-fetch first** — `main` moved seven times on 2026-08-26 and
      three more on 08-27.
- [x] 1.2 `sprint-status.yaml` `6-5-…` → `in-progress`, **own commit**.
- [x] 1.3 D-number sweep across `origin/*`, local branches **and the working tree** (AC8).
- [x] 1.4 ⚠️ Check whether Story 6.8's cancellation has landed; it was unpushed on 2026-08-27 and
      touches `sprint-status.yaml` and `deferred-work.md`. **Do not edit another story's row.**

### Task 2 — Read the contract (AC: 1, 2, 3) — **0 runs**

- [x] 2.1 Read `deploy-prod.yml` end to end — the job graph, `derive`'s outputs, the `always()`
      paragraph, and the two `6.5` seam notes at lines ~56 and ~177.
- [x] 2.2 Read `record-prod-image.yml`'s probe steps as the **pattern to copy** (four `Accept` types,
      empty-credential pre-check, `401`/`403` classified, `--proto-redir`, refusing catch-all).
- [x] 2.3 Read `#d2` in full, `#d18` §3, `#d21`, `#d24` §2b, `#d40`/`#d41`, `#d47`, `#d48`.
- [x] 2.4 Read `deferred-work.md`'s two 6.5-owned entries (the `CRM/api-prionex` positioning and the
      waiver gap).
- [x] 2.5 **Measure, paginated**: every `sha-*-prod` and every `preprod-*` marker, and confirm §4's
      table still holds. Paste it.

### Task 3 — Write the guard (AC: 1, 2, 3, 4, 5) — **0 runs**

- [x] 3.1 New job in `deploy-prod.yml`: plain job, `runs-on: node-20`, `needs: derive`,
      `if: needs.derive.outputs.is_rollback != 'true'`. **Not a `uses:` job** (Prohibition 2).
- [x] 3.2 `build` and `deploy` gain the guard in `needs:`. 🔴 **Re-check `deploy`'s `if:` after the
      change** — it carries `always()` and an explicit success-or-skipped test; adding a `needs:`
      member changes what that expression must say, and getting it wrong makes the rollback path
      silently do nothing while the run reports green (`deploy-prod.yml`'s own header).
- [x] 3.3 The probe: `preprod-${hex}` over HTTP, four `Accept` types, empty-credential pre-check,
      `--proto-redir '=https'`, status `case` where **only 200 admits** and the catch-all refuses.
- [x] 3.4 The refusal message names the missing `preprod-<hex>` **literally** (AC5) and says what to
      do: record the candidate on PRE-PROD first, or dispatch with `rollback: true` if restoring.
- [x] 3.5 The success message states the limit (§6): a marker exists; whether it was earned or waived
      is not visible here; the approver reads `docs/preprod-candidates.md`.
- [x] 3.6 Header block: placement and why not `uses:`, the fail-direction table, the
      `CRM/api-prionex` positioning, the waiver limit.
- [x] 3.7 Mechanical: YAML parses; every `run:` body `bash -n`; **zero `${{ }}` inside any `run:`**
      (checked against parsed YAML, not grep); `derive` **byte-identical** to `origin/main`; every
      frozen file byte-identical.

### Task 4 — Earn the matrix (AC: 5, 7) — **2 dispatches, neither deploys**

- [x] 4.1 **REFUSE row:** dispatch `tag: sha-308ea1520c59-prod`, `rollback: false`. Expect the guard
      job **failed**, `build` and `deploy` **not run**, message naming `preprod-308ea1520c59`.
      **Paste the run id and the job rows** — read them **paginated** (§9).
- [x] 4.2 **PASS row:** dispatch `tag: sha-a99ccd44c5a3-preprod`, `rollback: false`. Expect the guard
      **success**, then `build` red at `Enforce AC2` refusing to repoint the existing
      `sha-a99ccd44c5a3-prod`. 🔴 **That red is the expected outcome and must be labelled as such** —
      it is the guard's pass row bought without a deploy (§4).
- [x] 4.3 **SKIP row:** cite Story 6.6's runs 662/676/679 (all `rollback: true`) rather than spending
      a fourth — but **verify from the job rows that the guard job is `skipped` in a run made after
      this change**, and if none exists, spend one.
- [x] 4.4 Confirm the registry is **unchanged** after all of it: this story writes nothing.

### Task 5 — Record (AC: 2, 3, 6, 8) — **0 runs**

- [ ] 5.1 `#d2`: status flipped, remediation kept open, **rollback rationale corrected** (§7).
- [ ] 5.2 `docs/production-approval-regulation.md`: the three dated citations.
- [ ] 5.3 `docs/migration-decisions.md`: the new decision record (AC8), number per Task 1.3.
- [ ] 5.4 `deferred-work.md`: discharge the two 6.5-owned entries, or re-own **by name**.

### Task 6 — Close (AC: all) — **1 push + PR + merge rows**

- [ ] 6.1 Grade every AC against **pasted evidence**. 🔴 **An AC graded MET by the session that wrote
      the code is a self-assessment** — Story 6.6 marked three ACs MET whose final clauses had not
      been performed, and a review on a different model found all three.
- [ ] 6.2 🔴 **Re-review the fix-pass.** Three of the four defects in 6.6's shipped code were
      introduced by its own previous fix-pass. Check the Status header, the title, §1 and every
      checkbox after the edits.
- [ ] 6.3 Close the ledger **by query**, attributed by `commit_sha`, read to natural termination.
      🔴 A branch-name filter missed five rows for 6.6.
- [ ] 6.4 `sprint-status.yaml` → `review`. **Oleg merges.**

---

## Run budget model — declared before work

| Line | Floor | Ceiling |
|---|---|---|
| Context push (this file) | 1 | 1 |
| dev-story pushes | 2 | 4 |
| PR rows (`pull_request`) | 2 | 2 |
| Merge row (`build-main.yml`) | 1 | 1 |
| **Task 4.1 — the REFUSE dispatch** | **1** | **2** |
| **Task 4.2 — the PASS dispatch** | **1** | **2** |
| Task 4.3 — a skip row if 6.6's cannot be reused | 0 | 1 |
| Review fix-pass push | 0 | 2 |
| Closeout PR | 0 | 3 |
| **Total** | **8** | **18** |

⚠️ **Story 6.6 declared 13/24 and measured 19 by query, then rose with its own PR rows and a second
review's fix-passes.** This model budgets a fix-pass and a closeout PR for the same reason.

---

## Dev Notes

### 1. The one-paragraph version

One plain job between `derive` and `build` that probes `preprod-<hex>` and refuses on anything but a
classified 200; skipped on rollback. Then four documents, one of which (`#d2`) has an error to fix
while you are in it. Two free dispatches earn the whole matrix. **No host, no registry write, no new
file.**

### 2. Infrastructure facts

| Fact | Value |
|---|---|
| Registry | `git.crm-prionex.com/crm/fe-prionex` |
| Marker shape the guard reads | `preprod-<12hex>` — minted by `record-preprod-candidate.yml` |
| Protected by `keep_pattern`? | **Yes** — `(pre)?prod-[0-9a-f]{7,64}`; compiled against the stored `package_cleanup_rule` row read from the DB 2026-08-27 |
| Seam | `needs.derive.outputs.hex` / `.is_rollback` / `.deploy_tag` |
| Guard runner | `node-20` — **not** `docker-build` (no Node runtime, so no `uses:` step runs; Story 1.8 Trap 1) |
| Live PASS material | `preprod-a99ccd44c5a3`, `preprod-28f7fd36b75e` |
| Live REFUSE material | commit `308ea1520c59` — `-prod` tag exists, **no** `preprod-` marker |

### 3. Anti-patterns for this story

- **Treating any non-200 as "exists"** — the one expensive failure (§2).
- **A `uses:` job** — reports success when skipped.
- **Editing `derive`** because it would be tidier. 6.6 kept it byte-identical for you.
- **Chasing the waiver signal in the workflow** — it is not in the tier you read (§6).
- **Grading an AC MET on a clause you did not perform** — caught three times in this project, most
  recently in the story immediately before this one.

### References

- `epics.md` — Story 6.5 ACs; FR16; Epic 6 preamble
- `docs/migration-decisions.md` — `#d2` (yours to update), `#d18` §3, `#d21`, `#d24` §2b,
  `#d40`/`#d41` (the waiver), `#d47`, `#d48`
- `docs/production-approval-regulation.md` — three citations naming you
- `deferred-work.md` — the `CRM/api-prionex` positioning; the waiver-gap entry
- `.forgejo/workflows/deploy-prod.yml` (the seam), `record-prod-image.yml` (the probe pattern),
  `record-preprod-candidate.yml` (the marker's origin — **frozen**)
- `_bmad-output/implementation-artifacts/6-6-…md` — the fail-open lesson, the pagination lesson, and
  the re-review lesson

---

## Dev Agent Record

### Agent Model Used

### Debug Log References

**Tasks 2–4 — 2026-08-27. Both matrix rows earned live. Two dispatches, nothing written.**

**The guard is a plain job between `derive` and `build`**, `if: needs.derive.outputs.is_rollback !=
'true'`, `runs-on: node-20`. Not a `uses:` job — `#d21` run 631 measured that a skipped `uses:`
wrapper reports **success**, and Story 6.6 saw it live in its own run 662.

🔴 **The `deploy` condition had to change, and without that the guard would have been decorative.**
A refused guard makes `build` a failed-dependency, and `deploy`'s condition **admits a skipped build
by design** — that is how the rollback path reaches it. Before the added clause, a red guard would
have gone red **and production would have been deployed anyway.** `deploy` now requires `guard` to be
`success` (release, admitted) or `skipped` (rollback, not applicable) — never `failure`.

**The live matrix — and the discriminator is structural, not a log line:**

| | run **687** — REFUSE | run **689** — PASS |
|---|---|---|
| dispatched | `sha-308ea1520c59-prod`, `rollback: false` | `sha-a99ccd44c5a3-preprod`, `rollback: false` |
| marker | `preprod-308ea1520c59` **absent** | `preprod-a99ccd44c5a3` **present** |
| `Promotion guard` | **failure** ✅ | **success** ✅ |
| `Build and Push` (the callee's INNER job) | 🔴 **absent — never expanded** | ✅ **present, failed at `Enforce AC2`** |
| deploy-stand inner rows | none | none |
| total job rows | **6** | 7 |

🔴 **That "absent vs present" row is the proof that the guard sits BEFORE the build**, and it is
better evidence than any status word. Run 687 has **six** job rows and **zero** inner callee rows;
run 668 — a real deploy from Story 6.6 — has twelve including seven inner rows. `build.yml`,
`deploy-stand.yml` and `record-prod-image.yml` never expanded on 687. **Production was not touched,
and nothing was built.** AC5's *"before the build and before the production stand"* is observed.

⚠️ **A platform behaviour that was in no document, and I predicted it wrong.** Dependents of a failed
job report **`failure`**, not `skipped` — on run 687 `build`, `deploy` and `record` all show
`failure` while never having run. The story's own Task 4.1 expected *"`build` and `deploy` not run"*
and would have read `skipped`. **The `deploy` condition is unaffected** (it admits `success` or
`skipped`, so `failure` is refused either way), but **judging an outcome by the word `skipped` would
be wrong here**, and the next reader will assume otherwise. Filed.

⚠️ **Run 689's build failed at `Enforce AC2`, and that reason is inferred, not read.** Job logs are
not retrievable on this instance. What is *measured* is that the build's inner job **ran and failed**
where on 687 it never started. The reason — `build.yml` refusing to repoint the existing
`sha-a99ccd44c5a3-prod` because `vite.config.ts`'s `Date.now()` makes the rebuild differ (`#d24`
§2b) — is documented and predicted, and it is **not load-bearing for any AC here**: what this row
buys is *the guard passed and the build was reached*, which is exactly what it claims.

**Registry re-read after both dispatches: unchanged.** `prod-current` and `prod-a99ccd44c5a3` still
`f30c7941…`. This story writes nothing, and did not.

**Frozen check:** all **11** frozen workflows byte-identical to `origin/main`, and **`derive`
byte-identical** — extracted and compared separately, because Story 6.6 kept it that way on purpose
for this rebase. Zero `${{ }}` inside any `run:`; every `run:` body passes `bash -n`.

**Task 1 — 2026-08-27.** Worktree `story-6-5/impl` off `story-6-5/pr-1-context` @ `0642bdd5` — **not
off `main`**, deliberately: PR #103 is open and the story file exists nowhere else. `origin/main` is
`46e7a26a`; if #103 merges mid-story, rebase.

**1.3 — D-sweep across all three scopes** (origin refs, local branches, and the working tree — Story
6.3's OQ10 blind spot): highest is **D48** everywhere. **Next free: D49**, confirming AC8's prediction.

**1.4 — Story 6.8's cancellation has NOT landed.** `6-8-roll-back-…: backlog` on `origin/main`, and
the operator's working tree is now clean (the staged edits seen on 2026-08-26 are no longer there).
Nothing to merge against yet; the collision risk in `sprint-status.yaml` and `deferred-work.md` stays
open until it lands. **Not touched — another story's row.**

### Completion Notes List

### File List

### Review Findings

---

## Open Questions for Review

1. **Does the guard belong in `deploy-prod.yml` or in a reusable file?** This story assumes a plain
   job inside `deploy-prod.yml`, because the guard needs `derive`'s outputs and because a `uses:` job
   reports success when skipped. The alternative — a callee with `workflow_call` — buys reuse nobody
   has asked for and inherits `#d21`'s trap. **Recommendation: in-file.**
2. **Is the PASS row via `Enforce AC2`'s red acceptable evidence, or should a genuinely fresh commit
   be validated on PRE-PROD first?** §4 buys the row for free but the run ends red for a reason
   unrelated to the guard. **Recommendation: take it, label it precisely.** The alternative costs a
   full PRE-PROD cycle.
3. **Should the rehearsal candidate be positively excluded?** `deferred-work.md` asks whether the
   empty-release rehearsal candidate — never intended for promotion — needs an explicit block rather
   than being merely unlikely to be chosen. **Recommendation: no**, and record why: any such list is
   a second source of truth that will go stale, and the approval regulation already puts a named human
   in front of the dispatch.
4. **Story 6.8's cancellation was unpushed on 2026-08-27.** If it lands mid-story it will conflict in
   `sprint-status.yaml` and `deferred-work.md`. Merge, do not rebase, if a PR is already open.

---

## Change Log

| Date | Version | Description | Author |
|---|---|---|---|
| 2026-08-27 | 0.1 | Context created off `origin/main` @ `46e7a26a` (PR #102, Story 6.6). Six epic ACs carried — AC5's *"before touching s2"* amended to the s10 topology and declared, not rewritten silently. Two ACs added. 🔴 **The guard's fail-direction is the inverse of Story 6.6's** and that analysis is §2, the story's central design constraint. **Both matrix rows measured free and live**: commit `308ea1520c59` has a `-prod` tag and no `preprod-` marker, which is exactly the shape FR16 exists to stop. `#d2` carries an error to correct while updating it — its rollback rationale claims retention can delete `preprod-<sha>`, and `keep_pattern` protects it. Four Open Questions, none blocking. | create-story context engine (Opus) |
