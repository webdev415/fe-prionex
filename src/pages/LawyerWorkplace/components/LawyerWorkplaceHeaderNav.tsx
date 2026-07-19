import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import {
  useLegalDocumentStats,
  useLegalInboxSummary,
  useLegalKanban,
} from '@/features/lawyerWorkplace'
import { useCanAccessLegalKanban } from '@/features/lawyerWorkplace/hooks/useLegalPermissions'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { LawyerAvailabilityToggle } from './LawyerAvailabilityToggle'
import type { LawyerWorkplaceTab } from '../types'

interface TabConfig {
  id: LawyerWorkplaceTab
  labelKey: string
  fallback: string
  icon: (props: { size: number; className: string; strokeWidth: number }) => React.ReactElement
  badge?: number
  badgeVariant?: 'new' | 'count'
}

const WORKPLACE_TABS: LawyerWorkplaceTab[] = ['inbox', 'kanban', 'documents', 'settings']

const TAB_BASE: Omit<TabConfig, 'badge' | 'badgeVariant'>[] = [
  {
    id: 'inbox',
    labelKey: 'pages.lawyerWorkplace.tabs.inbox',
    fallback: 'Inbox',
    icon: (props) => <Icons.InboxIcon {...props} />,
  },
  {
    id: 'kanban',
    labelKey: 'pages.lawyerWorkplace.tabs.kanban',
    fallback: 'Kanban',
    icon: (props) => <Icons.Users {...props} />,
  },
  {
    id: 'documents',
    labelKey: 'pages.lawyerWorkplace.tabs.documents',
    fallback: 'Documents',
    icon: (props) => <Icons.Files02Icon {...props} />,
  },
  {
    id: 'settings',
    labelKey: 'pages.lawyerWorkplace.tabs.settings',
    fallback: 'Settings',
    icon: (props) => <Icons.Settings {...props} />,
  },
]

function isWorkplaceTab(value: string | null): value is LawyerWorkplaceTab {
  return value !== null && (WORKPLACE_TABS as string[]).includes(value)
}

/**
 * Lawyer Workplace top navigation — rendered in DashboardLayout header
 * instead of the global search bar when on /dashboard/lawyer-workplace.
 */
