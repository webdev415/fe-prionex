---
baseline_commit: e6ecfced2b3c3ec237e50e7f3d690ba38b73c2c1
---

# Story 1.1: Close the Tag-Based Production Gate Bypass in the Current GitHub CD

Status: cancelled

> **Cancelled 2026-08-07** — superseded by the decision that no action is ever taken on
> GitHub. `.github/workflows/CD.yml` takes effect only there, so no repository-side change can
> close this defect. Closed instead by Story 6.1 (ending delivery to GitHub). The fix is kept
> in commit `09591984` — correct, inert, and carried to Forgejo with the rest of the tree.
> AC2 was satisfied and verified; AC1 and AC3 were not and cannot be. Everything below is
> preserved as the investigation record.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a release engineer,
I want pushing a `v*` tag to stop silently deploying to production without the required reviewers,
so that the production approval gate cannot be circumvented during the weeks the legacy pipeline is still live.

## Acceptance Criteria

> **Approach deviates from `epics.md` — decided 2026-08-07.** The epic's ACs assume the bypass is closed by
> repairing the `environment` expression and configuring required reviewers on the `production` environment.
> Evidence gathered during story preparation changed the decision: **zero `v*` tags have ever existed in this
> repository**, and the GitHub pipeline is being retired (Story 6.1, Epic 7). Removing the tag trigger closes the
> bypass completely at a fraction of the risk — no environment reconfiguration, no approval gate added to the
> daily `main` release path, and a verification step with no side effects. The ACs below replace the epic's.
> `epics.md` Story 1.1 should be updated to match.

**AC1 — a `v*` tag can no longer reach the deploy job**

**Given** `.github/workflows/CD.yml`
**When** a `v*` tag is pushed
**Then** no `CD` workflow run is created at all
**And** the deploy job's `if:` condition no longer admits `refs/tags/v*`.

**AC2 — `set-env` and `environment` cannot disagree on any reachable ref**

**Given** the `set-env` step and the `environment` expression on the deploy job
**When** the workflow runs for any ref that can still trigger it (`main`, `development`, or `workflow_dispatch`)
**Then** `DEPLOY_ENV` and the `environment` name resolve to the same target
**And** no branch of the `if/elif/else` can produce a mismatch between them.

**AC3 — observed and recorded**

**Given** the fix has been applied
**When** a test `v*` tag is pushed
**Then** no workflow run appears
**And** the observed behaviour is recorded in the migration notes.

## Tasks / Subtasks

- [x] **Task 0 — Establish how the change reaches GitHub** (prerequisite for AC1/AC3)
  - [x] `git remote -v` — `origin` is **Forgejo** (`ssh://git@git.crm-prionex.com:2222/CRM/fe-prionex.git`). GitHub Actions only run on `github.com/CRM-Prionex/fe-prionex`, which is **not** a configured local remote.
  - [x] A sync path exists in practice — GitHub `main`, local `main`, and `origin/main` are all at `e6ecfced`, and GitHub CD ran on `development` on 2026-08-07. Establish *which* mechanism does this before pushing.
  - [ ] If no mirror is found, add the remote explicitly: `git remote add github git@github.com:CRM-Prionex/fe-prionex.git`.
  - [x] Do not proceed on assumption — AC1 and AC3 are only observable on GitHub.

- [x] **Task 1 — Remove the `v*` tag trigger** (AC: 1)
  - [x] `.github/workflows/CD.yml:4-7`, delete the `tags:` key:
    ```yaml
    on:
      push:
        branches: [main, development]
    ```
  - [x] `.github/workflows/CD.yml:122`, drop the tag clause from the deploy job condition:
    ```yaml
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/development'
    ```
  - [x] Leave `workflow_dispatch` and its `environment` input untouched — that is the intended manual production path and it is already gated by an explicit choice.
  - [x] Confirm no tag trigger survives anywhere: `grep -rn "tags:" .github/workflows/`. `CI.yml` has never had one (`on.push.branches: [main, staging, development]`), so after this edit a `v*` push triggers nothing in the repository.

