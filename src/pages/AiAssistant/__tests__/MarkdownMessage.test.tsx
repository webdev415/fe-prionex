import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MarkdownMessage, TABLE_PREVIEW_ROWS } from '../MarkdownMessage'

/** Build a GFM markdown table with `n` body rows (plus a header row). */
function tableMarkdown(n: number): string {
  const header = '| Name | Debt |\n| --- | --- |'
  const rows = Array.from({ length: n }, (_, i) => `| Employee ${i + 1} | ${i + 1}00 |`)
  return [header, ...rows].join('\n')
}

describe('MarkdownMessage — syntax-highlighted code blocks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a fenced ```sql block as a highlighted code plate with the language tag', () => {
    render(<MarkdownMessage>{'```sql\nSELECT * FROM clients WHERE id = 1;\n```'}</MarkdownMessage>)

    const block = screen.getByTestId('markdown-code-block')
    expect(block).toHaveAttribute('data-language', 'sql')
    // The SQL is tokenised by the highlighter into a <code> element.
    const code = block.querySelector('code')
    expect(code).not.toBeNull()
    expect(block).toHaveTextContent('SELECT * FROM clients WHERE id = 1;')
    // Prism wraps individual tokens in <span> elements (syntax colouring).
    expect(block.querySelectorAll('span').length).toBeGreaterThan(0)
  })

  it('renders a fenced ```python block with horizontal-scroll plate', () => {
    render(<MarkdownMessage>{'```python\nprint("hello")\n```'}</MarkdownMessage>)
    const block = screen.getByTestId('markdown-code-block')
    expect(block).toHaveAttribute('data-language', 'python')
    expect(block).toHaveTextContent('print("hello")')
  })

  it('exposes a copy button that writes the code text to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    render(<MarkdownMessage>{'```bash\nls -la\n```'}</MarkdownMessage>)
    const block = screen.getByTestId('markdown-code-block')
    const copyButton = within(block).getByRole('button')
    fireEvent.click(copyButton)

    expect(writeText).toHaveBeenCalledWith('ls -la')
  })

  it('keeps short inline `code` as a compact inline element (not a code plate)', () => {
    render(<MarkdownMessage>{'Use the `clients` table here.'}</MarkdownMessage>)
    // No fenced block plate for inline code.
    expect(screen.queryByTestId('markdown-code-block')).not.toBeInTheDocument()
    const inline = screen.getByText('clients')
    expect(inline.tagName).toBe('CODE')
  })
})

describe('MarkdownMessage — long table folds to the first 10 rows', () => {
  it('shows only the first 10 body rows with a "show all" toggle when the table is long', () => {
    render(<MarkdownMessage>{tableMarkdown(17)}</MarkdownMessage>)

    const table = screen.getByTestId('markdown-table')
    // Header row + 10 body rows are visible initially.
    expect(within(table).getAllByRole('row')).toHaveLength(TABLE_PREVIEW_ROWS + 1)
    expect(within(table).queryByText('Employee 11')).not.toBeInTheDocument()

    const toggle = screen.getByTestId('markdown-table-toggle')
    expect(toggle).toHaveTextContent('Show all (17)')
  })

  it('expands to the full list and collapses back to 10 on toggle', () => {
    render(<MarkdownMessage>{tableMarkdown(17)}</MarkdownMessage>)
    const toggle = screen.getByTestId('markdown-table-toggle')

    // Expand → all 17 rows + the header.
    fireEvent.click(toggle)
    const table = screen.getByTestId('markdown-table')
    expect(within(table).getAllByRole('row')).toHaveLength(17 + 1)
    expect(within(table).getByText('Employee 17')).toBeInTheDocument()
    expect(toggle).toHaveTextContent('Collapse')

    // Collapse → back to the first 10 (+ header).
    fireEvent.click(toggle)
    expect(within(screen.getByTestId('markdown-table')).getAllByRole('row')).toHaveLength(
      TABLE_PREVIEW_ROWS + 1
    )
  })

  it('does not show a toggle for a short table (<= 10 rows)', () => {
    render(<MarkdownMessage>{tableMarkdown(5)}</MarkdownMessage>)
    expect(screen.getByTestId('markdown-table')).toBeInTheDocument()
    expect(screen.queryByTestId('markdown-table-toggle')).not.toBeInTheDocument()
    expect(within(screen.getByTestId('markdown-table')).getAllByRole('row')).toHaveLength(5 + 1)
  })

  it('folds multiple long tables independently', () => {
    render(
      <MarkdownMessage>{`${tableMarkdown(12)}\n\nSome text\n\n${tableMarkdown(15)}`}</MarkdownMessage>
    )
    const toggles = screen.getAllByTestId('markdown-table-toggle')
    expect(toggles).toHaveLength(2)
    expect(toggles[0]).toHaveTextContent('Show all (12)')
    expect(toggles[1]).toHaveTextContent('Show all (15)')

    // Expanding the first must not expand the second.
    fireEvent.click(toggles[0])
    const tables = screen.getAllByTestId('markdown-table')
    expect(within(tables[0]).getAllByRole('row')).toHaveLength(12 + 1)
    expect(within(tables[1]).getAllByRole('row')).toHaveLength(TABLE_PREVIEW_ROWS + 1)
  })
})

