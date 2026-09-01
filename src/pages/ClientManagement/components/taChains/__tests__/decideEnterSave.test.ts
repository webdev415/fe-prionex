import { describe, expect, it } from 'vitest'
import {
  decideEnterSave,
  isNotesField,
  isPressForPanel,
  isSelfActivating,
  NOTES_FIELD_ATTR,
  resolveEnterSaveMode,
} from '../decideEnterSave'
import type { EnterSaveEvent } from '../decideEnterSave'

function event(overrides: Partial<EnterSaveEvent> = {}): EnterSaveEvent {
  return {
    key: 'Enter',
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    defaultPrevented: false,
    target: null,
    ...overrides,
  }
}

describe('decideEnterSave', () => {
  it('saves on a plain Enter when the save is available', () => {
    expect(decideEnterSave({ event: event(), canSave: true })).toBe(true)
  })

  it('ignores every key but Enter', () => {
    for (const key of ['a', ' ', 'Escape', 'Tab', 'NumpadEnter', 'ArrowDown']) {
      expect(decideEnterSave({ event: event({ key }), canSave: true })).toBe(false)
    }
  })

  it.each([['ctrlKey'], ['altKey'], ['shiftKey'], ['metaKey']] as const)(
    'ignores Enter held with %s',
    (modifier) => {
      expect(decideEnterSave({ event: event({ [modifier]: true }), canSave: true })).toBe(false)
    }
  )

  it('does not save when the save is unavailable', () => {
    // Wrong step, a mutation in flight, a chain finalising — the component
    // collapses all of those into canSave, and Enter must not outrun the button.
    expect(decideEnterSave({ event: event(), canSave: false })).toBe(false)
  })

  it('does not save a press another handler already consumed', () => {
    // An open dropdown choosing its option must not also submit the form.
    expect(decideEnterSave({ event: event({ defaultPrevented: true }), canSave: true })).toBe(false)
  })
})

describe('isPressForPanel', () => {
  function panelInDom(): HTMLElement {
    const panel = document.createElement('div')
    // Tag selectors, not ids: jsdom resolves an id selector against the whole
    // document first, so a duplicate id left by an earlier test makes a scoped
    // querySelector return null instead of the element inside this panel.
    panel.innerHTML = '<input />'
    document.body.appendChild(panel)
    // jsdom gives every element a null offsetParent and no client rects, so the
    // on-screen check is stubbed to the visible case; the hidden case below
    // overrides it back.
    Object.defineProperty(panel, 'offsetParent', { value: document.body, configurable: true })
    return panel
  }

  function panelInDialog(): { dialog: HTMLElement; panel: HTMLElement } {
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    dialog.tabIndex = -1
    document.body.appendChild(dialog)
    const panel = document.createElement('div')
    panel.innerHTML = '<input />'
    dialog.appendChild(panel)
    Object.defineProperty(panel, 'offsetParent', { value: document.body, configurable: true })
    return { dialog, panel }
  }

  it('accepts the dialog wrapper, which is what Radix focuses on open', () => {
    // The state every operator is in the moment the modal appears, before
    // touching anything — and the press a panel-mounted handler never saw.
    const { dialog, panel } = panelInDialog()
    expect(isPressForPanel(dialog, panel)).toBe(true)
  })

  it('accepts a press from inside the panel', () => {
    const panel = panelInDom()
    expect(isPressForPanel(panel.querySelector('input'), panel)).toBe(true)
  })

  it('rejects <body> even when the panel is inside a dialog', () => {
    // <body> contains every mounted executor, so accepting it would let one
    // Enter save in all of them at once.
    const { panel } = panelInDialog()
    expect(isPressForPanel(document.body, panel)).toBe(false)
    expect(isPressForPanel(document.documentElement, panel)).toBe(false)
    expect(isPressForPanel(null, panel)).toBe(false)
  })

  it('accepts only its own descendants when there is no dialog', () => {
    // The dialer renders this executor inline, permanently visible during a
    // call. A stray Enter aimed at the page must not submit against it.
    const panel = panelInDom()
    expect(isPressForPanel(panel.querySelector('input'), panel)).toBe(true)
    expect(isPressForPanel(document.body, panel)).toBe(false)
  })

  it('does not answer for a press aimed at another executor', () => {
    const a = panelInDialog()
    const b = panelInDialog()
    expect(isPressForPanel(b.dialog, a.panel)).toBe(false)
    expect(isPressForPanel(b.panel.querySelector('input'), a.panel)).toBe(false)
  })

  it('rejects a press from elsewhere on the page', () => {
    const panel = panelInDom()
    const outside = document.createElement('input')
    document.body.appendChild(outside)
    expect(isPressForPanel(outside, panel)).toBe(false)
  })

  it('rejects everything when the panel is off screen', () => {
    // A second executor can be mounted but collapsed (the minimised bubble);
    // an unscoped <body> press must not save in it too.
    const panel = panelInDom()
    Object.defineProperty(panel, 'offsetParent', { value: null, configurable: true })
    panel.getClientRects = () => [] as unknown as DOMRectList
    expect(isPressForPanel(document.body, panel)).toBe(false)
  })

  it('rejects everything without a panel', () => {
    expect(isPressForPanel(document.body, null)).toBe(false)
  })
})