- [x] **Task 2 — Align the `environment` expression with `set-env`** (AC: 2)
  - [x] `.github/workflows/CD.yml:123-124`:
    ```yaml
    environment:
      name: ${{ github.event.inputs.environment || (github.ref == 'refs/heads/development' && 'dev' || 'production') }}
    ```
  - [x] `.github/workflows/CD.yml:134` — the Slack "Deployment Started" payload carries a verbatim copy of the same expression. Apply the identical replacement, or the notification will disagree with the job it announces.
  - [x] `.github/workflows/CD.yml:142-151` — collapse `set-env` to the same three branches with the same single discriminator:
    ```bash
    if [ -n "${{ github.event.inputs.environment }}" ]; then
      DEPLOY_ENV="${{ github.event.inputs.environment }}"
    elif [ "${{ github.ref }}" == "refs/heads/development" ]; then
      DEPLOY_ENV="dev"
    else
      DEPLOY_ENV="production"
    fi
    ```
  - [x] **This changes behaviour for no reachable ref** — after Task 1 the only pushes that reach the job are `main` and `development`, and both resolve exactly as they do today. It is defensive: it deletes the latent mismatch so that re-adding a trigger later cannot silently reintroduce the bypass. Verify this claim rather than trusting it — walk `main`, `development`, and both dispatch inputs through old and new expressions and confirm identical results.
  - [x] Fail-safe direction matters: the default must be `production` (the environment that would be gated) on **both** sides, never `dev`.

- [ ] **Task 3 — Land the change** (AC: 1) — **BLOCKED: GitHub is out of bounds (decision 2026-08-07)**
  - [x] Commit. `.husky/pre-commit` runs the full CI-parity suite (`format:check`, `lint`, `typecheck`, `test:run`) on **every** commit, including YAML-only ones — expect several minutes. Do not bypass with `--no-verify`.
  - [ ] Push so the change reaches GitHub `main` (per Task 0).
  - [ ] Landing on `main` triggers a normal CD run that deploys current `main` to production, exactly as any merge does today. This story adds no approval gate, so it will not pause. Confirm with the team that a `main` deploy is acceptable at that moment, or land it together with a planned release.

- [ ] **Task 4 — Verify** (AC: 1, 3) — **BLOCKED: observable only on GitHub**
  - [ ] Push a test tag matching `v*`, e.g. `v0.0.0-gate-test`, to the remote that reaches GitHub.
  - [ ] Expect **no workflow run to be created**. Confirm: `gh run list --repo CRM-Prionex/fe-prionex --limit 10` shows nothing new, and `gh api "repos/CRM-Prionex/fe-prionex/actions/runs?event=push" --jq '.workflow_runs[0] | {head_branch, created_at}'` still points at the previous run.
  - [ ] This test has no side effects — no image is built and nothing touches a server. That is the point of the chosen approach.
  - [ ] Delete the test tag from every remote it reached and locally.

- [x] **Task 5 — Record the observed behaviour** (AC: 3) — recorded; the Task 4 observation is replaced by an explicit statement of why it was not performed
  - [x] Append to `docs/forgejo-migration.md` §0.1 ("Побочная находка: баг в текущем GitHub CD"): the bypass mechanism, that the trigger was removed rather than the expression repaired, why (no tags ever existed; pipeline being retired), the expression alignment applied as hardening, and the observed result from Task 4.
  - [x] **Write this in Russian** — that document is entirely in Russian.
  - [x] `docs/forgejo-migration.md` is currently untracked. Commit it as part of this story.

## Dev Notes

### The defect, precisely

Two independent expressions decide where a deploy goes, and they disagreed on the tag path:

