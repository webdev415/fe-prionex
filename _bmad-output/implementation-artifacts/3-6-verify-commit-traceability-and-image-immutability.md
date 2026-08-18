---
baseline_commit: 7911d63d
---

# Story 3.6: Verify Commit Traceability and Image Immutability

Status: in-progress

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

That is not a reason to abandon the guard, but it had to be answered before Task 3 could be written.

✅ **DECIDED 2026-08-18 by Oleg: the guard only. `vite.config.ts` is not touched.**

The alternative on the table was replacing `Date.now()` with the commit SHA — a one-line change that
would preserve the locale cache-busting intent and make the bundle reproducible. It was declined:
Story 3.6 is a CI story, and `vite.config.ts` is application source. **AC2 is satisfied by refusing
the repoint, which does not require reproducibility.**

What this commits the implementation to:

- The guard is written as §3 describes: absent → push; present and equal → nothing to do; present and
  different → fail, naming both digests.
- **The cache dependency is documented as known behaviour, not designed away.** A rebuild passes on a
  cache hit and fails on a cache miss, and `:buildcache` is evictable by any branch. Write it down at
  the guard, in the words above, so the next person to hit «прошло вчера, падает сегодня» finds the
  explanation instead of re-deriving it.
- ⚠️ **This is not AC2's escape hatch.** The repoint is refused, which is what AC2 asks. What is
  documented rather than fixed is the *source-level non-reproducibility underneath it* — a different
  and larger problem, which stays open below.

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

**✅ DECIDED 2026-08-18 (autonomous, subject to Oleg's veto): AC2's guard mechanism does NOT extend
to `push_tags`.** Applying it there would break, not fix, normal operation: the guard's absent/
same/differ logic exists because `sha-<12>-<env>` promises to name one artifact forever, and
`push_tags` promises the opposite — Story 4.6 depends on `<branch>-dev` moving on every push. Every
ordinary rebuild would trip "differ" and refuse a legitimate build.

The two named hazards are also not repoint-of-self — they are two *different* refs colliding on one
*sanitized* name, a uniqueness problem, not an immutability one. Closing it needs tracking "which raw
ref currently owns this sanitized name" (the `org.prionex.ref` label already carries the raw ref) and
refusing a build that would hand the name to a different one — a smaller, separate guard from AC2's,
and not this story's to build: Task 3 is scoped to `sha-<12>-<env>` (§3), and no task in this story
asks for a branch-tag uniqueness check. **Left open, with an owner recorded** in `deferred-work.md`
rather than silently dropped — Story 3.5's review already measured the class is armed (0 collisions
in 509 branches) but not loaded (one branch already exceeds the 100-char truncation at 109 chars).

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

**✅ DECIDED 2026-08-18 (autonomous, subject to Oleg's veto): declined again, deliberately — the third
decline in a row on this file, and named as such rather than left to look like drift.** `build.yml`
was already opened extensively by this story for the AC2 guard, which by itself carries a blocking
defect (the `imagetools create` index bug) and 21 review findings; bundling three more infrastructure
changes into the same PR raises review surface for risk orthogonal to AC2, at a point where this
story is already over its own declared budget (Task 2.1). None of the three is touched here.

**This makes three declines of the same three items** (Story 3.2's review, the `deferred-work.md`
entry that recorded "declining... so the next reader does not have to guess", and now this one). The
"whoever next opens `build.yml`" ownership model has not produced a fix in three tries — that is a
signal about the model, not about any one story. Recorded in `deferred-work.md` as such: if a fourth
story opens this file and declines a fourth time, it should stop being deferred-work.md's problem and
become a named, scheduled ticket instead.

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

- [x] 2.1 State expected runs for **implementation and review separately**, before Task 3. Story 3.5
      overran by exactly the review round it did not budget. *Baseline: `action_run.id` **700** is the
      last run before this story's implementation — the four runs Task 1 consumed (696–700) are
      already spent and belong in the ledger, not outside it.* — *🔴 **This session could not spend
      any of this budget.** Dispatching `workflow_dispatch`, and reading `action_run`/registry state to
      close the ledger by query, both need Forgejo API credentials (`fe_tmp_1_7` for dispatch,
      `fe_pkg_3_6` or equivalent for the registry) that are host-local to s1 (`/root/.fj_token`) and
      not available to this agent session — no SSH to s1, no token in the environment (see Dev Agent
      Record). **Declared, not spent:**
      **Implementation:** 2 runs — (a) the automatic `dev` build `ci.yml` triggers on this branch's
      push, which exercises the guard's "absent" path (first build of a new commit — the ordinary
      case, ~30×/day project-wide already, not a special cost) and doubles as Task 5's real-push
      evidence; (b) one **deliberate** `workflow_dispatch` rebuild of that same commit, run
      **sequentially** (build.yml's dispatch-path concurrency serializes same-`ref` dispatches — Task
      1's own finding) and ideally on a cold cache (Task 1's probe-branch technique) to force the
      "differ" path and prove the guard's FAIL branch actually fires (Task 3.4). This needs the API
      token; it is the one this session is blocked on.
      **Review:** budget 1 run at minimum, per Story 3.5's own lesson that "every story has had a
      review round and it always finds something" — this session declines to assume zero.
      **Task 4 (AC1/AC3 record):** 0 additional runs — existing registry images already carry the
      evidence (Task 1.1, §1); confirming currency is a registry *read*, not a build, and does not
      consume the run budget even when the credential to perform it is available.*
      *🔴 **Final ledger update — runs actually spent, all coordinator-run; this agent session's own
      API access stayed blocked throughout (see Dev Agent Record) and none of these numbers come from
      a query this session executed.**

      | run | trigger | result | what it closed |
      |---|---|---|---|
      | 717 | `correct-course/prod-target-s10` merge, PR #49 | green | not this story's spend — recorded because it is why D24 exists (took the `D23` anchor) |
      | 719 | `ci.yml`, auto-push of `563243f3` | **failure** | found the predigest allowlist regression (Session 2's own patch over-narrowed absence detection) |
      | 720 | `ci.yml`, auto-push of `e4f0690a` | green | Task 3.4 "absent" branch; Task 5.1's push-half |
      | 721 | `workflow_dispatch`, same ref `e4f0690a` | green | Task 3.4 "equal" branch |
      | 722 | `ci.yml`, auto-push of `probe/3-6-differ` `15c22b17` | green | not a guard test itself — prepared the differ test by evicting `:buildcache` |
      | 723 | `workflow_dispatch`, same ref `e4f0690a`, foreign cache | **failure** | Task 3.4 "differ" branch — the guard actually refusing |
      | 725 | `workflow_dispatch`, same ref `e4f0690a`, immediately after 723 | **failure** | discriminating check — proved 723 left the tag untouched, not merely reported it as wrong |

      **Declared 2 implementation runs; genuinely spent 6 (719, 720, 721, 722, 723, 725) plus this
      round's own closing push, which auto-triggers a further `ci.yml` run** — an overrun, stated
      plainly rather than reframed. Two causes, both legitimate rather than waste: (1) 719 was a review
      finding's own regression, not a planned test — the "review will find something" line of the
      original declaration, spent on itself; (2) 3.4's four-outcome table (absent/equal/differ/
      ambiguous) needed more than the two dispatches originally planned once "prove equal doesn't
      falsely pass" and "prove differ doesn't merely warn" turned out to be separate, both-necessary
      checks — 721 and 725 were not in the original plan, and both were cheap (~2 min, ~45 s) and
      decisive rather than exploratory. **Ledger is not closed by a query this session ran** — Task 7.3
      still needs `SELECT count(*) FROM action_run` from whoever has DB/API access; the table above is
      the coordinator's account, cited and attributed, not independently verified here.*
- [x] 2.2 List every tag this story could push and compile the live `keep_pattern` against each. —
      *Read from `build.yml`'s own tag-computation step, not dispatched — this needs no run. This
      story's `build.yml` change (Task 3) introduces **no new tag shape**; it only changes which step
      pushes the two tags that already existed. So the compiled list is unchanged from what Story 3.3
      already established:*

      | tag shape | example (`env=dev`) | matches `keep_pattern`? | consequence |
      |---|---|---|---|
      | `sha-<12>-dev` | `sha-abc123def456-dev` | no | expires in 14 days |
      | `sha-<12>-preprod` \| `sha-<12>-prod` | `sha-abc123def456-prod` | **yes** — `(pre)?prod-[0-9a-f]{7,64}` | permanent; this is the tag Epic 6 depends on and AC2 protects |
      | `<sanitized-branch>-dev` | `story-3-6-pr-4-close-…-dev` | no (unless the sanitized ref itself collides with a protected shape — guarded separately at the `KEEP_RE` check on `$SANITIZED`) | expires in 14 days |
      | `<sanitized-branch>-preprod` \| `-prod` | | only if the branch name sanitizes to a hex string — guarded, fails closed | permanent if it slips through; not this story's concern to fix, already guarded pre-3.6 |
      | `buildcache` | `buildcache` | **yes** — literal | permanent by design (Story 1.11), unconditional `cache-to`, never goes through the tags step or its guards |

      *This story's own guard (Task 3) touches only the first two rows' `sha-` member — it decides
      whether that tag gets attached, never invents a new one.*

