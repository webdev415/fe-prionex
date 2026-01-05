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
import { useSidebarStore } from '@/stores/sidebarStore'

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
  /** Custom className for the sidebar */
  className?: string
}

/**
 * Icon component map for sidebar icons
 */
const iconMap: Record<
  string,
  (props: { size: number; className: string; strokeWidth: number }) => React.ReactElement
> = {
  'home-04': (props) => <Icons.Home04 {...props} />,
  'activity-01': (props) => <Icons.Activity01 {...props} />,
  'file-import': (props) => <Icons.FileImport {...props} />,
  brochure: (props) => <Icons.Brochure {...props} />,
  'chart-ring': (props) => <Icons.ChartRing {...props} />,
  'analytics-01': (props) => <Icons.Analytics01 {...props} />,
  'user-search-01': (props) => <Icons.UserSearch01 {...props} />,
  'user-circle-02': (props) => <Icons.UserCircle02Icon {...props} />,
  'user-multiple': (props) => <Icons.UserMultiple {...props} />,
  'transaction-history': (props) => <Icons.TransactionHistory {...props} />,
  'setting-07': (props) => <Icons.Setting07 {...props} />,
  'logout-square-01': (props) => <Icons.LogoutSquare01 {...props} />,
  'checkmark-badge-02': (props) => <Icons.CheckmarkBadge02 {...props} />,
  mail: (props) => <Icons.Mail {...props} />,
}

/**
 * Sidebar Component
 */
export function Sidebar({ items, actions = [], className }: SidebarProps) {
  const location = useLocation()
  const { isOpenSideBar, isHoverOpen, toggleSidebar, setHoverOpen } = useSidebarStore()

  // Determine if sidebar should be visible (either opened or hover-opened)
  const isSidebarVisible = isOpenSideBar || isHoverOpen

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
          'fixed top-0 left-0 z-30 flex h-screen flex-col overflow-hidden py-6 transition-all duration-300',
          'shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_21px_2px_0px_rgba(0,0,0,0.06)]',
          isSidebarVisible ? 'w-64 items-start bg-white px-4' : 'w-16 items-center bg-white',
          className
        )}
        onMouseEnter={() => {
          // If hovering over sidebar and it was opened by hover, keep it open
          if (isHoverOpen) {
            setHoverOpen(true)
          }
        }}
        onMouseLeave={() => {
          // Close sidebar if it was only opened by hover
          if (isHoverOpen && !isOpenSideBar) {
            setHoverOpen(false)
          }
        }}
      >
        {/* Menu/Close icon at top */}
        {isOpenSideBar ? (
          <button
            onClick={toggleSidebar}
            className="focus:ring-primary-500 mb-4 cursor-pointer rounded-md p-1 transition-all duration-200 hover:bg-gray-50 focus:ring-2 focus:ring-offset-2 focus:outline-none"
            aria-label="Close"
          >
            <Icons.Close size={22} className="text-secondary-800" strokeWidth={1.5} />
          </button>
        ) : (
          <button
            onClick={toggleSidebar}
            className="focus:ring-primary-500 mb-4 cursor-pointer rounded-md p-1 transition-all duration-200 hover:scale-110 focus:ring-2 focus:ring-offset-2 focus:outline-none"
            aria-label="Menu"
          >
            <Icons.Menu11 size={22} className="text-gray-700" strokeWidth={1.5} />
          </button>
        )}

        {/* Navigation Icons */}
        <nav
          className={cn(
            'flex w-full flex-1 flex-col gap-6 overflow-x-hidden overflow-y-auto py-4',
            isSidebarVisible ? 'items-stretch px-0' : 'items-center px-0'
          )}
        >
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
                  className={cn(
                    'flex shrink-0 items-center rounded-md opacity-50',
                    isSidebarVisible ? 'mx-1 h-10 w-[95%] px-3' : 'mx-auto h-10 w-10 justify-center'
                  )}
                  aria-label={item.label}
                  onMouseEnter={() => {
                    // Open sidebar on hover if it's closed
                    if (!isOpenSideBar) {
                      setHoverOpen(true)
                    }
                  }}
                >
                  <IconComponent size={20} className="text-gray-400" strokeWidth={1.5} />
                  {isSidebarVisible && (
                    <span className="ml-3 text-sm text-gray-400">{item.label}</span>
                  )}
                </div>
              )
            }

            const navLinkContent = (
              <NavLink
                to={item.path}
                end={item.path === '/dashboard'}
                className={cn(
                  'focus:ring-primary-500 flex shrink-0 items-center transition-all duration-200 focus:ring-2 focus:ring-offset-2 focus:outline-none',
                  isSidebarVisible
                    ? cn(
                        'mx-1 h-10 w-[95%] rounded-lg px-3',
                        isActive ? 'bg-secondary-800' : 'hover:bg-gray-50'
                      )
                    : cn(
                        'mx-auto h-10 w-10 justify-center rounded-md',
                        isActive ? 'bg-secondary-800 rounded-lg' : 'hover:bg-gray-50'
                      )
                )}
                aria-label={item.label}
                onMouseEnter={() => {
                  // Open sidebar on hover if it's closed
                  if (!isOpenSideBar) {
                    setHoverOpen(true)
                  }
                }}
              >
                <IconComponent
                  size={20}
                  className={cn(isActive ? 'text-primary-300' : 'text-gray-700')}
                  strokeWidth={1.5}
                />
                {isSidebarVisible && (
                  <span
                    className={cn(
                      'ml-3 text-sm font-medium',
                      isActive ? 'text-primary-300' : 'text-gray-700'
                    )}
                  >
                    {item.label}
                  </span>
                )}
              </NavLink>
            )

            if (isSidebarVisible) {
              return (
                <div key={uniqueKey} className="w-full">
                  {navLinkContent}
                </div>
              )
            }

            return (
              <Tooltip key={uniqueKey}>
                <TooltipTrigger asChild>{navLinkContent}</TooltipTrigger>
                <TooltipContent side="right">
                  <p>{item.label}</p>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </nav>

        {/* Bottom action buttons */}
        {actions.length > 0 && (
          <div
            className={cn(
              'flex flex-col gap-6 pt-6',
              isOpenSideBar ? 'w-full items-stretch' : 'items-center'
            )}
          >
            {actions.map((action, index) => {
              const ActionIcon = iconMap[action.icon]

              if (!ActionIcon) {
                console.warn(`Icon "${action.icon}" not found in iconMap`)
                return null
              }

              const buttonContent = (
                <button
                  onClick={action.onClick}
                  className={cn(
                    'focus:ring-primary-500 flex items-center rounded-md transition-all duration-200 focus:ring-2 focus:ring-offset-2 focus:outline-none',
                    isSidebarVisible
                      ? 'mx-1 h-10 w-[95%] px-3 hover:bg-gray-50'
                      : 'justify-center p-1 hover:scale-110'
                  )}
                  aria-label={action.label}
                  onMouseEnter={() => {
                    // Open sidebar on hover if it's closed
                    if (!isOpenSideBar) {
                      setHoverOpen(true)
                    }
                  }}
                >
                  <ActionIcon size={20} className="text-gray-700" strokeWidth={1.5} />
                  {isSidebarVisible && (
                    <span className="ml-3 text-sm font-medium text-gray-700">{action.label}</span>
                  )}
                </button>
              )

              if (isSidebarVisible) {
                return <div key={index}>{buttonContent}</div>
              }

              return (
                <Tooltip key={index}>
                  <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
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
