import type { ReactNode } from 'react'
import { Icons } from '@/lib/icons'

export interface CardSectionProps {
  id: string
  title: string
  children: ReactNode
  editLabel?: string
  onEdit?: () => void
  /**
   * What the action does to the section. A section whose action adds a row
   * rather than opening what is already there says so with a plus: a pencil
   * over an empty section suggests there is something to correct.
   */
  action?: 'edit' | 'add'
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
export function CardSection({
  id,
  title,
  children,
  editLabel,
  onEdit,
  action = 'edit',
}: CardSectionProps) {
  return (
    <section
      id={id}
      tabIndex={-1}
      aria-labelledby={`${id}-heading`}
      className="border-border bg-card scroll-mt-32 space-y-4 rounded-xl border p-4 sm:p-6"
    >
      {/*
        The heading and its action sit above a rule, so a section reads as a
        titled block rather than a heading loose among its own fields - which
        matters most in the sections that are mostly empty, where nothing else
        marks where one ends and the next begins.
      */}
      <div className="border-border flex items-center justify-between gap-4 border-b pb-4">
        <h2 id={`${id}-heading`} className="text-foreground text-lg font-semibold">
          {title}
        </h2>
        {onEdit && editLabel && (
          // A link rather than a button: no fill, no chip on hover, just the
          // pencil changing colour. And icon only, so the label has to be
          // spoken rather than shown - a pencil on its own tells a screen
          // reader nothing about which section it edits.
          <button
            type="button"
            aria-label={editLabel}
            title={editLabel}
            // States which of the two this is. Both render an svg and neither
            // carries text, so nothing else on the element says whether it
            // opens what is there or adds something new.
            data-action={action}
            onClick={onEdit}
            className="text-muted-foreground hover:text-primary-500 focus-visible:ring-primary-500 focus-visible:ring-offset-card shrink-0 cursor-pointer rounded transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {action === 'add' ? (
              <Icons.Add size={20} strokeWidth={1.8} />
            ) : (
              <Icons.Edit02 size={18} strokeWidth={1.8} />
            )}
          </button>
        )}
      </div>
      {children}
    </section>
  )
}
