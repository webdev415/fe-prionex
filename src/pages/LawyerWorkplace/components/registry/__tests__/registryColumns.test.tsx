import { describe, it, expect, vi } from 'vitest'
import type { TFunction } from 'i18next'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { IncomingRegistryItem, OutgoingRegistryItem } from '@/features/lawyerWorkplace'
import { CorrespondenceRegistryTable } from '../CorrespondenceRegistryTable'
import { buildIncomingColumns, buildOutgoingColumns } from '../registryColumns'

// Builder-level t: return the fallback so headers are readable in assertions.
const t = ((key: string, fallback?: string) => fallback ?? key) as unknown as TFunction<'common'>

const incomingRow: IncomingRegistryItem = {
  id: 1,
  number: '7',
  received_date: '2026-07-10T09:00:00Z',
  sender_email: 'client@example.com',
  summary: 'Complaint about interest',
  letter_type: { id: 'complaint', name: 'Complaint', color_id: 'red' },
  client: { id: 100, name: 'John Doe' },
  source: 'letter',
}

const outgoingRow: OutgoingRegistryItem = {
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
}

function renderIncoming() {
  return render(
    <MemoryRouter>
      <CorrespondenceRegistryTable
        columns={buildIncomingColumns(t)}
        data={[incomingRow]}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        total={1}
        page={1}
        pageSize={25}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        emptyMessage="empty"
      />
    </MemoryRouter>
  )
}

function renderOutgoing() {
  return render(
    <MemoryRouter>
      <CorrespondenceRegistryTable
        columns={buildOutgoingColumns(t)}
        data={[outgoingRow]}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        total={1}
        page={1}
        pageSize={25}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        emptyMessage="empty"
      />
    </MemoryRouter>
  )
}

describe('incoming registry columns', () => {
  it('renders the ТЗ column headers in order', () => {
    const headers = buildIncomingColumns(t).map((c) => c.header)
    expect(headers).toEqual(['Received date', 'No.', 'Sender email', 'Summary'])
  })

  it('renders number, sender email, summary with the category badge and client link', () => {
    renderIncoming()

    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('client@example.com')).toBeInTheDocument()
    expect(screen.getByText('Complaint about interest')).toBeInTheDocument()
    // category badge
    expect(screen.getByText('Complaint')).toBeInTheDocument()
    // client link points at the client detail page
    const clientLink = screen.getByRole('link', { name: 'John Doe' })
    expect(clientLink).toHaveAttribute('href', '/dashboard/clients/100')
  })
})

describe('outgoing registry columns', () => {
  it('renders the ТЗ column headers in order', () => {
    const headers = buildOutgoingColumns(t).map((c) => c.header)
    expect(headers).toEqual([
      'Request received',
      'Email',
      'Category',
      'Full name / Institution',
      'Outgoing No.',
      'Response date',
      'Responsible',
    ])
  })

  it('renders from→to emails, category, institution party, number and responsible lawyer', () => {
    renderOutgoing()

    expect(screen.getByText('legal@prionex.ua')).toBeInTheDocument()
    expect(screen.getByText('nbu@bank.gov.ua')).toBeInTheDocument()
    expect(screen.getByText('NBU reply')).toBeInTheDocument()
    // client_name is null → institution_name is shown
    expect(screen.getByText('National Bank of Ukraine')).toBeInTheDocument()
    expect(screen.getByText('2307/01')).toBeInTheDocument()
    expect(screen.getByText('Jane Lawyer')).toBeInTheDocument()
  })
})
