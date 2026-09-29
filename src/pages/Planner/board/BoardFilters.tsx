/**
 * Filter bar of a board (planner story 5.3, AC2; UX-DR17, FR-12): search by
 * title, description and number · `Виконавець` · `Замовник` · `Мітка` ·
 * `Пріоритет` · `Тип` · `Поле…` · the `Прострочені` switch · the quick chip
 * `Мої`. Everything lives in the address (`useBoardFilters`) and goes to the
 * server as it is; active filters are chips with ✕ and «Скинути все».
 *
 * People are picked with the planner's people picker (`GET /people`, 5.1).
 * The address carries only the `user_id`: the chip shows the name picked on
 * this board's screen, else the board member's name, else «обрано». Names,
 * search text and free-text field values are masked for session recording.
 *
 * A filter the board has nothing for (no labels, a board without a priority
 * scale, no fields) is not offered: a menu with no choice is a dead control.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { MdClose, MdSearch } from 'react-icons/md'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useDebounce } from '@/hooks/useDebounce'
import { formatNumber } from '@/lib/localeFormat'
import { piiProps } from '@/lib/openreplay/pii'
import { cn } from '@/lib/utils'
import type { PlannerBoard, PlannerPerson } from '@/api/planner/plannerApi'
import { PeoplePicker } from '../components/PeoplePicker'
import {
  BOARD_SEARCH_MAX,
  type BoardFilterChange,
  type BoardFilterState,
  type FilterKey,
} from './useBoardFilters'

const SEARCH_DEBOUNCE_MS = 300

type Config = PlannerBoard['config']
type Panel = 'assignee' | 'author' | 'field' | null

interface BoardFiltersProps {
  board: PlannerBoard
  state: BoardFilterState
  change: (changes: BoardFilterChange, options?: { replace?: boolean }) => void
  clearAll: () => void
}

const CHIP =
  'focus-visible:ring-ring inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none'

function chipClass(pressed: boolean) {
  return cn(
    CHIP,
    pressed
      ? 'border-primary-300 bg-primary-300 text-primary-foreground'
      : 'border-border bg-card text-foreground hover:bg-muted'
  )
}

const byPosition = <T extends { position: number }>(items: T[]) =>
  [...items].sort((a, b) => a.position - b.position)

export function BoardFilters({ board, state, change, clearAll }: BoardFiltersProps) {
  const { t } = useTranslation('planner')
  const [panel, setPanel] = useState<Panel>(null)
  const panelId = useId()
  const config = board.config
  const toggle = (next: Exclude<Panel, null>) => setPanel((open) => (open === next ? null : next))

  // Names of people picked on this board's screen, by `user_id`: the address
  // carries only the id, and a chip should still say whom it filters by. They
  // live and go with the screen (and another board starts empty).
  const [picked, setPicked] = useState({ code: board.code, names: new Map<string, string>() })
  const pickedNames = picked.code === board.code ? picked.names : undefined
  const rememberName = (userId: string, name: string) =>
    setPicked((previous) => {
      const names = new Map(previous.code === board.code ? previous.names : [])
      names.set(userId, name)
      return { code: board.code, names }
    })

  const personName = (userId: string) =>
    pickedNames?.get(userId) ??
    board.members.find((member) => member.user_id === userId)?.full_name ??
    t('filters.chosen')

  const pickPerson = (key: 'assignee' | 'author') => (people: PlannerPerson[]) => {
    const person = people[0]
    if (!person) return
    rememberName(person.user_id, person.full_name)
    change({ [key]: person.user_id })
    setPanel(null)
  }

  const panelButton = (key: Exclude<Panel, null>, label: string) => (
    <button
      type="button"
      className={chipClass(panel === key)}
      aria-expanded={panel === key}
      aria-controls={panel === key ? panelId : undefined}
      onClick={() => toggle(key)}
    >
      {label} <span aria-hidden="true">▾</span>
    </button>
  )

  return (
    <div role="search" aria-label={t('filters.label')} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <SearchField value={state.q} onSearch={(q) => change({ q }, { replace: true })} />
        {panelButton('assignee', t('filters.assignee'))}
        {panelButton('author', t('filters.author'))}
        <OptionFilter
          label={t('filters.tag')}
          options={byPosition(config.labels)}
          value={state.label}
          onPick={(id) => change({ label: id })}
        />
        <OptionFilter
          label={t('filters.priority')}
          options={byPosition(config.priorities)}
          value={state.priority}
          onPick={(id) => change({ priority: id })}
        />
        <OptionFilter
          label={t('filters.type')}
          options={byPosition(config.task_types)}
          value={state.type}
          onPick={(id) => change({ type: id })}
        />
        {config.fields.length > 0 && panelButton('field', t('filters.field'))}
        <button
          type="button"
          className={chipClass(state.overdue)}
          aria-pressed={state.overdue}
          onClick={() => change({ overdue: state.overdue ? null : '1' })}
        >
          {t('filters.overdue')}
        </button>
        <button
          type="button"
          className={chipClass(state.mine)}
          aria-pressed={state.mine}
          onClick={() => change({ mine: state.mine ? null : '1' })}
        >
          {t('filters.mine')}
        </button>
      </div>

      {panel && (
        <div
          id={panelId}
          className="border-border bg-card max-w-md space-y-2 rounded-lg border p-3"
          {...(panel === 'field' ? {} : piiProps)}
        >
          {panel === 'field' ? (
            <FieldPanel
              config={config}
              onApply={(field, value, name) => {
                if (name) rememberName(value, name)
                change({ field, value })
                setPanel(null)
              }}
            />
          ) : (
            <PeoplePicker
              value={[]}
              max={1}
              showCount={false}
              label={t(panel === 'assignee' ? 'filters.assignee' : 'filters.author')}
              onChange={pickPerson(panel)}
            />
          )}
          <Button variant="outline" size="xs" onClick={() => setPanel(null)}>
            {t('filters.close')}
          </Button>
        </div>
      )}

      <ActiveFilters
        state={state}
        config={config}
        personName={personName}
        onRemove={(keys) =>
          change(Object.fromEntries(keys.map((key) => [key, null])) as BoardFilterChange)
        }
        onClearAll={clearAll}
      />
    </div>
  )
}

// ─── search ────────────────────────────────────────────────────────────────

/**
 * Search waits for a pause in typing (300 ms); longer than the contract's 200
 * characters is a field error and is not sent. The field follows the address
 * when it changes from outside («Скинути все», a link).
 */
