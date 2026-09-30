/**
 * URL-parameter registry of the Reports page (`/dashboard/reports`).
 *
 * The host page keeps EVERY tab's params in the URL at once — panels unmount
 * on a tab switch, so each tab parks its state there and must neither read nor
 * clobber a key another tab owns. A shared key would silently transplant one
 * tab's filter into another (the processing tab's `from` is a date of exactly
 * the same shape as the verification tab's `sf`).
 *
 * This module is the single place a key is DECLARED. Every tab imports its own
 * set from here, the docblock of a new tab points here instead of re-listing
 * its siblings, and `reportsUrlKeys.test.ts` proves the whole namespace is
 * collision-free — so adding a set that reuses a taken key fails a test
 * instead of shipping a silent transplant. The shared paged-feed shell
 * (`useUrlPagedFeedFilters`) additionally proves, once per registered set,
 * that its URL writes leave every foreign key untouched.
 *
 * Known limit of that proof: it covers key SPELLING, not who reads a key. A tab
 * is free to import a set that is not its own — `REPORTS_URL_KEYS.processing`
 * inside the verification tab compiles and collides with nothing, because the
 * registry only ever sees one declaration of `from`. Nothing here catches that;
 * what does is the same thing that catches it in review — one tab, one set,
 * named right below.
 *
 * Key spelling stays SHORT on purpose (these travel in shared links), and the
 * historical sets keep their historical spellings — renaming a key here would
 * break every bookmarked link that carries it.
 */

