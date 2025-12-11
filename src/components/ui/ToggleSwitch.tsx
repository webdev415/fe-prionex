/**
 * ToggleSwitch Component
 *
 * Reusable toggle switch component for unlock/lock functionality.
 * Matches the design specification with dark teal/green for active state.
 */

interface ToggleSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
  ariaLabel?: string
}

export function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  className,
  ariaLabel,
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none ${
        checked ? 'bg-[#287975]' : 'bg-[#C8C8C8]'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${className || ''}`}
      onFocus={(e) => {
        e.currentTarget.style.outline = '2px solid #287975'
        e.currentTarget.style.outlineOffset = '2px'
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = ''
        e.currentTarget.style.outlineOffset = ''
      }}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

export default ToggleSwitch
