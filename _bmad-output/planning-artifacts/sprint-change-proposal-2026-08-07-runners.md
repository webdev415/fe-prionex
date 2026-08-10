# Sprint Change Proposal — 2026-08-07 (runners)

**Project:** fe-prionex — Forgejo CI/CD migration
**Raised by:** Oleg
**Trigger story:** 1.3 — Verify Forgejo Actions Availability and Concurrency Support
**Scope classification:** **Moderate** — one new story, three story amendments, one ordering
constraint. No epic is added, removed or redefined.
**Status:** **Approved by Oleg, 2026-08-07.** Applied to `epics.md` and `sprint-status.yaml`.

> **Correction (2026-08-10, `bmad-correct-course` after Story 1.13's code review).** §2's
> "Technical impact" bullet about the Story 1.3 probe branch cited `CD.yml:4` as filtering
> `[main, development]` without noting this varies by ref — see the marked passage below and
> [migration-decisions.md#d9](./../../docs/migration-decisions.md#d9). The probe-branch safety
> conclusion itself was never wrong (a probe branch matches no filter list on any ref); only the
> generality of the citation was. Nothing else in this proposal is affected — no epic, story or
> scope change follows from this correction.

> This is the second change proposal dated 2026-08-07. The first
> ([sprint-change-proposal-2026-08-07.md](./sprint-change-proposal-2026-08-07.md)) covered the
> Story 1.1 / GitHub-inaction decision and is approved and applied. This one is independent of it
> and does not revisit any of its decisions.

---

## 1. Issue Summary

While preparing Story 1.3, a read-only inspection of the Forgejo instance
(`https://git.crm-prionex.com`, 2026-08-07) established two facts the plan did not have:

**Fact 1 — the instance is Forgejo `15.0.5+gitea-1.22.0`** (the v15 LTS line), with
`has_actions: true` on `CRM/fe-prionex`.

**Fact 2 — the `CRM` organization already has two registered Forgejo runners**, both `idle`, both
running forgejo-runner **v13.0.0**:

| Runner | Labels | Owner |
|---|---|---|
| `ci-hub` | **`ubuntu-latest`** | another team / project |
| `s1-build-crm` | `s1`, `ci`, `build-crm` | another team / project |

Confirmed with Oleg: **these runners are not ours.** They serve other repositories in the `CRM`
organization and are outside this plan's control.

The plan was written on the assumption that no Forgejo runner exists — «Поднять `forgejo-runner`»
([forgejo-migration.md:130](../../docs/forgejo-migration.md#L130)), and Story 1.7
(`epics.md:585-611`) is phrased as first-time provisioning.

### Why this is not merely a documentation correction

`ci-hub` carries the label **`ubuntu-latest`**. Every job in the legacy workflows requests exactly
that label — verified at `e4dcb734`: `CI.yml:12,34,53,82` and `CD.yml:31,119`, six jobs, no
exceptions.

Forgejo resolves the workflow directory as `.forgejo/workflows` → `.gitea/workflows` →
`.github/workflows`, first match wins. `main` has no `.forgejo/`, so **Forgejo executes
`.github/workflows/`**. Combined with an idle `ubuntu-latest` runner, any push of `main` or
`development` to Forgejo is picked up and executed **immediately**, not queued.

**Today the blast radius is limited by accident, not by design.** `CD.yml`'s `build-and-push` job
would fail at `docker/login-action` against `ghcr.io` because the credentials it needs are not in
Forgejo, and `deploy` (`needs: build-and-push`) would be skipped. What *would* succeed is `CI.yml`
— four jobs, one of them running the suite under `NODE_OPTIONS=--max-old-space-size=8192` — on
**another team's runner**, consuming their capacity without their knowledge.

**The accident expires at Story 1.12.** That story migrates `S1_SSH_*`, `S2_SSH_*`,
`SLACK_CD_WEBHOOK_URL` and the `VITE_*` variables into Forgejo. Once they are present, the
`deploy` job's preconditions are satisfied and the only remaining barriers are whether
`appleboy/scp-action` and `appleboy/ssh-action` resolve on this instance — barriers the plan
itself intends to remove.

**The ordering defect, stated plainly:** Story 1.12 (secrets into Forgejo) sits in **Epic 1**
(`sprint-status.yaml:66`), while Story 2.1 (which creates `.forgejo/workflows/`) sits in **Epic 2**
(`sprint-status.yaml:71`). The plan therefore arms the legacy PROD-deploying workflow on the
Forgejo side one full epic before it lands the directory that would disable it.

### Evidence

- `GET /api/forgejo/v1/version` → `{"version":"15.0.5+gitea-1.22.0"}`
- `GET /api/v1/repos/CRM/fe-prionex` → `has_actions: true`, `default_branch: main`, private
- `GET /api/v1/orgs/CRM/actions/runners` → `ci-hub` (`[ubuntu-latest]`, idle, v13.0.0),
  `s1-build-crm` (`[s1, ci, build-crm]`, idle, v13.0.0)
- `GET /api/v1/repos/CRM/fe-prionex/actions/runners` → `[]` (no repo-scoped runners)
- `.github/workflows/CI.yml:12,34,53,82` and `.github/workflows/CD.yml:31,119` — all
  `runs-on: ubuntu-latest`
- `.github/workflows/CD.yml:4` — `push: [main, development]`
- Forgejo `main` = `e6ecfced`; local `main` = `e4dcb734`, 8 commits ahead

---

## 2. Impact Analysis

### Epic impact

| Epic | Impact |
|---|---|
| **Epic 1** | One new story added; Stories 1.7 and 1.9 amended; a sequencing constraint added to 1.12. Epic goal unchanged and still achievable. |
| **Epic 2** | Story 2.1 amended with a label prohibition. Goal unchanged. |
| Epics 3–7 | No change. They inherit the `ubuntu-latest` prohibition through 2.1's precedent. |

**No epic is added, removed, resequenced or redefined.**

### Story impact

| Story | Change |
|---|---|
| **1.13** *(new)* | Neutralise the legacy workflows on the Forgejo side. **Must precede 1.12.** |
| **1.7** | Premise corrected: runners exist but are foreign. Registration scope changed org → repository. |
| **1.9** | Same scope correction, for consistency with 1.7. |
| **1.12** | Gains an explicit prerequisite on 1.13. No AC change. |
| **2.1** | Gains an explicit prohibition on `ubuntu-latest` as a `runs-on` label. |
| 1.3 | No change — it already records these findings as D8 (Task 5.8) and already registers its probe runner at repository scope. |

### Artifact conflicts

| Artifact | Conflict | Resolution |
|---|---|---|
| `epics.md` | Story 1.7/1.9 assume no runners exist and specify org-level registration | Amend as in §4 |
| `docs/forgejo-migration.md:130` | «Поднять `forgejo-runner` (отдельная VM или контейнер; **не** на s2)» — implies none exists | Amend to record the existing foreign runners and the repo-scope decision |
| `docs/migration-decisions.md` | No entry covers runner topology or the fallback hazard | Covered by **D8**, which Story 1.3 writes; add the neutralisation decision as **D9** under Story 1.13 |
| `sprint-status.yaml` | Missing the new story | Add `1-13-…` positioned to run immediately after 1.3 |

**PRD / MVP:** unaffected. No FR or NFR changes. The requirements inventory
(`epics.md:57-314`) needs no edit — this is a sequencing and premise correction, not a scope
change.

**Architecture / UX:** N/A — no architecture document exists for this workstream, and the change
has no user-facing surface.

### Technical impact

- **Immediate operational risk** until 1.13 lands: nobody may push `main` or `development` to
  Forgejo. This constrains not only the migration work but anyone outside the plan — and per the
  «External dependency: the GitHub transition» note (`epics.md:33-49`), moving delivery to Forgejo
  is owned outside this plan. **The risk is therefore not fully under this plan's control**, which
  is itself an argument for landing 1.13 early rather than at Epic 2.
- **Neighbour impact:** any Forgejo-side run of `CI.yml` consumes another team's runner.
- Story 1.3's probe branch (`probe/forgejo-capabilities`) is safe: `CI.yml:5,7` filters
  `[main, staging, development]` and `CD.yml:4` filters `[main, development]`, so a probe branch
  triggers neither.
  ⚠️ **Corrected 2026-08-10 (`bmad-correct-course`, triggered by Story 1.13).** `CD.yml:4`'s
  `[main, development]` filter is **local `main`'s copy only**. Forgejo's three refs each carry a
  *different* `CD.yml` (Story 1.13's per-ref trigger matrix,
  [migration-decisions.md#d9](./../../docs/migration-decisions.md#d9)): `origin/staging`'s
  `CD.yml` filters `[main, staging, development]` — `staging` is a CD-deploying ref **on its own
  copy**, not CI-only. The conclusion above still holds — `probe/forgejo-capabilities` matches
  neither branch-filter list on any ref — but do not generalise "`CD.yml` filters
  `[main, development]`" beyond this specific probe-branch check. Nothing done under this proposal
  was ever unsafe; the citation was incomplete, not the outcome.

---

## 3. Recommended Approach

**Option 1 — Direct Adjustment: VIABLE, recommended.**
One new story plus four amendments, all inside the existing epic structure.
Effort: **Low**. Risk: **Low**. Timeline impact: none — 1.13 is a small story that runs in
parallel with existing Epic 1 work.

**Option 2 — Rollback: NOT VIABLE.**
Nothing to roll back. Story 1.2 is documentation; Story 1.1 is cancelled; no Forgejo
infrastructure has been built by this plan.

**Option 3 — MVP review: NOT VIABLE, and not warranted.**
No goal, FR or NFR is threatened. The MVP is fully achievable; only the order of two stories and
the premise of a third are wrong.

**Selected: Option 1 (Direct Adjustment).**

**Rationale.** The discovery does not invalidate anything the plan set out to do — it reveals that
one precondition was assumed rather than checked, and that a safety step was scheduled an epic too
late. Both are correctable in place. The alternative framings (defer runner work, or re-plan Epic
1 ordering wholesale) cost more than they buy: the epic's story sequence is otherwise sound, and
1.13 is genuinely small.

### On the neutralisation mechanism

The proposed mechanism is **presence of `.forgejo/workflows/`**, which by Forgejo's
first-match-wins resolution stops `.github/workflows/` from being read at all. It is preferred to
the alternatives because:

- **It touches nothing on GitHub.** GitHub ignores `.forgejo/` entirely, so decision **D7** («на
  стороне GitHub не выполняется никаких действий») is not violated — unlike editing or renaming
  `.github/workflows/`, which would change GitHub's behaviour the moment the team next pushes
  there.
- **It does not disable Actions**, so Stories 1.3, 1.7 and 1.8 can still run.
- **It is the same directory Story 2.1 needs anyway** — 1.13 lands a minimal, deliberately inert
  placeholder; 2.1 fills it with the real CI workflows.

**This mechanism is asserted from Forgejo's documented directory resolution, not yet observed on
this instance.** Story 1.13 therefore carries a verification AC that proves it empirically, and a
stated fallback (disable the repository Actions unit until Story 2.1, accepting that 1.7/1.8 must
then be resequenced after it) if the placeholder turns out not to suppress the fallback.

---

## 4. Detailed Change Proposals

### 4.1 NEW — Story 1.13

**Placement:** appended to Epic 1 in `epics.md` after Story 1.12, but **sequenced to run
immediately after Story 1.3** in `sprint-status.yaml`. Numbering follows the file (1.13); the
cancelled slots 1.4 and 1.5 are deliberately **not** reused, because their numbers are already
cited in the first change proposal and in `epics.md:328-332`.

```
### Story 1.13: Stop Forgejo from Executing the Legacy GitHub Workflows

As a release engineer,
I want Forgejo to ignore `.github/workflows/` before any secret or branch reaches it,
So that the legacy production-deploying pipeline cannot be triggered on a platform it was never
intended to run on.

**Sequencing:** must complete before Story 1.12. May run any time after Story 1.3.

**Acceptance Criteria:**

**Given** Forgejo resolves the workflow directory as `.forgejo/workflows` → `.gitea/workflows`
→ `.github/workflows`, first match wins
**When** a minimal, inert `.forgejo/workflows/` is committed to `main`
**Then** the directory exists on `main` and contains no workflow that any trigger can fire
**And** `.github/workflows/` is left byte-for-byte unchanged, so GitHub's behaviour is untouched
per decision D7.

**Given** the placeholder is in place on `main`
**When** a commit is pushed to a branch matching `CI.yml`'s trigger list
**Then** no `CI` run is created on Forgejo
**And** the absence of a run is recorded with the branch name and timestamp as evidence.

**Given** the placeholder is in place
**When** the observation above is made
**Then** it is recorded as a definite yes/no whether the presence of `.forgejo/workflows/`
suppresses the `.github/workflows/` fallback on Forgejo 15.0.5
**And** if the answer is no, the repository Actions unit is disabled until Story 2.1, Stories 1.7
and 1.8 are resequenced after it, and this is escalated as a change to the epic order.

**Given** the neutralisation is proven
**When** the decision record is updated
**Then** a `D9` entry in `docs/migration-decisions.md` records the mechanism, the evidence, and
the constraint that `.forgejo/workflows/` must never again be absent from `main` while
`.github/workflows/` still exists in the tree.
```

**Rationale:** closes an uncontrolled path from any Forgejo push to a PROD-deploying workflow
running on a third party's runner, and does so without touching GitHub.

---

### 4.2 AMEND — Story 1.7

**Section:** premise and first acceptance criterion.

**OLD**
```
**Given** a host that is not s2
**When** the `forgejo-runner` is installed and registered at the `CRM` organization level
**Then** it exposes the label `node-20:docker://node:20-bookworm`
**And** it exposes the label `docker-build`.
```

**NEW**
```
> **Context (established in Story 1.3, 2026-08-07):** the `CRM` organization already has two
> registered runners — `ci-hub` (label `ubuntu-latest`) and `s1-build-crm` (labels `s1`, `ci`,
> `build-crm`), both on forgejo-runner v13.0.0. **They belong to another team and are not
> under this plan's control.** This story still provisions our own runner; it does not adopt,
> reconfigure or depend on theirs.

**Given** a host that is not s2
**When** the `forgejo-runner` is installed and registered at the **repository** level for
`CRM/fe-prionex`
**Then** it exposes the label `node-20:docker://node:20-bookworm`
**And** it exposes the label `docker-build`
**And** neither label collides with a label already registered at the `CRM` organization
(`ubuntu-latest`, `s1`, `ci`, `build-crm`).

**Given** the runner is registered at repository scope
**When** the organization runner list is inspected
**Then** our runner does not appear as available to other `CRM` repositories
**And** the two pre-existing organization runners are unmodified.
```

**Rationale:** org-scope registration would offer our runner to every other repository in `CRM`
and is not needed by anything in this plan. Repository scope is the least-privilege choice and
keeps the blast radius of our runner inside our repository. The label-collision check makes the
neighbouring runners an explicit constraint rather than an accident.

---

### 4.3 AMEND — Story 1.9

**Section:** first acceptance criterion.

**OLD**
```
**Given** the primary runner from Story 1.7 is operational
**When** a second runner is registered at the same organization level
**Then** it carries the identical `node-20` and `docker-build` labels
```

**NEW**
```
**Given** the primary runner from Story 1.7 is operational
**When** a second runner is registered at the same **repository** level
**Then** it carries the identical `node-20` and `docker-build` labels
```

**Rationale:** consistency with 4.2. The failover and load-distribution ACs are unaffected — both
runners simply share repository scope instead of organization scope.

---

### 4.4 AMEND — Story 1.12

**Section:** add a prerequisite line above the acceptance criteria. **No AC text changes.**

**NEW**
```
**Prerequisite:** Story 1.13 must be complete. Until `.forgejo/workflows/` suppresses the
`.github/workflows/` fallback, putting `S1_SSH_*`, `S2_SSH_*` and `SLACK_CD_WEBHOOK_URL` into
Forgejo arms the legacy `CD.yml` deploy job on a platform where an idle `ubuntu-latest` runner
will execute it.
```

**Rationale:** this is the ordering defect. Today `CD.yml` fails harmlessly on Forgejo only
because the credentials it needs are absent; Story 1.12 removes exactly that accidental
protection.

---

### 4.5 AMEND — Story 2.1

**Section:** add an acceptance criterion.

**NEW**
```
**Given** the `CRM` organization has a runner labelled `ubuntu-latest` that belongs to another
team
**When** the ported workflows declare `runs-on`
**Then** no workflow in `.forgejo/workflows/` uses `ubuntu-latest`
**And** every job targets a label provisioned by Story 1.7 (`node-20` or `docker-build`).
```

**Rationale:** the legacy workflows use `ubuntu-latest` in all six jobs. Porting them verbatim
would silently schedule our CI onto a third party's runner. This makes the prohibition explicit at
the point of porting, and Epics 3–7 inherit it by precedent.

---

### 4.6 AMEND — `docs/forgejo-migration.md:130`

**OLD** — «1. Поднять `forgejo-runner` (отдельная VM или контейнер; **не** на s2).»

**NEW** — same text, plus a note recording that two foreign runners already exist at the `CRM`
org, that our runner is registered at repository scope, and that `ubuntu-latest`, `s1`, `ci` and
`build-crm` are taken. Link to `migration-decisions.md#d8`.

**Rationale:** «Поднять» reads as "none exists". Mark rather than rewrite, per the convention
Story 1.2 established.

---

## 5. Implementation Handoff

**Scope classification: Moderate** — backlog reorganisation with one new story, no epic-level
restructuring, no PM/Architect escalation.

| Recipient | Responsibility |
|---|---|
| **Developer agent** (`bmad-dev-story` on Sonnet) | Implement Story 1.13 once created |
| **This workflow** | Apply §4.1–4.5 to `epics.md`; add `1-13-…` to `sprint-status.yaml` positioned after 1.3 |
| **Story 1.3** (already `ready-for-dev`) | Records the runner findings as `D8`; no re-work needed |
| **Story 1.13** | Records the neutralisation mechanism as `D9`; amends `forgejo-migration.md:130` per §4.6 |

### Sequencing after this change

```
1.3  (ready-for-dev)  →  1.13 (new, blocks 1.12)  →  1.6 … 1.11  →  1.12  →  Epic 2
```

### Success criteria

1. A push to a `CI.yml`-triggering branch on Forgejo creates **no** run — observed, not assumed.
2. `.github/workflows/` is byte-for-byte unchanged; D7 is not violated.
3. Story 1.7 registers a runner at repository scope whose labels collide with none of
   `ubuntu-latest`, `s1`, `ci`, `build-crm`.
4. No workflow authored by Epics 2–7 uses `ubuntu-latest`.
5. Story 1.12 does not start before 1.13 is done.

### Open item carried forward

**[!] Action-needed —** the hosts of `ci-hub` and `s1-build-crm` are unknown, and `s1-build-crm`'s
name suggests it runs on **s1**, where Stories 4.2 and 5.2 will provision the DEV and PRE-PROD
stands. This is not a blocker for Epic 1, but Story 4.2 should confirm that a foreign runner on s1
does not contend for resources with the new stands. Recorded here rather than resolved.

---

## 6. Checklist Record

| Section | Status |
|---|---|
| 1. Understand trigger and context | [x] Done — trigger 1.3; type: *technical limitation discovered during implementation*; evidence in §1 |
| 2. Epic impact assessment | [x] Done — Epic 1 completable as planned with one added story; no epic added/removed/redefined/resequenced |
| 3.1 PRD conflicts | [N/A] — no FR/NFR change; MVP unaffected |
| 3.2 Architecture conflicts | [N/A] — no architecture document for this workstream |
| 3.3 UI/UX conflicts | [N/A] — no user-facing surface |
| 3.4 Other artifacts | [x] Done — `epics.md`, `forgejo-migration.md`, `migration-decisions.md`, `sprint-status.yaml`; CI/CD pipeline impact is the substance of the change |
| 4. Path forward | [x] Done — Option 1 selected; Options 2 and 3 not viable |
| 5. Proposal components | [x] Done — §1–§5 |
| 6.1–6.3 Review and approval | [x] Done — approved by Oleg, 2026-08-07 |
| 6.4 Update sprint-status.yaml | [x] Done — `1-13-…: backlog` added after `1-3-…`, out of numeric order, with an inline comment explaining why |
| 6.5 Handoff | [x] Documented in §5 |

## 7. Application Record

Applied 2026-08-07 at baseline `e4dcb734`:

| Artifact | Change |
|---|---|
| `epics.md` — Story 1.7 | Context blockquote added; first AC changed to repository-scope registration with a label-collision clause; new AC on scope isolation |
| `epics.md` — Story 1.9 | "organization level" → "**repository** level" |
| `epics.md` — Story 1.12 | Prerequisite blockquote on Story 1.13 added above the ACs; no AC text changed |
| `epics.md` — Story 1.13 | New story appended to Epic 1, after 1.12, with its sequencing constraint stated in the story itself |
| `epics.md` — Story 2.1 | New AC prohibiting `ubuntu-latest` |
| `sprint-status.yaml` | `1-13-stop-forgejo-from-executing-the-legacy-github-workflows: backlog`, positioned after `1-3-…` so `create-story` picks it next |

**Not yet applied — owned by the stories themselves:**

- `docs/forgejo-migration.md:130` amendment (§4.6) → Story 1.13
- `D8` (runner topology and the fallback hazard) → Story 1.3, Task 5.8
- `D9` (neutralisation mechanism and evidence) → Story 1.13
