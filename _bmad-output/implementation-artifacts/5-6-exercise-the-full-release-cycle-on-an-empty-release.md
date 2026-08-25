<!-- Story 5.6. Epic 5's FINAL story. Written 2026-08-25 by the create-story context engine.
     READ THE WHOLE "Read this before anything else" BLOCK BEFORE THE FIRST TASK.
     §3 is not background — it is the decision this story exists to get right, and a dev agent
     that skips it will type a verdict that is not true. §12 states what this story may not
     touch, and it is not advice. -->

# Story 5.6: Exercise the Full Release Cycle on an Empty Release

Status: ready-for-dev

## Story

As a release engineer,
I want the whole PRE-PROD path rehearsed before it carries a real release,
So that the first real release is not also the first test of the machinery.

---

## 🚨 Read this before anything else

### 1. What this story is, in one paragraph

Every leg of the PRE-PROD release cycle has been built and every leg has been exercised **on its
own**. `build.yml` mints `sha-<12>-preprod` (Story 3.x, dispatched again by 5.4 as D7).
`deploy-preprod.yml` puts a named tag on the stand in `image_tag` mode (Story 5.3, runs 1184-1190,
1281). `record-preprod-candidate.yml` mints `preprod-<sha>` and moves `preprod-current` (Story 5.4,
runs 1215/1229). `docs/release-validation-checklist.md` — `RVC-v1` — says what "validated" means
(Story 5.5). **What has never happened is all four in one continuous pass, on one candidate, with a
verdict derived from the checklist rather than asserted by the operator.** That is this story, and
it is a rehearsal: a candidate whose content is deliberately empty, so that anything that breaks is
the machinery and not the change.

This story writes **no workflow code**. Its deliverables are three dispatches, one Execution Log
section, one ledger row (conditionally — see §3), one small regulation document, and an honest
record of what the cycle actually costs in wall-clock time.

### 2. What already exists — measured 2026-08-25, from this session, not quoted from a story file

| Fact | How it was measured, this session | Value |
|---|---|---|
| PRE-PROD frontend serves over valid TLS | `curl -o /dev/null -w '%{http_code} %{ssl_verify_result}'` | `200`, `ssl_verify_result=0` |
| Every asset referenced by `index.html` returns 200 | 8 `curl` probes (7 `.js` + 1 `.css`) | 8/8 `200` |
| PRE-PROD bundle carries the PRE-PROD API base | `grep -cF` over each served asset | `https://api.crm.preprod.crm-prionex.online` — **2 hits, in `assets/index-*.js` only** |
| PRE-PROD bundle carries the literal expected WS value | same | `wss://api.crm.preprod.crm-prionex.online` — 1 hit |
| No DEV host, no localhost fallback, no `phone.` URL in the bundle | same, `grep -cF` (fixed strings) | `api.crm.dev…` 0, `localhost:8000` 0, `localhost:8005` 0, `localhost:5173` 0, `phone.crm` 0 |
| The build-epoch integer F2 c4 needs | `grep -coE '"1[0-9]{12}"'` per asset | **exactly one, in `assets/index-*.js`**: `"1787574758842"` → `2026-08-24 12:32:38 UTC` |

🔴 **Two of those rows correct `RVC-v1`'s own parenthetical measurements, and a dev agent that does
not know this will misread a healthy candidate.**

1. **F2 criterion 1 says "(Measured on a correct build: it occurs in **3** files under `assets/`.)"
   The bundle PRE-PROD is actually serving has it in **one** file.** That parenthetical was measured
   from a local `npx vite build`, not from the image; chunking differs. **The criterion is
   *presence*, not a match count.** Do not fail F2 c1 because the count is not 3, and do not
   "fix" the checklist — record the observed count as evidence and move on.
2. **F2 criterion 4's unstated match count is now stated: exactly one quoted 13-digit integer, in
   `assets/index-*.js`.** `RVC-v1` says in so many words that "no measurement here states how many
   quoted 13-digit integers a real bundle contains". Now one does. This is a contribution to
   `RVC-v1`'s evidence, not a change to it — no item text, id, or pass criterion moves, so the
   marker stays `RVC-v1`.

### 3. 🔴 THE VERDICT PROBLEM — decided here, honestly, before any dispatch

**The new fact.** The PRE-PROD Kong's CORS origin — the blocker that made eight `RVC-v1` items
unexecutable and two more degraded — **is fixed.** Measured a third time from this session on
2026-08-25, independently of the two earlier verifications:

```
OPTIONS https://api.crm.preprod.crm-prionex.online/api/v1/auth/login
  Origin: https://crm.preprod.crm-prionex.online
    → 200, Access-Control-Allow-Origin: https://crm.preprod.crm-prionex.online
           Access-Control-Allow-Credentials: true, Vary: Origin
  Origin: https://evil.example.com        (the discriminating control)
    → 200, Access-Control-Allow-Origin: https://crm.preprod.crm-prionex.online   ← FIXED value, not echoed
```

The foreign-origin control is what makes this evidence rather than a hopeful reading: a Kong that
**echoed** the request origin would return `https://evil.example.com` there and would admit every
site on the internet to a credentialed API. It returns the allowlisted value instead. The DEV Kong
was probed the same way and is fixed too (`https://crm.dev.crm-prionex.online`, same shape).
`Access-Control-Allow-Credentials: true` is present, which is the half `src/lib/api.ts:18`'s
`withCredentials: true` actually needs and which a wildcard could never satisfy.

**What that changes, exactly.** Nine of `RVC-v1`'s twelve items change status: F4, F5, F6, F7, F8,
F10, F11 go from `BLOCKED` to executable, and F3 and F12 go from `EXECUTABLE, degraded` to fully
executable (F3's `401`-rejection half and F12's credit-validate/submit halves both needed an API
call). F1 and F2 were always executable. **F9 does not move.** Its second, independent blockage —
no restricted-role account exists on PRE-PROD, owner Oleg — is untouched by anything the backend
team did, and `RVC-v1` predicted exactly this: *"Fixing CORS alone will **not** unblock F9: without
a restricted account there is nothing to log in as, and a permission test run from an unrestricted
account tests nothing."*

🔴 **Independently corroborated by Story 5.5's own closeout, merged as PR #85 while this story was
being written** — a fourth measurement, on a channel separate from the earlier probes. `RVC-v1` has
been amended in place to match, and this story is bound to the amended text:

> *"Fully executable as of this measurement: **F1, F2, F3, F4, F5, F6, F7, F8, F10, F11, F12 —
> eleven of twelve.** Only F9 remains `BLOCKED`."*

**F9's own executability line now reads `BLOCKED — owner: Oleg (no restricted-role account)` — ONE
owner, not two.** That matters for the note: F9's `(cause, owner)` pair is
`(restricted-role account, Oleg)`, and **`(CORS, CRM/api-prionex)` must not appear in it at all.**
`RVC-v1` is explicit that cause and owner are *parameters, not literals*, precisely so a
misattributed blocker does not get assumed fixed when somebody else's ask closes.

Per `RVC-v1`'s own rule, **none of this bumps the marker** — executability changed, no item's text,
id, or pass criterion did. The candidates validated before and after are separated by the `<B>`
count in the note, which is exactly why that count is mandatory.

#### 3.1 What aggregate verdict an 11-of-12 run can legally produce — the answer is `fail`

This is the question this story turns on, so it is answered here rather than left to a dev agent at
2 a.m. with a dispatch form open.

**There is no aggregate `pass (degraded)`.** `pass (degraded)` is an **item** verdict — one of the
four in `RVC-v1`'s verdict table, counted in `<D>`. The **aggregate** has exactly two values,
because `record-preprod-candidate.yml`'s `validated` input is a two-option `choice` (`pass`,
`fail`) and G1 refuses anything that is neither. A third aggregate value is not available to type.

**And `RVC-v1` states the aggregation rule without any room in it:**

> *"An aggregate verdict of `pass` requires **every** item to be `pass` — a full `pass`, not a
> `pass (degraded)` and not a `BLOCKED`."*

> *"Aggregate verdict: pass / fail (`pass` requires all twelve to be a full `pass`)"* — the
> Execution Log template's own line.

So: **a run in which F9 is `BLOCKED` and the other eleven are full `pass`es produces the aggregate
verdict `fail`.** Not `pass`. Not `pass (degraded)` — that value does not exist at this level. The
arithmetic is `11 + 0 + 0 + 1 == 12` and the aggregate is still `fail`, because the rule counts
*kinds*, not totals.

**And `fail` has a mechanical consequence that decides this story's shape.** `G1` is the first step
of the first job of `record-preprod-candidate.yml` (`:231-249`). It refuses `fail` with `exit 1`
before any registry read. So on a `fail`:

- no `preprod-<12hex>` is minted,
- `preprod-current` does not move,
- **no `validation_note` is ever written** — the note-shape check at `:454-467` and the ledger-row
  print at `:982` are both downstream of G1 and never run,
- and the epic's own AC2 — *"`preprod-current` and `preprod-<sha>` exist for that candidate"* —
  **cannot be satisfied**.

That collision is not new and it is not this story's to invent a way around. `RVC-v1` named it, put
Oleg's name on it, and refused to resolve it unilaterally.

#### 3.2 The decision tree, and which branch is the default

**Path A — preferred, and the only branch that satisfies every epic AC as written.**
A restricted-role account is provisioned on PRE-PROD before validation starts. F9 becomes
executable. If all twelve then pass in full, the aggregate is a genuine `pass`, the recorder writes
for real, and every leg of the cycle is exercised. **Task 1.4 sends this ask on the story's first
day** precisely so it has the longest possible lead time. The ask is small — one account with a
role that lacks at least one dashboard route's permission, plus its credentials.

**Path B — the fallback `RVC-v1` itself names, and it needs Oleg's written go-ahead BEFORE the
dispatch, not after.** The checklist's amended text keeps this exit open and narrows it to one item:

> *"if a restricted-role account exists on PRE-PROD by the time 5.6 runs, `RVC-v1` can legitimately
> produce `12/12 pass`; if not, the honest aggregate is still `fail` (or the same documented,
> time-boxed waiver this file has always allowed), **now naming only F9 rather than nine items**.
> **Owner: Oleg** for confirming or provisioning the F9 account; no waiver decision is needed for
> the CORS half anymore, since there is nothing left to waive on that axis."*

So the waiver branch is still live, and it is now a **one-item** waiver. `RVC-v1`'s standing
prohibition is unchanged: *"Silently typing `pass` is the one option this file rules out."* Its
mechanics, if Oleg authorises it:

1. A new decision record in `docs/migration-decisions.md` (next free `D` number) naming: the exact
   candidate tag, **which items are waived and who owns each**, the expiry date of the waiver, and
   that it applies to **this one candidate only**.
2. The dispatch uses `validated=pass` with a note that **keeps the true counts** — the waiver
   changes the aggregate, never the arithmetic:
   `RVC-v1 <tag>: 11/12 pass, 1 BLOCKED (F9) (restricted-role account, Oleg) — waiver <Dnn>, expires <date> — detail in docs/release-validation-checklist.md`
   The ledger row therefore discloses its own gap; a reader of `docs/preprod-candidates.md` sees
   `1 BLOCKED (F9)` without opening anything.
3. **`RVC-v1`'s marker does not bump.** No item's text, id, or pass criterion changes. A per-
   candidate, expiring exception is not a redefinition of what `validated` asserts for anyone else.
4. 🚨 The forbidden move, stated so it cannot be reached by accident: **dispatching `validated=pass`
   with a note that reports `12/12 pass`, or that drops the `<B>` clause.** That is the "silently
   typing `pass`" `RVC-v1` rules out, and it would also break the `P + D + F + B == 12` invariant
   in a way nothing checks.

