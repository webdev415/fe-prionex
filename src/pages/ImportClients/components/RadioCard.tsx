/**
 * RadioCard Component
 * 
 * Reusable radio button card component for Import Clients feature
 * Uses the Radio component from components/ui
 * Matches design specification with proper colors and styling
 */

import { Radio } from '@/components/ui/Radio'
import { colors } from '@/lib/colors'
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
        'flex cursor-pointer items-start rounded-lg border p-4 transition-all shadow-sm',
        className
      )}
      style={{
        gap: '8px', // var(--Other-gap-2, 8px) - using inline style to ensure it applies
        borderColor: checked ? colors.primary[400] : '#FFFFFF', // #A0F229 when selected, white when unselected
        borderWidth: '1px',
        backgroundColor: '#FFFFFF',
        boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.1), 0px 1px 2px rgba(0, 0, 0, 0.06)', // Same shadow for both states
        display: 'flex', // Ensure flex is applied
        alignItems: 'flex-start', // items-start equivalent
      }}
    >
      <Radio
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="shrink-0"
        style={{ marginTop: '1px' }} // Slight top alignment adjustment
      />
      <div className="flex-1">
        <div
          className="font-medium"
          style={{
            fontSize: '14px',
            color: colors.neutral.dark[500]
          }}
        >
          {title}
        </div>
        {description && (
          <div
            className="mt-1 text-sm"
            style={{ 
              color: colors.gray[700],
            }}
          >
            {description}
          </div>
        )}
      </div>
    </label>
  )
}
