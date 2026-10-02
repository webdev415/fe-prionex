/**
 * ToggleSwitch Component
 *
 * Reusable toggle switch for on/off settings.
 * Uses semantic theme tokens so focus + track colors work in light and dark themes.
 */

import { cn } from '@/lib/utils'

interface ToggleSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
  ariaLabel?: string
  /** Ids of the elements that describe the switch (a hint, a refusal). */
  ariaDescribedBy?: string
  ariaInvalid?: boolean
}

export function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  className,
  ariaLabel,
  ariaDescribedBy,
  ariaInvalid,
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-invalid={ariaInvalid || undefined}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors',
        'focus-visible:ring-primary-500 focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        checked ? 'border-primary bg-primary' : 'border-border bg-muted-foreground/25',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        className
      )}
    >
      <span
        className={cn(
          'inline-block h-3.5 w-3.5 rounded-full shadow-sm transition-transform',
          checked
            ? 'bg-primary-foreground translate-x-[18px]'
            : 'bg-card ring-border translate-x-0.5 ring-1'
        )}
      />
    </button>
  )
}

export default ToggleSwitch
