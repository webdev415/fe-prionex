---
baseline_commit: 4c88b0e1
---

# Story 1.12: Wire the Frontend to OpenBao and Verify What the Platform Already Provides

Status: review

> **Closing state.** Seven of eight ACs are closed with evidence. **AC1 is closed except for one
> value:** `SLACK_CD_WEBHOOK_URL` is present by name and holds Story 1.13's unrecoverable
> `example.invalid` stub. No work inside this story can supply it — the owner is whoever created it
> on 2026-08-10, and it is tracked in `deferred-work.md`. Review should decide whether that keeps
> the story open or whether it ships as a named «не проверено».
>
> **Read the Dev Agent Record before the tasks.** Two things there matter more than the checklist:
> the host `bao` wrapper that silently authenticates as `admin` and turned nine isolation checks
> into false positives, and the precise shape of the both-runners evidence for AC7 — runner 19 is
> proved by fail-closed plus attribution, not by reading its log.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the frontend's build values read from OpenBao through its own AppRole, and the secrets the
platform already provides verified rather than recreated,
so that later epics do not stall on missing credentials, and this repository does not become a
third incompatible secrets pattern on an instance that already carries two.

---

## 🚨 Read this before anything else

**This story creates almost nothing. Most of its acceptance criteria are satisfied by work that
already happened — by the platform before we arrived, and by Oleg's provisioning session on
2026-08-13. The failure mode here is not breaking something. It is reporting a migration that did
not happen.**

Story 1.10's review caught exactly this: the plan said to create `ci-bot` and `REGISTRY_TOKEN`,
and neither had ever existed. Running that story as written would have produced a truthful-looking
record of creating things that were there. This story is the same shape, larger.

### 1. One secret is present by name and dead by value

`SLACK_CD_WEBHOOK_URL` exists at `CRM` org scope. Its value is a non-resolving `example.invalid`
stub, written by Story 1.13 on 2026-08-10. **Forgejo secret values are write-only — the original
webhook URL is unrecoverable.** Whoever created it on 2026-08-10 must supply it again.

An AC1 that checks *names* passes on this secret and leaves Epic 4's deploy notifications silently
dead until someone notices no Slack message ever arrived. **Presence of the name is not evidence.**
Either the value is re-supplied and recorded, or the story records «не проверено, значение —
заглушка» with a named owner. There is no third answer that counts as done.

Source: `deferred-work.md`, «Deferred from: code review of story 1-13», first item.

### 2. 🔴 The hub's OpenBao step cannot run on our runners, and this was measured today

This is the finding that matters most, and neither the sprint change proposal nor its addendum
contains it.

`CRM/PRIONEX_HUB` reads OpenBao from **deploy runners that execute on the host** (`runs-on: s2`,
host `docker.sock`), where `bao`, `jq` and `curl` are installed as host packages. Our runners are
**build runners** — labels `node-20` and `docker-build` — and every job body runs inside a job
container spawned in a nested dind. Measured on s1, 2026-08-13, in both job images:

| image | `bao` | `jq` | `curl` |
|---|---|---|---|
| `node:20-bookworm` (label `node-20`) | **absent** | **absent** | `/usr/bin/curl` |
| `code.forgejo.org/oci/docker:cli` (label `docker-build`) | **absent** | **absent** | **absent** |

The hub's step calls `bao` three times (`login`, `kv get`, `token revoke -self`) and `jq` five.
**Copied verbatim into a workflow on our labels, it dies on `bao: command not found`.**

⚠️ **The first version of this section concluded the hub's step "cannot run here". That was wrong,
and the correction matters more than the original claim.** `code.forgejo.org/oci/docker:cli` is
Alpine 3.24 with `apk`, and Alpine ships both packages: `openbao-2.6.0-r0` and `jq-1.8.1-r0`.
Measured on the instance, three runs, from a job-equivalent container:

| | run 1 | run 2 | run 3 |
|---|---|---|---|
| container start only | 0.54 s | 0.55 s | 0.55 s |
| `+ apk add --no-cache openbao jq` | 1.94 s | 1.92 s | 1.85 s |

**The tools cost ~1.35 s.** Whatever else Task 3 weighs, it is not weighing a slow install.

The hub already paid for this lesson on its own side — `promote-prod.yml:168-186` exists because
`bao` was not installed on s2 and the failure surfaced only after a break-glass window had been
spent:

```sh
for _bin in bao jq curl docker git; do
  command -v "$_bin" >/dev/null 2>&1 || {
    echo "на этом раннере отсутствует '$_bin' — promote-prod.yml без него работать не может." >&2
    exit 1
  }
done
```

**So AC4's "reproduce the hub's step" and this story's runners are in direct conflict, and the
conflict must be resolved on paper in Task 3 before any YAML is written.** Egress from a job
container was measured the same day and is open (`deb.debian.org` 200, `github.com` 200,
`api.github.com` 200), so all three options below are live. See Task 3 for the trade-offs and the
recommendation.

### 3. Two runners, and changing one is worse than changing neither

`config.yml` and `config-2.yml` are separate files on the host. The `--add-host` line this story
adds is **not** in either of them yet (verified on s1 today at
`/opt/forgejo-runner-fe-prionex/config.yml:45` and `config-2.yml:37` — both carry only the
`git.crm-prionex.com` mapping).

On 2026-08-13 only the first dind was connected to the `forgejo_forgejo` network. The second was
found isolated and connected afterwards. **Had that gone unnoticed, every job landing on runner 2
would have failed while runner 1 succeeded** — an intermittent fault with no obvious cause, in a
runner pair Story 1.9 built specifically so work spreads across both.

The drift check in `docs/runners/README.md` diffs each config against the host. **It never compares
runner 1 against runner 2**, so it cannot catch this class of divergence at all. Fixing that is
part of AC7, not a nice-to-have.

### 4. Credentials: what exists, what must be minted, what cannot be revoked

**The OpenBao admin token is not held by this repository.** Oleg's provisioning session used his own
`admin` session and issued test `secret_id`s with `num_uses=1`, which died on first use — **no
credential values survive from that session.** Reading the three `role_id`s and minting three
`secret_id`s requires a token with rights on `auth/approle/role/fe-*`, and one cannot be minted
without an existing one (OpenBao only lets a token mint children whose policies are a subset of its
own — this is exactly why `fe-prionex-provisioner` failed to be created).

**Tasks 4 and 5 are hard-gated on Oleg supplying that token in-session. Do not invent placeholder
values, and do not write partial secrets "to be filled in later" — a `secret_id` that is present and
wrong fails identically to one that is absent, but takes longer to diagnose.**

**The Forgejo API token needed to write the seven repository secrets can be minted here** and Oleg
authorised it on 2026-08-13:

```sh
docker exec -u git forgejo gitea admin user generate-access-token \
  -u platform-admin -t <name> --scopes write:repository
```

🔴 **Decide the exit before minting.** Established twice (stories 1.7 and 1.10): an admin **cannot**
revoke another account's token by any scripted route — `gitea admin user` has no delete subcommand,
`DELETE /users/{username}/tokens/{token}` needs basic auth as that same account, and the UI lists
only the logged-in user's own tokens. The only route is deleting the `access_token` row on
`forgejo-postgres`, which Oleg approved on 2026-08-12 for `fe_reg_1_10_rw`. The instance already
carries 93 live tokens, 8 of them migration leftovers. **Mint one, use it, delete the row in the
same session, and record the count before and after.**

### 5. What this story does not buy, and must not claim

The six `VITE_*` values are **public URLs baked into a bundle any visitor can read in devtools.**
Storing them in OpenBao buys uniformity with the neighbours and a working chain for when the
frontend acquires a real secret. It buys **no confidentiality whatsoever.**

Any sentence in the story record, the commit message or `docs/` implying these values are secret is
a defect, not a flourish.

### Prohibitions

