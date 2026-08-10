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
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import {
  applyDefaultTimeToDate,
  DATE_DISPLAY_FORMAT,
  DATETIME_DISPLAY_FORMAT,
  maskDateInput,
  maskDateTimeInput,
  parseManualDate,
  parseManualDateTime,
} from '@/lib/dateUtils'

/**
 * LastPass / 1Password / Dashlane opt-outs. Their overlays cover the calendar
 * exactly the way Chrome's own suggestion list does (KAN-995).
 *
 * react-datepicker builds its built-in input from a fixed prop list and never
 * forwards ``data-*``, so these can only land on an input we render ourselves.
 * That is why both modes go through a custom input below, not just the masked
 * one — otherwise the ~35 calendar-only call sites (client date of birth,
 * passport issued/expires, …) would stay exposed.
 */
const PASSWORD_MANAGER_OPT_OUT = {
  'data-lpignore': 'true',
  'data-1p-ignore': '',
  'data-form-type': 'other',
} as const

/**
 * Calendar-only counterpart of ``MaskedDateTimeInput``: a faithful pass-through
 * of everything react-datepicker injects, existing only so the opt-out
 * attributes above reach the DOM node. Typing is still blocked by the
 * ``onChangeRaw`` handler on <DatePicker>, which is unaffected by rendering
 * through a custom input.
 */
const PlainDateInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function PlainDateInput(props, ref) {
    return <input {...props} ref={ref} {...PASSWORD_MANAGER_OPT_OUT} />
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
  id?: string
  min?: Date | string
  max?: Date | string
  format?: string
  /** Month-year picker: a grid of months + year navigation, no day grid. */
  showMonthYearPicker?: boolean
  showTimeSelect?: boolean
  timeFormat?: string
  timeIntervals?: number
  /**
   * Opt-in per-field clear. When provided AND a date is set, a small "×"
   * button is rendered on the right that calls this callback. Other usages of
   * DateSelect are unaffected because the × only renders when onClear is set.
   */
  onClear?: () => void
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
      showTimeSelect,
      timeFormat = 'HH:mm',
      timeIntervals = 15,
      onClear,
      minTime,
      maxTime,
      filterTime,
      allowManualInput = false,
      defaultTime,
      defaultTimeSkipsToday,
      onValidityChange,
      invalidText,
      resyncInvalidOnBlur = false,
    },
    ref
  ) => {
    const generatedId = useId()
    const inputId = id || generatedId
    const errorId = `${inputId}-error`
    const helperId = `${inputId}-helper`
    // Opaque and always derived from the generated id, never a caller-supplied
    // one, because Chrome ignores autocomplete="off" on fields it classifies as
    // profile data and a date field reads as a birthday. This removes the name
    // from what the classifier can see; the caller's `id` and the visible label
    // are still readable by it, so a semantic call site (promise-date,
    // task-due-date) may need the stronger autocomplete token (KAN-995).
    // The character whitelist keeps the value well formed across React
    // versions: useId emits ':r0:' on 18 and '_r_0_' on 19.
    const autofillName = `ds-${generatedId.replace(/[^a-zA-Z0-9_-]/g, '')}`
    const { t } = useTranslation('common')

    const isDateOnlyManual = allowManualInput && !showTimeSelect
    const isDatetimeManual = allowManualInput && !!showTimeSelect
    const manualDisplayFormat = isDateOnlyManual ? DATE_DISPLAY_FORMAT : DATETIME_DISPLAY_FORMAT

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
    }, [value, allowManualInput])

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
      const masked = isDateOnlyManual ? maskDateInput(raw) : maskDateTimeInput(raw)
      setText(masked)
      if (masked === '') {
        setManualInvalid(false)
        onValidityChange?.(false)
        onChange?.({ value: null })
        return
      }
      const parsed = isDateOnlyManual ? parseManualDate(masked) : parseManualDateTime(masked)
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

    // TA datetime fields: inline error under the input while typing invalid text.
    // Date filter fields: border only — no inline message.
    const manualInlineError =
      manualInvalid && isDatetimeManual ? t('pages.clientChains.errors.dateInvalid') : undefined
    const displayedError = error || manualInlineError

    const inputClassName = cn(
      'h-[45px] w-full rounded-md border border-input-border bg-input pr-4 pl-10 text-sm font-light text-foreground transition-all outline-none placeholder:text-muted-foreground',
      showClear && 'pr-10',
      hasError ? 'border-red-500 focus:border-red-500' : 'focus:border-primary-500',
      className
    )

    const effectivePlaceholder =
      allowManualInput && placeholder === 'Select date'
        ? isDateOnlyManual
          ? 'DD.MM.YYYY'
          : 'DD.MM.YYYY HH:MM'
        : placeholder

    return (
      <div className={`w-full ${className || ''}`}>
        {label && (
          <label htmlFor={inputId} className="text-foreground mb-1.5 block text-sm font-light">
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
              id={inputId}
              name={autofillName}
              autoComplete="off"
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
              dateFormat={format}
              placeholderText={effectivePlaceholder}
              disabled={disabled}
              minDate={parseDate(min) || undefined}
              maxDate={parseDate(max) || undefined}
              aria-describedby={displayedError ? errorId : helperText ? helperId : undefined}
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
              showYearDropdown
              scrollableYearDropdown
              yearDropdownItemNumber={10}
            />
          </div>
          {showClear && (
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear"
              className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 z-10 flex items-center pr-3"
            >
              <Icons.Cancel01 size={14} />
            </button>
          )}
        </div>
        {error ? (
          <p id={errorId} className="mt-1.5 text-xs text-red-500" role="alert">
            {displayedError}
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
