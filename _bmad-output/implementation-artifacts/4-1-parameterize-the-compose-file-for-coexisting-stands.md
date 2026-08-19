---
baseline_commit: 3ace40de
---

# Story 4.1: Parameterize the Compose File for Coexisting Stands

Status: ready-for-dev

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

**Container-side port 80 is fixed in three places and is NOT part of this story:** `nginx.conf:1`
(`listen 80`), `Dockerfile.prod:59` (`EXPOSE 80`), and the healthcheck at line 16. Only the host side
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
      — it is a pre-existing documentation error tracked in `deferred-work.md:808`, not this story's
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
- `sprint-change-proposal-2026-08-13-kong-naming.md` §4.2 (this AC's amendment), §4.3 (Story 4.2)
- `sprint-change-proposal-2026-08-15-preprod-reality.md` lines 31 and 70 — `8081` measured taken on
  s1 (`docker-proxy` for `vm-cadvisor`), FR25 amended `8081` → `8083`

---

## Open Questions for Oleg

### Blocking

1. 🔴 **Does the GitHub copy of `CRM/fe-prionex` still receive commits from Forgejo?** Task 1.3 tries
   to answer it from the instance; if it cannot, only Oleg knows, because the GitHub-side transfer is
   his and lives outside this plan (D7). **The answer decides whether `docker-compose.server.yml` is
   edited in place or left alone until Story 4.9.** Default while unanswered: leave it alone.

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

---

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Run Budget Ledger

*Declared (Task 2):*

*Closed (Task 9.1) — by query, or explicitly OPEN:*

### Guard Outcome Matrix (retro E5 — all seven rows required)

| # | Input | Command | Verbatim outcome |
|---|---|---|---|
| 1 | all set | | |
| 2 | `COMPOSE_PROJECT_NAME` unset | | |
| 3 | `CONTAINER_NAME` unset | | |
| 4 | `FRONTEND_PORT` unset | | |
| 5 | `DOCKER_IMAGE` unset | | |
| 6 | `FRONTEND_NETWORK` unset | | |
| 7 | **discriminating** — network absent | | |

### Completion Notes List

## File List

## Change Log

| Date | Change | By |
|---|---|---|
| 2026-08-19 | Story contexted against baseline `3ace40de`. Live state of `docker-compose.server.yml` bound verbatim; legacy `CD.yml` copy path identified as the story's blast radius; retro actions D4 and E5 carried into Tasks 2, 4 and 9. | create-story |
