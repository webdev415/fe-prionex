---
baseline_commit: 3ace40de
---

# Story 4.1: Parameterize the Compose File for Coexisting Stands

Status: review

> **This story edits 36 lines. The risk is not the edit — it is who else reads that file.**
>
> `docker-compose.server.yml` is not only ours. The legacy GitHub `CD.yml` **copies this exact file
> from the repository onto the legacy stand on every deploy** (`CD.yml:154-162`), into a single fixed
> directory, and then runs `docker rm -f fe-prionex` (`:201`) before bringing it up. A
> parameterization that fails closed — which is what every AC below asks for — lands on that stand as
> a stand that will not start, **after** its container has already been force-removed.
>
> 🔴 **Task 1 settles whether that path can still deliver this file, by evidence, before Task 3
> changes a byte.** `git remote -v` in this working copy points at Forgejo only, which is a reason to
> suspect the path is dead — it is not proof, and this project's standing finding is that an empty
> result is not evidence of safety.
>
> **This is Epic 4's first story and Epic 4's foundation.** Stories 4.2, 4.3 and 4.8 and Epics 5 and 6
> all consume what this file becomes. Retro action **E5** applies literally: this story is code-
> reviewed before Story 4.2 is written.

---

## Story

As a developer,
I want the compose file to describe any stand rather than one hardcoded stand,
So that DEV, PRE-PROD and the legacy stand can run side by side on the same host.

---

## What you are changing, in one screen

| # | Change | Where | Why |
|---|--------|-------|-----|
| 1 | Settle whether the legacy GitHub `CD.yml` path can still deliver this file to the legacy stand | evidence, no code | §2 — this decides *whether* change 3 happens in place |
| 2 | Declare the run budget **before** any push | story file | §7, retro action **D4** |
| 3 | Project name, container name, published port, image and network all become required variables | `docker-compose.server.yml` | AC1–AC4 |
| 4 | Prove each guard fires, one outcome per branch, plus a discriminating case | local `docker compose config` | §6, retro action **E5** |
| 5 | Bring two stands up side by side and prove no collision on any axis | local Docker | AC5 |
| 6 | Record **which backend each stand actually reaches**, from inside the container | evidence | AC4 as amended 2026-08-13 |
| 7 | Ship a stand `.env` template so Story 4.2 has something to copy | new file | §3, §5 |
| 8 | Close the ledger **against a query**, not from memory | evidence | §7, **D4** |

---

## 🚨 Read this before anything else

### 1. The live state of the file, bound at `3ace40de`

Read from the working tree on 2026-08-19, not from the plan. The epic's line numbers are still
accurate — verify that before trusting them anyway.

```yaml
 1  # Frontend - Unified Server Deployment
 2  # Usage: docker compose -f docker-compose.server.yml --env-file .env up -d
 3
 4  name: fe-prionex
 5
 6  services:
 7    frontend:
 8      image: ${DOCKER_IMAGE:-ghcr.io/crm-prionex/fe-prionex:latest}
 9      container_name: fe-prionex
10      ports:
11        - "${FRONTEND_PORT:-8080}:80"
12      networks:
13        - crm-network
14      restart: always
15      healthcheck:
16        test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://127.0.0.1:80"]
17        interval: 30s
18        timeout: 10s
19        retries: 3
20        start_period: 10s
21      deploy:
22        resources:
23          limits:
24            memory: 256M
25          reservations:
26            memory: 128M
27      logging:
28        driver: "json-file"
29        options:
30          max-size: "10m"
31          max-file: "3"
32
33  networks:
34    crm-network:
35      external: true
36      name: crm-network
```

**Five identity axes. Four are fixed literals; the fifth has a default that is worse than a literal.**

| Axis | Current value | Line | Parameterized today? | Collides if two stands run? |
|---|---|---|---|---|
| Compose project | `fe-prionex` | 4 | no | yes |
| Container name | `fe-prionex` | 9 | no | yes |
| Published host port | `${FRONTEND_PORT:-8080}` | 11 | yes, but the default is another stand's port | yes, silently |
| Image | `${DOCKER_IMAGE:-ghcr.io/…:latest}` | 8 | yes, but the default is a `ghcr` tag this pipeline never publishes | not a collision — a wrong-artifact deploy |
| External network | `crm-network` | 13, 34-36 | no — hardcoded twice, and `name:` defeats project prefixing | yes, and **silently**, see §4 |

There are **no named volumes** in this file, so there is no volume axis to parameterize. Do not
invent one.

**Container-side port 80 is fixed in three places and is NOT part of this story:** `nginx.conf:2`
(`listen 80`; the story originally cited `:1`, which is `server {`), `Dockerfile.prod:59` (`EXPOSE 80`), and the healthcheck at line 16. Only the host side
of the mapping is variable. Changing the container side would require rebuilding the image and would
break the byte-identical-image property Epic 6's promotion model depends on.

**Also in the repo and relevant:**

- `docker-compose.yml` (local dev) declares the **same project name** `name: fe-prionex` with
  `container_name: fe-prionex-dev`. A `docker compose down` run in the repository root with the
  default file can therefore adopt the server project. Worth knowing before you run local
  experiments in this directory (§ Task 5 tells you how to avoid it).
- `docs/runners/docker-compose.yml` is a **record of the runner host**, deliberately renamed to
  `forgejo-runner-fe-prionex-RECORD` so nobody can `down` the live runners with it. It is not the
  app and it is not in scope.

### 2. 🔴 The blast radius — and the one question Task 1 must answer before Task 3 runs

`.github/workflows/CD.yml` is the legacy deploy. It is GitHub Actions, it triggers on
`push: [main, development]` and `workflow_dispatch`, and it does this:

| Line | What it does | Why it matters here |
|---|---|---|
| 154-162 | `appleboy/scp-action` copies `docker-compose.server.yml` **from the repo** to `~/crm-prionex/fe-prionex/` | the legacy stand's compose file **is** this file, refreshed on every deploy |
| 162 | target is one fixed directory for every stand — no per-stand suffix | FR26's separated directories do not exist on this path |
| 181-182 | `COMPOSE_FILE="docker-compose.server.yml"`, `ENV_FILE=".env"` | the legacy `.env` is whatever is on the host — see below |
| 185 | `docker network create crm-network 2>/dev/null \|\| true` | **destroys the protection `external: true` provides** — see §4 |
| 200 | `docker compose -f $COMPOSE_FILE down --remove-orphans 2>/dev/null \|\| true` | errors are swallowed |
| 201 | `docker rm -f fe-prionex 2>/dev/null \|\| true` | force-removes by **literal name**, independent of any compose project |
| 233 | fallback health probe hardcodes `curl http://localhost:8080` | ignores `FRONTEND_PORT` entirely |

**The concrete failure, spelled out because it is not hypothetical if the path is live.** Suppose
this story makes every variable required (`${VAR:?…}`) and that file reaches the legacy stand, whose
`.env` — per `.env.dev.example` — holds only `DOCKER_IMAGE` and `FRONTEND_PORT`:

1. line 200's `down` fails on interpolation → swallowed by `|| true`;
2. line 201 force-removes the container **by name** → the legacy stand is now down;
3. line 206's `up -d` fails on the same interpolation → the deploy is red and the stand stays down.

