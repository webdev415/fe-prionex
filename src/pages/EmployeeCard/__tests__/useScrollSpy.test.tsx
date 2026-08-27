import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { useScrollSpy } from '../hooks/useScrollSpy'

/**
 * The observer is driven by hand here.
 *
 * jsdom lays nothing out, so nothing ever intersects on its own. Capturing the
 * callback and calling it is the only way to say "the reader is looking at
 * this one" and check the answer.
 */
let notify: ((entries: unknown[]) => void) | null = null
let observed: Element[] = []

class FakeObserver {
  constructor(callback: (entries: unknown[]) => void) {
    notify = callback
  }
  observe(element: Element) {
    observed.push(element)
  }
  disconnect() {
    observed = []
  }
}

function Probe({ ids }: { ids: string[] }) {
  const active = useScrollSpy(ids)
  return <span data-testid="active">{active}</span>
}

function entry(id: string, ratio: number) {
  return { target: { id }, intersectionRatio: ratio }
}

describe('useScrollSpy', () => {
  beforeEach(() => {
    notify = null
    observed = []
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    document.body.innerHTML = `
      <div id="one"></div><div id="two"></div><div id="three"></div>
    `
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('starts on the first section before anything has been seen', () => {
    render(<Probe ids={['one', 'two', 'three']} />)

    expect(screen.getByTestId('active')).toHaveTextContent('one')
  })

  it('watches every section it was given', () => {
    render(<Probe ids={['one', 'two', 'three']} />)

    expect(observed.map((element) => element.id)).toEqual(['one', 'two', 'three'])
  })

  it('follows whichever section is most in view', () => {
    render(<Probe ids={['one', 'two', 'three']} />)

    act(() => notify?.([entry('one', 0.1), entry('two', 0.9)]))

    expect(screen.getByTestId('active')).toHaveTextContent('two')
  })

  it('does not move to a section that has scrolled out of view', () => {
    render(<Probe ids={['one', 'two', 'three']} />)

    act(() => notify?.([entry('two', 0.9)]))
    act(() => notify?.([entry('two', 0), entry('three', 0.4)]))

    expect(screen.getByTestId('active')).toHaveTextContent('three')
  })

  it('keeps the last answer when nothing is in view at all', () => {
    render(<Probe ids={['one', 'two', 'three']} />)

    act(() => notify?.([entry('two', 0.9)]))
    act(() => notify?.([entry('two', 0)]))

    expect(screen.getByTestId('active')).toHaveTextContent('two')
  })

  it('survives a section the page does not have', () => {
    render(<Probe ids={['one', 'missing']} />)

    expect(observed.map((element) => element.id)).toEqual(['one'])
  })
})
