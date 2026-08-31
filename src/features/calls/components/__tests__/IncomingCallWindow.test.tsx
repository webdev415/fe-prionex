import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { IncomingCallWindow } from '../IncomingCallWindow'
import type { CallMatchedClient } from '../CallClientContracts'

const client = (id: number): CallMatchedClient => ({
  clientId: id,
  clientName: `Client ${id}`,
  contracts: [
    {
      id: `c${id}`,
      number: `№${id}`,
      status: 'Open',
      counterparty: 'Bank X',
      loanPrincipal: 40000,
      debt: 40000,
      saleDate: null,
      lastContact: null,
    },
  ],
})

function renderWindow(over: Partial<Parameters<typeof IncomingCallWindow>[0]> = {}) {
  const props = {
    phoneNumber: '+380971234567',
    clients: [client(1)],
    phase: 'ringing' as const,
    isIncluded: () => true,
    onIncludedChange: vi.fn(),
    results: [{ id: 1, name: 'Refusal' }],
    reasons: [],
    channels: [{ id: 10, name: 'Phone' }],
    onSaveInteraction: vi.fn(),
    interactionSaved: false,
    onMinimize: vi.fn(),
    onAccept: vi.fn(),
    onCancel: vi.fn(),
    onHold: vi.fn(),
    ...over,
  }
  render(<IncomingCallWindow {...props} />)
  return props
}

// The interaction form is the only textbox; the toggles are the only switches.
const interactionForm = () => screen.queryByRole('textbox')

describe('IncomingCallWindow', () => {
  it('offers nothing to record while the call is still ringing', () => {
    renderWindow({ phase: 'ringing' })

    // There is nothing to say about a call nobody has taken yet.
    expect(interactionForm()).toBeNull()
    expect(screen.getByText('№1')).toBeVisible()
  })

  it('shows the interaction form once connected', () => {
    renderWindow({ phase: 'connected' })

    expect(interactionForm()).not.toBeNull()
  })

  it('shows every matched client, not just one', () => {
    renderWindow({ clients: [client(1), client(2), client(3)] })

    // One number can belong to several clients and the interaction may go to
    // any of them, so the operator has to see them all.
    expect(screen.getAllByRole('switch')).toHaveLength(3)
  })

  it('names the caller only when a single client matched', () => {
    renderWindow({ clients: [client(1), client(2)] })

    // With several matches there is no one owner of the number; naming one
    // would assert a relationship the payload does not support.
    expect(screen.queryByText('Client 1')).toBeNull()
  })

  it('tells the operator when the number matched nobody', () => {
    renderWindow({ clients: [] })

    expect(screen.queryAllByRole('switch')).toHaveLength(0)
    expect(screen.getByText('+380971234567')).toBeVisible()
  })

  it('still lets an unknown caller have an interaction recorded', () => {
    renderWindow({ clients: [], phase: 'connected' })

    // Filed against no client, but the conversation still happened.
    expect(interactionForm()).not.toBeNull()
  })

  it('replaces the form with the confirmation once filed', () => {
    renderWindow({ phase: 'connected', interactionSaved: true })

    expect(interactionForm()).toBeNull()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('offers no way to close the window while the line is up', () => {
    renderWindow({ phase: 'connected' })

    // Minimise, Save Interaction, Cancel and Hold — and nothing that dismisses
    // the window while leaving the call running with no way back to it.
    expect(screen.getAllByRole('button')).toHaveLength(4)
    expect(screen.queryByRole('button', { name: /close/i })).toBeNull()
  })

  it('offers only minimise and the two call controls while ringing', () => {
    renderWindow({ phase: 'ringing' })

    // No Save yet, and no dismiss.
    expect(screen.getAllByRole('button')).toHaveLength(3)
    expect(screen.queryByRole('button', { name: /close/i })).toBeNull()
  })
})
