---
baseline_commit: 54c6faae
---

# Story 1.2: Record the Migration Decisions and the Option C Technical Debt

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a tech lead,
I want the locked phase-0 decisions and their consequences written down in the repository,
so that every later story is built on a stated contract rather than on recollection.

## Acceptance Criteria

**AC1 — the Option C decision and what it costs are stated**

**Given** blocker 1.1 has been resolved as Option C
**When** the decision record is written
**Then** it states that Vite variables stay build-time baked, that a distinct image is built
per environment, and that PROD does not receive the artifact validated on PRE-PROD
**And** it names the violated principle explicitly ("PROD receives the exact version validated
in PRE-PROD").

**AC2 — the degraded guard and its remediation are recorded**

**Given** Option C degrades the phase-7 promotion guard
**When** the record is written
**Then** it documents that the guard can only assert commit identity via `preprod-<sha>`, not
image identity
**And** it records the runtime-config approach (Option A) as the tracked remediation with the
work it would require.

**AC3 — the record is discoverable**

**Given** the decision record exists
**When** a developer opens the repository documentation
**Then** the record is discoverable from `docs/` and linked from the migration plan.

**AC4 — the remaining locked phase-0 decisions are in the same record**

> Derived from the story title ("the Migration **Decisions**", plural) and the phase-0 DoD in
> [docs/forgejo-migration.md:122](docs/forgejo-migration.md#L122) — *«решения по п.1.1 и п.3
> зафиксированы письменно»*. Not present in the epic's AC list, which covers only blocker 1.1.
> Included because Stories 1.3, 1.6, 1.12, 4.1, 5.1 and 6.2 each cite one of these as already
> settled, and none of them records it.

**Given** blockers 1.2, 1.3 and the secret-migration map are already settled in `epics.md`
**When** the record is written
**Then** each is captured as a short decision entry with its consequence and the story that
implements it
**And** the 2026-08-07 "no action on GitHub" decision is captured the same way, with a pointer
to the sprint change proposal.

## Tasks / Subtasks

- [x] **Task 1 — Create `docs/migration-decisions.md`** (AC: 1, 2, 3, 4)
  - [x] Path is `docs/migration-decisions.md`. Flat under `docs/`, beside
        `forgejo-migration.md`. Do **not** invent an `docs/adr/` or `docs/decisions/` tree —
        the repository has no ADR convention (`docs/` holds `forgejo-migration.md` and
        `superpowers/specs/` only), and Stories 6.5 and 7.3 both link back to "the Option C
        technical debt record from Story 1.2" as one document.
  - [x] **Write it in Russian.** `docs/forgejo-migration.md` is entirely Russian and this
        record sits beside it and is linked from it. Technical identifiers
        (`preprod-<sha>`, `VITE_API_BASE_URL`, workflow names) stay verbatim in English.
        This mirrors Story 1.1 Task 5.
  - [x] Give every decision a **stable heading anchor** — later stories link to individual
        entries, not to the file as a whole. Suggested structure:
    ```
    # Решения по миграции на Forgejo

    > назначение файла, дата, связь с docs/forgejo-migration.md

    ## D1. Блокер 1.1 — вариант C: сборка под каждую среду       (AC1)
    ## D2. Гейт промоушена: идентичность коммита, не образа      (AC2)
    ## D3. Технический долг: переход на вариант A (runtime-config) (AC2)
    ## D4. Блокер 1.2 — параметризация стендов и сеть preprod    (AC4)
    ## D5. Блокер 1.3 — организационный апрув PROD               (AC4)
    ## D6. Перенос секретов и переменных                          (AC4)
    ## D7. 07.08.2026 — никаких действий на стороне GitHub        (AC4)

    ## Журнал изменений
    ```
  - [x] Each entry carries: **Решение / Контекст / Последствия / Кто это реализует** (story
        numbers) — so a reader lands on the decision, not on prose.

- [x] **Task 2 — Write D1: the Option C decision** (AC: 1)
  - [x] State the three consequences literally, all four required by AC1:
    - Vite variables stay baked in at build time — `Dockerfile.prod:19-22` keeps its
      `ARG VITE_API_BASE_URL` / `ARG VITE_WS_URL` contract unchanged, no `entrypoint.sh`
      runtime-config layer is introduced.
    - A **distinct image per environment** — one commit yields up to three images
      (`dev` / `preprod` / `prod`), so tags need an environment discriminator
      (e.g. `sha-<short>-prod`). Tag scheme itself is decided in Story 3.2/3.3, not here.
    - **PROD does not receive the artifact validated on PRE-PROD** — it receives a rebuild of
      the same commit.
    - Name the violated principle **verbatim**: *"PROD receives the exact version validated in
      PRE-PROD"*. AC1 requires the explicit wording, not a paraphrase. Also note the related
      one from the same source: *"Rebuilding the application specifically for the production
      deployment is discouraged"*.
  - [x] State **why C and not A/B** — do not just assert the outcome. From
        [docs/forgejo-migration.md:60-75](docs/forgejo-migration.md#L60-L75): A is the
        recommended target but is application work; B was reassessed as *not cheaper than A*
        (three socket.io hooks call `io(WS_URL)` with no `path` option, so relative paths
        break them); C is the compromise that unblocks the migration now.
  - [x] Record it as **tracked debt, not a closed decision** — NFR11 in `epics.md` says
        "accepted, documented, and tracked as technical debt".

- [x] **Task 3 — Write D2: what the promotion guard can and cannot prove** (AC: 2)
  - [x] The guard (Story 6.5, FR16) extracts the commit SHA from `image_tag` and checks that
        `preprod-<sha>` exists in the registry.
  - [x] Say plainly what that buys: it proves **the commit** passed PRE-PROD. It cannot prove
        **the artifact** did, because the PROD image is a separate build and is byte-different.
  - [x] Name the residual risk concretely: a difference in build-time variables, in the build
        environment, or in a transitively resolved dependency can reach production without
        having been exercised on PRE-PROD. A green PRE-PROD validation is evidence about the
        source, not about the bytes that ship.
  - [x] Note the guard is skipped on `rollback: true` (by design — any previously deployed
        prod tag must always be restorable).
  - [x] Leave the entry **explicitly open for update by Story 6.5** — its AC5 says the record
        "is updated to describe the guard as implemented". Add a line like
        `Статус: спроектировано, не реализовано — обновить в story 6.5` so the later story has
        an obvious edit point.

- [x] **Task 4 — Write D3: Option A as the tracked remediation, with the actual work** (AC: 2)
  - [x] Describe the mechanism from the plan: `entrypoint.sh` in the nginx stage generates
        `/config.js` from container env vars, `index.html` loads it before the bundle, code
        reads `window.__APP_CONFIG__` with a fallback to `import.meta.env`. One image for all
        environments → genuine promotion and instant rollback.
  - [x] Enumerate the work it would require. **Use the verified surface below, not the
        plan's two-variable assumption** — the plan names only `VITE_API_BASE_URL` and
        `VITE_WS_URL`, but the code has four build-time env vars:

    | Variable | Call sites | Note |
    |---|---|---|
    | `VITE_API_BASE_URL` | `src/lib/api.ts:5`, `src/features/calls/api/callService.ts:16`, `src/features/dialer/api/dialerHttpService.ts:17`, `src/features/auth/hooks/useTabTracker.ts:153` | passed as `--build-arg` today |
    | `VITE_WS_URL` | `src/features/calls/hooks/useCallWebSocket.ts:14`, `useCallStateUpdates.ts:13`, `useIncomingCall.ts:8`, `src/features/dialer/hooks/useDialerSocket.ts:9`, `src/features/notifications/hooks/useNotificationSocket.ts:8` | passed as `--build-arg` today |
    | `VITE_OPERATOR_PHONE_URL` | `src/features/operatorPhone/constants.ts:9` | **never passed by `CD.yml`** — empty in every deployed bundle |
    | `VITE_EASYPAY_PORTAL_API_KEY` | `src/features/easypay/api/easypayApi.ts:25` | **never passed by `CD.yml`** — empty in every deployed bundle |

  - [x] `VITE_BUILD_TS` is **not** in that list: it is injected by `vite.config.ts:8` via
        `define` from `Date.now()`, not from the environment. Do not list it as an env var to
        plumb.
  - [x] Record the two unpassed variables as a **separate finding**, not as part of the Option A
        work: `CD.yml:110-112` passes only two of the four, so `VITE_OPERATOR_PHONE_URL` and
        `VITE_EASYPAY_PORTAL_API_KEY` resolve to their in-code defaults (`http://localhost:5173`
        and `''`) in production today. Both are declared in `.env.example:39,73`. This is a
        pre-existing defect independent of Option C; state it and leave it — fixing it belongs
        to Story 3.3 (which owns build-args and the no-silent-fallback rule, NFR8).
  - [x] Also list the non-obvious parts of the Option A work: every call site currently uses the
        pattern `import.meta.env.X !== undefined ? … : '<localhost default>'`, so the localhost
        defaults have to go at the same time (NFR8 — a missing value must fail loudly, not ship
        a bundle pointed at localhost); `src/test/setup.ts:10` stubs env via `vi.stubEnv` and
        would need a parallel mechanism; and `docker-compose.server.yml` would gain the
        per-stand env plumbing the images no longer carry.
  - [x] State the condition under which the debt is paid: no owner and no date are assigned by
        this plan. Write that down rather than implying a schedule that does not exist.

- [x] **Task 5 — Write D4-D7: the remaining locked decisions** (AC: 4)
  - [x] **D4 — blocker 1.2.** `container_name: fe-prionex` and `name: fe-prionex`
        (`docker-compose.server.yml:4,9`) are hardcoded and port `8080` is the default
        (`docker-compose.server.yml:11`), so two stands cannot coexist on s1. Decision:
        parameterize `COMPOSE_PROJECT_NAME` / `CONTAINER_NAME` / `FRONTEND_PORT`, separate
        directories `~/crm-prionex/fe-prionex-dev/` and `-preprod/`, DEV on `8082`, PRE-PROD on
        `8081`, and a dedicated `crm-network-preprod` with its own Kong. Consequence if the
        network is shared: `nginx.conf:37-56` resolves `crm-kong-gateway` by name, so the
        PRE-PROD frontend would silently talk to the DEV backend and PRE-PROD validation would
        be fictional. Implemented by Stories 4.1, 4.2, 1.6, 5.1, 5.2.
  - [x] **D5 — blocker 1.3.** Forgejo has no equivalent of GitHub Environments with required
        reviewers, and no per-workflow permissions: anyone with write access can dispatch
        `deploy-prod.yml`. Decision: **there is no technical approval gate for PROD** (NFR9).
        The control is organizational, plus the one technical barrier from D2. Written into the
        regulation by Story 6.2 and into the docs by Story 7.3.
  - [x] **D6 — secrets and variables.** The map from
        [docs/forgejo-migration.md:225-235](docs/forgejo-migration.md#L225-L235): `REGISTRY_TOKEN`
        (org, `ci-bot`, `write:package`), `S1_SSH_*` (repo), `S2_SSH_*` (repo, **new** key —
        the old one is not revoked until phase 8, NFR7), `SLACK_CD_WEBHOOK_URL` (org). Ports are
        deliberately **not** migrated into CI variables — they already live in each stand's
        server `.env`. The `CD.yml:47-74` URL fallbacks are dropped on migration (NFR8). Under
        Option C, `VITE_API_BASE_URL_PREPROD` / `VITE_WS_URL_PREPROD` must be added alongside
        the existing `_DEV` / `_PROD` pairs. Implemented by Story 1.12. Worth one line of
        accuracy: `CD.yml` reads these through the `secrets.` context today, while `epics.md`
        calls them repo *variables*; Story 1.12 decides which they become in Forgejo.
  - [x] **D7 — no action on GitHub (07.08.2026).** No workflow, setting, secret, credential or
        registry on GitHub is touched by this plan, and the GitHub transition is owned outside
        it. Consequences to record: six stories cancelled (1.1, 1.4, 1.5, 6.1, 7.1, 7.4); the
        `v*` tag bypass stays open on the live GitHub CD; two pipelines can reach production;
        Forgejo may test code the team is not writing; the rollback horizon resets at cutover
        because pre-migration images live in ghcr and are unreachable; Story 7.5 (server-side
        key rotation) becomes the only surviving security control. Link
        `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-07.md` for the full
        list rather than restating all eight risks.

- [x] **Task 6 — Link the record from the migration plan** (AC: 3)
  - [x] `docs/forgejo-migration.md` §1.1, after the "**Рекомендация: A.**" line
        ([docs/forgejo-migration.md:73-75](docs/forgejo-migration.md#L73-L75)): replace/extend
        "**Решение нужно принять в фазе 0**" with the fact that it **has been taken** — вариант
        C — plus a link to `migration-decisions.md#d1`. Right now the plan still reads as if
        the blocker is open; that is the single most misleading line in the document for anyone
        starting Epic 3 or 6.
  - [x] `docs/forgejo-migration.md` §2 Фаза 0, item 1 ([line 115](docs/forgejo-migration.md#L115))
        and the DoD line ([line 122](docs/forgejo-migration.md#L122)) — point both at the record.
  - [x] `docs/forgejo-migration.md` §7 "Что осознанно не делаем" — add the Option C compromise
        (rebuild per environment instead of artifact promotion) with a link to `#d3`. That
        section is exactly where a reader looks for "what we knowingly skipped".
  - [x] Consider a one-line pointer near the top of `docs/forgejo-migration.md` (after the
        status block) so the record is reachable without scrolling to §1.1.
  - [x] Do **not** rewrite the plan's §1.1 analysis of options A/B/C. It stays as the reasoning
        of record; the new file states the outcome and links back.

- [x] **Task 7 — Verify and commit** (AC: 1, 2, 3, 4)
  - [x] Walk each AC against the written file, phrase by phrase. AC1 in particular requires the
        principle quoted **explicitly** — grep for it: `grep -n "exact version validated" docs/migration-decisions.md`.
  - [x] Check every relative link resolves and every anchor exists (heading anchors are
        generated from Cyrillic headings — prefer explicit short slugs like `## D1. …` so
        `#d1` works predictably; verify in a renderer rather than assuming).
  - [x] Check every file:line reference cited in the record against the actual file — the
        reference table above was verified at `54c6faae`; if the dev agent restates any of it,
        it must re-verify rather than copy.
  - [x] Commit with the repository's conventional-commit style, e.g.
        `docs(migration): record the phase-0 decisions and the Option C technical debt`.
  - [x] Nothing here needs a Forgejo or GitHub round-trip. Unlike Story 1.1, this story is
        fully completable in the repository — there is no blocked AC.

## Dev Notes

### What this story produces

One new Markdown file and edits to one existing Markdown file. **No code, no workflow, no
infrastructure.** If the implementation touches anything under `src/`, `.github/`, `.forgejo/`,
`Dockerfile*`, `docker-compose*` or `nginx.conf`, it has gone out of scope.

The value is that four later stories stop depending on recollection:

| Consumer | What it needs from this record |
|---|---|
| Story 3.3 | "no runtime-config entrypoint is introduced, consistent with the Option C decision recorded in Story 1.2" |
| Story 6.5 | updates the record to describe the promotion guard as implemented; the remediation stays open |
| Story 6.9 | restates the Option C deviation in the release documentation at cutover |
| Story 7.3 | `docs/deployment.md` links the Option C technical debt record from Story 1.2 |

That is why headings need stable anchors and why D2 must be written as an entry someone will
later edit, not as a finished narrative.

### Why the record is written in Russian

`docs/forgejo-migration.md` is Russian end to end, the new file sits beside it and is linked
from it, and Story 1.1 Task 5 already set this precedent for `docs/`. The BMAD config sets
`document_output_language: English` — that governs BMAD artifacts under `_bmad-output/`
(this story file, `epics.md`), not the project's own `docs/`. Keep identifiers, tag names,
variable names and workflow filenames in English inside the Russian text.

### Files being modified

**`docs/migration-decisions.md`** — NEW. The deliverable.

**`docs/forgejo-migration.md`** — UPDATE, 289 lines, Russian, tracked since commit `11797882`.
Current state and what must be preserved:

- §0 / §0.1 — the current-state inventory and the CD tag-gate finding, extended by Story 1.1.
  Do not touch; D7 links to the sprint change proposal, it does not restate §0.1.
- §1.1 (lines 56-75) — the A/B/C analysis. **Preserve in full.** It is the reasoning behind D1
  and the source for the Option B reassessment. Only the trailing "решение нужно принять"
  line changes.
- §1.2, §1.3, §1.4 — sources for D4, D5 and (indirectly) Story 1.3. Unchanged.
- §2 Фаза 0 (lines 113-122) — items 1 and the DoD gain links. Items 4 and 5 describe work now
  cancelled (Stories 1.4 and 1.5); leaving them stale is acceptable for this story, but if
  they are touched, mark them cancelled rather than deleting the text.
- §3 (lines 225-235) — the secret map, source for D6. Unchanged.
- §5 Риски — already lists "Промоушен образа невозможен без п.1.1 → при C задокументировать
  компромисс". That mitigation is what this story delivers; it may gain a link.
- §7 (lines 283-290) — gains the Option C entry.

### Verified repository facts (checked at `54c6faae`)

These are the load-bearing claims the record makes. They were verified against the working
tree; cite them with confidence.

```
Dockerfile.prod:19-22        ARG VITE_API_BASE_URL / ARG VITE_WS_URL → ENV → npm run build
                             (build-time bake; stage 2 is nginx:alpine with no entrypoint)
CD.yml:110-112               build-args: only VITE_API_BASE_URL and VITE_WS_URL
CD.yml:42-74                 set-api-url — branches on github.ref, silent fallback to PROD URLs
docker-compose.server.yml:4  name: fe-prionex            (hardcoded)
docker-compose.server.yml:8  image: ${DOCKER_IMAGE:-ghcr.io/crm-prionex/fe-prionex:latest}
docker-compose.server.yml:9  container_name: fe-prionex  (hardcoded)
docker-compose.server.yml:11 "${FRONTEND_PORT:-8080}:80"
vite.config.ts:8             define: 'import.meta.env.VITE_BUILD_TS' = Date.now()  (not an env var)
src/**                       4 build-time VITE_* env vars, 19 import.meta.env references total
.env.example:39,73           VITE_OPERATOR_PHONE_URL, VITE_EASYPAY_PORTAL_API_KEY declared
```

Note on `docker-compose.server.yml:8`: the default image reference still points at **ghcr**.
Not this story's problem (Story 4.1 parameterizes the compose file), but it is a concrete
illustration for D7 — the ghcr coupling is still present in the repository.

### Anti-patterns for this story

- **Do not re-open blocker 1.1.** The decision is Option C, locked in `epics.md` front-matter
  (`blocker_1_1`) and in the Overview. The record documents it; it does not relitigate it. If
  the evidence gathered while writing suggests A is now cheaper, note it in D3 as input to the
  remediation — do not change the decision.
- **Do not write `docs/deployment.md`.** That is Story 7.3, at the end of Epic 7.
- **Do not create an ADR framework.** One file, seven entries. No template scaffolding, no
  `docs/adr/README.md`, no numbering scheme beyond `D1…D7`.
- **Do not decide what `latest` means.** That is Story 3.3's fourth AC.
- **Do not add the `_PREPROD` repository variables.** D6 records that they are needed; Story
  1.12 creates them.
- **Do not restate all eight accepted risks from the sprint change proposal in D7.** Link it.
  Duplicated risk lists drift apart.
- **Do not fix `VITE_OPERATOR_PHONE_URL` / `VITE_EASYPAY_PORTAL_API_KEY`.** Record the finding,
  hand it to Story 3.3.

### Previous story intelligence (Story 1.1, cancelled)

Story 1.1 is `cancelled`, but three of its findings carry directly into this one:

1. **A repository-side change is not a deployed change.** 1.1's ACs failed because
   `.github/workflows/CD.yml` only takes effect on GitHub. This story has no such exposure —
   its deliverable *is* a repository file — but D7 exists precisely to make that asymmetry
   explicit for everyone after.
2. **`docs/` is Russian.** 1.1 Task 5 wrote §0.1 in Russian and committed the previously
   untracked `docs/forgejo-migration.md`. Follow it.
3. **The pre-commit hook may not run in this clone.** 1.1's completion notes correct its own
   Dev Notes: `node_modules` is absent, `core.hooksPath` is unset and `.git/hooks/pre-commit`
   does not exist, so `.husky/pre-commit` did not fire. Immaterial here — see Testing standards.

Its commit sequence is also the model for this one: `09591984` (the change) then `11797882`
(`docs(migration): record the CD tag-gate finding and its resolution`).

### Git intelligence

Recent commits on `fix/cd-close-tag-gate-bypass`:

```
54c6faae  chore(bmad): track BMAD configuration and planning artifacts
11797882  docs(migration): record the CD tag-gate finding and its resolution
09591984  fix(cd): close the tag-based production gate bypass
e6ecfced  Merge pull request #871 …          ← last commit before the migration work
```

Conventional commits with a scope, imperative mood, lowercase subject. `docs(migration): …` is
the established scope for this document set. The branch is `fix/cd-close-tag-gate-bypass` —
carried over from Story 1.1; branching for this story is the dev agent's call, but note that
`main` is the default PR target.

### Testing standards

No automated test covers Markdown in `docs/`. `npm run lint` is ESLint over the source tree
and `format:check` is `prettier --check "src/**/*.{ts,tsx,css,json}"` — neither matches `.md`,
and neither matches `docs/`. There is no `.prettierignore` and no `lint-staged` config.

`.husky/pre-commit` runs the full CI-parity suite (`format:check`, `lint`, `typecheck`,
`test:run`) on **every** commit including documentation-only ones, so expect several minutes
if `node_modules` is installed — and per Story 1.1, nothing at all if it is not. Do not bypass
with `--no-verify`.

Verification for this story is therefore **review against the ACs**, done in Task 7: each AC
clause traced to a specific line of the written record, plus link and anchor resolution. There
is nothing to observe on a server and nothing to run.

### Latest technical information

None required. This story introduces no dependency, library, action or platform feature; every
technical claim it records is already established in `epics.md` and `docs/forgejo-migration.md`
or verified above against the working tree. The version-sensitive unknowns in this migration
(Forgejo `concurrency` support, `actions/upload-artifact@v4` on Forgejo) belong to Story 1.3
and must not be pre-answered here — the record states them as open, not as resolved.

### Project Structure Notes

- `docs/` is the project knowledge root (`project_knowledge` in `_bmad/bmm/config.yaml`) and
  currently holds `forgejo-migration.md` plus `superpowers/specs/`. Flat placement, no
  subdirectory.
- `docs/forgejo-migration.md` serves as **both PRD and Architecture** for this migration.
  There is no `architecture.md`, no `prd.md` and no UX artifact in
  `_bmad-output/planning-artifacts/` — `epics.md` plus that document are the complete contract.
  UX is explicitly not applicable (`epics.md` § UX Design Requirements).
- BMAD artifacts live under `_bmad-output/` because `{output_folder}` is unresolved in
  `_bmad/bmm/config.yaml`; `_bmad/` and `_bmad-output/` were brought under version control in
  `54c6faae`. Keep BMAD artifacts there and project documentation in `docs/` — the record
  being produced here is project documentation.
- `docs/superpowers/specs/` is an unrelated design-spec area. Do not add to it.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2] — user story and AC1-AC3
- [Source: _bmad-output/planning-artifacts/epics.md#Overview] — "Locked decision (Blocker 1.1 = Option C)"; `[C]` marking convention
- [Source: _bmad-output/planning-artifacts/epics.md#NonFunctional Requirements] — NFR11 (promotion principle violated, tracked as tech debt), NFR9 (no technical PROD gate), NFR8 (no silent URL fallbacks), NFR7 (old s2 key not revoked until phase 8)
- [Source: _bmad-output/planning-artifacts/epics.md#Functional Requirements] — FR16 (guard by commit SHA), FR17 (rebuild on release path), FR8 (per-environment build-args)
- [Source: _bmad-output/planning-artifacts/epics.md#Additional Requirements] — `Dockerfile.prod` build-time contract unchanged; `_PREPROD` variables to be added
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.3] — "no runtime-config entrypoint is introduced, consistent with the Option C decision recorded in Story 1.2"
- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.5] — AC5: this record is updated to describe the guard as implemented
- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.3] — `docs/deployment.md` links this record
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-07.md] — the no-GitHub-action decision, cancelled stories, eight accepted risks (D7)
- [Source: docs/forgejo-migration.md#1.1] — blocker 1.1, options A/B/C, the Option B reassessment
- [Source: docs/forgejo-migration.md#1.2] — stand collision on s1, `crm-network-preprod` (D4)
- [Source: docs/forgejo-migration.md#1.3] — no approval gate in Forgejo (D5)
- [Source: docs/forgejo-migration.md#2] — Фаза 0, items 1 and 6, and its DoD (AC4, Task 6)
- [Source: docs/forgejo-migration.md#3] — secret and variable migration map (D6)
- [Source: docs/forgejo-migration.md#7] — "Что осознанно не делаем", gains the Option C entry
- [Source: _bmad-output/implementation-artifacts/1-1-close-the-tag-based-production-gate-bypass-in-the-current-github-cd.md] — Russian-docs precedent, husky finding, commit style
- [Source: Dockerfile.prod:19-22] — the build-time ARG contract Option C keeps
- [Source: .github/workflows/CD.yml:110-112] — build-args: two of four VITE_* variables
- [Source: vite.config.ts:8] — `VITE_BUILD_TS` is a `define`, not an env var
- [Source: docker-compose.server.yml:4,8,9,11] — hardcoded project/container name, ghcr default image, default port

## Dev Agent Record

### Agent Model Used

claude-opus-5[1m]

### Debug Log References

- **AC1 principle wording** — `grep -n "exact version validated" docs/migration-decisions.md` →
  line 43, quoted verbatim inside a blockquote together with the related
  *"Rebuilding the application specifically for the production deployment is discouraged"*.
- **Anchors** — 8 explicit `<a id="…"></a>` markers (`d1`…`d7`, `changelog`) at lines 24, 75,
  110, 161, 190, 210, 245, 281; all 8 are referenced from the in-file index and cross-links.
  Explicit HTML anchors were used instead of relying on generated Cyrillic heading slugs, which
  are not predictable enough to be depended on by four later stories.
- **Cross-file links** — both relative targets resolve (`./forgejo-migration.md`,
  `../_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-07.md`). The three
  deep-links into the plan were checked against its actual headings at lines 30, 58 and 227
  (`### 0.1.`, `### 1.1.`, `## 3.`) and follow the standard slug rules (punctuation dropped,
  `→` dropped leaving a double hyphen in the §1.1 slug).
- **Every cited `file:line` re-verified** by reading the line rather than trusting the story's
  Dev Notes: `Dockerfile.prod:19,22`, `CD.yml:110,112`, `docker-compose.server.yml:4,9,11`,
  `vite.config.ts:8`, `src/lib/api.ts:5`, `operatorPhone/constants.ts:5,9`,
  `easypayApi.ts:25`, `useDialerSocket.ts:9`, `useCallWebSocket.ts:14`, `test/setup.ts:11`,
  `.env.example:39,73`, `nginx.conf:37` (the `/ws/` block closes at 56, so the cited `37-56`
  range is exact).
- **One citation corrected during verification.** Dev Notes and `epics.md` variously cite the
  `set-api-url` fallbacks as `CD.yml:42-74` / `47-74` / `42-79`. The step actually spans
  lines 40-77 (`- name:` at 40, last `$GITHUB_OUTPUT` echo at 77, next step at 79). D6 cites
  `CD.yml:40-77`.
- **No test suite involvement.** Nothing under `src/` changed; `npm run lint` (ESLint over the
  source tree) and `format:check` (`prettier --check "src/**/*.{ts,tsx,css,json}"`) match no
  `.md` file and no path under `docs/`. Per the story's Testing standards, verification is the
  AC walk-through recorded above.
- **Pre-commit hook did not run**, as anticipated by Story 1.1's correction: `node_modules` is
  absent, `core.hooksPath` is unset and `.git/hooks/pre-commit` does not exist. Immaterial —
  the hook's four checks cover none of the changed files.

### Completion Notes List

**Delivered — all four ACs satisfied.**

- **AC1** — `docs/migration-decisions.md` D1 states all three consequences (build-time bake
  kept via `Dockerfile.prod:19-22` with no `entrypoint.sh` layer; a distinct image per
  environment, hence the tag discriminator; PROD receives a rebuild of the commit, not the
  validated artifact) and quotes the violated principle verbatim.
- **AC2** — D2 records what the guard proves (the **commit** passed PRE-PROD) against what it
  cannot (artifact identity), names the residual risk concretely, and notes the `rollback: true`
  skip. It carries an explicit `Статус: спроектировано, не реализовано — обновить в story 6.5`
  line so Story 6.5's AC5 has an obvious edit point. D3 records Option A as the tracked
  remediation with the work it requires.
- **AC3** — the record sits flat in `docs/` and is linked from the plan in seven places: the
  header pointer, §1.1, phase-0 item 1, phase-0 item 6, the phase-0 DoD, the §5 risk table and
  §7 "Что осознанно не делаем".
- **AC4** — D4 (blocker 1.2), D5 (blocker 1.3), D6 (secret map) and D7 (no action on GitHub)
  each carry decision, consequence and the implementing story. D7 links the sprint change
  proposal rather than restating its eight risks.

**Two findings that changed what the record says.**

1. **The Option A remediation surface is twice what the plan assumes.** The plan scopes it to
   `VITE_API_BASE_URL` and `VITE_WS_URL`; the code has four build-time env vars — the other two
   are `VITE_OPERATOR_PHONE_URL` (`operatorPhone/constants.ts:9`) and
   `VITE_EASYPAY_PORTAL_API_KEY` (`easypayApi.ts:25`). `VITE_BUILD_TS` was explicitly excluded:
   it is a `define` in `vite.config.ts:8` fed by `Date.now()`, not an environment variable.
   D3 carries the corrected table.
2. **Two of those four are not passed to the build at all.** `CD.yml:110-112` passes only
   `VITE_API_BASE_URL` and `VITE_WS_URL`, so `VITE_OPERATOR_PHONE_URL` and
   `VITE_EASYPAY_PORTAL_API_KEY` resolve to their in-code defaults (`http://localhost:5173` and
   `''`) in production today, despite both being declared in `.env.example:39,73`. This is a
   pre-existing defect independent of Option C. Per the story's scope boundary it was recorded
   and handed to Story 3.3 (which owns build-args and NFR8), **not** fixed here.

**One edit beyond the letter of Task 6, and why.** Task 6 called for updating the phase-0 DoD.
That DoD required "регламент разослан" — the interim regulation from Story 1.5, which is
cancelled. Rewriting the DoD to point at the new record while leaving it demanding cancelled
work would have produced a self-contradicting line, so phase-0 items 4 and 5 were struck
through and marked cancelled (with their answers preserved, per the story's instruction to mark
rather than delete). No other content of the plan was altered; §1.1's A/B/C analysis is intact.

**Nothing blocked.** Unlike Story 1.1, this story is fully completable inside the repository —
no GitHub or Forgejo round-trip was needed and no AC went unsatisfied.

**Not committed.** `_bmad-output/` changes are left in the working tree: `epics.md`,
`sprint-status.yaml` and the 1.1 story file carry uncommitted edits from the correct-course
workflow that predate this story, and `sprint-change-proposal-2026-08-07.md` is still untracked.
Committing this story's status updates would have entangled them. The deliverable itself —
`docs/migration-decisions.md` and the plan edits — is committed as `a87ec64d`.

### File List

- `docs/migration-decisions.md` — added (new, 287 lines)
- `docs/forgejo-migration.md` — modified (header pointer; §1.1 decision block; phase-0 items 1,
  4, 5, 6 and DoD; §5 risk table row; §7 new entry)
- `_bmad-output/implementation-artifacts/1-2-record-the-migration-decisions-and-the-option-c-technical-debt.md` — modified (status, task checkboxes, Dev Agent Record)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — modified (story status → review)
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-07.md` — brought under version
  control (authored by the earlier correct-course workflow, not by this story; committed here
  because D7 links it and the link was dead at `a87ec64d`)

### Change Log

| Date | Change |
|---|---|
| 2026-08-07 | `a87ec64d` — added `docs/migration-decisions.md` (D1-D7) and linked it from the migration plan |
| 2026-08-07 | `491e963e` — addressed code review findings: 1 medium, 3 low resolved |

## Senior Developer Review (AI)

**Reviewer:** Sonnet (independent agent) + two parallel adversarial passes (Blind Hunter, Edge Case Hunter)
**Date:** 2026-08-07
**Outcome:** Approve with fixes — no critical or high findings; all four ACs confirmed satisfied.

Independently verified and confirmed correct: all 24 markdown links, all 8 anchors, all three
generated heading slugs into the plan (hand-computed against GFM slug rules, including the
double hyphen left by the stripped `→`), every `file:line` citation against HEAD content, every
"implemented by Story N" attribution against `epics.md`, and the six cancelled stories and eight
risks in D7 against the sprint change proposal. No anti-pattern from Dev Notes was violated.

### Action Items

- [x] **[Med] Dead link at the commit that introduced it.** D7 linked
  `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-07.md`, which existed only in
  the working tree — untracked. Anyone checking out `a87ec64d` fresh got a 404 on the one D7
  claim not verifiable against code. Flagged independently by both adversarial passes. Fixed in
  `491e963e`: the file is now tracked. This was caused by the decision to keep `_bmad-output/`
  out of the deliverable commit; a committed document may not link into an uncommitted one.
- [x] **[Med] "Mark rather than delete" not followed literally.** Phase-0 items 4 and 5 in
  `docs/forgejo-migration.md` were struck through but also shortened, dropping the note that
  `pull_request` triggers do not fire across platforms — a detail recorded nowhere else. Fixed:
  both items now carry their original text intact inside the strikethrough.
- [x] **[Low] Overloaded numeral.** D7's list of cancelled stories put "1.1" two lines from
  other references to blocker 1.1 (Option C), inviting a reader to conclude the Option C
  decision had been cancelled. Fixed: each cancelled story now carries a short label, and D7
  states explicitly that these are story numbers, not plan section numbers.
- [x] **[Low] Reads as self-contradictory on first pass.** §1.1 ends "**Рекомендация: A**"
  immediately followed by the decision block choosing C. Fixed: the block now says "вопреки
  рекомендации выше".
- [x] **[Low] Imprecise grouping.** D3 attributed the `http://localhost:8005` default to "call
  hooks"; `useNotificationSocket.ts:8` carries it too. Fixed.
- [x] **[Low] Miscount in Completion Notes** — "linked from the plan in six places", listing
  seven. Fixed.

### Not actioned

None. Every finding raised was accepted and fixed.
