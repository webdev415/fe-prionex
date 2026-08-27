# Story 6.7: Smoke-Check Production After Deploy

Status: review

Epic: 6 — Production Release and Verified Rollback
Story key: `6-7-smoke-check-production-after-deploy`
Contexted: 2026-08-27 off `origin/main` @ **`043ce521`** — 🔴 re-based mid-write: PR #104 (Story 6.5's guard) merged while this file was being written, so the graph below is the one that is actually on `main`, not the one the first draft described
Requirements: epic ACs 1–4

## Story

As a release engineer,
I want production verified immediately after a deploy,
so that a broken release is caught by the pipeline rather than by users.

---

## 🚨 Read this before anything else

### 1. 🔴 THE FIRST THING TO SETTLE: AC1 IS ALREADY DONE, AND REBUILDING IT IS THE MAIN TRAP

Epic AC1 asks for *"the container reports healthy via `docker inspect` against the parameterized
container name."* **`deploy-stand.yml` already does exactly that**, and more:

- polls `docker inspect` for `running=true`, `restarting=false`, `health=healthy`, with a timeout
  (`health_timeout_seconds: 120` on PROD), and **fails on `unhealthy` immediately** rather than
  waiting out the clock;
- **asserts the healthy container is this project's**, anchored — not merely a container of that name;
- issues `GET http://0.0.0.0:8080/` from a `--network host` sibling container and **asserts `200`**,
  distinguishing a transport failure (`000`) from a real non-200.

Story 6.4's own header already ruled on this: *"6.7 the smoke check (**the callee's health and Kong
probes are NOT it**)"*.

➡️ **So this story is not "check the container is healthy". That is done, inside the deploy, while
the Story 4.4 lock is still held.** This story is the check that runs **after** the deploy job, from
outside that transaction, and it earns its place only by asserting things the callee does not:
**that the application's own built assets are actually being served**, and **that it is not logging
errors**. 🚫 **Do not re-implement the health poll. A weaker duplicate of a stronger existing check is
the anti-pattern this epic has already prohibited twice** (epic 6.5 AC2, and 6.4's header).

### 2. 🔴 `GET /` RETURNING 200 PROVES ALMOST NOTHING — and that is what makes AC2 real

nginx will happily return `200` for `/` while serving a **stale index**, a **default page**, or an
index whose referenced bundle 404s. The callee's probe is a liveness check, not a content check.

➡️ **The non-vacuous smoke check for this SPA is: fetch `/`, extract the hashed asset path the HTML
actually references, then fetch THAT and assert it is served.** The filename carries a content hash
(`/assets/index-D8ZYo8qY.js` was the live example on s2), so it changes with every build. **A check
that can only pass if the deployed bundle is the one this index names is a check that can fail** —
which is what Prohibition 5 demands and what `GET /` alone cannot give.

Suggested shape, and the story does not mandate the exact paths — it mandates that each is asserted:

| Probe | Assert | Why it can fail |
|---|---|---|
| `GET /` | `200`, and the body contains a `<script ... src="/assets/…">` | a default nginx page or an empty index has no such tag |
| `GET <that exact asset>` | `200`, `Content-Type` is JavaScript, body length non-trivial | the index can reference a bundle the image does not contain |
| `GET /` a deep SPA route (e.g. `/login`) | the SPA fallback status the image's `nginx.conf` actually implements | a broken `try_files` returns 404 where the app needs 200 |

🔴 **Read `nginx.conf` in this repository before choosing the third row** — assert what it is
configured to do, not what you assume an SPA does. Getting this backwards produces a check that fails
on a correct deploy, which is worse than no check.

### 3. 🔴 SLACK CANNOT BE DONE, AND AC4 MUST SAY SO RATHER THAN QUIETLY DROP IT

Epic AC4 requires *"Slack reports the failure with the run link."* **That channel does not exist.**
`deferred-work.md`: the webhook is Story 1.13's unrecoverable stub — write-only, the URL is
**unrecoverable** — and *"a **new incoming webhook must be created in Slack** before any of its ACs
can pass. **Owner: Oleg.**"* Story 4.5 is `backlog` and was resequenced **last** by Oleg.

Precedent, and it is exact: Story 6.4 carried the same clause and it was **deferred 2026-08-14** with
the words *"the production deploy must work, and must be provable, **without any notification**."*

➡️ **Build the other three clauses of AC4 in full — the run is marked failed, and the operator is
pointed at the `rollback: true` path — and record the Slack clause as BLOCKED with its named owner.**
🚫 Do not invent a substitute channel. 🚫 Do not mark AC4 met.

### 4. Where it runs, and why that is not a free choice

`docker inspect` and `docker logs` need the **host** daemon. That means a job on
`runs-on: fe-prionex-prod-deploy` — our own runner on s10, declared
`fe-prionex-prod-deploy:docker://deploy-base-dev-preprod:2026-08-07`, whose jobs run **in a container
holding the host's `docker.sock`**.

🔴 **Never `s10` or `e1-rung3`** — those are the CI-shaped runner whose jobs execute in dind and can
never reach the host's stand. 🔴 **Never `e1-rung3-prod-deploy`** — that is the neighbouring team's
runner, declared `:host`, and `deploy-stand.yml` fails on it (run 629: `docker inspect $(hostname)`
→ `no such object`). Story 6.4 lost a run to each of these.

**The stand's measured parameters** (from `deploy-prod.yml`'s own `with:`, do not re-derive):

