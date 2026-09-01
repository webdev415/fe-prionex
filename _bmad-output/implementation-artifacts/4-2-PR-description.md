# Story 4.2: Provision the New DEV Stand on s1

The DEV stand is up on s1 — `8082`, `crm-dev-network`, healthy, running the image built from `main`
HEAD. Three things in this PR are worth more than that outcome, and two of them are corrections to
records the project has been acting on.

## The stand

`~/crm-prionex/fe-prionex-dev/` created from nothing — neither it nor `~/crm-prionex` existed on s1.
Inside: `docker-compose.stand.yml` (sha256 verified byte-identical to the repo) and `.env` at `0600`
with all **five** required values, not the three the epic's AC names:

| | |
|---|---|
| `COMPOSE_PROJECT_NAME` | `fe-prionex-dev` |
| `CONTAINER_NAME` | `fe-prionex-dev` — never `fe-prionex`, which `CD.yml:201` force-removes by literal name |
| `FRONTEND_PORT` | `8082` |
| `DOCKER_IMAGE` | `git.crm-prionex.com/crm/fe-prionex:sha-62e2ff8dc215-dev` (`main` HEAD — a commit, not a branch) |
| `FRONTEND_NETWORK` | `crm-dev-network` |

Brought up with `up -d` from the stand directory, never `config` and never from a repo checkout.
`Up (healthy)`, `0.0.0.0:8082->80/tcp`, ip `172.22.0.70`, digest matching what the registry reports.
No network was created by any step.

## The Kong alias — proven by identity, and proven to be capable of failing

AC3 asks whether the stand reaches the **new** DEV Kong. "It resolves" would not have answered that.

- From inside the container: `getent hosts crm-kong-gateway` → `172.22.0.53`.
- `crm-dev-kong-gateway` on `crm-dev-network`: `172.22.0.53`, aliases `[crm-dev-kong-gateway kong
  crm-kong-gateway]`. **Same address.**
- Kong itself answering, through the stand's own nginx: `GET :8082/api/` → `404`,
  `X-Kong-Response-Latency: 1`, body `{"message":"no Route matched with those values"}`.
  `GET :8082/` → `200`.
- **The discriminating negative (retro-E5):** the same lookup from a throwaway container on the
  built-in `bridge` network → empty, `exit 2`.

Story 4.1 demonstrated the failure mode locally with a fake Kong. This is the same proof on the real
host, including the branch where it fails.

## 🔴 s1 had no registry credential, and two records said otherwise

Measured before touching anything: `/root/.docker/config.json` = `{"auths":{}}`, 16 bytes, mtime
**13 Aug 12:34**; anonymous pull → `unauthorized`.

`deferred-work.md` called `fe_reg_1_10_ro` "s1's live pull credential — a deliverable, not
scaffolding". `migration-decisions.md` D14 said the read-only login was **deliberately left in
place**. Neither describes the host. The mtime is *after* Story 1.10 closed on 12 Aug, which also
rules out the one obvious explanation — **who removed it is unknown, and this PR records it as
unknown rather than guessing.**

Fixed: `fe_reg_4_2_ro` minted on `robot-registry` with `read:package` **only**, value written to
`/root/.fj_reg_4_2.token` (`600`) and never printed, `docker login` re-established. Scope proven **by
refusal** — `docker push` → `401 Unauthorized` on the manifest `PUT`, and the probe tag does not
exist in the registry (`404`). It is a standing token by construction, so its owner and revocation
trigger are recorded in `deferred-work.md` at mint time rather than at the end.

## 🔴 The finding that blocks Story 4.3

`s1-deploy-dev-preprod` mounts into **every** job container exactly what its `container.options`
lists — `docker.sock`, `/opt/crm-preprod`, `/opt/crm-dev` — and its `valid_volumes` allowlist filters
*all* bind mounts, including the operator's own `options` (proven empirically back in Story 1.6).
`/root/crm-prionex/fe-prionex-dev` is in neither list, and `/root` is `drwx------`:
`sudo -u forgejo-runner-deploy ls …` → `Permission denied`. The runner runs as `1501:988`.

