# Deferred Work

## Deferred from: code review of 1-3-verify-forgejo-actions-availability-and-concurrency-support (2026-08-08)

- `_bmad-output/planning-artifacts/epics.md` carries six pre-existing stale `CD.yml` citations
  (shifted by commit `09591984`, outside story 1.3's Task 6.3 scope), verified against `CD.yml`
  at HEAD: `:213` (`49,59`→`47,57`), `:255` and `:329` (`124`→`122`, `150`→`149`), `:457`
  (`140-153`→`138-152`), `:458` (`123-124`→`121-122`), `:1168` (`115-116`→`113-114`). Lines
  `:258` (`CD.yml:191`) and `:1107` (`CD.yml:47-74`) are already correct — sweep only the six.
- ✅ **Closed 2026-08-11 by story 1.7.** Forgejo API token `fe_tmp` (id 83) was created with scopes
  `all` instead of the `write:repository` + `read:organization` prescribed by story 1.3 Task 1.1.
  It is **no longer live**: its value had been lost, and rather than retrieve it Oleg chose to
  invalidate it during story 1.7 (Task 1.1). The over-broad-scope concern is therefore resolved,
  and the Task 7.1 manual revocation this entry pointed at is moot. Superseded by the `fe_tmp_1_7`
  entry below. *(This entry still read "and is still live" until story 1.7's code review corrected
  it — the invalidation happened in the same session that edited this file and was not swept.)*
- 🔑 **`fe_tmp_1_7` is live and needs an owner — opened 2026-08-11 by story 1.7's code review.**
  Story 1.7 minted a replacement API token on s1 via `docker exec -u git forgejo gitea admin user
  generate-access-token -u platform-admin -t fe_tmp_1_7 --scopes write:repository,read:organization`.
  It is strictly narrower than `fe_tmp` was, and it is mintable on the host without a password,
  which removes the out-of-band friction that motivated Open Question 7 — but it is still a live,
  write-capable credential on a `platform-admin` account, and story 1.7 recorded no owner, no
  expiry and no revocation trigger for it.
  **Owner: Oleg.** **Revocation trigger:** revoke when the last story that needs Forgejo API write
  access has closed, or immediately if the standing-token model is replaced. By standing rule its
  value is written into no file, so revocation is a manual UI/CLI action.
  **Open policy question, carried from story 1.7's Open Question 3:** one long-lived token per
  epic, or a scoped short-lived token minted per story? The second is what story 1.3 intended
  before its scope came back as `all`, and it is now cheap to do — the mint command above needs
  only host access.
  🔑 **A second live token now exists: `fe_review_1_7`.** Minted 2026-08-11 during story 1.7's code
  review, with Oleg's explicit authorisation, same scopes (`write:repository,read:organization`) on
  the same `platform-admin` account. It was needed to close the API-side evidence gaps (AC7's
  `idle` re-observation, AC8's server-side cross-check, run 337's job ids, the org runner list).
  **Stored host-local at `/root/.fj_token` on s1, mode `600`, owner `root:root`** — deliberately
  *not* in this repository, so the standing "never write the token into any file" rule (which is
  about repository files, the same rule that keeps `.runner` and `runner-config.yml` on the host)
  is respected. Its value never entered any transcript.
  **Owner: Oleg. Revocation:** both `fe_tmp_1_7` and `fe_review_1_7` should be revoked together
  when Forgejo API write access is no longer needed — and note that **two live tokens now exist
  where the model calls for one**, which is itself an argument for settling the policy question
  above. Whether `fe_tmp_1_7` is still live was not checked during the review: «не проверено».
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

- ⛔ **SUPERSEDED 2026-08-13 — Oleg's decision «slack не трогаем»; the secret will not be restored. See the Slack decision section below. Original entry follows.**
- 🔴 **Re-provision the org Actions secret `SLACK_CD_WEBHOOK_URL` before Story 1.12.** Story 1.13
  overwrote its value with a non-resolving `example.invalid` stub. Forgejo secret values are
  write-only, so the original webhook URL is **unrecoverable** — whoever created it on
  2026-08-10 must supply it again. `docs/migration-decisions.md#d6` still records this secret as
  «org, без изменений» owned by Story 1.12, so Story 1.12 will see the name already populated and
  skip it, leaving deploy notifications silently dead. The overwrite was justified by a misreading
  of `CD.yml` (`deploy` has `needs: build-and-push`; the `if: always()` Slack step is step-scoped
  and cannot run when the job is skipped) — see `#d9` «Находки инстанса».
  ✅ **"Why five secrets matching D6's naming scheme appeared" — answered, story 1.8
  (2026-08-11).** `GET /orgs/CRM/members` returns exactly three accounts: `platform-admin`,
  `robot-deploy`, `robot-registry`. The five org secrets (`REGISTRY_USER`, `REGISTRY_USER_RO`,
  `REGISTRY_TOKEN_RW`, `REGISTRY_TOKEN_RO`, `SLACK_CD_WEBHOOK_URL`, all created
  `2026-08-10T10:14:26–27+02:00`) are the hub's own platform credentials for those accounts, not
  something a previous story left behind. `SLACK_CD_WEBHOOK_URL`'s stub-value problem (previous
  bullet) is unaffected and remains open. See `docs/migration-decisions.md#d12`.
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
  v20.20.2).** The `node-20` label is fixed by FR28 (`epics.md:161-163`), `docs/forgejo-migration.md:145`
  and AC4 — this story registered it as specified and does not change it unilaterally. Someone needs
  to own the decision: stay pinned (accepting no further base-image security patches) or bump to a
  maintained line (Node 22 "Jod" or Node 24 "Krypton"), which is a scoped change touching
  `.github/workflows/CI.yml:20`, `Dockerfile.prod`, FR28 and this runner's registered labels, not an
  infrastructure-story drive-by. **Reviewed 2026-08-11 — Oleg: leave as is for now**, this entry is
  the tracking; no owner or date assigned deliberately.
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
- ✅ **CLOSED 2026-08-12, Story 1.9.** `docker exec ... kill -9 1` silently no-ops inside the
  `forgejo/runner:13.0.0` image — reports `exit=0` but does not deliver the signal; the container
  does not crash. A genuine crash test needs the signal sent from the **host**, targeting
  `docker inspect --format '{{.State.Pid}}'`. **Not repeated**: Story 1.9's AC5 evidence used
  host-side `kill -9` against the real PID both times (attempt 1: `2595943`; attempt 2, held down
  via `docker update --restart=no`: `2690884`), never `docker exec`. See
  `docs/migration-decisions.md#d13`.
- ✅ **CLOSED 2026-08-12, Story 1.9.** 🔴 This story (1.7) itself hit Trap 1 on the first
  registration attempt. Registering with `--labels 'node-20,docker-build'` (bare names, no
  `:docker://<image>` suffix) silently resolves both to the runner's default image
  (`node:22-bookworm` on this version) — no error, no warning, `register` reports success. The
  first probe dispatch caught it (wrong Node major version, no docker CLI); nothing about the
  registration step itself would have. **Always dispatch a real probe workflow before declaring a
  runner done** — a clean `register`/`daemon` startup log proves nothing about which images the
  labels actually resolve to. **Not repeated**: Story 1.9's registration used the full label spec
  copied verbatim from runner 1's `.runner` on disk; the register output named both `docker://`
  suffixes and carried no `Labels from command will be ignored` line. See
  `docs/migration-decisions.md#d13`.

## Resolved: deployment mechanism (2026-08-11, correct-course)

