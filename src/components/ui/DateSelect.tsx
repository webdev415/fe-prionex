/**
 * DateSelect Component
 *
 * A styled date input component using react-datepicker.
 * ``variant="filter"`` enables DD.MM.YYYY masked keyboard input for date filters.
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
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import {
  DMY_DOT_MASK_PLACEHOLDER,
  formatDateAsDmyDot,
  maskDmyDotFromDigits,
  validateDmyDotInput,
} from '@/lib/dmyDotDate'

export const DATE_FILTER_FORMAT = 'dd.MM.yyyy'

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
  /** Date filter fields: DD.MM.YYYY mask, inline validation, calendar kept. */
  variant?: 'default' | 'filter'
  showTimeSelect?: boolean
  timeFormat?: string
  timeIntervals?: number
  minTime?: Date
  maxTime?: Date
  filterTime?: (time: Date) => boolean
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
        'h-[45px] w-full rounded-md border bg-white pr-4 pl-10 text-sm font-light text-[#05040D] transition-all outline-none placeholder:text-gray-500',
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
  ensureTextOnFocus: () => void
}

const FilterPickerInputContext = createContext<FilterInputBridge | null>(null)

/** Drop react-datepicker-controlled props; we drive value/onChange/placeholder ourselves. */
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
      error: externalError,
      required,
      helperText,
      className,
      id,
      value,
      placeholder: _placeholder,
      onChange,
      disabled,
      min,
      max,
      format,
      variant = 'default',
      showTimeSelect,
      timeFormat = 'HH:mm',
      timeIntervals = 15,
      minTime,
      maxTime,
      filterTime,
    },
    ref
  ) => {
    const generatedId = useId()
    const inputId = id || generatedId
    const helperId = `${inputId}-helper`
    const isFilter = variant === 'filter' && !showTimeSelect

    const resolvedFormat = format ?? (isFilter ? DATE_FILTER_FORMAT : 'MM/dd/yyyy')
    const filterPlaceholder = DMY_DOT_MASK_PLACEHOLDER
    const resolvedPlaceholder = isFilter ? filterPlaceholder : (_placeholder ?? 'Select date')

    const minDate = parseDate(min)
    const maxDate = parseDate(max)
    const selectedDate = parseDate(value)

    const initialText = () => {
      const d = parseDate(value)
      return d ? formatDateAsDmyDot(d) : ''
    }

    const [inputText, setInputText] = useState(initialText)
    const [hasInternalError, setHasInternalError] = useState(false)
    const lastCommittedRef = useRef<number | null>(selectedDate?.getTime() ?? null)

    useEffect(() => {
      if (!isFilter) return
      const d = parseDate(value)
      const valueTime = d?.getTime() ?? null
      if (valueTime === lastCommittedRef.current) return
      lastCommittedRef.current = valueTime
      // Sync mask text when value changes externally (e.g. Clear All), not from typing.
      /* eslint-disable react-hooks/set-state-in-effect -- prop-driven reset of local edit buffer */
      setInputText(d ? formatDateAsDmyDot(d) : '')
      setHasInternalError(false)
      /* eslint-enable react-hooks/set-state-in-effect */
    }, [value, isFilter])

    const commitDate = useCallback(
      (date: Date | null) => {
        lastCommittedRef.current = date?.getTime() ?? null
        onChange?.({ value: date })
      },
      [onChange]
    )

    const ensureTextOnFocus = useCallback(() => {
      if (selectedDate) {
        const masked = formatDateAsDmyDot(selectedDate)
        setInputText(masked)
        lastCommittedRef.current = selectedDate.getTime()
      }
    }, [selectedDate, setInputText])

    const applyMaskedText = useCallback(
      (masked: string) => {
        setInputText(masked)
        const result = validateDmyDotInput(masked, minDate, maxDate)
        if (result.status === 'empty') {
          setHasInternalError(false)
          if (lastCommittedRef.current !== null) commitDate(null)
          return
        }
        if (result.status === 'valid') {
          setHasInternalError(false)
          if (lastCommittedRef.current !== result.date.getTime()) {
            commitDate(result.date)
          }
          return
        }
        setHasInternalError(true)
        if (lastCommittedRef.current !== null) commitDate(null)
      },
      [minDate, maxDate, commitDate, setInputText, setHasInternalError]
    )

    const handleFilterInputChange = useCallback(
      (e: ChangeEvent<HTMLInputElement>) => {
        applyMaskedText(maskDmyDotFromDigits(e.target.value))
      },
      [applyMaskedText]
    )

    const handleCalendarChange = useCallback(
      (date: Date | null) => {
        if (!isFilter) {
          onChange?.({ value: date })
          return
        }
        if (!date) {
          setInputText('')
          setHasInternalError(false)
          commitDate(null)
          return
        }
        const masked = formatDateAsDmyDot(date)
        const result = validateDmyDotInput(masked, minDate, maxDate)
        setInputText(masked)
        if (result.status === 'valid') {
          setHasInternalError(false)
          commitDate(result.date)
        } else {
          setHasInternalError(true)
          if (lastCommittedRef.current !== null) commitDate(null)
        }
      },
      [isFilter, onChange, minDate, maxDate, commitDate, setInputText, setHasInternalError]
    )

    const hasError = !!externalError || hasInternalError

    const filterBridge: FilterInputBridge | null = isFilter
      ? {
          inputText,
          onMaskedChange: handleFilterInputChange,
          hasError,
          inputId,
          placeholder: filterPlaceholder,
          disabled,
          helperId,
          helperText,
          ensureTextOnFocus,
        }
      : null

    const datePicker = (
      <DatePicker
        ref={ref}
        id={inputId}
        className={
          isFilter
            ? undefined
            : cn(
                'h-[45px] w-full rounded-md border bg-white pr-4 pl-10 text-sm font-light text-[#05040D] transition-all outline-none placeholder:text-gray-500',
                hasError
                  ? 'border-red-500 focus:border-red-500'
                  : 'border-gray-300 focus:border-[var(--color-primary-500)]'
              )
        }
        selected={selectedDate}
        onChange={handleCalendarChange}
        onChangeRaw={isFilter ? undefined : (e) => e?.preventDefault()}
        dateFormat={resolvedFormat}
        placeholderText={resolvedPlaceholder}
        disabled={disabled}
        minDate={minDate || undefined}
        maxDate={maxDate || undefined}
        aria-describedby={helperText ? helperId : undefined}
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
        customInput={isFilter ? <FilterPickerInput /> : undefined}
      />
    )

    return (
      <div className={cn('w-full', className)}>
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
        </div>
        {helperText && !hasError && (
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
