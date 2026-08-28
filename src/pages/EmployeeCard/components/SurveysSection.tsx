import { useTranslation } from 'react-i18next'
import type { EmployeeCard } from '@/features/employeeCard/types.card'
import { Icons } from '@/lib/icons'
import { CardSection } from './CardSection'

export interface SurveysSectionProps {
  card: EmployeeCard
  /** Record a new answer. */
  onAdd?: () => void
  /** Correct the one named. */
  onEditSurvey?: (surveyId: number) => void
  /** Remove the one named. */
  onRemoveSurvey?: (surveyId: number) => void
}

/**
 * Survey answers, loaded from wherever the survey actually ran.
 *
 * An answer still being waited on carries no score, so it shows as pending
 * rather than as zero out of a hundred.
 *
 * The link to the details points outside this system, because the survey ran
 * there. It opens in its own tab with the opener withheld, since nothing here
 * chose that address - it arrived in an import.
 *
 * The action records one, for this employee. Surveys run outside the system
 * and most people here are recorded under personal addresses, so a file of
 * answers cannot be attributed to employees by matching what it carries -
 * whoever enters the answer supplies that judgement instead.
 */
export function SurveysSection({ card, onAdd, onEditSurvey, onRemoveSurvey }: SurveysSectionProps) {
  const { t, i18n } = useTranslation()
  const mayEdit = card.can_edit

  return (
    <CardSection
      id="surveys"
      title={t('pages.employeeCard.sections.surveys')}
      action="add"
      {...(mayEdit && onAdd
        ? { editLabel: t('pages.employeeCard.surveys.record'), onEdit: onAdd }
        : {})}
    >
      {card.surveys.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('pages.employeeCard.surveys.none')}</p>
      ) : (
        <ul className="divide-border divide-y">
          {card.surveys.map((survey) => (
            <li key={survey.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-foreground text-sm font-medium">{survey.name}</p>
                {survey.completed_on && (
                  <p className="text-muted-foreground text-xs">
                    {new Date(survey.completed_on).toLocaleDateString(i18n.language)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {/*
                  Both states wear the same pill, so a row that is waiting and
                  a row that scored read as two values of one thing rather than
                  as two different kinds of row. The score keeps its total: a
                  bare number beside a dated answer says nothing about whether
                  it was good.
                */}
                {survey.status === 'pending' || survey.score === null ? (
                  <span className="bg-muted text-muted-foreground rounded-full px-3 py-1 text-xs font-medium">
                    {t('pages.employeeCard.surveys.pending')}
                  </span>
                ) : (
                  <span className="bg-muted text-foreground rounded-full px-3 py-1 text-xs font-medium tabular-nums">
                    {survey.score}/{survey.max_score ?? 100}
                  </span>
                )}

                {survey.details_url && (
                  <a
                    href={survey.details_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary text-sm hover:underline"
                  >
                    {t('pages.employeeCard.surveys.details')}
                  </a>
                )}

                {/*
                  On the row rather than inside the dialog: correcting one
                  answer of several should not mean opening a list and finding
                  it again, when the reader is already looking straight at it.
                */}
                {mayEdit && onEditSurvey && (
                  <button
                    type="button"
                    aria-label={t('pages.employeeCard.surveys.edit', { name: survey.name })}
                    title={t('pages.employeeCard.surveys.edit', { name: survey.name })}
                    onClick={() => onEditSurvey(survey.id)}
                    className="text-muted-foreground hover:text-primary-500 focus-visible:ring-primary-500 focus-visible:ring-offset-card shrink-0 cursor-pointer rounded transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    <Icons.Edit02 size={16} strokeWidth={1.8} />
                  </button>
                )}
                {mayEdit && onRemoveSurvey && (
                  <button
                    type="button"
                    aria-label={t('pages.employeeCard.surveys.remove', { name: survey.name })}
                    title={t('pages.employeeCard.surveys.remove', { name: survey.name })}
                    onClick={() => onRemoveSurvey(survey.id)}
                    className="text-muted-foreground hover:text-destructive focus-visible:ring-destructive focus-visible:ring-offset-card shrink-0 cursor-pointer rounded transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    <Icons.Delete01 size={16} strokeWidth={1.8} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </CardSection>
  )
}
