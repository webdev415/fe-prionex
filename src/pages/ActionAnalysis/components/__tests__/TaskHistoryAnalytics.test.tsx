/**
 * Calendar-view tests for TaskHistoryAnalytics (KAN-483 follow-up).
 *
 * The i18n mock in src/test/setup.ts returns translation keys verbatim
 * when no entry exists, so we assert on keys for labels and the
 * data-date / data-in-month attributes for grid cell behaviour.
 */

import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { TaskHistoryAnalytics } from '../TaskHistoryAnalytics'

const MAY_2026 = new Date(2026, 4, 1) // 1 May 2026

describe('TaskHistoryAnalytics (calendar view)', () => {
  it('renders the seven weekday header cells', () => {
    render(<TaskHistoryAnalytics buckets={[]} total={0} initialViewMonth={MAY_2026} />)
    for (const key of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']) {
      expect(
        screen.getByText(`pages.actionAnalysis.taskHistoryAnalytics.weekdayShort.${key}`)
      ).toBeInTheDocument()
    }
  })

  it('places counts on the right day cells', () => {
    render(
      <TaskHistoryAnalytics
        buckets={[
          { date: '2026-05-13', count: 3 },
          { date: '2026-05-20', count: 7 },
        ]}
        total={10}
        initialViewMonth={MAY_2026}
      />
    )
    const cell13 = document.querySelector('[data-date="2026-05-13"]')!
    const cell20 = document.querySelector('[data-date="2026-05-20"]')!
    expect(cell13.textContent).toContain('13')
    expect(cell13.textContent).toContain('3')
    expect(cell20.textContent).toContain('20')
    expect(cell20.textContent).toContain('7')
  })

  it('shows no count on days without a bucket', () => {
    render(
      <TaskHistoryAnalytics
        buckets={[{ date: '2026-05-13', count: 5 }]}
        total={5}
        initialViewMonth={MAY_2026}
      />
    )
    const cell14 = document.querySelector('[data-date="2026-05-14"]')!
    // Only the day number, not a count badge.
    expect(cell14.textContent?.trim()).toBe('14')
  })

  it('marks out-of-month cells with data-in-month="false"', () => {
    render(<TaskHistoryAnalytics buckets={[]} total={0} initialViewMonth={MAY_2026} />)
    // 1 May 2026 is a Friday; the grid (Monday-first) leads with 27-28-29-30 Apr.
    const aprilLeader = document.querySelector('[data-date="2026-04-27"]')!
    expect(aprilLeader.getAttribute('data-in-month')).toBe('false')
    const mayDay = document.querySelector('[data-date="2026-05-13"]')!
    expect(mayDay.getAttribute('data-in-month')).toBe('true')
  })

  it('advances the visible month when Next is clicked', () => {
    // 25 June is past the trailing out-of-month padding shown in the May
    // grid (May's 6-week grid runs through 7 Jun), so it only appears
    // after we've navigated to June.
    render(
      <TaskHistoryAnalytics
        buckets={[{ date: '2026-06-25', count: 4 }]}
        total={4}
        initialViewMonth={MAY_2026}
      />
    )
    expect(document.querySelector('[data-date="2026-06-25"]')).toBeNull()

    const nextBtn = screen.getByLabelText('pages.actionAnalysis.taskHistoryAnalytics.nextMonth')
    fireEvent.click(nextBtn)

    const juneCell = document.querySelector('[data-date="2026-06-25"]')
    expect(juneCell).not.toBeNull()
    expect(juneCell!.getAttribute('data-in-month')).toBe('true')
    expect(juneCell!.textContent).toContain('4')
  })

  it('moves to the previous month when Prev is clicked', () => {
    render(<TaskHistoryAnalytics buckets={[]} total={0} initialViewMonth={MAY_2026} />)
    const prevBtn = screen.getByLabelText('pages.actionAnalysis.taskHistoryAnalytics.prevMonth')
    fireEvent.click(prevBtn)
    // After one step back, an April day must be in-month.
    const aprilCell = document.querySelector('[data-date="2026-04-15"]')!
    expect(aprilCell.getAttribute('data-in-month')).toBe('true')
  })

  it('renders the empty-month message when the visible month has no buckets', () => {
    render(
      <TaskHistoryAnalytics
        buckets={[{ date: '2026-04-10', count: 2 }]}
        total={2}
        initialViewMonth={MAY_2026}
      />
    )
    expect(
      screen.getByText('pages.actionAnalysis.taskHistoryAnalytics.emptyMonth')
    ).toBeInTheDocument()
  })

  it('hides the empty-month message when the visible month has buckets', () => {
    render(
      <TaskHistoryAnalytics
        buckets={[{ date: '2026-05-13', count: 1 }]}
        total={1}
        initialViewMonth={MAY_2026}
      />
    )
    expect(
      screen.queryByText('pages.actionAnalysis.taskHistoryAnalytics.emptyMonth')
    ).not.toBeInTheDocument()
  })

  it('shows the placeholder total while loading', () => {
    render(<TaskHistoryAnalytics buckets={[]} total={0} isLoading initialViewMonth={MAY_2026} />)
    expect(screen.getByText('…')).toBeInTheDocument()
  })

  it('renders the Today button', () => {
    render(<TaskHistoryAnalytics buckets={[]} total={0} initialViewMonth={MAY_2026} />)
    expect(screen.getByText('pages.actionAnalysis.taskHistoryAnalytics.today')).toBeInTheDocument()
  })
})
