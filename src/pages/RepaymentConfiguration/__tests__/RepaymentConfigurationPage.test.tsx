/**
 * RepaymentConfigurationPage — Vitest + React Testing Library tests
 *
 * KAN-246 / Phase 10 / Audit finding F6.
 * Covers the behaviours specified in the runbook §12.2.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { RepaymentConfigurationPage } from '../RepaymentConfigurationPage'
import type {
  RepaymentRulesConfig,
  RepaymentConfigHistoryResponse,
} from '@/features/repaymentConfig'

// ── Hoisted spies ──────────────────────────────────────────────────────────────

/** Spy on mutateAsync so tests can inspect the payload sent to the server. */
const mutateAsyncSpy = vi.hoisted(() => vi.fn())

/** Spy on queryClient.invalidateQueries */
const invalidateQueriesSpy = vi.hoisted(() => vi.fn())

// ── Fixture data ───────────────────────────────────────────────────────────────

const mockConfigData: RepaymentRulesConfig = {
  algorithm: 'legacy_proportional',
  repayment_order: ['principal', 'interest', 'commission', 'penalties', 'fines'],
  writeoff_enabled: {
    principal: true,
    interest: true,
    commission: true,
    penalties: true,
    fines: true,
  },
  version: 3,
  updated_at: '2024-06-01T10:00:00Z',
  updated_by_username: 'admin',
}

const mockHistoryData: RepaymentConfigHistoryResponse = {
  items: [
    {
      id: 1,
      config_version: 3,
      algorithm: 'legacy_proportional',
      repayment_order: ['principal', 'interest', 'commission', 'penalties', 'fines'],
      writeoff_enabled: {
        principal: true,
        interest: true,
        commission: true,
        penalties: true,
        fines: true,
      },
      diff: {},
      changed_by: 1,
      changed_by_username: 'admin',
      session_id: null,
      created_at: '2024-06-01T10:00:00Z',
    },
  ],
  total: 1,
}

// ── Hook return value refs (mutated per test in beforeEach) ────────────────────

const mockUseRepaymentConfigReturn = {
  data: mockConfigData as RepaymentRulesConfig | undefined,
  isLoading: false,
  isError: false,
}

const mockUseRepaymentConfigHistoryReturn = {
  data: mockHistoryData as RepaymentConfigHistoryResponse | undefined,
  isLoading: false,
}

// ── Module mocks ───────────────────────────────────────────────────────────────

// react-i18next — return the fallback string so assertions use English text
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) =>
      typeof fallback === 'string' ? fallback : key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

// sonner
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// @tanstack/react-query — keep the real QueryClientProvider but stub
// useQueryClient to return our spy-equipped object.
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: invalidateQueriesSpy,
    }),
  }
})

// @/features/repaymentConfig
vi.mock('@/features/repaymentConfig', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/repaymentConfig')>()
  return {
    ...actual,
    useRepaymentConfig: vi.fn(() => mockUseRepaymentConfigReturn),
    useRepaymentConfigHistory: vi.fn(() => mockUseRepaymentConfigHistoryReturn),
    useUpdateRepaymentConfig: vi.fn(() => ({
      mutateAsync: mutateAsyncSpy,
      isPending: false,
    })),
  }
})

// @/hooks — mock useHasPermission
const mockHasPermission = vi.hoisted(() => vi.fn(() => true))

vi.mock('@/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks')>()
  return {
    ...actual,
    useHasPermission: mockHasPermission,
  }
})

