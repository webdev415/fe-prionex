import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SegmentedTabs, segmentedTabId, segmentedTabPanelId } from '../SegmentedTabs'

const ITEMS = [
  { id: 'one', label: 'One' },
  { id: 'two', label: 'Two' },
  { id: 'three', label: 'Three' },
]

describe('SegmentedTabs', () => {
  it('applies roving tabIndex: 0 on the active tab, -1 elsewhere', () => {
    render(<SegmentedTabs items={ITEMS} value="two" onChange={() => {}} />)

    expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Three' })).toHaveAttribute('tabindex', '-1')
  })

  it('selects and focuses tabs with ArrowRight/ArrowLeft (wrapping) and Home/End', () => {
    const onChange = vi.fn()
    render(<SegmentedTabs items={ITEMS} value="two" onChange={onChange} />)

    const active = screen.getByRole('tab', { name: 'Two' })
    fireEvent.keyDown(active, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenLastCalledWith('three')
    expect(screen.getByRole('tab', { name: 'Three' })).toHaveFocus()

    fireEvent.keyDown(active, { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenLastCalledWith('one')

    fireEvent.keyDown(active, { key: 'End' })
    expect(onChange).toHaveBeenLastCalledWith('three')

    fireEvent.keyDown(active, { key: 'Home' })
    expect(onChange).toHaveBeenLastCalledWith('one')

    // Wrap-around from the last tab
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Three' }), { key: 'ArrowRight' })
    expect(onChange).toHaveBeenLastCalledWith('one')
  })

  it('leaves modified keystrokes to the browser (Alt/Ctrl/Meta + Arrow)', () => {
    const onChange = vi.fn()
    render(<SegmentedTabs items={ITEMS} value="two" onChange={onChange} />)

    const active = screen.getByRole('tab', { name: 'Two' })
    fireEvent.keyDown(active, { key: 'ArrowRight', altKey: true })
    fireEvent.keyDown(active, { key: 'ArrowLeft', ctrlKey: true })
    fireEvent.keyDown(active, { key: 'Home', metaKey: true })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('links tabs to panels via idPrefix (id + aria-controls)', () => {
    render(
      <>
        <SegmentedTabs items={ITEMS} value="one" onChange={() => {}} idPrefix="demo" />
        <div
          role="tabpanel"
          id={segmentedTabPanelId('demo', 'one')}
          aria-labelledby={segmentedTabId('demo', 'one')}
        />
      </>
    )

    const tab = screen.getByRole('tab', { name: 'One' })
    expect(tab).toHaveAttribute('id', 'demo-tab-one')
    expect(tab).toHaveAttribute('aria-controls', 'demo-panel-one')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'demo-panel-one')

    // Inactive tabs must not reference a panel id that isn't in the DOM
    // (consumers render only the active tabpanel)
    expect(screen.getByRole('tab', { name: 'Two' })).not.toHaveAttribute('aria-controls')
  })

  it('renders the underline variant with the same tab semantics', () => {
    render(<SegmentedTabs variant="underline" items={ITEMS} value="one" onChange={() => {}} />)

    expect(screen.getByRole('tablist')).toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(3)
    expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute('aria-selected', 'true')
  })
})
