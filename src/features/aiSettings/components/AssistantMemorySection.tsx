/**
 * «Память» — админский разрез памяти ассистента на странице настроек AI.
 *
 * Сводка по скоупам (GET /admin/memory/summary): строка на сотрудника плюс
 * отдельная строка `global` — общий справочник, который мозг подмешивает всем.
 * Клик по строке раскрывает её записи (GET /admin/memory?scope=…) с удалением
 * — это единственное место, где видно, что именно ассистент помнит о человеке,
 * не заходя под его учёткой.
 *
 * Записи скоупа грузятся только при раскрытии: скоупов столько же, сколько
 * операторов, и тянуть их все ради свёрнутой таблицы незачем.
 *
 * Имена сотрудников подтягиваются справочником `useUserDirectory` — он гейтится
 * `view_users`, поэтому админ без этого права видит «Співробітник #6951», а не
 * пустую ячейку и не 403 в консоли.
 *
 * Секция под `manage_ai_settings`, как и остальные на странице; недоступный мозг
 * рисует одну карточку-предупреждение и не роняет соседние секции.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { PermissionGuard } from '@/components/auth'
import { PERMISSIONS } from '@/constants/permissions'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import {
  formatMemoryDate,
  MEMORY_SOURCE_BADGE_CLASS,
  memorySourceKey,
} from '@/features/aiAssistant/memoryPresentation'
import type { AssistantMemoryItem } from '@/features/aiAssistant/api'

import {
  GLOBAL_MEMORY_SCOPE,
  parseMemoryScopeUserId,
  type AssistantMemoryScopeSummary,
} from '../api/assistantMemoryService'
import {
  useAssistantMemoryScope,
  useAssistantMemorySummary,
  useDeleteAssistantMemoryRecord,
} from '../hooks/useAssistantMemoryAdmin'
import { useUserDirectory } from '../hooks/useUserDirectory'

function SectionSkeleton() {
  return (
    <div
      data-testid="assistant-memory-skeleton"
      className="border-border bg-card flex animate-pulse flex-col gap-3 rounded-xl border p-4 shadow-sm"
    >
      <div className="bg-border h-4 w-40 rounded" />
      <div className="bg-border h-4 w-full rounded" />
      <div className="bg-border h-16 w-full rounded" />
    </div>
  )
}

function MemoryRecord({ item, scope }: { item: AssistantMemoryItem; scope: string }) {
  const { t, i18n } = useTranslation('common')
  const deleteMutation = useDeleteAssistantMemoryRecord()

  const sourceKey = memorySourceKey(item.source, item.kind)

  const handleDelete = () => {
    deleteMutation.mutate(
      { id: item.id, scope },
      { onError: () => toast.error(t('pages.aiSettings.memory.deleteError')) }
    )
  }

  return (
    <li
      data-testid={`assistant-memory-record-${item.id}`}
      className="flex items-start justify-between gap-3 py-2"
    >
      <div className="min-w-0">
        <p className="text-foreground text-sm break-words">{item.content}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium',
              MEMORY_SOURCE_BADGE_CLASS[sourceKey]
            )}
          >
            {t(`pages.aiSettings.memory.sources.${sourceKey}`)}
          </span>
          <span className="text-muted-foreground text-xs">
            {formatMemoryDate(item.created_at, i18n.language)}
          </span>
        </div>
      </div>
      <button
        type="button"
        data-testid={`assistant-memory-delete-${item.id}`}
        aria-label={t('pages.aiSettings.memory.deleteAria')}
        disabled={deleteMutation.isPending}
        onClick={handleDelete}
        className="text-muted-foreground hover:bg-muted hover:text-error-600 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Icons.Delete size={16} strokeWidth={1.5} />
      </button>
    </li>
  )
}

function ScopeRecords({ scope }: { scope: string }) {
  const { t } = useTranslation('common')
  const recordsQuery = useAssistantMemoryScope(scope)

  if (recordsQuery.isPending) {
    return (
      <div data-testid="assistant-memory-records-loading" className="px-1 py-2" aria-hidden>
        <div className="bg-muted h-10 animate-pulse rounded-lg" />
      </div>
    )
  }

  if (recordsQuery.isError) {
    return (
      <p className="text-muted-foreground px-1 py-2 text-sm">
        {t('pages.aiSettings.memory.recordsError')}
      </p>
    )
  }

  const items = recordsQuery.data?.items ?? []
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground px-1 py-2 text-sm">
        {t('pages.aiSettings.memory.recordsEmpty')}
      </p>
    )
  }

  return (
    <ul
      data-testid={`assistant-memory-records-${scope}`}
      className="divide-border border-border/70 divide-y border-t pl-1"
    >
      {items.map((item) => (
        <MemoryRecord key={item.id} item={item} scope={scope} />
      ))}
    </ul>
  )
}

function ScopeRow({
  summary,
  label,
  isGlobal,
  expanded,
  onToggle,
}: {
  summary: AssistantMemoryScopeSummary
  label: string
  isGlobal: boolean
  expanded: boolean
  onToggle: () => void
}) {
  const { t, i18n } = useTranslation('common')

  return (
    <div data-testid={`assistant-memory-scope-${summary.scope}`} className="py-1">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className="hover:bg-muted/60 flex w-full cursor-pointer items-center gap-3 rounded-lg px-1 py-2 text-left transition-colors"
      >
        {expanded ? (
          <Icons.ArrowUp size={14} strokeWidth={1.5} className="text-muted-foreground shrink-0" />
        ) : (
          <Icons.ArrowDown size={14} strokeWidth={1.5} className="text-muted-foreground shrink-0" />
        )}
        <span className="min-w-0 flex-1">
          <span className="text-foreground block truncate text-sm font-medium">{label}</span>
          <span className="text-muted-foreground block truncate text-xs">
            {isGlobal ? t('pages.aiSettings.memory.globalHint') : summary.scope}
          </span>
        </span>
        <span className="text-foreground shrink-0 text-sm tabular-nums">{summary.records}</span>
        <span className="text-muted-foreground w-20 shrink-0 text-right text-xs">
          {formatMemoryDate(summary.last_at, i18n.language) || '—'}
        </span>
      </button>
      {expanded && <ScopeRecords scope={summary.scope} />}
    </div>
  )
}

export function AssistantMemorySection() {
  const { t } = useTranslation('common')
  const summaryQuery = useAssistantMemorySummary()
  // Две ступени: сначала раскрывается список скоупов, потом записи внутри одного.
  // Свёрнуто по умолчанию — иначе таблица на сотню операторов занимает всю
  // страницу настроек, а раздел здесь не главный.
  const [listOpen, setListOpen] = useState(false)
  const [expandedScope, setExpandedScope] = useState<string | null>(null)

  const scopes = useMemo(() => {
    const items = [...(summaryQuery.data ?? [])]
    // Общий справочник — всегда первой строкой: он влияет на всех, и искать
    // его среди сотен операторских скоупов админ не должен.
    return items.sort((a, b) => {
      if (a.scope === GLOBAL_MEMORY_SCOPE) return -1
      if (b.scope === GLOBAL_MEMORY_SCOPE) return 1
      return b.records - a.records
    })
  }, [summaryQuery.data])

  const directoryQuery = useUserDirectory(listOpen && scopes.length > 0)
  const directory = directoryQuery.data

  const scopeLabel = (scope: string): string => {
    if (scope === GLOBAL_MEMORY_SCOPE) return t('pages.aiSettings.memory.globalScope')
    const userId = parseMemoryScopeUserId(scope)
    if (userId == null) return scope
    return directory?.get(userId) ?? t('pages.aiSettings.memory.unknownUser', { id: userId })
  }

  return (
    <PermissionGuard permission={PERMISSIONS.SYSTEM.MANAGE_AI_SETTINGS}>
      <div data-testid="assistant-memory-section" className="flex flex-col gap-3">
        <div>
          <div className="text-foreground text-sm font-medium">
            {t('pages.aiSettings.memory.title')}
          </div>
          <div className="text-muted-foreground mt-0.5 text-xs">
            {t('pages.aiSettings.memory.helper')}
          </div>
        </div>

        {summaryQuery.isPending && <SectionSkeleton />}

        {!summaryQuery.isPending && summaryQuery.isError && (
          <div
            data-testid="assistant-memory-unavailable"
            className="border-border bg-card rounded-xl border p-6 text-center shadow-sm"
          >
            <Icons.Warning className="text-error-500 mx-auto h-6 w-6" strokeWidth={2} />
            <div className="text-foreground mt-2 text-sm font-medium">
              {t('pages.aiSettings.memory.unavailable')}
            </div>
          </div>
        )}

        {!summaryQuery.isPending && !summaryQuery.isError && (
          <div
            data-testid="assistant-memory-card"
            className="border-border bg-card flex flex-col gap-2 rounded-xl border p-4 shadow-sm"
          >
            <button
              type="button"
              data-testid="assistant-memory-toggle"
              aria-expanded={listOpen}
              onClick={() => setListOpen((open) => !open)}
              className="hover:bg-muted/50 -m-1 flex items-start gap-3 rounded-lg p-1 text-left transition-colors"
            >
              <div className="bg-primary-100 text-primary-700 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                <Icons.AiBrain03 size={16} strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-foreground text-sm font-medium">
                  {t('pages.aiSettings.memory.tableTitle')}
                </div>
                <div className="text-muted-foreground mt-0.5 text-xs">
                  {listOpen
                    ? t('pages.aiSettings.memory.tableDescription')
                    : t('pages.aiSettings.memory.collapsedHint', { count: scopes.length })}
                </div>
              </div>
              {listOpen ? (
                <Icons.ArrowUp
                  size={16}
                  strokeWidth={1.5}
                  className="text-muted-foreground mt-1 shrink-0"
                />
              ) : (
                <Icons.ArrowDown
                  size={16}
                  strokeWidth={1.5}
                  className="text-muted-foreground mt-1 shrink-0"
                />
              )}
            </button>

            {!listOpen ? null : scopes.length === 0 ? (
              <div
                data-testid="assistant-memory-empty"
                className="text-muted-foreground py-2 text-sm"
              >
                {t('pages.aiSettings.memory.empty')}
              </div>
            ) : (
              <>
                <div className="text-muted-foreground flex items-center gap-3 px-1 pt-1 text-[11px] font-medium tracking-wide uppercase">
                  <span className="w-[14px] shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1">{t('pages.aiSettings.memory.columnScope')}</span>
                  <span className="shrink-0">{t('pages.aiSettings.memory.columnRecords')}</span>
                  <span className="w-20 shrink-0 text-right">
                    {t('pages.aiSettings.memory.columnLastAt')}
                  </span>
                </div>
                <div className="divide-border divide-y">
                  {scopes.map((summary) => (
                    <ScopeRow
                      key={summary.scope}
                      summary={summary}
                      label={scopeLabel(summary.scope)}
                      isGlobal={summary.scope === GLOBAL_MEMORY_SCOPE}
                      expanded={expandedScope === summary.scope}
                      onToggle={() =>
                        setExpandedScope((current) =>
                          current === summary.scope ? null : summary.scope
                        )
                      }
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </PermissionGuard>
  )
}

export default AssistantMemorySection
