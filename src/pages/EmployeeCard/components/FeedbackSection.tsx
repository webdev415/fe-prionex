import { useTranslation } from 'react-i18next'
import { useFeedback } from '@/features/quality/hooks/useFeedback'
import type { Feedback } from '@/features/quality/types'
import { QualitySection } from './QualitySection'

export interface FeedbackSectionProps {
  /** Whose card this is. The employee is the operator the feedback was left for. */
  employeeId: number
}

/** Newest first: the last thing said is what somebody opens this to read. */
const NEWEST_FIRST = (left: Feedback, right: Feedback) =>
  new Date(right.created_at).getTime() - new Date(left.created_at).getTime()

/**
 * The feedback a trainer has left this employee, read from the quality service.
 *
 * Only this employee's: ``operator_id`` is the card's own id, never a filter
 * the reader sets. A section that could be pointed at somebody else would be
 * a second, unaudited way to read the whole feedback table.
 */
export function FeedbackSection({ employeeId }: FeedbackSectionProps) {
  const { t, i18n } = useTranslation()

  const { data, isLoading, isError } = useFeedback({ operator_id: [employeeId] })
  const items = [...(data?.data ?? [])].sort(NEWEST_FIRST)

  return (
    <QualitySection
      id="feedback"
      title={t('pages.employeeCard.sections.feedback')}
      isLoading={isLoading}
      isError={isError}
      isEmpty={items.length === 0}
      emptyText={t('pages.employeeCard.feedback.none')}
    >
      <ul className="divide-border divide-y">
        {items.map((item) => (
          <li key={item.id} className="space-y-1.5 py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="border-border text-foreground rounded-full border px-2.5 py-0.5 text-xs">
                {t(`pages.employeeCard.feedback.types.${item.feedback_type}`, item.feedback_type)}
              </span>
              {/*
                Whether it was acted on, not merely sent. A correction task
                that nobody opened is the one row on this list worth chasing.
              */}
              <span className="text-muted-foreground text-xs">
                {t(`pages.employeeCard.feedback.statuses.${item.status}`, item.status)}
              </span>
              <span className="text-muted-foreground ml-auto text-xs">
                {new Date(item.created_at).toLocaleDateString(i18n.language)}
              </span>
            </div>
            <p className="text-foreground text-sm">{item.text}</p>
          </li>
        ))}
      </ul>
    </QualitySection>
  )
}
