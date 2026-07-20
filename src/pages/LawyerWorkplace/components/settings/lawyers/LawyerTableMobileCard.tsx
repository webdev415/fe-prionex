import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { LetterTypeConfig } from '../../../settings/types'
import type { SettingsLawyer } from '../../../settings/types'
import { getWorkloadLabel } from '../../../settings/utils/lawyerHelpers'
import { LetterTypeBadge } from '../LetterTypeBadge'

interface LawyerTableMobileCardProps {
  lawyer: SettingsLawyer
  letterTypeById: Record<string, LetterTypeConfig>
  onUpdateMaxInFlight: (lawyerId: string, delta: number) => void
}

export function LawyerTableMobileCard({
  lawyer,
  letterTypeById,
  onUpdateMaxInFlight,
}: LawyerTableMobileCardProps) {
  const { t } = useTranslation('common')
  const progress = lawyer.maxInFlight > 0 ? (lawyer.currentActive / lawyer.maxInFlight) * 100 : 0

  return (
    <div className="space-y-4 px-4 py-4 sm:px-5">
      <div className="flex items-start gap-3">
        <div className="bg-secondary-100 text-secondary-800 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold">
          {lawyer.initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-foreground text-[13px] font-semibold">
                {t(lawyer.nameKey, lawyer.nameFallback)}
              </p>
              <p className="text-muted-foreground text-[11px]">
                {t(lawyer.roleKey, lawyer.roleFallback)}
              </p>
            </div>
            <span
              className={cn(
                'inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium',
                lawyer.status === 'online'
                  ? 'bg-success-100 text-success-700'
                  : 'bg-warning-100 text-warning-700'
              )}
            >
              {t(`pages.lawyerWorkplace.settings.lawyers.status.${lawyer.status}`, lawyer.status)}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-muted-foreground text-[11px] font-medium">
          {t('pages.lawyerWorkplace.settings.lawyers.letterTypesColumn', 'Letter types')}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {lawyer.letterTypeIds.map((typeId) => {
            const letterType = letterTypeById[typeId]
            if (!letterType) return null
            return <LetterTypeBadge key={typeId} letterType={letterType} t={t} size="sm" />
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-muted-foreground text-[11px] font-medium">
            {t('pages.lawyerWorkplace.settings.lawyers.currentWorkload', 'Current workload')}
          </p>
          <p className="text-[13px] leading-none">
            <span className="text-foreground font-semibold">{lawyer.currentActive}</span>
            <span className="text-muted-foreground font-normal">
              {' '}
              {t('pages.lawyerWorkplace.settings.lawyers.ofActiveSuffix', {
                max: lawyer.maxInFlight,
                defaultValue: `of ${lawyer.maxInFlight}`,
              })}
            </span>
          </p>
          <div className="bg-muted h-1.5 overflow-hidden rounded-full">
            <div
              className="bg-secondary-500 h-full rounded-full transition-all"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <p className="text-muted-foreground text-[11px]">
            {getWorkloadLabel(lawyer.currentActive, lawyer.maxInFlight, t)}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-muted-foreground text-[11px] font-medium">
            {t('pages.lawyerWorkplace.settings.lawyers.maxInFlight', 'Max in flight')}
          </p>
          <div className="bg-muted inline-flex items-center rounded-full px-1">
            <button
              type="button"
              onClick={() => onUpdateMaxInFlight(lawyer.id, -1)}
              className="text-muted-foreground hover:text-foreground flex h-8 w-8 items-center justify-center"
              aria-label={t('actions.decrease', 'Decrease')}
            >
              <Icons.Remove02 size={14} strokeWidth={1} />
            </button>
            <span className="text-foreground min-w-[32px] px-1 text-center text-[13px] font-semibold">
              {lawyer.maxInFlight}
            </span>
            <button
              type="button"
              onClick={() => onUpdateMaxInFlight(lawyer.id, 1)}
              className="text-muted-foreground hover:text-foreground flex h-8 w-8 items-center justify-center"
              aria-label={t('actions.increase', 'Increase')}
            >
              <Icons.Add size={14} strokeWidth={1} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
