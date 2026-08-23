---
baseline_commit: fc6bfe82ed23edf2548ec10bca99e3934a5271a8
---

# Story 5.1: Stand Up the Isolated PRE-PROD Backend Network

Status: review

<!-- Contexted 2026-08-23 against `main` at `fc6bfe82` (merge of PR #73, Story 4.8 closeout), on
     branch `story-5-1/pr-1-context`. Every autonomous decision in this file is marked "autonomous,
     subject to Oleg's veto" and is listed together in Dev Notes §8 so a veto costs one read, not a
     re-derivation. Story 4.9 is in flight on its own branch at the same time — §12 states what this
     story may not touch, and it is not advice. -->
<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- 🔴 CONTEXT CORRECTIONS, 2026-08-23 (dev agent, applying the coordinator's independent citation
     audit of this story file, 18 findings, before Task 1). Applied inline at each site, logged here
     for one-read traceability. Binding per this story's own rule: a fact that stopped being true is
     corrected with a record, not silently carried.
     1. N4 as originally written was vacuous: a container attached to two different networks always
        gets two different addresses (one per subnet) — "equal addresses" could never be observed
        either way. Re-scoped to container IDENTITY: resolve the alias in each network, match the
        resolved address to a container Name/ID via that network's own inspect output, assert the
        two IDs differ. Task 6.1/6.2/4.2 and the N4 row/AC3 clause rewritten below.
     2. Task 5.2 needed per-container IPv4Address that Task 4.1 never collected. Added to Task 4.2.
     3. Prohibition 12 was self-contradictory ("append at EOF" vs "closures go under the original").
        Resolved: NEW findings append at EOF; CLOSURES of existing deferred-work.md entries go
        immediately under the original entry, struck through, never deleted.
     4. OQ1 / Task 3.5 default changed: if rungs 1-2 both close off, host-side rows close UNPROVEN
        and rung 3 is a routed ask to Oleg (OQ1), not something this session builds unprompted.
     5. Task 9.5 corrected: the coordinator opens the PR (standing convention, every story) — this
        session prepares the pre-open diff check and stops there, matching Dev Notes §7's own line.
     6. docker run probe image: only an image already present on s1 (per Story 4.2/D28 §2 precedent
        — `alpine`, used there for the identical bridge-network getent negative control). Pulling a
        new image is a Prohibition 1 violation.
     7. Task 6.6 given the same UNPROVEN fallback Task 6.7 already had, for symmetry when
        `crm-preprod-kong-gateway`'s own logs are unreadable.
     Factual corrections: "on this host" (§0 intro) was false — Story 4.1 Task 6.2 ran locally, not
     on s1 (s1 verification was Story 4.2's). `build.yml:812-816` → `:796-799` (Prohibition 6). "six
     days old" → "eight days old" (2026-08-15 to 2026-08-23). The `Dockerfile.prod:34` stale-citation
     count corrected from "four other artifacts" to "eight other" (nine total incl. the epic);
     enumerated at Task 7.5. AC1's "Given the commitment secured in Story 1.6" gets a deviation note:
     Story 1.6 did not direct this delivery — `CRM/api-prionex` shipped it unilaterally via commit
     `517e6975` (§1 row 3). N2 (standing NXDOMAIN falsification) had no AC anchor; folded into AC5.
     Checked and found already correct, no change made: all "Dev Notes §N" cross-references (§5/§6/§8
     as written) and the `:2238-2246` chronology citation in §6 — the audit flagged these but this
     draft already has them right.
     Not applied — insufcient detail relayed to act on: audit point 17 ("minor drift, listed") and
     point 18 (redundancy) — point 18 explicitly marked "flag for review, do not restructure" by the
     coordinator; noted in Completion Notes for the reviewer. -->


> **This story builds nothing.** The PRE-PROD contour it was written to request already runs — 69
> containers on `crm-preprod-network`, Kong up with the `crm-kong-gateway` alias, TLS on
> `api.crm.preprod.crm-prionex.online`. Two of its four original ACs were satisfied by the
> neighbouring team while this plan waited. What remains is the harder half and the half the epic
> actually named: **proving that the PRE-PROD network is isolated — from the new DEV stand and from
> the legacy — by measurement that could have come out the other way.**
>
> The failure this story exists to prevent is silent. `nginx.conf` resolves `crm-kong-gateway`
> through a *variable upstream with a resolver*, so a frontend attached to the wrong network starts
> cleanly, serves its static assets, answers `200` on `/`, and reports `healthy` — while `/api/`
> reaches nothing, or worse, reaches somebody else's backend. Story 4.1 Task 6.2 demonstrated
> exactly that — 🔴 correction: **locally, not on this host**; s1 verification was handed to Story
> 4.2 by name, and 4.1's alpha/beta stands never ran on s1. No guard can catch a wrong-but-valid
> network name (`deferred-work.md:2447-2465`). Only a measurement from inside the running container can.
>
> **Everything that makes this story hard is in §1–§12. Read them before the ACs.**

---

## Story

As a release engineer,
I want PRE-PROD to reach a PRE-PROD backend rather than the DEV one,
so that validating a release candidate says something true about production readiness.

---

## 🚨 Read this before anything else

### 1. What changed under this story between the day it was written and today

The story was written for a world in which we would ask another team to build a network and a Kong,
and wait. That world ended on 2026-08-14.

| Written assumption | Measured state, 2026-08-15 and re-measured 2026-08-23 |
|---|---|
| we must ask for a network under an agreed name | `crm-preprod-network` **exists**, 69 containers |
| we must ask for a Kong attached to it | `crm-preprod-kong-gateway` **runs**, aliases `["crm-preprod-kong-gateway","kong","crm-kong-gateway"]` |
| the alias is the blocker | delivered `CRM/api-prionex` commit `517e6975`, with a deploy-blocking check on *their* side |
| `api.preprod.crm-prionex.online` will be the API name | **NXDOMAIN.** The real name is `api.crm.preprod.crm-prionex.online` — an extra `.crm.` segment |
| `8081` is a permanent allocation for our PRE-PROD frontend | **taken** on s1 by `vm-cadvisor`'s `docker-proxy`; PRE-PROD is **`8083`** |
| `secret/fe/pre-prod/app` holds a placeholder | 🔴 **stale — it does not.** See §7 |

Sources: `sprint-change-proposal-2026-08-15-preprod-reality.md`, `epics.md:2116-2171`,
`sprint-status.yaml:605-618`.

🔴 **The lesson that produced all six rows is one sentence, and it is this story's operating rule:**
*a statement about live infrastructure has a timestamp; treat it as evidence of the past, not the
present* (`deferred-work.md:2056-2105`, recorded after the fifth such incident in three days). Every
row in §3 below carries a measurement time for that reason. **Re-measure before you rely on any of
them.** The table above is a starting point, not a finding.

### 2. What "isolated" has to mean, precisely, or the story proves nothing

There are four claims hiding inside the word, and they have different costs and different evidence:

1. **The network exists and carries the PRE-PROD backend.** Cheap. Host-side observation.
2. **`crm-kong-gateway` resolves, inside `crm-preprod-network`, to the PRE-PROD Kong** — not to
   *some* Kong. Resolution alone is not enough; Story 4.2 proved the DEV case by **address
   identity** — the name resolved to `172.22.0.53`, which is the *same address* as
   `crm-dev-kong-gateway` on that network (`deferred-work.md:2653-2657`, D28 §2). Repeat that shape.
3. **The PRE-PROD Kong and the DEV Kong are two different things.** This is the claim the story is
   named for, and the one most easily faked by a check that would pass either way.
4. **No container is attached to both networks.** ⚠️ This assertion has **no prior record anywhere
   in `deferred-work.md`** — it is a genuinely new measurement, not a re-confirmation.

Claim 3 is where E5 lives. A probe that says "PRE-PROD's Kong answered" passes identically whether
there are two Kongs or one Kong wearing two hostnames. §5 names five discriminators that do not —
all five named before any of them runs.

### 3. Measured state, 2026-08-23 ~18:16 UTC, from the context session's sandbox

Read-only, first-hand, no host access needed. Every one of these is reproducible by the dev agent
with `dig`, `curl` and `openssl` and **must be re-run**, not inherited.

| # | Probe | Result |
|---|---|---|
| a | `dig +short api.crm.preprod.crm-prionex.online` | `185.185.49.127` |
| b | `dig +short crm.preprod.crm-prionex.online` | `185.185.49.127` |
| c | `dig +short api.crm.dev.crm-prionex.online` | `185.185.49.127` |
| d | `dig +short preprod.crm-prionex.online` | **empty — NXDOMAIN** |
| e | `GET https://api.crm.preprod.crm-prionex.online/` | `404`, `Server: nginx/1.24.0 (Ubuntu)`, `X-Kong-Response-Latency: 0`, body `{"message":"no Route matched with those values"}` |
| f | same request's CORS header | `Access-Control-Allow-Origin: http://localhost:8320`, `Access-Control-Allow-Credentials: true`, `Access-Control-Expose-Headers: *`, `vary: Origin` |
| g | `GET https://api.crm.dev.crm-prionex.online/` | same shape, but `Access-Control-Allow-Origin: http://localhost:8310` |
| h | (f) repeated with `Origin: https://crm.preprod.crm-prionex.online` | **unchanged — still `http://localhost:8320`** |
| i | `OPTIONS` preflight with that same `Origin` | `404`, **still `http://localhost:8320`**, no `Access-Control-Allow-Methods` |
| j | TLS cert, `api.crm.preprod…` | `CN=api.crm.preprod.crm-prionex.online`, Let's Encrypt `YE2`, valid `Aug 14 14:46:42 2026` → `Nov 12 14:46:41 2026`, single SAN |
| k | TLS cert, `crm.preprod.crm-prionex.online` | 🔴 `CN=admin.techno-finance.online` — the request falls through to s1's **default vhost**. No vhost, no certificate for the frontend name |
| l | `ssh root@185.185.49.127` from this session | denied by the sandbox before a packet left. §6 |

**What (f)+(g)+(h) are worth, and it is a lot.** They are a discriminating negative available with
no host access at all: the two API hostnames resolve to the same IP and are fronted by the same
nginx, yet return **different** `Access-Control-Allow-Origin` values, and neither value moves when
the request's `Origin` changes. A single shared Kong could not emit two different static origins.
**This is the cheapest proof that DEV and PRE-PROD are two Kong configurations, and it works today,
from anywhere.** Record it as such — it is AC3's floor, the row that keeps the story from closing
entirely UNPROVEN if s1 stays unreachable.

**What (h)+(i) also establish, separately:** the CORS configuration is **static, not
origin-reflecting**. `vary: Origin` is present but the value never varies. Combined with
`Access-Control-Allow-Credentials: true`, a browser at `https://crm.preprod.crm-prionex.online`
will be refused by PRE-PROD's API. That is the defect §8 routes; **this story does not fix it.**

### 4. Why this cannot be checked from a compose file, and why it cannot be checked from outside either

`nginx.conf:39` and `:50` bake `http://crm-kong-gateway:8000` into the image. The image is
byte-identical across stands — `Dockerfile.prod` copies the config at build time
(`Dockerfile.prod:55-56`; ⚠️ the epic and 🔴 **eight** other artifacts (corrected from "four" —
coordinator's citation audit, 2026-08-23; enumerated at Task 7.5) cite this as `Dockerfile.prod:34`,
which is **stale by 22 lines** — record the correction, do not propagate the wrong citation). There
is no per-stand way to point the frontend at a differently-named gateway. Therefore:

- **From a compose file:** you learn the *declared* network name and nothing about whether it
  exists, whether a Kong is on it, or which Kong. `docker compose config` returns exit 0 rendering
  `external: true` for a network that does not exist at all (`deferred-work.md:2432-2445`).
- **From outside, over HTTPS:** you reach nginx on s1 and, through it, Kong — but you never see the
  *name* `crm-kong-gateway`, which is the thing under test. The external path proves a Kong exists
  and that it differs from DEV's; it cannot prove the alias resolves.
- **Only from inside the network** does the actual claim become measurable. That is why the epic's
  AC says "verified from inside the running container, not inferred from configuration", and it is
  the whole reason this story is not a documentation exercise.

### 5. The discriminating negatives, named before they are run (retro-E5)

E5 requires that a verification row could have come out the other way. Five are available; the
first two need no host access.

| # | Discriminator | Passes only if isolation holds | If isolation were absent |
|---|---|---|---|
| **N1** | `Access-Control-Allow-Origin` on the two API hostnames (§3 f/g) | values **differ** (`8320` vs `8310`) | one Kong ⇒ one value |
| **N2** | `dig preprod.crm-prionex.online` | NXDOMAIN — the plan's name never existed | — (a standing falsification, not an isolation test) |
| **N3** | `getent hosts crm-kong-gateway` from a throwaway container on the **built-in `bridge`** network | **empty, exit 2** | would resolve ⇒ the name is host-wide, not network-scoped, and every claim collapses |
| **N4** | 🔴 **corrected 2026-08-23 (coordinator's audit): N4 as originally scoped ("different addresses") was vacuous** — a container attached to two different networks always has two different addresses, one per subnet; that outcome was guaranteed regardless of isolation and could never have come out the other way. Rescoped to **container identity**: resolve `crm-kong-gateway` in each network, match the resolved address to a container Name/ID via that network's own `docker network inspect`, compare the two IDs | the ID behind the alias in `crm-preprod-network` is `crm-preprod-kong-gateway`'s own container, and the ID behind the alias in `crm-dev-network` is `crm-dev-kong-gateway`'s own container — **the two container IDs differ** | same container ID resolves in both networks ⇒ one physical container answering to the alias in each, i.e. dual-attached or bridged — the silent failure this story exists to catch |
| **N5** | a uniquely-marked path requested against `crm-kong-gateway:8000` from inside `crm-preprod-network` | appears in the **PRE-PROD** Kong's log and **not** in the DEV Kong's | appearing in both ⇒ shared backend |

🔴 **N3 is the one Story 4.2 already ran for DEV and the one most likely to be skipped as
"obviously true".** It is not obviously true — it is the control that makes N4 mean anything, it
costs one `docker run --rm`, and D28 §2 records it as the row that discharged E5 last time. Run it.

⚠️ **N4 is not a formality either.** Both Kongs carry the alias `crm-kong-gateway`. If the two
networks were bridged, or if a container were dual-attached, the name could resolve to the *same*
address from both — which is precisely the silent failure the whole design guards against.

### 6. The access problem, stated honestly, and the ladder out of it

**SSH to s1 is not available to this session.** The attempt in §3 (l) was refused by the sandbox
before a packet left. This is not new and it is not settled either way: `deferred-work.md:2647-2651`
records that the *working* address from a dev machine is **`root@10.67.0.1`** (equivalently
`root@s1.private.crm-prionex.com`) and that the external `185.185.49.127:22` **times out** because
`ufw` admits port 22 from two admin addresses only — while four later sessions
(`:2734-2736`, `:2764-2771`, `:2238-2246`, `:3376-3379`) record no SSH at all. **Treat s1 access as
session-dependent. Test it; do not assume either answer.**

**Ladder, in cost order. Take the first rung that works — do not skip to rung 3 for convenience.**

1. **`ssh root@10.67.0.1`.** Zero runs, richest evidence, everything in §5 measurable in one
   session. Try this first, with the *private* address, not the one §3 (l) tried.
2. **Ask Oleg to run the probe script** (Task 3 produces one, copy-pasteable, read-only, no
   arguments). Zero runs. Slower, but it is a real rung, and it is how a host-side item closes when
   a session has no shell.
3. **A new dispatch-only verification workflow** on the s1 deploy runner, acting through the
   `docker.sock` the runner already holds — the D28 §4 option (e) mechanism, the same one every
   deploy has used since D29. Costs runs. See §9 and Dev Notes §8 decision 2.

🔴 **A host-side row that cannot be measured closes with the literal word `UNPROVEN`, with the rung
that failed and why named next to it.** Never with an inference from the compose file, never with
"the 15.08 measurement said so". An honest UNPROVEN is worth more than an inherited PASS — and §3's
outside-in rows mean no AC closes *entirely* UNPROVEN even in the worst case.

### 7. 🔴 Two "known facts" this story inherited that are false — check them, do not repeat them

**(a) `secret/fe/pre-prod/app` no longer holds a placeholder.** The epic
(`epics.md:2169-2171`), `build.yml:596-597` and `deferred-work.md:1794-1798` all still say it holds
`PLACEHOLDER-preprod-backend-not-provisioned`. **It does not, and has not since 2026-08-15.** Oleg
wrote version 2 that day; `3-3-build-per-environment-images-with-explicit-variables.md:112,725-731`
records the before/after, and the value was independently confirmed on 2026-08-17 by extracting the
bundle layer of a real preprod build (run 680, `deferred-work.md:2056-2105`):

```
secret/fe/pre-prod/app  version 2
  VITE_API_BASE_URL = https://api.crm.preprod.crm-prionex.online
  VITE_WS_URL       = wss://api.crm.preprod.crm-prionex.online
```

⚠️ Note the path spelling: the role is `fe-pre-prod`, the KV path is `secret/fe/pre-prod/app`, the
Forgejo secrets say `PREPROD`. **None derives from another by string concatenation**;
`secret/fe/preprod/app` does not exist (D15). And if this story touches OpenBao at all, it goes over
HTTP with an explicit `X-Vault-Token` — **never** through `/usr/local/bin/bao` on s1, a
world-readable wrapper that silently authenticates as `admin` and once turned nine isolation checks
into nine false positives (`deferred-work.md:701-712`).

**(b) The `Dockerfile.prod:34` citation is stale.** The `COPY nginx.conf` line is at
`Dockerfile.prod:55-56` at `fc6bfe82`. Five artifacts repeat `:34`.

Both are recorded as **findings of this story** (Task 8), because the pattern — a fact asserted
once, then carried by citation for a week after it stopped being true — is the same pattern that
produced the NXDOMAIN hostname and the taken port.

### 8. What this story records but does not fix

Three defects are in PRE-PROD's path today. All three are somebody's, none is 5.1's. **The
deliverable is a fresh measurement with a named owner and a target story — not a patch.**

| Defect | Measured | Owner / target |
|---|---|---|
| PRE-PROD Kong's `Access-Control-Allow-Origin` is the static, wrong `http://localhost:8320`; unchanged under any `Origin`; `Allow-Credentials: true`. A browser at the real frontend origin will be refused | §3 f/h/i, 2026-08-23 | `CRM/api-prionex` (external ask, extended 2026-08-23 to cover it). Consumed by **Story 5.2** |
| No nginx vhost and no certificate for `crm.preprod.crm-prionex.online`; the name resolves but falls through to s1's default vhost (`CN=admin.techno-finance.online`) | §3 b/k, 2026-08-23 | **ours — Story 5.2.** The one piece of PRE-PROD infrastructure that genuinely does not exist |
| `README.md:136` labels the legacy DEV stand (`72.62.17.132`, `dev.crm-prionex.online`) under an **`Environment: Pre-production`** heading. Harmless while no PRE-PROD existed; **actively dangerous now that one does** (`deferred-work.md:872-892`) | in-repo, verifiable at `fc6bfe82` | ⚠️ **routed, not fixed here** — `README.md` is inside Story 4.9's blast radius (§12). Owner: coordinator, to land after 4.9 merges |

⚠️ *"Configured wrong is worse than unconfigured"* — the CORS row looks done and fails only in a
browser, at the only moment anyone would look. Say so in the record; do not file it as a nicety.

### 9. Run budget model — the floor, and the line every ledger before 4.7 forgot

retro-D4 (`epic-3-retro-2026-08-18.md:77`): **declare before work; the ledger closes only against a
query, re-run after the merge commit lands.** A ledger closed at PR-open is not closed. If the query
cannot be run, close it with the literal word **OPEN** — never a self-reported number.

🔴 **The permanent story-push line (DN4 of Story 4.7's review, now standing for every story):**
*"pushes to the story's own context/work branch" is a repeating, per-push ledger line, priced per
push, not a single flat "closeout push"* — each one is a real four-job `ci.yml` run. Size it against
the expected number of write-up rounds. Story 4.7 overran by exactly this line; 4.8 closed OPEN at
13 above baseline for a related reason. Budget it honestly and it stops being an overrun.

Also standing, from `deferred-work.md:2515-2547`: a story costs **pushes + 1 PR-open run + 1 merge
run**. Every ledger form before 4.1 was structurally capable of undercounting by two.

**This story's shape is cheap by construction if rung 1 or 2 of §6 works — the entire verification
is read-only and dispatches nothing.** Rung 3 is the only expensive path, which is why it is third.

### 10. Deviations this story takes from the epic's literal text, and why each is forced

| Epic text | This story | Forced by |
|---|---|---|
| AC1 "**When** the isolated environment **is created** on s1" | verified, not created. This repo **never** creates a network | the contour exists; `deploy-stand.yml:1338` "Never `docker network create` anywhere"; `.env.stand.example:99-104` — auto-creating converts `external: true`'s loud refusal into a silent empty network |
| AC2 "when the PRE-PROD **frontend container** is attached" | no PRE-PROD frontend container exists — that is **Story 5.2's**. Verified from a throwaway container on the network instead | 5.2 has not run; the epic ordered 5.1 first |
| AC3 "the DEV stand remains attached to **`crm-network`**" | **`crm-dev-network`** | `crm-network` is the **legacy** stand's network *on a different host* — s1 is `185.185.49.127`, legacy is `72.62.17.132` (`epics.md:236-246`, `deferred-work.md:2482-2513`). The new DEV stand is on `crm-dev-network` (D28 §1) |
| AC4 "a request to `/api/` **against PRE-PROD**" (i.e. the browser path) | narrowed to the **network layer**: the marked request goes to `crm-kong-gateway:8000` from inside the network | the frontend→nginx→Kong path needs a PRE-PROD stand (5.2) and a vhost (5.2). The browser clause is **not claimed**, and routed — not closed UNPROVEN, because it was never this story's to claim |
| — | **AC5 added**: state of record for the three §8 defects + the two §7 falsified facts | the epic assumed a world where these did not exist. Recording them is what makes 5.2 and 5.3 cheap |

Each is *autonomous, subject to Oleg's veto*, and each is repeated in the AC it changes so a reader
of the ACs alone cannot miss it.

### 11. What Story 5.3 is owed by this story

`deploy-stand.yml:157-161` declares `expect_unrouted_api`, default `"true"` — DEV's Kong genuinely
has no `/api/` route, so the guard demands Kong's own `no Route matched` signature. The input's own
description says **PRE-PROD's Kong runs real services and Story 5.3 must set it `"false"`**.

🔴 **But §3 (e) measured `no Route matched` from PRE-PROD's API hostname today** — the same
signature DEV gives. That is measured through *external nginx with a rewritten `Host`*, which is not
the path the guard takes, so it does not settle the question. **It does raise it**, and 5.1 is the
cheapest place to answer it: while inside `crm-preprod-network`, request `/api/` against
`crm-kong-gateway:8000` directly and record the literal status and body. If PRE-PROD's Kong also
answers `no Route matched` on that path, `expect_unrouted_api: "false"` is still correct (it only
*relaxes* the check) but 5.3's rationale needs restating. Record the observation; do not change any
workflow.

⚠️ **Second thing 5.3 and 5.2 are owed, and it is a real open item.** `deferred-work.md:934-937`
records as **unverified** that Kong listens on `8000` *inside* the network for PRE-PROD. Their PROD
plan sets `KONG_PORT=8330`; our nginx hardcodes **both** the name and the port.
`docs/preprod-infrastructure-requirement.md:91-93` argues from their compose that `KONG_PORT` maps
only the *published host* port and the in-network listener is always `8000` — that is a document
read, not a measurement. **5.1 is inside the network anyway. Measure it.** (`KONG_PORT` is also on
Oleg's pending list for 6.4 — Dev Notes §6.)

### 12. 🔴 Story 4.9 is in flight right now. This is a hard boundary, not a courtesy.

Story 4.9 (*Cut DEV Over to the New Stand*) is being implemented in parallel on `story-4-9/*`. The
coordinator serializes host-side work between epics.

**This story must not modify, and must not push any change to:**

- `.forgejo/workflows/deploy-stand.yml`, `deploy-dev.yml`, `dev-reset.yml`
- the DEV stand on s1 — its directory, its `.env`, its container, its network membership
- `README.md`, `docker-compose.server.yml`, or any artifact of Story 4.9
- `4-9-cut-dev-over-to-the-new-stand.md`, or any `story-4-9/*` branch

**Reading them is fine and required.** `docker network inspect crm-dev-network` and
`docker inspect` on the DEV container are read-only and are how N4 gets measured.

⚠️ **One consequence to design for:** 4.9 may change the DEV stand underneath this story's
measurement. Every DEV-side observation must be **timestamped in UTC** and stated as *the state
observed at that moment*, never as 4.9's end state. If the DEV stand appears mid-cutover, record
what was seen and say so — do not wait, do not retry until it looks tidy, and do not touch it.

---

### Prohibitions

🚨 **A prohibition here cannot be overridden by a subtask.**

1. **Create nothing on s1.** No `docker network create`, no `docker run` that is not `--rm`, no
   container left behind, no file written outside `/tmp` and removed on exit. Every host-side action
   in this story is read-only or self-cleaning.
2. **Never `docker network connect` or `disconnect` anything.** The claim under test is which
   containers are attached to what. Touching it destroys the measurement and the stand.
3. **Do not restart, stop, recreate or `docker compose down` anything** — most especially not
   `crm-preprod-kong-gateway` or any of the 69 containers, which belong to `CRM/api-prionex`.
4. **Do not modify `deploy-stand.yml`, `deploy-dev.yml` or `dev-reset.yml`.** §12.
5. **Do not touch the DEV stand, `README.md`, `docker-compose.server.yml`, `.github/`,
   `nginx.conf`, `Dockerfile.prod`, `.env.dev.example`, `docker-compose.stand.yml`.** NFR5 / D7 /
   §12. Reading is required; writing is forbidden.
6. **No `${{ }}` inside any `run:` body — not even inside a shell comment.** Forgejo substitutes
   inside comments too (`build.yml:796-799` — corrected from `:812-816`, coordinator's citation
   audit, 2026-08-23) and one empty token once rejected an entire workflow with no diagnostic.
   Vacuously satisfied if no workflow is written; stated because a "tiny helper" is exactly how it
   gets violated.
7. **Never print a token value.** Story 4.2's own review found one in a transcript
   (`deferred-work.md:39-54`). `/root/.fj_reg_4_2.token` and `/root/.fj_token` hold live
   credentials; `.fj_token` holds `FJ_TOKEN=<value>`, not a bare token — extract with
   `cut -d= -f2-`. If a query starts returning `401`, that is a pending revocation, not a bug.
8. **Never reach OpenBao through `/usr/local/bin/bao`.** HTTP with an explicit `X-Vault-Token`
   only (§7, `deferred-work.md:701-712`).
9. **Do not fall back to `crm-network` for anything, ever.** An unresolvable
   `crm-kong-gateway` is a STOP (`.env.stand.example:108-109`, `deploy-stand.yml:2132`).
10. **Do not close a row you did not measure.** `UNPROVEN` / `OPEN` / `PENDING (owner: name)` /
    *not claimed* are four different dispositions and are not interchangeable — §6 and Task 9.4.
11. **Do not carry the 2026-08-15 measurements forward as this story's evidence.** They are the
    prior, not the finding. Re-measure (§1).
12. **Do not edit `deferred-work.md` in place.** 🔴 **Resolved 2026-08-23 (coordinator's audit —
    this rule was self-contradictory as written: "append at EOF" vs "closures go under the
    original" name two different locations):** **new** findings append at EOF; **closures of
    existing entries** are added immediately **under the original entry** (not at EOF), with the
    superseded text struck (`~~…~~`), never deleted; owners are names or story numbers, never
    trigger conditions.
13. **A subagent report is not evidence.** Every number in this story's evidence tables must be
    obtained first-hand by the dev agent, from the host, the network, or the wire.

---

## Acceptance Criteria

> Source: `epics.md:2173-2200`. Covers **FR27** (`epics.md:248-260`, PRE-PROD on its own network
> with its own Kong answering to `crm-kong-gateway` inside it) and **NFR5** (`epics.md:321-325`,
> legacy stands untouched). Deviations from the epic's literal wording are named in each AC and
> argued in §1–§12.

**AC1 — `crm-preprod-network` exists on s1 with the PRE-PROD Kong attached, established by direct
observation dated in this story's own window; nothing is created.**

**Given** the commitment secured in Story 1.6 and the contour delivered by `CRM/api-prionex`
**When** the PRE-PROD network is inspected read-only on s1
**Then** a Docker network named `crm-preprod-network` exists, and its attached-container count is
recorded as measured
**And** `crm-preprod-kong-gateway` is among its attached containers, with its network-alias set
recorded verbatim — including `crm-kong-gateway`
**And** the observation carries a UTC timestamp and the channel it came through.

> 🔴 **DEVIATION, STATED (this story, autonomous — subject to Oleg's veto).** The epic reads *"When
> the isolated environment **is created** on s1"*. It exists. This AC verifies; it does not build,
> and **this repository never creates a Docker network on any code path** (`deploy-stand.yml:1338`).
> §10.
> 🔴 **DEVIATION, STATED (added 2026-08-23, coordinator's citation audit).** "Given the commitment
> secured in Story 1.6" overstates what happened: Story 1.6's ask was never actually directed to
> `CRM/api-prionex` in a way that produced a response — the contour was delivered **unilaterally**,
> via their commit `517e6975` (§1 row 3), on their own timeline. Read "Given" as *"given that the
> contour arrived, whatever the mechanism"*, not as evidence Story 1.6's request was answered as sent.
> ⚠️ **METHOD NOTE.** Host-side. If §6's ladder yields nothing, this row closes **UNPROVEN** with
> the rung that failed named — not with the 2026-08-15 reading, which is a prior (§1, Prohibition 11).

---

**AC2 — inside `crm-preprod-network`, the name `crm-kong-gateway` resolves to the PRE-PROD Kong by
address identity, Kong itself answers, and the same probe fails where it must.**

**Given** `nginx.conf:39,50` resolve `crm-kong-gateway` by name inside the stand's network, baked
into a byte-identical image at `Dockerfile.prod:55-56`
**When** a throwaway container is attached to `crm-preprod-network`
**Then** `getent hosts crm-kong-gateway` returns an address, and that address is **identical** to
`crm-preprod-kong-gateway`'s own address on that network — resolution alone does not close this row
**And** an HTTP request to `crm-kong-gateway:8000` returns a real response from Kong, with the
status, the `X-Kong-Response-Latency` header and the literal body recorded
**And** the port `8000` is confirmed as the in-network listener by that same request, closing
`deferred-work.md:934-937` for PRE-PROD
**And** the identical `getent` command from a throwaway container on the built-in `bridge` network
returns **empty with exit 2** — the discriminating negative, N3.

> 🔴 **DEVIATION, STATED (this story, autonomous — subject to Oleg's veto).** The epic says *"the
> PRE-PROD **frontend container**"*. There is none — Story 5.2 provisions it. A throwaway container
> on the same network exercises the same DNS scope through the same resolver; the substitution is
> named, not silent. What it does **not** prove is the frontend image's own behaviour, which 5.2
> re-verifies with `docker exec <container> getent hosts crm-kong-gateway` on the real stand.
> ⚠️ **CLARIFICATION, not deviation.** "Address identity" is Story 4.2's bar (D28 §2,
> `deferred-work.md:2653-2657`), not an invention here. It exists because both Kongs answer to the
> same alias, so mere resolution is consistent with reaching the wrong one.

---

**AC3 — the PRE-PROD contour and the DEV contour are demonstrably two different backends, proved by
at least one discriminator that needs no host access and one that does.**

**Given** the new DEV stand shares s1 with PRE-PROD, and the legacy stand does not
**When** the two contours are compared
**Then** the outside-in discriminator N1 holds: `Access-Control-Allow-Origin` differs between
`api.crm.preprod.crm-prionex.online` and `api.crm.dev.crm-prionex.online`, and neither value changes
under a supplied `Origin` — recorded with both literal values
**And** the host-side discriminator N4 holds — 🔴 **rescoped 2026-08-23 (coordinator's audit): by
container identity, not raw address inequality**, which two different networks would guarantee
either way. `crm-kong-gateway` resolves, inside `crm-preprod-network`, to `crm-preprod-kong-gateway`'s
own container (matched by ID via that network's inspect output), and inside `crm-dev-network` to
`crm-dev-kong-gateway`'s own container — **the two container IDs differ**
**And** the container sets attached to the two networks are **disjoint** — no container appears in
both (N4's companion; §2 claim 4)
**And** the DEV stand is observed still attached to **`crm-dev-network`**, unchanged and unaffected,
with the observation timestamped in UTC and asserted only as of that moment.

> 🔴 **AMENDED (this story, autonomous — subject to Oleg's veto), on two points.**
> **(i)** The epic says the DEV stand *"remains attached to `crm-network`"*. `crm-network` is the
> **legacy** stand's network, and the legacy stand is not on s1 at all — s1 is `185.185.49.127`, the
> legacy stand is `72.62.17.132` (`epics.md:236-246`, `deferred-work.md:2482-2513`). The new DEV
> stand is on `crm-dev-network` (D28 §1). NFR5's exposure on s1 is therefore **zero by
> construction**, and this AC says so rather than performing a check against a machine this story
> never contacts.
> **(ii)** The epic's *"no container is attached to both networks"* is kept verbatim in substance
> and given a method. ⚠️ It has **no prior record in `deferred-work.md`** — this is a new
> measurement, not a re-confirmation.
> 🔴 **§12 applies.** Every DEV-side reading is read-only and timestamped; Story 4.9 may be moving
> the DEV stand while this runs. Record the state seen; never assert 4.9's end state.

---

**AC4 — a marked request issued inside `crm-preprod-network` reaches the PRE-PROD Kong and does not
appear at the DEV Kong; the browser path is explicitly not claimed.**

**Given** an end-to-end request path at the network layer
**When** a request carrying a unique, greppable marker in its path is issued to
`crm-kong-gateway:8000` from inside `crm-preprod-network`
**Then** the marker appears in `crm-preprod-kong-gateway`'s log
**And** the marker does **not** appear in `crm-dev-kong-gateway`'s log over the same window — N5
**And** the response's status and body are recorded verbatim, feeding §11's `expect_unrouted_api`
observation for Story 5.3.

> 🔴 **NARROWED AND SUBSTITUTED (this story, autonomous — subject to Oleg's veto).** The epic's
> *"a request to `/api/` against PRE-PROD"* means the browser path: frontend container → its nginx →
> Kong. That path requires a PRE-PROD stand (Story 5.2) and a frontend vhost and certificate (Story
> 5.2, §8). Neither exists. The browser clause is **not claimed by this story at all** and is routed
> to Story 5.2 — it is *not* closed UNPROVEN, because it was never 5.1's claim to make (the Story
> 4.7 Task 10.4 distinction). What is claimed is the network-layer isolation, which is the part the
> epic's own title is about.
> ⚠️ **METHOD NOTE.** Reading `crm-dev-kong-gateway`'s log means reading another team's container
> log — read-only, no `exec`, no restart (Prohibition 3). If their logs are unreadable with the
> access available, this row closes **UNPROVEN** and N1 (AC3) carries the isolation claim alone,
> stated as such.

---

**AC5 — the state of PRE-PROD's three known defects and this plan's two falsified facts is recorded
fresh, each with an owner and a target story, and none of them is fixed here.**

**Given** PRE-PROD's contour is running but not complete
**When** its current state is recorded
**Then** the PRE-PROD Kong's CORS configuration is measured — the literal `Access-Control-Allow-Origin`,
its invariance under a supplied `Origin`, the preflight behaviour — and routed to the external ask
with `CRM/api-prionex` named as owner and Story 5.2 as consumer
**And** the absence of an nginx vhost and certificate for `crm.preprod.crm-prionex.online` is
measured and routed to Story 5.2 as **ours**
**And** the `README.md:136` "Pre-production" mislabel is recorded as now-live and **routed, not
fixed** — `README.md` is inside Story 4.9's blast radius (§12)
**And** the two falsified inherited facts of §7 — the OpenBao value and the `Dockerfile.prod:34`
citation — are recorded as findings, with the artifacts that still carry the stale text named by
path and line
**And** 🔴 **(added 2026-08-23, coordinator's citation audit — N2 had no AC anchor as originally
written)** N2 — `dig preprod.crm-prionex.online` and `dig api.preprod.crm-prionex.online` — is
re-confirmed **NXDOMAIN**, closing the amended FR25/1.6 naming record on this story's own fresh
evidence rather than the inherited 2026-08-15 reading (Task 2.5).

> 🔴 **ADDED (this story, autonomous — subject to Oleg's veto).** Not in the epic; assigned to this
> story by name, because 5.1 is the story that is already looking at all of it and because §8's
> first row is the class of defect that *looks done and fails only in a browser*.
> ⚠️ Every row here is a **record with an owner**, never a patch. Prohibition 5.

---

## Tasks / Subtasks

### Task 1 — Establish the ledger baseline before the first push (AC: all)

- [ ] 1.1 Re-read §9. The ledger is declared **before** work, closes **only against a query**, and
      "pushes to this story's own branch" is a **repeating, per-push line**, not a flat one.
- [ ] 1.2 Query the instance-wide baseline `action_run.id` (`docker exec forgejo-postgres psql`,
      the method D31 documents, or the `actions/runs` API). Record the literal value and the channel.
- [ ] 1.3 If no channel is reachable: record the baseline as **OPEN** with the reason, and say so
      in the ledger. Do not invent a number and do not carry 4.8's.
- [ ] 1.4 Fill the declared-floor table in the Run Budget Ledger below **before** pushing anything.

### Task 2 — Re-measure the outside-in evidence (AC: 3, 5)

*Zero host access needed. Do this first — it is the floor that keeps the story from closing empty.*

- [ ] 2.1 Re-run every row of §3 (a)–(k) first-hand. Record each result with a UTC timestamp.
      🔴 Re-measure; do not copy §3 (Prohibition 11). If any row now differs from §3, **the
      difference is the finding** — record it, do not smooth it.
- [ ] 2.2 N1: capture both `Access-Control-Allow-Origin` values verbatim, and both again with an
      explicit `Origin: https://crm.preprod.crm-prionex.online`. State whether the value moved.
- [ ] 2.3 Capture the `OPTIONS` preflight for the same origin: status, and every `Access-Control-*`
      header present or absent.
- [ ] 2.4 Capture the TLS certificate for `crm.preprod.crm-prionex.online` — subject, SAN, issuer —
      and state plainly whether it matches the requested name.
- [ ] 2.5 Confirm `preprod.crm-prionex.online` and `api.preprod.crm-prionex.online` are still
      NXDOMAIN (N2), so the amended FR25/1.6 values stay evidenced rather than remembered.

### Task 3 — Climb the access ladder and write the probe script (AC: 1, 2, 3, 4)

- [ ] 3.1 Try rung 1: `ssh root@10.67.0.1` (the **private** address — §6; the external one times out
      by firewall design). Record the exact outcome, whichever way it goes.
- [ ] 3.2 Write the read-only probe script regardless of 3.1's outcome: a single copy-pasteable
      block, no arguments, no writes, every container `--rm`, tolerant of any one command failing.
      It must emit every measurement Tasks 4–6 need, each on its own labelled line. 🔴 **Probe image:
      `alpine`, matching Story 4.2/D28 §2's precedent for the identical bridge-network `getent`
      negative control** — already present on s1's local image cache from that story (coordinator's
      citation audit, 2026-08-23). Do not pull a different image; pulling a new one is a Prohibition
      1 violation. If `alpine` is not present, confirm with `docker image inspect alpine` before
      running anything and escalate rather than pull.
- [ ] 3.3 Review the script against Prohibitions 1, 2, 3, 9 line by line before it runs anywhere.
      Any `create`, `connect`, `disconnect`, `restart`, `stop`, `down`, or non-`--rm` `docker run`
      is a defect in the script, not a judgement call.
- [ ] 3.4 If rung 1 failed: rung 2 — hand the script to Oleg with the one sentence saying what it
      proves and that it changes nothing. Record it as **PENDING, owner: Oleg**, with the literal
      ask. Zero runs.
- [ ] 3.5 🔴 **Default changed 2026-08-23 (coordinator's audit, resolving OQ1):** if rungs 1 and 2
      are both closed off, the host-side rows close **UNPROVEN** (§6, Prohibition 10) with the rung
      that failed named — this session does **not** build rung 3 unprompted. Rung 3 — a dispatch-only
      `.forgejo/workflows/verify-preprod-network.yml`, sibling containers through `docker.sock`,
      `runs-on: deploy-dev-preprod`, calling nothing and touching no existing workflow (§12,
      Prohibition 4) — is recorded as a **routed ask to Oleg** (OQ1) with its price named, not
      written. Oleg decides whether the workflow is worth the run cost for a one-time verification;
      only build it if he says so.

### Task 4 — AC1: the network and its Kong (AC: 1)

- [ ] 4.1 `docker network inspect crm-preprod-network` — record existence, id, subnet, and the
      attached-container **count** as measured (the 69 in §1 is a prior, not this story's number).
- [ ] 4.2 Record `crm-preprod-kong-gateway`'s presence in that network and its **full alias list**
      verbatim, confirming `crm-kong-gateway` is among them. 🔴 **Also record its per-container
      `IPv4Address` on `crm-preprod-network`** from the same inspect output (`.Containers[].IPv4Address`
      keyed by container ID/Name) — Task 5.2 needs it and Task 4.1 alone does not collect it
      (coordinator's citation audit, 2026-08-23).
- [ ] 4.3 Record the network's `Created` timestamp and driver, and note whether the network id
      differs from anything previously recorded — a recreated network is the hazard
      `deferred-work.md:2804-2811` names.
- [ ] 4.4 Timestamp everything in UTC and name the channel (SSH / Oleg / workflow run id).

### Task 5 — AC2: resolution by address identity, plus the negative control (AC: 2)

- [ ] 5.1 `docker run --rm --network crm-preprod-network alpine getent hosts crm-kong-gateway`
      — record the address and exit code. (Image: `alpine`, per Task 3.2's note — already present
      on s1 from Story 4.2, no pull.)
- [ ] 5.2 Record `crm-preprod-kong-gateway`'s own address on `crm-preprod-network` from Task 4.1's
      inspect output. **Assert the two are identical.** Resolution alone does not close this row.
- [ ] 5.3 From the same network, `GET http://crm-kong-gateway:8000/` — record status,
      `X-Kong-Response-Latency`, and the literal body. This is what makes it Kong answering and not
      DNS answering (D28 §2 layer 2).
- [ ] 5.4 Same request against `/api/` — record status and literal body. 🔴 This is §11's
      `expect_unrouted_api` observation for Story 5.3. Record it; **change no workflow**.
- [ ] 5.5 State explicitly that `8000` was the working in-network port, closing
      `deferred-work.md:934-937` for PRE-PROD — or, if it was not, that is a significant finding
      about `KONG_PORT` and it goes to Oleg and to Story 5.2 the same day.
- [ ] 5.6 ✅ **N3, the discriminating negative:** the identical `getent` command from
      `docker run --rm --network bridge …`. Expect **empty output, exit 2**. 🔴 If it *resolves*,
      stop and escalate — the name would be host-wide, and every other row in this story would be
      worthless.

### Task 6 — AC3 and AC4: the isolation proofs (AC: 3, 4)

- [ ] 6.1 🔴 **Rescoped 2026-08-23 (coordinator's audit) — N4 by container identity, not raw
      address inequality**, which two distinct networks would guarantee regardless of isolation.
      Repeat 5.1 on `crm-dev-network`: `docker run --rm --network crm-dev-network <same image>
      getent hosts crm-kong-gateway`, record the address. Then match that address to a container
      Name/ID in `crm-dev-network`'s own `docker network inspect` output (`.Containers[]`), and match
      `crm-preprod-network`'s resolved address (5.1/5.2) to a container Name/ID the same way. **Assert
      the two container IDs differ.** This closes AC3's "each equal to its own stack's Kong" clause,
      which raw address inequality alone cannot — two different networks always yield two different
      addresses even for the same container.
- [ ] 6.2 `docker network inspect crm-dev-network` read-only. Extract the attached-container id set
      **and** the per-container `IPv4Address` map (mirrors Task 4.2's PRE-PROD-side collection) so
      6.1's identity match has DEV-side data to compare against. 🔴 Read-only, timestamped, and
      asserted only as of that instant — §12.
- [ ] 6.3 Compute the intersection of the two attached-container id sets. **Assert it is empty.**
      Record the two set sizes and the intersection literally, so an empty result is visibly a
      computed one rather than an assumed one.
- [ ] 6.4 Record the DEV stand container's own network membership (`docker inspect`, read-only),
      confirming `crm-dev-network` and nothing else. If it looks mid-cutover, record that and move on.
- [ ] 6.5 N5: issue `GET http://crm-kong-gateway:8000/__isolation-probe-<unique>/` from inside
      `crm-preprod-network`, where `<unique>` is a value that cannot pre-exist in any log. Record
      the exact marker used and the UTC time.
- [ ] 6.6 `docker logs --since <t> crm-preprod-kong-gateway` — grep for the marker. Expect a hit.
      🔴 **UNPROVEN fallback added 2026-08-23 (coordinator's audit, for symmetry with 6.7):** if
      `crm-preprod-kong-gateway`'s own logs are unreadable with the access available, close this row
      **UNPROVEN** and say so — do not infer the hit from N1/N3 alone.
- [ ] 6.7 `docker logs --since <t> crm-dev-kong-gateway` — grep for the marker. **Expect no hit.**
      Record the command, the window, and the literal empty result. If their logs are unreadable,
      close this row **UNPROVEN** and say that N1 carries AC3 alone.
- [ ] 6.8 State plainly, in one sentence, which discriminators fired and which did not, and what
      each one would have looked like had isolation been absent.

### Task 7 — AC5: record the defects, fix none (AC: 5)

- [ ] 7.1 Write the CORS row from Task 2.2/2.3: literal origin value, invariance under `Origin`,
      preflight behaviour, and the consequence — a browser at the real frontend origin is refused.
      Owner `CRM/api-prionex`; consumer Story 5.2. ⚠️ Say *"configured wrong is worse than
      unconfigured"* explicitly; it is why this is a defect and not a to-do.
- [ ] 7.2 Write the vhost/certificate row from Task 2.4. Owner: **ours, Story 5.2.**
- [ ] 7.3 Write the `README.md:136` row: quote the line, state that it became dangerous the moment a
      real PRE-PROD existed, and route it. 🔴 **Do not edit `README.md`** — §12, Prohibition 5.
      Owner: coordinator, after Story 4.9 merges.
- [ ] 7.4 Write the §7(a) finding: `secret/fe/pre-prod/app` has held the real value since
      2026-08-15. Name every artifact still carrying the stale placeholder text by path and line —
      `epics.md:2169-2171`, `build.yml:596-597`, `deferred-work.md:1794-1798`. 🔴 Verify the current
      value before asserting it (§7's own rule), over HTTP with an explicit token or not at all
      (Prohibition 8). If it cannot be verified this session, say the *record* says version 2 and
      that this session did not re-read it — that is a different claim, and make it the different one.
- [ ] 7.5 Write the §7(b) finding: `Dockerfile.prod:55-56`, not `:34`. List the artifacts repeating
      the stale citation.

### Task 8 — Correct the one artifact whose claim this story falsifies (AC: 5)

- [ ] 8.1 `docs/preprod-infrastructure-requirement.md:1-16` still reads **«Статус: не направлено»**
      and *«Эпик 5 плана миграции остаётся заблокированным»*. Both are false: the contour is
      running, the alias arrived, and this story just measured it. Append a dated amendment block in
      the document's own house style — strike the falsified sentence (`~~…~~`), do not delete it,
      and state what replaced it and on what evidence. 🔴 Russian, matching the document.
- [ ] 8.2 Do **not** rewrite the requirement's body, its §2.4/§2.5, or its history. The wrong values
      are evidence of how the error happened (`sprint-change-proposal-2026-08-15-preprod-reality.md`
      §7). One amendment block, appended.
- [ ] 8.3 Append this story's findings to `deferred-work.md` at EOF under a new
      `## Deferred from: story 5-1-stand-up-the-isolated-pre-prod-backend-network (2026-08-…)`
      heading, with a preamble stating how many findings the round produced and why the routed ones
      are somebody else's. Owners are names or story numbers. Prohibition 12.

### Task 9 — Close (AC: all)

- [ ] 9.1 Re-run the ledger query **after the merge commit lands** and reconcile: declared floor vs
      actual, itemized by phase, plus `count(*)` and `max(index)` moving by the same amount so no
      hidden run is possible. Name any overrun and its cause. **A ledger closed at PR-open is not
      closed.** If the query cannot be run, close it with the literal word **OPEN**.
- [ ] 9.2 Draft the D-record for `docs/migration-decisions.md`. 🔴 Next free number is **D34** —
      **verify against open branches first**, `story-4-9/*` included, before claiming it. Russian,
      matching the file. 🔴 Do not let the roll-up flatter the leaves: if a row closed UNPROVEN, the
      D-record says UNPROVEN. That was Story 4.7's headline review finding.
- [ ] 9.3 Verify every Prohibition 1–13 by execution, not by memory — name each and how it was met
      or, if one was breached, say so in plain text rather than in spirit.
- [ ] 9.4 State which AC rows closed **on evidence**, which closed **vacuously**, which closed
      **UNPROVEN**, and which are **not claimed** and routed. **Do not close an AC you did not
      close.** AC4's browser clause is *not claimed*, not UNPROVEN — get that distinction right.
- [ ] 9.5 🔴 **Corrected 2026-08-23 (coordinator's audit): the coordinator opens the PR** — standing
      convention for every story in this project (Dev Notes §7). This session does **not** open it.
      Confirm the diff touches no file named in §12 before handing off —
      `git fetch origin main && git diff --name-only origin/main...HEAD`, read the list. ⚠️ Use
      **`origin/main`**, not the local `main` ref: with Story 4.9 checked out in the primary
      worktree, the local `main` is stale, and diffing against it lists a dozen files this story
      never touched. The context session hit exactly that and nearly believed it. Report the clean
      diff-check result and the branch name to the coordinator for PR-open.

---

## Dev Notes

🔴 **`§N` means the numbered block above the ACs. `Dev Notes §N` means the numbered block below.**
They are different sequences and both are referenced throughout.

### 1. The one-paragraph version

The PRE-PROD backend contour already exists and runs; your job is to prove it is genuinely separate
from DEV, using checks that could have failed. The whole verification is read-only. Two of the five
discriminators (N1, N2) need nothing but `curl` and `dig` and should be done first, because they
guarantee the story cannot close empty even if s1 stays unreachable. The other three need to be
*inside* the Docker networks, and the access ladder for that is §6 — try SSH to the private address
first, ask Oleg second, and only build a dispatch-only workflow as a third resort. Create nothing,
connect nothing, restart nothing, and touch none of Story 4.9's files.

### 2. Infrastructure facts

| Thing | Value | Source |
|---|---|---|
| s1 | `185.185.49.127`; SSH from a dev session at **`root@10.67.0.1`** / `s1.private.crm-prionex.com`. External `:22` times out (`ufw`, two admin addresses) | `deferred-work.md:2647-2651` |
| legacy DEV stand | `72.62.17.132`, port `8080`, network `crm-network` — **a different machine** | `epics.md:236-246`, `deferred-work.md:2482-2513` |
| new DEV stand | `/root/crm-prionex/fe-prionex-dev`, container `fe-prionex-dev`, port `127.0.0.1:8082`, network **`crm-dev-network`** | D28 §1 |
| PRE-PROD stand | 🔴 **does not exist yet** — Story 5.2. Planned: `/root/crm-prionex/fe-prionex-preprod`, `127.0.0.1:8083`, `crm-preprod-network` | `deploy-stand.yml:213-232` skeleton |
| network / Kong map | DEV `crm-dev-network` / `crm-dev-kong-gateway`; PRE-PROD `crm-preprod-network` / `crm-preprod-kong-gateway`; PROD `crm-prod-network` / `crm-prod-kong-gateway`; legacy `crm-network`. **Every Kong also carries the alias `crm-kong-gateway`** (and `kong`) | `.env.stand.example:111-116`, `sprint-change-proposal-2026-08-13-kong-naming.md:26-30` |
| dead name | `crm-network-preprod` (that word order) was **abandoned** for the neighbour's convention. The real name is `crm-preprod-network` | `docs/preprod-infrastructure-requirement.md:61-62` |
| the baked-in dependency | `nginx.conf:39,50` → `http://crm-kong-gateway:8000`, copied at `Dockerfile.prod:55-56` | measured at `fc6bfe82` |
| deploy runner | `s1-deploy-dev-preprod`, labels `deploy-dev-preprod`/`dev`/`preprod`/`deploy`, `capacity: 1`, holds `/var/run/docker.sock` | D28 §4, `deferred-work.md:186-190` |
| clocks | coordinator MSK (UTC+3), s1 CEST (UTC+2). **Write everything in UTC** | Story 4.7 §8 |

### 3. Anti-patterns for this story

- **Treating the 2026-08-15 measurements as this story's evidence.** They are 🔴 **eight** days old
  (corrected from "six" — coordinator's citation audit, 2026-08-23) and the contour belongs to a
  team that deploys to it. Prohibition 11.
- **Closing AC2 on resolution alone.** Both Kongs answer to `crm-kong-gateway`. Resolution is
  consistent with reaching the wrong one; address identity is not.
- **Skipping N3** because it "obviously" fails. It is the control that gives N4 meaning, and it is
  one `docker run --rm`.
- **Building the verification workflow first** because it is the most agent-shaped rung. It is the
  most expensive one and it is third.
- **Reconstructing the evidence tables at the end.** Write each row as it happens; a reconstruction
  is a memory, not a measurement.
- **Fixing the CORS origin, or the vhost, or `README.md`.** All three are recorded, none is fixed.
- **Letting the roll-up flatter the leaves.** Story 4.7's review: *"the dev did the honest thing at
  every leaf and the document did the flattering thing at every node."* Task 9.4 exists for that.
- **Any write to s1.** This story's entire host-side footprint should be zero bytes changed.

### 4. Previous story intelligence

- **Story 4.1** demonstrated the silent failure this story exists to prevent: a stand on a
  backend-less network reporting `healthy` and serving `200` while `crm-kong-gateway` did not resolve
  at all (Task 6.2, `deferred-work.md:2447-2465`). No guard can catch a wrong-but-valid network name.
- **Story 4.2 / D28 §2** is the method template. Three layers: address identity → Kong itself
  answering (`X-Kong-Response-Latency`, `no Route matched`) → the `bridge`-network negative control.
  Copy the shape, change the network.
- **Story 4.2 / D28 §4** is why rung 3 exists and why it is shaped as sibling containers through
  `docker.sock`: the runner's `valid_volumes` does not include `/root/crm-prionex/*`, but the socket
  it already holds is root-equivalent. D29 chose option (e) on that basis and every deploy since has
  used it.
- **Story 4.7** contributed the permanent per-push ledger line (DN4) and the roll-up honesty
  finding. Both are §9 and Task 9.4.
- **Story 4.8 / D33** contributed `expect_unrouted_api` and the caller skeleton. §11 is what this
  story owes 5.3 about it. 🔴 This story writes **no** caller and touches **no** workflow.
- **`deferred-work.md:2812-2825`** — attaching our stand to a network we do not own **blocks that
  team's `docker network rm`**, and they were never told. That is 5.2's exposure, doubled from DEV.
  Worth naming in this story's own findings while looking straight at it.

### 5. Non-goals — absences that are decisions, not omissions

- **No PRE-PROD frontend stand.** Story 5.2. This story deliberately does not provision one, and
  AC2 says so where it substitutes a throwaway container.
- **No nginx vhost, no certificate.** Story 5.2, recorded not built (AC5).
- **No CORS fix.** External, `CRM/api-prionex`. Recorded not fixed (AC5).
- **No deploy workflow, no caller, no `expect_unrouted_api` change.** Story 5.3.
- **No `README.md` edit.** Routed — §12.
- **No Story 4.8 backfill.** `deferred-work.md:3374-3399` leaves three claims resting on relayed
  data awaiting *"the first session with restored SSH/psql access"*, and this story might be that
  session. 🔴 **Do not do the backfill here** — it writes to D31 §7 and Story 4.8's artifacts, and
  4.9 is in flight. If SSH/psql comes up, capture the raw query output verbatim into this story's
  Debug Log References and hand it to the coordinator. Capturing is free; editing is somebody else's.
- **No claim about the legacy stand.** It is on another machine. NFR5's s1 exposure is zero by
  construction, and this story says that rather than pretending to check.

### 6. Things pending on Oleg — do not depend on them silently

| Item | State |
|---|---|
| `secret/fe/pre-prod/app` real value | ✅ **already written 2026-08-15** (§7). The brief that this story was created from believed it was still a placeholder; the repo says otherwise, twice, with evidence. Verify, then stop treating it as pending |
| `fe_review_1_7` (Forgejo API token) | pending. A `401` on a ledger query is this, not a bug |
| `KONG_PORT` for Story 6.4 | pending. AC2/Task 5.5 gives it a measured PRE-PROD data point for free |
| `SLACK_CD_WEBHOOK_URL` | parked with Story 4.5. Irrelevant here — this story notifies nothing |
| the external ask to `CRM/api-prionex` covering CORS | extended 2026-08-23. AC5 supplies its evidence; it does not wait on its answer |

### 7. Conventions that bind this story

- **Story file in English** per `_bmad/bmm/config.yaml`; **D-records in Russian** matching
  `docs/migration-decisions.md`. Next free number **D34** — verify against open branches first.
- **Branch** `story-5-1/pr-<n>-<purpose>`; PR into `main`. `main` is protected with eight required
  contexts and `apply_to_admins: true` (D16) — nothing merges without CI.
- 🔴 **`D4`/`E5` collide across two numbering schemes.** The retro action items are **retro-D4** /
  **retro-E5** (`epic-3-retro-2026-08-18.md:77-78`). The D-series in `docs/migration-decisions.md`
  is a different sequence — its `D4` is stand parameterization and it has no `E5`.
- **retro-D4:** declare before work; close only against a query; **re-query after the merge.**
- **retro-E5:** every verification row needs a discriminating negative where one is measurable. §5
  names five before any of them runs, so none can be invented afterwards to fit the result.
- **`deferred-work.md`:** append at EOF, never rewrite in place; closures go under the original;
  superseded text struck, not deleted; owners are names or story numbers, never trigger conditions.
- **Label every number measured, not computed.** Arithmetic on top of direct reads is arithmetic and
  must say so.
- **Model split** per Oleg's standing instruction: create-story Opus, dev-story Sonnet,
  code-review Opus.
- **Coordinator closes ledgers and pushes stories** (D4 + the permanent story-push line). This
  session pushes the branch and opens no PR.

### 8. The autonomous decisions in this story, in one place (for a one-read veto)

1. **The story is verification-shaped**, not construction-shaped — nothing is created on s1, and
   this repository creates no Docker network on any code path. (§10 row 1; AC1)
2. **Access ladder, in this order:** SSH to the private address → ask Oleg to run the script → a new
   dispatch-only workflow. Rung 3 is last because it is the only one that costs runs. (§6; Task 3)
3. **AC2 substitutes a throwaway container for the not-yet-existing PRE-PROD frontend container**,
   and says so in the AC rather than in a note. (§10 row 2; AC2)
4. **AC3's network name is amended `crm-network` → `crm-dev-network`**, and NFR5's s1 exposure is
   declared zero by construction rather than checked against a machine we never contact.
   (§10 row 3; AC3)
5. **AC4 is narrowed to the network layer**; the browser path is *not claimed* and routed to 5.2 —
   deliberately not "closed UNPROVEN". (§10 row 4; AC4)
6. **AC5 is added** — the three defects and the two falsified facts, recorded with owners, none
   fixed. (§10 row 5; AC5)
7. **`README.md:136` is routed, not fixed**, because `README.md` is inside Story 4.9's blast radius,
   even though the mislabel becomes dangerous exactly now. (§8; Task 7.3)
8. **`docs/preprod-infrastructure-requirement.md`'s header IS corrected here** — it is the one
   artifact whose central claim ("Epic 5 remains blocked") this story directly falsifies, and it is
   nowhere near 4.9. (Task 8.1)
9. **Story 4.8's backfill is captured but not performed**, for the same blast-radius reason.
   (Dev Notes §5)

A veto on 1, 3, 4, 5 or 6 changes the ACs; a veto on 2, 7, 8 or 9 changes only the tasks.

---

### Project Structure Notes

**Files this story writes:**

- `_bmad-output/implementation-artifacts/5-1-stand-up-the-isolated-pre-prod-backend-network.md` (this file)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `epic-5` → `in-progress`,
  `5-1-…` → `ready-for-dev`. ⚠️ Concurrently edited by Story 4.9's session: pull/rebase before push,
  and on conflict rebase and retry — **never force-push**.
- `_bmad-output/implementation-artifacts/deferred-work.md` — appended at EOF only (Task 8.3)
- `docs/preprod-infrastructure-requirement.md` — one appended amendment block (Task 8.1)
- `docs/migration-decisions.md` — D34, at close (Task 9.2)
- `.forgejo/workflows/verify-preprod-network.yml` — **only if §6 rung 3 is reached.** New file,
  dispatch-only, calls nothing, called by nothing.

**Files this story must NOT write** (§12, Prohibitions 4 and 5): `.forgejo/workflows/deploy-stand.yml`,
`deploy-dev.yml`, `dev-reset.yml`; `README.md`; `docker-compose.server.yml`; `docker-compose.stand.yml`;
`docker-compose.yml`; `nginx.conf`; `Dockerfile.prod`; `.env.stand.example`; `.env.dev.example`;
anything under `.github/`; `4-9-cut-dev-over-to-the-new-stand.md`; any `story-4-9/*` branch.

**Nothing on s1 is written at all.**

---

### References

- `_bmad-output/planning-artifacts/epics.md:2116-2201` — Epic 5 preamble and Story 5.1's original ACs
- `_bmad-output/planning-artifacts/epics.md:236-260` — FR25 (port `8083`, and the legacy stand is not on s1), FR26, FR27
- `_bmad-output/planning-artifacts/epics.md:321-325` — NFR5
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-15-preprod-reality.md` — the whole reframing; §5 amends Story 5.1's first two ACs to verification
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-13-kong-naming.md:26-30,88-90` — the network/Kong/stack name table, and what 5.1 was told to keep
- `_bmad-output/implementation-artifacts/sprint-status.yaml:605-625` — the epic-5 preamble
- `_bmad-output/implementation-artifacts/epic-3-retro-2026-08-18.md:77-78` — retro-D4 and retro-E5
- `_bmad-output/implementation-artifacts/deferred-work.md:2447-2465` — the silent wrong-network failure, demonstrated
- `_bmad-output/implementation-artifacts/deferred-work.md:2653-2657` — retro-E5 discharged on the real host for DEV: the method template
- `_bmad-output/implementation-artifacts/deferred-work.md:894-900` — the alias delivered; DNS/TLS/CORS explicitly still out
- `_bmad-output/implementation-artifacts/deferred-work.md:902-942` — the name table; `:934-937` the unverified in-network Kong port
- `_bmad-output/implementation-artifacts/deferred-work.md:2482-2513` — the legacy stand is not on s1
- `_bmad-output/implementation-artifacts/deferred-work.md:2647-2651` — s1's working SSH address
- `_bmad-output/implementation-artifacts/deferred-work.md:2804-2825` — reboot ordering, and our endpoint blocking their teardown
- `_bmad-output/implementation-artifacts/deferred-work.md:2056-2105` — the preprod OpenBao path closed end to end (run 680), and the timestamp lesson
- `_bmad-output/implementation-artifacts/deferred-work.md:701-712` — never use `/usr/local/bin/bao`
- `_bmad-output/implementation-artifacts/deferred-work.md:872-892` — `README.md:136` mislabels DEV as "Pre-production"
- `_bmad-output/implementation-artifacts/deferred-work.md:3374-3399` — Story 4.8's open backfill
- `docs/migration-decisions.md:1344-1469` — D15, the KV paths and the `pre-prod` spelling trap
- `docs/migration-decisions.md:2956-3157` — D28: §1 the DEV stand, §2 the alias proof by identity, §4 the runner's reach
- `docs/migration-decisions.md:3767-3891` — D33: `expect_unrouted_api`, the caller skeleton
- `docs/preprod-infrastructure-requirement.md:1-16` — the header this story falsifies; `:69,91-93` the Kong name-and-port ask; `:245-247` the unanswered §2.4/§2.5
- `nginx.conf:36-56` — the variable upstream and resolver; the reason a wrong network fails silently
- `Dockerfile.prod:55-56` — where `nginx.conf` is baked in (**not** `:34`)
- `.env.stand.example:88-116` — the network axis, the four allowed names, and "an empty result is a STOP"
- `.forgejo/workflows/deploy-stand.yml:157-161,2102-2207` — `expect_unrouted_api` and the recurring Kong guard. **Read-only for this story**
- `.forgejo/workflows/deploy-dev.yml:66-89` — the live caller, as a shape reference. **Read-only**

---

## Dev Agent Record

### Agent Model Used

Story context: Opus (create-story). Implementation: Sonnet (dev-story). Review: Opus (code-review) —
per Oleg's standing model split.

🔴 **A subagent report is not evidence.** Every number in this story's evidence tables must be
obtained first-hand by the dev agent, from the host, the network, or the wire.

### Debug Log References

**Access:** Rung 1 (§6) worked this session — `ssh root@10.67.0.1` succeeded, hostname `NLDW3-3-42-32`,
first confirmed 2026-08-23T18:57:42Z. All host-side measurements below are first-hand over that
channel, not relayed or inherited. Rung 2/3 were not needed.

**Probe script (Task 3.2), written regardless of 3.1's outcome, run verbatim over the rung-1
channel — single copy-pasteable block, every container `--rm`, no writes outside `/tmp` (cleaned on
exit), image `alpine` (already present on s1, confirmed via `docker image inspect alpine` before use,
per Story 4.2/D28 §2 precedent):**

```sh
set -u
echo "=== UTC $(date -u +'%Y-%m-%dT%H:%M:%SZ') ==="

# --- AC1 (Task 4) ---
docker network inspect crm-preprod-network \
  --format '{{.Name}} id={{.Id}} created={{.Created}} driver={{.Driver}} subnet={{range .IPAM.Config}}{{.Subnet}}{{end}} count={{len .Containers}}'
docker inspect crm-preprod-kong-gateway --format '{{json .NetworkSettings.Networks}}'

# --- AC2 (Task 5): resolution by address identity + Kong itself + N3 negative control ---
docker run --rm --network crm-preprod-network alpine getent hosts crm-kong-gateway; echo "exit=$?"
docker run --rm --network crm-preprod-network alpine sh -c \
  'printf "GET / HTTP/1.1\r\nHost: crm-kong-gateway\r\nConnection: close\r\n\r\n" | nc crm-kong-gateway 8000'
docker run --rm --network crm-preprod-network alpine sh -c \
  'printf "GET /api/ HTTP/1.1\r\nHost: crm-kong-gateway\r\nConnection: close\r\n\r\n" | nc crm-kong-gateway 8000'
docker run --rm --network bridge alpine getent hosts crm-kong-gateway; echo "exit=$?"   # N3, expect empty/exit 2

# --- AC3/AC4 (Task 6): N4 by container identity, disjoint sets, N5 marker ---
docker run --rm --network crm-dev-network alpine getent hosts crm-kong-gateway; echo "exit=$?"
docker inspect crm-dev-kong-gateway --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}: ip={{$v.IPAddress}} aliases={{$v.Aliases}}{{end}}'
docker inspect crm-dev-kong-gateway --format '{{.Id}}' | cut -c1-12
docker inspect crm-preprod-kong-gateway --format '{{.Id}}' | cut -c1-12
docker network inspect crm-dev-network --format '{{len .Containers}}'
docker network inspect crm-preprod-network --format '{{range $k,$v := .Containers}}{{$k}}{{"\n"}}{{end}}' | grep -v '^$' | sort > /tmp/pc.txt
docker network inspect crm-dev-network     --format '{{range $k,$v := .Containers}}{{$k}}{{"\n"}}{{end}}' | grep -v '^$' | sort > /tmp/dc.txt
echo "preprod=$(wc -l < /tmp/pc.txt) dev=$(wc -l < /tmp/dc.txt) intersection=$(comm -12 /tmp/pc.txt /tmp/dc.txt | wc -l)"
rm -f /tmp/pc.txt /tmp/dc.txt   # 🔴 filter blank lines before comm -12, or you get a false intersection — see Completion Notes
docker inspect fe-prionex-dev --format 'Networks={{range $k,$v := .NetworkSettings.Networks}}{{$k}}(ip={{$v.IPAddress}}){{end}} Status={{.State.Status}}'

MARK="isolation-probe-$(date -u +%Y%m%dT%H%M%S)"
T=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
docker run --rm --network crm-preprod-network alpine sh -c \
  "printf 'GET /__${MARK}__/ HTTP/1.1\r\nHost: crm-kong-gateway\r\nConnection: close\r\n\r\n' | nc crm-kong-gateway 8000" >/dev/null
sleep 2
docker logs --since "$T" crm-preprod-kong-gateway 2>&1 | grep -F -- "$MARK" && echo "N5: HIT preprod" || echo "N5: NO HIT preprod (unexpected)"
docker logs --since "$T" crm-dev-kong-gateway     2>&1 | grep -F -- "$MARK" && echo "N5: HIT dev (unexpected)" || echo "N5: NO HIT dev (expected)"
```

**Raw command transcripts, UTC-timestamped, this session, over `root@10.67.0.1`:**

- `2026-08-23T18:58:05Z` — `docker network inspect crm-preprod-network`: `id=90bd3e56416e3a000b349b133e0d859c4e6a1149d328ce31e23798c88731f3d0 created=2026-08-11T19:12:51.421330465+02:00 driver=bridge subnet=172.21.0.0/16`, count `69`.
- `2026-08-23T18:58:05Z` — `crm-preprod-kong-gateway` on `crm-preprod-network`: `172.21.0.24/16`, full `Aliases`: `["crm-preprod-kong-gateway","kong","crm-kong-gateway"]`, `EndpointID=327459bd6aaf…`.
- `2026-08-23T18:58:20Z` — `getent hosts crm-kong-gateway` on `crm-preprod-network` → `172.21.0.24 crm-kong-gateway crm-kong-gateway`, exit 0. **Identical to the Kong container's own address — identity confirmed (AC2).**
- `2026-08-23T18:58:45Z` (raw `nc` request, `GET /`) and `2026-08-23T18:58:46Z` (`GET /api/`) against `crm-kong-gateway:8000` from inside `crm-preprod-network`: both `HTTP/1.1 404 Not Found`, `X-Kong-Response-Latency: 0`, `Server: kong/3.4.2`, body `{"message":"no Route matched with those values"}`. **8000 confirmed as the working in-network listener (closes `deferred-work.md:934-937` for PRE-PROD); §11 datum for Story 5.3.**
- `2026-08-23T18:58:56Z` — N3: `getent hosts crm-kong-gateway` on built-in `bridge` → empty output, **exit 2**, as required.
- `2026-08-23T18:59:06Z` — N4 identity match: `crm-dev-network` resolves `crm-kong-gateway` → `172.22.0.53`, which is `crm-dev-kong-gateway`'s own address there (`Aliases: [crm-dev-kong-gateway kong crm-kong-gateway]`). Container ID `6c1b4ac96e8d` (DEV) vs `61eb0eaa9f64` (PRE-PROD) — **different containers, not merely different addresses.**
- `2026-08-23T18:59:19Z`–`19:00:07Z` — disjoint-set check: first pass reported `preprod=70 dev=71 intersection=1`; **the intersection was an artifact** — a trailing blank line from the Go `{{range}}…{{end}}` template present in both sorted files, matched by `comm -12` against itself. Reproduced deliberately five times (`19:00:07.071Z`–`19:00:07.805Z`, all `intersection=1`, all with an *empty* "shared IDs" list — the tell). Re-run with `grep -v '^$'` at `19:00:28Z` (not separately timestamped in this line, see next): **`preprod=69 dev=70 intersection=0`** — true, stable, empty. Recorded as a methodology finding, not an infrastructure defect (`deferred-work.md`, finding 7 of this story's round).
- `2026-08-23T19:00:28Z` — `fe-prionex-dev` (`docker inspect`): `Networks=crm-dev-network(ip=172.22.0.70)`, `Status=running`, `Health=healthy`. No other network membership.
- N5, first attempt `2026-08-23T19:00:38Z`: marker request sent and answered (`404`, same Kong signature); the immediate grep for it under-reported "NO HIT" in this session's own transcript due to a local shell-quoting bug (marker variable carried literal quote characters) — **not a story finding**, a transcript artifact of this run, corrected in the clean re-run below.
- N5, clean re-run `2026-08-23T19:01:08Z`–`19:01:09Z`: marker `isolation-probe-story5-1-20260823T190107-clean` requested against `crm-kong-gateway:8000` from inside `crm-preprod-network`; `docker logs --since 19:01:08Z crm-preprod-kong-gateway` shows the exact request line at `19:01:09Z` (**HIT**); the identical grep against `crm-dev-kong-gateway`'s log over the same window returns nothing (**NO HIT, expected**). AC4/N5 closed on evidence.
- `2026-08-23T19:02:49Z` — ledger baseline, `docker exec forgejo-postgres psql -U forgejo -d forgejo -t -A -c "select max(id), count(*) from action_run;"` → **`1160|1160`**. Read-only, method per D31 §7. Closes Task 1.2 with a real number — the story's own declared fallback (OPEN) was not needed.
- Sandbox-side (no host access), `2026-08-23T18:57:12Z`–`18:57:18Z`: `dig`/`curl`/`openssl` re-runs of §3 (a)–(k) — every value reproduced **identical** to the 2026-08-23 prior in the story's own §3 table (DNS, CORS headers on both hostnames, both TLS certs). No drift found on re-measurement; recorded as confirmation, not a new finding.

**Story 4.8 backfill capture (Dev Notes §5 — captured, not applied):**

- `action_run 1150`: `status=1`, `started=1787496732`, `stopped=1787496781` (epoch seconds). 33
  `action_task_step` rows read back in order; all `status=1` except three (`Validate hold_lock_seconds
  and start the stand-lock holder`, `Safety net — remove this run's holder if the step above failed`,
  `Restore the previous digest if this job failed after down`) at `status=4`. 🔴 **Status-code mapping
  not independently confirmed this session** — do not read `1`/`4` as "success"/"skipped" without
  checking the actual Forgejo enum in source; handing the raw values to the coordinator rather than
  guessing.
- `action_run 1146` (`trigger_event=schedule`, `status=1`, `started=1787450444`, `stopped=1787450518`)
  and `1147` (`trigger_event=workflow_dispatch`, `status=1`, `started=1787450520`, `stopped=1787450563`).
- `action_run.id` for the two 4.8 branch pushes: `d5e5fa65…` → **1144** (`started=1787436745`);
  `a003e25b…` → **1149** (`started=1787496715`, `status=3`) and **1150** (`started=1787496732`,
  `status=1` — the DN4 control dispatch itself, same commit).

### Run Budget Ledger

**Declared 2026-08-23 at context time, before any push, per the model in §9 — a floor, not a flat
count.**

**Baseline:** 🔴 **UPDATED 2026-08-23T19:02:49Z — no longer OPEN.** This session's rung-1 SSH access
(§6) reached `forgejo-postgres` directly; `select max(id), count(*) from action_run;` returned
**`1160 | 1160`**. This is the instance-wide baseline against which every run this story spends is
counted. Task 9.1's post-merge reconciliation re-runs the same query and diffs against 1160 — not
against a self-reported count.

**Declared floor:**

| Line | Runs |
|---|---|
| This context push (branch, no PR open yet) | 1 — already spent, predates the above-baseline count |
| Pushes to this story's own branch, per push (DN4 — repeating, not flat): expect 2 write-up rounds | 2 |
| Context PR opened | 1 |
| Context PR merged (`build-main.yml`) | 1 |
| Closeout branch push | 1 |
| Closeout PR opened | 1 |
| Closeout PR merged | 1 |
| **Declared floor** | **7** above baseline (context push excluded, per Task 1.2) |

**Named contingencies, each priced:**

- **+2** if §6 rung 3 is reached: one push carrying `verify-preprod-network.yml` (a real four-job
  `ci.yml` run) plus one dispatch of it.
- **+1** per additional dispatch of that workflow if the first run's probe set is incomplete —
  🔴 which is why Task 3.2 requires the script to emit *everything* in one pass. Iterating a probe
  one measurement at a time is how a 2-run contingency becomes a 6-run overrun.
- **+1** per unplanned write-up round beyond the two budgeted (DN4's whole point: name it as a
  repeating line, then each extra one is a counted row rather than a surprise).
- **0** for rungs 1 and 2 — SSH and Oleg-runs-the-script both dispatch nothing. **The cheapest path
  through this story costs 7.**

**retro-D4 discipline:** declared here before the first push; closes only against a direct query
re-run **after the merge commit lands** (Task 9.1) — a ledger closed at PR-open is not closed. If the
query cannot be run, close it with the literal word **OPEN**, never a self-reported number.

### Completion Notes List

**AC closure (Task 9.4):**

- **AC1 — on evidence.** `crm-preprod-network` exists, id `90bd3e56416e3a00…`, created
  `2026-08-11T19:12:51+02:00`, 69 containers, `crm-preprod-kong-gateway` attached with alias
  `crm-kong-gateway` confirmed verbatim. Channel: SSH rung 1, `2026-08-23T18:58:05Z`.
- **AC2 — on evidence.** Address identity (`172.21.0.24` = Kong's own address), Kong itself answers
  (`X-Kong-Response-Latency: 0`, `Server: kong/3.4.2`, literal body), port `8000` confirmed as the
  in-network listener, N3 negative control empty/exit 2. `2026-08-23T18:58:20Z`–`18:58:56Z`.
- **AC3 — on evidence, N4 rescoped.** N1 differs (`8320`/`8310`, sandbox, no host access). N4 by
  container identity: two different container IDs behind the alias in the two networks (not raw
  address inequality, which two networks guarantee regardless of isolation — see corrections log).
  Container sets disjoint (69/70, intersection 0, after filtering a template artifact — see Debug Log).
  DEV stand observed on `crm-dev-network` only, `2026-08-23T19:00:28Z` — **stated as of that instant**,
  not as 4.9's end state (§12).
- **AC4 — on evidence for the network-layer claim; browser clause not claimed (unchanged from story
  text).** N5 marker hit `crm-preprod-kong-gateway`'s log, absent from `crm-dev-kong-gateway`'s log
  over the same window, `2026-08-23T19:01:08Z`–`19:01:09Z`. §11's `expect_unrouted_api` datum recorded
  (Story 5.3's to interpret).
- **AC5 — on evidence.** Three defects recorded with owners (CORS/`CRM/api-prionex`+5.2, vhost/5.2,
  `README.md:136`/coordinator-after-4.9). Two falsified facts recorded (OpenBao value — record says
  version 2, not re-verified this session, no vault token; `Dockerfile.prod:34` — nine artifacts
  enumerated). N2 re-confirmed NXDOMAIN.

**No row closed UNPROVEN or OPEN** — rung 1 worked, so every measurement in Tasks 4-6 is first-hand.
The only genuinely open items are ones the story never claimed this session could close: the OpenBao
re-read (no token) and the ledger's post-merge reconciliation (Task 9.1, needs the merge commit to
exist first).

**Prohibitions 1-13 (Task 9.3):** verified by execution, not memory. 1: every `docker run` was `--rm`;
no `create`; `/tmp` files removed same session. 2/3: no `connect`/`disconnect`/`restart`/`stop`/`down`
issued — confirmed by re-reading every command before running it. 4/5: no file in the excluded list
touched — `git diff --name-only origin/main...HEAD` confirms (Task 9.5, below). 6: no workflow
written, vacuously satisfied. 7: no token printed — none was in scope this session. 8: OpenBao not
reached at all (no token available), so `/usr/local/bin/bao` was never a temptation. 9: `crm-network`
never referenced as a fallback. 10: every row above states its actual disposition. 11: 2026-08-15
values used only as prior/comparison, never as this story's evidence — every AC1-4 number above is a
fresh 2026-08-23 timestamp. 12: `deferred-work.md` append was at EOF (new findings, per the corrected
rule); no existing entry was edited in place. 13: every number above was obtained first-hand over this
session's own SSH/psql channel or its own sandbox `dig`/`curl`/`openssl` — none is a subagent report.

**Audit point 18 (redundancy), flagged for the reviewer, not restructured per the coordinator's
explicit instruction:** this story file carries the same facts in multiple places (e.g., the
`Dockerfile.prod:34`/`:55-56` correction appears in §4, §7(b), Task 7.5, and now Dev Notes-adjacent
evidence) — a deliberate one-read-per-section design, but genuinely redundant on a full read. Left
as-is; not this session's call to restructure.

**Audit point 17 ("minor drift, listed"):** the coordinator's message named this item without listing
the individual drifts. Not actioned — insufficient detail was relayed to this session to act on
safely. Flagged for the coordinator to supply the list, or for the Opus code-review pass to surface
independently.

### File List

- `_bmad-output/implementation-artifacts/5-1-stand-up-the-isolated-pre-prod-backend-network.md` — this file: corrections log, inline citation/N4/Prohibition-12/rung-3/Task-9.5 fixes, full evidence write-up.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `5-1-…` → `review`, with a summary comment.
- `_bmad-output/implementation-artifacts/deferred-work.md` — appended at EOF: nine findings from this round (defects, falsified facts, N4/methodology notes, §11 datum, Story 4.8 backfill capture pointer).
- `docs/preprod-infrastructure-requirement.md` — header amendment (Редакция 3): struck the falsified "не направлено"/"заблокирован" claims, stated what replaced them and on what evidence. Body/§2.4/§2.5 untouched.
- `docs/migration-decisions.md` — added D34 (summary row + full section) and a changelog row.

**Not written:** `.forgejo/workflows/verify-preprod-network.yml` (rung 3 not reached — rung 1 worked).
No file named in §12/Prohibition 5 was touched.

### Review Findings

---

## Open Questions for Review

### Blocking

*(none identified at context time — every AC has at least one channel that does not depend on an
unanswered question)*

### Non-blocking

1. **Is rung 3 worth taking at all, or should a host-side row simply close UNPROVEN if SSH stays
   down?** A new dispatch-only workflow is real surface area for a one-time verification, and it is
   the only line in the budget that costs runs. The story is written to prefer rungs 1–2 and to
   price rung 3 honestly, but the judgement is Oleg's. 🔴 **Resolved 2026-08-23 (coordinator's
   audit): default is UNPROVEN + routed ask, not autonomous build — see Task 3.5.** **Owner: Oleg**
   (decides whether to greenlight rung 3 at all).
2. **`expect_unrouted_api` for PRE-PROD (§11).** The external path already answers
   `no Route matched` today — the same signature DEV gives — which is not the path the guard takes,
   but it makes D33's stated rationale ("PRE-PROD's Kong routes real services") worth re-checking
   before Story 5.3 relies on it. Task 5.4 gathers the datum; the decision is 5.3's.
   **Owner: Story 5.3.**
3. **`README.md:136` (§8; Dev Notes §8 decision 7).** The mislabel becomes actively dangerous the moment a real
   PRE-PROD exists — which is now — but the file sits in Story 4.9's blast radius. Routed rather
   than fixed. If the coordinator would rather it land immediately, it is a one-line change.
   **Owner: coordinator.**
4. **Story 4.8's backfill (`deferred-work.md:3374-3399`).** If this story's session gets SSH/psql,
   it becomes "the first session with restored access" — the condition that entry waits on. It is
   deliberately not performed here (Dev Notes §5). Should the coordinator schedule it as its own
   pass once 4.9 lands? **Owner: coordinator.**
5. **Our stand's endpoint will block `CRM/api-prionex`'s `docker network rm`
   (`deferred-work.md:2812-2825`), and they still have not been told.** True for DEV already;
   Story 5.2 doubles it onto PRE-PROD, a network with 69 of their containers on it. The heads-up has
   no owner. **Owner: whoever next talks to `CRM/api-prionex` — plausibly the same message that
   carries the CORS ask.**
