import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DateSelect } from '../DateSelect'
import { winningDeclaration } from '@/test/cssCascade'

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

// KAN-992. Two independent mechanisms keep a blocked time slot readable as
// blocked, and both are covered below because they fail for different reasons.
// (1) react-datepicker marks the slot ``aria-disabled="true"`` and drops the
// click — that attribute is the library's, not ours. (2) the theme CSS keys
// its greying off that attribute and exempts those slots from the
// ``!important`` foreground/hover rules that would otherwise repaint them as
// available — this second one is the actual regression.
//
// ``css: true`` in vitest.config.ts means jsdom really does load both
// stylesheets DateSelect imports, so the greying can be asserted directly
// rather than only inferred from the attribute. jsdom does not substitute
// custom properties, so those assertions compare the unresolved ``var(--token)``
// text — the more useful comparison anyway, since it pins which RULE won
// independent of theme values. jsdom does normalise a stylesheet's hex to
// ``rgb()`` form.
//
// BUT: jsdom's ``getComputedStyle`` does NOT implement specificity. It applies
// the last matching rule in source order, full stop — a (0,3,0) rule declared
// above a (0,2,0) rule loses there and wins in every real browser. So the
// ``getComputedStyle`` assertions below are only trustworthy for slots where
// exactly one rule matches, which is true of each case they cover (the guards
// are written so that blocked, available and selected slots are matched by
// disjoint rules). They are NOT a cascade check, and the regression in
// ``DateSelect (selected time slot keeps its selected look) — KAN-992`` below is
// invisible to them — that suite resolves the cascade itself instead.

