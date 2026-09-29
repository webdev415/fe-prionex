/**
 * «Розбір скорингу» на вкладке решения — компонент напрямую.
 *
 * Снимки — срез живых решений DEV-приёмки 19-3 (`scorecardFixture.ts`), тексты
 * кодов гейта — срез реестра модуля. Мок `t` печатает ключ и подстановки: так
 * видно, ЧТО ушло в строку, а не только что строка есть.
 */
import type { ReactNode } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { CreditScorecardBreakdown } from '../components/CreditScorecardBreakdown'
import { indexDecisionCodes } from '@/features/credit/api/decisionCodes'
import { formatCreditMoney } from '@/features/credit/api/money'
import type { CreditDecisionSnapshot } from '@/features/credit/api/types'
import { DECISION_CODES_FIXTURE } from '@/features/credit/api/__tests__/decisionCodesFixture'
import {
  SCENE_A,
  SCENE_B,
  SCENE_C,
  SCENE_E,
  SCORECARD_REGISTRY_FIXTURE,
  withPartB,
} from '@/features/credit/api/__tests__/scorecardFixture'

// Тот же мок, что у теста страницы: ключ с подстановками, `defaultValue` —
// только когда строки нет ни в словаре языка, ни в запасном `en`. Строка вторым
// аргументом — тот же `defaultValue`, как у i18next (`t(key, 'запасное')`).
vi.mock('react-i18next', async () => {
  const dictionaries: Record<string, unknown> = {
    uk: (await import('@/../public/locales/uk/common.json')).default,
    en: (await import('@/../public/locales/en/common.json')).default,
  }
  const has = (dictionary: unknown, key: string) =>
    typeof key
      .split('.')
      .reduce<unknown>(
        (node, part) =>
          node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
        dictionary
      ) === 'string'
  const print = (key: string, vars: Record<string, unknown>) =>
    `${key} ${Object.entries(vars)
      .map(([name, value]) => `${name}=${String(value)}`)
      .join(' ')}`
  return {
    useTranslation: () => ({
      t: (key: string, options?: Record<string, unknown> | string) => {
        const vars = typeof options === 'string' ? { defaultValue: options } : options
        if (!vars || typeof vars !== 'object') return key
        if (!('defaultValue' in vars)) return print(key, vars)
        const { defaultValue, ...rest } = vars
        if (!has(dictionaries.uk, key) && !has(dictionaries.en, key)) return String(defaultValue)
        return Object.keys(rest).length ? print(key, rest) : key
      },
      i18n: { language: 'uk', changeLanguage: vi.fn() },
    }),
    I18nextProvider: ({ children }: { children: ReactNode }) => children,
    initReactI18next: { type: '3rdParty', init: vi.fn() },
  }
})

const GATE_CODES = indexDecisionCodes(SCORECARD_REGISTRY_FIXTURE)
const gateEntry = (id: string) => {
  const found = SCORECARD_REGISTRY_FIXTURE.codes.find((entry) => entry.id === id)
  if (!found) throw new Error(`срез реестра не несёт ${id}`)
  return found
}

/**
 * `null` — справочника нет (у роли нет права, запрос не пришёл). Не `undefined`:
 * явный `undefined` включил бы значение по умолчанию, и сцена «без справочника»
 * молча получила бы справочник.
 */
function renderBreakdown(
  snapshot: CreditDecisionSnapshot | undefined,
  directory: ReturnType<typeof indexDecisionCodes> | null = GATE_CODES
) {
  return render(
    <CreditScorecardBreakdown
      snapshot={snapshot}
      currency="CAD"
      directory={directory ?? undefined}
      language="uk"
    />
  )
}

const text = (node: Element) => (node.textContent ?? '').replace(/\s+/g, ' ').trim()
/** Значение ряда панели по его подписи: подпись и значение — соседи в одном ряду. */
const valueOfRow = (label: string) => {
  const value = screen.getByText(label).nextElementSibling
  if (!value) throw new Error(`у подписи ${label} нет значения`)
  return text(value)
}
const tableRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1)
const valueOf = (cell: string) => {
  const found = tableRows().find((tr) => text(tr).includes(cell))
  if (!found) throw new Error(`в таблице нет строки ${cell}`)
  return text(within(found).getAllByRole('cell')[1])
}