- ✅ **Deployment moves from `ssh`/`scp` to a deploy runner on the target host.**
  `sprint-change-proposal-2026-08-11-deploy-runner.md`, approved by Oleg and coordinated with the
  hub administrator. Triggered by Story 1.8's pre-flight finding that `ufw` on s1 denies port 22 to
  everything but two admin addresses, so SSH from a job container is impossible **at any
  credential**. `epics.md` amended: FR19 rewritten, NFR7 narrowed to administrative access,
  `S1_SSH_*`/`S2_SSH_*` removed from the secret migration map, Epic 4's goal and implementation
  notes reworded, Stories 4.3, 4.8, 5.3, 6.4 and 1.12 updated.
  🔒 **This retires the plan's largest standing hazard.** Story 1.13 named Story 1.12 as the story
  that removes the accidental protection keeping legacy `.github/workflows/CD.yml` from deploying,
  because 1.12 was what would place SSH credentials into Forgejo. It no longer does, so D9's
  suppression is permanent rather than procedural.
  ⚠️ **Accepted risk, recorded by Oleg's explicit decision:** the s2 deploy runner holds that
  host's `docker.sock`, so a production deploy job has root-equivalent control of the s2 daemon.
  Hub-standard pattern; the only way this model reaches production.
  ⚠️ **Still open for Story 4.4:** the `flock` server-side lock was designed against concurrent SSH
  sessions. A runner with `capacity > 1` still permits two simultaneous deploys, so **re-examine
  the lock rather than deleting it**.
  ⚠️ **Label status changed:** `dev`, `preprod`, `deploy`, `deploy-dev-preprod` and
  `s2-prod-deploy` stop being forbidden from Epic 4 onward and become the intended deploy targets.
  They remain forbidden for Story 1.8, which is a smoke test bound to `node-20`/`docker-build`.

## Blocker for Story 3.1 — established by story 1.8's code review (2026-08-11)

- ✅ **RESOLVED 2026-08-11 — `driver: docker` is the fix; Story 3.1 keeps `docker/build-push-action`.**
  Proven by a follow-up probe (run index 22, task 2639, all steps green): `setup-buildx-action` with
  `driver: docker` pushes through the `dind` daemon, which resolves `git.crm-prionex.com` correctly
  (`10.70.0.1`, reachable) — only containers *spawned by* the daemon resolve publicly, which is why
  the default `driver=docker-container` failed. Native `docker build` + `docker push` from the job
  container also works and stands as the AC5 replacement if the action is ever dropped. Both
  throwaway tags were deleted afterwards (`204`).
  **What Story 3.1 must carry:** `--add-host` in `container.options` (already permanent) **and**
  `driver: docker` on `setup-buildx-action`. Either alone is insufficient.
  ✅ **RE-PROVEN 2026-08-14 by Story 3.1 itself, this time in a surviving git ref.** The probe that
  produced the finding above lived only on a deleted branch and is quoted here as prose, not as a
  checkable artifact. Story 3.1's own probe (`probe/3-1-build-publish`, deleted after use) carried
  the identical `driver: docker` line and pushed `git.crm-prionex.com/crm/fe-prionex:build-check-3-1`
  on the first dispatch — run 512, job 5661 (`Build and Push`), task 5283, runner 19
  (`s1-fe-prionex-1`), started 08:18:59+02:00, stopped 08:21:49+02:00, **170s**, status success.
  Confirmed server-side: `GET /packages/CRM/container/fe-prionex/build-check-3-1` → `200`,
  `creator.login: robot-registry`, `created_at: 2026-08-14T08:21:46+02:00`; manifest digest
  `sha256:61095d9b4dcaabcf2592f99bcd89399141c8b33d9d017550f9932c4f0c0d7660` (content hash of the
  stored `manifest.json` blob, `package_file` id 9596), image ≈28.7 MiB across 11 layer/config
  blobs. **The native `docker build`/`docker push` fallback was not exercised** — `driver: docker`
  worked on the first attempt and there was no failure to fall back from. The surviving proof now
  lives in `.forgejo/workflows/build.yml` on `main`, not in a deleted branch.
  ⚠️ **`sha-a1b2c3d-prod` (id 1930) was NOT deleted** despite this section's own instruction below —
  the `DELETE /packages/CRM/container/fe-prionex/sha-a1b2c3d-prod` call was blocked by the
  operator's tool-permission classifier as a destructive production action requiring explicit
  authorization, and Story 3.1 did not attempt to route around that block. It remains `keep_pattern`-
  protected (permanent) and open for whoever executes the deletion next, token already provisioned
  (`/root/.fj_token_3_1` on s1, `write:package`).
  *Original finding, kept for the reasoning:*
- ✅ **RESOLVED 2026-08-14 by Story 3.1 (run 512).** `driver: docker` works; the push landed and the image is pullable. Original entry follows.
- 🔴 **`--add-host` on `container.options` is necessary but NOT sufficient for `docker/build-push-action`.**
  Story 1.8's `#d12` records the `--add-host git.crm-prionex.com:10.67.0.1` line as a permanent
  Story 3.1 prerequisite. Re-dispatching the credentialed probe during code review proved that
  **the push still fails with it in place**:
  `failed to solve: failed to push … failed to do request: Head "https://…/v2/…/blobs/sha256:…": EOF`.
  **Cause:** `docker/setup-buildx-action` creates a builder with `driver=docker-container`, so buildx
  pushes from its **own BuildKit container**. `container.options` applies only to the *job* container,
  so the builder never gets the host mapping, resolves `git.crm-prionex.com` to the public address
  through split-horizon DNS, and the connection dies. Control pair from a job-equivalent container:
  with `--add-host` → `401`, without → `000`.
  **Story 3.1's `build.yml` will fail identically unless one of these is done — all «не проверено»:**
  (a) pass the mapping through `setup-buildx-action`'s `driver-opts`; (b) use the `docker` driver so
  the push goes via the nested daemon; (c) give the nested `dockerd` the mapping so every container
  it spawns inherits it; (d) replace the action with native `docker build` + `docker push` from the
  job container, which already holds the mapping — this is also the AC5 replacement Story 1.8 owes.
- ✅ **Answered while proving the above: `REGISTRY_USER` / `REGISTRY_TOKEN_RW` work.**
  `docker/login-action@v3` authenticated against `git.crm-prionex.com` and the build proceeded to
  the push stage, so the credentials exist, are valid and carry push rights. Story 1.10's question
  «adopt `robot-registry` as-is or mint `ci-bot`?» can now be decided on preference rather than on
  an unknown. Oleg confirmed with `aleksey` on 2026-08-11 that they are ours to use.
  ✅ **Closed by Story 1.10 (2026-08-12).** Decided: adopt (path a), nothing created. The push
  right recorded here was re-proven independently in Story 1.10 with a freshly minted equivalent
  token (`REGISTRY_TOKEN_RW`'s own value is unreadable — Forgejo secrets are write-only), because
  this item only established that *some* login-action run once authenticated, not that the
  credential is reliably usable outside a workflow. See `docs/migration-decisions.md#d14`.
- ✅ **Answered as a by-product: org secrets ARE visible to workflows in `CRM/fe-prionex`.**
  Story 1.8 listed this as «не проверено» and the spec said Story 1.12 depends on the answer. The
  credentialed job referenced `${{ secrets.REGISTRY_USER }}` / `${{ secrets.REGISTRY_TOKEN_RW }}`
  and `docker/login-action` authenticated successfully — org-scoped secrets therefore reach
  workflows in this repository without a repo-level copy. Story 1.12 can plan on that.
- 🔑 **Two more live tokens: `fe_ac3_close` (`write:repository,read:organization`) and
  `fe_pkg_cleanup` (`write:package`).** Both minted 2026-08-11 during code review with Oleg's
  authorisation — the first to close AC3, the second because deleting the throwaway images needed a
  package scope the first did not have. Host-local on s1, never written into the repository.
  **Owner: Oleg.** Revoke together with `fe_tmp_1_7`. **Four tokens now exist where the model calls
  for one** — the policy question is no longer theoretical, and the platform's own answer (named
  robot accounts rather than tokens on a human admin) is worth adopting.
- ✅ **The `run_registry_push` gate works in the enabling direction** — a review layer flagged that a
  boolean/string mistake would be indistinguishable from a withheld run. It is
  `== 'true'` with a string default, and the gated job did execute when dispatched with `"true"`.

## Opened by code review of story 1.10 (2026-08-12)

- 🔴 **Story 1.11 blocker — the `crm/` registry namespace is SHARED.** s2 holds pulled images
  `git.crm-prionex.com/crm/hub-migrate`, `crm/hub-web`, `crm/hub-backend`; a separate `infra/`
  namespace also exists. Under `CRM` there are **87 distinct packages / 620 versions** — only
  `crm/fe-prionex` is ours. **A retention rule scoped to the `crm` owner rather than to the
  `crm/fe-prionex` path would delete another team's images.** Story 1.11 writes that rule next.
