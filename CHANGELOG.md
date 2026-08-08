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
