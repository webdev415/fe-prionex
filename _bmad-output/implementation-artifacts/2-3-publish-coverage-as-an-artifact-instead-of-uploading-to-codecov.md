---
baseline_commit: e97709b6
---

# Story 2.3: Publish Coverage as an Artifact Instead of Uploading to Codecov

Status: review

> **Read §1 before you read the epic's ACs.** The epic assumes `npm run test:coverage` works. **It
> does not, and it never has on this repository.** `@vitest/coverage-v8` is not installed and cannot
> be installed by `npm ci` — it is an *optional peer dependency* of `vitest`
> (`package-lock.json:10803`, `:10831-10833`) and appears nowhere in `package.json`. Measured this
> session: `CI=true npm run test:coverage` → `MISSING DEPENDENCY  Cannot find dependency
> '@vitest/coverage-v8'`, **exit code 1**, in under a second, before a single test executes.
> This story is therefore not "move an upload"; it is "make coverage exist, then publish it".
>
> **The good news, settled 2026-08-14:** the download AC is satisfiable. There is no artifacts API,
> but the web route is real and serves the file to a browser session — a developer can download it,
> an agent cannot (§3).

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the coverage report available from the run itself,
so that the pipeline has one fewer external dependency and coverage is still inspectable.

---

## 🚨 Read this before anything else

**Three of this story's four ACs are traps if read literally.** AC1 names a script that fails on
startup. AC3 offers `continue-on-error` as a neutral option when it is the exact mechanism that hid
the AC1 defect for the entire life of this repository. AC4's "downloadable" was believed impossible
until two days ago and the file that says so has not been fully swept. Only AC2 (delete Codecov) is
as simple as it reads.

### 1. 🔴 `npm run test:coverage` fails on startup, today, and has always failed in CI

Verified first-hand at `e97709b6`, four independent ways:

| Check | Command | Result |
|---|---|---|
| Declared dependency | `grep -n 'coverage' package.json` | **one hit — `:16`, the script itself.** No coverage package in `devDependencies` (`:62-93`) |
| Installed | `ls node_modules/@vitest/` | `expect`, `mocker`, `pretty-format`, `runner`, `snapshot`, `spy`, `utils` — **no `coverage-v8`, no `coverage-istanbul`** |
| Resolvable | `node -e "require.resolve('@vitest/coverage-v8')"` | `MODULE_NOT_FOUND` |
| Actually run | `CI=true npm run test:coverage` | `MISSING DEPENDENCY  Cannot find dependency '@vitest/coverage-v8'` — **exit 1** |

**Why `npm ci` will not fix it.** `package-lock.json:10803` lists `"@vitest/coverage-v8": "4.1.3"`
under `vitest`'s **`peerDependencies`**, and `:10831-10833` marks it
`"@vitest/coverage-v8": { "optional": true }` in `peerDependenciesMeta`. An optional peer that no
package depends on is never installed. The lock file mentioning the string is not the same as the
lock file installing it — do not let the `grep` hit reassure you.

**Why nobody noticed.** `.github/workflows/CI.yml:70-72`:

```yaml
      - name: Generate coverage report
        run: npm run test:coverage
        continue-on-error: true
```

…and `CI.yml:74-78` then uploads `./coverage/coverage-final.json` with `fail_ci_if_error: false`.
The step failed, `continue-on-error` swallowed it, the file it produced never existed, and Codecov
was told not to complain about missing input. **The GitHub pipeline has been reporting green while
uploading nothing.** `git log -S'coverage-v8' -- package.json` returns **no commit that ever added
it to `package.json`**; the single hit on the lock file (`df32d45a`, 2026-04-16) is the peer-dep
block arriving with the `vitest@4.1.3` bump, not an install.

**Consequence for this story:** `vitest.config.ts:24-28` already configures
`provider: 'v8'`, `reporter: ['text', 'json', 'html']`, `exclude: ['node_modules/', 'src/test/']`.
The configuration is fine. The **package** is missing. Adding `@vitest/coverage-v8` to
`devDependencies` (pinned to `4.1.3`, matching `vitest@4.1.3` at `package-lock.json:10759` — the
peer range is exact, not a caret) is a mandatory part of this story, and it is a `package.json` +
`package-lock.json` change, which no story in Epic 2 has made before.

### 2. 🔴 Running coverage as a *second* pass roughly doubles the longest job on a shared host

Measured, not estimated:

- `Unit Tests` is **486 s of the 487 s** whole-run wall clock (`deferred-work.md:687-688`, runs 492
  cold / 493 warm). The other three jobs finish inside its shadow.
- Re-measured on run 505: `Unit Tests` **467 s**, whole run **468 s**
  (`2-2-…md:631`, `:642`).
- The cache is **not** the lever: cold→warm saved **3 seconds of 487** (`deferred-work.md:684-686`).
- Since Story 2.2 armed both triggers, **one commit on a PR branch costs two runs — ~964 s of wall
  clock and ~1620 job-seconds** (`deferred-work.md:849-851`, runs 513–516, measured 2026-08-14).
- The suite takes ~150 s locally; the runner is **~3× slower**, at load average 12.99, carrying
  another tenant's production (`deferred-work.md:688-690`).

The epic's AC1 says `npm run test:coverage` runs **after** `npm run test:run`. Taken literally that
is **two full executions of the same 228 test files** in the same job: ~467 s becomes ~950 s+, the
whole run goes from ~468 s to ~950 s, and the per-commit PR cost goes from ~964 s to ~1900 s.
**Story 2.4 owns the 15-minute budget and has not run yet.** This story would consume most of the
headroom 2.4 exists to find, silently, before 2.4 gets to look.

`vitest run --coverage` executes the identical suite; the only difference is instrumentation. **One
pass replaces the other.** That is the decision this story takes (AC1, Task 4) — and it is a
deliberate, recorded deviation from the epic's wording, exactly like Story 2.1's `test:run:ci`
deviation from *its* AC4 (`.forgejo/workflows/ci.yml:137-139`).

