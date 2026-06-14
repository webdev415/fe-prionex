import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'

const MOCK_DEPARTMENT = 'Department A · Hard Collection'
const MOCK_OPERATORS_COUNT = 7

const TOGGLE_SIZE_CLASS = 'h-10 w-10'

interface LawyerWorkspaceBannerProps {
  className?: string
}

export function LawyerWorkspaceBanner({ className }: LawyerWorkspaceBannerProps) {
  const { t, i18n } = useTranslation('common')
  const user = useAuthStore((s) => s.user)
  const [isExpanded, setIsExpanded] = useState(true)

  const regionCode = i18n.language?.startsWith('uk') ? 'UA' : 'EN'
  const workspaceTitle = t('pages.lawyerWorkplace.workspaceBanner.title', "Lawyers's Workspace")
  const departmentName = user?.active_department_name ?? MOCK_DEPARTMENT

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-6 z-30 flex justify-center p-7',
        className
      )}
    >
      <div className="flex w-full max-w-[1120px] justify-end">
        <div
          className={cn(
            'pointer-events-auto flex h-14 items-center overflow-hidden rounded-md border border-gray-100/90 bg-white/95 py-1 pr-1.5 shadow-[0_12px_24px_-6px_rgba(16,24,40,0.12),0_4px_8px_-2px_rgba(16,24,40,0.06)] backdrop-blur-sm',
            isExpanded ? 'w-full pl-3' : 'w-auto pl-1.5'
          )}
        >
          {isExpanded && (
            <div className="flex min-w-0 flex-1 items-center gap-4 overflow-hidden whitespace-nowrap">
              <div className="flex items-center gap-2">
                <span className="bg-secondary-800/10 text-secondary-800 shrink-0 rounded-full px-3 py-1 text-[12px] font-medium">
                  {t('pages.lawyerWorkplace.workspaceBanner.lawBadge', 'Law')}
                </span>
                <Icons.UserCircle02Icon
                  size={20}
                  strokeWidth={1.5}
                  className="text-secondary-800"
                />
                <span className="text-secondary-800 text-[16px] font-medium">
                  {workspaceTitle} · {regionCode}
                </span>
              </div>
              <p className="text-dark-500 hidden shrink-0 text-[14px] leading-none sm:block">
                {t('pages.lawyerWorkplace.workspaceBanner.assignedToDepartment', {
                  department: departmentName,
                  defaultValue: `You are assigned to the department '${departmentName}'.`,
                })}
              </p>

              <div className="hidden shrink-0 items-center gap-2 sm:flex">
                <span className="bg-light-100 flex h-5 w-5 shrink-0 items-center justify-center rounded-full px-[6px] text-[12px] text-gray-800">
                  {MOCK_OPERATORS_COUNT}
                </span>
                <span className="text-dark-500 truncate text-[14px]">
                  {t(
                    'pages.lawyerWorkplace.workspaceBanner.operatorsInOperation',
                    'operators in operation'
                  )}
                </span>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded((open) => !open)}
            className={cn(
              'bg-primary-300 text-dark-500 flex cursor-pointer items-center justify-center rounded-lg',
              TOGGLE_SIZE_CLASS
            )}
            aria-expanded={isExpanded}
            aria-label={
              isExpanded
                ? t('pages.lawyerWorkplace.workspaceBanner.collapse', 'Minimize workspace banner')
                : t('pages.lawyerWorkplace.workspaceBanner.expand', 'Expand workspace banner')
            }
          >
            {isExpanded ? (
              <Icons.MenuCollapse size={20} strokeWidth={2} />
            ) : (
              <Icons.UserCircle02Icon size={20} strokeWidth={1.5} />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
