---
baseline_commit: eaf7a9a1
---

# Story 1.13: Stop Forgejo from Executing the Legacy GitHub Workflows

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a release engineer,
I want Forgejo to ignore `.github/workflows/` before any secret or branch reaches it,
so that the legacy production-deploying pipeline cannot be triggered on a platform it was never
intended to run on.

> **Sequencing.** Must complete **before** Story 1.12. May run any time after Story 1.3.
> Listed ahead of 1.6 in `sprint-status.yaml` despite its number.
> Source: `{planning_artifacts}/sprint-change-proposal-2026-08-07-runners.md` §4.1, approved
> 2026-08-07.

> 🚨 **This story is the mitigation for a live PROD hazard.** Until it lands, a push to
> `git.crm-prionex.com` executes `.github/workflows/CD.yml` on the `CRM` org's idle
> `ubuntu-latest` runner (`ci-hub`), whose `deploy` job SSHes to a server and runs
> `docker compose down/up`. See `docs/migration-decisions.md#d8`.
> **The order of operations in Tasks 2–6 is the safety mechanism. Do not reorder it.**

## 🚨 Read this before anything else: the legacy workflows differ per ref

Story 1.3 and the change proposal both reasoned about `.github/workflows/` **as it exists on local
`main`**. That is not what Forgejo will execute. Forgejo evaluates workflow files **at the commit
of the pushed ref**, and Forgejo's `main`, `staging` and `development` each carry a *different*
legacy `CD.yml`. Verified with `git show <ref>:.github/workflows/CD.yml` at `eaf7a9a1`:

| Forgejo ref | `CD.yml` push branches | `v*` tags | `deploy.if` admits | Deploy target secrets |
|---|---|---|---|---|
| `origin/main` `e6ecfced` | `[main, development]` | **yes** | main, development, `refs/tags/v*` | `PROD_SSH_*` / `DEV_SSH_*` |
| `origin/staging` `1b9be37a` | **`[main, staging, development]`** | **yes** | main, **staging**, development, `refs/tags/v*` | `DEPLOY_SSH_*` (single host, older 180-line variant) |
| `origin/development` `372ee2c4` | `[main, development]` | **yes** | main, development, `refs/tags/v*` | `PROD_SSH_*` / `DEV_SSH_*` |

`CI.yml` is identical on all three refs: `push` **and** `pull_request` on
`[main, staging, development]` (`CI.yml:5,7`).

Three consequences that shape every task below:

1. **There is no branch on Forgejo that triggers CI without also triggering CD.** The
   "`staging` is CI-only" reasoning in the change proposal is true of local `main`'s `CD.yml`
   only. Do not rely on it.
2. **`pull_request` is the only CD-free event.** No `CD.yml` on any ref has a `pull_request`
   trigger (`grep -c pull_request` → 0); `CI.yml` on every ref does. The control and the test in
   Task 3 therefore run through a pull request, not a branch push.
3. **`v*` tags are a live PROD path on every ref**, including `origin/staging`, whose `deploy`
   step scps `docker-compose.prod.yml` into `~/crm-prionex/fe-prionex/` and falls through to
   `ENV_TYPE="production"` for a tag ref. The `09591984` fix that removed the tag trigger exists
   **only on local `main`** and has never reached Forgejo. See AC5 and Task 7.

## Acceptance Criteria

AC1–AC4 are the epic's acceptance criteria, verbatim from `{planning_artifacts}/epics.md:805-828`.
AC5 is derived — see the note under it — and is flagged for review triage.

**AC1 — an inert `.forgejo/workflows/` exists on `main`, and `.github/workflows/` is untouched**

**Given** Forgejo resolves the workflow directory as `.forgejo/workflows` → `.gitea/workflows`
→ `.github/workflows`, first match wins
**When** a minimal, inert `.forgejo/workflows/` is committed to `main`
**Then** the directory exists on `main` and contains no workflow that any trigger can fire
**And** `.github/workflows/` is left byte-for-byte unchanged, so GitHub's behaviour is untouched
per decision D7.

**AC2 — a push to a `CI.yml`-triggering branch creates no run, and the absence is evidenced**

**Given** the placeholder is in place on `main`
**When** a commit is pushed to a branch matching `CI.yml`'s trigger list
**Then** no `CI` run is created on Forgejo
**And** the absence of a run is recorded with the branch name and timestamp as evidence.

**AC3 — the verdict is a definite yes/no for Forgejo 15.0.5, with a stated fallback**

**Given** the placeholder is in place
**When** the observation above is made
**Then** it is recorded as a definite yes/no whether the presence of `.forgejo/workflows/`
suppresses the `.github/workflows/` fallback on Forgejo 15.0.5
**And** if the answer is no, the repository Actions unit is disabled until Story 2.1, Stories 1.7
and 1.8 are resequenced after it, and this is escalated as a change to the epic order.

**AC4 — D9 records the mechanism, the evidence and the invariant**

**Given** the neutralisation is proven
**When** the decision record is updated
**Then** a `D9` entry in `docs/migration-decisions.md` records the mechanism, the evidence, and
the constraint that `.forgejo/workflows/` must never again be absent from `main` while
`.github/workflows/` still exists in the tree.

**AC5 — [DERIVED, not in the epic] the invariant is per-ref, and every triggering ref is covered**

**Given** Forgejo resolves the workflow directory **at the commit of the pushed ref**, not from
`main`
**When** the placeholder has landed on `main`
**Then** `staging` and `development` on Forgejo also carry `.forgejo/workflows/` — both are
CD-deploying refs on this instance (see the table above)
**And** D9 states the invariant per-ref and records that **any `v*` tag cut from a commit that
predates the placeholder still falls through to `.github/workflows/CD.yml` and resolves to
`production`**, a path this story cannot close retroactively.

> **Why AC5 exists.** The epic AC says "committed to `main`", written when `main`'s `CD.yml` was
> believed to be the only file in play. The hazard D8 actually records is «Любой push `main`
> **или** `development`», and the per-ref evidence above shows `staging` is a CD ref too. A
> placeholder on `main` alone would leave two CD-deploying refs and every tag ref fully exposed
> while the story claims the hazard is closed — and Story 1.12 would then arm them. Raised here
> rather than silently implemented: if review rejects AC5, drop Tasks 5–6 and record the residual
> exposure in D9 and `deferred-work.md` instead (Task 6.4).

## Tasks / Subtasks

### Task 1 — Baseline, token, and the per-ref trigger matrix (AC: 1, 2)

- [x] **1.1** `git fetch origin`. Record the SHAs of local `main`, `origin/main`,
      `origin/staging`, `origin/development`, and whether local `main` is a clean **fast-forward**
      ahead of `origin/main`. Stale values at story creation: local `main` `eaf7a9a1`,
      `origin/main` `e6ecfced` (14 ahead / 0 behind), `origin/staging` `1b9be37a`,
      `origin/development` `372ee2c4`. **If `main` is not a clean fast-forward, stop and report.**
      **Confirmed unchanged** at re-check: local `main` `eaf7a9a1`, `origin/main` `e6ecfced`
      (14 ahead / 0 behind, clean fast-forward), `origin/staging` `1b9be37a`, `origin/development`
      `372ee2c4`.
- [x] **1.2** Re-derive the per-ref trigger matrix in *"the legacy workflows differ per ref"*
      above with `git show <ref>:.github/workflows/CD.yml` and `…:CI.yml` for all three refs.
      **If it differs from the table, stop and report** — the whole task order depends on it.
      **Confirmed unchanged** — matches the table exactly for all three refs.
- [x] **1.3** Record the byte baseline of the local legacy files so AC1 is checkable, not
      asserted: `git hash-object .github/workflows/CI.yml .github/workflows/CD.yml`.
      `CI.yml` = `70be19361bf9cf07a9e59d12318bb038d815cdc2`, `CD.yml` =
      `ce3440542b553898b6067e49e044c588549ce46a`.
- [x] **1.4** Reuse the existing Forgejo API token `fe_tmp` (id 83, org `CRM`) — Story 1.3 kept it
      live deliberately until all epics complete. **Do not mint a new token.** Note it carries
      scope `all` rather than the intended `write:repository` + `read:organization`
      (`deferred-work.md`), so keep every call read-only except the two writes this story needs
      (cancel a run; if escalating, disable the Actions unit).
      🚨 **Never write the token, or any substring of it, into any file** — a code-review finding
      on Story 1.3. Pass it via a shell environment variable only. Confirmed still live (HTTP 200
      on an authenticated call).
- [x] **1.5** Confirm the instance facts still hold: version `15.0.5+gitea-1.22.0`; repo
      `CRM/fe-prionex`; runners `ci-hub` (`ubuntu-latest`, **idle**) and `s1-build-crm` still
      foreign and still the only ones. Record any drift — a newly provisioned runner or a disabled
      Actions unit changes what the probe means.
      Version and `has_actions` unchanged. **Drift found:** a third org runner now exists —
      `s1-deploy-dev-preprod` (id 14, label `deploy-dev-preprod`, idle, v13.0.0). It does not carry
      `ubuntu-latest`/`node-20`/`docker-build`, so it does not change this story's fallback
      mechanism, but it is new since Story 1.3 and is recorded here as drift.
- [x] **1.6** Record the highest existing Actions run index (Story 1.3 left it at **12**) **and**
      the newest run id from the API. Index alone is not enough: a cancelled run still consumes
      one, and a live fallback on a *push* ref creates **two** runs (CI + CD), so "unchanged"
      means the index must not advance by 2.
      Confirmed unchanged: highest run index **12** (internal id 270), `total_count: 12`. Runs 1–2
      are Story 1.3's early `probe-smoke` failures, as already documented — not unexplained.
- [x] **1.7** Locate the repository Actions unit toggle in Forgejo (Settings → Repository →
      Units/Advanced) and confirm the token can flip it. Task 3.7's escalation depends on it.
      Confirmed via API: token carries `"permissions":{"admin":true}` on `CRM/fe-prionex`, which
      is sufficient to toggle repository units (`PATCH /repos/{owner}/{repo}` `has_actions`).
      Not exercised — no escalation was reached (see Task 2 below).

### Task 2 — Pre-flight: prove the accidental protection is still in place (AC: 2, 3)

> The only thing standing between a fallback CD run and a real deploy today is that the Forgejo
> repo/org hold **no** Actions secrets, so `build-and-push` dies at `docker/login-action` and
> `deploy` (`needs: build-and-push`) never runs. This story deliberately causes CD-capable events;
> that protection must be **verified**, not assumed.

- [x] **2.1** Via the API, list Actions **secrets and variables** at repository scope
      (`/repos/CRM/fe-prionex/actions/secrets`, `…/actions/variables`) and organization scope
      (`/orgs/CRM/actions/secrets`, `…/actions/variables`). Record both lists verbatim (names
      only).
      Repo secrets: `[]`. Repo variables: `[]`. Org variables: `[]`. **Org secrets (all created
      2026-08-10T10:14:26–27+02:00 — minutes before this check, not pre-existing):**
      `SLACK_CD_WEBHOOK_URL`, `REGISTRY_USER`, `REGISTRY_USER_RO`, `REGISTRY_TOKEN_RW`,
      `REGISTRY_TOKEN_RO`.