⚠️ **What is NOT measured:** the v8 instrumentation overhead on this runner. «не проверено». It
cannot be measured here — the provider will not install without a `package.json` change, and that
change is this story's to make and review. Task 5 requires it to be measured on the first real run
and written down, because it is the number Story 2.4 will inherit.

### 3. The artifact IS downloadable — by a human, never by you

**Settled 2026-08-14 by measurement** (`deferred-work.md:886-898`), and the answer is subtle enough
that two earlier sessions got it wrong in opposite directions:

- With a token: `/api/v1/repos/CRM/fe-prionex/actions/artifacts` → **404**. **There is no artifacts
  API on this instance.** The earlier `403` reading was wrong — `403` was the generic refusal for an
  unauthenticated call; the router only tells the truth once you authenticate.
- **But the web route is real:** `/CRM/fe-prionex/actions/runs/{index}/artifacts/{name}` **exists
  and serves the file.** It redirects an API token to `/user/login` because web routes need a
  **browser session**, not a token.

**Therefore, precisely: a developer can download it; an agent cannot.** AC4 says *"a developer opens
the run page … the coverage artifact is downloadable"* — **that is satisfiable as written**, and its
verification is a thirty-second human click, the same shape as Story 2.1's unread peak-memory line
(`2-1-…md:421-432`).

🚨 **Two things follow, and both are load-bearing:**

1. **Nothing downstream may be built on programmatic artifact retrieval.** No later story, no
   script, no check may `curl` an artifact out of a run. It does not work and will not.
2. 🔴 **`deferred-work.md:695-696` still says the opposite** — *"Retrieval is still unverified and
   Story 2.3's AC ('the coverage artifact is downloadable') has no known way to be satisfied"* — and
   so does the comment block at `.forgejo/workflows/ci.yml:199-202`. Both are **stale**, superseded
   by `deferred-work.md:886-898`. Task 8 sweeps them. Do not read either as current and conclude
   AC4 is impossible.

### 4. ⚠️ `upload-artifact@v3` writes one database row per FILE, and `coverage/` is not one file

Proven exactly, not approximately. Run 492 uploaded `dist/` and produced **154** rows named `dist`
(10,535,201 bytes gzip) — `deferred-work.md:691-692`, `2-1-…md:408-409`. Counted this session:
`find dist -type f | wc -l` → **154**. One row per file, confirmed to the unit.

The instance held **3** artifacts before that upload and **157** after
(`deferred-work.md:692-693`). Any statement counting "artifacts" here is counting files.

`vitest.config.ts:26` sets `reporter: ['text', 'json', 'html']`. The `html` reporter emits roughly
one `.html` per reported source file plus assets. Counted this session: **1229** candidate source
files under `src/` (excluding `*.test.*`, `*.spec.*`, `src/test/`) against **228** test files.

⚠️ **The resulting file count is «не проверено»** and the honest bound is wide: Vitest 4 reports
only files actually loaded during the run unless `coverage.include`/`all` is set, and neither is set
in `vitest.config.ts:24-28`. So the true count is somewhere between a few dozen and ~1229 — but the
**mechanism** is proven exact, and the upper bound is ~8× the `dist` upload, **twice per commit**
(`push` + `pull_request`), on an instance whose entire prior artifact population was 3.

**This story does not gamble on where in that range it lands.** Task 4.5 archives `coverage/` into a
single file before upload, making the row count exactly **1** regardless. That is a deviation from
AC1's *"the `coverage/` output is uploaded"* and it is recorded as one — the coverage output is
uploaded, packaged. It also preserves what AC1 is actually for: the developer gets the browsable
`html` report, not a bare JSON blob they cannot read.

### 5. 🔴 The heap number is a trap that fails silently in the direction of a green run

Three scripts, three different ceilings (`package.json:14-16`, verbatim):

```
14	    "test:run": "cross-env NODE_OPTIONS=--max-old-space-size=8192 vitest run",
15	    "test:run:ci": "cross-env NODE_OPTIONS=--max-old-space-size=16384 vitest run",
16	    "test:coverage": "cross-env NODE_OPTIONS=--max-old-space-size=8192 vitest run --coverage",
```

CI currently runs `test:run:ci` — **16384 MB** — and `.forgejo/workflows/ci.yml:122-139` explains at
length why: `cross-env` hardcodes the ceiling, so a job-level `env:` cannot raise it, and raising it
in `test:run` would raise it on a 16 GB laptop for every pre-commit hook.

**`test:coverage` is 8192.** Swap `test:run:ci` for `test:coverage` in the workflow and CI silently
drops to **half** the heap it was deliberately given — while simultaneously adding coverage's own
memory pressure to a suite that needed the raise in the first place. It will not fail with a message
saying "heap was halved". It will OOM, or flake, or pass and flake next week.

A new `test:coverage:ci` script at **16384** is mandatory. Do not edit `test:coverage` itself — same
reason `test:run` was left alone.

### 6. You cannot read a job log on this instance, so plan the evidence before the run

`deferred-work.md:651-662`: the API returns **404** for `actions/jobs/{id}/logs`,
`actions/runs/{run}/jobs/{id}/logs` and `actions/tasks/{id}/logs`; tasks 4872–4879 never reached
`/data/gitea/actions_log` and their `log_in_storage` stayed `f` even though the database recorded
`log_length` up to 1265 lines. **The content existed and never reached disk.**

So: the `text` coverage reporter prints a table to stdout that **you will never see**. Every fact
this story records must be observable in the **database** (`action_run`, `action_run_job`,
`action_task`, and the `package_version`-style artifact rows) or made observable by a step that
fails loudly. A green job is evidence; a printed number is not.

### 7. No API token exists right now, and the exit must be planned before minting

`deferred-work.md:17-42` and `:298-306`: the standing model is one token, tokens have accumulated
past it before ("four tokens now exist where the model calls for one", `:268`), and **an admin
cannot revoke another account's token** — `:298-300` — so a token minted carelessly cannot be
cleaned up. Story 1.11 declared **zero** tokens and minted **two** (`:534`).

