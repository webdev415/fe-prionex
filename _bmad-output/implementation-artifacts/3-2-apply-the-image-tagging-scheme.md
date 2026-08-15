---
baseline_commit: 1d7b21c4
---

# Story 3.2: Apply the Image Tagging Scheme

Status: ready-for-dev

> 🔴 **Branch from `1d7b21c4`, not from `main`.** At the time this story was written that commit sat
> on the **unmerged** branch `story-3-1/pr-1-review-findings` (PR #15), while `main` was `f4cd3375`.
> Everything Story 3.1's code review produced lives only there: the corrected FR6 attribution inside
> `build.yml`, the two handover items in `deferred-work.md`, D17, and `3-1: done` in
> `sprint-status.yaml`. `main`'s copy of `build.yml` still says *"Story 3.2 owns the tagging scheme
> and the push/tag triggers (FR6)"*, which is wrong and is the thing this story must not inherit.
> **If PR #15 has since merged, branch from `main` and delete this note.**

> **What this story is.** Story 3.1 proved a push works and pushed one literal throwaway tag,
> `build-check-3-1`. This story makes tags *mean* something. Every tag it invents is consumed by a
> later story — the PRE-PROD record (5.4), the promotion guard (6.5), the rollback target (6.6, 6.8)
> and the cutover (6.3) all match on strings this story decides.
>
> **What makes it dangerous is not the YAML.** It is that the registry is shared with another team's
> production, a **single** org-wide retention rule governs all 86 packages, and some tag shapes that
> rule protects **forever**. A tag pushed into a protected shape cannot be removed by the rule at any
> age — only by an authorised `DELETE` with a `write:package` token, which on this project has twice
> required Oleg's explicit intervention. **Pushing `latest` is a one-way door**, and Story 3.3 is
> allowed to decide `latest` should not exist.
>
> **Six decisions this story must make because the plan does not.** They are enumerated in §9. Do not
> start Task 5 before they are written down. Every one of them has a later story that breaks if
> 3.2 guesses differently than 5.4, 6.3, 6.5 or 6.6 assumed.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a release engineer,
I want every image to carry predictable tags,
so that I can name an exact artifact when deploying and reason about what is where.

---

## What you are changing, in one screen

You edit **one file**: `.forgejo/workflows/build.yml`. Four changes:

| # | Change | Why | Where |
|---|---|---|---|
| 1 | Add `id:` to the build step; assert the **digest** it reports, not that a tag exists | The shipped assertion passes on the previous run's manifest from run 2 onward. **This is AC5.** | §7, Task 4.1–4.2 |
| 2 | Re-key `concurrency` on the resolved **commit SHA**, not `github.ref` | `github.ref` is the dispatch ref, not the built content; today it degenerates to one global mutex | §8, Task 4.3 |
| 3 | Replace the literal `tags:` with a computed tag set | The story | §5, §5a, Task 5 |
| 4 | Add `labels:` from the same action | One line; most of Story 3.6 for free | Task 5.4a |

**The two facts most likely to be got wrong, stated once:**

- 🔴 **Never read `github.sha` or `github.ref`.** Under `workflow_dispatch` they describe the
  *dispatch*, not the commit `actions/checkout` checked out from `inputs.ref`. Dispatch a build of
  `feature/x` from `main` and you get an image built from `feature/x` **tagged `main`**. (§4, §5a)
- 🔴 **Some tag shapes are permanent.** The org-wide retention rule's `keep_pattern` protects them
  forever, and removal needs an authorised `DELETE` plus a `write:package` token. **`latest` is one
  of them.** Do not push a tag that is not on your declared list. (§1, §2)

**Six decisions the plan does not make — §9. Write them down before Task 5.**

---

## 🚨 Read this before anything else

### 1. 🔴 The retention rule already fixed the tag shapes, and the plan does not know it

There is exactly **one** container cleanup rule for the whole `CRM` organisation
(`UQE_package_cleanup_rule_s UNIQUE (owner_id, type)`), it is **enabled**, and it lives **only in the
Forgejo database** — there is no API and no CLI for cleanup rules, and it cannot be restored from
this repository. Its literal value (`docs/migration-decisions.md`, search
`Восстановление правила очистки реестра`):

```
keep_pattern    fe-prionex/(prod-current|preprod-current|latest|buildcache|v?\d+\.\d+\.\d+.*|(pre)?prod-[0-9a-f]{7,64}|sha-[0-9a-f]{7,64}-(pre)?prod|sha256:[0-9a-f]{64})
remove_pattern  fe-prionex/.+
keep_count      0
remove_days     14
match_full_name true
```

⚠️ **Sourcing note, and Task 1.3 must close it.** `docs/migration-decisions.md` states only that the
pattern is **anchored whole** («паттерн якорится целиком»). The rest of what follows — that anchoring
is `\A…\z`, that matching is **case-insensitive**, that the engine is **Go RE2** (no lookahead, no
backreferences), and that evaluation order is `keep_count` → `keep_pattern` → `remove_days` →
`remove_pattern` — is Gitea's implementation behaviour and is **not sourced in this repository**. It
is very likely right and the whole table below depends on it. The one *measured* observation in the
record points a different way about ordering: «все 1300+ отсеивались **по возрасту до того, как
читался паттерн**». **Verify these semantics against the Gitea/Forgejo source before relying on
them**, and record what you found. `keep_pattern` winning before `remove_pattern` is the specific
claim that makes "permanent" mean permanent.

What that means for the shapes this story might emit:

| tag | permanent? | why |
|---|---|---|
| `latest` | 🔴 **forever** | named literally |
| `buildcache` | forever | named literally |
| `v1.2.3`, `1.2.3`, `1.2.3-rc1` | forever | `v?\d+\.\d+\.\d+.*` — the `v` is optional and `.*` is greedy |
| `1.2` | expires | needs **three** dotted components |
| `prod-<7–64 hex>`, `preprod-<7–64 hex>` | forever | `(pre)?prod-[0-9a-f]{7,64}` |
| `prod-current`, `preprod-current` | forever | named literally |
| `sha-<7–64 hex>-prod`, `sha-<7–64 hex>-preprod` | forever | `sha-[0-9a-f]{7,64}-(pre)?prod` |
| **`sha-<short>`** (bare) | **expires at 14 days** | matches **no** alternative |
| **`sha-<short>-dev`** | **expires at 14 days** | `dev` is not in `(pre)?prod` |
| `main`, `<branch>`, `build-check-3-1` | expires at 14 days | fall through to `remove_pattern` |

**Three things follow, and each is a constraint on this story, not a fact about it.**

1. **The environment discriminator's spelling is already decided by live infrastructure.** It must be
   `sha-<hex>-prod` / `sha-<hex>-preprod`. Any other spelling — `sha-<short>_prod`,
   `prod-sha-<short>`, `<short>-prod`, `sha-<short>-production` — falls through and is deleted at 14
   days. Story 3.3 writes the discriminator, but **3.2 fixes the shape it must fit into.**
2. **The short SHA must be at least 7 hex characters.** `[0-9a-f]{7,64}`. A 6-character short SHA
   makes `prod-abc123` unprotected, silently. Git's default `--short` is 7 today but grows with repo
   size; **pin the length explicitly, do not inherit `git rev-parse --short`'s default.**
3. 🔴 **`sha-<short>-dev` is NOT protected and that is correct policy** — DEV images are disposable —
   but FR11 describes the rule as removing "`<branch>` tags", which understates it by a mile.
   `epics.md`'s Story 3.4 annotation is the only place that says it correctly: *"the `<branch>` shape
   is deleted by **falling through** `keep_pattern`, not by being named, so any future protected
   shape must be added there or it will expire too."* Carry that sentence into every tag you invent.

⚠️ **The 14-day threshold itself is «не проверено».** Story 1.11's experiment ran at
`remove_days = 0` because the registry cannot backdate a push and DB writes were forbidden. The
**only** shape ever exercised end to end against the live rule is `sha-a1b2c3d-prod`. Everything else
in the table above is **pattern-read, never exercised.**

### 2. 🔴 Pushing `latest` is a one-way door, and Story 3.3 may want it not to exist

AC4 says a build from `main` carries `latest`. `latest` is named literally in `keep_pattern`, so once
pushed it is permanent. Meanwhile `epics.md` Story 3.3 AC4 says:

> **Then** the meaning of `latest` is decided explicitly — either bound to one environment or
> **dropped entirely** **And** the decision is recorded, because `docker-compose.server.yml:8`
> currently defaults to a `:latest` image reference.

*(That compose default is `ghcr.io/crm-prionex/fe-prionex:latest` — it points at **ghcr**, not at
the Forgejo registry, and Story 4.1 owns the line. So pushing `latest` here does not affect it. The
argument below rests on `keep_pattern` permanence alone, which is the stronger half anyway.)*

So the story immediately after this one is authorised to delete the tag this one is told to create.
And removing it costs: an authorised `DELETE /packages/CRM/container/fe-prionex/latest` with a
`write:package` token. On this project that route has **twice** required Oleg's explicit
authorisation, because the tool-permission classifier correctly refuses destructive production
actions; and minting a token is a one-way door of its own — *an admin cannot revoke another account's
token* (`deferred-work.md`, standing finding from story 1.10's review).

Under Option C the ambiguity is worse than the permanence: one commit produces up to three images,
and `latest` can only point at one of them.

**This is Decision 5 in §9. The recommendation is to implement the `latest` rule but leave it
disabled behind an explicit, single-line switch, and hand the verdict to 3.3 — do not push `latest`
in this story.** If Oleg wants it pushed, that is a decision, and it must be written down as one.

### 3. 🔴 The bare `sha-<short>` tag: four references demand it, two constrain it, one has an escape hatch

This is **Decision 1 in §9 and the most consequential decision in the story.** Read all seven
references before deciding — earlier drafts of this section quoted only the constraints and made the
question look unsatisfiable. It is not unsatisfiable. It is a trade-off.

**Demanding the bare `sha-<short>`:**

- **FR7:** "`sha-<short>` **on every build**"
- **AC1 of this story:** "the image **always** carries `sha-<short>` derived from the commit SHA"
- **NFR4:** "Every image is immutable and traceable to the exact commit that produced it **via its
  `sha-<short>` tag**"
- **Story 3.4 AC2:** "an image tagged with that branch **and its `sha-<short>`** exists in the
  registry"
- **Story 3.6 AC1:** "the registry contains an image whose **`sha-<short>` tag maps to that exact
  commit**"

**Constraining it:**

- **FR8:** images for different environments from the same commit "**must carry an environment
  discriminator in the tag**"
- **Story 3.3 AC3:** "a bare `sha-<short>` is **never ambiguous** between environments"

**And the escape hatch that decides it — Story 3.6 AC2, quoted in full:**

> **Given** an existing `sha-<short>` tag in the registry
> **When** the same commit is built a second time
> **Then** the existing tag is not silently repointed to a different digest, **or if it is, the
> behaviour is detected and documented as a known limitation.**

🔴 **That last clause is load-bearing and easy to drop.** With it, "the bare tag gets repointed" is
an *anticipated, documentable* outcome, not a violation. So the honest framing is:

- Dropping the bare tag breaks **four** explicit references, including an NFR and two later stories'
  ACs.
- Keeping it makes the tag ambiguous once Story 3.3 lands per-environment builds, and it expires at
  14 days regardless because it matches no `keep_pattern` alternative.

**The recommendation is therefore to keep it** — FR7, NFR4, 3.4 AC2 and 3.6 AC1 outnumber and
outrank the ambiguity, 3.6 AC2 explicitly permits the repoint provided it is documented, and 3.3 AC3
is satisfiable by making the *discriminated* tags authoritative and the bare one a convenience
pointer. **Whatever you decide, state which references you are honouring and which you are breaking,
by name.** Do not resolve this silently in either direction.

⚠️ **FR31 / Story 6.3 sit on the same fault line:** they mandate a bare, env-less `sha-<commit>` on
an image built *with production build-args* — which FR8 forbids. That contradiction is real
regardless of Decision 1 and should be recorded, not resolved by this story.

### 4. 🔴 `metadata-action` reads the event context, not `inputs.ref` — the same class of bug as 3.1's concurrency key

This story's triggers are still `workflow_dispatch` only. **Story 3.4 owns FR6 and the `push`/`v*`
triggers — Prohibition 4 below.** That creates a trap that will pass review if nobody looks:

`docker/metadata-action`'s `type=ref,event=branch` and `type=sha` derive from the **event context** —
`github.ref`, `github.sha` — which under `workflow_dispatch` is the ref the *dispatch was issued
against*, not `inputs.ref`, which is what `actions/checkout` actually checked out. Dispatch a build
of `feature/x` from `main` and you get an image built from `feature/x` **tagged `main`**.

This is exactly the defect Story 3.1's review found in the concurrency group
(`group: build-${{ github.ref }}` against content from `inputs.ref`) — the same confusion, one line
further down. **Compute every tag from the checked-out commit, not from the event.** Read the real
SHA and the real ref *after* checkout and feed them in explicitly.

### 5. The sanitization rule, the action that implements it, and the block you must NOT copy

**The rule, stated so a consumer can reimplement it** (AC2 requires "deterministically", and Story
4.3 deploys DEV by `ref`, so something downstream must reproduce this):

> **Replace each run of characters outside `[a-zA-Z0-9._-]` with a single `-`.**

That is exactly what `docker/metadata-action`'s `type=ref,event=branch` does. Measured against all
502 remote branches, it produces **zero collisions**, with or without a lowercase pass.

🔴 **DO NOT copy `CD.yml`'s tag block wholesale.** It is the project's existing convention and it is
*wrong for this story* in one specific way:

```yaml
# .github/workflows/CD.yml — search `uses: docker/metadata-action@v5`
type=sha,prefix={{branch}}-      # ← emits `<branch>-sha-<short>`, NOT `sha-<short>`
```

FR7, AC1 and NFR4 all require **`sha-<short>`**, which is metadata-action's *default* `type=sha`
prefix. Copying `CD.yml`'s line produces a shape that matches neither FR7, nor `keep_pattern`, nor
anything Stories 3.4 and 3.6 will look for. Take the *sanitizer*, not the tag list.

⚠️ **`type=sha,format=short` is fixed at 7 characters** in metadata-action. That is exactly
`keep_pattern`'s `{7,64}` floor with **zero margin**, and it means Decision 2's "pin the length
explicitly" is **not achievable through `type=sha`** — if you want a different length you must emit
that tag by `type=raw` from a value you computed yourself.

⚠️ **`type=semver,pattern={{major}}.{{minor}}` emits `1.2`**, which needs three dotted components to
match `keep_pattern` and therefore **expires at 14 days** while `1.2.3` is permanent. If both are
pushed the pair diverges after two weeks.

🔴 **Never use this** — `CD.yml`, search `BRANCH_NAME=$(echo "$GITHUB_REF"`:

```bash
BRANCH_NAME=$(echo "$GITHUB_REF" | sed 's/refs\/heads\///')
```

It strips only the `refs/heads/` prefix and leaves interior slashes, so
`feature/KAN-777/theme-mode` comes out unchanged and is not a valid tag. The related failure —
that this handler breaks on `refs/tags/v1.2.3` — is documented in `docs/forgejo-migration.md` (search
`Тег-путь падал, но прод всё равно затрагивался`), which notes the protection was **accidental**:
*"любая правка обработки имени тега превратила бы это в полноценный неапрувленный прод-деплой."*

### 5a. 🔴 How to make metadata-action read the build, not the event — and what is unproven

§4 says compute from the checked-out commit; this section says use `metadata-action`. Those are only
compatible one way, and it must be stated because **the action has no input to override ref or sha**:

- **`context: git`** (metadata-action v5) makes it read the **checked-out working tree** instead of
  the event payload. This is the single supported lever that satisfies §4 while keeping the
  sanitizer. **Verify it against the action's own README before relying on it** — see below.
- The alternative is `type=raw` with values you computed yourself, which works but **discards the
  sanitizer**, which was the whole reason to use the action.

🔴 **What is actually proven on this instance is narrower than "the action works".** Story 1.8's
probe used exactly this:

```yaml
uses: https://github.com/docker/metadata-action@c299e40c65443455700f0fdfc63efafe5b349051 # v5
with:
  images: git.crm-prionex.com/crm/fe-prionex
  tags: |
    type=raw,value=smoke-1-8-probe
```

So: **`type=raw` is proven, in full-URL SHA-pinned form.** `type=ref`, `type=sha`, `type=semver`,
`context: git` and `{{is_default_branch}}` have **never run on Forgejo**. Two consequences:

1. **`{{is_default_branch}}` resolves from `github.event.repository.default_branch`.** Whether
   Forgejo populates that on `workflow_dispatch` is unknown. If it does not, AC4's `latest` gate
   either never fires or always fires — **and job logs are unretrievable, so nobody would see it.**
   That is precisely why Task 5.5 demands a condition that can be shown to be false. Prefer an
   explicit comparison against the ref you resolved yourself over `{{is_default_branch}}`.
2. **Bare-name `uses:` is proven for the actions already in `build.yml`, not for this one.** Every
   shipped file uses bare names successfully, so bare is the house convention — but if
   `docker/metadata-action@v5` fails to resolve, fall back to the full-URL SHA-pinned form Story 1.8
   proved, and record which one you used.

### 6. The branch landscape, measured — 502 branches, and the only illegal character is `/`

Measured on `origin` at this story's baseline:

| property | count | share |
|---|---|---|
| remote branches | **502** | |
| contain `/` | **488** | 97.2% |
| contain uppercase | 252 | 50.2% |
| **illegal as a Docker tag as-is** | **488** | 97.2% |
| legal as-is | 14 | 2.8% |
| two `/` (three segments) | 13 | |
| longest name | **109 chars** | (limit is 128) |

**Uppercase is legal in a Docker tag** — the grammar is `[a-zA-Z0-9_][a-zA-Z0-9._-]{0,127}`. Only the
*repository* path must be lowercase, which is why the image path is `crm/fe-prionex` while the git
remote is `/CRM/`. So lowercasing branch names is a **style choice, not a correctness fix** — if you
do it, record it as a decision.

**Collision check, run against all 502:** replacing every run of non-`[a-zA-Z0-9._-]` with `-`
produces **zero collisions**, with or without a lowercase pass. The `/`→`-` rule is safe on today's
branch set.

⚠️ **But it stops being safe the moment Story 3.3 appends `-dev`.** Both of these exist today:

| branch | sanitized | + `-dev` discriminator |
|---|---|---|
| `bugfix/KAN-723-editing-ta-chain` | `bugfix-KAN-723-editing-ta-chain` | **`bugfix-KAN-723-editing-ta-chain-dev`** |
| `bugfix/KAN-723-editing-ta-chain-dev` | **`bugfix-KAN-723-editing-ta-chain-dev`** | `…-dev-dev` |

**Seven branches end in `-dev`, and exactly five form a real `X` / `X-dev` collision pair:**
`bugfix/KAN-723-editing-ta-chain`, `bugfix/KAN-744-interaction-history`,
`feat/KAN-550-target-action-date-expiry-type`, `feat/KAN-578-add-manual-inputdate`,
`fix/KAN-519-reconfigure-client-list`. Two different commits would push the same tag, and the
registry accepts overwrite silently. **Name this in the story record even though the discriminator is
3.3's work** — 3.3 will inherit the collision, not create it.

**Tag-length headroom, since 3.3 will need it:** longest sanitized branch is 109 chars; +`-preprod`
is 117; the ceiling is 128. It fits, with 11 characters to spare.

### 7. 🔴 The fail-closed assertion 3.1 shipped is not fail-closed, and this story owns the fix

`build.yml`'s last step runs `docker manifest inspect …:build-check-3-1 || exit 1`. Because the tag is
a fixed literal, that asserts **the tag exists**, not that **this run's image is under it** — and the
registry accepts tag overwrite, so last-writer-wins is invisible. The build step has no `id:`, so
`docker/build-push-action`'s `digest` output is never captured and there is nothing to compare
against. From the second dispatch onward it passes on the previous run's manifest.

`deferred-work.md` assigns it by name: *"**Owner: Story 3.2** — give the build step an `id:`, and
assert the digest this run produced, not the tag's existence."*

This matters more here than it did in 3.1, because **AC5 of this story is exactly that assertion**:
*"every expected tag is present and resolves to the same digest."* A tag-existence check cannot
satisfy it. Capture `steps.<id>.outputs.digest` and assert every tag resolves to **that** digest.

### 8. The concurrency group keys on the wrong ref, and this story is the one that makes it matter

`concurrency: {group: build-${{ github.ref }}}` uses the dispatch ref while the content built is
`inputs.ref`. Two dispatches of the same `inputs.ref` from different dispatch refs land in different
groups and race for the same tag; two of different `inputs.ref` from the same dispatch ref are
serialised for nothing. Because `build.yml` lives only on `main`, `github.ref` is in practice
constant — the group is one global mutex.

3.1's own in-file comment hands it over: *"Harmless while the tag is a throwaway proof; **it stops
being harmless the moment 3.2 makes tags meaningful**."* **Owner: Story 3.2.** Key the group on the
resolved commit SHA, not on any ref.

### 9. 🔴 The six decisions the plan does not make — write them down before Task 5

Each has a later story that breaks if 3.2 guesses differently than that story assumed. Record each
one in this file, with its reasoning, **before** writing YAML.

1. **Does a bare `sha-<short>` exist at all?** Four references demand it (FR7, NFR4, 3.4 AC2,
   3.6 AC1); two constrain it (FR8, 3.3 AC3); 3.6 AC2 explicitly permits the repoint *"if the
   behaviour is detected and documented as a known limitation"*. It expires at 14 days either way.
   **Recommendation: keep it.** Name what you honour and what you break. *(§3)*
2. **Short-SHA length, pinned.** Must be ≥7 hex or `keep_pattern` protection breaks. Do not inherit
   `git rev-parse --short`'s default, which varies with repository size. *(§1)*
3. **Is `<sha>` in `prod-<sha>` / `preprod-<sha>` short or full?** Only Story 5.4 pins it as *the
   commit SHA, not the environment-suffixed tag string*; FR18, FR31, 6.3 and 6.6 all write
   `prod-<sha>` without saying. **FR16's promotion guard requires the string 3.2 emits and the string
   5.4 emits to match byte for byte** — if 3.2 uses 7 chars and 5.4 derives from the full 40, the
   guard fails on every legitimate release. Nobody owns this today.
4. **Sanitization: `/`→`-`, and case.** Reuse `metadata-action`, state whether you lowercase, and
   record the `-dev` collision for 3.3. *(§5, §6)*
5. **`latest`: implement, but push or not?** *(§2)* Recommendation: implement, do not push, hand the
   verdict to 3.3 AC4.
6. **Semver `v*`: implement or defer?** No `v*` tag has ever existed in this repository (`git tag` is
   empty, GitHub `/tags` returns `[]`), no deploy story consumes one, and **Story 6.5's guard rejects
   one by construction** — it "extracts the commit SHA from the tag", and `v1.2.3` encodes none. The
   trigger that would produce it is Story 3.4's. Implementing an untestable, unconsumed path is a
   choice; so is deferring it. Either way, say which and why.

### 10. 🔴 How to actually run a build — the mechanics, and the one that can reach PROD

**Forgejo reads the workflow definition from the dispatched ref.** So to exercise *your* changes you
must push them to a ref first. Story 3.1's recipe, which worked:

1. **Cut a probe branch from `main`/HEAD** — `probe/3-2-tagging`, or a name deliberately containing a
   `/` and uppercase to exercise AC2.
2. Commit `build.yml` and push. ⚠️ **This costs a full CI run**: `ci.yml`'s `push` trigger is
   `branches-ignore: [main, staging, development]`, so any other branch fires all four jobs.
3. Dispatch over the API against that branch.
4. Delete the probe branch, local and remote, at close.

🔴 **D9 — the invariant that makes this dangerous if you improvise.** `docs/migration-decisions.md`,
search `Правило: теги — только с коммитов, где`. A commit whose tree lacks `.forgejo/workflows/`
falls through to `.github/workflows/CD.yml`, **whose `deploy` job targets PRODUCTION**. Roughly 497
of the 502 remote branches predate `.forgejo/workflows/` and are therefore in exactly that state.

**Consequences, both of which are easy to trip:**

- **Cut the probe branch from `main`/HEAD. Never reuse or branch from an old team branch** to get a
  "realistic" name — *name* your fresh branch with a `/` and uppercase instead.
- **Do not dispatch `inputs.ref` at an arbitrary team branch.** You would build someone else's stale
  tree (`npm ci` against an old lockfile) and push a tag named after their branch into the shared
  namespace.

**Dispatch credential — reuse, do not mint.** `/root/.fj_token_3_1` on s1 already carries
`write:repository,write:package` and is what Story 3.1 dispatched with. It is live and has no exit
route, which is a recorded problem owned by Oleg — but that is an argument for *not adding a second*
token, not for minting one. A database query cannot dispatch a workflow, so Task 3.3's "prefer
`docker exec`" applies to *evidence gathering*, not to dispatch.

⚠️ **The token file is an env-file line, not a bare token.** It holds `FJ_TOKEN=<hex>`. Sourcing it
(`. /root/.fj_token_3_1`) and using `$FJ_TOKEN` works; `cat`-ing the file straight into an
`Authorization` header returns **401**.

**Costs, measured.** Story 3.1's build job took **170 s end to end** — checkout,
`apt-get install docker.io`, buildx, build, push, assert — as **one uncontrolled sample** on a cold
dind. It is not a build-time figure. Each build also grows the dind volume (+0.80 GB on that first
cold run) with no prune step anywhere. A CI run on the probe branch is ~540 s wall clock (D16 records
~11 minutes total across both runners for a PR's two runs). Landing this story additionally goes
through a PR because `main` is gated (D16), and a PR branch costs **two** CI runs per commit
(`push` + `pull_request`).

### Prohibitions

1. **Do not add `push` or `pull_request` or `v*` tag triggers.** FR6 is **Story 3.4's**, not 3.2's
   and not 3.3's. (`build.yml`'s comment said 3.2 owned FR6 until 2026-08-15; it was wrong and was
   corrected. Trust the prohibition, not any stale comment.)
2. **Do not remove or change `driver: docker`.** It is LOAD-BEARING: the default `docker-container`
   driver does not inherit the job container's `--add-host` and the push dies with a bare `EOF`. It
   also has no cache export, which is **Story 3.5's** problem to solve, not yours to pre-empt.
3. **Do not change `runs-on: node-20`.** `docker-build` resolves to an image with no Node runtime;
   no `uses:` step runs under it at all. See D17.
4. **Do not push any tag matching `keep_pattern` unless it is a decision recorded in this file.**
   Permanent means permanent, and removal needs an authorised `DELETE` plus a `write:package` token.
   That includes `latest`, anything `v?\d+\.\d+\.\d+.*`, and anything `-prod`/`-preprod`-suffixed.
5. **Do not touch the retention rule.** It is the only container cleanup rule for the whole `CRM`
   organisation and governs **every** container package in it — the recorded counts vary by
   measurement date (87 packages / 620 versions in the 3.1 review, 86 in the retention section, 83 in
   the foreign-package baseline snapshot) because the neighbours push continuously; what does not
   vary is that **only `fe-prionex` is ours** and the rest is another team's production. It exists
   only in the database and there is no undo.
6. **Do not add the environment discriminator.** FR8 is **Story 3.3's**. Fix the *shape* it must fit;
   do not fill it in.
7. **Do not add `cache-from` / `cache-to`.** Story 3.5.
8. **No `||` fallback in the workflow**, and no hardcoded URL fallback (NFR8, D6).
9. **Do not delete `build-check-3-1`.** It is Story 3.1's AC2 evidence and it expires on its own
   around 2026-08-28. Deleting it early costs an authorised DELETE and destroys a record.
10. **Do not touch `.forgejo/workflows/ci.yml`.**
11. **Do not modify anything under `.github/workflows/`.** D7: no action is taken on GitHub, and
    Story 7.2 owns removing the legacy files. §5 sends you into `CD.yml` to **read** a convention —
    reading is fine, editing is not.
12. **Do not let any commit you push land without `.forgejo/workflows/` in its tree.** D9 — such a
    commit falls through to `.github/workflows/CD.yml`, whose deploy job targets production. §10.

---

## Acceptance Criteria

Verbatim from `epics.md`, Story 3.2, with this story's reading noted where the plan is silent or
self-contradictory.

**AC1 — every build carries a commit-derived tag.**

**Given** a build of any commit
**When** tags are computed
**Then** the image always carries `sha-<short>` derived from the commit SHA.

*Reading: `<short>` is pinned by Decision 2 at ≥7 hex, and "derived from the commit SHA" means the
SHA of the **checked-out commit**, not `github.sha` — see §4. Whether the tag is bare or carries a
discriminator is Decision 1; if a bare `sha-<short>` is not pushed, AC1 is satisfied by the
commit-derived tag that **is** pushed, and the deviation is recorded rather than absorbed.*

**AC2 — branch tag, deterministically sanitized.**

**Given** a build from a named branch
**When** tags are computed
**Then** the image additionally carries a `<branch>` tag
**And** branch names containing characters illegal in a Docker tag are sanitized deterministically.

*Reading: "deterministically" is the whole requirement — the algorithm must be stated and reproducible
by a consumer, because Story 4.3 deploys DEV by `ref` and something must map a ref to this tag.*

**AC3 — semver from `v*`.**

**Given** a build triggered by a `v*` git tag
**When** tags are computed
**Then** the image carries the corresponding semver tags.

*Reading: the trigger this AC names is Story 3.4's to add (Prohibition 1), and no `v*` tag has ever
existed in this repository. See Decision 6 — implement or defer, but say which.*

**AC4 — `latest` only from `main`.**

**Given** a build from `main`
**When** tags are computed
**Then** the image additionally carries `latest`
**And** builds from any other ref never produce `latest`.

*Reading: the second clause — never from any other ref — is the testable half and must be proven by a
negative control. The first clause collides with Story 3.3 AC4 and with `keep_pattern` permanence;
see §2 and Decision 5.*

**AC5 — the tags resolve to one digest.**

**Given** the tag set has been produced
**When** the registry is inspected after a build
**Then** every expected tag is present and resolves to the same digest.

*Reading: this is the AC that forces the §7 fix. "Resolves to the same digest" cannot be shown by a
tag-existence check; capture the build step's `digest` output and assert every tag against **that**
value, server-side.*

**AC6 — [DERIVED, not in the epic] the decisions are written down where later stories will find
them.** Given six decisions this story must make that the plan does not make (§9), when the story
closes, then each decision, its reasoning and the story that consumes it are recorded in this file
**and** in `docs/migration-decisions.md`, because 5.4, 6.3, 6.5 and 6.6 match on these exact strings
and none of them will read this story file.

---

## Tasks / Subtasks

### Task 1 — Bind the state before writing anything (AC: all)

- [ ] 1.1 Re-read `.forgejo/workflows/build.yml` at HEAD. Confirm the trigger block, the concurrency
      block, `runs-on`, the `driver: docker` step and the literal `tags:` line are as §7/§8 describe.
- [ ] 1.2 Re-measure the registry, do not assume: `select pv.id, pv.version, pv.is_internal from
      package_version pv join package p on p.id=pv.package_id where p.name='fe-prionex' order by
      pv.id;` over `ssh root@10.67.0.1 'docker exec -i forgejo-postgres psql -U forgejo -d forgejo'`.
      As of 2026-08-15 it holds exactly one row, `build-check-3-1`. **Record what you actually see** —
      that tag is scheduled to expire around 2026-08-28 and its disappearance would be the first real
      observation of the 14-day threshold.
- [ ] 1.3 Re-read the live `keep_pattern` from the database rather than from §1, and diff it against
      §1 character for character. It exists only there, and a drift would invalidate every shape
      decision in this story. **If it has drifted, stop and re-derive §1's permanence table before
      touching anything** — every tag decision hangs off it.
- [ ] 1.3a Close §1's sourcing gap: confirm from the Gitea/Forgejo source that matching is
      case-insensitive, that anchoring is whole-pattern, and — the load-bearing one — that
      `keep_pattern` is consulted **before** `remove_pattern`. §1's permanence table is only as good
      as those three claims, and none of them is sourced in this repository.
- [ ] 1.4 Record the run index baseline (`max(id)`, `max(index)` on `action_run`) before spending
      anything.
- [ ] 1.5 Confirm both runners are online and carry `node-20`.

### Task 2 — Make the six decisions, in writing, before any YAML (AC: 6)

- [ ] 2.1 Decision 1 — bare `sha-<short>`: yes or no, with the FR7 / FR8 / 3.3 AC3 / 3.6 AC2 conflict
      stated and the losing side named explicitly.
- [ ] 2.2 Decision 2 — short-SHA length, pinned to a literal number ≥7, with the `keep_pattern`
      reason.
- [ ] 2.3 Decision 3 — short or full SHA in `prod-<sha>` / `preprod-<sha>`. **Write it as an
      instruction addressed to Story 5.4 and Story 6.5**, since the guard needs byte equality.
- [ ] 2.4 Decision 4 — the sanitization algorithm, stated as a rule a consumer can reimplement, plus
      the case decision and the `-dev` collision handed to 3.3.
- [ ] 2.5 Decision 5 — `latest`: implement and push, or implement and leave off. If pushing, say who
      authorised it and how it will be removed if 3.3 drops it.
- [ ] 2.6 Decision 6 — semver: implement now or defer to 3.4, with the "no consumer, no `v*` tag has
      ever existed, 6.5's guard rejects it" facts stated either way.

### Task 3 — Declare the budget before spending it (AC: 5)

- [ ] 3.1 State the number of **build dispatches** AND the number of **CI runs** this story expects,
      before spending either. Story 2.1 declared 2 and spent 2; Story 3.1 declared ≤3 and spent 1;
      Story 1.11 declared zero tokens and minted two. ⚠️ **Both counters are real:** every push to
      the probe branch fires a full CI run (`ci.yml`'s `push` covers every branch except
      main/staging/development), and every dispatch is a real build. Story 3.1 spent 1 CI run + 1
      build for one probe cycle — budget per *cycle*, not per dispatch.
- [ ] 3.2 State the number of **tags this story will push**, by exact string, and confirm against
      §1's table which of them are permanent. A tag not on this list must not be pushed.
- [ ] 3.3 **Reuse `/root/.fj_token_3_1` for the dispatch; do not mint.** It already carries
      `write:repository,write:package` and is what Story 3.1 dispatched with. Source it
      (`. /root/.fj_token_3_1`) — the file holds `FJ_TOKEN=<hex>`, not a bare token, and `cat`-ing it
      into a header returns 401. For **evidence gathering** prefer `docker exec` against the database
      over any API call. **If some step genuinely needs a token that does not exist, write its
      deletion route into this file before minting** — Story 3.1 was reviewed for skipping exactly
      that, and the token above is itself live with no exit route (owner: Oleg).
- [ ] 3.4 List every write to shared state: which refs get pushed, which tags reach the shared `CRM`
      namespace.

### Task 4 — Fix what Story 3.1 handed over (AC: 5)

- [ ] 4.1 Give the build step an `id:` and capture `steps.<id>.outputs.digest`.
      🔴 **Assert it is non-empty and matches `^sha256:[0-9a-f]{64}$` BEFORE using it.** Whether
      `build-push-action` populates `digest` under the classic `docker` driver (LOAD-BEARING here,
      Prohibition 2) has never been observed on this instance. If it comes back empty, comparing two
      empty strings **passes**, and the assertion is vacuous — which is the exact failure mode §7
      exists to fix. If it is empty, say so and fall back to reading the digest server-side.
- [ ] 4.2 Replace the tag-existence assertion with a **digest** assertion: for every tag pushed,
      resolve it and compare against the captured digest. Fail closed on any mismatch **and** on any
      tag that does not resolve. This is AC5.
      🔴 **`docker manifest inspect <ref>` prints the manifest BODY, not a digest** — diffing bodies
      passes for any image built from the same Dockerfile and is not fail-closed. Use one of:
      `docker manifest inspect -v <ref>` and read `.Descriptor.digest`, or
      `docker buildx imagetools inspect <ref> --format '{{.Manifest.Digest}}'`. Record which.
- [ ] 4.3 Re-key the concurrency group on the resolved commit SHA rather than `github.ref`, and
      delete the now-stale ⚠️ comment beneath the block. State in a comment why the SHA is the right
      key and the ref is not.

### Task 5 — Compute the tags (AC: 1, 2, 3, 4)

- [ ] 5.1 Resolve the checked-out commit **after** `actions/checkout` and export it: full SHA, the
      pinned short SHA, and the ref name. **Do not read `github.sha` or `github.ref`** — under
      `workflow_dispatch` they describe the dispatch, not the build (§4).
- [ ] 5.2 Add `docker/metadata-action@v5`. It is the best-proven action on this instance — resolved in
      two Story 1.8 probe runs with its `tags` output asserted against an expected value, not merely
      "step green". Follow `build.yml`'s existing bare-name convention (`uses: docker/metadata-action@v5`);
      the full-URL rule in `epics.md` and `docs/forgejo-migration.md` is stale relative to every
      shipped file.
- [ ] 5.3 Feed it the resolved values from 5.1 explicitly rather than letting it read the event.
      Verify by inspection which of its `type=` sources consult the context, and neutralise those.
- [ ] 5.4 Emit the tag set the decisions in Task 2 settled on, and **nothing else**. Every tag emitted
      must appear in the Task 3.2 list.
- [ ] 5.4a **Add `labels: ${{ steps.meta.outputs.labels }}` to the build step.** One line, in a step
      you are already editing, and it is most of Story 3.6 for free: 3.6 AC1 requires the
      commit mapping be *"verifiable from the image metadata or labels without consulting the run
      log"*, and 3.6 AC3 requires the environment be determinable *"from the image itself, not only
      from its tag string"*. Without it 3.6 must rebuild every image. ⚠️ Carry the §4 caveat:
      `org.opencontainers.image.revision` inherits the **event** SHA unless the action is reading the
      checked-out tree — the same trap, one output over.
- [ ] 5.5 Implement AC4's negative half — no `latest` from any ref but `main` — as a condition that
      can be shown to be false, not as an absence.
- [ ] 5.6 Grep the finished file and **record the result** — Story 3.1's identical gate was never
      recorded as run, and its review had to run it retroactively. State the gate in the form that is
      actually true of the file, not one that fails on it:
      - no `||` used as a **value fallback** (the fail-closed assertion legitimately uses `||` for
        control flow — Story 3.1's gate was written to forbid the string and failed on its own file);
      - no `cache-from` / `cache-to`, no `platforms:`, no `type=gha`, no `ubuntu-latest`;
      - **no `on:` trigger other than `workflow_dispatch`** — do NOT grep for the bare string
        `push:`, because `build-push-action` requires `push: true` and the gate would fail on it.
        Grep the trigger block, not the file.

### Task 6 — Prove it (AC: 1, 2, 4, 5)

- [ ] 6.1 Dispatch against a branch whose sanitized name is non-trivial — one containing a `/` and
      uppercase. 🔴 **Cut that branch fresh from `main`/HEAD and NAME it that way** (e.g.
      `probe/3-2-Tag-Scheme`). Do not reuse or branch from an existing team branch to get a realistic
      name: ~497 of the 502 remote branches predate `.forgejo/workflows/`, and a commit whose tree
      lacks that directory falls through to `.github/workflows/CD.yml`, whose deploy job targets
      **production** (D9, §10). Record run id, job id, task id, runner, duration, status, from
      `action_run`/`action_run_job`/`action_task`, **never from a job log** (they are unretrievable
      on this instance).
- [ ] 6.2 From the database, list every `package_version` row created by the run and confirm the set
      equals the Task 3.2 list exactly — no extra rows, no missing ones.
      ⚠️ **Filter `is_internal = false`.** Every push also creates an internal `_upload` housekeeping
      row (Story 3.1 saw id 2495); counting it as an unexpected tag produces a false failure.
      ⚠️ **Forgejo writes one `package_version` row per tag**, each with its own `package_file` set —
      so N tags means N rows, and the AC5 check is that the `manifest.json` blob hash agrees across
      all of them.
- [ ] 6.3 **AC5, server-side:** confirm every tag resolves to the digest the build step reported.
      Compare against `package_file`/`package_blob` for the `manifest.json` blob, the way Story 3.1
      established, rather than trusting the in-job assertion alone.
- [ ] 6.4 **AC4 negative control.** Prove no `latest` is produced from a non-`main` ref — from the
      absence of the row *and* from the condition being evaluated, not from absence alone. Story
      1.11's lesson: *an empty result is not evidence of safety.*
- [ ] 6.5 Confirm which of the pushed tags match `keep_pattern` by compiling the regex against them,
      not by eye. Story 1.11 shipped a dead clause that looked right. **The recipe:** compile
      `\A(?i)fe-prionex/(…)\z` and match against **`fe-prionex/<tag>`**, not against the bare tag —
      `match_full_name = true` means the full name is the subject. *(Measured 2026-08-15: no
      sanitized name among the current 502 branches matches `keep_pattern`, so the branch tag is safe
      today. Re-confirm for whatever you actually push.)*
- [ ] 6.6 If the budget allows a second dispatch of the **same** ref: confirm the tags repoint to the
      new digest, or do not, and record which. That is Story 3.6's AC2 question and a free
      observation here.

### Task 7 — Record (AC: all)

- [ ] 7.1 Fill in the Dev Agent Record: runs declared vs spent, tags declared vs pushed, durations,
      the digest, and every «не проверено» that survives.
- [ ] 7.2 Write the six decisions into `docs/migration-decisions.md` as a **D-record**, not only into
      this file. Stories 5.4, 6.3, 6.5 and 6.6 match on these strings and none of them reads this
      file. Add the changelog row too. **Placement rules, verified — get these right or you displace
      the one section that cannot be reconstructed from the repository:**
      - the next number is **D18** (D17 is currently last);
      - the anchor form is `<a id="d18"></a>` on its own line immediately above `## D18. …`;
      - the record goes **before** `<a id="changelog"></a>`, never at end of file — the last section
        must remain `## Восстановление правила очистки реестра (Story 1.11)`;
      - the changelog row appends after the `| 15.08.2026 | 3.1 |` row;
      - also update the two stale spots: the header line that enumerates anchors as `#d1 … #d15`,
        and the top summary table, which still has no D17 row.
- [ ] 7.3 Record in `deferred-work.md`: the `-dev` sanitization collision handed to Story 3.3; the
      `sha-<short>` / FR8 conflict and how it was resolved; the FR31 / Story 6.3 contradiction if it
      survives; and the semver decision with its consumer gap.
- [ ] 7.4 **Record the `sha-<sha>-prod` asymmetry — as an observation, not as a correction.**
      Story 6.6's amendment note says *"No story in this plan produces that shape"* about
      `sha-<sha>-prod`, and **that statement is correct**: Story 3.3 writes the shape only as *"for
      example"*, no AC mandates it, and the one instance that ever existed (`sha-a1b2c3d-prod`) was
      Story 1.11's seeded test material, deleted 2026-08-14 — a workflow never produced it. What is
      *also* true is that the **live retention rule protects that shape**, so the plan protects
      something nothing produces while leaving the bare `sha-<short>` — which four references
      demand — unprotected. **Write that asymmetry down; do not "correct" 6.6.** Rewriting a true
      statement into a false one is the class of error this project's reviews exist to catch.

### Task 8 — Close (AC: all)

- [ ] 8.1 Commit on a branch, open a PR — `main` is gated (D16), direct push is rejected.
- [ ] 8.2 Update `sprint-status.yaml` (`3-2-apply-the-image-tagging-scheme`) to `review`.
- [ ] 8.3 If a token was minted, execute its planned exit and record the live-token count before and
      after.
- [ ] 8.4 Close the Task 3 ledger: declared against actual, with every difference explained. Story
      3.1's ledger reported zero commits to protected branches against four actual and called itself
      under budget — do not repeat that.

---

## Dev Notes

### The file being modified

`.forgejo/workflows/build.yml`, created by Story 3.1, is the only workflow this story touches. Its
current shape, verbatim in the parts that matter:

```yaml
on:
  workflow_dispatch:
    inputs:
      ref:
        description: 'Git ref to build (branch, tag, or SHA).'
        required: true
        type: string

concurrency:
  group: build-${{ github.ref }}      # ← Task 4.3 re-keys this
  cancel-in-progress: false
```

```yaml
      - name: Set up Docker Buildx     # ← Prohibition 2: do not touch
        uses: docker/setup-buildx-action@v3
        with:
          driver: docker

      - name: Build and push image     # ← Task 4.1 adds `id:`, Task 5.4 replaces `tags:`
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile.prod
          push: true
          tags: git.crm-prionex.com/crm/fe-prionex:build-check-3-1
          build-args: |
            VITE_API_BASE_URL=https://build-check-3-1.invalid/api
            VITE_WS_URL=wss://build-check-3-1.invalid/ws
```

The build-args stay non-production literals — real values are **Story 3.3's**, from OpenBao.

**Also in the file and NOT to be lost if you regenerate rather than edit:** the `apt-get install
docker.io` step, the `docker version` reachability check, and the login step —

```yaml
      - name: Log in to git.crm-prionex.com
        uses: docker/login-action@v3
        with:
          registry: git.crm-prionex.com
          username: ${{ secrets.REGISTRY_USER }}
          password: ${{ secrets.REGISTRY_TOKEN_RW }}
```

Those are org-level secrets on `robot-registry` (D14). `REGISTRY_TOKEN` and `ci-bot` never existed —
do not invent them.

⚠️ **Prohibition numbers inside `build.yml`'s comments are Story 3.1's, not this story's.** The file
says things like *"(Story 3.2, Prohibition 7)"* on the very `tags:` line Task 5.4 replaces, and
*"(AC3, Prohibition 10)"* on the trigger block. Against 3.2's list those numbers mean entirely
different rules. **Update or delete each comment you invalidate** — this project treats `build.yml`
as a permanent record, and a stale cross-reference in it is exactly what 3.1's review had to repair.

### Action verdicts on this instance

| action | status |
|---|---|
| `docker/metadata-action@v5` | ✅ **best-proven of the docker actions.** Resolved in two Story 1.8 probe runs, and its `tags` output was asserted against an expected value: *"`tags output: [git.crm-prionex.com/crm/fe-prionex:smoke-1-8-probe]` — совпадает с задуманным тегом точно"* |
| `docker/setup-buildx-action@v3` | ✅ proven, and in production use in `build.yml` |
| `docker/login-action@v3`, `docker/build-push-action@v5` | ✅ proven by run 512 |
| `actions/checkout@v6` | ✅ proven, in daily use |
| `actions/upload-artifact@v4` | ❌ `GHESNotSupportedError` — never use |

⚠️ **D12's per-action verdict table is stale** — it still grades `login-action` and
`build-push-action` as «не проверено» although its own section banner and run 512 say otherwise. Do
not quote the table row.

### Testing standards

Every AC claim is a recorded observation from a real run — a `package_version` / `package_file` row,
a digest, an `action_run` id — or it is marked «не проверено». **Job logs are unretrievable on this
instance** (404 on every logs endpoint, `log_in_storage` stays false). Anything that must be proved
has to be observable in the **database or the filesystem**, never in stdout. Story 2.4's technique —
encoding a value into an artifact *name* so one SQL query returns it — is available if needed.

⚠️ **The server log is a different thing and it IS readable.** `docker logs forgejo` settled a
two-day-old false defect in FR11. Two stories in a row generalised "job logs are unreadable" into not
reading the server log. Do not be the third.

### Anti-patterns for this story

- **Reading `github.sha` / `github.ref`.** Under `workflow_dispatch` they describe the dispatch, not
  the build. §4.
- **Asserting a tag exists.** AC5 asks for a digest match. §7.
- **Pushing a tag "just to see".** Some shapes are permanent and removal costs an authorised DELETE
  plus a token mint with no revocation route. §2, Prohibition 4.
- **Hand-rolling the sanitizer in shell.** The repository already has one that was a defect. §5.
- **Doing Story 3.3's job.** The discriminator is theirs; the shape it must fit is yours.
- **Adding triggers.** FR6 is Story 3.4's. Prohibition 1.
- **Trusting a comment over a prohibition.** `build.yml` misattributed FR6 to this story until
  2026-08-15.
- **Believing the plan is self-consistent.** It is not, on this exact subject — §3, §9, and Task 7.4.

### Previous story intelligence

- **3.1** proved the push and shipped two known defects to this story by name (the tag-existence
  assertion, the concurrency key). Its review also found the `driver: docker` ↔ FR9 conflict, a
  budget ledger that reported 0 commits against 4, and a token minted without its exit written first.
  Read its Review Findings section before starting.
- **1.11** built the retention rule, shipped a dead regex clause that looked right, and taught the
  standing lesson: *an empty result is not evidence of safety*, and *a preview that returns nothing is
  evidence of no match, not of correctness.*
- **1.10** overwrote a tag in place (`reg-check-1-10`) — evidence that this registry accepts silent
  overwrite.
- **2.1** declared its budget retrospectively and was caught on review. Declare before spending.
- **1.8** proved every `docker/*` action including `metadata-action`, in full-URL SHA-pinned form.

### Project Structure Notes

| Path | Change |
|---|---|
| `.forgejo/workflows/build.yml` | **UPDATE** — the only executable file this story touches |
| `_bmad-output/implementation-artifacts/3-2-…md` | UPDATE — this record |
| `_bmad-output/implementation-artifacts/deferred-work.md` | UPDATE — Task 7.3 |
| `_bmad-output/planning-artifacts/epics.md` | UPDATE — Task 7.4 correction only. **Annotate in place; do not reflow** — Story 3.1 reflowed this file and broke four citations including one shipped inside `build.yml` |
| `docs/migration-decisions.md` | UPDATE — D-record and changelog row (Task 7.2) |
| `.forgejo/workflows/ci.yml` | **Untouched** (Prohibition 10) |
| Anything under `src/`, `package.json`, `Dockerfile.prod` | **Untouched** |

### References

- `epics.md` — Story 3.2 (ACs), FR7, FR8, FR11, and the consuming stories 3.3, 3.4, 3.5, 3.6, 4.1,
  4.3, 5.2, 5.4, 6.3, 6.5, 6.6, 6.8. Cite by **search string, not line number** — the file was
  reflowed on 2026-08-14 and line-number citations across the repo are unreliable.
- `docs/migration-decisions.md` — `Восстановление правила очистки реестра` (the rule, verbatim), D12
  (action verdicts, with its stale table), D14 (registry credentials), D16 (the `main` gate), D17
  (the `node-20` label decision).
- `deferred-work.md` — `Deferred from: code review of story-3.1` (the two items owned by this story,
  and the `driver: docker` ↔ FR9 conflict), the story 1.11 sections (retention traps), and the
  registry inventory measured 2026-08-15.
- `_bmad-output/implementation-artifacts/3-1-build-and-publish-an-image-to-the-forgejo-registry.md` —
  Dev Agent Record and Review Findings.
- `.github/workflows/CD.yml` — `docker/metadata-action@v5` block (reuse) and the `sed` branch-name
  handler (do not reuse).

---

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

---

## Open Questions for Review

### Blocking

1. **`latest` — push it or not?** (§2, Decision 5.) It is permanent by `keep_pattern`, Story 3.3 is
   authorised to drop it, and removal needs Oleg. **Owner: Oleg**, unless the dev agent's written
   decision is to implement-but-not-push, which needs no authorisation.

### Non-blocking

2. **The bare `sha-<short>` conflict** (§3) has no owner in the plan. Whatever 3.2 decides, Story 6.3
   and FR31 currently contradict it.
3. **`<sha>` length in `prod-<sha>` / `preprod-<sha>`** (Decision 3) — 3.2 fixes it, but 5.4 and 6.5
   must be told, or the promotion guard fails on every legitimate release.
4. **Semver has no consumer** (Decision 6) and 6.5's guard rejects it by construction.
5. **Story 4.3 deploys DEV by `ref`, not `image_tag`** — nothing in Epic 3 or 4 defines how a ref
   becomes a tag. 3.2's sanitizer is the only candidate. Either define the mapping or say 4.3 owns it.
