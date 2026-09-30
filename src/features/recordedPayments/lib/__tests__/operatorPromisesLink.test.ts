import { describe, expect, it } from 'vitest'
import { OPERATOR_PROMISES_TAB, REPORTS_PATH, operatorPromisesLink } from '../operatorPromisesLink'

describe('operatorPromisesLink', () => {
  const current = new URLSearchParams(
    'tab=recorded-payments&rpf=2026-08-01&rpt=2026-08-31&rpu=101&rpv=1&rppg=3&opd=d17&prf=2026-02-02'
  )

  it('targets the operator-promises tab with the SAME window and the user id', () => {
    const link = operatorPromisesLink({
      userId: 202,
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      currentSearch: current,
    })
    expect(link.pathname).toBe(REPORTS_PATH)
    const params = new URLSearchParams(link.search)
    expect(params.get('tab')).toBe(OPERATOR_PROMISES_TAB)
    expect(params.get('opf')).toBe('2026-08-01')
    expect(params.get('opt')).toBe('2026-08-31')
    expect(params.get('opu')).toBe('202')
  })

  it('carries every other tab’s params over untouched — the page keeps them all', () => {
    const params = new URLSearchParams(
      operatorPromisesLink({
        userId: 202,
        dateFrom: '2026-08-01',
        dateTo: '2026-08-31',
        currentSearch: current,
      }).search
    )
    // This tab's own state survives the hop, so Back lands on the same list…
    expect(params.get('rpf')).toBe('2026-08-01')
    expect(params.get('rpt')).toBe('2026-08-31')
    expect(params.get('rpu')).toBe('101')
    expect(params.get('rpv')).toBe('1')
    expect(params.get('rppg')).toBe('3')
    // …and so does an unrelated sibling's.
    expect(params.get('prf')).toBe('2026-02-02')
  })

  it('drops the operator-promises department sub-tab so «Всі» shows the row', () => {
    // A department left over from an earlier visit could hide exactly the
    // row the link exists to show.
    const params = new URLSearchParams(
      operatorPromisesLink({
        userId: 202,
        dateFrom: '2026-08-01',
        dateTo: '2026-08-31',
        currentSearch: current,
      }).search
    )
    expect(params.has('opd')).toBe(false)
  })

  it('does not mutate the params it was handed', () => {
    const before = current.toString()
    operatorPromisesLink({
      userId: 202,
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      currentSearch: current,
    })
    expect(current.toString()).toBe(before)
  })
})
