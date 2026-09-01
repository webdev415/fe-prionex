# Sprint Change Proposal — six places where the plan stopped matching the instance

**Date:** 2026-08-14
**Trigger:** Accumulated divergences from two days of implementation (Stories 1.12, 2.1, 2.2, 3.1),
gathered on Oleg's instruction to «либо идти по плану, либо корректировать курс».
**Mode:** batch.
**Scope classification:** **Moderate** — one story **resequenced to last** (Oleg overrode the
recommendation to cancel it), four amended, one FR amended, one recorded mitigation withdrawn as
false. No epic redefinition, no rollback of completed work.

**Outcome, 2026-08-14: accepted and applied**, with §4.1 decided against the recommendation — see
there for the reasoning and for the rule that came with it.

---

## 1. Issue Summary

Six divergences, found by doing the work rather than by reviewing the plan. Each is stated with the
evidence that produced it.

| # | Where | The divergence |
|---|---|---|
| A | Story 4.5 | Its only delivery channel does not exist — **kept and resequenced to last, not cancelled** |
| B | Story 2.3 | Its blocker rests on an inference that new evidence contradicts |
| C | Story 2.6 | It names four required checks; the system produces eight contexts |
| D | Story 6.5 | The neighbouring repo already has a stronger gate than the one it specifies |
| E | FR2 | Its cost was unknown when written and is now measured |
| F | `deferred-work.md` | A mitigation recorded yesterday **cannot work**, and it is mine |

---

## 2. Impact Analysis, item by item

### A. Story 4.5 — «Notify Slack on Deploy Start, Success and Failure»

Every acceptance criterion routes through `SLACK_CD_WEBHOOK_URL`. That secret exists at org scope
and holds Story 1.13's non-resolving `example.invalid` stub; Forgejo secret values are write-only,
so the original is unrecoverable. **Oleg's decision on 2026-08-13 — «slack не трогаем» — makes that
permanent, not pending.**

A workflow written to this story would pass every step and deliver nothing. There is no
"partially works" here: `curl` to a dead host with `continue-on-error` semantics is indistinguishable
from success, which is exactly the AC's fourth clause.

**No alternative channel has been named.** Without one there is nothing to rescope *to*.

### B. Story 2.3 — «Publish Coverage as an Artifact Instead of Uploading to Codecov»

Its last AC is *"the coverage artifact is downloadable"*. The plan has treated that as unsatisfiable
since Story 1.8, on the strength of *"there is no Actions-artifacts API on this instance"*.

**That claim was inferred from the wrong endpoints.** Story 1.8 measured `404` on
`/orgs/{org}/quota/artifacts` and `/user/quota/artifacts` — **quota** endpoints — and generalised.
Measured today, unauthenticated:

```
/api/v1/repos/CRM/fe-prionex/actions/artifacts        403
/CRM/fe-prionex/actions/runs/32/artifacts/dist        303
```

`403` is not `404`: the API route exists and refuses an unauthenticated caller. The web download
route exists too and redirects to login. **Retrieval may well work.** One authenticated request
settles it, and Story 2.1 already put 154 artifact rows in the registry to try it against.

### C. Story 2.6 — «Enforce Required Status Checks on Main»

Its AC says *"the four CI jobs are set as required status checks"*. Measured on 2026-08-14 from
runs 513–516, `commit_status` contexts are named **per event**:

```
CI / Lint (push)            CI / Lint (pull_request)
CI / Type Check (push)      CI / Type Check (pull_request)
CI / Unit Tests (push)      CI / Unit Tests (pull_request)
CI / Build (push)           CI / Build (pull_request)
```

**Eight contexts, not four**, and the choice is consequential: require the `(push)` set and a PR
that never received a branch push produces none of them — the gate never goes green. Require the
`(pull_request)` set and a direct push to a feature branch is ungated. "The four CI jobs" does not
name a thing that exists.

### D. Story 6.5 — «Guard Promotion by Commit Identity»

The story is correct about our own constraint: Option C rebuilds per environment, so our guard can
only prove the **commit** passed PRE-PROD, not the artifact. It says so honestly.

What changed is next door. `CRM/api-prionex` runs `ops/deploy/validate-preprod-digests.sh` before
every production deploy, comparing the **digests of the containers actually running on PRE-PROD**
against the release manifest — digests, not tags, because a tag can be moved and a digest cannot —
with no bypass flag. Their PROD deploy is manual dispatch with an explicit sha, never derived from a
branch head.

