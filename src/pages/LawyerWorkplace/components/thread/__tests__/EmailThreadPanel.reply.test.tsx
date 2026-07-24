import { useState } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { LetterDetail } from '@/pages/LawyerWorkplace/types'
import { EmailThreadPanel } from '../EmailThreadPanel'

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

const replyToThreadSpy = vi.fn((_threadId: string, _payload: Record<string, unknown>) =>
  Promise.resolve({
    message_id: 'm2',
    thread_id: 'thread-1',
    internet_message_id: '<m2@example.com>',
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
    getReplyDraft: vi.fn(() =>
      Promise.resolve({
        exists: true,
        message_id: 'msg-1',
        mailbox_id: 'mb-1',
        body_text: 'Draft reply',
        edo_type: 'none',
        updated_at: '',
      })
    ),
    listReplyStagedAttachments: vi.fn(() => Promise.resolve({ items: [], total: 0 })),
    saveReplyDraft: vi.fn(),
    uploadReplyStagedAttachment: vi.fn(),
    deleteReplyStagedAttachment: vi.fn(),
    replyToThread: (threadId: string, payload: Record<string, unknown>) =>
      replyToThreadSpy(threadId, payload),
  },
  downloadLegalAttachment: vi.fn(),
  downloadLegalDocument: vi.fn(),
  exportLegalDocumentPdf: vi.fn(),
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

describe('EmailThreadPanel — reply always registers, no EDO mode', () => {
  beforeEach(() => {
    replyToThreadSpy.mockClear()
  })

  it('sends a reply payload without an edo_type field', async () => {
    const user = userEvent.setup()
    renderPanel()

    const send = await screen.findByRole('button', { name: 'Send' })
    await waitFor(() => expect(send).toBeEnabled())
    await user.click(send)

    await waitFor(() => expect(replyToThreadSpy).toHaveBeenCalledTimes(1))

    const [threadId, payload] = replyToThreadSpy.mock.calls[0]!
    expect(threadId).toBe('thread-1')
    // Registration mode is gone: the payload must not carry edo_type at all.
    expect(payload).not.toHaveProperty('edo_type')
    // Registration metadata from context is still forwarded.
    expect(payload.client_id).toBe(10)
    expect(payload.assigned_to_user_id).toBe(42)
    expect(payload.body_text).toBe('Draft reply')
  })
})
