/**
 * «Типи задач і SLA» (planner story 5.10, AC1; UX C-08, FR-10, FR-25).
 *
 * A row per type: name, SLA norm (a number and «год / дн», or «Без SLA»), how
 * the clock counts (`Календарний час · Лише будні`), initial status, default
 * assignee, «за замовчуванням». A changed norm applies to new tasks only —
 * the hint says so. What is valid (1–8760 hours, 1–365 days, the initial
 * status not «Готово» and without a reason, the assignee a participant) is the
 * server's answer on save; a norm left empty is not sent — «Вкажіть норму» on
 * its row (`emptySlaNorms`).
 */
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import { piiProps } from '@/lib/openreplay/pii'
import { personName } from '../../plannerFormat'
import {
  errorsOfRow,
  errorsOfSection,
  newElementId,
  type ConfigSectionProps,
  type TaskTypeInput,
} from '../boardSettingsModel'
import { useSettingsText } from '../settingsText'
import { AddButton, ErrorLines, RemoveButton, SectionHeading, SettingsSelect } from '../settingsUi'

type Norm = NonNullable<TaskTypeInput['sla']>

const DEFAULT_NORM: Norm = { value: 48, unit: 'hours', calendar: 'calendar' }

export function TaskTypesSection({ config, board, errors, onChange }: ConfigSectionProps) {
  const { t } = useSettingsText()
  const types = config.task_types
  // Initial status: a status of this configuration, not «Готово», without a reason.
  const initialChoices = config.statuses.filter(
    (status) => status.category !== 'done' && !status.requires_reason
  )

  const setTypes = (change: (items: TaskTypeInput[]) => TaskTypeInput[]) =>
    onChange((current) => ({ ...current, task_types: change(current.task_types) }))
  const patch = (id: string, values: Partial<TaskTypeInput>) =>
    setTypes((items) => items.map((item) => (item.id === id ? { ...item, ...values } : item)))

  return (
    <section className="space-y-3" aria-labelledby="planner-settings-types">
      <SectionHeading
        id="planner-settings-types"
        title={t('settings.sections.types')}
        hint={t('settings.types.hint')}
      />
      <ErrorLines errors={errorsOfSection(errors, 'types')} />

      <ul className="space-y-2">
        {types.map((type) => {
          const rowErrors = errorsOfRow(errors, type.id)
          const normError = rowErrors.some((error) => error.key === 'sla')
          const norm = type.sla ?? null
          const setNorm = (values: Partial<Norm>) =>
            patch(type.id, { sla: { ...(norm ?? DEFAULT_NORM), ...values } })
          return (
            <li
              key={type.id}
              data-type-row={type.id}
              className="border-border bg-card space-y-2 rounded-lg border p-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-48">
                  <Input
                    inputSize="sm"
                    aria-label={t('settings.types.nameLabel')}
                    value={type.name}
                    variant={rowErrors.some((e) => e.key === 'name') ? 'error' : 'default'}
                    aria-invalid={rowErrors.some((e) => e.key === 'name')}
                    aria-describedby={rowErrors.length > 0 ? `type-errors-${type.id}` : undefined}
                    onChange={(event) => patch(type.id, { name: event.target.value })}
                  />
                </div>
                <label className="text-foreground inline-flex items-center gap-1 text-xs">
                  <input
                    type="radio"
                    className="accent-primary"
                    name="planner-default-type"
                    checked={type.default === true}
                    onChange={() =>
                      setTypes((items) =>
                        items.map((item) => ({ ...item, default: item.id === type.id }))
                      )
                    }
                  />
                  {t('settings.common.default')}
                </label>
                <RemoveButton
                  label={t('settings.common.removeItem', { name: type.name })}
                  onClick={() => setTypes((items) => items.filter((item) => item.id !== type.id))}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <label className="text-foreground inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    className="accent-primary"
                    checked={norm === null}
                    onChange={(event) =>
                      patch(type.id, { sla: event.target.checked ? null : DEFAULT_NORM })
                    }
                  />
                  {t('settings.types.noSla')}
                </label>
                {norm && (
                  <>
                    <input
                      type="number"
                      min={1}
                      aria-label={t('settings.types.slaValue')}
                      aria-invalid={normError}
                      aria-describedby={rowErrors.length > 0 ? `type-errors-${type.id}` : undefined}
                      className={cn(
                        'border-input-border bg-input text-foreground h-8 w-20 rounded-lg border px-2 text-xs',
                        normError && 'border-error-500'
                      )}
                      value={Number.isFinite(norm.value) ? norm.value : ''}
                      // An emptied field stays empty while the number is retyped (not «0»).
                      onChange={(event) =>
                        setNorm({
                          value:
                            event.target.value === '' ? Number.NaN : Number(event.target.value),
                        })
                      }
                    />
                    <SettingsSelect
                      aria-label={t('settings.types.unit')}
                      value={norm.unit}
                      onChange={(event) => setNorm({ unit: event.target.value as Norm['unit'] })}
                    >
                      <option value="hours">{t('settings.types.units.hours')}</option>
                      <option value="days">{t('settings.types.units.days')}</option>
                    </SettingsSelect>
                    <SettingsSelect
                      aria-label={t('settings.types.calendar')}
                      value={norm.calendar}
                      onChange={(event) =>
                        setNorm({ calendar: event.target.value as Norm['calendar'] })
                      }
                    >
                      <option value="calendar">{t('settings.types.calendars.calendar')}</option>
                      <option value="weekdays">{t('settings.types.calendars.weekdays')}</option>
                    </SettingsSelect>
                  </>
                )}
                <SettingsSelect
                  aria-label={t('settings.types.initialStatus')}
                  value={type.initial_status_id ?? ''}
                  onChange={(event) =>
                    patch(type.id, { initial_status_id: event.target.value || null })
                  }
                >
                  <option value="">{t('settings.types.boardDefaultStatus')}</option>
                  {initialChoices.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.name}
                    </option>
                  ))}
                </SettingsSelect>
                <span {...piiProps}>
                  <SettingsSelect
                    aria-label={t('settings.types.defaultAssignee')}
                    value={type.default_assignee_id ?? ''}
                    onChange={(event) =>
                      patch(type.id, { default_assignee_id: event.target.value || null })
                    }
                  >
                    <option value="">{t('settings.types.noAssignee')}</option>
                    {board.members.map((member) => (
                      <option key={member.user_id} value={member.user_id}>
                        {personName(member)}
                      </option>
                    ))}
                    {type.default_assignee_id &&
                      !board.members.some((m) => m.user_id === type.default_assignee_id) && (
                        <option value={type.default_assignee_id}>
                          {t('settings.common.otherPerson')}
                        </option>
                      )}
                  </SettingsSelect>
                </span>
              </div>
              <ErrorLines errors={rowErrors} id={`type-errors-${type.id}`} />
            </li>
          )
        })}
      </ul>

      <AddButton
        onClick={() =>
          setTypes((items) => [
            ...items,
            {
              id: newElementId(),
              name: t('settings.types.newName'),
              default: items.length === 0,
              sla: null,
              initial_status_id: null,
              default_assignee_id: null,
            },
          ])
        }
      >
        {t('settings.types.add')}
      </AddButton>
    </section>
  )
}

export default TaskTypesSection
