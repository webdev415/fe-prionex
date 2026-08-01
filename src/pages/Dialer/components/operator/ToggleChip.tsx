import { cn } from '@/lib/utils'

/** Flat pill toggle (design: operator-01) — no visible switch knob, the fill
 * itself communicates on/off state. Shared across every call-header state
 * (joined/no-call, incoming call, active call) so the header actions row
 * looks identical regardless of which panel is currently rendered. */
export function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors',
        active ? 'bg-primary/15 text-foreground' : 'bg-muted text-muted-foreground'
      )}
    >
      {children}
    </button>
  )
}

export default ToggleChip
