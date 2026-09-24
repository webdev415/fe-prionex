/**
 * Правило этапа: разбор ответа модуля плюс тест-пин фолбэка-зеркала.
 *
 * ОТКУДА ОЖИДАНИЯ. Их два источника, и они разные.
 *
 *  1. Перечень имён и форма трёх полей — из контракта модуля `0.1.26`
 *     (`x-application-stages` и схема `Application`). Копии контракта в fe нет,
 *     поэтому литерал здесь доказывает ЛОКАЛЬНУЮ неизменность, а не
 *     соответствие контракту; живую сверку несут страж дрейфа (правило 8) и
 *     сцена приёмки на стенде.
 *  2. Ожидания зеркала (`creditApplicationStageStates`) — из правила, которое
 *     ДО переноса жило в карточке кабинета. Сегодня там его нет: кабинет сам
 *     читает ответ модуля (`web-credit/apps/cabinet/src/components/
 *     application-stage.ts`), а правило вывода этапа живёт в модуле
 *     (`app/stages.py`). Значит у зеркальных ожиданий больше нет живого
 *     оракула, с которым их можно пересверить: они пинуют наш фолбэк таким,
 *     каким он был снят, и не более того. Трогать их можно только вместе с
 *     решением о судьбе самого фолбэка.
 *
 * Формы `missing_fields` взяты с живого модуля (dev 72.62.17.132, 01.09.2026):
 * `['address','phones','income','params','bank_verification']` у CA-000208,
 * `['phones','income','params','bank_verification']` у CA-000201, `[]` у всех
 * решённых. Именно `bank_verification` — единственное значение на `bank*`,
 * ради которого в зеркале стоит проверка префикса.
 */
import { describe, it, expect } from 'vitest'
import {
  CREDIT_APPLICATION_STAGES,
  CREDIT_CABINET_VISIBLE_STATUSES,
  creditApplicationStageStates,
  CREDIT_MAX_STAGE_TOTAL,
  creditApplicationStageView,
  creditStageLabelKey,
  creditApplicationStages,
  type CreditApplicationStageInput,
  type CreditStageState,
} from '../applicationStages'

