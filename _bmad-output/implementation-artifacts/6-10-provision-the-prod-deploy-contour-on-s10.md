<!-- Story 6.10. Epic 6's THIRD story to be written (6.1 cancelled, 6.2 done and merged as
     cfbad179, 6.3 written and PAUSED on Oleg's instruction). Written 2026-08-26 by the
     create-story context engine, from a scratchpad worktree branched off
     `docs/prod-temporary-hostname` (NOT off `origin/main` — see §0: D43 is not on main yet and
     this story cannot be read without it). Story 6.3's dev agent is working in parallel on
     `story-6-3/pr-1-context`; the primary checkout is not this story's.
     READ THE WHOLE "Read this before anything else" BLOCK BEFORE THE FIRST TASK.
     §0 is where this file physically lives and why. §2 is the ordering constraint and it is the
     reason this story exists at all. §3 is the FIFTH VARIABLE — the epic's ACs name three, the
     compose file requires five, and the fifth has NO OWNER ON s10. §4 is the label→image binding,
     a decision the epic never mentions and that cannot be deferred past registration. §5 is where
     "registered" is actually read from, and the two sources disagree. §6 is the two credentials
     that are not the same credential. §7 is the traffic path, which acquired a concrete, measured,
     WORSE state on the morning this story was written. §12 states what may not be touched.
     Nothing below is a suggestion. -->

# Story 6.10: Provision the PROD Deploy Contour on s10

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a release engineer,
I want the new PROD host able to receive a Forgejo deploy before any deploy story runs,
So that Epic 6 lands on a host that is measured ready rather than assumed ready.

---

## 🚨 Read this before anything else

### 0. 🔴 Where this file lives, and the dependency that decided it

This story is contexted on branch **`story-6-10/pr-1-context`, branched from
`docs/prod-temporary-hostname` (`1c54f32d`), not from `origin/main` (`cfbad179`).**

The reason is not stylistic. **`docs/migration-decisions.md#d43` does not exist on `main`.** It was
written by Oleg outside any story on 2026-08-26, in two commits (`bd4e4b83`, `1c54f32d`), on a local
branch that at the time of writing is **neither merged nor pushed**. D43 is this story's single most
important input: it names the PROD stand's public address, it chooses the traffic path *through the
hypervisor*, and its §8 hands this story an ordered blocker list in which **`FRONTEND_PORT` from
Story 6.10 is item 2**. A context branch off `main` would cite an anchor that resolves to nothing.

**Consequence, and it is Oleg's to resolve, not the dev agent's:** this story's PR carries
`bd4e4b83` and `1c54f32d` as well as its own commits. If Oleg intends to merge
`docs/prod-temporary-hostname` as its own PR first, that is strictly better and this branch should
be rebased onto `main` once it lands — the two commits are then already present and the merge is a
no-op for them. **Open Question 1.** Do not resolve it by force-pushing anything.

🔴 **Second, unrelated, and it belongs to a different story — report it, do not fix it.** Story 6.3's
context file (`story-6-3/pr-1-context`, written 2026-08-26 03:22Z) declares in its own §12 that it
will **append `D43`**. Oleg minted D43 himself ~5 hours later, at 08:21Z. **6.3's number is taken and
6.3 does not know it.** This story does not edit 6.3's file, does not push to its branch, and does
not renumber anything of 6.3's — it names the collision here and in Open Question 2 so it is caught
before two branches write the same anchor.

### 1. What this story is, in one paragraph

Every other Epic 6 story assumes a host that can receive a deploy. **No such host exists yet.** s10
(VM `e1-rung3`, `192.168.122.11`, reachable only as `ssh -J root@62.112.10.55 root@192.168.122.11`)
today carries exactly one thing relevant to this plan: a **CI-shaped** Forgejo runner, id 21, whose
jobs execute inside its own dind and which therefore **cannot deploy anything to the host it runs
on** (`#d23`). This story provisions the deploy-shaped counterpart and the four host-side facts a
deploy needs — a deploy runner bound to the **host** Docker daemon, split-horizon name resolution
for the registry, a read-only pull credential, and the stand directory with its `.env` — and then
**stops**. It builds no workflow, dispatches nothing, deploys nothing, and starts no container. Its
last act is to write down the traffic path with its owner and its current state, and to update
`#d23` with what was provisioned and what is still somebody else's.

**This story is the one Epic 6 ordering constraint that is written down in three places.** It must
complete **before Story 6.4**. Same precedent as Story 1.13 before 1.12 — a story listed late and
executed early, because numbering preserves history and execution order follows dependency.

### 2. 🔴 The ordering constraint — verified against the sources, not taken on the plan's word

Checked in all three places that assert it, because a constraint repeated three times is usually
repeated from one place:

| Source | What it says |
|---|---|
| `epics.md:2763-2765` (Story 6.10's own header) | *"Listed after 6.9 to preserve numbering, **must complete before Story 6.4** — the precedent is Story 1.13"* |
| `sprint-status.yaml:1217-1218` (Epic 6 handover) | *"Ordering first: 6.10 (the s10 contour) MUST complete before 6.4, same precedent as 1.13 before 1.12."* |
| `sprint-status.yaml:1300-1301` (Epic 6 as of 2026-08-25) | *"Ordering constraint still standing: 6.10 … MUST complete before 6.4."* |

**They are three statements of one constraint, and the mechanism behind it is real and checkable:**
`deploy-stand.yml:263` is `runs-on: ${{ inputs.runner_label }}`, and Story 6.4's amended `runs-on` AC
(`epics.md:2559-2563`) requires *"the label Story 6.10 registers, **not** `s10`/`e1-rung3`"*. **An
unmatched `runs-on` label queues SILENTLY on this instance** (`sprint-status.yaml`, Epic 6 handover,
the `deploy-preprod-preprod` finding). So 6.4 without 6.10 does not fail loudly — it hangs.

**What this story does NOT inherit from that constraint:** it is not blocked by 6.3, and 6.3's pause
does not block it. 6.3 is registry work; 6.10 is host work; 6.3's own §12 says of s10 *"Not touched,
not probed, not prepared. Story 6.10's."* The two are independent and may run in parallel. **They
share exactly two files** — `sprint-status.yaml` and `docs/migration-decisions.md` — and §12 prices
that collision.

### 3. 🔴 THE FIFTH VARIABLE — the epic asks for three, the compose file requires five, and the fifth has no owner on s10

**This is the most important finding in this file. Read it twice.**

The epic's fourth Given (`epics.md:2803-2807`) says:

> **Then** `~/crm-prionex/fe-prionex-prod/` exists on s10 with its server-side `.env`
> (`COMPOSE_PROJECT_NAME`, `CONTAINER_NAME`, `FRONTEND_PORT`)

**`docker-compose.stand.yml` requires FIVE variables, every one `${VAR:?…}` with no default** (D27,
and read directly from the file's own `name:`, `image:`, `container_name:`, `ports:` and `networks:`
blocks): `COMPOSE_PROJECT_NAME`, `CONTAINER_NAME`, `FRONTEND_PORT`, **`DOCKER_IMAGE`**,
**`FRONTEND_NETWORK`**. A `.env` carrying only the three named above **cannot start the stand.**
Story 5.2 hit this exact gap on PRE-PROD and corrected it in its own AC1 note; **6.10 inherits the
correction, it does not get to rediscover it.**

**Of the two missing variables, one is merely awkward and the other is a genuine external blocker.**

**(a) `DOCKER_IMAGE` — awkward, and the honest value is a refusal.** No `-prod` image exists in the
registry. Minting one is **Story 6.3's**, and 6.3 is PAUSED pending Oleg's own commit import. So the
`.env` cannot carry a real value. It carries an explicit non-value that fails closed and says why —
see AC4. It is **not** filled with a `-preprod` or `-dev` tag "so the file is complete": the
tag↔environment guard exists precisely to stop a `-dev` tag reaching PROD, and a `.env` that would
defeat it if anyone ran it by hand is worse than an obviously-unfinished one.

**(b) 🔴 `FRONTEND_NETWORK` — this one is an external dependency with no measured owner on s10, and
nothing in this repository may create it.**

`.env.stand.example:89-118` is unusually blunt about this axis, and it is right:

> *"THIS IS THE ONE AXIS WHERE A WRONG VALUE FAILS SILENTLY, and no guard can catch it. … The network
> must ALREADY EXIST before this stand is brought up — it is created by the corresponding
> api-prionex stack. This compose file never creates it, and no deploy path may either:
> `external: true` refusing to start is the ONLY loud failure available on this axis, and
> auto-creating the network converts that refusal into an empty, backend-less network that comes up
> happily (`CD.yml:185` is exactly this anti-pattern)."*

The named PROD value is **`crm-prod-network`**. **And the neighbour's plan puts that network on s2,
not on s10.** Measured, in their own repository, and recorded in
`docs/preprod-infrastructure-requirement.md:226`:

> `PROD: STACK=crm-prod, сеть crm-prod-network, KONG_PORT=8330` — `docs/forgejo-prod-s2-plan.md:69`

**The file name is the finding.** `CRM/api-prionex`'s PROD plan is a **s2** plan. The frontend's PROD
stand moved to s10 on 2026-08-18 (`#d23`); **the backend's did not, and nobody has asked it to.** So
the four live possibilities, in the order this story must distinguish them, are:

1. `crm-prod-network` does not exist on s10 and no backend does either → the stand can never start
   there as configured. **This is the expected finding.** Story 6.4 is blocked on an external party.
2. It exists on s10 with a real Kong carrying the `crm-kong-gateway` alias → measure and record it;
   nothing is blocked.
3. It exists on s10 as an empty, backend-less network → the worst case, because the stand would come
   up `healthy` and serve 200 while resolving nothing (Story 4.1 Task 6.2 demonstrated exactly this).
4. The PROD backend stays on s2 permanently and the browser reaches it cross-host by its public API
   name → **plausible, and it is the only one of the four that makes the current topology coherent**,
   because the handover already states the browser NEVER traverses the container's own `/api/` proxy:
   `src/lib/api.ts` bakes an ABSOLUTE `VITE_API_BASE_URL` and every call goes straight there.

🔴 **Do not resolve (4) by reasoning.** It is exactly the shape of claim this project has been wrong
about twice — and `epics.md:783`'s failure class (green build, dead image) is the cost.

#### 🔴 ANSWERED by Oleg, 2026-08-26, verbatim: **«возьми из s2»**

**Open Question 3 is closed as an escalation and reopened as a measurement.** The instruction is
literal and it is the right one: **the answer is already on s2 — go and read it there.** This is
Story 1.6's own lesson applied (*measure the neighbour's convention before writing the ask*), and it
is the method `#d23` used for s10 itself.

**What it changes, concretely:**