🚨 **A prohibition in this block cannot be overridden by a subtask.** (Story-template rule adopted
after Story 1.10's Task 6.3 authorised on s2 exactly what its own prohibitions block forbade.)

1. **Do not create any secret or variable that already exists.** Verify, record, move on.
2. **Do not create any AppRole credential at organization scope.** Repository scope only, all seven.
3. **Do not write any SSH secret into Forgejo, of any name, for any reason.** Under the amended
   FR19 this is what keeps a triggered legacy `.github/workflows/CD.yml` structurally unable to
   reach a server. It is the plan's largest retired hazard; do not un-retire it.
4. **Do not write `role_id` or `secret_id` into any file in this repository**, including as an
   example, a redacted sample or a comment. They go into Forgejo repository secrets and nowhere
   else.
5. **Do not pass any credential as a command-line argument** — not to `bao`, not to `jq`, not to
   `curl`. `/proc/<pid>/cmdline` is world-readable on the runner. See §Dev Notes «The argv trap».
6. **Do not write any secret to `$GITHUB_ENV`.** The runner creates `.../act/workflow/envs.txt`
   with mode `0644` **before** the step body runs, so `umask 077` inside the step does not help.
   The hub found this and collapsed its login/read/build/deploy into a single `run:` block.
7. **Do not change one runner's config without changing and re-verifying the other.**
8. **Do not restart the Forgejo instance, `forgejo-openbao`, or any container belonging to another
   tenant.** Restarting our own two runners is in scope and expected.
9. **Do not touch `CRM/PRIONEX_HUB`, `CRM/api-prionex`, or any KV path outside `secret/fe/*`.**
   Read the hub's workflows if needed — that is established practice and read-only — but write
   nothing.

---

## Acceptance Criteria

Source: `_bmad-output/planning-artifacts/epics.md`, Story 1.12 (rewritten 2026-08-13 by
`sprint-change-proposal-2026-08-13-openbao.md` §4.1; AC7 added from the same proposal's addendum,
"Still outstanding" item 1).

**AC1 — verification, not creation.**
Given the `CRM` organization already holds `REGISTRY_TOKEN_RW`, `REGISTRY_TOKEN_RO`,
`REGISTRY_USER`, `REGISTRY_USER_RO` and `SLACK_CD_WEBHOOK_URL`,
when the secret inventory is reviewed,
then each is confirmed present and its scope recorded,
and nothing is created that already exists,
and `REGISTRY_TOKEN_RW` / `_RO` are recorded as **«не проверено»** — Story 1.10 exercised minted
equivalents of the same scope, not these secrets,
and `SLACK_CD_WEBHOOK_URL` is resolved per §1 above: value re-supplied and recorded, or recorded as
a stub with a named owner.

**AC1-bis — no SSH secret.** Retained unchanged. No SSH secret of any kind is created in Forgejo,
and the rationale is recorded: a legacy `CD.yml` execution can then never reach a server, which
makes D9's suppression permanent rather than procedural.

**AC2 — AppRole bootstrap.**
Given the `PRIONEX_HUB` pattern,
when `fe-prionex` repository secrets are created,
then `OPENBAO_ADDR`, `OPENBAO_DEV_ROLE_ID`, `OPENBAO_DEV_SECRET_ID`, `OPENBAO_PREPROD_ROLE_ID`,
`OPENBAO_PREPROD_SECRET_ID`, `OPENBAO_PROD_ROLE_ID` and `OPENBAO_PROD_SECRET_ID` exist at
**repository** scope,
and no AppRole credential is created at organization scope,
and the issue date of `OPENBAO_PROD_SECRET_ID` is recorded, because its `secret_id_ttl` is 7200h and
nothing rotates it.

**AC3 — KV layout.**
Given the hub uses `secret/hub/{dev,pre-prod,prod}/app`,
when the frontend's paths are verified,
then they are `secret/fe/{dev,pre-prod,prod}/app` (KV v2),
and each holds `VITE_API_BASE_URL` and `VITE_WS_URL` for that environment, unsuffixed,
and it is recorded that these values are **not confidential**,
and the PROD pair is recorded as sourced from the bundle production actually serves,
and the PRE-PROD pair is recorded as a literal placeholder because that backend does not exist yet.

**AC4 — the read step is inherited, not invented.**
Given the hardening in `PRIONEX_HUB`'s deploy workflows,
when the frontend's OpenBao read step is written,
then it reproduces: AppRole login whose credentials never enter any process's `argv`; `::add-mask::`
on the returned token; structural per-key extraction from a single fetched JSON document; per-line
masking with percent-escaping; the reserved-key denylist; token revocation and `unset` after the
last read; and no secret written to disk or to `$GITHUB_ENV`,
and each measure carries a comment naming what it prevents,
and **any deliberate deviation from the hub's version is recorded with its reason** — see §2, this
is expected here, not hypothetical.

**AC5 — `FRONTEND_PORT`.** Confirmed absent from Forgejo variables (already true), rationale
recorded: ports live in per-stand server `.env`, no duplicated state.

**AC6 — the dependency is named, not assumed.**
The owner of the OpenBao-side work is named and the request recorded as sent; if unfulfilled, the
story records the absence explicitly rather than proceeding on a placeholder.

**AC7 — both runners can reach OpenBao.**
`--add-host openbao:172.20.0.5` is added to `container.options` in **both** `config.yml` and
`config-2.yml`, both runners are restarted, and reachability is re-proven on **each**,
and the registry access those same `options` lines already carry is re-proven **after** the restart,
and a preflight fails loudly naming the cause when OpenBao is unreachable,
and `docs/runners/README.md`'s drift check is extended to compare the two runners against each other.

---

## Tasks / Subtasks

### Task 1 — Pre-flight: bind every number before touching anything (AC: 1, 1-bis, 5) ✅

- [ ] 1.1 Record the live token count on the instance before minting anything. **Baseline: 96 as of
      2026-08-13** (93 on 2026-08-12 — three appeared in between, none ours).
- [ ] 1.2 Confirm both dinds are still attached to `forgejo_forgejo` and record the three IPs.
      Verified 2026-08-13: `forgejo-openbao=172.20.0.5`, `dind=172.20.0.6`, `dind-2=172.20.0.7`.
      **If OpenBao's IP has changed, every hardcoded `--add-host` in this story changes with it** —
      stop and re-derive rather than pattern-matching the number below.
- [ ] 1.3 Re-prove reachability from a job-equivalent container inside **each** dind:
      `docker exec <dind> docker -H tcp://localhost:2375 run --rm --add-host openbao:172.20.0.5 \
      --entrypoint sh curlimages/curl:latest -c 'curl -s -o /dev/null -w "%{http_code}" \
      --max-time 10 http://openbao:8200/v1/sys/seal-status'` — expect `200` on both.
- [ ] 1.4 Re-confirm the secret and variable inventory (§Dev Notes «Secret and variable inventory»
      carries it as read on 2026-08-13, with the SQL). Expect the five org secrets present,
      `FRONTEND_PORT` absent, and `CRM/fe-prionex` holding nothing yet. **Read it from the database,
      not the API** — names are in clear there, and it needs no token to revoke afterwards.
- [ ] 1.5 Establish the state of `SLACK_CD_WEBHOOK_URL`'s **value** — not its name (§1). Record the
      owner and whether it has been re-supplied.
- [ ] 1.6 **AC1-bis:** confirm no secret of an SSH shape exists at either scope (`*_SSH_HOST`,
      `*_SSH_USER`, `*_SSH_KEY`, and anything else key-like), and record that this story creates
      none. This is the check that keeps a triggered legacy `CD.yml` unable to reach a server; it
      costs one listing and it is the plan's largest retired hazard.

### Task 2 — Name the dependency and its owner (AC: 6) ✅

- [ ] 2.1 Record that the OpenBao-side objects were provisioned by Oleg on 2026-08-13 (policies,
      roles, KV paths — see D15) and that **no credential values survive** from that session.
- [ ] 2.2 Record that reading `role_id` and minting `secret_id` is gated on Oleg supplying an
      OpenBao token in-session, and that this repository cannot mint one itself.
- [ ] 2.3 If the token is not supplied, **stop after Task 3 and record the absence.** Do not
      placeholder your way past it.

### Task 3 — Decide the read mechanism on paper before writing any YAML (AC: 4) ✅

🔴 **This is the story's real design decision. Do it in writing, in the story record, before
touching a workflow file.**

> ✅ **DECIDED 2026-08-13 (Oleg): option (a)** — `apk add --no-cache openbao=2.6.0-r0 jq`, then the
> hub's step reproduced almost verbatim. Recorded in `docs/migration-decisions.md#d15`. Epics 3–6
> inherit this and must not re-decide it. The two obligations it carries — pinning the version and
> a preflight that distinguishes "no `bao`" from "OpenBao unreachable" — are 3.1a and 3.1b below
> and carry into Task 7.

The constraint is §2: neither job image carries `bao` or `jq` — but on the image that matters, both
are one `apk add` away, measured at ~1.35 s.

**Which image matters:** the values are needed at **build** time, because Option C bakes `VITE_*`
into the bundle and Story 3.3 passes them as `--build-arg`. That job runs on the `docker-build`
label → `code.forgejo.org/oci/docker:cli` → **Alpine 3.24, with `apk`, `wget` and busybox**. The
`node-20` image (Debian bookworm) has `curl` but no OpenBao package in Debian; it is not where this
runs, so its poverty does not constrain the choice. Deploy-time reads in Epics 4–6 land on deploy
runners on the target hosts, where the hub already installs `bao` as a host package — a different
question, decided by those stories, not this one.

| option | cost | risk |
|---|---|---|
| **(a) `apk add --no-cache openbao jq`, then the hub's step essentially verbatim** | **~1.35 s per job**, measured three times | an Alpine mirror fetch on the critical path of every build; Alpine ships **2.6.0** against the server's **2.6.1** (client/server skew of one patch release) |
| **(b) HTTP API via `wget`/`curl`, no CLI** | ~0.4 s — still needs `apk add jq` for structural extraction, so the delta against (a) is **~1 s** | every hardening property must be re-argued and re-proved individually instead of inherited; our own code to review, with none of the hub's incident history behind it |
| **(c) bake a job image with `bao`+`jq`** | an image to build, host and keep current | the `docker-build` label was bound to its image at **registration** time (Stories 1.7/1.9, Trap 5); changing it means re-registering, or a per-job `container:` override that diverges from every other job |

- [x] 3.1 Choose one. **Chosen: (a).** For roughly one second per job we get the hub's
      reviewed, incident-hardened step almost verbatim — the `jq env` login, the per-line
      `::add-mask::` with percent-escaping, structural key extraction, the denylist, and
      `bao token revoke -self`. Option (b) saves that second and spends it on re-arguing five
      security properties from scratch, in code nobody else on this instance runs. **The deciding
      factor is not speed, it is that the hub's version has already survived a real `PATH` hijack
      and two masking failures that were found by running it, not by reading it.**
      ⚠️ **This reverses the recommendation first written here**, which was (b), on the assumption
      that installing `bao` meant a manual multi-megabyte download. Alpine packaging it changes the
      arithmetic; the measurement is in §2.
- [ ] 3.1a Whichever is chosen, **pin the version** and record the skew: `apk add openbao=2.6.0-r0`
      rather than floating, so a future Alpine bump is a deliberate change and not a surprise on a
      production deploy. Record that the client is one patch release behind the server and that
      this is expected to be compatible — **not verified**, and cheap to verify in Task 7.3.
- [ ] 3.1b Record the residual risk plainly: option (a) puts an **Alpine mirror fetch on the
      critical path of every build**. If the mirror is unreachable the build fails before it starts.
      The preflight in Task 7.2 must distinguish "no `bao`" from "OpenBao unreachable" — they have
      different causes and different fixes.
- [x] 3.2 Decision, rejected options and reasoning recorded in `docs/migration-decisions.md#d15`
      (addendum «Механизм чтения», 2026-08-13) and above.
- [ ] 3.3 Confirm the token-revocation step is part of the design: the hub calls
      `bao token revoke -self` after its **last** read, so the token is dead for the rest of the
      step rather than inherited by every subsequent `docker build`/`push`/`compose`. Option (b)
      must do the same via `POST /v1/auth/token/revoke-self`.

### Task 4 — Read and mint the six values, verify the KV contents (AC: 2, 3) ✅

- [ ] 4.1 With Oleg's OpenBao token in-session, read the three `role_id`s:
      `bao read -field=role_id auth/approle/role/<role>/role-id` for `fe-dev`, `fe-pre-prod`,
      `fe-prod`.
- [ ] 4.2 Mint three `secret_id`s:
      `bao write -f -field=secret_id auth/approle/role/<role>/secret-id`.
      **A `secret_id` is displayed once.** Do not mint until ready to write all seven secrets.
- [ ] 4.3 Record the exact issue timestamp of the `fe-prod` `secret_id` (AC2). TTL 7200h ≈ expires
      2027-06-09 10:56 UTC; nothing rotates it.
- [ ] 4.4 Verify each role reads only its own path and is denied the other two, as measured on
      2026-08-13 (nine checks). Re-running the full nine is cheap and re-proves the isolation
      against today's state rather than yesterday's record.
- [ ] 4.5 **AC3:** confirm each of the three paths holds exactly `VITE_API_BASE_URL` and
      `VITE_WS_URL`, that the PROD pair matches the values production actually serves
      (`https://api.crm-prionex.online` / `wss://api.crm-prionex.online`), and that the PRE-PROD pair
      is still the literal placeholder. **An extra key nobody expected is a finding, not noise** —
      it is what the denylist in Task 7 exists for.

### Task 5 — Write the seven repository secrets (AC: 2) ✅

- [ ] 5.1 Mint a Forgejo token, scope `write:repository`, on `platform-admin` (§4). Record its name
      and id.
- [ ] 5.2 Write all seven at **repository** scope on `CRM/fe-prionex`:
      `PUT /repos/CRM/fe-prionex/actions/secrets/{name}`. `OPENBAO_ADDR` is `http://openbao:8200` —
      the hostname the `--add-host` line creates, not an IP, so a future IP change is one config
      edit rather than seven secret rewrites.
- [ ] 5.3 Verify by listing secret **names** (values are unreadable by design) and confirm no
      AppRole name appears at org scope.
- [ ] 5.4 Delete the token's `access_token` row on `forgejo-postgres` and re-count live tokens
      against Task 1.1. **In the same session.**

### Task 6 — Runner configuration, both of them (AC: 7) ✅

- [ ] 6.1 Add `--add-host openbao:172.20.0.5` to `container.options` in
      `/opt/forgejo-runner-fe-prionex/config.yml` **and** `config-2.yml`, alongside the existing
      `git.crm-prionex.com` mapping. Add a 🚨 LOAD-BEARING comment matching the style already there,
      naming what breaks without it.
- [ ] 6.2 Restart both runners.
- [ ] 6.3 Re-prove **both** properties on **both** runners after the restart: OpenBao reachable
      (`200` on `sys/seal-status`) **and** the registry still resolves by name — the same
      `options` line carries both, and a typo in it silently breaks Story 3.1's push.
- [ ] 6.4 Update the sanitised copies in `docs/runners/config.yml` and `config-2.yml`.
- [ ] 6.5 Extend the drift check in `docs/runners/README.md` to diff runner 1's config against
      runner 2's, with the expected differences named (`cache.host`, `docker_host`, `runner.file`,
      banner). Today it compares each file only against the host and cannot see divergence between
      the pair.