- 🧪 **Story 1.11 test case, handed over deliberately (Oleg, 2026-08-12).** Story 1.10 deleted the
  `reg-check-1-10` **tag** but its constituent manifests survive: four untagged versions of
  `CRM/fe-prionex` (`sha256:462aa47c…`, `90bd6b13…`, `57c4b5a4…`, `f677b05a…`) plus an `_upload`
  row, ≈60 MB, created 2026-08-12, still served by digest. **`package_cleanup_rule` on this
  instance is empty — 0 rows — so nothing will ever collect them.** Left in place on purpose: they
  are real untagged residue for the retention policy to be tested against. Deleting a *tag* is not
  deleting an *image* — that is the lesson, and it is what AC6 got wrong.
- 🔑 **`fe_reg_1_10_ro` (id 99, `robot-registry`, `read:package`) is s1's live pull credential** —
  a deliverable, not scaffolding. Do not revoke it without replacing s1's `docker login`.
  ✅ **`fe_reg_1_10_rw` (id 100, `robot-registry`, `write:package`) revoked 2026-08-12** by
  deleting its `access_token` row, on Oleg's decision — the instance went 94 → 93 live tokens.
  ⚠️ **Every scripted revocation route is closed on this version, and this is the fact that will
  cost the next story time:** `gitea admin user` has no delete subcommand;
  `DELETE /users/{username}/tokens/{token}` requires **basic auth as that same account** (a token,
  even an admin's, gets `401`); and the web UI Applications page lists **only the logged-in user's
  own tokens** — a service account's tokens are invisible to an admin there, and the admin panel
  has no token view at all. So a token minted *as* `robot-registry` cannot be revoked by an admin
  through any UI or API path without that account's password. Oleg looked for id 100 in his own
  Applications list and correctly did not find it. Plan token cleanup **before** minting: either
  keep the account's password to hand, or accept the DB row as the revocation route.
- ⚠️ **Recurring trap, evidenced: cleaning up a token needs `write:user`, and prior stories left
  their attempt tokens behind.** `platform-admin` carries four abandoned `write:user` tokens —
  `story21-cleanup-1785925612`, `story21-cleanup2-1785925641`, `story21-cleanup3-1785925657`,
  `story-3-6-cleanup`. Three from one story suggests it was retried three times. Story 1.10's
  review walked into the same wall and had to have its own attempt token revoked by hand. **This is
  the strongest argument yet for settling the token model before Story 1.12** — the count is 94
  instance-wide (81 on the human admin account), not the 7 the story recorded.
- ⚠️ **Deviation recorded, not normalised: a production credential was relocated.** s2's
  `robot-deploy` auth was decoded off the production host and used for a `docker login` on s1 to
  run the rejection test. Cleaned up afterwards (s1 now holds only `robot-registry`), but the
  precedent must not stand: **production credentials are not moved to other hosts without an
  explicit decision.** Consider rotating that token — owner's call.
- ⚠️ **s1's pull credential is coupled to the write identity.** `fe_reg_1_10_ro` sits on
  `robot-registry`, which also holds five `write:package` tokens; s2 by contrast uses
  `robot-deploy`, all of whose tokens are `read:package`. NFR6 is satisfied by *scope*, but a
  rotation or compromise of `robot-registry` hits both s1's pull and CI's push at once. For
  Story 1.12 to settle alongside the token model.
- ⚠️ **Story-template rule, to stop this recurring:** a prohibition in a story's 🚨 **Prohibitions**
  block **cannot be overridden by a subtask**. Story 1.10 forbade anything but
  `pull`/`inspect`/`images`/`login` on s2, and Task 6.3 then authorised `docker rmi` there; the
  execution followed the subtask. No damage — but the next conflict may not be harmless. Either the
  prohibition or the subtask must be changed **before** execution, by explicit decision.

## Deferred from: code review of story-1.7 (2026-08-11)

- 🔒 **nginx ACL on s1 was widened and has no rollback owner.** Story 1.7 added
  `allow 192.168.226.0/24;` to `/etc/nginx/sites-available/forgejo-platform` on s1 — a shared
  production host — because runner registration was failing `403 Forbidden` from the ACL boundary
  before ever reaching Forgejo, and none of the five already-allowed subnets was free. A config
  backup was taken and `nginx -t` was run before `systemctl reload nginx`.
  **What is not tracked anywhere else:** the file is outside version control, the backup is
  host-local, and the neighbouring `CRM/api-prionex` project hit the same wall and deliberately
  declined to edit the ACL itself (`docs/migration-decisions.md#d10`). Approval is recorded
  second-hand — story 1.7 says Oleg confirmed coordination with the hub administrator (aleksey);
  no direct confirmation from the administrator is captured.
  **Owner: Oleg.** **Removal trigger:** when subnet `192.168.226.0/24` is retired — i.e. if the
  `forgejo-runner-fe-prionex` compose project is decommissioned or renumbered. Nothing else in
  this repository points at that ACL line, so without this entry it would be invisible.
- 🧪 **AC2's cross-repository routing was never tested.** Story 1.7's AC2 requires that our runner
  "does not appear as available to other `CRM` repositories". What was actually checked is its
  total absence from `GET /orgs/CRM/actions/runners` across every read of the session — a property
  of *registration scope*, not of *job routing*. Whether a job defined in a different `CRM`
  repository could somehow target `id: 19` was not tested and is not claimed (story 1.7 Task 8.2
  says so plainly).
  **Reviewed 2026-08-11 — Oleg: accept repository-scope registration as the isolation guarantee.**
  It is Forgejo's own mechanism for this, and the direct test would mean starting an uncancellable
  run in another team's repository, which story 1.7's own rules forbid. Recorded here so the gap
  is visible rather than implied by a ticked AC.
- ✅ **CLOSED 2026-08-12, Story 1.9.** 📦 The runner's host configuration was unversioned, and two
  hardcoded addresses are load-bearing. `/opt/forgejo-runner-fe-prionex/{config.yml,docker-compose.yml}`
  on s1 was the only record of how the runner is set up. Two values in it are fragile:
  `cache.host` (the `runner` container's statically pinned bridge IP) and
  `container.options: -e DOCKER_HOST=tcp://172.17.0.1:2375` (the nested engine's default-bridge
  gateway). Per Trap 3, losing the cache server **does not fail a job** — `actions/setup-node`
  logs `Cache action is only supported on GHES version >= 3.5…` and goes green, caching nothing —
  so a subnet renumber or a lost IP pin degrades every future CI run silently.
  **Resolved:** a sanitised copy of `docker-compose.yml`, `config.yml`, `config-2.yml` and a
  `.env.example` now lives at `docs/runners/` (never `.runner`, which holds the instance secret),
  with both load-bearing values called out in-file and in `docs/runners/README.md`. Explicitly
  recorded as a **record, not a deployment mechanism** — it will drift unless updated by hand. A
  CI step that fails on an unreachable cache server, so the degradation stops being silent, remains
  open for Story 2.1 to consider — not attempted here. See `docs/migration-decisions.md#d13`.
  ⚠️ **Restored by code review 2026-08-12 — the closure rewrote this entry and dropped three things
  a ledger of this kind must keep.** (a) The human decision that routed it here: **«Reviewed
  2026-08-11 — Oleg: carry to Story 1.9»**. (b) The backlink: this entry closes **Story 1.7's Open
  Question 8**, which was raised and originally filed against nothing. (c) The literal value the
  warning was about — `cache.host: "192.168.226.3"` for runner 1, and now `"192.168.226.4"` for
  runner 2 — generalised away to «the statically pinned bridge IP», which is the part a reader
  cannot act on.
  🔴 **Still open, and now owned by nobody: drift detection.** `docs/runners/` records the config but
  cannot detect divergence from the host — the copy deliberately differs (banner + `LOAD-BEARING`
  comments) with no recorded checksum or marker, so a mechanical `diff` is non-empty on day one and
  proves nothing. **Re-filed here rather than left implied.**
- 🔁 **AC7's crash test was never re-run against the surviving runner registration.** Story 1.7's
  durability proof (`RestartCount` 0→1 after a host-side `SIGKILL` to the real PID) was taken
  before Task 3.5's label fix, i.e. against runner `id: 18`, which was then deregistered and
  `DELETE`d. `restart: unless-stopped` is a property of the container rather than the registration,
  so the restart conclusion stands — but the re-declare that was observed carried the bare, wrong
  labels, and no crash test has been run against `id: 19`. Two adjacent gaps: the API re-read of
  the runner round-tripping `offline` → `idle` was never performed, and the premise that
  `docker.service` is enabled at boot on s1 was stated as fact but never checked
  (`systemctl is-enabled docker`, one read-only command).
  **Reviewed 2026-08-11 — Oleg: re-run the crash test against `id: 19`. ✅ Done, and it passed.**
  `RestartCount` 0→1, new PID, recovery within 1 second, clean re-declare with labels, `dind`
  untouched. `systemctl is-enabled docker` → `enabled`, so the reboot-assertion chain now rests on
  a checked premise. **What remains open, and only this:** the API-side observation of the runner
  round-tripping `offline` → `idle` in the repository runner list, which needs `FJ_TOKEN` — token
  minting was blocked in the review session. Low value now that the container-level evidence is
  direct; fold into Story 1.9 rather than chasing separately.
  **Attempted in Story 1.9 (2026-08-12), still not observed — leaving this open rather than
  claiming it.** Two crash-test attempts against runner 1 (`id: 19`), one recovering in 327ms and
  one deliberately held down for ~51s (`docker update --restart=no`). ⚠️ **Corrected by code review
  2026-08-12 — the original text overstated both the sampling and the conclusion.** Only the second
  attempt queried `GET .../actions/runners` mid-outage, and only once, ~2s after the kill; attempt
  1's outage was **327 ms**, so no HTTP round-trip fits inside it. The API reported `idle` at that
  single sample, which bounds the threshold at **>2s, not >51s** — it was never measured. Observing
  the transition would need a longer hold than
  either AC2 or AC5 required, so it wasn't chased further. See
  `docs/migration-decisions.md#d13` and Story 1.9 Task 4.4.
- ⚠️ **AD-6 is not the absolute rule story 1.7 recorded — for Story 1.9 and anyone reasoning about
  runner security on s1.** Direct host inspection on 2026-08-11 found **six** runner compose
  projects on s1 (not three or four), and one of them — `/opt/forgejo-runner-deploy` — mounts the
  host `/var/run/docker.sock` deliberately, with the risk explicitly accepted in a banner in its
  own compose file. The observability agent `vm-alloy` mounts it too. The rule as actually
  practised: **build runners use DinD and never touch the host socket; the deploy runner is a
  documented exception**, because deploying means driving the host's own daemon. Story 1.7's choice
  of DinD stands — it is a build runner and matches four of five neighbours — but any future story
  that cites AD-6 as "never, in any service" will be citing something untrue. Full correction in
  `docs/migration-decisions.md#d10`.

- **Story files are not committed at `create-story` time, so self-reported deviations cannot be
  audited.** Story 1.7's file has exactly two commits (`c1170987`, `9f75b89e`), both authored
  after execution — it was born already at `Status: review`. Every `⚠️ Deviated from the
  recommended path` and `🔴 This entry was wrong` annotation was therefore written in the same
  commit as the instruction it claims to deviate from, and for ~40 subtasks the original
  requirement text was overwritten in place rather than annotated, so there is no recoverable
  statement of what the tick was claiming to satisfy. Story 1.6 by contrast has a `create-story`
  commit (`4032f867`) preceding any dev work — that is the pattern that makes the
  "retro-annotate rather than silently tick" convention auditable. Deferred: process issue,
  not retroactively fixable for 1.7; worth enforcing from the next story onward.
- **A story reached `review` with open subtasks.** At `c1170987` — the commit that set
  `Status: review` and flipped `sprint-status.yaml` — Tasks 5.3, 10.6 and 10.7 were still `[ ]`;
  they were ticked afterwards in `9f75b89e`. Deferred: already past for 1.7, but the
  status-transition gate is worth making explicit in the dev-story cycle.

## Deferred from: story 1-8-prove-action-compatibility-with-a-smoke-workflow (2026-08-11)

- ✅ **RESOLVED 2026-08-14 — Story 3.1 pushed successfully with both the `--add-host` mapping and `driver: docker` in place.** Original entry follows.
- 🔴 **Registry DNS/egress finding and its fix — Story 3.1 prerequisite.** From inside a job
  container, `git.crm-prionex.com` resolves to the **public** IP `185.185.49.127` (split-horizon —
  the s1 host itself resolves it to `10.70.0.1`), and connecting there fails
  (`OpenSSL SSL_read: unexpected eof`). Pointing at the internal IP alone does not fix it either —
  the registry's auth realm is pinned to the public hostname. **Fix applied and verified by story
  1.8:** `--add-host git.crm-prionex.com:10.67.0.1` added to `container.options` in
  `/opt/forgejo-runner-fe-prionex/config.yml` on s1 (backup taken first, runner restarted, returned
  to `idle`). After the fix, `/v2/` and `/v2/token?service=container_registry` both return `401`
  from a job-equivalent container (reachable, correctly demanding auth). **Story 3.1 pushes to the
  same registry from the same runner and will fail identically without this line — it is meant to
  persist, do not revert it.** See `docs/migration-decisions.md#d12`.
- **`ci-bot` vs `robot-registry` substitution — for Story 1.10.** `epics.md:94` (FR10), `:209` (NFR6), `:299` and `:252`, `:299`, `:784`, `:793`, `:1076` (⚠️ code review 2026-08-12: прежняя ссылка `:722` указывала внутрь секции самой Story 1.10 и была неверна; все пять теперь размечены на месте) name
  a technical user `ci-bot`; it does not exist on this instance (`GET /users/ci-bot` → 403, absent
  from `GET /orgs/CRM/members`). The platform's own equivalent is `robot-registry`, one of exactly
  three accounts on the org (`platform-admin`, `robot-deploy`, `robot-registry`), and the org
  secrets `REGISTRY_USER`/`REGISTRY_TOKEN_RW` almost certainly belong to it. Story 1.10 decides
  whether to adopt `robot-registry` as-is or still create `ci-bot` — story 1.8 does not decide this,
  only records the substitution. Oleg still needs to confirm with the hub administrator (`aleksey`)
  that `REGISTRY_USER`/`REGISTRY_TOKEN_RW` are `fe-prionex`'s to use — **not done during story
  1.8's session**, and it blocked AC3's credentialed clause (below).
  ✅ **Closed by Story 1.10 (2026-08-12): adopted `robot-registry` as-is (path a), rejected creating
  `ci-bot` (path b).** Cost of (b), recorded per Task 2.2: a second write-capable identity on a
  shared registry (610 packages across the org at the time of checking, `fe-prionex` one consumer
  among several), created for naming reasons and then requiring manual sync with the platform's own
  pair — not worth it. `epics.md` FR10, NFR6 and Story 1.10's own AC2 are marked accordingly (not
  rewritten); `:299` (the FR summary table) and `:252`, `:299`, `:784`, `:793`, `:1076` (⚠️ code review 2026-08-12: прежняя ссылка `:722` указывала внутрь секции самой Story 1.10 и была неверна; все пять теперь размечены на месте)/`:1076` (Story 1.12/3.1's own mentions) are
  intentionally left for those stories to amend when they run — out of this story's scope. See
  `docs/migration-decisions.md#d14`.
- ✅ **ANSWERED — org secrets do reach workflows here without a repo-level copy (Story 1.8, re-confirmed by Story 3.1's login). Original entry follows.**
- ⚠️ **Whether org secrets are exposed to workflows in `CRM/fe-prionex` — «не проверено», Story
  1.12 depends on the answer.** Story 1.8 authored a job (`probe-docker-push` in
  `.forgejo/workflows/probe-actions.yml`, on the now-deleted `probe/action-compat` branch) that
  referenced `secrets.REGISTRY_USER` and `secrets.REGISTRY_TOKEN_RW`, gated behind an explicit
  `workflow_dispatch` input defaulting to `false`. That job was **never dispatched with the
  enabling input** — see next entry — so this session produced no direct evidence either way.
  Repo-level secrets are confirmed empty (`[]`); whether the **org**-level secrets resolve inside a
  repo workflow at all was not established.
- ✅ **RESOLVED 2026-08-14 — Story 3.1's run 512 exercised both actions against the real registry and pushed.** Original entry follows.
- 🔴 **AC3's credentialed clause (`docker/login-action` + `docker/build-push-action` against a real
  push) was not exercised — blocked on human confirmation, carried forward for whoever revisits
  it.** Task 2.1 of story 1.8 requires Oleg to confirm with `aleksey` that `REGISTRY_USER`/
  `REGISTRY_TOKEN_RW` are `fe-prionex`'s to use before the first push; the story's own capability
  table marks this "❌ no" for the dev agent, and the dev agent that ran story 1.8 has no channel to
  `aleksey`. That confirmation was not obtained during the session, so the credentialed job was
  authored (readable in `docs/migration-decisions.md#d12`'s evidence, reconstructable from this
  entry) but never dispatched. `docker/login-action` and `docker/build-push-action` therefore carry
  the verdict «не проверено», not "does not resolve" — this is a withheld attempt, not an observed
  failure. Whoever obtains the confirmation can recreate a throwaway probe branch and dispatch with
  `run_registry_push: "true"` to close this.
- **Token reuse, not a new mint.** Story 1.8 used the existing `/root/.fj_token` on s1 (per
  `deferred-work.md`'s own entry above, this is `fe_review_1_7`, minted 2026-08-11 during story
  1.7's code review with Oleg's authorisation) and did **not** mint a third live token. The
  standing two-token question (`fe_tmp_1_7` vs `fe_review_1_7`, one-per-epic vs scoped-per-story)
  is unchanged by this story — still open, still tracked above. Whether `fe_tmp_1_7` is still live
  was not re-checked: «не проверено», same as before.
- **s1 firewall re-verification was not repeated.** Story 1.8's Task 1 pre-flight list does not
  include re-checking `ufw`'s port-22 allowlist; the story rests on the finding already recorded
  when the Epic 4 correct-course was approved (`ufw` active, `-P INPUT DROP`, port 22 allowed only
  from two named admin IPs). Re-verifying this specific fact in this session: «не проверено» —
  not re-run, deliberately, since AC4 no longer needs an SSH probe at all (rescoped to «деплой по
  runner»).

## Opened by story 1.11 implementation (2026-08-12)

- ✅ **RESOLVED — the story was rewritten by `sprint-change-proposal-2026-08-13-openbao.md` before it ran.** Original entry follows.
- 🔴 **Story 1.12 is written against a premise that is already false, and mostly already done.**
  Its AC1 requires `REGISTRY_TOKEN` and `SLACK_CD_WEBHOOK_URL` to exist at `CRM` organisation
  scope. Verified on the instance: `REGISTRY_TOKEN_RW`, `REGISTRY_TOKEN_RO`, `REGISTRY_USER`,
  `REGISTRY_USER_RO` and `SLACK_CD_WEBHOOK_URL` **all already exist** at org scope, created by the
  platform before this migration began. Its AC4 requires `FRONTEND_PORT` to be absent from
  variables — it is absent. Under the amended FR19 no SSH secret is created at all. **What actually
  remains of Story 1.12 is six repository variables** — `VITE_API_BASE_URL_{DEV,PREPROD,PROD}` and
  `VITE_WS_URL_{DEV,PREPROD,PROD}` — none of which exist yet, plus the decision below. Re-scope the
  story before running it, or it will "create" things that are there and record a migration that
  did not happen.
- 🔑 **The platform runs OpenBao (`forgejo-openbao`, OpenBao 2.6.1) on s1, and the plan never
  mentions it.** Two incompatible secret patterns are live on the same instance:
  **(a)** `CRM/PRIONEX_HUB` holds only bootstrap AppRole credentials in Forgejo —
  `OPENBAO_ADDR`, `OPENBAO_{DEV,PREPROD,PROD}_ROLE_ID` and `…_SECRET_ID` — and fetches real secrets
  from OpenBao at run time. `Telecom/aggressive_dialer` and org `Infra` use the same shape under the
  older `VAULT_*` names.
  **(b)** `CRM/api-prionex` uses no OpenBao at all: fifteen real production secrets sit directly in
  Forgejo repo secrets — `PREPROD_JWT_SECRET`, `PREPROD_POSTGRES_PASSWORD`,
  `PREPROD_ENCRYPTION_KEY_VERSIONS`, `PREPROD_DOCUMENT_ENCRYPTION_KEY`, `PREPROD_KONG_PG_PASSWORD`
  and others.
  **Decision needed before Story 1.12:** which pattern `fe-prionex` follows. The honest engineering
  answer is that the frontend needs neither — the only credential it consumes is the registry token,
  which already lives in org secrets and is shared by all of `CRM`; an AppRole chain would add a
  dependency for nothing. But if platform policy is that production credentials belong in OpenBao,
  then the backend's fifteen are the larger problem and that is a platform conversation, not a
  frontend one. Whichever way it goes, **record it** — a third pattern appearing by accident is the
  bad outcome.
- ⚠️ **Runner inventory is wrong again, in a new way.** s1 runs six runner projects, not four:
  `forgejo-runner-crm-deploy`, `forgejo-runner-crm`, `forgejo-ci-runner` (+dind),
  `forgejo-runner-telecom` (+dind), `forgejo-runner` (+dind). Versions are split — `runner:13.0.0`
  on three, `runner:12.13.2` on two. Story 1.9 documented a drift-check procedure in
  `docs/runners/README.md`; it does not cover version skew across projects on the same host.
- ✅ **Resolved 2026-08-12: `fe_seed_1_11` was minted.** The silent exit `1` was `docker exec`
  running as **root**, which Forgejo refuses outright — `-u git` fixes it. Worth keeping because the
  failure printed nothing at all and read like a permissions problem.
  ⚠️ **Two tokens are now live and awaiting revocation:** `fe_seed_1_11` (id 103, `write:package`)
  and `fe_pull_1_11` (id 104, `read:package`), both on `robot-registry`, which now carries seven
  tokens where it carried five. Neither has a scripted revocation route — see
  [[forgejo-token-revocation-is-a-dead-end]] in the same list. Story 1.11 declared a budget of
  **zero** tokens and minted two; the story's own inherited lesson said to plan revocation before
  minting, and it was not.

- ✅ ~~**FR11 promises storage reclamation the platform cannot deliver.**~~ **WITHDRAWN 2026-08-14 by
  Story 3.1's review — the premise was a measurement artefact.** Forgejo 15.0.5 runs a **second,
  separate** cleanup that nobody in this plan had looked at: the **`cleanup_sha256` cron**. It is
  independent of `package_cleanup_rule`, consults neither `remove_days` nor `keep_pattern`, and
  deletes container versions whose version string is `sha256:*` and which **no index manifest
  references** — with its own **24-hour** minimum age. It removed Story 1.10's four orphaned digest
  rows at `2026-08-14 00:00:00` (`4 entries from package_version`, `30 from package_file`), and the
  blobs went with them: **zero unreferenced `package_blob` rows remain.** 🔴 **Why Story 1.11
  concluded the opposite:** its measurement window fell entirely inside that grace period, and the
  server log said so at the time — *«4 out of 4 container image(s) are not deleted because they were
  created less than 24h0m0s ago»*. «Did not delete» was read as «never deletes». The half that still
  stands: deleting a **tag** frees no blob storage. **Method lesson:** the answer was in
  `docker logs forgejo` for eight hours. Story 1.11 and Story 3.1 both generalised «job logs are
  unretrievable on this instance» — true — into not reading the **server** log, which is a different
  thing entirely. Reword FR11; no new mechanism is needed.
- ⚠️ **The Forgejo log is not a record of cron executions.** One `cleanup_packages` line exists for
  the container's entire lifetime despite at least four runs. The only reliable evidence is the
  execution counter on Site Administration → Monitoring → Cron Tasks. Any future story that needs to
  prove a scheduled task ran must read that counter before and after — a log grep will show nothing
  and look like a failure.

## Opened by the code review of story 1.11 (2026-08-13)

- 🔑 **`ci-probe` (6 versions) and `ci-probe-cache` (1) have no owner after Epic 1.** Story 1.11
  decided deliberately to leave them **outside** the retention rule: `remove_pattern` is anchored to
  `fe-prionex/`, so the rule will never collect them, and widening it for seven versions is not
  worth the extra reach. They are Epic 1 smoke-test residue serving nothing. Right disposal is a
  one-off deletion at Epic 1 close via `DELETE /packages/CRM/container/ci-probe/{version}`, not a
  standing policy clause. **Owner: whoever closes Epic 1.**
- ✅ **The mechanism that reclaims registry storage is `DELETE /packages/{owner}/{type}/{name}/{version}`,
  and the backend team already uses it.** Story 1.11 recorded "a separate mechanism is required, and
  none was found" — wrong, and its own route inventory contained the answer. Evidence it is in live
  use: foreign container versions show **605 missing ids** across their id range, and their count
  fell 1263 → 1223 overnight while our rule provably could not touch them (no foreign version is
  older than 14 days). Most gaps predate our rule entirely. **This is what Story 1.11's AC6 should
  have named**, and it is the starting point for whatever bounds registry growth — the cleanup rule
  never will. ✅ **CORRECTED 2026-08-14:** the `cleanup_sha256` cron does reclaim dangling `sha256:*`
  versions and their blobs — see the withdrawn FR11 entry above.
- ✅ **ANSWERED 2026-08-14 — it does not hold; `cleanup_sha256` deletes unreferenced digest rows after 24h. Original entry follows.**
- 🔴 **The AC6 finding "cleanup rules operate on tagged versions only" is under-evidenced and must
  be re-run before anything depends on it.** ✅ **RE-RUN AND ANSWERED 2026-08-14 — it does not hold;
  the deletions happen, by a different cron, after a 24-hour grace period.** Original text follows.
  It is contradicted by Story 1.11's own record: `_upload`
  was untagged **and** internal and was deleted. Two unresolved candidates: the preview and the run
  disagree about internal rows, or `_upload` was removed by the expired-upload step of the same cron
  task rather than by the rule. The distinction decides whether untagged digest rows are reachable
  at all, which decides whether registry growth can ever be bounded by a rule. FR11's defect
  annotation in `epics.md:99` rests on this.
- ✅ ~~**`sha-a1b2c3d-prod` (id 1930) is seeded test material still sitting in `crm/fe-prionex`.**~~
  **DELETED 2026-08-14 on Oleg's explicit authorisation** (`DELETE /api/v1/packages/CRM/container/fe-prionex/sha-a1b2c3d-prod`
  → `204`). Two sessions had been blocked from doing this by the permission classifier, correctly —
  it is a destructive action against a production registry — and both recorded the command rather
  than routing around it. A `write:package` token was minted for the call and revoked immediately
  after by deleting its `access_token` row: 96 → 97 → 96.

  🔬 **It leaves a falsifiable prediction behind, which is the point.** That tag was an *index
  manifest* whose two children are `sha256:45758f18…` (1926) and `sha256:0f445cb8…` (1927), the only
  reason those two survived the `cleanup_sha256` sweep on 2026-08-14. With the index gone they are
  now referenced by nothing, so the same cron should delete them **at the next midnight run, once
  they clear its 24-hour grace period** — leaving `crm/fe-prionex` holding only `build-check-3-1`
  and the internal `_upload` row. `package_blob` already shows **1 unreferenced blob** immediately
  after the deletion, consistent with the tag's own manifest being released while its children wait.

  **If those two rows are still present after the next midnight, the `cleanup_sha256` explanation is
  wrong and FR11's withdrawn defect must be reinstated.** Whoever looks next: one query settles it —
  `select id, version from package_version pv join package p on p.id=pv.package_id where p.name='fe-prionex'`.
- ⚠️ **Story 1.11's Task 7.2 was not done:** `docs/forgejo-migration.md` still presents retention as
  an unmade choice ("Выбрать одно: …") while the rule is live. Every field value is recorded
  verbatim in `docs/migration-decisions.md`, so nothing is lost — but the migration document
  contradicts production.

## Opened by story 1.12 provisioning (2026-08-13)

- 🔴 **`/usr/local/bin/bao` on s1 is a `docker exec` wrapper that silently authenticates as
  `admin`, and it has no owner.** 530 bytes, mode **755** (world-readable), created 2026-08-07,
  its own header says *«Story 3.2 / BLOCKER 2 — обёртка … Удалить после провижининга»* — it was not
  deleted. It does `exec docker exec -i -e BAO_ADDR=… -e BAO_TOKEN forgejo-openbao bao "$@"`, so
  when `BAO_TOKEN` is empty docker passes nothing and the in-container client falls back to a token
  carrying `admin`. **Any command run through it without an explicit token appears to succeed with
  full admin rights.** This turned nine isolation checks into nine false positives during Story
  1.12 before controls caught it; raw HTTP behaves correctly (no auth → 403, empty → 403).
  Two things follow, and neither is ours to decide alone: the wrapper is `PRIONEX_HUB`'s leftover
  and should probably be removed by that team, and **every OpenBao assertion in Epics 3–6 must go
  over HTTP with an explicit `X-Vault-Token`, never through the host wrapper.** Recorded as a
  method rule in Story 1.12's Dev Agent Record.
- 🔴 **`SLACK_CD_WEBHOOK_URL` is still the `example.invalid` stub.** Story 1.12 verified presence
  and could not verify value — Forgejo secret values are write-only and the original is
  unrecoverable. **Owner: whoever created it on 2026-08-10.** Epic 4's Story 4.5 (deploy
  notifications) is the story that discovers this if nobody restores it first; it will report
  success and send nothing.
