# Sprint Change Proposal — the neighbouring stack renames Kong per stand, and our image cannot follow

**Date:** 2026-08-13
**Trigger:** Reading `CRM/api-prionex` before sending Story 1.6's PRE-PROD requirement, after Oleg
disclosed that the "platform team" is an agent working a sibling repository on the same instance.
**Mode:** batch.
**Scope classification:** **Moderate** — one FR amended, three stories amended, one decision record
reframed, one unsent document rewritten in kind. No epic reordering, no rollback of completed work.

---

## 1. Issue Summary

**`CRM/api-prionex` parameterises its whole stack through `STACK`, and its Kong container is named
from it:**

```yaml
# ~/Workspace/api-prionex_f/docker-compose.server.yml:684
kong:
  image: kong:3.4
  container_name: ${STACK:-crm}-kong-gateway
```

Their three per-stand plans set that variable:

| stand | their `STACK` | resulting Kong container | their network |
|---|---|---|---|
| DEV | `crm-dev` | `crm-dev-kong-gateway` | `crm-dev-network` |
| PRE-PROD | `crm-preprod` | `crm-preprod-kong-gateway` | `crm-preprod-network` |
| PROD | `crm-prod` | `crm-prod-kong-gateway` | `crm-prod-network` |

Sources: `docs/forgejo-dev-s1-plan.md:70`, `docs/forgejo-preprod-s1-plan.md:88`,
`docs/forgejo-prod-s2-plan.md:69`.

**Our frontend reaches the backend by the literal name `crm-kong-gateway` on port `8000`**
(`nginx.conf:39,50`), and that file is **baked into the image** at `Dockerfile.prod:34`. The image
is byte-identical across stands by design — that identity is what the promotion model rests on — so
**there is no per-stand way to point it at a differently-named gateway.**

On every new stand, the name our image looks for will not exist.

**Why nothing is broken today:** on the current DEV and PROD stands `STACK` is unset, the default
`crm` renders `crm-kong-gateway`, and our image finds it. The collision arrives with the *new*
stands — the ones Epics 4, 5 and 6 create.

**The port is not part of the problem, and this was checked rather than assumed.** Their Kong listens
on `KONG_PROXY_LISTEN: "0.0.0.0:8000, 0.0.0.0:8443 ssl"` and publishes `"${KONG_PORT:-8000}:8000"`.
`KONG_PORT=8330` in their PROD plan changes only the *published host* port, after a collision with
the live production on s2. **In-network, Kong is on 8000 everywhere.** Our hardcoded port is correct.

**This was found because the requirement had not been sent.** Story 1.6's document asks the other
team to *create* `crm-network-preprod` with its own Kong. They are already building a separate
network and Kong for every environment — under different names. Sending it as written would have
produced agreement to build a second, redundant network beside the one already planned.

---

## 2. Impact Analysis

### The asymmetry that decides everything

The two mismatches look alike and are not:

