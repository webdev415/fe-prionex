import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CallLogCard } from '../CallLogCard'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, fallback?: string) => fallback ?? key,
      i18n: { language: 'en' },
    }),
  }
})

function renderMessageCard(props: Record<string, unknown> = {}) {
  return render(
    <CallLogCard
      date="2026-09-08"
      time="14:30"
      status="DELIVERED"
      template="Payment reminder"
      message="Your payment is due tomorrow."
      phone="+380501234567"
      {...props}
    />
  )
}

describe('a message card in the Call/SMS history', () => {
  it('shows the recipient number beside the delivery status', () => {
    renderMessageCard()

    const status = screen.getByText('Delivered')
    const phone = screen.getByText(/\+380501234567/)

    expect(status.parentElement).toBe(phone.parentElement)
  })

  it('no longer repeats the number under the message text', () => {
    renderMessageCard()

    expect(screen.getAllByText(/\+380501234567/)).toHaveLength(1)
  })

  it('gives the number the whole line rather than sharing it with a label', () => {
    renderMessageCard({ phone: '+380501234567' })

    expect(screen.getByText('+380501234567')).toBeInTheDocument()
    expect(screen.queryByText(/·/)).toBeNull()
  })

  it('leaves the rest of the card alone', () => {
    renderMessageCard()

    expect(screen.getByText('Payment reminder')).toBeInTheDocument()
    expect(screen.getByText('Your payment is due tomorrow.')).toBeInTheDocument()
    expect(screen.getByText('14:30')).toBeInTheDocument()
  })

  it('shows nothing extra when the record carries no number', () => {
    renderMessageCard({ phone: undefined })

    expect(screen.getByText('Delivered')).toBeInTheDocument()
    expect(screen.queryByText(/\+380/)).toBeNull()
  })
})