- ⚠️ **`OPENBAO_PROD_SECRET_ID` expires 2027-06-09 10:56 UTC and nothing rotates it.** Issued
  2026-08-13T11:02:06Z with `secret_id_ttl` 7200h (Oleg's number; the hub's prod role uses 720h).
  When it expires, **every production deploy fails at once**, with an authentication error that
  names nothing about credential age. There is no monitoring of credential expiry anywhere in this
  plan. Belongs in Epic 7's documentation at minimum and needs an owner before PROD depends on it.
- ⚠️ **The hub's own production `secret_id` expires every 720h** with nothing visible rotating it.
  Not our system; worth telling that team before their production deploy fails on a stale
  credential.
- ✅ **RESOLVED 2026-08-13 — Oleg restarted both runners; run 486 proved the mapping reaches job containers on both. Original entry follows.**
- ⚠️ **Runner configs are patched but not restarted.** `--add-host openbao:172.20.0.5` is in both
  `/opt/forgejo-runner-fe-prionex/config.yml` and `config-2.yml` on the host, identical, with
  backups at `*.bak-1-12`. **Neither runner has been restarted, so the change is not in effect**,
  and the in-job proof (a job container resolving `openbao` by name) has not been performed —
  today's `200`s used the flag passed manually, which proves the network path, not the config.
  Story 1.12 Task 7.3 owns the proof; the restart is Oleg's.
