/**
 * Single-contract auto-select is display-only (P0, legal dept 18-20.08).
 *
 * A render-driven useEffect used to PATCH /messages/{id}/contract on every
 * render: after confirm the letter is immutable (409 storm), before a client
 * was linked the backend answered 400 — ~22K requests in 7 days on prod, error
 * toasts burying the confirm button. The backend auto-resolves a single
 * contract on confirm itself, so the panel must never persist it in the
 * background — only an explicit pick by the lawyer writes through.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { LetterDetail } from '../../../types'

const confirmMutate = vi.hoisted(() => vi.fn())
const patchContract = vi.hoisted(() => vi.fn().mockResolvedValue({}))
const patchSuggestions = vi.hoisted(() => vi.fn())
const contractsState = vi.hoisted(() => ({
  items: [] as { contract_number: string | null; debt_id: number; status: string }[],
}))

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
    useLegalClientContracts: () => ({ data: { items: contractsState.items }, isFetching: false }),
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
    usePatchMessageSuggestions: () => ({ mutateAsync: patchSuggestions }),
    usePatchMessageContract: () => ({ mutateAsync: patchContract }),
  }
})

const { LetterParametersPanel } = await import('../LetterParametersPanel')

// Radix DropdownMenu relies on pointer-capture APIs jsdom doesn't implement.
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn(() => false)
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()
  }
  Element.prototype.scrollIntoView = vi.fn()
})

const letter = {
  id: 'msg-1',
  threadId: 'thread-1',
  subject: 'Complaint with a linked client',
  status: 'new',
  isUnprocessed: true,
  direction: 'incoming',
  clientId: '100',
  clientName: 'Test Client',
  receivedAt: '2026-06-20T09:00:00+00:00',
  recipientEmail: 'legal@prionex.ua',
  thread: [],
  replyDraft: '',
  replyContext: {
    threadId: 'thread-1',
    mailboxId: null,
    inReplyToMessageId: 'msg-1',
    clientId: 100,
    assignedUserId: null,
  },
  parameters: {
    letterType: 'complaint',
    clientId: '100',
    clientLabel: 'Test Client',
    clientProjectId: 1,
    clientLockedByEmail: false,
    lawyerId: '10',
    dueDate: '2026-09-01',
    dueDateHint: '',
    contractNumber: '',
    // Preview fallback (mapListItemToPreviewDetail) always carries '' here —
    // exactly the shape that kept the removed effect PATCHing forever.
    contractLabel: '',
  },
} as unknown as LetterDetail

function renderPanel(onConfirm?: (letterId: string) => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <LetterParametersPanel letter={letter} onConfirm={onConfirm} />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function openDropdown(trigger: HTMLElement) {
  // Radix DropdownMenuTrigger listens for pointer events; a bare click is flaky in jsdom.
  fireEvent.pointerDown(trigger, { pointerId: 1, pointerType: 'mouse', button: 0, bubbles: true })
  fireEvent.pointerUp(trigger, { pointerId: 1, pointerType: 'mouse', button: 0, bubbles: true })
  fireEvent.click(trigger)
}

describe('LetterParametersPanel — single contract stays local', () => {
  beforeEach(() => {
    confirmMutate.mockReset()
    patchContract.mockReset().mockResolvedValue({})
    patchSuggestions.mockReset().mockResolvedValue({})
    contractsState.items = [{ contract_number: 'CTR-1', debt_id: 5, status: 'active' }]
  })

  it('shows the only contract without firing a background PATCH', async () => {
    renderPanel()

    // The auto-selected contract is visible to the lawyer…
    await waitFor(() => expect(screen.getByText('CTR-1')).toBeInTheDocument())

    // …but nothing was persisted: no render-driven /contract PATCH at all.
    expect(patchContract).not.toHaveBeenCalled()
  })

  it('keeps not PATCHing across re-renders', async () => {
    const { rerender } = renderPanel()
    await waitFor(() => expect(screen.getByText('CTR-1')).toBeInTheDocument())

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    rerender(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <LetterParametersPanel letter={letter} />
        </MemoryRouter>
      </QueryClientProvider>
    )

    await waitFor(() => expect(screen.getByText('CTR-1')).toBeInTheDocument())
    expect(patchContract).not.toHaveBeenCalled()
  })

  it('still persists an explicit pick by the lawyer', async () => {
    contractsState.items = [
      { contract_number: 'CTR-1', debt_id: 5, status: 'active' },
      { contract_number: 'CTR-2', debt_id: 6, status: 'active' },
    ]
    renderPanel()

    openDropdown(screen.getByRole('button', { name: /Select contract/i }))
    await waitFor(() => expect(screen.getByText('CTR-2')).toBeInTheDocument())
    fireEvent.click(screen.getByText('CTR-2'))

    await waitFor(() => expect(patchContract).toHaveBeenCalledTimes(1))
    expect(patchContract).toHaveBeenCalledWith({
      messageId: 'msg-1',
      payload: { contract_number: 'CTR-2' },
    })
  })
})

describe('LetterParametersPanel — confirm on an already-confirmed letter', () => {
  beforeEach(() => {
    confirmMutate.mockReset()
    patchContract.mockReset().mockResolvedValue({})
    patchSuggestions.mockReset().mockResolvedValue({})
    contractsState.items = [{ contract_number: 'CTR-1', debt_id: 5, status: 'active' }]
  })

  async function clickConfirm() {
    const confirm = screen.getByRole('button', { name: /Confirm & create task/i })
    await waitFor(() => expect(confirm).toBeEnabled())
    fireEvent.click(confirm)
    await waitFor(() => expect(confirmMutate).toHaveBeenCalledTimes(1))
    return confirmMutate.mock.calls[0][1] as {
      onSuccess: () => void
      onError: (error: unknown) => void
    }
  }

  it('closes the panel like a success on 409 "Letter already confirmed"', async () => {
    const onConfirm = vi.fn()
    renderPanel(onConfirm)

    const options = await clickConfirm()
    options.onError({
      isAxiosError: true,
      response: { status: 409, data: { detail: 'Letter already confirmed' } },
    })

    expect(onConfirm).toHaveBeenCalledWith('msg-1')
  })

  it('leaves the panel open on any other error', async () => {
    const onConfirm = vi.fn()
    renderPanel(onConfirm)

    const options = await clickConfirm()
    options.onError(new Error('boom'))

    expect(onConfirm).not.toHaveBeenCalled()
  })
})
