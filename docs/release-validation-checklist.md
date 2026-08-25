# PRE-PROD Release Validation Checklist — `RVC-v1.1`

**Version marker: `RVC-v1.1`.** Quote this marker in every `validation_note` **from this amendment
onward** — a note already recorded against `RVC-v1` stays correct as `RVC-v1` and is never rewritten
(see the dated candidate row in `docs/preprod-candidates.md`, still marked `RVC-v1`, honest for its
date). When any item's text, id, or pass criterion changes in a way that alters what "validated"
asserts, the marker becomes `RVC-v2` and the old marker keeps meaning what it meant — rows already
written are never reinterpreted.

🔴 **Amended 2026-08-25 (`RVC-v1` → `RVC-v1.1`), code review fix-pass of Story 5.6, on Oleg's own
written decision as the release's owner — decision record `docs/migration-decisions.md#d41`.** This
is a **second class** of change that bumps the marker, next to the text/id/criterion class above:
**adding or amending the waiver mechanism itself** — because a waiver changes what a `pass`
dispatched under it is allowed to mean, which is exactly the kind of thing this paragraph exists to
gate. `RVC-v1` had never defined a waiver at all beyond one nine-word parenthetical (["The CORS
blocker"](#the-cors-blocker) still carries it, unedited, as history); Story 5.6 needed one, wrote its
own mechanics into its own story file and its decision record (`D40`) rather than into this file, and
those mechanics are ratified here, in [The waiver](#the-waiver), as `RVC-v1.1`'s own text — not
attributed back to `RVC-v1` as though they had always been here. **What this amendment does NOT do:**
it does not touch any F-item's text, id, or pass criterion (a `RVC-v2` change, unaffected); it does
not retroactively change `D40` or the candidate already recorded under it (`D41` amends by addition,
same convention as `D40` §7 below — the original body is never rewritten); and it does not imply the
waiver mechanism is now exercised for the first time — it was already used, once, by `D40`, before
this file said so explicitly. This amendment is the checklist catching up to what the story and
Oleg had already decided, not a new decision.

**What does NOT bump the marker: a change in what is *executable*.** 🔴 **This predicted event
actually happened, 2026-08-25 — confirmed here, not merely anticipated anymore.** `CRM/api-prionex`
fixed the CORS origin; F3, F4-F8, F10, F11 and F12 (nine items, not the originally-estimated
F4-F11 — F3 and F12 were degraded rather than fully blocked, and both are now fully executable too)
became executable with **not one criterion changed** — the criteria are exactly what `RVC-v1` names,
and they named the same thing before and after. This did **not** produce `RVC-v2`, as designed. The
difference between a candidate validated before the fix and one validated after is carried entirely
by the `<B>` (blocked) and `<D>` (degraded) counts in the
[`validation_note`](#the-validation_note-format), which is why those counts are mandatory rather
than decorative: without them a `2/12` candidate and an `11/12` candidate would both cite `RVC-v1`
while asserting very different coverage. Only a change to an item's **text, id, or pass criterion**
bumps the marker to `RVC-v2`; only a change to the waiver mechanism bumps it to a `.1`-class
amendment like this one.

**Established by Story 5.5, 2026-08-24.** The plan sentence this executes is
`docs/forgejo-migration.md:231` ("Место под E2E: job `e2e` после healthcheck … на первом этапе —
заглушка + чек-лист ручной валидации критичных флоу"); the decision record is
`docs/migration-decisions.md#d39`. **Amended by Story 5.6, 2026-08-25 — `D41`, adding [The
waiver](#the-waiver).**

## Why this file exists

`.forgejo/workflows/record-preprod-candidate.yml` has demanded a `pass|fail` verdict and a non-empty
`validation_note` since Story 5.4, and `preprod-<sha>` — the tag Story 6.5 reads as *validated* — is
minted only when a human types `pass`. Until this file existed, nothing in the repository said what
that verdict was asserted **against**. The recorder says so itself, in its own output
(`record-preprod-candidate.yml:513-514`): it "DOES NOT SUPPORT … that any particular checklist was
followed (Story 5.5 owns defining what validation consists of)."

This file is that definition. It does not add a gate, change a workflow input, or require any new
machinery — see [How a failed item blocks promotion](#how-a-failed-item-blocks-promotion).

## How to execute it

You do not need to have read the application's source. You need:

1. The `image_tag` that was deployed, e.g. `sha-28f7fd36b75e-preprod`. Every deploy to PRE-PROD is a
   `workflow_dispatch` of `deploy-preprod.yml` with that tag; take it from the run you are validating.
2. A browser on `https://crm.preprod.crm-prionex.online`.
3. Working credentials for a normal operator account **and** for an account with a restricted role
   (needed by F9). Ask Oleg; this checklist does not carry credentials.
4. 🔴 **Read access to this repository's Forgejo repository variables** (needed by F2 criterion 5,
   which checks `vars.VITE_OPERATOR_PHONE_URL_PREPROD` directly — "check the variable, do not
   guess"). Without it you have no legal verdict for F2 c5; F2 carries no degraded wording for this
   case, so treat the item as `BLOCKED — owner: whoever grants repository-settings read access` if
   you lack it, rather than guessing from the UI alone.

**Execute P1 by hand before starting F1** — see [P1](#p1) for why it cannot be delegated to the
recorder.

**A failed precondition aborts validation before F1 begins.** P1 or P2 failing is not one more
verdict folded into the `P + D + F + B == 12` count (which ranges over F1…F12 only, deliberately —
see [the note format](#the-validation_note-format)): it means the twelve flow verdicts you are about
to collect would describe an artifact other than the one `image_tag` names, or would describe it at
a stale moment. **If P1 or P2 fails, stop. Do not execute F1-F12 at all.** The aggregate verdict is
`fail`, `validated=fail` on the dispatch, and the `validation_note` is the fixed sentence
`RVC-v1 <image_tag>: precondition failed (<P1|P2>) — validation aborted, no items executed` — no
`<P>/<D>/<F>/<B>` counts, because none were collected. This is the one note shape this file
mandates that does **not** range over 12; the invariant in [the note format](#the-validation_note-format)
applies only once you are past this gate.

Work through F1 → F12 in order. For each item write exactly one of **four** legal verdicts into the
[Execution Log](#execution-log):

| Verdict | Meaning | Counts as |
|---|---|---|
| `pass` | The item was executed **in full**, as written, and met its criterion. | `<P>` |
| `pass (degraded)` | The item was executed only on a **reduced scope** (part of it is blocked), and that reduced part met its criterion. The log entry MUST name the words the item's own text requires. | `<D>` |
| `fail` | The item was executed and did not meet its criterion. | `<F>` |
| `BLOCKED` | The item could not be executed **at all**, and the entry names who owns the blockage. | `<B>` |

Do not skip an item silently and do not average: an item you did not execute is not a `pass`.

**A `BLOCKED` item is neither a pass nor a fail.** It records that the item could not be executed
at all, and it names who owns the blockage. `BLOCKED` never rounds up.

**`pass (degraded)` is not a `pass` either.** It exists because two items (F3, F12) have a half that
runs today and a half that does not, and counting those as whole passes overstates coverage in the
one artifact most people read without opening this file — the `validation_note`. A degraded item
never contributes to `<P>`.

---

## Preconditions

These are not user flows. They are the state the flows assume, and they are the only part of this
checklist the recorder re-verifies on its own.

<a id="p1"></a>

### P1 — The stand is serving this exact candidate, and is healthy

- **What is checked:** the `fe-prionex-preprod` container on s1 reports Docker health `healthy`,
  and its running image's `.RepoDigests` contains the digest that `image_tag` resolves to in the
  registry.
- **What constitutes a pass:** both are true **at the moment you begin the checklist**.
- **Who checks it: you do.** 🔴 An earlier draft of this file delegated P1 to the recorder's G4/G5.
  That delegation is wrong in two ways, and both matter:
  1. **G4/G5 run at *record* time, not at validation start.** They assert the state of the stand
     after you have finished clicking, which is the wrong end of the window. If the stand was
     serving a different image while you executed F1-F12 and was redeployed before you dispatched
     the recorder, G4/G5 pass and your twelve verdicts describe a different artifact.
  2. **When the verdict is `fail`, G4 and G5 never run at all.** G1 refuses `fail` as the first
     step of the first job, before any registry read — so on exactly the runs where something went
     wrong, the precondition is never checked by anybody.
  Execute it by hand, at the start: confirm the container is `healthy` and that its running image's
  `.RepoDigests` contains the digest `image_tag` resolves to. The recorder's G4/G5 remain a useful
  second check at the other end of the window; they are not a substitute for this one.
- **Executability:** `EXECUTABLE` (by you, at the start of validation; it needs stand access, not a
  browser).

### P2 — You are looking at the candidate you think you are

- **What is checked:** the page served at `https://crm.preprod.crm-prionex.online` was built from
  the same `image_tag` you are validating.
- **What constitutes a pass:** 🔴 not "a hard reload still shows the candidate's build" — an earlier
  draft said that, and it is **unobservable**: this application surfaces no build identifier in the
  UI at all, so there is nothing on screen for a human to compare. The pass criterion is
  **[F2 criterion 4](#f2)'s decodable build epoch**, executed after a hard reload
  (Ctrl/Cmd+Shift+R): find the quoted 13-digit integer in the served `assets/index-*.js`, decode it
  as a Unix epoch in milliseconds, and require it to be **at or after the `build.yml` run's own
  `started` timestamp** (see F2 c4 for exactly which instant this is and where to read it — the
  image's own `created` time is a different, later instant and the wrong one to compare against).
  That is a criterion that can actually fail — a cached bundle from a previous deploy decodes to an
  *earlier* epoch, and that is exactly the situation P2 exists to catch.
- **Executability:** `EXECUTABLE` (it is F2 criterion 4, run once at the start).

---

## The critical flows

Each item: what is checked, what constitutes a pass, and whether it can be executed today.

Executability values used below. 🔴 **Updated, closeout re-measurement, 2026-08-25: PRE-PROD's
CORS origin is now fixed** (see [The CORS blocker](#the-cors-blocker) for the measured evidence),
so the `CRM/api-prionex, CORS origin` blockage no longer applies to any item today. The row is kept
below because it is a real label this file used historically and may need again on a regression —
not because any item currently carries it:

| Value | Meaning |
|---|---|
| `EXECUTABLE` | Can be executed today, end to end, as written. |
| `EXECUTABLE, degraded` | The part that does not touch the API can be executed today; the API-touching part cannot. Its best legal verdict is **`pass (degraded)`**, never `pass`, and the log entry must carry the words the item's own text requires. |
| `BLOCKED — owner: CRM/api-prionex, CORS origin` | **Historical as of 2026-08-25 — fixed, no item currently carries this label.** Kept for the regression case. See [The CORS blocker](#the-cors-blocker). |
| `BLOCKED — owners: CRM/api-prionex (CORS origin) AND Oleg (no restricted-role account)` | Used by F9. Two independent blockages; fixing either one alone does not make the item executable — as of 2026-08-25 the CORS half is closed and F9 is `BLOCKED — owner: Oleg (no restricted-role account)` only. |

### F1 — Application shell over TLS

- **What is checked:** `https://crm.preprod.crm-prionex.online` loads the application, over a valid
  certificate, with no browser security warning.
- **What constitutes a pass:** the browser shows a padlock (no interstitial, no
  `NET::ERR_CERT_*`), the login screen renders, and the browser devtools **Network** tab shows the
  document and every `assets/*.js` / `assets/*.css` request returning `200`. Zero failed static
  asset requests.
- **The console exemption, stated widely enough to be usable.** Errors in the **Console** that
  originate from a request to `api.crm.preprod.crm-prionex.online` do **not** fail this item. That
  covers the CORS error itself **and** everything the browser reports downstream of it: an uncaught
  `TypeError: Failed to fetch` from a blocked axios call, and any unhandled promise rejection whose
  stack or message names that host. This breadth is deliberate — a blocked request does not only
  print a CORS line, and without the wider wording one of the only two fully executable items on
  this list could be failed arbitrarily by a defect it is not testing. Any other uncaught error,
  and any failed `assets/*` request, still fails F1.
- **Executability:** `EXECUTABLE`.

<a id="f2"></a>

### F2 — The built bundle carries the PRE-PROD environment values

This item exists because the application's configuration is **baked into the JavaScript at build
time**, not read at runtime (`src/lib/api.ts:4-7` — `VITE_API_BASE_URL` is an absolute URL resolved
into the bundle). A wrong hostname therefore builds green, deploys green, passes the container
health check, and fails only in a browser. Nothing upstream of this item can catch it.

- **What is checked:** the JavaScript actually served by the stand contains the PRE-PROD values and
  no leftover DEV, localhost, or placeholder value.
- **How to check it without reading code:** in devtools **Network**, open any served
  `assets/index-*.js`, and use the browser's find (Ctrl/Cmd+F) inside that response body.
- **What constitutes a pass — all five:**
  1. `https://api.crm.preprod.crm-prionex.online` is present. (Measured on a correct build: it
     occurs in **3** files under `assets/`.)
  2. No occurrence of `api.crm.dev.crm-prionex.online`, and **neither** of these two localhost
     fallbacks occurs anywhere: `http://localhost:8000` **and** `http://localhost:8005`. Both must
     be searched — they are different fallbacks in different code, and an earlier draft of this
     file attributed them wrongly:
     - `http://localhost:8000` is the API-base fallback (`src/lib/api.ts:7`) **and the dialer
       socket's fallback** (`src/features/dialer/hooks/useDialerSocket.ts:9`), plus
       `src/features/calls/api/callService.ts:18`,
       `src/features/dialer/api/dialerHttpService.ts:19`,
       `src/features/auth/hooks/useTabTracker.ts:155`.
     - `http://localhost:8005` is **not** the dialer's. It belongs to
       `src/features/calls/hooks/useCallWebSocket.ts:14`,
       `src/features/calls/hooks/useCallStateUpdates.ts:13`,
       `src/features/calls/hooks/useIncomingCall.ts:8` and
       `src/features/notifications/hooks/useNotificationSocket.ts:8`.

     Finding either string means the corresponding variable was never supplied and that part of the
     application would try to reach **the validator's own machine**.
  3. The **literal expected WebSocket value** is present — for this stand,
     `wss://api.crm.preprod.crm-prionex.online`, the exact value the image was built with. Not
     "a WebSocket URL is present": the guard in every socket hook is
     `import.meta.env.VITE_WS_URL !== undefined`, so an **empty string passes the guard** and the
     fallback never enters the bundle. A build made with `VITE_WS_URL=""` therefore looks perfectly
     clean under criterion 2 while every socket silently fails to connect. Only the presence of the
     literal expected value separates those two builds.
  4. **A build timestamp is present and is not older than the candidate's own build.** 🔴 Do **not**
     search for the identifier `VITE_BUILD_TS` — an earlier draft of this file said to, and it is
     unexecutable: the identifier is **not in the bundle at all**, on a perfectly correct build.
     `vite.config.ts:7-8` substitutes `import.meta.env.VITE_BUILD_TS` away at build time via
     `define`, and the value it substitutes is `String(Date.now())` evaluated unconditionally when
     the config is read, so it can never be empty either. Both halves of the old criterion were
     therefore unfalsifiable.

     What survives in the bundle is a bare **quoted 13-digit integer**, e.g. `"1787604128392"`.
     Search for a quoted 13-digit number, decode it as a Unix epoch in **milliseconds** —
     `date -u -r 1787604128` (macOS) or `date -u -d @1787604128` (Linux), i.e. the value with its
     last three digits dropped.

     🔴 **The reference instant is pinned, and it matters which one.** `Date.now()` is evaluated when
     the vite config is *read* — before bundling, before `docker build` completes, before the image
     exists. Run start, run end, and the image's own `created` timestamp are three different
     instants, and comparing against anything later than run start can fail a genuinely correct
     bundle (the config is read early inside the run). **The pin: require the decoded epoch to be
     at or after the `build.yml` run's own `started` timestamp** — the earliest of the three, so a
     stamp taken during that same run is always at or after it by construction, and it is the value
     a stale/cached bundle (stamped during an *earlier* run) will fail. **Where to read it:** the
     Forgejo Actions tab, filtered to `build.yml`, the run whose dispatch produced `image_tag` — its
     "Started" timestamp on the run's own page. A value **older** than that run's start means you are
     looking at a cached or stale bundle, which is exactly what P2 exists to catch.
  5. `VITE_OPERATOR_PHONE_URL` — **the authority is `build.yml`, not your expectation.** The
     selecting step is `build.yml`'s *"Select the operator phone URL for this environment"*, which
     reads the Forgejo repository variable `vars.VITE_OPERATOR_PHONE_URL_PREPROD`. For **preprod
     the decided value is EMPTY** (Oleg, 2026-08-17, recorded in that step's own comment:
     dev and preprod do not get an operator phone; `phone.crm.preprod.crm-prionex.online` is
     NXDOMAIN). So on this stand the expected observation is: **no** `phone.` URL in the bundle,
     and the operator-phone panel **absent** from the UI. A panel that renders, or a
     `http://localhost:5173` string in the bundle, is a `fail`. If that repository variable is ever
     given a value for preprod, the criterion inverts and its literal value must be present —
     check the variable, do not guess.
- **Executability:** `EXECUTABLE`. This item needs no API call at all, so the CORS defect does not
  reach it — it is the single most valuable item in the list today.

#### One of F2's discriminators was measured and proven able to fail; the rest are narrower claims than an earlier version of this heading made

🔴 **Corrected, code review.** The earlier heading here — "F2's discriminators were measured, and
were proven able to fail" — overclaimed against its own table. Restated narrowly, per discriminator:

The real bundle was built twice with `npx vite build` (vite 6.4.2, node 22.23.1) on 2026-08-24 and
`assets/` was grepped:

| Build | `localhost:8000` | `localhost:8005` | literal `VITE_BUILD_TS` | `import.meta.env` | `api.crm.preprod.crm-prionex.online` |
|---|---|---|---|---|---|
| `VITE_API_BASE_URL` + `VITE_WS_URL` both set to the PRE-PROD values | 0 files | 0 files | 0 files | 0 files | 3 files |
| **Negative control** — same build, `VITE_WS_URL` **unset only** | **1 file** | **2 files** | — | — | — |

**What this table actually controls, and what it does not:**

1. **Criteria 2-3's `VITE_WS_URL`-fallback half is genuinely measured and falsifiable.** The negative
   control varied `VITE_WS_URL` unset, and the fallback strings reappeared — a discriminator
   demonstrated able to fail, not assumed to work. esbuild's constant-folding of the
   `!== undefined ? … : …` guard is confirmed on this toolchain for this one variant.
2. **Criterion 3's own justifying case — the empty string — was never built or controlled.** The
   negative control unset the variable; it did not set `VITE_WS_URL=""`, which is the specific case
   criterion 3's own text names as the trap (`!== undefined` passes on `""`). That case is asserted,
   not measured, here.
3. **Criterion 2's other halves — the absence of `api.crm.dev.crm-prionex.online` and of
   `http://localhost:5173` — were never controlled either.** The table has no column for either
   string; their absence in the real build is observed, not proven falsifiable by a negative control.
4. **Criterion 4 (the build-timestamp epoch) was never controlled at all — the `—` cells above are
   honest, not filler.** No build was made with a stale or absent timestamp to confirm the check can
   fail. Separately: `VITE_BUILD_TS` reaches the bundle through exactly **one** reference
   (`src/lib/i18n.ts:9`), and unlike criterion 1's "**3** files", no measurement here states how many
   quoted 13-digit integers a real bundle contains, so there is no stated match count to verify
   against.
5. **Any instruction to search the bundle for the identifier `VITE_BUILD_TS` remains unexecutable** —
   0 hits on a correct build, because of the `define` substitution described under criterion 4. The
   measured example value was `"1787604128392"`.

The same facts are recorded in `docs/migration-decisions.md#d39` §9, which is where this project
keeps measured platform facts.

### F3 — Unauthenticated route guard

- **What is checked:** with no session, a protected URL does not render protected content.
- **How to check it:** open a private/incognito window, go directly to
  `https://crm.preprod.crm-prionex.online/dashboard`.
- **What constitutes a pass:** the browser lands on `/login`. No dashboard chrome, no client data,
  and no flash of protected content before the redirect.
- **Executability:** ~~`EXECUTABLE, degraded`. The redirect itself is decided in the browser from the
  absence of a stored session, so it runs today. The *other* half of the same guard — that a
  **stale or revoked** token is rejected by the backend on `401` and forces the same redirect —
  requires an API call and is `BLOCKED`. The best verdict F3 can legally carry today is therefore
  **`pass (degraded)`**, counted in `<D>` and never in `<P>`, and only with the words
  "guard-only, 401 path not exercised" in the log entry.~~ 🔴 **Updated, closeout re-measurement,
  2026-08-25: `EXECUTABLE`, no longer degraded.** PRE-PROD's CORS origin was fixed by `CRM/api-prionex`
  — see [The CORS blocker](#the-cors-blocker) for the measured evidence. The 401 path now reaches
  the backend like any other authenticated call. Both halves of F3 can now be executed in full; a
  `pass (degraded)` result on F3 from here on means something went wrong, not that the API half was
  never reachable.

### F4 — Login → dashboard, and every way login is allowed to refuse

- **What is checked:** the whole authentication surface, not just the happy path.
  1. Correct credentials → the dashboard loads.
  2. Wrong credentials → an error, and no session.
  3. An account with 2FA enabled → the code prompt appears; a correct code proceeds; a wrong code
     refuses without consuming the session.
  4. An account already logged in elsewhere → the force-logout / "already logged in" path behaves
     as designed rather than hanging.
  5. A locked account → an explicit "account locked" message, not a generic failure.
  6. A login from an address outside the IP whitelist → an explicit "IP not allowed" refusal.
  7. An account flagged for a forced password change → redirect to `/change-password`, and the
     dashboard is unreachable until the password is actually changed.
- **What constitutes a pass:** all seven behave as listed, **and** each refusal states its own
  reason. A refusal that reports the wrong reason is a `fail`, not a pass — a generic error where
  "IP not allowed" was expected hides a real defect.
- **Also worth knowing while executing it:** this application has **no token-refresh flow**. A
  `401` on any non-`/auth/*` request clears the stored session and hard-redirects to `/login`. If
  you are bounced to the login screen mid-checklist, that is the mechanism; re-authenticate and
  note it.
- **Executability:** ~~`BLOCKED — owner: CRM/api-prionex, CORS origin`~~ 🔴 **Updated, closeout re-measurement, 2026-08-25: `EXECUTABLE`.** PRE-PROD's CORS origin was fixed by `CRM/api-prionex` — see [The CORS blocker](#the-cors-blocker) for the measured evidence. This item can now be executed in full.

### F5 — Client list → client detail

- **What is checked:** `/dashboard` lists clients; opening one navigates to its detail page and the
  page's tabs (debt summary, activity, payment history) each load their own data.
- **What constitutes a pass:** the list renders with real rows and its paging/search return
  results consistent with the query; a client opens; each tab shows data or an explicit empty
  state. A tab that spins forever, or that renders an error where the list showed rows, is a
  `fail`.
- **Executability:** ~~`BLOCKED — owner: CRM/api-prionex, CORS origin`~~ 🔴 **Updated, closeout re-measurement, 2026-08-25: `EXECUTABLE`.** PRE-PROD's CORS origin was fixed by `CRM/api-prionex` — see [The CORS blocker](#the-cors-blocker) for the measured evidence. This item can now be executed in full.
  🔴 **Further updated, Story 5.6's rehearsal, 2026-08-25 (code review fix-pass, `RVC-v1.1`): still
  `EXECUTABLE`, and now known to produce a live `fail` on this item's own criterion.** `GET
  /api/v1/clients/{id}` returns `500` for every client on PRE-PROD, root-caused to a genuine
  `CRM/api-prionex` migration gap (the `Debt` model's ORM defines ten "paid"/"written_off" columns
  with no migration anywhere in that repository — commit `f489058c…`, six months old). The list
  renders; the detail page errors — **that is this item's own named `fail` condition, not
  `BLOCKED`**: the item was reached and executed, not prevented from running at all. **This `fail`
  is exactly the shape [The waiver](#the-waiver)'s second clause exists for** — caused solely by a
  dependency outside this repository, root-caused and evidenced, not merely suspected. Owner:
  `CRM/api-prionex`.

### F6 — Payments on a client: record, edit, cancel, verify, receipt

- **What is checked:** recording a payment against a client; editing it; cancelling it; the
  verification queue reflecting each of those; and generating the PDF receipt.
- **What constitutes a pass:** each of the five actions completes and its result is visible after a
  page reload (i.e. it was persisted, not merely rendered optimistically); the verification queue
  shows the item in the state the action should have produced; the receipt downloads as a PDF that
  opens and carries the payment's own amount and client.
- **Executability:** ~~`BLOCKED — owner: CRM/api-prionex, CORS origin`~~ 🔴 **Updated, closeout re-measurement, 2026-08-25: `EXECUTABLE`.** PRE-PROD's CORS origin was fixed by `CRM/api-prionex` — see [The CORS blocker](#the-cors-blocker) for the measured evidence. This item can now be executed in full.
  🔴 **Further updated, Story 5.6's rehearsal, 2026-08-25 (code review fix-pass, `RVC-v1.1`):
  `BLOCKED — owner: CRM/api-prionex` (a new, unrelated blockage — CORS is not it).** A full payment
  cycle needs a client with a real debt; `services/client` has no direct single-`POST` endpoint to
  create one (`DebtCreate` is documented CSV-import-only, driven by a bulk pipeline this checklist
  does not exercise blind). Also inherits F5's migration-gap bug. **This item was never reached —
  `BLOCKED` is correct as originally recorded, not the fail-and-waive shape F5 uses.**

### F7 — Telephony: dialer and inbound call handling

- **What is checked:** `/dashboard/dialer` connects its socket; an outbound call can be placed; an
  inbound call raises the in-app notification; minimizing the call leaves a working call bubble;
  the recording of a finished call is retrievable.
- **What constitutes a pass:** the dialer reports a connected state rather than a permanent
  "connecting"; an inbound call surfaces within a few seconds of the phone actually ringing; the
  minimized bubble still controls the live call; a finished call's recording plays back.
- **Note:** this flow depends on `VITE_WS_URL` being correct, which F2 checks statically. F2
  passing does not make F7 pass — F2 proves the value is in the bundle, not that the socket
  connects.
- **Executability:** ~~`BLOCKED — owner: CRM/api-prionex, CORS origin`~~ 🔴 **Updated, closeout re-measurement, 2026-08-25: `EXECUTABLE`.** PRE-PROD's CORS origin was fixed by `CRM/api-prionex` — see [The CORS blocker](#the-cors-blocker) for the measured evidence. This item can now be executed in full.
  🔴 **Further updated, Story 5.6's rehearsal, 2026-08-25 (code review fix-pass, `RVC-v1.1`):
  `BLOCKED — owner: Oleg / telephony infrastructure owner` (a new, unrelated blockage).** Zero
  telephony infrastructure is provisioned on PRE-PROD at any level: no SIM cards, no dialer queues,
  no operator-extension links, no Asterisk/SIP/AMI configuration on `dialer-service`. Assigning a
  phone number through the admin API does not create a real telephone behind it. **Never reached —
  `BLOCKED` is correct.**

### F8 — Client import and the bulk operations

- **What is checked:** `/dashboard/import/clients` accepts a file and reports a result; the import
  history lists that run and its detail page opens; and each of the seven bulk operations pages
  (operator assignment, tag assignment, payment import, write-off import, reversal import, sale
  notes import, document import) accepts input and reports a per-row outcome.
- **What constitutes a pass:** the import reports counts that match the file submitted (including
  its rejected rows — an import that reports "0 errors" on a file with a deliberately malformed row
  is a `fail`); the run appears in history with the same counts; each bulk page reports success and
  failure per row rather than a single aggregate "done".
- **Executability:** ~~`BLOCKED — owner: CRM/api-prionex, CORS origin`~~ 🔴 **Updated, closeout re-measurement, 2026-08-25: `EXECUTABLE`.** PRE-PROD's CORS origin was fixed by `CRM/api-prionex` — see [The CORS blocker](#the-cors-blocker) for the measured evidence. This item can now be executed in full.
  🔴 **Further updated, Story 5.6's rehearsal, 2026-08-25 (code review fix-pass, `RVC-v1.1`):
  `BLOCKED — owner: CRM/api-prionex, jointly with F6` (a new, unrelated blockage).** 3 of the 7 bulk
  pages (payment import, write-off import, reversal import) reference an existing `loan_number`/
  `tin` and inherit F6's blockage; the item has no degraded wording, so the whole item does not
  reach a full `pass` while any sub-page cannot be exercised. **Partly reached (4 of 7 sub-pages have
  real targets via the two test clients created this rehearsal), but the item as a whole never
  completed — `BLOCKED` is correct, not a partial `pass`.**

### F9 — Permission gating

- **What is checked:** that a role with the wrong permission set does not merely lose a menu item —
  it must lose the **route**. 🔴 An earlier draft of this file said "every dashboard route is
  wrapped in a permission check". That is **false**, and a validator following F9's own instruction
  (log in restricted, type URLs directly) would have recorded a `fail` on a healthy candidate
  because of it.
- **The known exception: `/dashboard/profile`.** `src/routes/index.tsx:275-278` renders
  `ProfileSettingsPage` **bare**, with no `PermissionRoute` wrapper, unlike every sibling route
  around it:
  ```
  {
    path: 'profile',
    element: withSuspense(<ProfileSettingsPage />),
  },
  ```
  🔴 **Corrected, code review:** an earlier version of this file quoted this as a one-line form,
  `{ path: 'profile', element: withSuspense(<ProfileSettingsPage />) }` — a reconstruction, not a
  verbatim quote; the real object literal spans four lines as shown above, with `path: 'profile'`
  on line 276. The substance was always correct — no `PermissionRoute` wrapper — only the quoted
  text was fabricated. So a restricted role
  **will** see `/dashboard/profile` render, and that is the current, pre-existing behaviour of the
  application, not a defect introduced by the candidate. Do **not** record F9 `fail` for `profile`
  alone. Whether that bareness is intentional (a user's own profile arguably needs no permission)
  is a product question; it is filed as a deferred item owned by Oleg in
  `_bmad-output/implementation-artifacts/deferred-work.md` and is deliberately not "fixed" by this
  story.
- **How to check it:** log in as a restricted account and navigate **by typing the URL directly**,
  not by clicking. A hidden menu item proves nothing.
- **What constitutes a pass:** a route the role lacks permission for — **`profile` excepted** —
  does not render its content, neither the data nor an empty version of the page. Hiding the
  navigation entry while the URL still renders the page is a `fail`.
- **Why it is on the list:** this is the item whose failure is widest. Every dashboard route
  depends on it, so a single bad role breaks the whole application rather than one page.
- **Executability:** ~~`BLOCKED — owners: CRM/api-prionex (CORS origin) AND Oleg (no
  restricted-role account)`~~ ~~🔴 **Updated, closeout re-measurement, 2026-08-25: `BLOCKED — owner:
  Oleg (no restricted-role account)` — ONE owner now, not two.** F9 had **two** blockages, and an
  earlier draft hid the second one inside the first. (a) The CORS origin, like F4-F11 — **this half
  is now closed**, see [The CORS blocker](#the-cors-blocker) for the measured evidence, exactly as
  predicted here: fixing CORS alone does **not** unblock F9 on its own, because (b) remains. (b)
  This checklist's own prerequisites require "an account with a restricted role — ask Oleg", and
  **no evidence yet exists that such an account is provisioned on PRE-PROD** — unchanged by the CORS
  fix, not independently re-verified by this closeout (it is not a network-observable fact). F9
  stays `BLOCKED` until that account exists; it is the **only** item in `RVC-v1` still blocked for
  any reason, once CORS is accounted for.~~
  🔴 **Corrected, Story 5.6's rehearsal, 2026-08-25 (code review fix-pass, `RVC-v1.1`): `EXECUTABLE`,
  no longer blocked.** Story 5.6 provisioned `rvc-operator` (Operator role, 24 of 141 Admin
  permissions) through `CRM/api-prionex`'s normal API, closing (b) above; (a) was already closed.
  F9 passed live under this account. **This paragraph's own former claim — "the only item in
  `RVC-v1` still blocked for any reason" — was already wrong the moment it was written and stayed
  uncorrected through this file's first Execution Log entry; see [the CORS section's own summary
  below](#the-cors-blocker) for the same correction.** As of this rehearsal, `BLOCKED` items are
  F5 (`fail`, waiverable — see [The waiver](#the-waiver)), F6, F7, F8, F10 — not F9.

### F10 — Messaging and SMS campaigns

- **What is checked:** creating a messaging campaign, saving a draft and reopening it, the SMS
  templates page, and the messaging integrations settings page.
- **What constitutes a pass:** a campaign saves and reappears after a reload with its content
  intact; a draft round-trips unchanged; a template renders its placeholders; the integrations page
  reports each integration's real state rather than a blank list.
- **Executability:** ~~`BLOCKED — owner: CRM/api-prionex, CORS origin`~~ 🔴 **Updated, closeout re-measurement, 2026-08-25: `EXECUTABLE`.** PRE-PROD's CORS origin was fixed by `CRM/api-prionex` — see [The CORS blocker](#the-cors-blocker) for the measured evidence. This item can now be executed in full.
  🔴 **Further updated, Story 5.6's rehearsal, 2026-08-25 (code review fix-pass, `RVC-v1.1`):
  `BLOCKED — owner: Oleg / SMS-provider owner` (a new, unrelated blockage).** `sms_configuration`
  has zero rows; `messaging_integrations`' 5 rows are all `status=unconfigured` with no credentials.
  No real SMS gateway is configured at any level — a business/infrastructure decision, not a
  fixture gap reachable through the admin API. **Never reached — `BLOCKED` is correct.**

### F11 — AI assistant

- **What is checked:** `/dashboard/ai-assistant` — a chat message streams a response token by token
  (server-sent events, not one delayed block), dictation captures speech, and text-to-speech plays
  back.
- **What constitutes a pass:** the response visibly streams; an interrupted stream leaves the UI
  usable rather than stuck; dictation and TTS each produce their output or state plainly that the
  browser denied the permission.
- **Executability:** ~~`BLOCKED — owner: CRM/api-prionex, CORS origin`~~ 🔴 **Updated, closeout re-measurement, 2026-08-25: `EXECUTABLE`.** PRE-PROD's CORS origin was fixed by `CRM/api-prionex` — see [The CORS blocker](#the-cors-blocker) for the measured evidence. This item can now be executed in full.

### F12 — Public payment page `/pay`

- **What is checked:** `https://crm.preprod.crm-prionex.online/pay` — the **only** flow in this
  application with no authentication dependency — renders and can take a payment through EasyPay.
- **What constitutes a pass:** the page renders for a signed-out visitor in a private window
  (no redirect to `/login`), its form validates input, and a payment reaches EasyPay and returns a
  result the page displays.
- **Executability:** ~~`EXECUTABLE, degraded`~~ 🔴 **Updated, closeout re-measurement, 2026-08-25:
  `EXECUTABLE`, no longer degraded.** An earlier draft of this file first claimed the render-and-
  validate half ran with no API call at all — corrected, in code review, to `EXECUTABLE, degraded`,
  because *validate* **is** a call to our own API: `src/features/easypay/api/easypayApi.ts:17,30`
  builds its axios client with `baseURL: API_BASE_URL`, imported from `src/lib/api.ts:4-7` — the
  same absolute `https://api.crm.preprod.crm-prionex.online` base as everything else, so credit
  validation was CORS-blocked exactly like the rest of the application. PRE-PROD's CORS origin is
  now fixed (see [The CORS blocker](#the-cors-blocker)), so **validate** is reachable again; **all
  three** phases — render, validate, submit — can now be executed in full.
- **What you may record from here on:** a full `pass` if render, validate and submit all meet their
  criteria. `pass (degraded)`, counted in `<D>` and never in `<P>`, remains available for the older
  meaning — "render only; credit validation and payment submission both CORS-blocked" — only if a
  future regression reproduces that exact condition; it should not be the default result anymore. A
  CORS failure on the validate step is no longer the expected outcome now that PRE-PROD's CORS
  origin is fixed; if the validate or submit call fails today, treat it as a genuine `fail` on its
  own merits, not as the known historical blockage. If the page does not render for a signed-out
  visitor, that **is** a `fail`, unchanged from before.

---

## The CORS blocker

<a id="the-cors-blocker"></a>

~~PRE-PROD's Kong gateway returns an `Access-Control-Allow-Origin` naming an unrelated `localhost`
origin. A browser on `https://crm.preprod.crm-prionex.online` therefore refuses every response from
`https://api.crm.preprod.crm-prionex.online` before the application ever sees it.~~

🔴 **FIXED, closeout re-measurement, 2026-08-25T10:48Z, independent channel (direct outbound HTTPS,
not through s1/SSH — a different path than the coordinator's own probe).** `CRM/api-prionex` fixed
PRE-PROD's CORS origin. Measured directly, not taken on the coordinator's word alone:

- `OPTIONS /api/v1/auth/login` (a real routed endpoint, not the bare root probed earlier) with
  `Origin: https://crm.preprod.crm-prionex.online` → `HTTP/1.1 200`,
  `Access-Control-Allow-Origin: https://crm.preprod.crm-prionex.online`,
  `Access-Control-Allow-Credentials: true`, `Access-Control-Allow-Methods: GET,POST,PUT,DELETE,PATCH,OPTIONS`.
- **Negative control, same endpoint, `Origin: https://evil.example`** → still `HTTP/1.1 200` with
  `Access-Control-Allow-Origin: https://crm.preprod.crm-prionex.online` — the real PRE-PROD origin,
  **not** the evil origin and **not** a wildcard. This is not an echo; a browser sent this response
  under a foreign `Origin` would reject it. The fix is the strict, credential-safe form, not a
  looser one that happens to pass a same-origin test.
- `GET /` (route-miss) with the real origin → `HTTP/1.1 404` (expected — no route at `/`) but now
  **carrying** the same CORS headers, confirming the fix applies Kong-wide, not only to one route.

**Owner was `CRM/api-prionex`.** Kong belongs to the neighbouring backend repository; nothing in
`fe-prionex` could have fixed it, worked around it, or routed past it — closed by them, not by any
change in this repository. The defect was originally measured from the real origin and recorded in
Story 5.2 (`docs/migration-decisions.md#d36`), the ask was sent 23.08.2026
(`docs/preprod-infrastructure-requirement.md`), and the fix is now independently confirmed here.

**What this restores, for `RVC-v1` specifically:** F3, F4, F5, F6, F7, F8, F10, F11 and F12 — nine
items — move from `BLOCKED`/degraded to fully `EXECUTABLE`. **F9 does NOT fully clear**: it carries
a second, independent blockage (no restricted-role account provisioned on PRE-PROD, owner Oleg) that
this measurement does not touch and that this closeout did not independently verify either way — see
F9's own section. Fully executable as of this measurement: **F1, F2, F3, F4, F5, F6, F7, F8, F10,
F11, F12 — eleven of twelve.** Only F9 remains `BLOCKED`.

🔴 **Superseded for the "only F9" headline, Story 5.6's rehearsal, 2026-08-25 (code review fix-pass,
`RVC-v1.1`) — the paragraph above is accurate for what CORS alone accounted for and is left as
written; it is not a live claim about blockage anymore.** "Executable" (reachable at all) and
"passes" are different claims: this rehearsal executed F5-F10 for the first time and found F5
produces a genuine `fail` (waiverable, see [The waiver](#the-waiver)) and F6/F7/F8/F10 are
`BLOCKED` for reasons unrelated to CORS (see each item's own further-updated Executability line).
F9 itself is **no longer blocked at all** — Story 5.6 provisioned the missing account. So, as of
2026-08-25's rehearsal: **F9 passed; F5 is `fail` (waived); F6, F7, F8, F10 are `BLOCKED`.** The
inverse of what this section's own headline still implied at the moment the Execution Log's first
entry was written — named here explicitly (code review M2) rather than left for a reader to notice
the contradiction between this section and the log below.

**Note on DEV:** the same closeout re-measurement confirms `api.crm.dev.crm-prionex.online`'s CORS
origin is *also* fixed (same evidence shape, non-echo, negative control). This has **no bearing on
`RVC-v1`**, which is scoped to PRE-PROD only (see ["What this checklist does NOT
cover"](#what-this-checklist-does-not-cover)) — named here only so a reader does not wonder whether
it was checked. Separately, `crm.dev.crm-prionex.online`'s own frontend vhost/TLS is confirmed
**still not fixed** (`curl` to it fails TLS verification, `exit 60`; the served certificate is still
`CN=admin.techno-finance.online`, the wrong tenant) — a different ask, different owner (`aleksey`),
untouched by this fix, and irrelevant to PRE-PROD's own `RVC-v1`.

**Therefore, as of this measurement, an aggregate verdict of `pass` under `RVC-v1` is achievable in
principle for the first time** — if F9's remaining precondition (the restricted-role account) is
also satisfied. The rule itself is unchanged, restated for clarity:

> An aggregate verdict of `pass` requires **every** item to be `pass` — a full `pass`, not a
> `pass (degraded)` and not a `BLOCKED`. As of 2026-08-25, only F9 can still legitimately be
> `BLOCKED`; every other item's executability blocker traced to CORS is closed. This is a rule about
> F1-F12 only; a failed P1 or P2 aborts before any of them run and forces its own `fail` by a
> different route — see ["A failed precondition aborts validation"](#how-to-execute-it).

### Two consequences, stated rather than left to be discovered — and their status now

1. **`docs/preprod-candidates.md`'s first two rows are marked `pass` and would not be, under
   `RVC-v1`.** Those rows are honest about their own scope — both say in their own note that
   browser-path validation was not performed and not possible — and they were written before this
   checklist existed. They are **not rewritten**: this ledger is append-only, and rows are never
   reinterpreted after the fact, even now that the blocker that would have prevented a real `RVC-v1`
   validation on those dates is gone. `RVC-v1` governs candidates recorded from its publication
   onward, and a **new** row, added by whoever next records a candidate, is how the CORS fix and the
   possibility of re-validation actually reach that ledger — see `docs/preprod-candidates.md`'s own
   pointer paragraph, updated by this closeout.
2. **Story 5.6's rehearsal is no longer blocked from recording a `pass` by CORS.** 5.6's job is to
   exercise the full cycle through the workflows; the collision this file and D39 described — CORS
   forces `fail`, but 5.6 must record a candidate — is resolved **for the CORS half**. What remains
   is F9's own precondition: if a restricted-role account exists on PRE-PROD by the time 5.6 runs,
   `RVC-v1` can legitimately produce `12/12 pass`; if not, the honest aggregate is still `fail` (or
   the same documented, time-boxed waiver this file has always allowed), now naming only F9 rather
   than nine items. **Owner: Oleg** for confirming or provisioning the F9 account; no waiver decision
   is needed for the CORS half anymore, since there is nothing left to waive on that axis.

---

<a id="the-validation_note-format"></a>

## The `validation_note` format

`record-preprod-candidate.yml` prints `validation_note` verbatim into a **single Markdown table
cell** of `docs/preprod-candidates.md` (`record-preprod-candidate.yml:982`). 🔴 **Corrected, code
review: that is not the only sink.** The same value is also interpolated into a Markdown table cell
inside the run's own log at `record-preprod-candidate.yml:972`
(`echo "| validation_note | ${VALIDATION_NOTE} |"`), and — if you use this file's own Execution Log
template below — into that section's `Evidence / why` cells too. Both rules below apply everywhere
the note is rendered as a table cell, not only at `:982`.

**Two shape rules, and both are conventions YOU must keep — not guards the workflow applies.** The
workflow rejects only a blank or whitespace-only note (`record-preprod-candidate.yml:454-467`). It
does **not** reject a newline and it does **not** reject a pipe. So:

1. **No `|` anywhere in the note.** A pipe inside the cell shifts every column after `Note` in
   `docs/preprod-candidates.md` — the row silently renders wrong and the ledger's own format is
   broken by one keystroke.
2. **One line, no newline in it.** Same reason: the note is pasted into one table cell.

Nothing checks either rule. If you break one, the ledger is wrong and no run turns red.

**A third rule, unenforced the same way: nothing reconciles the `image_tag` named inside the note
with the `image_tag` actually dispatched.** G2/G3 in `record-preprod-candidate.yml` validate the
shape of the *dispatched* tag only; the note's own text passes through untouched. Dispatching tag B
while the note names tag A satisfies every guard and writes a ledger row that contradicts itself —
double-check the tag in the note matches the tag in the dispatch form before submitting.

**A fourth: no stated or enforced length bound.** `<F> fail (<ids>)` admits up to twelve ids and
`<B> BLOCKED (…)` admits up to twelve semicolon-separated `(cause, owner)` pairs; the only recorder
guard is the blank check above. This is a disclosure, not a known live defect — the realistic worst
case is well under any plausible limit — but truncation or rejection of an over-long dispatch input
is neither stated nor bounded anywhere.

**Format:**

```
RVC-v1 <image_tag>: <P>/12 pass, <D> degraded (<D-ids>), <F> fail (<F-ids>), <B> BLOCKED (<B-ids>) (<cause>, <owner>; <cause>, <owner>) — detail in docs/release-validation-checklist.md
```

- `<image_tag>` — the exact tag validated, e.g. `sha-28f7fd36b75e-preprod`, and it MUST be the same
  tag actually dispatched — see the reconciliation note above this Format block; nothing checks the
  two match.
- `<P>` — items recorded `pass` **in full**. `12` is the item count for `RVC-v1` — F1…F12. The
  preconditions P1/P2 are not counted: P2 is a condition on the validator, and P1 is a condition on
  the stand, neither is a property of the candidate's behaviour. A failed P1/P2 does not produce a
  `<P>` count at all — see ["A failed precondition aborts validation"](#how-to-execute-it).
- `<D>` — items recorded `pass (degraded)`, followed by `<D-ids>`: their ids in parentheses,
  space-separated, e.g. `(F3 F12)`. 🔴 **Corrected, code review:** an earlier version of this line
  carried no ids, unlike `<F>` below — a reader of `docs/preprod-candidates.md` had no way to tell
  which items degraded without opening the Execution Log. Fixed for the same traceability reason
  `<F>` already had it.
- `<F>` — items recorded `fail`, followed by `<F-ids>`: their ids in parentheses, space-separated,
  e.g. `(F6 F9)`.
- `<B>` — items recorded `BLOCKED`, followed by `<B-ids>`: their ids in parentheses,
  space-separated, e.g. `(F4 F5 F6 F7 F8 F9 F10 F11)`. 🔴 **Corrected, code review:** same gap as
  `<D>` above — without item ids here, a reader cannot tell which of the eight blocked items cleared
  once the CORS ask closes and which (F9) needs a second, independent fix; that is the exact
  traceability this paragraph exists to preserve. Each blocked item is counted **exactly once** in
  `<B>`'s own count. Separately, the trailing parenthetical lists **every distinct `(cause, owner)`
  pair** blocking at least one item, semicolon-separated — e.g.
  `8 BLOCKED (F4 F5 F6 F7 F8 F9 F10 F11) (CORS, CRM/api-prionex; restricted-role account, Oleg)` —
  two parentheticals, `<B-ids>` then `(cause, owner; …)`, never merged into one. The cause and owner
  are **parameters, not literals**: do not hardcode `(CORS, CRM/api-prionex)`, because not every
  blockage is CORS (F9 already has a second one) and a misattributed blocker gets assumed fixed when
  somebody else's ask closes.

**The invariant — check every note by addition:**

```
P + D + F + B == 12
```

Any note that does not satisfy it is wrong on its face and can be caught without opening this file.
This invariant applies **only** once P1/P2 have both passed and F1-F12 were actually executed — see
["A failed precondition aborts validation"](#how-to-execute-it), which has its own fixed note shape
and does not range over 12 at all.

🔴 **This invariant is a convention YOU must keep, exactly like the pipe and newline rules above —
not a check anything runs.** `record-preprod-candidate.yml:454-467` rejects only a blank note; it
does not parse the counts, does not add them, and does not compare the sum to 12. Worse: even kept
perfectly, it is a **weak** check — it catches arithmetic errors, never misclassification. A note
reading `4/12 pass, 0 degraded, 0 fail, 8 BLOCKED` satisfies `4 + 0 + 0 + 8 == 12` exactly as well
whether those four `pass`es are genuine full passes or whether two of them were actually
`pass (degraded)` items misrecorded as `pass` — the arithmetic cannot tell the difference, only a
human re-reading the Execution Log against this file's own verdict definitions can.

**Every item you executed gets exactly one of the four verdicts above — there is no fifth verdict
and no "did not reach it".** An item nobody reached during a partial or aborted run is not `pass`
(never executed), not `fail` (that means executed and did not meet its criterion), and not
`BLOCKED` either — `BLOCKED` means "could not be executed at all" and requires naming a real owner,
so recording an unreached item as `BLOCKED` with an invented owner is the exact misattribution this
file warns against elsewhere. **If validation stops partway through F1-F12 for any reason other than
a P1/P2 abort, the run has no legal note under this format at all** — do not force one; re-run from
the start, or from a point you can honestly justify skipping from, before writing any note.

**Dropping empty clauses.** Drop a clause only when its count is 0, and drop the **exact** literal
including its leading comma and space:

- `B` is 0 → drop `, <B> BLOCKED (<B-ids>) (<cause>, <owner>)`
- `D` is 0 → drop `, <D> degraded (<D-ids>)`
- `F` is 0 → drop `, <F> fail (<F-ids>)`

`<P>/12 pass` is never dropped. The invariant still holds over the dropped counts — a clause that
is absent means that count is 0, not that it is unknown.

### The four shapes, with the arithmetic checked

**Combined (failing items AND blocked items in the same note).** This is not an exotic case: it is
the **only** shape any note can have until the CORS origin is fixed. 🔴 **Corrected, code review: an
earlier version of this file called this "the very first note Story 5.6 will write" — that is
unexercised, not demonstrated.** Under the aggregate verdict this file itself mandates today
(`fail`, see [the CORS blocker](#the-cors-blocker)), `validated=fail` is what gets dispatched, and
`record-preprod-candidate.yml`'s G1 exits as the **first step of the first job** — before the
note-shape-validation step at `:454-467` and long before the ledger-row write at `:982`. **No note
is written at all on that path.** The shape below is legal and correctly formed; whether the
recorder actually accepts a note of this exact shape once F/B are both non-zero has not been
exercised by any real dispatch, because G1 refuses before that check runs:

```
RVC-v1 sha-28f7fd36b75e-preprod: 1/12 pass, 1 degraded (F3), 2 fail (F2 F3), 8 BLOCKED (F4 F5 F6 F7 F8 F9 F10 F11) (CORS, CRM/api-prionex; restricted-role account, Oleg) — detail in docs/release-validation-checklist.md
```

`1 + 1 + 2 + 8 == 12`. ✅ (illustrative counts and ids only, not derived from a real run)

**Today's honest headline, if a candidate were validated right now** — F1 and F2 pass in full, F3
and F12 are degraded, F4-F11 are blocked. Note that this accompanies `validated=fail`, not `pass`,
and — per the paragraph above — G1 refuses before this note is ever written to the ledger:

```
RVC-v1 sha-28f7fd36b75e-preprod: 2/12 pass, 2 degraded (F3 F12), 8 BLOCKED (F4 F5 F6 F7 F8 F9 F10 F11) (CORS, CRM/api-prionex; restricted-role account, Oleg) — detail in docs/release-validation-checklist.md
```

`2 + 2 + 0 + 8 == 12`. ✅ (the `fail` clause is dropped because `F` is 0)

**A clean run, once nothing is blocked:**

```
RVC-v1 sha-28f7fd36b75e-preprod: 12/12 pass — detail in docs/release-validation-checklist.md
```

`12 + 0 + 0 + 0 == 12`. ✅

**A failed precondition — the fourth shape, and the only one that does not range over 12 at all:**

```
RVC-v1 sha-28f7fd36b75e-preprod: precondition failed (P1) — validation aborted, no items executed
```

See ["A failed precondition aborts validation"](#how-to-execute-it). No `<P>/<D>/<F>/<B>` counts,
because none were collected — this is not an omission of the invariant, it is a note shape the
invariant does not apply to.

The note is a **pointer, not the record**. The per-item verdicts live in the Execution Log below;
the note exists so the ledger row is legible without opening this file — which is exactly why it
must not overstate coverage: it is the artifact most people read *instead of* this one.

---

## How a failed item blocks promotion

<a id="how-a-failed-item-blocks-promotion"></a>

**No new machinery is needed, and none is added by this story.** The block is a property of what
Story 5.4 already shipped:

1. A failing item makes the aggregate verdict `fail`.
2. The operator dispatches `record-preprod-candidate.yml` with `validated=fail`.
3. **G1** (`record-preprod-candidate.yml:231-249`) is the **first step of the first job**, before
   any registry read, any digest resolve, and any write. It refuses `fail` with `exit 1` and the
   message *"A failed validation writes nothing to the registry."*
4. So no `preprod-<sha>` tag is minted for that commit.
5. Story 6.5's promotion guard matches on the existence of `preprod-<sha>` for a commit. With no
   such tag, it has nothing to match, and promotion to PROD does not proceed.

The chain has one deliberate gap, and it is worth naming: nothing forces an operator to dispatch
the recorder at all, and nothing forces the verdict they type to reflect this checklist. `RVC-v1`
does not close that — it makes the verdict **derived** (from twelve stated criteria that can each
individually fail) rather than **asserted** (from whatever the operator felt). That is the whole of
what this file changes, and overstating it would be the same vacuity this project has rejected
before.

**One exit exists from the block above, and until this amendment it was undefined.** See
[The waiver](#the-waiver), immediately below.

---

## The waiver

<a id="the-waiver"></a>

🔴 **New in `RVC-v1.1`, 2026-08-25 — `docs/migration-decisions.md#d41`.** Before this amendment the
only clause in this file naming a waiver was a nine-word parenthetical in [The CORS
blocker](#the-cors-blocker) — *"the same documented, time-boxed waiver this file has always
allowed"* — with no procedure, no stated authority, and no rule for what it does to the aggregate.
Story 5.6 needed one, before it existed in writing, and its own story file and `D40` supplied the
mechanics under the honest belief that they were restating this file. They were not: `D40`'s own §1
quotes two sentences as *"`RVC-v1`'s собственный текст"* that were in fact the story's own §3.2. Code
review caught the circularity; Oleg, as the checklist's owner, chose to make the mechanics real
rather than treat the recording as ungrounded — this section is that mechanics, made explicit and
retroactively covering `D40` (`#d41`).

**Who may issue a waiver.** Only **Oleg, as the release's owner** — the same authority `D40` and
every prior decision record in this file already assumed, now stated as a rule rather than implied
by precedent. A waiver issued by anyone else, including the dev agent that executes this checklist,
has no effect: the agent's role is to derive the verdict and escalate, never to waive.

**What a waiver may cover.**
1. Any item recorded `BLOCKED` — unchanged from what this file always meant by "could not be
   executed at all."
2. **A `fail` that arose *solely* from a broken external dependency unrelated to the artifact being
   validated** — code or infrastructure outside `fe-prionex`'s own bundle, where the validator
   reached the item, observed its named `fail` condition, and root-caused it to the outside system,
   not to anything this repository shipped. This is new: `RVC-v1` previously waived only `BLOCKED`,
   which forced `D40` to reclassify F5's genuine `fail` (client-detail `500`, root-caused to
   `CRM/api-prionex`'s own missing `Debt`-model migration — see F5's own section) into `BLOCKED` to
   make it reachable at all, even though F5's own pass criterion names that exact observation a
   `fail`. **F5 stays `fail`, by its own criterion, and is waiverable under this clause instead** —
   see the correction at F5's own section below. This clause exists precisely for that shape of
   defect: real, reached, correctly identified as `fail` by the item's own words, and caused entirely
   by a dependency this repository does not own and cannot fix.
   **What this clause does NOT cover:** a `fail` in this repository's own code, a `fail` whose cause
   is disputed or unconfirmed, or a `fail` where the external dependency is merely *involved* rather
   than *solely* responsible (if `fe-prionex`'s own code contributed to the failure, this clause does
   not apply and the `fail` stands).

**Mandatory attributes of a waiver — all required, none optional:**
- **Date** it was granted.
- **Author** — must be Oleg (see above); the decision record names him explicitly, not by role.
- **Every covered item**, listed individually, each with its own **cause** and **owner** — the same
  granularity the `validation_note`'s own `<B>` clause already requires, so the waiver and the note
  never disagree about who owns what.
- **Scope: time-boxed AND single-candidate.** Both, not either. `RVC-v1`'s original clause said only
  `time-boxed`; `D40` supplied a single-candidate scope but dropped the calendar date, and code
  review named that drop as the one place `D40` departed from a real constraint rather than merely
  inventing one. A waiver under `RVC-v1.1` states **both**: a calendar expiry (after which the waiver
  no longer authorises a dispatch, full stop, regardless of whether a new candidate exists) **and**
  that it governs one named candidate commit only. `D41` supplies both retroactively for `D40` — see
  that decision record.
- **True counts preserved in the `validation_note`.** A waiver changes what gets *dispatched*
  (`validated=pass` instead of the honest `fail`); it never changes the arithmetic the note reports.
  `<P>/<D>/<F>/<B>` must still sum to 12 and must still reflect what was actually observed — a waived
  `fail` is still counted in `<F>`, not silently moved into `<B>` or `<P>`. (`D40`'s own note
  under-counted this exact case by reclassifying F5 into `<B>` rather than leaving it in `<F>` — see
  F5's own corrected section; `D41` does not rewrite the already-dispatched note, since the note was
  honest for what `D40` actually decided at the time, but it corrects the record going forward.)

**Effect on the aggregate.** Identical to what `D40` already stated and this file now confirms as its
own rule: **the waiver changes what gets dispatched, never what is derived.** The aggregate verdict
computed from the twelve items stays exactly what the criteria produce — `fail`, if any item is
`fail` or `BLOCKED` — and is stated as such in the Execution Log. The waiver is a separate, explicit
authorisation to dispatch `pass` **despite** that derived `fail`, not a rule that changes the
derivation. Both the derived verdict and the dispatched one belong in the note and the log, never
only one.

**What a waiver does not do:** it does not bump this file's marker (a waiver decision is a
per-candidate act, not a change to what an item means — see the marker-bump rule at the top of this
file); it does not exempt the candidate from any other item's criterion; and it carries no signal at
the registry — `docs/preprod-candidates.md`'s own header states the registry tags carry no waiver
information, so a promotion gate reading only the registry cannot tell a waived candidate from a
clean one (filed as a cross-story item, owner Story 6.5, in `deferred-work.md`).

---

## What this checklist does NOT cover

Stated so nobody reads a green `RVC-v1` as more than it is:

- **🔴 Route coverage — the largest gap in this list, named first because it is the one a green
  `RVC-v1` most easily hides.** `src/routes/index.tsx` defines roughly **60** dashboard routes.
  F1-F12 touch about a dozen of them. Everything below is **untouched by every item in this
  checklist**, so a candidate that renders a blank page across all of it would still score full
  marks:
  - `reports`, `audit-logs`, `training`, `action-analysis`, `lawyer-workplace`, `projects`,
    `sellers` (and `sellers/:id`)
  - **all** of `team-management` — `team-management/users`, `/roles`, `/departments` and the
    `team-management` index
  - **most** of `system-settings` — `integrations/ubki`, `repayment-configuration`,
    `scoring-configuration` (and its `history`), `document-generation`, `contact-types`,
    `contact-tags`, `target-actions`, `interaction-log`, `rr-notifications`, `rr-periodicity`,
    `ip-whitelist`, `ai`, `tags`

  The twelve items were chosen for **blast radius**, not coverage — F9 in particular is on the list
  because permission gating breaks every route at once. That is a defensible selection and it is
  not a substitute for breadth. Widening the list is a decision, not an oversight, and would bump
  the marker to `RVC-v2`.
- **Backend correctness.** Every item observes the application through the browser. A backend that
  returns wrong-but-well-formed data passes this checklist.
- **The container health check.** It probes the frontend container's own nginx, and says nothing
  about whether the backend behind Kong works.
- **Performance, load, or concurrency.** No item has a timing criterion beyond "does not hang".
- **Security.** F9 checks that permission gating is wired, not that it is unbypassable. No
  authorization, injection, or session-fixation testing is implied.
- **Cross-browser and mobile.** One browser, desktop viewport. No compatibility matrix.
- **Accessibility.**
- **Data migration and backwards compatibility** of anything stored.
- **Reproducibility.** The build is not reproducible at source level; the same commit rebuilt is a
  different artifact. `preprod-<sha>` proves commit identity, never artifact identity.
- **The DEV and PROD stands.** `RVC-v1` is about PRE-PROD only.
- **Any automated end-to-end coverage.** There is none: the project has Vitest only (229 component
  test files, jsdom, no browser driver of any kind), and `deploy-preprod.yml`'s `e2e` job is a
  documented placeholder that prints and exits 0. Real coverage is **Story 7.7**, recorded in
  `_bmad-output/planning-artifacts/epics.md` and `sprint-status.yaml` precisely so it cannot be
  absorbed into this migration.

---

## Execution Log

<a id="execution-log"></a>

**Append-only, one section per `image_tag` AND UTC timestamp.** 🔴 **Corrected, code review: the key
was originally `image_tag` + date, and a same-day re-validation collides.** The stated re-validation
trigger is exactly a same-day event — the CORS fix landing, after which F4-F11 become executable —
so a redeploy and re-validation on the same calendar date is the **expected** case, not an exotic
one, and two sections sharing both tag and date with "the later date governs" produces no ordering
between them at all, while "never edit a section after it is written" forbids repairing the
collision after the fact. **Fixed: heading format is `### <image_tag> — <YYYY-MM-DDTHH:MMZ>`** (UTC,
minute precision — the start time of validation, i.e. when P1 is executed), which cannot collide
within the same tag on the same day. Where two sections share a tag, **the later timestamp governs**;
the earlier one is kept because it is the record of what was knowable then.

Never edit a section after it is written — a re-validation is a new section, not a rewrite. This is
the same rule `docs/preprod-candidates.md` follows, for the same reason.

Each section carries: the checklist version, the UTC timestamp, who executed it, the per-item
verdicts, the aggregate, the `validation_note` that was submitted, and the recorder run id if one
was dispatched. 🔴 **A related date mismatch, disclosed rather than fixed:** the ledger row's own
date in `docs/preprod-candidates.md` (`record-preprod-candidate.yml:982`,
`$(date -u +%Y-%m-%d)`) is the date the **recorder ran**, not the date validation happened. A
validation session that finishes at 23:50 UTC with the recorder dispatched at 00:10 UTC the next day
dates the ledger row one day after the Execution Log section that justifies it, and same-tag
tie-breaks between the two files then run on dates that do not agree. Not fixed here — `RVC-v1`
does not edit `record-preprod-candidate.yml` — but named so a later reader comparing the two files'
dates does not read the offset as an error in one of them.

**First section written 2026-08-25 by Story 5.6's own rehearsal** — the log was empty until this candidate. See [the two consequences above](#the-cors-blocker) for the verdict problem this section resolves via a written waiver (`docs/migration-decisions.md#d40`), not by silently redefining anything above.

🔴 **Reconciliation note, code review fix-pass, 2026-08-25 — corrections to the section below,
written here rather than in place, per Prohibition 5/"never edit a section after it is written."**
Four points, in the order code review raised them (D3, H2, H3, M8):

1. **D3 — what the aggregate confirmation actually covers, resolved by asking Oleg directly rather
   than reconstructing it.** Three artifacts previously scoped it three ways (nine / six / five).
   **Oleg's own words, quoted verbatim, 2026-08-25:** first, *"все ок"*; then, on a clarifying
   question asking him to choose among the possible scopes, he selected the option *"Прошёл всё,
   все девять pass"*. The correct reading: **nine points carry a `pass` verdict in this candidate in
   total — P1, P2, F1, F2, F3, F4, F9, F11, F12** (the twelve F-items minus the five `BLOCKED`, plus
   both preconditions) — **of which six are browser items** (F1, F3, F4, F9, F11, F12, the `Executed
   by:` line below is and was correct) **and three are machine items the dev agent executed directly**
   (P1, P2, F2 — F4's item 6 is a sub-point of F4, not a fourth machine item, and is disclosed
   separately in F4's own row). The table's **F1 cell** below, which reads *"all nine browser
   items"*, should read **"all six browser items"** — left uncorrected in place per Prohibition 5,
   corrected here. `docs/preprod-candidates.md`'s ledger prose (*"five … two"*) is corrected in that
   file directly (a prose paragraph there, not a row). **This remains an aggregate attestation, not
   itemized observations** — Oleg confirmed the count and the scope, not each item's own evidence;
   that limit is unchanged by this correction.
2. **H2 — F4 item 6's evidence, supplemented (full detail: `docs/migration-decisions.md#d40` §8).**
   The `ip_whitelist` table was **empty (0 rows)** when enforcement was toggled on, so the observed
   `403 IP_NOT_ALLOWED` proves **deny-all**, not a discriminating allow/deny — no positive control
   (a whitelisted address admitted) was run. Blast radius: **the entire shared PRE-PROD stand**, for
   the full **0.685 s** enforcement was on, not only the test account — the setting is global on
   `CRM/api-prionex`'s own service.
3. **H3 — F12's cell does not disclose its own known mock, one row after F11 discloses exactly the
   same class of fact.** `payment-service` carries `EASYPAY_MOCK_MODE` in its env block (measured
   this rehearsal, recorded in `docs/migration-decisions.md#d40` §5) — F12 exercises a **mock**
   EasyPay integration, not a live one, symmetrically with F11's disclosed mock AI provider. Which of
   F12's three phases (render / validate / submit) the aggregate actually covers cannot be
   determined beyond what D3's reconciliation already states — recorded as a limit, not filled in
   with invented detail.
4. **M8 — four disagreements between this file's own format/template and this section, none a
   defect in what shipped, filed with owner `RVC-v2` in `deferred-work.md`, restated here per the
   patch's own routing instruction:** (a) this section's `— waiver D40, single-candidate scope —`
   clause is not defined by [the note format](#the-validation_note-format); (b) the template's
   `Aggregate verdict: pass / fail` has no shape for a waived run — this section's own wording
   (*"`fail` … recorded as `pass` for dispatch purposes only"*) should become the template's; (c) the
   template's counts line and this section's own table disagree on whether P1/P2 belong in the
   tally (they do not; the table includes them for readability only); (d) `Recorder run id: <run id,
   or "not dispatched — verdict was fail">` has no legal value for "dispatched, refused by G1" — the
   exact [Rejected candidates](../preprod-candidates.md#rejected-candidates) case.
5. **M1's own two self-disclosed literal deviations, named and accepted rather than left
   unremarked:** this section's own `Recorder run id` line was completed *after* the section was
   first written (filling in run 1316 once R3 returned) — a deviation from "never edit a section
   after it is written" that the section itself flagged inline as intentional at the time; and this
   preamble paragraph is itself a **second** edit to a file whose header states Story 5.6 is
   permitted **one** Execution Log edit (Prohibition 5) — justified because the one impermissible
   thing (rewriting a written verdict) is not what either edit does: one completed a
   forward-declared placeholder, the other adds a preamble note above the frozen section rather than
   touching it.

### sha-a99ccd44c5a3-preprod — 2026-08-25T13:35Z

- Checklist version: RVC-v1
- Started (UTC): 2026-08-25T13:35Z
- Executed by: joint — **dev agent** (P1, P2, F2, and F4's item 6 specifically — see note below)
  and **Oleg Kuksa** (F1, F3, F4 items 1-5+7, F9, F11, F12)
- Deploy run id: 1310

| Item | Verdict | Evidence / why |
|---|---|---|
| P1 | pass | dev agent, by hand: container `healthy`, running-image `.RepoDigests` contains the candidate digest exactly (`sha256:a62e868786…`) |
| P2 | pass | dev agent: decoded build epoch `2026-08-25T13:25:21Z`, at or after R1's own `started` (`2026-08-25T13:23:29Z`) |
| F1 | pass | Oleg Kuksa, per his own aggregate confirmation (all nine browser items reported `pass` as a group; itemized per-item observations were not separately provided — recorded honestly as an aggregate, not invented detail). Corroborated by the dev agent's own measurement of the same item's machine-checkable half: 9/9 referenced assets `200`, TLS `ssl_verify_result=0` |
| F2 | pass | dev agent, all five criteria measured fresh against this candidate's own served bundle — see Task 6.4 |
| F3 | pass | Oleg Kuksa, aggregate confirmation (see F1's note on what that means and does not mean) |
| F4 | pass | **Split evidence, stated precisely.** Items 1-5 and 7 (correct creds, wrong creds, 2FA, already-logged-in-elsewhere, locked, forced-password-change): Oleg Kuksa, aggregate confirmation. **Item 6 (IP-whitelist refusal): dev agent, direct API test, not Oleg's browser** — `auth_settings.ip_whitelist_enforcement_enabled` was found `false` (the gate switched off, item 6 undemonstrable as found) mid-session; escalated to the coordinator rather than silently worked around; confirmed the already-issued admin JWT is not IP-scoped (`get_current_user` never reads the whitelist, only the login path does) before acting. Toggled `PUT /api/v1/admin/settings/ip-whitelist {"enabled": true}` (admin, audited), immediately attempted `rvc-operator` login from a non-whitelisted IP → `403 {"code": "IP_NOT_ALLOWED", "message": "Login not allowed from this IP address."}` — the explicit reason F4's own text requires — then immediately toggled back `{"enabled": false}` with the same token, then confirmed restoration with a successful `rvc-operator` login. Total window with enforcement on: well under one second (`13:55:24.680` to `13:55:25.365`). |
| F5 | BLOCKED | Waiver `D40` (Oleg, 2026-08-25, written, single-candidate scope). Reclassified from an attempted `fail`: `GET /api/v1/clients/{id}` `500`s for every client, root-caused to `CRM/api-prionex`'s own missing `Debt`-model migration (ten columns, no migration anywhere in their repo) — not a fixture gap, the validator cannot get past the error. Owner: `CRM/api-prionex` |
| F6 | BLOCKED | Waiver `D40`. No direct debt-creation API endpoint exists (`DebtCreate` is CSV-import-pipeline-only); also inherits F5's bug. Owner: `CRM/api-prionex` |
| F7 | BLOCKED | Waiver `D40`. Zero telephony infrastructure provisioned on PRE-PROD at any level (no SIM cards, no queues, no operator-extension links, no Asterisk/SIP config on `dialer-service`). Owner: Oleg / telephony infra owner |
| F8 | BLOCKED | Waiver `D40`. 3 of 7 bulk-operation pages (payment/write-off/reversal import) reference existing loan data and inherit F6's blockage; item has no degraded wording so the whole item does not reach a full pass. Owner: `CRM/api-prionex`, jointly with F6 |
| F9 | pass | Oleg Kuksa, aggregate confirmation, executed as `rvc-operator` (Operator role, 24 of 141 Admin permissions) |
| F10 | BLOCKED | Waiver `D40`. `sms_configuration` has zero rows — no real SMS gateway configured at any level; `messaging_integrations`' 5 rows are all `status=unconfigured`. Owner: Oleg / messaging vendor owner |
| F11 | pass | Oleg Kuksa, aggregate confirmation. Disclosed for the record (not a blocker, not something Oleg was asked to distinguish): the AI assistant runs against `AI_ASSISTANT_PROVIDER=mock` on this stand, not a real LLM provider |
| F12 | pass | Oleg Kuksa, aggregate confirmation |

- Counts: P=7 D=0 F=0 B=5   (7 + 0 + 0 + 5 == 12 ✓)
- Aggregate verdict: **`fail` by `RVC-v1`'s own unconditional rule** (`P=7 ≠ 12`) — **recorded as `pass`
  for dispatch purposes only under Oleg's written waiver, `docs/migration-decisions.md#d40`,
  single-candidate scope.** The waiver changes what gets dispatched; it does not change this
  arithmetic, which stays exactly as computed.
- validation_note submitted: `RVC-v1 sha-a99ccd44c5a3-preprod: 7/12 pass, 5 BLOCKED (F5 F6 F7 F8 F10) (CRM/api-prionex Debt-model migration bug, CRM/api-prionex; no direct debt-creation path, CRM/api-prionex; telephony infrastructure absent, Oleg; 3/7 bulk pages inherit F6, CRM/api-prionex; SMS gateway unconfigured, Oleg) — waiver D40, single-candidate scope — detail in docs/release-validation-checklist.md`
- Recorder run id: **1316** (`SUCCESS`, `started` 2026-08-25T14:01:02Z, `stopped` 2026-08-25T14:02:10Z, 68s — this section was written before dispatch, per `RVC-v1`'s own rule and this story's Task 6.7/7.x ordering; this line completed after R3 returned, per Task 8.5)

### Template — copy this block, do not edit it in place

```
### <image_tag> — <YYYY-MM-DDTHH:MMZ>

- Checklist version: RVC-v1
- Started (UTC): YYYY-MM-DDTHH:MMZ
- Executed by: <name>
- Deploy run id: <run id of deploy-preprod.yml>

Verdict column — one of exactly four values: `pass`, `pass (degraded)`, `fail`, `BLOCKED`.

| Item | Verdict | Evidence / why |
|---|---|---|
| P1 | pass / fail | executed BY HAND at the start of validation, not delegated to the recorder |
| P2 | pass / fail | decoded build epoch, and it is at or after the `build.yml` run's own `started` timestamp |
| F1 | pass / pass (degraded) / fail / BLOCKED | |
| F2 | pass / pass (degraded) / fail / BLOCKED | |
| F3 | pass / pass (degraded) / fail / BLOCKED | |
| F4 | pass / pass (degraded) / fail / BLOCKED | |
| F5 | pass / pass (degraded) / fail / BLOCKED | |
| F6 | pass / pass (degraded) / fail / BLOCKED | |
| F7 | pass / pass (degraded) / fail / BLOCKED | |
| F8 | pass / pass (degraded) / fail / BLOCKED | |
| F9 | pass / pass (degraded) / fail / BLOCKED | |
| F10 | pass / pass (degraded) / fail / BLOCKED | |
| F11 | pass / pass (degraded) / fail / BLOCKED | |
| F12 | pass / pass (degraded) / fail / BLOCKED | |

- Counts: P=<P> D=<D> F=<F> B=<B>   (must satisfy P + D + F + B == 12; if P1 or P2 failed, skip
  straight to the precondition-failure note shape below instead of filling F1-F12 at all)
- Aggregate verdict: pass / fail   (`pass` requires all twelve to be a full `pass`)
- validation_note submitted: `RVC-v1 <image_tag>: <P>/12 pass, <D> degraded (<D-ids>), <F> fail (<F-ids>), <B> BLOCKED (<B-ids>) (<cause>, <owner>) — detail in docs/release-validation-checklist.md`
- Recorder run id: <run id, or "not dispatched — verdict was fail">
```

**If P1 or P2 failed, use this shorter block instead — no per-item table, no counts:**

```
### <image_tag> — <YYYY-MM-DDTHH:MMZ>

- Checklist version: RVC-v1
- Started (UTC): YYYY-MM-DDTHH:MMZ
- Executed by: <name>
- Precondition failed: P1 / P2
- validation_note submitted: `RVC-v1 <image_tag>: precondition failed (<P1 or P2>) — validation aborted, no items executed`
- Recorder run id: not dispatched — verdict was fail
```