describe('этапы заявки: зеркало кабинета', () => {
  it('равен x-application-stages контракта 0.1.26 (литерал + версия)', () => {
    // Значения сняты с `x-application-stages` контракта модуля 0.1.26
    // (`contracts/openapi.yaml:254-259`), а НЕ с кода кабинета: локального
    // расчёта там больше нет. Копии контракта в fe нет, поэтому сравнение
    // литерала с литералом доказывает ЛОКАЛЬНУЮ неизменность, а не
    // соответствие контракту. Живую сверку несут страж дрейфа (правило 8
    // ниже) и сцена приёмки на стенде.
    expect([...CREDIT_APPLICATION_STAGES]).toEqual([
      'registration',
      'questionnaire',
      'income_check',
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
    //
    // Первая версия этой проверки сравнивала ДВА значения между собой и была
    // надписью, а не стражем: приёмка вставила в функцию ветку
    // `if (resume_step === 'income') return [...]` — и все тесты остались
    // зелёными, потому что 'income' в сравнении не участвовал. Поэтому здесь
    // ВСЕ живые значения плюс отсутствие поля сверяются с одним и тем же
    // ответом: любой результат, зависящий от `resume_step`, ломает равенство.
    const base = { status: 'in_progress', missing_fields: ['bank_verification'] }
    // Шесть значений модуля: пять обязательных блоков анкеты + 'done'
    // (`REQUIRED_BLOCKS` и `missing[0] if missing else "done"`), плюс
    // 'bank_verification' и отсутствие поля.
    const values = [
      undefined,
      'personal',
      'address',
      'phones',
      'income',
      'params',
      'bank_verification',
      'done',
    ]
    const answers = new Set(
      values.map((resume_step) =>
        JSON.stringify(creditApplicationStageStates({ ...base, resume_step }))
      )
    )
    expect(answers.size).toBe(1)
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

describe('имя третьего этапа в перечне', () => {
  it('не содержит прежнего имени bank', () => {
    expect([...CREDIT_APPLICATION_STAGES]).not.toContain('bank')
  })
})

// ⚠️ Проверки САМИХ СЛОВАРЕЙ (отсутствие `credit.stage.bank`, непустой
// `credit.stage.income_check`, плейсхолдеры подписи) живут в
// `src/pages/Credit/__tests__/i18nKeys.test.ts`: он уже читает оба словаря, и
// доменному тесту незачем тянуть два файла по двенадцать тысяч строк и краснеть
// на правках i18n, к правилу этапа отношения не имеющих.

/**
 * Закрытый разбор ответа модуля: по случаю на каждое правило, в том порядке,
 * в котором правила стоят в коде. Порядок — часть требования: перестановка
 * меняет исход (правило 5 снимает 6–8 для законно более длинного пути).
 *
 * ⚠️ ЗАПИСАННЫЙ ПРЕДЕЛ. При `stage_total === 5` правило 8 («индекс не равен
 * позиции имени») перехватывает те же входы, что правила 1, 2, 3 и 7: у имени
 * вне перечня `indexOf + 1 = 0`, а правило 3 гарантирует `index >= 1`. Поэтому
 * у правил 1, 2 и 3 здесь есть вход с `stage_total = 6`, где правило 5
 * замыкает разбор раньше правила 8 и проверяемое правило остаётся
 * единственным, что стоит между ответом и видом `server`. Без такого входа
 * снятие правила ничего не красит — мутация не кусает.
 */
describe('creditApplicationStageView: закрытый разбор ответа', () => {
  const base: CreditApplicationStageInput = { status: 'in_progress', missing_fields: [] }
  const withStage = (over: Partial<CreditApplicationStageInput>): CreditApplicationStageInput => ({
    ...base,
    ...over,
  })

  it.each([
    ['полей нет вовсе', base],
    // Модуль вправе прислать `null`: три поля не в `required`. Половина
    // условия правила 0 держится именно на этом входе.
    [
      'все три поля пришли как null',
      withStage({ stage: null, stage_index: null, stage_total: null }),
    ],
    // Ни одно поле не осмысленно: пустое имя без чисел — это НЕ ответ модуля,
    // и рисовать по нему пустую рамку вместо ленты нельзя.
    ['только пустое имя, чисел нет', withStage({ stage: '' })],
    ['только пробельное имя, чисел нет', withStage({ stage: '   ' })],
    ['только дробное число', withStage({ stage_index: 2.5 })],
  ])('(0) %s — kind=mirror, деградации нет', (_name, input) => {
    expect(creditApplicationStageView(input).kind).toBe('mirror')
  })

  it.each([
    ['имя пустой строкой при total 5', withStage({ stage: '', stage_index: 3, stage_total: 5 })],
    [
      'имя из одних пробелов при total 6 (правило 5 замыкает разбор раньше правила 8)',
      withStage({ stage: '   ', stage_index: 2, stage_total: 6 }),
    ],
    [
      'имя не строка вовсе',
      {
        ...base,
        stage: 42,
        stage_index: 2,
        stage_total: 6,
      } as unknown as CreditApplicationStageInput,
    ],
    // Обратный частичный набор: числа пришли, имени нет. Норма называет его
    // «или наоборот», и до этого круга он не строился ни разу.
    ['числа пришли, имени нет вовсе', withStage({ stage_index: 3, stage_total: 5 })],
    [
      'числа пришли, имя пришло как null',
      withStage({ stage: null, stage_index: 3, stage_total: 5 }),
    ],
  ])('(1) %s — kind=degraded', (_name, input) => {
    expect(creditApplicationStageView(input).kind).toBe('degraded')
  })

  it('(1) обратный частичный набор: вид несёт числа, но НЕ несёт имени', () => {
    // Знак того, что деградированный вид без имени вообще существует: экран
    // покажет «крок 3 з 5» и ни слова о том, что это за этап.
    const view = creditApplicationStageView(withStage({ stage_index: 3, stage_total: 5 }))
    expect(view).toEqual({ kind: 'degraded', stage: undefined, known: false, index: 3, total: 5 })
  })

  it.each([
    [
      'дробный stage_index при total 5',
      withStage({ stage: 'questionnaire', stage_index: 2.5, stage_total: 5 }),
    ],
    [
      'дробный stage_total',
      withStage({ stage: 'questionnaire', stage_index: 2, stage_total: 5.5 }),
    ],
    [
      'частичный набор: есть stage и stage_total, нет stage_index',
      withStage({ stage: 'decision', stage_total: 5 }),
    ],
    [
      'частичный набор: есть stage и stage_index, нет stage_total',
      withStage({ stage: 'decision', stage_index: 4 }),
    ],
  ])('(2) %s — kind=degraded', (_name, input) => {
    expect(creditApplicationStageView(input).kind).toBe('degraded')
  })

  it.each([
    ['дробные', withStage({ stage: 'decision', stage_index: 2.5, stage_total: 5.5 })],
    [
      'строковые',
      {
        ...base,
        stage: 'decision',
        stage_index: '4',
        stage_total: '5',
      } as unknown as CreditApplicationStageInput,
    ],
  ])('(2) %s числа не доезжают до подписи: index и total = undefined', (_name, input) => {
    // Без этого утверждения подмена санитайзинга на `as number` оставалась бы
    // зелёной, и оператор прочёл бы «крок 2.5 з 5.5» либо «крок 4 з 5»,
    // собранное из строк.
    const view = creditApplicationStageView(input)
    expect(view.kind).toBe('degraded')
    if (view.kind !== 'degraded') return
    expect(view.index).toBeUndefined()
    expect(view.total).toBeUndefined()
    expect(view.stage).toBe('decision')
  })

  it.each([
    ['stage_index 0 при total 5', withStage({ stage: 'decision', stage_index: 0, stage_total: 5 })],
    ['stage_index 7 при total 5', withStage({ stage: 'decision', stage_index: 7, stage_total: 5 })],
    [
      'stage_index 0 при total 6 (правило 3 — единственное, что стоит между ответом и server)',
      withStage({ stage: 'x', stage_index: 0, stage_total: 6 }),
    ],
    ['stage_index 8 больше total 6', withStage({ stage: 'x', stage_index: 8, stage_total: 6 })],
    ['stage_total 0', withStage({ stage: 'registration', stage_index: 1, stage_total: 0 })],
  ])('(3) %s — kind=degraded', (_name, input) => {
    expect(creditApplicationStageView(input).kind).toBe('degraded')
  })

  it('(4) total 12 — сам потолок ЗАКОНЕН: kind=server на двенадцать строк', () => {
    // Внутренняя сторона границы. Без неё подмена `>` на `>=` (или 12 на 11)
    // отрезала бы законный путь из двенадцати шагов и осталась зелёной.
    const view = creditApplicationStageView(
      withStage({ stage: 'twelfth', stage_index: 12, stage_total: CREDIT_MAX_STAGE_TOTAL })
    )
    expect(view.kind).toBe('server')
    if (view.kind !== 'server') return
    expect(view.rows).toHaveLength(12)
    expect(view.rows[11].number).toBe(12)
  })

  it('(4) total 13 выше потолка 12 — kind=degraded', () => {
    expect(
      creditApplicationStageView(withStage({ stage: 'decision', stage_index: 4, stage_total: 13 }))
        .kind
    ).toBe('degraded')
  })

  it('(5) total 6 длиннее перечня — kind=server на шесть строк, чужое имя не выдаётся за наше', () => {
    // Законное расширение пути: модуль вправе завести шестой этап. Потерять
    // ленту целиком здесь хуже, чем нарисовать шестую строку безымянной.
    const view = creditApplicationStageView(
      withStage({ stage: 'unknown_step', stage_index: 6, stage_total: 6 })
    )
    expect(view.kind).toBe('server')
    if (view.kind !== 'server') return
    expect(view.rows).toHaveLength(6)
    expect(view.rows[5]).toEqual({
      name: 'unknown_step',
      known: false,
      state: 'current',
      number: 6,
    })
    expect(view.rows.slice(0, 5).map((row) => row.name)).toEqual([...CREDIT_APPLICATION_STAGES])
  })

  it('(5) знакомое имя на ЧУЖОЙ позиции при total 6 — kind=degraded, а не расширение', () => {
    // `signing` вторым шагом из шести: правило 8 действует и в ветке
    // расширения. Иначе лента нарисовала бы «Підписання» дважды — на второй
    // строке как имя модуля и на пятой как наше по позиции.
    expect(
      creditApplicationStageView(withStage({ stage: 'signing', stage_index: 2, stage_total: 6 }))
        .kind
    ).toBe('degraded')
  })

  it('(5) ЧУЖОЕ имя на позиции внутри перечня при total 6 — имя модуля на текущей строке', () => {
    // Вторая половина исключения: столкнуться не с чем, имя модуля побеждает
    // наше по позиции, остальные строки остаются нашими.
    const view = creditApplicationStageView(
      withStage({ stage: 'bank_statement', stage_index: 3, stage_total: 6 })
    )
    expect(view.kind).toBe('server')
    if (view.kind !== 'server') return
    expect(view.rows[2]).toEqual({
      name: 'bank_statement',
      known: false,
      state: 'current',
      number: 3,
    })
    expect(view.rows[1].name).toBe('questionnaire')
    expect(view.rows[3].name).toBe('decision')
  })

  it('(5) знакомое имя на СВОЕЙ позиции при total 6 — хвост ленты без имени', () => {
    // Законный путь из шести этапов, клиент стоит на третьем: шестая строка
    // существует, но имени у неё нет — наш перечень заведомо короче.
    const view = creditApplicationStageView(
      withStage({ stage: 'income_check', stage_index: 3, stage_total: 6 })
    )
    expect(view.kind).toBe('server')
    if (view.kind !== 'server') return
    expect(view.rows).toHaveLength(6)
    expect(view.rows[5]).toEqual({ name: undefined, known: false, state: 'todo', number: 6 })
  })

  it('(6) total 4 короче перечня — kind=degraded (расхождение с витриной намеренное)', () => {
    // Витрина в этом случае рисует четыре строки и считает путь законным; CRM
    // уходит в деградацию — оператор не должен видеть нашу нумерацию поверх
    // чужого ответа. Расхождение названо в шапке applicationStages.ts.
    expect(
      creditApplicationStageView(
        withStage({ stage: 'income_check', stage_index: 3, stage_total: 4 })
      ).kind
    ).toBe('degraded')
  })

  it('(7) имя вне перечня при total 5 — kind=degraded, имя сохранено для экрана', () => {
    const view = creditApplicationStageView(
      withStage({ stage: 'bank_statement', stage_index: 3, stage_total: 5 })
    )
    expect(view.kind).toBe('degraded')
    if (view.kind !== 'degraded') return
    expect(view.stage).toBe('bank_statement')
    expect(view.known).toBe(false)
    expect(view.index).toBe(3)
    expect(view.total).toBe(5)
  })

  it('(7) имя с пробелами по краям — ЗНАКОМОЕ: нормализация одна на всё правило', () => {
    // ` decision ` от сериализатора или ручной правки на стенде — то же имя.
    // Без единой нормализации оно уехало бы в деградацию и показалось бы
    // оператору с пробелами по краям.
    const view = creditApplicationStageView(
      withStage({ stage: ' decision ', stage_index: 4, stage_total: 5 })
    )
    expect(view.kind).toBe('server')
    if (view.kind !== 'server') return
    expect(view.rows[3]).toEqual({ name: 'decision', known: true, state: 'current', number: 4 })
  })

  it('(8) индекс не равен позиции имени — kind=degraded (страж дрейфа перечней)', () => {
    // Сегодняшний модуль такого ответа НЕ даёт: `stage_index` он считает как
    // `APPLICATION_STAGES.index(stage) + 1`. Это страж будущего расхождения
    // перечней, а не наблюдаемое поведение, и на стенде эту сцену не построить.
    expect(
      creditApplicationStageView(withStage({ stage: 'decision', stage_index: 2, stage_total: 5 }))
        .kind
    ).toBe('degraded')
  })

  it('(9) полный непротиворечивый набор — kind=server на пять строк с нашими именами', () => {
    const view = creditApplicationStageView(
      withStage({ stage: 'decision', stage_index: 4, stage_total: 5 })
    )
    expect(view.kind).toBe('server')
    if (view.kind !== 'server') return
    expect(view.rows).toHaveLength(5)
    expect(view.index).toBe(4)
    expect(view.total).toBe(5)
    expect(view.rows.map((row) => row.name)).toEqual([...CREDIT_APPLICATION_STAGES])
    expect(view.rows.every((row) => row.known)).toBe(true)
    expect(view.rows.map((row) => row.state)).toEqual(['done', 'done', 'done', 'current', 'todo'])
  })

  it.each([
    ['declined', ['done', 'done', 'done', 'failed', 'todo']],
    ['contracted', ['done', 'done', 'done', 'done', 'todo']],
    ['disbursed', ['done', 'done', 'done', 'done', 'todo']],
    ['expired', ['done', 'done', 'done', 'todo', 'todo']],
    ['abandoned', ['done', 'done', 'done', 'todo', 'todo']],
    ['in_progress', ['done', 'done', 'done', 'current', 'todo']],
    ['approved', ['done', 'done', 'done', 'current', 'todo']],
  ] as const)(
    'состояния строк: терминальный статус решает НА ПОЗИЦИИ МОДУЛЯ (%s)',
    (status, expected) => {
      // `failed` садится на `stage_index`, а не на литеральную четвёртую
      // строку: на заявке, отказанной раньше, прибитый номер соврал бы.
      // ⚠️ У `contracted` здесь ПЯТАЯ строка `todo`, а не `done`: правило
      // позиционное, и «пять done» — факт о сегодняшнем ответе модуля
      // (`contracted` → `signing`, индекс 5), а не свойство разметки. Прибить
      // «всегда пять done» значило бы соврать о заявке, пришедшей с
      // `contracted` и меньшим индексом.
      const view = creditApplicationStageView(
        withStage({ status, stage: 'decision', stage_index: 4, stage_total: 5 })
      )
      expect(view.kind === 'server' && view.rows.map((row) => row.state)).toEqual(expected)
    }
  )
})

describe('serverStepState: статус, которого нет в таблице', () => {
  const base: CreditApplicationStageInput = { status: 'in_progress', missing_fields: [] }

  it.each([
    ['новый статус модуля', 'settlement_review'],
    ['статус не строкой вовсе', 42],
  ])('%s — на позиции модуля НЕ «поточний крок»', (_name, status) => {
    // Ветка по умолчанию `current` — ровно тот дефект, ради которого правило и
    // переносили в модуль: оператор читает «клиент сейчас здесь» о заявке,
    // которой, возможно, уже никто не занимается. Берём менее опасную из двух
    // неправд — «впереди».
    const view = creditApplicationStageView({
      ...base,
      status,
      stage: 'decision',
      stage_index: 4,
      stage_total: 5,
    } as unknown as CreditApplicationStageInput)
    expect(view.kind).toBe('server')
    if (view.kind !== 'server') return
    // «Не current» — ПЕРВЫМ: именно это утверждение краснеет своими словами,
    // называя строку, которую поставила ветка по умолчанию.
    expect(view.rows.map((row) => row.state)).not.toContain('current')
    expect(view.rows.map((row) => row.state)).toEqual(['done', 'done', 'done', 'todo', 'todo'])
  })
})

describe('creditStageLabelKey: ключ собирается только для своего имени', () => {
  it('перечень, по которому параметризован блок ниже, не опустел', () => {
    // Контроль от пустой/сокращённой выборки: `it.each` по самому перечню при
    // его опустошении выродился бы в ноль случаев и остался зелёным.
    expect(CREDIT_APPLICATION_STAGES).toHaveLength(5)
  })

  it.each([...CREDIT_APPLICATION_STAGES])('%s — ключ группы credit.stage', (stage) => {
    expect(creditStageLabelKey(stage)).toBe(`credit.stage.${stage}`)
  })

  it.each([
    ['прежнее имя этапа', 'bank'],
    ['имя из другого набора', 'bank_statement'],
    ['служебное слово, под которым в словаре есть ключ', 'unknown'],
    ['пустая строка', ''],
  ])('%s — null, а не чужой ключ', (_name, value) => {
    // В словаре законно может оказаться ключ с чужим именем, и оператор
    // прочёл бы служебную строку как название этапа. Пары `[описание, вход]`,
    // а не `%p`: спецификатор `%p` vitest не разбирает, и четыре случая
    // оказались бы в отчёте под одним нечитаемым именем.
    expect(creditStageLabelKey(value)).toBeNull()
  })

  it('имени нет — null', () => {
    expect(creditStageLabelKey(undefined)).toBeNull()
  })
})
