/**
 * `PiiTooltip` — the replacement for a hover-reveal `title` (KAN-KB-54, phase 4).
 *
 * 🔴 The fact this whole component exists for: OUTSIDE `privateMode` THE TRACKER
 * DOES NOT MASK ATTRIBUTES AT ALL. `sendNodeAttribute` sends `title`,
 * `aria-label` and `alt` verbatim, from an obscured node and from a hidden one
 * alike — only `alt` and `placeholder` are wiped, and only inside the
 * `privateMode` branch, which is off here. So `<button title={clientFullName}>`
 * leaks the name no matter what markup surrounds it.
 *
 * Radix renders tooltip content as a text node in a portal, and text nodes are
 * exactly what the markup masks. The tests below assert both halves: the name
 * is gone from the attributes, and it is covered where it now lives.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { PiiTooltip } from '../PiiTooltip'
import { expectObscured } from '@/test/piiHelpers'

const NAME = 'Іваненко Іван Іванович'

describe('PiiTooltip', () => {
  it('puts nothing in an attribute', () => {
    render(
      <PiiTooltip label={NAME}>
        <button type="button">#1024</button>
      </PiiTooltip>
    )
    const trigger = screen.getByRole('button', { name: /1024/ })
    // Every attribute the tracker sends as-is, checked by name rather than by
    // `title` alone: the leak this replaces was in `title`, but `aria-label` is
    // just as unmasked and is the obvious place for someone to move it to.
    for (const attr of ['title', 'alt', 'placeholder']) {
      expect(trigger.getAttribute(attr)).toBeNull()
    }
    expect(trigger.getAttribute('aria-label') ?? '').not.toContain(NAME)
    expect(document.body.innerHTML).not.toContain(`title="${NAME}"`)
  })

  it('keeps the hover working, and masks what it reveals', async () => {
    // The feature is not a duplicated label — the operator hovers precisely to
    // find out WHO `#1024` is. A fix that removed the reveal would have closed
    // the leak by deleting the feature.
    const user = userEvent.setup()
    render(
      <PiiTooltip label={NAME}>
        <button type="button">#1024</button>
      </PiiTooltip>
    )
    await user.hover(screen.getByRole('button', { name: /1024/ }))
    const revealed = await screen.findAllByText(NAME)
    expect(revealed.length).toBeGreaterThan(0)
    for (const node of revealed) expectObscured(node)
  })

  it('renders the child untouched when there is no name', () => {
    // A row whose client has no name must not get an empty black box on hover.
    render(
      <PiiTooltip label={null}>
        <button type="button">#1024</button>
      </PiiTooltip>
    )
    const trigger = screen.getByRole('button', { name: /1024/ })
    expect(trigger.getAttribute('data-state')).toBeNull()
  })
})
