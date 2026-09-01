/**
 * Тест-пин зеркала: этапы в CRM обязаны совпадать с этапами в кабинете клиента.
 *
 * Ожидания ниже НЕ придуманы — они выписаны из кода кабинета
 * (`web-credit/apps/cabinet/src/components/ApplicationCard.tsx`, функция
 * `stepStates`), ветка за веткой, и каждая строка снабжена цитатой оригинала.
 * Импортировать оригинал нельзя: это другой репозиторий, в сборке CRM его нет.
 * Поэтому тест ловит расхождение с одной стороны — если тронут расчёт ЗДЕСЬ.
 * Правку в кабинете он не поймает; там про этот файл написано в шапке зеркала.
 *
 * Формы `missing_fields` взяты с живого модуля (dev 72.62.17.132, 01.09.2026):
 * `['address','phones','income','params','bank_verification']` у CA-000208,
 * `['phones','income','params','bank_verification']` у CA-000201, `[]` у всех
 * решённых. Именно `bank_verification` — единственное значение на `bank*`,
 * ради которого в кабинете стоит `f.startsWith('bank')`.
 */
import { describe, it, expect } from 'vitest'
import {
  CREDIT_APPLICATION_STAGES,
  CREDIT_CABINET_VISIBLE_STATUSES,
  creditApplicationStageStates,
  creditApplicationStages,
  type CreditStageState,
} from '../applicationStages'

describe('этапы заявки: зеркало кабинета', () => {
  it('держит те же пять шагов и в том же порядке', () => {
    // Оригинал: `const STEPS = ['registration', 'questionnaire', 'bank',
    // 'decision', 'signing'] as const;` — номер шага в разговоре с клиентом
    // берётся отсюда, поэтому порядок пинуется отдельно от состояний.
    expect([...CREDIT_APPLICATION_STAGES]).toEqual([
      'registration',
      'questionnaire',
      'bank',
      'decision',
      'signing',
    ])
  })

  const cases: Array<{
    name: string
    input: { status: string; missing_fields?: string[] | null }
    expected: CreditStageState[]
  }> = [
    {
      // `if (st === 'approved') return ['done','done','done','done','current'];`
      name: 'approved: решение принято, клиент подписывает',
      input: { status: 'approved', missing_fields: [] },
      expected: ['done', 'done', 'done', 'done', 'current'],
    },
    {
      // `if (st === 'declined') return ['done','done','done','failed','todo'];`
      name: 'declined: шаг решения сбойный, подписания не будет',
      input: { status: 'declined', missing_fields: [] },
      expected: ['done', 'done', 'done', 'failed', 'todo'],
    },
    {
      // `if (st === 'scoring' || st === 'referred') return [...,'current','todo'];`
      name: 'scoring: решение готовится',
      input: { status: 'scoring', missing_fields: [] },
      expected: ['done', 'done', 'done', 'current', 'todo'],
    },
    {
      name: 'referred: ручной разбор — тот же шаг решения',
      input: { status: 'referred', missing_fields: [] },
      expected: ['done', 'done', 'done', 'current', 'todo'],
    },
    {
      // `if (anketaMissing) return ['done','current', bankMissing ? 'todo' : 'done', ...]`
      name: 'in_progress: не хватает анкеты и банка (живая CA-000208)',
      input: {
        status: 'in_progress',
        missing_fields: ['address', 'phones', 'income', 'params', 'bank_verification'],
      },
      expected: ['done', 'current', 'todo', 'todo', 'todo'],
    },
    {
      // Та же ветка, но `bankMissing === false`: банк уже закрыт, хотя анкета нет.
      name: 'in_progress: анкета не дозаполнена, а банк уже пройден',
      input: { status: 'in_progress', missing_fields: ['params'] },
      expected: ['done', 'current', 'done', 'todo', 'todo'],
    },
    {
      // `if (bankMissing) return ['done','done','current','todo','todo'];`
      name: 'in_progress: анкета готова, ждём банк',
      input: { status: 'in_progress', missing_fields: ['bank_verification'] },
      expected: ['done', 'done', 'current', 'todo', 'todo'],
    },
    {
      // Хвост ветки `in_progress / data_collection`: нехватки нет вовсе.
      name: 'in_progress: всё собрано, ждём решения',
      input: { status: 'in_progress', missing_fields: [] },
      expected: ['done', 'done', 'done', 'current', 'todo'],
    },
    {
      name: 'data_collection: считается ровно как in_progress',
      input: { status: 'data_collection', missing_fields: ['income', 'bank_verification'] },
      expected: ['done', 'current', 'todo', 'todo', 'todo'],
    },
    {
      // `const missing = app.missing_fields ?? [];` — поля может не быть вовсе.
      name: 'in_progress без missing_fields: пусто, а не падение',
      input: { status: 'in_progress' },
      expected: ['done', 'done', 'done', 'current', 'todo'],
    },
  ]

  it.each(cases)('$name', ({ input, expected }) => {
    expect(creditApplicationStageStates(input)).toEqual(expected)
  })

  it('покрывает каждый статус, который видит клиент', () => {
    // Если модуль расширит `CURRENT_APPLICATION_STATUSES`, а мы не проверим
    // новый статус — тест скажет об этом здесь, а не оператор по телефону.
    const covered = new Set(cases.map((c) => c.input.status))
    expect(CREDIT_CABINET_VISIBLE_STATUSES.filter((s) => !covered.has(s))).toEqual([])
  })

  it('НЕ смотрит на resume_step — как и кабинет', () => {
    // Кабинет считает состояние только из `status` и `missing_fields`. Стоит
    // начать читать здесь `resume_step` — и оператор с клиентом молча разойдутся
    // ровно на тех заявках, где шаг остановки не совпал с нехваткой блоков.
    const base = { status: 'in_progress', missing_fields: ['bank_verification'] }
    expect(creditApplicationStageStates({ ...base, resume_step: 'personal' })).toEqual(
      creditApplicationStageStates({ ...base, resume_step: 'done' })
    )
  })
})