function SearchField({ value, onSearch }: { value: string; onSearch: (q: string) => void }) {
  const { t, i18n } = useTranslation('planner')
  const [text, setText] = useState(value)
  const [shown, setShown] = useState(value)
  if (value !== shown) {
    setShown(value)
    setText(value)
  }
  const debounced = useDebounce(text, SEARCH_DEBOUNCE_MS)
  const tooLong = Array.from(text.trim()).length > BOARD_SEARCH_MAX
  // Only a settled text is sent, compared with the address as it is THEN: a
  // text that lags behind a change from outside must not overwrite it.
  const latest = useRef({ value, onSearch })
  useEffect(() => {
    latest.current = { value, onSearch }
  })
  useEffect(() => {
    const next = debounced.trim()
    if (Array.from(next).length > BOARD_SEARCH_MAX) return
    if (next !== latest.current.value) latest.current.onSearch(next)
  }, [debounced])

  return (
    <div className="w-64" {...piiProps}>
      <Input
        aria-label={t('filters.search')}
        placeholder={t('filters.searchPlaceholder')}
        value={text}
        leftIcon={<MdSearch aria-hidden="true" className="h-4 w-4" />}
        error={
          tooLong
            ? t('filters.searchTooLong', {
                max: formatNumber(BOARD_SEARCH_MAX, i18n.language ?? 'uk'),
              })
            : undefined
        }
        onChange={(event) => setText(event.target.value)}
      />
    </div>
  )
}

// ─── one of the board's own lists ──────────────────────────────────────────

interface OptionFilterProps {
  label: string
  options: { id: string; name: string }[]
  value: string | undefined
  onPick: (id: string | null) => void
}

