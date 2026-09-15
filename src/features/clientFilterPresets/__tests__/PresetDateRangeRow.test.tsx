/**
 * The mode-based date control is where a preset stops being a saved value and
 * becomes a saved rule, so these tests are about what the row *reports* — the
 * parameters that get persisted — not only what it draws.
 *
 * Two properties matter most and are easy to lose: an unset filter must come
 * back as `undefined` rather than a pair of "Any" sides, and changing a mode
 * must not leave behind a field the new mode cannot read.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { PresetDateRangeRow } from '../components/PresetDateRangeRow'
import type { DateRangeParam } from '../types'

beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn(() => false)
  }
  Element.prototype.scrollIntoView = vi.fn()
})

/** A Thursday, mid-month, so "start of month" and "minus 7 days" differ from it. */
const NOW = new Date(2026, 8, 11) // 2026-09-11

function Harness({ onChange }: { onChange: (next: DateRangeParam | undefined) => void }) {
  const [value, setValue] = useState<DateRangeParam | undefined>(undefined)
  return (
    <PresetDateRangeRow
      label="Date of sale"
      value={value}
      now={NOW}
      onChange={(next) => {
        setValue(next)
        onChange(next)
      }}
    />
  )
}

const modeOption = (mode: string) => `pages.profile.presets.dates.modes.${mode}`

async function chooseMode(user: ReturnType<typeof userEvent.setup>, side: 0 | 1, mode: string) {
  await user.click(screen.getAllByRole('combobox')[side])
  await user.click(screen.getByRole('option', { name: modeOption(mode) }))
}

const resolved = (side: 'from' | 'to') =>
  screen.getByTestId(`preset-date-resolved-${side}`).textContent

describe('PresetDateRangeRow', () => {
  it('starts with both sides unset and no resolved bound', () => {
    render(<Harness onChange={vi.fn()} />)
    expect(resolved('from')).toContain('—')
    expect(resolved('to')).toContain('—')
  })

  it('reports one side and previews the date it resolves to', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await chooseMode(user, 0, 'today')

    expect(onChange).toHaveBeenLastCalledWith({ from: { mode: 'today' }, to: { mode: 'any' } })
    expect(resolved('from')).toContain('2026-09-11')
    // The other side is untouched, so it still sets no bound.
    expect(resolved('to')).toContain('—')
  })

  it('resolves start of month from the injected clock', async () => {
    const user = userEvent.setup()
    render(<Harness onChange={vi.fn()} />)

    await chooseMode(user, 0, 'startOfMonth')

    expect(resolved('from')).toContain('2026-09-01')
  })

  it('offsets by the typed number of days', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await chooseMode(user, 0, 'minusDays')
    await user.type(screen.getByRole('spinbutton'), '7')

    expect(onChange).toHaveBeenLastCalledWith({
      from: { mode: 'minusDays', days: 7 },
      to: { mode: 'any' },
    })
    expect(resolved('from')).toContain('2026-09-04')
  })

  it('treats a cleared day count as not filled in rather than zero', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await chooseMode(user, 0, 'minusDays')
    await user.type(screen.getByRole('spinbutton'), '3')
    await user.clear(screen.getByRole('spinbutton'))

    expect(onChange).toHaveBeenLastCalledWith({
      from: { mode: 'minusDays' },
      to: { mode: 'any' },
    })
  })

  it('drops the day count when the mode stops reading it', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await chooseMode(user, 0, 'minusDays')
    await user.type(screen.getByRole('spinbutton'), '5')
    await chooseMode(user, 0, 'today')

    // Left behind, the 5 would reappear if the operator returned to "minus N".
    expect(onChange).toHaveBeenLastCalledWith({ from: { mode: 'today' }, to: { mode: 'any' } })
  })

  it('keeps the day count when swapping between the two offset modes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await chooseMode(user, 0, 'minusDays')
    await user.type(screen.getByRole('spinbutton'), '2')
    await chooseMode(user, 0, 'plusDays')

    expect(onChange).toHaveBeenLastCalledWith({
      from: { mode: 'plusDays', days: 2 },
      to: { mode: 'any' },
    })
    expect(resolved('from')).toContain('2026-09-13')
  })

  it('reports the whole filter as unset once both sides are Any again', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await chooseMode(user, 1, 'today')
    expect(onChange).toHaveBeenLastCalledWith({ from: { mode: 'any' }, to: { mode: 'today' } })

    await chooseMode(user, 1, 'any')
    // Not a pair of Any sides — an absent filter.
    expect(onChange).toHaveBeenLastCalledWith(undefined)
  })

  it('sets no bound for a custom mode with no date chosen yet', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await chooseMode(user, 0, 'custom')

    expect(onChange).toHaveBeenLastCalledWith({ from: { mode: 'custom' }, to: { mode: 'any' } })
    expect(resolved('from')).toContain('—')
  })

  it('shows the day field only for the offset modes', async () => {
    const user = userEvent.setup()
    render(<Harness onChange={vi.fn()} />)

    expect(screen.queryByRole('spinbutton')).toBeNull()
    await chooseMode(user, 0, 'plusDays')
    expect(screen.getByRole('spinbutton')).toBeTruthy()
    await chooseMode(user, 0, 'startOfMonth')
    expect(screen.queryByRole('spinbutton')).toBeNull()
  })
})