### Task 7 — Write and prove the read step (AC: 4) ✅

> ✅ **Run 486, four jobs, all green, 2026-08-13 12:17Z.** Fired by push on the throwaway branch
> `probe/openbao-1-12` (deleted afterwards; D9 re-confirmed on all three protected branches — only
> `README.md` under `.forgejo/workflows/`). Evidence is in the Dev Agent Record under «Task 7».
>
> ⚠️ **Deviation, recorded:** the probe triggered on `push` pinned to that branch rather than
> `workflow_dispatch` as Stories 1.8/1.9 did. Dispatching needs an API token, and this story's
> token was revoked at the end of Task 5 by design; minting a second one to press a button is
> worse debt than a trigger that cannot fire on a protected branch and dies with its branch.

- [ ] 7.1 Implement the chosen mechanism as a single `run:` block — login, read, export, revoke —
      with every hardening measure commented with what it prevents.
- [ ] 7.2 Add the preflight: OpenBao unreachable must fail with a message naming the hardcoded
      `--add-host` mapping as the likely cause, not a bare `bao`/`curl` timeout. Model on
      `promote-prod.yml:168-186`.
- [ ] 7.3 Prove it end to end on a throwaway branch (established method — Stories 1.8, 1.9 used
      `probe/*` branches): a job that logs into `secret/fe/dev/app`, reads both keys, and asserts
      they are non-empty and **masked in the log**. Delete the branch afterwards and re-confirm the
      D9 invariant on all three protected branches.
