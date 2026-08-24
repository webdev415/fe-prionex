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
    })
  })
})