**Path C — the honest floor, and the story is completable on it.** If neither the account nor an
authorisation arrives, the verdict is `fail` and it is dispatched as `fail`. G1 refuses; nothing is
written; the refusal's run id and log line are recorded; `preprod-current` is read back from the
registry to **prove** it did not move. The Execution Log section is written with the true per-item
verdicts. Epic AC2 is recorded as **unmet, with its reason and owner**, and routed as a named
follow-up — never quietly dropped and never faked.

🔴 **Why Path C costs less than it looks, and why this story must not be held hostage to reach a
`pass`.** The registry-write leg is the *one* leg of this cycle that is **already live-exercised**:
Story 5.4 minted `preprod-<sha>` and moved `preprod-current` for real, twice (runs 1215 and 1229,
both rows in `docs/preprod-candidates.md`). What has never been exercised is the *continuity* —
build → deploy → a checklist-derived verdict → the recorder, on one candidate, in one pass — and
**every step of that is exercised on Path C too**, including the recorder, whose G1 refusal is a
real workflow outcome and not a skipped step. The rehearsal's stated purpose ("the first real
release is not also the first test of the machinery") is served on all three paths. Only the
registry *write* differs, and it is the one thing that is not new.

**The default this story takes, autonomously, subject to Oleg's veto:** pursue Path A; fall back to
Path B **only** on Oleg's explicit written authorisation captured in the story file; otherwise land
on Path C and close honestly. **Do not choose between them at dispatch time.** The verdict is
derived from the Execution Log after F12, and the path follows from the verdict.

### 4. 🔴 The empty release already exists on `main` — measured, not fabricated

The epic asks for *"a change that alters nothing user-visible"*. **Do not invent one.** Measured this
session:

```
git diff --name-only 28f7fd36b75e..a99ccd44 | sed 's#/.*##' | sort | uniq -c
      2 .forgejo
      7 _bmad-output
      4 docs
```

Thirty-seven commits separate the last recorded candidate (`28f7fd36b75e`, the commit behind
`preprod-current`) from `main` at the moment this story was finished (`a99ccd44`, PR #85's merge),
and **not one byte of `src/`, `public/`, `index.html`, `vite.config.ts`, `package.json`,
`package-lock.json`, `Dockerfile`, `Dockerfile.prod`, `nginx.conf`, `tailwind.config.ts` or any
`tsconfig*.json` changed in them.** (Re-measured against `a99ccd44` after PR #85 merged mid-session;
it was 34 commits and the same empty result against `0b4fdd99` an hour earlier — the property is
stable across the merge, which is itself the point.) The empty release is already on `main`. It is a real accumulation of documentation and
workflow commits with a genuinely empty user-visible delta — which is a *better* rehearsal subject
than a synthetic no-op commit, because it is the shape a real quiet release actually has.

**This is an AC with a command behind it, not an assertion** (AC2). The dev agent re-runs the diff
against the *actual* candidate commit at rehearsal time — `main` will have moved, PR #85 among
others — and pastes both the empty result and its **negative control** (the same diff over all
paths, which must be non-empty, proving the command reports changes when there are any). A diff
command that returns empty because it was mistyped is exactly the vacuity `retro-E5` rejects.

⚠️ **Two things are NOT claimed by "empty".** The image is **not** byte-identical to candidate #2:
`vite.config.ts:8` bakes `Date.now()`, so every build of every commit produces a different bundle
hash and a different digest (Story 5.4's D3). And `.forgejo/` **did** change — the rehearsal
therefore exercises the *current* workflow definitions, which is the point of a rehearsal, not a
contamination of it. Say both in the write-up.

### 5. The cycle, step by step, with every identifier a dispatcher needs

| # | Leg | Workflow | Inputs (exact) | Expected wall clock |
|---|---|---|---|---|
| 1 | Mint the candidate | `.forgejo/workflows/build.yml` | `ref: <candidate commit sha>`, `environment: preprod` | **~4 min** (run 1223 was 4 min; 106 s on a quieter day) |
| 2 | Put it on the stand | `.forgejo/workflows/deploy-preprod.yml` | `image_tag: sha-<12hex>-preprod` — and **nothing else**; leave `simulate_bad_credential: false` and `hold_lock_seconds: 0` | **~60-90 s** (1184 ~60 s, 1225 ~70 s, 1198 ~19 s) |
| 3 | Validate | *no workflow* — `docs/release-validation-checklist.md`, `RVC-v1`, executed by hand | P1 → P2 → F1 … F12 | **human time; the dominant term. Budget hours, not minutes.** |
| 4 | Record | `.forgejo/workflows/record-preprod-candidate.yml` | `image_tag: sha-<12hex>-preprod`, `validated: <derived>`, `validation_note: <RVC-v1 format>`, `allow_backwards_move: false` | **~80 s green** (1215: 83 s, 1229: 76 s + ~60 s `waiting`); **~3 s on a G1 refusal** (1218) |
| 5 | Append the ledger row | *no workflow* — edit `docs/preprod-candidates.md` | the line the recorder's own last step prints | minutes |

**Identifiers, all verified against the shipped files:**

- Image repository, a literal constant, never composed: `git.crm-prionex.com/crm/fe-prionex`
- Candidate tag shape: `sha-<12 hex>-preprod`. The 12 is `build.yml:801`'s `cut -c1-12`, and
  `record-preprod-candidate.yml`'s **G3 requires exactly 12** — a length mismatch fails every
  legitimate release.
- Markers the recorder writes, **in this order and no other**: `preprod-<12hex>` **first**, then
  `preprod-current`. If a run dies between them, history exists and the pointer is stale — which is
  recoverable and leaves Story 6.5 correct. The reverse order is the state 6.5 misreads.
- Stand: `/root/crm-prionex/fe-prionex-preprod/`, container and compose project both
  `fe-prionex-preprod`, `FRONTEND_PORT=127.0.0.1:8083`, network `crm-preprod-network`.
- Runner label for both deploy and recorder-verify jobs: **`deploy-dev-preprod`** (capacity 1). The
  recorder's second job runs on `node-20`.
- Concurrency group, shared **deliberately** by `deploy-preprod.yml` and
  `record-preprod-candidate.yml`: the literal `deploy-preprod-fe-prionex-preprod`. A recorder
  dispatched while a deploy is in flight goes `waiting`, not red. Do not diagnose that as a hang.
- SSH: `root@10.67.0.1`. External `185.185.49.127:22` times out **by `ufw` design** — that is not an
  outage.

🔴 **The one non-obvious coupling that will bite a rehearsal dispatched from a story branch.** In
`image_tag` mode the callee's compose checkout falls back to `github.sha` — *the commit that
dispatched the caller* (`deploy-stand.yml`, the `image_tag` fallback branch). **So the deploy reads
`docker-compose.stand.yml` from whatever branch the dispatch was issued against.** Before dispatch
1, assert both: `git diff origin/main -- docker-compose.stand.yml` is empty, and the file's sha256
is `7f449dacce163fed898b06d3d3d204656b0f485fdbad1827c03c7aac9b1932ec` — the value the stand
directory's own copy carries. Paste both.

### 6. Who executes what — the browser items cannot be executed by the dev agent

This is the constraint that shapes every task below, and no prior story has had to state it.

**`RVC-v1` is a browser checklist.** Its items are written against devtools, a rendered login
screen, a PDF that opens, a call bubble, a streaming response. A CLI agent has no browser, no
credentials, and no phone. **The dev agent cannot execute F3-F12 and must never record a verdict
for an item it did not itself observe.**

| Item | Executed by | Method |
|---|---|---|
| **P1** — stand healthy + serving this exact digest | **dev agent** | `ssh root@10.67.0.1`. `docker inspect fe-prionex-preprod --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}'`, then `.Image` → `docker image inspect <id> --format '{{range .RepoDigests}}{{.}} {{end}}'`, compared **by exact equality** against the digest the tag resolves to. 🔴 `docker inspect` on a **container** has no `.RepoDigests` — that field is on the **image**; and a bare `{{.RepoDigests}}` renders an empty slice as the literal `[]`, which is non-empty. Both are recorded 5.4/5.2 defects. Execute this **BY HAND AT THE START**, not by trusting the recorder's G4/G5 — `RVC-v1` explains at length why that delegation is wrong. |
| **P2** — you are looking at the candidate you think you are | **dev agent** | fetch the served `assets/index-*.js`, extract the single quoted 13-digit integer, decode as ms epoch, require it **at or after `build.yml`'s run `started`** (not the image's `created`). §2 above shows the exact commands and the current value. |
| **F1** — shell over TLS | **joint** | dev agent: `curl` every asset referenced by `index.html` and assert `200` on all of them plus `ssl_verify_result=0` — a stronger measurement than reading the Network tab. **Oleg:** padlock, no interstitial, login screen renders, no uncaught console error other than the exempted `api.crm.preprod…` family. |
| **F2** — bundle carries PRE-PROD values | **dev agent**, in full | `grep -cF` per served asset, all five criteria. §2 above is a live worked example. Criterion 5 additionally needs a read of the Forgejo repository variable `vars.VITE_OPERATOR_PHONE_URL_PREPROD` — *"check the variable, do not guess"*; **route that read to the coordinator** and mark the subtask `PENDING (owner: coordinator)` until it returns. Decided value for preprod is EMPTY (Oleg, 2026-08-17), so the expected observation is no `phone.` URL and no operator-phone panel. |
| **F3 … F12** | **Oleg** | browser, credentials, real accounts. The dev agent transcribes his observation verbatim into the Execution Log and puts **his** name in `Executed by:`, not its own. |

🔴 **An item nobody executed is not `BLOCKED`.** `RVC-v1` is explicit: `BLOCKED` means "could not be
executed at all" **and requires naming a real owner**; recording an unreached item as `BLOCKED` with
an invented owner is misattribution. And:

> *"If validation stops partway through F1-F12 for any reason other than a P1/P2 abort, the run has
> no legal note under this format at all — do not force one; re-run from the start."*

**Therefore validation is one continuous session or it is nothing.** That is why §7 exists.

### 7. 🔴 Fixture readiness — the second class of blockage, and nobody has enumerated it

CORS was never the only thing standing between `RVC-v1` and a green run. **Nine items require test
fixtures whose existence on PRE-PROD has never been established by anybody.** Read F4's own text:

> *"3. An account with 2FA enabled … 5. A locked account … 6. A login from an address outside the IP
> whitelist … 7. An account flagged for a forced password change"* — and *"all seven behave as
> listed"* is its pass criterion.

That is four separately-provisioned accounts for **one item**, and F4 has no degraded wording: it
passes in full or it does not pass. The same question is open for F5 (clients with data), F6 (a
payment that can be recorded, edited, cancelled, verified, and receipted), F7 (telephony provisioned
and a real phone that can ring), F8 (an import file with a deliberately malformed row, and seven
bulk pages), F10 (messaging/SMS integrations actually configured), F11 (the AI assistant
configured), and F12 (EasyPay reachable).

**Task 2 is a fixture-readiness pass and it costs zero runs.** It is the highest-value task in this
story, because `RVC-v1` forbids partial runs: a fixture discovered missing at F7 does not cost F7 —
it costs the whole session, and AC3's repeat rule then costs a rebuild too.

**Honest expectation, stated so a red round is not read as failure:** the coordinator's current
belief is that F9 alone remains blocked. That belief is about **CORS**, and it is correct about
CORS. It has never been tested against fixtures. **It is more likely than not that at least one
further item is blocked on a missing fixture on first execution** — that is this project's own
repeated lesson (Story 4.6 spent 23 of 39 runs on one step; Story 4.3 paid five red dispatches for
skipping the zero-dispatch conversion; Story 5.3's `image_tag` mode broke twice on its second and
third dispatches after going green on its first). A blockage found in Task 2, before the build, is
free. The same blockage found at F7 costs the entire cycle.

🚨 **Side effects: four items write to a shared, live backend, and two can reach the outside world.**
`crm-preprod-network` carries **69 containers belonging to `CRM/api-prionex`**. F6 records a real
payment. F8 imports real client rows. **F10 can send real SMS. F12 submits a real payment to
EasyPay. F7 places a real outbound call.** None of that is this repository's to decide.

**Rule, and it is a prohibition:** do **not** execute F7's outbound call, F10's campaign send, or
F12's payment submission until Oleg has confirmed in writing that the relevant integration is in a
non-production/sandbox mode on PRE-PROD. If he cannot, that item is `BLOCKED` with a **real named
owner** — which is a legal `RVC-v1` verdict and an honest one, and it goes in `<B>` with its own
`(cause, owner)` pair, never merged into F9's.

### 8. The repeat rule (epic AC3) and the trap it walks straight into

The epic:

> **Given** the rehearsal surfaces defects in the workflows
> **When** they are fixed
> **Then** the rehearsal is repeated end to end rather than resumed from the failure point.

**First, distinguish two kinds of failure, because only one of them triggers a repeat.**

- **A workflow defect** — the machinery misbehaved (a guard misfires, a step crashes, a classifier
  prints the wrong thing). Fix it under §11's exception procedure, then **restart from a new
  `build.yml` dispatch.** A resumed run is not a rehearsal.
- **A candidate or environment defect** — an `RVC-v1` item legitimately fails, or a fixture is
  missing. That is not a workflow defect; the cycle worked. The verdict is `fail` (or the item is
  `BLOCKED`) and that **is** the outcome. Do not "repeat until green" — that is how a checklist
  becomes decoration.

🔴 **And here is the trap, which nothing in the epic anticipated.** Story 5.4's D3: the build is not
reproducible (`vite.config.ts:8` bakes `Date.now()`), so **rebuilding the same commit produces a
different digest**. If round 1 recorded `preprod-<X>` and round 2 rebuilds commit `X`, the
recorder's repoint guard refuses — and Prohibition 14 forbids deleting the marker to make room. The
only exit is a manual `DELETE` of the package version **by Oleg in person** with a `write:package`
credential, followed by a re-dispatch. That is an operational dead end with no automated mitigation,
and it is reachable from this story's own AC3.

**Two rules that keep the story out of it, and they are absolute:**

1. **Dispatch `record-preprod-candidate.yml` at most once per candidate commit.** If it went green,
   that commit is recorded forever at that digest.
2. **If a repeat is needed after a successful record, the repeat uses a NEW candidate commit** — a
   fresh empty-release commit, never a rebuild of the recorded one.

### 9. Release scope freeze — epic AC4, and what the regulation must actually say

The epic requires the process expectation to be *"written into the release regulation"*. **No such
document exists.** `docs/forgejo-migration.md:236` carries the sentence in Russian
(*"ничто технически не мешает задеплоить в preprod новый тег посреди валидации"*) inside a migration
plan, and `:259` routes a *"документ Deployment Process"* to the documentation story in Epic 7.

**Decision, autonomous, Oleg's veto open:** this story creates **`docs/release-regulation.md`** — one
page, minimal, additive, touching no frozen file. It states the five legs of §5 with their workflow
names, points at `RVC-v1` and `docs/preprod-candidates.md`, and carries the scope-freeze clause.
Epic 7's documentation story absorbs it later rather than the reverse. It is **not** a new gate and
adds no machinery.

**What the scope-freeze clause must say, precisely — a vague version fails AC4:**

1. **Nothing technically prevents it.** `deploy-preprod.yml` is dispatchable by anyone with
   repository write access at any moment, including the middle of a validation session. NFR9 already
   says the same about PROD; it is true here too. There is no gate and this story does not add one.
2. **The agreement:** between P1 and the recorder dispatch, **no `deploy-preprod.yml` dispatch is
   issued for this stand by anyone.** It is an agreement between people, enforced by nothing.
3. 🔴 **Name the partial technical backstop honestly, and name the hole in it.** The recorder's G5
   requires the stand to be *demonstrably serving the candidate's digest at record time*, so a
   redeploy left in place during validation makes the recording fail — **late, loudly, and safely.**
   But G5 brackets the window, it does not cover it: a tag deployed mid-validation and then
   **reverted** before recording passes G5 while the twelve verdicts describe a stand that was
   serving something else for part of the session. P1-at-start plus G5-at-end is a bracket with a
   gap in the middle, and **only the agreement closes it.** `RVC-v1` makes the same argument about
   its own G4/G5 delegation, for the same reason.
4. **And the recorder is not an approval gate.** NFR9: anyone with write access can dispatch it, and
   nothing forces the verdict typed to reflect the checklist. `RVC-v1` makes the verdict *derived*
   rather than *asserted*; it does not make it *enforced*. Overstating that would be the same
   vacuity this project has rejected three times.

### 10. 🔴 Three deferred items name **Story 5.6** as their owner — they are in scope, and one of them is not optional

`deferred-work.md` assigns three items to this story by name. They were not invented here and they may
not be silently re-deferred.

**(a) Where a *rejected* candidate is recorded** (`deferred-work.md`, code review of spec-5-5).
Verbatim: *"a `fail` verdict leaves no trace in `docs/preprod-candidates.md`"* — G1 refuses before the
ledger-row printer ever runs, so *"the append-only ledger cannot distinguish 'validated and rejected'
from 'never validated at all' … silence is indistinguishable from nobody having tried."*
**Owner: Story 5.6**, *"the one that must decide where a rejected candidate is recorded."*

🔴 **This one is not optional, because Path C in §3.2 lands directly on it.** Decision, autonomous,
Oleg's veto open: **add a second append-only table to `docs/preprod-candidates.md`, headed
"Rejected candidates"**, with the columns `Date (UTC) | Candidate tag | Digest | Verdict | Note |
Recorder run id (refusal)`. It is written by hand, exactly like the pass rows already are — the
workflow holds no repository-write credential and is not getting one. Same file, because a reader
asking "what happened to candidate X" must not have to know which of two files to open. Same
append-only, never-reinterpreted rule. This story writes the first such row **if and only if** its
own verdict is `fail`.

**(b) `git log` supplies the order the registry does not** (`deferred-work.md`, dev-story of 5.4).
Story 5.4's AC5 claimed the `preprod-<sha>` sequence reconstructs the validation history; the
registry's `tags/list` **orders nothing**. **Owner: Story 5.6** — *"should compose the registry's own
set with `git log`'s order explicitly, not assume the registry does it."* Cheap and free of runs:
enumerate `preprod-<12hex>` from `tags/list`, map each back to its commit, and order them with a
single `git log` call. That is AC6 below.

**(c) M7's eight unexercised branches in `record-preprod-candidate.yml`** (`deferred-work.md`, fix-pass
of 5.4). **Owner: Story 5.6, "full stop, with no standing conditional successor clause"** — and the
same entry says, in as many words, *"5.6 is still not **required** to force these eight branches —
naming an owner assigns the decision, it does not manufacture a requirement."*
**Decision, autonomous:** this story does **not** force them. Forcing eight branches would need
roughly eight extra dispatches and would turn a rehearsal into a second guard-matrix story, and this
story's ledger cannot carry that on top of AC3's repeat reserve. **The obligation the entry attaches
to that choice is honoured instead: at closeout, re-own the item to a named successor** — the same
entry says re-owning *"is a **required action at that story's own closeout**"*. Route it to Story 6.4
(the story that next opens these workflows) and say so in `deferred-work.md`, under the original
entry, never as a new one.

