import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, renderHook, act } from '@testing-library/react'
import { useCommentPhoneHighlight } from '../useCommentPhoneHighlight'
import type { PhoneLookupContact } from '@/features/clients/utils/phoneHighlight'

const KNOWN = '380685161436'
const UNKNOWN = '380501234567'

const phoneContact = (contactValue: string): PhoneLookupContact => ({ contactValue })

let container: HTMLElement | null = null

/** A notes list shaped like the real one: one or more comment bodies, each
 *  carrying creditor HTML that the card injects verbatim. */
function mountComment(...bodies: string[]): HTMLElement {
  const root = document.createElement('div')
  for (const html of bodies) {
    const body = document.createElement('div')
    body.setAttribute('data-cc', 'comment-body')
    body.innerHTML = html
    root.appendChild(body)
  }
  document.body.appendChild(root)
  container = root
  return root
}

function highlight(root: HTMLElement, contacts: PhoneLookupContact[] = [], signature = 'a') {
  return renderHook(() => useCommentPhoneHighlight({ container: root, contacts, signature }))
}

const spans = (root: HTMLElement) => Array.from(root.querySelectorAll('[data-phone]'))

afterEach(() => {
  container?.remove()
  container = null
})

describe('useCommentPhoneHighlight', () => {
  it('wraps every number in the comment', () => {
    const root = mountComment(`<p>тел. ${UNKNOWN} і ще ${KNOWN}</p>`)
    highlight(root)
    expect(spans(root).map((s) => s.getAttribute('data-phone'))).toEqual([UNKNOWN, KNOWN])
  })

  it('marks a contact number known and an unseen one new', () => {
    const root = mountComment(`<p>${KNOWN} / ${UNKNOWN}</p>`)
    highlight(root, [phoneContact(`+${KNOWN}`)])
    const states = spans(root).map((s) => s.getAttribute('data-phone-state'))
    expect(states).toEqual(['known', 'new'])
  })

  it('leaves the surrounding text intact', () => {
    // The walk rewrites text nodes; losing the words around a number would be
    // a silent corruption of the creditor's comment.
    const root = mountComment(`<p>Дружина ${UNKNOWN}, не відповідає</p>`)
    highlight(root)
    expect(root.textContent).toBe(`Дружина ${UNKNOWN}, не відповідає`)
  })

  it('never rewrites a number sitting inside markup', () => {
    // A string replace over note.content would corrupt this href; a text-node
    // walk cannot see it at all.
    const root = mountComment(`<p><a href="/x/${UNKNOWN}">посилання</a> ${KNOWN}</p>`)
    highlight(root)
    expect(root.querySelector('a')?.getAttribute('href')).toBe(`/x/${UNKNOWN}`)
    expect(spans(root).map((s) => s.getAttribute('data-phone'))).toEqual([KNOWN])
  })

  it('walks every comment body, not just the first', () => {
    // "Show more" reveals cards that were never walked.
    const root = mountComment(`<p>${UNKNOWN}</p>`, `<p>${KNOWN}</p>`)
    highlight(root)
    expect(spans(root)).toHaveLength(2)
  })

  it('does not double-wrap when the walk runs again', () => {
    // Re-running on expand must be idempotent: React keeps the injected HTML
    // (and our spans) unless note.content itself changes.
    const root = mountComment(`<p>${UNKNOWN}</p>`)
    const { rerender } = renderHook(
      ({ signature }) => useCommentPhoneHighlight({ container: root, contacts: [], signature }),
      { initialProps: { signature: 'a' } }
    )
    rerender({ signature: 'b' })
    expect(spans(root)).toHaveLength(1)
    expect(root.querySelectorAll('[data-phone] [data-phone]')).toHaveLength(0)
  })

  it('turns a number green once it becomes a contact, without rebuilding the comment', () => {
    // Review M4. The operator adds the number from the panel, the profile
    // refetches, and this effect re-runs with new contacts — but the walker
    // rejects text already wrapped, so the span kept its original state and the
    // number stayed orange until a reload. The note card is memoised precisely
    // so React does NOT rebuild this subtree, which is what made it stick.
    const root = mountComment(`<p>${KNOWN}</p>`)
    const { rerender } = renderHook(
      ({ contacts }) => useCommentPhoneHighlight({ container: root, contacts, signature: 'a' }),
      { initialProps: { contacts: [] as PhoneLookupContact[] } }
    )
    expect(spans(root)[0].getAttribute('data-phone-state')).toBe('new')

    const span = spans(root)[0]
    rerender({ contacts: [phoneContact(KNOWN)] })

    expect(spans(root)[0].getAttribute('data-phone-state')).toBe('known')
    // The same element, not a replacement: an open panel is anchored to it.
    expect(spans(root)[0]).toBe(span)
  })

  it('drops back to new when the contact is removed', () => {
    const root = mountComment(`<p>${KNOWN}</p>`)
    const { rerender } = renderHook(
      ({ contacts }) => useCommentPhoneHighlight({ container: root, contacts, signature: 'a' }),
      { initialProps: { contacts: [phoneContact(KNOWN)] as PhoneLookupContact[] } }
    )
    expect(spans(root)[0].getAttribute('data-phone-state')).toBe('known')

    rerender({ contacts: [] })

    expect(spans(root)[0].getAttribute('data-phone-state')).toBe('new')
  })

  it('reports the number the operator clicked', () => {
    const root = mountComment(`<p>${UNKNOWN}</p>`)
    const { result } = highlight(root)

    act(() => {
      fireEvent.click(spans(root)[0])
    })

    expect(result.current.selected?.phone).toBe(UNKNOWN)
    expect(result.current.selected?.state).toBe('new')
    expect(result.current.selected?.anchor).toBe(spans(root)[0])
  })

  it('toggles closed when the same number is clicked twice', () => {
    const root = mountComment(`<p>${UNKNOWN}</p>`)
    const { result } = highlight(root)

    act(() => fireEvent.click(spans(root)[0]))
    act(() => fireEvent.click(spans(root)[0]))

    expect(result.current.selected).toBeNull()
  })

  it('switches straight to another number without closing first', () => {
    const root = mountComment(`<p>${UNKNOWN} ${KNOWN}</p>`)
    const { result } = highlight(root)

    act(() => fireEvent.click(spans(root)[0]))
    act(() => fireEvent.click(spans(root)[1]))

    expect(result.current.selected?.phone).toBe(KNOWN)
  })

  it('ignores clicks on ordinary comment text', () => {
    const root = mountComment(`<p id="plain">без номера</p>`)
    const { result } = highlight(root)

    act(() => {
      fireEvent.click(root.querySelector('#plain')!)
    })

    expect(result.current.selected).toBeNull()
  })

  it('opens on Enter so the number is reachable without a mouse', () => {
    const root = mountComment(`<p>${UNKNOWN}</p>`)
    const { result } = highlight(root)

    act(() => {
      fireEvent.keyDown(spans(root)[0], { key: 'Enter' })
    })

    expect(result.current.selected?.phone).toBe(UNKNOWN)
  })

  it('clears the selection on request', () => {
    const root = mountComment(`<p>${UNKNOWN}</p>`)
    const { result } = highlight(root)

    act(() => fireEvent.click(spans(root)[0]))
    act(() => result.current.clear())

    expect(result.current.selected).toBeNull()
  })

  it('never puts the number in a title or aria-label', () => {
    // Same leak vector the dropdown guards: the tracker sends both verbatim
    // even from obscured nodes.
    const root = mountComment(`<p>${UNKNOWN}</p>`)
    highlight(root)
    const span = spans(root)[0]
    expect(span.getAttribute('aria-label')).toBeNull()
    expect(span.getAttribute('title')).toBeNull()
  })

  it('does nothing at all before the container exists', () => {
    const { result } = renderHook(() =>
      useCommentPhoneHighlight({ container: null, contacts: [], signature: 'a' })
    )
    expect(result.current.selected).toBeNull()
  })

  it('stops listening once unmounted', () => {
    // Asserted on the listeners themselves rather than on `selected`, because
    // after unmount renderHook FREEZES result.current: a leaked listener would
    // still fire and still call setSelected, yet the observed value would not
    // move and the test would pass over the leak. Removing the cleanup is a
    // real defect, so the assertion has to be able to see it.
    const root = mountComment(`<p>${UNKNOWN}</p>`)
    const removeSpy = vi.spyOn(root, 'removeEventListener')
    const { unmount } = highlight(root)

    unmount()

    const removed = removeSpy.mock.calls.map(([type]) => type)
    expect(removed).toContain('click')
    expect(removed).toContain('keydown')
    removeSpy.mockRestore()
  })

  it('leaves a spaced local number alone', () => {
    const root = mountComment(`<p>067 246 25 11</p>`)
    highlight(root)
    expect(spans(root)).toHaveLength(0)
  })

  it('renders inside a real React tree without disturbing it', () => {
    // The comment is React-owned via dangerouslySetInnerHTML; the walk mutates
    // that subtree, so prove React does not blow up alongside it.
    function Harness() {
      return (
        <div>
          <div data-cc="comment-body" dangerouslySetInnerHTML={{ __html: `<p>${UNKNOWN}</p>` }} />
        </div>
      )
    }
    const { container: rendered } = render(<Harness />)
    const root = rendered.firstElementChild as HTMLElement
    highlight(root)
    expect(spans(root).map((s) => s.getAttribute('data-phone'))).toEqual([UNKNOWN])
  })
})
