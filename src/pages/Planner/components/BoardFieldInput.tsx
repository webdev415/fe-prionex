/**
 * One field of the board in the task form (planner story 5.7): text, number,
 * date, link, a single or multiple choice, a person — by `BoardField.type`.
 *
 * The form shows the field's default until the person touches it; only a
 * touched field goes into `TaskCreate.fields` (a missing key keeps the
 * server's default). Whether a required field is filled is the server's call:
 * its 400 comes back at this field (`details.id`).
 */
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/Input'
import { piiProps } from '@/lib/openreplay/pii'
import type { PlannerBoardField, PlannerPerson } from '@/api/planner/plannerApi'
import type { FieldDraft } from '../createTaskForm'
import { FieldError, NativeSelect, RequiredLabel } from './FormParts'
import { PeoplePicker } from './PeoplePicker'

interface BoardFieldInputProps {
  field: PlannerBoardField
  value: FieldDraft
  onChange: (value: FieldDraft) => void
  error?: string
}

const INPUT_TYPE = { text: 'text', number: 'number', date: 'date', link: 'url' } as const

export function BoardFieldInput({ field, value, onChange, error }: BoardFieldInputProps) {
  const { t } = useTranslation('planner')
  const id = useId()
  const errorId = `${id}-error`
  const label = field.required ? <RequiredLabel>{field.name}</RequiredLabel> : field.name
  const options = [...field.options].sort((a, b) => a.position - b.position)

  switch (field.type) {
    case 'single_select':
      return (
        <NativeSelect
          label={field.name}
          required={field.required}
          value={typeof value === 'string' ? value : ''}
          onChange={(next) => onChange(next || null)}
          options={[
            { value: '', label: t('create.fieldEmpty') },
            ...options.map((option) => ({ value: option.id, label: option.label })),
          ]}
          error={error}
        />
      )
    case 'multi_select': {
      const chosen = Array.isArray(value) ? value : []
      return (
        <fieldset aria-describedby={error ? errorId : undefined} aria-invalid={!!error}>
          <legend className="text-foreground mb-1.5 text-sm font-light">{label}</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {options.map((option) => (
              <label key={option.id} className="text-foreground flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  className="accent-primary-500"
                  checked={chosen.includes(option.id)}
                  onChange={(event) =>
                    onChange(
                      event.target.checked
                        ? options
                            .map((o) => o.id)
                            .filter(
                              (optionId) => optionId === option.id || chosen.includes(optionId)
                            )
                        : chosen.filter((optionId) => optionId !== option.id)
                    )
                  }
                />
                {option.label}
              </label>
            ))}
          </div>
          <FieldError id={errorId} text={error} />
        </fieldset>
      )
    }
    case 'person': {
      const person = value && typeof value === 'object' && !Array.isArray(value) ? value : null
      return (
        <PeoplePicker
          value={person ? [person] : []}
          onChange={(people: PlannerPerson[]) => onChange(people[0] ?? null)}
          max={1}
          label={field.required ? `${field.name}*` : field.name}
          error={error}
        />
      )
    }
    default:
      return (
        <Input
          type={INPUT_TYPE[field.type]}
          label={label}
          aria-required={field.required || undefined}
          value={typeof value === 'string' ? value : ''}
          error={error}
          onChange={(event) => onChange(event.target.value)}
          {...(field.type === 'text' || field.type === 'link' ? piiProps : {})}
        />
      )
  }
}

export default BoardFieldInput
