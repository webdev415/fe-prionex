/**
 * The empty space after the last section.
 *
 * The assertions match on anchored regexes rather than strings: matching a
 * string is a substring test, so expecting "72" is satisfied by "472" and a
 * hook that never re-measured would have passed.
 *
 * It exists so the last tab can do what every other tab does: put its
 * section's top under the header. Without it the container runs out first, the
 * section stops wherever it happens to sit, and the tab reads as broken - the
 * scroll did happen, it just had nowhere left to go.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { useTailSpace } from '../hooks/useTailSpace'

let container: HTMLDivElement
let last: HTMLElement

function Probe({ id, offset, ready = true }: { id: string; offset?: number; ready?: boolean }) {
  return <span data-testid="space">{useTailSpace(id, offset, ready)}</span>
}

function sized({ room, section }: { room: number; section: number }) {
  Object.defineProperty(container, 'clientHeight', { value: room, configurable: true })
  Object.defineProperty(last, 'offsetHeight', { value: section, configurable: true })
}

describe('useTailSpace', () => {
  beforeEach(() => {
    container = document.createElement('div')
    container.style.overflowY = 'auto'
    last = document.createElement('section')
    last.id = 'chronology'
    container.appendChild(last)
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
    vi.unstubAllGlobals()
  })

  it('makes up exactly what the last section falls short by', () => {
    sized({ room: 800, section: 200 })
    render(<Probe id="chronology" offset={128} />)

    // 800 of container, less the 128 the header covers, leaves 672 to fill;
    // the section itself is 200 of that.
    expect(screen.getByTestId('space')).toHaveTextContent(/^472$/)
  })

  it('adds nothing when the last section is already tall enough', () => {
    sized({ room: 800, section: 5000 })
    render(<Probe id="chronology" offset={128} />)

    expect(screen.getByTestId('space')).toHaveTextContent(/^0$/)
  })

  it('never asks for a negative gap', () => {
    sized({ room: 300, section: 900 })
    render(<Probe id="chronology" offset={128} />)

    expect(screen.getByTestId('space')).toHaveTextContent(/^0$/)
  })

  it('measures again when the window changes size', () => {
    sized({ room: 800, section: 200 })
    render(<Probe id="chronology" offset={128} />)

    sized({ room: 400, section: 200 })
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })

    expect(screen.getByTestId('space')).toHaveTextContent(/^72$/)
  })

  /*
   * Sections grow as they load and as somebody edits them, so a height
   * measured once and trusted goes wrong the moment a document is attached.
   */
  it('measures again when the section itself grows', () => {
    // The observer only fires for what it was actually given to watch, so a
    // hook that never observes the section gets no callback and no update.
    const watchers: Array<{ run: () => void; targets: Element[] }> = []
    vi.stubGlobal(
      'ResizeObserver',
      class {
        targets: Element[] = []
        constructor(callback: () => void) {
          watchers.push({ run: callback, targets: this.targets })
        }
        observe(element: Element) {
          this.targets.push(element)
        }
        disconnect() {}
      }
    )
    sized({ room: 800, section: 200 })
    render(<Probe id="chronology" offset={128} />)

    sized({ room: 800, section: 600 })
    act(() => {
      watchers.filter((one) => one.targets.includes(last)).forEach((one) => one.run())
    })

    expect(screen.getByTestId('space')).toHaveTextContent(/^72$/)
  })

  /*
   * The card renders nothing until its request answers, so on a cold load this
   * runs against a page holding only the word "Loading". Nothing about the
   * arguments changes when the sections arrive, so without being told to look
   * again it would give up for good - which is what left the gap at zero and
   * the last tabs looking dead.
   */
  it('measures once the sections have arrived, not only if they were already there', () => {
    const { rerender } = render(<Probe id="chronology" offset={128} ready={false} />)
    expect(screen.getByTestId('space')).toHaveTextContent(/^0$/)

    sized({ room: 800, section: 200 })
    rerender(<Probe id="chronology" offset={128} ready />)

    expect(screen.getByTestId('space')).toHaveTextContent(/^472$/)
  })

  it('asks for nothing when the section is not on the page', () => {
    render(<Probe id="missing" offset={128} />)

    expect(screen.getByTestId('space')).toHaveTextContent(/^0$/)
  })
})
