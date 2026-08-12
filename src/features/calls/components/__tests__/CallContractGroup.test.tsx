import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { CallContractGroup, type CallContractGroupData } from '../CallContractGroup'

function group(over: Partial<CallContractGroupData> = {}): CallContractGroupData {
  return {
    id: 'g1',
    clientId: 25,
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

function renderGroup(over: Partial<Parameters<typeof CallContractGroup>[0]> = {}) {
  const onSelectContract = vi.fn()
  const onEnabledChange = vi.fn()
  render(
    <CallContractGroup
      group={group()}
      enabled
      onEnabledChange={onEnabledChange}
      selectedContractId={null}
      onSelectContract={onSelectContract}
      {...over}
    />
  )
  return { onSelectContract, onEnabledChange }
}

describe('CallContractGroup', () => {
  it('reports which contract the operator picked', () => {
    const { onSelectContract } = renderGroup()

    // The selected contract is what the interaction gets filed against, so the
    // choice has to reach the caller by contract id, not by position.
    fireEvent.click(screen.getByRole('radio', { name: '№7654321' }))

    expect(onSelectContract).toHaveBeenCalledWith('c2')
  })

  it('cannot be selected from while the group is switched off', () => {
    renderGroup({ enabled: false })

    screen.getAllByRole('radio').forEach((radio) => expect(radio).toBeDisabled())
  })

  it('reports the toggle', () => {
    const { onEnabledChange } = renderGroup()

    fireEvent.click(screen.getByRole('switch'))

    expect(onEnabledChange).toHaveBeenCalledWith(false)
  })

  it('links the group header to the client that owns it', () => {
    renderGroup()

    expect(screen.getByRole('link')).toHaveAttribute('href', '/dashboard/clients/25')
  })

  it('renders no link when the group names no client', () => {
    renderGroup({ group: group({ clientId: null }) })

    // Better nothing than a control that goes nowhere.
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('shows a placeholder rather than "Invalid Date" for a missing date', () => {
    renderGroup()

    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })
})
