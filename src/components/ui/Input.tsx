/* eslint-disable react-refresh/only-export-components */
import { forwardRef, useId } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { Icons } from '@/lib/icons'
import { opaqueFieldName, PASSWORD_MANAGER_OPT_OUT, suppressesAutofill } from './autofill'

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

export interface InputProps
  extends
    Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  label?: React.ReactNode
  error?: string
  helperText?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  onClear?: () => void
}

/**
 * Autofill defence (KAN-1009): the rendered field defaults to
 * ``autocomplete="new-password"``, carries the password-manager opt-outs, and
 * falls back to an opaque generated ``name`` so the classifier has one less
 * signal to read.
 *
 * ``new-password`` rather than ``off`` because Chrome honours ``off`` only
 * outside its profile groups, and ignores it for person name, phone, email and
 * street address — the fields this app is mostly made of. Setting the strong
 * token here rather than at the call sites is what keeps it consistent: the
 * client, user, seller and project forms are all the same class of field, and
 * a per-call-site rule goes stale the first time someone adds a form. Nothing
 * built on this component is ever a real password field (``PasswordInput``
 * renders its own input), so the token only ever means "do not autofill".
 *
 * All of it backs off when a call site asks for real autofill, which today is
 * only the login form's username — ``data-lpignore`` there would stop LastPass
 * saving the credential. The password half of that form goes through
 * ``PasswordInput``, which has none of this and is meant not to.
 *
 * One deliberate limit: the caller's ``id`` stays on the input rather than
 * moving to the wrapper the way ``DateSelect`` does it. ~100 call sites pass a
 * semantic id and the app has ~190 ``htmlFor`` references, so relocating it
 * would cost label association to hide a signal weaker than the visible label
 * standing next to it.
 */
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
      name,
      autoComplete = 'new-password',
      ...props
    },
    ref
  ) => {
    const generatedId = useId()
    const inputId = id || generatedId
    const errorId = `${inputId}-error`
    const helperId = `${inputId}-helper`
    const suppressAutofill = suppressesAutofill(autoComplete)
    const fieldName = name ?? (suppressAutofill ? opaqueFieldName('fld', generatedId) : undefined)

    const effectiveVariant = error ? 'error' : variant

    const hasValue = value !== undefined && value !== null && value !== ''
    const showClear = !!onClear && hasValue

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="text-foreground mb-1.5 block text-sm font-light">
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
            <div className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              {leftIcon}
            </div>
          )}
          <input
            type={type}
            id={inputId}
            name={fieldName}
            autoComplete={autoComplete}
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
            {...(suppressAutofill ? PASSWORD_MANAGER_OPT_OUT : {})}
            {...props}
          />
          {showClear ? (
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear"
              className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex items-center pr-3"
            >
              <Icons.Cancel01 size={14} />
            </button>
          ) : (
            rightIcon && (
              <div className="text-muted-foreground pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
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
          <p id={helperId} className="text-muted-foreground mt-1.5 text-xs">
            {helperText}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export { Input, inputVariants }
