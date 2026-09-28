/**
 * What the admin is told when a rule change is refused.
 *
 * An error the backend attached to an input belongs under that input. One it
 * did not — "Rule not found", a 500 — has no input to sit under, and the card
 * used to store it anyway: the row stayed open saying nothing, and the person
 * had no way to learn why Save did nothing.
 */

import type { ReactNode } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}))

vi.mock('@/features/documentImportRules/api/documentImportRulesApi', () => ({
  documentImportRulesApi: {
    getRules: vi.fn(),
    getReadiness: vi.fn(),
    createRule: vi.fn(),
    updateRule: vi.fn(),
    deleteRule: vi.fn(),
    setDefaultType: vi.fn(),
  },
}))

import { toast } from 'sonner'
import { documentImportRulesApi } from '@/features/documentImportRules/api/documentImportRulesApi'
import { BulkUploadRuleSetCard } from '../components/BulkUploadRuleSetCard'
import type { DocumentImportRuleSet } from '@/features/documentImportRules'
import type { DocumentType } from '@/features/documentTypes'

const TYPES = [
  {
    id: 11,
    project_id: 1,
    name: 'Паспорт',
    color: '#111111',
    is_hidden: false,
    doc_count: 0,
    rule_count: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
] as unknown as DocumentType[]

const RULE_SET: DocumentImportRuleSet = {
  folder: 'credits',
  rules: [{ id: 5, position: 1, keyword: 'passport', document_type_id: 11 }],
  default_document_type_id: 11,
}

function renderCard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return render(
    <BulkUploadRuleSetCard folder="credits" ruleSet={RULE_SET} documentTypes={TYPES} />,
    { wrapper }
  )
}

/** Edit the existing rule and save it.

 * The edit row is used rather than the add row because the type is already
 * chosen there: this is about what happens to the error, not about the form.
 */
async function editAndSave() {
  // i18n is stubbed in tests: every label renders as its key.
  fireEvent.click(screen.getByLabelText('pages.documentGeneration.bulkRules.editRule'))

  fireEvent.change(screen.getByLabelText('pages.documentGeneration.bulkRules.columns.keyword'), {
    target: { value: 'pasport' },
  })

  fireEvent.click(await screen.findByRole('button', { name: 'actions.save' }))
}

describe('BulkUploadRuleSetCard — a refused save reaches the person', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a field error under the input it is about', async () => {
    vi.mocked(documentImportRulesApi.updateRule).mockRejectedValue({
      response: {
        data: { detail: { message: 'This keyword is already used in credits/', field: 'keyword' } },
      },
    })

    renderCard()
    await editAndSave()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This keyword is already used in credits/'
    )
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('toasts an error the backend did not attach to a field', async () => {
    // A plain-string detail: no field, so nowhere inline to render it.
    vi.mocked(documentImportRulesApi.updateRule).mockRejectedValue({
      response: { data: { detail: 'Rule not found' } },
    })

    renderCard()
    await editAndSave()

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Rule not found'))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