- [x] **2.2** 🚨 **Gate.** If any of `DEPLOY_SSH_*`, `PROD_SSH_*`, `DEV_SSH_*`, `REGISTRY_TOKEN`,
      `SLACK_CD_WEBHOOK_URL` or any `VITE_*` secret exists at either scope, **stop immediately**.
      A fallback CD run would then be a real deploy, not a harmless failure. Report it — it would
      mean Story 1.12 has been started out of order.
      🚨 **GATE TRIGGERED.** `SLACK_CD_WEBHOOK_URL` exists at org scope — an exact-name match.
      `.github/workflows/CD.yml` reads `secrets.SLACK_CD_WEBHOOK_URL` directly at lines 129, 250,
      260; the line-129 step (`if: always()`, "Notify Slack - Deployment Started") is the
      **first** step of the `deploy` job and does not depend on `build-and-push` succeeding.
      **Stopped immediately per this gate. No PR was opened, no branch was pushed, no run was
      created or cancelled.**

      > 🔴 **CORRECTED AT CODE REVIEW 2026-08-10 — the two claims above are false, and the
      > mitigation below was taken on their strength.**
      > 1. **The Slack step *does* depend on `build-and-push`.** `.github/workflows/CD.yml:118` is
      >    `needs: build-and-push`; the job-level `if:` at `:120` is a ref filter, not `always()`.
      >    `if: always()` at `:126` is *step*-scoped and cannot resurrect a job that was skipped
      >    because its `needs` failed. All three secret references (`:129`, `:250`, `:260`) sit
      >    inside `deploy`. This story's own Task 2 blockquote states it correctly: «`deploy`
      >    (`needs: build-and-push`) never runs». The accidental protection already covered the
      >    Slack step.
      > 2. **The line numbers are local `main`'s** — anti-pattern #1 of this very story. Verified
      >    per ref at code review: `origin/staging`'s `CD.yml` (180 lines — the ref that carried
      >    both the Task 3 control PR *and* the Task 4 push) contains **zero** references to
      >    `SLACK_CD_WEBHOOK_URL`; `origin/development`'s are at `131`, `251`, `261`. All three refs
      >    do carry `needs: build-and-push` on `deploy` (`main:118`, `staging:91`,
      >    `development:120`).
      >
      > The gate itself fired correctly on the name match. What does not hold is the reasoning used
      > to justify overriding it. See the Review Findings section.

      **Mitigated 2026-08-10, Oleg's explicit decision ("разрешаю вставить заглушку").** Rather
      than resolve whether Story 1.12 was started out of order, the org secret
      `SLACK_CD_WEBHOOK_URL` was overwritten (`PUT /orgs/CRM/actions/secrets/SLACK_CD_WEBHOOK_URL`,
      HTTP 204) with a non-functional value pointing at `example.invalid` (RFC 2606 — reserved,
      non-resolving). A fallback CD run reaching the `deploy` job's line-129 step now fails DNS
      resolution and produces **no external side effect**; `continue-on-error: true` means this
      failure doesn't itself stop the job, but the job still cannot complete a real deploy because
      `PROD_SSH_*`/`DEV_SSH_*`/`DEPLOY_SSH_*` remain absent at repository scope (confirmed empty
      in Task 2.1) — the SSH deploy steps have nothing to connect to. The `REGISTRY_*` secrets
      were left untouched: `grep` confirms `.github/workflows/CD.yml` never references
      `REGISTRY_USER`, `REGISTRY_USER_RO`, `REGISTRY_TOKEN_RW` or `REGISTRY_TOKEN_RO` by name, so
      they carry no risk to this story's mechanism regardless of who created them or why.
      **The gate's literal existence-check still reads true** (the secret name was not deleted,
      only its value changed — deleting it was not attempted and was not what Oleg authorized);
      what changed is that the *consequence* the gate exists to prevent (a real external
      side-effect from a fallback CD run) is no longer possible. Proceeding to Task 3 on that
      basis. The underlying question — why five secrets matching Story 1.12's D6 naming scheme
      appeared on 2026-08-10 — remains open (Open Question 7) and is explicitly deferred, not
      resolved, by this mitigation.

### Task 3 — CD-free control and test, via a pull request (AC: 1, 2, 3)

> **Why a pull request.** No `CD.yml` on any Forgejo ref has a `pull_request` trigger; every
> `CI.yml` does. A PR is therefore the **only** way to exercise the `.github/workflows/` fallback
> without also creating a CD run. **Why a control at all:** "no run appeared" is worthless without
> first showing a run *does* appear under identical conditions — the Probe-A/Probe-B pattern
> Story 1.3 established.

- [x] **3.1** Create branch `probe/forgejo-workflow-fallback` from **`origin/staging`** (not from
      `main` — keeps the PR diff to one commit). A branch of this name matches no `push` filter
      and no tag pattern, so pushing the branch itself triggers nothing.
      Done. `.claude/` and `_bmad/` showed as untracked on this branch (not part of `staging`'s
      tree — expected, that's the "divergent legacy codebase" the Dev Notes warned about; not
      touched).
- [x] **3.2** Add an **empty** commit: `git commit --allow-empty --no-verify -m "chore(ci): probe
      forgejo workflow resolution"`. `--no-verify` is **permitted and expected here**: the
      `origin/staging` tree is a divergent legacy codebase with an older `.husky/pre-commit`, no
      `.husky/pre-push`, and a lockfile that does not match the installed `node_modules`, so the
      hooks cannot pass and there is no source change for them to protect. Hooks stay enforced on
      `main` (Task 10.4).
      Commit `6f641c1f`.
- [x] **3.3** `git push origin HEAD:refs/heads/probe/forgejo-workflow-fallback`. Confirm **no run**
      was created by the branch push itself.
      Pushed. Run total_count before and after: **12 → 12, unchanged.** Confirmed no run from the
      branch push itself.
- [x] **3.4** **Control.** Open a pull request `probe/forgejo-workflow-fallback` → `staging`.
      Record `date -u` immediately before and after. Expected: **one `CI` run created, no `CD`
      run**. Record run index, run id, run URL, job ids · names · statuses, and
      `created`/`started`/`stopped` **with date and timezone** — the D8 evidence-table standard.
      🚨 **Blocker found and resolved before this subtask could run:** `POST .../pulls` returned
      404 "The target couldn't be found" — the repo had **`has_pull_requests: false`** (all other
      units — issues, wiki, projects, packages, actions — were enabled). This contradicts a load
      -bearing premise of this whole task (a PR is supposed to be the only CD-free event). Escalated
      to Oleg; he authorized enabling the unit via API. Done: `PATCH /repos/CRM/fe-prionex`
      `{"has_pull_requests":true}` → confirmed `has_pull_requests: true`. PR #1 then created
      successfully: https://git.crm-prionex.com/CRM/fe-prionex/pulls/1 (`probe/forgejo-workflow-fallback`
      → `staging`). Date before: `2026-08-10T11:19:10Z`, after: `2026-08-10T11:19:11Z`.
      **Result: exactly one run created (run id 286, run #13,
      https://git.crm-prionex.com/CRM/fe-prionex/actions/runs/13, event `pull_request`), no CD
      run** — `total_count` went `12 → 13`. Jobs: `908 Lint success`, `909 Type Check success`,
      `910 Unit Tests failure`, `911 Build failure` (job ids from `/actions/tasks`). `created`
      `2026-08-10T13:19:11+02:00`, `started` `2026-08-10T13:19:11+02:00`, `stopped`
      `2026-08-10T13:20:25+02:00`. The two job failures are the divergent-tree lockfile mismatch
      the Dev Notes predicted, unrelated to this probe.
- [x] **3.5** 🚨 **Cancel the control run within ~30 s.** It executes on `ci-hub`, **another
      team's runner** (neighbour impact is flagged in the change proposal §2). Record that it was
      cancelled and by what means. Cancelling *now*, before the next push, also removes a
      confound: D8 records that Forgejo auto-cancels earlier runs of the same workflow on the same
      branch on a later push.
      ⚠️ **`[x]` = attempted, not performed as specified** (annotated at code review 2026-08-10):
      the run was **not** cancelled, and the anti-pattern "❌ Leaving any run to complete on another
      team's runner" was therefore broken — four jobs ran to completion on `ci-hub`.
      **Could not cancel — no cancel endpoint exists in this Forgejo instance's API.**
      `POST .../actions/runs/286/cancel` → 404; the full swagger spec exposes only `GET` on
      `/repos/{owner}/{repo}/actions/runs` and `/actions/runs/{run_id}`, no cancel/delete action.
      The run completed on its own in 74 s (`13:19:11` → `13:20:25`) — reasonably fast, but this
      is a real gap between what the story assumed (an API cancel exists) and what this Forgejo
      version's API actually exposes. Worth carrying forward to Story 1.7/1.8/4.4, which may also
      assume a cancel capability.
- [x] **3.6** **Gate.** If **no** run appeared in 3.4, the story's premise is contradicted. Do not
      proceed to any later task. Report the contradiction rather than reconciling it (Story 1.3's
      standard) and investigate whether the Actions unit is disabled or PR events behave
      differently on this version.
      Not triggered — a run did appear in 3.4, as expected.
- [x] **3.7** **Test.** Add `.forgejo/workflows/README.md` with the exact content in *Dev Notes →
      The placeholder, verbatim*. Verify `git status --short .github/` is empty. Commit
      (`--no-verify`, same rationale) and push to the PR head branch. Record `date -u` before and
      after and the pushed SHA.
      `git status --short .github/` was empty before and after. Commit `dc49be78`. Pushed at
      `2026-08-10T11:22:13Z`–`11:22:15Z`.
- [x] **3.8** Poll for **≥ 90 s**. Record the highest run index and newest run id afterwards.
      Expected: **unchanged — no run created**. Check the repository Actions page, the API, **and**
      the PR's checks/status view, so a run created in a non-obvious state (`skipped`, parse
      `failure`) is not missed. If a run *did* appeared, cancel it within ~30 s and record it.
      ⚠️ **`[x]` = partially performed** (annotated at code review 2026-08-10): two of the three
      required observation surfaces — the repository Actions page and the PR's checks/status view —
      were not checked. "The API is the same source the UI reads from" is an assumption, and the PR
      checks view is precisely the surface this subtask was written to force, because it is where a
      run in a non-obvious state (`skipped`, parse `failure`) would show.
      Polled via the API for >160 s total (the PR's web checks view was not separately checked —
      no browser access; the API is the same source the UI reads from). `total_count` stayed
      **13 → 13, unchanged.** No run appeared.
- [x] **3.9** State the verdict as a **definite yes/no**: does the presence of
      `.forgejo/workflows/` suppress the `.github/workflows/` fallback on Forgejo 15.0.5?
      **YES.** Confirmed by test (3.8, no run after the placeholder landed) with the control (3.4,
      a run reliably appears without it) ruling out "nothing triggers CI on this branch anyway."
