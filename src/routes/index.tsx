import { createBrowserRouter, Navigate } from 'react-router-dom'
import LoginPage from '@/pages/auth/LoginPage'
import { UserManagementPage } from '@/pages/UserManagement'
import { ProjectManagementPage } from '@/pages/ProjectManagement/ProjectManagementPage'
import { RoleManagementPage } from '@/pages/RoleManagement/RoleManagementPage'
import { ProtectedRoute } from './ProtectedRoute'
import { GuestRoute } from './GuestRoute'
import { DashboardLayout } from '@/components/layout'

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
    path: '/users',
    element: (
      <ProtectedRoute>
        <DashboardLayout>
          <UserManagementPage />
        </DashboardLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/projects',
    element: (
      <ProtectedRoute>
        <DashboardLayout>
          <ProjectManagementPage />
        </DashboardLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/roles',
    element: (
      <ProtectedRoute>
        <DashboardLayout>
          <RoleManagementPage />
        </DashboardLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
])
