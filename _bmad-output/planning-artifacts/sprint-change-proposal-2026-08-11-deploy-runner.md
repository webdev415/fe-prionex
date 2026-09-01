# Sprint Change Proposal — deployment moves from SSH to a deploy runner on the target host

**Date:** 2026-08-11
**Trigger:** Oleg's decision «деплой по runner», taken during Story 1.8 create-story
**Raised by:** Story 1.8 pre-flight probing of the live instance
**Scope classification:** **Moderate** — no new infrastructure, but one FR, one NFR, one epic goal
and five stories change; two stories shrink
**Status:** proposed, awaiting approval

---

## 1. Issue summary

The plan specifies that every deploy workflow reaches its target host over SSH: `scp` the compose
file, then `ssh` a sequence of `docker compose` commands. That mechanism is written into **FR19**,
into **Epic 4's goal statement**, and into **Stories 4.3, 4.8, 5.3 and 6.4**, and it is the reason
**Story 1.12** migrates `S1_SSH_*` and `S2_SSH_*` into Forgejo and **NFR7** requires a new key for
s2.

While preparing Story 1.8, live probing of the runner established that **this mechanism cannot
work on this infrastructure**, and separately that **the infrastructure to replace it already
exists**.

### Evidence — SSH from a job container is impossible by policy

Probed 2026-08-11 from inside the nested `dind` engine, i.e. from what a job container actually is:

```
ufw status                 → active,  -P INPUT DROP
22/tcp  ALLOW  81.4.156.7          # Ober home SSH
22/tcp  ALLOW  194.156.248.138     # Aleksey SSH
```

Docker subnets are not in the allow-list. A job-equivalent container times out on `10.67.0.1:22`,
`10.67.0.1:2222` and `git.crm-prionex.com:2222`. **No credential would help** — this is a firewall
policy on a shared production host, not a missing secret. Opening it would mean widening SSH
exposure on a multi-tenant production box, coordinated with the hub administrator, purely to
recreate a capability the platform already provides another way.

### Evidence — deploy runners already exist, purpose-built

`GET /orgs/CRM/actions/runners` and direct host inspection:

| Runner | id | Host | Registered labels (from `.runner` on disk) | Backing image |
|---|---|---|---|---|
| `s1-deploy-dev-preprod` | 14 | s1 | `deploy-dev-preprod`, `dev`, `preprod`, `deploy` | `deploy-base-dev-preprod:2026-08-07` |
| `s2-prod-deploy` | 17 | **s2 (PROD)** | `s2-prod-deploy` | — |

`/opt/forgejo-runner-deploy` on s1 is a mature project: a purpose-built deploy image, a
`register-runner-deploy.sh`, a `probes/` directory, and — deliberately — the host `docker.sock`
mounted, with the trade-off stated in a banner in its own compose file:

> «🚨🚨🚨 Хостовой docker.sock — см. врезку в начале файла. Это НЕ dind.»
> «Деплойный раннер получает хостовой docker.sock — риск принят»

The org also carries a matching service account, **`robot-deploy`** (alongside `robot-registry`,
whose `REGISTRY_*` secrets Story 1.8 adopted for the same reason). These runners are
**organization-scoped**, so they are already available to `CRM/fe-prionex` — the same property that
made `ubuntu-latest` a hazard makes these an asset.

### Why the platform built it this way

A deploy runner *on* the target host drives that host's own Docker daemon locally. There is no
network hop to authorize, no private key to distribute, and no inbound SSH port to expose. The
firewall policy above is not an obstacle the platform failed to solve — it is the consequence of
having solved it differently.

---

## 2. Impact analysis

### 2.1 A security improvement the plan did not anticipate

This is the strongest argument for the change, and it was not visible until now.

Story 1.13 established (D9) that the legacy `.github/workflows/CD.yml` remains executable on **497
of 501 remote branches**, and that the placeholder suppressing it has **no technical enforcement**.
Story 1.13's Dev Notes named the hazard precisely: **Story 1.12 is the story that removes the
accidental protection**, because it is the story that puts `PROD_SSH_*` / `DEV_SSH_*`-shaped
secrets into Forgejo. Until then, a legacy fallback execution cannot actually deploy, because it
has no credentials to deploy with.

**Under this proposal, that protection becomes permanent.** If deployment never uses SSH, no SSH
private key is ever placed in Forgejo, and a legacy `CD.yml` execution can never reach a server
under any circumstances — placeholder present or not. The plan's single largest standing hazard is
retired as a side effect.

### 2.2 Requirements

