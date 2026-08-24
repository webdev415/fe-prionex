import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { OperatorPromisesTotals } from '../OperatorPromisesTotals'
import type { OperatorPromisesTotals as OperatorPromisesTotalsData } from '../../types'

// react-i18next is mocked globally in src/test/setup.ts — t() returns the key
// (the generatedAt key is rendered as `<key>:<value>` so the stamp is
// assertable) and i18n.language is 'en'.

function makeTotals(
  overrides: Partial<OperatorPromisesTotalsData> = {}
): OperatorPromisesTotalsData {
  return {
    operators: 136,
    interactions_count: 208137,
    sum_from: '34508717.5067',
    sum_to: '33073631.73',
    paid_full: '24773441.41',
    paid_verified: '20000000.00',
    unpaid: '8300190.32',
    conversion: '0.749039',
    verified_unpaid: '13073631.73',
    verified_conversion: '0.604710',
    ...overrides,
  }
}

/** 13:20 UTC — 16:20 in Kyiv, 09:20 in New York, so the zone is visible. */
const GENERATED_AT = '2026-08-18T13:20:31.400543Z'

function renderTotals(
  visible: OperatorPromisesTotalsData,
  overall: OperatorPromisesTotalsData,
  visibleLabel = 'ТП',
  timezone?: string
) {
  return render(
    <OperatorPromisesTotals
      visible={visible}
      overall={overall}
      visibleLabel={visibleLabel}
      generatedAt={GENERATED_AT}
      timezone={timezone}
    />
  )
}

/**
 * The metrics IN RENDER ORDER — the same sequence as the table's columns, TF's
 * two payment trios included (paid / unpaid / conversion, then the verified
 * three). A reader moving between the two blocks must read the same order.
 */
const METRIC_LABELS = [
  'pages.reports.operatorPromises.totals.operators',
  'pages.reports.operatorPromises.columns.interactions',
  'pages.reports.operatorPromises.columns.sumFrom',
  'pages.reports.operatorPromises.columns.sumTo',
  'pages.reports.operatorPromises.columns.paidFull',
  'pages.reports.operatorPromises.columns.unpaid',
  'pages.reports.operatorPromises.columns.conversion',
  'pages.reports.operatorPromises.columns.paidVerified',
  'pages.reports.operatorPromises.columns.unpaidVerified',
  'pages.reports.operatorPromises.columns.conversionVerified',
]

/** The rendered generated-at stamp, without the key it rides on. */
function generatedAtStamp(): string {
  const node = screen.getByText(/^pages\.reports\.operatorPromises\.totals\.generatedAt:/)
  return node.textContent ?? ''
}

/** The row of the metric table whose row header is `label`. */
function metricRow(label: string): HTMLElement {
  const header = screen.getByText(label)
  return header.closest('tr') as HTMLElement
}