describe('MarkdownMessage — факт-сноски [[N]]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('рендерит [[1]] как кликабельную сноску и зовёт onFactClick(1) по клику', () => {
    const onFactClick = vi.fn()
    render(<MarkdownMessage onFactClick={onFactClick}>{'Долг 48 750 ₴[[1]]'}</MarkdownMessage>)

    const fact = screen.getByTestId('markdown-fact')
    expect(fact).toHaveAttribute('data-fact-n', '1')
    expect(fact).toHaveAttribute('role', 'button')
    // Глиф — кружковая цифра ①.
    expect(fact).toHaveTextContent('①')

    fireEvent.click(fact)
    expect(onFactClick).toHaveBeenCalledTimes(1)
    expect(onFactClick).toHaveBeenCalledWith(1)
  })

  it('срабатывает по клавишам Enter и Space', () => {
    const onFactClick = vi.fn()
    render(<MarkdownMessage onFactClick={onFactClick}>{'x[[2]]'}</MarkdownMessage>)
    const fact = screen.getByTestId('markdown-fact')

    fireEvent.keyDown(fact, { key: 'Enter' })
    fireEvent.keyDown(fact, { key: ' ' })
    expect(onFactClick).toHaveBeenCalledTimes(2)
    expect(onFactClick).toHaveBeenNthCalledWith(1, 2)
    expect(onFactClick).toHaveBeenNthCalledWith(2, 2)
  })

  it('несколько сносок независимы — клик по второй зовёт onFactClick(2)', () => {
    const onFactClick = vi.fn()
    render(
      <MarkdownMessage onFactClick={onFactClick}>{'Сумма 10[[1]], срок 20[[2]]'}</MarkdownMessage>
    )
    const facts = screen.getAllByTestId('markdown-fact')
    expect(facts).toHaveLength(2)

    fireEvent.click(facts[1])
    expect(onFactClick).toHaveBeenCalledTimes(1)
    expect(onFactClick).toHaveBeenCalledWith(2)
  })

  it('без onFactClick сноска рендерится, но не является кнопкой', () => {
    render(<MarkdownMessage>{'Долг 100[[1]]'}</MarkdownMessage>)
    const fact = screen.getByTestId('markdown-fact')
    expect(fact).toBeInTheDocument()
    expect(fact).not.toHaveAttribute('role', 'button')
  })

  it('кружковый глиф ① из вывода модели + citations → кликабельная сноска', () => {
    // Регресс: модель рисует готовый глиф вместо [[1]] (так лежит и в истории),
    // при наличии источника 1 он всё равно должен быть кликабельным, а не текстом.
    const onFactClick = vi.fn()
    render(
      <MarkdownMessage
        onFactClick={onFactClick}
        citations={[{ id: 1, kind: 'sql', label: 'clients' }]}
      >
        {'В статусе new 413 442 ①'}
      </MarkdownMessage>
    )

    const fact = screen.getByTestId('markdown-fact')
    expect(fact).toHaveAttribute('data-fact-n', '1')
    expect(fact).toHaveAttribute('role', 'button')

    fireEvent.click(fact)
    expect(onFactClick).toHaveBeenCalledTimes(1)
    expect(onFactClick).toHaveBeenCalledWith(1)
  })

  it('кружковый глиф без источника остаётся обычным текстом (не сноска)', () => {
    render(<MarkdownMessage onFactClick={vi.fn()}>{'В статусе new 413 442 ①'}</MarkdownMessage>)
    expect(screen.queryByTestId('markdown-fact')).not.toBeInTheDocument()
  })

  it('подставляет метку источника из citations в title сноски', () => {
    render(
      <MarkdownMessage
        onFactClick={vi.fn()}
        citations={[{ id: 1, kind: 'sql', label: 'debts.amount' }]}
      >
        {'Долг 100[[1]]'}
      </MarkdownMessage>
    )
    expect(screen.getByTestId('markdown-fact')).toHaveAttribute('title', 'debts.amount')
  })

  it('не трогает маркер внутри code-блока', () => {
    render(<MarkdownMessage onFactClick={vi.fn()}>{'`value[[1]]`'}</MarkdownMessage>)
    expect(screen.queryByTestId('markdown-fact')).not.toBeInTheDocument()
    expect(screen.getByText('value[[1]]').tagName).toBe('CODE')
  })
})

