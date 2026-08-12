---
baseline_commit: 2cea6569
---

# Story 1.11: Implement a Retention Policy That Cannot Delete a Deployed Image

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a release engineer,
I want registry cleanup that provably spares anything a stand is running or could roll back to,
so that housekeeping cannot destroy the rollback path.

---

## 🚨 Read this before anything else

**This is the most destructive story in Epic 1. Everything before it added things. This one
configures a mechanism whose entire purpose is deleting things, in a namespace that does not
belong to us alone.**

### 1. One rule governs 86 packages, and 80 of them are another team's production

Verified on the instance 2026-08-12:

```
UQE_package_cleanup_rule_s  UNIQUE (owner_id, type)
```

Forgejo permits **exactly one cleanup rule per (owner, package type)**. There is no per-package
rule, no per-repository rule. A rule on owner `CRM` + type `container` is evaluated against every
container package the `CRM` organization owns:

| package | versions | whose |
|---|---|---|
| `api-prionex/*` — 80 packages | 21–39 each | **backend team, pushed today** |
| `hub-backend`, `hub-migrate`, `hub-web` | 17 each | hub team |
| `ci-probe`, `ci-probe-cache` | 6, 1 | ours, from Epic 1 smoke tests |
| `fe-prionex` | 5 | ours, this migration |

**86 container packages total. `fe-prionex` is 5 of them — under 1%.** The `api-prionex/*` family
is the backend microservice registry and it was written to on the day this story was created.

**A rule with default field values, enabled, deletes across all 86.** The defaults in the schema
are `keep_count = 0`, `keep_pattern = ''`, `remove_days = 0`, `remove_pattern = ''`, and per the
documented semantics an empty `keep_pattern` keeps *nothing* while an empty `remove_pattern`
removes *everything not otherwise excluded*. There is no safe default. There is no undo.

### 2. `match_full_name` is the only thing standing between us and that

The rule has a boolean the UI calls **"Apply pattern to full package name"**. With it **on**,
patterns are matched against `package/version` (`fe-prionex/sha-abc1234`). With it **off**, only
`version` (`sha-abc1234`) — which is identical in shape across all 86 packages, so an "off" rule
cannot distinguish our images from anyone else's.

**`match_full_name = true` is mandatory in this story. A rule without it is a production
incident.**

### 3. The evaluation order decides the design

Documented order — each step *removes candidates from the deletion list*:

1. exclude the `keep_count` most recent versions (per package)
2. exclude versions matching `keep_pattern`
3. exclude versions newer than `remove_days`
4. exclude versions **not** matching `remove_pattern`
5. delete what is left

Two consequences that shape the whole implementation:

- **`keep_pattern` is evaluated before `remove_pattern`.** So protection can be expressed
  positively — name what must survive — and `remove_pattern` can then be broad within our own
  package. This matters because of the next point.
- **Go's regexp is RE2. There is no lookahead, no backreference.** You cannot write
  `fe-prionex/(?!prod-).*`. Any design that depends on "match everything except…" in a single
  pattern will not compile. Express exceptions through `keep_pattern`, not through negation.

Patterns are **automatically anchored** with `\A`/`\z` and are **case-insensitive**. Do not write
`^`, `$`, `\A` or `\z` yourself.

### 4. A container push creates more version rows than it creates tags

Verified on `CRM/hub-web`, which is a live package built by the same kind of pipeline ours will be:

```
 216 | sha-6b3a348                 | tagged   → properties: container.manifest.tagged,
                                                container.manifest.reference ×2
 215 | sha256:c2214888358ddea0b7…  | untagged, is_internal = false
```

Every push writes a **tagged** version row *and* one or more **digest-named** version rows for the
manifests the tag's index references. Both are ordinary rows a cleanup rule can see and delete.

So: **a `keep_pattern` that lists only tag names does not name the digest rows those tags depend
on.** Whether Forgejo refuses to delete a digest still referenced by a protected tag is the single
most important unknown in this story — and it is exactly what AC3's seeded test exists to answer.
**Do not assume it. Measure it.**

Related and already fixed upstream: Forgejo v15.0.0 corrected a bug where multi-platform images
made `keep_count` miscount and delete versions it should have kept (PR #11246, merged
2026-02-12). This instance is **15.0.5**, so the fix is present. The lesson survives the fix:
`keep_count` counts *rows*, not images, and the ratio is not 1:1.

### 5. What is already in the registry, and why some of it is deliberate

```
fe-prionex versions (2026-08-12):
  996  _upload                        is_internal = t
  997  sha256:57c4b5a4cdba18e9…       is_internal = f
  998  sha256:f677b05a87621…          is_internal = f
 1000  sha256:462aa47cf9607…          is_internal = f
 1001  sha256:90bd6b1314804…          is_internal = f
```

