/**
 * Scoring v3 settings page (KAN-792).
 *
 * The AC is "ops change tau/windows/TTLs/thresholds per brand from UI, no
 * deploy". What these guard is that the screen can produce a valid change and
 * hand it to the server, plus the safety properties: a read-only user cannot
 * edit, and nobody is told the change applies retroactively.
 *
 * The page leads with QUEUE SIZE rather than tau, because "0.01135" tells an ops
 * user nothing and "63,406 debts a month" tells them everything. So the tests
 * drive it the way ops would — by picking a queue size.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ScoringV3SettingsPage } from '../ScoringV3SettingsPage'
import * as useV3ScoresModule from '@/features/scoring/hooks/useV3Scores'
import * as hooks from '@/hooks'

vi.mock('react-i18next', async () => (await import('@/test/englishI18n')).englishReactI18nextMock())

vi.mock('@/features/scoring/hooks/useV3Scores')
vi.mock('@/hooks', async () => {
  const actual = await vi.importActual<typeof hooks>('@/hooks')
  return { ...actual, useHasPermission: vi.fn() }
})
vi.mock('@/components/auth', () => ({
  PermissionGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const SETTINGS = {
  tau: 0.01135,
  ptp_active_window_days: 3,
  ptp_broken_min_days: 4,
  ptp_broken_max_days: 14,
  ptp_active_max_age_days: 30,
  inbound_crit_max_days: 3,
  inbound_high_max_days: 7,
  partial_avg_max_days: 30,
  partial_high_max_days: 39,
  partial_pay_expire_days: 90,
  weekly_contact_cap: 3,
  floor_min_real_payments: 3,
  floor_min_reached_rate: 0.5,
  result_ttls: {},
}

// Measured from the brand's own hazards, as the server now sends them.
const GUIDE = [
  { avg_share: 0.2, tau: 0.01223, debts: 50725, pay_lift: 2.95, payers_captured: 0.59 },
  { avg_share: 0.25, tau: 0.01135, debts: 63406, pay_lift: 2.61, payers_captured: 0.65 },
  { avg_share: 0.3, tau: 0.00831, debts: 76088, pay_lift: 2.34, payers_captured: 0.7 },
]

const mutate = vi.fn()

function setup({ canEdit = true, guide = GUIDE }: { canEdit?: boolean; guide?: unknown[] } = {}) {
  vi.mocked(hooks.useHasPermission).mockReturnValue(canEdit)
  vi.mocked(useV3ScoresModule.useActiveProjectId).mockReturnValue(1)
  vi.mocked(useV3ScoresModule.useV3Settings).mockReturnValue({
    data: {
      project_id: 1,
      is_global: false,
      settings: SETTINGS,
      source: 'database',
      defaults: { ...SETTINGS, tau: 0.0189, partial_pay_expire_days: null },
      rule_table: { refusal_to_pay: { bucket: 'LOW', ttl_days: 30 } },
      tau_capacity_guide: guide,
    },
    isLoading: false,
  } as unknown as ReturnType<typeof useV3ScoresModule.useV3Settings>)
  vi.mocked(useV3ScoresModule.useUpdateV3Settings).mockReturnValue({
    mutate,
    isPending: false,
  } as unknown as ReturnType<typeof useV3ScoresModule.useUpdateV3Settings>)

  return render(
    <MemoryRouter>
      <ScoringV3SettingsPage />
    </MemoryRouter>
  )
}

describe('ScoringV3SettingsPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('says changes apply on the next run, not retroactively', () => {
    setup()
    expect(screen.getByText(/next scoring run/i)).toBeInTheDocument()
    expect(screen.getByText(/nothing already scored is redone/i)).toBeInTheDocument()
  })

  // ── queue size: the decision ops actually make ──
  it('shows what each queue size costs in debts to work', () => {
    setup()
    expect(screen.getByText('25% of debts')).toBeInTheDocument()
    expect(screen.getByText('63,406')).toBeInTheDocument()
    expect(screen.getByText('50,725')).toBeInTheDocument()
  })

  it('shows the benefit of each queue size, not only its cost', () => {
    // The ticket asks for pay-lift and % payers captured: a bigger queue reaches
    // more payers but each call is worth less. Showing only "debts to work"
    // gives ops the cost with none of the benefit.
    setup()
    expect(screen.getByText('65%')).toBeInTheDocument() // payers reached at 25%
    expect(screen.getByText('2.61×')).toBeInTheDocument() // calls that pay at 25%
  })

  it('a derived window is shown but cannot be edited', () => {
    // "Start chasing a broken promise" is computed by the model from the promise
    // window. It used to be an input that changed nothing when saved.
    setup()
    expect(screen.queryByDisplayValue('4')).not.toBeInTheDocument()
    expect(screen.getByText(/set automatically/i)).toBeInTheDocument()
  })

  it('marks the queue size matching the current cut-off', () => {
    setup() // tau 0.01135 == the 25% row
    expect(screen.getByText('current')).toBeInTheDocument()
    expect(screen.getByText('25% of debts').textContent).toContain('current')
  })

  it('picking a queue size sends the matching cut-off', () => {
    setup()
    fireEvent.click(screen.getByText('30% of debts'))
    fireEvent.click(screen.getByText('Save'))

    expect(mutate).toHaveBeenCalledTimes(1)
    expect(mutate.mock.calls[0][0].settings.tau).toBe(0.00831)
  })

  it('says the numbers come from this brand, not a generic table', () => {
    setup()
    expect(screen.getByText(/this brand’s own scores/i)).toBeInTheDocument()
  })

  it('flags reference-only guidance when the brand has no scores yet', () => {
    setup({ guide: [{ avg_share: 0.25, tau: 0.0189, debts: null }] })
    expect(screen.getByText(/generic reference values/i)).toBeInTheDocument()
    // debts / payers-reached / calls-that-pay are all unknown without scores
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3)
  })

  it('keeps the raw cut-off available but out of the way', () => {
    setup()
    expect(screen.queryByDisplayValue('0.01135')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText(/show the exact cut-off/i))
    expect(screen.getByDisplayValue('0.01135')).toBeInTheDocument()
  })

  // ── the rule windows ──
  it('sends a changed window with the reason attached', () => {
    setup()
    fireEvent.change(screen.getByDisplayValue('14'), { target: { value: '21' } })
    fireEvent.change(screen.getByPlaceholderText(/why are you changing this/i), {
      target: { value: 'longer broken-promise window' },
    })
    fireEvent.click(screen.getByText('Save'))

    const payload = mutate.mock.calls[0][0]
    expect(payload.settings.ptp_broken_max_days).toBe(21)
    expect(payload.reason).toBe('longer broken-promise window')
    expect(payload.projectId).toBe(1)
  })

  it('records a TTL override without touching the priority it sets', () => {
    setup()
    const override = screen.getByPlaceholderText('—')
    fireEvent.change(override, { target: { value: '45' } })
    fireEvent.click(screen.getByText('Save'))

    expect(mutate.mock.calls[0][0].settings.result_ttls).toEqual({ refusal_to_pay: 45 })
  })

  it('clearing the give-up window means "never", not zero', () => {
    // 0 would abandon a lapsed payer instantly; the field is nullable for a reason.
    setup()
    fireEvent.change(screen.getByDisplayValue('90'), { target: { value: '' } })
    fireEvent.click(screen.getByText('Save'))

    expect(mutate.mock.calls[0][0].settings.partial_pay_expire_days).toBeNull()
  })

  // ── safety ──
  it('cannot be saved until something actually changes', () => {
    setup()
    expect(screen.getByText('Save')).toBeDisabled()
    expect(screen.getByText(/everything is saved/i)).toBeInTheDocument()
  })

  it('is read-only without the edit permission', () => {
    setup({ canEdit: false })
    expect(screen.queryByText('Save')).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('14')).toBeDisabled()
  })
})
