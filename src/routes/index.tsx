import { createBrowserRouter, Navigate } from 'react-router-dom'
import LoginPage from '@/pages/auth/LoginPage'
import { UserManagementPage } from '@/pages/UserManagement'
import { ImportClientsPage } from '@/pages/ImportClients/ImportClientsPage'
import { ProjectManagementPage } from '@/pages/ProjectManagement/ProjectManagementPage'
import { RoleManagementPage } from '@/pages/RoleManagement/RoleManagementPage'
import { ForbiddenPage } from '@/pages/errors'
import { ProtectedRoute } from './ProtectedRoute'
import { PermissionRoute } from './PermissionRoute'
import { GuestRoute } from './GuestRoute'
import { DashboardLayout } from '@/components/layout'
import { PERMISSIONS } from '@/constants/permissions'
import { ImportHistoryPage } from '@/pages/ImportClients/ImportHistoryPage'
import { ImportDetailsPage } from '@/pages/ImportClients/ImportDetailsPage'
import {
  ClientManagementPage,
  ClientDetailPage,
  ActivityTimelinePage,
  DebtSummaryPage,
  PaymentHistoryPage,
} from '@/pages/ClientManagement'
import { SmsTemplatesPage } from '@/pages/SmsTemplates'
import { ReportsDashboardPage } from '@/pages/ReportsDashboard'
import { SellerManagementPage } from '@/pages/SellerManagement'
import { ScoringConfigurationPage } from '@/pages/ScoringConfiguration'
import { ConfigurationHistoryPage } from '@/pages/ScoringConfiguration/ConfigurationHistoryPage'
import { AuditLogsPage } from '@/pages/AuditLogs'
import { TagsPage } from '@/pages/Tags/TagsPage'
import { ProfileSettingsPage } from '@/pages/ProfileSettings/ProfileSettingsPage'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <GuestRoute>
        <LoginPage />
      </GuestRoute>
    ),
  },
  {
    path: '/forbidden',
    element: (
      <ProtectedRoute>
        <ForbiddenPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <DashboardLayout>
          <ClientManagementPage />
        </DashboardLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/dashboard/profile',
    element: (
      <ProtectedRoute>
        <DashboardLayout>
          <ProfileSettingsPage />
        </DashboardLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/dashboard/:id',
    element: (
      <ProtectedRoute>
        <DashboardLayout>
          <ClientDetailPage />
        </DashboardLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/dashboard/:id/debt-summary',
    element: (
      <ProtectedRoute>
        <DashboardLayout>
          <DebtSummaryPage />
        </DashboardLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/dashboard/:id/activity',
    element: (
      <ProtectedRoute>
        <DashboardLayout>
          <ActivityTimelinePage />
        </DashboardLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/dashboard/users',
    element: (
      <ProtectedRoute>
        <PermissionRoute requiredPermission={PERMISSIONS.USERS.VIEW}>
          <DashboardLayout>
            <UserManagementPage />
          </DashboardLayout>
        </PermissionRoute>
      </ProtectedRoute>
    ),
  },
  {
    path: '/dashboard/import',
    element: (
      <ProtectedRoute>
        <DashboardLayout>
          <ImportClientsPage />
        </DashboardLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/dashboard/import/history/:id',
    element: (
      <ProtectedRoute>
        <DashboardLayout>
          <ImportDetailsPage />
        </DashboardLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/dashboard/import/history',
    element: (
      <ProtectedRoute>
        <DashboardLayout>
          <ImportHistoryPage />
        </DashboardLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/dashboard/projects',
    element: (
      <ProtectedRoute>
        <PermissionRoute requiredPermission={PERMISSIONS.PROJECTS.MANAGE}>
          <DashboardLayout>
            <ProjectManagementPage />
          </DashboardLayout>
        </PermissionRoute>
      </ProtectedRoute>
    ),
  },
  {
    path: '/dashboard/roles',
    element: (
      <ProtectedRoute>
        <PermissionRoute requiredPermission={PERMISSIONS.SYSTEM.MANAGE_ROLES}>
          <DashboardLayout>
            <RoleManagementPage />
          </DashboardLayout>
        </PermissionRoute>
      </ProtectedRoute>
    ),
  },
  {
    path: '/dashboard/reports',
    element: (
      <ProtectedRoute>
        <PermissionRoute requiredPermission={PERMISSIONS.REPORTS.VIEW_ALL_REPORTS}>
          <DashboardLayout>
            <ReportsDashboardPage />
          </DashboardLayout>
        </PermissionRoute>
      </ProtectedRoute>
    ),
  },
  {
    path: '/dashboard/:id/payment-history',
    element: (
      <ProtectedRoute>
        <DashboardLayout>
          <PaymentHistoryPage />
        </DashboardLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/dashboard/sellers',
    element: (
      <ProtectedRoute>
        <DashboardLayout>
          <SellerManagementPage />
        </DashboardLayout>
      </ProtectedRoute>
    ),
  },
  // System Settings routes
  {
    path: '/dashboard/system-settings/tags',
    element: (
      <ProtectedRoute>
        <DashboardLayout>
          <TagsPage />
        </DashboardLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/dashboard/system-settings/scoring-configuration',
    element: (
      <ProtectedRoute>
        <DashboardLayout>
          <ScoringConfigurationPage />
        </DashboardLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/dashboard/system-settings/scoring-configuration/history',
    element: (
      <ProtectedRoute>
        <DashboardLayout>
          <ConfigurationHistoryPage />
        </DashboardLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/dashboard/system-settings/sms-templates',
    element: (
      <ProtectedRoute>
        <DashboardLayout>
          <SmsTemplatesPage />
        </DashboardLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/dashboard/audit-logs',
    element: (
      <ProtectedRoute>
        <DashboardLayout>
          <AuditLogsPage />
        </DashboardLayout>
      </ProtectedRoute>
    ),
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
