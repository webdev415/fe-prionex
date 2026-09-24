import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { PhoneActionsDropdown } from '../PhoneActionsDropdown'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, fallback?: string) => fallback ?? key,
      i18n: { language: 'en' },
    }),
  }
})

// Timezone is pinned rather than left to the runner: the panel renders the
// instant in the operator's PROFILE zone, so without this the expected string
// would depend on the machine the suite happens to run on.
const authState = { user: { timezone: 'Europe/Kyiv' } }
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector(authState),
}))

const PHONE = '380978170286'

let anchor: HTMLElement | null = null

function makeAnchor(): HTMLElement {
  const el = document.createElement('span')
  el.textContent = PHONE
  document.body.appendChild(el)
  anchor = el
  return el
}

function renderDropdown(props: Partial<React.ComponentProps<typeof PhoneActionsDropdown>> = {}) {
  const handlers = {
    onCall: vi.fn(),
    onAddContact: vi.fn(),
    onCopy: vi.fn(),
    onClose: vi.fn(),
  }
  render(
    <PhoneActionsDropdown
      phone={PHONE}
      state="new"
      anchor={props.anchor ?? makeAnchor()}
      lastCallAt={null}
      {...handlers}
      {...props}
    />
  )
  return handlers
}

afterEach(() => {
  anchor?.remove()
  anchor = null
})

describe('the creditor-comment phone dropdown', () => {
  it('shows the number it was opened for', () => {
    // Scoped to the panel: the anchor in the comment carries the same digits,
    // so an unscoped query matches both and says nothing about the panel.
    renderDropdown()
    expect(within(screen.getByRole('dialog')).getByText(PHONE)).toBeInTheDocument()
  })

  it('renders the last call in the operator timezone and UI locale', () => {
    // 14:05 UTC is 16:05 in Kyiv. The UI language here is 'en', which maps to
    // en-US, so the date reads MM/DD -- locale-aware by design, which is why
    // the shared formatter is used instead of a hardcoded DD.MM.YYYY pattern.
    renderDropdown({ lastCallAt: '2026-03-12T14:05:00Z' })
    expect(screen.getByText(/03\/12\/2026, 16:05/)).toBeInTheDocument()
  })

  it('says Never when nobody has ever called the number', () => {
    renderDropdown({ lastCallAt: null })
    expect(screen.getByText(/Never/)).toBeInTheDocument()
  })

  it('shows a placeholder rather than Never while the lookup is in flight', () => {
    // Saying "Never" about a number whose history has not arrived yet would be
    // a claim the panel cannot support.
    renderDropdown({ lastCallAt: null, isLoadingLastCall: true })
    expect(screen.queryByText(/Never/)).not.toBeInTheDocument()
  })

  it('tags a known number as a saved contact', () => {
    renderDropdown({ state: 'known' })
    expect(screen.getByText('Saved contact')).toBeInTheDocument()
    expect(screen.queryByText('Not a contact')).not.toBeInTheDocument()
  })

  it('tags an unknown number as not a contact', () => {
    renderDropdown({ state: 'new' })
    expect(screen.getByText('Not a contact')).toBeInTheDocument()
  })

  it('offers Add contact for a new number only', () => {
    renderDropdown({ state: 'new' })
    expect(screen.getByRole('button', { name: /Add Contact/i })).toBeInTheDocument()
  })

  it('hides Add contact for a number already in contacts', () => {
    renderDropdown({ state: 'known' })
    expect(screen.queryByRole('button', { name: /Add Contact/i })).not.toBeInTheDocument()
  })

  it('always offers Call and Copy, whatever the number is', () => {
    renderDropdown({ state: 'known' })
    expect(screen.getByRole('button', { name: /^Call$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Copy phone/ })).toBeInTheDocument()
  })

  it('reports each action to the caller rather than acting itself', () => {
    // The page keeps the call-in-progress and calling-window guards; this
    // component must not grow a second copy of them.
    const handlers = renderDropdown({ state: 'new' })

    fireEvent.click(screen.getByRole('button', { name: /^Call$/ }))
    expect(handlers.onCall).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: /Add Contact/i }))
    expect(handlers.onAddContact).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: /Copy phone/ }))
    expect(handlers.onCopy).toHaveBeenCalledTimes(1)
  })

  it('closes on a click outside itself', () => {
    const handlers = renderDropdown()
    fireEvent.mouseDown(document.body)
    expect(handlers.onClose).toHaveBeenCalled()
  })

  it('stays open when the click lands inside the panel', () => {
    const handlers = renderDropdown()
    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(handlers.onClose).not.toHaveBeenCalled()
  })

  it('stays open when the click lands on the number itself', () => {
    // The highlighted span toggles the panel; treating it as "outside" would
    // make the caller close and reopen on every click.
    const el = makeAnchor()
    const handlers = renderDropdown({ anchor: el })
    fireEvent.mouseDown(el)
    expect(handlers.onClose).not.toHaveBeenCalled()
  })

  it('closes when the window is resized', () => {
    const handlers = renderDropdown()
    fireEvent(window, new Event('resize'))
    expect(handlers.onClose).toHaveBeenCalled()
  })

  it('closes when a nested container scrolls, not just the window', () => {
    // The comment lives in its own scroll container, whose scroll events never
    // reach a bubbling window listener -- hence the capture-phase listener.
    const scroller = document.createElement('div')
    document.body.appendChild(scroller)
    const handlers = renderDropdown()

    fireEvent.scroll(scroller)

    expect(handlers.onClose).toHaveBeenCalled()
    scroller.remove()
  })

  it('removes its listeners when it unmounts', () => {
    // A leaked resize listener would call onClose on an unmounted panel.
    const handlers = {
      onCall: vi.fn(),
      onAddContact: vi.fn(),
      onCopy: vi.fn(),
      onClose: vi.fn(),
    }
    const { unmount } = render(
      <PhoneActionsDropdown
        phone={PHONE}
        state="new"
        anchor={makeAnchor()}
        lastCallAt={null}
        {...handlers}
      />
    )
    unmount()
    fireEvent(window, new Event('resize'))
    fireEvent.mouseDown(document.body)
    expect(handlers.onClose).not.toHaveBeenCalled()
  })

  it('never puts the number in an aria-label or title', () => {
    // OpenReplay sends title/aria-label/alt verbatim even from obscured nodes,
    // so the phone in either would defeat the masking on the node that shows it.
    renderDropdown()
    const panel = screen.getByRole('dialog')
    for (const el of [panel, ...Array.from(panel.querySelectorAll('*'))]) {
      expect(el.getAttribute('aria-label') ?? '').not.toContain(PHONE)
      expect(el.getAttribute('title') ?? '').not.toContain(PHONE)
    }
  })

  it('marks the number as PII for the session recorder', () => {
    renderDropdown()
    const numberNode = within(screen.getByRole('dialog')).getByText(PHONE)
    const names = Array.from(numberNode.attributes).map((a) => a.name)
    expect(names.some((n) => n !== 'class')).toBe(true)
  })
})
