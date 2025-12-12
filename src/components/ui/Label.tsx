/* eslint-disable react-refresh/only-export-components */
import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const labelVariants = cva(
  'leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
  {
    variants: {
      variant: {
        default: 'text-dark-500 font-light',
        error: 'text-error-500 font-light',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement>, VariantProps<typeof labelVariants> {
  required?: boolean
}

const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, variant, style, required, children, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          'text-dark-500 text-sm font-extralight',
          labelVariants({ variant, className })
        )}
        style={style}
        {...props}
      >
        {children}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
    )
  }
)

Label.displayName = 'Label'

export { Label, labelVariants }