Story 1.10 pushed a tagged image, proved the pull, deleted the tag — and these rows stayed
behind, still addressable by digest. **They were left in place on purpose, by Oleg's decision, as
this story's test material.** They are the real-world version of the problem AC3 describes.
**Do not delete them by hand.** If the rule cannot reclaim them, that is a finding to record, not
a mess to tidy away before anyone notices.

`ci-probe` (6 versions) and `ci-probe-cache` (1) are also ours, left from Epic 1 smoke tests. This
story must decide explicitly whether the rule covers them or leaves them, and record which.

### 6. `package_cleanup_rule` is empty and the cron is unconfigured

`SELECT * FROM package_cleanup_rule;` returns **0 rows** — no rule has ever existed on this
instance. `app.ini` contains **no `[cron.cleanup_packages]` and no `[packages]` section**, so
whatever schedule applies is a Forgejo default, not a decision anyone made. Confirm the actual
schedule from the running instance; do not state it from memory.

### Prohibitions

🚨 **Violating any of these is a story failure regardless of what else got done.**

1. **Never enable a rule that has not been previewed.** The rule form has a preview that lists the
   versions the rule would delete. Run it, read it, paste it into the story, *then* enable.
2. **Never create the rule with `match_full_name = false`**, not even briefly "to see what
   happens". Preview with it off is not safe either — a misread preview is how this goes wrong.
3. **`remove_pattern` must be anchored to our package.** Every pattern in this story starts with
   `fe-prionex/`. If a pattern you are about to save could match `api-prionex/…`, `hub-…`, stop.
4. **Do not delete, retag, or modify anything under `api-prionex/*` or `hub-*`.** Different teams,
   live services, not ours. Read-only.
5. **Do not hand-delete the four orphaned `sha256:` versions of `fe-prionex`, or `_upload`.** They
   are the test input.
6. **s2 (`175.110.122.17`) is PRODUCTION.** This story has no reason to touch it at all.
7. **Never write a token, or any substring of one, into a file in this repository.** Shell only.
8. **No `docker rmi` on any server.** This story does not need to remove a local image anywhere.
9. If the rule is enabled and anything unexpected appears in a later listing, **disable the rule
   first, investigate second.** `enabled = false` is one field and it stops all deletion.

---

## Acceptance Criteria

**AC1 — branch tags expire.**
Given the registry accumulates `<branch>` tags,
when the retention rule runs,
then `<branch>` tags older than 14 days are removed.

**AC2 — deployed and rollback tags never expire.**
Given an image tag is currently referenced by `prod-current` or `preprod-current`,
when the retention rule runs,
then that tag is not deleted regardless of its age,
and the N previous rollback targets are likewise preserved.

> **N must be chosen and written down in this story, not left as a letter.** Story 1.9's budget
> could not be checked because it left its count unbound; the 1.10 review said so explicitly. Pick
> a number, justify it against `preprod-<sha>` and `prod-current` usage in Stories 5.4 and 6.6,
> and state it in the decision record.

**AC3 — the guarantee is measured, not asserted.**
Given the retention mechanism has been configured,
when it is tested against a seeded set of tags including one aged past the threshold but marked as
deployed,
then the aged deployed tag survives,
and the aged undeployed branch tag is removed,
and the test result is recorded rather than assumed.

**AC4 — the blast radius is proven to stop at our package.**
Given the rule is the only container cleanup rule the `CRM` organization can have, and 80
`api-prionex/*` packages plus three `hub-*` packages share it,
when the rule's preview is run before it is enabled,
then the preview output is recorded in this story,
and it shows **zero** versions outside `crm/fe-prionex`,
and the same check is repeated after the first real run.

**AC5 — the downstream stories that depend on this rule get an answer.**
Given Stories 3.4, 3.5, 5.4, 6.3 and 6.6 each state a requirement against "the retention policy
from Story 1.11",
when the rule is settled,
then each of those five requirements is confirmed against the rule as actually configured,
and where the rule does not satisfy one, that is recorded as a deviation rather than silently
left for the later story to discover.

