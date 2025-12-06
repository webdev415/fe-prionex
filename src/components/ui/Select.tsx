import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[]
  variant?: 'default' | 'ghost'
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, variant = 'default', ...props }, ref) => {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            'cursor-pointer appearance-none bg-transparent transition-all duration-200 outline-none',
            variant === 'default' && 'pr-6 text-sm text-gray-700 hover:text-gray-900',
            variant === 'ghost' && 'pr-6 text-sm text-gray-600 hover:text-gray-900',
            className
          )}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} className="bg-white py-2 text-gray-900">
              {option.label}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute top-1/2 right-0 h-4 w-4 -translate-y-1/2 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    )
  }
)

Select.displayName = 'Select'

export { Select }
