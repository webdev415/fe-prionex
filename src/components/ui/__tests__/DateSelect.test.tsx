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

// Chrome's native autofill suggestion (name + saved date) renders on top of
// the calendar popup and blocks click-selection. It is suppressed on the
// input itself, so it must hold for BOTH render paths: the masked input
// (allowManualInput) and the plain one (calendar-only) (KAN-995).

describe('DateSelect (browser autofill suppression)', () => {
  // Both modes must carry the same attributes. react-datepicker never forwards
  // data-* to its built-in input, so calendar-only mode renders through
  // PlainDateInput purely to get them onto the DOM node; if that ever reverts
  // to the built-in input these assertions are what catches it.
  it.each([
    ['manual', true],
    ['calendar-only', false],
  ])('suppresses autofill on the %s input', (_mode, allowManualInput) => {
    render(
      <DateSelect allowManualInput={allowManualInput} format="dd.MM.yyyy" value="2026-08-05" />
    )

    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('autocomplete', 'off')
    expect(input).toHaveAttribute('data-lpignore', 'true')
    expect(input).toHaveAttribute('data-1p-ignore')
    expect(input).toHaveAttribute('data-form-type', 'other')
    expect(input).toHaveAttribute('type', 'text')
  })

  it('gives the field a name Chrome cannot classify as profile data', () => {
    render(<DateSelect allowManualInput id="assignment-date" value="2026-08-05" />)

    const input = screen.getByRole('textbox')
    // The caller's semantic id must not reach the element Chrome inspects; it
    // moves to the wrapper, and the label still points at the real input.
    expect(input.getAttribute('id')).not.toContain('assignment')
    expect(document.querySelector('#assignment-date')?.tagName).toBe('DIV')

    const name = input.getAttribute('name')
    expect(name).toBeTruthy()
    expect(name).not.toContain('assignment')
    expect(name).not.toContain('date')
    // useId's delimiters differ between React 18 (':r0:') and 19 ('_r_0_');
    // the name must stay attribute-safe on either.
    expect(name).toMatch(/^ds-[a-zA-Z0-9_-]+$/)
  })
})

// Calendar-only mode no longer uses react-datepicker's own input (KAN-995
// routes it through PlainDateInput so the opt-out attributes reach the DOM).
// These pin the two properties that swap could break: typing stays rejected by
// onChangeRaw, and the popup still opens on click.

describe('DateSelect (calendar-only behaviour after the custom-input swap)', () => {
  it('still rejects typing', async () => {
    const onChange = vi.fn()
    render(<DateSelect format="dd.MM.yyyy" value="2026-08-05" onChange={onChange} />)

    const input = screen.getByRole('textbox') as HTMLInputElement
    const before = input.value
    await userEvent.type(input, '99')

    expect(input.value).toBe(before)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('still opens the calendar on click', async () => {
    render(<DateSelect format="dd.MM.yyyy" value="2026-08-05" />)

    await userEvent.click(screen.getByRole('textbox'))

    expect(document.querySelector('.react-datepicker')).not.toBeNull()
    expect(document.querySelector('.react-datepicker__day')).not.toBeNull()
  })

  it('keeps the input inside the library wrapper the theme CSS targets', () => {
    render(<DateSelect format="dd.MM.yyyy" value="2026-08-05" />)

    const input = screen.getByRole('textbox')
    expect(input.closest('.react-datepicker__input-container')).not.toBeNull()
    expect(input).toHaveAttribute('type', 'text')
  })
})

describe('DateSelect (label association survives the id decoupling)', () => {
  it('still associates the visible label with the input', () => {
    render(<DateSelect id="promise-date" label="Promise date" value="2026-08-05" />)

    // getByLabelText resolves through htmlFor -> input id, so this fails if the
    // label still points at the caller's id after the input moved off it.
    expect(screen.getByLabelText('Promise date')).toBe(screen.getByRole('textbox'))
  })
})

// react-datepicker v9 reads props['aria-describedby'] first and only falls back
// to ariaDescribedBy, and it omits undefined aria values rather than writing
// them onto the custom input — so the hyphenated prop reaches the DOM in both
// render paths. Pinned for both, because each goes through a different
// customInput clone.
describe('DateSelect (message wiring survives the id rename)', () => {
  it.each([
    ['manual', true],
    ['calendar-only', false],
  ])('points aria-describedby at the rendered error node (%s)', (_m, allowManualInput) => {
    render(
      <DateSelect
        id="promise-date"
        allowManualInput={allowManualInput}
        error="Bad date"
        value="2026-08-05"
      />
    )

    const describedBy = screen.getByRole('textbox').getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy as string)?.textContent).toBe('Bad date')
  })

  it.each([
    ['manual', true],
    ['calendar-only', false],
  ])('points aria-describedby at the rendered helper node (%s)', (_m, allowManualInput) => {
    render(
      <DateSelect allowManualInput={allowManualInput} helperText="Pick a day" value="2026-08-05" />
    )

    const describedBy = screen.getByRole('textbox').getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy as string)?.textContent).toBe('Pick a day')
  })
})

describe('DateSelect (aria-describedby never dangles)', () => {
  // Both of these resolved to an element id that was not in the DOM before the
  // reference was keyed off the paragraph's own render condition.
  it('points at the inline invalid message, not the helper it suppresses', async () => {
    render(
      <DateSelect
        allowManualInput
        format="dd.MM.yyyy"
        helperText="Pick a day"
        invalidText="Incomplete date"
        value="2026-08-05"
      />
    )

    const input = screen.getByRole('textbox')
    await userEvent.clear(input)
    await userEvent.type(input, '15.08')
    await userEvent.tab()

    expect(screen.getByText('Incomplete date')).toBeInTheDocument()
    expect(screen.queryByText('Pick a day')).not.toBeInTheDocument()

    const describedBy = input.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy as string)?.textContent).toBe('Incomplete date')
  })

  it('references nothing when no message is rendered', async () => {
    render(<DateSelect allowManualInput showTimeSelect format="dd.MM.yyyy HH:mm" value={null} />)

    const input = screen.getByRole('textbox')
    await userEvent.type(input, '15.08')
    await userEvent.tab()

    expect(input.getAttribute('aria-describedby')).toBeNull()
  })
})

describe('DateSelect (invalid state is exposed, not just styled)', () => {
  it('marks the field invalid when the caller passes an error', () => {
    render(<DateSelect error="Bad date" value="2026-08-05" />)
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
  })

  it('marks the field invalid when typing is invalid and no message is supplied', async () => {
    render(<DateSelect allowManualInput format="dd.MM.yyyy" value={null} />)

    const input = screen.getByRole('textbox')
    await userEvent.type(input, '15.08')
    await userEvent.tab()

    // Red border only, no paragraph — previously nothing reached assistive tech.
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input.getAttribute('aria-describedby')).toBeNull()
  })

  it('leaves the attribute off while the field is valid', () => {
    render(<DateSelect helperText="Pick a day" value="2026-08-05" />)
    expect(screen.getByRole('textbox').getAttribute('aria-invalid')).toBeNull()
  })
})

describe('DateSelect (autoComplete escape hatch)', () => {
  it('defaults to off', () => {
    render(<DateSelect value="2026-08-05" />)
    expect(screen.getByRole('textbox')).toHaveAttribute('autocomplete', 'off')
  })

  it('lets a semantic call site pass a stronger token', () => {
    render(<DateSelect id="promise-date" autoComplete="new-password" value="2026-08-05" />)
    expect(screen.getByRole('textbox')).toHaveAttribute('autocomplete', 'new-password')
  })
})
