/**
 * The runtime PII detector (KAN-KB-54, step 2.4).
 *
 * Its whole value is that it names a missed node instead of asserting coverage,
 * so the cases below are mostly about what it must NOT miss: a portal, an
 * attribute on an already-obscured node, a value nested deep in a response body.
 */

import { describe, expect, it, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { createPortal } from 'react-dom'

import { collectPiiValues, findUnobscured } from '../piiAudit.dev'
import { Pii, piiProps } from '../pii'

afterEach(cleanup)

describe('collectPiiValues', () => {
  it('picks PII-shaped keys out of a nested response body', () => {
    const body = {
      results: [
        {
          id: 1,
          full_name: 'Иванов Иван Иванович',
          registration_address: 'г. Киев, ул. Ленина, 1',
          status: 'active',
          contacts: [{ first_name: 'Анна', last_name: 'Петрова' }],
        },
      ],
      count: 1,
    }
    const values = [...collectPiiValues(body)]
    expect(values).toContain('Иванов Иван Иванович')
    expect(values).toContain('г. Киев, ул. Ленина, 1')
    expect(values).toContain('Петрова')
    expect(values).not.toContain('active')
  })

  it('leaves the addresses that are not a person alone', () => {
    // Marking these up is an accessibility regression traded for nothing, and a
    // detector that reports them trains the reader to ignore its output.
    const values = [...collectPiiValues({ ip_address: '192.168.10.10', address_type: 'billing' })]
    expect(values).toHaveLength(0)
  })

  it('drops values too short to search for without noise', () => {
    const values = [...collectPiiValues({ first_name: 'Ян' })]
    expect(values).toHaveLength(0)
  })

  it('survives a cyclic body instead of hanging the console', () => {
    const body: Record<string, unknown> = { full_name: 'Иванов Иван' }
    body.self = body
    expect([...collectPiiValues(body)]).toEqual(['Иванов Иван'])
  })
})

describe('findUnobscured', () => {
  it('reports an unmarked name', () => {
    render(<div>Иванов Иван Иванович</div>)
    const findings = findUnobscured(['Иванов Иван Иванович'])
    expect(findings).toHaveLength(1)
    expect(findings[0].where).toBe('text')
  })

  it('stays quiet when the name is inside a marked container', () => {
    render(
      <Pii as="div">
        <section>
          <span>Иванов Иван Иванович</span>
        </section>
      </Pii>
    )
    expect(findUnobscured(['Иванов Иван Иванович'])).toHaveLength(0)
  })

  it('sees into a portal, where inheritance does not reach', () => {
    // The reason the walk starts at document.body and not at the app root.
    render(
      <div {...piiProps}>{createPortal(<span>Иванов Иван Иванович</span>, document.body)}</div>
    )
    const findings = findUnobscured(['Иванов Иван Иванович'])
    expect(findings).toHaveLength(1)
  })

  it('reports an attribute EVEN INSIDE a marked container', () => {
    // 🔴 The single most counter-intuitive fact about the tracker: outside
    // privateMode it sends attribute values verbatim, from obscured and hidden
    // nodes alike. Markup does not fix this; removing the value does.
    render(
      <Pii as="div">
        <button title="Иванов Иван Иванович">#1024</button>
      </Pii>
    )
    const findings = findUnobscured(['Иванов Иван Иванович'])
    expect(findings).toHaveLength(1)
    expect(findings[0].where).toBe('attribute')
    expect(findings[0].attribute).toBe('title')
  })

  it('returns nothing when there is nothing to look for', () => {
    render(<div>Иванов Иван Иванович</div>)
    expect(findUnobscured([])).toHaveLength(0)
  })
})