- The ask to `CRM/api-prionex` is **not written**. Nothing is escalated to them by this story.
- **s2 becomes a read target for this story** (it already was one for AC3's credential pattern). The
  read is over the **NFR7 administrative SSH path only** — `root@175.110.122.17` — and it is a read
  in the strict sense: `docker network ls`, `docker network inspect`, `docker ps`, `docker inspect`.
  🔴 **No write of any kind, and no Forgejo job on `s2-prod-deploy` — NFR5 is untouched by this**
  (§12 already permits exactly this shape of contact and nothing wider).
- **Prohibition 3 becomes conditional, not lifted.** `docker network create` on s10 is permitted
  **only** as an exact reproduction of what was measured on s2, announced verbatim first (§11), and
  recorded as a deliberate act with its measurement attached. It stays forbidden as an invention, as
  a "so the `.env` is complete" convenience, and **absolutely** as anything a deploy path does
  automatically — `CD.yml:185`'s anti-pattern is still the anti-pattern.
- **The silent-failure warning does not go away, it gets an owner.** If s10's reproduction is an
  empty, backend-less network (§3 possibility 3), the stand will come up `healthy` and serve 200
  while resolving nothing. **That is acceptable only if it is written down as deliberate**, with the
  reason: the browser never traverses the container's own `/api/` proxy — `src/lib/api.ts` bakes an
  absolute `VITE_API_BASE_URL` and every call goes straight there. **Write that sentence into the
  `.env` header and into D45**, or a future reader will file it as a bug.
- 🔴 **The same read answers a second, unrelated open item, and it is free.** `#d43` §4 says the PROD
  API name **must be measured, not derived** — and s2 is where the running production's API name
  actually lives. The read of s2's Kong and legacy stand yields it. **Record it; do not act on it.**
  Choosing what `VITE_API_BASE_URL` will be for the s10 stand is Story 6.4's, not this story's.

**What remains genuinely undecided after this** is smaller and belongs elsewhere: whether the PROD
backend eventually moves to s10 or stays on s2 permanently is an architecture question owned by Oleg
and `CRM/api-prionex`, not by this story. 6.10 measures, reproduces, and records — AC7 and Tasks
2.13–2.14.

🔴 **And the gap has a second, already-parameterized consequence that makes it cheap to name now.**
`deploy-stand.yml` carries an input `expect_unrouted_api` (`:159`) — PRE-PROD must pass `false`
because `#d34`'s Kong routes real services. **If s10 has no backend network, 6.4's caller has to pass
`true`, and that is a declaration that PROD's frontend is deployed against no reachable gateway.** No
one should discover that while writing 6.4's `with:` block. Same for `image_env: prod`, which arms the
tag↔environment guard — that one is fine and needs no decision, but it is the other half of the same
`with:` block and belongs in the same handover.

**What this story does with it, concretely:** it writes `FRONTEND_NETWORK` into the `.env` as a
named, measured value if the network exists, or as an explicit blocked non-value if it does not; it
**never runs `docker network create`**; and it never brings the stand up either way (§13).

### 4. 🔴 THE LABEL→IMAGE BINDING — a decision that cannot be deferred past registration

The epic's first Given asks for *"a dedicated deploy label distinct from `s10`/`e1-rung3`"*. It does
not mention that **on this platform a label is bound to a job image at registration time**, and that
choosing wrong is not a config edit afterwards.

**Trap 1, established by Story 1.7 and recorded twice** (`deferred-work.md:255-262`,
`migration-decisions.md#d13`): registering with `--labels 'deploy-prod'` — a bare name, no
`:docker://<image>` suffix — **silently resolves to the runner's default image. No error, no warning,
`register` reports success.** The failure surfaces later as something that looks like an action
incompatibility. **Trap 5** (same source): the label→image binding is fixed at registration; changing
it means **re-registering**, or a per-job `container:` override in exactly one job out of all.

**So the image must be chosen before the registration command is typed.** And `deploy-stand.yml` —
which is Story 6.4's callee and this runner's only real consumer — states its requirements of that
image directly in its own code, not in prose:

| Requirement | Where | Why it is load-bearing |
|---|---|---|
| `docker` CLI, talking to the **host** daemon | `deploy-stand.yml:323`, `:334`, `:389`, `:583` | `docker inspect "$(hostname)"`, sibling lock holder, `compose` — all through the mounted socket |
| **`flock`** and **`timeout`**, both | `deploy-stand.yml:589-597` — an explicit preflight that FAILS the job if either is missing | NFR10's serialization is the `flock`, not the `concurrency:` block |
| `git` (authenticated fetch over HTTPS) | `deploy-stand.yml:606-620`, "Obtain docker-compose.stand.yml" | The callee clones the repo with `github.token`; **an anonymous fetch of this private repo fails in under a second** — that is how runs 919/922 were lost |
| `curl` | 12 call sites | Registry reachability, health fallback |
| `date` | 21 call sites | 🔴 **`deferred-work.md:3239-3249`: busybox `date` on `deploy-base-dev-preprod:2026-08-07` cannot parse ANY numeric timezone offset via `-d`.** Verify the chosen image's `date` before trusting a `-d`-based step |
| **NOT** a `uses:` runtime | `deploy-stand.yml:55`, `#d23`-era note at `migration-decisions.md:3210` | `deploy-base-dev-preprod:2026-08-07` has no Node runtime and **executes no `uses:` steps at all**. 6.4's caller must be written accordingly — but that is 6.4's problem, not this story's, *unless this story picks an image that changes the answer* |

**s1's answer is `deploy-base-dev-preprod:2026-08-07` — and it is not available to us.** It is a
host-local image on s1, built by the hub's administrator; this project has never seen its Dockerfile
and does not own it. **s10 needs its own answer.**

#### 🔴 ANSWERED by Oleg, 2026-08-26: public egress from s10 is **available** («доступен»)

**The job image may come from a public registry.** That removes the hard branch below — but it does
**not** remove the measurement, and Task 2.7 stays as written. The reason is not pedantry: `#d23`
measured that the *registry* answers only over wg-private and that the host has no `/etc/hosts`
entry, so *"the host has egress"* and *"the host daemon can pull image X"* are two different
statements on this box. **Oleg's answer turns Task 2.7 from a decision gate into a confirmation:** if
it fails, that is a live contradiction with a stated fact, and the story stops and reports it rather
than quietly falling back.

🔴 **The constraint itself, kept because it is what the measurement is for: can the s10 host
daemon pull from a public registry at all?** `#d23` measured that the **registry** answers only over
wg-private, and that the host has no `/etc/hosts` entry for it. It measured **nothing** about the
host's public egress for other registries. The CI runner id 21 runs
`ghcr.io/catthehacker/ubuntu:act-22.04`, but that image is pulled by its **dind sidecar**, not by the
host daemon — different network path, and one does not prove the other. **Measure it. Do not infer
it.** Per Oleg's answer the expected result is success; if it nonetheless fails, the job image must be
built locally on s10 from a base that is already present, or pulled through the wg-private registry —
**and the contradiction is reported, not absorbed.**

**Recommendation, to be announced and then executed unless vetoed** (§11): choose the smallest image
that provably carries the tool set, **prove the tool set with a single command before registering**,
and record the exact `label:docker://image` string in three places — the registration command, the
`.runner` file read back, and the decision record. **The proof command is in Task 3 and it is not
optional.**

### 5. 🔴 Where "registered" is actually read from — and the two sources disagree, live

**In plain terms first, because this one reads as pedantry until it costs a day.** When a runner
registers, its labels are written to **two independent places**: the **`.runner` file on the runner's
own host** — what the runner thinks about itself — and the row
**`action_runner.agent_labels` in Forgejo's database on the hub** — what the **scheduler** reads when
it decides which runner takes a job. **The scheduler only ever consults the second one** (`#d33`).
So if Story 6.4 writes `runs-on: deploy-prod` and `deploy-prod` is in `.runner` but missing from the
DB, **the job does not fail. It queues, and it hangs there, silently, with no error.** Checking
`.runner` and seeing the label present does not catch that case at all. That is why AC1 requires both
reads.

The epic's first Given requires *"the registration scope (instance/org) is verified to make it
reachable from `CRM/fe-prionex`"*. Verifying that means reading the registration back. **There are
two places to read it and this project has caught them disagreeing, twice, on the same runner.**

| Source | What it showed for `s1-deploy-dev-preprod` | Date |
|---|---|---|
| The runner's own on-disk `.runner` file | **four** labels, each with a full `docker://` spec | 2026-08-19, Story 4.2 |
| `GET /orgs/CRM/actions/runners` | **one** label | 2026-08-11, Story 1.7 |
| `select agent_labels from action_runner where name='s1-deploy-dev-preprod'` | **one** — `["deploy-dev-preprod"]` | 2026-08-24, Story 5.3 Task 2.3 |

`deferred-work.md:3789-3798` states the consequence and hands it forward by name:

> *"Whichever story next legitimately edits `deploy-stand.yml` should fix the skeleton's label AND
> resolve (or at minimum re-measure) this DB-vs-disk disagreement **before picking an s10 label for
> PROD by the same method** — Story 6.4 will need a working answer, not an inherited assumption."*

🔴 **The DB is the scheduler's actual source** (`#d33`). A label that exists in `.runner` but not in
`action_runner.agent_labels` is a label the scheduler will never match — and an unmatched `runs-on`
**queues silently**. **Therefore AC1 is not closed by `.runner` alone.** It is closed by both reads
agreeing, or by the disagreement being measured, pasted, and named. **This story does not edit
`deploy-stand.yml`** (§12) — the skeleton-comment half of that deferred item stays with 6.4; only the
re-measurement half is discharged here, on the new runner.

### 6. 🔴 Two credentials, and they are not the same credential

The epic's third Given asks for a read-only pull credential on s10, its account and scope recorded, a
push refused with `401`, and **no `write:package` credential anywhere on s10**. All correct, and it
proves less than it looks like it proves — so say what it proves.

**The host credential (`/root/.docker/config.json` on s10)** is what AC2's *"a host-level `docker
pull` … succeeds — this is the proof, not a `curl`"* actually exercises. **The deploy path does not
read it.** `deploy-stand.yml:66-70` is explicit: *"`docker pull`/`docker login` resolve auth from
THIS job's own workspace-scoped `DOCKER_CONFIG`"*, populated from the **org secrets**
`REGISTRY_USER_RO` / `REGISTRY_TOKEN_RO`. This is D28's H4 finding, already paid for once: the
interactive root session's `config.json` is not on the deploy path, and choosing a stand-directory
mounting strategy never made it so.

**So the host credential is a record/DR artifact and an AC proof — exactly like the `.env`** (5.2's
finding: *"record / DR only. Nothing on the deploy path reads it."*). Write it down as that. A future
reader who believes the host credential is what the deploy uses will debug the wrong thing.

🔴 **And the host credential is known to vanish on s1 — twice, unattributed**
(`deferred-work.md:3800-3810`; `auths: {}` measured 2026-08-23T21:32:24Z, owner: Oleg). **Do not
assume durability on s10 either.** Record the date of placement so the next disappearance is
datable rather than rediscovered.

**Two further things this story must not confuse:**

- 🔴 **`read:package` is not enough to clone the repo.** Measured, not assumed
  (`deploy-stand.yml:606-608`): that credential gets a same-instance
  `403 required scope(s): [read:repository]` reading repo content. The deploy job's clone uses
  `github.token`, its own per-job token. **This story creates no repo-scoped credential on s10 and
  needs none.**
- ⚠️ **Every Forgejo token minted here is standing by construction.** An admin cannot revoke another
  account's token through the UI or the API — only by a row in the DB or with the account's password
  (`#d14` changelog, 2026-08-12). **Whatever is minted, its owner and revocation trigger go into
  `deferred-work.md` at the moment of issue, not at the end of the story.** That is the rule Story
  4.2 wrote after learning it the expensive way.

### 7. 🔴 The traffic path — it has a concrete state now, and it is worse than it was

The epic's fifth Given asks the story to name the traffic path *"with its owner and current state, as
an external dependency in the Story 6.9 sense"*, and to build nothing. **As of the morning this file
was written, that Given has a real value to close against for the first time.** `#d43` — and its §7
names this story by number:

> *"**Story 6.10** — при провижининге контура на s10 закрыть свой последний AC («traffic path named
> with its owner and current state») **этим именем и текущим состоянием из §5, а не абстрактным
> описанием**; и обновить `#d23`, как этот AC требует."*

**What is true, measured, on 2026-08-26:**

- `crm.prod.crm-prionex.online` is the PROD stand's own **temporary** public name. It exists so s10
  can be raised and validated under its own address while s2 keeps serving users — `#d23`'s "two
  productions in parallel" state.
- 🔴 **It resolves and refuses the connection.** `crm.prod.crm-prionex.online. 14400 IN A
  62.112.10.55`, authoritative and on 8.8.8.8 / 1.1.1.1 / 9.9.9.9, zone SOA `2026082601` →
  `2026082602`. Ports 80 and 443 on `62.112.10.55` answer **`refused` in 62 ms** (controls:
  `185.185.49.127` → 404/200, `175.110.122.17` → 404, so the refusal is the host's property, not the
  channel's). **This is the worst of the three states** — before 08:38Z the refusal was honest
  (NXDOMAIN, "there is no such name"); now the name exists with nothing behind it, and to an outside
  observer it looks like a broken application rather than an unconfigured environment.
- 🔴 **TTL is `14400`, not `300`** — Hostinger's silent default, wrong for a name declared temporary
  (up to four hours of stale answers at switch time). The same zone carries the deliberate
  counter-example: legacy prod `crm-prionex.online` at TTL 300.
- **The path is chosen and it is a fact, not a decision: public traffic enters through the
  HYPERVISOR, not through the hub.** That preserves `#d23`'s network model (the contour polls the hub
  outbound; the hub never reaches into the contour). The rejected alternative — a vhost on s1
  proxying over wg-private — would have inverted it and made s1 a single point of failure for
  production.
- 🔴 **`api.crm.prod.crm-prionex.online` is NXDOMAIN and MUST NOT be derived.** Two conventions are
  live at once: flat legacy `api.crm-prionex.online` on s2 versus `api.crm.<env>.crm-prionex.online`
  on DEV/PRE-PROD. `_check_url` in `build.yml` tests shape only — scheme, no whitespace, a dot in the
  host — so a wrong-but-valid host builds **green** and is dead in the browser.

**`#d43` §8's blocker list is ordered, and this story owns exactly one item of four:**

| # | Blocker | Owner |
|---|---|---|
| 1 | **hypervisor → VM route.** `#d23` measured `ssh root@192.168.122.11` from the hypervisor shell as *"No route to host"* while `ssh -J` from outside works; the discriminating mechanism is marked **"не проверено"**. A `443 → 192.168.122.11:<port>` forward lives in exactly that route — **so it is the first thing measured, not the first thing configured** | outside this repository; **this story measures and reports, changes nothing** |
| 2 | **`FRONTEND_PORT` of the stand** — the forward points at it | 🔴 **THIS STORY** (AC4) |
| 3 | nginx vhost + TLS certificate on `62.112.10.55` for this name. Execution precedent: Story 5.2 did exactly this for `crm.preprod` on s1 | outside this repository |
| 4 | exact `Access-Control-Allow-Origin: https://crm.prod.crm-prionex.online` on PROD's Kong — **which has never been probed, once** | `CRM/api-prionex`; Stories 6.4/6.7 |

**What this means for the last AC:** it closes against the table above with dates and measured
states, **not** against a paragraph describing a port-forward in the abstract. And AC5's second half
— *"nothing about it is built or changed by this story"* — is absolute: **no vhost, no certificate,
no DNS edit, no TTL change, nothing touched on the hypervisor.** Lowering the TTL is cheap and
correct and is **not this story's to do**; it is named as a recommendation to Oleg with its own
reason, and that is the whole of this story's involvement.

