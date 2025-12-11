/**
 * ProjectSwitcher Component
 *
 * Dropdown component that allows users with multiple projects
 * to switch between their assigned projects.
 * Built with Radix UI Select for consistency.
 */

import * as SelectPrimitive from '@radix-ui/react-select'
import { Icons } from '@/lib/icons'
import type { User } from '@/types/api'
import { cn } from '@/lib/utils'

export interface ProjectSwitcherProps {
  user: User
  onSwitchProject: (projectId: string) => void
  isLoading: boolean
}

export function ProjectSwitcher({ user, onSwitchProject, isLoading }: ProjectSwitcherProps) {
  // Don't render if user has only one project
  if (!user.projects || user.projects.length <= 1) {
    return null
  }

  const currentProject = user.projects.find((p) => p.id === user.active_project_id)

  const handleChange = (projectId: string) => {
    // Don't switch if selecting current project
    if (projectId === user.active_project_id) {
      return
    }

    onSwitchProject(projectId)
  }

  return (
    <SelectPrimitive.Root
      value={user.active_project_id || ''}
      onValueChange={handleChange}
      disabled={isLoading}
    >
      <SelectPrimitive.Trigger
        className={cn(
          'relative w-full cursor-pointer rounded-lg bg-white py-2 pr-10 pl-3 text-left shadow-md',
          'focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'sm:text-sm'
        )}
        aria-label="Switch project"
      >
        <SelectPrimitive.Value>
          <span className="flex items-center gap-2">
            <span className="block truncate font-medium">{currentProject?.name}</span>
            <span className="inline-flex items-center rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-medium text-teal-800">
              Active
            </span>
            {user.active_role_name && (
              <span className="text-xs text-gray-500">({user.active_role_name})</span>
            )}
            {isLoading && (
              <svg
                data-testid="loading-spinner"
                className="h-4 w-4 animate-spin text-gray-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
          </span>
        </SelectPrimitive.Value>
        <SelectPrimitive.Icon className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
          <Icons.ArrowDown size={20} color="#9CA3AF" strokeWidth={1.5} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className={cn(
            'relative z-50 max-h-60 min-w-[8rem] overflow-hidden rounded-md bg-white py-1 shadow-lg',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
            'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2'
          )}
          position="popper"
        >
          <SelectPrimitive.Viewport className="p-1">
            {user.projects.map((project) => {
              const isCurrent = project.id === user.active_project_id
              const primaryRole = project.roles?.[0]

              return (
                <SelectPrimitive.Item
                  key={project.id}
                  value={project.id}
                  className={cn(
                    'relative flex cursor-pointer items-center rounded-sm py-2 pr-4 pl-10 outline-none select-none',
                    'focus:bg-teal-100 focus:text-teal-900',
                    'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                    isCurrent && 'bg-teal-50 font-medium'
                  )}
                >
                  <SelectPrimitive.ItemText>
                    <div className="flex items-center justify-between">
                      <span
                        className={cn('block truncate', isCurrent ? 'font-medium' : 'font-normal')}
                      >
                        {project.name}
                      </span>
                      {primaryRole && (
                        <span className="ml-2 text-xs text-gray-500">{primaryRole.name}</span>
                      )}
                    </div>
                  </SelectPrimitive.ItemText>
                  {isCurrent && (
                    <SelectPrimitive.ItemIndicator className="absolute left-0 flex w-[25px] items-center justify-center">
                      <Icons.Checkmark size={20} color="#0369A1" strokeWidth={2} />
                    </SelectPrimitive.ItemIndicator>
                  )}
                </SelectPrimitive.Item>
              )
            })}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
