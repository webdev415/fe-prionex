---
baseline_commit: 08803a17
---

# Story 5.2: Provision the PRE-PROD Stand on s1

Status: review

<!-- Contexted 2026-08-24 (local; the measurements below are timestamped in UTC and were taken
     2026-08-23 20:52–21:10 UTC) against `main` at `08803a17` — the merge of PR #75, Story 5.1's
     ledger closeout. (Contexting began at `90836b99`, PR #74; #75 landed mid-session and this file
     was rebased onto it. That matters: 5.1's ledger-attribution method, cited in Dev Notes §5,
     arrived with #75 and is not in #74.)
     Branch `story-5-2/pr-1-context`. Every autonomous decision in this file is marked "autonomous,
     subject to Oleg's veto" and they are listed together in Dev Notes §9 so a veto costs one read
     rather than a re-derivation. Story 4.9 is in flight on `story-4-9/*` at the same time — §12
     states what this story may not touch, and it is not advice. -->
<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a release engineer,
I want a PRE-PROD stand reachable at its own address,
So that a release candidate can be validated the way a user would experience it.

---

## 🚨 Read this before anything else

### 1. What this story is, in one paragraph

Story 4.2 built the DEV stand on s1. Story 5.1 proved the PRE-PROD *backend* contour exists and is
isolated from DEV. **This story builds the PRE-PROD frontend stand — the preprod parallel of 4.2 —
and it is the first story in Epic 5 that creates anything.** Four things get provisioned: the stand
directory on s1, the container attached to `crm-preprod-network`, an nginx vhost plus a Let's
Encrypt certificate for `crm.preprod.crm-prionex.online` (the one piece of PRE-PROD infrastructure
that genuinely does not exist anywhere), and a registry pull credential on the host. Everything
else Epic 5 needs already exists and was measured, not assumed.

⚠️ **The stand will be reachable and healthy at the end of this story and browser API calls will
still fail.** PRE-PROD's Kong sends a static, wrong `Access-Control-Allow-Origin`
(`http://localhost:8320`). That is `CRM/api-prionex`'s defect, an external ask is already out, and
it is **not** this story's to fix. Task 8 measures it from the real frontend origin and records it.
Saying "the stand works" without that sentence would be the exact failure mode Story 5.1 named:
*configured wrong is worse than unconfigured — it looks done and fails only in a browser.*

### 2. Measured state of s1, 2026-08-23 20:52–21:10 UTC, from the context session

SSH to s1 worked from this context session — `ssh root@10.67.0.1` (the **private** address; the
external `185.185.49.127:22` times out by `ufw` design, D28 §6). Every row below was obtained
first-hand by this session. **They are the prior, not this story's evidence — re-measure them.**

| # | Fact | Measured value |
|---|---|---|
| a | Host identity | `hostname` → `NLDW3-3-42-32` |
| b | `~/crm-prionex/fe-prionex-preprod/` | **Does not exist.** `ls` → `No such file or directory`. `~/crm-prionex/` contains exactly one entry: `fe-prionex-dev` |
| c | Port `8083` | **FREE** — absent from `ss -lntp`. `8081` still `127.0.0.1` `docker-proxy` (vm-cadvisor); `8082` `127.0.0.1` (DEV stand) |
| d | DEV stand | `fe-prionex-dev`, `Up 6 hours (healthy)`, **`127.0.0.1:8082->80/tcp`** — D28's M7 amendment is applied on the live host |
| e | 🔴 DEV stand's compose project source | `docker compose ls` → config file `/workspace/CRM/fe-prionex/stand-checkout-1150/docker-compose.stand.yml` — **the job workspace, not the host directory**. Live confirmation of D28 option (e) |
| f | 🔴 DEV host `.env` has **drifted** from the running stand | host file says `FRONTEND_PORT=8082` (bare) and `DOCKER_IMAGE=…:sha-62e2ff8dc215-dev`; the live container runs `…@sha256:57477edb2094…`, revision `06224481d72a08bf38083f1b4997f6066e5f8785`, bound `127.0.0.1:8082`. See §5 |
| g | Lock file | `/root/crm-prionex/fe-prionex-dev/.deploy.lock`, 0 bytes, `-rw-r--r--`, mtime 2026-08-23 16:52 — normal, per `deploy-stand.yml:2419-2422` |
| h | 🔴 Registry credential on s1 | `/root/.docker/config.json` `auths` → **`[]` — EMPTY.** D28 §3 recorded a live `git.crm-prionex.com` login after Story 4.2. It is gone again. See §6 |
| i | `crm-preprod-network` | exists, **69** containers. `crm-dev-network` → **70** (the DEV stand is the +1) |
| j | PRE-PROD Kong | `61eb0eaa9f64` `crm-preprod-kong-gateway`, `Up 9 days (healthy)`, `10.70.0.1:8320->8000/tcp`. Matches 5.1's `61eb0eaa9f640e23…` |
| k | 🔴 `crm.preprod.crm-prionex.online` over TLS | `subject=CN=admin.techno-finance.online` (LE `YE2`, notAfter Nov 13). **Falls through to the default vhost — no vhost, no certificate.** `api.crm.preprod…` by contrast serves its own `CN=api.crm.preprod.crm-prionex.online` |
| l | nginx on s1 | **host process**, `/usr/sbin/nginx`, `systemctl is-active` → `active`. `nginx -t` passes (one pre-existing `conflicting server name "admin.techno-finance.online" on 0.0.0.0:80` warning — **not ours, do not chase it**) |
| m | `sites-enabled/` | `technofinance`, `technofinance.bak.2026-05-04`, and four `zz-`prefixed symlinks: `zz-crm-stands`, `zz-crm-stands-acme`, `zz-forgejo-acme`, `zz-forgejo-platform` |
| n | `/etc/letsencrypt/live/` | `admin.techno-finance.online`, `api.crm.dev.crm-prionex.online`, `api.crm.preprod.crm-prionex.online`, `git.crm-prionex.com`, `roshhub.net` — **no `crm.preprod…`**. `certbot 2.9.0`, webroot `/var/www/acme` exists |
| o | `ufw` | `80/tcp` and `443/tcp` `ALLOW Anywhere`; `22/tcp` allowed from two admin addresses only |
| p | Local `-preprod` images on s1 | **none.** 20 `fe-prionex` images cached, all `-dev`/`<none>`/old probes |
| q | Deploy runner labels (`/opt/forgejo-runner-deploy/data/runner/.runner`) | `s1-deploy-dev-preprod` with **four** labels: `deploy-dev-preprod`, `dev`, **`preprod`**, `deploy` — all `docker://deploy-base-dev-preprod:2026-08-07`. See §7 |
| r | Deploy runner `container.options` | `-v /var/run/docker.sock:… -v /opt/crm-preprod:… -v /opt/crm-dev:… --add-host=git.crm-prionex.com:10.70.0.1`; `valid_volumes` lists the same three. `/root/crm-prionex/*` is **still** unreachable directly — D28 §4 is current |
| s | Ledger baseline | `select max(id), count(*) from action_run` on `forgejo-postgres` → **`1170 | 1170`**, 2026-08-23T21:02:08Z |
| t | 🔴 certbot renewal hooks | `/etc/letsencrypt/renewal-hooks/deploy/` and `.../post/` are **both empty**; no renewal config declares `renew_hook`. `certbot.timer` is active. **Nothing reloads nginx on renewal** — host-wide, pre-existing, affects the neighbour too. See Task 8.3a |
| u | Existing renewal config shape | `authenticator = webroot`, `webroot_path = /var/www/acme` — match it |

### 3. 🔴 The host stand directory is NOT optional, and it is NOT purely a record

This is the single most important correction this story carries, and getting it backwards costs
Story 5.3 a failed dispatch.

D28's chosen option (e) — confirmed live at §2 (e) — means the deploy job renders the compose file
and `.env.deploy` **in its own workspace** and never reads the host `.env`. It would be easy to
conclude the host directory is therefore decorative. **It is not.** `deploy-stand.yml` asserts,
through a sibling container, that `<stand_dir>` exists **and contains
`docker-compose.stand.yml`**. It does this in two places — `:334-342` and `:1473-1481` — but be
precise about which one a real deploy hits: `:334-342` is inside the `hold-lock` job, reachable only
via the `hold_lock_seconds` testing input. **On the real deploy path exactly one assertion fires**,
`:1473-1481`, inside the *Acquire the stand lock* step. One is enough; two is not the claim. The lock file itself lives at `<stand_dir>/.deploy.lock`.

So the split is:

| Artifact in `~/crm-prionex/fe-prionex-preprod/` | Status |
|---|---|
| the directory itself | **hard precondition for 5.3.** `stand_dir: /root/crm-prionex/fe-prionex-preprod` is a required input; the lock is taken inside it |
| `docker-compose.stand.yml` | **hard precondition for 5.3.** Asserted present by two separate steps before any mutation. Its *contents* are not read by the deploy path (the job uses its own checkout) — but its *presence* is a gate |
| `.env` | **record / DR only.** Nothing on the deploy path reads it. It exists so a human can bring the stand up by hand if Forgejo is down, and so the intended values are written down somewhere durable |

**And the record drifts.** §2 (f) is the proof, on the DEV stand, today: the host `.env` still names
a bare `8082` and a tag that the stand has not run for days. `deferred-work.md:2887-2895` already
carries "two sources of truth" as an open item. This story does not solve it — but it must **not**
write PRE-PROD's `.env` as though it were authoritative. Task 4.5 labels the file for what it is.

### 4. What "provisioned" has to mean here, or the story proves nothing

Four claims, and each has a way of being false that looks exactly like success:

1. **"The container is up."** A stand on a backend-less network reports `healthy` and serves `200`.
   The healthcheck probes `http://127.0.0.1:80` — *itself* — and `nginx.conf:37-45` resolves Kong
   lazily through a variable upstream, so nginx starts happily with no Kong at all
   (`.env.stand.example:91-109`, demonstrated in Story 4.1 Task 6.2). **Health status is not
   evidence about the backend. Ever.**
2. **"It reaches PRE-PROD's Kong."** Name resolution is a weaker claim than identity. `crm-kong-gateway`
   resolving proves a name exists, not *which* Kong owns it. D34 §3 records that even
   "compare the container IDs of `crm-preprod-kong-gateway` and `crm-dev-kong-gateway`" is vacuous —
   two containers selected *by different names* are guaranteed to have different IDs. The correct
   form, and the one D34's own revision trigger hands to this story: resolve the alias from inside
   **this stand's** container, then look the resolved address up in **`crm-preprod-network`'s own
   `.Containers[]` map**, and compare *that* container ID against the DEV network's.
3. **"The name serves over TLS."** `crm.preprod.crm-prionex.online` already answers on 443 today —
   with somebody else's certificate. A probe that only checks "443 responds" returns the expected
   answer whether or not this story did anything. The discriminator is the **subject CN**, plus a
   negative control on a sibling name that has no vhost.
4. **"Registry access is configured."** A pull that succeeds proves the credential works; it does
   not prove the credential is *read-only*. 4.2's Task 5.4 established the form: prove the scope
   **by refusal** — a `docker push` that returns `401` on the manifest `PUT`.

### 5. The five variables, and the two that are different from DEV

`docker-compose.stand.yml` requires **five**, every one `${VAR:?…}` with no default (D27). The
epic's AC1 names three explicitly — plus *"the agreed PRE-PROD network"* in prose, so four of the
five in substance. Only `DOCKER_IMAGE` is genuinely absent. A `.env` missing any one of the five
cannot start the stand.

| Variable | PRE-PROD value | Why |
|---|---|---|
| `COMPOSE_PROJECT_NAME` | `fe-prionex-preprod` | FR26 convention; also the base of the lock holder's name, `<project>-deploy-lock-<run id>` (`deploy-stand.yml:107`) |
| `CONTAINER_NAME` | `fe-prionex-preprod` | **never** the literal `fe-prionex` — `CD.yml:201` force-removes that name on every legacy deploy, and `docker rm -f` is name-based and project-independent (measured, Story 4.1 Task 5.4) |
| `FRONTEND_PORT` | **`127.0.0.1:8083`** | 🔴 see below |
| `DOCKER_IMAGE` | `git.crm-prionex.com/crm/fe-prionex:sha-<12hex>-preprod` | Task 5 chooses the exact tag from what the registry actually holds. No `:latest` — cancelled by D20 |
| `FRONTEND_NETWORK` | `crm-preprod-network` | `external: true`. **Never** `crm-dev-network` (a different stand) and **never** `crm-network` (the legacy stand's, on a different host) |

🔴 **`FRONTEND_PORT` is `127.0.0.1:8083`, not `8083`, and not `0.0.0.0:8083` — and unlike DEV, this
is not a temporary measure.** D28's M7 amendment settled the *mechanism*: `FRONTEND_PORT` carries
the whole host-binding expression, `127.0.0.1:8083` renders valid compose short syntax
`"127.0.0.1:8083:80"`, and only the `.env` value changes — `docker-compose.stand.yml` and
`.env.stand.example` are not touched. For DEV, loopback binding was a stopgap "until the 4.9
cutover". **For PRE-PROD it is the permanent design**, because AC3 gives this stand a *better* front
door: nginx runs as a **host process** on s1 (§2 l), so `proxy_pass http://127.0.0.1:8083` reaches
the stand without the port ever being published to `0.0.0.0`. `ufw` allows 443 from anywhere and
allows nothing on 8083. Public reachability comes from the vhost; the docker publish stays private.
*Autonomous, subject to Oleg's veto.*

⚠️ Consequence for every verification step: **`127.0.0.1:8083` is unreachable from inside any
container, including the dev agent's own job container if one is ever used.** `deploy-stand.yml`
routes every such read through a `--network host` sibling container (`:2038`, `:2159`). From an SSH
session on s1 the host loopback is directly reachable and no such trick is needed — but do not write
a step that assumes one context and runs in the other.

### 6. The registry credential is real work again, and it is not on the deploy path

§2 (h): `/root/.docker/config.json` `auths` is **empty**. Story 4.2 minted `fe_reg_4_2_ro`, logged
in, and D28 §3 recorded `auths` containing `git.crm-prionex.com`. Something removed it — exactly as
something removed Story 1.10's login before 4.2 measured the same emptiness. **Record the state, do
not guess who or why** (4.2's precedent: *"Кем и чем — неизвестно, и записано именно так, без
догадки"*).

Two things follow:

- **The host login is not what makes 5.3 work.** `deploy-stand.yml` writes its own
  `DOCKER_CONFIG` into the job workspace from `secrets.REGISTRY_USER_RO` / `REGISTRY_TOKEN_RO`
  (`:993-1037`) and deletes it on every path (`:2441`). D28's H4 is the reasoning: `docker pull`
  authorises from the **client's** `config.json`, and the daemon holds no credential of its own.
  So AC4's host credential serves the **manual-pull proof** and the **DR path** — not the deploy.
  Say that in the record instead of implying 5.3 depends on it.
- **Check whether `fe_reg_4_2_ro` still authenticates before minting anything.** The token value
  may still be on the host from 4.2; a fresh `docker login` with the existing token is far cheaper
  than a new mint, and every Forgejo token minted here is standing by design — an admin cannot
  revoke another account's token (`docs/migration-decisions.md#d14`, D28 §3). **Plan the exit
  before minting**, at mint time, in `deferred-work.md` — not at the end of the story.

### 7. 🔴 Two facts the artifacts carry that this story must not repeat

**(a) `secret/fe/pre-prod/app` does not hold a placeholder.** `epics.md:2169-2171`,
`build.yml:596-597` and `deferred-work.md:1803-1807` all still say it holds
`PLACEHOLDER-preprod-backend-not-provisioned`. Oleg wrote **version 2** on 2026-08-15:

```
secret/fe/pre-prod/app  version 2
  VITE_API_BASE_URL = https://api.crm.preprod.crm-prionex.online
  VITE_WS_URL       = wss://api.crm.preprod.crm-prionex.online
```

recorded in `3-3-build-per-environment-images-with-explicit-variables.md:112,725-731` and confirmed
on 2026-08-17 by extracting the bundle layer of a real preprod build (run 680,
`deferred-work.md:2067-2088`).

⚠️ **But be precise about the epistemic status: D34 §5 states plainly that Story 5.1 did not
re-verify this.** It is a *recorded* fact, not a fresh reading. **This story is the first consumer
that actually depends on it** — a stand built from a placeholder bundle is unusable by construction
— so Task 5 verifies it *the way this story can*: by extracting `VITE_API_BASE_URL` from the bundle
of the actual image it is about to run. That is a stronger check than reading the secret, because it
tests the artifact rather than its input.

⚠️ Path spelling, because none of the four derives from another by concatenation: the Forgejo
secrets say `PREPROD`, the OpenBao role is `fe-pre-prod`, the KV path is `secret/fe/pre-prod/app`,
the tag suffix is `-preprod`. `secret/fe/preprod/app` **does not exist** (D15, `build.yml:415-425`).

**(b) `Dockerfile.prod:34` is stale by 22 lines.** The `COPY nginx.conf` line is at
**`Dockerfile.prod:55-56`**. Nine artifacts still cite `:34`. Do not add a tenth — cite `:55-56`.

### 8. The `runner_label` in `deploy-stand.yml`'s caller skeleton is wrong, and 5.3 inherits it

`deploy-stand.yml:216` (the commented PRE-PROD caller skeleton) suggests
`runner_label: deploy-preprod-preprod`. **No such label exists.** §2 (q), measured on the runner's
own `.runner`: `s1-deploy-dev-preprod` registers exactly `deploy-dev-preprod`, `dev`, **`preprod`**
and `deploy`. The correct value for 5.3 is **`preprod`** (or `deploy-dev-preprod`, which is what DEV
uses today — the same runner and the same job image either way).

🔴 **This story records that finding and routes it. It does not fix it.** `deploy-stand.yml` is
Story 4.8's shipped artifact and every edit to it re-triggers Epic 5 re-earning of the evidence 4.8
paid for. It is also inside Story 4.9's blast radius (§12). Task 9 writes it to `deferred-work.md`
with **Story 5.3** as the owner.

### 9. What Story 5.3 is owed by this story, in one place

1. `/root/crm-prionex/fe-prionex-preprod/` exists and contains `docker-compose.stand.yml` — the
   precondition `deploy-stand.yml` asserts before it will take the lock (`:1473-1481`, §3).
2. A PRE-PROD image exists in the registry with a known tag and a known digest, and its bundle is
   proven to carry the real PRE-PROD URLs (Task 5).
3. The correct `runner_label` is recorded (§8), so 5.3's caller does not copy the skeleton's wrong one.
4. `expect_unrouted_api: "false"` is **decided** by D33 — and **this story does not revisit it**
   and must not write a workflow that would. ⚠️ But hand 5.3 the fact in its real shape, not a
   flattered one: D34 §6 says the corrected in-network measurement *"не опровергает
   `expect_unrouted_api: "false"` (D33), но и не подтверждает заявленное обоснование «PRE-PROD's
   Kong роутит реальные сервисы» буквально для `/api/`"* — PRE-PROD's Kong returned the same
   `404 no Route matched` DEV gives. **Not refuted is not settled.** `"false"` only *relaxes* the
   guard, so it is safe either way; the *rationale* written into `deploy-stand.yml:158` is what has
   not been confirmed.
5. `crm.preprod.crm-prionex.online` serves the stand over TLS, so 5.3's deploy can be validated the
   way a user would experience it — *except* for cross-origin API calls, which stay broken until
   `CRM/api-prionex` fixes the static CORS (§1, Task 8).

### 10. Deviations this story takes from the epic's literal text

| Epic text (`epics.md:2202-2234`) | This story | Forced by |
|---|---|---|
| AC1 names three variables explicitly (plus the network in prose) | **five**, named as five — `DOCKER_IMAGE` is the one genuinely absent | D27: `docker-compose.stand.yml` has no defaults; a `.env` short of any one of the five cannot start the stand |
| AC1 `FRONTEND_PORT=8083` | **`127.0.0.1:8083`** | D28 M7 + §5. The bare form publishes on `0.0.0.0` on a host with a public IP |
| AC2 "**three stands** now share s1" | **two** — DEV and PRE-PROD | FR25's 2026-08-19 amendment: the legacy stand is on `72.62.17.132`, not s1. Discharge like 4.2's AC5: prove the two on s1 are distinct, state that the legacy host was not contacted |
| AC3 "the DNS name and certificate **from Story 1.6**" | 1.6 delivered neither for this name | §2 (k)(n). The name resolves; the vhost and certificate do not exist and are **ours**. This is the story's largest single piece of real work |
| AC4 "it uses the `read:package` token" | the token from 1.10 is long gone and 4.2's login has been removed again | §2 (h), §6. Reuse `fe_reg_4_2_ro` if it still authenticates; mint only if it does not |
| — | **AC5 added**: the stand reaches PRE-PROD's Kong, proven by container identity from inside the running container | D34's own revision trigger names Story 5.2 and the N4 identity-match form. An epic AC that says "provisioned" and never says "reaches the right backend" is the failure this whole epic exists to prevent |
| — | **AC6 added**: the CORS boundary measured from the real frontend origin and recorded, not fixed | §1. Closing the story silently would hand 5.3 a stand that looks finished |

Each is *autonomous, subject to Oleg's veto*, and each is repeated at the AC it changes.

### 11. Run budget model

retro-D4 (`epic-3-retro-2026-08-18.md:77`): **declare before work; the ledger closes only against a
query re-run after the merge commit lands.** A ledger closed at PR-open is not closed. If the query
cannot be run, close it with the literal word **OPEN** — never a self-reported number.

🔴 **The permanent story-push line (DN4 of Story 4.7's review, standing for every story since):**
*"pushes to the story's own context/work branch" is a repeating, per-push ledger line, priced per
push, not one flat "closeout push"* — each is a real four-job `ci.yml` run. Size it against the
expected number of write-up rounds. Also standing (`deferred-work.md:2515-2547`): a story costs
**pushes + 1 PR-open run + 1 merge run**, and every ledger form before 4.1 could undercount by two.

**This story's shape:** the host-side work — directory, `.env`, `up -d`, vhost, certbot, registry
login, every verification — **dispatches nothing and costs zero runs.** The only run-costing item is
Task 5's contingency: if no usable `-preprod` image exists in the registry, one `build.yml` dispatch
with `environment: preprod`. Budget it explicitly and separately (Task 1.3).

🔴 **A preprod build mints a PERMANENT tag.** `sha-<12hex>-preprod` matches `keep_pattern`
(`build.yml:962`) and never expires; removing one needs an authorised DELETE plus a `write:package`
token, *"which has twice required Oleg in person"* (`build.yml:1073-1076`). **Prefer an existing tag
over minting a new one**, and if minting, mint from `main` HEAD and say in the ledger that the cost
is irreversible. (The good news, and it is worth stating because it is the opposite of DEV: **this
stand does not inherit D28's H1.** `-preprod` tags are permanent by design, so the PRE-PROD stand
has no 14-day expiry clock on its image the way `sha-62e2ff8dc215-dev` did.)

### 12. 🔴 Story 4.9 is in flight right now. This is a hard boundary, not a courtesy.

Story 4.9 (*Cut DEV Over to the New Stand*) is being implemented in parallel on `story-4-9/*`. The
coordinator serializes host-side work between epics; Oleg merges.

**This story must not modify, and must not push any change to:**

- `.forgejo/workflows/deploy-stand.yml` — **read-only reference.** Editing it re-triggers Epic 5
  re-earning of the evidence Story 4.8 paid for. This story needs no change to it (§8, §9).
- `.forgejo/workflows/deploy-dev.yml`, `.forgejo/workflows/dev-reset.yml`
- `README.md`, `docker-compose.server.yml`, or any artifact of Story 4.9
- `4-9-cut-dev-over-to-the-new-stand.md`, or any `story-4-9/*` branch
- **the DEV stand on s1** — its directory, its `.env`, its container, its network membership, its
  lock file

**Reading them is required.** `docker network inspect crm-dev-network`, `docker inspect` on the DEV
container and `docker compose ls` are read-only and are how AC2 and AC5 get measured.

⚠️ **Design for this:** 4.9 may change the DEV stand underneath this story's measurement. Every
DEV-side observation must be **timestamped in UTC** and stated as *the state observed at that
moment* — never as 4.9's end state. If the DEV stand appears mid-cutover, record what was seen and
say so. Do not wait, do not retry until it looks tidy, do not touch it.

⚠️ **No-touch window (pro forma this week).** The Sunday `dev-reset.yml` tick is **2026-08-30
02:00 UTC**; the standing rule is **no dispatch and no live lock holder across 01:45–02:30 UTC**,
and no `main` merge inside it. This story is expected to close well before then and dispatches
nothing on the DEV stand — noted so that nobody has to rediscover the rule if it slips.

---

### Prohibitions

🚨 **A prohibition here cannot be overridden by a subtask.**

1. **Never `docker network create`.** `crm-preprod-network` belongs to `CRM/api-prionex` and already
   exists. `external: true` refusing to start is the *only* loud failure on this axis; creating the
   network converts that refusal into a silent, empty, backend-less network that comes up healthy
   (`.env.stand.example:99-109`, `CD.yml:185`'s anti-pattern). And never `docker network rm`,
   `connect` or `disconnect`.
2. **Never `docker rm -f` by name.** Rollback is `docker compose --env-file .env -f
   docker-compose.stand.yml down` from the stand directory. This host carries ~170 containers
   including another tenant's entire DEV and PRE-PROD stacks.
3. **Do not restart, stop, recreate or `down` anything that is not this story's own container** —
   most especially not `crm-preprod-kong-gateway` or any of the 69 containers on
   `crm-preprod-network`, and not the DEV stand (§12).
4. **Do not reload or restart nginx without `nginx -t` passing first**, and never with `-s reload`
   before the test. nginx on s1 serves another tenant's production site (`technofinance`) and both
   Forgejo vhosts. A bad reload takes them all down.
5. **Preserve the `zz-` symlink prefix.** `sites-enabled/*` loads alphabetically and `default_server`
   is declared nowhere, so the first matching block on a listen socket becomes its default. A file
   named `crm-*` would load before `technofinance` and **steal the default-vhost role for
   `0.0.0.0:80` from the neighbour**. The existing headers spell this out; do not undo it by
   "tidying" a symlink name.
6. **Do not edit the neighbour's files.** `technofinance`, `technofinance.bak.2026-05-04`,
   `zz-forgejo-acme`, `zz-forgejo-platform` are out of bounds. The pre-existing
   `conflicting server name "admin.techno-finance.online" on 0.0.0.0:80` warning from `nginx -t` is
   **not this story's** — record that it pre-existed and leave it.
7. **Do not use `certbot --nginx`.** It rewrites vhost files it does not own and pulls in
   `options-ssl-nginx.conf`, which certbot overwrites on its own upgrades — the existing vhosts
   deliberately set TLS parameters inline to avoid exactly that (`crm-stands` header). Use
   `certonly --webroot -w /var/www/acme`.
8. **Do not modify `deploy-stand.yml`, `deploy-dev.yml` or `dev-reset.yml`, and create no new
   workflow file.** §12. The **only** workflow edit this story may make is the stale *comment* at
   `build.yml:596-597`, and only as Task 9.4 decides — a comment in a build workflow, not a deploy
   path. Everything else on this axis is forbidden.
9. **No `${{ }}` inside any `run:` body — not even inside a shell comment.** Forgejo substitutes
   inside comments too (`build.yml:796-799`) and one empty token once rejected an entire workflow
   with no diagnostic. Vacuously satisfied if no workflow is written; stated because a "tiny helper"
   is exactly how it gets violated.
10. **Never print a token value.** Story 4.2's own review found one in a transcript
    (`deferred-work.md:39-54`). `/root/.fj_reg_4_2.token` and `/root/.fj_token` hold live
    credentials; `.fj_token` holds `FJ_TOKEN=<value>`, not a bare token — extract with
    `cut -d= -f2-`. A sudden `401` is a pending revocation, not a bug.
11. **Never reach OpenBao through `/usr/local/bin/bao`.** It is a world-readable wrapper that
    silently authenticates as `admin` and once turned nine isolation checks into nine false
    positives (`deferred-work.md:701-712`). HTTP with an explicit `X-Vault-Token` only.
12. **Never fall back to `crm-network` or `crm-dev-network`.** An unresolvable `crm-kong-gateway`
    from inside the PRE-PROD container is a **STOP**, not a prompt to try another network
    (`.env.stand.example:108-109`, `deploy-stand.yml:2132`).
13. **Do not close a row you did not measure.** `UNPROVEN` / `OPEN` / `PENDING (owner: name)` /
    *not claimed* are four different dispositions and are not interchangeable.
14. **Do not edit `deferred-work.md` in place.** **New** findings append at EOF; **closures of
    existing entries** go immediately **under the original entry**, with the superseded text struck
    (`~~…~~`) and never deleted. Owners are names or story numbers, never trigger conditions.
    (Prohibition 12 of Story 5.1, as resolved by its coordinator audit.)
15. **Do not `docker image prune`, or any host-wide sweep.** `docker ps --filter name=` is a
    substring match on this host (`deferred-work.md:2668-2673`) and this is a multi-tenant machine —
    FR23's own amendment exists because of this.
16. **A subagent report is not evidence.** Every number in this story's evidence tables must be
    obtained first-hand by the dev agent, from the host, the network or the wire.

---

## Acceptance Criteria

Verbatim from `_bmad-output/planning-artifacts/epics.md:2202-2234`, with this story's reading where
measurement has overtaken the plan. Every reading is *autonomous, subject to Oleg's veto*, and each
is also listed in §10 and Dev Notes §9.

### AC1 — the stand directory and its `.env`

> **Given** the parameterized compose file from Story 4.1
> **When** the PRE-PROD stand is provisioned
> **Then** it lives in `~/crm-prionex/fe-prionex-preprod/`
> **And** its `.env` sets `FRONTEND_PORT=`~~`8081`~~**`8083`** (amended 2026-08-15: `8081` is taken
> on s1, measured), a distinct `CONTAINER_NAME`, a distinct `COMPOSE_PROJECT_NAME`, and the agreed
> PRE-PROD network.

> 🔴 **Reading — two changes, both forced.**
> **(i) Five variables, not three.** `docker-compose.stand.yml` requires `COMPOSE_PROJECT_NAME`,
> `CONTAINER_NAME`, `FRONTEND_PORT`, `DOCKER_IMAGE`, `FRONTEND_NETWORK`, every one `${VAR:?…}` with
> no default (D27). A `.env` carrying only the three named here **cannot start the stand**. All five
> are in scope; `DOCKER_IMAGE` is covered by AC4, `FRONTEND_NETWORK` by AC5.
> **(ii) `FRONTEND_PORT=127.0.0.1:8083`, not `8083`.** §5. The bare form publishes on `0.0.0.0` on a
> host with a public IP; the loopback form is permanent here because AC3's vhost is the front door.
> **And the directory is a hard precondition for 5.3, not a record** — `deploy-stand.yml` asserts
> `<stand_dir>/docker-compose.stand.yml` is present before it will take the lock (`:1473-1481`;
> `:334-342` asserts it too, but only on the `hold-lock` test path — §3). The
> `.env` in it *is* record/DR only, and must be labelled as such.

### AC2 — the stands on s1 are mutually distinct

> **Given** three stands now share s1
> **When** all are running
> **Then** their ports, container names and compose projects are mutually distinct
> **And** none appears in another's compose project.

> 🔴 **Reading: two stands share s1, not three.** FR25's 2026-08-19 amendment, measured: the legacy
> stand is on `72.62.17.132`; s1 (`185.185.49.127`) has never carried it. Discharge as Story 4.2's
> AC5 was discharged — prove the two that *are* here are distinct on every axis, prove s1 holds no
> container named exactly `fe-prionex`, and state that the legacy host was not contacted.
> ⚠️ **The `--filter name=` trap:** `docker ps --filter name=fe-prionex` is a **substring** match on
> this host and matches the four `forgejo-runner-fe-prionex*` containers *and both stands* — it
> cannot fail and therefore proves nothing. Anchored form:
> `docker ps -a --format '{{.Names}}' | grep -x fe-prionex` must exit 1 with no output.

### AC3 — the frontend name serves over TLS

> **Given** the DNS name and certificate from Story 1.6
> **When** ~~`preprod.crm-prionex.online`~~ **`crm.preprod.crm-prionex.online`** is configured
> **Then** it resolves to the PRE-PROD stand
> **And** it serves over TLS with a valid certificate.

> 🔴 **AMENDED 2026-08-15, and measured again 2026-08-23 by this context session.** Story 1.6
> delivered neither the vhost nor the certificate for this name. The name **resolves**
> (`185.185.49.127`) and 443 **answers** — with `CN=admin.techno-finance.online`, s1's default
> vhost. This is the one piece of PRE-PROD infrastructure that genuinely does not exist, and it is
> **ours**. `api.crm.preprod.crm-prionex.online` by contrast has served its own certificate since
> 2026-08-14 — the API side is done.
> **Discharge requires all three:** (a) an nginx `server` block for the name proxying to the stand;
> (b) a Let's Encrypt certificate issued for the name via `certonly --webroot`; (c) an end-to-end
> HTTPS `GET /` from **outside s1** returning `200` with `subject=CN=crm.preprod.crm-prionex.online`.
> "Reachable from the host" does not discharge (c) — the whole point is the path a user takes.

### AC4 — registry access, and the first image

> **Given** the stand is provisioned
> **When** registry access is configured
> **Then** it uses the `read:package` token
> **And** a manual pull of a `-preprod` tagged image succeeds.

> 🔴 **Reading — three parts.**
> **(i) Measured 2026-08-23: `/root/.docker/config.json` `auths` is empty.** 4.2's login is gone,
> exactly as 1.10's was gone when 4.2 measured it. This is real work, not a confirmation step.
> Record the state without guessing who removed it.
> **(ii) "the `read:package` token" is a scope, not an identity.** Story 1.10's token has no
> recoverable plaintext and 4.2 already substituted `fe_reg_4_2_ro`. Reuse `fe_reg_4_2_ro` if it
> still authenticates; mint a new `read:package`-only token **only** if it does not, and record the
> revocation owner and trigger **at mint time** — an admin cannot revoke another account's token.
> **(iii) The scope must be proven by refusal, not asserted** — a `docker push` under a throwaway
> tag must return `401` on the manifest `PUT`, and the tag must be absent from the registry
> afterwards (4.2 Task 5.4). ⚠️ 4.2's review finding **L8** narrows what that proves: if the layers
> are already in the registry, `Layer already exists` means no blob write was ever attempted — **the
> manifest `401` alone is the evidence.** Say so; do not overclaim the blob half.
> **(iv) 🔴 "a manual pull succeeds" is not enough to close this AC.** A pull proves the credential;
> it says nothing about whether the artifact is usable. The pulled image's **bundle must be shown to
> carry the real PRE-PROD URLs** and not `PLACEHOLDER-preprod-backend-not-provisioned` (Task 5.3).
> Without this clause the strongest verification in the story is anchored to nothing and can be
> skipped while every AC still reads as closed — a stand built from a placeholder bundle is unusable
> by construction, and it would look perfectly healthy.
> **And this credential is not on the deploy path** (§6, D28 H4). It serves the manual-pull proof
> and DR. `deploy-stand.yml` renders its own workspace `DOCKER_CONFIG` from
> `REGISTRY_USER_RO`/`REGISTRY_TOKEN_RO`.

### AC5 — 🔴 ADDED: the stand reaches PRE-PROD's Kong, by identity, from inside the container

> **Given** `nginx.conf:37-45` resolves the literal `crm-kong-gateway` inside whatever network the
> container is attached to, and the image is byte-identical across stands
> (`Dockerfile.prod:55-56` — **not** `:34`, that citation is stale by 22 lines)
> **When** the PRE-PROD stand is running on `crm-preprod-network`
> **Then** `crm-kong-gateway` resolves **from inside the running container** to an address which,
> looked up in **`crm-preprod-network`'s own `.Containers[]` map**, is `crm-preprod-kong-gateway`
> (`61eb0eaa9f640e23…` as of 2026-08-23)
> **And** the same lookup in `crm-dev-network`'s map yields a **different** container id
> **And** the check is shown capable of failing — the same lookup from a throwaway container on the
> built-in `bridge` network returns empty, exit 2.

> **Why added, and why in this exact form.** D34 §3's revision trigger names Story 5.2 and says so
> explicitly: *"Стоит перенести в Story 5.2/6.4 именно в этой форме, не в первой."* The rejected
> first form asked `.Id` of two containers **already selected by name** — guaranteed to differ
> whether or not anything is isolated. 5.1 could only run this from a throwaway container because no
> PRE-PROD frontend existed; **this story is the first that can run it on the real container**, which
> is what the epic's AC2 for 5.1 asked for and could not have.
> ⚠️ An unresolvable `crm-kong-gateway` is a **STOP** (Prohibition 12). Do not try another network.

### AC6 — 🔴 ADDED: the CORS boundary is measured from the real origin and recorded, not fixed

> **Given** PRE-PROD's Kong answers `Access-Control-Allow-Origin: http://localhost:8320` statically,
> with `Allow-Credentials: true`, unchanged under any supplied `Origin` (5.1, measured 2026-08-23)
> **And** the PRE-PROD bundle points the browser at `https://api.crm.preprod.crm-prionex.online`
> directly, so the browser makes a genuine cross-origin request
> **When** the stand is serving at `https://crm.preprod.crm-prionex.online`
> **Then** a preflight and a simple request carrying `Origin: https://crm.preprod.crm-prionex.online`
> are issued against the API host and the literal response headers are recorded
> **And** the story states plainly that browser API calls **will fail** until `CRM/api-prionex` fixes
> it, with the ask already sent and the owner named
> **And** nothing is changed on their side.

> **Why this is an AC and not a footnote.** Without it the story closes reporting a healthy stand on
> a valid certificate, and the first person to open it in a browser discovers the failure. *"Configured
> wrong is worse than unconfigured — it looks done and fails only in a browser."* This AC is
> discharged by a **recorded measurement with an owner**, never by a fix.
>
> **Two shape facts 5.1's fix-pass established — expect them, and record if they have changed:**
> Kong's CORS headers appear even on a route-miss `404`, which means the plugin is applied
> **globally, ahead of routing**, not attached per route. And the `OPTIONS` preflight returns `404`
> carrying the same static `Allow-Origin` / `Allow-Credentials` / `Expose-Headers` and **no
> `Access-Control-Allow-Methods` or `Access-Control-Allow-Headers` at all**. Both are useful to the
> team that has to fix it; record them rather than just "CORS is wrong".

---

## Tasks / Subtasks

### Task 1 — Declare the run budget before the first push (AC: all)

- [x] **1.1** Flip `sprint-status.yaml` `5-2-provision-the-pre-prod-stand-on-s1` to `in-progress`
      before anything else, so a session that dies mid-story leaves a true status.
- [x] **1.2** Take the ledger baseline **first-hand**, before the first push. Method D31, read-only:
      `docker exec forgejo-postgres psql -U forgejo -d forgejo -tAc "select max(id), count(*), now() at time zone 'utc' from action_run"`.
      This context session measured **`1170 | 1170` at 2026-08-23T21:02:08Z** — that is the prior,
      not your baseline. Re-run it. ⚠️ `action_run` ids are **instance-global**, so other repos
      inflate the delta; the API alternative (`GET /api/v1/repos/CRM/fe-prionex/actions/runs`) is
      repo-scoped and will not match — pick one and say which.
- [x] **1.3** Declare the budget with these lines, before pushing:
      - **pushes to `story-5-2/pr-1-context`** — priced **per push**, one four-job `ci.yml` run each
        (the permanent story-push line, §11). Size it against your expected write-up rounds; do not
        write one flat "closeout push".
      - **+1 PR-open run, +1 merge run** (`deferred-work.md:2515-2547`).
      - **contingency, Task 5:** at most **one** `build.yml` dispatch, `environment: preprod`. 🔴
        Flag in the same line that this mints a **permanent, effectively unremovable** tag.
      - **host-side work: 0 runs.** Everything in Tasks 2–8 is SSH and dispatches nothing.
- [x] **1.4** Note that no `paths` filter exists — a docs-only push costs a full CI run — and that a
      push landing while the PR is already open fires **both** `push` and `pull_request`, costing
      **two** rows.

### Task 2 — Establish host access and re-measure the premises (AC: 1, 2)

- [x] **2.1** Reach s1: `ssh root@10.67.0.1` (private; `s1.private.crm-prionex.com`). The external
      `185.185.49.127:22` times out by `ufw` design — that is not a fault.
- [x] **2.2** Re-measure §2 (b)(c)(d)(e)(f)(h)(i)(j)(p) first-hand and record each with a UTC
      timestamp. **They are the prior, not evidence** (Prohibition 16).
- [x] **2.3** Confirm `8083` is free with an anchored check, not an eyeball. ⚠️ `grep -c` exits **1**
      when the count is zero, so the *success* case aborts any `set -e` block — write it as
      `[ "$(ss -lntp | grep -c ':8083 ' || true)" = 0 ]`. If the port is taken, **STOP and record** — do not pick another port; the value is
      written into FR25, `.env.stand.example:66` and `deploy-stand.yml`'s caller skeleton, and
      changing it is a sprint-change proposal, not a story decision.
- [x] **2.4** Record the DEV stand's state as *observed at this moment* (§12) — it may be mid-cutover
      under Story 4.9. Do not wait for it to look tidy and do not touch it.

### Task 3 — Registry credential on the host (AC: 4)

- [x] **3.1** Prove the starting state before touching anything: read `/root/.docker/config.json`
      and record its `auths` keys, size and mtime. Attempt an **anonymous** pull of a known tag and
      record the literal failure. This is the "before" half of the discriminator.
- [x] **3.2** Establish whether `fe_reg_4_2_ro` is still usable — check whether
      `/root/.fj_reg_4_2.token` exists and whether it still authenticates. 🔴 **Never print the
      value** (Prohibition 10). If it authenticates, `docker login` with it and mint nothing.
      🔴 **Close Story 4.2's finding M1 while you are here — it is open and it is yours.**
      `4-2-…md:882-893` records a **second plaintext copy** of that unrevocable credential at
      **`/root/.fj_reg_4_2.raw`**, with no recorded mode, owner or contents, and an owner clause of
      *"whoever next has s1 access"* — which is this session. Inspect it (mode, owner, whether it
      duplicates `.token`), then either record its purpose or delete it, and close M1 explicitly.
      Task 9.8's "no second plaintext copy" assertion is not discharged by inspecting only what this
      story creates.
- [x] **3.3** Only if it does not: mint a new token, account `robot-registry`, scope **`read:package`
      only**, via `docker exec -u git forgejo gitea admin user generate-access-token -u robot-registry -t <name> --scopes read:package`
      (no account password needed). 🔴 **Record the revocation owner and trigger in
      `deferred-work.md` at mint time, not at story end** — an admin cannot revoke another account's
      token; scopes cannot be widened after minting. Store the value `0600`, host-local, and make
      sure only **one** plaintext copy exists (4.2's finding M1 was a forgotten second copy).
- [x] **3.4** Prove the scope **by refusal** (retro-E5 discriminator #1): retag any locally-present
      image under a throwaway tag and `docker push` it. Expect `401 Unauthorized` on the manifest
      `PUT`. Confirm the tag is **absent** from the registry afterwards, then remove the local
      retag. ⚠️ Record honestly per 4.2's L8: if the layers already existed, `Layer already exists`
      means no blob write was attempted — **the manifest `401` is the evidence, the blob half is
      not**.
- [x] **3.5** State in the record that this credential is for the manual pull and DR, **not** the
      deploy path (§6, D28 H4).

### Task 4 — Create the stand directory and its files (AC: 1)

- [x] **4.1** `mkdir -p /root/crm-prionex/fe-prionex-preprod`, mode `0700`, `root:root` — the same
      shape 4.2 used for DEV. `~/crm-prionex/` already exists (§2 b); only the leaf is new.
- [x] **4.2** Place `docker-compose.stand.yml` there from **this repository at the story's baseline
      commit**. 🔴 This file's *presence* is what `deploy-stand.yml` asserts before it will take the
      lock (§3) — it is not decoration. Do not hand-write it and do not use a heredoc copy, and do
      **not** create a repo checkout on s1 (Dev Notes §6). That leaves exactly one route: copy it
      from the dev machine's own checkout over the same SSH channel Task 2.1 established —
      `scp <repo>/docker-compose.stand.yml root@10.67.0.1:/root/crm-prionex/fe-prionex-preprod/`
      (or `ssh root@10.67.0.1 'cat > /root/crm-prionex/fe-prionex-preprod/docker-compose.stand.yml' < <repo>/docker-compose.stand.yml`
      if `scp` is unavailable — 4.2 used `scp`). ⚠️ **`scp` over this channel is not itself proven
      for this session** — if it fails, use the `cat >` form and record which you used.
      Then verify byte-identity: `sha256sum` on both ends must match. 4.2's DEV copy hashed
      `7f449dacce163fed898b06d3d3d204656b0f485fdbad1827c03c7aac9b1932ec` — expect a **different**
      value here only if the file has changed in the repo since; compute both, do not assume either.
- [x] **4.3** Write `.env`, mode `0600`, with all five values from §5. `FRONTEND_PORT` is
      **`127.0.0.1:8083`**. `DOCKER_IMAGE` is filled in by Task 5 — write the file after the tag is
      known, or write it twice and record both states; do not leave a `<CHANGE_ME>` behind.
- [x] **4.4** Confirm `CONTAINER_NAME` is **not** the literal `fe-prionex` and that neither
      `CONTAINER_NAME` nor `COMPOSE_PROJECT_NAME` collides with the DEV stand's.
- [x] **4.5** 🔴 Put a header comment in the `.env` naming it for what it is: **a record and DR copy,
      not the deploy path's source of truth.** Cite D28's option (e) and §3, and note that the DEV
      stand's equivalent file has already drifted (§2 f). A future reader who believes this file is
      authoritative will debug the wrong thing.
- [x] **4.6** Confirm nothing in `~/crm-prionex/fe-prionex-preprod/` is tracked by git and that no
      repo checkout was created on s1 — there is none today and this story does not add one.

### Task 5 — Choose the first image, and prove its bundle is real (AC: 4)

- [x] **5.1** With the credential live, **list what `-preprod` tags actually exist in the registry**
      and paste the listing verbatim. (4.2's review finding M3 was exactly this: the tag listing was
      never pasted, so the choice could not be audited — one item in a cluster of eight missing
      verbatim outputs, `4-2-…md:906-917`.) **Two permanent `-preprod` tags are already on record,
      and both have had their bundles extracted and proven clean:**
      - 🟢 **`sha-00ef3be4743d-preprod`** — pushed by **run 680** (2026-08-17), a `preprod` build of
        **`main`** that passed `build.yml`'s placeholder guard; bundle layer extracted and shown to
        carry the real PRE-PROD URLs (`deferred-work.md:2067-2088`). Permanent by design; *"no
        DELETE is needed"*.
      - 🟢 **`sha-f8f358f43ced-preprod`** — pushed by **run 593** (2026-08-15, 106 s, green,
        `3-3-build-per-environment-images-with-explicit-variables.md:735-744`), together with the
        separate probe tag `probe-3-3-preprod-preprod`. Its bundle was extracted too — 115 JS files,
        11 MB, `https://api.crm.preprod.crm-prionex.online` and `wss://…` present, `PLACEHOLDER`
        absent. `f8f358f4` is a **PR-head commit**, not `main`.
      **Prefer `sha-00ef3be4743d-preprod`** — not because the other is unproven, but because it is
      the one built from **`main`**, and a stand traceable to `main` is the sane bootstrap. Record
      that reason; do not repeat a "probe, therefore suspect" argument the evidence does not support.
      - `main-preprod` may also still exist — pushed by the same run 680 but a **14-day** tag
        (`<sanitized-branch>-preprod`), so it is at or past expiry. Do not build on it; if it is
        gone, that is the retention rule working.
- [x] **5.2** **Prefer an existing tag.** For each candidate, resolve its digest and record it. Do
      not mint a permanent tag to avoid one lookup.
- [x] **5.3** 🔴 **Prove the candidate's bundle carries the real PRE-PROD URLs, not the placeholder**
      (§7 a). The strong form: pull the image and extract `VITE_API_BASE_URL` from the built bundle
      inside it — e.g. `docker run --rm <image> grep -ro 'https://api\.crm\.preprod\.crm-prionex\.online' /usr/share/nginx/html | head`,
      and separately confirm the literal string `PLACEHOLDER-preprod-backend-not-provisioned` does
      **not** appear anywhere under `/usr/share/nginx/html`. A build predating 2026-08-15 will fail
      this — that is the check working, not a fault.
      ⚠️ This is a **stronger** check than reading the secret, and it is the one this story can
      actually run: D34 §5 records that 5.1 did **not** re-verify `secret/fe/pre-prod/app`, so the
      "version 2" fact is a record, not a fresh reading, and this story is its first real consumer.
      ⚠️ **Both run numbers are real; use the right one for the right tag.** 5.1's code review
      called run 593 "uncorroborated" because *5.1's own file* cited only 680 — but 593 is fully
      documented at `3-3-…md:735-744` and is the evidence for `sha-f8f358f43ced-preprod`. Run 680 is
      the evidence for `sha-00ef3be4743d-preprod`. Cite whichever matches the tag you pick, and do
      **not** repeat "593 appears nowhere else".
- [x] **5.4** If no existing `-preprod` tag passes 5.3: dispatch `build.yml` **once** with
      `ref: main`, `environment: preprod`. 🔴 Coordinator-run. 🔴 This mints a **permanent**
      `sha-<12hex>-preprod` plus a 14-day `main-preprod`; charge it to the Task 1.3 contingency line
      and state in the ledger that the cost is irreversible without Oleg. There is **no automatic
      path** that builds preprod — `build-main.yml:60-72` and `ci.yml:498-504` both pass
      `environment: dev` as a hard literal, deliberately (`build-main.yml:28-30`).
- [x] **5.5** Pull the chosen tag and confirm the pulled digest equals the registry's own
      `Docker-Content-Digest` for that manifest. Record tag **and** digest — 5.3 and 5.4 both need
      the digest, not the tag.
- [x] **5.6** Write the resolved reference into the stand `.env` as `DOCKER_IMAGE` (Task 4.3).

### Task 6 — Bring the stand up (AC: 1, 2, 5)

- [x] **6.1** Run from **inside** `/root/crm-prionex/fe-prionex-preprod/`, never from a repo
      checkout. The repo root's own `docker-compose.yml` declares `name: fe-prionex` and its
      `container_name` is `fe-prionex-dev` — it can adopt or collide.
- [x] **6.2** Export **none** of the five variable names into the invoking shell first. Compose
      resolves interpolation from the process environment **before** `--env-file` and **no `:?`
      guard fires** — reproduced on both compose v5.3.0 and s1's v5.1.3 (Story 4.1). Verify with
      `env | grep -E '^(COMPOSE_PROJECT_NAME|CONTAINER_NAME|FRONTEND_PORT|DOCKER_IMAGE|FRONTEND_NETWORK)='`
      returning empty.
- [x] **6.3** `docker compose --env-file .env -f docker-compose.stand.yml up -d`. 🔴 **`up`, not
      `config`** — `docker compose config` is blind to network existence and renders happily against
      a network that does not exist (Story 4.1 matrix row 7a: exit 0; 7b `up` → exit 1).
- [x] **6.4** 🔴 **No step may create `crm-preprod-network`** (Prohibition 1). Capture the network's
      id before and after and assert it is unchanged.
- [x] **6.5** Record `docker compose ls`, `docker ps`, and `docker inspect` on the new container:
      project name, container name, published port, network membership, IP, image digest.
- [x] **6.6** Confirm the running image's digest equals the digest resolved in Task 5.5 — compare
      digests, not tags.
- [x] **6.7** Confirm the published socket is loopback-only, and prove it rather than reading the
      compose output: `ss -lntp | grep ':8083 '` must show `127.0.0.1:8083` and nothing on
      `0.0.0.0`. (retro-E5: the corresponding negative is Task 7.5's external probe.)
- [x] **6.8** Rollback path if anything fails: `docker compose … down` from the stand directory.
      **Never** `docker rm -f` by name; **never** remove a network (Prohibitions 1, 2).

### Task 7 — Prove the backend, and prove the checks can fail (AC: 2, 5)

- [x] **7.1** From **inside** the running container:
      `docker exec fe-prionex-preprod getent hosts crm-kong-gateway`. Empty output is a **STOP**
      (Prohibition 12) — record it and stop; do not attach another network.
- [x] **7.2** 🔴 **Identity, in D34's corrected form.** Take the address from 7.1, then look it up in
      **`crm-preprod-network`'s own `.Containers[]` map** (`docker network inspect
      crm-preprod-network`) and read off the container id. Do **not** ask `.Id` of a container you
      selected by name — D34 §3 records that as the vacuity that got caught in code review. Assert
      the id is `crm-preprod-kong-gateway`'s (`61eb0eaa9f640e23…` as of 2026-08-23).
- [x] **7.3** Do the same lookup in `crm-dev-network`'s map and assert the id **differs**. Read-only;
      this touches nothing of Story 4.9's (§12).
- [x] **7.4** **Discriminating negative (retro-E5 #2).** The same lookup from a throwaway container
      on Docker's built-in `bridge`: `docker run --rm --network bridge alpine getent hosts crm-kong-gateway`
      → expect empty, **exit 2**. `bridge` already exists, holds no Kong, needs no creation and no
      cleanup; `--rm` is the cleanup. ⚠️ Record the caveat 5.1's fix-pass added: this resolves
      through the **host** resolver, not the embedded DNS `127.0.0.11` that `nginx.conf` actually
      uses — it is a valid control for "the name is not host-wide", not a model of nginx's path.
- [x] **7.5** **Discriminating negative (retro-E5 #3) — the loopback bind.** From **outside** s1,
      attempt `http://185.185.49.127:8083/` and record the connection failure. Paired with 6.7's
      `ss` output and Task 8's successful HTTPS request, this shows the port is private *and* the
      service is public, which is the whole design.
- [x] **7.6** Prove Kong is really behind the name, not just DNS: from the host,
      `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8083/` → `200` (static), and
      `curl -si http://127.0.0.1:8083/api/` → record the literal status, body and the
      `X-Kong-Response-Latency` header. A Kong answer, even a `404 no Route matched`, is
      categorically different from a DNS answer.
      ⚠️ The image is `nginx:alpine` and has **no `curl`** — use `wget` for anything run *inside* the
      container (the healthcheck already proves `wget` is present). `curl` on the **host** is fine.
- [x] **7.7** State explicitly that the healthcheck reporting `healthy` proves **nothing** about the
      backend (§4.1), so nobody later mistakes 6.5's output for 7.2's.
- [x] **7.8** **AC2's distinctness, anchored.** `docker compose ls` shows `fe-prionex-dev` and
      `fe-prionex-preprod` as separate projects; each container is in exactly one of
      `crm-dev-network` / `crm-preprod-network` and **not both**; ports `8082` and `8083` are
      distinct; and `docker ps -a --format '{{.Names}}' | grep -x fe-prionex` exits 1 with no
      output. Record that the legacy host `72.62.17.132` was **not contacted**.

### Task 8 — The vhost and the certificate (AC: 3, 6)

🚨 The highest-blast-radius task in this story. nginx on s1 serves another tenant's production site.
Prohibitions 4, 5, 6 and 7 all apply here and none is optional.

- [x] **8.1** Record the "before" state as the discriminator's first half:
      `echo | openssl s_client -connect 185.185.49.127:443 -servername crm.preprod.crm-prionex.online | openssl x509 -noout -subject -issuer -dates`
      → currently `subject=CN=admin.techno-finance.online`. Also record `nginx -t` output **before**
      any edit, so the pre-existing `conflicting server name` warning is on record as pre-existing.
- [x] **8.2** Add the ACME name: extend the `server_name` line in
      `/etc/nginx/sites-available/crm-stands-acme` with `crm.preprod.crm-prionex.online`. That file
      already serves `/.well-known/acme-challenge/` from `/var/www/acme` and redirects everything
      else to HTTPS. `nginx -t`, then reload. Do **not** rename the `zz-crm-stands-acme` symlink
      (Prohibition 5).
- [x] **8.3** Issue the certificate: `certbot certonly --webroot -w /var/www/acme -d crm.preprod.crm-prionex.online`.
      🔴 **Not `--nginx`** (Prohibition 7). Confirm `/etc/letsencrypt/live/crm.preprod.crm-prionex.online/`
      and its renewal config appear, and that the four existing renewal configs are untouched. Match
      the existing shape: `authenticator = webroot`, `webroot_path = /var/www/acme`.
- [x] **8.3a** 🔴 **A finding this story is the first to be in a position to notice — record it, and
      do not silently "fix" it.** Measured 2026-08-23: **`/etc/letsencrypt/renewal-hooks/deploy/` and
      `/etc/letsencrypt/renewal-hooks/post/` are both empty**, and none of the four existing renewal
      configs declares a `renew_hook`. `certbot.timer` is active and will renew — but **nothing
      reloads nginx**, so on renewal the host keeps serving the *old* certificate until a human
      reloads by hand. That is already true for `api.crm.preprod`, `api.crm.dev`, `git.crm-prionex`
      and the neighbour's `admin.techno-finance.online`; this story adds a fifth certificate to the
      same gap. **Re-measure it, then record it with an owner.** ⚠️ A hook in
      `renewal-hooks/deploy/` runs for **every** certificate on this host, including the
      neighbour's — that makes it a host-wide change on a shared machine, not a story-local fix.
      Prefer recording and routing to Oleg over acting; if you do act, a `renew_hook` scoped to
      **this certificate's own renewal config** is the narrow form, and say why you chose it.
- [x] **8.4** Add the frontend `server` block to `/etc/nginx/sites-available/crm-stands`, modelled on
      the two API blocks already there — **the same three listens** (`0.0.0.0:443 ssl`,
      `10.70.0.1:443 ssl`, `10.67.0.1:443 ssl`; do **not** add `bind`, which stops nginx from
      starting if the WireGuard interfaces are not up yet and would take the neighbour's site down),
      the same inline TLS parameter set (so the host keeps one TLS policy, not three), and its own
      `ssl_session_cache` zone name.
      **Upstream is `http://127.0.0.1:8083` — the stand — not Kong.** The frontend's own nginx
      proxies `/api/` and `/ws/` onward to `crm-kong-gateway:8000` from *inside* the network
      (`nginx.conf:37-56`), so the host vhost needs only `location /`.
      ⚠️ If you add any `location` with its own `proxy_set_header`, **re-list all four headers inside
      it** — `proxy_set_header` inherits all-or-nothing and one entry in a `location` cancels the
      entire server-level set. That trap is documented in the file you are editing.
      ⚠️ Add a header comment in the same voice as its neighbours saying what this block is, which
      story added it, and that the upstream is loopback-bound by design.
- [x] **8.5** `nginx -t` **must pass** before any reload. Compare its output against 8.1's — the only
      acceptable difference is none. Then reload.
- [x] **8.6** **Discriminating pair for AC3 (retro-E5 #4).** From **outside** s1:
      (a) `https://crm.preprod.crm-prionex.online/` → `200`, `subject=CN=crm.preprod.crm-prionex.online`;
      (b) the **same probe against a sibling name with no vhost** (e.g.
      `nope.crm.preprod.crm-prionex.online` via `--resolve` or `-servername`) → still the default
      `CN=admin.techno-finance.online`. Without (b), (a) cannot distinguish "our vhost serves this
      name" from "the default vhost answers everything".
- [x] **8.7** Confirm the neighbours still work: `https://admin.techno-finance.online/`,
      `https://api.crm.preprod.crm-prionex.online/` and `https://api.crm.dev.crm-prionex.online/`
      still answer with their own certificates. A vhost change that breaks a neighbour is the
      failure mode this task's prohibitions exist for.
- [x] **8.8** **AC6 — measure the CORS boundary, fix nothing.** Against
      `https://api.crm.preprod.crm-prionex.online`, issue (i) a simple `GET` with
      `Origin: https://crm.preprod.crm-prionex.online` and (ii) an `OPTIONS` preflight with the same
      `Origin` plus `Access-Control-Request-Method`. Record the literal
      `Access-Control-Allow-Origin` / `Access-Control-Allow-Credentials` headers. Expect the static
      `http://localhost:8320`. **State in the record that browser API calls fail until
      `CRM/api-prionex` fixes it, that the ask is already out, and that nothing was changed on their
      side.**

### Task 9 — Record the decisions and land the work (AC: all)

- [x] **9.1** Write **D36** in `docs/migration-decisions.md` (Russian, matching the house style; add
      the index row in numeric order).
      🔴 **The next free number is D36, not D35 — verified 2026-08-24 against open branches, and
      this is exactly the trap 5.1 warned about.** `main` at `08803a17` stops at **D34** (5.1's).
      **Story 4.9 has already taken D35** on `story-4-9/pr-1-context` (commit `11017adc`, "D35 (not
      D34)"). Taking D35 here would collide on merge. **Re-verify before claiming it** —
      `git fetch` and check every open `story-*` branch's `docs/migration-decisions.md`, not just
      `main`. There is a `D23` collision in this project's history precisely because someone did not.
      Cover: the five variables and the loopback-permanent port
      decision; the vhost and certificate; the registry credential state and what it is *for*; the
      identity proof in D34's corrected form; the CORS boundary as a recorded defect; and the
      §3 correction that the host stand directory is a **precondition**, not a record. Set the
      revision trigger to **Story 5.3**.
- [x] **9.2** Amend **D28** and **D34** with dated amendment markers — **bodies untouched**, the
      house rule. D28: option (e) is confirmed live and the host directory's real role is narrower
      than "DR" for the compose file and wider than "nothing" for the directory; also that its §3
      registry login is gone again. D34: its revision trigger for 5.2 is discharged, with the result.
- [x] **9.3** `deferred-work.md`, per Prohibition 14 — **new** entries at EOF, **closures** under the
      original with the old text struck. At minimum:
      - 🔴 **new:** `deploy-stand.yml:216`'s caller skeleton names `runner_label: deploy-preprod-preprod`,
        which does not exist; the live labels are `deploy-dev-preprod`/`dev`/`preprod`/`deploy`.
        Owner **Story 5.3**. Not fixed here — `deploy-stand.yml` is 4.8's shipped artifact and
        inside 4.9's blast radius (§12).
      - 🔴 **new:** the host `.env` drift measured on the DEV stand (§2 f), attached to the existing
        "two sources of truth" item (`deferred-work.md:2887-2895`) rather than opened as a rival.
      - 🔴 **new:** the registry credential on s1 has now been removed **twice** by an unknown actor
        (after 1.10, and after 4.2). Recorded as a pattern, with no attribution guessed.
      - 🔴 **restatement, escalated:** attaching this stand puts a second endpoint of ours on a
        network `CRM/api-prionex` owns. Docker refuses `network rm` while an endpoint is attached,
        so **their `compose down` on `crm-preprod` will now trip over a container in a compose
        project they cannot see** — and if they resolve it by force-disconnecting us, the stand
        serves `200` on `/` with a dead `/api/` and reports `healthy` throughout
        (`deferred-work.md:2821-2827`). This was already true for DEV; this story **doubles it onto
        a 69-container network**, and the heads-up still has no owner. **Route it into the same
        message that carries the CORS ask** — that is the cheapest moment it will ever have.
      - 🔴 **new:** **no certbot renewal hook exists anywhere on s1** — both
        `/etc/letsencrypt/renewal-hooks/{deploy,post}/` are empty and no renewal config declares
        `renew_hook`, so every certificate on this host (including the neighbour's) renews without
        nginx being reloaded. Pre-existing; this story adds a fifth certificate to it. **Owner: Oleg
        / host administrator** — a host-wide change on a shared machine (Task 8.3a).
      - 🔴 **new:** the reboot-ordering exposure now applies to a second stand. `restart: always`
        plus `external: true` is a **silent restart loop**, not a loud failure, if the stand's
        network is not up when Docker restarts the container (`deferred-work.md:2813-2820`). Record
        the post-deploy state; do not attempt to solve it here.
      - **closure or restatement** of the vhost/certificate item routed by 5.1 (`Deferred from:
        story-5-1-…`) — this story is its owner and closes it.
      - **restatement, not closure,** of the CORS item: measured again from the real origin, still
        open, owner `CRM/api-prionex`.
      - the revocation owner and trigger for any token minted in Task 3.3 (**written at mint time**).
- [x] **9.4** Correct the `-preprod`-related stale text this story falsifies **in the artifacts it
      owns**:
      - `build.yml:596-597`'s placeholder claim is stale (§7 a). ⚠️ Editing `build.yml` is a
        workflow change — weigh it against the "no unnecessary workflow edits" rule and, if you do
        not make it, route it rather than leaving it silently wrong.
      ✅ **The `8081` sweep is already done — do not redo it.** `docs/preprod-infrastructure-requirement.md`
      (`:131`, `:137-141`, `:262`) and `docs/forgejo-migration.md` (`:226-227`, `:354`) already read
      `~~8081~~ **8083**`, corrected by Story 4.1 on 2026-08-19 (`migration-decisions.md:4078`).
      Neither file is in this story's blast radius.
      Do **not** touch `README.md:136` (4.9's blast radius; already routed by 5.1) and do **not**
      "fix" `migration-decisions.md:200`'s `8081` in D4's body — decision bodies are never
      rewritten, and that one is deliberately left alone.
- [x] **9.5** Set `sprint-status.yaml` `5-2-…` to `review` with a comment block in the house style:
      what was built, what was measured, what was routed, what is explicitly **not** claimed.
- [x] **9.6** Branch `story-5-2/pr-1-<purpose>`, PR into protected `main`. If the PR cannot be opened
      through the UI, open it via `POST /api/v1/repos/CRM/fe-prionex/pulls`.
- [x] **9.7** 🔴 **Close the ledger only against a query re-run after the merge commit lands.**
      If that is impossible in this session, write the literal word **OPEN** — never a self-reported
      number (retro-D4, §11).
- [x] **9.8** Confirm nothing was left behind on s1: no throwaway containers, no stray networks, no
      temp directories, no second plaintext copy of any token, and the local retag from Task 3.4
      removed.

---

## Dev Notes

### 1. The one-paragraph version

Create `/root/crm-prionex/fe-prionex-preprod/` with `docker-compose.stand.yml` (byte-identical to
the repo) and a `.env` carrying five values — `fe-prionex-preprod`, `fe-prionex-preprod`,
`127.0.0.1:8083`, a real `sha-<12hex>-preprod` image reference, `crm-preprod-network`. Restore a
`read:package` login on the host and prove its scope by refusal. Bring the stand up with `up -d`,
never `config`. Prove it reaches PRE-PROD's Kong by container identity from inside the container,
and prove the check can fail. Add an nginx `server` block and a Let's Encrypt certificate for
`crm.preprod.crm-prionex.online` on a host whose nginx serves another tenant's production site.
Measure the CORS defect from the real origin and record it with an owner. Write **D36** (not D35 —
Story 4.9 already holds that number on its own branch), amend D28 and
D34 without rewriting them, route what is not yours, and close the ledger against a query.

### 2. Infrastructure facts

| Thing | Value |
|---|---|
| s1, working address | `root@10.67.0.1` (= `s1.private.crm-prionex.com`). External `185.185.49.127:22` times out by `ufw` design |
| s1, public address | `185.185.49.127`; `ufw` allows 80/443 from anywhere, 22 from two admin addresses |
| Host identity | `NLDW3-3-42-32`; Docker `29.4.0`; `docker compose` `v5.1.3` (the dev machine's is `v5.3.0` — Story 4.1 re-ran its whole guard matrix on both and got byte-identical messages) |
| Stand directory | `/root/crm-prionex/fe-prionex-preprod/`, `0700`, `root:root`; `.env` `0600` |
| Lock file (5.3's) | `<stand_dir>/.deploy.lock`; holder container `fe-prionex-preprod-deploy-lock-<run id>` |
| Network | `crm-preprod-network`, `172.21.0.0/16`, created 2026-08-11T17:12:51Z, 69 containers, owned by `CRM/api-prionex` |
| Kong | `crm-preprod-kong-gateway`, id `61eb0eaa9f640e23…`, aliases `[crm-preprod-kong-gateway, kong, crm-kong-gateway]`, `10.70.0.1:8320->8000/tcp` |
| DEV, for contrast | `fe-prionex-dev` on `crm-dev-network` (70 containers), `127.0.0.1:8082`, Kong id `6c1b4ac96e8d7ac…` |
| Registry | `git.crm-prionex.com/crm/fe-prionex`; `robot-registry` holds `write:package`; host logins are `read:package` only (NFR6) |
| nginx on s1 | host process; config `/etc/nginx/nginx.conf`; `conf.d` loads **before** `sites-enabled`; `map $http_upgrade $connection_upgrade` already declared in `conf.d/crm-stands-upgrade.conf` |
| ACME webroot | `/var/www/acme`; `certbot 2.9.0` |
| Deploy runner | `s1-deploy-dev-preprod`, labels `deploy-dev-preprod`/`dev`/`preprod`/`deploy`, job image `deploy-base-dev-preprod:2026-08-07`, job network `forgejo-runner-crm-deploy_runner` (192.168.225.0/24), `privileged: false`, `docker_host: ""` |

### 3. Anti-patterns for this story

- **Reading health status as backend evidence.** §4.1. The single most likely way to close this
  story wrongly.
- **`docker compose config` as a gate.** Blind to network existence; renders happily against a
  network that does not exist. Only `up` discriminates.
- **`docker ps --filter name=fe-prionex`.** Substring match on a host with four
  `forgejo-runner-fe-prionex*` containers and two stands. Cannot fail; proves nothing. Use
  `grep -x`.
- **Asking `.Id` of a container you selected by name.** Guaranteed to differ. D34 §3 caught exactly
  this in code review. Go through the network's own `.Containers[]` map.
- **`certbot --nginx`.** Rewrites files it does not own and re-introduces
  `options-ssl-nginx.conf`, which certbot overwrites on upgrade.
- **Renaming a `zz-` symlink.** Steals the neighbour's default-vhost role on `0.0.0.0:80`.
- **A `proxy_set_header` inside a `location` without re-listing the rest.** All-or-nothing
  inheritance; documented in the very file being edited.
- **Writing a workflow "just to test the deploy".** That is Story 5.3. This story writes no workflow
  file (Prohibitions 8, 9).
- **Repeating `Dockerfile.prod:34`** (it is `:55-56`) or the `secret/fe/pre-prod/app` placeholder
  claim (§7). Nine and three artifacts respectively already carry them.
- **Concatenating the preprod path spellings.** `PREPROD` / `fe-pre-prod` / `pre-prod` / `-preprod`
  are four different literals and `secret/fe/preprod/app` does not exist.

### 4. Previous story intelligence

- **Story 4.2 (`4-2-provision-the-new-dev-stand-on-s1.md`)** — the direct template. Its Tasks 3–9
  map almost one-to-one onto this story's Tasks 4–7. Read its `### Review Findings`, especially
  **M7** (the `0.0.0.0` bind), **H1** (tag expiry — which does **not** transfer here), **H5** (what
  was measured vs inferred about the runner), **H4** (the client-side credential), **M1** (the
  forgotten second plaintext token copy), **L8** (what a push-refusal actually proves) and **M3**
  (the tag listing that was never pasted).
- **Story 4.1** — the five-variable contract, the `${VAR:?…}` message form, the process-environment
  bypass that no guard can close, and the seven-row matrix with row 7 as its discriminator.
- **Story 4.3 / D29** — chose D28's option (e); established `.env.deploy` in the job workspace and
  the rule that every verification step reads `CONTAINER_NAME`/`FRONTEND_PORT` **back out of**
  `.env.deploy`, never from a literal.
- **Story 4.4 / D30** — the `flock`-through-a-sibling-container design, `<stand_dir>/.deploy.lock`,
  the `--init` requirement, and the `lock_ttl_seconds > 600` invariant.
- **Story 4.8 / D33** — `deploy-stand.yml` as a `workflow_call` callee with no `concurrency:` of its
  own (a callee's block is silently void, D21) and `expect_unrouted_api` existing specifically for
  PRE-PROD.
- **Story 5.1 / D34** — everything in §2 (i)(j), the identity-match form this story's AC5 inherits,
  and the honest distinction between a fact independently confirmed and a fact merely recorded.

### 5. Ledger attribution in the parallel era — cite 5.1's closeout, do not re-derive it

Story 5.1's closeout (commit `e0b6d3cf`, merged as **PR #75** → `main` at `08803a17`) is *"the first
ledger closed while a second story (4.9) was pushing to the same repo concurrently"*, and it states
the method so later ledgers can cite it. Verbatim, the rule this story follows:

> (1) filter `action_run` to this repo's `repo_id`, eliminating sibling-repo instance noise […];
> (2) for each remaining row, match `commit_sha` against the closing story's own known commits
> (context, review, fix-pass, merge) and against any concurrently-active sibling story's own branch
> tip(s) (fetched fresh […]); (3) a row whose `ref`/`commit_sha` matches neither is not yet
> attributable and must be named as such, not folded into either story by default.

And the reason it exists: *"'Everything above baseline is this story's' — every prior ledger's
assumption — is false here, and would overstate this story's cost by 2."*

`repo_id = 16` is `CRM/fe-prionex` (confirm it yourself:
`select id,owner_name,name from repository where name='fe-prionex'`). Story 4.9 is pushing to
`story-4-9/pr-1-context` concurrently — name its runs, do **not** absorb them.

Baseline for this story, measured first-hand 2026-08-23T21:02:08Z: `max(id)=1170`, `count=1170`,
ledger **OPEN**. (5.1 closed at `1167` at 20:46:47Z; the three rows since are 4.9's and this
session's — re-take the baseline yourself, Task 1.2.)

⚠️ One caveat 5.1's own code review left open and this story inherits: `max(id) == count(*)` is
**not** a hidden-run proof, and the instance-wide query has no `repo_id` filter. Use the filtered
form; if you use the unfiltered one as a cross-check, say which is which.

### 6. Non-goals — absences that are decisions, not omissions

- **No `deploy-preprod.yml`.** That is Story 5.3 in full. This story provisions what 5.3 consumes.
- **No change to `deploy-stand.yml`** — including its wrong caller skeleton. §8, §12.
- **No CORS fix.** `CRM/api-prionex`'s, ask already sent. AC6 measures it; nothing more.
- **No `preprod-current` tag.** Story 5.4's.
- **No Slack notification.** Story 4.5's, deferred by decision and running last.
- **No `README.md` correction** — 4.9's blast radius; already routed by 5.1.
- **No repo checkout on s1.** There is none today; this story does not add one.
- **No attempt to reconcile the host `.env` with `.env.deploy`.** The drift is real (§3, §2 f) and
  recorded; solving it is a design change, not a provisioning story.

### 7. Things pending on Oleg — do not depend on them silently

- **The PRE-PROD Kong CORS fix** — external ask to `CRM/api-prionex` (Oleg relayed; extended
  2026-08-23). **Blocks the browser API path, not this story.** AC6 exists precisely so the story
  can close honestly without it.
- 🔴 **The first real PRE-PROD deploy through Story 5.3 will need this fixed** before any
  browser-path validation means anything. Flag it in the closeout so 5.3 is not planned around an
  assumption.
- **Any token minted in Task 3.3 is standing by design** — record the revocation owner and trigger
  at mint time. Scopes cannot be widened after minting.
- **`KONG_PORT` for PROD (`8330`)** — still open for Story 6.4 (`deferred-work.md:934-937`).
  PRE-PROD does not set `KONG_PORT`, so nothing here settles it; **do not claim it does.** D34 §6
  records that a first attempt to close it was wrong five times over.

### 8. Conventions that bind this story

- 🔴 **`D4` and `E5` are ambiguous in this project — two numbering schemes collide.** The retro
  action items (`epic-3-retro-2026-08-18.md:77-78`) are written **retro-D4** and **retro-E5**
  throughout. The D-series in `docs/migration-decisions.md` is a *different* sequence, where `D4` is
  stand parameterization and there is no `E5` at all. Write the prefix every time.
- **retro-E5 (live outcome matrix):** every guard proves itself on a run that *fails* as well as one
  that passes. This story's four designated failing runs are **Task 3.4** (push → `401`),
  **Task 7.4** (`bridge` → exit 2), **Task 7.5** (external `:8083` → refused) and **Task 8.6(b)**
  (a name with no vhost → default CN).
- **retro-D4 (run ledger):** declare before work, close only against a post-merge query, or write
  **OPEN**.
- **NFR5:** the existing DEV and PROD stands stay operational and untouched. Here that means the
  legacy stand (a different host, never contacted) and the new DEV stand (§12, read-only).
- **Decision bodies are never rewritten.** Amendments are dated blocks appended to the record.
- **`deferred-work.md`:** new at EOF, closures under the original with the old text struck.
- **Owners are names or story numbers**, never trigger conditions.

### 9. The autonomous decisions in this story, in one place (for a one-read veto)

Each is *autonomous, subject to Oleg's veto*. Vetoing any one costs a task edit, not a re-derivation.

| # | Decision | Where | If vetoed |
|---|---|---|---|
| 1 | `FRONTEND_PORT=127.0.0.1:8083` — loopback is **permanent** for PRE-PROD, not a stopgap; the vhost is the front door | §5, AC1 | change one `.env` value and drop AC3's proxy target to `0.0.0.0` |
| 2 | AC1's three variables read as **five** | AC1 | the stand cannot start; not really vetoable, but named for completeness |
| 3 | AC2's "three stands" read as **two** | AC2 | requires contacting `72.62.17.132`, which Story 4.1's verdict (b) forbids |
| 4 | **AC5 added** — Kong reachability by container identity from inside the container | AC5 | the story closes without proving the stand reaches the right backend |
| 5 | **AC6 added** — the CORS boundary measured and recorded, not fixed | AC6 | the story closes reporting a stand that fails in a browser |
| 6 | Prefer an **existing** `-preprod` tag over minting a new permanent one | Task 5.2 | dispatch a preprod build from `main` HEAD instead; charge the contingency line |
| 7 | Prove the bundle by **extracting `VITE_API_BASE_URL` from the image**, rather than reading the secret | Task 5.3 | read `secret/fe/pre-prod/app` over HTTP with `X-Vault-Token` (never `/usr/local/bin/bao`) |
| 8 | Extend the **existing** `crm-stands` / `crm-stands-acme` files rather than adding a new vhost file | Task 8.2, 8.4 | a new `sites-available` file — but it **must** keep a `zz-` prefixed symlink (Prohibition 5) |
| 9 | The wrong `runner_label` in `deploy-stand.yml`'s skeleton is **routed to 5.3, not fixed here** | §8, Task 9.3 | edit `deploy-stand.yml`, accepting the E5 re-earning and the 4.9 collision |
| 10 | The stand `.env` is labelled **record/DR** in its own header | Task 4.5 | drop the comment; the drift stays undocumented |
| 11 | `build.yml:596-597`'s stale placeholder text is corrected **or routed**, dev agent's call | Task 9.4 | leave it and route it explicitly |
| 12 | The missing certbot renewal hook is **recorded and routed**, not fixed — a `renewal-hooks/deploy/` script runs for the neighbour's certificates too | Task 8.3a | add a `renew_hook` scoped to this certificate's own renewal config, or a host-wide deploy hook with Oleg's sign-off |
| 13 | Prefer the **`main`-built** `sha-00ef3be4743d-preprod` over the equally-proven PR-head `sha-f8f358f43ced-preprod` | Task 5.1 | use either; both bundles are extracted and clean (runs 680 and 593) |

### Project Structure Notes

**Files this story creates or modifies — in the repository:**

| Path | Change |
|---|---|
| `_bmad-output/implementation-artifacts/5-2-provision-the-pre-prod-stand-on-s1.md` | this file |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | `5-2-…` → `in-progress` (Task 1.1), then `review` (Task 9.5) |
| `docs/migration-decisions.md` | **new D36** (not D35 — 4.9 holds it) + index row; dated amendments to **D28** and **D34**, bodies untouched |
| `_bmad-output/implementation-artifacts/deferred-work.md` | new entries at EOF; closures under their originals |
| `.forgejo/workflows/build.yml` | **only** the stale placeholder comment at `:596-597`, and only if Task 9.4 chooses to fix rather than route |

**Files this story creates on s1 — not in the repository:**

| Path | Note |
|---|---|
| `/root/crm-prionex/fe-prionex-preprod/` | `0700`, new |
| `…/docker-compose.stand.yml` | byte-identical copy; **presence is 5.3's precondition** |
| `…/.env` | `0600`; record/DR only |
| `/etc/nginx/sites-available/crm-stands` | one `server` block appended |
| `/etc/nginx/sites-available/crm-stands-acme` | one name added to `server_name` |
| `/etc/letsencrypt/live/crm.preprod.crm-prionex.online/` | issued by certbot |
| `/root/.docker/config.json` | `read:package` login restored |

**Explicitly not touched:** `docker-compose.stand.yml` and `.env.stand.example` in the repo (their
`8083` guidance is already correct); `nginx.conf`; `Dockerfile.prod`; `docker-compose.server.yml`;
`README.md`; `.github/`; every `deploy-*.yml` and `dev-reset.yml`; every neighbour's nginx file;
the DEV stand in any form.

### References

- `_bmad-output/planning-artifacts/epics.md:2116-2235` — Epic 5 preamble and Story 5.2's ACs
- `_bmad-output/planning-artifacts/epics.md:236-260` — FR25 (port amendment), FR26 (stand dirs), FR27
- `_bmad-output/planning-artifacts/epics.md:318-327` — NFR4, NFR5, NFR6
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-15-preprod-reality.md` — the
  amendment that moved `8081`→`8083` and `preprod.`→`crm.preprod.`
- `_bmad-output/implementation-artifacts/4-2-provision-the-new-dev-stand-on-s1.md` — the DEV template
- `_bmad-output/implementation-artifacts/4-1-parameterize-the-compose-file-for-coexisting-stands.md`
  — the five-variable contract and the guard matrix
- `_bmad-output/implementation-artifacts/5-1-stand-up-the-isolated-pre-prod-backend-network.md` — the
  contour's proven isolation, the N1–N5 matrix, the three routed defects, the Review Findings.
  ⚠️ **The ledger-attribution method is in the closeout half**, commit `e0b6d3cf` / PR #75, merged
  as `08803a17` — it is *not* in the PR #74 version of the file. Resolve line numbers accordingly
- `docs/migration-decisions.md#d27` — parameterization, five variables, no defaults
- `docs/migration-decisions.md#d28` — the DEV stand; §1 the five values and the M7 port amendment;
  §2 the alias by identity; §3 the registry credential; §4 the runner mounts and options (a)–(e);
  §5 the recorded deviations; §6 s1 addressing; §7 the resource budget
- `docs/migration-decisions.md#d29` — option (e) chosen; `.env.deploy` in the job workspace
- `docs/migration-decisions.md#d30` — the lock design and `<stand_dir>/.deploy.lock`
- `docs/migration-decisions.md#d33` — the shared callee; `expect_unrouted_api`
- `docs/migration-decisions.md#d34` — §2 the five rows, §3 the identity-match form handed to this
  story, §4 the three defects, §5 the two epistemic positions, §6 what stays open
- `docs/migration-decisions.md#d15` — OpenBao, and the four path spellings
- `docs/migration-decisions.md#d14`, `#d20`, `#d18` — registry credentials, `latest` cancelled,
  tag scheme
- `docs/preprod-infrastructure-requirement.md` — §2.4 (vhost/TLS, **ours, this story**), §2.5 (CORS,
  theirs); Redaction 3 of 2026-08-23 records the contour as live
- `.forgejo/workflows/deploy-stand.yml` — **read-only**; `:99-177` inputs, `:189-232` the PRE-PROD
  caller skeleton, `:334-342` and `:1473-1481` the stand-dir assertions, `:1322-1360` `.env.deploy`,
  `:1361-1694` the lock, `:1865-2054` health, `:2102-2207` the Kong guard
- `.forgejo/workflows/build.yml:415-425` (KV path table), `:596-597` (the stale placeholder claim),
  `:903` (`-preprod` permanent, `-dev` 14 days), `:962` (`keep_pattern`), `:1073-1090` (the
  permanent-tag guard and `sha-f8f358f43ced-preprod`)
- `.forgejo/workflows/build-main.yml:28-34`, `.forgejo/workflows/ci.yml:368-381` — `environment: dev`
  as a hard literal on every automatic path
- `docker-compose.stand.yml` — the five `${VAR:?…}` guards, healthcheck, 256M limit
- `.env.stand.example:56-69` (port census), `:78-84` (tag shapes), `:91-116` (the silent-failure
  network axis and the network table)
- `nginx.conf:37-56` — the `/api/` and `/ws/` lazy upstreams to `crm-kong-gateway:8000`
- `Dockerfile.prod:55-56` — `COPY nginx.conf`; **not `:34`**
- `epic-3-retro-2026-08-18.md:77-78` — retro-D4 and retro-E5
- `deferred-work.md:934-948` (`KONG_PORT`, **reopened** by 5.1's fix-pass — not closed),
  `:2067-2088` (run 680: the preprod build whose bundle carries the real URLs),
  `:2100-2113` (a preprod tag is permanent; the cost of minting one), `:2444-2465`
  (`config` is blind to network existence; the silent wrong-network failure), `:2515-2547` (the
  run-cost floor), `:2668-2673` (`--filter name=` is a substring match), `:2731-2745` (M7: the
  `127.0.0.1:PORT` form in the stand's `.env`), `:2813-2820` (reboot ordering),
  `:2821-2827` (our endpoint blocks the network owner's teardown), `:2887-2895` (two sources of
  truth), `:701-712` (the `bao` wrapper), `:39-54` (the token that reached a transcript),
  and `## Deferred from: story-5-1-…` — findings 1, 2, 6 and 8, which name this story by number

---

## Dev Agent Record

### Agent Model Used

Sonnet (dev-story), per the standing model split (create-story Opus, dev-story Sonnet, code-review
Opus). SSH rung 1 (`root@10.67.0.1`) worked and stayed live for the entire session, first confirmed
2026-08-23T21:31:22Z.

### Debug Log References

**retro-E5 matrix — all four designated failing runs, with their negative half:**

| # | Task | Probe | Result |
|---|---|---|---|
| 1 | 3.4 | `docker push` under a throwaway tag after login | `401 Unauthorized` on blob-upload `POST` (not merely the manifest `PUT` — a real blob write was attempted and refused, stronger than 4.2's L8 caveat required); tag confirmed absent from registry afterwards (`manifest unknown`); local retag removed |
| 2 | 7.4 | `docker run --rm --network bridge alpine getent hosts crm-kong-gateway` | empty output, **exit 2** |
| 3 | 7.5 | `curl --connect-timeout 8 http://185.185.49.127:8083/` from the sandbox (outside s1) | connect timeout after 8s — `ufw` silently drops, nothing published to `0.0.0.0:8083` |
| 4 | 8.6(b) | `openssl s_client -servername nope.crm.preprod.crm-prionex.online` | still `CN=admin.techno-finance.online`, the default vhost — proves (a) is our vhost specifically, not a catch-all |

**Task 1.2 — ledger baseline, repo-scoped (§5 method):** `docker exec forgejo-postgres psql -U
forgejo -d forgejo -tAc "select max(id), count(*), now() at time zone 'utc' from action_run"` →
instance-wide `1171|1171` at `2026-08-23T21:32:24Z`; `select id,owner_name,name from repository where
name='fe-prionex'` → `16|CRM|fe-prionex`; `select max(id), count(*) from action_run where
repo_id=16` → `1171|441`. This is the baseline — 3 higher than the context session's `1170` (§2 s),
confirming the parallel-era rule: re-take it, don't inherit it.

**Task 2.2 — re-measurement, all first-hand, `2026-08-23T21:32:24Z`:** (b) stand directory absent
(`ls`: No such file or directory; `~/crm-prionex/` holds only `fe-prionex-dev`); (c) `8083` free
(`ss -lntp` shows only `8081` vm-cadvisor and `8082` DEV, no `8083`); (d) DEV stand `Up 7 hours
(healthy)`, `127.0.0.1:8082->80/tcp`; (e) `docker compose ls` confirms DEV's config source is
`/workspace/CRM/fe-prionex/stand-checkout-1150/docker-compose.stand.yml` — the job workspace, D28
option (e) live; (h) `/root/.docker/config.json` → `{"auths": {}}`, empty, confirmed independently of
the context session's own reading; (i) `crm-preprod-network` 69 containers, `crm-dev-network` 70;
(j) `crm-preprod-kong-gateway` id `61eb0eaa9f640e23bfe0b653effa21da637c104edf63a4f09ffd6b40437ac612`
— matches D34 exactly; (p) no local `-preprod` images, only `deploy-base-dev-preprod:2026-08-07`.

**Task 3 — registry credential.**

🔴 **Incident, handled live, recorded in full in `deferred-work.md` (finding 3) and D36 §3 — not
repeated here beyond the summary:** while checking whether `/root/.fj_reg_4_2.token` was
`KEY=VALUE` or bare (Prohibition 10's own distinction), a `sed`-based redaction assumed a `=` the
file does not contain, printing the bare token value into this transcript. Not reused: logged out
immediately, a fresh token (`fe_reg_5_2_ro`, `read:package`) minted via `docker exec -u git forgejo
gitea admin user generate-access-token -u robot-registry -t fe_reg_5_2_ro --scopes read:package`,
output redirected straight to a file and never echoed, extracted to a clean single-copy `0600` file,
verbose output deleted, logged in with `--password-stdin < file` (never printed). 3.1's anonymous-pull
before-state: `unauthorized`. 3.2: `/root/.fj_reg_4_2.raw` (Story 4.2's finding M1, a second plaintext
copy) does **not** exist on this host today — M1 closed. 3.4: see the retro-E5 table above.

**Task 5 — image.** Full tag list (`GET /v2/crm/fe-prionex/tags/list`, Task 5.1's own verbatim
requirement): `main-preprod`, `probe-3-3-preprod-preprod`, `sha-00ef3be4743d-preprod`, plus one
unrelated `-dev` tag containing the substring "preprod" in its story name. 🔴 **`sha-f8f358f43ced-preprod`
is absent** — recorded as `deferred-work.md` finding 5, not chased (the preferred candidate was
unaffected). Digest resolved via manifest header: `Docker-Content-Digest:
sha256:5e5b190d93c8aaec50f0d50c7e108f502c3d366d14f8a13aee081f0ee396dc8c`; pulled digest matches
exactly (`docker inspect --format '{{.RepoDigests}}'`). Bundle check:
`docker run --rm <image> grep -ro 'https://api\.crm\.preprod\.crm-prionex\.online' /usr/share/nginx/html`
→ 3 hits in `assets/index-DBG6qRDm.js`; `wss://…` → 3 hits; `grep -rl PLACEHOLDER-preprod-backend-not-provisioned`
→ no match, placeholder absent.

**Task 6 — up.** `crm-preprod-network` id unchanged before/after
(`90bd3e56416e3a000b349b133e0d859c4e6a1149d328ce31e23798c88731f3d0`). `docker compose --env-file .env
-f docker-compose.stand.yml up -d` → `Created`/`Started`, exit 0. Running: project
`fe-prionex-preprod`, container `/fe-prionex-preprod`, image `sha256:5e5b190d…396dc8c` (matches Task
5.5 exactly), network `crm-preprod-network` at `172.21.0.71`, `healthy`. `ss -lntp`: `127.0.0.1:8083`
only, nothing on `0.0.0.0`.

**Task 7 — identity, D34's corrected form.** `docker exec fe-prionex-preprod getent hosts
crm-kong-gateway` → `172.21.0.24`. `crm-preprod-network`'s own `.Containers[]` map (`docker network
inspect crm-preprod-network --format '{{range $k,$v := .Containers}}{{$k}} {{$v.Name}}
{{$v.IPv4Address}}{{"\n"}}{{end}}'`, grepped for the resolved address) assigns that exact address to
`61eb0eaa9f640e23…` (`crm-preprod-kong-gateway`) — matches D34. The same address does not appear in
`crm-dev-network`'s own map at all (disjoint subnets); `crm-dev-kong-gateway`'s own id there is
`6c1b4ac96e8d7ac…`, different, cross-checked directly. 7.6: `curl http://127.0.0.1:8083/` → `200`
(static); `curl http://127.0.0.1:8083/api/` → `404`, `X-Kong-Response-Latency: 0`, `Server:
nginx/1.31.3`, CORS headers already visible in this response (feeds AC6). 7.8: `docker compose ls`
lists both projects distinctly; each container's network membership is exactly one network; `docker
ps -a --format '{{.Names}}' | grep -x fe-prionex` → exit 1, no output; ports `8082`/`8083` both
present and distinct via `ss`. Legacy host `72.62.17.132` not contacted.

**Task 8 — vhost and certificate, `2026-08-23T21:37Z`–`21:39Z`.** 8.1 before-state: TLS on
`crm.preprod.crm-prionex.online` → `CN=admin.techno-finance.online`; `nginx -t` →
two pre-existing `conflicting server name` warnings (443 **and** 80, both re-confirmed — the story's
own §2(l) only named the 80 one), syntax/test both OK. 8.2: `crm-stands-acme`'s `server_name`
extended with the new name, pushed, `nginx -t` → identical warnings, no new diff, reload → active.
8.3: `certbot certonly --webroot -w /var/www/acme -d crm.preprod.crm-prionex.online` →
"Successfully received certificate", expires 2026-11-21; existing ACME account reused (no new
registration); renewal config matches house shape (`authenticator = webroot`, `webroot_path =
/var/www/acme`); all 5 renewal configs present, the other 4 untouched by mtime. 8.3a re-measured:
both `renewal-hooks/{deploy,post}/` still empty — recorded as `deferred-work.md` finding 6, routed to
Oleg, not fixed. 8.4: `crm-stands` got a third `server` block, modelled on the two API blocks, `location
/` only, upstream `http://127.0.0.1:8083`, own `ssl_session_cache` zone name. 8.5: `nginx -t` →
identical warnings again, reload → active. 8.6: (a) `https://crm.preprod.crm-prionex.online/` → `200`,
`CN=crm.preprod.crm-prionex.online`, LE issuer; (b) see retro-E5 table. 8.7: neighbours confirmed —
`admin.techno-finance.online` `200`/own CN; both API hostnames `404`/own CN (expected — no route at
`/`, same as always). 8.8: AC6, see the CORS section below.

**AC6 — CORS from the real origin, `2026-08-23T21:39:39Z`.** `Origin:
https://crm.preprod.crm-prionex.online` (the real vhost this story just stood up, not a synthetic
value): simple `GET` → `404`, `Access-Control-Allow-Origin: http://localhost:8320`,
`Access-Control-Allow-Credentials: true`, unchanged. `OPTIONS` preflight (`Access-Control-Request-Method:
GET`, `-Headers: authorization`) → `404`, same static headers, **no `Access-Control-Allow-Methods` or
`-Headers` at all**. Matches 5.1's fix-pass shape facts exactly, now confirmed from the actual
frontend origin rather than a hypothetical one.

**Task 9.8 — cleanup.** `docker ps -a` shows no stray containers beyond the intended
`fe-prionex-preprod` (the `vm-*` containers are pre-existing victoria-metrics infrastructure, not
created by this session); no `throwaway` image remains; `docker network ls` count unchanged (16, same
as before Task 6); final repo-scoped ledger re-check: `1171|441` — unchanged from the Task 1.2
baseline, confirming host-side work spent zero runs as budgeted.

### Run Budget Ledger

**Declared, Task 1.3, before the first push:**

| Line | Runs |
|---|---|
| Pushes to `story-5-2/pr-1-context`, per push (DN4 — repeating): expect 1-2 write-up rounds | 2 |
| PR-open run | 1 |
| Merge run (`build-main.yml`) | 1 |
| Host-side work (Tasks 2-8: SSH only, dispatches nothing) | 0 |
| Task 5 contingency: **not triggered** — `sha-00ef3be4743d-preprod` passed 5.3 on the first try, no
  `build.yml` dispatch needed | 0 (of a possible +1, permanent-tag cost) |
| **Declared floor** | **4** above baseline |

**Baseline:** `1171|441` (repo-scoped, `repo_id=16`), instance-wide `1171|1171`, both at
`2026-08-23T21:32:24Z` — taken before any push this session, per Task 1.2, method D31 §7 / Story
5.1's parallel-era attribution (§5 of this story). Task 9.7's post-merge reconciliation re-runs the
same repo-scoped query and attributes each row above `1171` by `commit_sha`/`ref` against this
story's own commits and any concurrently-active sibling branch — not by raw `id` delta.

**Disposition: OPEN.** Per retro-D4, closes only against a query re-run after the merge commit lands.
This session has not merged; Task 9.7 is the coordinator's to run post-merge, matching the standing
convention established by Story 5.1's closeout (coordinator runs API/dispatches/ledger queries; this
session does git/SSH/host work).

### Completion Notes List

**AC closure:**

- **AC1 — on evidence.** Five variables written (not three); `FRONTEND_PORT=127.0.0.1:8083` (not
  bare `8083`). Directory + `docker-compose.stand.yml` present and byte-identical to the repo
  (`sha256sum` match, `7f449dacce…`); `.env` headed as record/DR only, citing §3 and the DEV drift.
  `CONTAINER_NAME`/`COMPOSE_PROJECT_NAME` confirmed distinct from DEV's and neither is the literal
  `fe-prionex`.
- **AC2 — on evidence.** Two stands on s1 (not three — legacy is a different host, not contacted),
  mutually distinct on every axis: compose projects, container names, ports, network membership.
  Anchored `grep -x fe-prionex` exits 1.
- **AC3 — on evidence, all three parts.** nginx server block; Let's Encrypt certificate; end-to-end
  HTTPS `GET /` from outside s1 returning `200` with the correct subject CN, discriminated against a
  sibling name with no vhost.
- **AC4 — on evidence, all four parts (i-iv).** Empty-auths before-state recorded without guessing
  who removed it; `fe_reg_4_2_ro` was live but is now treated as compromised (transcript incident) and
  replaced, not reused, with the revocation-owner note written at mint time; scope proven by refusal
  (a genuine blob-upload `401`, stronger than the manifest-only caveat 4.2's L8 warned about); the
  pulled bundle independently shown to carry the real PRE-PROD URLs, not the placeholder.
- **AC5 — on evidence, D34's corrected form, on the real container.** Not a throwaway — the running
  `fe-prionex-preprod` itself. Identity via `crm-preprod-network`'s own `.Containers[]` map, not a
  named-container `.Id` lookup (the vacuity D34 §3 caught in Story 5.1's own code review). `bridge`
  negative control empty/exit 2.
- **AC6 — on evidence.** CORS boundary measured from the real, now-live origin; browser calls stated
  plainly to fail until `CRM/api-prionex` fixes it; nothing changed on their side.

**No row closed UNPROVEN.** SSH stayed live for the whole session; every AC1-6 measurement is
first-hand. The ledger (not an AC row) is OPEN, not closed — Task 9.7 is post-merge and not this
session's to perform.

**The registry-token transcript incident (Task 3.2) is the one thing in this session that did not go
to plan.** Recorded in full in `deferred-work.md` (finding 3) and D36 §3, handled live (not reused,
replaced with a token that was never printed), and flagged here so it is not missed on a read of only
the Completion Notes. Owner: Oleg, for whatever the standing "cannot revoke" fact leaves to decide.

**Prohibitions 1-16, verified by execution:** 1: `crm-preprod-network` never created/removed/
connected/disconnected — id captured before and after `up -d`, unchanged. 2: no `docker rm -f` by
name; rollback path (`compose … down`) was never needed since `up -d` succeeded cleanly. 3: no
container besides `fe-prionex-preprod` restarted/stopped/recreated; DEV stand untouched (read-only
inspects only). 4/5/6: every nginx edit passed `nginx -t` (identical pre-existing warnings, no new
diff) before every reload; `zz-` symlink names untouched; `technofinance`/`zz-forgejo-*` never opened.
7: `certbot certonly --webroot`, never `--nginx`. 8: only the permitted comment edit at
`build.yml:596-597`; no other workflow touched. 9: no `${{ }}` written anywhere. 10: the one violation
this session had (above) — handled, not hidden; every other credential handling used
`--password-stdin`/file-redirect, never an echo. 11: OpenBao never reached — this story's registry
credential is Docker-native, not OpenBao. 12: `crm-kong-gateway` resolved cleanly from inside the
real container; the fallback prohibition was never tested against a STOP because nothing failed to
resolve. 13: every row above states its actual disposition; nothing closed on an unmeasured claim.
14: `deferred-work.md` — one closure (vhost/cert) and two attached/escalated notes placed under their
original entries, struck where superseded; six new findings at EOF. 15: no `docker image prune` or
host-wide sweep of any kind. 16: every number above is first-hand, this session's own SSH channel.

### File List

- `_bmad-output/implementation-artifacts/5-2-provision-the-pre-prod-stand-on-s1.md` — this file: Dev Agent Record, task checkboxes.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `5-2-…` → `review`, with summary comment.
- `_bmad-output/implementation-artifacts/deferred-work.md` — one closure (vhost/cert), two attached notes (two-sources-of-truth, reboot-ordering, endpoint-blocks-teardown — three notes total), one restatement (CORS), six new findings at EOF.
- `docs/migration-decisions.md` — new **D36** (summary row + full section); dated amendments to **D28** §3 and **D34** §3 (bodies untouched); changelog row.
- `.forgejo/workflows/build.yml` — **only** the stale placeholder comment at `:596-601`, per Task 9.4's decision to fix rather than route (comment-only, no logic change).

**Created on s1, not in the repository:** `/root/crm-prionex/fe-prionex-preprod/` (`0700`);
`…/docker-compose.stand.yml` (byte-identical copy); `…/.env` (`0600`, record/DR, header comment);
`/etc/nginx/sites-available/crm-stands` (one `server` block appended); `/etc/nginx/sites-available/crm-stands-acme`
(one name added); `/etc/letsencrypt/live/crm.preprod.crm-prionex.online/` (issued); `/root/.docker/config.json`
(read:package login restored, new token); `/root/.fj_reg_5_2.token` (`0600`, the new credential).

**Not touched:** `docker-compose.stand.yml`/`.env.stand.example` in the repo; `nginx.conf`;
`Dockerfile.prod`; `docker-compose.server.yml`; `README.md`; `.github/`; every `deploy-*.yml` and
`dev-reset.yml`; every neighbour's nginx file; the DEV stand in any form.

### Review Findings

---

## Open Questions for Review

### Blocking

_None at contexting time._

### Non-blocking

1. **Should `build.yml:596-597`'s stale placeholder comment be corrected in this story or routed?**
   It is a comment, not logic, and editing `build.yml` is a workflow change during a parallel-work
   window. Dev agent's call (Task 9.4); either answer is defensible if it is recorded.
2. **Which of `preprod` or `deploy-dev-preprod` should Story 5.3 use as `runner_label`?** Both are
   registered on the same runner with the same job image. `preprod` reads better; `deploy-dev-preprod`
   is the one with live evidence behind it. Recorded as a finding either way (§8).
3. **Does anything else on s1 need to reach the stand on `127.0.0.1:8083`?** If a future consumer is
   not the host nginx and not a `--network host` sibling, the loopback binding will need revisiting.
   Nothing today needs it.

---

## Change Log

| Date | Change |
|---|---|
| 2026-08-24 | Story contexted on branch `story-5-2/pr-1-context`. Started against `main` at `90836b99` (PR #74); **PR #75 — Story 5.1's ledger closeout — merged mid-session, so this file is based on `08803a17`** and Dev Notes §5 cites the attribution method that arrived with it. s1 measured first-hand from the context session (SSH via `root@10.67.0.1` worked): the preprod stand directory does not exist, `8083` is free, the registry credential is **gone again**, `crm.preprod.crm-prionex.online` still falls through to `CN=admin.techno-finance.online`, the deploy runner registers a live `preprod` label (so `deploy-stand.yml`'s skeleton `deploy-preprod-preprod` is wrong), and the DEV stand runs from a **job workspace** while its host `.env` has drifted from it. AC1 read as five variables and `127.0.0.1:8083`; AC2's "three stands" read as two; AC3 restated as the story's largest piece of real work; AC4 reopened on measurement; **AC5 and AC6 added**. Decision number set to **D36** — 4.9 already holds D35. |
| 2026-08-24 | **dev-story complete.** All 58 task checkboxes closed on first-hand SSH evidence, live the entire session. Stand up on s1: `fe-prionex-preprod`, `crm-preprod-network`, `127.0.0.1:8083` permanently loopback; image `sha-00ef3be4743d-preprod` (run 680, `main`), bundle independently verified to carry the real PRE-PROD URLs. AC5 discharged on the **real** container (not a throwaway) via `crm-preprod-network`'s own `.Containers[]` map — D34's corrected form, applied without re-earning its own vacuity. vhost + Let's Encrypt certificate issued for `crm.preprod.crm-prionex.online` with zero diff in `nginx -t` at either reload and neighbours confirmed unaffected — the first real infrastructure Epic 5 has created, not measured. AC6: CORS re-measured from the now-live real origin, unchanged and still broken, `CRM/api-prionex`'s open ask. 🔴 **Incident, handled and recorded, not hidden:** a registry token value was accidentally printed to this session's transcript during a redaction attempt; not reused, replaced with a freshly minted token that was never echoed; owner Oleg for what the standing "cannot revoke" fact leaves to decide. D36 written (D35 confirmed still story-4-9's, not on `main`); D28 §3 and D34 §3 amended. `deferred-work.md`: vhost/cert item closed, CORS restated, three items escalated/attached, six new findings (`runner_label`, credential-removed-a-third-time, the token incident, M1 closed, a missing "permanent" tag, the renewal-hook gap now covering five certs). Ledger: host-side work cost zero runs as budgeted; declared floor 4 above baseline (`1171\|441`, repo-scoped); disposition OPEN pending the coordinator's post-merge query. Status → review. |
