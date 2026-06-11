import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
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

const TABS: TabConfig[] = [
  {
    id: 'inbox',
    labelKey: 'pages.lawyerWorkplace.tabs.inbox',
    fallback: 'Inbox',
    icon: (props) => <Icons.InboxIcon {...props} />,
    badge: 3,
    badgeVariant: 'new',
  },
  {
    id: 'kanban',
    labelKey: 'pages.lawyerWorkplace.tabs.kanban',
    fallback: 'Kanban',
    icon: (props) => <Icons.Users {...props} />,
    badge: 18,
    badgeVariant: 'count',
  },
  {
    id: 'documents',
    labelKey: 'pages.lawyerWorkplace.tabs.documents',
    fallback: 'Documents',
    icon: (props) => <Icons.Files02Icon {...props} />,
    badge: 412,
    badgeVariant: 'count',
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

  const rawTab = searchParams.get('tab')
  const activeTab: LawyerWorkplaceTab = isWorkplaceTab(rawTab) ? rawTab : 'inbox'

  const handleTabChange = (tab: LawyerWorkplaceTab) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    setSearchParams(next, { replace: true })
  }

  return (
    <nav
      aria-label={t('pages.lawyerWorkplace.navAria', 'Lawyer Workplace navigation')}
      className="flex h-full min-w-0 flex-1 items-stretch gap-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id
        const Icon = tab.icon

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleTabChange(tab.id)}
            className={cn(
              'relative inline-flex h-full shrink-0 cursor-pointer items-center gap-2 px-4 text-sm font-medium transition-colors',
              isActive ? 'text-dark-500' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            )}
          >
            <Icon
              size={20}
              strokeWidth={1.5}
              className={cn(isActive ? 'text-secondary-800' : 'text-gray-700')}
            />
            <span className={cn(isActive ? 'text-secondary-800' : 'text-gray-700', 'text-sm')}>
              {t(tab.labelKey, tab.fallback)}
            </span>
            {tab.badge != null && tab.badge > 0 && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] leading-none font-semibold',
                  tab.badgeVariant === 'new' ? 'bg-red-50 text-red-600' : 'text-dark-500 bg-white'
                )}
              >
                {tab.badgeVariant === 'new'
                  ? t('pages.lawyerWorkplace.tabs.newCount', {
                      defaultValue: '{{count}} new',
                      count: tab.badge,
                    })
                  : tab.badge}
              </span>
            )}
            {isActive && <span className="bg-primary-500 absolute right-0 bottom-0 left-0 h-0.5" />}
          </button>
        )
      })}
    </nav>
  )
}