| Location | Expression | Result for `refs/tags/v1.2.3` |
|---|---|---|
| `CD.yml:124` — `environment.name` | `inputs.environment \|\| (ref == 'refs/heads/main' && 'production' \|\| 'dev')` | **`dev`** — the `dev` environment's protection rules apply |
| `CD.yml:150` — `set-env` `else` | `DEPLOY_ENV="production"` | **`production`** — PROD SSH host/user/key |

`environment.name` selects which GitHub environment's protection rules apply. `DEPLOY_ENV` selects which secrets the deploy steps use (`CD.yml:158-160`, `171-173`, `216-218`). So a tag push was reviewed as `dev` and executed against `production`.

### Why the trigger is removed rather than the expression repaired

Both close the bypass. The trigger removal was chosen on evidence gathered 2026-08-07:

- **No `v*` tag has ever existed** — `git tag` is empty locally and `repos/CRM-Prionex/fe-prionex/tags` returns `[]`. Nobody uses the tag release path, so removing it costs nothing.
- **The `production` environment has zero protection rules** (`protection_rules: []`, `can_admins_bypass: true`). Repairing only the expression would have changed nothing observable; it would additionally have required configuring required reviewers, which then applies to **every** `main` merge — a new approval step on the daily release path, for a path nobody uses.
- **Verification is free.** Under the trigger removal, the AC3 test is "push a tag, observe nothing happens". Under the expression repair it would have been "push a tag, let a real ghcr image build, watch the job hold, reject it, then clean up the tag and the image".
- **The GitHub pipeline is being retired anyway** — Story 6.1 disables this deploy job, Epic 7 removes `.github/workflows/` entirely.

### What actually happened on the tag path, and why it still mattered

The tag path never completed a deploy. At `CD.yml:191`:

```bash
BRANCH_NAME=$(echo "$GITHUB_REF" | sed 's/refs\/heads\///')
```

For `refs/tags/v1.2.3` the `sed` does not match, so `BRANCH_NAME` stayed `refs/tags/v1.2.3`, `docker pull …:refs/tags/v1.2.3` failed (invalid tag — and the image was pushed as `1.2.3` by `type=semver` at `CD.yml:99`), and the fail-fast `exit 1` at `CD.yml:197` fired **before** `docker compose down`.

That did not make the bug theoretical. The **scp step at `CD.yml:155-163` runs first** and would have overwritten `~/crm-prionex/fe-prionex/docker-compose.server.yml` on the **production** server — an unapproved write to PROD. And the failure was incidental, not a safeguard: any change to the tag-name handling would have turned it into a full unapproved production deploy.

Include this in the Task 5 write-up. It is the reason this was fixed now rather than deferred to decommissioning.

### Scope boundary

The `BRANCH_NAME`/tag mismatch above is a real defect and is **explicitly out of scope** — the tag path is being removed, so making it work is work that gets deleted.

Also out of scope, do not do opportunistically:

- Configuring required reviewers or any other protection on the `production` environment. That was the rejected alternative; adding it anyway reintroduces the cost the decision was made to avoid.
- Removing the now-dead `type=semver` tag lines at `CD.yml:99-100`. `docker/metadata-action` simply emits nothing for them when no tag is present. Leaving them is lower-risk than editing the build job, and Epic 3 replaces this whole job.
- Branch protection on GitHub `main` (currently unprotected — `FR4` is Forgejo-side, Epic 2).
- The silent URL fallbacks at `CD.yml:49,59` (NFR8 — Epic 3).
- `CI.yml`, `Dockerfile.prod`, `docker-compose.server.yml`, `nginx.conf`, or anything under `.forgejo/`.

### Known latent issue, not part of this story

`set-api-url` (`CD.yml:42-79`) branches on `github.ref` and defaults to **production** URLs. On `workflow_dispatch` from a feature branch with `environment: dev`, the build bakes PROD URLs while the deploy targets DEV. Pre-existing, unrelated to the tag gate, and superseded by Epic 3's per-environment build. Do not fix it here — note it in the migration document if convenient.

