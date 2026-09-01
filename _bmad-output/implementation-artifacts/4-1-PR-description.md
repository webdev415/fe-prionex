# Story 4.1 — Parameterize the Compose File for Coexisting Stands

**Branch:** `story-4-1/pr-1-context` → `main`
**Commits:** `cf0d0c71` (context) · `e74e9ded` (implementation) · `e0395fda` (review round 1)

---

## 🔴 Per retro action E5, Story 4.1 is code-reviewed BEFORE Story 4.2 is written

This story is Epic 4's foundation — Stories 4.2, 4.3, 4.8 and Epics 5 and 6 all consume what this
file becomes. Epic 2 closed with three stories unreviewed and three later stories built on their
unverified claims. **Review round 1 has already run (Opus, adversarial) and is included in this PR;
it returned CHANGES REQUIRED with ten findings, all applied.** Story 4.2 stays unwritten until this
merges.

## What changed

Five stand-identity axes become **required variables with no defaults** —
`COMPOSE_PROJECT_NAME`, `CONTAINER_NAME`, `FRONTEND_PORT`, `DOCKER_IMAGE`, `FRONTEND_NETWORK`. Every
`:?` message names the variable **and** where the operator sets it.

**They land in a new `docker-compose.stand.yml`. `docker-compose.server.yml` is untouched — not one
byte.**

## 🔴 Why a new file: Task 1.4 returned verdict (b)

`.github/workflows/CD.yml` copies `docker-compose.server.yml` **from the repo** onto the legacy stand
on every deploy (`:154-162`) and force-removes the container by literal name (`:201`) before `up`. A
fail-closed file arriving there, where the `.env` holds only two variables, means: `down` fails on
interpolation and is swallowed → the container is force-removed → `up` fails on the same
interpolation. **The legacy stand is down and stays down** — an NFR5 violation reached by doing
exactly what the epic asks.

Whether that path can still deliver the file **could not be settled**:

- ✅ single remote → Forgejo, no `pushurl`, no mirror or sync workflow anywhere in the repo
- 🔴 `/api/v1/repos/CRM/fe-prionex/push_mirrors` and the repo endpoint both return **HTTP 403**
  (`"Only signed in user is allowed to call APIs."`) — no token on this machine, no ssh alias for s1
  where the tokens are host-local

**The mirror config was never read as absent — the request failed on auth.** Under this project's
standing finding that an empty result is not evidence of safety, that resolves to "live." The
asymmetry settles it: cost of the new file is one rename in Story 4.9; cost of a wrong (a) is the
legacy stand down with no rollback path in this repository.

**This is a recorded deviation from FR25** (D27), raised as a blocking Open Question rather than
decided away.

## ✅ Answered — «GitHub не трогаем» (Oleg, 2026-08-19)

D7 becomes a **standing directive** rather than an inferred constraint, and **verdict (b) is
permanent**. The escape hatch — "if no mirror exists, collapse back to an in-place edit" — is closed,
because using it would require *knowing* the mirror does not exist, and the directive removes the
means of finding out.

🔴 **Story 4.9 inherits the hazard unchanged.** The cutover *is* the act of renaming, replacing or
deleting `docker-compose.server.yml` — the exact file `CD.yml:154-162` copies onto the legacy stand,
with `:201` still force-removing the container by literal name beforehand. Same NFR5 exposure, and by
then it will be just as unverifiable. **4.9 must plan the cutover assuming the path is live:**
converge the two files only after the legacy stand is decommissioned or provably no longer deployed
to — never as a file rename in the repository.

## AC3 — the image default is removed, not repointed

`latest` was cancelled outright (D20 §4), `build.yml` sets `PUSH_LATEST=false` so the pipeline never
publishes it, and under Option C one commit yields up to three per-environment images. No single
default is right for three environments.

## Evidence

**Retro E5 — seven-row guard matrix, run live, zero CI runs.** All five guards fire on the right
variable with the right message. Row 4 proves no `8080` fallback and row 5 no `:latest` fallback —
by the render never completing, not by assertion.

**Row 7 (discriminating) proved more than it was asked to:** against a network that does not exist,
`docker compose config` renders at **exit 0** and only `up` refuses. **`config` is blind to network
existence** — a gate built on it passes a stand that cannot start. Handed to Stories 4.3 and 4.8.

**AC5** — two stands observed distinct on all five axes from `docker compose ls` / `docker ps` /
`docker inspect`, not inferred from the `.env`.

**AC4 — "which backend does it reach", the clause that does not accept "it started".** Fake Kong on
one of two networks: alpha resolves `crm-kong-gateway` → `172.19.0.3`; beta gets `NXDOMAIN` **while
reporting `healthy` and serving 200**. The silent-failure mode of §4 demonstrated, not asserted —
the artifact 4.2 and 5.1 inherit.

## Review round 1 — the finding worth reading

`CONTAINER_NAME=CHANGE_ME` was a **valid Docker container name**. The template claimed "no working
values"; the stand started, healthy, serving 200, named `CHANGE_ME`. The other four placeholders
refused only by accident of unrelated grammars. And `CONTAINER_NAME` is the one variable a
copy-run-fix loop never reaches — Story 4.2 would have provisioned s1 with a container named
`CHANGE_ME`, and Story 4.3's FR20 health check reads `CONTAINER_NAME` from that same `.env` and would
have **passed** it. Fixed to `<CHANGE_ME>` so invalidity is the mechanism, not a coincidence.

Also caught: four more stale `8081`s — including `preprod-infrastructure-requirement.md`, **the
document Story 5.2 reads**, in bold under a heading asserting the very claim that was measured false.

**And a bypass no guard can close:** compose reads the process environment **before** `--env-file`, so
an exported `FRONTEND_PORT` silently overrides the stand's `.env`. Compose behaviour, not a defect —
but §8 convention 1 pushes Story 4.3 straight at it, so it is handoff item 5.

## 🔴 Run ledger — OPEN

Declared before the first implementation push (5 pushes attributable to this story, including one
already spent before the ledger existed). **Closed OPEN, in those words**, per D4's second branch: no
Forgejo API credential is reachable from a dev machine. Stated in advance in Task 2.4, not discovered
at close. **No self-reported number is offered** — that was the exact defect in every Epic 3 ledger.

This is now the second story to hit the credential wall, and it is structural: every remaining Epic
4-6 story will close OPEN by construction unless a read-only `action_run` query path exists from a
dev machine. Recorded in `deferred-work.md` as a process decision worth making once.

## Limits, stated as limits

- Everything local is bound to **compose v5.3.0**. **s1's version is unread — Story 4.2 confirms it.**
- Task 6 used a **fake Kong on local bridge networks** with `nginx:alpine` standing in for the real
  image. It proves the mechanism, not that `crm-kong-gateway` is present on s1 today.
- 🔴 **Absence of the alias on s1 is a STOP, not a fallback to `crm-network`.**
- The guards test presence. A **wrong-but-valid** value is caught by nothing, and on the network axis
  that failure is silent.
