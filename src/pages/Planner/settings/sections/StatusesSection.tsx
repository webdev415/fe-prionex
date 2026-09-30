/**
 * «Статуси» (planner story 5.10, AC1–AC2; UX C-08, FR-8).
 *
 * A row per status in board order: the grip to drag it, «Вище / Нижче» for
 * the keyboard, name, category, SLA mode `Іде · Пауза · Вимкнено`, «за
 * замовчуванням», «Повідомити автора», «Потребує причини». Changing the SLA
 * mode of a saved status says when it takes effect. Removing a status is the
 * page's business: it asks the server whether the status holds tasks and, if
 * so, where they go («Перенести N задач у…»).
 */
import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import { CATEGORY_DOT } from '../../plannerTones'
import {
  errorsOfRow,
  errorsOfSection,
  moveItem,
  newElementId,
  reorderItem,
  type ConfigSectionProps,
  type StatusInput,
} from '../boardSettingsModel'
import { useSettingsText } from '../settingsText'
import {
  AddButton,
  DragHandle,
  ErrorLines,
  OrderButtons,
  RemoveButton,
  SectionHeading,
  SettingsSelect,
} from '../settingsUi'
import { useOrderAnnouncer } from '../useOrderAnnouncer'

const CATEGORIES: StatusInput['category'][] = ['todo', 'in_progress', 'done']
const SLA_MODES: StatusInput['sla_mode'][] = ['running', 'paused', 'off']

interface StatusesSectionProps extends ConfigSectionProps {
  /** Remove a status — the page checks for tasks first. */
  onRemove: (status: StatusInput) => void
  /** The status whose removal is being checked right now. */
  checkingId: string | null
}

