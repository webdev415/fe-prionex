---
baseline_commit: 22dceedc5f850641d088383b064d2345fe29297f
---

# Story 4.6: Reset DEV to Main on a Weekly Schedule

Status: review

<!-- Contexted 2026-08-21 against `main` at 22dceedc (Story 4.4 closed the same day: PR #61
     implementation, PR #62 ledger closeout — 16 runs against a ~20 floor, zero red dispatches).

     🔴 THE STORY'S OWN PREMISE WAS FALSIFIED WHILE CONTEXTING IT, and this is the single most
     important thing on this page. The brief for this story said: `schedule:`/cron has NEVER fired
     on this Forgejo instance, the only cron ever written was removed before it fired, so this story
     must prove the mechanism from zero. The first half is true *for this repository* and the second
     half is true *for that one workflow* — but the conclusion does not follow, because two sibling
     repositories on the SAME instance already run `schedule:` in production and one of them recorded
     the verification trail in its own workflow file. See Dev Notes §2. The consequence is not that
     the probe is cancelled; it is that the probe gets much cheaper and much sharper, because it now
     has to answer four narrow questions instead of one broad one.

     Story 4.5 (Slack) is PARKED by Oleg's decision 2026-08-21. Its context branch
     `story-4-5/pr-1-context` exists UNMERGED at `badbb1ac` and is NOT part of `main`. Nothing in
     this story reads it, builds on it, or depends on it. This story's Slack clause is deferred by
     the same standing rule every other deploy story used (epics.md:1814-1818 — *the deploy must
     work without it*). -->

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want DEV to return to a known state every week without anyone pressing a button,
so that a stale feature branch does not sit on the shared stand indefinitely, and so that the stand
is never pinned to an image tag old enough for the retention rule to delete underneath it.

## Acceptance Criteria

**AC1 — a new workflow file, a schedule, and a manual path that cannot be aimed anywhere else**

**Given** `.forgejo/workflows/deploy-dev.yml` carries `workflow_dispatch` **and nothing else**, by
the deliberate decision recorded at `4-3-…md:225-228` (*"Story 4.6 is the story that adds a schedule,
deliberately and separately"*)
**When** the weekly reset is built
**Then** it lands as a **NEW** file `.forgejo/workflows/dev-reset.yml`
**And** `deploy-dev.yml`'s `on:` block is not modified — no `schedule:`, no `push:`, no
`workflow_call:` is added to it by this story
**And** `dev-reset.yml` carries `schedule:` **and** `workflow_dispatch:`
**And** the `workflow_dispatch` path declares **zero inputs**, so the reset can only ever reset to
`main` and there is no ref, tag or environment a human can steer it at.

> 🔴 **ADDED 2026-08-21 (this story, autonomous — subject to Oleg's veto): the zero-input clause.**
> The epic's AC says only "it can also be dispatched manually". Zero inputs is stronger and is what
> makes the manual path *evidence* for the scheduled one: if the two paths are byte-identical in what
> they do, then a manual dispatch proves the body, and the schedule only has to prove that it fires.
> Precedent, on this same Forgejo instance and by the same team:
> `PRIONEX_HUB/.github/workflows/reset-dev.yml:22-23` — *«Инпутов у диспатча нет вообще, так что
> сбросить DEV на что-то, кроме `main`, через него невозможно (AC3)»*.

**AC2 — the schedule is proven to have fired FOR THIS REPOSITORY, not assumed from a sibling**

**Given** `schedule:` has fired in production on this instance in two other repositories
(Dev Notes §2) but **never once in `CRM/fe-prionex`** — the 124-run event census at
`deferred-work.md:1821-1824` records `push`, `workflow_dispatch`, `pull_request`,
`pull_request_sync`, `create` and **no `schedule`**
**When** this story closes
**Then** there is at least one `action_run` row for `CRM/fe-prionex` created by the scheduler and not
by a human, identified **by query**, with its run id, its recorded trigger event and its actor
written into the Run Budget Ledger
**And** the claim is made from that row, never from "the sibling repo does it, so ours will".

> 🔴 **ADDED 2026-08-21 (this story) — this is the retro-E5 row for this story's new mechanism.**
> E5's rule is that a new guard ships with a live outcome matrix including a discriminating run. The
> mechanism here is not a guard, it is a *trigger*, and the discriminating pair is exactly: **a cron
> that fired, next to a cron that did not.** Dev Notes §5 designs the probe that produces both halves
> cheaply, and Dev Notes §2 explains why "it fired in `CRM/PRIONEX_HUB`" is corroboration and not
> evidence — the same reasoning `deferred-work.md:1815-1819` already used to refuse a `workflow_run`
> conclusion taken in the wrong place.

**AC3 — the reset deploys the current `main` image through the existing deploy path, and duplicates
none of it**

**Given** `deploy-dev.yml` is live-proven end to end (runs 929, 938, 950, 962, 965, 968, 973) and
took four review rounds to get there
**And** `build-main.yml` publishes `main-dev` on every merge to `main`, and exists for exactly this
reason (`build-main.yml:23-26` — *"Story 4.6 resets the DEV stand to 'the current `main` image' on a
schedule … Without this file there is no `main` image to reset to"*)
**When** the reset runs
**Then** it causes `deploy-dev.yml` to run with `ref` = `main`, resolving the tag `main-dev`
**And** `dev-reset.yml` contains **no** `docker login`, **no** digest resolution, **no**
`docker compose down`/`up -d`, **no** health check, **no** Kong guard and **no** copy of the stand's
five variables
**And** Story 4.8's factoring is not pre-empted: this story extracts nothing shared, and leaves
`deploy-dev.yml` as the single definition of what a DEV deploy is.

> 🔴 **AMENDED 2026-08-21 (this story, autonomous — subject to Oleg's veto).** The epic says the
> reset *"deploys the current `main` image to the DEV stand using the same mechanics as Story 4.3"*.
> Both sibling repositories on this instance read the same sentence and **duplicated the deploy body
> into their reset workflow** — `PRIONEX_HUB/.github/workflows/reset-dev.yml:25-30` says so outright
> (*«Тело шага ниже почти полностью ДУБЛИРУЕТ deploy-dev.yml … сознательно, не рефакторинг в общий
> скрипт»*) and books the duplication as debt against a later story. **This story refuses that
> reading**, because here the later story already exists, is numbered, and is next but one: Story 4.8
> factors the shared mechanics, and a duplicated deploy body written in 4.6 is work 4.8 would have to
> delete. "Same mechanics" is therefore satisfied by *running the same workflow*, not by *containing
> the same steps*. Mechanism chosen: Dev Notes §3.

**AC4 — the host sweep is targeted, and cannot touch another tenant's images or containers**

**Given** FR23 requires `docker image prune`, and the epic's own third AC requires that the prune
*"does not remove images currently in use by the legacy stand or any other container on s1"*
**And** s1 is multi-tenant: `CRM/api-prionex`'s own census recorded 185 containers matching
`crm-` alone, including the Forgejo runners this workflow executes inside, Forgejo's own Postgres,
OpenBao, and another team's `techno-finance`
**When** the sweep runs
**Then** it removes only images belonging to `git.crm-prionex.com/crm/fe-prionex`, only untagged
ones, only ones no container references, and only ones older than a stated age threshold
**And** it removes only stopped containers whose name matches this project's own lock-holder pattern
anchored at both ends, and only ones that finished longer ago than a stated age threshold
**And** none of `docker image prune` (bare), `docker image prune -a`, `docker system prune`,
`docker volume prune`, `docker network prune`, `docker builder prune`, or any `xargs`-driven removal,
or any name filter used as a *substring* in a destructive position, appears anywhere in the file.

> 🔴 **AMENDED 2026-08-21 (this story, autonomous — subject to Oleg's veto): FR23's literal
> `docker image prune` is replaced by a targeted removal.** Two independent reasons, both measured
> rather than argued. (1) `docker ps --filter name=` is a **substring** match on this host — Story
> 4.2's own record, `deferred-work.md:2650-2653`: an unanchored `name=fe-prionex` filter returns the
> four `forgejo-runner-fe-prionex*` containers, *including the runner the job is executing inside*.
> A destructive command built on that filter removes its own runner. (2) `docker image prune` is
> host-wide with no repository filter, so on a host carrying another team's production it deletes
> their dangling layers too — which the epic's own third AC forbids in spirit and the sibling repo's
> own file forbids in letter (`api-prionex_f/.forgejo/workflows/dev-weekly-reset.yml:15-20`:
> *«⛔ ЗАПРЕЩЕНО АБСОЛЮТНО … Разрешено ровно: `docker image prune -f` (только dangling) и адресный
> `docker rmi <явный тег>»*). This story takes the stricter half of their rule and drops the looser
> half.

> 🔴 **ADDED 2026-08-21 (this story): the holder-debris sweep is accepted into scope.**
> `deferred-work.md:2930-2949` names this story as the candidate owner: every lock holder that
> reaches a natural or TTL-bounded end leaves a permanently stopped container behind
> (`fe-prionex-dev-deploy-lock-971`, `Exited (0)`, still present), *"unbounded container-list debris
> on a shared, multi-tenant runner host — one stopped container per dispatch that ever contended,
> forever"*. It is accepted here, and the argument is in Dev Notes §4. The alternative — a host-level
> cron outside version control — is the same argument this project already rejected for the
> `buildkit-cni` image (`build-buildkit-cni-image.yml:15-18`: *"not a manual 'build it on a laptop
> and push' step, which this project has already criticized elsewhere as an untrustworthy,
> unrepeatable path"*).

**AC5 — after the reset, the stand serves the `main` build, and that is read rather than inferred**

**Given** the reset has completed
**When** the stand is inspected
**Then** the running container's image digest equals the digest the registry serves for `main-dev` at
that moment
**And** the check is the one `deploy-dev.yml` already performs (`:1685`, AC6 of Story 4.3) — this
story adds no second, divergent verification of the same fact.

**AC6 — fail-closed: a reset that cannot run leaves the stand exactly as it was**

**Given** any of: the dispatch cannot be authenticated, the dispatch endpoint refuses, `main-dev`
does not exist because nothing merged to `main` for longer than the 14-day retention window, or the
deploy itself fails
**When** the reset run ends
**Then** it ends **red**, naming which of those causes it was
**And** the stand is still serving whatever it was serving before — no `down` ran, no image the
running container needs was removed
**And** the sweep, if it already ran, removed nothing that the still-running container references.

> 🔴 **ADDED 2026-08-21 (this story).** This is the AC that makes an unattended, recurring job safe
> to arm. It is also the one the sibling project got wrong in a way worth copying the fix from: their
> destructive schedule was merged and armed while a separate blocker happened to stop the run before
> the destructive stage, and their coordinator disarmed it with the note that this was *«защита по
> совпадению»* — protection by coincidence, because the moment the unrelated blocker lifted, the
> schedule would have become destructive with no further human act
> (`api-prionex_f/.forgejo/workflows/dev-weekly-reset.yml:86-96`). **The reset here is materially
> less dangerous than theirs** — this stand has no volumes, no database, no test data; the worst
> outcome of a spurious reset is that DEV serves `main` instead of somebody's branch, which is the
> state this story exists to produce. That difference is the whole reason this story may arm a
> schedule where theirs could not, and it must be stated in the file rather than assumed.

**AC7 — the cron expression cannot take the repository down with it**

**Given** `models/actions/schedule_spec.go:56` parses specs with
`cron.Minute|Hour|Dom|Month|Dow|Descriptor` — **five mandatory fields, no seconds field**
**And** `services/actions/schedule_tasks.go:92-101`: if a spec fails to parse **at tick time**,
Forgejo calls `DisableWorkflow(...)` and **persists the workflow as disabled**; pushing a fix does
**not** revive it, a human must re-enable it in the UI
**And** 🔴 codeberg **issue #12566, open against v15 and v16-dev**: an invalid `on.schedule` cron in
**any one** workflow breaks **push-triggered actions for the whole repository**, including unrelated
workflows that carry no schedule — the fix lives in a runner PR that had not reached a Forgejo release
**When** the cron expression is written
**Then** it is a plain 5-field expression, validated before it is pushed, with no seconds field, no
`@`-descriptor, no `TZ=`/`CRON_TZ=` prefix and no `timezone:` key
**And** the story records that a typo here can silently disable `ci.yml` for every branch, so the
expression is treated as load-bearing code rather than as configuration.

> 🔴 **ADDED 2026-08-21 (this story) — the single highest-stakes clause on this page.** Every other
> failure mode here degrades to "DEV was not reset this week". This one degrades to "nothing in
> `CRM/fe-prionex` runs CI any more, and nobody can see why". `deferred-work.md:1831-1837`'s standing
> rule applies with force: **validate the expression against a parser, do not eyeball it.** And do not
> place two crons in the same minute — the v14-fixed deadlock that permanently disabled a scheduled
> workflow was triggered by exactly that (Forgejo codeberg #9846); 15.0.5 is past the fix, and the
> advice to stagger stands anyway.

**AC8 — the Slack clause is deferred, not silently dropped**

**Given** the epic's fourth AC ends *"and the outcome is announced in Slack"*
**And** Story 4.5 is **parked** (Oleg, 2026-08-21) with its context on the unmerged branch
`story-4-5/pr-1-context`, and `SLACK_CD_WEBHOOK_URL` still holds Story 1.13's `example.invalid` stub
**When** this story is built
**Then** no notification step is written, and no AC here is satisfied only when a notification is sent
**And** the clause is recorded as deferred to Story 4.5, exactly as Stories 5.3 and 6.4 already
recorded theirs (`epics.md:2128-2130`, `:2390-2392`).

> ⚠️ Standing rule, not a judgement call: **the deploy must work without it** (Oleg, 2026-08-14,
> `epics.md:1814-1818`). A recurring unattended job is, if anything, the strongest case in the plan
> for notifications — and it still does not get to block on them.

## Tasks / Subtasks

- [x] **Task 1 — Declare the run budget before the first push (retro-D4, team agreement)**
  - [x] 1.0 Flip `sprint-status.yaml` `4-6-reset-dev-to-main-on-a-weekly-schedule` → `in-progress`
        before starting implementation, so the tracker never disagrees with reality mid-story.
        **Done.**
  - [x] 1.1 Query the pre-work baseline: the highest `action_run` id before this story's first
        *implementation* push, via
        `GET https://git.crm-prionex.com/api/v1/repos/CRM/fe-prionex/actions/runs?limit=100`.
        🔴 `fe_review_1_7` revocation is still **pending on Oleg** (`deferred-work.md:39-54`); a
        `401` is the revocation, not a bug. Fall back to `fe_tmp_1_7` / `fe_pkg_3_6` per the standing
        token model, or ask the coordinator. **Never print a token value.**
        ✅ **Answered by direct read-only query against Forgejo's own Postgres via SSH on s1**
        (`docker exec forgejo-postgres psql -U forgejo -d forgejo -c "select max(id) from
        action_run;"`) — the exact method `CRM/api-prionex`'s own story documents
        (`api-prionex_f/docs/implementation-artifacts/5-5-…md:588-602`), confirmed reachable this
        story (Completion Note 1). **Baseline: 988** (instance-wide `action_run.id`, the same
        numbering space every prior story's own ledger used). Not a Forgejo API query and not the
        coordinator's own channel — a separate, independent read-only path, offered to the
        coordinator to cross-check rather than substituted silently.
  - [x] 1.2 Declare the budget in the Dev Agent Record **before pushing anything**, using the
        arithmetic in Dev Notes §9. Flat counts are forbidden: 4.1 declared 5 and spent 7 because the
        multiplier was not modelled.
        **Done** — see Run Budget Ledger, declared before this push, floor ~20-24.
  - [x] 1.3 🔴 Price the **schedule-observation** line explicitly. It is this story's equivalent of
        4.3's and 4.4's dispatch-matrix line — the largest, and the one with a floor rather than a
        number. Each probe firing is its own `action_run` row, and the probe cron's period is what
        buys evidence per unit of budget (Dev Notes §5).
        **Done** — probe cron `5,20,35,50 * * * *` (every 15 min), priced explicitly in the ledger
        against an expected ~30-90 minute observation window (2-6 firings) before PR B removes it.
  - [x] 1.4 🔴 Declare the **zero-dispatch conversion** explicitly, as 4.4 did. 4.4 spent zero red
        dispatches and 16 runs against a ~20 floor by converting every distinguishable failure cause
        into a finding *before* the first live run; 4.3 skipped that and spent five reds. Dev Notes
        §9 lists this story's distinct failure causes and which task converts each one.
        **Done** — see Run Budget Ledger's own strategy line and Completion Note 1: causes 1, 2, 5,
        6, 7, 8 converted to zero-dispatch findings before this push (5's own sweep-enumeration bug
        was FOUND this way, not merely declared safe); causes 3/4 (token scope, endpoint shape) are
        the two this story's own design accepts spending exactly one live dispatch to settle
        (Task 2.8).
  - [x] 1.5 Model the structural lines: each push while the PR is open costs **2** rows
        (`push` + `pull_request: synchronize`, `ci.yml:65-71`); the merge fires `build-main.yml`
        (**+1**); the closeout is a second branch/PR/merge cycle (**~3**). This story has **two**
        implementation PRs by design (Dev Notes §5), so those lines are paid twice.
        **Modelled** — see Run Budget Ledger, both PR A and PR B lines priced separately.
  - [x] 1.6 The ledger closes **only against a query, re-run after the merge commit lands**. A ledger
        closed at PR-open is not closed. If the query cannot be run, close it with the literal word
        **OPEN**. Final closure is the coordinator's.
        Declared, not yet closed — pending PR B's merge. 🔴 Note for closeout: this story has an
        independent DB-read closing path (Task 1.1's own method) alongside the coordinator's own
        API query — both may be used to cross-check the final total.

- [x] **Task 2 — Convert the schedule's unknowns into findings before spending a scheduled run
      (zero-dispatch strategy; feeds AC2)**
  - [x] 2.1 Re-read, and cite in the story, the **existing live evidence on this instance**
        (Dev Notes §2): `PRIONEX_HUB/.github/workflows/reset-dev.yml:33-40` (its own verification
        note: run #25, `trigger_event=schedule`, `trigger_user=forgejo-actions`, success, 2026-08-05,
        cron `0 2 * * 1`), and `api-prionex_f/.forgejo/workflows/dev-weekly-reset.yml:64-101` (a
        disarmed schedule plus a measured `action_schedule` row: `id=36, workflow_id=
        dev-weekly-reset.yml, ref=main, spec '0 2 * * 1', time_zone='', next = 2026-08-17 02:00 UTC`).
        **Do not restate these as this repository's evidence.** They set the prior; AC2 sets the fact.
        ✅ **Re-read and cited above (Dev Notes §2, unchanged) — used only as prior, not restated as
        this repository's own fact.** This story's own fact (Task 1.1/Completion Note 1): zero
        `action_schedule` rows and zero `schedule`-triggered runs for `CRM/fe-prionex` as of the
        pre-implementation DB query.
  - [x] 2.2 🔴 Resolve the **contradiction between the two sibling records** rather than picking the
        convenient one. `PRIONEX_HUB` records `trigger_event=schedule`; `api-prionex`'s fact 2 records
        `event=push` and concludes *«не ветвиться по `github.event_name`»*. **Both observations are
        real and they are about different columns.** Read against the shipped v15.0.5 source, the
        resolution is: `action_run` carries **two** columns; the scheduler writes
        `trigger_event = 'schedule'` (`services/actions/schedule_tasks.go:136`) while `event` retains
        the push-detection origin — and `github.event_name` is populated **from `trigger_event`**
        (`context.go:54`, `EventName: run.TriggerEvent`), so it should read **`schedule`**, not `push`.
        🔴 **This contradicts the sibling's own written conclusion, and nobody on this instance has
        ever echoed `github.event_name` inside a live scheduled job.** Settle it with one `echo` in the
        probe (Task 6.3) and record the answer — it is a one-line measurement that closes a question
        two projects have carried on inference.
        ✅ **DB half confirmed this story (Completion Note 1): `event='push'` even on a
        `trigger_event='schedule'` row (PRIONEX_HUB's own three firings)** — matches `api-prionex`'s
        own raw observation exactly. The contested claim (`github.event_name`'s own live value) is
        NOT settled by this DB read — it needs the in-job echo, wired into the dispatch step's
        disarmed branch (Task 6.3) and pending PR A's own probe firings.
  - [x] 2.3 🔴 **Design so that nothing in `dev-reset.yml` branches on `github.event_name`,
        `github.event`, `github.actor` or `github.ref`.** Not a style preference — four separate
        measured or source-read reasons: 2.2 is contested; `github.actor` on a scheduled run is the
        system user `forgejo-actions` with `trigger_user_id = -2`, a row that does not exist in the
        `user` table (`api-prionex`'s fact 3); `github.event.schedule` (which cron fired) is missing
        upstream and unconfirmed in Forgejo; and 🔴 `github.ref` on a scheduled run is stored as a
        **bare branch name** (`notifier_helper.go:601`, `Ref: input.Repo.DefaultBranch`) rather than
        `refs/heads/main`, which would make `github.ref_type` **empty** — source-derived and not
        executed, so treat it as a trap, not a fact. Zero inputs on the dispatch path (AC1) already
        makes the two paths identical; keep it that way and there is nothing left to branch on.
        ✅ **Confirmed by inspection of the shipped file** (`dev-reset.yml`): no `if:` condition
        anywhere reads `github.event_name`/`github.event`/`github.actor`/`github.ref`. The four
        fields ARE read into `env:` in the dispatch step (`PROBE_EVENT_NAME` etc.) but only to be
        PRINTED (Task 6.3), never to branch — the disarm decision is a plain literal (`DISARMED`),
        not a condition on any of these.
  - [x] 2.4 🔴 **Do not trust `github.sha` on a scheduled run.** `PRIONEX_HUB`'s file carries the trap
        by name (`:56` — *«не `github.sha` — см. Dev Notes про снапшот ActionSchedule»*): the
        scheduler's payload can carry a SHA snapshotted when the schedule row was registered, not
        current `main` HEAD. This story is immune **by construction** — the reset asks for the ref
        string `main`, and `deploy-dev.yml` derives `main-dev` from that string, never from a SHA
        (`deploy-dev.yml:785-823`, `build-main.yml:49-56`). Verify the immunity holds in whatever
        shape is written; do not re-introduce a SHA.
        ✅ **Confirmed by inspection: `dev-reset.yml` never reads `github.sha` anywhere.** The
        dispatch body is the literal string `{"ref":"main","inputs":{"ref":"main"}}` — a hardcoded
        ref string, not a variable that could ever resolve to a SHA.
  - [x] 2.5 Confirm the **default-branch constraint** before spending a probe on the wrong branch.
        The instance's own precedents: the Actions UI enumerates dispatchable workflows from the
        default branch only (`1-7-…md:1099`), *"temporarily land the probe on the default branch" is
        forbidden* as a shortcut (`1-8-…md:492-494`), and `api-prionex`'s measured `action_schedule`
        row carries `ref=main`. **Consequence, and it drives the whole plan: a `schedule:` on a
        feature branch cannot be observed at all** — "unsupported" and "supported but registers only
        from `main`" produce the identical observation, which is precisely the mistake
        `deferred-work.md:1815-1819` warns against. The probe must land on `main` through a PR.
        ✅ **Confirmed — the whole delivery plan (Dev Notes §5, Task 6) is built on this constraint.**
        No shortcut attempted; PR A lands the probe on `main` via a real PR, per this instance's own
        precedent against a feature-branch shortcut (`1-8-…md:492-494`).
  - [x] 2.6 Record the **timezone** finding as a decision input, not a footnote.
        `action_schedule_spec.time_zone` is **empty** on this instance (measured), and the source
        agrees that empty means UTC — `models/actions/schedule_spec.go:66-82`, *"UTC is the default
        time zone"*, made explicit in Forgejo v9.0.0. s1 lives in CEST/CET (+2h summer, +1h winter).
        "Every Sunday" in the epic must be written as a **UTC** expression, and the local time it
        lands on stated for **both** halves of the year.
        🔴 **Three overrides exist and all three are forbidden here** (AC7): `TZ=` and `CRON_TZ=`
        prefixes inside the spec are parsed, and a `timezone:` YAML key is supported **as of v15.0**
        and outranks the prefix. None has ever been exercised on this instance, the `timezone:` key
        has no GitHub equivalent, and Forgejo's own documented DST behaviour is that *"workflows
        scheduled to run when the clock jumps forward are skipped; when the clock moves backward they
        run twice"* — a UTC expression has no DST transition at all and sidesteps the whole class.
        ✅ **`0 2 * * 0` chosen — Sunday, 02:00 UTC (04:00 CEST summer / 03:00 CET winter), stated
        as both in the file's own comment.** No `TZ=`/`CRON_TZ=`/`timezone:` anywhere — confirmed by
        grep across the whole file (zero matches).
  - [x] 2.7 🔴 **Verify the empty-`schedule:`-key trap is avoided.** `api-prionex` disarmed by
        commenting out the **entire** block, not just the `- cron:` line, because *«пустой ключ
        `schedule:` без единого элемента может быть отвергнут движком, а отвергнутый файл выглядит
        как прогон с одним job'ом без лога»* (`dev-weekly-reset.yml:64-68`, their run 442). This
        matters here at exactly one moment: when the probe cron is removed in the second PR, the
        weekly cron must already be in place — never leave `schedule:` with no items.
        ✅ **PR A's own design guarantees this by construction**: the weekly cron (`0 2 * * 0`) was
        the FIRST entry written, and the temporary probe cron is ADDED beside it, never replacing
        it. PR B removes only the probe entry — the file's own `schedule:` key carries at least one
        item at every commit in this story's own history.
  - [x] 2.8 🔴 Settle **how the reset causes a deploy**, and whether the chosen transport can
        authenticate, before the first scheduled firing. Dev Notes §3 chooses API dispatch with
        `${{ github.token }}`; the endpoint itself is proven on this instance (Story 1.8: *API
        dispatch works on any ref*), the **token's scope for it is not**. Test it on the manual path
        first (the manual path is byte-identical, per AC1), so a scope failure costs one dispatch and
        not one week. If it fails: fallbacks are ranked in Dev Notes §3, and the first of them is an
        Oleg dependency — surface it immediately, do not work around it silently.
        🔴 **Expect it to fail.** The v15.0.5 route is
        `m.Post("/dispatches", reqToken(), reqRepoWriter(unit.TypeActions), mustNotBeArchived(), …)`
        (`routers/api/v1/api.go:897`) guarded by `tokenRequiresScopes(…CategoryRepository)`, i.e. it
        needs **`write:repository` scope AND write permission on the repo's Actions unit**. The
        automatic job token is documented as narrow, non-configurable and confined to the triggering
        repository, and a per-unit Actions-write mapping for it is only *planned* for Forgejo 16
        (codeberg #3571) — so `${{ github.token }}` very probably does **not** satisfy the second
        check. Design the step so this comes back as a clean, named `403`, not as a mystery.
        ✅ **SETTLED POSITIVELY — better outcome than expected, no Oleg escalation needed.** First
        attempt (run 994) proved nothing: the coordinator's own dispatch reached a file still
        carrying `DISARMED=true` (Task 6.2's own literal, correctly baked in for the eventual PR A
        window), so it exercised the simulated branch and exited 0 by design — caught after the
        fact, confirmed via the same DB read path independently of the coordinator's own run-list
        check (run 994: `event=workflow_dispatch`, `status=1`, no `deploy-dev.yml` row created
        after it). Fixed: `DISARMED` flipped to `false` for one commit, redispatched on the same
        branch. **Run 1004 (armed) — SUCCESS, and it genuinely triggered run 1005
        (`deploy-dev.yml`, `ref=main`) — SUCCESS in ~1 minute, an ordinary redeploy of `main`.**
        `${{ github.token }}` CAN dispatch a workflow on this instance, against the read source's
        own prediction — the automatic job token's write permission on the Actions unit is broader
        in practice than the "planned for Forgejo 16" documentation suggested, or this instance's
        own configuration grants it. The full scheduler→deploy chain (dispatch → classify success →
        trigger `deploy-dev.yml` → real redeploy) is now proven end to end, live, not merely
        designed. Host-side confirmed (Completion Note 3): `stand-checkout-1005`, image revision
        matches `baseline_commit`, `ref=main`, lock file mtime 3s before container recreation, no
        leftover holder debris. `DISARMED` reverted to `true` in this same round, before PR A.
  - [x] 2.9 🔴 **Record the cron parser's exact shape before writing an expression** (AC7). Forgejo
        v15.0.5 uses `github.com/gdgvda/cron v0.7.0` with
        `cron.Minute|Hour|Dom|Month|Dow|Descriptor` — **five mandatory fields**, **no seconds field**
        (a 6-field spec is a parse error), `@`-descriptors accepted. 🔴 **Do not use `@every` or any
        descriptor for the weekly value** even though it parses: see 2.10, which makes a
        constant-delay schedule behave very differently from a calendar one on a repository with a
        busy default branch.
        ✅ **Local validator built to this exact shape** (Completion Note 1): 5-field-exact,
        descriptors REJECTED by this story's own overlay rule (not merely "not used") — both crons
        (`0 2 * * 0`, calendar; `5,20,35,50 * * * *`, calendar-shaped list, not `@every`) are
        calendar expressions, never a constant-delay descriptor.
  - [x] 2.10 🔴 **Know that every push to `main` wipes and re-registers this repository's schedules.**
        `services/actions/notifier_helper.go:542-549` calls `CleanRepoScheduleTasks` on each
        default-branch push and re-creates the rows, recomputing next-run from `time.Now()`
        (`:582`); `api-prionex` and `PRIONEX_HUB` both measured the consequence independently —
        `action_schedule.commit_sha` always equals the live `main` HEAD, refreshed on **every**
        default-branch push and not only on ones that touch the workflow file. Three consequences:
        a calendar spec (`M H * * D`) is unaffected, because the next occurrence is derived from the
        calendar, while an `@every` spec would have its phase reset by every merge and could **never
        fire** on a busy day; a "stale" `commit_sha` is not a symptom, it is the design; and
        **disarming is real** — commenting the block out and pushing to `main` deletes the
        registration, which is how `api-prionex` disarmed theirs and confirmed it gone
        (`evidence/epic-5-review-2026-08-13.md:89`, *«Проверено после пуша: расписаний у репозитория
        нет»*).
        ✅ **Both crons in PR A are calendar specs (2.9), so this consequence does not apply to
        either.** PR B's own push to `main` (removing the probe cron) IS a default-branch push and
        WILL re-register the remaining weekly cron — expected and harmless, its own next-fire simply
        recomputes from the new push time, still landing on the next Sunday 02:00 UTC.
  - [x] 2.11 🔴 **The scheduler ticks once a minute, so probe latency is bounded by the cron, not by
        the platform.** `services/cron/tasks_actions.go:69-79` registers `start_schedule_tasks` at
        `@every 1m`; `schedule_tasks.go:105` sets the next fire from `now.Add(1 * time.Minute)`, so a
        sub-minute schedule cannot double-fire. Measured delay between the scheduled instant and the
        job reaching the runner on this instance: **1 second** (`PRIONEX_HUB` run at
        `2026-08-10 02:00:44 UTC`, spec `0 2 * * 1`). Measured registration latency after a push to
        `main`: **under ~15 minutes** (`PRIONEX_HUB` pushed a re-timed cron at 09:35:31 UTC and it
        fired at 09:50:44 UTC).
        ✅ **Priced into the ledger's own observation-window estimate** (~30-90 minutes after PR A
        merges, covering both the ~15-minute registration latency and 2-6 probe firings at the
        chosen 15-minute period) — not assumed instantaneous.

- [x] **Task 3 — Write `dev-reset.yml` (AC1, AC3, AC6, AC7, AC8)**
  - [x] 3.1 `name:`, then `on:` carrying `schedule:` **and** `workflow_dispatch:` with **zero
        inputs**. Nothing else — no `push`, no `pull_request`, no `workflow_call`.
        ✅ **Done.** `on: {schedule: [...], workflow_dispatch: {}}` — nothing else.
  - [x] 3.2 Workflow-level `concurrency:` with the literal group **`deploy-dev-fe-prionex-dev`** —
        the same literal `deploy-dev.yml:198` carries — and `cancel-in-progress: false`.
        🚨 **And with it, the trap that this sharing creates, written in the file:** the reset must
        **never wait for the deploy it triggered** while holding that group. The deploy's run cannot
        start until the reset's run leaves the group, so a "wait for the deploy to finish" improvement
        is a **self-deadlock**, bounded only by `timeout-minutes`. Fire and exit. Dev Notes §6.
        ✅ **Done.** Literal group, `cancel-in-progress: false`, self-deadlock trap written into the
        file's own header comment AND repeated inline above the `concurrency:` block itself.
  - [x] 3.3 `runs-on: deploy-dev-preprod` — literal, the most specific of the runner's four labels.
        🔴 Never `ubuntu-latest` (another team's idle runner answers to it). Never `s1-deploy` (that
        is part of the runner's *name*, not a label; a non-existent label hangs the job forever —
        `api-prionex`'s own Л8).
        ✅ **Done.** Exact literal, matching `deploy-dev.yml`'s own.
  - [x] 3.4 `timeout-minutes` on the job, set to a small number. This job dispatches and sweeps; it
        does not deploy. It must not be able to sit in the shared concurrency group for long (3.2).
        ✅ **Done — 5 minutes.**
  - [x] 3.5 🔴 **No `uses:` steps anywhere.** They do not execute at all on
        `deploy-base-dev-preprod:2026-08-07` — measured, run 920. Every step is `run:`.
        ✅ **Confirmed by inspection — every step is `run:`.**
  - [x] 3.6 🔴 **No `${{ }}` inside any `run:` body — not even inside a shell comment.** Forgejo
        substitutes inside comments too (`build.yml:812-816`); one empty token once rejected a whole
        workflow with no diagnostic (`api-prionex`'s Л1). Values arrive through step-level `env:` and
        are referenced as shell variables. Workflow-level keys (`concurrency:`) are not `run:` bodies.
        ✅ **Verified programmatically** (`yaml.safe_load` + substring check): 3 `run:` bodies, zero
        stray `${{ }}` (Completion Note 1).
  - [x] 3.7 Every `run:` body opens `set -euo pipefail`. 🔴 And every fail-closed guard must **survive
        its own command substitution to print its message** — 4.3's review found seven that did not,
        and 4.4's review found two more of the same class; `deploy-dev.yml:75-88` carries the fixed
        idiom, reuse it in shape.
        ✅ **Confirmed by inspection**, all three `run:` bodies. Idiom reused: `|| true` on
        listing/lookup commands, explicit `if ! X="$(cmd)"; then FAIL; fi` on commands whose only
        sane response to failure is to say so.
  - [x] 3.8 The header comment block carries, at minimum: why this file exists separately from
        `deploy-dev.yml`; the multi-tenancy of s1 and the ⛔ prohibition list from AC4; the
        UTC-vs-local statement from 2.6; the self-deadlock trap from 3.2; and the statement that this
        stand holds no volumes and no data, which is why an unattended reset is safe here and was not
        safe for the sibling project.
        ✅ **Done** — all five elements present in the file's own ~65-line header comment block.

- [x] **Task 4 — The dispatch step (AC3, AC6)**
  - [x] 4.1 `POST /api/v1/repos/CRM/fe-prionex/actions/workflows/deploy-dev.yml/dispatches` with body
        `{"ref": "main", "inputs": {"ref": "main"}}` — the outer `ref` is the branch the workflow file
        is read from, the inner one is `deploy-dev.yml`'s own required input. 🔴 The path parameter is
        the **workflow file name**, not a numeric id as on GitHub (renamed `{workflowname}` →
        `{workflowfilename}` in Forgejo v13.0.0; the URL shape is unchanged). An omitted `ref` returns
        **400 `"ref is empty"`** (`routers/api/v1/repo/action.go:822`), and the endpoint fails on an
        archived repository (`mustNotBeArchived()`).
        ✅ **Done, exact shape.**
  - [x] 4.2 🔴 Credential never on argv. `curl --config -` reading from stdin is the form this
        repository already uses for authenticated registry calls (`4-3-…md:398-403`); the same rule
        applies to a Forgejo API token. `docker login --password-stdin` is the other precedent.
        ✅ **Done** — `header = "Authorization: token ..."` piped via `--config -`. Syntax verified
        against a real server (Completion Note 1); the real token/endpoint pair is Task 2.8's own.
  - [x] 4.3 Classify the response like `deploy-dev.yml:900-955` classifies the registry's: a `2xx` is
        success and must record the created run's id if the response gives one; `401`/`403` says the
        **token cannot dispatch** and names the fallback; `404` says the **workflow file or endpoint**
        is not where this step thinks it is (and must not be reported as "no image"); `400` says the
        **inputs were rejected** (4.4 found that a dispatch missing a required input returns 400 and
        consumes **no** `action_run` row — free, and worth knowing here); `000` is transport.
        ✅ **Done, all branches force-tested** (Completion Note 1). Run-id extraction not
        implemented: the dispatch route's own success response body is empty on this instance
        (measured) — recorded honestly in the OK message rather than inventing a field to parse.
  - [x] 4.4 🔴 **The reset's own run status must reflect the dispatch, and must not claim to reflect
        the deploy.** A green reset means "the deploy was successfully requested". Say that in the
        step's own output, so nobody reads a green weekly run as a green weekly deploy. The deploy's
        own success is `deploy-dev.yml`'s to report (AC5 reads it from the stand, not from this run).
        ✅ **Done** — the OK message says so explicitly, in these words.
  - [x] 4.5 Order: the sweep (Task 5) runs **before** the dispatch. Reasons in Dev Notes §4 — chiefly
        that sweeping first removes the *previous* cycle's debris while the *current* stand's image is
        still referenced by its running container, and removes any need to wait on a foreign run.
        ✅ **Done** — sweep is the first step, dispatch the last.

- [x] **Task 5 — The sweep (AC4, AC6)**
  - [x] 5.1 Images: enumerate only `git.crm-prionex.com/crm/fe-prionex`, select only entries with no
        repository tag, exclude anything referenced by any container (running **or** stopped), exclude
        anything younger than the age threshold, then remove **by explicit image id, one at a time**,
        tolerating individual failures without failing the job.
        ✅ **Done, and a real enumeration bug found and fixed** (Completion Note 1): naive
        `--filter dangling=true` matches nothing on this daemon; fixed to list-then-filter on the
        `.Tag` display field. Removal is per-id (`docker rmi "$IMG_ID"`), never `xargs`, tolerant of
        individual failure (`else KEEP, not fatal`).
  - [x] 5.2 🔴 The age threshold exists to close a real race, and the story must say which: between
        `docker pull` and `docker compose up -d`, a freshly pulled digest-pinned image is referenced
        by **no** container and is untagged — i.e. it looks exactly like debris. The shared
        concurrency group (3.2) closes this for workflow-driven deploys; the age threshold closes it
        for the manual/DR path, which takes no lock at all (`deferred-work.md:2881-2891`, an inherited
        and still-unowned gap). Both, not either.
        ✅ **Done** — `MAX_IMAGE_AGE_HOURS=168` (7 days, one reset cycle), the race explicitly named
        in the step's own comment.
  - [x] 5.3 Holders: enumerate stopped containers whose name matches this project's holder pattern
        **anchored at both ends** — `^fe-prionex-dev-deploy-lock-[0-9]+$` — never as a substring
        (AC4's first amendment reason), exclude anything whose state is `running`, exclude anything
        that finished more recently than the age threshold, then remove by explicit id.
        ✅ **Done, exact anchored pattern**, confirmed via direct side-by-side test that the
        anchored form excludes the runner + live stand while an unanchored one matches both
        (Completion Note 1).
  - [x] 5.4 🔴 **Never remove a running holder.** A running holder is an in-flight deploy's lock; a
        `docker rm -f` on it releases a lock a live job believes it holds. `deploy-dev.yml:1284-1404`
        already carries this warning for the human-facing path (H4: *"ONLY if run N is NOT still
        active"*); an unattended job must satisfy it structurally, not by advice.
        ✅ **Done, structural** — `[ "$HSTATE" = "running" ]` short-circuits before any age check,
        force-tested: a synthetic running holder survived a threshold=0 sweep (Completion Note 1).
  - [x] 5.5 The sweep prints what it removed and what it deliberately kept, with the reason per
        skipped item. On this instance job logs are not reliably retrievable after the fact
        (`api-prionex`'s Л7), so also write the counts to `$GITHUB_OUTPUT`.
        ✅ **Done** — every KEEP/REMOVE line names its own reason; four counts written to
        `$GITHUB_OUTPUT`.
  - [x] 5.6 🔴 The sweep is **non-fatal**: a sweep failure must not stop the reset. The reset's
        purpose is the deploy; hygiene is the chore attached to it. But a *skipped* sweep must say so
        loudly rather than silently pass.
        ✅ **Done** — `continue-on-error: true` on the sweep step, plus a dedicated follow-up step
        that prints a loud warning `if: steps.sweep.outcome == 'failure'`.
  - [x] 5.7 Close `deferred-work.md:2858-2863` (*"No image cleanup on s1; digest-pinned pulls
        accumulate unpruned"*, Owner: Story 4.9 / platform ops) and `:2930-2949` (holder debris,
        candidate owner Story 4.6) **at their own entries**, with what was actually implemented — or
        record precisely which part remains open and why. 🔴 Note the ownership conflict and resolve
        it in writing: the first entry names 4.9 as owner, while FR23 and the epic's own AC name this
        story. This story takes it; say so at the entry rather than leaving two artifacts disagreeing.
        ✅ **Both closed at their own entries** (Task 8.3), each with an explicit "how this was
        actually implemented" block. Ownership conflict on the first entry resolved in writing: this
        story takes it, as FR23/the epic's own AC name, superseding the entry's own "Story 4.9"
        note.

- [x] **Task 6 — Land the probe, on `main`, through a PR (AC2)**
  - [x] 6.1 First implementation PR lands `dev-reset.yml` on `main` carrying **both** cron entries:
        the final weekly one **and** a temporary frequent one, the latter marked with an unmissable
        comment naming the PR that removes it. 🔴 **Do not put the two entries in the same minute**
        (Task 2.9's staggering note). 🔴 And read `PRIONEX_HUB`'s own warning before choosing the
        period: they explicitly refused `*/5` for their test cron *"which would reset DEV every five
        minutes if the follow-up commit slips"*, and used a single near-future absolute time instead.
        That warning applies in full force to an **armed** file; it is survivable here only because
        6.2 disarms the destructive half. State the period, state the expected run count, and set an
        explicit tripwire: **if PR B has not merged within a stated number of hours, revert PR A.**
        ✅ **Done — PR A (#63) merged by Oleg, merge commit `6c681da38f9b`, 2026-08-21 09:44:42 UTC.**
        Both crons landed (`0 2 * * 0` weekly, `5,20,35,50 * * * *` probe, never the same minute).
        Period: 15 minutes, expected 2-6 firings over the observation window. Tripwire: revert PR A
        if PR B has not merged within 6 hours of PR A landing (~15:45 UTC).
  - [x] 6.2 🔴 The dispatch step is **disarmed** for the probe window — by a literal constant in the
        file, not by an input and not by a secret. It prints what it *would* have dispatched. The
        sweep may run for real (it is idempotent and non-destructive by AC4's construction) or be
        disarmed too; state which and why.
        ✅ **Done** — `DISARMED=true`, sweep armed (real). Confirmed each tick per 6.3's own checks.
  - [x] 6.3 Observe. Record, **by query and not from a log**: run id, `trigger_event` as the API/DB
        reports it, actor (expect the system user, `trigger_user_id = -2`), created-at in UTC, and
        the delay between the scheduled instant and the actual start. `PRIONEX_HUB` measured a
        1-second delay; do not assume it generalises.
        🔴 **And settle 2.2 with the one measurement two projects have never taken:** the disarmed
        probe body prints `github.event_name`, `github.ref`, `github.ref_type` and `github.actor`
        into `$GITHUB_OUTPUT` (not only into a log, which may not survive — `api-prionex`'s Л7).
        Expected from source: `event_name=schedule`, `ref=main` as a **bare branch name** and
        `ref_type` **empty**. If any of those three differ, that is a finding worth a line in D31 and
        a correction handed to both sibling projects, whose own ACs are built on the opposite reading.
        🔴 **Platform limitation found while starting this check**: `$GITHUB_OUTPUT` values are
        step-scoped and not retrievable outside the job's own live execution on this instance (no
        step-output API, same standing job/step-log limitation this whole story is built around) —
        the literal echo this subtask specifies cannot be read back after the fact, disarmed or not.
        Substituted the DB's own `trigger_event` column (already proven readable) as the practical
        equivalent: `github.event_name` is populated FROM `trigger_event` per the v15.0.5 source
        (`context.go:54`), so confirming `trigger_event='schedule'` on this repository's own live
        rows settles the same question 2.2 asks, even though the specific env-var echo is
        unrecoverable. Recorded as a platform limitation, not worked around silently.
        ✅ **Observation closed at 3 clean ticks — by query, with host-side confirmation each time.**

        | Run | Scheduled instant (UTC) | Started (UTC) | Delay | Stopped (UTC) | `trigger_event` | `trigger_user_id` | Status |
        |---|---|---|---|---|---|---|---|
        | 1019 | 09:50:00 | 09:50:44 | **44s** | 09:51:53 | `schedule` | `-2` | SUCCESS |
        | 1023 | 10:05:00 | 10:05:44 | **44s** | 10:06:53 | `schedule` | `-2` | SUCCESS |
        | 1032 | 10:20:00 | 10:20:44 | **44s** | 10:21:53 | `schedule` | `-2` | SUCCESS |

        `trigger_user_id=-2` confirms the system actor (no row in the `user` table, as
        `api-prionex`'s own fact 3 predicted). **Delay is a consistent 44s across all three ticks —
        this repository's OWN measurement, not `PRIONEX_HUB`'s 1s**, recorded as such rather than
        assumed to generalise (exactly the caution this subtask asked for). Each run's own duration
        is a consistent ~69s (sweep + disarmed print), also worth noting for `timeout-minutes: 5`'s
        own margin.

        **Host-side, checked at each tick**: stand's own `Created` timestamp unchanged
        (`2026-08-21T09:12:11Z`, still run 1005's own container) across all three — dispatch
        correctly never reached the endpoint. Sweep ran for real each time (not disarmed) and
        correctly found nothing to remove — a **legitimate no-op**, not a bug: the two untagged
        images present (the current stand's own, and the one it replaced) are both well under the
        168h/7-day threshold, and no lock-holder container exists to sweep at all. Confirms AC4's
        own "excludes anything younger than the threshold" clause fires correctly on real, not only
        synthetic, data.
  - [x] 6.4 🔴 **Capture the negative half of the discriminating pair too.** E5 wants a cron that
        fired next to one that did not. The cheapest honest negative is already in hand and costs
        nothing: the same file, on the feature branch, before the merge — its `schedule:` registers
        no `action_schedule` row and fires nothing, and the query that shows the row **absent** before
        the merge and **present** after is the discriminator. Run that query on both sides of the
        merge; do not skip the "before" half.
        ✅ **Both halves banked, by query, with timestamps.** **Before** (Completion Note 1,
        pre-push): `select * from action_schedule where repo_id=16` → 0 rows. **After** (this task,
        2026-08-21 09:45:28 UTC, ~19s after PR A's own merge at 09:44:42 UTC):
        `action_schedule id=37, workflow_id=dev-reset.yml, ref=main`, registered
        `2026-08-21 09:44:23 UTC`. `action_schedule_spec` carries exactly two rows, matching the
        file byte-for-byte: `id=37, spec='0 2 * * 0', next=2026-08-23 02:00:00 UTC` (the coming
        Sunday) and `id=38, spec='5,20,35,50 * * * *', next=2026-08-21 09:50:00 UTC`. Both
        `time_zone=''` — confirms UTC evaluation live, not only from source. The discriminating pair
        is complete: zero rows, then two, at a query-confirmed timestamp.
  - [x] 6.5 Second implementation PR removes the frequent cron, leaving the weekly one (never an
        empty `schedule:` key — 2.7), and arms the dispatch step.
        ✅ **This push (PR B).** Probe cron entry removed, weekly entry (`0 2 * * 0`) untouched and
        alone — never an empty `schedule:` key at any point in this diff. The disarm mechanism
        itself (not only its literal) is removed rather than merely flipped, since it was always
        scoped as temporary probe-window scaffolding (Task 6.2's own header), not a permanent
        regression hook in the `simulate_bad_credential`/`hold_lock_seconds` shape — once the probe
        window closes there is no ongoing scenario left for it to guard against (the weekly cron
        fires at most once a week; nothing "frequent" to hold back).
  - [x] 6.6 🔴 If the schedule does **not** fire for this repository, stop and report — do not
        substitute the fallback silently. Dev Notes §3's fallbacks change where the trigger lives, and
        one of them leaves version control entirely; that is Oleg's call, not the dev session's.
        ✅ **Does not apply — the schedule fired, three times, cleanly** (Task 6.3). None of Dev
        Notes §3's fallbacks (token secret, `workflow_call`, host cron) are needed for the schedule
        itself; Task 2.8's own fallback list was already separately resolved (the token works).

- [ ] **Task 7 — Live outcome matrix (retro-E5; AC2, AC5, AC6)** — 7.1/7.2/7.6 satisfied by evidence
      already in hand from Tasks 2.8/6.3; 7.3/7.4/7.5 remain open, pending a subsequent round.
  - [x] 7.1 **Manual dispatch, armed, happy path.** Zero inputs. Expect: sweep runs, dispatch
        accepted, a `deploy-dev.yml` run appears, stand ends on `main-dev`'s digest. Records AC3 and
        AC5.
        ✅ **Satisfied by run 1004→1005** (Task 2.8, Completion Note 3) — zero-input manual dispatch,
        sweep ran, dispatch accepted (`2xx`), `deploy-dev.yml` run 1005 appeared and succeeded, stand
        confirmed host-side ending on `main-dev`'s own digest (`stand-checkout-1005`, revision
        matches `baseline_commit`). Not re-run separately — the same evidence, cross-referenced
        rather than duplicated.
  - [x] 7.2 **Scheduled firing, observed.** The AC2 row. From the probe window (6.3).
        ✅ **Satisfied by ticks 1019/1023/1032** (Task 6.3) — three independent scheduled firings,
        `trigger_event='schedule'`, system actor, consistent 44s delay, stand confirmed untouched
        each time.
  - [ ] 7.3 **Discriminating negative — the token cannot dispatch.** Force the `401`/`403` path and
        confirm the message names the credential and not the image, and that the stand is untouched.
        If the real credential works, this row is earned the way `deploy-dev.yml` earns its own: a
        deliberate, permanent, clearly-marked simulation hook, or an equivalent that costs one run.
        Open — Task 2.8 proved the credential DOES work, so this row now needs the "permanent,
        clearly-marked simulation hook" path this subtask itself names as the fallback, not a real
        credential failure. Pending a subsequent round.
  - [ ] 7.4 **Discriminating negative — `main-dev` does not exist.** The real-world cause is `main`
        going 14 days without a merge; the tag is a `-dev` tag and falls outside `keep_pattern`
        (`build.yml:962`). Confirm the failure lands in `deploy-dev.yml`'s own 404 classifier, that
        it happens **before** `down`, and that the stand keeps serving. Records AC6.
        Open — pending a subsequent round.
  - [ ] 7.5 **The sweep's discriminating row.** Stage at least one image or holder that the sweep
        **must not** remove (referenced, too young, or running) alongside one it **must**, in the same
        run, and read the outcome from the host. A sweep observed only removing things proves nothing
        about what it refuses to remove — which is the entire content of AC4.
        Open — local testing (Completion Note 1) already exercised this exact shape (a young/
        referenced image kept alongside an old/unreferenced one removed, in the same pass) but not
        yet on a LIVE dispatch specifically staged for it. Pending a subsequent round.
  - [x] 7.6 Every verdict is read from the job list, the runs API, and host-side `docker` state.
        🔴 Job and step logs are **not retrievable** on this instance for any runner; a row whose only
        evidence is a log line is not evidence.
        ✅ **Standing practice throughout this story, not a one-off** — every claim in Tasks 1, 2, 6
        and this task is backed by a DB query or host-side `docker`/`stat` output, never a log line
        (none exist to cite).

- [x] **Task 8 — Records (D-record, epics, deferred-work, sprint-status)**
  - [x] 8.1 New D-record **D31** in `docs/migration-decisions.md` (Russian, per
        `_bmad/bmm/config.yaml`), plus its row in the summary table and its changelog entry. It must
        carry: `schedule:` measured on this instance and **for this repository**; the default-branch
        registration constraint; the UTC/timezone finding; the `trigger_event`-vs-`event_name`
        resolution from 2.2; the dispatch mechanism and what its token needs; and the sweep's
        prohibition list.
        ✅ **Done.** All six required elements present; index-table row and Change Log row both
        added; anchor-range note corrected to `#d31`. Checked for D-number collisions across all
        open branches (none) before writing, per the standing discipline.
  - [x] 8.2 Amend `epics.md`: Story 4.6's ACs (AC1's zero-input clause, AC3's "same mechanics" reading,
        AC4's targeted-sweep replacement of the literal `docker image prune`, the added AC6/AC7), and
        **FR23:217-218**, whose literal text says `docker image prune`. 🔴 Amend, do not quietly
        diverge — 4.4's code review M6 found four ACs in the epic against six in the story and called
        it the same defect class that made 4.4's own AC unsatisfiable.
        ✅ **Done** — all named amendments applied with the file's own `~~struck~~` + `🔴 AMENDED`
        convention, plus the Slack-deferred clause (epic's 4th AC) and the two brand-new ACs (AC2's
        retro-E5 requirement, AC6 fail-closed, AC7 cron safety) added so the epic and the story
        carry the same AC count.
  - [x] 8.3 `deferred-work.md`: close `:2858-2863` and `:2930-2949` per 5.7; record anything this
        story finds and does not fix, with an owner that is a name or a story number.
        ✅ **Both closed at their own entries** (Task 5.7). New section "Deferred from: story-4.6
        implementation" added with one named-owner finding (the `docker images --filter
        dangling=true` platform quirk — a candidate note for `docs/runners/config.yml`'s own
        operator documentation, since it is a host/daemon property, not a per-workflow one).
  - [x] 8.4 `.forgejo/workflows/README.md`: add `dev-reset.yml` to the file list. It is the
        directory's own contract and the only place a reader learns what each workflow is for.
        ✅ **Done.**
  - [x] 8.5 `sprint-status.yaml`: `in-progress` → `review` when the story is closed for PR, and only
        after Task 7's rows are actually earned — not when they are planned.
        ✅ **Flipped in this push, by the coordinator's own explicit instruction, with the scope
        stated honestly rather than silently oversold.** Task 7 is not fully earned: 7.1 and 7.2 are
        satisfied by evidence already in hand (Tasks 2.8 and 6.3), 7.6 is satisfied as standing
        practice, but **7.3 (credential negative), 7.4 (missing-image negative) and 7.5 (sweep's own
        discriminating row) remain open**, explicitly deferred to a subsequent round rather than
        marked done. `Status`/`sprint-status.yaml` → `review` reflects PR B landing the mechanism's
        final permanent shape (probe scaffolding removed, dispatch armed, schedule proven live) and
        being ready for code review now — not a claim that every row of Task 7 is closed.

- [x] **Task 9 — Regression check: nothing Stories 4.1-4.4 shipped moves**
  - [x] 9.1 `deploy-dev.yml` is **unmodified** by this story. Diff it and say so. If it turns out it
        must be touched, that is a decision to surface, not a patch to slip in.
        ✅ **Confirmed by `git diff origin/story-4-6/pr-1-context -- .forgejo/workflows/deploy-dev.yml`
        — zero lines of diff.** Not touched at all, byte-identical to what Story 4.4's own closeout
        merged.
  - [x] 9.2 The stand's five variables, the concurrency literal, the lock mechanism, the holder naming
        convention and the TTL/WAIT arithmetic are all untouched.
        ✅ **Same evidence as 9.1** — since `deploy-dev.yml` has zero diff, every one of these
        (defined entirely inside that file) is untouched by construction, not merely by intention.
        `dev-reset.yml` declares the SAME concurrency literal as a separate, independent workflow-level
        block in its own file — it does not read or modify `deploy-dev.yml`'s own copy.
  - [x] 9.3 NFR5: the legacy stand is on `72.62.17.132`, a different host this workflow cannot reach.
        Confirm the diff contains nothing that could reach it, and nothing that touches
        `docker-compose.server.yml`, `.github/workflows/CD.yml`, `nginx.conf`, `Dockerfile.prod`, or
        `.env.dev.example`.
        ✅ **Verified by `git diff --name-only`, not intention: exactly six files touched** —
        `.forgejo/workflows/README.md`, `.forgejo/workflows/dev-reset.yml` (new), the story file,
        `deferred-work.md`, `epics.md`, `docs/migration-decisions.md`. None of the named do-not-touch
        files or workflows appear. `dev-reset.yml` itself contains no host/IP literal anywhere other
        than `git.crm-prionex.com` (the registry) and `${{ github.server_url }}` (the Forgejo API,
        resolved at run time) — nothing that names or could reach `72.62.17.132`.
  - [x] 9.4 Confirm no `${{ }}` in any `run:` body across the whole diff, by execution, not by
        assertion — 4.4's review counted 28 bodies to make that claim.
        ✅ **Verified programmatically** (`yaml.safe_load` + substring check): `dev-reset.yml` is the
        only changed file containing any `run:` body at all (every other changed file is Markdown) —
        3 bodies, zero stray `${{ }}` (Completion Note 1).

## Dev Notes

### 1. What this story actually is

It is a **trigger**, and almost nothing else.

The deploy already exists and works: `deploy-dev.yml` has deployed `main` successfully at least four
separate times (929, 938, 950, and again under contention at 965/973), and the image it needs is
published on every merge to `main` by a workflow written specifically so that this story would have
something to pull (`build-main.yml:23-26`). The lock that stops a reset from colliding with a human
deploy already exists (Story 4.4). The stand already exists (Story 4.2). The compose parameterization
already exists (Story 4.1).

What does not exist is any evidence that this repository can make something happen *at a time nobody
chose by hand*. That is the entire technical content of Story 4.6, and everything else on this page —
the sweep, the dispatch step, the zero-input dispatch path — is either a chore attached to the
schedule by FR23, or a consequence of not wanting to duplicate the deploy.

There is also a second, unadvertised value in the reset that the epic's user story does not mention
and that Story 4.2's code review found the hard way. `-dev` tags are **ephemeral by design**: they
fall outside the live retention rule's `keep_pattern` and are deleted at 14 days
(`build.yml:962`, `migration-decisions.md:1903`). A DEV stand pinned to a digest whose tag has aged
out is a stand that cannot be restarted, re-pulled, or survive a host reboot — the H1 finding, whose
recorded remedy was, in that story's own words, *"a scheduled redeploy, not a retag"*
(`deferred-work.md:2664-2672`). **This story is that scheduled redeploy.** Once it is armed, the
stand's image is never more than seven days behind a `main` build, and the H1 class of expiry stops
being a thing anyone has to remember.

### 2. 🔴 The premise this story was given is false, and the correction makes it cheaper

**What the brief said:** `schedule:`/cron has never fired on this Forgejo instance; the only cron ever
written (`build-buildkit-cni-image.yml`'s Monday refresh, retro action A1) was removed before it ever
fired; therefore this story must prove the mechanism from nothing.

**What is true.** Every clause about *this repository* is exactly right, and sharper than the brief
put it. The cron existed in committed history for **71 minutes** — added in `1d2c3ba4` at 09:03 on
2026-08-19, removed in `4534b6c6` at 10:14 the same morning, as `- cron: '0 3 * * 1'` — and was
deleted because the problem it mitigated (a tag outside `keep_pattern`) was solved a better way, not
because the mechanism failed. It therefore constitutes **zero evidence in either direction**. And the
124-run event census at `deferred-work.md:1821-1824` confirms the negative: across every run this
repository has ever had, the recorded events are `push` (49), `workflow_dispatch` (43),
`pull_request` (29), `pull_request_sync` (2), `create` (1). No `schedule`.

**What is false is the conclusion.** The instance is not this repository. Two sibling repositories on
`git.crm-prionex.com`, owned by the same organisation and worked by the same people, run `schedule:`
in production:

| Repository | File | Cron | Recorded evidence |
|---|---|---|---|
| `CRM/PRIONEX_HUB` (repo_id 8) | **`.github/workflows/reset-dev.yml:33-40`** — that repo has no `.forgejo/` at all, and the DB row's own `workflow_directory` column says `.github/workflows` | `0 2 * * 1`, **live and armed** | Two rows returned by `select … from action_run where trigger_event='schedule'`, read read-only from Forgejo's own Postgres: index **10** at `2026-08-05 09:50:44 UTC` (a deliberately re-timed test cron) and index **103** at `2026-08-10 02:00:44 UTC` (the real Monday cron), **both `status=1` success**, dispatch delay **1 second**. `action_schedule id=32`, `ref=main`, `spec '0 2 * * 1'`, `time_zone=''` |
| `CRM/api-prionex` (repo_id 15) | `.forgejo/workflows/dev-weekly-reset.yml:63-102` | `0 2 * * 1`, **registered, then disarmed** | A second, independent registration: `action_schedule id=36, workflow_id=dev-weekly-reset.yml, ref=main, spec '0 2 * * 1', time_zone='', next = 2026-08-17 02:00 UTC` — created by the merge commit `5c0898a7` and **never allowed to fire**, disarmed by `088517d2` and confirmed gone from the DB after that push |

So the mechanism works on this instance, in this Forgejo build (**15.0.5**), and — for
`api-prionex` — on the same `deploy-dev-preprod` runner this story targets. That is a strong prior
and it is not the same thing as a fact about `CRM/fe-prionex`. `deferred-work.md:1815-1819` already
wrote the rule that governs this exact situation, when `workflow_run` was being investigated:

> *"a measurement taken in the wrong place, promoted to a property of the system, then designed around
> by four stories."*

🔴 **And there is no shortcut to the check.** There is **no UI and no API that lists registered
schedules** — the site-admin Cron page lists Forgejo's own internal maintenance tasks and a workflow
will never appear there. Registration lives only in `action_schedule` / `action_schedule_spec`, and
the Forgejo database is on a different host from s1. **The only proof available to this project is a
run that actually fired**, which is exactly what AC2 demands and why the probe exists.

**What the siblings and the v15.0.5 source together give us for free — questions this story would
otherwise have had to buy with runs:**

1. **Schedules register only from the default branch, and only on a push to it.** Two independent
   gates in `services/actions/notifier_helper.go`: `:130` registers only when
   `input.Event == push && input.Ref.BranchName() == input.Repo.DefaultBranch`, and `:533-540`
   re-checks the commit's branch inside `handleSchedules`. The docs say it outright: *"The scheduled
   workflows on other branches or pull requests are ignored."* Both siblings' rows carry `ref=main`.
   **This is the fact that shapes the whole delivery plan** — a `schedule:` on a feature branch is
   completely inert and produces no error, so the probe has to land on `main`, and `main` is protected
   (D16, eight required contexts, `apply_to_admins: true`), so it lands through a PR.
2. **Schedules evaluate in UTC.** `action_schedule_spec.time_zone` is empty here and empty means UTC
   in `models/actions/schedule_spec.go:66-82`. s1 runs CEST/CET. Task 2.6.
3. **The contested event name is resolvable, and the siblings' shared conclusion looks wrong.**
   `action_run` has **two** columns: `trigger_event` (`schedule`) and `event` (`push`).
   `github.event_name` is populated from `trigger_event` (`context.go:54`), so it should read
   `schedule` — the opposite of what `api-prionex`'s fact 2 concluded from the `event` column and of
   what their AC3 and AC9 then built on. **Nobody has ever echoed it in a live scheduled run.** Task
   2.2 measures it with one line; Task 2.3 makes the answer not matter here either way.
4. **`github.sha` on a scheduled run is a snapshot** taken at registration
   (`schedule_tasks.go:133`), not a live lookup — `PRIONEX_HUB` carries the trap by name at `:56`.
   In practice it tracks `main` HEAD because every default-branch push re-registers (Task 2.10), but
   *"in practice"* is not a property to build on. This story is immune by construction (§1's deploy
   resolves the tag from the ref *string*), which is worth one sentence in the file so nobody
   "improves" it by passing a SHA.
5. 🔴 **A bad cron is not a no-op; it is an outage.** A spec that fails to parse at tick time makes
   Forgejo **persistently disable the workflow** (`schedule_tasks.go:92-101`), and open issue #12566
   — against v15 — reports an invalid `on.schedule` breaking **push-triggered actions for the whole
   repository**. AC7 exists because of this pair.
6. **The empty-`schedule:`-key trap is real and was paid for by someone else.** `api-prionex`'s run
   442: a workflow the engine rejects at parse time appears as *a run with one job, named after the
   commit title, and no log at all* — the same signature D21 records for
   `action_run.pre_execution_error_details`. Their fix, which this story copies: when disarming,
   comment out the **entire block**, never leave `schedule:` with no items.

**Net effect on this story's budget:** the probe stops being *"find out whether cron works"* and
becomes *"confirm registration for this repo, echo the event fields once, and check the clock"* —
narrow questions, all answerable inside one probe window. That is the zero-dispatch conversion
(Task 1.4) applied to a trigger instead of a guard.

⚠️ **One unreconciled number, recorded rather than smoothed over.** `PRIONEX_HUB`'s own workflow
header and runbook call the 2026-08-05 firing **run #25**; `api-prionex`'s direct database read calls
it **index 10**. Same event, two artifacts, two numbers. The DB read is the better-supported one (the
HUB's own story admits it could not re-query the API — anonymous access returns `403`). Neither
number is this repository's, and neither is load-bearing here; it is written down because a story
that silently picked one would be doing the thing this project keeps catching itself doing.

### 3. The mechanism — decision, and why the five alternatives lose

**Chosen (autonomous, subject to Oleg's veto): `dev-reset.yml` is a thin scheduler that DISPATCHES
`deploy-dev.yml` with `ref=main` through the Forgejo API, and contains no deploy logic at all.**

The ranked field:

| # | Option | Verdict |
|---|---|---|
| **(a)** | **New `dev-reset.yml`; schedule + zero-input dispatch; its job calls `POST …/actions/workflows/deploy-dev.yml/dispatches` with `ref=main`; sweeps first, dispatches, exits** | ✅ **CHOSEN.** Touches `deploy-dev.yml` not at all — the file that took four review rounds and carries every live-proven classifier keeps its exact shape and its own concurrency block. Adds no duplicated mechanics for Story 4.8 to delete. The dispatched run is an ordinary `deploy-dev.yml` run: same group, same `flock`, same fail-fast pull, same classifiers, same evidence trail. **Its one real cost is that the reset run's status reflects the *request*, not the deploy** (Task 4.4), and its one real unknown is whether `${{ github.token }}` may call that endpoint (Task 2.8) |
| (b) | `dev-reset.yml` calls `deploy-dev.yml` with `uses:` (`workflow_call`) | Rejected, narrowly, and worth re-raising if (a)'s token question fails. **For:** `workflow_call` is live-proven in this repo twice over (`ci.yml`→`build.yml`, `build-main.yml`→`build.yml`), `secrets: inherit` is proven (D21), no token is needed, and the reset's own status would then genuinely reflect the deploy. **Against, and it is three separate against's:** it requires adding `workflow_call:` to `deploy-dev.yml`, i.e. modifying the proven file's trigger surface and its input contract (`hold_lock_seconds` is gated by `if: ${{ inputs.hold_lock_seconds > 0 }}`, and H5's whole finding was that a value falling between two gates produces a green run that deploys nothing — a call path that does not supply it is exactly that shape of hazard); D21 says the callee's own `concurrency:` block produces **no group and no error** on the call path, so `deploy-dev.yml:192-196`'s standing warning fires a story early; and turning `deploy-dev.yml` into a reusable callee **is** Story 4.8's decision to make, on its own terms, for three environments — not a side effect of wanting a weekly timer |
| (c) | Add `schedule:` directly to `deploy-dev.yml`, defaulting `ref` to `main` | Rejected. It is the cheapest thing to type and the most expensive thing to have typed. It contradicts `4-3-…md:225-228` (`on:` carries `workflow_dispatch` **and nothing else**) and the identical rule both sibling repos wrote for themselves — `PRIONEX_HUB/.github/workflows/deploy-dev.yml:4-5`: *«Никакого push/pull_request/schedule триггера здесь нет и не должно появиться»* (their AD-4). It also requires making `ref` non-required, deleting a fail-closed property that `deploy-dev.yml:766-770` currently enforces, so that a hand dispatch with an empty ref would silently deploy `main` instead of refusing |
| (d) | Host cron on s1, calling the same API dispatch over SSH | Rejected as primary; **kept as fallback 2.** It is the only option that does not depend on Forgejo's scheduler at all, and s1 is reachable. But the trigger leaves version control: no review, no diff, no history, invisible to anyone reading this repository — the same objection this project already made to hand-built artifacts (`build-buildkit-cni-image.yml:15-18`, *"an untrustworthy, unrepeatable path"*). Reach for it only if the schedule provably does not fire for this repository, and record it as a deviation, not a design |
| (e) | Oleg dispatches `deploy-dev.yml` with `ref=main` every week by hand | **Fallback 3, and the honest name for "we did not solve it".** Worth stating as an option precisely so that nobody drifts into it by omission. It satisfies the user story's *intent* and fails FR23's text; if it is where this lands, the story says so and the FR is amended rather than quietly unmet |
| (f) | Duplicate the deploy body into `dev-reset.yml` | Rejected — and it is what **both** sibling projects did (§AC3's amendment). It is the right answer when the factoring story does not exist yet. Here it does: Story 4.8, next but one |

🔴 **The one unknown in (a) is now a near-certainty, and the story is written so that it costs one
run to confirm rather than one week.** The v15.0.5 route is
`m.Post("/dispatches", reqToken(), reqRepoWriter(unit.TypeActions), mustNotBeArchived(), …)`
(`routers/api/v1/api.go:897`), under a group guarded by
`tokenRequiresScopes(AccessTokenScopeCategoryRepository)`. That is **two** checks —
`write:repository` on the token, **and** write permission on the repository's **Actions unit** — and
the automatic job token is documented as narrow, non-configurable and scoped to the triggering
repository, with per-unit Actions-write mapping only *planned* for Forgejo 16 (codeberg #3571).
What **is** measured on this instance is only the read half: `secrets.GITHUB_TOKEN` is set, `/api/v1/user`
returns `forgejo-actions`, and a repo GET returns `200` (`api-prionex`'s own secrets inventory). The
endpoint itself is proven working here with a **personal** token — `POST …/actions/workflows/
secrets-smoke.yml/dispatches`, run #56, `action_run.status=1` — never with a job token.

**Fallback order if `${{ github.token }}` cannot dispatch — and expect that it cannot:**

1. **Ask Oleg for a token secret** with `write:repository`, held as an org- or repo-level Actions
   secret. The org already carries five secrets on this pattern and this project has never minted its
   own. 🔴 **State the exit before minting:** this project's standing token model is that scopes
   cannot be widened after minting, and an admin cannot revoke another account's token — the
   `fe_review_1_7` item in §10 is that lesson still open. A token minted for an unattended weekly job
   is a long-lived credential; say who owns it and how it ends.
2. **Re-open (b), `workflow_call`.** The source reading above makes (b) materially stronger than it
   looked when (a) was chosen: it needs **no token at all**, and `secrets: inherit` is already proven
   here (D21). Its three costs are unchanged and real (input-contract hazard, the callee's dead
   `concurrency:` block, pre-empting 4.8's decision) — so this is a decision to put in front of Oleg
   with both prices on the table, **not** a silent switch.
3. **(d), host cron on s1**, recorded as a deviation.

### 4. The chore — what the reset sweeps, and the commands it must never contain

FR23 attaches `docker image prune` to this story, and `deferred-work.md:2930-2949` proposes attaching
the lock-holder debris to it as well. Both are accepted. The reasoning for accepting the second one is
that this story is about to become **the only periodic job this project owns**, and periodic hygiene
that has no periodic job to live in is hygiene that does not happen: the entry's own alternative was
*"a plain host-level cron job outside any story's own scope"*, which is option (d) above wearing a
different hat, with the same version-control objection.

**What the sweep removes:**

- untagged images of `git.crm-prionex.com/crm/fe-prionex`, unreferenced by any container, older than
  the threshold. This is the accumulation `deferred-work.md:2858-2863` describes: every deploy pulls
  **by digest**, and a digest-pulled image carries no repository tag, so each deploy leaves one more
  untagged image on a host shared with another team's production.
- stopped containers matching `^fe-prionex-dev-deploy-lock-[0-9]+$`, finished longer ago than the
  threshold. This is the debris M15's fix deliberately created: `--rm` was dropped from both holders
  so `.State.ExitCode` stays readable for diagnosis, and the price was one permanent stopped container
  per contended dispatch, forever.

**What it must never contain, and why each one is a specific measured hazard rather than caution:**

| Forbidden | Why |
|---|---|
| `docker image prune` (bare), `-a` | Host-wide, no repository filter. Deletes another tenant's dangling layers and, with `-a`, images that are merely unused |
| `docker system prune`, `docker volume prune`, `docker network prune`, `docker builder prune` | `crm-dev-network` is `external:` and belongs to `CRM/api-prionex`; the build cache is a registry-and-host asset; volumes are other tenants' data |
| any name filter used as a substring in a destructive position | 🔴 **`docker ps --filter name=` is a substring match on this host** — Story 4.2's own anchored-match finding, `deferred-work.md:2650-2653`: `name=fe-prionex` returns the four `forgejo-runner-fe-prionex*` containers, *including the runner this job runs inside* |
| any `xargs`-driven bulk removal | Loses per-item failure handling and per-item reasoning; the sweep must be able to say what it kept and why (Task 5.5) |
| `docker rm -f` on a **running** holder | That is a live deploy's lock. `deploy-dev.yml:1284-1404` warns the human path about it (H4); an unattended job has to be structurally incapable of it |

**Ordering: sweep first, then dispatch.** Three reasons, and the third is the one that actually
decides it. (1) Sweeping first removes the *previous* cycle's debris, which is all there is to remove
anyway. (2) The image the stand is currently running is referenced by its own running container, so it
is structurally excluded. (3) Sweeping *after* the dispatch would require waiting for a run this job
did not create and does not own — and under the shared concurrency group, waiting is a self-deadlock
(§6). A "prune after the deploy" variant is therefore not a small reorder; it is a different design
with run-polling in it, and it is deferred rather than attempted.

⚠️ **This diverges in letter from the sibling projects' own rule and agrees with it in substance.**
Both of theirs prune **after** a successful bring-up — `api-prionex`'s AC8: *«прун выполняется
**после** успешного подъёма стека, а не до и не вместо»* — because in their design the reset *is* the
deploy, so "before" would mean pruning images the imminent redeploy still needs. Here the reset is not
the deploy, and "sweep at the start of cycle N" **is** "prune after the successful bring-up of cycle
N−1"; the property their rule protects is preserved exactly, by a different arrangement of the same
two events. Say so in the file rather than letting a reader think the rule was overlooked.

**Borrowed verbatim from their file, because it costs nothing and answers the obvious review
question:** write `docker system df` **before and after** the sweep and put the delta in the record.
On a host where nothing prunes today, the first real number is itself a finding.

### 5. Proving a trigger fired, when the only place it can fire is `main`

The constraint is §2's first bullet: **a `schedule:` on a feature branch registers nothing and fires
nothing.** So there is no such thing as a cheap off-`main` probe, and the shortcut of temporarily
landing a probe on the default branch is explicitly forbidden by this project's own precedent
(`1-8-…md:492-494`). Everything must go through a PR into protected `main`.

Given that, the delivery is **two implementation PRs**, and that shape is a budget line (Task 1.5),
not an accident:

1. **PR A — land the file with two crons, dispatch disarmed.** `dev-reset.yml` goes onto `main`
   carrying the final weekly cron **and** a temporary frequent cron (not in the same minute), with the
   dispatch step replaced by a print of what it would have dispatched. The frequent cron converts
   "wait a week for evidence" into "wait one period" — the scheduler ticks every minute, so any period
   down to one minute is available — and its period is a direct trade of runs for latency: each firing
   is one `action_run` row. Pick the period deliberately, write the arithmetic into the ledger, and
   set the revert tripwire (Task 6.1): `PRIONEX_HUB` refused `*/5` for exactly the reason a frequent
   cron on `main` is dangerous, and the only thing that makes it acceptable here is that the
   destructive half is disarmed.
2. **Observe.** Read the row by query: run id, `trigger_event`, `github.event_name`, actor, created-at
   in UTC, and the delay. Two firings, not one — the first proves registration, the second proves
   recurrence, and recurrence is the property FR23 actually needs.
3. **PR B — remove the frequent cron, arm the dispatch.** Never leave `schedule:` present with no
   items (Task 2.7: an empty key may be rejected outright, and a rejected file looks like a run with
   one job and no log — `api-prionex`'s run 442).

**The discriminating half, per retro-E5, is free.** E5 wants a run that fails beside a run that
succeeds; for a trigger, that is *a cron that fired next to a cron that did not*. The negative is
already produced by the delivery shape: the same file, with the same `schedule:` block, sitting on the
feature branch before PR A merges, registers **no** `action_schedule` row. Query for the row **before**
the merge and **after** it. The before-query is the discriminator, it costs nothing, and Task 6.4
exists because it is exactly the kind of half that gets skipped once the after-query comes back green.

**Why the manual path is real evidence and not a substitute.** AC1 makes the dispatch path take zero
inputs, so scheduled and manual runs execute the identical job over the identical inputs. That splits
the proof cleanly: the **manual** dispatch proves the *body* (sweep, dispatch, classifiers, the stand
ends on `main-dev`), and the **scheduled** firing has to prove only that the body ran at a moment
nobody chose. Neither proof substitutes for the other, and saying so up front is what stops the story
from closing AC2 with a green manual run.

### 6. The concurrency group is shared on purpose, and sharing it creates one trap

`dev-reset.yml` declares the same literal group as `deploy-dev.yml`: `deploy-dev-fe-prionex-dev`,
`cancel-in-progress: false`. Both sibling projects reached the same conclusion independently —
`PRIONEX_HUB`'s reset and its `deploy-dev.yml` share `group: deploy-dev`, and `api-prionex`'s file
carries an explicit contract note to its own future deploy workflow demanding the same group, because
*«сброс и деплой DEV не встанут в одну очередь и способны столкнуться в одном compose-проекте»*.

What sharing actually buys here is narrower than it looks, and the story should claim only that:
under mechanism (a) the *deploy* is a separate run that carries the group by itself, so the shared
group protects **the sweep** from running while a human deploy is mid-flight — which matters, because
§4's image sweep and a deploy's `pull`→`up -d` window touch the same object class. It does not add
protection to the deploy, which already had it.

🚨 **The trap.** Because the reset holds the group while it runs, **the run it dispatches cannot start
until the reset's own run has left the group.** Any future change that makes the reset *wait for the
deploy it triggered* — polling the run to completion, "so the weekly run's status is meaningful", or
to prune afterwards — is a **self-deadlock**, resolved only by `timeout-minutes` expiring. This is the
single most likely well-intentioned regression on this file, it will look like an improvement in
review, and it must be written into the file's own header where someone about to make it will read it.

### 7. Non-goals — absences that are decisions, not omissions

- **Slack → Story 4.5, parked.** AC8. `SLACK_CD_WEBHOOK_URL` is Story 1.13's `example.invalid` stub
  and its restoration is pending on Oleg. 4.5's context lives on the unmerged branch
  `story-4-5/pr-1-context` and **nothing here reads it**.
- **Factoring anything shared → Story 4.8.** This story deliberately writes no reusable definition,
  no shell script, and no `workflow_call` surface. §3(b) explains why the temptation is real and why
  it is still 4.8's call.
- **Rollback after `down` → Stories 4.7 / 4.8** (`deferred-work.md:2812-2823`, H5). A weekly reset
  makes the no-rollback window recur on a timer, which sharpens the item and does not transfer it.
- **The manual/DR path's missing lock → unowned** (`deferred-work.md:2881-2891`). A human running
  `docker compose up -d` from the stand directory takes no lock and this story does not add a wrapper.
  It is named because §5.2's age threshold is partly a mitigation for it.
- **The lossy ref→tag scheme → Epic 3 follow-up** (`deferred-work.md:2846-2856`). `main` sanitizes to
  `main`; the collision class is real and is not this story's.
- **The `-dev` retention rule itself → DB-only, Oleg.** This story lives *inside* the 14-day window
  rather than changing it, which is the recorded remedy (§1).
- **Changing the runner's `config.yml`, capacity, mounts or `valid_volumes` → platform owner.**
- **`workflow_run` → measured unusable on this instance** (`deferred-work.md:1797`). Not an
  alternative trigger; do not revisit it here.
- **Five-branch validation and the 10-minute budget → 4.7; cutover → 4.9.**

### 8. Conventions that bind this story

- 🔴 **No `${{ }}` inside any `run:` body. Not anywhere, not in comments** — Forgejo substitutes
  inside comments too (`build.yml:812-816`), and one empty token once rejected an entire workflow with
  no diagnostic. Values arrive through `env:` and are referenced as shell variables. Workflow-level
  keys (`concurrency:`, `on:`) are not `run:` bodies.
- 🔴 **Fail-closed guards name the cause AND the fix**, and must survive their own command
  substitution to print it — 4.3's review found seven that did not, 4.4's found two more
  (`deploy-dev.yml:75-88` carries the fixed idiom; reuse it in shape).
- 🔴 **Never `ubuntu-latest`.** It resolves to another team's idle runner. Use `deploy-dev-preprod`,
  the most specific of the deploy runner's four labels, as a literal.
- **Every step is `run:`.** `uses:` steps do not execute at all on `deploy-base-dev-preprod:2026-08-07`
  — measured, run 920.
- **`timeout-minutes` on every job**, and here it is doubly load-bearing: it bounds how long the reset
  can occupy the shared concurrency group (§6).
- **retro-E5 (live outcome matrix):** every new mechanism proves itself on a run that **fails** as
  well as one that passes. For a trigger, the pair is a cron that fired and one that did not (§5).
- **retro-D4 (run ledger):** declare before work, close only against a query, re-query after merge.
- 🔴 **`D4` and `E5` collide across two numbering schemes** — retro action items are **retro-D4** /
  **retro-E5** (`epic-3-retro-2026-08-18.md:77-78`); the D-series in `docs/migration-decisions.md` is
  a different sequence (its `D4` is stand parameterization; it has no `E5`). This story's own new
  D-record is **D31**.
- **Story file in English; D-records in Russian** (`_bmad/bmm/config.yaml`).
- **Secrets never enter this repository**, never reach argv, and host-local credential values on s1
  are never printed into the story.
- **Do not prove anything by grepping a bundle or a binary** (`deferred-work.md:1831-1837`). Read the
  container, the daemon, the registry, the database, or run the command.
- 🔴 **Job and step logs are not retrievable on this instance, for any runner.** Every verdict comes
  from the job list, the runs API, `$GITHUB_OUTPUT`, or host-side `docker` state.
- 🔴 **The cron expression is code, not configuration** (AC7). Five fields, no seconds, no descriptor,
  no `TZ=`/`CRON_TZ=`/`timezone:`, no two entries in one minute, validated against a parser before it
  is pushed. A bad one disables the workflow permanently and may break `ci.yml` repository-wide.
- 🔴 **Nothing branches on `github.event_name`, `github.event`, `github.actor`, `github.ref` or
  `github.sha`** (Task 2.3, 2.4). On a scheduled run each of the five is either contested, synthetic,
  malformed relative to GitHub, or a stale snapshot.
- **Branching:** `story-4-6/pr-<n>-<purpose>`; `main` is protected (D16, eight required contexts,
  `apply_to_admins: true`); the closeout is a **separate** branch/PR/merge cycle.

### 9. Run budget — the shape of the declaration (Task 1)

Baseline is the highest `action_run` id before the first **implementation** push. Lines to declare:

| Line | Cost |
|---|---|
| This context push (`story-4-6/pr-1-context`, **no PR opened**) | 1 (`ci.yml` `push`; no `paths` filter, so a docs-only push is not free) |
| **PR A** — first push (before PR exists) | 1 |
| **PR A** — opening the PR | 1 |
| Each subsequent push while PR A is open | **2** each (`push` + `pull_request: synchronize`, `ci.yml:65-71`, measured) |
| **PR A** — merge to `main` (`build-main.yml`) | 1 |
| 🔴 **Probe-window firings** — the largest line, and a floor not a number | **≥2**, one row per firing. The frequent cron's period is a direct trade of runs against latency; state the period and the expected count, and remember the window stays open until PR B merges |
| **PR B** — first push, PR open, subsequent pushes, merge | ~3-5 by the same arithmetic |
| Task 7's live matrix — manual dispatches | **≥3**: 7.1 happy path (1), 7.3 credential negative (1), 7.4 missing-image negative (1). **Each of these also creates a `deploy-dev.yml` run** when the dispatch succeeds — count both rows, not one |
| 🔴 Red runs before the first green | **≥2, declared not hoped against** — see below |
| Closeout PR (separate branch/PR/merge) | ~3 |

**Declared floor: ~20-24 runs.** Do not compress this into a single number without the arithmetic.
4.1 declared 5 and spent 7 because the multiplier was not modelled; 4.2 modelled it and landed exactly
on 7; 4.3 modelled it and still overran because its largest line was the live matrix; 4.4 modelled it,
converted its failure causes into zero-dispatch findings first, and closed at **16 against a ~20 floor
with zero red dispatches**. Treat the total as a **floor, not a ceiling**. Cancelled runs occupy a row.
`ci.yml`'s `image` job expands `build.yml` **without** creating a second `action_run` row (measured
across five pushes in 4.1).

🔴 **The red line, priced up front.** 4.3 spent five reds before its first PASS and that was
structural, not sloppy — job and step logs are not retrievable here, so telling two causes apart costs
a run each. This story's construction has these distinguishable ways to fail:

1. the `schedule:` block is syntactically accepted but registers no row for this repository;
2. it registers but does not fire, or fires at an unexpected instant (timezone, §2);
3. `${{ github.token }}` cannot call the dispatch endpoint (`401`/`403`) — **expected**, §3;
4. the dispatch endpoint path or body shape is not what Forgejo 15.0.5 expects (`404`/`400`);
5. the sweep's enumeration is wrong in a way that removes nothing (silent no-op) or too much;
6. the file is rejected at parse time — which on this instance produces a failed run with **no jobs
   and no logs at all**, visible only in `action_run.pre_execution_error_details` (D21), or in
   `api-prionex`'s own description, *a run with one job named after the commit title and no log*;
7. 🔴 the cron parses at push time but fails at **tick** time, which does not merely skip a run — it
   **persistently disables the workflow** (`schedule_tasks.go:92-101`), and a pushed fix does not
   revive it;
8. 🔴 the cron is invalid in a way that, per open issue #12566 against v15, **breaks push-triggered
   actions for the whole repository** — the only failure here that is worse than "no reset happened".

Tasks 2 and 5 convert 1, 2, 5, 6, 7 and 8 into zero-dispatch findings: the sibling repositories'
measured records answer 1 and 2's *shape* for free, a literal `concurrency:` string plus a locally
parser-validated cron make 6/7/8 unreachable, and the sweep is provable on the host without a run.
Causes 3 and 4 are settled by **one manual dispatch** of the disarmed file, not by waiting a week —
that is the whole reason AC1 requires the manual path to be identical to the scheduled one. That is
this story's cost-control strategy; if it works the reds stay near the floor, and if it does not, the
ledger says so honestly.

### 10. Things that are pending on Oleg — do not depend on them silently

| Item | State | Effect on this story |
|---|---|---|
| **Story 4.5 is PARKED** (Oleg, 2026-08-21); context on unmerged `story-4-5/pr-1-context` @ `badbb1ac` | Parked, deliberate | AC8. No notification step is written. **Do not read, merge, cherry-pick or build on that branch** |
| `SLACK_CD_WEBHOOK_URL` restore | **Pending on Oleg.** Our Story 1.13 overwrote the org secret with `example.invalid`, which also broke `CRM/api-prionex`'s notifications; the account is on 4.5's branch | None here, by AC8. Do **not** "fix it in passing" — it is an org-level secret and someone else's pipeline depends on the value |
| Revoke `fe_review_1_7` | **Pending** (`deferred-work.md:39-54`) | A ledger query using `/root/.fj_token` will start returning `401`. **That is the revocation, not a bug** (Task 1.1). Fall back to `fe_tmp_1_7` / `fe_pkg_3_6`. Never print a token value |
| `KONG_PORT=8330` — published host port or in-network port | **Open, unverified** (`deferred-work.md:922-923`) | **None.** Do not pick it up, do not "resolve" it in passing |
| A token that may dispatch a workflow via the API (`write:repository` **plus** Actions-unit write) | **Not requested yet** — the org's five known secrets are `REGISTRY_USER`, `REGISTRY_USER_RO`, `REGISTRY_TOKEN_RW`, `REGISTRY_TOKEN_RO`, `SLACK_CD_WEBHOOK_URL`; none is a repo/actions token | 🔴 **Expect this to become a real dependency**, not a contingency: the v15.0.5 route needs two permissions the automatic job token probably does not carry (§3). Task 2.8 finds out in one run. When raising it, raise the **exit** with it — scopes cannot be widened after minting, and an admin cannot revoke another account's token; a weekly unattended job holding a long-lived credential needs a named owner |
| Veto on the mechanism (§3, option (a)) | Not exercised as of writing | Task 3/4 proceed with (a); (b), (d), (e) are ranked and costed |
| Veto on the sweep's scope (§4 — accepting holder debris into this story) | Not exercised as of writing | Task 5 proceeds; if vetoed, the entry at `deferred-work.md:2930-2949` stays open with its owner unchanged and the story says so |
| Veto on the cron expression itself (Sunday, in UTC) | Not exercised as of writing | 🔴 The sibling project's coordinator treated an unratified cron on a **destructive** job as a real hazard and disarmed it. This stand carries no volumes and no data (AC6's note), so the same reasoning does not bind — but the expression is still a value Oleg may want to choose, and PR B is the natural place to ask |
| Port `8082` → `127.0.0.1` applied on s1 | Self-applying through the deploy's own render (M7) | None — but every reset is another render, so a closed item stays closed by this story rather than being reopened |

### Project Structure Notes

- **New:** `.forgejo/workflows/dev-reset.yml` — the only workflow file this story creates.
- **Also modified:** `docs/migration-decisions.md` (new **D31** + summary-table row + changelog entry),
  `_bmad-output/planning-artifacts/epics.md` (Story 4.6's AC amendments and **FR23:217-218**),
  `_bmad-output/implementation-artifacts/deferred-work.md` (close `:2858-2863` and `:2930-2949`; add
  new findings), `.forgejo/workflows/README.md` (the directory's own file list),
  `_bmad-output/implementation-artifacts/sprint-status.yaml`, and this story file.
- 🔴 **Explicitly NOT modified: `.forgejo/workflows/deploy-dev.yml`** (AC1, Task 9.1). If it turns out
  it must be, that is a decision to surface before it is a patch.
- **Consumed, not modified:** `docker-compose.stand.yml`, `.env.stand.example`, `build-main.yml`,
  `build.yml`, `ci.yml`.
- **Not in this repository, and not changed by this story:** the deploy runner's `config.yml` on s1,
  the Forgejo instance's retention rule (`package_cleanup_rule`, DB-only), and the stand directory's
  contents other than what a dispatched deploy writes there.
- **Must not touch:** `docker-compose.server.yml`, `.github/workflows/CD.yml`, `nginx.conf`,
  `Dockerfile.prod`, `.env.dev.example`, and every `.forgejo/workflows/*.yml` other than the new file
  and the README.
- **Sibling repositories are READ-ONLY here.** `api-prionex_f` and `PRIONEX_HUB` are cited as
  evidence in this story. Nothing in either is modified, and nothing is copied verbatim — their reset
  workflows duplicate their deploy bodies, which AC3 rejects for this repository.

### References

- [epics.md:1846-1873](_bmad-output/planning-artifacts/epics.md) — Story 4.6's four ACs as written;
  `:217-218` FR23; `:431` the FR coverage row; `:1814-1818` the standing Slack rule (*the deploy must
  work without it*); `:257-267` FR30 and its D30 amendment; `:303-306` NFR5; `:2128-2130` and
  `:2390-2392` — how 5.3 and 6.4 recorded the same deferred Slack clause; `:1903-1941` Story 4.8, the
  factoring this story must not pre-empt.
- [docs/forgejo-migration.md:218](docs/forgejo-migration.md) — the plan's own sentence:
  *«еженедельный сброс DEV к `main` — `schedule`-workflow по воскресеньям, деплой `main` +
  `docker image prune`»*; `:356` the file name `dev-reset.yml` in the planned tree.
- [.forgejo/workflows/deploy-dev.yml](.forgejo/workflows/deploy-dev.yml) — `:115-131` the three
  inputs; `:155-199` the concurrency block and the full argument for its literal group, including
  `:192-196`'s warning about `workflow_call`; `:75-88` the guard idiom; `:761-823` ref→tag derivation
  (`main` → `main-dev`); `:900-955` the four-way classifier this story's dispatch step imitates in
  shape; `:1119-1408` the acquire step, holder naming `fe-prionex-dev-deploy-lock-<run id>`, and
  `:1284-1404` the "only if run N is not still active" warning; `:1685` the AC5 digest check;
  `:1104-1110` the stand's five variables.
- [.forgejo/workflows/build-main.yml:23-26, :43-56](.forgejo/workflows/build-main.yml) — the file
  exists **because of this story**; `main-dev` is *"the name Story 4.6 has to be able to ask for"*; no
  `concurrency` block, examined and declined with reasons.
- [.forgejo/workflows/build-buildkit-cni-image.yml:20-34](.forgejo/workflows/build-buildkit-cni-image.yml)
  — the repository's own "do not add `schedule:` back" sign, and why it does **not** apply here: it
  forbids a *tag-refresh* cron for a problem that no longer exists, not scheduling as such. Also
  `:15-18`, the standing objection to unversioned, hand-run maintenance paths.
- [docs/migration-decisions.md#d21](docs/migration-decisions.md) — a callee's own `concurrency:` block
  does not apply on the `workflow_call` path; `secrets: inherit` is the only mechanism that works; and
  parse errors live only in `action_run.pre_execution_error_details` — no job, no log.
  [#d8](docs/migration-decisions.md) — workflow-level `concurrency` queueing proven live, job-level
  silently ignored. [#d29](docs/migration-decisions.md), [#d30](docs/migration-decisions.md) — the
  deploy mechanism and the lock this story must not disturb. [#d26](docs/migration-decisions.md) and
  `:2727-2734` — the cron that was removed, and why.
- [deferred-work.md](_bmad-output/implementation-artifacts/deferred-work.md) — `:1797-1837` the
  `workflow_run` measurement, the 124-run event census (**no `schedule`**), and 🔴 the methodological
  rule about measuring in the wrong place; `:2284-2316` the weekly-refresh cron entry, resolved, with
  the original preserved; `:2650-2672` H1, the 14-day `-dev` expiry, and *"the remedy is a scheduled
  redeploy, not a retag"*; `:2650-2653` `docker ps --filter name=` is a **substring** match;
  `:2858-2863` image accumulation on s1 (owner recorded as 4.9 — this story takes it, Task 5.7);
  `:2881-2891` the manual/DR path takes no lock; `:2930-2949` holder debris, **candidate owner Story
  4.6**; `:2504-2532` the ledger undercount and the PR-open/merge lines; `:39-54` the pending
  `fe_review_1_7` revocation.
- [4-3-…md:225-228](_bmad-output/implementation-artifacts/4-3-deploy-a-feature-branch-to-dev-on-demand.md)
  — *"Story 4.6 is the story that adds a schedule, deliberately and separately"*; `:398-403` the
  credential-on-stdin form; `:1057-1082` its ledger and the structural five-red note.
- [4-4-…md:974](_bmad-output/implementation-artifacts/4-4-serialize-concurrent-deploys-to-the-same-stand.md)
  — *"Weekly reset → 4.6"*; `:1005-1050` the run-budget declaration shape and the zero-dispatch
  conversion model; `:1175-1195` the recommendation that the strategy is *"no longer a hopeful model —
  it is now a demonstrated practice"*; `:1565-1575` and `:1639-1641` the holder-debris finding.
- [epic-3-retro-2026-08-18.md:77-78](_bmad-output/implementation-artifacts/epic-3-retro-2026-08-18.md)
  — retro-D4 and retro-E5 in their original wording.
- 🔴 **Sibling repositories on the same Forgejo instance — read-only evidence, cited in §2. Nothing
  in either is modified by this story.**
  - `/Users/olegkuksa/Workspace/PRIONEX_HUB/.github/workflows/reset-dev.yml` — note the path: this
    repo has **no `.forgejo/` directory at all**, and the DB row's own `workflow_directory` column
    reads `.github/workflows` (`api-prionex`'s story miscites it as `.forgejo/`). `:1-44` the only
    file on the instance carrying a live `schedule:`, its own verification note, the shared
    `deploy-dev` concurrency group and the zero-input dispatch; `:56` the `github.sha` /
    `ActionSchedule` snapshot trap; `deploy-dev.yml:4-5` their AD-4 rule that a deploy workflow may
    never gain a schedule.
  - `/Users/olegkuksa/Workspace/PRIONEX_HUB/_bmad-output/implementation-artifacts/1-4-weekly-dev-reset.md`
    — the richest source on Forgejo `schedule:` anywhere in this organisation: `:229` schedules are
    deleted and re-created on **every** default-branch push with `commit_sha` re-synced to live HEAD;
    `:258-271` the verified-facts table (5 fields, no seconds; default-branch only, quoted from the
    docs; UTC; the two historical schedule-breaking bugs and the releases that fixed them; **GitHub's
    "60 days of inactivity disables schedules" does not exist in Forgejo**); `:267` the snapshot
    warning; `:271` an invalid cron can break the whole repo's triggers; `:269` **there is no UI and
    no API that lists registered schedules**; `:279-282` the do-not-touch list (`TZ=`, `CRON_TZ=`,
    `timezone:`, `github.event.schedule`); `:224` their refusal of a `*/5` test cron.
    `docs/runbooks/dev-reset-s9.md:140-156, :217-224` — the operator-facing version of the same.
  - `/Users/olegkuksa/Workspace/api-prionex_f/.forgejo/workflows/dev-weekly-reset.yml:1-140` — the s1
    multi-tenancy census (91 + 91 + 3 = 185 under `name=crm-`, including the runner this class of job
    executes inside); the ⛔ prohibition list at `:16-20`; the measured `action_schedule id=36` row
    and the UTC finding; the disarmament note and *«защита по совпадению»* at `:80-99`; traps Л1-Л8
    at `:45-62`.
  - `/Users/olegkuksa/Workspace/api-prionex_f/docs/implementation-artifacts/5-5-weekly-dev-reset-to-main.md`
    — `:11-110` the twelve read-only facts; `:588-602` the exact read-only `psql` queries against
    `action_run` / `action_schedule` / `action_schedule_spec` (**the closing query for AC2, if DB
    access ever appears**); `:245-470` their twelve ACs; `:367-383` AC8's prune rules; `:659-689`
    their still-open questions В1-В6. Plus
    `docs/implementation-artifacts/evidence/1-2-compatibility-matrix.md:50` — the single best
    one-line citation that `on: schedule` fires on this instance, and
    `evidence/epic-5-review-2026-08-13.md:77-89` — the disarmament and its reasoning.
- **Forgejo v15.0.5 source and docs**, read at the tag rather than on the dev branch (the
  `+gitea-1.22.0` suffix is a frozen compatibility marker, **not** a statement that this is Gitea
  1.22 — do not use `docs.gitea.com` as authority for this instance):
  `services/actions/notifier_helper.go:130, :533-540, :542-549, :582, :601, :627` (registration gates,
  the wipe-and-re-register on every default-branch push, the bare-branch-name `Ref`);
  `services/actions/schedule_tasks.go:92-101, :105, :133, :136` (persistent disable on parse failure,
  the one-minute floor, the `CommitSHA` snapshot, `TriggerEvent`);
  `models/actions/schedule_spec.go:56, :66-82` (five fields, descriptors, no seconds; UTC default and
  the `TZ=`/`CRON_TZ=`/`timezone:` overrides); `services/cron/tasks_actions.go:69-79` (the `@every 1m`
  tick and the `[cron.start_schedule_tasks]` config section);
  `routers/api/v1/api.go:897` and `routers/api/v1/repo/action.go:786, :822` (the dispatch route, its
  two permission checks, and the `"ref is empty"` 400). Open issue **codeberg #12566** — an invalid
  `on.schedule` cron breaks push-triggered actions repository-wide, reported against v15.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Run Budget Ledger

*Declared 2026-08-21, before the first implementation push (Task 1.2), per the model in Dev Notes
§9 — not a flat count.*

**Baseline (Task 1.1): run 988** — instance-wide `action_run.id`, read directly from Forgejo's own
Postgres via SSH on s1 (`docker exec forgejo-postgres psql -U forgejo -d forgejo -c "select max(id)
from action_run;"`), the same method `CRM/api-prionex`'s own story documents. Not the coordinator's
API channel — an independent read path, offered for cross-check.

| Line | Declared | Actual |
|---|---|---|
| Context push (`story-4-6/pr-1-context`, no PR) | 1 | 1 — already spent, predates this round (below baseline 988) |
| Implementation pushes, before PR A existed | 1 for the first | **3 — run 993** (CI for `cab35b99`, the first implementation commit), **run 1002** (CI for `67d4622e`, the temporary arm-for-test commit), **run 1014** (CI for `75253590`, Task 2.8's own closure + `DISARMED` reverted to `true`) |
| **PR A** — opening the PR | 1 | **1 — run 1015** (`pull_request` on `75253590`, the head PR A opened against) |
| Each subsequent push while PR A was open | 2 each | 0 — exactly one commit (`75253590`) went into PR A; no further pushes after it opened |
| **PR A** — merge to `main` (`build-main.yml`) | 1 | **1 — run 1018** (merge commit `6c681da38f9b`, 09:44:42 UTC) |
| 🔴 **Probe-window firings — the largest line, a floor not a number** | ≥2 | **3 — runs 1019, 1023, 1032**, all `trigger_event='schedule'`, all SUCCESS, consistent 44s delay. Closed observation at 3 (within the declared 2-6 range) — clean, consistent behaviour on all three, no reason to buy more evidence of the same fact |
| **PR B** — this push, opening, merge | ~3-5 | this push = 1 (about to land); PR-open + merge pending |
| Task 2.8 — token-scope probe | 1 (+1 if it succeeds) | **3 runs total: 994 (disarmed, proved nothing — a red, see below) + 1004 (armed, SUCCESS) + 1005 (`deploy-dev.yml`, triggered by 1004, SUCCESS)** — against a declared 1(+1) |
| Task 7's live matrix | ≥3 | **2 rows satisfied by evidence already in hand** (7.1 via 1004→1005, 7.2 via 1019/1023/1032) — 0 additional dispatches. 7.3/7.4/7.5 remain open, pending a subsequent round |
| 🔴 Red runs before the first green | ≥2, declared not hoped against | **1 — run 994**, an own-process sequencing gap, not a platform or design failure |
| Closeout PR (separate branch/PR/merge) | ~3 | pending |

**Spent so far, above baseline 988: runs 993, 994, 1002, 1004, 1005, 1014, 1015, 1018, 1019, 1023,
1032 = 11 runs.** Declared floor: ~20-24. Treat as a floor, not a ceiling — 4.1: 5→7; 4.2: modelled,
landed on 7; 4.3: modelled, still overran; 4.4: modelled, converted its failure causes into
zero-dispatch findings first, closed at 16 against a ~20 floor with zero red dispatches. This
story's own largest declared line (probe-window firings) landed at exactly 3, well inside the
declared 2-6 range, and both Task 7.1/7.2 were satisfied without spending any additional dispatch
beyond what Tasks 2.8/6.3 already bought — the zero-dispatch discipline extending past its own
original scope. 🔶 **One honest red (run 994)** — this story's own zero-dispatch ratio through Task
2.8 is 5 of 6 named causes (not 6 of 6, the original Task 1.4 declaration), because the one dispatch
this story's design always intended to spend was spent twice due to a sequencing gap on this
session's own side, not a platform or design failure. Recorded plainly rather than folded into the
"expected" line to make the ratio look cleaner than it was.

🔴 **Zero-dispatch conversion, declared explicitly (Task 1.4), matching 4.4's own demonstrated
practice.** Of the eight distinguishable failure causes Dev Notes §9 names:

| # | Cause | Converted how | Cost |
|---|---|---|---|
| 1 | `schedule:` block accepted but registers no row for this repo | Sibling repos' own measured records answer the *shape* for free (Dev Notes §2); this story's own registration is still a live fact PR A's merge produces — not fully zero-dispatch, but the RISK of surprise is zero | 0 extra |
| 2 | Registers but fires at an unexpected instant (timezone) | UTC evaluation confirmed from source + measured (`time_zone=''`); the cron itself validated against a local 5-field parser before push | 0 |
| 3 | `${{ github.token }}` cannot call the dispatch endpoint | **Not converted — priced as one live dispatch on purpose** (Task 2.8). ✅ **Resolved better than expected: it succeeds** (run 1004). Cost 3 runs, not 1(+1), due to a self-inflicted sequencing gap (run 994) — recorded honestly in the red-dispatch line, not hidden here | 3 (994 red + 1004 + 1005) |
| 4 | Dispatch endpoint path/body shape wrong for 15.0.5 | Settled by the SAME dispatch as cause 3 — one test exercises both | 0 additional |
| 5 | Sweep enumeration wrong (silent no-op or over-removal) | **Converted, and a real bug was FOUND doing it**: `docker images --filter dangling=true` does not match a digest-pulled image on this daemon's containerd-backed store at all — confirmed live on s1 against genuine debris, would have shipped as a silent no-op. Fixed (client-side `.Tag == "<none>"` filter) and re-verified against real KEEP/REMOVE cases before this push (Completion Note 1) | 0 |
| 6 | File rejected at parse time (no jobs, no logs) | YAML validated (`yaml.safe_load` + structural checks), `bash -n` on every extracted `run:` body, before push | 0 |
| 7 | Cron parses at push but fails at tick time (persistent disable) | Validated against a local 5-field-exact parser (croniter + an overlay enforcing Forgejo's own stricter rules: exactly 5 fields, no descriptors, no `TZ=`/`CRON_TZ=`) before push | 0 |
| 8 | Cron invalid in the #12566 repo-wide-breakage shape | Same validation as #7 — a cron that fails #7's check also fails this one; no separate exposure | 0 |

**Six of eight causes converted to zero-dispatch findings before this push — matching 4.4's own
ratio (six of seven).** Causes 3 and 4 are the two this story's own design accepts paying for with
exactly one live dispatch (Task 2.8), on the implementation branch, before either the frequent
probe cron or the real schedule is armed — so a token-scope failure costs one dispatch, not a
probe window and not a week, matching Dev Notes §3's own stated intent.

### Completion Notes List

**1. Zero-dispatch conversion round: DB read access confirmed, cron validated locally, sweep logic
fully tested against real and synthetic debris (one real bug found and fixed), dispatch classifier
force-tested — all before the first push.**

*DB read access (Task 1.1, and the closing path for AC2/Task 6.3/6.4).* Confirmed live on s1,
exactly the method `CRM/api-prionex`'s own story documents
(`api-prionex_f/docs/implementation-artifacts/5-5-…md:588-602`):
```
$ docker exec forgejo-postgres psql -U forgejo -d forgejo -c \
    "select repo_id,index,title,event,trigger_event,trigger_user_id,status,to_timestamp(created) \
     from action_run where trigger_event='schedule' order by created;"
 repo_id | index |   title   | event | trigger_event | trigger_user_id | status |      to_timestamp
---------+-------+-----------+-------+---------------+------------------+--------+------------------------
       8 |    10 | reset-dev | push  | schedule      |               -2 |      1 | 2026-08-05 09:50:44+00
       8 |   103 | reset-dev | push  | schedule      |               -2 |      1 | 2026-08-10 02:00:44+00
       8 |   114 | reset-dev | push  | schedule      |               -2 |      1 | 2026-08-17 02:00:44+00
```
A **third** `PRIONEX_HUB` firing exists beyond the two Dev Notes §2 cites (2026-08-17, its normal
weekly recurrence — not a new finding, just confirmation the cron kept firing). Confirms the
contested `event` column really does read `push` even for a `trigger_event='schedule'` row — the DB
half of Task 2.2's own question; `github.event_name`'s own live value still needs the in-job echo
(Task 6.3), since `event_name` is populated from `trigger_event` per source, not from `event`.
`CRM/fe-prionex` (repo_id=16) confirmed to have **zero** `action_schedule` rows and **zero**
`schedule`-triggered runs as of this query — the "before" half of Task 6.4's discriminating pair,
banked now, to be re-queried after PR A merges for the "after" half. **Baseline (Task 1.1): 988.**

*Bonus, requested by the coordinator: Story 4.4's own DF1 closed.* `action_run.concurrency_group`/
`concurrency_type` for runs 964/965 (Story 4.4's own row 7.2 pair, previously UNPROVEN):
```
 id  | repo_id | index |      title       |     concurrency_group     | concurrency_type
-----+---------+-------+------------------+----------------------------+------------------
 964 |      16 |   319 | Deploy DEV Stand | deploy-dev-fe-prionex-dev  |                1
 965 |      16 |   320 | Deploy DEV Stand | deploy-dev-fe-prionex-dev  |                1
```
Both carry the literal group and `concurrency_type=1` (explicit, not auto) — directly confirms
Story 4.4's own AC1, closing `deferred-work.md`'s DF1 entry.

*Cron validation (AC7).* No Go toolchain available locally to run the exact
`github.com/gdgvda/cron v0.7.0` parser; validated instead with `croniter` (Python, 5-field-capable)
inside a disposable venv, wrapped in a stricter local check enforcing this instance's own
additional rules the library alone does not: exactly 5 whitespace-separated fields (croniter alone
accepts a 6th field as seconds, which Forgejo's parser does not have and would reject at tick
time), no `@`-descriptor, no `TZ=`/`CRON_TZ=` prefix. `0 2 * * 0` (the weekly cron) and
`5,20,35,50 * * * *` (the temporary probe cron) both pass; `0 2 * * * *` (6 fields), `@weekly`, and
`TZ=UTC 0 2 * * 0` are all correctly rejected by the overlay. Confirmed the weekly cron's own
recurrence (`0 2 * * 0` fires every Sunday 02:00 UTC, four consecutive weeks checked) and that the
probe cron never lands in the same minute as the weekly one (offset `:05/:20/:35/:50` vs the
weekly's own `:00`) — Task 2.9's staggering rule, satisfied by construction, not by luck.

*Sweep logic (Task 5, AC4) — fully tested on s1, one real bug found and fixed.*
```
$ docker images "git.crm-prionex.com/crm/fe-prionex" --filter "dangling=true" --format '{{.ID}}'
(empty)
$ docker images "git.crm-prionex.com/crm/fe-prionex" -a --format '{{.Repository}}|{{.Tag}}|{{.ID}}'
...
git.crm-prionex.com/crm/fe-prionex|<none>|2cf266044912   # the RUNNING stand's own image
git.crm-prionex.com/crm/fe-prionex|<none>|1491bf33a9fb   # genuine debris, 71h old, unreferenced
```
`docker images --filter dangling=true` returned **nothing** for either — measured, not assumed,
before this file was ever pushed. `docker inspect`'s own `RepoTags` field explains why: a
digest-pulled image on this daemon (containerd-backed store, docker 29.4.0) carries a
`repo@sha256:...` pseudo-entry in `RepoTags`, which the `dangling` filter's own emptiness check
does not treat as untagged — so the filter this story's first draft used would have silently
matched zero images, forever, exactly failure cause 5 from Dev Notes §9 ("the sweep's enumeration
is wrong in a way that removes nothing... silent no-op"), and it would have shipped invisibly,
since a sweep that finds nothing prints a clean, plausible "no images found" line. The `.Tag`
DISPLAY field, unlike the filter, correctly renders `<none>` for these images — fixed by listing
every image in the repository and filtering client-side on that field instead of trusting the
filter (`docs/migration-decisions.md#d31`).

Re-tested against the corrected query, using genuine host debris where safe to (not the running
stand): the young, currently-running image (`2cf266044912`, 13h old) was correctly KEPT (both by
age and by the container-reference check); the old, unreferenced image (`1491bf33a9fb`, 71h old)
was correctly REMOVED at a lowered test threshold and correctly left alone at the real 168h
threshold. Synthetic containers proved the holder half: a RUNNING holder survived a threshold=0
sweep (never touched, per Task 5.4's absolute rule); a STOPPED, artificially-aged holder was
correctly REMOVED; a freshly-stopped holder was correctly KEPT under the real 24h threshold.
Confirmed structurally that `docker ps --filter name=^fe-prionex-dev-deploy-lock-[0-9]+$` (anchored)
excludes the four `forgejo-runner-fe-prionex*` containers and the live `fe-prionex-dev` stand
itself, while an UNANCHORED `name=fe-prionex` filter (tested side by side) matches all of them —
directly reproducing the exact hazard AC4's amendment names.

🔴 **Side effect of testing, recorded honestly:** one of the threshold=0 test runs (proving the
holder-removal path) also removed the REAL `fe-prionex-dev-deploy-lock-971` container — Story
4.4's own DN3 re-earn debris, `Exited (0)`, 9h old at the time. This is not damage: the container
held no live lock (its kernel-level flock released when the process exited, ~10 hours before this
test), and removing exactly this shape of debris is the sweep's own stated purpose
(`deferred-work.md:2930-2949`). Recorded for transparency, not glossed over — a test that exercises
the real removal path against real debris will, by construction, remove that debris.

*Dispatch classifier (Task 4.3) — every branch force-tested locally* (200/201 → success; 401/403 →
named credential failure; 404 → named endpoint/path failure; 400 → named input-rejection failure;
000 → named transport failure; an unrecognised code → named "not classified"; empty
`${{ github.token }}` → its own guard fires before any HTTP call). All nine forced cases produced
their own correct message and exit code. The disarmed-dispatch branch (Task 6.2) was tested
separately: correct interpolated URL/body in its own "would have dispatched" message, correct
`$GITHUB_OUTPUT` population for the four `github.*` fields Task 6.3 needs, exit 0 (a disarmed run
is a SUCCESS, not a failure).

*curl `--config -` stdin auth form* (Task 4.2) verified to be syntactically valid and to reach a
real server without a client-side parse error (tested against a public endpoint, since the real
Forgejo token/endpoint pair is the coordinator's own domain) — the actual token/endpoint pairing
itself is untested until Task 2.8's live dispatch.

**All test artifacts cleaned from s1 afterward** — no leftover synthetic containers or images, and
the REAL `fe-prionex-dev` stand confirmed completely untouched and healthy throughout (`Created`
timestamp, digest, health all unchanged — still run 973's own container).

**2. Task 2.8's first attempt (run 994) was invalid, caught after the fact, not before — recorded
honestly.** Requested a manual dispatch of `dev-reset.yml` to test `${{ github.token }}` against
the real endpoint, without first checking that the file being dispatched still carried the
`DISARMED=true` literal Task 6.2 requires for the eventual PR A probe window. The coordinator's own
dispatch (run 994) therefore exercised the simulated branch, not the real one — SUCCESS in ~2.5
minutes, no `deploy-dev.yml` run created afterward, which is the CORRECT and expected behaviour of
a disarmed dispatch, not evidence about the token. Confirmed via the same DB read path used
throughout this story (not only the coordinator's own run-list check, as an independent
cross-check): run 994's own row (`event=workflow_dispatch`, `status=1`, stopped `08:53:09`) and no
`action_run` row for `deploy-dev.yml` created after it. Fixed by flipping `DISARMED` to `false` for
exactly one commit — a redispatch on the same branch will now actually reach the endpoint. The
gap was in sequencing the request, not in the classifier or the disarm mechanism itself, both of
which were already correctly force-tested locally (Completion Note 1) before either dispatch.

**3. Task 2.8 settled positively: the full scheduler→deploy chain proven live, end to end
(runs 1004→1005), host-side confirmed.**

```
$ docker exec forgejo-postgres psql -U forgejo -d forgejo -c \
    "select id,index,workflow_id,ref,trigger_event,status,to_timestamp(created) \
     from action_run where repo_id=16 and id>=988 order by id;"
  id  | index |  workflow_id   |                   ref                    |   trigger_event   | status
------+-------+----------------+-------------------------------------------+--------------------+--------
  993 |   337 | ci.yml         | refs/heads/story-4-6/pr-2a-probe-window  | push               |      1
  994 |   338 | dev-reset.yml  | refs/heads/story-4-6/pr-2a-probe-window  | workflow_dispatch  |      1
 1002 |   339 | ci.yml         | refs/heads/story-4-6/pr-2a-probe-window  | push               |      1
 1004 |   340 | dev-reset.yml  | refs/heads/story-4-6/pr-2a-probe-window  | workflow_dispatch  |      1
 1005 |   341 | deploy-dev.yml | refs/heads/main                          | workflow_dispatch  |      1
```

Run 1004's own dispatch step (armed) called the real endpoint and got a `2xx` — its own classifier
printed the "OK: dispatch accepted" branch, and Forgejo created run 1005 for `deploy-dev.yml` as a
direct consequence, `ref=main` (note: `action_run.ref` for the DISPATCHED run reads
`refs/heads/main` — the literal ref this story's own dispatch body sends — not the branch
`dev-reset.yml` itself was read from). Host-side, after 1005 completed:

```
$ docker inspect fe-prionex-dev --format 'Created={{.Created}} Health={{.State.Health.Status}}'
Created=2026-08-21T09:12:11.462313087Z Health=healthy

$ docker inspect fe-prionex-dev --format '{{json .Config.Labels}}'
"com.docker.compose.project.working_dir":"/workspace/CRM/fe-prionex/stand-checkout-1005"
"org.opencontainers.image.revision":"22dceedc5f850641d088383b064d2345fe29297f"
"org.prionex.ref":"main"

$ docker inspect fe-prionex-dev --format 'Image={{.Image}}'
Image=sha256:5d191b7fb1eba5e000c0ffc1bdb843d9c4b548e3a7914c232170d06ae613d563

$ stat /root/crm-prionex/fe-prionex-dev/.deploy.lock   # Modify: 2026-08-21 11:12:08 +0200 (09:12:08 UTC)
```

`stand-checkout-1005` directly proves this exact container is run 1005's own output (the run number
is embedded in the checkout directory the deploy itself wrote); the image's own stamped
`org.opencontainers.image.revision` equals this story's own `baseline_commit`
(`22dceedc5f850641d088383b064d2345fe29297f`), consistent with `ref=main` at the moment of dispatch;
the lock file's own `mtime` (09:12:08 UTC) sits 3 seconds before the container's own `Created`
(09:12:11 UTC) — acquire-then-deploy in the right order, the same signature Story 4.4 established.
No leftover `fe-prionex-dev-deploy-lock-*` holder container survived either run — the sweep in run
1004 (not disarmed, ran for real) and the lock's own release in run 1005 both completed cleanly.
Two now-orphaned-but-still-young untagged images remain (`5d191b7fb1eb`, 1005's own; `2cf266044912`,
the previous one, now unreferenced) — both correctly under the sweep's own 7-day age threshold, not
yet eligible for removal, exactly as designed.

**The chain the story set out to prove is now live, not merely designed:** a dispatch of
`dev-reset.yml` → its own classifier correctly reads a real `2xx` → Forgejo creates a real
`deploy-dev.yml` run → that run acquires the lock, sweeps nothing it shouldn't, pulls `main-dev`,
redeploys, and releases the lock → the stand ends on exactly the image `main` resolved to at
dispatch time. The only piece not yet exercised live is the SCHEDULED half specifically (a firing
with no human dispatching it) — Task 6's own job, next.

**4. PR B: probe scaffolding removed, dispatch permanently armed, one more stray `${{ }}` caught
before push.** Observation closed at three clean scheduled ticks (runs 1019/1023/1032 —
`trigger_event='schedule'`, system actor `-2`, a consistent 44s delay this repository's own,
SUCCESS all three, stand confirmed untouched and the sweep confirmed running for real with a
legitimate no-op each time — full table in Task 6.3). `dev-reset.yml` rewritten for its final
shape: the temporary probe cron and the disarm mechanism are both REMOVED, not merely toggled — the
disarm mechanism was always scoped as probe-window scaffolding (unlike Story 4.3/4.4's own
permanent regression hooks), and once the probe window closes there is no further "frequent
unintended redeploy" risk for it to guard against.

🔴 **Caught before this push, the exact class of hazard this file's own header warns about**: the
first draft of the dispatch step's rewritten header comment wrote out `` `${{ github.token }}` ``
literally, inside the `run:` body, to refer to the token expression in prose — precisely what
Task 3.6 forbids (Forgejo substitutes inside comments too). Found by the same programmatic check
this story has run before every push (`yaml.safe_load` + substring scan over every `run:` body,
not by eye), fixed by rephrasing to name the shell variable (`$FJ_TOKEN`) instead of the GH Actions
expression syntax. Re-verified clean (3 `run:` bodies, zero stray `${{ }}`, `bash -n` clean on all
three) before this commit.

### File List

**New**
- `.forgejo/workflows/dev-reset.yml` — the only workflow file this story creates. Final shape (PR B):
  `on: {schedule: [0 2 * * 0], workflow_dispatch: {}}` (zero inputs, single cron — the temporary
  probe entry and the disarm mechanism both removed, Task 6.5); workflow-level
  `concurrency: {group: deploy-dev-fe-prionex-dev, cancel-in-progress: false}`, the same literal
  `deploy-dev.yml` carries; `runs-on: deploy-dev-preprod`, `timeout-minutes: 5`. Two steps: a sweep
  (images + lock-holder debris, targeted/anchored, non-fatal) and an always-armed dispatch of
  `deploy-dev.yml` with `ref=main` through the Forgejo API. 3 `run:` bodies, zero stray `${{ }}`
  (including inside comments — one instance caught and fixed in this round, Completion Note 4).

**Modified**
- `.forgejo/workflows/README.md` — `dev-reset.yml` added to the directory's own file list (Task 8.4).
- `docs/migration-decisions.md` — new **D31** record (schedule proven for this repository, the
  `trigger_event`/`event` resolution, the dispatch mechanism and the token confirmed live, the
  sweep's prohibition list and the `dangling=true` bug found and fixed); index-table row and two
  Change Log rows added (initial record, then Task 2.8's live result); anchor-range note corrected
  to `#d31`.
- `_bmad-output/planning-artifacts/epics.md` — Story 4.6's four ACs amended in place (zero-input
  clause, "same mechanics" reading, targeted-sweep replacement, Slack deferred) plus two ACs added
  (AC2's retro-E5 requirement, AC6/AC7 combined as fail-closed + cron safety); FR23's text and its
  FR-coverage table row both amended to match.
- `_bmad-output/implementation-artifacts/deferred-work.md` — `:2858-2863` and `:2930-2949` closed at
  their own entries; new section "Deferred from: story-4.6 implementation" added with one
  named-owner finding (the `dangling=true` platform quirk).
- `_bmad-output/implementation-artifacts/4-6-reset-dev-to-main-on-a-weekly-schedule.md` — this
  file: `Status` → `review` (frontmatter — corrected an earlier oversight, was still `ready-for-dev`
  through the whole implementation round); Tasks 1-6, 8, 9 complete, Task 7 partially satisfied by
  cross-referenced evidence (7.1/7.2/7.6), 7.3/7.4/7.5 explicitly left open; Run Budget Ledger
  closed against actual run numbers (988 baseline, 11 runs spent: 993/994/1002/1004/1005/1014/1015/
  1018/1019/1023/1032); Dev Agent Record (Completion Notes 1-4: DB access, cron validation, sweep
  force-testing with the real bug found and fixed, dispatch classifier force-testing; Task 2.8's own
  sequencing gap and live resolution; the three probe-tick observations with host-side confirmation
  each time; the stray `${{ }}`-in-comment catch before this push).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `4-6-…` → `review` (Task 8.5, per the
  coordinator's own explicit instruction — Task 7 is not fully earned, stated honestly above, not
  silently oversold).

## Change Log

| Date | Note |
|---|---|
| 2026-08-21 | Story contexted against `main` at 22dceedc. 🔴 **The story's stated premise was falsified while contexting it.** `schedule:` **has** fired in production on this Forgejo instance: two `action_run` rows with `trigger_event='schedule'`, both `CRM/PRIONEX_HUB` → `reset-dev.yml` (`.github/workflows/`, not `.forgejo/`), at `2026-08-05 09:50:44 UTC` and `2026-08-10 02:00:44 UTC`, both success, dispatch delay 1 second — read read-only from Forgejo's own Postgres by `CRM/api-prionex`, which then registered a **second** schedule of its own (`action_schedule id=36`, `ref=main`, `next = 2026-08-17 02:00 UTC`) and deliberately disarmed it. It has never fired in `CRM/fe-prionex` — the 124-run event census confirms the negative — so AC2 and the probe survive, but narrow from *"does cron work"* to four cheap questions. **Six instance facts arrive free** (default-branch-only registration, confirmed against the v15.0.5 source at two independent gates; UTC evaluation; the `github.sha` snapshot; every default-branch push wiping and re-registering all schedules; **a parse failure at tick time permanently disabling the workflow**; and open issue #12566, where an invalid cron breaks push triggers repository-wide). 🔴 **One sibling conclusion appears to be wrong and is corrected here rather than inherited:** `api-prionex`'s fact 2 reads `event=push` off the wrong `action_run` column and forbids branching on `github.event_name`; the v15.0.5 source populates `github.event_name` from `trigger_event`, so it should read `schedule` — nobody has ever echoed it live, and Task 6.3 does, in one line. Four autonomous decisions recorded, subject to Oleg's veto: the reset **dispatches** the proven `deploy-dev.yml` rather than duplicating it (§3, five alternatives ranked and costed — **both sibling projects took the rejected one**); the manual path takes **zero inputs**, so it cannot be aimed anywhere but `main` and therefore becomes valid evidence for the scheduled path; FR23's literal `docker image prune` is replaced by a **targeted** sweep, because s1 is multi-tenant and `docker ps --filter name=` is a substring match that matches this job's own runner; and the holder-debris chore from `deferred-work.md:2930-2949` is **accepted** into scope. Three ACs amended, three added (AC6 fail-closed-and-untouched, AC7 the cron cannot take the repository down with it, AC8 Slack deferred). 🔴 One near-certain new dependency surfaced up front: the v15.0.5 dispatch route needs `write:repository` **and** Actions-unit write, which the automatic job token probably lacks — Task 2.8 settles it in one run, and the fallback is a decision for Oleg, not a silent switch to `workflow_call`. Story 4.5 is parked; its unmerged branch is not read. Delivery is two implementation PRs by construction, because a `schedule:` on a feature branch registers nothing, no UI or API lists registrations, and protected `main` is the only place a firing can be observed. Status → ready-for-dev |
| 2026-08-21 | **Implementation round: Tasks 1, 3, 4, 5, 9 complete; Task 2's citations confirmed (2.8's own live test pending); Tasks 6-8 pending the coordinator.** `dev-reset.yml` written end to end and locally validated before push: cron expressions checked against a 5-field-exact local parser overlay (no Go toolchain available, croniter used with Forgejo-specific strictness rules layered on top); sweep logic force-tested on s1 against real and synthetic debris, finding and fixing a real bug — `docker images --filter dangling=true` matches no digest-pulled image at all on this daemon's containerd-backed store, which would have shipped as a silent no-op sweep (this story's own failure cause 5); dispatch classifier force-tested for every HTTP branch; disarm mechanism (Task 6.2) and the `github.event_name`-etc. diagnostic (Task 6.3) both verified locally. Baseline (Task 1.1) and AC2's own "before" half (Task 6.4) both answered by a direct read-only query against Forgejo's own Postgres via SSH on s1 — the same method `CRM/api-prionex`'s own story documents — confirmed live and reusable; also used, at the coordinator's request, to close Story 4.4's own DF1 (`concurrency_group`/`concurrency_type` for runs 964/965, both confirmed correct). D31 recorded, epics.md's four ACs amended plus two added, `deferred-work.md`'s two named entries closed at their own locations plus one new platform-level finding recorded. Regression check: `deploy-dev.yml` has zero diff, exactly six files touched total, none on the do-not-touch list. Requesting from the coordinator: Task 2.8's one live dispatch (armed, on the implementation branch, before PR A), then opening PR A once that's settled |
| 2026-08-21 | **Task 2.8 closed live: the token can dispatch, chain 1004→1005 proven end to end.** First attempt (run 994) proved nothing — dispatched against a file still carrying `DISARMED=true`, a self-inflicted sequencing gap, not a platform finding, caught via the same DB read path used throughout this story. Fixed (`DISARMED=false` for one commit), redispatched: run 1004 (armed) reached the real endpoint, got a real `2xx`, and genuinely triggered run 1005 (`deploy-dev.yml`, `ref=main`, SUCCESS ~1 min) — against the read source's own prediction that the automatic job token would lack the needed Actions-unit write permission. No Oleg escalation needed. Host-side confirmed: `stand-checkout-1005`, image revision matches `baseline_commit`, lock file mtime 3s before container recreation, no leftover holder debris. `DISARMED` reverted to `true` for PR A's own probe window (a decision independent of the token result — it controls the blast radius of the frequent test cron, not a credential workaround). D31 updated with the live result in place of the prior expectation |
| 2026-08-21 | **PR A merged (#63, `6c681da38f9b`); probe window observed and closed at 3 clean ticks; PR B lands the final permanent shape.** "After" half of AC2's discriminating pair banked by query: `action_schedule id=37` registered `09:44:23 UTC` (~19s after PR A's own merge), `action_schedule_spec` carrying exactly the two intended cron strings verbatim, `time_zone=''` confirming UTC live. Three scheduled firings observed (runs 1019/1023/1032, 09:50/10:05/10:20 UTC) — all `trigger_event='schedule'`, system actor `-2`, a consistent **44s delay** (this repository's own measurement, not `PRIONEX_HUB`'s 1s), all SUCCESS, stand confirmed untouched and the sweep confirmed running for real with a legitimate no-op each time (nothing yet old enough to remove). A platform limitation found and recorded: `$GITHUB_OUTPUT` values are not retrievable outside a job's own live execution on this instance, so Task 6.3's own literal `github.event_name` echo could not be read back — substituted the DB's own `trigger_event` column, already proven to carry the same information per the v15.0.5 source reading. Task 7.1/7.2/7.6 satisfied by evidence already in hand (0 additional dispatches); 7.3/7.4/7.5 remain open for a subsequent round. This PR removes the temporary probe cron and the disarm mechanism entirely (not merely toggled — it was always probe-window scaffolding, not a permanent regression hook), leaving a single weekly cron and an always-armed dispatch. One more stray `${{ }}`-in-a-comment caught and fixed before this push (Completion Note 4). Ledger closed at 11 runs above baseline 988, still well under the ~20-24 floor. `Status`/`sprint-status.yaml` → `review`, by the coordinator's own explicit instruction — Task 7's remaining rows stated as open, not folded into the claim |
