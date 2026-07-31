/**
 * Scoring v3 settings page (KAN-792).
 *
 * The AC is "ops change tau/windows/TTLs/thresholds per brand from UI, no
 * deploy", so what matters here is that the screen can actually produce a valid
 * change and hand it to the server — plus the two safety properties: a
 * read-only user cannot edit, and nobody is told the change is retroactive.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ScoringV3SettingsPage } from '../ScoringV3SettingsPage'
import * as useV3ScoresModule from '@/features/scoring/hooks/useV3Scores'
import * as hooks from '@/hooks'

vi.mock('@/features/scoring/hooks/useV3Scores')
vi.mock('@/hooks', async () => {
  const actual = await vi.importActual<typeof hooks>('@/hooks')
  return { ...actual, useHasPermission: vi.fn() }
})
vi.mock('@/components/auth', () => ({
  PermissionGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const SETTINGS = {
  tau: 0.0189,
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

const mutate = vi.fn()

function setup({ canEdit = true }: { canEdit?: boolean } = {}) {
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
      tau_capacity_guide: [
        { avg_share: 0.2, tau: 0.0228 },
        { avg_share: 0.25, tau: 0.0189 },
      ],
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
    expect(screen.getByText(/next run/i)).toBeInTheDocument()
  })

  it('shows the tau capacity guide so tau is picked against capacity', () => {
    setup()
    expect(screen.getByText('0.0228')).toBeInTheDocument()
    expect(screen.getByText('20%')).toBeInTheDocument()
  })

  it('lets ops pick a tau straight from the capacity guide', () => {
    setup()
    fireEvent.click(screen.getAllByText('use')[0])
    fireEvent.click(screen.getByText('Save'))

    expect(mutate).toHaveBeenCalledTimes(1)
    expect(mutate.mock.calls[0][0].settings.tau).toBe(0.0228)
  })

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

  it('records a TTL override without touching the bucket', () => {
    setup()
    // the TTL editor row for refusal_to_pay — bucket is display-only
    const override = screen.getByPlaceholderText('—')
    fireEvent.change(override, { target: { value: '45' } })
    fireEvent.click(screen.getByText('Save'))

    expect(mutate.mock.calls[0][0].settings.result_ttls).toEqual({ refusal_to_pay: 45 })
  })

  it('clearing the expiry means "never", not zero', () => {
    // 0 would expire the signal instantly; the field is nullable for a reason.
    setup()
    fireEvent.change(screen.getByDisplayValue('90'), { target: { value: '' } })
    fireEvent.click(screen.getByText('Save'))

    expect(mutate.mock.calls[0][0].settings.partial_pay_expire_days).toBeNull()
  })

  it('cannot be saved until something actually changes', () => {
    setup()
    expect(screen.getByText('Save')).toBeDisabled()
  })

  it('is read-only without the edit permission', () => {
    setup({ canEdit: false })
    expect(screen.queryByText('Save')).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('0.0189')).toBeDisabled()
  })
})
