/**
 * TaskBell
 *
 * Bell icon in the header showing a badge with the count of past/overdue tasks
 * assigned to the current user.
 *
 * - Inactive (grey) when no tasks
 * - Active (with badge) when tasks exist
 * - Shakes when new tasks arrive
 * - Click opens a dropdown list with: description/comment, link to client, date/time
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Icons } from '@/lib/icons'
import { useMyTasks } from '@/features/clients/hooks/useClients'
import { taskApi } from '@/features/clients/api/taskApi'
import { cn } from '@/lib/utils'

function formatDateTime(isoDate: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(isoDate))
  } catch {
    return isoDate
  }
}

export function TaskBell() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: tasks = [] } = useMyTasks()
  const count = tasks.length

  const [isOpen, setIsOpen] = useState(false)
  const [isShaking, setIsShaking] = useState(false)
  const prevCountRef = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Shake when new tasks arrive
  useEffect(() => {
    const prev = prevCountRef.current
    prevCountRef.current = count
    if (count > prev && prev !== 0) {
      const t = setTimeout(() => {
        setIsShaking(true)
        setTimeout(() => setIsShaking(false), 900)
      }, 0)
      return () => clearTimeout(t)
    }
  }, [count])

  // Close dropdown on outside click
  const handleOutsideClick = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setIsOpen(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
    } else {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [isOpen, handleOutsideClick])

  const hasTask = count > 0

  return (
    <div ref={containerRef} className="relative">
      {/* Bell button */}
      <button
        type="button"
        aria-label={`Task notifications${hasTask ? ` (${count})` : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-gray-100 focus:outline-none"
      >
        <Icons.Bell
          size={20}
          strokeWidth={1.5}
          className={cn(
            'transition-colors',
            hasTask ? 'text-dark-500' : 'text-gray-300',
            isShaking && 'animate-bell-shake'
          )}
        />
        {hasTask && (
          <span className="absolute top-0.5 right-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] leading-none font-bold text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <span className="text-dark-500 text-sm font-semibold">Past Tasks</span>
            {hasTask && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                {count}
              </span>
            )}
          </div>

          {/* Task list */}
          <div className="max-h-80 overflow-y-auto">
            {count === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-gray-300">
                <Icons.Bell size={28} strokeWidth={1.5} />
                <p className="text-xs text-gray-400">No past tasks</p>
              </div>
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id}
                  className="group relative flex border-b border-gray-100 transition-colors last:border-b-0 hover:bg-gray-50"
                >
                  {/* Clickable area → navigate to client */}
                  <button
                    type="button"
                    disabled={!task.client_id}
                    onClick={() => {
                      if (task.client_id) {
                        navigate(`/dashboard/clients/${task.client_id}`)
                        setIsOpen(false)
                      }
                    }}
                    className="flex min-w-0 flex-1 flex-col gap-1.5 px-4 py-3 text-left disabled:cursor-default"
                  >
                    {/* Client name + ID + Priority + Status on same line */}
                    <div className="flex flex-wrap items-center gap-1.5 pr-5">
                      <p className="line-clamp-1 text-xs font-semibold text-gray-800">
                        {task.client_name ?? `Client #${task.client_id}`}
                        {task.client_id && (
                          <span className="ml-1 font-normal text-gray-400">
                            (ID: {task.client_id})
                          </span>
                        )}
                        {task.debt_id && (
                          <span className="ml-1 font-normal text-gray-400">
                            / Debt: {task.debt_id}
                          </span>
                        )}
                      </p>
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[10px] font-medium capitalize',
                          task.priority === 'high' && 'bg-red-100 text-red-600',
                          task.priority === 'normal' && 'bg-blue-100 text-blue-600',
                          task.priority === 'low' && 'bg-gray-100 text-gray-500'
                        )}
                      >
                        {task.priority}
                      </span>
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[10px] font-medium capitalize',
                          task.status === 'pending' && 'bg-yellow-100 text-yellow-600',
                          task.status === 'in_progress' && 'bg-blue-100 text-blue-600',
                          task.status === 'completed' && 'bg-green-100 text-green-600',
                          task.status === 'extended' && 'bg-purple-100 text-purple-600',
                          task.status === 'rejected' && 'bg-red-100 text-red-600',
                          task.status === 'incoming_line_result' && 'bg-orange-100 text-orange-600'
                        )}
                      >
                        {task.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    {/* Description with ellipsis if long */}
                    {(task.description || task.title) && (
                      <p className="w-full min-w-0 truncate text-xs text-gray-500">
                        {task.description || task.title}
                      </p>
                    )}

                    {/* Bottom row: due date */}
                    <div className="flex items-center gap-1 text-gray-400">
                      <Icons.Clock01 size={11} strokeWidth={1.5} />
                      <span className="text-[11px]">
                        {task.due_date ? formatDateTime(task.due_date) : '—'}
                      </span>
                    </div>
                  </button>

                  {/* Dismiss (X) button */}
                  <button
                    type="button"
                    aria-label="Dismiss task"
                    onClick={async (e) => {
                      e.stopPropagation()
                      await taskApi.dismissTask(task.id)
                      queryClient.invalidateQueries({ queryKey: ['tasks', 'my-tasks'] })
                    }}
                    className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-gray-600"
                  >
                    <Icons.Cancel01 size={12} strokeWidth={2} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