describe('OperatorPromisesTotals', () => {
  it('shows the visible-rows column under the active sub-tab’s own label', () => {
    renderTotals(makeTotals({ operators: 40 }), makeTotals(), 'Дайлер')

    expect(screen.getByRole('columnheader', { name: 'Дайлер' })).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: 'pages.reports.operatorPromises.totals.overall' })
    ).toBeInTheDocument()
  })

  it('renders BOTH columns so a department tab never reads as the whole period', () => {
    // The backend's totals cover every department and every dismissed operator;
    // the visible column is the client-side recomputation for the active tab.
    renderTotals(
      makeTotals({ operators: 40, paid_full: '1000000.00' }),
      makeTotals({ operators: 136, paid_full: '24773441.41' })
    )

    const row = metricRow('pages.reports.operatorPromises.columns.paidFull')
    expect(within(row).getByText('1,000,000.00')).toBeInTheDocument()
    expect(within(row).getByText('24,773,441.41')).toBeInTheDocument()
  })

  it('renders every metric of the contract, counts and money alike', () => {
    renderTotals(makeTotals(), makeTotals())

    for (const label of METRIC_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('lists the metrics in the TABLE’s column sequence, verified trio last', () => {
    // Membership alone would pass with the two trios interleaved, and then the
    // two blocks of one report would read in different orders — the fastest way
    // to take a verified figure for a full-payment one.
    renderTotals(makeTotals(), makeTotals())

    expect(screen.getAllByRole('rowheader').map((th) => th.textContent)).toEqual(METRIC_LABELS)
  })

  it('renders counts without decimals and money with exactly two', () => {
    renderTotals(makeTotals(), makeTotals())

    const operators = metricRow('pages.reports.operatorPromises.totals.operators')
    expect(within(operators).getAllByText('136')).toHaveLength(2)

    const interactions = metricRow('pages.reports.operatorPromises.columns.interactions')
    expect(within(interactions).getAllByText('208,137')).toHaveLength(2)

    // The over-precise promised sum is rounded to the hryvnia hundredth.
    const sumFrom = metricRow('pages.reports.operatorPromises.columns.sumFrom')
    expect(within(sumFrom).getAllByText('34,508,717.51')).toHaveLength(2)
  })

  it('renders the conversion as a percentage in both columns', () => {
    renderTotals(makeTotals({ conversion: 0.5 }), makeTotals({ conversion: '0.749039' }))

    const row = metricRow('pages.reports.operatorPromises.columns.conversion')
    expect(within(row).getByText('50.00%')).toBeInTheDocument()
    expect(within(row).getByText('74.90%')).toBeInTheDocument()
  })

  it('renders "—" for a null conversion rather than 0 %', () => {
    renderTotals(makeTotals({ conversion: null, sum_to: '0' }), makeTotals())

    const row = metricRow('pages.reports.operatorPromises.columns.conversion')
    expect(within(row).getByText('—')).toBeInTheDocument()
  })

  it('renders the verified twins as their own two metrics', () => {
    renderTotals(
      makeTotals({ verified_unpaid: '1000.00', verified_conversion: 0.25 }),
      makeTotals({ verified_unpaid: '13073631.73', verified_conversion: '0.604710' })
    )

    const unpaid = metricRow('pages.reports.operatorPromises.columns.unpaidVerified')
    expect(within(unpaid).getByText('1,000.00')).toBeInTheDocument()
    expect(within(unpaid).getByText('13,073,631.73')).toBeInTheDocument()

    const conversion = metricRow('pages.reports.operatorPromises.columns.conversionVerified')
    expect(within(conversion).getByText('25.00%')).toBeInTheDocument()
    expect(within(conversion).getByText('60.47%')).toBeInTheDocument()
  })

  it('renders "—" for a null verified_conversion, independently of the full one', () => {
    renderTotals(
      makeTotals({ verified_conversion: null, sum_to: '0' }),
      makeTotals({ verified_conversion: '0.604710' })
    )

    const row = metricRow('pages.reports.operatorPromises.columns.conversionVerified')
    expect(within(row).getByText('—')).toBeInTheDocument()
    // The full-payment conversion of the same column is untouched.
    const full = metricRow('pages.reports.operatorPromises.columns.conversion')
    expect(within(full).queryByText('—')).not.toBeInTheDocument()
  })

  it('states when the numbers were COMPUTED (the answer can be 15 minutes old)', () => {
    renderTotals(makeTotals(), makeTotals())

    // `generated_at` is stamped at computation time and re-served unchanged by
    // every cache hit, so a cached answer states its own age.
    expect(
      screen.getByText(/^pages\.reports\.operatorPromises\.totals\.generatedAt:/)
    ).toBeInTheDocument()
  })

  it('renders the stamp in the PROFILE timezone, so two zones read differently', () => {
    // The stamp must answer "how old is this number?" in the same clock the
    // report's window was cut with — the profile zone that travelled to the
    // API — not in whatever zone the reader's machine is set to.
    const { unmount } = renderTotals(makeTotals(), makeTotals(), 'ТП', 'Europe/Kyiv')
    const kyiv = generatedAtStamp()
    unmount()

    renderTotals(makeTotals(), makeTotals(), 'ТП', 'America/New_York')
    const newYork = generatedAtStamp()

    expect(kyiv).not.toBe(newYork)
    expect(kyiv).toContain('16:20') // 13:20 UTC +3
    expect(newYork).toContain('09:20') // 13:20 UTC −4
  })

  it('falls back to the browser zone for a profile without a timezone', () => {
    // A missing profile zone is normal (the request then omits the key and the
    // backend assumes UTC); the stamp must still render, not blank out.
    renderTotals(makeTotals(), makeTotals())

    expect(generatedAtStamp()).toContain(
      new Intl.DateTimeFormat('en-US', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date(GENERATED_AT))
    )
  })

  it('never marks dismissed operators in the totals', () => {
    // The mark belongs on the row, where it means something; a total is a sum
    // of money and has no employment status.
    renderTotals(makeTotals(), makeTotals())

    expect(
      screen.queryByText('pages.reports.operatorPromises.inactiveBadge')
    ).not.toBeInTheDocument()
  })

  it('renders an all-zero visible column for an empty department', () => {
    const empty = makeTotals({
      operators: 0,
      interactions_count: 0,
      sum_from: 0,
      sum_to: 0,
      paid_full: 0,
      paid_verified: 0,
      unpaid: 0,
      conversion: null,
      verified_unpaid: 0,
      verified_conversion: null,
    })
    renderTotals(empty, makeTotals())

    const operators = metricRow('pages.reports.operatorPromises.totals.operators')
    expect(within(operators).getByText('0')).toBeInTheDocument()
    const paid = metricRow('pages.reports.operatorPromises.columns.paidFull')
    expect(within(paid).getByText('0.00')).toBeInTheDocument()
    // …while the period column still carries the whole period's money.
    expect(within(paid).getByText('24,773,441.41')).toBeInTheDocument()
  })
})
