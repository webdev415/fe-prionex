import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) =>
      typeof fallback === 'string' ? fallback : key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/hooks', () => ({ useHasPermission: () => true }))

const useRanges = vi.fn()
vi.mock('@/features/loanCoefficientRanges/hooks/useLoanCoefficientRanges', () => ({
  useLoanCoefficientRanges: () => useRanges(),
  useCreateCoefficientRange: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateCoefficientRange: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteCoefficientRange: () => ({ mutate: vi.fn(), isPending: false }),
}))

import { CoefficientRangesSection } from '../CoefficientRangesSection'

beforeEach(() => useRanges.mockReset())

describe('CoefficientRangesSection — load states', () => {
  it('reports a failed load instead of claiming there are no ranges', () => {
    // The empty state is a confident statement of fact; showing it after a
    // failed request tells the admin something false, and they would go on to
    // add a range that may already exist.
    useRanges.mockReturnValue({ data: undefined, isLoading: false, isError: true })
    render(<CoefficientRangesSection />)

    expect(screen.getByText(/could not load/i)).toBeInTheDocument()
    expect(screen.queryByText(/no ranges configured/i)).not.toBeInTheDocument()
  })

  it('shows the empty state only when the load actually succeeded', () => {
    useRanges.mockReturnValue({ data: [], isLoading: false, isError: false })
    render(<CoefficientRangesSection />)

    expect(screen.getByText(/no ranges configured/i)).toBeInTheDocument()
    expect(screen.queryByText(/could not load/i)).not.toBeInTheDocument()
  })

  it('renders the configured ranges', () => {
    useRanges.mockReturnValue({
      data: [
        {
          id: 1,
          project_id: 1,
          min_days: 40,
          max_days: 90,
          min_coefficient: '1.1',
          max_coefficient: '1.7',
          updated_by_username: 'admin',
          updated_at: '2026-08-18T08:00:00Z',
        },
      ],
      isLoading: false,
      isError: false,
    })
    render(<CoefficientRangesSection />)

    expect(screen.getByText('40 – 90')).toBeInTheDocument()
    expect(screen.getByText('×1.1–1.7')).toBeInTheDocument()
    expect(screen.getByText('admin')).toBeInTheDocument()
  })
})