export const REPORTS_URL_KEYS = {
  /** The host page itself: which report tab is open. */
  host: { tab: 'tab' },
  /** «Відпрацювання за ЦД» (clientProcessing). */
  processing: { from: 'from', to: 'to', dept: 'dept' },
  /** «Верифікація 3-х осіб» (thirdPartyVerification). */
  verification: { sellFrom: 'sf', sellTo: 'st', countFrom: 'cf', countTo: 'ct' },
  /** «Мало верифікацій» feed (lowVerificationFeed). */
  lowVerificationFeed: {
    sellFrom: 'pf',
    sellTo: 'pt',
    maxVerified: 'mv',
    page: 'pg',
    pageSize: 'ps',
  },
  /** «Серчер без відпрацювання» feed (searcherFollowup). */
  searcherFollowup: { dateFrom: 'if', dateTo: 'it', page: 'spg', pageSize: 'sps' },
  /** «Великий розрив» feed (communicationGap). */
  communicationGap: { sellFrom: 'gf', sellTo: 'gt', gapMin: 'gm', page: 'gpg', pageSize: 'gps' },
  /**
   * «Обіцянки по операторах» (operatorPromises). `opu` (Operator-Promises
   * User) is the operator a sibling tab LINKS TO by `user_id` — the recorded
   * payments tab (card 76) sends a reader here with the same window — and the
   * tab answers it by highlighting and scrolling to that operator's row; it
   * is never a filter (the roster arrives whole and is grouped client-side).
   */
  operatorPromises: { dateFrom: 'opf', dateTo: 'opt', department: 'opd', user: 'opu' },
  /**
   * «Вхід без відпрацювання» feed (inboundFollowup). `n` for iNbound: the
   * obvious `i…` spellings are the searcher feed's (`if`/`it`), and this feed
   * is its closest sibling — sharing a prefix is exactly how a transplant gets
   * written by accident.
   */
  inboundFollowup: { dateFrom: 'nf', dateTo: 'nt', page: 'npg', pageSize: 'nps' },
  /**
   * «Контакт/Неконтакт» feed (contactTag). `k…` for Kontakt: the obvious `c…`
   * spellings are already the verification tab's (`cf`/`ct` — count from/to),
   * and `ct` is exactly the abbreviation this tab would have reached for.
   *
   * `viewDate` is this page's only REQUIRED single date (`kd`); `sellFrom` /
   * `sellTo` are the optional purchase window, and `kt` carries THREE states
   * rather than two — absent (the backend default applies), present-and-empty
   * (`kt=`, upper bound switched off) and a date. That is why the tab reads it
   * with its own `readSellToState` instead of the shared `readUrlDateBound`,
   * which folds absent and empty together. `tag` (`kg`) is the sub-tab strip's
   * population filter: it travels to the endpoint as `tag_code` and, like every
   * other filter here, resets the page.
   */
  contactTag: {
    viewDate: 'kd',
    sellFrom: 'kf',
    sellTo: 'kt',
    tag: 'kg',
    page: 'kpg',
    pageSize: 'kps',
  },
  /**
   * «Вихідні дзвінки» (outboundCalls). "oc…" for Outbound-Calls, the same
   * initials scheme the operator-promises set uses ("op…") — the bare `o…`
   * spellings are already that tab's.
   */
  outboundCalls: { dateFrom: 'ocf', dateTo: 'oct' },
  /**
   * «Обіцянки до кінця місяця» (promisesDaily). "pd…" for Promises-Daily —
   * the bare `p…` spellings are the low-verification feed's (`pf`/`pt`/`pg`/
   * `ps`). `pdp` carries the possible-payment switch: present-as-"1" is on,
   * absent is the backend default (off).
   */
  promisesDaily: { dateFrom: 'pdf', dateTo: 'pdt', possiblePayment: 'pdp' },
  /**
   * «Обіцянки» feed (promisesFeed). "pr…" for PRomises: the bare `p…`
   * spellings are the low-verification feed's (`pf`/`pt`/`pg`/`ps`) and
   * `pd…` is the daily promises report's — the two sets this feed would have
   * reached for first. `prw`/`prp` carry the two server-side toggles (hide
   * worked / hide paid): present-as-"1" is on, absent is the backend default
   * (off) — a shared link carries only choices somebody made.
   */
  promisesFeed: {
    dateFrom: 'prf',
    dateTo: 'prt',
    hideWorked: 'prw',
    hidePaid: 'prp',
    page: 'prpg',
    pageSize: 'prps',
  },
  /**
   * «Перезвони» feed (callbacksFeed). "cb…" for CallBacks: the bare `c…`
   * spellings are the verification tab's (`cf`/`ct` — count from/to), which
   * are exactly the two a feed with a date pair would reach for first, and
   * `ct` doubles as the obvious abbreviation of "callback to". `cbc`/`cbw`
   * carry the two server-side toggles (hide called today / hide worked):
   * present-as-"1" is on, absent is the backend default (off) — a shared link
   * carries only choices somebody made.
   */
  callbacksFeed: {
    dateFrom: 'cbf',
    dateTo: 'cbt',
    hideCalledToday: 'cbc',
    hideWorked: 'cbw',
    page: 'cbpg',
    pageSize: 'cbps',
  },
  /**
   * «Зливи» feed (drainsFeed). "dr…" for DRains: the bare `d…` spellings are
   * the processing tab's `dept`, and `df`/`dt` are exactly what a feed with a
   * date pair would reach for first.
   *
   * `drwt`/`drw`/`drp` carry the three server-side toggles (hide worked today
   * / hide worked / hide paid): present-as-"1" is on, absent is the backend
   * default (off) — a shared link carries only choices somebody made.
   *
   * `dra` is THIS TAB'S ONLY KEY WITH NO SIBLING: the «вся історія» switch.
   * Every other feed's window always has a default, so absent bounds mean
   * "the default window"; here omitting both dates is a SUPPORTED MODE of the
   * endpoint (the whole history, acceptance criterion Kanbanboard#27), and the
   * two meanings cannot share one absence. The flag is what tells them apart —
   * see `DrainsFeedTab` for why a flag rather than three-state date keys.
   */
  drainsFeed: {
    dateFrom: 'drf',
    dateTo: 'drt',
    allHistory: 'dra',
    hideWorkedToday: 'drwt',
    hideWorked: 'drw',
    hidePaid: 'drp',
    page: 'drpg',
    pageSize: 'drps',
  },
  /**
   * «Внесені платежі» feed (recordedPayments, payment-service, card 76).
   * "rp…" for Recorded Payments — the same initials scheme as `dr…`/`cb…`/
   * `op…`. Every `p…` spelling is crowded already (`pf`/`pt`/`pg`/`ps` are the
   * low-verification feed's, `pd…` the daily promises report's, `pr…` the
   * promises feed's), so a feed about payments must NOT reach for a fourth
   * `p…` prefix: the likeliest transplant on the page is a `pr…` key read by
   * this tab, and `rp…` cannot be mistyped into one.
   *
   * `rpu` carries the operator filter (`user_ids` on the wire — the client's
   * RESPONSIBLE employee, key B, matched by id and never by name) as a
   * comma-separated list of ids; `rpv` is the «Тільки підтверджені» switch:
   * present-as-"1" is on, absent is the backend default (off — ALL statuses,
   * the source system's popup default). A shared link carries only choices
   * somebody made; the default window (the current month in the profile
   * zone) is never written into the URL.
   */
  recordedPayments: {
    dateFrom: 'rpf',
    dateTo: 'rpt',
    operators: 'rpu',
    verifiedOnly: 'rpv',
    page: 'rppg',
    pageSize: 'rpps',
  },
} as const

export type ReportsUrlKeyOwner = keyof typeof REPORTS_URL_KEYS

/**
 * Every registered key with its owner, flattened — what the collision test
 * (and the shared shell's non-interference sweep) iterates over.
 */
export function allReportsUrlKeys(): Array<{ owner: ReportsUrlKeyOwner; key: string }> {
  return (Object.keys(REPORTS_URL_KEYS) as ReportsUrlKeyOwner[]).flatMap((owner) =>
    Object.values<string>(REPORTS_URL_KEYS[owner]).map((key) => ({ owner, key }))
  )
}
