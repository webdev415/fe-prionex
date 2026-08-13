/**
 * The "No client link" checkbox in the letter panel (KAN-1008).
 *
 * Off by default; ticking it clears and disables the client field and lets the
 * letter be confirmed with no client, which the backend reads as "create the
 * task directly, skip the email_confirmed chain".
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { LetterDetail } from '../../../types'

const confirmMutate = vi.hoisted(() => vi.fn())

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) =>
      typeof defaultValue === 'string' ? defaultValue : key,
    i18n: { language: 'uk', changeLanguage: vi.fn() },
  }),
  I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

vi.mock('@/features/lawyerWorkplace/hooks/useLegalProfileTimezone', () => ({
  useLegalProfileTimezone: () => 'Europe/Kyiv',
}))

vi.mock('@/features/lawyerWorkplace', async () => {
  const actual = await vi.importActual<typeof import('@/features/lawyerWorkplace')>(
    '@/features/lawyerWorkplace'
  )
  return {
    ...actual,
    useConfirmLetter: () => ({ mutate: confirmMutate, isPending: false }),
    useLegalClientSearch: () => ({ data: { items: [] }, isFetching: false }),
    useLegalClientContracts: () => ({ data: { items: [] }, isFetching: false }),
    useLegalLawyers: () => ({
      data: {
        items: [
          {
            id: 'lawyer-1',
            user_id: 10,
            display_name: 'V. Doroshenko',
            initials: 'VD',
            is_active: true,
            active_task_count: 0,
            max_active_tasks: 50,
          },
        ],
      },
    }),
    useLegalLetterTypes: () => ({
      data: {
        items: [
          {
            id: 'complaint',
            slug: 'complaint',
            name: 'Complaint',
            color_id: 'error',
            sla_days: 14,
            is_active: true,
            priorities: [],
          },
        ],
      },
    }),
    usePatchMessageSuggestions: () => ({ mutateAsync: vi.fn().mockResolvedValue({}) }),
    usePatchMessageContract: () => ({ mutateAsync: vi.fn().mockResolvedValue({}) }),
  }
})

const { LetterParametersPanel } = await import('../LetterParametersPanel')

const letter = {
  id: 'msg-1',
  threadId: 'thread-1',
  subject: 'Anonymous complaint',
  status: 'new',
  isUnprocessed: true,
  direction: 'incoming',
  clientId: null,
  clientName: null,
  receivedAt: '2026-06-20T09:00:00+00:00',
  recipientEmail: 'legal@prionex.ua',
  thread: [],
  replyDraft: '',
  replyContext: {
    threadId: 'thread-1',
    mailboxId: null,
    inReplyToMessageId: 'msg-1',
    clientId: null,
    assignedUserId: null,
  },
  parameters: {
    letterType: 'complaint',
    clientId: '',
    clientLabel: '',
    clientProjectId: 1,
    clientLockedByEmail: false,
    lawyerId: '10',
    dueDate: '2026-09-01',
    dueDateHint: '',
    contractNumber: '',
  },
} as unknown as LetterDetail

function renderPanel(parameters?: Record<string, unknown>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const subject = parameters
    ? ({ ...letter, parameters: { ...letter.parameters, ...parameters } } as LetterDetail)
    : letter
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <LetterParametersPanel letter={subject} />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function checkbox() {
  return screen.getByRole('checkbox', { name: /No client link/i })
}

describe('LetterParametersPanel — no client link', () => {
  beforeEach(() => {
    confirmMutate.mockReset()
  })

  it('is off by default', () => {
    renderPanel()
    expect(checkbox()).toHaveAttribute('data-state', 'unchecked')
  })

  it('blocks confirm while it is off and no client is selected', () => {
    renderPanel()
    const confirm = screen.getByRole('button', { name: /Confirm & create task/i })
    expect(confirm).toBeDisabled()
  })

  it('disables the client field once it is ticked', async () => {
    renderPanel()
    const clientField = screen.getByRole('button', { name: /Not identified/i })
    expect(clientField).toBeEnabled()

    fireEvent.click(checkbox())
    await waitFor(() => expect(clientField).toBeDisabled())
  })

  it('clears an already selected client when it is ticked', async () => {
    renderPanel({ clientId: '100', clientLabel: 'Test Client' })
    expect(screen.getByRole('button', { name: /Test Client/i })).toBeInTheDocument()

    fireEvent.click(checkbox())

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Test Client/i })).not.toBeInTheDocument()
    )
    expect(screen.getByRole('button', { name: /Not identified/i })).toBeDisabled()
  })

  it('allows confirm once it is ticked', async () => {
    renderPanel()
    fireEvent.click(checkbox())

    const confirm = screen.getByRole('button', { name: /Confirm & create task/i })
    await waitFor(() => expect(confirm).toBeEnabled())
  })

  it('sends a null client id', async () => {
    renderPanel()
    fireEvent.click(checkbox())

    const confirm = screen.getByRole('button', { name: /Confirm & create task/i })
    await waitFor(() => expect(confirm).toBeEnabled())
    fireEvent.click(confirm)

    await waitFor(() => expect(confirmMutate).toHaveBeenCalledTimes(1))
    expect(confirmMutate.mock.calls[0][0]).toMatchObject({
      messageId: 'msg-1',
      payload: { client_id: null, letter_type_id: 'complaint', assigned_to_user_id: 10 },
    })
  })
})
