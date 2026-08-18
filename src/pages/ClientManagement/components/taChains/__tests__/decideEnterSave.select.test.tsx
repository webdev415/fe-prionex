/**
 * KAN-974 — the dropdown case, against the real Radix Select.
 *
 * The unit tests next door check the rule against a hand-built DOM. This one
 * renders the component operators actually use and drives it with the keyboard.
 *
 * What actually stops a dropdown selection from also submitting is
 * `isPressForPanel`: Radix portals the Select content to document.body, which
 * is outside both the panel and its dialog, so the press is rejected before the
 * rules are consulted. An earlier version credited a `defaultPrevented` check
 * for this, which was wrong — the listener is a native one on `document`, and
 * Radix's SelectItem preventDefaults only for Space. If a future Radix release
 * stops portalling, this test is what notices.
 */
import { useEffect, useRef, useState } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { decideEnterSave, isPressForPanel } from '../decideEnterSave'

// Radix Select drives a real popup: it scrolls the active option into view and
// captures the pointer. jsdom implements neither, and without them the content
// throws on mount — which has nothing to do with the behaviour under test.
const originalPrototypeMethods = {
  scrollIntoView: Element.prototype.scrollIntoView,
  hasPointerCapture: Element.prototype.hasPointerCapture,
  releasePointerCapture: Element.prototype.releasePointerCapture,
  setPointerCapture: Element.prototype.setPointerCapture,
  getClientRects: Element.prototype.getClientRects,
}

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.setPointerCapture = vi.fn()
  // jsdom lays nothing out, so every element reports as off screen. The panel
  // scoping check reads that, so give it a box to see.
  Element.prototype.getClientRects = vi.fn(
    () => [{ width: 100, height: 100 }] as unknown as DOMRectList
  )
})

// Restored so these stubs cannot leak if file isolation is ever turned off.
afterAll(() => {
  Object.assign(Element.prototype, originalPrototypeMethods)
})

function Harness({ onSave }: { onSave: () => void }) {
  const [value, setValue] = useState('')
  const panelRef = useRef<HTMLDivElement | null>(null)

  // Mirrors ChainExecutor: a document listener scoped to this panel, not a
  // handler on the panel itself — and the panel sits inside a role="dialog"
  // wrapper, because that wrapper is what Radix focuses when a modal opens and
  // it is the boundary `isPressForPanel` scopes to. A harness without it would
  // pass while missing the one press the real modal actually delivers.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isPressForPanel(event.target, panelRef.current)) return
      if (!decideEnterSave({ event, canSave: true })) return
      event.preventDefault()
      onSave()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onSave])

  return (
    <div role="dialog" tabIndex={-1} data-testid="dialog">
      <div ref={panelRef}>
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger>
            <SelectValue placeholder="Pick one" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="promise">Promise to pay</SelectItem>
            <SelectItem value="refusal">Refusal</SelectItem>
          </SelectContent>
        </Select>
        <input aria-label="amount" />
        {/* The real Save button, so Enter-while-it-has-focus is exercised. */}
        <button type="button" onClick={onSave}>
          Save interaction
        </button>
      </div>
    </div>
  )
}

describe('Enter inside a real Radix Select', () => {
  it('opens the dropdown without saving, then picks a value without saving', async () => {
    const onSave = vi.fn()
    const user = userEvent.setup()
    render(<Harness onSave={onSave} />)

    // Enter on the closed trigger opens it. Radix preventDefaults here, but the
    // assertion is about the outcome, not the mechanism.
    await user.tab()
    expect(screen.getByRole('combobox')).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('listbox')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()

    // Enter on an option selects it — and must not also submit. This is the
    // press Radix does NOT preventDefault.
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{Enter}')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('saves exactly once when Enter is pressed with the Save button focused', async () => {
    // Enter on a focused button is the keydown's default action, so the button
    // would click AND this handler would fire — two saves, two interaction rows
    // on a client's permanent history. The handler's preventDefault is what
    // collapses them into one, which makes this a test of that call, not of
    // React.
    const onSave = vi.fn()
    const user = userEvent.setup()
    render(<Harness onSave={onSave} />)

    await user.click(screen.getByRole('button', { name: 'Save interaction' }))
    onSave.mockClear() // the click itself is not what is under test
    expect(screen.getByRole('button', { name: 'Save interaction' })).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('saves with focus on the dialog wrapper — the reported bug', async () => {
    // Radix focuses the dialog's content wrapper when the modal opens, and the
    // wrapper contains the panel rather than sitting inside it. A handler
    // mounted on the panel never sees that press, which is what "Enter does
    // nothing" looked like in the browser.
    const onSave = vi.fn()
    const user = userEvent.setup()
    render(<Harness onSave={onSave} />)

    screen.getByTestId('dialog').focus()
    expect(screen.getByTestId('dialog')).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('does not save from a press aimed outside the dialog', async () => {
    // <body> contains every mounted executor, including the dialer's inline
    // panel. Accepting it would submit an interaction from a stray keypress.
    const onSave = vi.fn()
    const user = userEvent.setup()
    render(<Harness onSave={onSave} />)

    expect(document.activeElement).toBe(document.body)
    await user.keyboard('{Enter}')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('still saves from an ordinary input beside the dropdown', async () => {
    const onSave = vi.fn()
    const user = userEvent.setup()
    render(<Harness onSave={onSave} />)

    await user.click(screen.getByLabelText('amount'))
    await user.keyboard('{Enter}')
    expect(onSave).toHaveBeenCalledTimes(1)
  })
})
