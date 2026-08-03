import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { useLawyerWorkplaceLayout } from '../../context/lawyerWorkplaceLayout'
import type { LegalDocumentStats } from '../../documents/types'
import { DocumentsStatCard } from './DocumentsStatCard'

interface DocumentsStatsBarProps {
  stats: LegalDocumentStats
}

export function DocumentsStatsBar({ stats }: DocumentsStatsBarProps) {
  const { t } = useTranslation('common')
  const { isCompact } = useLawyerWorkplaceLayout()

  return (
    <div
      className={cn(
        'grid gap-3 px-4 sm:px-5 lg:px-7',
        isCompact ? 'grid-cols-1 pt-3' : 'grid-cols-2 pt-4 lg:grid-cols-4 lg:pt-5'
      )}
    >
      <DocumentsStatCard
        compact={isCompact}
        icon={<Icons.InboxIcon size={18} strokeWidth={1.5} />}
        iconClassName="bg-success-100 text-success-700"
        label={t('pages.lawyerWorkplace.documents.stats.incoming', 'IN · incoming')}
        value={t('pages.lawyerWorkplace.documents.stats.countOfYear', {
          count: stats.incomingCount,
          year: stats.incomingYearTotal,
          defaultValue: `${stats.incomingCount} / ${stats.incomingYearTotal}`,
        })}
      />
      <DocumentsStatCard
        compact={isCompact}
        icon={<Icons.MailSend01 size={18} strokeWidth={1.5} />}
        iconClassName="bg-sky-100 text-sky-700"
        label={t('pages.lawyerWorkplace.documents.stats.outgoing', 'OUT · outgoing')}
        value={t('pages.lawyerWorkplace.documents.stats.countOfYear', {
          count: stats.outgoingCount,
          year: stats.outgoingYearTotal,
          defaultValue: `${stats.outgoingCount} / ${stats.outgoingYearTotal}`,
        })}
      />
      <DocumentsStatCard
        compact={isCompact}
        icon={<Icons.CheckmarkBadge02 size={18} strokeWidth={1.5} />}
        iconClassName="bg-warning-100 text-warning-700"
        label={t('pages.lawyerWorkplace.documents.stats.nbu', 'NBU · responses')}
        value={t('pages.lawyerWorkplace.documents.stats.countOfYear', {
          count: stats.nbuCount,
          year: stats.nbuYearTotal,
          defaultValue: `${stats.nbuCount} / ${stats.nbuYearTotal}`,
        })}
      />
      <DocumentsStatCard
        compact={isCompact}
        icon={<Icons.File size={18} strokeWidth={1.5} />}
        iconClassName="bg-secondary-100 text-secondary-800"
        label={t('pages.lawyerWorkplace.documents.stats.generated', 'Generated')}
        value={t('pages.lawyerWorkplace.documents.stats.generatedPercent', {
          percent: stats.generatedPercent,
          defaultValue: `${stats.generatedPercent}%`,
        })}
      />
    </div>
  )
}