That is a direct **NFR5** violation ("existing DEV and PROD stands remain fully operational and
untouched throughout"), reached by a change to a file this story is instructed to change.

**What is known, and what is not:**

- ✅ Known: `git remote -v` in this working copy is `ssh://git@git.crm-prionex.com:2222/CRM/fe-prionex.git`
  — Forgejo only. Nothing this session pushes reaches GitHub through this remote.
- ✅ Known: `D7` (2026-08-07) — this plan performs **no** actions on GitHub, and content transfer to
  Forgejo is Oleg's, outside the plan.
- ✅ Known: nothing on the Forgejo side deploys. `.forgejo/workflows/` contains no deploy job and no
  compose invocation; the single mention is a comment at `build.yml:1009` which explicitly says
  *"Story 4.1 owns that line."*
- 🔴 **Not known:** whether the GitHub copy of this repository still receives commits — by a Forgejo
  push mirror, by a scheduled sync, or by hand. **A remote absent from one working copy is not
  evidence that no mirror exists.** Task 1 answers this.

**Task 1's verdict decides the shape of Task 3:**

- **(a) The GitHub path cannot deliver this file** (no mirror, or `CD.yml` provably cannot run) →
  parameterize `docker-compose.server.yml` in place, exactly as the epic instructs.
- **(b) The path is live, or cannot be settled with the access this session has** → **do not edit
  `docker-compose.server.yml` in place.** Land the parameterized stand definition as a new file
  and leave the legacy file untouched until Story 4.9's cutover. Record it as a deviation from FR25
  with the evidence, and raise it in Open Questions rather than deciding the risk away.

*Autonomous choice, subject to Oleg's veto: **(b) is the default whenever (a) is not positively
proven.** Unverified is treated as live. The cost of (b) is one extra file and a rename in Story 4.9;
the cost of a wrong (a) is the legacy stand down with no rollback path in this repository.*

### 3. The image default is already decided — remove it, do not repoint it

AC3 offers two options: point the default at the Forgejo registry, or remove the default so a missing
`DOCKER_IMAGE` fails loudly. **The second is the only one consistent with the `latest` decision the
AC tells you to be consistent with.**

`latest` was **cancelled**, not relocated — [D20](../../docs/migration-decisions.md#d20) §4, Story
3.3 AC4. The reasoning is worth carrying: a name obliged to point at exactly one of three
per-environment images has no non-arbitrary answer, binding it to `prod` would put the most dangerous
image behind the laziest reference, and it is the one **irreversible** option — `latest` is named
literally in the registry's `keep_pattern`, so a single push makes it permanent.

D20 also records, from its own code review, that the argument *"nobody reads that line"* was wrong,
and names **this AC** as the reader. So the line is genuinely load-bearing and genuinely yours.

Two further facts, both current:

- `build.yml` computes `PUSH_LATEST=false`; the Forgejo pipeline **never publishes `:latest`**. The
  current default therefore points at a `ghcr` tag this pipeline does not produce.
- Under Option C one commit yields up to three images. The tag shape is `sha-<12 hex>-<env>` and
  `<sanitized-branch>-<env>`, env ∈ {`dev`, `preprod`, `prod`} ([D18](../../docs/migration-decisions.md#d18),
  [D20](../../docs/migration-decisions.md#d20) §2). A default cannot be right for three environments.

**Do:** `image: ${DOCKER_IMAGE:?…}`. **Do not** substitute a Forgejo-registry default.

### 4. The network is where a wrong answer is silent instead of loud

This is the one axis where the failure does not announce itself.

**Why it is silent.** `nginx.conf` uses a variable upstream with a resolver:

```
38      resolver 127.0.0.11 valid=10s ipv6=off;
39      set $kong_upstream http://crm-kong-gateway:8000;
```

Lazy DNS is deliberate — nginx starts and serves static assets whether or not `crm-kong-gateway`
resolves. So a stand attached to the wrong network **comes up, passes its own healthcheck, and reports
healthy**, while its API calls reach the wrong backend or nothing at all. The compose healthcheck at
line 16 probes `127.0.0.1:80` — itself — and proves nothing about the backend.

**Why it cannot be fixed per stand.** `nginx.conf` is baked into the image at
**`Dockerfile.prod:56`** (`COPY nginx.conf /etc/nginx/conf.d/default.conf`) and the image is
byte-identical across stands by design. The name `crm-kong-gateway` **and the port 8000** are both
hardcoded there. Nothing in this compose file can point the frontend at a differently-named gateway.

> ⚠️ **A stale citation you will meet repeatedly — verified 2026-08-19.** `epics.md` (FR27, the Epic 5
> preamble) and `deferred-work.md` all cite **`Dockerfile.prod:34`** as the line that bakes in
> `nginx.conf`. It is **line 56**; line 34 is now `ARG VITE_OPERATOR_PHONE_URL`, added 2026-08-17 by
> the operator-phone fix. The claim those documents make is still true — only the line number drifted.
> Cite 56. Do not "fix" the planning documents on this alone unless Task 8.3 has another reason to
> touch them.

**Whose side the fix is on.** `CRM/api-prionex` parameterizes its stacks through `STACK` and names
Kong `${STACK:-crm}-kong-gateway`:

| stand | their `STACK` | their Kong container | their network |
|---|---|---|---|
| DEV | `crm-dev` | `crm-dev-kong-gateway` | `crm-dev-network` |
| PRE-PROD | `crm-preprod` | `crm-preprod-kong-gateway` | `crm-preprod-network` |
| PROD | `crm-prod` | `crm-prod-kong-gateway` | `crm-prod-network` |

✅ **The network alias `crm-kong-gateway` was delivered 2026-08-14** — `CRM/api-prionex` commit
`517e6975`. It is in their `docker-compose.server.yml`, Kong is an explicit exception to their
93-container rename, and they added a runtime check that probes the name **from inside the stand's
network** and asserts Kong's own `no Route matched` signature. Their honest caveat, kept: they have
no automated byte-identity gate on the compose render, so an empty-`STACK` regression is caught by a
manual comparison on their side.

**Two consequences for this story:**

1. **The network name is a variable with no default.** A default of `crm-network` would silently
   attach a new stand to the legacy backend — precisely the failure
   [D4](../../docs/migration-decisions.md#d4) was written to prevent, and precisely the failure
   the AC's 2026-08-13 amendment exists to catch.
2. 🚨 **`external: true` must stay, and nothing may pre-create the network.** `external: true` is the
   only loud failure available on this axis: compose refuses to start when the network is absent.
   `CD.yml:185` (`docker network create crm-network 2>/dev/null || true`) converts that refusal into
   an empty, backend-less network that starts happily. **No deploy path this epic writes may create a
   network** — and Story 4.3 must be told, which is why it is in the handoff below.

**The AC does not accept "it started."** It requires the story to record **which backend each stand
actually reaches**, verified from inside the running container. Task 6 owns that.

### 5. The ports changed, and the reason they changed is the method lesson

| Stand | Port | Status |
|---|---|---|
| Legacy | `8080` | untouched, NFR5 |
| New DEV (Story 4.2) | `8082` | free |
| PRE-PROD (Story 5.2) | ~~`8081`~~ **`8083`** | 🔴 amended 2026-08-15 |
| PROD on s10 (Story 6.10) | to be **measured** on s10 | Story 6.10's, not yours |

**`8081` is taken on s1** — `docker-proxy` binds `127.0.0.1:8081` for `vm-cadvisor`. FR25 called it a
"permanent allocation" on the strength of a port census a story ran **from the artifacts rather than
by SSH**. `epics.md` FR25 and Story 5.2 are amended to `8083`; `deferred-work.md:147` still says
`8081` and now contradicts `epics.md`.

**The lesson, recorded in the amendment itself: *the instruction not to look is what produced the
wrong number.*** This story does not need to census s1 — Story 4.2 owns the host — but it must not
bake any port into the compose file as a default, and **`8081` must not appear as a value anywhere in
this story's output**.

`.env.dev.example:15` and `.env.production.example:15` both ship `FRONTEND_PORT=8080`. If Task 7 adds
a stand template, it must not repeat that pattern.

### 6. The guards this story ships, and the E5 rule that governs them

Retro action **E5**, adopted for Epic 4+: **every new guard ships with a live outcome matrix — one
run per branch, including a discriminating run.** *"A guard that has never failed proves nothing"* —
three guards in Epic 3 could not fire as written, and each was found by review, not by its author.

**The guards here are the required-variable expansions** (`${VAR:?message}`). They are cheap to prove
and there is no excuse for shipping them unproven: **the entire matrix runs locally with
`docker compose config` and costs zero CI runs.**

Required matrix — one invocation per row, output recorded verbatim in the Dev Agent Record:

| # | Input | Expected outcome | What it discriminates |
|---|---|---|---|
| 1 | all variables set | `config` renders; every value is the supplied one | the pass branch |
| 2 | `COMPOSE_PROJECT_NAME` unset, all others set | refuses, message names **that** variable | project guard fires |
| 3 | `CONTAINER_NAME` unset, all others set | refuses, message names **that** variable | container guard fires |
| 4 | `FRONTEND_PORT` unset, all others set | refuses, message names **that** variable — **and does not fall back to 8080** | AC2's "no default silently reuses another stand's port" |
| 5 | `DOCKER_IMAGE` unset, all others set | refuses, message names **that** variable — **and does not fall back to `:latest`** | AC3 |
| 6 | `FRONTEND_NETWORK` unset, all others set | refuses, message names **that** variable | §4 |
| 7 | **discriminating:** all set, network name points at a network that does not exist | `up` refuses; error names the missing **network**, not a variable | proves `external: true` still fails loudly and that rows 2-6 refused for the reason claimed |

**Row 7 is the discriminating run and it is not optional.** Rows 2-6 each leave exactly one variable
unset precisely because compose reports variables one at a time — with two unset you learn nothing
about which guard fired. Row 7 proves the whole file still fails loudly on the one axis whose
ordinary failure mode is silence.

**Error-message contract** (Epic 3, measured three times): a fail-closed guard that misattributes its
own failure sends the next reader to the wrong subsystem. Each `:?` message must name **the variable
and where the operator sets it** — e.g. `FRONTEND_PORT is required; set it in the stand's .env
(~/crm-prionex/fe-prionex-dev/.env)`. Do not ship bare `${VAR:?}`.

**🔬 Probe-first — two mechanisms this story must not assume:**

1. **Does `COMPOSE_PROJECT_NAME` supplied via `--env-file` actually set the project name when the
   file also declares a top-level `name:`?** Compose's documented precedence is `-p` flag >
   `COMPOSE_PROJECT_NAME` > top-level `name:` > directory name, and whether an `--env-file` value is
   honoured for compose's *own* configuration variables has varied across versions. Settle it with
   `docker compose --env-file … config` and record the compose version. Writing
   `name: ${COMPOSE_PROJECT_NAME:?…}` makes the dependency explicit and fail-closed **regardless of
   precedence** — that is the conservative form, but prove it renders before relying on it.
2. **Is top-level `name:` interpolated at all on the compose version in play?** Same one-command
   probe. If it is not, say so and choose the alternative (drop `name:` and rely on the environment
   variable) as a **recorded deviation**, not a silent substitution.

Record the exact `docker compose version` next to the matrix. The version that matters in the end is
**s1's**, and this story cannot read it — flag that as a handoff to Story 4.2 rather than pretending
the local version settles it.

### 7. Cost, declared before it is spent — retro action D4

> **D4 (team agreement, applies to every story from 4.1 on):** the ledger **closes only against a
> query** (`actions/runs` API count, or `SELECT count(*) FROM action_run`). **A self-report without a
> query means the ledger is open.** Declaration before work stays mandatory.
>
> This is not a formality. Every Epic 3 story that kept a ledger under-reported: 3.1 said 0, actual
> 4; 3.4 declared 20 → audited 36 → said 43 → query-closed at **47**; 3.6 declared 2, spent 6+. The
> recorded lesson is that "count more carefully" was promised and failed again — the defect was that
> a self-reported number was the only number without an external check.

**What a push costs here, measured from the workflow files rather than assumed.** `ci.yml` has **no
`paths` filter**. A push to a feature branch fires `lint`, `typecheck`, `test`, `build`, `gate` and
then `image` (`needs: [lint, typecheck, test, gate]`, `uses: ./.forgejo/workflows/build.yml`).
**A commit that touches only a compose file and a markdown file costs exactly as much as a source
change.** Prior measurement: ~540s wall clock, ~918 job-seconds, on a host shared with another
tenant's production.

**Declare before Task 3, in Task 2, implementation and review separately.** Story 3.5 declared 10-14,
spent 14 on implementation and 5 more on a review round it had not budgeted at all. **A review round
is a phase, not a contingency** — every story in this project has had one and every one found
something.

**Two facts that should make this story's number small:**

- The entire guard matrix (§6) and the two-stand coexistence proof (AC5) run **locally, at zero CI
  cost**. Prefer local. A run spent proving something `docker compose config` answers is a wasted run.
- The only unavoidable cost is the push itself.

**Credential caveat, learned in 3.6 and not to be rediscovered:** closing the ledger by query needs
Forgejo API access, and the tokens (`fe_tmp_1_7` for the repo, `fe_pkg_3_6` for the registry) are
host-local to s1 (`/root/.fj_token`). If the session cannot execute the query, **the ledger is OPEN
and the story says so in those words** — it does not substitute a self-reported number. Do not assume
the `image` job's `uses:` expansion contributes exactly one `action_run` row; **count it, don't
reason about it.**

### 8. Conventions that are not negotiable

1. **No `${{ }}` inside `run:` bodies.** Values arrive through `env:` and are referenced as shell
   variables. (This story writes no workflow — see Prohibition 5 — but the rule binds anything you
   are tempted to add.)
2. **Fail-closed guards name both the cause and the fix.** §6.
3. **Probe-first for unproven mechanisms.** §6's two probes.
4. **Budget declared before work is spent, ledger closed by query.** §7.
5. **Do not prove anything by grepping a bundle or a binary.** Read the registry, the container, the
   database, or run the command.
6. **`main` is protected** (D16, eight required contexts, `apply_to_admins: true`). Work on
   `story-4-1/pr-<n>-<purpose>`, land by PR.

### Prohibitions

1. **Do not change the container-side port.** `listen 80` / `EXPOSE 80` / healthcheck `127.0.0.1:80`
   are baked into the image and are not per-stand. Only the host side of `ports:` is variable.
2. **Do not add a default for `FRONTEND_PORT`, `DOCKER_IMAGE`, `CONTAINER_NAME`,
   `COMPOSE_PROJECT_NAME` or the network name.** Every one of them has a wrong-but-plausible value
   that fails silently. `8081` in particular must not appear anywhere.
3. **Do not remove `external: true`, and do not create the network anywhere.** §4. It is the only
   loud failure on the network axis.
4. **Do not change the image, `nginx.conf`, `Dockerfile.prod`, or anything in `.forgejo/workflows/`.**
   The byte-identical image is what Epic 6's promotion model rests on.
5. **Do not write `deploy-dev.yml`, a health check, a lock or a Slack step.** Those are Stories 4.3,
   4.4 and 4.5. This story produces a compose file, a template, and evidence.
6. **Do not touch the legacy stand's directory, port, container or `.env`.** NFR5. Story 4.2 owns
   host-side work, and even it is forbidden to modify the legacy stand.
7. **Do not "fix" `.github/workflows/CD.yml`.** [D7](../../docs/migration-decisions.md#d7): this plan
   performs no actions on GitHub. Reading it is required (§2); editing it is out of scope.
8. **Do not close the run ledger from memory.** §7.

---

## Acceptance Criteria

Verbatim from `_bmad-output/planning-artifacts/epics.md:1560-1594`, with this story's reading where
later decisions have overtaken the plan.

**AC1 — project and container name come from variables.**

**Given** `docker-compose.server.yml` hardcodes `name: fe-prionex` at line 4 and
`container_name: fe-prionex` at line 9
**When** the file is parameterized
**Then** the compose project name comes from `COMPOSE_PROJECT_NAME`
**And** the container name comes from `CONTAINER_NAME`.

*Reading: both required, no defaults (Prohibition 2). Verify §6's probe 1 before relying on
`COMPOSE_PROJECT_NAME` precedence. Note that `container_name:` suppresses compose's project prefixing
— that is intended here, because FR20's health check addresses the container by that exact name.*

**AC2 — the port is supplied, never defaulted.**

**Given** the published port defaults to `8080` at line 11
**When** the file is parameterized
**Then** the port comes from `FRONTEND_PORT` supplied by the stand's server-side `.env`
**And** no default silently reuses another stand's port.

*Reading: `${FRONTEND_PORT:?…}`. Matrix row 4 is the proof; "no default" is proven by a refusal, not
by reading the file. `8080` stays the legacy stand's and is never written into this file again.*

**AC3 — the image default is removed.**

**Given** line 8 defaults the image to `ghcr.io/crm-prionex/fe-prionex:latest`
**When** the file is updated
**Then** the default points at the Forgejo registry, or the default is removed so that a missing
`DOCKER_IMAGE` fails loudly
**And** the choice is consistent with the `latest` decision recorded in Story 3.3.

*Reading: 🔴 **the second branch — remove it.** §3: `latest` is cancelled, not relocated (D20 §4), the
pipeline sets `PUSH_LATEST=false`, and under Option C no single default is right for three
environments. Matrix row 5 proves it.*

**AC4 — the network is a variable, and the story records what each stand reaches.**

**Given** the network is declared external as `crm-network` at lines 33-36
**When** the file is parameterized
**Then** the network name is supplied by a variable so a stand can be attached to an isolated network
**And** each stand resolves `crm-kong-gateway` inside **whichever network it is attached to** — the
legacy stand on the shared `crm-network`, the new DEV stand on `crm-dev-network` — **and the story
records which backend each stand actually reaches.**

*🔴 **AMENDED 2026-08-13** (`sprint-change-proposal-2026-08-13-kong-naming.md` §4.2). The original
clause assumed the new DEV stand would keep the shared network and the legacy Kong; that premise
expired the moment `CRM/api-prionex` brought up its own DEV stack.*

*Reading: §4. The clause "records which backend each stand actually reaches" is the AC — "it started"
does not satisfy it, because attaching to the wrong network **fails silently by serving the wrong
backend** rather than erroring. Task 6 owns the evidence. Where this story cannot reach s1, it
records what it proved locally and hands the s1 verification to Story 4.2 **explicitly and by name**,
rather than leaving it implied.*

**AC5 — two stands coexist.**

**Given** the parameterized file
**When** two stands are brought up locally with different variable sets
**Then** both start without name or port collision.

*Reading: "locally" means the developer machine — this story does not touch s1. All five axes of §1
must be distinct and each must be **observed** distinct (`docker ps`, `docker compose ls`,
`docker inspect`), not inferred from the variable values that were passed in.*

---

## Tasks / Subtasks

### Task 1 — Bind the live state and settle the legacy blast radius (AC: all)

- [ ] 1.1 Re-read `docker-compose.server.yml` in the working tree and confirm the five axes and the
      line numbers in §1 still hold at the story's baseline commit. Record any drift.
- [ ] 1.2 Re-read `.github/workflows/CD.yml:150-240` and confirm the copy path, the fixed target
      directory, the `docker rm -f fe-prionex`, the `docker network create … || true`, and the
      hardcoded `localhost:8080` fallback probe. These are the facts §2 rests on.
- [ ] 1.3 🔴 **Settle whether the GitHub copy of this repository can still receive this file.** Check
      for a push mirror on the Forgejo side (repository settings / API), any scheduled sync, and
      whether GitHub Actions is still enabled there. **State plainly what you could and could not
      check with the access available.**
- [ ] 1.4 Record the verdict as **(a)** or **(b)** per §2, with the evidence that produced it. If the
      question cannot be settled, the verdict is **(b)** — unverified is treated as live.
- [ ] 1.5 Confirm the port table in §5 against `epics.md` FR25 and note that
      `deferred-work.md:147` still says `8081` (stale). Decide whether to correct it in Task 8.

### Task 2 — Declare the budget (AC: all) — before any push

- [ ] 2.1 State expected runs for **implementation and review separately**, in this file, before
      Task 3 makes a change. Note the baseline: the highest `action_run.id` before this story's first
      push.
- [ ] 2.2 State explicitly which parts of this story cost **zero** runs (the whole guard matrix, the
      two-stand proof, all local `docker compose` work) and confirm they will be done locally first.
- [ ] 2.3 Note the known per-push cost: `ci.yml` has no `paths` filter, so a compose-and-markdown
      commit spends a full CI run plus the `image` job.
- [ ] 2.4 Name the query that will close the ledger and the credential it needs. If the credential is
      not available to the session, say so **now**, not at close.

### Task 3 — Parameterize the file (AC: 1, 2, 3, 4)

*Gated on Task 1.4. Under verdict (b), apply every subtask below to the new stand file and leave
`docker-compose.server.yml` untouched.*

- [ ] 3.1 `name:` ← `${COMPOSE_PROJECT_NAME:?…}` (AC1), subject to §6 probe 2.
- [ ] 3.2 `container_name:` ← `${CONTAINER_NAME:?…}` (AC1).
- [ ] 3.3 `ports:` ← `"${FRONTEND_PORT:?…}:80"` — host side only, container side stays `80` (AC2,
      Prohibition 1).
- [ ] 3.4 `image:` ← `${DOCKER_IMAGE:?…}`, **default removed, not repointed** (AC3, §3).
- [ ] 3.5 Network: the service references a local alias whose `name:` is `${FRONTEND_NETWORK:?…}`,
      `external: true` **retained** (AC4, §4, Prohibition 3).
      *Variable name `FRONTEND_NETWORK` chosen for consistency with `FRONTEND_PORT` — autonomous,
      subject to Oleg's veto; if he prefers `STACK_NETWORK` or `COMPOSE_NETWORK`, it is a rename.*
- [ ] 3.6 Every `:?` message names the variable **and** where the operator sets it (§6 error-message
      contract). No bare `${VAR:?}`.
- [ ] 3.7 Update the usage comment at the top of the file to list every required variable. The
      current header claims `--env-file .env` is all you need; after this change that is false unless
      the `.env` is complete.
- [ ] 3.8 Leave `restart`, `healthcheck`, `deploy.resources` and `logging` **unchanged**. They are
      not in any AC.

### Task 4 — Prove the guards with a live outcome matrix (AC: 2, 3; retro E5)

- [ ] 4.1 Run §6 probe 1: does `COMPOSE_PROJECT_NAME` from `--env-file` determine the project name?
      Record the command, the output and `docker compose version`.
- [ ] 4.2 Run §6 probe 2: is top-level `name:` interpolated on this compose version? If not, record
      the deviation and the alternative taken.
- [ ] 4.3 Execute matrix rows 1-6 (§6). One invocation per row, exactly one variable unset per row.
      Paste the **verbatim** refusal message for each.
- [ ] 4.4 🔴 Execute matrix row 7 — the **discriminating** case: everything set, network name points
      at a network that does not exist. Confirm the error names the **network**, and that it is a
      different failure from rows 2-6. A matrix without this row does not satisfy E5.
- [ ] 4.5 State what the matrix does **and does not** prove — in particular that it was run against
      the local compose version, not s1's, and that s1's version is Story 4.2's to confirm.

### Task 5 — Prove coexistence (AC: 5)

- [ ] 5.1 Create two local external networks for the experiment and two stand directories with
      distinct `.env` files. *Creating a network **locally, for a test** is not the prohibited
      auto-create in a deploy path (Prohibition 3) — that prohibition is about deploy automation.
      Say which you are doing.*
- [ ] 5.2 Bring both stands up **from separate directories**, not from the repository root — the
      repo's `docker-compose.yml` declares the same project name `fe-prionex` and can adopt the
      server project.
- [ ] 5.3 Observe all five axes distinct, from Docker rather than from the `.env` you wrote:
      `docker compose ls` (projects), `docker ps` (container names, published ports),
      `docker inspect` (network attachment), and confirm neither container appears in the other's
      project.
- [ ] 5.4 Tear both down and confirm the teardown of one does not touch the other. Note whether
      `docker rm -f <name>` by literal name would cross stands — it would, and Story 4.2 must
      therefore never name a new stand `fe-prionex`.
- [ ] 5.5 Record the exact commands so Story 4.2 can repeat them on s1.

### Task 6 — Record which backend each stand reaches (AC: 4)

- [ ] 6.1 From **inside** a running container (`docker exec`), resolve `crm-kong-gateway` and record
      what it resolves to — or that it does not resolve. Reading the compose file is not evidence.
- [ ] 6.2 Record that a stand attached to a network with no Kong still starts and still reports
      healthy — the silent-failure property of §4, demonstrated rather than asserted. This is the
      single most valuable artifact this story hands to 4.2 and 5.1.
- [ ] 6.3 State the limit honestly: this is a local network, not `crm-dev-network` on s1. Hand the s1
      verification to **Story 4.2** by name, including the instruction that the absence of the alias
      is a **stop**, not a fallback to the legacy network.
- [ ] 6.4 Confirm from `nginx.conf:39,50` that the port `8000` is hardcoded alongside the name, and
      carry forward the still-unverified question of whether `api-prionex`'s `KONG_PORT=8330` on PROD
      is a published host port or the in-network port. **Do not resolve it by assumption.**

### Task 7 — Ship the stand `.env` template (AC: 1, 2, 3, 4)

- [ ] 7.1 Add a server-side stand template (e.g. `.env.stand.example`) listing every required
      variable with **no working values** — placeholders that fail loudly if copied unedited. Story
      4.2 creates the real `.env` on s1; this gives it something to copy.
- [ ] 7.2 Do **not** repeat the `.env.dev.example` / `.env.production.example` pattern of shipping
      `FRONTEND_PORT=8080` and a `ghcr` image. Note in the template that the DEV stand is `8082`,
      PRE-PROD `8083`, and that `8081` is taken on s1.
- [ ] 7.3 Decide whether `.env.dev.example` and `.env.production.example` are now misleading enough to
      amend or retire. *Conservative default: leave them, add a one-line pointer to the new template.
      They describe the legacy stands, which are still live and still untouched (NFR5).*
- [ ] 7.4 Note the `README.md:136` defect (the DEV stand is labelled "Pre-production") as **optional**
      — it is a pre-existing documentation error tracked in `deferred-work.md:813` (`:808` at the
      story's baseline; this story's own Task 8.2 edit shifted it by +5), not this story's
      to fix, and fixing it costs a run.

### Task 8 — Record (AC: all)

- [ ] 8.1 Write the D-record in `docs/migration-decisions.md`: the variable names, why the image
      default was removed rather than repointed, why the network has no default, the Task 1.4 verdict
      and its evidence. **Check the next free `D` number against the file and against any open
      branch** — `D23` and `D25` both collided this way already, and each collision cost a fix.
- [ ] 8.2 Update `_bmad-output/implementation-artifacts/deferred-work.md` with anything this story
      opened, and correct the stale `8081` at line 147 if Task 1.5 decided to.
- [ ] 8.3 Amend `epics.md` only if a measurement contradicts it. Do not amend it to match a decision.
- [ ] 8.4 Write the explicit handoff to Story 4.3: **no deploy path may create the network**, the
      health check must read `CONTAINER_NAME` and `FRONTEND_PORT` (FR20) rather than repeat
      `CD.yml:233`'s hardcoded `localhost:8080`, and a new stand must never be named `fe-prionex`
      (`CD.yml:201` force-removes that name).

### Task 9 — Close (AC: all)

- [ ] 9.1 🔴 Close the run ledger **against a query**. Record the query, its output and the delta from
      the Task 2 declaration. If the credential was unavailable, write **"the ledger is open"** in
      those words and name who can close it. **D4 admits no third option.**
- [ ] 9.2 Confirm every AC is closed on observed evidence, and that the guard matrix in the Dev Agent
      Record has all seven rows including the discriminating one.
- [ ] 9.3 Update `sprint-status.yaml`: `4-1-…` → `review`.
- [ ] 9.4 Open the PR. **Do not merge to `main` directly** — protected, eight required contexts.
- [ ] 9.5 State in the PR description that per retro action **E5**, Story 4.1 is code-reviewed
      **before** Story 4.2 is written. This story is Epic 4's foundation; Epic 2 closed with three
      stories unreviewed and three later stories built on their unverified claims.

---

## Dev Notes

**Files this story reads (do not modify):** `.github/workflows/CD.yml`, `nginx.conf`,
`Dockerfile.prod`, `.forgejo/workflows/ci.yml`, `.forgejo/workflows/build.yml`,
`docker-compose.yml`, `docs/runners/docker-compose.yml`.

**Files this story writes:** `docker-compose.server.yml` (verdict (a)) **or** a new stand compose file
(verdict (b)); a stand `.env` template; `docs/migration-decisions.md`;
`_bmad-output/implementation-artifacts/deferred-work.md`; this story file;
`_bmad-output/implementation-artifacts/sprint-status.yaml`.

**What "done" looks like:** a compose file where every stand-identifying value is required and absent
by default; seven recorded guard outcomes; two stands observed running side by side; a recorded
answer to "which backend does it reach"; and a run ledger closed by a query.

**The trap this story is most likely to fall into:** treating it as a five-line edit. The edit is
five lines. The story is (1) whether that edit can reach a stand nobody intends it to reach, (2)
whether the guards actually fire, and (3) whether the network attachment is verified rather than
declared. All three have burned this project before, at the exact points named above.

### Project Structure Notes

- The compose file lives at the repository root; Story 4.2 places stand directories at
  `~/crm-prionex/fe-prionex-dev/` on s1 (FR26). The legacy path `~/crm-prionex/fe-prionex/` is the
  legacy stand's and stays untouched.
- Environment templates follow `.env.<context>.example` at the root. A new stand template belongs
  there, not in `docs/`.
- Decisions go to `docs/migration-decisions.md` as numbered `D`-records (Russian, matching the file);
  the story file itself is English, per `_bmad/bmm/config.yaml`.
- `_bmad-output/` is the resolved artifacts root (`{output_folder}` is undefined in the BMAD config —
  a known project condition, not a bug to fix here).

### References

- Story 4.1 ACs — `_bmad-output/planning-artifacts/epics.md:1554-1594`; Epic 4 preamble `:1546-1552`
- FR20 `:207-209`, FR25 `:225-227` (port amendment), FR26 `:229-231`, FR27 `:233-244`; NFR5 `:297`
- Story 4.2 (consumer of this file) `:1596-1636`; Story 4.3 (health check, deploy) `:1638-1683`;
  Story 4.8 (shared mechanics) `:1811-1849`
- `docker-compose.server.yml:1-36` — the file being changed
- `.github/workflows/CD.yml:154-162, 181-185, 200-201, 206-209, 233-234` — the legacy path
- `nginx.conf:38-39, 49-50`; `Dockerfile.prod:56, 59` — the baked-in gateway name and port
  (⚠️ the plan documents cite `Dockerfile.prod:34` for this; **56** is correct as of `3ace40de`)
- `.env.dev.example:12,15`, `.env.production.example:12,15` — the existing stand templates
- [D4](../../docs/migration-decisions.md#d4) — stand parameterization and the separate PRE-PROD
  network; the health-check hardcodes named as parameterized "together with compose"
- [D18](../../docs/migration-decisions.md#d18), [D20](../../docs/migration-decisions.md#d20) §2, §4 —
  tag scheme; `latest` cancelled; this AC named as the reader
- [D7](../../docs/migration-decisions.md#d7) — no actions are performed on GitHub
- [D16](../../docs/migration-decisions.md#d16) — `main` is protected, eight contexts
- [D25](../../docs/migration-decisions.md#d25) — `staging`/`development` stay ungated; explicitly
  does not block Stories 4.1-4.9
- [D26](../../docs/migration-decisions.md#d26) — CNI netns isolation for RUN steps; the builder image
  is digest-pinned. Context for why `build.yml` must not be touched casually.
- `epic-3-retro-2026-08-18.md` — actions **D4** (ledger closes by query) and **E5** (live outcome
  matrix; review the foundation before building on it); critical path A1/B2/C3 all closed 2026-08-19
- `deferred-work.md:147` (stale `8081`), `:808` (README label defect), `:830-871` (the Kong naming
  collision in full), `:822-825` (the alias delivered by `api-prionex` `517e6975`)
  — ⚠️ **these line numbers are bound to the baseline `3ace40de`.** This story's own Task 8.2 edit
  inserted lines at `:148`, shifting everything below by **+5**: `:808`→`:813`, `:822-825`→`:827-830`,
  `:830-871`→`:835-876`. Caught by the review round, which is the same class of drift §4 warns about
  for `Dockerfile.prod:34`.
- `sprint-change-proposal-2026-08-13-kong-naming.md` §4.2 (this AC's amendment), §4.3 (Story 4.2)
- `sprint-change-proposal-2026-08-15-preprod-reality.md` lines 31 and 70 — `8081` measured taken on
  s1 (`docker-proxy` for `vm-cadvisor`), FR25 amended `8081` → `8083`

---

## Open Questions for Oleg

### Answered

1. ✅ **RESOLVED BY OLEG, 2026-08-19: «GitHub не трогаем».**

   **What this settles: the action.** No GitHub interaction, in this story or after it — a
   reaffirmation of [D7](../../docs/migration-decisions.md#d7), now standing rather than inferred.
   **Verdict (b) is locked**, not provisional: `docker-compose.server.yml` stays untouched and
   `docker-compose.stand.yml` is the stand definition. The FR25 deviation is permanent for Story 4.1
   and no longer awaits an answer.

   ⚠️ **What it does NOT settle: the fact.** Whether a push mirror exists remains unknown, and it
   stays unknown by construction — the directive removes the only route by which this project would
   ever check. That is the correct trade (the risk of touching GitHub exceeds the value of the
   answer), but it has a consequence worth naming now rather than rediscovering in Epic 4's last
   story:

   🔴 **Story 4.9's cutover inherits the hazard unchanged.** The moment the cutover renames, replaces
   or deletes `docker-compose.server.yml`, it is modifying the exact file `CD.yml:154-162` copies to
   the legacy stand — with `:201` still force-removing the container by literal name beforehand. The
   same NFR5 exposure, and by then this directive means it *still* cannot be checked. **Story 4.9
   must therefore plan the cutover on the assumption that the path is live**, i.e. converge the two
   files only after the legacy stand is decommissioned or provably no longer deployed to, never as a
   file rename in the repository. Recorded in `deferred-work.md`.

   *Original question, kept for the record:* **Does the GitHub copy of `CRM/fe-prionex` still receive
   commits from Forgejo?** **Task 1.3 tried and could not settle it.** The Forgejo API returns HTTP 403 unauthenticated
   (`"Only signed in user is allowed to call APIs."`) on both `/push_mirrors` and the repo endpoint;
   no token exists on this machine; `~/.ssh/config` defines no alias for s1, where the tokens live.
   The mirror configuration was **never read as absent** — the request simply failed on auth, and
   this project's standing finding is that an empty result is not evidence of safety.

   **The default was taken, not deferred:** `docker-compose.server.yml` is untouched and the
   parameterization landed as `docker-compose.stand.yml`. Oleg's answer above makes that permanent —
   the "collapse it back to an in-place edit" path is closed, because closing it would require
   knowing the mirror does not exist, and the directive removes the means of finding out.

### Non-blocking

2. **Variable name for the network — `FRONTEND_NETWORK`?** Chosen for consistency with
   `FRONTEND_PORT`. `api-prionex` uses `STACK` for the same concept on their side. A rename is cheap
   now and expensive after Stories 4.2, 4.3, 5.2 and 6.10 consume it.
3. **Is `api-prionex`'s `KONG_PORT=8330` on PROD the published host port or the in-network port?**
   Our `nginx.conf` hardcodes `crm-kong-gateway:8000`, so if it is the in-network port, PROD does not
   work and no compose change can fix it. Recorded as unverified since 2026-08-13; Epic 6 inherits it
   and it gets more expensive with every story that assumes the answer.
4. **Should `.env.dev.example` / `.env.production.example` be retired?** They describe the legacy
   stands and ship `FRONTEND_PORT=8080` and `ghcr` images. Conservative default taken: keep them,
   add a pointer. They are accurate for the stands that still exist.

5. **Resolved in review round 1 — Prohibition 2's "`8081` must not appear anywhere" is read as
   binding *values*, not warnings.** The first implementation obeyed it literally: the template
   warned operators off the port **without naming it** — *"do not use the port one below 8083."*
   Review killed that on two grounds, and both are right.

   **It was not even self-consistent.** The same story wrote the digits into two documents it
   authored — `deferred-work.md:148-149` and D27's changelog row — because you cannot record
   *"corrected `8081` → `8083`"* without naming the thing corrected. So the strict reading was
   already impossible to hold, and the obfuscation bought nothing while costing clarity.

   **And the cost was real:** an operator who mis-subtracts or skims *"the port one below 8083"*
   picks `8081` and collides with `vm-cadvisor`'s `docker-proxy` — an unrelated system service, and
   exactly the collision the warning exists to prevent.

   **Decision: `8081` and `8080` are both now named plainly in `.env.stand.example`, as ports to
   avoid.** Neither is a value the file assigns — every variable is `<CHANGE_ME>`. §5's actual
   wording is *"must not appear **as a value**"*, and that is honoured. **Subject to Oleg's veto:**
   if Prohibition 2 was meant absolutely, reverting is a two-line change, but then D27 and
   `deferred-work.md` need the same treatment and the correction becomes unrecordable.

7. **New — `docker compose` reads the process environment before `--env-file`, and no guard can
   close that.** An exported `FRONTEND_PORT=8080` overrides the stand's `.env` silently; the `:?`
   guard never fires. It is compose behaviour, not a defect in the file, and it is handed to Story
   4.3 as handoff item 5. Flagged here because it is the one way a *correct* `.env` still produces a
   wrong stand, and because §8 convention 1 pushes 4.3 straight at it.

6. **New — `FRONTEND_NETWORK` as the variable name (Task 3.5).** Chosen for consistency with
   `FRONTEND_PORT`; `api-prionex` uses `STACK` for the same concept. Now consumed by
   `docker-compose.stand.yml` and `.env.stand.example` only, so a rename is still cheap — it becomes
   expensive once Stories 4.2, 4.3, 5.2 and 6.10 write it into real `.env` files on real hosts.

---

## Dev Agent Record

### Agent Model Used

Opus 5 coordinating; Sonnet 4.5 subagents for Tasks 1, 3, 4, 5, 6, 7; Opus 5 for code review.
Model split per the project's standing convention.

### Debug Log References

Environment for all local work, recorded once and referenced by every task below:

```
$ docker version --format '{{.Server.Version}}'
29.6.1
$ docker compose version
Docker Compose version v5.3.0
```

**This is the developer machine's compose version, not s1's.** Every local result in this record is
bound to v5.3.0. s1's version is unread by this story and is Story 4.2's to confirm (Task 4.5).

### Run Budget Ledger

*Declared (Task 2):*

**Declared 2026-08-19, before the implementation push and before Task 3 changed a byte.**

| Phase | Declared pushes | Notes |
|---|---|---|
| Already spent, **undeclared** | 1 | The context commit `cf0d0c71` was pushed to `origin/story-4-1/pr-1-context` **before this ledger existed**. Recorded rather than omitted — D4's failure mode is exactly the number nobody wrote down. |
| Implementation | 2 | One commit carrying the compose file, the template, the records; one expected fixup. |
| Review (a **phase**, not a contingency) | 2 | Every story in this project has had a review round and every one found something. Story 3.5 spent 5 unbudgeted runs here. |
| **Total declared from this point** | **4** | Plus the 1 already spent = 5 pushes attributable to this story. |

**Per-push cost, measured from the workflow files rather than assumed (Task 2.3):** `.forgejo/workflows/ci.yml`
has **no `paths` filter**. A commit touching only a compose file and markdown therefore fires `lint`,
`typecheck`, `test`, `build`, `gate` **and** `image` (`needs: [lint, typecheck, test, gate]`,
`uses: ./.forgejo/workflows/build.yml`) — exactly as much as a source change. Prior measurement:
~540s wall clock, ~918 job-seconds, on a host shared with another tenant's production.

**Runs vs. pushes:** the declaration above is in **pushes**. How many `action_run` rows one push
produces is **not** assumed here — in particular whether the `image` job's `uses:` expansion
contributes one row or more. Per §7 that is to be counted, not reasoned about.

*Zero-cost work, confirmed done locally first (Task 2.2):* the **entire** seven-row guard matrix
(§6), both compose mechanism probes, and the two-stand coexistence proof (AC5) run on the developer
machine with `docker compose config` / `up` and cost **zero** CI runs. No run was spent proving
anything `docker compose config` answers.

*Ledger-closing query and its credential (Task 2.4):* the ledger would close against
`SELECT count(*) FROM action_run WHERE ...` on the Forgejo instance, or the `actions/runs` API
counted over this story's branch. Both need a Forgejo API credential.

🔴 **Stated now, not at close, as Task 2.4 requires: this session has no such credential.** Verified
during Task 1.3 — the Forgejo API returns HTTP 403 (`"Only signed in user is allowed to call APIs."`)
unauthenticated, no token exists on this machine, and `~/.ssh/config` defines no alias for s1, where
the tokens are host-local at `/root/.fj_token`. The baseline (`the highest action_run.id before this
story's first push`, Task 2.1) **could not be read for the same reason**. Unless a credential becomes
available before Task 9.1, **the ledger will close OPEN** and will say so in those words. It will not
substitute a self-reported number — D4 admits no third option.

*Closed (Task 9.1) — by query, or explicitly OPEN:*

✅ **CLOSED BY QUERY, 2026-08-19.** Oleg granted s1 access after the story was otherwise complete;
the credential wall that had forced this ledger OPEN is gone. **This section previously read "THE
LEDGER IS OPEN"** — that is kept in the record below, because the sequence matters to D4: the story
declared in advance, closed OPEN rather than guessing, and closed by query only once a query existed.

**The query** (run on s1, token `/root/.fj_token`, never printed):

```
GET https://git.crm-prionex.com/api/v1/repos/CRM/fe-prionex/actions/runs?limit=100
```

**Result — 4 runs, all `ci.yml`, all `push`:**

| run id | `index_in_repo` | commit | outcome | duration |
|---|---|---|---|---|
| 776 | 263 | `cf0d0c71` (context) | success | 651 s |
| 780 | 264 | `e0395fda` (implementation + review round 1) | **cancelled** — superseded by the next push under concurrency | 308 s |
| 781 | 265 | `de303a96` (PR description) | success | 678 s |
| 783 | 266 | `c4afcc07` (GitHub directive) | success | 687 s |

**Baseline (Task 2.1, which could not be read at declaration time):** highest run id before this
story's first push = **775** (`index_in_repo` 262). Repo total is now 266.

**Declared 5 pushes, spent 4 — under budget by one.** Not by luck: the review round was run
**before** the first implementation push, so its ten fixes landed in the same push as the
implementation and cost **zero** extra runs. The declaration budgeted 2 pushes for review precisely
because "a review round is a phase, not a contingency"; treating it as a phase is also what made it
free.

🔴 **And it answers, by counting, the question §7 said must not be reasoned about.** *"Do not assume
the `image` job's `uses:` expansion contributes exactly one `action_run` row; count it."* **Counted:
it contributes zero.** Four pushes produced exactly four rows, every one of them `ci.yml`; the
reusable `build.yml` invoked via `uses:` creates no row of its own. Per-push cost in this repository
is therefore **1 `action_run`**, not 2 — which makes every prior story's ledger arithmetic in this
project one-per-push as well.

> **Kept verbatim — what this section said before the credential existed:**
>
> *🔴 THE LEDGER IS OPEN. Written in those words, as D4 requires. It is not closed by a query because
> no query could be run: no Forgejo API credential is reachable from this session (declared in advance
> in Task 2.4, not discovered at close). A self-reported number is deliberately not offered here.* The
> recorded lesson from Epic 3 is that every story that kept a ledger under-reported — 3.1 said 0,
> actual 4; 3.4 declared 20 → audited 36 → said 43 → query-closed at **47**; 3.6 declared 2, spent
> 6+ — and the defect was never carelessness, it was that a self-reported number was the only number
> without an external check. **Had a number been guessed here, it would have been wrong: the obvious
> guess was 5, and the cancelled run 780 is not something a self-report would have caught.** Supplying one here
would repeat exactly that defect.

### Probes (Tasks 4.1, 4.2) — commands and outputs, not conclusions

> **Added in review round 1.** The first version of this record shipped only the *conclusions* of
> these probes. §8 convention 3 and E5 both demand the outputs, and this is the story whose entire
> premise is that three Epic 3 guards were declared working and were not. The review also caught the
> methodological half: **neither probe is discriminating when run against `docker-compose.stand.yml`
> itself.** In that file `name:` already *is* `${COMPOSE_PROJECT_NAME:?…}`, so both candidate
> mechanisms produce identical output and no run against it can tell you which one won. Each probe
> below therefore uses a **purpose-built file**. Conclusions unchanged; now they are evidenced.

**Probe 1 — does `COMPOSE_PROJECT_NAME` from `--env-file` beat a literal top-level `name:`?**
Discriminating file: `name:` is a *literal*, so the two mechanisms disagree if precedence differs.

```
# probe-a.yml → name: name-from-file    |    probe-a.env → COMPOSE_PROJECT_NAME=name-from-envfile
$ docker compose -f probe-a.yml --env-file probe-a.env config | head -1
name: name-from-envfile
```

→ `COMPOSE_PROJECT_NAME` from `--env-file` **wins**. Full observed precedence on v5.3.0:
`-p` flag > `COMPOSE_PROJECT_NAME` > top-level `name:` > directory name — the documented order, no
deviation.

**Probe 2 — is top-level `name:` interpolated at all?** Discriminating file: `name:` references a
variable that is *not* `COMPOSE_PROJECT_NAME`, so a rendered value can only come from interpolation.

```
# probe-b.yml → name: ${SOME_OTHER_VAR:?…}    |    probe-b.env → SOME_OTHER_VAR=interpolated-name
$ docker compose -f probe-b.yml --env-file probe-b.env config | head -1
name: interpolated-name
```

→ Top-level `name:` **is** interpolated on v5.3.0. **No deviation to record**, so the conservative
form `name: ${COMPOSE_PROJECT_NAME:?…}` was used as written and the §6 fallback (drop `name:`) was
not needed. Fail-closed confirmed by matrix row 2.

**Probe 3 — one missing variable, or all of them?** Not numbered in §6; run because the matrix design
depends on the answer.

```
$ docker compose -f docker-compose.stand.yml --env-file two-unset.env config
error while interpolating services.frontend.container_name: required variable CONTAINER_NAME is missing a value: …
```

→ Only the **first** missing variable is reported, deterministically across repeated runs. This is
**why matrix rows 2-6 leave exactly one variable unset each**: with two unset, five rows would prove
one guard.

### 🔴 A bypass no guard in this file can close (found in review round 1)

**Compose resolves interpolation from the process environment *before* `--env-file`.** A `${VAR:?}`
guard cannot fire against a variable that is exported. Reproduced:

```
$ grep -v '^FRONTEND_PORT=' row1.env > leak.env          # port removed from the env-file
$ FRONTEND_PORT=8080 docker compose -f docker-compose.stand.yml --env-file leak.env config | grep -A3 ports:
    ports:
      - mode: ingress
        target: 80
        published: "8080"
```

The guard is **silent**, and the value is the legacy stand's port. Same for `COMPOSE_PROJECT_NAME`
(`name: leaked-from-shell`).

**This is a property of compose, not a defect in the file** — no `:?` form can close it, and none was
added to pretend otherwise. But it matters because §8 convention 1 requires Story 4.3 to pass values
into `run:` bodies through step-level `env:`, and Task 8.4's handoff item 2 tells it to read
`CONTAINER_NAME` and `FRONTEND_PORT` for the health check. **A deploy job that binds either name in
`env:` silently overrides the stand's `.env`**, and the failure surfaces as a bare "port already
allocated" with no hint that the `.env` was ignored. Added as handoff item 5.

Note this sharpens Task 4.5's limits statement: the uncovered case is not only "a wrong value in the
`.env`" but "a correct `.env`, overridden from outside."

### Guard Outcome Matrix (retro E5 — all seven rows required)

All seven rows run against **`docker-compose.stand.yml`** (the new file — under verdict (b) the legacy
`docker-compose.server.yml` was never touched and is not under test). Compose **v5.3.0**. Rows 1-6 are
`docker compose -f docker-compose.stand.yml --env-file <row>.env config`; every row leaves **exactly
one** variable unset, because the third probe (below) established that compose reports only the **first** missing
variable — with two unset you learn nothing about which guard fired. Zero CI runs.

| # | Input | Command | Verbatim outcome |
|---|---|---|---|
| 1 | all set | `… --env-file row1.env config` | **exit 0**, renders. Each value checked individually against what was supplied: `name: m4-proj`, `container_name: m4-container`, `published: "19080"`, `image: nginx:alpine`, `networks.stand-network.name: m4-net`. |
| 2 | `COMPOSE_PROJECT_NAME` unset | `… --env-file row2.env config` | **exit 1** — `error while interpolating name: required variable COMPOSE_PROJECT_NAME is missing a value: COMPOSE_PROJECT_NAME is required; set it in the stand's .env (~/crm-prionex/fe-prionex-<stand>/.env)` |
| 3 | `CONTAINER_NAME` unset | `… --env-file row3.env config` | **exit 1** — `error while interpolating services.frontend.container_name: required variable CONTAINER_NAME is missing a value: CONTAINER_NAME is required; set it in the stand's .env (~/crm-prionex/fe-prionex-<stand>/.env)` |
| 4 | `FRONTEND_PORT` unset | `… --env-file row4.env config` | **exit 1** — `error while interpolating services.frontend.ports.[]: required variable FRONTEND_PORT is missing a value: FRONTEND_PORT is required; set it in the stand's .env (~/crm-prionex/fe-prionex-<stand>/.env)`.<br>**No fallback to `8080`** — and this is proven by absence rather than asserted: the render never completed, so no `ports:` block was ever produced to fall back *into*. |
| 5 | `DOCKER_IMAGE` unset | `… --env-file row5.env config` | **exit 1** — `error while interpolating services.frontend.image: required variable DOCKER_IMAGE is missing a value: DOCKER_IMAGE is required; set it in the stand's .env (~/crm-prionex/fe-prionex-<stand>/.env)`.<br>**No fallback to `:latest`** — same proof by absence: no `image:` line was rendered at all. |
| 6 | `FRONTEND_NETWORK` unset | `… --env-file row6.env config` | **exit 1** — `error while interpolating networks.stand-network.name: required variable FRONTEND_NETWORK is missing a value: FRONTEND_NETWORK is required; set it in the stand's .env (~/crm-prionex/fe-prionex-<stand>/.env)` |
| 7 | 🔴 **discriminating** — all five set and valid, `FRONTEND_NETWORK=m4-net-does-not-exist` (confirmed absent via `docker network ls` first) | **7a** `… --env-file row7.env config`<br>**7b** `… --env-file row7.env up -d` | **7a: exit 0** — renders fully, `networks.stand-network.name: m4-net-does-not-exist`, `external: true`.<br>**7b: exit 1** — `network m4-net-does-not-exist declared as external, but could not be found`.<br>Names the **network**, not a variable. No container, network or project was created (`docker ps -a` / `network ls` / `compose ls -a` all empty immediately after). |

**Why row 7 earns its "not optional" label, and it turned out to prove more than expected.** Rows 2-6
all fail in one error class (`error while interpolating <path>: required variable …`). Row 7 fails in
a **categorically different** one — which is what confirms rows 2-6 refused *for the reason claimed*
rather than tripping over some unrelated parse error in the file. And 7a vs 7b is a finding in its own
right: **`docker compose config` is blind to network existence.** It validates interpolation and
syntax, not runtime state. A CI gate built on `config` alone would pass a stand that cannot start —
worth knowing for Stories 4.3 and 4.8, and the reason 7b had to be a real `up`.

### ✅ The matrix re-run on s1 — the limit below is now closed

**Added 2026-08-19 after Oleg granted s1 access.** The section below was written when s1 was
unreachable and handed the version question to Story 4.2. It has now been answered directly, and the
answer was **not** the assumed one:

🔴 **s1 runs Docker Compose v5.1.3, not v5.3.0** (Docker 29.4.0, vs 29.6.1 locally). The local
result was therefore genuinely not proof for s1 — flagging it as a limit was correct, not pedantry.

**All seven rows re-executed against `docker-compose.stand.yml` on s1 itself.** Result: **identical
behaviour, byte-identical messages**, on every row.

| Row | s1 v5.1.3 outcome |
|---|---|
| 1 — all set | renders; `name: s1chk-proj`, `container_name: s1chk-cont`, `published: "19771"`, `image: nginx:alpine`, network `crm-dev-network` — each the supplied value |
| 2 | exit 1 — `error while interpolating name: required variable COMPOSE_PROJECT_NAME is missing a value: …` |
| 3 | exit 1 — `… services.frontend.container_name: required variable CONTAINER_NAME …` |
| 4 | exit 1 — `… services.frontend.ports.[]: required variable FRONTEND_PORT …` |
| 5 | exit 1 — `… services.frontend.image: required variable DOCKER_IMAGE …` |
| 6 | exit 1 — `… networks.stand-network.name: required variable FRONTEND_NETWORK …` |
| 7 — discriminating | `config` **exit 0** (blind, as locally); `up` **exit 1** — `network s1chk-absent-net declared as external, but could not be found` |

The **shell-override bypass also reproduces on v5.1.3**: an exported `FRONTEND_PORT=8080` with the
variable absent from `--env-file` renders `published: "8080"` with no guard firing. It is a compose
property across both versions, which strengthens handoff item 5 rather than weakening it.

Nothing was left behind on s1 — the check ran in a `mktemp -d` under `/tmp`, created no container and
no network (row 7 fails before creating anything), and residue was verified zero.

**Consequence: Story 4.2's handoff item 1 is closed before 4.2 starts**, and `docker-compose.stand.yml`
is proven on the version that will actually run it.

**Task 4.5 — what this matrix does NOT prove.**

- ~~**Not s1.**~~ ✅ **Closed above** — re-run on s1's own v5.1.3, all seven rows identical.
- Nothing about `docker-compose.server.yml`, which still carries the old hardcoded values and
  defaults untouched (verdict (b)).
- Only **presence/absence** was exercised — that is the `:?` guard's actual mechanism. A
  syntactically valid but *wrong* value (a port belonging to another stand, a network belonging to
  another backend) is **not** caught by any guard here, and cannot be. That failure mode is the
  subject of §4 and Task 6, not of this matrix.
- Not AC5 (Task 5) and not AC4's backend-resolution clause (Task 6).

### Completion Notes List

#### Task 1 — Live state bound, blast radius settled

**1.1 — no drift.** All five axes and every line number in §1 hold verbatim at the baseline: `name:
fe-prionex` (4), `image: ${DOCKER_IMAGE:-ghcr.io/crm-prionex/fe-prionex:latest}` (8),
`container_name: fe-prionex` (9), `- "${FRONTEND_PORT:-8080}:80"` (11), `- crm-network` (13),
`crm-network:` / `external: true` / `name: crm-network` (33-36).

**1.2 — no drift in `CD.yml` either.** Every fact §2 rests on confirmed at the line numbers cited:
scp source/target `:161-162` (`docker-compose.server.yml` → `~/crm-prionex/fe-prionex/`, one fixed
directory), `COMPOSE_FILE`/`ENV_FILE` `:181-182`, `docker network create crm-network 2>/dev/null ||
true` `:185`, `docker compose ... down --remove-orphans 2>/dev/null || true` `:200`,
`docker rm -f fe-prionex 2>/dev/null || true` `:201`, and the fallback probe
`if curl -sf http://localhost:8080` `:233`.

**1.3 — what could and could not be checked.**

*Could:* `git remote -v`, `git config --get-regexp remote` and `.git/config` — a single remote,
`origin` → Forgejo, no second remote and no `pushurl` override. Repo-wide grep for a mirror or sync
workflow across `.forgejo/`, `docs/`, `_bmad-output/`, `README.md` — none exists; the only
`.forgejo` mention of this file is the comment at `build.yml:1009` saying *"Story 4.1 owns that
line."* `README.md:30` does carry `git clone https://github.com/CRM-Prionex/fe-prionex.git`, so a
GitHub repository of that name demonstrably exists.

*Could not:*

1. **Whether a Forgejo push mirror is configured.** `/api/v1/repos/CRM/fe-prionex/push_mirrors` and
   `/api/v1/repos/CRM/fe-prionex` both return **HTTP 403** — `{"message":"Only signed in user is
   allowed to call APIs."}`. The mirror configuration was never read as absent; the request simply
   failed on authentication. **This is the distinction the verdict turns on.**
2. Whether GitHub Actions is still enabled on `github.com/CRM-Prionex/fe-prionex`, or whether
   `CD.yml` can currently execute there — no GitHub access in this session.
3. Any scheduled or manual sync outside this repository's visibility — per [D7](../../docs/migration-decisions.md#d7)
   that path is Oleg's and lives outside this plan.
4. Live s1 host state — `~/.ssh/config` does not exist on this machine, so no alias for s1 is
   configured and no connection was attempted. (`~/.ssh/known_hosts` carries a
   `s1.private.crm-prionex.com` entry, but a recorded host key is not a credential and not an
   alias.)

**1.4 — 🔴 VERDICT (b). Unverified is treated as live.**

The question was not settled in either direction. Nothing found proves the GitHub path dead; nothing
proves it live. §2's rule is explicit for exactly this outcome — *"If the question cannot be settled,
the verdict is (b)"* — and the asymmetry justifies it: the cost of (b) is one extra file and a rename
in Story 4.9; the cost of a wrong (a) is the legacy stand force-removed by `CD.yml:201` and then kept
down by an interpolation failure at `:206`, with no rollback path in this repository. That is an
NFR5 violation reached by doing exactly what the epic asks.

**Consequence, and it is the main structural decision of this story:** `docker-compose.server.yml`
is **not modified — not one byte**. The parameterized stand definition lands as a **new file**,
`docker-compose.stand.yml`. This is a **recorded deviation from FR25**, which says the existing file
is parameterized in place. It is raised in Open Questions rather than decided away, and Story 4.9's
cutover is where the two converge.

**1.5 — the stale `8081` confirmed, and it is a live contradiction.** `epics.md:225-226` (FR25)
carries the amendment (`~~8081~~ 8083`, "`8081` is taken on s1 … `8083` is free, measured"), with
the same amendment repeated at `:707` and `:1979`. `deferred-work.md:147` still reads *"…before the
DEV (`:8082`) and PRE-PROD (`:8081`) stands land there too."* — unamended, and now directly
contradicting `epics.md`. Corrected under Task 8.2.

#### Tasks 3 and 7 — what was built

`docker-compose.stand.yml` (new). All five identity axes are required with **no defaults**:
`${COMPOSE_PROJECT_NAME:?…}`, `${CONTAINER_NAME:?…}`, `"${FRONTEND_PORT:?…}:80"`,
`${DOCKER_IMAGE:?…}`, and a neutral local network key `stand-network` whose `name:` is
`${FRONTEND_NETWORK:?…}` with **`external: true` retained**. Each `:?` message names the variable
**and** where the operator sets it, per §6's error-message contract — no bare `${VAR:?}` anywhere.

- **AC3 — the image default is removed, not repointed.** §3's reasoning is what decided it: `latest`
  was cancelled outright ([D20](../../docs/migration-decisions.md#d20) §4), `build.yml` computes
  `PUSH_LATEST=false` so the pipeline never publishes it, and under Option C one commit yields up to
  three per-environment images, so no single default can be right for three environments.
- **The network key was renamed** from the literal `crm-network` to the neutral `stand-network`.
  The old key hardcoded the legacy network's name in two places, and `name:` defeats project
  prefixing — the exact silent-collision mechanism of §4.
- **Container-side `80` untouched** in the port mapping (Prohibition 1); `restart`, `healthcheck`,
  `deploy.resources` and `logging` carried over unchanged (3.8).
- **The header was rewritten** (3.7). The old one claimed `--env-file .env` was all you need, which
  is false after this change; it now lists all five required variables and states that
  `docker-compose.server.yml` remains the legacy stand's file until Story 4.9.
- `grep -n 8081 docker-compose.stand.yml` → no match. `grep -n 8080` → no match.

`.env.stand.example` (new, Task 7.1/7.2). Every placeholder is `<CHANGE_ME>` — deliberately
**invalid**, not merely wrong. It deliberately does **not** repeat the `.env.dev.example` /
`.env.production.example` pattern of shipping `FRONTEND_PORT=8080` and a `ghcr` image. It carries the
constraints that are expensive to rediscover: `CONTAINER_NAME` must never be `fe-prionex`
(`CD.yml:201`), the tag shape and that `:latest` is cancelled, and that a wrong `FRONTEND_NETWORK`
fails **silently** with the api-prionex network names listed.

> 🔴 **Review round 1 found a real defect here, and it is the one worth reading.** The first version
> used a bare `CHANGE_ME`, and this record claimed *"no working values, so a copied-unedited template
> fails loudly."* **That was false for exactly one variable.** `CHANGE_ME` matches Docker's container
> name grammar `[a-zA-Z0-9][a-zA-Z0-9_.-]*`, so the stand **started**:
>
> ```
> $ docker compose … --env-file cm.env up -d      # CONTAINER_NAME=CHANGE_ME
>  Container CHANGE_ME  Started
> $ curl -o /dev/null -w '%{http_code}' http://localhost:19555   →   200
> ```
>
> The other four refused — but **by accident of unrelated grammars** (project names and image refs
> must be lowercase; a host port must be numeric), which nobody had written down and nothing
> guaranteed. And `CONTAINER_NAME` is precisely the variable a copy-run-fix loop never reaches: its
> block was the shortest, it carries no allocation table, and it produces no error. Story 4.2 would
> have provisioned s1 with a container named `CHANGE_ME`, and Story 4.3's FR20 health check — which
> reads `CONTAINER_NAME` from the same `.env` — would have found it and **passed**.
>
> **Fixed by making invalidity the mechanism instead of a coincidence:** every placeholder is now
> `<CHANGE_ME>`, and `<`/`>` are illegal in all four grammars. Verified — the unedited template now
> refuses on the first variable it reaches, and `CONTAINER_NAME=<CHANGE_ME>` refuses at `up` with
> `Invalid container name (<CHANGE_ME>), only [a-zA-Z0-9][a-zA-Z0-9_.-] are allowed`. The per-variable
> failure mode is now documented **in the template itself** rather than resting on a blanket claim.
> *(Deliberately not "fixed" by lowercasing to `change_me` — that is a valid project name **and** a
> valid container name, which would have widened the defect from one variable to two.)*

**Task 7.3 — conservative default taken, and the pointer actually shipped this time.**
`.env.dev.example` and `.env.production.example` are **kept**, not retired: they accurately describe
the legacy stands, which are still live and still untouched (NFR5). Review round 1 caught that the
one-line pointer this task chose *over* retirement had **not been added**, while three places in this
record asserted it had — so an operator reaching for the file that looks like the DEV template would
still have got `8080` and a `ghcr` tag with nothing indicating a stand template exists. Both files now
carry it. **Task 7.4 — declined as the story permits:** the `README.md:136` label defect is
pre-existing, tracked at `deferred-work.md:813`, and fixing it costs a run.

#### Task 5 — Coexistence observed, not inferred (AC5)

Two stands, `t5-alpha` and `t5-beta`, brought up **from their own separate directories** (5.2) — not
from the repository root, because the repo's `docker-compose.yml` declares the same project name
`fe-prionex` and can adopt the server project. Each stand directory holds its **own copy** of
`docker-compose.stand.yml` plus its own `.env`, which is also the layout Story 4.2 will create on s1
under FR26. Ports 19101/19102 — the 19xxx range deliberately, so nothing in this proof could touch
`8080`/`8082`/`8083` or the port that is taken on s1.

> **5.1, said explicitly as the task requires.** Two networks were created **by hand, locally, for a
> test**. That is not the act Prohibition 3 forbids. Prohibition 3 targets *deploy automation* —
> `CD.yml:185`'s `docker network create crm-network 2>/dev/null || true`, which converts
> `external: true`'s loud refusal into an empty, backend-less network inside an unattended pipeline.
> No deploy path created a network here, and neither network was `crm-network`.

**5.3 — all five axes distinct, each read from Docker rather than from the `.env` that was written:**

| Axis | alpha | beta | Read from |
|---|---|---|---|
| Compose project | `t5-alpha` | `t5-beta` | `docker compose ls` |
| Container name | `t5-fe-alpha` | `t5-fe-beta` | `docker ps` |
| Published port | `0.0.0.0:19101->80/tcp` | `0.0.0.0:19102->80/tcp` | `docker ps` |
| Network attachment | `t5-net-alpha` **only** | `t5-net-beta` **only** | `docker inspect .NetworkSettings.Networks` |
| Cross-project leak | none | none | `docker compose -p t5-alpha ps` lists only `t5-fe-alpha`; `-p t5-beta ps` only `t5-fe-beta` |

```
$ docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}'
t5-fe-beta    nginx:alpine   0.0.0.0:19102->80/tcp   Up 6 seconds (healthy)
t5-fe-alpha   nginx:alpine   0.0.0.0:19101->80/tcp   Up 6 seconds (healthy)

$ curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:19101   →  200
$ curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:19102   →  200
$ docker inspect --format '{{.State.Health.Status}}' t5-fe-alpha t5-fe-beta
healthy
healthy
```

**5.4 — teardown isolation, and the finding Story 4.2 must carry.** `docker compose down` in
`stand-alpha/` removed only `t5-fe-alpha`; beta stayed `Up (healthy)` and still answered 200.

🔴 **But `docker rm -f <name>` would cross stands.** `docker rm` is **name-based and
project-independent** — it does not consult the compose project at all. That is exactly the mechanism
at `CD.yml:201` (`docker rm -f fe-prionex`). **Therefore Story 4.2 must never name a new stand
`fe-prionex`**: any deploy force-removing that literal name takes whichever container currently holds
it, whatever project it belongs to. Carried into the Task 8.4 handoff.

**5.5** — the exact replay command sequence for s1 is recorded in the Task 8.4 handoff below.

#### Task 6 — Which backend each stand reaches (AC4's operative clause)

AC4 does not accept "it started." The experiment was therefore built to **discriminate**: a fake Kong
was attached to **one** network only —

```
docker run -d --name t5-kong --network t5-net-alpha --network-alias crm-kong-gateway nginx:alpine
```

— so `t5-net-alpha` has something answering to `crm-kong-gateway` and `t5-net-beta` has nothing.
Resolution was then read **from inside each running container**, verbatim:

```
=== ALPHA (t5-net-alpha — Kong alias present) ===
$ docker exec t5-fe-alpha nslookup crm-kong-gateway
Server:    127.0.0.11
Address:   127.0.0.11:53
Non-authoritative answer:
Name:   crm-kong-gateway
Address: 172.19.0.3

$ docker exec t5-fe-alpha getent hosts crm-kong-gateway
172.19.0.3        crm-kong-gateway  crm-kong-gateway

=== BETA (t5-net-beta — no Kong) ===
$ docker exec t5-fe-beta nslookup crm-kong-gateway
Server:    127.0.0.11
Address:   127.0.0.11:53
** server can't find crm-kong-gateway: NXDOMAIN

$ docker exec t5-fe-beta getent hosts crm-kong-gateway
(no output, exit 2 — not found)
```

**Alpha resolves the name to a live IP; beta gets NXDOMAIN.** DNS-level evidence from inside the
container, which is what the AC asks for — reading the compose file would not have been evidence.

**6.2 — the silent-failure artifact, demonstrated rather than asserted.** This is the single most
valuable thing this story hands to Stories 4.2 and 5.1. Beta, attached to a network with **no
backend at all**, simultaneously:

| Claim | Evidence |
|---|---|
| (i) is running | `docker ps --filter name=t5-fe-beta` → `Up 45 seconds (healthy)` |
| (ii) reports **healthy** | `docker inspect --format '{{.State.Health.Status}}' t5-fe-beta` → `healthy` |
| (iii) **cannot reach any backend** | `docker exec t5-fe-beta getent hosts crm-kong-gateway` → empty, exit 2 |
| (iv) serves traffic anyway | `curl http://localhost:19102` → `200` |

That is §4's failure mode reproduced end to end: **a stand on the wrong network comes up, passes its
own healthcheck, serves its static assets, and is structurally unable to reach its API.** The
healthcheck probes `127.0.0.1:80` — itself — and is blind to the backend by construction. No guard in
this compose file can catch it, and none was added to pretend otherwise.

**6.4 — `nginx.conf` re-read directly, exact current lines:**

```
39:        set $kong_upstream http://crm-kong-gateway:8000;
50:        set $kong_upstream http://crm-kong-gateway:8000;
```

Line 39 is inside `location /api/`, line 50 inside `location /ws/`; both hardcode the name **and**
the port `8000` identically, adjacent to the `resolver` lines at 38 and 49. Confirms the story's
citation. **The `KONG_PORT=8330` question is carried forward unresolved** — see Open Question 3. It
was not settled by assumption, and it cannot be settled from this repository: if `8330` turns out to
be the *in-network* port rather than a published host port, PROD does not work and **no compose-level
change in this story, 4.2 or 4.3 could fix it** — it would require an `nginx.conf`/image change,
which Prohibition 4 puts out of scope.

**6.3 — the honest limit, stated as a limit.** All of Task 6 ran on **local bridge networks with a
fake Kong**, not on `crm-dev-network` on s1 against the real one. It proves the **mechanism** — that
alias resolution is network-scoped, and that the healthcheck is blind to backend reachability. It
does **not** prove the real `crm-kong-gateway` alias is present on any s1 network today. Handed to
Story 4.2 by name in Task 8.4.

> ⚠️ **Stand-in image, and what that costs.** `nginx:alpine` was used throughout Tasks 5 and 6 — the
> real image needs registry auth unavailable here. It serves on 80 and carries busybox `wget`, so the
> compose healthcheck runs exactly as written, and the five identity axes, network isolation and port
> mapping are all genuinely exercised. What it does **not** exercise is the real `nginx.conf`'s
> `/api/` and `/ws/` proxy behaviour — which is precisely why Task 6 tested DNS resolution directly
> via `docker exec` instead of leaning on the container's own proxying.

#### Task 8.4 — Explicit handoffs

**🔴 To Story 4.3 (deploy + health check), by name:**

1. **No deploy path may create the network.** Not `docker network create … || true`, not `--create`,
   not a "make sure it exists" step. `external: true` is the **only** loud failure available on the
   network axis, and Task 6 above is the demonstration of what its absence costs: a stand that starts,
   reports healthy, and reaches nothing. `CD.yml:185` is the anti-pattern, in this repository, today.
2. **The health check must read `CONTAINER_NAME` and `FRONTEND_PORT`** (FR20) — it must **not** repeat
   `CD.yml:233`'s hardcoded `curl http://localhost:8080`, which ignores `FRONTEND_PORT` entirely and
   would probe the legacy stand while claiming to have checked a new one.
3. **A new stand must never be named `fe-prionex`.** `CD.yml:201` force-removes that literal name, and
   Task 5.4 confirmed by observation that `docker rm -f` is name-based and project-independent — it
   crosses compose projects.
4. **A CI gate built on `docker compose config` is not sufficient.** Matrix row 7a/7b proved `config`
   renders happily against a network that does not exist; only `up` catches it.
5. 🔴 **The deploy step must not export any of the five variables into the environment of the
   `docker compose` invocation.** Compose reads the process environment **before** `--env-file`, so an
   exported `FRONTEND_PORT` or `CONTAINER_NAME` silently overrides the stand's `.env` and **no `:?`
   guard fires** — demonstrated above. This collides directly with §8 convention 1 (values arrive
   through `env:`) and with handoff item 2 (the health check needs both names). **Read them back from
   the rendered `docker compose config` or from `docker inspect`, not from a parallel `env:`
   binding.**

**🔴 To Story 4.2 (the DEV stand on s1), by name:**

1. **Read s1's `docker compose version` before trusting this file there.** Everything in this record
   is bound to local v5.3.0. The version that matters is s1's and this story could not read it.
2. **Repeat Task 6 on s1**, from inside the real DEV stand's container against the real
   `crm-dev-network`. 🔴 **If `crm-kong-gateway` does not resolve there, that is a STOP — not a
   fallback to the legacy `crm-network`.** Falling back silently reproduces exactly the collision
   [D4](../../docs/migration-decisions.md#d4) and AC4's 2026-08-13 amendment exist to prevent.
3. **The replay sequence (Task 5.5), verified locally end to end:**

```bash
# 1. Create the stand's external network — ONCE, out of band. No deploy step may do this.
docker network create <stand-network-name>          # e.g. crm-dev-network

# 2. Stand directory and .env, per FR26: ~/crm-prionex/fe-prionex-<stand>/
mkdir -p <stand-dir> && cd <stand-dir>
cp <repo>/docker-compose.stand.yml .
cp <repo>/.env.stand.example .env && $EDITOR .env    # every value is CHANGE_ME by design

# 3. Bring up FROM the stand directory — never from the repo root, which declares name: fe-prionex
docker compose -f docker-compose.stand.yml --env-file .env up -d

# 4. Observe from Docker, not from the .env you just wrote
docker compose ls
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}'
docker inspect <container> --format '{{json .NetworkSettings.Networks}}'
docker compose -p <project-name> ps
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:<port>
docker inspect --format '{{.State.Health.Status}}' <container>
docker exec <container> getent hosts crm-kong-gateway   # ← AC4. Empty = STOP, not fallback.

# 5. Teardown, isolated to this stand
docker compose -f docker-compose.stand.yml --env-file .env down
```

4. **Story 4.9 inherits the verdict-(b) debt:** `docker-compose.server.yml` and
   `docker-compose.stand.yml` coexist until the cutover converges them.

#### Task 9.2 — AC closure, on observed evidence

| AC | Status | Evidence |
|---|---|---|
| AC1 — project + container name from variables | ✅ | Matrix rows 1, 2, 3. Both required, no defaults. Probe 1 confirmed `COMPOSE_PROJECT_NAME` precedence on v5.3.0; probe 2 confirmed top-level `name:` **is** interpolated, so the conservative fail-closed form renders — **no deviation needed**. |
| AC2 — port supplied, never defaulted | ✅ | Matrix row 4. Refusal, and no `8080` fallback — proven by the render never completing. `8080` appears nowhere in the new file. |
| AC3 — image default **removed** | ✅ | Matrix row 5. Second branch taken per §3; `:latest` cancelled (D20 §4), `PUSH_LATEST=false`, no single default is right for three environments under Option C. |
| AC4 — network is a variable **and** the backend each stand reaches is recorded | ✅ *locally* | Matrix rows 6 and 7; Task 6.1/6.2 — alpha resolves `crm-kong-gateway` to `172.19.0.3`, beta gets NXDOMAIN while reporting `healthy` and serving 200. **s1 verification handed to Story 4.2 by name** (6.3). |
| AC5 — two stands coexist | ✅ | Task 5.3 — five axes observed distinct from `docker compose ls` / `docker ps` / `docker inspect`, not inferred from the `.env`. |

Guard matrix: **all seven rows present, including the discriminating row 7.** Retro E5 satisfied.

#### 🔴 Measured on s1 2026-08-19 — the legacy stand is not on s1, and three documents said it was

**This is the only place this story amended `epics.md`, and Task 8.3's condition is met literally: a
measurement contradicts the plan.**

| Claim | Where | Measured |
|---|---|---|
| "DEV and PRE-PROD coexist on s1 **alongside the untouched legacy stand**" | `epics.md` FR25 `:228` | **False.** The legacy stand is not on s1. |
| "**Given** s1 already hosts the legacy DEV stand" | `epics.md`, Story 4.2 AC1 `:1604` | **False.** Story 4.2's opening premise. |
| "three fronтend stands on s1: legacy `8080`, DEV `8082`, PRE-PROD" | `preprod-infrastructure-requirement.md:120-121` | **False** — two, not three. |

**The evidence:**

- s1's addresses are `185.185.49.127` plus private ranges. **`72.62.17.132` is not among them** —
  and `72.62.17.132` is the legacy DEV stand (`README.md:136`; `CD.yml:157` deploys to
  `secrets.DEV_SSH_HOST`).
- On s1: **no `fe-prionex` frontend container**, running or stopped — the only `fe-prionex`-named
  containers are the four Forgejo runner/dind containers. **No `~/crm-prionex` directory.**
- **Nothing listens on `8080`.** The single listener in `8080-8085` is `127.0.0.1:8081`, which is
  `vm-cadvisor` publishing its own container port 8080 — the exact `docker-proxy` binding the
  2026-08-15 amendment measured, now confirmed independently.
- s1 carries 170 containers: the runners, the `crm-dev` and `crm-preprod` stacks, `techno-finance`,
  and observability.

**What this changes, and what it does not.**

- ✅ **NFR5's exposure on s1 is zero.** Nothing Story 4.2 does on s1 can touch the legacy stand,
  because it is on another machine. The "three stands coexist" risk framing was never real.
- ✅ **Story 4.2's AC1 is trivially satisfied**, and its directory is **created**, not placed beside
  an existing sibling.
- 🔴 **Story 4.1's verdict (b) is unaffected and remains correct.** The blast radius was never about
  host contention — it is `CD.yml` copying `docker-compose.server.yml` to `DEV_SSH_HOST` and
  force-removing the container there. That host is `72.62.17.132`, it is still live, and it is still
  unreachable from this plan. **If anything this sharpens the case for (b):** the endangered stand is
  on a machine this project has no access to and cannot roll back.
- 🔴 **Story 4.9's cutover is a cross-host traffic switch, not a file swap on one box.** "Cut DEV
  over to the new stand" moves `dev.crm-prionex.online` from `72.62.17.132` to s1. That is DNS and
  TLS work, and it is not what the story's current shape implies.

**Why nobody caught it earlier is the recurring lesson, not a new one.** FR25 already carries a
2026-08-15 amendment whose recorded conclusion is *"the instruction not to look is what produced the
wrong number."* This is the same defect one layer up: the coexistence premise was inherited through
four stories and never measured, because measuring it required the SSH access the plan had told
itself not to use. It cost one command to check.

#### Tasks 9.4 / 9.5 — the PR is NOT opened, and the reason is the same credential wall

🔴 **Task 9.4 is not done, and is not claimed as done.** The branch is pushed
(`story-4-1/pr-1-context` at `e0395fda`), but the PR could not be opened from this session:

- The Forgejo API returns **HTTP 403** unauthenticated — the same wall Task 1.3 and Task 9.1 hit.
- `gh` **is** authenticated on this machine, but **only to `github.com`**. Using it would perform an
  action on GitHub, which [D7](../../docs/migration-decisions.md#d7) forbids outright. Not attempted.
- No `tea` (Forgejo CLI) is installed and no Forgejo credential exists locally.

**Ready for Oleg, nothing else needed:** the full PR description is written to
`_bmad-output/implementation-artifacts/4-1-PR-description.md`, including the Task 9.5 statement that
per retro action **E5** this story is code-reviewed before Story 4.2 is written. Open at
`https://git.crm-prionex.com/CRM/fe-prionex/compare/main...story-4-1/pr-1-context` and paste.

**Do not merge to `main` directly** — protected, eight required contexts,
`apply_to_admins: true` ([D16](../../docs/migration-decisions.md#d16)).

## File List

**Added**

- `docker-compose.stand.yml` — the parameterized stand definition (Tasks 3.1-3.8)
- `.env.stand.example` — stand template, every value `CHANGE_ME` (Tasks 7.1-7.2)

**Modified**

- `docs/migration-decisions.md` — new record **D27** (Task 8.1)
- `_bmad-output/implementation-artifacts/deferred-work.md` — `:147` PRE-PROD `8081` → `8083`; Story
  4.1's opened items (Task 8.2)
- `_bmad-output/implementation-artifacts/4-1-parameterize-the-compose-file-for-coexisting-stands.md`
  — this file
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `4-1-…` → `review` (Task 9.3)

**Modified in review round 1**

- `.env.stand.example` — `CHANGE_ME` → `<CHANGE_ME>` (the blocking finding); per-variable failure
  modes documented; `8080`/`8081` named plainly
- `.env.dev.example`, `.env.production.example` — the Task 7.3 pointer that was recorded but never
  shipped
- `docs/preprod-infrastructure-requirement.md` — `:114`, `:120-121`, `:237`: stale `8081` → `8083`
  with an amendment marker. **This is the document Story 5.2 reads**, and it carried the wrong number
  in bold under the heading *"порт 8081 — постоянная аллокация"* — the exact claim measured false.
- `docs/forgejo-migration.md` — `:226`, `:353`: same correction

**Deliberately NOT modified**

- 🔴 `docker-compose.server.yml` — **Task 1.4 verdict (b).** Not one byte. This is the story's central
  decision and a recorded deviation from FR25.
- `.github/workflows/CD.yml` — read only ([D7](../../docs/migration-decisions.md#d7), Prohibition 7)
- `nginx.conf`, `Dockerfile.prod`, `.forgejo/workflows/*` — Prohibition 4
- `.env.dev.example`, `.env.production.example` — Task 7.3, conservative default
- `epics.md` — Task 8.3; no measurement contradicted it, so it was not amended to match a decision
- `README.md:136` — Task 7.4, pre-existing, tracked at `deferred-work.md:813`, costs a run

## Change Log

| Date | Change | By |
|---|---|---|
| 2026-08-19 | Story contexted against baseline `3ace40de`. Live state of `docker-compose.server.yml` bound verbatim; legacy `CD.yml` copy path identified as the story's blast radius; retro actions D4 and E5 carried into Tasks 2, 4 and 9. | create-story |
| 2026-08-19 | **Code review round 1 (Opus, adversarial) — CHANGES REQUIRED, ten findings, all applied.** It reproduced all seven matrix rows verbatim and confirmed every Prohibition holds in the compose file, so nothing in `docker-compose.stand.yml` changed. The defects were in the **template** and in **claims this record made that the artifacts contradicted**: (1) 🔴 blocking — `CONTAINER_NAME=CHANGE_ME` was a *valid* Docker container name, so the "no working values" claim was false and an unedited template would have started a stand named `CHANGE_ME` that Story 4.3's health check would have passed; fixed with `<CHANGE_ME>` so invalidity is the mechanism, not a grammar coincidence. (2) Task 7.3's pointer was recorded in three places and never shipped. (3) Prohibition 2's `8081` obfuscation was self-inconsistent — the story wrote the digits in two documents it authored — and is now resolved as binding *values*, not warnings. (4) "the last stale `8081`" was false; four more remained, including `preprod-infrastructure-requirement.md`, the document **Story 5.2 reads**, in bold. (5) Tasks 4.1/4.2 shipped conclusions where §8 demands outputs — transcripts added, and the probes rebuilt as discriminating files since neither is discriminating against `docker-compose.stand.yml` itself. (6) A bypass no guard can close: compose reads the process environment **before** `--env-file`, so an exported variable silently overrides the `.env` — handed to 4.3 as handoff item 5. (7) `8080` now named in the template. (8) This story's own Task 8.2 edit shifted `deferred-work.md` by +5 and invalidated four of its own citations. (9) D27's index row was out of numeric order. (10) `nginx.conf:1` → `:2`. | code-review |
| 2026-08-19 | Implemented. **Task 1.4 verdict (b)** — the GitHub push-mirror question could not be settled (Forgejo API 403 unauthenticated, no local token, no s1 alias), so `docker-compose.server.yml` is left untouched and the parameterization lands as the new `docker-compose.stand.yml`. Seven-row guard matrix executed live (E5), two stands observed coexisting, backend resolution recorded from inside both containers. D27 written. Ledger declared in advance and closed **OPEN** — no Forgejo credential reachable, per D4's second branch. | dev-story |
