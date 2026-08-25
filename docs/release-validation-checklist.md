# PRE-PROD Release Validation Checklist — `RVC-v1`

**Version marker: `RVC-v1`.** Quote this marker in every `validation_note`. When any item's text,
id, or pass criterion changes in a way that alters what "validated" asserts, the marker becomes
`RVC-v2` and the old marker keeps meaning what it meant — rows already written are never
reinterpreted.

**What does NOT bump the marker: a change in what is *executable*.** When `CRM/api-prionex` fixes
the CORS origin, F4-F11 become executable with **not one criterion changed** — the criteria are
exactly what `RVC-v1` names, and they named the same thing before and after. So that day does not
produce `RVC-v2`. The difference between a candidate validated before it and one validated after is
carried entirely by the `<B>` (blocked) and `<D>` (degraded) counts in the
[`validation_note`](#the-validation_note-format), which is why those counts are mandatory rather
than decorative: without them a `2/12` candidate and a `12/12` candidate would both cite `RVC-v1`
while asserting very different coverage. Only a change to an item's **text, id, or pass criterion**
bumps the marker.

**Established by Story 5.5, 2026-08-24.** The plan sentence this executes is
`docs/forgejo-migration.md:231` ("Место под E2E: job `e2e` после healthcheck … на первом этапе —
заглушка + чек-лист ручной валидации критичных флоу"); the decision record is
`docs/migration-decisions.md#d39`.

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

**Execute P1 by hand before starting F1** — see [P1](#p1) for why it cannot be delegated to the
recorder.

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
  as a Unix epoch in milliseconds, and require it to be **at or after** the candidate image's own
  build time. That is a criterion that can actually fail — a cached bundle from a previous deploy
  decodes to an *earlier* epoch, and that is exactly the situation P2 exists to catch.
- **Executability:** `EXECUTABLE` (it is F2 criterion 4, run once at the start).

---

## The critical flows

Each item: what is checked, what constitutes a pass, and whether it can be executed today.

Executability values used below:

| Value | Meaning |
|---|---|
| `EXECUTABLE` | Can be executed today, end to end, as written. |
| `EXECUTABLE, degraded` | The part that does not touch the API can be executed today; the API-touching part cannot. Its best legal verdict is **`pass (degraded)`**, never `pass`, and the log entry must carry the words the item's own text requires. |
| `BLOCKED — owner: CRM/api-prionex, CORS origin` | Cannot be executed at all today. See [The CORS blocker](#the-cors-blocker). |
| `BLOCKED — owners: CRM/api-prionex (CORS origin) AND Oleg (no restricted-role account)` | Used by F9 only. Two independent blockages; fixing either one alone does not make the item executable. |

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
     last three digits dropped — and require the result to be **at or after** the build time of the
     candidate image (the `build.yml` run that produced `image_tag`). A value **older** than the
     candidate's build means you are looking at a cached or stale bundle, which is exactly what P2
     exists to catch.
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

#### F2's discriminators were measured, and were proven able to fail

🔴 Stated here because this project has rejected checks that could not fail, and F2's criteria 2-4
are **negative** assertions — the kind most likely to be vacuous. They were measured, not assumed.

The real bundle was built twice with `npx vite build` (vite 6.4.2, node 22.23.1) on 2026-08-24 and
`assets/` was grepped:

| Build | `localhost:8000` | `localhost:8005` | literal `VITE_BUILD_TS` | `import.meta.env` | `api.crm.preprod.crm-prionex.online` |
|---|---|---|---|---|---|
| `VITE_API_BASE_URL` + `VITE_WS_URL` both set to the PRE-PROD values | 0 files | 0 files | 0 files | 0 files | 3 files |
| **Negative control** — same build, `VITE_WS_URL` unset | **1 file** | **2 files** | — | — | — |

Two conclusions:

1. **esbuild's constant-folding of the `!== undefined ? … : …` guard is confirmed on this
   toolchain.** A correctly configured build genuinely carries zero occurrences of either fallback,
   so criteria 2-3 are valid — and the negative control proves they are **falsifiable**: unset one
   variable and the strings reappear. This is a discriminator that was demonstrated able to fail,
   not one assumed to work.
2. **Any instruction to search the bundle for the identifier `VITE_BUILD_TS` is unexecutable** —
   0 hits on a correct build, because of the `define` substitution above. Hence criterion 4's
   rewrite to the decodable epoch. The measured example value was `"1787604128392"`.

The same facts are recorded in `docs/migration-decisions.md#d39` §9, which is where this project
keeps measured platform facts.

### F3 — Unauthenticated route guard

- **What is checked:** with no session, a protected URL does not render protected content.
- **How to check it:** open a private/incognito window, go directly to
  `https://crm.preprod.crm-prionex.online/dashboard`.
- **What constitutes a pass:** the browser lands on `/login`. No dashboard chrome, no client data,
  and no flash of protected content before the redirect.
- **Executability:** `EXECUTABLE, degraded`. The redirect itself is decided in the browser from the
  absence of a stored session, so it runs today. The *other* half of the same guard — that a
  **stale or revoked** token is rejected by the backend on `401` and forces the same redirect —
  requires an API call and is `BLOCKED`. The best verdict F3 can legally carry today is therefore
  **`pass (degraded)`**, counted in `<D>` and never in `<P>`, and only with the words
  "guard-only, 401 path not exercised" in the log entry.

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
- **Executability:** `BLOCKED — owner: CRM/api-prionex, CORS origin`.

### F5 — Client list → client detail

- **What is checked:** `/dashboard` lists clients; opening one navigates to its detail page and the
  page's tabs (debt summary, activity, payment history) each load their own data.
- **What constitutes a pass:** the list renders with real rows and its paging/search return
  results consistent with the query; a client opens; each tab shows data or an explicit empty
  state. A tab that spins forever, or that renders an error where the list showed rows, is a
  `fail`.
- **Executability:** `BLOCKED — owner: CRM/api-prionex, CORS origin`.

### F6 — Payments on a client: record, edit, cancel, verify, receipt

- **What is checked:** recording a payment against a client; editing it; cancelling it; the
  verification queue reflecting each of those; and generating the PDF receipt.
- **What constitutes a pass:** each of the five actions completes and its result is visible after a
  page reload (i.e. it was persisted, not merely rendered optimistically); the verification queue
  shows the item in the state the action should have produced; the receipt downloads as a PDF that
  opens and carries the payment's own amount and client.
- **Executability:** `BLOCKED — owner: CRM/api-prionex, CORS origin`.

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
- **Executability:** `BLOCKED — owner: CRM/api-prionex, CORS origin`.

### F8 — Client import and the bulk operations

- **What is checked:** `/dashboard/import/clients` accepts a file and reports a result; the import
  history lists that run and its detail page opens; and each of the seven bulk operations pages
  (operator assignment, tag assignment, payment import, write-off import, reversal import, sale
  notes import, document import) accepts input and reports a per-row outcome.
- **What constitutes a pass:** the import reports counts that match the file submitted (including
  its rejected rows — an import that reports "0 errors" on a file with a deliberately malformed row
  is a `fail`); the run appears in history with the same counts; each bulk page reports success and
  failure per row rather than a single aggregate "done".
- **Executability:** `BLOCKED — owner: CRM/api-prionex, CORS origin`.

### F9 — Permission gating

- **What is checked:** that a role with the wrong permission set does not merely lose a menu item —
  it must lose the **route**. 🔴 An earlier draft of this file said "every dashboard route is
  wrapped in a permission check". That is **false**, and a validator following F9's own instruction
  (log in restricted, type URLs directly) would have recorded a `fail` on a healthy candidate
  because of it.
- **The known exception: `/dashboard/profile`.** `src/routes/index.tsx:277-279` renders
  `ProfileSettingsPage` **bare** — `{ path: 'profile', element: withSuspense(<ProfileSettingsPage />) }`
  — with no `PermissionRoute` wrapper, unlike every sibling route around it. So a restricted role
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
- **Executability:** `BLOCKED — owners: CRM/api-prionex (CORS origin) AND Oleg (no restricted-role
  account)`. 🔴 F9 has **two** blockages, and an earlier draft hid the second one inside the first.
  (a) The CORS origin, like F4-F11. (b) This checklist's own prerequisites require "an account with
  a restricted role — ask Oleg", and **no evidence exists that such an account is provisioned on
  PRE-PROD at all.** Fixing CORS alone will **not** unblock F9: without a restricted account there
  is nothing to log in as, and a permission test run from an unrestricted account tests nothing.
  Both owners must deliver. Stated explicitly so the dependency does not stay invisible inside
  somebody else's blocker and get assumed resolved when the CORS ask closes.

### F10 — Messaging and SMS campaigns

- **What is checked:** creating a messaging campaign, saving a draft and reopening it, the SMS
  templates page, and the messaging integrations settings page.
- **What constitutes a pass:** a campaign saves and reappears after a reload with its content
  intact; a draft round-trips unchanged; a template renders its placeholders; the integrations page
  reports each integration's real state rather than a blank list.
- **Executability:** `BLOCKED — owner: CRM/api-prionex, CORS origin`.

### F11 — AI assistant

- **What is checked:** `/dashboard/ai-assistant` — a chat message streams a response token by token
  (server-sent events, not one delayed block), dictation captures speech, and text-to-speech plays
  back.
- **What constitutes a pass:** the response visibly streams; an interrupted stream leaves the UI
  usable rather than stuck; dictation and TTS each produce their output or state plainly that the
  browser denied the permission.
- **Executability:** `BLOCKED — owner: CRM/api-prionex, CORS origin`.

### F12 — Public payment page `/pay`

- **What is checked:** `https://crm.preprod.crm-prionex.online/pay` — the **only** flow in this
  application with no authentication dependency — renders and can take a payment through EasyPay.
- **What constitutes a pass:** the page renders for a signed-out visitor in a private window
  (no redirect to `/login`), its form validates input, and a payment reaches EasyPay and returns a
  result the page displays.
- **Executability:** `EXECUTABLE, degraded` — but 🔴 **narrower than an earlier draft of this file
  claimed.** That draft said "the render-and-validate half runs today because it needs no call to
  our API". The *validate* step **is** a call to our own API:
  `src/features/easypay/api/easypayApi.ts:17,30` builds its axios client with
  `baseURL: API_BASE_URL`, imported from `src/lib/api.ts:4-7` — the same absolute
  `https://api.crm.preprod.crm-prionex.online` base as everything else — so credit validation is
  CORS-blocked exactly like the rest of the application. Only the **render** half executes today.
  Both **validate** and **submit** are blocked.
- **What you may record today:** `pass (degraded)`, counted in `<D>` and never in `<P>`, with the
  words **"render only; credit validation and payment submission both CORS-blocked"** in the log
  entry. A CORS failure on the validate step is **not** a `fail` (it is the known blockage) and it
  is emphatically **not** a `pass` — it is the reason the item is degraded. If the page renders and
  you then see the validate call fail, that is the expected outcome, and the verdict is still
  `pass (degraded)`; if the page does not render for a signed-out visitor, that **is** a `fail`.

---

## The CORS blocker

<a id="the-cors-blocker"></a>

PRE-PROD's Kong gateway returns an `Access-Control-Allow-Origin` naming an unrelated `localhost`
origin. A browser on `https://crm.preprod.crm-prionex.online` therefore refuses every response from
`https://api.crm.preprod.crm-prionex.online` before the application ever sees it.

- **Owner: `CRM/api-prionex`.** Kong belongs to the neighbouring backend repository. Nothing in
  `fe-prionex` can fix it, work around it, or route past it: the API base URL is an absolute URL
  baked into the bundle (F2), so the browser never traverses the frontend container's own proxy.
- **The ask is already open** with that team; it was measured from the real origin and recorded in
  Story 5.2 (`docs/migration-decisions.md#d36`) and re-stated by Story 5.4's ledger rows.
- **What it costs this checklist:** 8 of 12 items — F4 through F11 — cannot be executed at all, and
  two more (F3, F12) can only be executed on a reduced scope, i.e. `pass (degraded)`. Fully
  executable today: **F1 and F2 only**.
- **One of the eight would still be blocked if CORS were fixed tomorrow.** F9 additionally needs a
  restricted-role account on PRE-PROD, which nobody has shown exists. **Owner: Oleg.** See F9.

**Therefore, while the CORS origin is wrong, no candidate can legitimately be given an aggregate
verdict of `pass` under `RVC-v1`.** The rule below is not negotiable by an operator in a hurry:

> An aggregate verdict of `pass` requires **every** item to be `pass` — a full `pass`, not a
> `pass (degraded)` and not a `BLOCKED`. With 8 items blocked and 2 degraded, the aggregate verdict
> today is `fail`.

### Two consequences, stated rather than left to be discovered

1. **`docs/preprod-candidates.md`'s first two rows are marked `pass` and would not be, under
   `RVC-v1`.** Those rows are honest about their own scope — both say in their own note that
   browser-path validation was not performed and not possible — and they were written before this
   checklist existed. They are not rewritten: this ledger is append-only, and rows are never
   reinterpreted after the fact. `RVC-v1` governs candidates recorded from its publication onward.
2. **Story 5.6's rehearsal cannot record a `pass` under `RVC-v1` either, unless the CORS origin is
   fixed first.** 5.6's job is to exercise the full cycle through the workflows, and under this
   checklist the honest verdict is `fail` — which by design writes nothing. That is a real
   collision between two shipped requirements, and this file does not resolve it unilaterally.
   **Owner: Oleg**, as the scope decision for Story 5.6: either the CORS fix lands first, or 5.6
   records its rehearsal under an explicitly documented, explicitly time-boxed exception that names
   `RVC-v1` and lists which items were waived. Silently typing `pass` is the one option this file
   rules out.

---

<a id="the-validation_note-format"></a>

## The `validation_note` format

`record-preprod-candidate.yml` prints `validation_note` verbatim into a **single Markdown table
cell** of `docs/preprod-candidates.md` (`record-preprod-candidate.yml:982`).

**Two shape rules, and both are conventions YOU must keep — not guards the workflow applies.** The
workflow rejects only a blank or whitespace-only note (`record-preprod-candidate.yml:454-467`). It
does **not** reject a newline and it does **not** reject a pipe. So:

1. **No `|` anywhere in the note.** A pipe inside the cell shifts every column after `Note` in
   `docs/preprod-candidates.md` — the row silently renders wrong and the ledger's own format is
   broken by one keystroke.
2. **One line, no newline in it.** Same reason: the note is pasted into one table cell.

Nothing checks either rule. If you break one, the ledger is wrong and no run turns red.

**Format:**

```
RVC-v1 <image_tag>: <P>/12 pass, <D> degraded, <F> fail (<ids>), <B> BLOCKED (<cause>, <owner>) — detail in docs/release-validation-checklist.md
```

- `<image_tag>` — the exact tag validated, e.g. `sha-28f7fd36b75e-preprod`.
- `<P>` — items recorded `pass` **in full**. `12` is the item count for `RVC-v1` — F1…F12. The
  preconditions P1/P2 are not counted: P2 is a condition on the validator, and P1 is a condition on
  the stand, neither is a property of the candidate's behaviour.
- `<D>` — items recorded `pass (degraded)`.
- `<F>` — items recorded `fail`, followed by their ids in parentheses, space-separated: `(F6 F9)`.
- `<B>` — items recorded `BLOCKED`. Each blocked item is counted **exactly once**, and the
  parenthetical lists **every distinct `(cause, owner)` pair** blocking at least one item,
  semicolon-separated — e.g. `8 BLOCKED (CORS, CRM/api-prionex; restricted-role account, Oleg)`.
  The cause and owner are **parameters, not literals**: do not hardcode `(CORS, CRM/api-prionex)`,
  because not every blockage is CORS (F9 already has a second one) and a misattributed blocker gets
  assumed fixed when somebody else's ask closes.

**The invariant — check every note by addition:**

```
P + D + F + B == 12
```

Any note that does not satisfy it is wrong on its face and can be caught without opening this file.

**Dropping empty clauses.** Drop a clause only when its count is 0, and drop the **exact** literal
including its leading comma and space:

- `B` is 0 → drop `, <B> BLOCKED (<cause>, <owner>)`
- `D` is 0 → drop `, <D> degraded`
- `F` is 0 → drop `, <F> fail (<ids>)`

`<P>/12 pass` is never dropped. The invariant still holds over the dropped counts — a clause that
is absent means that count is 0, not that it is unknown.

### The three shapes, with the arithmetic checked

**Combined (failing items AND blocked items in the same note).** This is not an exotic case: it is
the **only** shape any note can have until the CORS origin is fixed, and it is therefore the very
first note Story 5.6 will write.

```
RVC-v1 sha-28f7fd36b75e-preprod: 1/12 pass, 1 degraded, 2 fail (F2 F3), 8 BLOCKED (CORS, CRM/api-prionex; restricted-role account, Oleg) — detail in docs/release-validation-checklist.md
```

`1 + 1 + 2 + 8 == 12`. ✅

**Today's honest headline, if a candidate were validated right now** — F1 and F2 pass in full, F3
and F12 are degraded, F4-F11 are blocked. Note that this accompanies `validated=fail`, not `pass`:

```
RVC-v1 sha-28f7fd36b75e-preprod: 2/12 pass, 2 degraded, 8 BLOCKED (CORS, CRM/api-prionex; restricted-role account, Oleg) — detail in docs/release-validation-checklist.md
```

`2 + 2 + 0 + 8 == 12`. ✅ (the `fail` clause is dropped because `F` is 0)

**A clean run, once nothing is blocked:**

```
RVC-v1 sha-28f7fd36b75e-preprod: 12/12 pass — detail in docs/release-validation-checklist.md
```

`12 + 0 + 0 + 0 == 12`. ✅

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

**Append-only, one section per `image_tag` AND date.** 🔴 The key is both, not the tag alone: the
same `image_tag` **will** be re-validated once the CORS origin is fixed — that is the whole point
of F4-F11 becoming executable — and keying by tag alone would produce two identical headings with
no rule saying which one governs. Heading format: `### <image_tag> — <YYYY-MM-DD>`. Where two
sections share a tag, **the later date governs**; the earlier one is kept because it is the record
of what was knowable then.

Never edit a section after it is written — a re-validation is a new section, not a rewrite. This is
the same rule `docs/preprod-candidates.md` follows, for the same reason.

Each section carries: the checklist version, the date, who executed it, the per-item verdicts, the
aggregate, the `validation_note` that was submitted, and the recorder run id if one was dispatched.

**This log is empty.** `RVC-v1` is published by Story 5.5, which deliberately does **not** execute
it — executing the checklist against a real candidate is Story 5.6's rehearsal, and 5.6 writes the
first section here. See [the two consequences above](#the-cors-blocker) for the verdict problem 5.6
inherits.

### Template — copy this block, do not edit it in place

```
### <image_tag> — <YYYY-MM-DD>

- Checklist version: RVC-v1
- Date (UTC): YYYY-MM-DD
- Executed by: <name>
- Deploy run id: <run id of deploy-preprod.yml>

Verdict column — one of exactly four values: `pass`, `pass (degraded)`, `fail`, `BLOCKED`.

| Item | Verdict | Evidence / why |
|---|---|---|
| P1 | pass / fail | executed BY HAND at the start of validation, not delegated to the recorder |
| P2 | pass / fail | decoded build epoch, and it is at or after the candidate's build time |
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

- Counts: P=<P> D=<D> F=<F> B=<B>   (must satisfy P + D + F + B == 12)
- Aggregate verdict: pass / fail   (`pass` requires all twelve to be a full `pass`)
- validation_note submitted: `RVC-v1 <image_tag>: <P>/12 pass, <D> degraded, <F> fail (<ids>), <B> BLOCKED (<cause>, <owner>) — detail in docs/release-validation-checklist.md`
- Recorder run id: <run id, or "not dispatched — verdict was fail">
```
