/**
 * Texts of the settings editor that depend on data (planner story 5.10): the
 * server's `reason` of a configuration error in words, and phrases with a
 * number (three forms, `pluralKey`).
 */
import { useTranslation } from 'react-i18next'
import { formatNumber } from '@/lib/localeFormat'
import { pluralKey, type LocatedError } from './boardSettingsModel'

/** `reason` of a `BoardConfigError` → its sentence; the rest reads «Перевірте значення». */
const REASONS: Record<string, string> = {
  duplicate: 'settings.errors.duplicate',
  length: 'settings.errors.length',
  invalid: 'settings.errors.invalid',
  type_immutable: 'settings.errors.typeImmutable',
  category_in_use: 'settings.errors.categoryInUse',
  status_in_use: 'settings.errors.statusInUse',
  too_many: 'settings.errors.tooMany',
  priority_count: 'settings.errors.priorityCount',
  default_count: 'settings.errors.defaultCount',
  not_participant: 'settings.errors.notParticipant',
  personal_board_owner_only: 'settings.errors.notParticipant',
  inactive_person: 'settings.errors.inactivePerson',
  options_required: 'settings.errors.optionsRequired',
  options_not_allowed: 'settings.errors.optionsNotAllowed',
  unknown_status: 'settings.errors.initialStatus',
  initial_done: 'settings.errors.initialStatus',
  initial_requires_reason: 'settings.errors.initialStatus',
  default_requires_reason: 'settings.errors.defaultRequiresReason',
  id_taken: 'settings.errors.idTaken',
  intake_default_type_in_use: 'settings.errors.intakeDefaultType',
  config_too_large: 'settings.errors.configTooLarge',
  move_too_large: 'settings.errors.moveTooLarge',
  invalid_target: 'settings.errors.moveTarget',
  target_requires_reason: 'settings.errors.moveTarget',
  due_out_of_range: 'settings.errors.dueOutOfRange',
}

export function useSettingsText() {
  const { t, i18n } = useTranslation('planner')
  const language = i18n.language ?? 'uk'

  /** «Використовується в 12 задачах» — the words of AC 1 for anything in use. */
  const inUse = (count: number) =>
    t(pluralKey('settings.fields.inUse', count, language), {
      count: formatNumber(count, language),
    })

  const errorText = (error: LocatedError): string => {
    const key = REASONS[error.reason]
    if (key) return t(key)
    // `option_in_use`, `type_in_use`, … — whatever the server counts.
    if (error.reason.endsWith('_in_use') && error.usedCount !== undefined) {
      return inUse(error.usedCount)
    }
    return t('settings.errors.generic')
  }

  const withCount = (base: string, count: number) =>
    t(pluralKey(base, count, language), { count: formatNumber(count, language) })

  return { t, language, errorText, inUse, withCount }
}
