/**
 * DateSelect Component
 *
 * A styled date input component using react-datepicker.
 * Matches the design with calendar icon and placeholder support.
 */

import { forwardRef, useId } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'

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
}

const parseDate = (date: Date | string | null | undefined): Date | null => {
  if (!date) return null
  if (date instanceof Date) return date
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
    },
    ref
  ) => {
    const generatedId = useId()
    const inputId = id || generatedId
    const errorId = `${inputId}-error`
    const helperId = `${inputId}-helper`

    const handleChange = (date: Date | null) => {
      onChange?.({ value: date })
    }

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
              box-shadow: 0 0 0 2px ${error ? 'rgba(239, 68, 68, 0.2)' : 'rgba(128, 216, 10, 0.2)'};
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
              className={cn(
                'h-[45px] w-full rounded-md border bg-white pr-4 pl-10 text-sm font-light text-[#05040D] transition-all outline-none placeholder:text-gray-500',
                error
                  ? 'border-red-500 focus:border-red-500'
                  : 'border-gray-300 focus:border-[var(--color-primary-500)]',
                className
              )}
              selected={parseDate(value)}
              onChange={handleChange}
              onChangeRaw={(e) => e?.preventDefault()}
              dateFormat={format}
              placeholderText={placeholder}
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
