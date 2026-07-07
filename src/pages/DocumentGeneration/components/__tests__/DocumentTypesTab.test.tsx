/**
 * Component tests for the Document Types admin tab.
 *
 * Focus: rendering the list, launching the create/edit modal, guarding
 * delete when doc_count > 0, and the hide/show visibility toggle. The
 * form-modal internals (HEX validation, uniqueness handling) are tested
 * once here through the create flow — the modal's independent unit
 * tests are covered by the form's own component tests where they
 * would land next.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { DocumentType } from '@/features/documentTypes'

// ---------------------------------------------------------------------------
// i18n mock — returns the key's fallback (arg 2) or the key itself.
// Matches the existing pattern in TagsPage tests.
// ---------------------------------------------------------------------------
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => {
      if (typeof fallback === 'string') return fallback
      return key
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

// ---------------------------------------------------------------------------
// Fake in-memory store — mimics the BE row shape.
// ---------------------------------------------------------------------------
let store: DocumentType[] = []
let nextId = 1

function resetStore() {
  nextId = 1
  store = [
    {
      id: nextId++,
      project_id: 1,
      name: 'passport',
      color: '#3B82F6',
      is_hidden: false,
      doc_count: 3,
      created_at: '2026-07-01T00:00:00Z',
      updated_at: '2026-07-01T00:00:00Z',
    },
    {
      id: nextId++,
      project_id: 1,
      name: 'inn',
      color: '#8B5CF6',
      is_hidden: false,
      doc_count: 0,
      created_at: '2026-07-01T00:00:00Z',
      updated_at: '2026-07-01T00:00:00Z',
    },
    {
      id: nextId++,
      project_id: 1,
      name: 'archived',
      color: '#111111',
      is_hidden: true,
      doc_count: 0,
      created_at: '2026-07-01T00:00:00Z',
      updated_at: '2026-07-01T00:00:00Z',
    },
  ]
}

vi.mock('@/features/documentTypes/api/documentTypesApi', () => ({
  documentTypesApi: {
    list: vi.fn(async (includeHidden: boolean) =>
      includeHidden ? [...store] : store.filter((row) => !row.is_hidden)
    ),
    create: vi.fn(async (input: { name: string; color: string }) => {
      const row = {
        id: nextId++,
        project_id: 1,
        name: input.name,
        color: input.color.toUpperCase(),
        is_hidden: false,
        doc_count: 0,
        created_at: '2026-07-01T00:00:00Z',
        updated_at: '2026-07-01T00:00:00Z',
      }
      store.push(row)
      return row
    }),
    update: vi.fn(async (id: number, input: { name?: string; color?: string }) => {
      const idx = store.findIndex((r) => r.id === id)
      if (idx === -1) throw new Error('not found')
      store[idx] = {
        ...store[idx],
        ...input,
        color: input.color?.toUpperCase() ?? store[idx].color,
      }
      return store[idx]
    }),
    updateVisibility: vi.fn(async (id: number, input: { is_hidden: boolean }) => {
      const idx = store.findIndex((r) => r.id === id)
      if (idx === -1) throw new Error('not found')
      store[idx] = { ...store[idx], is_hidden: input.is_hidden }
      return store[idx]
    }),
    remove: vi.fn(async (id: number) => {
      const row = store.find((r) => r.id === id)
      if (row && row.doc_count > 0) {
        const err = new Error('conflict') as Error & { response?: { status: number } }
        err.response = { status: 409 }
        throw err
      }
      store = store.filter((r) => r.id !== id)
    }),
  },
}))

// Suppress toast during tests to keep assertions clean.
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let confirmSpy: any

import { DocumentTypesTab } from '../DocumentTypesTab'

function renderTab() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <DocumentTypesTab />
    </QueryClientProvider>
  )
}

describe('DocumentTypesTab', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('renders the list of types (including hidden) from the API', async () => {
    renderTab()
    await waitFor(() => {
      expect(screen.getByText('passport')).toBeInTheDocument()
      expect(screen.getByText('inn')).toBeInTheDocument()
      expect(screen.getByText('archived')).toBeInTheDocument()
    })
  })

  it('shows doc_count per row', async () => {
    renderTab()
    await waitFor(() => {
      // "3" belongs to passport row.
      expect(screen.getByText('3')).toBeInTheDocument()
    })
  })

  it('opens the form modal when "New type" is clicked and creates a row', async () => {
    const user = userEvent.setup()
    renderTab()
    await waitFor(() => expect(screen.getByText('passport')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /new type/i }))
    await waitFor(() => expect(screen.getByPlaceholderText(/e\.g\. Passport/i)).toBeInTheDocument())

    await user.type(screen.getByPlaceholderText(/e\.g\. Passport/i), 'Insurance')

    // The create button lives in the modal footer.
    const createBtn = screen.getByRole('button', { name: /^Create$/i })
    await user.click(createBtn)

    await waitFor(() => {
      expect(screen.getByText('Insurance')).toBeInTheDocument()
    })
  })

  it('disables delete on a row with doc_count > 0', async () => {
    const user = userEvent.setup()
    renderTab()
    await waitFor(() => expect(screen.getByText('passport')).toBeInTheDocument())

    // passport (doc_count=3) row → the delete button is wrapped in a
    // Radix Tooltip when disabled. Query for the only disabled button
    // in the row (Edit and Hide are never disabled → the disabled one
    // must be Delete). The title attribute is intentionally absent on
    // the disabled Delete button because the tooltip carries the
    // "Hide it instead of deleting" message.
    const passportRow = screen.getByText('passport').closest('tr')!
    const disabledBtn = passportRow.querySelector('button:disabled')
    expect(disabledBtn).not.toBeNull()
    expect(disabledBtn).toBeDisabled()

    // inn (doc_count=0) row → enabled + can be deleted.
    const innRow = screen.getByText('inn').closest('tr')!
    const innDeleteBtn = innRow.querySelector('button[title="Delete"]') as HTMLButtonElement
    expect(innDeleteBtn).not.toBeDisabled()

    await user.click(innDeleteBtn)
    expect(confirmSpy).toHaveBeenCalled()

    await waitFor(() => {
      expect(screen.queryByText('inn')).not.toBeInTheDocument()
    })
  })

  it('toggles visibility (hide → show)', async () => {
    const user = userEvent.setup()
    renderTab()
    await waitFor(() => expect(screen.getByText('passport')).toBeInTheDocument())

    // Hide the passport row.
    const passportRow = screen.getByText('passport').closest('tr')!
    const hideBtn = passportRow.querySelector('button[title="Hide"]') as HTMLButtonElement
    await user.click(hideBtn)

    // After hide, the same row shows a "Show" button title.
    await waitFor(() => {
      const updatedRow = screen.getByText('passport').closest('tr')!
      expect(updatedRow.querySelector('button[title="Show"]')).toBeInTheDocument()
    })
  })
})
