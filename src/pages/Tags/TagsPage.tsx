/**
 * Tags Management Page
 *
 * Admin page for managing tags used throughout the system.
 * Integrated with real API using React Query.
 */

import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { useTags, useSegments, useTagRules, useUpdateRule, useUpdateSegment } from '@/features/tags'
import type { Tag, TagDefinition, Segment, TagRule } from '@/features/tags'
import { useAuth } from '@/features/auth'
import { PermissionGuard } from '@/components/auth'
import { PERMISSIONS } from '@/constants/permissions'
import { Icons } from '@/lib/icons'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { ErrorState } from '@/components/ErrorState'
import { Button } from '@/components/ui/Button'
import { DoubleButton } from '@/components/ui/DoubleButton'
import { LinkButton } from '@/components/ui/LinkButton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { TagFormModal } from './components/TagFormModal'
import { DeleteTagDialog } from './components/DeleteTagDialog'
import { DeleteRuleDialog } from './components/DeleteRuleDialog'
import { DeleteSegmentDialog } from './components/DeleteSegmentDialog'
import { SegmentFormModal } from './components/SegmentFormModal'
import { RuleFormModal } from './components/RuleFormModal'
import { MutexGroupFormModal } from './components/MutexGroupFormModal'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'

type TabId = 'dictionary' | 'segments' | 'rules' | 'groups'

/** Convert a cron expression to a human-readable string using i18n */
function humanizeCron(
  expr: string,
  t: (key: string, fallback: string, opts?: Record<string, string>) => string
): string {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return expr

  const [min, hour, dom, mon, dow] = parts

  // Every N minutes
  if (min.startsWith('*/') && hour === '*' && dom === '*' && mon === '*' && dow === '*') {
    return t('pages.tags.rules.cronHumanize.everyNMin', `Every ${min.slice(2)} min`, {
      n: min.slice(2),
    })
  }

  // Specific time
  if (/^\d+$/.test(min) && /^\d+$/.test(hour)) {
    const time = `${hour.padStart(2, '0')}:${min.padStart(2, '0')}`

    // Daily
    if (dom === '*' && mon === '*' && dow === '*') {
      return t('pages.tags.rules.cronHumanize.dailyAt', `Daily at ${time}`, { time })
    }

    // Specific day of week
    if (dom === '*' && mon === '*' && /^\d+$/.test(dow)) {
      const dayName = t(`pages.tags.rules.cronHumanize.days.${dow}`, dow)
      return t('pages.tags.rules.cronHumanize.dayAt', `${dayName} at ${time}`, {
        day: dayName,
        time,
      })
    }
  }

  return expr
}

const TABS: { id: TabId; labelKey: string; fallback: string }[] = [
  { id: 'dictionary', labelKey: 'pages.tags.tabs.dictionary', fallback: 'Dictionary' },
  { id: 'segments', labelKey: 'pages.tags.tabs.segments', fallback: 'Segments' },
  { id: 'rules', labelKey: 'pages.tags.tabs.rules', fallback: 'Rules' },
  { id: 'groups', labelKey: 'pages.tags.tabs.groups', fallback: 'Groups' },
]

const CATEGORY_FILTERS = ['all', 'status', 'risk', 'communication', 'behavior', 'system', 'custom']

const DATE_LOCALE_BY_LANGUAGE: Record<string, string> = {
  en: 'en-US',
  ru: 'ru-RU',
  uk: 'uk-UA',
}

