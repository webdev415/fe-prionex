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

  it('keeps an abandoned partial entry (and its invalid state) on blur by default', async () => {
    // Default behaviour for the 26 manual-input consumers: forms show the
    // partial text together with `invalidText`, so blur must not wipe either.
    const onValidityChange = vi.fn()
    render(
      <DateSelect
        allowManualInput
        format="dd.MM.yyyy"
        value="2026-08-05"
        onChange={() => {}}
        onValidityChange={onValidityChange}
      />
    )

    const input = screen.getByDisplayValue('05.08.2026')
    await userEvent.clear(input)
    await userEvent.type(input, '12.0')
    expect(input).toHaveValue('12.0')
    expect(onValidityChange).toHaveBeenLastCalledWith(true)

    await userEvent.tab()
    expect(input).toHaveValue('12.0')
    expect(onValidityChange).toHaveBeenLastCalledWith(true)
  })

  it('resyncs an abandoned partial entry on blur when resyncInvalidOnBlur is set', async () => {
    render(
      <DateSelect
        allowManualInput
        resyncInvalidOnBlur
        format="dd.MM.yyyy"
        value="2026-08-05"
        onChange={() => {}}
      />
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

describe('DateSelect (clear button)', () => {
  it('names the × "Clear" by default', async () => {
    // Unchanged default: every existing onClear usage relies on this name.
    const onClear = vi.fn()
    render(<DateSelect format="dd.MM.yyyy" value="2026-08-05" onClear={onClear} />)

    await userEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('uses the opt-in clearLabel as the accessible name', async () => {
    // Opt-in per-field name for forms with several clearable date fields.
    const onClear = vi.fn()
    render(
      <DateSelect
        format="dd.MM.yyyy"
        value="2026-08-05"
        onClear={onClear}
        clearLabel="Clear count date from"
      />
    )

    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Clear count date from' }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})
