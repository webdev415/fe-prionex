/**
 * `Column.obscured` / `expandedObscured` — the declarative half of KAN-KB-54.
 *
 * 19 of the ~120 components that render personal data go through DataTable, so
 * this flag is the only place in the plan where markup is a one-line change per
 * column instead of a per-field edit. Which also makes it the one place where a
 * regression is invisible at the call sites: a column keeps its `obscured: true`
 * in the caller while the table quietly stops emitting the attribute.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { DataTable, type Column } from '../DataTable'
import { OPENREPLAY_OBSCURED_ATTR } from '@/lib/openreplay/pii'
import { expectObscured, expectNotObscured } from '@/test/piiHelpers'

interface Row {
  id: number
  fullName: string
  status: string
}

const DATA: Row[] = [
  { id: 1, fullName: 'Иванов Иван Иванович', status: 'В работе' },
  { id: 2, fullName: 'Петрова Анна Сергеевна', status: 'Закрыт' },
]

const COLUMNS: Column<Row>[] = [
  { key: 'fullName', header: 'ФИО', render: (r) => r.fullName, obscured: true },
  { key: 'status', header: 'Статус', render: (r) => r.status },
]

describe('DataTable — PII columns', () => {
  it('marks the body cells of an obscured column', () => {
    render(<DataTable columns={COLUMNS} data={DATA} />)
    expectObscured(screen.getByText('Иванов Иван Иванович'))
    expectObscured(screen.getByText('Петрова Анна Сергеевна'))
  })

  it('leaves the other columns readable', () => {
    // The reason the flag is per column and not per row: a replay has to keep
    // showing what the operator was looking at.
    render(<DataTable columns={COLUMNS} data={DATA} />)
    expectNotObscured(screen.getByText('В работе'))
    expectNotObscured(screen.getByText('Закрыт'))
  })

  it('never marks the header cell', () => {
    // A column title is not personal data, and a table whose headers are
    // asterisks is unreadable in a replay for no gain.
    render(<DataTable columns={COLUMNS} data={DATA} />)
    const header = screen.getByRole('columnheader', { name: /ФИО/ })
    expect(header.hasAttribute(OPENREPLAY_OBSCURED_ATTR)).toBe(false)
    expectNotObscured(header)
  })

  it('marks nothing when no column asks for it', () => {
    render(
      <DataTable
        columns={[{ key: 'status', header: 'Статус', render: (r: Row) => r.status }]}
        data={DATA}
      />
    )
    expect(document.querySelectorAll(`[${OPENREPLAY_OBSCURED_ATTR}]`)).toHaveLength(0)
  })

  it('covers whatever the column renderer puts in the cell', () => {
    // Inheritance again: the flag is on the <td>, so a custom renderer's nested
    // markup is covered without every renderer having to know about any of this.
    const columns: Column<Row>[] = [
      {
        key: 'fullName',
        header: 'ФИО',
        obscured: true,
        render: (r) => (
          <div>
            <strong>{r.fullName}</strong>
            <small>клиент</small>
          </div>
        ),
      },
    ]
    render(<DataTable columns={columns} data={DATA} />)
    expectObscured(screen.getByText('Иванов Иван Иванович'))
  })

  it('marks the expansion row only when asked', () => {
    const { rerender } = render(
      <DataTable
        columns={COLUMNS}
        data={DATA}
        renderExpanded={(r) => <div>Адрес: ул. Ленина, 1 — {r.fullName}</div>}
        expandedIds={new Set([1])}
      />
    )
    // Without the flag the panel is outside every marked cell — inheritance runs
    // down the DOM and this row is a sibling of the marked one, not a child.
    expectNotObscured(screen.getByText(/Адрес: ул. Ленина/))

    rerender(
      <DataTable
        columns={COLUMNS}
        data={DATA}
        renderExpanded={(r) => <div>Адрес: ул. Ленина, 1 — {r.fullName}</div>}
        expandedIds={new Set([1])}
        expandedObscured
      />
    )
    expectObscured(screen.getByText(/Адрес: ул. Ленина/))
  })
})
