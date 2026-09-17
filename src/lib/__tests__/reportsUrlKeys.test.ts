import { describe, expect, it } from 'vitest'
import { REPORTS_URL_KEYS, allReportsUrlKeys } from '../reportsUrlKeys'

/**
 * The registry is the single declaration of the Reports page URL namespace:
 * every tab parks its params in the SAME query string (panels unmount on a
 * tab switch), so a reused key silently transplants one tab's filter into
 * another. This suite is what turns that mistake into a red test instead of a
 * shipped bug — a new tab's set joins the registry and inherits the collision
 * check (and the shared shell's non-interference sweep) for free.
 */
describe('REPORTS_URL_KEYS', () => {
  it('never declares the same key for two owners', () => {
    const seen = new Map<string, string>()
    for (const { owner, key } of allReportsUrlKeys()) {
      const holder = seen.get(key)
      expect(
        holder,
        `URL key "${key}" is declared by both "${holder}" and "${owner}"`
      ).toBeUndefined()
      seen.set(key, owner)
    }
  })

  it('never declares the same key twice within one owner', () => {
    for (const owner of Object.keys(REPORTS_URL_KEYS) as Array<keyof typeof REPORTS_URL_KEYS>) {
      const keys = Object.values<string>(REPORTS_URL_KEYS[owner])
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  it('pins the shipped spellings — these travel in bookmarked links', () => {
    // Renaming a key here breaks every shared link that carries it, so a
    // rename must be a conscious decision, not a refactor side effect.
    expect(REPORTS_URL_KEYS).toEqual({
      host: { tab: 'tab' },
      processing: { from: 'from', to: 'to', dept: 'dept' },
      verification: { sellFrom: 'sf', sellTo: 'st', countFrom: 'cf', countTo: 'ct' },
      lowVerificationFeed: {
        sellFrom: 'pf',
        sellTo: 'pt',
        maxVerified: 'mv',
        page: 'pg',
        pageSize: 'ps',
      },
      searcherFollowup: { dateFrom: 'if', dateTo: 'it', page: 'spg', pageSize: 'sps' },
      communicationGap: {
        sellFrom: 'gf',
        sellTo: 'gt',
        gapMin: 'gm',
        page: 'gpg',
        pageSize: 'gps',
      },
      operatorPromises: { dateFrom: 'opf', dateTo: 'opt', department: 'opd' },
      inboundFollowup: { dateFrom: 'nf', dateTo: 'nt', page: 'npg', pageSize: 'nps' },
      contactTag: {
        viewDate: 'kd',
        sellFrom: 'kf',
        sellTo: 'kt',
        tag: 'kg',
        page: 'kpg',
        pageSize: 'kps',
      },
      outboundCalls: { dateFrom: 'ocf', dateTo: 'oct' },
      promisesDaily: { dateFrom: 'pdf', dateTo: 'pdt', possiblePayment: 'pdp' },
      promisesFeed: {
        dateFrom: 'prf',
        dateTo: 'prt',
        hideWorked: 'prw',
        hidePaid: 'prp',
        page: 'prpg',
        pageSize: 'prps',
      },
      callbacksFeed: {
        dateFrom: 'cbf',
        dateTo: 'cbt',
        hideCalledToday: 'cbc',
        hideWorked: 'cbw',
        page: 'cbpg',
        pageSize: 'cbps',
      },
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
    })
  })

  it('keeps the callbacks feed clear of the `c…` spellings it would naturally take', () => {
    // `cf`/`ct` are the verification tab's "count from/to" — and `ct` is also
    // the obvious abbreviation of a callbacks feed's own "to" bound, so this
    // set is the likeliest transplant on the page. The collision test above
    // already fails on a reused key; this one records WHY the set is spelled
    // `cb…`, so a later "tidy-up" rename cannot quietly walk it back.
    const callbacksFeedKeys = Object.values<string>(REPORTS_URL_KEYS.callbacksFeed)
    for (const taken of ['cf', 'ct']) {
      expect(callbacksFeedKeys).not.toContain(taken)
    }
    expect(callbacksFeedKeys.every((key) => key.startsWith('cb'))).toBe(true)
  })

  it('keeps the promises feed clear of the `p…`/`pd…` spellings it would naturally take', () => {
    // `pf`/`pt`/`pg`/`ps` are the low-verification feed's and `pdf`/`pdt`/`pdp`
    // the daily promises report's — a feed about promises would reach for both
    // prefixes first. The collision test above already fails on a reused key;
    // this one records WHY the set is spelled `pr…`, so a later "tidy-up"
    // rename cannot quietly walk it back into a taken prefix.
    const promisesFeedKeys = Object.values<string>(REPORTS_URL_KEYS.promisesFeed)
    for (const taken of ['pf', 'pt', 'pg', 'ps', 'pdf', 'pdt', 'pdp']) {
      expect(promisesFeedKeys).not.toContain(taken)
    }
    expect(promisesFeedKeys.every((key) => key.startsWith('pr'))).toBe(true)
  })

  it('keeps the drains feed clear of the `d…` spellings it would naturally take', () => {
    // `dept` is the processing tab's department filter, and `df`/`dt` are the
    // two keys a feed with a date pair would reach for first. The collision
    // test above already fails on a reused key; this one records WHY the set
    // is spelled `dr…`, so a later "tidy-up" rename cannot quietly walk it
    // back into a taken (or collision-prone) prefix.
    const drainsFeedKeys = Object.values<string>(REPORTS_URL_KEYS.drainsFeed)
    for (const taken of ['dept', 'df', 'dt']) {
      expect(drainsFeedKeys).not.toContain(taken)
    }
    expect(drainsFeedKeys.every((key) => key.startsWith('dr'))).toBe(true)
  })

  it('gives the drains feed an all-history flag no other feed has', () => {
    // Every sibling window has a default, so "no dates in the URL" means "the
    // default window" everywhere else. The drains endpoint treats BOTH dates
    // absent as a supported mode (the whole history), and one absence cannot
    // carry both meanings — hence a flag of its own. A later sweep that
    // "normalises" the feed sets by deleting the odd key out would silently
    // make the mode unreachable.
    expect(REPORTS_URL_KEYS.drainsFeed.allHistory).toBe('dra')
    const otherSets = Object.entries(REPORTS_URL_KEYS).filter(([owner]) => owner !== 'drainsFeed')
    for (const [, set] of otherSets) {
      expect(Object.keys(set)).not.toContain('allHistory')
    }
  })

  it('keeps the contact-tag set clear of the `c…` spellings it would naturally take', () => {
    // `ct` is the verification tab's "count to" and `cf` its "count from" — the
    // two keys a feed about «Контакт/Неконтакт» would reach for first. The
    // collision test above already fails on a reused key; this one records WHY
    // the set is spelled with `k…`, so a later "tidy-up" rename cannot quietly
    // walk it back into the taken prefix.
    const contactTagKeys = Object.values<string>(REPORTS_URL_KEYS.contactTag)
    expect(contactTagKeys).not.toContain('ct')
    expect(contactTagKeys).not.toContain('cf')
    expect(contactTagKeys.every((key) => key.startsWith('k'))).toBe(true)
  })
})