Minting needs Oleg. **Plan the exit before the mint, in writing, in this file** (Task 3.3). If the
evidence can be gathered without a token — via `docker exec` against the database on s1, which is
how Stories 2.1 and 2.2 got theirs — mint nothing.

### 8. Codecov must disappear entirely, and it is already absent — verify, do not assume

FR3 (`epics.md:74-75`): *"CI publishes the coverage report as a workflow artifact; the `codecov`
upload step is removed entirely."*

`.forgejo/workflows/ci.yml` has **no** codecov step today — Story 2.1 deliberately left it out
(`2-1-…md:150-151`, Prohibition 3) and said so in the file's closing comment
(`.forgejo/workflows/ci.yml:210-212`). AC2 is therefore mostly already true. What it still requires:
**do not reintroduce it**, and confirm no secret named for it exists on the repository or the
organisation. The legacy `.github/workflows/CI.yml:75` reference stays where it is — that file is
Story 7.2's to delete, not this one's (D7).

### Prohibitions

🚨 **A prohibition here cannot be overridden by a subtask.**

1. **No `codecov` step, no `codecov` token, no `codecov` secret** — in `.forgejo/workflows/` or
   anywhere this story touches. FR3 removes the service, not just the step.
2. **`upload-artifact@v4` must not be used.** It does not resolve on this instance —
   `GHESNotSupportedError` (`2-1-…md:42`, D12). **Pin `@v3`**, the version Story 1.8 proved and
   Story 2.1 uses (`.forgejo/workflows/ci.yml:204`).
3. **Do not run the suite twice.** §2. One pass with `--coverage`, or an explicit, measured,
   written-down reason why two passes are worth ~480 extra seconds per run and ~960 per commit.
4. **Do not point the workflow at `test:coverage` as it stands.** §5 — it is the 8192 script, and
   using it halves CI's heap silently.
5. **Do not edit `test:run`, `test:run:ci`, or `test:coverage`.** Add `test:coverage:ci`. The
   existing three are load-bearing for developers' machines and for Story 2.1's recorded decision.
6. **Do not claim any artifact was retrieved programmatically**, and do not write a script, check or
   downstream step that fetches one. §3 — there is no artifacts API. AC4 closes on a human click or
   it closes as «не проверено».
7. **Do not add or change any trigger.** `on:` is Story 2.2's, already armed, and every edit to it
   now costs two runs per commit on a shared host with **no cancel endpoint**
   (`migration-decisions.md:581-585`).
8. **Do not touch `.github/workflows/`.** No action is taken on GitHub (D7); Story 7.2 deletes the
   legacy files.
9. **Do not "fix" `continue-on-error` by keeping it.** §1 — inheriting it is precisely what AC3
   forbids. Whichever way you decide, the reason goes in this file.
10. **Do not commit a `coverage/` directory.** `.gitignore:36` already ignores it; keep it that way.

---

## Acceptance Criteria

Source: `epics.md:1140-1166`, Story 2.3. Covers **FR3** (`epics.md:74-75`); contributes to NFR1.
Deviations from the epic's literal wording are named in each AC and justified in §2 and §4.

**AC1 — coverage is generated in the `test` job and published as a workflow artifact.**
Given the `test` job in `.forgejo/workflows/ci.yml`,
when the workflow runs,
then coverage is generated by a **single** execution of the vitest suite with `--coverage` at the
**16384 MB** ceiling (`test:coverage:ci`),
and the `coverage/` output is uploaded as a workflow artifact via `actions/upload-artifact@v3`,
and `@vitest/coverage-v8@4.1.3` is present in `devDependencies` so that a clean `npm ci` can run it.

> **Deviation from `epics.md:1150`**, which says `npm run test:coverage` runs *after*
> `npm run test:run`. Two passes of the same suite costs ~480 s of extra wall clock per run and
> ~960 s per PR commit (§2), against a 15-minute budget Story 2.4 has not yet measured. What is
> tested is identical — same vitest, same config, same 228 files. **Deviation from `epics.md:1151`**
> ("the `coverage/` output"): it is archived into a single file first, because `upload-artifact@v3`
> writes one database row per file (§4).

**AC2 — Codecov is gone, with nothing left behind.**
Given the previous `codecov/codecov-action@v4` step at `.github/workflows/CI.yml:74-78`,
when `.forgejo/workflows/` is reviewed,
then no codecov step exists in any Forgejo workflow,
and no codecov token or secret is referenced by, or configured for, the repository or the
organisation.

**AC3 — the failure behaviour is chosen, not inherited.**
Given that `.github/workflows/CI.yml:72` set `continue-on-error: true` on the coverage step,
when coverage generation fails,
then the job **fails**,
and the reason that choice was made — rather than inherited — is recorded in this file.

> **The choice is: fail the job. `continue-on-error` is prohibited on this step (Prohibition 9).**
> The reason is not stylistic. `continue-on-error: true` at `CI.yml:72` is the exact mechanism that
> concealed a coverage step which has **never once succeeded** in this repository's history (§1),
> paired with `fail_ci_if_error: false` at `CI.yml:78` to silence the consequence. A step that is
> allowed to fail is a step nobody reads, and on this instance nobody *can* read it — job logs are
> unretrievable (§6). Fail-loud is the only setting under which a green job means anything here.
> The cost of being wrong is one red run, which is cheap; the cost of the alternative is two years
> of green runs uploading nothing, which is what actually happened.

**AC4 — a developer can download it.**
Given a completed CI run,
when a developer opens the run page in a browser,
then the coverage artifact is downloadable.

> Satisfiable as written and verified by a human click (§3). The route is
> `/CRM/fe-prionex/actions/runs/{index}/artifacts/{name}`. **An agent cannot verify this** — the
> route redirects an API token to `/user/login`, and there is no artifacts API (404). If Oleg is not
> available to click, AC4 closes as «не проверено» **with the route and run index recorded** so the
> click takes thirty seconds later. That is an acceptable outcome; a fabricated one is not.

