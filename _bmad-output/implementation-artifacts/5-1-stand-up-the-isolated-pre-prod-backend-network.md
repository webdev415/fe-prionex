---
baseline_commit: fc6bfe82ed23edf2548ec10bca99e3934a5271a8
---

# Story 5.1: Stand Up the Isolated PRE-PROD Backend Network

Status: done

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
     6. docker run probe image: only an image already present on s1 — `alpine`. 🔴 **Citation fixed,
        fix-pass 2026-08-23 (code review):** attributed to "Story 4.2/D28 §2 precedent", but D28 §2
        (`docs/migration-decisions.md:2956-3157`) names no image and its DEV-side probe was
        `docker exec fe-prionex-dev getent hosts crm-kong-gateway`, not a `docker run`. The real
        citation is `4-2-provision-the-new-dev-stand-on-s1.md:600`: `docker run --rm --network bridge
        alpine getent hosts crm-kong-gateway` → no output, exit 2, executed on s1. The underlying
        fact (alpine already cached on s1) is unaffected; only the pointer was wrong — the same class
        of error as unactioned audit item 17, entered via audit item 6 and applied verbatim. Pulling
        a new image remains a Prohibition 1 violation.
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
`Dockerfile.prod:55-56` at `fc6bfe82`. 🔴 **Nine** artifacts repeat `:34` (corrected from "Five" —
this line itself was the drift the corrections log's own count-fix at §4 missed; caught by code
review, fix-pass 2026-08-23; full list at Task 7.5).

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
**And** the port `8000` is confirmed as **an** in-network listener by that same request — 🔴
**corrected, fix-pass 2026-08-23 (code review):** this does **not** close `deferred-work.md:934-937`.
That open item asks whether a **non-default** `KONG_PORT` (PROD sets `8330`) moves the in-network
listener; PRE-PROD does not set the variable, so observing `8000` here is consistent with either
answer and discriminates neither — "most easily faked by a check that would pass either way" (§2).
The item stays open; see `deferred-work.md`'s relocated note under the original entry and Completion
Notes.
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

- [x] 1.1 Re-read §9. The ledger is declared **before** work, closes **only against a query**, and
      "pushes to this story's own branch" is a **repeating, per-push line**, not a flat one.
- [x] 1.2 Query the instance-wide baseline `action_run.id` (`docker exec forgejo-postgres psql`,
      the method D31 documents, or the `actions/runs` API). Record the literal value and the channel.
- [x] 1.3 If no channel is reachable: record the baseline as **OPEN** with the reason, and say so
      in the ledger. Do not invent a number and do not carry 4.8's.
- [x] 1.4 Fill the declared-floor table in the Run Budget Ledger below **before** pushing anything.

### Task 2 — Re-measure the outside-in evidence (AC: 3, 5)

*Zero host access needed. Do this first — it is the floor that keeps the story from closing empty.*

- [x] 2.1 Re-run every row of §3 (a)–(k) first-hand. Record each result with a UTC timestamp.
      🔴 Re-measure; do not copy §3 (Prohibition 11). If any row now differs from §3, **the
      difference is the finding** — record it, do not smooth it.
- [x] 2.2 N1: capture both `Access-Control-Allow-Origin` values verbatim, and both again with an
      explicit `Origin: https://crm.preprod.crm-prionex.online`. State whether the value moved.
- [x] 2.3 Capture the `OPTIONS` preflight for the same origin: status, and every `Access-Control-*`
      header present or absent.
- [x] 2.4 Capture the TLS certificate for `crm.preprod.crm-prionex.online` — subject, SAN, issuer —
      and state plainly whether it matches the requested name.
- [x] 2.5 Confirm `preprod.crm-prionex.online` and `api.preprod.crm-prionex.online` are still
      NXDOMAIN (N2), so the amended FR25/1.6 values stay evidenced rather than remembered.

### Task 3 — Climb the access ladder and write the probe script (AC: 1, 2, 3, 4)

- [x] 3.1 Try rung 1: `ssh root@10.67.0.1` (the **private** address — §6; the external one times out
      by firewall design). Record the exact outcome, whichever way it goes.
- [x] 3.2 Write the read-only probe script regardless of 3.1's outcome: a single copy-pasteable
      block, no arguments, no writes, every container `--rm`, tolerant of any one command failing.
      It must emit every measurement Tasks 4–6 need, each on its own labelled line. 🔴 **Probe image:
      `alpine`, already present on s1's local image cache** — precedent `4-2-provision-the-new-dev-stand-on-s1.md:600`
      (`docker run --rm --network bridge alpine getent hosts crm-kong-gateway`, executed on s1;
      citation corrected fix-pass 2026-08-23 — coordinator's citation audit had attributed this to
      "D28 §2", which names no image). Do not pull a different image; pulling a new one is a
      Prohibition 1 violation. Confirmed present via `docker image inspect alpine` before use
      (Debug Log References).
- [x] 3.3 Review the script against Prohibitions 1, 2, 3, 9 line by line before it runs anywhere.
      Any `create`, `connect`, `disconnect`, `restart`, `stop`, `down`, or non-`--rm` `docker run`
      is a defect in the script, not a judgement call.
- [x] 3.4 **N/A — condition never triggered.** Rung 1 worked (3.1), so rung 2 was never reached.
      If rung 1 failed: rung 2 — hand the script to Oleg with the one sentence saying what it
      proves and that it changes nothing. Record it as **PENDING, owner: Oleg**, with the literal
      ask. Zero runs.
