import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ELAPSED_VISIBLE_FROM_SECONDS,
  ReportLoadingStatus,
  ReportRefreshingOverlay,
  ReportTableLoading,
} from '../ReportLoadingState'

vi.mock('react-i18next', async () => (await import('@/test/englishI18n')).englishReactI18nextMock())

/**
 * The shared loading state of the Reports page tabs (Kanbanboard#100):
 * a caption from the first moment, the elapsed seconds from the 3rd second,
 * no slow-report hint, and a fresh clock for every loading phase.
 */
describe('ReportLoadingState', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-01T09:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms))

  it('shows the caption at once and no counter before the 3rd second', () => {
    render(<ReportLoadingStatus />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading data…')
    tick(ELAPSED_VISIBLE_FROM_SECONDS * 1000 - 1)
    expect(screen.queryByTestId('report-loading-elapsed')).not.toBeInTheDocument()
  })

  it('adds the elapsed seconds from the 3rd second and keeps counting', () => {
    render(<ReportLoadingStatus />)
    tick(3000)
    expect(screen.getByTestId('report-loading-elapsed')).toHaveTextContent('3 s')
    tick(4000)
    expect(screen.getByTestId('report-loading-elapsed')).toHaveTextContent('7 s')
  })

  it('never shows a slow-report hint, however long it waits', () => {
    render(<ReportLoadingStatus />)
    tick(60_000)
    // The unit is glued to the number with a no-break space, so a narrow card
    // cannot wrap «60 / s» onto two lines.
    expect(screen.getByRole('status').textContent).toBe('Loading data…60\u00a0s')
  })

  it('announces the caption once: the counter is hidden from screen readers', () => {
    render(<ReportLoadingStatus />)
    tick(5000)
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByTestId('report-loading-elapsed')).toHaveAttribute('aria-hidden', 'true')
  })

  it('starts a new phase from zero after an unmount', () => {
    const { unmount } = render(<ReportLoadingStatus />)
    tick(9000)
    unmount()
    render(<ReportLoadingStatus />)
    expect(screen.queryByTestId('report-loading-elapsed')).not.toBeInTheDocument()
    tick(3000)
    expect(screen.getByTestId('report-loading-elapsed')).toHaveTextContent('3 s')
  })

  it('first load: the table skeleton keeps its width and carries the caption', () => {
    const { container } = render(<ReportTableLoading columns={7} />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading data…')
    // TableSkeleton draws one header cell per column.
    expect(container.querySelectorAll('thead th')).toHaveLength(7)
  })

  it('new window: the overlay keeps the tab test id, and the caption is fixed to the viewport', () => {
    render(
      <div data-testid="tab-body" className="relative">
        <ReportRefreshingOverlay testId="drains-feed-refreshing" />
      </div>
    )
    expect(screen.getByTestId('drains-feed-refreshing')).toBeInTheDocument()
    const status = screen.getByRole('status')
    // Portalled out of the tab: a card inside the overlay would scroll away
    // with the top of a long table (sticky does not engage on this layout).
    expect(screen.getByTestId('tab-body')).not.toContainElement(status)
    expect(status.parentElement).toHaveClass('fixed', 'bottom-6')
  })

  it('new window: the caption goes away together with the overlay', () => {
    const { unmount } = render(<ReportRefreshingOverlay testId="drains-feed-refreshing" />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    unmount()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
