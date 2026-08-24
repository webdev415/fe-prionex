import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ATTENTION_MARKER,
  BAD_MARKER,
  buildTableHighlightPlan,
  cellHeatRatio,
  cellRowMarker,
  GOOD_MARKER,
  heatBackground,
  HEAT_COLOR_TOKEN,
  isAssistantReportTablesEnabled,
  isAttentionCell,
  isConclusionParagraph,
  MARKER_STYLE,
  markerBackground,
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

  it('игнорирует любой ведущий маркер-«светофор» — ячейка остаётся числовой', () => {
    expect(parseNumericCell(`${ATTENTION_MARKER} 1 209 239,06`)).toBe(1209239.06)
    expect(parseNumericCell('⚠ 512')).toBe(512)
    expect(parseNumericCell(`${BAD_MARKER} 0`)).toBe(0)
    expect(parseNumericCell(`${GOOD_MARKER} 1 500 000`)).toBe(1500000)
  })
})

describe('cellRowMarker — тип ведущего маркера-«светофора»', () => {
  it('различает ⚠️ / 🔴 / 🟢 в начале ячейки', () => {
    expect(cellRowMarker(`${ATTENTION_MARKER} Коваль`)).toBe('attention')
    expect(cellRowMarker(`${BAD_MARKER} 0 домовленостей`)).toBe('bad')
    expect(cellRowMarker(`${GOOD_MARKER} 1 500 000`)).toBe('good')
  })

  it('видит маркер и без вариационного селектора, и с пробелами', () => {
    expect(cellRowMarker('⚠Коваль')).toBe('attention')
    expect(cellRowMarker(`  ${BAD_MARKER}  просадка`)).toBe('bad')
  })

  it('не реагирует на маркер в середине или на его отсутствие', () => {
    expect(cellRowMarker(`Коваль ${ATTENTION_MARKER}`)).toBeNull()
    expect(cellRowMarker(`сума ${BAD_MARKER}`)).toBeNull()
    expect(cellRowMarker('Коваль')).toBeNull()
    expect(cellRowMarker('')).toBeNull()
  })
})

describe('isAttentionCell — совместимость (только ⚠️)', () => {
  it('видит только маркер внимания, не 🔴/🟢', () => {
    expect(isAttentionCell(`${ATTENTION_MARKER} Коваль`)).toBe(true)
    expect(isAttentionCell('⚠Коваль')).toBe(true)
    expect(isAttentionCell(`${BAD_MARKER} 0`)).toBe(false)
    expect(isAttentionCell(`${GOOD_MARKER} 1 500 000`)).toBe(false)
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

  it('собирает строки с маркерами по индексу и типу «светофора»', () => {
    const plan = buildTableHighlightPlan([
      ['Петренко', '350'],
      [`${ATTENTION_MARKER} Коваль`, '0'],
      [`${BAD_MARKER} Шевченко`, '0'],
      [`${GOOD_MARKER} Ткаченко`, '900'],
    ])
    expect([...plan.markerRows.entries()]).toEqual([
      [1, 'attention'],
      [2, 'bad'],
      [3, 'good'],
    ])
  })

  it('при нескольких маркерах в строке побеждает худший (плохо > внимание > хорошо)', () => {
    const plan = buildTableHighlightPlan([
      [`${GOOD_MARKER} Петренко`, `${BAD_MARKER} 0`],
      [`${GOOD_MARKER} Коваль`, `${ATTENTION_MARKER} 50`],
    ])
    expect(plan.markerRows.get(0)).toBe('bad')
    expect(plan.markerRows.get(1)).toBe('attention')
  })

  it('маркер в числовой ячейке не выбивает колонку из числовых', () => {
    const plan = buildTableHighlightPlan([
      ['Петренко', '350'],
      ['Коваль', `${BAD_MARKER} 0`],
      ['Шевченко', '120'],
    ])
    expect(plan.columns.has(1)).toBe(true)
    expect(plan.markerRows.get(1)).toBe('bad')
  })

  it('на пустой таблице возвращает пустой план', () => {
    const plan = buildTableHighlightPlan([])
    expect(plan.columns.size).toBe(0)
    expect(plan.markerRows.size).toBe(0)
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

  it('красит зелёным (success) токеном с ростом непрозрачности', () => {
    expect(heatBackground(0)).toBe(
      `color-mix(in srgb, var(${HEAT_COLOR_TOKEN}) ${MIN_HEAT_OPACITY.toFixed(1)}%, transparent)`
    )
    expect(heatBackground(1)).toBe(
      `color-mix(in srgb, var(${HEAT_COLOR_TOKEN}) ${MAX_HEAT_OPACITY.toFixed(1)}%, transparent)`
    )
  })

  it('авто-градиент — зелёный (success), а не тёплый и не красный', () => {
    // Светофор: масштаб = зелёная гамма; тёплое (внимание) и красное (плохо) —
    // только у маркеров строк, а не у авто-градиента.
    expect(HEAT_COLOR_TOKEN).toContain('success')
    for (const ratio of [0, 0.25, 0.5, 0.75, 1]) {
      const bg = heatBackground(ratio)
      expect(bg).not.toMatch(/warning|error|amber|orange|yellow|red/i)
      expect(bg).toContain(HEAT_COLOR_TOKEN)
    }
  })
})

describe('markerBackground — фон строки по «светофору»', () => {
  it('внимание = жёлтый (warning), плохо = красный (error), хорошо = зелёный (success)', () => {
    expect(markerBackground('attention')).toBe(
      `color-mix(in srgb, var(--color-warning-400) ${MARKER_STYLE.attention.opacity}%, transparent)`
    )
    expect(markerBackground('bad')).toContain('--color-error-500')
    expect(markerBackground('good')).toContain('--color-success-500')
  })

  it('красный не путается с зелёным, «хорошо» плотнее авто-градиента', () => {
    expect(markerBackground('bad')).not.toMatch(/success|warning/)
    expect(markerBackground('good')).not.toMatch(/error|warning/)
    // «Хорошо» — усиленный зелёный: заметно плотнее потолка авто-градиента.
    expect(MARKER_STYLE.good.opacity).toBeGreaterThan(MAX_HEAT_OPACITY)
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
