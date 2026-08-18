---
baseline_commit: 7911d63d
---

# Story 3.6: Verify Commit Traceability and Image Immutability

Status: ready-for-dev

> **This story is lighter than its title, and the reason is written down rather than assumed.**
> Two of its four ACs are already satisfied by work Stories 3.2 and 3.3 did, and that was **verified
> on a real pushed image** — not read off the workflow file. Half of the third is already on `main`.
>
> 🔴 **What is left is one decision, and it has a history of being dodged.** AC2 carries an escape
> hatch — *"or if it is, the behaviour is detected and documented as a known limitation"* — and
> Story 3.2 cited that clause as an argument in its own design. Reaching for it again is the failure
> mode of this story.

---

## Story

As a release engineer,
I want proof that a tag identifies exactly one artifact and points back to one commit,
So that "deploy this tag" is an unambiguous instruction and an audit can reconstruct what ran.

---

## What you are changing, in one screen

| # | Change | Why |
|---|---|---|
| 1 | ✅ **DONE 2026-08-17 — measured, and the repoint is real.** Do not re-run it | §2, and the evidence is in *Measurement Record* below |
| 2 | Decide AC2: refuse the repoint, or document it. **Refusing is the default**, and §2's measurement now removes the last argument for documenting | §2, §3 |
| 3 | Record AC1 and AC3 as already met, with the evidence | §1 — do not re-implement them |
| 4 | Close AC4 for the whole epic | §5 |

---

## 🚨 Read this before anything else

### 1. ✅ AC1 and AC3 are already paid for, and here is the proof

Both are satisfied by labels that `build.yml` already emits. **Verified 2026-08-17 by reading the
config blob of a real image out of the registry**, not by reading the workflow:

```
org.opencontainers.image.revision = afcb66597ae7bf30fb30e9e50f8c1a4d78eae0e3
org.opencontainers.image.version  = afcb66597ae7
org.opencontainers.image.source   = git.crm-prionex.com/CRM/fe-prionex
org.prionex.environment           = dev
org.prionex.ref                   = story-3-6/pr-1-pin-base-images
org.prionex.ref-sanitized         = story-3-6-pr-1-pin-base-images
org.prionex.latest-eligible       = false
```

- **AC1** — "the mapping is verifiable from the image metadata or labels without consulting the run
  log": `org.opencontainers.image.revision` is the full commit SHA, on the image. Story 3.2's.
- **AC3** — "the environment it was built for is determinable from the image itself, not only from
  its tag string": `org.prionex.environment`. Story 3.3's, and `build.yml` says so at the labels
  block.

**Do not re-implement these. Record them, with the query that reads them, and move on.** ⚠️ But do
confirm the labels are still present on a current image before writing that down — the evidence
above is from 2026-08-17 and this story may run later. Reading a document as current state is the
error that has cost this project the most (see §6).

### 2. 🔴 AC2 is the whole story — and as of 2026-08-17 the problem is measured, not suspected (§2b)

AC2 asks that an existing `sha-<short>` tag is not silently repointed to a different digest when the
same commit is rebuilt.

**The claim that it IS repointed has been made repeatedly and demonstrated never.** The record is
`deferred-work.md`, section *"Opened by Story 3.4"*, item 2 — **not** D22, which an earlier draft of
this file cited and which says nothing about it. There it is reasoned, not measured: the same commit
is rebuilt from two refs, and builds "are not reproducible" because the base image floats and the
OpenBao values can change.

🔴 **One of those reasons was removed on 2026-08-17** — and "one of two" undercounts, corrected
after validation. `Dockerfile.prod` now pins both base images by digest:

```
FROM node:20-alpine@sha256:fb4cd12c85ee…  AS builder
FROM nginx:alpine@sha256:4a73073bd557…
```

**But at least four causes remain, and an earlier draft of this file named only two:**

1. **BuildKit layer and config timestamps** on any cache-miss rebuild. This one alone very nearly
   guarantees differing digests without a cache hit, and it is not fixable by pinning anything.
2. **`VITE_OPERATOR_PHONE_URL`**, added to the build contract on 2026-08-17 — the same day as the
   pins. Same commit, changed variable, different bundle.