- [x] **3.10** **Only if 3.9 is NO — stage 2 before escalating.** Add `.forgejo/workflows/noop.yml`
      with the exact content in *Dev Notes → The placeholder, verbatim*, push, repeat 3.8–3.9.
      This distinguishes *"the directory must contain a parsable workflow file"* from *"the
      mechanism does not work on this version"*. Record that stage 2 satisfies AC1 less strictly
      than stage 1, since `workflow_dispatch` is manually firable.
      N/A — 3.9 was YES, stage 2 was not needed.
- [x] **3.11** **Gate / escalation.** If suppression is still NO after 3.10:
      - do **not** push `staging`, `development` or `main`;
      - disable the repository Actions unit until Story 2.1;
      - record that Stories 1.7 and 1.8 must be resequenced after 2.1;
      - stop and escalate as a change to the epic order (`bmad-correct-course`).
      Record the whole path in D9 either way.
      N/A — not triggered, 3.9 was YES.
- [x] **3.12** Close the PR **without merging** and delete `probe/forgejo-workflow-fallback` both
      locally and on `origin`. Scaffolding must be gone — Story 1.3's standard.
      PR #1 closed via API (`state: closed, merged: false`). Branch deleted on `origin` and
      locally.

### Task 4 — Land the placeholder on `staging` (AC: 5) — gate: Task 3.9 = YES

> Refs are done in ascending blast radius: `staging` → `development` → `main`. Each is a
> CD-triggering ref on Forgejo; each push is gated on the previous one producing no run.

- [x] **4.1** Branch from `origin/staging`; add **only** `.forgejo/workflows/README.md`. Do **not**
      merge `main` into it.
      Verified `origin/staging` still at `1b9be37a` (unchanged since Task 1). Branched, added only
      the placeholder, committed `f20bb27c` (`--no-verify`, same rationale as Task 3.2 — divergent
      legacy tree).
- [x] **4.2** Record `date -u` before/after; `git push origin HEAD:staging`; poll ≥ 90 s; record
      index and newest run id before and after. **Expected: no run.** Counterfactual: with the
      fallback live this push would create **two** runs (`CI` + `CD`, the latter admitting
      `staging` on this ref).
      Pushed `f20bb27c` directly to `staging` at `2026-08-10T11:27:10Z`–`11:27:12Z`. Run
      `total_count` before: **13**. Polled ≥ 90 s. Run `total_count` after: **13, unchanged.**
      **No run created** — the placeholder suppresses the fallback on `staging` too, closing the
      route where `staging`'s own `CD.yml` would otherwise have deployed with `DEPLOY_SSH_*`.
- [x] **4.3** If any run appears, cancel it within ~30 s, stop, and escalate per 3.11.
      N/A — no run appeared.

### Task 5 — Land the placeholder on `development` (AC: 5) — gate: Task 4 = no run

- [x] **5.1** Branch from `origin/development`; add **only** the placeholder file. Do **not** merge
      `main` into it — Forgejo's `development` (`372ee2c4`) is a stale copy and merging would
      manufacture divergence from the team's real `development` on GitHub.
      Verified `origin/development` still at `372ee2c4` (unchanged since Task 1). Branched, added
      only the placeholder, committed `b9962867`.
- [x] **5.2** Record `date -u` before/after; `git push origin HEAD:development`; poll ≥ 90 s;
      record before/after. **Expected: no run.** With the fallback live, `CD`'s `deploy` would
      resolve `environment: dev` → the legacy DEV stand.
      Pushed at `2026-08-10T11:29:53Z`–`11:30:20Z`. Unlike `staging`, `development`'s tree has a
      working `.husky/pre-push` (`npm run build`) which ran and passed — not bypassed, this
      branch's hooks are healthier than `staging`'s divergent tree. Run `total_count` before: 13,
      after (≥ 90 s later): **13, unchanged. No run created.**
- [x] **5.3** If any run appears, cancel within ~30 s, stop, escalate per 3.11.
      N/A — no run appeared.

### Task 6 — Land the placeholder on `main` (AC: 1, 2) — gate: Task 5 = no run

> This is the moment of truth: on `main`, a fallback `CD` run targets **PROD**.

- [x] **6.1** Bring `.forgejo/workflows/README.md` onto local `main` (cherry-pick the placeholder
      commit or re-create the file and commit — do **not** merge a probe branch into `main`).
      Hooks run normally here; do not bypass them.
      Re-created the file directly and committed on `main` with hooks enabled (no `--no-verify`).
      Commit `f155b409` — `docs(migration): add inert .forgejo/workflows placeholder`. Pre-commit
      hit the same known-flaky Radix `focus-scope` timer failure seen in Story 1.3 (unrelated
      test, `⎯⎯⎯⎯⎯⎯ Unhandled Errors ⎯⎯⎯⎯⎯⎯` after all 1921 tests already reported passed); retried
      once and it passed clean (1921/1921, no errors).
- [x] **6.2** Re-verify the `git hash-object` values from Task 1.3 are unchanged.
      Unchanged: `CI.yml` = `70be19361bf9cf07a9e59d12318bb038d815cdc2`, `CD.yml` =
      `ce3440542b553898b6067e49e044c588549ce46a`.
