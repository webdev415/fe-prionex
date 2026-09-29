/**
 * «Термін» of the task form (planner story 5.7, UX-DR24): presets
 * `Сьогодні 18:00 · Завтра · Пт · Обрати дату`, as SHT-03 of HUB.
 *
 * A preset is a date and 18:00 on the board's clock (`timeZone`): it goes as
 * `due_at`. «Обрати дату» opens a date and an optional hour: a date alone goes
 * as `due_date`, a date with an hour as `due_at` (`createTaskForm.dueBody`).
 * The line under the chips says what will be sent, so a preset is never a
 * guess: «пт, 02.10.2026, 18:00».
 */
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import { intlLocaleForUiLanguage } from '@/lib/i18n'
import { formatDueDate } from '../plannerFormat'
import { DUE_PRESETS, presetChoice, type DueChoice, type DuePreset } from '../createTaskForm'
import { FieldError } from './FormParts'

interface DueFieldProps {
  value: DueChoice | null
  onChange: (value: DueChoice | null) => void
  /**
   * «Обрати дату» is open. Held by the form: the field moves when the form
   * turns from a task into a request, and the open date must not close.
   */
  picking: boolean
  onPickingChange: (picking: boolean) => void
  /** The board's zone; the browser's when the board gives none (a request). */
  timeZone?: string
  error?: string
}

const chip =
  'border-border rounded-full border px-3 py-1 text-xs text-foreground hover:bg-muted aria-pressed:border-primary-500 aria-pressed:bg-muted aria-pressed:font-medium'

function weekdayOf(date: string, language: string): string {
  return new Intl.DateTimeFormat(intlLocaleForUiLanguage(language), {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))
}

export function DueField({
  value,
  onChange,
  picking,
  onPickingChange: setPicking,
  timeZone,
  error,
}: DueFieldProps) {
  const { t, i18n } = useTranslation('planner')
  const language = i18n.language ?? 'uk'
  const legendId = useId()
  const errorId = `${legendId}-error`

  const choose = (preset: DuePreset) => {
    setPicking(false)
    onChange(presetChoice(preset, new Date(), timeZone))
  }
  const current = new Date()
  const pressed = (preset: DuePreset) => {
    if (picking || !value) return false
    const p = presetChoice(preset, current, timeZone)
    return p.date === value.date && p.time === value.time
  }

  return (
    <fieldset
      className="space-y-2"
      aria-labelledby={legendId}
      aria-describedby={error ? errorId : undefined}
    >
      <legend id={legendId} className="text-foreground mb-1.5 text-sm font-light">
        {t('create.fields.due')}
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {DUE_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className={chip}
            aria-pressed={pressed(preset)}
            onClick={() => choose(preset)}
          >
            {t(`create.due.${preset}`)}
          </button>
        ))}
        <button
          type="button"
          className={chip}
          aria-pressed={picking}
          onClick={() => {
            setPicking(true)
            if (!value) onChange({ date: '', time: '' })
          }}
        >
          {t('create.due.pick')}
        </button>
        {value && (
          <button
            type="button"
            className={cn(chip, 'text-muted-foreground')}
            onClick={() => {
              setPicking(false)
              onChange(null)
            }}
          >
            {t('create.due.clear')}
          </button>
        )}
      </div>

      {picking && value && (
        <div className="flex gap-2">
          <Input
            type="date"
            label={t('create.due.date')}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            value={value.date}
            onChange={(event) => onChange({ ...value, date: event.target.value })}
          />
          <Input
            type="time"
            label={t('create.due.time')}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            value={value.time}
            onChange={(event) => onChange({ ...value, time: event.target.value })}
          />
        </div>
      )}

      {value?.date && (
        <p className="text-muted-foreground text-xs">
          {value.time
            ? t('create.due.summaryMoment', {
                weekday: weekdayOf(value.date, language),
                date: formatDueDate(value.date, language),
                time: value.time,
              })
            : t('create.due.summaryDate', {
                weekday: weekdayOf(value.date, language),
                date: formatDueDate(value.date, language),
              })}
        </p>
      )}
      <FieldError id={errorId} text={error} />
    </fieldset>
  )
}

export default DueField
