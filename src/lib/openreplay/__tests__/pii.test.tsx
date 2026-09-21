import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  OPENREPLAY_OBSCURED_ATTR,
  OPENREPLAY_HIDDEN_ATTR,
  OPENREPLAY_LABEL_ATTR,
  Pii,
  piiProps,
  piiHiddenProps,
} from '../pii'
import { expectObscured, expectNotObscured } from '@/test/piiHelpers'

describe('OpenReplay PII primitives', () => {
  it('spells the attributes exactly as the tracker reads them', () => {
    // Pinned as literals on purpose. The tracker matches these names character
    // for character; a rename anywhere else is a silent leak, and this is the
    // only place that would notice.
    expect(OPENREPLAY_OBSCURED_ATTR).toBe('data-openreplay-obscured')
    expect(OPENREPLAY_HIDDEN_ATTR).toBe('data-openreplay-hidden')
    expect(OPENREPLAY_LABEL_ATTR).toBe('data-openreplay-label')
  })

  it('renders piiProps as a present attribute, not as a value', () => {
    // The tracker checks `hasAttribute`, so the empty string is enough — but it
    // has to actually reach the DOM, which `{...{ 'data-x': undefined }}` would
    // not do.
    render(
      <div {...piiProps} data-testid="block">
        Иванов Иван Иванович
      </div>
    )
    const block = screen.getByTestId('block')
    expect(block.hasAttribute(OPENREPLAY_OBSCURED_ATTR)).toBe(true)
    expect(block.getAttribute(OPENREPLAY_OBSCURED_ATTR)).toBe('')
  })

  it('renders piiHiddenProps the same way', () => {
    render(<div {...piiHiddenProps} data-testid="scan" />)
    expect(screen.getByTestId('scan').hasAttribute(OPENREPLAY_HIDDEN_ATTR)).toBe(true)
  })

  it('defaults <Pii> to a span', () => {
    render(<Pii>Иванов</Pii>)
    const node = screen.getByText('Иванов')
    expect(node.tagName).toBe('SPAN')
    expect(node.hasAttribute(OPENREPLAY_OBSCURED_ATTR)).toBe(true)
  })

  it('renders <Pii as> and keeps className through', () => {
    render(
      <Pii as="div" className="text-sm">
        ул. Ленина, 1
      </Pii>
    )
    const node = screen.getByText('ул. Ленина, 1')
    expect(node.tagName).toBe('DIV')
    expect(node.className).toBe('text-sm')
    expectObscured(node)
  })

  it('covers the whole subtree, which is the point of the attribute', () => {
    // Inheritance is what makes container markup work: one attribute on the card
    // closes every field inside it. A test that only ever checked the node
    // itself would pass on markup that leaks everything below the first level.
    render(
      <Pii as="div">
        <section>
          <p>
            <strong>Иванов Иван</strong>
          </p>
        </section>
      </Pii>
    )
    expectObscured(screen.getByText('Иванов Иван'))
  })

  it('leaves siblings outside the marked block readable', () => {
    render(
      <div>
        <h1>Карточка клиента</h1>
        <Pii>Иванов Иван</Pii>
      </div>
    )
    expectObscured(screen.getByText('Иванов Иван'))
    expectNotObscured(screen.getByText('Карточка клиента'))
  })
})
