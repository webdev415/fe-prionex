/**
 * «Виконавець, чек-лист, опис» (planner story 5.10, AC1; UX C-08, FR-10): the
 * default assignee of a new task (a participant of the board — the server
 * checks), the checklist copied into a new task and the description template.
 * An empty template is «no template» (`null`): the contract refuses `""`.
 */
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { piiProps } from '@/lib/openreplay/pii'
import { personName } from '../../plannerFormat'
import { errorsOfSection, type ConfigSectionProps, type DefaultsInput } from '../boardSettingsModel'
import { useSettingsText } from '../settingsText'
import { AddButton, ErrorLines, RemoveButton, SectionHeading, SettingsSelect } from '../settingsUi'

export function DefaultsSection({ config, board, errors, onChange }: ConfigSectionProps) {
  const { t } = useSettingsText()
  const defaults = config.defaults
  const checklist = defaults.checklist ?? []
  const sectionErrors = errorsOfSection(errors, 'defaults')
  const errorsOf = (key: string) => sectionErrors.filter((error) => error.key === key)
  const rest = sectionErrors.filter(
    (error) => !['assignee_id', 'checklist', 'description_template'].includes(error.key ?? '')
  )
  const patch = (values: Partial<DefaultsInput>) =>
    onChange((current) => ({ ...current, defaults: { ...current.defaults, ...values } }))
  const assignee = defaults.assignee_id ?? ''
  /** A field's errors are tied to it for a screen reader (as the names of the rows). */
  const aria = (name: string, id: string) =>
    errorsOf(name).length > 0
      ? { 'aria-invalid': true, 'aria-describedby': id }
      : { 'aria-invalid': false }

  return (
    <section className="space-y-4" aria-labelledby="planner-settings-defaults">
      <SectionHeading id="planner-settings-defaults" title={t('settings.sections.defaults')} />
      <ErrorLines errors={rest} />

      <div className="space-y-1">
        <label htmlFor="planner-default-assignee" className="text-foreground block text-sm">
          {t('settings.defaults.assignee')}
        </label>
        <span {...piiProps}>
          <SettingsSelect
            id="planner-default-assignee"
            {...aria('assignee_id', 'planner-default-assignee-errors')}
            value={assignee}
            onChange={(event) => patch({ assignee_id: event.target.value || null })}
          >
            <option value="">{t('settings.defaults.noAssignee')}</option>
            {board.members.map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {personName(member)}
              </option>
            ))}
            {assignee && !board.members.some((m) => m.user_id === assignee) && (
              <option value={assignee}>{t('settings.common.otherPerson')}</option>
            )}
          </SettingsSelect>
        </span>
        <ErrorLines errors={errorsOf('assignee_id')} id="planner-default-assignee-errors" />
      </div>

      <div className="space-y-2">
        <p className="text-foreground text-sm">{t('settings.defaults.checklist')}</p>
        <ol className="space-y-1">
          {checklist.map((item, index) => (
            <li key={index} className="flex items-center gap-2">
              <div className="w-80">
                <Input
                  inputSize="sm"
                  aria-label={t('settings.defaults.item', { n: index + 1 })}
                  aria-describedby={
                    errorsOf('checklist').length > 0
                      ? 'planner-default-checklist-errors'
                      : undefined
                  }
                  value={item}
                  onChange={(event) =>
                    patch({
                      checklist: checklist.map((text, i) =>
                        i === index ? event.target.value : text
                      ),
                    })
                  }
                />
              </div>
              <RemoveButton
                label={t('settings.defaults.removeItem', { n: index + 1 })}
                onClick={() => patch({ checklist: checklist.filter((_, i) => i !== index) })}
              />
            </li>
          ))}
        </ol>
        <AddButton onClick={() => patch({ checklist: [...checklist, ''] })}>
          {t('settings.defaults.addItem')}
        </AddButton>
        <ErrorLines errors={errorsOf('checklist')} id="planner-default-checklist-errors" />
      </div>

      <div className="space-y-1">
        <Textarea
          label={t('settings.defaults.description')}
          {...aria('description_template', 'planner-default-description-errors')}
          value={defaults.description_template ?? ''}
          onChange={(event) =>
            patch({ description_template: event.target.value === '' ? null : event.target.value })
          }
        />
        <ErrorLines
          errors={errorsOf('description_template')}
          id="planner-default-description-errors"
        />
      </div>
    </section>
  )
}

export default DefaultsSection
