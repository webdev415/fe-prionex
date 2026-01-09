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
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface SidebarSubItem {
  path: string
  label: string
  disabled?: boolean
}

export interface SidebarItem {
  path: string
  icon: string
  label: string
  disabled?: boolean
  subItems?: SidebarSubItem[]
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
  const [openSubmenuIndex, setOpenSubmenuIndex] = useState<number | null>(null)
  const asideRef = useRef<HTMLElement | null>(null)
  const navRef = useRef<HTMLElement | null>(null)
  const anchorRefs = useRef<Array<HTMLDivElement | null>>([])
  const [submenuPosition, setSubmenuPosition] = useState<{ top: number; left: number } | null>(null)

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

  /**
   * Check if any sub-item is active
   */
  const hasActiveSubItem = (subItems?: SidebarSubItem[]) => {
    if (!subItems) return false
    return subItems.some((subItem) => isActivePath(subItem.path))
  }

  // Derive effective submenu index - close when sidebar is not visible
  const effectiveSubmenuIndex = isSidebarVisible ? openSubmenuIndex : null
  const visibleSubmenuItem = useMemo(() => {
    if (effectiveSubmenuIndex == null) return null
    return items[effectiveSubmenuIndex] ?? null
  }, [items, effectiveSubmenuIndex])

  const shouldShowSubmenu =
    isSidebarVisible &&
    effectiveSubmenuIndex != null &&
    (visibleSubmenuItem?.subItems?.length ?? 0) > 0

  const updateSubmenuPosition = (index: number | null) => {
    if (index == null) {
      setSubmenuPosition(null)
      return
    }
    const el = anchorRefs.current[index]
    if (!el) {
      setSubmenuPosition(null)
      return
    }
    const rect = el.getBoundingClientRect()
    const menuWidth = 200
    // Small visual gap between anchor and submenu (click-only, so no hover flicker concerns)
    const gutter = 8

    let left = rect.right + gutter
    if (left + menuWidth + gutter > window.innerWidth) {
      left = Math.max(gutter, rect.left - menuWidth - gutter)
    }
    const top = Math.max(gutter, rect.top)
    setSubmenuPosition({ top, left })
  }

  useEffect(() => {
    // Update position when sidebar is visible and submenu is open
    // Use requestAnimationFrame to defer state update and avoid lint error
    if (isSidebarVisible && effectiveSubmenuIndex != null) {
      requestAnimationFrame(() => {
        updateSubmenuPosition(effectiveSubmenuIndex)
      })
    } else {
      requestAnimationFrame(() => {
        setSubmenuPosition(null)
      })
    }
    // Cleanup: close submenu when sidebar becomes invisible
    return () => {
      if (!isSidebarVisible && openSubmenuIndex != null) {
        requestAnimationFrame(() => {
          setOpenSubmenuIndex(null)
        })
      }
    }
  }, [isSidebarVisible, effectiveSubmenuIndex, openSubmenuIndex])

