/**
 * Clicking a tab.
 *
 * It scrolls rather than navigates: every section is already on the page, so
 * routing to one would throw away what has loaded and lose the reader's place
 * on the way back.
 *
 * The scroll has to be smooth and land on the section's start - and the
 * section itself carries ``scroll-mt-32`` for the sticky header, without which
 * a clicked section arrives underneath the bar that sent the reader to it.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CardTabs } from '../components/CardTabs'

const TABS = [
  { id: 'personal-information', label: 'Personal Information' },
  { id: 'work-information', label: 'Work Information' },
]

/**
 * Put the strip in a state where some tabs are off the ends.
 *
 * jsdom measures nothing, so every width is zero and the strip always looks
 * as though everything fits. These are the three numbers the bar reads.
 */
function stripIs({ scrollLeft, clientWidth, scrollWidth }: Record<string, number>) {
  const strip = screen.getByRole('tablist')
  Object.defineProperty(strip, 'scrollLeft', {
    value: scrollLeft,
    writable: true,
    configurable: true,
  })
  Object.defineProperty(strip, 'clientWidth', { value: clientWidth, configurable: true })
  Object.defineProperty(strip, 'scrollWidth', { value: scrollWidth, configurable: true })
  fireEvent.scroll(strip)
  return strip
}

const earlier = () => screen.queryByRole('button', { name: 'pages.employeeCard.tabs.showEarlier' })
const later = () => screen.queryByRole('button', { name: 'pages.employeeCard.tabs.showLater' })

const scrollIntoView = vi.fn()
const focus = vi.fn()

function withSections() {
  for (const tab of TABS) {
    const section = document.createElement('section')
    section.id = tab.id
    // Assignment is refused here: something in the shared setup redefines
    // `focus` on the prototype with a getter only.
    Object.defineProperty(section, 'scrollIntoView', { value: scrollIntoView, configurable: true })
    Object.defineProperty(section, 'focus', { value: focus, configurable: true })
    document.body.appendChild(section)
  }
}

