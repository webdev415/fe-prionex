/**
 * Чек-лист ручного решения (19-5f): что уходит в тело решения и в каком порядке.
 *
 * Модуль не выдумывает неприсланные пункты и хранит присланные в порядке листа
 * книги — тело формы обязано нести только отвеченные пункты и в том же порядке,
 * а не в порядке кликов. Ни одного ответа — ключа `checklist` нет вовсе: так
 * наборы ключей тела решения остаются прежними.
 */
import { describe, it, expect } from 'vitest'
import { CREDIT_CHECKLIST_NOTE_MAX, answeredCount, checklistPayload } from '../decisionChecklist'
import { CREDIT_CHECKLIST_HINTED, CREDIT_CHECKLIST_KEYS } from '../enums'

describe('decisionChecklist → перечень пунктов', () => {
  it('L-1: одиннадцать пунктов в порядке листа книги; шесть с подсказкой, все из листа', () => {
    expect(
      [...CREDIT_CHECKLIST_KEYS],
      'the checklist items are not the eleven keys of the book sheet in its order'
    ).toEqual([
      'ibv_all_accounts',
      'statement_two_months',
      'salary_regular',
      'nsf_isolated',
      'loan_repayments_on_payday_max6',
      'salary_account_connected',
      'id_photo_only',
      'id_valid_on_apply',
      'id_alberta_only',
      'pay_document',
      'residence_proof',
    ])
    expect(CREDIT_CHECKLIST_HINTED).toHaveLength(6)
    const keys: readonly string[] = CREDIT_CHECKLIST_KEYS
    expect(
      CREDIT_CHECKLIST_HINTED.filter((key) => !keys.includes(key)),
      'a hinted item is not on the sheet'
    ).toEqual([])
    expect(CREDIT_CHECKLIST_NOTE_MAX).toBe(500)
  })
})

describe('decisionChecklist → тело решения', () => {
  it('L-2: ни одного ответа — undefined; ответы уходят в порядке листа, а не в порядке ввода', () => {
    expect(checklistPayload({}, {}), 'an empty checklist is sent as a key').toBeUndefined()

    // Порядок ввода обратный листу: последний пункт отвечен первым.
    const answers = { residence_proof: 'n_a', ibv_all_accounts: 'yes' } as const
    expect(Object.keys(answers)[0], 'the scene lost its reversed input order').toBe(
      'residence_proof'
    )
    expect(
      checklistPayload(answers, {}),
      'the checklist items are sent in the order they were answered, not in the sheet order'
    ).toEqual([
      { key: 'ibv_all_accounts', answer: 'yes' },
      { key: 'residence_proof', answer: 'n_a' },
    ])
  })

  it('L-3: примечание — после trim; пустое — без ключа note; у неотвеченного пункта не уходит', () => {
    const payload = checklistPayload(
      { pay_document: 'yes', id_photo_only: 'no' },
      { pay_document: '  x  ', id_photo_only: '   ', salary_regular: 'чужое примечание' }
    )

    expect(payload).toEqual([
      { key: 'id_photo_only', answer: 'no' },
      { key: 'pay_document', answer: 'yes', note: 'x' },
    ])
    expect(
      'note' in (payload?.[0] ?? {}),
      'a blank note is sent as an empty key instead of no key'
    ).toBe(false)
    expect(
      payload?.some((item) => item.key === 'salary_regular'),
      'the note of an unanswered item left in the body'
    ).toBe(false)
  })

  it('L-4: счёт отвеченных — снятый ответ (undefined) не считается', () => {
    expect(answeredCount({})).toBe(0)
    expect(answeredCount({ ibv_all_accounts: 'yes', residence_proof: 'n_a' })).toBe(2)
    expect(
      answeredCount({ ibv_all_accounts: 'yes', residence_proof: undefined }),
      'a cleared answer is still counted as answered'
    ).toBe(1)
    expect(
      checklistPayload({ ibv_all_accounts: undefined }, { ibv_all_accounts: 'x' }),
      'a cleared answer still sends its item'
    ).toBeUndefined()
  })
})
