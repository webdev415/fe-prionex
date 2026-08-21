/**
 * Confirm on an already-confirmed letter answers 409 "Letter already
 * confirmed" (double click, stale panel, second tab). Lawyers read the error
 * toast as "try again" and clicked confirm dozens of times (P0, 18-20.08).
 * The hook now treats that 409 as success: a success toast plus letter/inbox
 * invalidation so the panel flips to read-only. Every other error still
 * toasts as an error.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { LegalLetterConfirmRequest } from '../../api/types'

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
const legalApiMock = vi.hoisted(() => ({ confirmLetter: vi.fn() }))

vi.mock('sonner', () => ({ toast: toastMock }))
vi.mock('../../api/legalApi', () => ({ legalApi: legalApiMock }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) =>
      typeof defaultValue === 'string' ? defaultValue : key,
  }),
  I18nextProvider: ({ children }: { children: ReactNode }) => children,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

const { useConfirmLetter, isLetterAlreadyConfirmed } = await import('../useConfirmLetter')
const { legalWorkplaceKeys } = await import('../useLegalInbox')

const payload = { letter_type_id: 'complaint' } as LegalLetterConfirmRequest

function alreadyConfirmedError() {
  return {
    isAxiosError: true,
    response: { status: 409, data: { detail: 'Letter already confirmed' } },
  }
}

function alreadyConfirmedCodedError() {
  return {
    isAxiosError: true,
    response: {
      status: 409,
      data: { detail: 'Letter already confirmed', code: 'letter_already_confirmed' },
    },
  }
}

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useConfirmLetter(), { wrapper })
  return { result, invalidateSpy }
}

describe('useConfirmLetter — 409 already confirmed', () => {
  beforeEach(() => {
    toastMock.success.mockClear()
    toastMock.error.mockClear()
    legalApiMock.confirmLetter.mockReset()
  })

  it('toasts success instead of an error', async () => {
    legalApiMock.confirmLetter.mockRejectedValue(alreadyConfirmedError())
    const { result } = setup()

    result.current.mutate({ messageId: 'msg-1', payload })

    await waitFor(() =>
      expect(toastMock.success).toHaveBeenCalledWith('Task already created on kanban')
    )
    expect(toastMock.error).not.toHaveBeenCalled()
  })

  it('treats the coded 409 as success too (new backend format)', async () => {
    legalApiMock.confirmLetter.mockRejectedValue(alreadyConfirmedCodedError())
    const { result } = setup()

    result.current.mutate({ messageId: 'msg-1', payload })

    await waitFor(() =>
      expect(toastMock.success).toHaveBeenCalledWith('Task already created on kanban')
    )
    expect(toastMock.error).not.toHaveBeenCalled()
  })

  it('refreshes the letter and the inbox so the panel goes read-only', async () => {
    legalApiMock.confirmLetter.mockRejectedValue(alreadyConfirmedError())
    const { result, invalidateSpy } = setup()

    result.current.mutate({ messageId: 'msg-1', payload })

    await waitFor(() => expect(toastMock.success).toHaveBeenCalledTimes(1))
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: legalWorkplaceKeys.message('msg-1'),
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: legalWorkplaceKeys.inbox() })
  })

  it('still toasts other errors as errors', async () => {
    legalApiMock.confirmLetter.mockRejectedValue(new Error('boom'))
    const { result, invalidateSpy } = setup()

    result.current.mutate({ messageId: 'msg-1', payload })

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledTimes(1))
    expect(toastMock.success).not.toHaveBeenCalled()
    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  it('does not mistake an unrelated 409 for success', async () => {
    legalApiMock.confirmLetter.mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { detail: 'Quarantined letters cannot be confirmed' } },
    })
    const { result } = setup()

    result.current.mutate({ messageId: 'msg-1', payload })

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledTimes(1))
    expect(toastMock.success).not.toHaveBeenCalled()
  })
})

describe('isLetterAlreadyConfirmed', () => {
  it('matches the machine-readable code (new backend format)', () => {
    expect(isLetterAlreadyConfirmed(alreadyConfirmedCodedError())).toBe(true)
    // The code alone is enough — no reliance on the detail text.
    expect(
      isLetterAlreadyConfirmed({
        isAxiosError: true,
        response: { status: 409, data: { code: 'letter_already_confirmed' } },
      })
    ).toBe(true)
    // A different code on its own is not a match.
    expect(
      isLetterAlreadyConfirmed({
        isAxiosError: true,
        response: { status: 409, data: { code: 'lawyer_over_capacity', detail: 'x' } },
      })
    ).toBe(false)
    // The code never overrides the status check.
    expect(
      isLetterAlreadyConfirmed({
        isAxiosError: true,
        response: { status: 400, data: { code: 'letter_already_confirmed' } },
      })
    ).toBe(false)
  })

  it('falls back to the detail string match (old backend format)', () => {
    expect(isLetterAlreadyConfirmed(alreadyConfirmedError())).toBe(true)
    expect(
      isLetterAlreadyConfirmed({
        isAxiosError: true,
        response: { status: 400, data: { detail: 'Letter already confirmed' } },
      })
    ).toBe(false)
    expect(
      isLetterAlreadyConfirmed({
        isAxiosError: true,
        response: { status: 409, data: { detail: 'something else' } },
      })
    ).toBe(false)
    expect(isLetterAlreadyConfirmed(new Error('Letter already confirmed'))).toBe(false)
  })
})
