import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ATTENTION_MARKER,
  ATTENTION_OPACITY,
  attentionBackground,
  buildTableHighlightPlan,
  cellHeatRatio,
  heatBackground,
  HEAT_COLOR_TOKEN,
  isAssistantReportTablesEnabled,
  isAttentionCell,
  isConclusionParagraph,
  MAX_HEAT_OPACITY,
  MIN_HEAT_OPACITY,
  parseNumericCell,
  REPORT_TABLES_FLAG,
} from '../reportTableHighlight'

describe('parseNumericCell — украинские форматы чисел', () => {
  it.each([
    ['1 209 239.06', 1209239.06],
    ['1 209 239,06', 1209239.06],
    ['1\u00a0209\u00a0239,06', 1209239.06],
    ['1\u202f209\u202f239', 1209239],
    ['48 750,50 грн', 48750.5],
    ['340 236 ₴', 340236],
    ['12,5%', 12.5],
    ['351', 351],
    ['0', 0],
    ['0,75', 0.75],
    ['-1 234', -1234],
    ['−1 234', -1234],
    ['+18', 18],
    ['1,234,567.89', 1234567.89],
    ['7273 шт.', 7273],
    ['92 осіб', 92],
    ['12\u2009500', 12500],
  ])('разбирает %s → %s', (raw, expected) => {
    expect(parseNumericCell(raw)).toBe(expected)
  })

  it.each([
    ['Петренко О. П.'],
    [''],
    ['   '],
    ['—'],
    ['24.08.2026'],
    ['09:14'],
    ['0671234567'],
    ['+380671234567'],
    ['KAN-1006'],
    ['1 209 239,06 грн на 20.08'],
    ['10/20'],
  ])('не разбирает %s', (raw) => {
    expect(parseNumericCell(raw)).toBeNull()
  })

  it('игнорирует ведущий маркер внимания — ячейка остаётся числовой', () => {
    expect(parseNumericCell(`${ATTENTION_MARKER} 1 209 239,06`)).toBe(1209239.06)
    expect(parseNumericCell('⚠ 512')).toBe(512)
  })
})

describe('isAttentionCell', () => {
  it('видит маркер в начале ячейки', () => {
    expect(isAttentionCell(`${ATTENTION_MARKER} Коваль`)).toBe(true)
    expect(isAttentionCell('⚠Коваль')).toBe(true)
    expect(isAttentionCell(`  ${ATTENTION_MARKER}  0 домовленостей`)).toBe(true)
  })

  it('не реагирует на маркер в середине или на его отсутствие', () => {
    expect(isAttentionCell(`Коваль ${ATTENTION_MARKER}`)).toBe(false)
    expect(isAttentionCell('Коваль')).toBe(false)
    expect(isAttentionCell('')).toBe(false)
  })
})

describe('buildTableHighlightPlan — градиент только числовым колонкам', () => {
  it('берёт колонку сумм и не берёт колонку имён', () => {
    const plan = buildTableHighlightPlan([
      ['Петренко', '1 209 239,06'],
      ['Коваль', '12 500'],
      ['Шевченко', '340 236'],
    ])

    expect([...plan.columns.keys()]).toEqual([1])
    expect(plan.columns.get(1)).toMatchObject({ index: 1, min: 12500, max: 1209239.06 })
  })

  it('берёт колонку с 70% чисел и отбрасывает колонку с 60%', () => {
    const seventy = buildTableHighlightPlan([
      ['1'],
      ['2'],
      ['3'],
      ['4'],
      ['5'],
      ['6'],
      ['7'],
      ['н/д'],
      ['н/д'],
      ['н/д'],
    ])
    expect(seventy.columns.has(0)).toBe(true)

    const sixty = buildTableHighlightPlan([
      ['1'],
      ['2'],
      ['3'],
      ['4'],
      ['5'],
      ['6'],
      ['н/д'],
      ['н/д'],
      ['н/д'],
      ['н/д'],
    ])
    expect(sixty.columns.has(0)).toBe(false)
  })

  it('пустые ячейки не считаются в знаменателе доли', () => {
    const plan = buildTableHighlightPlan([['10'], [''], ['   '], ['20']])
    expect(plan.columns.has(0)).toBe(true)
  })

  it('не подсвечивает колонку из одинаковых значений (шкала вырождена)', () => {
    const plan = buildTableHighlightPlan([['100'], ['100'], ['100']])
    expect(plan.columns.size).toBe(0)
  })

  it('не подсвечивает колонку дат и колонку телефонов', () => {
    const plan = buildTableHighlightPlan([
      ['19.08.2026', '0671234567'],
      ['20.08.2026', '0509876543'],
      ['21.08.2026', '0931112233'],
    ])
    expect(plan.columns.size).toBe(0)
  })

  it('собирает строки с маркером внимания по их индексу', () => {
    const plan = buildTableHighlightPlan([
      ['Петренко', '350'],
      [`${ATTENTION_MARKER} Коваль`, '0'],
      ['Шевченко', '120'],
    ])
    expect([...plan.attentionRows]).toEqual([1])
  })

  it('маркер в числовой ячейке не выбивает колонку из числовых', () => {
    const plan = buildTableHighlightPlan([
      ['Петренко', '350'],
      ['Коваль', `${ATTENTION_MARKER} 0`],
      ['Шевченко', '120'],
    ])
    expect(plan.columns.has(1)).toBe(true)
    expect(plan.attentionRows.has(1)).toBe(true)
  })

  it('на пустой таблице возвращает пустой план', () => {
    const plan = buildTableHighlightPlan([])
    expect(plan.columns.size).toBe(0)
    expect(plan.attentionRows.size).toBe(0)
  })
})

