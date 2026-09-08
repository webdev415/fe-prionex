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
  /** «Обіцянки по операторах» (operatorPromises). */
  operatorPromises: { dateFrom: 'opf', dateTo: 'opt', department: 'opd' },
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