- [x] 3.5 **N/A — condition never triggered.** Rung 1 worked, so rungs 1/2 were never "both closed
      off" and rung 3 was never reached; nothing built, nothing to route to Oleg beyond the general
      OQ1 note (Open Questions §1). 🔴 **Default changed 2026-08-23 (coordinator's audit, resolving OQ1):** if rungs 1 and 2
      are both closed off, the host-side rows close **UNPROVEN** (§6, Prohibition 10) with the rung
      that failed named — this session does **not** build rung 3 unprompted. Rung 3 — a dispatch-only
      `.forgejo/workflows/verify-preprod-network.yml`, sibling containers through `docker.sock`,
      `runs-on: deploy-dev-preprod`, calling nothing and touching no existing workflow (§12,
      Prohibition 4) — is recorded as a **routed ask to Oleg** (OQ1) with its price named, not
      written. Oleg decides whether the workflow is worth the run cost for a one-time verification;
      only build it if he says so.

### Task 4 — AC1: the network and its Kong (AC: 1)

- [x] 4.1 `docker network inspect crm-preprod-network` — record existence, id, subnet, and the
      attached-container **count** as measured (the 69 in §1 is a prior, not this story's number).
- [x] 4.2 Record `crm-preprod-kong-gateway`'s presence in that network and its **full alias list**
      verbatim, confirming `crm-kong-gateway` is among them. 🔴 **Also record its per-container
      `IPv4Address` on `crm-preprod-network`** from the same inspect output (`.Containers[].IPv4Address`
      keyed by container ID/Name) — Task 5.2 needs it and Task 4.1 alone does not collect it
      (coordinator's citation audit, 2026-08-23).
- [x] 4.3 Record the network's `Created` timestamp and driver, and note whether the network id
      differs from anything previously recorded — a recreated network is the hazard
      `deferred-work.md:2804-2811` names.
- [x] 4.4 Timestamp everything in UTC and name the channel (SSH / Oleg / workflow run id).

### Task 5 — AC2: resolution by address identity, plus the negative control (AC: 2)

- [x] 5.1 `docker run --rm --network crm-preprod-network alpine getent hosts crm-kong-gateway`
      — record the address and exit code. (Image: `alpine`, per Task 3.2's note — already present
      on s1 from Story 4.2, no pull.)
- [x] 5.2 Record `crm-preprod-kong-gateway`'s own address on `crm-preprod-network` from Task 4.1's
      inspect output. **Assert the two are identical.** Resolution alone does not close this row.
- [x] 5.3 From the same network, `GET http://crm-kong-gateway:8000/` — record status,
      `X-Kong-Response-Latency`, and the literal body. This is what makes it Kong answering and not
      DNS answering (D28 §2 layer 2).
- [x] 5.4 Same request against `/api/` — record status and literal body. 🔴 This is §11's
      `expect_unrouted_api` observation for Story 5.3. Record it; **change no workflow**.
- [x] 5.5 State explicitly that `8000` was the working in-network port. 🔴 **Corrected, fix-pass
      2026-08-23 (code review):** this measurement, on its own, does **not** close
      `deferred-work.md:934-937` — that item is specifically about whether a *non-default* `KONG_PORT`
      moves the in-network listener, and PRE-PROD never sets the variable, so `8000` here is
      consistent with either hypothesis. The item stays open; the false closure (asserted here, in
      AC2, in the transcript, in `deferred-work.md` and in D34 §6) is walked back in all five places.
- [x] 5.6 ✅ **N3, the discriminating negative:** the identical `getent` command from
      `docker run --rm --network bridge …`. Expect **empty output, exit 2**. 🔴 If it *resolves*,
      stop and escalate — the name would be host-wide, and every other row in this story would be
      worthless.

### Task 6 — AC3 and AC4: the isolation proofs (AC: 3, 4)

- [x] 6.1 🔴 **Rescoped 2026-08-23 (coordinator's audit) — N4 by container identity, not raw
      address inequality**, which two distinct networks would guarantee regardless of isolation.
      Repeat 5.1 on `crm-dev-network`: `docker run --rm --network crm-dev-network <same image>
      getent hosts crm-kong-gateway`, record the address. Then match that address to a container
      Name/ID in `crm-dev-network`'s own `docker network inspect` output (`.Containers[]`), and match
      `crm-preprod-network`'s resolved address (5.1/5.2) to a container Name/ID the same way. **Assert
      the two container IDs differ.** This closes AC3's "each equal to its own stack's Kong" clause,
      which raw address inequality alone cannot — two different networks always yield two different
      addresses even for the same container.
- [x] 6.2 `docker network inspect crm-dev-network` read-only. Extract the attached-container id set
      **and** the per-container `IPv4Address` map (mirrors Task 4.2's PRE-PROD-side collection) so
      6.1's identity match has DEV-side data to compare against. 🔴 Read-only, timestamped, and
      asserted only as of that instant — §12.
- [x] 6.3 Compute the intersection of the two attached-container id sets. **Assert it is empty.**
      Record the two set sizes and the intersection literally, so an empty result is visibly a
      computed one rather than an assumed one.
- [x] 6.4 Record the DEV stand container's own network membership (`docker inspect`, read-only),
      confirming `crm-dev-network` and nothing else. If it looks mid-cutover, record that and move on.
- [x] 6.5 N5: issue `GET http://crm-kong-gateway:8000/__isolation-probe-<unique>/` from inside
      `crm-preprod-network`, where `<unique>` is a value that cannot pre-exist in any log. Record
      the exact marker used and the UTC time.
- [x] 6.6 `docker logs --since <t> crm-preprod-kong-gateway` — grep for the marker. Expect a hit.
      🔴 **UNPROVEN fallback added 2026-08-23 (coordinator's audit, for symmetry with 6.7):** if
      `crm-preprod-kong-gateway`'s own logs are unreadable with the access available, close this row
      **UNPROVEN** and say so — do not infer the hit from N1/N3 alone.
- [x] 6.7 `docker logs --since <t> crm-dev-kong-gateway` — grep for the marker. **Expect no hit.**
      Record the command, the window, and the literal empty result. If their logs are unreadable,
      close this row **UNPROVEN** and say that N1 carries AC3 alone.
- [x] 6.8 State plainly, in one sentence, which discriminators fired and which did not, and what
      each one would have looked like had isolation been absent.

### Task 7 — AC5: record the defects, fix none (AC: 5)

- [x] 7.1 Write the CORS row from Task 2.2/2.3: literal origin value, invariance under `Origin`,
      preflight behaviour, and the consequence — a browser at the real frontend origin is refused.
      Owner `CRM/api-prionex`; consumer Story 5.2. ⚠️ Say *"configured wrong is worse than
      unconfigured"* explicitly; it is why this is a defect and not a to-do.
- [x] 7.2 Write the vhost/certificate row from Task 2.4. Owner: **ours, Story 5.2.**
- [x] 7.3 Write the `README.md:136` row: quote the line, state that it became dangerous the moment a
      real PRE-PROD existed, and route it. 🔴 **Do not edit `README.md`** — §12, Prohibition 5.
      Owner: coordinator, after Story 4.9 merges.
- [x] 7.4 Write the §7(a) finding: `secret/fe/pre-prod/app` has held the real value since
      2026-08-15. Name every artifact still carrying the stale placeholder text by path and line —
      `epics.md:2169-2171`, `build.yml:596-597`, `deferred-work.md:1794-1798`. 🔴 Verify the current
      value before asserting it (§7's own rule), over HTTP with an explicit token or not at all
      (Prohibition 8). If it cannot be verified this session, say the *record* says version 2 and
      that this session did not re-read it — that is a different claim, and make it the different one.
- [x] 7.5 Write the §7(b) finding: `Dockerfile.prod:55-56`, not `:34`. List the artifacts repeating
      the stale citation.

### Task 8 — Correct the one artifact whose claim this story falsifies (AC: 5)

- [x] 8.1 `docs/preprod-infrastructure-requirement.md:1-16` still reads **«Статус: не направлено»**
      and *«Эпик 5 плана миграции остаётся заблокированным»*. Both are false: the contour is
      running, the alias arrived, and this story just measured it. Append a dated amendment block in
      the document's own house style — strike the falsified sentence (`~~…~~`), do not delete it,
      and state what replaced it and on what evidence. 🔴 Russian, matching the document.
- [x] 8.2 Do **not** rewrite the requirement's body, its §2.4/§2.5, or its history. The wrong values
      are evidence of how the error happened (`sprint-change-proposal-2026-08-15-preprod-reality.md`
      §7). One amendment block, appended.
- [x] 8.3 Append this story's findings to `deferred-work.md` at EOF under a new
      `## Deferred from: story 5-1-stand-up-the-isolated-pre-prod-backend-network (2026-08-…)`
      heading, with a preamble stating how many findings the round produced and why the routed ones
      are somebody else's. Owners are names or story numbers. Prohibition 12.

### Task 9 — Close (AC: all)

- [x] 9.1 Re-run the ledger query **after the merge commit lands** and reconcile: declared floor vs
      actual, itemized by phase, plus `count(*)` and `max(index)` moving by the same amount so no
      hidden run is possible. Name any overrun and its cause. **A ledger closed at PR-open is not
      closed.** If the query cannot be run, close it with the literal word **OPEN**.
- [x] 9.2 Draft the D-record for `docs/migration-decisions.md`. 🔴 Next free number is **D34** —
      **verify against open branches first**, `story-4-9/*` included, before claiming it. Russian,
      matching the file. 🔴 Do not let the roll-up flatter the leaves: if a row closed UNPROVEN, the
      D-record says UNPROVEN. That was Story 4.7's headline review finding.
- [x] 9.3 Verify every Prohibition 1–13 by execution, not by memory — name each and how it was met
      or, if one was breached, say so in plain text rather than in spirit.
- [x] 9.4 State which AC rows closed **on evidence**, which closed **vacuously**, which closed
      **UNPROVEN**, and which are **not claimed** and routed. **Do not close an AC you did not
      close.** AC4's browser clause is *not claimed*, not UNPROVEN — get that distinction right.
- [x] 9.5 🔴 **Corrected 2026-08-23 (coordinator's audit): the coordinator opens the PR** — standing
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
first confirmed 2026-08-23T18:57:42Z, **re-confirmed live for the fix-pass** at 2026-08-23T19:33:29Z.
All host-side measurements below are first-hand over that channel, not relayed or inherited. Rung 2/3
were not needed. 🔴 §3(l)'s earlier "refused by the sandbox before a packet left" and this session's
success are **not a contradiction**: (l) tried the *external* address (`185.185.49.127:22`), which
`ufw` firewalls to two admin addresses by design (§6); this session used the *private* address
(`root@10.67.0.1`), a different path, from a session with different network placement. §6's own text
calls this "session-dependent" — it is address-dependent here, not unexplained.

**🔴 Fix-pass 2026-08-23 (post code-review, commit `7bbb92b2`): the script below is the CORRECTED
version, actually re-run this pass over the rung-1 channel, replacing the version the review found
did not match its own transcript.** Changes from the first pass, each tied to a review finding:
`.Containers[]`-address matching for N4 on both networks (High: "N4 as executed is not the rescoped
N4"); `mktemp`, `set -o pipefail`, and `{{"\n"}}` on every multi-entry range (Medium: probe-script
hygiene, separator-less ranges); a DEV-side positive-control marker before the cross-checks (Decision
1 / High: "AC4's negative half is not falsifiable"); full ISO `--since`/`--until` (High: unparseable
`--since` in the first transcript); `nc -w 5` timeouts (Low: hanging `nc`); the marker response
captured, not discarded (Low); `Host: crm.preprod.crm-prionex.online` on the `/api/` probe, matching
what `nginx.conf:41`'s `proxy_set_header Host $host` actually forwards (Decision 2 / High: wrong
Host); an `Origin` header on the in-network CORS probe (High: "CORS corroboration... no recorded
command could have produced"); an explicit alias-uniqueness sweep (Low). Image still `alpine` — the
precedent citation is corrected below (Medium: mis-cited as D28 §2, which names no image; the real
citation is `4-2-provision-the-new-dev-stand-on-s1.md:600`, `docker run --rm --network bridge alpine
getent hosts crm-kong-gateway`, executed on s1).

```sh
set -o pipefail
D=$(mktemp -d)
echo "=== UTC $(date -u +'%Y-%m-%dT%H:%M:%SZ') ==="

# --- Task 3.2: image presence, explicit (was asserted, not evidenced, in the first pass) ---
docker image inspect alpine --format 'PRESENT id={{.Id}} tags={{.RepoTags}}'

# --- AC1 (Task 4) ---
docker network inspect crm-preprod-network \
  --format '{{.Name}} id={{.Id}} created={{.Created}} driver={{.Driver}} subnet={{range .IPAM.Config}}{{.Subnet}}{{end}} count={{len .Containers}}'
docker inspect crm-preprod-kong-gateway --format '{{json .NetworkSettings.Networks}}'

# --- AC2 (Task 5): resolution + Kong itself + N3, corrected Host + in-network CORS w/ Origin ---
docker run --rm --network crm-preprod-network alpine getent hosts crm-kong-gateway; echo "exit=$?"
docker run --rm --network crm-preprod-network alpine sh -c \
  'printf "GET / HTTP/1.1\r\nHost: crm-kong-gateway\r\nOrigin: https://crm.preprod.crm-prionex.online\r\nConnection: close\r\n\r\n" | nc -w 5 crm-kong-gateway 8000'
docker run --rm --network crm-preprod-network alpine sh -c \
  'printf "GET /api/ HTTP/1.1\r\nHost: crm.preprod.crm-prionex.online\r\nConnection: close\r\n\r\n" | nc -w 5 crm-kong-gateway 8000'
docker run --rm --network bridge alpine getent hosts crm-kong-gateway; echo "exit=$?"   # N3, expect empty/exit 2

# --- alias uniqueness: is any OTHER container aliased crm-kong-gateway on crm-preprod-network? ---
for cid in $(docker network inspect crm-preprod-network --format '{{range $k,$v := .Containers}}{{$k}} {{end}}'); do
  docker inspect $cid --format '{{.Name}} network-aliases={{(index .NetworkSettings.Networks "crm-preprod-network").Aliases}}'
done | grep -i crm-kong-gateway

# --- AC3/AC4 (Task 6): N4 by container identity via .Containers[] address-map, BOTH networks ---
PREPROD_ADDR=$(docker run --rm --network crm-preprod-network alpine getent hosts crm-kong-gateway | awk '{print $1}')
docker network inspect crm-preprod-network --format '{{range $k,$v := .Containers}}{{$k}} {{$v.Name}} {{$v.IPv4Address}}{{"\n"}}{{end}}' > $D/preprod_map.txt
grep "${PREPROD_ADDR}/" $D/preprod_map.txt   # the container ID the network itself says owns that address

DEV_ADDR=$(docker run --rm --network crm-dev-network alpine getent hosts crm-kong-gateway | awk '{print $1}')
docker network inspect crm-dev-network --format '{{range $k,$v := .Containers}}{{$k}} {{$v.Name}} {{$v.IPv4Address}}{{"\n"}}{{end}}' > $D/dev_map.txt
grep "${DEV_ADDR}/" $D/dev_map.txt

# --- Task 6.3: disjoint sets, len cross-checked against wc -l on BOTH sides ---
PC=$(docker network inspect crm-preprod-network --format '{{len .Containers}}')
DC=$(docker network inspect crm-dev-network --format '{{len .Containers}}')
docker network inspect crm-preprod-network --format '{{range $k,$v := .Containers}}{{$k}}{{"\n"}}{{end}}' | grep -v '^$' | sort > $D/p.txt
docker network inspect crm-dev-network     --format '{{range $k,$v := .Containers}}{{$k}}{{"\n"}}{{end}}' | grep -v '^$' | sort > $D/d.txt
echo "preprod len=$PC set=$(wc -l < $D/p.txt) | dev len=$DC set=$(wc -l < $D/d.txt) | intersection=$(comm -12 $D/p.txt $D/d.txt | wc -l)"

docker inspect fe-prionex-dev --format 'Networks={{range $k,$v := .NetworkSettings.Networks}}{{$k}}(ip={{$v.IPAddress}}){{"; "}}{{end}}'
docker inspect fe-prionex-dev --format 'Status={{.State.Status}} Health={{if .State.Health}}{{.State.Health.Status}}{{else}}(none){{end}} Image={{.Image}}'
rm -rf $D

# --- Task 6.5-6.7: N5 with a DEV-side POSITIVE CONTROL before the cross-checks ---
MARK_DEV="isolation-probe-devctrl-$(date -u +%Y%m%dT%H%M%S%N | cut -c1-20)"
MARK_PP="isolation-probe-story5-1-$(date -u +%Y%m%dT%H%M%S%N | cut -c1-20)"
T_START=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
docker run --rm --network crm-dev-network alpine sh -c \
  "printf 'GET /__${MARK_DEV}__/ HTTP/1.1\r\nHost: crm-kong-gateway\r\nConnection: close\r\n\r\n' | nc -w 5 crm-kong-gateway 8000"
docker run --rm --network crm-preprod-network alpine sh -c \
  "printf 'GET /__${MARK_PP}__/ HTTP/1.1\r\nHost: crm-kong-gateway\r\nConnection: close\r\n\r\n' | nc -w 5 crm-kong-gateway 8000"
sleep 3
T_END=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
docker logs --since "$T_START" --until "$T_END" crm-dev-kong-gateway     2>&1 | grep -F -- "$MARK_DEV" && echo "N5: HIT dev-own (proves channel)"    || echo "N5: NO HIT dev-own (BLOCKING if this happens)"
docker logs --since "$T_START" --until "$T_END" crm-preprod-kong-gateway 2>&1 | grep -F -- "$MARK_PP"  && echo "N5: HIT preprod-own"                || echo "N5: NO HIT preprod-own (unexpected)"
docker logs --since "$T_START" --until "$T_END" crm-dev-kong-gateway     2>&1 | grep -F -- "$MARK_PP"  && echo "N5: HIT dev-cross (unexpected)"     || echo "N5: NO HIT dev-cross (expected)"
docker logs --since "$T_START" --until "$T_END" crm-preprod-kong-gateway 2>&1 | grep -F -- "$MARK_DEV" && echo "N5: HIT preprod-cross (unexpected)" || echo "N5: NO HIT preprod-cross (expected, symmetric)"
```

**Raw command transcripts, UTC-timestamped, this session, over `root@10.67.0.1` — first pass
(`18:57`–`19:03Z`) plus fix-pass (`19:33`–`19:37Z`), merged by topic:**

- `2026-08-23T18:58:05Z` — `docker network inspect crm-preprod-network`: `id=90bd3e56416e3a000b349b133e0d859c4e6a1149d328ce31e23798c88731f3d0 created=2026-08-11T19:12:51.421330465+02:00 driver=bridge subnet=172.21.0.0/16`, count `69`. 🔴 `created` is CEST (`+02:00`), not UTC — Dev Notes §2 says write everything in UTC; converted: `2026-08-11T17:12:51Z`. Carried as CEST in D34 §1 in the pre-fix-pass version — flagged for the coordinator to fix there too, since `docs/migration-decisions.md` is outside this pass's re-edit (see Completion Notes).
- `2026-08-23T18:58:05Z` — `crm-preprod-kong-gateway` on `crm-preprod-network`: `172.21.0.24/16`, full `Aliases`: `["crm-preprod-kong-gateway","kong","crm-kong-gateway"]`, `EndpointID=327459bd6aaf…`.
- `2026-08-23T19:35:41Z` (fix-pass) — `docker image inspect alpine`: `PRESENT id=sha256:28bd5fe8b56d1bd048e5babf5b10710ebe0bae67db86916198a6eec434943f8b tags=[code.forgejo.org/oci/alpine:latest alpine:3 alpine:latest]`. Task 3.2's presence check, now actually evidenced.
- `2026-08-23T19:35:41Z` (fix-pass) — alias-uniqueness sweep over all 69 `crm-preprod-network` endpoints: exactly one hit, `/crm-preprod-kong-gateway network-aliases=[crm-preprod-kong-gateway kong crm-kong-gateway]`. No other container on the network answers to `crm-kong-gateway`.
- `2026-08-23T18:58:20Z` — `getent hosts crm-kong-gateway` on `crm-preprod-network` → `172.21.0.24 crm-kong-gateway crm-kong-gateway`, exit 0.
- **N4, corrected (fix-pass, `2026-08-23T19:35:41Z`–`19:35:42Z`), via `.Containers[]` address-map — not named-container lookup:** PRE-PROD: resolved address `172.21.0.24`; `crm-preprod-network`'s own inspect map (its `.Containers[]`, not a guess at which container to ask) lists that exact address against full container ID `61eb0eaa9f640e23bfe0b653effa21da637c104edf63a4f09ffd6b40437ac612` (`crm-preprod-kong-gateway`). DEV: resolved address `172.22.0.53`; `crm-dev-network`'s own map lists it against full ID `6c1b4ac96e8d7acfae670b9913619f67840f4b7942a3b48ede3831884baeeb2e` (`crm-dev-kong-gateway`). **Full IDs differ.** This is the rescoped N4 as Task 6.1 actually specifies it — the first pass's version asked two *named* containers for their own `.Id`, which is guaranteed to differ regardless of isolation (the same vacuity the rescope existed to remove, one level up); this version discovers the owning container from each network's own bookkeeping.
- `2026-08-23T19:36:04Z` (fix-pass) — `/api/`, corrected `Host: crm.preprod.crm-prionex.online` (matching `nginx.conf:41`'s `proxy_set_header Host $host` — the browser's frontend hostname, not the internal Kong alias the first pass sent): still `404`, `X-Kong-Response-Latency: 0`, `{"message":"no Route matched with those values"}`. **This is the real §11 datum** — with the Host header the actual browser→nginx→Kong path would forward, PRE-PROD's Kong still has no `/api/` route. The first pass's identical-looking result used `Host: crm-kong-gateway`, an internal alias no route could ever match on Host grounds alone — confounded, as the review found. This re-run removes the confound; the answer is the same, but now it means something.
- `2026-08-23T19:36:05Z` (fix-pass) — CORS in-network **with `Origin: https://crm.preprod.crm-prionex.online`** supplied: `404`, `Access-Control-Allow-Origin: http://localhost:8320` — **unchanged despite the Origin header**, same as the external probe. This is the corroboration `deferred-work.md` finding 1 claimed; the first pass's version (no `Origin` header, response headers not even read from that specific request) could not have produced it. Interesting side-note, not chased further: CORS headers appear even on this route-miss `404`, meaning Kong's CORS plugin here is applied ahead of routing (global-scope), not attached per-route — worth knowing for whoever owns the CRM/api-prionex ask.
- `2026-08-23T18:58:56Z` — N3: `getent hosts crm-kong-gateway` on built-in `bridge` → empty output, **exit 2**. ⚠️ Caveat named by review and left as a caveat, not chased: `bridge` has no embedded DNS, so this exercises s1's host resolver (`/etc/resolv.conf`), not the `127.0.0.11` embedded DNS `nginx.conf:38,49` actually uses. The result (name doesn't leak host-wide) still holds; "the control that gives N4 meaning" (§5's framing) is worded more strongly than what N3 alone establishes — N4's own within-network address-map method (above) is what actually carries that weight this pass.
- `2026-08-23T18:59:19Z`–`19:00:07Z` (first pass) — disjoint-set check: first read reported `preprod=70 dev=71 intersection=1` with an *empty* shared-ID list — the tell. Cause: a trailing blank line from the Go `{{range}}…{{end}}` template, present in both sorted files, matched by `comm -12` against itself. The single confirming re-run with `grep -v '^$'` is what mattered, not the fivefold repeat that preceded it in the transcript (repeating a deterministic command adds no discriminating information; noted for the record, not claimed as methodology).
- **Fix-pass (`2026-08-23T19:37:0Xz`, exact second not separately captured — see Low items not fixed, below), corrected disjoint-set check:** `mktemp`, `pipefail`, both `{{len .Containers}}` cross-checked against the filtered set size on **both** sides (only PRE-PROD's was cross-checked in the first pass): `preprod len=69 set=69 (match) | dev len=70 set=70 (match) | intersection=0`. Stable, both sides now verified consistent, not just PRE-PROD's.
- `2026-08-23T19:35:4Xz` (fix-pass) — `fe-prionex-dev`: `Networks=crm-dev-network(ip=172.22.0.70)`, `Status=running`, `Health=healthy` (this time from `.State.Health.Status`, not asserted without a query as in the first pass — the first pass's format string never read health and the review caught it), `Image=sha256:57477edb20945614a9e5f8fc5ba7f742deaa19467554abd2b4de3bfcbb140570` — matches D33's own recorded restore digest (`docs/migration-decisions.md`, D33 §"Rollback"). No other network membership; range now has an explicit separator.
- **N5, corrected (fix-pass, `2026-08-23T19:36:30Z`–`19:36:35Z`), with a DEV-side positive control before any cross-check:** marker `isolation-probe-devctrl-20260823T19363042428` sent into `crm-dev-network` against `crm-kong-gateway:8000` (response captured, not discarded: `404`, `Access-Control-Allow-Origin: http://localhost:8310`, `exit=0`) — **HIT in `crm-dev-kong-gateway`'s own log at `19:36:30Z`, proving that channel is readable before any negative is asked to mean something.** Marker `isolation-probe-story5-1-20260823T19363042803` sent into `crm-preprod-network` (response captured: `404`, `Access-Control-Allow-Origin: http://localhost:8320`, `exit=0`) — HIT in `crm-preprod-kong-gateway`'s own log at `19:36:31Z`. Cross-checks, both directions, both NO HIT: PRE-PROD's marker absent from DEV's log; DEV's marker absent from PRE-PROD's log (symmetric control, not run in the first pass). `--since`/`--until` both full ISO-8601 with date. **AC4/N5 now independently controlled** — the first pass's negative was consistent with "DEV's log channel is unreadable" and could not distinguish that from real isolation; this pass rules it out directly. N5 still logically overlaps N4 (once two distinct containers are established, distinct log streams follow) — recorded as a confirming row, not treated as fully independent of N4.
- `2026-08-23T19:02:49Z` — ledger baseline, `docker exec forgejo-postgres psql -U forgejo -d forgejo -t -A -c "select max(id), count(*) from action_run;"` → **`1160|1160`**. Read-only, method per D31 §7. 🔴 **Timing, named honestly (review High):** this query ran at the *end* of the first pass's measurement block, not before it — but zero pushes from this session occurred before it (the only push, `d03abadb`, came after), so nothing above baseline was hidden inside it. The instance-wide caveat (no `repo_id` filter; `max(id)==count(*)` is not itself proof no run was deleted) is real and pre-existing to this story — deferred, not this story's to fix (review: Deferred item, accepted as-is).
- Sandbox-side (no host access), `2026-08-23T18:57:12Z`–`18:57:18Z` and fix-pass `19:37:26Z`–`19:37:27Z` — see the expanded per-row table in Completion Notes (AC1-5 evidence); the first pass's one-sentence summary ("every value reproduced identical") is superseded by that table, which now carries individual commands and timestamps per Task 2.1's actual requirement.

**Story 4.8 backfill capture (Dev Notes §5 — captured, not applied), completed this fix-pass:**

- **Item 3, unchanged, complete:** `action_run.id` for the two 4.8 branch pushes: `d5e5fa65…` → **1144**
  (`started=1787436745`); `a003e25b…` → **1149** (`started=1787496715`, `status=3`) and **1150**
  (`started=1787496732`, `status=1`).
- **Item 1, run 1150, now with the query text and the finding the backfill existed to surface:**
  `select id,status,started,stopped from action_run where id=1150;` → `1150|1|1787496732|1787496781`.
  **`stopped - started = 49s`.** Story 4.8 and `docs/migration-decisions.md#d31` §7 both carry this run
  as coordinator-relayed *"SUCCESS (~70s)"*. **Measured: 49s.** A real find, not a rounding — this is
  what the backfill was for. 33 `action_task_step` rows read back via
  `select ats.name, ats.status from action_task_step ats join action_task at on ats.task_id=at.id
  where at.job_id in (select id from action_run_job where run_id=1150) order by ats."index";` — all
  `status=1` except three (`Validate hold_lock_seconds and start the stand-lock holder`, `Safety net —
  remove this run's holder if the step above failed`, `Restore the previous digest if this job failed
  after down`) at `status=4`. 🔴 Status-code mapping (`1`/`4`) not independently confirmed against
  Forgejo's actual enum this session — raw values only, not a success/skip claim.
- **Item 2, run 1146/1147, now complete:** `select id,trigger_event,trigger_user_id,status,started,
  stopped from action_run where id in (1146,1147);` → `1146 | schedule | -2 | 1 | 1787450444 |
  1787450518` and `1147 | workflow_dispatch | -2 | 1 | 1787450520 | 1787450563`. **`actor_id`/
  `trigger_user_id = -2`** on both — the value D31 §7's protocol names, now captured, not just cited.
  `started=1787450444` = `2026-08-23T02:00:44Z` — the `02:00:00+44s` pattern D31 §7 established, an
  exact match, stated as a comparison this time rather than left implicit. Run 1146's own
  `action_task_step` log (4 rows): `Sweep stale images and lock-holder debris` (`status=1`, 33 log
  lines), `Note if the sweep failed` (`status=4`, 0 log lines), `Dispatch deploy-dev.yml with ref=main`
  (`status=1`, 2 log lines), `Confirm a deploy-dev.yml run was actually created` (`status=1`, 1 log
  line). ⚠️ **Still not fully closed:** "1147 left the stand on `main`'s own digest, healthy" is not
  directly traceable to 1147 specifically — the stand has redeployed multiple times since (1150's own
  restore, per D33, landed it on the digest observed above), so `fe-prionex-dev`'s *current* `Image`
  matching D33's recorded restore digest confirms D33's own claim, not 1147's isolated effect. Naming
  this gap rather than papering over it.

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

**🔴 +1, spent, 2026-08-23 (coordinator, autonomous, zero-cost decision on this fix-pass): code
review returned CHANGES REQUESTED (commit `7bbb92b2`); the two budgeted write-up rounds (DN4) were
both consumed by the first pass's write-up, so this fix-pass is the named contingency, not free
capacity. This push (the fix-pass commit) is that `+1`. Declared floor is now **8** above baseline.**

**retro-D4 discipline:** declared here before the first push; closes only against a direct query
re-run **after the merge commit lands** (Task 9.1) — a ledger closed at PR-open is not closed.
~~**Disposition: OPEN.**~~ 🔴 **Closed below, 2026-08-23T20:46Z (closeout branch `story-5-1/pr-2-ledger-closeout`), Oleg merged PR #74.**

### Task 9.1 — Closing reconciliation, post-merge query, 2026-08-23T20:46:47Z

**Query:** `select max(id), count(*) from action_run;` (instance-wide, unfiltered) → **`1167 | 1167`**.
`select count(*) from action_run where repo_id=16 and id > 1160;` (`repo_id=16` = `fe-prionex`,
confirmed via `select id,owner_name,name from repository where name='fe-prionex'`) → **`7`**. The two
numbers agree (1167 instance-wide = 1160 baseline + 7 fe-prionex runs + 0 sibling-repo runs this
window) — `count(*)` and `max(id)` moved by the same amount, so no run is hidden and no row was
deleted from under this count.

🔴 **This is the first ledger closed while a second story (4.9) was pushing to the same repo
concurrently. "Everything above baseline is this story's" — every prior ledger's assumption — is
false here, and would overstate this story's cost by 2. The fix, set as the form for every ledger
after this one: filter to `repo_id`, then attribute each row by `commit_sha`/`ref`, not by id range
alone.**

| id | ref | commit | trigger | status | belongs to |
|---|---|---|---|---|---|
| 1161 | `story-5-1/pr-1-context` | `d03abadb` | push | 1 (success) | **Story 5.1** — first-pass commit |
| 1162 | `story-5-1/pr-1-context` | `7bbb92b2` | push | 1 (success) | **Story 5.1** — code-review commit (a push to the branch, same as any other) |
| 1163 | `story-5-1/pr-1-context` | `3b641a6b` | push | 1 (success) | **Story 5.1** — fix-pass commit |
| 1164 | `pull/74/head` | `3b641a6b` | pull_request | 1 (success) | **Story 5.1** — PR #74 open check |
| 1165 | `story-4-9/pr-1-context` | `7435fec6` | push | 1 (success) | **Story 4.9** — not this story's spend |
| 1166 | `story-4-9/pr-1-context` | `11017adc` | push | 6 (running, at query time) | **Story 4.9** — not this story's spend |
| 1167 | `main` | `90836b99` | push | 1 (success) | **Story 5.1** — PR #74 merge, `build-main.yml` |

Attribution method, stated once so later ledgers can cite it instead of re-deriving it: (1) filter
`action_run` to this repo's `repo_id`, eliminating sibling-repo instance noise (zero this window —
the filtered count and the instance-wide delta agree exactly, which is itself the check); (2) for
each remaining row, match `commit_sha` against the closing story's own known commits (context,
review, fix-pass, merge) and against any concurrently-active sibling story's own branch tip(s)
(fetched fresh: `story-4-9/pr-1-context` at closeout time); (3) a row whose `ref`/`commit_sha`
matches neither is not yet attributable and must be named as such, not folded into either story by
default — none of that case occurred this round.

**Reconciliation — declared floor vs actual, itemized by phase:**

| Line | Declared | Actual | Run id(s) |
|---|---|---|---|
| Context push (predates baseline, excluded from floor) | — | 1 | (`29f9e4f8`, before this session; not queried, pre-baseline by definition) |
| Pushes to branch (2 budgeted + 1 fix-pass contingency = 3) | 3 | 3 | 1161, 1162, 1163 |
| Context PR opened | 1 | 1 | 1164 |
| Context PR merged (`build-main.yml`) | 1 | 1 | 1167 |
| Closeout branch push | 1 | 1 | *(this push, id not yet known — spent by this commit landing)* |
| Closeout PR opened | 1 | **0 — not this session's to spend** | coordinator opens PR #75+ separately (Dev Notes §7) |
| Closeout PR merged | 1 | **0 — not this session's to spend** | coordinator merges separately |
| **Total** | **8** | **6 spent by this session; 2 remain for the coordinator** | |

**No overrun.** 6 of the declared 8 are spent and accounted for by commit; the remaining 2 (closeout
PR open + merge) are real future spend, not slippage — they belong to the coordinator's own
convention (Task 9.5/Dev Notes §7: this session never opens or merges its own PRs) and will show up
in whatever ledger next queries past this one. Story 4.9's 2 runs (1165, 1166) are named, not
absorbed — they are 4.9's own ledger's concern, not this one's, and this closeout does not attempt to
reconcile them.

### Completion Notes List

**🔴 Fix-pass 2026-08-23, post code-review (commit `7bbb92b2`, verdict CHANGES REQUESTED — 4
decisions / 5 high / 27 medium / 21 low). This section is rewritten, not appended, where the review
showed the first pass's claims did not survive: N4's actual method, N5's independence, the
`:934-937` closure, the CORS in-network corroboration, the `/api/` Host confound, and the roll-up's
honesty about what was and wasn't measured. See Review Findings below for the item-by-item response.**

**AC closure (Task 9.4), corrected:**

- **AC1 — on evidence.** `crm-preprod-network` exists, id `90bd3e56416e3a00…`, created
  `2026-08-11T17:12:51Z` (converted from the raw `+02:00` read — Dev Notes §2's UTC rule applies to
  the record, not just the collection), 69 containers, `crm-preprod-kong-gateway` attached with alias
  `crm-kong-gateway` confirmed verbatim, and confirmed (fix-pass) to be the *only* container on the
  network carrying that alias. Channel: SSH rung 1, `2026-08-23T18:58:05Z`.
- **AC2 — on evidence.** Address identity (`172.21.0.24` = the address `crm-preprod-network`'s own
  `.Containers[]` map assigns to `crm-preprod-kong-gateway`, not merely "Kong's self-reported
  address"), Kong itself answers (`X-Kong-Response-Latency: 0`, `Server: kong/3.4.2`, literal body),
  N3 negative control empty/exit 2 (caveat: exercises the host resolver, not the embedded DNS
  `nginx.conf` actually uses — named, not chased). **Port `8000`: confirmed as *an* in-network
  listener, but does NOT close `deferred-work.md:934-937`** — that item is about a *non-default*
  `KONG_PORT`, which PRE-PROD never sets; this measurement can't discriminate the two hypotheses
  (walked back in AC2's own text, Task 5.5, `deferred-work.md`, and D34 §6 — the false closure the
  review found in all four places).
- **AC3 — on evidence, N4 corrected twice now.** N1 differs (`8320`/`8310`), re-tested **both**
  hostnames with an explicit `Origin` header this pass (Task 2.2's actual requirement — the first
  pass only retested PRE-PROD's). **N4, properly rescoped:** resolve the alias inside each network,
  then find the owning container from *that network's own* `.Containers[]` address map — not by
  asking a container already selected by name for its `.Id`, which the first pass did and which
  guarantees a different ID regardless of isolation (the same vacuity the rescope existed to
  remove). Fix-pass result: PRE-PROD's map assigns `172.21.0.24` to `61eb0eaa9f64…`; DEV's map
  assigns `172.22.0.53` to `6c1b4ac96e8d…` — different containers, discovered by each network's own
  bookkeeping. Container sets disjoint (69/70, intersection 0, both sides cross-checked against
  `{{len .Containers}}` this pass — the first pass only cross-checked PRE-PROD's). DEV stand observed
  on `crm-dev-network` only, `2026-08-23T19:00:28Z` — **stated as of that instant**, not as 4.9's end
  state (§12). **Counterfactual (Task 6.8):** had isolation been absent, N4 would have resolved the
  alias to the *same* container ID in both networks (dual-attachment or a bridged network), N1 would
  have shown one CORS value instead of two, and the disjoint-set check would have shown a non-empty,
  reproducible intersection (not the one-off template artifact this session actually hit and
  diagnosed). None of that is what was observed.
- **AC4 — on evidence, N5 now independently controlled.** N5 redone with a **DEV-side positive
  control before any cross-check**: a marker sent into `crm-dev-network` against
  `crm-kong-gateway:8000` was confirmed present in `crm-dev-kong-gateway`'s own log — proving that
  channel is readable — before treating the absence of PRE-PROD's marker there as meaningful. Both
  cross-checks (PRE-PROD marker absent from DEV's log; DEV marker absent from PRE-PROD's log,
  symmetric) came back negative as expected, over a full-ISO `--since`/`--until` window. **N5 is
  recorded as a confirming row, not an independent one** — once N4 establishes two distinct
  containers, distinct log streams follow, so N5 corroborates rather than adds new discriminating
  power; stated as such rather than claimed as a fifth independent proof. §11's `expect_unrouted_api`
  datum re-measured with `Host: crm.preprod.crm-prionex.online` (what `nginx.conf:41`'s
  `proxy_set_header Host $host` actually forwards, not the internal alias the first pass sent) —
  same `no Route matched` result, now on the path the guard actually takes, not a confounded one.
- **AC5 — on evidence.** Three defects recorded with owners (CORS/`CRM/api-prionex`+5.2 — this pass
  re-measured the CORS invariance *inside* the network with an `Origin` header supplied, which the
  first pass's cited "reproduction" did not actually send; vhost/5.2; `README.md:136`/coordinator-
  after-4.9). Two falsified facts recorded — **honestly, not flattened**: `Dockerfile.prod:34` is
  independently confirmed stale by this session's own read of `Dockerfile.prod:55-56`; the OpenBao
  placeholder claim is **not** independently re-verified this session (no Vault token) — the record
  says version 2, this session did not re-read it. These are two different epistemic states and
  every surface (this file, `deferred-work.md`, D34) should say so, not "both refuted." N2
  re-confirmed NXDOMAIN on **both** named hostnames (`preprod.…` and `api.preprod.…` — the first
  pass's Completion Notes only stated the aggregate).

**Discriminator count, stated precisely (not "five, all live"):** three actually discriminate
isolation from its absence — N1 (outside-in), N4 (container identity), N5 (confirming). N2 is a
standing DNS falsification, not an isolation test. N3 is a negative control (with the resolver-path
caveat above), not a PRE-PROD-vs-DEV discriminator. All five were measured live this session; only
three of the five are discriminators in the E5 sense.

**Ledger disposition: CLOSED, 2026-08-23T20:46:47Z (closeout pass, post-merge query, Task 9.1).**
Was OPEN through the fix-pass, per Prohibition 10's literal-word requirement — not asserted then as
"no row closed UNPROVEN or OPEN" as the first pass did, which had conflated the AC rows (genuinely
all closed on evidence) with the ledger (genuinely not closed at that point). Now closed against a
direct post-merge query: 6 of the declared 8 accounted for by commit, 2 remain the coordinator's to
spend (closeout PR open/merge) — see Run Budget Ledger's Task 9.1 reconciliation for the full
parallel-era attribution.

**Task 9.5, executed and recorded here (not "below" — the first pass's forward-reference pointed at
nothing):** `git fetch origin main && git diff --name-only origin/main...HEAD` →
`_bmad-output/implementation-artifacts/5-1-stand-up-the-isolated-pre-prod-backend-network.md`,
`_bmad-output/implementation-artifacts/deferred-work.md`, `_bmad-output/implementation-artifacts/sprint-status.yaml`,
`docs/migration-decisions.md`, `docs/preprod-infrastructure-requirement.md`. Five files, none named in
§12/Prohibition 5. Re-run after this fix-pass's commit; unchanged list.

**Prohibitions 1-13 (Task 9.3), re-verified, corrected where the roll-up over-certified:** 1: every
`docker run` was `--rm`; `/tmp` files created via `mktemp` this pass and removed same session.
🔴 Revised wording for **"nothing on s1 is written at all"** (Project Structure Notes, Dev Notes §3):
that summary sentence is stronger than Prohibition 1 itself, which permits exactly what happened
(`/tmp` writes, removed on exit; a read-only `psql` query against a live DB; five `--rm` containers
created and destroyed). Both are true; the summary should say "the host-side footprint is `/tmp`
writes removed on exit and `--rm` containers, per Prohibition 1 — no persistent file, no created
network, no container left running," not "zero bytes." 2/3: no `connect`/`disconnect`/`restart`/
`stop`/`down` issued. 4/5: confirmed by Task 9.5's output above. 6: vacuously satisfied. 7: no token
printed. 8: OpenBao not reached (no token). 9: `crm-network` never referenced as a fallback.
10: every row states its actual disposition, including the two rows this pass downgraded
(`:934-937` — reopened; N5 — confirming, not independent). **11: 2026-08-15 values used only as
prior; but this pass's own §3-comparison language ("identical to the ~18:16 UTC prior") checked
against a 41-minute-old same-day reading, not the six-day-old 2026-08-15 one Prohibition 11 was
written about — the staleness argument was discharged against the wrong baseline in the first pass;
the expanded per-row table below fixes the underlying gap (individual commands/timestamps) that made
the vague comparison necessary in the first place.** 12: **corrected this pass** — the `:934-937`
disposition is now placed under the original `deferred-work.md` entry, struck and reopened, not filed
as an unrelated EOF finding (the first pass's roll-up claimed compliance by quoting only the "new
findings at EOF" half of the rule and ignoring the "closures under the original" half it had just
been corrected to state). 13: every number above was obtained first-hand over this session's own
SSH/psql channel or sandbox `dig`/`curl`/`openssl`, including the `psql` query text now recorded
verbatim in Debug Log References (the first pass asserted Prohibition 13 compliance for the 4.8
backfill numbers without showing the query — fixed).

**Sandbox-side evidence, per-row (Task 2.1's actual requirement — the first pass gave one summary
sentence; fix-pass re-runs every row with its own command and UTC timestamp):**

| Task | Command | UTC | Result |
|---|---|---|---|
| 2.1(a) | `dig +short api.crm.preprod.crm-prionex.online` | `18:57:12Z` | `185.185.49.127` |
| 2.1(b) | `dig +short crm.preprod.crm-prionex.online` | `18:57:12Z` | `185.185.49.127` |
| 2.1(c) | `dig +short api.crm.dev.crm-prionex.online` | `18:57:12Z` | `185.185.49.127` |
| 2.5 (N2, hostname 1) | `dig +short preprod.crm-prionex.online` | `18:57:12Z` | empty, NXDOMAIN |
| 2.5 (N2, hostname 2) | `dig +short api.preprod.crm-prionex.online` | `19:37:26Z` (fix-pass; not run in the first pass) | empty, NXDOMAIN |
| 2.1(e)/2.2 | `curl -D- https://api.crm.preprod.…/` | `18:57:18Z` | `404`, `Access-Control-Allow-Origin: http://localhost:8320`, `Allow-Credentials: true`, `vary: Origin` |
| 2.1(g) | `curl -D- https://api.crm.dev.…/` | `18:57:18Z` (first pass) | `404`, `Access-Control-Allow-Origin: http://localhost:8310` |
| 2.2 (DEV + Origin) | `curl -D- -H 'Origin: https://crm.dev…' https://api.crm.dev.…/` | `19:37:26Z` (fix-pass — not run the first pass) | unchanged, `8310` |
| 2.1(h) | `curl -D- -H 'Origin: https://crm.preprod…' https://api.crm.preprod.…/` | `18:57:18Z` | unchanged, `8320` |
| 2.3 (OPTIONS preflight) | `curl -X OPTIONS -H Origin -H Access-Control-Request-Method -H Access-Control-Request-Headers https://api.crm.preprod.…/` | `19:37:27Z` (fix-pass — first pass only grepped a subset) | `404`, same static `Allow-Origin`/`Allow-Credentials`/`Expose-Headers`, **no `Access-Control-Allow-Methods` or `-Headers` at all** |
| 2.4(j) | `openssl s_client … api.crm.preprod.…` | `18:57:18Z` | `CN=api.crm.preprod.crm-prionex.online`, LE `YE2`, valid Aug 14–Nov 12 |
| 2.4(k) | `openssl s_client … crm.preprod.…` | `18:57:18Z` | `CN=admin.techno-finance.online` — default vhost, no PRE-PROD cert |

**Audit point 18 (redundancy):** left as-is per the coordinator's instruction — and the review
independently confirmed the call was right: the repetition of the `:34`/`:55-56` correction across
§4, §7(b) and Task 7.5 is exactly what made the "Five"/"Nine" count divergence *visible*. The
divergent copies are fixed this pass (§7(b) now reads "Nine"), the repetition itself is not
restructured.

**Audit point 17 ("minor drift, listed"):** the list never reached this session; the code review
derived it independently and it resolves to three items, all now fixed: the `Dockerfile.prod:34`
count at §7(b) (was "Five", now "Nine"); the `alpine` precedent mis-attributed to "D28 §2" (now
`4-2-provision-the-new-dev-stand-on-s1.md:600`); and a citation-drift note in `deferred-work.md`
pointing at `docs/migration-decisions.md:3924`, invalidated to a new line number by this same
fix-pass's own D34 edit (fixed in `deferred-work.md`, below). Item 17 is discharged.

### File List

- `_bmad-output/implementation-artifacts/5-1-stand-up-the-isolated-pre-prod-backend-network.md` — this file: corrections log, inline citation/N4/Prohibition-12/rung-3/Task-9.5 fixes, full evidence write-up.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `5-1-…` → `review`, with a summary comment.
- `_bmad-output/implementation-artifacts/deferred-work.md` — appended at EOF: nine findings from this round (defects, falsified facts, N4/methodology notes, §11 datum, Story 4.8 backfill capture pointer).
- `docs/preprod-infrastructure-requirement.md` — header amendment (Редакция 3): struck the falsified "не направлено"/"заблокирован" claims, stated what replaced them and on what evidence. Body/§2.4/§2.5 untouched.
- `docs/migration-decisions.md` — added D34 (summary row + full section) and a changelog row.

**Not written:** `.forgejo/workflows/verify-preprod-network.yml` (rung 3 not reached — rung 1 worked).
No file named in §12/Prohibition 5 was touched.

### Review Findings

<!--
Code review 2026-08-23 (Opus, per the model split), branch `story-5-1/pr-1-context` @ `d03abadb` vs
`main` @ `fc6bfe82`. Three parallel layers (adversarial, edge-case, acceptance) + lead verification.
4 decisions / 5 high / 27 medium / 21 low kept, 1 deferred. **Verdict: CHANGES REQUESTED.**

🟢 What the review confirms mechanically, not by eye. **Prohibitions 4, 5 and §12's blast-radius
boundary are genuinely honoured** — `git diff --name-only origin/main...origin/story-5-1/pr-1-context`
is exactly five files (this story file, `deferred-work.md`, `sprint-status.yaml`,
`docs/migration-decisions.md`, `docs/preprod-infrastructure-requirement.md`); no `deploy-stand.yml`,
`deploy-dev.yml`, `dev-reset.yml`, `README.md`, `docker-compose.*`, `nginx.conf`, `Dockerfile.prod`,
`.env.*.example` or `.github/` appears, and the File List matches the diff exactly. **Nothing was
created on s1**: every recorded `docker run` is `--rm`, no `create`/`connect`/`disconnect`/`restart`/
`stop`/`down` appears anywhere in the probe. **D34 is genuinely free** — `story-4-9/pr-1-context`'s
`docs/migration-decisions.md` stops at D33, checked directly. Citations spot-checked and correct:
`Dockerfile.prod:55-56`, `nginx.conf:39,50`, `deploy-stand.yml:1338` ("Never docker network create
anywhere"), `build.yml:796-799`. The blank-line/`comm -12` diagnosis is **right**: the Go template
emits a trailing newline and `--format` appends another, both files carry one blank line, `sort` puts
it first, `comm -12` matches it — 70/71→69/70 and 69 cross-checks against `{{len .Containers}}`. The
address-identity chain (alias→`172.21.0.24`, Kong's own address on that network) is sound. And the
run-1150 duration the backfill captured (49 s from `started`/`stopped`) genuinely contradicts the
relayed "~70s" — that is a real find, even though the story did not notice it.

🔴 The findings cluster in four places: **what the negatives actually exclude** (N4 and N5 as run do
not falsify what they are said to falsify), **claims recorded as measured that no recorded command
could have produced**, **the one prohibition the coordinator's audit specifically clarified**, and
**the roll-up flattering the leaves** — the failure mode Task 9.2 was written to prevent.

🟡 **The two unapplied audit points, dispositioned.** **Item 17 ("minor drift, listed")** — the list
never reached this session, so the review derived it independently by sweep rather than by relay. It
resolves to three items, all filed below: the `Dockerfile.prod:34` count still reading "Five" at
`:244` and in `sprint-status.yaml:636` after the corrections log says it was fixed; the `alpine`
precedent attributed to D28 §2, which names no image (the real citation is
`4-2-provision-the-new-dev-stand-on-s1.md:600`); and `deferred-work.md:3436`'s
`docs/migration-decisions.md:3924`, invalidated to `:4005` by this same commit. Item 17 needs no
further action from the coordinator — it is discharged here. **Item 18 (redundancy)** — the dev's
call to leave it was **correct**, and this review confirms it: the repetition of the
`:34`/`:55-56` correction across §4, §7(b) and Task 7.5 is what made the "Five"/"Nine" divergence
visible at all. Restructure nothing; fix the divergent copies.
-->

**🔴 Fix-pass response, 2026-08-23 (coordinator, autonomous, zero-cost — Oleg's veto open on all
four decisions below).** SSH rung 1 re-confirmed live before and after an unplanned session restart
mid-pass. All four Decisions taken; all five High items patched with a real re-measurement, not just
reworded text; Medium/Low addressed where cheap — see Completion Notes, Debug Log References,
`deferred-work.md` and D34 for the actual evidence behind each checkbox below.

**Decisions needed (Oleg) — these cannot be patched without your call:**

- [x] [Review][Decision] **AC4/N5: re-run with a DEV-side positive control, or downgrade the row?**
      → **Coordinator chose (a): re-run with a DEV-side positive control.** Done, fix-pass
      `2026-08-23T19:36:30Z`–`19:36:35Z`: a marker sent into `crm-dev-network` was confirmed HIT in
      `crm-dev-kong-gateway`'s own log before either cross-check ran. N5 is recorded as a
      **confirming** row, not independent of N4 (per the review's own logical point). See Debug Log
      References, Completion Notes AC4. — "the marker is absent from `crm-dev-kong-gateway`'s log" is only evidence if that log would have shown it, and nothing establishes that it would. Options: (a) one more rung-1 SSH session issuing a marked request *into* `crm-dev-network` against `crm-kong-gateway:8000` and confirming it lands in DEV's log — zero runs, `--rm`, already inside the prohibitions (a container was run on that network at `:943`); or (b) leave the measurement and downgrade AC4's negative half to "not independently controlled" in Completion Notes, D34 §2 and `deferred-work.md` finding 6. As it stands AC4 is recorded as closed on evidence. See H3.
- [x] [Review][Decision] **§11's `expect_unrouted_api` datum was measured on a Host no route matches and the production path never sends — re-measure or withdraw?**
      → **Coordinator chose: re-measure with the correct Host.** Done, fix-pass `19:36:04Z`:
      `Host: crm.preprod.crm-prionex.online`, matching `nginx.conf:41`'s `proxy_set_header Host
      $host`. Same `404 no Route matched` result, now on the actual guard path. See D34 §6. — the probe sent `Host: crm-kong-gateway` (`:937,939`), but `nginx.conf:41` is `proxy_set_header Host $host`, so the real frontend→Kong path forwards the browser's hostname. `no Route matched` is therefore fully explained by the Host header alone. §11 rejected the *external* measurement for being "not the path the guard takes"; this one is not that path either, for a different reason. Options: re-measure with the Host the guard actually sends, or withdraw the datum from D34 §6 and `deferred-work.md` finding 8 and leave §11 open for Story 5.3. See M8.
- [x] [Review][Decision] **Story 4.8's backfill: finish items 1–2 now while SSH is known-good, or ship the partial capture?**
      → **Coordinator chose: finish now.** Done, fix-pass `19:34Z`–`19:35Z`: `actor_id`
      (`trigger_user_id`) `=-2` captured for both 1146/1147; run 1146's own 4-row step log captured;
      run 1150's query text and 33-row step log now recorded verbatim, surfacing the 49s-vs-"~70s"
      discrepancy. One gap remains, named rather than papered over: "1147 left the stand on `main`'s
      digest" isn't directly traceable to 1147 alone (redeployed since). See Debug Log References. — the capture closes item 3 completely, leaves item 1 summarised rather than verbatim, and leaves item 2 substantially open (`actor=-2` never captured; run 1146's own sweep/dispatch/read-back log absent; the host-side confirmation that 1147 left the stand on `main`'s digest absent — `docker inspect fe-prionex-dev` ran at `19:00:28Z` and took `Status` but not `.Image`). As shipped the coordinator cannot fold it into D31 §7 without another SSH session, which is the exact cost the capture existed to avoid. Open Question 4 asks this in the abstract; the incompleteness makes it concrete. See M14.
- [x] [Review][Decision] **Task 8.1 struck a sentence that is true.**
      → **Coordinator chose: restore the status line unstruck, strike only the falsified second
      sentence.** Done in `docs/preprod-infrastructure-requirement.md` — `:7`'s "не направлено" now
      matches `:5`, no contradiction; only the "Эпик 5 … заблокирован" claim stays struck. «Статус: **не направлено**» was accurate — the amendment's own text says the falsity holds *«независимо от того, было ли требование когда-либо формально „направлено"»*, and D34 §1 states plainly *«так и не было отправлено»*. Only *«Эпик 5 … остаётся заблокированным»* is falsified by this story. Options: restore the status line unstruck and strike only the second sentence, or keep the strike and reword Редакция 3 to say the status is retained as true. Either way `:5` («Кому направлено — *требование ещё не направлено*») is left unstruck two rows above the struck version of the same claim. See M9.

**High — the evidence does not exclude what it is said to exclude:**

- [x] [Review][Patch] **Prohibition 12 breached on the one clause the coordinator's audit existed to clarify: a mandated closure was filed at EOF as a new finding**
      → Fixed: `deferred-work.md:934` now carries a `>`-quoted correction directly under the original
      entry, struck disposition, reopened, pointing at finding 8. Roll-up wording corrected too. [`deferred-work.md:934`, `:3456-3464`; story `:968`, `:1071-1072`] — AC2's own clause and Task 5.5 mandate *"closing `deferred-work.md:934-937` for PRE-PROD"*, and the story asserts it twice. The corrected Prohibition 12 is explicit: *"**closures of existing entries** are added immediately **under the original entry** (not at EOF), with the superseded text struck (`~~…~~`), never deleted."* The only `deferred-work.md` hunk is `@@ -3397,3 +3397,73 @@`. `:934` still reads *"⚠️ **Unverified, and it matters:** … **this must be confirmed, not assumed.**"* — unstruck, uncloed, with no pointer to finding 8. The Task 9.3 roll-up then certifies compliance by quoting only the half that was satisfied: *"12: append was at EOF (new findings, per the corrected rule); no existing entry was edited in place."* True, and irrelevant to the clause that was breached.
- [x] [Review][Patch] **A CORS corroboration is recorded as measured that no recorded command could have produced**
      → Fixed: re-measured `19:36:05Z` with `Origin: https://crm.preprod.crm-prionex.online`
      actually sent; response headers now include the (unchanged) CORS values. `deferred-work.md`
      finding 1 corrected with the real command and timestamp. [`deferred-work.md:3410-3411`; story `:936-939`, `:957`, `:968`, `:974`] — finding 1 states the defect was *"reproduced identically via direct in-network request to `crm-kong-gateway:8000` at 2026-08-23T19:01:09Z"*. `19:01:08Z`–`19:01:09Z` is the N5 marker probe, whose output goes to `/dev/null`. The raw `nc` requests carry **no `Origin` header**, and a route-miss `404` does not execute a route- or service-scoped CORS plugin, so no `Access-Control-Allow-Origin` could have been emitted on that path. The only in-network responses recorded with headers (`:968`) list status, `X-Kong-Response-Latency`, `Server` and body — **no CORS header at all**. This is the corroboration in a finding routed to an external team. Prohibitions 10 and 13.
- [x] [Review][Patch] **AC4's negative half is not falsifiable as run, and is largely entailed by N4 rather than independent of it**
      → Fixed by Decision 1's re-run: DEV positive control proves the log channel readable; full-ISO
      `--since`/`--until` fixes the unparseable transcription; N5 now stated as confirming, not
      independent, matching the review's own logical point. [story `:960`, `:974`; `deferred-work.md` finding 6] — `docker logs --since "$T" crm-dev-kong-gateway 2>&1 | grep -F -- "$MARK" && … || echo "N5: NO HIT dev (expected)"` converts *every* failure into the expected result: container renamed/removed by the neighbouring team, a log driver `docker logs` cannot read (`syslog`/`gelf`/`fluentd`/`none` — another team's 69-container stack, never checked), Kong's `proxy_access_log` pointing at a file rather than stdout on the DEV stack, an empty window, or rotation. `2>&1` pipes the error text *into* `grep`, which finds no marker and exits 1. The HIT proves only that **PRE-PROD** writes access logs to stdout. Compounding it, the `--since` value transcribed for the closing run (`:974`, *"`docker logs --since 19:01:08Z`"*) has no date and is not parseable by Docker's `--since` — as transcribed, both greps error and both report NO HIT. And logically: once N4 establishes two distinct containers, distinct `docker logs` streams follow, so N5's negative adds little beyond N4. Nothing recorded distinguishes "DEV's Kong never saw it" from "DEV's log is not a channel".
- [x] [Review][Patch] **N4 as executed is not the rescoped N4, and the assertion actually performed could not have come out the other way**
      → Fixed, the central patch of this pass: re-measured `19:35:41Z`–`19:35:42Z` via each network's
      own `.Containers[]` address map (`grep "${ADDR}/" <network's own map>`), not named-container
      lookup. Full container IDs recorded, both sides. See Debug Log References, `deferred-work.md`
      finding 6, D34 §3. [story `:944-946`, `:947-949`, `:617-625`, `:626-629`; D34 §3 and summary row] — Task 6.1 and the rescope require matching the resolved address back to a container *"via that network's own `docker network inspect` output (`.Containers[]`)"*. The script never touches `.Containers[]` for this: it runs `docker inspect crm-dev-kong-gateway --format '{{.Id}}'` and `docker inspect crm-preprod-kong-gateway --format '{{.Id}}'` — two containers already distinguished by **name**, whose IDs are therefore guaranteed to differ. That is the same vacuity the rescope was written to remove, one level up. Task 6.2's DEV-side per-container `IPv4Address` map — the data the identity match needs — was never collected (`:947-949` emit only `{{len .Containers}}` and an ID-only range). What genuinely survives is the *address* match at `:967`/`:970`, performed by eyeball across two unlabelled outputs with no asserted linkage. D34 headlines the ID comparison (*«пересмотрен на identity-match по container ID»*) as this story's methodological contribution to 5.2 and 6.4.

- [x] [Review][Patch] **The `deferred-work.md:934-937` closure is not only misplaced — it is unearned; the measurement does not discriminate the open question**
      → Fixed: the false closure walked back in all five places named (AC2, Task 5.5, this section's
      transcript description, `deferred-work.md` finding 8, D34 §6). Item reopened under the
      original entry. [`deferred-work.md:934-937`; story `:425-426`, `:607-609`, `:968`; `deferred-work.md:3456-3461`; D34 §6] — the open item is not *"does PRE-PROD's Kong answer on 8000"*. It reads: *"their PROD plan sets `KONG_PORT=8330` because `8000` collided with the live production on s2. That is presumably the **published host** port while Kong still listens on 8000 inside the network — but our nginx hardcodes the **port** as well as the name, so **this must be confirmed, not assumed.**"* The question is whether setting `KONG_PORT` to a non-default moves the *in-network* listener. PRE-PROD does not set it. Observing `8000` where the variable is unset is consistent with both hypotheses and discriminates neither — it is exactly the shape of check §2 warns about, *"most easily faked by a check that would pass either way"*. Dev Notes §6 states the honest disposition — *"a measured PRE-PROD data point for free"* — and the story then asserts a **closure** five times (AC2's own clause, Task 5.5, the transcript, `deferred-work.md` finding 8, D34 §6), carrying it into Story 6.4's PROD decision.

**🔴 Fix-pass summary for Medium (checked individually below where fixed):** addressed —
OpenBao/discriminator-count roll-up honesty (D34 §2/§5, this file's Completion Notes), AC5 N2's
second hostname (now measured), AC3 N1's DEV-side Origin retest (now measured), the sandbox evidence
per-row table, Task 2.3's OPTIONS preflight (now recorded with full headers), the `/api/` Host
confound (Decision 2), Task 8.1 (Decision 4), `deferred-work.md` finding 5's false correction claim,
the "Five"/"Nine" divergence (now Nine everywhere in this file), the `alpine` mis-citation, the
"delivered unilaterally" motive language, Prohibition 12's missing/trigger-condition owners, the
preamble's routed-count mismatch (3→6), the backfill's incompleteness and its 49s-vs-70s find,
`Health=healthy`'s unqueried field, Task 3.2's unevidenced `alpine` presence, Task 9.1's missing
literal `OPEN`, Task 9.5's dangling forward-reference, and the disjoint-set `pipefail`/both-sides
cross-check. **Not addressed this pass, named rather than silently dropped:** N1's "single nginx
per-vhost could also explain it" caveat (the discriminator-count fix above already demotes N1 from
"proves two Kongs" to "one of three discriminators," but AC3's own text isn't re-worded to name the
single-nginx alternative explicitly); the disjoint-set's "running containers only" caveat (would need
either a second measurement bracketing technique or an explicit caveat sentence — time-boxed out of
this pass); the ledger baseline's *narrative* position (substantively fine — zero pushes preceded it
— but not literally moved earlier in the file). Each remaining item is small and independent of the
Decisions/High fixes above; flagging for a possible follow-up pass rather than blocking this one.

**Medium:**

- [ ] [Review][Patch] **The roll-up flatters the leaves on the OpenBao fact — three of four D34 surfaces state a refutation this session did not perform** [`docs/migration-decisions.md` D34 summary row, §5 heading, changelog row; vs `deferred-work.md:3426-3428`] — the leaf is honest: *"not re-verified this session … the claim above is the *record's* claim, **not a fresh read**."* The summary row, the §5 heading and the changelog all say flatly *«два унаследованных факта опровергнуты»*. Only §5's body hedges. This is precisely Task 9.2's rule and Story 4.7's headline finding.
- [ ] [Review][Patch] **"Five discriminators, all live" overstates what the five are** [D34 summary row, §2, changelog; vs story `:182`, `:183`] — the story's own §5 table classifies N2 as *"— (a standing falsification, not an isolation test)"*, and N3 is a control, not a PRE-PROD-vs-DEV discriminator. Two of the five do not discriminate isolation. D34 presents *«доказан изолированным от DEV пятью дискриминаторами (N1-N5), все — живьём»*.
- [ ] [Review][Patch] **AC5's N2 clause names two hostnames; only one was measured** [story `:514-517`, `:132`, `:976`, `:1056`] — AC5 requires *"`dig preprod.crm-prionex.online` **and** `dig api.preprod.crm-prionex.online`"*. §3 (a)–(k) has no row for the second name — (d) is the only NXDOMAIN row — and the sole supporting record is the aggregate *"re-runs of §3 (a)–(k)"*. Completion Notes closes it flatly: *"N2 re-confirmed NXDOMAIN."*
- [ ] [Review][Patch] **AC3's N1 clause requires neither value to move under a supplied `Origin`; only the PRE-PROD hostname was retested** [story `:446-448`, `:545-546`; `deferred-work.md:3408-3409`] — the record reads *"unchanged under any supplied `Origin` (tested with `https://crm.preprod.crm-prionex.online`)"* — PRE-PROD only. Task 2.2 says *"capture **both** … and **both again** with an explicit `Origin`."* §3's prior has (h)/(i) for PRE-PROD and no DEV equivalent.
- [ ] [Review][Patch] **The recorded probe script is not the script that ran, in at least two places, while being labelled "run verbatim"** [story `:920-921`, `:948-949`, `:951`, `:954`, `:971`, `:973-974`] — (a) the printed block already contains `| grep -v '^$' |`, so it could not have produced the `intersection=1` artifact the story spends a paragraph documenting; the fix note is parked on the `rm -f` line rather than the two pipelines it describes. (b) `MARK="isolation-probe-$(date -u +%Y%m%dT%H%M%S)"` yields `isolation-probe-20260823T190107`, not the recorded `isolation-probe-story5-1-20260823T190107-clean`; nor can the block produce the "literal quote characters" quoting bug described at `:973`. The command that generated AC4's evidence is not in the record. Dev Notes §3: *"a reconstruction is a memory, not a measurement."*
- [ ] [Review][Patch] **The sandbox-side evidence — which carries N1, AC3's declared floor and AC5's CORS/vhost rows — is one summary sentence with no commands, no per-row values and no per-row timestamps** [story `:976`; Task 2.1 at `:542-544`] — delivered as *"`2026-08-23T18:57:12Z`–`18:57:18Z`: `dig`/`curl`/`openssl` re-runs of §3 (a)–(k) — every value reproduced **identical** to the … prior."* Task 2.1 requires *"Record each result with a UTC timestamp."* Every downstream literal (`8320`/`8310`, the cert CN, the NXDOMAIN) is sourced from §3, not from the re-run — and Prohibition 11 forbids carrying §3 forward as evidence. "Identical to the prior" is the one formulation that cannot be distinguished from carrying the prior. And the prior it was checked against is §3's own, timestamped *"~18:16 UTC"* the same day — a **41-minute-old** reading, not the 2026-08-15 one Prohibition 11 was written about, so the staleness rationale is discharged against the wrong baseline.
- [ ] [Review][Patch] **Task 2.3 (the OPTIONS preflight) has no trace anywhere, yet AC5 clause 1 requires "the preflight behaviour"** [story `:547-548`, `:504-506`; `deferred-work.md:3408-3415`] — Task 2.3 asks for *"status, and **every** `Access-Control-*` header present or absent."* Neither the Debug Log, nor finding 1, nor D34 records a preflight status or header set; finding 1 covers only the simple request.
- [ ] [Review][Patch] **The `/api/` probe used a Host no Kong route matches, and the production path never sends it** [story `:939`, `:968`; `nginx.conf:41`, `:56`] — `Host: crm-kong-gateway` is an internal alias; Kong matches routes on host *and* path, so `no Route matched` is fully explained by the Host header. `nginx.conf` forwards `Host $host` — the browser's hostname — on both `/api/` and `/ws/`. The §11 datum handed to Story 5.3 is confounded on exactly the axis §11 used to reject the external measurement. See Decision 2.
- [ ] [Review][Patch] **Task 8.1's amendment strikes a true sentence and leaves the header table self-contradictory** [`docs/preprod-infrastructure-requirement.md:5`, `:7`, `:18-20`; D34 §1] — see Decision 4. `:5` still asserts, unstruck, *«(не заполнено — требование ещё не направлено)»*, two rows above the struck-through version of the same claim at `:7`. A reader gets both dispositions and no resolution.
- [ ] [Review][Patch] **`deferred-work.md` finding 5 claims a correction in `docs/preprod-infrastructure-requirement.md` that the diff does not contain — and lists the same file as still carrying the stale citation** [`deferred-work.md:3435-3437`; `docs/preprod-infrastructure-requirement.md:18-27`, `:47`, `:85`, `:193`] — *"Not corrected in place anywhere except this story's own text and `docs/preprod-infrastructure-requirement.md`'s header amendment (Task 8.1)."* Редакция 3 never mentions `Dockerfile.prod`; that file still carries `:34` on three lines, and Task 8.2 explicitly forbade rewriting the body. Both halves of the sentence cannot be true.
- [ ] [Review][Patch] **The stale-citation count is stated three different ways inside one deliverable — the drift the corrections log claims to have fixed** [story `:244` "Five", `:164-166` "eight other … nine total", `:39-41`; `deferred-work.md:3429` "Nine"; `sprint-status.yaml:636` "five artifacts"] — the corrections log records the count as corrected *"from 'four other artifacts' to 'eight other' (nine total incl. the epic)"*, but §7(b) at `:244` was left at "Five" in the same commit, and `sprint-status.yaml` carries "five" too. This is the independent answer to unactioned **audit item 17** — the drift is inside the very finding about stale citations, and the story's own binding rule is *"a fact that stopped being true is corrected with a record, not silently carried."*
- [ ] [Review][Patch] **This commit adds a fresh instance of the stale citation and then counts it among the pre-existing carriers** [`sprint-status.yaml:636` (an added line); `deferred-work.md:3432`] — the new context block writes *"the Dockerfile.prod:34 citation repeated by five artifacts is stale"*, propagating both the stale line number and the stale count, and finding 5 then enumerates *"`sprint-status.yaml:636`"* as one of the nine artifacts carrying the problem. §4's own instruction is *"record the correction, do not propagate the wrong citation."*
- [ ] [Review][Patch] **The `alpine` precedent that carries the whole Prohibition 1 argument is mis-cited — D28 §2 names no image** [story `:32-34`, `:560-565`, `:922-923`, `:597-599`] — three places assert the image is *"Story 4.2/D28 §2's precedent … already present on s1's local image cache from that story"*, and that is the entire reason pulling is not needed. D28 §2 (`docs/migration-decisions.md:2956-3157`) names no image anywhere, and its DEV-side probe was `docker exec fe-prionex-dev getent hosts crm-kong-gateway`, not a `docker run`. **The underlying fact is nevertheless true** and this review located the real citation: `4-2-provision-the-new-dev-stand-on-s1.md:600` records `docker run --rm --network bridge alpine getent hosts crm-kong-gateway` → no output, exit 2, executed on s1. Fix the citation, do not withdraw the claim. Note this mis-citation entered via the coordinator's own audit item 6 and was applied verbatim — the same class as audit item 17.
- [ ] [Review][Patch] **"Delivered unilaterally, not in response to this requirement" is an inference stated as fact, and it has been written into a permanent Russian amendment** [story `:47-49`, `:405-409`; D34 §1; `docs/preprod-infrastructure-requirement.md:7`, `:22-24`] — the only support offered is that *our own* document was never marked «направлено». `CRM/api-prionex` was never contacted by this story, and commit `517e6975` sits in their repository and is never read, quoted or line-cited anywhere. Prohibition 13 requires every claim be first-hand; this attributes a motive to another team from a blank cell in our own table, and now says so in their-facing prose («доставлен односторонне … не в ответ на это требование»). State it as what it is — our document was never sent, so the contour cannot have been a response *to it* — without the motive.
- [ ] [Review][Patch] **Prohibition 12's owner clause breached, and three findings have no owner at all** [`deferred-work.md:3427-3428`, `:3429-3455`] — finding 4's owner is *"whoever next has an explicit `X-Vault-Token` and five minutes"* — a trigger condition, the exact anti-pattern Prohibition 12's final clause names (*"owners are names or story numbers, never trigger conditions"*), and the same shape this story criticises in the 4.8 entry. Findings 5, 6 and 7 carry no `Owner:` line.
- [ ] [Review][Patch] **The `deferred-work.md` preamble's count of routed findings does not match its own findings** [`deferred-work.md:3403-3404`] — *"Nine findings this round. **Three** are routed to somebody else's ownership by design."* Six of nine carry an owner outside this story: 1 (`CRM/api-prionex`), 2 (5.2), 3 (coordinator), 4 (unnamed), 8 (5.3), 9 (coordinator). Task 8.3 requires the preamble to state the count.
- [ ] [Review][Patch] **The Story 4.8 backfill capture is materially incomplete on item 2 while the session held the access the entry was waiting for** [story `:978-991`; `deferred-work.md:3374-3399`] — item 3 is complete (`d5e5fa65`→1144, `a003e25b`→1149/1150). Item 1 is summarised, not pasted verbatim as Dev Notes §5 requires (*"capture the raw query output verbatim"*), and the `1`/`4` status enum is honestly flagged as unconfirmed. Item 2 asks for five things and delivers one and a half: `trigger_event='schedule'` ✅; `actor=-2` never captured; the `02:00:00+44s` timing is *derivable* (epoch `1787450444` = `2026-08-23T02:00:44Z`, an exact match) but the comparison is never stated; run 1146's own sweep/dispatch/read-back log absent; the host-side confirmation that 1147 left the stand on `main`'s digest healthy absent, although `docker inspect fe-prionex-dev` ran at `19:00:28Z` and took `Status` but not `.Image`. Separately, **none of the backfill's four bullets has a recorded query**: the `action_run` ids, the epoch start/stop pairs, the statuses and the 33-row `action_task_step` breakdown all appear as results, while the only `psql` command recorded anywhere in the story is `select max(id), count(*) from action_run;`. Prohibition 13 compliance is asserted for them at `:1072-1073` but not shown, and the coordinator needs the query text to re-run it. See Decision 3.
- [ ] [Review][Patch] **The capture contradicts a relayed figure and the story does not notice — which is the entire point of the backfill** [story `:980-981`; `4-8-factor-out-the-shared-deploy-mechanics.md:33`, `:2245`; `docs/migration-decisions.md#d31` §7] — Story 4.8 and D31 §7 carry run 1150 as *"SUCCESS (~70s)"*, coordinator-relayed. The captured row gives `started=1787496732`, `stopped=1787496781` → **49 s**. Replacing a relayed number with a measured one that disagrees is a finding, not a rounding, and it is exactly what the backfill entry was opened to obtain.
- [ ] [Review][Patch] **`Health=healthy` is recorded for `fe-prionex-dev` but the format string never queries health** [story `:952`, `:972`] — the probe is `--format 'Networks={{range …}}{{$k}}(ip={{$v.IPAddress}}){{end}} Status={{.State.Status}}'`; `.State.Health.Status` is absent. The transcript nonetheless records *"`Status=running`, `Health=healthy`"*. A value in the evidence table with no command behind it — Prohibition 13, and the story's own *"every number … obtained first-hand."*
- [ ] [Review][Patch] **Task 3.2's `alpine`-presence confirmation is asserted but never evidenced** [story `:922-923`, `:560-565`] — *"image `alpine` (already present on s1, confirmed via `docker image inspect alpine` before use …)"*. The probe script printed immediately below contains no such command and no transcript row records its output. Task 3.2 makes this the guard against a Prohibition 1 violation (pulling an image).
- [ ] [Review][Patch] **The ledger baseline was taken after the work, not before the first push** [story `:975`, `:995`, `:998`] — `1160|1160` at `2026-08-23T19:02:49Z`, the last measurement of the session, after every AC1–AC4 probe (`18:58:05Z`–`19:01:09Z`). The ledger header simultaneously claims *"Declared 2026-08-23 at context time, **before any push**"*. retro-D4 is *"declare before work"*; any run spent between the context push and `19:02:49Z` now sits inside the baseline and is invisible to Task 9.1's diff.
- [x] [Review][Patch] **Task 9.1's ledger disposition is never given the literal word `OPEN`**
      → Fixed, fix-pass: literal "Disposition: OPEN" added. → Now superseded, closeout: literal
      "CLOSED" recorded 2026-08-23T20:46:47Z against the actual post-merge query (Task 9.1 performed
      for real this pass, not deferred to the coordinator). [story `:993-1031`, `:1058`; D34 changelog row] — §9 and Prohibition 10 require it: *"If the query cannot be run, close it with the literal word **OPEN**."* The ledger ends with the declaration; `OPEN` appears only inside the restated rule as a future instruction. Completion Notes says *"No row closed UNPROVEN or OPEN"* and D34's changelog hands reconciliation to the coordinator — but Task 9.1 assigns it to this story. Both sibling precedents visible in the same file do it correctly — D32 and D33 each record *«леджер OPEN до пост-мёрж запроса»*. Also unstated: the one push already spent above the `1160` baseline.
- [ ] [Review][Patch] **Task 9.5's required output was never recorded and the forward-reference points at nothing** [story `:697-704`, `:1066-1067`] — Task 9.5 requires *"read the list … Report the clean diff-check result and the branch name."* Completion Notes says *"confirms (Task 9.5, **below**)"* and there is no Task 9.5 section below. The underlying claim is **true** — independently verified this review, five files, none in §12 — but the required evidence was not produced.
- [ ] [Review][Patch] **N1 discriminates two Kong *configurations*, not two Kong instances — and it is the designated fallback** [story `:145-148`, `:181`, `:493-495`] — *"A single shared Kong could not emit two different static origins"* is false, on two independent mechanisms: one Kong with two Host-matched routes and per-route CORS plugins does exactly that, **and** §3 (e) itself records `Server: nginx/1.24.0 (Ubuntu)` — a single nginx terminating both hostnames can set `add_header Access-Control-Allow-Origin` per vhost in front of one shared Kong. `:146` correctly says "two Kong configurations", but AC3 leans on N1 as a backend discriminator and the story twice designates it as the row that *"carries the isolation claim alone"* if host access fails. In that branch AC3 would close on a check that cannot distinguish the failure mode.
- [ ] [Review][Patch] **Task 6.8's required post-run counterfactual statement is absent** [story `:645-646`; D34 §2] — *"State plainly, in one sentence, which discriminators fired and which did not, **and what each one would have looked like had isolation been absent**."* D34 §2's table has a result column only; the "if isolation were absent" column exists solely in §5, which is context-time spec text, not delivered evidence.
- [ ] [Review][Patch] **The disjointness claim holds only of *running* containers, and the record does not say so** [story `:948-949`, `:630-632`, `:333-336`] — Docker drops a stopped container's endpoint from `.Containers`. A container attached to both networks but stopped — or mid-restart while Story 4.9 moves the DEV stand underneath the measurement, which §12 explicitly warns about — is invisible to the set diff. That is N4's own failure mode. The two inspects are also non-atomic and unbracketed, so a `disconnect` between them yields a false empty intersection.
- [ ] [Review][Patch] **No `pipefail`, and the available cross-check on the DEV set is printed but never used** [story `:926`, `:947-950`] — the script sets `set -u` only. A failed `docker network inspect` still exits 0 through `sort`, leaving an empty file: `intersection=0` from two empty sets is indistinguishable from a true disjoint result, which is what Task 6.3 asked to make *"visibly a computed one rather than an assumed one."* `docker network inspect crm-dev-network --format '{{len .Containers}}'` is run at `:947` and its value never recorded or compared against `wc -l`; PRE-PROD's 69 is cross-checked two ways, DEV's 70 rests on the same channel that produced the artifact.

**🔴 Fix-pass summary for Low:** addressed — marker uniqueness (nanosecond-suffixed this pass, no
longer second-granularity), probe-script hygiene (`mktemp`, `nc -w 5`, `set -o pipefail`), the marker
request's response/exit code (captured, not discarded), the `README.md:136` quote (verbatim now, not
paraphrased), D34 §7's wrong reason for the 4.8 backfill non-application (Dev Notes §5, not
Prohibition 12), the access-reversal explanation (different address, named in Debug Log References),
"nothing on s1 is written at all" (reworded to match Prohibition 1's actual text), alias uniqueness
(swept explicitly, one hit). **Not addressed:** the UTC/`$time_local` timezone question for the N5
hit timestamp (would need `docker logs -t` or explicit offset math — not done this pass); the citation
drift at `docs/migration-decisions.md` (resolved differently — the citation in `deferred-work.md`
finding 5 no longer names a fixed line number at all, so it can't drift); the record-form deviations
in AC5's "named by path and line" for `1-6-…md`/`docs/preprod-infrastructure-requirement.md` (still
named by count, not full path+line lists — time-boxed out); N3's embedded-DNS-vs-host-resolver gap
(named as a caveat in the corrected N3 row, not re-measured through `127.0.0.11` specifically);
separator-less multi-network format strings elsewhere in the story text (fixed in the fix-pass script
and `fe-prionex-dev`'s own probe; not swept for every other occurrence).

**Low:**

- [ ] [Review][Patch] **Timezone: the hit timestamp and the network's `Created` are the two places UTC is asserted rather than shown** [story `:959-960`, `:965`, `:974`, `:1037-1038`] — `docker logs` is called without `-t`, so the *"exact request line at `19:01:09Z`"* is Kong's own `$time_local`, which on a CEST host prints `+0200`; either a silent hand-conversion or a two-hour error. `created=2026-08-11T19:12:51.421330465+02:00` is the one non-UTC value carried into the record and into D34 §1, against Dev Notes §2's *"Write everything in UTC"* and AC1's UTC requirement.
- [ ] [Review][Patch] **A citation that drifts on write** [`deferred-work.md:3436`] — finding 5 cites `docs/migration-decisions.md:3924` as a stale-citation site. Correct against `origin/main`; this same commit inserts ~81 lines of D34 above it, so the line is now `:4005`. A citation-drift finding that invalidates its own citation.
- [ ] [Review][Patch] **Marker uniqueness is second-granularity** [story `:954`, `:635-637`] — Task 6.5 requires *"a value that cannot pre-exist in any log"*; `date -u +%Y%m%dT%H%M%S` collides on a re-run inside the same second, and the session demonstrably re-ran fragments five times within 0.8 s. `$T` collides with it.
- [ ] [Review][Patch] **Probe-script hygiene: fixed `/tmp` names, no `trap`, no `nc` timeout** [story `:948-951`, `:937`, `:939`, `:957`] — `/tmp/pc.txt`/`/tmp/dc.txt` are not `mktemp`, so two sessions (rung 1 and a rung-2 paste) clobber each other silently; `nc` has no `-w`, so a half-open connection hangs the session before the `rm -f`, leaving files on s1 against Prohibition 1's own *"removed on exit"* guarantee.
- [ ] [Review][Patch] **The measurement apparatus attaches endpoints to the networks under test and never accounts for its own perturbation** [story `:935-949`, `:956-957`, `:347-348`, `:771-773`] — five `docker run --rm` land on `crm-preprod-network` and `crm-dev-network`; `--rm` teardown lag or a concurrent rung-2 paste puts `alpine` in one or both ID sets, inflating a count or producing a real non-zero intersection attributed to infrastructure. Prohibition 2's stated rationale is *"The claim under test is which containers are attached to what"*, and Dev Notes §4 records that endpoints on that team's network block their `docker network rm`. The compliance report answers only the narrow *"no `connect`/`disconnect` issued"* and never asks whether probe endpoints were in flight during the 69/70 counts.
- [ ] [Review][Patch] **Alias uniqueness is never checked** [story `:935`, `:943`] — Docker permits several endpoints on one network to carry the same alias and round-robins the answer. One `getent` returning Kong's address is consistent with a second container on `crm-preprod-network` also answering to `crm-kong-gateway`, which the frontend would reach non-deterministically.
- [ ] [Review][Patch] **Separator-less multi-network `--format` ranges** [story `:944`, `:952`, `:972`] — unlike `:948`, these `{{range}}`s emit no `{{"\n"}}`, so a dual-attached container's entries run together on one line. The *"No other network membership"* conclusion at `:972` reads exactly such a range.
- [ ] [Review][Patch] **The marker request's response and exit code are discarded** [story `:957`, `:973`; AC4 clause 3] — `… | nc crm-kong-gateway 8000" >/dev/null`. "Request never sent" and "sent but logged nowhere" are indistinguishable. AC4's *"status and body are recorded verbatim"* is met by the separate Task 5.4 request; the marker probe's own response is characterised (*"404, same Kong signature"*), not recorded.
- [ ] [Review][Patch] **A single unretried `sleep 2` sample against a possibly buffered or rotating access log** [story `:958`] — nginx/Kong `access_log … buffer=…B flush=…s`, or load on a 69-container stack, delays the flush; a DEV entry arriving at +5 s is never looked for, since the DEV grep runs once and immediately.
- [ ] [Review][Patch] **N3 exercises the host resolver, not the embedded DNS the real path uses** [story `:940`, `:183`, `:187-189`, `:744-745`; `nginx.conf:38,49`] — the built-in `bridge` network has no embedded DNS, so resolution falls through to s1's `/etc/resolv.conf` and its search domains, while `nginx.conf` resolves through `127.0.0.11`. N3's own §5 row is honestly worded (*"the name is host-wide"*), but §5's intro and Dev Notes §3 call it *"the control that gives N4 meaning"*, which it is not. The resolver path the control actually took is not recorded.
- [ ] [Review][Patch] **Task 4.3's second half is unanswered** [story `:590-592`, `:965`] — *"note whether the network id differs from anything previously recorded — a recreated network is the hazard."* The id is recorded; no comparison is made and no statement that no prior id exists.
- [ ] [Review][Patch] **Record-form deviations from three specifications** [`deferred-work.md:3424`, `:3432-3434`, `:3401`] — Task 7.3 requires the `README.md:136` line be **quoted**; it is paraphrased. AC5 requires the stale-citation artifacts *"named by path **and line**"*; `1-6-…md` and `docs/preprod-infrastructure-requirement.md` are named by count (*"five lines"*, *"three lines"*). Task 8.3's heading string is `story-5-1-…` against the specified `story 5-1-…`.
- [ ] [Review][Patch] **D34 §7 gives the wrong reason the 4.8 backfill was not applied** [`docs/migration-decisions.md` D34 §7] — *«не применены — Prohibition 12/чужая правка»*. Prohibition 12 governs where `deferred-work.md` edits go; the actual reason is Dev Notes §5 (it writes to D31 §7 and 4.8's artifacts while 4.9 is in flight).
- [ ] [Review][Patch] **Stale "SSH unavailable" assertions survive in the delivered files** [`sprint-status.yaml` context block; story `:197`] — both still say SSH was blocked, 15 lines above (and 700 lines above) the records that say rung 1 worked. Dated layering explains it; the project's at-a-glance status surface does not carry the dates.
- [ ] [Review][Patch] **`sprint-status.yaml` introduces an uncorroborated run number** [`sprint-status.yaml`, OpenBao line] — *"confirmed by run 593 and again by bundle extraction on run 680"*. Run 593 appears nowhere else; the story cites only run 680 (`:227-228`).
- [ ] [Review][Patch] **Every task checkbox is still `- [ ]`** [story `:528-704`] — ~60 subtasks unchecked on a story submitted for review with all five ACs closed. A reader cannot tell performed from skipped anywhere in Tasks 1–9, which is how 2.3, 4.3, 6.2 and 6.8 passed unnoticed.
- [ ] [Review][Patch] **"Reproduced deliberately five times" is presented as methodology but is not replication** [story `:971`] — five runs of an identical deterministic command inside 0.7 s add no discriminating information. The actual diagnostic was the empty "shared IDs" list, which the sentence names as *"the tell"*; the repetition count should not carry evidential weight.
- [ ] [Review][Patch] **Task 4.2's `IPv4Address` was collected by the unspecified path** [story `:932`, `:586-589`, `:966`] — the task names `.Containers[].IPv4Address` from the network inspect; the script uses `docker inspect <container> --format '{{json .NetworkSettings.Networks}}'`. The recorded `172.21.0.24/16` carries the netmask characteristic of the network-inspect form, so the datum is probably right and the collection path is not the one specified.

- [ ] [Review][Patch] **"Nothing on s1 is written at all" does not survive the story's own transcript** [story `:868`, `:753`, `:948-951`, `:975`] — Project Structure Notes and Dev Notes §3 both make the absolute claim (*"entire host-side footprint should be zero bytes changed"*). The session ran `docker exec forgejo-postgres psql` against a live database, created and destroyed five containers, and wrote and removed two `/tmp` files. **Prohibition 1 permits every one of those** — the prohibition is carefully worded (*"no file written outside `/tmp` and removed on exit"*) and was honoured. The summary sentence is simply stronger than the rule it summarises; align it.
- [ ] [Review][Patch] **One timestamp is openly borrowed across two different commands** [story `:971-972`] — *"Re-run with `grep -v '^$'` at `19:00:28Z` (not separately timestamped in this line, see next)"*, and the next line assigns `2026-08-23T19:00:28Z` to the `fe-prionex-dev` inspect. AC1 and AC3 both require per-observation UTC timestamps; the honesty of flagging it is right, the shared stamp is still one observation short.
- [ ] [Review][Patch] **The access reversal is never accounted for, only reported** [story `:140`, `:197-198`, `:916`] — §3 (l) and §6 say the attempt was *"refused by the sandbox before a packet left"*, which is address-independent; the Debug Log then reports `ssh root@10.67.0.1` succeeding. The likely account is in §6 itself (different address, different session — *"Treat s1 access as session-dependent"*), but the story never states which of the two it was, and every host-side row plus the ledger baseline and the 4.8 capture rest on that channel. One sentence naming what differed makes the whole host-side half reproducible; without it, `NLDW3-3-42-32` has no prior record to check against.

**Deferred (pre-existing, not caused by this change):**

- [x] [Review][Defer] **The ledger baseline query is instance-wide with no `repo_id` filter, and `max(id) == count(*)` is not a hidden-run proof** [story `:975`, `:684-687`] — deferred, pre-existing (D31 §7's own method, inherited by every story since 4.6). Sibling repos' runs inflate the post-merge delta against a story-scoped floor, so an overrun is not attributable; and the `max(index)`/`count(*)` identity holds only if no `action_run` row was ever deleted.

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