### 8. Previous story intelligence — what this story inherits, verified 2026-08-26

**From Story 5.2 (`provision the pre-prod stand on s1`) — the closest structural precedent, and the
one whose mistakes are cheapest to not repeat:**

- **Five variables, not three** (§3). 5.2's AC1 note is the correction; 6.10 starts from it.
- **`FRONTEND_PORT` binds to loopback on a host with a public IP.** PRE-PROD is
  `127.0.0.1:8083`, not `8083` and not `0.0.0.0:8083` — the bare form publishes on `0.0.0.0`.
  🔴 **s10's answer is NOT automatically the same**, and this is a real difference, not a copy: the
  hypervisor must forward `443` into the VM to reach this port (§7 blocker 1). Whether that forward
  can reach a loopback-bound port depends on the forwarding mechanism, which is **unmeasured**.
  Task 5 measures before choosing. **Choosing `0.0.0.0` "to be safe" is not available** — the VM is
  NAT-hidden but the decision must be recorded with its reason either way.
- **The host `.env` drifts, and 5.2 measured the drift on DEV rather than assuming it**: the DEV host
  `.env` still named a bare `8082` and a tag the stand had not run for days. **Label the file for
  what it is** — a record and DR copy — in a header comment inside the file itself. 5.2's Task 4.5.
- **`CONTAINER_NAME` is never the literal `fe-prionex`** — `CD.yml:201` force-removes that name on
  every legacy deploy, and `docker rm -f` is name-based and project-independent. Measured, Story 4.1.
- **M14:** a subtask owned by the coordinator was once checked `[x]` with no artifact anywhere in the
  record. That is why §11 exists in this file.
- **M1:** paste the artifact, do not characterise it.

**From Story 1.7 / 1.9 (`provision the runners`) — the registration precedent:**

- **Trap 1** and **Trap 5**: §4. Full `label:docker://image` specification, copied verbatim, verified
  in `.runner` afterwards — and 1.9 registered through the **interactive** form
  (`printf '<url>\n<token>\n<name>\n<labels>\n' | docker run --rm -i …`) because `--no-interactive`
  did not read stdin on that image.
- **`--add-host git.crm-prionex.com:<hub wg IP>` in `container.options`** — *"without it the job does
  not resolve the registry at all"* (`#d13`). On s1 that is `10.67.0.1`; **on s10 the measured value
  is `10.70.0.1`** (`#d23`). **They are different networks. Do not copy s1's octet.**
- **A crash test needs the signal sent from the host** against `docker inspect --format
  '{{.State.Pid}}'`; `docker exec … kill -9 1` silently no-ops inside the runner image and reports
  `exit=0`. (Relevant only if this story chooses to prove durability at all — see §9.)

**From Story 4.2 / D28 — the finding that decided how a deploy job reaches a stand directory:**

- The deploy job **does not need the host path at all.** D29 chose option (e): render
  `docker-compose.stand.yml` and the variables **in the job's own workspace**. `valid_volumes` limits
  what the **runner** mounts, not what the job does through the `docker.sock` it already holds.
- **But `stand_dir` is still a required input** (`deploy-stand.yml:122-124`) — *"the lock file lives
  at `<stand_dir>/.deploy.lock`… reached only through a sibling container via the `docker.sock` this
  job already holds."* So the directory must exist and be writable **by a container the job starts**,
  not necessarily by the job's own uid.
- s1's deploy runner mounts exactly: `-v /var/run/docker.sock:/var/run/docker.sock`,
  `-v /opt/crm-preprod:/opt/crm-preprod`, `-v /opt/crm-dev:/opt/crm-dev`,
  `--add-host=git.crm-prionex.com:10.70.0.1`. 🔴 **Note what is absent: the stand directories under
  `/root` are not mounted, deliberately** — and D28's amendment records that adding them would open
  the stand path **read-write into every job container of every repository allowed on that runner.**
  s10's runner is ours and single-purpose, so the same reasoning points the same way: **mount the
  socket, do not mount the stand.**

**From `#d38` §7 / Story 4.6 — the operating convention:** *"announce, don't ask twice."* A vetoable
autonomous act is announced verbatim through the coordinator **before** it happens and then executed;
absence of a veto is the answer. **This story's acts are reversible** (unlike 6.3's), so the standing
convention applies unmodified — with one exception named in §11.

**From the Epic 6 handover (`sprint-status.yaml:1215-1297`):**

- `deploy-stand.yml` arrives **working**; 6.4 writes a thin caller. Nothing here rebuilds it.
- `runs-on: ${{ inputs.runner_label }}` in a callee is **R1, confirmed live** — *"6.4 on s10 is the
  FIRST case where the label genuinely differs from DEV/PRE-PROD's."* That label is this story's
  output.
- Every deploy runner in this plan is **`capacity: 1`** — s1 today, *"s10 by Story 6.10's own
  design"* (`deferred-work.md:3156-3157`). Not a preference: it is why the group-vs-capacity axis is
  closed negatively and why NFR10 leans on the `flock`.
- 🔴 *"ASSUME NOTHING ABOUT THE PROD BACKEND UNTIL IT IS MEASURED."* §3 is that instruction applied.

### 9. What this story does NOT prove, said before it is asked

**retro-E5's rule** (and the four prior rejections behind it — `D34` §3, 5.1, 5.2's H2, 5.4's H1,
6.2's review): never claim a check that could not have failed. Applied to this story up front:

1. **"The deploy runner works"** is not proven by this story and cannot be. Nothing dispatches here.
   What is proven is *the runner is registered, idle, carries label L bound to image I, and its job
   image provably contains the tool set*. **The first real proof is Story 6.4's first dispatch.**
   Say `UNPROVEN`, name 6.4 as the prover, and stop.
2. **"The stand is ready"** is not proven either. `FRONTEND_NETWORK` may be blocked (§3) and
   `DOCKER_IMAGE` certainly is (6.3 paused). What is proven is *the directory, its permissions and
   its `.env` exist with N of 5 values real and the remainder explicitly blocked, each with a named
   owner*.
3. **"The port is free"** is a measurement with a timestamp, not a reservation. Nothing on s10 holds
   `FRONTEND_PORT` after this story measures it, because the stand is never started (§13). **Say
   "measured free at `<UTC timestamp>`", never "allocated".** FR25's own history is this exact
   mistake: `8081` was called a "permanent allocation" on the strength of a census run from the
   artifacts instead of by SSH, and was measured taken on 2026-08-15.
4. **A durability / crash test of the new runner is optional and is NOT run by default.** Story 1.9
   proved that class of claim properly and expensively, and repeating it here buys a re-proof of
   platform behaviour rather than anything about s10. **If it is run, it is run Story 1.9's way**
   (host-side `kill -9` against the real PID) or not at all. Default: not run, named as not run.
5. **Nothing here says anything about whether the traffic path works.** §7. It is measured, named,
   owner-attributed, and left.

### 10. Run budget model

