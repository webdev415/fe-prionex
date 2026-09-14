/**
 * The "Filter Presets" button on the client list (#1100, Part 2).
 *
 * Single-select: picking a preset replaces the whole filter set rather than
 * merging into it, because a preset describes a complete view and a merge would
 * silently keep whatever the operator had set before.
 *
 * Presets are resolved here, at apply time, not when they were saved — that is
 * the whole point of storing parameters. The resolver is pure and the two things
 * it needs, the clock and the employee directory, are handed to it.
 *
 * The button is read-only: presets are created in profile settings, and the menu
 * says so when there are none rather than offering an editor in a dropdown.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Icons } from '@/lib/icons'
import type { ClientFilters } from '@/pages/ClientManagement/ClientManagementPage'

import { useClientFilterPresets } from '../hooks/useClientFilterPresets'
import { useResolveEmployeeScope } from '../hooks/useResolveEmployeeScope'
import { resolvePresetToFilters } from '../lib/resolvePreset'

export interface ClientFilterPresetsMenuProps {
  projectId: number | null
  onApply: (filters: ClientFilters) => void
  /**
   * Whether any filter is currently applied. The "Applied" mark is derived from
   * this rather than tracked on its own: Clear All wipes the filters without
   * telling this component, and a mark left behind would claim a view that is
   * no longer on screen.
   */
  hasActiveFilters: boolean
}

export function ClientFilterPresetsMenu({
  projectId,
  onApply,
  hasActiveFilters,
}: ClientFilterPresetsMenuProps) {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  /** Which preset produced the filters currently on screen, if any. */
  const [appliedId, setAppliedId] = useState<number | null>(null)

  const { presets } = useClientFilterPresets()
  const resolveEmployeeScope = useResolveEmployeeScope(projectId)

  const apply = (id: number) => {
    const preset = presets.find((p) => p.id === id)
    if (!preset) return
    // `new Date()` at the click, not at render: a tab left open overnight must
    // still resolve "today" to today.
    onApply(resolvePresetToFilters(preset.params, { now: new Date(), resolveEmployeeScope }))
    setAppliedId(id)
    setOpen(false)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="client-filter-presets"
          className="border-border bg-card text-foreground hover:bg-muted flex items-center gap-2 rounded-full border px-4 py-2.5 transition-colors"
        >
          <Icons.Save size={20} className="text-foreground" strokeWidth={1.5} />
          <span className="text-foreground text-center text-xs leading-[140%] font-medium tracking-[-0.24px]">
            {t('pages.clients.presets.label', 'Filter Presets')}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-72 min-w-[16rem] overflow-y-auto p-1.5">
        {presets.length === 0 ? (
          // The ticket's own wording: say where presets come from rather than
          // leaving an empty menu that looks broken.
          <div className="text-muted-foreground px-2 py-3 text-xs">
            {t('pages.clients.presets.empty', 'You can set up presets in your profile')}
          </div>
        ) : (
          presets.map((preset) => (
            <DropdownMenuItem
              key={preset.id}
              className="cursor-pointer"
              onClick={() => apply(preset.id)}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="truncate">{preset.name}</span>
                {appliedId === preset.id && hasActiveFilters && (
                  // Named, not just ticked: a bare glyph beside one row of a
                  // list reads as decoration to a screen reader.
                  <span className="text-primary-500 flex shrink-0 items-center gap-1 text-xs">
                    <Icons.Tick01 size={14} strokeWidth={2} aria-hidden />
                    {t('pages.clients.presets.applied', 'Applied')}
                  </span>
                )}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