- [ ] 7.4 Verify the masking claim by inspecting the real job log, not by assuming — the hub found
      that a multi-line value masks only its first line and that a value containing `%25` masks
      nothing at all.

### Task 8 — Record the outcome (AC: 1, 2, 3, 5, 6, 7) ✅

- [ ] 8.1 Amend D15 in `docs/migration-decisions.md` with: the mechanism decision from Task 3, the
      `fe-prod` `secret_id` issue date, the runner-config change, and the Slack webhook's resolution.
- [ ] 8.2 Update `docs/forgejo-migration.md` §3 — its secrets section predates all of this.
- [ ] 8.3 Add a changelog row. Record every «не проверено» honestly: `REGISTRY_TOKEN_RW`/`_RO`
      values, and anything Task 7 could not exercise.
- [ ] 8.4 Move anything unresolved into `deferred-work.md` with an owner, not into a comment.

### Task 9 — Commit and close (AC: all) ✅

- [ ] 9.1 Commit config copies, README drift check, workflow snippet, decision records.
- [ ] 9.2 Update `sprint-status.yaml` to `review`.

---

## Dev Notes

### What this story produces

Three artifacts and one proof:

1. Seven repository secrets in Forgejo (values live nowhere in this repository).
2. `--add-host openbao:…` in both runner configs, mirrored into `docs/runners/`, plus a drift check
   that can finally see runner-to-runner divergence.
3. A hardened OpenBao read step that Epics 3, 4, 5 and 6 inherit verbatim instead of each inventing
   one.
4. A recorded, evidenced answer to «does a job on our runners actually get values out of OpenBao».

### The argv trap, and why the obvious fix is also the trap

The hub's comment block on this is worth reading in full at
`deploy-dev.yml:69-95`. Summary, because a dev agent will otherwise reintroduce it:

- `bao write auth/approle/login role_id="$X" secret_id="$Y"` puts both credentials in
  `/proc/<pid>/cmdline`, world-readable.
- The first fix — `jq -n --arg r "$ROLE_ID" --arg s "$SECRET_ID"` — **moved** the exposure rather
  than closing it: `--arg` values are jq's own CLI arguments. The hub caught this with a
  kernel-level `execve` capture (bpftrace), not by reasoning.
- The real fix uses jq's `env` builtin, which reads from the inherited environment
  (`/proc/<pid>/environ`, `0400` owner-only):

```sh
BAO_TOKEN=$(jq -n '{role_id: env.OPENBAO_DEV_ROLE_ID, secret_id: env.OPENBAO_DEV_SECRET_ID}' \
  | bao write -format=json auth/approle/login - \
  | jq -r '.auth.client_token')
echo "::add-mask::$BAO_TOKEN"
```

**Under option (b) the equivalent is `curl --data @-` with the JSON body on stdin, never `-d
"$body"`.** The property to preserve is "no credential appears in any argv", not "use jq".

### The three masking traps, all found by real re-verification

1. **Multi-line values mask only their first line.** `::add-mask::` is parsed one physical log line
   at a time. Register a mask for **every line** of a value.
2. **Workflow-command values are percent-decoded by the runner.** A value containing a literal
   `%25` gets decoded to `%` and the wrong string is registered — the mask never matches and the
   value prints in the clear. Escape `%`→`%25`, CR→`%0D`, LF→`%0A` in the text handed to
   `::add-mask::` only; never touch the exported value.
3. **Never re-parse a `KEY=VALUE` text stream.** A value containing an embedded newline re-splits
   into a new record which the loop then `export`s — the hub demonstrated a crafted value hijacking
   `PATH` to `/tmp/pwned` this way. Fetch the JSON once, extract each value structurally by key.

Reference implementation, `deploy-preprod.yml:200-247` (read it directly, no token needed):

```sh
ssh root@10.67.0.1 'docker exec -u git forgejo git -C \
  /data/git/repositories/crm/prionex_hub.git show main:.github/workflows/deploy-preprod.yml'
```

### The denylist, and why a regex is not enough

The hub first validated key names with `^[A-Za-z_][A-Za-z0-9_]*$` and wrote a comment claiming that
closed the `PATH` hijack. **It did not** — `PATH` and `LD_PRELOAD` match that regex perfectly. Its
own review caught the false claim, and the denylist is what actually closes it:

```
PATH|LD_PRELOAD|LD_LIBRARY_PATH|IFS|BASH_ENV|ENV|SHELLOPTS|BASHOPTS|HOME|TMPDIR|DOCKER_CONFIG|DOCKER_HOST|BAO_*|VAULT_*|GITHUB_*
```

Keep both: identifier regex **and** denylist. `DOCKER_CONFIG` is on the list for a concrete reason —
a key by that name would redirect docker to a shared credential store, which on s1 belongs to other
tenants.

For `secret/fe/*` the only keys are `VITE_API_BASE_URL` and `VITE_WS_URL`, so the denylist will
never fire in practice today. It is there because the KV path is writable by whoever holds the
OpenBao admin token, and a step that trusts its input becomes wrong the moment that changes.

### `$GITHUB_ENV` is world-readable — this shapes the whole step

Forgejo Actions writes `$GITHUB_ENV` to `.../act/workflow/envs.txt`, created by the runner with mode
`0644` **before** the step body runs, so `umask 077` inside the step does not cover it. The hub's
response was structural: login, read, build, deploy and smoke-gate collapsed into **one** `run:`
block, with secrets exported into that process's bash variables and never into `$GITHUB_ENV`.
Non-secret values (image tags) in `$GITHUB_ENV` are fine.

Ours is the same shape: whatever step reads OpenBao must also be the step that consumes the values,
or the values have to cross `$GITHUB_ENV` to get anywhere. **Story 3.3 passes them as
`--build-arg`, so the read and the `docker build` belong in the same block.** Flag this to Epic 3
rather than letting it discover the constraint late.

### Live-instance facts (verified 2026-08-13 — re-verify in Task 1)

```
forgejo-openbao                    forgejo_forgejo=172.20.0.5   OpenBao 2.6.1, healthy, up 11d
forgejo-runner-fe-prionex-dind     runner=192.168.226.2  forgejo_forgejo=172.20.0.6
forgejo-runner-fe-prionex-dind-2   runner=192.168.226.5  forgejo_forgejo=172.20.0.7
```

- `http://openbao:8200/v1/sys/seal-status` → `200` from a job-equivalent container in **both** dinds,
  with `--add-host openbao:172.20.0.5`.
- Neither live runner config carries the `openbao` mapping yet (`config.yml:45`, `config-2.yml:37`).
- Job images carry neither `bao` nor `jq`; `docker:cli` carries no `curl`.
- Egress from a job container is open: `deb.debian.org` 200, `github.com` 200, `api.github.com` 200.
- Port 8200 is published on the host only at `10.70.0.1` and `127.0.0.1` — a container on the host
  bridge reaches neither (measured `000`). The shared network plus `--add-host` is the only path.
