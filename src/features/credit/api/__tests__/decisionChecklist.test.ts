/**
 * Чек-лист ручного решения (19-5f): что уходит в тело решения и в каком порядке.
 *
 * Модуль не выдумывает неприсланные пункты и хранит присланные в порядке листа
 * книги — тело формы обязано нести только отвеченные пункты и в том же порядке,
 * а не в порядке кликов. Ни одного ответа — ключа `checklist` нет вовсе: так
 * наборы ключей тела решения остаются прежними.
 */
import { describe, it, expect } from 'vitest'
import {
  CREDIT_CHECKLIST_NOTE_MAX,
  answeredCount,
  checklistItemsOf,
  checklistPayload,
  conditionalOf,
  withoutConditionalCodes,
} from '../decisionChecklist'
import { CREDIT_CHECKLIST_HINTED, CREDIT_CHECKLIST_KEYS } from '../enums'
import type { CreditDecision } from '../types'

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

/**
 * Снимок решения читается терпимо, как `readScorecard` (19-5f, ревью бота r2):
 * тип описывает обещание контракта, а `input_snapshot` — JSON модуля любой
 * версии. Поле не той формы даёт пустое значение, а не падение карточки.
 */
describe('decisionChecklist → терпимое чтение снимка', () => {
  /** Решение со снимком как прислано — форма снимка сцене не доверяется. */
  const withSnapshot = (snapshot: unknown, extra: Partial<CreditDecision> = {}): CreditDecision =>
    ({
      decision_id: 'd2d2d2d2-2222-4222-8222-222222222222',
      decision_codes: ['AB-C-02'],
      input_snapshot: snapshot,
      ...extra,
    }) as unknown as CreditDecision

  it('L-5: conditional не объект — null; правильный — ступень, коды и сумма как прислано', () => {
    // Положительный контроль: та же функция читает правильный снимок целиком.
    expect(
      conditionalOf(
        withSnapshot({
          conditional: { stage: 'proposed', codes: ['AB-C-02'], amount_minor: 25_000 },
        })
      )
    ).toEqual({ stage: 'proposed', codes: ['AB-C-02'], amountMinor: 25_000 })

    for (const conditional of ['x', 7, ['AB-C-02'], null, true]) {
      expect(
        conditionalOf(withSnapshot({ conditional })),
        `conditional ${JSON.stringify(conditional)} is read as a condition`
      ).toBeNull()
    }
    expect(
      conditionalOf(withSnapshot({})),
      'a snapshot without conditional has a condition'
    ).toBeNull()
    expect(conditionalOf(withSnapshot(undefined))).toBeNull()
  })

  it('L-6: conditional: {} — пустое условие: ступени нет, кодов нет, суммы нет; ступень модуля — сверху', () => {
    expect(
      conditionalOf(withSnapshot({ conditional: {} })),
      'an empty conditional object is read with invented values'
    ).toEqual({ stage: null, codes: [], amountMinor: null })
    expect(
      conditionalOf(withSnapshot({ conditional: {} }, { conditional_stage: 'proposed' }))?.stage,
      'the stage of the decision is not taken over the snapshot'
    ).toBe('proposed')
  })

  it('L-7: codes строкой — []; не-строки из codes выброшены; сумма и ступень не той формы — null', () => {
    expect(
      conditionalOf(withSnapshot({ conditional: { codes: 'x', amount_minor: 25_000 } }))?.codes,
      'codes sent as a string are read as codes'
    ).toEqual([])
    expect(
      conditionalOf(withSnapshot({ conditional: { codes: ['AB-C-02', 7, null, 'AB-C-01'] } }))
        ?.codes,
      'a non-string entry of codes reached the card'
    ).toEqual(['AB-C-02', 'AB-C-01'])
    expect(
      conditionalOf(withSnapshot({ conditional: { amount_minor: '25000' } }))?.amountMinor,
      'the amount sent as a string is read as an amount'
    ).toBeNull()
    expect(
      conditionalOf(withSnapshot({ conditional: { stage: 'revoked' } }))?.stage,
      'an unknown stage is read as a stage'
    ).toBeNull()

    // Строка «Коди відмови» переживает те же коды строкой: исключать нечего.
    const decision = withSnapshot({ conditional: { codes: 'x' } })
    expect(withoutConditionalCodes(decision).decision_codes).toEqual(['AB-C-02'])
  })

  it('L-8: items: [1, {…}] — в показ уходят только записи правильной формы, в порядке модуля', () => {
    const items = checklistItemsOf(
      withSnapshot({
        checklist: {
          version: 'checklist@1',
          items: [
            1,
            { key: 'residence_proof', answer: 'n_a', note: null },
            null,
            'pay_document',
            { answer: 'yes' },
            { key: 'id_photo_only', answer: 'maybe' },
            { key: 'future_item', answer: 'yes', note: 5 },
            { key: 'pay_document', answer: 'yes', note: 'FE195F-NOTE' },
          ],
        },
      })
    )

    expect(items, 'the checklist items were not filtered to well-formed entries').toEqual([
      { key: 'residence_proof', answer: 'n_a', note: null },
      // Незнакомый пункт остаётся — показ подпишет его как прислано; примечание
      // не строкой — `null`, а не объект в разметке.
      { key: 'future_item', answer: 'yes', note: null },
      { key: 'pay_document', answer: 'yes', note: 'FE195F-NOTE' },
    ])
  })

  it('L-9: checklist или items не той формы — пустой список, а не падение', () => {
    for (const checklist of ['x', 7, null, [], {}, { items: 'x' }, { items: { 0: 'a' } }]) {
      expect(
        checklistItemsOf(withSnapshot({ checklist })),
        `checklist ${JSON.stringify(checklist)} gave answers`
      ).toEqual([])
    }
    expect(checklistItemsOf(withSnapshot(undefined))).toEqual([])
  })
})
