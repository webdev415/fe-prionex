# Sprint Change Proposal — 2026-08-07

**Project:** fe-prionex — Forgejo CI/CD migration
**Raised by:** Oleg
**Trigger story:** 1.1 — Close the Tag-Based Production Gate Bypass in the Current GitHub CD
**Scope classification:** **Major** — removes a capability the plan was built around
**Status:** **Approved by Oleg, 2026-08-07.** Applied to `epics.md` and `sprint-status.yaml`.

---

## 1. Issue Summary

Story 1.1 set out to close a live defect in the legacy GitHub CD: pushing a `v*` tag resolved
`environment` to `dev` (`CD.yml:124`) while `set-env` resolved `DEPLOY_ENV=production`
(`CD.yml:150`), so a tag deployed to production under the `dev` approval gate.

The fix was implemented and verified statically (commit `09591984`). Landing it required
pushing to GitHub. At that point the decision was taken that **no action of any kind is ever
performed on GitHub** — not on workflows, settings, secrets, credentials, nor its container
registry, and not even a read. GitHub is left running exactly as it is; moving delivery and
content across to Forgejo is owned by Oleg and tracked outside this plan.

`.github/workflows/CD.yml` takes effect only on GitHub. A change that cannot be delivered
there cannot close the defect there. The blocker on one story turned out to be a question
about the plan: roughly ten of its 53 stories were built on acting against GitHub.

### Evidence gathered

| Finding | Evidence |
|---|---|
| GitHub CD is live and deploying | `CD push→development` succeeded 2026-08-07 12:52; production deployed 2026-08-05 |
| No mirror in either direction | `main` matched at `e6ecfced`; `development` diverged — Forgejo `372ee2c4`, GitHub `405db726`; `mirror_url: null`, not a fork |
| Forgejo lags and the gap widens | The team pushes to GitHub; local `origin` points at Forgejo with no GitHub remote configured |
| The "bypassed gate" was nominal | `production` environment has `protection_rules: []` and `can_admins_bypass: true` — no reviewers were ever configured |
| The tag path never completed a deploy | `CD.yml:191` leaves `BRANCH_NAME=refs/tags/v…`, so `docker pull` fails and `exit 1` fires before `docker compose down` — but **after** scp has written `docker-compose.server.yml` to the production server |
| No `v*` tag has ever existed | `git tag` empty locally; GitHub `/tags` returns `[]` |

## 2. Impact Analysis

### Epic impact

| Epic | Impact |
|---|---|
| Epic 1 — Forgejo Delivery Foundation | 3 of 12 stories cancelled (1.1, 1.4, 1.5). Foundation work on Forgejo is unaffected. |
| Epics 2-5 | No impact. All Forgejo-side. |
| Epic 6 — Production Release and Verified Rollback | Story 6.1 cancelled; 6.3 redefined. Epic now carries **no external safety net**. |
| Epic 7 — renamed to *Forgejo as the Single Source of Delivery* | 2 of 5 stories cancelled (7.1, 7.4), 1 reduced (7.2). The epic no longer decommissions anything. |

### Story impact

**Cancelled (6):**

- **1.1** — the fix is inert on GitHub. Kept in the repository; the bypass stays open there.
- **1.4** — synchronization model no longer needed; its answer is preserved inside the cancellation and in the Overview.
- **1.5** — nothing to regulate; the legacy DEV stand simply keeps running as it does.
- **6.1** — disabling the deploy job is an action on GitHub.
- **7.1** — its premise (GitHub in CI-only mode via 6.1) is gone.
- **7.4** — deleting Secrets and revoking ghcr tokens are actions on GitHub.

**Redefined (2):**

- **7.2** — *Retire the GitHub Workflows* → *Delete the Legacy Workflow Files*. The files stay in place as the reference for porting and are deleted once the Forgejo workflows are proven. No GitHub settings action.
- **6.3** — *Import the Running Production Image* → *Rebuild the Running Production Commit*. `ghcr.io` is unreachable under this decision, so the production commit is rebuilt rather than pulled.

**Unchanged and now load-bearing:**

- **7.5** — key rotation runs entirely on the servers (`authorized_keys` on s1/s2). It is the only remaining barrier against the credentials left in GitHub Secrets.

### Artifact conflicts resolved