| Item | Impact |
|---|---|
| **FR19** (`epics.md:128-130`) | **Rewrite.** The `scp` step disappears; the sequence starts on the target host. |
| **FR20** (`epics.md:132-134`) | **No change.** The parameterized health check is unaffected by how the steps are invoked. |
| **NFR7** (`epics.md:210`) | **Narrow or cancel.** "s2 receives a new SSH key" existed to let deploys authenticate to s2. Deployment no longer authenticates to s2. Any remaining need is administrative access, not delivery — decide explicitly rather than leaving it to mean something it no longer means. |
| **Additional requirement** (`epics.md:240-241`) | **Rewrite.** "`appleboy/*` replaced with native `ssh`/`scp` in `run:` steps" becomes "deployment runs on a runner on the target host; no SSH action and no SSH client are used." |
| **Secret migration map** (`epics.md:244-245`) | **Shrink.** `S1_SSH_HOST/USER/KEY` and `S2_SSH_HOST/USER/KEY` drop out entirely. |

### 2.3 Epics and stories

| Story | Status | Impact |
|---|---|---|
| **Epic 4 goal** (`epics.md:1221`) | — | Rewrite: "native `ssh`/`scp`" → "deploy runner on the target host". |
| **1.8** | `ready-for-dev` | **Already handled.** AC4 rescoped in-story on 2026-08-11; no SSH probe. No further edit needed. |
| **1.12** | `backlog` | **Shrinks.** Two of its four AC blocks (the `S1_SSH_*` and `S2_SSH_*` clauses) are deleted. Its blast radius shrinks with them — see §2.1. |
| **4.3** | `backlog` | **AC2 rewritten.** Targets a runner label instead of connecting over SSH; the compose file arrives by checkout on the host, not by `scp`. |
| **4.8** | `backlog` | **Parameter set changes.** "target host" ceases to be an input — the runner *is* the host. It is replaced by a runner-label input. The rest (copy, `down`, fail-fast pull, `up -d`, health check, lock, Slack) is unchanged. |
| **5.3** | `backlog` | Inherits 4.8; the clause naming "native `ssh`/`scp`" is rewritten. |
| **6.4** | `backlog` | **One AC block deleted** — "authenticates with the new `S2_SSH_KEY` from Story 1.12" no longer describes anything. |
| **7.5** | `backlog` | **Simplifies.** Rotating keys that were exposed in GitHub Secrets remains sound hygiene, but it stops being a prerequisite for delivery and no longer installs anything into Forgejo. |
| **4.4** (lock) | `backlog` | **Re-examine, do not assume.** The `flock` server-side lock was designed for concurrent SSH sessions. With deploys serialized through a runner's own job slots, part of the need may be met by runner capacity — but a runner with `capacity > 1` can still run two deploys at once, so the lock is probably still required. Verify rather than delete. |

### 2.4 Technical impact

- **No new infrastructure.** The runners exist. This is adoption plus documentation, which is why
  the scope is Moderate rather than Major.
- **A dependency on shared infrastructure.** Our delivery would rest on runners this team did not
  provision. Mitigations: they are org-scoped and already serve the org; `robot-deploy` is a `CRM`
  org account; the same reasoning already applied to `REGISTRY_TOKEN_RW` in Story 1.8. **This is
  the one item needing confirmation from the hub administrator (`aleksey`) before adoption.**
- **PROD deploys would run on `s2-prod-deploy`**, a runner holding s2's host `docker.sock`. That is
  a deliberate, documented pattern here, but it should be an explicit decision, recorded — not a
  by-product of this proposal.
- **Label hygiene.** `dev`, `preprod`, `deploy`, `deploy-dev-preprod` and `s2-prod-deploy` are
  currently on Story 1.7's *forbidden* list precisely because they were believed to belong to
  another team. If adopted, that list must be amended in the same commit, or the next story will
  correctly refuse to use them.

### 2.5 A correction this investigation forces

Story 1.7 Task 1.3 recorded that `s1-deploy-dev-preprod` has **one** registered label and that its
four `GITEA_RUNNER_LABELS` values were never registered server-side. Direct inspection of
`/opt/forgejo-runner-deploy/data/runner/.runner` shows **four**, each with a full `docker://`
spec. The API's single-label report and the on-disk record disagree. `docs/migration-decisions.md#d10`
carries the incorrect version and should be corrected by changelog row, as the file's conventions
require. This does not change any decision — but Story 1.9 would inherit the wrong picture.

---

## 3. Recommended approach

**Direct adjustment.** Amend the affected requirements and stories in place. No rollback is
warranted: nothing implementing the SSH mechanism has been built. No MVP reduction is warranted:
scope is unchanged, only the mechanism.

**Rationale.** The specified mechanism is not merely inconvenient — it is blocked by a firewall
policy on a shared production host that this team does not own. The alternative is not speculative:
it is running, purpose-built, and already attached to the organization. The change also retires the
plan's largest standing hazard (§2.1) rather than deferring it.