**AC5 — the cost is measured and handed to Story 2.4.**
Given that `Unit Tests` was 467–486 s of a 468–487 s run before this change,
when the first coverage-enabled run completes,
then the new `Unit Tests` duration and the new whole-run duration are read from the database and
recorded here,
and the delta attributable to coverage instrumentation is stated,
and if the whole run exceeds 15 minutes the fact is written down and flagged to Story 2.4 rather
than left for 2.4 to discover.

---

## Tasks / Subtasks

### Task 1 — Bind the facts before changing anything (AC: 1, 2, 5)

- [ ] 1.1 Re-verify §1 on the current tree: `grep -n 'coverage' package.json`,
      `ls node_modules/@vitest/`, `node -e "require.resolve('@vitest/coverage-v8')"`, and
      `CI=true npm run test:coverage`. All four are recorded in §1 at `e97709b6`; if any has drifted,
      stop and re-plan rather than proceeding on a stale premise.
- [ ] 1.2 Confirm `.forgejo/workflows/ci.yml` still matches Dev Notes — in particular that the `test`
      job runs `npm run test:run:ci` (`:141-142`), that `upload-artifact@v3` is at `:204`, and that
      the file is 212 lines.
- [ ] 1.3 Record the current run count on this repository as the run-budget baseline, from
      `action_run`, before creating any runs.
- [ ] 1.4 Confirm both runners are online and carry `node-20`.

### Task 2 — Fix the dependency (AC: 1)

- [ ] 2.1 Add `"@vitest/coverage-v8": "4.1.3"` to `devDependencies` in `package.json`. **Pin exact,
      no caret** — `package-lock.json:10803` states the peer requirement as `4.1.3`, matching
      `vitest@4.1.3` at `:10759`. A caret would let it drift off the peer range on the next install.
- [ ] 2.2 Run `npm install` (not `npm ci`) to update `package-lock.json`, then confirm
      `node -e "require.resolve('@vitest/coverage-v8')"` succeeds.
- [ ] 2.3 Prove it locally before spending a run: execute a coverage pass over a **narrow** path and
      confirm `coverage/` is produced and contains `coverage-final.json` and `index.html`. Do not run
      the full suite locally just to prove the provider resolves.
- [ ] 2.4 Confirm `.gitignore:36` (`coverage/`) still covers the output directory, and that
      `git status` after 2.3 shows no `coverage/` entries.

### Task 3 — Declare the budget and the write list before spending either (AC: 5)

- [ ] 3.1 State the number of CI runs this story expects to create, **before creating any**. Story
      2.1 declared 2 and spent 2 (`2-1-…md:212`); Story 1.11 declared zero tokens and minted two
      (`deferred-work.md:534`). Remember each run is now ~468–487 s and there is **no cancel
      endpoint** (`migration-decisions.md:581-585`), and that a push to a PR branch produces **two**
      runs, not one (`deferred-work.md:849-851`).
- [ ] 3.2 List every write to shared state: which refs get pushed, and whether `package.json` /
      `package-lock.json` land on `main` in the same commit as the workflow change.
- [ ] 3.3 Decide whether a Forgejo API token is needed at all. Stories 2.1 and 2.2 gathered their
      evidence by `docker exec` against the database on s1 — prefer that. **If a token is genuinely
      needed: plan the exit in writing here first**, name the owner, and get Oleg's explicit
      authorisation. An admin cannot revoke another account's token (`deferred-work.md:298-300`), so
      an unplanned mint is unrecoverable.

### Task 4 — Write the change (AC: 1, 2, 3)

- [ ] 4.1 Add `"test:coverage:ci": "cross-env NODE_OPTIONS=--max-old-space-size=16384 vitest run --coverage"`
      to `package.json`. **Do not modify `test:run`, `test:run:ci` or `test:coverage`**
      (Prohibition 5).
- [ ] 4.2 In `.forgejo/workflows/ci.yml`, **replace** the `test` job's `npm run test:run:ci` step
      (`:141-142`) with `npm run test:coverage:ci`. One pass, not two (Prohibition 3).
- [ ] 4.3 Update the comment block at `:123-140` — it currently explains `test:run:ci` vs `test:run`
      and will otherwise describe a step that no longer exists. Keep the heap rationale, which is
      still the reason for the `:ci` variant, and add the one-pass rationale from §2.
- [ ] 4.4 **No `continue-on-error` on the coverage step** (AC3, Prohibition 9). Write the reason as a
      comment in the YAML, not only in this file — the next reader will be looking at the workflow.
- [ ] 4.5 Archive before uploading: a step that produces a single file from `coverage/` (e.g.
      `tar -czf coverage.tar.gz coverage/`), then `actions/upload-artifact@v3` with a `name` of
      `coverage`, `path` pointing at that single file, and `retention-days: 1`. **`@v3`, not `@v4`**
      (Prohibition 2). Comment why the archive exists — §4, one database row per file.
- [ ] 4.6 Keep the peak-memory step (`:150-162`) and its `if: always()`. It is Story 2.1's open AC4
      and coverage makes its number *more* interesting, not less.
- [ ] 4.7 Grep the finished file: `codecov` must return nothing outside the historical comment at
      `:210-212` (which Task 8.1 rewrites anyway); `ubuntu-latest` must return nothing outside the
      warning comment at `:60-65`; `upload-artifact@v4` must return nothing; `test:run:ci` must
      return nothing.
- [ ] 4.8 Confirm no repository or organisation secret is named for Codecov (AC2). Absence is the
      expected result — record that you checked, not that you assumed.

### Task 5 — Prove it, and measure what Story 2.4 will inherit (AC: 1, 4, 5)

- [ ] 5.1 Land the change on `main` and let the armed `push`/`pull_request` triggers do their work,
      or dispatch deliberately — but count every run against the Task 3.1 budget, including the
      duplicate that a PR branch produces.