describe('MarkdownMessage — ссылки на клиента [[client:id|Имя]]', () => {
  it('рендерит ссылку на карточку /dashboard/clients/:id с именем клиента', () => {
    render(
      <MemoryRouter>
        <MarkdownMessage>{'Клиент [[client:48213|Коваленко О. П.]] в просрочке'}</MarkdownMessage>
      </MemoryRouter>
    )

    const link = screen.getByTestId('markdown-client-link')
    expect(link).toHaveAttribute('href', '/dashboard/clients/48213')
    expect(link).toHaveTextContent('Коваленко О. П.')
  })

  // Живой дефект 25.08.2026, поймал CEO на демонстрации прода: в таблице ответа
  // ассистента колонка «Картка» показывала сырой текст `[[client:281201  #281201]]`
  // вместо ссылки. Фронт в этом не виноват — в GFM-таблице `|` это ГРАНИЦА ЯЧЕЙКИ,
  // и разбор резал маркер раньше, чем его видел rehype-плагин. Починка сделана в
  // движке ассистента (рендер результата инструмента экранирует `|` → `\|`), а эти
  // два теста фиксируют КОНТРАКТ, на который та починка опирается: экранированный
  // маркер во фронте кликабелен, а неэкранированный — заведомо ломается.
  it('маркер с экранированной чертой внутри ячейки таблицы становится ссылкой', () => {
    const md = [
      '| Оператор | Клієнт |',
      '| --- | --- |',
      '| Шкабура Микола | [[client:406068\\|Комашко В`ячеслав]] |',
    ].join('\n')

    render(
      <MemoryRouter>
        <MarkdownMessage>{md}</MarkdownMessage>
      </MemoryRouter>
    )

    const link = screen.getByTestId('markdown-client-link')
    expect(link).toHaveAttribute('href', '/dashboard/clients/406068')
    expect(link).toHaveTextContent('Комашко В`ячеслав')
    // ссылка лежит в своей ячейке, а не разъехалась по соседним
    expect(link.closest('td')).not.toBeNull()
  })

  it('без экранирования тот же маркер разрезается таблицей и ссылкой не становится', () => {
    const md = [
      '| Оператор | Клієнт |',
      '| --- | --- |',
      '| Шкабура Микола | [[client:406068|Комашко В`ячеслав]] |',
    ].join('\n')

    const { container } = render(
      <MemoryRouter>
        <MarkdownMessage>{md}</MarkdownMessage>
      </MemoryRouter>
    )

    expect(screen.queryByTestId('markdown-client-link')).not.toBeInTheDocument()
    // именно так это и выглядело у CEO: обрубок маркера в ячейке
    expect(container.querySelector('table')?.textContent).toContain('[[client:406068')
  })

  it('текст без маркеров не создаёт ни сносок, ни ссылок', () => {
    render(
      <MemoryRouter>
        <MarkdownMessage>{'Просто обычный ответ без маркеров.'}</MarkdownMessage>
      </MemoryRouter>
    )
    expect(screen.queryByTestId('markdown-fact')).not.toBeInTheDocument()
    expect(screen.queryByTestId('markdown-client-link')).not.toBeInTheDocument()
    expect(screen.getByText('Просто обычный ответ без маркеров.')).toBeInTheDocument()
  })
})
