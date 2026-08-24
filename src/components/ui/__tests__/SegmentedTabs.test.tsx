import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('keeps the strip reachable when `value` matches no item (roving fallback)', () => {
    render(<SegmentedTabs items={ITEMS} value="missing" onChange={() => {}} />)

    // Without the fallback every tab would be tabIndex=-1 and the whole strip
    // would drop out of the tab order.
    expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute('tabindex', '-1')
  })

  it('activation="manual": arrows only move focus, Enter/Space selects', async () => {
    const onChange = vi.fn()
    render(<SegmentedTabs activation="manual" items={ITEMS} value="two" onChange={onChange} />)

    const active = screen.getByRole('tab', { name: 'Two' })
    active.focus()

    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Three' })).toHaveFocus()
    expect(onChange).not.toHaveBeenCalled()

    await userEvent.keyboard('{Home}')
    expect(screen.getByRole('tab', { name: 'One' })).toHaveFocus()
    expect(onChange).not.toHaveBeenCalled()

    // Selection happens on explicit activation only
    await userEvent.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenLastCalledWith('one')

    await userEvent.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Three' })).toHaveFocus()
    await userEvent.keyboard(' ')
    expect(onChange).toHaveBeenLastCalledWith('three')
    expect(onChange).toHaveBeenCalledTimes(2)
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

  it('supports opt-in per-item title and className; plain items stay unchanged', () => {
    // Both fields are opt-in extras of the component, not a house style: no
    // consumer caps a tab today (the operator-promises strip wraps instead, so
    // its long department names render in full and only take `title`). What is
    // pinned here is that the capability exists and stays inert unless asked
    // for — `className` reaches the button in the `segmented` variant, where
    // the truncating label span can ellipsize inside the cap, and `title`
    // reaches it as a native tooltip. The accessible NAME stays the full label
    // either way — the name-based queries above and in every consumer suite
    // keep working.
    const longLabel = 'A department name much longer than any tab should have to fit'
    render(
      <SegmentedTabs
        items={[
          { id: 'one', label: 'One' },
          { id: 'long', label: longLabel, title: longLabel, className: 'max-w-[14rem]' },
        ]}
        value="one"
        onChange={() => {}}
      />
    )

    const longTab = screen.getByRole('tab', { name: longLabel })
    expect(longTab).toHaveAttribute('title', longLabel)
    expect(longTab.className).toContain('max-w-[14rem]')

    // Opt-in only: an item without the new fields renders without them.
    const plainTab = screen.getByRole('tab', { name: 'One' })
    expect(plainTab).not.toHaveAttribute('title')
    expect(plainTab.className).not.toContain('max-w-')
  })
})
