/**
 * ProjectSelector Component
 *
 * Dropdown component that allows users to view and switch
 * between their assigned projects (shown when user has >= 1 project).
 * Uses the same style as LanguageSwitcher for consistency.
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth'
import { authApi } from '@/features/auth/api/authApi'
import { useAuthStore } from '@/stores/authStore'
import { setAccessToken } from '@/lib/api'
import type { User } from '@/types/api'
import { Icons } from '@/lib/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { cn } from '@/lib/utils'

export function ProjectSelector() {
  const { t } = useTranslation('common')
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [isSwitchingProject, setIsSwitchingProject] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  // Get user's assigned projects
  const userProjects = user?.projects || []
  const hasProjects = userProjects.length >= 1
  const currentProject = userProjects.find((p) => p.id === user?.active_project_id)

  // Close dropdown on window resize to prevent positioning issues
  useEffect(() => {
    const handleResize = () => {
      if (isOpen) {
        setIsOpen(false)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isOpen])

  // Don't render if user has no projects or no current project
  if (!hasProjects || !currentProject) {
    return null
  }

  const handleSwitchProject = async (projectId: string) => {
    if (projectId === user?.active_project_id || isSwitchingProject) {
      return
    }

    setIsSwitchingProject(true)
    try {
      // Convert projectId to number for API
      const projectIdNum = parseInt(projectId, 10)
      if (isNaN(projectIdNum)) {
        throw new Error('Invalid project ID')
      }

      const response = await authApi.switchProject(projectIdNum)
      const { access_token, active_project } = response.data

      // Update token
      setAccessToken(access_token)

      // Fetch updated user data directly (bypassing checkAuth guard)
      try {
        const userResponse = await authApi.me()
        const backendUser = userResponse.data

        // Map backend user data to frontend User type
        const updatedUser: User = {
          id: String(backendUser.id),
          username: backendUser.username,
          email: backendUser.email,
          firstName: backendUser.first_name,
          lastName: backendUser.last_name,
          projects:
            backendUser.projects?.map((p) => ({
              id: String(p.id),
              name: p.name,
              roles: [{ id: String(p.id), name: p.role_name }],
            })) || [],
          active_project_id: backendUser.active_project
            ? String(backendUser.active_project.id)
            : null,
          active_role_id: backendUser.role ? String(backendUser.role.id) : null,
          active_role_name: backendUser.role?.name || null,
          active_department_id: backendUser.active_department_id ?? null,
          permissions: backendUser.permissions || [],
          createdAt: backendUser.created_at,
          updatedAt: backendUser.created_at,
          timezone: backendUser.timezone,
        }

        // Update store state directly
        useAuthStore.setState({ user: updatedUser, hasCheckedAuth: true })

        // Clear all React Query cache so data re-fetches with new project context
        queryClient.removeQueries()
      } catch {
        // Still clear cache even if user fetch failed — token was already updated
        queryClient.removeQueries()
      }

      toast.success(
        t('pages.users.messages.projectSwitched', {
          projectName: active_project.project_name || 'Project',
        })
      )
    } catch (error: unknown) {
      console.error('Failed to switch project:', error)
      const err = error as {
        response?: { data?: { error?: { message?: string } } }
        message?: string
      }
      const errorMessage =
        err.response?.data?.error?.message ||
        err.message ||
        t('pages.users.messages.failedToSwitchProject')
      toast.error(errorMessage)
    } finally {
      setIsSwitchingProject(false)
    }
  }

  return (
    <DropdownMenu modal={false} open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'text-secondary-800 inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-0 text-lg font-medium hover:opacity-90',
            isSwitchingProject && 'cursor-not-allowed opacity-50'
          )}
          disabled={isSwitchingProject}
        >
          <span className={cn('max-w-[220px] truncate text-center')}>{currentProject.name}</span>
          <Icons.ArrowDown size={18} strokeWidth={1.5} className={'text-secondary-800'} />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align={'center'} className={cn('w-56')}>
        {userProjects.map((project) => {
          const isActive = project.id === user?.active_project_id
          const projectRole = project.roles?.[0]

          return (
            <DropdownMenuItem
              key={project.id}
              onClick={() => handleSwitchProject(project.id)}
              disabled={isSwitchingProject || isActive}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors',
                isActive ? 'text-primary-600 font-medium' : 'text-gray-700'
              )}
            >
              <span className="flex-1 truncate">{project.name}</span>
              {projectRole && <span className="text-xs text-gray-500">({projectRole.name})</span>}
              {isActive && (
                <Icons.Checkmark size={16} strokeWidth={2} className="text-dark-500 ml-auto" />
              )}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
