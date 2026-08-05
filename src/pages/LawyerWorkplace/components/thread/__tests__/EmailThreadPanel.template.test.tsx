import { useState } from 'react'
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { LetterDetail } from '@/pages/LawyerWorkplace/types'
import { EmailThreadPanel } from '../EmailThreadPanel'

// Radix DropdownMenu relies on pointer-capture APIs jsdom doesn't implement.
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn(() => false)
  }
  Element.prototype.scrollIntoView = vi.fn()
})

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

const TEMPLATE_BODY =
  'Шановний {{clientName}}! Відправник: {{senderName}}. Вих. № {{outNo}}. {{companyName}}. Реф: {{incomingRef}}.'

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
    listComposerReplyTemplates: vi.fn(() =>
      Promise.resolve({
        items: [
          {
            id: 'tpl-1',
            name: 'Standard reply',
            body: TEMPLATE_BODY,
            letter_type_ids: [],
            is_active: true,
          },
        ],
        total: 1,
      })
    ),
    getMyLawyerProfile: vi.fn(() =>
      Promise.resolve({
        id: 'law-1',
        user_id: 42,
        display_name: 'Petro Yurydychnyi',
        initials: 'PY',
        role_title: 'Lawyer',
        letter_type_ids: [],
        current_active: 0,
        max_in_flight: 10,
        status: 'online',
        is_active: true,
      })
    ),
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
    uploadReplyStagedAttachment: vi.fn(),
    deleteReplyStagedAttachment: vi.fn(),
    replyToThread: vi.fn(),
  },
  downloadLegalAttachment: vi.fn(),
  downloadLegalDocument: vi.fn(),
  exportLegalDocumentPdf: vi.fn(),
}))

const letter: LetterDetail = {
  id: 'msg-1',
  referenceId: 'MSG-1',
  senderName: 'Client Sender',
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
      senderName: 'Client Sender',
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
      <MemoryRouter>
        <Harness />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('EmailThreadPanel — selecting a reply template prefills the composer', () => {
  it('fills known variables from context and leaves unknowns as placeholders', async () => {
    const user = userEvent.setup()
    renderPanel()

    // Open the template dropdown and pick the template.
    await user.click(screen.getByRole('button', { name: 'Template' }))
    await user.click(await screen.findByText('Standard reply'))

    const textarea = screen.getByPlaceholderText('Write your reply...')
    await waitFor(() => {
      // clientName + senderName + companyName filled; outNo + incomingRef (no
      // number in the subject) stay as placeholders.
      expect(textarea).toHaveValue(
        'Шановний Test Client! Відправник: Client Sender. Вих. № {{outNo}}. ТОВ «ФК «ТЕХНОФІНАНС». Реф: {{incomingRef}}.'
      )
    })
  })
})
