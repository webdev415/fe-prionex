/**
 * Tags Management Page
 *
 * Admin page for managing tags used throughout the system.
 * Integrated with real API using React Query.
 */

import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { useTags, useSegments, useTagRules } from '@/features/tags'
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
import { SegmentFormModal } from './components/SegmentFormModal'
import { RuleFormModal } from './components/RuleFormModal'

type TabId = 'dictionary' | 'segments' | 'rules'

const TABS: { id: TabId; labelKey: string; fallback: string }[] = [
  { id: 'dictionary', labelKey: 'pages.tags.tabs.dictionary', fallback: 'Dictionary' },
  { id: 'segments', labelKey: 'pages.tags.tabs.segments', fallback: 'Segments' },
  { id: 'rules', labelKey: 'pages.tags.tabs.rules', fallback: 'Rules' },
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
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

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
  const { data: segments = [], isLoading: segmentsLoading } = useSegments({
    enabled: activeTab === 'segments' || activeTab === 'dictionary',
  })
  const { data: rules = [], isLoading: rulesLoading } = useTagRules({
    enabled: activeTab === 'rules',
  })

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

  const handleDelete = (tagId: number) => {
    setDeleteTagId(tagId)
  }

  const handleCreateSuccess = () => {
    setShowCreateModal(false)
  }

  const handleEditSuccess = () => {
    setEditTag(null)
  }

  const handleDeleteSuccess = () => {
    setDeleteTagId(null)
  }

  // Find the tag being deleted for display in dialog
  const tagToDelete = tags.find((tag) => tag.id === deleteTagId)

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
          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
            {tag.category ? t(`pages.tags.categories.${tag.category}`, tag.category) : '-'}
          </span>
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
                  onClick={() => handleDelete(tag.id)}
                  leftIcon={<Icons.Delete size={16} color="#05040D" strokeWidth={1.5} />}
                >
                  {t('pages.tags.actions.delete', 'Delete')}
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
                        handleDelete(tag.id)
                        setOpenDropdownTagId(null)
                      }}
                      className="text-dark-500 flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <Icons.Delete size={16} strokeWidth={1.5} />
                      <span>{t('pages.tags.actions.delete', 'Delete')}</span>
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

          const formattedGroups = Object.values(groupedConditions).map((group) =>
            group
              .map((condition) => {
                if (
                  condition.condition_type === 'has_tag' ||
                  condition.condition_type === 'not_has_tag'
                ) {
                  return `${t(
                    `pages.tags.segments.conditionTypes.${condition.condition_type}`,
                    condition.condition_type
                  )}: ${condition.tag_code ?? '—'}`
                }

                const conditionLabel =
                  condition.field_name ??
                  condition.tag_code ??
                  t(
                    `pages.tags.segments.conditionTypes.${condition.condition_type}`,
                    condition.condition_type
                  )

                return `${conditionLabel} ${t(
                  `pages.tags.segments.operators.${condition.operator}`,
                  condition.operator
                )} ${condition.value ?? '—'}`
              })
              .join(` ${t('pages.tags.segments.andLabel', 'AND')} `)
          )

          return (
            <span className="line-clamp-2 text-xs text-gray-600">
              {formattedGroups.join(` ${t('pages.tags.segments.orLabel', 'OR')} `)}
            </span>
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
        header: t('pages.tags.segments.active', 'Active'),
        align: 'center',
        render: (s) => (
          <span
            className={`text-xs font-medium ${s.is_active ? 'text-success-600' : 'text-gray-400'}`}
          >
            {s.is_active ? t('common.yes', 'Yes') : t('common.no', 'No')}
          </span>
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
          </div>
        ),
      },
    ],
    [t]
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
        key: 'trigger_type',
        header: t('pages.tags.rules.trigger', 'Trigger'),
        render: (r) => (
          <span className="bg-information-50 text-information-700 rounded px-2 py-0.5 text-xs">
            {t(`pages.tags.rules.triggerTypes.${r.trigger_type}`, r.trigger_type)}
          </span>
        ),
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
        key: 'priority',
        header: t('pages.tags.rules.priority', 'Priority'),
        align: 'center',
        render: (r) => <span>{r.priority}</span>,
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
        header: t('pages.tags.rules.active', 'Active'),
        align: 'center',
        render: (r) => (
          <span
            className={`text-xs font-medium ${r.is_active ? 'text-success-600' : 'text-gray-400'}`}
          >
            {r.is_active ? t('common.yes', 'Yes') : t('common.no', 'No')}
          </span>
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
          </div>
        ),
      },
    ],
    [dateLocale, t]
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
              onClick={() => setShowCreateModal(true)}
            >
              {activeTab === 'dictionary'
                ? t('pages.tags.createTag', 'Create Tag')
                : activeTab === 'segments'
                  ? t('pages.tags.createSegment', 'Create Segment')
                  : t('pages.tags.createRule', 'Create Rule')}
            </DoubleButton>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
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
                    : rules.length}
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

      {deleteTagId && tagToDelete && (
        <DeleteTagDialog
          open={deleteTagId !== null}
          tag={tagToDelete}
          onClose={() => setDeleteTagId(null)}
          onSuccess={handleDeleteSuccess}
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
    </div>
  )
}

export default TagsPage
