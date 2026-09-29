/**
 * Small pieces of the planner forms (planner story 5.7), styled like the CRM
 * `Input` so the task form reads as one: a required mark, a field error and a
 * native select.
 *
 * The required mark is CSS generated content, not a «*» in the label text: the
 * label keeps its plain name («Назва»), the input says `aria-required`, and the
 * red star is what the eye sees — the CRM convention of `Input`'s «Назва*».
 */
import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function RequiredLabel({ children }: { children: ReactNode }) {
  return <span className="after:text-error-500 after:ml-0.5 after:content-['*']">{children}</span>
}

export function FieldError({ id, text }: { id: string; text: string | undefined }) {
  if (!text) return null
  return (
    <p id={id} className="text-error-500 mt-1.5 text-xs" role="alert">
      {text}
    </p>
  )
}

interface NativeSelectProps {
  label: ReactNode
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  error?: string
  required?: boolean
}

/** A native `<select>`: keyboard, screen readers and tests get the platform control. */
export function NativeSelect({
  label,
  value,
  onChange,
  options,
  error,
  required = false,
}: NativeSelectProps) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <div className="w-full">
      <label htmlFor={id} className="text-foreground mb-1.5 block text-sm font-light">
        {required ? <RequiredLabel>{label}</RequiredLabel> : label}
      </label>
      <select
        id={id}
        value={value}
        aria-required={required || undefined}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          'bg-input text-foreground h-[45px] w-full rounded-lg border px-3 text-sm font-light focus:ring-2 focus:ring-offset-2 focus:outline-none',
          'focus:ring-offset-card',
          error
            ? 'border-error-500 focus:ring-error-500'
            : 'border-input-border focus:border-primary-500 focus:ring-primary-500'
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldError id={errorId} text={error} />
    </div>
  )
}
