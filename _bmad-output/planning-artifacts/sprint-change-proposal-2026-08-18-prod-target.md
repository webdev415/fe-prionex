# Sprint Change Proposal — PROD Target Moves to VM `e1-rung3` Behind a Jump Host

**Date:** 2026-08-18
**Trigger:** Oleg's directive — production will deploy to `192.168.122.11`, reachable only as
`ssh -J root@62.112.10.55 root@192.168.122.11`. Not a story finding; an infrastructure decision
arriving from outside the plan.
**Status:** ACCEPTED (Oleg, 2026-08-18); edits §4.1–§4.13 applied the same day
**Mode:** Batch (all edits presented together)

---

## 1. Issue Summary

The plan's entire production topology rests on one sentence written 2026-08-07: **"s1 — DEV +
PRE-PROD, s2 — PROD."** Every production requirement downstream of it — FR19's deploy runner "on
the target host", Story 6.4's `runs-on` targeting `s2-prod-deploy`, Story 6.3's cutover
identification, NFR7's retained s2 key, Story 7.3's documentation, Story 7.5's final key
removal — names s2 (`root@175.110.122.17`) as where production lives.

That is no longer where production will go. The new PROD target is a dedicated VM behind a jump
host:

| | |
|---|---|
| Jump host / hypervisor | `NLDW6-3-11-16`, public `62.112.10.55`, wg-private `10.70.0.10` |
| PROD VM | `e1-rung3`, `192.168.122.11` (libvirt NAT), Ubuntu 24.04.4, kernel 7.0.0-28 |
| Access | `ssh -J root@62.112.10.55 root@192.168.122.11` |
| Resources | 4 vCPU, 3.6 GiB RAM, 16 GB disk (42% used, 8.8 GB free) |
| Docker | 29.7.2, Compose v5.5.0 |
| Second VM on the same hypervisor | `e1-snp2` (running; not ours to touch, not examined) |

**Everything above is measured, this session, over the exact SSH path Oleg supplied** — not taken
from anyone's description of the host.

### What was found on the host (measured 2026-08-18)

1. **A Forgejo runner is already there and polling.** Container `forgejo-runner-e1-rung3`
   (runner v13.0.0) plus its own `docker:27.5.1-dind`. Registered against
   `https://git.crm-prionex.com` as **id 21**, name `e1-rung3`, labels
   `s10:docker://ghcr.io/catthehacker/ubuntu:act-22.04` and `e1-rung3:docker://…act-22.04`.
   The hub's label convention (`s1`, `s2`, …) apparently names this host **s10**; this proposal
   adopts that shorthand. **Not verified:** the registration scope of runner id 21 (instance /
   org / repo) — the `.runner` file does not record it; Story 6.10 must verify.

2. **The existing runner cannot deploy.** Its jobs execute against `DOCKER_HOST=tcp://dind:2375`
   — the runner's own disposable daemon — not the host's `docker.sock`. A deploy job on it would
   start the stand *inside dind* and the host would serve nothing. This is a CI runner in the
   hub's pattern, not a deploy runner in the `s2-prod-deploy` pattern. The deploy model of FR19
   needs a second, deploy-shaped registration.

