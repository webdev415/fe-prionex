/**
 * DateSelect Component
 *
 * A styled date input component using react-datepicker.
 * Matches the design with calendar icon and placeholder support.
 */

import { forwardRef, useEffect, useId, useRef, useState } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import './DateSelect.theme.css'
import { format as formatFns } from 'date-fns'
import i18n from '@/lib/i18n'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import {
  applyDefaultTimeToDate,
  DATE_DISPLAY_FORMAT,
  DATETIME_DISPLAY_FORMAT,
  displayFormatForLanguage,
  isSpanishLanguage,
  maskDateInput,
  maskDateTimeInput,
  parseManualDate,
  parseManualDateTime,
  pickerLocaleForLanguage,
} from '@/lib/dateUtils'
import { opaqueFieldName, PASSWORD_MANAGER_OPT_OUT } from './autofill'

/**
 * Calendar-only counterpart of ``MaskedDateTimeInput``: a faithful pass-through
 * of everything react-datepicker injects, existing only so the opt-out
 * attributes from ``./autofill`` reach the DOM node. Typing is still blocked by
 * the ``onChangeRaw`` handler on <DatePicker>, which is unaffected by rendering
 * through a custom input.
 *
 * That indirection is what forces both modes below through a custom input
 * rather than only the masked one: react-datepicker builds its built-in input
 * from a fixed prop list and never forwards ``data-*``, so the ~35
 * calendar-only call sites (client date of birth, passport issued/expires, …)
 * would otherwise stay exposed.
 */
const PlainDateInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function PlainDateInput(props, ref) {
    return <input type="text" {...props} ref={ref} {...PASSWORD_MANAGER_OPT_OUT} />
  }
)

/**
 * Custom input used when ``allowManualInput`` is on. react-datepicker clones
 * this and injects ``value``/``onChange`` (its own typed-input handler) — we
 * ignore both and drive the field from our own masked ``text`` state so the
 * displayed value, masking, and validity are fully under our control. All
 * other injected props (onClick/onFocus/onBlur/onKeyDown/className/…) are
 * forwarded so the calendar popup still opens and closes normally.
 */
const MaskedDateTimeInput = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & {
    text: string
    onTextChange: (raw: string) => void
    onTextBlur?: () => void
  }
>(function MaskedDateTimeInput(
  { value: _v, onChange: _oc, text, onTextChange, onTextBlur, onBlur, ...rest },
  ref
) {
  return (
    <input
      type="text"
      {...rest}
      ref={ref}
      value={text}
      onChange={(e) => onTextChange(e.target.value)}
      onBlur={(e) => {
        // Keep react-datepicker's injected blur handling (popup close etc.),
        // then let DateSelect resync abandoned text from the committed value.
        onBlur?.(e)
        onTextBlur?.()
      }}
      inputMode="numeric"
      {...PASSWORD_MANAGER_OPT_OUT}
    />
  )
})