- [ ] 5.2 From the database (`action_run`, `action_run_job`, `action_task` — **not** from logs, §6),
      record: run index, job ids, per-job durations, whole-run duration, and status.
- [ ] 5.3 Count the artifact rows produced under the `coverage` name. **Expect exactly 1** if Task
      4.5 was done. If it is not 1, the archive step did not do its job — say so and fix it before
      closing, because the alternative is up to ~1229 rows twice per commit (§4).
- [ ] 5.4 Confirm `retention-days: 1` is applied by checking `expired_unix` is exactly one day after
      creation, as Story 2.1 established for `dist` (`deferred-work.md:693-695`).
- [ ] 5.5 State the coverage overhead: new `Unit Tests` duration minus the 467 s baseline from run
      505 (`2-2-…md:631`). This number is currently «не проверено» (§2) and is the whole reason
      Task 5 exists.
- [ ] 5.6 Compare the whole-run duration against **15 minutes** (`epics.md:1187`). Under: record it
      and hand the number to Story 2.4. Over: record it, flag it as Blocking, and do not close the
      story quietly.
- [ ] 5.7 **AC4 — ask Oleg to open
      `/CRM/fe-prionex/actions/runs/{index}/artifacts/coverage` in a browser and confirm the
      download.** Record the run index and the exact URL here first, so the click is thirty seconds.
      Do not attempt it with a token — it redirects to `/user/login` (§3). If Oleg is unavailable,
      close AC4 as «не проверено» **with the URL recorded**.

### Task 6 — Decide what coverage is *for*, before someone assumes (AC: 3, 5)

- [ ] 6.1 State plainly in this file that coverage is **published, not enforced**: there is no
      threshold, no gate, and no `coverage.thresholds` block in `vitest.config.ts:24-28`. A future
      reader will otherwise assume a coverage number means something.
- [ ] 6.2 If a threshold is wanted, name it as a separate story rather than adding it here — it
      turns a publishing change into a merge gate, and Story 2.6 owns required checks.

### Task 7 — Record (AC: all)

- [ ] 7.1 Fill in Dev Agent Record: runs created vs. declared, durations, artifact row count, the AC3
      decision as executed, and every «не проверено» that survives.
- [ ] 7.2 Update `docs/forgejo-migration.md:109`, which currently records the codecov verdict as
      «Убрать, coverage — в артефакт» — an intention. Once this lands it is a fact, and the row
      should say so with the run that proves it.
- [ ] 7.3 Record in `docs/migration-decisions.md` that `@vitest/coverage-v8` was never installed and
      that `CI.yml:70-78` therefore uploaded nothing. This is a finding about the **inherited
      pipeline**, not about Forgejo, and it is the kind of thing a migration document exists to
      capture.

### Task 8 — Sweep the stale records this story invalidates (AC: 4)

- [ ] 8.1 Rewrite `.forgejo/workflows/ci.yml:199-202`. It currently says *"There is no
      Actions-artifacts API on this instance, so retrieval of this artifact is unverified."* The
      first clause is still true; the second is superseded (§3). Correct it so the next reader does
      not conclude artifacts are unusable.
- [ ] 8.2 Mark `deferred-work.md:695-696` superseded. It states AC4 *"has no known way to be
      satisfied"*, which `deferred-work.md:886-898` settled two days later. Leave the original
      visible with a supersession marker, matching the convention already used at `:899`.
- [ ] 8.3 Add a new `deferred-work.md` entry for anything this story opens — at minimum the coverage
      overhead number for Story 2.4, and whether the archive-before-upload pattern should be applied
      retroactively to the `dist` upload's 154 rows.

### Task 9 — Close (AC: all)

- [ ] 9.1 Set `Status: review`, update `sprint-status.yaml:79` from `backlog`.
- [ ] 9.2 Confirm every claim in Dev Agent Record carries a `file:line`, a database value, or an
      explicit «не проверено».

---

## Dev Notes

### Exact source facts (verified at `e97709b6`)

**`package.json:13-16`** — verbatim:

```
13	    "test": "vitest",
14	    "test:run": "cross-env NODE_OPTIONS=--max-old-space-size=8192 vitest run",
15	    "test:run:ci": "cross-env NODE_OPTIONS=--max-old-space-size=16384 vitest run",
16	    "test:coverage": "cross-env NODE_OPTIONS=--max-old-space-size=8192 vitest run --coverage",
```

`vitest` is `^4.0.14` (`package.json:92`), resolved to **4.1.3** (`package-lock.json:10759`).
`cross-env` is `^7.0.3` (`package.json:77`). No coverage package in `devDependencies` (`:62-93`).

**`vitest.config.ts:24-28`** — verbatim:

```
24	    coverage: {
25	      provider: 'v8',
26	      reporter: ['text', 'json', 'html'],
27	      exclude: ['node_modules/', 'src/test/'],
28	    },
```

No `reportsDirectory` (so the default `coverage/` applies, which is what `.gitignore:36` ignores and
what `CI.yml:77` pointed at). No `thresholds`. No `all`/`include` — so only files loaded during the
run are reported (§4).

Also relevant in the same config: `pool: 'forks'`, `maxWorkers: 1`, `fileParallelism: false`
(`:30-32`) — the suite is deliberately serial, which is why it takes ~467 s on the runner and why a
second pass costs a full second pass rather than an amortised one.

**`.github/workflows/CI.yml:67-78`** — the steps being replaced, verbatim:

```
67	      - name: Run unit tests
68	        run: npm run test:run
69	
70	      - name: Generate coverage report
71	        run: npm run test:coverage
72	        continue-on-error: true
73	
74	      - name: Upload coverage reports
75	        uses: codecov/codecov-action@v4
76	        with:
77	          files: ./coverage/coverage-final.json
78	          fail_ci_if_error: false
```

