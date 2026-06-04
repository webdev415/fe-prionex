import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { MOCK_LEAKS, MOCK_LEAKS_KPIS, type MockLeakRow } from '../../mocks/trainerWorkplaceMocks'
import { AnalyticsMockTable } from './AnalyticsMockTable'
import { AnalyticsKpiTile } from './AnalyticsKpiTile'
import {
  ANALYTICS_TABLE_HEAD,
  ANALYTICS_TABLE_ROW,
  ANALYTICS_TABLE_TD,
  ANALYTICS_TABLE_TH,
} from './analyticsTableStyles'

/**
 * Leaks sub-tab (KAN-415). Mirrors the Figma frame:
 *   1) Blue "escalation rule" info banner (dismissible)
 *   2) 3 horizontal icon-tile KPIs (Total / Not followed up / Followed up)
 *   3) Red banner with title + secondary line
 *   4) Status chip strip (All / Not followed up / Followed up) attached to
 *      the leaks table card
 *   5) Table — operator avatar with presence dot, blue client #, deal code,
 *      Follow-up pill (× red / check green), red "No call" or timestamped
 *      callback
 */

type LeakStatusFilter = 'all' | 'not' | 'done'

const PRESENCE_DOT: Record<NonNullable<MockLeakRow['operatorPresence']>, string> = {
  online: 'bg-[#22C55E]',
  busy: 'bg-[#F59E0B]',
  offline: 'bg-[#A1A1A1]',
}

export function LeaksSubTab() {
  const { t } = useTranslation('common')
  const [statusFilter, setStatusFilter] = useState<LeakStatusFilter>('all')
  const [infoDismissed, setInfoDismissed] = useState(false)
  const k = MOCK_LEAKS_KPIS

  const totalCount = MOCK_LEAKS.length
  const notFollowedCount = MOCK_LEAKS.filter((r) => !r.followedUp).length
  const followedCount = MOCK_LEAKS.filter((r) => r.followedUp).length

  const rows = MOCK_LEAKS.filter((row) => {
    if (statusFilter === 'not') return !row.followedUp
    if (statusFilter === 'done') return row.followedUp
    return true
  })

  const STATUS_CHIPS: { id: LeakStatusFilter; label: string; count: number }[] = [
    { id: 'all', label: t('pages.training.leaks.chips.all', 'All'), count: totalCount },
    {
      id: 'not',
      label: t('pages.training.leaks.chips.notFollowedUp', 'Not followed up'),
      count: notFollowedCount,
    },
    {
      id: 'done',
      label: t('pages.training.leaks.chips.followedUp', 'Followed up'),
      count: followedCount,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Blue "escalation rule" info banner — dismissible */}
      {!infoDismissed ? (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3">
          <div className="flex items-start gap-2.5">
            <Icons.Info size={16} className="mt-0.5 flex-shrink-0 text-[#3B82F6]" />
            <p className="text-[11px] leading-relaxed text-[#1D4ED8]">
              {t(
                'pages.training.leaks.ruleBanner',
                'Escalation rule: the client had a payment promise for today or overdue, but the payment has not been received. The operator is required to call back and follow up. Unprocessed escalations are a critical indicator.'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setInfoDismissed(true)}
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[#1D4ED8] hover:bg-[#DBEAFE]"
            aria-label={t('common.dismiss', 'Dismiss')}
          >
            <Icons.Close size={12} />
          </button>
        </div>
      ) : null}

      {/* KPI strip — 3 horizontal icon tiles */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <AnalyticsKpiTile
          label={t('pages.training.leaks.kpi.totalEscalations', 'Total escalations')}
          value={k.totalEscalations}
          icon={<Icons.Warning size={18} />}
          iconBg="bg-[#FEFCE8]"
          iconTone="text-[#CA8A04]"
        />
        <AnalyticsKpiTile
          label={t('pages.training.leaks.kpi.notFollowedUp', 'Not followed up')}
          value={k.notFollowedUp}
          icon={<Icons.Close size={18} />}
          iconBg="bg-[#FEF2F2]"
          iconTone="text-[#EF4444]"
        />
        <AnalyticsKpiTile
          label={t('pages.training.leaks.kpi.followedUp', 'Followed up')}
          value={k.followedUp}
          icon={<Icons.Success size={18} />}
          iconBg="bg-[#ECFDF5]"
          iconTone="text-[#22C55E]"
        />
      </div>

      {/* Red banner — title + secondary line */}
      <div className="flex items-start gap-2.5 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3">
        <Icons.Warning size={16} className="mt-0.5 flex-shrink-0 text-[#EF4444]" />
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold text-[#EF4444]">
            {t('pages.training.leaks.escalationBanner', '4 escalations without follow-up')}
          </span>
          <span className="text-[11px] text-[#676767]">
            {t(
              'pages.training.leaks.escalationBannerHint',
              'Operators did not call after the escalation. Trainer or senior department intervention is needed.'
            )}
          </span>
        </div>
      </div>

      {/* Status chip strip + table together in one card */}
      <div className="overflow-hidden rounded-xl border border-[#EBECE8] bg-white shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#EBECE8] px-4 py-3">
          {STATUS_CHIPS.map((chip) => {
            const isActive = statusFilter === chip.id
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setStatusFilter(chip.id)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive ? 'bg-[#204E4D] text-white' : 'text-[#545454] hover:bg-[#F7F7F7]'
                }`}
              >
                {chip.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    isActive ? 'bg-[#BBFB5B] text-[#05040D]' : 'bg-[#EDEDED] text-[#05040D]'
                  }`}
                >
                  {chip.count}
                </span>
              </button>
            )
          })}
        </div>

        <AnalyticsMockTable>
          <thead className={ANALYTICS_TABLE_HEAD}>
            <tr>
              <th className={ANALYTICS_TABLE_TH}>
                {t('pages.training.leaks.cols.operator', 'Operator')}
              </th>
              <th className={ANALYTICS_TABLE_TH}>
                {t('pages.training.leaks.cols.client', 'Client')}
              </th>
              <th className={ANALYTICS_TABLE_TH}>
                {t('pages.training.leaks.cols.agreement', 'Agreement')}
              </th>
              <th className={ANALYTICS_TABLE_TH}>
                {t('pages.training.leaks.cols.amount', 'Amount of promise')}
              </th>
              <th className={ANALYTICS_TABLE_TH}>
                {t('pages.training.leaks.cols.dateOfPromise', 'Date of promise')}
              </th>
              <th className={ANALYTICS_TABLE_TH}>
                {t('pages.training.leaks.cols.followUp', 'Follow-up')}
              </th>
              <th className={ANALYTICS_TABLE_TH}>
                {t('pages.training.leaks.cols.callAfter', 'Call after escalation')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <LeakRow
                key={row.id}
                row={row}
                followedLabel={t('pages.training.leaks.followUp.followed', 'Followed up')}
                notFollowedLabel={t('pages.training.leaks.followUp.notFollowed', 'Not followed up')}
              />
            ))}
          </tbody>
        </AnalyticsMockTable>
      </div>
    </div>
  )
}