describe('CreditScorecardBreakdown', () => {
  it('B-1: одобрение — шапка, восемь строк C13…C20, сумма, банд, гейт пройден; блока суммы нет', () => {
    renderBreakdown(SCENE_A, indexDecisionCodes(DECISION_CODES_FIXTURE))
    expect(screen.getByRole('heading', { name: 'credit.scorecard.title' })).toBeInTheDocument()
    expect(valueOfRow('credit.scorecard.version')).toContain('scorecard@1')
    expect(valueOfRow('credit.scorecard.incomeClass')).toContain(
      'credit.incomeClass.A · credit.incomeClassSource.both'
    )
    const rows = tableRows()
    expect(rows).toHaveLength(8)
    expect(rows.map((tr) => /C\d\d/.exec(text(tr))?.[0])).toEqual([
      'C13',
      'C14',
      'C15',
      'C16',
      'C17',
      'C18',
      'C19',
      'C20',
    ])
    expect(text(rows[0])).toContain('credit.scorecardParameter.nsf_90d')
    expect(text(rows[0])).toContain('C13 · Count NSF 90 Days')
    expect(valueOf('C14')).toBe(formatCreditMoney(26380, 'CAD'))
    expect(valueOf('C17')).toBe('credit.scorecard.no')
    expect(valueOf('C18')).toBe('credit.balanceTrend.CONSISTENT')
    expect(valueOf('C19')).toBe('credit.card.days count=1240')
    expect(valueOfRow('credit.scorecard.total')).toContain(
      'credit.scorecard.totalValue total=12 max=13'
    )
    expect(valueOfRow('credit.scorecard.band')).toContain('credit.scorecard.bandValue band=2')
    expect(valueOfRow('credit.scorecard.gate')).toContain('credit.scorecard.gatePass')
    expect(screen.queryByText('credit.scorecard.gateCodes')).toBeNull()
    expect(screen.queryByText('credit.scorecard.amountTitle')).toBeNull()
  })

  it('B-2: отказ AB-G-04 — банд 0, гейт «Відмова», код текстом книги и «книга: О-22»', () => {
    renderBreakdown(SCENE_B)
    expect(valueOfRow('credit.scorecard.band')).toContain('credit.scorecard.bandDeclined')
    expect(screen.queryByText(/credit\.scorecard\.bandValue/)).toBeNull()
    expect(valueOfRow('credit.scorecard.gate')).toContain('credit.scorecard.gateDecline')
    const codes = valueOfRow('credit.scorecard.gateCodes')
    expect(codes).toContain('AB-G-04')
    expect(codes).toContain(gateEntry('AB-G-04').ru)
    expect(codes).toContain('credit.scorecard.bookCode code=О-22')
    expect(valueOf('C13')).toBe('5')
  })

  it('B-2: банд 0 без флага гейта — тоже отказ: банд «0 — відмова», гейт «Відмова»', () => {
    renderBreakdown({
      ...SCENE_B,
      scorecard: { ...SCENE_B.scorecard, gate: { codes: ['AB-G-04'] } },
    })
    expect(valueOfRow('credit.scorecard.band')).toBe('credit.scorecard.bandDeclined')
    expect(valueOfRow('credit.scorecard.gate')).toBe('credit.scorecard.gateDecline')
  })

  it('B-3: разбор — гейт «Утримано», удержанный код отдельной строкой, причина словами, признак банка «ні»', () => {
    renderBreakdown(SCENE_C)
    const held = valueOfRow('credit.scorecard.gateHeld')
    expect(held).toContain('AB-G-03')
    expect(held).toContain(gateEntry('AB-G-03').ru)
    expect(screen.queryByText('credit.scorecard.gateCodes')).toBeNull()
    expect(valueOfRow('credit.scorecard.gateReview')).toBe(
      'credit.referralReason.income_class_b_not_confirmed'
    )
    // Гейт сработал, отказ отложен до человека: не «Пройдено» и не «Відмова».
    expect(valueOfRow('credit.scorecard.gate')).toBe('credit.scorecard.gateHeldVerdict')
    expect(screen.getByText('credit.scorecard.bNotConfirmed')).toBeInTheDocument()
    expect(valueOfRow('credit.scorecard.evidence')).toContain(
      'credit.scorecardSignal.b_income: credit.scorecard.no'
    )
  })

  it('B-3: гейт не отказал и ничего не удержал — «Пройдено», даже при причине разбора', () => {
    renderBreakdown({
      ...SCENE_C,
      scorecard: { ...SCENE_C.scorecard, gate: { ...SCENE_C.scorecard?.gate, held: [] } },
    })
    expect(valueOfRow('credit.scorecard.gate')).toBe('credit.scorecard.gatePass')
    expect(screen.queryByText('credit.scorecard.gateHeld')).toBeNull()
    expect(valueOfRow('credit.scorecard.gateReview')).toBe(
      'credit.referralReason.income_class_b_not_confirmed'
    )
  })

  it('B-3: две причины разбора — через « · »', () => {
    renderBreakdown({
      ...SCENE_C,
      scorecard: {
        ...SCENE_C.scorecard,
        gate: {
          ...SCENE_C.scorecard?.gate,
          review: ['income_class_b_not_confirmed', 'scorecard_input_missing'],
        },
      },
    })
    expect(valueOfRow('credit.scorecard.gateReview')).toBe(
      'credit.referralReason.income_class_b_not_confirmed · credit.referralReason.scorecard_input_missing'
    )
  })

  it('B-4: неизмеренный овердрафт — «не виміряно», а не «ні»', () => {
    const scorecard = SCENE_A.scorecard
    renderBreakdown({
      ...SCENE_A,
      scorecard: {
        ...scorecard,
        inputs: { ...scorecard?.inputs, overdraft: null, missing: ['overdraft'] },
        points: { ...scorecard?.points, overdraft: 0 },
      },
    })
    expect(valueOf('C17')).toBe('credit.scorecard.notMeasured')
    expect(valueOf('C17')).not.toBe('credit.scorecard.no')
  })

  it('B-4: неизмеренный сигнал гейта — «не виміряно»', () => {
    const scorecard = SCENE_A.scorecard
    renderBreakdown({
      ...SCENE_A,
      scorecard: { ...scorecard, inputs: { ...scorecard?.inputs, employer_income_30d: null } },
    })
    expect(valueOfRow('credit.scorecard.gateSignals')).toContain(
      'credit.scorecardSignal.employer_income_30d: credit.scorecard.notMeasured'
    )
  })

  it('B-5: без scorecard — ничего, ни заголовка, ни пустой таблицы', () => {
    const { container } = renderBreakdown({
      income_class: 'A',
      income_class_source: 'both',
      income_class_basis: SCENE_A.income_class_basis,
    })
    expect(container).toBeEmptyDOMElement()
  })

  it('B-6: часть B — тип клиента, лимиты тира деньгами, «до 7 внесків», нерасчитанная сумма', () => {
    renderBreakdown(withPartB({ final_amount_minor: null }))
    expect(
      screen.getByRole('heading', { name: 'credit.scorecard.amountTitle' })
    ).toBeInTheDocument()
    expect(valueOfRow('credit.scorecard.clientType')).toContain(
      'credit.scorecard.clientTypeValue type=1 closed=0'
    )
    expect(valueOfRow('credit.scorecard.tier')).toContain(
      `${formatCreditMoney(10000, 'CAD')} – ${formatCreditMoney(30000, 'CAD')}`
    )
    expect(valueOfRow('credit.scorecard.tier')).not.toContain('credit.scorecard.classBCap')
    expect(valueOfRow('credit.scorecard.scale')).toContain(formatCreditMoney(20000, 'CAD'))
    expect(valueOfRow('credit.scorecard.cap')).toContain(formatCreditMoney(269200, 'CAD'))
    expect(valueOfRow('credit.scorecard.final')).toContain('credit.scorecard.notComputed')
    expect(valueOfRow('credit.scorecard.final')).not.toContain(formatCreditMoney(0, 'CAD'))
    expect(valueOfRow('credit.scorecard.installments')).toContain(
      'credit.scorecard.installmentsUpTo max=7'
    )
    expect(screen.queryByText('credit.scorecard.decisionCodes')).toBeNull()
  })

  it('B-6: взносы оба null или их нет, тира нет — «не розраховувалось», а не прочерк', () => {
    const { unmount } = renderBreakdown(
      withPartB({ installments: { min: null, max: null }, tier: null })
    )
    expect(valueOfRow('credit.scorecard.installments')).toBe('credit.scorecard.notComputed')
    expect(valueOfRow('credit.scorecard.tier')).toBe('credit.scorecard.notComputed')
    unmount()

    renderBreakdown(withPartB({ installments: null }))
    expect(valueOfRow('credit.scorecard.installments')).toBe('credit.scorecard.notComputed')
  })

  it('B-6: отказ суммой — AB-G-06 в кодах машины текстом книги и «книга: О-01»; класс B со стелей', () => {
    renderBreakdown(
      withPartB({
        codes: ['AB-G-06'],
        tier: { min_minor: 10000, max_minor: 40000, class_b_cap_applied: true },
        installments: { min: 4, max: 7 },
      })
    )
    const codes = valueOfRow('credit.scorecard.decisionCodes')
    expect(codes).toContain('AB-G-06')
    expect(codes).toContain(gateEntry('AB-G-06').ru)
    expect(codes).toContain('credit.scorecard.bookCode code=О-01')
    expect(valueOfRow('credit.scorecard.tier')).toContain('credit.scorecard.classBCap')
    expect(valueOfRow('credit.scorecard.installments')).toContain(
      'credit.scorecard.installmentsRange min=4 max=7'
    )
  })

  it('B-7: справочника нет (нет права) — коды одним id, панель цела', () => {
    renderBreakdown(SCENE_B, null)
    expect(valueOfRow('credit.scorecard.gateCodes')).toBe('AB-G-04')
    expect(screen.getByRole('heading', { name: 'credit.scorecard.title' })).toBeInTheDocument()
  })

  it('B-8: статус анкеты не из списка — приписка; disability — словами; null — прочерк', () => {
    const basis = SCENE_C.income_class_basis
    const { unmount } = renderBreakdown({
      ...SCENE_C,
      income_class_basis: {
        ...basis,
        employment_status: 'retired_early',
        employment_status_known: false,
      },
    })
    // Строки в словаре нет — сырое значение, как покажет i18next, а не ключ.
    expect(valueOfRow('credit.scorecard.employmentStatus')).toBe(
      'retired_early · credit.scorecard.employmentStatusUnknown'
    )
    unmount()

    const second = renderBreakdown({
      ...SCENE_C,
      income_class_basis: { ...basis, employment_status: 'disability' },
    })
    expect(valueOfRow('credit.scorecard.employmentStatus')).toBe('credit.employment.disability')
    expect(screen.getByText('credit.scorecard.bNotConfirmed')).toBeInTheDocument()
    second.unmount()

    renderBreakdown({
      ...SCENE_C,
      income_class_basis: { ...basis, employment_status: null },
    })
    const empty = valueOfRow('credit.scorecard.employmentStatus')
    expect(empty).toBe('—')
    expect(empty).not.toContain('credit.employment.null')
  })

  it('B-9: значение вне словаря (новая версия модуля) — сырым значением, а не машинным ключом', () => {
    const scorecard = SCENE_A.scorecard
    renderBreakdown({
      ...SCENE_A,
      scorecard: {
        ...scorecard,
        income_class_source: 'unlisted_source',
        inputs: { ...scorecard?.inputs, active_days_trend: 'UNLISTED_TREND' },
        gate: { ...scorecard?.gate, review: ['unlisted_reason'] },
      },
    })
    expect(valueOf('C18')).toBe('UNLISTED_TREND')
    expect(valueOfRow('credit.scorecard.incomeClass')).toBe(
      'credit.incomeClass.A · unlisted_source'
    )
    expect(valueOfRow('credit.scorecard.gateReview')).toBe('unlisted_reason')
  })

  it('B-10: сцена E — класс по анкете не назван (прочерк), итоговый A по данным банка', () => {
    renderBreakdown(SCENE_E)
    expect(valueOfRow('credit.scorecard.declaredClass')).toBe('—')
    expect(valueOfRow('credit.scorecard.incomeClass')).toBe(
      'credit.incomeClass.A · credit.incomeClassSource.flinks'
    )
    expect(valueOfRow('credit.scorecard.employmentStatus')).toBe('credit.employment.student')
    expect(valueOfRow('credit.scorecard.gate')).toBe('credit.scorecard.gatePass')
  })
})
