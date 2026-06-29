import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
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