export function TagsPage() {
  const { t, i18n } = useTranslation('common')
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get('tab') as TabId) || 'dictionary'
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editTag, setEditTag] = useState<Tag | null>(null)
  const [deleteTagId, setDeleteTagId] = useState<number | null>(null)
  const [openDropdownTagId, setOpenDropdownTagId] = useState<number | null>(null)
  const [editSegment, setEditSegment] = useState<Segment | null>(null)
  const [editRule, setEditRule] = useState<TagRule | null>(null)
  const [deleteRuleId, setDeleteRuleId] = useState<number | null>(null)
  const [deleteSegmentId, setDeleteSegmentId] = useState<number | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [showGroupModal, setShowGroupModal] = useState(false)

  // Tab switching
  const setActiveTab = (tab: TabId) => {
    setSearchParams({ tab })
  }

  // Get current user and active project
  const { user } = useAuth()
  const activeProjectName = useMemo(() => {
    if (!user?.active_project_id || !user?.projects) return undefined
    const activeProject = user.projects.find((p) => p.id === user.active_project_id)
    return activeProject?.name
  }, [user])

  // Fetch data (only load active tab's data)
  const { data: tags = [], isLoading, isError, error } = useTags()
  const { data: segments = [], isLoading: segmentsLoading } = useSegments()
  const { data: rules = [], isLoading: rulesLoading } = useTagRules()

  const filteredTags = useMemo(() => {
    if (categoryFilter === 'all') return tags
    return tags.filter((tag) => tag.category === categoryFilter)
  }, [tags, categoryFilter])

  const dateLocale = DATE_LOCALE_BY_LANGUAGE[i18n.language] ?? 'ru-RU'

  // Close dropdown when screen size crosses breakpoint (in either direction)
  useEffect(() => {
    let wasMobile = window.innerWidth < 1024 // lg breakpoint

    const handleResize = () => {
      const isMobile = window.innerWidth < 1024

      // Close dropdown if transitioning across breakpoint (mobile <-> desktop)
      if (wasMobile !== isMobile && openDropdownTagId !== null) {
        setOpenDropdownTagId(null)
      }

      wasMobile = isMobile
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [openDropdownTagId])

  const handleEdit = (tag: Tag) => {
    setEditTag(tag)
  }

  const handleDeactivate = (tagId: number) => {
    setDeleteTagId(tagId)
  }

  const handleCreateSuccess = () => {
    setShowCreateModal(false)
  }

  const handleEditSuccess = () => {
    setEditTag(null)
  }

  const handleDeactivateSuccess = () => {
    setDeleteTagId(null)
  }

  // Rule & segment mutations
  const updateRuleMutation = useUpdateRule()
  const updateSegmentMutation = useUpdateSegment()
  const ruleToDelete = rules.find((r) => r.id === deleteRuleId)
  const segmentToDelete = segments.find((s) => s.id === deleteSegmentId)

  // Find the tag being deactivated for display in dialog
  const tagToDeactivate = tags.find((tag) => tag.id === deleteTagId)

  // Compute mutex groups for Groups tab
  const mutexGroups = useMemo(() => {
    const map: Record<string, { tags: TagDefinition[]; totalClients: number }> = {}
    tags.forEach((t) => {
      const def = t as TagDefinition
      if (def.mutex_group) {
        if (!map[def.mutex_group]) {
          map[def.mutex_group] = { tags: [], totalClients: 0 }
        }
        map[def.mutex_group].tags.push(def)
        map[def.mutex_group].totalClients += def.client_count || 0
      }
    })
    return map
  }, [tags])

  // Table columns definition - recalculate when language changes
  const columns: Column<Tag>[] = useMemo(
    () => [
      {
        key: 'name',
        header: t('pages.tags.tableHeaders.name', 'Tag Name'),
        render: (tag) => (
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
            <span className="font-medium">{tag.name}</span>
          </div>
        ),
      },
      {
        key: 'code',
        header: t('pages.tags.tableHeaders.code', 'Code'),
        render: (tag) => (
          <code className="text-xs text-gray-600">{(tag as TagDefinition).code || '-'}</code>
        ),
      },
      {
        key: 'category',
        header: t('pages.tags.tableHeaders.category', 'Category'),
        render: (tag) => (
          <div>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
              {tag.category ? t(`pages.tags.categories.${tag.category}`, tag.category) : '-'}
            </span>
            {(tag as TagDefinition).mutex_group && (
              <div className="mt-0.5 text-xs text-gray-400">
                {(tag as TagDefinition).mutex_group}
              </div>
            )}
          </div>
        ),
      },
      {
        key: 'visibility',
        header: t('pages.tags.tableHeaders.visibility', 'Visibility'),
        render: (tag) => {
          const vis = (tag as TagDefinition).visibility
          return (
            <span className="text-xs text-gray-600">
              {vis ? t(`pages.tags.visibilities.${vis}`, vis) : '-'}
            </span>
          )
        },
      },
      {
        key: 'origin',
        header: t('pages.tags.tableHeaders.origin', 'Origin'),
        render: (tag) => {
          const origin = (tag as TagDefinition).origin
          return origin === 'system' ? (
            <span className="bg-information-50 text-information-700 rounded px-2 py-0.5 text-xs">
              {t('pages.tags.origins.system', 'System')}
            </span>
          ) : (
            <span className="text-xs text-gray-500">
              {t('pages.tags.origins.custom', 'Custom')}
            </span>
          )
        },
      },
      {
        key: 'is_active',
        header: t('pages.tags.tableHeaders.active', 'Active'),
        align: 'center',
        render: (tag) => {
          const active = (tag as TagDefinition).is_active ?? true
          return (
            <span
              className={`text-xs font-medium ${active ? 'text-success-600' : 'text-gray-400'}`}
            >
              {active ? t('common.yes', 'Yes') : t('common.no', 'No')}
            </span>
          )
        },
      },
      {
        key: 'client_count',
        header: t('pages.tags.tableHeaders.clients', 'Clients'),
        align: 'center',
        render: (tag) => <span className="font-medium">{tag.client_count || 0}</span>,
      },
      {
        key: 'actions',
        header: t('pages.tags.tableHeaders.actions', 'Actions'),
        align: 'center',
        render: (tag) => (
          <div className="flex items-center justify-center gap-2">
            {/* Desktop: Individual link buttons */}
            <div className="hidden items-center gap-4 lg:flex">
              <PermissionGuard permission={PERMISSIONS.TAGS.EDIT}>
                <LinkButton
                  variant="regular-black"
                  size="xs"
                  onClick={() => handleEdit(tag)}
                  leftIcon={<Icons.PencilEdit size={16} color="#05040D" strokeWidth={1.5} />}
                >
                  {t('pages.tags.actions.edit', 'Edit')}
                </LinkButton>
              </PermissionGuard>
              <PermissionGuard permission={PERMISSIONS.TAGS.DELETE}>
                <LinkButton
                  variant="regular-black"
                  size="xs"
                  onClick={() => handleDeactivate(tag.id)}
                  leftIcon={<Icons.Cancel01 size={16} color="#05040D" strokeWidth={1.5} />}
                >
                  {(tag as TagDefinition).is_active !== false
                    ? t('pages.tags.actions.deactivate', 'Деактивировать')
                    : t('pages.tags.actions.reactivate', 'Активировать')}
                </LinkButton>
              </PermissionGuard>
            </div>

            {/* Mobile/Tablet: Dropdown button group */}
            <div className="lg:hidden">
              <DropdownMenu
                modal={false}
                open={openDropdownTagId === tag.id}
                onOpenChange={(open) => setOpenDropdownTagId(open ? tag.id : null)}
              >
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="text-dark-500 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-gray-300 bg-white transition-colors hover:bg-gray-100 focus:outline-none"
                    aria-label={t('pages.tags.tableHeaders.actions', 'Actions')}
                  >
                    <Icons.FilterVertical size={16} strokeWidth={1.5} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white">
                  <PermissionGuard permission={PERMISSIONS.TAGS.EDIT}>
                    <DropdownMenuItem
                      onClick={() => {
                        handleEdit(tag)
                        setOpenDropdownTagId(null)
                      }}
                      className="text-dark-500 flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <Icons.PencilEdit size={16} strokeWidth={1.5} />
                      <span>{t('pages.tags.actions.edit', 'Edit')}</span>
                    </DropdownMenuItem>
                  </PermissionGuard>
                  <PermissionGuard permission={PERMISSIONS.TAGS.DELETE}>
                    <DropdownMenuItem
                      onClick={() => {
                        handleDeactivate(tag.id)
                        setOpenDropdownTagId(null)
                      }}
                      className="text-dark-500 flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <Icons.Cancel01 size={16} strokeWidth={1.5} />
                      <span>
                        {(tag as TagDefinition).is_active !== false
                          ? t('pages.tags.actions.deactivate', 'Деактивировать')
                          : t('pages.tags.actions.reactivate', 'Активировать')}
                      </span>
                    </DropdownMenuItem>
                  </PermissionGuard>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ),
      },
    ],
    // i18n.language is needed to recalculate columns when language changes
    // openDropdownTagId is needed to update dropdown state in render function
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n?.language, openDropdownTagId]
  )

  // Segments columns
  const segmentColumns: Column<Segment>[] = useMemo(
    () => [
      {
        key: 'name',
        header: t('pages.tags.segments.name', 'Name'),
        render: (s) => <span className="font-medium">{s.name}</span>,
      },
      {
        key: 'code',
        header: t('pages.tags.segments.code', 'Code'),
        render: (s) => <code className="text-xs text-gray-600">{s.code}</code>,
      },
      {
        key: 'conditions',
        header: t('pages.tags.segments.conditions', 'Conditions'),
        render: (s) => {
          const OPERATOR_SYMBOLS: Record<string, string> = {
            eq: '=',
            neq: '!=',
            gt: '>',
            gte: '\u2265',
            lt: '<',
            lte: '\u2264',
            contains: '~',
            in: 'in',
            not_in: '!in',
          }

          const groupedConditions = s.conditions.reduce<Record<number, typeof s.conditions>>(
            (acc, condition) => {
              if (!acc[condition.group_index]) {
                acc[condition.group_index] = []
              }
              acc[condition.group_index].push(condition)
              return acc
            },
            {}
          )

          // Build all pill entries first, then slice
          const groups = Object.values(groupedConditions)
          type PillEntry = {
            type: 'pill' | 'and' | 'or'
            key: string
            node: React.ReactNode
          }
          const allEntries: PillEntry[] = []

          groups.forEach((group, groupIdx) => {
            if (groupIdx > 0) {
              allEntries.push({
                type: 'or',
                key: `or-${groupIdx}`,
                node: (
                  <span className="rounded bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-600">
                    {t('pages.tags.segments.orLabel', 'OR')}
                  </span>
                ),
              })
            }

            group.forEach((condition, condIdx) => {
              if (condIdx > 0) {
                allEntries.push({
                  type: 'and',
                  key: `and-${groupIdx}-${condIdx}`,
                  node: (
                    <span className="text-[10px] text-gray-400">
                      {t('pages.tags.segments.andLabel', 'AND')}
                    </span>
                  ),
                })
              }

              if (condition.condition_type === 'has_tag') {
                allEntries.push({
                  type: 'pill',
                  key: `pill-${groupIdx}-${condIdx}`,
                  node: (
                    <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">
                      {condition.tag_code ?? '—'}
                    </span>
                  ),
                })
              } else if (condition.condition_type === 'not_has_tag') {
                allEntries.push({
                  type: 'pill',
                  key: `pill-${groupIdx}-${condIdx}`,
                  node: (
                    <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] text-red-700">
                      {t('pages.tags.segments.conditionTypes.not_has_tag', 'NOT')}{' '}
                      {condition.tag_code ?? '—'}
                    </span>
                  ),
                })
              } else {
                const label = condition.field_name ?? condition.tag_code ?? condition.condition_type
                const op = OPERATOR_SYMBOLS[condition.operator] ?? condition.operator ?? '='
                allEntries.push({
                  type: 'pill',
                  key: `pill-${groupIdx}-${condIdx}`,
                  node: (
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-700">
                      {label} {op} {condition.value ?? '—'}
                    </span>
                  ),
                })
              }
            })
          })

          // Count actual pills (excluding connectors) and slice safely
          const MAX_PILLS = 4
          let pillCount = 0
          let cutIndex = allEntries.length
          for (let i = 0; i < allEntries.length; i++) {
            if (allEntries[i].type === 'pill') {
              pillCount++
              if (pillCount > MAX_PILLS) {
                // Cut before this pill's preceding connector (if any)
                cutIndex = allEntries[i - 1]?.type !== 'pill' ? i - 1 : i
                break
              }
            }
          }

          const visible = allEntries.slice(0, cutIndex)
          // Remove trailing connector if last visible entry is AND/OR
          while (visible.length > 0 && visible[visible.length - 1].type !== 'pill') {
            visible.pop()
          }

          const totalConditions = s.conditions.length
          const shownConditions = visible.filter((e) => e.type === 'pill').length
          const overflow = totalConditions > shownConditions

          return (
            <div className="flex flex-wrap items-center gap-1">
              {visible.map((entry) => (
                <span key={entry.key}>{entry.node}</span>
              ))}
              {overflow && (
                <span className="text-[10px] text-gray-400">
                  {t('pages.tags.showMore', '+{{count}} more', {
                    count: totalConditions - shownConditions,
                  })}
                </span>
              )}
            </div>
          )
        },
      },
      {
        key: 'cached_client_count',
        header: t('pages.tags.segments.clients', 'Clients'),
        align: 'center',
        render: (s) => <span className="font-medium">{s.cached_client_count}</span>,
      },
      {
        key: 'refresh_mode',
        header: t('pages.tags.segments.refreshMode', 'Refresh'),
        render: (s) => (
          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">
            {t(`pages.tags.segments.refreshModes.${s.refresh_mode}`, s.refresh_mode)}
          </span>
        ),
      },
      {
        key: 'is_active',
        header: t('pages.tags.segments.active', 'Status'),
        align: 'center',
        render: (s) => (
          <PermissionGuard
            permission={PERMISSIONS.TAGS.EDIT}
            fallback={
              <span
                className={`text-xs font-medium ${s.is_active ? 'text-success-600' : 'text-gray-400'}`}
              >
                {s.is_active ? t('common.yes', 'Yes') : t('common.no', 'No')}
              </span>
            }
          >
            <ToggleSwitch
              checked={s.is_active}
              onChange={(checked) =>
                updateSegmentMutation.mutate({ id: s.id, data: { is_active: checked } })
              }
              ariaLabel={
                s.is_active
                  ? t('pages.tags.deactivateSegment', 'Deactivate segment')
                  : t('pages.tags.activateSegment', 'Activate segment')
              }
            />
          </PermissionGuard>
        ),
      },
      {
        key: 'actions',
        header: t('pages.tags.tableHeaders.actions', 'Actions'),
        align: 'center',
        render: (s) => (
          <div className="flex items-center justify-center gap-4">
            <PermissionGuard permission={PERMISSIONS.TAGS.EDIT}>
              <LinkButton
                variant="regular-black"
                size="xs"
                onClick={() => setEditSegment(s)}
                leftIcon={<Icons.PencilEdit size={16} color="#05040D" strokeWidth={1.5} />}
              >
                {t('pages.tags.actions.edit', 'Edit')}
              </LinkButton>
            </PermissionGuard>
            <PermissionGuard permission={PERMISSIONS.TAGS.DELETE}>
              <LinkButton
                variant="regular-black"
                size="xs"
                onClick={() => setDeleteSegmentId(s.id)}
                leftIcon={<Icons.Cancel01 size={16} color="#05040D" strokeWidth={1.5} />}
              >
                {t('actions.delete', 'Delete')}
              </LinkButton>
            </PermissionGuard>
          </div>
        ),
      },
    ],
    [t, updateSegmentMutation]
  )

  // Rules columns
  const ruleColumns: Column<TagRule>[] = useMemo(
    () => [
      {
        key: 'name',
        header: t('pages.tags.rules.name', 'Name'),
        render: (r) => <span className="font-medium">{r.name}</span>,
      },
      {
        key: 'description',
        header: t('pages.tags.rules.description', 'Description'),
        render: (r) => (
          <span className="line-clamp-1 text-xs text-gray-600">{r.description || '—'}</span>
        ),
      },
      {
        key: 'trigger_type',
        header: t('pages.tags.rules.trigger', 'Trigger'),
        render: (r) => {
          let triggerDetail = ''
          if (r.trigger_type === 'event' && r.trigger_event) {
            triggerDetail = r.trigger_event
          } else if (r.trigger_type === 'schedule' && r.cron_expression) {
            triggerDetail = humanizeCron(r.cron_expression, t)
          }

          return (
            <div className="flex flex-col gap-0.5">
              <span className="w-fit rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                {t(`pages.tags.rules.triggerTypes.${r.trigger_type}`, r.trigger_type)}
              </span>
              {triggerDetail && <span className="text-[10px] text-gray-500">{triggerDetail}</span>}
            </div>
          )
        },
      },
      {
        key: 'conditions',
        header: t('pages.tags.rules.conditions', 'Conditions'),
        render: (r) => {
          if (!r.conditions || r.conditions.length === 0) {
            return <span className="text-xs text-gray-400">—</span>
          }

          const OPERATOR_SYMBOLS: Record<string, string> = {
            eq: '=',
            neq: '!=',
            gt: '>',
            gte: '>=',
            lt: '<',
            lte: '<=',
            contains: '~',
            in: 'in',
            not_in: '!in',
          }

          const summary = r.conditions
            .slice(0, 2)
            .map((c) => `${c.field} ${OPERATOR_SYMBOLS[c.op] ?? c.op} ${c.value}`)
            .join(` ${t('pages.tags.segments.andLabel', 'AND')} `)

          return (
            <span className="line-clamp-2 text-xs text-gray-600">
              {summary}
              {r.conditions.length > 2 && (
                <span className="text-gray-400">
                  {' '}
                  {t('pages.tags.showMore', '+{{count}} more', {
                    count: r.conditions.length - 2,
                  })}
                </span>
              )}
            </span>
          )
        },
      },
      {
        key: 'action_type',
        header: t('pages.tags.rules.action', 'Action'),
        render: (r) => (
          <span className="bg-secondary-50 text-secondary-700 rounded px-2 py-0.5 text-xs">
            {t(`pages.tags.rules.actionTypes.${r.action_type}`, r.action_type)}
          </span>
        ),
      },
      {
        key: 'target_tag_code',
        header: t('pages.tags.rules.targetTag', 'Target Tag'),
        render: (r) => <code className="text-xs">{r.target_tag_code}</code>,
      },
      {
        key: 'execution_count',
        header: t('pages.tags.rules.executionCount', 'Executions'),
        align: 'center',
        render: (r) => <span className="text-xs font-medium">{r.execution_count || 0}</span>,
      },
      {
        key: 'last_executed_at',
        header: t('pages.tags.rules.lastExecuted', 'Last Run'),
        render: (r) => (
          <span className="text-xs text-gray-500">
            {r.last_executed_at
              ? new Date(r.last_executed_at).toLocaleString(dateLocale, {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : t('pages.tags.rules.neverExecuted', '—')}
          </span>
        ),
      },
      {
        key: 'is_active',
        header: t('pages.tags.rules.active', 'Status'),
        align: 'center',
        render: (r) => (
          <PermissionGuard
            permission={PERMISSIONS.TAGS.EDIT}
            fallback={
              <span
                className={`text-xs font-medium ${r.is_active ? 'text-success-600' : 'text-gray-400'}`}
              >
                {r.is_active ? t('common.yes', 'Yes') : t('common.no', 'No')}
              </span>
            }
          >
            <ToggleSwitch
              checked={r.is_active}
              onChange={(checked) =>
                updateRuleMutation.mutate({ id: r.id, data: { is_active: checked } })
              }
              ariaLabel={
                r.is_active
                  ? t('pages.tags.deactivateRule', 'Deactivate rule')
                  : t('pages.tags.activateRule', 'Activate rule')
              }
            />
          </PermissionGuard>
        ),
      },
      {
        key: 'actions',
        header: t('pages.tags.tableHeaders.actions', 'Actions'),
        align: 'center',
        render: (r) => (
          <div className="flex items-center justify-center gap-4">
            <PermissionGuard permission={PERMISSIONS.TAGS.EDIT}>
              <LinkButton
                variant="regular-black"
                size="xs"
                onClick={() => setEditRule(r)}
                leftIcon={<Icons.PencilEdit size={16} color="#05040D" strokeWidth={1.5} />}
              >
                {t('pages.tags.actions.edit', 'Edit')}
              </LinkButton>
            </PermissionGuard>
            <PermissionGuard permission={PERMISSIONS.TAGS.DELETE}>
              <LinkButton
                variant="regular-black"
                size="xs"
                onClick={() => setDeleteRuleId(r.id)}
                leftIcon={<Icons.Cancel01 size={16} color="#05040D" strokeWidth={1.5} />}
              >
                {t('actions.delete', 'Delete')}
              </LinkButton>
            </PermissionGuard>
          </div>
        ),
      },
    ],
    [dateLocale, t, updateRuleMutation]
  )

  return (
    <div>
      {/* Page Header */}
      <div className="mb-4 flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <h1 className="text-dark-500 text-xl font-light sm:text-2xl">
            {t('pages.tags.title', 'Tags')}
          </h1>
        </div>

        <PermissionGuard permission={PERMISSIONS.TAGS.CREATE}>
          <div className="hidden sm:block">
            <DoubleButton
              size="md"
              icon={<Icons.Add size={20} strokeWidth={2} />}
              iconPosition="left"
              onClick={() =>
                activeTab === 'groups' ? setShowGroupModal(true) : setShowCreateModal(true)
              }
            >
              {activeTab === 'dictionary'
                ? t('pages.tags.createTag', 'Создать тег')
                : activeTab === 'segments'
                  ? t('pages.tags.createSegment', 'Создать сегмент')
                  : activeTab === 'rules'
                    ? t('pages.tags.createRule', 'Создать правило')
                    : t('pages.tags.groups.createGroup', 'Создать группу')}
            </DoubleButton>
          </div>
          <button
            onClick={() =>
              activeTab === 'groups' ? setShowGroupModal(true) : setShowCreateModal(true)
            }
            className="bg-primary-300 text-dark-500 hover:bg-primary-500 flex h-10 w-10 items-center justify-center rounded-full transition-colors focus:outline-none sm:hidden"
            aria-label={t('pages.tags.createTag', 'Create')}
          >
            <Icons.Add size={20} strokeWidth={2} />
          </button>
        </PermissionGuard>
      </div>

      {/* Tabs */}
      <div className="mb-4 border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 px-1 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {t(tab.labelKey, tab.fallback)}
              <span className="ml-2 text-xs text-gray-400">
                {tab.id === 'dictionary'
                  ? activeTab === 'dictionary'
                    ? filteredTags.length
                    : tags.length
                  : tab.id === 'segments'
                    ? segments.length
                    : tab.id === 'rules'
                      ? rules.length
                      : Object.keys(mutexGroups).length}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content: Dictionary */}
      {activeTab === 'dictionary' && (
        <>
          {/* Info banner */}
          <div className="border-information-100 bg-information-50 mb-4 rounded-lg border px-4 py-3">
            <p className="text-information-700 text-xs">
              {t(
                'pages.tags.emptyStates.dictionaryBanner',
                'System tags for debt collection are pre-configured. You can also create custom tags.'
              )}
            </p>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            {CATEGORY_FILTERS.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  categoryFilter === cat
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat === 'all'
                  ? t('pages.tags.categories.all', 'All')
                  : t(`pages.tags.categories.${cat}`, cat)}
              </button>
            ))}
          </div>
          {isLoading && <TableSkeleton columns={columns.length} rows={5} />}
          {isError && (
            <ErrorState
              error={error}
              onRetry={() => window.location.reload()}
              title={t('pages.tags.errorLoading', 'Failed to load tags')}
            />
          )}
          {!isLoading && !isError && (
            <DataTable
              columns={columns}
              data={filteredTags}
              emptyMessage={t('pages.tags.noTagsFound', 'No tags found')}
            />
          )}
        </>
      )}

      {/* Tab Content: Segments */}
      {activeTab === 'segments' && (
        <>
          <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
            <p className="text-xs text-blue-700">
              {t(
                'pages.tags.emptyStates.segmentsBanner',
                'Segments are saved client groups based on tag conditions. Example: "High Risk + Active Debt" = all clients with both tags. Conditions in a group are combined with AND, groups — with OR.'
              )}
            </p>
          </div>
          {segmentsLoading && <TableSkeleton columns={6} rows={5} />}
          {!segmentsLoading && segments.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center">
              <Icons.Users size={40} className="mb-3 text-gray-400" strokeWidth={1.5} />
              <h3 className="mb-1 text-sm font-medium text-gray-900">
                {t('pages.tags.emptyStates.segmentsTitle', 'No segments yet')}
              </h3>
              <p className="mb-4 max-w-sm text-xs text-gray-500">
                {t(
                  'pages.tags.emptyStates.segmentsDescription',
                  'Segments group clients by tag conditions. For example: "All clients with high risk and active debt".'
                )}
              </p>
              <PermissionGuard permission={PERMISSIONS.TAGS.CREATE}>
                <Button
                  size="sm"
                  onClick={() => setShowCreateModal(true)}
                  leftIcon={<Icons.Add size={14} />}
                >
                  {t('pages.tags.emptyStates.createFromTemplate', 'Create from template')}
                </Button>
              </PermissionGuard>
            </div>
          )}
          {!segmentsLoading && segments.length > 0 && (
            <DataTable
              columns={segmentColumns}
              data={segments}
              emptyMessage={t('pages.tags.segments.empty', 'No segments found')}
            />
          )}
        </>
      )}

      {/* Tab Content: Rules */}
      {activeTab === 'rules' && (
        <>
          <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
            <p className="text-xs text-blue-700">
              {t(
                'pages.tags.emptyStates.rulesBanner',
                'Rules automatically add or remove tags when conditions are met. They can trigger on events (payment received), schedules (daily at 9:00), or scoring changes.'
              )}
            </p>
          </div>
          {rulesLoading && <TableSkeleton columns={8} rows={5} />}
          {!rulesLoading && rules.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center">
              <Icons.Settings size={40} className="mb-3 text-gray-400" strokeWidth={1.5} />
              <h3 className="mb-1 text-sm font-medium text-gray-900">
                {t('pages.tags.emptyStates.rulesTitle', 'No automation rules yet')}
              </h3>
              <p className="mb-4 max-w-sm text-xs text-gray-500">
                {t(
                  'pages.tags.emptyStates.rulesDescription',
                  'Rules automatically assign or remove tags on events. For example: auto-tag high risk when scoring changes.'
                )}
              </p>
              <PermissionGuard permission={PERMISSIONS.TAGS.CREATE}>
                <Button
                  size="sm"
                  onClick={() => setShowCreateModal(true)}
                  leftIcon={<Icons.Add size={14} />}
                >
                  {t('pages.tags.emptyStates.createFromTemplate', 'Create from template')}
                </Button>
              </PermissionGuard>
            </div>
          )}
          {!rulesLoading && rules.length > 0 && (
            <DataTable
              columns={ruleColumns}
              data={rules}
              emptyMessage={t('pages.tags.rules.empty', 'No rules found')}
            />
          )}
        </>
      )}

      {/* Groups Tab */}
      {activeTab === 'groups' && (
        <>
          <p className="text-dark-500 mb-4 text-sm font-light">
            {t(
              'pages.tags.groups.mutexNote',
              'Только один тег из этой группы может быть активен у клиента одновременно'
            )}
          </p>

          {Object.keys(mutexGroups).length === 0 && !isLoading && (
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
              <p className="text-gray-500">
                {t('pages.tags.groups.noGroups', 'Нет групп взаимоисключения')}
              </p>
            </div>
          )}

          {Object.keys(mutexGroups).length > 0 && (
            <div className="space-y-4">
              {Object.entries(mutexGroups).map(([groupName, group]) => (
                <div key={groupName} className="rounded-lg border border-gray-200 bg-white p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{groupName}</h3>
                      <p className="text-sm text-gray-500">
                        {t(`pages.tags.mutexGroupDescriptions.${groupName}`, groupName)}
                      </p>
                    </div>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600">
                      {t('pages.tags.groups.clients', 'Клиенты')}: {group.totalClients}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.tags.map((tag) => (
                      <div
                        key={tag.id}
                        className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5"
                      >
                        <div
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="text-sm font-medium text-gray-800">{tag.name}</span>
                        <span className="text-xs text-gray-400">({tag.client_count || 0})</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modals — Dictionary */}
      {showCreateModal && activeTab === 'dictionary' && (
        <TagFormModal
          open={showCreateModal}
          activeProjectName={activeProjectName}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
        />
      )}

      {editTag && (
        <TagFormModal
          open={editTag !== null}
          tag={editTag}
          activeProjectName={activeProjectName}
          onClose={() => setEditTag(null)}
          onSuccess={handleEditSuccess}
        />
      )}

      {deleteTagId && tagToDeactivate && (
        <DeleteTagDialog
          open={deleteTagId !== null}
          tag={tagToDeactivate}
          onClose={() => setDeleteTagId(null)}
          onSuccess={handleDeactivateSuccess}
        />
      )}

      {/* Modals — Segments */}
      {showCreateModal && activeTab === 'segments' && (
        <SegmentFormModal
          open={showCreateModal}
          tags={tags}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => setShowCreateModal(false)}
        />
      )}

      {editSegment && (
        <SegmentFormModal
          open={editSegment !== null}
          segment={editSegment}
          tags={tags}
          onClose={() => setEditSegment(null)}
          onSuccess={() => setEditSegment(null)}
        />
      )}

      {deleteSegmentId && segmentToDelete && (
        <DeleteSegmentDialog
          open={deleteSegmentId !== null}
          segment={segmentToDelete}
          onClose={() => setDeleteSegmentId(null)}
          onSuccess={() => setDeleteSegmentId(null)}
        />
      )}

      {/* Modals — Rules */}
      {showCreateModal && activeTab === 'rules' && (
        <RuleFormModal
          open={showCreateModal}
          tags={tags}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => setShowCreateModal(false)}
        />
      )}

      {editRule && (
        <RuleFormModal
          open={editRule !== null}
          rule={editRule}
          tags={tags}
          onClose={() => setEditRule(null)}
          onSuccess={() => setEditRule(null)}
        />
      )}

      {deleteRuleId && ruleToDelete && (
        <DeleteRuleDialog
          open={deleteRuleId !== null}
          rule={ruleToDelete}
          onClose={() => setDeleteRuleId(null)}
          onSuccess={() => setDeleteRuleId(null)}
        />
      )}

      {/* Modals — Groups */}
      {showGroupModal && (
        <MutexGroupFormModal
          open={showGroupModal}
          tags={tags as TagDefinition[]}
          onClose={() => setShowGroupModal(false)}
          onSuccess={() => setShowGroupModal(false)}
        />
      )}
    </div>
  )
}

export default TagsPage
