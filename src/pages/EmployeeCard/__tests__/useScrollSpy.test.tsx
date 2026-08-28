/**
 * Which tab the underline sits under.
 *
 * jsdom lays nothing out - every rectangle is zero - so the positions are
 * stubbed and the scroll events fired by hand. That is the only way to say
 * "the reader has scrolled to here" and check the answer.
 *
 * The case worth keeping in mind while reading these: the rule has to hold for
 * sections of wildly different heights. The version before this ranked them by
 * how much of each was on screen as a fraction of its own height, so a short
 * section scored higher than a tall one that filled the screen, and the
 * underline sat under a section the reader had already passed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { CARD_HEADER_OFFSET, useScrollSpy } from '../hooks/useScrollSpy'

const IDS = ['personal', 'work', 'documents']

let container: HTMLDivElement

/** Place each section's top edge, in viewport coordinates. */
function place(
  tops: Record<string, number>,
  scroll?: { top: number; client: number; height: number }
) {
  for (const [id, top] of Object.entries(tops)) {
    const element = document.getElementById(id) as HTMLElement
    element.getBoundingClientRect = () => ({ top, bottom: top + 200, height: 200 }) as DOMRect
  }
  if (scroll) {
    Object.defineProperty(container, 'scrollTop', { value: scroll.top, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: scroll.client, configurable: true })
    Object.defineProperty(container, 'scrollHeight', { value: scroll.height, configurable: true })
  }
}

function scroll() {
  act(() => {
    container.dispatchEvent(new Event('scroll'))
  })
}

/*
 * The probe offers a button per section rather than handing `select` out to
 * the test. Assigning it during render is a side effect, and one the linter
 * rightly refuses: what a render writes to the outside depends on when React
 * happens to re-render.
 */
function Probe({ ids, ready = true }: { ids: string[]; ready?: boolean }) {
  const spy = useScrollSpy(ids, CARD_HEADER_OFFSET, ready)
  return (
    <>
      <span data-testid="active">{spy.active}</span>
      {ids.map((id) => (
        <button key={id} data-testid={`choose-${id}`} onClick={() => spy.select(id)} />
      ))}
    </>
  )
}

function choose(id: string) {
  fireEvent.click(screen.getByTestId(`choose-${id}`))
}

describe('useScrollSpy', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})

    container = document.createElement('div')
    container.style.overflowY = 'auto'
    container.getBoundingClientRect = () => ({ top: 0 }) as DOMRect
    Object.defineProperty(container, 'scrollTop', { value: 0, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 800, configurable: true })
    Object.defineProperty(container, 'scrollHeight', { value: 4000, configurable: true })

    for (const id of IDS) {
      const section = document.createElement('section')
      section.id = id
      container.appendChild(section)
    }
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
    vi.unstubAllGlobals()
  })

  it('starts on the first section', () => {
    place({ personal: 200, work: 900, documents: 1600 })
    render(<Probe ids={IDS} />)

    expect(screen.getByTestId('active')).toHaveTextContent('personal')
  })

  it('follows the reader down, one section at a time', () => {
    place({ personal: 200, work: 900, documents: 1600 })
    render(<Probe ids={IDS} />)

    place({ personal: -400, work: 100, documents: 800 })
    scroll()
    expect(screen.getByTestId('active')).toHaveTextContent('work')

    place({ personal: -1100, work: -600, documents: 100 })
    scroll()
    expect(screen.getByTestId('active')).toHaveTextContent('documents')
  })

  /*
   * The one the old rule got wrong: a tall section filling the screen loses to
   * a short one that has already been scrolled past, because the score was a
   * fraction of each section's own height.
   */
  it('names the section under the header, not the one that fits best', () => {
    place({ personal: 200, work: 900, documents: 1600 })
    render(<Probe ids={IDS} />)

    // `work` is short and entirely on screen; `documents` is tall, starts just
    // under the header and runs off the bottom. The reader is in `documents`.
    const documents = document.getElementById('documents') as HTMLElement
    place({ personal: -900, work: -300 })
    documents.getBoundingClientRect = () => ({ top: 120, bottom: 3000, height: 2880 }) as DOMRect
    scroll()

    expect(screen.getByTestId('active')).toHaveTextContent('documents')
  })

  it('does not move on for a section that has not reached the header yet', () => {
    place({ personal: 200, work: 900, documents: 1600 })
    render(<Probe ids={IDS} />)

    place({ personal: -100, work: CARD_HEADER_OFFSET + 40, documents: 900 })
    scroll()

    expect(screen.getByTestId('active')).toHaveTextContent('personal')
  })

  /*
   * The bug this replaced a rule for. The card's last sections can all fit on
   * one screen, so scrolling to the bottom does not push the final section's
   * top under the header - and an earlier version answered "the last one"
   * whenever the container was at its end. That overrode everything: asking
   * for Documents and Hiring scrolled there and the underline snapped back to
   * Chronology, so the tab looked broken.
   */
  it('holds the section that was asked for, even at the bottom', () => {
    place({ personal: 200, work: 900, documents: 1600 })
    render(<Probe ids={IDS} />)

    choose('work')
    place({ personal: -2000, work: 400, documents: 700 }, { top: 3200, client: 800, height: 4000 })
    scroll()

    expect(screen.getByTestId('active')).toHaveTextContent('work')
  })

  it('answers for itself again once the card has been still for a moment', () => {
    vi.useFakeTimers()
    try {
      place({ personal: 200, work: 900, documents: 1600 })
      render(<Probe ids={IDS} />)

      choose('work')
      place({ personal: -1100, work: -600, documents: 100 })
      scroll()
      expect(screen.getByTestId('active')).toHaveTextContent('work')

      act(() => {
        vi.advanceTimersByTime(200)
      })
      expect(screen.getByTestId('active')).toHaveTextContent('documents')
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not let a section scrolled past overrule what was asked for', () => {
    place({ personal: 200, work: 900, documents: 1600 })
    render(<Probe ids={IDS} />)

    choose('personal')
    place({ personal: -1100, work: -600, documents: -100 })
    scroll()

    expect(screen.getByTestId('active')).toHaveTextContent('personal')
  })

  it('answers again when the window is resized, not only when scrolled', () => {
    place({ personal: 200, work: 900, documents: 1600 })
    render(<Probe ids={IDS} />)

    place({ personal: -400, work: 100, documents: 800 })
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })

    expect(screen.getByTestId('active')).toHaveTextContent('work')
  })

  /*
   * Same cold-load problem as the spacer: the sections do not exist while the
   * card is still loading, and nothing here changes afterwards to make it look
   * again. Without being told, the bar follows the reader only on a visit
   * where the card was already in hand.
   */
  it('starts following once the sections have arrived', () => {
    place({ personal: 200, work: 900, documents: 1600 })
    const { rerender } = render(<Probe ids={IDS} ready={false} />)

    place({ personal: -400, work: 100, documents: 800 })
    scroll()
    expect(screen.getByTestId('active')).toHaveTextContent('personal')

    rerender(<Probe ids={IDS} ready />)
    scroll()

    expect(screen.getByTestId('active')).toHaveTextContent('work')
  })

  it('says nothing about sections that are not on the page', () => {
    place({ personal: 200, work: 900, documents: 1600 })
    render(<Probe ids={['personal', 'missing', 'work']} />)

    expect(screen.getByTestId('active')).toHaveTextContent('personal')
  })
})