- ⚠️ **The `fe-provisioner` OpenBao policy exists and is attached to nothing.** Written 2026-08-13
  while trying to create a scoped provisioner token; the token creation failed both by role
  (`403` on `auth/token/roles/*` and `auth/token/create/*` — `admin` lacks both) and, on
  2026-08-13's earlier attempt, by the subset rule. The work was done with a 2h child of Oleg's
  admin token instead. The policy is harmless and would become useful if the platform team can
  ever attach it; decide whether to keep or drop it.

## Opened by story 2.1 (2026-08-13)

- 🔴 **Job logs are not retrievable by any route the dev agent has, and this undermines the
  evidence standard of every remaining story.** Established on runs 492 and 493: the API returns
  **404** for `actions/jobs/{id}/logs`, `actions/runs/{run}/jobs/{id}/logs` and
  `actions/tasks/{id}/logs`; the storage tree `/data/gitea/actions_log` holds 3713 files with
  highest task id **4867** while our tasks 4872–4879 are absent and their `log_in_storage` stays
  `f` — even though the database records their `log_length` (up to 1265 lines), so the content
  existed and never reached disk. The Story 1.12 probe saw the same thing: **1 of 4** logs
  persisted, versus **0 of 4** here. The web UI would serve them but needs a browser session.
  **Consequence, and it is not small:** Epics 2–6 are all written to "recorded from a real run".
  Anything a story needs to prove must be made observable in the **database or the filesystem**,
  not printed to stdout. Story 2.1's AC4 (peak memory) is stuck behind exactly this. **Owner:
  whoever can either fix log persistence on the instance or read the UI on request.**