- `container.network: "forgejo_forgejo"` **cannot** be used: the nested dind engine's network list
  is `bridge`/`host`/`none` only, so the name does not resolve there at all.

### Secret and variable inventory, read 2026-08-13 (AC1, AC1-bis, AC5 — pre-bound)

Read straight from the Forgejo database, which needs no API token: **secret *names* are stored in
clear, only values are encrypted.** Use the same route in Task 1 — it is cheaper than a token and
leaves nothing to revoke.

```sh
ssh root@10.67.0.1 'docker exec -i forgejo-postgres psql -U forgejo -d forgejo' <<'SQL'
select s.id, s.name, case when s.repo_id=0 then 'org' else 'repo' end as scope,
       o.name as owner, r.name as repo,
       to_char(to_timestamp(s.created_unix),'YYYY-MM-DD') as created
from secret s left join "user" o on o.id=s.owner_id left join repository r on r.id=s.repo_id
order by scope, owner, s.name;
SQL
```

**AC1 — all five `CRM` org secrets confirmed present**, ids 21–25, all created 2026-08-10:
`SLACK_CD_WEBHOOK_URL` (21), `REGISTRY_USER` (22), `REGISTRY_USER_RO` (23), `REGISTRY_TOKEN_RW`
(24), `REGISTRY_TOKEN_RO` (25). Names match D14 exactly. Nothing here is to be created.

**AC1-bis — zero secrets of an SSH shape exist anywhere on the instance**, not merely in `CRM`
(`where name ilike '%SSH%'` → 0 rows across all 53 secrets). Stronger than the AC requires.

**AC5 — `FRONTEND_PORT` is absent**, and more: `CRM/fe-prionex` currently holds **no repository
secrets and no repository variables at all**. The seven from AC2 will be the first. That also means
any secret appearing under this repo that is not one of the seven is a finding.

**AC2 — the hub's seven, for shape comparison** (ids 4, 5, 6, 13, 14, 15, 16 on `CRM/PRIONEX_HUB`):
`OPENBAO_ADDR` and the three `ROLE_ID`/`SECRET_ID` pairs, added incrementally — dev 2026-08-04,
preprod 2026-08-06, prod 2026-08-07 — as each environment came online. All at **repository** scope,
confirming AC2's prohibition on org-scoped AppRole credentials matches what the hub actually does.

**A third variation exists and we are not following it:** org `Infra` splits the pair —
`VAULT_ROLE_ID` is an *action variable*, `VAULT_SECRET_ID` is a *secret*. Defensible (a `role_id` is
not confidential), but it is a third pattern on this instance and D15's whole point was not to add a
fourth. **Both of ours are secrets, as the hub has them.**

**Context worth noticing:** `CRM/api-prionex` added fifteen `DEV_*` secrets on 2026-08-13 — the day
D15 was decided. The pattern this project rejected is actively growing next door. Not our call, and
not a reason to revisit D15; recorded so the next reader is not surprised by the count.

### Token accounting

Live `access_token` rows: **96** on 2026-08-13, up from the 93 recorded on 2026-08-12 — three
tokens appeared in between and none of them are ours. Task 1.1's baseline is therefore 96, not 93,
and Task 5.4's post-check must account for the drift being someone else's.

**No token was minted while writing this story.** Everything above came from the database. The only
step that genuinely needs one is Task 5 (writing the seven repository secrets), which is gated on
Task 4 anyway.

### OpenBao objects as provisioned (D15)

| object | detail |
|---|---|
| policies | `fe-dev-read`, `fe-pre-prod-read`, `fe-prod-read` — `read` on `secret/data/fe/<env>/*`, `read,list` on `secret/metadata/fe/<env>/*`, nothing else |
| roles | `fe-dev`, `fe-pre-prod` — `secret_id_ttl 0`, token `10m/15m`; `fe-prod` — `secret_id_ttl 7200h`, token `15m/15m` |
| KV (v2) | `secret/fe/dev/app`, `secret/fe/pre-prod/app`, `secret/fe/prod/app` |

**Name mapping — none of these three derive from each other:**

| Forgejo secret | OpenBao role | KV path |
|---|---|---|
| `OPENBAO_DEV_*` | `fe-dev` | `secret/fe/dev/app` |
| `OPENBAO_PREPROD_*` | `fe-pre-prod` | `secret/fe/**pre-prod**/app` |
| `OPENBAO_PROD_*` | `fe-prod` | `secret/fe/prod/app` |

A path assembled from the secret name yields `secret/fe/preprod/app`, which does not exist. The
`PREPROD` spelling exists because the hub's secrets spell it that way.

### Anti-patterns for this story

- **Creating what exists.** The single most likely failure. Verify first, always.
- **Checking names instead of values.** §1. Applies to `SLACK_CD_WEBHOOK_URL` specifically.
- **Copying the hub's YAML verbatim.** It will not run here (§2). Reproduce the *properties*.
- **Deriving the KV path from the secret name.** Produces `preprod`, which does not exist.
- **Changing one runner.** §3.
- **Minting a Forgejo token without deciding its exit.** §4. Eight leftovers already exist.
- **Claiming the `VITE_*` values are secret.** §5.
- **Reasoning about masking instead of reading the job log.** All three masking traps were found by
  real verification and missed by review.

### Previous story intelligence (Story 1.11, done 2026-08-13)

- **Empty evidence is not evidence.** 1.11's cleanup-rule preview returned "0 packages" and meant
  nothing — every foreign version was excluded by age before the pattern was ever read. Re-running
  with the age filter neutralised made the pattern load-bearing and produced a real result. **Apply
  here:** a job that "succeeds" proves nothing unless the assertion it makes is one that could have
  failed. Task 7.3 must assert non-empty *and* masked, not merely exit 0.
- **A form asserted in one story propagates through the whole plan.** `sha-<sha>-prod` came from a
  Story 3.3 "for example" and reached a retention rule as though it were produced somewhere. **Apply
  here:** the read step this story writes will be copied into four later stories. Anything wrong in
  it is wrong four more times.
- **The instance is the source of truth, the plan is not.** Both of 1.11's serious findings came
  from reading the instance and disagreeing with the document.
- **1.11 left exactly three items open**, none of which block this story: the rollback depth `N`
  (constrains Stories 5.4 and 6.6), the ownerless `ci-probe`/`ci-probe-cache` packages, and the fact
  that nobody outside this migration knows a cleanup rule now governs 80 `api-prionex` packages.
  Checked deliberately — none touch credentials, so Task 5 is not gated on them.

### Git intelligence

Recent commits are documentation-only (`4c88b0e1`, `727bfbd5`, `22f42246`, `3d96244c`, `16c6b715`):
proposal, provisioning record and the FR18 correction. **No application code has changed in this
migration.** This story continues that pattern except for one workflow file and the runner-config
copies. If a diff in this story touches `src/`, something has gone wrong.

House conventions visible in the history and to be matched: bilingual records (decision documents in
Russian, story files in English), evidence tables with measured values, explicit «не проверено»
marks rather than silence, and every hardcoded value carrying a comment naming what breaks without
it.

### Testing standards

There is no unit-testable surface here. "Testing" in this story means measurement on the instance:

- Every claim of reachability is an HTTP status code recorded from the container that will actually
  make the call — not from the host, not from the runner container, but from a job-equivalent
  container inside the dind.
- Every claim about a secret's presence is an API listing; every claim about a secret's *value* is
  either a successful use of it or the words «не проверено».
- The end-to-end proof is a real job on a throwaway branch, with its run id and job id recorded.
- Counts (tokens before/after) are recorded on both sides of the operation, not asserted.

### Project Structure Notes

