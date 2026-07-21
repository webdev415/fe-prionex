/* eslint-disable react-refresh/only-export-components */
import { forwardRef, useId } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const textareaVariants = cva(
  'flex w-full rounded-lg border bg-input px-4 py-2 text-sm font-light text-foreground placeholder:text-muted-foreground transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-card disabled:cursor-not-allowed disabled:opacity-50 resize-none',
  {
    variants: {
      variant: {
        default: 'border-input-border focus:border-primary-500 focus:ring-primary-500',
        error: 'border-error-500 focus:border-error-500 focus:ring-error-500',
        success: 'border-success-500 focus:border-success-500 focus:ring-success-500',
      },
      textareaSize: {
        sm: 'min-h-20 text-xs',
        md: 'min-h-24 text-sm',
        lg: 'min-h-32 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      textareaSize: 'md',
    },
  }
)

export interface TextareaProps
  extends
    Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'>,
    VariantProps<typeof textareaVariants> {
  label?: string
  error?: string
  helperText?: string
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, variant, textareaSize, label, error, helperText, id, style, ...props }, ref) => {
    const generatedId = useId()
    const textareaId = id || generatedId
    const errorId = `${textareaId}-error`
    const helperId = `${textareaId}-helper`

    const effectiveVariant = error ? 'error' : variant

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={textareaId} className="text-foreground mb-1.5 block text-sm font-light">
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          className={cn(textareaVariants({ variant: effectiveVariant, textareaSize }), className)}
          style={style}
          ref={ref}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          {...props}
        />
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

Textarea.displayName = 'Textarea'

export { Textarea, textareaVariants }
