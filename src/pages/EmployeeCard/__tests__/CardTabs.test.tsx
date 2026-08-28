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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CardTabs } from '../components/CardTabs'

const TABS = [
  { id: 'personal-information', label: 'Personal Information' },
  { id: 'work-information', label: 'Work Information' },
]

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
