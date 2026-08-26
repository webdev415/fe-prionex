<!-- Story 6.3. Epic 6's SECOND story (6.1 cancelled, 6.2 done and merged as 1cdb0f35).
     Written 2026-08-26 by the create-story context engine, from a scratchpad worktree off fresh
     origin/main at cfbad179. The primary checkout belongs to Story 4.9's dev agent — do not touch it.
     READ THE WHOLE "Read this before anything else" BLOCK BEFORE THE FIRST TASK.
     §2 is the ordering finding and it does NOT say what the plan assumes.
     §3 is the one-shot trap: this story's central dispatch CANNOT BE RE-RUN, by construction.
     §4 is the first `prod` build this project has ever attempted; nothing about that path has run.
     §5 is the tag-writing mechanism that DOES NOT EXIST and that this story must build.
     §6 is what `prod-current` will mean before the cutover — and it is a lie unless it is amended.
     §7 is what this story BREAKS in Story 6.2's freshly-shipped artifacts. §12 states what may not
     be touched. Nothing below is a suggestion. -->

# Story 6.3: Rebuild the Running Production Commit into the Forgejo Registry

Status: review
<!-- PAUSED, 2026-08-26, on Oleg's own explicit instruction -- do not resume until he signals.
     Task 2.4's gate worked exactly as designed: the commit s2 is running
     (41ab0470ab6b3df3bc332fc90f8bccaaba44dc39) was confirmed absent from the Forgejo repository
     (fresh fetch, all 1429 refs) -- the project's first direct proof of the GitHub/Forgejo
     divergence, and a successful precondition check, not a story failure. Resolved by Oleg,
     verbatim: "Занесу коммиты в Forgejo" (option a -- import from a local clone; options b/c
     explicitly declined, not defaulted past). PENDING (owner: Oleg) -- he is importing the commit
     himself and watching for its arrival; not an open-ended wait. On resume: RE-VERIFY, do not
     resume from where it stopped -- confirm the commit is a complete reachable object in Forgejo,
     and confirm s2 is still serving the same revision (a changed label is a new gate). See Dev
     Agent Record and Open Questions item 6. -->

## Story

As a release engineer,
I want the commit production is currently serving present in the Forgejo registry,
So that the cutover can be rehearsed against the code already in production.

---

## 🚨 Read this before anything else

### 1. What this story is, in one paragraph