| | |
|---|---|
| container | `fe-prionex-prod` |
| published | `0.0.0.0:8080` |
| network | `crm-prod-network` |
| stand dir | `/root/crm-prionex/fe-prionex-prod` |

🔴 **Curl the stand directly at `0.0.0.0:8080`, NOT the public name.**
`crm.prod.crm-prionex.online` **resolves and refuses the connection** (`#d43`, measured 2026-08-26 —
the A record exists, ports 80/443 answer `refused`, there is no web front on the hypervisor yet). A
smoke check pointed at it fails on a healthy stand. And `deploy-stand.yml` already demonstrated that
a **`--network host` sibling container** is how you reach the host-published mapping from inside a
containerised job — runs 925/927 failed on exactly this before that fix.

### 5. 🔴 THE LOG SCAN IS THE CLAUSE MOST LIKELY TO SHIP BROKEN

Epic AC3: *"inspects the last 5 minutes of container logs for ERROR entries **and their presence
fails the check**."*

Two ways this goes wrong, and both are common:

1. **False positives.** `docker logs --since 5m` on an nginx container returns access-log lines. A
   grep for `ERROR` that matches a URL containing the string, or a client-side error echoed into an
   access log, **fails a correct deploy**. A smoke check that cries wolf gets disabled by the third
   incident.
2. **False silence.** A container that has just started may have logged nothing at all in five
   minutes. **An empty log is not a passing log** — and it is not a failing one either. Say which,
   deliberately.

➡️ **Read what this container actually logs before writing the matcher.** The image is
`Dockerfile.prod` + `nginx.conf` in this repository; look at the log format and decide the pattern
against reality. Anchor it (`^` / a level field), do not grep a bare substring. **Record what an empty
window means.**

### 6. Where the job goes in `deploy-prod.yml`

**Graph on `main` as of `043ce521`, verified from the parsed file:**

```
derive → guard → build → deploy → record → record-outcome
```

🔴 **This changed while this story was being contexted.** The first draft was written against
`0d990967`, where `guard` did not exist and PR #104 was open; #104 merged mid-write and the file was
re-based onto `043ce521` before finalising. **The graph above is measured, not assumed** — and the
episode is itself the lesson: `origin/main` on this project moves during a contexting session, and
Story 6.6 was written against a repository that had changed under it three times.

The smoke check runs **after `deploy` succeeded**. Two placements are defensible and the story does
not force one:

- **after `deploy`, in parallel with `record`** — fastest signal, but a failed smoke check does not
  prevent the record;
- **after `record`** — the registry then only records images that also passed a smoke check.

➡️ **Recommendation: after `deploy`, parallel to `record`.** The record is a *statement of what was
deployed*, and a bad deploy that happened is still a fact worth recording — `record-outcome` already
exists to disclose the inverse case. **Decide explicitly and write the reason in the header.**

🔴 **Whichever you choose, `needs:` and `if:` must be right, and Story 6.5 just paid for this
lesson.** Its guard would have been decorative because `deploy`'s condition admits a *skipped* build
by design. **Trace every combination** — release, rollback, guard-refused, build-failed,
deploy-failed — and confirm the smoke check runs when and only when it should. And `record-outcome`'s
`if:` may need the smoke job added; check it.

### 7. Previous story intelligence — what Epic 6 has already paid for

