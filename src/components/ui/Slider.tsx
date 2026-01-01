/**
 * Slider Component
 *
 * A range slider input component for selecting numeric values.
 */

import { forwardRef, useId } from 'react'
import { cn } from '@/lib/utils'

export interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  value: number
  onValueChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  showValue?: boolean
  className?: string
}

export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  (
    {
      label,
      value,
      onValueChange,
      min = 0,
      max = 100,
      step = 1,
      showValue = true,
      className,
      ...props
    },
    ref
  ) => {
    const id = useId()

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = Number(e.target.value)
      onValueChange(newValue)
    }

    const percentage = ((value - min) / (max - min)) * 100

    return (
      <div className={cn('flex flex-col gap-2', className)}>
        {label && (
          <label htmlFor={id} className="text-dark-500 text-sm font-medium">
            {label}
          </label>
        )}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <input
              ref={ref}
              id={id}
              type="range"
              min={min}
              max={max}
              step={step}
              value={value}
              onChange={handleChange}
              className="[&::-webkit-slider-thumb]:bg-primary-500 [&::-moz-range-thumb]:bg-primary-500 h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 transition-all outline-none [&::-moz-range-thumb]:h-[18px] [&::-moz-range-thumb]:w-[18px] [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow-md [&::-webkit-slider-thumb]:h-[18px] [&::-webkit-slider-thumb]:w-[18px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-md"
              style={{
                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${percentage}%, #e5e7eb ${percentage}%, #e5e7eb 100%)`,
              }}
              {...props}
            />
          </div>
          {showValue && (
            <span className="text-dark-500 w-12 text-right text-sm font-medium">{value}%</span>
          )}
        </div>
      </div>
    )
  }
)

Slider.displayName = 'Slider'