| | mismatch | solvable on our side? |
|---|---|---|
| **Network name** | we say `crm-network-preprod`, they say `crm-preprod-network` | **Yes.** Story 4.1's AC already requires the network name to come from a variable. Changing the value costs one `.env` line per stand. |
| **Kong container name** | we need `crm-kong-gateway`, they produce `${STACK}-kong-gateway` | **No. Not at all.** It is baked into a byte-identical image. Making it per-stand would require either a runtime-config layer — variant A, rejected as technical debt in [D1](../../docs/migration-decisions.md#d1)/[D3](../../docs/migration-decisions.md#d3) — or per-stand `nginx.conf`, which destroys the image identity [D2](../../docs/migration-decisions.md#d2)'s promotion gate depends on. |

**The only cheap fix is on their side, and it is one line per stack:** a network alias
`crm-kong-gateway` for the Kong service inside each stand's network. Docker supports this natively;
different networks isolate namespaces, so the same alias in three networks does not collide.

### Epic impact

- **Epic 4** — hits this **first and soonest**. Story 4.2 provisions the new DEV stand on `8082`;
  whichever network it joins must contain something answering to `crm-kong-gateway`.
- **Epic 5** — the reason it was recorded as blocked changes completely. It is not waiting on
  infrastructure that does not exist; the infrastructure is planned and being built. It is waiting
  on **a naming agreement**.
- **Epic 6** — inherits the same for `crm-prod`, plus the `KONG_PORT=8330` fact, which is now
  established as harmless in-network.
- **Epics 2, 3, 7** — unaffected.

### Story impact

| Story | Change |
|---|---|
| **4.1** | Its AC ends *"**And** the DEV stand continues to resolve `crm-kong-gateway` on the shared `crm-network`."* That premise expires the moment their new DEV stand exists. Needs conditioning on which backend the stand points at. |
| **4.2** | Must state which network the new DEV stand joins — today it would silently join the legacy shared `crm-network` and reach the **legacy** backend, not the new DEV one. |
| **5.1** | Written around the name `crm-network-preprod`. Should adopt the agreed name and keep its real content — verification of `crm-kong-gateway` resolution **from inside the running container**, which this finding proves was the right AC to write. |
| **1.6** | Its requirement document changes genre: from "please build X" to "your plan already builds X; name it so our image can reach it". |
| 6.4 | Inherits the agreed naming; no wording change needed yet. |

### Artifact conflicts

- `epics.md` — **FR27** names `crm-network-preprod` as the network; Stories 4.1, 4.2, 5.1; the Epic 5
  blocked annotation added earlier today.
- `docs/migration-decisions.md` — **D4** carries the same network name; **D11** frames this as an
  external dependency awaiting a submission that Oleg deferred.
- `docs/preprod-infrastructure-requirement.md` — the ask itself.
- `deferred-work.md` — the collision entry is recorded; the Epic 5 entries need their reason
  corrected.

### Technical impact

None on our code. `nginx.conf`, `Dockerfile.prod` and the image are unchanged — **that is the point
of the recommendation.** The change is one variable value on our side and one alias on theirs.

---

## 3. Recommended Approach

**Direct adjustment. Adopt their naming; ask for an alias.**

**3.1 — Adopt `crm-{dev,preprod,prod}-network` and drop `crm-network-preprod`.** Their scheme is
consistent across three environments and already written into three plans and a parameterised
compose file; ours is a single name invented for one environment. Changing on our side costs one
`.env` value per stand — Story 4.1 already requires the name to be a variable. Changing on theirs
costs three plans and a convention. **The cheaper side should move, and it is us.**

**3.2 — Ask for the alias, and only that.** Inside each stand's network, the Kong service carries a
network alias `crm-kong-gateway`. This is the one thing we cannot do ourselves and the one thing
they can do trivially. It leaves their `container_name` convention intact.

**3.3 — Do not reopen variant A.** A runtime-config layer would also solve it, and it is the right
long-term answer ([D3](../../docs/migration-decisions.md#d3) is still open), but it is a rewrite of
how the frontend gets configured, and this is a one-line problem. Reopening it here would be
scope creep dressed as principle.

**Effort:** small. One value per stand on our side, one line per stack on theirs, four artifact
edits.
**Risk:** low, and the residual risk is verification, not design — an alias that is not applied fails
exactly like a missing gateway, so Story 5.1's in-container check is the thing that must not be
skipped.
**Timeline:** removes the Epic 5 blocker recorded this morning, provided the alias is agreed.

---

## 4. Detailed Change Proposals

### 4.1 FR27 — amend

> **OLD:** FR27: PRE-PROD runs on its own Docker network (`crm-network-preprod`) with its own Kong
> gateway, so `crm-kong-gateway` name resolution cannot leak the PRE-PROD frontend onto the DEV
> backend.

> **NEW:** FR27: PRE-PROD runs on its own Docker network — **named by agreement with
> `CRM/api-prionex`, whose stack convention is `crm-preprod-network`** — with its own Kong gateway,
> so `crm-kong-gateway` name resolution cannot leak the PRE-PROD frontend onto the DEV backend.
> **The gateway must answer to `crm-kong-gateway` inside that network**, as a container name or a
> network alias: `nginx.conf` is baked into a byte-identical image and cannot be pointed elsewhere
> per stand.

**Rationale:** the requirement was always about *isolation plus a resolvable name*. It stated the
isolation and left the name implicit, which is why the collision was invisible until someone read
the other repository.

### 4.2 Story 4.1 — amend the network AC's closing clause

> **OLD:** **And** the DEV stand continues to resolve `crm-kong-gateway` on the shared
> `crm-network`.

> **NEW:** **And** each stand resolves `crm-kong-gateway` inside **whichever network it is attached
> to** — the legacy stand on the shared `crm-network`, the new DEV stand on `crm-dev-network` —
> **and the story records which backend each stand actually reaches**, since attaching to the wrong
> network fails silently by serving the wrong backend rather than erroring.

### 4.3 Story 4.2 — add an AC

> **NEW:** **Given** `CRM/api-prionex` provisions its new DEV stack on `crm-dev-network` with Kong
> named `crm-dev-kong-gateway`
> **When** the new DEV frontend stand is provisioned
> **Then** it is attached to `crm-dev-network`, not to the legacy shared `crm-network`
> **And** it is verified from inside the running container that `crm-kong-gateway` resolves to the
> **new** DEV Kong
> **And** if the alias is not yet in place, the story records the absence and stops rather than
> falling back to the legacy network — a stand that silently serves the legacy backend is the
> failure this whole line of work exists to prevent.

### 4.4 Story 5.1 — rename and keep

Replace `crm-network-preprod` with the agreed name throughout. **Keep every other clause**,
especially *"the resolution is verified from inside the running container, not inferred"* — this
proposal is evidence that inference would have been wrong.

### 4.5 `docs/preprod-infrastructure-requirement.md` — rewrite in kind

From "please create a network and a Kong" to: "your plans already create both for three
environments; we need the gateway to answer to `crm-kong-gateway` inside each stand's network, and
we will adopt your network names." Keep §1's argument — it explains *why* the name matters — and
keep the datastore question, which nothing in their plans answers.

### 4.6 D11 — append, do not edit

D11 says the requirement is unsent and Epic 5 is blocked by decision. **That was true when written
and stays.** The changelog carries the correction: the dependency turns out to be a naming
agreement with a sibling repository, not a build request to an unreachable team.

### 4.7 Epic 5 blocked annotation — replace the reason

The block added this morning says Epic 5 waits on infrastructure that has no committed date. Replace
with: Epic 5 waits on a **naming agreement**; the infrastructure is planned and under construction
in `CRM/api-prionex`.

---

## 5. Implementation Handoff

**Scope: Moderate.** Recipients:

| Recipient | Deliverable |
|---|---|
| **Dev agent** | Apply §4.1–§4.4 and §4.7 to `epics.md`; rewrite the requirement per §4.5; append the changelog row per §4.6; correct the `deferred-work.md` entries that state Epic 5's reason. |
| **Oleg** | One decision — **confirm we adopt their network names** — and one hand-off: get the `crm-kong-gateway` alias agreed with `CRM/api-prionex`. Everything else follows. |

**Success criteria**

1. No artifact still asserts `crm-network-preprod` as settled.
2. Every story that attaches a stand to a network says which one, and verifies the gateway name
   **from inside the container**.
3. The requirement asks for the alias, not for a network that is already being built.
4. Epic 5's recorded blocker names the real dependency.

**Open questions**

- **Who applies the alias, and in which artifact of theirs?** Their compose sets `container_name`
  per stack; the alias belongs in each stand's `networks:` block. That is their edit, not ours.
- ✅ **The datastore question is answered (Oleg, 2026-08-13): the PRE-PROD services have their own
  databases.** This was the largest remaining risk — a correct network in front of DEV data would
  have reproduced the same fictional validation with a correct-looking diagram. **What remains is
  adjacent and not about networking:** who updates those services' versions relative to the release
  candidate, and on what trigger. A PRE-PROD backend that lags or leads production validates the
  wrong thing for a different reason.
- **`README.md:136`** still labels the DEV stand "Pre-production" — harmless today, dangerous once a
  real PRE-PROD exists.
