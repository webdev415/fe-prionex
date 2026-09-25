/**
 * Component tests for the Bulk Upload Rules tab.
 *
 * The behaviours worth pinning are the ones an admin would notice being wrong:
 * Order is a position the backend renumbers (so the screen must render the set
 * it answers with, not a locally patched row), a refused keyword belongs under
 * the keyword input rather than in a toast, a folder without a default says so
 * where it blocks the upload, and hidden types stay choosable here.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { DocumentType } from '@/features/documentTypes'
import type {
  DocumentImportRulesConfig,
  DocumentImportRuleSet,
} from '@/features/documentImportRules'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown, options?: Record<string, unknown>) => {
      const text = typeof fallback === 'string' ? fallback : key
      const values = (typeof fallback === 'object' ? fallback : options) as
        | Record<string, unknown>
        | undefined
      if (!values) return text
      return text.replace(/\{\{(\w+)\}\}/g, (_m, name: string) => String(values[name] ?? ''))
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

// Confirmations are answered yes: the dialog itself has its own tests.
vi.mock('@/components/ui/useConfirm', () => ({
  useConfirm: () => ({ confirm: vi.fn(async () => true), confirmDialog: null }),
}))

const TYPES: DocumentType[] = [
  {
    id: 11,
    project_id: 1,
    name: 'passport',
    color: '#3B82F6',
    is_hidden: false,
    doc_count: 0,
    rule_count: 1,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
  {
    id: 12,
    project_id: 1,
    name: 'archived type',
    color: '#111111',
    is_hidden: true,
    doc_count: 0,
    rule_count: 0,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
]

function ruleSet(folder: 'credits' | 'users', overrides: Partial<DocumentImportRuleSet> = {}) {
  return {
    folder,
    rules: [],
    default_document_type_id: 11,
    ...overrides,
  } as DocumentImportRuleSet
}

let config: DocumentImportRulesConfig

const api = {
  getRules: vi.fn(async () => config),
  getReadiness: vi.fn(async () => ({ ready: true, missing_defaults: [] })),
  createRule: vi.fn(),
  updateRule: vi.fn(),
  deleteRule: vi.fn(),
  setDefaultType: vi.fn(),
}

vi.mock('@/features/documentImportRules/api/documentImportRulesApi', () => ({
  documentImportRulesApi: {
    getRules: (...args: unknown[]) => api.getRules(...(args as [])),
    getReadiness: (...args: unknown[]) => api.getReadiness(...(args as [])),
    createRule: (...args: unknown[]) => api.createRule(...(args as [])),
    updateRule: (...args: unknown[]) => api.updateRule(...(args as [])),
    deleteRule: (...args: unknown[]) => api.deleteRule(...(args as [])),
    setDefaultType: (...args: unknown[]) => api.setDefaultType(...(args as [])),
  },
}))

const listTypes = vi.fn(async (includeHidden: boolean) =>
  includeHidden ? TYPES : TYPES.filter((type) => !type.is_hidden)
)

vi.mock('@/features/documentTypes/api/documentTypesApi', () => ({
  documentTypesApi: {
    list: (...args: unknown[]) => listTypes(...(args as [boolean])),
    create: vi.fn(),
    update: vi.fn(),
    updateVisibility: vi.fn(),
    remove: vi.fn(),
  },
}))

import { BulkUploadRulesTab } from '../BulkUploadRulesTab'

function renderTab() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <BulkUploadRulesTab />
    </QueryClientProvider>
  )
}

/** The credits card, addressed the way a reader would: by its heading. */
function creditsCard() {
  return screen.getByRole('heading', { name: 'credits/ folder' }).closest('div')!
    .parentElement as HTMLElement
}

beforeEach(() => {
  vi.clearAllMocks()
  config = {
    credits: ruleSet('credits', {
      rules: [
        { id: 1, position: 1, keyword: 'credit_passport', document_type_id: 11 },
        { id: 2, position: 2, keyword: 'passport', document_type_id: 12 },
      ],
    }),
    users: ruleSet('users'),
    ready: true,
  }
})