function OptionFilter({ label, options, value, onPick }: OptionFilterProps) {
  const { t } = useTranslation('planner')
  if (options.length === 0) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={chipClass(Boolean(value))}>
          {label} <span aria-hidden="true">▾</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {/* One choice: the chosen one is checked for assistive tech and marked
            with a dot, not by weight alone (UX-DR46). */}
        <DropdownMenuRadioGroup value={value ?? ''}>
          <DropdownMenuRadioItem value="" className="cursor-pointer" onSelect={() => onPick(null)}>
            {t('filters.all')}
          </DropdownMenuRadioItem>
          {options.map((option) => (
            <DropdownMenuRadioItem
              key={option.id}
              value={option.id}
              className="cursor-pointer"
              onSelect={() => onPick(option.id)}
            >
              {option.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── «Поле…» ───────────────────────────────────────────────────────────────

const FIELD_CONTROL =
  'border-border bg-card text-foreground focus-visible:ring-ring h-9 w-full rounded-md border px-2 text-sm focus-visible:ring-2 focus-visible:outline-none'

/**
 * A board field and its value, in the form the contract wants (`field_value`):
 * a list field — the option's id; a number, a text, a date (YYYY-MM-DD), a link
 * — the value itself; a person — the `user_id`.
 */
function FieldPanel({
  config,
  onApply,
}: {
  config: Config
  onApply: (fieldId: string, value: string, personName?: string) => void
}) {
  const { t } = useTranslation('planner')
  const fields = byPosition(config.fields)
  const [fieldId, setFieldId] = useState(fields[0]?.id ?? '')
  const [value, setValue] = useState('')
  const [person, setPerson] = useState<PlannerPerson | null>(null)
  const field = fields.find((f) => f.id === fieldId)
  const fieldSelectId = useId()
  const valueId = useId()
  if (!field) return null

  const isList = field.type === 'single_select' || field.type === 'multi_select'
  const inputType = field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'
  const chosen = field.type === 'person' ? (person?.user_id ?? '') : value.trim()

  let control: ReactNode
  if (field.type === 'person') {
    control = (
      <div {...piiProps}>
        <PeoplePicker
          value={person ? [person] : []}
          max={1}
          showCount={false}
          label={t('filters.fieldValue')}
          onChange={(people) => setPerson(people[0] ?? null)}
        />
      </div>
    )
  } else if (isList) {
    control = (
      <>
        <label htmlFor={valueId} className="text-foreground text-sm font-medium">
          {t('filters.fieldValue')}
        </label>
        <select
          id={valueId}
          className={FIELD_CONTROL}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        >
          <option value="" />
          {byPosition(field.options).map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </>
    )
  } else {
    control = (
      <div {...piiProps}>
        <Input
          label={t('filters.fieldValue')}
          type={inputType}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </div>
    )
  }

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault()
        if (chosen) onApply(field.id, chosen, person?.full_name)
      }}
    >
      <label htmlFor={fieldSelectId} className="text-foreground text-sm font-medium">
        {t('filters.fieldName')}
      </label>
      <select
        id={fieldSelectId}
        className={FIELD_CONTROL}
        value={fieldId}
        onChange={(event) => {
          setFieldId(event.target.value)
          setValue('')
          setPerson(null)
        }}
      >
        {fields.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
      {control}
      <Button type="submit" size="xs" disabled={!chosen}>
        {t('filters.apply')}
      </Button>
    </form>
  )
}

// ─── active chips ──────────────────────────────────────────────────────────

interface ActiveChip {
  keys: FilterKey[]
  label: ReactNode
}

function ActiveFilters({
  state,
  config,
  personName,
  onRemove,
  onClearAll,
}: {
  state: BoardFilterState
  config: Config
  personName: (userId: string) => string
  onRemove: (keys: FilterKey[]) => void
  onClearAll: () => void
}) {
  const { t } = useTranslation('planner')
  const named = (list: { id: string; name: string }[], id: string) =>
    list.find((item) => item.id === id)?.name ?? t('filters.unknown')
  const masked = (text: string) => <span {...piiProps}>{text}</span>

  const chips: ActiveChip[] = []
  if (state.q)
    chips.push({ keys: ['q'], label: masked(t('filters.searchChip', { value: state.q })) })
  if (state.mine) chips.push({ keys: ['mine'], label: t('filters.mine') })
  if (state.assignee) {
    chips.push({
      keys: ['assignee'],
      label: (
        <>
          {t('filters.assignee')}: <span {...piiProps}>{personName(state.assignee)}</span>
        </>
      ),
    })
  }
  if (state.author) {
    chips.push({
      keys: ['author'],
      label: (
        <>
          {t('filters.author')}: <span {...piiProps}>{personName(state.author)}</span>
        </>
      ),
    })
  }
  if (state.label) {
    chips.push({
      keys: ['label'],
      label: `${t('filters.tag')}: ${named(config.labels, state.label)}`,
    })
  }
  if (state.priority) {
    chips.push({
      keys: ['priority'],
      label: `${t('filters.priority')}: ${named(config.priorities, state.priority)}`,
    })
  }
  if (state.type) {
    chips.push({
      keys: ['type'],
      label: `${t('filters.type')}: ${named(config.task_types, state.type)}`,
    })
  }
  if (state.field && state.value !== undefined) {
    const field = config.fields.find((f) => f.id === state.field)
    const option = field?.options.find((o) => o.id === state.value)
    const shown =
      field?.type === 'person' ? personName(state.value) : (option?.label ?? state.value)
    chips.push({
      keys: ['field', 'value'],
      label: (
        <>
          {field?.name ?? t('filters.fieldName')}: {masked(shown)}
        </>
      ),
    })
  }
  if (state.overdue) chips.push({ keys: ['overdue'], label: t('filters.overdue') })
  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ul aria-label={t('filters.active')} className="flex flex-wrap items-center gap-2">
        {chips.map((chip) => (
          <li key={chip.keys.join('+')}>
            <button
              type="button"
              className={cn(CHIP, 'border-border bg-muted text-foreground hover:bg-card')}
              onClick={() => onRemove(chip.keys)}
            >
              <span>{chip.label}</span>
              <MdClose aria-hidden="true" className="h-3.5 w-3.5" />
              <span className="sr-only">— {t('filters.remove')}</span>
            </button>
          </li>
        ))}
      </ul>
      <Button variant="ghost" size="xs" onClick={onClearAll}>
        {t('filters.resetAll')}
      </Button>
    </div>
  )
}

export default BoardFilters
