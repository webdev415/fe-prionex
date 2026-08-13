# Sprint Change Proposal — secrets move to OpenBao, and Story 1.12 is mostly already done

**Date:** 2026-08-13
**Trigger:** Oleg's decision to adopt the `CRM/PRIONEX_HUB` OpenBao AppRole pattern, taken after
Story 1.11's implementation surfaced an entire secrets-management system the plan never mentions.
**Mode:** batch.
**Scope classification:** **Moderate** — one story rewritten, three FRs amended, one new
cross-team dependency, no epic reordering.

---

## 1. Issue Summary

Story 1.12 ("Migrate Secrets and Variables into Forgejo") was written on the assumption that
migration means *creating* organization secrets in Forgejo. Two facts found on the instance while
implementing Story 1.11 invalidate that assumption from opposite directions.

**The work is mostly already done — by the platform, before we arrived.** Read from the instance
on 2026-08-12:

```
CRM (org-level secrets):  REGISTRY_TOKEN_RW   REGISTRY_TOKEN_RO   REGISTRY_USER
                          REGISTRY_USER_RO    SLACK_CD_WEBHOOK_URL
CRM (variables):          FRONTEND_PORT — absent
```

Story 1.12's AC1 asks for `REGISTRY_TOKEN` and `SLACK_CD_WEBHOOK_URL` at organization scope: both
exist, under the amended names recorded in D14. Its AC4 asks that `FRONTEND_PORT` be absent from
variables: it is absent. Its SSH-secret ACs were already deleted by the 2026-08-11 amendment to
FR19. **Run the story as written and it would report creating things that are there** — the same
failure mode Story 1.10's review caught when `ci-bot` turned out never to have existed.

**The platform runs a secrets manager, and two incompatible patterns are live on one instance.**
`forgejo-openbao` (OpenBao 2.6.1) runs on s1. Neither it nor any of this appears anywhere in the
plan:

| owner | pattern |
|---|---|
| `CRM/PRIONEX_HUB` | Forgejo holds only bootstrap AppRole credentials — `OPENBAO_ADDR`, `OPENBAO_{DEV,PREPROD,PROD}_ROLE_ID`, `…_SECRET_ID`; application secrets are read from OpenBao at run time |
| `Telecom/aggressive_dialer`, org `Infra` | same shape under the older `VAULT_ROLE_ID` / `VAULT_SECRET_ID` names |
| `CRM/api-prionex` | **no OpenBao at all** — fifteen production secrets sit directly in Forgejo repo secrets: `PREPROD_JWT_SECRET`, `PREPROD_POSTGRES_PASSWORD`, `PREPROD_ENCRYPTION_KEY_VERSIONS`, `PREPROD_DOCUMENT_ENCRYPTION_KEY`, `PREPROD_KONG_PG_PASSWORD` and others |

Leaving this unstated would have produced a third pattern by accident. **Oleg's decision, 2026-08-13:
`fe-prionex` follows `PRIONEX_HUB`.**

**Recording the disagreement, because the decision overrode a recommendation.** The recommendation
was the `api-prionex` shape, on the grounds that the frontend consumes exactly one credential — the
registry token — which already lives in org secrets, so an AppRole chain adds a dependency for
nothing. Reading the hub's workflows changed the balance and the decision looks better than the
recommendation:

- The hub's AppRole login is built with `jq -n` and piped into `bao write auth/approle/login -` on
  **stdin**, specifically so `role_id` and `secret_id` never appear in `argv` where `/proc` exposes
  them host-wide.
- The OpenBao token is `::add-mask::`-ed and `unset` immediately after the KV read.
- Key names returned from OpenBao are validated before export, rejecting
  `PATH|LD_PRELOAD|LD_LIBRARY_PATH|IFS|BASH_ENV|ENV|SHELLOPTS|BASHOPTS|HOME|TMPDIR|DOCKER_CONFIG|DOCKER_HOST|BAO_*|VAULT_*|GITHUB_*`
  — with an inline note that a crafted secret value **did** hijack `PATH` to `/tmp/pwned` in a live
  incident.
- Secrets never touch disk; there is no `mktemp` scratch file. Registry credentials reach `curl`
  only through `-K -`.

That is hardening bought with someone else's incident. Inheriting it is worth more than the
dependency costs.

