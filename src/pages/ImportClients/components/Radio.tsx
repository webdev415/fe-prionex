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
import { colors } from '@/lib/colors'

export interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string
}

const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ className, checked, ...props }, ref) => {
    return (
      <div
        className="relative flex items-center justify-center"
        style={{
          width: '24px',
          height: '24px',
        }}
      >
        {/* Outer circle - always visible, 15px centered in 24px container */}
        <div
          className={cn('relative rounded-full', className)}
          style={{
            width: '16px',
            height: '16px',
            border: `1px solid ${checked ? colors.primary[500] : colors.gray[500]}`,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Inner filled circle - only when checked, 10px centered */}
          {checked && (
            <div
              className="rounded-full"
              style={{
                width: '10px',
                height: '10px',
                backgroundColor: colors.primary[500], // #80D80A
              }}
            />
          )}
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