describe('этапы заявки: статусы за пределами зеркала', () => {
  // Эти статусы `GET /public/applications/current` не отдаёт вовсе
  // (`CURRENT_APPLICATION_STATUSES` в credit-module), поэтому кабинет их не
  // считает и разойтись с ним здесь не на чем.
  it.each([
    ['contracted', ['done', 'done', 'done', 'done', 'done']],
    ['disbursed', ['done', 'done', 'done', 'done', 'done']],
  ] as const)('%s: подписано и выдано — пройдены все пять', (status, expected) => {
    expect(creditApplicationStageStates({ status, missing_fields: [] })).toEqual(expected)
  })

  it.each(['expired', 'abandoned'])('%s: у мёртвой заявки нет текущего шага', (status) => {
    const states = creditApplicationStageStates({
      status,
      missing_fields: ['income', 'bank_verification'],
    })
    expect(states).not.toContain('current')
    // Пройденное остаётся пройденным: заявка дошла до анкеты и там встала.
    expect(states).toEqual(['done', 'todo', 'todo', 'todo', 'todo'])
  })
})

describe('creditApplicationStages: форма для отрисовки', () => {
  it('нумерует шаги так же, как их считает клиент', () => {
    const stages = creditApplicationStages({ status: 'approved', missing_fields: [] })
    expect(stages.map((s) => s.number)).toEqual([1, 2, 3, 4, 5])
    expect(stages.map((s) => s.stage)).toEqual([...CREDIT_APPLICATION_STAGES])
    // «Клиент говорит: я на пятом» — и это подписание.
    expect(stages.find((s) => s.state === 'current')).toEqual({
      stage: 'signing',
      state: 'current',
      number: 5,
    })
  })
})
