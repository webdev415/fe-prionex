/**
 * «Дошка» / «Кому» of the task form (planner story 5.7, UX-DR59, U-48).
 *
 * The boards are the server's answer to `GET /boards?can_create=true`: member
 * boards by kind («Відділи», «Команди», «Особиста»), then the boards that take
 * requests — departments as «Заявка в інший відділ», team boards below. A
 * request line reads «department · code · П-9 hint» as one line of text (the
 * AC's «одной строкой») that wraps instead of being cut: the hint (up to 200
 * characters) is what tells «ТП» from «Тех. підтримка», so it is never cut to
 * «…». Up to three lines in the list, two in the field; the whole line is in
 * `title`. The search looks at the name, the department, the code and the
 * hint. Once a request board is chosen, the field is «Кому».
 *
 * Keyboard: a pick (Enter, Space, click) closes the list and puts the focus
 * back on the field, so the next Tab goes on to «Назва». Escape inside the
 * open list closes the list only — not the whole form with what was typed.
 */
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import {
  BOARD_GROUPS,
  matchesBoard,
  requestTargetName,
  type BoardGroup,
  type BoardOption,
} from '../createTaskForm'
import { FieldError, RequiredLabel } from './FormParts'

interface BoardPickerProps {
  options: BoardOption[]
  value: BoardOption | undefined
  onChange: (option: BoardOption) => void
  /** The «Нова заявка» entry: the field is «Кому» from the start. */
  requestOnly?: boolean
  loading?: boolean
  failed?: boolean
  onRetry?: () => void
  error?: string
}

const GROUP_LABEL: Record<BoardGroup, string> = {
  department: 'tasksNav.groups.department',
  team: 'tasksNav.groups.team',
  personal: 'tasksNav.groups.personal',
  intakeDepartment: 'create.boardGroups.intakeDepartment',
  intakeTeam: 'create.boardGroups.intakeTeam',
}

/** The whole line as text: the `title` of a line that may be clamped. */
function optionText(option: BoardOption): string {
  if (!option.request) return `${option.code} · ${option.name}`
  const head = `${requestTargetName(option)} · ${option.code}`
  return option.hint ? `${head} · ${option.hint}` : head
}

/**
 * One line of text. A member board («КОД · назва») is short and stays on one
 * row; a request board wraps (`lines` rows at most) so its hint is read, not cut.
 */
function OptionLine({ option, lines }: { option: BoardOption; lines: 2 | 3 }) {
  if (!option.request) {
    return (
      <span className="block truncate">
        <span className="text-muted-foreground font-mono text-xs">{option.code}</span>
        {' · '}
        <span className="text-foreground">{option.name}</span>
      </span>
    )
  }
  return (
    <span
      data-testid="board-line"
      className={cn(
        'block break-words whitespace-normal',
        lines === 2 ? 'line-clamp-2' : 'line-clamp-3'
      )}
    >
      <span className="text-foreground">{requestTargetName(option)}</span>
      {' · '}
      <span className="text-muted-foreground font-mono text-xs">{option.code}</span>
      {option.hint && (
        <>
          {' · '}
          <span className="text-muted-foreground">{option.hint}</span>
        </>
      )}
    </span>
  )
}

export function BoardPicker({
  options,
  value,
  onChange,
  requestOnly = false,
  loading = false,
  failed = false,
  onRetry,
  error,
}: BoardPickerProps) {
  const { t } = useTranslation('planner')
  const id = useId()
  const labelId = `${id}-label`
  const valueId = `${id}-value`
  const errorId = `${id}-error`
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  // The list opens on its search: the next key the person types narrows it.
  useEffect(() => {
    if (open) searchRef.current?.focus()
  }, [open])
  // Radix closes the dialog on an Escape it hears on `document` in the capture
  // phase — before any handler of the list. A capture listener on `window`
  // runs first: an Escape inside the open list closes the list and marks the
  // event handled, so the dialog stays with what was typed.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (!(event.target instanceof Node) || !listRef.current?.contains(event.target)) return
      event.preventDefault()
      setOpen(false)
      setQuery('')
      triggerRef.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [open])
  const asRequest = requestOnly || Boolean(value?.request)
  const found = options.filter((option) => matchesBoard(option, query))

  return (
    <div className="w-full">
      <span id={labelId} className="text-foreground mb-1.5 block text-sm font-light">
        <RequiredLabel>
          {asRequest ? t('create.fields.to') : t('create.fields.board')}
        </RequiredLabel>
      </span>
      <button
        ref={triggerRef}
        type="button"
        title={value ? optionText(value) : undefined}
        aria-labelledby={`${labelId} ${valueId}`}
        aria-expanded={open}
        aria-describedby={error ? errorId : undefined}
        disabled={loading}
        onClick={() => setOpen((was) => !was)}
        className={cn(
          'bg-input text-foreground flex min-h-[45px] w-full items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-left text-sm font-light',
          error ? 'border-error-500' : 'border-input-border',
          'disabled:cursor-not-allowed disabled:opacity-50'
        )}
      >
        <span id={valueId} className="min-w-0 flex-1">
          {value ? (
            <OptionLine option={value} lines={2} />
          ) : (
            <span className="text-muted-foreground block truncate">
              {loading ? t('create.boardLoading') : t('create.boardPlaceholder')}
            </span>
          )}
        </span>
        <span aria-hidden="true" className="text-muted-foreground">
          ▾
        </span>
      </button>

      {failed && (
        <p className="text-foreground mt-1.5 text-xs">
          {t('tasksNav.boardsError')}{' '}
          {onRetry && (
            <button type="button" className="underline" onClick={onRetry}>
              {t('status.retry')}
            </button>
          )}
        </p>
      )}
      <FieldError id={errorId} text={error} />

      {open && (
        <div ref={listRef} className="border-border mt-1.5 space-y-2 rounded-md border p-2">
          <Input
            inputSize="sm"
            label={requestOnly ? t('create.boardSearchRequest') : t('create.boardSearch')}
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="max-h-64 space-y-2 overflow-auto">
            {BOARD_GROUPS.map((group) => {
              const inGroup = found.filter((option) => option.group === group)
              if (inGroup.length === 0) return null
              const groupId = `${id}-${group}`
              return (
                <div key={group} role="group" aria-labelledby={groupId}>
                  <p id={groupId} className="text-muted-foreground px-1 text-xs font-medium">
                    {t(GROUP_LABEL[group])}
                  </p>
                  <ul>
                    {inGroup.map((option) => (
                      <li key={option.code}>
                        <button
                          type="button"
                          aria-pressed={option.code === value?.code}
                          title={optionText(option)}
                          className="hover:bg-muted aria-pressed:bg-muted block w-full min-w-0 rounded px-2 py-1.5 text-left text-sm"
                          onClick={() => {
                            onChange(option)
                            setOpen(false)
                            setQuery('')
                            // Before the list (and this button) unmounts: the
                            // focus stays in the form's order, not on the dialog.
                            triggerRef.current?.focus()
                          }}
                        >
                          <OptionLine option={option} lines={3} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
            {found.length === 0 && (
              <p className="text-muted-foreground px-1 text-xs">{t('create.noBoards')}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default BoardPicker