function LeakRow({
  row,
  followedLabel,
  notFollowedLabel,
}: {
  row: MockLeakRow
  followedLabel: string
  notFollowedLabel: string
}) {
  const isFollowed = row.followedUp
  const isNoCall = row.callAfterEscalationLabel.toLowerCase().includes('no call')
  return (
    <tr className={ANALYTICS_TABLE_ROW}>
      <td className={ANALYTICS_TABLE_TD}>
        <div className="flex items-center gap-2">
          {row.operatorInitials ? (
            <span className="relative flex-shrink-0">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-[#05040D]"
                style={{ backgroundColor: row.operatorAvatarColor ?? '#EDEDED' }}
              >
                {row.operatorInitials}
              </span>
              {row.operatorPresence ? (
                <span
                  className={`absolute right-0 bottom-0 h-2 w-2 rounded-full border border-white ${PRESENCE_DOT[row.operatorPresence]}`}
                  aria-hidden
                />
              ) : null}
            </span>
          ) : null}
          <span className="text-xs font-medium text-[#05040D]">{row.operator}</span>
        </div>
      </td>
      <td className={`${ANALYTICS_TABLE_TD} text-[#3B82F6]`}>{row.client}</td>
      <td className={ANALYTICS_TABLE_TD}>{row.agreement}</td>
      <td className={`${ANALYTICS_TABLE_TD} font-semibold text-[#05040D]`}>
        {row.promiseAmount.toLocaleString()} ₴
      </td>
      <td className={ANALYTICS_TABLE_TD}>{row.promiseDateLabel}</td>
      <td className={ANALYTICS_TABLE_TD}>
        {isFollowed ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
            <Icons.Success size={10} />
            {followedLabel}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
            <Icons.Close size={10} />
            {notFollowedLabel}
          </span>
        )}
      </td>
      <td
        className={`${ANALYTICS_TABLE_TD} ${isNoCall ? 'font-medium text-[#EF4444]' : 'text-[#05040D]'}`}
      >
        {row.callAfterEscalationLabel}
      </td>
    </tr>
  )
}

export default LeaksSubTab
