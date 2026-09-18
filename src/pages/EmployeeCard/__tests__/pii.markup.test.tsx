/**
 * KAN-KB-54 — the markup of the employee card and the users list, phase 3.2.
 *
 * `FieldGrid` is the whole section's chokepoint: every read-only field of the
 * card goes through it, so the flag is set once per field and the attribute
 * lands on the `<dd>`. Which is also why it needs a test of its own — if the
 * `<dd>` ever stops emitting the attribute, twenty call sites keep their
 * `obscured: true` and none of them is wrong.
 */

import { describe, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { FieldGrid } from '../components/FieldGrid'
import { expectObscured, expectNotObscured } from '@/test/piiHelpers'

describe('EmployeeCard PII markup — FieldGrid', () => {
  it('masks a marked value and leaves its label readable', () => {
    render(
      <FieldGrid
        fields={[
          { label: 'ФИО', value: 'Коваленко Олег Петрович', obscured: true },
          { label: 'Адрес', value: 'г. Киев, ул. Ленина, 1', obscured: true },
        ]}
      />
    )
    expectObscured(screen.getByText('Коваленко Олег Петрович'))
    expectObscured(screen.getByText('г. Киев, ул. Ленина, 1'))
    // The label is what says WHAT the asterisks are. A card where the labels go
    // too is unreadable in a replay and buys nothing: a field name is not data.
    expectNotObscured(screen.getByText('ФИО'))
    expectNotObscured(screen.getByText('Адрес'))
  })

  it('leaves an unmarked field alone', () => {
    // Department, position and work format are not personal data. Marking every
    // field "to be safe" is `privateMode` by another route.
    render(
      <FieldGrid
        fields={[
          { label: 'Отдел', value: 'Взыскание' },
          { label: 'Должность', value: 'Оператор' },
        ]}
      />
    )
    expectNotObscured(screen.getByText('Взыскание'))
    expectNotObscured(screen.getByText('Оператор'))
  })

  it('masks the dash an empty marked field renders', () => {
    // Not about the dash itself — about the attribute being on the `<dd>` rather
    // than on whatever the value happened to be. A field that is empty today and
    // filled in tomorrow must not need a second edit.
    render(<FieldGrid fields={[{ label: 'ФИО', value: '', obscured: true }]} />)
    expectObscured(screen.getByText('—'))
  })
})