### 11. Run budget model

retro-D4 (`epic-3-retro-2026-08-18.md:77`): **declare before work; the ledger closes only against a
query re-run after the merge commit lands.** A ledger closed at PR-open is not closed. If the query
cannot be run, close it with the literal word **OPEN** — never a self-reported number.

🔴 **The permanent story-push line (DN4 of Story 4.7's review, standing since):** *"pushes to the
story's own context/work branch" is a repeating, per-push ledger line, priced per push, not one flat
"closeout push"* — each is a real four-job `ci.yml` run. Standing floor: a story costs
**pushes + 1 PR-open run + 1 merge run**. `ci.yml` has **no `paths:` filter**, so a documentation-only
commit costs a full four-job run, and **a push landing while the PR is already open fires both `push`
and `pull_request` — two rows.** Forgejo's `push` fires once per *push*, not per commit, so batch.

| Line | Runs |
|---|---|
| Push: context (this file) | 1 |
| Push: dev-story write-up | 1 |
| PR-open run | 1 |
| Push: code-review commit (PR open → two rows) | 2 |
| Push: fix-pass commit (PR open → two rows) | 2 |
| Merge run (`build-main.yml`) | 1 |
| **R1** — `build.yml`, `ref=<candidate>`, `environment=preprod` | 1 |
| **R2** — `deploy-preprod.yml`, `image_tag=sha-<12>-preprod` | 1 |
| **R3** — `record-preprod-candidate.yml`, derived verdict | 1 |
| **Declared floor** | **11** above baseline |
| 🔴 **Repeat reserve #1** — epic AC3 forbids resuming; one workflow defect costs a whole new R1-R3 | **+3** |
| 🔴 **Repeat reserve #2** — first-execution lesson (§7); the browser path has never run once | **+3** |
| **Declared ceiling** | **17** |

**Free rows, and they are not optional because they are free** (5.3's lesson, 5.4's D0): a dispatch
with a **required input omitted** returns **HTTP 400 and creates zero `action_run` rows** — confirmable
by `max(id)` being unchanged around the call. Use it to prove `image_tag` is genuinely required on
both `deploy-preprod.yml` and the recorder without spending a row. Task 3 in its entirety costs **0**.

🔴 **A floor, not a ceiling, and this instance has no cancel endpoint** — a dispatch issued by mistake
runs to completion and occupies its row. Do not "just try one".

🔴 **No-touch window.** The Sunday `dev-reset.yml` tick is **02:00 UTC**; the standing rule is **no
dispatch and no live lock holder across 01:45–02:30 UTC**, and no `main` merge inside it. The next
tick is **2026-08-30**. This story's validation session is measured in hours — **check the clock
before starting P1, not after F11.**

⚠️ **Two dated, host-shared hazards that land inside this story's window and are not this story's to
fix.** (1) `deferred-work.md` carries a **📅 DUE 2026-08-29** obligation: the first moment the 14-day
retention rule can be observed, currently **unowned**. `sha-<12>-preprod`, `preprod-<12hex>` and
`preprod-current` are all protected by `keep_pattern`, so the rehearsal's own artifacts are safe by
shape — but if the rehearsal spans that date, read the outcome rather than assuming it.
(2) `dev-reset.yml` enumerates the shared `IMAGE_REPO` with **no environment filter** and sweeps
untagged, unreferenced images older than 168h. The rehearsal's candidate is minted fresh, so it is
outside that window by construction — **say so, do not merely hope so**.

### 12. 🔴 Blast radius, frozen files, and the §12 exception procedure

Story 4.9 (*Cut DEV Over to the New Stand*) is being implemented in parallel on `story-4-9/*` and
holds **D35** on its unmerged branch — which is why `docs/migration-decisions.md` on `main` jumps
from D34 to D36, deliberately. The coordinator serializes host-side work; Oleg merges. **This story
runs from a scratchpad worktree; the primary checkout is 4.9's.**

**This story must not modify, and must not push any change to:**

- 🔴 **`.forgejo/workflows/deploy-stand.yml`** — read-only. *"Every edit re-triggers Epic 5's own
  re-earning of the retro-E5 evidence Story 4.8 paid for, and it sits inside 4.9's blast radius."*
- 🔴 **`.forgejo/workflows/deploy-preprod.yml`** — 5.3's and 5.5's shipped artifact.
- 🔴 **`.forgejo/workflows/record-preprod-candidate.yml`** — 5.4's shipped artifact, now equally frozen.
- **`.forgejo/workflows/build.yml`** — read-only, **and this story dispatches it once without
  modifying a line.** *"Dispatching is not opening."*
- `.forgejo/workflows/deploy-dev.yml`, `dev-reset.yml`, `ci.yml`, `build-main.yml`
- 🔴 **`docs/release-validation-checklist.md`** — 5.5's shipped artifact. This story **executes** it and
  **appends one section to its Execution Log**; it changes no item's text, id, or pass criterion, so
  the marker stays `RVC-v1`. Appending to the Execution Log is the one edit `RVC-v1` itself asks 5.6
  to make (*"5.6 writes the first section here"*). **Nothing else in that file may be touched** —
  including "fixing" the `3 files` parenthetical in F2 c1 (§2). Record the discrepancy as evidence;
  changing a criterion is `RVC-v2`, and that is a story, not a keystroke.
- `README.md`, `docker-compose.server.yml`, `docker-compose.stand.yml`, `.env.stand.example`,
  `nginx.conf`, `Dockerfile.prod`, `epics.md`, or any artifact of Story 4.9
- `4-9-cut-dev-over-to-the-new-stand.md`, or any `story-4-9/*` branch
- **the DEV stand on s1** — its directory, its `.env`, its container, its network membership, its lock
  file. **NFR5.**
- **the PRE-PROD stand's host configuration** — no `.env` edit, no nginx, no certbot, no
  `docker network` verb of any kind. This story's only host contact is `docker inspect` /
  `docker image inspect` / `docker buildx imagetools inspect` and `psql` reads.

🔴 **The one named exception, priced in advance.** If a dispatch exposes a **real defect** in
`deploy-stand.yml`, `deploy-preprod.yml`, `record-preprod-candidate.yml` or `build.yml` that blocks
this story and no other story can fix it, follow 5.3's §12 procedure **exactly**:

1. **State the defect with the failing run id and the exact log line.**
2. **Name which retro-E5 rows the change invalidates** — including Story 4.8's void-clause: if the
   diff shows any change inside those blocks beyond a literal→input substitution, the argument is
   void and the row must be re-dispatched (as amended by Oleg to exempt a pure fail-closed early exit
   that shares no state with the block).
3. **Price the re-dispatches in the ledger BEFORE making the edit** — and remember AC3: a fix costs a
   *whole new cycle*, not one re-dispatch.
4. **Escalate to Oleg as a blocking Open Question. Do not edit and report afterwards.**

**§12 is a priced, escalated, authorized-before-editing procedure — not a permission.** Story 5.3
invoked it three times, all with Oleg's explicit authorization relayed by the coordinator; Story 5.4
needed it zero times.

### 13. Boundaries — five things this story must not absorb

1. **Real end-to-end tests.** The `e2e` job is a placeholder that prints and exits 0, deliberately.
   **Do not add playwright/cypress/puppeteer, and do not make it assert anything.** That is
   **Story 7.7**, made its own story precisely so it could not be absorbed here. Removing
   `continue-on-error: true` is also 7.7's, in the same change that installs real tests.
2. **`RVC-v2`.** Widening route coverage, changing an item's criterion, or changing the aggregation
   rule is a checklist revision and a separate decision. §3.2's Path B is a *per-candidate,
   expiring exception* — deliberately not a rule change.
3. **Fixing the CORS-adjacent debris.** The DEV frontend vhost is still broken (measured this
   session: `crm.dev.crm-prionex.online` fails TLS verification and returns no HTTP status). That is
   Story 4.9's and it is irrelevant to PRE-PROD. **No AC in this story may depend on DEV.**
4. **Forcing M7's eight recorder branches** — §10(c). Route, do not execute.
5. **Slack notification.** Story 4.5, sequenced last, and no Epic 5 story blocks on it.

---

### Prohibitions

🚨 **A prohibition here cannot be overridden by a subtask.**

1. 🔴 **Never type `pass` for an aggregate verdict that `RVC-v1`'s own rule does not produce.** Not
   "close enough", not "everything that mattered passed". §3. If `<D>` or `<B>` is non-zero and no
   authorised waiver exists, the aggregate is `fail`.
2. 🔴 **Never record a verdict for an item you did not observe.** The dev agent has no browser. F3-F12
   are Oleg's observations, transcribed with his name in `Executed by:`.
3. 🔴 **Never record an unreached item as `BLOCKED`.** `BLOCKED` requires a real named owner. A
   partial run has **no legal note** — re-run from the start.
4. 🔴 **Never edit `deploy-stand.yml`, `deploy-preprod.yml`, `record-preprod-candidate.yml` or
   `build.yml`** — §12, and the one exception is a procedure, not a permission.
5. 🔴 **Never change an item's text, id, or pass criterion in `docs/release-validation-checklist.md`.**
   Appending one Execution Log section is the only permitted edit to that file.
6. 🔴 **Never dispatch the recorder more than once for the same candidate commit** — §8. A rebuild of
   a recorded commit is an operational dead end whose only exit is Oleg deleting a package version
   by hand.
7. 🔴 **Never edit a section of the Execution Log or a row of `docs/preprod-candidates.md` after it is
   written.** Both are append-only. A re-validation is a new section, never a rewrite.
8. 🔴 **Never execute F7's outbound call, F10's campaign send, or F12's payment submission** without
   Oleg's written confirmation that the integration is in a non-production mode on PRE-PROD. §7.
9. 🔴 **Never `docker network create|rm|connect|disconnect`.** `crm-preprod-network` belongs to
   `CRM/api-prionex` and carries 69 of their containers.
10. 🔴 **Never delete a registry tag or package version** (D24). A wrong tag is an Open Question for
    Oleg, not a cleanup.
11. 🔴 **Never `cat /root/.docker/config.json`.** `auths.*.auth` is `base64(user:token)` — that is
    exactly how Story 5.2 leaked its second unrevocable token. Use
    `python3 -c "import json; print(list(json.load(open('/root/.docker/config.json'))['auths'].keys()))"`.
    Never `/usr/local/bin/bao` (world-readable wrapper, silently authenticates as `admin`).
12. 🔴 **Never `${{ }}` inside any `run:` body, including inside its comments.** This instance
    substitutes inside shell comments and one empty token has rejected an entire workflow with no
    diagnostic beyond `action_run.pre_execution_error_details` (D21). *(This story writes no
    workflow code — the prohibition stands anyway, for any §12 exception.)*
13. 🔴 **The dev agent does not touch the Forgejo API and does not open the PR.** The coordinator
    dispatches, queries run ids and closes the ledger; Oleg merges. Mark those subtasks
    **`PENDING (owner: coordinator)`** rather than checking them. Story 5.2's **M14** exists because
    a subtask was checked `[x]` with no PR anywhere in the record.
14. 🔴 **Never claim a check that could not have failed.** This project has rejected that vacuity
    three times (D34 §3, 5.1's review, 5.2's H2). If only the weak form is available, run it and
    **say which**.
15. 🔴 **Never soften a disposition.** The four words are `UNPROVEN`, `OPEN`, `PENDING (owner: name)`,
    or the claim is simply not made. There is no fifth, softer word.
16. 🔴 **Paste the artifact, do not characterise it.** The same finding has been made three times
    (4.2 M3, 5.2 M1, 5.4 M10).
17. 🔴 **Read verdicts from `action_task_step.status` and from registry/stand state, never from a log
    line alone** — job logs on this instance frequently never archive (`log_in_storage='f'`, observed
    six times across six sessions).

---

## Acceptance Criteria

The epic's four ACs are carried in full and stated below as AC1, AC2/AC8, AC9 and AC10. AC3-AC7 and
AC11-AC13 are 🔴 **ADDED** — they make the epic's ACs measurable in the world of 2026-08-25, and
three of them discharge items `deferred-work.md` assigns to this story by name.

### AC1 — Every step is performed through the workflows, not manually *(epic AC1)*

**Given** the five legs of §5
**When** the rehearsal runs
**Then** each of the three machine legs is a `workflow_dispatch` of its own workflow, identified by
run id
**And** no `docker build`, `docker pull`, `docker compose up`, `docker tag` or
`docker buildx imagetools create` is executed by a human or an agent against the candidate at any
point.

**Discriminating evidence, and it must be a *negative*, not an assertion of virtue:** the story's
own `psql` ledger query lists every `action_run` row created in the window, attributed per
retro-D4's parallel-era method; and an `ssh root@10.67.0.1 'docker events --since <T0> --until <T1>
--filter type=image --filter event=pull'`-equivalent is **not** available retroactively, so use the
readable substitute instead: `docker image inspect <candidate> --format '{{.Created}}'` compared
against R1's run window, plus the absence of any human-issued command in the story's own transcript
of executed commands. **Say which of those two is the weak form.**

### AC2 — The release is empty **by measurement**, and the measurement can fail *(epic AC1's "alters nothing user-visible")*

**Given** the commit chosen as the candidate
**When** it is compared against the commit behind `preprod-current`
**Then** `git diff --name-only <preprod-current commit>..<candidate commit> -- src public index.html vite.config.ts package.json package-lock.json Dockerfile Dockerfile.prod nginx.conf tailwind.config.ts postcss.config.js components.json 'tsconfig*.json' .env.example .env.stand.example .env.production.example`
returns **empty**
**And** the **negative control** — the same `git diff --name-only` with no path filter — returns a
**non-empty** list, proving the command reports changes when there are any
**And** both outputs are pasted verbatim, not characterised.

⚠️ **Two things this AC does not claim, and the write-up must say so.** The image is **not**
byte-identical to the previous candidate — `vite.config.ts:8` bakes `Date.now()`, so every build is
a new digest (5.4's D3). And `.forgejo/` **did** change between the two commits, which means the
rehearsal exercises the *current* workflow definitions — the point of a rehearsal, not a defect in it.

### AC3 — 🔴 ADDED: the candidate is minted by `build.yml`, with the environment named explicitly

**Given** `build.yml`'s dispatch form
**When** R1 is dispatched
**Then** its inputs are exactly `ref: <candidate commit>` and `environment: preprod`
**And** the resulting tag is `sha-<first 12 hex of the candidate commit>-preprod`, read back from
the registry, with its digest recorded
**And** the run's own **`started`** timestamp is recorded — it is the reference instant P2 and F2 c4
compare the bundle epoch against, and it is **not** the image's `created` time, which is later and
is the wrong one.

**Discriminating evidence:** `docker buildx imagetools inspect --format '{{json .Image}}'` on the
new tag, showing `org.opencontainers.image.version` == the 12 hex, `org.opencontainers.image.revision`
starting with it, and `org.prionex.environment` == `preprod`. ⚠️ **Do not present that as an
independent check** — 5.4's M1 established that all three of G6's clauses are **identities** for any
`build.yml`-produced artifact. It is a consistency read; label it as one.

### AC4 — 🔴 ADDED: the candidate reaches the stand only through `deploy-preprod.yml`, in `image_tag` mode

**Given** the tag from AC3
**When** R2 is dispatched
**Then** its inputs are `image_tag: sha-<12hex>-preprod` and nothing else
(`simulate_bad_credential: false`, `hold_lock_seconds: 0`)
**And** the tag↔environment guard passes rather than being bypassed
**And** the `e2e` placeholder job runs after `deploy`, prints its rationale, exits 0, and **does not
gate** — confirmed from `action_task_step.status`, not from a log line
**And** the stand's running image `.RepoDigests` contains the candidate digest afterwards.

🔴 **Before R2, assert the compose coupling** (§5): `git diff origin/main -- docker-compose.stand.yml`
is empty and its sha256 is `7f449dacce163fed898b06d3d3d204656b0f485fdbad1827c03c7aac9b1932ec`. In
`image_tag` mode the callee checks out compose at **the commit that dispatched the caller**, so a
dispatch from a story branch reads that branch's copy.

⚠️ **What this AC does NOT prove, stated so the write-up cannot overclaim it:** a **true no-op
redeploy** — resolved digest equal to the digest already running — is *still* unobserved, and this
rehearsal does not observe it either, because the empty release still produces a new digest. The
`deferred-work.md` item that names that gap stays open and must be re-stated, not quietly closed.

### AC5 — 🔴 ADDED: `RVC-v1` is executed in full, in one continuous session, and its first Execution Log section is written

**Given** `docs/release-validation-checklist.md`, marker `RVC-v1`
**When** validation is performed
**Then** **P1 is executed by hand at the start**, before F1, and not delegated to the recorder's
G4/G5
**And** P2 is executed after a hard reload
**And** **every one of F1…F12 carries exactly one of the four legal verdicts** — `pass`,
`pass (degraded)`, `fail`, `BLOCKED` — with no item unreached
**And** every `BLOCKED` entry names a **real** owner, and every `pass (degraded)` entry carries the
exact words that item's own text requires
**Or**, if **P1 or P2 fails**, F1-F12 are **not executed at all**, the aggregate is `fail`, and the
fixed precondition-failure note shape is used —
`RVC-v1 <image_tag>: precondition failed (<P1|P2>) — validation aborted, no items executed` — with
the file's own **short** template and no per-item table, because no counts were collected
**And** a new section is appended to the Execution Log with the heading
`### <image_tag> — <YYYY-MM-DDTHH:MMZ>` (UTC, minute precision, the moment P1 was executed), using
the file's own template, with `Executed by:` naming whoever actually observed each item.

🚨 **If validation stops partway through F1-F12 for any reason other than a P1/P2 abort, there is no
legal note and no section is written. Re-run from the start.** That is `RVC-v1`'s rule, not this
story's preference, and it is why §7's fixture-readiness pass exists.

### AC6 — 🔴 ADDED: the aggregate verdict is **derived**, and the note is well-formed

**Given** the completed Execution Log section
**When** the aggregate verdict is determined
**Then** it is `pass` **iff every one of the twelve is a full `pass`**, and `fail` otherwise —
no other rule is applied, and `pass (degraded)` is never used as an aggregate
**And** the `validation_note` follows `RVC-v1`'s exact format, satisfies `P + D + F + B == 12`,
contains **no `|`** and **no newline**, names **the same `image_tag` that is actually dispatched**,
and lists each distinct `(cause, owner)` pair separately rather than hardcoding `(CORS, CRM/api-prionex)`
**And** empty clauses are dropped only when their count is 0, dropping the exact literal including
the leading comma and space.

⚠️ **None of those four shape rules is enforced by anything.** The recorder rejects only a blank
note. The `P + D + F + B == 12` check catches arithmetic, never misclassification. **Have a second
reader check the note against the Execution Log before the dispatch** — that is the only control
that exists.

### AC7 — the recorder is dispatched exactly once, and its outcome is read back from the registry *(epic AC2, first half: `preprod-current` and `preprod-<sha>` exist for that candidate)*

**Given** the derived verdict
**When** R3 is dispatched with `image_tag`, `validated`, `validation_note` and
`allow_backwards_move: false`
**Then** **on `pass`**: `preprod-<12hex>` and `preprod-current` both exist and both resolve to the
candidate digest, **verified by an independent `docker buildx imagetools inspect` run on s1** and not
from the workflow's own success message; and the row the run's last step prints is appended verbatim
to `docs/preprod-candidates.md`
**And** **on `fail`**: G1 refuses as the **first step of the first job**, `preprod-<12hex>` does
**not** exist, and `preprod-current` still resolves to the digest it resolved to **before** R3 —
both read back and pasted, because "nothing was written" is a claim that must be measured
**And** either way the run id, the refusing/succeeding step name and its `action_task_step.status`
are recorded.

🔴 The order the recorder writes in is `preprod-<sha>` **first**, then `preprod-current`. If a run
dies between them, history exists and the pointer is stale — recoverable, and Story 6.5 stays
correct. Do not "help" by reversing it.

⚠️ **A residual that is live in this rehearsal and must be re-stated, not re-closed:** 5.4's **H3** —
the digest G5 proves and the digest the marker records are resolved independently and **no step
compares them**. That was resolved by *disclosure*, not by a fix. Say so.

### AC8 — Total elapsed time is recorded *(epic AC2, second half)*

**Given** the completed rehearsal
**When** the elapsed time is reported
**Then** it is reported **split**, not as one number: R1, R2 and R3 each from their own `started`/
`stopped` in `action_run`; the validation leg from the Execution Log's `Started (UTC)` to the last
item's observation; and the wall-clock total from R1's dispatch to the ledger row
**And** any `waiting` time on the shared `deploy-preprod-fe-prionex-preprod` concurrency group is
reported separately from execution time
**And** the machine total and the human total are stated as two figures.

**Why split:** the human leg dominates and a single number hides it. Prior data for comparison —
`build.yml` preprod ~4 min (run 1223); `deploy-preprod.yml` ~19-70 s (runs 1198, 1184, 1225);
recorder ~76-83 s green (1215, 1229) and ~3 s on a G1 refusal (1218); run 1229 additionally spent
**~60 s `waiting`** on the concurrency group. **Read every one of these from `action_run.started`/
`stopped`, never from a relayed figure** — Story 5.1's backfill found a run relayed as *"~70 s"* that
measured **49 s**.

### AC9 — The repeat rule is honoured, and its trap is avoided *(epic AC3)*

**Given** the rehearsal surfaces a **workflow** defect
**When** it is fixed under §12's procedure
**Then** the rehearsal restarts from a **new `build.yml` dispatch**, not from the failure point, and
the repeat is priced in the ledger before the edit
**And** an `RVC-v1` item failing, or a fixture being missing, is **not** treated as a workflow defect
— the cycle worked, and `fail`/`BLOCKED` is the outcome
**And** the recorder is dispatched **at most once per candidate commit**; if a repeat is needed after
a successful record, it uses a **new** candidate commit, never a rebuild of the recorded one
(5.4's D3: the build is not reproducible, the repoint guard refuses, and the only exit is a manual
package-version `DELETE` by Oleg in person).

### AC10 — Release scope freeze is written down as the process agreement it is *(epic AC4)*

**Given** that scope freeze is a process agreement rather than a technical control
**When** the rehearsal is documented
**Then** `docs/release-regulation.md` exists and states, explicitly: that **nothing technically
prevents** dispatching `deploy-preprod.yml` for this stand during a validation session; that the
agreement is that **no such dispatch is issued between P1 and the recorder dispatch**; that the
recorder's **G5 is a late, partial backstop, not a prevention** — it fails a recording whose stand
is not serving the candidate, but a redeploy that is **reverted** before recording passes it; and
that per **NFR9** the recorder is not an approval gate — anyone with write access can dispatch it and
nothing forces the typed verdict to reflect the checklist
**And** the document points at `RVC-v1`, `docs/preprod-candidates.md` and the five legs of §5
**And** it adds no gate and no machinery.

### AC11 — 🔴 ADDED: a rejected candidate has a home *(discharges the `deferred-work.md` item owned by Story 5.6)*

**Given** that a `fail` verdict makes G1 refuse before the ledger-row printer ever runs, so today a
rejected candidate leaves **no trace at all** in `docs/preprod-candidates.md`
**When** this story closes
**Then** `docs/preprod-candidates.md` carries a second append-only table headed **"Rejected
candidates"** with the columns `Date (UTC) | Candidate tag | Digest | Verdict | Note | Recorder run
id (refusal)`, written by hand exactly as the pass rows already are
**And** the same append-only, never-reinterpreted rule is stated for it
**And** if this story's own verdict is `fail`, its own candidate is the first row in it
**And** the `deferred-work.md` entry is closed **under the original entry**, with the old text struck
rather than deleted.

### AC12 — 🔴 ADDED: validation history is ordered by `git log`, not by the registry *(discharges the second `deferred-work.md` item owned by Story 5.6)*

**Given** Story 5.4's AC5 claimed the `preprod-<sha>` sequence reconstructs the validation history
**When** that claim is tested
**Then** the set is enumerated from the registry (`GET /v2/crm/fe-prionex/tags/list`, filtered to
`^preprod-[0-9a-f]{12}$`), each marker is mapped back to its commit, and the **order** is produced by
a single `git log` call over those commits
**And** the write-up states plainly that **`tags/list` orders nothing** and that the order comes from
git
**And** the composed, ordered history is pasted.

### AC13 — 🔴 ADDED: every claim is backed by a run id and a state read, and every unearned claim is named *(retro-E5)*

**Given** this story makes claims about guards, timings and registry state
**When** the write-up is produced
**Then** each claim cites a run id **and** an `action_task_step.status` or a registry/stand read —
never a log line alone, because job logs on this instance frequently never archive
**And** every check that **could not have failed** is named as such rather than counted: at minimum
G6's three identity clauses on a `build.yml` artifact (5.4's M1), and the `P + D + F + B == 12`
invariant, which catches arithmetic and never misclassification
**And** each of the four dispositions — `UNPROVEN`, `OPEN`, `PENDING (owner: <name>)`, or not claimed
— is used literally, with no fifth, softer word.

🔴 **A free, first-of-its-kind observation this rehearsal can make and should not waste.** Whether
`$GITHUB_STEP_SUMMARY` persists at all on this instance has been **unverified since Story 5.4**, and
the `e2e` placeholder added by 5.5 writes to it. **R2 is the first dispatch that could answer it.**
Check for the summary after R2 and record the answer either way — it costs nothing and closes a
standing unknown. Related standing obligation, also cheap: re-run
`select id, log_in_storage from action_task where id in (9745, 9769);` before other psql work; if
either is now `t`, read the log via `docker exec forgejo cat … | unzstd -c` and paste the literal
text into `deferred-work.md` finding 8's closure note.

---

## Tasks / Subtasks

### Task 1 — Open the story (AC: all) — **costs 1 push row**

- [ ] 1.1 Flip `sprint-status.yaml`'s `5-6-exercise-the-full-release-cycle-on-an-empty-release` from
      `ready-for-dev` to `in-progress` and **push that commit on its own, first**. This is the one
      falsifiable checkbox in the whole story — Story 5.2's **H1** found it checked `[x]` while
      `git log -p` proved `in-progress` was never written. Do not batch it.
- [ ] 1.2 Confirm the gate: `5-5-establish-the-release-validation-checklist` reads **`done`**.
      ✅ **Satisfied at story-writing time** — PR #85 merged as `a99ccd44` while this context was
      being written, flipping 5.5 to `done` and amending `RVC-v1`'s executability lines in place.
      Stories 5.1-5.5 are all `done`, so the epic's AC1 (*"Given all preceding Epic 5 stories are
      complete"*) holds. Re-confirm rather than assume; if anything reopens 5.5, **HALT and say so**.
- [ ] 1.3 Rebase this branch onto fresh `origin/main` and re-read `docs/release-validation-checklist.md`
      **from the rebased tree**, not from memory. This context was already rebased once, from
      `0b4fdd99` to `a99ccd44`, when PR #85 merged mid-session — and that merge amended nine of
      `RVC-v1`'s executability lines in place. **The marker, the aggregation rule and the note format
      were unchanged by it, so §3's determination survived**; a future amendment might not be so
      kind. Re-read before quoting.
- [ ] 1.4 🔴 **Send the F9 ask on day one — this is the longest-lead item in the story.** Ask Oleg,
      via the coordinator, for: **an account on PRE-PROD whose role lacks at least one dashboard
      route's permission, plus its credentials**, and for the normal operator credentials `RVC-v1`
      also requires. State plainly that without it F9 is `BLOCKED`, the aggregate is `fail`, and the
      registry write leg cannot run (§3). Mark `PENDING (owner: Oleg)`; do not block Task 2 on it.
- [ ] 1.5 Declare the run ledger (§11) **before any dispatch**, with the baseline from
      `select max(id), count(*), now() at time zone 'utc' from action_run where repo_id=16;`.
      Mark the query `PENDING (owner: coordinator)` if the dev agent has no psql channel.
- [ ] 1.6 Record the next free `D` number, verified with `git fetch --all` and a `git grep` for
      `^## D[0-9]` across **every** ref, not just `main` — `D35` is held by Story 4.9 on an unmerged
      branch and *"there is a `D23` collision in this project's history precisely because someone did
      not"* check. Needed only if Path B is taken.

### Task 2 — 🔴 Fixture readiness, and the two decisions that gate everything (AC: 5) — **costs 0 runs**

**The highest-value task in this story.** `RVC-v1` forbids partial runs, so a fixture discovered
missing at F7 costs the entire session and, under AC9, a rebuild.

- [ ] 2.1 Build the fixture matrix: one row per item F1…F12, columns `what it needs` / `does it
      exist on PRE-PROD` / `who confirms` / `verdict if absent`. Populate F4's row with all four of
      its separately-provisioned accounts (2FA-enabled, locked, IP-whitelist-refused,
      forced-password-change) — F4 has **no degraded wording**, so a missing fixture makes the whole
      item `BLOCKED`, not partially passed.
- [ ] 2.2 Take the matrix to Oleg through the coordinator, in one message, and get one answer per
      row. Everything absent becomes `BLOCKED` with **Oleg**, or whoever genuinely owns it, named —
      never a trigger condition (Prohibition 19).
- [ ] 2.3 🚨 Get the side-effect confirmations in writing (Prohibition 8): is telephony (F7),
      SMS/messaging (F10) and EasyPay (F12) in a **non-production mode** on PRE-PROD? An unanswered
      row is `BLOCKED` with a real owner — which is legal and honest — not an item executed anyway.
- [ ] 2.4 Route F2 criterion 5's repository-variable read to the coordinator:
      `vars.VITE_OPERATOR_PHONE_URL_PREPROD`. The decided value for preprod is **EMPTY** (Oleg,
      2026-08-17), so the expected observation is no `phone.` URL in the bundle and no
      operator-phone panel in the UI. `RVC-v1`: *"check the variable, do not guess"* — and if the
      read is unavailable, F2 is `BLOCKED — owner: whoever grants repository-settings read access`,
      because F2 carries no degraded wording either. Mark `PENDING (owner: coordinator)`.
- [ ] 2.5 **Compute the reachable ceiling from the matrix and write it down before anything is
      dispatched**, exactly as `retro-E5` requires discriminators to be named before they run: how
      many full passes are reachable, which items are `BLOCKED` and by whom, and therefore which of
      §3.2's paths this rehearsal is on. **If the ceiling is below 12, do not "see how it goes" —
      escalate the path decision to Oleg now**, while it is still free.
- [ ] 2.6 Schedule the validation session against the no-touch window: no dispatch and no live lock
      holder across **01:45–02:30 UTC**, next tick **2026-08-30**.

### Task 3 — Zero-dispatch preconditions (AC: 1, 2, 3, 4) — **costs 0 runs**

- [ ] 3.1 Choose the candidate commit and record it in full and as 12 hex. Prefer `main` HEAD at
      rehearsal time; if `main` moves during the story, **pin the sha and use it everywhere** — the
      note, the dispatch and the Execution Log must all name the same artifact, and nothing checks
      that they do.
- [ ] 3.2 Confirm the candidate commit has **never been recorded**: `preprod-<12hex>` must not exist
      in `tags/list`. If it does, choose a different commit — §8's dead end is reachable from here
      and its only exit is Oleg deleting a package version by hand.
- [ ] 3.3 Execute AC2's diff **and its negative control**; paste both verbatim.
- [ ] 3.4 Assert the compose coupling: `git diff origin/main -- docker-compose.stand.yml` empty, and
      `sha256sum docker-compose.stand.yml` == `7f449dacce163fed898b06d3d3d204656b0f485fdbad1827c03c7aac9b1932ec`.
- [ ] 3.5 Read the pre-rehearsal registry state and paste it: the digests behind `preprod-current`,
      `preprod-00ef3be4743d`, `preprod-28f7fd36b75e`, and the current `sha-*-preprod` set. This is
      the **before** half of AC7's read-back; without it "nothing was written" is unfalsifiable.
- [ ] 3.6 **The free rejection rows** (`retro-E5`, and they are free so they are not optional): the
      coordinator dispatches `deploy-preprod.yml` with `image_tag` **omitted**, and
      `record-preprod-candidate.yml` with `validated` **omitted**. Both must return **HTTP 400 with
      zero `action_run` rows created** — confirmed by `max(id)` being unchanged around each call.
      Mark `PENDING (owner: coordinator)`.
- [ ] 3.7 Re-run `select id, log_in_storage from action_task where id in (9745, 9769);` (AC13's
      standing obligation) and record the answer before other psql work.

### Task 4 — R1: mint the candidate (AC: 3) — **1 run**

- [ ] 4.1 Coordinator dispatches `build.yml` with `ref: <candidate commit>`, `environment: preprod`.
      Mark `PENDING (owner: coordinator)` until the run id comes back.
- [ ] 4.2 Record the run id, and **`started` and `stopped` from `action_run`**. `started` is the
      reference instant for P2 and F2 c4 — not the image's `created` time.
- [ ] 4.3 Read the new tag back from the registry: digest, and
      `imagetools inspect --format '{{json .Image}}'` labels. **Label the label read as a consistency
      check, not an independent one** — 5.4's M1: all three of G6's clauses are identities here.
- [ ] 4.4 Assert the tag shape is exactly `sha-<12 hex>-preprod`. G3 requires **exactly 12**; a
      length mismatch fails every legitimate release and would be discovered at R3 otherwise.

### Task 5 — R2: put the candidate on the stand (AC: 4) — **1 run**

- [ ] 5.1 Coordinator dispatches `deploy-preprod.yml` with `image_tag: sha-<12hex>-preprod` and
      nothing else. `PENDING (owner: coordinator)`.
- [ ] 5.2 Record run id, `started`/`stopped`, and any `waiting` time on the
      `deploy-preprod-fe-prionex-preprod` group separately (run 1229 spent ~60 s there; that is not
      a hang).
- [ ] 5.3 Read `action_task_step.status` for both jobs. Confirm `deploy` succeeded and the `e2e`
      placeholder **ran, printed and exited 0 without gating**. Match step names on a **stable
      prefix, never the full string** — 4.8's refactor stripped every `(Task N)` suffix.
- [ ] 5.4 🔴 **Check whether `$GITHUB_STEP_SUMMARY` persisted** (AC13). This is the first dispatch
      since 5.5 added the writer. Record the answer either way; it closes a standing unknown for free.
- [ ] 5.5 Confirm from the stand that the running image's `.RepoDigests` contains the candidate
      digest. Container `.Image` → `docker image inspect <id> --format '{{range .RepoDigests}}{{.}} {{end}}'`.
      🔴 A container has no `.RepoDigests`; a bare `{{.RepoDigests}}` renders `[]` for an empty slice,
      which is non-empty. Both are recorded defects.

### Task 6 — Execute `RVC-v1`, once, end to end (AC: 5) — **0 runs, and the story's longest leg**

- [ ] 6.1 **P1, by hand, at the start.** Container health `healthy` **and** running-image
      `.RepoDigests` contains the digest `image_tag` resolves to, both true **at this moment**. Record
      the UTC minute — it becomes the Execution Log section's heading and its `Started (UTC)`.
      **If P1 fails: stop. Do not execute F1-F12.** Use the precondition-failure note shape and the
      short template.
- [ ] 6.2 **P2.** Hard reload, fetch the served `assets/index-*.js`, extract the single quoted
      13-digit integer, decode as ms epoch, require **at or after R1's `started`**. §2 shows the
      commands and a worked current value.
- [ ] 6.3 **F1**, joint: dev agent `curl`s every asset referenced by `index.html` for `200` plus
      `ssl_verify_result=0`; Oleg confirms padlock, no interstitial, login screen renders, and no
      uncaught console error outside the exempted `api.crm.preprod.crm-prionex.online` family.
- [ ] 6.4 **F2**, dev agent, all five criteria, per-asset `grep -cF`. 🔴 **Do not fail c1 because the
      count is not "3 files"** — that parenthetical was measured from a local `npx vite build` and the
      served bundle has it in one file (§2). The criterion is presence. Record the observed count as
      evidence. c5 uses Task 2.4's variable read.
- [ ] 6.5 **F3 through F12**, executed by Oleg in a browser, transcribed verbatim by the dev agent,
      with **his** name in `Executed by:`. Each item gets exactly one of the four verdicts. Every
      `pass (degraded)` carries the exact words its item's text requires; every `BLOCKED` names a real
      owner. **F9: do not record `fail` for `/dashboard/profile` alone** — that route is deliberately
      unwrapped (`src/routes/index.tsx:275-278`) and is pre-existing behaviour, filed as Oleg's own
      deferred item.
- [ ] 6.6 If the session cannot be completed in one pass, **stop and re-run from the start.** Do not
      write a partial note — `RVC-v1` gives a partial run no legal note at all.
- [ ] 6.7 Append the Execution Log section using the file's own template, heading
      `### <image_tag> — <YYYY-MM-DDTHH:MMZ>`. **Append only. Change nothing else in that file.**

### Task 7 — Derive the verdict and compose the note (AC: 6) — **0 runs**

- [ ] 7.1 Count `P`, `D`, `F`, `B` from the Execution Log. Check `P + D + F + B == 12` — and record
      that this check catches arithmetic only, never misclassification.
- [ ] 7.2 **Derive** the aggregate: `pass` **iff** `P == 12`. Otherwise `fail`. Do not reason about
      whether the blocked item "mattered".
- [ ] 7.3 Compose the note in `RVC-v1`'s exact format. Verify by inspection: no `|`, no newline, the
      dispatched tag named, `<B>`'s two parentheticals kept separate, each distinct `(cause, owner)`
      pair listed, empty clauses dropped by their exact literal.
- [ ] 7.4 **Second-reader check.** Nothing in the machinery validates any of §7.3, so a second read
      of the note against the Execution Log is the only control that exists. Record who did it.
- [ ] 7.5 Route to the path (§3.2). On `P == 12` → Path A. On `P < 12` → escalate to Oleg with the
      note and the Execution Log attached and ask for one of two answers: **Path B** (authorise the
      documented, time-boxed waiver; a new `D` record is written first) or **Path C** (proceed with
      the honest `fail`). **Do not proceed to Task 8 without an answer.** Mark `PENDING (owner: Oleg)`.

### Task 8 — R3: dispatch the recorder, once (AC: 7, 11) — **1 run**

- [ ] 8.1 Coordinator dispatches `record-preprod-candidate.yml` with the pinned `image_tag`, the
      derived (or waiver-authorised) `validated`, the composed `validation_note`, and
      `allow_backwards_move: false`. **Exactly one dispatch for this candidate commit, ever** (§8).
- [ ] 8.2 **On `pass`:** read both markers back with an independent `imagetools inspect` on s1 — not
      from the run's own success message (`build.yml:1542-1554` is why: a bare `echo "OK"` claimed
      success for weeks while writing the wrong thing). Confirm `preprod-<12hex>` and `preprod-current`
      both resolve to the candidate digest. Then append the row the run's last step printed to
      `docs/preprod-candidates.md`, verbatim. **Recording is the two steps together, not the dispatch
      alone.**
- [ ] 8.3 **On `fail`:** confirm G1 refused as the **first step of the first job**, from
      `action_task_step.status`. Then read back and paste: `preprod-<12hex>` **does not exist**, and
      `preprod-current` still resolves to the digest Task 3.5 recorded. "Nothing was written" is a
      measurement, not an assumption.
- [ ] 8.4 Add the **"Rejected candidates"** table to `docs/preprod-candidates.md` (AC11), with its
      own append-only statement, and write this candidate's row into it if the verdict was `fail`.
- [ ] 8.5 Record the run id, the deciding step name and its status, and `started`/`stopped`.

### Task 9 — Elapsed time, history order, and the regulation (AC: 8, 10, 12) — **0 runs**

- [ ] 9.1 Produce the split elapsed-time table (AC8) from `action_run.started`/`stopped` — **never
      from a relayed figure**; Story 5.1's backfill found a run relayed as "~70 s" that measured 49 s.
      State the machine total and the human total as two separate figures, and report `waiting` time
      separately from execution.
- [ ] 9.2 Compose the ordered validation history (AC12): enumerate `^preprod-[0-9a-f]{12}$` from
      `tags/list`, map each to its commit, order with one `git log` call, paste the result, and state
      plainly that `tags/list` orders nothing.
- [ ] 9.3 Write `docs/release-regulation.md` (AC10): the five legs of §5 with their workflow names;
      the scope-freeze clause with all four of §9's points, **including G5's honest hole**; pointers
      to `RVC-v1` and `docs/preprod-candidates.md`. One page. No new gate.

### Task 10 — Route, record, decide (AC: 9, 13) — **0 runs**

- [ ] 10.1 If Path B was taken, write the decision record in `docs/migration-decisions.md` under the
      `D` number from Task 1.6: the candidate tag, each waived item and its owner, the expiry date,
      and that it governs this one candidate only. **Never rewrite an existing D body** — amendments
      are dated appended blocks.
- [ ] 10.2 Close the AC11 and AC12 `deferred-work.md` entries **under their originals**, old text
      struck (`~~…~~`), never deleted.
- [ ] 10.3 **Re-own M7's eight unexercised recorder branches** (§10(c)) to **Story 6.4**, under the
      original entry. The entry itself makes this a required closeout action if this story does not
      force them, and this story deliberately does not.
- [ ] 10.4 Re-state, do not close: the no-op-redeploy gap (AC4's caveat), 5.4's **H3** digest-comparison
      residual (AC7's caveat), and the `RVC-v1` F2 c1 "3 files" discrepancy (§2) — the last as a note
      for whoever writes `RVC-v2`, **not** as an edit to `RVC-v1`.
- [ ] 10.5 Name every unearned claim explicitly (AC13), using only the four dispositions.

### Task 11 — Close (AC: all) — **PR-open + review + fix-pass + merge rows**

- [ ] 11.1 Write the Dev Agent Record: files touched, dispatches with run ids, decisions taken, and
      every `PENDING (owner: …)` still outstanding.
- [ ] 11.2 Close the run ledger **against a query re-run after the merge commit lands**, attributed
      per retro-D4's parallel-era method (filter by `repo_id=16`; match each row's `commit_sha`
      against this story's own commits **and** against any concurrently-active sibling story's branch
      tips, fetched fresh; a row matching neither is **named as unattributed**, never folded in). If
      the query cannot be run, close it with the literal word **OPEN**.
      `PENDING (owner: coordinator)`.
- [ ] 11.3 Flip `sprint-status.yaml` to `review`. 🔴 **If the story halted on a `PENDING (owner: Oleg)`
      answer that never arrived, the row STAYS `in-progress` with the blocking condition named in the
      comment immediately above it** — the enum has no `blocked` value, and an `in-progress` row with
      no stated reason is exactly the invisibility Task 1.1 exists to prevent.
- [ ] 11.4 Push. **Do not open the PR** — Prohibition 13.

---

## Dev Notes

### 1. The one-paragraph version

Build `main`'s current commit as a `preprod` image, deploy it with `deploy-preprod.yml`, execute
`RVC-v1` by hand, derive the verdict from what the twelve items actually did, dispatch the recorder
with that verdict, and write down how long the whole thing took. The release is empty because
`main` has not touched `src/` since the last recorded candidate — measured, not arranged. The one
thing that can go wrong that no previous story has faced is that **the verdict may honestly be
`fail`**, and if it is, the recorder writes nothing and the epic's second AC cannot be met. §3 is
the whole decision; read it twice.

### 2. Infrastructure facts, in one place

| Thing | Value |
|---|---|
| s1 SSH | `root@10.67.0.1` (`s1.private.crm-prionex.com`). External `185.185.49.127:22` times out **by `ufw` design** — not an outage |
| Stand dir | `/root/crm-prionex/fe-prionex-preprod/` (0700), compose `docker-compose.stand.yml` sha256 `7f449dacce163fed898b06d3d3d204656b0f485fdbad1827c03c7aac9b1932ec` |
| Container / compose project | both `fe-prionex-preprod`; `FRONTEND_PORT=127.0.0.1:8083`; network `crm-preprod-network` (69 containers, `external: true`, owned by `CRM/api-prionex`) |
| Frontend | `https://crm.preprod.crm-prionex.online` (LE cert expires 2026-11-21) |
| API | `https://api.crm.preprod.crm-prionex.online` — note the extra `.crm.`; the short forms are NXDOMAIN |
| Registry | `git.crm-prionex.com/crm/fe-prionex`; tags: `GET /v2/crm/fe-prionex/tags/list` |
| Runner labels | deploy + recorder-verify: `deploy-dev-preprod` (id 14, **capacity 1**, shared with DEV and 4.9); recorder `record` job and CI: `node-20` |
| Concurrency group | `deploy-preprod-fe-prionex-preprod`, a **literal**, shared deliberately by `deploy-preprod.yml` and the recorder |
| Lock | `<stand_dir>/.deploy.lock` via a detached sibling container; `lock_wait 240s`, `lock_ttl 720s`, `health_timeout 120s` |
| `preprod-current` at story-writing time | `sha256:d2f6aefc780d6684bd86418298d4068131b7442bf93c3f17de965f40c82f6f26` = `sha-28f7fd36b75e-preprod`, commit `28f7fd36b75e` |
| Ledger query | `select max(id), count(*), now() at time zone 'utc' from action_run where repo_id=16;` — **`repo_id=16` is `CRM/fe-prionex`** |

⚠️ **The container image is `nginx:alpine` — there is no `curl` inside it.** Use `wget`. And
`127.0.0.1:8083` is unreachable from inside a container; `deploy-stand.yml` routes such reads through
a `--network host` sibling.

⚠️ **Health `healthy` says nothing about the backend.** The healthcheck probes
`http://127.0.0.1:80` — *itself* — and `nginx.conf` resolves Kong lazily, so nginx starts happily
with no Kong at all. Story 5.2 demonstrated this live: the same image on a network where
`crm-kong-gateway` does not resolve settled to `(healthy)` in 45 seconds. **Never report `healthy`
as evidence about the API.** That was 5.2's **M6**.

### 3. Anti-patterns for this story

- ❌ **Typing `pass` because the blocked item "doesn't really matter".** §3, Prohibition 1. The whole
  value of `RVC-v1` is that the verdict is derived; an operator's judgement re-entering at the last
  step deletes it.
- ❌ **Recording an item the agent did not observe.** Prohibition 2. A CLI agent has no browser.
- ❌ **Half-running the checklist and writing a note anyway.** Prohibition 3. A partial run has no
  legal note. This is the single most likely failure mode of a long browser session.
- ❌ **Reading a verdict from a job log.** Logs on this instance frequently never archive
  (`log_in_storage='f'`, six observations across six sessions). Use `action_task_step.status` and
  registry/stand state.
- ❌ **Reporting a relayed duration.** Read `started`/`stopped` from `action_run`. A run once relayed
  as "~70 s" measured 49 s.
- ❌ **Failing F2 c1 because the string occurs in one file rather than three.** §2. The criterion is
  presence; the "3 files" is a parenthetical from a different build.
- ❌ **Rebuilding an already-recorded commit.** §8. The repoint guard refuses and the only exit is a
  manual `DELETE` by Oleg.
- ❌ **"Fixing" the checklist while executing it.** Changing an item's text, id or criterion is
  `RVC-v2` and a separate decision. Prohibition 5.
- ❌ **Claiming G6 as an independent check.** All three of its clauses are identities for a
  `build.yml` artifact (5.4's M1).
- ❌ **Treating a queued job as a hung one.** The deploy runner has capacity 1 and is shared with
  Story 4.9; the concurrency group makes a recorder dispatched behind a deploy go `waiting`
  (~60 s on run 1229). Neither is a fault. And on this instance a `blocked` `action_run` is the
  **concurrency group**, not the flock (5.3's M7).

### 4. Previous story intelligence — what Epic 5 has already paid for

- **Story 5.1** — the contour was proved isolated by live network identity, not by reading compose.
  It also contributed the parallel-era ledger-attribution method this story reuses verbatim rather
  than re-deriving, and the rule that discriminators are **named before they run**.
- **Story 5.2** — built the vhost and certificate; and leaked **two unrevocable registry tokens in
  one session**, which is where Prohibition 11 comes from. Its **H1** is why Task 1.1 is a standalone
  push.
- **Story 5.3** — the canonical first-execution story. `image_tag` mode had **zero** execution
  history; dispatch 1 went green, and dispatches 2 and 3 then found two real defects that could not
  have been found any other way — the second only becoming visible once the first was fixed. Its
  worst methodology failure is the one to internalise: **a local force-test had already caught defect
  #2, and it was misdiagnosed as a transcription artifact and "fixed" out of the harness**, leaving
  the real bug live to be found in production by run 1190. Also **DN1**, the biggest finding in the
  epic: without the tag↔environment guard, a `-dev` tag deployed onto PRE-PROD **fully green** and
  5.4 would have recorded it as validated.
- **Story 5.4** — built the recorder and its six guards. **H1** is the one to remember: G5 **failed
  open** because `grep -qF` with an empty needle matches anything, and it was found by a reviewer
  replaying the step locally, not by any dispatch. Its **D3** is §8's trap. Its **H3** — the two
  independently-resolved digests are never compared — is a live residual in this rehearsal.
- **Story 5.5** — published `RVC-v1`, and deliberately did **not** execute it. It named this exact
  collision, put Oleg's name on it, and left the first Execution Log section for this story.

**The lesson all five share, and the reason §11's reserve is two full cycles rather than one:** a
path that has never executed is not a path that works. **The browser path of this application has
never once been validated against PRE-PROD** — not by any story, not by anyone. F3-F12 are running
for the first time in the project's history. Expect defects, and do not read the first red round as
this story failing.

### 5. Ledger attribution in the parallel era — cite 5.1's closeout, do not re-derive it

*"'Everything above baseline is this story's' — every prior ledger's assumption — is false here."*
Use the three-step method (§11, Task 11.2). Story 5.1 named rows 1165/1166 as Story 4.9's; Story 5.2
named row 1176 as `PRIONEX_HUB`'s own scheduled run. Inherited caveat, still open:
`max(id) == count(*)` is **not** a hidden-run proof, and the instance-wide query has no `repo_id`
filter — use the filtered form, and if you also run the unfiltered one, say which is which.

### 6. Non-goals — absences that are decisions, not omissions

- **No workflow code is written.** Not even the `e2e` job. §13.
- **No new gate.** `RVC-v1` makes the verdict derived, not enforced, and NFR9 says plainly that
  anyone with write access can dispatch the recorder. Overstating that would be the same vacuity
  this project has rejected three times.
- **No `RVC-v2`.**
- **No DEV involvement.** The DEV frontend vhost is still broken (measured this session), and no AC
  here depends on DEV.
- **M7's eight recorder branches are routed, not forced** — §10(c).

### 7. Things pending on Oleg — do not depend on them silently

| Item | Status | Effect on this story |
|---|---|---|
| **A restricted-role account on PRE-PROD** | **OPEN**, owner Oleg | **The single highest-value unblock.** Without it F9 is `BLOCKED`, the aggregate is `fail`, and the registry-write leg does not run. Task 1.4 asks on day one. |
| **The `RVC-v1` / 5.6 verdict collision** | **OPEN**, owner Oleg; `RVC-v1` and D39 §6 both name him | §3.2's path decision. Task 7.5 escalates with the note and log attached. |
| Fixture / sandbox-mode confirmations for F4, F7, F10, F12 | **OPEN**, owner Oleg | Task 2. Each unanswered row is a legal `BLOCKED` and lowers the reachable ceiling. |
| Transcript scrubbing for two unrevocable registry tokens | **OPEN**, owner Oleg | Not this story's. Prohibition 11 exists so it does not become a third. |
| The DEV frontend vhost (wrong-tenant cert) | **OPEN**, Story 4.9 / `aleksey` | Irrelevant to PRE-PROD. **No AC may depend on it.** |
| Job logs that never archive (`log_in_storage='f'`) | **OPEN**, no owner | Shapes AC13's evidence rules. Task 3.7 re-checks the two known task ids for free. |
| `epics.md` freeze-or-catch-up | **OPEN**, owner Oleg | This story does **not** edit `epics.md`. Where the epic's literal text and the decision records disagree, the decision records and story files win — that convention is already stated in `epic-5-context.md`. |
| 📅 **DUE 2026-08-29** retention observation | **OPEN, unowned** | The rehearsal's own tags are protected by shape. If the story spans that date, **read** the outcome rather than assuming it. |

### 8. Conventions that bind this story

- **retro-E5 / retro-D4 always carry the `retro-` prefix.** Two numbering schemes collide:
  `docs/migration-decisions.md`'s `D4` is stand parameterization and there is **no `E5`** in that
  series. Write the prefix every time.
- **Prohibition numbers are per-story and collide across stories.** `deferred-work.md`'s own header
  says so. **Cite a rule by its text, not by its number.**
- **`deferred-work.md`:** append new entries at EOF; **closures go under the original** with the old
  text struck (`~~…~~`), never deleted; **owners are names or story numbers, never trigger
  conditions.**
- **`docs/migration-decisions.md`:** decision bodies are never rewritten; amendments are dated,
  appended blocks. Verify the next free `D` against **every** ref (Task 1.6).
- **Cite by search string, not line number, inside workflow comments.** Line numbers in this repo rot
  within the same commit range that ships them (5.4's M11).
- **Label every number measured, not computed.** Arithmetic on top of direct reads is arithmetic and
  must say so.
- **NFR5:** the DEV and legacy stands stay operational and untouched. Legacy DEV is on a different
  machine (`72.62.17.132`) and is **never contacted** — say so; do not pretend to have checked it.

### 9. The autonomous decisions in this story, in one place (for a one-read veto)

Every row was decided by the story author without asking, is defensible on the evidence cited, and
is **subject to Oleg's veto**.

| # | Decision | Why | If vetoed |
|---|---|---|---|
| 1 | **An 11-of-12 run produces the aggregate verdict `fail`, not `pass (degraded)`.** There is no aggregate `pass (degraded)`; `RVC-v1`'s rule and the recorder's two-option `choice` both forbid it. | §3.1, quoting `RVC-v1` twice | Only a checklist revision (`RVC-v2`) can change it — a separate story. |
| 2 | **Path A (get the restricted-role account) is the default; Path B (documented, time-boxed waiver) needs Oleg's written go-ahead before the dispatch; Path C (honest `fail`) is the floor and the story is completable on it.** | §3.2. `RVC-v1` names exactly these exits and names Oleg as the owner. | Name the branch you want and the story takes it. |
| 3 | **The registry-write leg being unexercised on Path C is an acceptable cost**, because Story 5.4 already exercised it for real twice (runs 1215/1229); what has never been exercised is the *continuity*, and every path exercises that. | §3.2 | Then the story blocks on Path A/B rather than closing. |
| 4 | **The empty release is `main`'s existing commit, not a fabricated no-op.** Measured: 34 commits since the last candidate, zero bytes of `src/` or any build input. | §4 | A synthetic no-op commit works too; the ACs are unchanged. |
| 5 | **Oleg executes F3-F12; the dev agent executes P1, P2 and F2 mechanically and transcribes the rest.** | §6. The agent has no browser and no credentials. | Name a different executor; the Execution Log's `Executed by:` follows. |
| 6 | **A fixture-readiness pass runs before the build and computes the reachable ceiling in advance.** | §7. `RVC-v1` forbids partial runs, so a late discovery costs the whole session plus a rebuild under AC9. | Skip it and accept the risk of a wasted session. |
| 7 | **Items with irreversible external side effects (F7 call, F10 SMS, F12 payment) are not executed without written confirmation of a non-production mode**, and are `BLOCKED` with a real owner otherwise. | §7. PRE-PROD's backend is a live, shared, 69-container environment belonging to another team. | Confirm sandbox mode and they execute. |
| 8 | **This story creates `docs/release-regulation.md`** rather than editing `docs/forgejo-migration.md` or waiting for Epic 7. | §9. Epic AC4 requires a regulation; none exists; the file is additive and touches nothing frozen. | Point at a different home and the content moves. |
| 9 | **A rejected candidate gets a second append-only table in `docs/preprod-candidates.md`**, not a new file. | §10(a). One file, so a reader asking "what happened to candidate X" needs to open only one. | Name a different sink. |
| 10 | **M7's eight unexercised recorder branches are re-owned to Story 6.4, not forced here.** | §10(c). The entry itself says naming an owner does not manufacture a requirement, and forcing them would cost ~8 dispatches on top of AC3's repeat reserve. | Force them and raise the ceiling accordingly. |
| 11 | **The declared ceiling is 17, with two full repeat reserves rather than one.** | §11. The browser path has never executed once; §4 names four prior stories' red-round histories. | Cut it to one reserve and accept a renegotiation mid-story. |
| 12 | **The `RVC-v1` F2 c1 "3 files" discrepancy is recorded as evidence for a future `RVC-v2`, not fixed in place.** | §2, §13. Changing a criterion bumps the marker. | Authorise an `RVC-v2` pass and it becomes a separate story. |

### Project Structure Notes

**Files this story creates:**
- `docs/release-regulation.md` — new, one page (AC10).

**Files this story appends to (append-only, never rewritten):**
- `docs/release-validation-checklist.md` — **one** new Execution Log section, and nothing else (AC5).
- `docs/preprod-candidates.md` — the "Rejected candidates" table (AC11), plus one row in whichever
  table the verdict dictates (AC7).
- `_bmad-output/implementation-artifacts/deferred-work.md` — closures under their originals; the
  re-owning of M7 (Tasks 10.2, 10.3).
- `docs/migration-decisions.md` — a new `D` record, **only if** Path B is taken (Task 10.1).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status transitions only.
- `_bmad-output/implementation-artifacts/5-6-exercise-the-full-release-cycle-on-an-empty-release.md`
  — this file's own Dev Agent Record.

**Files this story reads and must not modify:** every `.forgejo/workflows/*.yml`, `docker-compose.stand.yml`,
`nginx.conf`, `Dockerfile.prod`, `README.md`, `epics.md`, and anything belonging to Story 4.9. §12.

**Working location:** a scratchpad worktree off fresh `origin/main`. The primary checkout belongs to
Story 4.9's dev agent. Rebase when PR #85 merges.

### References

- `_bmad-output/planning-artifacts/epics.md` — Epic 5 preamble and Story 5.6's four ACs; NFR5, NFR9.
- `_bmad-output/implementation-artifacts/epic-5-context.md` — the epic's requirements and cross-story
  dependencies, including 5.6's own line.
- `docs/release-validation-checklist.md` — `RVC-v1`: P1/P2, F1-F12, the four item verdicts, the
  aggregation rule, the `validation_note` format and its four shapes, the `P + D + F + B == 12`
  invariant, the CORS-blocker section and its "two consequences", the Execution Log and its templates.
- `docs/preprod-candidates.md` — the ledger, its two pre-`RVC-v1` rows, and the two-step recording
  procedure.
- `docs/migration-decisions.md` — **D24** (repoint refused; recovery is a manual `DELETE`), **D33**
  (the shared callee; a callee's own `concurrency` is void), **D34/D36** (the CORS measurement),
  **D37** (`deploy-preprod.yml`, the tag↔environment guard, the §12 precedent), **D38** (the
  recorder's contract, the six guards, the exact SHA derivation), **D39** (`RVC-v1` itself, the note
  format, the collision and its two exits). **D35 is absent from `main` by design** — Story 4.9 holds
  it on an unmerged branch.
- `_bmad-output/implementation-artifacts/deferred-work.md` — the three items owned by Story 5.6
  (rejected-candidate sink; `git log` ordering; M7's eight branches), the CORS entry, the PRE-PROD
  lock-holder debris, the `dev-reset.yml` image-sweep hazard, and the 📅 **DUE 2026-08-29** obligation.
- `_bmad-output/implementation-artifacts/5-3-…md` §12 — the priced-exception procedure, verbatim.
- `_bmad-output/implementation-artifacts/5-4-…md` — the six guards, AC8's repoint refusal, H1 (G5
  fail-open), H3 (the uncompared digests), M1 (G6's identities), D3 (non-reproducible builds).
- `_bmad-output/implementation-artifacts/epic-3-retro-2026-08-18.md:77-78` — **retro-D4** and
  **retro-E5**, verbatim.
- `.forgejo/workflows/build.yml`, `deploy-preprod.yml`, `record-preprod-candidate.yml`,
  `deploy-stand.yml` — read-only; the identifiers in §5 were verified against them.

---

## Dev Agent Record

### Agent Model Used

_(dev-story: Sonnet, per the standing model split — create-story Opus, dev-story Sonnet, code-review Opus.)_

### Debug Log References

### Completion Notes List

### File List

---

## Open Questions for Review

1. **The verdict path (§3.2) — Oleg's, and it is the one blocking question.** With the CORS origin
   fixed and F9 still blocked on a restricted-role account, `RVC-v1` produces `fail` and the recorder
   writes nothing. Path A (provision the account), Path B (authorise a documented, time-boxed waiver
   for this one candidate), or Path C (record the honest `fail` and close with epic AC2 unmet and
   routed)? Task 7.5 escalates with the Execution Log and the composed note attached, so the decision
   is made against real counts rather than a hypothetical.
2. **Fixture and sandbox-mode confirmations (§7).** Four items may be blocked for reasons that have
   nothing to do with CORS, and one of them (F4) needs four separately-configured accounts. Task 2
   asks for all of it in one message, before anything is dispatched.
3. **Is `docs/release-regulation.md` the right home for the scope-freeze clause**, or should it wait
   for Epic 7's Deployment Process document? Veto row 8.
4. **Should M7's eight recorder branches be forced here after all?** Veto row 10 routes them to
   Story 6.4; forcing them would cost roughly eight dispatches on top of the repeat reserve.

## Change Log

| Date | Change |
|---|---|
| 2026-08-25 | Rebased onto `origin/main` at `a99ccd44` after Story 5.5's closeout (PR #85) merged mid-session. Its independent CORS re-measurement — a fourth channel — agrees with this story's own: eleven of twelve items executable, F9 alone `BLOCKED`, and now on **one** owner (Oleg) rather than two. `RVC-v1`'s marker, aggregation rule and note format are unchanged by that merge, so §3's determination stands verbatim; F9's owner-pair and Path B's quote were rebound to the amended text. |
| 2026-08-25 | Story created. Context bound against `origin/main` at `0b4fdd99`. CORS fix independently re-verified from this session with a foreign-origin control on both Kongs; the PRE-PROD bundle and every served asset measured directly, correcting `RVC-v1` F2 c1's "3 files" parenthetical and supplying c4's previously-unstated match count. The empty release established by measurement on `main` rather than fabricated. §3 decides the verdict question that `RVC-v1` left to Story 5.6. |
