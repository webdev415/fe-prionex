/**
 * RadioCard Component
 *
 * Reusable radio button card component for Import Clients feature
 * Uses the Radio component from components/ui
 * Matches design specification with proper colors and styling
 */

import { Radio } from '@/pages/ImportClients/components/Radio'
import { cn } from '@/lib/utils'

export interface RadioCardProps {
  value: string
  checked: boolean
  onChange: (value: string) => void
  name: string
  title: string
  description?: string
  className?: string
}

export function RadioCard({
  value,
  checked,
  onChange,
  name,
  title,
  description,
  className,
}: RadioCardProps) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-2 rounded-lg border bg-white p-4 shadow-sm transition-all',
        checked ? 'border-primary-400' : 'border-white',
        className
      )}
    >
      <Radio
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="mt-[1px] shrink-0"
      />
      <div className="flex-1">
        <div className="text-dark-500 text-sm font-medium">{title}</div>
        {description && <div className="mt-1 text-sm text-gray-700">{description}</div>}
      </div>
    </label>
  )
}
