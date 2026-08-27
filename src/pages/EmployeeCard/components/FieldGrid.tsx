import type { ReactNode } from 'react'

export interface Field {
  label: string
  value: ReactNode
}

export interface FieldGridProps {
  fields: Field[]
  emptyLabel: string
}

/**
 * The two-column read view every section shares.
 *
 * A field with nothing in it still takes its place rather than collapsing,
 * because a section that reflows depending on what is filled in is one where
 * nobody can find the same thing twice.
 */
export function FieldGrid({ fields, emptyLabel }: FieldGridProps) {
  return (
    <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
      {fields.map((field) => (
        <div key={field.label} className="space-y-1">
          <dt className="text-muted-foreground text-xs">{field.label}</dt>
          <dd className="text-foreground text-sm">
            {field.value || <span className="text-muted-foreground">{emptyLabel}</span>}
          </dd>
        </div>
      ))}
    </dl>
  )
}