| Path | Change |
|---|---|
| `docs/runners/config.yml`, `config-2.yml` | UPDATE — add the `openbao` mapping to `container.options` plus its LOAD-BEARING comment. Read both files fully first; they carry structural comments that must survive. |
| `docs/runners/README.md` | UPDATE — extend §«Как проверить дрейф» with a runner-to-runner comparison. |
| `docs/migration-decisions.md` | UPDATE — amend D15, add a changelog row. Records are not rewritten retroactively; append and cross-reference. |
| `docs/forgejo-migration.md` | UPDATE — §3 predates OpenBao entirely. |
| `.forgejo/workflows/` | Currently holds only an inert `README.md` (Story 1.13's D9 placeholder). Anything added here becomes executable on push — the throwaway-branch method exists for exactly this reason. |
| `_bmad-output/implementation-artifacts/deferred-work.md` | UPDATE — anything left open. |

Nothing in `src/`, `Dockerfile*`, or `docker-compose*.yml` changes in this story.

### References

- `_bmad-output/planning-artifacts/epics.md` — Story 1.12 (ACs), FR19 (no SSH secrets), Story 3.3
  (consumer of `secret/fe/<env>/app`).
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-13-openbao.md` — §4.1 the rewrite,
  §3 the deploy-runner finding, Addendum the provisioning record and "Still outstanding".
- `docs/migration-decisions.md#d15` — the pattern decision and the disagreement it overrode;
  `#d14` — registry naming; `#d9` — the legacy-fallback invariant; `#d6` — the superseded map.
- `docs/runners/README.md` — the two load-bearing hardcoded values and the drift check.
- `_bmad-output/implementation-artifacts/deferred-work.md` — the Slack webhook stub, the token-model
  question, `robot-registry`'s coupling of s1's pull with CI's push.
- `CRM/PRIONEX_HUB` `.github/workflows/{deploy-dev,deploy-preprod,promote-prod}.yml` on the instance
  — the reference implementation. Read-only; read via `git show` in the `forgejo` container.

---

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M context) — provisioning session 2026-08-13, out of the usual create/dev split
because Oleg asked for the work to be carried out directly.

### Debug Log References

All timestamps UTC. Host clock on s1 is UTC+2; `ls` shows local, `bao` and `date -u` show UTC.

| when | what | result |
|---|---|---|
| 10:56:47 | first mint + write of all seven | 7 × `PUT 201` (created, so none pre-existed) |
| ~10:58 | first isolation matrix | **invalid — see below**, discarded |
| 11:00 | controls over raw HTTP | no-auth 403, bogus 403, admin 200 |
| 11:01 | isolation matrix, second run | clean diagonal, 9/9 |
| 11:02:06 | destroy strays, re-mint, re-write | 7 destroyed, 3 × login 200 **before** storing, 6 × `PUT 204` |
| 11:05 | runner configs patched | both, identical `options`, diff verified |
| 11:08 | token cleanup | 97 → 96, back to baseline |

### Completion Notes List

**AC1 — done, one part deliberately left open.** Five `CRM` org secrets confirmed present, ids
21–25, all created 2026-08-10, names matching D14. Read from the Forgejo database, not the API:
secret *names* are stored in clear there and only values are encrypted, so this needed no token and
left nothing to revoke. `REGISTRY_TOKEN_RW`/`_RO` remain **«не проверено»** — unchanged, Story 1.10
exercised minted equivalents. `SLACK_CD_WEBHOOK_URL` is present by name and **still holds the
`example.invalid` stub**; unrecoverable, needs whoever created it on 2026-08-10. **AC1 is closed as
«не проверено» for that secret, not as done.**

**AC1-bis — done, and stronger than asked.** Zero secrets of an SSH shape exist anywhere on the
instance, not merely in `CRM`: `where name ilike '%SSH%'` returns 0 rows across all 53 secrets.

**AC2 — done.** Seven secrets at repository scope on `CRM/fe-prionex`, none at org scope (queried
explicitly). Before this story the repository held **no** secrets and **no** variables at all, so
any eighth name appearing there is a finding. `OPENBAO_ADDR` is `http://openbao:8200` — the
hostname the `--add-host` mapping creates, so a future IP change is one config edit rather than
seven secret rewrites. **`OPENBAO_PROD_SECRET_ID` issued 2026-08-13T11:02:06Z; `secret_id_ttl` is
25920000s = 7200h; it expires 2027-06-09 10:56 UTC and nothing rotates it.**

**AC3 — done.** All three paths exist as KV v2 and hold exactly `VITE_API_BASE_URL` and
`VITE_WS_URL`, unsuffixed. `dev` → `https://api.dev.crm-prionex.online` / `wss://…`; `prod` →
`https://api.crm-prionex.online` / `wss://api.crm-prionex.online`, matching the bundle production
serves; `pre-prod` → `PLACEHOLDER-preprod-backend-not-provisioned` on both keys. No extra key on
any path.

**AC4.4 isolation — 9/9, on the second attempt. The first attempt was an artifact and is worth
more than the result.** The first matrix reported every role reading every path — the opposite of
the 13.08 record. The cause was two of my own bugs compounding: `bao write -f -field=secret_id …
num_uses=1` combines `-f` (no data) with data and returns nothing, so `secret_id` was empty, login
failed, and `BAO_TOKEN` ended up empty — at which point **the host's `bao` silently authenticated
as `admin`**. All nine "successes" were the admin token reading its own instance.

🔴 **Root cause worth carrying forward: `/usr/local/bin/bao` on s1 is not the OpenBao client.** It
is a 530-byte `#!/bin/sh` wrapper, mode **755**, left behind by `PRIONEX_HUB`'s Story 3.2
("Удалить после провижининга" — it was not), which does
`exec docker exec -i -e BAO_ADDR=… -e BAO_TOKEN forgejo-openbao bao "$@"`. When `BAO_TOKEN` is
empty, docker passes nothing and the in-container client falls back to a token that carries
`admin`. **Consequence: any command run through the host `bao` without an explicit token appears to
succeed with full admin rights.** Verified against raw HTTP, which behaves correctly — no auth
header → 403, empty token → 403, admin token → 200. **Every OpenBao assertion in this and later
stories must go over HTTP with an explicit `X-Vault-Token`, never through the host wrapper.** The
second matrix did exactly that and produced the clean diagonal, with all three controls passing.

**AC2 hardened beyond the wording.** Because Forgejo secret values are write-only, "the value was
written" is not the same as "the value works", and a wrong `secret_id` fails identically to a
missing one but costs far more to diagnose. So the re-issue pass **logged in with each credential
before storing it** — three logins, three `200`s — and stored that exact value. What remains
unproven is only the transport into Forgejo, which the `204` confirms.

**Stray credentials found and destroyed.** After the first pass the roles carried 3, 2 and 2 live
`secret_id` accessors instead of 1 each — unused credentials minted by the broken attempt, each
granting read on its environment. All seven destroyed, then exactly one minted per role and
verified: `1` accessor each. **The instance-wide lesson this project keeps relearning applies to
OpenBao too, not only to Forgejo tokens: minting is easy, and nothing cleans up after you.**

**AC7 — closed. Superseded the "half done" state recorded earlier in this session.**
~~The config change is in place on both runners; the restart is not.~~ Oleg restarted both at
11:42:41Z, both re-declared with labels `[node-20 docker-build]` within 40 s, and run 486 then
proved the mapping from inside job containers on both. The paragraph below is kept because it
records what was true before the restart and what "not yet in effect" meant.
`--add-host openbao:172.20.0.5` was added to `container.options` in both
`/opt/forgejo-runner-fe-prionex/config.yml` and `config-2.yml`, with identical LOAD-BEARING
comments, verified by diff against backups (`config*.yml.bak-1-12`, still on the host). Both live
files now carry a byte-identical `options` line. **Neither runner has been restarted, so the change
is not yet in effect** — restarting containers is blocked for this agent and was handed to Oleg.
The in-job proof (a job container actually resolving `openbao`) belongs to Task 7.3 and has not
been performed; today's `200`s were measured with the flag passed manually, which proves the
network path, not the configuration.

`docs/runners/README.md` now carries a runner-to-runner drift check: `options` must be byte-identical
between the two, `cache.host` and `docker_host` must differ. The existing check compared each file
only against the host and could not see the class of divergence that nearly shipped on 13.08.

