/**
 * Чтение разбора скоринга из снимка решения — `readScorecard`.
 *
 * Модель показа строится из снимка как записано модулем: фронт не пересчитывает
 * ни баллы, ни банд, ни суммы. Главное различие, которое защищают сцены, —
 * «не измерено» ≠ «нет»: неизмеренный признак машина отдала человеку, и
 * напечатать его «ні» значило бы соврать андеррайтеру о причине решения.
 */
import { describe, it, expect } from 'vitest'
import { bookLimitsOf, readScorecard, SCORECARD_BOOK_LIMITS } from '../scorecard'
import type { CreditDecisionSnapshot } from '../types'
import { PART_B_KEYS, SCENE_A, SCENE_B, SCENE_C, SCENE_D, withPartB } from './scorecardFixture'

/**
 * Версия книги, под которую фронт знает максимум суммы и число бандов, —
 * литерал конфига скоринга модуля: `service/src/credit_service/infra/seed.py`
 * модуля (`main` `86b22fed`) и все десять живых снимков DEV-приёмки 19-3
 * (`review/fe197/scorecard-snapshots.json`). Литералом, а не первым ключом
 * таблицы фронта: иначе K-11 сравнивал бы таблицу с ней самой. Имя проекта в
 * литерале — данные, а не объяснение прав: разрешение в `ALLOWED_PROJECT_MENTIONS`
 * стража `creditStaleStandTexts.test.ts`. Фикстура несёт синтетическую
 * `scorecard@1` — версию незнакомую.
 */
const KNOWN_SCORECARD_VERSION = 'fin-boost-scorecard-2026-09-28@1'
const withVersion = (snapshot: CreditDecisionSnapshot, version: string | null) => ({
  ...snapshot,
  scorecard: { ...snapshot.scorecard, version },
})

const view = (snapshot: CreditDecisionSnapshot) => {
  const read = readScorecard(snapshot)
  if (!read) throw new Error('разбор не прочитан: readScorecard вернул null на снимке со scorecard')
  return read
}
const row = (snapshot: CreditDecisionSnapshot, parameter: string) => {
  const found = view(snapshot).rows.find((item) => item.parameter === parameter)
  if (!found) throw new Error(`в разборе нет строки ${parameter}`)
  return found
}
/** Сцена A с правкой входа скоринга. */
const withInputs = (inputs: Record<string, unknown>): CreditDecisionSnapshot => ({
  ...SCENE_A,
  scorecard: { ...SCENE_A.scorecard, inputs: { ...SCENE_A.scorecard?.inputs, ...inputs } },
})