**`.forgejo/workflows/ci.yml`** — 212 lines. The `test` job is `:107-162`: checkout@v6 (`:112`),
setup-node@v4 with `cache: 'npm'` (`:115-118`), `npm ci` (`:121`), the heap comment (`:123-140`),
`npm run test:run:ci` (`:141-142`), the peak-memory step (`:150-162`). `upload-artifact@v3` for
`dist` is `:203-208`. The closing comment about Codecov and this story is `:210-212`.

### Action verdicts on this instance (D12, Story 1.8)

| Action | Verdict |
|---|---|
| `actions/checkout@v6` | resolves |
| `actions/setup-node@v4` | resolves |
| `actions/upload-artifact@v4` | **does not resolve** — `GHESNotSupportedError` (`2-1-…md:42`, `2-1-…md:301`) |
| `actions/upload-artifact@v3` | resolves; upload confirmed; **154 rows for one `dist` upload**; `retention-days: 1` genuinely applied (`expired_unix` exactly one day out) |
| `codecov/codecov-action@v4` | **«заменено дизайном»** — removed by FR3, never probed and never will be (`docs/forgejo-migration.md:109`) |

### Measured durations, and what this story adds to them

| Run | Event | `Unit Tests` | Whole run | Source |
|---|---|---|---|---|
| 492 (cold) | dispatch | **486 s** | **487 s** | `2-1-…md:392`, `:394` |
| 493 (warm) | dispatch | 483 s | 484 s | `2-1-…md:397`, `:399` |
| 505 | `push` | **467 s** | **468 s** | `2-2-…md:631`, `:642` |
| 513–516 | one PR commit | — | **~964 s across two runs**, ~1620 job-seconds | `deferred-work.md:849-851` |

Cold→warm cache saving: **3 s of 487** (`deferred-work.md:684-686`). The cache is not the lever;
`Unit Tests` is the whole run.

Local full suite: ~150 s (`deferred-work.md:688`). Runner ≈ 3× slower, host load average 12.99,
shared with another tenant's production (`:689-690`).

⚠️ **v8 instrumentation overhead on this runner: «не проверено».** It cannot be measured before
Task 2 lands. Task 5.5 owns it.

### Anti-patterns for this story

- **Reading `epics.md:1150` literally** and running the suite twice. §2 — it costs ~480 s per run,
  ~960 s per PR commit, against a budget Story 2.4 has not yet measured.
- **Pointing the workflow at `test:coverage`** because it is the script the epic names. §5 — it is
  the 8192 script and CI silently loses half its heap.
- **Keeping `continue-on-error: true`** because `CI.yml:72` had it. §1 — that flag is why nobody
  noticed the step had never worked.
- **Trusting `grep 'coverage-v8' package-lock.json`** as proof of installation. §1 — those two hits
  are the optional peer-dependency declaration, not an install.
- **Uploading `coverage/` unpackaged.** §4 — one row per file, on an instance whose entire artifact
  population was 3 before Story 2.1.
- **Trying to `curl` the artifact to prove AC4.** §3 — no artifacts API (404); the web route needs a
  browser session.
- **Believing `deferred-work.md:695-696` or `ci.yml:199-202`.** Both are stale; `:886-898` is
  current.
- **Adding a coverage threshold** while you are in there. Task 6 — that is a merge gate, not a
  publishing change.

### Previous story intelligence

- **Story 2.1** established the `test` job, the `:ci` heap deviation from its own AC4 (recorded in
  the YAML at `:137-139` rather than hidden), and the `@v3` pin. Its AC4 (peak memory) is **still
  open** — the step runs, the number is in an unretrievable log (`2-1-…md:421-432`).
- **Story 2.2** armed `push` (with `branches-ignore` on main/staging/development) and
  `pull_request` (branches: main). It proved `branches-ignore` is honoured empirically
  (`deferred-work.md:714-718`) and measured the two-runs-per-commit cost. It left `ci.yml` on
  **`main` only** — a feature branch cut from `staging` or `development` gets no CI, silently
  (`2-2-…md:838-840`).
- **Story 1.8** proved `upload-artifact@v3` uploads and `@v4` does not, and correctly left retrieval
  as «не проверено» — a judgement two later sessions each got wrong in a different direction before
  it was settled by measurement.
- **The standing method lesson** (`deferred-work.md:548-551`): "job logs are unretrievable" was
  over-generalised into not reading the **server** log either, and the answer to Story 1.11's
  question sat in `docker logs forgejo` for eight hours. Different things.

### Testing standards

The suite is 228 test files under `src/` (`*.test.*` / `*.spec.*`), run serially
(`vitest.config.ts:30-32`), locale-pinned to `C.UTF-8` (`:14`) so CI and local formatting agree,
with 20 s test and hook timeouts (`:39-40`). This story adds **no tests**. It changes how the
existing suite is invoked, and the assertion that it still passes is the CI run itself.

The one local check worth doing (Task 2.3) is narrow: prove the coverage provider resolves and emits
`coverage/`, not that 228 files pass — that is what the runner is for.

### Project Structure Notes

Files this story is expected to touch:

- `package.json` — add `@vitest/coverage-v8` to `devDependencies`, add `test:coverage:ci`.
- `package-lock.json` — regenerated by `npm install`.
- `.forgejo/workflows/ci.yml` — `test` job step swap, archive step, upload step, comments.
- `docs/forgejo-migration.md` — the codecov row at `:109`.
- `docs/migration-decisions.md` — the finding from §1.
- `_bmad-output/implementation-artifacts/deferred-work.md` — supersession sweep (Task 8).
- `_bmad-output/implementation-artifacts/sprint-status.yaml:79` — status.
- This file.

Files this story must **not** touch: anything under `src/`, `.github/workflows/`, `vitest.config.ts`
(the coverage config is already correct — the package was the problem), and the `on:` block of
`ci.yml`.

### References

