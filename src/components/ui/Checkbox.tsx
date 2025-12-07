/**
 * Checkbox Component
 *
 * Reusable checkbox component built with Radix UI.
 * Matches the design with green background when checked and checkmark icon.
 */

import * as React from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { cn } from '@/lib/utils'
import { colors } from '@/lib/colors'

export interface CheckboxProps extends React.ComponentPropsWithoutRef<
  typeof CheckboxPrimitive.Root
> {
  className?: string
}

const Checkbox = React.forwardRef<React.ElementRef<typeof CheckboxPrimitive.Root>, CheckboxProps>(
  ({ className, ...props }, ref) => {
    return (
      <CheckboxPrimitive.Root
        ref={ref}
        className={cn(
          'peer ring-offset-background focus-visible:ring-ring h-5 w-5 shrink-0 rounded border focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        style={{
          backgroundColor: 'transparent',
          borderColor: colors.gray[300],
        }}
        {...props}
      >
        <CheckboxPrimitive.Indicator
          className={cn('flex items-center justify-center text-current')}
          style={{
            backgroundColor: colors.primary[500],
            borderRadius: '4px',
            width: '100%',
            height: '100%',
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M11.6667 3.5L5.25 9.91667L2.33334 7"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    )
  }
)
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