describe('readScorecard', () => {
  it('K-1: одобрение — восемь строк в порядке книги, баллы, сумма и банд как в снимке', () => {
    const read = view(withVersion(SCENE_A, KNOWN_SCORECARD_VERSION))
    expect(read.rows.map((item) => item.cell)).toEqual([
      'C13',
      'C14',
      'C15',
      'C16',
      'C17',
      'C18',
      'C19',
      'C20',
    ])
    expect(read.rows.map((item) => item.book)).toEqual([
      'Count NSF 90 Days',
      'Average Monthly Free Cash Flow',
      'Count Distinct Micro Lenders',
      'Count Days Negative Balance 90 Days',
      'Has Overdraft',
      'Active Days Trend Simple',
      'Account Age Days',
      'Employer Income Trend Simple',
    ])
    expect(Object.fromEntries(read.rows.map((item) => [item.parameter, item.points]))).toEqual(
      SCENE_A.scorecard?.points
    )
    expect(read.total).toBe(12)
    expect(read.maxTotal).toBe(13)
    expect(read.band).toBe(2)
    expect(read.bands).toBe(7)
    expect(read.declined).toBe(false)
    expect(read.version).toBe(KNOWN_SCORECARD_VERSION)
    expect([read.incomeClass, read.incomeClassSource]).toEqual(['A', 'both'])
  })

  it('K-10: версия книги незнакома или её нет — ни максимума суммы, ни числа бандов', () => {
    // Та же книга, следующая калибровка: константы листа могли измениться.
    // Унаследованные имена (`constructor`) держит K-12 — здесь их не видно:
    // у функции-конструктора нет полей `maxTotal` и `bands`.
    const next = KNOWN_SCORECARD_VERSION.replace(/\d{4}-\d{2}-\d{2}@\d+$/, '2027-01-01@2')
    expect(next).not.toBe(KNOWN_SCORECARD_VERSION)
    for (const version of [next, 'scorecard@1', null]) {
      const read = view(withVersion(SCENE_A, version))
      expect(
        [read.maxTotal, read.bands],
        `unknown scorecard version ${String(version)} got book limits`
      ).toEqual([null, null])
      // Сумма и банд — из снимка как есть, знаменатель не нужен им самим.
      expect([read.total, read.band]).toEqual([12, 2])
    }
  })

  it('K-11: таблица констант листа — ровно версия конфига скоринга модуля, 13 баллов и 7 бандов', () => {
    // Опечатка в ключе таблицы молча превращает боевую версию в незнакомую:
    // экран аудита теряет «з 13» и «з 7», и ни одна сцена фикстуры этого не
    // видит — фикстура несёт синтетическую версию.
    expect(
      Object.keys(SCORECARD_BOOK_LIMITS),
      "book limits table key differs from the module's scorecard version"
    ).toEqual([KNOWN_SCORECARD_VERSION])
    expect(SCORECARD_BOOK_LIMITS[KNOWN_SCORECARD_VERSION]).toEqual({ maxTotal: 13, bands: 7 })
  })

  it('K-12: версия ищется только среди собственных ключей таблицы — унаследованное имя не версия', () => {
    expect(bookLimitsOf(KNOWN_SCORECARD_VERSION)).toEqual({ maxTotal: 13, bands: 7 })
    expect(bookLimitsOf(null)).toBeNull()
    for (const inherited of ['constructor', 'toString']) {
      expect(
        bookLimitsOf(inherited),
        `inherited key resolved as a book version: ${inherited}`
      ).toBeNull()
    }
  })

  it('K-2: NSF 5 — отказ гейтом, банд 0, код AB-G-04, у C13 вход 5 и балл 0', () => {
    const read = view(SCENE_B)
    expect(read.declined).toBe(true)
    expect(read.band).toBe(0)
    expect(read.gate.codes).toEqual(['AB-G-04'])
    expect(read.gate.held).toEqual([])
    expect(row(SCENE_B, 'nsf_90d')).toMatchObject({
      input: { kind: 'count', value: 5 },
      points: 0,
    })
  })

  it('K-2: банд 0 без флага гейта — тоже отказ', () => {
    const snapshot: CreditDecisionSnapshot = {
      ...SCENE_B,
      scorecard: { ...SCENE_B.scorecard, gate: { codes: ['AB-G-04'] } },
    }
    expect(view(snapshot).declined).toBe(true)
  })

  it('K-3: класс B — C20 читает госдоход за 30 дней и называется строкой B11', () => {
    expect(row(SCENE_C, 'income_trend')).toMatchObject({
      cell: 'C20',
      book: 'B11 Has Government Income Last 30 Days',
      input: { kind: 'flag', value: false },
      points: 0,
    })
    expect(row(SCENE_D, 'income_trend')).toMatchObject({
      cell: 'C20',
      book: 'B11 Has Government Income Last 30 Days',
      input: { kind: 'flag', value: true },
      points: 1,
    })
  })

  it('K-3: класс A — C20 читает тренд дохода работодателя', () => {
    expect(row(SCENE_A, 'income_trend')).toMatchObject({
      cell: 'C20',
      book: 'Employer Income Trend Simple',
      input: { kind: 'trend', value: 'CONSISTENT' },
    })
  })

  it('K-4: вход null — «не измерено», а не «нет»', () => {
    const input = row(withInputs({ overdraft: null }), 'overdraft').input
    expect(input).toEqual({ kind: 'missing' })
    expect(input).not.toEqual({ kind: 'flag', value: false })
  })

  it('K-4: имя поля в inputs.missing — «не измерено», даже если значение есть', () => {
    const snapshot = withInputs({ missing: ['free_cash_flow_monthly_minor'] })
    expect(row(snapshot, 'free_cash_flow_monthly').input).toEqual({ kind: 'missing' })
  })

  it('K-4: отрицательный вільний потік — деньгами со знаком', () => {
    const snapshot = withInputs({ free_cash_flow_monthly_minor: -45 })
    expect(row(snapshot, 'free_cash_flow_monthly').input).toEqual({ kind: 'money', value: -45 })
  })

  it('K-4: виды входа сцены A — счёт, деньги, флаг, тренд, дни', () => {
    const inputs = Object.fromEntries(
      view(SCENE_A).rows.map((item) => [item.parameter, item.input])
    )
    expect(inputs).toEqual({
      nsf_90d: { kind: 'count', value: 0 },
      free_cash_flow_monthly: { kind: 'money', value: 26380 },
      micro_lenders: { kind: 'count', value: 0 },
      negative_balance_days_90d: { kind: 'count', value: 0 },
      overdraft: { kind: 'flag', value: false },
      active_days_trend: { kind: 'trend', value: 'CONSISTENT' },
      history_days: { kind: 'days', value: 1240 },
      income_trend: { kind: 'trend', value: 'CONSISTENT' },
    })
  })

  it('K-5: без ключа scorecard, при null и при строке — разбора нет', () => {
    expect(readScorecard(undefined)).toBeNull()
    expect(readScorecard({})).toBeNull()
    expect(readScorecard({ scorecard: null })).toBeNull()
    expect(
      readScorecard({ scorecard: 'scorecard' } as unknown as CreditDecisionSnapshot)
    ).toBeNull()
    // Класс дохода 19-2 без скоринга разбором не становится.
    expect(
      readScorecard({
        income_class: SCENE_A.income_class,
        income_class_source: SCENE_A.income_class_source,
        income_class_basis: SCENE_A.income_class_basis,
      })
    ).toBeNull()
  })

  it('K-5: в points нет history_days — строка на месте, балл null', () => {
    const points = { ...SCENE_A.scorecard?.points }
    delete points.history_days
    const snapshot: CreditDecisionSnapshot = {
      ...SCENE_A,
      scorecard: { ...SCENE_A.scorecard, points },
    }
    expect(row(snapshot, 'history_days')).toMatchObject({ cell: 'C19', points: null })
    expect(view(snapshot).rows).toHaveLength(8)
  })

  it('K-6: незнакомый параметр новой версии модуля — последней строкой с сырым именем', () => {
    const snapshot: CreditDecisionSnapshot = {
      ...SCENE_A,
      scorecard: { ...SCENE_A.scorecard, points: { ...SCENE_A.scorecard?.points, new_param: 1 } },
    }
    const rows = view(snapshot).rows
    expect(rows).toHaveLength(9)
    expect(rows[8]).toEqual({
      parameter: 'new_param',
      cell: null,
      book: null,
      points: 1,
      input: { kind: 'unknown' },
    })
  })

  it('K-7: без client_type блока суммы нет', () => {
    expect(view(SCENE_A).amount).toBeNull()
  })

  it('K-7: ключи 19-4 — суммы, тир и взносы как в снимке', () => {
    expect(view(withPartB()).amount).toEqual({
      clientType: PART_B_KEYS.client_type,
      closedLoans: 0,
      tier: { min: 10000, max: 30000, classBCap: false },
      scale: 20000,
      cap: 269200,
      rounded: 20000,
      final: 20000,
      installments: { min: null, max: 7 },
      codes: [],
    })
  })

  it('K-7: блок T не исполнялся — сумма null, а не 0', () => {
    const amount = view(
      withPartB({ final_amount_minor: null, rounded_amount_minor: null, installments: null })
    ).amount
    expect(amount?.final).toBeNull()
    expect(amount?.rounded).toBeNull()
    expect(amount?.installments).toBeNull()
  })

  it('K-8: основание класса — без сумм пособий и без перечня неизмеренного', () => {
    const snapshot = {
      ...SCENE_C,
      income_class_basis: {
        ...SCENE_C.income_class_basis,
        // Синтетические суммы: в модели их быть не должно ни при каком снимке.
        amounts: { sum_pension_income: 1000, sum_disability_income: 2000 },
        missing: ['sum_wsib_income'],
        employment_status_known: false,
      },
    } as CreditDecisionSnapshot
    const basis = view(snapshot).basis
    expect(basis).not.toBeNull()
    expect(Object.keys(basis ?? {}).sort()).toEqual([
      'bNotConfirmed',
      'declaredClass',
      'employmentStatus',
      'employmentStatusKnown',
      'evidence',
    ])
    expect(JSON.stringify(basis)).not.toContain('1000')
    expect(basis?.employmentStatusKnown).toBe(false)
    expect(basis).toMatchObject({
      declaredClass: 'B',
      employmentStatus: 'pension',
      bNotConfirmed: true,
      evidence: [
        { signal: 'employer_income_30d', value: true },
        { signal: 'b_income', value: false },
        { signal: 'c_income', value: false },
      ],
    })
  })

  it('K-9: удержанные коды и причины разбора — отдельно от применённых', () => {
    const read = view(SCENE_C)
    expect(read.gate).toEqual({
      decline: false,
      codes: [],
      held: ['AB-G-03'],
      review: ['income_class_b_not_confirmed'],
    })
    expect(read.declined).toBe(false)
  })

  it('K-9: сигналы гейта — три, в порядке книги; неизмеренный — null', () => {
    expect(view(SCENE_A).gateSignals).toEqual([
      { signal: 'employer_income_30d', value: true },
      { signal: 'employment_loss', value: false },
      { signal: 'government_income_30d', value: false },
    ])
    const unmeasured = withInputs({ employer_income_30d: null, missing: ['employment_loss'] })
    expect(view(unmeasured).gateSignals.map((item) => item.value)).toEqual([null, null, false])
  })
})
