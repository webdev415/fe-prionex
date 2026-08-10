# Deferred Work

## Deferred from: code review of 1-3-verify-forgejo-actions-availability-and-concurrency-support (2026-08-08)

- `_bmad-output/planning-artifacts/epics.md` carries six pre-existing stale `CD.yml` citations
  (shifted by commit `09591984`, outside story 1.3's Task 6.3 scope), verified against `CD.yml`
  at HEAD: `:213` (`49,59`→`47,57`), `:255` and `:329` (`124`→`122`, `150`→`149`), `:457`
  (`140-153`→`138-152`), `:458` (`123-124`→`121-122`), `:1168` (`115-116`→`113-114`). Lines
  `:258` (`CD.yml:191`) and `:1107` (`CD.yml:47-74`) are already correct — sweep only the six.
- Forgejo API token `fe_tmp` (id 83) was created with scopes `all` instead of the
  `write:repository` + `read:organization` prescribed by story 1.3 Task 1.1, and is still live.
  Remedy is the already-tracked Task 7.1 manual revocation (Oleg, Forgejo UI → Settings →
  Applications), but the over-broad scope raises its urgency.
- `docs/forgejo-migration.md:19` current-state table still lists «`v*` → production» although
  the `tags: ['v*']` trigger was removed from `CD.yml` by commit `09591984`; the `CD.yml:5`
  citation on that row is correct — only the `v*` clause is stale content.

## Deferred from: story 1-13-stop-forgejo-from-executing-the-legacy-github-workflows (2026-08-10)

- `docs/forgejo-migration.md` §5 «Риски» — the row «Оба пайплайна одновременно деплоят на один
  стенд» closes with «job `deploy` в GitHub CD отключается в начале фазы 7», but decision
  [D7](../../docs/migration-decisions.md#d7) already established that **no action is taken on
  GitHub** — that job is never disabled by this plan. Story 1.13's Task 9.5 flagged this as
  out-of-scope for a citation-only pass; a neighbouring row was touched (a new risk row added
  directly below it), which is why it's noted here rather than silently left. Needs a content
  fix, not a line-number repair — someone should reconcile that row's wording with D7.
