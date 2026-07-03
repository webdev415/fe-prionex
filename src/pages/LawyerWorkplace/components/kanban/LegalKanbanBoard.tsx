import { useCallback, useMemo, useRef, useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import {
  applyKanbanTaskPatch,
  mapKanbanPatchToTaskUpdate,
  matchesDeadlineFilter,
  useLegalKanban,
  useLegalLawyers,
  useLegalLetterTypes,
  usePatchLegalKanbanTaskMetadata,
  useUpdateLegalKanbanTask,
  type LegalKanbanTaskPatch,
} from '@/features/lawyerWorkplace'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { useLawyerWorkplaceLayout } from '../../context/lawyerWorkplaceLayout'
import {
  buildKanbanColumns,
  KANBAN_DRAG_MIME,
  type KanbanColumnId,
  type KanbanDragPayload,
  type KanbanTask,
} from '../../kanban/kanbanData'
import { exportKanbanTasksToCsv } from '../../kanban/kanbanExport'
import {
  applyKanbanFilters,
  ALL_LAWYERS_FILTER,
  buildTypeFilterOptions,
  KANBAN_SCROLL_COLUMN_WIDTH_CLASS,
  TYPE_FILTER_OPTIONS,
  type DeadlineFilter,
  type LawyerFilterId,
  type LawyerFilterOption,
  type TypeFilterId,
} from './constants'
import {
  KanbanBoardScrollNavigator,
  KANBAN_SCROLL_CONTAINER_ID,
} from './KanbanBoardScrollNavigator'
import { KanbanBoardToolbar } from './KanbanBoardToolbar'
import { KanbanColumnHeader } from './KanbanColumnHeader'
import { KanbanColumnLane } from './KanbanColumnLane'
import { CreateKanbanTaskModal } from './CreateKanbanTaskModal'
import { KanbanTabSkeleton } from './KanbanTabSkeleton'
import { ThreadDrawer } from './ThreadDrawer'

export function LegalKanbanBoard() {
  const { t } = useTranslation('common')
  const { isKanbanGrid, showWorkspaceBanner } = useLawyerWorkplaceLayout()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const { data: lawyersData } = useLegalLawyers({ scopedToActiveProject: true })
  const { data: letterTypesData } = useLegalLetterTypes()
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>('this_week')
  const [lawyerFilter, setLawyerFilter] = useState<LawyerFilterId>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilterId>('all')
  const [createTaskOpen, setCreateTaskOpen] = useState(false)
  const [threadLetterId, setThreadLetterId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<KanbanColumnId | null>(null)
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null)
  const [localOverrides, setLocalOverrides] = useState<KanbanTask[] | null>(null)

  const assignedToUserId =
    lawyerFilter === 'all' ? undefined : Number.parseInt(lawyerFilter, 10) || undefined

  const {
    tasks: apiTasks,
    isLoading,
    isError,
    refetch,
  } = useLegalKanban({
    assignedToUserId:
      assignedToUserId != null && Number.isFinite(assignedToUserId) ? assignedToUserId : undefined,
  })
  const updateTaskMutation = useUpdateLegalKanbanTask()
  const patchMetadataMutation = usePatchLegalKanbanTaskMetadata()

  const lawyerFilterOptions = useMemo<LawyerFilterOption[]>(() => {
    const dynamicOptions =
      lawyersData?.items.map((lawyer) => ({
        id: String(lawyer.user_id),
        key: lawyer.display_name,
        fallback: lawyer.display_name,
        assigneeUserId: lawyer.user_id,
      })) ?? []

    return [ALL_LAWYERS_FILTER, ...dynamicOptions]
  }, [lawyersData?.items])

  const baseTasks = localOverrides ?? apiTasks

  const columns = useMemo(() => buildKanbanColumns(baseTasks), [baseTasks])

  const filteredColumns = useMemo(
    () =>
      applyKanbanFilters(
        columns,
        lawyerFilter,
        typeFilter,
        lawyerFilterOptions,
        deadlineFilter,
        matchesDeadlineFilter
      ),
    [columns, lawyerFilter, typeFilter, lawyerFilterOptions, deadlineFilter]
  )

  const totalActive = useMemo(
    () => baseTasks.filter((task) => task.columnId !== 'completed').length,
    [baseTasks]
  )

  const lawyers = useMemo(() => lawyersData?.items ?? [], [lawyersData?.items])

  const letterTypes = useMemo(
    () => (letterTypesData?.items ?? []).filter((item) => item.is_active),
    [letterTypesData?.items]
  )

  const typeFilterOptions = useMemo(
    () =>
      letterTypes.length > 0
        ? buildTypeFilterOptions(
            letterTypes.map((letterType) => ({
              id: letterType.id,
              name: letterType.name,
            }))
          )
        : TYPE_FILTER_OPTIONS,
    [letterTypes]
  )

  const filteredTaskCount = useMemo(
    () => filteredColumns.reduce((total, column) => total + column.tasks.length, 0),
    [filteredColumns]
  )

  const hasActiveFilters =
    lawyerFilter !== 'all' || typeFilter !== 'all' || deadlineFilter !== 'this_week'

  const clearFilters = () => {
    setLawyerFilter('all')
    setTypeFilter('all')
    setDeadlineFilter('this_week')
    setLocalOverrides(null)
  }

  const persistTaskPatch = useCallback(
    (taskId: string, patch: LegalKanbanTaskPatch) => {
      const source = localOverrides ?? apiTasks
      const task = source.find((item) => item.id === taskId)
      if (!task) return

      setLocalOverrides(
        source.map((item) =>
          item.id === taskId ? applyKanbanTaskPatch(item, patch, lawyers) : item
        )
      )

      const metadataPayload: { letter_type_id?: string; client_id?: number | null } = {}
      if (patch.letterTypeId) {
        metadataPayload.letter_type_id = patch.letterTypeId
      }
      if (patch.clientId !== undefined) {
        metadataPayload.client_id = patch.clientId
      }

      const taskPayload = mapKanbanPatchToTaskUpdate(patch, task)
      const metadataKeys = Object.keys(metadataPayload)
      const taskKeys = Object.keys(taskPayload)

      if (metadataKeys.length === 0 && taskKeys.length === 0) return

      const finalize = () => setLocalOverrides(null)

      void (async () => {
        try {
          const ops: Promise<unknown>[] = []
          if (metadataKeys.length > 0) {
            ops.push(
              patchMetadataMutation.mutateAsync({
                taskId: task.taskId,
                payload: metadataPayload,
              })
            )
          }
          if (taskKeys.length > 0) {
            ops.push(
              updateTaskMutation.mutateAsync({
                taskId: task.taskId,
                payload: taskPayload,
              })
            )
          }
          await Promise.all(ops)
          finalize()
        } catch {
          finalize()
        }
      })()
    },
    [apiTasks, lawyers, localOverrides, patchMetadataMutation, updateTaskMutation]
  )

  const handleMoveTask = useCallback(
    (taskId: string, toColumnId: KanbanColumnId) => {
      persistTaskPatch(taskId, { columnId: toColumnId })
    },
    [persistTaskPatch]
  )

  const handleTaskUpdate = useCallback(
    (taskId: string, patch: LegalKanbanTaskPatch) => {
      persistTaskPatch(taskId, patch)
    },
    [persistTaskPatch]
  )

  const handleDragStart = useCallback((event: DragEvent, task: KanbanTask) => {
    if (task.columnId === 'completed') {
      event.preventDefault()
      return
    }

    const payload: KanbanDragPayload = {
      taskId: task.id,
      fromColumnId: task.columnId,
    }
    event.dataTransfer.setData(KANBAN_DRAG_MIME, JSON.stringify(payload))
    event.dataTransfer.effectAllowed = 'move'
    setDraggingTaskId(task.id)
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggingTaskId(null)
    setDragOverColumn(null)
  }, [])

  const handleDragOver = useCallback((event: DragEvent, columnId: KanbanColumnId) => {
    if (Array.from(event.dataTransfer.types).includes(KANBAN_DRAG_MIME)) {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      setDragOverColumn((prev) => (prev === columnId ? prev : columnId))
    }
  }, [])

  const handleDragLeave = useCallback((columnId: KanbanColumnId) => {
    setDragOverColumn((prev) => (prev === columnId ? null : columnId))
  }, [])

  const handleDrop = useCallback(
    (event: DragEvent, columnId: KanbanColumnId) => {
      event.preventDefault()
      setDragOverColumn(null)
      setDraggingTaskId(null)

      const raw = event.dataTransfer.getData(KANBAN_DRAG_MIME)
      if (!raw) return

      let payload: KanbanDragPayload
      try {
        payload = JSON.parse(raw) as KanbanDragPayload
      } catch {
        return
      }

      if (payload.fromColumnId === columnId) return
      handleMoveTask(payload.taskId, columnId)
    },
    [handleMoveTask]
  )

  const handleExportCsv = useCallback(() => {
    const exported = exportKanbanTasksToCsv(filteredColumns, t)
    if (exported === 0) {
      toast.info(
        t('pages.lawyerWorkplace.kanban.exportEmpty', 'No tasks match the current filters')
      )
    }
  }, [filteredColumns, t])

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
      <KanbanBoardToolbar
        totalActive={totalActive}
        deadlineFilter={deadlineFilter}
        onDeadlineFilterChange={setDeadlineFilter}
        lawyerFilter={lawyerFilter}
        onLawyerFilterChange={(value) => {
          setLawyerFilter(value)
          setLocalOverrides(null)
        }}
        lawyerFilterOptions={lawyerFilterOptions}
        typeFilterOptions={typeFilterOptions}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        onNewTask={() => setCreateTaskOpen(true)}
        onExportCsv={handleExportCsv}
      />

      <CreateKanbanTaskModal open={createTaskOpen} onClose={() => setCreateTaskOpen(false)} />

      <ThreadDrawer letterId={threadLetterId} onClose={() => setThreadLetterId(null)} />

      {isLoading ? <KanbanTabSkeleton /> : null}

      {isError && !isLoading ? (
        <div
          className="flex flex-col items-center justify-center px-6 py-14 text-center sm:px-5 lg:px-7"
          role="alert"
        >
          <div className="bg-error-50 mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            <Icons.Warning size={22} strokeWidth={1.5} className="text-error-500" />
          </div>
          <p className="text-dark-500 text-[14px] font-medium">
            {t('pages.lawyerWorkplace.kanban.loadError.title', 'Could not load kanban tasks')}
          </p>
          <p className="text-light-600 mt-1 max-w-sm text-[12px] leading-relaxed">
            {t(
              'pages.lawyerWorkplace.kanban.loadError.description',
              'Check your connection and try again.'
            )}
          </p>
          <Button
            type="button"
            variant="cancel"
            size="sm"
            onClick={() => refetch()}
            className="mt-5 h-9 rounded-md"
          >
            {t('actions.retry', 'Retry')}
          </Button>
        </div>
      ) : null}

      {!isLoading && !isError && apiTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-14 text-center sm:px-5 lg:px-7">
          <div className="bg-light-100 mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            <Icons.KanbanIcon size={22} strokeWidth={1.5} className="text-light-500" />
          </div>
          <p className="text-dark-500 text-[14px] font-medium">
            {t('pages.lawyerWorkplace.kanban.empty.title', 'No tasks on the board yet')}
          </p>
          <p className="text-light-600 mt-1 max-w-sm text-[12px] leading-relaxed">
            {t(
              'pages.lawyerWorkplace.kanban.empty.description',
              'Confirm letters from the inbox or create a task manually to start tracking legal work.'
            )}
          </p>
        </div>
      ) : null}

      {!isLoading && !isError && apiTasks.length > 0 && filteredTaskCount === 0 ? (
        <div
          className="flex flex-col items-center justify-center px-6 py-14 text-center sm:px-5 lg:px-7"
          role="status"
        >
          <div className="bg-light-100 mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            <Icons.Filter size={22} strokeWidth={1.5} className="text-light-500" />
          </div>
          <p className="text-dark-500 text-[14px] font-medium">
            {t('pages.lawyerWorkplace.kanban.emptyFilter.title', 'No tasks match these filters')}
          </p>
          <p className="text-light-600 mt-1 max-w-sm text-[12px] leading-relaxed">
            {t(
              'pages.lawyerWorkplace.kanban.emptyFilter.description',
              'Try another lawyer, type, or deadline range.'
            )}
          </p>
          {hasActiveFilters ? (
            <Button
              type="button"
              variant="cancel"
              size="sm"
              onClick={clearFilters}
              className="mt-5 h-9 rounded-md"
            >
              {t('pages.lawyerWorkplace.kanban.emptyFilter.clearFilters', 'Clear filters')}
            </Button>
          ) : null}
        </div>
      ) : null}

      <div
        className={cn(
          'lawyer-workplace-scroll flex min-h-0 flex-1 flex-col overflow-y-auto',
          (isLoading || isError || apiTasks.length === 0 || filteredTaskCount === 0) && 'hidden',
          isKanbanGrid
            ? showWorkspaceBanner
              ? 'pb-24'
              : 'pb-6'
            : showWorkspaceBanner
              ? 'pb-36'
              : 'pb-20'
        )}
      >
        <div
          id={KANBAN_SCROLL_CONTAINER_ID}
          ref={scrollContainerRef}
          className={cn(
            'flex min-h-full flex-1 flex-col overscroll-x-contain',
            isKanbanGrid
              ? 'overflow-x-visible'
              : cn(
                  'overflow-x-auto scroll-smooth px-4 sm:px-5 lg:px-7',
                  '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
                )
          )}
        >
          <div
            className={cn(
              'flex min-h-full flex-1 pb-6',
              isKanbanGrid
                ? 'grid w-full grid-cols-4 grid-rows-1 gap-3 px-4 sm:px-5 lg:px-7'
                : 'flex min-h-full w-max snap-x snap-mandatory items-stretch gap-3 lg:gap-4'
            )}
          >
            {filteredColumns.map((col) => (
              <div
                key={col.id}
                className={cn(
                  'flex h-full min-h-0 flex-col',
                  isKanbanGrid
                    ? 'min-w-0 shrink'
                    : cn('shrink-0 snap-start', KANBAN_SCROLL_COLUMN_WIDTH_CLASS)
                )}
              >
                <div className="sticky top-0 z-10">
                  <KanbanColumnHeader column={col} />
                </div>
                <KanbanColumnLane
                  column={col}
                  lawyers={lawyers}
                  letterTypes={letterTypes}
                  draggingTaskId={draggingTaskId}
                  isDropTarget={dragOverColumn === col.id}
                  onCardClick={setThreadLetterId}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragOver={(event) => handleDragOver(event, col.id)}
                  onDragLeave={() => handleDragLeave(col.id)}
                  onDrop={(event) => handleDrop(event, col.id)}
                  onMoveTask={handleMoveTask}
                  onTaskUpdate={handleTaskUpdate}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {!isKanbanGrid && !isLoading && !isError && apiTasks.length > 0 && filteredTaskCount > 0 && (
        <KanbanBoardScrollNavigator
          scrollContainerRef={scrollContainerRef}
          columns={filteredColumns}
        />
      )}
    </div>
  )
}
