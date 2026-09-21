/**
 * The calling window at the top of the Dialer page.
 *
 * It exists because the per-queue status only appears once the window has held
 * a queue, which needs a synced, switched-on one. A supervisor could switch a
 * queue on after hours and get no explanation at all.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { DialerCallingWindow } from '@/features/dialer/types'

const useWindow = vi.fn()
vi.mock('@/features/dialer/hooks/useDialerCallingWindow', () => ({
  useDialerCallingWindow: () => useWindow(),
}))

import { CallingWindowBanner } from '../CallingWindowBanner'
import { formatReopening } from '../formatReopening'

const KYIV_MON_TO_WED: DialerCallingWindow = {
  state: 'closed',
  start: '09:00',
  end: '20:45',
  weekdays: [1, 2, 3],
  timezone: 'Europe/Kyiv',
  reason: 'weekday_not_allowed',
  detail: 'Friday is outside the allowed weekdays',
  next_open_at: '2026-09-21T06:00:00+00:00',
}

function serve(data: Partial<DialerCallingWindow> | undefined, isError = false) {
  useWindow.mockReturnValue({ data: data && { ...KYIV_MON_TO_WED, ...data }, isError })
}

beforeEach(() => useWindow.mockReset())

describe('formatReopening', () => {
  it('renders the reopening in the project zone, not UTC or the browser', () => {
    // 06:00 UTC is 09:00 in Kyiv on 21 Sep (EEST). Printing "06:00" would be
    // the right instant presented as the wrong promise.
    const text = formatReopening('2026-09-21T06:00:00+00:00', 'Europe/Kyiv', 'en')
    expect(text).toContain('09:00')
    expect(text).toMatch(/Mon/)
    expect(text).not.toContain('06:00')
  })

  it('follows the UI language', () => {
    const uk = formatReopening('2026-09-21T06:00:00+00:00', 'Europe/Kyiv', 'uk')
    expect(uk).toContain('09:00')
    expect(uk).not.toMatch(/Mon/)
  })

  it('prints nothing for an unknown zone rather than the browser time', () => {
    expect(formatReopening('2026-09-21T06:00:00+00:00', 'Mars/Base', 'en')).toBe('')
  })
})

describe('CallingWindowBanner', () => {
  it('says the window is shut, why, and when dialling resumes', () => {
    serve({})
    render(<CallingWindowBanner />)
    expect(screen.getByTestId('calling-window-closed')).toBeInTheDocument()
    expect(screen.getByText(/dialer\.callingWindow\.closedTitle/)).toBeInTheDocument()
    expect(screen.getByText('dialer.callingWindow.resumes')).toBeInTheDocument()
    expect(screen.queryByText('dialer.callingWindow.resumesUnknown')).toBeNull()
  })

  it('uses the same wording for the reason as the call button', () => {
    serve({})
    render(<CallingWindowBanner />)
    // reasonMessage from the calls feature, not a second set of strings.
    expect(screen.getByText(/pages\.calls\.callingWindow\.weekend/)).toBeInTheDocument()
  })

  it('does not promise a time it cannot know', () => {
    serve({ next_open_at: null })
    render(<CallingWindowBanner />)
    expect(screen.getByText('dialer.callingWindow.resumesUnknown')).toBeInTheDocument()
    expect(screen.queryByText('dialer.callingWindow.resumes')).toBeNull()
  })

  it('shrinks to one quiet line while the window is open', () => {
    serve({ state: 'open', next_open_at: null, reason: null })
    render(<CallingWindowBanner />)
    expect(screen.getByTestId('calling-window-open')).toBeInTheDocument()
    expect(screen.queryByTestId('calling-window-closed')).toBeNull()
  })

  it('reports an unreadable window as unknown, never as open', () => {
    serve({ state: 'unavailable' })
    render(<CallingWindowBanner />)
    expect(screen.getByText('pages.calls.callingWindow.unavailable')).toBeInTheDocument()
    expect(screen.queryByTestId('calling-window-open')).toBeNull()
  })

  it.each([
    ['a project without a window', { state: 'disabled' as const }, false],
    ['a failed request', {}, true],
    ['no data yet', undefined, false],
  ])('shows nothing for %s', (_label, data, isError) => {
    serve(data, isError)
    const { container } = render(<CallingWindowBanner />)
    expect(container).toBeEmptyDOMElement()
  })
})
