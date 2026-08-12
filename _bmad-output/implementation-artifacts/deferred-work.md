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
  *Original finding, kept for the reasoning:*
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
- **`ci-bot` vs `robot-registry` substitution — for Story 1.10.** `epics.md:94` (FR10), `:209` (NFR6), `:299` and `:722` name
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
  rewritten); `:299` (the FR summary table) and `:722`/`:1076` (Story 1.12/3.1's own mentions) are
  intentionally left for those stories to amend when they run — out of this story's scope. See
  `docs/migration-decisions.md#d14`.
- ⚠️ **Whether org secrets are exposed to workflows in `CRM/fe-prionex` — «не проверено», Story
  1.12 depends on the answer.** Story 1.8 authored a job (`probe-docker-push` in
  `.forgejo/workflows/probe-actions.yml`, on the now-deleted `probe/action-compat` branch) that
  referenced `secrets.REGISTRY_USER` and `secrets.REGISTRY_TOKEN_RW`, gated behind an explicit
  `workflow_dispatch` input defaulting to `false`. That job was **never dispatched with the
  enabling input** — see next entry — so this session produced no direct evidence either way.
  Repo-level secrets are confirmed empty (`[]`); whether the **org**-level secrets resolve inside a
  repo workflow at all was not established.
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