describe('isSelfActivating', () => {
  it('leaves buttons and links to their own Enter behaviour', () => {
    const host = document.createElement('div')
    host.innerHTML = `<button>Minimize</button><a href="#x">link</a><input />`
    document.body.appendChild(host)

    // Enter on a focused button clicks it. Saving as well would run two actions
    // from one press — Minimize would minimise AND save.
    expect(isSelfActivating(host.querySelector('button'))).toBe(true)
    expect(isSelfActivating(host.querySelector('a'))).toBe(true)
    expect(isSelfActivating(host.querySelector('input'))).toBe(false)

    expect(
      decideEnterSave({ event: event({ target: host.querySelector('button') }), canSave: true })
    ).toBe(false)
  })
})

describe('resolveEnterSaveMode', () => {
  it('picks the wizard for a started chain even when the chain qualifies as instant', () => {
    // The regression this exists for: the panel renders the wizard whenever an
    // instance is active, so branching on isInstantMode first would fire the
    // instant save into a running instance. A hotkey launch always lands here —
    // it starts a template, and most quick picks have no delays or branches.
    expect(
      resolveEnterSaveMode({ hasChain: true, hasActiveInstance: true, isInstantMode: true })
    ).toBe('wizard')
  })

  it('picks the wizard for a started chain that needs one', () => {
    expect(
      resolveEnterSaveMode({ hasChain: true, hasActiveInstance: false, isInstantMode: true })
    ).toBe('instant')
    expect(
      resolveEnterSaveMode({ hasChain: true, hasActiveInstance: true, isInstantMode: false })
    ).toBe('wizard')
  })

  it('has no save to reach without a chain', () => {
    expect(
      resolveEnterSaveMode({ hasChain: false, hasActiveInstance: false, isInstantMode: true })
    ).toBeNull()
  })

  it('has no save to reach on the preview of an unstarted complex chain', () => {
    // Delays or branches and not yet started — the panel shows Start, not Save.
    expect(
      resolveEnterSaveMode({ hasChain: true, hasActiveInstance: false, isInstantMode: false })
    ).toBeNull()
  })
})

describe('notes field', () => {
  function withDom(html: string): Element {
    const host = document.createElement('div')
    host.innerHTML = html
    document.body.appendChild(host)
    return host
  }

  it('does not save from inside the notes field', () => {
    const host = withDom(`<textarea ${NOTES_FIELD_ATTR}></textarea>`)
    const notes = host.querySelector('textarea')!

    expect(isNotesField(notes)).toBe(true)
    expect(decideEnterSave({ event: event({ target: notes }), canSave: true })).toBe(false)
  })

  it('saves from a free-text Target Action field, which is not the notes field', () => {
    // The exception is the notes field specifically, not "any textarea" — a TA
    // can itself be free text, and Enter there saves per the ticket.
    const host = withDom(`<textarea data-ta-field></textarea>`)
    const taField = host.querySelector('textarea')!

    expect(isNotesField(taField)).toBe(false)
    expect(decideEnterSave({ event: event({ target: taField }), canSave: true })).toBe(true)
  })

  it('saves from the other inputs sharing the final step', () => {
    // Amount and manual-entry date sit alongside notes; only notes is excluded.
    const host = withDom(`<input type="text" /><input type="date" />`)
    for (const input of Array.from(host.querySelectorAll('input'))) {
      expect(decideEnterSave({ event: event({ target: input }), canSave: true })).toBe(true)
    }
  })

  it('treats an element nested inside the notes field as the notes field', () => {
    const host = withDom(`<div ${NOTES_FIELD_ATTR}><span></span></div>`)
    expect(isNotesField(host.querySelector('span'))).toBe(true)
  })

  it('saves when focus is on the page rather than any field', () => {
    expect(decideEnterSave({ event: event({ target: null }), canSave: true })).toBe(true)
  })

  it('treats a non-element target as not the notes field', () => {
    expect(isNotesField(document)).toBe(false)
  })
})
