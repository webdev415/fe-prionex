/**
 * Lawyer Workplace smoke tests (KAN-486).
 *
 * Component-level flow coverage with mocked legal APIs — the project uses
 * Vitest + RTL rather than Playwright for frontend E2E-style checks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LawyerWorkplacePage } from '../LawyerWorkplacePage'

const mockPermissions = vi.hoisted(() => new Set<string>())

const inboxItem = vi.hoisted(() => ({
  id: 'msg-1',
  thread_id: 'thread-1',
  mailbox_id: 'mb-1',
  subject: 'Late payment complaint',
  from_address: 'client@example.com',
  processing_status: 'in_progress',
  direction: 'incoming',
  received_at: '2026-06-24T09:00:00Z',
  is_quarantined: false,
  needs_manual_review: false,
  suggested_letter_type_id: 'complaint',
  suggested_client_id: null,
  suggested_lawyer_user_id: null,
  auto_process_eligible: false,
}))

const messageDetail = vi.hoisted(() => ({
  id: 'msg-1',
  thread_id: 'thread-1',
  mailbox_id: 'mb-1',
  internet_message_id: '<msg-1@example.com>',
  subject: 'Late payment complaint',
  from_address: 'client@example.com',
  to_addresses: ['legal@prionex.ua'],
  cc_addresses: [] as string[],
  body_text: 'Please review my complaint.',
  body_html: null,
  processing_status: 'in_progress',
  direction: 'incoming',
  received_at: '2026-06-24T09:00:00Z',
  sent_at: null,
  is_quarantined: false,
  quarantine_reason: null,
  needs_manual_review: false,
  suggested_letter_type_id: 'complaint',
  suggested_client_id: null,
  suggested_lawyer_user_id: null,
  auto_process_eligible: false,
  attachments: [] as [],
}))

const threadDetail = vi.hoisted(() => ({
  id: 'thread-1',
  subject: 'Late payment complaint',
  root_message_id: 'msg-1',
  messages: [
    {
      id: 'msg-1',
      direction: 'incoming',
      from_address: 'client@example.com',
      subject: 'Late payment complaint',
      body_text: 'Please review my complaint.',
      body_html: null,
      received_at: '2026-06-24T09:00:00Z',
      sent_at: null,
      processing_status: 'in_progress',
      is_quarantined: false,
      to_addresses: [] as string[],
      attachments: [] as [],
    },
  ],
}))

const emptyList = vi.hoisted(() => ({ items: [] as unknown[], total: 0 }))

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, fallback?: string | Record<string, unknown>) => {
        if (typeof fallback === 'string') return fallback
        if (fallback && typeof fallback === 'object' && 'defaultValue' in fallback) {
          return String((fallback as { defaultValue: string }).defaultValue)
        }
        return key
      },
      i18n: { language: 'en' },
    }),
  }
})

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

vi.mock('@/hooks/usePermissions', () => ({
  useHasPermission: (perm: string) => mockPermissions.has(perm),
  useHasAnyPermission: (perms: string[]) => perms.some((perm) => mockPermissions.has(perm)),
}))

vi.mock('@/features/clients/hooks/useClients', () => ({
  useClients: () => ({ data: { items: [] }, isLoading: false, isError: false }),
  useClient: () => ({ data: null, isLoading: false, isError: false }),
  useClientLoans: () => ({ data: [] }),
  useClientDocuments: () => ({ data: [], isLoading: false, isError: false }),
}))

vi.mock('@/features/users/hooks/useUsers', () => ({
  useOperators: () => ({ data: [], isLoading: false }),
}))

vi.mock('@/features/lawyerWorkplace/api/legalApi', () => ({
  legalApi: {
    listInbox: vi.fn(() =>
      Promise.resolve({
        items: [inboxItem],
        total: 1,
        page: 1,
        page_size: 50,
        connected_mailboxes: 2,
        unprocessed_count: 1,
        count_all: 1,
        count_new: 0,
        count_in_progress: 1,
        count_done: 0,
      })
    ),
    getMessage: vi.fn(() => Promise.resolve(messageDetail)),
    getThread: vi.fn(() => Promise.resolve(threadDetail)),
    listMailboxes: vi.fn(() => Promise.resolve(emptyList)),
    listKanban: vi.fn(() => Promise.resolve(emptyList)),
    listLetterTypes: vi.fn(() =>
      Promise.resolve({
        items: [
          {
            id: 'complaint',
            slug: 'complaint',
            name: 'Complaint',
            color_id: 'red',
            sla_days: 30,
            description: null,
            keyword_hints: [],
            is_active: true,
            letter_count: 0,
            examples: [],
            priorities: [],
          },
        ],
        total: 1,
      })
    ),
    listLawyers: vi.fn(() => Promise.resolve(emptyList)),
    listDocuments: vi.fn(() => Promise.resolve({ items: [], total: 0, page: 1, page_size: 20 })),
    getDocumentStats: vi.fn(() =>
      Promise.resolve({
        incoming_count: 0,
        incoming_year_total: 0,
        outgoing_count: 0,
        outgoing_year_total: 0,
        nbu_count: 0,
        nbu_year_total: 0,
        generated_percent: 0,
      })
    ),
    listSettingsMailboxes: vi.fn(() => Promise.resolve(emptyList)),
    getSyncSettings: vi.fn(() =>
      Promise.resolve({ sync_interval: '15m', last_synced_at: '2026-07-03T04:00:00Z' })
    ),
    listReplyTemplates: vi.fn(() => Promise.resolve(emptyList)),
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
    saveReplyDraft: vi.fn((messageId: string) =>
      Promise.resolve({
        exists: true,
        message_id: messageId,
        mailbox_id: null,
        body_text: '',
        edo_type: 'none',
        updated_at: '',
      })
    ),
    deleteReplyDraft: vi.fn(() => Promise.resolve()),
    listReplyStagedAttachments: vi.fn(() => Promise.resolve({ items: [], total: 0 })),
    uploadReplyStagedAttachment: vi.fn(),
    deleteReplyStagedAttachment: vi.fn(() => Promise.resolve()),
    listComposerReplyTemplates: vi.fn(() => Promise.resolve(emptyList)),
  },
}))

function renderWorkplace(initialUrl = '/?tab=inbox') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialUrl]}>
        <Routes>
          <Route path="/" element={<LawyerWorkplacePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('LawyerWorkplacePage smoke', () => {
  beforeEach(() => {
    mockPermissions.clear()
    mockPermissions.add('view_legal_workplace')
    mockPermissions.add('view_legal_kanban')
    mockPermissions.add('manage_legal_workplace')
  })

  it('loads inbox with mocked letters', async () => {
    renderWorkplace('/?tab=inbox')

    expect(await screen.findByText('Incoming')).toBeInTheDocument()
    expect(await screen.findByText('01 / 1', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.queryByText('Inbox is empty')).not.toBeInTheDocument()
    expect(await screen.findByText(/Every 15 minutes/)).toBeInTheDocument()
  })

  it('renders kanban tab when user has view_legal_kanban', async () => {
    renderWorkplace('/?tab=kanban')

    expect(await screen.findByText('Legal department')).toBeInTheDocument()
    expect(screen.getByText('0 active')).toBeInTheDocument()
  })

  it('redirects kanban tab to inbox when user lacks view_legal_kanban', async () => {
    mockPermissions.delete('view_legal_kanban')
    renderWorkplace('/?tab=kanban')

    await waitFor(() => {
      expect(screen.queryByText('Legal department')).not.toBeInTheDocument()
    })
    expect(await screen.findByText('Incoming')).toBeInTheDocument()
  })

  it('renders documents tab', async () => {
    renderWorkplace('/?tab=documents')

    expect(await screen.findByText('Documents')).toBeInTheDocument()
  })

  it('renders settings tab with letter types', async () => {
    renderWorkplace('/?tab=settings')

    expect(await screen.findByText('Settings')).toBeInTheDocument()
    expect(await screen.findByText('Letter types')).toBeInTheDocument()
    expect(screen.getByText('Complaint')).toBeInTheDocument()
  })

  it('shows read-only settings notice without manage_legal_workplace', async () => {
    const user = userEvent.setup()
    mockPermissions.delete('manage_legal_workplace')
    renderWorkplace('/?tab=settings')

    expect(
      await screen.findByText(
        'View only — you do not have permission to change department settings.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByText('Add type')).not.toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: /Complaint/i }))

    const displayName = await screen.findByDisplayValue('Complaint')
    expect(displayName).toBeDisabled()
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument()
  })
})