**So Story 4.3's deploy job cannot reach the path this story's own AC1 names.** Three options are
written up in D28 §4 — extend the shared runner's config, move into the backend team's `/opt/crm-dev`,
or a new `/opt/crm-fe-dev` plus the same config change. **None is chosen here.** Choosing means either
editing a multi-tenant runner owned by the platform or coupling our tree to another team's, and the
story's own Task 4.2 said to record it, not to invent a mount.

Related correction: the runner has **all four** labels registered (`deploy-dev-preprod`, `dev`,
`preprod`, `deploy`) per its `.runner` file — `deferred-work.md` said one.

## Two recorded deviations

- **AC2's "readable only by the deploy user" is deferred, not passed.** The reader is undetermined
  until the above is settled. Default taken: `root:root`, `0700`/`0600`. uid 1501 cannot read it.
  Owner: Story 4.3.
- **AC5's "both stands healthy on this host" is substituted.** The legacy stand is on
  `72.62.17.132`, unreachable and fenced off by Story 4.1's verdict (b). Recorded instead: new
  container healthy on `8082`; **no container named exactly `fe-prionex`** — checked with an anchored
  match, because `docker ps --filter name=` is a substring match that would have returned the four
  `forgejo-runner-fe-prionex*` containers and this stand, i.e. it could not have failed; no competing
  compose project; legacy host not contacted.

## Records corrected (bodies untouched, amendment blocks added)

- **D10** — *«Оба адреса указывают на s1»* is false. `72.62.17.132` is the legacy DEV host, not s1.
  That paragraph, written expressly so a later story would not confuse the two, **is the origin of a
  premise four stories carried.** Also newly recorded: s1 is reachable from a dev machine at
  `root@10.67.0.1`; the external `185.185.49.127:22` times out (`ufw` admits two admin addresses).
- **D14** — the "s1's read-only login left in place" sentence no longer matches the host.

New record **D28** covers the stand, the alias evidence, the credential, the 4.3 blocker, both
deviations, and the s1 resource budget (closed with numbers: 80 GiB available, 529 GB free, 104
cores, 170 containers — the budget was never the risk).

## Run ledger — declared, deliberately still OPEN

Baseline **802** (queried, `total_count 272`). Declared **7** = 4 pushes + 1 PR-open + 1 merge,
**plus one extra `ci.yml` row per push landing while the PR is open** (`ci.yml:65-71` states this
outright: two runs per push for a branch that is both pushed and in an open PR), **plus** any run
cancelled by concurrency.

Story 4.1 declared 5 and spent 7, and its own closeout still missed the three runs its second PR
cost (798, 799, 802 — visible in this story's baseline query). **This ledger stays OPEN until it is
re-queried after the merge commit lands.** Tasks 1.6 and 10.6 are unchecked for that reason.

## ⚠️ One thing for Oleg that is not about this story

The first ledger query sent the whole `FJ_TOKEN=<value>` line from `/root/.fj_token` as the bearer
token. Forgejo's `401` echoed the presented string back, so **the value of `fe_review_1_7`
(`platform-admin`, `write:repository,read:organization`) entered this session's transcript** — which
breaks the standing rule recorded for it. No file in this repository contains it. Revocation of a
`platform-admin` token is your call; the routes are your own Applications page or a DB row.

## Review scope

Per retro-E5, review a foundation story before the story built on it: this one founds 4.3, 4.9 and
(by pattern) 5.2 and 6.10. Worth the reviewer's attention in particular —

1. whether the `/opt` vs `~/crm-prionex` question should have been *decided* here rather than
   recorded, given four stories cite the path;
2. whether the AC5 substitution is honest or convenient;
3. whether the run-budget declaration is finally right, or wrong in a new way;
4. the unknown in the credential story — is "unknown" the correct answer, or is there a route to
   finding out who removed the login on 13 Aug.
