/**
 * KAN-KB-54, phase 5: the portals.
 *
 * 🔴 WHY THIS IS THE ONE PLACE THE MARKUP BREAKS SILENTLY. Everywhere else an
 * attribute on a card covers everything inside it, because the tracker's
 * `Sanitizer.handleNode` inherits down the DOM. A portal has no such parent:
 * Radix and `sonner` render into `document.body`, so a dialog opened from
 * inside a marked container is a SIBLING of it, not a child. The trigger can be
 * covered, the markup can look right in the diff, and the content still reaches
 * the recording in the clear.
 *
 * Which is also why phase 5 is the phase whose PRs the plan says must carry a
 * test: nothing else here fails loudly.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createPortal } from 'react-dom'

import { Pii, piiProps } from '../pii'
import { expectObscured, expectNotObscured } from '@/test/piiHelpers'

const NAME = 'Іваненко Іван Іванович'

describe('inheritance does not cross a portal', () => {
  it('leaves portal content readable however well the trigger is marked', () => {
    // The negative half, and the more important one. If this ever fails, the
    // tracker has changed how it walks the DOM and the per-portal markup can be
    // simplified — but until then, marking a trigger buys exactly nothing.
    render(
      <div {...piiProps}>
        <button type="button">Open</button>
        {createPortal(<span>{NAME}</span>, document.body)}
      </div>
    )
    expectNotObscured(screen.getByText(NAME))
  })

  it('covers content that carries the attribute itself', () => {
    render(<div>{createPortal(<Pii as="div">{NAME}</Pii>, document.body)}</div>)
    expectObscured(screen.getByText(NAME))
  })

  it('covers a subtree inside marked portal content', () => {
    // Inheritance works normally ONCE the attribute is inside the portal — the
    // rule is about where the attribute goes, not about portals being exempt.
    render(
      <div>
        {createPortal(
          <div {...piiProps}>
            <section>
              <strong>{NAME}</strong>
            </section>
          </div>,
          document.body
        )}
      </div>
    )
    expectObscured(screen.getByText(NAME))
  })
})

describe('a toast is marked, not the Toaster', () => {
  it('masks the name and leaves the message around it readable', () => {
    // `<Toaster />` renders every toast in the application. Marking it would
    // take the system error messages with it — the ones a reviewer needs to be
    // able to read back off a recording to understand what the operator saw.
    render(
      createPortal(
        <span>
          Теги оновлено для <Pii>{NAME}</Pii>
        </span>,
        document.body
      )
    )
    expectObscured(screen.getByText(NAME))
    expectNotObscured(screen.getByText(/Теги оновлено для/))
  })
})

describe('react-datepicker (step 5.4)', () => {
  it('still renders inline, with no portal to mark', async () => {
    // The step is a CHECK, not a change: `withPortal` and `portalId` are not
    // used anywhere in `src/`, so the calendar renders in place and ordinary
    // inheritance covers it. This test is what makes that a fact with an expiry
    // date rather than a sentence in a document — the day somebody adds
    // `withPortal`, it fails and phase 5 gets revisited.
    const modules = import.meta.glob<string>('/src/**/*.tsx', {
      query: '?raw',
      import: 'default',
      eager: true,
    })
    const offenders: string[] = []
    for (const [path, text] of Object.entries(modules)) {
      if (path.includes('__tests__') || /\.(test|spec)\.tsx$/.test(path)) continue
      if (/\bwithPortal\b|\bportalId\b/.test(text)) offenders.push(path)
    }
    expect(
      offenders,
      'A datepicker moved into a portal — inheritance no longer reaches its ' +
        'contents, so it needs marking from the inside like every other portal.'
    ).toEqual([])
  })
})
