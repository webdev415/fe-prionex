/**
 * Board settings — one configuration editor (planner story 5.10; UX C-08,
 * `…/boards/:code/settings/:section`).
 *
 * - Open to whoever has `configure` in the board's `allowed_actions` (the board
 *   admin, `planner.admin`); anybody else reads «Немає прав на налаштування
 *   цієї дошки» on the direct address. The server decides; the page only reads
 *   the verdict.
 * - Sections on the left, the section on the right, the mini preview of the
 *   columns on top (it follows the draft). Moving between sections keeps the
 *   draft — it is one screen.
 * - The configuration sections edit one draft; «Зберегти» runs the server's
 *   check without writing (`dry_run`), puts its errors on their rows, and only
 *   then saves under `If-Match`. Leaving the settings with unsaved edits asks
 *   «Залишити без збереження?».
 * - Removing a status or a value of a list asks the server at once whether
 *   tasks use it: a status with tasks goes only together with a place for them
 *   («Перенести N задач у…»), a used value stays («Використовується в N
 *   задачах»).
 * - Participants are separate commands (each one saved at once), history and
 *   access are read only.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useBlocker, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Alert } from '@/components/ui/Alert'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { cn } from '@/lib/utils'
import { usePlannerBoard } from '@/api/planner/plannerQueries'
import { readPlannerError } from '@/api/planner/plannerErrors'
import type { PlannerBoard, PlannerBoardConfigError } from '@/api/planner/plannerApi'
import { PlannerBanners } from '../components/PlannerStates'
import { boardPath } from '../plannerFormat'
import {
  boardSettingsPath,
  countBySection,
  isSettingsSection,
  locateErrors,
  requestBody,
  restoreUsed,
  SETTINGS_SECTIONS,
  type ConfigDraft,
  type ConfigInput,
  type FieldInput,
  type LocatedError,
  type SettingsSection,
  type StatusInput,
} from './boardSettingsModel'
import { useConfigDraft } from './useConfigDraft'
import { useBoardConfigCommands, useConfigFailure } from './useBoardSettingsMutations'
import { ARCHIVE_BOARD_ACTION, useArchiveBoardCommand } from './archiveCommand'
import { ArchiveBoardSection } from './ArchiveBoardSection'
import { ColumnsPreview } from './ColumnsPreview'
import { MoveTasksDialog } from './MoveTasksDialog'
import { SaveBar } from './SaveBar'
import { SettingsSkeleton } from './SettingsSkeleton'
import { ErrorLines } from './settingsUi'
import { useFocusAfterRemove } from './useFocusAfterRemove'
import { AccessSection } from './sections/AccessSection'
import { DefaultsSection } from './sections/DefaultsSection'
import { FieldsSection } from './sections/FieldsSection'
import { GeneralSection } from './sections/GeneralSection'
import { HistorySection } from './sections/HistorySection'
import { LabelsSection } from './sections/LabelsSection'
import { MembersSection } from './sections/MembersSection'
import { PrioritiesSection } from './sections/PrioritiesSection'
import { StatusesSection } from './sections/StatusesSection'
import { TaskTypesSection } from './sections/TaskTypesSection'

/** The action that opens the editor (`Board.allowed_actions`). */
const CONFIGURE_ACTION = 'configure'

export function BoardSettingsPage() {
  const { t } = useTranslation('planner')
  const { code = '', section } = useParams()
  // No polling: the draft must not shift under the person's hands; somebody
  // else's change surfaces on save as a 412 (and on returning to the tab).
  const board = usePlannerBoard(code, true, { poll: false })

  if (!isSettingsSection(section)) {
    return <Navigate to={boardSettingsPath(code, 'general')} replace />
  }
  if (board.isPending) return <SettingsSkeleton />
  // Only with no card at all: a failed background refetch keeps the cached
  // card (TanStack v5 sets isError and keeps data), and swapping the editor
  // for an error screen then would throw away the unsaved draft.
  if (!board.data) {
    const { status } = readPlannerError(board.error)
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-foreground text-sm">
          {status === 404 ? t('board.notFound') : t('board.error')}
        </p>
        {status !== 404 && (
          <button
            type="button"
            className="text-primary text-sm hover:underline"
            onClick={() => void board.refetch()}
          >
            {t('settings.retry')}
          </button>
        )}
      </div>
    )
  }
  if (!board.data.allowed_actions.includes(CONFIGURE_ACTION)) {
    return <Alert variant="error">{t('settings.noRights')}</Alert>
  }
  // Another board's settings start from that board: a new draft, no old errors.
  return (
    <BoardSettingsEditor
      key={board.data.id}
      board={board.data}
      section={section}
      refreshFailed={board.isError}
    />
  )
}

