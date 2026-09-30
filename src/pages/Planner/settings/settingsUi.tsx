/**
 * Small pieces the sections of the board settings share (planner story 5.10):
 * the row's error lines, the order buttons, a compact select. Colours are
 * theme variables only (DESIGN.md) — no hex values and no dark variant.
 */
import { createContext, useContext, useEffect, useRef } from 'react'
import type { DragEvent, ReactNode, SelectHTMLAttributes } from 'react'
import { MdArrowDownward, MdArrowUpward, MdDeleteOutline, MdDragIndicator } from 'react-icons/md'
import { cn } from '@/lib/utils'
import type { LocatedError } from './boardSettingsModel'
import { useSettingsText } from './settingsText'
import { rememberRemoval } from './useFocusAfterRemove'

const CONTROL =
  'border-input-border bg-input text-foreground focus:border-primary-500 focus:ring-primary-500 h-8 rounded-lg border px-2 text-xs focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'

export function SettingsSelect({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(CONTROL, className)} {...props} />
}

/** The server's errors of one row, under it (UX: «ошибки у своих строк»). */
export function ErrorLines({ errors, id }: { errors: LocatedError[]; id?: string }) {
  const { errorText } = useSettingsText()
  if (errors.length === 0) return null
  const texts = [...new Set(errors.map(errorText))]
  return (
    <ul id={id} className="text-error-700 space-y-0.5 text-xs">
      {texts.map((text) => (
        <li key={text}>{text}</li>
      ))}
    </ul>
  )
}

/** The section's title; `id` names the section (`aria-labelledby`), the hint stays out of it. */
export function SectionHeading({
  id,
  title,
  hint,
}: {
  id: string
  title: string
  hint?: ReactNode
}) {
  return (
    <div className="space-y-1">
      <h3 id={id} className="text-foreground text-base font-semibold">
        {title}
      </h3>
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  )
}

const ICON_BUTTON =
  'text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring inline-flex h-7 w-7 shrink-0 items-center justify-center rounded focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40'

interface OrderButtonsProps {
  upLabel: string
  downLabel: string
  first: boolean
  last: boolean
  onUp: () => void
  onDown: () => void
}

/**
 * «Вище / Нижче» — the keyboard way to reorder a list.
 *
 * After a move the row's DOM node is moved (or its button turns disabled at the
 * top / bottom), and the browser drops the focus on `body`. The row keeps its
 * key, so this component survives the move and puts the focus back on the
 * button of the same direction — or on the other one when that one is now
 * disabled (WCAG 2.1.1, 2.5.7; EXPERIENCE.md, Accessibility Floor).
 */
export function OrderButtons({ upLabel, downLabel, first, last, onUp, onDown }: OrderButtonsProps) {
  const upRef = useRef<HTMLButtonElement>(null)
  const downRef = useRef<HTMLButtonElement>(null)
  const pending = useRef<'up' | 'down' | null>(null)

  useEffect(() => {
    const direction = pending.current
    if (direction === null) return
    pending.current = null
    const same = direction === 'up' ? upRef.current : downRef.current
    const other = direction === 'up' ? downRef.current : upRef.current
    const target = same && !same.disabled ? same : other
    if (target && !target.disabled && document.activeElement !== target) target.focus()
  })

  return (
    <span className="inline-flex">
      <button
        ref={upRef}
        type="button"
        className={ICON_BUTTON}
        disabled={first}
        onClick={() => {
          pending.current = 'up'
          onUp()
        }}
      >
        <MdArrowUpward aria-hidden="true" className="h-4 w-4" />
        <span className="sr-only">{upLabel}</span>
      </button>
      <button
        ref={downRef}
        type="button"
        className={ICON_BUTTON}
        disabled={last}
        onClick={() => {
          pending.current = 'down'
          onDown()
        }}
      >
        <MdArrowDownward aria-hidden="true" className="h-4 w-4" />
        <span className="sr-only">{downLabel}</span>
      </button>
    </span>
  )
}

export function RemoveButton({
  label,
  onClick,
  disabled,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      data-settings-remove=""
      className={ICON_BUTTON}
      onClick={(event) => {
        rememberRemoval(event.currentTarget)
        onClick()
      }}
      disabled={disabled}
    >
      <MdDeleteOutline aria-hidden="true" className="h-4 w-4" />
      <span className="sr-only">{label}</span>
    </button>
  )
}

/** The sections are locked while a save is in flight (`EditLock`). */
const EditLockContext = createContext(false)

/**
 * The sections while a save is in flight (5.10 bot round 2). The save replaces
 * the draft with the card it wrote, so an edit made meanwhile would be lost
 * without a word: a disabled fieldset takes every control of the sections out
 * of reach (typing, choosing, the buttons), and the drag grips read the same
 * lock. The section menu stays outside — moving between sections keeps the
 * draft.
 */
export function EditLock({
  locked,
  className,
  children,
}: {
  locked: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <EditLockContext.Provider value={locked}>
      <fieldset
        disabled={locked}
        aria-busy={locked || undefined}
        className={cn('min-w-0', className)}
      >
        {children}
      </fieldset>
    </EditLockContext.Provider>
  )
}

/**
 * The grip a row is dragged by (only the grip: text in the row's fields stays
 * selectable); the «Вище / Нижче» buttons next to it do the same from the
 * keyboard. A fieldset does not stop a drag, so the grip reads `EditLock` itself.
 */
export function DragHandle({
  label,
  onDragStart,
  onDragEnd,
}: {
  label: string
  onDragStart: (event: DragEvent<HTMLSpanElement>) => void
  onDragEnd: () => void
}) {
  const locked = useContext(EditLockContext)
  return (
    <span
      draggable={!locked}
      aria-disabled={locked || undefined}
      data-drag-handle=""
      onDragStart={(event) => {
        if (locked) {
          event.preventDefault()
          return
        }
        onDragStart(event)
      }}
      onDragEnd={onDragEnd}
      className={cn(
        'text-muted-foreground inline-flex h-7 w-5 items-center justify-center',
        locked ? 'cursor-not-allowed opacity-50' : 'cursor-grab'
      )}
    >
      <MdDragIndicator aria-hidden="true" className="h-4 w-4" />
      <span className="sr-only">{label}</span>
    </span>
  )
}

export function AddButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      data-settings-add=""
      className="text-primary hover:bg-muted focus-visible:ring-ring rounded px-2 py-1 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}