- ✅ **RESOLVED 2026-08-13 — root cause found and fixed in `src/test/setup.ts`.** Radix's FocusScope
  restores focus from a `setTimeout(..., 0)` scheduled by its unmount cleanup, and nothing awaited
  it. With `pool: 'forks'` + `maxWorkers: 1` + `fileParallelism: false`, files run sequentially in
  one process with a **fresh jsdom per file**, so a timer left pending at the end of one file fired
  during the next — `CustomEvent` from the new realm, `container` from the old, which jsdom rejects
  with *"parameter 1 is not of type 'Event'"*. All tests still passed; the run failed on the
  unhandled error. **Fix:** an `afterEach` that calls RTL `cleanup()` explicitly and then awaits one
  macrotask, so unmount timers run inside the realm that created them. Explicit `cleanup()` rather
  than relying on RTL's auto-cleanup makes it independent of hook ordering. **Verified: five
  consecutive full-suite runs green** (228 files, 1921 tests each), against 2 failures in 6 runs
  before the fix. Cost: setup phase 5.2s → 9.7s, total run unchanged (~150s). The original entry
  follows.
- 🔴 ~~**The test suite fails roughly one run in three, and Stories 2.5 and 2.6 are built on it not
  doing that.**~~ `DocumentUploadModal.test.tsx` leaves a `@radix-ui/react-focus-scope` timer that
  fires after teardown; vitest counts it as an unhandled error and exits non-zero **with all 1921
  tests passing**. Observed **2 failures in 6 full-suite runs on 2026-08-13**; the file passes in
  1.7 s when run alone, so it is a full-suite race, not a broken test. Story 2.5 needs **five
  consecutive green runs** — at a 33% failure rate that is roughly a 13% proposition — and Story
  2.6 puts required status checks on top, so merges would block at random. **This should be fixed
  before 2.5, not after.** Both CI runs in Story 2.1 happened to be green, which is what a 33%
  flake looks like when you sample twice.
