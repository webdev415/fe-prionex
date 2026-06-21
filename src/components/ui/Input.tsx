/* eslint-disable react-refresh/only-export-components */
import { forwardRef, useId } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { Icons } from '@/lib/icons'

const inputVariants = cva(
  'flex w-full rounded-lg border bg-white px-4 py-2 text-sm font-light text-dark-500 placeholder:text-gray-500 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border-gray-400 focus:border-primary-500 focus:ring-primary-500',
        error: 'border-error-500 focus:border-error-500 focus:ring-error-500',
        success: 'border-success-500 focus:border-success-500 focus:ring-success-500',
      },
      inputSize: {
        sm: 'h-8 text-xs',
        md: 'h-[45px]',
        lg: 'h-12 text-base',
        xl: 'h-[45px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      inputSize: 'md',
    },
  }
)

export interface InputProps
  extends
    Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  label?: React.ReactNode
  error?: string
  helperText?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  /**
   * Opt-in per-field clear. When provided AND the input has a value, a small
   * "×" button is rendered on the right that calls this callback. Other usages
   * of Input are unaffected because the × only renders when onClear is set.
   */
  onClear?: () => void
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = 'text',
      variant,
      inputSize,
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      onClear,
      value,
      id,
      ...props
    },
    ref
  ) => {
    const generatedId = useId()
    const inputId = id || generatedId
    const errorId = `${inputId}-error`
    const helperId = `${inputId}-helper`

    const effectiveVariant = error ? 'error' : variant

    // × only renders when opt-in onClear is provided AND there is a value.
    const hasValue = value !== undefined && value !== null && value !== ''
    const showClear = !!onClear && hasValue

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="text-dark-500 mb-1.5 block text-sm font-light">
            {typeof label === 'string'
              ? label.split(/(\*)/).map((token, i) =>
                  token === '*' ? (
                    <span key={i} className="text-error-500 font-light">
                      *
                    </span>
                  ) : (
                    <span key={i} className="font-light">
                      {token}
                    </span>
                  )
                )
              : label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
              {leftIcon}
            </div>
          )}
          <input
            type={type}
            id={inputId}
            value={value}
            className={cn(
              inputVariants({ variant: effectiveVariant, inputSize }),
              leftIcon && 'pl-10',
              (rightIcon || showClear) && 'pr-10',
              className
            )}
            ref={ref}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            {...props}
          />
          {showClear ? (
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear"
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
            >
              <Icons.Cancel01 size={14} />
            </button>
          ) : (
            rightIcon && (
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500">
                {rightIcon}
              </div>
            )
          )}
        </div>
        {error && (
          <p id={errorId} className="text-error-500 mt-1.5 text-xs" role="alert">
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

Input.displayName = 'Input'

export { Input, inputVariants }
