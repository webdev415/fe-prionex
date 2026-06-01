/**
 * Telephony column rendering tests for CallsTable.
 *
 * The i18n mock in src/test/setup.ts returns the translation key when no
 * lookup entry exists, so we assert against the keys directly â€” this
 * proves we're hitting the white / grey / unknown branch, without
 * needing to extend the mock for every locale string.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { CallsTable } from '../CallsTable'
import type { CallMonitoringItem } from '@/features/training'

function makeCall(overrides: Partial<CallMonitoringItem>): CallMonitoringItem {
  return {
    call_id: 'c1',
    agent_extension: '1001',
    customer_number: '380631234567',
    direction: 'outbound',
    state: 'COMPLETED',
    outcome: 'answered',
    initiated_at: '2026-05-12T10:00:00Z',
    answered_at: null,
    ended_at: null,
    ring_duration: null,
    talk_duration: 60,
    total_duration: 65,
    // Real client_id so the Client column renders a #link rather than 'â€”'
    // and our em-dash assertions only catch the telephony column.
    client_id: 42,
    campaign_id: null,
    has_recording: false,
    telephony_type: 'unknown',
    ...overrides,
  }
}

function renderTable(rows: CallMonitoringItem[]) {
  return render(
    <MemoryRouter>
      <CallsTable data={rows} onOpenCall={vi.fn()} />
    </MemoryRouter>
  )
}

describe('CallsTable â€” telephony column', () => {
  it('renders the White badge for white calls', () => {
    renderTable([makeCall({ call_id: 'c-white', telephony_type: 'white' })])
    expect(screen.getByText('pages.training.telephonyType.white')).toBeInTheDocument()
  })

  it('renders the Grey badge for grey calls', () => {
    renderTable([makeCall({ call_id: 'c-grey', telephony_type: 'grey' })])
    expect(screen.getByText('pages.training.telephonyType.grey')).toBeInTheDocument()
  })

  it('renders an em-dash for unknown calls', () => {
    renderTable([makeCall({ call_id: 'c-unknown', telephony_type: 'unknown' })])
    // The unknown branch renders a plain em-dash, not a badge key.
    expect(screen.getByText('â€”')).toBeInTheDocument()
    expect(screen.queryByText('pages.training.telephonyType.white')).not.toBeInTheDocument()
    expect(screen.queryByText('pages.training.telephonyType.grey')).not.toBeInTheDocument()
  })

  it('renders all three variants when present in the same table', () => {
    renderTable([
      makeCall({ call_id: 'c-white', telephony_type: 'white' }),
      makeCall({ call_id: 'c-grey', telephony_type: 'grey' }),
      makeCall({ call_id: 'c-unknown', telephony_type: 'unknown' }),
    ])
    expect(screen.getByText('pages.training.telephonyType.white')).toBeInTheDocument()
    expect(screen.getByText('pages.training.telephonyType.grey')).toBeInTheDocument()
    expect(screen.getByText('â€”')).toBeInTheDocument()
  })

  it('renders em-dash for inbound calls regardless of stored telephony_type', () => {
    // Defensive guard: telephony type is outbound-only per PM. Even if a
    // stray inbound row arrives with telephony_type='white' (DB drift, bad
    // backfill, etc.), the UI must still hide it.
    renderTable([
      makeCall({
        call_id: 'c-in-white',
        direction: 'inbound',
        telephony_type: 'white',
      }),
      makeCall({
        call_id: 'c-in-grey',
        direction: 'inbound',
        telephony_type: 'grey',
      }),
    ])
    expect(screen.queryByText('pages.training.telephonyType.white')).not.toBeInTheDocument()
    expect(screen.queryByText('pages.training.telephonyType.grey')).not.toBeInTheDocument()
    // Two inbound rows â†’ two em-dashes.
    expect(screen.getAllByText('â€”')).toHaveLength(2)
  })
})