3. **The contour talks to the hub over wg-private by design** (Oleg, 2026-08-18: "ходим по wg
   private network") — runner polling, registry pulls, everything between s10 and the hub goes
   through `10.70.0.0/24`; public addresses are not used from the contour. The measurements
   agree, and add that the host is not yet set up for it:
   - `https://git.crm-prionex.com/v2/` via public DNS (`185.185.49.127`): TLS completes,
     certificate verifies, then **"Empty reply from server"** (`curl` exit 52, HTTP 000) — the
     hub's nginx drops non-allowlisted sources after the handshake. Same result from the jump
     host's public egress, and for `/` and `/api/v1/version`, so it is source-IP filtering, not
     path filtering.
   - Same URL resolved to **`10.70.0.1`** (wg-private): **HTTP 401** — the registry answers;
     401 is its normal unauthenticated response.
   - The VM has a working route (`10.70.0.1 via 192.168.122.1`) — the hypervisor forwards into
     wg-private. Ping reachable.
   - The runner only polls successfully because its container carries
     `--add-host git.crm-prionex.com:10.70.0.1`. **The host itself has no such `/etc/hosts`
     entry**, so a host-level `docker pull git.crm-prionex.com/…` — the exact fail-fast pull of
     FR19 — resolves the public IP and dies on the empty reply today.

4. **No registry credential on the host.** `/root/.docker/config.json` carries empty `auths`.
   s2's `robot-deploy` read-only pattern has no counterpart here yet.

5. **The host is being provisioned right now.** The runner's log shows a crash-loop this very
   morning (`open /data/.runner: permission denied`, then `0 server connections configured,
   terminating`) recovering at 09:28:16 UTC with a successful declaration. State on this host
   may shift under us; Story 6.10 must re-verify at execution time, not trust this snapshot.

6. **The hypervisor has no access of its own into the VM** (stated by Oleg 2026-08-18,
   measured the same day): from the jump host's shell, `ssh root@192.168.122.11` → "No route
   to host", while the ProxyJump channel from outside works — every measurement in this
   proposal travelled it. The jump host is a pure TCP relay for externally authorized keys;
   compromising its shell does not by itself reach the VM. The discriminating mechanism
   (nftables by sshd cgroup, or other) — **not verified**. Consequences: the deploy runner can
   only live inside the VM (as decided), and nothing on the VM is administered from the
   hypervisor.

7. Minor, recorded not judged: the runner container's environment exposes its
   `GITEA_RUNNER_REGISTRATION_TOKEN` to anyone with docker access on the host. The hub's
   operational pattern, not ours to fix; noted for the record.

### Issue type

New requirement from stakeholders (infrastructure decision), landing before Epic 6 starts —
which is the best possible timing: **every production story is still `backlog`**, so this is a
plan amendment, not rework.

---

## 2. Impact Analysis

### What is NOT affected

- **Epics 1–3 (done / in-progress):** nothing they built touches s2. CI, registry, tagging,
  build cache — all target-independent. Story 3.6 (`ready-for-dev`) verifies traceability
  against the registry, not against any stand. **No impact.**
- **Epic 4 (DEV on s1)** and **Epic 5 (PRE-PROD on s1):** unchanged. The deploy mechanics they
  establish (parameterized compose, runner-on-target-host, fail-fast pull, health check, lock)
  are exactly what Epic 6 will now reuse on a different host — the abstraction Story 4.8
  factors out was designed for precisely this.
- **FR12–FR14, FR20–FR30 as written:** parameterized by design; no host named.

### What IS affected

| Artifact | Impact |
|---|---|
| `epics.md` Overview | Topology sentence names s2 as PROD; "two pipelines can reach production" describes both pipelines hitting *the same host* |
| FR19 | Survives verbatim in mechanism ("deploy runner on the target host"); the target's identity changes — amendment note |
| FR26 | Names only the two s1 stand directories; PROD stand directory on s10 needs a home |
| FR31 / Story 6.3 | Identification of the running commit still happens **on s2** (legacy prod keeps serving until traffic switches) — unchanged; where the rebuilt image *deploys* changes |
| Story 6.4 | `runs-on` AC names "the deploy runner located on s2"; the accepted `docker.sock` risk was scoped to *shared* s2 |
| Story 6.9 | "Cut over without changing what production serves" silently assumed old and new PROD are the same host; now cutover = a traffic switch between two hosts, which is not ours to execute |
| Story 7.3 | Documentation AC: "names s1 as DEV plus PRE-PROD and s2 as PROD" |
| Story 7.5 | s2 key removal was "the final step of the migration"; s2 now leaves the delivery topology earlier, and the jump-host/VM admin path needs recording |
| NFR5 | Strengthened, not weakened: Forgejo now never touches s2 at all |
| NFR7 | The administrative access path to PROD becomes `ssh -J`; the s2 key remains admin-only for the *legacy* stand |
| `sprint-status.yaml` | New story entry |
| `docs/migration-decisions.md` | New decision D23 + changelog row |

### Risk ledger changes (both directions)

**Shrinks:**
- *"Two pipelines can reach production"* (Overview, accepted risk since 2026-08-07): the legacy
  GitHub CD deploys to s2; Forgejo will deploy to s10. **Concurrent deploys to the same host
  become impossible.** What replaces it is milder: two productions existing in parallel until
  traffic switches, with the legacy one authoritative until then.
- *`docker.sock` root-equivalence* (accepted by Oleg 2026-08-11): on shared s2 a deploy job
  had root-equivalent control of a host running other tenants' production. On a dedicated
  single-purpose VM the blast radius is that VM. The accepted risk stands but its cost drops.

**Grows / appears:**
- **The traffic switch is a new external dependency.** Public traffic today terminates at s2.
  How it reaches `e1-rung3` (hypervisor port-forward, nginx on the jump host, DNS change —
  unknown, deliberately not probed on the hypervisor) is outside this repository and outside
  this plan's control. Story 6.9's meaning shifts accordingly (see edits). The lesson of story
  1.6 applies: *measure the neighbour's convention before writing the ask.*
- **Split-horizon dependency hardens.** Production delivery now depends on the wg-private
  route (`192.168.122.1` → `10.70.0.1`) and a hosts entry. If either disappears, deploys
  fail at the pull step — fail-fast, visible, but a new failure mode s2 did not have.
- **3.6 GiB RAM / 16 GB disk** is comfortable for one nginx-serving frontend container plus a
  runner, but it is the smallest box in the topology; the retention policy's assumption that
  hosts hold few images matters more here.

---

## 3. Recommended Approach: Direct Adjustment

**Amend the artifacts in place and add one story; change no epic structure, no sequencing, no
MVP scope.** Evaluated against the alternatives:

- **Rollback:** nothing to roll back — no production story has started. Not applicable.
- **MVP review:** the MVP ("a release reaches production through Forgejo, rollback proven") is
  untouched; only *where* production lives changes. Not applicable.

The deploy **model** survives unchanged, and that is the central claim of this proposal: FR19's
runner-on-target-host pattern was chosen on 2026-08-11 because SSH from job containers was
impossible through the hub's firewalls. The new topology re-validates that choice — the VM is
NAT-hidden behind a jump host where workflow SSH would be *harder* still (`-J` through two
hops), while a runner needs only outbound polling, which is measured working. **The mechanism
ports; only the host identity and its provisioning are new work.** Effort: Low (one story +
text amendments). Risk: Low-Medium — the one genuinely new moving part is the external traffic
switch, which is contained inside Story 6.9's amendment and explicitly not ours to build.

Naming: artifacts refer to the new host as **s10** (the hub's own label for it), always with
the concrete coordinates on first mention per document: *s10 (VM `e1-rung3`, `192.168.122.11`,
behind jump `62.112.10.55`)*.

---

## 4. Detailed Change Proposals

### 4.1 `epics.md` — Overview

**Topology line (line 29):**

OLD:
> **Target topology:** s1 — DEV + PRE-PROD, s2 — PROD.

NEW:
> **Target topology:** s1 — DEV + PRE-PROD; PROD — **s10** (VM `e1-rung3`, `192.168.122.11`,
> behind jump host `62.112.10.55`; admin access `ssh -J root@62.112.10.55 root@192.168.122.11`).
> ~~s2 — PROD.~~ 🔴 **AMENDED 2026-08-18**
> (`sprint-change-proposal-2026-08-18-prod-target.md`): production moves to a dedicated VM;
> s2 (`175.110.122.17`) keeps serving the **legacy** production stand untouched until the
> external traffic switch (Story 6.9), and is never a Forgejo deploy target.

**"Two pipelines can reach production" bullet (lines 45–48):** append:

> 🔴 **AMENDED 2026-08-18:** the two pipelines no longer share a host — legacy CD deploys to
> s2, Forgejo deploys to s10 — so *concurrent deploys to the same stand* are impossible by
> construction. The residual risk is milder and different: **two productions exist in parallel**
> until the traffic switch, and until that switch s2 is the one users see.

### 4.2 `epics.md` — FR19 (amendment note appended)

> 🔴 **TARGET AMENDED 2026-08-18** (`sprint-change-proposal-2026-08-18-prod-target.md`): for
> production, "the target host" is **s10** (`e1-rung3`), not s2. The mechanism is unchanged and
> re-validated by the new topology: the VM is NAT-hidden behind a jump host, so workflow SSH
> would require two hops, while the runner's outbound polling is measured working. The runner
> currently on s10 (id 21, labels `s10`/`e1-rung3`) is **CI-shaped and cannot deploy** — its
> jobs execute in its own dind, not against the host daemon. Story 6.10 provisions the
> deploy-shaped counterpart.

### 4.3 `epics.md` — FR26 (append)

> **AMENDED 2026-08-18:** the PROD stand directory lives on s10 as
> `~/crm-prionex/fe-prionex-prod/`, same convention, established by Story 6.10.

### 4.4 `epics.md` — NFR5 (append)

> **AMENDED 2026-08-18:** for PROD the guarantee is now absolute — Forgejo never deploys to s2
> at all. The legacy PROD stand on s2 remains untouched through the entire migration and keeps
> serving until the external traffic switch.

### 4.5 `epics.md` — NFR7 (append)

> **AMENDED 2026-08-18:** the administrative access path to the new PROD contour is
> `ssh -J root@62.112.10.55 root@192.168.122.11` (key-based, proven this session). The old s2
> key remains authorized on s2 as the admin path to the **legacy** stand only; its rotation
> stays Story 7.5's concern. No SSH credential of any kind enters Forgejo — unchanged.

### 4.6 `epics.md` — Story 6.3 (note appended, ACs unchanged)

> **Note added 2026-08-18:** identification of the running production commit still happens on
> **s2** — that is where the legacy production serves from until the traffic switch. Only the
> *deploy destination* of the rebuilt image changed (s10, per Story 6.4 as amended). The ACs
> stand as written.

### 4.7 `epics.md` — Story 6.4, `runs-on` AC

OLD:
> **Given** the deploy targets s2
> **When** the workflow declares `runs-on`
> **Then** it targets the deploy runner located on s2 by its label

NEW:
> **Given** the deploy targets s10 ~~s2~~ (amended 2026-08-18)
> **When** the workflow declares `runs-on`
> **Then** it targets the deploy runner located on s10 by its label — the label Story 6.10
> registers, **not** `s10`/`e1-rung3`, which belong to the CI runner whose jobs execute in dind
> and can never reach the host's stand

And append to the existing 2026-08-11 trade-off note:

> **Re-scoped 2026-08-18:** the accepted `docker.sock` root-equivalence now applies to a
> dedicated single-purpose VM rather than a shared production host — the risk stands, its blast
> radius shrinks to that VM. The decision remains Oleg's and remains accepted.

### 4.8 `epics.md` — Story 6.9 (note prepended to ACs)

> 🔴 **MEANING AMENDED 2026-08-18** (`sprint-change-proposal-2026-08-18-prod-target.md`).
> As written, this story assumed old and new production share a host, so "deploy without
> changing what production serves" was one stand restarting on itself. Now: the no-op deploy
> exercises the full mechanism **on the s10 stand while s2 continues to serve users**. The
> comparison "content before and after is identical" is made between what s2 serves and what
> s10 serves (behaviour, not digest — the Option C caveat already recorded here). **The actual
> switch of public traffic from s2 to s10 is an external dependency** — hypervisor
> port-forwarding, front nginx, or DNS, owned outside this repository — and this plan treats it
> like the PRE-PROD vhost: named, owned, and verified from our side, not built by us. The
> cutover is complete only when the traffic switch has happened and the smoke check passes
> against the public name.

### 4.9 `epics.md` — Story 7.3, documentation AC

OLD:
> **And** it names s1 as DEV plus PRE-PROD and s2 as PROD with their ports.

NEW:
> **And** it names s1 as DEV plus PRE-PROD, and s10 (VM `e1-rung3` behind jump `62.112.10.55`)
> as PROD with their ports — including the admin access path (`ssh -J`) and s2's status as the
> decommission-pending legacy host (amended 2026-08-18).

### 4.10 `epics.md` — Story 7.5 (note appended)

> **Note added 2026-08-18:** s2 leaves the delivery topology at cutover but the old s2 key
> removal clause stands unchanged — it guards the *legacy* stand for as long as s2 serves or
> holds anything. The closing record gains one line: the keys authorized on the jump host
> (`62.112.10.55`) and on s10 are the production administrative path and must be inventoried
> in the same record.

### 4.11 `epics.md` — NEW Story 6.10 (inserted after Story 6.9; ordered before 6.4 in execution)

> Listed after 6.9 to preserve numbering, **must complete before Story 6.4** — the precedent is
> Story 1.13, which also ran out of numeric order for the same reason.

### Story 6.10: Provision the PROD Deploy Contour on s10

As a release engineer,
I want the new PROD host able to receive a Forgejo deploy before any deploy story runs,
So that Epic 6 lands on a host that is measured ready rather than assumed ready.

> **Everything below starts from the 2026-08-18 measurements**
> (`sprint-change-proposal-2026-08-18-prod-target.md` §1): a CI-shaped runner (id 21) already
> polls from s10 via `--add-host git.crm-prionex.com:10.70.0.1`; the host itself resolves the
> public IP and gets an empty reply; no registry credential exists on the host; the host was in
> a provisioning crash-loop the same morning. **Re-verify at execution time — this host is
> moving.**

**Acceptance Criteria:**

**Given** the hub's deploy-runner pattern (`s1-deploy-dev-preprod`, `s2-prod-deploy`)
**When** the deploy runner for s10 is provisioned — **by us, on s10 itself** (Oleg's decision
2026-08-18: we hold root on the VM via the jump path; only the registration token comes from
the Forgejo side)
**Then** a runner registration exists on s10 whose jobs execute against the **host** Docker
daemon (not dind), carrying a dedicated deploy label distinct from `s10`/`e1-rung3`
**And** the registration scope (instance/org) is verified to make it reachable from
`CRM/fe-prionex`, and runner id 21 is confirmed untouched.

**Given** the registry answers only over wg-private (measured: public → empty reply after TLS,
`10.70.0.1` → 401)
**When** the host is prepared
**Then** `/etc/hosts` on s10 maps `git.crm-prionex.com` to `10.70.0.1`, mirroring s1's
split-horizon
**And** a host-level `docker pull` of a real, currently-existing image tag succeeds — this is
the proof, not a `curl`.

**Given** s2's credential pattern (`robot-deploy`, scope exactly `read:package`)
**When** the pull credential is placed on s10
**Then** it is read-only, its account and scope are recorded, and a push attempt is refused
(`401`) — same proof shape as Story 1.10
**And** no `write:package` credential exists anywhere on s10.

**Given** FR25/FR26 conventions and the compose file from Story 4.1
**When** the stand directory is created
**Then** `~/crm-prionex/fe-prionex-prod/` exists on s10 with its server-side `.env`
(`COMPOSE_PROJECT_NAME`, `CONTAINER_NAME`, `FRONTEND_PORT`)
**And** the chosen `FRONTEND_PORT` is measured free on s10, not assumed — the FR25 lesson.

**Given** public traffic must eventually reach this stand
**When** the story closes
**Then** the traffic path (hypervisor port-forward / front proxy / DNS) is named with its owner
and current state, as an external dependency in the Story 6.9 sense
**And** nothing about it is built or changed by this story.

**Given** the plan's record-keeping
**When** the story closes
**Then** `docs/migration-decisions.md` D23 is updated with what was provisioned, by whom, and
what remains external.

### 4.12 `sprint-status.yaml`

Under Epic 6, after `6-9-…`:

```yaml
  # Added 2026-08-18 by sprint-change-proposal-2026-08-18-prod-target.md. Listed after 6.9 to
  # preserve numbering but MUST complete before 6.4 — same precedent as 1.13 before 1.12.
  # PROD target moved: s2 -> s10 (VM e1-rung3, 192.168.122.11, behind jump 62.112.10.55).
  6-10-provision-the-prod-deploy-contour-on-s10: backlog
```

Plus one comment line under the `epic-6:` header pointing at this proposal.

### 4.13 `docs/migration-decisions.md`

- New section **D23 — PROD target moves from s2 to VM `e1-rung3` (s10) behind jump host
  `62.112.10.55`** (decision: Oleg, 2026-08-18): the measured state of the host (§1 above), the
  re-validation of the runner-on-host model, the risk ledger deltas (§2), the s10 naming, and
  the external traffic-switch dependency.
- Changelog row `| 18.08.2026 | correct-course | … |` in the established style, referencing
  this proposal file.
- Index row for D23.

---

## 5. Implementation Handoff

**Scope: Moderate** — backlog change (one new story) plus multi-artifact text amendments; no
epic restructuring, no code.

| Who | What |
|---|---|
| Developer agent (this session, on approval) | Apply §4.1–§4.13 verbatim |
| Oleg | Approve the proposal; own the one remaining external ask when Epic 6 nears: the traffic-switch ownership. (Deploy-runner provisioning resolved 2026-08-18: **we provision it ourselves on s10** — root held via the jump path; only a registration token is needed from the Forgejo side) |
| Story 6.10 (future dev-story) | Everything on the host itself; re-measure first |

**Success criteria:** `epics.md`, `sprint-status.yaml`, `docs/migration-decisions.md` amended
exactly as above; no production story references s2 as a deploy target; Story 6.10 exists and
is sequenced before 6.4; the measured evidence of 2026-08-18 is preserved in D23.

**Explicitly out of scope:** touching anything on s10, s2, or the jump host; the traffic
switch; runner provisioning. This proposal changes paper only.