**Sequencing.** This should land **before Story 4.3**, which is the first story to write a deploy
workflow. It does **not** block Stories 1.8, 1.9, 2.x or 3.x, none of which deploy anything.
Story 1.12 should not run until this is settled, since two of its ACs would otherwise create
credentials nothing consumes.

**Effort.** Text amendments to `epics.md` only — roughly one FR, one NFR, one requirement bullet,
one epic goal and six story sections. No code, no infrastructure.

**Risk.** Low technically; the dependency on shared infrastructure is the real exposure, and it is
the same one already accepted for the registry. The residual risk of the deploy runner holding a
host `docker.sock` is the hub's documented, accepted trade-off — but it is inherited knowingly here,
and it deserves recording in `docs/migration-decisions.md` rather than passing unremarked.

---

## 4. Detailed change proposals

### 4.1 FR19 — `epics.md:128-130`

**OLD**
```
FR19: All deploy workflows follow the sequence: scp compose file → `docker compose down`
→ `docker pull` (fail-fast, **no** fallback to `:latest`) → `docker compose up -d` →
health check.
```

**NEW**
```
FR19: All deploy workflows run on a deploy runner located on the target host and follow the
sequence: place the compose file in the stand directory → `docker compose down` →
`docker pull` (fail-fast, **no** fallback to `:latest`) → `docker compose up -d` → health
check. No step connects to the host over SSH.
```

**Rationale.** The sequence is unchanged; only its point of execution moves. The final sentence is
load-bearing — it is what keeps SSH private keys out of Forgejo (§2.1).

### 4.2 NFR7 — `epics.md:210`

**OLD**
```
NFR7: s2 receives a **new** SSH key; the old key is not revoked until Phase 8 completes, to
avoid losing access.
```

**NEW** *(decision required — see §6, question 2)*
```
NFR7: **AMENDED (2026-08-11).** Deployment no longer authenticates to s2 over SSH, so no new
deployment key is required. The old key stays authorized until Phase 8 as an administrative
access path only; its rotation is Story 7.5's concern and is not a delivery prerequisite.
```

### 4.3 Additional requirement — `epics.md:240-241`

**OLD**
```
- `appleboy/scp-action` and `appleboy/ssh-action` are replaced with native `ssh`/`scp` in
  `run:` steps rather than ported.
```

**NEW**
```
- `appleboy/scp-action` and `appleboy/ssh-action` are not ported and not replaced by an SSH
  equivalent: deployment runs on a deploy runner located on the target host, so no workflow
  performs SSH at all.
```

### 4.4 Secret migration map — `epics.md:244-245`

**OLD**
```
- Secret migration map: `REGISTRY_TOKEN` (org), `S1_SSH_HOST/USER/KEY` (repo),
  `S2_SSH_HOST/USER/KEY` (repo, new key), `SLACK_CD_WEBHOOK_URL` (org). Ports are **not**
  migrated …
```

**NEW**
```
- Secret migration map: `REGISTRY_TOKEN` (org), `SLACK_CD_WEBHOOK_URL` (org). **No SSH
  secrets are migrated** — deployment runs on the target host and needs none. Ports are
  **not** migrated …
```

### 4.5 Epic 4 goal — `epics.md:1221`

**OLD**
```
…establishes the deployment mechanics that Epics 5 and 6 reuse: parameterized compose,
native `ssh`/`scp`, fail-fast pull, parameterized health check, Slack via `curl`, and the
server-side lock.
```

**NEW**
```
…establishes the deployment mechanics that Epics 5 and 6 reuse: parameterized compose,
execution on a deploy runner located on the target host, fail-fast pull, parameterized health
check, Slack via `curl`, and the server-side lock.
```

*(The same phrase appears at `epics.md:368` in the Epic 4 implementation note and takes the same
edit.)*

### 4.6 Story 4.3 — AC2, `epics.md:1301-1304`

**OLD**
```
**Given** the deploy runs
**When** it connects to s1
**Then** it uses native `ssh` and `scp` in `run:` steps
**And** no `appleboy/scp-action` or `appleboy/ssh-action` is used.
```

**NEW**
```
**Given** the deploy runs
**When** the workflow declares `runs-on`
**Then** it targets the deploy runner located on s1 by its label
**And** the compose file reaches the stand directory without leaving the host
**And** no SSH client, `appleboy/scp-action` or `appleboy/ssh-action` appears in the workflow.
```

**Rationale.** "Connects to s1" is no longer meaningful — the job already *is* on s1. The third
clause states positively what replaces `scp`, so the AC cannot be closed by a workflow that quietly
reintroduces a network hop.

### 4.7 Story 4.8 — third AC block, `epics.md` "Given the shared definition"

