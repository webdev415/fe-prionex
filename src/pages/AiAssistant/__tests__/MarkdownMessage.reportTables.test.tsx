import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MarkdownMessage, MUTED_CITATION_CLASS } from '../MarkdownMessage'
import { REPORT_TABLES_FLAG } from '../reportTableHighlight'

/** Отчёт «как из ассистента»: числовая колонка, строка-аномалия и вывод. */
const REPORT_MD = [
  '| Оператор | Сума |',
  '| --- | --- |',
  '| Петренко | 1 209 239,06 |',
  '| ⚠️ Коваль | 12 500 |',
  '',
  'Висновок: середній чек виріс.',
].join('\n')

/**
 * Разметка того же отчёта ДО доработки (снята с origin/development).
 * Атрибут `node="[object Object]"` на `<table>` — давняя особенность
 * react-markdown c `passNode`, и она тоже должна остаться нетронутой.
 */
const BASELINE_HTML =
  '<div><div data-testid="markdown-table" class="my-2">' +
  '<div class="overflow-x-auto"><table node="[object Object]">' +
  '<thead><tr><th>Оператор</th><th>Сума</th></tr></thead>' +
  '<tbody><tr><td>Петренко</td><td>1 209 239,06</td></tr>' +
  '<tr><td>⚠️ Коваль</td><td>12 500</td></tr></tbody>' +
  '</table></div></div>\n<p>Висновок: середній чек виріс.</p></div>'

/** Отчёт без единого числа — эталон деградации: раскрашивать нечего. */
const TEXT_TABLE_MD = [
  '| Оператор | Відділ |',
  '| --- | --- |',
  '| Петренко | Стягнення |',
  '| Коваль | Юристи |',
].join('\n')

/** Таблица из `n` строк, где максимум суммы лежит в последней строке. */
function longReport(n: number): string {
  const header = '| Оператор | Сума |\n| --- | --- |'
  const rows = Array.from({ length: n }, (_, i) => `| Оператор ${i + 1} | ${(i + 1) * 100} |`)
  return [header, ...rows].join('\n')
}

function bodyRows(): HTMLElement[] {
  const table = screen.getByTestId('markdown-table')
  return within(table).getAllByRole('row').slice(1)
}

describe('MarkdownMessage — отчётные таблицы, флаг выключен', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('без флага рендерит отчёт байт-в-байт так же, как до доработки', () => {
    const { container } = render(<MarkdownMessage>{REPORT_MD}</MarkdownMessage>)
    expect(container.innerHTML).toBe(BASELINE_HTML)
  })

  it('явное «false» тоже ничего не меняет', () => {
    vi.stubEnv(REPORT_TABLES_FLAG, 'false')
    const { container } = render(<MarkdownMessage>{REPORT_MD}</MarkdownMessage>)
    expect(container.innerHTML).toBe(BASELINE_HTML)
  })

  it('без флага нет ни тепловой карты, ни подсветки строки, ни лид-вывода', () => {
    render(<MarkdownMessage>{REPORT_MD}</MarkdownMessage>)
    const table = screen.getByTestId('markdown-table')
    expect(table.querySelectorAll('[data-heat]')).toHaveLength(0)
    expect(table.querySelectorAll('[data-attention]')).toHaveLength(0)
    expect(screen.queryByTestId('markdown-conclusion')).not.toBeInTheDocument()
  })
})

