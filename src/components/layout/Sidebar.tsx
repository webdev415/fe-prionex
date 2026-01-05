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
    <aside
      className={cn(
        'fixed top-0 left-0 z-30 flex h-screen flex-col overflow-hidden py-6 transition-all duration-300',
        'shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_21px_2px_0px_rgba(0,0,0,0.06)]',
        isSidebarVisible ? 'w-60' : 'w-18',
        'items-start px-4 pl-3',
        isHoverOpen && !isOpenSideBar ? 'bg-white/10 backdrop-blur-sm' : 'bg-white',
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
      {/* Navigation Icons */}
      <nav
        className={cn(
          'flex w-full flex-1 flex-col gap-6 overflow-x-hidden overflow-y-auto',
          'items-stretch px-0'
        )}
      >
        {/* Menu button */}
        <button
          onClick={toggleSidebar}
          className={cn(
            'flex h-10 shrink-0 cursor-pointer items-center rounded-lg transition-all duration-200 focus:outline-none',
            isSidebarVisible ? 'px-3' : 'justify-start px-3',
            isHoverOpen && !isOpenSideBar ? 'hover:bg-white/80' : 'hover:bg-gray-50'
          )}
          aria-label="Menu"
        >
          <Icons.Menu11 size={20} className="shrink-0 text-gray-700" strokeWidth={1.5} />
          {isSidebarVisible && (
            <img
              src="/logo.svg"
              alt="Prionex"
              className="ml-3 h-7 w-auto transition-all duration-300"
            />
          )}
        </button>
        <div className="mx-2 h-px bg-gray-200" />
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
                  'flex h-10 shrink-0 items-center rounded-md opacity-50',
                  isSidebarVisible ? 'px-3' : 'justify-start px-3'
                )}
                aria-label={item.label}
                onMouseEnter={() => {
                  // Open sidebar on hover if it's closed
                  if (!isOpenSideBar) {
                    setHoverOpen(true)
                  }
                }}
              >
                <IconComponent size={20} className="shrink-0 text-gray-400" strokeWidth={1.5} />
                <span className="ml-3 text-sm text-gray-400">{item.label}</span>
              </div>
            )
          }

          const navLinkContent = (
            <NavLink
              to={item.path}
              end={item.path === '/dashboard'}
              className={cn(
                'flex h-10 shrink-0 items-center rounded-lg transition-all duration-200 focus:outline-none',
                isSidebarVisible ? 'px-3' : 'justify-start px-3',
                isActive
                  ? 'bg-secondary-800'
                  : isHoverOpen && !isOpenSideBar
                    ? 'hover:bg-white/80'
                    : 'hover:bg-gray-50'
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
                className={cn('shrink-0', isActive ? 'text-primary-300' : 'text-gray-700')}
                strokeWidth={1.5}
              />
              <span
                className={cn(
                  'ml-3 text-sm font-medium text-nowrap',
                  isActive ? 'text-white' : 'text-dark-500'
                )}
              >
                {item.label}
              </span>
            </NavLink>
          )

          return (
            <div key={uniqueKey} className="w-full">
              {navLinkContent}
            </div>
          )
        })}
      </nav>

      {/* Bottom action buttons */}
      {actions.length > 0 && (
        <div className="flex w-full flex-col items-stretch gap-6 pt-6">
          {actions.map((action, index) => {
            const ActionIcon = iconMap[action.icon]

            if (!ActionIcon) {
              console.warn(`Icon "${action.icon}" not found in iconMap`)
              return null
            }

            return (
              <button
                key={index}
                onClick={action.onClick}
                className={cn(
                  'flex h-10 items-center rounded-md transition-all duration-200 focus:outline-none',
                  isSidebarVisible ? 'px-3' : 'justify-start px-3',
                  isHoverOpen && !isOpenSideBar ? 'hover:bg-white/80' : 'hover:bg-gray-50'
                )}
                aria-label={action.label}
                onMouseEnter={() => {
                  // Open sidebar on hover if it's closed
                  if (!isOpenSideBar) {
                    setHoverOpen(true)
                  }
                }}
              >
                <ActionIcon size={20} className="shrink-0 text-gray-700" strokeWidth={1.5} />
                <span className="text-dark-500 ml-3 text-sm font-medium">{action.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </aside>
  )
}

export default Sidebar
