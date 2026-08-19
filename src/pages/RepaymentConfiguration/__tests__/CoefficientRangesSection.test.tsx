import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) =>
      typeof fallback === 'string' ? fallback : key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const canEdit = vi.fn(() => true)
vi.mock('@/hooks', () => ({ useHasPermission: () => canEdit() }))

const useRanges = vi.fn()
const createMutate = vi.fn()
const updateMutate = vi.fn()
const deleteMutate = vi.fn()
vi.mock('@/features/loanCoefficientRanges/hooks/useLoanCoefficientRanges', () => ({
  useLoanCoefficientRanges: () => useRanges(),
  useCreateCoefficientRange: () => ({ mutate: createMutate, isPending: false }),
  useUpdateCoefficientRange: () => ({ mutate: updateMutate, isPending: false }),
  useDeleteCoefficientRange: () => ({ mutate: deleteMutate, isPending: false }),
}))

import { CoefficientRangesSection } from '../CoefficientRangesSection'

beforeEach(() => {
  useRanges.mockReset()
  createMutate.mockReset()
  updateMutate.mockReset()
  deleteMutate.mockReset()
  canEdit.mockReturnValue(true)
})

const ROW = {
  id: 1,
  project_id: 1,
  min_days: 40,
  max_days: 90,
  min_coefficient: '1.1',
  max_coefficient: '1.7',
  updated_by_username: 'admin',
  updated_at: '2026-08-18T08:00:00Z',
}

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

describe('CoefficientRangesSection — permission gating', () => {
  it('offers no edit affordances without manage_settings', () => {
    // The section gates on manage_settings because its endpoints do; showing
    // buttons here would promise what the server answers with 403.
    canEdit.mockReturnValue(false)
    useRanges.mockReturnValue({ data: [ROW], isLoading: false, isError: false })
    render(<CoefficientRangesSection />)

    expect(screen.queryByText(/add range/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^edit$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^delete$/i)).not.toBeInTheDocument()
    // The banner names the permission rather than saying "view-only", so the
    // page's own banner and this one cannot be confused.
    expect(screen.getByText(/manage settings permission/i)).toBeInTheDocument()
  })

  it('offers them with the permission', () => {
    useRanges.mockReturnValue({ data: [ROW], isLoading: false, isError: false })
    render(<CoefficientRangesSection />)

    expect(screen.getByText(/add range/i)).toBeInTheDocument()
    expect(screen.queryByText(/manage settings permission/i)).not.toBeInTheDocument()
  })
})

describe('CoefficientRangesSection — refetch failure', () => {
  it('keeps already-loaded rows visible and warns', () => {
    // A background refetch failing must not blank rows the admin is reading.
    useRanges.mockReturnValue({ data: [ROW], isLoading: false, isError: true })
    render(<CoefficientRangesSection />)

    expect(screen.getByText('40 – 90')).toBeInTheDocument()
    expect(screen.getByText(/could not refresh/i)).toBeInTheDocument()
    expect(screen.queryByText(/could not load/i)).not.toBeInTheDocument()
  })
})

describe('CoefficientRangesSection — mutations', () => {
  it('sends the typed values on create', async () => {
    const user = userEvent.setup()
    useRanges.mockReturnValue({ data: [], isLoading: false, isError: false })
    render(<CoefficientRangesSection />)

    await user.click(screen.getByText(/add range/i))
    const [minDays, maxDays, minCoef, maxCoef] = screen.getAllByRole('spinbutton')
    await user.type(minDays, '40')
    await user.type(maxDays, '90')
    await user.type(minCoef, '1.1')
    await user.type(maxCoef, '1.7')
    await user.click(screen.getByText(/^save$/i))

    expect(createMutate).toHaveBeenCalledTimes(1)
    // Days as numbers, coefficients as strings — the column is numeric(3,1)
    // and a float round-trip could send 1.1000000000000001.
    expect(createMutate.mock.calls[0][0]).toEqual({
      min_days: 40,
      max_days: 90,
      min_coefficient: '1.1',
      max_coefficient: '1.7',
    })
  })

  it('does not call the API when validation fails', async () => {
    const user = userEvent.setup()
    useRanges.mockReturnValue({ data: [], isLoading: false, isError: false })
    render(<CoefficientRangesSection />)

    await user.click(screen.getByText(/add range/i))
    await user.click(screen.getByText(/^save$/i)) // every field blank

    expect(createMutate).not.toHaveBeenCalled()
  })

  it('deletes the selected range after confirmation', async () => {
    const user = userEvent.setup()
    useRanges.mockReturnValue({ data: [ROW], isLoading: false, isError: false })
    render(<CoefficientRangesSection />)

    await user.click(screen.getByText(/^delete$/i))
    await user.click(screen.getAllByText(/^delete$/i).at(-1)!)

    expect(deleteMutate).toHaveBeenCalledWith(ROW.id, expect.anything())
  })
})
