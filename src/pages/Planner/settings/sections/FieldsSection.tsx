/**
 * «Поля» (planner story 5.10, AC1; UX C-08, FR-9).
 *
 * A row per field: name, type, «Обов'язкове», value by default; list fields
 * keep their values. The type of a saved field is locked with the hint
 * «Потрібен інший тип — створіть нове поле» (the server refuses
 * `type_immutable` anyway). A value of a list that tasks use is not removed:
 * the page asks the server first, and a used value stays with «Використовується
 * в 12 задачах» — the count exists only in that answer (`option_in_use`).
 */
import { Input } from '@/components/ui/Input'
import { piiProps } from '@/lib/openreplay/pii'
import { cn } from '@/lib/utils'
import { personName } from '../../plannerFormat'
import {
  errorsOfRow,
  errorsOfSection,
  isListField,
  newElementId,
  type ConfigSectionProps,
  type FieldInput,
  type FieldType,
} from '../boardSettingsModel'
import { useSettingsText } from '../settingsText'
import { AddButton, ErrorLines, RemoveButton, SectionHeading, SettingsSelect } from '../settingsUi'

const FIELD_TYPES: FieldType[] = [
  'text',
  'number',
  'date',
  'link',
  'single_select',
  'multi_select',
  'person',
]

interface FieldsSectionProps extends ConfigSectionProps {
  /** Remove a value of a list — the page asks the server whether tasks use it. */
  onRemoveOption: (fieldId: string, optionId: string) => void
  /** Values the server said are in use, with the number of tasks. */
  inUse: ReadonlyMap<string, number>
  /** The value whose removal is being checked right now. */
  checkingOptionId: string | null
}

function DefaultEditor({
  field,
  onChange,
  members,
}: {
  field: FieldInput
  onChange: (value: FieldInput['default']) => void
  members: ConfigSectionProps['board']['members']
}) {
  const { t } = useSettingsText()
  const label = t('settings.fields.default')
  const value = field.default ?? null
  const inputClass =
    'border-input-border bg-input text-foreground h-8 rounded-lg border px-2 text-xs'

  switch (field.type) {
    case 'number':
      return (
        <input
          type="number"
          aria-label={label}
          className={cn(inputClass, 'w-28')}
          value={typeof value === 'number' ? value : ''}
          onChange={(event) =>
            onChange(event.target.value === '' ? null : Number(event.target.value))
          }
        />
      )
    case 'date':
      return (
        <input
          type="date"
          aria-label={label}
          className={inputClass}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value || null)}
        />
      )
    case 'single_select':
      return (
        <SettingsSelect
          aria-label={label}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value || null)}
        >
          <option value="">{t('settings.fields.noDefault')}</option>
          {(field.options ?? []).map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </SettingsSelect>
      )
    case 'multi_select': {
      const chosen = Array.isArray(value) ? value : []
      return (
        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="text-muted-foreground float-left mr-1">{label}</legend>
          {(field.options ?? []).map((option) => (
            <label key={option.id} className="text-foreground inline-flex items-center gap-1">
              <input
                type="checkbox"
                className="accent-primary"
                checked={chosen.includes(option.id)}
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...chosen, option.id]
                    : chosen.filter((id) => id !== option.id)
                  // «a non-empty array»: none chosen is no default at all.
                  onChange(next.length > 0 ? next : null)
                }}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
      )
    }
    case 'person':
      return (
        <span {...piiProps}>
          <SettingsSelect
            aria-label={label}
            value={typeof value === 'string' ? value : ''}
            onChange={(event) => onChange(event.target.value || null)}
          >
            <option value="">{t('settings.fields.noDefault')}</option>
            {members.map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {personName(member)}
              </option>
            ))}
            {typeof value === 'string' && !members.some((m) => m.user_id === value) && (
              <option value={value}>{t('settings.common.otherPerson')}</option>
            )}
          </SettingsSelect>
        </span>
      )
    default:
      return (
        <input
          type={field.type === 'link' ? 'url' : 'text'}
          aria-label={label}
          className={cn(inputClass, 'w-56')}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
        />
      )
  }
}