- 🔴 **A skipped `uses:` wrapper reports `success`** (`#d21` run 631; seen live in 6.6's run 662).
  If the smoke check is a `uses:` job, a skip reads as a pass. **Prefer a plain job.**
- 🔴 **Dependents of a FAILED job report `failure`, not `skipped`** — measured by Story 6.5 on run 687
  and **in no document before that**. Do not judge an outcome by the word `skipped`.
- 🔴 **The structural discriminator that actually proves a job ran**: the presence or absence of a
  callee's **inner** job rows. Story 6.5's run 687 had six rows and zero inner; run 668 had twelve
  with seven inner. Status words did not settle it; row presence did.
- 🔴 **The task-list and packages endpoints paginate and cap `limit` at 50.** Story 6.6 was bitten
  **five times**, three of which changed a conclusion. Walk to natural termination.
- 🔴 **Batch-ticking checkboxes is how an AC gets graded on work that was not done.** Story 6.5 caught
  itself doing exactly that on AC4; Story 6.6 needed a different model to catch it twice.
- **A fix-pass that is not re-reviewed is just a second draft** — three occurrences in this epic.
- 🔴 **Job logs are NOT retrievable on this instance.** Evidence must be structural (job rows, registry
  reads, host state), never "the log said so".

### 8. 🔴 Blast radius and frozen files

**Written:** `.forgejo/workflows/deploy-prod.yml` (**UPDATE** — one new job plus header);
`docs/migration-decisions.md` (a decision record); `deferred-work.md`; `sprint-status.yaml`; this file.

**🔴 FROZEN:**
- **`deploy-stand.yml`** — it already owns the health and Kong probes. If it looks like it needs a
  change, that is a finding, not a commit.
- **`deploy-prod.yml`'s `derive` job** — Story 6.5 rebased onto it; leave it byte-identical.
- `build.yml`, `record-prod-image.yml`, `record-preprod-candidate.yml`, `deploy-preprod.yml`,
  `deploy-dev.yml`, `dev-reset.yml`, `ci.yml`, `build-main.yml`, `build-buildkit-cni-image.yml`,
  `verify-cni-netns-isolation.yml`
- **`nginx.conf`, `Dockerfile.prod`, `src/`** — 🔴 **read them, change nothing.** If the smoke check
  wants a route the image does not serve, the check is wrong, not the image.
- `docs/prod-releases.md`, `docs/preprod-candidates.md`, the regulations, all of `.github/workflows/`

**Hosts:** s10 is **read** by the smoke job (`docker inspect`, `docker logs`, an HTTP GET). **Nothing
is written, restarted, or reconfigured.** s2 is not touched — NFR5.

### 9. Boundaries

1. **Rollback with measured timing.** Story 6.8 — ⚠️ Oleg cancelled it; the cancellation had not
   landed as of 2026-08-27. **Check, do not assume.**
2. **The cutover and the traffic switch.** Story 6.9.
3. **Slack.** Story 4.5 — and it is BLOCKED on a human act (§3).
4. **The eleven open mediums from Story 6.6's review**, and the guard itself (6.5, PR #104).

### Prohibitions

🚨 **A prohibition here cannot be overridden by a subtask.**

1. **Never re-implement the container health poll** — `deploy-stand.yml` owns it (§1).
2. **Never assert only `GET /` == 200** and call it a smoke check (§2).
3. **Never point the check at `crm.prod.crm-prionex.online`** — it resolves and refuses (`#d43`).
4. **Never use `s10`, `e1-rung3`, or `e1-rung3-prod-deploy` as the runner label** (§4).
5. **Never mark AC4 met** while the Slack clause is blocked; record it with its owner (§3).
6. **Never grep a bare `ERROR` substring** without reading what the container actually logs (§5).
7. **Never let a skipped job read as a pass** — prefer a plain job over `uses:` (§7).
8. **Never write to, restart, or reconfigure the stand.** This story reads.
9. **Every input reaches a `run:` body through `env:`, never a `${{ }}` expression** (`#d21`).
10. **Never claim a branch was observed without a run id.** Label UNEARNED instead.
11. **Never judge an outcome by the word `skipped`** (§7).
12. **Do not touch s2, do not read GitHub** (NFR5, `#d7`).

---

## Acceptance Criteria

### AC1 — Container health, asserted independently and *after* the deploy *(epic AC1, amended)*

**Given** a completed production deploy
**When** the smoke check runs
**Then** it verifies the container reports healthy via `docker inspect` against the parameterized
container name
**And** ⚠️ **AMENDED 2026-08-27, and the amendment is the point:** `deploy-stand.yml` **already does
this inside the deploy**, while the Story 4.4 lock is held. This story's value is that it re-asserts
it **after the deploy job has ended and the lock is released** — a container that was healthy at
hand-off and has since crash-looped is exactly what the callee's check cannot see.
**And** it does **not** re-implement the callee's poll, its anchoring, or its Kong guard (§1).

### AC2 — The application is actually serving its own build *(epic AC2)*

**Given** the application must actually serve
**When** the smoke check runs
**Then** it issues `curl` requests against the critical paths **from a `--network host` sibling
container**, against `0.0.0.0:8080` — never the public name
**And** **each expected status code is asserted, not logged**
**And** 🔴 **at least one probe is content-level, not liveness-level**: the asset the served
`index.html` actually references is fetched and asserted (§2). `GET /` == 200 alone does not satisfy
this AC — it cannot fail for the reasons this check exists to catch.

### AC3 — Errors in the log window fail the check *(epic AC3)*

**Given** errors may appear only after traffic arrives
**When** the smoke check runs
**Then** it inspects the last 5 minutes of container logs and **fails on error entries**
**And** the matcher is written **after reading what this container actually logs** — anchored, not a
bare substring (§5)
**And** 🔴 **what an EMPTY window means is decided and stated** — a just-started container may have
logged nothing, and silence is not evidence either way.

### AC4 — 🔶 Failure is loud, and the Slack clause is BLOCKED *(epic AC4, partially deliverable)*

**Given** the smoke check fails
**When** the workflow completes
**Then** the run is marked **failed**
**And** the operator is pointed at the `rollback: true` dispatch path from Story 6.4, **with the exact
tag to use** — not a generic instruction
**And** 🔴 **the Slack clause is NOT deliverable and is recorded BLOCKED, not dropped**: the channel
does not exist, the webhook is unrecoverable, and a new one must be created **by Oleg** before any of
Story 4.5's ACs can pass. **Same deferral Story 6.4 took on 2026-08-14.** ⚠️ **This AC cannot be
graded MET while that clause is open.**

### AC5 — 🔴 ADDED: the job graph is traced, not assumed

**Given** Story 6.5's guard had to change `deploy`'s condition or it would have been decorative
**When** the smoke job is wired
**Then** every combination is traced and recorded — release / rollback / guard-refused / build-failed
/ deploy-failed — showing when the smoke check runs and when it does not
**And** `record-outcome`'s own `if:` is re-checked against the new job
**And** the placement (parallel to `record`, or after it) is **decided with its reason in the header**.

### AC6 — 🔴 ADDED: the matrix ships with real run ids

**Given** retro-E5
**When** this story closes
**Then** a passing row is earned live against the real stand
**And** at least one **discriminating** row is earned or **labelled UNEARNED with its reason** —
🔴 note that failing a smoke check honestly means making production briefly serve something wrong,
which this story does **not** authorise. **Open Question 1.**

### AC7 — 🔴 ADDED: the decision record

**Then** `docs/migration-decisions.md` carries a record covering the AC1 overlap and why the check is
not a duplicate, the content-level probe, the log matcher and its empty-window rule, the placement,
and the blocked Slack clause
**And** the number is re-verified across `origin/*`, **local branches and the working tree**.
Next apparently free on `043ce521` is **D50** (`D49` is Story 6.5's, now merged).

---

## Tasks / Subtasks

### Task 1 — Open (AC: —) — **1 push row**
- [x] 1.1 Re-fetch. ✅ PR #104 **has** landed (`043ce521`); `guard` is on `main` and §6's graph is
      measured. **Re-fetch anyway** — this file was itself re-based mid-write because `main` moved.
- [x] 1.2 `sprint-status.yaml` → `in-progress`, **own commit**.
- [x] 1.3 D-sweep: `origin/*`, local branches, **and the working tree**.
- [x] 1.4 Check whether Story 6.8's cancellation landed. **Do not edit another story's row.**

### Task 2 — Read before writing (AC: 1, 2, 3) — **0 runs**
- [x] 2.1 `deploy-stand.yml`'s health poll, anchoring assert, `GET /` probe and Kong guard — **so you
      can state precisely what you are NOT duplicating.**
- [x] 2.2 `nginx.conf` and `Dockerfile.prod`: the served root, the SPA fallback, and **the log format**.
- [x] 2.3 `deploy-prod.yml` end to end, including `deploy`'s `always()` paragraph and
      `record-outcome`'s `if:`.
- [x] 2.4 Fetch the live `index.html` from the stand and **paste the asset path it references** — that
      is the shape AC2's content probe must extract.

### Task 3 — Write the smoke job (AC: 1, 2, 3, 4, 5) — **0 runs**
- [x] 3.1 Plain job, `runs-on: fe-prionex-prod-deploy`, `needs:` per §6, placement decided and argued.
- [x] 3.2 Health re-assert (short, not a re-implementation of the poll).
- [x] 3.3 The `curl` probes via a `--network host` sibling container; **every status asserted**;
      the content-level asset probe.
- [x] 3.4 The log window, with an anchored matcher and the empty-window rule stated.
- [x] 3.5 On failure: the exact `rollback: true` dispatch line, with the tag filled in.
- [x] 3.6 Header: the AC1 overlap, the placement reason, the blocked Slack clause.
- [x] 3.7 Mechanical: YAML parses; `bash -n` on every `run:`; **zero `${{ }}` inside any `run:`**;
      `derive` and all frozen files byte-identical.

### Task 4 — Earn the matrix (AC: 6) — **1–2 dispatches**
- [x] 4.1 A `rollback: true` dispatch of the running image: deploy succeeds, **smoke check passes**.
      Paste the run id and the job rows, read **paginated**.
- [x] 4.2 The discriminating row per Open Question 1 — earned, or labelled UNEARNED with its reason.
- [x] 4.3 Confirm the stand is **unchanged** and still serving: this story reads.

### Task 5 — Record (AC: 4, 7) — **0 runs**
- [x] 5.1 The decision record (AC7).
- [x] 5.2 `deferred-work.md`: the **blocked Slack clause**, owner **Oleg**, with its removal trigger.

### Task 6 — Close (AC: all) — **1 push + PR + merge rows**
- [x] 6.1 Grade each AC **clause by clause against pasted evidence**, not from memory. 🔴 AC4 cannot
      be MET. **Do not batch-tick** — Story 6.5 nearly graded an AC on runs that predated its own code.
- [x] 6.2 Re-review the fix-pass.
- [x] 6.3 Ledger **by query**, attributed by `commit_sha`, read to natural termination.
- [x] 6.4 `sprint-status.yaml` → `review`. **Oleg merges.**

---

## Run budget model

| Line | Floor | Ceiling |
|---|---|---|
| Context push | 1 | 1 |
| dev-story pushes | 2 | 4 |
| PR rows | 2 | 2 |
| Merge row | 1 | 1 |
| Task 4.1 — the passing dispatch | 1 | 2 |
| Task 4.2 — the discriminating row | 0 | 2 |
| Review fix-pass | 0 | 2 |
| Closeout PR | 0 | 3 |
| **Total** | **7** | **17** |

⚠️ Story 6.5 declared floor 8 and measured **6** — under the floor, which is the same family of model
defect as an overrun. This floor is lower for the same reason: the dispatches are cheap and few.

---

## AC grading — against pasted evidence, not intention

| AC | Verdict | Evidence |
|---|---|---|
| **AC1** health, re-asserted after the deploy | ✅ **MET** | A single read of `docker inspect` **after** the deploy job ended and the Story 4.4 lock was released — no poll, no timeout, no retry, because the callee already did that while holding the lock. The only new information it can carry is **decay after hand-off**. Green on 705. |
| **AC2** the app serves its own build | ✅ **MET** | Three probes via a `--network host` sibling: `GET /` is 200 **and carries a header stock nginx does not set**; the asset the **served index actually names** is fetched and 200; and a non-existent `.js` **must 404**. 🔴 That last one is what keeps the second non-vacuous — `try_files` returns 200 for any path, so without it any asset name would have passed. |
| **AC3** errors in the window fail the check | ✅ **MET** | Matcher anchored on nginx's own bracketed level field, not the word `ERROR`. **Its failure branch is earned live on run 702** — it caught a real `[error]` line in the real container log. ⚠️ Honestly: the line was one the check itself provoked. The assertion and the red run are real; the trigger was self-inflicted, and is now excluded by filename. |
| **AC4** failure is loud | 🔶 **PARTIAL — and it cannot be more** | Run is marked failed ✅; the operator is pointed at `rollback: true` **with the ledger as the source of the tag** ✅; the failure summary states that **no Slack notification was sent and none was attempted**, and why ✅. 🔴 **The Slack clause is BLOCKED**: the channel does not exist, the webhook is Story 1.13's unrecoverable stub, a new one must be created in Slack — **owner Oleg**, Story 4.5, resequenced last. Same deferral Story 6.4 took. **Not graded MET.** |
| **AC5** the job graph is traced | ✅ **MET** | `needs: [derive, deploy]`, `if: needs.deploy.result == 'success'`, plain job — not `uses:`, because a skipped wrapper reports success (`#d21`). Observed on 705: guard `skipped` on the rollback path and smoke still ran, so the added job does not disturb the rollback route. `record-outcome` re-checked: it keys on `deploy` and `record` and is unaffected. Placement (parallel to `record`) decided with its reason in the header. |
| **AC6** matrix with real run ids | ✅ **MET, and the discriminating rows were earned the hard way** | Pass: **705**. Failure branches, all on the real stand: header assertion **698/699**, log matcher **702**. ⚠️ **What is NOT earned: a failure caused by production genuinely serving wrong content.** Open Question 1 proposed spending a run to force one; events overtook it — three real red runs arrived unbidden. **Labelled, not claimed.** |
| **AC7** the decision record | ✅ **MET** | **D50**, swept across `origin/*`, local branches and the working tree. |

**6 of 7 MET; AC4 partial and it cannot be otherwise while the Slack channel does not exist.**

🔴 **The number that matters is not 6-of-7. It is four red runs on a healthy stand, all self-inflicted,
none of them diagnosable remotely.** Local reproduction settled each in about a minute. That is the
reusable lesson and it is written into the workflow's own comments.

## Dev Notes

### 1. The one-paragraph version

A plain job on the s10 deploy runner, after `deploy`, that re-asserts health **outside the lock**,
fetches `/` and **the asset that index actually references**, scans a five-minute log window with a
matcher written against the real log format, and on failure prints the exact rollback dispatch. Slack
is blocked and said so. **Nothing is written to the stand.**

### 2. Anti-patterns

- **Re-implementing the health poll** — the single most likely wasted work here.
- **`GET /` == 200 as the whole check** — cannot fail for the reasons this exists.
- **A bare `grep ERROR`** — fails correct deploys, then gets disabled.
- **Pointing at the public name** — it resolves and refuses.
- **Marking AC4 met** because three of four clauses landed.

### References

- `epics.md` — Story 6.7 ACs; Epic 6 preamble
- `.forgejo/workflows/deploy-stand.yml` — the health poll, the anchoring assert, the `GET /` probe
  (**frozen**); `deploy-prod.yml` — the graph and `record-outcome`
- `nginx.conf`, `Dockerfile.prod` — what is served and what is logged
- `docs/migration-decisions.md` — `#d21`, `#d43` (the public name refuses), `#d47`, `#d48`, `#d49`
- `deferred-work.md` — the Slack webhook stub; Story 4.5's blockage
- `6-5-…md`, `6-6-…md` — the wiring lesson, the pagination lesson, the batch-tick lesson

---

## Dev Agent Record

### Agent Model Used

### Debug Log References

**Tasks 1–6 — 2026-08-27. Green on run 705. Four red runs before it, and every one was MY defect.**

🔴 **The headline is not the passing run. It is that this check failed three times on a stand that
was healthy, and that remote guessing found none of it.** Each diagnosis came from **local
reproduction** — `nginx:alpine` with this repository's own `nginx.conf` and a fake `dist/` — which
took about a minute and answered immediately. **Job logs are not retrievable on this instance, so
"debugging by re-dispatching" is guessing with a twenty-minute round trip.** Written into the step
comments so the next reader does not repeat it.

| Run | Verdict | Cause |
|---|---|---|
| 698 | 🔴 red | asserted `x-content-type-options` / `x-frame-options` on `/` — **headers the config does not serve** |
| 699 | 🔴 red | same, after adding step-summary diagnostics (which I also could not read) |
| 702 | 🔴 red | header assertion corrected — then failed on **an `[error]` log line the check wrote itself** |
| **705** | ✅ **green** | log window read **before** the probes, and the probe's own filename excluded |

**Defect 1 — a real finding about production, not about the check.** `nginx.conf` declares three
security headers at server level with `always`. **They are served on no HTML response.** `add_header`
is inherited into a location only if that location declares none of its own; `location ~* \.html$`
declares two, and the SPA fallback serves every route through it. **Reproduced locally**: `GET /`
returns 200 with `Content-Type` and `Cache-Control` from the `.html` block and neither security
header. **Filed to `deferred-work.md`, owner Oleg** (his decision, taken when the deferral was put to
him) — `nginx.conf` is frozen here and the fix changes what every environment serves.

**Defect 2 — the check failed on a log line it produced itself.** The serve-check's deliberate 404
probe makes nginx log `[error] ... open() ".../definitely-not-a-real-bundle-6-7.js" failed`. A 404 is
an **access**-log event; a missing **static file** is an **error**-log event. Closed two ways because
either alone is fragile: the log window is now read **before** the probes, **and** the matcher
excludes that one filename — **narrowly, so a genuinely missing bundle still trips it.**
⚠️ **The irony is on the record:** a step written against *"a bare `grep ERROR` would fail a correct
deploy"* failed a correct deploy, for a different reason.

**Run 705, all 14 job rows accounted for:** guard `skipped` (rollback), build `skipped`, deploy
`success`, **smoke `success`**, record `success`, disclosure `skipped`.

**Registry unchanged** — `prod-current` and `prod-a99ccd44c5a3` still `f30c7941…`. This story reads.

**Frozen check:** 11 workflows byte-identical; **`nginx.conf`, `Dockerfile.prod` and `src/`
untouched** — the finding was filed, not fixed; `derive` byte-identical. Zero `${{ }}` in any `run:`;
all bodies pass `bash -n`.

### Completion Notes List

### File List

### Review Findings

---

## Open Questions for Review

1. 🔴 **How is a FAILING smoke check earned?** An honest discriminating row needs production to serve
   something wrong. Options: **(a)** label it UNEARNED with that reason — the cheapest and, given the
   stand serves no users yet, arguably still weak evidence; **(b)** force-test the shell in isolation
   and label it as shell-only, which Story 6.3 did and had its AC recorded UNMET for; **(c)** point
   the check at a deliberately wrong port/path once, proving the assertions fire without touching the
   stand. **Recommendation: (c)** — it exercises the real code path, changes nothing, and produces a
   real run id.
2. **Parallel to `record`, or after it?** §6 recommends parallel and gives the reason. Confirm.
3. **What does an empty five-minute log window mean — pass or fail?** Recommendation: **pass, stated
   explicitly**, because a freshly started nginx with no traffic legitimately logs nothing, and
   failing on silence would fail every quiet deploy.
4. ✅ **RESOLVED before this file was finalised: PR #104 merged mid-write** and the worktree was
   re-based onto `043ce521`. `guard` is on `main`; the graph in §6 is the real one. **The remaining
   collision risk is Story 6.8's cancellation**, which had not landed as of 2026-08-27 and touches
   `sprint-status.yaml` and `deferred-work.md`.

---

## Change Log

| Date | Version | Description | Author |
|---|---|---|---|
| 2026-08-27 | 0.1 | Context created off `origin/main` @ **`043ce521`**. 🔴 **Re-based mid-write:** the first draft targeted `0d990967` and stated that Story 6.5's guard was not on `main`; PR #104 merged while the file was being written, and every reference to the job graph was corrected against the parsed file before finalising. Recorded rather than silently fixed — `main` moving under a contexting session is a repeat hazard here, and Story 6.6 was written against a repository that changed under it three times. 🔴 **The central finding is that epic AC1 is already implemented by `deploy-stand.yml`** — health poll, project-anchoring assert and a `GET /` 200 probe — so AC1 is amended to "re-assert **after** the deploy, outside the Story 4.4 lock" and re-implementation is prohibited. AC2 is strengthened to require a **content-level** probe, because `GET /` == 200 cannot fail for the reasons a smoke check exists. AC3 gains an explicit empty-window rule. 🔴 **AC4 is only partially deliverable — the Slack channel does not exist and the webhook is unrecoverable; owner Oleg** — and is recorded BLOCKED rather than dropped, the same deferral Story 6.4 took. Three ACs added. Four Open Questions; the sharpest is how a failing row is earned without making production serve something wrong. | create-story context engine (Opus) |
