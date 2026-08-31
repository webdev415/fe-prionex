# Changelog — Prionex CRM Frontend (fe-prionex)

All notable production releases of the frontend. Tickets reference Jira (KAN-###).
Newest release on top. Format loosely based on
[Keep a Changelog](https://keepachangelog.com/).

<!--
To add the next release:
  1. Tag each production release on `main` so the diff boundary is unambiguous:
       git tag v1.5 <main-merge-commit> && git push origin v1.5
  2. Collect the tickets merged since the previous release:
       git log v1.5..HEAD --oneline | grep -oiE 'KAN-[0-9]+' | sort -u
  3. Group them below under Added / Changed / Fixed, newest version on top.
-->

## [v1.7] — 2026-08-30

Production build (development → main, PR #972, plus direct-to-main CD / softphone hotfix
PRs #973 / #974; diff from the previous release, v1.6 / PR #903).

### Added
- **KAN-786** — v3 priority-scoring surfaced in the client UI.
- **KAN-847** — Contact Tags: bulk assign/remove via CSV/Excel file upload.
- **KAN-973 / KAN-975** — Client-card hotkey quick-launch for Target-Action templates +
  the Profile Settings keyboard-shortcuts configuration UI.
- **KAN-994** — Loans tab: loan closing coefficient (debt-age based) in the Principal-Debt
  tooltip.
- **KAN-1025** — Team Management: Users page reworked to the new Employees List design.
- **KAN-1024** — Cross-project SMS-template protection, campaign-counter integrity, trash UX.
- **KAN-1039** — RR Draft: auto-deletion 7 days past the first payment date (draft status UX).
- **KAN-1052** — Document Templates: new "Restructuring: Draft" activation-rule condition.

### Changed
- **KAN-1053** — User modal: Asterisk / Predictive-Dialer extension fields validated against
  the "Is Agent" flag.

### Fixed
- **KAN-992** — TA date picker: past time slots are now visually disabled ("Date cannot be
  in the past" regression).
- **KAN-1015** — Tag Rules: `replace_tag` action now executes (old tag removed, new added).

## [v1.6] — 2026-08-16

Production build (development → main, PR #903; diff from the previous release, PR #817).

### Added
- **KAN-993** — Client profile: Loans tab redesign.
- **KAN-1007** — Client Panel: sidebar redesign (tags, responsible block, personal fields, Work-tab removal).
- **KAN-1008** — Lawyer Workplace: create a kanban task without a client link.
- **KAN-874** — Contact Tags: inline dropdown (category flyout picker) replacing the assignment modal.
- **KAN-977** — TA modal: auto-select the phone when only one candidate number exists.
- **KAN-821** — Client List: "Only last TA chain" checkbox in the chain filter.
- **KAN-858** — Tag Definitions: "Skip Weekends" option for TTL-based expiration.
- **KAN-970** — Project add/edit modal: company legal/banking details fields.
- **KAN-971** — Document Template Variables: PROJECT section (company/banking variables).
- **KAN-379** — Aggressive Dialer UI: operator/queue controls (continued from v1.5; engine off by default).
- **KAN-978** — Incoming-call modal refinements: call-outcome labels, reject agent leg, dismiss on colleague answer, call-window suppression.
- Operator verification scoring, low-verification feed, and searcher follow-up feed UIs (disabled by default).

### Changed
- **KAN-777** — Theming: dark / colored theme-mode refinements.
- **KAN-1000** — Lawyer Workplace kanban: correct card timezone + toast notifications.
- **KAN-835** — Rule builder: "interaction.created" trigger field options.
- **KAN-941** — Role read filters aligned to the JWT/session path.

### Fixed
- **KAN-989** — Severe main-thread freezes across the UI when switching to the "Neutral Dim" theme.
- **KAN-995** — Chrome native autofill overlapped the calendar picker on date-input fields.
- **KAN-1009** — Chrome native autofill appeared on text/number fields (Client-List filters, Edit Client, Log Interaction).
- **KAN-997** — Clearing a contact's comment field did not persist as empty.
- **KAN-1013** — Could not select payment type `payment_by_rr` when the Restructuring (RR) status was Violated.

## [v1.5] — 2026-08-02

Production build (development → main, PR #817; diff from the previous release, PR #735).

### Added
- **KAN-353** — WebRTC browser softphone / predictive dialer UI.
- **KAN-379** — Aggressive Dialer UI (automated outbound calling via SIM banks).
- **KAN-978** — Incoming-call screen-pop modal for inbound external calls.
- **KAN-249** — EasyPay payment-system integration UI.
- **KAN-334** — Payment Reversal (Storno) UI.
- **KAN-335** — Detailed loan calculation view.
- **KAN-894** — Restructuring (RR): "Draft" status and save modes.
- **KAN-498** — Course Catalogue + Training Assignments UI.
- **KAN-250** — UBKI integration UI.
- **KAN-820** — Bulk document upload for credits and clients (ZIP archive).
- **KAN-818** — "Reporting Date" field on the Factoring Agreement form.
- **KAN-777** — Theming system (dark / colored themes).
- **KAN-798** — "Segments" tab in the client-list tag filter.
- **KAN-805** — Soft-delete UI for contact-tag categories and values.
- **KAN-836** — Tag rules: condition "Days Since Last Debt Purchase".
- **KAN-837** — Tag rules: trigger "Tag Expiration Date Is Today".
- **KAN-740** — Tag dictionary: global sort-order field.
- **KAN-826** — Contact Types: color picker in Add/Edit modal.
- **KAN-812** — Contact Types: "Other" contact source for non-phone contacts.
- **KAN-816** — Contact-value input validation based on contact source.
- **KAN-825** — Recommenders/Phones: disable Call/Message icons when a blocking tag is active.
- **KAN-857** — Target Actions: show operator full name instead of nickname for blocked rows.
- **KAN-547** — Tag filter: single-tag matching (test coverage).

### Changed
- **KAN-804** — Recommenders tab redesign: Phones/Others split, card layout, contact types & tags.
- **KAN-339** — Refactor of the "Loans" tab in the debtor profile.
- **KAN-797** — Client-list tag filter: 3-state logic (include / exclude / neutral).
- **KAN-768** — Tag Activity modal: enriched with tag name and employee full name.
- **KAN-827** — Trainer Workplace: call listening, courses, localization.
- **KAN-868** — Bell notifications: per-user Tasks cap (200) instead of project cap.

### Fixed
- **KAN-730** — `checkAuth` destroyed a valid session token on any network error.
- **KAN-706** — Receipt PDF used `client.debts[0]` instead of the payment's debt (wrong contract).
- **KAN-707** — "Flush on unmount" effect fired on every render → PUT per keystroke with stale state.
- **KAN-719** — WebSocket event-name mismatch (`call.state.changed` vs `call.state_changed`).
- **KAN-727** — Payment history unreachable past page 1 (double pagination).
- **KAN-728** — Verify button never enabled (date parsed MM/DD/YYYY vs ISO).
- **KAN-828** — Cannot record a payment with type "Payment by RR".
- **KAN-718** — Delete-project flow called a route absent in auth-service.
- **KAN-755** — Client-list "Select All": split into page/filter selection with bulk-action limits.
- **KAN-824** — Action Analysis access-level scope leaked into Client Profile views.
- **KAN-833** — Tag segments with 3+ OR conditions returned 500 on "Refresh".
- **KAN-661** — Heatmap / screen-time view materialized all tracking rows unbounded.
- **KAN-983** — Ukraine translation fixes.