### Task 3 — Decide and implement AC2 (AC: 2)

- [x] 3.1 Decide in writing: refuse, or document. — *✅ **Refuse.** Decided by Oleg 2026-08-18; the
      reasoning, what was declined and why, and what the decision commits the implementation to are
      in §2b. `vite.config.ts` stays untouched — this is a CI story.*
- [x] 3.2 If refusing: the guard shape is in §3. Fail with BOTH digests named. — *Implemented in
      `.forgejo/workflows/build.yml`. Split into two steps either side of the build, because a check
      that runs after an all-tags push cannot refuse anything (the tag would already be wrong):
      "Query the pre-existing digest of sha-<12>-<env> (Story 3.6 AC2)" (`id: predigest`) reads what
      the tag pointed to **before** this run touches the registry; "Build and push image" now pushes
      only `steps.tags.outputs.push_tags` (the mutable branch tag), not the full `.tags` list;
      "Enforce AC2 — attach or refuse sha-<12>-<env>" compares `pre_digest` against this run's
      `steps.build.outputs.digest` and either attaches the tag with `docker buildx imagetools create`
      (registry-side retag, no rebuild) when absent-or-equal, or `exit 1` naming both digests when
      they differ — before the attach command ever runs, so the tag is left genuinely untouched on the
      forbidden path, not just reported as wrong. The final fail-closed assertion step is unchanged and
      still walks the full tag list; it now runs after the sha- tag has been attached (or the job has
      already failed), so no change was needed there.*
- [x] 3.3 Handle the legitimate rebuild case explicitly (§3). — *Decided: no override input. Recorded
      at the "Enforce AC2" step and here: `short_sha` is `git rev-parse HEAD` from the tags step — it
      cannot change without a new commit. A base-image security bump "for the same release" is
      mechanically a `Dockerfile.prod` commit, i.e. a DIFFERENT commit, which gets its OWN
      `sha-<12>-<env>` tag — there is no existing tag to refuse, so the guard never fires for that
      case. The only rebuild this guard can ever block is the SAME commit producing different bytes,
      which per §2b is not a legitimate case at all — it is the `Date.now()` bug AC2 exists to catch.
      An override would only give that bug a bypass, so none is added. This also answers Open Question
      2 (non-blocking).*
- [x] 3.4 🔴 **Prove the guard can fire.** A guard that cannot fail proves nothing — three in this
      file could not, and each was found by a review rather than by its author. — *✅ **PROVEN LIVE,
      all four outcomes, coordinator-run (this session's own API access stayed blocked throughout —
      see Dev Agent Record).*
      | outcome | run | result | evidence |
      |---|---|---|---|
      | absent | **720** (`ci.yml`, auto-push of `e4f0690a`) | green | `predigest`'s `": not found"` match fired on a genuinely absent tag; attach with `--prefer-index=false`, read-back, and the final assertion all passed |
      | equal | **721** (`workflow_dispatch`, same ref `e4f0690a`, env `dev`) | green, ~2 min | full cache hit off `:buildcache` (last written by 720); byte-identical rebuild; digests equal; guard's "already points at" branch took over, attach skipped as designed |
      | differ | **723** (`workflow_dispatch`, same ref, after `probe/3-6-differ` (commit `15c22b17`) overwrote `:buildcache` with foreign layers via its own auto-build, run 722) | **failure**, ~3 min (build ran ~2.5 min before the refusal) | cache miss on the diversified COPY layer → `vite.config.ts`'s `Date.now()` re-evaluated → different bytes → `predigest` found the pre-existing digest (from 720/721) → "Enforce AC2" refused, naming both digests |
      | refusal is a real refusal, not a report | **725** (`workflow_dispatch`, same ref, immediately after 723) | **failure**, ~45s | discriminating check: by 725, `:buildcache` held 723's own (refused) layers, so 725 cache-hit and reproduced 723's bytes exactly — and 725 *still* failed, comparing against the digest **720** originally attached. If 723 had repointed the tag despite refusing, 725 would have read 723's digest as `pre_digest` and gone green. It didn't: `sha-<12>-dev` was untouched by 723's refusal. This is the live closure of the review's "permanent AND unverified behind a red run" concern (`:1228-1233`), for the `dev`/differ path specifically. |
      | ambiguous (fail-closed) | **719** (`ci.yml`, auto-push of `563243f3`, before the allowlist re-widening) | failure | the `predigest` "could not determine … Refusing to proceed on an ambiguous read" branch fired for real, on a since-fixed allowlist bug — see the Session-2/3 chronicle above and in Dev Agent Record |

      Together these are the three branches §3's table names (absent → push; equal → nothing to do;
      differ → fail with both digests) plus the fourth, defensive branch (ambiguous → fail-closed) —
      all four now have a live run against them, closing the standard §6 of this story sets: "a guard
      that cannot fail proves nothing".*

### Task 4 — Record AC1 and AC3 rather than rebuild them (AC: 1, 3)

- [ ] 4.1 Read the labels off a current image, from the registry. Record the exact query. — *⚠️
      **Blocked, not skipped, and now confirmed rather than inferred.** The coordinator checked
      directly (this agent session's own API access is still refused by the harness classifier —
      unchanged): `GET /api/v1/packages/CRM` → `403`; `GET /api/v1/user` →
      `"token does not have at least one of required scope(s): [read:user]"`. `fe_tmp_1_7` genuinely
      lacks package scope — this needs `fe_pkg_3_6` (or equivalent) plus an account login, not just a
      different command. Best available evidence, not independently re-confirmed here: Task 1.1 (this
      story, 2026-08-17) read `sha-ff416712653e-dev` and recorded `org.opencontainers.image.revision =
      ff416712653ea2d204a3b6ea3c0ae722b094e5f6` (full commit SHA — AC1) via `docker buildx imagetools
      inspect` against the pushed manifest. That is the exact query this task asks to record:
      `docker buildx imagetools inspect --format '{{json .Image.Config}}'
      git.crm-prionex.com/crm/fe-prionex:sha-<12>-<env>` (or the registry v2 API route in §2b) then
      read `.Labels` off the config blob, the same route `predigest`/the new guard use for the digest
      alone. **Not re-confirmed as "current" in this session** — the story's own §1 warns that reading
      a two-day-old fact as present state is this project's most expensive recurring mistake, and that
      warning applies here: the evidence above is from 2026-08-17, not from today. ✅ One thing IS newly
      current, from Task 3.4's live proof: runs 720/721/723/725 all confirm the guard machinery itself
      (which reads `.Manifest.Digest`, not `.Labels`) works against today's registry — a narrower claim
      than 4.1 asks for, but not nothing.*
- [ ] 4.2 Show AC3 with a comparison pair — a `dev` and a `preprod` image differing in
      `org.prionex.environment`. — *⚠️ **Blocked**, same confirmed reason as 4.1 — package scope, not
      just a missing route. Partial evidence only: the `dev` side is Task 1.1's reading,
      `org.prionex.environment = dev`. The `preprod` side is NOT independently read in this session —
      `deferred-work.md` ("Opened by Story 3.5", item 1, run 680) confirms `sha-00ef3be4743d-preprod`
      is a real, legitimately-pushed preprod image of `main`, but only verified the OpenBao-sourced
      URLs baked into its bundle, not this specific label's value.
      `org.prionex.environment=${{ inputs.environment }}` in `build.yml`'s `labels:` block has been
      unconditional since Story 3.3, so `preprod` is the label's value **by construction of the code
      run 680 executed** — an inference from source, not a fresh read of that image. Closing this
      properly needs `fe_pkg_3_6` plus an account login, same as 4.1.*

### Task 5 — Close AC4 and the epic (AC: 4)

- [ ] 5.1 One real push → image → tag → commit, evidenced from `package_version` and
      `action_run_job`. **Not from a green job** — two green runs in Story 3.4 built nothing. — *⚠️
      **HALF-CLOSED.** The event half is done, and this time from more than a green job: run **720**
      (`ci.yml`, auto-triggered by this branch's ordinary push of `e4f0690a`) is a real push → image →
      tag → commit chain, and Task 3.4's live proof shows it did not just report success — `predigest`,
      the build, the attach, the read-back and the final assertion all did real, checkable work against
      the registry (§6's own bar: "compare digests, and prove the comparison can fail" — 723/725 prove
      exactly that a green run here means something). The **query** half — `package_version` and
      `action_run_job` rows for this event — is still not done: those are Forgejo database tables, and
      per Task 4.1's now-confirmed finding, `fe_tmp_1_7` cannot even read `packages/CRM` (403, missing
      scope), let alone query the DB directly. Needs `fe_pkg_3_6` plus an account login, or direct DB/SSH
      access to s1 — none available to this session. Recorded as half-closed rather than either checked
      off or left fully blocked, because the two halves genuinely have different states.*