**OLD**
```
**Then** target host, stand directory, container name, port, environment label and image tag
are all inputs
```

**NEW**
```
**Then** deploy-runner label, stand directory, container name, port, environment label and
image tag are all inputs
**And** no target host is passed, because the runner label determines the host
```

### 4.8 Story 5.3 — the shared-definition AC block

**OLD**
```
**Then** it consumes the shared deploy definition from Story 4.8 rather than copying its
steps — native `ssh`/`scp`, compose copy, `down`, fail-fast pull, `up -d`, parameterized
health check
```

**NEW**
```
**Then** it consumes the shared deploy definition from Story 4.8 rather than copying its
steps — compose placement, `down`, fail-fast pull, `up -d`, parameterized health check —
running on the deploy runner located on s1
```

### 4.9 Story 6.4 — delete the SSH AC block, `epics.md:1832-1835`

**OLD**
```
**Given** the deploy targets s2
**When** it connects
**Then** it authenticates with the new `S2_SSH_KEY` from Story 1.12
**And** the previous key remains authorized on s2 throughout, so access cannot be lost.
```

**NEW**
```
**Given** the deploy targets s2
**When** the workflow declares `runs-on`
**Then** it targets the deploy runner located on s2 by its label
**And** no SSH credential is used, so production access cannot be lost by a key change.
```

### 4.10 Story 1.12 — delete two AC blocks

Delete the `S1_SSH_HOST/USER/KEY` block and the `S2_SSH_HOST/USER/KEY` block in full. Add:

```
**Given** deployment runs on the target host under FR19
**When** the secret set is reviewed
**Then** no SSH secret of any kind is created in Forgejo
**And** the rationale is recorded: a legacy `.github/workflows/CD.yml` execution can then
never reach a server, which makes D9's suppression permanent rather than procedural.
```

### 4.11 Story 1.7's forbidden-label list

`docs/migration-decisions.md#d10` and Story 1.7's prohibitions list `dev`, `preprod`, `deploy`,
`deploy-dev-preprod` and `s2-prod-deploy` as labels never to emit. If this proposal is approved,
those labels become **the intended deploy targets**. Amend by changelog row in the same commit —
otherwise Story 4.3 will correctly refuse to use them.

### 4.12 The D10 label correction

Record by changelog row that `s1-deploy-dev-preprod` carries four registered labels on disk
(`deploy-dev-preprod`, `dev`, `preprod`, `deploy`, all on `deploy-base-dev-preprod:2026-08-07`),
not the single label Story 1.7 recorded, and that the API's report disagrees with the runner's own
`.runner` file. Note which source is authoritative — or mark it «не проверено» if that cannot be
established without touching another team's runner.

---

## 5. Implementation handoff

**Scope: Moderate.** No new infrastructure and no code, but requirement-level edits and six story
sections — beyond a developer's direct implementation, short of a replan.

**Route to:** Product Owner / Developer for the `epics.md` amendments; Oleg for the two decisions
in §6.

**Deliverables**
1. `epics.md` amended per §4.1–§4.10.
2. A `docs/migration-decisions.md` entry recording the deployment-mechanism decision, its rationale,
   the accepted `docker.sock` trade-off on the deploy runners, and the D9 consequence — plus the
   changelog rows for §4.11 and §4.12.
3. `deferred-work.md` updated: close the Story 1.8 entry that raised this.

**Success criteria**
- No occurrence of `ssh`, `scp` or `appleboy` remains in `epics.md` as a *deployment mechanism*.
  (Occurrences describing legacy `CD.yml`, GitHub-side history, or Story 7.5 key rotation stay.)
- `epics.md` names no SSH secret in the migration map.
- Story 4.3 can be written without a hard stop.
- The forbidden-label list and the intended deploy labels do not contradict each other.

---

## 6. Decisions required before this is approved

1. **Are the platform's deploy runners ours to use?** Same question, and the same answer path, as
   `REGISTRY_TOKEN_RW` in Story 1.8: confirm with `aleksey`. If the answer is no, this proposal
   changes from *Moderate/adopt* to *Major/provision*, and Epic 4 gains a runner-provisioning story
   — including one on **s2 (PROD)**, which Epic 1 deliberately avoided for the build runner.
2. **NFR7 — narrow or cancel?** §4.2 proposes narrowing it to administrative access. Cancelling it
   outright is also defensible, in the style already used for FR34. This is a judgement about what
   the s2 key is *for* once it stops being a delivery credential.
3. **Is PROD deployment via a runner holding s2's `docker.sock` accepted?** It is the hub's
   documented pattern and the only way this model reaches production — but it deserves an explicit
   yes, recorded, rather than arriving as an implication of a mechanism change.
