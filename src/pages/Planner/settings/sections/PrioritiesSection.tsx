/**
 * «Пріоритети» (planner story 5.10, AC1; UX C-08, FR-9): the board's scale of
 * 3–5 levels — name, order (lowest first, as the priority icon of 5.1 reads
 * it: only the top level is coloured), «за замовчуванням». The scale's size
 * is the server's rule; the client only stops adding a sixth level (the
 * contract's limit, `PLANNER_PRIORITIES_MAX`).
 */
import { Input } from '@/components/ui/Input'
import { PLANNER_PRIORITIES_MAX } from '@/api/planner/plannerApi'
import {
  errorsOfRow,
  errorsOfSection,
  moveItem,
  newElementId,
  type ConfigSectionProps,
  type PriorityInput,
} from '../boardSettingsModel'
import { useSettingsText } from '../settingsText'
import { AddButton, ErrorLines, OrderButtons, RemoveButton, SectionHeading } from '../settingsUi'
import { useOrderAnnouncer } from '../useOrderAnnouncer'

export function PrioritiesSection({ config, errors, onChange }: ConfigSectionProps) {
  const { t } = useSettingsText()
  const levels = config.priorities
  const setLevels = (change: (items: PriorityInput[]) => PriorityInput[]) =>
    onChange((current) => ({ ...current, priorities: change(current.priorities) }))
  const [orderRegion, announceOrder] = useOrderAnnouncer()
  const move = (index: number, step: -1 | 1) => {
    setLevels((items) => moveItem(items, index, step))
    announceOrder(
      t('settings.common.movedTo', {
        name: levels[index].name,
        position: index + step + 1,
        total: levels.length,
      })
    )
  }

  return (
    <section className="space-y-3" aria-labelledby="planner-settings-priorities">
      <SectionHeading
        id="planner-settings-priorities"
        title={t('settings.sections.priorities')}
        hint={t('settings.priorities.hint')}
      />
      <ErrorLines errors={errorsOfSection(errors, 'priorities')} />
      {orderRegion}
      {levels.length === 0 && (
        <p className="text-muted-foreground text-sm">{t('settings.priorities.empty')}</p>
      )}
      <ol className="space-y-2">
        {levels.map((level, index) => {
          const rowErrors = errorsOfRow(errors, level.id)
          return (
            <li key={level.id} data-priority-row={level.id} className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <OrderButtons
                  upLabel={t('settings.common.moveUp', { name: level.name })}
                  downLabel={t('settings.common.moveDown', { name: level.name })}
                  first={index === 0}
                  last={index === levels.length - 1}
                  onUp={() => move(index, -1)}
                  onDown={() => move(index, 1)}
                />
                <div className="w-56">
                  <Input
                    inputSize="sm"
                    aria-label={t('settings.priorities.nameLabel')}
                    value={level.name}
                    variant={rowErrors.length > 0 ? 'error' : 'default'}
                    aria-invalid={rowErrors.length > 0}
                    aria-describedby={
                      rowErrors.length > 0 ? `priority-errors-${level.id}` : undefined
                    }
                    onChange={(event) =>
                      setLevels((items) =>
                        items.map((item) =>
                          item.id === level.id ? { ...item, name: event.target.value } : item
                        )
                      )
                    }
                  />
                </div>
                <label className="text-foreground inline-flex items-center gap-1 text-xs">
                  <input
                    type="radio"
                    className="accent-primary"
                    name="planner-default-priority"
                    checked={level.default === true}
                    onChange={() =>
                      setLevels((items) =>
                        items.map((item) => ({ ...item, default: item.id === level.id }))
                      )
                    }
                  />
                  {t('settings.common.default')}
                </label>
                <RemoveButton
                  label={t('settings.common.removeItem', { name: level.name })}
                  onClick={() => setLevels((items) => items.filter((item) => item.id !== level.id))}
                />
              </div>
              <ErrorLines errors={rowErrors} id={`priority-errors-${level.id}`} />
            </li>
          )
        })}
      </ol>
      <AddButton
        disabled={levels.length >= PLANNER_PRIORITIES_MAX}
        onClick={() =>
          setLevels((items) => [
            ...items,
            {
              id: newElementId(),
              name: t('settings.priorities.newName'),
              default: items.length === 0,
            },
          ])
        }
      >
        {t('settings.priorities.add')}
      </AddButton>
    </section>
  )
}

export default PrioritiesSection
