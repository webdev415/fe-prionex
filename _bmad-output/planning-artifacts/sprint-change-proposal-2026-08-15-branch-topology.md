# Sprint Change Proposal — the four-branch model

**Date:** 2026-08-15
**Raised by:** Oleg, while reviewing the CI-gate gap opened by Story 2.1's code review
**Status:** accepted, applied the same day

---

## 1. What changed

The repository's long-lived branches are **`main`, `prod`, `preprod`, `dev`**. Everything else is a
feature branch.

`prod`, `preprod` and `dev` **did not exist** — this proposal creates them. `staging` and
`development` **are not being migrated, renamed, or deleted**, by explicit instruction. They stay
where they are and are left alone.

## 2. Why it surfaced now, and why it is not a rename

Story 2.1's code review found that `staging` and `development` had no CI gate at all: `ci.yml` lives
only on `main`, all three long-lived branches sit in `branches-ignore`, and `pull_request` was scoped
to base `main`. A PR into either fired **no run and was blocked by nothing** — silently, which is
worse than failing red. Against the legacy `.github/workflows/CI.yml`, which covered all three
branches, Epic 2 had **narrowed** the gate while its stated goal was to install one.

The question "should we gate `staging` and `development`?" was escalated with measurements:

| branch | commits / 60 days | last commit | vs `main` | PRs into it | deploys from it (legacy) |
|---|---|---|---|---|---|
| `main` | 868 | 2026-08-15 | — | 15 | yes |
| `development` | 808 | 2026-08-10 | +148 / −88 | **0** | **yes** (`CD.yml: [main, development]`) |
| `staging` | **1** | 2026-08-10 | **+2265** / −5 | 1 | no |

The answer was that the branch model is different from what every artifact in the plan assumes. So
this is a **topology change**, not a gate patch — which is why it is a proposal and not a story task.

## 3. What was prewired to the old names, and had to move together

| where | what it said | why it matters |
|---|---|---|
| `.forgejo/workflows/ci.yml` | `branches-ignore: [main, staging, development]` | a push to `prod` would otherwise run full feature-branch CI |
| `.forgejo/workflows/ci.yml` | `pull_request: branches: [main]` | the gate; a PR into `dev` fired nothing |
| D9 (Story 1.13) | `.forgejo/workflows/` placeholder on `main`, `staging`, `development` | see §4 — this is the dangerous one |
| D16 (Story 2.6) | branch protection on `main` and `staging` | `prod`, `preprod`, `dev` unprotected |

What is **not** affected: deploys. FR12 dispatches the DEV deploy with a `ref`; FR14, FR16 and all of
Epic 6 dispatch with an `image_tag`. **No environment branch is a deploy trigger anywhere in this
plan.** `prod` / `preprod` / `dev` record what has been promoted; they do not cause anything to ship.

## 4. 🔴 The order of operations is the whole safety argument

**D9's invariant:** Forgejo Actions falls back to `.github/workflows/` when a commit's tree has no
`.forgejo/workflows/`. That legacy tree contains `CD.yml`, **whose deploy job targets production**.

Two consequences drove the sequence used:

1. **The branches are created from `main`'s HEAD**, the only tree guaranteed to carry
   `.forgejo/workflows/`. A branch cut from an older commit, or created empty, would arm the legacy
   pipeline on itself.
2. **The `ci.yml` change landed BEFORE the branches were created.** Creating them first would have
   fired a full CI run per branch — three runs, twelve jobs, on a host shared with another tenant's
   production — and would have meant a push to a brand-new `prod` while it was still treated as a
   feature branch.

## 5. 🔴 The required-context set differs from `main`'s, and getting it wrong bricks the branch

Story 2.6 installed eight required contexts on `main`: four jobs × `(push)` and `(pull_request)`,
because Forgejo names commit statuses per event. Its record warned, before there was a way for it to
happen: *"Marking the wrong set required produces a gate that either never goes green or never blocks
anything."*

The four-branch model creates that way.

- **PR from a feature branch** (into `main`, or into `dev`): the head branch's own push fires CI and
  produces the `(push)` contexts; the PR fires and produces the `(pull_request)` ones. Both halves
  exist on the head SHA. Eight contexts are satisfiable.
- **Promotion PR** (`dev` → `preprod`, `preprod` → `prod`): the head is itself a long-lived branch,
  which is in `branches-ignore`. **No push run ever happens.** The `(push)` contexts never appear,
  and a requirement for them can never be met — the merge is permanently blocked.

**Therefore `prod`, `preprod` and `dev` require the FOUR `(pull_request)` contexts only.** `main`
keeps its eight.

⚠️ **Left open deliberately:** a promotion PR targeting `main` (e.g. `prod` → `main`) would hit the
same wall. `main`'s protection was configured by Story 2.6 four days ago and is not being touched
here on the strength of a hypothetical. Recorded in `deferred-work.md` with the trigger named, so
that the first person who opens such a PR finds the diagnosis instead of the symptom.

## 6. What `prod` and `preprod` point at, and what that does NOT mean

Both are created at `main`'s HEAD, because §4 leaves no alternative that is safe.

⚠️ **This is a starting point, not a claim.** Production is currently running some other commit —
identifying which is exactly what **Story 6.3** exists to do, and nobody has done it yet. `prod` at
`main` HEAD asserts *nothing* about what is deployed, and must not be read as asserting it. The
cutover (Stories 6.3 and 6.9) is where `prod` stops being a placeholder and starts being a record.

The same caveat applies to `preprod`, more weakly: Epic 5 is blocked on a naming agreement and no
PRE-PROD stand exists yet.

## 7. Changes applied

- `.forgejo/workflows/ci.yml` — `branches-ignore` gains `prod`, `preprod`, `dev`; `pull_request`
  bases gain the same three. `staging` and `development` stay in `branches-ignore` and stay out of
  the `pull_request` list: they keep behaving as long-lived branches and nothing starts gating them.
- **Branches created** from `main` HEAD, after the above merged.
- **Branch protection** on all three: required status checks, the four `(pull_request)` contexts,
  no direct push, applied to admins — the D16 shape, minus the four `(push)` contexts, per §5.
- **D19** records the model, the ordering argument and the context asymmetry.

## 8. What is NOT changed

- `staging` and `development`: untouched, by instruction. They keep their existing protection and
  remain ungated. Their divergence (+2265 and +148 commits) is inherited, not resolved.
- `main`'s eight required contexts: untouched (see §5).
- Every FR and every story's acceptance criteria: unchanged. No AC in this plan names a long-lived
  branch other than `main`, so nothing downstream needed amending — which is the one piece of luck in
  this change.
- The deploy model: unchanged. Deploys are dispatched by tag or ref; branches record promotion.
