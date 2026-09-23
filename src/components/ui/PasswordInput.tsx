import { forwardRef, useState, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { Icons } from '@/lib/icons'

const inputVariants = cva(
  'flex w-full rounded-lg border bg-input px-4 py-2 text-sm font-light text-foreground placeholder:text-muted-foreground placeholder:opacity-100 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-card disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border-input-border focus:border-primary-500 focus:ring-primary-500',
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

export interface PasswordInputProps
  extends
    Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'>,
    VariantProps<typeof inputVariants> {
  label?: string
  error?: string
  helperText?: string
  leftIcon?: React.ReactNode
  showToggle?: boolean
}

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      className,
      variant,
      inputSize,
      label,
      error,
      helperText,
      leftIcon,
      showToggle = true,
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false)
    const generatedId = useId()
    const inputId = id || generatedId
    const errorId = `${inputId}-error`
    const helperId = `${inputId}-helper`

    const { t } = useTranslation('common')
    const effectiveVariant = error ? 'error' : variant

    const togglePasswordVisibility = () => {
      setShowPassword((prev) => !prev)
    }

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="text-foreground mb-1.5 block text-sm font-light">
            {label.split(/(\*)/).map((token, i) =>
              token === '*' ? (
                <span key={i} className="text-error-500 font-light">
                  *
                </span>
              ) : (
                <span key={i} className="font-light">
                  {token}
                </span>
              )
            )}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              {leftIcon}
            </div>
          )}
          <input
            type={showPassword ? 'text' : 'password'}
            id={inputId}
            className={cn(
              inputVariants({ variant: effectiveVariant, inputSize }),
              leftIcon && 'pl-10',
              showToggle && 'pr-12',
              className
            )}
            ref={ref}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            disabled={disabled}
            {...props}
          />
          {showToggle && (
            <button
              type="button"
              onClick={togglePasswordVisibility}
              className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 z-10 flex cursor-pointer items-center px-3 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={
                showPassword
                  ? t('components.passwordInput.hide', 'Hide password')
                  : t('components.passwordInput.show', 'Show password')
              }
              disabled={disabled}
              tabIndex={-1}
            >
              <Icons.Eye
                size={18}
                className={cn(
                  'transition-colors',
                  showPassword ? 'text-primary-500' : 'text-muted-foreground'
                )}
              />
            </button>
          )}
        </div>
        {error && (
          <p id={errorId} className="text-error-500 mt-1.5 text-xs" role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helperId} className="text-muted-foreground mt-1.5 text-xs">
            {helperText}
          </p>
        )}
      </div>
    )
  }
)

PasswordInput.displayName = 'PasswordInput'

export { PasswordInput }
