/**
 * ReportsDashboardPage Component
 *
 * Main page for viewing reports dashboard with KPIs and agent performance metrics.
 * Uses mock data matching the Report Service API specification.
 */

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { KPICard, PeriodTabs, AgentPerformanceTable, PaymentsCollectedModal } from './components'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import {
  getMockDashboard,
  getMockOperatorPerformance,
  formatDuration,
  calculateKPIChange,
  getPreviousPeriodKPIs,
  exportToCSV,
} from './mockReportsData'
import type { Period } from './types'

export function ReportsDashboardPage() {
  const { t } = useTranslation('common')
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('today')
  const [showPaymentsModal, setShowPaymentsModal] = useState(false)

  // Get mock dashboard data (matches API structure)
  const dashboardData = useMemo(() => getMockDashboard(selectedPeriod), [selectedPeriod])
  const operatorPerformanceData = useMemo(
    () => getMockOperatorPerformance(selectedPeriod),
    [selectedPeriod]
  )

  // Calculate KPI changes vs previous period
  const previousPeriodKPIs = useMemo(() => getPreviousPeriodKPIs(selectedPeriod), [selectedPeriod])

  const callsMadeChange = useMemo(
    () => calculateKPIChange(dashboardData.kpis.calls_today, previousPeriodKPIs.calls_today),
    [dashboardData.kpis.calls_today, previousPeriodKPIs.calls_today]
  )
  const contactRateChange = useMemo(
    () => calculateKPIChange(dashboardData.kpis.contact_rate, previousPeriodKPIs.contact_rate),
    [dashboardData.kpis.contact_rate, previousPeriodKPIs.contact_rate]
  )
  const smsSentChange = useMemo(
    () => calculateKPIChange(dashboardData.kpis.sms_sent_today, previousPeriodKPIs.sms_sent_today),
    [dashboardData.kpis.sms_sent_today, previousPeriodKPIs.sms_sent_today]
  )

  // Transform operator performance data for table
  const agentPerformance = useMemo(() => {
    return operatorPerformanceData.operators.map((op) => ({
      id: op.operator_id.toString(),
      operator: op.operator_name,
      calls: op.summary.total_calls,
      contactRate: op.summary.contact_rate,
      avgDuration: formatDuration(op.summary.avg_call_duration),
      sms: op.summary.sms_sent,
      payments: op.summary.payments_collected || 0,
    }))
  }, [operatorPerformanceData])

  return (
    <div className="flex flex-1 flex-col items-start gap-5 self-stretch">
      {/* Page Header */}
      <div className="flex h-12 items-center justify-between gap-5 self-stretch">
        <div className="flex flex-1 items-center gap-4 self-stretch">
          <span className="text-dark-500 flex-1 text-2xl leading-tight font-light tracking-[-0.48px]">
            {t('pages.reports.title')}
          </span>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-white p-1 shadow-sm">
          <PeriodTabs selectedPeriod={selectedPeriod} onPeriodChange={setSelectedPeriod} />
        </div>
        <div className="flex h-12 flex-1 flex-col items-end gap-2.5">
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              // Export dashboard data
              const exportData = [
                {
                  Period: selectedPeriod,
                  Date: dashboardData.date,
                  'Total Clients': dashboardData.kpis.total_clients,
                  'Calls Today': dashboardData.kpis.calls_today,
                  'Contact Rate (%)': dashboardData.kpis.contact_rate.toFixed(1),
                  'SMS Sent': dashboardData.kpis.sms_sent_today,
                  'Payments Collected': dashboardData.kpis.payments_collected_today,
                  'Payments Count': dashboardData.kpis.payments_count_today,
                },
              ]
              const filename = `dashboard_${selectedPeriod}_${dashboardData.date}.csv`
              exportToCSV(exportData, filename)
            }}
            leftIcon={<Icons.Csv02 size={20} />}
            className="rounded-full"
          >
            {t('pages.reports.exportCsv')}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex items-start gap-5 self-stretch">
        {/* Left Column - KPI Cards */}
        <div className="flex w-[35%] flex-col items-start gap-5 self-stretch">
          <KPICard
            title={t('pages.reports.kpi.callsMade')}
            value={dashboardData.kpis.calls_today.toString()}
            change={callsMadeChange.change}
            changeType={callsMadeChange.changeType}
            icon="phone"
            period={selectedPeriod}
            onViewDetails={() => setShowPaymentsModal(true)}
          />
          <KPICard
            title={t('pages.reports.kpi.contactRate')}
            value={`${dashboardData.kpis.contact_rate.toFixed(1)}%`}
            change={contactRateChange.change}
            changeType={contactRateChange.changeType}
            icon="chart"
            isPercentage
            percentage={dashboardData.kpis.contact_rate}
            period={selectedPeriod}
            onViewDetails={() => setShowPaymentsModal(true)}
          />
          <KPICard
            title={t('pages.reports.kpi.smsSent')}
            value={dashboardData.kpis.sms_sent_today.toString()}
            change={smsSentChange.change}
            changeType={smsSentChange.changeType}
            icon="mail"
            period={selectedPeriod}
            onViewDetails={() => setShowPaymentsModal(true)}
          />
        </div>

        {/* Right Column - Agent Performance Table */}
        <div className="flex flex-1 self-stretch">
          <AgentPerformanceTable data={agentPerformance} selectedPeriod={selectedPeriod} />
        </div>
      </div>

      {/* Payments Collected Modal */}
      {showPaymentsModal && (
        <PaymentsCollectedModal
          open={showPaymentsModal}
          onClose={() => setShowPaymentsModal(false)}
          period={selectedPeriod}
        />
      )}
    </div>
  )
}

export default ReportsDashboardPage