**Writing our commit-level guard without reference to that produces a weaker duplicate beside a
stronger original.** The frontend still needs its own guard — theirs does not cover our image — but
it should be positioned as the frontend half of an existing pattern, not as the whole mechanism.

### E. FR2 — trigger cost

FR2 asks for `pull_request` on `main` **and** `push` on feature branches. Both are now live. Measured
across runs 513–516: one commit on a PR branch produces **two runs**, 461 s + 503 s ≈ **964 s of wall
clock and ~1620 job-seconds**. On a host carrying another tenant's production at load 4–26.

This is the price of the requirement as written, not a misconfiguration. It was unknown when FR2 was
drafted and should be recorded where FR2 is read.

### F. 🔴 The recorded mitigation for the pull-request risk does not work, and I wrote it

`deferred-work.md`, decision of 2026-08-14, states that the risk of a PR from an old branch running
the legacy `.github/workflows/CI.yml` **"closes on its own when Story 7.2 deletes the legacy workflow
files"**. I also proposed bringing Story 7.2 forward on that basis.

**It is false.** Forgejo resolves the workflow directory **at the commit being run** — confirmed by
run 514, whose ref is `refs/pull/2/head` and whose `commit_sha` is the PR head. A pull request from a
branch whose head is an old commit executes **that commit's** `.github/workflows/`. Deleting the
files on `main` changes nothing about ~497 branch heads that already carry them.

Story 7.2 closes the risk **only for branches that are re-cut or brought up to date after the
deletion** — which is a different and much weaker statement than the one recorded.

---

## 3. Recommended Approach

**Direct adjustment.** One resequencing (recommendation was cancellation; overridden), four amendments, one FR annotation, one correction of a
false record. No rollback; no epic resequencing — in particular **Story 7.2 stays where it is**,
because §F removes the reason to move it.

Effort: small, all documentation. Risk: low, except that §F leaves a live risk with **no cheap
mitigation**, which is now stated rather than assumed away.

---

## 4. Detailed Change Proposals

### 4.1 Story 4.5 — ~~CANCEL~~ **KEEP AND RESEQUENCE TO LAST** (Oleg's decision, 2026-08-14)

> **DECIDED: not cancelled.** Oleg kept the story and moved it to the very end, on the grounds that
> the capability exists today and a new Slack webhook is five minutes' work when someone gets to it.
> 🚨 **The condition attached: the deploy must work without it** — notification is a layer on a
> deploy, never a precondition. Stories 4.3, 4.8, 5.3 and 6.4 close with no notification step.
>
> ~~**NEW status:** **CANCELLED 2026-08-14.**~~ Its single delivery channel is permanently unavailable:
> `SLACK_CD_WEBHOOK_URL` holds an unrecoverable `example.invalid` stub, and Oleg's decision of
> 2026-08-13 («slack не трогаем») makes that final rather than pending. A workflow built to these
> ACs would pass every step and deliver nothing — its fourth AC explicitly requires notification
> failure not to fail the deploy, so the silence would be indistinguishable from success.
>
> **What replaces it: nothing, deliberately.** Deploy visibility is served by the Forgejo run list
> and by the deployment records Stories 5.4 and 6.6 already produce. **If a channel is ever named,
> this returns as a new story against that channel** — not by reviving this one, whose every AC is
> written around a webhook that will not exist.

**Rationale:** cancelling with the reason recorded is this plan's established treatment for stories
overtaken by a decision (1.1, 1.4, 1.5, 6.1, 7.1, 7.4). Leaving it in `backlog` invites someone to
implement it.

### 4.2 Story 2.3 — add a task ahead of its ACs; do not rescope yet

> **ADDED as the story's first task:** **Settle whether artifact retrieval works, before assuming it
> does not.** The standing claim *"there is no Actions-artifacts API on this instance"* was inferred
> from `404` on **quota** endpoints (`/orgs/{org}/quota/artifacts`), not from the artifacts routes.
> Measured 2026-08-14 unauthenticated: `/api/v1/repos/CRM/fe-prionex/actions/artifacts` → **403**,
> and the web download route → **303**. Both routes exist. Fetch one of the 154 `dist` artifact rows
> Story 2.1 produced, with a token, and record the result.
> **If retrieval works**, this story's last AC stands as written and a long-standing «не проверено»
> closes. **If it does not**, rewrite the AC to what is achievable and say why — but do not rewrite
> it on the strength of an inference that has already been shown to come from the wrong endpoint.

