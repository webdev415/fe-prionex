import { describe, expect, it } from 'vitest'
import { foldPaymentResponsible } from '../paymentResponsible'

/**
 * The fold rule of the card's «Ответственный по платежу» — BY ID, then the
 * name. Every case below is a decision the docblock explains; the
 * soft-deleted-assignee case is the one a name fold gets wrong.
 */
describe('foldPaymentResponsible', () => {
  it('names the ASSIGNEE when the payment is assigned', () => {
    expect(
      foldPaymentResponsible({
        assigned_user_id: 202,
        assigned_full_name: 'Коваленко Іван',
        recorded_by_user_id: 201,
        recorded_by_full_name: 'Записенко Іван',
      })
    ).toEqual({ userId: 202, label: 'Коваленко Іван', isIdOnly: false })
  })

  it('falls back to the RECORDER only when there is no assignee id at all', () => {
    // The card's `coalesce(assigned_user_id, recorded_by_user_id)`: the second
    // id is read only when the first is null.
    expect(
      foldPaymentResponsible({
        assigned_user_id: null,
        assigned_full_name: null,
        recorded_by_user_id: 201,
        recorded_by_full_name: 'Записенко Іван',
      })
    ).toEqual({ userId: 201, label: 'Записенко Іван', isIdOnly: false })
  })

  it('shows the assignee’s ID — never the recorder’s name — for a soft-deleted assignee', () => {
    // THE case that separates folding by id from folding by name. The
    // directory filters soft-deleted users, so the assignee's name is null
    // while their id stays on the payment. `assigned_full_name ??
    // recorded_by_full_name` would silently print «Записенко Іван» — a
    // different person, presented as the one responsible.
    expect(
      foldPaymentResponsible({
        assigned_user_id: 4711,
        assigned_full_name: null,
        recorded_by_user_id: 201,
        recorded_by_full_name: 'Записенко Іван',
      })
    ).toEqual({ userId: 4711, label: '4711', isIdOnly: true })
  })

  it('treats a blank assignee name as missing, not as a name', () => {
    expect(
      foldPaymentResponsible({
        assigned_user_id: 4711,
        assigned_full_name: '   ',
        recorded_by_user_id: 201,
        recorded_by_full_name: 'Записенко Іван',
      })
    ).toEqual({ userId: 4711, label: '4711', isIdOnly: true })
  })

  it('shows the recorder’s ID for a soft-deleted recorder of an unassigned payment', () => {
    expect(
      foldPaymentResponsible({
        assigned_user_id: null,
        assigned_full_name: null,
        recorded_by_user_id: 9001,
        recorded_by_full_name: null,
      })
    ).toEqual({ userId: 9001, label: '9001', isIdOnly: true })
  })

  it('answers null when the row carries neither id', () => {
    // Not a state the feed produces today (both ids are set on 100 % of rows),
    // but the schema allows it and «—» is the honest cell.
    expect(
      foldPaymentResponsible({
        assigned_user_id: null,
        assigned_full_name: null,
        recorded_by_user_id: null,
        recorded_by_full_name: null,
      })
    ).toBeNull()
  })
})
