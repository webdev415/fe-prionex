# Story 6.6: Record the Deployed Production Image

Status: ready-for-dev

Epic: 6 — Production Release and Verified Rollback
Story key: `6-6-record-the-deployed-production-image`
Contexted: 2026-08-26, from a scratchpad worktree off `origin/main` @ `584cc886` (PR #97, Story 6.4), branch `story-6-6/pr-1-context`
Requirements: **FR18** (retag after a successful PROD deploy), epic ACs 1–4; consumes FR15/FR17/FR24 (Story 6.4), FR31 (Story 6.3)

## Story

As a release engineer,
I want the registry to identify what production is running,
so that rollback targets and audit history do not depend on inspecting servers.

---

## 🚨 Read this before anything else

### 1. What this story is, in one paragraph

Story 6.3 shipped `record-prod-image.yml` — a **dispatch-only** recorder that writes `prod-<12hex>` and
`prod-current` — and its own header says *"Story 6.6 consumes or supersedes"*. Story 6.4 shipped
`deploy-prod.yml` — three jobs, `derive → build → deploy` — and its §12 says *"the `prod-current` /
`prod-<sha>` retag after deploy… Story 6.6, and it inherits `record-prod-image.yml` plus its 26
findings."* **This story is the join.** It makes recording a consequence of a successful production
deploy instead of a separate human act, on **both** the release and the rollback path, and it fixes the
thirteen code findings that arm the moment anything dispatches that recorder. It writes no new
mechanism: the retag logic exists, is proven live once (run 600, 17/17), and is not to be rewritten.

### 2. 🔴 THE INHERITANCE IS THE STORY — thirteen findings, and two of them are load-bearing

`deferred-work.md`, *"Carried from: Story 6.3"* → **"🔴 In shipped code — `.forgejo/workflows/record-prod-image.yml`. Owner: Story 6.6."**
Story 6.3 was closed `done` by Oleg **with these unfixed**, deliberately. They were found by three
adversarial layers run as independent agents; **two layers independently reported the same G6 defect.**
**None fires today, because nothing dispatches the file. All of them arm the moment this story does.**

| # | Finding | Why it matters *here* |
|---|---|---|
| **1** | 🔴 **The probes send ONE `Accept` media type where `record-preprod-candidate.yml` sends FOUR.** A false 404 sets `exists=false`, leaving `PRE_DIGEST=""` — and **every** protective branch is gated on `[ -n "$PRE_DIGEST" ]`. | This story moves `prod-current` on every deploy. A false 404 means the **pre-move digest is never captured**, so the displaced production pointer target is lost — and the very comparison that distinguishes a no-op from a move never runs. Story 5.4's own **M4** failure mode, reintroduced in a file whose header claims to have closed it. |
| **2** | 🔴 **G6 inspects `$SHA_TAG`, not `${IMAGE}@${CANDIDATE_DIGEST}`.** The digest is resolved one step earlier; G6 re-resolves by tag. | **The labels checked and the manifest written are only assumed to be the same object** — under two permanent names. One-line fix. The sibling avoids the split entirely. |
| 3 | **No `if: always()` anywhere.** A failure after the first write suppresses both the tag listing and the disclaimer. | The write order explicitly plans for a death between the two writes; that is exactly the state in which the record of what happened is lost. |
| 4 | **The check-to-write window is not disclosed.** `imagetools create` has no compare-and-swap. | The sibling says so in its own header; this file copied the write pattern and not the disclosure. |
| 5 | **`grep -Eqi` inverts its safety direction in G4.** `build.yml` uses `-i` in a **reject** test (broader = more refusal); G4 uses it in an **accept** test (broader = more acceptance) — and transplants `build.yml`'s justification verbatim. | |
| 6 | **No `--proto-redir '=https'` on credentialed `curl -L`** — a redirect could replay registry basic-auth in cleartext. | |
| 7 | **"Assert every write target is this literal repository" cannot fail** — all three tags are built from `${IMAGE_REPO}:` in G3. G4's equivalent unreachability **is** disclosed; this step's is not. | |
| 8 | **A stale example ships in the dispatch UI:** `image_tag`'s description reads *"e.g. sha-41ab0470ab6b-prod"* — the **superseded** commit (`#d46`). | |
| 9 | **The header asserts a `build.yml` outcome its own quoted decision table contradicts** — *"goes red"* as mechanical certainty, where identical digests take the documented no-op branch. | |
| 10 | **Read-back has no retry** — a transient 5xx/429 after a successful `create` reports failure while the permanent tag is written and correct. **The most expensive false negative this file has.** | |
| 11 | **No `defaults.run.shell: bash`** while G2 depends on ANSI-C quoting (`$'\n'`), not POSIX. | |
| 12 | **The `tags/list` step degrades to a green WARN** on 401 or transport failure and handles no pagination — while its own header calls that output *"the state a later reader should trust"*. | **Epic AC4 rests on this step.** |
| 13 | **The probes dropped the sibling's empty-credential pre-check and 401 classification** — an empty secret becomes an unauthenticated request reported as AMBIGUOUS. Fail-closed, so the loss is diagnostic. | |

**Full text with locations and evidence is in `### Review Findings` of
`6-3-rebuild-the-running-production-commit-into-the-forgejo-registry.md`.** Read it there; do not
re-derive it.

**One more, from the triage list, owner named as this story:**
- ⚠️ **On the authorised-move path the displaced `prod-current` digest survives only in the run log**
  (`write-current`). *"Owner: Story 6.6, which moves the pointer on every deploy by design and must
  decide what it records."* — **§7 settles it.**

### 3. 🔴 WHERE THE STEP LANDS, AND THE THREE SHAPES IT COULD TAKE

`deploy-prod.yml` today (348 lines, 3 jobs): `derive` → `build` (skipped on rollback) → `deploy`.
This story adds a **fourth job, `record`**, after `deploy`. The question is what that job *is*.

| Option | Verdict |
|---|---|
| **A. Give `record-prod-image.yml` a `workflow_call` block and add `record:` as a fourth `uses:` job** | ✅ **RECOMMENDED.** One implementation, one place to fix the thirteen findings, and the file keeps its `workflow_dispatch` half for manual/recovery use. Story 6.3 deliberately left this block out with a reason that has now expired: *"the caller/callee decision — including `secrets: inherit` — is Story 6.4's to make, not this file's to pre-empt."* **6.4 made it** — `secrets: inherit` on both its callees, with the RW exposure recorded as accepted (§6 of that story). |
| B. Inline the retag steps into a new job in `deploy-prod.yml` | ❌ Two implementations of the same registry write, diverging on the next fix. This project has already priced that: `record-preprod-candidate.yml` copies `build.yml`'s **pattern** and says so, but nothing copies a whole write path twice. |
| C. Leave it dispatch-only; the operator runs the recorder by hand after each deploy | ❌ **Fails epic AC1 as written** — *"Given a successful production deploy, When the recording step runs."* It is also the PRE-PROD shape (5.4), and PRE-PROD chose it for a reason that does not transfer: `preprod-<sha>` means *"a human asserted validation passed"*, so it needs a human verdict input. `prod-<sha>` means *"this was deployed"*, and the deploy is the evidence. |

🔴 **`workflow_call` plumbing has surprised this project twice (`#d8`, `#d21`) and again last week
(`#d47`(3)).** Option A is a recommendation with a live hazard attached; §4 is that hazard.

### 4. 🔴 THE SHADOWING TRAP — and why this story is *safe* from it, measured

`#d47`(3), runs 637/640, discovered by Story 6.4 **five days ago**: *"A DISPATCH INPUT SHADOWS THE
CALLEE'S INPUT OF THE SAME NAME."* A `uses:` job's `with:` value was **silently replaced** by the
caller's own dispatch input of the same key. Invisible in `deploy-dev.yml` and `deploy-preprod.yml`
because both pass the value through under the same name, so the two coincide.

**Story 6.4 fixed it by renaming its dispatch input to `tag`.** That rename is what makes this story
safe, and the dev agent must understand *why* before touching either file:

```
deploy-prod.yml  dispatch inputs : tag, rollback
record-prod-image.yml  inputs     : image_tag, acknowledgement, allow_current_move
                                    ^^^^^^^^^  no collision -> `with: image_tag:` reaches the callee intact
```

🚨 **Do NOT rename `deploy-prod.yml`'s `tag` input back to `image_tag` for tidiness.** It would
re-create exactly the shadowing that cost Story 6.4 two runs, and it would do so on the **production**
release path. The deviation from epic AC1's literal `image_tag` is recorded in `#d47` with its reason.

🚨 **Do NOT add an `image_tag`, `acknowledgement` or `allow_current_move` input to
`deploy-prod.yml`'s own `workflow_dispatch` block.** Any of the three would shadow the callee's.

### 5. 🔴 G1 AND `allow_current_move` DO NOT SURVIVE AUTOMATION UNCHANGED — decide, do not inherit

Two of the recorder's inputs exist because a **human** types them at a dispatch form. An automatic
caller has no human, and passing the literal from `with:` turns a guard into a constant.

**G1 — `acknowledgement: MOVE-PROD-CURRENT`.** Its stated purpose: *"A stray or mistyped dispatch dies
here, before a credential is loaded."* A caller that always passes the literal proves nothing. But the
guard is not worthless — it still protects the **dispatch** path, which stays open for recovery.
➡️ **Required shape: keep G1, gate it on the event.** On `workflow_call` the authorisation is the
deploy that already succeeded — a job that only runs `needs: [deploy]` on success cannot be a stray
dispatch. **Write that sentence into the file**; do not delete the guard and do not pass a constant
through it while pretending it still guards.

**`allow_current_move` — default `false` (REFUSE).** Story 6.3 chose refuse-by-default because *"6.3 is
the FIRST write, so the tag must not exist"*, and its own comment closes: *"Story 6.6, which moves the
pointer on every deploy by design, sets its own policy; **it does not inherit this default**."*
✅ **RATIFIED by Oleg 2026-08-26 (Open Question 2): the deploy IS the authorisation, and nothing
additional gates the call path.**

⚠️ **The alternative that was put to him and declined, recorded because a reviewer will raise it:** gate
`record` on a matching row already existing in `docs/prod-releases.md`, which would make the approval
regulation technically enforced. Declined on three grounds — it is a **NEW technical gate**, and NFR9 /
`#d5` state there is none and that its absence is *accepted, not deferred*; it would need a repository
checkout and a read credential in the write job; and it would have **refused §8's own move exercise**,
whose dispatches 2 and 3 are deliberately not releases and correctly have no ledger row.

➡️ **Required shape: on the `workflow_call` path a move is the normal outcome and is permitted.**
A deploy that succeeded and then refused to record itself leaves `prod-current` naming the *previous*
release — the single worst state this marker can be in, and worse than not having the marker at all.
**The dispatch path keeps refuse-by-default.**

🔴 **Finding #1 is what makes this dangerous rather than merely a policy choice.** With the move
permitted, a false 404 from the single-`Accept` probe silently skips the pre-digest read, and the
displaced digest is gone. **Fix finding #1 before, not after, flipping the default.**

### 6. 🔴 IT MUST RUN ON THE ROLLBACK PATH TOO — Story 6.8 already depends on it

Epic Story 6.8 AC: *"Given the rollback has been performed, When the registry is inspected, Then
`prod-current` points at the restored image."* **Nothing else in the plan moves it.** So `record` runs
on **both** paths of `deploy-prod.yml`, not only the release path.

Mechanically this is free and already correct in the shipped file: on a rollback, `prod-<12hex>`
**already exists at the identical digest**, and `write-history`'s *attach-if-absent / no-op-if-identical
/ REFUSE-if-different* logic takes the no-op branch. `prod-current` takes the **move** branch. That is
the intended semantic and it needs no new code — only the `needs:`/`if:` wiring.

🔴 **Copy `deploy-prod.yml`'s own `always()` lesson exactly.** Its header:
> *"Get this wrong and the ROLLBACK PATH SILENTLY DOES NOTHING while the run reports green — the worst
> outcome available to a production workflow, because nothing fails."*

`record` depends on `deploy`, which itself runs under `always() && (build success || build skipped)`.
**`record` must require `needs.deploy.result == 'success'` — a green-on-skip `record` is exactly the
failure that header describes, one job further down.**

### 7. 🔴 THE `prod_tag` SETTLEMENT — an explicitly open question this story is named to close

`docs/prod-releases.md`, `prod_tag` column, verbatim:
> *"Deliberately not pinned to a shape … which of the matching PROD forms a rollback targets is **Story
> 6.4/6.6's to settle**."*

**Story 6.4 settled the deploy half by construction.** `deploy-prod.yml`'s `derive` job refuses
`prod-current` and `prod-*` outright — *"a RECORD, not a deployable reference"* — and only
`sha-<12hex>-prod` reaches `deploy-stand.yml`. **This story records the settlement:**

| Form | Role | Deployable? | Protected by `keep_pattern`? |
|---|---|---|---|
| `sha-<12hex>-prod` | the artifact; **the ledger's `prod_tag` value**; what a rollback dispatches | ✅ the only one | ✅ `sha-[0-9a-f]{7,64}-(pre)?prod` |
| `prod-<12hex>` | permanent per-commit history; the shape Story 6.5's guard mirrors | ❌ | ✅ `(pre)?prod-[0-9a-f]{7,64}` |
| `prod-current` | the Forgejo-side production pointer | ❌ | ✅ by literal name |

➡️ **`docs/prod-releases.md`'s `prod_tag` column gets one dated amendment naming `sha-<12hex>-prod`.**
The file's append-only rule governs its **rows**; this is column prose, and amend-don't-rewrite is the
project's standing convention for that. **No row is added, edited or removed by this story.**

**And the displaced-pointer item (§2, triage) is settled with it:** on a move, the **pre-move digest and
the tag it belonged to are written to the step summary and to the job's own output**, and the
authoritative sink is the ledger row's own `prod_tag`, which already names the previous release. The
run log alone is the tier this project calls best-effort (`#d38` §D1) — say so rather than rely on it.

### 8. 🔴 THE OPERATIONAL HAZARD THAT GATES THE LIVE PROOF — `prod-current` must not leave the cutover image

**Measured state of the registry (Story 6.4 closeout, and `#d46` §2.1 from `package_version` directly):**

```
sha-a99ccd44c5a3-prod   digest sha256:f30c794123ba…a3f3   <- THE CUTOVER IMAGE (Story 6.9's target)
prod-a99ccd44c5a3       same manifest                      <- history   (run 600, 11:17:09Z)
prod-current            same manifest                      <- pointer   (run 600, 11:17:10Z)
sha-28f7fd36b75e-prod   PROOF OF PATH, NOT A RELEASE       <- no ledger row, recorder never dispatched
sha-308ea1520c59-prod   PROOF OF PATH, NOT A RELEASE       <- no ledger row, recorder never dispatched
preprod-00ef3be4743d · preprod-28f7fd36b75e · preprod-a99ccd44c5a3 · preprod-current
```

`prod-current` names the cutover image, and Story 6.4's handover says it *"must keep naming it"* until
Story 6.9 runs. **That is a statement about where the pointer must END, and it was written when the only
way to move it was to hand it away.** It is not a prohibition on moving it and moving it back.

🔴 **RESOLVED 2026-08-26 — Oleg, verbatim: *"move ok"*.** Open Question 1 asked whether this story spends
anything to observe a real `prod-current` MOVE. It does. **Option (b): there and back.**

**Why the price is low, stated so the decision is legible later and not re-litigated:** s10 serves **no
users**. The traffic switch is external, owned outside this repository, and has not happened — s2 keeps
serving until it does (`#d23`, Story 6.9 as amended 2026-08-18). So a deploy that changes what s10 serves
for the length of two dispatches has **zero user blast radius**. That is the whole of why this is cheap
here and would not be cheap after the switch.

**The exercise, in order:**

| # | Dispatch | Registry effect | Proves |
|---|---|---|---|
| 1 | `tag: sha-a99ccd44c5a3-prod`, `rollback: true` | **nothing changes** — both writes take their no-op branches | the wiring, end to end, on the real stand |
| 2 | `tag: sha-308ea1520c59-prod`, `rollback: true` | `prod-308ea1520c59` **created**; `prod-current` **MOVES** | epic AC2's move clause, live |
| 3 | `tag: sha-a99ccd44c5a3-prod`, `rollback: true` | `prod-a99ccd44c5a3` no-ops; `prod-current` **MOVES BACK** | the move a **second** time, **and restores the state 6.9 requires** |

Dispatch 3 is not cleanup — it is the second discriminating observation, in the opposite direction, and
`record-preprod-candidate.yml`'s own `G-backwards` note is the precedent for treating direction as
something to notice rather than to forbid.

🔴 **THE RESIDUE, named before it is created rather than found later.** Dispatch 2 mints
`prod-308ea1520c59` **permanently** — `keep_pattern` protects it by shape and only an authorised `DELETE`
with a `write:package` token removes it. **It is a PROOF MARKER, not a release.** Story 6.4 already had
to write that sentence for `sha-28f7fd36b75e-prod` and `sha-308ea1520c59-prod`; this is the first time a
`prod-<12hex>` **history** marker gets it too, and that is a genuinely new class — see **AC4**, which it
directly complicates.

⚠️ **Rejected alternative, recorded because a reviewer will raise it:** exercising the move by dispatching
`record-prod-image.yml` directly with `allow_current_move: true`, touching no stand. Cheaper, and it would
prove the **recorder's** move branch — but **not the automatic path**, which is the only thing this story
ships. AC2 is about what a deploy causes, so the evidence has to come from a deploy.

### 9. 🔴 retro-E5 — this story inherits an unmet AC and is the only story that can pay it

**retro-E5 (adopted):** *"every new guard ships with a live outcome matrix (one run per branch incl. a
discriminating run); review a foundation story before writing the story that builds on it."*

