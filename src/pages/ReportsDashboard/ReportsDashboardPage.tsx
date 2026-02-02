/**
 * ReportsDashboardPage Component
 *
 * Main page for viewing reports dashboard with KPIs and agent performance metrics.
 * Integrates with Report Service backend API.
 */

import { useState, useMemo, useEffect } from 'react'
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

  // Get current project and auth status from auth store
  const activeProjectId = useAuthStore((state) => state.user?.active_project_id)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const user = useAuthStore((state) => state.user)
  const projectId = activeProjectId ? Number(activeProjectId) : 1

  // Calculate date range from selected period for operator performance
  const dateRange = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    switch (selectedPeriod) {
      case 'today':
        return {
          from: today.toISOString().split('T')[0],
          to: today.toISOString().split('T')[0],
        }
      case 'thisWeek': {
        const dayOfWeek = today.getDay()
        const monday = new Date(today)
        monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
        return {
          from: monday.toISOString().split('T')[0],
          to: today.toISOString().split('T')[0],
        }
      }
      case 'thisMonth': {
        const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
        return {
          from: firstOfMonth.toISOString().split('T')[0],
          to: today.toISOString().split('T')[0],
        }
      }
      default:
        return {
          from: today.toISOString().split('T')[0],
          to: today.toISOString().split('T')[0],
        }
    }
  }, [selectedPeriod])

  // Fetch dashboard data from API
  const {
    data: dashboardData,
    isLoading: isDashboardLoading,
    error: dashboardError,
  } = useDashboard({
    projectId,
    period: selectedPeriod,
  })

  // Fetch operator performance data for table with date range
  const { data: agentPerformance, isLoading: isOperatorLoading } = useAgentPerformanceTable({
    projectId,
    fromDate: dateRange.from,
    toDate: dateRange.to,
  })

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

  // Check token expiry in useEffect to avoid impure operations during render
  useEffect(() => {
    if (import.meta.env.DEV) {
      const token = sessionStorage.getItem('prionex_token')
      console.log('[ReportsDashboard] Auth Status:', {
        isAuthenticated,
        hasUser: !!user,
        projectId,
        hasToken: !!token,
        tokenLength: token?.length || 0,
        userPermissions: user?.permissions?.length || 0,
      })

      // Decode and check token expiry
      if (token) {
        try {
          const base64Url = token.split('.')[1]
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
          const payload = JSON.parse(atob(base64))
          const now = Math.floor(Date.now() / 1000)
          const isExpired = payload.exp && payload.exp < now

          console.log('[ReportsDashboard] Token Details:', {
            exp: payload.exp,
            expDate: payload.exp ? new Date(payload.exp * 1000).toISOString() : 'N/A',
            now,
            nowDate: new Date(now * 1000).toISOString(),
            isExpired,
            timeLeft: payload.exp ? `${Math.floor((payload.exp - now) / 60)} minutes` : 'N/A',
            sub: payload.sub,
            roles: payload.roles,
          })

          if (isExpired) {
            console.error('[ReportsDashboard] ⚠️ TOKEN IS EXPIRED! Redirecting to login...')
            // Clear expired token
            sessionStorage.removeItem('prionex_token')
            // Force logout
            setTimeout(() => {
              window.location.href = '/login'
            }, 1000)
          }
        } catch (e) {
          console.error('[ReportsDashboard] Failed to decode token:', e)
        }
      } else {
        console.error('[ReportsDashboard] NO TOKEN FOUND IN SESSION STORAGE!')
      }
    }
  }, [isAuthenticated, user, projectId])

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

  // Show loading skeleton
  if (isLoading) {
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
