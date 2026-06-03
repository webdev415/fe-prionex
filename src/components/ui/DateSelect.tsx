/**
 * DateSelect Component
 *
 * A styled date input component using react-datepicker.
 * Matches the design with calendar icon and placeholder support.
 */

import { forwardRef, useEffect, useId, useRef, useState } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { format as formatFns } from 'date-fns'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { DATETIME_DISPLAY_FORMAT, maskDateTimeInput, parseManualDateTime } from '@/lib/dateUtils'

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
  }
>(function MaskedDateTimeInput({ value: _v, onChange: _oc, text, onTextChange, ...rest }, ref) {
  return (
    <input
      {...rest}
      ref={ref}
      value={text}
      onChange={(e) => onTextChange(e.target.value)}
      inputMode="numeric"
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
  showTimeSelect?: boolean
  timeFormat?: string
  timeIntervals?: number
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
   * Allow typing the value directly with a ``DD.MM.YYYY HH:MM`` mask, in
   * addition to the calendar picker. When off (default) the field stays
   * calendar-only (legacy behaviour for other call sites).
   */
  allowManualInput?: boolean
  /**
   * Time-of-day applied the first time a date is set within this field's
   * lifetime (e.g. ``"09:00"``). Subsequent date changes keep whatever time
   * is already there. Only meaningful with ``showTimeSelect``.
   */
  defaultTime?: string
  /**
   * Called whenever the typed value's validity changes. ``true`` means the
   * field currently holds incomplete/invalid text that should block saving.
   * Only fires in manual-input mode.
   */
  onValidityChange?: (invalid: boolean) => void
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
      showTimeSelect,
      timeFormat = 'HH:mm',
      timeIntervals = 15,
      minTime,
      maxTime,
      filterTime,
      allowManualInput = false,
      defaultTime,
      onValidityChange,
    },
    ref
  ) => {
    const generatedId = useId()
    const inputId = id || generatedId
    const errorId = `${inputId}-error`
    const helperId = `${inputId}-helper`

    // ── Manual-input state (only used when allowManualInput) ──────────────
    // Visible masked text. Driven by us, not react-datepicker.
    const [text, setText] = useState<string>(() => {
      const d = parseDate(value)
      return d ? formatFns(d, DATETIME_DISPLAY_FORMAT) : ''
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
      const formatted = d ? formatFns(d, DATETIME_DISPLAY_FORMAT) : ''
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

    // Apply the default time (e.g. 09:00) only on the FIRST date set — i.e.
    // when there is no committed value yet. On later changes we leave the
    // time alone: react-datepicker's own setSelected re-applies the previously
    // selected time when only the day changes, so changing the date keeps the
    // time the user already has (per spec). Keying off the current ``value``
    // (rather than a one-way flag) also keeps this correct when the same
    // component instance is reused across wizard steps.
    const applyDefaultTime = (date: Date): Date => {
      if (!defaultTime || parseDate(value)) return date
      const [h, m] = defaultTime.split(':').map(Number)
      const next = new Date(date)
      next.setHours(h || 0, m || 0, 0, 0)
      return next
    }

    // Calendar selection (and time-list clicks) come through here.
    const handleChange = (date: Date | null) => {
      const next = date ? applyDefaultTime(date) : null
      if (allowManualInput) {
        setText(next ? formatFns(next, DATETIME_DISPLAY_FORMAT) : '')
        setManualInvalid(false)
        onValidityChange?.(false)
      }
      onChange?.({ value: next })
    }

    // Typed input: mask, then commit only when complete + valid. Manual entry
    // always includes the time (the mask requires HH:MM), so the 09:00 default
    // doesn't apply here — the typed time wins.
    const handleManualType = (raw: string) => {
      const masked = maskDateTimeInput(raw)
      setText(masked)
      if (masked === '') {
        setManualInvalid(false)
        onValidityChange?.(false)
        onChange?.({ value: null })
        return
      }
      const parsed = parseManualDateTime(masked)
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

    // Red styling for both an explicit error and an in-progress invalid entry.
    const hasError = !!error || manualInvalid

    const inputClassName = cn(
      'h-[45px] w-full rounded-md border bg-white pr-4 pl-10 text-sm font-light text-[#05040D] transition-all outline-none placeholder:text-gray-500',
      hasError
        ? 'border-red-500 focus:border-red-500'
        : 'border-gray-300 focus:border-[var(--color-primary-500)]',
      className
    )

    const effectivePlaceholder =
      allowManualInput && placeholder === 'Select date' ? 'DD.MM.YYYY HH:MM' : placeholder

    return (
      <div className={`w-full ${className || ''}`}>
        {label && (
          <label htmlFor={inputId} className="text-dark-500 mb-1.5 block text-sm font-light">
            {label}
            {required && <span className="text-error-500 ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3">
            <Icons.Calendar size={18} className="text-gray-500" strokeWidth={1.5} />
          </div>
          <style>{`
            .date-select-wrapper .react-datepicker-wrapper {
              width: 100%;
            }
            .date-select-wrapper .react-datepicker__input-container {
              width: 100%;
            }
            .date-select-wrapper .react-datepicker__input-container input:focus {
              box-shadow: 0 0 0 2px ${hasError ? 'rgba(239, 68, 68, 0.2)' : 'rgba(128, 216, 10, 0.2)'};
            }
            .date-select-wrapper .react-datepicker__input-container input:disabled {
              opacity: 0.5;
              cursor: not-allowed;
            }
            .date-select-wrapper .react-datepicker__input-container input::placeholder {
              color: #6B7280;
            }
            .react-datepicker {
              font-family: inherit;
              border: 1px solid #E5E7EB;
              border-radius: 0.75rem;
              box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
            }
            .react-datepicker__header {
              background-color: #F9FAFB;
              border-bottom: 1px solid #E5E7EB;
              border-top-left-radius: 0.75rem;
              border-top-right-radius: 0.75rem;
              padding-top: 12px;
            }
            .react-datepicker__current-month {
              color: #05040D;
              font-weight: 500;
              font-size: 14px;
            }
            .react-datepicker__day-name {
              color: #4B5563;
              font-weight: 500;
              font-size: 12px;
            }
            .react-datepicker__day {
              color: #05040D;
              border-radius: 0.375rem;
              transition: all 0.15s;
            }
            .react-datepicker__day:hover {
              background-color: #F3F4F6;
              border-radius: 0.375rem;
            }
            .react-datepicker__day--selected,
            .react-datepicker__day--keyboard-selected {
              background-color: var(--color-primary-500) !important;
              color: white !important;
              border-radius: 0.375rem;
            }
            .react-datepicker__day--today {
              font-weight: 600;
              color: var(--color-primary-500);
            }
            .react-datepicker__day--disabled {
              color: #D1D5DB;
            }
            .react-datepicker__navigation {
              top: 12px;
            }
            .react-datepicker__navigation-icon::before {
              border-color: #6B7280;
            }
            .react-datepicker__navigation:hover *::before {
              border-color: #05040D;
            }
            .react-datepicker__year-dropdown-container {
              margin: 0 4px;
            }
            .react-datepicker__year-read-view {
              font-size: 13px;
              font-weight: 500;
              color: #05040D;
              visibility: visible !important;
            }
            .react-datepicker__year-read-view--down-arrow {
              border-color: #6B7280;
              top: 3px;
            }
            .react-datepicker__year-dropdown {
              background-color: white;
              border: 1px solid #E5E7EB;
              border-radius: 0.5rem;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            }
            .react-datepicker__year-option {
              font-size: 13px;
              padding: 4px 8px;
            }
            .react-datepicker__year-option:hover {
              background-color: #F3F4F6;
            }
            .react-datepicker__year-option--selected_year {
              font-weight: 600;
              color: var(--color-primary-500);
            }
            .react-datepicker__triangle {
              display: none;
            }
            .react-datepicker-popper {
              z-index: 200 !important;
            }
          `}</style>
          <div className="date-select-wrapper">
            <DatePicker
              ref={ref}
              id={inputId}
              className={inputClassName}
              selected={parseDate(value)}
              onChange={handleChange}
              // Calendar-only mode blocks raw typing. Manual mode instead
              // routes typing through the masked custom input below.
              {...(allowManualInput
                ? {
                    customInput: (
                      <MaskedDateTimeInput text={text} onTextChange={handleManualType} />
                    ),
                  }
                : { onChangeRaw: (e?: React.SyntheticEvent) => e?.preventDefault() })}
              dateFormat={format}
              placeholderText={effectivePlaceholder}
              disabled={disabled}
              minDate={parseDate(min) || undefined}
              maxDate={parseDate(max) || undefined}
              aria-describedby={error ? errorId : helperText ? helperId : undefined}
              showPopperArrow={false}
              popperPlacement="bottom-start"
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
              showYearDropdown
              scrollableYearDropdown
              yearDropdownItemNumber={10}
            />
          </div>
        </div>
        {error && (
          <p id={errorId} className="mt-1.5 text-xs text-red-500" role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helperId} className="mt-1.5 text-xs text-gray-500">
            {helperText}
          </p>
        )}
      </div>
    )
  }
)

DateSelect.displayName = 'DateSelect'

export { DateSelect }
