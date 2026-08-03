import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SenderHistorySection } from '../SenderHistorySection'
import { useLegalSenderHistory } from '@/features/lawyerWorkplace'

vi.mock('@/features/lawyerWorkplace', () => ({
  useLegalSenderHistory: vi.fn(),
}))

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, fallback?: string | Record<string, unknown>) => {
        if (typeof fallback === 'string') return fallback
        if (fallback && typeof fallback === 'object' && 'defaultValue' in fallback) {
          return String((fallback as { defaultValue: string }).defaultValue)
            .replace('{{position}}', String((fallback as Record<string, unknown>).position))
            .replace('{{total}}', String((fallback as Record<string, unknown>).total))
        }
        return key
      },
      i18n: { language: 'uk' },
    }),
  }
})

const mockedHook = vi.mocked(useLegalSenderHistory)

// jsdom lacks the pointer-capture APIs Radix menus rely on.
beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window.HTMLElement.prototype as any).hasPointerCapture = () => false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window.HTMLElement.prototype as any).setPointerCapture = () => undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window.HTMLElement.prototype as any).releasePointerCapture = () => undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window.HTMLElement.prototype as any).scrollIntoView = () => undefined
  mockedHook.mockReset()
})

function mockHistory(overrides: Record<string, unknown> = {}) {
  mockedHook.mockReturnValue({
    data: {
      sender_address: 'client@example.com',
      total: 3,
      position: 2,
      items: [
        {
          id: 'c',
          subject: 'Third',
          direction: 'incoming',
          received_at: '2026-06-10T09:00:00Z',
          sent_at: null,
          letter_type_id: null,
          is_current: false,
        },
        {
          id: 'b',
          subject: 'Second',
          direction: 'incoming',
          received_at: '2026-06-05T09:00:00Z',
          sent_at: null,
          letter_type_id: null,
          is_current: true,
        },
        {
          id: 'a',
          subject: 'First',
          direction: 'incoming',
          received_at: '2026-06-01T09:00:00Z',
          sent_at: null,
          letter_type_id: null,
          is_current: false,
        },
      ],
      ...overrides,
    },
    isLoading: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
}

describe('SenderHistorySection', () => {
  it('shows the position/total counter for repeat senders', () => {
    mockHistory()
    render(<SenderHistorySection messageId="b" />)
    expect(screen.getByText('2 of 3', { exact: false })).toBeInTheDocument()
  })

  it('renders the single-letter label when there is only one', () => {
    mockHistory({
      total: 1,
      position: 1,
      items: [
        {
          id: 'b',
          subject: 'Only',
          direction: 'incoming',
          received_at: '2026-06-05T09:00:00Z',
          sent_at: null,
          letter_type_id: null,
          is_current: true,
        },
      ],
    })
    render(<SenderHistorySection messageId="b" />)
    expect(screen.getByText('First letter from this address')).toBeInTheDocument()
  })

  it('opens another letter when picking a non-current entry', async () => {
    const user = userEvent.setup()
    const onOpenLetter = vi.fn()
    mockHistory()
    render(<SenderHistorySection messageId="b" onOpenLetter={onOpenLetter} />)

    await user.click(screen.getByRole('button'))
    await user.click(await screen.findByText('First'))
    expect(onOpenLetter).toHaveBeenCalledWith('a')
  })

  it('renders nothing while loading', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedHook.mockReturnValue({ data: undefined, isLoading: true } as any)
    const { container } = render(<SenderHistorySection messageId="b" />)
    expect(container).toBeEmptyDOMElement()
  })
})