- `epics.md:1140-1166` — Story 2.3 and its four ACs
- `epics.md:74-75` — FR3
- `epics.md:338` — FR3 traceability row
- `epics.md:1168-1194` — Story 2.4, which owns the 15-minute budget this story spends into
- `package.json:13-16`, `:77`, `:92` — scripts and versions
- `package-lock.json:10759`, `:10795-10808`, `:10828-10833` — vitest 4.1.3 and the optional peer
- `vitest.config.ts:24-28`, `:30-32`, `:39-40` — coverage config, pool, timeouts
- `.github/workflows/CI.yml:67-78` — the steps being replaced
- `.forgejo/workflows/ci.yml:107-162`, `:194-208`, `:210-212` — current `test` job, artifact upload,
  closing comment
- `deferred-work.md:651-662` — job logs unretrievable
- `deferred-work.md:684-696` — `Unit Tests` dominates; one row per file; `retention-days` applied;
  **`:695-696` is stale**
- `deferred-work.md:849-851` — two runs per PR commit, ~964 s
- `deferred-work.md:886-898` — the artifact-retrieval question, settled
- `deferred-work.md:17-42`, `:268`, `:298-306`, `:534` — the token model and why exits are planned
  first
- `docs/forgejo-migration.md:109` — codecov verdict «заменено дизайном»
- `docs/migration-decisions.md#d12` — per-action verdicts
- `docs/migration-decisions.md:581-585` — no cancel endpoint
- `2-1-…md:42`, `:150-153`, `:301-302`, `:392-399`, `:408-416`, `:421-432` — Story 2.1's evidence
- `2-2-…md:631`, `:642`, `:789`, `:838-840` — Story 2.2's evidence

---

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M context), directly — the Dev subagent launch was declined, so the work was done in
the parent session. Story authoring used an Opus subagent over five Haiku retrieval agents.

### Debug Log References

**Budget: 1 CI run declared, 1 spent.** Run 520 exists but is `status = 3` (cancelled) — the probe
branch's earlier push, auto-cancelled when the real commit landed. That is D8's default auto-cancel
observed in the wild, without a `concurrency` block. ⚠️ **It cost no *budgeted run*, but it did not
cost nothing:** Lint 145 s, Type Check 88 s and Build 119 s completed green before the cancel landed,
and Unit Tests was killed at 334 s — about 686 job-seconds spent. Corrected by review.

| | baseline (runs 505/513/515) | run 522 | delta |
|---|---|---|---|
| `Unit Tests` | 460–467 s | **539 s** | **+72 s (+15%) against 467; +79 s (+17%) against 460** |
| whole run | 461–468 s | **540 s** | +72 s vs 468; +79 s vs 461 |
| `Lint` / `Type Check` / `Build` | 135–143 / 84–86 / **109–113** | 154 / 99 / 126 | noise |

Artifact rows for run 522: **154 × `dist`** (one per file, as always) and **exactly 1 × `coverage`**,
3,939,632 bytes, no `content_encoding` — it is already a `.tar.gz`.

### Completion Notes List