describe('cellHeatRatio / heatBackground', () => {
  const column = { index: 0, min: 100, max: 300 }

  it('раскладывает значение по шкале колонки', () => {
    expect(cellHeatRatio(100, column)).toBe(0)
    expect(cellHeatRatio(200, column)).toBe(0.5)
    expect(cellHeatRatio(300, column)).toBe(1)
  })

  it('зажимает выход за шкалу в 0..1', () => {
    expect(cellHeatRatio(-50, column)).toBe(0)
    expect(cellHeatRatio(9000, column)).toBe(1)
  })

  it('красит спокойным нейтральным токеном с ростом непрозрачности', () => {
    expect(heatBackground(0)).toBe(
      `color-mix(in srgb, var(${HEAT_COLOR_TOKEN}) ${MIN_HEAT_OPACITY.toFixed(1)}%, transparent)`
    )
    expect(heatBackground(1)).toBe(
      `color-mix(in srgb, var(${HEAT_COLOR_TOKEN}) ${MAX_HEAT_OPACITY.toFixed(1)}%, transparent)`
    )
  })

  it('масштабная заливка не использует тёплых токенов (тепло = только проблема)', () => {
    // Решение CEO 24.08: масштаб чисел — нейтрально; тёплое остаётся у «⚠️».
    for (const ratio of [0, 0.25, 0.5, 0.75, 1]) {
      const bg = heatBackground(ratio)
      expect(bg).not.toMatch(/warning|error|amber|orange|yellow|red/i)
      expect(bg).toContain(HEAT_COLOR_TOKEN)
    }
  })

  it('интенсивность масштаба снижена — потолок не выше 10%', () => {
    expect(MAX_HEAT_OPACITY).toBeLessThanOrEqual(10)
    expect(MIN_HEAT_OPACITY).toBeLessThan(MAX_HEAT_OPACITY)
  })
})

describe('attentionBackground — единственный тёплый сигнал', () => {
  it('строка «⚠️» остаётся янтарной на warning-токене', () => {
    expect(attentionBackground()).toBe(
      `color-mix(in srgb, var(--color-warning-400) ${ATTENTION_OPACITY}%, transparent)`
    )
    expect(attentionBackground()).toContain('--color-warning-400')
  })
})

describe('isConclusionParagraph', () => {
  it.each([
    'Висновок: сума домовленостей впала на 18%.',
    'висновки: дивись рядки з ⚠️.',
    'Підсумок: план виконано.',
    'Вывод: платежи за выходные догрузятся в понедельник.',
  ])('видит лид-вывод в «%s»', (text) => {
    expect(isConclusionParagraph(text)).toBe(true)
  })

  it.each(['Звичайний абзац відповіді.', 'Висновок без двокрапки', 'У висновку сказано:'])(
    'не трогает «%s»',
    (text) => {
      expect(isConclusionParagraph(text)).toBe(false)
    }
  )
})

describe('isAssistantReportTablesEnabled — флаг по умолчанию выключен', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('без переменной окружения — выключено', () => {
    expect(isAssistantReportTablesEnabled()).toBe(false)
  })

  it.each(['false', '0', '', 'yes'])('значение «%s» не включает фичу', (value) => {
    vi.stubEnv(REPORT_TABLES_FLAG, value)
    expect(isAssistantReportTablesEnabled()).toBe(false)
  })

  it.each(['true', '1'])('значение «%s» включает фичу', (value) => {
    vi.stubEnv(REPORT_TABLES_FLAG, value)
    expect(isAssistantReportTablesEnabled()).toBe(true)
  })
})