### Files being modified

**`.github/workflows/CD.yml`** — UPDATE, the only code file this story touches.

Current structure worth preserving:

- Job `build-and-push` — unchanged by this story.
- Job `deploy` — `needs: build-and-push`.
- Secrets are **repo-level**, selected inline by `DEPLOY_ENV`; they are *not* environment secrets. So `environment.name` controls the approval gate only, and since `production` has no protection rules it currently controls nothing.
- Fail-fast `docker pull` with no `:latest` fallback (`CD.yml:188-198`) — deliberate, must not be weakened.
- The `set-env` output feeds five later steps. Task 2 changes only *which condition* selects `dev`; the emitted vocabulary (`production` | `dev`) stays identical.
- `concurrency: cd-${{ github.ref }}` with `cancel-in-progress: false` — leave alone.

**`docs/forgejo-migration.md`** — UPDATE, §0.1 only. Russian. Currently untracked.

### Repository state as observed (2026-08-07)

```
GitHub main HEAD        e6ecfced (2026-08-05)   == local main == origin/main (Forgejo)
GitHub Actions          live — CD push→development succeeded 2026-08-07 12:52
Tags (GitHub + local)   none, zero, never
Environments            production / dev / staging — all protection_rules: []
Branch protection main  none
Repo                    private; org CRM-Prionex on Team plan
gh CLI                  authenticated as OlegKuksa, repo scope, admin: true
```

`staging` exists as an environment but is not referenced by `CD.yml`.

### GitHub expression semantics relied on

For `push` events `github.event.inputs` is null, so `github.event.inputs.environment` is falsy and the right-hand side of `||` is evaluated. For `workflow_dispatch` it is `'production'` or `'dev'` and short-circuits. The existing file uses `github.event.inputs.*` rather than the newer `inputs.*`; keep that form for consistency within the file.

### Testing standards

No automated test covers this. `.github/workflows/CD.yml` sits outside every configured check: `npm run lint` is ESLint over the source tree, and `format:check` is `prettier --check "src/**/*.{ts,tsx,css,json}"` — neither touches `.github/`. There is no `.prettierignore` and no `lint-staged` config.

Verification is therefore **observational**, via Task 4, and the recorded result in Task 5 is the evidence. Optionally lint the YAML locally with `actionlint` before committing (not installed in the repo; `brew install actionlint`).

### Project Structure Notes