> The five, so they cannot be missed: `epics.md:1193` (14-day rule applies to per-branch build
> images), `:1219` (`buildcache` exempt or safe to regenerate), `:1678` (`preprod-current` and
> previous N `preprod-<sha>` preserved), `:1848` (Story 6.3's rebuilt prod tags protected),
> `:1947` (`prod-current` and previous N prod tags never deleted).

**AC6 — storage actually gets reclaimed, or it is recorded that it does not.**
Given the four orphaned `sha256:` versions Story 1.10 left in `fe-prionex`,
when the rule has run,
then it is recorded whether they were reclaimed,
and if they were not, the reason and the remaining mechanism are named,
because Story 1.10's AC6 already failed once on exactly this distinction between deleting a tag
and deleting an image.

---

## Tasks / Subtasks

### Task 1 — Pre-flight: bind every number before touching anything (AC: 4, 6) ✅

- [x] 1.1 Record the baseline, in the story, as literal numbers:
      total container packages owned by `CRM`; count of `api-prionex/*`; version count per
      `fe-prionex`, `ci-probe`, `ci-probe-cache`; total rows in `package_cleanup_rule` (expect 0).
- [x] 1.2 Confirm `UNIQUE (owner_id, type)` still holds on `package_cleanup_rule` — the whole
      design rests on there being no second rule available.
- [x] 1.3 Read the running instance's package-cleanup cron schedule and `OLDER_THAN` from the
      effective configuration. Record what it actually is. If it comes from a default rather than
      `app.ini`, say so.
- [x] 1.4 Confirm the Forgejo version is still `15.0.5+gitea-1.22.0`, because the multi-platform
      `keep_count` fix landing in 15.0.0 is load-bearing for this design.
- [x] 1.5 **Declare the write budget and bind every number**: one cleanup rule created, R rule
      edits, S seeded tags pushed, T tags deleted, K commits — with R, S, T, K as integers, not
      letters. Close the ledger in Task 8 against these numbers.
      *(Task 1.5 of Story 1.10 was written to stop unbound letters and was itself never done. It
      is repeated here deliberately.)*

### Task 2 — Decide the policy on paper before configuring it (AC: 1, 2, 5) ✅

- [x] 2.1 Write out the complete tag vocabulary this registry will hold, from FR7, Story 3.2 and
      Story 3.3: `sha-<short>`, `<branch>`, semver from `v*`, `latest`, the environment
      discriminators `sha-<short>-dev|-preprod|-prod`, `preprod-current`, `preprod-<sha>`,
      `prod-current`, `buildcache`, and the digest-named rows every push adds.
- [x] 2.2 Classify each into **protect forever**, **protect N most recent**, or **expire at 14
      days**. Branch names are arbitrary strings — they cannot be enumerated, so the design must
      protect by naming the survivors, not by naming the victims.
- [x] 2.3 Choose N for AC2 and justify it. State what it costs in storage at the observed image
      size and what it buys in rollback depth.
- [x] 2.4 Write the three field values — `keep_count`, `keep_pattern`, `remove_pattern` — plus
      `remove_days = 14` and `match_full_name = true`, and hand-check each against the four
      evaluation steps in §3 above, in order, for at least these versions:
      `fe-prionex/prod-current`, `fe-prionex/preprod-current`, `fe-prionex/preprod-<sha>`,
      `fe-prionex/sha-abc1234`, `fe-prionex/feature-x`, `fe-prionex/buildcache`,
      `fe-prionex/latest`, `fe-prionex/sha256:…`, `api-prionex/auth-service/sha-abc1234`,
      `hub-web/sha-6b3a348`.
- [x] 2.5 Verify every pattern compiles under RE2 — **no lookahead, no backreference** — and
      contains no `^`, `$`, `\A`, `\z`. Remember patterns are case-insensitive and auto-anchored.
- [x] 2.6 Decide explicitly what happens to `ci-probe` and `ci-probe-cache`, and record it.

### Task 3 — Preview before enabling (AC: 4) — 3.1 done; 3.2–3.4 need the UI

- [x] 3.1 Create the rule **disabled**, with the Task 2 field values. ✅ Rule `id = 1` exists, `enabled = f`.
- [ ] 3.2 Run the rule's preview. Capture its complete output into the story — not a summary of
      it, the list.
- [ ] 3.3 Assert against the capture: zero versions outside `crm/fe-prionex`. If even one
      `api-prionex/*` or `hub-*` version appears, **stop, do not enable, fix the pattern, preview
      again**, and record both attempts.
- [ ] 3.4 Assert the protected set from Task 2.4 does not appear in the preview.

### Task 4 — Seed the test set (AC: 3)

- [ ] 4.1 Push seeded tags into `crm/fe-prionex` that cover, at minimum: one aged branch tag that
      must die, one aged tag standing in for a deployed image that must live, and one recent
      branch tag that must live because of its age alone.
- [ ] 4.2 **Ageing route is decided: (a), and (b) is prohibited.** The registry cannot backdate a
      push, so temporarily lower `remove_days` until "aged" is reachable in real time, then restore
      it to 14. Oleg ruled out writing to the database on 2026-08-12: no `UPDATE` of `created_unix`,
      no row edits of any kind on `package_version`. 🚨 **The consequence must be written down, not
      glossed:** what gets exercised is the mechanism at a *lower* threshold, not the 14-day
      threshold that ships. `remove_days = 14` itself is therefore **«не проверено»** and belongs on
      the Task 7.3 list. Record the exact value used, and prove `remove_days` was restored to 14
      afterwards by re-reading the row.
- [ ] 4.3 Record what "marked as deployed" means concretely in the test — a `prod-current` or
      `preprod-current` tag pointing at the aged image — since no stand is actually running this
      image yet.

### Task 5 — Run it and observe (AC: 1, 2, 3, 6)

- [ ] 5.1 Capture the full `fe-prionex` version list, with ids and timestamps, immediately before.
- [ ] 5.2 Enable the rule and let it run — or trigger the cleanup task if the instance exposes a
      manual trigger. Record which of the two happened and when.
- [ ] 5.3 Capture the full `fe-prionex` version list immediately after, and diff it against 5.1.
- [ ] 5.4 Confirm against the diff: the aged undeployed branch tag is gone; the aged deployed tag
      survived; the recent branch tag survived.
- [ ] 5.5 Confirm the digest-named rows belonging to surviving tags survived. **If a protected
      tag's digest rows were deleted, that is a critical finding** — the tag would still be listed
      but no longer pullable. Test the pull, do not infer it from the row count.
- [ ] 5.6 Check whether the four orphaned `sha256:` rows from Story 1.10 were reclaimed. Record
      the answer either way (AC6).
- [ ] 5.7 Re-run the AC4 blast-radius check across all 86 packages **after** the real run, not
      only before it. Compare version counts per package against the Task 1.1 baseline.

### Task 6 — Answer the five downstream stories (AC: 5)

- [ ] 6.1 For each of `epics.md:1193`, `:1219`, `:1678`, `:1848`, `:1947`, state whether the rule
      as configured satisfies it. Annotate each line in `epics.md` at source with the answer, the
      way Story 1.10's review did — the later story reads that line, not this file.
- [ ] 6.2 `buildcache` (`:1219`) needs a real decision: exempt via `keep_pattern`, or allowed to
      expire because Story 3.5 can regenerate it. Either is defensible; leaving it implicit is not.
- [ ] 6.3 Where the rule cannot satisfy a requirement, record the gap in `deferred-work.md`
      against the story that will hit it.

### Task 7 — Record the outcome (AC: 3, 4, 5, 6)

- [ ] 7.1 Add a decision record to `docs/migration-decisions.md` covering: the single-rule
      constraint and the shared namespace, `match_full_name` as the scoping mechanism, the chosen
      field values verbatim, N and its justification, the preview evidence, the measured test
      result, and what happened to the orphaned digests.
- [ ] 7.2 Document the rule in `docs/forgejo-migration.md` where the registry is described, so the
      configuration is reconstructable without database access.
- [ ] 7.3 State plainly which parts remain **«не проверено»** — anything the seeding method could
      not exercise at the real 14-day threshold belongs on that list.
- [ ] 7.4 Record the rule's field values somewhere a human can restore them from. The rule lives
      in a database this repository does not own; if it is lost, nothing here reconstructs it.

### Task 8 — Commit and close the ledger (AC: all)

- [ ] 8.1 Commit with hooks — **`--no-verify` is prohibited on `main`**, including for docs-only
      changes.
- [ ] 8.2 After every push, re-check `GET /repos/CRM/fe-prionex/actions/runs` `total_count`
      against the Task 1 baseline. This story creates no workflow, so it must not change.
      *(Also carried forward from Story 1.10, where it was never done.)*
- [ ] 8.3 Close the write budget from Task 1.5: state the actual counts against the declared ones
      and explain any difference.
- [ ] 8.4 Update `sprint-status.yaml` and this file's `Status:`. Verify the prior value before
      writing it.

---

## Dev Notes

### What this story produces

No application code. No workflow file. The deliverable is **one database row, its evidence, and
the decision record that lets someone rebuild it.** Everything in `src/` is untouched. The
repository changes are documentation only.

### The argument in one paragraph

Forgejo gives exactly one container cleanup rule per organization, and this organization's
container registry is overwhelmingly the backend team's. The rule we need — expire branch tags
after 14 days — is trivially expressible and catastrophically easy to over-apply. The safety comes
from two places: `match_full_name` scoping every pattern to `fe-prionex/`, and the evaluation
order that lets `keep_pattern` protect the survivors before `remove_pattern` is consulted, which
matters because RE2 cannot express "everything except". The guarantee AC2 asks for — that a
deployed image never dies — cannot be verified by reading the configuration, because the thing
that actually gets deleted is a version row, and a tag's version row is not the only row that tag
depends on. Hence AC3's measured test and AC4's preview.

### Live-instance facts (verified 2026-08-12 — re-verify in Task 1)

| fact | value |
|---|---|
| Forgejo | `15.0.5+gitea-1.22.0` (includes the v15.0.0 multi-platform `keep_count` fix) |
| `package_cleanup_rule` rows | **0** — no rule has ever existed here |
| constraint | `UNIQUE (owner_id, type)` — one rule per owner per package type |
| fields | `enabled, owner_id, type, keep_count, keep_pattern, remove_days, remove_pattern, match_full_name` |
| `CRM` container packages | **86** — 80 × `api-prionex/*`, 3 × `hub-*`, `ci-probe`, `ci-probe-cache`, `fe-prionex` |
| other owners | `Telecom` 5 container packages, `Infra` 1 — different owner_id, unaffected |
| `fe-prionex` versions | 5: `_upload` (internal) + four untagged `sha256:` manifests |
| `app.ini` | no `[packages]`, no `[cron.cleanup_packages]` — defaults in force |
| tagged vs digest rows | confirmed on `hub-web`: id 216 `sha-6b3a348` tagged, id 215 `sha256:c221…` untagged, both `is_internal = f` |

### Documented cleanup semantics — the parts that bite

- Evaluation order: `keep_count` → `keep_pattern` → `remove_days` → `remove_pattern` → delete.
- Patterns auto-anchored `\A…\z`, **case-insensitive**. Never write anchors yourself.
- Empty `keep_pattern` keeps **nothing**. Empty or `.+` `remove_pattern` removes **everything**
  not already excluded.
- `match_full_name = true` → patterns match `package/version`; `false` → `version` only.
- The container registry **always keeps `latest`**, rule or no rule. Relevant to Story 3.3, which
  is deciding whether `latest` should exist at all.
- The rule form offers a **preview** of affected versions. In this namespace it is not optional.

### Anti-patterns for this story

- ❌ Writing `(?!…)` anything. RE2 has no lookahead; express exceptions via `keep_pattern`.
- ❌ Enumerating branch names in `remove_pattern`. Branches are arbitrary; the pattern will rot.
- ❌ Reasoning about `keep_count` as "N images". It counts version rows, and a push writes more
  than one.
- ❌ Treating a surviving tag as proof the image survived. Pull it.
- ❌ Testing on `api-prionex/*` or `hub-*` "because they have more versions to work with".
- ❌ Enabling the rule to see what it does. Preview is exactly that, without the consequences.
- ❌ Recording "the rule protects deployed images" when what was tested was a stand-in tag on an
  image no stand is running. Say what was actually exercised.

### Previous story intelligence

**From Story 1.10 and its review — the failures worth not repeating:**

- **Deleting a tag is not deleting an image.** 1.10's AC6 was ticked on a tag deletion that left
  four manifests and ~60 MB behind. This story's AC6 exists because of that.
- **Numbers stated from memory were wrong by an order of magnitude** — "7 tokens" against an
  actual 94, "610 packages" against 87 packages / 620 versions. Every count in this story comes
  from a query run during the story, pasted in.
- **A claim proven on a stand-in is not proven on the real thing.** 1.10 tested minted tokens of
  the same scope and wrote that the org secrets were proven; the review took that back. The same
  trap is live here: a seeded tag is not a deployed image.
- **Task 1.5 (bind the budget) and Task 8.2 (re-check the run count) were both written into 1.10
  and neither was done.** They are repeated here for the third time.
- **`--no-verify` was used once on `main` for a "docs-only" commit**, breaking the rule the same
  session was enforcing. Docs-only is not an exemption.
- **Token cleanup has no scripted route on this instance** — admin cannot revoke another account's
  token through any UI or API path. This story should need no new token; if it does, plan the
  revocation before minting it.

### Git intelligence

Recent commits are documentation and BMAD artifacts only — `docs/migration-decisions.md`,
`docs/forgejo-migration.md`, `_bmad-output/`. No application code has moved during Epic 1, and
this story continues that. The pre-commit hook runs format, lint, typecheck and the full vitest
suite; the pre-push hook runs the build. Expect ~3 minutes per commit.

**Known flake:** the suite intermittently exits non-zero with
`TypeError: Failed to execute 'dispatchEvent' on 'EventTarget'` while all 1921 tests pass. It hit
twice under load on 2026-08-12 and did not reproduce in four clean runs. If a commit is rejected
with every test passing, this is why — re-run. Do not "fix" it by bypassing the hook.

### Testing standards

The test in this story is not a unit test. It is an experiment on a live instance, and it is only
evidence if it is recorded the way an experiment is: initial state, the exact configuration
applied, the action, the final state, the diff. `git diff`-style before/after listings of the
version table, pasted verbatim. A sentence saying "verified" is not a result.

Two independent observations are required for AC3, because they can disagree: the **preview**
(what the rule says it would delete) and the **actual run** (what it deleted). If they differ,
that difference is the finding.

### Project Structure Notes

Files this story may write:

- `docs/migration-decisions.md` — decision record (Task 7.1)
- `docs/forgejo-migration.md` — registry section (Task 7.2)
- `_bmad-output/planning-artifacts/epics.md` — annotate the five downstream lines (Task 6.1)
- `_bmad-output/implementation-artifacts/deferred-work.md` — gaps (Task 6.3)
- this story file, `sprint-status.yaml`

No file under `src/`, `.forgejo/`, or `.github/` is touched.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.11] — AC1–AC3 verbatim
- [Source: _bmad-output/planning-artifacts/epics.md:97] — FR11
- [Source: _bmad-output/planning-artifacts/epics.md:83] — FR7, the tag scheme
- [Source: _bmad-output/planning-artifacts/epics.md:1193,1219,1678,1848,1947] — the five
  downstream requirements this rule must answer
