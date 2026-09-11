/**
 * A plain multi-select filter inside the preset editor (#1100) — portfolio, RR
 * status, chain, chain step.
 *
 * Nothing relative to resolve: these are ids, and an id means the same thing
 * whenever the preset is applied. The only rule is the one every row shares —
 * an empty selection is an absent filter, not an empty list, because the client
 * list sends `[]` and `undefined` differently.
 */

import { useTranslation } from 'react-i18next'

import { CheckboxMultiSelect } from '@/components/ui/CheckboxMultiSelect'

import type { PresetOption } from '../hooks/usePresetFilterOptions'

export interface PresetMultiSelectRowProps {
  label: string
  options: PresetOption<number>[]
  value?: number[]
  /** `undefined` means "this filter is unset" — nothing selected. */
  onChange: (next: number[] | undefined) => void
  /** Shown in place of the selection when nothing is picked. */
  allLabel?: string
  /**
   * Why the row cannot be used yet — the Step row is empty until a chain is
   * chosen, and saying so beats a dropdown that opens onto nothing.
   */
  disabledHint?: string
  testId?: string
}

export function PresetMultiSelectRow({
  label,
  options,
  value,
  onChange,
  allLabel,
  disabledHint,
  testId,
}: PresetMultiSelectRowProps) {
  const { t } = useTranslation('common')
  const disabled = disabledHint !== undefined

  return (
    <fieldset className="flex w-full flex-col gap-2 self-stretch">
      <legend className="text-foreground text-sm font-medium">{label}</legend>
      <CheckboxMultiSelect<number>
        options={options}
        selected={value ?? []}
        onChange={(next) => onChange(next.length > 0 ? next : undefined)}
        allLabel={allLabel ?? t('pages.profile.presets.multi.all', 'Any')}
        ariaLabel={label}
        disabled={disabled}
        testId={testId}
      />
      {disabledHint && <span className="text-muted-foreground text-xs">{disabledHint}</span>}
    </fieldset>
  )
}