describe('DateSelect (blocked time slots stay identifiable) — KAN-992', () => {
  // Mirrors the shape of the TA steps' own predicate: block the morning,
  // leave the afternoon selectable.
  const afternoonOnly = (time: Date) => time.getHours() >= 12
  // At 60-minute intervals: a full day, of which 00:00–11:00 are blocked.
  const SLOTS_PER_DAY = 24
  const BLOCKED_SLOTS = 12

  const openTimeList = async (selectedHour = 13) => {
    const onChange = vi.fn()
    render(
      <DateSelect
        value={new Date(2026, 7, 5, selectedHour, 0)}
        onChange={onChange}
        showTimeSelect
        format="dd.MM.yyyy HH:mm"
        timeFormat="HH:mm"
        timeIntervals={60}
        filterTime={afternoonOnly}
      />
    )
    await userEvent.click(screen.getByRole('textbox'))
    return onChange
  }

  const slots = (selector = '') =>
    document.querySelectorAll(`.react-datepicker__time-list-item${selector}`)

  it('flags a slot the predicate rejects', async () => {
    await openTimeList()
    expect(screen.getByText('09:00')).toHaveAttribute('aria-disabled', 'true')
  })

  it('leaves an available slot unflagged', async () => {
    await openTimeList()
    expect(screen.getByText('14:00')).not.toHaveAttribute('aria-disabled')
  })

  it('disables blocked slots rather than removing them from the list', async () => {
    // A predicate that filtered slots OUT instead would leave the greying rule
    // matching nothing at all, so the whole day has to still be rendered.
    await openTimeList()
    expect(slots()).toHaveLength(SLOTS_PER_DAY)
    expect(slots('[aria-disabled="true"]')).toHaveLength(BLOCKED_SLOTS)
  })

  it('ignores a click on a blocked slot', async () => {
    const onChange = await openTimeList()
    await userEvent.click(screen.getByText('09:00'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('still commits a click on an available slot', async () => {
    const onChange = await openTimeList()
    await userEvent.click(screen.getByText('14:00'))
    expect(onChange).toHaveBeenCalled()
  })

  // The regression itself: a pair of ``!important`` rules repainted every slot,
  // so a suite checking only ``aria-disabled`` stayed green throughout the bug.
  // This is the assertion that fails against the pre-fix stylesheet.
  it('greys a blocked slot instead of painting it as available', async () => {
    await openTimeList()
    const blocked = screen.getByText('09:00')
    expect(getComputedStyle(blocked).color).toBe('var(--muted-foreground)')
    expect(getComputedStyle(blocked).opacity).toBe('0.5')
  })

  it('leaves an available slot at full foreground', async () => {
    await openTimeList()
    expect(getComputedStyle(screen.getByText('14:00')).color).toBe('var(--foreground)')
  })

  it('keeps the selected look on a slot that is selected AND blocked', async () => {
    // Reopening a TA whose saved time has since passed lands here. Greying it
    // would put muted text on the primary-500 selection background; the step
    // already explains the problem with an inline message, so selection wins.
    await openTimeList(9)

    const selected = screen.getByText('09:00')
    expect(selected).toHaveAttribute('aria-disabled', 'true')
    expect(getComputedStyle(selected).color).toBe('rgb(255, 255, 255)')
  })
})

// KAN-992 follow-up. The ``:not([aria-disabled='true'])`` guard above did not
// just narrow those two rules, it made them MORE SPECIFIC: (0,2,0) -> (0,3,0)
// at rest and (0,3,0) -> (0,4,0) on hover. Both had previously only TIED the
// ``--selected`` pair that follows them in the stylesheet and lost on source
// order, which is how the selected slot got its white-on-accent look. Breaking
// that tie handed the selected slot ``--foreground`` text on the accent
// background, and replaced the accent with ``--muted`` on hover — the current
// value reading as unselected exactly while the operator points at it. It hit
// every ``showTimeSelect`` consumer plus the Kanban deadline picker, which
// shares the calendar class and this stylesheet, and it needed no
// ``filterTime`` at all: the guard matches every enabled slot.
//
// These resolve the cascade properly (see ``@/test/cssCascade``) because
// jsdom's ``getComputedStyle`` ranks by source order alone and reports the
// selected slot as white either way — it called the regression green.

describe('DateSelect (selected time slot keeps its selected look) — KAN-992', () => {
  const afternoonOnly = (time: Date) => time.getHours() >= 12

  const openWithSelection = async (selected: Date) => {
    render(
      <DateSelect
        value={selected}
        onChange={() => {}}
        showTimeSelect
        format="dd.MM.yyyy HH:mm"
        timeFormat="HH:mm"
        timeIntervals={60}
        filterTime={afternoonOnly}
      />
    )
    await userEvent.click(screen.getByRole('textbox'))
  }

  // 13:00 is selected AND selectable, i.e. the ordinary case: any picker whose
  // current value is still valid renders one of these.
  const SELECTED = new Date(2026, 7, 5, 13, 0)

  it('keeps white text on the selected slot at rest', async () => {
    await openWithSelection(SELECTED)

    const winner = winningDeclaration(screen.getByText('13:00'), 'color')
    expect(winner?.value).toBe('#ffffff')
    expect(winner?.selector).toContain('--selected')
  })

  it('keeps the accent background on the selected slot at rest', async () => {
    await openWithSelection(SELECTED)

    expect(winningDeclaration(screen.getByText('13:00'), 'background-color')?.value).toBe(
      'var(--color-primary-500)'
    )
  })

  it('keeps the accent background while the selected slot is hovered', async () => {
    // The half the guard broke most visibly: --muted won here, so hovering the
    // current value made it look like any other slot.
    await openWithSelection(SELECTED)

    const winner = winningDeclaration(screen.getByText('13:00'), 'background-color', {
      hover: true,
    })
    expect(winner?.value).toBe('var(--color-primary-500)')
    expect(winner?.selector).toContain('--selected')
  })

  it('keeps white text while the selected slot is hovered', async () => {
    await openWithSelection(SELECTED)

    expect(winningDeclaration(screen.getByText('13:00'), 'color', { hover: true })?.value).toBe(
      '#ffffff'
    )
  })

  it('still hands an unselected slot the hover background', async () => {
    // The guard's own purpose must survive the exclusion: a plain selectable
    // slot still highlights on hover.
    await openWithSelection(SELECTED)

    expect(
      winningDeclaration(screen.getByText('14:00'), 'background-color', { hover: true })?.value
    ).toBe('var(--muted)')
  })

  it('still greys a blocked slot once the cascade is resolved properly', async () => {
    // Re-asserts the original fix through the specificity-aware resolver, so
    // it is not resting on jsdom agreeing by accident.
    await openWithSelection(SELECTED)

    expect(winningDeclaration(screen.getByText('09:00'), 'color')?.value).toBe(
      'var(--muted-foreground)'
    )
  })

  it('does not light up a blocked slot on hover', async () => {
    // The other half of the reported symptom, and the half that made the slot
    // feel clickable rather than merely look it: --muted used to win here too.
    // The guarded hover rule must not reach a blocked slot, leaving
    // react-datepicker's own --disabled:hover to supply the background.
    await openWithSelection(SELECTED)

    const winner = winningDeclaration(screen.getByText('09:00'), 'background-color', {
      hover: true,
    })
    expect(winner?.value).not.toBe('var(--muted)')
    expect(winner?.selector).toContain('--disabled')
  })

  it('keeps a blocked slot grey while it is hovered', async () => {
    // The greying rule carries no :hover of its own, so hover must not hand the
    // slot back to the full-foreground rule.
    await openWithSelection(SELECTED)

    expect(winningDeclaration(screen.getByText('09:00'), 'color', { hover: true })?.value).toBe(
      'var(--muted-foreground)'
    )
  })

  it('leaves a slot that is selected AND blocked looking selected', async () => {
    // Reopening a TA whose saved time has since passed. Two exclusions decide
    // this one: the blocked rule skips --selected, and the guarded rules skip
    // both, so the --selected rule is unopposed.
    await openWithSelection(new Date(2026, 7, 5, 9, 0))

    const slot = screen.getByText('09:00')
    expect(slot).toHaveAttribute('aria-disabled', 'true')
    expect(winningDeclaration(slot, 'color')?.value).toBe('#ffffff')
    expect(winningDeclaration(slot, 'background-color')?.value).toBe('var(--color-primary-500)')
  })
})

/**
 * Reported from the UI after "now" started being measured in the profile
 * timezone: the browser's today can already be yesterday there, so ``--today``
 * and ``--disabled`` land on the same cell for the first time. ``--today``
 * scores (0,3,0) against the disabled rule's (0,2,0), so the blocked day
 * painted itself accent-green and read as available — the KAN-992 defect
 * again, one grid over.
 */
describe('DateSelect (a blocked "today" still reads as blocked)', () => {
  // A value on another day matters: with none, react-datepicker marks today
  // ``--keyboard-selected``, which the today rule already excludes — so the
  // accent case would never be exercised.
  // Часы фиксируем серединой месяца. Тест про то, КАКОЕ правило каскада
  // красит заблокированный «сегодня», а не про календарь — но в последний
  // день месяца «завтра» уезжает в следующий, react-datepicker показывает
  // уже его, а сегодняшнее число рисует днём соседнего месяца. Тогда
  // выигрывает `--outside-month`, а не `--disabled`, и тест краснеет, ничего
  // не сломав в коде: 31.08.2026 он положил прогон всего репозитория.
  // Подменяем только `Date`: userEvent нужны настоящие таймеры.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 2, 12, 12, 0, 0))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const openWithMin = async (min: Date, value: Date | null = null) => {
    render(<DateSelect value={value} min={min} onChange={() => {}} />)
    await userEvent.click(screen.getByRole('textbox'))
  }

  it('greys today when today is itself out of range', async () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    await openWithMin(tomorrow)

    const today = document.querySelector('.react-datepicker__day--today') as HTMLElement
    expect(today).not.toBeNull()
    expect(today).toHaveAttribute('aria-disabled', 'true')

    const winner = winningDeclaration(today, 'color')
    expect(winner?.value).toBe('var(--muted-foreground)')
    expect(winner?.selector).toContain('--disabled')
  })

  it('still accents today when today is selectable', async () => {
    // The accent is the point of the rule; the exclusion must not remove it
    // from the ordinary case.
    // Both dates stay inside the current month: the calendar follows the
    // value's month, and today has to be on screen to be asserted about.
    const monthStart = new Date()
    monthStart.setDate(1)
    const otherDayThisMonth = new Date()
    otherDayThisMonth.setDate(otherDayThisMonth.getDate() === 1 ? 2 : 1)
    await openWithMin(monthStart, otherDayThisMonth)

    const today = document.querySelector('.react-datepicker__day--today') as HTMLElement
    expect(today).toHaveAttribute('aria-disabled', 'false')
    expect(winningDeclaration(today, 'color')?.value).toBe('var(--color-primary-500)')
  })
})
