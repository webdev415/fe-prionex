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
      className={`relative inline-flex items-center rounded-full transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none ${
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
      } ${className || ''}`}
      style={{
        width: '36px',
        height: '20px',
        backgroundColor: checked ? '#287975' : '#C8C8C8', // Color/Secondary/600 for on, Color/Gray/300 for off
      }}
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
        className="inline-block rounded-full bg-white transition-transform"
        style={{
          width: '14px',
          height: '14px',
          transform: checked ? 'translateX(18px)' : 'translateX(2px)',
        }}
      />
    </button>
  )
}

export default ToggleSwitch