export function FieldsSection({
  config,
  saved,
  board,
  errors,
  onChange,
  onRemoveOption,
  inUse,
  checkingOptionId,
}: FieldsSectionProps) {
  const { t, inUse: inUseText } = useSettingsText()
  const savedIds = new Set(saved.fields.map((field) => field.id))

  const setFields = (change: (items: FieldInput[]) => FieldInput[]) =>
    onChange((current) => ({ ...current, fields: change(current.fields) }))
  const patch = (id: string, values: Partial<FieldInput>) =>
    setFields((items) => items.map((item) => (item.id === id ? { ...item, ...values } : item)))

  return (
    <section className="space-y-3" aria-labelledby="planner-settings-fields">
      <SectionHeading id="planner-settings-fields" title={t('settings.sections.fields')} />
      <ErrorLines errors={errorsOfSection(errors, 'fields')} />

      <ul className="space-y-2">
        {config.fields.map((field) => {
          const rowErrors = errorsOfRow(errors, field.id)
          const locked = savedIds.has(field.id)
          return (
            <li
              key={field.id}
              data-field-row={field.id}
              className="border-border bg-card space-y-2 rounded-lg border p-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-48">
                  <Input
                    inputSize="sm"
                    aria-label={t('settings.fields.nameLabel')}
                    value={field.name}
                    variant={rowErrors.some((e) => e.key === 'name') ? 'error' : 'default'}
                    aria-invalid={rowErrors.some((e) => e.key === 'name')}
                    aria-describedby={rowErrors.length > 0 ? `field-errors-${field.id}` : undefined}
                    onChange={(event) => patch(field.id, { name: event.target.value })}
                  />
                </div>
                <SettingsSelect
                  aria-label={t('settings.fields.type')}
                  value={field.type}
                  disabled={locked}
                  aria-describedby={locked ? `field-type-locked-${field.id}` : undefined}
                  onChange={(event) => {
                    const type = event.target.value as FieldType
                    patch(field.id, {
                      type,
                      default: null,
                      options: isListField(type) ? (field.options ?? []) : undefined,
                    })
                  }}
                >
                  {FIELD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {t(`settings.fields.types.${type}`)}
                    </option>
                  ))}
                </SettingsSelect>
                <label className="text-foreground inline-flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    className="accent-primary"
                    checked={field.required === true}
                    onChange={(event) => patch(field.id, { required: event.target.checked })}
                  />
                  {t('settings.fields.required')}
                </label>
                <RemoveButton
                  label={t('settings.common.removeItem', { name: field.name })}
                  onClick={() => setFields((items) => items.filter((item) => item.id !== field.id))}
                />
              </div>
              {locked && (
                <p id={`field-type-locked-${field.id}`} className="text-muted-foreground text-xs">
                  {t('settings.fields.typeLocked')}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <DefaultEditor
                  field={field}
                  members={board.members}
                  onChange={(value) => patch(field.id, { default: value })}
                />
              </div>

              {isListField(field.type) && (
                <div className="space-y-1 pl-4">
                  <p className="text-muted-foreground text-xs">{t('settings.fields.options')}</p>
                  <ul className="space-y-1">
                    {(field.options ?? []).map((option) => {
                      const used = inUse.get(option.id)
                      const optionErrors = errors.filter((error) => error.optionId === option.id)
                      return (
                        <li key={option.id} data-option-row={option.id} className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <div className="w-48">
                              <Input
                                inputSize="sm"
                                aria-label={t('settings.fields.optionLabel')}
                                value={option.label}
                                onChange={(event) =>
                                  patch(field.id, {
                                    options: (field.options ?? []).map((item) =>
                                      item.id === option.id
                                        ? { ...item, label: event.target.value }
                                        : item
                                    ),
                                  })
                                }
                              />
                            </div>
                            <RemoveButton
                              label={t('settings.common.removeItem', { name: option.label })}
                              disabled={used !== undefined || checkingOptionId !== null}
                              onClick={() => onRemoveOption(field.id, option.id)}
                            />
                            {used !== undefined && (
                              <span className="text-muted-foreground text-xs">
                                {inUseText(used)}
                              </span>
                            )}
                          </div>
                          <ErrorLines
                            errors={optionErrors.filter(
                              (error) => !error.reason.endsWith('_in_use')
                            )}
                          />
                        </li>
                      )
                    })}
                  </ul>
                  <AddButton
                    onClick={() =>
                      patch(field.id, {
                        options: [
                          ...(field.options ?? []),
                          { id: newElementId(), label: t('settings.fields.newOption') },
                        ],
                      })
                    }
                  >
                    {t('settings.fields.addOption')}
                  </AddButton>
                </div>
              )}
              <ErrorLines errors={rowErrors} id={`field-errors-${field.id}`} />
            </li>
          )
        })}
      </ul>

      <AddButton
        onClick={() =>
          setFields((items) => [
            ...items,
            {
              id: newElementId(),
              name: t('settings.fields.newName'),
              type: 'text',
              required: false,
              default: null,
            },
          ])
        }
      >
        {t('settings.fields.add')}
      </AddButton>
    </section>
  )
}

export default FieldsSection