**One thing the decision does not change, and it should be said plainly:** the frontend has no
application secrets. The six `VITE_*` values are public URLs baked into a bundle that any visitor
can read in devtools. Storing them in OpenBao buys uniformity with the neighbours and a working
chain for when the frontend does acquire a real secret. It does not buy confidentiality. The story
must not claim otherwise.

---

## 2. Impact Analysis

### Epic impact

- **Epic 1** — Story 1.12 rewritten. No other story affected. Epic 1 still closes after it.
- **Epic 4** — a standing open question is partly answered; see §3.
- **Epics 5 and 6** — every deploy workflow gains an OpenBao step. Shape is fixed by this proposal
  so the later stories inherit it rather than each inventing one.

### Story impact

| Story | Change |
|---|---|
| **1.12** | Rewritten. AC1 and AC4 are already satisfied and become *verification* rather than creation. SSH ACs already gone. New: AppRole bootstrap secrets, KV layout, and a platform-team dependency. |
| 3.3 | Unchanged in substance — but the `VITE_*` values move from Forgejo repository variables to an OpenBao KV path, so its "matching repository variables" wording needs a pointer. |
| 4.3, 5.2, 6.4 | Each deploy workflow acquires the OpenBao read step. |

### Artifact conflicts

- `epics.md` — Story 1.12 body, FR18/FR31 (see §4), Story 3.3's variable reference.
- `docs/migration-decisions.md` — decision record for the pattern choice.
- `docs/forgejo-migration.md` — the secrets section predates all of this.

### Technical impact

- New runtime dependency for every deploy workflow: `bao` CLI must be present on the deploy runner,
  and `OPENBAO_ADDR` must be reachable from it.
- New failure mode: an expired or revoked `secret_id` fails every deploy for that environment at
  once. The hub's AppRole secret IDs have a TTL; ours will too. Nothing in the plan currently
  monitors credential expiry.

---

## 3. The runner finding, and what it does *not* prove

While reading the hub's workflows the runner table was checked. Online as of 2026-08-13 08:02:

```
id 17 | s2-prod-deploy        | CRM   | org-scoped         | ["s2-prod-deploy"]
id 14 | s1-deploy-dev-preprod | CRM   | org-scoped         | ["deploy-dev-preprod"]
id 13 | s2-prod               | —     | CRM/PRIONEX_HUB    | ["s2"]
```

The 2026-08-11 deploy-runner proposal already recorded that deploy runners exist and left an open
question: *"Are the platform's deploy runners ours to use?"* This evidence **does not close it**,
and the distinction matters:

- `promote-prod.yml` uses `runs-on: s2` — runner id 13, which is **repo-scoped to
  `CRM/PRIONEX_HUB`**. The hub does not use the org-scoped runners.
- The org-scoped `s2-prod-deploy` and `s1-deploy-dev-preprod` are online, but there is no evidence
  of who uses them or on whose authority.

**What is now established:** deploying to a production host from a runner *on that host* is not a
theory here — another `CRM` team does it in production today, and does it with a **repo-scoped**
runner.

**Recommendation, revised on that basis:** Epic 4 and Epic 6 should provision **our own
repo-scoped deploy runners**, mirroring the hub, rather than adopting the org-scoped ones. This
keeps Story 1.7's AC2 posture intact (our runners are repo-scoped, never at org level), removes a
silent dependency on another team's resource, and follows a pattern already proven on this
platform. The 08-11 proposal's fallback — *"the change becomes Major/provision and Epic 4 gains a
runner-provisioning story"* — is the branch we should take, deliberately rather than by default.

---

## 4. Detailed Change Proposals

### 4.1 Story 1.12 — rewritten

**Title:** ~~Migrate Secrets and Variables into Forgejo~~ → **Wire the Frontend to OpenBao and
Verify What the Platform Already Provides**

**AC1 (rewritten — verification, not creation)**
> **Given** the `CRM` organization already holds `REGISTRY_TOKEN_RW`, `REGISTRY_TOKEN_RO`,
> `REGISTRY_USER`, `REGISTRY_USER_RO` and `SLACK_CD_WEBHOOK_URL`
> **When** the secret inventory is reviewed
> **Then** each is confirmed present and its scope recorded
> **And** nothing is created that already exists
> **And** it is recorded that `REGISTRY_TOKEN_RW`/`_RO` themselves remain **«не проверено»** —
> Story 1.10 exercised minted equivalents of the same scope, not these secrets.

