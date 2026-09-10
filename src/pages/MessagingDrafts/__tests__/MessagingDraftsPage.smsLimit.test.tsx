import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MessagingDraftsPage } from '../MessagingDraftsPage'
import { useAuthStore } from '@/stores/authStore'

vi.mock('@/features/messaging/api/messagingApi', () => ({
  messagingApi: {
    listDrafts: vi.fn(async () => []),
    listDeletedDrafts: vi.fn(async () => ({ total: 0, drafts: [] })),
  },
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

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

const CYRILLIC = 'ТОВ «ФК «ТЕХНОФІНАНС» ЄДРПОУ 43868852, п/р UA713281680000026508000000184.'
const LATIN = 'Dear customer, your payment is due tomorrow. Please settle the balance.'

function renderPage() {
  useAuthStore.setState({
    user: { id: 1, username: 'u', permissions: ['manage_drafts'] } as never,
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return render(<MessagingDraftsPage />, { wrapper })
}

function openNewDraft() {
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: 'New draft' }))
  return screen.getByLabelText(/Message body/) as HTMLTextAreaElement
}

function counterText() {
  return screen.getByText(/^\d+ \/ \d+$/).textContent ?? ''
}

describe('the SMS body limit in a message draft', () => {
  it('is 350 for Cyrillic text, which used to collapse the limit to 70', () => {
    const body = openNewDraft()

    fireEvent.change(body, { target: { value: CYRILLIC } })

    expect(counterText()).toBe(`${CYRILLIC.length} / 350`)
  })

  it('is the same 350 for plain Latin text', () => {
    const body = openNewDraft()

    fireEvent.change(body, { target: { value: LATIN } })

    expect(counterText()).toBe(`${LATIN.length} / 350`)
  })

  it('does not move when a single non-GSM character is typed', () => {
    const body = openNewDraft()

    fireEvent.change(body, { target: { value: 'abc' } })
    const before = counterText().split('/')[1].trim()

    fireEvent.change(body, { target: { value: 'abc«' } })
    const after = counterText().split('/')[1].trim()

    expect(before).toBe('350')
    expect(after).toBe('350')
  })

  it('accepts a body of exactly 350 characters', () => {
    const body = openNewDraft()

    fireEvent.change(body, { target: { value: 'Ї'.repeat(350) } })

    expect(counterText()).toBe('350 / 350')
    expect(screen.queryByText(/exceeds the/)).toBeNull()
  })

  it('rejects a body of 351 characters', () => {
    const body = openNewDraft()

    fireEvent.change(body, { target: { value: 'Ї'.repeat(351) } })

    expect(screen.getByText(/exceeds the 350-character limit/)).toBeInTheDocument()
  })
})
