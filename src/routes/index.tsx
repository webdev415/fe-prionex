/* eslint-disable react-refresh/only-export-components */
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

function DashboardContent() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-gray-900">Dashboard</h1>
      <div className="rounded-lg bg-white p-6 shadow">
        <p className="text-gray-600">Welcome to Prionex CRM. Dashboard content coming soon...</p>
      </div>
    </div>
  )
}

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
          <DashboardContent />
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
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
])