describe('CardTabs', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    scrollIntoView.mockReset()
    focus.mockReset()
  })

  it('scrolls smoothly to the section it names', async () => {
    withSections()
    render(<CardTabs tabs={TABS} activeId="personal-information" ariaLabel="sections" />)

    await userEvent.click(screen.getByRole('tab', { name: 'Work Information' }))

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
  })

  /*
   * Focus moves so the keyboard carries on from the section rather than from
   * the bar, but it must not scroll on its own - the browser would jump there
   * instantly and undo the smooth scroll that just started.
   */
  it('moves focus to the section without scrolling a second time', async () => {
    withSections()
    render(<CardTabs tabs={TABS} activeId="personal-information" ariaLabel="sections" />)

    await userEvent.click(screen.getByRole('tab', { name: 'Work Information' }))

    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
  })

  /*
   * Without this the last tabs look broken: the card's final sections fit on
   * one screen together, so the scroll cannot move far enough for the one that
   * was clicked to become the answer, and the underline stays where it was.
   */
  it('says which section was asked for before the scroll gets there', async () => {
    const onSelect = vi.fn()
    withSections()
    render(
      <CardTabs
        tabs={TABS}
        activeId="personal-information"
        ariaLabel="sections"
        onSelect={onSelect}
      />
    )

    await userEvent.click(screen.getByRole('tab', { name: 'Work Information' }))

    expect(onSelect).toHaveBeenCalledWith('work-information')
  })

  it('says nothing about a section that is not on the page', async () => {
    const onSelect = vi.fn()
    render(
      <CardTabs
        tabs={TABS}
        activeId="personal-information"
        ariaLabel="sections"
        onSelect={onSelect}
      />
    )

    await userEvent.click(screen.getByRole('tab', { name: 'Work Information' }))

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('marks the section being read, and only that one', () => {
    withSections()
    render(<CardTabs tabs={TABS} activeId="work-information" ariaLabel="sections" />)

    expect(screen.getByRole('tab', { name: 'Work Information' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.getByRole('tab', { name: 'Personal Information' })).toHaveAttribute(
      'aria-selected',
      'false'
    )
  })

  it('underlines the one being read', () => {
    withSections()
    render(<CardTabs tabs={TABS} activeId="work-information" ariaLabel="sections" />)

    const active = screen.getByRole('tab', { name: 'Work Information' })
    const other = screen.getByRole('tab', { name: 'Personal Information' })

    expect(active.className).toContain('border-primary-500')
    expect(other.className).toContain('border-transparent')
  })

  it('does nothing rather than throwing when a section is not on the page', async () => {
    render(<CardTabs tabs={TABS} activeId="personal-information" ariaLabel="sections" />)

    await userEvent.click(screen.getByRole('tab', { name: 'Work Information' }))

    expect(scrollIntoView).not.toHaveBeenCalled()
  })
})

/*
 * Seven tabs do not fit a phone, so the strip scrolls sideways. A scrollbar
 * there sits across the tabs themselves, so it is hidden - which leaves the
 * arrows as the only thing saying there is more, and they have to appear
 * exactly when there is.
 */
describe('CardTabs: when the tabs do not all fit', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    scrollIntoView.mockReset()
    focus.mockReset()
  })

  it('hides the scrollbar rather than laying it across the tabs', () => {
    withSections()
    render(<CardTabs tabs={TABS} activeId="personal-information" ariaLabel="sections" />)

    const strip = screen.getByRole('tablist')
    expect(strip.className).toContain('[scrollbar-width:none]')
    expect(strip.className).toContain('[&::-webkit-scrollbar]:hidden')
  })

  it('offers nothing when every tab is already on screen', () => {
    withSections()
    render(<CardTabs tabs={TABS} activeId="personal-information" ariaLabel="sections" />)

    stripIs({ scrollLeft: 0, clientWidth: 800, scrollWidth: 800 })

    expect(earlier()).toBeNull()
    expect(later()).toBeNull()
  })

  it('points ahead while there are tabs off the end', () => {
    withSections()
    render(<CardTabs tabs={TABS} activeId="personal-information" ariaLabel="sections" />)

    stripIs({ scrollLeft: 0, clientWidth: 300, scrollWidth: 900 })

    expect(later()).toBeInTheDocument()
    expect(earlier()).toBeNull()
  })

  it('points back once tabs have been scrolled past', () => {
    withSections()
    render(<CardTabs tabs={TABS} activeId="personal-information" ariaLabel="sections" />)

    stripIs({ scrollLeft: 300, clientWidth: 300, scrollWidth: 900 })

    expect(earlier()).toBeInTheDocument()
    expect(later()).toBeInTheDocument()
  })

  it('offers no way onward at the far end', () => {
    withSections()
    render(<CardTabs tabs={TABS} activeId="personal-information" ariaLabel="sections" />)

    stripIs({ scrollLeft: 600, clientWidth: 300, scrollWidth: 900 })

    expect(later()).toBeNull()
    expect(earlier()).toBeInTheDocument()
  })

  it('moves the strip along when an arrow is pressed', async () => {
    withSections()
    render(<CardTabs tabs={TABS} activeId="personal-information" ariaLabel="sections" />)

    const strip = stripIs({ scrollLeft: 0, clientWidth: 300, scrollWidth: 900 })
    const scrollBy = vi.fn()
    Object.defineProperty(strip, 'scrollBy', { value: scrollBy, configurable: true })

    await userEvent.click(later() as HTMLElement)

    expect(scrollBy).toHaveBeenCalledWith({ left: 200, behavior: 'smooth' })
  })

  /*
   * Scrolling the card moves the underline. If the tab it moves to is off the
   * end of the strip, the bar reads as though it has stopped following along.
   */
  it('brings the newly active tab back into view', () => {
    withSections()
    const { rerender } = render(
      <CardTabs tabs={TABS} activeId="personal-information" ariaLabel="sections" />
    )

    const strip = stripIs({ scrollLeft: 0, clientWidth: 300, scrollWidth: 900 })
    const work = screen.getByRole('tab', { name: 'Work Information' })
    Object.defineProperty(work, 'offsetLeft', { value: 500, configurable: true })
    Object.defineProperty(work, 'offsetWidth', { value: 200, configurable: true })

    rerender(<CardTabs tabs={TABS} activeId="work-information" ariaLabel="sections" />)

    // 500 + 200 runs past 0 + 300, so the strip moves up to it and leaves a margin.
    expect(strip.scrollLeft).toBe(700 - 300 + 24)
  })

  it('leaves the strip alone when the active tab is already on screen', () => {
    withSections()
    const { rerender } = render(
      <CardTabs tabs={TABS} activeId="personal-information" ariaLabel="sections" />
    )

    const strip = stripIs({ scrollLeft: 0, clientWidth: 800, scrollWidth: 900 })
    const work = screen.getByRole('tab', { name: 'Work Information' })
    Object.defineProperty(work, 'offsetLeft', { value: 200, configurable: true })
    Object.defineProperty(work, 'offsetWidth', { value: 150, configurable: true })

    rerender(<CardTabs tabs={TABS} activeId="work-information" ariaLabel="sections" />)

    expect(strip.scrollLeft).toBe(0)
  })
})
