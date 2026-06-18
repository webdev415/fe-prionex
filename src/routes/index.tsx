/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { PermissionRoute } from './PermissionRoute'
import { GuestRoute } from './GuestRoute'
import { useTabTracker } from '@/features/auth/hooks/useTabTracker'
import { DashboardLayout } from '@/components/layout'
import { RouteErrorElement } from '@/components/RouteErrorElement'
import { PERMISSIONS } from '@/constants/permissions'
import { BulkOperatorAssignmentPageSkeleton } from '@/pages/Operations/BulkOperatorAssignmentPageSkeleton'
import { BulkTagAssignmentPageSkeleton } from '@/pages/Operations/BulkTagAssignmentPageSkeleton'
import { BulkPaymentVerificationPageSkeleton } from '@/pages/Operations/BulkPaymentVerificationPageSkeleton'
import { AppLoadingFallback } from '@/components/ui/AppLoadingFallback'

const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const ForceChangePasswordPage = lazy(() => import('@/pages/auth/ForceChangePasswordPage'))
const UserManagementPage = lazy(() =>
  import('@/pages/UserManagement').then((m) => ({ default: m.UserManagementPage }))
)
const ImportClientsPage = lazy(() => import('@/pages/ImportClients/ImportClientsPage'))
const ImportHistoryPage = lazy(() => import('@/pages/ImportClients/ImportHistoryPage'))
const ImportDetailsPage = lazy(() => import('@/pages/ImportClients/ImportDetailsPage'))
const ProjectManagementPage = lazy(() => import('@/pages/ProjectManagement/ProjectManagementPage'))
const RoleManagementPage = lazy(() =>
  import('@/pages/RoleManagement/RoleManagementPage').then((m) => ({
    default: m.RoleManagementPage,
  }))
)
const DepartmentManagementPage = lazy(() =>
  import('@/pages/DepartmentManagement').then((m) => ({
    default: m.DepartmentManagementPage,
  }))
)
const ClientManagementPage = lazy(() =>
  import('@/pages/ClientManagement').then((m) => ({
    default: m.ClientManagementPage,
  }))
)
const ClientDetailPage = lazy(() =>
  import('@/pages/ClientManagement').then((m) => ({
    default: m.ClientDetailPage,
  }))
)
const ActivityTimelinePage = lazy(() =>
  import('@/pages/ClientManagement').then((m) => ({
    default: m.ActivityTimelinePage,
  }))
)
const DebtSummaryPage = lazy(() =>
  import('@/pages/ClientManagement').then((m) => ({
    default: m.DebtSummaryPage,
  }))
)
const PaymentHistoryPage = lazy(() =>
  import('@/pages/ClientManagement').then((m) => ({
    default: m.PaymentHistoryPage,
  }))
)
const SmsTemplatesPage = lazy(() =>
  import('@/pages/SmsTemplates').then((m) => ({
    default: m.SmsTemplatesPage,
  }))
)
const MessagingCampaignsPage = lazy(() =>
  import('@/pages/MessagingCampaigns').then((m) => ({
    default: m.MessagingCampaignsPage,
  }))
)
const MessagingDraftsPage = lazy(() =>
  import('@/pages/MessagingDrafts').then((m) => ({
    default: m.MessagingDraftsPage,
  }))
)
const MessagingIntegrationsPage = lazy(() =>
  import('@/pages/MessagingIntegrations').then((m) => ({
    default: m.MessagingIntegrationsPage,
  }))
)
const RRNotificationsPage = lazy(() =>
  import('@/pages/RRNotifications').then((m) => ({
    default: m.RRNotificationsPage,
  }))
)
const TAManagementPage = lazy(() =>
  import('@/pages/TAManagement').then((m) => ({
    default: m.TAManagementPage,
  }))
)
const InteractionLogPage = lazy(() =>
  import('@/pages/InteractionLog').then((m) => ({
    default: m.InteractionLogPage,
  }))
)
const DocumentGenerationPage = lazy(() =>
  import('@/pages/DocumentGeneration').then((m) => ({
    default: m.DocumentGenerationPage,
  }))
)
const ReportsDashboardPage = lazy(() =>
  import('@/pages/ReportsDashboard').then((m) => ({
    default: m.ReportsDashboardPage,
  }))
)
const TrainingPage = lazy(() =>
  import('@/pages/Training').then((m) => ({
    default: m.TrainingPage,
  }))
)
const SellerManagementPage = lazy(() =>
  import('@/pages/SellerManagement').then((m) => ({
    default: m.SellerManagementPage,
  }))
)
const SellerDetailPage = lazy(() =>
  import('@/pages/SellerManagement').then((m) => ({
    default: m.SellerDetailPage,
  }))
)
const ScoringConfigurationPage = lazy(() =>
  import('@/pages/ScoringConfiguration').then((m) => ({
    default: m.ScoringConfigurationPage,
  }))
)
const ConfigurationHistoryPage = lazy(() =>
  import('@/pages/ScoringConfiguration/ConfigurationHistoryPage').then((m) => ({
    default: m.ConfigurationHistoryPage,
  }))
)
const AuditLogsPage = lazy(() =>
  import('@/pages/AuditLogs').then((m) => ({ default: m.AuditLogsPage }))
)
const TagsPage = lazy(() => import('@/pages/Tags/TagsPage').then((m) => ({ default: m.TagsPage })))
const ContactTypesPage = lazy(() =>
  import('@/pages/ContactTypes/ContactTypesPage').then((m) => ({ default: m.ContactTypesPage }))
)
const ProfileSettingsPage = lazy(() =>
  import('@/pages/ProfileSettings/ProfileSettingsPage').then((m) => ({
    default: m.ProfileSettingsPage,
  }))
)
const AiAssistantPage = lazy(() =>
  import('@/pages/AiAssistant/AiAssistantBetaPage').then((m) => ({
    default: m.AiAssistantBetaPage,
  }))
)
// /ai-assistant теперь рендерит бета-страницу с реальным API (@/features/aiAssistant).
// Старая мок-страница (AiAssistantPage.tsx, buildMockAssistantReply) удалена.
const BulkOperatorAssignmentPage = lazy(() =>
  import('@/pages/Operations').then((m) => ({
    default: m.BulkOperatorAssignmentPage,
  }))
)
const BulkPaymentVerificationPage = lazy(() =>
  import('@/pages/Operations').then((m) => ({
    default: m.BulkPaymentVerificationPage,
  }))
)
const BulkTagAssignmentPage = lazy(() =>
  import('@/pages/Operations').then((m) => ({
    default: m.BulkTagAssignmentPage,
  }))
)
const BulkWriteoffImportPage = lazy(() =>
  import('@/pages/Operations').then((m) => ({
    default: m.BulkWriteoffImportPage,
  }))
)

