/**
 * «Мітки» (planner story 5.10, AC1; UX C-08, FR-9): add, rename, remove.
 * Labels have no colour in P1 (U-23) — there is nothing to pick but a name.
 */
import { Input } from '@/components/ui/Input'
import {
  errorsOfRow,
  errorsOfSection,
  newElementId,
  type ConfigSectionProps,
  type LabelInput,
} from '../boardSettingsModel'
import { useSettingsText } from '../settingsText'
import { AddButton, ErrorLines, RemoveButton, SectionHeading } from '../settingsUi'

export function LabelsSection({ config, errors, onChange }: ConfigSectionProps) {
  const { t } = useSettingsText()
  const setLabels = (change: (items: LabelInput[]) => LabelInput[]) =>
    onChange((current) => ({ ...current, labels: change(current.labels) }))

  return (
    <section className="space-y-3" aria-labelledby="planner-settings-labels">
      <SectionHeading
        id="planner-settings-labels"
        title={t('settings.sections.labels')}
        hint={t('settings.labels.hint')}
      />
      <ErrorLines errors={errorsOfSection(errors, 'labels')} />
      {config.labels.length === 0 && (
        <p className="text-muted-foreground text-sm">{t('settings.labels.empty')}</p>
      )}
      <ul className="space-y-2">
        {config.labels.map((label) => {
          const rowErrors = errorsOfRow(errors, label.id)
          return (
            <li key={label.id} data-label-row={label.id} className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-64">
                  <Input
                    inputSize="sm"
                    aria-label={t('settings.labels.nameLabel')}
                    value={label.name}
                    variant={rowErrors.length > 0 ? 'error' : 'default'}
                    aria-invalid={rowErrors.length > 0}
                    aria-describedby={rowErrors.length > 0 ? `label-errors-${label.id}` : undefined}
                    onChange={(event) =>
                      setLabels((items) =>
                        items.map((item) =>
                          item.id === label.id ? { ...item, name: event.target.value } : item
                        )
                      )
                    }
                  />
                </div>
                <RemoveButton
                  label={t('settings.common.removeItem', { name: label.name })}
                  onClick={() => setLabels((items) => items.filter((item) => item.id !== label.id))}
                />
              </div>
              <ErrorLines errors={rowErrors} id={`label-errors-${label.id}`} />
            </li>
          )
        })}
      </ul>
      <AddButton
        onClick={() =>
          setLabels((items) => [
            ...items,
            { id: newElementId(), name: t('settings.labels.newName') },
          ])
        }
      >
        {t('settings.labels.add')}
      </AddButton>
    </section>
  )
}

export default LabelsSection
