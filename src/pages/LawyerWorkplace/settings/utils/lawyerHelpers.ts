import type { TFunction } from 'i18next'
import { ADD_LAWYER_OPTIONS } from '../../components/settings/constants'
import type { SettingsLawyer } from '../types'

export function getWorkloadLabel(current: number, max: number, t: TFunction): string {
  const ratio = max > 0 ? current / max : 0
  if (ratio >= 0.85) {
    return t('pages.lawyerWorkplace.settings.lawyers.workload.high', 'Near capacity')
  }
  if (ratio > 0.5) {
    return t('pages.lawyerWorkplace.settings.lawyers.workload.healthy', 'Healthy load')
  }
  return t('pages.lawyerWorkplace.settings.lawyers.workload.plenty', 'Plenty of capacity')
}

export function mapLawyerOptionToSettingsLawyer(
  optionId: string,
  letterTypeIds: string[]
): SettingsLawyer | null {
  const option = ADD_LAWYER_OPTIONS.find((item) => item.id === optionId)
  if (!option) return null

  const initials = option.nameFallback
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const roleMap: Record<string, { roleKey: string; roleFallback: string }> = {
    vd: {
      roleKey: 'pages.lawyerWorkplace.settings.lawyers.roles.doroshenko',
      roleFallback: 'Senior · complaints lead',
    },
    lk: {
      roleKey: 'pages.lawyerWorkplace.settings.lawyers.roles.kostenko',
      roleFallback: 'NBU · regulatory specialist',
    },
    sm: {
      roleKey: 'pages.lawyerWorkplace.settings.lawyers.roles.melnychenko',
      roleFallback: 'Court · litigation',
    },
    ak: {
      roleKey: 'pages.lawyerWorkplace.settings.lawyers.roles.kovalchuk',
      roleFallback: 'Junior · general inquiries',
    },
    oh: {
      roleKey: 'pages.lawyerWorkplace.settings.lawyers.roles.hrytsenko',
      roleFallback: 'Regulatory · compliance associate',
    },
    pb: {
      roleKey: 'pages.lawyerWorkplace.settings.lawyers.roles.bondarenko',
      roleFallback: 'Documentation · correspondence',
    },
  }

  const role = roleMap[optionId] ?? {
    roleKey: 'pages.lawyerWorkplace.settings.lawyers.roles.default',
    roleFallback: 'Legal department',
  }

  return {
    id: optionId,
    initials,
    nameKey: option.nameKey,
    nameFallback: option.nameFallback,
    roleKey: role.roleKey,
    roleFallback: role.roleFallback,
    letterTypeIds,
    currentActive: 0,
    maxInFlight: 8,
    status: 'online',
  }
}
