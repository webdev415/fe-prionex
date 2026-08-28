import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'

export interface CardSectionProps {
  id: string
  title: string
  children: ReactNode
  editLabel?: string
  onEdit?: () => void
}

/**
 * One section of the card, with the edit action its dialog hangs off.
 *
 * The action is only rendered when there is one: a reader who cannot edit
 * should not see a control that would refuse them, which is the difference
 * between a card that is read-only and one that looks broken.
 *
 * ``scroll-mt-32`` is 128px, the height of the sticky header above - the same
 * number ``CARD_HEADER_OFFSET`` gives the scroll spy. A clicked section would
 * otherwise land underneath the bar that sent the reader to it.
 *
 * ``scroll-mt`` keeps the heading clear of the sticky bar when the tabs
 * scroll here, and ``tabIndex`` lets the same jump move focus so a keyboard
 * reader lands where a mouse reader looks.
 */
export function CardSection({ id, title, children, editLabel, onEdit }: CardSectionProps) {
  return (
    <section
      id={id}
      tabIndex={-1}
      aria-labelledby={`${id}-heading`}
      className="border-border bg-card scroll-mt-32 space-y-4 rounded-xl border p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 id={`${id}-heading`} className="text-foreground text-lg font-semibold">
          {title}
        </h2>
        {onEdit && editLabel && (
          <Button type="button" variant="secondary" size="sm" onClick={onEdit}>
            {editLabel}
          </Button>
        )}
      </div>
      {children}
    </section>
  )
}
