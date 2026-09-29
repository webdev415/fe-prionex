/**
 * People picker of the planner (planner stories 1.10, 5.1 AC3/AC5; UX «Выбор
 * людей», UX-DR10, FR-6).
 *
 * Search by name in the CRM org mirror (`GET /people`); a line reads «avatar ·
 * name · department · group», and somebody who has never opened the planner
 * gets the empty ring and «ще не користувався Планером» — they can still be
 * picked. The list is exactly the server's answer: `GET /people` returns active
 * employees only, so an inactive one is not offered even for an exact name, and
 * the client adds nobody on its own.
 *
 * The limit is the caller's (`max`): 10 assignees of a task, 200 participants of
 * an event (CF-5, E-63); the counter reads «3 / 10», «12 / 200». The search
 * waits for a pause in typing (300 ms) and is not sent for fewer than 2 or more
 * than 100 characters (contract `q`); an over-long text is said, not cut. A
 * field that reaches the limit is closed and emptied: no half-typed name
 * waits in it for a place to free up.
 */
import { Fragment, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/Input'
import { useDebounce } from '@/hooks/useDebounce'
import { formatNumber } from '@/lib/localeFormat'
import { piiProps } from '@/lib/openreplay/pii'
import { isPeopleQuery, usePlannerPeople } from '@/api/planner/plannerQueries'
import {
  PLANNER_ASSIGNEES_MAX,
  PLANNER_PEOPLE_QUERY_MAX,
  plannerTextLength,
  type PlannerPerson,
} from '@/api/planner/plannerApi'
import { PersonAvatar } from './PersonAvatar'

const PEOPLE_SEARCH_DEBOUNCE_MS = 300

interface PeoplePickerProps {
  value: PlannerPerson[]
  onChange: (people: PlannerPerson[]) => void
  /** Most people the field takes (`PLANNER_ASSIGNEES_MAX`, `PLANNER_EVENT_PARTICIPANTS_MAX`). */
  max?: number
  /** The field's label and hint; an event's participants name their own. */
  label?: string
  placeholder?: string
  /**
   * The caller's error for the field (a 400 of the form): said under the
   * search input and tied to it (`aria-invalid`, `aria-describedby`), like
   * any other field. A too-long search text is said first — it is what the
   * person is typing now.
   */
  error?: string
}

export function PeoplePicker({
  value,
  onChange,
  max = PLANNER_ASSIGNEES_MAX,
  label,
  placeholder,
  error,
}: PeoplePickerProps) {
  const { t, i18n } = useTranslation('planner')
  const language = i18n.language ?? 'uk'
  const [query, setQuery] = useState('')
  const listId = useId()
  const debouncedQuery = useDebounce(query, PEOPLE_SEARCH_DEBOUNCE_MS)
  const people = usePlannerPeople(debouncedQuery)
  const chosen = new Set(value.map((person) => person.user_id))
  const full = value.length >= max
  // The limit may come from outside too (the caller's `value`): the text is
  // dropped when the field closes, not left for the next search.
  const [wasFull, setWasFull] = useState(full)
  if (full !== wasFull) {
    setWasFull(full)
    if (full) setQuery('')
  }
  const results = (people.data?.items ?? []).filter((person) => !chosen.has(person.user_id))
  const typed = query.trim()
  const tooLong = plannerTextLength(typed) > PLANNER_PEOPLE_QUERY_MAX

  return (
    <div className="space-y-2">
      <Input
        label={label ?? t('create.fields.assignees')}
        placeholder={placeholder ?? t('create.fields.assigneesPlaceholder')}
        value={query}
        disabled={full}
        // An over-long text is a field error like the title's: said at the
        // field and tied to it, not cut and not sent.
        error={
          tooLong && !full
            ? t('people.tooLong', { max: formatNumber(PLANNER_PEOPLE_QUERY_MAX, language) })
            : error
        }
        aria-controls={listId}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="text-muted-foreground text-xs tabular-nums">
        {t('create.assigneesCount', {
          count: value.length,
          max: formatNumber(max, language),
        })}
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

      {isPeopleQuery(typed) && !full && (
        <ul
          id={listId}
          className="border-border max-h-60 overflow-auto rounded-md border"
          {...piiProps}
        >
          {people.isSuccess && results.length === 0 && (
            <li className="text-muted-foreground px-3 py-2 text-xs">{t('create.noPeople')}</li>
          )}
          {results.map((person) => {
            const unit = person.departments[0]
            // «відділ · група» and the mark; a department may share its group's name.
            const details = [
              ['unit', unit?.name],
              ['group', unit?.group?.name],
              ['state', person.never_logged_in ? t('task.neverLoggedIn') : undefined],
            ].filter((part): part is [string, string] => Boolean(part[1]))
            return (
              <li key={person.user_id}>
                <button
                  type="button"
                  className="hover:bg-muted flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                  onClick={() => {
                    onChange([...value, person])
                    setQuery('')
                  }}
                >
                  {/* The name, the unit and the «never logged in» mark are
                      text right here; the avatar only repeats them. The « · »
                      separators are text of the line itself, so the button's
                      accessible name reads «Олена Коваль · Склад · Приймання». */}
                  <PersonAvatar person={person} decorative />
                  <span className="text-muted-foreground min-w-0 flex-1">
                    <span className="text-foreground">{person.full_name}</span>
                    {details.map(([kind, text]) => (
                      <Fragment key={kind}>
                        {' · '}
                        <span>{text}</span>
                      </Fragment>
                    ))}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default PeoplePicker