interface MoveRequest {
  status: StatusInput
  count: number
  /** Asked by «Зберегти» (continue saving) or by the remove button (just remove). */
  thenSave: boolean
}

/** A default of a list field without one of its values. */
function withoutOption(value: FieldInput['default'], optionId: string): FieldInput['default'] {
  if (value === optionId) return null
  if (Array.isArray(value)) {
    const rest = value.filter((id) => id !== optionId)
    return rest.length > 0 ? rest : null
  }
  return value ?? null
}

function BoardSettingsEditor({
  board,
  section,
  refreshFailed,
}: {
  board: PlannerBoard
  section: SettingsSection
  /** The last refetch of the board failed; the draft stays, a banner says so. */
  refreshFailed: boolean
}) {
  const { t } = useTranslation('planner')
  const draft = useConfigDraft(board)
  const { preview, save } = useBoardConfigCommands(board.code)
  const failed = useConfigFailure(board.code)
  const archive = useArchiveBoardCommand(board.code)
  const [errors, setErrors] = useState<LocatedError[]>([])
  const [inUse, setInUse] = useState<ReadonlyMap<string, number>>(new Map())
  const [checkingStatus, setCheckingStatus] = useState<string | null>(null)
  const [checkingOption, setCheckingOption] = useState<string | null>(null)
  const [moving, setMoving] = useState<MoveRequest | null>(null)
  const busy = preview.isPending || save.isPending
  const { dirty } = draft
  const settingsRoot = `${boardPath(board.code)}/settings/`

  // «Залишити без збереження?» — for a move out of this board's settings
  // (a section to a section is the same screen and keeps the draft).
  const blocker = useBlocker(
    ({ nextLocation }) => dirty && !nextLocation.pathname.startsWith(settingsRoot)
  )
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])
  useFocusAfterRemove()

  const current = draft.draft
  const saved = draft.saved
  const base = draft.base
  if (!current || !saved || !base) return <SettingsSkeleton />

  /**
   * What tasks use cannot go (`*_in_use`): an element the draft dropped comes
   * back to its row with «Використовується в N задачах» next to it.
   */
  const keepUsed = (located: LocatedError[]) => {
    const options = located.filter((error) => error.reason === 'option_in_use' && error.id)
    if (options.length > 0) {
      setInUse((prev) => {
        const next = new Map(prev)
        for (const error of options) next.set(error.id as string, error.usedCount ?? 0)
        return next
      })
    }
    if (located.some((error) => error.reason.endsWith('_in_use'))) {
      draft.update((config) => restoreUsed(config, saved, located))
    }
  }

  const showErrors = (found: PlannerBoardConfigError[] | null, sent: ConfigInput) => {
    if (!found) return
    const located = locateErrors(found, sent)
    keepUsed(located)
    setErrors(located)
  }

  const runSave = async (next: ConfigDraft) => {
    const version = base.version
    const body = requestBody(next)
    setErrors([])
    let check
    try {
      check = await preview.mutateAsync({ version, body })
    } catch (error) {
      showErrors(failed(error), body.config)
      return
    }
    if (!check.valid) {
      const located = locateErrors(check.errors, body.config)
      const withTasks = located.find(
        (error) => error.reason === 'status_in_use' && error.id !== undefined
      )
      const status = withTasks && saved.statuses.find((item) => item.id === withTasks.id)
      if (withTasks && status) {
        setMoving({ status, count: withTasks.usedCount ?? 0, thenSave: true })
        return
      }
      keepUsed(located)
      setErrors(located)
      toast.error(t('settings.toast.fixErrors'))
      return
    }
    try {
      const savedBoard = await save.mutateAsync({ version, body })
      draft.saveDone(savedBoard)
      setErrors([])
      setInUse(new Map())
      toast.success(t('settings.toast.saved'))
    } catch (error) {
      showErrors(failed(error), body.config)
    }
  }

  const removeStatus = async (status: StatusInput) => {
    const without = (config: ConfigInput): ConfigInput => ({
      ...config,
      statuses: config.statuses.filter((item) => item.id !== status.id),
    })
    // A status that is not saved yet holds no tasks.
    if (!saved.statuses.some((item) => item.id === status.id)) {
      draft.update(without)
      return
    }
    setCheckingStatus(status.id)
    try {
      const check = await preview.mutateAsync({
        version: base.version,
        body: requestBody({ ...current, config: without(current.config) }),
      })
      const hit = check.errors.find(
        (error) => error.reason === 'status_in_use' && error.id === status.id
      )
      if (hit) setMoving({ status, count: hit.used_count ?? 0, thenSave: false })
      else draft.update(without)
    } catch (error) {
      // Could not ask (no connection, a newer version): remove in the draft —
      // «Зберегти» asks again before anything is written.
      failed(error)
      draft.update(without)
    } finally {
      setCheckingStatus(null)
    }
  }

  const removeOption = async (fieldId: string, optionId: string) => {
    const without = (config: ConfigInput): ConfigInput => ({
      ...config,
      fields: config.fields.map((field) =>
        field.id === fieldId
          ? {
              ...field,
              options: (field.options ?? []).filter((option) => option.id !== optionId),
              default: withoutOption(field.default, optionId),
            }
          : field
      ),
    })
    const savedField = saved.fields.find((field) => field.id === fieldId)
    if (!savedField?.options?.some((option) => option.id === optionId)) {
      draft.update(without)
      return
    }
    setCheckingOption(optionId)
    try {
      const check = await preview.mutateAsync({
        version: base.version,
        body: requestBody({ ...current, config: without(current.config) }),
      })
      const hit = check.errors.find(
        (error) => error.reason === 'option_in_use' && error.id === optionId
      )
      if (hit) setInUse((prev) => new Map(prev).set(optionId, hit.used_count ?? 0))
      else draft.update(without)
    } catch (error) {
      failed(error)
      draft.update(without)
    } finally {
      setCheckingOption(null)
    }
  }

  const confirmMove = (targetId: string) => {
    if (!moving) return
    const { status, thenSave } = moving
    setMoving(null)
    const config = {
      ...current.config,
      statuses: current.config.statuses.filter((item) => item.id !== status.id),
    }
    draft.update(() => config)
    draft.setMove(status.id, targetId)
    if (thenSave) void runSave({ config, moves: { ...current.moves, [status.id]: targetId } })
  }

  /**
   * «Скасувати» of «Перенести N задач у…». Asked by «Зберегти», the status had
   * already left the draft: it comes back to its row with the reason, so the
   * refusal is not silent (asked by the remove button, it never left).
   */
  const cancelMove = () => {
    if (!moving) return
    const { status, count, thenSave } = moving
    setMoving(null)
    if (!thenSave) return
    draft.update((config) => {
      if (config.statuses.some((item) => item.id === status.id)) return config
      const index = saved.statuses.findIndex((item) => item.id === status.id)
      const statuses = [...config.statuses]
      statuses.splice(index < 0 ? statuses.length : Math.min(index, statuses.length), 0, status)
      return { ...config, statuses }
    })
    setErrors([
      {
        section: 'statuses',
        rowId: status.id,
        optionId: null,
        key: null,
        reason: 'status_in_use',
        usedCount: count,
        id: status.id,
      },
    ])
  }

  const counts = countBySection(errors)
  const sectionProps = {
    config: current.config,
    saved,
    board,
    errors,
    onChange: draft.update,
  }

  return (
    <section className="space-y-4" aria-labelledby="planner-settings-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="planner-settings-title" className="text-foreground text-base font-semibold">
          <span className="text-muted-foreground mr-2 font-mono text-sm">{board.code}</span>
          {board.name}
          <span className="text-muted-foreground"> · {t('settings.title')}</span>
        </h2>
        <Link to={boardPath(board.code)} className="text-primary text-sm hover:underline">
          {t('settings.backToBoard')}
        </Link>
      </div>

      <ColumnsPreview statuses={current.config.statuses} />

      <PlannerBanners
        banners={[
          ...(draft.conflict
            ? [
                {
                  reason: 'config-conflict',
                  tone: 'warning' as const,
                  text: t('settings.conflict'),
                },
              ]
            : []),
          ...(refreshFailed
            ? [
                {
                  reason: 'board-refresh-failed',
                  tone: 'warning' as const,
                  text: t('settings.refreshFailed'),
                },
              ]
            : []),
        ]}
      />
      <ErrorLines errors={errors.filter((error) => error.section === null)} />

      <div className="flex flex-col gap-6 md:flex-row">
        <nav aria-label={t('settings.navLabel')} className="md:w-56 md:shrink-0">
          <ul className="space-y-0.5">
            {SETTINGS_SECTIONS.map((item) => {
              const count = counts.get(item) ?? 0
              const active = item === section
              return (
                <li key={item}>
                  <Link
                    to={boardSettingsPath(board.code, item)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-md px-3 py-1.5 text-sm',
                      active
                        ? 'bg-muted text-foreground font-medium'
                        : 'text-foreground hover:bg-muted'
                    )}
                  >
                    <span>{t(`settings.sections.${item}`)}</span>
                    {count > 0 && (
                      <span className="bg-error-50 text-error-700 rounded-full px-1.5 text-xs tabular-nums">
                        <span aria-hidden="true">{count}</span>
                        <span className="sr-only">{t('settings.errorsInSection', { count })}</span>
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="min-w-0 flex-1 space-y-4">
          {section === 'general' && <GeneralSection board={board} />}
          {section === 'statuses' && (
            <StatusesSection
              {...sectionProps}
              onRemove={removeStatus}
              checkingId={checkingStatus}
            />
          )}
          {section === 'types' && <TaskTypesSection {...sectionProps} />}
          {section === 'fields' && (
            <FieldsSection
              {...sectionProps}
              onRemoveOption={removeOption}
              inUse={inUse}
              checkingOptionId={checkingOption}
            />
          )}
          {section === 'labels' && <LabelsSection {...sectionProps} />}
          {section === 'priorities' && <PrioritiesSection {...sectionProps} />}
          {section === 'defaults' && <DefaultsSection {...sectionProps} />}
          {section === 'members' && <MembersSection board={board} />}
          {section === 'access' && <AccessSection board={board} />}
          {section === 'history' && <HistorySection board={board} />}

          {/* Allowed by the server AND a command to call (none before the 3.19 contract). */}
          {archive && board.allowed_actions.includes(ARCHIVE_BOARD_ACTION) && (
            <ArchiveBoardSection command={archive} />
          )}
        </div>
      </div>

      {/* Always in the DOM: says that the bar of unsaved changes has appeared. */}
      <p className="sr-only" aria-live="polite" data-save-announcer="">
        {dirty ? t('settings.saveBar.announce') : ''}
      </p>
      {dirty && (
        <SaveBar
          busy={busy}
          onCancel={() => {
            draft.reset()
            setErrors([])
            setInUse(new Map())
          }}
          onSave={() => void runSave(current)}
        />
      )}

      {moving && (
        <MoveTasksDialog
          status={moving.status}
          count={moving.count}
          targets={current.config.statuses.filter(
            (item) => item.id !== moving.status.id && !item.requires_reason
          )}
          onConfirm={confirmMove}
          onClose={cancelMove}
        />
      )}

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title={t('settings.leave.title')}
        message={t('settings.leave.message')}
        confirmLabel={t('settings.leave.confirm')}
        cancelLabel={t('settings.leave.cancel')}
        tone="danger"
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </section>
  )
}

export default BoardSettingsPage
