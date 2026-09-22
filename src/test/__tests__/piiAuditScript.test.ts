/**
 * Rules of `scripts/pii-audit.mjs` (KAN-KB-54, step 2.1).
 *
 * The script becomes a CI gate in phase 7, which is the reason for this file:
 * from then on its output decides whether a PR can be merged, and both ways of
 * being wrong are invisible in a summary count. Too loose and it waves personal
 * data through; too eager and it reports containers instead of render sites, at
 * which point marking up the real place does NOT clear the finding and the gate
 * is red whatever anyone does. That second failure is not hypothetical — it is
 * what the first cut of the walk did, on 76 of its 130 findings.
 */

import { describe, expect, it } from 'vitest'

// @ts-expect-error — a plain .mjs script, deliberately not part of the app's
// type graph: it runs under node without a build step.
import { auditSource } from '../../../scripts/pii-audit.mjs'

interface Finding {
  path: string
  line: number
  identifier: string
  attribute?: string
  host?: string
}

interface Result {
  rendered: Finding[]
  attributes: Finding[]
  freeText: Finding[]
  iframes: Finding[]
  htmlSinks: Finding[]
}

const audit = (source: string): Result => auditSource('src/fixture.tsx', source) as Result

describe('pii-audit — what counts as a render site', () => {
  it('reports a name rendered as text', () => {
    const { rendered } = audit(`export const C = () => <div>{client.fullName}</div>`)
    expect(rendered.map((f) => f.identifier)).toEqual(['client.fullName'])
  })

  it('reports a derived name a five-field grep would miss', () => {
    // The whole reason the dictionary carries a leading `[A-Za-z_]*`: `\\b` does
    // not fire between two word characters, so `\\bfullName\\b` never matches
    // `clientFullName`.
    const { rendered } = audit(`
      export const C = () => (
        <>
          <span>{clientFullName}</span>
          <span>{row.assigned_user_full_name}</span>
          <span>{address?.fullAddress}</span>
        </>
      )
    `)
    expect(rendered).toHaveLength(3)
  })

  it('ignores comments and string literals', () => {
    // The requirement a line-based grep cannot meet — and the source of the two
    // known false positives in the task's own numbers.
    const { rendered, attributes } = audit(`
      // the address bar is not personal data
      export const C = () => (
        /* full_name lives on the client */
        <div title="Enter the full name">{t('form.firstName')}</div>
      )
    `)
    expect(rendered).toHaveLength(0)
    expect(attributes).toHaveLength(0)
  })

  it('reports the render site, NOT the container a thousand lines above it', () => {
    // 🔴 The regression this file exists for. Marking up the inner element must
    // clear the finding; if the outer expression were reported too, it could
    // never be cleared, because the marked element is not its ancestor.
    const { rendered } = audit(`
      export const C = () => (
        <div>
          {tab === 'payments' && (
            <section>
              <span>{client.fullName}</span>
            </section>
          )}
        </div>
      )
    `)
    expect(rendered).toHaveLength(1)
    expect(rendered[0].identifier).toBe('client.fullName')
  })

  it('does not report a guard that only TESTS the value', () => {
    // 🔴 `{clientName ? <span>{clientName}</span> : null}` renders the name in
    // the branch, and the branch is what gets marked up. If the condition were
    // read as a render too, the outer expression would be a second finding —
    // and one that marking up the inner span could never clear, because the
    // marked element is not its ancestor. The same dead end as bubbling out of
    // nested JSX, reached from the other side; `pages/LawyerWorkplace` writes
    // every client name this way.
    const { rendered } = audit(`
      export const C = () => (
        <div>
          {clientName ? <span data-openreplay-obscured="">{clientName}</span> : null}
          {client.fullName && <span data-openreplay-obscured="">{client.fullName}</span>}
        </div>
      )
    `)
    expect(rendered).toHaveLength(0)
  })

  it('still reports a fallback, which renders rather than guards', () => {
    // `{name || '—'}` is not a guard: the name IS what reaches the screen.
    const { rendered } = audit(`export const C = () => <p>{client.fullName || '—'}</p>`)
    expect(rendered).toHaveLength(1)
  })

  it('still sees a name in the non-JSX branch of a conditional', () => {
    const { rendered } = audit(
      `export const C = () => <div>{loading ? <Spinner /> : client.fullName}</div>`
    )
    expect(rendered.map((f) => f.identifier)).toEqual(['client.fullName'])
  })

  it('does not mistake a loop variable for a rendered value', () => {
    const { rendered } = audit(`
      export const C = () => (
        <ul>
          {addresses.map((address) => (
            <li key={address.id}>{address.full_address}</li>
          ))}
        </ul>
      )
    `)
    expect(rendered.map((f) => f.identifier)).toEqual(['address.full_address'])
  })

  it('does not report the container half of a chain', () => {
    // `address.is_primary` is a boolean and `address.address_type` is an enum;
    // both contain the string "address". Judging the chain by its last segment
    // instead of its full text is what tells them apart — and a rule that fires
    // on the container's name reports the same false positive forever.
    const { rendered } = audit(`
      export const C = () => (
        <div>
          {address.is_primary && <Badge />}
          {address.address_type}
        </div>
      )
    `)
    expect(rendered).toHaveLength(0)
  })

  it('does not report counts, keys and method calls', () => {
    const { rendered } = audit(`
      export const C = () => (
        <div>
          {addresses.length} / {firstName.trim()} / {address.id}
        </div>
      )
    `)
    expect(rendered).toHaveLength(0)
  })

  it('does not report flags and handlers', () => {
    const { rendered } = audit(`
      export const C = () => (
        <div>
          {isUpdatingAddress && <Spinner />}
          <button onClick={handleStartEditAddress}>edit</button>
        </div>
      )
    `)
    expect(rendered).toHaveLength(0)
  })

  it('still reports a formatter that produces a name', () => {
    // `format*` is deliberately NOT in the excluded shapes: this is a real site
    // (`pages/ActionAnalysis/components/CallsTable.tsx`).
    const { rendered } = audit(`export const C = () => <td>{formatEmployeeName(row)}</td>`)
    expect(rendered).toHaveLength(1)
  })

  it('reports an attachment or document name by its owner', () => {
    // A file attached to a client's case is named after the client more often
    // than not; a bulk-import CSV or a template file is not. The owner is the
    // only thing that tells them apart, so this rule is tested against the whole
    // chain rather than the tail.
    const { rendered, attributes } = audit(`
      export const C = () => (
        <>
          <p>{attachment.filename}</p>
          <img alt={attachment.name} />
          <p>{job.file_name}</p>
        </>
      )
    `)
    expect(rendered.map((f) => f.identifier)).toEqual(['attachment.filename'])
    expect(attributes.map((f) => f.identifier)).toEqual(['attachment.name'])
  })

  it('leaves alone the addresses that are not a person', () => {
    const { rendered } = audit(`
      export const C = () => (
        <div>
          {entry.ip_address} {contact.email_address} {row.address_type}
        </div>
      )
    `)
    expect(rendered).toHaveLength(0)
  })
})