**Story 6.3's AC6 is recorded UNMET.** Its own file header:
> *"ONE dispatch has ever run this file… NO guard here has ever been watched REFUSING anything on this
> instance… Whoever next dispatches this file — **Story 6.6** — inherits it."*

| Guard | Pass row today | Discriminating row | Earnable here? |
|---|---|---|---|
| G1 acknowledgement | run 600 | a wrong literal | ✅ **free** — dispatch path, no writes reached |
| G2 `-prod` suffix | run 600 | `sha-a99ccd44c5a3-preprod` (exists) | ✅ **free** |
| G3 exactly-12 hex | run 600 | a 40-hex tag | ✅ **free**, and it closes M7's own G3 clause |
| G4 `keep_pattern` compile | run 600 | — | ❌ unreachable through this file's inputs (force-test only) — **label it, do not leave it blank** |
| classified-404 probe | run 600 | a `sha-<12hex>-prod` that does not exist | ✅ **free** |
| G6 labels | run 600 | — | ❌ **UNEARNED, decided by Oleg 2026-08-26.** Needs a `-prod`-shaped tag whose `org.prionex.environment` is not `prod`; none exists and `build.yml` **cannot** produce one — it derives the label and the tag suffix from the same shell variable. **Label the row with that sentence.** |
| G5 equivalent | — | — | ❌ **permanent named absence** in 6.3's design (no PROD stand at write time). 🔴 **Re-open it: s10 IS now live.** See §10. |
| `record` on rollback | §8's free dispatch | — | ✅ **free** |
| `record` on release | — | — | ⚠️ the release deploy leg has **never been green** (`#d47`); **Story 6.9 owns its first run.** Label UNEARNED with that reason. |
| `prod-current` MOVE | §8 dispatch 2 | §8 dispatch 3 (the opposite direction) | ✅ **AUTHORISED 2026-08-26** — *"move ok"*. **Two** rows, not one |