3. **The npm registry** and lifecycle scripts.
4. **The OpenBao values**, which can change under a commit that did not.

🔴 **That paragraph is now history. The experiment was run on 2026-08-17, before this story opened,
and it answered the question: the repoint IS real, on the cold-cache path, and cause 1 is the one
that did it.** The evidence is in *Measurement Record* below; the rest of §2 is kept because it
explains why the experiment was designed the way it was, and because its warnings about reading a
warm-cache result still apply to anyone tempted to re-run it.

*(The paragraph this replaces read: "nobody knows whether rebuilding the same commit still produces a
different digest, and the answer probably depends on whether the cache hits." It was true when
written and is not true now — §6's own rule.)*

**Task 1 was to measure it — an earlier draft of this file designed the experiment badly, and
validation caught two faults. Both were corrected before the run, and both mattered:**

🔴 **Fault one: the dispatches serialize.** `build.yml` carries
`concurrency: group: build-${{ inputs.ref }}`, so two dispatches of the same `ref` queue rather than
race. Run them **sequentially and deliberately**; do not expect a race, and do not read the second
one's cancellation as a result.

🔴 **Fault two, and it is the one that matters: with Story 3.5's registry cache warm, the second
dispatch restores every layer `CACHED` — so identical digests would prove only that the cache-hit
path is deterministic.** That is a much narrower claim than "AC2 is met by construction", which is
what the earlier draft said. The scenarios actually recorded as dangerous — two runners building
before the cache is exported, a cold cache, a changed CI variable — would remain untested.

**So state what each outcome does and does not prove:**

| outcome | proves | does NOT prove |
|---|---|---|
| identical, warm cache | the cache-hit path is deterministic | anything about a cold-cache or racing rebuild |
| identical, cold cache | rebuilds are reproducible today | that they stay so when an input changes |
| **differ** | the repoint is real | *why* — timestamps, npm, OpenBao and the new CI variable are all live suspects |

⚠️ Differing digests are themselves confounded: **BuildKit stamps layer and config timestamps**, so a
genuine cache miss can differ for that reason alone. Identify the cause before designing anything —
Task 1.4.

`dev` tags expire at 14 days, so the experiment costs nothing permanent. Do **not** run it on
`preprod` or `prod` (Prohibition 4).

### 2b. ✅ Measurement Record — Task 1, executed 2026-08-17 before this story opened

**Verdict: `sha-<12>-<env>` IS silently repointed when the same commit is rebuilt off the cache
path. AC2's forbidden event is not hypothetical — it has happened, and the artifact is in the
registry now.**

Four runs touched commit `ff416712` and its tag `sha-ff416712653e-dev`:

| `action_run` | workflow | trigger | ref built | secs | cache |
|---|---|---|---|---|---|
| 696 | `build-main.yml` | push of the merge | `main` @ `ff416712` | 30 | warm |
| 697 | `build.yml` | `workflow_dispatch` `{dev, main}` | `main` @ `ff416712` | 28 | warm |
| 698 | `build.yml` | `workflow_dispatch` `{dev, main}` | `main` @ `ff416712` | 28 | warm |
| **700** | `build.yml` **from `probe/3-6-cold-cache`, `cache-from` removed** | `workflow_dispatch` `{dev, main}` | `main` @ `ff416712` | **147** | **cold** |

The probe branch (`d2b91416`) exists precisely to defeat the confound named in §2: changing
`build.yml` changes the build context, because `.dockerignore` does not exclude `.forgejo/`.
Dispatching the **probe branch's workflow** with `inputs.ref: main` takes the workflow from the probe
and the content from `main`, so the built tree is byte-identical to what 697/698 built and any digest
difference is attributable to the cache path alone. 147s against 28s confirms the cold path was
actually taken.

**What is under the tag now:**

```
sha-ff416712653e-dev  →  sha256:d1cc776c7fe3dcda4a65f056fd318ec8938f753b51b6e01ad15e7ffa583aa582
config sha256:7809c58106807881…  .created = 2026-08-17T12:40:34.805738608Z  (14:40:34 +02:00)
```

**The proof that this is a repoint, without needing the old digest** — which is gone, and no orphaned
untagged manifest survives for that window:

1. `config.created` is BuildKit's real build timestamp. Verified as a discriminator on four
   independent images, each matching its publication moment to the second: `sha-d2b91416d0fa-dev` →
   14:47:40 (run 699, 14:45:40–14:48:07); `sha-15ba38488819-dev` → 14:33:13; `sha-7911d63de371-dev` →
   13:02:18; and the one above → 14:40:34, inside run 700's window of 14:38:35–14:41:02.
2. Runs 697 and 698 finished at **14:34:47** and **14:35:48**. A config blob cannot carry a future
   timestamp, so `d1cc776c…` did not exist when they published this tag.
3. Therefore the tag resolved to a different digest then than it does now. **It was repointed, and
   nothing announced it.**

**Cause, per Task 1.4 — first answer, and it turned out to be the smaller half.** Suspect 1 of §2,
the BuildKit config timestamp, is real and guarantees a different manifest digest on any cache-miss
rebuild. But a second measurement the next day found a mechanism neither §2 nor the deferred record
had listed, and it dominates: see the layer comparison below.

#### 🔴 The layer question — answered 2026-08-18, and the answer is worse than the config timestamp

*(An earlier version of this section said the layer question was "unanswerable from this run". That
was true of run 700 alone. It stopped being true the moment a second image with the same source was
built, and the answer arrived free, from this story's own PR.)*

Run 701 built `story-3-6/pr-3-task-1-measured` — `main` plus two markdown files. Comparing it with
run 700's image layer by layer:

| # | 700 (`ff416712`) | 701 (`690ac376`) | |
|---|---|---|---|
| 1–8 | identical | identical | the two pinned base images |
| 9 | `09c86ed94e68`, 4 002 940 B | `d9e99e53a205`, 4 003 600 B | **DIFFER** — `/usr/share/nginx/html`, the built bundle |
| 10 | `026185e04788`, 1 225 B | `ed1b290bb524`, 1 221 B | **DIFFER** — `nginx.conf`, whose content is byte-identical |

Layer 9 unpacked: **154 files on each side, and almost every one has both a different name and a
different content hash.** Vite content-hashes its filenames, so this is a genuinely different
bundle, not a re-tar of the same bytes. Layer 10 differing on identical content is the tar-metadata
effect, and it is the *small* half of the problem.

**Root cause — `vite.config.ts:8`:**

```ts
define: {
  'import.meta.env.VITE_BUILD_TS': JSON.stringify(String(Date.now())),
},
```

`Date.now()` is evaluated at build time and baked in as a literal. It reaches `src/lib/i18n.ts:9`,
which nearly everything imports, so the content-hash cascade renames and rewrites almost every chunk.
**Two builds of the same commit cannot produce the same bundle — not on a warm cache, not on a cold
one, not ever.** The image is non-reproducible by construction of the source, and no amount of
pinning, caching or guarding in `build.yml` can change that.

🔴 **This supersedes the cause recorded for Task 1.4.** The BuildKit config timestamp is real but it
is the *lesser* mechanism; it explains layer 10 and the config blob. `Date.now()` in the Vite config
explains layer 9, which is the actual application.

🔴 **Consequence for Task 3, and it is worse than a dead branch.** §3's guard has three branches, and
the middle one is *"present, same digest → nothing to do; the artifact is already published"*.

*(A first draft of this paragraph said that branch was unreachable on any rebuild. That is wrong, and
the error matters because Task 3's design rests on it. `Date.now()` is evaluated when the bundle is
**built**; on a full cache hit BuildKit does not build it — it restores the cached layer and the
cached config, timestamp and all. That is precisely why runs 697 and 698 matched.)*

So which branch a rebuild takes is decided by **whether the cache hit**:

| rebuild | bundle | outcome |
|---|---|---|
| full cache hit | restored, not rebuilt | same digest → guard's middle branch, build passes |
| cache miss | rebuilt, new `Date.now()` | different digest → guard fires, build fails |

**The guard's verdict therefore depends on `:buildcache` — a single shared mutable tag that any
branch's build can overwrite.** §2b's own side effect 1 is the demonstration: a probe branch's push
evicted `main`'s cache at 14:48:02. The same rebuild of the same commit would pass before that and
fail after it, with nothing in the commit having changed.

That is not a reason to abandon the guard, but Task 3 has to answer it. A guard whose outcome turns
on a shared cache is non-deterministic in exactly the dimension AC2 is about — and «прошло вчера,
падает сегодня» is the kind of behaviour this project has repeatedly traced back to an unexamined
assumption. Options worth weighing in writing: accept it and document the cache dependency; scope the
guard to the paths where a rebuild is not routine; or remove the non-determinism at its source (see
below) so that both branches agree.

**This also closes the `VITE_BUILD_TS` half of §4b, and not the way that section expects.** §4b asks
whether the in-code fallback is safe. The question does not arise: `define` performs a textual
substitution, so `import.meta.env.VITE_BUILD_TS ?? '1'` compiles to `"<millis>" ?? '1'`. The `?? '1'`
fallback is **dead code**, and adding `VITE_BUILD_TS` to the build-arg contract would change nothing —
`define` overrides it. Whatever §4b decides, it is not "add it to the contract".

⚠️ **Still not established:** whether npm or the OpenBao values would *also* break reproducibility.
They are now moot for the digest question — `Date.now()` guarantees the answer on its own — but they
remain unmeasured, and if `vite.config.ts:8` is ever fixed they become live again.

⚠️ **Why 697 and 698 matched each other.** On a full cache hit BuildKit restores the cached image
config, timestamp included, so both inherited one `created` and produced one digest. That is exactly
the narrow claim §2's table warns about — and it is now the measured explanation for it, not a
hypothesis.

**Route used, so it can be repeated:** Forgejo API `/api/v1/repos/CRM/fe-prionex/actions/runs`
(fields `prettyref`, `commit_sha`, `event_payload.inputs`, `started`/`stopped`) for the runs;
`/api/v1/packages/CRM?type=container` and the registry v2 API
(`/v2/token?scope=repository:crm/fe-prionex:pull` → `GET /v2/crm/fe-prionex/manifests/<tag>`, then
the config blob) for the digests. The packages and registry routes need a `read:package` token —
`fe_tmp_1_7` does not have it. Run logs are **not** retrievable on this instance: every documented
API path returns 404, and the DB and on-disk log routes were unavailable in-session.

#### 🔴 Three things the measurement left behind — clean these up in Task 7

1. **The shared `buildcache` is polluted.** The probe removed `cache-from` but left `cache-to`, so
   run 700 exported its cold build, and then `ci.yml` on the probe branch's own push (run 699,
   660s) overwrote `:buildcache` at 14:48:02 with the **probe branch's** layers. The shared cache
   currently holds probe content, not `main` — the next `main` builds will partially miss. This is
   also a live example of the same class of hazard AC2 is about: a shared mutable tag rewritten by
   whoever pushed last.
2. **`probe/3-6-cold-cache` is still on the remote**, one commit ahead of `main`, and its push
   triggered a full `ci.yml`. Delete it once the record here is merged — the evidence lives in this
   file, not in the branch.

3. **A second standing token exists.** `fe_pkg_3_6` (`read:package`, on `platform-admin`) was minted
   2026-08-17 to read the digests above, because `fe_tmp_1_7` is scoped
   `write:repository,read:organization`. Owner and revocation trigger recorded in
   `deferred-work.md`; the `fe_tmp` entry went stale for a full story once already.

### 3. The guard IS needed (§2b settled that) — refuse, do not reach for the escape hatch

AC2 permits documenting the behaviour instead of fixing it. **Story 3.2 already used that clause as
an argument**, and this project's record with deferral is poor: semver was deferred twice before
being decided, `latest` was deferred, AC4 of Story 3.4 was restated four times as "partly confirmed"
when it was structurally unobservable and nobody had checked.

Every one of those meant "we did not look".

**The semantics are on the side of refusing.** `sha-<12>-prod` asserts *"this is the image of commit
X for environment Y"*. If a rebuild produces a different image, that assertion becomes ambiguous —
which is exactly the ambiguity this story exists to remove. A deliberate rebuild should be an
explicit act, not a side effect of someone pushing the same branch twice.

**Shape of the guard, if it is needed:** before the push, ask the registry whether
`sha-<12>-<env>` already exists.

- absent → push, nothing to protect
- present, same digest → nothing to do; the artifact is already published
- present, **different digest** → this is what AC2 forbids. Fail, and name both digests.

`docker buildx imagetools inspect` is already in `build.yml` (Story 3.5) and reads OCI, so no new
tooling is needed.

⚠️ **Think about the legitimate rebuild before you write it.** A base-image security bump for the
same commit is a real case, and it now requires an explicit `Dockerfile.prod` change — which changes
the digest by design. Decide in writing whether that path needs an override input, or whether
changing the Dockerfile is itself the explicit act that makes it acceptable.

### 4. The ACs are written against a tag shape that no longer exists

Story 3.6's ACs say `sha-<short>`. **That form was deleted by D20** — one commit yields up to three
images under Option C, so the bare form cannot be unambiguous. `epics.md` already carries the
amendment:

> ⚠️ **NFR4, Story 3.4 AC2 and Story 3.6 AC1 still address images by the bare form and must be read
> as `sha-<short>-<env>`.**

Read every AC in this story as `sha-<12 hex>-<env>`. The **12** is load-bearing: Stories 5.4 and 6.5
compare those strings byte for byte.

### 4b. 🔴 A debt this story owns and an earlier draft of this file omitted entirely

D20 §6 and `deferred-work.md` both name **Story 3.6** as the owner of this, and validation found it
missing here:

> the build-arg contract covers **2 of the 5** `VITE_*` variables `src/` actually reads. The other
> three get `undefined` and fall back to in-code literals. Closure requires amending AC5. **Владелец
> — Story 3.6.**

**The worst of the three was fixed on 2026-08-17**, outside this story: `VITE_OPERATOR_PHONE_URL` was
falling back to `http://localhost:5173` — the origin the CRM posts its JWT to — and that string was
verified present in the shipped preprod bundle. It is now in the contract, supplied per environment
from a Forgejo CI variable, and dev/preprod are deliberately empty (Oleg, 2026-08-17).

**Still open, and this story owns them:**

- `VITE_EASYPAY_PORTAL_API_KEY` remains **outside** the contract, with an in-code fallback nobody has
  audited the way the phone URL was audited.
- ✅ **`VITE_BUILD_TS` is audited (2026-08-18) and the answer is not "add it to the contract".**
  `vite.config.ts:8` bakes `Date.now()` in via `define`, so the `?? '1'` fallback at
  `src/lib/i18n.ts:9` is dead code and a build arg would be overridden. It is also the dominant cause
  of AC2's repoint — see §2b. Decide it as a reproducibility question, not a contract-coverage one.
- **Neither D20 §6 nor `deferred-work.md` is marked closed for the part that IS fixed.** Closing a
  record is part of fixing a thing; this story should do it rather than leave a live-looking entry.

⚠️ Audit the two remaining variables the way the phone one was audited — read what the fallback
actually is and whether it ships. Do not assume "it is only a build timestamp" without looking.

### 4c. Two concrete AC2 cases were handed to this story, and they are not `sha-` tags

`deferred-work.md` records these explicitly as *"two concrete cases to test rather than a
hypothetical"*, owner Story 3.6:

1. **Sanitizer collisions** — two different refs whose sanitized forms coincide push the same
   `<branch>-<env>` tag and overwrite each other. Story 3.5's review measured that no collision
   exists among the 509 current branches, so the class is armed but not loaded.
2. **The 100-character truncation** — `cut -c1-100` in the tags step is many-to-one, and one live
   branch already exceeds it at 109 characters.

🔴 **The guard shape in §3 covers `sha-<12>-<env>` only.** These two produce collisions on the
**branch** tag, which is mutable by design — `<branch>-dev` is supposed to move. Decide explicitly
whether AC2's protection extends to it, and if not, say why in writing rather than by omission.

### 5. Who is downstream, and why this is not a paperwork story

Three later stories consume exactly what AC2 protects:

- **Story 5.4** creates `preprod-<sha>` where `<sha>` is the **commit** SHA, "because Epic 6's
  promotion guard matches on commit identity".
- **Story 6.5** extracts the commit SHA from an `image_tag` and refuses the production deploy unless
  `preprod-<sha>` exists. Its own AC states it proves the **commit** passed PRE-PROD, not the
  artifact.
- **Story 6.6** keeps `prod-<sha>` as the rollback target.

If a `sha-` tag can silently name a different artifact than it did yesterday, 6.5's guard checks a
claim that has quietly changed underneath it. **That is the concrete harm, and it is the argument
against the escape hatch.**

### 6. Verification discipline, learned expensively on 2026-08-17

Three checks in a row that day looked at an indirect signal instead of behaviour, and all three were
wrong:

- a "string is absent from the bundle" check **passed on an empty input** — the image job had been
  skipped and there was no bundle at all;
- the same check on a real 10.5 MB bundle found the string **present**, and nearly caused a working
  fix to be declared broken — the literal survives as a fallback branch whether or not it is used;
- and before that, a two-day-old document was read as current infrastructure state and a permanent
  tag was minted on the strength of it.

⚠️ One correction to how that history is usually told: of the three guards in `build.yml` that could
not fire, the `__INDEX__` branch was **added by a review** and found dead by Story 3.5's own
measurement — not the other way round. Reviews are not immune to this; they produced one of the
three.

**Presence of a literal is not use of it** — the same shape as Story 3.4's *"presence of a string in
a binary is not support for a trigger"*. For this story specifically: **do not prove immutability by
grepping. Compare digests, and prove the comparison can fail.**

### 6b. Three declined items addressed to "whoever next opens `build.yml`"

That is likely this story. None is fixed, all are in `deferred-work.md`:

- `apt-get install docker.io jq` is **unpinned and unretried**, on ~30 builds/day.
- **No `docker image prune`** against dind volume growth.
- Four actions on **floating major tags** (`@v3`, `@v5`, `@v6`) — noted there as ironic "in an epic
  whose Story 3.6 is about a tag identifying exactly one artifact".

Fixing them is not this story's job. Deciding in writing whether to take any while the file is open
is.

### 7. Cost, declared before it is spent — including the review

🔴 **Story 3.5 declared 10–14 runs, spent 14 on implementation and 5 more on the review round it had
not budgeted at all.** Every story in this project has had a review round; every one found
something; three found something blocking. **A review round is a phase, not a contingency.**

State the expected runs for implementation **and** review before Task 2, and close the ledger with
`SELECT count(*) FROM action_run`, not from memory.

Known costs: every push to every branch builds an image (Story 3.4), so any `build.yml` change is
exercised ~30×/day whether this story asks for it or not.

### Prohibitions

1. **Do not re-implement AC1 or AC3.** They are done; confirm and record.
2. ✅ **Satisfied — Task 1 has measured it (§2b) and the problem exists.** The prohibition was
   against writing the guard on an assumption; that condition is now met, so the guard may be
   written. Prohibition 3 and Task 3.4 still stand: do not weaken the assertion, and prove the guard
   can fire.
3. **Do not weaken the digest assertion** to make a new case fit.
4. **Do not use `preprod` or `prod` for the AC2 experiment.** Their tags are permanent. `dev`
   expires at 14 days and answers the same question.
5. **Do not prove anything by grepping a bundle or a binary** (§6).
6. **Do not touch `driver: docker-container`, `network=fe-prionex-build`, or `provenance: false`.**
   All three are load-bearing and were established at cost in Story 3.5 (D22).

---

## Acceptance Criteria

Verbatim from `epics.md`, with this story's reading where measurement has overtaken the plan.

**AC1 — the tag maps to the commit, provably.**

**Given** a push to any branch
**When** the build completes
**Then** the registry contains an image whose `sha-<short>` tag maps to that exact commit
**And** the mapping is verifiable from the image metadata or labels without consulting the run log.

*Reading: read `sha-<short>` as `sha-<12>-<env>` (§4). ✅ **Already satisfied** —
`org.opencontainers.image.revision` carries the full commit SHA on the image, verified in the
registry 2026-08-17 (§1). Confirm it still holds, record the evidence, do not rebuild it.*

**AC2 — the tag is not silently repointed.**

**Given** an existing `sha-<short>` tag in the registry
**When** the same commit is built a second time
**Then** the existing tag is not silently repointed to a different digest, or if it is, the
behaviour is detected and documented as a known limitation.

*Reading: 🔴 **the only real work in this story — and the measurement is now done.** The repoint was
demonstrated on 2026-08-17 (§2b): the same commit rebuilt off the cache path produced a different
digest and the tag moved silently. What remains is the decision and the guard (§3). The escape
hatch — "or the behaviour is detected and documented" — is now the weakest it has ever been: the
behaviour is detected, and §5 says three later stories rely on it not happening.*

**AC3 — the environment is in the image, not just the tag.**

**Given** an image built for a specific environment
**When** its metadata is inspected
**Then** the environment it was built for is determinable from the image itself, not only from its
tag string.

*Reading: ✅ **Already satisfied** by `org.prionex.environment`, verified on a real image (§1). A
useful comparison pair exists: a `dev` image and the `preprod` image from run 680.*

**AC4 — the epic is closed.**

**Given** all Epic 3 stories are complete
**When** the phase-4 definition of done is evaluated
**Then** a push to any branch demonstrably produces an immutable image bound to its commit
**And** the evidence is recorded.

*Reading: ⚠️ **no "phase-4 definition of done" section exists** in `epics.md` — searched. Treat AC4
as: demonstrate the end-to-end property once, from a real push, with evidence from the registry and
the database rather than from a green tick, and record it as Epic 3's closing evidence.*

---

## Tasks / Subtasks

### Task 1 — Measure whether the repoint still happens (AC: 2) — ✅ DONE 2026-08-17, see §2b

- [x] 1.1 Confirm the base-image pins are still in `Dockerfile.prod` and that the labels of §1 are
      still on a current image. — *Labels confirmed on `sha-ff416712653e-dev`:
      `org.opencontainers.image.revision = ff416712653ea2d204a3b6ea3c0ae722b094e5f6` (full SHA, AC1),
      `org.prionex.environment = dev` (AC3), plus `org.prionex.ref = main` and
      `org.prionex.latest-eligible = true`. §1's evidence is still current.*
- [x] 1.2 Dispatch `build.yml` twice for the same `ref`, `environment: dev`, **sequentially**. —
      *Done as runs 697 and 698, plus the cold run 700; the table is in §2b. Cache state was read
      from durations (28s warm vs 147s cold) and from `config.created`, **not** from `CACHED`
      markers: run logs are not retrievable on this instance (404 on every documented API path).*
- [x] 1.3 🔴 Compare, and **state what the result does and does not prove**. — *§2b does both. Result
      is the table's **"differ"** row: the repoint is real. The warm pair 697/698 is explicitly NOT
      read as "AC2 met by construction" — §2b explains why they matched each other.*
- [x] 1.4 If they differ, determine the cause. — *Suspect 1, the BuildKit config timestamp. ⚠️ The
      layer-level question stays open and is unanswerable from this run — §2b says so rather than
      letting the config result stand in for it.*
- [x] 1.5 ⚠️ Consider whether a cold-cache case can be produced at acceptable cost. — *It was
      produced: `probe/3-6-cold-cache` removes `cache-from` and is dispatched with `inputs.ref:
      main`, which defeats the build-context confound. This is the dangerous scenario the record
      names, and it is the one that failed.*

### Task 2 — Declare the budget (AC: all)

- [ ] 2.1 State expected runs for **implementation and review separately**, before Task 3. Story 3.5
      overran by exactly the review round it did not budget. *Baseline: `action_run.id` **700** is the
      last run before this story's implementation — the four runs Task 1 consumed (696–700) are
      already spent and belong in the ledger, not outside it.*
- [ ] 2.2 List every tag this story could push and compile the live `keep_pattern` against each.

### Task 3 — Decide and implement AC2 (AC: 2)

- [ ] 3.1 Decide in writing: refuse, or document. **Refusing is the default** (§3); documenting
      needs a reason that survives §3's argument.
- [ ] 3.2 If refusing: the guard shape is in §3. Fail with BOTH digests named.
- [ ] 3.3 Handle the legitimate rebuild case explicitly (§3).
- [ ] 3.4 🔴 **Prove the guard can fire.** A guard that cannot fail proves nothing — three in this
      file could not, and each was found by a review rather than by its author.

### Task 4 — Record AC1 and AC3 rather than rebuild them (AC: 1, 3)

- [ ] 4.1 Read the labels off a current image, from the registry. Record the exact query.
- [ ] 4.2 Show AC3 with a comparison pair — a `dev` and a `preprod` image differing in
      `org.prionex.environment`.

### Task 5 — Close AC4 and the epic (AC: 4)

- [ ] 5.1 One real push → image → tag → commit, evidenced from `package_version` and
      `action_run_job`. **Not from a green job** — two green runs in Story 3.4 built nothing.
- [ ] 5.2 Record Epic 3's closing evidence.

### Task 6 — Record (AC: all)

- [ ] 6.1 Dev Agent Record: budget declared vs spent, closed **by query**; the Task 1 measurement
      either way; every «не проверено» that survives.
- [ ] 6.2 A D-record — next number after D22 — with `<a id="dNN"></a>` **above** the heading and
      **before** `<a id="changelog"></a>`; retention section stays last. Plus a changelog row and a
      summary-table row.
- [ ] 6.3 `deferred-work.md`: the repoint verdict, and anything this story opens.
- [ ] 6.4 Amend `epics.md` **in place, no reflow** — the `sha-<short>` readings in AC1/AC2.

### Task 7 — Close (AC: all)

- [ ] 7.1 Commit on a branch; open a PR — `main` is gated (D16).
- [ ] 7.2 Update `sprint-status.yaml`; consider whether `epic-3` moves to `done`.
- [ ] 7.3 Close the budget ledger by query.
- [ ] 7.4 🔴 Merge, verify `main` moved, and only then delete the branch.
- [ ] 7.5 Delete `probe/3-6-cold-cache` from the remote — its evidence now lives in §2b, and the
      branch is one commit of deliberately broken `build.yml` sitting where someone could dispatch
      it (§2b, side effect 2).
- [ ] 7.6 Decide what to do about the polluted `:buildcache` (§2b, side effect 1). It self-heals on
      the next `main` build, so "nothing" is a legitimate answer — but say it, rather than leaving
      the next slow build unexplained.

---

## Dev Notes

**What Epic 3 built, which this story is the audit of:**

| story | what it left behind |
|---|---|
| 3.1 | the build and push, `driver` choice, the digest assertion's first form |
| 3.2 | the tag scheme and the `org.opencontainers.image.*` labels — **AC1** |
| 3.3 | per-environment builds from OpenBao and `org.prionex.environment` — **AC3** |
| 3.4 | automatic builds on every branch push; `ci.yml` calls `build.yml` |
| 3.5 | registry cache, `docker-container` + user-defined network, the assertion on `imagetools` |
| — | base images pinned by digest, 2026-08-17 — **half of AC2** |

**Traps this file has already sprung on people**, all recorded in D21/D22:

- A `uses:` job's `if:` is copied into the callee and re-evaluated where `github.event_name` is
  `workflow_call`. Never test `event_name` in one; `github.ref` survives.
- A green `uses:` wrapper job proves nothing about whether the callee did work — a skipped wrapper
  also reports success. Check the registry.
- `docker manifest inspect` cannot read OCI media types at all. Use `imagetools`.
- No `${{ }}` inside any `run:` body, comments included — Forgejo substitutes there too.
- A skipped ordinary job's commit status resolves to **success**, not pending. An earlier claim to
  the contrary was wrong and caused a working fix to be reverted.

---

## Open Questions for Review

### Blocking

1. ✅ **ANSWERED 2026-08-17 — yes, it still happens.** Measured in §2b: the same commit rebuilt off
   the cache path produced a different digest and `sha-ff416712653e-dev` moved silently. The cause is
   the BuildKit config timestamp, which pinning cannot remove. This question is closed; what it
   decided is that §3's guard is warranted.

### Non-blocking

2. **The legitimate rebuild** (§3) — a base-image bump for the same commit changes the digest by
   design. Override input, or is editing `Dockerfile.prod` itself the explicit act?
3. **AC4 has no "phase-4 definition of done" to evaluate against** — it does not exist in
   `epics.md`. Proposed reading in the AC block above.
4. **`prod` has still never been built end to end.** Out of scope here, tracked in `deferred-work.md`,
   but AC4 claims an epic-wide property and `prod` is a third of it.