### 4.3 Story 2.6 — amend the required-checks AC

> **OLD:** **Then** the four CI jobs are set as required status checks.

> **NEW:** **Then** the required status checks are set to a named, explicitly chosen subset of the
> **eight** contexts the system actually produces — `CI / {Lint,Type Check,Unit Tests,Build}` in both
> `(push)` and `(pull_request)` forms (measured, runs 513–516)
> **And** the choice is recorded with its reason, because the two sets fail in opposite directions:
> requiring the `(push)` contexts leaves a pull request that received no branch push permanently
> un-green, while requiring only the `(pull_request)` contexts leaves direct pushes to feature
> branches ungated
> **And** the check names are verified against `commit_status` rows from a real run rather than typed
> from the workflow's job names.

### 4.4 Story 6.5 — amend to reference the neighbouring gate

> **ADDED to the story:** **Given** `CRM/api-prionex` already gates its own production promotion on
> `ops/deploy/validate-preprod-digests.sh`, which compares the **digests of containers actually
> running on PRE-PROD** against the release manifest, with no bypass flag
> **When** this guard is designed
> **Then** it is positioned as the **frontend half** of that existing pattern rather than as an
> independent mechanism
> **And** the asymmetry is stated: theirs proves artifact identity by digest; ours can only prove
> **commit** identity, because Option C rebuilds per environment ([D1](../../docs/migration-decisions.md#d1))
> **And** no weaker duplicate of their check is built for the backend side.

### 4.5 FR2 — annotate with the measured cost

> **APPEND to FR2:** ⚠️ **Cost measured 2026-08-14 (Story 2.2, runs 513–516).** With both triggers
> live, one commit on a pull-request branch produces **two runs** — `push` and `pull_request` —
> ≈964 s of wall clock and ≈1620 job-seconds, on a shared host. This is the price of the requirement
> as written. If it must come down, the lever is the **`push`** trigger for PR branches; the
> `pull_request` half is the one that gates merges.

### 4.6 `deferred-work.md` — withdraw the false mitigation

> **CORRECTION.** The 2026-08-14 decision entry states the pull-request risk *"closes on its own when
> Story 7.2 deletes the legacy workflow files"*. **That is wrong.** Forgejo resolves the workflow
> directory **at the commit being run** — run 514's ref is `refs/pull/2/head` and its `commit_sha` is
> the PR head — so a pull request from an old branch executes **that commit's**
> `.github/workflows/`. Deleting the files on `main` does not touch ~497 branch heads that already
> carry them.
>
> **What remains true:** the risk closes for any branch cut or brought up to date **after** the
> deletion. **What is now removed:** the proposal to bring Story 7.2 forward on this basis. It stays
> where it is, and its own AC — keep the legacy files as the reference while Epics 2–6 are in
> progress — stands unchallenged.
>
> **The mitigations that do work**, none of them free: require pull requests to be up to date with
> `main` before merge (branch protection on `main` already exists); back-merge `main` into the
> branches anyone actually opens PRs from; or accept the exposure, which is the current state.

---

## 5. Implementation Handoff

**Scope: Moderate.**

| Recipient | Deliverable |
|---|---|
| **Dev agent** | Apply §4.1–§4.6 to `epics.md` and `deferred-work.md`; add a changelog row to `docs/migration-decisions.md`; set Story 4.5 to `cancelled` in `sprint-status.yaml`. |
| **Oleg** | Two decisions, both small: whether to cancel 4.5 outright (§4.1) or hold it open against an unnamed future channel; and whether any of §4.6's real mitigations is worth doing now, given that the one recorded yesterday does not exist. |

**Success criteria**

1. No story remains in `backlog` whose only mechanism is known to be unavailable.
2. Story 2.3's blocker is settled by measurement, not inherited by inference.
3. Story 2.6 names a check set that exists.
4. Story 6.5 references the stronger neighbouring gate instead of duplicating it weakly.
5. No document still claims Story 7.2 closes the pull-request risk.

**Open question carried forward:** the artifact-retrieval test in §4.2 needs a token. Every token
this project mints must have its exit planned first — an admin cannot revoke another account's token
by any scripted route, so the exit is the `access_token` row.
