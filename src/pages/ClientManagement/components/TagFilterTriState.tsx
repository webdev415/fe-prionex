/**
 * 3-state tag filter control: neutral / include (check) / exclude (cross).
 */

import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { TagFilterTriState } from '@/features/tags/utils/tagFilterState'

interface TagFilterTriStateProps {
  state: TagFilterTriState
  onCycle: () => void
  className?: string
  'aria-label'?: string
}

const stateStyles: Record<TagFilterTriState, string> = {
  neutral: 'border-border bg-transparent hover:border-border',
  include: 'border-primary-500 bg-primary-500',
  exclude: 'border-red-500 bg-red-500',
}

export function TagFilterTriState({
  state,
  onCycle,
  className,
  'aria-label': ariaLabel,
}: TagFilterTriStateProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={state === 'include' ? true : state === 'exclude' ? 'mixed' : false}
      aria-label={ariaLabel}
      onClick={(e) => {
        e.preventDefault()
        onCycle()
      }}
      className={cn(
        'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
        stateStyles[state],
        className
      )}
    >
      {state === 'include' && <Icons.Tick01 size={12} className="text-white" strokeWidth={2.5} />}
      {state === 'exclude' && <Icons.Close size={10} className="text-white" strokeWidth={2.5} />}
    </button>
  )
}
