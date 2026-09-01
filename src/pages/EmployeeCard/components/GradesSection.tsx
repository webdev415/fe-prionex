import { useTranslation } from 'react-i18next'
import { useScorecards } from '@/features/quality/hooks/useScorecards'
import type { Scorecard } from '@/features/quality/types'
import { QualitySection } from './QualitySection'

export interface GradesSectionProps {
  /** Whose card this is. The employee is the operator who was scored. */
  employeeId: number
}

/** What a grade is out of here, once it has been put on the shared axis. */
const OUT_OF = 100

const NEWEST_FIRST = (left: Scorecard, right: Scorecard) =>
  new Date(right.created_at).getTime() - new Date(left.created_at).getTime()

/**
 * The quality assessments this employee has been given, newest first.
 *
 * Reads the quality service directly rather than waiting on the chronology,
 * and that is the point of it: four of the five event types the timeline
 * listens for have no publisher, so evaluations never reach it. This section
 * shows the history the timeline cannot, from the records themselves.
 *
 * ``trainer_score_100`` is preferred over ``weighted_score`` because the API
 * serves it already on the 0-100 axis - doing the multiplication here would
 * be a second place for it to be got wrong. A scorecard still being written
 * has no score yet, and says so rather than printing a zero.
 */
export function GradesSection({ employeeId }: GradesSectionProps) {
  const { t, i18n } = useTranslation()

  // Finished assessments only. A draft is the trainer's working copy, and
  // nobody has stood behind its score yet - the timeline already refuses to
  // announce one for that reason, and the card should not show through the
  // side door what the history is careful to leave out.
  //
  // It also reads wrong: "Not scored" against somebody's name says the
  // EMPLOYEE was not scored, when what happened is that a trainer has not
  // finished writing.
  const { data, isLoading, isError } = useScorecards({
    operator_id: [employeeId],
    status: ['completed', 'sent'],
  })
  const items = [...(data?.data ?? [])].sort(NEWEST_FIRST)

  const scoreOf = (card: Scorecard) =>
    typeof card.trainer_score_100 === 'number' ? Math.round(card.trainer_score_100) : null

  return (
    <QualitySection
      id="grades"
      title={t('pages.employeeCard.sections.grades')}
      isLoading={isLoading}
      isError={isError}
      isEmpty={items.length === 0}
      emptyText={t('pages.employeeCard.grades.none')}
    >
      <ul className="divide-border divide-y">
        {items.map((card) => {
          const score = scoreOf(card)
          return (
            <li
              key={card.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="text-foreground text-sm font-medium">
                  {card.template_snapshot?.name || t('pages.employeeCard.grades.assessment')}
                </p>
                <p className="text-muted-foreground text-xs">
                  {new Date(card.completed_at ?? card.created_at).toLocaleDateString(i18n.language)}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/*
                  An objection is the reason a reader stops on a row: it says
                  the trainer disagreed with the AI, so the number beside it is
                  contested rather than settled.
                */}
                {card.is_disputed && (
                  <span className="border-border text-muted-foreground rounded-full border px-2.5 py-0.5 text-xs">
                    {t('pages.employeeCard.grades.disputed')}
                  </span>
                )}
                <span className="border-border text-foreground rounded-full border px-2.5 py-0.5 text-xs font-medium">
                  {score === null ? t('pages.employeeCard.grades.notScored') : `${score}/${OUT_OF}`}
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </QualitySection>
  )
}