describe('MarkdownMessage — отчётные таблицы, флаг включён', () => {
  beforeEach(() => {
    vi.stubEnv(REPORT_TABLES_FLAG, 'true')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('заливает только числовую колонку и не трогает колонку имён', () => {
    render(<MarkdownMessage>{REPORT_MD}</MarkdownMessage>)

    const [first, second] = bodyRows()
    const firstCells = within(first).getAllByRole('cell')
    const secondCells = within(second).getAllByRole('cell')

    // Колонка 0 — имена: ни температуры, ни жирного.
    expect(firstCells[0]).not.toHaveAttribute('data-heat')
    expect(secondCells[0]).not.toHaveAttribute('data-heat')

    // Колонка 1 — суммы: температура по шкале колонки.
    expect(firstCells[1]).toHaveAttribute('data-heat', '1.00')
    expect(secondCells[1]).toHaveAttribute('data-heat', '0.00')
  })

  it('максимум колонки дополнительно выделен полужирным', () => {
    render(<MarkdownMessage>{REPORT_MD}</MarkdownMessage>)

    const [first, second] = bodyRows()
    const max = within(first).getAllByRole('cell')[1]
    const min = within(second).getAllByRole('cell')[1]

    expect(max).toHaveAttribute('data-heat-max', 'true')
    expect(max).toHaveClass('font-semibold')
    expect(min).not.toHaveAttribute('data-heat-max')
    expect(min).not.toHaveClass('font-semibold')
  })

  it('строка с «⚠️» получает класс подсветки, а маркер остаётся в тексте', () => {
    render(<MarkdownMessage>{REPORT_MD}</MarkdownMessage>)

    const [first, second] = bodyRows()
    expect(second).toHaveClass('assistant-attention-row')
    expect(second).toHaveAttribute('data-attention', 'true')
    expect(second).toHaveTextContent('⚠️ Коваль')

    expect(first).not.toHaveClass('assistant-attention-row')
    expect(first).not.toHaveAttribute('data-attention')
  })

  it('нечисловая таблица остаётся без тепловой карты', () => {
    render(<MarkdownMessage>{TEXT_TABLE_MD}</MarkdownMessage>)
    const table = screen.getByTestId('markdown-table')
    expect(table.querySelectorAll('[data-heat]')).toHaveLength(0)
    expect(table.querySelectorAll('[data-attention]')).toHaveLength(0)
  })

  it('нечисловая таблица даёт ту же разметку, что и с выключенным флагом', () => {
    const { container: on } = render(<MarkdownMessage>{TEXT_TABLE_MD}</MarkdownMessage>)
    const withFlag = on.innerHTML

    vi.unstubAllEnvs()
    const { container: off } = render(<MarkdownMessage>{TEXT_TABLE_MD}</MarkdownMessage>)

    expect(withFlag).toBe(off.innerHTML)
  })

  it('обычный текст без таблицы и без «Висновок:» тоже не меняется', () => {
    const md = ['# Звіт', '', 'Перший абзац.', '', '- пункт списку', '- другий пункт'].join('\n')

    const { container: on } = render(<MarkdownMessage>{md}</MarkdownMessage>)
    const withFlag = on.innerHTML

    vi.unstubAllEnvs()
    const { container: off } = render(<MarkdownMessage>{md}</MarkdownMessage>)

    expect(withFlag).toBe(off.innerHTML)
  })

  it('строка-аномалия в нечисловой таблице подсвечивается и не теряет ячейки', () => {
    const md = [
      '| Оператор | Відділ |',
      '| --- | --- |',
      '| Петренко | Стягнення |',
      '| ⚠️ Коваль | Юристи |',
    ].join('\n')

    render(<MarkdownMessage>{md}</MarkdownMessage>)
    const [first, second] = bodyRows()

    expect(first).not.toHaveAttribute('data-attention')
    expect(second).toHaveAttribute('data-attention', 'true')
    // Клонирование строки не должно стереть её ячейки: колонок по-прежнему две.
    expect(within(second).getAllByRole('cell')).toHaveLength(2)
    expect(second).toHaveTextContent('⚠️ Коваль')
    expect(second).toHaveTextContent('Юристи')
  })

  it('колонка дат и телефонов не превращается в тепловую карту', () => {
    const md = [
      '| Дата | Телефон |',
      '| --- | --- |',
      '| 19.08.2026 | 0671234567 |',
      '| 20.08.2026 | 0509876543 |',
    ].join('\n')

    render(<MarkdownMessage>{md}</MarkdownMessage>)
    expect(screen.getByTestId('markdown-table').querySelectorAll('[data-heat]')).toHaveLength(0)
  })

  it('шкала колонки считается по всей таблице, а не по видимым 10 строкам', () => {
    render(<MarkdownMessage>{longReport(12)}</MarkdownMessage>)

    // Максимум (строка 12) скрыт под сверткой — видимая первая строка не должна
    // считать себя максимумом.
    const visible = bodyRows()
    expect(visible).toHaveLength(10)
    expect(within(visible[9]).getAllByRole('cell')[1]).not.toHaveAttribute('data-heat-max')
    expect(within(visible[9]).getAllByRole('cell')[1]).toHaveAttribute('data-heat', '0.82')

    fireEvent.click(screen.getByTestId('markdown-table-toggle'))
    const all = bodyRows()
    expect(all).toHaveLength(12)
    expect(within(all[11]).getAllByRole('cell')[1]).toHaveAttribute('data-heat-max', 'true')
    // Уже показанная строка не «перегрелась» после разворота.
    expect(within(all[9]).getAllByRole('cell')[1]).toHaveAttribute('data-heat', '0.82')
  })

  it('строку «Висновок:» подаёт как лид-абзац, обычный абзац не трогает', () => {
    render(
      <MarkdownMessage>
        {['Звичайний абзац.', '', 'Висновок: платежі за вихідні дозаллються в понеділок.'].join(
          '\n'
        )}
      </MarkdownMessage>
    )

    const lead = screen.getByTestId('markdown-conclusion')
    expect(lead.tagName).toBe('P')
    expect(lead).toHaveClass('font-medium')
    expect(lead).toHaveTextContent('Висновок: платежі за вихідні дозаллються в понеділок.')

    const plain = screen.getByText('Звичайний абзац.')
    expect(plain.tagName).toBe('P')
    expect(plain).not.toHaveAttribute('class')
    expect(plain).not.toHaveAttribute('node')
  })

  it('видит «Висновок:» и когда модель выделила его жирным', () => {
    render(<MarkdownMessage>{'**Висновок:** середній чек виріс.'}</MarkdownMessage>)
    expect(screen.getByTestId('markdown-conclusion')).toBeInTheDocument()
  })
})

describe('MarkdownMessage — сноски-цитаты в ячейках таблиц приглушены', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  /** Таблица с факт-сноской `[[1]]` прямо в числовой ячейке («46①»). */
  const CITED_TABLE_MD = ['| Оператор | Сума |', '| --- | --- |', '| Петренко | 46[[1]] |'].join(
    '\n'
  )

  it('цитата внутри ячейки получает приглушающий класс', () => {
    render(<MarkdownMessage>{CITED_TABLE_MD}</MarkdownMessage>)
    expect(screen.getByTestId('markdown-fact')).toHaveClass(MUTED_CITATION_CLASS)
  })

  it('та же цитата вне таблицы приглушающего класса не получает', () => {
    render(<MarkdownMessage>{'Борг 46[[1]] закрито.'}</MarkdownMessage>)
    expect(screen.getByTestId('markdown-fact')).not.toHaveClass(MUTED_CITATION_CLASS)
  })

  it('приглушение цитат не зависит от флага отчётных таблиц', () => {
    // Шум сносок в ячейках убираем всегда, а не только при включённых отчётах.
    vi.stubEnv(REPORT_TABLES_FLAG, 'true')
    render(<MarkdownMessage>{CITED_TABLE_MD}</MarkdownMessage>)
    expect(screen.getByTestId('markdown-fact')).toHaveClass(MUTED_CITATION_CLASS)
  })
})
