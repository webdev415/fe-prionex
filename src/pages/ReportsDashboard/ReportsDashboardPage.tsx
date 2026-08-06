/**
 * ReportsDashboardPage Component
 *
 * Main page for viewing reports. Hosts two tabs (active tab in the URL via
 * `?tab=…`): the reports dashboard with KPIs and agent performance metrics
 * (default), and the "Відпрацювання за ЦД" client processing report.
 */

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
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
  type Period,
} from '@/features/report'
import { PermissionGuard } from '@/components/auth'
import { PERMISSIONS } from '@/constants/permissions'
import { ClientProcessingTab } from '@/features/clientProcessing'
import { SegmentedTabs } from '@/components/ui/SegmentedTabs'

// ============================================================================
// Error State Component
// ============================================================================

function ErrorState({ message }: { message: string }) {
  const { t } = useTranslation('common')

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <Icons.Warning size={48} className="text-error-500" />
      <h2 className="text-foreground text-xl font-medium">
        {t('pages.reports.error.title', 'Failed to load reports')}
      </h2>
      <p className="text-muted-foreground">{message}</p>
      <Button variant="secondary" onClick={() => window.location.reload()}>
        {t('pages.reports.error.retry', 'Retry')}
      </Button>
    </div>
  )
}

// ============================================================================
// Dashboard Tab (the pre-tabs page content, unchanged)
// ============================================================================

function DashboardTab() {
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

  // Check if user is authenticated
  if (!isAuthenticated || !user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <Icons.Warning size={48} className="text-warning-500" />
        <h2 className="text-foreground text-xl font-medium">
          {t('pages.reports.error.notAuthenticated', 'Authentication Required')}
        </h2>
        <p className="text-muted-foreground">
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
    <div className="flex flex-1 flex-col items-start gap-4 self-stretch sm:gap-5">
      {/* Tab header: period tabs + export. The page title (h1) lives in the
          tab host so it renders on every tab; an empty first grid cell keeps
          the PeriodTabs centered on lg screens. */}
      <div className="flex flex-col gap-3 self-stretch lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:gap-4">
        <div className="hidden lg:block" aria-hidden />
        <div className="flex w-full justify-center lg:w-auto">
          <div className="bg-card flex w-full max-w-md items-center justify-center gap-1 rounded-lg p-1 shadow-sm sm:w-auto sm:max-w-none">
            <PeriodTabs selectedPeriod={selectedPeriod} onPeriodChange={handlePeriodChange} />
          </div>
        </div>
        <div className="flex w-full justify-center sm:justify-end lg:justify-self-end">
          <PermissionGuard permission={PERMISSIONS.REPORTS.VIEW_ALL_REPORTS}>
            <Button
              variant="primary"
              size="md"
              onClick={handleExport}
              disabled={isExporting}
              leftIcon={<Icons.Csv02 size={20} className="text-primary-foreground" />}
              className="h-[45px] w-full max-w-sm rounded-full text-xs sm:w-auto sm:text-sm"
            >
              {isExporting
                ? t('pages.reports.exporting', 'Exporting...')
                : t('pages.reports.exportCsv')}
            </Button>
          </PermissionGuard>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex w-full flex-col items-stretch gap-5 lg:flex-row lg:items-start">
        {/* Left Column - KPI Cards */}
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:flex lg:w-[35%] lg:shrink-0 lg:flex-col lg:gap-5 lg:self-start">
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
            value={dashboardData.kpis.messagesSent.toString()}
            change={dashboardData.kpis.messagesTrend.change}
            changeType={dashboardData.kpis.messagesTrend.changeType}
            icon="message"
            period={selectedPeriod}
            onViewDetails={() => setShowMessagesModal(true)}
          />
          <KPICard
            className="sm:col-span-2 lg:col-span-1"
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
        <div className="flex w-full min-w-0 flex-1">
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

// ============================================================================
// Main Component — tab host
// ============================================================================

const REPORT_TABS = ['dashboard', 'processing'] as const
type ReportsTab = (typeof REPORT_TABS)[number]

export function ReportsDashboardPage() {
  const { t } = useTranslation('common')
  const [searchParams, setSearchParams] = useSearchParams()

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const user = useAuthStore((state) => state.user)

  const rawTab = searchParams.get('tab')
  const activeTab: ReportsTab = rawTab === 'processing' ? 'processing' : 'dashboard'

  // DEV-only token expiry check, at the host level so it covers every tab.
  // Kept in useEffect to avoid impure operations during render.
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
  }, [isAuthenticated, user])

  const handleTabChange = (tab: ReportsTab) => {
    const next = new URLSearchParams(searchParams)
    // Keep the default tab's URL clean — `?tab=` only appears for non-default tabs.
    if (tab === 'dashboard') next.delete('tab')
    else next.set('tab', tab)
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="flex flex-1 flex-col gap-4 self-stretch">
      {/* Page title — shared by every tab */}
      <h1 className="text-foreground text-xl leading-tight font-light tracking-[-0.48px] sm:text-2xl">
        {t('pages.reports.title')}
      </h1>

      {/* Tab strip */}
      <SegmentedTabs<ReportsTab>
        variant="underline"
        className="self-stretch"
        items={REPORT_TABS.map((tab) => ({ id: tab, label: t(`pages.reports.tabs.${tab}`) }))}
        value={activeTab}
        onChange={handleTabChange}
        ariaLabel={t('pages.reports.title')}
      />

      {activeTab === 'dashboard' ? <DashboardTab /> : <ClientProcessingTab />}
    </div>
  )
}

export default ReportsDashboardPage
