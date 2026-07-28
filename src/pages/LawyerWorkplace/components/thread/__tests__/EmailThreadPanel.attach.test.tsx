import { useState } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { LetterDetail } from '@/pages/LawyerWorkplace/types'
import { EmailThreadPanel } from '../EmailThreadPanel'

const { uploadSpy, previewSpy } = vi.hoisted(() => ({
  uploadSpy: vi.fn(),
  previewSpy: vi.fn(),
}))

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

// jsdom lacks the pointer-capture APIs Radix menus/dialogs rely on.
beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window.HTMLElement.prototype as any).hasPointerCapture = () => false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window.HTMLElement.prototype as any).setPointerCapture = () => undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window.HTMLElement.prototype as any).releasePointerCapture = () => undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window.HTMLElement.prototype as any).scrollIntoView = () => undefined
  uploadSpy.mockReset()
  uploadSpy.mockResolvedValue({
    id: 'att-1',
    filename: 'attached',
    size_bytes: 10,
    mailbox_id: 'mb-1',
  })
  previewSpy.mockReset()
  previewSpy.mockResolvedValue(new Blob(['pdf-bytes'], { type: 'application/pdf' }))
})

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
    getReplyDraft: vi.fn(() =>
      Promise.resolve({
        exists: false,
        message_id: 'msg-1',
        mailbox_id: null,
        body_text: '',
        edo_type: 'none',
        updated_at: '',
      })
    ),
    listReplyStagedAttachments: vi.fn(() => Promise.resolve({ items: [], total: 0 })),
    saveReplyDraft: vi.fn(),
    uploadReplyStagedAttachment: uploadSpy,
    deleteReplyStagedAttachment: vi.fn(),
    replyToThread: vi.fn(() => Promise.resolve({})),
  },
  downloadLegalAttachment: vi.fn(),
  downloadLegalDocument: vi.fn(),
  exportLegalDocumentPdf: vi.fn(),
}))

vi.mock('@/features/clients/api/documentApi', () => ({
  documentApi: {
    list: vi.fn(),
    preview: previewSpy,
    download: vi.fn(),
    upload: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('@/features/clients/hooks/useClients', () => ({
  useClientLoans: () => ({
    data: [{ id: 555, contract_number: 'L-1', seller_company: 'Acme', status: 'active' }],
  }),
  useClientDocuments: () => ({
    data: [
      {
        id: 501,
        client_id: 10,
        debt_id: null,
        original_filename: 'passport.pdf',
        document_type_id: null,
        document_type_ref: null,
        mime_type: 'application/pdf',
        file_size: 1234,
        source: null,
        uploaded_by: null,
        created_at: '2026-07-01T00:00:00Z',
      },
    ],
    isLoading: false,
    isError: false,
  }),
}))

// Stub the (cross-page) generation modal: it just exposes the prefill it was
// handed and a button that fires onGenerated with a server-like response.
vi.mock('@/pages/ClientManagement/components/GenerateDocumentModal', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  GenerateDocumentModal: (props: any) =>
    props.open ? (
      <div data-testid="generate-stub">
        <span data-testid="prefill-channel">{props.prefill?.deliveryChannel}</span>
        <span data-testid="prefill-contact">{props.prefill?.deliveryContact}</span>
        <button
          type="button"
          onClick={() =>
            props.onGenerated?.({
              document_id: 777,
              document_name: 'Demand',
              index_num: 1,
              pdf_document: { id: 777, original_filename: 'demand.pdf' },
              docx_base64: 'AAA=',
            })
          }
        >
          fire-generated
        </button>
      </div>
    ) : null,
}))

const letter: LetterDetail = {
  id: 'msg-1',
  referenceId: 'MSG-1',
  senderName: 'Client',
  senderEmail: 'client@example.com',
  routeFromEmail: 'client@example.com',
  routeToEmail: 'legal@prionex.ua',
  direction: 'incoming',
  receivedAt: '2026-07-02T09:00:00Z',
  subject: 'Payment complaint',
  mailbox: 'legal@prionex.ua',
  letterType: 'complaint',
  letterTypeLabel: 'Complaint',
  clientId: '10',
  clientName: 'Test Client',
  clientCode: 'CL-10',
  status: 'in_progress',
  isUnprocessed: false,
  recipientEmail: 'legal@prionex.ua',
  thread: [
    {
      id: 'msg-1',
      direction: 'incoming',
      senderName: 'Client',
      senderEmail: 'client@example.com',
      sentAt: '2026-07-02T09:00:00Z',
      body: 'Original body',
      bodyFormat: 'text',
    },
  ],
  parameters: {
    letterType: 'complaint',
    clientId: '10',
    clientLabel: 'CL-10 · Test Client',
    clientLockedByEmail: false,
    clientProjectId: 1,
    contractId: 'C-1',
    contractLabel: 'C-1',
    dueDate: '2026-07-10',
    dueDateHint: '',
    lawyerId: '42',
    lawyerLabel: 'Lawyer',
    autoConfidence: 0,
    confirmedCount: 4,
    totalParameters: 4,
  },
  replyDraft: '',
  replyContext: {
    threadId: 'thread-1',
    mailboxId: 'mb-1',
    inReplyToMessageId: 'msg-1',
    clientId: 10,
    assignedUserId: 42,
  },
}

function Harness() {
  const [draft, setDraft] = useState('')
  return <EmailThreadPanel letter={letter} replyDraft={draft} onReplyDraftChange={setDraft} />
}

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness />
    </QueryClientProvider>
  )
}

describe('EmailThreadPanel — attach client document + generate into reply', () => {
  it('attaches a document already on the client as a File (mock blob → upload)', async () => {
    const user = userEvent.setup()
    renderPanel()

    await screen.findByRole('button', { name: 'Send' })
    await user.click(screen.getByRole('button', { name: 'Attach' }))
    await user.click(await screen.findByText('Attached file on client'))

    // The picker lists the client's documents.
    await user.click(await screen.findByText('passport.pdf'))

    await waitFor(() => expect(previewSpy).toHaveBeenCalledWith(10, 501))
    await waitFor(() => expect(uploadSpy).toHaveBeenCalledTimes(1))

    const [messageId, mailboxId, file] = uploadSpy.mock.calls[0]!
    expect(messageId).toBe('msg-1')
    expect(mailboxId).toBe('mb-1')
    expect(file).toBeInstanceOf(File)
    expect((file as File).name).toBe('passport.pdf')
  })

  it('generates from the reply with email prefill and auto-attaches the PDF', async () => {
    const user = userEvent.setup()
    renderPanel()

    await screen.findByRole('button', { name: 'Send' })
    await user.click(screen.getByRole('button', { name: 'Attach' }))
    await user.click(await screen.findByText('Generate document'))

    // Prefill: email channel + the client's from-address.
    expect(screen.getByTestId('prefill-channel')).toHaveTextContent('email')
    expect(screen.getByTestId('prefill-contact')).toHaveTextContent('client@example.com')

    await user.click(screen.getByText('fire-generated'))

    await waitFor(() => expect(previewSpy).toHaveBeenCalledWith(10, 777))
    await waitFor(() => expect(uploadSpy).toHaveBeenCalledTimes(1))

    const [, , file] = uploadSpy.mock.calls[0]!
    expect(file).toBeInstanceOf(File)
    expect((file as File).name).toBe('demand.pdf')
  })
})
