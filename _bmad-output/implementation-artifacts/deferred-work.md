# Deferred Work

## Deferred from: code review of 1-3-verify-forgejo-actions-availability-and-concurrency-support (2026-08-08)

- `_bmad-output/planning-artifacts/epics.md` carries six pre-existing stale `CD.yml` citations
  (shifted by commit `09591984`, outside story 1.3's Task 6.3 scope), verified against `CD.yml`
  at HEAD: `:213` (`49,59`→`47,57`), `:255` and `:329` (`124`→`122`, `150`→`149`), `:457`
  (`140-153`→`138-152`), `:458` (`123-124`→`121-122`), `:1168` (`115-116`→`113-114`). Lines
  `:258` (`CD.yml:191`) and `:1107` (`CD.yml:47-74`) are already correct — sweep only the six.
- Forgejo API token `fe_tmp` (id 83) was created with scopes `all` instead of the
  `write:repository` + `read:organization` prescribed by story 1.3 Task 1.1, and is still live.
  Remedy is the already-tracked Task 7.1 manual revocation (Oleg, Forgejo UI → Settings →
  Applications), but the over-broad scope raises its urgency.
- `docs/forgejo-migration.md:19` current-state table still lists «`v*` → production» although
  the `tags: ['v*']` trigger was removed from `CD.yml` by commit `09591984`; the `CD.yml:5`
  citation on that row is correct — only the `v*` clause is stale content.

## Deferred from: story 1-13-stop-forgejo-from-executing-the-legacy-github-workflows (2026-08-10)

- `docs/forgejo-migration.md` §5 «Риски» — the row «Оба пайплайна одновременно деплоят на один
  стенд» closes with «job `deploy` в GitHub CD отключается в начале фазы 7», but decision
  [D7](../../docs/migration-decisions.md#d7) already established that **no action is taken on
  GitHub** — that job is never disabled by this plan. Story 1.13's Task 9.5 flagged this as
  out-of-scope for a citation-only pass; a neighbouring row was touched (a new risk row added
  directly below it), which is why it's noted here rather than silently left. Needs a content
  fix, not a line-number repair — someone should reconcile that row's wording with D7.

## Deferred from: code review of story 1-13-stop-forgejo-from-executing-the-legacy-github-workflows (2026-08-10)

**Actionable follow-ups this story created and did not track anywhere:**

- 🔴 **Re-provision the org Actions secret `SLACK_CD_WEBHOOK_URL` before Story 1.12.** Story 1.13
  overwrote its value with a non-resolving `example.invalid` stub. Forgejo secret values are
  write-only, so the original webhook URL is **unrecoverable** — whoever created it on
  2026-08-10 must supply it again. `docs/migration-decisions.md#d6` still records this secret as
  «org, без изменений» owned by Story 1.12, so Story 1.12 will see the name already populated and
  skip it, leaving deploy notifications silently dead. The overwrite was justified by a misreading
  of `CD.yml` (`deploy` has `needs: build-and-push`; the `if: always()` Slack step is step-scoped
  and cannot run when the job is skipped) — see `#d9` «Находки инстанса». Also still unanswered:
  why five secrets matching D6's naming scheme appeared minutes before the story's pre-flight.
- **Re-verify the fallback mechanism on any Forgejo upgrade.** `#d9` says «перепроверить при
  апгрейде инстанса», citing [forgejo#9203](https://codeberg.org/forgejo/forgejo/issues/9203) — a
  live upstream proposal to make foreign workflow directories configurable, i.e. exactly the change
  that would break this mechanism. No sprint item, no owner and no epic gate holds this recheck;
  this bullet is the only tracking it has.
- **Stories 1.7, 1.8 and 4.4 must not design around an Actions-run cancel capability.** No cancel
  endpoint exists in this Forgejo version — `POST .../actions/runs/{id}/cancel` → 404, confirmed
  against the full swagger spec. Story 1.3 and Story 1.13 both assumed one existed; Story 1.13's
  control run consequently ran to completion on another team's runner. Whether the **web UI**
  offers a cancel control was not checked.
- **Partially resolved 2026-08-10 (Oleg: "branch protection, preprod, prod, main"):** branch
  protection (block force-push and deletion for non-admins) added on `main` and `staging`. Still
  open: `development` has no rule; no protection stops a plain `git revert`/`git rm` of the
  placeholder (git cannot track an empty directory, and that's an ordinary fast-forward); no tag
  protection; `apply_to_admins: false` means the admin-scoped `fe_tmp` token itself bypasses the
  rule entirely. Decide whether any of these gaps are worth closing, and whether the tag rule
  ("cut `v*` only from commits carrying `.forgejo/workflows/") belongs in the Story 6.2
  production-approval regulation (Story 1.13's Open Question 5). See `#d9`.

**Findings deferred as not actionable now:**

- **The "accidental protection" premise was never observed, only assumed.**
  `.github/workflows/CD.yml:83-87` logs into `ghcr.io` with `username: ${{ github.actor }}` /
  `password: ${{ secrets.GITHUB_TOKEN }}`. Forgejo auto-injects `GITHUB_TOKEN` per run, so it never
  appears in the org/repo secret inventory Story 1.13's Task 2.1 enumerated — the pre-flight
  inventoried secrets the blocking step does not consume. The real failure mode (ghcr.io rejecting
  a Forgejo-issued token) is inferred. Verifying it means deliberately creating a CD run.
- **Actions runs 1–2 remain unattributed.** Story 1.13's Dev Notes flagged them as "unexplained —
  they may themselves be prior fallback executions"; Task 1.6 closed the point with "Story 1.3's
  early `probe-smoke` failures, as already documented", but neither Story 1.3's story file nor D8
  documents them — D8 only calls run 3 «первый успешно выполнившийся пробный ран». No run id, event
  type or timestamp was offered. This is the one place a prior, unattributed legacy fallback
  execution would surface. Needs API access to settle.
- **The `push` verdict has no control of its own.** Story 1.13's only control (run #13) was a
  `pull_request`; the three decisive "no run" results are `push` events. That a push *does* create
  a run without the placeholder comes from D8 by inference, never observed on the same counter.
  Obtaining such a control means deliberately re-arming the hazard on a CD ref.
- **Absence was measured only by run `total_count`.** Story 1.13's own Task 1.6 argued "Index alone
  is not enough" and required the newest run id alongside it; only the count was recorded from
  Task 3.8 onward. A count is invariant to a created-then-deleted run, and forgejo#10259 makes run
  states ambiguous on this version. The observations cannot be reconstructed after the fact.
- **Story 1.13 exceeded its own write budget on the over-broad `fe_tmp` token.** Task 1.4 allowed
  "the two writes this story needs (cancel a run; if escalating, disable the Actions unit)".
  Neither happened; three unplanned writes did — the org-secret `PUT`, the `has_pull_requests`
  `PATCH`, and direct pushes to three shared branches. Revocation is already tracked above as
  Story 1.3 Task 7.1; this raises its urgency further.
- **497 of 501 remote branches still carry an executable legacy `.github/workflows/CD.yml`** with a
  live `v*` tag trigger and `workflow_dispatch` (`environment` defaulting to `production`). The
  `#d9` invariant is proven on three branch heads; the mechanism is per-commit. Bulk remediation is
  outside Story 1.13's scope, but it bounds what Story 1.12 may safely arm. The PR-triggered
  variant of this risk (any PR from one of those branches running legacy CI on `ci-hub`) is closed
  for now — `has_pull_requests` was reverted to `false` on 2026-08-10 (Oleg: "ci-hub не надо
  запускать") — but re-opens automatically if Story 2.1 or anyone else re-enables the unit without
  re-checking this.

## Deferred from: story 1-7-provision-the-primary-forgejo-runner-with-both-labels (2026-08-11)

- **Node 20 is EOL (2026-04-30), `node:20-bookworm` is delisted but still pulls (frozen at
  v20.20.2).** The `node-20` label is fixed by FR28 (`epics.md:161-163`), `docs/forgejo-migration.md:142`
  and AC4 — this story registered it as specified and does not change it unilaterally. Someone needs
  to own the decision: stay pinned (accepting no further base-image security patches) or bump to a
  maintained line (Node 22 "Jod" or Node 24 "Krypton"), which is a scoped change touching
  `.github/workflows/CI.yml:20`, `Dockerfile.prod`, FR28 and this runner's registered labels, not an
  infrastructure-story drive-by.
- **s1 host contention is now directly observed, not just asked about.** Task 2.2 raised the
  question as an input to Story 4.2, not something this story resolves. Direct host inspection
  (not the API — `docker ps`/`docker inspect` on s1 itself) confirms all of `ci-hub`,
  `s1-build-crm`, `s1-deploy-dev-preprod` **and now `s1-fe-prionex-1`** run containers on the same
  box, alongside `techno-finance` and the observability stack. Story 4.2 still owns the formal
  resource-budget confirmation before the DEV (`:8082`) and PRE-PROD (`:8081`) stands land there too.
- **Resolved 2026-08-11, once `FJ_TOKEN` arrived:** `s1-deploy-dev-preprod`'s `GITEA_RUNNER_LABELS`
  env carries four values (`deploy-dev-preprod,dev,preprod,deploy`), but `GET
  /orgs/CRM/actions/runners` confirms only **one** is actually registered server-side —
  `[deploy-dev-preprod]`, matching this story's original baseline exactly. Env and registered
  labels diverge here (expected — the env var only applies at first-run auto-registration, which
  this runner apparently didn't use either). No baseline correction needed; noted for anyone
  reading that container's compose file and assuming the env var is authoritative.
- **New drift, found via the same API re-verification, not in any prior story's baseline:**
  org runner `s2-prod-deploy`, id 17, label `[s2-prod-deploy]`, running on **s2** (PROD). Appeared
  after Story 1.13's last inventory; no story has acknowledged it. No collision with `node-20`/
  `docker-build`. Whoever owns Story 6-series (production deploy) should confirm this is expected
  and not something to reconcile against.
- **`docker exec ... kill -9 1` silently no-ops inside the `forgejo/runner:13.0.0` image** — reports
  `exit=0` but does not deliver the signal; the container does not crash. A genuine crash test needs
  the signal sent from the **host**, targeting `docker inspect --format '{{.State.Pid}}'`. Worth
  carrying into Story 1.9 so the second runner's durability proof does not repeat the same false
  negative.
- 🔴 **This story itself hit Trap 1 on the first registration attempt — worth repeating loudly for
  Story 1.9.** Registering with `--labels 'node-20,docker-build'` (bare names, no `:docker://<image>`
  suffix) silently resolves both to the runner's default image (`node:22-bookworm` on this
  version) — no error, no warning, `register` reports success. The first probe dispatch caught it
  (wrong Node major version, no docker CLI); nothing about the registration step itself would
  have. **Always dispatch a real probe workflow before declaring a runner done** — a clean
  `register`/`daemon` startup log proves nothing about which images the labels actually resolve
  to.
