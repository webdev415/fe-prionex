import { createBrowserRouter, Navigate } from 'react-router-dom'
import LoginPage from '@/pages/auth/LoginPage'
import { UserManagementPage } from '@/pages/UserManagement'
import { ImportClientsPage } from '@/pages/ImportClients/ImportClientsPage'
import { ProjectManagementPage } from '@/pages/ProjectManagement/ProjectManagementPage'
import { RoleManagementPage } from '@/pages/RoleManagement/RoleManagementPage'
import { DepartmentManagementPage } from '@/pages/DepartmentManagement'
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
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <PermissionRoute requiredPermission={PERMISSIONS.CLIENTS.VIEW}>
          <DashboardLayout>
            <ClientManagementPage />
          </DashboardLayout>
        </PermissionRoute>
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
        <PermissionRoute requiredPermission={PERMISSIONS.DATA.IMPORT}>
          <DashboardLayout>
            <ImportClientsPage />
          </DashboardLayout>
        </PermissionRoute>
      </ProtectedRoute>
    ),
  },
  {
    path: '/dashboard/import/history/:id',
    element: (
      <ProtectedRoute>
        <PermissionRoute requiredPermission={PERMISSIONS.DATA.IMPORT}>
          <DashboardLayout>
            <ImportDetailsPage />
          </DashboardLayout>
        </PermissionRoute>
      </ProtectedRoute>
    ),
  },
  {
    path: '/dashboard/import/history',
    element: (
      <ProtectedRoute>
        <PermissionRoute requiredPermission={PERMISSIONS.DATA.IMPORT}>
          <DashboardLayout>
            <ImportHistoryPage />
          </DashboardLayout>
        </PermissionRoute>
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
    path: '/dashboard/departments',
    element: (
      <ProtectedRoute>
        <PermissionRoute requiredPermission={PERMISSIONS.SYSTEM.MANAGE_ROLES}>
          <DashboardLayout>
            <DepartmentManagementPage />
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
    path: '/dashboard/sellers',
    element: (
      <ProtectedRoute>
        <PermissionRoute requiredPermission={PERMISSIONS.SELLERS.VIEW}>
          <DashboardLayout>
            <SellerManagementPage />
          </DashboardLayout>
        </PermissionRoute>
      </ProtectedRoute>
    ),
  },
  // System Settings routes
  {
    path: '/dashboard/system-settings/tags',
    element: (
      <ProtectedRoute>
        <PermissionRoute requiredPermission={PERMISSIONS.TAGS.VIEW}>
          <DashboardLayout>
            <TagsPage />
          </DashboardLayout>
        </PermissionRoute>
      </ProtectedRoute>
    ),
  },
  {
    path: '/dashboard/system-settings/scoring-configuration',
    element: (
      <ProtectedRoute>
        <PermissionRoute requiredPermission={PERMISSIONS.SCORING_CONFIG.VIEW}>
          <DashboardLayout>
            <ScoringConfigurationPage />
          </DashboardLayout>
        </PermissionRoute>
      </ProtectedRoute>
    ),
  },
  {
    path: '/dashboard/system-settings/scoring-configuration/history',
    element: (
      <ProtectedRoute>
        <PermissionRoute requiredPermission={PERMISSIONS.SCORING_CONFIG.VIEW_HISTORY}>
          <DashboardLayout>
            <ConfigurationHistoryPage />
          </DashboardLayout>
        </PermissionRoute>
      </ProtectedRoute>
    ),
  },
  {
    path: '/dashboard/system-settings/sms-templates',
    element: (
      <ProtectedRoute>
        <PermissionRoute requiredPermission={PERMISSIONS.SYSTEM.MANAGE_SETTINGS}>
          <DashboardLayout>
            <SmsTemplatesPage />
          </DashboardLayout>
        </PermissionRoute>
      </ProtectedRoute>
    ),
  },
  {
    path: '/dashboard/audit-logs',
    element: (
      <ProtectedRoute>
        <PermissionRoute requiredPermission={PERMISSIONS.SYSTEM.VIEW_AUDIT_LOGS}>
          <DashboardLayout>
            <AuditLogsPage />
          </DashboardLayout>
        </PermissionRoute>
      </ProtectedRoute>
    ),
  },
  // Client detail routes - must come after all specific routes
  {
    path: '/dashboard/clients/:id',
    element: (
      <ProtectedRoute>
        <PermissionRoute requiredPermission={PERMISSIONS.CLIENTS.VIEW}>
          <DashboardLayout>
            <ClientDetailPage />
          </DashboardLayout>
        </PermissionRoute>
      </ProtectedRoute>
    ),
  },
  {
    path: '/dashboard/clients/:id/debt-summary',
    element: (
      <ProtectedRoute>
        <PermissionRoute requiredPermission={PERMISSIONS.CLIENTS.VIEW}>
          <DashboardLayout>
            <DebtSummaryPage />
          </DashboardLayout>
        </PermissionRoute>
      </ProtectedRoute>
    ),
  },
  {
    path: '/dashboard/clients/:id/activity',
    element: (
      <ProtectedRoute>
        <PermissionRoute requiredPermission={PERMISSIONS.CLIENTS.VIEW}>
          <DashboardLayout>
            <ActivityTimelinePage />
          </DashboardLayout>
        </PermissionRoute>
      </ProtectedRoute>
    ),
  },
  {
    path: '/dashboard/clients/:id/payment-history',
    element: (
      <ProtectedRoute>
        <PermissionRoute requiredPermission={PERMISSIONS.CLIENTS.VIEW}>
          <DashboardLayout>
            <PaymentHistoryPage />
          </DashboardLayout>
        </PermissionRoute>
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
