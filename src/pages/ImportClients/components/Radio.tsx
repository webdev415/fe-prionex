/**
 * Radio Component
 *
 * Reusable radio button component matching design specification.
 * 24x24px container with 15px outer circle, 10px inner filled circle when selected.
 * Unselected: 15px circle with #A1A1A1 stroke
 * Selected: 15px circle with #80D80A stroke, 10px filled inner circle
 */

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string
}

const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ className, checked, ...props }, ref) => {
    return (
      <div className="relative flex h-6 w-6 items-center justify-center">
        {/* Outer circle - always visible, 15px centered in 24px container */}
        <div
          className={cn(
            'relative flex h-4 w-4 items-center justify-center rounded-full border',
            checked ? 'border-primary-500' : 'border-gray-500',
            className
          )}
        >
          {/* Inner filled circle - only when checked, 10px centered */}
          {checked && <div className="bg-primary-500 h-[10px] w-[10px] rounded-full" />}
        </div>
        {/* Hidden native input for accessibility */}
        <input type="radio" ref={ref} checked={checked} className="sr-only" {...props} />
      </div>
    )
  }
)

Radio.displayName = 'Radio'

export interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ value, onValueChange, children, className, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (onValueChange) {
        onValueChange(e.target.value)
      }
    }

    // Clone children and inject value and onChange props
    const childrenWithProps = React.Children.map(children, (child) => {
      if (React.isValidElement<RadioProps>(child)) {
        return React.cloneElement(child, {
          checked: value !== undefined ? child.props.value === value : undefined,
          onChange: handleChange,
        })
      }
      return child
    })

    return (
      <div ref={ref} className={cn('', className)} {...props}>
        {childrenWithProps}
      </div>
    )
  }
)

RadioGroup.displayName = 'RadioGroup'

export { Radio, RadioGroup }
