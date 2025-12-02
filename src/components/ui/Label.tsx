import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const labelVariants = cva(
  'text-text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
  {
    variants: {
      variant: {
        default: 'text-gray-300',
        error: 'text-error-500',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement>, VariantProps<typeof labelVariants> {}

const Label = forwardRef<HTMLLabelElement, LabelProps>(({ className, variant, ...props }, ref) => {
  return <label ref={ref} className={cn(labelVariants({ variant, className }))} {...props} />
})

Label.displayName = 'Label'

export { Label, labelVariants }
