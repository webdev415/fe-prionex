/**
 * An oversized incoming-document upload is rejected by nginx with a 413 whose
 * body is raw HTML — the default error path used to toast that markup at the
 * lawyer (legal-office reports 18–20.08). The upload mutation now translates
 * a 413 into a human-readable limit message and keeps the generic path for
 * every other failure.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
const legalApiMock = vi.hoisted(() => ({ uploadIncomingDocument: vi.fn() }))
const taskApiMock = vi.hoisted(() => ({ updateTask: vi.fn() }))

vi.mock('sonner', () => ({ toast: toastMock }))
vi.mock('../../api/legalApi', () => ({ legalApi: legalApiMock }))
vi.mock('@/features/clients/api/taskApi', () => ({ taskApi: taskApiMock }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'uk', changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

const { useUploadIncomingLegalDocument } = await import('../useLegalMutations')

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const PAYLOAD = {
  file: new File(['%PDF'], 'big.pdf', { type: 'application/pdf' }),
  title: 'Big scan',
  client_id: 1,
}

/** Shape axios gives a rejected response (isAxiosError checks the flag). */
function axiosErrorWithStatus(status: number, data: unknown) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, data },
  })
}

describe('useUploadIncomingLegalDocument — 413 handling', () => {
  beforeEach(() => {
    toastMock.error.mockClear()
    legalApiMock.uploadIncomingDocument.mockReset()
  })

  it('toasts the Ukrainian size-limit message on a 413, not the nginx HTML body', async () => {
    legalApiMock.uploadIncomingDocument.mockRejectedValue(
      axiosErrorWithStatus(
        413,
        '<html><head><title>413 Request Entity Too Large</title></head></html>'
      )
    )
    const { result } = renderHook(() => useUploadIncomingLegalDocument(), { wrapper })

    await expect(result.current.mutateAsync(PAYLOAD)).rejects.toThrow()

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledTimes(1))
    expect(toastMock.error).toHaveBeenCalledWith('Файл завеликий. Ліміт — 50 МБ')
  })

  it('keeps the generic error message for non-413 failures', async () => {
    legalApiMock.uploadIncomingDocument.mockRejectedValue(
      axiosErrorWithStatus(400, { detail: 'File type not allowed' })
    )
    const { result } = renderHook(() => useUploadIncomingLegalDocument(), { wrapper })

    await expect(result.current.mutateAsync(PAYLOAD)).rejects.toThrow()

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledTimes(1))
    expect(toastMock.error).toHaveBeenCalledWith('File type not allowed')
  })
})
