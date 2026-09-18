/**
 * KAN-KB-54 — the markup of `pages/ActionAnalysis`, phase 3.4.
 *
 * This section is almost entirely tables, so almost all of it is one flag per
 * column. Which is the case worth testing: the flag lives in the caller and the
 * attribute is emitted three files away, so a column can look correct at every
 * call site while nothing reaches the DOM.
 */

import { describe, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { InteractionHistoryTable } from '../InteractionHistoryTable'
import { expectObscured, expectNotObscured } from '@/test/piiHelpers'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

const ROW = {
  id: 1,
  client_id: 501,
  client_full_name: 'Петрова Анна Сергіївна',
  phone_used: '+380501234567',
  interaction_type: 'call',
  result: 'promise',
  created_at: '2026-03-01T10:00:00Z',
}

describe('ActionAnalysis PII markup — InteractionHistoryTable', () => {
  const renderTable = () =>
    render(
      <MemoryRouter>
        <InteractionHistoryTable
          data={[ROW] as never}
          sortBy={'created_at' as never}
          sortDir={'desc' as never}
          onSortChange={vi.fn()}
        />
      </MemoryRouter>
    )

  it("masks the client's name", () => {
    renderTable()
    expectObscured(screen.getByText(ROW.client_full_name))
  })

  it('leaves the column headers readable', () => {
    renderTable()
    for (const header of screen.getAllByRole('columnheader')) {
      expectNotObscured(header)
    }
  })
})
