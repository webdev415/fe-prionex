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
  t?: (key: string, fallback: string) => string
): string {
  const translate = t ?? ((_key, fallback) => fallback)
  return translate(
    'pages.lawyerWorkplace.lawyers.atCapacity',
    `At capacity (${lawyer.current_active}/${lawyer.max_in_flight})`
  )
}