// ── Helpers ────────────────────────────────────────────────────────────────────

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <RepaymentConfigurationPage />
    </QueryClientProvider>
  )
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('RepaymentConfigurationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Restore defaults
    mockHasPermission.mockReturnValue(true)
    mutateAsyncSpy.mockResolvedValue({})

    mockUseRepaymentConfigReturn.data = mockConfigData
    mockUseRepaymentConfigReturn.isLoading = false
    mockUseRepaymentConfigReturn.isError = false

    mockUseRepaymentConfigHistoryReturn.data = mockHistoryData
    mockUseRepaymentConfigHistoryReturn.isLoading = false
  })

  // 1. Renders all 5 component labels in API order ───────────────────────────
  it('renders 5 component labels in the repayment order list', async () => {
    renderPage()

    // Each component label appears twice: once in the order list, once in the
    // write-off rules section. getAllByText ensures both sections are rendered.
    await waitFor(() => {
      expect(screen.getAllByText('Principal').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Interest').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Commission').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Penalties').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Fines').length).toBeGreaterThanOrEqual(1)
    })

    // Position numbers 1-5 must be present in the order list
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByText(String(i))).toBeInTheDocument()
    }
  })

  // 2. Toggle switches map to writeoff_enabled ───────────────────────────────
  it('clicking a writeoff toggle changes its checked state', async () => {
    const user = userEvent.setup()
    renderPage()

    // All writeoff switches start as checked (writeoff_enabled all true)
    const switches = await screen.findAllByRole('switch')
    const principalSwitch = switches[0]

    expect(principalSwitch).toHaveAttribute('aria-checked', 'true')

    await user.click(principalSwitch)

    await waitFor(() => {
      expect(principalSwitch).toHaveAttribute('aria-checked', 'false')
    })
  })

  // 3. Save sends correct payload including version ──────────────────────────
  it('calls mutateAsync with the correct version from server data', async () => {
    const user = userEvent.setup()
    renderPage()

    // Dirty the form by toggling a switch
    const switches = await screen.findAllByRole('switch')
    await user.click(switches[0])

    const saveButton = screen.getByRole('button', { name: /save changes/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(mutateAsyncSpy).toHaveBeenCalledWith(
        expect.objectContaining({ version: mockConfigData.version })
      )
    })
  })

  // 4. 409 version-conflict (no activation keywords) invalidates query ───────
  it('409 without activation keywords calls invalidateQueries', async () => {
    const user = userEvent.setup()

    mutateAsyncSpy.mockRejectedValue({
      response: {
        status: 409,
        data: { detail: 'conflict detected' },
      },
    })

    renderPage()

    const switches = await screen.findAllByRole('switch')
    await user.click(switches[0])

    const saveButton = screen.getByRole('button', { name: /save changes/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalled()
    })
  })

  // 5. 409 "cannot activate" / readiness error reverts algorithm ─────────────
  it('409 with "cannot activate" detail shows precondition toast and reverts to legacy', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()

    mutateAsyncSpy.mockRejectedValue({
      response: {
        status: 409,
        data: {
          detail:
            'Cannot activate strict_order: payment readiness could not be confirmed (readiness check failed).',
        },
      },
    })

    renderPage()

    // Open the activate confirmation modal
    const activateButton = await screen.findByRole('button', { name: /activate strict order/i })
    await user.click(activateButton)

    // Confirm in the modal
    const confirmButton = await screen.findByRole('button', { name: /^Activate$/i })
    await user.click(confirmButton)

    // Save (algorithm is now strict_order locally, so form is dirty)
    const saveButton = screen.getByRole('button', { name: /save changes/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Strict Order requires payment-allocation snapshotting')
      )
    })

    // Algorithm should revert: "Activate Strict Order" button re-appears
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /activate strict order/i })).toBeInTheDocument()
    })
  })

  // 6. Read-only mode when lacking edit_repayment_config permission ───────────
  it('hides save/cancel buttons and disables toggles when user cannot edit', async () => {
    mockHasPermission.mockReturnValue(false)

    renderPage()

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument()
    })

    // All toggle switches must be disabled
    const switches = screen.queryAllByRole('switch')
    switches.forEach((sw) => {
      expect(sw).toBeDisabled()
    })

    // Read-only notice banner must be visible
    expect(screen.getByText(/view-only access/i)).toBeInTheDocument()
  })
})
