/**
 * RadioCard Component
 *
 * Card-style radio option for the Import Clients wizard.
 * Uses the shared Radix RadioItem from components/ui.
 */

import { RadioItem } from '@/components/ui/Radio'
import { cn } from '@/lib/utils'

export interface RadioCardProps {
  value: string
  title: string
  description?: string
  className?: string
}

export function RadioCard({ value, title, description, className }: RadioCardProps) {
  const id = `import-radio-${value}`

  return (
    <label
      htmlFor={id}
      className={cn(
        'border-border bg-card flex cursor-pointer items-start gap-2 rounded-lg border p-4 shadow-sm transition-all',
        'has-[[data-state=checked]]:border-primary-400',
        className
      )}
    >
      <RadioItem value={value} id={id} className="mt-[1px] shrink-0" />
      <div className="flex-1">
        <div className="text-foreground text-sm font-medium">{title}</div>
        {description && <div className="text-muted-foreground mt-1 text-sm">{description}</div>}
      </div>
    </label>
  )
}