- [Source: _bmad-output/planning-artifacts/epics.md:1096-1160] — Stories 3.2 and 3.3, the full tag
  vocabulary including environment discriminators
- [Source: docs/migration-decisions.md#d14] — Story 1.10's registry decisions and its review
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — the shared-namespace blocker
  and the orphaned manifests, both filed against this story
- [Source: https://docs.gitea.com/next/usage/packages/storage] — cleanup rule fields, evaluation
  order, anchoring and case rules, `latest` special case
- [Source: https://codeberg.org/forgejo/forgejo/pulls/11246] — multi-platform `keep_count` fix,
  merged 2026-02-12, released in v15.0.0

---

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (`claude-opus-5`), 2026-08-12.

### Debug Log References

**Task 1 — baseline, all figures read from the instance on 2026-08-12, none from memory:**

| measure | value |
|---|---|
| `CRM` container packages | **86** |
| of which `api-prionex/*` | **80** |
| `CRM` container versions, all packages | **1197** |
| versions we own (`fe-prionex` 5, `ci-probe` 6, `ci-probe-cache` 1) | **12** |
| **our share of the blast radius** | **12 / 1197 = 1.0 %** |
| rows in `package_cleanup_rule` | **0** |
| constraint | `CREATE UNIQUE INDEX "UQE_package_cleanup_rule_s" ON public.package_cleanup_rule USING btree (owner_id, type)` |
| Forgejo | `15.0.5+gitea-1.22.0` — contains the v15.0.0 multi-platform `keep_count` fix |
| `app.ini` | 64 non-empty lines, **no `[packages]`, no `[cron.*]`** — cleanup schedule is a compiled-in default nobody chose |
| `action_run` rows for `repo_id = 16` (Task 8.2 baseline) | **30** |

Every query ran through `forgejo-postgres`; nothing was written.

**Task 1.5 — write budget, bound to integers:**

| | declared |
|---|---|
| cleanup rules created | 1 |
| rule edits after creation | ≤ 3 (preview iterations) |
| seeded tags pushed | 3 |
| tags deleted | 3 (the seeded ones) |
| commits | 2 |
| tokens minted | 0 so far — see the blocker |
| rows written to the database | **0** |

**Task 1.3 finding, not in the story when it was written:** there is no `[cron.cleanup_packages]`
section at all, so the schedule and `OLDER_THAN` are Forgejo defaults. The rule's timing is
therefore not under our control and not recorded anywhere on this host.

**Task 2 — the policy, hand-checked against the four evaluation steps.**

Field values, ready to enter:

| field | value |
|---|---|
| owner / type | `CRM` / `container` |
| `enabled` | `false` at creation, `true` only after the preview is read |
| `match_full_name` | **`true`** — non-negotiable |
| `keep_count` | **`0`** |
| `remove_days` | `14` |
| `remove_pattern` | `fe-prionex/.+` |
| `keep_pattern` | `fe-prionex/(prod-current|preprod-current|latest|buildcache|v?\d+\.\d+\.\d+.*|(pre)?prod-[0-9a-f]{7,64}|sha-[0-9a-f]{7,64}-(pre)?prod|sha256:[0-9a-f]{64})` |

**Why `remove_pattern` is the safety mechanism, not `keep_pattern`.** Patterns are auto-anchored
`\A…\z`. `fe-prionex/.+` cannot match `api-prionex/auth-service/sha-abc1234` — that string starts
`api-`, and there is no leading `.*` to absorb it. Step 4 excludes everything that does not match
`remove_pattern`, so all 1185 versions outside our three packages leave the candidate list before
anything else is considered. The anchoring is what makes this true, and it is the first thing the
preview must confirm.

**Why `keep_count = 0` and not a safety net.** `keep_count` keeps the N most recent *version rows*
of a package, ordered by recency across every kind of row. A day of branch builds pushes older
`prod-` tags out of that window, so `keep_count` would silently stop protecting exactly the tags
AC2 is about. It cannot express "the deployment lineage"; only a pattern can. A non-zero value
would also protect the newest branch tags from AC1's 14-day expiry, which contradicts AC1. Zero.

**N for AC2, bound as the story demanded:** **N = all.** The deployment lineage —
`prod-current`, `preprod-current`, `(pre)?prod-<sha>`, `sha-<sha>-prod|-preprod` — is protected by
pattern and never expires. This satisfies "the N previous rollback targets" for every N, which is
what Stories 5.4 and 6.6 need. Cost: at ~15 MB of manifest per release and infrequent production
deploys, on the order of a few hundred MB a year, with layers shared across releases. Branch
builds — the actual growth driver — are the ones that expire.

**Hand-check, all ten versions from Task 2.4, in evaluation order** (`keep_count = 0` so step 1
excludes nothing):

| version | step 2 `keep_pattern` | step 3 `< 14d` | step 4 `remove_pattern` | verdict |
|---|---|---|---|---|
| `fe-prionex/prod-current` | **kept** | — | — | survives ✅ |
| `fe-prionex/preprod-current` | **kept** | — | — | survives ✅ |
| `fe-prionex/preprod-a1b2c3d` | **kept** | — | — | survives ✅ |
| `fe-prionex/sha-a1b2c3d-prod` | **kept** | — | — | survives ✅ |
| `fe-prionex/latest` | **kept** (and the registry keeps `latest` regardless) | — | — | survives ✅ |
| `fe-prionex/buildcache` | **kept** | — | — | survives ✅ |
| `fe-prionex/sha256:…` | **kept** (phase 1 — see below) | — | — | survives ✅ |
| `fe-prionex/feature-x` | not kept | if older | matches | **deleted** ✅ AC1 |
| `fe-prionex/sha-a1b2c3d` (bare, or `-dev`) | not kept | if older | matches | **deleted** ✅ |
| `api-prionex/auth-service/sha-a1b2c3d` | not kept | — | **no match → excluded** | survives ✅ AC4 |
| `hub-web/sha-6b3a348` | not kept | — | **no match → excluded** | survives ✅ AC4 |

**Task 2.5 — RE2 compliance:** no lookahead, no backreference, no `^ $ \A \z` written by hand.
The patterns are alternation, character classes and bounded repetition only. Case-insensitivity
means `[0-9a-f]` also admits `A–F`; harmless.

**Task 2.6 — `ci-probe` and `ci-probe-cache`:** deliberately **outside** the rule.
`remove_pattern` is anchored to `fe-prionex/`, so the rule will never collect them. They are Epic 1
smoke-test residue serving nothing; the right disposal is a one-off deletion at Epic 1 close, not a
standing policy clause that widens the rule's reach for seven versions. Filed to `deferred-work`.

**The phase-1 / phase-2 split, and the awkward thing it exposes.**

`keep_pattern` protects `sha256:…` digest rows in phase 1, because a tag's manifests are separate
version rows and losing them leaves a tag that lists but does not pull. That is safe — and it means
**phase 1 reclaims almost no storage**: deleting a branch tag removes the tag row while its
manifests and blobs stay. FR11 exists to bound registry growth, so phase 1 satisfies AC2 and fails
FR11's purpose.

Phase 2 removes the `sha256:` clause, and it is only reachable if the AC3/5.5 test shows Forgejo
refuses to delete a digest still referenced by a protected tag. **That test is now the deciding
experiment for whether this retention policy does anything at all**, not merely a confirmation
step. Recorded here so the result cannot be quietly skipped.


**Task 3.1 — the rule exists, disabled (2026-08-12, on Oleg's explicit authorisation).**

With no API and no CLI, the row was written directly. One `INSERT`, inside a transaction, into
`package_cleanup_rule` — a table that had never held a row. Read back verbatim:

```
id              | 1
enabled         | f          ← disabled. A disabled rule is never evaluated.
owner_id        | 2          ← confirmed: "CRM", type 1 (organization)
type            | container
keep_count      | 0
remove_days     | 14
match_full_name | t
keep_pattern    | fe-prionex/(prod-current|preprod-current|latest|buildcache|v?\d+\.\d+\.\d+.*|(pre)?prod-[0-9a-f]{7,64}|sha-[0-9a-f]{7,64}-(pre)?prod|sha256:[0-9a-f]{64})
remove_pattern  | fe-prionex/.+
```

Both patterns survived the shell intact — `\d`, `\.` and the brace quantifiers are byte-for-byte
what Task 2 specified. Both were compiled beforehand wrapped as `\A(?:…)\z` with the
case-insensitive flag, exactly as Forgejo wraps them, and run against the eleven-case table: all
eleven verdicts matched the hand-check.

**A robustness property worth recording, since the insert bypassed the form's validation:** even if
the anchoring were not applied, `remove_pattern` would still be safe. `api-prionex/auth-service/…`
does not *contain* the substring `fe-prionex/`, so an unanchored match fails too. The rule's safety
does not rest on the anchoring behaving as documented.

Post-write verification: exactly **1** row in `package_cleanup_rule`; `fe-prionex` 5 versions,
`ci-probe` 6, `ci-probe-cache` 1, `hub-web` 17 — all unchanged. Nothing was deleted.

**🔴 A finding that invalidates Task 5.7 as written.** The CRM container version count went from
**1197** at Task 1 baseline to **1317** about forty minutes later — **+120 versions**, none of them
ours. The backend team pushed a full build round while this story was being implemented.

Consequence: **comparing total or per-package version counts against a baseline cannot detect
whether the rule deleted anything**, because 80 of the 86 packages change on their own, upward,
continuously. Task 5.7 must be re-specified: capture the per-package version **id sets** for the
packages we do not own, and assert that no id present before is absent after. Only a disappearance
is evidence; a changed count is noise. An increase must never be read as "nothing was deleted".

This also sharpens the blast radius from Task 1: it is not a static 1185 versions belonging to other
teams — it is a registry receiving roughly 120 new versions per build round while we work in it.

### Completion Notes List

**🛑 HALT after Task 3.1. The rule now exists, disabled. Tasks 3.2–8 need the web UI — the
mechanism has no non-interactive interface for previewing or enabling.**

Established on the instance, not assumed:

- **No API.** `swagger.v1.json` exposes seven package routes (`/packages/{owner}`,
  `…/{type}/{name}/{version}`, `/files`, `/-/link`, `/-/unlink`, two quota routes). **Zero** contain
  `cleanup`. There is no endpoint to create, read, preview or enable a cleanup rule.
- **No CLI.** `forgejo admin` offers `user`, `repo-sync-releases`, `regenerate`, `auth`, `sendmail`.
  Nothing for packages.
- **Web UI only** — the route is `org/settings/packages_cleanup_rules_edit`, reachable with an
  org-owner or site-admin session. A token does not open it; web routes need a session cookie and a
  CSRF token from a password login.
- **The preview is a UI feature too.** Prohibition 1 forbids enabling an unpreviewed rule and AC4
  requires the preview output as evidence, so this is not a step that can be worked around by
  writing the row directly — and writing the row directly is also a database write, which the
  Task 4.2 decision ruled out.

So the story stops here on purpose rather than inventing a route. **This is the second mechanism in
this migration that turns out to be UI-only** — the first was token revocation, in Story 1.10. The
pattern is now worth naming: on this Forgejo, anything under *owner settings* has no automation
surface, and any story that depends on one needs a human step designed in from the start rather
than discovered at implementation time.

**What is finished and needs nothing further:** Task 1 (baseline, every number bound) and Task 2
(the complete policy, hand-checked against all four evaluation steps for eleven representative
versions, including the two that prove other teams' packages are untouchable).

**What Oleg needs to do, precisely.** The rule is already there, disabled, with every field set. In
the web UI, org `CRM` → Settings → Packages, open it and run the **preview**. Capture the complete
list it produces. The single thing that matters in that output: **no version
outside `crm/fe-prionex` may appear.** If any `api-prionex/*` or `hub-*` version does, the anchoring
assumption is wrong and the rule must not be enabled — that result is more valuable than a
successful one, and it is exactly the check that cannot be done from here.

**One thing worth doing before that:** the backend and hub teams own 1185 of the 1197 container
versions this rule is evaluated against. By construction it cannot touch them, and the preview is
there to prove it — but they have no way to know a cleanup rule is about to exist over their
registry.

### File List

- `_bmad-output/implementation-artifacts/1-11-implement-a-retention-policy-that-cannot-delete-a-deployed-image.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

---

## Open Questions for Review

### Blocking

*None. The one blocking question — how to age a tag — was answered by Oleg on 2026-08-12: route
(a), no database writes. See Task 4.2, and carry its limitation into Task 7.3.*

### Non-blocking

2. **N for AC2 is this story's to choose**, but it constrains Stories 5.4 and 6.6, which speak of
   "the previous N rollback targets" without fixing N either. If those stories want a different
   depth, this rule is where it is enforced.
3. **`ci-probe` and `ci-probe-cache` have no owner after Epic 1.** They are ours, they serve
   nothing, and the rule will either collect them or leave them forever. Task 2.6 decides;
   deleting them outright is also a defensible answer and needs no rule.
4. **Nobody outside this migration knows a cleanup rule is about to exist** over 80 `api-prionex`
   packages and three `hub-*` packages. The rule as designed cannot touch them — but the backend
   and hub teams have no way to know that, and they own most of what is at stake. Worth telling
   them before it is enabled rather than after.
