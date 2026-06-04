/**
 * DateSelect Component
 *
 * A styled date input component using react-datepicker.
 * - ``variant="filter"``: DD.MM.YYYY masked date-only filters
 * - ``allowManualInput``: DD.MM.YYYY HH:MM masked datetime entry (TA chains, etc.)
 */

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
} from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { format as formatFns } from 'date-fns'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { DATETIME_DISPLAY_FORMAT, maskDateTimeInput, parseManualDateTime } from '@/lib/dateUtils'
import {
  DMY_DOT_MASK_PLACEHOLDER,
  formatDateAsDmyDot,
  maskDmyDotFromDigits,
  validateDmyDotInput,
} from '@/lib/dmyDotDate'

export const DATE_FILTER_FORMAT = 'dd.MM.yyyy'

/**
 * Custom input for ``allowManualInput``. react-datepicker injects value/onChange;
 * we ignore both and drive the field from masked ``text`` state.
 */
const MaskedDateTimeInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & {
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
  /** Date filter fields: DD.MM.YYYY mask, calendar kept, filter not applied when invalid. */
  variant?: 'default' | 'filter'
  showTimeSelect?: boolean
  timeFormat?: string
  timeIntervals?: number
  /** Opt-in clear button when a date is set. */
  onClear?: () => void
  minTime?: Date
  maxTime?: Date
  filterTime?: (time: Date) => boolean
  /**
   * Allow typing DD.MM.YYYY HH:MM (not used together with ``variant="filter"``).
   */
  allowManualInput?: boolean
  /** First-time default time (e.g. ``"09:00"``) when ``showTimeSelect`` is on. */
  defaultTime?: string
  /** Fires when manual-input validity changes (manual mode only). */
  onValidityChange?: (invalid: boolean) => void
}

const parseDate = (date: Date | string | null | undefined): Date | null => {
  if (!date) return null
  if (date instanceof Date) return date
  const ymdMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch
    return new Date(+y, +m - 1, +d, 0, 0, 0, 0)
  }
  const parsed = new Date(date)
  return isNaN(parsed.getTime()) ? null : parsed
}

type FilterInputProps = InputHTMLAttributes<HTMLInputElement> & {
  hasError?: boolean
}

const FilterDateInput = forwardRef<HTMLInputElement, FilterInputProps>(
  ({ hasError, className, ...props }, ref) => (
    <input
      ref={ref}
      {...props}
      className={cn(
        'h-[45px] w-full rounded-md border bg-white pl-10 text-sm font-light text-[#05040D] transition-all outline-none placeholder:text-gray-500',
        hasError
          ? 'border-red-500 focus:border-red-500'
          : 'border-gray-300 focus:border-[var(--color-primary-500)]',
        className
      )}
    />
  )
)
FilterDateInput.displayName = 'FilterDateInput'

type FilterInputBridge = {
  inputText: string
  onMaskedChange: (e: ChangeEvent<HTMLInputElement>) => void
  hasError: boolean
  inputId: string
  placeholder: string
  disabled?: boolean
  helperId?: string
  helperText?: string
  inputClassName?: string
  ensureTextOnFocus: () => void
}

const FilterPickerInputContext = createContext<FilterInputBridge | null>(null)

function pickerPassthroughProps(
  props: InputHTMLAttributes<HTMLInputElement>
): Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'placeholder'> {
  const passthrough = { ...props }
  delete passthrough.value
  delete passthrough.onChange
  delete passthrough.placeholder
  return passthrough
}

const FilterPickerInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  (pickerProps, ref) => {
    const bridge = useContext(FilterPickerInputContext)
    if (!bridge) return null

    const { onFocus, onClick, onBlur } = pickerProps
    const rest = pickerPassthroughProps(pickerProps)

    return (
      <FilterDateInput
        ref={ref}
        {...rest}
        id={bridge.inputId}
        value={bridge.inputText}
        onChange={bridge.onMaskedChange}
        onFocus={(e) => {
          bridge.ensureTextOnFocus()
          onFocus?.(e)
        }}
        onClick={(e) => {
          bridge.ensureTextOnFocus()
          onClick?.(e)
        }}
        onBlur={onBlur}
        disabled={bridge.disabled}
        placeholder={bridge.placeholder}
        hasError={bridge.hasError}
        className={bridge.inputClassName}
        inputMode="numeric"
        autoComplete="off"
        aria-describedby={bridge.helperText ? bridge.helperId : undefined}
        aria-invalid={bridge.hasError || undefined}
      />
    )
  }
)
FilterPickerInput.displayName = 'FilterPickerInput'

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
      format,
      variant = 'default',
      showTimeSelect,
      timeFormat = 'HH:mm',
      timeIntervals = 15,
      onClear,
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
    const helperId = `${inputId}-helper`
    const isFilter = variant === 'filter' && !showTimeSelect
    const isManualDateTime = allowManualInput && !isFilter

    const resolvedFormat = format ?? (isFilter ? DATE_FILTER_FORMAT : 'MM/dd/yyyy')
    const resolvedPlaceholder = isFilter
      ? DMY_DOT_MASK_PLACEHOLDER
      : isManualDateTime && placeholder === 'Select date'
        ? 'DD.MM.YYYY HH:MM'
        : placeholder

    const minDate = parseDate(min)
    const maxDate = parseDate(max)
    const selectedDate = parseDate(value)
    const showClear = !!onClear && selectedDate !== null

    // ── Filter variant state ─────────────────────────────────────────────
    const [filterText, setFilterText] = useState(() => {
      const d = parseDate(value)
      return d ? formatDateAsDmyDot(d) : ''
    })
    const [hasInternalError, setHasInternalError] = useState(false)
    const lastCommittedRef = useRef<number | null>(selectedDate?.getTime() ?? null)

    useEffect(() => {
      if (!isFilter) return
      const d = parseDate(value)
      const valueTime = d?.getTime() ?? null
      if (valueTime === lastCommittedRef.current) return
      lastCommittedRef.current = valueTime
      setFilterText(d ? formatDateAsDmyDot(d) : '')
      setHasInternalError(false)
    }, [value, isFilter])

    const commitFilterDate = useCallback(
      (date: Date | null) => {
        lastCommittedRef.current = date?.getTime() ?? null
        onChange?.({ value: date })
      },
      [onChange]
    )

    const ensureFilterTextOnFocus = useCallback(() => {
      if (selectedDate) {
        const masked = formatDateAsDmyDot(selectedDate)
        setFilterText(masked)
        lastCommittedRef.current = selectedDate.getTime()
      }
    }, [selectedDate])

    const applyFilterMaskedText = useCallback(
      (masked: string) => {
        setFilterText(masked)
        const result = validateDmyDotInput(masked, minDate, maxDate)
        if (result.status === 'empty') {
          setHasInternalError(false)
          if (lastCommittedRef.current !== null) commitFilterDate(null)
          return
        }
        if (result.status === 'valid') {
          setHasInternalError(false)
          if (lastCommittedRef.current !== result.date.getTime()) {
            commitFilterDate(result.date)
          }
          return
        }
        setHasInternalError(true)
        if (lastCommittedRef.current !== null) commitFilterDate(null)
      },
      [minDate, maxDate, commitFilterDate]
    )

    const handleFilterInputChange = useCallback(
      (e: ChangeEvent<HTMLInputElement>) => {
        applyFilterMaskedText(maskDmyDotFromDigits(e.target.value))
      },
      [applyFilterMaskedText]
    )

    // ── Manual datetime state ────────────────────────────────────────────
    const [manualText, setManualText] = useState(() => {
      const d = parseDate(value)
      return d ? formatFns(d, DATETIME_DISPLAY_FORMAT) : ''
    })
    const [manualInvalid, setManualInvalid] = useState(false)
    const lastSyncedManualValue = useRef(manualText)

    useEffect(() => {
      if (!isManualDateTime) return
      const d = parseDate(value)
      const formatted = d ? formatFns(d, DATETIME_DISPLAY_FORMAT) : ''
      if (formatted === lastSyncedManualValue.current) return
      lastSyncedManualValue.current = formatted
      setManualText(formatted)
      setManualInvalid(false)
      onValidityChange?.(false)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, isManualDateTime])

    useEffect(() => {
      if (!isManualDateTime) return
      return () => {
        onValidityChange?.(false)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isManualDateTime])

    const applyDefaultTime = useCallback(
      (date: Date): Date => {
        if (!defaultTime || parseDate(value)) return date
        const [h, m] = defaultTime.split(':').map(Number)
        const next = new Date(date)
        next.setHours(h || 0, m || 0, 0, 0)
        return next
      },
      [defaultTime, value]
    )

    const handleManualType = useCallback(
      (raw: string) => {
        const masked = maskDateTimeInput(raw)
        setManualText(masked)
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
          setManualInvalid(true)
          onValidityChange?.(true)
        }
      },
      [onChange, onValidityChange]
    )

    const handlePickerChange = useCallback(
      (date: Date | null) => {
        if (isFilter) {
          if (!date) {
            setFilterText('')
            setHasInternalError(false)
            commitFilterDate(null)
            return
          }
          const masked = formatDateAsDmyDot(date)
          const result = validateDmyDotInput(masked, minDate, maxDate)
          setFilterText(masked)
          if (result.status === 'valid') {
            setHasInternalError(false)
            commitFilterDate(result.date)
          } else {
            setHasInternalError(true)
            if (lastCommittedRef.current !== null) commitFilterDate(null)
          }
          return
        }

        const next = date ? applyDefaultTime(date) : null
        if (isManualDateTime) {
          const formatted = next ? formatFns(next, DATETIME_DISPLAY_FORMAT) : ''
          setManualText(formatted)
          lastSyncedManualValue.current = formatted
          setManualInvalid(false)
          onValidityChange?.(false)
        }
        onChange?.({ value: next })
      },
      [
        isFilter,
        isManualDateTime,
        minDate,
        maxDate,
        commitFilterDate,
        applyDefaultTime,
        onChange,
        onValidityChange,
      ]
    )

    const hasError =
      !!error || (isFilter && hasInternalError) || (isManualDateTime && manualInvalid)

    const inputPadding = showClear ? 'pr-10' : 'pr-4'
    const inputClassName = cn(
      'h-[45px] w-full rounded-md border bg-white pl-10 text-sm font-light text-[#05040D] transition-all outline-none placeholder:text-gray-500',
      inputPadding,
      hasError
        ? 'border-red-500 focus:border-red-500'
        : 'border-gray-300 focus:border-[var(--color-primary-500)]',
      !isFilter ? className : undefined
    )

    const filterBridge: FilterInputBridge | null = isFilter
      ? {
          inputText: filterText,
          onMaskedChange: handleFilterInputChange,
          hasError,
          inputId,
          placeholder: resolvedPlaceholder,
          disabled,
          helperId,
          helperText,
          inputClassName: cn(inputPadding, className),
          ensureTextOnFocus: ensureFilterTextOnFocus,
        }
      : null

    const datePicker = (
      <DatePicker
        ref={ref}
        id={inputId}
        className={isFilter ? undefined : inputClassName}
        selected={selectedDate}
        onChange={handlePickerChange}
        {...(isFilter || isManualDateTime
          ? {
              customInput: isFilter ? (
                <FilterPickerInput />
              ) : (
                <MaskedDateTimeInput text={manualText} onTextChange={handleManualType} />
              ),
            }
          : { onChangeRaw: (e?: React.SyntheticEvent) => e?.preventDefault() })}
        dateFormat={resolvedFormat}
        placeholderText={resolvedPlaceholder}
        disabled={disabled}
        minDate={minDate || undefined}
        maxDate={maxDate || undefined}
        aria-describedby={error ? undefined : helperText ? helperId : undefined}
        showPopperArrow={false}
        popperPlacement="bottom-start"
        popperProps={{ strategy: 'fixed' }}
        showTimeSelect={showTimeSelect}
        timeFormat={timeFormat}
        timeIntervals={timeIntervals}
        minTime={minTime}
        maxTime={maxTime}
        filterTime={filterTime}
        calendarStartDay={1}
        showYearDropdown
        scrollableYearDropdown
        yearDropdownItemNumber={10}
      />
    )

    return (
      <div className={cn('w-full', isFilter ? className : undefined)}>
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
            {isFilter ? (
              <FilterPickerInputContext.Provider value={filterBridge}>
                {datePicker}
              </FilterPickerInputContext.Provider>
            ) : (
              datePicker
            )}
          </div>
          {showClear && (
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear"
              className="absolute inset-y-0 right-0 z-10 flex items-center pr-3 text-gray-400 hover:text-gray-600"
            >
              <Icons.Cancel01 size={14} />
            </button>
          )}
        </div>
        {error && (
          <p className="mt-1.5 text-xs text-red-500" role="alert">
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
