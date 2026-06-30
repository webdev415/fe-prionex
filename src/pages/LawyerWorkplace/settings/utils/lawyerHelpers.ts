import type { TFunction } from 'i18next'
import { downloadBlob } from '@/features/messaging/utils/downloadBlob'
import { ADD_LAWYER_OPTIONS } from '../../components/settings/constants'
import type { LetterTypeConfig, SettingsLawyer } from '../types'

function escapeCsvCell(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

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

export function exportLawyersToCsv(
  lawyers: SettingsLawyer[],
  letterTypes: LetterTypeConfig[],
  t: TFunction,
  filename = 'legal-lawyers.csv'
): void {
  if (lawyers.length === 0) return

  const letterTypeById = Object.fromEntries(letterTypes.map((type) => [type.id, type]))
  const headers = [
    'name',
    'role',
    'letter_types',
    'current_active',
    'max_in_flight',
    'status',
    'workload',
  ]
  const rows = lawyers.map((lawyer) => {
    const typeNames = lawyer.letterTypeIds
      .map((id) => {
        const letterType = letterTypeById[id]
        return letterType ? t(letterType.nameKey, letterType.nameFallback) : id
      })
      .join('; ')

    return [
      t(lawyer.nameKey, lawyer.nameFallback),
      t(lawyer.roleKey, lawyer.roleFallback),
      typeNames,
      String(lawyer.currentActive),
      String(lawyer.maxInFlight),
      t(`pages.lawyerWorkplace.settings.lawyers.status.${lawyer.status}`, lawyer.status),
      getWorkloadLabel(lawyer.currentActive, lawyer.maxInFlight, t),
    ]
      .map(escapeCsvCell)
      .join(',')
  })

  const csv = [headers.join(','), ...rows].join('\n')
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename)
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
