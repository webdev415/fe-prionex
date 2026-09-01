# Sprint Change Proposal — PRE-PROD is built; the plan's names for it are wrong

**Date:** 2026-08-15
**Raised by:** the code review of Story 1.6 — the last Epic 1 story that had never been reviewed
**Status:** accepted, applied the same day

---

## 1. What this changes

Two things, and the second is the expensive one.

1. **Epic 5 is not blocked.** The PRE-PROD contour the plan has been waiting for is **built and
   running**. Four artifacts still say we are waiting.
2. **The hostname and the port the plan specifies for PRE-PROD do not exist.** Both flow into an
   image at build time. Corrected here against measurement.

## 2. What is actually running on s1, measured 2026-08-15

Read-only, first-hand, on `root@10.67.0.1`:

| thing | state |
|---|---|
| `crm-preprod-network` | ✅ exists, **69 containers** |
| `crm-preprod-kong-gateway` | ✅ running, aliases `["crm-preprod-kong-gateway", "kong", "crm-kong-gateway"]` |
| the alias Story 1.6 asked for | ✅ **delivered** — `crm-kong-gateway`, plus a deploy-blocking runtime check on their side |
| `api.crm.preprod.crm-prionex.online` | ✅ resolves to `185.185.49.127`, nginx vhost, Let's Encrypt cert |
| `crm.preprod.crm-prionex.online` (frontend) | ⚠️ **resolves, but no vhost and no certificate** |
| `preprod.crm-prionex.online` | ❌ **NXDOMAIN** |
| `api.preprod.crm-prionex.online` | ❌ **NXDOMAIN** |
| port `8081` on s1 | ❌ **TAKEN** — `docker-proxy` on `127.0.0.1:8081` |
| ports `8080`, `8082`–`8085` | ✅ free |
| CORS on the PRE-PROD Kong | ⚠️ configured, with origin `http://localhost:8320` |

## 3. 🔴 The two wrong values, and why they are worse than a typo

**The hostname is off by one segment.** The plan asks for `api.preprod.crm-prionex.online`; what
exists is **`api.crm.preprod.crm-prionex.online`**. The real name appears in **zero** files in this
repository — `grep -rl "api\.crm\.preprod" docs/ _bmad-output/` returns nothing. The wrong one
appears in the requirement document and in D11.

**The port is taken.** `epics.md` calls `8081` a permanent allocation (FR25) and hard-codes it into
Story 5.2's AC. It is bound.

**Why this is not cosmetic.** Under Option C, `VITE_API_BASE_URL` is **baked into the bundle at
build time**. The chain is: this plan → `secret/fe/pre-prod/app` (D15) → `VITE_API_BASE_URL_PREPROD`
→ `--build-arg` → a PRE-PROD image whose JavaScript points at a hostname that does not resolve. The
build succeeds. The image is valid. It fails in a browser, at the only moment anyone would look.

**That is the exact failure class Story 1.6 was written to prevent** — reproduced one layer up. 1.6
caught the Kong container-name collision because it *measured* the neighbours' compose file. It did
not measure their DNS, and their DNS follows a different convention than the legacy stands it
extrapolated from.

## 4. The lesson Story 1.6 recorded, and the one it should have

1.6's closing lesson is *"a document in `docs/` is not a submitted requirement"*. That framing did
not survive contact: **the requirement was never formally sent, and it worked anyway.** The
counterparty read it, delivered the alias, and brought up the whole contour. There is no external
team with a queue — the 2026-08-13 change proposal already recorded that the "platform team" is an
agent working a sibling repository on the same instance, and Story 1.6 never absorbed it.

**The real lesson, which the 13.08 proposal found by accident and nobody generalised:** *measure the
counterparty's conventions before writing the ask, not after.* It was done for the container name
and the collision was caught. It was not done for the hostnames, and they are wrong for exactly the
same reason.

## 5. Amendments

**FR25** — `PRE-PROD (8081)` → **`PRE-PROD (8083)`**. `8081` is taken by `vm-cadvisor`'s docker-proxy;
`8082` is already DEV's in the same FR; `8083` is free and adjacent. Measured, not chosen for looks.

**Story 1.6, AC2 and AC4** — the DNS name and the port they specify are corrected to what exists.
The original values are recorded as a deviation rather than deleted, because the *reason* they were
wrong is the finding.

**Story 5.1** — its first two ACs (a network under the agreed name; a Kong attached to it) are
**already satisfied by the other side**. They become verification rather than construction.

**Story 5.2** — `FRONTEND_PORT=8081` → `8083`; the frontend hostname is
`crm.preprod.crm-prionex.online`, and it needs an nginx vhost and a certificate, which is the one
piece of PRE-PROD infrastructure that genuinely does not exist yet.

**Epic 5's blocked note** — removed. It named the alias as the blocker; the alias is live.

**Story 1.12 / D15** — the `secret/fe/pre-prod/app` placeholder must carry
`https://api.crm.preprod.crm-prionex.online`, not the NXDOMAIN name.

## 6. What genuinely remains for PRE-PROD

Much smaller than "blocked on a naming agreement":

1. **A frontend vhost and certificate** for `crm.preprod.crm-prionex.online`. The name resolves;
   nginx has vhosts only for the two **API** names. This is Story 5.2's.
2. **A free host port** — `8083`.
3. **CORS on the PRE-PROD Kong** currently allows `http://localhost:8320`, which is not the frontend
   origin. ⚠️ *Configured wrong is worse than unconfigured*: it looks done and fails only in a
   browser. Needs the real origin once the frontend name is serving.

## 7. What is NOT changed

- **D11 is not edited.** Its own rule says the record stands and the journal gets a row; it was
  correct when written, and the ask it describes is what was actually asked. Changelog rows are
  appended instead.
- **Story 1.6's ACs are amended, not its history.** The requirement document keeps its wrong values
  struck through, because the artifact is evidence of how the error happened.
- **No infrastructure was touched.** Everything in §2 is read-only observation. The frontend vhost,
  the certificate and the CORS origin are work, and they belong to Story 5.2, not to this proposal.