const withSuspense = (element: React.ReactElement) => (
  <Suspense fallback={<AppLoadingFallback />}>{element}</Suspense>
)

const DashboardLayoutRoute = () => {
  // KAN-585: track tab navigations + close events for the session-restore
  // feature. Hook is mounted here (inside RouterProvider tree) because it
  // calls useLocation internally; mounting in App.tsx would throw.
  useTabTracker()
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <Outlet />
      </DashboardLayout>
    </ProtectedRoute>
  )
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <GuestRoute>{withSuspense(<LoginPage />)}</GuestRoute>,
    errorElement: <RouteErrorElement />,
  },
  {
    path: '/change-password',
    element: <ProtectedRoute>{withSuspense(<ForceChangePasswordPage />)}</ProtectedRoute>,
    errorElement: <RouteErrorElement />,
  },
  {
    path: '/dashboard',
    element: <DashboardLayoutRoute />,
    errorElement: <RouteErrorElement />,
    children: [
      {
        index: true,
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.CLIENTS.VIEW}>
            {withSuspense(<ClientManagementPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'profile',
        element: withSuspense(<ProfileSettingsPage />),
      },
      {
        path: 'ai-assistant',
        element: withSuspense(<AiAssistantPage />),
      },
      {
        path: 'team-management/users',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.USERS.VIEW}>
            {withSuspense(<UserManagementPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'import',
        element: <Navigate to="/dashboard/import/clients" replace />,
      },
      {
        path: 'import/clients',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.DATA.IMPORT}>
            {withSuspense(<ImportClientsPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'import/history',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.DATA.IMPORT}>
            {withSuspense(<ImportHistoryPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'import/history/:id',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.DATA.IMPORT}>
            {withSuspense(<ImportDetailsPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'messaging',
        element: <Navigate to="/dashboard/messaging/campaigns" replace />,
      },
      {
        path: 'messaging/campaigns',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.MESSAGING.VIEW_CAMPAIGN_ANALYTICS}>
            {withSuspense(<MessagingCampaignsPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'projects',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.PROJECTS.MANAGE}>
            {withSuspense(<ProjectManagementPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'team-management/roles',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.SYSTEM.MANAGE_ROLES}>
            {withSuspense(<RoleManagementPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'team-management/departments',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.SYSTEM.MANAGE_ROLES}>
            {withSuspense(<DepartmentManagementPage />)}
          </PermissionRoute>
        ),
      },
      // Backward-compat redirects: legacy top-level paths (/dashboard/users,
      // /roles, /departments) now bounce to the grouped /team-management/* URLs
      // so existing bookmarks and external links keep working. The parent
      // /team-management path redirects to the first child (mirrors the
      // /dashboard/import → /dashboard/import/clients pattern above).
      {
        path: 'team-management',
        element: <Navigate to="/dashboard/team-management/users" replace />,
      },
      {
        path: 'users',
        element: <Navigate to="/dashboard/team-management/users" replace />,
      },
      {
        path: 'roles',
        element: <Navigate to="/dashboard/team-management/roles" replace />,
      },
      {
        path: 'departments',
        element: <Navigate to="/dashboard/team-management/departments" replace />,
      },
      {
        path: 'reports',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.REPORTS.VIEW_ALL_REPORTS}>
            {withSuspense(<ReportsDashboardPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'training',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.TRAINING.VIEW}>
            {withSuspense(<TrainingPage />)}
          </PermissionRoute>
        ),
      },
      // Read-shim: keep the legacy /dashboard/action-analysis URL working
      // for bookmarks that pointed at the old Trainer Workplace surface.
      {
        path: 'action-analysis',
        element: <Navigate to="/dashboard/training" replace />,
      },
      {
        path: 'sellers',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.SELLERS.VIEW}>
            {withSuspense(<SellerManagementPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'sellers/:id',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.SELLERS.VIEW}>
            {withSuspense(<SellerDetailPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'system-settings/tags',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.TAGS.VIEW}>
            {withSuspense(<TagsPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'system-settings/messaging-drafts',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.MESSAGING.MANAGE_DRAFTS}>
            {withSuspense(<MessagingDraftsPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'system-settings/messaging-integrations',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.MESSAGING.MANAGE_INTEGRATIONS}>
            {withSuspense(<MessagingIntegrationsPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'system-settings/contact-types',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.CONTACT_TYPES.VIEW}>
            {withSuspense(<ContactTypesPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'system-settings/scoring-configuration',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.SCORING_CONFIG.VIEW}>
            {withSuspense(<ScoringConfigurationPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'system-settings/scoring-configuration/history',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.SCORING_CONFIG.VIEW_HISTORY}>
            {withSuspense(<ConfigurationHistoryPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'system-settings/sms-templates',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.SYSTEM.MANAGE_SETTINGS}>
            {withSuspense(<SmsTemplatesPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'system-settings/rr-notifications',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.SYSTEM.MANAGE_SETTINGS}>
            {withSuspense(<RRNotificationsPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'system-settings/target-actions',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.SYSTEM.MANAGE_SETTINGS}>
            {withSuspense(<TAManagementPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'system-settings/interaction-log',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.SYSTEM.MANAGE_SETTINGS}>
            {withSuspense(<InteractionLogPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'system-settings/document-generation',
        element: (
          <PermissionRoute
            requiredPermissions={[
              PERMISSIONS.DOCUMENT_GENERATION.VIEW_JOURNAL,
              PERMISSIONS.DOCUMENT_GENERATION.VIEW_TEMPLATES,
              PERMISSIONS.DOCUMENT_GENERATION.CREATE_EDIT_TEMPLATES,
              PERMISSIONS.DOCUMENT_GENERATION.DELETE_TEMPLATES,
            ]}
            mode="any"
          >
            {withSuspense(<DocumentGenerationPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'import/bulk-operator-assignment',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.CLIENTS.EDIT}>
            <Suspense fallback={<BulkOperatorAssignmentPageSkeleton />}>
              <BulkOperatorAssignmentPage />
            </Suspense>
          </PermissionRoute>
        ),
      },
      {
        path: 'import/bulk-tag-assignment',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.CLIENTS.ASSIGN_TAGS}>
            <Suspense fallback={<BulkTagAssignmentPageSkeleton />}>
              <BulkTagAssignmentPage />
            </Suspense>
          </PermissionRoute>
        ),
      },
      {
        path: 'import/bulk-payment-import',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.DATA.IMPORT_PAYMENTS}>
            <Suspense fallback={<BulkPaymentVerificationPageSkeleton />}>
              <BulkPaymentVerificationPage />
            </Suspense>
          </PermissionRoute>
        ),
      },
      {
        path: 'import/bulk-writeoff-import',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.WRITEOFFS.BULK}>
            <Suspense fallback={<AppLoadingFallback />}>
              <BulkWriteoffImportPage />
            </Suspense>
          </PermissionRoute>
        ),
      },
      {
        path: 'audit-logs',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.SYSTEM.VIEW_AUDIT_LOGS}>
            {withSuspense(<AuditLogsPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'clients/:id',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.CLIENTS.VIEW}>
            {withSuspense(<ClientDetailPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'clients/:id/debt-summary',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.CLIENTS.VIEW}>
            {withSuspense(<DebtSummaryPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'clients/:id/activity',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.CLIENTS.VIEW}>
            {withSuspense(<ActivityTimelinePage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'clients/:id/payment-history',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.CLIENTS.VIEW}>
            {withSuspense(<PaymentHistoryPage />)}
          </PermissionRoute>
        ),
      },
    ],
  },
  // Legacy routes - redirect to new paths
  {
    path: '/dashboard/scoring-configuration',
    element: <Navigate to="/dashboard/system-settings/scoring-configuration" replace />,
    errorElement: <RouteErrorElement />,
  },
  {
    path: '/dashboard/scoring-configuration/history',
    element: <Navigate to="/dashboard/system-settings/scoring-configuration/history" replace />,
    errorElement: <RouteErrorElement />,
  },
  {
    path: '/dashboard/sms-templates',
    element: <Navigate to="/dashboard/system-settings/sms-templates" replace />,
    errorElement: <RouteErrorElement />,
  },
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
    errorElement: <RouteErrorElement />,
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
    errorElement: <RouteErrorElement />,
  },
])