describe('BulkUploadRulesTab', () => {
  it('shows each folder its own rules, in Order', async () => {
    renderTab()
    await screen.findByText('credit_passport')

    const credits = creditsCard()
    const first = within(credits).getByText('credit_passport').closest('tr') as HTMLElement
    expect(within(first).getByText('1')).toBeInTheDocument()
    // The type of each rule is rendered by name, resolved from the types list.
    expect(within(first).getByText('passport')).toBeInTheDocument()

    // users/ carries none of the credits rules — the two sets are independent.
    const users = screen.getByRole('heading', { name: 'users/ folder' }).closest('div')!
      .parentElement as HTMLElement
    expect(within(users).queryByText('credit_passport')).not.toBeInTheDocument()
    expect(within(users).getByText(/No rules yet/)).toBeInTheDocument()
  })

  it('renders the renumbering the backend answers with, not a local guess', async () => {
    // Saving onto Order 1 pushes the existing rule down; the response is the
    // whole set, and that is what has to reach the screen.
    api.createRule.mockResolvedValueOnce(
      ruleSet('credits', {
        rules: [
          { id: 3, position: 1, keyword: 'dogovir', document_type_id: 11 },
          { id: 1, position: 2, keyword: 'credit_passport', document_type_id: 11 },
          { id: 2, position: 3, keyword: 'passport', document_type_id: 12 },
        ],
      })
    )
    const user = userEvent.setup()
    renderTab()
    await screen.findByText('credit_passport')

    await user.click(within(creditsCard()).getByRole('button', { name: 'Add rule' }))
    await user.clear(within(creditsCard()).getByLabelText('Order'))
    await user.type(within(creditsCard()).getByLabelText('Order'), '1')
    await user.type(within(creditsCard()).getByLabelText('Keyword'), 'dogovir')
    await user.click(within(creditsCard()).getAllByLabelText('Document type')[0])
    await user.click(await screen.findByRole('option', { name: /passport/ }))
    await user.click(within(creditsCard()).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.createRule).toHaveBeenCalled())
    const [folder, input] = api.createRule.mock.calls[0]
    expect(folder).toBe('credits')
    expect(input).toMatchObject({ position: 1, keyword: 'dogovir', document_type_id: 11 })

    const rows = await screen.findAllByText(/dogovir|credit_passport/)
    expect(rows.length).toBeGreaterThan(0)
    // The pushed-down rule now reads 2, which only the response could say.
    await waitFor(() => {
      const card = creditsCard()
      const row = within(card).getByText('credit_passport').closest('tr') as HTMLElement
      expect(within(row).getByText('2')).toBeInTheDocument()
    })
  })

  it('re-reads the document types after a rule changes', async () => {
    // Each type row carries the number of rules pointing at it, and that is
    // what disables its Delete button on the Document Types tab. Left cached,
    // a type that just became a rule's target still offers Delete — and the
    // click fails with the 409 the disabled button exists to prevent.
    api.createRule.mockResolvedValueOnce(
      ruleSet('credits', {
        rules: [{ id: 9, position: 1, keyword: 'akt', document_type_id: 12 }],
      })
    )
    const user = userEvent.setup()
    renderTab()
    await screen.findByText('credit_passport')
    const before = listTypes.mock.calls.length

    await user.click(within(creditsCard()).getByRole('button', { name: 'Add rule' }))
    await user.type(within(creditsCard()).getByLabelText('Keyword'), 'akt')
    await user.click(within(creditsCard()).getAllByLabelText('Document type')[0])
    await user.click(await screen.findByRole('option', { name: /archived type/ }))
    await user.click(within(creditsCard()).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.createRule).toHaveBeenCalled())
    await waitFor(() => expect(listTypes.mock.calls.length).toBeGreaterThan(before))
  })

  it('puts a refused keyword under the keyword input, not in a toast', async () => {
    api.createRule.mockRejectedValueOnce({
      response: {
        status: 409,
        data: { detail: { message: 'This keyword is already used in credits/', field: 'keyword' } },
      },
    })
    const user = userEvent.setup()
    renderTab()
    await screen.findByText('credit_passport')

    await user.click(within(creditsCard()).getByRole('button', { name: 'Add rule' }))
    await user.type(within(creditsCard()).getByLabelText('Keyword'), 'PASSPORT')
    await user.click(within(creditsCard()).getAllByLabelText('Document type')[0])
    await user.click(await screen.findByRole('option', { name: /passport/ }))
    await user.click(within(creditsCard()).getByRole('button', { name: 'Save' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('This keyword is already used in credits/')
    // Still editing: a refused rule must not be dismissed as if it were saved.
    expect(within(creditsCard()).getByLabelText('Keyword')).toHaveValue('PASSPORT')
  })

  it('says a folder without a default blocks the upload', async () => {
    config = {
      ...config,
      users: ruleSet('users', { default_document_type_id: null }),
      ready: false,
    }
    renderTab()

    expect(
      await screen.findByText(/Bulk document upload is blocked until a default/)
    ).toHaveTextContent('users/')
  })

  it('offers hidden types too — hiding one removes it from uploads, not from rules', async () => {
    const user = userEvent.setup()
    renderTab()
    await screen.findByText('credit_passport')

    await user.click(within(creditsCard()).getByRole('button', { name: 'Add rule' }))
    await user.click(within(creditsCard()).getAllByLabelText('Document type')[0])

    expect(await screen.findByRole('option', { name: /archived type/ })).toBeInTheDocument()
  })

  it('deletes a rule and keeps the set the backend answers with', async () => {
    api.deleteRule.mockResolvedValueOnce(
      ruleSet('credits', {
        rules: [{ id: 2, position: 1, keyword: 'passport', document_type_id: 12 }],
      })
    )
    const user = userEvent.setup()
    renderTab()
    await screen.findByText('credit_passport')

    await user.click(
      within(creditsCard()).getByRole('button', { name: 'Delete rule credit_passport' })
    )

    await waitFor(() => expect(api.deleteRule).toHaveBeenCalledWith('credits', 1))
    await waitFor(() =>
      expect(within(creditsCard()).queryByText('credit_passport')).not.toBeInTheDocument()
    )
  })
})