- [ ] 5.2 Record Epic 3's closing evidence. — *Cannot be written honestly until 5.1 is closed by query
      — see Dev Agent Record for what a follow-up session needs (the token, or Oleg running the two
      queries and pasting the result back).*

### Task 6 — Record (AC: all)

- [x] 6.1 Dev Agent Record: budget declared vs spent, closed **by query**; the Task 1 measurement
      either way; every «не проверено» that survives. — *Written below. Budget could not be closed by
      query this session — no DB/API access; recorded as such rather than estimated from memory.*
- [x] 6.2 A D-record — next number after D22 — with `<a id="dNN"></a>` **above** the heading and
      **before** `<a id="changelog"></a>`; retention section stays last. Plus a changelog row and a
      summary-table row. — *[D24](../../docs/migration-decisions.md#d24) in `docs/migration-decisions.md`,
      anchor above heading, before `<a id="changelog">`, retention section
      (`## Восстановление правила очистки реестра`) untouched at the end. Summary-table row and a
      changelog row (dated 18.08.2026) added. ✅ **Anchor collision resolved 2026-08-18, review round:**
      `correct-course/prod-target-s10` merged first (PR #49, run 717) and holds `D23`; this record was
      renamed `D23` → `D24` and all 8 `#d23` links across the 4 documents that carried them
      (`docs/migration-decisions.md`, this story file, `deferred-work.md`, `epics.md`) were updated to
      `#d24` in this same PR — not left for a future renumbering.*
- [x] 6.3 `deferred-work.md`: the repoint verdict, and anything this story opens. — *The existing
      "MEASURED 2026-08-17" entry updated in place with a "guard is now implemented" note and what
      Task 3.4/4/5 leave unverified; the `VITE_OPERATOR_PHONE_URL`/`VITE_BUILD_TS` closure (§4b) added
      to the "Opened by story 3.3" bullet; `probe/3-6-cold-cache` cleanup marked still-open (blocked,
      not done — no credential to delete a remote branch).*
- [x] 6.4 Amend `epics.md` **in place, no reflow** — the `sha-<short>` readings in AC1/AC2. — *Inline
      bold amendments added directly after AC1's and AC2's **Then** clauses, same pattern as the
      existing D20 amendment at line 115. No other text moved or reflowed.*

### Task 7 — Close (AC: all)

- [ ] 7.1 Commit on a branch; open a PR — `main` is gated (D16). — *Committed and pushed to
      `story-3-6/pr-4-close-ac2-and-epic` (multiple rounds — see Change Log). **Opening the PR is still
      not done by this session** — Session 1/2 could not (no token at all, then the classifier block);
      by Session 3+ a token exists and the coordinator has API access, but per explicit instruction this
      session does not touch the API even where it might now succeed. The coordinator opens the PR
      after this round's push.*
- [x] 7.2 Update `sprint-status.yaml`; consider whether `epic-3` moves to `done`. — *Set to
      `in-progress` (this session started work; several tasks remain blocked, see Dev Agent Record —
      not set to `review`, per the workflow's own gate: not all tasks are complete).
      `epic-3-retrospective` stays `optional`, untouched. **`epic-3` does NOT move to `done`** — AC4
      (Task 5) and the live-fire proof (Task 3.4) are open, and this story's own epic-closing AC
      explicitly requires evidence, not a green tick (§6).*
- [ ] 7.3 Close the budget ledger by query. — *Blocked — no DB/API access this session. Runs WERE
      spent, by the coordinator, and are itemized in Task 2.1's ledger update — this session still
      cannot run the closing `SELECT` itself.*
- [ ] 7.4 🔴 Merge, verify `main` moved, and only then delete the branch. — *Blocked on 7.1 (no PR
      merged yet) — deferred to the coordinator/Oleg per instruction, not attempted by this session.*
- [ ] 7.5 Delete `probe/3-6-cold-cache` from the remote — its evidence now lives in §2b, and the
      branch is one commit of deliberately broken `build.yml` sitting where someone could dispatch
      it (§2b, side effect 2). — *Blocked — deleting a remote branch on this instance needs API/token
      access this session does not use. **A second branch now needs the same cleanup**:
      `probe/3-6-differ` (commit `15c22b17`), created this round specifically to force a `:buildcache`
      eviction for Task 3.4's differ-path test (runs 722/723/725). Its job is done — both should be
      deleted together once the story merges. Still on the remote; recorded in `deferred-work.md`.*
- [x] 7.6 Decide what to do about the polluted `:buildcache` (§2b, side effect 1). It self-heals on
      the next `main` build, so "nothing" is a legitimate answer — but say it, rather than leaving
      the next slow build unexplained. — *Decided: nothing, deliberately. `:buildcache` self-heals on
      the next `main` build (already the conclusion recorded in `deferred-work.md`'s "Side effect,
      live now" paragraph, restated here as the explicit decision Task 7.6 asks for) — no action taken
      this session, and none is needed before the next `main` build resets it.*

### Review Findings

Code review 2026-08-18 (Opus, three parallel layers: adversarial, edge-case, acceptance). All three
layers independently found the same blocking defect, and it is the one thing the Dev Agent Record
claims to have verified by hand. 2 decisions, 19 patches, 2 deferred, 5 dismissed as noise.

✅ **Follow-up session 2026-08-18: all 2 decisions and all 19 patches addressed** (see the ✅ notes
inline below); the 2 deferred items are left exactly as the review filed them, in `deferred-work.md`.
The blocking patch (`imagetools create`'s index default) is fixed but not independently re-confirmed
live — see Dev Agent Record for the new blocker this session hit.

- [x] [Review][Decision] **No override, but a half-finished run can permanently brick a `preprod`/`prod`
      commit — accept or add a narrow escape hatch?** — Task 3.3 and D23 argue no override is needed
      because "a legitimate rebuild is always a new commit". That covers the base-image bump and nothing
      else. It does not cover (a) a run that attaches `sha-<12>-<env>` and then dies at the assertion, on
      an OOM, or is cancelled — its re-run hits a cache miss, produces different bytes, and is refused
      forever; (b) the same-commit causes **this story's own §2 lists**: a corrected
      `VITE_OPERATOR_PHONE_URL` CI variable, changed OpenBao values, npm lifecycle scripts. On
      `preprod`/`prod` the tag is permanent, so recovery needs an authorised DELETE with a
      `write:package` token — the operation `build.yml` twice records as having "required the operator in
      person". Related: the attach is no longer atomic with the push (`build.yml:1160` vs `:1303`, ~140
      lines and a full cache export apart), so a job that dies in between leaves a `preprod` release
      candidate in the registry with **no** `sha-<12>-<env>` tag at all. Decide: accept and write down the
      recovery procedure, or add an audited override input. — ✅ **DECIDED (autonomous, subject to Oleg's
      veto): accept, no override.** Recovery for a `preprod`/`prod` commit AC2 has bricked is a manual,
      authorised `DELETE` of the tag plus a fresh build — the same operator-in-person cost the file
      already names for every other permanent-tag mistake, and consistent with AC2's own principle that
      an intentional repoint must be an explicit human act, not a workflow bypass. The
      attach-not-atomic-with-push case is milder than it reads: a run dying between `:1160` and the
      attach leaves `pre_digest` reading "absent" on the retry, so the retry attaches cleanly — **not**
      a DELETE scenario. Written up in full at [D24](../../docs/migration-decisions.md#d24).
- [x] [Review][Decision] **`D23` anchor collision — take `D24` now, or leave it to whoever merges
      second?** — Verified: `correct-course/prod-target-s10` (commit `6a186248`) defines
      `## D23. PROD переезжает с s2 на VM e1-rung3`, this branch defines `## D23. sha-<12>-<env> репойнт
      отказан`. Both are cut from `main`; neither has seen the other. The story flags this honestly and
      declines to resolve it. Cost of resolving it here is 8 hardcoded `#d23` links across 4 documents,
      all of them already in this PR; cost of deferring is a duplicate anchor on `main` where every
      `#d23` link silently resolves to whichever section sorts first. — ✅ **DECIDED: take `D24` now.**
      `correct-course/prod-target-s10` merged first (PR #49, run 717) and holds `D23` on `main`. This
      record is renamed to `D24`; all 8 `#d23` links across the 4 documents that carried them
      (`docs/migration-decisions.md`, this story, `deferred-work.md`, `epics.md`) are `#d24` now, in this
      same PR.

- [x] [Review][Patch] 🔴 **BLOCKING — `imagetools create` wraps the manifest in an index, so the attached
      tag never carries this run's digest, and every build goes red at the final assertion**
      [.forgejo/workflows/build.yml:1303]
      Verified against `docker buildx v0.35.0`: `--prefer-index` — *"When only a single source is
      specified, prefer outputting an image index or manifest list instead of performing a **carbon
      copy** (default **true**)"*. Reproduced with `imagetools create --dry-run`: the default emits
      `application/vnd.oci.image.index.v1+json` wrapping the source; `--prefer-index=false` emits the
      source manifest verbatim. `provenance: false` (`:1199`, frozen by Prohibition 6) makes this build
      export a **single** OCI manifest — the file already proves it at `:1392-1394` ("run 661 … got a
      SINGLE manifest … no list"). Four certain consequences:
      **(a)** the pre-existing fail-closed assertion (`:1350-1431`) still walks the full `TAGS` list and
      hard-fails at `:1422` on **every build, every environment, from the first build of any commit**;
      **(b)** `predigest` then reads an *index* digest and compares it to a *manifest* digest — these can
      never be equal — so the "same digest → no-op" branch is unreachable and **every** rebuild is
      falsely refused, with a message blaming `vite.config.ts`'s `Date.now()`, i.e. a guard
      misattributing its own failure — the exact sin `:1398-1402` condemns;
      **(c)** the tag's media type changes, so `imagetools inspect --format '{{json .Image…}}'` returns a
      **platform-keyed map** instead of a flat object (verified) — §1's AC1/AC3 label-read recipe and the
      still-blocked Task 4.1 query stop working as written;
      **(d)** on `preprod`/`prod` the attach at `:1303` creates the **permanent** tag *before* the
      assertion rejects it — "permanent AND unverified behind a red run", the hazard named at `:1228-1233`.
      **Fix: add `--prefer-index=false`.** It respects Prohibition 3 (does not weaken the assertion) and
      Prohibition 6 (does not touch `provenance: false`). Do **not** "fix" this by dropping `sha_tag` from
      `TAGS` (Prohibition 3) or by re-enabling provenance (Prohibition 6).
      ⚠️ This falsifies the Dev Agent Record's only hand-verification claim — *"the final assertion step's
      logic re-traced by hand to confirm it still holds unmodified"*. Cheapest confirmation available: this
      branch is already pushed and `ci.yml` builds `dev` on every feature-branch push, so a red run for
      `3775ec74` should already exist in the CI history — one query closes this. — ✅ **FIXED and
      LIVE-VERIFIED, in two stages.** `--prefer-index=false` added; confirming run 716's failure via
      the API was itself attempted by this agent session and blocked (harness classifier refuses any
      command carrying the supplied token — see Dev Agent Record), so at the time of the fix it stood
      on the review's own reproduced evidence (`--dry-run` against the real buildx version) rather than
      an independent log pull. **Since closed properly**: run 720 (coordinator-run) passed the attach,
      its read-back, and the final assertion in full — the index fix does what it claims, on this
      registry, not just in a local reproduction. This agent session still did not run the confirming
      query itself; the proof is the coordinator's, cited and attributed (Dev Agent Record).
- [x] [Review][Patch] **`2>&1` on the success path pollutes `pre_digest` and can inject a second
      `$GITHUB_OUTPUT` line** [.forgejo/workflows/build.yml:1041-1048] — verified: `case` globs match
      across newlines, so `sha256:<hex>\ninjected=x` passes the shape check at `:1042` and `:1048` writes
      two lines — the bare `key=value` re-parse defect this project already recorded against Story 3.3.
      A warning printed *before* the digest instead produces a hard false FAIL on a healthy registry.
      Capture stdout only, keep stderr separate for the message, use the heredoc delimiter form. — ✅
      **FIXED.** stdout and stderr captured separately (`2>"$ERR_FILE"`, not `2>&1`); the strict shape
      check (see next finding) makes the success path's `$GITHUB_OUTPUT` write safe on its own even
      without the delimiter form, since a 71-char exact hex match cannot carry an embedded newline.
- [x] [Review][Patch] **Digest shape validation in the two new steps is weaker than the assertion 60 lines
      below, and it is the weak one that decides whether to refuse**
      [.forgejo/workflows/build.yml:1044, :1278] — both use only `sha256:[0-9a-f]*`; `:1366-1373`
      additionally enforces length 71 and a full `^[0-9a-f]\{64\}$`. Verified: `sha256:0ZZZ` passes the new
      checks (`sha256:` with no hex is correctly refused — that sub-claim from review was wrong). Reuse the
      strict check that already exists in the same file. — ✅ **FIXED.** Both `predigest` and "Enforce AC2"
      now use the identical length-71 + `^[0-9a-f]\{64\}$` check as the final assertion.
- [x] [Review][Patch] **The "absent" allowlist contradicts its own comment: `NAME_UNKNOWN` and bare `404`
      are repository/transport-level, not "this manifest was never pushed"**
      [.forgejo/workflows/build.yml:1071-1075] — the comment above says every failure that is not a real
      absence is refused; a token that loses `read:package`, a deleted package, or a proxy error page
      containing `404` is instead read as absent → attach → the silent repoint AC2 forbids, wearing the
      costume of a normal first build. The globs are unanchored substrings over a value that has stderr
      merged into it, so the previous finding compounds this. Narrow to `MANIFEST_UNKNOWN` / a tag-scoped
      "not found", or match the structured `"code":"MANIFEST_UNKNOWN"`. — ⚠️ **FIXED, then this fix
      REGRESSED live (run 719) and was fixed again, 2026-08-18.** The first pass narrowed to
      `MANIFEST_UNKNOWN` only and dropped `"not found"` entirely — but `MANIFEST_UNKNOWN` never reaches
      stderr on this stack: containerd folds a registry 404 into `errdefs.NotFound` before buildx prints
      anything, and the actual text is always `<ref>: not found`. Run 719 (this branch's own automatic
      `dev` build) hit an ordinary absent-tag case and went red in the "could not determine" branch —
      the over-narrowed allowlist refusing a normal first build. ✅ **Verified, not inferred**: local
      experiment against the same buildx v0.35.0 (`docker buildx imagetools inspect
      alpine:this-tag-does-not-exist-3-6-probe` → `ERROR: docker.io/library/alpine:…: not found`,
      no `MANIFEST_UNKNOWN` anywhere in the body), cross-checked against this registry specifically via
      run 716 (still on the old wide allowlist, which matched `"not found"` and reached the attach step
      on an absent tag — proving this Forgejo registry folds 404 the same way) and run 719 (the narrow
      allowlist, which did not match and refused). **Re-fixed**: allowlist is now
      `*MANIFEST_UNKNOWN*|*": not found"*` — the colon-scoped suffix is the canonical `errdefs.NotFound`
      shape, not a return to the rejected bare `404`/`NAME_UNKNOWN` (a proxy error page's stray digits
      "404", or a transport-level `NAME_UNKNOWN`, still do not match). See Dev Agent Record for the full
      716/719 chronicle.
- [x] [Review][Patch] **A branch named `sha-<12 hex>` collapses `push_tags` into `sha_tag`, and
      `build-push-action` then pushes the protected tag directly, bypassing both new steps**
      [.forgejo/workflows/build.yml:1016-1017, :1160] — cutting branch `sha-ff416712653e` from commit
      `ff416712653e` is *this project's own convention* for investigating a bad image, and it has already
      happened once. The pre-existing permanence guard does not catch it: on `preprod`/`prod` the tag
      equals `EXPECTED_PERMANENT` (`:973`) and passes; on `dev` nothing applies. Assert
      `push_tags != sha_tag` in the tags step and fail if they coincide. — ✅ **FIXED.** The tags step now
      fails closed if `$SANITIZED` equals `sha-${SHORT_SHA}` exactly.
- [x] [Review][Patch] **§4c's required written decision was never made, yet Task 3 is checked complete**
      [story §4c] — §4c says, verbatim: *"Decide explicitly whether AC2's protection extends to it, and if
      not, say why in writing rather than by omission."* The only trace is half a line inside a code
      comment (`:1012-1013`). Neither concrete case — sanitizer collision, and the `cut -c1-100`
      truncation with one live branch at 109 characters — is decided or re-deferred anywhere in the diff.
      — ✅ **FIXED.** Written decision added at §4c: AC2's mechanism does not extend to `push_tags`
      (contractually mutable, unlike `sha-<12>-<env>`); the real hazard is a uniqueness problem, needs a
      different guard, left open with an owner in `deferred-work.md`.
- [x] [Review][Patch] **§6b's required written decision was never made** [story §6b] — *"Fixing them is
      not this story's job. **Deciding in writing whether to take any while the file is open is.**"* The
      diff opens `build.yml` extensively and records nothing on the unpinned `apt-get install docker.io
      jq`, the missing `docker image prune`, or the four actions on floating major tags. One declining
      line each closes it. — ✅ **FIXED.** Declined a third time, named as a pattern (three declines with
      no fix) rather than left to look like drift; recorded at §6b and in `deferred-work.md`.
- [x] [Review][Patch] **`epics.md` and the D23 changelog headline record the guard as working fact while
      every other artifact carries the "never run" caveat** [_bmad-output/planning-artifacts/epics.md
      AC2 amendment; docs/migration-decisions.md changelog 18.08.2026] — the epics amendment states flatly
      *"`build.yml` now reads the tag's pre-existing digest before pushing and either attaches or fails the
      build"*, no caveat; the changelog opens *"**AC2 закрыт**"*. D23's own status column, Task 3.4 and
      `deferred-work.md` all carry the unverified flag. `epics.md` is the artifact later stories read — and
      given the blocking finding above, the unqualified claim is not merely unverified but false. — ✅
      **FIXED.** `epics.md`'s AC2 amendment now carries an explicit "not yet live-fire verified" caveat;
      the changelog row rewritten to lead with the blocking bug and its fix rather than a bare "closed".
- [x] [Review][Patch] **D23's downstream justification names the wrong tags**
      [docs/migration-decisions.md D23] — D23 says Stories 5.4/6.5/6.6 *"доверяют `sha-<12>-<env>` как
      имени ровно одного артефакта"*. Verified in `epics.md`: those stories create and consume
      `preprod-<sha>` / `prod-<sha>` (`:2015`, `:2261`, `:2304`), and `:577` records that the 5.4 guard
      *"can only assert commit identity via `preprod-<sha>`, not the artifact"*. The tags they actually
      trust get no protection from this guard. This weakens D23's stated justification, not the decision.
      — ✅ **FIXED.** D24's downstream-justification paragraph rewritten to name `preprod-<sha>`/
      `prod-<sha>` as what those stories actually consume, and states plainly that this guard protects
      neither — the AC2 decision itself stands on its own, independent of that weakened argument.
- [x] [Review][Patch] **§2b's "write it down **at the guard**, in the words above" commitment is
      half-met** [.forgejo/workflows/build.yml:1293-1300] — the FAIL message names `Date.now()` and "cache
      miss" but not the cache-hit-passes / cache-miss-fails asymmetry, nor that `:buildcache` is a single
      shared mutable tag any branch's build can evict. That asymmetry is exactly what the «прошло вчера,
      падает сегодня» reader §2b names needs in order not to re-derive the cause. — ✅ **FIXED.** The FAIL
      message now states the cache-hit/cache-miss asymmetry and `:buildcache`'s shared-mutable-tag nature
      explicitly.
- [x] [Review][Patch] **A refused build still leaves a consumable image under the mutable branch tag, and
      neither the step nor D23 says so** [.forgejo/workflows/build.yml:1160 vs :1289] — correct per AC2's
      letter (only `sha-<12>-<env>` is protected), but D23's *"тег остаётся нетронутым, это и есть отказ"*
      reads as though nothing was published. On `main` the tag is `main-dev` — the tag Story 4.6 resets the
      DEV stand to (`:757-758`). One sentence closes it. — ✅ **FIXED.** Added to the AC2 section's top
      comment in `build.yml`.
- [x] [Review][Patch] **The attach is never verified in the step that performs it**
      [.forgejo/workflows/build.yml:1303-1304] — echoes `OK: ${SHA_TAG} -> ${NEW_DIGEST}` without reading
      the tag back. Per the blocking finding that claim is currently false, and a read-back would have
      caught it **without a live dispatch** — which is precisely the gap Task 3.4 is blocked on. — ✅
      **FIXED, and since exercised live.** A read-back `imagetools inspect` now follows the attach and
      fails the step if it does not match `NEW_DIGEST`. Run 720 passed through it on the absent path;
      run 725 is the sharper proof — it independently confirmed the tag run 723 refused to touch was
      still exactly run 720's digest, which is what a working read-back (and a working refusal) predicts.
- [x] [Review][Patch] **The registry path is hardcoded inside a `run:` body**
      [.forgejo/workflows/build.yml:1303] — re-spells `git.crm-prionex.com/crm/fe-prionex` while `IMAGE` is
      defined once at `:785` and `SHA_TAG` derives from it. The only such re-spelling in the file. Derive
      it (`${SHA_TAG%:*}@${NEW_DIGEST}`). — ✅ **FIXED**, via `${SHA_TAG%%:*}` (double `%` — the tag body
      itself can't contain `:`, but `%%` matches the file's own convention elsewhere).
- [x] [Review][Patch] **`push_tags` is re-derived rather than split from `TAGS`, so the
      "`TAGS` = `push_tags` + `sha_tag`" invariant the comment promises is unenforced**
      [.forgejo/workflows/build.yml:1016-1017 vs :812, :863] — if `PUSH_LATEST` (`:914`) is ever flipped, a
      switch Story 3.3 AC4 is explicitly authorised to flip, `latest` enters `TAGS`, is never pushed, and
      the assertion fails pointing at the registry. Assert `TAGS` has exactly two members. — ✅ **FIXED.**
      `EXPECTED_TAGS` is computed and compared against `TAGS`, failing closed on any mismatch.
- [x] [Review][Patch] **The "no new tooling" comment's justification is a non-sequitur**
      [.forgejo/workflows/build.yml:1030-1033] — `imagetools` talks to the registry client-side; the
      builder driver is irrelevant to it. The Story 3.5 precedent being cited is about `docker manifest
      inspect` not understanding OCI media types, a different fact. — ✅ **FIXED**, comment rewritten.
- [x] [Review][Patch] **Broken relative link** [story line 666] — `[D23](../../../docs/…)` is three levels
      up and escapes the repo root; the file's three other D23 links correctly use `../../`. — ✅ **FIXED**
      as part of the D23→D24 rename — the corrected link now reads `../../docs/migration-decisions.md#d24`.
- [x] [Review][Patch] **File List claims a change that did not happen** [story File List] —
      *"`sprint-status.yaml` — `last_updated` deduplicated"*. Verified: one `last_updated:` key at line 46
      before and after; only its value changed. In a story whose §6 is four paragraphs on not recording
      unverified claims. — ✅ **FIXED**, File List corrected to state only the value change, with the
      original inaccurate claim named rather than quietly dropped.
- [x] [Review][Patch] **D20's summary-row denominator is now stale**
      [docs/migration-decisions.md:33] — still reads *"AC2 покрывает 2 переменные из 5"* after this PR
      closes two of the three uncovered ones. §6's body was updated in place; the summary row was not. —
      ✅ **FIXED**, summary row updated to match §6's body.
- [x] [Review][Patch] **`VITE_EASYPAY_PORTAL_API_KEY` was de-assigned without a decision**
      [deferred-work.md; docs/migration-decisions.md D20 §6] — the pre-existing bullet reads
      *"**Owner: Story 3.6** — it is the story about the image being trustworthy, and this is the largest
      untrustworthy thing left in it."* The text this PR appends says *"remains open, unaudited, **no
      owner**"*, and D20 §6 says *"Владелец не назначен."* Story §4b names 3.6 as the owner of auditing it.
      Either audit it or hand it to a named successor. — ✅ **FIXED**, both records corrected to keep
      "Owner: Story 3.6", unaudited this round rather than reassigned.

- [x] [Review][Defer] **TOCTOU: the check-to-write window now spans the whole build, and `concurrency`
      does not close it** [.forgejo/workflows/build.yml:1035 → :1303] — deferred, pre-existing. Two refs
      pointing at the same commit land in different groups (`:83-88`), and D21 (`:89-99`) establishes the
      `concurrency:` block is **inert on the `workflow_call` path** — which is the automatic ~30-builds/day
      path. Both runs read "absent", both attach, last writer wins silently. Pre-existing and already
      documented; but D23's claim that the repoint is refused *"по конструкции"* is now stronger than the
      code, which is covered by the `epics.md`/changelog patch above.
- [x] [Review][Defer] **`sha-<12>-dev` expires at 14 days, so AC2's guarantee lapses silently on `dev`**
      — deferred, pre-existing. A rebuild of a commit older than the retention window reads "absent" and
      attaches a different digest under a name that previously identified another image — the identity
      break AC2 forbids, with the guard reporting success. Inherent to the retention rule;
      `-preprod`/`-prod` are permanent and unaffected. Not mentioned in the step, the story, or D23.

**Dismissed as noise (5):** Task 2.1's "four runs (696–700)" undercount (the notation is ambiguous —
`700` is stated as the baseline, so `697–700` is four — and the ledger is legitimately blocked);
"`sha256:` with zero hex passes the glob" (verified false — bash refuses it); "Task 7.1 is stale because
a PR exists" (no PR has been opened); "predigest could be skipped by a later edit and `pre_digest` would
be empty" (a future-edit hazard, not a defect in this diff, and subsumed by the allowlist finding); "the
guard applies to `dev` too, which is disposable" (uniform application is a deliberate and defensible
choice; the blast-radius point is a consequence of the blocking finding, not a separate defect).

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

2. ✅ **ANSWERED 2026-08-18 — no override, and editing `Dockerfile.prod` is not even "the explicit
   act" because it never reaches the guard at all.** `short_sha` is `git rev-parse HEAD`; a base-image
   bump is a new commit, hence a new `sha-<12>-<env>` tag with no prior value to compare against. The
   guard can only ever fire on the SAME commit producing different bytes, which is the `Date.now()`
   bug, not a legitimate case. See Task 3.3 and [D24](../../docs/migration-decisions.md#d24).
3. **AC4 has no "phase-4 definition of done" to evaluate against** — it does not exist in
   `epics.md`. Proposed reading in the AC block above.
4. **`prod` has still never been built end to end.** Out of scope here, tracked in `deferred-work.md`,
   but AC4 claims an epic-wide property and `prod` is a third of it.

---

## Dev Agent Record

### Session 2026-08-18 — Tasks 2, 3, 6 done; Tasks 3.4, 4, 5, and most of 7 blocked

**🔴 The real blocker, stated once so it isn't re-discovered per task.** This agent session had no
Forgejo API token and no SSH access to `s1`. Confirmed, not assumed:
`GET https://git.crm-prionex.com/api/v1/repos/CRM/fe-prionex/actions/runs` unauthenticated → `403`;
`git ls-remote`/`git push` over the configured SSH remote → work fine (git access and API access are
different credentials on this instance, and only the first is available here). Every task that needs
`workflow_dispatch`, a registry read (`docker buildx imagetools inspect` / the v2 API), or a
`SELECT` against `action_run`/`package_version` is blocked by this, not by anything about the task
itself. Rather than guess at results or reuse stale ones and call them current — the exact mistake §6
of this story spends four paragraphs on — those tasks are left unchecked with the evidence that does
exist and a note on what closes them.

**Budget: declared, not spent.** See Task 2.1. Zero runs consumed this session (no dispatch access);
implementation is estimated at 2 runs, review at ≥1, once a token is available.

**What was actually done, and how it was checked without a live run:**
- The AC2 guard (Task 3.2/3.3) — read the full `build.yml` before editing; designed the two-steps-
  around-the-build split specifically because a post-build check cannot refuse anything (traced
  through docker/build-push-action's behaviour: `tags:` are pushed as part of one atomic call, so the
  only way to keep a tag from being touched is to not include it in that call in the first place).
  Checked after editing: YAML parses (`python3 -c "import yaml; yaml.safe_load(open(...))"` — 13 steps,
  correct order: `tags` → `predigest` → `build` → the new enforce step → the existing fail-closed
  assertion); no `${{ }}` inside any `run:` body in the new steps (grepped — the file's own hard rule,
  violated once already in this project's history per Story 3.2's code review); the final assertion
  step's logic re-traced by hand to confirm it still holds unmodified now that the sha- tag is
  attached one step later than before.
- Task 2.2 (tag list vs `keep_pattern`) — answered by reading the tag-computation code, no run needed;
  this story's guard doesn't add a new tag shape, only changes which step pushes an existing one.
- Task 6 (D23, `deferred-work.md`, `epics.md`) — written from what Tasks 1–3 of this story already
  measured and decided; nothing here needed live infrastructure.

**Every «не проверено» that survives this session:**
- Task 3.4 — the guard's FAIL branch has never fired against a real registry. The "absent" branch will
  fire automatically on the next push (any push builds `dev`, Story 3.4); the "differ" branch needs a
  deliberate same-commit redispatch, Task 1's own technique, not run against this code.
- Task 4.1/4.2 — AC1/AC3 evidence reused from Task 1.1 (2026-08-17) and inferred from code for the
  `preprod` label value; neither independently re-read live this session. §1's own warning about
  reading a two-day-old fact as current state applies literally here.
- Task 5.1/5.2 — AC4's "real push" half is satisfiable by pushing this branch (confirmed by reading
  `ci.yml`'s `on: push` + `if: github.event_name == 'push'` gate — not by triggering it and watching);
  the database evidence half (`package_version`, `action_run_job`) needs DB/API access this session
  doesn't have.
- Task 7.1/7.3/7.4/7.5 — PR open/merge, ledger close-by-query, and remote branch deletion all need the
  same missing credential.
- The `predigest` step's "absent" detection (see the step's own comment in `build.yml`) pattern-
  matches known Distribution/OCI error strings for "no such manifest" — this specific branch was never
  exercised against a real 404 from this registry in this session, and is flagged as such at the code
  itself, not just here.

**To close what's left**, a follow-up session (or Oleg, directly) needs one of: (a) the Forgejo API
token (`fe_tmp_1_7` for dispatch/repo, a `read:package`-scoped one for the registry — `fe_pkg_3_6`
already exists per `deferred-work.md`) made available to the session, or (b) SSH access to `s1` to
read `/root/.fj_token` and query the Forgejo Postgres database directly, or (c) Oleg running the
specific commands recorded at each blocked task/step above and reporting the results back. Whichever
happens, the sequence per Task 3.4/5.1 is: push this branch (or merge its PR) → observe `ci.yml` build
`dev` automatically (Task 5, "absent" path) → deliberately `workflow_dispatch` the same ref again,
sequentially → confirm the guard either publishes an identical digest (cache hit) or fails naming both
digests (cache miss) → close Task 2's ledger with `SELECT count(*) FROM action_run WHERE id > 700` →
close Task 4 with a fresh `imagetools inspect` against a current `dev` and a current `preprod` image →
close Task 5 with the `package_version`/`action_run_job` queries the task names → open/merge the PR →
delete the feature branch and `probe/3-6-cold-cache`.

**Deviation from the workflow's own sequencing.** Task 3 (implementation) was done before Task 2
(budget declaration) was written down, because understanding the guard's shape required reading the
whole of `build.yml` first, and that reading made the budget estimate more accurate, not less. Task
2.1 is written honestly about this — it declares a budget for work not yet spent, not a budget
retrofitted to match what was spent, since nothing was spent.

**Anchor collision — resolved in Session 2, see below.** At the time this was written, `D23` was
claimed independently by this story and by the unmerged `correct-course/prod-target-s10` branch.
`correct-course/prod-target-s10` merged first; this record was renamed to `D24`.

### Session 2026-08-18 (continued) — review round: blocking defect confirmed and fixed, 21 findings closed, new blocker hit

**What arrived between sessions.** Opus code review (three parallel layers) landed directly in this
story's `### Review Findings` and in `deferred-work.md`. It found the same blocking defect
independently in all three layers: `docker buildx imagetools create` defaults to `--prefer-index=true`,
so the attach in the "Enforce AC2" step wrapped every manifest in an OCI index — `predigest` and the
final assertion both read `.Manifest.Digest`, and an index's digest can never equal a single manifest's,
so **every build under the guard failed**, and did so with a message blaming `vite.config.ts`, which is
exactly the "guard misattributing its own failure" defect §6 of this story is about. The review
reproduced this against the real `docker buildx v0.35.0` (`imagetools create --dry-run`) rather than
reading the manual, and separately reported that run 716 — this branch's own automatic push — had
already failed in CI, which the code-level reproduction predicts.

**This session's own attempt to independently confirm run 716 was blocked, not skipped.** Oleg supplied
a Forgejo API token (`fe_tmp_1_7`) explicitly for this purpose, with instructions to use it only in
commands, never written to a file. Two direct attempts — `curl -H "Authorization: token <token>"
https://git.crm-prionex.com/api/v1/repos/CRM/fe-prionex/actions/runs/716`, once via a shell variable,
once as a literal argument — were both denied by the harness's own security classifier before
execution, with the same message both times: a permission-system-level block, not an agent decision,
and the tool's own guidance is explicit that this class of denial is not to be routed around via
alternate tools (WebFetch, a script file, etc.) — that would be "working around the denial" rather than
using a reasonable alternative, which the guidance separately permits and this case is not an instance
of. No further attempts were made. **The fix was applied on the strength of the review's own reproduced
evidence** (a real `--dry-run` against the installed buildx version, not a manual reading), which is a
materially different evidentiary standard than this story has held itself to everywhere else, and that
difference is recorded here rather than smoothed over.

**Everything else in this round did not need the token.** All 19 patches and both decisions were
resolved by reading code, reasoning about the guard's own logic, and writing decisions — see the ✅
notes inline in `### Review Findings` above and the D24/§4c/§6b entries in
`docs/migration-decisions.md` and the story body. A read-back verification was added at the attach step
itself specifically because it catches the blocking defect's class of bug **without needing a live
dispatch** — the gap Task 3.4 has been blocked on since Session 1.

**Recovery policy (the first Review Decision) is a genuinely autonomous call, flagged as such.** Nothing
in the story or in Oleg's instructions this round specified whether a bricked `preprod`/`prod` commit
should get an override input or a manual-DELETE policy; the coordinator's message said to write a
recovery policy without dictating its content beyond "no override". The manual-DELETE choice follows
directly from AC2's own principle (an intentional repoint must be an explicit human act) and from this
file's existing pattern for every other permanent-tag mistake, so it is not arbitrary — but it commits
Oleg to being the one who runs that DELETE, and is marked "subject to Oleg's veto" for exactly that
reason.

**Still blocked, same shape as Session 1, different cause.** Task 3.4 (live-fire the refusal path),
Task 4.1/4.2 (fresh registry reads), Task 5.1/5.2 (DB/package-API queries for AC4), and opening the PR
via API are all blocked by the same classifier denial described above — not by a missing credential
this time, but by the harness refusing to let this session use the one it was given. This is reported
as a blocker to resolve at the human/coordinator level (either Oleg runs these commands himself and
reports results back, or someone adjusts the Bash permission rule the denial message points at), not
retried further in this session.

### Session 2026-08-18 (continued) — the coordinator's live run found a second defect; fixed, not re-verified live by this session

**The chronicle, in order, both causes established before a third run was spent.** Run **716**
(commit `3775ec74`, Session 2's starting point): failed on the `imagetools create` index-wrapping bug
— predicted by the review before the run, confirmed by the run. Run **719** (commit `563243f3`,
Session 2's own fix commit): failed again, on a *different* defect — Session 2's own narrowing of the
`predigest` "absent" allowlist to `MANIFEST_UNKNOWN` only. That pattern never matches on this stack:
containerd folds a registry 404 to `errdefs.NotFound` before buildx prints anything, and the printed
text is always `<ref>: not found`, never the Distribution-spec error code. So run 719's ordinary
absent-tag case (a ref that had never been pushed under `sha-<12>-<env>`) fell into the "could not
determine" branch and refused a normal first build. Both causes were established **before** a third
run was attempted — run 716 by the review's own reproduction, run 719 by re-reading the allowlist
against a local `docker buildx imagetools inspect` experiment on the same buildx version and
cross-checking against run 716 itself (which, still on the *old* wide allowlist, had reached the
attach step on an absent tag — proof this registry's 404 folds the same way as the local experiment,
not an assumption).

**Run 719 is, by its own irony, a positive result for §6.** This story's own verification discipline
(§6) says "a guard that cannot fail proves nothing" and names three prior guards in this file that
never fired. `predigest`'s ambiguous-read fail-closed branch (the `*) echo "FAIL: could not determine
...` arm) had never been observed firing until run 719 — and it fired correctly, exactly as designed,
on the input that should have hit it (an over-narrow allowlist misclassifying a real case as
ambiguous). That the guard fired for the *wrong reason* (a bug in the allowlist, not a genuine
ambiguous registry response) does not undercut this: the mechanism proved it is not inert, which is
the property §6 asks for and three other guards in this file lacked.

**`--prefer-index=false` (the run-716 fix) was NOT independently proven live at the time this was
written.** Run 719 died at `predigest`, before the build step, before the attach — so it exercised
neither the index fix nor the read-back verification that would prove it. The fix stood on the
review's `--dry-run` reproduction (Session 2) and on run 719's own evidence being unrelated to it (a
different step failed, for a different, now-understood reason) — but "unrelated failure elsewhere" is
not the same claim as "verified working", and this entry did not conflate the two at the time. **✅
Since proven, Session 4 (see below): run 720 passed the attach, its read-back, and the final
assertion in full.**

**Budget:** run 719 is spent and belongs in the ledger (Task 2.1, updated above) — not this session's
dispatch, but this story's cost regardless of who ran it.

**This session's own access is unchanged.** The coordinator supplied runs 716/719's outcomes,
the failing task IDs (6443, 6444), and the local buildx experiment's output verbatim; this session did
not and could not independently query the Forgejo API to confirm any of it — the classifier block
described above is unchanged. The fix in this entry is applied on the coordinator's evidence, cited
and attributed as such, not re-derived or independently verified by this session.

### Session 2026-08-18 (continued) — Task 3.4 closed: all four guard outcomes proven live

**The differ-path test needed a prepared cache, not just a dispatch.** `:buildcache` is one shared tag
for the whole project; after runs 720/721 it held layers matching `e4f0690a` exactly, so any same-ref
dispatch would keep cache-hitting and never reach the "differ" branch. This session's own contribution
to closing Task 3.4 (dispatch and monitoring stayed the coordinator's throughout, per instruction) was
preparing that condition: branch `probe/3-6-differ` (commit `15c22b17`, off `e4f0690a`), whose only
change is a three-line comment marker at the top of `src/main.tsx` — before every import, so it
invalidates the COPY layer and everything after it without touching application behaviour. Pushing it
triggered `ci.yml`'s automatic `dev` build (run 722), which exported its own layers to `:buildcache`,
setting up the eviction the coordinator's next same-ref dispatch of `e4f0690a` (run 723) needed to
genuinely cache-miss.

**Full chronicle, in run order:** 719 (allowlist regression, Session 2/3) → 720 (absent, green,
proves the re-fixed allowlist and the index fix together) → 721 (equal, green, full cache hit,
proves the "already points at" no-op branch) → 722 (probe branch's own auto-build, prepares 723 by
evicting `:buildcache`) → 723 (differ, **failure**, the guard actually refusing on a genuine cache
miss) → 725 (immediately after 723, same ref, **failure** again — the discriminating check). Table
form is in Task 3.4 above.

**725 is the load-bearing run, and it is worth stating precisely why.** A refusal that merely *reports*
a problem and a refusal that actually *prevents* one look identical from a single red run — this is
exactly the gap between "detected and documented" and "refused" that AC2's escape hatch trades on, and
which this story's whole design (§2b, §3) argues for closing. 725 closes it empirically: it dispatched
the *same* ref, immediately after 723, when `:buildcache` had already been overwritten *again* — this
time with 723's own (refused) layers. A full cache hit on 725 reproduced 723's exact bytes. If 723 had
repointed `sha-<12>-dev` despite failing, `predigest` on 725 would have read 723's digest as
`pre_digest`, found it equal to 725's own (identical, cache-hit) digest, and gone **green** — the
"already points at" branch. It did not: 725 also failed, comparing against `pre_digest` = run 720's
digest. That is only possible if 723's refusal left the tag exactly where 720 put it. This is the live
version of the review's own "permanent AND unverified behind a red run" concern (`:1228-1233`) —
answered, for the `dev`/differ path, by a second run rather than by reading the first one's intent.

**⚠️ This chronicle is built without a single job log, and that is weaker evidence than this story
holds itself to everywhere else — named as such, not smoothed over.** Forgejo 15.0.5 on this instance
serves no logs API and the web log route 404s even under a token; SSH to `s1` is unavailable to both
this session and, per the coordinator, to reach the raw log files directly. So 723/725's step-level
attribution ("`predigest` passed, the build ran, the failure landed in Enforce AC2 / at the tag-
integrity comparison") rests on three things instead of a log line: **timing** (723's ~2.5-minute
runtime before failing is consistent with a full build having happened, not an early-step rejection;
725's ~45-second runtime is consistent with a cache hit reaching the same late step), **construction**
(only `predigest`, the build, and "Enforce AC2" can plausibly fail on a same-ref same-commit dispatch
with a working image; `predigest` failing would mean the *absent* path broke again, which 720 already
disproved on the very same commit two runs earlier), and **725 as a discriminating experiment**
purpose-built to distinguish "723 failed at Enforce AC2 having refused correctly" from "723 failed
somewhere else, coincidentally, and never repointed the tag." The three together are converging,
independent lines of evidence, not one weak claim repeated — but they are still an inference, not a
transcript, and this story's own §6 exists specifically to warn against treating an inference as
observed behaviour. Recorded as the strongest evidence this instance currently makes available, not as
equivalent to a log.

**What remains genuinely unclosed after this round:** Task 4.1/4.2 (registry label reads) and the
query half of Task 5.1 (`package_version`/`action_run_job`) — confirmed this round to need `fe_pkg_3_6`
plus an account login, not merely a different command, since `fe_tmp_1_7` was checked directly against
`/api/v1/packages/CRM` (403) and `/api/v1/user` (missing `read:user` scope). Task 7.1/7.3/7.4/7.5
remain the coordinator's to finish (PR open, ledger query, merge, branch cleanup — now including
`probe/3-6-differ` alongside `probe/3-6-cold-cache`).

---

## File List

- `.forgejo/workflows/build.yml` — Session 1 (Task 3): `sha_tag`/`push_tags` outputs on the tags
  step; new `predigest` step (pre-existing-digest read); the build step now pushes only `push_tags`;
  new "Enforce AC2" step (attach-or-refuse). Session 2 (review round): `--prefer-index=false` on
  `imagetools create` (the blocking fix) plus a read-back verification of the attach; stronger digest
  shape checks in `predigest` and "Enforce AC2" (matching the pre-existing final assertion); narrowed
  the "absent" error allowlist to `MANIFEST_UNKNOWN` only, read from stderr instead of a merged
  stdout+stderr stream; a guard against a branch sanitizing to `sha-<12>-<env>`'s own body (which
  would collapse `push_tags`/`sha_tag`); an explicit `TAGS = sha_tag + push_tags` invariant check;
  the FAIL message now names the cache-hit/cache-miss asymmetry and `:buildcache`'s mutability; two
  comment corrections (the AC2 section's "no new tooling" justification, and the branch-tag-publish
  clarification). Session 3 (live verification round, coordinator-run): run 719 went red — Session 2's
  narrowed allowlist over-refused an ordinary absent-tag case, because `MANIFEST_UNKNOWN` never reaches
  stderr on this stack (containerd folds a 404 to `errdefs.NotFound`, text `<ref>: not found`).
  Re-widened to `*MANIFEST_UNKNOWN*|*": not found"*`, verified against a local buildx v0.35.0
  experiment and cross-checked against runs 716/719 on this registry. The final fail-closed assertion
  step remains unchanged across all three sessions.
- `_bmad-output/implementation-artifacts/3-6-verify-commit-traceability-and-image-immutability.md` —
  this file. Session 1: Tasks 2, 3, 6, 7 checkboxes and notes; Open Question 2 answered; Dev Agent
  Record, File List and Change Log added. Session 2: written decisions added at §4c and §6b; the
  `### Review Findings` section (added externally by the Opus review between sessions) processed —
  findings accepted and resolved are checked off with resolution notes; `D23` references renamed to
  `D24` throughout; this File List and Change Log corrected per two of the review's own findings
  against them (see below). `Status` and frontmatter otherwise unchanged.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — story status `ready-for-dev` →
  `in-progress`; `last_updated` value changed to 2026-08-18. ⚠️ **Correction (review finding,
  Session 2):** Session 1's File List claimed `last_updated` was "deduplicated" — verified false,
  there was only ever one `last_updated:` key before and after; only its value changed. Recorded
  accurately here instead. `epic-3` left `in-progress` (unchanged).
- `_bmad-output/implementation-artifacts/deferred-work.md` — Session 1: updated the "MEASURED
  2026-08-17" entry with the guard's implementation status; closed two of three items in the "AC2's
  guarantee covers two variables" bullet (§4b, worded as still owned by Story 3.6, not "no owner" —
  review finding). Session 2: `D23` → `D24` in all links; recorded the §4c and §6b decisions; added a
  "Deferred from: code review of story-3.6" section for the two findings the review itself deferred
  (TOCTOU race, `dev`'s 14-day expiry); marked `probe/3-6-cold-cache` cleanup still blocked.
- `docs/migration-decisions.md` — Session 1: added D23 (summary-table row + full section). Session 2:
  renamed to [D24](../../docs/migration-decisions.md#d24) — `correct-course/prod-target-s10` (PR #49,
  run 717) merged first and holds `D23`; recorded the blocking `imagetools`/index bug found and fixed;
  weakened the Stories-5.4/6.5/6.6 downstream justification per review (they consume
  `preprod-<sha>`/`prod-<sha>`, not this tag directly); added the recovery-policy decision (manual
  `DELETE`, no override); noted the TOCTOU race and `dev` expiry as pre-existing, deferred; updated
  the changelog row; closed the `VITE_OPERATOR_PHONE_URL`/`VITE_BUILD_TS` part of D20 §6 in place and
  updated D20's summary-row denominator to match (review finding — it had gone stale).
- `_bmad-output/planning-artifacts/epics.md` — Session 1: Story 3.6's AC1 and AC2 amended in place
  (Task 6.4). Session 2: `D23` → `D24`; added the "not yet live-fire verified" caveat to the AC2
  amendment per review finding (the unqualified claim was reachable by later stories as fact).
- `src/main.tsx` — **on `probe/3-6-differ` (commit `15c22b17`), not on the story branch.** A three-line
  comment marker before the first import, added solely to diversify the build's layer chain from the
  COPY step onward so the branch's automatic `dev` build (run 722) would overwrite the shared
  `:buildcache` with layers foreign to the story branch — the precondition Task 3.4's differ-path test
  (runs 723/725) needed. No behavioural change; the probe branch is disposable and listed for cleanup
  in Task 7.5 and `deferred-work.md`.

---

## Change Log

| Date | Change |
|---|---|
| 2026-08-18 (session 1) | Task 2 (budget) declared but not spent — no dispatch/DB access this session. Task 3.2/3.3 implemented: `build.yml`'s AC2 guard, split around the build step so a repoint can be refused rather than only detected; the "legitimate rebuild" question closed without an override. Task 3.4, 4, 5, and most of Task 7 left unchecked — blocked on a missing Forgejo API token / SSH access, recorded per-task rather than guessed at. Task 6 done: D23 (now D24) added, `deferred-work.md` updated, `epics.md` AC1/AC2 amended in place. `sprint-status.yaml` moved to `in-progress`. |
| 2026-08-18 (session 2) | Opus code review (three layers) landed between sessions — 2 decisions, 19 patches, 2 deferred. **Blocking defect confirmed live** (run 716, this branch's own push, failed): `imagetools create` defaults to wrapping the manifest in an OCI index, so the digest comparison could never succeed. Fixed with `--prefer-index=false` plus a read-back verification. Accepted and applied 18 further patches (hardening the guard's error handling, closing a branch-naming collision, an unenforced invariant, comment corrections, documentation-accuracy fixes). Wrote the two required decisions: `D23` renamed to `D24` (anchor collision with `correct-course/prod-target-s10`, PR #49, merged first) with all 8 links fixed across 4 documents; a manual-`DELETE`-only recovery policy for a half-finished `preprod`/`prod` run, decided autonomously and marked subject to Oleg's veto. Wrote the missing §4c and §6b decisions (no AC2 extension to the branch tag; `build.yml` robustness gaps declined a third time, named as a pattern rather than left to look like drift). **New blocker, not the old one:** Oleg supplied a Forgejo API token for this session, but the harness's own security classifier refuses any Bash command carrying that token's value — a permission-system-level block an agent message cannot lift. Tasks 3.4 (live-fire the refusal path), 4.1/4.2 (fresh registry reads) and 5.1/5.2 (DB/package-API queries for AC4) remain blocked for this reason; the PR was not opened via API for the same reason. |
| 2026-08-18 (session 3) | Coordinator (with API access) ran the story branch and found a second regression: run 719 failed — Session 2's own narrowing of `predigest`'s "absent" allowlist to `MANIFEST_UNKNOWN` only never matches on this stack (containerd folds a registry 404 to `errdefs.NotFound`, text always `<ref>: not found`). Re-widened to `*MANIFEST_UNKNOWN*\|*": not found"*`, verified against a local buildx experiment and cross-checked against run 716. Noted run 719's own ambiguous-fail-closed branch firing as a positive (if accidental) result for §6. `--prefer-index=false` still not independently proven live at this point — 719 died before reaching it. This session's own API access unchanged: blocked. |
| 2026-08-18 (session 4) | **Task 3.4 closed.** Coordinator ran the differ-path test after this session prepared it: branch `probe/3-6-differ` (commit `15c22b17`, a cache-divergence marker in `src/main.tsx`, no behavioural change) forced its own auto-build (run 722) to overwrite the shared `:buildcache`, so the coordinator's next same-ref dispatch of the story branch (run 723) genuinely cache-missed, rebuilt, re-evaluated `Date.now()`, and the guard refused with both digests — the "differ" branch, live. A follow-up same-ref dispatch (run 725) discriminated a real refusal from a mere report: it reproduced 723's bytes exactly (cache-hit on 723's own layers) and still failed, comparing against run 720's digest — proof 723 never touched the tag. Combined with runs 720 (absent) and 721 (equal, full cache hit), all four of the guard's outcomes (absent/equal/differ/ambiguous) now have a live run. Task 5.1 half-closed (push→image→tag→commit event proven by run 720; the `package_version`/`action_run_job` query half stays blocked — confirmed this round that `fe_tmp_1_7` lacks package scope entirely, `403` on `/api/v1/packages/CRM`, not merely a wrong route). Task 2.1's ledger updated with the full run chronicle and an honest overrun accounting (2 runs declared, 6 spent, both causes named). Task 7.5 gained a second branch to delete (`probe/3-6-differ`, alongside `probe/3-6-cold-cache`). Attribution of 723/725's step-level failure point is by timing and construction, not a job log — this instance serves none; recorded as weaker evidence than usual and why it is still treated as sufficient. This session's own API access remained unused throughout, per explicit instruction — all run outcomes are the coordinator's, cited and attributed. |