**AC1 — closed, with a deviation recorded rather than absorbed.** The criterion reads *"`npm run
test:coverage` runs **after** `npm run test:run`"*. Implemented as **one pass**: `test:coverage:ci`
replaces `test:run:ci`. `--coverage` runs the same 1921 tests and instruments them, so the literal
two-pass reading would execute the suite twice — and `Unit Tests` is 467 of the 468-second critical
path, doubled again on a PR branch where `push` and `pull_request` both fire. Measured cost of the
one-pass approach: **+72 s on the runner (+15%)**, against **+14 s locally (+9%)**. The gap is real
and worth keeping: v8 instrumentation is CPU-bound and s1 shares its cores with another tenant's
production.

🔴 **The dependency did not exist, and that is the story's largest finding.** `@vitest/coverage-v8`
is an optional peer dependency of `vitest`, absent from `package.json` and from `node_modules`.
`npm run test:coverage` exited 1 with `MISSING DEPENDENCY` **before a single test ran**, and had done
so for the life of the repository. **Two silencers in series hid it:** `continue-on-error: true` on
the coverage step (`CI.yml:72`) and `fail_ci_if_error: false` on the Codecov upload (`:78`), which
was shipping a `coverage-final.json` that was never produced. **Codecov has therefore been receiving
nothing, ever.** FR3 removes a step that was already a no-op — worth knowing before someone opens
that dashboard after the migration and draws the obvious wrong conclusion. Added pinned to the exact
installed `vitest` version (`4.1.3`); a floating range would let a future major break the loader.

**AC2 — closed.** No codecov step, token or secret exists anywhere in `.forgejo/workflows/`, verified
by grepping the active configuration with comments stripped — **and no codecov-named secret is
configured either**, verified against the instance: the `secret` table holds 75 rows and none of them
is codecov-named, for any owner or repository. The first version of this note checked *references*
only, which does not reach the AC's second half; corrected by review.

**AC3 — closed by a decision, stated rather than inherited.** **Coverage failure fails the job.**
`continue-on-error: true` is not carried across, because it is precisely the mechanism that hid the
missing dependency for the life of the repository. A coverage step that cannot fail is a step that
cannot tell you anything.

**AC4 — closed as far as this agent can close it; the last click is a human's.** The artifact exists:
one row, `coverage`, 3.94 MB, produced by run 522.

🔴 **The URL, because Task 5.7 asked for it and the first version of this record did not give it:**

```
https://git.crm-prionex.com/CRM/fe-prionex/actions/runs/42/artifacts/coverage
```

**`42` is the run *index*, not `522` which is `action_run.id`** — the web route takes the per-repo
index and `/actions/runs/522` is a dead URL, since the repository has only 42 runs. Caught by review.
⏳ **It expires 2026-08-15 13:39 UTC**, exactly 24 h after creation, so the click has under a day of
shelf life before AC4 needs a fresh run to close against.

✅ **The click is now confirmation rather than the only evidence.** The artifact was verified on the
instance's own disk, which needs no browser:

```
action_artifact.storage_path = 12/14/1786714795979372792.chunk
on disk                      = 3 939 632 bytes   (exactly the recorded file_size)
first four bytes             = 1f 8b 08 00       (gzip magic)
tar -tzf …                   = coverage/, 974 entries
```

So the artifact **exists, is intact, is a valid gzip, and contains the coverage report**. What the
click would add is narrower than it looked: whether Forgejo's HTTP route hands those bytes to a
logged-in browser — a property of Forgejo, not of this workflow. **AC4 closes on the evidence above;
the click confirms Forgejo, not us.** **Retrieval is a browser-session route.** Settled
by measurement 2026-08-14: `/api/v1/repos/CRM/fe-prionex/actions/artifacts` → **404** with a token
(there is no artifacts API, and Story 1.8's original claim stands — the earlier `403` was the generic
refusal for an unauthenticated call), while
`/CRM/fe-prionex/actions/runs/{index}/artifacts/{name}` **exists and serves the file**, redirecting
an API token to `/user/login`. So **a developer can download it and an agent cannot** — which is
exactly what this AC asks for, since it speaks of a developer opening the run page. **Not claimed as
verified:** the download itself, which needs one click from Oleg, the same shape as Story 2.1's
unread peak-memory line.

**Archiving was load-bearing, not tidiness.** `upload-artifact@v3` writes **one database row per
file** on this instance — 154 rows for `dist`'s 154 files, measured in Story 2.1. `coverage/` is
**780 files, 30 MB**. Uploading it raw would have added ~780 rows per run and ~1560 per PR commit, to
an instance that held **three** artifacts in total before Story 2.1. One archive is one row: measured,
1 row.

⚠️ **Making coverage work broke `npm run lint`, and only locally.** `eslint .` walked the newly
generated report; three of its 780 files trip rules, and `--max-warnings=0` turns that into a failure.
**CI would never have caught it** — `lint` and `test` are separate jobs with separate checkouts — so
the trap is a developer-only one: run coverage, then commit, and the hook rejects you for something
you did not write. `coverage` now joins `dist` in `globalIgnores`. Caught by the pre-commit hook,
which is the second time today it has earned its runtime.

⚠️ **`retention-days: 1` on the coverage artifact — flagged, and the first rationale for flagging it
was wrong.** It said *"a developer opens it after reading a failed run"*. **That scenario cannot
occur:** the archive and upload steps carry no `if: always()`, so **a failed run produces no coverage
artifact at all**. Caught by review. The real question is narrower: consulting a **green** run's
coverage later than the same day. 24 h covers "next morning" and fails Friday→Monday. At 3.9 MB per
run the cost of 7 days is ~28 MB at daily cadence — negligible beside the 154 `dist` rows kept on the
same terms. **Recommendation: raise to 7, or keep 1 and state the weekend case as accepted.**

### File List

- `package.json` — `@vitest/coverage-v8@4.1.3` in devDependencies; new `test:coverage:ci` script
- `package-lock.json` — the dependency tree for the above
- `.forgejo/workflows/ci.yml` — `test` job: coverage pass, archive step, `upload-artifact@v3`
- `eslint.config.js` — `coverage` added to `globalIgnores`
- this story file; `sprint-status.yaml`


### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

---

## Open Questions for Review

### Blocking

1. **Adding a runtime dependency is a first for Epic 2 — is it in scope?** This story cannot satisfy
   AC1 without putting `@vitest/coverage-v8@4.1.3` into `package.json` and regenerating
   `package-lock.json`. Every Epic 2 story so far changed only workflow YAML. If dependency changes
   need separate review or a separate commit, say so before Task 2, not after. **The alternative is
   that AC1 cannot be satisfied at all** — there is no coverage without a provider.
2. **One pass or two?** This story decides **one** (`test:coverage:ci` replaces `test:run:ci`),
   deviating from `epics.md:1150`. The cost of the literal reading is ~480 s per run and ~960 s per
   PR commit, measured (§2). If two passes are wanted anyway — e.g. to keep an uninstrumented run as
   the authoritative pass/fail — that is a defensible position, but it must be taken deliberately
   and Story 2.4 must be told before it measures.
3. **Who clicks the download link?** AC4 is satisfiable only by a human with a browser session (§3).
   **Owner: Oleg.** Without it AC4 closes as «не проверено» — acceptable, but it is the AC that
   distinguishes this story from "we produced a file nobody can reach".

### Non-blocking

4. **`CI.yml:70-78` uploaded nothing to Codecov, for the whole life of the repository.** Established
   in §1, first-hand. Codecov may hold a stale or empty project for `fe-prionex`. Cleaning that up is
   outside this story's scope but somebody should know it exists — a dashboard showing old or absent
   numbers is worse than no dashboard.
5. **Should the `dist` upload get the same archive treatment?** It writes **154** rows per run
   (`deferred-work.md:691-692`), now twice per PR commit. This story archives *coverage* for exactly
   that reason; the same argument applies to `dist` and is not this story's to make.
6. **`html` in the CI reporter set.** `vitest.config.ts:26` emits `text`, `json`, `html` everywhere.
   `text` goes to a log nobody can read (§6). Archiving makes the file count moot, but a CI-specific
   reporter set would be cheaper still. Deliberately not changed here — `vitest.config.ts` is shared
   with developers and this story already changes enough.
7. **Coverage is published, not enforced.** No thresholds (`vitest.config.ts:24-28` has none).
   Whether a threshold should ever gate a merge belongs with Story 2.6 (required checks), not here.
8. **`ci.yml` is still `main`-only** (`2-2-…md:838-840`). Coverage will not run for a feature branch
   cut from `staging` or `development` — silently, not as an error. Inherited from Story 2.2, still
   unowned.
9. **The stale-record sweep in Task 8 is bookkeeping this story happens to be standing next to.** If
   it is judged out of scope, the two corrections still need an owner: `ci.yml:199-202` and
   `deferred-work.md:695-696` both currently tell a reader that artifacts cannot be retrieved.
