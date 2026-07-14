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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface SidebarSubItem {
  path?: string
  label: string
  icon?: string
  disabled?: boolean
  /** Group heading with nested links (parent must not have `path`). */
  children?: SidebarSubItem[]
}

function countSubmenuRows(subItems?: SidebarSubItem[]): number {
  if (!subItems) return 0
  return subItems.reduce((total, subItem) => {
    if (subItem.children && subItem.children.length > 0) {
      return total + 1 + subItem.children.length
    }
    return total + 1
  }, 0)
}

function subItemIsActive(
  subItem: SidebarSubItem,
  isActivePath: (path: string) => boolean
): boolean {
  if (subItem.children?.length) {
    return subItem.children.some((child) => child.path && isActivePath(child.path))
  }
  return Boolean(subItem.path && isActivePath(subItem.path))
}

export interface SidebarItem {
  path: string
  icon: string
  label: string
  disabled?: boolean
  subItems?: SidebarSubItem[]
  /** Numeric badge shown on the icon (e.g. unprocessed letters count) */
  badge?: number
}

export interface SidebarAction {
  icon: string
  label: string
  onClick: () => void
}

export interface SidebarProps {
  /** Navigation items to display */
  items: SidebarItem[]
  /** Navigation items to display at the bottom (before actions) */
  bottomItems?: SidebarItem[]
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
  'briefcase-01': (props) => <Icons.Briefcase01 {...props} />,
  'transaction-history': (props) => <Icons.TransactionHistory {...props} />,
  'setting-07': (props) => <Icons.Setting07 {...props} />,
  'logout-square-01': (props) => <Icons.LogoutSquare01 {...props} />,
  'checkmark-badge-02': (props) => <Icons.CheckmarkBadge02 {...props} />,
  mail: (props) => <Icons.Mail {...props} />,
  'file-01': (props) => <Icons.File {...props} />,
  'chart-01': (props) => <Icons.Chart01 {...props} />,
  'calendar-01': (props) => <Icons.Calendar {...props} />,
  'mail-send-01': (props) => <Icons.MailSend01 {...props} />,
  'sliders-horizontal': (props) => <Icons.SlidersHorizontal {...props} />,
  'user-multiple-02': (props) => <Icons.UserMultiple02 {...props} />,
  'tag-01': (props) => <Icons.Tag01 {...props} />,
  'message-multiple-01': (props) => <Icons.MessageMultiple01 {...props} />,
  'message-secure-01': (props) => <Icons.MessageSecure01 {...props} />,
  'bubble-chat-edit': (props) => <Icons.BubbleChatEdit {...props} />,
  work: (props) => <Icons.WorkIcon {...props} />,
}

/**
 * Sidebar Component
 */
