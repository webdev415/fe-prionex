/**
 * DebtWriteoffSection — permission-gating + per-row affordance tests.
 *
 * KAN-245 / Phase 9 / REQUIREMENTS §9.5 (e2e-equivalent at component
 * level; the project uses Vitest + RTL rather than Playwright).
 *
 * Scenarios from §9.5:
 *   - Operator without ``cancel_writeoffs`` does NOT see Cancel button.
 *   - Operator without ``edit_writeoffs``   does NOT see Edit button.
 *   - Active entry shows both buttons when both perms are present.
 *   - Cancelled entry shows NEITHER button (terminal status).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { DebtWriteoffSection } from '../DebtWriteoffSection'
import type { WriteoffEntry } from '@/features/writeoffs/api/types'

// --- mocks ------------------------------------------------------------------

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && typeof opts === 'object' && 'defaultValue' in opts) {
        return (opts as { defaultValue: string }).defaultValue
      }
      return key
    },
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const mockPermissions = vi.hoisted(() => new Set<string>())
vi.mock('@/hooks/usePermissions', () => ({
  useHasPermission: (perm: string) => mockPermissions.has(perm),
}))

// --- fixtures ---------------------------------------------------------------

const activeEntry: WriteoffEntry = {
  id: 1,
  debt_id: 100,
  accrual_type: 'interest',
  amount: '500.00',
  cancellation_date: '2099-12-31',
  created_at: '2026-05-25T10:00:00Z',
  created_by: { user_id: 42, name: 'Operator A' },
  creation_source: 'individual',
  notes: 'legal settlement',
  cancelled_at: null,
  cancellation_source: null,
  cancellation_actor: null,
  cancellation_reason: null,
  status: 'active',
}

const cancelledEntry: WriteoffEntry = {
  ...activeEntry,
  id: 2,
  cancelled_at: '2026-05-26T08:00:00Z',
  cancellation_source: 'manual',
  cancellation_actor: { user_id: 99, name: 'Operator B' },
  cancellation_reason: 'wrong loan',
  status: 'cancelled',
}

type ListResult = {
  items: WriteoffEntry[]
  pagination: { page: number; page_size: number; total: number }
}
const mockListResult = vi.hoisted(() => ({
  current: { items: [], pagination: { page: 1, page_size: 50, total: 0 } } as ListResult,
}))

vi.mock('@/features/writeoffs/hooks/useWriteoffs', () => ({
  writeoffKeys: {
    all: ['writeoffs'],
    lists: () => ['writeoffs', 'list'],
    list: () => ['writeoffs', 'list'],
    byDebt: (id: number) => ['writeoffs', 'debt', id],
    detail: (id: number) => ['writeoffs', 'detail', id],
  },
  useWriteoffsForDebt: () => ({
    data: mockListResult.current,
    isLoading: false,
    error: null,
  }),
  useCancelWriteoff: () => ({ mutate: vi.fn(), isPending: false }),
  useEditWriteoff: () => ({ mutate: vi.fn(), isPending: false }),
  extractWriteoffErrors: () => null,
}))

// --- helpers ---------------------------------------------------------------

function renderWith(permissions: string[]) {
  mockPermissions.clear()
  permissions.forEach((p) => mockPermissions.add(p))
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <DebtWriteoffSection debtId={100} />
    </QueryClientProvider>
  )
}

// --- tests -----------------------------------------------------------------

describe('DebtWriteoffSection — per-row affordances (REQUIREMENTS §9.5)', () => {
  beforeEach(() => {
    mockListResult.current = {
      items: [activeEntry],
      pagination: { page: 1, page_size: 50, total: 1 },
    }
  })

  it('shows both Edit and Cancel buttons when both perms granted', async () => {
    renderWith(['edit_writeoffs', 'cancel_writeoffs'])
    await waitFor(() => {
      expect(screen.getByText(/common\.edit/i)).toBeInTheDocument()
      expect(screen.getByText(/common\.cancel/i)).toBeInTheDocument()
    })
  })

  it('operator without cancel_writeoffs does NOT see the per-row Cancel button', async () => {
    renderWith(['edit_writeoffs'])
    await waitFor(() => {
      expect(screen.getByText(/common\.edit/i)).toBeInTheDocument()
    })
    expect(screen.queryByText(/common\.cancel/i)).not.toBeInTheDocument()
  })

  it('operator without edit_writeoffs does NOT see the per-row Edit button', async () => {
    renderWith(['cancel_writeoffs'])
    await waitFor(() => {
      expect(screen.getByText(/common\.cancel/i)).toBeInTheDocument()
    })
    expect(screen.queryByText(/common\.edit/i)).not.toBeInTheDocument()
  })

  it('cancelled entries show NEITHER button (terminal status)', async () => {
    mockListResult.current = {
      items: [cancelledEntry],
      pagination: { page: 1, page_size: 50, total: 1 },
    }
    renderWith(['edit_writeoffs', 'cancel_writeoffs'])
    await waitFor(() => {
      // The entry's amount renders, so the section loaded
      expect(screen.getByText(/500\.00/)).toBeInTheDocument()
    })
    expect(screen.queryByText(/common\.edit/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/common\.cancel/i)).not.toBeInTheDocument()
  })

  it('renders the cancellation source label for a cancelled entry', async () => {
    mockListResult.current = {
      items: [cancelledEntry],
      pagination: { page: 1, page_size: 50, total: 1 },
    }
    renderWith(['edit_writeoffs', 'cancel_writeoffs'])
    await waitFor(() => {
      expect(
        screen.getByText(/pages\.clients\.detail\.writeOffSection\.cancellationSource\.manual/)
      ).toBeInTheDocument()
    })
  })

  it('renders empty-state when no entries exist', async () => {
    mockListResult.current = {
      items: [],
      pagination: { page: 1, page_size: 50, total: 0 },
    }
    renderWith(['view_writeoffs'])
    await waitFor(() => {
      expect(
        screen.getByText(/pages\.clients\.detail\.writeOffSection\.noActiveEntries/)
      ).toBeInTheDocument()
    })
  })
})