**AC2 (new — AppRole bootstrap)**
> **Given** the `PRIONEX_HUB` pattern
> **When** `fe-prionex` repository secrets are created
> **Then** `OPENBAO_ADDR`, `OPENBAO_DEV_ROLE_ID`, `OPENBAO_DEV_SECRET_ID`,
> `OPENBAO_PREPROD_ROLE_ID`, `OPENBAO_PREPROD_SECRET_ID`, `OPENBAO_PROD_ROLE_ID` and
> `OPENBAO_PROD_SECRET_ID` exist at **repository** scope
> **And** no AppRole credential is created at organization scope.

**AC3 (new — KV layout)**
> **Given** the hub uses `secret/hub/{dev,pre-prod,prod}/app`
> **When** the frontend's paths are created
> **Then** they are `secret/fe/{dev,pre-prod,prod}/app`
> **And** each holds `VITE_API_BASE_URL` and `VITE_WS_URL` for that environment
> **And** it is recorded that these values are **not confidential** — they are baked into a public
> bundle — and live in OpenBao for uniformity with the platform, not for secrecy.

**AC4 (new — the read step is inherited, not invented)**
> **Given** the hardening in `PRIONEX_HUB`'s deploy workflows
> **When** the frontend's OpenBao read step is written
> **Then** it reproduces: AppRole login via `jq -n` piped to `bao write … -` on **stdin** (never
> `argv`), `::add-mask::` on the token, `unset BAO_TOKEN` after the KV read, key-name validation
> rejecting `PATH`/`LD_*`/`IFS`/`BASH_ENV`/`DOCKER_*`/`BAO_*`/`VAULT_*`/`GITHUB_*`, and no secret
> written to disk
> **And** each measure carries a comment naming what it prevents
> **And** any deliberate deviation from the hub's version is recorded with its reason.

**AC5 (retained from the original)**
> `FRONTEND_PORT` is absent from Forgejo variables — **confirmed already true** — and the rationale
> (no duplicated state; ports live in per-stand server `.env`) is recorded.

**AC6 (new — the dependency is named, not assumed)**
> **Given** the AppRole, its policy and the KV paths must be created inside OpenBao
> **When** the story starts
> **Then** the owner of that work is named and the request is recorded as sent
> **And** if it has not been fulfilled, the story records the absence explicitly rather than
> proceeding on a placeholder.

### 4.2 FR31 — same defect as FR18, same fix

> FR31: `[C]` The commit currently running in PROD is … rebuilt into the Forgejo registry under
> `sha-<commit>` and `prod-current` …

`sha-<commit>` is expired by the retention rule at 14 days. **Amend to `sha-<commit>`,
`prod-current` and `prod-<sha>`**, consistent with the FR18 amendment made the same day.

### 4.3 Story 3.3 — pointer only

Its ACs reference "the matching repository variables created in Story 1.12". Under this proposal
the `VITE_*` values live in OpenBao, not in repository variables. Reword to point at
`secret/fe/{env}/app`.

---

## 5. Implementation Handoff

**Scope: Moderate.** One story rewritten in place, two FRs amended, one story reworded, one new
cross-team dependency. No epic reordering, no rollback of completed work.

| Recipient | Deliverable |
|---|---|
| **Dev agent** | Apply §4.1–§4.3 to `epics.md`; record the decision in `docs/migration-decisions.md`; then `create-story` for the rewritten 1.12. |
| **Oleg** | Name the owner of the OpenBao AppRole/policy/KV work and send the request. This is a hard stop for AC2, AC3 and AC6 — the same shape of external dependency as Story 1.6. |

**Success criteria**

1. Story 1.12 creates nothing that already exists, and says so where it verifies instead.
2. The OpenBao read step is demonstrably the hub's, with deviations recorded.
3. The story does not claim the `VITE_*` values are secret.
4. If the AppRole does not arrive, the story records the absence rather than inventing a placeholder.

**Open question carried forward:** AppRole secret IDs have a TTL. Nothing in the plan monitors
credential expiry, and an expired `secret_id` fails every deploy for that environment at once.
Belongs in Epic 7's documentation at minimum, and probably needs an owner before PROD depends on it.
