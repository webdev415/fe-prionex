/**
 * People picker of the task form (planner story 1.10; UX «Выбор людей»):
 * search by name in the CRM org mirror (`GET /people`, active people only),
 * the line carries the name and department, up to 10 assignees.
 */
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/Input'
import { piiProps } from '@/lib/openreplay/pii'
import { usePlannerPeople } from '@/api/planner/plannerQueries'
import type { PlannerPerson } from '@/api/planner/plannerApi'

export const MAX_ASSIGNEES = 10

interface PeoplePickerProps {
  value: PlannerPerson[]
  onChange: (people: PlannerPerson[]) => void
}

export function PeoplePicker({ value, onChange }: PeoplePickerProps) {
  const { t } = useTranslation('planner')
  const [query, setQuery] = useState('')
  const listId = useId()
  const people = usePlannerPeople(query)
  const chosen = new Set(value.map((person) => person.user_id))
  const full = value.length >= MAX_ASSIGNEES
  const results = (people.data?.items ?? []).filter((person) => !chosen.has(person.user_id))

  return (
    <div className="space-y-2">
      <Input
        label={t('create.fields.assignees')}
        placeholder={t('create.fields.assigneesPlaceholder')}
        value={query}
        disabled={full}
        aria-controls={listId}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="text-muted-foreground text-xs">
        {t('create.assigneesCount', { count: value.length })}
      </div>

      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" {...piiProps}>
          {value.map((person) => (
            <li
              key={person.user_id}
              className="border-border bg-muted inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
            >
              <span>{person.full_name}</span>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => onChange(value.filter((p) => p.user_id !== person.user_id))}
              >
                <span aria-hidden="true">×</span>
                {/* The name stays a text node (masked with the list), not an
                    attribute: attributes reach session recordings verbatim. */}
                <span className="sr-only">{t('create.remove', { name: person.full_name })}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {query.trim().length >= 2 && !full && (
        <ul
          id={listId}
          className="border-border max-h-48 overflow-auto rounded-md border"
          {...piiProps}
        >
          {people.isSuccess && results.length === 0 && (
            <li className="text-muted-foreground px-3 py-2 text-xs">{t('create.noPeople')}</li>
          )}
          {results.map((person) => (
            <li key={person.user_id}>
              <button
                type="button"
                className="hover:bg-muted w-full px-3 py-2 text-left text-sm"
                onClick={() => {
                  onChange([...value, person])
                  setQuery('')
                }}
              >
                <span className="text-foreground">{person.full_name}</span>
                {person.departments[0] && (
                  <span className="text-muted-foreground ml-2 text-xs">
                    {person.departments[0].name}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default PeoplePicker
