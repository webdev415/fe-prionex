# PRE-PROD validated candidates

Append-only ledger, one row per successful `record-preprod-candidate.yml` run. This is the
**authoritative human-readable record** of what was validated on PRE-PROD and why — the registry's
own `preprod-<sha>`/`preprod-current` tags carry identity and permanence (Story 6.5 reads those, not
this file), and the workflow's own job log / `$GITHUB_STEP_SUMMARY` are best-effort only (this
instance's logs have failed to archive repeatedly across Stories 5.3 and 5.4; whether step summaries
persist at all here was unverified before this file existed — see Story 5.4's own Review Findings,
code review D1).

**The recording procedure, as of Story 5.4's code review fix-pass:** dispatch
`record-preprod-candidate.yml` with `validated=pass`, confirm it went green, then append the row it
prints (its own last step prints a ready-to-paste line in this exact format) — "record a candidate"
is the two steps together, not the dispatch alone. This workflow does not write this file itself: it
holds no repository-write credential, and giving it one is a separate, unopened decision (a new class
of permission this story does not grant).

**What `pass` in the Verdict column is asserted against, as of 2026-08-24.** Story 5.5 published
`docs/release-validation-checklist.md`, version marker **`RVC-v1`** — twelve numbered flow items
plus two preconditions, each with its own pass criterion — and from its publication onward a row's
verdict is meant to be *derived* from it, with the `Note` cell carrying the `RVC-v1` summary line in
that file's stated format. The two rows below **predate it** and were therefore written against no
stated criterion at all; under `RVC-v1`, as it read on 2026-08-24, neither would have qualified as
`pass` (eight of its twelve items were `BLOCKED` on PRE-PROD Kong's wrong `Access-Control-Allow-Origin`,
owner `CRM/api-prionex`). They are deliberately **not** reinterpreted or rewritten — this ledger is
append-only and rows are never re-judged after the fact, even by later events. This paragraph exists
so a reader comparing the two files sees the mismatch as a dated boundary rather than an unnoticed
defect.

🔴 **Update, closeout re-measurement, 2026-08-25: the CORS blocker named above is fixed.**
`CRM/api-prionex` fixed PRE-PROD's `Access-Control-Allow-Origin`, independently re-measured this
date (non-echo, negative-controlled — see `docs/release-validation-checklist.md`'s own ["The CORS
blocker"](release-validation-checklist.md#the-cors-blocker) for the evidence). This does **not**
retroactively change either row above — they remain exactly as recorded, honest on the date they
were written. What it changes going forward: eleven of `RVC-v1`'s twelve items (all but F9, which
still needs a restricted-role account on PRE-PROD, owner Oleg) are now executable, so a real
browser-path validation is possible for the first time. **Re-validation of a current candidate under
`RVC-v1` is now possible and is the natural next step** — Story 5.6's rehearsal is the first
opportunity to actually append a row derived from a fully-executed checklist rather than the
container-health-only prose these first two rows carry.

| Date (UTC) | Candidate tag | Digest | Verdict | Note | Run id |
|---|---|---|---|---|---|
| 2026-08-24 | `sha-00ef3be4743d-preprod` | `sha256:5e5b190d93c8aaec50f0d50c7e108f502c3d366d14f8a13aee081f0ee396dc8c` | pass | Manual validation, 2026-08-24, against 5.3's run 1198 deploy: container healthy, running .RepoDigests matches sha256:5e5b190d93c8... exactly, TLS serves crm.preprod.crm-prionex.online, Kong resolves by container identity inside the stand's own network (5.2 AC5/D34/D36). Browser-path/API validation NOT performed and not possible — PRE-PROD's Kong CORS is known-broken (static wrong Access-Control-Allow-Origin), external ask to CRM/api-prionex still open. | 1215 |
| 2026-08-24 | `sha-28f7fd36b75e-preprod` | `sha256:d2f6aefc780d6684bd86418298d4068131b7442bf93c3f17de965f40c82f6f26` | pass | Manual validation, 2026-08-24, candidate #2 (main HEAD 28f7fd36b75e, minted D7): stand deployed via D8, container healthy, running .RepoDigests matches sha256:d2f6aefc7... exactly. Same CORS boundary as candidate #1 — browser-path validation not performed, not possible until CRM/api-prionex fixes Access-Control-Allow-Origin. | 1229 |

**These first two rows were entered by the dev session itself, retroactively, as part of Story 5.4's
own code review fix-pass** (the file did not exist when runs 1215/1229 actually happened — the
recording convention this file establishes is being applied to this story's own already-validated
candidates as its first act, not left for the next candidate to originate it). Every row after these
two should follow the live procedure above: dispatch, confirm green, then append from the run's own
printed line.