export interface DateSelectProps {
  label?: string
  error?: string
  required?: boolean
  helperText?: string
  className?: string
  placeholder?: string
  value?: string | Date | null
  onChange?: (args: { value: Date | null }) => void
  disabled?: boolean
  /**
   * Applied to the WRAPPER element, not the field. The input itself always
   * carries a generated opaque id so a semantic value cannot reach Chrome's
   * autofill classifier (KAN-995). Use ``label`` for association, or query
   * within the wrapper — an external ``htmlFor``/``#id`` aimed at this value
   * would target a div.
   */
  id?: string
  min?: Date | string
  max?: Date | string
  format?: string
  /** Month-year picker: a grid of months + year navigation, no day grid. */
  showMonthYearPicker?: boolean
  /**
   * Pick a year and nothing else. For a field that stores a year rather than a
   * day - a graduation year, say - where offering a month and a day invites
   * somebody to choose two values that are then thrown away.
   */
  showYearPicker?: boolean
  showTimeSelect?: boolean
  timeFormat?: string
  timeIntervals?: number
  /**
   * Opt-in per-field clear. When provided AND a date is set, a small "×"
   * button is rendered on the right that calls this callback. Other usages of
   * DateSelect are unaffected because the × only renders when onClear is set.
   */
  onClear?: () => void
  /**
   * Accessible name of that "×" button. Opt-in: the default stays the plain
   * "Clear" every existing usage renders. Pass a field-specific (localized)
   * name when a form places SEVERAL clearable date fields side by side — a row
   * of identical "Clear" buttons is indistinguishable to a screen reader.
   */
  clearLabel?: string
  // Restrict the selectable time-of-day inside the time column.
  // ``minTime``/``maxTime`` are react-datepicker's static bounds and
  // apply to **every** selected calendar day, so they're only correct
  // when the same restriction holds regardless of the day. For
  // day-aware rules (e.g. "block past times today but allow any time
  // on future days"), use ``filterTime`` instead — react-datepicker
  // calls it with a Date that carries both the selected day and the
  // slot's time-of-day, so the callback can decide per slot.
  minTime?: Date
  maxTime?: Date
  /** Per-slot predicate. Return ``true`` to keep, ``false`` to grey out. */
  filterTime?: (time: Date) => boolean
  /**
   * Allow typing the value directly, in addition to the calendar picker.
   * With ``showTimeSelect``: ``DD.MM.YYYY HH:MM`` mask (TA date fields).
   * Without ``showTimeSelect``: ``DD.MM.YYYY`` mask (date filter fields).
   * When off (default) the field stays calendar-only (legacy behaviour).
   */
  allowManualInput?: boolean
  /**
   * Time-of-day applied the first time a date is set within this field's
   * lifetime (e.g. ``"09:00"``). Subsequent date changes keep whatever time
   * is already there. Only meaningful with ``showTimeSelect``.
   */
  defaultTime?: string
  /**
   * Skip the ``defaultTime`` auto-fill when the picked day is today
   * (browser-local). For forms where today + the default would land in
   * the past. Omit to keep the default firing on today too.
   */
  defaultTimeSkipsToday?: boolean
  /**
   * Called whenever the typed value's validity changes. ``true`` means the
   * field currently holds incomplete/invalid text that should block saving.
   * Only fires in manual-input mode.
   */
  onValidityChange?: (invalid: boolean) => void
  /**
   * Inline message shown (red, below the field) when the manually-typed value
   * is incomplete/invalid. Lets the caller surface a translated error right at
   * the input, instead of only on save. Ignored when ``error`` is set.
   */
  invalidText?: string
  /**
   * On blur, also resync an INVALID partial entry back to the committed
   * value (a cleared/empty field always resyncs regardless of this flag).
   * Off by default: most forms keep the invalid text visible together with
   * ``invalidText``/``onValidityChange`` so the user can fix it — wiping it
   * on blur would silently discard the entry and its explanation.
   * URL-backed filter fields (e.g. the processing report dates) opt in:
   * there an abandoned invalid entry has nothing to block and should just
   * snap back to the active filter value.
   */
  resyncInvalidOnBlur?: boolean
  /**
   * Escape hatch for Chrome's autofill (KAN-995). ``off`` suppresses the
   * saved-value list everywhere, but Chrome ignores it on fields its classifier
   * reads as profile data. The rendered ``id`` and ``name`` are both opaque, so
   * what it can still read is the visible label and the placeholder (manual
   * mode sets ``DD.MM.YYYY``).
   *
   * ``new-password`` is the token Chrome always honours, and it is what the
   * client date-of-birth and passport fields use. Two costs come with it, and
   * both need re-checking in Chrome if that set ever grows:
   *
   * - it declares a credential purpose, so Chrome may attach password-manager
   *   UI to the field — a save prompt on submit, or a suggestion dropdown that
   *   would cover the calendar exactly the way the autofill list does. Chrome
   *   reserves password generation for ``type="password"`` inputs and these are
   *   ``type="text"``, so this is unlikely rather than impossible;
   * - it is not the field's real purpose. WCAG 1.3.5 would want ``bday`` on a
   *   date of birth, but 1.3.5 covers fields collecting data about *the user*.
   *   These collect a client's data, so ``bday`` is not merely unhelpful there,
   *   it is wrong: it invites Chrome to write the operator's own birthday into
   *   a debtor record.
   */
  autoComplete?: string
}