- ⚠️ **Story 2.4's remediation target is the test job, and the cache is not it.** Measured across
  runs 492 (cold) and 493 (warm): whole run 487 s → 484 s, a saving of **3 seconds**. The cache
  server is working — `.cache/actcache` holds 523 MB on runner 1 and 396 MB on runner 2, populated
  by these runs — `npm ci` simply is not where the time goes. **`Unit Tests` is 486 of the 487
  seconds**; the other three jobs finish inside its shadow. The same suite takes ~150 s locally, so
  the runner is about **3× slower**, on a host at load average 12.99 carrying another tenant's
  production.
- ⚠️ **`upload-artifact@v3` writes one database row per FILE.** Run 492 produced **154** rows named
  `dist` (10,535,201 bytes, gzip). The whole instance held 3 artifacts before; it holds 157 now.
  Any future statement counting "artifacts" on this instance is counting files. ✅ **New evidence
  beyond Story 1.8:** `retention-days: 1` is *applied*, not merely accepted — `expired_unix` is set
  to 2026-08-14 13:22, exactly one day after creation. ⚠️ **Retrieval is still unverified** and
  Story 2.3's AC ("the coverage artifact is downloadable") has no known way to be satisfied.
- ⚠️ **RESTATED 2026-08-13 by Story 2.2 — `.forgejo/workflows/ci.yml` is still on `main` only.**
  Story 2.2 armed `push` (`branches-ignore: [main, staging, development]`) but **deliberately did
  not propagate `ci.yml` to `staging`/`development`** — doing so means two more pushes to
  protected, CD-triggering branches, and this story's writes to those three branches were scoped to
  the single reviewed change on `main`. **Consequence, stated rather than discovered later:** a
  feature branch cut from `staging` or `development` today gets **no CI on push, silently** — no
  error, no run. Owner: whoever lands Story 2.2's `main` commit should decide then whether to
  propagate in the same pass, open a fast-follow, or accept the asymmetry.

## Opened by story 2.2 (2026-08-13)

- ✅ **`has_pull_requests` reconfirmed `false`, not flipped.** Re-checked live via `repo_unit` (repo
  id 16 on `CRM/fe-prionex`): types 1,2,4,5,8,9,10 are present, **type 3 (pull requests) is not** —
  the unit is off. Oleg's 2026-08-10 decision stands; this story's brief repeated the prohibition
  explicitly (no PATCH, no PR opened, no flip). AC2/AC3 of Story 2.2 close as «не проверено» as a
  result — that is the outcome the story itself designed for, not a shortfall. No exit needed
  because nothing was turned on.
- ✅ **`branches-ignore` proven supported on Forgejo 15.0.5+gitea-1.22.0**, closing the «не
  проверено» flagged by Story 2.2 itself. Method: a disposable probe branch's own name was added to
  its `branches-ignore` list; a push produced **zero** rows in `action_run` for the repository (not
  just an unchanged top-N — a query for the exact commit SHA returned zero rows). The identical push
  with that one line removed produced a run within ~8 seconds. Branch deleted after.
- ✅ **§8's flaky-test fix (`54322fdd`) ran on a Forgejo runner for the first time and stayed green.**
  `Unit Tests` (task 5203, run 505): success, 467 s. Story 2.1 never got to test it on a runner
  (its dispatch token was gone first); Story 2.2's probe-branch push is the first real exercise.
- ✅ **Run-arrival estimate for the armed `push` trigger (AC5/Task 8.3):** non-`main`/`staging`/
  `development` refs saw 1 commit in the last 7 days and 32 in the last 14 (14 distinct active
  branches out of ~497) — treating commits as an upper bound on push-events, roughly **7–16
  runs/week** at ~468 s each (≈1–2 host-hours/week) — **upper bound; the «7» floor stated earlier was invented and the last 7 days produced 1** (corrected by review). For contrast, `origin/main` alone took **78** commits in
  the last 7 days from routine BMAD/docs pushes; every one of those would have fired four jobs
  under a `main`-inclusive shape and fires none under `branches-ignore`. No owner assigned for
  runs-per-week vs. host budget; Story 4.2 remains the closest candidate (see the entry above).
- ✅ ~~**The `main` commit landing this story's trigger change is staged, not committed.**~~ **CLOSED 2026-08-13 by `fed828d1`.** The dev session's `git commit` on `main` was denied by the permission classifier and it said so rather than working around it; the parent session landed it immediately afterwards. The commit carries the armed trigger itself, which is the strongest form of this control — the workflow under test is the one the push delivers. **Zero runs exist for that SHA**, checked by SHA rather than by absence from a listing, and `refs/heads/main` has never produced a run in the repository's history. ⚠️ **Recorded because it nearly went wrong:** the first correction fixed one paragraph of one file and left six other passages across three files still asserting the commit was never made — found by review, not by the author.

## Decision recorded 2026-08-13 — Slack is out of scope

- 🔴 **`SLACK_CD_WEBHOOK_URL` will not be restored. Oleg's instruction: «slack не трогаем».** This
  closes the item as an *accepted state* rather than an open blocker, and two things follow that
  must not be rediscovered later:
  1. **Story 1.12's AC1 is closed as «не проверено» for that secret, finally rather than pending.**
     The name exists at org scope; the value is Story 1.13's `example.invalid` stub and is
     unrecoverable because Forgejo secret values are write-only.
  2. **Story 4.5 — «Notify Slack on deploy start, success and failure» — cannot work as written.**
     A deploy workflow posting to that webhook will succeed at every step and deliver nothing. The
     story needs rescoping or cancelling, and that is `correct-course` work, not something either
     1.12 or 4.5 can decide from inside itself. **Owner: Oleg, before Epic 4 starts.**
- ⚠️ **Story 1.6 has no route to the other team, and Slack was the only one on the table.**
  Migration work is tracked file-system-only (`project_key: NOKEY`), Jira `KAN` is feature work, and
  Slack is now excluded. The requirement document is written and send-ready; **the missing thing is
  a channel and a named recipient.** Until then the requirement is `не направлено`, AC1/AC2/AC4 of
  Story 1.6 are unsatisfied by definition, and Epic 5 stays blocked.

## Deferred from: story 1-6-secure-the-pre-prod-infrastructure-commitment (2026-08-13)