Production is served by s2, from `ghcr.io/crm-prionex/fe-prionex:main` — a **moving branch tag**,
pushed by the legacy `.github/workflows/CD.yml` on every merge to GitHub's `main`. Nothing in this
plan may pull that image: no action is taken on GitHub, and that includes its registry (`#d7`,
Epic 6's own preamble). So the cutover image is **rebuilt from the same commit** instead. This story
is three acts and one honest sentence: **(1)** find out which commit s2 is actually running, from
evidence rather than from a branch name; **(2)** build that exact commit through `build.yml` with
`environment: prod` — the first `prod` build this project has ever run — and **(3)** put the
permanent tags on it that make it addressable as a rollback target: `prod-<sha>` and `prod-current`,
neither of which anything in this repository can currently write. The honest sentence is `#d2`'s and
it is the reason the story exists at all: *«зелёная валидация на PRE-PROD — это свидетельство об
исходном коде, а не о байтах, которые поедут в прод»* — **the image this story produces is a
separate, byte-different build from anything that has ever been validated or served.** Story 6.9's
"no-op deploy" is a no-op **in code, never in bytes**, and this story is where that becomes a fact
in the registry rather than a paragraph in a decision record.

**This story dispatches. It mints permanent tags. It cannot take most of them back.** That is the
difference between it and 6.2, and every section below exists because of it.

### 2. 🔴 THE ORDERING FINDING — checked against `epics.md`, not taken on the plan's word

**The instruction asked whether 6.3 carries a dependency like the recorded `6.10-before-6.4`
constraint. It does not carry that one. It carries a different one that the plan never wrote down,
and one hard external precondition that no story owns.**

**Verdict: 6.3 is correctly the next story. No re-order is proposed.** The three findings that
produce that verdict, each checked rather than asserted:

**(a) 6.3 does NOT depend on Story 6.10 (the s10 contour).** Every leg of this story runs somewhere
that already exists:

| Leg | Where it runs | Exists on 2026-08-26? |
|---|---|---|
| Identify the running commit | **s2**, over the NFR7 administrative SSH path | ✅ yes — NFR7: *"The old s2 key remains authorized on s2 as the admin path to the **legacy** stand"* |
| Build the commit | `build.yml`, `runs-on: node-20` — the CI runner on s1, in dind | ✅ yes |
| Push / retag | the Forgejo registry, over the path `build.yml` and `record-preprod-candidate.yml` already use | ✅ yes |
| Deploy anything | — | **nothing is deployed by this story** |

`epics.md`'s own 2026-08-18 note on this story says it in those words: *"identification of the
running production commit still happens on **s2** … Only the *deploy destination* of the rebuilt
image changed (s10, per Story 6.4 as amended). The ACs stand as written."* s10 is 6.4's problem and
6.10's; **it is not this story's, and this story must not touch it** (§12).

**(b) 🔴 The dependency the plan did NOT write down: nothing in this repository can create
`prod-current` or `prod-<sha>`, and the story the plan assigned that job to cannot run first.**
Measured, this session, against `origin/main` @ `cfbad179`:

- `build.yml` emits **exactly two** tags for an `environment: prod` dispatch: `sha-<12hex>-prod`
  (attached by the AC2 step under `imagetools create --prefer-index=false`) and
  `<sanitized-ref>-prod` (pushed by the build step itself, `steps.tags.outputs.push_tags`). **It
  emits neither `prod-current` nor `prod-<12hex>`, and it never has** — grep the file: the strings
  appear only inside `KEEP_RE` and inside comments about the retention rule.
- `record-preprod-candidate.yml` is the only file in this repository that writes a
  `<env>-current` / `<env>-<sha>` marker pair. It is hard-wired to `-preprod` in **G2** and **G3**,
  and its **G5** requires *"the stand must be healthy and demonstrably serving this exact digest"*
  against the container `fe-prionex-preprod` on the PRE-PROD deploy runner. **There is no PROD stand
  to point a G5-equivalent at until Story 6.10 provisions one.** It is not reusable and it is frozen
  (§12).
- The plan assigns `prod-current`/`prod-<sha>` writing to **Story 6.6**, whose recording step lives
  inside `deploy-prod.yml` — **Story 6.4's file**, which `sprint-status.yaml` records **must not run
  before Story 6.10**.

So `6.3 → 6.6 → 6.4 → 6.10` and back to 6.3, which is why the amended **FR31** (2026-08-13) moved
the tag creation into this story in the first place: *"**Under the amended FR31 this story now
creates `prod-<sha>` itself**, so the protected tag exists from the moment of the rebuild."*
**What the amendment did not say, and what this context adds: that makes Story 6.3 the story that
introduces a new tag-writing mechanism, and therefore the story that owes a full retro-E5 live
outcome matrix** (§9). The plan treated FR31's amendment as a tagging detail. It is a workflow.

**(c) 🔴 The one hard precondition nobody owns: the commit s2 runs may not exist in the Forgejo
repository at all.** Story 6.1 is cancelled, GitHub keeps receiving merges to `main` and keeps
deploying them to s2, and `deferred-work.md` records the topology plainly: *"Forgejo, which has no
mirror to GitHub in either direction."* If production is running a commit merged on GitHub after the
Forgejo import, `actions/checkout@v6` with `ref: <that sha>` **cannot fetch it** and the whole story
halts at its first dispatch. **This is not covered by any story, it is not in `deferred-work.md`, and
it is the single most likely way this story stops.** It is Task 2.4, it costs zero runs, and it must
be answered **before** the identification is even reported as complete. Open Question 6 carries the
escalation if the answer is "absent".

**One argument for a different order, named and rejected rather than left unsaid.** Running **6.10
first** would let this story prove its tags the way `#d38` says tags should be proven — by a
host-level `docker pull` from the machine that will consume them. Rejected: 6.10 is a multi-leg
provisioning story against a host that was in a crash-loop on 2026-08-18 and that its own AC block
says *"is moving — re-verify at execution time"*, and blocking the cutover image behind it buys a
proof this story can obtain more cheaply (a registry read-back, which is what every write step in
`record-preprod-candidate.yml` already does). **Recorded so the choice is visible, not so it is
re-opened.**

**What `deferred-work.md` already owns against this story by name**, verified this session — the
only such item, and it is discharged by AC1:

> *"⚠️ **`prod` and `preprod` point at `main` HEAD and this asserts nothing about what is deployed.**
> … Production is running some other commit; **identifying which is Story 6.3, and nobody has done
> it.** Anyone reading `prod` as a record of what is live will be wrong until the cutover (Stories
> 6.3, 6.9) makes it one. **Owner: Story 6.3.**"

`#d19`'s own section says the same: *«Прод сейчас крутит какой-то другой коммит — выяснить какой и
есть задача **Story 6.3**, и её никто не делал.»* **Do not read the `prod` branch as the answer.
It is `main` HEAD as of `cac85775` and it asserts nothing.**

### 3. 🔴 THE ONE-SHOT TRAP — the central dispatch cannot be re-run, and the plan does not know it

**This is the finding a dev agent will discover the hard way if it is not read first.**

`build.yml`'s Story 3.6 AC2 guard is a three-branch decision made **before** the build and enforced
**after** it (`predigest` → `Enforce AC2 — attach or refuse sha-<12>-<env>`):

```
pre_digest empty          -> absent, nothing to protect       -> attach
pre_digest == NEW_DIGEST  -> already published, no-op         -> skip
pre_digest != NEW_DIGEST  -> the repoint AC2 forbids          -> FAIL, sha_tag left exactly as it was
```

And two builds of the same commit **are not byte-identical**, by a documented property of this
repository's own source, quoted from the guard's own failure message:

> *"on a cache miss, `vite.config.ts:8` bakes a fresh `Date.now()` into the bundle on every build, so
> two builds of the same commit are not byte-identical. That is a documented property of the source
> (2026-08-18, not fixed by this story) … Whether this fires is decided by whether THIS build's cache
> hit … And the cache that decides it is `:buildcache` — one shared, mutable tag any branch's build
> can evict … **The same rebuild of the same commit can pass today and fail tomorrow with nothing in
> the commit having changed.**"*

**Compounded by permanence.** `sha-<12hex>-prod` matches `keep_pattern`'s `sha-[0-9a-f]{7,64}-(pre)?prod`
alternative, read directly from `package_cleanup_rule` (`#d38` §9), so the retention rule never
removes it. `build.yml`'s own header states the cost of removing one: *"an authorised DELETE plus a
`write:package` token, which on this project has twice required the operator in person."*

**Therefore: the `environment: prod` dispatch in this story is effectively one-shot.** If it lands a
`sha-<12hex>-prod` you do not want — wrong commit, wrong bytes, a green build of a commit later found
to be the wrong one — **you cannot overwrite it and you cannot delete it without Oleg in person.**

**The mitigations, and they are the whole reason Task 2 comes before Task 4:**

1. **Every prod-specific fail-closed check in `build.yml` runs BEFORE anything is pushed.** Traced in
   the file, in order: the OpenBao AppRole/KV read and the `_check_url` guards (~`:400`-`:666`), the
   `VITE_OPERATOR_PHONE_URL` guard whose `prod` arm fails closed (~`:731`-`:770`), the tag computation
   and its `keep_pattern` permanence guard (~`:800`-`:1140`), then `predigest`, then the build, then
   the attach. **A failure in the prod-specific arms costs a red run and no tag at all.** That is a
   documentary observation from the file (Task 3.2), not a check this story performs.
2. **The build step pushes only `<sanitized-ref>-prod`;** `sha-<12hex>-prod` is attached afterwards by
   `imagetools create` under the AC2 guard (`steps.tags.outputs.push_tags` is the sanitized tag alone
   — read it, do not take this on trust). So a build that succeeds and an attach that fails leaves
   **only** an unprotected tag that expires in 14 days. **Do not "fix" a failed attach by re-dispatching
   without reading §3 again.**
3. **Do not dispatch until AC1 is complete, evidenced, and the commit is confirmed present in Forgejo.**
   Task 4 is gated on Task 2 in full. This ordering is an AC (AC7), not a preference.
4. **Never add an override input to the AC2 guard.** `build.yml`'s own comment forecloses it: *"NO
   override input is added, on purpose … adding one would only give that bug a bypass."* And `build.yml`
   is frozen here (§12).

> 🔴 **BLOCKER RESOLVED 2026-08-26 — by changing the build source, not by clearing the blocker.**
> The commit this section was written about, `41ab0470ab6b3df3bc332fc90f8bccaaba44dc39`, is **still
> absent from Forgejo** (re-verified 2026-08-26 against 549 remote heads and against the server itself
> with `git ls-remote`). It was never imported. Instead, Oleg changed what this story builds —
> *«Берем тот коммит, который последний в pre-prod»* — reversing his own earlier
> *«Занесу коммиты в Forgejo»* of the same day. **The build source is now
> `a99ccd44c5a39345fa65eb74e87343b187e129e9`**, short-12 `a99ccd44c5a3`, present and reachable from
> `origin/main`, carrying `preprod-a99ccd44c5a3`.
> **Everything else in §3 stands unchanged and is now live rather than hypothetical**: the one-shot
> property, the `Enforce AC2` refusal, the `Date.now()` reason, the permanence of the tag. Full
> analysis and price: `sprint-change-proposal-2026-08-26-cutover-candidate.md`, `#d46`.

### 4. 🔴 THE FIRST `prod` BUILD THIS PROJECT HAS EVER RUN — and it cannot be rehearsed

`deferred-work.md`, verbatim, still open:

> *"**🔴 No `prod` build has EVER run under the current build configuration.** The driver, the network,
> the cache and the digest assertion all changed, and every run that exercised them used
> `environment: dev`. A `prod` or `preprod` build mints `sha-<12>-<env>`, which the retention rule keeps
> **forever** … Nothing found in review says the prod path is broken; the OpenBao `case`, the permanence
> guard and the digest assertion were all traced and are environment-agnostic. But **"traced and looks
> fine" is the standard this project rejects everywhere else.**"*

> *"⚠️ **`prod` remains unexercised.** It differs from preprod only in the `case` arm that selects the
> AppRole and KV path, so the risk is narrow, but **`secret/fe/prod/app` has never been read by anything**
> and Story 7.6 exists because `OPENBAO_PROD_SECRET_ID` is unresolved."*

**The entry's own recommended mitigation — *"one `preprod` dispatch before the first real production
deploy"* — is spent and no longer helps.** Story 5.6 ran a real `preprod` build (run 1308) on
2026-08-25, so the preprod path is exercised end to end. What that run did **not** touch is precisely
the delta: the `prod` arm of the OpenBao `case`, `OPENBAO_PROD_ROLE_ID`/`_SECRET_ID`, the KV path
`fe/prod/app`, and the `prod` arm of the phone-URL guard. **Another preprod dispatch buys nothing and
costs one more permanent `-preprod` tag. Do not run one** (Prohibition 8; Open Question 7 records the
recommendation against it so it is a decision rather than an omission).

**What is known about the prod arm, dated and sourced, none of it re-measured by this context:**

| Prerequisite | Recorded state | Source, and its date |
|---|---|---|
| `OPENBAO_PROD_ROLE_ID` / `OPENBAO_PROD_SECRET_ID` | exist at **repository** scope; secret_id issued 2026-08-13 11:02:06Z, **expires 2027-06-09**, nothing rotates it | `#d`-changelog 13.08; `deferred-work.md`; Story 7.6 |
| `secret/fe/prod/app` contents | recorded as `VITE_API_BASE_URL=https://api.crm-prionex.online`, `VITE_WS_URL=wss://api.crm-prionex.online` | `docs/forgejo-migration.md:302` — **a written table, never read back by any execution** |
| `VITE_OPERATOR_PHONE_URL_PROD` | `https://phone.crm-prionex.online`, the repository's **only** variable; no org-level variables exist | measured 2026-08-25, Story 5.6 Task 2.4, value pasted |
| `prod` arm behaviour on an empty phone URL | **fails closed** — *"a prod build must carry an operator phone URL"* | `build.yml`, the `case` in the phone step |
| OpenBao reachability / seal state from the job | proven for `dev` and `preprod`; `prod` arm never executed | Stories 3.3, 5.6 |

**Neither of the two unread values can be verified before the dispatch.** Forgejo secret values are
write-only (this is why Story 4.5's webhook is unrecoverable), so `OPENBAO_PROD_SECRET_ID` cannot be
read out and used to pre-read `fe/prod/app` over HTTP the way `#d`'s *"все утверждения про OpenBao —
по HTTP с явным `X-Vault-Token`"* method would require. **State that as a limit. Do not simulate a
pre-check that cannot exist** (Prohibition 6). The de-risk is §3's mitigation 1 — the guards fire
before any push — and nothing else.

### 5. 🔴 The mechanism that does not exist: who writes `prod-current` and `prod-<sha>`

§2(b) established that nothing can write them. This section says what to build, and it is the story's
largest autonomous decision (Dev Notes §5 row 1, Open Question 1).

**Decision: a new dispatch-only workflow, `.forgejo/workflows/record-prod-image.yml`**, modelled on
`record-preprod-candidate.yml`'s **write half** and on `build.yml`'s **"Enforce AC2"** step, which is
the pattern that file's own header says it copies. Alternatives assessed:

| Option | Verdict |
|---|---|
| **A. New `record-prod-image.yml`** | ✅ **CHOSEN.** Auditable (a run id, a workflow, guards that can refuse), reuses two proven patterns, earns the retro-E5 matrix §9 requires, and is the artifact Story 6.6 either consumes or supersedes with its reasons on record. |
| B. Extend `build.yml` to emit the pair on `environment: prod` | ❌ `build.yml` is frozen (§12) and this would change behaviour for every future prod build, silently moving `prod-current` on every build rather than on every deploy — which is 6.6's semantic, taken without 6.6. |
| C. Extend `record-preprod-candidate.yml` with an environment input | ❌ Frozen (§12), 983 lines, and its **G5** — *"the stand must be healthy and demonstrably serving this exact digest"* — has no PROD referent until 6.10. Generalising a guard by deleting it is not generalising it. |
| D. Manual `docker buildx imagetools create` from a host | ❌ No run id, no guard, no read-back in the record, and it needs a `write:package` credential placed by hand — `REGISTRY_TOKEN_RW`, which holds write over **another team's** packages. Leaves the project's most consequential registry write as the only one with no workflow behind it. |

**What the new workflow must and must not do:**

- **Inputs:** `image_tag` (required — the `sha-<12hex>-prod` this story's build produced) and an
  explicit acknowledgement input whose only accepted value is a literal the operator must type, so a
  stray dispatch cannot move `prod-current`. Mirror **G1**'s shape: *a refusal on the first step of the
  first job, before any network call.*
- **Guards, mirroring 5.4's numbering so the two files read as siblings:** the tag must end `-prod`
  (G2-equivalent); it must be commit-extractable as **exactly 12 hex** — `#d18` §3 names Stories 5.4,
  6.3, 6.5 and 6.6 by name and says *«если любая выведет тег из полного 40-символьного SHA, цель отката и
  гейт разойдутся молча»* (G3-equivalent); the digest must resolve in the registry with a **classified**
  404 rather than a raw crash; the manifest's `org.prionex.environment` and
  `org.opencontainers.image.revision` labels must agree with the derivation (G6-equivalent); and both
  target markers must be **compiled against `keep_pattern`** before either is written (G4-equivalent).
- **There is no G5-equivalent and this story must say so in those words.** G5 asks whether the stand is
  demonstrably serving the digest. **There is no PROD stand.** Inventing a G5 that checks s2 would be
  false — s2 serves a ghcr image, not this one, and Forgejo must not reach s2 at all (§12, NFR5 as
  amended). **A guard with no referent is not a guard; leaving it out with the reason recorded is the
  correct answer and §9 prices what that costs the matrix.**
- **Write order: `prod-<sha>` FIRST, then `prod-current`** — 5.4's own §6 reasoning, transferred: if the
  run dies between the writes, the history tag exists and the pointer is stale, which is recoverable;
  the reverse leaves `prod-current` naming an image with no permanent history tag.
- **Each write is read back from the registry before it is reported** — `record-preprod-candidate.yml`'s
  standing discipline, and the reason `build.yml`'s attach step ends with a read-back rather than an
  `echo "OK"` that was *"a claim, not a check, and … FALSE on every run"*.
- **`--prefer-index=false` on every `imagetools create`.** Without it, `create` emits an OCI index
  wrapping the manifest, `.Manifest.Digest` reads the index's digest, and every read-back fails while
  blaming something else. This cost Story 3.6 a live investigation; do not rediscover it.
- **No `secrets: inherit`.** This is a dispatch-only workflow that names
  `secrets.REGISTRY_TOKEN_RW`/`REGISTRY_USER` directly, exactly as `record-preprod-candidate.yml` does.
  **It is therefore NOT blocked on Story 6.4's mandatory `secrets: inherit` decision, and it must not
  pre-empt it** (§13 item 3).

### 6. 🔴 `prod-current` will name an image that nothing serves — and that is a lie unless it is written down

`prod-current` means, in Story 6.6's words, *"the registry identifies what production is running"*.
When this story sets it, **production will be running something else**: s2 serves
`ghcr.io/crm-prionex/fe-prionex:main`, and it keeps serving it until the **external traffic switch**
that Story 6.9's 2026-08-18 amendment names as an external dependency owned outside this repository.

So between this story and that switch — a window of unknown length, spanning at least Stories 6.10,
6.4, 6.5, 6.6, 6.7, 6.8 and 6.9 — **`prod-current` is a Forgejo-side cutover pointer, not a statement
about what users are being served.** Two ways to hold that honestly:

| Option | Verdict |
|---|---|
| Set both tags now, and **state in writing what `prod-current` means before the cutover** | ✅ **CHOSEN.** FR31 as amended requires both; the retention argument for `prod-<sha>` is real; and the misreading is closed by a dated sentence rather than by withholding a tag the plan requires. The sentence lands in `docs/prod-releases.md` and in `D45`, and the regulation gets its own amendment (§7). |
| Set `prod-<sha>` only, defer `prod-current` to 6.6/6.9 | ❌ Contradicts the amended FR31 and this story's own epic AC3, and reintroduces exactly the window the 2026-08-13 amendment closed. **Recorded as Open Question 2 for Oleg, not taken unilaterally**, because it is the one alternative a reviewer will raise. |

**And the misreading has a precedent in this very project.** `#d19` created the `prod` branch at `main`
HEAD and had to write *«Это точка отсчёта, а не утверждение»* because someone would otherwise read it
as a record of what is live. `prod-current` is the same trap with a shorter fuse: it is protected by
name, it moves, and 6.6 will later define it as authoritative. **Write the disclaimer at the moment the
tag is created, not after someone acts on it.**

### 7. 🔴 What this story BREAKS or STALES in Story 6.2's freshly-shipped artifacts

Story 6.2 merged eight days into this epic (`1cdb0f35`) and shipped two documents written in
**dated future tense** about machinery that did not exist. **This story changes some of those facts.
Each item below is a task, not a discovery.**

**(a) `docs/production-approval-regulation.md` — the workflow census goes stale.** It states, dated:
*"`deploy-prod.yml` does not exist (`ls .forgejo/workflows/` — 11 entries, no PROD deploy caller)"*.
If §5's `record-prod-image.yml` ships, the count becomes **12**. The claim *"no PROD deploy caller"*
stays true and must stay; the number does not. **Amend by dated addition** (Task 7.1).

**(b) 🔴 The regulation's rollback rule does not cover this story's own tag, and Story 6.9 walks
straight into it.** The shipped rule:

> *"**Restoring a tag already in `docs/prod-releases.md`'s `prod_tag` column is not a new release and
> needs no new approval** … **A rollback to a tag not in the ledger is a release and needs Oleg.**"*

This story creates `prod-<sha>` and `prod-current` and appends **no ledger row** — no production
release has been approved, and `D42` shipped that ledger empty by explicit decision. **FR32 and Story
6.9 then validate the cutover by a `rollback: true` deploy against exactly this tag.** Under the rule
as shipped, that dispatch is *"a rollback to a tag not in the ledger"*, therefore **a release,
therefore it needs Oleg** — and the regulation's own `## Who approves` section records that **there is
no delegate**, so while Oleg is unavailable it cannot happen at all.

**This is a real collision, not a wording quibble, and this story must resolve it rather than hand it
to 6.9 as a surprise.** The recommended resolution, which is Open Question 5: **amend the regulation
with a dated clause naming the cutover image as a third case** — neither an approved release nor a
ledger rollback, but a **rehearsal against an image no user is served**, which needs no approval
because approving it would approve nothing. **Do not resolve it by inventing a ledger row**
(Prohibition 9): `docs/prod-releases.md`'s own header says a row is *"appended by hand, before the
`deploy-prod.yml` dispatch, by whoever records the approval"*, and there is no approval here.

**(c) The freeze window does not bind this story — say so, do not leave it ambiguous.** The shipped
window runs *"from the approval row being appended to that smoke check passing"* and *"binds the s10
stand only"*. This story appends no row, dispatches no deploy and touches no stand. **It is outside
the window by construction. State it in one line in the amendment** rather than letting a reader
wonder whether a build counts.

**(d) `docs/prod-releases.md`'s `prod_tag` column now has facts to be settled against.** Its column
definition says the tag shape is *"Deliberately not pinned … which of the matching PROD forms a
rollback targets is **Story 6.4/6.6's to settle**"*. After this story, **three** `-prod` forms exist in
the registry: `sha-<12hex>-prod` (permanent), `prod-<12hex>` (permanent), `<sanitized-ref>-prod`
(expires at 14 days). **This story does not settle which one a rollback targets** — that is still
6.4/6.6's — **but it must record the three that now exist**, so the later decision is taken against
measured facts instead of a shape guess (Task 7.2).

**(e) The retention rule is now load-bearing for the first time, and it has still never been
observed.** `#d38` §9: the rule was *"верифицировано компиляцией против авторитетного источника, не
исполнением"* — **UNPROVEN by execution**, never observed deleting anything and therefore never
observed **keeping** anything either. The regulation already carries that caveat inside its rollback
section. **What changes here: this is the first story to place a tag in the registry on whose survival
a rollback depends.** The first date the rule can be observed is **2026-08-29**, and that dated item in
`deferred-work.md` still has **no owner**. **Name it; compile `keep_pattern` against both markers
before writing them (§5); do not claim they are protected by execution** (Prohibition 5).

**(f) `docs/preprod-candidates.md` is untouched.** This story records nothing there — it neither
validates a candidate nor appends a row.

🔴 **CORRECTED 2026-08-26 (`sprint-change-proposal-2026-08-26-cutover-candidate.md`, `#d46`), and the correction inverts the paragraph.** As
written this read: *"it has no `preprod-<sha>` and — because it is built from a commit that never went
through Epic 5's cycle — it will fail Story 6.5's promotion guard by construction, which is exactly why
6.9's cutover uses `rollback: true`."* **Every clause of that is now false.** The build source is
`a99ccd44c5a3…`, the last validated PRE-PROD candidate; it **went through Epic 5's cycle**, it **has**
`preprod-a99ccd44c5a3` (measured in `package_version`), and it would therefore **PASS** Story 6.5's
guard. The exception this story was carrying is gone.
🔴 **`rollback: true` is still required for Story 6.9, for an INVERTED reason** — the release path
rebuilds (6.4 AC2) and `build.yml`'s `Enforce AC2` refuses to repoint an existing `sha-<12hex>-prod`
(`#d24` §2b), so a release-path dispatch of a commit this story already built **goes red**. Mechanical,
not a guard bypass. Recorded in `#d46` and in the amended FR32 so 6.9 does not rediscover either half.

### 8. Previous story intelligence — what this story inherits, verified 2026-08-26

Verified against `origin/main` @ `cfbad179` and the shipped files themselves.

- **`docs/production-approval-regulation.md`** (127 lines, Story 6.2, merged `1cdb0f35`) — the
  organizational control that exists instead of a technical gate. **Written in dated future tense**
  throughout; §7 lists what this story stales in it.
- **`docs/prod-releases.md`** (62 lines) — the approval ledger, **empty**, ten defined columns, `prod_tag`
  and `Deploy run id` carrying `pending` values at append time, `Waiver?` mandatory. **This story
  appends nothing to it** (Prohibition 9).
- **`RVC-v1.1`** and its waiver (`#d40`/`#d41`) — Oleg only, time-boxed **and** single-candidate,
  *"the waiver changes what gets dispatched, never what is derived"*. **Not consumed by this story**: no
  validation happens here. Named so it is not reached for.
- **`docs/preprod-candidates.md`** — three recorded candidates; `preprod-current` →
  `sha-a99ccd44c5a3-preprod`, digest `sha256:a62e8687…`; the live precedent 7/12 pass, 5 `BLOCKED`,
  derived `fail`, dispatched `pass` under `#d40`. **Read-only here.**
- **`#d2` / Option C** — status header still *«спроектировано, не реализовано — обновить в story 6.5»*,
  plus Story 6.2's forward note. **This story is Option C made concrete**: it produces the separate,
  byte-different production build the record describes.
- **`build.yml`** — `workflow_dispatch` with `ref` + `environment: {dev, preprod, prod}`; checkout at
  `ref: inputs.ref` (so an arbitrary historical commit is buildable even though the workflow file lives
  only on `main`); OpenBao per-environment AppRole and KV; the `keep_pattern` permanence guard; the
  Story 3.6 AC2 predigest/attach pair; labels `org.opencontainers.image.revision` (**full 40-hex SHA**),
  `org.opencontainers.image.version` (**12-hex short SHA**), `org.prionex.environment`,
  `org.prionex.ref`, `org.prionex.ref-sanitized`. **Frozen** (§12).
- **`record-preprod-candidate.yml`** — six guards, `--prefer-index=false`, write-then-read-back,
  `preprod-<sha>` before `preprod-current`. **The pattern §5 copies. Frozen** (§12).
- **`.github/workflows/CD.yml`** — the legacy production path, read-only and never executed by us:
  builds from `Dockerfile.prod` with `VITE_API_BASE_URL`/`VITE_WS_URL` (production defaults
  `https://api.crm-prionex.online` / `wss://api.crm-prionex.online`), labels from
  `docker/metadata-action@v5`, pushes to `ghcr.io/crm-prionex/fe-prionex`, and deploys by pulling the
  **branch tag** `:main` over SSH. **This is why AC1 cannot read a SHA off the image reference: the
  reference is a moving branch name. The commit is in the labels.**
- **`docs/release-regulation.md`** (79 lines, Story 5.6) — PRE-PROD only. **Not touched by this story.**

### 9. 🔴 retro-E5 — what this story genuinely earns, and the row it must NOT manufacture

**retro-E5** (`epic-3-retro-2026-08-18.md:78`, `adopted`): *"every new guard ships with a live outcome
matrix (one run per branch incl. a discriminating run)."*

**This story introduces guards, so unlike Story 6.2 it owes a real matrix.** §5's
`record-prod-image.yml` is a guard-bearing workflow and every guard below is discriminable by an
ordinary dispatch — no stubs, no force-tests, no `PATH` tricks, for the rows marked live.

| Guard | Pass row | 🔴 Discriminating (failing) row | Earnable live? |
|---|---|---|---|
| G1-equivalent — the acknowledgement input must be the exact literal | the real record dispatch | a dispatch with the input absent or wrong — refused on the first step of the first job, **zero network calls** | ✅ **live** |
| G2-equivalent — the tag must end `-prod` | same run | dispatch a real `sha-a99ccd44c5a3-preprod` — refused | ✅ **live**, and free: the tag already exists |
| G3-equivalent — commit-extractable, **exactly 12 hex** | same run | dispatch the same commit's **40-hex** form — refused with the length named (`#d18` §3's failure mode, made to fire) | ✅ **live** |
| digest resolution — classified 404, not a crash | same run | `sha-000000000000-prod` — a classified absence, and the message must say *absent*, not *ambiguous* | ✅ **live** |
| G6-equivalent — manifest labels agree with the derivation | same run | dispatch a `-preprod`-built manifest's digest under a `-prod` name, or any artifact whose `org.prionex.environment` disagrees | ⚠️ **live only if a suitable artifact exists without minting one**; otherwise **force-test, labelled as such** |
| G4-equivalent — both markers compile against `keep_pattern` | same run (both match) | **force-test only** — a non-matching derived name is not reachable through this file's own inputs, exactly as 5.4 recorded for its own G4 |
| **G5-equivalent — the stand serves this digest** | — | — | ❌ **DOES NOT EXIST. There is no PROD stand until Story 6.10.** §5. **This is a named absence, not a gap to paper over.** |

🚫 **STATUS 2026-08-26: THIS MATRIX IS `OPEN` AND WILL NOT BE COMPLETED BY THIS STORY.** Oleg
cancelled Task 5.4 (*«отмена Task 5.4»*). **Earned: exactly one row** — the pass row, run 600, which
carried the real record dispatch through every guard to both writes. **Not earned and not claimed:
all four discriminating rows.** The `G4`-equivalent stays **force-test only** and the
`G6`-equivalent **unexercised**, both exactly as predicted above. The `G5`-equivalent remains a
**named absence** and was never earnable here. **AC6 is UNMET** and says so in its own section.
🔴 **The local 15/15 shell exercise at Task 5.2 is not this matrix and is not offered as it** — it
never reached Forgejo, never proved the guards are reached in the real step order, and produced no
run id. **Owner: Oleg.**

**🔴 The check this story must NOT claim, stated here so the trap is sprung on paper instead of in the
Dev Agent Record.** It is tempting to present *"the rebuilt image is not byte-identical to what
production serves"* as a measured finding. **It cannot be measured and it cannot fail.** The ghcr image
is unreachable **by decision**, not by accident (`#d7`, Epic 6's preamble), so there is no digest on the
other side of the comparison; and even if there were, `vite.config.ts`'s `Date.now()` guarantees the
answer in advance (§3). **It is true by construction and by decision. Say exactly that.** Story 6.2's
own review found and corrected this precise defect — *"a check whose outcome is guaranteed is precisely
the vacuity Prohibition 7 forbids"* — and Story 5.2's H2, Story 5.4's H1 and `D34` §3 found it before
that. **Four rejections. Do not make it five.**

**What IS honestly measurable about the same fact, and it is a different claim: commit identity.** The
running image on s2 carries `org.opencontainers.image.revision` (written by
`docker/metadata-action@v5`); the rebuilt image carries the same label key written by `build.yml`.
**Compare the two label values.** That comparison **can** fail — it fails if the wrong commit was
identified, if the wrong `ref` was dispatched, or if `actions/checkout` resolved something other than
what was asked for. **That is AC5's discriminating content, and it is the only byte-level-adjacent
claim this story is entitled to make.**

### 10. Run budget model

Declared **before** work, per **retro-D4** (*"run-budget ledgers close only against a query … a
self-report without a query means the ledger is open"*). **Story 6.2's measured overrun is applied
here rather than repeated:** its model assumed *"dev-story = 1 push"* against three real commits,
over-predicted the PR side (5 assumed, 2 real), and carried **no line at all** for the decision commit
answering Oleg or for the mid-story `origin/main` integration merge. Both lines are budgeted below.

**CI rows (a push causes a `ci.yml` run; `ci.yml` has no `paths:` filter, so a documentation-only
commit costs a full four-job run; a push landing while the PR is open fires both `push` and
`pull_request` — two rows):**

| Line | Rows |
|---|---|
| Push: context (this file) | 1 |
| Push: `sprint-status.yaml` → `in-progress`, own commit (Task 1.1) | 1 |
| Push: dev-story work — **3 commits budgeted, not 1** (6.2's lesson) | 3 |
| Push: the commit applying Oleg's answers to the Open Questions | 1 |
| Push: `origin/main` integration merge, if `main` moves mid-story | 1 |
| PR-open run | 1 |
| Push: code-review commit (PR open → **two** rows) | 2 |
| Push: fix-pass commit (PR open → **two** rows) | 2 |
| Merge run (`build-main.yml`) | 1 |
| **CI subtotal** | **13** |

**Dispatch rows — this story dispatches, unlike 6.2:**

| Line | Rows |
|---|---|
| `build.yml`, `environment=prod`, `ref=<identified commit>` — **the one-shot, §3** | 1 |
| `record-prod-image.yml` — the real record run | 1 |
| retro-E5 discriminating runs (§9: G1, G2, G3, 404, and G6 if live) | 4 |
| Contingency: one failed/re-dispatched record run | 1 |
| **Dispatch subtotal** | **7** |

| | |
|---|---|
| **Declared floor** — context + status + 1 dev-story push + PR-open + merge, plus the build and the record dispatch | **7** |
| **Declared ceiling** | **20** |

**Disposition: OPEN.** Closed only by the **coordinator**, against
`GET /api/v1/repos/CRM/fe-prionex/actions/tasks`, grouped by `run_number` and attributed by
**`commit_sha`** — never by id range, never by self-report. Filter `action_run` to `repo_id=16` first;
Story 4.9 is pushing to the same instance concurrently and **its rows are named and excluded, never
absorbed**. **An overrun is renegotiated explicitly with a new stated ceiling, never smoothed at the
merge** — the discipline `#d38` §10 had to apply to itself.

🔴 **No-touch window.** The Sunday `dev-reset.yml` tick is **02:00 UTC**; the standing rule is **no
dispatch, no live lock holder and no `main` merge across 01:45–02:30 UTC.** Next tick: **2026-08-30.**
**Unlike Story 6.2, this story dispatches, so the window binds its dispatches as well as its merge.**
Hand the constraint to the coordinator; do not assume it will be noticed.

### 11. Who does what — the labour split, and it is not negotiable here

- **The dev agent** does git, files, SSH and `docker` — including the **s2 administrative read** (AC1).
- **The coordinator** issues every Forgejo **dispatch**, reads run state through the API, and closes the
  ledger. Subtasks owned by the coordinator are marked **`PENDING (owner: coordinator)`** and are
  **never** checked `[x]` — Story 5.2's **M14** exists because a subtask was checked with no artifact
  anywhere in the record.
- **Oleg** merges every PR, and holds the veto on Dev Notes §5.
- **"Announce, don't ask twice"** (`#d38` §7): a vetoable autonomous act is announced through the
  coordinator **verbatim, before** it happens, and then executed — absence of a veto is the answer.
  **Exception, and it is this story's alone: the two one-shot acts in §3 and §5 are announced AND
  confirmed, not announced-and-proceeded.** Minting `sha-<12hex>-prod` and moving `prod-current` are
  not undoable by this team; the standing convention is written for reversible acts. **Open Questions
  1–5 are answered before Task 4 dispatches anything** (AC7).

### 12. 🔴 Blast radius, frozen files, and the §12 exception procedure

**Story 4.9 is being implemented in parallel** on `story-4-9/*` and holds **D35** on its unmerged
branch — which is why `docs/migration-decisions.md` on `main` jumps from D34 to D36. **This story runs
from a scratchpad worktree; the primary checkout is 4.9's and must not be touched.**

**This story must not modify, and must not push any change to:**

- 🔴 **`.forgejo/workflows/build.yml`** — read-only. It is Stories 3.1/3.2/3.3/3.4/3.5/3.6's shipped
  artifact, it carries the AC2 immutability guard this story depends on, and **editing it to make this
  story easier is the single worst available move** (§3 mitigation 4).
- 🔴 **`.forgejo/workflows/record-preprod-candidate.yml`** — 5.4's shipped artifact. §5 copies its
  **pattern**; it does not edit its **file**.
- 🔴 **`.forgejo/workflows/deploy-stand.yml`**, **`deploy-preprod.yml`**, **`deploy-dev.yml`**,
  **`dev-reset.yml`** — 4.8's, 5.3's, 4.3's and 4.6's; the last two sit inside 4.9's blast radius.
- 🔴 **`ci.yml`, `build-main.yml`, `build-buildkit-cni-image.yml`, `verify-cni-netns-isolation.yml`.**
- 🔴 **`deploy-prod.yml` is not created here, not even as a skeleton.** Story 6.4's.
- 🔴 **`docs/release-validation-checklist.md`** (`RVC-v1.1`) and **`docs/preprod-candidates.md`** — no
  character is edited, nothing is appended. This story neither validates nor records a candidate.
- 🔴 **`docs/release-regulation.md`** — 5.6's PRE-PROD document. Untouched entirely.
- `README.md`, `Dockerfile`, `Dockerfile.prod`, `docker-compose.*.yml`, `nginx.conf`,
  `.env.*.example`, `epics.md`, `src/`, `vite.config.ts`.
- **`.github/workflows/CD.yml` / `CI.yml`** — read as evidence (§8), never edited, never triggered.
  Deleting them is Story 7.2's.
- **`4-9-cut-dev-over-to-the-new-stand.md`** or any `story-4-9/*` branch.
- 🔴 **s2 beyond a read.** No `docker run`, no `docker rmi`, no `compose` verb, no restart, no write of
  any kind, and **no Forgejo job on the `s2-prod-deploy` runner** — NFR5 as amended is absolute:
  *"Forgejo never deploys to s2 at all."* The only permitted contact is the **NFR7 administrative SSH
  read path** (Open Question 3).
- 🔴 **s10.** Not touched, not probed, not prepared. Story 6.10's.

**Files this story is expected to change:** `.forgejo/workflows/record-prod-image.yml` (**new**),
`docs/migration-decisions.md` (**append `D45`**, plus a dated forward note where §7 requires one),
`docs/production-approval-regulation.md` (**§7's dated amendment — a §12-priced exception, see below**),
`docs/prod-releases.md` (**§7(d)'s record of which `-prod` forms now exist — prose only, NO ROW**),
`_bmad-output/implementation-artifacts/sprint-status.yaml` (status transitions), `deferred-work.md`
(only if something is genuinely left open), and this file's own Dev Agent Record / File List /
Change Log.

**🔴 The §12 exception this story takes, priced up front rather than discovered.**
`docs/production-approval-regulation.md` is Story 6.2's artifact, shipped eight days ago, and by the
precedent 6.2 itself applied to 5.5's checklist it is frozen. **This story amends it anyway, and the
price is stated:** the amendment is required because §7(b) is a **live contradiction** — the shipped
rollback rule makes Story 6.9's own FR32 dispatch need an approval that, with no delegate, may be
unavailable. The blast radius is one document that no workflow reads. The re-earned evidence is nil:
nothing was proven about that document by execution. **The form is a dated amendment that adds and
never rewrites** — precedent already set inside the file itself, which names Story 6.5 as the reviser
of one of its sections, and by `#d2`'s own forward note. **If a reviewer would rather the regulation
stay untouched and the contradiction be filed against 6.9, that is Open Question 5 and Oleg decides
it.** It is a procedure, not a permission.

### 13. Boundaries — six things this story must not absorb

1. **It does not build `deploy-prod.yml`, a promotion guard, or a smoke check.** Stories 6.4, 6.5, 6.7.
2. **It does not deploy anything, anywhere.** Not to s2 (forbidden), not to s10 (does not exist), not
   to PRE-PROD. The cutover deploy is **Story 6.9's**, and it is a `rollback: true` dispatch.
3. **It does not decide `secrets: inherit`.** §5 avoids the question by construction; 6.4 still owns it.
4. **It does not measure `KONG_PORT`, probe PROD's Kong, or touch s10.** Stories 6.4 / 6.10.
5. **It does not settle which `-prod` tag form a rollback targets.** 6.4/6.6's. §7(d) records the
   three forms that now exist; that is all.
6. **It does not validate anything.** No `RVC-v1.1` run, no waiver, no candidate row. ~~The image this
   story builds has **no** `preprod-<sha>` and will fail Story 6.5's guard by construction~~ — 🔴
   **corrected 2026-08-26 (`sprint-change-proposal-2026-08-26-cutover-candidate.md`, `#d46`): the image is built from the last validated candidate,
   carries `preprod-a99ccd44c5a3`, and would PASS 6.5's guard.** This story still validates nothing
   **itself** — it consumes a verdict Story 5.6 already recorded, waiver `#d40`/`#d41` and all. See §7(f).

### Prohibitions

🚨 **A prohibition here cannot be overridden by a subtask.**

1. 🔴 **Never dispatch `build.yml` with `environment: prod` before AC1 is complete and Task 2.4 has
   confirmed the commit exists in the Forgejo repository.** §3. It is one-shot; the tag is permanent;
   removal has twice required Oleg in person.
2. 🔴 **Never re-dispatch the same commit at `environment: prod` to "fix" a result.** The AC2 guard
   refuses the repoint and will blame `vite.config.ts`; the tag stays as it was. §3.
3. 🔴 **Never edit `build.yml`** — not to add an override, not to add a tag, not to "just" widen a
   guard. §12, and the file's own comment forecloses the override by name.
4. 🔴 **Never pull, read, query or authenticate to ghcr.io, GitHub Actions, or any GitHub API.** No
   action is taken on GitHub, and that includes its registry (`#d7`). The running commit is identified
   from **the image on s2**, not from GitHub's run history. Open Question 4.
5. 🔴 **Never claim a tag is protected by the retention rule on the strength of execution.** `#d38` §9:
   **UNPROVEN by execution**, first observable 2026-08-29, no owner. Compile `keep_pattern` and say
   *compiled*.
6. 🔴 **Never simulate a pre-check that cannot exist.** `OPENBAO_PROD_SECRET_ID` is unreadable, so
   `secret/fe/prod/app` cannot be pre-read. §4. A "verified prerequisites" claim built on a document
   is a dated citation, not a measurement.
7. 🔴 **Never claim a check that could not have failed** — above all the byte-difference "comparison"
   in §9. Four prior rejections (`D34` §3, 5.1, 5.2's H2, 5.4's H1, and 6.2's own review makes five).
   **If only the weak form is available, run it and label it documentary.**
8. 🔴 **Never mint a tag this story does not need**, including a "smoke" `preprod` build of the
   identified commit. §4: it exercises none of the prod delta and costs a permanent tag.
9. 🔴 **Never add a row to `docs/prod-releases.md`.** No production release has been approved. §7(b).
10. 🔴 **Never write to s2.** Read only, over the NFR7 admin path, and never through a Forgejo job.
    §12.
11. 🔴 **The dev agent does not dispatch, does not touch the Forgejo API, and does not open the PR.**
    Mark those subtasks `PENDING (owner: coordinator)`, never `[x]`. §11; Story 5.2's M14.
12. 🔴 **Never `${{ }}` inside any `run:` body, including inside its comments** (`#d21`). §5 writes
    real workflow code, so this one is live rather than inherited.
13. 🔴 **Never write a token into a repository file, and never print a credential file's contents** —
    shape checks only.
14. 🔴 **Never soften a disposition.** The four words are `UNPROVEN`, `OPEN`, `PENDING (owner: name)`,
    or the claim is not made. There is no fifth, softer word.
15. 🔴 **Paste the artifact, do not characterise it** (4.2 M3, 5.2 M1, 5.4 M10). A `docker inspect`
    output, a run's own printed tag, a `keep_pattern` compile — pasted, not summarised.

---

## Acceptance Criteria

The epic's five ACs are carried as **AC1-AC5**. **AC6-AC10 are 🔴 ADDED** — they make the epic's ACs
executable in the world of 2026-08-26, in which the tag-writing mechanism does not exist, the prod
build path has never run, and Story 6.2's shipped documents contradict this story's own output.

### AC1 — The running commit is identified from evidence, on s2 *(epic AC1)*
**Given** production currently runs an image from ghcr.io
**When** the running commit is identified
**Then** it is determined from the running container on s2 — via its image labels or the recorded
deployment — not assumed from a branch name
**And** the identification is evidenced rather than asserted — 🔴 **which, concretely, means: the
container's own state is read (`docker inspect` on the running container, then on its image), the
`org.opencontainers.image.revision` label value is **pasted verbatim** into the Dev Agent Record
alongside the image reference and `.RepoDigests`, and the fact that the image reference is the moving
branch tag `:main` — not a SHA tag — is stated, because it is why the label is the evidence and the
reference is not.** If the label is absent, that is a finding to escalate (Open Question 6), **not a
licence to infer the commit from `main` HEAD, from the `prod` branch (`#d19`: *"это точка отсчёта, а
не утверждение"*), or from GitHub (Prohibition 4).**

### AC2 — Built from that exact commit, with the production build arguments *(epic AC2)*
**Given** the identified commit
**When** it is built
**Then** it is built from that exact commit with the production build arguments
**And** pushed to `git.crm-prionex.com/crm/fe-prionex` tagged `sha-<commit>`
**And** 🔴 **the tag actually produced is `sha-<12hex>-prod`, not the bare `sha-<commit>` this AC's
wording implies** — `build.yml` appends the environment discriminator, `#d18` §2 fixes the short SHA at
**exactly 12** characters, and `#d18` §3 binds Stories 5.4, 6.3, 6.5 and 6.6 to the same 12. **The bare
`sha-<commit>` form matches no `keep_pattern` alternative and expires at 14 days; it is not a rollback
target and this story does not create one.** The discrepancy between the epic's wording and the
shipped tag scheme is recorded in `D45`, not silently reconciled.
**And** 🔴 **the build is dispatched exactly once** (§3, Prohibition 1/2), after AC7's gate.

### AC3 — The current production state is recorded under the protected tags *(epic AC3, amended FR31)*
**Given** the rebuilt image
**When** the current production state is recorded
**Then** it also carries the tags `prod-current` **and `prod-<sha>`**
**And** 🔴 **because nothing in this repository can write either tag (§2b), they are written by a new
dispatch-only workflow this story ships, `.forgejo/workflows/record-prod-image.yml`, modelled on
`record-preprod-candidate.yml`'s write half and `build.yml`'s "Enforce AC2" step: `prod-<12hex>` first,
then `prod-current`, each written with `docker buildx imagetools create --prefer-index=false` and
**read back from the registry before it is reported** (§5).**
**And** 🔴 **the 12-hex derivation is asserted, not assumed** — a 40-hex derivation is refused with the
length named, per `#d18` §3.

### AC4 — Not byte-identical, and the consequence for Story 6.9 is stated *(epic AC4)*

🚫 **NOT MET. Cancelled by Oleg 2026-08-26 (*«Task 6 - отменить»*).** 🔴 **This is an EPIC acceptance
criterion, not one this story added for itself** — a different weight class from AC6. The underlying
facts were all measured and are in this file; what was not done is the write-up AC4 specifies: the
deliberate commit-identity comparison with both values pasted, the product-code distance with its
measured and unmeasured halves named, and the by-construction statement about the bytes.
**Recorded UNMET rather than counted as satisfied by scattered evidence elsewhere in the file.**
Owner: Oleg.
**Given** the rebuilt image
**When** it is compared with what production serves
**Then** it is confirmed to originate from the same commit
**And** it is recorded that it is **not** byte-identical, because it was rebuilt — so Story 6.9's
"no-op deploy" is a no-op in code, not in bytes, and must be validated by behaviour rather than by
digest comparison
**And** 🔴 **the epistemic status of each half is stated separately, because they are not the same kind
of claim (§9):** commit identity is **measured** — the `org.opencontainers.image.revision` label on the
s2 image and on the rebuilt image are read and compared, and that comparison **can fail**; byte
difference is **true by construction and by decision** — ghcr is unreachable by decision (`#d7`) so
there is no digest to compare, and `vite.config.ts`'s `Date.now()` guarantees the answer regardless.
**Presenting the second as a measurement is a defect** (Prohibition 7).

### AC5 — The retention position is compiled, and its unproven status is named *(epic AC5)*
**Given** the retention policy from Story 1.11
**When** it runs
**Then** these tags are protected as the current production and rollback targets
**And** 🔴 **"protected" is established by **compiling** `keep_pattern` — read from
`package_cleanup_rule`, the authoritative source, not from `build.yml`'s `KEEP_RE` copy — against each
tag this story creates, with the compile pasted; and by stating that the rule has **never been observed
deleting or keeping anything** (`#d38` §9, **UNPROVEN by execution**, first observable **2026-08-29**,
dated item with **no owner**). `sha-<12hex>-prod` and `prod-<12hex>` match by shape; `prod-current`
matches by name; **`<sanitized-ref>-prod`, which the build step also pushes, matches nothing and
expires at 14 days** — say so rather than letting a reader assume every `-prod` tag survives.**

### AC6 — 🔴 ADDED: the new workflow ships with a live outcome matrix including discriminating runs

🚫 **NOT MET. Cancelled by Oleg 2026-08-26 (*«отмена Task 5.4»*), and recorded as UNMET rather than
softened, reinterpreted, or marked partially satisfied.** §9's matrix carries **one** row — the pass
row, run 600 — and **no discriminating row**. `record-prod-image.yml` therefore ships in breach of
**retro-E5**, the rule this project adopted at Epic 3's retrospective. The local 15/15 shell exercise
recorded at Task 5.2 is **not** offered in its place; see 5.4 for why the two are different claims.
**There is no fourth, softer word: this AC is unmet, the decision was Oleg's, and the owner is Oleg.**
**Given** **retro-E5** — *"every new guard ships with a live outcome matrix (one run per branch incl. a
discriminating run)"* — and that this story, unlike 6.2, introduces guards
**When** `record-prod-image.yml` is delivered
**Then** §9's matrix is produced with **real run ids**: a pass row, and a discriminating failing row
for the acknowledgement input, the `-prod` suffix check, the exactly-12-hex check, and the classified
digest-404
**And** any row that cannot be earned live is labelled **force-test** or **absent** with its reason —
specifically **there is no G5-equivalent, because there is no PROD stand until Story 6.10**
**And** 🔴 **no row is claimed whose outcome is fixed by construction** (Prohibition 7). A negative
control that cannot fail is a defect, not a check — the exact finding Story 6.2's review made against
itself.

### AC7 — 🔴 ADDED: the one-shot acts are gated, announced, and confirmed before they happen
**Given** the `environment: prod` build mints a permanent tag that this team cannot delete (§3), and
`prod-current` is a moving pointer that Story 6.6 will later treat as authoritative (§6)
**When** either act is about to be performed
**Then** it is preceded by: AC1 complete and evidenced; **Task 2.4's confirmation that the commit is
present in the Forgejo repository**; and Oleg's answers to Open Questions 1–5 relayed through the
coordinator
**And** the exact dispatch — workflow, `ref`, `environment`, and the tag it will produce — is sent
**verbatim** before it is made
**And** 🔴 **unlike the standing "announce, don't ask twice" convention (`#d38` §7), these two acts wait
for a confirmation rather than proceeding on the absence of a veto** — the convention is written for
reversible acts and these are not (§11).

### AC8 — 🔴 ADDED: what `prod-current` means before the cutover is written down at creation time

🚫 **NOT MET. Cancelled by Oleg 2026-08-26** (Task 6 carried its `D45` half; Task 7.2 carries its
`docs/prod-releases.md` half). 🔴 **This one is OPERATIONALLY LIVE, not merely a missing document:**
`prod-current` **exists in the registry as of 2026-08-26 11:17:10Z** and points at an image **no host
serves**. s2 keeps serving `ghcr.io/…:main` until the external traffic switch. Anyone reading the
registry today — including Story 6.6, which will later define this marker as authoritative — will
reasonably conclude production runs it, and **nothing durable says otherwise**.
**What does exist, and it is thin:** the disclaimer is printed by `record-prod-image.yml`'s last step
(executed in run 600) and stated in that file's own header. Both are real. Neither is
`docs/prod-releases.md` or a decision record, and this instance's job logs are the tier this project
classifies as **best-effort only**. Owner: Oleg.
**Given** s2 keeps serving `ghcr.io/…:main` until an external traffic switch this repository does not
own (Story 6.9's 2026-08-18 amendment)
**When** `prod-current` is created
**Then** it is stated in writing — in `docs/prod-releases.md`'s prose and in `D45` — that between this
story and the cutover, **`prod-current` names the Forgejo-side cutover image and NOT what users are
being served**
**And** the precedent is cited rather than re-argued: `#d19` had to write the same disclaimer for the
`prod` branch (*«Это точка отсчёта, а не утверждение»*)
**And** 🔴 **no row is added to `docs/prod-releases.md`** — this is prose about what the tags mean, not
an approval record (Prohibition 9).

### AC9 — 🔴 ADDED: Story 6.2's shipped artifacts are reconciled, not left to go stale

🚫 **NOT MET. Cancelled by Oleg 2026-08-26 (*«Task 7 отменить»*).** Neither
`docs/production-approval-regulation.md` nor `docs/prod-releases.md` is amended. 🔴 **This AC's own
final clause specified the fallback for exactly this case** — *"if Oleg prefers the regulation left
untouched (Open Question 5), the contradiction is filed against Story 6.9 by name in
`deferred-work.md` with its full argument — never dropped"* — **and that filing has NOT been made
either.** It is a separate, cheap action (one append to a ledger file, no frozen artifact touched, no
§12 exception), and it is offered rather than taken, because the instruction was to cancel Task 7.
**As things stand the contradiction is recorded ONLY in this story file, which Story 6.9 has no
reason to open.** Owner: Oleg.
**Given** `docs/production-approval-regulation.md` and `docs/prod-releases.md` were written in dated
future tense and this story changes some of the facts they date (§7)
**When** the story closes
**Then** the regulation carries a **dated amendment** — added, never rewritten — covering: the workflow
census (11 → 12 entries, *"no PROD deploy caller"* unchanged); **the rollback-authority gap**, under
which the cutover tag this story creates is in no ledger row and Story 6.9's FR32 `rollback: true`
dispatch would therefore need an approval that may be unavailable with no delegate; and one line
stating that the PROD freeze window does not bind a story that appends no row and deploys nothing
**And** `docs/prod-releases.md` records, in prose, **which `-prod` tag forms now exist in the registry**
(`sha-<12hex>-prod`, `prod-<12hex>`, `<sanitized-ref>-prod`) and which of them survive retention —
**without settling which one a rollback targets, which stays Story 6.4/6.6's**
**And** the §12 exception taken against a frozen 6.2 artifact is **priced and recorded before the edit**
**And** 🔴 **if Oleg prefers the regulation left untouched (Open Question 5), the contradiction is filed
against Story 6.9 by name in `deferred-work.md` with its full argument — never dropped.**

### AC10 — 🔴 ADDED: every claim carries a run id or a pasted state read, and every unearned claim is named
**Given** this project's standing evidentiary rule
**When** the Dev Agent Record is written
**Then** every assertion about the registry is backed by a **read-back**, every assertion about a run by
a **run id**, and every assertion about s2 by a **pasted `docker inspect` output**
**And** the following are named as **NOT earned** rather than quietly omitted: byte-difference as a
measurement (§9); `secret/fe/prod/app`'s contents as verified before the run (§4); retention protection
as proven by execution (AC5); a G5-equivalent stand check (AC6)
**And** the run-budget ledger is declared before work (§10) and closed **only** by the coordinator
against a query, or closed with the literal word **OPEN**.

---

## Tasks / Subtasks

### Task 1 — Open the story, declare the budget, and re-verify the decision number (AC: 7, 10) — **costs 1 push row**
- [x] 1.1 **Done.** `sprint-status.yaml`'s `6-3-…` flipped `backlog` → `in-progress`, own commit
      (`7df02eca`), pushed before any content edit. `epic-6` already `in-progress`, untouched.
- [x] 1.2 **Confirmed.** `git fetch --all` → `origin/main` still `cfbad179` (unchanged from context
      time — it is itself Story 6.2's ledger-closeout merge, PR #89). No rebase/merge needed.
      `story-4-9/pr-1-context` confirmed still unmerged, still holds `D35`
      (`## D35. Cutover DEV на новый стенд…`, read directly from that ref).
- [x] 1.3 **Declared.** `PENDING (owner: coordinator)` — run-budget ledger floor **7**, ceiling
      **20**, disposition **OPEN** (§10). No-touch window handed over: next tick **2026-08-30**,
      **01:45–02:30 UTC**, binding both this story's dispatches and its merge.
- [x] 1.4 **Answers received before this task even opened — the coordinator's own message carried
      them.** Open Questions 1–5 (plus 7 and, with an explicit override, 8) arrived pre-answered;
      quoted verbatim and reconciled at Open Questions for Review, below. **New, not one of the
      original five:** Oleg's explicit authorisation for the one-shot dispatch mechanism itself
      (*"Запускай по готовности"*) — recorded as its own item, since it amends AC7/§11's own "wait
      for confirmation" procedure rather than answering OQ1-5 as originally framed. See Debug Log.
- [x] 1.5 **Re-verified, not trusted from context.** `git fetch --all`; `git grep -hoE
      '^## D[0-9]+'` over every `origin/story-*` and `origin/main` ref → highest hit **D42**
      (`main`, Story 6.2). `story-4-9/pr-1-context` holds `D35`, confirmed unmerged (Task 1.2), no
      collision. **Next free: D43.** Matches context-time prediction.
      🔴 **SUPERSEDED 2026-08-26 (session 2): the number is `D45`, not `D43`** — Oleg's OQ10 decision,
      option (a). **The measurement above is left exactly as taken and is not rewritten, because it was
      not wrong — it was BLIND.** `git grep` over refs cannot see a decision authored in the operator's
      own checkout and never pushed, and `D43` was written exactly that way (branch
      `docs/prod-temporary-hostname`, commits `bd4e4b83`/`1c54f32d`, not on the remote). *"Matches
      context-time prediction"* is therefore true and reassuring and was **both**, which is the part
      worth remembering: two independent runs of an unsound check agreeing is not corroboration.
      **The check itself is unchanged and the process half of OQ10 stays OPEN.**

### Task 2 — Identify the running production commit, and prove the commit is buildable here (AC: 1) — **0 runs**
- [x] 2.1 **Done.** Reached s2 (`root@175.110.122.17`) over the NFR7 administrative SSH path —
      the same key-based, workstation-only access this project has used for s1 throughout, key-based,
      **not** a Forgejo-held credential (`S2_SSH_*` secrets were removed from Forgejo entirely by
      the 2026-08-11 deploy-runner change). **Read only**: `docker ps` and `docker inspect` alone —
      no `rmi`, no restart, no compose verb, and no Forgejo job of any kind was involved.
- [x] 2.2 **Done — pasted verbatim.** `docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}' |
      grep fe-prionex`:
      ```
      fe-prionex   ghcr.io/crm-prionex/fe-prionex:main   Up 3 days (healthy)
      ```
      Confirms the moving branch reference, exactly as `.github/workflows/CD.yml` predicts — **stated
      as read, not assumed.** `docker inspect fe-prionex`:
      ```
      Config.Image: ghcr.io/crm-prionex/fe-prionex:main
      Image (config digest): sha256:d14cb7daba589a911f7d04bee2f009be78e71205a7dff5abf94f8995c5105318
      Created: 2026-08-22T19:49:53.147612208Z
      ```
      `.RepoDigests` (via `docker image inspect` on that config digest):
      ```
      ghcr.io/crm-prionex/fe-prionex@sha256:d14cb7daba589a911f7d04bee2f009be78e71205a7dff5abf94f8995c5105318
      ```
- [x] 2.3 **Done — labels pasted verbatim** (`docker inspect fe-prionex --format
      '{{json .Config.Labels}}'`, relevant keys):
      ```
      "org.opencontainers.image.revision": "41ab0470ab6b3df3bc332fc90f8bccaaba44dc39",
      "org.opencontainers.image.version": "main",
      "org.opencontainers.image.created": "2026-08-22T19:47:22.014Z"
      ```
      **Commit: `41ab0470ab6b3df3bc332fc90f8bccaaba44dc39`** (full 40-hex, counted: 40 characters).
      **First 12: `41ab0470ab6b`.** Label present and non-empty — no escalation needed on this
      subtask's own trigger.
- [x] 2.4 ✅ 🔴 **PERMANENT RECORD — the gate worked exactly as designed, and this measurement
      outlives the story.** 2026-08-26, `root@175.110.122.17` (NFR7 admin path) and a fresh
      `git fetch --all` (1429 remote refs, branches and every open PR head, not just
      `origin/main`): the container `fe-prionex` runs `ghcr.io/crm-prionex/fe-prionex:main` (the
      moving branch tag, confirmed not assumed — Task 2.2), whose
      `org.opencontainers.image.revision` label reads `41ab0470ab6b3df3bc332fc90f8bccaaba44dc39`
      (Task 2.3). Checked against Forgejo:
      ```
      $ git cat-file -e 41ab0470ab6b3df3bc332fc90f8bccaaba44dc39^{commit}
      fatal: Not a valid object name 41ab0470ab6b3df3bc332fc90f8bccaaba44dc39^{commit}

      $ git log -1 41ab0470ab6b3df3bc332fc90f8bccaaba44dc39
      fatal: bad object 41ab0470ab6b3df3bc332fc90f8bccaaba44dc39
      ```
      Prefix sweep against every ref (`git rev-list --all | grep -i '^41ab'`) — **zero hits**,
      ruling out a truncation or typo explanation. **This is the project's first direct proof that
      the GitHub and Forgejo repositories have diverged** — not a hypothetical from `#d7`/`#d19`
      but a named commit, confirmed absent by exhaustive search. **The gate did exactly its job**:
      it stopped this story before the one-shot, irreversible `environment: prod` dispatch (§3),
      and no permanent tag was minted against a commit whose presence was never confirmed. **This
      is a successful precondition check, not a story failure — read it as the gate working, not as
      6.3 stalling.** Escalated as Open Question 6.

      ✅ **RESOLVED, 2026-08-26 — Oleg's decision, verbatim, via the coordinator:** *"Занесу коммиты
      в Forgejo."* **Option (a) chosen** (import the missing history from a local clone).
      **Options (b) and (c) — accepting the nearest present ancestor, or unblocking the
      GitHub→Forgejo transition first — were explicitly declined, recorded as refusals, not as
      silence:** the consequence Oleg named directly is that Story 6.3 will build **the exact
      running commit**, not an approximate one — *"компромисс «образ катовера — не тот коммит, что
      крутится» в проект не входит."* **Work paused per Oleg's explicit instruction — do not
      resume until he signals the commit has landed** (he has set up his own watch for
      `41ab0470ab6b3df3bc332fc90f8bccaaba44dc39` appearing in Forgejo). `PENDING (owner: Oleg)` —
      not "waiting on nothing", a named owner with a named resolution in progress.

      🔴 **When work resumes: this subtask is RE-VERIFIED, not resumed from where it stopped.**
      Two facts, both potentially stale by the time Oleg signals: (1) confirm
      `41ab0470ab6b3df3bc332fc90f8bccaaba44dc39` is now a **complete, reachable** commit object in
      Forgejo (`git cat-file -e …^{commit}` plus `git log -1`, not merely present as a dangling
      blob); (2) confirm s2 is **still** serving this same commit — GitHub keeps merging to its own
      `main` throughout the wait, so production may have moved. If the label now reads a different
      revision, **that is a new commit and a new gate, not a continuation of this one** — Task 2.1-
      2.3 are re-run in full, not assumed unchanged.
- [x] 2.5 **Recorded — what the identification does not prove, named rather than overclaimed:**
      this does not prove s2 has not been deployed to by hand since this image was built (only that
      *this* container's current image carries this label); it does not prove the image was built
      **from** this commit rather than merely **labelled** with it — the label is written by the
      same `docker/metadata-action@v5` step that resolved the ref on the legacy GitHub pipeline, an
      identity on that path, the same limitation `record-preprod-candidate.yml`'s own header
      records for its G6. **Moot for this session in one sense and not in another**: Task 2.4's
      gate failure means this evidence is not being acted on by a dispatch right now, but the
      identification itself stands as-is, ready to be re-used if Oleg's resolution of Open Question
      6 confirms this exact commit (e.g. "import it") rather than substituting a different one.

### Task 3 — Zero-dispatch preconditions, pasted rather than characterised (AC: 2, 5, 10) — **0 runs**
- [x] 3.1 **Done — pasted, taken before the new file was added.** `ls .forgejo/workflows/` in this
      worktree at `bb4ea59b`:
      ```
      README.md                        deploy-preprod.yml
      build-buildkit-cni-image.yml     deploy-stand.yml
      build-main.yml                   dev-reset.yml
      build.yml                        record-preprod-candidate.yml
      ci.yml                           verify-cni-netns-isolation.yml
      deploy-dev.yml
      ```
      **11 entries — the exact count `docs/production-approval-regulation.md` dates at 2026-08-25.**
      After Task 5.1 adds `record-prod-image.yml` the count is **12**, re-measured: `ls | wc -l` → `12`.
      The regulation's other clause, *"no PROD deploy caller"*, **stays true** — the new file records
      registry markers and dispatches no deploy. This is the baseline §7(a)'s amendment moves.
- [x] 3.2 **Done — documentary observation, cited by search string per this project's rule.** Order of
      execution inside `build.yml`'s single `build-and-push` job, established by reading the file:

      | # | Step / clause (search string) | Kind |
      |---|---|---|
      | 1 | `Read the environment's URLs from OpenBao` → `_check_url VITE_API_BASE_URL` | prod-specific, fail-closed |
      | 2 | `Select the operator phone URL for this environment` → `a prod build must carry an operator phone URL` | **prod-only**, fail-closed |
      | 3 | `Compute tags from the checked-out commit` → `KEEP_RE=` | fail-closed |
      | 4 | `Query the pre-existing digest of sha-` | predigest read (D24) |
      | 5 | `Build and push image` — pushes `steps.tags.outputs.push_tags` | 🔴 **FIRST REGISTRY WRITE** |
      | 6 | `Enforce AC2 — attach or refuse` | attaches `sha_tag` |
      | 7 | `Assert every tag resolves to this run's digest` | fail-closed |

      **Every prod-specific fail-closed guard runs strictly BEFORE the first registry write.** That is
      §3's mitigation 1, confirmed by reading rather than assumed — and it is exactly the bar Open
      Questions item 9 raised: *"все prod-специфичные гарды и сверка коммита обязаны отработать до
      любого пуша в реестр, а шаг сборки пушит только 14-дневный санитизированный тег."*
      **Both halves of that sentence are now verified against the file.**
- [x] 3.3 **Done — and the epic's wording is confirmed stale.** `build.yml` splits the two names
      deliberately (search string `push_tags` / `sha_tag`):
      ```
      echo "push_tags=${IMAGE}:${SANITIZED}-${ENV_SUFFIX}" >> "$GITHUB_OUTPUT"
      echo "sha_tag=${IMAGE}:sha-${SHORT_SHA}-${ENV_SUFFIX}" >> "$GITHUB_OUTPUT"
      ```
      and the build step consumes **only the first** (`tags: steps.tags.outputs.push_tags`). So an
      `environment: prod` dispatch produces, in order:
      1. `<sanitized-ref>-prod` — pushed by the build step. **MUTABLE, and NOT protected** (Task 3.4's
         compile below). Expires at 14 days.
      2. `sha-<12hex>-prod` — attached afterwards by `Enforce AC2` via `imagetools create`. **PERMANENT.**
      3. `buildcache` — written by `cache-to`, outside the tags step, `ignore-error=true`.

      🔴 **Discrepancy for the decision record:** epic AC2 says the image is *"pushed to
      `git.crm-prionex.com/crm/fe-prionex` tagged `sha-<commit>`"*. **The bare `sha-<commit>` shape no
      longer exists** — Story 3.3's environment discriminator replaced it with `sha-<12hex>-<env>`, and
      the epic text was never amended. Recorded here so it is carried into the decision record rather
      than discovered as a mismatch at grading time.
- [x] 3.4 **Done — read from the STORED rule, not from any copy.** Channel named rather than implied:
      `ssh root@10.67.0.1` → `docker exec forgejo-postgres psql -U forgejo -d forgejo`. This is a
      **read-only DB query over the administrative SSH path, not a Forgejo API call**, so it sits on the
      dev-agent side of the labour split (§11); the subtask's original `PENDING (owner: coordinator)`
      marking anticipated the API route, which was not the one used. Row pasted verbatim:
      ```
      id|enabled|type|keep_count|keep_pattern|remove_days|remove_pattern|match_full_name
      1|t|container|0|fe-prionex/(prod-current|preprod-current|latest|buildcache|v?\d+\.\d+\.\d+.*|(pre)?prod-[0-9a-f]{7,64}|sha-[0-9a-f]{7,64}-(pre)?prod|sha256:[0-9a-f]{64})|14|fe-prionex/.+|t
      (1 row)
      ```
      **It matches the transcription in `docs/migration-decisions.md` ("Восстановление правила очистки
      реестра") character for character**, including the `sha256:` clause being INSIDE the group — the
      placement that record warns is invisible to the eye. Compiled against every name this story will
      create (`match_full_name = t`, so the compile is against `fe-prionex/<tag>`):

      | Full name | `keep_pattern` | Verdict |
      |---|---|---|
      | `fe-prionex/sha-41ab0470ab6b-prod` | matches `sha-[0-9a-f]{7,64}-(pre)?prod` | **KEEP** |
      | `fe-prionex/prod-41ab0470ab6b` | matches `(pre)?prod-[0-9a-f]{7,64}` | **KEEP** |
      | `fe-prionex/prod-current` | literal alternative | **KEEP** |
      | `fe-prionex/41ab0470ab6b3df3bc332fc90f8bccaaba44dc39-prod` | no alternative matches | **not kept — expires at 14 days** |

      **Expected three-of-four confirmed exactly**, including the fourth's non-protection. Control, free
      and taken: `fe-prionex/sha-a99ccd44c5a3-preprod` — the real PRE-PROD candidate — also compiles
      **KEEP**, so the compile is not vacuously matching everything.
      🔴 **AC5's disposition, in the required word: the rule is `UNPROVEN` by execution** (`#d38` §9).
      It has never been observed deleting anything and therefore has never been observed **keeping**
      anything. **COMPILED is the claim. Protected-by-execution is not available and is not made.**
      First observable date **2026-08-29**; owner **Story 6.3** (Open Question 8, Oleg's own reassignment).
- [x] 3.5 **Done — recorded, and no substitute constructed.** `secret/fe/prod/app` **cannot be
      pre-read by this story**: its AppRole credentials exist only as Forgejo repository secrets
      (`OPENBAO_PROD_ROLE_ID` / `OPENBAO_PROD_SECRET_ID`), and Forgejo secret values are write-only —
      they cannot be read back through the API or the UI. **Prohibition 6 is honoured: no substitute
      check is built, and no "prerequisites verified" claim is made.** What exists instead is a **dated
      citation**, and it is labelled as one: `docs/forgejo-migration.md` and `3-3-…md` both record the
      path as holding `https://api.crm-prionex.online` / `wss://api.crm-prionex.online`;
      `deferred-work.md` records that the path *"has never been read by anything"*.
      ✅ **What CAN be measured, was — and it is a different claim from the one Prohibition 6 forbids.**
      The **live production bundle** was read over public HTTP, touching no host and no credential:
      ```
      $ curl -s https://crm-prionex.online/assets/index-D8ZYo8qY.js | grep -oE '(https|wss)://api[^"]*'
      https://api.crm-prionex.online
      wss://api.crm-prionex.online
      ```
      This does **not** verify the OpenBao secret — it verifies **what production actually serves**,
      which is the value the secret is supposed to reproduce. It is the same evidence class Story 5.2
      used (test the artifact, not the input it was fed) and it gives Task 4 a target to compare the
      built bundle against. **The gap Prohibition 6 names stays open and stays named**: the first true
      read of `secret/fe/prod/app` is the prod dispatch itself.
      ⚠️ `OPENBAO_PROD_SECRET_ID` expires **2027-06-09** and nothing rotates it (Story 7.6).

### Task 4 — 🔴 THE ONE-SHOT BUILD (AC: 2, 7) — **1 dispatch, and it cannot be taken back**
- [x] 4.1 ✅ **GATE CLOSED IN WRITING, 2026-08-26, every clause evidenced before the dispatch was sent.**
      **Task 2 complete and re-evidenced against the NEW source commit** (correct-course `#d46`):
      `git cat-file -e a99ccd44c5a39345fa65eb74e87343b187e129e9^{commit}` → present as a complete
      commit object; `git log -1` → `2026-08-25 13:12:39 +0200`, Story 5.5 closeout merge (#85);
      reachable from `origin/main`; `git rev-parse --short=12` → **`a99ccd44c5a3`, byte-identical to
      the existing `preprod-a99ccd44c5a3` marker**. **Task 2.4 green** — the gate that halted session 1
      passes for this commit. **Open Questions 1-5, 7, 8 answered** (session 1); **OQ6 superseded**;
      **OQ item 9 authorises dispatch-on-readiness**. **The amended ACs landed first** — `origin/main`
      @ `f144ee9f`, merged into this branch before any evidence was gathered, so nothing here is
      recorded against a superseded criterion.
      **Pre-push preconditions, all measured, none assumed:**
      | Check | Result |
      |---|---|
      | `vars.VITE_OPERATOR_PHONE_URL_PROD` | `https://phone.crm-prionex.online` — https, dotted host; `build.yml` fails a prod build closed without it |
      | OpenBao seal status | **`"sealed":false`**, Shamir `t:3 n:5`, v2.6.1 — the single most likely pre-push failure, cleared |
      | OpenBao AppRole secrets | all 7 present on the repo |
      | Registry credentials | all 4 present at **org** level (`REGISTRY_USER`, `_RO`, `REGISTRY_TOKEN_RW`, `_RO`) |
      | Any pre-existing `prod` tag | **NONE** — the registry held zero `prod-*` versions, so the one-shot was genuinely unfired |
- [x] 4.2 ✅ **Sent verbatim before it was made, then dispatched without waiting** — OQ item 9's
      *«Запускай по готовности»*, which supersedes this subtask's original "wait for confirmation":
      ```
      POST /api/v1/repos/CRM/fe-prionex/actions/workflows/build.yml/dispatches
      {"ref":"main","inputs":{"ref":"a99ccd44c5a39345fa65eb74e87343b187e129e9","environment":"prod"}}
      ```
      🔴 **The two `ref`s are different things and this is the trap `build.yml`'s own comments warn
      about:** the outer `ref` is the branch the WORKFLOW FILE is read from (`main`); the inner
      `inputs.ref` is what gets CHECKED OUT AND BUILT. Predicted tags, both stated before the run:
      `a99ccd44c5a39345fa65eb74e87343b187e129e9-prod` (sanitized ref, mutable, **not** in
      `keep_pattern`, expires at 14 days — compiled in Task 3.4) and `sha-a99ccd44c5a3-prod`
      (**PERMANENT**).
- [x] 4.3 ✅ **Dispatched. `HTTP 204`. RUN 598**, event `workflow_dispatch`.
      🔴 `commit_sha` on the run row reads `f144ee9f…` — **that is the DISPATCH ref (`main`), not what
      was built.** Recorded because a later ledger read that attributes by `commit_sha` would
      mis-attribute this run; the built commit is only visible in `inputs.ref` and in the image's own
      labels. Started `11:02:16Z`, stopped `11:08:40Z` — **384 s**.
- [x] 4.4 ✅ **Outcome read from the run's STEP TABLE and from the registry, never from a job log.**
      All **14** steps status `1` (success), in order:
      ```
       0 Checkout code                                   ✅
       1 Install docker CLI                              ✅
       2 Verify docker CLI reaches the nested daemon     ✅
       3 Create the build network                        ✅
       4 Log in to git.crm-prionex.com                   ✅
       5 Set up Docker Buildx                            ✅
       6 Assert RUN-step netns isolation                 ✅
       7 Read the environment's URLs from OpenBao        ✅  ← FIRST EVER read of secret/fe/prod/app
       8 Select the operator phone URL                   ✅  ← the prod-only fail-closed arm
       9 Compute tags from the checked-out commit        ✅
      10 Query the pre-existing digest (3.6 AC2)         ✅  ← absent → attach branch taken
      11 Build and push image                            ✅  ← the point of no return
      12 Enforce AC2 — attach or refuse                  ✅
      13 Assert every tag resolves to this run's digest  ✅
      ```
      🔴 **Step 7 is a project first.** `secret/fe/prod/app` had *"never been read by anything"*
      (`deferred-work.md`), and the `fe-prod` AppRole had never logged in outside Story 1.12's own
      probe. Both are now exercised **by execution**, which is a stronger claim than any document
      about that path — and it was obtained without violating Prohibition 6, because it is the build's
      own read, not a substitute pre-check constructed for the gate.
- [x] 4.5 ✅ **Both tags read back from the registry independently of the run** (`package_version`
      joined to `package_property`, not the run's own output):
      🔴 **CORRECTED 2026-08-26, and the correction is mine: the first version of this subtask read
      the digests from the WRONG INSTRUMENT.** It reported
      `sha256:334daaa5462d69f007662851e3852fde539932c364e6285a5b392067f2e8ee6d`, taken from
      `package_property.container.digest` in Forgejo's database. **That column is not the manifest
      digest.** Measured against the registry itself with the same client the workflows use:

      | Tag | Created | Manifest digest (registry, authoritative) |
      |---|---|---|
      | `a99ccd44c5a39345fa65eb74e87343b187e129e9-prod` | `11:07:59Z` | `sha256:f30c794123bafbdefc5cf4ec5815e1aaf0739e6b6819117d56d495ac8efea3f3` |
      | `sha-a99ccd44c5a3-prod` | `11:08:10Z` | `sha256:f30c794123bafbdefc5cf4ec5815e1aaf0739e6b6819117d56d495ac8efea3f3` |

      **The CONCLUSION of this subtask was right and is unchanged** — both names resolve to one
      manifest, and `Enforce AC2` therefore did not rebuild or re-wrap anything. **Only the value was
      wrong, and it was wrong because it came from a database column rather than from the registry.**
      🔴 **Control that settles which instrument to trust**, and it is free: `preprod-a99ccd44c5a3`'s
      `container.digest` reads `sha256:58f7c60199e9…`, while the registry and
      `docs/preprod-candidates.md` **agree with each other** on
      `sha256:a62e868786cd42811141590f919c632cf559b06ef6045dc44b0b2607bf2086b2`. The ledger this
      project already keeps was written from the registry; the database column is some other quantity
      and several tag rows do not carry it at all.
      **Standing rule this produces: read manifest digests from the registry
      (`docker buildx imagetools inspect --format '{{.Manifest.Digest}}'`), never from
      `package_property`.** The database is fine for *which versions exist*; it is not the authority
      for *what they point at*.

      **Identical digests, 11 seconds apart** — exactly the shape D24 specifies: the build step pushes
      only the mutable branch tag, then `Enforce AC2` attaches the permanent name to **the same
      manifest** by registry-side retag, and step 13 asserts it. **A single manifest, not an OCI
      index** — `provenance: false` and the absence of a wrapping index both hold.
      **This digest is the only input Task 5.3 may use.**
- [x] 4.6 ✅ **Not triggered — the run did not fail.** The classification rule stands unused and is
      left in place for whoever needs it next. **AC2 is met.**

### Task 5 — Ship `record-prod-image.yml` and its live outcome matrix (AC: 3, 6) — **~5-6 dispatches**
- [x] 5.1 **Done — `.forgejo/workflows/record-prod-image.yml` shipped.** Dispatch-only; inputs
      `image_tag`, `acknowledgement` (exact literal `MOVE-PROD-CURRENT`) and `allow_current_move`
      (default `false`). Guards in execution order, mirroring 5.4's numbering so the two files read as
      siblings: **G1** acknowledgement (first step of the only job, **zero network calls**), **G2**
      `-prod` suffix with an explicit `-preprod` rejection arm, **G3** exactly-12-hex derivation,
      **G4** `keep_pattern` compile for both markers, write-target-is-this-literal-repository assertion,
      then login → buildx → classified-404 candidate probe → digest resolve → **G6** label agreement.
      `prod-<sha>` is written **before** `prod-current`; `--prefer-index=false` on every
      `imagetools create`; **every write is read back** and the run fails on mismatch.
      **No `G5`-equivalent, with the reason in the file's own header in those words** — there is no PROD
      stand, and a guard whose referent does not exist is not a guard.
      **Verified mechanically before any dispatch was contemplated:**
      - `yaml.safe_load` parses the file; 17 steps, `runs-on: node-20`, own literal concurrency group
        `record-prod-fe-prionex-prod` (**not** copied from any deploy workflow — Story 5.3's
        Prohibition 7).
      - **Prohibition 12 checked mechanically, not by eye**: all **15** `run:` bodies scanned for the
        expression syntax — **zero occurrences**, comments included.
      - `bash -n` on all **15** `run:` bodies — **all clean**.
      - **`secrets.REGISTRY_TOKEN_RW` / `REGISTRY_USER` named directly; no `secrets: inherit`**, so this
        file does not pre-empt Story 6.4's decision (§13 item 3).
      🔴 **One deliberate divergence from 5.4's shape, recorded rather than absorbed:** a `prod-current`
      **move is refused by default** and needs `allow_current_move: true`. 5.4's `preprod-current` step
      moves freely. The reason is dated and specific: this story is the **first** write of `prod-current`,
      so on its own real dispatch the tag must not exist at all — a move on that run would mean something
      outside this project's knowledge wrote the production pointer first, and the correct answer to that
      is to stop. **Story 6.6 sets its own policy and does not inherit this default**; the file says so.
- [x] 5.2 **Done — and it is PRINTED, not only commented.** The file's header states what the markers
      assert and what they do not, in four numbered clauses: (a) **no host is serving this image** — s2
      serves `ghcr.io/crm-prionex/fe-prionex:main` until the external traffic switch, so `prod-current`
      is a Forgejo-side cutover pointer, with `#d19`'s own precedent cited; (b) the image is **not
      validated** by this record — 🔴 **clause (b) rewritten 2026-08-26 (`sprint-change-proposal-2026-08-26-cutover-candidate.md`, `#d46`): validation
      is not something these markers assert either way, and for THIS story's image the commit **is**
      validated and would pass 6.5's guard; (c) it is **not byte-identical** and
      why (`vite.config.ts`, `Date.now()`, D24 §2b); (d) protection is **compiled, not observed**.
      **The last step of the job emits the same statement to stdout and `$GITHUB_STEP_SUMMARY`** — this
      is the H3 defect from `record-preprod-candidate.yml`'s own review, where a paragraph claimed to be
      printed while living only in a YAML comment no execution emits. **It is not repeated here.**
      🔴 The header additionally records what a reader would otherwise file as a bug: **neither marker is
      deployable** — `deploy-stand.yml` refuses any `image_tag` not ending in the environment suffix, and
      `prod-<12hex>` / `prod-current` end in neither. **Story 6.9 dispatches `sha-<12hex>-prod`.**
      ✅ **All four pure-shell guards exercised locally before any dispatch**, extracted from the shipped
      YAML and run against pass and discriminating inputs — 15/15 as specified:
      ```
      G1  MOVE-PROD-CURRENT -> PASS   | 'yes' / '' / lowercase        -> REFUSE
      G2  sha-41ab0470ab6b-prod -> PASS | sha-a99ccd44c5a3-preprod    -> REFUSE (names PRE-PROD)
                                        | main-dev / prod-current     -> REFUSE (no -prod suffix)
      G3  12-hex -> PASS, derives prod-41ab0470ab6b + prod-current
          40-hex -> REFUSE, message names the length (#d18 §3's failure, made to fire)
          7-hex / uppercase -> REFUSE
      G4  prod-41ab0470ab6b + prod-current -> PASS (both compile)
          40-hex marker / 'production-<hex>' -> REFUSE
      ```
      **This is a local exercise of the shell logic, NOT a live outcome matrix.** §9's matrix needs run
      ids and stays **OPEN** — Tasks 5.3-5.6, which cannot run until Task 4 has produced an image.
- [x] 5.3 ✅ **Done — RUN 600, all 17 steps green.** Dispatched verbatim, then made without waiting
      (OQ item 9):
      ```
      POST .../actions/workflows/record-prod-image.yml/dispatches
      {"ref":"story-6-3/pr-1-context","inputs":{"image_tag":"sha-a99ccd44c5a3-prod",
       "acknowledgement":"MOVE-PROD-CURRENT","allow_current_move":"false"}}
      ```
      🔴 The outer `ref` is `story-6-3/pr-1-context`, not `main`: **this workflow does not exist on
      `main` yet** — it lands there only when this story's PR merges. Recorded because a reader who
      assumes every dispatch reads its workflow from `main` will not be able to reproduce this run.
      **Guard order actually executed** — every fail-closed guard before any network call, exactly as
      designed: `G1` acknowledgement → `G2` `-prod` suffix → `G3` twelve hex → `G4` `keep_pattern`
      compile → write-target assertion → *then* login, buildx, classified-404 probe, digest resolve,
      `G6` labels → probe/write/read-back `prod-<sha>` → probe/write/read-back `prod-current`.
      **Markers read back from the registry, independently of the run**, with the authoritative client
      rather than the database column (see 4.5's correction):
      | Tag | Manifest digest |
      |---|---|
      | `sha-a99ccd44c5a3-prod` | `sha256:f30c794123bafbdefc5cf4ec5815e1aaf0739e6b6819117d56d495ac8efea3f3` |
      | `prod-a99ccd44c5a3` | `sha256:f30c794123bafbdefc5cf4ec5815e1aaf0739e6b6819117d56d495ac8efea3f3` |
      | `prod-current` | `sha256:f30c794123bafbdefc5cf4ec5815e1aaf0739e6b6819117d56d495ac8efea3f3` |

      **All three resolve to one manifest.** Written in the specified order — `prod-a99ccd44c5a3` at
      `11:17:09Z`, `prod-current` at `11:17:10Z`: history before pointer, one second apart.
      **Control, taken because a compile that matches everything proves nothing:**
      `sha-a99ccd44c5a3-preprod` and `preprod-a99ccd44c5a3` both resolve to
      `sha256:a62e868786cd…2086b2` — a different manifest, and the one
      `docs/preprod-candidates.md` records. **The PROD image is therefore demonstrably NOT the
      PRE-PROD artifact** — Option C's rebuild, visible as two digests for one commit (NFR11), which
      is a measured fact rather than the vacuous byte-comparison Prohibition 7 forbids.
      **AC3 is met.**
- [~] 5.4 🚫 **CANCELLED BY OLEG, 2026-08-26 — *«отмена Task 5.4»*. Recorded as a decision with its
      cost named, not as a skipped subtask.** The four discriminating dispatches (wrong
      `acknowledgement`; a real `sha-a99ccd44c5a3-preprod`; the 40-hex form; `sha-000000000000-prod`
      for the classified 404) were **not made**.
      🔴 **What this costs, stated plainly: `record-prod-image.yml` ships with SIX GUARDS WHOSE
      REFUSAL PATH HAS NEVER BEEN OBSERVED LIVE.** One dispatch (run 600) has exercised the **pass**
      path end to end. Nothing has ever watched G1, G2, G3, the 404 classifier or G6 actually refuse
      anything on this instance.
      🔴 **What must NOT be substituted for it, and the distinction is the whole point.** Task 5.2
      exercised all four pure-shell guards **locally**, 15/15, against pass and discriminating inputs
      — extracted from the shipped YAML and run under `bash`. That is genuine verification of the
      **shell logic** and it is recorded as such. It is **not** a live outcome matrix: it never
      touched Forgejo, never proved the guard is reached in the real step order, never proved the
      workflow parses and schedules the way the run does, and never produced a run id. **Relabelling
      the local run as the matrix would be exactly the defect retro-E5 exists to prevent**, and this
      project has caught that shape before (5.6's §9 "negative control" that could not have failed on
      either axis). It is not done here.
      **Owner: Oleg**, whose decision this is. **Inherited by whoever next dispatches this file** —
      Story 6.6, which the file's own header says may adopt, extend or supersede it.
- [~] 5.5 🚫 **CANCELLED — falls away with 5.4.** It exists to re-read both markers after each refusal
      and confirm they are unmoved; with no refusals dispatched there is nothing to confirm. **The
      markers were nonetheless read back independently after the one dispatch that did happen** — see
      5.3 — so the state of the registry is evidenced, just not against a refusal.
- [~] 5.6 🚫 **CANCELLED — §9's matrix is NOT filled and its status is `OPEN`.** One row is earned
      (the pass row, run 600). Four discriminating rows are **not earned and are not claimed**. The
      G4-equivalent remains **force-test only** and the G6-equivalent **unexercised**, both as
      predicted at context time. The G5-equivalent remains a **named absence** — there is no PROD
      stand until Story 6.10 — which is unaffected by this cancellation and was never earnable here.

### Task 6 — Record the decision and the commit-identity comparison (AC: 4, 8) — **0 runs**
- [~] 6.1 🚫 **CANCELLED BY OLEG, 2026-08-26 — *«Task 6 - отменить»*.** The commit-identity
      comparison was not written up. **The two values exist and are already in this file** (Task 2.3:
      s2's `41ab0470ab6b3df3bc332fc90f8bccaaba44dc39`; Task 4.4/5.3: the built image's
      `a99ccd44c5a3…`), so the *evidence* survives — what does not happen is the deliberate comparison
      AC4 asks for, and its "this could have failed, and here is how" statement.
- [~] 6.2 🚫 **CANCELLED.** The construction-half statement was not written. 🔴 **Nothing here claims
      the byte-difference as measured** — Prohibition 7 is honoured by *omission* rather than by a
      correct statement, which is weaker but not a breach.
- [~] 6.3 🚫 **CANCELLED — `D45` IS NOT WRITTEN, and the number stays reserved rather than used.**
      This story ships **with no decision record at all**. Everything `D45` was to carry — the build
      source and its evidence, the epic-AC-vs-shipped-tag discrepancy (`sha-<commit>` vs
      `sha-<12hex>-prod`), §5's mechanism decision and its three rejected alternatives, §6's
      `prod-current` semantics, §12's exception, and §7(f)'s correction — **exists only in this story
      file and in the commit messages of this branch.** `#d46` (the correct-course record) covers the
      *build-source change*; it does not cover any of the above.
- [~] 6.4 🚫 **CANCELLED.** No forward note under `#d18` (the twelve-hex rule was consumed live for
      the first time and that is recorded nowhere in the decisions file), and none under `#d19`.
      🔴 **Consequence for the ledger:** `deferred-work.md`'s entry *"identifying which is Story 6.3,
      and nobody has done it"* — **owner Story 6.3** — is in fact **discharged** (session 1 identified
      `41ab0470…` from s2 by evidence, and the finding stands even though the story no longer builds
      that commit), but **it is not marked discharged anywhere**, so it will read as open.

### Task 7 — Reconcile Story 6.2's artifacts (AC: 9) — **0 runs**
- [~] 7.1 🚫 **CANCELLED BY OLEG, 2026-08-26 — *«Task 7 отменить»*.** The regulation is **not**
      amended. Three things therefore stand unreconciled:
      **(a)** its dated census *"`ls .forgejo/workflows/` — 11 entries"* is now **wrong** — measured
      today: 11 before this story, **12** after. Its other clause, *"no PROD deploy caller"*, remains
      **true**.
      **(b)** 🔴 **A LIVE CONTRADICTION IS LEFT STANDING, AND IT BLOCKS STORY 6.9.** The shipped rule
      reads: *"Restoring a tag already in `docs/prod-releases.md`'s `prod_tag` column is not a new
      release and needs no new approval … A rollback to a tag not in the ledger is a release and needs
      Oleg."* This story minted `prod-a99ccd44c5a3` / `prod-current` and appended **no ledger row**
      (Prohibition 9 — no approval was sought and none was given). Story 6.9's FR32 dispatch is
      `rollback: true` against exactly this tag. Under the rule as written that dispatch is *a rollback
      to a tag not in the ledger*, therefore **a release**, therefore **it needs Oleg** — and the same
      document records **no delegate** (`«Оставить как есть»`, 2026-08-25). **While Oleg is
      unavailable, the cutover cannot proceed at all.** This is not a wording quibble; it is a
      precondition Story 6.9 will hit.
      **(c)** the one line stating the PROD freeze window does not bind a story that appends no row and
      deploys nothing is not written; whether a build counts is left ambiguous.
      🔴 **Open Question 5 was ANSWERED — *«Поправить регламент в 6.3»*, narrowed to "by tag name, not
      a general carve-out" — and that answer is now UNEXECUTED.** Recorded here so the reversal is
      visible rather than looking like the question was never asked. **Owner: Oleg.**
- [~] 7.2 🚫 **CANCELLED. This is the subtask that carried the durable half of AC8, and its absence is
      operationally live.** `docs/prod-releases.md` records **nothing** about the three `-prod` forms
      that now exist —
      `sha-a99ccd44c5a3-prod` (permanent, deployable, Story 6.9's target), `prod-a99ccd44c5a3`
      (permanent, history) and `a99ccd44c5a39345fa65eb74e87343b187e129e9-prod` (**not** protected,
      expires ~2026-09-09) — and **nothing about what `prod-current` means before the traffic switch**.
      **No row was added either, which is correct** (Prohibition 9); the omission here is the *prose*,
      not the row. **Owner: Oleg.**
- [x] 7.3 **Done — confirmed by diff, and the check was widened beyond the three files named.**
      `git diff --stat origin/main --` over every frozen path in §12 — `build.yml`,
      `record-preprod-candidate.yml`, `deploy-stand.yml`, `deploy-preprod.yml`, `deploy-dev.yml`,
      `dev-reset.yml`, `ci.yml`, `build-main.yml`, `docs/release-validation-checklist.md`,
      `docs/preprod-candidates.md`, `docs/release-regulation.md`,
      `docs/production-approval-regulation.md`, `docs/prod-releases.md`, `docs/migration-decisions.md`,
      `README.md`, `Dockerfile.prod`, `vite.config.ts`, `src/`, `.github/` — returned **empty output**:
      every one is byte-identical to `origin/main`. `git status --porcelain` in the worktree shows
      exactly one entry, `?? .forgejo/workflows/record-prod-image.yml`. **The three files this subtask
      names are unchanged, and so is everything else that was supposed to be.**

### Task 8 — Close (AC: all) — **1 dev-story push + PR-open + merge rows**
- [x] 8.1 ✅ **Every AC graded against shipped artifacts and pasted evidence, not intention.**

      | AC | Verdict | Evidence, or the reason there is none |
      |---|---|---|
      | **AC1** *(epic)* | ✅ **MET** | s2 read over the NFR7 admin path; `41ab0470…` from `org.opencontainers.image.revision`, pasted at Task 2.3. Re-pointed by `#d46` to a **reference measurement**, and that is the role it plays |
      | **AC2** *(epic)* | ✅ **MET** | Run **598**, 14/14 green, 384 s. `sha-a99ccd44c5a3-prod` exists at `sha256:f30c794123ba…a3f3`, read from the registry |
      | **AC3** *(epic)* | ✅ **MET** | Run **600**, 17/17 green. `prod-a99ccd44c5a3` (11:17:09Z) then `prod-current` (11:17:10Z), history before pointer; all three PROD names on one manifest, read back independently |
      | **AC4** *(epic)* | 🚫 **NOT MET** | Task 6 cancelled by Oleg. The facts are measured and in this file; the comparison AC4 specifies was not written |
      | **AC5** *(epic)* | ✅ **MET** | Task 3.4: `package_cleanup_rule` read from the database itself, all four names compiled, a free non-vacuous control taken, and the disposition recorded in the required word — **`UNPROVEN` by execution** |
      | **AC6** | 🚫 **NOT MET** | Task 5.4 cancelled. One pass row, no discriminating row. The local 15/15 shell exercise is explicitly not substituted |
      | **AC7** | ✅ **MET** | Gate 4.1 closed in writing before the dispatch, every clause with a measurement; the dispatch sent verbatim before it was made |
      | **AC8** | 🚫 **NOT MET** | Both halves cancelled (Task 6's `D45`, Task 7.2's prose). The disclaimer exists only in the workflow header and in run 600's printed output — the tier this project calls best-effort |
      | **AC9** | 🚫 **NOT MET** | Task 7 cancelled; neither 6.2 artifact reconciled, and AC9's own never-drop fallback not taken either |
      | **AC10** | ✅ **MET** | Every claim in this file carries a run id, a pasted state read, or an explicit "not earned" label; the unearned list is at 8.2 |

      **6 of 10 met. Four not met, all by explicit decision of Oleg's, none by oversight, none softened.**
      🔴 **AC4 is an EPIC criterion** — the story does not fully satisfy its own epic requirement, and
      that is stated here rather than left to be inferred from a table.
- [x] 8.2 ✅ **retro-E5 section, and AC10's "not earned" list in those words.**

      **§9's matrix, with the only real run id it has:**

      | Guard | Pass row | Discriminating row | State |
      |---|---|---|---|
      | G1 acknowledgement literal | **run 600** | — | 🚫 not earned |
      | G2 `-prod` suffix | **run 600** | — | 🚫 not earned |
      | G3 exactly 12 hex | **run 600** | — | 🚫 not earned |
      | classified 404 | **run 600** | — | 🚫 not earned |
      | G6 labels agree | **run 600** | — | 🚫 not earned |
      | G4 `keep_pattern` compile | **run 600** | — | ⚠️ force-test only, unreachable through this file's inputs — as predicted at context time |
      | **G5 stand serves the digest** | — | — | ❌ **DOES NOT EXIST.** No PROD stand until Story 6.10. A named absence, not a gap |

      **§9's matrix status: `OPEN`.**

      🚨 **AC10's NOT-EARNED LIST, stated in the required words:**
      1. **The `G5`-equivalent does not exist** and never could here — no PROD stand.
      2. **The byte-difference between this image and what production serves was NEVER MEASURED and is
         not claimed as measured.** ghcr is unreachable **by decision** (`#d7`), so there is no digest
         on the other side; `vite.config.ts`'s `Date.now()` fixes the answer in advance. 🔴 What *was*
         measured is a **different pair**: one commit, two digests — `f30c7941…` (prod) against
         `a62e8687…` (preprod). That is Option C's rebuild, and it is offered as exactly that and
         nothing more.
      3. **`secret/fe/prod/app` was NEVER pre-verified.** Prohibition 6 held: no substitute check was
         built. What exists is the build's **own** read — run 598 step 7, green, the project's first —
         which is evidence *after* the fact, not a pre-check.
      4. **The retention rule is `UNPROVEN` by execution.** Both markers were **compiled** against the
         stored `keep_pattern`; the rule has still never been observed deleting anything, so it has
         never been observed keeping anything. First observable **2026-08-29**; owner **Story 6.3**
         (Oleg's own OQ8 reassignment), and **this story closes before that date, so the observation is
         NOT made and the ownership is not reset to nothing.**
      5. **Six guards ship with no live refusal evidence** (AC6, Task 5.4).
      6. **The product-code delta between what s2 serves and what this image contains is UNMEASURED**
         and cannot be measured from here — reading GitHub is forbidden. Gated on Story 6.9 by `#d46`.
- [x] 8.3 ✅ **PR opened by the coordinator. Oleg merges** — the dev agent does neither (Prohibition 11).
- [x] 8.4 ✅ **LEDGER CLOSED BY QUERY, not self-report (retro-D4).**
      `action_run` joined to `repository`, filtered by `commit_sha IN (…)` over **all 13 commits of this
      branch**, plus the one dispatch row whose `commit_sha` is not a branch commit and is named
      separately below.

      **MEASURED: 14 runs.** Declared ceiling **20** — **under budget, no overrun to name.**

      | Row | Count |
      |---|---|
      | `push` on this branch, attributed by `commit_sha` | 12 |
      | `workflow_dispatch` — run **600**, `record-prod-image.yml` | 1 |
      | `workflow_dispatch` — run **598**, `build.yml` at `environment: prod` | **1, named separately** |
      | **Total** | **14** |

      🔴 **Run 598 is listed on its own line and is NOT found by the `commit_sha` filter.** Its
      `commit_sha` is `f144ee9f` — the **dispatch ref (`main`)**, not the commit it built. Attributing
      by `commit_sha` alone would have **missed this story's single most consequential run**. Named
      rather than quietly folded in, the way Story 6.2 named its own `main`-branch row.
      🔴 **NOT "all green" — state as of the query.** 5 succeeded (566, 569, 589, 593, 600), **7
      CANCELLED** (567, 568, 597, 599, 601, 602, 603) and 1 still **running** (604). The seven are
      ordinary **concurrency eviction** by a later push, **not failures** — the same pattern 6.2
      measured — and they are counted because they consumed a row.
      🔴 **One budgeted line cost ZERO:** the `origin/main` integration merge (`9de45980`) produced no
      run of its own, because it was pushed together with `5f30f3a1` and Forgejo runs the head commit.
      The model over-predicted by one there.
      **Not yet spent, and still to come:** the PR-open row, and the merge row on `main`.
- [x] 8.5 ✅ **`sprint-status.yaml` → `review`.** The HALT mapping does **not** apply: Task 2.4's gate
      is green for the commit actually built, and no one-shot act is awaiting Oleg — both were
      executed. `done` only after the merge, which is Oleg's.

---

## Dev Notes

### 1. The one-paragraph version

Find out, from the container on s2 and its image labels, which commit production is actually serving.
Confirm that commit exists in Forgejo — it may not. Then dispatch `build.yml` **once** at
`environment: prod`, which is the first prod build this project has ever run and which mints a
permanent tag nobody here can delete. Then ship a small new dispatch-only workflow to write
`prod-<sha>` and `prod-current`, because nothing in this repository can, and give it a real outcome
matrix with failing runs. Then write down two uncomfortable truths: that the image is commit-identical
but not byte-identical and that this is measurable only on the first half; and that `prod-current` will
name an image no user is being served until an external traffic switch. Finally, repair the two places
where this story contradicts documents Story 6.2 shipped eight days ago.

### 2. Infrastructure facts, in one place

| Fact | Value | Source, verified 2026-08-26 |
|---|---|---|
| `origin/main` at context time | `cfbad179` (Story 6.2's ledger-closeout, PR #89) | `git log origin/main` |
| Next free decision number | ~~**D43**~~ → 🔴 **D45** (Oleg, 2026-08-26, OQ10 option (a)). `main` holds D42; `story-4-9` holds D35; **`D43` is held by an UNPUSHED local branch** the ref scan cannot see; `story-4-10` holds D44 | scan of every `origin/*` ref, **corrected** by including the operator's own checkout |
| `.forgejo/workflows/` census | **11** files, no `deploy-prod.yml`, no prod recorder | `ls` |
| Legacy production image reference on s2 | `ghcr.io/crm-prionex/fe-prionex:main` — a **moving branch tag** | `.github/workflows/CD.yml`, the deploy job's `docker pull` |
| Commit label written on the legacy path | `org.opencontainers.image.revision` (via `docker/metadata-action@v5`) | `.github/workflows/CD.yml` |
| Commit label written by `build.yml` | `org.opencontainers.image.revision` = **full 40-hex**; `…image.version` = **12-hex** | `build.yml` build step |
| Tags an `environment: prod` dispatch produces | `<sanitized-ref>-prod` (pushed by the build step) and `sha-<12hex>-prod` (attached under the AC2 guard) | `build.yml` tags/attach steps |
| `prod-current` / `prod-<sha>` producer | **NONE EXISTS** — this story builds one | grep over `.forgejo/workflows/` |
| `keep_pattern` (authoritative, from `package_cleanup_rule`) | `fe-prionex/(prod-current\|preprod-current\|latest\|buildcache\|v?\d+\.\d+\.\d+.*\|(pre)?prod-[0-9a-f]{7,64}\|sha-[0-9a-f]{7,64}-(pre)?prod\|sha256:[0-9a-f]{64})`, `keep_count=0`, `remove_days=14`, `match_full_name=true` | `#d38` §9 |
| Retention rule status | **UNPROVEN by execution**; first observable **2026-08-29**; dated item, **no owner** | `#d38` §9; `deferred-work.md` |
| `prod` build path | **NEVER RUN**; `secret/fe/prod/app` **never read by anything** | `deferred-work.md` |
| `secret/fe/prod/app` (recorded, unread) | `https://api.crm-prionex.online` / `wss://api.crm-prionex.online` | `docs/forgejo-migration.md:302` |
| `VITE_OPERATOR_PHONE_URL_PROD` | `https://phone.crm-prionex.online` — the repository's only variable | measured 2026-08-25, Story 5.6 |
| `OPENBAO_PROD_SECRET_ID` | expires **2027-06-09**, nothing rotates it; **value unreadable** | `#d`-changelog 13.08; Story 7.6 |
| PROD deploy target | **s10** (VM `e1-rung3`, `192.168.122.11`, jump `62.112.10.55`) — **not provisioned**, Story 6.10 | `#d23` |
| s2 access | NFR7 **administrative SSH path only**; Forgejo never deploys to s2 (NFR5 amended) | NFR5, NFR7 |
| Job-log archival | **unreliable** — `log_in_storage='f'` seven consecutive checks; `$GITHUB_STEP_SUMMARY` **UNPROVEN** | Stories 5.3/5.4/5.6 |
| `preprod-current` | `sha-a99ccd44c5a3-preprod`, digest `sha256:a62e8687…` — **useful here only as a free discriminating input** (§9) | `docs/preprod-candidates.md` |

### 3. Anti-patterns for this story

1. **Re-dispatching the prod build to "fix" something.** §3. The AC2 guard refuses and blames
   `vite.config.ts`; the permanent tag stays as it was.
2. **Presenting byte-difference as a measurement.** §9. Five prior rejections of this exact vacuity.
3. **Reading the commit off `main` HEAD, the `prod` branch, or GitHub.** `#d19` says the branch asserts
   nothing; Prohibition 4 says GitHub is off-limits including its registry and its API.
4. **Generalising `record-preprod-candidate.yml` by deleting its G5.** §5 option C. A guard with no
   referent is not a guard, and the file is frozen anyway.
5. **Assuming the commit is in Forgejo.** §2(c). No mirror in either direction.
6. **Treating `prod-current` as a statement about what users see.** §6.
7. **Adding a row to `docs/prod-releases.md` because a tag now exists.** No approval happened.
8. **Minting a "smoke" `preprod` tag first.** §4: it exercises none of the prod delta.
9. **Editing `build.yml`.** §12. Every route through it is a trap.

### 4. Previous story intelligence — what this story spends

- **Story 3.6** paid for the AC2 immutability guard, and paid twice: once for the guard, once for
  discovering that `imagetools create`'s `--prefer-index` defaults to **true** and silently made every
  read-back false. **§5 spends both lessons** — `--prefer-index=false` and a read-back instead of an
  `echo "OK"`.
- **Story 5.4** paid for the marker-pair pattern: six guards, write order, read-back, and an honest
  matrix that labelled its own G4 and G6 rows **force-test only**. §5 and §9 copy the shape including
  the honesty.
- **Story 5.6** proved the full PRE-PROD cycle live and, in doing so, spent the `preprod` half of
  `deferred-work.md`'s *"one preprod dispatch before the first real production deploy"* mitigation.
  **§4 records that the mitigation no longer covers what this story is exposed to.**
- **Story 6.2** shipped the regulation and the ledger — and shipped them in dated future tense with an
  explicit expectation that later stories would date-stamp their amendments rather than silently
  rewrite. **§7 is that mechanism being used for the first time.**
- **Story 1.11 / `#d38` §9** paid for reading `keep_pattern` from `package_cleanup_rule` rather than
  from a copy, and for saying **UNPROVEN by execution** out loud. AC5 spends it.

### 5. The autonomous decisions in this story, in one place (for a one-read veto)

Every row was decided by the story author without asking, is defensible on the evidence cited, and is
**subject to Oleg's veto**. 🔴 **Rows 1, 2, 3 and 7 are gates, not announcements** — Task 4 waits for
them (AC7, §11), because the acts they govern are not reversible by this team.

| # | Decision | Why | If vetoed |
|---|---|---|---|
| 1 | 🔴 **A new dispatch-only workflow, `record-prod-image.yml`, writes `prod-<sha>` and `prod-current`.** | §5. Nothing in the repository can write them; 6.6's mechanism lives inside 6.4's file, which cannot run before 6.10. The alternatives are a frozen-file edit, a guard-less manual retag, or a circular dependency. | Name the alternative: a manual `imagetools create` (and accept no run id, no guard, no matrix), or defer `prod-current` (row 2). |
| 2 | 🔴 **Both `prod-current` and `prod-<sha>` are created now, with a written disclaimer about what `prod-current` means before the cutover.** | §6; the amended FR31 and this story's epic AC3 require both, and the retention argument for `prod-<sha>` is real. | Create `prod-<sha>` only and leave `prod-current` to 6.6/6.9 — which reopens the moving-name window the 2026-08-13 amendment closed. Record the reopening. |
| 3 | 🔴 **The running commit is read from s2 over the NFR7 administrative SSH path, never through a Forgejo job on `s2-prod-deploy`.** | §12; NFR5 as amended is absolute about Forgejo and s2, and NFR7 explicitly retains the admin key for exactly this. | Name the substitute path. There is no third one that does not touch GitHub. |
| 4 | **No GitHub read of any kind** — not the Actions run history, not ghcr metadata, not the API — even to corroborate the commit. | Prohibition 4; `#d7` and Epic 6's preamble treat "no action on GitHub" as including its registry, and a read is an action. | Authorise a bounded read and record its scope; the identification then carries two independent sources instead of one. |
| 5 | **Story 6.2's regulation is amended by dated addition (§12-priced exception) rather than left to contradict Story 6.9.** | §7(b): as shipped, the cutover tag is in no ledger row, so 6.9's own FR32 dispatch reads as a release needing an approval that may be unavailable — there is no delegate. | Leave the regulation untouched and file the contradiction against Story 6.9 by name in `deferred-work.md`, with the argument, so 6.9 meets it in writing rather than at the dispatch. |
| 6 | **`docs/prod-releases.md` gets prose and no row.** | Prohibition 9; no approval happened, and the file's own header says a row is appended before a `deploy-prod.yml` dispatch by whoever records an approval. | Add a row and accept that an append-only ledger's first entry records a release that never happened. |
| 7 | 🔴 **The two one-shot acts wait for confirmation instead of proceeding on the absence of a veto.** | §11. `#d38` §7's "announce, don't ask twice" is written for reversible acts; a permanent tag removable only by Oleg in person is not one. | Revert to the standing convention and accept that a mis-dispatch is unrecoverable without an in-person DELETE. |
| 8 | **No `preprod` smoke dispatch of the identified commit.** | §4: 5.6 already exercised the preprod path, and the prod delta — the OpenBao `prod` arm, `fe/prod/app`, the phone-URL `prod` arm — is untouched by a preprod run. It would cost a permanent tag for nothing. | Run one and accept the extra permanent `-preprod` tag. |
| 9 | **No G5-equivalent stand check in `record-prod-image.yml`, with the absence stated in the file and in the matrix.** | §5, §9. There is no PROD stand until 6.10, and a check pointed at s2 would be false. | Defer the whole recorder until after 6.10 — which blocks the cutover image behind a moving host (§2's rejected re-order). |
| 10 | **The epic's `sha-<commit>` wording is read as the shipped `sha-<12hex>-prod`, and the discrepancy is recorded in `D45` rather than reconciled silently.** | AC2; `#d18` §2/§3 fix the length at 12 and bind four stories to it; the bare form matches no `keep_pattern` alternative. | Produce a bare `sha-<commit>` tag as well and accept a 14-day tag that is not a rollback target. |
| 11 | ~~**Decision number D43**~~ → 🔴 **D45** — and the re-verification that was supposed to prevent a collision **did not**, because it scans refs and the colliding record was never pushed. Resolved by Oleg 2026-08-26 (OQ10, option (a)). | Story 4.9 holds D35 unmerged; that is exactly how a collision happens — **and one happened anyway, by the route the check does not cover.** | Push-before-claiming, or a sweep that includes the operator's working checkout. |

### 6. Non-goals — absences that are decisions, not omissions

- **No deploy, anywhere.** Not s2, not s10, not PRE-PROD. 6.9 owns the cutover deploy.
- **No `deploy-prod.yml`, no promotion guard, no smoke check.** 6.4, 6.5, 6.7.
- **No `secrets: inherit` decision.** §5 sidesteps it by construction; 6.4 still owns it.
- **No validation, no `RVC-v1.1` run, no waiver, no candidate row.** §13 item 6.
- **No settlement of which `-prod` form a rollback targets.** 6.4/6.6's.
- **No G5-equivalent guard.** §5, and it is named in the matrix as absent.

### 7. Things pending on Oleg — do not depend on them silently

None of these blocks this story except where marked. All are named so they are not rediscovered.

1. 🔴 **Open Questions 1–5** — these **do** block Task 4 (AC7). Asked day one, Task 1.4.
2. 🔴 **There is no delegate** — Oleg's explicit decision, 2026-08-25, recorded in the regulation:
   *"while Oleg is unavailable nothing can be approved, including an emergency rollback to a tag not
   already in `docs/prod-releases.md`."* **This is the fact that makes §7(b) urgent rather than
   pedantic**, and it is also why Open Questions 1–5 go out on day one rather than at Task 4.
3. 📅 **The retention rule's first observable date is 2026-08-29** and that dated item still has **no
   owner**. Its own escalation clause: *"Epic 5 and Epic 6 both rely on `keep_pattern` protecting
   `prod-current`/`preprod-current` … Escalate rather than record."* **This story is the first to make a
   rollback depend on it.** Not this story's to observe — but AC5 names it.
4. **`secrets: inherit`** — 6.4's mandatory first decision. A PROD caller of the shared callee would
   receive **every org secret, including `REGISTRY_TOKEN_RW`, which has write access over another
   team's packages.** §5 avoids triggering it; it is not resolved here.
5. **`KONG_PORT` on PROD — unmeasured since 2026-08-13**, and PROD's Kong has never been probed for the
   static-CORS defect found on PRE-PROD and again on DEV. *"Probe it before 6.4, not after."* Not this
   story's.
6. **Story 4.5 (Slack) is PARKED** and its webhook is unrecoverable. The standing rule four stories
   depend on holds: **the work must be provable without any notification.** Nothing in this story may
   require one.
7. **M7 — eight unexercised branches in `record-preprod-candidate.yml`**, re-owned to Story 6.4. Not
   forced here, and §5 writes a **new** file rather than exercising that one.
8. 🔑 **Two registry tokens leaked into agent transcripts and cannot be revoked** (an admin cannot
   revoke another account's token on this instance). Both `read:package`. **Relevant here only as the
   standing reason `REGISTRY_TOKEN_RW` is never written into a file and never printed** (Prohibition 13).
9. **`main` has `required_approvals: 0`** (`#d16`) — branch protection blocks direct pushes for everyone,
   but a merged PR is not an approval of anything. Two facts, not one.

### 8. Conventions that bind this story

- **retro-D4** — declare the budget before work; close **only** against a query re-run **after** the
  merge commit lands; if the query cannot be run, close with the literal word **OPEN**. §10.
- **The permanent story-push ledger line** (Story 4.7's review, DN4): each push to the story branch is
  its own priced row; `ci.yml` has **no `paths:` filter**, so a documentation-only commit costs a full
  four-job run; a push landing while the PR is open fires **two** rows. Forgejo's `push` fires once per
  *push*, not per commit — **batch**.
- **retro-E5** — every new guard ships with a live outcome matrix including a discriminating run. §9.
  **This story owes one.**
- **`#d18` §2/§3** — the short SHA is **exactly 12**, and Stories 5.4, 6.3, 6.5, 6.6 are bound to the
  same 12 by name. A 40-hex derivation makes the rollback target and the promotion gate diverge
  **silently**.
- **`#d21`** — no `${{ }}` inside any `run:` body, **including inside its comments**. §5 writes workflow
  code; this is live here.
- **`#d8` / `#d21`** — `concurrency:` is honoured at workflow level and silently dropped at job level,
  and a callee's own block does not apply on the call path. §5's file is dispatch-only, so it declares
  its own group and owns it.
- **NFR5 (amended 2026-08-18)** — Forgejo never deploys to s2 **at all**. **NFR7** retains the old s2
  key as an **administrative** path only. §12 and Dev Notes §5 row 3 rest on both.
- **"Announce, don't ask twice"** (`#d38` §7) — with this story's explicit exception for the two
  one-shot acts (§11, AC7).
- **Frozen files** — §12. A real defect needs a **priced** exception recorded **before** the edit;
  Story 5.3's §12 procedure, verbatim by reference. **It is a procedure, not a permission.**

### Project Structure Notes

**Files this story creates:**
- `.forgejo/workflows/record-prod-image.yml` — new, dispatch-only, guard-bearing (AC3, AC6).

**Files this story appends to (append-only, never rewritten):**
- `docs/migration-decisions.md` — **D45** (renumbered from D43 by Oleg's OQ10 decision, 2026-08-26), plus dated forward notes under `#d18` and `#d19` (Task 6.4).
- `docs/prod-releases.md` — **prose only, no row** (AC8, AC9).
- `_bmad-output/implementation-artifacts/deferred-work.md` — only if something is genuinely left open,
  and specifically if Open Question 5 is answered "leave the regulation alone".
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status transitions only.
- this file's own Dev Agent Record, File List and Change Log.

**Files this story amends under a priced §12 exception:**
- `docs/production-approval-regulation.md` — **dated addition only, never a rewrite** (AC9, §12).

**Files this story reads and must not modify:** every existing `.forgejo/workflows/*.yml`,
`.github/workflows/CD.yml` and `CI.yml`, `docs/release-validation-checklist.md`,
`docs/preprod-candidates.md`, `docs/release-regulation.md`, `docs/forgejo-migration.md`, `epics.md`,
`Dockerfile.prod`, `vite.config.ts`, and anything belonging to Story 4.9.

**Working location:** a scratchpad worktree off fresh `origin/main` (`cfbad179`). **The primary
checkout belongs to Story 4.9's dev agent and must not be touched.**

### References

- `_bmad-output/planning-artifacts/epics.md` — **Story 6.3's five ACs** and its two amendment notes
  (2026-08-07, 2026-08-18); Epic 6's preamble and its accepted-risk block (*"the first Forgejo release
  is a one-way door"*); Stories 6.4, 6.5, 6.6, 6.9, 6.10 for what this story feeds; **FR7, FR18, FR31,
  FR32**; **NFR3, NFR5** (amended 2026-08-18), **NFR7, NFR9, NFR11**.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — the Epic 6 block, its **"WHAT EPIC 6
  INHERITS"** comment, the `6.10-before-6.4` constraint, and Story 6.2's own closeout comment.
- `.forgejo/workflows/build.yml` — the dispatch inputs (`ref`, `environment`), `actions/checkout` at
  `ref: inputs.ref`, the OpenBao per-environment `case` and its `_check_url` guards, the phone-URL
  guard's fail-closed `prod` arm, the tags step with its `keep_pattern` permanence guard and its
  `sha_tag`/`push_tags` outputs, the labels block, and **Story 3.6 AC2's `predigest` → attach pair**
  with its `--prefer-index=false` and read-back. **Read it; do not edit it.**
- `.forgejo/workflows/record-preprod-candidate.yml` — the marker-pair pattern §5 copies: G1-G6, write
  order, read-back after every write, the printed boundary statement, and its own header's honesty
  about what **G6** does and does not establish.
- `.github/workflows/CD.yml` — the legacy production path: `Dockerfile.prod`, the production URL
  defaults, `docker/metadata-action@v5`'s labels, and the deploy job's `docker pull` of the **branch
  tag** `:main`. **This is why AC1's evidence is a label, not a tag.**
- `docs/production-approval-regulation.md` — Story 6.2's control. Its `## Who approves` (no delegate),
  `## Rollback authority` (the ledger-tag rule this story collides with), `## The freeze window`, and
  its dated *"as of 2026-08-25 … 11 entries"* census.
- `docs/prod-releases.md` — the empty ledger, its ten columns, the `prod_tag` column's *"Story 6.4/6.6's
  to settle"* note, and its append-only discipline.
- `docs/migration-decisions.md` — **#d1** (Option C), **#d2** (commit not artifact; the `rollback: true`
  bypass; *«свидетельство об исходном коде, а не о байтах»*; status **спроектировано, не реализовано**),
  **#d7** (ghcr unreachable), **#d16**, **#d18** (§2 the 12-hex rule, §3 the four stories bound to it),
  **#d19** (the four long-lived branches; *«Прод сейчас крутит какой-то другой коммит — выяснить какой и
  есть задача Story 6.3»*), **#d21**, **#d23** (PROD → s10), **#d24** (repoint refused by construction),
  **#d38** (the recorder's contract, six guards, and **§9's UNPROVEN-by-execution retention finding**),
  **#d42** (Story 6.2's record). **D35 is absent from `main` by design** — Story 4.9 holds it unmerged.
- `_bmad-output/implementation-artifacts/deferred-work.md` — **the item owned by Story 6.3 by name**
  (*"identifying which is Story 6.3, and nobody has done it"*); **"No `prod` build has EVER run"** and
  *"`secret/fe/prod/app` has never been read by anything"*; the retention item with **no owner** and its
  2026-08-29 date; the `VITE_OPERATOR_PHONE_URL_PROD` measurement; the *"Forgejo … has no mirror to
  GitHub in either direction"* topology note. Its own conventions block — **"Owners are NAMES or STORY
  NUMBERS, never trigger conditions"** — and its warning that **`file:line` citations in it are not
  maintained: verify before acting.**
- `_bmad-output/implementation-artifacts/6-2-publish-the-production-approval-regulation.md` — the
  house-style precedent for §12, the veto table, and **§9's correction of a negative control that could
  not fail**, which §9 here is written to avoid repeating.
- `_bmad-output/implementation-artifacts/5-4-record-the-validated-candidate-in-the-registry.md` — the
  six guards, the three-tier record model, and the outcome matrix that labelled its own unearnable rows.
- `_bmad-output/implementation-artifacts/3-6-verify-commit-traceability-and-image-immutability.md` — AC2,
  the `--prefer-index` finding, and the read-back-instead-of-`echo "OK"` lesson.
- `_bmad-output/implementation-artifacts/epic-3-retro-2026-08-18.md:77-78` — **retro-D4** and
  **retro-E5**, verbatim.
- `_bmad-output/implementation-artifacts/5-3-…md` §12 — the priced-exception procedure, verbatim.
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-18-prod-target.md` — s2 → s10, the
  jump-host path, what was measured on s10, and the amendment to this story's own note.

---

## Dev Agent Record

### Agent Model Used

_(dev-story: Sonnet, per the standing model split — create-story Opus, dev-story Sonnet,
code-review Opus.)_

### Debug Log References

- **Task 1.2, `origin/main` re-check:** `git fetch --all` → `cfbad179` unchanged.
  `story-4-9/pr-1-context` re-fetched and grepped directly for `^## D35\.` → present, confirmed
  still unmerged.
- **Task 1.5, D-number re-check:** `git grep -hoE '^## D[0-9]+' docs/migration-decisions.md` across
  every `origin/story-*` and `origin/main` ref → highest `D42`. **Next free: D43.**
- **Task 2.1-2.3, s2 read, 2026-08-26, `root@175.110.122.17` (NFR7 admin path, key-based, not a
  Forgejo secret):** `docker ps`, `docker inspect fe-prionex`, `docker image inspect` on the
  resolved config digest for `.RepoDigests`, `docker inspect --format '{{json .Config.Labels}}'`
  for the label set. All outputs pasted verbatim at Task 2.2/2.3 in the story's own Tasks section
  (not duplicated here — see there for the full text). **Commit found: `41ab0470ab6b…44dc39`**
  (40-hex, counted), first 12: `41ab0470ab6b`.
- **Task 2.4, the gate, 2026-08-26:** `git fetch --all` (all branches + all open PR heads, 1429
  refs total) then `git cat-file -e 41ab0470ab6b3df3bc332fc90f8bccaaba44dc39^{commit}` →
  `fatal: Not a valid object name`; `git log -1` on the same sha → `fatal: bad object`; a
  prefix-sweep `git rev-list --all | grep -i '^41ab'` → zero hits, ruling out a truncation/typo
  explanation. **Commit confirmed absent from the Forgejo repository, across every ref.** This is
  Task 4's hard gate; it fails; Task 4 (and everything downstream of it — Tasks 5, 6, 7, most of 8)
  is not attempted this session.
- **Coordinator's dispatch message, 2026-08-26, contained pre-answered Open Questions 1-5, 7, 8 and
  a ninth item (the one-shot-dispatch authorisation) before Task 1.4 was even executed** — recorded
  in full at "Open Questions for Review" rather than duplicated here. Not an artifact this dev agent
  observed independently; attested with date and channel (coordinator relay of Oleg's own words),
  in the same register this project holds for every attested-not-observed acknowledgement.

- **Session 2, 2026-08-26 — Tasks 3, 5.1-5.2, 7.3 executed; Task 4 still gated.** Work resumed on
  Oleg's instruction (*"dev остальных tasks"*). Task 2.4's gate **re-verified first, not assumed**, per
  Completion Note 8's standing instruction:
  ```
  $ git fetch --all                       # 549 remote heads, 550 refs under refs/remotes/origin
  $ git cat-file -e 41ab0470ab6b3df3bc332fc90f8bccaaba44dc39^{commit}
  fatal: Not a valid object name 41ab0470ab6b3df3bc332fc90f8bccaaba44dc39^{commit}
  $ git rev-list --all | grep -ci '^41ab0470'      -> 0
  $ git ls-remote origin | grep -ci '41ab0470'     -> 0
  ```
  **Still ABSENT.** The `ls-remote` check is new this session and is the stronger form: it asks the
  server directly rather than trusting the local object store. **Task 4 remains gated.**
- **Session 2 — the OTHER half of Completion Note 8's re-verification, closed WITHOUT touching s2.**
  The standing instruction also required confirming s2 is still serving the same revision. Done over
  **public HTTP only** — no SSH, no credential, no host contact, therefore no exposure under
  Prohibition 10 at all:
  ```
  $ curl -sI https://crm-prionex.online/assets/index-D8ZYo8qY.js | grep -i last-modified
  Last-Modified: Sat, 22 Aug 2026 19:49:08 GMT
  $ curl -s  https://crm-prionex.online/assets/index-D8ZYo8qY.js | grep -oE '"1[78][0-9]{11}"'
  "1787428120913"        # = 2026-08-22 19:48:40Z, the VITE_BUILD_TS define from vite.config.ts:8
  ```
  Placed beside session 1's own s2 read, four timestamps from **two independent channels** fall inside
  one 2.5-minute window: `org.opencontainers.image.created` **19:47:22.014Z** (s2 label) →
  `VITE_BUILD_TS` **19:48:40Z** (public bundle) → asset `Last-Modified` **19:49:08Z** (public) →
  image `Created` **19:49:53Z** (s2). **Production has not moved.** 🔴 Stated at its true strength and
  no higher: this corroborates the **build**, not the label — Open Question 4's accepted
  single-source position on the commit identity is unchanged, and this is not a second source for it.
- **Session 2, Task 3.4 — the stored retention rule, read over the admin SSH path.** `ssh root@10.67.0.1`
  → `docker exec forgejo-postgres psql -U forgejo -d forgejo -c "SELECT … FROM package_cleanup_rule"`.
  Row pasted verbatim at Task 3.4. DB name/user obtained with `env | grep -E '^POSTGRES_(USER|DB)='` —
  **scoped to exclude `POSTGRES_PASSWORD`**; no credential file was read or printed anywhere this
  session (Prohibition 13).
- **Session 2, Task 5.1/5.2 — mechanical checks run before the file was reported done.** `yaml.safe_load`
  parse; **all 15 `run:` bodies** scanned for the expression syntax (**zero hits**, Prohibition 12) and
  `bash -n`-checked (**all clean**); all four pure-shell guards extracted from the shipped YAML and
  exercised against pass + discriminating inputs (**15/15 as specified**, table at Task 5.2).
  **These are local exercises of shell logic. They are NOT §9's outcome matrix**, which needs run ids
  and stays OPEN.
- 🔴 **Session 2 — DECISION-NUMBER COLLISION FOUND. `D43` is NOT free, and Task 1.5's finding is
  correct-but-incomplete rather than wrong.** Task 1.5 swept `origin/*` refs and concluded *"highest
  D42, next free D43"* — and re-running that sweep this session reproduces it exactly: `D43` appears in
  **zero** remote branches. **But `docs/migration-decisions.md` in the operator's own local checkout
  carries a full `## D43.` section** — the temporary PROD hostname `crm.prod.crm-prionex.online` — on
  branch `docs/prod-temporary-hostname`, **two commits (`bd4e4b83`, `1c54f32d`) that have never been
  pushed** (`git ls-remote --heads origin 'docs/prod-temporary-hostname'` → empty). A ref-based sweep
  cannot see it; that is the sweep's blind spot, not its error.
  **Consequence if unaddressed: two different `D43` sections, one of them this story's.** Re-run with
  the local branch included, the first genuinely free number is **`D45`** — `D35` is held by
  `origin/story-4-9/pr-1-context`, `D43` by the unpushed local branch, `D44` by
  `origin/story-4-10/pr-1-context`. **Not taken unilaterally**: Task 6.3 is unreachable while Task 4 is
  gated, and the choice (renumber this story to `D45`, or push the hostname branch first and renumber
  that one) is Oleg's. **Filed as Open Question 10.**
  ⚠️ **Second-order finding, recorded because it outlives this story:** the D-number sweep this project
  has used since `#d43`'s own record — *"`git fetch --all` + grep the anchor across every branch"* — is
  **unsound whenever a decision is authored locally and not yet pushed**, which is exactly how the
  hostname record was written. The sweep needs to include the operator's own working checkout, or
  decisions must be pushed before their number is treated as claimed.

### Completion Notes List

1. **Tasks 1 and 2 executed in full this session; Tasks 3-8 not started — correctly, not by
   oversight.** Task 2.4's gate failed: the commit s2 is running
   (`41ab0470ab6b3df3bc332fc90f8bccaaba44dc39`) does not exist anywhere in the Forgejo repository,
   across a fresh fetch of all 1429 remote refs. This is exactly the risk the story's own §2(c) and
   Open Question 6 named at context time, now confirmed as a live fact rather than a hypothetical.
   Per Task 2.4's own instruction and the coordinator's explicit "проверь фактически до всего
   остального" priority, work stopped here rather than continuing into Task 3's zero-run
   documentary work or any dispatch-adjacent task — the entire point of Tasks 3 onward is to prepare
   for and execute Task 4's one-shot build, which cannot happen until this blocker resolves.
2. **All eight of the story's own Open Questions, plus a ninth item, arrived pre-answered from Oleg
   via the coordinator** — recorded in full, verbatim where given, at "Open Questions for Review".
   Seven of the eight (1-5, 7, and 8 with an explicit override of the story's own recommended owner)
   are genuinely resolved and will apply once Task 2.4's blocker clears. **The eighth — Open
   Question 6 itself — is not resolved by policy; it is now a confirmed live fact requiring a
   further decision from Oleg** (one of three options, none choosable by the dev agent), and it is
   the story's sole blocking condition.
3. **The one-shot dispatch mechanism (AC7/§11) is amended by Oleg's direct authorisation**
   (*"Запускай по готовности"*) **but this has not been exercised** — Task 4 has not run and cannot
   run until Open Question 6 resolves. Recorded in full at Open Questions item 9 so it is not lost
   between now and whenever Task 4 becomes reachable.
4. **No dispatch, no workflow write, no document amendment, no `D43` entry has been made this
   session.** Everything downstream of Task 2.4 (the `record-prod-image.yml` workflow, `D43`, the
   §12-priced amendment to `docs/production-approval-regulation.md`, the `docs/prod-releases.md`
   prose, the forward notes under `#d18`/`#d19`) depends on either the identified commit being
   confirmed buildable (Task 4 needs it) or, in a few cases, is independent of it but was
   deliberately not started ahead of the blocker being resolved, since Oleg's OQ6 decision could
   change which commit this story ultimately builds and thus what `D43` needs to say about it.
5. 🚨 **AC10's "not earned" list, stated now even though most of the story has not run:** nothing
   about the retention rule's execution-proof status has been claimed (AC5 untouched — no tags
   exist yet); nothing about `secret/fe/prod/app`'s contents has been claimed as pre-verified (Task
   3.5 not reached); no byte-difference claim has been made (Task 6 not reached); no G5-equivalent
   stand check exists or was claimed (Task 5 not reached). **The only claims made this session are
   Task 2's own s2 read and the Task 2.4 registry-absence finding, both directly evidenced above.**
6. ✅ **Task 2.4's finding reframed, on the coordinator's own instruction, as a permanent record and
   a positive outcome — not a failed-attempt note.** The commit/image/label state (Task 2.2/2.3) and
   the absence finding (Task 2.4) are the project's first direct proof that the GitHub and Forgejo
   repositories have diverged — this measurement outlives this story and will matter to Story 6.9
   and the epic retrospective regardless of how OQ6 itself resolves. **The gate worked exactly as
   designed**: it stopped this story before the one-shot, irreversible `environment: prod` dispatch,
   and no permanent tag was minted against an unconfirmed commit. Framed explicitly as a successful
   precondition check, not as this story stalling.
7. ✅ **OQ6 resolved, 2026-08-26 — Oleg's decision recorded verbatim: *"Занесу коммиты в Forgejo."***
   Option (a) (import from a local clone) chosen; options (b) (nearest ancestor) and (c) (unblock
   the GitHub transition first) **explicitly declined** — recorded as refusals, with Oleg's own
   stated reason (the cutover image must be the exact running commit, not an approximation), not as
   silence or a default. **Work paused on Oleg's own explicit instruction** — he is importing the
   commit and has set up his own watch for its arrival in Forgejo; this session does not resume
   until he signals. `sprint-status.yaml`'s blocking comment updated to name the owner (Oleg) and
   the decision in progress, not "waiting" in the abstract.
8. 🔴 **Standing instruction for whenever work resumes, recorded here so it is not missed:**
   Task 2.4 is **re-verified**, not resumed from where it stopped. Two facts may have changed during
   the wait: whether `41ab0470ab6b3df3bc332fc90f8bccaaba44dc39` is now a complete, reachable commit
   object in Forgejo (not a dangling blob), and whether s2 is **still** serving this exact commit —
   GitHub keeps merging to its own `main` throughout the wait, so production may have moved. **A
   changed `org.opencontainers.image.revision` label on re-read is a new commit and a new gate, not
   a continuation of this one** — Tasks 2.1-2.3 are re-run in full.

9. **Session 2 (2026-08-26) executed Tasks 3, 5.1, 5.2 and 7.3. Task 4 and everything that depends on
   an image — Tasks 5.3-5.6, 6, 7.1, 7.2, 8 — remain not started, and correctly so.** The gate was
   re-verified rather than assumed: the commit is still absent from Forgejo, confirmed this time by
   `git ls-remote` against the server as well as by the local object store. **This session made no
   dispatch, wrote no registry tag, edited no frozen file and appended no ledger row.**
10. ✅ **`record-prod-image.yml` is shipped but UNEXERCISED, and the distinction is the whole of its
   disposition.** Its four pure-shell guards were run locally against pass and discriminating inputs
   and behaved exactly as specified (15/15), which is genuine verification of the shell logic and is
   **not** a live outcome matrix. **§9's matrix has no run ids in it and its state is `OPEN`.** Six of
   its seven rows need a dispatch that cannot happen yet; the seventh — the `G5`-equivalent — is a
   **named absence** that will never be earnable in this story, because there is no PROD stand until
   Story 6.10. **Nothing in this session claims a guard has fired in production conditions.**
11. 🔴 **A decision-number collision was found and is NOT resolved here — Open Question 10.** `D43`,
   which Task 1.5 correctly measured as free across every *remote* ref, is already used by an
   **unpushed local branch** for the PROD hostname record. Taking `D43` here would create two. The
   first genuinely free number is `D45`. **The choice is Oleg's**, and Task 6.3 is unreachable in any
   case while Task 4 is gated. The generalisable half is filed with it: **this project's standing
   D-number sweep is blind to locally-authored, unpushed decisions.**
12. 🚨 **AC10's "not earned" list, restated for this session and no larger than last time.** Still not
   claimed: anything about the retention rule by execution (`UNPROVEN`, first observable 2026-08-29,
   owner Story 6.3); anything about `secret/fe/prod/app`'s contents (Prohibition 6 honoured — what was
   measured is the **live production bundle's** API origins, which is a different claim and is labelled
   as one); any byte-difference finding (Task 6 not reached); any `G5`-equivalent stand check (does not
   exist). **New this session and stated at its true strength:** the production build's *identity* is
   corroborated by a second, independent, zero-touch channel — **but the commit *label* still rests on
   one source**, exactly as Open Question 4 accepted. The corroboration is of the build, not the label,
   and it is not offered as a second source for the commit.

13. ✅ **OQ10 resolved by Oleg the same session — option (a), this story renumbers to `D45`.** Applied
   across every forward-looking reference in this file (§6's table, §7(f), §12's expected-changes list,
   AC5, AC8, Task 6.3, Task 7.1, Dev Notes §2 and §5, the File List). **Historical entries are left
   standing and superseded, not rewritten**: Task 1.5's own record, session 1's Debug Log and Change Log
   rows 0.2/0.4 all still read *"next free: D43"*, because that is what was measured at the time and the
   measurement was not wrong — it was blind, and the blindness is the finding. 🔴 **The process half of
   OQ10 stays OPEN**: choosing (a) fixes this collision, not the sweep that missed it.

### File List

- `_bmad-output/implementation-artifacts/6-3-rebuild-the-running-production-commit-into-the-forgejo-registry.md` — this story file (Tasks 1-3, 5.1-5.2, 7.3, Dev Agent Record, Open Questions)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `6-3-…` flipped `backlog` → `in-progress`, HALT comment recorded
- `.forgejo/workflows/record-prod-image.yml` — **NEW** (Task 5.1/5.2). The story's only code artifact. Dispatch-only recorder for `prod-<12hex>` / `prod-current`; ships unexercised — no dispatch has been made against it

### Review Findings

_(To be filled by code review.)_

---

## Open Questions for Review

🔴 **Questions 1-5 gate Task 4.** Answers below arrived from Oleg via the coordinator on 2026-08-26,
**before** Task 1.4's own send even completed this session — the coordinator relayed them as part of
the dispatch instruction itself. Attested with the date and the coordinator as relay channel; not
independently observed by the dev agent for the ones that are pure decisions (1-5, 7, 8) — only OQ6's
own gate result is the dev agent's own direct observation (Task 2.4).

1. ✅ **RESOLVED — ratified as recommended, no veto.** A new dispatch-only `record-prod-image.yml`
   writes `prod-current`/`prod-<sha>` (§5). Coordinator's own framing: *"это делает 6.3 стори,
   отгружающей workflow, — значит полная матрица исходов retro-E5 обязательна"* — ratifying the
   workflow decision **and** confirming the full retro-E5 matrix obligation (§9, AC6) is not optional.
2. ✅ **RESOLVED — ratified as recommended, no veto.** `prod-current` is created now, with the
   disclaimer written at creation time (AC8) — coordinator's own words: *"с дисклеймером в момент
   создания: он именует образ, который ни один хост не обслуживает до внешнего переключения
   трафика."*
3. ✅ **RESOLVED — ratified, with "never" underlined.** s2 is read **only** via the NFR7
   administrative SSH path. Coordinator's own words: *"Никогда джобой Forgejo на `s2-prod-deploy`:
   NFR5 в поправленной редакции — Forgejo на s2 не ходит вообще."* Matches Task 2.1's own execution
   exactly (this session's SSH read, `root@175.110.122.17`, no Forgejo job involved).
4. ✅ **RESOLVED — ratified, consequence accepted explicitly.** No GitHub read of any kind, even to
   corroborate. Coordinator's own words: *"Читать GitHub для перепроверки коммита не будем. Записать
   принятое следствие: идентификация однoисточниковая."* **Recorded as accepted, not discovered**:
   the commit identification (Task 2.3) rests on one source — the image labels on s2 — with no second,
   independent confirmation, and that is now Oleg's own accepted position, not a limitation the story
   apologises for.
5. ✅ **RESOLVED — ratified as recommended, narrowed further.** Coordinator's own words: *"Поправить
   регламент в 6.3"* — a dated amendment to `docs/production-approval-regulation.md` under the §12
   exception, with the price recorded (§12). **Sharper than the story's own recommendation**: the
   coordinator requires the exception be **narrow and named by tag** — *"формулируй исключение узко и
   по имени тега, а не общей лазейкой: расширять его на будущие теги нельзя"* — i.e. the cutover tag
   this story mints is named explicitly as the one exception; the clause must not read as a general
   carve-out future stories could reuse. Also folds in §7(a)'s workflow-census amendment (11 → 12,
   *"«прод-каллера нет» остаётся верным"*). **Deferred to a future task**, since Task 4/5/7 cannot run
   while OQ6 is unresolved (below) — the amendment itself still needs the actual tag name, which does
   not exist until Task 4 runs.
6. 🔀 **SUPERSEDED 2026-08-26 — the decision below was REVERSED the same day, and both halves are
   kept verbatim rather than the second overwriting the first.** Oleg's later instruction:
   ***«Берем тот коммит, который последний в pre-prod»***. The commit `41ab0470…` was **never
   imported** — it is still absent from Forgejo, re-verified 2026-08-26 against 549 remote heads and
   against the server itself. **What changed is not the blocker but what this story builds**: the
   source is now `a99ccd44c5a39345fa65eb74e87343b187e129e9`, the last validated PRE-PROD candidate.
   Taken through `correct-course` rather than absorbed here —
   `sprint-change-proposal-2026-08-26-cutover-candidate.md`, `#d46` — because it changes FR31, FR32,
   this story's own AC1/AC4 and Story 6.9's ACs, which a story file may not do to itself.
   **What the reversal buys:** the cutover image now carries `preprod-a99ccd44c5a3` and would **pass**
   Story 6.5's guard; the exception this story was carrying disappears (§7(f), corrected).
   **What it costs, and it is not small:** FR32 loses the word *no-op*, the cutover becomes the first
   real release, Story 6.9's purpose — separating cutover risk from release risk — is **no longer
   achieved**, and the product-code import moves from this story to Story 6.9 as a new AC gate with
   owner Oleg. **The original resolution is preserved below, unedited**, because the reasoning that
   produced it — including the two options it explicitly declined — is the reasoning the reversal
   overturned, and a record that hides the first decision cannot show what the second one cost.

   ~~✅ **RESOLVED, 2026-08-26 — Oleg's decision, verbatim, via the coordinator.**~~ Task 2.4 (own
   SSH read, own `git fetch --all` across 1429 refs) found the commit s2 is running,
   `41ab0470ab6b3df3bc332fc90f8bccaaba44dc39`, **absent from the Forgejo repository** — the
   project's first direct proof of the GitHub/Forgejo divergence `#d7`/`#d19` had only theorised
   about. **The gate stopped the story exactly as designed, before the one-shot dispatch — a
   successful precondition check, not a story failure.** Of the three options named at context
   time, Oleg's answer: *"Занесу коммиты в Forgejo."* **Option (a) — import from a local
   clone — chosen.** **Options (b) (nearest present ancestor) and (c) (unblock the GitHub→Forgejo
   transition first) are explicitly declined, recorded as refusals rather than silence**: Oleg's
   own stated consequence is that 6.3 builds **the exact running commit**, not an approximation —
   *"компромисс «образ катовера — не тот коммит, что крутится» в проект не входит."*
   **`PENDING (owner: Oleg)`** — a named owner with a decision already made and in progress
   (he is importing the commit himself and watching for its arrival), not an open-ended wait.
   **Work is explicitly paused on Oleg's own instruction** until he signals the commit has landed.
   **On resume: Task 2.4 is re-verified, not resumed from where it stopped** — confirm the commit
   is a complete, reachable object (not a dangling blob), and confirm s2 is still serving the same
   revision (GitHub keeps merging throughout the wait; a changed label is a new commit and a new
   gate, not a continuation).
7. ✅ **RESOLVED — ratified as recommended, no veto.** No `preprod` smoke build precedes the `prod`
   build. Coordinator's own words: *"preprod-смоук перед prod-сборкой не делаем (рекомендация
   спеки)"*.
8. 🔄 **RESOLVED — but NOT as recommended; Oleg overrode the story's own suggestion.** The story
   recommended owner **Story 6.8**; Oleg assigned owner **Story 6.3 — this story itself.**
   Coordinator's own words: *"Владелец — номер стори 6.3, не условие и не имя-заглушка (правило
   deferred-work: владелец есть ИМЯ или НОМЕР СТОРИ). 6.3 наблюдает ретенцию, раз именно её теги от
   неё зависят."* **Rationale beyond the story's own framing**: it is this story's own tags whose
   survival the retention rule governs, so this story is the natural observer, not merely the next
   convenient one. `#d38` §9's own status (**UNPROVEN by execution**, first observable
   **2026-08-29**, three days from context date) is unchanged; if this story closes before that date
   (a live possibility, given the OQ6 blocker above), **the observation is recorded as not completed
   within the story, with the date named, and the ownership is NOT reset to nothing** — Story 6.3
   remains the owner of record for that observation until it is either made or explicitly re-owned,
   per the same convention Oleg just invoked (owners are names or story numbers, never trigger
   conditions, and never silently dropped).

10. ✅ **RESOLVED, 2026-08-26 — Oleg chose option (a): this story renumbers to `D45`.** Raised in
   session 2. `D43` is not free after all, and this story planned to take it. Task 1.5's sweep across every `origin/*` ref is reproducible and still
   returns *"highest D42, next free D43"*. **It is blind to one place**: the operator's own local
   checkout, where branch `docs/prod-temporary-hostname` (commits `bd4e4b83`, `1c54f32d`, **never
   pushed**) already carries a full `## D43.` section recording the temporary PROD hostname
   `crm.prod.crm-prionex.online`. Re-run with that branch included, the first free number is **`D45`**
   (`D35` → `origin/story-4-9/pr-1-context`, `D43` → the unpushed local branch, `D44` →
   `origin/story-4-10/pr-1-context`). **Two options were put to Oleg, neither taken unilaterally:** (a) this story
   renumbers to `D45`; (b) the hostname branch is pushed first and whichever record lands second
   renumbers. **Oleg chose (a).** Reason recorded rather than inferred: the hostname record is already
   written and dated, while this story has not written a line of its own decision yet — moving text
   that does not exist is cheaper than moving text that does. **Applied the same session**: every
   forward-looking `D43` in this file now reads `D45`; the **historical** entries that record
   *"next free: D43"* as a measurement taken at the time (Task 1.5, session 1's Debug Log, Change Log
   0.2/0.4) are **left exactly as written and superseded by this entry, not rewritten** — the same
   amend-don't-rewrite rule Story 6.2's own review enforced after a closure silently dropped the
   decision that routed it. **`D43` remains the PROD-hostname record's number and is not this
   story's.**
   ⚠️ **The generalisable finding, which outlives this story:** the D-number sweep this project has used
   since `#d43`'s own record is **unsound for any decision authored locally and not yet pushed**. Either
   the sweep includes the operator's working checkout, or a number is not treated as claimed until it is
   pushed. **Owner: Oleg** (both the decision and the unpushed branch are his). **Still OPEN as a
   process item** — Oleg's choice of (a) settles *this* collision; it does not change the sweep, and the
   next locally-authored decision reopens the same hole. Carried so it is not read as closed by the
   renumber.

**Item 9 — not one of the original eight, and not a policy alternative: the one-shot dispatch
mechanism itself (§11/AC7) is amended by Oleg's own direct authorisation, 2026-08-26, verbatim via
the coordinator:** *"Запускай по готовности."* **What this changes and what it does not:**
- The story's own AC7/§11 wrote the two one-shot acts (§3's build, §5's record) as waiting for an
  **explicit confirmation reply** rather than the standing "announce, don't ask twice" convention
  (`#d38` §7) — described by the coordinator as a deviation the spec itself flagged, since it
  proposed waiting for confirmation before an irreversible act **against** `#d38` §7's own default.
  **Oleg chose not to wait**: once every fail-closed guard is green, dispatch — no separate "may I?"
  is asked at that point.
- **The price does not disappear — it is raised, and the coordinator's own formulation is recorded
  verbatim rather than paraphrased**: *"сборка нерепетируема, `OPENBAO_PROD_SECRET_ID` write-only
  (пресверить `secret/fe/prod/app` нельзя), AC2-гард `build.yml` откажется перенаправить
  `sha-<12>-prod`, а снятие тега «дважды требовало оператора лично». Поэтому авторизация «по
  готовности» повышает требования к тому, что стоит перед пушем: все prod-специфичные гарды и
  сверка коммита обязаны отработать до любого пуша в реестр, а шаг сборки пушит только 14-дневный
  санитизированный тег. Если хоть один гард не может отработать до пуша — HALT, это уже не
  «готовность»."* **Translated into this story's own terms: Task 4.1's gate (§3 mitigation 3, AC1
  complete, Task 2.4 green, OQ1-5 answered, no-touch window clear) is not softened by this
  authorisation — it is exactly what "ready" now means, verified before the dispatch message is
  even sent, not confirmed interactively after.** Task 4.2's own "wait for confirmation" instruction
  is superseded by this: the coordinator still sends the exact dispatch verbatim before making it
  (transparency unchanged), but does not wait for a live reply once the gate is green — matching the
  standing convention Oleg just restored. **Currently moot**: Task 4 cannot run until OQ6 (item 6
  above) is resolved, so this authorisation has not yet been exercised.

---

## Change Log

| Date | Version | Description | Author |
|---|---|---|---|
| 2026-08-26 | 1.0 | **Task 8 — story closed and moved to `review`. 6 of 10 ACs met; four (AC4, AC6, AC8, AC9) NOT MET, every one by an explicit decision of Oleg's, none by oversight and none softened — AC4 is an epic criterion and says so.** Delivered and evidenced: the first PROD image this project has ever built (run 598, 14/14, 384 s) and the first PROD markers it has ever written (run 600, 17/17), all three names on one manifest `sha256:f30c794123ba…a3f3`, read back from the registry independently of the runs. **Ledger CLOSED BY QUERY: 14 runs measured against a declared ceiling of 20 — under budget.** 🔴 Run 598 had to be named on its own line: its `commit_sha` is the dispatch ref, so a `commit_sha` attribution would have missed the story's most consequential run. Not all green — 5 success, 7 cancelled by ordinary concurrency eviction, 1 running; counted because they consumed rows. One budgeted line cost zero (the integration merge shared a push). AC10's not-earned list written in the required words, including that the retention rule stays `UNPROVEN` by execution with first observation **2026-08-29**, after this story closes, and that **ownership is not reset to nothing**. | dev-story |
| 2026-08-26 | 0.9 | **Task 7 CANCELLED by Oleg (*«Task 7 отменить»*). AC9 recorded UNMET.** Neither of Story 6.2's artifacts is reconciled. The regulation's dated census stays wrong (11 → **12** measured today; *"no PROD deploy caller"* stays true), and 🔴 **a live contradiction is left standing that blocks Story 6.9**: the shipped rollback rule makes 6.9's own FR32 `rollback: true` dispatch *"a rollback to a tag not in the ledger"* — therefore a release, therefore needing Oleg — while the same document records **no delegate**. Open Question 5 had been **answered** (*«Поправить регламент в 6.3»*, narrowed to by-tag-name); that answer is now **unexecuted**. `docs/prod-releases.md` records nothing about the three `-prod` forms that now exist, nor what `prod-current` means before the switch — **the durable half of AC8**, which stays unmet in both halves. AC9's own never-drop fallback (file the contradiction against Story 6.9 in `deferred-work.md`) is **also not done** — offered, not taken, since the instruction was to cancel. 7.3 remains **done**: every frozen path verified byte-identical to `origin/main`. Owner of all of it: Oleg. | dev-story |
| 2026-08-26 | 0.8 | **Task 6 CANCELLED by Oleg (*«Task 6 - отменить»*). `D45` is not written — this story ships with no decision record at all.** AC4 (**an EPIC acceptance criterion**) and AC8 recorded **UNMET**, not counted as satisfied by evidence scattered elsewhere. No forward notes under `#d18`/`#d19`; `deferred-work.md`'s *"identifying which is Story 6.3, and nobody has done it"* item is **in fact discharged** by session 1's s2 read but **is not marked so anywhere**, and will read as open. 🔴 **AC8's gap is operationally live rather than documentary:** `prod-current` exists in the registry from `11:17:10Z` and names an image **no host serves**, while the only statements of that fact are `record-prod-image.yml`'s header and the disclaimer its last step printed in run 600 — the tier this project classifies as best-effort. Everything `D45` was to carry now lives only in this story file and this branch's commit messages; `#d46` covers the build-source change and none of the rest. Owner of all of it: Oleg. | dev-story |
| 2026-08-26 | 0.7 | **Task 4 and Task 5.3 executed; Task 5.4/5.5/5.6 CANCELLED by Oleg; AC6 recorded UNMET.** Run 598 (384 s, 14/14 green) built `a99ccd44c5a3…` at `environment: prod` — **step 7 is the project's first ever read of `secret/fe/prod/app`**, and the `fe-prod` AppRole's first real login. Run 600 (17/17 green) minted `prod-a99ccd44c5a3` then `prod-current`, history before pointer, one second apart. All three PROD names resolve to one manifest `sha256:f30c794123ba…a3f3`; the control — both PRE-PROD names of the same commit — resolves to a **different** manifest `sha256:a62e8687…`, so Option C's rebuild is visible as two digests for one commit, measured rather than asserted. **AC2 and AC3 met.** 🔴 **A defect of mine, found and corrected in the same session:** Task 4.5 first reported digests read from `package_property.container.digest`, which is **not** the manifest digest; the subtask's conclusion held but its value came from the wrong instrument, settled by a free control where the registry and this project's own ledger agree against the column. Standing rule recorded: manifest digests come from the registry, never from `package_property`. 🚫 **Task 5.4 cancelled** — the four discriminating dispatches were not made, so `record-prod-image.yml` ships with six guards whose **refusal path has never been observed live**; the local shell exercise is explicitly NOT substituted for it; §9's matrix stays `OPEN` with one row; **AC6 UNMET, owner Oleg**. | dev-story |
| 2026-08-26 | 0.6 | **Correct-course applied; the build source changed and the story's own stale claims were corrected.** `origin/main` @ `f144ee9f` merged in (conflict in `sprint-status.yaml` resolved keeping BOTH sides whole, per this project's precedent). **OQ6 marked SUPERSEDED with both of Oleg's decisions kept verbatim** — the commit was never imported; what changed is what the story builds. §3's blocker note records the resolution and states plainly that the one-shot property, the `Enforce AC2` refusal and the `Date.now()` reason all **still stand and are now live rather than hypothetical**. 🔴 **Four places in this file and ONE IN SHIPPED CODE claimed the image "will fail Story 6.5's guard by construction" — all now false, all corrected**: §7(f) (inverted, with the old text quoted), §13 item 6 (struck through), Task 6.3's instruction, Task 5.2's description, and `record-prod-image.yml`'s own header clause (b), which was a claim about one particular image baked into a general-purpose file and is now written as the general truth it should always have been. Task 4.2 re-pointed at `a99ccd44c5a3…` with both produced tags named, and its "wait for confirmation" superseded by OQ item 9. Gate 4.1 evidence gathered: commit present/complete/reachable, `short12 = a99ccd44c5a3` matching the preprod tag; `vars.VITE_OPERATOR_PHONE_URL_PROD = https://phone.crm-prionex.online` (prod fails closed without it); all 7 OpenBao secrets and all 4 org registry secrets present; **OpenBao UNSEALED** (`sealed:false`, Shamir 3/5); **no `prod-*` version exists in the registry at all**, so the one-shot is unfired. | dev-story |
| 2026-08-26 | 0.5 | **OQ10 resolved by Oleg — option (a): this story's decision renumbers `D43` → `D45`.** Applied to every forward-looking reference; historical records of the original measurement (Task 1.5, session 1 Debug Log, Change Log 0.2/0.4) left standing and superseded rather than rewritten, per the amend-don't-rewrite rule. `D43` stays the PROD-hostname record's number. 🔴 The **process** half of OQ10 remains OPEN and is explicitly not closed by the renumber: the project's ref-based D-number sweep is still blind to any decision authored locally and not yet pushed, and the next one reopens the same hole. | dev-story |
| 2026-08-26 | 0.4 | **Dev-story session 2: Tasks 3, 5.1-5.2 and 7.3 executed. Task 4 still gated — the commit is still absent, re-verified this time against the server (`git ls-remote`) as well as locally.** The other half of the resume instruction was closed WITHOUT touching s2: the live production bundle's `VITE_BUILD_TS` (`2026-08-22 19:48:40Z`) and asset `Last-Modified` (`19:49:08Z`), read over public HTTP, sit inside one 2.5-minute window with session 1's two s2 timestamps — production has not moved, corroborated by an independent channel (of the BUILD, not the label; OQ4's single-source position on the commit stands). Task 3.4 read `package_cleanup_rule` from the Forgejo DB directly and compiled all four tag shapes against it: the three markers KEEP, the 40-hex sanitized-ref tag does not, plus a free non-vacuous control. **`.forgejo/workflows/record-prod-image.yml` shipped** — G1/G2/G3/G4/404/G6, no G5-equivalent with the reason in the header, `prod-<sha>` before `prod-current`, `--prefer-index=false`, read-back after every write, move-refused-by-default as a recorded divergence from 5.4; 15/15 run bodies clean of the expression syntax and `bash -n`-valid; all four pure-shell guards exercised locally 15/15 — **local shell verification, NOT §9's matrix, which stays OPEN with no run ids**. Workflow census 11 → 12; every frozen path byte-identical to `origin/main`. 🔴 **New blocker-adjacent finding, Open Question 10: `D43` is NOT free** — an unpushed local branch already uses it for the PROD hostname record, so the project's ref-based D-number sweep is blind to locally-authored decisions; first free is `D45`; owner Oleg, not taken unilaterally. | dev-story |
| 2026-08-26 | 0.3 | **OQ6 resolved by Oleg, verbatim: "Занесу коммиты в Forgejo"** -- option (a), import from a local clone, chosen; options (b) nearest-ancestor and (c) unblock-GitHub-first explicitly declined, recorded as refusals (the cutover image must be the exact running commit). Task 2.4's finding reframed, on the coordinator's instruction, as a permanent record and a positive outcome -- the gate worked exactly as designed, stopping the story before the one-shot dispatch; this is the project's first direct proof of the GitHub/Forgejo divergence and outlives this story. Work explicitly paused on Oleg's own instruction until he signals the commit has landed (he is watching for it himself). sprint-status.yaml's blocking comment updated: owner Oleg, decision in progress, not "waiting". Standing instruction recorded for resume: RE-VERIFY Task 2.4 (commit reachable as a complete object, s2 still serving the same revision), do not resume from where it stopped. | dev-story (Sonnet) |
| 2026-08-26 | 0.2 | **Dev-story Tasks 1-2 executed; HALT at Task 2.4.** Ledger/D-number re-verified (D43 free). s2 read over the NFR7 admin path: running commit identified as `41ab0470ab6b3df3bc332fc90f8bccaaba44dc39` from `org.opencontainers.image.revision`, container/image/label state pasted verbatim. **Task 2.4's gate FAILED: the commit is absent from the Forgejo repository** (fresh fetch, 1429 refs, zero near-matches) -- exactly the risk Sec.2(c)/Open Question 6 named at context time. Task 4 (the one-shot prod build) and everything downstream do not run. Open Questions 1-5, 7, 8 arrived pre-answered from Oleg via the coordinator (all ratified as recommended except OQ8, whose owner Oleg reassigned from Story 6.8 to Story 6.3 itself); a ninth item -- Oleg's direct authorisation of the one-shot dispatch mechanism ("Запускай по готовности"), with its raised pre-push bar -- recorded but not yet exercised. sprint-status.yaml's `6-3-...` row stays `in-progress` per the story's own HALT mapping, with the blocking condition (OQ6) named in the comment immediately above it. | dev-story (Sonnet) |
| 2026-08-26 | 0.1 | Context created from a scratchpad worktree off `origin/main` @ `cfbad179`, branch `story-6-3/pr-1-context`. Ordering checked against `epics.md` for all of 6.3-6.10 (§2): 6.3 does **not** depend on Story 6.10; it does depend on a tag-writing mechanism the plan assigned to 6.6, which cannot run first — and on one external precondition (the commit's presence in Forgejo) that no story owns. Five epic ACs carried, five added. Eight Open Questions, five of which gate the story's one-shot dispatch. | create-story context engine (Opus) |
