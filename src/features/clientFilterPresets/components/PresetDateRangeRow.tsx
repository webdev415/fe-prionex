/**
 * One date filter inside the preset editor (#1100).
 *
 * Where the client list has two plain date pickers, each side of a preset date
 * range is a *rule*: today, the start of this month, N days either side of
 * today, or one fixed date. The rule is what gets saved, which is what lets a
 * preset meaning "the last 7 days" still mean that next month.
 *
 * The read-only field beside each side shows what the rule resolves to right
 * now, and it is computed with the same `resolveDateSide` the apply path uses.
 * One rule, one implementation — the preview cannot drift from the behaviour.
 */

import { useTranslation } from 'react-i18next'

import { DateSelect } from '@/components/ui/DateSelect'
import { Input } from '@/components/ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { formatPickerDateAsYMD, parsePickerYMD } from '@/lib/dateUtils'

import { resolveDateSide } from '../lib/resolvePreset'
import { ANY_DATE_SIDE, type DateRangeParam, type DateSide, type DateSideMode } from '../types'

const MODES: DateSideMode[] = ['any', 'today', 'startOfMonth', 'minusDays', 'plusDays', 'custom']

/** The two modes that read `days`; switching between them keeps the number. */
function usesDays(mode: DateSideMode): boolean {
  return mode === 'minusDays' || mode === 'plusDays'
}

export interface PresetDateRangeRowProps {
  label: string
  value?: DateRangeParam
  /** `undefined` means "this filter is unset" — both sides are Any. */
  onChange: (next: DateRangeParam | undefined) => void
  /** Clock behind the resolved preview. Injected so tests can fix it. */
  now: Date
}

export function PresetDateRangeRow({ label, value, onChange, now }: PresetDateRangeRowProps) {
  const { t } = useTranslation('common')

  const from = value?.from ?? ANY_DATE_SIDE
  const to = value?.to ?? ANY_DATE_SIDE

  const modeLabel = (mode: DateSideMode): string => {
    switch (mode) {
      case 'any':
        return t('pages.profile.presets.dates.modes.any', 'Any date')
      case 'today':
        return t('pages.profile.presets.dates.modes.today', 'Today')
      case 'startOfMonth':
        return t('pages.profile.presets.dates.modes.startOfMonth', 'Start of month')
      case 'minusDays':
        return t('pages.profile.presets.dates.modes.minusDays', 'Today minus N days')
      case 'plusDays':
        return t('pages.profile.presets.dates.modes.plusDays', 'Today plus N days')
      case 'custom':
        return t('pages.profile.presets.dates.modes.custom', 'Custom date')
    }
  }

  /**
   * Writes one side back, normalising as it goes: an unset filter has to come
   * out as `undefined` rather than a pair of Any sides, or the saved preset
   * would carry a date key that means nothing.
   */
  const setSide = (which: 'from' | 'to', side: DateSide) => {
    const next: DateRangeParam = which === 'from' ? { from: side, to } : { from, to: side }
    if (next.from.mode === 'any' && next.to.mode === 'any') {
      onChange(undefined)
      return
    }
    onChange(next)
  }

  /**
   * Changing the mode drops the fields the new mode cannot read. Leaving them
   * behind means a number typed for "minus N days" quietly reappears if the
   * operator returns to that mode after saving something else.
   */
  const setMode = (which: 'from' | 'to', side: DateSide, mode: DateSideMode) => {
    setSide(which, {
      mode,
      ...(usesDays(mode) && side.days !== undefined ? { days: side.days } : {}),
      ...(mode === 'custom' && side.date ? { date: side.date } : {}),
    })
  }

  const renderSide = (which: 'from' | 'to', side: DateSide) => {
    const sideLabel =
      which === 'from'
        ? t('pages.profile.presets.dates.from', 'From')
        : t('pages.profile.presets.dates.to', 'To')
    const resolved = resolveDateSide(side, now)

    return (
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-muted-foreground text-xs font-medium">{sideLabel}</span>

        <Select
          value={side.mode}
          onValueChange={(mode) => setMode(which, side, mode as DateSideMode)}
        >
          <SelectTrigger aria-label={`${label} — ${sideLabel}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODES.map((mode) => (
              <SelectItem key={mode} value={mode}>
                {modeLabel(mode)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {usesDays(side.mode) && (
          <Input
            type="number"
            min={0}
            step={1}
            aria-label={`${label} — ${sideLabel} — ${t('pages.profile.presets.dates.days', 'Days')}`}
            placeholder={t('pages.profile.presets.dates.days', 'Days')}
            value={side.days ?? ''}
            onChange={(e) => {
              const raw = e.target.value
              if (raw === '') {
                // An empty field is "not filled in yet", not zero — the key is
                // dropped rather than set to 0, which would pin the bound to
                // today and look deliberate in the saved preset. Rebuilding
                // from the mode alone is exact here: `setMode` never lets a
                // `date` survive into an offset mode.
                setSide(which, { mode: side.mode })
                return
              }
              const parsed = Math.trunc(Number(raw))
              if (Number.isNaN(parsed)) return
              setSide(which, { ...side, days: Math.max(0, parsed) })
            }}
          />
        )}

        {side.mode === 'custom' && (
          <DateSelect
            placeholder={t('pages.profile.presets.dates.pick', 'Select date')}
            value={parsePickerYMD(side.date)}
            onChange={({ value: picked }) => {
              if (!picked) {
                // Same as above: a custom mode never carries `days`, so the
                // mode alone is the whole of what survives clearing the date.
                setSide(which, { mode: side.mode })
                return
              }
              setSide(which, { ...side, date: formatPickerDateAsYMD(picked) })
            }}
          />
        )}

        {/* The rule's value as of now. Read-only on purpose: it is an
            explanation of the rule above, not a third way to set the date. */}
        <span
          className="text-muted-foreground text-xs"
          data-testid={`preset-date-resolved-${which}`}
        >
          {t('pages.profile.presets.dates.result', 'Result')}: {resolved ?? '—'}
        </span>
      </div>
    )
  }

  return (
    <fieldset className="flex w-full flex-col gap-2 self-stretch">
      <legend className="text-foreground text-sm font-medium">{label}</legend>
      <div className="flex w-full flex-col gap-3 self-stretch sm:flex-row">
        {renderSide('from', from)}
        {renderSide('to', to)}
      </div>
    </fieldset>
  )
}
