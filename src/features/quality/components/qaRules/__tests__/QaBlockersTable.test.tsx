/**
 * QaBlockersTable tests — the places the FE/BE contract is easy to get wrong.
 *
 * The API layer is mocked, the hooks are real, so a click has to travel
 * through the mutation to the request. The i18n mock returns keys.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import { toast } from 'sonner'

import { QaBlockersTable } from '../QaBlockersTable'
import {
  createQaBlocker,
  deleteQaBlocker,
  listQaBlockers,
  updateQaBlocker,
} from '../../../api/qaRulesService'
import type { QaBlocker } from '../../../types'

vi.mock('../../../api/qaRulesService', () => ({
  listQaBlockers: vi.fn(),
  createQaBlocker: vi.fn(),
  updateQaBlocker: vi.fn(),
  deleteQaBlocker: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const mockList = vi.mocked(listQaBlockers)
const mockCreate = vi.mocked(createQaBlocker)
const mockUpdate = vi.mocked(updateQaBlocker)
const mockDelete = vi.mocked(deleteQaBlocker)

function blocker(overrides: Partial<QaBlocker> = {}): QaBlocker {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    phrase: 'я тебе знайду',
    category: 'threat',
    severity: 'critical',
    lang: 'uk',
    is_active: true,
    created_by: 7,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...overrides,
  }
}

function conflict(): AxiosError {
  const error = new AxiosError('conflict')
  error.response = {
    status: 409,
    statusText: 'Conflict',
    data: { detail: 'duplicate phrase' },
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  }
  return error
}

function renderTable() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <QaBlockersTable />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockList.mockResolvedValue([blocker()])
  mockCreate.mockResolvedValue(blocker({ id: 'new', phrase: 'нова фраза' }))
  mockUpdate.mockResolvedValue(blocker())
  mockDelete.mockResolvedValue(blocker({ is_active: false }))
})

describe('QaBlockersTable', () => {
  it('always fetches the inactive rows too — the activity switch needs both states', async () => {
    renderTable()
    await waitFor(() => expect(mockList).toHaveBeenCalledWith({ include_inactive: true }))
  })

  it('hides deactivated phrases until asked, without refetching', async () => {
    mockList.mockResolvedValue([
      blocker(),
      blocker({ id: 'gone', phrase: 'стара', is_active: false }),
    ])
    renderTable()
    await screen.findByText('я тебе знайду')
    expect(screen.queryByText('стара')).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('pages.qaRules.blockers.showInactive'))
    expect(screen.getByText('стара')).toBeInTheDocument()
    // Narrowing is client-side: the dictionary is fetched once.
    expect(mockList).toHaveBeenCalledTimes(1)
  })

  it('narrows by category on the client', async () => {
    mockList.mockResolvedValue([
      blocker(),
      blocker({ id: 'p', phrase: 'лайка', category: 'profanity' }),
    ])
    renderTable()
    await screen.findByText('лайка')

    fireEvent.change(screen.getByLabelText('pages.qaRules.blockers.categoryFilter'), {
      target: { value: 'profanity' },
    })
    expect(screen.getByText('лайка')).toBeInTheDocument()
    expect(screen.queryByText('я тебе знайду')).not.toBeInTheDocument()
  })

  it('creates without is_active — a new phrase is always active', async () => {
    renderTable()
    fireEvent.change(screen.getByLabelText('pages.qaRules.blockers.newPhrase'), {
      target: { value: '  нова фраза  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /pages.qaRules.blockers.add/ }))

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith({
        phrase: 'нова фраза',
        category: 'script_critical',
        severity: 'critical',
        lang: 'uk',
      })
    )
  })

  it('refuses to send a phrase shorter than the backend minimum', async () => {
    renderTable()
    fireEvent.change(screen.getByLabelText('pages.qaRules.blockers.newPhrase'), {
      target: { value: 'a' },
    })
    expect(screen.getByRole('button', { name: /pages.qaRules.blockers.add/ })).toBeDisabled()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('names the duplicate on 409 rather than failing generically', async () => {
    mockCreate.mockRejectedValue(conflict())
    renderTable()
    fireEvent.change(screen.getByLabelText('pages.qaRules.blockers.newPhrase'), {
      target: { value: 'я тебе знайду' },
    })
    fireEvent.click(screen.getByRole('button', { name: /pages.qaRules.blockers.add/ }))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('pages.qaRules.blockers.duplicate')
    )
  })

  it('deactivates through DELETE, after confirming', async () => {
    renderTable()
    await screen.findByText('я тебе знайду')

    fireEvent.click(screen.getByRole('button', { name: 'pages.qaRules.blockers.deactivate' }))
    // Second click is the confirmation dialog's own button.
    fireEvent.click(
      await screen.findByRole('button', { name: 'pages.qaRules.blockers.deactivate' })
    )
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith(blocker().id))
  })

  it('brings a deactivated phrase back through PUT — the delete is soft', async () => {
    mockList.mockResolvedValue([blocker({ is_active: false })])
    renderTable()
    fireEvent.click(screen.getByLabelText('pages.qaRules.blockers.showInactive'))

    fireEvent.click(await screen.findByLabelText('pages.qaRules.blockers.active'))
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(blocker().id, { is_active: true }))
  })

  it('offers no deactivate button on an already-deactivated phrase', async () => {
    mockList.mockResolvedValue([blocker({ is_active: false })])
    renderTable()
    fireEvent.click(screen.getByLabelText('pages.qaRules.blockers.showInactive'))
    await screen.findByText('я тебе знайду')

    expect(
      screen.queryByRole('button', { name: 'pages.qaRules.blockers.deactivate' })
    ).not.toBeInTheDocument()
  })
})
