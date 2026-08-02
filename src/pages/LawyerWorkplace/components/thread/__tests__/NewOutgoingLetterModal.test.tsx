import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NewOutgoingLetterModal } from '../NewOutgoingLetterModal'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, fallback?: string | Record<string, unknown>) =>
        typeof fallback === 'string' ? fallback : key,
      i18n: { language: 'uk' },
    }),
  }
})

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

vi.mock('@/api/clientSearchApi', () => ({
  searchClients: vi.fn(() => Promise.resolve({ items: [] })),
}))

vi.mock('@/features/clients/hooks/useClientEmails', () => ({
  useClientEmails: () => ({ data: [], isLoading: false }),
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { user: { id: number } }) => unknown) =>
    selector({ user: { id: 99 } }),
}))

const sendOutgoingLetter = vi.fn((_payload: Record<string, unknown>) =>
  Promise.resolve({
    message_id: 'out-1',
    thread_id: 'thread-1',
    internet_message_id: '<out-1@example.com>',
    legal_document_id: 'doc-1',
    legal_document_number: 'ВИХ-1',
  })
)

vi.mock('@/features/lawyerWorkplace/api/legalApi', () => ({
  legalApi: {
    listMailboxes: vi.fn(() =>
      Promise.resolve({
        items: [
          {
            id: 'mb-1',
            email: 'legal@prionex.ua',
            display_name: 'Legal',
            status: 'connected',
            is_default_outgoing: true,
          },
        ],
      })
    ),
    listComposerReplyTemplates: vi.fn(() => Promise.resolve({ items: [], total: 0 })),
    sendOutgoingLetter: (payload: Record<string, unknown>) => sendOutgoingLetter(payload),
    uploadOutgoingStagedAttachment: vi.fn(),
    deleteOutgoingStagedAttachment: vi.fn(),
  },
  downloadLegalAttachment: vi.fn(),
  downloadLegalDocument: vi.fn(),
  exportLegalDocumentPdf: vi.fn(),
}))

function renderModal() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <NewOutgoingLetterModal open onClose={vi.fn()} onSent={vi.fn()} />
    </QueryClientProvider>
  )
}

describe('NewOutgoingLetterModal — always registered, no EDO mode', () => {
  beforeEach(() => {
    sendOutgoingLetter.mockClear()
  })

  it('has no EDO document-type selector', async () => {
    renderModal()
    await screen.findByPlaceholderText('Letter subject...')
    expect(screen.queryByText('EDO document type')).not.toBeInTheDocument()
    expect(screen.queryByText('ВИХ')).not.toBeInTheDocument()
    expect(screen.queryByText('НБУ')).not.toBeInTheDocument()
  })

  it('sends an outgoing-letter payload without an edo_type field', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.click(await screen.findByRole('button', { name: 'Institution / Court / NBU' }))
    await user.type(
      screen.getByPlaceholderText('e.g. National Bank of Ukraine'),
      'National Bank of Ukraine'
    )
    await user.type(screen.getByPlaceholderText('e.g. consumers@bank.gov.ua'), 'nbu@bank.gov.ua')
    await user.type(screen.getByPlaceholderText('Letter subject...'), 'Regarding complaint')
    await user.type(screen.getByPlaceholderText('Write your message...'), 'Letter body text')

    const send = screen.getByRole('button', { name: 'Send' })
    await waitFor(() => expect(send).toBeEnabled())
    await user.click(send)

    await waitFor(() => expect(sendOutgoingLetter).toHaveBeenCalledTimes(1))

    const [payload] = sendOutgoingLetter.mock.calls[0]!
    expect(payload).not.toHaveProperty('edo_type')
    expect(payload.institution_name).toBe('National Bank of Ukraine')
    expect(payload.to_addresses).toEqual(['nbu@bank.gov.ua'])
    expect(payload.assigned_to_user_id).toBe(99)
  })
})