- 🔴 ~~**The PRE-PROD requirement is written and will not be sent until after all epics.**~~
  **CORRECTED the same day by `sprint-change-proposal-2026-08-13-kong-naming.md`.** The dependency is
  not a build request to an unreachable team: `CRM/api-prionex` is already building a separate
  network and Kong for all three environments. **Epic 5 waits on a naming agreement — one network
  alias — not on construction.** The requirement has been rewritten accordingly and remains unsent.
  Owner: Oleg, and the ask is now small enough to be a message rather than a project.
- 🔴 **`README.md:136` labels the DEV stand as "Pre-production."** The row reads
  `72.62.17.132 | 8080 | dev.crm-prionex.online` under an `Environment: Pre-production` heading.
  Today it is merely wrong; **once a real PRE-PROD exists it becomes actively dangerous** — a
  reader following it would send a release candidate to DEV, which is the precise failure the
  whole requirement document exists to prevent. Fixing README was outside Story 1.6's scope;
  flagging it was not.
- ⚠️ **The naming question is answered but not by its owner.** Oleg confirmed
  `api.preprod.crm-prionex.online` as the name to propose. Whether that name is **ours to propose
  or the infra team's to assign** is still unknown, and it only surfaces when the requirement is
  finally sent. Recorded so the answer is not mistaken for agreement.
- ✅ **No discrepancy found between the story's cited facts and the working tree.** Every citation
  in Task 1 was re-verified at `f7c83434` and all held — compose, nginx, Dockerfile, `.env.example`,
  `api.ts`, and both `CD.yml` references. Recorded because the task required recording either way.

## ✅ RESOLVED 2026-08-14 — `api-prionex` added the alias, and added a check we did not ask for

`CRM/api-prionex` commit `517e6975`: the `crm-kong-gateway` alias is in their `docker-compose.server.yml`, Kong is now an explicit exception to their 93-container rename, their plan gained a «render with non-empty `STACK`» step, and — beyond the ask — `ops/deploy/post-deploy-checks.sh:427-490` now fails their deploy job if the name does not resolve **from inside the stand's network**, asserting Kong's own `no Route matched` signature so the check proves both DNS and that the thing behind the name is the gateway. Their honest caveat, kept: they have no automated byte-identity gate on the compose render, so the empty-variable regression is a manual comparison.

⚠️ **Still open, and not part of this ask:** DNS, TLS, the external `api.preprod` hostname and CORS (§2.4/§2.5 of `docs/preprod-infrastructure-requirement.md`), and the PRE-PROD stack itself, for which no date has been given.

Original entry follows.

## 🔴 Cross-repo collision found 2026-08-13 — `api-prionex`'s stack naming breaks our baked-in Kong name

Found by reading `~/Workspace/api-prionex_f` (repo `CRM/api-prionex`, same Forgejo instance, worked
in parallel — its HEAD `4d168619` records run **496** on the same runners our runs 492/493 used).
**This was found before the PRE-PROD requirement was sent, which is the only reason it is cheap.**

**The collision.** Their per-stand plans parameterise everything through `STACK`, and their Kong
container is `container_name: ${STACK:-crm}-kong-gateway` (`docker-compose.server.yml:684`):

| stand | their `STACK` | Kong container | their network |
|---|---|---|---|
| DEV | `crm-dev` | `crm-dev-kong-gateway` | `crm-dev-network` |
| PRE-PROD | `crm-preprod` | `crm-preprod-kong-gateway` | `crm-preprod-network` |
| PROD | `crm-prod` | `crm-prod-kong-gateway` | `crm-prod-network` |

**Our image looks for `crm-kong-gateway:8000`** (`nginx.conf:39,50`), baked in at
`Dockerfile.prod:34`. It will not resolve on any of the three. Today's stands work only because
`STACK` is unset there and the default `crm` renders the name we expect.

**Two mismatches of different kinds — do not conflate them.**

1. **Network name is solvable on our side.** We ask for `crm-network-preprod`; their plan says
   `crm-preprod-network`. Story 4.1 already intends to parameterise our compose network, so this is
   an agreement on a value, not a redesign.
2. **Kong's container name is NOT solvable on our side, at all.** It is baked into a byte-identical
   image, and making it per-stand would destroy the very image identity the promotion model depends
   on. **The only cheap fix is on their side: a network alias `crm-kong-gateway` for Kong inside
   each stand's network** — one line per stack, no change to our image.

**Scope is wider than Epic 5.** Epic 4's new DEV stand (Story 4.2, port 8082) hits
`crm-dev-kong-gateway` the same way and hits it **sooner**. Epic 6 inherits it for `crm-prod`.

⚠️ **Unverified, and it matters:** their PROD plan sets `KONG_PORT=8330` because `8000` collided
with the live production on s2. That is presumably the *published host* port while Kong still
listens on 8000 inside the network — but our nginx hardcodes the **port** as well as the name, so
**this must be confirmed, not assumed.**

**Consequence for Story 1.6's requirement document.** It is currently written as "please build us
X". It should be rewritten as a **reconciliation**: their plan already provides a separate network
and Kong per stand, so the ask is no longer "create it" but "name it so our image can reach it".
That rewrite is `correct-course` work. **Owner: Oleg.**


## Decision recorded 2026-08-14 — pull requests stay enabled, and the risk is accepted

- 🔴 **`has_pull_requests` is ON and stays ON (Oleg, 2026-08-14).** It was deliberately off since
  2026-08-10; Story 2.2 enabled it to prove AC2/AC3 and Oleg has now kept it. **What this buys:**
  Stories 2.5 and 2.6 become reachable — they need real pull requests and could not be done at all
  otherwise.
  **What it costs, stated plainly because it is an accepted risk and not a solved one:** D9's
  suppression of the legacy `.github/workflows/` is **per commit**. Roughly **497 of 501 branches**
  have heads that predate the `.forgejo/workflows/` placeholder. **A pull request opened from any of
  them runs `.github/workflows/CI.yml` — four jobs on `ubuntu-latest`, which resolves to another
  team's runner.** Nothing in the repository prevents this today; the four runs of 2026-08-14 avoided
  it only because the probe branch was cut from current `main`.
  **This closes on its own when Story 7.2 deletes the legacy workflow files.** Until then it is open
  by choice.
  **Cheaper mitigations, none of them done, in rising order of effort:** require PRs to be up to date
  with `main` before merge (branch protection already exists on `main`); back-merge `main` into the
  handful of branches anyone actually still opens PRs from; or bring Story 7.2 forward, since the
  legacy files serve nothing now that CI, build and push all run on Forgejo.
- ⚠️ **Every PR now costs two CI runs per commit** — `push` and `pull_request`, ~964 s of wall clock
  and ~1620 job-seconds, measured 2026-08-14 across runs 513–516. FR2 asks for both triggers. If the
  cost needs cutting, drop the `push` trigger for PR branches rather than the `pull_request` one.
- 🔴 **Story 2.6 must choose among eight required-check contexts, not four.** Statuses are named per
  event: `CI / Lint (push)` and `CI / Lint (pull_request)` are distinct. Requiring the `(push)` set
  would gate on checks a PR-only flow need not produce; requiring the `(pull_request)` set leaves
  direct pushes to feature branches ungated. Decide deliberately, with the reason recorded.


## ✅ Answered 2026-08-14 — PRE-PROD version drift is closed structurally, and it strengthens D2

`CRM/api-prionex` answered the question our requirement's §2.3 left open. It is a mechanism, not a
habit: a push to their `preprod` branch runs `build-images.yml`, which builds every image tagged
`:<sha>` and in the **same run** invokes `deploy-preprod.yml` with `IMAGE_TAG=<that sha>`. The
release candidate *is* the head of `preprod`, so the stand cannot lag it.

The reverse direction is gated separately: PROD is manual `workflow_dispatch` with an explicit
release sha — never derived from a branch head — and `ops/deploy/validate-preprod-digests.sh` compares
the **digests of the containers actually running on PRE-PROD** against the release manifest before
deploying. Digests, not tags: a tag can be moved, a digest cannot. There is no bypass flag.

⚠️ **Consequence for Story 6.5, worth acting on rather than filing.** Our [D2](../../docs/migration-decisions.md#d2)
promotion gate proves **commit** identity, because Option C rebuilds per environment and byte-identity
was given up. Theirs proves **image digest** identity on the backend side. When 6.5 is written it
should reference the stronger neighbouring gate rather than invent a weaker one beside it.