export function Sidebar({ items = [], bottomItems = [], actions = [], className }: SidebarProps) {
  const location = useLocation()
  const { isOpenSideBar, isHoverOpen, toggleSidebar, setHoverOpen } = useSidebarStore()
  const [openSubmenuIndex, setOpenSubmenuIndex] = useState<number | null>(null)
  const asideRef = useRef<HTMLElement | null>(null)
  const navRef = useRef<HTMLElement | null>(null)
  const anchorRefs = useRef<Array<HTMLDivElement | null>>([])
  const [submenuPosition, setSubmenuPosition] = useState<{
    top?: number
    bottom?: number
    left: number
  } | null>(null)

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
    return subItems.some((subItem) => subItemIsActive(subItem, isActivePath))
  }

  // Derive effective submenu index - close when sidebar is not visible
  const effectiveSubmenuIndex = isSidebarVisible ? openSubmenuIndex : null
  const visibleSubmenuItem = useMemo(() => {
    if (effectiveSubmenuIndex == null) return null
    const allItems = [...items, ...bottomItems]
    return allItems[effectiveSubmenuIndex] ?? null
  }, [items, bottomItems, effectiveSubmenuIndex])

  const shouldShowSubmenu =
    isSidebarVisible &&
    effectiveSubmenuIndex != null &&
    (visibleSubmenuItem?.subItems?.length ?? 0) > 0

  const updateSubmenuPosition = useCallback(
    (index: number | null) => {
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
      const menuWidth = 220
      const gutter = 8

      // Calculate submenu height estimate (approximate based on number of items)
      const allItems = [...items, ...bottomItems]
      const item = allItems[index]
      const submenuItemCount = countSubmenuRows(item?.subItems)
      const submenuHeight = Math.min(submenuItemCount * 40 + 16, 400) // ~40px per item + padding, max 400px

      // Horizontal positioning
      let left = rect.right + gutter
      if (left + menuWidth + gutter > window.innerWidth) {
        left = Math.max(gutter, rect.left - menuWidth - gutter)
      }

      // Vertical positioning.
      const spaceBelow = window.innerHeight - rect.top

      // When the submenu would overflow below the viewport (typical for the
      // Settings button near the sidebar bottom), anchor its BOTTOM edge to the
      // nav item's bottom and let it grow upward. Anchoring by `bottom` — rather
      // than a top derived from an *estimated* height — keeps the alignment
      // exact no matter how many items the submenu has, so it is never clipped.
      if (spaceBelow < submenuHeight) {
        setSubmenuPosition({
          bottom: Math.max(gutter, window.innerHeight - rect.bottom),
          left,
        })
      } else {
        // Top align (default) - submenu grows downward from the nav item's top.
        let top = Math.max(gutter, rect.top)
        if (top + submenuHeight > window.innerHeight - gutter) {
          top = Math.max(gutter, window.innerHeight - submenuHeight - gutter)
        }
        setSubmenuPosition({ top, left })
      }
    },
    [items, bottomItems]
  )

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
  }, [isSidebarVisible, effectiveSubmenuIndex, openSubmenuIndex, updateSubmenuPosition])

  useEffect(() => {
    const handleResize = () => updateSubmenuPosition(effectiveSubmenuIndex)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [effectiveSubmenuIndex, updateSubmenuPosition])

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
      {/* Mobile overlay */}
      {isOpenSideBar && (
        <div
          className="fixed inset-0 z-[25] bg-black/50 lg:hidden"
          onClick={() => toggleSidebar()}
          aria-hidden="true"
        />
      )}
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
          'bg-card',
          isOpenSideBar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          className
        )}
        onMouseEnter={() => {
          // Only enable hover on desktop (lg and above) - check via media query
          if (window.matchMedia('(min-width: 1024px)').matches) {
            // If hovering over sidebar and it was opened by hover, keep it open
            if (isHoverOpen) {
              setHoverOpen(true)
            }
          }
        }}
        onMouseLeave={(e) => {
          // Only enable hover on desktop (lg and above) - check via media query
          if (!window.matchMedia('(min-width: 1024px)').matches) {
            return
          }
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
              'hover:bg-muted'
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
              return null
            }

            const hasSubItems = item.subItems && item.subItems.length > 0
            const isActive =
              !item.disabled &&
              (hasSubItems ? hasActiveSubItem(item.subItems) : isActivePath(item.path))
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
                    // Only enable hover on desktop (lg and above)
                    if (window.matchMedia('(min-width: 1024px)').matches) {
                      // Open sidebar on hover if it's closed
                      if (!isOpenSideBar) {
                        setHoverOpen(true)
                      }
                    }
                  }}
                >
                  <IconComponent size={20} className="shrink-0 text-gray-400" strokeWidth={1.5} />
                  <span className="ml-3 truncate text-sm text-gray-400">{item.label}</span>
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
                      isActive ? 'bg-secondary-800' : 'hover:bg-muted'
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
                        // Only enable hover on desktop (lg and above)
                        if (window.matchMedia('(min-width: 1024px)').matches) {
                          // When hovering icon, expand sidebar
                          if (!isOpenSideBar) {
                            setHoverOpen(true)
                          }
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
                          'ml-3 min-w-0 flex-1 truncate text-sm font-medium',
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
                  isActive ? 'bg-secondary-800' : 'hover:bg-muted'
                )}
                aria-label={item.label}
                onMouseEnter={() => {
                  // Only enable hover on desktop (lg and above)
                  if (window.matchMedia('(min-width: 1024px)').matches) {
                    // Open sidebar on hover if it's closed
                    if (!isOpenSideBar) {
                      setHoverOpen(true)
                    }
                  }
                }}
              >
                <span className="relative shrink-0">
                  <IconComponent
                    size={20}
                    className={cn(isActive ? 'text-primary-300' : 'text-gray-700')}
                    strokeWidth={1.5}
                  />
                  {!!item.badge && item.badge > 0 && (
                    <span className="bg-error-500 absolute -top-1 -right-1 flex h-[14px] min-w-[14px] items-center justify-center rounded-full px-0.5 text-[8px] leading-none font-bold text-white">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    'ml-3 truncate text-sm font-medium',
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

          {/* Bottom navigation items (e.g., System Settings) */}
          {bottomItems.length > 0 && (
            <>
              <div className="mx-2 mt-auto h-px bg-gray-200" />
              {bottomItems.map((item, index) => {
                const IconComponent = iconMap[item.icon]

                if (!IconComponent) {
                  return null
                }

                const hasSubItems = item.subItems && item.subItems.length > 0
                const isActive =
                  !item.disabled &&
                  (hasSubItems ? hasActiveSubItem(item.subItems) : isActivePath(item.path))
                const isDisabled = item.disabled
                const uniqueKey = `${item.path}-${item.label}-bottom-${index}`

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
                        if (!isOpenSideBar) {
                          setHoverOpen(true)
                        }
                      }}
                    >
                      <IconComponent
                        size={20}
                        className="shrink-0 text-gray-400"
                        strokeWidth={1.5}
                      />
                      <span className="ml-3 truncate text-sm text-gray-400">{item.label}</span>
                    </div>
                  )
                }

                if (hasSubItems) {
                  return (
                    <div
                      key={uniqueKey}
                      className="relative w-full"
                      data-nav-item={`bottom-${index}`}
                    >
                      <div
                        ref={(el) => {
                          const bottomIndex = items.length + index
                          anchorRefs.current[bottomIndex] = el
                        }}
                        className={cn(
                          'flex h-10 shrink-0 cursor-pointer items-center rounded-lg transition-all duration-200 select-none',
                          isSidebarVisible ? 'px-3' : 'justify-start px-3',
                          isActive ? 'bg-secondary-800' : 'hover:bg-muted'
                        )}
                        onClick={() => {
                          if (!isSidebarVisible && !isOpenSideBar) {
                            setHoverOpen(true)
                          }
                          const bottomIndex = items.length + index
                          setOpenSubmenuIndex((prev) => (prev === bottomIndex ? null : bottomIndex))
                          updateSubmenuPosition(bottomIndex)
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            if (!isSidebarVisible && !isOpenSideBar) {
                              setHoverOpen(true)
                            }
                            const bottomIndex = items.length + index
                            setOpenSubmenuIndex((prev) =>
                              prev === bottomIndex ? null : bottomIndex
                            )
                            updateSubmenuPosition(bottomIndex)
                          }
                        }}
                      >
                        <div
                          className="flex items-center"
                          onMouseEnter={() => {
                            if (!isOpenSideBar) {
                              setHoverOpen(true)
                            }
                          }}
                        >
                          <IconComponent
                            size={20}
                            className={cn(
                              'shrink-0',
                              isActive ? 'text-primary-300' : 'text-gray-700'
                            )}
                            strokeWidth={1.5}
                          />
                        </div>
                        {isSidebarVisible && (
                          <div
                            className={cn(
                              'ml-3 min-w-0 flex-1 truncate text-sm font-medium',
                              isActive ? 'text-white' : 'text-dark-500'
                            )}
                          >
                            {item.label}
                          </div>
                        )}
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

                const navLinkContent = (
                  <NavLink
                    to={item.path}
                    end={item.path === '/dashboard'}
                    className={cn(
                      'flex h-10 shrink-0 items-center rounded-lg transition-all duration-200 focus:outline-none',
                      isSidebarVisible ? 'px-3' : 'justify-start px-3',
                      isActive ? 'bg-secondary-800' : 'hover:bg-muted'
                    )}
                    aria-label={item.label}
                    onMouseEnter={() => {
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
                        'ml-3 truncate text-sm font-medium',
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
            </>
          )}
        </nav>

        {/* Bottom action buttons */}
        {actions.length > 0 && (
          <div className="flex w-full flex-col items-stretch gap-6 pt-6">
            {actions.map((action, index) => {
              const ActionIcon = iconMap[action.icon]

              if (!ActionIcon) {
                return null
              }

              return (
                <button
                  key={index}
                  onClick={action.onClick}
                  className={cn(
                    'flex h-10 items-center rounded-md transition-all duration-200 focus:outline-none',
                    isSidebarVisible ? 'px-3' : 'justify-start px-3',
                    isHoverOpen && !isOpenSideBar ? 'hover:bg-card/80' : 'hover:bg-muted'
                  )}
                  aria-label={action.label}
                  onMouseEnter={() => {
                    // Only enable hover on desktop (lg and above)
                    if (window.matchMedia('(min-width: 1024px)').matches) {
                      // Open sidebar on hover if it's closed
                      if (!isOpenSideBar) {
                        setHoverOpen(true)
                      }
                    }
                  }}
                >
                  <ActionIcon size={20} className="shrink-0 text-gray-700" strokeWidth={1.5} />
                  <span className="text-dark-500 ml-3 truncate text-sm font-medium">
                    {action.label}
                  </span>
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
            className="submenu-container border-border bg-card fixed z-[9999] min-w-[220px] rounded-xl border p-2 shadow-lg"
            style={{
              top: submenuPosition.top,
              bottom: submenuPosition.bottom,
              left: submenuPosition.left,
              // Never exceed the viewport; scroll internally if the menu is
              // taller than the space available above the anchor.
              maxHeight: 'calc(100vh - 16px)',
              overflowY: 'auto',
            }}
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
              const subUniqueKey = `${subItem.path ?? 'group'}-${subItem.label}-${subIndex}`

              if (subItem.children && subItem.children.length > 0) {
                const GroupIconComponent = subItem.icon ? iconMap[subItem.icon] : null
                const isGroupActive = subItemIsActive(subItem, isActivePath)

                return (
                  <div key={subUniqueKey} className="py-1">
                    <div
                      className={cn(
                        'flex h-9 items-center px-3 text-xs font-semibold tracking-wide uppercase',
                        isGroupActive ? 'text-secondary-800' : 'text-gray-500'
                      )}
                    >
                      {GroupIconComponent && (
                        <GroupIconComponent
                          size={16}
                          className="mr-2 shrink-0 text-gray-500"
                          strokeWidth={1.5}
                        />
                      )}
                      <span className="truncate">{subItem.label}</span>
                    </div>
                    <div className="mt-0.5 space-y-0.5 pl-1">
                      {subItem.children.map((child, childIndex) => {
                        if (!child.path) return null
                        const isChildActive = !child.disabled && isActivePath(child.path)
                        const childKey = `${child.path}-${child.label}-${childIndex}`
                        const ChildIconComponent = child.icon ? iconMap[child.icon] : null

                        if (child.disabled) {
                          return (
                            <div
                              key={childKey}
                              className="flex h-10 cursor-not-allowed items-center px-3 opacity-50"
                            >
                              {ChildIconComponent && (
                                <ChildIconComponent
                                  size={18}
                                  className="mr-3 shrink-0 text-gray-400"
                                  strokeWidth={1.5}
                                />
                              )}
                              <span className="truncate text-sm text-gray-400">{child.label}</span>
                            </div>
                          )
                        }

                        return (
                          <NavLink
                            key={childKey}
                            to={child.path}
                            onClick={() => {
                              setOpenSubmenuIndex(null)
                              setSubmenuPosition(null)
                              if (isHoverOpen && !isOpenSideBar) {
                                setHoverOpen(false)
                              }
                            }}
                            className={cn(
                              'flex h-10 items-center rounded-lg px-3 transition-colors duration-200',
                              isChildActive
                                ? 'bg-secondary-800 text-white'
                                : 'text-dark-500 hover:bg-muted'
                            )}
                          >
                            {ChildIconComponent && (
                              <ChildIconComponent
                                size={18}
                                className={cn(
                                  'mr-3 shrink-0',
                                  isChildActive ? 'text-primary-300' : 'text-gray-600'
                                )}
                                strokeWidth={1.5}
                              />
                            )}
                            <span className="truncate text-sm font-medium">{child.label}</span>
                          </NavLink>
                        )
                      })}
                    </div>
                  </div>
                )
              }

              if (!subItem.path) return null

              const isSubActive = !subItem.disabled && isActivePath(subItem.path)
              const SubIconComponent = subItem.icon ? iconMap[subItem.icon] : null

              if (subItem.disabled) {
                return (
                  <div
                    key={subUniqueKey}
                    className="flex h-10 cursor-not-allowed items-center px-4 opacity-50"
                  >
                    {SubIconComponent && (
                      <SubIconComponent
                        size={18}
                        className="mr-3 shrink-0 text-gray-400"
                        strokeWidth={1.5}
                      />
                    )}
                    <span className="truncate text-sm text-gray-400">{subItem.label}</span>
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
                    if (isHoverOpen && !isOpenSideBar) {
                      setHoverOpen(false)
                    }
                  }}
                  className={cn(
                    'flex h-10 items-center rounded-lg px-3 transition-colors duration-200',
                    isSubActive ? 'bg-secondary-800 text-white' : 'text-dark-500 hover:bg-muted'
                  )}
                >
                  {SubIconComponent && (
                    <SubIconComponent
                      size={18}
                      className={cn(
                        'mr-3 shrink-0',
                        isSubActive ? 'text-primary-300' : 'text-gray-600'
                      )}
                      strokeWidth={1.5}
                    />
                  )}
                  <span className="truncate text-sm font-medium">{subItem.label}</span>
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
