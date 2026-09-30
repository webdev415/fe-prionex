/**
 * CheckboxMultiSelect
 *
 * A dropdown whose items are checkboxes (multi-select), with an "All …" row
 * pinned at the top. Modeled on OperatorMultiSelectDropdown but generic and
 * self-contained: it renders its own trigger styled to match SelectTrigger.
 *
 * "All" semantics: an EMPTY selection means "All" (unrestricted). Checking the
 * All row clears the specific selection (→ []); checking any specific item
 * makes a concrete set and unchecks All. This matches the dialer queue form
 * (design: supervisor-02), where empty department_ids / access_groups means
 * "All departments" / "All groups".
 *
 * `obscured` (KAN-KB-54): when the option labels are personal data (a list
 * of people), the trigger's summary text and the option rows are marked
 * `data-openreplay-obscured`. The list renders through a Radix PORTAL under
 * `document.body`, so a mark on the caller's wrapper never reaches it. Opt-in,
 * like `SearchableSelect`'s flag: only the caller knows its options name people.
 */

import { useMemo, useState } from 'react'

import { Checkbox } from '@/components/ui/Checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Icons } from '@/lib/icons'
import { piiProps } from '@/lib/openreplay/pii'
import { cn } from '@/lib/utils'

export interface CheckboxMultiSelectOption<T extends string | number> {
  value: T
  label: string
}

interface CheckboxMultiSelectProps<T extends string | number> {
  options: CheckboxMultiSelectOption<T>[]
  /** Selected values. Empty array = "All" (unrestricted). */
  selected: T[]
  onChange: (next: T[]) => void
  /** Label for the top "All …" row and the empty-selection summary. */
  allLabel: string
  /** Placeholder shown when nothing is selected and there is no allLabel fit. */
  placeholder?: string
  disabled?: boolean
  ariaLabel?: string
  /** Mark the summary text and the option rows for OpenReplay (see the docblock). */
  obscured?: boolean
  className?: string
  testId?: string
}

export function CheckboxMultiSelect<T extends string | number>({
  options,
  selected,
  onChange,
  allLabel,
  placeholder,
  disabled = false,
  ariaLabel,
  obscured = false,
  className,
  testId,
}: CheckboxMultiSelectProps<T>) {
  const [open, setOpen] = useState(false)

  const isAll = selected.length === 0

  const summary = useMemo(() => {
    if (isAll) return allLabel
    const labels = options.filter((o) => selected.includes(o.value)).map((o) => o.label)
    return labels.join(', ') || placeholder || allLabel
  }, [isAll, allLabel, options, selected, placeholder])

  const toggle = (value: T) => {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value]
    onChange(next)
  }

  return (
    <DropdownMenu open={open} onOpenChange={disabled ? undefined : setOpen} modal={false}>
      <DropdownMenuTrigger asChild data-testid={testId}>
        <button
          type="button"
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn(
            'text-foreground bg-input border-input-border flex h-[45px] w-full items-center justify-between rounded-lg border px-3 py-2 text-sm font-light whitespace-nowrap shadow-none focus:ring-0 focus:outline-none disabled:opacity-50',
            disabled ? 'cursor-default' : 'cursor-pointer',
            className
          )}
        >
          <span
            className={cn('line-clamp-1 text-left', isAll && 'text-foreground')}
            {...(obscured ? piiProps : {})}
          >
            {summary}
          </span>
          <span className="ml-2 shrink-0 opacity-50">
            <Icons.ArrowDown size={16} className="text-current" />
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="border-border bg-card w-[var(--radix-dropdown-menu-trigger-width)] rounded-lg border p-2 shadow-lg"
      >
        {/* Marked HERE, inside the portal: the mark inherits down from this
            node, and nothing above it in the DOM belongs to the caller. */}
        <div className="max-h-[240px] space-y-1 overflow-y-auto" {...(obscured ? piiProps : {})}>
          {/* "All …" row — checked when the selection is empty (unrestricted). */}
          <label className="text-foreground hover:bg-muted flex cursor-pointer items-center gap-2 rounded px-2 py-2">
            <Checkbox checked={isAll} onCheckedChange={() => onChange([])} />
            <span className="text-sm font-medium">{allLabel}</span>
          </label>
          {options.map((opt) => (
            <label
              key={String(opt.value)}
              className="text-foreground hover:bg-muted flex cursor-pointer items-center gap-2 rounded px-2 py-2"
            >
              <Checkbox
                checked={selected.includes(opt.value)}
                onCheckedChange={() => toggle(opt.value)}
              />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default CheckboxMultiSelect
