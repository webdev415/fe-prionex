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
  is respected.
  🔴 **CORRECTED 2026-08-20 (Story 4.2 code review, finding H2) — the line below was false.** ~~Its
  value never entered any transcript.~~ It did: Story 4.2's Completion Note 9 discloses that a
  ledger query sent `FJ_TOKEN=<value>` as the bearer token, Forgejo answered `401`, and the presented
  string was echoed back into that response — the value of `fe_review_1_7` entered that session's
  transcript. Not printed deliberately, and no file in this repository holds it, but the "never
  enters a transcript" guarantee this entry made is not true and was not narrowed until Story 4.2's
  own review caught the contradiction between the two records.
  **Owner: Oleg. Revocation, decided 2026-08-20:** `fe_review_1_7` — the token that was actually
  exposed — will be revoked by Oleg personally (**pending**, not yet executed as of this entry).
  `fe_tmp_1_7` and `fe_pkg_3_6` are **not** part of this revocation — both remain standing, by
  design, per this project's own standing token model (an admin cannot revoke another account's
  token without its password or a DB row, so standing tokens are a deliberate operating choice, not
  an oversight). The earlier framing here — *"both `fe_tmp_1_7` and `fe_review_1_7` should be
  revoked together"* — is superseded by this decision and should not be read as still operative.
  Whether `fe_tmp_1_7` is still live was not checked during the Story 1.7 review: «не проверено», and
  that remains unchanged — it stays standing regardless of liveness, by the decision above.
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
  resource-budget confirmation before the DEV (`:8082`) and PRE-PROD (`:8083`) stands land there too.
  ✅ **Closed 2026-08-19 by Story 4.2, with numbers.** s1: 125 GiB RAM (44 used, **80 available**, 12
  free — the column is named on purpose: Story 2.4 recorded "~7.2 GiB free", and the gap is page
  cache, not a change in the host), 879 GB disk (305 used, 529 free, 37%), 104 cores, load
  20.97/8.98/7.25, 170 running containers. The stand's own ceiling is
  `deploy.resources.limits.memory: 256M`. The DEV stand is now up on `8082` and the budget was never
  the risk on this host — the risk was the one below, which nobody had measured.
  *(PRE-PROD corrected `8081` → `8083` by Story 4.1, Task 8.2. `8081` is taken on s1 — `docker-proxy`
  binds `127.0.0.1:8081` for `vm-cadvisor` — and FR25 was amended 2026-08-15 by
  `sprint-change-proposal-2026-08-15-preprod-reality.md`; this line contradicted `epics.md:225-226`,
  `:707` and `:1979`.*
  *🔴 **It was not the only stale one**, and the review round caught the claim that it was. Three more
  were carrying the pre-amendment number and are corrected in the same pass — all with an explicit
  amendment marker rather than a silent rewrite: `docs/preprod-infrastructure-requirement.md:114`
  (a table cell reading **8081** in bold), `:120-121` (a paragraph headed "порт 8081 — постоянная
  аллокация", which is the claim that was measured false) and `:237`; plus
  `docs/forgejo-migration.md:226` and `:353`. **`preprod-infrastructure-requirement.md` is the
  document written for Story 5.2**, so it was the worst place for the stale number to survive.
  `docs/migration-decisions.md:193` (D4's body) also says `8081` and is **deliberately left alone** —
  D-records are not rewritten retroactively; the amendment lives in the record that supersedes it.)*
- **Resolved 2026-08-11, once `FJ_TOKEN` arrived:** `s1-deploy-dev-preprod`'s `GITEA_RUNNER_LABELS`
  env carries four values (`deploy-dev-preprod,dev,preprod,deploy`), but `GET
  /orgs/CRM/actions/runners` confirms only **one** is actually registered server-side —
  `[deploy-dev-preprod]`, matching this story's original baseline exactly. Env and registered
  labels diverge here (expected — the env var only applies at first-run auto-registration, which
  this runner apparently didn't use either). No baseline correction needed; noted for anyone
  reading that container's compose file and assuming the env var is authoritative.
  🔴 **Corrected 2026-08-19 by Story 4.2, read from the runner's own `.runner` file on s1:** all
  **four** labels are registered — `deploy-dev-preprod`, `dev`, `preprod`, `deploy`, each
  `docker://deploy-base-dev-preprod:2026-08-07`, under runner name `s1-deploy-dev-preprod`. The API
  view that showed one was not the ground truth; `.runner` is (the same lesson D10 already recorded
  for the CI runner). Story 4.3 picks its `runs-on` from these four, not from one.
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
  ⚠️ ~~**`sha-a1b2c3d-prod` (id 1930) was NOT deleted** … It remains `keep_pattern`-protected
  (permanent) and open for whoever executes the deletion next.~~ ✅ **SWEPT 2026-08-15 by Story
  3.1's code review — it WAS deleted, later the same day, and this entry contradicted an entry in
  this very file 359 lines below.** Oleg gave explicit authorisation, the `DELETE` returned `204`,
  and a re-measurement on 2026-08-15 confirms `crm/fe-prionex` now holds exactly one version
  (`build-check-3-1`). The block by the tool-permission classifier was real and correctly respected;
  what failed is that the authorisation arrived, the deletion happened, and **four documents were
  left asserting the opposite** — this line, the Story 3.1 file in three places, and the
  `migration-decisions.md` changelog row. The classifier is not the finding. Not sweeping the record
  after the world changed is.
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
  🔴 **Falsified 2026-08-19 by Story 4.2, measured before any action.** s1's `docker login` was
  **gone**: `/root/.docker/config.json` = `{"auths":{}}`, 16 bytes, mtime **13 Aug 12:34** — *after*
  Story 1.10 closed on 12 Aug — and an anonymous pull returned `unauthorized`. `docs/migration-
  decisions.md` (D14, «Task 6 — очистка») carried the same claim and is amended in the same pass.
  **Who or what removed it is unknown, and is recorded as unknown rather than guessed** — the one
  hypothesis available ("1.10 logged out at the end") is ruled out by D14's own wording, which says
  the login was deliberately left. `fe_reg_1_10_ro`'s plaintext was not stored on the host and a
  Forgejo token's value is shown only at mint time, so it could not be reused. Whether id 99 is
  still live in the instance is **not** established by this story — only that s1 no longer holds it.
- 🔑 **`fe_reg_4_2_ro` (`robot-registry`, `read:package` only) minted 2026-08-19 by Story 4.2** and
  is now s1's pull credential. Minted with
  `docker exec -u git forgejo gitea admin user generate-access-token -u robot-registry -t fe_reg_4_2_ro --scopes read:package`
  (no account password needed). Value written to `/root/.fj_reg_4_2.token` on s1, mode `600`,
  root-owned, **never printed into any transcript**; `docker login` done from it, so
  `/root/.docker/config.json` now holds `git.crm-prionex.com`. **Scope proven by refusal, not by
  declaration:** a `docker push` of the same image under a probe tag returned `401 Unauthorized` on
  `PUT /v2/crm/fe-prionex/manifests/s1-scope-probe-4-2`, and the probe tag does not exist in the
  registry (`404`).
  ⚠️ **Standing by construction, recorded at mint time as the rule requires.** It is a token *of*
  `robot-registry`, so per the entry below an admin cannot revoke it through any UI or API path
  without that account's password — the routes are a DB row or the password.
  **Owner: Oleg. Revocation trigger:** revoke when s1 no longer pulls from the registry, or
  immediately if it is replaced — and replace s1's `docker login` in the same action, which is
  exactly the step whose omission produced the falsified entry above.
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

  ✅ **SETTLED 2026-08-15 by Story 3.1's code review — the prediction held.** The query was run after
  the 2026-08-15 00:00 sweep and returns **one row**:

  ```
  2496|build-check-3-1|f
  ```

  Rows 1926 and 1927 are gone, and so is the internal `_upload` row 2495 — which nothing predicted,
  but which is consistent with the same mechanism and closes the "were `_upload` rows removed by the
  rule or by the expired-upload step" question in favour of the sweep. **FR11's withdrawal stands,
  now on a prediction that could have failed rather than on an inference.** Nobody was scheduled to
  run this check; it was due the day the review happened to look, which is luck, not process. The
  general lesson is worth more than the result: *a falsifiable prediction with no owner and no date
  in anyone's queue is a coin flip on whether the plan stays correct.*
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
  `f` 🔴 **— FALSE AS OF 2026-08-16, and it was a timing artefact rather than a fact. All eight of
  those rows are `log_in_storage = t` today with files on disk. Persistence on this instance is
  DELAYED, not absent; Story 2.1 sampled within minutes of the run. See the entry opened by Story
  3.3. This sentence stood for three days and shaped four stories' evidence strategies** — — even though the database records their `log_length` (up to 1265 lines), so the content
  existed and never reached disk. The Story 1.12 probe saw the same thing: **1 of 4** logs
  persisted, versus **0 of 4** here. The web UI would serve them but needs a browser session.
  **Consequence, and it is not small:** Epics 2–6 are all written to "recorded from a real run".
  Anything a story needs to prove must be made observable in the **database or the filesystem**,
  not printed to stdout. ~~Story 2.1's AC4 (peak memory) is stuck behind exactly this.~~ ✅ **AC4 was
  closed 2026-08-14 at 2163 MB** — by applying the rule in the previous sentence rather than by
  fixing log retrieval: Story 2.4 put the figure into `action_artifact.artifact_name`, where one SQL
  query returns it. The diagnosis in this entry stands and is still unowned; only the "stuck"
  conclusion was wrong. **Owner: whoever can either fix log persistence on the instance or read the
  UI on request.**
  ⚠️ **Identifier caveat, added 2026-08-15 by Story 2.1's code review.** Every run number in this
  section — 492, 493, and the task ids 4872–4879 — is a **global `action_run.id` / `action_task.id`
  row id**, not the per-repository `index` that the web route `/CRM/fe-prionex/actions/runs/{index}`
  takes. Story 2.1 closed by asking a human to "read run 492 in the web UI", which as written points
  at a URL that does not resolve. Story 2.4 hit the same trap (querying by `index` returned 0 rows)
  and Story 2.3's review hit its own version of it. **Quote both numbers, or say which one you
  mean.**
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
  🔴 **Two corrections from Story 2.1's code review (2026-08-15), kept because the failure mode is
  more useful than the fact.** (1) **It was not opened by Story 2.1.** Story 1.9 had already
  recorded the identical Radix `focus-scope` failure in `DocumentUploadModal.test.tsx` and hit it
  twice; filing it here as newly discovered discarded prior observations that would have doubled the
  sample. (2) **"33%" is a same-day n=6 figure and was propagated as a hard rate** — into a
  quantitative prediction for Story 2.5, and verbatim into the changelog row in
  `docs/migration-decisions.md`. The confidence interval on 2 of 6 runs spans roughly 4%–78%. The
  bug was real and the fix was right; the arithmetic dressed a guess as a measurement.
- ⚠️ **Story 2.4's remediation target is the test job, and the cache is not it.** Measured across
  runs 492 (cold) and 493 (warm): whole run 487 s → 484 s, a saving of **3 seconds**. ~~The cache
  server is working — `.cache/actcache` holds 523 MB on runner 1 and 396 MB on runner 2, populated
  by these runs — `npm ci` simply is not where the time goes.~~ 🔴 **Swept 2026-08-15 by Story 2.1's
  code review: that sentence proves a save, not a restore.** Directory growth shows the cache server
  accepted writes; whether `setup-node` ever *restored* from it is the question Story 2.1's Task 5.3
  actually asked, and a 0.6% delta is as consistent with "no restore, and `npm ci` is cheap" as with
  "restore happened". The record was readable all along — per-entry `usedAt` in
  `.cache/actcache/bolt.db`, found later by Story 2.4, which named its own version of this
  over-generalisation its biggest error. The conclusion below stands on the durations alone and does
  not need the cache claim. **`Unit Tests` is 486 of the 487
  seconds**; the other three jobs finish inside its shadow. The same suite takes ~150 s locally, so
  the runner is about **3× slower**, on a host at load average 12.99 carrying another tenant's
  production.
- ⚠️ **`upload-artifact@v3` writes one database row per FILE.** Run 492 produced **154** rows named
  `dist` (10,535,201 bytes, gzip). The whole instance held 3 artifacts before; it holds 157 now.
  Any future statement counting "artifacts" on this instance is counting files. ✅ **New evidence
  beyond Story 1.8:** `retention-days: 1` is *applied*, not merely accepted — `expired_unix` is set
  to 2026-08-14 13:22, exactly one day after creation. ⚠️ ~~**Retrieval is still unverified** and
  Story 2.3's AC ("the coverage artifact is downloadable") has no known way to be satisfied.~~
  ✅ **SUPERSEDED 2026-08-14 — see the SETTLED entry below.** There is no artifacts *API*, but the
  web route exists and is session-gated, so the AC is satisfiable by a developer and not by an
  agent. This line said the opposite and was left unswept; caught by Story 2.3's review.
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
  🔴 ~~**This closes on its own when Story 7.2 deletes the legacy workflow files.**~~ **THAT WAS
  WRONG, withdrawn 2026-08-14 by the author of the line.** Forgejo resolves the workflow directory
  **at the commit being run** — run 514's ref is `refs/pull/2/head` and its `commit_sha` is the PR
  head — so a pull request from an old branch executes **that commit's** `.github/workflows/`.
  Deleting the files on `main` does not touch the ~497 branch heads that already carry them.
  Story 7.2 closes this **only for branches cut or brought up to date after the deletion**, which is
  a far weaker statement, and the proposal to bring 7.2 forward on this basis is withdrawn with it.
  **The mitigations that do work, none free:** require PRs to be up to date with `main` before merge
  (branch protection on `main` already exists); back-merge `main` into the branches anyone actually
  opens PRs from; or accept the exposure, which is the current state. Until then it is open
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


## Correct-course 2026-08-14 — what it changed, and one thing it could not settle

- ⚠️ **Story 4.5 is kept and resequenced to LAST (Oleg).** Its channel does not exist: the webhook is
  Story 1.13's unrecoverable stub and a **new incoming webhook must be created in Slack** before any
  of its ACs can pass. **Owner: Oleg**, and it is the only thing standing between the plan and a
  capability the team has today — `CD.yml:125-263` sends three notifications on GitHub right now,
  with its own live secret. Shipping without them is a deliberate, temporary regression.
  🚨 **The rule it imposes, recorded because four stories depend on it:** *the deploy must work
  without it.* Stories 4.3, 4.8, 5.3 and 6.4 are written, proven and closed with **no** notification
  step; 4.5 adds the step to all of them afterwards. No deploy story may block on the channel.
- ✅ **SETTLED 2026-08-14 by measurement — and the answer is neither of the two guesses.** With a
  token: `/api/v1/repos/CRM/fe-prionex/actions/artifacts` → **404**. **There is no artifacts API**,
  so the original Story 1.8 claim stands and my `403`-is-not-`404` reasoning was wrong — the `403`
  was the generic refusal for an unauthenticated call, and the router tells the truth only once you
  authenticate. **But the web download route is real:**
  `/CRM/fe-prionex/actions/runs/{index}/artifacts/{name}` **exists and is session-gated** — it redirects an API token to `/user/login`.
  ⚠️ **Stated precisely, because the first wording overclaimed:** a redirect proves the route
  exists and wants a browser session; it does **not** prove the file comes out the other side.
  That remains the unverified click.
  **Therefore, precisely:** a *developer* can download the artifact from the run page; an *agent*
  cannot. Story 2.3's AC says *"a developer opens the run page … the coverage artifact is
  downloadable"* — **that AC is satisfiable as written**, and its verification is a thirty-second
  human click, the same shape as Story 2.1's unread peak-memory line. What is NOT available is any
  programmatic retrieval, so nothing downstream may be built on fetching an artifact from CI.
  ⚠️ Original entry follows, kept because the reasoning error in it is instructive.
- 🔬 **Story 2.3's blocker is unproven and may be phantom.** The standing claim «there is no
  Actions-artifacts API on this instance» was inferred from `404` on **quota** endpoints. Measured
  2026-08-14 unauthenticated: `/api/v1/repos/CRM/fe-prionex/actions/artifacts` → **403**, the web
  download route → **303**. Both routes exist. **One authenticated request against the 154 `dist`
  rows Story 2.1 already produced settles it** — needs a token, and the token's exit must be planned
  before it is minted.

## 🔴 Found while writing Story 2.3 (2026-08-14) — coverage has never worked, on either platform

- 🔴 **`npm run test:coverage` has never run, and Codecov has been receiving nothing for the life of
  the repository.** `@vitest/coverage-v8` is an *optional peer dependency* of `vitest@4.1.3`, is
  **absent from `package.json` devDependencies**, and is **absent from `node_modules/@vitest/`**.
  Reproduced directly: `npm run test:coverage` → `MISSING DEPENDENCY  Cannot find dependency
  '@vitest/coverage-v8'`, exit 1, **before a single test runs**. `npm ci` will never install it.
  **Why nobody noticed:** `CI.yml:70-72` runs it with `continue-on-error: true`, and the Codecov step
  at `:74-78` uploads a `coverage-final.json` that was never produced, with `fail_ci_if_error: false`.
  Two independent silencers in series. `git log -S'coverage-v8' -- package.json` finds no commit that
  ever added the dependency.
  **Consequences:** FR3 removes a step that was already a no-op — worth knowing before anyone checks
  the Codecov dashboard and concludes the migration broke it. And **Story 2.3's AC1 cannot be
  satisfied without a `package.json` change**, which makes it the first story in Epic 2 to touch an
  application dependency rather than only CI configuration.


## Handed to Story 2.4 by Story 2.3 (2026-08-14) — the coverage overhead, measured

- ⚠️ **Coverage costs +72–79 s of the critical path, and Story 2.4 owns the budget.** Run 522 with
  `--coverage`: `Unit Tests` **539 s**, whole run **540 s**. Baselines without it: 467 s (run 505),
  460 s (513), 460 s (515), whole runs 468/461/461. So **+15% against the 467 s endpoint and +17%
  against the 460 s floor** — quote the range, not the single figure. Locally the same change costs
  only ~9% (150 s → 164 s): V8 instrumentation is CPU-bound and s1 shares its cores with another
  tenant's production, so the runner pays roughly double what a laptop does.
  **The 15-minute budget still holds** — 540 s against 900 s, six minutes of margin — but Story 2.4
  should note that the margin shrank by a fifth in one story, and that `Unit Tests` remains 539 of
  the 540 seconds. The other three jobs finish inside its shadow and optimising them buys nothing.
- ⚠️ **`dist` is still uploaded unarchived: 154 artifact rows per run.** Story 2.3 archived
  `coverage` (780 files → 1 row, measured) but did not touch `dist`, which was outside its scope.
  Two runs per PR commit means ~308 rows per commit from `dist` alone. Whoever revisits Story 2.1's
  build job should apply the same treatment; the mechanism and the measurement are recorded here.

## Handed to Story 2.5 by Story 2.4 (2026-08-14) — the budget number, and what is still open

- ✅ **The budget number Story 2.5 needs (`epics.md:1214-1217`): the pipeline is comfortably inside
  15 minutes, three first-hand measurements in hand, not one.** Cold run **522**: 540 s. Push run
  **531** (peak-memory evidence, same lock file): 558 s. Warm run **534** (this story's one budgeted
  spend): **513 s against 900 s — 387 s (43%) of margin**. `Unit Tests` is 96–99.8% of the critical
  path on every run measured (492 through 534, nine runs total). The ±45 s spread across three runs
  on an unchanged pipeline is host-load noise (`load 11–17` on shared host s1), not a trend signal —
  keep that in mind if Story 2.5's "five consecutive green" pushes ever look surprisingly slow or
  fast; it is very likely the host, not the change under test.
- ⚠️ **The margin is shrinking and nothing watches it.** Story 2.3's coverage instrumentation cost
  +72–79 s (a fifth of the margin) in one story (`2-3-…md:634-637`). No mechanism in `ci.yml` or
  elsewhere flags a budget regression before it lands — it would need someone to notice by eye.
  Three more changes that size and the 900 s budget is gone. Whether Story 2.6 (required checks)
  should own an automated threshold is an open question for whoever plans it, not decided here.
- ✅ **Cache-hit evidence IS available on this instance, and the route is worth knowing before anyone
  spends a day rediscovering it.** ⚠️ **Correction:** the first version of this entry declared a hard
  evidence ceiling and told future stories to expect it. That was wrong and was caught in review of
  Story 2.4 the same day.
  - **What is genuinely absent:** the `Cache restored from key: …` line described in
    `1-7:634-648`. It does not appear in the runner container log for real, server-dispatched CI
    jobs — confirmed absent across runs 492, 505, 522, 531, 534, and present only in Story 1.9's
    2026-08-11 probe-workflow runs. Real jobs emit nothing between `task NNNN repo is …` and
    `Cleaning up network for job X`.
  - 🔑 **What works instead:**
    `/opt/forgejo-runner-fe-prionex/data/runner{,-2}/.cache/actcache/bolt.db` stores **plain JSON
    records**, one per cache entry, with `key`, `size`, `createdAt`, `usedAt` and `complete`.
    **`usedAt` is a direct per-entry record of a restore hit** and is what closed Story 2.4's AC2
    (run 534's restore: `usedAt` 15:31:17 on runner 19 and 15:31:18 on runner 20, against a run start
    of 15:31:05). Read it read-only; do not write to it.
  - ⚠️ **Two traps in reading it.** (1) The actcache GC keeps the **newest** entry per (key, version)
    and deletes superseded siblings — a `deleted cache: &{…Key:X…}` line does **not** mean key X is
    gone. Story 2.4 nearly reached the opposite conclusion from exactly this. (2) **A save carries no
    hit/miss information here.** This instance's cache proxy saves on every completed job regardless
    of restore outcome, unlike stock `actions/cache`, which skips the save on an exact primary-key
    hit. A proven miss (run 522) and two proven hits (531, 534) produce byte-for-byte the same
    four-save signature.
  - 🔴 **The method lesson, which is the part that generalises:** this is the **second** occurrence of
    the failure at `:548-551` — "route A does not work" generalised into "no evidence exists", while
    the answer sat in a readable file. First time it cost eight hours on `docker logs`; this time it
    cost an AC closed on inference instead of proof. **When one evidence route is confirmed dead, the
    next step is to enumerate the others, not to record a ceiling.**
- ⚠️ **`force_pull: true`'s cost remains «не проверено» — and this one should be re-attempted, not
  treated as closed.** The `docker pull … forcePull=true` line exists in the runner log format
  (confirmed, Story 1.9 probe runs) but never appears for a real CI job. Story 2.4 concluded it
  unanswerable **by the same over-generalisation corrected above**, and nobody checked the obvious
  alternative route: image mtimes / `docker images` inside `dind` and `dind2`. Not worth a story on
  its own while the budget has margin (§7 of Story 2.4), but do not inherit "unanswerable" from it.
- ℹ️ **Peak memory closed:** `Unit Tests` peaked at **2163 MB** against the 16384 MB ceiling
  (13.2%) on run 531 — Story 2.1's AC4, open since 2026-08-11, is now answered. Story 2.1's doubling
  of the heap ceiling (8192→16384 MB) was confirmed precautionary rather than corrective: even the
  original 8192 MB ceiling would have had ~~62%~~ **~74%** headroom over the measured peak
  *(arithmetic corrected 2026-08-15 by Story 2.1's code review: (8192−2163)/8192 = 73.6%)*.
  ⚠️ **What the 2163 MB actually measures, added by the same review.** `memory.peak` is the whole
  **job cgroup's** lifetime high-water mark, and the step reads it after checkout, `setup-node`,
  `npm ci` and the test run have all executed in that cgroup. Nothing resets it and nothing samples
  per-process. So 2163 MB is an upper bound on *everything the job did*, published under a label
  that reads as the test heap — which is the number the 8192/16384 argument is about, and not the
  number this is. Anyone sizing a stand from it (Epic 5) should treat it as a job ceiling, not a
  process measurement.
- ✅ **`probe/2-1-peak-memory` (commit `4fc90b78`) is merged.** ⚠️ **Superseding the first version of
  this entry, which recorded it as still outstanding** — Story 2.4 declined to merge it unilaterally
  (measurement story, not a scope to make a production-CI-behaviour call) and left it as an
  owner-assigned decision; **Oleg took it the same day and it fast-forwarded into `main`.** So the
  peak-memory-in-artifact-name step and the coverage-retention 1→7-day change are now live on `main`,
  not stranded on a probe branch. **The merge cost no CI run** — `main` is in `branches-ignore`
  (`ci.yml:40-44`) and no PR was open. `origin/probe/2-1-peak-memory` is deliberately left stale at
  `4fc90b78`: pushing it would fire a `push` run for commits already on `main`. Safe to delete; do
  not push it.

## Handed to Story 2.6 by Story 2.5 (2026-08-14) — the eight contexts, the budget verdict, and the 497-branch hazard restated

Story 2.5 ran the full sequence AC1 asks for: five real PRs (Forgejo indexes 3, 4, 5, 6, 7), opened
against `main`, each cut from current `main` HEAD, each merged before the next was cut, strictly
sequential. **Ten runs, ten green, zero resets, zero code-class exclusions, five first-attempt API
merges into protected `main`.** Full evidence (per-run durations, per-job runner assignment, the
taxonomy as declared, the deviation on "real" as stated) is in
`2-5-validate-ci-stability-across-five-consecutive-real-pull-requests.md`'s Dev Agent Record. What
follows is what Story 2.6 specifically needs, pulled forward so it does not have to be
reconstructed from a run of its own.

- 🔑 **The eight status-check contexts, verbatim, exactly as they read in `commit_status.context` —
  this is the free deliverable `epics.md:1217`/`:1236-1239` asked for.** Read off real rows across
  five head SHAs (`784d1cc9`, `fb1e7351`, `be0b5656`, `20c7b2c1`, `480df728`), not transcribed from
  job names. All eight reached terminal `success` state on all five SHAs — 40/40. The set was
  identical across every SHA; no SHA produced a context another did not.

  ```
  CI / Lint (push)
  CI / Type Check (push)
  CI / Unit Tests (push)
  CI / Build (push)
  CI / Lint (pull_request)
  CI / Type Check (pull_request)
  CI / Unit Tests (pull_request)
  CI / Build (pull_request)
  ```

  **This is the exact set of eight to require.** 🔴 **Corrected by the Story 2.5 review (2026-08-14):
  an earlier version of this hand-off said that marking only the four `(pull_request)` contexts was
  "a legitimate narrower choice." It is not — it is the one unsafe choice.** See the 497-branch item
  below: the legacy `.github/workflows/CI.yml` carries `name: CI` and job names `Lint`, `Type Check`,
  `Unit Tests`, `Build` — byte-identical to the Forgejo pipeline's — so it writes to **the same four
  `(pull_request)` context strings**. Those four therefore do not identify which pipeline ran. The
  four `(push)` contexts are what distinguish them, because a stale branch produces none at all.

  ⚠️ **`workflow_dispatch` is a third armed trigger but adds no ninth context** — verified against
  the live DB by the review: `ci.yml` runs 492 and 493 (`event = workflow_dispatch`) produced **zero**
  `commit_status` rows. Manually dispatched runs never write statuses, so the eight above are the
  complete gating set for this workflow. Story 2.6 does not need to spend a run to establish this.

  ⚠️ **Requiring all eight has one known false-negative, and 2.6 must decide it deliberately.** The
  `push` trigger carries `branches-ignore: [main, staging, development]`. A PR whose **head** branch
  is `staging` or `development` (a release-style PR) therefore never produces the four `(push)`
  contexts and can never satisfy an eight-context gate. Feature-branch PRs — the normal case — are
  unaffected. Choose consciously: eight contexts blocks stale-branch PRs *and* release PRs; four
  contexts blocks neither.

- ✅ **Budget verdict: all ten runs passed 900 s individually — closest was 567 s, 333 s (37%) of
  margin.** min 512 s, max 567 s, mean 539.2 s (mean reported for completeness only; the pass/fail
  gate is per-run). **Three runs — all `pull_request` runs (566 s, 567 s, 564 s) — landed 6–9 s above
  Story 2.4's 513–558 s baseline band.** Host load was *lower* than Story 2.4's baseline session
  (2.88–4.38 vs 11–17), so host contention does not explain it; the fitting explanation is the
  queuing effect below, not a new instability. Nothing here narrows Story 2.4's margin further — the
  budget is not eroding, but it also has not gained anything back.

- ✅ **The `push`/`pull_request` pairing is now a five-for-five confirmed effect, not a single
  observation.** Every PR's `pull_request` run ran slower than its `push` run on the identical
  commit, by 41–53 s (mean +46.8 s) — matching Story 2.2's original single-pair reading of ~45 s.
  **Mechanism — proven by the review, not inferred.** The `push` run's jobs claim the four job slots
  first; the `pull_request` run's jobs queue behind them and start as slots free up (both runners cap
  at 2 concurrent jobs — 4 slots total, `1-7:427`, `1-9:247`). The per-job `started` timestamps in
  `action_run_job` settle it: **`Unit Tests` — 96–99% of the critical path — starts 1 s after run
  start on every one of the five `push` runs, and 50–56 s after run start on every one of the five
  `pull_request` runs.** The whole +41…53 s delta is that slot wait; the `Unit Tests` job itself is
  actually marginally *faster* on the `pull_request` runs (505–511 s) than on the `push` runs
  (511–520 s). **This is queueing, not a slower pipeline** — it would shrink or vanish with more
  runner capacity, so do not treat +47 s as an intrinsic property of the `pull_request` event.

  ⚠️ **Correction to the §6 planning model, which this story's data falsifies.** §6 of Story 2.5
  states the two runs "do not overlap — they queue," and prices a PR at the **sum** of the two runs
  (~964 s). They do overlap: run 536 started 84 s after run 535 started and 431 s before it stopped.
  **Measured per-PR wall clock is 646–653 s (~11 min), not ~964 s (~16 min)** — 535→536: 650 s,
  537→538: 653 s, 539→540: 650 s, 541→542: 646 s, 543→544: 650 s. Whole session, run 535 `started` to
  run 544 `stopped`: **4685 s ≈ 78 min for five PRs.** Budget future stories at ~11 min of wall clock
  per PR, not ~16. Job-level queueing is real; run-level serialisation is not.

  It follows that **any required-check budget or SLA Story 2.6 sets should be measured against the
  `pull_request` context specifically**, since that is reliably the slower of the pair and is the one
  that gates the merge — but note the dependency: the delta exists *because* a paired `push` run
  takes the slots first. If that pairing ever changes, the SLA basis changes with it.

- 🔴 **The 497-branch legacy-fallback hazard, restated in Story 2.6's terms.** D9's suppression
  (`.forgejo/workflows/` stops the fallback to `.github/workflows/CI.yml`) resolves **at the commit
  being run, not at `main`** (`migration-decisions.md#d9`). 497 of 501 remote branches still carry a
  head commit that predates this suppression. **Consequence once Story 2.6 turns on required
  status checks:** a PR opened from one of those 497 branches will run the *legacy* workflow — on
  `ci-hub`, another team's runner.

  🔴 **Corrected by the Story 2.5 review (2026-08-14). The original text here said such a PR
  "will produce `commit_status` contexts that are **not** any of the eight `CI / …` strings above"
  and therefore "can never go green." That is false, and false in the dangerous direction.**

  **Evidence, first-hand from the live DB — the counter-example has been sitting there since
  2026-08-10.** `action_run` id **286**, `workflow_id = CI.yml` (the legacy file), `event =
  pull_request`, `ref = refs/pull/1/head` — Story 1.13's fallback probe. All four of its jobs
  executed on **`action_runner` id 10, name `ci-hub`**. The `commit_status` rows it wrote for SHA
  `6f641c1f` are:

  ```
  CI / Lint (pull_request)        success
  CI / Type Check (pull_request)  success
  CI / Unit Tests (pull_request)  failure
  CI / Build (pull_request)       failure
  ```

  Byte-identical to four of the eight above, because `.github/workflows/CI.yml` and
  `.forgejo/workflows/ci.yml` share `name: CI` and share all four job display names. Forgejo derives
  the context as `<workflow name> / <job name> (<event>)`, so **the context string cannot tell the
  two pipelines apart.** Two of those four legacy contexts went `success`.

  **The real hazard is therefore the opposite of what was written, and worse:**

  - Under a **four-context** `(pull_request)`-only gate, a stale-branch PR whose legacy `ci-hub` run
    happens to be green **satisfies the gate completely** — a false green, produced by a pipeline
    that never ran this repository's tests, on a runner Oleg has forbidden. The gate would not
    block; it would rubber-stamp.
  - Under an **eight-context** gate, the same PR produces no `(push)` contexts at all (its branch
    carries no `.forgejo/workflows/`, and the legacy `push` trigger is `branches: [main, staging,
    development]`, which a feature branch does not match — so nothing fires on the branch ref). The
    four `(push)` checks stay permanently absent and the PR is correctly blocked.

  **So: require all eight. That is what makes the gate mean anything.** The four `(push)` contexts
  are not decorative — they are the only part of the set a stale branch cannot forge.

  This was worked around procedurally for this story's five PRs (§3: every branch cut fresh from
  current `main`), which is sufficient for five PRs but does **not** close the underlying hazard —
  Story 2.2's Open Question 6 asked for an owner and still has none (`2-2-…md:841-843`). Whoever
  plans 2.6 should decide, explicitly, whether bulk remediation of the 497 branches is a
  precondition for turning required checks on, or whether it is an accepted rough edge with a
  documented workaround (e.g. a repo rule — outside Story 2.6's current scope — rejecting PRs from
  branches whose merge-base with `main` predates the D9 commit).

- ℹ️ **No Task 5.3 finding to hand forward** — the context count was exactly eight and the strings
  matched the expected `CI / {Lint,Type Check,Unit Tests,Build}` × `{push,pull_request}` form on
  every one of the five SHAs. Nothing to normalise. **The strings themselves were re-verified against
  the live `commit_status` rows by the Story 2.5 review** — but note that the strings being *correct*
  was never the risk; what they *guarantee* is, and that is the corrected 497-branch item above.

- ℹ️ **Runner job-assignment is not pinned to job type.** Across the ten runs, the 2/2 split between
  runners 19 and 20 was clean on every run (**40 job-slots total across the ten runs — 20 on runner
  19, 20 on runner 20**), but *which* runner drew {Lint, Type Check} vs {Unit Tests, Build} flipped
  starting at PR 4 of this story with no runner-config change (Prohibition 10 held throughout). Not
  actionable for Story 2.6, but worth knowing if a future story tries to reason about per-runner
  cache warmth by job type — that assumption does not hold.

- ⚠️ **Four limits on how far this evidence reaches. Story 2.6 should not over-read it.**
  1. **The merges prove less than they look like.** Five first-attempt API merges into `main`
     succeeded — but `main`'s rule is permissive (`required_approvals: 0`,
     `enable_push_whitelist: false`, `enable_status_check: false`, `apply_to_admins: false`) and the
     merging identity was `merger_id = 1`, an admin the rule exempts by construction. Nothing was
     bypassed because nothing was gating. This says nothing about post-2.6 merge behaviour.
  2. **`enable_push: true` with no whitelist means the PR gate is not the only way into `main`.**
     This story itself committed directly to `main` six times. Required status checks gate PR
     merges; they do not close the direct-push route. If 2.6's intent is "nothing reaches `main`
     ungated," required checks alone do not achieve it.
  3. **`pull_request` runs test `refs/pull/N/head` — the branch tip in isolation, not a merge
     preview against current `main`** (confirmed: `ref = refs/pull/N/head` on all five). With
     `block_on_outdated_branch: false`, a PR that was green against an older `main` stays green and
     merges into a `main` it was never tested against. 2.6 should decide whether to set
     `block_on_outdated_branch: true`.
  4. **All ten runs are warm-cache samples inside one 78-minute window at unusually low host load
     (2.88–4.38 vs Story 2.4's 11–17).** The cold-cache path — first run after a cache eviction or
     runner rebuild — was not measured here, and ten greens bound the flake rate only loosely. This
     is good evidence that the pipeline is stable; it is not proof that it cannot fail under a gate.

## Deferred from: code review of story-2.5 (2026-08-14)

- **§2's anti-padding guard is unreachable by construction — a create-story defect, not a dev
  defect.** §2 of Story 2.5 says "if the fifth PR has nothing honest to carry, **stop and say so**",
  but Task 2.2 defines PR N's content as PR N−1's CI evidence, so the supply is generated by the
  sequence being measured and the stop condition can never fire. Relatedly, the genuinely
  independent changes §2 named as candidate supply (`deferred-work.md` entries, the
  `migration-decisions.md` changelog row) were committed **direct to `main`** after PR 5, while the
  self-referential ones filled the five PRs — inverting §2's intent. The deviation the dev agent
  stated ("not a developer's feature work") is narrower than the one actually taken: four fifths of
  the PR supply was self-generated. §2 did explicitly authorise "this story file's own progress
  records" as supply, so the letter was met and the story is not being marked down for it.
  **Owner needed:** whoever writes the next story that has to manufacture its own PR supply should
  either name a supply that exists independently of the story, or drop the anti-padding guard as
  unenforceable rather than carry it as decoration.

- **The stability evidence is narrower than "ten green runs" sounds, and nothing here closes it.**
  All ten runs are **warm-cache** samples taken inside a single 78-minute window at unusually low
  host load (2.88–4.38 vs Story 2.4's 11–17). Consequences left open: (a) the **cold-cache** path —
  the first run after a cache eviction or runner rebuild — has never been measured against the 900 s
  budget; (b) ten consecutive greens bound the per-run failure probability only loosely, so this is
  good evidence of stability but not proof that the pipeline cannot fail under a merge gate;
  (c) Task 4.3 was required to check each run's `started` timestamp against host load and instead
  used one `uptime` taken before PR 1, so the "not host load" attribution is not falsifiable from
  the recorded data (the queueing mechanism has since been proven directly, which is what actually
  settles that question). **Closing any of these costs further CI runs on a shared host carrying
  another tenant's production; the Story 2.5 review deliberately did not spend them.** Story 2.6
  should treat the budget verdict as "stable under warm, lightly-loaded conditions", not as
  unconditional.

## Deferred from: story 2-6-enforce-required-status-checks-on-main (2026-08-14)

- 🔑 **The gate is live. `main`'s branch-protection rule now reads, verbatim:**
  ```json
  {
    "enable_status_check": true,
    "status_check_contexts": [
      "CI / Lint (push)", "CI / Type Check (push)", "CI / Unit Tests (push)", "CI / Build (push)",
      "CI / Lint (pull_request)", "CI / Type Check (pull_request)", "CI / Unit Tests (pull_request)", "CI / Build (pull_request)"
    ],
    "enable_push": false,
    "apply_to_admins": true
  }
  ```
  `required_approvals: 0`, whitelists off, `require_signed_commits: false` — all unchanged from
  Story 1.13's original rule. Rollback, if ever needed: `PATCH` the same route with
  `{"enable_status_check": false, "status_check_contexts": [], "enable_push": true,
  "apply_to_admins": false}` — a repository admin can always change branch-protection settings,
  because they are not themselves protected by `apply_to_admins`.

- ✅ **The missing-context semantic is now measured, not assumed: it blocks.** Story 2.5's review
  raised the eight-vs-four-context question from a database counterexample (`action_run` id 286);
  this story's AC5 closed the remaining unknown by temporarily requiring a ninth context that can
  never exist while a genuinely green PR sat open, and attempting the merge. **Result: refused**,
  identical `405` / "Not all required status checks successful" to an actual failing check. **This
  means the 497-branch hazard Story 2.5's review identified is now genuinely closed by the gate**,
  not merely argued to be closed: a stale branch carrying only the legacy `.github/workflows/CI.yml`
  produces zero `(push)` contexts, and zero is now provably a block. The hazard is not eliminated at
  the source (497 branches still have no owner — Story 2.2's Open Question 6, still unassigned) but
  it can no longer produce a falsely-green merge into `main` through the required-checks path.

- ⚠️ **Every commit to `main` now costs a pull request, and every PR costs two CI runs (~11 min
  normally).** Direct push is rejected server-side for every identity, including admins
  (`apply_to_admins: true`, confirmed against the project's own token — AC2). This was already true
  in practice for Story 2.5's five PRs but is now enforced rather than voluntary. Story 2.2's Open
  Question 7 ("who owns runs-per-day on a shared host") is now sharper: the floor just went up.

- ⚠️ **`staging` keeps the original, fully permissive rule** — `enable_status_check: false`,
  `enable_push: true`, `apply_to_admins: false` — untouched, out of this story's scope
  (Prohibition 3), and confirmed untouched at the database level (`protected_branch.created_unix ==
  updated_unix == 2026-08-10 12:33:06 UTC`). 🔴 **`development` has no branch-protection rule at
  all** — corrected by code review 2026-08-15; this bullet originally attributed the same field
  values to `development`, describing a rule that does not exist. `protected_branch WHERE repo_id =
  16` returns exactly **two** rows (`main`, `staging`), and `GET /branch_protections` agrees. Note
  the direction of the error: *no rule* is weaker than a permissive rule, not equivalent to one.
  The asymmetry Story 2.5's review noted is now live and sharper than recorded: `main` is gated,
  `staging` is permissive, `development` is unprotected. A PR whose *head* is `staging` or `development` can never satisfy `main`'s gate
  (those branches carry no CI workflow at all, per Story 2.2), which is an accepted, documented side
  effect — not a bug to work around — because no PR this workflow opens legitimately has either as a
  head.

- ℹ️ **AC6 evidence, for whoever next needs to reason about failover.** With runner 1 (id 19) stopped
  by the host-PID method (§6 of the story; `docker kill` and `docker exec … kill -9 1` remain
  confirmed no-ops on this image), a full PR ran end-to-end on runner 20 alone: all eight jobs
  attributed to `runner_id = 20`, merge succeeded, wall clock ~16.1 min (two runs, ~963 s span)
  against the ~11-minute two-runner baseline — consistent with 2 slots instead of 4, not a fault.
  `.cache/actcache` (host bind-mount) survived the stop — Story 1.9 left this UNKNOWN; it is
  now confirmed to survive a process-level kill because the cache directory is never touched by it.
  **Cite the evidence, not the size:** the story's "~225 MB" is a superseded point-in-time `du`
  (measured 1018 MB / 62 entries at review time, after four more runs) and was one of the numbers
  rewritten from the dev agent's recollection. The durable proof, added by the review, is that the
  oldest entry under `.cache/actcache/cache/` has an mtime of **2026-08-11**, predating the
  container's post-revert `StartedAt` of `2026-08-14T21:23:50Z`.

- ℹ️ **Epic 2 is not complete.** `2-1`, `2-2`, `2-3` sit at `review`; `2-4`, `2-5` are `done`; `2-6`
  moves to `review` at this story's close. `epic-2-retrospective` is `optional` and unrun. Whoever
  picks up Epic 3 should not assume Epic 2's stories are all finished — three code reviews are still
  outstanding.

## Deferred from: code review of story-2.6 (2026-08-15)

- 🔴 **`development` has no branch-protection rule at all, and that is now the weakest link.**
  Verified during this review: `protected_branch WHERE repo_id = 16` returns exactly two rows —
  `main` (gated as of Story 2.6) and `staging` (permissive, untouched since Story 1.13). There is no
  row for `development`. Story 2.6 recorded this correctly in its own Open Question 4 but both D16
  and the 2.6 handoff described `development` as carrying a permissive *rule*; that has been
  corrected in place. **The deferred work is the underlying gap, not the wording:** now that `main`
  is gated, `development` is the only long-lived branch with neither a gate nor a rule to inspect,
  and nothing prevents a force-push or a delete on it. Out of Story 2.6's scope (Prohibition 3).
  Needs an owner and a decision — mirror `staging`'s permissive rule for consistency, gate it, or
  record deliberately that it stays unprotected.

- ⚠️ **Four merged `story-2-6/pr-*` branches are still on `origin`, against the story's own declared
  write list.** Task 2.1's declaration item 6 committed to `DELETE` "the probe branch ref … **and
  the AC6/closing branches after merge**". The probe branch was deleted and verified; the four PR
  branches were not. All four are fully merged into `main` (`git merge-base --is-ancestor` confirms
  each), so nothing is lost by deleting them and no CI run is required:
  ```
  git push origin --delete story-2-6/pr-1-review-fix-and-gate-config \
    story-2-6/pr-2-ac5-and-failover story-2-6/pr-3-close-the-story \
    story-2-6/pr-4-final-checkboxes
  ```
  The review could not execute this (the deletion was blocked by the operator's permission policy),
  so it is handed forward. **It matters more than tidiness here:** the repository is at ~504 remote
  branches and the 497-stale-branch hazard (Story 2.2's Open Question 6) is precisely the problem of
  branches nobody deletes. Story 2.5 deleted all five of its own; 2.6 should match that discipline.

- ℹ️ **AC5's semantic is attested, not reproducible — re-measure before building on it.** Forgejo
  keeps no audit trail for branch-protection changes (`protected_branch` stores only current state;
  the instance has no audit table), so the `405` that proved "a required context with no
  `commit_status` row blocks the merge" cannot be re-derived by anyone, and it sits in one of the
  three sections the dev agent rewrote from recollection after losing its notes. The review found
  strong circumstantial support (the rule was written a second time at 20:57:26 UTC, 81 s before
  PR #9's merge, while that PR had been green since 20:46:38 UTC) and accepted the verdict — but a
  future story that leans on this semantic for a *new* design decision should spend the one API
  round trip to re-measure it rather than cite Story 2.6.

## Deferred from: code review of story-2.1 (2026-08-15)

Story 2.1 was the last Epic 2 story still owed a code review — the workflow every other Epic 2
story built on shipped, and was reviewed three stories later than it should have been. Fourteen
findings were patched into the story file, `docs/migration-decisions.md` and the entries above.
Six are deferred here.

- ✅ **CLOSED twice over — first by D19 (2026-08-15, see the entry below this section), then
  re-confirmed explicitly at the Epic 3 retrospective (2026-08-18, action item B2,
  [D25](../../docs/migration-decisions.md#d25)).** This entry originally read: *"`staging` and
  `development` have no CI gate at all, and after Story 2.6 that is a regression against the thing
  being replaced. This needs a decision, not a patch... Owner: Oleg — the call is whether the two
  branches get the gate, get retired, or stay explicitly ungated on the record."* That framing went
  stale the same day: D19 already answered it (below), and this entry was never updated to say so —
  the exact class of drift this project keeps finding in its own summary rows. Oleg's word at the
  retro, verbatim: *"staging & development ветки не тригеримся, их просто не трогаем."* Verified
  against `ci.yml` itself, not memory: both branches are excluded from `on.push.branches-ignore`
  AND absent from `on.pull_request.branches` — ungated by both routes, deliberately, until whichever
  epic actually migrates or retires them opens the question again.
- ⚠️ **No `timeout-minutes` on any job, and no `concurrency` block covering `workflow_dispatch` or
  `pull_request`.** The only ceiling is the runner's own `timeout: 2h`. `Unit Tests` is ~99% of the
  critical path, and a hang there — the flaky-timer class of failure, now fixed, was exactly this
  shape — holds one of four runner slots for two hours on a host that carries another tenant's
  production (load average observed rising 12.99 → 25.82 inside one story). `ci.yml:28-32` declines
  the concurrency block on the grounds that Forgejo auto-cancels superseded runs, but that default
  is documented for `push`; dispatch and PR re-triggers still stack. Benign while the trigger was
  dispatch-only; live since Story 2.2 armed `push` and `pull_request`. Related: `runs-on: node-20`
  has no fallback label and Forgejo has no queue timeout, so if both runners are down a run waits
  indefinitely rather than failing — indistinguishable from "still running". **Owner: whoever next
  opens `ci.yml`; needs one PR through the Story 2.6 gate and one run to validate.**
- ⚠️ **`test:run:ci` is orphaned.** `package.json:15`. Story 2.3 replaced the workflow step with
  `test:coverage:ci`; a repo-wide grep finds no workflow, hook or config that calls `test:run:ci` —
  only prose in five BMAD documents and comments in `ci.yml`. It is the *only* code change Story
  2.1 made to `package.json`, and the deviation from AC4 that the story defends at length now has
  no caller. Story 2.3 explicitly forbade removing it, so the deletion needs an owner rather than a
  drive-by. **Owner: the next story that touches `package.json` scripts.**
- ⚠️ **The 16384 MB heap ceiling was never justified by measurement, and the measurement says it
  was not needed.** `package.json:15` and `:17`. Measured peak 2163 MB; the original 8192 already
  had ~74% headroom. Story 2.4 declined the rollback as out of scope and nobody took it. Note the
  ceiling is not free: nothing caps the job container, so V8 will grow to 16 GB if the suite ever
  asks, and the kernel OOM killer — not V8 — becomes the real ceiling on a shared host. **Owner:
  unassigned. Reverting to 8192 is a one-line change and one CI run.**
- ⚠️ **The peak-memory step has two failure modes that write a plausible-looking lie into the
  evidence store.** `ci.yml:187-217`. (1) `bytes=$(cat /sys/fs/cgroup/memory.peak)` runs under
  `bash -e`, and only *absence* is guarded — a present-but-unreadable file (EACCES under a hardened
  cgroup namespace, ENODEV on a partial mount) aborts the step and fails a job in which all 1921
  tests passed, which is precisely the false-red the step's own comment promises to avoid. (2) A
  non-numeric read (`max` is a legal value there) makes bash resolve `bytes` as a variable name
  inside `$(( ))`, find it unset, and produce **0** — so `peak-memory-0mb` lands in
  `action_artifact.artifact_name`, byte-identical in form to a real measurement, in the table this
  project designated as its evidence store *because* logs are unreadable. Same for a run cancelled
  mid-flight: both steps are `if: always()`, and `always()` includes cancelled. **Owner: whoever
  next opens `ci.yml`. Fixes are small — quote the read, validate it is numeric, and stamp the
  artifact name with the run's conclusion.**
- ⚠️ **Every `upload-artifact` in `ci.yml` inherits `if-no-files-found: warn`.** `ci.yml:211-217`
  (peak memory), `:235-248` (coverage), `:295-300` (`dist`). An empty or misplaced output uploads
  zero files, the step warns, and the run stays **green** — and since retrieval is session-gated,
  nobody can open the artifact to notice. AC5-shaped criteria ("uploads `dist/` as an artifact")
  are satisfied by a zero-file upload. **Owner: whoever next opens `ci.yml`; `if-no-files-found:
  error` is a one-line change per upload.**

## Deferred from: code review of story-3.1 (2026-08-15)

Story 3.1 was reviewed **before** Story 3.2 was written, deliberately: Epic 2 was closed with three
stories still in `review`, and Story 2.1's unreviewed claims were built on by three later stories
before anyone checked them. 3.1 is the foundation of Epic 3 the same way 2.1 was for Epic 2.
Fourteen findings were patched into the story file, `epics.md`, `docs/migration-decisions.md` and
`build.yml`. Six are deferred here. The first one is not a defect in what 3.1 built — it is a
constraint 3.1 created and nobody wrote down.

- 🔴 **`driver: docker` forecloses Story 3.5's registry cache, and 38 documents mention the line
  while none mention the cost.** `.forgejo/workflows/build.yml:78-81`. The line is marked
  LOAD-BEARING with an instruction not to remove it, and the reasoning behind it is correct and
  hard-won: the default `docker-container` driver builds from its own BuildKit container, which does
  not inherit the job container's `--add-host git.crm-prionex.com:10.67.0.1`, and the push dies with
  a bare `EOF`. But the **`docker` driver has no cache export** — `--cache-to type=registry` is
  unsupported on it. FR9 and Story 3.5's AC1 name `type=registry,ref=…:buildcache` explicitly, so
  **3.5 cannot satisfy its own AC against the workflow as shipped.** Three routes, none free: give
  the dind daemon the host mapping so `docker-container` can reach the registry; enable the
  containerd snapshotter; or go native `docker build`/`docker push` with a hand-rolled cache. The
  story was told not to foreclose later decisions and this is the one it foreclosed — silently,
  while telling 3.5 not to touch the line. **Owner: Story 3.5, as its first task rather than its
  first surprise.** Recorded against FR9 in `epics.md`.
- ✅ **CLOSED by Story 3.2** — the assertion now compares this run's digest, shape-guarded, with the
  tag list validated too. *(Struck 2026-08-15; it had been left open in this file while the work was
  done, so a reader saw a live item owned by a finished story.)* ~~**The fail-closed assertion stops being fail-closed after the first run.**~~
  `.forgejo/workflows/build.yml:114-117` runs `docker manifest inspect …:build-check-3-1 || exit 1`.
  Because the tag is a **fixed literal**, that asserts *the tag exists*, not that *this run's image
  is under it* — and the registry accepts tag overwrite, so last-writer-wins is invisible. The build
  step carries no `id:`, so `docker/build-push-action`'s `digest` output is never captured and there
  is nothing to compare against. From the second dispatch onward the step passes on the previous
  run's manifest even if this run pushed nothing. It mattered little while the tag was a throwaway
  and the step ran once; it matters the moment tags become meaningful. **Owner: Story 3.2 — give the
  build step an `id:`, and assert the digest this run produced, not the tag's existence.**
- ✅ **CLOSED by Story 3.2** — re-keyed to `inputs.ref`. ⚠️ **But it re-opens for Story 3.4:** on a
  `push` event `inputs.ref` is undefined, the group becomes the constant `build-`, and the single
  global mutex returns under far heavier traffic. *(Struck and re-scoped 2026-08-15.)*
  ~~**The concurrency group keys on the wrong ref, and today degenerates to a constant.**~~
  `.forgejo/workflows/build.yml:20-22` uses `group: build-${{ github.ref }}` — the *dispatch* ref —
  while the content built is `inputs.ref` (`:50`). Two dispatches of the same `inputs.ref` issued
  from different dispatch refs land in different groups and race for the same tag, which is exactly
  the hazard AC5 names; two of different `inputs.ref` from the same dispatch ref are serialised for
  nothing. Since `build.yml` exists only on `main`, `github.ref` is constant in practice, so the
  group is one global mutex. The file's own comment at `:23-27` names the fixed tag as the cause and
  misses the key. **Owner: Story 3.2.**
- 🔑 **`/root/.fj_token_3_1` is live on s1 with no deletion route written anywhere.** Scope
  `write:repository,write:package`, plaintext file on a host that carries another tenant's
  production. Story 3.1's Prohibition 14 exists to prevent exactly this state and was satisfied on a
  technicality — the session did not *mint* it, it *consumed* one someone else had provisioned — and
  Blocking Open Question 1 was then closed with "the exit was already planned by whoever provisioned
  the token", for which no evidence is offered. This project's standing finding is that an admin
  cannot revoke another account's token, so "someone else will handle it" is not a plan.
  **Owner: Oleg.** *(Note: the separate `write:package` token minted for the `sha-a1b2c3d-prod`
  deletion was cleanly revoked, `96 → 97 → 96`. This is the other one.)*
- ⚠️ **The push credential is org-scope write across a shared 87-package namespace, held back by a
  sentence.** `build.yml:83-88` authenticates with `secrets.REGISTRY_TOKEN_RW` — an **org-level**
  secret on `robot-registry` with `write:package` over all of `CRM`, a namespace holding 87 packages
  and 620 versions of which only `fe-prionex` is ours, including another team's `api-prionex/*`.
  Story 3.1's Prohibition 3 forbids writing outside our own package; a prohibition in a Markdown
  file is not a permission boundary. One edit to the `tags:` line, or the push/tag triggers Stories
  3.2 and 3.4 will add, reaches the whole namespace. A `_RO` variant exists; no narrower RW does.
  **Owner: whoever can ask the platform team for a repository-scoped `write:package` credential —
  worth asking before Epic 6 puts production deploys on the same token.**
- ⚠️ **Four robustness gaps in `build.yml`, all cheap, none urgent alone.** (1) No `timeout-minutes`
  on the job — the only ceiling is the runner's 2h, on a host with capacity 2 shared with another
  tenant's production. (2) No `docker image prune` and no free-space precheck: one build grew
  `dind-storage` by **0.80 GB** and nothing bounds the growth, while Stories 3.2–3.6 are about to
  dispatch repeatedly. (3) `apt-get install docker.io` runs unpinned, unretried and unverified on
  every build — a Debian mirror hiccup fails the build, and a point release could change whether
  `docker manifest` (the evidence step) is available at all. (4) Every `uses:` is pinned to a
  floating major tag (`@v6`, `@v3`, `@v3`, `@v5`) in an epic whose Story 3.6 is about a tag
  identifying exactly one artifact. **Owner: whoever next opens `build.yml`; all four fit in one PR
  and one run.**

## Opened by story 3.2 (2026-08-15)

- ⚠️ **The registry STORES image tags lowercased. Whether a mixed-case *reference* fails is
  unestablished — and Story 3.2's own run suggests it does not.** 🔴 *Rewritten 2026-08-15 by Story
  3.2's code review: the first version of this entry stated the failure as fact and handed it to
  Story 4.3 as an instruction. No `docker pull` was ever attempted, and the fail-closed assertion in
  the same run inspected the **mixed-case** name and succeeded. Forgejo keeps `Version` and
  `LowerVersion` and resolves through the folded column. ✅ **Settled 2026-08-15 from the database, which is better than a `pull`:**
  `select version, lower_version … where version <> lower_version` returns **zero rows** — Forgejo
  folds the case on WRITE, into `version` itself, not merely into an index column — and the unique
  key is `UQE_package_version_s (package_id, lower_version)`. The write path folds and the lookup
  key is the folded column, so a mixed-case reference resolves. **Produce whatever you like; it will
  match case-insensitively.** Lowercasing on the consumer side is tidiness, not a correctness
  requirement. The original entry had it backwards.* Story 3.2's sanitizer emitted `probe-3-2-Tag-Scheme` — the image label
  `org.prionex.ref` preserves that exact mixed case — and what landed in `package_version` is
  **`probe-3-2-tag-scheme`**. The OCI grammar permits uppercase in a tag; this instance normalises
  anyway. **Owner: Story 4.3**, which deploys DEV by `ref` and must derive the tag itself: the
  derivation has to lowercase, or `docker pull` fails fast on a tag that looks correct. Story 3.3
  inherits it too when it appends the environment discriminator. ✅ Checked for the hazard this
  creates: across all 502 remote branches there are **502 distinct sanitized names case-sensitively
  and 502 case-insensitively** — no collision today. It is a shape a future branch name could break,
  which the case-sensitive reading could not.
- 🔑 **`/root/.fj_token_3_1` is NOT on s1.** This file and Story 3.1's record both describe it as
  live, scoped `write:repository,write:package`, with no deletion route, carried as an open security
  item owned by Oleg. Story 3.2 went looking for it to dispatch with and found only
  `/root/.fj_token` (50 bytes, mode 600, dated 2026-08-12). **Either it was removed and the removal
  was never recorded, or the entry was wrong when written.** The open item is smaller than the record
  says — but "smaller" is not "closed" until someone establishes which. **Owner: Oleg.** Story 3.2
  dispatched with `/root/.fj_token` and minted nothing.
- ℹ️ **`docker/build-push-action` DOES populate `outputs.digest` under the classic `docker` driver.**
  Previously unknown — Story 3.1's review flagged it as unobserved and warned that an empty digest
  would make a digest comparison vacuous. Story 3.2's assertion validates the digest's shape before
  comparing, and the guard turned out not to be needed. It stays; the next driver change is exactly
  when it would matter. Relevant to Story 3.5, which must change the driver to get a registry cache.
- ⚠️ **Semver tagging is deferred to Story 3.4, and it has no consumer waiting for it.** Story 3.2's
  AC3 asks for semver tags from `v*`; the trigger that produces them is FR6, i.e. **Story 3.4's**.
  Three facts made implementing it early the wrong call and they will still be true when 3.4 arrives:
  no `v*` tag has ever existed in this repository; no deploy story accepts a semver `image_tag`; and
  **Story 6.5's promotion guard extracts a commit SHA from the tag**, which a semver string does not
  carry, so a semver tag dispatched to production is rejected by construction. **Owner: Story 3.4 —
  implement it, or take the decision to drop FR7's semver clause. Do not inherit it unexamined.**
- ⚠️ **`concurrency` cannot be keyed on the built commit, and the residual race is real.** Story 3.2
  re-keyed the group from `github.ref` (the dispatch ref) to `inputs.ref` (what determines content).
  Keying it on the resolved commit is **impossible**: `concurrency` is evaluated before the job
  starts, so nothing resolved after `actions/checkout` is available. **Two different refs pointing at
  the same commit can still race for the same `sha-<short>` tag.** Serialised now: two dispatches of
  the same ref, which is the case Story 3.1's AC5 named. **Owner: unassigned; it needs a
  registry-side guard, not a workflow-side one, and nothing in Epics 3–6 currently provides one.**
- ⚠️ **The `sha-<sha>-prod` asymmetry, recorded rather than "corrected".** The live retention rule
  protects `sha-[0-9a-f]{7,64}-(pre)?prod` forever, and Story 6.6's amendment note says *"No story in
  this plan produces that shape"* — **which is true**: Story 3.3 writes it only as *"for example"*,
  no AC mandates it, and the one instance that ever existed (`sha-a1b2c3d-prod`) was Story 1.11's
  seeded test material, deleted 2026-08-14 by a human, never by a workflow. So the plan protects a
  shape nothing produces while leaving the bare `sha-<short>` — which FR7, NFR4, Story 3.4 AC2 and
  Story 3.6 AC1 all address images by — unprotected and expiring at 14 days. **Owner: Story 3.3**,
  which decides the discriminator and is the last chance to make the produced shape and the protected
  shape the same string. *(An earlier draft of Story 3.2 instructed the dev to "correct" 6.6's
  sentence. It was right and the instruction was wrong; caught by the story's own validation pass.)*

## Opened by the four-branch topology change (2026-08-15)

- ✅ **CLOSED — `staging` and `development` had no CI gate.** Opened by Story 2.1's code review as the
  sharpest finding in that review, and it needed a decision rather than a patch. The decision was
  larger than the question: the long-lived branches are **`main`, `prod`, `preprod`, `dev`**, the
  three new ones were created and gated, and `staging`/`development` are **not migrated, not renamed,
  not deleted** by instruction. They therefore remain **ungated**, deliberately and on the record —
  which is a different state from the one this entry opened, where they were ungated by accident and
  nobody knew. See [D19](../../docs/migration-decisions.md#d19).
- 🔴 **A promotion PR targeting `main` cannot ever merge, and nothing warns you.** `main` requires
  **eight** status-check contexts (D16): four jobs × `(push)` and `(pull_request)`. That works for a
  PR from a feature branch, because the head branch's own push produces the `(push)` half. It does
  **not** work when the head is a long-lived branch — `prod` → `main`, or `dev` → `main` — because
  every long-lived branch is in `ci.yml`'s `branches-ignore`, so no `push` run happens, the `(push)`
  contexts never appear, and the required-check set is unsatisfiable. The merge button stays disabled
  with four green checks and four that will never arrive. **The three new branches were configured
  with the four `(pull_request)` contexts precisely to avoid this**; `main` was left at eight because
  its protection was set four days earlier and changing it on a hypothetical is worse than recording
  the hypothesis. **Owner: whoever opens the first promotion PR into `main` — the fix is to drop the
  four `(push)` contexts from `main`'s required set, and it takes one API call.**
- ⚠️ **`prod` and `preprod` point at `main` HEAD and this asserts nothing about what is deployed.**
  Both were created at `cac85775` because D9 leaves no safe alternative — a branch cut from an older
  commit has no `.forgejo/workflows/` and falls through to `.github/workflows/CD.yml`, whose deploy
  job targets production. Production is running some other commit; **identifying which is Story 6.3,
  and nobody has done it.** Anyone reading `prod` as a record of what is live will be wrong until the
  cutover (Stories 6.3, 6.9) makes it one. **Owner: Story 6.3.**
- ⚠️ **`staging` and `development` are now the only long-lived branches with no gate, and their
  divergence is inherited rather than resolved.** `staging` is +2265 / −5 against `main` with one
  commit in 60 days; `development` is +148 / −88 with 808. `staging` keeps a permissive protection row
  (`enable_status_check: false`, `enable_push: true`) and `development` has no protection row at all.
  Legacy `.github/workflows/CD.yml` still triggers on push to `[main, development]` — harmless on
  Forgejo, which has no mirror to GitHub in either direction, but it is why `development` cannot
  simply be deleted without checking who still pushes to the GitHub remote. **Owner: Oleg, whenever
  the old model is retired. Not urgent; not forgotten.**

## Deferred from: code review of story-3.2 (2026-08-15)

The review was told the thing that mattered: **one agent wrote this story, implemented it, and
recorded its own evidence.** "Does the implementation match the story?" proves nothing when both
came from one mind, so the layers were pointed at the decisions. They found more here than in either
of the two reviews before it, and the two worst findings were in code. Both are fixed; what follows
is what is not.

- ⚠️ **A ref can sanitize into another ref's tag, and truncation can do the same.** `%main` →
  `-main` → strip leading `-` → **`main`**, overwriting the real branch tag; and `cut -c1-100`
  truncates mid-token with no uniqueness check, so two branches sharing a 100-character prefix
  produce one tag. Neither has a clean workflow-side fix — both need a registry-side check that a
  tag is not being repointed to a different digest. **Owner: Story 3.6**, whose AC2 is exactly that
  question, and which now has two concrete cases to test rather than a hypothetical.
  ✅ **DECIDED 2026-08-18, Story 3.6: AC2's guard does NOT extend here.** `push_tags` is contractually
  mutable (Story 4.6 depends on `<branch>-dev` moving), so the guard's immutability logic would break
  ordinary rebuilds rather than fix a defect. The real hazard is two different refs colliding on one
  sanitized name — a uniqueness question, not an immutability one — and needs a different, smaller
  guard (compare the incoming raw ref against `org.prionex.ref` on whatever currently holds the
  sanitized name, refuse on mismatch). **Owner: unassigned, not this story.** Still armed-not-loaded:
  0 collisions in 509 branches (Story 3.5), one branch already past the 100-char truncation at 109.
- ⚠️ **The residual concurrency race has a sharper consequence than Story 3.2 recorded.** Two refs at
  one commit land in different groups and can race for the same `sha-` tag. Because `Dockerfile.prod`
  runs `npm ci` with no reproducibility guarantee, the two builds produce **different digests** — so
  the race does not merely repoint a tag, it makes the fail-closed assertion go **red on a
  legitimate build**, inverting the one signal this instance has (a green job *is* the evidence).
  **Owner: Story 3.6.**
- ⚠️ **`dev`, `preprod` and `prod` now exist as branches** (D19, landed the same day). Story 3.3's
  environment discriminator will therefore produce `dev-dev`, `preprod-preprod` and `prod-prod` for
  builds of the long-lived branches. The `-dev` collision handover Story 3.2 wrote does not cover
  this case because those branches did not exist when it was written. **Owner: Story 3.3.**
- ⚠️ **Story 3.4 inherits two landmines from 3.2's dispatch-only shape.** (1) The concurrency key
  becomes the constant `build-` under a `push` event. (2) The `latest` gate and the tag computation
  both read `inputs.ref`, which a push event does not set — so the sanitizer receives an empty
  string and the step now *fails closed* rather than inventing a tag, which is correct but means
  **every automatic build will fail until 3.4 supplies the ref from the event.** Deliberate: a build
  that cannot name its own ref should stop, not guess. **Owner: Story 3.4.**
- ✅ **DECIDED 2026-08-16 by Oleg: the rule stays as it is.** The wildcard scope is accepted
  deliberately — every story in this migration reaches s1 the same way, and narrowing it to a
  read-only command list would have to be re-widened by the next story that needs a write. Recorded
  as a decision rather than left as an open item, because an open item nobody intends to act on is
  indistinguishable from one everybody forgot. The reasoning that raised it is kept below.
  ~~🔑 **`.claude/settings.json` grants `Bash(ssh root@10.67.0.1:*)` repository-wide.**~~ Added during
  Story 3.2 for read-only database queries, committed to the **shared** settings file rather than
  `settings.local.json`, so it applies to every clone and every future agent session — and the
  wildcard suffix pre-approves writes to the host that runs the registry, both runners and another
  tenant's production. It was also absent from the story's File List. **Owner: Oleg — narrow it to
  the queries it was added for, or move it to `settings.local.json`.**
- ⚠️ **Three of the four `build.yml` robustness gaps are explicitly declined, not silently skipped.**
  `timeout-minutes: 30` is now set. Still open: `apt-get install docker.io jq` unpinned and
  unretried (a Debian mirror hiccup fails the build); no `docker image prune` against +0.80 GB of
  dind volume per build; all four actions on floating major tags in an epic whose Story 3.6 is about
  a tag identifying exactly one artifact. Declining is recorded here so the next reader does not have
  to guess whether they were considered. **Owner: whoever next opens `build.yml` — and this time the
  item names what "declined" means, because Story 3.2 inherited it and neither did nor declined it.**
  ✅ **DECLINED A THIRD TIME, 2026-08-18, Story 3.6 — named as a pattern, not left to look like drift.**
  `build.yml` was open for the AC2 guard (a blocking defect plus 21 review findings), already over
  this story's own declared budget; bundling three more infra changes in raises review surface for
  risk orthogonal to AC2. **The "whoever next opens `build.yml`" ownership model has now produced
  zero fixes in three tries.** If a fourth story opens this file and declines a fourth time, that is
  the signal to stop deferring and open a named, scheduled ticket instead.
- ⚠️ **The `keep_pattern` guard in `build.yml` is a copy of a rule that lives only in the database.**
  It will drift the moment anyone edits the retention rule, and nothing detects the drift. It is
  deliberately a copy — the alternative is a database round trip inside every build — but the
  duplication is real. **Owner: whoever edits `package_cleanup_rule` next; the guard is at the
  `case "$SANITIZED"` block and names the rule it mirrors.**

## Opened by story 3.3 (2026-08-15)

- ✅ **SETTLED 2026-08-16 — job-log persistence is DELAYED, not absent. Story 2.1 measured too
  early, and the whole project has been designed around the wrong conclusion since.** Measured:
  `select log_in_storage, count(*) from action_task where status=1` → **4128 `t` against 461 `f`**,
  and the `f` rows are all in the recent id range. Decisively: **tasks 4872–4879 — the exact rows
  Story 2.1 named as permanently absent — are `t` today**, with files on disk
  (`/data/gitea/actions_log/CRM/fe-prionex/0a/4874.log.zst` and siblings). The mtimes give the
  mechanism: 3.3's task 5828 was written at the instant it finished, while 4874 (run 2026-08-13
  13:27 UTC) has an mtime of 2026-08-14 22:06 UTC — over a day later.
  🔴 **What that cost.** Story 2.1 deferred AC4 on this, declaring the number unreachable; Story 2.4
  spent a run to encode a measurement into an artifact *name*; Story 3.2 put its evidence into an
  image *label*. All three were engineering around a limit that was a sampling artefact.
  ⚠️ **The technique those stories invented is still worth keeping** — a value in a database column
  is better evidence than a line in a log, and does not depend on a flush. But *"the log is
  unreadable, do not try"* was false, and it was load-bearing.
  *(Original entry follows.)*
  ~~🔴 **Job logs DID persist, and every story since 2.1 has been designed around them not persisting.**~~
  Story 2.1 established *"job logs are not retrievable on this instance"* — 404 on every API route,
  `log_in_storage` never true, 0 of 4 logs reaching disk. That finding deferred 2.1's AC4, made
  Story 2.4 encode a measurement into an artifact **name**, and made Story 3.2 put its evidence in an
  image **label**. **Story 3.3 diagnosed all three of its failures by reading the job log.**
  `action_task` 5815 has `log_in_storage = t` and `log_filename = CRM/fe-prionex/b7/5815.log.zst`;
  the file is on disk under `/data/gitea/actions_log/`, zstd-compressed, one JSON object per line
  with step output in `content`. It named the exact failing line where the database said only
  "step 6 failed". ⚠️ **Whether the instance changed or whether persistence was always intermittent
  and 2.1 sampled the wrong side of it is «не проверено».** What is established is that *"the log is
  unreadable, do not try"* is too strong as a standing rule and has cost this project real work.
  **Owner: whoever debugs the next failing job — check `log_in_storage` first. It is one query.**
- ⚠️ **AC2's guarantee covers two variables; `src/` reads five.** `Dockerfile.prod` declares
  `ARG VITE_API_BASE_URL` and `ARG VITE_WS_URL`. `src/` also reads `VITE_OPERATOR_PHONE_URL`,
  `VITE_EASYPAY_PORTAL_API_KEY` and `VITE_BUILD_TS`. Vite bakes `undefined` for an undeclared
  `import.meta.env.X`; each of the three has an in-source fallback and the websocket one falls back
  to `localhost`. So three variables the application reads can never fail the build, in a story whose
  whole point is that a missing variable must. Closing it means extending `Dockerfile.prod`, which
  Story 3.3's AC5 forbids without an amendment. **Owner: Story 3.6** — it is the story about the
  image being trustworthy, and this is the largest untrustworthy thing left in it.
  ✅ **CLOSED for two of three, Story 3.6.** `VITE_OPERATOR_PHONE_URL` was fixed 2026-08-17 (outside
  this story) — it is in the build-arg contract now, per-environment, from a Forgejo CI variable.
  `VITE_BUILD_TS` was audited 2026-08-18 and is **not** a contract gap: `vite.config.ts:8` sets it via
  `define`, a textual substitution that would override any build-arg, so the `?? '1'` fallback is dead
  code — see [D24](../../docs/migration-decisions.md#d24) and D20 §6, which this update also closes.
  🔴 **`VITE_EASYPAY_PORTAL_API_KEY` remains open and unaudited. Owner: Story 3.6** — unchanged from
  the original line above; §4b names 3.6 as the owner of auditing it, and a review caught an earlier
  draft of this update silently de-assigning it to "no owner" instead. Not audited this round.
- 🔴 **The bare `sha-<short>` no longer exists, and four references still name it.** Story 3.3
  replaced it with `sha-<short>-<env>` because FR8 requires a discriminator and its own AC3 requires
  the bare form never be ambiguous — under Option C one commit yields three images, so it cannot be
  both. **FR7, NFR4, Story 3.4 AC2 and Story 3.6 AC1 all address images by the bare form.**
  **Owner: Story 3.4**, the next to touch this, which must either use the discriminated form or
  amend FR7.
- ⚠️ **`preprod` is accepted as an input and cannot be built.** `secret/fe/pre-prod/app` holds
  `PLACEHOLDER-preprod-backend-not-provisioned`, and the corrected value —
  `https://api.crm.preprod.crm-prionex.online`, measured — needs an OpenBao token this repository
  cannot mint. The build fails closed with the variable, the path, the correct value and the owner
  named in the message. **Owner: Oleg.** Until then Epic 5 can plan but not build.
- ✅ **PROMOTED TO A STORY 2026-08-15 — `OPENBAO_PROD_SECRET_ID` expires 2027-06-09.**
  `secret_id_ttl 7200h`, issued 2026-08-13, nothing rotates it and nothing monitors it; Story 3.3 is
  the first thing to depend on it. When it expires **every production build fails at once**, with an
  auth error that says nothing about credential age — and Story 3.3 measured that a *wrong*
  `secret_id` fails **identically** to a missing one, so the first symptom points at the credential
  rather than at its expiry. Now **Story 7.6**, last in the plan. *Promoted rather than left here on
  purpose: a deferred line in this project has repeatedly been read as "someone will notice", and the
  whole point of this one is that nobody will until production stops building.* **Owner: Story 7.6.**

## Measured 2026-08-16 — `workflow_run` is not usable as a trigger on this instance

Story 3.4 needed "run X after Y succeeded" and nothing in this project knew whether Forgejo has it.
**Epics 4–6 will want the same shape**, so the measurement is recorded here rather than only inside
one story.

**Instance:** Forgejo `15.0.5+gitea-1.22.0`.

**Method — two throwaway workflows, and a positive control, because an absence proves nothing:**

| step | run | result |
|---|---|---|
| `probe-upstream.yml` dispatched **from a feature branch** | 609 | ✅ success |
| a `workflow_run` run after it | — | never appeared |
| **positive control:** `probe-downstream.yml` dispatched directly | 611 | ✅ **ran** — so Forgejo parses and registers the file; its silence is not "the file was invisible" |
| probes landed on `main`, `probe-upstream.yml` dispatched **from `main`** | 614 | ✅ success, `refs/heads/main` |
| a `workflow_run` run after **that** | — | **none in 560 s** |

**Why the second half was necessary.** On GitHub, `workflow_run` fires only for workflows on the
**default branch**, and Forgejo copies GitHub's semantics widely. From a feature branch,
"unsupported" and "supported but must live on main" produce the identical observation. Concluding
from there would have repeated Story 2.1's job-log mistake exactly: a measurement taken in the wrong
place, promoted to a property of the system, then designed around by four stories.

**Corroboration:** across **124 runs** on this repository the recorded event types are `push` (49),
`workflow_dispatch` (43), `pull_request` (29), `pull_request_sync` (2) and `create` (1).
`workflow_run` has never appeared. *(Indicative, not proof — the column only shows what has been
used.)*

⚠️ **The one alternative not excluded.** The probe used `types: [completed]` and
`workflows: ["Probe Upstream"]`. If the trigger were supported with different filter syntax, this
test would not have distinguished that from unsupported. Considered unlikely given the event column
above, but it is an assumption and it is recorded as one rather than hidden.

⚠️ **Also note the earlier binary probe was worthless and is a reusable lesson.** `workflow_run`
appears **16 times** in the Forgejo binary against `workflow_dispatch`'s 7 — which suggested support
and meant nothing: Gitea 1.22 carries `workflow_run` as a **webhook event type**, and those
occurrences belong to that path. **Presence of a string in a binary is not support for a trigger.**
*(And the first attempt at that probe grepped `/usr/local/bin/gitea`, which is a **581-byte
wrapper** — returning zero for every trigger including the ones that work. The real binary is
`/app/gitea/gitea`, 113 MB. Same trap shape as the `bao` wrapper Story 1.12 found.)*

**Consequence:** Story 3.4 takes **shape А** — the image is built as a job inside `ci.yml` with
`needs: [lint, typecheck, test]`, which gives the same guarantee (red tests → no image) without the
trigger. **Owner of the wider problem: whoever next needs "run X after Y" — Epic 4's deploy
notifications and Epic 6's promotion chain are the likely first askers. The answer is: you cannot,
chain it inside one workflow with `needs:`.**

**Cost of the measurement:** 6 runs (609–614). Worth it — the alternative was designing Story 3.4
around a guess, and then Epics 4–6 rediscovering it one at a time.

---

## `workflow_call` — the answer to "run the same logic from two places" (Story 3.4, 2026-08-16)

`workflow_run` is unusable here (above), so the reuse question fell to `workflow_call`. Story 1.3's
Probe C had already been read as answering it. **It had not.** That probe declared no inputs, no
secrets, no outputs, no `concurrency` block and one trigger — it proved the bare mechanism and
nothing the real extraction depends on. Story 1.3's own table listed `secrets: inherit` under
*"expectations to test against, not findings."* This is the second time in this project that a
capability was believed settled because a related fact was recorded; the first was job-log
persistence.

**Full record: [D21](../../docs/migration-decisions.md#d21).** The reusable parts:

**Works.** Expansion into separate jobs; typed `inputs` across the boundary; one file carrying both
`workflow_call` and `workflow_dispatch` with `type: choice` still legal on the dispatch half;
`needs:` before *and* after a `uses:` job including reading its outputs; callee outputs reaching the
caller byte-for-byte.

**`secrets: inherit` is the only way in, and it is all-or-nothing.** `on.workflow_call.secrets` is
rejected by the parser, and repository secrets are not ambient in a callee. Story 4.8's shared
deploy workflow will therefore receive the production OpenBao credentials even on a DEV deploy —
worth weighing there, and not a regression today only because `build.yml` already holds all nine as
a top-level workflow.

🔴 **A called workflow loses its own `concurrency` block, silently.** The run carries the caller's
auto group. Same file: `concurrency_type = 1` dispatched, `0` called, no error either way. **Every
caller owns its own serialization.** Anyone extracting a workflow must move the block, or lose it
without being told.

🔴 **A `uses:` job's `if:` is copied DOWN into the expanded callee and re-evaluated there**, where
`github.event_name` is `workflow_call` and never the original event. `if: github.event_name ==
'push'` is therefore constant-false. Use `github.ref`, which is a property of the run
(`action_run.ref`, one column) rather than of the job. **Write the condition positively** —
`startsWith(github.ref, 'refs/heads/')`, not `!startsWith(github.ref, 'refs/pull/')` — because the
negative form is *true* when the context is empty and would run the job for the wrong reason while
looking exactly like working.

⚠️ **`${{ github.ref_name }}` in a caller's `with:` reaches the callee empty.** Derive the branch in
bash from `GITHUB_REF` instead; bash has substring extraction and the GitHub expression language does
not.

🔴 **And the one that generalizes furthest: a green `uses:` job is not evidence that the called
workflow did anything.** The wrapper reports **success** when every job it expanded was **skipped**.
Run 631: `image` success, `image.build-and-push` skipped, registry unchanged. Run 634, red path:
`image` failure, `image.build-and-push` skipped, registry unchanged. Identical inner outcome,
opposite badge. **Check the registry, the database row, the artifact — never the tick.** Same family
as *"an empty result is not evidence of safety"* (1.11) and *"a test that cannot fail proves
nothing"* (1.12).

**Where workflow schema errors live.** `action_run.pre_execution_error_details`, and nowhere else. An
invalid file creates no task, so there is no job log at all, and both plausible job-log API routes
(`/actions/jobs/{id}/logs`, `/actions/runs/{n}/jobs/{id}/logs`) 404 even for an admin token. It also
explains a confusing symptom: an invalid workflow produces one **failed run per event Forgejo was
evaluating** — `create`, `push`, `pull_request` — for a file declaring none of them. That is not
`workflow_call` matching every event; the spurious runs vanish once the file is valid.

**Cost of the measurement:** 6 probe runs plus 6 `ci.yml` runs, of which 3 probe runs were waste from
an invalid first file. Predicted ~4 by the implementer and 1–2 by the reviewer; both were low.

---

## 📅 DUE 2026-08-29 — the first moment AC4 can be observed (Story 3.4, raised 2026-08-16)

**Four stories have recorded the 14-day retention rule as "partly confirmed" and read that as their
own diligence gap. It was not one.** The repository was created **2026-08-07**. Nothing inside it
can be fourteen days old, so the threshold has been unreachable for every story so far. Stories
1.11, 3.2, 3.3 and 3.4 could not have confirmed it no matter how carefully they looked.

The oldest surviving registry version is **`build-check-3-1`, created 2026-08-14 08:21:46 CEST**.

🔴 **The date is 2026-08-29, not the 28th, and getting it wrong causes a false escalation.** The
container runs CEST and Forgejo compares `created_unix` against `now - 14 days` in **local** time.
The 08-28 00:00 pass computes a cutoff of 08-14 00:00 CEST; the version's local time is 08-14
**08:21:46** — later than the cutoff, so it is KEPT. The first pass that can remove it is the night
of **28→29**.

**What IS confirmed already**, so nobody re-does it:

- The rule is armed — `package_cleanup_rule` id 1, `enabled=t`, `remove_days=14`, `keep_count=0`,
  `match_full_name=t`.
- **The rule keys on `package_version.created_unix`** — verified in the Forgejo v15.0.5 source
  (`services/packages/cleanup/cleanup.go`, `GetCleanupTargets`), not on updated, last-download or a
  `package_property`. This is the assumption everything else rests on and it holds.

🔴 **What an earlier version of this note claimed and was WRONG about:** it cited a
`2026/08/15 00:00:00` log line as evidence the nightly cron runs and deletes package versions. That
line is `services/packages/container/cleanup_sha256.go` — the dangling-`sha256:*` sweeper, a
different code path from the retention rule. It evidences nothing about the rule. And the log is
lossy besides: across 120 hours only one night carries both the Start and Finish lines that pass
emits unconditionally, and 2026-08-16 00:00 carries neither. **We do not actually have evidence the
nightly cron runs.** That is now part of what 08-29 settles.

What is unconfirmed: that the **retention rule** deletes an image aged past its threshold, and
whether the cron carrying it runs at all.

**The observation, on or after 2026-08-28.** One query. No dispatch, no write:

```sql
SELECT pv.version, to_timestamp(pv.created_unix)::date
FROM package_version pv JOIN package p ON p.id = pv.package_id
WHERE p.lower_name = 'fe-prionex' ORDER BY pv.created_unix LIMIT 5;
```

- `build-check-3-1` **gone** ⇒ AC4 confirmed; close it in Story 3.4 and stop restating it elsewhere.
- `build-check-3-1` **still present after 2026-08-30** ⇒ 🔴 the rule does not do what its fields say.
  (On the 28th it is EXPECTED to still be there — do not escalate then.)
  That is a much larger finding than AC4: Epic 5 and Epic 6 both rely on `keep_pattern` protecting
  `prod-current`/`preprod-current` and on everything else expiring. Escalate rather than record.

⚠️ **Do not judge this by the log at all.** The rule-execution path writes **nothing in either
case** — every outcome in `ExecuteCleanupRules`/`GetCleanupTargets` is `log.Debug`, and this instance
runs `LEVEL = info`. An earlier version of this note said "nothing unless it deletes", which wrongly
implies a deletion would show up. Judge it by rows in `package_version`. The same shape as Story
1.11's standing rule that an empty result is not evidence of safety.


---

## Opened by Story 3.4 (2026-08-16) — live items with no other home

Recorded here because `deferred-work.md` is where later stories look, and until now these existed
only inside a `ci.yml` comment or a story file nobody downstream reads.

1. **A CI dispatch could build an image, and now cannot — but the class remains.** `ci.yml`'s
   `workflow_dispatch` has no branch filter, so a dispatch on `prod` would have built prod-branch
   content with **dev** OpenBao URLs, tagged `prod-dev`. Closed by a `gate` job. ⚠️ The general
   lesson outlives the fix: **a `uses:` job's `if:` cannot test `github.event_name`** — that value
   is rewritten to `workflow_call` in the callee. Test `github.ref`, which survives, or gate with an
   ordinary job. Epics 4–6 will write many `uses:` jobs.

2. **Same commit, two refs, one `sha-<12>-dev` tag.** Builds are not reproducible (floating base
   image, OpenBao URLs can change), so two runs of the same commit from different refs produce
   different digests under one tag — a spurious red, or a `sha-` tag naming a build it did not
   produce. Pre-existing for the dispatch path; Story 3.4 armed it automatically. Unfixable at job
   level on this instance (D8 — `jobs.<id>.concurrency` is ignored).

3. **`needs:` omits the `build` job.** A `npm run build` failure whose cause the Docker build does
   not share still produces an image from an overall-red run.

4. **Availability coupling.** Debian mirrors, OpenBao seal state and the registry are now on the
   critical path of every push to every branch, ~30/day. A sealed OpenBao after an unattended
   restart reds **every** branch push, not just a deliberate build. Shamir 3-of-5 means an
   unattended restart IS a sealed restart.

5. **Docs-only pushes build an image.** Accepted by Oleg 2026-08-16. `paths-ignore` was briefly
   recorded as "foreclosed by measurement" on a claim that turned out false — **it is a live option
   again** if the cost is ever judged too high.

6. **Story 3.1 AC5's explicit serialization is not in force on the automatic path.** `build.yml`'s
   own `concurrency` block is dead when it is called (D21) and neither caller declares one, so the
   policy is Forgejo's default auto-cancel rather than the queueing AC5 specified. Argued in a
   `ci.yml` comment; recorded here because §1 of the story required it be stated in the record and
   it was not.

---

## `driver: docker` is gone, and the reason it was there was misdiagnosed (Story 3.5, 2026-08-16)

**Full record: [D22](../../docs/migration-decisions.md#d22).** The part that outlives the story:

🔴 **Four artifacts said the registry push fails under `docker-container` because a BuildKit
container does not inherit the job container's `--add-host`.** That is true and it is not the
mechanism. The dind container's own `/etc/hosts` holds only localhost entries. `git.crm-prionex.com`
arrives by **DNS**: `nameserver 127.0.0.11`, Docker's embedded resolver, forwarding to the s1 host's
resolver, which serves the mapping from the **host's** `/etc/hosts`.

So the real failure was a BuildKit container on the default bridge losing the embedded resolver,
falling back to public DNS and reaching the wrong address. **`driver-opts: network=host` restores it
and fixes the NAME, not only the route** — which every document said was impossible.

⚠️ `network=host` is load-bearing and not removable, and it reduces isolation: the BuildKit container
shares the dind daemon's network namespace. Accepted deliberately.

**The cache works cross-runner** — proved, not inferred: run 663 on runner 19 got every layer
`CACHED` for a tree that runner 19 had never built, because runner 20 had exported it. 28 s against
the 107 s such a build used to cost.

🔴 **And it is break-even.** `docker-container` costs a steady **+25 s** on source-changed builds —
run 664 confirmed it is not a one-time BuildKit pull. Over the ten-build window 645–659: 814 s → 795 s,
**−1.9 s per build**, under a minute a day, against 280 MB for `buildcache`. Kept by Oleg's decision
for **variance and resilience**, not for mean build time. Anyone revisiting this should weigh those
two things, not the stopwatch.

⚠️ **`docker manifest inspect` cannot read OCI media types at all** — not an index, not a single
manifest. buildx under `docker-container` writes them. Use `docker buildx imagetools inspect
--format '{{.Manifest.Digest}}'`. This cost two runs to establish because the guard in `build.yml`
carried a confident comment blaming the manifest index, and that branch never executed once.

🚨 **The guard also misattributed its own failure**, reporting "did not resolve in the registry" for a
tag that had just been pushed successfully. **A fail-closed guard must distinguish "the tool could not
read it" from "the registry does not have it"**, or it sends the next reader to the wrong place. That
is now the third case in this project where a guard's stated reason and its actual behaviour diverged
— see also D21's `if:` copy-down and the `pending` misread.

---

## Opened by Story 3.5 (2026-08-17) — two things the review left live

**1. ✅ CLOSED for `preprod` 2026-08-17 — run 680, and the outcome corrects a stale fact.**

A `preprod` dispatch of `main` was expected to stop at the placeholder guard, because Story 3.3's
record (2026-08-15) says `secret/fe/pre-prod/app` holds
`PLACEHOLDER-preprod-backend-not-provisioned`. **It did not stop.** The build succeeded and pushed
`main-preprod` and `sha-00ef3be4743d-preprod`.

The reason is benign and the record was simply out of date: extracting the bundle layer from the
pushed image shows the **real** endpoints baked in —

```
https://api.crm.preprod.crm-prionex.online
wss://api.crm.preprod.crm-prionex.online
```

So the KV path was provisioned after 2026-08-15, the placeholder guard behaved correctly by passing a
genuine URL, and `sha-00ef3be4743d-preprod` is a **legitimate** preprod image of `main` whose
permanence is by design. No DELETE is needed.

**What this closes:** the preprod path — OpenBao credential selection, the KV read, the URL guard, the
tag computation with its permanence branch, the build, the push, the cache and the digest assertion —
is now verified end to end under the driver, network and cache that Story 3.5 introduced.

⚠️ **`prod` remains unexercised.** It differs from preprod only in the `case` arm that selects the
AppRole and KV path, so the risk is narrow, but `secret/fe/prod/app` has never been read by anything
and Story 7.6 exists because `OPENBAO_PROD_SECRET_ID` is unresolved.

🔴 **The lesson is not about preprod.** The dispatch was made on the strength of a two-day-old
document read as current state. It was the fifth instance in three days of the same failure: take the
first plausible model, record it as established, act on it. Here it happened to be harmless. **A
statement about live infrastructure has a timestamp; treat it as evidence of the past, not the
present.**

**(Original entry, kept because the reasoning still applies to `prod`:)**
**🔴 No `prod` build has EVER run under the current build configuration.** The driver,
the network, the cache and the digest assertion all changed, and every run that exercised them used
`environment: dev`. A `prod` or `preprod` build mints `sha-<12>-<env>`, which the retention rule keeps
**forever** — removing one needs an authorised DELETE with a `write:package` token that has twice
required the operator in person.

Nothing found in review says the prod path is broken; the OpenBao `case`, the permanence guard and
the digest assertion were all traced and are environment-agnostic. But "traced and looks fine" is the
standard this project rejects everywhere else.

**Cheapest close: one `preprod` dispatch before the first real production deploy.** Its tag is
permanent too, so it is not free — but it is one intentional permanent tag against discovering a
defect on the first prod release. Owner: whoever runs Epic 5 or 6 first, and it should happen before
they need it to work.

**2. ⚠️ OpenBao stays reachable from build `RUN` steps.** Story 3.5 moved the BuildKit container off
`network=host` onto a user-defined bridge, which closed the two severe holes — measured:
`127.0.0.1:2375` (an unauthenticated API on a **privileged** daemon, i.e. root-equivalent on s1) is no
longer reachable, and there is no longer an interface on the network carrying the Forgejo database.
`172.20.0.5:8200` **is** still reachable, because the dind daemon routes between its own bridges.

Severity is much lower — a build carries no AppRole credentials, only the URLs baked as build args —
but it is not zero, and `npm ci` runs lifecycle scripts from any branch's lockfile. Closing it fully
is host-level firewalling on s1, which is outside any story currently planned. Recorded so it is a
decision rather than an oversight.

---

## ✅ DECIDED 2026-08-17 — no operator phone in dev or preprod

`VITE_OPERATOR_PHONE_URL` is supplied per environment from a Forgejo CI variable (not OpenBao — a
public front-end origin is not a credential). **Oleg's decision: dev and preprod do not get an
operator phone service.** Their variables stay unset, the panel does not render there, and this is a
settled state rather than a gap.

Consistent with the infrastructure as measured 2026-08-17: `phone.crm-prionex.online` resolves and
answers HTTPS 200; `phone.crm.preprod.crm-prionex.online` is NXDOMAIN.

`prod` fails closed if its variable is empty, because a production build without the phone is a
regression. `VITE_OPERATOR_PHONE_URL_PROD` exists.

**If that ever changes**, adding the environment is a variable and nothing else — no code change.

---

## 🔴 MEASURED 2026-08-17 — the `sha-<12>-<env>` repoint is real, and this closes a claim that had been reasoned four times and measured never

**Owner of the fix: Story 3.6, AC2.** This entry supersedes *"Opened by Story 3.4"*, item 2, which
argued from first principles that the same commit rebuilt from two refs would not be reproducible.
It was right, but it was an argument. This is the measurement.

**Verdict.** Commit `ff416712` was built four times for `dev`. Runs 696/697/698 hit the registry
cache (30s, 28s, 28s). Run 700 was dispatched from `probe/3-6-cold-cache` — a branch whose only
change is removing `cache-from` from `build.yml` — with `inputs.ref: main`, so the workflow came from
the probe and the content from `main`. It took **147s** and pushed a different image. The tag
`sha-ff416712653e-dev` now resolves to
`sha256:d1cc776c7fe3dcda4a65f056fd318ec8938f753b51b6e01ad15e7ffa583aa582`, whose config blob carries
`created = 2026-08-17T12:40:34Z` — six minutes **after** runs 697 and 698 finished. A config blob
cannot be stamped with a future time, so that image is not the one they published. **The tag was
moved, and nothing announced it.**

**Cause: the BuildKit config timestamp**, which changes on any cache-miss rebuild and which pinning
the base images by digest — done the same day — cannot touch. The base-image pins removed one of the
listed causes; this one was always the dominant one.

**🔴 UPDATED 2026-08-18 — the layers differ too, and the real cause is in our own source.** The
first version of this entry said the layer question was unanswerable. It became answerable as soon as
a second image was built from the same source: run 701, this story's own PR branch. Layers 1–8 (the
two pinned base images) are identical; layer 9 — the built bundle — differs, and unpacking it shows
**154 files on each side with almost every name and content hash different**. Vite content-hashes
filenames, so that is a genuinely different bundle.

**Root cause: `vite.config.ts:8`.**

```ts
define: { 'import.meta.env.VITE_BUILD_TS': JSON.stringify(String(Date.now())) },
```

`Date.now()` is baked in as a literal at build time, reaches `src/lib/i18n.ts:9`, and the
content-hash cascade rewrites nearly every chunk. **Two builds of the same commit cannot produce the
same bundle — warm cache, cold cache, or otherwise.** The artifact is non-reproducible by
construction of the source, and nothing in `build.yml` can change that. The BuildKit config timestamp
is still real, but it is the lesser mechanism: it accounts for the config blob and for layer 10,
whose content (`nginx.conf`) is byte-identical.

Two consequences worth carrying forward:

- **The §3 guard's verdict depends on the shared `:buildcache`.** `Date.now()` is evaluated when the
  bundle is *built*; on a full cache hit BuildKit restores the cached layer and config instead, which
  is why runs 697/698 matched. So a rebuild takes the "same digest → nothing to do" branch on a cache
  hit and fires the guard on a cache miss — and `:buildcache` is one mutable tag any branch can
  evict, as a probe branch did to `main` at 14:48:02. The same rebuild of the same commit can pass
  today and fail tomorrow with no change to the commit. Story 3.6 Task 3 owns the answer.
- **`VITE_BUILD_TS` is not a contract-coverage gap.** `define` substitutes textually, so the `?? '1'`
  fallback is dead code and supplying the build arg would be overridden. D20 §6 lists it alongside
  `VITE_EASYPAY_PORTAL_API_KEY`; only the latter is still the question that section thinks it is.

⚠️ Still unmeasured: whether npm or the OpenBao values would *also* break reproducibility. Moot for
the digest question while `Date.now()` is there; live again the moment it is fixed.

**🔴 OPEN, and it outlives Story 3.6 — the build is not reproducible at source level.**
Decided 2026-08-18 (Oleg): Story 3.6 refuses the repoint with a guard and does **not** touch
`vite.config.ts`. That satisfies AC2, which asks for immutability of the tag rather than
reproducibility of the build. It leaves this open:

- `vite.config.ts:8` bakes `Date.now()` into every build. **Replacing it with the commit SHA is a
  one-line change** that keeps the locale cache-busting intent — a new commit yields a new string —
  and makes the bundle deterministic. Declined for 3.6 on scope grounds (CI story, application
  source), not on merit.
- Even with that fixed, identical **digests** additionally need `SOURCE_DATE_EPOCH` so BuildKit stops
  stamping build time into the config and layer metadata. Larger, and deliberately not attempted.
- Consequence while it stays open: the AC2 guard passes on a cache hit and fails on a cache miss.
  Story 3.6 documents this at the guard rather than designing it away.

**Owner: unassigned.** Raise it when something actually needs a rebuild to reproduce — a supply-chain
attestation, a security rebuild of a released commit, or a dispute about what a `prod` tag contained.

**Why it matters beyond Story 3.6:** Story 5.4 mints `preprod-<sha>` on commit identity, Story 6.5
refuses a production deploy unless `preprod-<sha>` exists, and Story 6.6 keeps `prod-<sha>` as the
rollback target. A `sha-` tag that can quietly name a different artifact makes 6.5 a check on a claim
that changed underneath it.

**Side effect, live now:** the shared `:buildcache` tag was overwritten at 14:48:02 by `ci.yml` on the
probe branch's own push (run 699), so it holds the probe branch's layers rather than `main`'s. It
self-heals on the next `main` build. Noted because an unexplained slow build is how this kind of
thing gets misdiagnosed — and because it is the same hazard class as AC2: a shared mutable tag
rewritten by whoever pushed last.

**Open:** `probe/3-6-cold-cache` is still on the remote, one commit ahead of `main`, carrying a
deliberately broken `build.yml`. Story 3.6 Task 7.5 deletes it. **⚠️ Still open** — this session had
no credential to delete a remote branch (see below), so it remains on the remote.

**⚠️ A second probe branch joined it, 2026-08-18: `probe/3-6-differ` (commit `15c22b17`).** Created
deliberately to close Task 3.4's differ-path test — its one commit adds a cache-divergence marker to
`src/main.tsx` so its automatic `dev` build (run 722) overwrites the shared `:buildcache` with layers
foreign to the story branch, forcing a cache miss on the next same-ref dispatch. That dispatch (runs
723/725) proved the AC2 guard's refusal live. The branch's job is done; it should be deleted alongside
`probe/3-6-cold-cache` once the story merges (Task 7.5, both now).

**✅ UPDATED 2026-08-18 — the guard `Story 3.6 Task 3 owns the answer` pointed at is now implemented,
and [D24](../../docs/migration-decisions.md#d24) records it.** `build.yml` reads the pre-existing
digest of `sha-<12>-<env>` *before* the build, pushes only the mutable branch tag from the build step
itself, and attaches (or refuses) the protected tag afterward by comparing digests — so the "same
digest → nothing to do, different digest → fail" table above is now code, not a plan. No override for
a "legitimate rebuild" was added; see [D24](../../docs/migration-decisions.md#d24) for why none is needed.

🔴 **Not closed by this update: Task 3.4 (prove the guard fires) is unverified.** The agent session
that wrote the guard had no Forgejo API token and no SSH to s1 — confirmed by an unauthenticated
`GET /api/v1/repos/CRM/fe-prionex/actions/runs` returning `403`, not assumed. The "absent" path will
be exercised automatically by the next push (every push builds `dev`, Story 3.4); the "differ" path —
the guard actually refusing something — needs a deliberate `workflow_dispatch` rebuild of the same
commit, the same technique Task 1 used above, and nobody has run it yet against this code. Tasks 4
(re-read the labels live) and 5 (close AC4 by `package_version`/`action_run_job` query) are blocked
for the identical reason. Whoever has the token next should close these before treating Story 3.6 as
done — see the story's own Dev Agent Record for the exact commands.

---

## Token minted 2026-08-17 — `fe_pkg_3_6`, and it needs an exit

`fe_tmp_1_7` is scoped `write:repository,read:organization`, which **cannot read the container
registry** — both `/api/v1/packages/{owner}` and the registry v2 API return 401
`required scope(s): [read:package]`. Reading the digests above needed a second token.

- **Name:** `fe_pkg_3_6`, scope `read:package`, on `platform-admin`, minted 2026-08-17 by Oleg.
- **Owner:** Oleg. It is on his own account, so unlike the `fe_tmp` case he **can** revoke it from
  the UI — see the standing note that an admin cannot revoke another account's token.
- **Revocation trigger:** when Epic 3 closes, or when a longer-lived read route to the registry is
  decided — whichever comes first.

⚠️ Recorded here because the `fe_tmp` entry went stale for a full story once already, and the whole
point of that lesson was to check this file before assuming anything about token state. There are now
**two** standing tokens, not one; the open policy question (one token per epic vs. scoped
short-lived token per story) is unchanged and still not urgent.

---

## Deferred from: code review of story-3.6 (2026-08-18)

- **TOCTOU: Story 3.6's AC2 guard has a check-to-write window that spans the entire build, and
  `concurrency` does not close it.** `predigest` (`build.yml:1035`) reads the pre-existing digest of
  `sha-<12>-<env>`; the attach (`:1303`) happens after the build and the cache export. Two runs whose
  refs differ but resolve to the same commit land in **different** concurrency groups — `build.yml:83-88`
  already records this residual gap — and D21 (`:89-99`) establishes that the workflow-level
  `concurrency:` block is **silently inert on the `workflow_call` path**, which is the automatic
  ~30-builds/day path via `ci.yml`. Both runs read "absent", both build, both attach; the last writer
  repoints `sha-<12>-<env>` with a green job. That is the outcome AC2 exists to forbid, now with a guard
  reporting success. `imagetools create` offers no compare-and-swap, so closing this needs either a
  commit-keyed lock (impossible in `concurrency:`, which is evaluated before `actions/checkout`) or a
  post-attach read-back that fails if the tag does not carry this run's digest. **Deferred, pre-existing** —
  the race predates the guard; what is new is that D24 now claims the repoint is refused «по конструкции»,
  which is stronger than the code. The wording is filed as a patch against Story 3.6, the race is not.
  **Owner needed.**
- **AC2's guarantee lapses silently on `dev` at 14 days.** `sha-<12>-dev` matches no `keep_pattern`
  alternative and the retention rule reaps it. Rebuild a commit older than the window and `predigest`
  legitimately reports "absent", so the guard attaches a *different* digest under a name that previously
  identified another image — the identity break AC2 forbids, with no refusal and no warning. The guard has
  no notion of "this tag existed once and was reaped". **Deferred, pre-existing** — inherent to the
  retention rule, and `-preprod`/`-prod` are permanent and therefore unaffected, which is where the
  downstream stories actually live. Recorded because it is currently mentioned nowhere: not in the step,
  not in the story, not in D24. **Owner needed** — cheapest honest fix is one sentence in D24 bounding the
  guarantee to the retention window on `dev`.

## Opened by Epic 3 retro action item A1 (2026-08-18) — `buildkit-cni-v1` is a production dependency the retention rule doesn't know is one

✅ **RESOLVED 2026-08-19 — moot by design, not by the DB edit this entry asked for.** Review round 1 on
PR 54 retagged the image to a permanent semver tag, `v1.0.0-buildkit-cni`, which matches the live
`keep_pattern`'s own semver alternative (`v?\d+\.\d+\.\d+.*`) directly — verified against the same
compiled regex in `build.yml`'s tags step this entry originally checked against. No database change
needed, and the weekly-refresh mechanism this entry described is gone too: `build-buildkit-cni-image.yml`
is `workflow_dispatch`-only now, for deliberate version bumps only. See
[D26](../../docs/migration-decisions.md#d26) for the full account, including the caveat this resolution
does NOT remove: `build.yml`'s own reference to the image is a digest pin, not the tag itself, and as of
this commit that digest pin is still a temporary, clearly-marked placeholder — a *separate*, currently-open
handoff, tracked in `build.yml`'s own comment at the `driver-opts:` step and in D26, not in this entry.
Original entry follows, unedited, as the historical record of the problem this closed.

`build.yml` now hard-depends on `git.crm-prionex.com/crm/fe-prionex:buildkit-cni-v1`
(`Dockerfile.buildkit-cni`, [D26](../../docs/migration-decisions.md#d26)) for every build, dev
included. That tag does not match any alternative in the live `keep_pattern` — verified against the
compiled regex in `build.yml`'s own tags step, not assumed — so by the letter of the retention rule it
expires in 14 days like any other untracked tag.

**Mitigated, not solved:** `build-buildkit-cni-image.yml` refreshes the tag on a weekly schedule
(`cron: 0 3 * * 1`), comfortably inside the 14-day window. This assumes a re-push under the same tag
resets `package_version.created_unix` for that tag — taken from Story 3.4's own measurement that the
rule keys on that column, not independently re-verified for this specific tag by re-push-and-requery.
If the assumption is wrong, `build.yml`'s pull of this image is a hard dependency with no silent
fallback to the old bridge-only config — a failure here fails the build closed, with a pull error
naming the missing tag, not a quiet security regression.

**Owner: Oleg.** The clean fix is adding this tag's exact shape to the live `keep_pattern` in the
Forgejo database — the same class of change every other `keep_pattern` entry in this project has
needed an operator for (the rule lives ONLY in the DB, not restorable from this repository). No
session that has worked on this story had DB access to do it directly. Once done, the weekly-refresh
workflow becomes a safety net rather than the only thing standing between this tag and expiry.

## Opened by review round 2/3 on PR 54, Epic 3 retro action item A1 (2026-08-19) — `build.yml`'s builder-image reference is not yet digest-pinned

✅ **RESOLVED 2026-08-19 — inside this PR, not by a post-merge follow-up.** The sequence this entry
originally described (merge first, then dispatch, then pin) turned out to be unnecessary and, worse,
undispatchable as written: `build.yml` already referenced the tag before the tag existed, so this
branch's own CI was red, which meant it could never merge under required checks (Story 2.6) to reach the
"merge first" step this entry's own sequence started with — a real deadlock, found by runs 755/756, not
reasoned about in the abstract. Closed by a **bootstrap exception** in
`build-buildkit-cni-image.yml`'s branch guard instead (first creation of an absent tag is not the
repoint the guard protects against; see [D26](../../docs/migration-decisions.md#d26) for the full
mechanism) — dispatched from THIS branch (run 759, success), which built `v1.0.0-buildkit-cni` from
this branch's own hardened `Dockerfile.buildkit-cni`, ran the full staging→verify→promote matrix, and
published the tag. The coordinator then read the digest from the registry (`read:package`, v2 API) and
supplied it; `build.yml`'s `driver-opts: image=` is now pinned to
`@sha256:d37900f2ebea1d806f87ead450f2ca097205df757d8b6711a90b416eec836317` — the same commit that
resolves this entry. Original entry follows, unedited, as the historical record of the problem this
closed (its own numbered sequence is superseded by the bootstrap path above, not followed).

**Owner: coordinator (the dispatcher), then whoever pushes the follow-up commit — not DB-only, unlike
the entry above.** Review round 2 on PR 54 required `build.yml`'s `driver-opts: image=` reference to be
a digest pin (`image=...@sha256:...`), not a bare tag — every build here carries a
`write:package`-scoped credential, and a floating tag is an unnecessary supply-chain surface. As of the
commit that opened this entry, `build.yml` still references the bare tag
`git.crm-prionex.com/crm/fe-prionex:v1.0.0-buildkit-cni` — not a fabricated or guessed digest, on
purpose: this session has no registry credentials with which to learn the digest of an image that
`.forgejo/workflows/build-buildkit-cni-image.yml` had not yet built under its new tag and new
default-deny `Dockerfile.buildkit-cni` at the time this was written. See
[D26](../../docs/migration-decisions.md#d26) for the full account.

**Required sequence to close this** (documented here, in `build.yml`'s own comment at the
`driver-opts:` step, and in D26 — three places, on purpose, so it survives whichever one a future reader
opens first):
1. Merge this PR.
2. Dispatch `build-buildkit-cni-image.yml` against `main`. Its own "Promote the verified staging digest
   to the permanent tag" step prints the resulting digest after the isolation matrix passes.
3. Replace the tag reference in `build.yml`'s `driver-opts: image=` line with `@<that digest>`, in a
   small, reviewable follow-up commit.
4. Only then dispatch `build.yml` (or `ci.yml`) as the integration test that exercises this round's
   default-deny ruleset specifically — dispatching against the bare tag from step 0 is a valid smoke
   test of the pipeline wiring, but it is NOT evidence the new ruleset is what actually ran, since the
   tag could in principle move between dispatch and pull.

This is a same-day, mechanical follow-up, not a design question — recorded as a deferred-work entry
rather than left only as a comment because it is a real, currently-open item with a required action, not
just context for a reader.

## Opened by review round 2 on PR 54, coordinator's registry read (2026-08-19) — the promote step in `build-buildkit-cni-image.yml` writes an index digest, not a manifest digest

**Owner: whoever performs the next real `v1.0.0-buildkit-cni` version bump.** The digest the coordinator
read for `v1.0.0-buildkit-cni` resolves to media type `application/vnd.oci.image.index.v1+json` (an OCI
image index), not a single platform manifest — `build-buildkit-cni-image.yml`'s promote step runs
`docker buildx imagetools create` without `--prefer-index=false`, the same shape Story 3.6 (D24) already
found and named for a different tag. Decided deliberately, not overlooked: `driver-opts: image=` in
`build.yml` resolves the index to this runner's own platform manifest at pull time either way, so the
current digest pin (`@sha256:d37900f2ebea1d806f87ead450f2ca097205df757d8b6711a90b416eec836317`) works
correctly as an index pin. Left as-is rather than spending an extra dispatch and tag rewrite to match
Story 3.6's single-manifest convention, because that rewrite can only happen through the guard's
main-only branch (the bootstrap exception is now closed — the tag exists) and therefore only after this
PR merges. **The next real version bump** (new `CNI_PLUGINS_VERSION` and/or base-image digest — already
required to produce its own live outcome matrix, D26) should also add `--prefer-index=false` to the
promote step for consistency with the rest of the project's convention, and record the new manifest
digest that results. This is a free byproduct of a bump that has to happen anyway, not a reason to force
an extra dispatch now.

## Opened by story 4.1 (2026-08-19) — two compose files now describe the same application, and the reason is unproven

**Owner: Story 4.9 (the cutover), and Oleg for the question underneath it.** Story 4.1's Task 1.4
returned verdict **(b)**: it could not be settled whether the GitHub copy of this repository still
receives commits, so `.github/workflows/CD.yml`'s copy path to the legacy stand is treated as live.
The parameterization therefore landed in a **new** `docker-compose.stand.yml`, and
`docker-compose.server.yml` was left untouched. **This is a recorded deviation from FR25**, which
says the existing file is parameterized in place.

**What could not be checked, precisely** — because "we looked and found nothing" is not what
happened: `/api/v1/repos/CRM/fe-prionex/push_mirrors` and the repo endpoint both return **HTTP 403**
(`"Only signed in user is allowed to call APIs."`). No Forgejo token exists on the dev machine, and
`~/.ssh/config` defines no alias for s1, where the tokens are host-local at `/root/.fj_token`. **The
mirror configuration was never read as absent — the request failed on authentication.** Under this
project's standing finding that an empty result is not evidence of safety, that resolves to "live."

**Cost of carrying it:** two files describing one application until Story 4.9 converges them, and
every story in between must know which one it is editing. **Cost of having got it wrong the other
way:** `CD.yml:201` force-removes `fe-prionex` by literal name before `up`, and a fail-closed file
landing there with an incomplete `.env` leaves the legacy stand down with no rollback path in this
repository — an NFR5 violation. The asymmetry is why the default was taken rather than the risk
reasoned away.

✅ **ANSWERED 2026-08-19 — Oleg: «GitHub не трогаем».** This closes the *action* and reaffirms D7 as
a standing directive: no GitHub interaction, ever. **Verdict (b) is permanent**, and the "collapse it
back to an in-place edit" escape is closed — using it would require knowing the mirror does not
exist, and the directive removes the means of finding out.

🔴 **But it does not close the fact, and Story 4.9 is the one that pays for that.** The cutover is,
by definition, the act of renaming/replacing/deleting `docker-compose.server.yml` — the exact file
`CD.yml:154-162` copies onto the legacy stand, with `:201` still force-removing the container by
literal name before `up`. Same NFR5 exposure as this story faced, and by then it will be **just as
unverifiable**.

**Standing instruction for Story 4.9:** plan the cutover assuming the path is live. Converge the two
files only after the legacy stand is decommissioned or provably no longer deployed to — **never as a
file rename in the repository**. "We think the mirror is probably dead" is not a cutover plan, and
this project's own record is that an empty result is not evidence of safety.

## Opened by story 4.1 (2026-08-19) — `docker compose config` is blind to network existence, and a gate built on it would pass a stand that cannot start

**Owner: Stories 4.3 and 4.8.** Found by matrix row 7, the discriminating run required by retro
action E5 — and it was not the thing row 7 was written to find. With all five variables set and
valid but `FRONTEND_NETWORK` naming a network that does not exist:

- `docker compose -f docker-compose.stand.yml --env-file … config` → **exit 0**, renders the whole
  file, `external: true` and all;
- `docker compose … up -d` → **exit 1**, `network <name> declared as external, but could not be found`.

`config` validates interpolation and syntax, not runtime state. **Any CI or pre-deploy gate that
proves a stand "valid" by running `config` alone will pass a stand that cannot start.** Only an
actual `up` catches this class. Relevant to Story 4.3 (deploy) and Story 4.8 (shared mechanics)
directly; noted here because the cheap-looking check is the one that will be reached for.

## Opened by story 4.1 (2026-08-19) — the guards cannot catch a wrong-but-valid value, and on the network axis that failure is silent

**Owner: nobody yet — this is a structural limit, recorded so it is not rediscovered.** The five
`${VAR:?…}` guards in `docker-compose.stand.yml` test **presence**, which is their entire mechanism.
A syntactically valid but *wrong* value — another stand's port, another backend's network — passes
every guard.

On the network axis that failure is **silent**, and Story 4.1 demonstrated it rather than asserting
it: a stand attached to a network with no Kong was simultaneously `Up (healthy)`, serving `200` on
its own port, and unable to resolve `crm-kong-gateway` at all (`getent hosts` → empty, exit 2). The
cause is structural: `nginx.conf:38-39` and `:49-50` use a variable upstream with a resolver, so
nginx serves static assets whether or not the gateway resolves, and the compose healthcheck probes
`127.0.0.1:80` — itself. `nginx.conf` is baked in at `Dockerfile.prod:56` and the image is
byte-identical across stands by design, so no compose-level change can fix it.

**What actually catches it is the check AC4 demands:** resolve `crm-kong-gateway` from **inside** the
running container and record what it resolves to. Story 4.2 owes this on s1 against the real
`crm-dev-network`. 🔴 **Absence of the alias there is a STOP, not a fallback to `crm-network`** —
falling back reproduces exactly the collision D4 and AC4's 2026-08-13 amendment exist to prevent.

## Opened by story 4.1 (2026-08-19) — the run ledger is OPEN, and the credential gap is now the second story to hit it

**Owner: Oleg, or any session with s1 access.** Story 4.1's ledger closed **OPEN**, in those words,
per retro action D4's second branch. Declared in advance (Task 2.4), not discovered at close: no
Forgejo API credential is reachable from a developer machine — the API returns 403 unauthenticated
and the tokens (`fe_tmp_1_7`, `fe_pkg_3_6`) are host-local to s1 at `/root/.fj_token`. The baseline
`action_run.id` could not be read for the same reason.

**This is the second story to hit it** (3.6 minted `fe_pkg_3_6` and hit the same wall from the other
side). D4 requires the ledger to close against a query and admits no self-reported substitute — so
as long as no session that does the work can also run the query, **every remaining story in Epics 4-6
will close its ledger OPEN by construction.** That is a process defect, not a per-story oversight,
and it is worth deciding once: either a read-only `action_run` query path reachable from a dev
machine, or an explicit acceptance that ledgers close asynchronously by whoever holds s1.

## 🔴 Measured on s1 2026-08-19 (Story 4.1) — the legacy DEV stand is not on s1, and the plan assumed it was for four stories

**Owner: Story 4.2 (premise), Story 4.9 (cutover shape).** Oleg granted SSH access to s1 after Story
4.1 was otherwise complete. One command settled a premise four stories had inherited without
measuring.

**s1 is `185.185.49.127`. The legacy DEV stand is `72.62.17.132`** (`README.md:136`; `CD.yml:157`
deploys to `secrets.DEV_SSH_HOST`). On s1 there is **no `fe-prionex` frontend container** running or
stopped, **no `~/crm-prionex` directory**, and **nothing listening on `8080`** — the only listener in
`8080-8085` is `127.0.0.1:8081`, `vm-cadvisor` publishing its own container port 8080. s1 runs 170
containers: the Forgejo runners, the `crm-dev` and `crm-preprod` stacks, `techno-finance` and
observability. No frontend stand among them.

**Amended, with markers:** `epics.md` FR25 `:228` and Story 4.2's AC1 `:1604`. Both stated s1 hosts
the legacy stand.

**What it changes:**

- **NFR5's exposure on s1 is zero.** Nothing Epic 4 does on s1 can reach the legacy stand. The
  "three stands coexist on s1" risk framing was never real — there will be two.
- **Story 4.1's verdict (b) is unaffected and arguably strengthened.** The blast radius was never
  host contention; it is `CD.yml` copying `docker-compose.server.yml` to `DEV_SSH_HOST` and running
  `docker rm -f fe-prionex` there. That host is live, and this plan has no access to it and no
  rollback path on it.
- 🔴 **Story 4.9's cutover is a cross-host traffic switch, not a file swap.** "Cut DEV over to the new
  stand" means moving `dev.crm-prionex.online` from `72.62.17.132` to s1 — DNS and TLS work. The
  story's current shape implies a same-host swap and needs re-scoping before it is written.

**The lesson is not new, which is the point.** FR25 already carries a 2026-08-15 amendment whose
recorded conclusion is *"the instruction not to look is what produced the wrong number."* This is the
same defect one layer up: the premise survived four stories because checking it required exactly the
SSH access the plan had told itself not to use.

## Closed 2026-08-19 (Story 4.1) — the ledger credential gap, and what the count actually showed

**The structural problem recorded above is resolved:** Oleg granted s1 access, so `action_run` can be
queried from a session that also does the work. Story 4.1's ledger closed **by query**, not OPEN.

🔴 **CORRECTED after the merge: declared 5, spent 7 — over by two, not under by one.** The first
close was published as "spent 4, under budget" and was taken **before the story had finished
spending**. That is the D4 failure mode itself, committed while closing a D4 ledger.

🔴 **The generalisable finding, worth more than this story's number: this project's declaration form
counts PUSHES, but a story costs `pushes + 1 PR-open run + 1 merge run`.** Opening the PR fires
`ci.yml` again on the same commit (D19 armed four `(pull_request)` contexts on the long-lived
branches); merging fires `build-main.yml`, a different workflow (`ci.yml` correctly ignores `main` —
D25 holds). Neither has a line in §7's declaration format, so **every ledger in this project has been
structurally capable of undercounting by two**, including ones closed by query — if the query ran
before the merge landed.

**Action for the story template:** the declaration gains two lines (PR-open, merge), and **a ledger
closed at PR-open is not closed** — it must be re-queried against the merge commit.

**What was right:** the review round *was* free — it ran before the first implementation push, so its
ten fixes shipped in the same push and cost zero extra runs. The overrun is entirely PR-open and
merge.

✅ **And it answers by counting the question every story so far had reasoned about:** *"do not assume
the `image` job's `uses:` expansion contributes exactly one `action_run` row."* **It contributes
zero.** Five pushes produced exactly five `ci.yml` rows; the reusable `build.yml` invoked via `uses:`
creates no row of its own. **Per-push cost is 1 `action_run`, not 2.** This part survived the
correction above — it is about pushes, and was measured across all five.

**Also worth keeping:** run 780 (`e0395fda`) was **cancelled**, superseded by the next push under
concurrency. A self-reported ledger would have counted it as a spend or missed it entirely — the
obvious guess here was 5. This is the concrete case for why D4 requires a query.

---

## Story 4.2 findings (2026-08-19) — the DEV stand is up, and the thing that provisions it next cannot reach it

🔴 **CORRECTED 2026-08-20 (Story 4.2 code review, finding H5) — "measured, not suspected" overstated
the finding; the paragraph below states what was actually measured and separates it from what was
inferred.** What is directly measured: the path is not in `container.options` or `valid_volumes`,
and `sudo -u forgejo-runner-deploy ls …` on the host returns `Permission denied`. Three further
things are **inferred**, not measured, and the option set below was incomplete because of it:
(i) `valid_volumes` constrains only what the **runner itself** bind-mounts into a job container — it
does not constrain what a job does **through** the `docker.sock` it already holds, which is
root-equivalent by D10's own documented exception; (ii) `docker-compose.stand.yml` declares no
`volumes:` and no host path, so compose and `--env-file` can in principle be rendered **inside the
job's own workspace** (the compose file is already in the repo) rather than requiring any host mount
at all; (iii) *"uid 1501 cannot read it"* measured the runner **supervisor** container's identity —
the deploy **job** runs in its own separate container (`deploy-base-dev-preprod:2026-08-07`), whose
uid is not recorded anywhere in this project and was never checked.

🔴 **Story 4.3 is blocked as currently specified.** `s1-deploy-dev-preprod` mounts into **every** job
container exactly what its `config.yml` `container.options` lists:

```
-v /var/run/docker.sock:/var/run/docker.sock
-v /opt/crm-preprod:/opt/crm-preprod
-v /opt/crm-dev:/opt/crm-dev
--add-host=git.crm-prionex.com:10.70.0.1
```

and `valid_volumes` — which that file documents as an allowlist filtering **all** bind mounts,
including the operator's own `options`, proven empirically in Story 1.6 (`[/var/run/docker.sock] is
not a valid volume, will be ignored`) — contains the same three paths and nothing else.

`~/crm-prionex/fe-prionex-dev/` (`/root/crm-prionex/fe-prionex-dev`) is in neither list, and `/root`
is `drwx------`, so a runner-mounted path to it does not exist today: `sudo -u forgejo-runner-deploy
ls …` → `Permission denied`. The runner **supervisor** container itself runs as `1501:988` — the
**job** container's own identity is a separate, unmeasured question (see (iii) above).

**The stand was left where AC1 names it** — four later stories cite that path, and
`docker-compose.stand.yml`'s own `:?` error messages spell it out. Inventing a mount was explicitly
out of this story's scope. **Five options, none chosen here** — three from the original record, two
added by the review:

1. add the path to **both** `options` and `valid_volumes` on a shared, multi-tenant runner owned by
   the platform;
2. move the stand into the already-mounted `/opt/crm-dev` — which is the `api-prionex` stack's own
   directory, so this couples the two teams' trees;
3. a separate `/opt/crm-fe-dev`, plus the same runner-config change;
4. **(new, H5)** have the deploy job bind-mount `/root/crm-prionex/fe-prionex-dev` into a helper
   container itself, through the `docker.sock` it already holds — root-equivalent by construction
   (D10), so `drwx------` does not stop it. Needs **no** runner-config change and no cross-team
   coupling;
5. **(new, H5)** render `docker-compose.stand.yml` and the five required variables inside the job's
   **own workspace** instead of reading a host path at all — the compose file is already in the
   repo, `--env-file` needs no host presence, and the five values (`COMPOSE_PROJECT_NAME`,
   `CONTAINER_NAME`, `FRONTEND_PORT`, `DOCKER_IMAGE`, `FRONTEND_NETWORK`) can come from Forgejo
   variables/secrets instead of a checked-out `.env`. Avoids the host-mount question for the compose
   file entirely; does not by itself answer AC1/FR26's "stand has a directory on the host" framing,
   which four later stories already cite.

**A consequence of options 1 and 3 not previously named: both allowlist the stand's path
READ-WRITE into every job container of every repository permitted on that four-label,
multi-tenant runner** — the inverse of the access-restriction AC2's deferred clause exists to
provide. Option 2 has the mirror problem in the other direction: `.env` sits inside a tree another
team's jobs already mount read-write and can `down`/`clean`/`rsync --delete`. Options 4 and 5 avoid
both shapes of that exposure, at the cost of (4) still needing the job's own uid answered, and (5)
being a bigger mechanism change than a mount.

**Owner: Story 4.3 (mechanism choice among all five), Oleg / platform owner (any runner-config
change, i.e. options 1 and 3 only).** Whatever is chosen also settles the next item, and it changes
Story 4.9's cutover shape.

🔴 **H4 (Story 4.2 code review, 2026-08-20) — even after the path question is settled, none of the
five options above supplies a working registry credential to the pull that deploy will need.**
`docker pull` / `docker compose pull` resolve auth from the **client's** `~/.docker/config.json` and
send it as `X-Registry-Auth`; the daemon itself holds no credential of its own. AC4's `docker login`
on s1 (`fe_reg_4_2_ro`, §3 above) authenticated an **interactive root shell** — its `config.json` is
not among any path `container.options`/`valid_volumes` allows into a job container under options 1-3,
and options 4/5 do not create or mount one either. **A job pulling a new image tag returns
`unauthorized` regardless of which path option is chosen**, unless the credential question is solved
as its own, separate step — e.g. a registry credential rendered into the job's own `config.json`
(mirroring option 5's approach for the compose file), or baking read access into whichever mount path
is chosen. **Owner: Story 4.3**, named as an explicit constraint alongside the path question, not
assumed solved by solving the path.
✅ **CLOSED, Story 4.3, 2026-08-20 (this is the H4 Task 9.3 meant to close — code review M12 found
the earlier closure note landed on a DIFFERENT bullet, "the registry credential has no detector,"
below, which is real but not this one).** `deploy-dev.yml` renders the job's OWN `read:package`
credential (`REGISTRY_USER_RO`/`REGISTRY_TOKEN_RO`) into a workspace-scoped `DOCKER_CONFIG` inside
the job container itself, exactly the "rendered into the job's own config.json, mirroring option
5's approach for the compose file" solution named above — `docker login` runs inside the job,
`docker pull` reads that same job-scoped config, and this has now pulled successfully on every
live dispatch since run 929. Not client-side-only and not solved by chance; the mechanism this item
asked for.

⚠️ **AC2's second clause is deferred, not passed.** "The file is readable only by the deploy user"
cannot be discharged until the reader is known (above). The stand took the recorded default —
`root:root`, `0700` on the directory, `0600` on `.env` — under which uid 1501 cannot read it.
**Owner: Story 4.3.**

📍 **s1 access, previously written down nowhere.** From a dev machine the working address is
`root@10.67.0.1` (equivalently `root@s1.private.crm-prionex.com`). The external `185.185.49.127:22`
**times out** — `ufw` admits 22 from two admin addresses only. `docs/migration-decisions.md` D10 is
amended in the same pass: its `72.62.17.132` = s1 claim is false and was the origin of a premise four
stories carried.

✅ **retro-E5 discharged on the real host, not simulated.** The `crm-kong-gateway` check succeeds
from inside the stand (`172.22.0.53`, identical to `crm-dev-kong-gateway`'s address on
`crm-dev-network`, with Kong itself answering `no Route matched` and `X-Kong-Response-Latency`) and
**fails** from a throwaway container on the built-in `bridge` network (empty, `exit 2`). Both
branches, one command, same host.

⚠️ **AC5 substituted, and the substitution is the deliverable.** "Both stands healthy on this host"
is unobservable from s1 — the legacy stand is on `72.62.17.132`, unreachable and fenced off by Story
4.1's verdict (b). Recorded instead: new container healthy on `8082`; no container named exactly
`fe-prionex` on s1 (checked with an **anchored** match — `docker ps --filter name=` is a substring
match and would have returned the four `forgejo-runner-fe-prionex*` containers plus this story's own
stand, i.e. it cannot fail); no competing compose project; legacy host not contacted.

🔴 **H1 (Story 4.2 code review, 2026-08-20) — the stand's image tag falls outside the live retention
rule and is deleted on or about 2026-09-02, with nothing pointing back here.** `.env` on s1 carries
`DOCKER_IMAGE=…:sha-62e2ff8dc215-dev`. The live `package_cleanup_rule` (id 1, `remove_days=14`)
protects only `keep_pattern`, whose sole `sha-` alternative is `sha-[0-9a-f]{7,64}-(pre)?prod`
(`build.yml:962`) — a `-dev` tag does not match it, matching the exact string with `-prod` does, and
[migration-decisions.md:1903](../../docs/migration-decisions.md) already states the asymmetry
outright: *«`-prod` и `-preprod` вечны, а `-dev` истекает за 14 дней»*. `62e2ff8d` merged
2026-08-19, so the tag disappears from the registry **on or about 2026-09-02**. The running
container is unaffected (it holds the image locally), but any `compose up`, any re-pull, any reboot
after an image prune, and Story 4.3's first deploy against this exact ref all fail closed with
`manifest unknown`.
**Decision, per this project's own convention (D26's `v1.0.0-buildkit-cni` precedent considered and
rejected):** do **not** retag this image into a `keep_pattern`-permanent form. `-dev` tags are
deliberately ephemeral by design (D18/D20) — a long-lived DEV stand pinned to a 19-day-old commit
would misrepresent what "DEV" means on this project, and a pseudo-permanent `-dev` tag is a new kind
of orphan the retention model was not built for. **The remedy is a scheduled redeploy, not a
retag:**
- **Primary path:** Story 4.3 ships and its first deploy of this stand publishes a fresh tag,
  closing this naturally, well before 2026-09-02 in the ordinary case.
- **Fallback trigger, stated explicitly so it does not depend on 4.3's timeline:** if Story 4.3 has
  not shipped **by 2026-08-30** (three days of margin before the 2026-09-02 deletion), whoever holds
  s1 access must manually redeploy the stand against a current `main`-HEAD tag (`docker compose -f
  docker-compose.stand.yml --env-file .env pull && … up -d` from the stand directory, after updating
  `DOCKER_IMAGE` in `.env` to a live tag) before the old tag expires.
**Owner: Story 4.3 (primary path) / Oleg or whoever holds s1 access (fallback trigger, 2026-08-30).**
Retention rule itself is DB-only and out of scope for either path — see the standing note elsewhere
in this file about `keep_pattern` never being editable from this repository.
✅ **CLOSED, Story 4.3, 2026-08-20 — primary path landed (run 929, well before the 2026-08-30
fallback trigger). Correction from code review (DN3): the closure recorded at story-close was
over-claimed — it covered the primary (workflow) path only, and left the fallback path described
above pointing at the very tag this item is about.** `~/crm-prionex/fe-prionex-dev/.env` on s1 was
never touched by this story; it still carries `DOCKER_IMAGE=…:sha-62e2ff8dc215-dev` as written
above. If that fallback procedure were followed literally today, it would redeploy the stand onto
the tag that is about to be deleted — the opposite of what H1 asks for. **Rewritten, decided by
Oleg:**
- **The fallback trigger above is retired as written.** The primary path — dispatch
  `deploy-dev.yml` with `ref=main` — now covers the fallback case too: it requires no host access
  to s1 at all, resolves the CURRENT `main-dev` digest fresh on every run (never a stale pinned
  tag), and is strictly cheaper and safer than the manual `.env` edit + `docker compose pull`
  sequence this item originally specified. There is no longer a reason to prefer the manual path
  when the workflow path is available.
- **New, narrower fallback — only if Forgejo itself is unreachable**, so `deploy-dev.yml` cannot be
  dispatched at all: a local, NEVER-pushed docker tag,
  `git.crm-prionex.com/crm/fe-prionex:dr-backup-dev`, created on s1 pointing at the current live
  digest (`sha256:e66149a83…` as of 2026-08-20). The registry's `remove_days=14` rule only ever
  acts on rows IN the registry — a local-only tag on the host is invisible to it and cannot expire
  this way. Restore with: update `DOCKER_IMAGE` in the host `.env` to
  `git.crm-prionex.com/crm/fe-prionex:dr-backup-dev`, then `docker compose -f
  docker-compose.stand.yml --env-file .env up -d` from the stand directory — the same manual
  mechanics as before, now pointed at a tag the retention rule cannot touch.
- The host `.env` itself is deliberately left carrying its historical value — neither fallback path
  above requires updating it in advance, and rewriting it preemptively would just create a THIRD
  value to keep in sync (deferred-work.md's own §7/D29 two-sources-of-truth item, already open).
**Owner: closed. No further action pending** unless Forgejo becomes unreachable, in which case the
`dr-backup-dev` local tag is the documented answer.

🔴 **M7, decided by Oleg 2026-08-20 — the stand's port 8082 is being closed to `127.0.0.1` before
Story 4.9, not left on `0.0.0.0`.** The stand came up as `0.0.0.0:8082->80/tcp` (D28 §1); the review
flagged that reachability from the public internet was never checked, and that the neighbouring
`8081` (`vm-cadvisor`'s `docker-proxy`) is deliberately bound to `127.0.0.1` only. Decision: match
that precedent. **Verified locally (this session, Docker Desktop, no template change needed):**
`docker-compose.stand.yml`'s `ports:` line is `"${FRONTEND_PORT:?…}:80"` — compose's short syntax
already accepts an `IP:PORT` value for the host side, so setting `FRONTEND_PORT=127.0.0.1:8082`
(instead of the bare `8082`) in the stand's `.env` renders `"127.0.0.1:8082:80"`, confirmed both by
`docker compose config` (`host_ip: 127.0.0.1`) and by a real `up -d` (`docker ps` →
`127.0.0.1:8082->80/tcp`; the listening socket, checked with `lsof -nP -iTCP:8082 -sTCP:LISTEN`, is
bound to `127.0.0.1` only, not `0.0.0.0`). **No `docker-compose.stand.yml` or `.env.stand.example`
change is required** — this is purely a value change in the stand's own `.env` on s1.
**This session has no SSH access to s1** (no `~/.ssh/config` alias, same wall every prior story in
this file has recorded) — the change is therefore **not yet applied on the live stand**. Exact
command for Oleg (or whoever has s1 access) to apply and verify it:
```bash
# on s1, from the stand directory
cd ~/crm-prionex/fe-prionex-dev
sed -i 's/^FRONTEND_PORT=.*/FRONTEND_PORT=127.0.0.1:8082/' .env
docker compose -f docker-compose.stand.yml --env-file .env up -d
docker ps --filter name=fe-prionex-dev --format 'table {{.Names}}\t{{.Ports}}'   # expect 127.0.0.1:8082->80/tcp
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8082/                 # from s1 itself: expect 200
# from OUTSIDE s1 (a developer machine, or the public internet): expect connection refused/timeout
```
**Owner: Oleg — apply before Story 4.9.**
✅ **CLOSED, moot by idempotence, Story 4.3, 2026-08-20.** `deploy-dev.yml` renders
`FRONTEND_PORT=127.0.0.1:8082` into the stand's `.env.deploy` on EVERY deploy (Task 4.4) — no
manual application was ever needed once the workflow existed; the value applies itself, every
time, as a side effect of any deploy. Confirmed live on s1, run 929/938's own state: `docker ps`
shows `127.0.0.1:8082->80/tcp`, and the actual listening socket (`lsof -nP -iTCP:8082
-sTCP:LISTEN`) is bound to `127.0.0.1` only, not `0.0.0.0`. No manual `sed`/`up -d` on s1 was
performed or needed — the workflow's own first successful run already carried this decision.

---

## Deferred from: code review of story-4.2 (2026-08-20)

Four items the review judged real but not this story's to close, plus one added by the 2026-08-20
fix-pass (M1, below) that could not be closed for lack of s1 access. The high/medium findings are
action items in `4-2-…md`'s `### Review Findings`, not here — these are the ones with no owner
inside 4.2.

- 🔴 **M1 — `/root/.fj_reg_4_2.raw` on s1: a second plaintext copy of the registry credential, of
  unknown mode/owner/contents, not covered by the recorded revocation trigger.** Flagged by the
  2026-08-20 code review; could not be closed by the same day's fix-pass because that session had no
  SSH access to s1 (no `~/.ssh/config` alias — the same wall recorded elsewhere in this file for
  every prior story). **Owner: whoever next has s1 access.** Check `/root/.fj_reg_4_2.raw` — record
  its mode and purpose (mirroring the `.token` file's documented `0600`), or delete it if it is a
  stray copy, and correct Story 4.2's Task 9.4 ("confirm nothing was left behind") if it turns out
  something was.
  ✅ **CLOSED, Story 4.3, 2026-08-20 (Task 3.4).** `/root/.fj_reg_4_2.raw` — mode `600`, root-owned,
  80 bytes, mtime matching the original mint operation — confirmed (leading bytes plus a `diff`
  against `.fj_reg_4_2.token`) to be the raw CLI output of the same mint command (label text + the
  same token value), not a distinct credential. Served no ongoing purpose; deleted. A companion
  `.fj_reg_4_2.err` (0 bytes, empty stderr capture from the same mint) deleted alongside it. Only
  `/root/.fj_reg_4_2.token` remains on s1. Story 4.2's Task 9.4 needs no correction — nothing beyond
  this stray copy was found.

- 🔴 **The registry credential has no detector, and this story is the proof that it needs one.**
  Story 4.2 established that s1's `docker login` vanished on **13 Aug** with cause unknown, then
  reconstituted the identical single point of failure: one host-local token, one `config.json`, no
  probe, no alert. The recorded revocation trigger — *"revoke when s1 no longer pulls from the
  registry"* — is an event with no observer. Failure path: the login disappears again → the running
  container is unaffected → it surfaces as `unauthorized` at Story 4.3's first deploy, with nothing
  pointing back here. **Owner: whoever settles the deploy mechanism (4.3) or platform ops.** A
  periodic authenticated `GET /v2/…/tags/list` from s1 is the cheap version.
  ✅ **CLOSED, Story 4.3, 2026-08-20 (H4).** `deploy-dev.yml`'s digest-resolve step classifies a
  `401` from the registry with its own message naming the credential specifically (`REGISTRY_USER_RO
  /REGISTRY_TOKEN_RO ... missing, wrong, or revoked — NOT that the image is missing`), on EVERY
  deploy — the detector this item asked for, now running on every dispatch, not merely available.
  Proven live, not asserted: run 936 (Task 8.3's discriminating row, via the new
  `simulate_bad_credential` test input — kept as a permanent, safe, input-gated regression hook so
  this detector can be re-earned cheaply after any future change, see `deploy-dev.yml`'s own header
  comment on that input). The single-host-local-token failure mode this item named is a separate,
  still-open risk (the credential itself is still one token with no independent health probe) — this
  closure is specifically about the missing DETECTOR, which now exists and fires correctly.
- ⚠️ **`fe_reg_1_10_ro` (id 99) has no disposition.** This file already records that whether it is
  still live in the instance *"is **not** established by this story — only that s1 no longer holds
  it."* The branch nobody has walked: if the 13-Aug actor holds the plaintext, that is a live
  `read:package` token of unknown custody — and per the entry above, an admin cannot revoke another
  account's token without its password or a DB row. Recorded as unknown is the right answer; leaving
  it with no owner is not. **Owner: Oleg**, same decision surface as the `fe_review_1_7` question.
- ⚠️ **Reboot ordering: `restart: always` + `external: true` is a silent restart loop, not a loud
  failure.** Story 4.2's Task 7.4 leans on `external: true` refusing to start as *"the only loud
  failure available on this axis"* — but that refusal is **compose-time**. On daemon start the
  container is started by the restart policy, not by compose: if `crm-dev-network` is absent, or was
  recreated with a new id by the backend team's `down`/`up`, the start fails, `always` retries
  forever, and the healthcheck never runs because the container never runs. Nothing reports it. No
  boot-ordering statement and no post-reboot verification exists anywhere. **Owner: Story 4.3
  (post-deploy check) / Story 4.9 (cutover readiness).**
- ⚠️ **The stand's endpoint now blocks the network owner's teardown, and they were not told.** Docker
  refuses `network rm` while an endpoint is attached, so `CRM/api-prionex`'s `docker compose down` on
  `crm-dev` now trips over a container in a compose project they cannot see from their tree. If they
  resolve it by force-disconnecting our container, the stand serves `200` on `/` with a dead `/api/`
  and reports `healthy` throughout — the exact silent failure Story 4.2's Dev Notes §4.1 names. This
  is also the concrete reason AC3's one-shot identity proof wants a **recurring** guard rather than a
  single measurement. **Owner: Story 4.3 (guard), plus a heads-up to the backend team.**
  ✅ **Guard half CLOSED, Story 4.3, 2026-08-20 (Task 7.5).** `deploy-dev.yml`'s Kong alias guard
  runs on EVERY deploy, not once — `getent hosts crm-kong-gateway` plus a live `GET /api/` checked
  for Kong's own `"no Route matched"` signature, discriminating (per D28 §2's own method) an address
  alone from Kong itself actually answering. If the backend team's teardown ever force-disconnects
  this stand, the NEXT deploy's own guard fails loudly instead of silently serving a dead `/api/` as
  healthy. **Still open: the heads-up to the backend team itself** — this story had no channel to
  deliver it; owner remains whoever next talks to `CRM/api-prionex`.

---

## Deferred from: code review of story-4.3 (2026-08-20)

Four items routed `defer` by the Opus three-layer code review of Story 4.3
(`4-3-deploy-a-feature-branch-to-dev-on-demand.md`, `### Review Findings`). Each is real, none is
actionable inside 4.3's scope. The review's `decision`/`patch` findings stay in the story file.

- 🔴 **No rollback to the previous digest once `down` has run.** `deploy-dev.yml`'s AC3 reordering
  (resolve → pull → `down` → `up -d` → health) protects the **pull-failure** window only, and the
  workflow header's blanket framing ("nothing is torn down until the replacement image is provably
  present") reads wider than what it covers. Once `down` at `deploy-dev.yml:542` has run, six later
  steps can fail — `up -d`, the health poll, the anchored check, the fallback HTTP check, AC6, the
  Kong guard — and each leaves the stand stopped or unhealthy: the previous container is already
  removed, the previous digest was never captured, and there is no `if: failure()` path to restore
  it. **Run 937 is the live proof** — the stand stayed genuinely unhealthy until run 938 was
  dispatched by hand. Story 4.7 AC4 ("*the stand keeps serving its previous version*") therefore
  holds for exactly one of the several ways this deploy can fail. The cheap version: capture the
  running container's digest before `down` and restore it on `if: failure()`.
  **Owner: Story 4.7 (the AC that requires it) / Story 4.8 (shared mechanics).**

- ⚠️ **Two sources of truth for the stand's five variables.** The host `.env` in
  `~/crm-prionex/fe-prionex-dev/` (manual/DR path) and `deploy-dev.yml`'s own render into
  `.env.deploy` (`deploy-dev.yml:513-520`, authoritative for deploys) now carry the same five values
  independently, with nothing keeping them in step. Named in D29 §7 and assigned there to 4.8/4.9;
  recorded here so it is tracked where the other open items live rather than only inside a decision
  record. Note the review found the same class *inside* the workflow file as well (finding H3: the
  container name and port are hardcoded in the verification steps instead of read back from the
  `.env.deploy` the job just wrote) — that half is a patch in the story, not deferred.
  **Owner: Story 4.8 (shared definition) / Story 4.9 (cutover).**

- ⚠️ **The ref→tag scheme is lossy: two different refs can share one image tag.** `build.yml`'s
  sanitizer maps every run of characters outside `[a-zA-Z0-9._-]` to a single `-`, so `feature/foo`
  and a real branch named `feature-foo` both produce `feature-foo-dev` (verified in review); refs
  sharing a 100-character prefix collide the same way via `cut -c1-100`. A deploy can therefore ship
  a different branch's image than the operator asked for, and AC6's digest comparison still passes,
  because it compares against the digest the registry served **for that tag**. Pre-existing —
  inherited from the tagging scheme, not introduced by 4.3. The deploy-side mitigation (compare the
  image's `org.opencontainers.image.revision` label, which `build.yml:1358-1361` already stamps,
  against the SHA the deploy actually checked out) is finding H4 in Story 4.3 and is cheap; changing
  the *scheme* is not 4.3's to do. **Owner: whoever revisits the tagging scheme (Epic 3 follow-up).**

- ⚠️ **No image cleanup on s1; digest-pinned pulls accumulate unpruned.** Every dispatch pulls by
  digest (`deploy-dev.yml:416`) and nothing prunes, so each deploy leaves another image on the host.
  Unbounded disk growth across repeat dispatches, and a full disk surfaces as a `docker pull` or
  `up -d` failure with no attribution back to this cause — on a host shared with another team's
  production. Belongs with the reboot-ordering item already recorded above, which has the same owner
  and the same "state of s1 between deploys" character. **Owner: Story 4.9 / platform ops.**
