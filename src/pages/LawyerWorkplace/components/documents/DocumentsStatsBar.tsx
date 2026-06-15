import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { LegalDocumentStats } from '../../documents/types'

interface DocumentsStatsBarProps {
  stats: LegalDocumentStats
}

interface StatCardProps {
  icon: React.ReactNode
  iconClassName: string
  label: string
  value: string
}

function StatCard({ icon, iconClassName, label, value }: StatCardProps) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-white bg-white px-4 py-3 shadow-sm">
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
          iconClassName
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-light-600 truncate text-[11px] font-medium tracking-wide uppercase">
          {label}
        </p>
        <p className="text-dark-500 truncate text-[18px] leading-tight font-light">{value}</p>
      </div>
    </div>
  )
}

export function DocumentsStatsBar({ stats }: DocumentsStatsBarProps) {
  const { t } = useTranslation('common')

  return (
    <div className="grid grid-cols-1 gap-3 px-4 pt-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-4 lg:px-7 lg:pt-5">
      <StatCard
        icon={<Icons.InboxIcon size={18} strokeWidth={1.5} />}
        iconClassName="bg-success-100 text-success-700"
        label={t('pages.lawyerWorkplace.documents.stats.incoming', 'IN · incoming')}
        value={t('pages.lawyerWorkplace.documents.stats.countOfYear', {
          count: stats.incomingCount,
          year: stats.incomingYearTotal,
          defaultValue: `${stats.incomingCount} / ${stats.incomingYearTotal}`,
        })}
      />
      <StatCard
        icon={<Icons.MailSend01 size={18} strokeWidth={1.5} />}
        iconClassName="bg-[#E0F2FE] text-[#0369A1]"
        label={t('pages.lawyerWorkplace.documents.stats.outgoing', 'OUT · outgoing')}
        value={t('pages.lawyerWorkplace.documents.stats.countOfYear', {
          count: stats.outgoingCount,
          year: stats.outgoingYearTotal,
          defaultValue: `${stats.outgoingCount} / ${stats.outgoingYearTotal}`,
        })}
      />
      <StatCard
        icon={<Icons.CheckmarkBadge02 size={18} strokeWidth={1.5} />}
        iconClassName="bg-warning-100 text-warning-700"
        label={t('pages.lawyerWorkplace.documents.stats.nbu', 'NBU · responses')}
        value={t('pages.lawyerWorkplace.documents.stats.countOfYear', {
          count: stats.nbuCount,
          year: stats.nbuYearTotal,
          defaultValue: `${stats.nbuCount} / ${stats.nbuYearTotal}`,
        })}
      />
      <StatCard
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
