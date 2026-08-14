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
const patchSuggestions = vi.hoisted(() => vi.fn())
const lawyersArgs = vi.hoisted(() => [] as unknown[])

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
    useLegalLawyers: (args: unknown) => {
      lawyersArgs.push(args)
      return {
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
      }
    },
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
    usePatchMessageSuggestions: () => ({ mutateAsync: patchSuggestions }),
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
    contractLabel: 'CTR-OLD-CLIENT',
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
    patchSuggestions.mockReset().mockResolvedValue({})
    lawyersArgs.length = 0
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

  it("does not submit the unlinked client's contract number", async () => {
    renderPanel({ clientId: '100', clientLabel: 'Test Client' })
    fireEvent.click(checkbox())

    const confirm = screen.getByRole('button', { name: /Confirm & create task/i })
    await waitFor(() => expect(confirm).toBeEnabled())
    fireEvent.click(confirm)

    await waitFor(() => expect(confirmMutate).toHaveBeenCalledTimes(1))
    expect(confirmMutate.mock.calls[0][0].payload.contract_number).toBeNull()
  })

  it('hides the record-sender-mail option, there is no profile to write to', async () => {
    renderPanel()
    expect(screen.getByText(/Record mail to client profile/i)).toBeInTheDocument()

    fireEvent.click(checkbox())

    await waitFor(() =>
      expect(screen.queryByText(/Record mail to client profile/i)).not.toBeInTheDocument()
    )
  })

  it('never asks to record the sender against a client that is not there', async () => {
    renderPanel()
    const senderBox = screen.getByRole('checkbox', { name: /Record mail to client profile/i })
    fireEvent.click(senderBox)
    fireEvent.click(checkbox())

    const confirm = screen.getByRole('button', { name: /Confirm & create task/i })
    await waitFor(() => expect(confirm).toBeEnabled())
    fireEvent.click(confirm)

    await waitFor(() => expect(confirmMutate).toHaveBeenCalledTimes(1))
    expect(confirmMutate.mock.calls[0][0].payload.save_sender_email_to_client).toBeUndefined()
  })

  // The letter carries the client's project, so without this the lawyer list
  // stays filtered to a client the operator just unlinked.
  it("stops filtering lawyers by the unlinked client's project", async () => {
    renderPanel({ clientId: '100', clientLabel: 'Test Client', clientProjectId: 42 })
    expect(lawyersArgs.at(-1)).toEqual({ projectId: 42 })

    fireEvent.click(checkbox())

    await waitFor(() => expect(lawyersArgs.at(-1)).toEqual({}))
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
      payload: {
        client_id: null,
        no_client_link: true,
        letter_type_id: 'complaint',
        assigned_to_user_id: 10,
      },
    })
  })
})

// Picking a client writes through immediately, which is what puts the client's
// name on the letter and across the inbox list — all four labels read the
// persisted suggestion. Unlinking has to write through too, or they keep naming
// a client the operator just detached.
describe('LetterParametersPanel — unlinking is persisted', () => {
  beforeEach(() => {
    confirmMutate.mockReset()
    patchSuggestions.mockReset().mockResolvedValue({})
    lawyersArgs.length = 0
  })

  it('clears the stored client suggestion when the box is ticked', async () => {
    renderPanel({ clientId: '100', clientLabel: 'Test Client' })

    fireEvent.click(checkbox())

    await waitFor(() => expect(patchSuggestions).toHaveBeenCalledTimes(1))
    expect(patchSuggestions.mock.calls[0][0]).toMatchObject({
      messageId: 'msg-1',
      payload: { letter_type_id: 'complaint', client_id: null },
    })
  })

  it('puts the client back when the box is unticked', async () => {
    renderPanel({ clientId: '100', clientLabel: 'Test Client' })

    fireEvent.click(checkbox())
    await waitFor(() => expect(patchSuggestions).toHaveBeenCalledTimes(1))

    fireEvent.click(checkbox())

    await waitFor(() => expect(patchSuggestions).toHaveBeenCalledTimes(2))
    expect(patchSuggestions.mock.calls[1][0].payload.client_id).toBe(100)
  })

  it('unticks itself when the unlink cannot be saved', async () => {
    patchSuggestions.mockRejectedValue(new Error('offline'))
    renderPanel({ clientId: '100', clientLabel: 'Test Client' })

    fireEvent.click(checkbox())

    // Staying ticked while the labels still name the client is the confusion
    // this fixes, so a failed save must not look like a success.
    await waitFor(() => expect(checkbox()).toHaveAttribute('data-state', 'unchecked'))
  })

  it('does not patch a letter that has no type yet', async () => {
    renderPanel({ letterType: '', clientId: '100', clientLabel: 'Test Client' })

    fireEvent.click(checkbox())

    await waitFor(() => expect(checkbox()).toHaveAttribute('data-state', 'checked'))
    expect(patchSuggestions).not.toHaveBeenCalled()
  })
})