describe('pii-audit — what counts as covered', () => {
  it('accepts the attribute on an ancestor', () => {
    const { rendered } = audit(`
      export const C = () => (
        <div data-openreplay-obscured="">
          <section>
            <span>{client.fullName}</span>
          </section>
        </div>
      )
    `)
    expect(rendered).toHaveLength(0)
  })

  it('accepts the sanctioned spread', () => {
    const { rendered } = audit(
      `export const C = () => <div {...piiProps}><span>{client.fullName}</span></div>`
    )
    expect(rendered).toHaveLength(0)
  })

  it('accepts the <Pii> wrapper', () => {
    const { rendered } = audit(`export const C = () => <Pii>{client.fullName}</Pii>`)
    expect(rendered).toHaveLength(0)
  })

  it('accepts a DataTable column that declares itself obscured', () => {
    // Columns are declared outside JSX, so the ancestor walk cannot see them.
    // Without this the 19 table files would stay red no matter what.
    const { rendered } = audit(`
      const columns = [
        { key: 'name', header: 'ФИО', obscured: true, render: (r) => r.full_name },
      ]
    `)
    expect(rendered).toHaveLength(0)
  })

  it('does NOT accept `obscured={false}` or a computed value as coverage', () => {
    // 🔴 The name of the prop is not the coverage; its value is. Treating any
    // `obscured` as covered let `<SearchableSelect obscured={false}>` silence
    // the whole subtree — the first author to pass `obscured={isPerson}` would
    // have exempted every name under it without a word from CI.
    const { rendered } = audit(`
      export const C = () => (
        <>
          <SearchableSelect obscured={false}>
            <span>{client.fullName}</span>
          </SearchableSelect>
          <FieldGrid obscured={isPerson}>
            <span>{client.fullName}</span>
          </FieldGrid>
        </>
      )
    `)
    expect(rendered).toHaveLength(2)
  })

  it('accepts the shorthand and a literal true on a component flag', () => {
    const { rendered } = audit(`
      export const C = () => (
        <>
          <SearchableSelect obscured>
            <span>{client.fullName}</span>
          </SearchableSelect>
          <FieldGrid obscured={true}>
            <span>{client.fullName}</span>
          </FieldGrid>
        </>
      )
    `)
    expect(rendered).toHaveLength(0)
  })

  it('does NOT accept a column that opts out', () => {
    const { rendered } = audit(`
      const columns = [
        { key: 'name', header: 'ФИО', obscured: false, render: (r) => r.full_name },
      ]
    `)
    expect(rendered).toHaveLength(1)
  })
})

