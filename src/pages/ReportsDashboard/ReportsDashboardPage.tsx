/**
 * ReportsDashboardPage Component
 *
 * Main page for viewing reports dashboard with KPIs and agent performance metrics.
 * Integrates with Report Service backend API.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  KPICard,
  PeriodTabs,
  AgentPerformanceTable,
  PaymentsCollectedModal,
  ReportsDashboardPageSkeleton,
  CallsMadeDetailModal,
  ContactRateDetailModal,
  SMSSentDetailModal,
} from './components'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { useAuthStore } from '@/stores/authStore'
import {
  useDashboard,
  useAgentPerformanceTable,
  useExportDashboard,
  useCallsMadeModal,
  useContactRateModal,
  useSMSSentModal,
  type Period,
} from '@/features/report'

// ============================================================================
// Error State Component
// ============================================================================

function ErrorState({ message }: { message: string }) {
  const { t } = useTranslation('common')

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <Icons.Warning size={48} className="text-error-500" />
      <h2 className="text-dark-500 text-xl font-medium">
        {t('pages.reports.error.title', 'Failed to load reports')}
      </h2>
      <p className="text-dark-300">{message}</p>
      <Button variant="secondary" onClick={() => window.location.reload()}>
        {t('pages.reports.error.retry', 'Retry')}
      </Button>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function ReportsDashboardPage() {
  const { t } = useTranslation('common')
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('today')

  // Modal visibility states
  const [showCallsModal, setShowCallsModal] = useState(false)
  const [showContactRateModal, setShowContactRateModal] = useState(false)
  const [showSMSModal, setShowSMSModal] = useState(false)
  const [showPaymentsModal, setShowPaymentsModal] = useState(false)

  // Get current project from auth store
  const activeProjectId = useAuthStore((state) => state.user?.active_project_id)
  const projectId = activeProjectId ? Number(activeProjectId) : 1

  // Fetch dashboard data from API
  const {
    data: dashboardData,
    isLoading: isDashboardLoading,
    error: dashboardError,
  } = useDashboard({
    projectId,
    period: selectedPeriod,
  })

  // Fetch operator performance data for table
  const { data: agentPerformance, isLoading: isOperatorLoading } = useAgentPerformanceTable({
    projectId,
  })

  // Export mutation
  const { mutate: exportDashboard, isPending: isExporting } = useExportDashboard()

  // Modal data hooks - only fetch when modals are open
  const callsModalQuery = useCallsMadeModal({
    projectId,
    period: selectedPeriod,
    enabled: showCallsModal,
  })

  const contactRateModalQuery = useContactRateModal({
    projectId,
    period: selectedPeriod,
    enabled: showContactRateModal,
  })

  const smsModalQuery = useSMSSentModal({
    projectId,
    period: selectedPeriod,
    enabled: showSMSModal,
  })

  // Combined loading state
  const isLoading = isDashboardLoading || isOperatorLoading

  // Handle export
  const handleExport = () => {
    exportDashboard({
      projectId,
      format: 'csv',
      period: selectedPeriod,
    })
  }

  // Show loading skeleton
  if (isLoading) {
    return <ReportsDashboardPageSkeleton />
  }

  // Show error state
  if (dashboardError) {
    const errorMessage =
      (dashboardError as Error)?.message ||
      t('pages.reports.error.generic', 'An error occurred while loading the dashboard')
    return <ErrorState message={errorMessage} />
  }

  // Safety check for data
  if (!dashboardData) {
    return <ErrorState message={t('pages.reports.error.noData', 'No data available')} />
  }

  return (
    <div className="flex flex-1 flex-col items-start gap-4 self-stretch">
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
            onClick={handleExport}
            disabled={isExporting}
            leftIcon={<Icons.Csv02 size={20} />}
            className="rounded-full"
          >
            {isExporting
              ? t('pages.reports.exporting', 'Exporting...')
              : t('pages.reports.exportCsv')}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex items-start gap-5 self-stretch">
        {/* Left Column - KPI Cards */}
        <div className="flex w-[35%] flex-col items-start gap-5 self-stretch">
          <KPICard
            title={t('pages.reports.kpi.callsMade')}
            value={dashboardData.kpis.callsMade.toString()}
            change={dashboardData.kpis.callsTrend.change}
            changeType={dashboardData.kpis.callsTrend.changeType}
            icon="phone"
            period={selectedPeriod}
            onViewDetails={() => setShowCallsModal(true)}
          />
          <KPICard
            title={t('pages.reports.kpi.contactRate')}
            value={`${dashboardData.kpis.contactRate.toFixed(1)}%`}
            change={dashboardData.kpis.contactRateTrend.change}
            changeType={dashboardData.kpis.contactRateTrend.changeType}
            icon="chart"
            isPercentage
            percentage={dashboardData.kpis.contactRate}
            period={selectedPeriod}
            onViewDetails={() => setShowContactRateModal(true)}
          />
          <KPICard
            title={t('pages.reports.kpi.smsSent')}
            value={dashboardData.kpis.smsSent.toString()}
            change={dashboardData.kpis.smsTrend.change}
            changeType={dashboardData.kpis.smsTrend.changeType}
            icon="mail"
            period={selectedPeriod}
            onViewDetails={() => setShowSMSModal(true)}
          />
          <KPICard
            title={t('pages.reports.kpi.paymentsCollected')}
            value={dashboardData.kpis.paymentsCollected.toString()}
            change={dashboardData.kpis.paymentsTrend.change}
            changeType={dashboardData.kpis.paymentsTrend.changeType}
            icon="payments"
            period={selectedPeriod}
            onViewDetails={() => setShowPaymentsModal(true)}
          />
        </div>

        {/* Right Column - Agent Performance Table */}
        <div className="flex flex-1 self-stretch">
          <AgentPerformanceTable data={agentPerformance || []} selectedPeriod={selectedPeriod} />
        </div>
      </div>

      {/* Calls Made Detail Modal */}
      {showCallsModal && (
        <CallsMadeDetailModal
          open={showCallsModal}
          onClose={() => setShowCallsModal(false)}
          period={selectedPeriod}
          data={callsModalQuery.data}
          isLoading={callsModalQuery.isLoading}
          error={callsModalQuery.error as Error | null}
        />
      )}

      {/* Contact Rate Detail Modal */}
      {showContactRateModal && (
        <ContactRateDetailModal
          open={showContactRateModal}
          onClose={() => setShowContactRateModal(false)}
          period={selectedPeriod}
          data={contactRateModalQuery.data}
          isLoading={contactRateModalQuery.isLoading}
          error={contactRateModalQuery.error as Error | null}
        />
      )}

      {/* SMS Sent Detail Modal */}
      {showSMSModal && (
        <SMSSentDetailModal
          open={showSMSModal}
          onClose={() => setShowSMSModal(false)}
          period={selectedPeriod}
          data={smsModalQuery.data}
          isLoading={smsModalQuery.isLoading}
          error={smsModalQuery.error as Error | null}
        />
      )}

      {/* Payments Collected Modal */}
      {showPaymentsModal && (
        <PaymentsCollectedModal
          open={showPaymentsModal}
          onClose={() => setShowPaymentsModal(false)}
          period={selectedPeriod}
          data={{
            totalAmount: dashboardData.kpis.paymentsCollected,
            paymentCount: dashboardData.kpis.paymentsCount,
            verifiedAmount: dashboardData.kpis.paymentsVerified,
            pendingAmount: dashboardData.kpis.paymentsPending,
            trend: {
              change: dashboardData.kpis.paymentsTrend.change,
              direction: dashboardData.kpis.paymentsTrend.changeType === 'increase' ? 'up' : 'down',
            },
            topCollectorName: dashboardData.topOperators[0]?.operatorName,
            topCollectorAmount: agentPerformance?.[0]?.payments,
          }}
        />
      )}
    </div>
  )
}

export default ReportsDashboardPage