- **FR31** — rewritten: rebuild rather than import; commit-identical, not byte-identical.
- **FR33, FR34** — cancelled outright. Both described GitHub actions.
- **FR coverage map** — FR31, FR33, FR34 rows updated; Epic 6 and Epic 7 `FRs covered` corrected.
- **Additional Requirements** — the synchronization bullet now records the answer; the interim-regulation bullet is struck; the tag-bug bullet records that it stays open.
- **Overview** — new section *External dependency: the GitHub transition*.
- **Epic 6** — new accepted-risk note on the rollback horizon.
- **sprint-status.yaml** — new `cancelled` status defined; 6 stories set to it; 3 story keys renamed.

### Technical impact

No Forgejo-side work changes. The whole of Epics 2-5 and most of Epic 6 proceed as written.

## 3. Recommended Approach

**Direct adjustment** — modify stories within the existing epic structure. No rollback of
completed work (none exists beyond commit `09591984`, which is kept), and no MVP redefinition:
the goal of the migration, a working Forgejo delivery pipeline, is untouched.

Rationale: everything cancelled was about *leaving* GitHub, not about *arriving* at Forgejo.
The destination is unchanged; only the disposal of the old system is removed from scope.

**Effort:** Low — planning artifacts only.
**Risk:** High — see below. The risk is in what is no longer done, not in the change itself.
**Timeline:** Neutral to slightly favourable; six stories leave the backlog.

## 4. Accepted Risks

These are the cost of the decision. Each is recorded in `epics.md` at the point where it bites.

1. **The tag bypass stays open on GitHub.** For as long as GitHub receives commits, a `v*` tag
   deploys to production under the `dev` gate. Bounded in practice: no tag has ever been
   created, and the path aborts at `docker pull` — after writing to the production server.

2. **Two pipelines can deploy to production.** The legacy GitHub CD deploys to s2 on a merge to
   `main` and is not disabled. From the moment Forgejo can also deploy to s2, concurrent
   deploys from two independent pipelines are possible. Nothing in the plan prevents this.

3. **Forgejo may test code that is not what the team is writing.** Epics 2-6 build CI, images
   and deploys against whatever Forgejo holds, and Forgejo lags GitHub by a gap that widens
   daily.

4. **The rollback horizon resets at cutover.** Every pre-migration image lives in ghcr and is
   unreachable. Rollback can only target Forgejo-built versions, so the first Forgejo release
   is a one-way door. Story 6.8 must be proven *before* the cutover.

5. **No fallback to the legacy pipeline.** Story 7.1 treated the still-enabled GitHub deploy
   job as a safety net. Re-enabling it would be an action on GitHub, so that net does not
   exist. Combined with risk 4, Epic 6 carries no external safety net at all.

6. **ghcr tokens are never revoked.** The package and its publish credentials stay reachable by
   anyone holding the account or token. Not compensable from our side.

7. **Host and user secrets stay readable** in GitHub Secrets. Reconnaissance value, not access.

8. **Two DEV stands coexist with no planned end** and no named owner for retiring the legacy
   one.

**Partly compensated:** the SSH keys in GitHub Secrets (`DEV_SSH_KEY`, `PROD_SSH_KEY`) are
neutralised by Story 7.5 rotating them on the servers and removing the old ones from
`authorized_keys`. The secrets remain; they stop opening anything. **7.5 is therefore not
optional** — it is the only security control that survives the cancellation of 7.4.

## 5. Implementation Handoff

| Recipient | Responsibility |
|---|---|
| Oleg (outside this plan) | The GitHub transition: moving delivery and content to Forgejo, and deciding when the legacy DEV stand is retired |
| Developer agent | Epics 1-6 as written, minus the cancelled stories. Next up: Story 1.2 |
| Whoever runs Epic 6 | Must treat a concurrent legacy production deploy as possible, and must prove Story 6.8 before the first Forgejo release |
| Whoever runs Epic 7 | Story 7.5 is mandatory, not a tidy-up |

### Success criteria

- No planning artifact describes an action on GitHub as work this plan performs.
- Every risk above is recorded where the work that inherits it lives, not only here.
- `epics.md` and `sprint-status.yaml` agree — verified: 53 stories on both sides, no mismatch.

### Current sprint state

53 stories — 47 backlog, 6 cancelled. Epics: 1 in progress, 6 backlog. 7 retrospectives optional.
