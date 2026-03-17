import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { PermissionRoute } from './PermissionRoute'
import { GuestRoute } from './GuestRoute'
import { DashboardLayout } from '@/components/layout'
import { PERMISSIONS } from '@/constants/permissions'
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const ForceChangePasswordPage = lazy(() => import('@/pages/auth/ForceChangePasswordPage'))

const UserManagementPage = lazy(() =>
  import('@/pages/UserManagement').then((m) => ({ default: m.UserManagementPage }))
)
const ImportClientsPage = lazy(() =>
  import('@/pages/ImportClients/ImportClientsPage').then((m) => ({
    default: m.ImportClientsPage,
  }))
)
const ImportHistoryPage = lazy(() =>
  import('@/pages/ImportClients/ImportHistoryPage').then((m) => ({
    default: m.ImportHistoryPage,
  }))
)
const ImportDetailsPage = lazy(() =>
  import('@/pages/ImportClients/ImportDetailsPage').then((m) => ({
    default: m.ImportDetailsPage,
  }))
)
const ProjectManagementPage = lazy(() =>
  import('@/pages/ProjectManagement/ProjectManagementPage').then((m) => ({
    default: m.ProjectManagementPage,
  }))
)
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
const SmsTemplatesPage = lazy(() =>
  import('@/pages/SmsTemplates').then((m) => ({ default: m.SmsTemplatesPage }))
)
const ReportsDashboardPage = lazy(() =>
  import('@/pages/ReportsDashboard').then((m) => ({ default: m.ReportsDashboardPage }))
)
const SellerManagementPage = lazy(() =>
  import('@/pages/SellerManagement').then((m) => ({ default: m.SellerManagementPage }))
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
const ProfileSettingsPage = lazy(() =>
  import('@/pages/ProfileSettings/ProfileSettingsPage').then((m) => ({
    default: m.ProfileSettingsPage,
  }))
)
const BulkOperatorAssignmentPage = lazy(() =>
  import('@/pages/Operations').then((m) => ({
    default: m.BulkOperatorAssignmentPage,
  }))
)
const BulkPaymentImportPage = lazy(() =>
  import('@/pages/Operations').then((m) => ({
    default: m.BulkPaymentImportPage,
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

const withSuspense = (element: React.ReactElement) => (
  <Suspense fallback={<div>Loading...</div>}>{element}</Suspense>
)

export const router = createBrowserRouter([
  {
    path: '/login',
    element: withSuspense(
      <GuestRoute>
        <LoginPage />
      </GuestRoute>
    ),
  },
  {
    path: '/change-password',
    element: withSuspense(
      <ProtectedRoute>
        <ForceChangePasswordPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: withSuspense(
          <PermissionRoute requiredPermission={PERMISSIONS.CLIENTS.VIEW}>
            <ClientManagementPage />
          </PermissionRoute>
        ),
      },
      {
        path: 'profile',
        element: withSuspense(<ProfileSettingsPage />),
      },
      {
        path: 'users',
        element: withSuspense(
          <PermissionRoute requiredPermission={PERMISSIONS.USERS.VIEW}>
            <UserManagementPage />
          </PermissionRoute>
        ),
      },
      {
        path: 'import',
        element: withSuspense(
          <PermissionRoute requiredPermission={PERMISSIONS.DATA.IMPORT}>
            <ImportClientsPage />
          </PermissionRoute>
        ),
      },
      {
        path: 'import/history/:id',
        element: withSuspense(
          <PermissionRoute requiredPermission={PERMISSIONS.DATA.IMPORT}>
            <ImportDetailsPage />
          </PermissionRoute>
        ),
      },
      {
        path: 'import/history',
        element: withSuspense(
          <PermissionRoute requiredPermission={PERMISSIONS.DATA.IMPORT}>
            <ImportHistoryPage />
          </PermissionRoute>
        ),
      },
      {
        path: 'projects',
        element: withSuspense(
          <PermissionRoute requiredPermission={PERMISSIONS.PROJECTS.MANAGE}>
            <ProjectManagementPage />
          </PermissionRoute>
        ),
      },
      {
        path: 'roles',
        element: withSuspense(
          <PermissionRoute requiredPermission={PERMISSIONS.SYSTEM.MANAGE_ROLES}>
            <RoleManagementPage />
          </PermissionRoute>
        ),
      },
      {
        path: 'departments',
        element: withSuspense(
          <PermissionRoute requiredPermission={PERMISSIONS.SYSTEM.MANAGE_ROLES}>
            <DepartmentManagementPage />
          </PermissionRoute>
        ),
      },
      {
        path: 'reports',
        element: withSuspense(
          <PermissionRoute requiredPermission={PERMISSIONS.REPORTS.VIEW_ALL_REPORTS}>
            <ReportsDashboardPage />
          </PermissionRoute>
        ),
      },
      {
        path: 'sellers',
        element: withSuspense(
          <PermissionRoute requiredPermission={PERMISSIONS.SELLERS.VIEW}>
            <SellerManagementPage />
          </PermissionRoute>
        ),
      },
      {
        path: 'system-settings/tags',
        element: withSuspense(
          <PermissionRoute requiredPermission={PERMISSIONS.TAGS.VIEW}>
            <TagsPage />
          </PermissionRoute>
        ),
      },
      {
        path: 'system-settings/scoring-configuration',
        element: withSuspense(
          <PermissionRoute requiredPermission={PERMISSIONS.SCORING_CONFIG.VIEW}>
            <ScoringConfigurationPage />
          </PermissionRoute>
        ),
      },
      {
        path: 'system-settings/scoring-configuration/history',
        element: withSuspense(
          <PermissionRoute requiredPermission={PERMISSIONS.SCORING_CONFIG.VIEW_HISTORY}>
            <ConfigurationHistoryPage />
          </PermissionRoute>
        ),
      },
      {
        path: 'system-settings/sms-templates',
        element: withSuspense(
          <PermissionRoute requiredPermission={PERMISSIONS.SYSTEM.MANAGE_SETTINGS}>
            <SmsTemplatesPage />
          </PermissionRoute>
        ),
      },
      {
        path: 'operations/bulk-operator-assignment',
        element: withSuspense(
          <PermissionRoute requiredPermission={PERMISSIONS.CLIENTS.EDIT}>
            <BulkOperatorAssignmentPage />
          </PermissionRoute>
        ),
      },
      {
        path: 'operations/bulk-payment-import',
        element: withSuspense(
          <PermissionRoute requiredPermission={PERMISSIONS.DATA.IMPORT_PAYMENTS}>
            <BulkPaymentImportPage />
          </PermissionRoute>
        ),
      },
      {
        path: 'audit-logs',
        element: withSuspense(
          <PermissionRoute requiredPermission={PERMISSIONS.SYSTEM.VIEW_AUDIT_LOGS}>
            <AuditLogsPage />
          </PermissionRoute>
        ),
      },
      {
        path: 'clients/:id',
        element: withSuspense(
          <PermissionRoute requiredPermission={PERMISSIONS.CLIENTS.VIEW}>
            <ClientDetailPage />
          </PermissionRoute>
        ),
      },
      {
        path: 'clients/:id/debt-summary',
        element: withSuspense(
          <PermissionRoute requiredPermission={PERMISSIONS.CLIENTS.VIEW}>
            <DebtSummaryPage />
          </PermissionRoute>
        ),
      },
      {
        path: 'clients/:id/activity',
        element: withSuspense(
          <PermissionRoute requiredPermission={PERMISSIONS.CLIENTS.VIEW}>
            <ActivityTimelinePage />
          </PermissionRoute>
        ),
      },
      {
        path: 'clients/:id/payment-history',
        element: withSuspense(
          <PermissionRoute requiredPermission={PERMISSIONS.CLIENTS.VIEW}>
            <PaymentHistoryPage />
          </PermissionRoute>
        ),
      },
    ],
  },
  // Legacy routes - redirect to new paths
  {
    path: '/dashboard/scoring-configuration',
    element: <Navigate to="/dashboard/system-settings/scoring-configuration" replace />,
  },
  {
    path: '/dashboard/scoring-configuration/history',
    element: <Navigate to="/dashboard/system-settings/scoring-configuration/history" replace />,
  },
  {
    path: '/dashboard/sms-templates',
    element: <Navigate to="/dashboard/system-settings/sms-templates" replace />,
  },
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
])