const parseDate = (date: Date | string | null | undefined): Date | null => {
  if (!date) return null
  if (date instanceof Date) return date
  // Date-only strings ("YYYY-MM-DD") represent a calendar day, not a
  // moment in time. ``new Date("2026-05-27")`` would parse them as UTC
  // midnight; browsers west of UTC then render them as the previous
  // local day inside react-datepicker (clicking 27 shows 26). Build
  // the Date at **local** midnight so the picker's input matches the
  // calendar cell the user clicked.
  const ymdMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch
    return new Date(+y, +m - 1, +d, 0, 0, 0, 0)
  }
  const parsed = new Date(date)
  return isNaN(parsed.getTime()) ? null : parsed
}

const manualPlaceholder = (dateOnly: boolean, spanish: boolean): string => {
  const date = spanish ? 'DD/MM/AAAA' : 'DD.MM.YYYY'
  return dateOnly ? date : `${date} HH:MM`
}

const DateSelect = forwardRef<DatePicker, DateSelectProps>(
  (
    {
      label,
      error,
      required,
      helperText,
      className,
      id,
      value,
      placeholder = 'Select date',
      onChange,
      disabled,
      min,
      max,
      format = 'MM/dd/yyyy',
      showMonthYearPicker = false,
      showYearPicker = false,
      showTimeSelect,
      timeFormat = 'HH:mm',
      timeIntervals = 15,
      onClear,
      clearLabel = 'Clear',
      minTime,
      maxTime,
      filterTime,
      allowManualInput = false,
      defaultTime,
      defaultTimeSkipsToday,
      onValidityChange,
      invalidText,
      resyncInvalidOnBlur = false,
      autoComplete = 'off',
    },
    ref
  ) => {
    const generatedId = useId()
    const describedByBase = id || generatedId
    const errorId = `${describedByBase}-error`
    const helperId = `${describedByBase}-helper`
    // The rendered input's id AND name, always derived from the generated id and
    // never from a caller-supplied one. Chrome ignores autocomplete="off" on
    // fields it classifies as profile data, and it classifies from id, name,
    // placeholder and label — so a semantic call site (promise-date,
    // task-due-date, start_date) must not reach the element it inspects. The
    // caller's `id` moves to the wrapper instead, where it stays available to
    // CSS and automation but is not a form field. The visible label and the
    // placeholder are still readable by the classifier, which is what the
    // `autoComplete` prop exists to override (KAN-995).
    //
    // This is why the default here is still `off` while the shared `Input`
    // defaults to `new-password` (KAN-1009), even though both now read their
    // opt-outs from the same module. `Input` leaves the caller's id in place
    // and has no equivalent of the wrapper trick, so there the id and name are
    // signals too; here only the label and placeholder are left, and neither
    // reads as profile data on a standalone date field. The three that do -
    // date of birth, passport issued and expires - pass `new-password` at the
    // call site. Aligning the two defaults would let those three props go, but
    // it changes behaviour for ~35 shipped call sites for no reported bug, so
    // it is left alone deliberately.
    const opaqueFieldId = opaqueFieldName('ds', generatedId)

    const language = i18n.language
    const spanish = isSpanishLanguage(language)
    const dateSeparator = spanish ? '/' : '.'
    const isDateOnlyManual = allowManualInput && !showTimeSelect
    const manualDisplayFormat = displayFormatForLanguage(
      isDateOnlyManual ? DATE_DISPLAY_FORMAT : DATETIME_DISPLAY_FORMAT,
      language
    )

    // ── Manual-input state (only used when allowManualInput) ──────────────
    // Visible masked text. Driven by us, not react-datepicker.
    const [text, setText] = useState<string>(() => {
      if (!allowManualInput) return ''
      const d = parseDate(value)
      return d ? formatFns(d, manualDisplayFormat) : ''
    })
    // Whether the field currently holds invalid/incomplete typed text.
    const [manualInvalid, setManualInvalid] = useState(false)

    // Keep the visible text in sync when the committed value changes from the
    // outside (hydration, programmatic reset). We key off the *formatted*
    // value, not the prop identity: callers may pass a fresh Date object each
    // render, and we must not clobber an in-progress invalid/partial entry
    // (which never updates `value`, so its formatted value is unchanged).
    const lastSyncedValue = useRef<string>(text)
    useEffect(() => {
      if (!allowManualInput) return
      const d = parseDate(value)
      const formatted = d ? formatFns(d, manualDisplayFormat) : ''
      if (formatted === lastSyncedValue.current) return
      lastSyncedValue.current = formatted
      setText(formatted)
      setManualInvalid(false)
      onValidityChange?.(false)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, allowManualInput, manualDisplayFormat])

    // If a field unmounts while invalid, clear the parent's invalid flag so a
    // stale entry can't block a later save.
    useEffect(() => {
      return () => {
        if (allowManualInput) onValidityChange?.(false)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Apply the default time (e.g. 09:00) only when the user sets the DATE
    // first — a calendar *day* click — and there's no committed value yet.
    //   • Case "date first" (day click, no value): seed 09:00. The user then
    //     refines the time if they want.
    //   • Case "time first" (time-list click, no value): keep the chosen time
    //     — the user explicitly picked it, so don't stomp it with 09:00.
    // We distinguish the two via react-datepicker's onChange signature: a day
    // click passes an ``event`` (setSelected), a time-list click does not
    // (handleTimeChange calls onChange with the date only). On later changes a
    // value already exists, so the default never re-applies and react-datepicker
    // preserves the existing time when only the day changes.
    // Calendar selection (and time-list clicks) come through here. A day click
    // carries a React event; a time-list click calls onChange with no event.
    const handleChange = (date: Date | null, event?: React.SyntheticEvent) => {
      const fromDayClick = !!event
      const next = date
        ? applyDefaultTimeToDate(date, {
            defaultTime,
            hasExistingValue: !!parseDate(value),
            fromDayClick,
            skipIfToday: defaultTimeSkipsToday,
          })
        : null
      if (allowManualInput) {
        setText(next ? formatFns(next, manualDisplayFormat) : '')
        setManualInvalid(false)
        onValidityChange?.(false)
      }
      onChange?.({ value: next })
    }

    // × only renders when opt-in onClear is provided AND a date is set.
    const showClear = !!onClear && parseDate(value) !== null

    // Typed input: mask, then commit only when complete + valid. Datetime
    // manual entry always includes the time (the mask requires HH:MM), so the
    // 09:00 default doesn't apply there — the typed time wins.
    const handleManualType = (raw: string) => {
      const masked = isDateOnlyManual
        ? maskDateInput(raw, dateSeparator)
        : maskDateTimeInput(raw, dateSeparator)
      setText(masked)
      if (masked === '') {
        setManualInvalid(false)
        onValidityChange?.(false)
        onChange?.({ value: null })
        return
      }
      const parsed = isDateOnlyManual
        ? parseManualDate(masked, manualDisplayFormat)
        : parseManualDateTime(masked, manualDisplayFormat)
      if (parsed) {
        setManualInvalid(false)
        onValidityChange?.(false)
        onChange?.({ value: parsed })
      } else {
        // Keep the last committed value; flag the field as blocking.
        setManualInvalid(true)
        onValidityChange?.(true)
      }
    }

    // Focus left the field with text that no longer matches the committed
    // value — e.g. the user cleared it (some parents keep the old value on
    // ``onChange(null)``) or abandoned a partial entry. Restore the text from
    // the ``value`` prop so the field never sits empty/stale while a filter
    // is still active. The value-keyed sync effect above can't cover this
    // case: ``value`` hasn't changed, so it bails on
    // ``formatted === lastSyncedValue.current``.
    const handleManualBlur = () => {
      if (!allowManualInput) return
      // A complete VALID text is never overwritten — even if it differs from
      // the `value` prop (e.g. a future consumer debounces the committed
      // value), the user's entry must not snap back on blur.
      if (!manualInvalid && text !== '') return
      // An INVALID partial entry is preserved by default so forms keep the
      // text + its `invalidText` explanation visible for fixing; only
      // opted-in fields (resyncInvalidOnBlur) snap it back. A cleared/empty
      // field always resyncs — that path carries no explanation to lose.
      if (manualInvalid && !resyncInvalidOnBlur) return
      const d = parseDate(value)
      const formatted = d ? formatFns(d, manualDisplayFormat) : ''
      if (text === formatted) return
      lastSyncedValue.current = formatted
      setText(formatted)
      setManualInvalid(false)
      onValidityChange?.(false)
    }

    // Red styling for both an explicit error and an in-progress invalid entry.
    const hasError = !!error || manualInvalid

    // Mirrors exactly when the <p id={errorId}> below renders, so
    // aria-describedby can never reference an element that is not there. The
    // complement is the helper paragraph's own condition. TA datetime fields
    // surface their inline message through `invalidText`, which is the second
    // branch — the component has no separate built-in message of its own.
    const errorMessageShown = !!error || (manualInvalid && !!invalidText)

    const inputClassName = cn(
      'h-[45px] w-full rounded-md border border-input-border bg-input pr-4 pl-10 text-sm font-light text-foreground transition-all outline-none placeholder:text-muted-foreground',
      showClear && 'pr-10',
      hasError ? 'border-red-500 focus:border-red-500' : 'focus:border-primary-500',
      className
    )

    const effectivePlaceholder =
      allowManualInput && placeholder === 'Select date'
        ? manualPlaceholder(isDateOnlyManual, spanish)
        : placeholder

    return (
      <div id={id} className={`w-full ${className || ''}`}>
        {label && (
          <label
            htmlFor={opaqueFieldId}
            className="text-foreground mb-1.5 block text-sm font-light"
          >
            {label}
            {required && <span className="text-error-500 ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3">
            <Icons.Calendar size={18} className="text-muted-foreground" strokeWidth={1.5} />
          </div>
          <div className="date-select-wrapper" data-has-error={hasError ? 'true' : 'false'}>
            <DatePicker
              ref={ref}
              id={opaqueFieldId}
              name={opaqueFieldId}
              autoComplete={autoComplete}
              className={inputClassName}
              selected={parseDate(value)}
              onChange={handleChange}
              // Calendar-only mode blocks raw typing. Manual mode instead
              // routes typing through the masked custom input below.
              {...(allowManualInput
                ? {
                    customInput: (
                      <MaskedDateTimeInput
                        text={text}
                        onTextChange={handleManualType}
                        onTextBlur={handleManualBlur}
                      />
                    ),
                  }
                : {
                    customInput: <PlainDateInput />,
                    onChangeRaw: (e?: React.SyntheticEvent) => e?.preventDefault(),
                  })}
              dateFormat={displayFormatForLanguage(format, language)}
              locale={pickerLocaleForLanguage(language)}
              placeholderText={effectivePlaceholder}
              disabled={disabled}
              minDate={parseDate(min) || undefined}
              maxDate={parseDate(max) || undefined}
              aria-describedby={errorMessageShown ? errorId : helperText ? helperId : undefined}
              // Same condition as the red border, so the visual invalid state
              // always has a programmatic counterpart — including the case
              // where the field is invalid but the caller passed no message.
              aria-invalid={hasError ? 'true' : undefined}
              showPopperArrow={false}
              popperPlacement="bottom-start"
              popperClassName="date-select-popper"
              calendarClassName="date-select-calendar"
              popperProps={{ strategy: 'fixed' }}
              showTimeSelect={showTimeSelect}
              timeFormat={timeFormat}
              timeIntervals={timeIntervals}
              // react-datepicker's minTime/maxTime only apply when the
              // selected day equals "today" (their behaviour), which is
              // exactly the case we need to guard. Other days fall back
              // to the natural 00:00–23:59 range.
              minTime={minTime}
              maxTime={maxTime}
              filterTime={filterTime}
              calendarStartDay={1}
              showMonthYearPicker={showMonthYearPicker}
              showYearPicker={showYearPicker}
              showYearDropdown
              scrollableYearDropdown
              yearDropdownItemNumber={10}
            />
          </div>
          {showClear && (
            <button
              type="button"
              onClick={onClear}
              aria-label={clearLabel}
              className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 z-10 flex items-center pr-3"
            >
              <Icons.Cancel01 size={14} />
            </button>
          )}
        </div>
        {error ? (
          <p id={errorId} className="mt-1.5 text-xs text-red-500" role="alert">
            {error}
          </p>
        ) : manualInvalid && invalidText ? (
          <p id={errorId} className="mt-1.5 text-xs text-red-500" role="alert">
            {invalidText}
          </p>
        ) : null}
        {helperText && !error && !(manualInvalid && invalidText) && (
          <p id={helperId} className="text-muted-foreground mt-1.5 text-xs">
            {helperText}
          </p>
        )}
      </div>
    )
  }
)

DateSelect.displayName = 'DateSelect'

export { DateSelect }
