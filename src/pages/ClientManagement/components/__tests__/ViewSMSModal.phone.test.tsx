import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ViewSMSModal } from '../ViewSMSModal'

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

const smsData = {
  date: '2026-09-08T10:30:00Z',
  time: '10:30',
  template: 'Payment reminder',
  operator: 'User 42',
  status: 'delivered',
  message: 'Your payment is due tomorrow.',
  phone: '+380501234567',
}

describe('the phone field in the View SMS modal', () => {
  it('shows the number the message was sent to', () => {
    render(<ViewSMSModal open onClose={() => {}} smsData={smsData} />)

    expect(screen.getByText('+380501234567')).toBeInTheDocument()
  })

  it('sits between the date and the template', () => {
    render(<ViewSMSModal open onClose={() => {}} smsData={smsData} />)

    const labels = screen
      .getAllByText(/^(pages\.clients\.modals\.viewSMS\.(dateTime|phone|template|operator)):$/)
      .map((node) => node.textContent)

    expect(labels).toEqual([
      'pages.clients.modals.viewSMS.dateTime:',
      'pages.clients.modals.viewSMS.phone:',
      'pages.clients.modals.viewSMS.template:',
      'pages.clients.modals.viewSMS.operator:',
    ])
  })

  it('falls back to a dash when the record carries no number', () => {
    render(<ViewSMSModal open onClose={() => {}} smsData={{ ...smsData, phone: '' }} />)

    expect(screen.getByText('-')).toBeInTheDocument()
  })
})
