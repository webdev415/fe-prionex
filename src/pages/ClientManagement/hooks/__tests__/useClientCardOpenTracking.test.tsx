/**
 * Card-open tracking: the event the activity feed reports as "opened the card".
 *
 * Driven through a real in-memory router, because every behaviour here is
 * about the URL: which `?from=` counts, when it is dropped, and what happens
 * when the card is re-opened on the client already on screen.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useClientCardOpenTracking } from '../useClientCardOpenTracking'

const toastError = vi.fn()
vi.mock('sonner', () => ({ toast: { error: (...a: unknown[]) => toastError(...a) } }))

const trackEvent = vi.fn()

function Card() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  useClientCardOpenTracking(id, trackEvent)
  return (
    <>
      <output data-testid="url">{location.pathname + location.search}</output>
      {/* A link click, as the card sees it: navigation without a remount. */}
      <input data-testid="go" onChange={(e) => navigate(e.target.value)} />
    </>
  )
}

/** Navigate the mounted card to another URL, without remounting it. */
function go(to: string) {
  fireEvent.change(screen.getByTestId('go'), { target: { value: to } })
}

function open(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/dashboard/clients/:id" element={<Card />} />
        <Route path="/dashboard/clients" element={<output data-testid="url">list</output>} />
      </Routes>
    </MemoryRouter>
  )
}

const url = () => screen.getByTestId('url').textContent
const opens = () => trackEvent.mock.calls.filter(([type]) => type === 'client_card_open')

beforeEach(() => {
  trackEvent.mockReset()
  toastError.mockReset()
})

describe('useClientCardOpenTracking', () => {
  it('records an open from a tagged entry point once, then drops ?from=', () => {
    open('/dashboard/clients/5?from=search')

    expect(opens()).toEqual([
      ['client_card_open', { clientId: 5, meta: { client_id: '5', origin: 'search' } }],
    ])
    expect(url()).toBe('/dashboard/clients/5')
  })

  it('records nothing for an open with no entry point', () => {
    // The requirement names three origins; an untagged open is not recorded.
    open('/dashboard/clients/5')

    expect(opens()).toEqual([])
    expect(url()).toBe('/dashboard/clients/5')
  })

  it('drops ?from= when the client already on screen is opened again', () => {
    // The same client picked again in search. The once-per-card check stops
    // this run early; a strip placed after it never ran, the param stayed, and
    // a refresh then reported a search-open that had not happened.
    open('/dashboard/clients/5?from=list')
    go('/dashboard/clients/5?from=search')

    expect(url()).toBe('/dashboard/clients/5')
    expect(opens()).toHaveLength(1)
  })

  it('records an open of a different client', () => {
    open('/dashboard/clients/5?from=list')
    go('/dashboard/clients/6?from=search')

    expect(opens().map(([, e]) => e.meta)).toEqual([
      { client_id: '5', origin: 'list' },
      { client_id: '6', origin: 'search' },
    ])
    expect(url()).toBe('/dashboard/clients/6')
  })

  it('bounces an id no service can hold, and records nothing', () => {
    open('/dashboard/clients/99999999999999?from=search')

    expect(toastError).toHaveBeenCalledOnce()
    expect(url()).toBe('list')
    expect(opens()).toEqual([])
  })
})
