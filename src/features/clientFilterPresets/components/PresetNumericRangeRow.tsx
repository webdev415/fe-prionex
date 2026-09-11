/**
 * A from/to number filter inside the preset editor (#1100) — total debt,
 * principal, DPD.
 *
 * Nothing relative here: a number means the same thing whenever the preset is
 * applied, so these are stored as typed. The only rule worth having is that a
 * blank bound is absent rather than zero, since the client list reads a present
 * 0 as a real bound.
 */

import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/Input'

import type { NumericRange } from '../types'

export interface PresetNumericRangeRowProps {
  label: string
  value?: NumericRange
  /** `undefined` means "this filter is unset" — neither bound is set. */
  onChange: (next: NumericRange | undefined) => void
}

export function PresetNumericRangeRow({ label, value, onChange }: PresetNumericRangeRowProps) {
  const { t } = useTranslation('common')

  const set = (which: 'from' | 'to', raw: string) => {
    const parsed = raw === '' ? undefined : Number(raw)
    if (parsed !== undefined && Number.isNaN(parsed)) return

    const next: NumericRange = { ...value, [which]: parsed }
    if (parsed === undefined) delete next[which]

    onChange(next.from === undefined && next.to === undefined ? undefined : next)
  }

  const fromLabel = t('pages.profile.presets.range.from', 'From')
  const toLabel = t('pages.profile.presets.range.to', 'To')

  return (
    <fieldset className="flex w-full flex-col gap-2 self-stretch">
      <legend className="text-foreground text-sm font-medium">{label}</legend>
      <div className="flex w-full items-center gap-3 self-stretch">
        <Input
          type="number"
          aria-label={`${label} — ${fromLabel}`}
          placeholder={fromLabel}
          value={value?.from ?? ''}
          onChange={(e) => set('from', e.target.value)}
          className="min-w-0 flex-1"
        />
        <Input
          type="number"
          aria-label={`${label} — ${toLabel}`}
          placeholder={toLabel}
          value={value?.to ?? ''}
          onChange={(e) => set('to', e.target.value)}
          className="min-w-0 flex-1"
        />
      </div>
    </fieldset>
  )
}
