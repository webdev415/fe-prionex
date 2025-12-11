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

export interface DateSelectProps {
  label?: string
  error?: string
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
          <label htmlFor={inputId} className="text-dark-950 mb-1.5 block text-sm font-light">
            {label}
          </label>
        )}
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3">
            <Icons.Calendar size={18} color="#6B7280" strokeWidth={1.5} />
          </div>
          <style>{`
            .date-select-wrapper .react-datepicker-wrapper {
              width: 100%;
            }
            .date-select-wrapper .react-datepicker__input-container {
              width: 100%;
            }
            .date-select-wrapper .react-datepicker__input-container input {
              width: 100%;
              height: 45px;
              padding-left: 2.5rem;
              padding-right: 1rem;
              border-radius: 0.5rem;
              border: 1px solid ${error ? '#EF4444' : '#D1D5DB'};
              background-color: white;
              font-size: 14px;
              font-weight: 300;
              color: #1A1A1A;
              outline: none;
              transition: all 0.2s;
            }
            .date-select-wrapper .react-datepicker__input-container input:focus {
              border-color: ${error ? '#EF4444' : '#0CA8EB'};
              box-shadow: 0 0 0 2px ${error ? 'rgba(239, 68, 68, 0.2)' : 'rgba(12, 168, 235, 0.2)'};
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
              color: #1A1A1A;
              font-weight: 500;
              font-size: 14px;
            }
            .react-datepicker__day-name {
              color: #4B5563;
              font-weight: 500;
              font-size: 12px;
            }
            .react-datepicker__day {
              color: #1A1A1A;
              border-radius: 0.375rem;
              transition: all 0.15s;
            }
            .react-datepicker__day:hover {
              background-color: #F3F4F6;
              border-radius: 0.375rem;
            }
            .react-datepicker__day--selected,
            .react-datepicker__day--keyboard-selected {
              background-color: #0CA8EB !important;
              color: white !important;
              border-radius: 0.375rem;
            }
            .react-datepicker__day--today {
              font-weight: 600;
              color: #0CA8EB;
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
              border-color: #1A1A1A;
            }
            .react-datepicker__triangle {
              display: none;
            }
          `}</style>
          <div className="date-select-wrapper">
            <DatePicker
              ref={ref}
              id={inputId}
              selected={parseDate(value)}
              onChange={handleChange}
              dateFormat={format}
              placeholderText={placeholder}
              disabled={disabled}
              minDate={parseDate(min) || undefined}
              maxDate={parseDate(max) || undefined}
              aria-describedby={error ? errorId : helperText ? helperId : undefined}
              showPopperArrow={false}
              popperPlacement="bottom-start"
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
