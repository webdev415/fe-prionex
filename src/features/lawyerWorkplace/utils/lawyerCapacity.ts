import type { TFunction } from 'i18next'
import type { LegalLawyer } from '../api/types'

export function isLawyerAtCapacity(
  lawyer: Pick<LegalLawyer, 'current_active' | 'max_in_flight'>
): boolean {
  const max = lawyer.max_in_flight
  if (max <= 0) return false
  return lawyer.current_active >= max
}

export function canAssignLawyer(
  lawyer: Pick<LegalLawyer, 'user_id' | 'current_active' | 'max_in_flight'>,
  currentAssigneeUserId?: number | null
): boolean {
  if (currentAssigneeUserId != null && lawyer.user_id === currentAssigneeUserId) {
    return true
  }
  return !isLawyerAtCapacity(lawyer)
}

export function formatLawyerCapacityLabel(
  lawyer: Pick<LegalLawyer, 'current_active' | 'max_in_flight'>,
  t: TFunction
): string {
  return t('pages.lawyerWorkplace.lawyers.atCapacity', 'At capacity ({{current}}/{{max}})', {
    current: lawyer.current_active,
    max: lawyer.max_in_flight,
  })
}
