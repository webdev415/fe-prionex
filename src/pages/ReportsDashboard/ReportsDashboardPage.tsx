/**
 * ReportsDashboardPage Component
 *
 * Main page for viewing reports dashboard with KPIs and agent performance metrics.
 * Integrates with Report Service backend API.
 */

import { useState, useMemo, useEffect, useCallback } from 'react'
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
  MessagesSentDetailModal,
} from './components'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { useAuthStore } from '@/stores/authStore'
import { SESSION } from '@/constants'
import { getDateRangeForPeriod } from '@/lib/dateUtils'
import {
  useDashboard,
  useAgentPerformanceTable,
  useExportDashboard,
  useCallsMadeModal,
  useContactRateModal,
  useSMSSentModal,
  useMessagesSentModal,
  useCommunicationStatistics,
  type Period,
} from '@/features/report'
import { PermissionGuard } from '@/components/auth'
import { PERMISSIONS } from '@/constants/permissions'

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
  const [showMessagesModal, setShowMessagesModal] = useState(false)
  const [showPaymentsModal, setShowPaymentsModal] = useState(false)

  // Filter states - lifted up to trigger API refetch
  const [selectedOperator, setSelectedOperator] = useState<number | null>(null)
  const [customFromDate, setCustomFromDate] = useState<string | null>(null)
  const [customToDate, setCustomToDate] = useState<string | null>(null)

  // Get current project and auth status from auth store
  const activeProjectId = useAuthStore((state) => state.user?.active_project_id)
  const userProjects = useAuthStore((state) => state.user?.projects)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const user = useAuthStore((state) => state.user)
  // Prefer active project; fall back to first assigned project before defaulting to 1
  const fallbackProjectId = userProjects?.[0]?.id
  const projectId: number = Number(activeProjectId ?? fallbackProjectId ?? 1)
  const userTimezone = user?.timezone

  // Calculate date range from selected period in the user's profile timezone
  const dateRange = useMemo(
    () => getDateRangeForPeriod(selectedPeriod, userTimezone),
    [selectedPeriod, userTimezone]
  )

  // Handler to change period and reset custom dates
  const handlePeriodChange = useCallback((newPeriod: Period) => {
    setSelectedPeriod(newPeriod)
    setCustomFromDate(null)
    setCustomToDate(null)
  }, [])

  // Use custom dates if set, otherwise use period-based dates
  const actualDateRange = useMemo(() => {
    if (customFromDate || customToDate) {
      return {
        from: customFromDate || dateRange.from,
        to: customToDate || dateRange.to,
      }
    }
    return dateRange
  }, [dateRange, customFromDate, customToDate])

  // Fetch dashboard data from API
  // Use 'custom' period when custom dates are set, and convert dates to ISO strings
  const {
    data: dashboardData,
    isLoading: isDashboardLoading,
    error: dashboardError,
  } = useDashboard({
    projectId,
    period: customFromDate || customToDate ? 'custom' : selectedPeriod,
    startDate: customFromDate || actualDateRange.from,
    endDate: customToDate || actualDateRange.to,
    timezone: userTimezone,
  })

  // Fetch operator performance data for table with date range and filters
  const {
    data: agentPerformance,
    isLoading: isOperatorLoading,
    isFetching: isOperatorFetching,
  } = useAgentPerformanceTable({
    projectId,
    operatorId: selectedOperator ?? undefined,
    fromDate: actualDateRange.from,
    toDate: actualDateRange.to,
    timezone: userTimezone,
  })

  const { mutate: exportDashboard, isPending: isExporting } = useExportDashboard()

  // Modal data hooks - only fetch when modals are open
  const callsModalQuery = useCallsMadeModal({
    projectId,
    period: selectedPeriod,
    enabled: showCallsModal,
    userTimezone,
  })

  const contactRateModalQuery = useContactRateModal({
    projectId,
    period: selectedPeriod,
    enabled: showContactRateModal,
    userTimezone,
  })

  const smsModalQuery = useSMSSentModal({
    projectId,
    period: selectedPeriod,
    enabled: showSMSModal,
    userTimezone,
  })

  const messagesModalQuery = useMessagesSentModal({
    projectId,
    period: selectedPeriod,
    enabled: showMessagesModal,
    userTimezone,
  })

  const { data: communicationStats } = useCommunicationStatistics({
    projectId,
    fromDate: actualDateRange.from,
    toDate: actualDateRange.to,
    timezone: userTimezone,
  })

  const messagesSentKpi = communicationStats?.messagingStatistics.totalSent ?? 0

  const isTableLoading = isOperatorLoading || isOperatorFetching

  // Fallback KPIs derived from operator performance (useful when dashboard KPIs are zero/lagging)
  const callsFromOperators = useMemo(() => {
    if (!agentPerformance || agentPerformance.length === 0) return 0
    return agentPerformance.reduce((sum, row) => sum + (row.calls || 0), 0)
  }, [agentPerformance])

  const contactRateFromOperators = useMemo(() => {
    if (!agentPerformance || agentPerformance.length === 0) return 0
    const totalCalls = agentPerformance.reduce((sum, row) => sum + (row.calls || 0), 0)
    if (totalCalls === 0) return 0
    const weighted = agentPerformance.reduce(
      (sum, row) => sum + (row.contactRate || 0) * (row.calls || 0),
      0
    )
    return Math.round((weighted / totalCalls) * 10) / 10
  }, [agentPerformance])

  // Handle export
  const handleExport = () => {
    exportDashboard({
      projectId,
      format: 'csv',
      period: selectedPeriod,
    })
  }

  // Check token expiry in useEffect to avoid impure operations during render
  useEffect(() => {
    if (import.meta.env.DEV) {
      const token = localStorage.getItem(SESSION.TOKEN_KEY)

      // Decode and check token expiry
      if (token) {
        try {
          const base64Url = token.split('.')[1]
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
          const payload = JSON.parse(atob(base64))
          const now = Math.floor(Date.now() / 1000)
          const isExpired = payload.exp && payload.exp < now

          if (isExpired) {
            console.error('[ReportsDashboard] ⚠️ TOKEN IS EXPIRED! Redirecting to login...')
            // Clear expired token
            localStorage.removeItem(SESSION.TOKEN_KEY)
            // Force logout
            setTimeout(() => {
              window.location.href = '/login'
            }, 1000)
          }
        } catch (e) {
          console.error('[ReportsDashboard] Failed to decode token:', e)
        }
      }
    }
  }, [isAuthenticated, projectId, user])

  // Check if user is authenticated
  if (!isAuthenticated || !user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <Icons.Warning size={48} className="text-warning-500" />
        <h2 className="text-dark-500 text-xl font-medium">
          {t('pages.reports.error.notAuthenticated', 'Authentication Required')}
        </h2>
        <p className="text-dark-300">
          {t('pages.reports.error.pleaseLogin', 'Please log in to view reports')}
        </p>
        <Button variant="primary" onClick={() => (window.location.href = '/login')}>
          {t('pages.reports.error.goToLogin', 'Go to Login')}
        </Button>
      </div>
    )
  }

  // Show full-page skeleton only on initial dashboard load.
  if (isDashboardLoading && !dashboardData) {
    return <ReportsDashboardPageSkeleton />
  }

  // Show error state
  if (dashboardError) {
    const error = dashboardError as unknown as {
      response?: { data?: { detail?: string }; status?: number }
      message?: string
    }
    const errorMessage =
      error?.response?.data?.detail ||
      error?.message ||
      t('pages.reports.error.generic', 'An error occurred while loading the dashboard')
    const statusCode = error?.response?.status

    // Log error details for debugging
    console.error('[ReportsDashboard] Error loading dashboard:', {
      message: errorMessage,
      status: statusCode,
      fullError: error,
    })

    return <ErrorState message={`${errorMessage}${statusCode ? ` (${statusCode})` : ''}`} />
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
          <PeriodTabs selectedPeriod={selectedPeriod} onPeriodChange={handlePeriodChange} />
        </div>
        <div className="flex h-12 flex-1 flex-col items-end gap-2.5">
          <PermissionGuard permission={PERMISSIONS.REPORTS.VIEW_ALL_REPORTS}>
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
          </PermissionGuard>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex items-start gap-5 self-stretch">
        {/* Left Column - KPI Cards */}
        <div className="flex w-[35%] flex-col items-start gap-5 self-stretch">
          <KPICard
            title={t('pages.reports.kpi.callsMade')}
            value={(dashboardData.kpis.callsMade || callsFromOperators || 0).toString()}
            change={dashboardData.kpis.callsTrend.change}
            changeType={dashboardData.kpis.callsTrend.changeType}
            icon="phone"
            period={selectedPeriod}
            onViewDetails={() => setShowCallsModal(true)}
          />
          <KPICard
            title={t('pages.reports.kpi.contactRate')}
            value={`${(dashboardData.kpis.contactRate || contactRateFromOperators).toFixed(1)}%`}
            change={dashboardData.kpis.contactRateTrend.change}
            changeType={dashboardData.kpis.contactRateTrend.changeType}
            icon="chart"
            isPercentage
            percentage={dashboardData.kpis.contactRate || contactRateFromOperators}
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
            title={t('pages.reports.kpi.messagesSent')}
            value={messagesSentKpi.toString()}
            change={0}
            changeType="increase"
            icon="message"
            period={selectedPeriod}
            hideTrend
            onViewDetails={() => setShowMessagesModal(true)}
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
          <AgentPerformanceTable
            data={agentPerformance || []}
            isLoading={isTableLoading}
            selectedPeriod={selectedPeriod}
            selectedOperator={selectedOperator}
            onOperatorChange={setSelectedOperator}
            customFromDate={customFromDate}
            customToDate={customToDate}
            onFromDateChange={setCustomFromDate}
            onToDateChange={setCustomToDate}
            userTimezone={userTimezone}
          />
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

      {/* Messages Sent Detail Modal (messaging-service) */}
      {showMessagesModal && (
        <MessagesSentDetailModal
          open={showMessagesModal}
          onClose={() => setShowMessagesModal(false)}
          period={selectedPeriod}
          data={messagesModalQuery.data}
          isLoading={messagesModalQuery.isLoading}
          error={messagesModalQuery.error as Error | null}
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
            averageAmount: dashboardData.kpis.paymentsAverage,
            largestAmount: dashboardData.kpis.paymentsLargest,
            verifiedAmount: dashboardData.kpis.paymentsVerified,
            pendingAmount: dashboardData.kpis.paymentsPending,
            paymentMethods: dashboardData.paymentMethods,
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
