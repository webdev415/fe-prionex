/**
 * Sidebar Component
 *
 * Reusable sidebar component with navigation icons, tooltips, and active states.
 * Features:
 * - Menu icon at top
 * - Navigation items with tooltips
 * - Active state styling
 * - Bottom action buttons
 */

import { NavLink, useLocation } from 'react-router-dom'
import { Icons } from '@/lib/icons'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip'
import { cn } from '@/lib/utils'

export interface SidebarItem {
  path: string
  icon: string
  label: string
  disabled?: boolean
}

export interface SidebarAction {
  icon: string
  label: string
  onClick: () => void
}

export interface SidebarProps {
  /** Navigation items to display */
  items: SidebarItem[]
  /** Action buttons at the bottom */
  actions?: SidebarAction[]
  /** Menu button click handler */
  onMenuClick?: () => void
  /** Custom className for the sidebar */
  className?: string
}

/**
 * Icon component map for sidebar icons
 */
const iconMap: Record<
  string,
  (props: { size: number; color: string; strokeWidth: number }) => React.ReactElement
> = {
  'home-04': (props) => <Icons.Home04 {...props} />,
  'activity-01': (props) => <Icons.Activity01 {...props} />,
  'file-import': (props) => <Icons.FileImport {...props} />,
  'chart-ring': (props) => <Icons.ChartRing {...props} />,
  'analytics-01': (props) => <Icons.Analytics01 {...props} />,
  community: (props) => <Icons.Community {...props} />,
  'user-status': (props) => <Icons.UserStatus {...props} />,
  'transaction-history': (props) => <Icons.TransactionHistory {...props} />,
  'setting-07': (props) => <Icons.Setting07 {...props} />,
  'logout-square-01': (props) => <Icons.LogoutSquare01 {...props} />,
}

/**
 * Sidebar Component
 */
export function Sidebar({ items, actions = [], onMenuClick, className }: SidebarProps) {
  const location = useLocation()

  /**
   * Check if a path is active
   */
  const isActivePath = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard'
    }
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  return (
    <TooltipProvider delayDuration={300}>
      <aside
        className={cn(
          'fixed top-0 left-0 z-30 flex h-screen w-16 flex-col items-center overflow-hidden bg-white py-6',
          'shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_21px_2px_0px_rgba(0,0,0,0.06)]',
          className
        )}
      >
        {/* Menu icon at top - 22px, color gray-700 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onMenuClick}
              className="focus:ring-primary-500 mb-8 rounded-md p-1 transition-all duration-200 hover:scale-110 focus:ring-2 focus:ring-offset-2 focus:outline-none"
              aria-label="Menu"
            >
              <Icons.Menu11 size={22} color="#374151" strokeWidth={1.5} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Menu</p>
          </TooltipContent>
        </Tooltip>

        {/* Navigation Icons */}
        <nav className="flex w-full flex-1 flex-col items-center gap-6 overflow-x-hidden overflow-y-auto px-0">
          {items.map((item, index) => {
            const IconComponent = iconMap[item.icon]

            if (!IconComponent) {
              console.warn(`Icon "${item.icon}" not found in iconMap`)
              return null
            }

            const isActive = !item.disabled && isActivePath(item.path)
            const isDisabled = item.disabled
            // Use unique key combining path and label to avoid duplicates
            const uniqueKey = `${item.path}-${item.label}-${index}`

            if (isDisabled) {
              return (
                <div
                  key={uniqueKey}
                  className="mx-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-md opacity-50"
                  aria-label={item.label}
                >
                  <IconComponent size={20} color="#9CA3AF" strokeWidth={1.5} />
                </div>
              )
            }

            return (
              <Tooltip key={uniqueKey}>
                <TooltipTrigger asChild>
                  <NavLink
                    to={item.path}
                    end={item.path === '/dashboard'}
                    className={cn(
                      'focus:ring-primary-500 mx-auto flex shrink-0 items-center justify-center transition-all duration-200 focus:ring-2 focus:ring-offset-2 focus:outline-none',
                      isActive
                        ? 'bg-secondary-800 h-10 w-11 rounded-lg'
                        : 'h-10 w-10 rounded-md hover:bg-gray-50'
                    )}
                    aria-label={item.label}
                  >
                    <IconComponent
                      size={20}
                      color={isActive ? '#0CA8EB' : '#374151'}
                      strokeWidth={1.5}
                    />
                  </NavLink>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{item.label}</p>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </nav>

        {/* Bottom action buttons */}
        {actions.length > 0 && (
          <div className="flex flex-col items-center gap-6 pt-6">
            {actions.map((action, index) => {
              const ActionIcon = iconMap[action.icon]

              if (!ActionIcon) {
                console.warn(`Icon "${action.icon}" not found in iconMap`)
                return null
              }

              return (
                <Tooltip key={index}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={action.onClick}
                      className="focus:ring-primary-500 flex items-center justify-center rounded-md p-1 transition-all duration-200 hover:scale-110 focus:ring-2 focus:ring-offset-2 focus:outline-none"
                      aria-label={action.label}
                    >
                      <ActionIcon size={20} color="#374151" strokeWidth={1.5} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{action.label}</p>
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        )}
      </aside>
    </TooltipProvider>
  )
}

export default Sidebar