### 10. 🔴 A G5-EQUIVALENT IS NOW POSSIBLE, AND THAT IS NEW SINCE STORY 6.3

`record-prod-image.yml`'s header states, correctly **as of 2026-08-26 morning**:
> *"THERE IS NO G5-EQUIVALENT IN THIS FILE, AND THAT IS A NAMED ABSENCE… THERE IS NO PROD STAND. s10 is
> Story 6.10's and is not provisioned."*

**That sentence expired the same day.** Story 6.4 closed with: *"THE PROD STAND IS LIVE ON s10 … runs
634 and 642, `fe-prionex-prod` healthy on `0.0.0.0:8080`, revision `a99ccd44c5a3…129e9`, digest
`f30c7941…a3f3`, on `crm-prod-network`."*

**On the `workflow_call` path this story can assert what 5.4's G5 asserts:** the stand is healthy **and
demonstrably serving this exact digest** — which is the difference between *"an image exists"* and
*"production is running it"*, i.e. the difference between the marker this story's own user story
promises and a weaker one. `deploy-stand.yml` has just run and reported healthy; the digest is
`derive`'s `deploy_tag` resolved in the registry.

⚠️ **Scope judgement, made here rather than left open:** a full G5 needs a `runs-on:
fe-prionex-prod-deploy` job with host access. **Recommended: implement the digest half only** — assert
that `prod-current`'s new target equals the digest `deploy-stand.yml` actually deployed — and **record
the health half as deliberately not built, with the reason**. Do not silently leave the stale
"there is no PROD stand" sentence in the header: **correcting it is mandatory**, implementing the full
guard is not.

### 11. Previous story intelligence — what Epic 6 has already paid for

**From Story 6.4 (`review`, merged as PR #97 / `584cc886` — the row is stale, do not read it as
`backlog`):**
- `deploy-prod.yml` exists and is proven: rollback leg green **twice** (634, 642). **Release deploy leg
  never green** — Oleg's option (в): do not spend a fourth permanent tag; **Story 6.9's cutover will be
  its first run.** Epic 6's preamble calls that a one-way door.
- `actions/checkout` **destroys `$GITHUB_OUTPUT` written earlier in the same job** (`#d47`(4)). If this
  story adds a checkout anywhere, it goes **first**.
- `build.yml` **cannot rebuild a commit older than 2026-08-19** (`Dockerfile.netns-isolation-check`).
  Candidate `00ef3be4743d` is physically unbuildable. Irrelevant to rollback; relevant to any thought
  of "just rebuild an old release to test with".
- `capacity: 1` on s10's runner makes lock-contention rows undiscriminating — *"it would prove the
  runner, not the lock."* Do not spend runs on it.

**From Story 6.3 (`done`, closed with findings carried):**
- Run 600, 17/17: three names on **one** manifest, read back independently of the run.
- **Four ACs UNMET by decision** — AC4 (no `D45` at all), AC6 (guards unexercised), AC8 (`prod-current`
  names an image no host serves; the only statements are the header and a job log), AC9.
- 🔴 **The retention rule is `UNPROVEN` by execution, owner Story 6.3, and 6.3 closed three days before
  the first observable date (2026-08-29).** Epic AC3 of *this* story asserts protection. **You cannot
  upgrade that claim; you can only cite it honestly.** Ownership is **not** reset to nothing.

