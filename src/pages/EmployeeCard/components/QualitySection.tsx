import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CardSection } from './CardSection'

export interface QualitySectionProps {
  id: string
  title: string
  isLoading: boolean
  isError: boolean
  /** Nothing came back, as opposed to nothing having arrived yet. */
  isEmpty: boolean
  emptyText: string
  children: ReactNode
}

/**
 * The frame the two quality-fed sections share.
 *
 * Both read a service the card does not own, so both can be loading, refused
 * or unreachable while everything around them is fine. That is deliberate:
 * the card is assembled from this service's own tables and these two are
 * fetched separately, so an outage over there costs two panels rather than
 * the whole page.
 *
 * Which means the failure has to be said in the section rather than thrown -
 * a reader who sees an empty box cannot tell "nothing recorded" from "we
 * could not ask", and those call for different next steps.
 *
 * Read-only throughout. Feedback and grades are written where they are given,
 * in the quality workspace; a pencil here would offer an edit the card has no
 * endpoint to make.
 */
export function QualitySection({
  id,
  title,
  isLoading,
  isError,
  isEmpty,
  emptyText,
  children,
}: QualitySectionProps) {
  const { t } = useTranslation()

  return (
    <CardSection id={id} title={title}>
      {isLoading ? (
        <div className="space-y-2" aria-hidden="true">
          {[0, 1, 2].map((row) => (
            <div key={row} className="bg-muted h-12 animate-pulse rounded-lg" />
          ))}
          <span className="sr-only">{t('common.loading')}</span>
        </div>
      ) : isError ? (
        // Stated, not silent. The rest of the card is still trustworthy, and
        // saying which part is missing is what keeps it that way.
        <p role="alert" className="text-muted-foreground text-sm">
          {t('pages.employeeCard.quality.unavailable')}
        </p>
      ) : isEmpty ? (
        <p className="text-muted-foreground text-sm">{emptyText}</p>
      ) : (
        children
      )}
    </CardSection>
  )
}
