import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { CallClientContracts, type CallMatchedClient } from '../CallClientContracts'

function client(over: Partial<CallMatchedClient> = {}): CallMatchedClient {
  return {
    clientId: 25,
    clientName: 'Кондратюк Наталія',
    contracts: [
      {
        id: 'c1',
        number: '№1234567',
        status: 'Open',
        marker: 'RR',
        counterparty: 'Bank X',
        loanPrincipal: 40000,
        debt: 40000,
        saleDate: '2024-03-12',
        lastContact: '2025-12-03T14:30:00Z',
      },
      {
        id: 'c2',
        number: '№7654321',
        status: 'Closed',
        counterparty: 'Bank X',
        loanPrincipal: 40000,
        debt: 0,
        saleDate: '2024-03-12',
        lastContact: null,
      },
    ],
    ...over,
  }
}

function renderClient(over: Partial<Parameters<typeof CallClientContracts>[0]> = {}) {
  const onIncludedChange = vi.fn()
  render(
    <CallClientContracts client={client()} included onIncludedChange={onIncludedChange} {...over} />
  )
  return { onIncludedChange }
}

describe('CallClientContracts', () => {
  it('reports the toggle, which decides where the interaction is written', () => {
    const { onIncludedChange } = renderClient()

    fireEvent.click(screen.getByRole('switch'))

    expect(onIncludedChange).toHaveBeenCalledWith(false)
  })

  it('offers no way to pick an individual contract', () => {
    renderClient()

    // Interactions are filed against clients, not contracts; the cards are
    // read-only context for the conversation.
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
  })

  it('shows every contract and its link whether the toggle is on or off', () => {
    renderClient({ included: false })

    // Off means only "do not write the interaction here" — the operator still
    // needs these to talk about while the caller is on the line.
    expect(screen.getByText('№1234567')).toBeVisible()
    expect(screen.getByText('№7654321')).toBeVisible()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/dashboard/clients/25')
  })

  it('links to the client in a new tab without leaving the call', () => {
    renderClient()

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('shows a placeholder rather than "Invalid Date" for a missing date', () => {
    renderClient()

    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })
})
