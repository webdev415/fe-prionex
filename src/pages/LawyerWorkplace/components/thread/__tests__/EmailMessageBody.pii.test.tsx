/**
 * KAN-KB-54, review finding: rendered client-facing text.
 *
 * A letter's body has no identifier the static audit could match — it is
 * `safeHtml`, produced by a sanitizer from a string at runtime and injected
 * through `dangerouslySetInnerHTML`. So the only assertion that means anything
 * here is on the DOM the HTML produced: every text node it contains must sit
 * under the attribute, in both the HTML and the plain-text branch.
 */

import { describe, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { EmailMessageBody } from '../EmailMessageBody'
import { expectObscured } from '@/test/piiHelpers'

const NAME = 'Іваненко Іван Іванович'

describe('EmailMessageBody PII markup', () => {
  it('covers every text node of an HTML letter', () => {
    render(
      <EmailMessageBody
        bodyFormat="html"
        body={`<p>Шановний <b>${NAME}</b>,</p><p>повідомляємо про заборгованість.</p>`}
      />
    )
    // Inheritance runs down from the sink into the HTML it produced.
    expectObscured(screen.getByText(NAME))
    expectObscured(screen.getByText(/повідомляємо про заборгованість/))
  })

  it('covers the plain-text branch too', () => {
    render(<EmailMessageBody bodyFormat="text" body={`Шановний ${NAME}, повідомляємо…`} />)
    expectObscured(screen.getByText(new RegExp(NAME)))
  })
})