  useEffect(() => {
    const handleResize = () => updateSubmenuPosition(effectiveSubmenuIndex)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [effectiveSubmenuIndex])

  useEffect(() => {
    // Close submenu when clicking outside (works for both pinned-open and hover-open sidebar)
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      if (asideRef.current?.contains(target)) return
      if (target.closest('.submenu-container')) return
      setOpenSubmenuIndex(null)
      setSubmenuPosition(null)
      // If sidebar is only hover-open, collapse it as well
      if (isHoverOpen && !isOpenSideBar) {
        setHoverOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [isHoverOpen, isOpenSideBar, setHoverOpen])

  return (
    <>
      <aside
        ref={(el) => {
          asideRef.current = el
        }}
        className={cn(
          // Keep overflow visible; submenu is rendered via portal, but this also prevents clipping for any future overlays
          'fixed top-0 left-0 z-30 flex h-screen flex-col overflow-visible py-6 transition-all duration-300',
          'shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_21px_2px_0px_rgba(0,0,0,0.06)]',
          isSidebarVisible ? 'w-60' : 'w-18',
          'items-start px-4 pl-3',
          isHoverOpen && !isOpenSideBar ? 'bg-white' : 'bg-white',
          className
        )}
        onMouseEnter={() => {
          // If hovering over sidebar and it was opened by hover, keep it open
          if (isHoverOpen) {
            setHoverOpen(true)
          }
        }}
        onMouseLeave={(e) => {
          // If we're moving into the submenu (rendered via portal), don't collapse hover sidebar
          const relatedTarget = (e.relatedTarget as HTMLElement | null) ?? null
          if (relatedTarget?.closest?.('.submenu-container')) {
            return
          }
          // If submenu is open, keep sidebar open so user can interact with submenu
          if (openSubmenuIndex != null) {
            return
          }
          // Close sidebar if it was only opened by hover (delay to tolerate crossing gaps)
          if (isHoverOpen && !isOpenSideBar) {
            setHoverOpen(false)
          }
        }}
      >
        {/* Navigation Icons */}
        <nav
          ref={(el) => {
            navRef.current = el
          }}
          className={cn(
            // Keep vertical scrolling; submenu is rendered via portal so it will never be clipped by overflow
            'flex w-full flex-1 flex-col gap-4 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            'items-stretch px-0'
          )}
          onScroll={() => updateSubmenuPosition(effectiveSubmenuIndex)}
        >
          {/* Menu button */}
          <button
            onClick={toggleSidebar}
            className={cn(
              'flex h-10 shrink-0 cursor-pointer items-center rounded-lg transition-all duration-200 focus:outline-none',
              isSidebarVisible ? 'px-3' : 'justify-start px-3',
              'hover:bg-gray-50'
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

            const hasSubItems = item.subItems && item.subItems.length > 0
            const isActive =
              !item.disabled && (isActivePath(item.path) || hasActiveSubItem(item.subItems))
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

            // For items with sub-items, we need special handling
            if (hasSubItems) {
              return (
                <div key={uniqueKey} className="relative w-full" data-nav-item={index}>
                  {/* Main nav item */}
                  <div
                    ref={(el) => {
                      anchorRefs.current[index] = el
                    }}
                    className={cn(
                      // Make this feel/behave like other clickable NavLink rows
                      'flex h-10 shrink-0 cursor-pointer items-center rounded-lg transition-all duration-200 select-none',
                      isSidebarVisible ? 'px-3' : 'justify-start px-3',
                      isActive ? 'bg-secondary-800' : 'hover:bg-gray-50'
                    )}
                    onClick={() => {
                      // If collapsed, expand on click so the submenu can appear
                      if (!isSidebarVisible && !isOpenSideBar) {
                        setHoverOpen(true)
                      }
                      setOpenSubmenuIndex((prev) => (prev === index ? null : index))
                      updateSubmenuPosition(index)
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        // Match click behavior
                        if (!isSidebarVisible && !isOpenSideBar) {
                          setHoverOpen(true)
                        }
                        setOpenSubmenuIndex((prev) => (prev === index ? null : index))
                        updateSubmenuPosition(index)
                      }
                    }}
                  >
                    {/* Icon - hover expands sidebar */}
                    <div
                      className="flex items-center"
                      onMouseEnter={() => {
                        // When hovering icon, expand sidebar
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
                    </div>
                    {/* Text - visible when sidebar is expanded */}
                    {isSidebarVisible && (
                      <div
                        className={cn(
                          'ml-3 flex-1 text-sm font-medium text-nowrap',
                          isActive ? 'text-white' : 'text-dark-500'
                        )}
                      >
                        {item.label}
                      </div>
                    )}

                    {/* Chevron indicator for submenus (click-only) */}
                    {isSidebarVisible && (
                      <Icons.ArrowRight
                        size={16}
                        className={cn(
                          'ml-auto shrink-0 transition-colors',
                          isActive ? 'text-white' : 'text-gray-400'
                        )}
                        strokeWidth={1.5}
                      />
                    )}
                  </div>
                </div>
              )
            }

            // Regular nav item without sub-items
            const navLinkContent = (
              <NavLink
                to={item.path}
                end={item.path === '/dashboard'}
                className={cn(
                  'flex h-10 shrink-0 items-center rounded-lg transition-all duration-200 focus:outline-none',
                  isSidebarVisible ? 'px-3' : 'justify-start px-3',
                  isActive ? 'bg-secondary-800' : 'hover:bg-gray-50'
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

      {/* Submenu popover rendered in a portal so it cannot be clipped by any overflow container */}
      {shouldShowSubmenu &&
        effectiveSubmenuIndex != null &&
        visibleSubmenuItem?.subItems &&
        submenuPosition &&
        createPortal(
          <div
            className="submenu-container fixed z-[9999] min-w-[220px] rounded-xl border border-gray-200 bg-white p-2 shadow-lg"
            style={{ top: submenuPosition.top, left: submenuPosition.left }}
            onMouseEnter={() => {
              // Keep sidebar expanded while hovering submenu (hover-open mode)
              if (!isOpenSideBar) {
                setHoverOpen(true)
              }
            }}
            onMouseLeave={() => {
              // In hover-open mode, leaving submenu should collapse and close
              if (!isOpenSideBar && isHoverOpen) {
                setOpenSubmenuIndex(null)
                setSubmenuPosition(null)
                setHoverOpen(false)
              }
            }}
          >
            {visibleSubmenuItem.subItems.map((subItem, subIndex) => {
              const isSubActive = !subItem.disabled && isActivePath(subItem.path)
              const subUniqueKey = `${subItem.path}-${subItem.label}-${subIndex}`

              if (subItem.disabled) {
                return (
                  <div
                    key={subUniqueKey}
                    className="flex h-10 cursor-not-allowed items-center px-4 opacity-50"
                  >
                    <span className="text-sm text-gray-400">{subItem.label}</span>
                  </div>
                )
              }

              return (
                <NavLink
                  key={subUniqueKey}
                  to={subItem.path}
                  onClick={() => {
                    setOpenSubmenuIndex(null)
                    setSubmenuPosition(null)
                  }}
                  className={cn(
                    // Rounded submenu rows
                    'flex h-10 items-center rounded-lg px-3 transition-colors duration-200',
                    isSubActive ? 'bg-secondary-800 text-white' : 'text-dark-500 hover:bg-gray-50'
                  )}
                >
                  <span className="text-sm font-medium">{subItem.label}</span>
                </NavLink>
              )
            })}
          </div>,
          document.body
        )}
    </>
  )
}

export default Sidebar