- Workflow lives at `.github/workflows/CD.yml`; the Forgejo replacements land under `.forgejo/workflows/` in Epics 2-6. Do not create `.forgejo/` in this story.
- `docs/` is the project knowledge root (`project_knowledge` in `_bmad/bmm/config.yaml`); `docs/forgejo-migration.md` serves as both PRD and Architecture for this migration effort.
- No `architecture.md`, `prd.md`, or UX artifact exists in `_bmad-output/planning-artifacts/` — `epics.md` and `docs/forgejo-migration.md` are the complete contract. UX is explicitly not applicable (infrastructure story).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1] — original user story and superseded acceptance criteria
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1: Forgejo Delivery Foundation] — "That bug is exploitable for the entire duration of the migration, not only after it, so it is fixed here rather than deferred to decommissioning."
- [Source: _bmad-output/planning-artifacts/epics.md#Additional Requirements] — "pushing a `v*` tag evaluates `environment: dev` at `CD.yml:124` while `set-env` resolves `DEPLOY_ENV=production` at `CD.yml:150`"
- [Source: _bmad-output/planning-artifacts/epics.md#NonFunctional Requirements] — NFR5: existing DEV and PROD stands remain fully operational and untouched
- [Source: docs/forgejo-migration.md#0.1] — the original finding, and the section to update in Task 5
- [Source: .github/workflows/CD.yml:1-8] — triggers, including the `v*` tag trigger being removed
- [Source: .github/workflows/CD.yml:118-153] — deploy job `if:`, `environment` expression, and `set-env` step
- [Source: .github/workflows/CI.yml:3-7] — no tag trigger, so tag pushes trigger nothing after this change
- [Source: .husky/pre-commit] — full CI-parity suite on every commit

## Dev Agent Record

### Agent Model Used

claude-opus-5[1m]

### Debug Log References

- Expression equivalence check (Task 2): all reachable refs — `push main`, `push development`, `dispatch production`, `dispatch dev`, `dispatch dev from feature`, `dispatch production from feature` — produce identical results under the old and new expressions, and `environment` == `DEPLOY_ENV` in every case. The removed tag path was the only divergence: `env=dev` vs `DEPLOY_ENV=production`.
- YAML parse after edit: valid; triggers reduced to `push: {branches: [main, development]}` + `workflow_dispatch`.
- `grep -rn "refs/tags" .github/workflows/` → no matches. The two remaining `tags:` hits (`CD.yml:94`, `CD.yml:108`) are `docker/metadata-action` image tags, deliberately left per the scope boundary.
- `actionlint` not installed on this machine; the optional lint step was skipped.

### Completion Notes List

**Delivered**

- Task 0 — delivery path established. There is **no** Forgejo↔GitHub mirror. `main` matches (`e6ecfced`) but `development` diverges: Forgejo `372ee2c4` vs GitHub `405db726` (pushed 2026-08-07 12:52, which triggered CD). Pushes go to GitHub; the Forgejo copy lags. Local `origin` points at Forgejo and no GitHub remote is configured.
- Task 1 — `v*` trigger removed from `on.push`, tag clause removed from the deploy job `if:`.
- Task 2 — `environment` expression, its Slack-payload copy, and `set-env` collapsed onto a single discriminator. Verified to change behaviour for no reachable ref.
- Task 5 — finding, resolution and residual risk recorded in `docs/forgejo-migration.md` §0.1, in Russian, and committed.

**Not delivered — AC1 and AC3 are NOT satisfied**

The user decided on 2026-08-07 that GitHub is never to be touched. `.github/workflows/CD.yml` takes effect **only** on GitHub, so the committed fix is inert with respect to the live pipeline:

- **Task 3 (land the change) — blocked.** Not pushed to GitHub; no remote added, no branch pushed, no PR opened.
- **Task 4 (verify) — blocked.** "A `v*` push creates no workflow run" is observable only on GitHub.
- **The bypass remains open on the live GitHub CD** for as long as CD can be triggered there. Evidence that it is live: CD deployed `development` on 2026-08-07 and `main` (production) on 2026-08-05.

AC2 is satisfied and was verified statically. AC1 and AC3 are not. The story is therefore **not** ready for review — it is blocked pending a decision on how, or whether, the fix reaches GitHub.

**Correction to Dev Notes**

Dev Notes state that `.husky/pre-commit` runs the full CI-parity suite on every commit. That is true for a developer with dependencies installed, but **not in this clone**: `node_modules` is absent, `core.hooksPath` is unset and `.git/hooks/pre-commit` does not exist, so no hook ran for either commit. Immaterial to correctness here — the change is a YAML file outside every configured check (`lint` is ESLint over `src`, `format:check` is prettier over `src/**`), so the hook would have validated nothing about it.

### File List

- `.github/workflows/CD.yml` — modified
- `docs/forgejo-migration.md` — added to version control (was untracked) and extended with §0.1 findings

Not committed, left untracked: `_bmad/`, `_bmad-output/` — BMAD tooling and artifacts; whether they belong in version control is a repository-hygiene decision for the team.

### Change Log

| Date | Change |
|---|---|
| 2026-08-07 | `09591984` — removed the `v*` CD trigger and aligned the environment/`set-env` expressions |
| 2026-08-07 | `11797882` — recorded the finding, the resolution and the residual risk in `docs/forgejo-migration.md` §0.1 |