export function LawyerWorkplaceHeaderNav() {
  const { t } = useTranslation('common')
  const [searchParams, setSearchParams] = useSearchParams()
  const { unprocessedCount } = useLegalInboxSummary()
  const canAccessKanban = useCanAccessLegalKanban()
  const { tasks: kanbanTasks } = useLegalKanban({ enabled: canAccessKanban })
  const { data: documentStats } = useLegalDocumentStats()

  const kanbanActiveCount = useMemo(
    () => kanbanTasks.filter((task) => task.columnId !== 'completed').length,
    [kanbanTasks]
  )
  const documentsCount = documentStats?.filterCounts.all ?? 0

  const tabs: TabConfig[] = useMemo(
    () =>
      TAB_BASE.filter((tab) => tab.id !== 'kanban' || canAccessKanban).map((tab) => {
        if (tab.id === 'inbox' && unprocessedCount > 0) {
          return { ...tab, badge: unprocessedCount, badgeVariant: 'new' as const }
        }
        if (tab.id === 'kanban' && kanbanActiveCount > 0) {
          return { ...tab, badge: kanbanActiveCount, badgeVariant: 'count' as const }
        }
        if (tab.id === 'documents' && documentsCount > 0) {
          return { ...tab, badge: documentsCount, badgeVariant: 'count' as const }
        }
        return tab
      }),
    [canAccessKanban, documentsCount, kanbanActiveCount, unprocessedCount]
  )

  const rawTab = searchParams.get('tab')
  const activeTab: LawyerWorkplaceTab = isWorkplaceTab(rawTab) ? rawTab : 'inbox'

  const navRef = useRef<HTMLElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const syncScroll = useCallback(() => {
    const el = navRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    const el = navRef.current
    if (!el) return
    const frame = requestAnimationFrame(syncScroll)
    el.addEventListener('scroll', syncScroll, { passive: true })
    const ro = new ResizeObserver(syncScroll)
    ro.observe(el)
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener('scroll', syncScroll)
      ro.disconnect()
    }
  }, [syncScroll])

  const scrollBy = useCallback((delta: number) => {
    navRef.current?.scrollBy({ left: delta, behavior: 'smooth' })
  }, [])

  const handleTabChange = (tab: LawyerWorkplaceTab) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="relative flex h-full min-w-0 flex-1 overflow-hidden">
      <nav
        ref={navRef}
        aria-label={t('pages.lawyerWorkplace.navAria', 'Lawyer Workplace navigation')}
        className="flex h-full min-w-0 flex-1 items-stretch overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          const Icon = tab.icon
          const label = t(tab.labelKey, tab.fallback)

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              title={label}
              className={cn(
                'relative inline-flex h-full shrink-0 cursor-pointer items-center gap-1.5 px-2 text-sm font-medium transition-colors sm:gap-2 sm:px-3 lg:px-4',
                isActive ? 'text-dark-500' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              )}
            >
              <Icon
                size={20}
                strokeWidth={1.5}
                className={cn('shrink-0', isActive ? 'text-secondary-800' : 'text-gray-700')}
              />
              <span
                className={cn(
                  isActive ? 'text-secondary-800' : 'text-gray-700',
                  'hidden truncate text-sm lg:inline'
                )}
              >
                {label}
              </span>
              {tab.badge != null && tab.badge > 0 && (
                <span
                  className={cn(
                    'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] leading-none font-semibold',
                    tab.badgeVariant === 'new'
                      ? 'bg-red-50 text-red-600'
                      : 'bg-gray-100 text-gray-600'
                  )}
                >
                  {tab.badgeVariant === 'new' ? (
                    <>
                      <span className="lg:hidden">{tab.badge}</span>
                      <span className="hidden lg:inline">
                        {t('pages.lawyerWorkplace.tabs.newCount', {
                          defaultValue: '{{count}} new',
                          count: tab.badge,
                        })}
                      </span>
                    </>
                  ) : (
                    tab.badge
                  )}
                </span>
              )}
              {isActive && (
                <span className="bg-primary-500 absolute right-0 bottom-0 left-0 h-0.5" />
              )}
            </button>
          )
        })}
      </nav>

      <div className="flex shrink-0 items-center self-center pl-1 sm:pl-2">
        <LawyerAvailabilityToggle />
      </div>

      {/* Left fade + scroll arrow (mobile / compact header) */}
      <div
        className={cn(
          'pointer-events-none absolute inset-y-0 left-0 z-10 flex w-10 items-center justify-start transition-opacity duration-200 lg:hidden',
          canScrollLeft ? 'opacity-100' : 'opacity-0'
        )}
        style={{ background: 'linear-gradient(to right, var(--background) 45%, transparent)' }}
      >
        <button
          type="button"
          aria-label={t('pages.lawyerWorkplace.navScrollLeft', 'Scroll tabs left')}
          onClick={() => scrollBy(-140)}
          className={cn(
            'border-border bg-card text-muted-foreground hover:text-foreground pointer-events-auto ml-0.5 flex h-6 w-6 items-center justify-center rounded-full border shadow-md transition-all hover:border-gray-300 hover:shadow-lg',
            canScrollLeft ? 'cursor-pointer' : 'pointer-events-none'
          )}
        >
          <Icons.ArrowLeft size={12} strokeWidth={2.5} />
        </button>
      </div>

      {/* Right fade + scroll arrow (mobile / compact header) */}
      <div
        className={cn(
          'pointer-events-none absolute inset-y-0 right-0 z-10 flex w-12 items-center justify-end transition-opacity duration-200 lg:hidden',
          canScrollRight ? 'opacity-100' : 'opacity-0'
        )}
        style={{ background: 'linear-gradient(to left, var(--background) 55%, transparent)' }}
      >
        <button
          type="button"
          aria-label={t('pages.lawyerWorkplace.navScrollRight', 'Scroll tabs right')}
          onClick={() => scrollBy(140)}
          className={cn(
            'border-border bg-card text-muted-foreground hover:text-foreground pointer-events-auto mr-0.5 flex h-6 w-6 items-center justify-center rounded-full border shadow-md transition-all hover:border-gray-300 hover:shadow-lg',
            canScrollRight ? 'cursor-pointer' : 'pointer-events-none'
          )}
        >
          <Icons.ArrowRight size={12} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}