export function StatusesSection({
  config,
  saved,
  errors,
  onChange,
  onRemove,
  checkingId,
}: StatusesSectionProps) {
  const { t } = useSettingsText()
  const [dragging, setDragging] = useState<number | null>(null)
  const [orderRegion, announceOrder] = useOrderAnnouncer()
  const statuses = config.statuses
  const savedModes = new Map(saved.statuses.map((status) => [status.id, status.sla_mode]))

  const setStatuses = (change: (items: StatusInput[]) => StatusInput[]) =>
    onChange((current) => ({ ...current, statuses: change(current.statuses) }))
  const move = (index: number, step: -1 | 1) => {
    setStatuses((items) => moveItem(items, index, step))
    announceOrder(
      t('settings.common.movedTo', {
        name: statuses[index].name,
        position: index + step + 1,
        total: statuses.length,
      })
    )
  }
  const patch = (id: string, values: Partial<StatusInput>) =>
    setStatuses((items) => items.map((item) => (item.id === id ? { ...item, ...values } : item)))

  return (
    <section className="space-y-3" aria-labelledby="planner-settings-statuses">
      <SectionHeading id="planner-settings-statuses" title={t('settings.sections.statuses')} />
      <ErrorLines errors={errorsOfSection(errors, 'statuses')} />
      {orderRegion}

      <ol className="space-y-2">
        {statuses.map((status, index) => {
          const rowErrors = errorsOfRow(errors, status.id)
          const nameError = rowErrors.find((error) => error.key === 'name')
          const categoryError = rowErrors.find((error) => error.key === 'category')
          const describedBy = rowErrors.length > 0 ? `status-errors-${status.id}` : undefined
          const savedMode = savedModes.get(status.id)
          const modeChanged = savedMode !== undefined && savedMode !== status.sla_mode
          return (
            <li
              key={status.id}
              data-status-row={status.id}
              onDragOver={(event) => {
                if (dragging !== null) event.preventDefault()
              }}
              onDrop={(event) => {
                event.preventDefault()
                if (dragging !== null) setStatuses((items) => reorderItem(items, dragging, index))
                setDragging(null)
              }}
              className={cn(
                'border-border bg-card space-y-2 rounded-lg border p-2',
                dragging === index && 'opacity-60',
                checkingId === status.id && 'opacity-60'
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <DragHandle
                  label={t('settings.common.dragHandle')}
                  onDragStart={(event) => {
                    // Firefox starts a drag only with some data set.
                    if (event.dataTransfer) {
                      event.dataTransfer.effectAllowed = 'move'
                      event.dataTransfer.setData('text/plain', status.id)
                    }
                    setDragging(index)
                  }}
                  onDragEnd={() => setDragging(null)}
                />
                <OrderButtons
                  upLabel={t('settings.common.moveUp', { name: status.name })}
                  downLabel={t('settings.common.moveDown', { name: status.name })}
                  first={index === 0}
                  last={index === statuses.length - 1}
                  onUp={() => move(index, -1)}
                  onDown={() => move(index, 1)}
                />
                <span
                  aria-hidden="true"
                  className={cn('h-2 w-2 shrink-0 rounded-full', CATEGORY_DOT[status.category])}
                />
                <div className="w-48">
                  <Input
                    inputSize="sm"
                    aria-label={t('settings.statuses.nameLabel')}
                    value={status.name}
                    variant={nameError ? 'error' : 'default'}
                    aria-invalid={Boolean(nameError)}
                    aria-describedby={describedBy}
                    onChange={(event) => patch(status.id, { name: event.target.value })}
                  />
                </div>
                <SettingsSelect
                  aria-label={t('settings.statuses.category')}
                  aria-invalid={Boolean(categoryError)}
                  aria-describedby={describedBy}
                  value={status.category}
                  onChange={(event) =>
                    patch(status.id, { category: event.target.value as StatusInput['category'] })
                  }
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {t(`settings.statuses.categories.${category}`)}
                    </option>
                  ))}
                </SettingsSelect>
                <RemoveButton
                  label={t('settings.common.removeItem', { name: status.name })}
                  disabled={checkingId !== null}
                  onClick={() => onRemove(status)}
                />
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-14 text-xs">
                <fieldset className="flex items-center gap-2">
                  <legend className="text-muted-foreground float-left mr-1">
                    {t('settings.statuses.slaMode')}
                  </legend>
                  {SLA_MODES.map((mode) => (
                    <label key={mode} className="text-foreground inline-flex items-center gap-1">
                      <input
                        type="radio"
                        className="accent-primary"
                        name={`sla-mode-${status.id}`}
                        value={mode}
                        checked={status.sla_mode === mode}
                        onChange={() => patch(status.id, { sla_mode: mode })}
                      />
                      {t(`settings.statuses.slaModes.${mode}`)}
                    </label>
                  ))}
                </fieldset>
                <label className="text-foreground inline-flex items-center gap-1">
                  <input
                    type="radio"
                    className="accent-primary"
                    name="planner-default-status"
                    checked={status.default === true}
                    onChange={() =>
                      setStatuses((items) =>
                        items.map((item) => ({ ...item, default: item.id === status.id }))
                      )
                    }
                  />
                  {t('settings.common.default')}
                </label>
                <label className="text-foreground inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    className="accent-primary"
                    checked={status.notify_author === true}
                    onChange={(event) => patch(status.id, { notify_author: event.target.checked })}
                  />
                  {t('settings.statuses.notifyAuthor')}
                </label>
                <label className="text-foreground inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    className="accent-primary"
                    checked={status.requires_reason === true}
                    onChange={(event) =>
                      patch(status.id, { requires_reason: event.target.checked })
                    }
                  />
                  {t('settings.statuses.requiresReason')}
                </label>
              </div>

              {modeChanged && (
                <p className="text-warning-700 pl-14 text-xs">
                  {t('settings.statuses.slaWarning')}
                </p>
              )}
              {/* Always in the DOM: a live region born with its text is often not read. */}
              <p
                className={
                  checkingId === status.id ? 'text-muted-foreground pl-14 text-xs' : 'sr-only'
                }
                aria-live="polite"
              >
                {checkingId === status.id ? t('settings.statuses.checking') : ''}
              </p>
              <div className="pl-14">
                <ErrorLines errors={rowErrors} id={`status-errors-${status.id}`} />
              </div>
            </li>
          )
        })}
      </ol>

      <AddButton
        onClick={() =>
          setStatuses((items) => [
            ...items,
            {
              id: newElementId(),
              name: t('settings.statuses.newName'),
              category: 'todo',
              sla_mode: 'running',
              default: false,
              notify_author: false,
              requires_reason: false,
            },
          ])
        }
      >
        {t('settings.statuses.add')}
      </AddButton>
    </section>
  )
}

export default StatusesSection
