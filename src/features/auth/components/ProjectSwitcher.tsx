/**
 * ProjectSwitcher Component
 *
 * Dropdown component that allows users with multiple projects
 * to switch between their assigned projects.
 */

import { Fragment } from 'react'
import { Listbox, Transition } from '@headlessui/react'
import type { User } from '@/types/api'

// Icons as inline SVG components
const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
      clipRule="evenodd"
    />
  </svg>
)

const CheckIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
      clipRule="evenodd"
    />
  </svg>
)

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
    <Listbox value={user.active_project_id || ''} onChange={handleChange} disabled={isLoading}>
      {({ open }) => (
        <div className="relative">
          <Listbox.Button
            className="focus-visible:ring-opacity-75 relative w-full cursor-pointer rounded-lg bg-white py-2 pr-10 pl-3 text-left shadow-md focus:outline-none focus-visible:border-teal-500 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-teal-300 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
            aria-haspopup="listbox"
            aria-expanded={open}
          >
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
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </span>
          </Listbox.Button>

          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options className="ring-opacity-5 absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black focus:outline-none sm:text-sm">
              {user.projects.map((project) => {
                const isCurrent = project.id === user.active_project_id
                const primaryRole = project.roles[0]

                return (
                  <Listbox.Option
                    key={project.id}
                    value={project.id}
                    role="option"
                    data-current={isCurrent}
                    className={({ active }) =>
                      `relative cursor-pointer py-2 pr-4 pl-10 select-none ${
                        active ? 'bg-teal-100 text-teal-900' : 'text-gray-900'
                      } ${isCurrent ? 'bg-teal-50 font-medium' : ''}`
                    }
                  >
                    {({ selected }) => (
                      <>
                        <div className="flex items-center justify-between">
                          <span
                            className={`block truncate ${selected || isCurrent ? 'font-medium' : 'font-normal'}`}
                          >
                            {project.name}
                          </span>
                          {primaryRole && (
                            <span className="ml-2 text-xs text-gray-500">{primaryRole.name}</span>
                          )}
                        </div>
                        {(selected || isCurrent) && (
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-teal-600">
                            <CheckIcon className="h-5 w-5" aria-hidden="true" />
                          </span>
                        )}
                      </>
                    )}
                  </Listbox.Option>
                )
              })}
            </Listbox.Options>
          </Transition>
        </div>
      )}
    </Listbox>
  )
}
