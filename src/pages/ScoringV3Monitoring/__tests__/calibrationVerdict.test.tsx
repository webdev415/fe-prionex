/**
 * Shadow-run report — the calibration verdict (KAN-794).
 *
 * This banner is what a reviewer reads to answer "does the model work?", so it
 * has exactly one job: never say something the data does not support.
 *
 * The failure mode that motivated these tests is real. A month with no recorded
 * payments produces actual_rate = 0 in every decile, so the naive check
 * (last > first) is false and the page announced "Ranking does NOT hold — this
 * blocks sign-off". Observed on 2026-07, where the entire portfolio had three
 * qualifying payments. Condemning the model for an absence of data is the worst
 * possible error on a sign-off screen.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ScoringV3MonitoringPage } from '../ScoringV3MonitoringPage'
import * as useV3ScoresModule from '@/features/scoring/hooks/useV3Scores'
import * as hooks from '@/hooks'

vi.mock('react-i18next', async () => (await import('@/test/englishI18n')).englishReactI18nextMock())

vi.mock('@/features/scoring/hooks/useV3Scores')
vi.mock('@/hooks', async () => {
  const actual = await vi.importActual<typeof hooks>('@/hooks')
  return { ...actual, useHasPermission: vi.fn(() => true) }
})
vi.mock('@/components/auth', () => ({
  PermissionGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/ui/useConfirm', () => ({ useConfirm: () => vi.fn() }))

const SUMMARY = {
  total: 311624,
  bucket_counts: { EXIT: 57996, LOW: 202368, AVG: 50165, HIGH: 1063, CRIT: 32 },
  bucket_pct: { EXIT: 0.1861, LOW: 0.6494, AVG: 0.161, HIGH: 0.0034, CRIT: 0.0001 },
  exit_rate: 0.1861,
  avg_or_higher_share: 0.2021,
  hazard_mean: 0.00955,
  hazard_p50: 0.006,
  hazard_p90: 0.02,
  total_priority_dollar: 1000,
  rule_fired_counts: { ml_low: 202273 },
  project_id: 1,
  month_start: '2026-07-01',
}

function bins(actualRates: number[]) {
  return actualRates.map((a, i) => ({
    bin: i + 1,
    n: 1000,
    predicted_mean: 0.001 * (i + 1),
    actual_rate: a,
  }))
}

function setup(calibration: Record<string, unknown> | undefined) {
  vi.mocked(useV3ScoresModule.useActiveProjectId).mockReturnValue(1)
  vi.mocked(useV3ScoresModule.useV3Monitoring).mockReturnValue({
    data: SUMMARY,
  } as unknown as ReturnType<typeof useV3ScoresModule.useV3Monitoring>)
  vi.mocked(useV3ScoresModule.useV3ScoredMonths).mockReturnValue({
    data: ['2026-07-01'],
  } as unknown as ReturnType<typeof useV3ScoresModule.useV3ScoredMonths>)
  vi.mocked(useV3ScoresModule.useV3Calibration).mockReturnValue({
    data: calibration,
  } as unknown as ReturnType<typeof useV3ScoresModule.useV3Calibration>)
  vi.mocked(useV3ScoresModule.useV3Drift).mockReturnValue({
    data: undefined,
  } as unknown as ReturnType<typeof useV3ScoresModule.useV3Drift>)
  vi.mocked(useV3ScoresModule.useV3UiEnabled).mockReturnValue(false)
  vi.mocked(useV3ScoresModule.useTriggerV3Scoring).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useV3ScoresModule.useTriggerV3Scoring>)
  vi.mocked(useV3ScoresModule.useSetV3UiEnabled).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useV3ScoresModule.useSetV3UiEnabled>)

  return render(
    <MemoryRouter>
      <ScoringV3MonitoringPage />
    </MemoryRouter>
  )
}

describe('shadow-run calibration verdict', () => {
  beforeEach(() => vi.clearAllMocks())

  it('does not blame the model when the month has no payments', () => {
    setup({
      n: 311624,
      n_bins: 10,
      predicted_base_rate: 0.00955,
      actual_base_rate: 0,
      calibration_error: 0.00955,
      bins: bins([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    })

    expect(screen.getByText(/not measurable for this month/i)).toBeInTheDocument()
    expect(screen.queryByText(/blocks sign-off/i)).not.toBeInTheDocument()
  })

  it('confirms the ranking when actual pay rate rises across the deciles', () => {
    setup({
      n: 285968,
      n_bins: 10,
      predicted_base_rate: 0.01031,
      actual_base_rate: 0.01227,
      calibration_error: 0.003,
      bins: bins([0.0008, 0.0011, 0.0022, 0.0051, 0.007, 0.0077, 0.0086, 0.0196, 0.0301, 0.0404]),
    })

    expect(screen.getByText(/ranking holds/i)).toBeInTheDocument()
    expect(screen.queryByText(/not measurable/i)).not.toBeInTheDocument()
  })

  it('still blocks sign-off when there ARE outcomes and the ranking is inverted', () => {
    // the check must keep its teeth — this is the case it exists for
    setup({
      n: 1000,
      n_bins: 10,
      predicted_base_rate: 0.01,
      actual_base_rate: 0.01,
      calibration_error: 0.02,
      bins: bins([0.04, 0.03, 0.02, 0.018, 0.015, 0.012, 0.009, 0.006, 0.003, 0.001]),
    })

    expect(screen.getByText(/blocks sign-off/i)).toBeInTheDocument()
  })
})
