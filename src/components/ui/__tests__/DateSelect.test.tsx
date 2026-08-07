import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DateSelect } from '../DateSelect'

// Manual-input mode of the REAL DateSelect (react-datepicker underneath) —
// regression coverage for the blur-resync: a parent may keep its old value on
// onChange(null) (e.g. URL-backed filters), and the field must not stay
// empty forever after a clear.

describe('DateSelect (manual input)', () => {
  it('resyncs cleared text from the committed value on blur', async () => {
    const onChange = vi.fn()
    render(
      <DateSelect allowManualInput format="dd.MM.yyyy" value="2026-08-05" onChange={onChange} />
    )

    const input = screen.getByDisplayValue('05.08.2026')
    await userEvent.clear(input)
    expect(input).toHaveValue('')
    expect(onChange).toHaveBeenCalledWith({ value: null })

    // Parent ignored the null (value prop unchanged) — blur restores the text
    await userEvent.tab()
    expect(input).toHaveValue('05.08.2026')
  })

  it('resyncs an abandoned partial entry from the committed value on blur', async () => {
    render(
      <DateSelect allowManualInput format="dd.MM.yyyy" value="2026-08-05" onChange={() => {}} />
    )

    const input = screen.getByDisplayValue('05.08.2026')
    await userEvent.clear(input)
    await userEvent.type(input, '12.0')
    expect(input).toHaveValue('12.0')

    await userEvent.tab()
    expect(input).toHaveValue('05.08.2026')
  })

  it('does not touch a complete valid text on blur, even if the value prop lags', async () => {
    const onChange = vi.fn()
    // Parent never updates `value` (e.g. debounced commit) — the user's valid
    // entry must survive the blur untouched.
    render(
      <DateSelect allowManualInput format="dd.MM.yyyy" value="2026-08-05" onChange={onChange} />
    )

    const input = screen.getByDisplayValue('05.08.2026')
    await userEvent.clear(input)
    await userEvent.type(input, '06082026')
    expect(input).toHaveValue('06.08.2026')

    await userEvent.tab()
    expect(input).toHaveValue('06.08.2026')
  })

  it('commits a retyped valid date after a clear', async () => {
    const onChange = vi.fn()
    render(
      <DateSelect allowManualInput format="dd.MM.yyyy" value="2026-08-05" onChange={onChange} />
    )

    const input = screen.getByDisplayValue('05.08.2026')
    await userEvent.clear(input)
    await userEvent.type(input, '06082026') // mask renders 06.08.2026

    expect(input).toHaveValue('06.08.2026')
    const lastCall = onChange.mock.calls.at(-1)?.[0] as { value: Date | null }
    expect(lastCall.value).toBeInstanceOf(Date)
    expect(lastCall.value?.getFullYear()).toBe(2026)
    expect(lastCall.value?.getMonth()).toBe(7) // August
    expect(lastCall.value?.getDate()).toBe(6)
  })
})
