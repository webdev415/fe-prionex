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
      console.log('🔍 DateSelect handleChange CALLED with:', date)

      // CRITICAL FIX: react-datepicker creates dates at midnight UTC
      // When user selects Jan 26, it creates "2026-01-26T00:00:00Z"
      // In GMT-0600, this appears as "Jan 25 2026 18:00:00" (6 PM previous day)
      // We MUST use UTC methods to extract the date the user actually selected
      if (date) {
        // Use UTC methods to get the date that was actually selected
        // react-datepicker stores dates in UTC, so we need UTC methods
        const selectedYear = date.getUTCFullYear()
        const selectedMonth = date.getUTCMonth()
        const selectedDay = date.getUTCDate()

        // Create a new Date at midnight LOCAL time with the UTC components
        // This ensures the date represents exactly what the user selected
        const normalizedDate = new Date(selectedYear, selectedMonth, selectedDay)

        console.log('📅 DateSelect handleChange (FIXED):', {
          originalDate: date,
          originalISO: date.toISOString(),
          originalLocalString: date.toString(),
          utcYear: date.getUTCFullYear(),
          utcMonth: date.getUTCMonth(),
          utcDay: date.getUTCDate(),
          localYear: date.getFullYear(),
          localMonth: date.getMonth(),
          localDay: date.getDate(),
          selectedYear,
          selectedMonth,
          selectedDay,
          normalizedDate: normalizedDate,
          normalizedISO: normalizedDate.toISOString(),
          normalizedLocalString: normalizedDate.toString(),
        })

        onChange?.({ value: normalizedDate })
      } else {
        onChange?.({ value: null })
      }
    }

    return (
      <div className={`w-full ${className || ''}`}>
        {label && (
          <label htmlFor={inputId} className="text-dark-500 mb-1.5 block text-sm font-light">
            {label}
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
              color: #05040D;
              outline: none;
              transition: all 0.2s;
            }
            .date-select-wrapper .react-datepicker__input-container input:focus {
              border-color: ${error ? '#EF4444' : 'var(--color-primary-500)'};
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
              onSelect={(date) => {
                // CRITICAL FIX: react-datepicker may create dates incorrectly
                // We need to read the input field value to get what user actually selected
                // The input shows MM/dd/yyyy format which is what the user sees
                if (date) {
                  // Wait for input to be updated, then read it
                  setTimeout(() => {
                    const input = document.getElementById(inputId) as HTMLInputElement
                    const inputValue = input?.value || ''

                    // Parse MM/dd/yyyy format from input (what user sees)
                    const match = inputValue.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
                    if (match) {
                      const [, monthStr, dayStr, yearStr] = match
                      const year = parseInt(yearStr, 10)
                      const month = parseInt(monthStr, 10) - 1 // 0-11
                      const day = parseInt(dayStr, 10)

                      // Create Date at midnight LOCAL time
                      const correctDate = new Date(year, month, day)

                      console.log('🔧 DateSelect onSelect (FIXED from input):', {
                        inputValue,
                        parsed: { year, month: month + 1, day },
                        correctDate: correctDate.toString(),
                        correctISO: correctDate.toISOString(),
                      })

                      handleChange(correctDate)
                    } else {
                      // Fallback: Use date parameter's UTC representation
                      // Extract UTC components to get what user actually selected
                      const utcDay = date.getUTCDate()
                      const finalYear = date.getUTCFullYear()
                      const finalMonth = date.getUTCMonth()

                      const correctDate = new Date(finalYear, finalMonth, utcDay)

                      console.log('🔧 DateSelect onSelect (FALLBACK):', {
                        originalDate: date,
                        originalISO: date.toISOString(),
                        utcDay,
                        finalYear,
                        finalMonth,
                        correctDate: correctDate.toString(),
                        correctISO: correctDate.toISOString(),
                      })

                      handleChange(correctDate)
                    }
                  }, 10) // Small delay to ensure input is updated
                }
              }}
              dateFormat={format}
              placeholderText={placeholder}
              disabled={disabled}
              minDate={parseDate(min) || undefined}
              maxDate={parseDate(max) || undefined}
              aria-describedby={error ? errorId : helperText ? helperId : undefined}
              showPopperArrow={false}
              popperPlacement="bottom-start"
              strictParsing={false}
              shouldCloseOnSelect={true}
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
