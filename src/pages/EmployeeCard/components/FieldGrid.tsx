import type { ReactNode } from 'react'

import { piiProps } from '@/lib/openreplay/pii'

export interface Field {
  label: string
  value: ReactNode
  /**
   * Record this field's VALUE as asterisks in an OpenReplay replay (KAN-KB-54).
   *
   * Set it on every field holding a person's name or a home address. The label
   * is never marked: it is the only thing that says what the asterisks are, and
   * a card where nothing can be told apart is `privateMode` by another route.
   */
  obscured?: boolean
}

export interface FieldGridProps {
  fields: Field[]
}

/**
 * The two-column read view every section shares.
 *
 * A field with nothing in it still takes its place rather than collapsing,
 * because a section that reflows depending on what is filled in is one where
 * nobody can find the same thing twice.
 *
 * An empty one reads as a dash, the way the employees list this card is opened
 * from already writes them. Spelling it out instead put a sentence in every
 * empty field, and on a new employee that is most of them - a wall of "Not
 * filled in" that the two or three real values had to be picked out of. The
 * dash says the same thing quietly enough to let them show.
 */
export function FieldGrid({ fields }: FieldGridProps) {
  return (
    <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
      {fields.map((field) => (
        <div key={field.label} className="space-y-1">
          <dt className="text-muted-foreground text-xs">{field.label}</dt>
          <dd className="text-foreground text-sm" {...(field.obscured ? piiProps : {})}>
            {field.value || <span className="text-muted-foreground">—</span>}
          </dd>
        </div>
      ))}
    </dl>
  )
}