**Token accounting closed.** Baseline 96 at session start (up from the 93 recorded on 2026-08-12 —
three appeared in between, none ours). One Forgejo token `fe_1_12_secrets` (`write:repository`)
minted by Oleg, used, and revoked by deleting its `access_token` row: 97 → 96. Both token files and
all temporary scripts removed from `/root`. The OpenBao token was a 2h child of Oleg's admin session
and expires on its own; its `bao login` helper inside the container was removed before use, so no
admin token was left in the container filesystem.

**Task 3 — decided (Oleg, 2026-08-13): option (a).** `apk add --no-cache openbao=2.6.0-r0 jq`, then
the hub's step reproduced. The measurements that decided it are in §2; the reasoning and the
rejected options are in `docs/migration-decisions.md#d15`. The first recommendation written here
was (b) and rested on the assumption that installing `bao` meant a manual multi-megabyte download;
Alpine packaging it changed the arithmetic, and option (b) turned out not to remove the mirror
dependency at all — `jq` is still required for structural extraction.

**Task 7 — done. Run 486, four jobs, all green, 2026-08-13 12:17Z.** Every one of the four
«не проверено» items became evidence:

1. **`--add-host` reaches the job container from the runner config**, not from a hand-passed flag.
   The job printed its own `/etc/hosts`: `172.20.0.5 openbao` alongside
   `10.67.0.1 git.crm-prionex.com`. Nobody passed a flag; the runner injected both.
2. **Alpine's 2.6.0 client talks to the 2.6.1 server**: `server: 2.6.1  client: OpenBao v2.6.0
   (cgo)`, with login and `kv get` both succeeding. The one-patch skew is no longer an assumption.
3. **The credentials stored in Forgejo authenticate after storage**, not merely before it —
   `login: ok`, `keys exported: 2`. This was the only remaining gap in AC2: Forgejo secret values
   cannot be read back, so a real job was the only instrument that could close it.
4. **`::add-mask::` redacts what the step exports.** Both values were printed deliberately and both
   came out `***`, while their lengths (34 and 32) match `https://api.dev.crm-prionex.online` and
   `wss://api.dev.crm-prionex.online`. `$GITHUB_ENV` contained no `VITE` key: 0.

**AC7 across both runners — how strong the evidence actually is, stated precisely.** Attribution
comes from each runner's own container log, the method Story 1.9 used: `s1-fe-prionex-1` (id 19)
took tasks 4697 and 4698, `s1-fe-prionex-2` (id 20) took 4699 and 4700 — two and two, which four
concurrent jobs against capacity 2 make unavoidable. All four succeeded and all four carry
`log_length = 31`, i.e. every one ran the script to its last line. **The `/etc/hosts` check fails
closed** — a missing `openbao` line exits 1 before anything else happens — so all four containers
had the mapping. **Direct log evidence exists for runner 20 only:** three of the four task logs
still have `log_in_storage = f` and are retrievable only through the web UI. Runner 19 is therefore
proved by fail-closed plus attribution, not by reading its bytes. That is sound, and it is not the
same thing as having read them.

**AC6 — closed.** The dependency was named before any work started and its owner is recorded: the
OpenBao policies, roles and KV paths were provisioned by Oleg on 2026-08-13 (D15), no credential
value survived that session, and the token needed to read `role_id` / mint `secret_id` was supplied
by him in-session because this repository cannot mint one. Nothing proceeded on a placeholder: the
only placeholder in the system is PRE-PROD's KV value, which is labelled as one and exists because
that backend does not.

**Still outstanding:** AC1's `SLACK_CD_WEBHOOK_URL` value, which no amount of work here can supply.
(`forgejo-migration.md` §3 was rewritten in Task 8.2 — this line previously said it was outstanding
and was stale; caught in review.)

### File List

- `docs/runners/config.yml` — `--add-host openbao:…` + LOAD-BEARING comment (mirrors host)
- `docs/runners/config-2.yml` — same, byte-identical `options` line
- `docs/runners/README.md` — new runner-to-runner drift check
- `_bmad-output/implementation-artifacts/1-12-…md` — this record
- On s1, not in the repository: `/opt/forgejo-runner-fe-prionex/config.yml`, `config-2.yml`
  (patched, backups `*.bak-1-12` retained until the restart is verified)

---

## Open Questions for Review

### Blocking

1. **The OpenBao token.** Tasks 4 and 5 cannot start without it and this repository cannot mint one.
2. **`SLACK_CD_WEBHOOK_URL`'s real value.** Unrecoverable from the instance; needs whoever created
   it on 2026-08-10. Without it AC1 closes as «не проверено», not as done.

### Non-blocking

3. **The read mechanism (Task 3)** is a decision this story makes for Epics 3–6. If Oleg wants it
   made differently, it is cheaper to say so before Task 7 than after four stories inherit it.
4. **`fe-prod`'s `secret_id` expires 2027-06-09 10:56 UTC** and nothing rotates it. Owner unnamed.
5. **The hub's own prod `secret_id` expires every 720h** with nothing visible rotating it. Not our
   system; worth telling that team.
6. **`robot-registry` couples s1's pull credential with CI's push credential** — a rotation or
   compromise hits both. `deferred-work.md` asks that the token model be settled alongside this
   story; it is not settled by these ACs.

---

## Appendix — the proven read step, verbatim

**Why this is here.** The step below was proved by run 486 on the throwaway branch
`probe/openbao-1-12`, and that branch was then deleted. Deleting it left the only working copy in an
unreachable commit, one `git gc` away from gone — while Epics 3, 4, 5 and 6 are all supposed to
inherit this exact code. Story 1.8 set the precedent of attaching its probe workflow to its story
file for the same reason; this story initially failed to follow it, and the omission was caught in
review.

**This is a record, not a deployment mechanism.** Nothing applies it. When Story 3.3 writes the real
build workflow it copies from here, keeps the comments (each names what it prevents), and re-proves
the result rather than trusting this text.

**Two things to change when it is reused.** The `OPENBAO_DEV_*` secret names are hardcoded here
because the probe only read `dev` — a real workflow selects the pair matching its target
environment, and must not build the KV path by string-concatenating the secret name (`PREPROD` ->
`preprod`, which does not exist; the path segment is `pre-prod`). And the two `echo` lines that print
the values exist only to prove masking works; they have no place in a real build.