describe('pii-audit — attributes', () => {
  it('reports PII in an attribute the tracker never masks', () => {
    const { attributes } = audit(`export const C = () => <button title={row.client_full_name} />`)
    expect(attributes).toHaveLength(1)
    expect(attributes[0].attribute).toBe('title')
  })

  it('reports it EVEN INSIDE a marked container', () => {
    // Outside privateMode the tracker sends attribute values verbatim, from
    // obscured and hidden nodes alike. Markup is not a fix here.
    const { attributes } = audit(`
      export const C = () => (
        <div data-openreplay-obscured="">
          <button title={row.client_full_name}>#{row.client_id}</button>
        </div>
      )
    `)
    expect(attributes).toHaveLength(1)
  })

  it('reports a prop on a component too, and says which component', () => {
    // 🔴 Filtering to lower-case tags looks right and is not: `<Link title={…}>`
    // forwards the prop to the `<a>` it renders, so the value reaches the
    // recording exactly as it would from a `<span>`. Three of the six known
    // leaks vanished the moment that filter was tried. The host is reported
    // instead, because which kind a component is cannot be known from here.
    const { attributes } = audit(`
      export const C = () => <Link title={contact.fullName}>{contact.clientNumber}</Link>
    `)
    expect(attributes).toHaveLength(1)
    expect(attributes[0].host).toBe('Link')
  })

  it('names an intrinsic host with its tag', () => {
    const { attributes } = audit(`export const C = () => <button title={row.full_name} />`)
    expect(attributes[0].host).toBe('<button>')
  })

  it('leaves an attribute whose value is not personal data alone', () => {
    // Removing these is an accessibility regression traded for nothing.
    const { attributes } = audit(`
      export const C = () => (
        <span title={user.department} aria-label={t('common.roles.client')} />
      )
    `)
    expect(attributes).toHaveLength(0)
  })
})

describe('pii-audit — iframes', () => {
  it('reports an <iframe> with no attribute of its own', () => {
    const { iframes } = audit(`export const C = () => <iframe src={blobUrl} title="x" />`) as {
      iframes: Finding[]
    }
    expect(iframes).toHaveLength(1)
  })

  it('is NOT satisfied by a marked wrapper', () => {
    // 🔴 `TopObserver` reads the attribute off the node in its own callback, so
    // inheritance plays no part — a wrapper that covers the text does nothing
    // for the frame.
    const { iframes } = audit(`
      export const C = () => (
        <div data-openreplay-obscured="">
          <iframe src={blobUrl} title="x" />
        </div>
      )
    `) as { iframes: Finding[] }
    expect(iframes).toHaveLength(1)
  })

  it('accepts the attribute on the iframe itself', () => {
    const { iframes } = audit(
      `export const C = () => <iframe src={blobUrl} title="x" {...piiProps} />`
    ) as { iframes: Finding[] }
    expect(iframes).toHaveLength(0)
  })
})

describe('pii-audit — dangerouslySetInnerHTML', () => {
  it('reports a sink outside any marked node', () => {
    // 🔴 Nothing this renders has an identifier: the text nodes come out of a
    // string at runtime. Review of KAN-KB-54 found a client's whole letter
    // rendered this way outside every marked node in its file, invisible to
    // every other rule here. So the rule is structural.
    const { htmlSinks } = audit(
      `export const C = () => <div dangerouslySetInnerHTML={{ __html: safeHtml }} />`
    )
    expect(htmlSinks).toHaveLength(1)
  })

  it('accepts the attribute on the sink itself', () => {
    const { htmlSinks } = audit(
      `export const C = () => <div dangerouslySetInnerHTML={{ __html: safeHtml }} {...piiProps} />`
    )
    expect(htmlSinks).toHaveLength(0)
  })

  it('accepts a marked ancestor — inheritance covers what the HTML produces', () => {
    const { htmlSinks } = audit(`
      export const C = () => (
        <Pii as="div">
          <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
        </Pii>
      )
    `)
    expect(htmlSinks).toHaveLength(0)
  })
})

describe('pii-audit — free text', () => {
  it('reports rendered client-facing text by the shape of a bare identifier', () => {
    // `previewBody` is a resolved template that opens with the client's name.
    // No field-name rule can see it; the identifier's own shape can.
    const { freeText } = audit(`export const C = () => <pre>{previewBody}</pre>`)
    expect(freeText).toHaveLength(1)
  })

  it('reports a letter subject and a message body by their owner', () => {
    const { freeText } = audit(`
      export const C = () => (
        <>
          <h3>{letter.subject}</h3>
          <div>{messageData.body}</div>
        </>
      )
    `)
    expect(freeText).toHaveLength(2)
  })

  it('does not report the unrendered template', () => {
    // `template.body` is UI copy with {{placeholders}} in it; the rendered
    // result is what carries personal data, and that has another owner.
    const { freeText } = audit(`export const C = () => <pre>{template.body}</pre>`)
    expect(freeText).toHaveLength(0)
  })

  it('reports client prose as an advisory candidate', () => {
    const { freeText, rendered } = audit(`export const C = () => <p>{contact.comment}</p>`)
    expect(freeText).toHaveLength(1)
    // Advisory means advisory: it must not make `--check` red on its own.
    expect(rendered).toHaveLength(0)
  })

  it('does not report UI copy', () => {
    const { freeText } = audit(`export const C = () => <p>{template.description}</p>`)
    expect(freeText).toHaveLength(0)
  })
})