**From Story 5.4 (`done`) — the pattern, not the file:** write **history first, pointer second**; every
write read back before it is reported; `--prefer-index=false` mandatory; `--annotation` is **rejected
outright** by this instance's buildx v0.33.0 (measured 2026-08-24), so OCI annotations are not a
metadata channel.

**The house ratio:** `deploy-preprod.yml` is ~40 lines of body under ~136 lines of header. **The header
is where the reasoning lives.**

### 12. 🔴 Blast radius and frozen files

**Written by this story:**
- `.forgejo/workflows/record-prod-image.yml` — **UPDATE.** The thirteen findings, the `workflow_call`
  block, the two policy inputs (§5), the stale G5 sentence (§10), the stale `image_tag` example (#8).
- `.forgejo/workflows/deploy-prod.yml` — **UPDATE, minimal.** One new `record:` job plus header lines.
- `docs/prod-releases.md` — **one dated column amendment** (§7). **No row is touched.**
- `docs/migration-decisions.md` — one decision record.
- `_bmad-output/implementation-artifacts/sprint-status.yaml`, `deferred-work.md`, this file.

**🔴 FROZEN — editing one to make this story easier is the worst available move:**
- **`.forgejo/workflows/deploy-stand.yml`** — Story 4.8's; consumed, never edited. If it seems to need a
  change, that is a finding.
- **`.forgejo/workflows/build.yml`** — carries the AC2 immutability guard.
- **`.forgejo/workflows/record-preprod-candidate.yml`** — Story 5.4's, frozen. **Its patterns are copied;
  the file is not edited.** M7's PRE-PROD-only branches are **not** earned by dispatching it (§13).
- **`deploy-prod.yml`'s `derive` job** — it is **Story 6.5's seam** (*"`derive` is the seam… This story
  builds none of it"*). Adding a job after `deploy` does not touch it. **Keep it that way.**
  ✅ **Ordering settled by Oleg 2026-08-26 (Open Question 3): 6.6 lands FIRST; 6.5 has not landed and
  rebases onto this.** The two are textually disjoint — 6.5 at `derive`, 6.6 after `deploy` — and 6.6's
  entire exercise runs `rollback: true`, on which 6.5's guard is skipped **by its own AC**. So there is
  no interaction to manage, only a merge order, and it is this one. 🔴 **The obligation that creates:
  leave `derive` byte-identical.** A tidy-up there turns a clean rebase into a conflict in the one job
  6.6 has no business in.
- `deploy-preprod.yml`, `deploy-dev.yml`, `dev-reset.yml`, `ci.yml`, `build-main.yml`,
  `build-buildkit-cni-image.yml`; `Dockerfile*`, `vite.config.ts`, `nginx.conf`, `docker-compose*.yml`,
  `src/`; `docs/production-approval-regulation.md`, `docs/release-regulation.md`,
  `docs/release-validation-checklist.md`, `docs/preprod-candidates.md`; all of `.github/workflows/`.

**Hosts:** s10 is written **only** by `deploy-stand.yml` through the runner. No hand-run compose, no
manual `docker` on the stand. **s2 is not touched at all — NFR5 as amended is absolute.**

**Registry:** the only writes are `prod-<12hex>` and `prod-current` on `git.crm-prionex.com/crm/fe-prionex`.
🔴 `REGISTRY_TOKEN_RW` is **org-scope `write:package` over a namespace holding another team's production
packages.** Every write target is composed from the file's own literal `IMAGE_REPO`.

### 13. Boundaries — seven things this story must not absorb

1. **The promotion guard.** Story 6.5. `derive` is its seam; leave it alone.
2. **The smoke check.** Story 6.7. `deploy-stand.yml`'s health and Kong probes are **not** it, and §10's
   digest assertion is **not** it either — say so in the file.
3. **Rollback as a rehearsal with measured timing.** Story 6.8. §8's free dispatch is evidence 6.8 may
   reuse; **this story does not claim 6.8's ACs.**
4. **The cutover, and the traffic switch.** Story 6.9. The switch is external and gated by `#d46`'s new
   product-code AC (owner Oleg).
5. **Slack.** Story 4.5, deferred 2026-08-14, explicitly not gating.
6. **Fixing `record-preprod-candidate.yml`.** M7's bundle was re-owned here *"as the next story that must
   dispatch a recorder"* — but M7's list is literally about the **PRE-PROD** file. **Discharge only what
   this story's own dispatches actually force** (G3's exactly-12 clause, the ambiguous-read branch, the
   read-back-mismatch branch, G6's parse branch — all on `record-prod-image.yml`), and **re-own the
   PRE-PROD-only remainder by name.** Do not claim a branch was exercised in a file you never ran.
7. **The retention observation** (2026-08-29). Owner **Story 6.3**, by Oleg's own reassignment. Cite it;
   do not adopt it, and do not let it silently become nobody's.

### Prohibitions

🚨 **A prohibition here cannot be overridden by a subtask.**

1. **Never rename `deploy-prod.yml`'s `tag` dispatch input**, and never add `image_tag`,
   `acknowledgement` or `allow_current_move` to its dispatch block (§4).
2. **Never let `record` run when `deploy` did not succeed.** `always()` without an explicit
   success test is the failure `deploy-prod.yml`'s own header names (§6).
3. **Never write `prod-current` before `prod-<12hex>`.** History first, pointer second — 5.4 §6, copied
   into 6.3, proven live by timestamps (11:17:09Z / 11:17:10Z).
4. **Never drop `--prefer-index=false`** from an `imagetools create`.
5. **Never report a write as successful without reading the tag back**, and never treat a read-back
   failure as a write failure without saying which one it was (finding #10).
6. 🔴 **AMENDED 2026-08-26 — the move is AUTHORISED (Oleg, verbatim: *"move ok"*).** What replaces the
   old prohibition is where the pointer must **end**: **this story may not close, and no AC may be
   graded, with `prod-current` naming anything other than `sha-a99ccd44c5a3-prod`.** §8's exercise is
   there-and-back, not a handover. 🔴 **If the return dispatch (§8, 3) fails, the row goes/stays
   `in-progress` with the blocking condition named** — the enum has no `blocked` value and this project
   does not close over a wrong pointer.
7. **Never delete or repoint an existing `prod-<12hex>`.** Removing one needs an authorised `DELETE`
   with a `write:package` token, which on this project has twice required the operator in person.
8. **Never claim a guard was observed refusing without a run id.** A matrix row without one is `OPEN`.
   Story 6.3's AC6 is the precedent this story exists to stop repeating.
9. **Never present a comparison that cannot fail as evidence.** A `prod` and a `preprod` build differ in
   build args **and** in `org.prionex.environment`, so their digests could never be equal. **This
   project has now caught that shape five times.**
10. **Every input reaches a `run:` body through `env:`, never through a `${{ }}` expression** (`#d21`).
11. **Do not edit a frozen file** (§12). If one appears to need a change, that is a finding for
    `deferred-work.md` with an owner.
12. **Do not read GitHub** (`#d7`), and **do not touch s2** (NFR5).
13. **Never present `prod-308ea1520c59` as a release.** It is a proof marker minted by §8's exercise. It
    gets **no row in `docs/prod-releases.md`** — no release was approved — and it is named as a proof in
    the decision record, the same sentence Story 6.4 had to write for its two proof images.
14. **Never leave the residue implicit.** A later reader who lists `prod-*` and finds four markers must be
    able to tell which is a release **from a document this repository holds**, not from memory.

---

## Acceptance Criteria

### AC1 — The recording step runs on a successful production deploy *(epic AC1)*

**Given** `deploy-prod.yml` has completed a deploy successfully
**When** the recording step runs
**Then** it retags the deployed image as `prod-current` **and** `prod-<12hex>` using
`docker buildx imagetools create --prefer-index=false`
**And** it runs on **both** the release and the rollback path
**And** it does **not** run when the deploy job did not succeed
**And** the write order is `prod-<12hex>` first, `prod-current` second, each verified by read-back.

### AC2 — A subsequent deploy moves the pointer and keeps the history *(epic AC2)*

**Given** a subsequent production deploy
**When** the recording step runs again
**Then** `prod-current` moves to the new image
**And** the previous image remains addressable by its own `prod-<12hex>` tag as a rollback target
**And** on a move, the **displaced digest and the tag it belonged to** are recorded (§7), not left in a
log this project classifies best-effort
**And** the `allow_current_move` policy difference between the dispatch path and the call path is
written into the file with its reason (§5)
**And** 🔴 **the move is proven LIVE, with run ids, in both directions** (§8 dispatches 2 and 3;
authorised by Oleg 2026-08-26, *"move ok"*) — **not** graded on code review, and **not** left to Story
6.9
**And** the story does not close with `prod-current` naming anything other than `sha-a99ccd44c5a3-prod`
(Prohibition 6 as amended).

### AC3 — Retention protection, stated at the strength it actually has *(epic AC3)*

**Given** the retention policy from Story 1.11
**When** the marker names are checked
**Then** `prod-current` and every `prod-<12hex>` **compile** against the stored `keep_pattern`
**And** the claim is recorded as **COMPILED, not observed** — `#d38` §9: the rule has never been seen
deleting anything, therefore never seen keeping anything
**And** the open observation (owner **Story 6.3**, first observable 2026-08-29) is cited, not adopted
and not silently re-owned.

### AC4 — The release history is reconstructable from the registry *(epic AC4)*

**Given** the registry after several releases
**When** it is inspected
**Then** the production release history is reconstructable **without connecting to the production host**
**And** the listing step is a **guard-grade** read, not a step that goes green on a 401 or a transport
failure and not one that silently truncates on pagination (finding #12)
**And** ✅ **AC wording amended 2026-08-26, confirmed by Oleg (Open Question 5):** the epic says *"without connecting to s2"*. s2 is the
**legacy** host; the Forgejo production stand is s10 (`sprint-change-proposal-2026-08-18-prod-target.md`).
Read as *"without connecting to the production host"* — the epic's intent, in the epic's own amended
topology
**And** 🔴 **the registry alone is NOT sufficient, and this story is what makes that concrete.** After
§8's authorised move exercise the registry holds `prod-308ea1520c59` — a `prod-<12hex>` marker for a
commit that **was never a release**. Nothing in the tag distinguishes it from one. **The discriminator is
`docs/prod-releases.md`**, exactly the three-tier model `#d38` §D1 states: the registry carries identity
and permanence, the file in this repository is the authoritative human-readable record. **Write this into
the decision record and into the workflow's own disclaimer step.** Do not let AC4 be graded as *"the
registry is the history"* — after this story it demonstrably is not.

### AC5 — 🔴 ADDED: the thirteen inherited findings are each fixed, or deferred with a named owner

**Given** `deferred-work.md`'s *"In shipped code — `record-prod-image.yml`. Owner: Story 6.6"* list
**When** this story closes
**Then** every one of the thirteen has a disposition — **fixed** (with the change visible in the diff)
or **deferred** (with a named owner and a removal trigger, in `deferred-work.md`, not only in this file)
**And** findings **1** and **2** are **fixed**, not deferred — they are the two that arm on this
story's own first automatic write.

### AC6 — 🔴 ADDED: the outcome matrix ships with real run ids

**Given** retro-E5, and Story 6.3's AC6 recorded UNMET
**When** this story closes
**Then** §9's matrix carries a **run id** in every row it claims
**And** every unearned row is **labelled with its reason** — never left blank, never graded met
**And** the free discriminating rows (G1, G2, G3, the 404 classifier) are **earned**, because they cost
nothing but a dispatch that writes nothing.

### AC7 — 🔴 ADDED: the `prod_tag` settlement is recorded where the ledger points

**Given** `docs/prod-releases.md`'s `prod_tag` column defers the question to *"Story 6.4/6.6"*
**When** this story closes
**Then** the settlement — **`sha-<12hex>-prod`** — is written into that column as a dated amendment
**And** the three-form table (§7) appears in the decision record
**And** **no ledger row is added, edited or removed.**

### AC8 — 🔴 ADDED: the stale claims in the inherited file are corrected

**Given** `record-prod-image.yml`'s header was written before s10 existed and before `#d46`
**When** this story closes
**Then** the *"THERE IS NO PROD STAND"* G5 justification is corrected against the live stand (§10)
**And** the `image_tag` example naming the superseded commit `41ab0470ab6b` is replaced (finding #8)
**And** the *"goes red"* over-claim (finding #9) is stated at the strength its own quoted table supports
**And** the *"SHIPPED WITH ITS REFUSAL PATHS UNOBSERVED"* block is updated to whatever is true after
AC6 — **including if the answer is "still unobserved for rows X and Y."**

### AC9 — 🔴 ADDED: the decision record

**Given** this project's convention that a decision is recorded before it is relied on
**When** this story closes
**Then** `docs/migration-decisions.md` carries a record covering: the join shape (§3) and why A over B/C;
the G1 / `allow_current_move` policy split (§5); the `prod_tag` settlement (§7); the G5 re-opening (§10);
and the matrix outcome
**And** the number is **re-verified at execution time across every `origin/*` ref AND against local,
unpushed branches** — 🔴 Story 6.3's Open Question 10 found a full `## D43` on an unpushed local branch
that the ref sweep could not see; **the process half of that hole is OPEN and unowned by any fix.**
Next apparently free number on `origin/main` @ `584cc886` is **D48** (`D44` is held by
`story-4-10/pr-1-context`; `D45` was cancelled with Story 6.3's Task 6 and its number was never used).

---

## Tasks / Subtasks

### Task 1 — Open the story (AC: —) — **1 push row**

- [ ] 1.1 Branch `story-6-6/pr-1-context` off `origin/main`. **Re-fetch first**: `origin/main` moved
      three times during this story's own contexting (`cfbad179` → `308ea152` → `584cc886`). Confirm
      `deploy-prod.yml` is present before assuming §3.
- [ ] 1.2 Flip `sprint-status.yaml` `6-6-…` → `in-progress` in its **own commit** (Task 1.1's lesson,
      Story 6.2).
- [ ] 1.3 Re-verify the D-number (AC9) across `git ls-remote origin` **and** every local branch —
      `git branch --all`, not just `origin/*`. Record the sweep.
- [ ] 1.4 Confirm Story 6.4's row: it says `review` but PR #97 is merged. **Ask, do not edit another
      story's row.**

### Task 2 — Read the contract, do not infer it (AC: 1, 5) — **0 runs**

- [ ] 2.1 Read `record-prod-image.yml` end to end (41 KB, one job, 17 steps -- run 600 reported 17/17).
- [ ] 2.2 Read `### Review Findings` in `6-3-…md` — **the full text of all thirteen**, with locations.
- [ ] 2.3 Read `record-preprod-candidate.yml`'s probe steps: the **four** `Accept` media types
      (finding #1), the empty-credential pre-check and the 401 classification (finding #13). **Copy the
      pattern; the file is frozen.**
- [ ] 2.4 Read `deploy-prod.yml`'s `deploy` job's `if:` and its header's `always()` paragraph (§6).
- [ ] 2.5 Measure the registry: every `prod-*` and `sha-*-prod` tag with its digest. **Paste it.** §8's
      table is from the record, not from a live read — confirm it.

### Task 3 — Fix the thirteen (AC: 5) — **0 runs**

- [ ] 3.1 🔴 **Finding #1** — four `Accept` media types on **all** probes; empty-credential pre-check;
      401 classified separately from the catch-all (#13).
- [ ] 3.2 🔴 **Finding #2** — G6 inspects `${IMAGE}@${CANDIDATE_DIGEST}`, not `$SHA_TAG`.
- [ ] 3.3 #3 `if: always()` on the listing and the disclaimer. #10 read-back retry, with the false-negative
      case named in its own message. #11 `defaults.run.shell: bash`.
- [ ] 3.4 #6 `--proto-redir '=https'`. #5 G4's `-i` — either drop it or justify it **in the accept
      direction**; do not leave `build.yml`'s reject-direction justification transplanted.
- [ ] 3.5 #4 disclose the check-to-write window. #7 disclose the write-target step's unreachability.
      #12 the listing becomes guard-grade: classify the status, handle `Link`-header pagination, fail on
      an unreadable read rather than WARN green.
- [ ] 3.6 #8, #9 — see AC8.
- [ ] 3.7 Anything deferred: `deferred-work.md`, **named owner + removal trigger**, and say so in the
      story. **1 and 2 may not be deferred.**

### Task 4 — Wire the join (AC: 1, 2, 5) — **0 runs**

- [ ] 4.1 Add `on.workflow_call` to `record-prod-image.yml`: `image_tag` required; **no**
      `acknowledgement`; `allow_current_move` **defaulting true on this path only**. Keep the whole
      `workflow_dispatch` block unchanged in its own defaults (§5).
- [ ] 4.2 Gate G1 on the event. **Write the sentence** explaining why the call path is authorised by the
      deploy rather than by a literal (§5).
- [ ] 4.3 Add `record:` to `deploy-prod.yml`: `needs: [derive, deploy]`,
      `if: needs.deploy.result == 'success'`, `uses: ./.forgejo/workflows/record-prod-image.yml`,
      `with: image_tag: ${{ needs.derive.outputs.deploy_tag }}`, `secrets: inherit`.
      🔴 **Verify by observation that `with:` reaches the callee** — `#d47`(3) is five days old.
- [ ] 4.4 On a move, emit the displaced digest and its tag as a job output **and** to the step summary
      (§7, AC2).
- [ ] 4.5 §10: correct the G5 justification; implement the **digest half** — `prod-current`'s new target
      must equal `derive.outputs.deploy_tag`'s resolved digest — and record the health half as
      deliberately not built.
- [ ] 4.6 Header work in **both** files, at the house ratio (§11). `deploy-prod.yml` gets the
      *"Not here, deliberately"* list updated: 6.6 leaves it.
- [ ] 4.7 Mechanical checks before any dispatch: `bash -n` on every `run:` body; **zero `${{ }}` inside a
      `run:`** (Prohibition 10); `deploy-stand.yml`, `build.yml`, `record-preprod-candidate.yml`
      byte-identical to `origin/main`.

### Task 5 — 🔴 The free live proof (AC: 1, 6) — **1 dispatch**

- [ ] 5.1 Dispatch `deploy-prod.yml`: `tag: sha-a99ccd44c5a3-prod`, `rollback: true`. This redeploys what
      s10 already runs and **must leave the registry unchanged**.
- [ ] 5.2 Expected: `build` skipped; `deploy` green; `record` green; `write-history` **noop**;
      `write-current` **noop**. **Paste the step table and the run id.**
- [ ] 5.3 Read all three tags back **independently of the run** and confirm one manifest, unchanged
      digest `sha256:f30c794123ba…a3f3`.
- [ ] 5.4 🔴 If `record` is skipped while the run is green, **stop** — that is Prohibition 2's failure and
      it is the one this story exists to avoid.

### Task 6 — The free discriminating dispatches (AC: 6) — **up to 4 dispatches, all writing nothing**

- [ ] 6.1 G1: dispatch `record-prod-image.yml` with a wrong acknowledgement. Expect a refusal **before any
      network call**.
- [ ] 6.2 G2: `sha-a99ccd44c5a3-preprod` (exists). Expect the explicit `-preprod` arm.
- [ ] 6.3 G3: a 40-hex `sha-<40hex>-prod`. Expect the exactly-12 message. **This also closes M7's own G3
      clause** for this file (§13.6).
- [ ] 6.4 404 classifier: a well-formed `sha-<12hex>-prod` that does not exist. Expect **classified
      absence**, not an ambiguous read.
- [ ] 6.5 G4 and G6: record **UNEARNED with the reason** (§9) — ✅ **decided 2026-08-26, both rows.**
      G4 is unreachable through this file's own inputs; G6 needs an artifact `build.yml` cannot produce.
      🔴 **Do not force-test either into looking earned.** Story 6.3's local 15/15 shell exercise is the
      precedent for what that reads like afterwards: it verifies shell logic, carries no run id, and its
      own story had to record that it is **not** a substitute. A labelled UNEARNED row is worth more than
      a row with a footnote. (The `prod-current` MOVE row is **not** here — it is Task 7, because it is
      neither free nor write-less.)

### Task 7 — 🔴 The move, there and back (AC: 2, 6) — **2 dispatches, and they are NOT free**

**Authorised by Oleg 2026-08-26, verbatim: *"move ok"*.** §8 has the table, the reason the price is low,
and the residue this creates. **Run Task 5 first** — a move exercise on wiring that has never taken its
no-op branch is two unknowns at once.

- [ ] 7.1 🔴 **Pre-flight, before dispatching anything.** Read all four names back independently and
      paste them: `sha-a99ccd44c5a3-prod`, `prod-a99ccd44c5a3`, `prod-current`, `sha-308ea1520c59-prod`.
      Confirm `prod-current` is still on `sha256:f30c794123ba…a3f3`. **If it is not, STOP** — something
      outside this story wrote the production pointer, and finding #4's check-to-write window is exactly
      the disclosure saying nothing here can serialize against that.
- [ ] 7.2 **Dispatch 2** (§8): `tag: sha-308ea1520c59-prod`, `rollback: true`. Expect `build` skipped,
      `deploy` green, `record` green, `write-history` **created**, `write-current` **moved**.
      🔴 **The displaced digest must appear in the step summary and as a job output** — that is AC2's new
      clause and §7's settlement of the triage item, and this dispatch is the only chance to observe it.
      **Paste the run id and the step table.**
- [ ] 7.3 Read back independently: `prod-308ea1520c59` and `prod-current` both on
      `sha-308ea1520c59-prod`'s manifest; `prod-a99ccd44c5a3` **unchanged**. **History does not move when
      the pointer does** — that is the property, and this is where it is observed.
- [ ] 7.4 **Dispatch 3** (§8): `tag: sha-a99ccd44c5a3-prod`, `rollback: true`. Expect `write-history`
      **noop**, `write-current` **moved** — the second move, in the opposite direction.
- [ ] 7.5 🔴 **Close the loop and prove it, do not assert it.** Read all five names back independently:
      `prod-current` **must** be on `sha256:f30c794123ba…a3f3` again. Paste it. **If it is not, the row
      stays `in-progress` with the blocking condition named** (Prohibition 6).
- [ ] 7.6 Record the residue: `prod-308ea1520c59` is permanent and is a **PROOF, NOT A RELEASE** —
      decision record + the workflow's disclaimer step, no ledger row (Prohibitions 13/14, AC4).

### Task 8 — Record (AC: 3, 4, 7, 8, 9) — **0 runs**

- [ ] 8.1 `docs/prod-releases.md`: the `prod_tag` column amendment, dated. **No row touched.**
- [ ] 8.2 `docs/migration-decisions.md`: the decision record (AC9), number re-verified per Task 1.3.
- [ ] 8.3 `deferred-work.md`: the thirteen findings' dispositions; M7's PRE-PROD-only remainder re-owned
      **by name**; the retention item left with **Story 6.3**.
- [ ] 8.4 AC3's protection claim written as **compiled, not observed**, with `#d38` §9 cited.

### Task 9 — Close (AC: all) — **1 push + PR + merge rows**

- [ ] 9.1 Grade every AC against **pasted evidence**, not intention. An AC whose final clause was not
      performed is **not met** — Story 6.3's review caught three of exactly that shape.
- [ ] 9.2 🔴 **Re-review the fix-pass.** *"A fix-pass that is not itself re-reviewed is just a second
      draft"* — 6.2 recorded it, 6.3 reproduced it, and it is now Epic 6 retrospective material. **Do not
      make it three.** Check that the title, the Status header and §1 still describe what shipped.
- [ ] 9.3 Close the run ledger **by query** (retro-D4): `action_run` grouped by `run_number`, attributed
      by `commit_sha`. 🔴 **Dispatch runs carry the DISPATCH REF as `commit_sha`, not what they built** —
      name such rows separately or lose the story's most consequential run.
- [ ] 9.4 `sprint-status.yaml` → `review`. **Oleg merges; the row goes `done` only after that.**

---

## Run budget model — declared before work

| Line | Floor | Ceiling |
|---|---|---|
| Context push (this file) | 1 | 1 |
| dev-story pushes | 2 | 4 |
| PR rows (`pull_request`) | 2 | 2 |
| Merge row (`build-main.yml`) | 1 | 1 |
| **Task 5 — the free rollback dispatch** | **1** | **2** |
| **Task 6 — discriminating dispatches** (write nothing) | **4** | **5** |
| 🔴 **Task 7 — the move** (`sha-308ea1520c59-prod`) | **1** | **2** |
| 🔴 **Task 7 — the return** (`sha-a99ccd44c5a3-prod`) | **1** | **2** |
| Review fix-pass push | 0 | 2 |
| Closeout PR | 0 | 3 |
| **Total** | **13** | **24** |

🔴 **Ceiling raised 20 → 24 on 2026-08-26, with its own reason rather than silently:** Open Question 1
was answered *"move ok"*, converting a matrix row that would have shipped UNEARNED into **two real
dispatches** (§8, Task 7). Floor 11 → 13. This is the raise-with-a-recorded-reason discipline Story 6.2
applied three times to its own AC8 ceiling.

🔴 **Story 6.2 declared 8 and measured 10**, overrunning because it budgeted *"dev-story = 1 push"* and
carried no line for a decision commit or an integration merge. **Both are budgeted above.** An overrun is
**named, never absorbed by relabelling a row "adjacent"**.

---

## Dev Notes

### 1. The one-paragraph version

Add a fourth job to `deploy-prod.yml` that calls `record-prod-image.yml`, fix the thirteen findings that
arm when it does, split the two human-shaped inputs so the automatic path is honest, settle `prod_tag`,
and earn the outcome matrix Story 6.3 could not. **Write no new registry mechanism.**

### 2. Infrastructure facts, in one place

| Fact | Value |
|---|---|
| Registry | `git.crm-prionex.com/crm/fe-prionex` |
| `keep_pattern` (lives **only** in the Forgejo DB, `package_cleanup_rule` id 1) | `^(prod-current\|preprod-current\|latest\|buildcache\|v?[0-9]+\.[0-9]+\.[0-9]+.*\|(pre)?prod-[0-9a-f]{7,64}\|sha-[0-9a-f]{7,64}-(pre)?prod)$` |
| Short SHA | **exactly 12** — `#d18` §3 binds 5.4, 6.3, 6.5, **6.6** |
| Cutover image | `sha-a99ccd44c5a3-prod` @ `sha256:f30c794123ba…a3f3` |
| PROD stand | s10, `fe-prionex-prod`, `0.0.0.0:8080`, `crm-prod-network` |
| PROD deploy runner label | `fe-prionex-prod-deploy` — **never** `s10`/`e1-rung3` (dind) or `e1-rung3-prod-deploy` (`:host`, another team's) |
| Recorder runner | `node-20`. **Not `docker-build`** — no Node runtime, so no `uses:` step runs (Story 1.8 Trap 1) |
| buildx | v0.33.0 — **`--annotation` is rejected outright** on a plain `imagetools create` |
| PROD public name | `crm.prod.crm-prionex.online` → 62.112.10.55, **resolves and refuses** (`#d43`). 🔴 **Never derive the API name from it.** Nothing here depends on it. |

### 3. Anti-patterns for this story

- **Rewriting the retag logic** because it is easier to read your own. It is proven live once and
  reviewed by three adversarial layers. **Fix it; do not replace it.**
- **Deferring finding #1 or #2** because *"nothing has broken yet"*. Nothing has dispatched the file yet.
- **Grading AC6 on the local 15/15 shell exercise.** That verifies shell logic. It carries no run id, and
  Story 6.3 already recorded it as **not** a substitute.
- **Moving `prod-current` to earn a row.** Prohibition 6.
- **Presenting a comparison that cannot fail.** Prohibition 9 — five prior instances.
- **Softening an unmet AC into "partially met".** Story 6.3 shipped four UNMET and said so.

### 4. The autonomous decisions in this story, for a one-read veto

| # | Decision | If vetoed |
|---|---|---|
| 1 | Option **A** — `workflow_call` on the existing recorder (§3) | Inline into `deploy-prod.yml` (B) and accept two implementations, recorded |
| 2 | `allow_current_move` defaults **true** on the call path, **false** on dispatch (§5) | A deploy that cannot record itself; `prod-current` names the previous release. Name that cost |
| 3 | G1 kept but gated on the event (§5) | Delete it, or pass a constant and stop calling it a guard |
| 4 | `record` runs on **both** paths (§6) | Story 6.8's own AC has no mechanism |
| 5 | `prod_tag` = `sha-<12hex>-prod` (§7) | Reopen the column; name who settles it instead |
| 6 | G5's **digest half** only (§10) | Full G5 with a host job, or no G5 and a corrected justification |

✅ **Rows 2 and 3 are no longer autonomous either — Oleg ratified both on 2026-08-26** (Open Question 2:
the deploy is the authorisation, nothing further gates the call path). The veto column stays for the
record; it is spent.

🔴 **Not in this table, because it is not autonomous: the `prod-current` move.** It was Open Question 1
and Oleg answered *"move ok"* on 2026-08-26. §8 and Task 7 execute that answer; they do not re-decide it
and they do not widen it — the authorisation is for a **there-and-back exercise**, not for leaving the
pointer anywhere else.

### Project Structure Notes

`deploy-prod.yml` gains one job and header lines; its `derive` job is **Story 6.5's seam and stays
untouched**. `record-prod-image.yml` gains a `workflow_call` block and keeps its `workflow_dispatch` half
for recovery. No new workflow file is created — the census goes 13 → 13.

### References

- `_bmad-output/planning-artifacts/epics.md` — Story 6.6 ACs; FR18, FR31, FR32; Epic 6 preamble
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-26-cutover-candidate.md` — §2.5 states
  Story 6.6 takes **no AC change** from `#d46`, and that the recorder is commit-agnostic
- `_bmad-output/implementation-artifacts/deferred-work.md` — *"Carried from: Story 6.3"* (the thirteen);
  the displaced-pointer item; the M7 bundle; the retention item
- `_bmad-output/implementation-artifacts/6-3-…md` — `### Review Findings` (full text), §6, §7(d)
- `_bmad-output/implementation-artifacts/6-4-…md` — §2, §9, §12; the `#d47` findings
- `docs/migration-decisions.md` — `#d18` §3, `#d21`, `#d24` §2b, `#d38` §9/§D1, `#d43`, `#d46`, `#d47`
- `docs/prod-releases.md` — the `prod_tag` column; the append-only rule
- `docs/production-approval-regulation.md` — the rollback rule keys on the ledger's `prod_tag`
- `.forgejo/workflows/record-prod-image.yml`, `deploy-prod.yml`, `record-preprod-candidate.yml`

---

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

### Review Findings

---

## Open Questions for Review

1. ✅ **RESOLVED 2026-08-26 — Oleg, verbatim: *"move ok"*. Option (b) is taken.** Executed as a
   **there-and-back** exercise: §8's table, Task 7's six subtasks, Prohibition 6 as amended (the pointer
   must END on `sha-a99ccd44c5a3-prod`), Prohibitions 13/14 (the `prod-308ea1520c59` residue is a proof,
   never a release), and AC4's new clause (the registry alone stops being sufficient the moment that
   marker exists). Ceiling raised 20 → 24 with that reason recorded. 🔴 **The recommendation below was
   (a) and was NOT taken** — kept and superseded, not rewritten, so the decision stays legible against
   what was actually put to him. *The question as asked:*

   🔴 **GATES Task 6.5 and AC2's move clause. Does this story spend anything to observe a real
   `prod-current` MOVE?** Today the pointer names the cutover image and Story 6.4's handover says it
   *"must keep naming it"*. Options: **(a)** do not move it — AC2's move clause is graded on code review
   plus the no-op run, and recorded UNEARNED with the reason, leaving Story 6.9's cutover as its first
   live move; **(b)** move it to `sha-308ea1520c59-prod` (an existing proof tag) and back — two moves,
   one new permanent `prod-308ea1520c59`, and `prod-current` names a non-release in between;
   **(c)** wait for the next validated candidate. **Recommendation: (a)** — 6.9's release-deploy leg has
   never been green and is already the epic's riskiest run; adding pointer churn ahead of it buys a
   matrix row at the cost of the thing the row is about. **Oleg decides.**
2. ✅ **RESOLVED 2026-08-26 — Oleg: the deploy IS the authorisation. `record` runs unconditionally on a
   green deploy, nothing further gates the call path.** The declined alternative — gate `record` on a
   matching `docs/prod-releases.md` row — is recorded in §5 with its three grounds, the sharpest being
   that it would have refused §8's own move exercise. *The question as asked:*

   **Is the whole `record` job acceptable as an unconditional consequence of a green deploy, with no
   human confirmation anywhere on the call path?** §5 argues the deploy *is* the authorisation. The
   counter-case: `docs/production-approval-regulation.md` puts the approval **before** the dispatch, so
   by then it has already happened. Recorded because the regulation is Oleg's document.
3. ✅ **RESOLVED 2026-08-26 — Oleg: 6.6 lands FIRST, 6.5 rebases onto it.** The assumption this story
   was written under is now the decision. **Its obligation: leave `derive` byte-identical** (§12). *The
   question as asked:*

   **Does Story 6.5 land before or after this story?** Both edit `deploy-prod.yml` — 6.5 at `derive`,
   6.6 after `deploy`. They do not overlap textually, but a merge order still exists. 6.5 is `backlog`;
   this story assumes it has not landed.
4. ✅ **RESOLVED 2026-08-26 — Oleg: record UNEARNED with the reason.** No force-test, no hand-crafted
   artifact. **The rejected option is worth remembering: pushing a mislabelled `sha-<12hex>-prod` would
   mint a permanent junk tag** — `keep_pattern` protects it by shape and only an authorised `DELETE`
   removes it — **in a namespace holding another team's production packages.** *The question as asked:*

   **G6's discriminating row (§9) needs a `-prod`-shaped tag whose `org.prionex.environment` is not
   `prod`.** No such artifact exists and `build.yml` cannot produce one. Force-test, record unearned, or
   spend a hand-crafted push? **Recommendation: record unearned with that sentence.**
5. ✅ **RESOLVED 2026-08-26 — Oleg confirmed the amendment: read as *"without connecting to the
   production host"*.** Kept literal, the AC would be satisfied by construction — NFR5 already forbids
   touching s2 — and would check nothing. That is the vacuous-check class this project has now caught
   five times (Prohibition 9). *The question as asked:*

   **AC4's amended wording (§AC4).** The epic says *"without connecting to s2"*; s2 is legacy and NFR5
   forbids touching it at all. Confirm the amendment rather than let a later reader find the story
   graded an AC it quietly rewrote.

---

🔴 **All five Open Questions are answered. Nothing gates the dev session.** Anything new belongs in the
Dev Agent Record, not here.

---

## Change Log

| Date | Version | Description | Author |
|---|---|---|---|
| 2026-08-26 | 0.3 | ✅ **Open Questions 2–5 answered by Oleg, all as recommended; the story now has NO open gate.** (2) The deploy is the authorisation — `record` runs unconditionally on a green deploy, and the declined alternative (gate it on a `docs/prod-releases.md` row) is recorded in §5 with its three grounds, the sharpest being that it would have **refused §8's own move exercise**. (3) **6.6 lands first, 6.5 rebases onto it** — the two are textually disjoint and 6.6's whole exercise runs `rollback: true`, on which 6.5's guard is skipped by its own AC; the obligation that creates is **leave `derive` byte-identical**, now stated in §12. (4) G6's discriminating row is **UNEARNED with its reason**, no force-test and no hand-crafted artifact — the rejected option would have minted a permanent junk `sha-<12hex>-prod` in a namespace holding another team's production packages. (5) AC4's amendment confirmed: *"without connecting to the production host"* — kept literal it would be satisfied by construction and check nothing, the vacuous-check class Prohibition 9 names. §4's veto rows 2 and 3 marked spent. | create-story context engine (Opus) |
| 2026-08-26 | 0.2 | 🔴 **Open Question 1 answered by Oleg — *"move ok"* — and applied rather than absorbed.** The `prod-current` MOVE goes from a row that would have shipped UNEARNED to **two live dispatches in opposite directions** (§8's table, new Task 7). Applied to: §8 (the hazard becomes a bounded exercise, with the zero-user-blast-radius reason stated so it is not re-litigated after the traffic switch, when it stops being true); §9's matrix (one row → two); AC2 (the move must carry run ids, and the story may not close with the pointer elsewhere); **AC4 — the consequence the answer creates: `prod-308ea1520c59` is minted permanently, a `prod-<12hex>` marker for a commit that was never a release, so the registry alone stops being a sufficient release history and `docs/prod-releases.md` becomes the discriminator**; Prohibition 6 amended from "never move" to "must END on the cutover image, and a failed return is `in-progress`, not `done`"; Prohibitions 13/14 added for the residue; ceiling 20 → 24 with its own recorded reason. The rejected alternative (dispatch the recorder directly, touch no stand) is recorded — it would prove the recorder's branch, not the automatic path AC2 is about. | create-story context engine (Opus) |
| 2026-08-26 | 0.1 | Context created from a scratchpad worktree off `origin/main` @ `584cc886`, branch `story-6-6/pr-1-context`. 🔴 `origin/main` moved **three times** during contexting (`cfbad179` → `308ea152` → `584cc886`): Stories 6.3 and 6.10 closed `done`, and Story 6.4 shipped `deploy-prod.yml` and reached `review` — so this story's two dependencies both landed mid-analysis and the first draft of §3 was written against a repository that no longer existed. Four epic ACs carried (AC4 amended for the s10 re-target), five added. Thirteen inherited code findings enumerated with dispositions required by AC5. Five Open Questions, one gating. | create-story context engine (Opus) |