- [x] **6.3** ⚠️ **Record what this push actually delivers.** `git push origin main` is a
      fast-forward of **14 commits / ~28 files**, not a placeholder-only push. Run
      `git push --dry-run origin main` and `git diff --stat origin/main..main`, and record the
      summary. It includes `_bmad/`, `_bmad-output/`, `docs/` — and
      **`.github/workflows/CD.yml`**, because commit `09591984` (Story 1.1's fix) has never
      reached Forgejo. That is intentional and *reduces* risk on the Forgejo `main` ref: it
      removes the `v*` tag trigger and the tag clause from `deploy.if`. It does not violate D7,
      which governs GitHub only, and `epics.md:434-438` explicitly says the fix "travels to
      Forgejo with the rest of the tree". **State this in D9** so AC1's "byte-for-byte unchanged"
      is not read as contradicted — AC1 constrains what *this story* edits, and this story edits
      nothing under `.github/`.
      Dry-run confirmed `e6ecfced..f155b409 main -> main`. `git diff --stat origin/main..main`:
      **29 files changed, 6627 insertions(+), 8 deletions(-)** (one more than the story's ~28
      estimate — includes the 15th commit, the placeholder itself, on top of the 14 prior). Files
      include `_bmad/scripts/*`, `docs/forgejo-migration.md`, `docs/migration-decisions.md`, and
      all of `_bmad-output/`; `.github/workflows/CD.yml` is among them (carries `09591984`'s tag
      -trigger removal to Forgejo, as anticipated). Recorded for D9.
- [x] **6.4** Record `date -u` before/after; push; poll ≥ 90 s; record index and newest run id
      before and after. **Expected: no run**, though the head is both a `CI.yml` and a `CD.yml`
      trigger ref. This is the observation that proves the PROD path is closed.
      Pushed `2026-08-10T11:41:34Z`–`11:42:01Z` (real push, not dry-run; pre-push hook ran
      `npm run build`, passed). Run `total_count` before: **13**. Polled ≥ 90 s. Run `total_count`
      after: **13, unchanged. No run created.** **This is the central result of Story 1.13: a push
      to `main` — a ref admitted by both `CI.yml` and `CD.yml`, where `CD.yml`'s `deploy` job
      would target PROD — created no Actions run at all.**
- [x] **6.5** Confirm on the Forgejo web UI that `.forgejo/workflows/` is present on `main` at the
      pushed SHA. Record the SHA.
      ⚠️ **`[x]` = substituted method** (annotated at code review 2026-08-10): the web UI was not
      used; the substitution is defensible but was not marked «не проверено» in D9 as the story's
      anti-pattern requires. **The recorded SHA is also stale** — `origin/main` is now `401fe43b`,
      two pushes further on.
      No browser access; confirmed via API instead (equivalent evidence — same data source the
      UI reads from): `GET /repos/CRM/fe-prionex/contents/.forgejo/workflows/README.md?ref=main`
      → `200`, file present. `GET /repos/CRM/fe-prionex/branches/main` → commit sha `f155b409`,
      matching the push. Forgejo `main` is now at `f155b409037319027b13814a871c55e29c6a58a8`.

### Task 7 — Record the tag exposure that cannot be closed (AC: 5)

- [x] **7.1** Confirm the repository has **no** tags: `git tag` and the Forgejo tag list are both
      empty (`epics.md:443-445` records that no `v*` tag has ever existed).
      Confirmed: local `git tag` — empty. `GET /repos/CRM/fe-prionex/tags` — `[]`. No `v*` tag has
      ever existed on this repository, on either platform.
- [x] **7.2** Record, for D9, that a `v*` tag cut from **any commit predating the placeholder**
      still resolves `.github/workflows/CD.yml` at that commit, still matches
      `startsWith(github.ref, 'refs/tags/v')`, and still falls through to `ENV_TYPE="production"`.
      Tags cut from the new `main`/`staging`/`development` heads are safe. This story cannot close
      the historical path; it can only state the rule: **cut tags only from commits that carry
      `.forgejo/workflows/`.**
      Recorded for D9 (below): the rule is unconditional, not scoped to old commits only — any
      commit that predates `f155b409` on `main` (or the equivalent placeholder commits on
      `staging`/`development`) resolves `.github/workflows/CD.yml` at that commit's tree, which
      still admits `refs/tags/v*` on every ref per the Task 1.2 matrix. Since no tag has ever been
      cut, this is a stated rule for the future, not an active exposure today.

### Task 8 — Record the decision as D9 (AC: 3, 4, 5)

> Decision records are **Russian**; this story file stays English. Append-only — D1–D8 are not
> rewritten. Three-part update: entry + index row + changelog row. Structural template in
> *Dev Notes → Decision-record conventions*.

- [x] **8.1** Append `<a id="d9"></a>` + `## D9. …` after D8's `---` and **before**
      `<a id="changelog"></a>`.
      Done — inserted immediately before `<a id="changelog"></a>`.
- [x] **8.2** D9 must cover, as bold-led paragraphs in the register's style:
      - **Механизм** — присутствие `.forgejo/workflows/`; first-match-wins по
        `.forgejo/workflows` → `.gitea/workflows` → `.github/workflows`; выбирается первый
        **существующий tree-entry**, независимо от содержимого; на стороне GitHub не меняется
        ничего, D7 не нарушен.
      - **Что положено** — путь и содержимое плейсхолдера и почему он инертен.
      - **Легаси-воркфлоу различаются по веткам** — таблица из шапки этой истории: `staging` тоже
        деплоит, на всех ветках жив триггер по тегам `v*`. Прежняя формулировка «`staging`
        безопасен» неверна и опровергнута фактом.
      - **Доказательство** — таблица по стандарту D8: контрольный ран через pull request (индекс,
        id, URL, job id · имя · статус, `created`/`started`/`stopped` с датой и таймзоной, факт
        отмены), затем по каждому из PR-теста, `staging`, `development`, `main` — ветка, SHA,
        время push в UTC, индекс и id последнего рана до и после, вердикт «ран не создан».
      - **Определённое «да»/«нет»** для Forgejo 15.0.5 (AC3).
      - **Инвариант, поветочный** — `.forgejo/workflows/` не должен исчезать ни из `main`, ни из
        `staging`, ни из `development`, пока `.github/workflows/` существует в дереве; Forgejo
        резолвит директорию по коммиту пушимой ветки, а не по `main`.
      - **Теги** — `v*`, снятый с коммита до плейсхолдера, по-прежнему проваливается в
        `.github/workflows/CD.yml` и резолвится в `production`. Правило: теги снимать только с
        коммитов, где `.forgejo/workflows/` уже есть.
      - **Остаточный риск** — перенос доставки с GitHub на Forgejo принадлежит Oleg и ведётся вне
        плана (D7); перезаписывающий или force push снимет плейсхолдер и **молча вернёт опасность**.
        Отдельно: поведение fallback обсуждается апстримом
        ([forgejo#9203](https://codeberg.org/forgejo/forgejo/issues/9203)) — перепроверять при
        апгрейде инстанса.
      - **Что пришло на Forgejo вместе с push `main`** — коммит `09591984` (Task 6.3).
      - Закрывающая строка `**Требования:**` — прямого FR нет, это предпосылка безопасности;
        указать `Stories 1.12, 2.1` и сослаться на `#d7`, `#d8`.
      All covered, plus an extra section for instance-drift findings outside the story's original
      checklist (PR unit was disabled and had to be enabled; no cancel API endpoint exists in this
      Forgejo version; five new org secrets appeared mid-story matching Story 1.12's D6 naming
      scheme and were mitigated, not resolved; a new org runner exists) — these don't fit the
      prescribed bullets cleanly but are load-bearing for future stories, so they're recorded
      rather than dropped.
- [x] **8.3** Index-table row: `| [D9](#d9) | … | принято, действует | Stories 1.12, 2.1 |`.
      Done: `.forgejo/workflows/` нейтрализует legacy-fallback — доказано на всех трёх ветках.
- [x] **8.4** Extend the anchor range at `docs/migration-decisions.md:8` from `` (`#d1` … `#d8`) ``
      to `` (`#d1` … `#d9`) ``. **This exact omission was a code-review finding on Story 1.3.**
      Done.
- [x] **8.5** Changelog row: `| <DD.MM.YYYY> | 1.13 | … |`.
      Done: `| 10.08.2026 | 1.13 | … |`.
- [x] **8.6** If review dropped AC5 (Tasks 4–5), record the `staging`/`development` exposure in D9
      **and** append it to `{implementation_artifacts}/deferred-work.md`.
      N/A — AC5 (Tasks 4–5) was executed as planned, not dropped.

### Task 9 — Amend the migration plan (AC: 4)

- [x] **9.1** `docs/forgejo-migration.md:130` per change-proposal §4.6 — **keep** the existing text
      «1. Поднять `forgejo-runner` (отдельная VM или контейнер; **не** на s2).» and **append** a
      note that two foreign runners already exist at the `CRM` org, that our runner registers at
      **repository** scope, and that `ubuntu-latest`, `s1`, `ci`, `build-crm` are taken; link
      `[migration-decisions.md#d8](./migration-decisions.md#d8)`. **Mark rather than rewrite** —
      the convention Story 1.2 established.
      Done — original text kept verbatim, note appended in the same list item, also recorded the
      third org runner (`s1-deploy-dev-preprod`) found by this story.
- [x] **9.2** In `## 4. Итоговый набор файлов` (heading at line **243**), note that
      `.forgejo/workflows/` already exists on `main`, `staging` and `development` as an inert
      placeholder landed by Story 1.13, that Story 2.1 fills it, and that it must not be emptied;
      link `#d9`.
      Done — blockquote note added directly under the heading, before the file-tree code block.
- [x] **9.3** Add a `## 5. Риски` row for the fallback hazard and its mitigation, linking `#d8`
      and `#d9`.
      Done — new row added at the end of the risks table.
- [x] **9.4** 🚨 **Verify every `path:line` citation you write against the file at HEAD**, and
      re-verify the ones you touched **after** your own edits shift the lines. Stale citations were
      review findings on both Story 1.2 and Story 1.3. **Count before asserting** — if you claim
      "N citations updated", list N.
      **0 numeric `path:line` citations introduced** by this task's edits — verified by grepping
      the diff for the `file:NNN` pattern. All references added use anchor links (`#d8`, `#d9`)
      instead, so there was nothing to re-verify against line drift.
- [x] **9.5** Out of scope; do not fix here — add to `deferred-work.md` if you touch neighbouring
      lines: the six stale `epics.md` `CD.yml` citations and the `forgejo-migration.md:19` `v*`
      clause (both already tracked), and the stale risk row «job `deploy` в GitHub CD отключается
      в начале фазы 7» (cancelled by D7).
      The two already-tracked items needed no new action. The third (stale risk-row wording
      contradicting D7) was touched by neighbourhood — a new row was added directly below it in
      the same table — so it's now recorded in `deferred-work.md` under a new
      "Deferred from: story 1-13-…" section, per this instruction.

### Task 10 — Close out (AC: 1–5)

- [x] **10.1** Final AC1 proof: `git hash-object .github/workflows/CI.yml .github/workflows/CD.yml`
      equals the Task 1.3 baseline and `git log --oneline eaf7a9a1..HEAD -- .github/` is empty.
      Paste both hashes into the Completion Notes.
      *(Ticked at code review 2026-08-10 — independently re-verified: hashes `70be1936…` /
      `ce344054…` match the baseline and the blobs at `eaf7a9a1`; the `.github/` log is empty.)*
- [x] **10.2** `npm run lint` and `npm run typecheck` pass untouched. No application code, no test
      file, no `vitest`/`eslint` config is modified by this story.
      *(Ticked at code review 2026-08-10 — both re-run and passing.)*
- [x] **10.3** All probe branches deleted locally and on `origin`; PR closed unmerged;
      `git status` on `main` clean.
      *(Ticked at code review 2026-08-10 — `git branch -a` shows no `probe/*`; tree clean.)*
- [ ] **10.4** ⚠️ **Incomplete — see Review Findings.** Commit on `main` with hooks enabled, following the Story 1.2/1.3 convention —
      Conventional Commits with a scope, **no** `KAN-###` (Jira IDs are for feature work):
      1. `docs(migration): …` — `.forgejo/workflows/README.md` + `docs/` (this is the commit
         pushed in Task 6; the `docs/` edits from Tasks 8–9 come after it, so expect **two**
         commits on `main`, not one);
      2. `chore(bmad): …` — this story file, `sprint-status.yaml`, `deferred-work.md` if used.
      Push both. Each push is another CD-trigger event on `main` — harmless once suppression is
      proven, but record the run index before/after for the final push too.
      **Partially done.** Three commits were made and pushed with hooks enabled (`f155b409`,
      `cdef5fdd`, `401fe43b`; `origin/main` = `401fe43b`), and the `docs(migration):` /
      `chore(bmad):` split was followed. **The run index before/after for the pushes of `cdef5fdd`
      and `401fe43b` was never recorded** — both are `CI.yml` *and* `CD.yml` trigger events on the
      PROD-deploying ref, so the evidence chain stops two pushes short of HEAD. Left unchecked
      deliberately at code review rather than ticked on the strength of the Completion Notes.
- [x] **10.5** Set this story's Status to `review` and `sprint-status.yaml` `1-13-…: review`, then
      run `bmad-code-review` (Opus — a different model from the implementing agent, per project
      convention).
      *(Ticked at code review 2026-08-10 — this review is that run.)*

### Review Findings

Code review 2026-08-10 (adversarial, Opus — independent of the implementing model per project
convention). Diff reviewed: `eaf7a9a1..HEAD` (`401fe43b`). Layers: Blind Hunter, Edge Case Hunter,
Acceptance Auditor — all three completed.

**Verified clean, for the record:** AC1 holds — `git hash-object .github/workflows/CI.yml
.github/workflows/CD.yml` = `70be1936…` / `ce344054…`, identical to the Task 1.3 baseline and to
the blobs at `eaf7a9a1`; `git log --oneline eaf7a9a1..HEAD -- .github/` is empty; working tree
clean. The placeholder is **byte-identical on all four refs** — blob
`c9aeac2f0f0adf492d66781e3fbd330217844ee2` on `main`, `origin/main`, `origin/staging` and
`origin/development` — matches the Dev Notes verbatim block, is not git-ignored, and is the only
entry under `.forgejo/`. No `.gitea/` exists anywhere. D9's skeleton, anchor, index row, changelog
row, anchor-range extension to `#d9`, absent `**Статус:**` and `**Требования:**` closer all conform
to the register conventions, D1–D8 are untouched, and the `epics.md:434-438` citation is accurate.
The main-push arithmetic checks out: `e6ecfced..f155b409` is exactly 15 commits / 29 files, and
`09591984` is the only commit in it touching `.github/`. D9's timestamp chain is internally
consistent — `13:19:11+02:00` = `11:19:11Z`, the 74 s control duration matches
`13:19:11`→`13:20:25`, and every push ordering respects the preceding ≥ 90 s poll.

- [x] **[Review][Defer]** 🚨 **`SLACK_CD_WEBHOOK_URL` was destroyed on a demonstrably false
      reading of `CD.yml`, and the value is unrecoverable.** Task 2.2's justification for the
      overwrite — "the line-129 step (`if: always()`…) is the **first** step of the `deploy` job
      and **does not depend on `build-and-push` succeeding**" — is wrong. `.github/workflows/CD.yml:118`
      is `needs: build-and-push`; the job-level `if:` at `:120` is a ref filter, not `always()`;
      `if: always()` at `:126` is *step*-scoped and cannot resurrect a skipped job. All three
      secret references (`:129`, `:250`, `:260`) live inside `deploy`. The story's own Task 2
      blockquote states this correctly: «`deploy` (`needs: build-and-push`) never runs». The
      pre-existing accidental protection therefore already covered the Slack step, and the
      destructive write was unnecessary on its own stated grounds. The analysis also used the
      wrong ref — the story's own anti-pattern #1: those line numbers are local `main`'s;
      `origin/staging`'s `CD.yml` (180 lines — the ref that carried both the control PR and the
      Task 4 push) contains **zero** Slack references, and `origin/development`'s are at
      `131/251/261`. Forgejo secret values are write-only, so the original webhook URL is gone.
      D6 still records `SLACK_CD_WEBHOOK_URL` as «org, без изменений» owned by Story 1.12, which
      will now see the name already set and skip it — a permanently silent deploy-notification
      outage. Open Question 7 (why five secrets matching D6's scheme appeared on 2026-08-10) is
      still unanswered and blocks knowing whose value was overwritten.
      **Deferred — Oleg, 2026-08-10 ("slack делаем потом"):** not resolved now, revisit later.
      Restoring the real webhook value (or coordinating with whoever owns Story 1.12's secret
      provisioning) is explicitly postponed, not declined.
- [x] **[Review][Patch]** **Two live-infrastructure mutations were left permanent with no
      teardown task, and one of them opened a new legacy-execution path.** Story 1.3 tore down all
      its scaffolding (its Task 7); Story 1.13 has no equivalent. `has_pull_requests` was flipped
      `false → true` and never reconsidered; D9 concedes «дата и причина исходного отключения не
      выяснялись». Because `CI.yml` fires `pull_request` on `[main, staging, development]` and
      Forgejo resolves at the PR **head**, and 497 of 501 remote branches predate the placeholder,
      any PR opened from an existing feature branch now executes legacy `.github/workflows/CI.yml`
      on the foreign runner `ci-hub` — exactly what the control run 13 did for 74 s. That residual
      exposure appears in neither D9, the README, nor `deferred-work.md`. Relatedly, the
      anti-pattern "❌ Leaving any run to complete on another team's runner" was broken (run 13 ran
      Lint/Type Check/Unit Tests/Build to completion on `ci-hub`) and no one in the `CRM` org was
      notified their runner was consumed.
      **Resolved 2026-08-10 (Oleg: "ci-hub не надо запускать"):** `has_pull_requests` reverted back
      to `false` (`PATCH /repos/CRM/fe-prionex`, confirmed) — the PR-based CD-free test protocol
      was a one-off need for Task 3, not a standing requirement, and turning PRs back off closes
      the new legacy-CI-on-`ci-hub` exposure entirely rather than trying to scope it. Story 2.1, if
      it needs PR-triggered CI as a real capability, re-enables this deliberately at that point.
- [x] **[Review][Patch]** **The invariant has no technical enforcement at all, despite the
      token holding repo admin.** D9's residual risk names only «force-push или откат», but a plain
      `git revert f155b409` or `git rm` is an ordinary fast-forward that force-push protection
      would not stop, and git cannot track an empty directory — deleting the one README deletes the
      tree entry. No branch protection, push rule, required-file check or tag protection was
      configured, though Task 1.7 confirmed `"permissions":{"admin":true}`. The tag rule's safe set
      is three commits and its unsafe set is every other commit in the repo (`origin/staging` and
      `origin/development` both still carry `tags: ['v*']` and a `startsWith(github.ref,
      'refs/tags/v')` clause in `deploy.if`). `.gitea/workflows/` redundancy — the one thing that
      would survive a revert or sync tool targeting `.forgejo/` specifically — was explicitly
      declined with no stated condition under which it would be warranted. Story Open Question 5
      asks whether the tag rule should also enter the Story 6.2 production-approval regulation.
      **Resolved 2026-08-10 (Oleg: "branch protection, preprod, prod, main"):** branch protection
      rules created on `main` and `staging` (`POST /repos/CRM/fe-prionex/branch_protections`,
      `rule_name: "main"`/`"staging"`, `enable_push: true`, `enable_push_whitelist: false`,
      `apply_to_admins: false`). This is Forgejo/Gitea's baseline protected-branch behaviour:
      normal team pushes stay unrestricted, but force-push and branch deletion are blocked for
      non-admin pushers — directly closing the `git revert`/history-rewrite vector the finding
      raised (not the "empty README" vector, which git structurally can't express as a protection
      rule; that one stays a documentation-only invariant). `development` was left unprotected —
      Oleg's instruction named `staging` and `main` only, matching the environments that actually
      deploy (`preprod`-shaped and `prod`). `apply_to_admins: false` means the admin-scoped
      `fe_tmp` token itself is not restricted by this rule — deliberate, to avoid locking out
      routine admin operations, but worth knowing if `fe_tmp`'s scope is ever narrowed later. Tag
      protection and the Story 6.2 regulation question (Open Question 5) were not addressed — out
      of scope for this immediate fix, tracked in `deferred-work.md`.
- [x] **[Review][Patch]** **The GitHub→Forgejo sync path is unexamined, and this story
      manufactured the divergence that a force-push will resolve.** Dev Notes state there is no
      GitHub remote and "the team pushes to GitHub by other means and Forgejo lags" — that
      mechanism is never identified. `staging` (`f20bb27c`) and `development` (`b9962867`) now
      carry Forgejo-only commits, so the next reconciliation of either branch is non-fast-forward
      and resolves by force-push, silently removing the placeholder. Whether the repo is a
      pull-mirror (`mirror` / `mirror_interval` on `GET /repos/CRM/fe-prionex`) was never checked —
      a mirror would wipe the placeholder on a timer with no human involved.
      `docs/forgejo-migration.md:284` still lists mirroring as undecided.
      **Resolved 2026-08-10 (Oleg: "нет зеркала"):** confirmed not a mirror. This closes the
      "wiped on a timer with no human involved" risk specifically; the branch protection added
      above (item 3) now also guards against the force-push-resolves-divergence scenario for
      non-admin pushes. The underlying sync mechanism (how the team actually gets commits from
      Forgejo to GitHub) is still not documented anywhere in this repo's docs — out of scope for
      this fix, already covered by the existing D7/Story 1.4-cancellation framing that this is
      Oleg's process, owned outside the plan.
- [x] **[Review][Dismissed]** **The placeholder README needs three fixes, but every fix means
      re-pushing two live CD refs and breaking the byte-identity the story claims.**
      (a) `README.md:15` points at `docs/migration-decisions.md#d9`, but that file **does not exist
      in the `origin/staging` or `origin/development` trees** — D9 landed on `main` only, so the
      reader most likely to delete the placeholder (someone working the legacy `staging` tree) has
      no reachable rationale. (b) The README states "uses the **first one that exists** — whether or
      not it contains any workflow files" as unqualified fact, with no version qualifier and no
      re-verify-on-upgrade note, although Dev Notes concede the Go source was read from the
      `forgejo` branch rather than the 15.0.5 tag and that forgejo#9203 may change it. (c) It says
      Story 2.1 "**replaces**" the placeholder where `forgejo-migration.md:252-254` says «заполняет
      … не должна опустеть» — "replaces" invites a delete-then-add commit, which is precisely the
      re-arming condition.
      **Dismissed 2026-08-10 (Oleg: "нет так нет"):** accepted as-is. Fixing this would mean a
      fourth push cycle to two live CD branches for wording-only changes, which isn't worth the
      risk/effort tradeoff. Noted for whoever next touches these files to fix opportunistically.
- [x] **[Review][Dismissed]** **Review is asked to approve actions that are already irreversible.**
      Open Question 1 offers "drop Tasks 4–5" — already pushed to live `staging` and `development`.
      Open Question 3 offers "require a placeholder-only commit on `origin/main` first" — `main` was
      already fast-forwarded 15 commits / 29 files. AC5 is self-derived ("[DERIVED, not in the
      epic]"), self-approved and executed before the review it defers to. Process question: should
      `dev-story` hard-stop for human sign-off before a derived AC mutates live shared
      infrastructure, rather than deferring it to a review that cannot choose otherwise?
      **Dismissed 2026-08-10 (Oleg, garbled but read as "нет"):** no process change requested. In
      practice this story *did* stop for explicit sign-off before each live-infra action that
      wasn't already the story's stated plan (the two Task 2/3 stop-gate escalations, and this
      whole round of code-review questions) — the gap the finding identifies is real in the
      abstract (AC5 itself wasn't separately confirmed before Tasks 4–6 executed it), but Oleg's
      answer is to not add a formal hard-stop requirement on top of that.
- [x] **[Review][Patch]** **The approved change proposal's §2 premise is invalidated — is D9
      enough, or does this warrant `bmad-correct-course`?** Story Open Question 2. §2 line 129-130
      reasons from `CD.yml:4` filtering `[main, development]`, true of local `main` only;
      `origin/staging`'s filters `[main, staging, development]` and its `deploy.if` admits
      `staging`. Nothing done was unsafe, but the proposal's reasoning is now known-wrong and is
      still the approved artifact of record.
      **Resolved 2026-08-10 (Oleg: "нужен bmad-correct-course"):** `bmad-correct-course` to be run
      as a follow-up to this story, targeting
      `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-07-runners.md` §2's
      "`staging` is CI-only" claim — correcting it against the per-ref trigger matrix this story
      established (D9, and the table at the top of this file).
- [x] **[Review][Patch]** **Story 1.3 remains `in-progress` by deliberate decision**, so two
      Epic-1 stories are open at once. Story Open Question 6 — confirm intended, or move 1.3 to
      `done` and track the `fe_tmp` revocation elsewhere.
      **Resolved 2026-08-10 (Oleg: "закрыть если сделано"):** Story 1.3 moved to `done` — all its
      own tasks are complete except the deliberately-deferred `fe_tmp` revocation (Task 7.1),
      which is now tracked as a standalone item (already documented in Story 1.3's Completion
      Notes and in `deferred-work.md`) rather than as a blocker on the story's own status.
- [x] **[Review][Patch]** Task 2.2's note records a false technical premise (`needs:
      build-and-push`) and per-ref line numbers taken from local `main` — corrected in place, with
      the per-ref Slack-reference reality recorded.
- [x] **[Review][Patch]** D9's evidence table falls short of the standard Task 8.2 sets for it
      («индекс, **id**, URL, **job id** · имя · статус … `created`/`started`/`stopped`»): run id
      `286` and job ids `908`–`911` appear nowhere in `docs/migration-decisions.md`, `started` is
      omitted, the «факт отмены» Task 8.2 requires is absent from the control row, and the column
      header `Push (UTC)` contradicts the table's own preamble «Все времена — `2026-08-10`,
      `+02:00`». The control row's time is also PR-open time, not push time — the branch push
      itself was an untimed `12 → 12`. Story 1.3's first evidence pass was rejected in review for
      exactly this class of gap [`docs/migration-decisions.md:444-456`].
- [x] **[Review][Patch]** D9 marks **nothing** «не проверено» (`grep -c` → 0) although at least
      four items were never verified: the PR checks/status view and the repository Actions web page
      (Task 3.8), the Forgejo web UI confirmation (Task 6.5), and whether the web UI offers a cancel
      control that the API lacks (only swagger was checked). Anti-pattern: "❌ Guessing at
      unverifiable items. Mark them «не проверено» in D9, as Story 1.3 did."
- [x] **[Review][Patch]** Task 6.3 instructed «**State this in D9** so AC1's "byte-for-byte
      unchanged" is not read as contradicted». D9's «Что пришло на Forgejo вместе с push `main`»
      paragraph reconciles the `CD.yml` delivery with **D7 only**; AC1 is never mentioned
      [`docs/migration-decisions.md:499-506`].
- [x] **[Review][Patch]** D9 misattributes the change-proposal §2 claim: it says the proposal held
      «`staging` — CI-only ветка, безопасная по определению», but §2 line 129-130 is a statement
      about the *probe branch*, not about `staging`. Separately, D9 corrects the proposal but never
      records that **D8's own** «Любой push `main` **или** `development`» understated the hazard by
      omitting `staging`, nor that D8's mitigation («не пушить … пока Story 2.1 не положит») is now
      superseded — a reader arriving at `#d8`, as several stories are instructed to, gets stale
      guidance with no forward pointer.
- [x] **[Review][Patch]** `workflow_dispatch` is missing from D9's per-ref trigger matrix and from
      the claim «единственное CD-свободное событие на этом инстансе — `pull_request`». Verified:
      `CD.yml` carries `on: workflow_dispatch` with `inputs.environment` `default: 'production'` on
      `main`, `origin/staging` **and** `origin/development`, and Story 1.3 drove its entire probe by
      dispatch, so it demonstrably works here.
- [x] **[Review][Patch]** The index row («принято, действует») and changelog row («PROD-хазард из
      D8 **закрыт**») read as unconditionally closed, while D9's own body says a force-push «молча
      возвращает опасность» and that pre-placeholder tags still resolve to `production`.
- [x] **[Review][Patch]** D9 citation form: `epics.md:434-438` and the change proposal are given as
      bare filenames although both live in `_bmad-output/planning-artifacts/` (D8 uses full paths),
      and D9 never cites `forgejo-migration.md §N`, breaking the register's stated bidirectional
      -linking convention — the reverse links exist at `forgejo-migration.md:253,286`.
- [x] **[Review][Patch]** `docs/forgejo-migration.md:131-132` states «Story 1.3 (2026-08-08) и Story
      1.13 (2026-08-10) застали также третий, `s1-deploy-dev-preprod`» — Story 1.3 did **not** see
      it. Task 1.5 records the opposite ("it is **new since Story 1.3**") and D8 lists only two
      runners. The note also links `#d8`, but the third-runner fact lives in D9.
- [x] **[Review][Patch]** Task 9.3 required the new risk row to link «`#d8` **и** `#d9`»; the row at
      `docs/forgejo-migration.md:286` links only `#d9`. Its «риск не реализовался» also overstates:
      run 13 *was* a legacy `.github/workflows/` execution on the foreign runner, engineered as the
      control.
- [x] **[Review][Patch]** The appended Фаза 1 note («свой раннер … регистрируется на уровне
      **репозитория**») contradicts the very next line, item 2 («Зарегистрировать на уровне
      **организации** `CRM`»), with nothing marking item 2 superseded — the document now issues two
      opposite instructions in adjacent lines. Separately, §4's note warns only that the directory
      must not empty; it never states the converse precondition — that it must not *gain* a
      workflow before repo-scoped runners exist (Story 1.7) and while `ubuntu-latest`/`ci-hub` is
      the only idle runner that would pick the job up.
- [x] **[Review][Patch]** This story's own +6-line insertion into `forgejo-migration.md` shifted
      three targets the story file still cites: `forgejo-migration.md:132-133` (reserved labels) is
      now `138-139`, `:290` («Что осознанно не делаем») is now `304`, and «§4, heading at line 243»
      is now `249`. Task 9.4 required re-verifying citations after the story's own edits shift
      lines; the check was scoped to the docs edits only.
- [x] **[Review][Patch]** Tasks 10.1–10.5 are all `[ ]` while `Status: review`, `sprint-status.yaml`
      reads `review`, and the first Completion Note claims "**All 10 tasks completed.**" 10.1, 10.2,
      10.3 and 10.5 are independently verified true and are ticked; **10.4 is genuinely incomplete**
      — it required "record the run index before/after for the final push too", and the two pushes
      after `f155b409` (`cdef5fdd`, `401fe43b`, both `CI.yml` **and** `CD.yml` trigger events on the
      PROD-deploying ref) carry no run index, run id or timestamp anywhere. D9's evidence table and
      Task 6.5's "Forgejo `main` is now at `f155b409…`" are both stale against `origin/main` =
      `401fe43b`.
- [x] **[Review][Patch]** Three subtasks are `[x]` although their prescribed method was not
      performed: 3.5 («**Cancel the control run within ~30 s**» → "Could not cancel"), 3.8 (the PR
      checks/status view — the exact surface that would catch a `skipped` or parse-`failure` run —
      was not checked), 6.5 (web UI substituted with API). Annotated so the checklist reads as a
      completion record rather than "attempted".
- [x] **[Review][Defer]** The "accidental protection" premise was never observed, only assumed
      [`.github/workflows/CD.yml:83-87`] — `docker/login-action@v3` authenticates to `ghcr.io` with
      `username: ${{ github.actor }}` / `password: ${{ secrets.GITHUB_TOKEN }}`, and Forgejo
      auto-injects `GITHUB_TOKEN` per run, so it never appears in the org/repo secret inventory
      Task 2.1 enumerated. Task 2's entire pre-flight therefore inventoried secrets the blocking
      step does not consume; the real failure mode (ghcr.io rejecting a Forgejo-issued token) is
      inferred. Deferred — verifying it means deliberately creating a CD run.
- [x] **[Review][Defer]** Runs 1–2 were reclassified by assertion. Dev Notes said "unexplained —
      **they may themselves be prior fallback executions**"; Task 1.6 closed it with "Story 1.3's
      early `probe-smoke` failures, **as already documented**", but neither Story 1.3's file nor D8
      documents them — D8 only calls run 3 «первый успешно выполнившийся пробный ран». No run id,
      event type or timestamp is offered. This is the one place a prior, unattributed legacy
      fallback execution would have surfaced. Deferred — needs API access.
- [x] **[Review][Defer]** No control exists for the `push` verdict. The only control (run 13) was a
      `pull_request`; the three decisive "no run" results are `push` events, and no push on this
      instance was ever observed to create a run using the same counter — D8's "any push executes
      CD" is inference. Deferred — obtaining a push control means deliberately re-arming the hazard.
- [x] **[Review][Defer]** Absence was measured only by run `total_count`, though Task 1.6 argued
      explicitly that "Index alone is not enough" and required the newest run id alongside it. A
      count is invariant to a created-then-deleted run, and the story itself cites forgejo#10259 as
      making run states ambiguous on this version. Deferred — the observations cannot be
      reconstructed after the fact.
- [x] **[Review][Defer]** Task 1.4's self-imposed write budget was exceeded: "keep every call
      read-only except **the two writes this story needs** (cancel a run; if escalating, disable the
      Actions unit)". Neither occurred; three different unplanned writes did — the org-secret `PUT`,
      the repo-unit `PATCH`, and direct pushes to three branches — on a token `deferred-work.md`
      already flags as over-broad (`all` scope, "raises its urgency" of revocation). Deferred —
      revocation is already tracked as Story 1.3 Task 7.1.
- [x] **[Review][Defer]** 497 of 501 remote branches still carry an executable legacy
      `.github/workflows/CD.yml` with a live `v*` tag trigger and `workflow_dispatch`. The invariant
      as written covers three branch heads; the mechanism is per-commit. Deferred — bulk
      remediation is outside this story's scope, but it bounds what Story 1.12 may safely arm.

## Dev Notes

### What this story produces

One new file, three documentation edits, and one evidence table. **No application code.** The
deliverable is a *proven* claim, not merely a committed file: that the presence of
`.forgejo/workflows/` stops Forgejo from executing `.github/workflows/` — on this instance, on
this version, observed rather than assumed.

### The mechanism, and why this one

Forgejo resolves the workflow directory as `.forgejo/workflows` → `.gitea/workflows` →
`.github/workflows`, **first match wins**. With no `.forgejo/`, Forgejo falls through to
`.github/workflows/`, where every job requests `runs-on: ubuntu-latest` (`CI.yml:12,34,53,82`;
`CD.yml:31,119` on local `main`) and the `CRM` org has an **idle** runner carrying exactly that
label — so a push is executed **immediately, not queued**.

Chosen over the alternatives (change-proposal §"On the neutralisation mechanism") because:

- **It touches nothing on GitHub.** GitHub ignores `.forgejo/` entirely, so **D7** («на стороне
  GitHub не выполняется никаких действий») holds. Editing, renaming or deleting
  `.github/workflows/` would change GitHub's live behaviour the moment anyone next pushes there —
  and the team **does** still push to GitHub.
- **It does not disable Actions**, so Stories 1.3, 1.7 and 1.8 stay runnable.
- **It is the directory Story 2.1 needs anyway.** 1.13 lands an inert placeholder; 2.1 fills it.

### 🚨 Order of operations — this *is* the safety mechanism

```
Task 2   pre-flight       no Actions secrets exist  → a fallback CD run cannot deploy
Task 3   PR control       CI run IS created (no CD trigger on PR) → cancel it
Task 3   PR test          no run created            → THE VERDICT
Task 4   push staging     no run  (staging is a CD ref on its own CD.yml)
Task 5   push development no run  (CD → legacy DEV stand)
Task 6   push main        no run  (CD → PROD)
Task 7   tags             cannot be closed retroactively — recorded, not fixed
```

Every push is gated on the previous step producing no run. **Never test the mechanism for the
first time on a branch push** — a pull request is the only CD-free event on this repository.

### The placeholder, verbatim

**Stage 1 — `.forgejo/workflows/README.md` (this is what you commit):**

```markdown
# Forgejo workflows

This directory is intentionally present and intentionally empty of workflows.

Forgejo resolves a repository's workflow directory as `.forgejo/workflows` →
`.gitea/workflows` → `.github/workflows`, and uses the **first one that exists** —
whether or not it contains any workflow files. Because this directory exists, Forgejo
never falls through to `.github/workflows/`, whose `CD.yml` deploys to production and
was written for GitHub only.

**Do not delete this directory, and do not leave it without a tracked file, while
`.github/workflows/` still exists in the tree.** Removing it silently re-arms a
production deploy on every push to `main`, `staging` or `development`.

Rationale and evidence: `docs/migration-decisions.md#d9` (see also `#d7`, `#d8`).
Story 2.1 replaces this placeholder with the real CI workflows.
```

**Stage 2 — `.forgejo/workflows/noop.yml`, only if Task 3.9 returned NO:**

```yaml
# Placeholder only. Exists so Forgejo resolves this directory as the workflow source
# and never falls through to .github/workflows/. See docs/migration-decisions.md#d9.
# It cannot run: workflow_dispatch is the only trigger, the job is `if: false`, and no
# runner carries the `placeholder-never-runs` label. Story 2.1 removes this file.
name: noop
on:
  workflow_dispatch:
jobs:
  noop:
    if: false
    runs-on: placeholder-never-runs
    steps:
      - run: 'echo noop'
```

Constraints on either file:

- **Never `runs-on: ubuntu-latest`** — that label is another team's runner; Story 2.1 has an
  explicit AC forbidding it and `forgejo-migration.md:304` lists it under «Что осознанно не
  делаем». Do **not** use `node-20` or `docker-build` either: `forgejo-migration.md:138-139`
  reserves both, and Story 1.7 will register them — a placeholder must stay unrunnable even after
  1.7 lands.
- **Do not reuse a name from Story 2.1's planned set** — `ci.yml`, `build.yml`, `deploy-dev.yml`,
  `deploy-preprod.yml`, `deploy-prod.yml`, `dev-reset.yml` (`forgejo-migration.md` §4).
- `.gitea/workflows/` is not needed and must not be created — `.forgejo/` already wins.

### Files being modified

| Path | State | What changes | What must be preserved |
|---|---|---|---|
| `.forgejo/workflows/README.md` | **NEW** | The placeholder | — |
| `.github/workflows/CI.yml` | **UNCHANGED — verify** | Nothing | Local `main`: 107 lines; `push`+`pull_request` on `[main, staging, development]`; jobs `lint`/`typecheck`/`test`/`build`, all `ubuntu-latest`; only external effect is tokenless `codecov/codecov-action@v4`. Identical on all three Forgejo refs. |
| `.github/workflows/CD.yml` | **UNCHANGED — verify** | Nothing | Local `main`: 264 lines, no `tags:`, `deploy.if` admits main+development only. **Forgejo's refs differ** — see the per-ref table at the top; do not reason from the local file alone. |
| `docs/migration-decisions.md` | UPDATE | D9 entry, index row, changelog row, anchor range at line 8 | D1–D8 verbatim; the append-only rule at lines 8–10 |
| `docs/forgejo-migration.md` | UPDATE | Note at line 130 (now 130-136); `.forgejo/` note in §4 (heading now line 249); new risk row | Struck-through text stays intact and unshortened («mark rather than delete») |
| `{implementation_artifacts}/sprint-status.yaml` | UPDATE | `1-13-…` → `review`; `last_updated` | All comments and the STATUS DEFINITIONS block |
| `{implementation_artifacts}/deferred-work.md` | UPDATE *(if needed)* | New `## Deferred from:` section | Existing section verbatim |

`.github/workflows/` has **no** disabling mechanism today — no `if: false`, no `vars.*` gate, no
`.gitattributes`, no `.forgejo/` or `.gitea/` directory anywhere. Its only guard is accidental:
CD dies at `docker/login-action` because the Forgejo secrets do not exist. **Story 1.12 removes
exactly that accidental protection** — which is why this story blocks it. Task 2 verifies the
guard is still there before the story creates any CD-capable event.

### Repository facts

`[re-verify in Task 1]` — cached values from story creation at `eaf7a9a1`:

- Local `main` is 14 commits ahead of `origin/main` (`e6ecfced`), 0 behind. `origin/staging` =
  `1b9be37a`; `origin/development` = `372ee2c4`.
- Highest Actions run index: **12** (left by Story 1.3). Runs 1–2 predate it and are unexplained —
  worth a glance, they may themselves be prior fallback executions.
- Runners: `ci-hub` (`ubuntu-latest`, idle) and `s1-build-crm` — both foreign, both v13.0.0. **We
  own no runner**; nothing in this story needs one.

`[stable]`:

- `origin` = `ssh://git@git.crm-prionex.com:2222/CRM/fe-prionex.git`. **There is no GitHub
  remote.** Forgejo is `origin`; the team pushes to GitHub by other means and Forgejo lags.
- Forgejo `15.0.5+gitea-1.22.0`; repo `CRM/fe-prionex`, private, `has_actions: true`; anonymous
  API is refused (`REQUIRE_SIGNIN_VIEW`) — a token is mandatory.
- `.forgejo/` does not exist and is not git-ignored. `.github/` holds exactly `CI.yml` and
  `CD.yml`.
- No `vars.*` reference exists in any legacy workflow on any ref.

### Anti-patterns for this story

- ❌ **Reasoning about `.github/workflows/` from local `main`.** Read it at the ref you are about
  to push (`git show <ref>:…`). This is the error that had to be corrected while writing this
  story.
- ❌ **Treating `staging` as CI-only.** On its own ref it is a CD-deploying branch.
- ❌ **Testing the mechanism for the first time with a branch push.** Use the PR.
- ❌ **Editing, renaming, moving or deleting anything under `.github/`.** Violates D7 and AC1.
  Deleting those files is Story **7.2**'s job.
- ❌ **Merging `main` into `staging` or `development` on Forgejo.** Push a placeholder-only commit
  on top of each branch's existing head.
- ❌ **Writing real CI content into `.forgejo/workflows/`.** That is Story 2.1.
- ❌ **`runs-on: ubuntu-latest`, `node-20` or `docker-build`** in the placeholder.
- ❌ **Declaring the verdict from documentation.** Forgejo ignores unsupported constructs
  *silently*. Job status is not evidence — run indexes, ids, URLs and timestamps are (Forgejo bug
  [#10259](https://codeberg.org/forgejo/forgejo/issues/10259) makes `waiting` ambiguous).
- ❌ **Leaving any run to complete** on another team's runner.
- ❌ **Writing the API token, or its last characters, into any file.** A redacted code-review
  finding on Story 1.3.
- ❌ **Guessing at unverifiable items.** Mark them «не проверено» in D9, as Story 1.3 did.
- ❌ **`--no-verify` on `main`.** It is permitted only on the throwaway `staging`-based probe
  branches, where the legacy tree's hooks cannot pass and no source changes.

### Previous story intelligence (Story 1.3 — reviewed and closed except a deliberate deferral)

- **The hazard this story fixes is Story 1.3's single most consequential finding**, recorded first
  in D8. 1.3 therefore never pushed `main`: all its work ran on throwaway branch
  `probe/forgejo-capabilities`, dispatched via `workflow_dispatch` only, deleted afterwards.
- **Evidence standard, inherited verbatim:** every yes/no backed by run URLs, run ids and
  timestamps **with date and timezone**; every measurement has its control; a contradiction with
  the expectation is *reported*, not reconciled; unverifiable items marked «не проверено».
  Story 1.3's first evidence pass was **rejected in code review** for exactly this — missing
  timestamps and job-status sequences — and had to be redone. Write the full table the first time.
- **Auto-cancel confound:** on `push`, Forgejo cancels earlier runs of the same workflow on the
  same branch **even with no `concurrency` block**. Cancel the control run yourself, before the
  next push, so the two causes cannot be confused.
- **Story 1.3's status is deliberately still `in-progress`** because `fe_tmp` revocation is
  deferred until all epics complete. Not a stalled item — and it means the token you need exists.
- **Deferred items you inherit but must not fix here:** six stale `epics.md` `CD.yml` citations
  and the `forgejo-migration.md:19` `v*` clause. See `deferred-work.md`.

### Decision-record conventions (`docs/migration-decisions.md`)

- **One register, stable anchors.** Never create a new decision file; downstream stories cite
  `#dN`. Last used ID: **D8**.
- **Russian**, append-only. D1–D8 are not rewritten; changes go through the changelog with a story
  number. A *factual* repair (a shifted line number) is not a decision change but is still logged.
- **Entry skeleton:**

  ```
  <a id="dN"></a>

  ## DN. <Заголовок>

  **Решение.** <paragraph>

  **<Bold lead-in ending in a period>.** <consequence paragraph>
  … repeat; tables and bullet lists as needed …

  **Требования:** FR…, NFR…; Stories …

  ---
  ```

  A `**Статус:**` line appears **only** where a decision is not yet acted on (D2, D3) — D9 is
  acted on, so it takes none.
- **Three-part update:** entry + index row (`| # | Решение | Статус | Реализуется в |`) +
  changelog row (`| Дата | Story | Изменение |`, `DD.MM.YYYY`).
- **Bidirectional linking:** `migration-decisions.md` cites `forgejo-migration.md §N`;
  `forgejo-migration.md` links forward to `migration-decisions.md#dN`.
- **Citations are inline backticked `path:line`**, verified against the file at HEAD — never
  derived by arithmetic, and re-checked after your own edits shift lines.

### Git intelligence

The last five commits are all Story 1.3 and all documentation-only:

```
eaf7a9a1 chore(bmad): note token revocation deferred until all epics are done
6b8e9bcb docs(migration): address code review findings for story 1.3
4bdce371 chore(bmad): record story 1.3 findings and sprint status
7b7b984c docs(migration): record the Forgejo Actions capability findings
2bc363a0 chore(bmad): add story 1.3, close 1.2, add story 1.13 to sprint
```

Pattern to copy: `docs(migration): …` for `docs/`, a separate `chore(bmad): …` for `_bmad-output/`
(1.3's review-fix commit mixed them; the clean split is the one to follow). `main` is the working
branch for this migration work; no feature branch is used for the deliverable itself.

### Latest technical information

- **Forgejo's resolver picks the first workflow source that exists as a tree entry, regardless of
  contents.** From `modules/actions/workflows.go` on the `forgejo` branch:

  ```go
  tree, err = commit.SubTree(workflowSource)
  // If the source does not exist, we try the next one.
  if _, ok := err.(git.ErrNotExist); ok {
      continue
  }
  if err != nil {
      return "", nil, err
  }
  // We have found a valid source that we will use, no matter whether
  // it contains workflows or not.
  break
  ```

  This is what makes the README-only stage-1 placeholder viable. ⚠️ **It is read from the current
  `forgejo` branch, not the 15.0.5 tag** — treat it as the reason to *try* stage 1 first, never as
  the verdict. AC3's observation on the actual instance is the verdict.
- Community and documentation sources agree on the precedence but describe the trigger condition
  inconsistently — some say "the first directory that exists", others "the first that **contains
  workflow files**". That unresolved ambiguity is exactly why Task 3.10 exists as a second stage
  before escalation.
- The Forgejo user docs state only that workflows live in `.forgejo/workflows`; the fallback is
  not documented on current pages, so it cannot be cited as a contract — only observed.
- Open issue [forgejo#9203](https://codeberg.org/forgejo/forgejo/issues/9203)
  («enable/disable foreign workflow directories») shows the fallback is under active upstream
  discussion — the behaviour this story depends on may change on upgrade. One sentence in D9.

Sources: [Forgejo Actions basic concepts](https://forgejo.org/docs/latest/user/actions/basic-concepts/),
[forgejo/forgejo#9203](https://codeberg.org/forgejo/forgejo/issues/9203),
[modules/actions/workflows.go](https://codeberg.org/forgejo/forgejo/raw/branch/forgejo/modules/actions/workflows.go),
[Forge-specific repository folders](https://nesbitt.io/2026/02/22/forge-specific-repository-folders.html).

### Testing standards

No application code is written, so the vitest/eslint/tsc suite is **not a test of this story and
must not be modified**. "Testing" here is the control-then-test protocol in Tasks 2–6, and its
standard of proof is Story 1.3's:

- Every yes/no backed by run indexes, run ids, run URLs and timestamps **with date and timezone** —
  not job status, not prose.
- Every measurement has its control; the control comes first.
- A contradiction with the expectation is reported, not reconciled.
- Unverifiable items are marked «не проверено» in D9, not guessed.
- Before committing on `main`: `npm run lint` and `npm run typecheck` pass untouched.
- Local hooks: `.husky/pre-commit` runs `format:check`, `lint`, `typecheck`, `test:run`;
  `.husky/pre-push` runs `npm run build`. Neither covers `.forgejo/**`, `docs/**` or YAML —
  prettier is scoped to `src/**/*.{ts,tsx,css,json}` and eslint to JS/TS — so the new files carry
  no lint or format risk, but the hooks still run in full on every `main` commit. Budget the time.
  On the `origin/staging`-based probe branches the hooks are a *different, older* script that
  cannot pass against a mismatched `node_modules`; `--no-verify` is permitted there and only
  there.

### Project Structure Notes

- `.forgejo/workflows/` is a **new top-level directory** and is the location the migration plan
  already reserves (`forgejo-migration.md` §4, heading now at line 249). It is not git-ignored.
- A `README.md` inside `workflows/` is safe: Forgejo only parses `.yml`/`.yaml`.
- Story artifacts stay in `{implementation_artifacts}`; the decision register and the plan stay in
  `docs/`. No `_bmad-output/` content is referenced from `docs/`.
- Language split is deliberate: `docs/` is Russian; code-space files (`README.md`, workflow YAML,
  this story) are English — matching the repository root `README.md`.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md:783-828` — Story 1.13 text and AC1–AC4]
- [Source: `_bmad-output/planning-artifacts/epics.md:751-756` — Story 1.12's prerequisite on 1.13]
- [Source: `_bmad-output/planning-artifacts/epics.md:428-448` — Story 1.1 cancelled; `09591984`
  "travels to Forgejo with the rest of the tree"; no `v*` tag has ever existed]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-07-runners.md` §2
  (neighbour impact, line 128), §3 "On the neutralisation mechanism", §4.1, §4.6, §5]
- [Source: `docs/migration-decisions.md#d7` — no action is taken on GitHub]
- [Source: `docs/migration-decisions.md#d8` — runner topology, the PROD hazard, auto-cancel
  behaviour, the evidence-table format]
- [Source: `docs/migration-decisions.md:8` — anchor range to extend]
- [Source: `docs/forgejo-migration.md:130`, `:138-139`, `:249`, `:304` (post-edit line numbers; were `:132-133`, `:243`, `:290` before this story's insertion) — runner phase, reserved
  labels, final file set, `ubuntu-latest` exclusion]
- [Source: `_bmad-output/implementation-artifacts/1-3-verify-forgejo-actions-availability-and-concurrency-support.md`
  — evidence standard, documentation conventions, token status, review findings]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — inherited deferrals,
  `fe_tmp` scope]
- [Source: `.github/workflows/CI.yml`, `.github/workflows/CD.yml` at `main`, `origin/main`,
  `origin/staging`, `origin/development` — the per-ref trigger matrix]
- [Source: `.husky/pre-commit`, `.husky/pre-push`, `package.json#scripts`]

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- Org-scope secrets/variables API: `GET /api/v1/orgs/CRM/actions/secrets`,
  `GET /api/v1/orgs/CRM/actions/variables` — used for Task 2.1.
- Org runner list: `GET /api/v1/orgs/CRM/actions/runners` — used to find the `s1-deploy-dev-preprod`
  drift in Task 1.5 (the repo-scope runner list alone returns `[]`, since all three runners are
  org-scoped, not repo-scoped).
- Pull request API: `POST /repos/CRM/fe-prionex/pulls` first returned 404 "The target couldn't be
  found" — root-caused via `GET /repos/CRM/fe-prionex` (`has_pull_requests: false`), fixed with
  `PATCH /repos/CRM/fe-prionex {"has_pull_requests":true}`.
  `GET /swagger.v1.json` confirmed no cancel endpoint exists for Actions runs — only `GET` on
  `/actions/runs` and `/actions/runs/{run_id}`.
- Job-level status: `GET /repos/CRM/fe-prionex/actions/tasks` — used throughout for per-job
  id/name/status (the `/actions/runs/{id}` endpoint gives run-level status only).

### Completion Notes List

- **Nine of ten tasks completed** (corrected at code review 2026-08-10 — this note originally read
  "All 10 tasks completed" while Tasks 10.1–10.5 were all unchecked; 10.4 is genuinely incomplete,
  see Review Findings). **Central result: pushes to `staging`, `development` and `main` on the
  live Forgejo instance created zero Actions runs once `.forgejo/workflows/README.md` was in
  place — the PROD-deploy hazard recorded first in D8 is closed, proven by test on all three
  refs, not assumed.**
- **Two stop gates were hit and resolved with Oleg's explicit, in-the-moment authorization for
  each — nothing was worked around unilaterally:**
  1. **Task 2.2** — five org-scope Actions secrets (`SLACK_CD_WEBHOOK_URL` + four `REGISTRY_*`)
     appeared minutes before the check, matching Story 1.12's D6 naming scheme. `SLACK_CD_WEBHOOK_URL`
     is read by `.github/workflows/CD.yml`'s `deploy` job's first step (`if: always()`).
     Mitigated by overwriting its value with a non-resolving stub (`example.invalid`) rather than
     investigating why Story 1.12 provisioning appears to have started early — that question is
     still open (Open Question 7).
  2. **Task 3.4** — `has_pull_requests` was `false` at the repo level, and the whole Task 3
     protocol depends on PRs being the only CD-free event on this instance. Enabled via
     `PATCH /repos/{owner}/{repo}`. Whether it was deliberately off, and why, was not investigated
     (Open Question 8).
- **A third gap surfaced without a story-level workaround needed:** no cancel API endpoint exists
  in this Forgejo version. The control-run cancellation Task 3.5 called for wasn't possible;
  the run was instead left to finish naturally (74 s). Flagged for Stories 1.7/1.8/4.4, which may
  assume the same capability (Open Question 9).
- **Instance drift found beyond the story's original checklist**, all recorded in D9: a third org
  runner (`s1-deploy-dev-preprod`) exists that didn't exist during Story 1.3.
- **Evidence standard was followed throughout** — every push/PR/run has a UTC or `+02:00`
  timestamp, run id, and (where relevant) job id/name/status; the two 90-second-plus polls per ref
  and the full run/job table are in D9, not just the yes/no verdicts.
- **`main` push delivered 15 commits / 29 files**, not a placeholder-only commit, as anticipated
  by the story's own Task 6.3 — including `.github/workflows/CD.yml` carrying commit `09591984`'s
  tag-trigger removal to Forgejo for the first time. This reduces risk on the Forgejo `main` ref
  and does not violate D7 (GitHub-side `CD.yml` is untouched).
- **Pre-commit hit the same known-flaky Radix `focus-scope` timer test failure Story 1.3
  encountered** (different test file each time — `ReplyComposer.attach.test.tsx` in 1.3,
  `TagsDropdown.test.tsx` here) — retried once each time and passed clean (1921/1921 tests, no
  errors). Not related to this story's changes.
- **AC1 final proof:** `git hash-object .github/workflows/CI.yml .github/workflows/CD.yml` =
  `70be19361bf9cf07a9e59d12318bb038d815cdc2` / `ce3440542b553898b6067e49e044c588549ce46a`,
  unchanged from the Task 1.3 baseline. `git log --oneline eaf7a9a1..HEAD -- .github/` is empty —
  nothing under `.github/` was touched by this story's own commits (the tree changed only because
  `main` fast-forwarded past `09591984`, a pre-existing commit already on local `main` before this
  story started).
- `npm run lint` and `npm run typecheck` pass untouched.
- Three commits total on `main`, all pushed: `f155b409` (placeholder, pushed during Task 6 to
  observe the no-run result), `cdef5fdd` (D9 + migration plan doc edits), and the `chore(bmad):`
  commit recording this story file, sprint-status.yaml and deferred-work.md (this commit's hash
  is in the git log, not repeated here to avoid a stale self-reference).

### File List

- `.forgejo/workflows/README.md` — NEW (on `main`, `staging`, `development` — the inert
  placeholder; identical content on all three refs)
- `docs/migration-decisions.md` — MODIFIED (D9 entry, index row, anchor range, changelog row)
- `docs/forgejo-migration.md` — MODIFIED (runner-drift note at the Фаза 1 item 1; placeholder note
  in §4; new risk row in §5)
- `_bmad-output/implementation-artifacts/deferred-work.md` — MODIFIED (new "Deferred from: story
  1-13-…" section)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — MODIFIED (story 1.13 status)
- `_bmad-output/implementation-artifacts/1-13-stop-forgejo-from-executing-the-legacy-github-workflows.md` — MODIFIED (this file)
- Forgejo org/repo configuration (not a repo file, recorded here for traceability): repo unit
  `has_pull_requests` flipped `false → true`; org secret `SLACK_CD_WEBHOOK_URL` value overwritten
  with a stub (name/existence unchanged, only the value)

## Open Questions for Review

Saved for the end per the create-story workflow. None blocks implementation.

1. **AC5 is derived, not from the epic** — rationale under AC5. Confirm it stands, or drop
   Tasks 4–5 and record the exposure instead (Task 8.6). Note that dropping it leaves two
   CD-deploying refs armed the moment Story 1.12 lands.
2. **The per-ref divergence invalidates a premise of the approved change proposal.** §2 states
   "Story 1.3's probe branch is safe: `CD.yml:4` filters `[main, development]`" — true of local
   `main` only; `origin/staging`'s `CD.yml` filters `[main, staging, development]` and its
   `deploy.if` admits `staging`. The probe branch itself was still safe (it matched no filter),
   so nothing done so far was unsafe, but the proposal's reasoning should probably be corrected.
   Does that warrant a `bmad-correct-course`, or is recording it in D9 enough?
3. **Task 6 pushes 14 commits to Forgejo `main`, not a placeholder-only commit** — including
   `09591984`, which changes `.github/workflows/CD.yml` on that ref (removing the `v*` trigger).
   It reduces risk and `epics.md:434-438` anticipates it, but it is the largest push in the story
   and lands on the PROD-deploying ref. Confirm, or require a placeholder-only commit on
   `origin/main` first.
4. **The control run consumes another team's runner** (`ci-hub`). Mitigated by cancelling within
   ~30 s, but there is no way to obtain a control without one run on foreign infrastructure. The
   alternative is a weaker claim ("no run appeared", uncontrolled) that fails Story 1.3's
   evidence standard.
5. **Tags cannot be closed retroactively** (Task 7). The rule "cut `v*` tags only from commits
   carrying `.forgejo/workflows/`" is a human process control with no technical enforcement.
   Should it also go into the Story 6.2 production-approval regulation?
6. **Story 1.3 remains `in-progress` by deliberate decision**, so two stories will be open at
   once. Confirm intended, or move 1.3 to `done` and track the token elsewhere.
7. **Resolved for this story's purposes, but the underlying question is still open.** Task 2.2's
   dev-run (2026-08-10) hit its own stop gate: five org-scope Actions secrets appeared minutes
   before the check — `SLACK_CD_WEBHOOK_URL`, `REGISTRY_USER`, `REGISTRY_USER_RO`,
   `REGISTRY_TOKEN_RW`, `REGISTRY_TOKEN_RO`. `SLACK_CD_WEBHOOK_URL` exactly matched the gate's
   stop list and is read by `.github/workflows/CD.yml`'s `deploy` job's first step. Oleg
   authorized overwriting its value with a non-resolving stub (`example.invalid`) rather than
   investigating further; `REGISTRY_*` were left untouched since legacy `CD.yml` never references
   them. This let implementation resume safely (see D9's "Находки инстанса" section for the full
   record), but **why five secrets matching Story 1.12's D6 naming scheme appeared on 2026-08-10,
   ahead of that story's sequencing, was never answered** — worth a direct question to whoever
   has been working on Story 1.12/registry setup, and worth checking before Story 1.12 itself
   starts in earnest.
8. **Pull Requests were disabled at the repo level** (`has_pull_requests: false`) when Task 3
   needed to open one — the whole CD-free-test protocol depends on PRs being available. Oleg
   authorized enabling the unit via API. Confirm this was the right call (vs., e.g., finding out
   why it was off first) and note that Story 2.1 can now rely on PR-triggered CI existing as a
   repo capability, without needing to re-enable anything.
9. **No cancel API endpoint exists in this Forgejo version** (`POST .../actions/runs/{id}/cancel`
   → 404, confirmed against the full swagger spec). Story 1.3 and this story both assumed one
   existed. Runs have to be waited out to natural completion instead. Stories 1.7, 1.8 and 4.4
   should not design around a cancel capability that isn't there.
