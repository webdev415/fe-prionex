import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { IncomingRegistryItem, OutgoingRegistryItem } from '@/features/lawyerWorkplace'

const incoming: IncomingRegistryItem[] = [
  {
    id: 1,
    number: '7',
    received_date: '2026-07-10T09:00:00Z',
    sender_email: 'client@example.com',
    summary: 'Complaint about interest',
    letter_type: { id: 'complaint', name: 'Complaint', color_id: 'red' },
    client: { id: 100, name: 'John Doe' },
    source: 'letter',
  },
]

const outgoing: OutgoingRegistryItem[] = [
  {
    id: 5,
    number: '2307/01',
    request_received_at: '2026-07-08T09:00:00Z',
    sender_email: 'legal@prionex.ua',
    recipient_email: 'nbu@bank.gov.ua',
    letter_type: { id: 'nbu', name: 'NBU reply', color_id: 'teal' },
    client_name: null,
    institution_name: 'National Bank of Ukraine',
    issued_date: '2026-07-12T09:00:00Z',
    lawyer: { id: 9, name: 'Jane Lawyer' },
  },
]

vi.mock('@/features/lawyerWorkplace', () => ({
  useIncomingRegistry: () => ({
    data: { items: incoming, total: incoming.length },
    isLoading: false,
  }),
  useOutgoingRegistry: () => ({
    data: { items: outgoing, total: outgoing.length },
    isLoading: false,
  }),
}))

vi.mock('@/components/ui/DateSelect', () => ({
  DateSelect: () => <input data-testid="date-select" />,
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { user: { timezone: string | null } }) => unknown) =>
    selector({ user: { timezone: null } }),
}))

import { CorrespondenceTab } from '../CorrespondenceTab'

describe('CorrespondenceTab', () => {
  it('renders the union of both registries with category badges', () => {
    render(<CorrespondenceTab />)

    // incoming row
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Complaint')).toBeInTheDocument()

    // outgoing row
    expect(screen.getByText('2307/01')).toBeInTheDocument()
    expect(screen.getByText('National Bank of Ukraine')).toBeInTheDocument()
    expect(screen.getByText('Jane Lawyer')).toBeInTheDocument()
    expect(screen.getByText('NBU reply')).toBeInTheDocument()
  })
})
