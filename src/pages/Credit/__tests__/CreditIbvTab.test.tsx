/**
 * Вкладка «Банківська перевірка»: имя держателя счёта — персональные данные.
 *
 * Имя держателя вкладка печатает в двух местах: рядом с совпадением личности
 * (держатель счёта выплаты) и в строках каждого счёта. Оба — ФИО клиента, как
 * на вкладке «Анкета» (сцена P-1 теста страницы), и в запись сессии буквами
 * уходить не должны. Подписи строк при этом остаются читаемыми: разметка
 * ставится на имя, а не на панель целиком.
 *
 * Держатели и номера синтетические: живых реквизитов в тестах нет.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { CreditIbvTab } from '../components/CreditIbvTab'
import { expectNotObscured, expectObscured } from '@/test/piiHelpers'
import type { CreditIbv } from '@/features/credit/api/types'

const IBV = {
  provider: 'mock',
  identity_match_rate: 0.95,
  payout_account_id: 'acc_test_1',
  accounts: [
    { account_id: 'acc_test_1', holder_name: 'Payout Holder', account_number: '000000000' },
    { account_id: 'acc_test_2', holder_name: 'Other Holder', account_number: '000000001' },
  ],
} as unknown as CreditIbv

/** Строка вкладки по подписи: подпись и значение — соседи внутри одной строки. */
const rowOf = (label: HTMLElement) => {
  const row = label.parentElement
  if (!row) throw new Error('у подписи строки нет родителя — разметка строки сменилась')
  return row
}

describe('CreditIbvTab → имя держателя счёта', () => {
  it('P-2: имя держателя выплаты и имена держателей счетов скрыты в записи сессии, подписи читаемы', () => {
    render(<CreditIbvTab ibv={IBV} currency="CAD" />)

    // Держатель выплаты рядом с совпадением личности.
    const identityLabel = screen.getByText('credit.fields.identityMatch')
    expectObscured(within(rowOf(identityLabel)).getByText('Payout Holder'))
    expectNotObscured(identityLabel)

    // Строки счетов: прочий счёт под «інші рахунки» и счёт выплаты. Прочий —
    // первым: его имя встречается только в строке счёта, и падение называет
    // именно её, а не держателя выплаты из строки совпадения личности.
    const holderLabels = screen.getAllByText('credit.fields.holder')
    expect(holderLabels, 'строк держателя столько же, сколько счетов').toHaveLength(2)
    expectObscured(within(rowOf(holderLabels[1])).getByText('Other Holder'))
    expectObscured(within(rowOf(holderLabels[0])).getByText('Payout Holder'))
    for (const label of holderLabels) expectNotObscured(label)
  })
})