Declared **before** work, per **retro-D4** (*"run-budget ledgers close only against a query … a
self-report without a query means the ledger is open"*). Story 6.2's measured overrun is applied
rather than repeated: it under-predicted the dev-story push count and carried no line for the
decision commit answering Oleg or for a mid-story `origin/main` integration merge.

**This story dispatches NOTHING.** All rows are CI rows caused by pushes. `ci.yml` has no `paths:`
filter, so a documentation-only commit still costs a full four-job run, and a push landing while the
PR is open fires both `push` and `pull_request` — **two rows**.

| Line | Rows |
|---|---|
| Push: context (this file) | 1 |
| Push: `sprint-status.yaml` → `in-progress`, own commit (Task 1.1) | 1 |
| Push: dev-story work — **3 commits budgeted, not 1** (6.2's lesson) | 3 |
| Push: the commit applying Oleg's answers to the Open Questions | 1 |
| Push: `origin/main` (or `docs/prod-temporary-hostname`) integration merge, if it moves mid-story | 1 |
| PR-open run | 1 |
| Push: code-review commit (PR open → **two** rows) | 2 |
| Push: fix-pass commit (PR open → **two** rows) | 2 |
| Merge run (`build-main.yml`) | 1 |
| **CI subtotal** | **13** |

| | |
|---|---|
| **Dispatch rows** | **0 — and a non-zero count is a defect in this story, not an overrun** |
| **Declared floor** — context + status + 1 dev-story push + PR-open + merge | **5** |
| **Declared ceiling** | **13** |

**Disposition: OPEN.** Closed only by the **coordinator**, against
`GET /api/v1/repos/CRM/fe-prionex/actions/tasks`, grouped by `run_number` and attributed by
**`commit_sha`** — never by id range, never by self-report. Filter `action_run` to `repo_id=16`
first. 🔴 **Story 6.3's dev agent is pushing to the same instance concurrently, and Story 4.9/4.10
branches exist: their rows are named and excluded, never absorbed.** An overrun is renegotiated
explicitly with a new stated ceiling, never smoothed at the merge.

🔴 **No-touch window.** The Sunday `dev-reset.yml` tick is **02:00 UTC**; the standing rule is **no
dispatch, no live lock holder and no `main` merge across 01:45–02:30 UTC.** Next tick:
**2026-08-30.** This story dispatches nothing, so the window binds only its **merge**. Hand the
constraint to the coordinator; do not assume it will be noticed.

### 11. Who does what — the labour split, and it is not negotiable here

- **The dev agent** does git, files, SSH and `docker` — **including all s10 and hypervisor work over
  the `ssh -J root@62.112.10.55 root@192.168.122.11` path**, which is the bulk of this story.
- **The coordinator** issues every Forgejo **dispatch** (there are none here), reads run and runner
  state through the **API**, mints the **registration token**, and closes the ledger. Subtasks owned
  by the coordinator are marked **`PENDING (owner: coordinator)`** and are **never** checked `[x]` —
  Story 5.2's **M14** exists because a subtask was checked with no artifact anywhere in the record.
- **Oleg** merges every PR, holds the veto on Dev Notes §5, and owns Open Questions 1, 2, 3 and 5.
- **"Announce, don't ask twice"** (`#d38` §7) applies unmodified: a vetoable autonomous act is
  announced through the coordinator **verbatim, before** it happens, and then executed — absence of a
  veto is the answer.
- 🔴 **One exception, and it is narrow.** The **runner registration** (Task 3) is announced **and
  confirmed**, not announced-and-proceeded, because the label→image binding is fixed at registration
  (§4, Trap 5) and undoing it means deleting a registration on a production host. Everything else in
  this story — the hosts entry, the credential, the directory, the `.env` — is reversible and follows
  the standing convention.

### 12. 🔴 Blast radius, frozen files, and the §12 exception procedure

**Three stories are in flight against this repository right now.** Story 6.3
(`story-6-3/pr-1-context`, PAUSED), Story 4.9 (`story-4-9/pr-1-context`, holds **D35**), Story 4.10
(`story-4-10/pr-1-context`, holds **D44**). **This story runs from a scratchpad worktree; the primary
checkout is not this story's and must not be touched.**

**This story must not modify, and must not push any change to:**

- 🔴 **Every file under `.forgejo/workflows/`.** Without exception. `deploy-stand.yml`,
  `deploy-preprod.yml`, `deploy-dev.yml`, `dev-reset.yml`, `build.yml`, `build-main.yml`, `ci.yml`,
  `record-preprod-candidate.yml`, `build-buildkit-cni-image.yml`,
  `verify-cni-netns-isolation.yml`. **This story ships no workflow code at all** — including
  `deploy-stand.yml:216`'s wrong `runner_label` skeleton comment, which is a known, filed, **Story
  6.4-owned** finding (`deferred-work.md:3780-3798`). Fixing it here would be a §12 exception bought
  for nothing.
- 🔴 **`deploy-prod.yml` is not created here, not even as a skeleton.** Story 6.4's.
- 🔴 **`docker-compose.stand.yml`, `.env.stand.example`, `docker-compose.server.yml`,
  `docker-compose.yml`, `Dockerfile*`, `nginx.conf`, `src/`, `vite.config.ts`.** The temporary public
  name **must never enter the built artifact** (`#d43` §6): `nginx.conf` reaches Kong by service name
  and `server_name` is `localhost`, deliberately, so the image is byte-identical across stands.
- 🔴 **`docs/release-validation-checklist.md`, `docs/preprod-candidates.md`,
  `docs/release-regulation.md`, `docs/production-approval-regulation.md`, `docs/prod-releases.md`.**
  This story validates nothing, records no candidate, and approves no release. **No row is added to
  `docs/prod-releases.md`.**
- 🔴 **`epics.md`.** Its 6.10 section is the specification being implemented, not an editable file.
- **`.github/workflows/CD.yml` / `CI.yml`** — read as evidence only, never edited, never triggered.
- **Story 6.3's file or any `story-6-3/*` branch**, and likewise `story-4-9/*` and `story-4-10/*`.
  §0's D43 collision is **reported**, not fixed.
- 🔴 **s2 — read only, and the read is now wider than this file first said.** 🔴 **AMENDED 2026-08-26
  by Oleg's «возьми из s2» (§3).** Permitted contact, and nothing beyond it: (a) reading its runner's
  registration through the **API** (AC6), and (b) an **administrative SSH read over the NFR7 path**
  (`root@175.110.122.17`) of its Docker state for AC7 and Task 2.13 — `docker network ls`,
  `docker network inspect`, `docker ps`, `docker inspect`. **Forbidden, unchanged and absolute:** any
  write, any `compose` verb, any restart, any `docker run`/`rm`/`rmi`, and **any Forgejo job on the
  `s2-prod-deploy` runner**. NFR5 as amended stands word for word: *"Forgejo never deploys to s2 at
  all."* Story 6.3 takes the same shape of read for its own AC1; this story's is the same path, a
  different subject, and equally read-only.
- 🔴 **The CI runner id 21 on s10, and its dind sidecar.** Confirmed untouched is an AC (AC1); making
  it true means not restarting it, not editing its compose file, not changing its labels, and not
  reusing its registration token.
- 🔴 **The second VM on the hypervisor, `e1-snp2`.** Not ours, not examined (`#d23`). Not touched,
  not probed, not listed beyond confirming it is not `e1-rung3`.
- 🔴 **The hypervisor `62.112.10.55` beyond a read.** No nginx, no certbot, no firewall rule, no port
  forward, no DNS edit, no TTL change. §7. Its route into the VM is **measured and reported**; that
  is the entire permitted interaction.

**Files this story is expected to change:** `docs/migration-decisions.md` (**append `D45`** — see
Task 1.3 — **and update `#d23` per AC6**), `README.md` (the Server Deployment row for s10 currently
reads *"decided by Story 6.10"* at line 140 — this story is what decides it),
`_bmad-output/implementation-artifacts/sprint-status.yaml` (status transitions),
`_bmad-output/implementation-artifacts/deferred-work.md` (anything genuinely left open, **and any
token minted, at the moment of issue**), and this file's own Dev Agent Record / File List / Change
Log.

**Host-side artifacts created on s10** (not files in this repository, but they are this story's
output and belong in the File List with their paths and modes): the deploy runner's project
directory and `config.yml`, `/etc/hosts`, `/root/.docker/config.json`,
`/root/crm-prionex/fe-prionex-prod/` and its `.env`.

**🔴 The §12 exception this story does NOT take.** It would be convenient to fix
`deploy-stand.yml:216`'s skeleton comment while the correct s10 label is fresh in hand. **Do not.**
The finding is filed, owned by 6.4, and 6.4 must edit that file anyway. Buying a workflow-file
exception for a comment is exactly the trade this project's §12 procedure exists to refuse.

### 13. Boundaries — seven things this story must not absorb

1. **It does not write, dispatch, or skeleton any workflow.** Stories 6.4–6.7.
2. **It does not deploy, and it does not start the stand.** No `docker compose up`, no `docker run`
   of the frontend image, no `docker pull` of a `-prod` tag (none exists). The AC2 pull proof uses a
   **real, currently-existing** tag — a `-dev` or `-preprod` one — because the proof is about the
   *host's registry access*, not about production content, and it is **removed afterwards** so the
   host cache does not carry a stray environment's image.
3. **It does not create the Docker network.** §3. `external: true` refusing to start is the only loud
   failure available on that axis and this story does not convert it into a silent one.
4. **It does not build a vhost, a certificate, a port-forward, or a DNS record**, and does not change
   the TTL. §7.
5. **It does not probe PROD's Kong, does not measure `KONG_PORT`, and does not send the CORS ask.**
   Stories 6.4/6.7 — `#d43` §7 assigns the CORS ask to them explicitly, now that an origin exists to
   put in it. 🔴 **Task 2.13 reads s2's Kong container and Task 2.14 reads the API hostname — that is
   a `docker inspect`, not a probe**, and neither concludes anything about routing, CORS or
   `KONG_PORT`. Pasting what s2 runs is inside this story; deciding what s10 will point at is not.
6. **It does not mint any `-prod` image or tag, and does not unblock Story 6.3.** 6.3 is paused on
   Oleg's own instruction and resumes on his signal, not on this story's completion.
7. **It does not generalize `dev-reset.yml`'s sweep to PROD.** `deferred-work.md:3983-3995` names
   "Story 6.4/6.10" as the next natural owner of that generalization. **This story DECLINES and says
   why:** it ships no workflow at all (§12), so it cannot generalize one. 🔴 **But it must record the
   consequence it does create** — see AC8 — because provisioning a third stand on a **16 GB disk with
   ~8.8 GB free** (`#d23`) makes the un-generalized sweep a capacity question on s10 in a way it never
   was on s1's 104-core host.

### Prohibitions

🚨 **A prohibition here cannot be overridden by a subtask.**

1. 🔴 **Never register a runner with bare labels.** Trap 1: `--labels 'deploy-prod'` silently binds
   the runner's default image, reports success, and fails later as something that looks like an
   action incompatibility. **Full `label:docker://image` specification, always.** §4.
2. 🔴 **Never register before the job image's tool set is proven** by the command in Task 3. Trap 5:
   the binding is fixed at registration.
3. 🔴 **`docker network create` on s10 is permitted for exactly one thing and forbidden for
   everything else.** 🔴 **AMENDED 2026-08-26 by Oleg's «возьми из s2» (§3).** Permitted: an **exact
   reproduction of the network measured on s2**, announced verbatim first (§11), recorded in D45
   with the s2 measurement attached. Forbidden, unchanged: inventing a network, creating one so the
   `.env` looks complete, creating one before s2 has been read, and **any** creation performed by a
   deploy path — `.env.stand.example:99-109` and `CD.yml:185`'s anti-pattern by name.
4. 🔴 **Never bring the PROD stand up.** No `docker compose up`, no `up -d`, no `--force-recreate`.
   The first deploy is Story 6.4's, through the pipeline, and going around it would be exactly the
   hand-deploy this whole migration exists to abolish.
5. 🔴 **Never touch runner id 21, its dind, or its registration token.** AC1 requires proving it
   untouched; reusing its token would make that claim false.
6. 🔴 **Never write to s2, and never run a Forgejo job on `s2-prod-deploy`.** NFR5.
7. 🔴 **Never change anything on the hypervisor `62.112.10.55`.** Measure the route, report it, leave.
   §7, §12.
8. 🔴 **Never place a `write:package` credential anywhere on s10**, and never `docker login` there
   with `REGISTRY_USER`/`REGISTRY_TOKEN_RW`. The absence of a write credential is an AC, and one
   ambient login makes it false retroactively.
9. 🔴 **Never write a token into a repository file, and never print a credential file's contents.**
   Shape checks only — length, key names, the base64-decoded **username**, never the secret.
10. 🔴 **Never claim the deploy runner "works".** §9(1). It is registered, idle and correctly bound;
    it is `UNPROVEN` until Story 6.4 dispatches.
11. 🔴 **Never call the measured-free port "allocated" or "reserved".** §9(3). FR25's own history.
12. 🔴 **Never derive `api.crm.prod.crm-prionex.online`, or write it anywhere.** §7. Two conventions
    are live and `_check_url` will not catch the wrong one.
13. 🔴 **Never let the temporary public name enter the image, `nginx.conf`, or any compose file.**
    `#d43` §6. It may appear only in documentation written by this story.
14. 🔴 **The dev agent does not dispatch, does not touch the Forgejo API, and does not open the PR.**
    Mark those subtasks `PENDING (owner: coordinator)`, never `[x]`. §11; Story 5.2's M14.
15. 🔴 **Never soften a disposition.** The four words are `UNPROVEN`, `OPEN`, `PENDING (owner: name)`,
    or the claim is not made. There is no fifth, softer word.
16. 🔴 **Paste the artifact, do not characterise it** (4.2 M3, 5.2 M1, 5.4 M10). A `.runner` file, an
    `ss -lntp` line, a `docker pull` digest, a `401` body — pasted, not summarised.
17. 🔴 **Re-measure; do not trust the 2026-08-18 snapshot.** `#d23` says so in its own words: *"the
    host is being provisioned right now … Story 6.10 must re-verify at execution time, not trust this
    snapshot."* Every fact in §7 and §8 that came from that session is a **hypothesis with a date**.

---

## Acceptance Criteria

> The five Givens of `epics.md:2761-2820` are AC1–AC5 and AC9, unchanged in intent and sharpened where
> §3–§6 showed the epic's wording proves less than it appears to. AC6–AC8 and AC10 are **added** and
> are marked as such.

### AC1 — A deploy-shaped runner exists on s10, bound to the host daemon, under a distinct label *(epic AC1)*

**Given** the hub's deploy-runner pattern (`s1-deploy-dev-preprod`, `s2-prod-deploy`)
**When** the deploy runner for s10 is provisioned **by us, on s10 itself** (Oleg's decision
2026-08-18: we hold root on the VM via the jump path; only the registration token comes from the
Forgejo side)
**Then** a runner registration exists on s10 whose jobs execute against the **host** Docker daemon —
proven by the runner's own config showing the host socket and **no** `DOCKER_HOST` pointing at a dind
sidecar — carrying a dedicated deploy label distinct from `s10` / `e1-rung3`
**And** the registration scope is verified to make it reachable from `CRM/fe-prionex`, by an **API
read**, not by the registration command's own success message
**And** runner id 21 is confirmed untouched: same id, same labels, same container, same
`RestartCount`, still `idle`/`online`, before and after
**And** 🔴 the label is read back from **both** the on-disk `.runner` file **and**
`action_runner.agent_labels` in the database, and either they agree or the disagreement is pasted and
named (§5) — `.runner` alone does not close this AC, because the DB is the scheduler's source
**And** the runner is `capacity: 1` (`deferred-work.md:3156-3157`).

### AC2 — The registry is reachable from the host, and the proof is a pull *(epic AC2)*

**Given** the contour talks to the hub over wg-private **by design** (Oleg, 2026-08-18), and the
registry answers only there — measured: public → empty reply after TLS, `10.70.0.1` → `401`
**When** the host is prepared
**Then** `/etc/hosts` on s10 maps `git.crm-prionex.com` to `10.70.0.1`, mirroring s1's split-horizon —
the designed network model, not a workaround
**And** a host-level `docker pull` of a **real, currently-existing** image tag succeeds, with its
digest pasted — **this is the proof, not a `curl`**
**And** 🔴 the runner's own `container.options` carries `--add-host git.crm-prionex.com:10.70.0.1`
(the **s10** value, not s1's `10.67.0.1`), because the `/etc/hosts` entry is the *host's* and does not
reach a job container
**And** the image pulled for the proof is removed afterwards, and its removal is shown (§13(2)).

### AC3 — The pull credential is read-only, and the refusal is measured *(epic AC3)*

**Given** s2's credential pattern (`robot-deploy`, scope exactly `read:package`)
**When** the pull credential is placed on s10
**Then** it is read-only, its account and scope are recorded, and a push attempt is refused (`401`) —
same proof shape as Story 1.10, with the failing request and its status pasted
**And** no `write:package` credential exists anywhere on s10 — shown by inspecting
`/root/.docker/config.json`'s decoded **username** (never its secret) and by the absence of any other
`config.json` under any home directory on the host
**And** 🔴 it is recorded that **the deploy path does not read this credential** — `deploy-stand.yml`
builds a workspace-scoped `DOCKER_CONFIG` from `REGISTRY_USER_RO`/`REGISTRY_TOKEN_RO` (§6) — so this
file is a record/DR artifact and an AC proof, and nothing else
**And** 🔴 if a token was minted for it, its account, scope, owner and revocation trigger are written
into `deferred-work.md` **at the moment of issue**, not at the end of the story (`#d14`: an admin
cannot revoke another account's token).

### AC4 — The stand directory and its `.env` exist, and the `.env` is honest about what is missing *(epic AC4, corrected by §3)*

**Given** FR25/FR26 conventions and the compose file from Story 4.1
**When** the stand directory is created
**Then** `/root/crm-prionex/fe-prionex-prod/` exists on s10 (`0700`, `root:root`) with a server-side
`.env` (`0600`)
**And** the chosen `FRONTEND_PORT` is **measured free on s10 at a stated UTC timestamp**, not
assumed — the FR25 lesson — with the `ss -lntp` output pasted, and its bind form
(`127.0.0.1:<port>` vs `<port>`) chosen with a written reason that accounts for the hypervisor
forward (§8)
**And** 🔴 **all five** required variables are present, because three cannot start the stand (D27):
`COMPOSE_PROJECT_NAME=fe-prionex-prod`, `CONTAINER_NAME=fe-prionex-prod` (**never** the literal
`fe-prionex`), `FRONTEND_PORT`, `DOCKER_IMAGE`, `FRONTEND_NETWORK`
**And** 🔴 any variable that cannot carry a real value carries an explicit blocked non-value naming
its owner — `DOCKER_IMAGE` pending Story 6.3, `FRONTEND_NETWORK` per AC7 — and **never** a borrowed
`-dev` or `-preprod` value that would defeat the tag↔environment guard if a human ran the file
**And** the file carries a header comment naming it for what it is: **a record and DR copy; nothing
on the deploy path reads it** (Story 5.2 Task 4.5, and the measured DEV drift behind it)
**And** the stand is **NOT started** (§13(2), Prohibition 4).

### AC5 — The traffic path is named with its owner and current state *(epic AC5)*

**Given** public traffic must eventually reach this stand
**When** the story closes
**Then** the traffic path is named **concretely** — `crm.prod.crm-prionex.online`, its A record
`62.112.10.55`, its TTL, its measured `refused` state, and the chosen hypervisor-entry model — with
`#d43` §5's four-row owner table reproduced and each row's state re-verified or explicitly carried
forward with its date (§7)
**And** `#d43` §8's ordered blocker list is reproduced with this story's own item 2 (`FRONTEND_PORT`)
**closed** and the other three attributed
**And** blocker 1 (the hypervisor → VM route) is **measured and reported**: what `ssh
root@192.168.122.11` does from the hypervisor shell today, and whether any forward exists — as a
**read**, with nothing configured
**And** the TTL `14400` observation is carried to Oleg as a recommendation with its reason, **and is
not acted on by this story**
**And** **nothing about the traffic path is built or changed by this story** — no vhost, no
certificate, no forward, no DNS or TTL edit.

### AC6 — 🔴 ADDED: the runner inventory is reconciled, and the two runners nobody has claimed are named

**Given** `deferred-work.md:250-253` recorded org runner **`s2-prod-deploy`, id 17, on s2** as drift
that *"no story has acknowledged"*, and handed it to *"whoever owns Story 6-series"*
**When** this story provisions the Epic 6 deploy runner
**Then** a full runner inventory is read through the API — org level and `CRM/fe-prionex` repo level —
and pasted
**And** `s2-prod-deploy` id 17 is explicitly reconciled: confirmed to exist, confirmed **not** to be
this plan's PROD deploy target, and confirmed that **no workflow in this repository references its
label** — with the grep pasted
**And** the new s10 label is verified **not to collide** with any label already registered anywhere on
the instance, by comparison against that same inventory
**And** runner id 21's registration scope — recorded as *"не проверено"* in `#d23` — is now read and
recorded, which is the second half of what the epic's first Given asks for.

### AC7 — 🔴 ADDED: `FRONTEND_NETWORK` is taken from s2 by measurement, and reproduced deliberately

> **Given by Oleg's answer of 2026-08-26 — «возьми из s2» (§3).** The gap is not escalated to
> `CRM/api-prionex`; it is closed by reading the host that already has the answer.

**Given** §3: the compose file requires a **pre-existing external** network, the named PROD value is
`crm-prod-network`, and the neighbour's PROD plan (`docs/forgejo-prod-s2-plan.md:69`) puts that
network on **s2**
**When** the stand directory is prepared
**Then** the PROD backend network is **read from s2** over the NFR7 administrative SSH path —
`docker network ls`, `docker network inspect` on the network the running production frontend is
actually attached to, `docker ps`, and `docker inspect` of the Kong container — and every output is
pasted, including its **real name**, its driver and subnet, Kong's `container_name`, its **network
aliases** (specifically whether `crm-kong-gateway` is among them), and its published-port mapping
**And** the read is **read-only**: no write, no `compose` verb, no restart, and **no Forgejo job on
`s2-prod-deploy`** — NFR5 is untouched (§12)
**And** `docker network ls` on **s10** is pasted alongside it, so the two hosts are compared rather
than one of them assumed
**And** the network is reproduced on s10 **only** as an exact match of what was measured on s2 —
same name, same driver, and the same subnet unless it collides on s10 — **announced verbatim before
it is created** (§11) and recorded in D45 with the s2 measurement attached
**And** 🔴 if the reproduction is (or must be) an **empty, backend-less** network, that is written
down in the `.env` header and in D45 **as a deliberate state with its reason** — the browser never
traverses the container's own `/api/` proxy, because `src/lib/api.ts` bakes an absolute
`VITE_API_BASE_URL` — because otherwise the next reader files a `healthy`-and-serving-200 stand with
an unresolvable `crm-kong-gateway` as a bug (Story 4.1 Task 6.2 is that exact shape)
**And** `docker network create` is run **nowhere else and for no other reason** — not invented, not
for convenience, and never by a deploy path (Prohibition 3 as amended).

### AC8 — 🔴 ADDED: the capacity consequences of a third stand on the smallest host are recorded

**Given** s10 is **16 GB disk, 42% used, ~8.8 GB free, 3.6 GiB RAM** (`#d23`) — the smallest box in
the topology — and now carries a CI runner + its dind, a deploy runner, a job base image, and
eventually a frontend image per release
**When** the contour is provisioned
**Then** free disk and memory are measured **before and after** and pasted
**And** it is recorded that `dev-reset.yml`'s weekly sweep is **DEV-only and hardcoded to DEV's naming
pattern**, so **nothing reaps stale images on s10** — with the owner named as the story that
generalizes the sweep (`deferred-work.md:3983-3995`), and this story's decline (§13(7)) stated with
its reason
**And** the retention policy's own assumption — *"hosts hold few images"*
(`sprint-change-proposal-2026-08-18-prod-target.md` §2) — is repeated with the number it now has to
survive on.

### AC9 — `#d23` is updated with what was provisioned, by whom, and what remains external *(epic AC6)*

**Given** the plan's record-keeping
**When** the story closes
**Then** `docs/migration-decisions.md` `#d23` is updated with what was provisioned, by whom, and what
remains external — **appended as a dated amendment, never a rewrite of its body** (the form `#d43`
itself used for its own §8, and the form this file's own §7 depends on)
**And** a new decision **D45** records this story's own choices — the label, the job image and why,
the registration scope, the port and its bind form, the network verdict — with the number re-verified
free across **all** branches at execution time (Task 1.3)
**And** `README.md`'s Server Deployment row for s10, which currently reads *"decided by Story 6.10"*
(line 140), is filled in.

### AC10 — 🔴 ADDED: every claim carries a pasted artifact, and every unearned claim is named

**Given** retro-E5 and the four prior rejections (`D34` §3, 5.1, 5.2's H2, 5.4's H1, 6.2's review)
**When** any AC above is reported closed
**Then** it carries a pasted artifact — a `.runner` file, an API response, an `ss -lntp` line, a
digest, a `401` body, an `ss`/`df`/`free` output — never a characterisation
**And** §9's five non-proofs are restated in the Completion Notes **as non-proofs**, each with the
story that will prove it
**And** no disposition softer than `UNPROVEN` / `OPEN` / `PENDING (owner: name)` appears anywhere.

---

## Tasks / Subtasks

> **Ordering is load-bearing.** Task 2 measures before Task 3 changes anything, and Task 3's
> registration is the one act in this story that is confirmed rather than announced (§11).

## 📌 ACTUALIZATION — measured 2026-08-26, after Oleg reported the contour as done

**Everything below is a live measurement taken over `ssh -J root@62.112.10.55 root@192.168.122.11`
and against the Forgejo database, read-only. Nothing here is taken from a report.** The story's
status stays `ready-for-dev` because two of its six ACs are unmet and one is worse than unmet — see
the last row.

### What IS in place

| AC | State | Measurement |
|---|---|---|
| **AC1** — a deploy runner with a dedicated label | ✅ **MET IN FULL** (see the retraction below) | `action_runner` id **23**, name `s4-prod-deploy`, labels `["e1-rung3-prod-deploy"]`, owner `crm` (org-scoped → reachable from `CRM/fe-prionex`), last online `2026-08-26 12:36:06Z`. The label **is** distinct from `s10`/`e1-rung3` as AC1 requires. Runners **21** (`e1-rung3`) and **22** (`e1-snp2`) are present and untouched |
| **AC2**, first half — split-horizon | ✅ **done** | `/etc/hosts` on s10 carries `10.70.0.1 git.crm-prionex.com` |
| **AC4**, port half | ✅ **measured free** | `8080`–`8085` all free on s10 (`ss -ltn`) |

### 🟢 What changed on s10 without this story, and it removes a risk

**The backend team's PRODUCTION stack is already live on s10** — `crm-prod-client-service`,
`crm-prod-payment-service`, `crm-prod-messaging-service`, `crm-prod-import-service`,
`crm-prod-quality-service`, `crm-prod-email-service`, `crm-prod-health-monitor` and their workers, all
`Up` and healthy, on network **`crm-prod-network`**. `crm-prod-kong-gateway` is published at
`10.70.0.11:8330->8000`.

🟢 **And Kong already carries the alias this project had to ask for on PRE-PROD:**

```
docker inspect crm-prod-kong-gateway → crm-prod-network aliases=[crm-prod-kong-gateway kong crm-kong-gateway]
```

`nginx.conf` in the frontend image resolves `http://crm-kong-gateway:8000` lazily (its own lines 39
and 50). **So the Story 1.6 failure class — the frontend resolving Kong to the wrong backend, or not
at all — is pre-empted here, measured rather than assumed.** The stand must join `crm-prod-network`
for it to hold. **This was not true when this story was written and is the single biggest thing that
got easier.**

### What is NOT in place

| AC | State | Measurement |
|---|---|---|
| **AC2**, second half — a host-level `docker pull` succeeds | ❌ **cannot succeed** | there is **no registry credential on s10**: `/root/.docker/config.json` does not exist |
| **AC3** — a read-only pull credential, push refused with `401` | ❌ **not started** | same absence; nothing to test a refusal against |
| **AC4**, directory half | ❌ **absent** | `ls -d ~/crm-prionex/fe-prionex-prod` → `No such file or directory`. No `.env`, no `COMPOSE_PROJECT_NAME`, no `CONTAINER_NAME`, no `FRONTEND_PORT` |
| **AC5** — the traffic path named with owner and state | 🟡 **partially, by `#d43` rather than by this story** | `crm.prod.crm-prionex.online` → `62.112.10.55`, but 80/443 there still answer `refused`. The hypervisor→VM route `#d23` measured as "No route to host" is still unverified |
| **AC6** — `#d23` updated with what was provisioned | ❌ **not done** | `docs/migration-decisions.md` untouched by any 6.10 work |

### ✅ AC1 — MET IN FULL. **The blocker recorded here first was MY ERROR, and it is retracted.**

🔴 **What I wrote, and it was false:** *"There is no container on s10 carrying `e1-rung3-prod-deploy`
… an agent is answering from a **third host**, and its registration name says **`s4`** … proven **not
on s10** and **not on s1**."*

**How it was wrong:** I enumerated **containers** (`docker ps -a`) on s10 and on s1, found nothing,
and stated the conclusion at full strength. The agent is a **host process**, not a container — which
is precisely what AC1 asks for, so my search method excluded the very thing that satisfies the AC:

```
forgejo+  /usr/local/bin/forgejo-runner daemon --config /opt/forgejo-runner/s4/config.yml   (since Aug 19)
/opt/forgejo-runner/s4/.runner
```

**`s4` is the config directory the neighbouring team used** (its own comments read *"s4: путь /s2/ ->
/s4/"*, i.e. copied from their s2 deploy runner) — **not a fourth host.** The registration name
`s4-prod-deploy` inherits that, and I read a directory name as a location.

**AC1's requirements, each measured against `/opt/forgejo-runner/s4/config.yml`:**

| AC1 clause | Evidence |
|---|---|
| a runner registration **on s10** | the daemon process and its `.runner` are on s10 |
| jobs execute against the **host** daemon, **not dind** | `labels: - "e1-rung3-prod-deploy:host"` — the `:host` executor runs steps directly on the machine; and `container.docker_host: "unix:///var/run/docker.sock"` is the host socket. Contrast `forgejo-runner-e1-rung3`, whose `DOCKER_HOST=tcp://dind:2375` is exactly what AC1 excludes |
| a dedicated deploy label distinct from `s10`/`e1-rung3` | `e1-rung3-prod-deploy`, and runners 21/22 keep `s10`/`e1-rung3` untouched |
| scope reachable from `CRM/fe-prionex` | `owner=crm`, org-scoped |

**Whose runner it is, and why that is reassuring rather than alarming:** `action_task` shows runner 23
executing jobs for **`CRM/api-prionex`** — most recently 12:10:58Z today, status success. It is the
neighbouring team's production deploy runner, the one that put the live `crm-prod-*` stack on this
host. So the mechanism AC1 asks for is not merely configured, it is **in daily production use on this
exact machine.**

⚠️ **Two things this does NOT settle, kept because they are real:**
1. **`capacity: 1`.** One job at a time on the production deploy runner. Story 4.4's `flock` reasoning
   was written for `capacity > 1`; here the runner itself serializes. **Do not read that as a reason to
   drop the lock** — capacity is a runner-config value someone can raise without telling this project.
2. **Nothing in the deploy path asserts WHICH HOST it is running on.** That observation survives the
   retraction intact. It was not the reason for the blocker, and it is still worth doing — a shared,
   org-scoped label is a string, and the guarantee that it resolves to this machine lives entirely in a
   config file owned by another team.

🔴 **The lesson, recorded because it is the reusable part:** a negative claim is only as strong as the
search that produced it. *"No container has this label"* is not *"no agent has this label"*, and I
published the second while having measured only the first. **State the method inside the claim, or do
not state the claim at full strength.**

### Verdict

**AC1 ✅ met in full. AC5 🟡 partial. AC2 (pull half), AC3, AC4 (directory half) and AC6 ❌ unmet — four
items, all of them small and none of them blocking each other.** What is left is: put a **read-only**
registry credential on s10 and prove a host-level `docker pull` with it (AC2/AC3), create
`~/crm-prionex/fe-prionex-prod/` with its `.env` on a free port — 8080-8085 are all free (AC4), and
update `#d23` (AC6). **There is no blocker.** Story 6.4 may be written against label
`e1-rung3-prod-deploy` once the credential and the stand directory exist.

---

### Task 1 — Open the story, declare the budget, verify the decision number (AC: 9, 10) — **costs 1 push row**

- [ ] **1.1** Flip `sprint-status.yaml`: `6-10-provision-the-prod-deploy-contour-on-s10: backlog →
      in-progress`, in its own commit. Add a dated block above it recording: branch base
      (`docs/prod-temporary-hostname @ 1c54f32d`, §0), the 6.3-holds-D43 collision (§0), and the
      declared run budget (§10).
- [ ] **1.2** Paste §10's budget table into the Dev Agent Record with disposition **OPEN**, and hand
      the coordinator the no-touch window (2026-08-30, 01:45–02:30 UTC).
- [ ] **1.3** 🔴 Re-verify the decision number across **every** branch, not just `main`:
      `git fetch --all --prune`, then for each ref `git grep -i 'id="d4[0-9]"' <ref> --
      docs/migration-decisions.md`. Known holders at context time: **D35** →
      `story-4-9/pr-1-context`; **D43** → `docs/prod-temporary-hostname` (Oleg's, and 6.3 believes
      it is free); **D44** → `story-4-10/pr-1-context`. **D45 was free.** Paste the check. If D45 has
      been taken since, take the next free number and say so.
- [ ] **1.4** Record the §0 D43 collision as an item in `deferred-work.md` addressed to Story 6.3,
      with the two timestamps. **Do not edit 6.3's file or branch.**

### Task 2 — Re-measure s10 before changing anything (AC: 1, 2, 5, 7, 8) — **0 runs, 0 changes**

> 🔴 **`#d23` requires this task in its own words: the 2026-08-18 snapshot is a hypothesis with a
> date, taken while the host was mid-provisioning and recovering from a crash-loop.** Nothing in
> Task 3 onward may cite that snapshot as current.

- [ ] **2.1** Confirm the access path works and confirm the identity of what answers:
      `ssh -J root@62.112.10.55 root@192.168.122.11`. Paste `hostname`, `ip -4 addr`, `uname -a`,
      `cat /etc/os-release`, `docker version`, `docker compose version`. Confirm this is
      `e1-rung3`/`192.168.122.11` and **not** `e1-snp2`.
- [ ] **2.2** Baseline capacity for AC8: `df -h /`, `free -m`, `nproc`. Paste.
- [ ] **2.3** Inventory what is already running: `docker ps -a`, `docker images`, `docker network ls`,
      `docker volume ls`. Paste. **This is also AC7's measurement** — state explicitly whether
      `crm-prod-network` exists and whether any Kong container is present.
- [ ] **2.4** Read runner id 21's real state without touching it: its container name, image,
      `RestartCount`, its `.runner` file, and its `config.yml` (redacting the registration token —
      Prohibition 9). Paste. **Record its `DOCKER_HOST` value**, which is the fact that makes it
      CI-shaped.
- [ ] **2.5** Registry reachability from the **host**, both horizons, before any change:
      `curl -sS -o /dev/null -w '%{http_code}' https://git.crm-prionex.com/v2/` and the same with
      `--resolve git.crm-prionex.com:443:10.70.0.1`. Paste both. Expected from `#d23`: empty
      reply/`000` public, `401` over wg-private. **If either differs, stop and report before
      proceeding** — the network model changed under us.
- [ ] **2.6** Route check: `ip route get 10.70.0.1`. Paste.
- [ ] **2.7** **Confirm public egress on the host daemon (§4).** Oleg stated 2026-08-26 that egress
      is **available**, so this is a confirmation, not a decision gate. Attempt a small public pull on
      the **host** daemon (e.g. `docker pull alpine:3.20`), paste the result, and remove the image
      immediately. 🔴 **If it fails, stop and report the contradiction** — do not silently fall back
      to a locally-built image.
- [ ] **2.8** Port census: `ss -lntp`. Paste in full. Note the UTC timestamp of the reading — AC4
      requires it.
- [ ] **2.9** Credential baseline: `cat /root/.docker/config.json` (or its absence), and
      `find / -maxdepth 4 -name config.json -path '*/.docker/*' 2>/dev/null`. Paste — **key names and
      decoded usernames only, never secrets.**
- [ ] **2.10** 🔴 **Blocker 1 for AC5, and it is a READ.** From the **hypervisor shell**
      (`ssh root@62.112.10.55`), run `ssh -o BatchMode=yes -o ConnectTimeout=5
      root@192.168.122.11 true` and paste the exact error, and read the forwarding state:
      `nft list ruleset` (or `iptables -t nat -S`), `ss -lntp`. **Read only. Change nothing.** If the
      hypervisor shell is not available to the dev agent, mark this
      **`PENDING (owner: Oleg)`** and do not simulate it.
- [ ] **2.11** Re-measure §7's DNS/HTTP facts from the workstation: `dig +short A
      crm.prod.crm-prionex.online @ns1.dns-parking.com` (and 8.8.8.8), the TTL, and
      `curl -sS -o /dev/null -w '%{http_code}' http(s)://crm.prod.crm-prionex.online/`. Paste with
      timestamps. Confirm or update `#d43` §8's rows m/n/p/q.
- [ ] **2.13** 🔴 **Read the PROD backend network from s2 (AC7) — «возьми из s2», Oleg 2026-08-26.**
      Over the NFR7 administrative SSH path only (`root@175.110.122.17`). 🔴 **READ ONLY: no write, no
      `compose` verb, no restart, no `docker run`, and no Forgejo job on `s2-prod-deploy`** (§12,
      Prohibition 6). Paste, in this order:
      - `docker network ls`
      - `docker ps --format '{{.Names}}\t{{.Image}}\t{{.Ports}}'`
      - `docker inspect <the running production frontend container>` — specifically its
        `NetworkSettings.Networks` keys, which name the network **actually in use** rather than the
        one a plan document predicts
      - `docker network inspect <that network>` — name, driver, subnet, attached containers
      - `docker inspect <the Kong container>` — its `container_name`, and 🔴 its **network aliases**:
        does `crm-kong-gateway` appear? (`preprod-infrastructure-requirement.md` §2.2 asked
        `CRM/api-prionex` for exactly that alias; commit `517e6975` in their repo answered it for the
        new stands — s2 is the **legacy** stand and may predate it.)
      - Kong's published port mapping — the `KONG_PORT` question (`deferred-work.md:934-937`) is
        **Story 6.4's to settle**; this task only pastes what s2 shows and does not conclude.
- [ ] **2.14** 🔴 **Free by-product of 2.13, and `#d43` §4 asks for it by name: measure the PROD API
      hostname, do not derive it.** From the same read — the running production frontend's baked
      `VITE_API_BASE_URL` (readable from the served bundle or the image), and/or the public name s2's
      Kong answers on. Paste it. **Record only.** Choosing what the s10 stand will use is Story 6.4's
      (Prohibition 12 still forbids inventing `api.crm.prod.…`).
- [ ] **2.12 PENDING (owner: coordinator)** — full runner inventory for AC6: `GET
      /api/v1/orgs/CRM/actions/runners` and `GET /api/v1/repos/CRM/fe-prionex/actions/runners`, plus
      runner id 21's **scope**. Paste. Also `select id, name, agent_labels, scope from action_runner`
      if DB access is available (§5).

### Task 3 — 🔴 Register the deploy runner (AC: 1) — **announced AND confirmed, not announced-and-proceeded**

- [ ] **3.1** Choose the job image. Candidates, in the order the §4 constraints admit them, decided by
      Task 2.7's result. **Prove the tool set before anything else**, on s10's host daemon:
      `docker run --rm <image> sh -c 'command -v docker && command -v git && command -v curl &&
      command -v flock && command -v timeout && date -d "2026-08-26T00:00:00+03:00" +%s'`
      🔴 **A missing tool is a disqualification, not a to-do.** Paste the full output for the chosen
      image **and** for at least one rejected candidate, so the choice is a comparison and not an
      assertion. Note the `date -d` result specifically (`deferred-work.md:3239`).
- [ ] **3.2** Choose the label. Constraints: distinct from `s10` and `e1-rung3` (epic AC1); not
      colliding with anything in Task 2.12's inventory; not the bare `deploy`, `dev` or `preprod`,
      which s1's deploy runner already registers. **Proposed: runner name `s10-deploy-prod`, label
      `deploy-prod`.** Record the reasoning; a different choice is fine if the inventory forces it.
- [ ] **3.3** Choose the registration **scope**, and record the trade-off rather than the precedent.
      🔴 **The epic's own parenthetical says "(instance/org)" and does not list repo scope at all** —
      so choosing repo is a deliberate departure from the AC's framing, not an oversight, and must be
      recorded as one. **Repo (`CRM/fe-prionex`)** confines root-equivalent jobs on the production VM
      to this repository; **org** matches `s1-deploy-dev-preprod` and `s2-prod-deploy` but lets any
      CRM repository run on the production host; **instance** is wider still and is not a candidate.
      **Recommendation: repo scope** — `#d23`'s own blast-radius argument points that way, and 6.4's
      caller lives in this repository. **Open Question 4** — Oleg decides; announce the
      recommendation, the departure and the reason together.
- [ ] **3.4 PENDING (owner: coordinator)** — mint the registration token for the chosen scope. Record
      account, scope, owner and revocation trigger in `deferred-work.md` **at the moment of issue**
      (`#d14`). 🔴 **Do not reuse runner id 21's token.**
- [ ] **3.5** 🔴 **Announce, and wait for confirmation** (§11): the exact registration command, the
      full `label:docker://image` string, the runner name, the scope, and the compose/config that
      will define it. **Then** register — interactive form if `--no-interactive` does not read stdin
      on the chosen image (Story 1.9's finding).
- [ ] **3.6** Runner configuration, mirroring s1's deploy runner where the reason ports and diverging
      where the measurement says to:
      - `container.options` **must** carry `-v /var/run/docker.sock:/var/run/docker.sock` and
        `--add-host git.crm-prionex.com:10.70.0.1` (🔴 **s10's octet, not s1's `10.67.0.1`**).
      - `valid_volumes` must permit the docker socket.
      - 🔴 **No `DOCKER_HOST` pointing at a dind sidecar** — that is precisely what makes id 21
        unable to deploy.
      - 🔴 **Do not mount the stand directory** into job containers (§8, D28's amendment: it would
        open the stand path read-write to every job on the runner, and the job reaches its lock
        through the socket it already holds).
      - `capacity: 1` (`deferred-work.md:3156`).
      - `restart: unless-stopped`.
- [ ] **3.7** Read the registration back from **disk**: paste the new runner's `.runner` file in full,
      showing id, name, and each label with its `docker://` suffix. **A bare label here is Trap 1 and
      the registration must be redone.**
- [ ] **3.8 PENDING (owner: coordinator)** — read it back from the **API and the DB** (§5). Paste
      both. If `.runner` and `agent_labels` disagree, **paste the disagreement and name it**; do not
      pick the convenient one.
- [ ] **3.9** Re-read runner id 21 exactly as in Task 2.4 and diff: same id, same labels, same
      `RestartCount`, same container. Paste. **This is AC1's "confirmed untouched".**

### Task 4 — Split-horizon resolution and the pull proof (AC: 2) — **0 runs**

- [ ] **4.1** Add `10.70.0.1  git.crm-prionex.com` to `/etc/hosts` on s10. Paste the file before and
      after.
- [ ] **4.2** Re-run Task 2.5's public-name curl **without** `--resolve`. It must now return `401`.
      Paste.
- [ ] **4.3** Place the read-only credential: `docker login git.crm-prionex.com` with the
      **read-only** account (AC3). 🔴 Never `REGISTRY_USER`/`REGISTRY_TOKEN_RW` (Prohibition 8).
      Record the date of placement (`deferred-work.md:3800-3810`: it has vanished twice on s1).
- [ ] **4.4** 🔴 **The pull proof.** Pull a **real, currently-existing** tag — a `-dev` or `-preprod`
      one; **no `-prod` tag exists** (6.3 paused). Paste the full output including the resolved
      digest. **Then remove the image** (`docker rmi`) and paste that too (§13(2)).
- [ ] **4.5** The push refusal: attempt a push of a probe tag with the same credential and paste the
      `401` and the request it failed on. Then confirm the probe tag is **absent** from the registry
      (`404`), the way Story 4.2 did. **PENDING (owner: coordinator)** for the registry-side check.
- [ ] **4.6** Prove the negative: `/root/.docker/config.json`'s decoded **username** only, plus the
      `find` from Task 2.9 re-run, to show no `write:package` credential exists anywhere on s10.
- [ ] **4.7** Write into the record that the deploy path does **not** read this file (§6, AC3's last
      clause but one).

### Task 5 — The stand directory and its `.env` (AC: 4, 7) — **0 runs, and nothing is started**

- [ ] **5.1** Choose `FRONTEND_PORT` from Task 2.8's census. Paste the census line proving it free and
      **the UTC timestamp of the reading**. Say `measured free at <timestamp>`, never `allocated`
      (Prohibition 11).
- [ ] **5.2** 🔴 Decide the bind form — `127.0.0.1:<port>` or `<port>` — and write the reason. Inputs:
      PRE-PROD is `127.0.0.1:8083` because s1 has a public IP; **s10 is NAT-hidden but must be
      reachable from the hypervisor's forward**, and whether that forward can reach a loopback-bound
      port depends on the forwarding mechanism, which Task 2.10 measures. If Task 2.10 is
      `PENDING (owner: Oleg)`, **record both options with their consequences and mark the choice
      `OPEN`** rather than guessing. **Open Question 5.**
- [ ] **5.3** `mkdir -p /root/crm-prionex/fe-prionex-prod`, `chmod 0700`, owner `root:root`. Paste
      `ls -ld`.
- [ ] **5.4** Write `.env`, mode `0600`, with **all five** variables (AC4):
      `COMPOSE_PROJECT_NAME=fe-prionex-prod`; `CONTAINER_NAME=fe-prionex-prod` (🔴 **never** the bare
      literal `fe-prionex` — `CD.yml:201`); `FRONTEND_PORT` per 5.1/5.2; `DOCKER_IMAGE` as an explicit
      blocked non-value naming **Story 6.3**; `FRONTEND_NETWORK` per 5.6.
- [ ] **5.5** Put a header comment in the `.env` naming it for what it is — **a record and DR copy;
      nothing on the deploy path reads it** — and naming which values are blocked and by whom. Story
      5.2's Task 4.5, and the measured DEV drift behind it.
- [ ] **5.6** 🔴 **`FRONTEND_NETWORK` (AC7) — from s2's measurement, not from a plan document.**
      Inputs: Task 2.13 (what s2 actually runs) and Task 2.3 (what s10 already has).
      - If the network already exists on s10 with a Kong answering to `crm-kong-gateway`: paste
        `docker network inspect`, write the real name into the `.env`, done.
      - Otherwise: **announce the exact `docker network create` command verbatim** with 2.13's
        measurement attached (§11), wait, then create it as an exact reproduction — same name, same
        driver, same subnet unless it collides on s10 — and paste `docker network ls` and
        `docker network inspect` afterwards.
      - 🔴 If the result is a **backend-less** network, write that into the `.env` header and D45 **as
        a deliberate state with its reason** (§3): the browser never uses the container's `/api/`
        proxy; `src/lib/api.ts` bakes an absolute `VITE_API_BASE_URL`. Do **not** leave it to be
        rediscovered as a bug.
      - 🔴 Never invent a name, never create before 2.13 has been read, never let a deploy path create
        anything (Prohibition 3 as amended).
- [ ] **5.7** Verify the directory is usable as `stand_dir` by a **sibling container** the way
      `deploy-stand.yml` will use it — `docker run --rm -v /root/crm-prionex/fe-prionex-prod:/lockdir
      <job image> sh -c 'touch /lockdir/.probe && ls -l /lockdir && rm /lockdir/.probe'` — and paste
      it. This is the closest thing to a real deploy-path proof this story can honestly run, and it
      still is **not** a proof the deploy works (§9(1)).
- [ ] **5.8** 🔴 Confirm the stand is **not** running and **no** frontend container exists:
      `docker ps -a --filter name=fe-prionex`. Paste. Prohibition 4.
- [ ] **5.9** Capacity after (AC8): `df -h /`, `free -m`. Paste alongside Task 2.2's before.

### Task 6 — Record: D45, `#d23`, README, deferred work (AC: 5, 6, 8, 9) — **0 runs**

- [ ] **6.1** Append **D45** to `docs/migration-decisions.md` (number from Task 1.3): the label, the
      job image and the comparison that chose it, the registration scope and its trade-off, the port
      and its bind form, the network verdict, the capacity numbers, and everything marked `UNPROVEN`.
      Add the anchor row to the header table and a changelog row, following the file's own form.
- [ ] **6.2** Update `#d23` as a **dated amendment appended to it, not a rewrite of its body**
      (AC9): what was provisioned, by whom, and what remains external. Close its own *"скоуп
      регистрации … не проверено"* item with Task 2.12's answer.
- [ ] **6.3** Fill in `README.md`'s Server Deployment row for s10 (line 140 currently reads *"decided
      by Story 6.10"*).
- [ ] **6.4** 🔴 AC5's traffic-path record: reproduce `#d43` §5's four-row owner table with each row
      re-verified or carried forward with its date; reproduce §8's ordered blocker list with item 2
      closed and 1/3/4 attributed; report Task 2.10's route measurement; and carry the TTL `14400`
      recommendation to Oleg **without acting on it**.
- [ ] **6.5** `deferred-work.md`: the D43 number collision (Task 1.4); any token minted (Task 3.4);
      the `dev-reset.yml` sweep decline with its reason and the s10 capacity consequence (AC8,
      §13(7)); the `FRONTEND_NETWORK` external dependency if AC7 found it absent; and the
      `FRONTEND_PORT` bind-form question if 5.2 left it `OPEN`. **Owners are names, never trigger
      conditions** (Prohibition 14 of the project's own standing set).
- [ ] **6.6** AC6's reconciliation: paste the runner inventory, name `s2-prod-deploy` id 17 as
      existing-and-not-ours, and paste
      `grep -rn 's2-prod-deploy\|runs-on' .forgejo/workflows/` showing no workflow references it.

### Task 7 — Close (AC: all) — **1 dev-story push + PR-open + merge rows**

- [ ] **7.1** Restate §9's five non-proofs in the Completion Notes **as non-proofs**, each with the
      story that will prove it. AC10.
- [ ] **7.2** File List: repository files **and** the host-side artifacts on s10 with their paths and
      modes (§12).
- [ ] **7.3** Answer the Open Questions with Oleg's decisions, in their own commit.
- [ ] **7.4 PENDING (owner: coordinator)** — open the PR. Title names the ordering constraint so the
      merge order is visible: *"Story 6.10: provision the PROD deploy contour on s10 — the story that
      must land before 6.4."*
- [ ] **7.5 PENDING (owner: coordinator)** — close the run ledger by **query**, per §10. Exclude
      6.3's, 4.9's and 4.10's rows by `commit_sha`, never by id range.
- [ ] **7.6** Flip `sprint-status.yaml` to `review`, then to `done` after code review, in the epic's
      established form.

---

## Dev Notes

### 1. The one-paragraph version

Provision four host-side facts on s10 and change nothing else: a **deploy-shaped runner** bound to the
**host** Docker daemon under a **new label bound to a proven job image**; **`/etc/hosts` →
`10.70.0.1`** so the registry resolves; a **read-only** registry credential whose push is refused;
and **`/root/crm-prionex/fe-prionex-prod/`** with a five-variable `.env` in which the two values that
cannot be real say so and name their owners. Then write down the traffic path with dates and owners,
amend `#d23`, and stop. **Nothing is dispatched, nothing is deployed, nothing is started, and no
workflow file is touched.**

### 2. Infrastructure facts, in one place

| Fact | Value | Source |
|---|---|---|
| PROD VM | `e1-rung3`, `192.168.122.11` (libvirt NAT), Ubuntu 24.04.4 | `#d23` |
| Access | `ssh -J root@62.112.10.55 root@192.168.122.11` | `#d23`, NFR7 as amended |
| Hypervisor / jump | `NLDW6-3-11-16`, public `62.112.10.55`, wg-private `10.70.0.10` | `#d23` |
| Second VM on it | `e1-snp2` — **not ours, not examined, not touched** | `#d23` |
| Resources | 4 vCPU, 3.6 GiB RAM, 16 GB disk (42% used, ~8.8 GB free) | `#d23` — **re-measure** |
| Docker | 29.7.2, Compose v5.5.0 | `#d23` — **re-measure** |
| Existing runner | id 21, `forgejo-runner-e1-rung3`, runner v13.0.0 + `docker:27.5.1-dind`, labels `s10`/`e1-rung3` → `ghcr.io/catthehacker/ubuntu:act-22.04`. **CI-shaped: `DOCKER_HOST=tcp://dind:2375`** | `#d23` |
| Registry, from the host | public (`185.185.49.127`) → TLS completes then **empty reply** (`curl` 52, HTTP 000); `10.70.0.1` → **401** | `#d23` — **re-measure** |
| Route | `10.70.0.1 via 192.168.122.1` — exists; **`/etc/hosts` entry does not** | `#d23` |
| wg-private hub IP **on s10** | **`10.70.0.1`** 🔴 — s1's is `10.67.0.1`. Different networks | `#d23` vs `#d13` |
| Host credential | `/root/.docker/config.json` — empty `auths` | `#d23` — **re-measure** |
| Hypervisor → VM | `ssh root@192.168.122.11` from the hypervisor shell → **"No route to host"**; mechanism **"не проверено"** | `#d23` |
| PROD public name | `crm.prod.crm-prionex.online`, **temporary**, `A → 62.112.10.55`, **TTL 14400** | `#d43` §8 |
| Its state | 🔴 **resolves, refuses** — 80/443 on `62.112.10.55` → `refused` in 62 ms | `#d43` §8 p/q |
| PROD API name | 🔴 **unknown, NXDOMAIN, MUST NOT be derived** | `#d43` §4 |
| Stand directory | `/root/crm-prionex/fe-prionex-prod/` | FR26 as amended |
| Ports taken on **s1** (for contrast only) | 8080 legacy, 8081 vm-cadvisor, 8082 DEV, 8083 PRE-PROD | `.env.stand.example:56-67` |
| PROD port | 🔴 **measured on s10 by this story** — `.env.stand.example:67` says so by name | this story |
| Deploy callee | `.forgejo/workflows/deploy-stand.yml`, `workflow_call`, `runs-on: ${{ inputs.runner_label }}` (R1, live) | Story 4.8 |
| Deploy auth | workspace-scoped `DOCKER_CONFIG` from org secrets `REGISTRY_USER_RO`/`REGISTRY_TOKEN_RO` — **not the host file** | `deploy-stand.yml:66-70` |
| Repo clone in the job | `github.token`, `GIT_CONFIG_COUNT` env form (never in `argv`) | `deploy-stand.yml:611-620` |
| PROD network (named) | `crm-prod-network` — 🔴 **planned on s2 by `CRM/api-prionex`**, `docs/forgejo-prod-s2-plan.md:69`. 🔴 **The real name is MEASURED on s2 by Task 2.13, not taken from this plan document** (Oleg, 2026-08-26: «возьми из s2») | `preprod-infrastructure-requirement.md:226` |
| s10 host public egress | **available** — stated by Oleg 2026-08-26; confirmed, not assumed, by Task 2.7 | Oleg |
| s2, legacy PROD | `root@175.110.122.17` — 🔴 **read-only target of Tasks 2.13/2.14** over the NFR7 admin SSH path. Never written, never deployed to | §12 |
| `KONG_PORT` on PROD | `8330` — published host port or in-network listener, **still OPEN**, owner Story 6.4 | `deferred-work.md:934-937` |

### 3. Anti-patterns for this story

- **Copying s1's `--add-host` octet.** `10.67.0.1` on s1, `10.70.0.1` on s10. The wrong one produces a
  runner that polls fine (the hub is reached another way) and a job that cannot resolve the registry.
- **Registering first and choosing the image after.** Trap 5. The binding is fixed at registration.
- **Creating `crm-prod-network` to "unblock" the `.env`.** It converts the only loud failure on that
  axis into a silent one. `CD.yml:185` is the named anti-pattern.
- **Filling `DOCKER_IMAGE` with a `-preprod` tag.** The tag↔environment guard exists to stop exactly
  that, and a `.env` that would defeat it by hand is worse than an obviously-unfinished one.
- **Starting the stand "to check it works".** Prohibition 4. There is nothing correct to start.
- **Treating `#d23`'s 2026-08-18 measurements as current.** `#d23` itself forbids it.
- **Reading `.runner` and calling the label registered.** §5. The DB is the scheduler's source.
- **Calling a measured-free port allocated.** §9(3), and FR25's own amended history.
- **Fixing `deploy-stand.yml:216`'s comment while you are here.** §12.

### 4. Previous story intelligence — what this story spends

Story 5.2 spent its budget discovering that three variables are five and that a bare port publishes on
`0.0.0.0`. Story 1.7 spent a registration discovering Trap 1. Story 4.2 spent two rounds discovering
that a deploy job's credential is not the host's. **This story pays none of those again** — §3, §4,
§6 and §8 carry them in, and the tasks are written so the mistakes are unavailable rather than merely
discouraged. What it genuinely spends is: one runner registration on a production host (confirmed, not
just announced), one host `/etc/hosts` edit, one credential placement, and a directory. All four are
reversible; that is why §11's confirmation exception is narrow.

### 5. The autonomous decisions in this story, in one place (for a one-read veto)

1. **Job image** — chosen by Task 3.1's capability comparison and Task 2.7's egress measurement, not
   by preference. Announced with both outputs.
2. **Label `deploy-prod`, runner name `s10-deploy-prod`** — distinct from `s10`/`e1-rung3` per the
   epic, non-colliding per Task 2.12's inventory.
3. **Registration scope: repo, not org** (recommendation; Open Question 4).
4. **`FRONTEND_PORT` value and bind form** — value from the census, form from Task 2.10 (Open
   Question 5 if that task is `PENDING`).
5. **`DOCKER_IMAGE` written as an explicit blocked non-value** naming Story 6.3 as its owner, rather
   than a borrowed `-dev`/`-preprod` value or an omission.
5b. **`FRONTEND_NETWORK` reproduced on s10 from Task 2.13's s2 measurement** (Oleg's «возьми из s2»),
   with the exact `docker network create` announced verbatim before it runs, and a backend-less
   result recorded as deliberate rather than left to be filed as a bug.
6. **The `dev-reset.yml` sweep generalization is DECLINED** with its reason recorded (§13(7)).
7. **`deploy-stand.yml:216`'s skeleton comment is left wrong**, deliberately (§12).
8. **D45** as this story's decision number, re-verified at execution time.

### 6. Non-goals — absences that are decisions, not omissions

- **No workflow file, not even a skeleton.** §12, §13(1).
- **No dispatch.** §10 — a non-zero dispatch count is a defect here, not an overrun.
- **No durability/crash test of the new runner** unless it is run Story 1.9's way. §9(4).
- **No vhost, certificate, forward, DNS or TTL change.** §7, AC5.
- **No Kong probe, no `KONG_PORT` measurement, no CORS ask.** §13(5). Reading s2's Kong container
  with `docker inspect` (Task 2.13) is not a probe and concludes nothing.
- **No contact with s2 beyond an API read of its runner.** §12.

### 7. Things pending on Oleg — do not depend on them silently

- **Open Question 1** — whether `docs/prod-temporary-hostname` merges on its own first (§0).
- **Open Question 2** — Story 6.3's D43 collision (§0). 6.3 is paused; it will need the answer on
  resume.
- ✅ **Open Question 3 — ANSWERED 2026-08-26, «возьми из s2».** No longer a blocker and no longer an
  escalation: it is Tasks 2.13/2.14 and AC7. What genuinely stays with Oleg is the smaller,
  longer-range question the answer does not settle — whether the PROD backend eventually moves to s10
  or stays on s2 permanently. Not this story's, and 6.10 does not wait on it.
- ✅ **s10 public egress — ANSWERED 2026-08-26, «доступен».** Task 2.7 confirms rather than decides.
- **Open Question 4** — registration scope, repo vs org (Task 3.3).
- **Open Question 5** — `FRONTEND_PORT` bind form, if Task 2.10 could not be measured (Task 5.2).
- **Story 6.3's resume signal** — not this story's to give, and this story does not wait on it.
- **The TTL `14400` → `300` change** — recommended by this story, executed by Oleg or the zone's
  owner, not here.

### 8. Conventions that bind this story

- **`PENDING (owner: <name>)`** for anything the dev agent cannot do — never `[x]`, never a trigger
  condition instead of a name (Story 5.2's M14).
- **Paste, do not characterise** (4.2 M3, 5.2 M1, 5.4 M10).
- **Announce, don't ask twice** (`#d38` §7) — with §11's one narrow exception.
- **Run ledgers close by query, never by self-report** (retro-D4).
- **Amendments are appended and dated; decision bodies are never rewritten** (`#d43` §8 is the fresh
  precedent, and `#d23` is the target).
- **No dispatch / no lock holder / no `main` merge across 01:45–02:30 UTC**; next tick 2026-08-30.

### Project Structure Notes

- **Nothing under `src/`, `public/`, or the build configuration is touched.** This story ships no
  application code and no test.
- **Nothing under `.forgejo/workflows/` is touched** (§12) — which also means this story adds no
  workflow test surface and cannot break CI by construction. The 13 budgeted CI rows are all
  documentation-commit runs of the existing `ci.yml`.
- **Repository files changed:** `docs/migration-decisions.md` (append D45 + amend `#d23` + header row
  + changelog row), `README.md` (line ~140), `_bmad-output/implementation-artifacts/sprint-status.yaml`,
  `_bmad-output/implementation-artifacts/deferred-work.md`, and this story file.
- **Host artifacts on s10** are the real deliverable and are listed in the File List with paths and
  modes: the deploy runner's project directory + `config.yml` + `.runner`, `/etc/hosts`,
  `/root/.docker/config.json`, `/root/crm-prionex/fe-prionex-prod/` + `.env`.
- **Naming follows FR26 exactly** — `~/crm-prionex/fe-prionex-<stand>/`, i.e.
  `/root/crm-prionex/fe-prionex-prod/` for root. Do not invent `/opt/...`; that path belongs to the
  `api-prionex` stacks on s1.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 6.10` — lines 2761-2820, the five Givens]
- [Source: `_bmad-output/planning-artifacts/epics.md` — FR19 (l. 240-252, target amended to s10),
  FR25 (l. 282-291), FR26 (l. 292-294), Story 6.4's amended `runs-on` AC (l. 2555-2570), Story 6.9's
  amended meaning (l. 2725-2740)]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-18-prod-target.md` §1 —
  the seven measured findings on s10; §2 — the risk-ledger changes and the 3.6 GiB / 16 GB note;
  §4.11 — the story's insertion]
- [Source: `docs/migration-decisions.md#d23` — the whole record; specifically the CI-runner shape,
  the wg-private design statement, the `10.70.0.1` measurements, the missing `/etc/hosts` entry, the
  empty `auths`, the hypervisor→VM "No route to host", and the "re-verify, do not trust this
  snapshot" instruction]
- [Source: `docs/migration-decisions.md#d43` — §4 (the API name must not be derived), §5 (the
  four-row owner table), §6 (where the name may and may not appear), §7 (this story named by
  number), §8 (the A record, the `refused` state, the TTL, and the ordered blocker list)]
- [Source: `docs/migration-decisions.md#d13` — Trap 1, Trap 5, the full `label:docker://image`
  registration form, the interactive-stdin finding, and `--add-host` as load-bearing]
- [Source: `docs/migration-decisions.md#d28` §4 — the stand-directory reachability finding, its
  2026-08-19 amendment (variants d/e), and H4: the host credential is not the deploy credential]
- [Source: `docs/migration-decisions.md#d27` — five stand variables, no defaults]
- [Source: `docs/migration-decisions.md#d33` — the DB is the scheduler's source for labels]
- [Source: `.forgejo/workflows/deploy-stand.yml` — l. 66-70 (workspace `DOCKER_CONFIG`), l. 99-128
  (inputs incl. `frontend_network` and `stand_dir`), l. 263 (`runs-on: ${{ inputs.runner_label }}`),
  l. 216 (the wrong skeleton label — **not fixed here**), l. 583-597 (the `flock`/`timeout` image
  preflight), l. 606-620 (the authenticated clone)]
- [Source: `docker-compose.stand.yml` — the five `${VAR:?…}` variables and `external: true`]
- [Source: `.env.stand.example` — l. 52-71 (`FRONTEND_PORT`, and "PROD on s10 is measured there by
  Story 6.10"), l. 89-118 (`FRONTEND_NETWORK`, the silent-failure warning, and the network names)]
- [Source: `docs/preprod-infrastructure-requirement.md` §2.1-§2.2 and l. 226 — the network naming
  agreement, the `crm-kong-gateway` alias, and `docs/forgejo-prod-s2-plan.md:69`]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — l. 244-262 (Trap 1, the
  four-labels-on-disk correction, and `s2-prod-deploy` id 17 handed to "whoever owns Story
  6-series"), l. 3156-3157 (`capacity: 1` by design, s10 included), l. 3239-3249 (busybox `date`),
  l. 3780-3798 (the DB-vs-disk label disagreement, handed forward with s10 named),
  l. 3800-3810 (the s1 registry login vanishing twice), l. 3983-3995 (the sweep generalization,
  6.4/6.10 named)]
- [Source: `_bmad-output/implementation-artifacts/sprint-status.yaml` l. 1215-1310 — the Epic 6
  handover: the ordering constraint, what arrives working, what arrives broken, "assume nothing about
  the PROD backend", and the D43 block]
- [Source: `_bmad-output/implementation-artifacts/5-2-provision-the-pre-prod-stand-on-s1.md` — §2(f)
  the DEV `.env` drift, §5 the five variables and the `127.0.0.1:` bind form, Task 4.3-4.5, M1, M14]
- [Source: `_bmad-output/implementation-artifacts/6-3-rebuild-the-running-production-commit-into-the-forgejo-registry.md`
  §12 — *"s10. Not touched, not probed, not prepared. Story 6.10's."*; and its own D43 claim, §0]
- [Source: `README.md` l. 132-142 — the Server Deployment table and the s10 row this story fills in]

---

## Dev Agent Record

### Agent Model Used

<!-- dev-story fills this in -->

### Debug Log References

<!-- Run ledger, per §10. Disposition starts OPEN and is closed by the coordinator against a query. -->

| Row | What | Run / evidence | Attributed by `commit_sha` |
|---|---|---|---|
| | | | |

**Declared floor 5 / ceiling 13 CI rows, 0 dispatches. Disposition: OPEN.**

### Completion Notes List

<!-- AC10: §9's five non-proofs are restated here as non-proofs, each with the story that will
     prove it. Every closed AC carries a pasted artifact. -->

### File List

<!-- Repository files AND the host-side artifacts on s10, with paths and modes. §12. -->

### Review Findings

---

## Open Questions for Review

1. 🔴 **Branch base.** This story is contexted off `docs/prod-temporary-hostname`, not `origin/main`,
   because `#d43` is not on `main` and is this story's primary input (§0). Should
   `docs/prod-temporary-hostname` be merged as its own PR first, with this branch rebased onto `main`
   afterwards? **Owner: Oleg.** Default if unanswered: leave as is and let the two D43 commits ride in
   this story's PR.
2. 🔴 **Story 6.3 holds a decision number that Oleg has since taken.** 6.3's context file (written
   2026-08-26 03:22Z) declares it will append **D43**; Oleg minted D43 himself at 08:21Z the same day.
   6.3 is paused and does not know. **Owner: Oleg** — this story reports it and files it, and touches
   nothing of 6.3's.
3. ✅ **`FRONTEND_NETWORK` — ANSWERED 2026-08-26 by Oleg, verbatim: «возьми из s2».** No ask goes to
   `CRM/api-prionex`; the network is read from s2 over the NFR7 admin SSH path and reproduced on s10
   exactly (Tasks 2.13/2.14, AC7, Prohibition 3 as amended). **Not a blocker on Story 6.4 any more.**
   🔴 **What the answer deliberately does not settle, and nobody should read into it:** whether the
   PROD backend eventually moves to s10 or stays on s2 permanently. That stays with Oleg and
   `CRM/api-prionex`, and 6.10 neither asks it nor waits on it.
   ⚠️ **One thing for a reviewer to sanity-check:** the reading taken here is *"read s2 and reproduce
   what it actually runs"*. The other available reading — *"the backend stays on s2 and the s10
   frontend reaches it cross-host by its public API name"* — is **not contradicted** by this plan;
   both converge on Task 2.13 being the first action, and 2.14 records the API hostname either way.
   If the second reading is what was meant, the only change is that the reproduced network on s10 is
   expected to be backend-less — which AC7's last-but-one clause already requires to be written down
   as deliberate. **One line to correct, if it needs correcting.**
4. **Registration scope: repo or org?** (Task 3.3). Recommendation: **repo (`CRM/fe-prionex`)** — it
   confines root-equivalent jobs on the production VM to this repository, which is `#d23`'s own
   blast-radius argument. Precedent points the other way (`s1-deploy-dev-preprod` and `s2-prod-deploy`
   are org runners), **and so does the epic's own AC wording, which offers only "(instance/org)"**.
   Choosing repo is therefore a recorded departure from the AC's framing, not a detail. **Owner: Oleg.**
5. **`FRONTEND_PORT` bind form** — `127.0.0.1:<port>` or `<port>` (Task 5.2). Depends on the
   hypervisor's forwarding mechanism, which Task 2.10 measures; if the hypervisor shell is not
   available to the dev agent, the choice stays `OPEN` and both consequences are recorded. **Owner:
   Oleg**, or resolved by measurement.
6. **The TTL `14400` on a name declared temporary** (§7). Lowering it to `300` is cheap now, before
   the name is widely cached, and the same zone already carries the deliberate counter-example at
   `300`. This story recommends and does not act. **Owner: Oleg / the zone's owner.**

---

## Change Log

| Date | Change | By |
|---|---|---|
| 2026-08-26 | Story contexted from `docs/prod-temporary-hostname @ 1c54f32d` (§0). Five epic Givens carried as AC1–AC5/AC9; AC6–AC8 and AC10 added from §3–§8's findings. | create-story |
| 2026-08-26 | 🔴 **Oleg's answers applied, same day, before any dev work.** (1) `FRONTEND_NETWORK`: **«возьми из s2»** — Open Question 3 closes as an escalation and reopens as a measurement; AC7 rewritten around a read of s2, Tasks **2.13**/**2.14** added, Prohibition 3 narrowed from "never create" to "create only as an exact reproduction of what s2 shows, announced first", §12's s2 clause widened from an API read to an API read **plus** an NFR7 administrative SSH **read** (still no write, still no job on `s2-prod-deploy`). (2) s10 public egress: **«доступен»** — §4's hard branch removed, Task 2.7 demoted from decision gate to confirmation that reports a contradiction rather than falling back. (3) The DB-vs-disk label finding (§5) was queried and explained; no change to the story was required — AC1 already closes on both reads. | create-story |