```yaml
# THROWAWAY — Story 1.12, Task 7.3. This branch and this file are deleted once the
# run is recorded. It exists to prove four things that were all «не проверено»:
#   1. `--add-host openbao:172.20.0.5` reaches a job container FROM THE RUNNER CONFIG,
#      not from a flag passed by hand (2026-08-13's 200s were measured with the flag).
#   2. The OpenBao client Alpine packages (2.6.0) talks to the server (2.6.1).
#   3. The role_id/secret_id stored in Forgejo repository secrets actually authenticate
#      — they were proved before storage, never after.
#   4. `::add-mask::` really redacts what this step exports, including a multi-line
#      value and one containing a literal `%25`.
#
name: openbao-probe-1-12

# TRIGGER, AND THE DEVIATION IT REPRESENTS. Stories 1.8 and 1.9 used
# `workflow_dispatch` only, so a probe branch could never fire anything by merely
# existing. That required an API token to dispatch, and this story's token was
# revoked at the end of Task 5 by design — minting a second one to press a button
# is worse debt than the deviation.
#
# So: `push`, pinned to THIS branch by name. It cannot fire on `main`, `staging` or
# `development`, and it dies with the branch. The D9 invariant is about
# `.github/workflows/` executing on protected branches; nothing here touches that,
# and Task 7.3 re-confirms the invariant on all three after the branch is deleted.
on:
  push:
    branches:
      - probe/openbao-1-12
  workflow_dispatch:
    inputs:
      environment:
        description: "dev | pre-prod | prod — which KV path to read"
        required: true
        default: "dev"

jobs:
  probe:
    # FOUR jobs, not one. AC7 requires the proof on BOTH runners, and a single job
    # lands on whichever is free — proving one runner and telling you nothing about
    # the other. Each runner has capacity 2, so four concurrent jobs cannot fit on
    # one. Attribution is by reading each runner's container log for the job id, the
    # method Story 1.9 used for its distribution evidence.
    strategy:
      fail-fast: false
      matrix:
        n: [1, 2, 3, 4]
    runs-on: docker-build
    steps:
      # Separate step ON PURPOSE: it handles no secret, and `shell: bash` in the next
      # step needs bash to already exist. Nothing here may ever touch a credential.
      - name: Install the client (Task 3 decision — option (a), pinned)
        run: |
          set -eu
          echo "probe slot ${{ matrix.n }} — container $(hostname)"
          apk add --no-cache openbao=2.6.0-r0 jq bash >/dev/null
          echo "bao:  $(bao version | head -1)"
          echo "jq:   $(jq --version)"
          echo "bash: $(bash --version | head -1)"

      - name: OpenBao login -> KV read -> assert (one process env, nothing to disk)
        shell: bash
        env:
          OPENBAO_ADDR: ${{ secrets.OPENBAO_ADDR }}
          OPENBAO_DEV_ROLE_ID: ${{ secrets.OPENBAO_DEV_ROLE_ID }}
          OPENBAO_DEV_SECRET_ID: ${{ secrets.OPENBAO_DEV_SECRET_ID }}
          # Through env, never interpolated into the script body: a `${{ }}` expansion
          # inside `run:` is a shell-injection vector, and `github.event.inputs` is the
          # form this instance's act is known to accept.
          KV_ENV: ${{ github.event.inputs.environment }}
        run: |
          set -euo pipefail
          umask 077

          # ---- Preflight. Two different failures, two different messages. -------
          # Collapsing them into one timeout is what cost PRIONEX_HUB a break-glass
          # window on s2 (promote-prod.yml:168-186): `bao` was simply not installed,
          # and the run died on `command not found` after the file had landed.
          for _bin in bao jq; do
            command -v "$_bin" >/dev/null 2>&1 || {
              echo "::error::'$_bin' missing on this runner — the install step above did not do its job." >&2
              exit 1; }
          done

          # Proof that `--add-host` came from the RUNNER CONFIG: the runner injects it
          # into this container's /etc/hosts. If this line is absent, config.yml /
          # config-2.yml on s1 lost the mapping (or only one of the two carries it).
          echo "--- /etc/hosts entries injected by container.options ---"
          grep -E 'openbao|git\.crm-prionex\.com' /etc/hosts || {
            echo "::error::no openbao mapping in /etc/hosts — the runner config is not carrying --add-host." >&2
            exit 1; }

          export BAO_ADDR="$OPENBAO_ADDR"
          bao status >/dev/null 2>&1 || {
            echo "::error::OpenBao unreachable at $BAO_ADDR. The hostname resolves via a HARDCODED container IP in the runner's container.options. If forgejo-openbao was recreated its IP changed and both config.yml and config-2.yml on s1 need the new one." >&2
            exit 1; }
          echo "server: $(bao status -format=json | jq -r '.version')  client: $(bao version | head -1)"

          # ---- AppRole login. Credentials never enter any argv. ------------------
          # `jq -n --arg` would MOVE the exposure, not close it: --arg values are jq's
          # own CLI arguments. The `env` builtin reads from /proc/<pid>/environ (0400),
          # and `bao write PATH -` takes the body on stdin. PRIONEX_HUB caught the
          # --arg regression with a kernel-level execve capture, not by reading it.
          BAO_TOKEN=$(jq -n '{role_id: env.OPENBAO_DEV_ROLE_ID, secret_id: env.OPENBAO_DEV_SECRET_ID}' \
            | bao write -format=json auth/approle/login - \
            | jq -r '.auth.client_token')
          echo "::add-mask::$BAO_TOKEN"
          export BAO_TOKEN
          echo "login: ok (token masked)"

          # ---- Masking helper --------------------------------------------------
          # Workflow-command VALUES are percent-decoded by the runner, so a value
          # containing a literal "%25" would register "%" as the secret and never
          # match what is actually printed. Escape only the text handed to
          # ::add-mask::, never the exported value.
          # DEVIATION FROM THE HUB, RECORDED: this uses bash parameter expansion,
          # which busybox ash does not implement — hence `bash` in the install step
          # and `shell: bash` here. The hub runs on Debian deploy hosts and never
          # had to say so.
          _escape_for_mask() {
            local s=$1
            s=${s//%/%25}
            s=${s//$'\r'/%0D}
            s=${s//$'\n'/%0A}
            printf '%s' "$s"
          }

          KV_PATH="fe/${KV_ENV:-dev}/app"
          echo "reading: secret/$KV_PATH"
          KV_JSON=$(bao kv get -format=json -mount=secret "$KV_PATH")

          # Revoke immediately after the LAST read: everything below only touches the
          # already-fetched $KV_JSON, so the token must not be inherited by anything
          # that follows (in a real build: every docker build/push).
          bao token revoke -self >/dev/null
          unset BAO_TOKEN

          count=0
          while IFS= read -r k; do
            # An identifier regex alone does NOT close this: `PATH` and `LD_PRELOAD`
            # match it perfectly. The hub shipped that mistake and its own review
            # caught the false claim. Denylist is what closes it.
            printf '%s\n' "$k" | grep -Eq '^[A-Za-z_][A-Za-z0-9_]*$' \
              || { echo "::error::refusing to export unsafe OpenBao key name: $k" >&2; exit 1; }
            case "$k" in
              PATH|LD_PRELOAD|LD_LIBRARY_PATH|IFS|BASH_ENV|ENV|SHELLOPTS|BASHOPTS|HOME|TMPDIR|DOCKER_CONFIG|DOCKER_HOST|BAO_*|VAULT_*|GITHUB_*)
                echo "::error::refusing to export reserved OpenBao key name: $k" >&2; exit 1;;
            esac
            # Structural extraction by key. NEVER re-parse a concatenated "k=v" text
            # stream: a value containing a newline re-splits into a new record, and a
            # crafted value used exactly that to hijack PATH to /tmp/pwned on the hub.
            v=$(jq -r --arg k "$k" '.data.data[$k]' <<<"$KV_JSON")
            # Register a mask for EVERY line: ::add-mask:: is parsed one physical log
            # line at a time, so a multi-line value would leak every line but the first.
            while IFS= read -r _line || [ -n "$_line" ]; do
              [ -n "$_line" ] && echo "::add-mask::$(_escape_for_mask "$_line")"
            done <<<"$v"
            export "$k=$v"
            count=$((count+1))
          done < <(jq -r '.data.data | keys[]' <<<"$KV_JSON")
          unset KV_JSON

          # ---- Assertions that can actually fail --------------------------------
          echo "--- assertions ---"
          [ "$count" -eq 2 ] || { echo "::error::expected 2 keys, got $count" >&2; exit 1; }
          echo "keys exported: $count"
          [ -n "${VITE_API_BASE_URL:-}" ] || { echo "::error::VITE_API_BASE_URL empty" >&2; exit 1; }
          [ -n "${VITE_WS_URL:-}" ]       || { echo "::error::VITE_WS_URL empty" >&2; exit 1; }
          echo "VITE_API_BASE_URL length: ${#VITE_API_BASE_URL}"
          echo "VITE_WS_URL length:       ${#VITE_WS_URL}"
          # Printed deliberately: if masking works these come out as ***, and if it
          # does not, we learn that here rather than in a production deploy log.
          echo "VITE_API_BASE_URL value (expect ***): $VITE_API_BASE_URL"
          echo "VITE_WS_URL value (expect ***):       $VITE_WS_URL"
          echo "no secret written to \$GITHUB_ENV: $(grep -c VITE "$GITHUB_ENV" 2>/dev/null || echo 0)"
```
