import { useTranslation } from 'react-i18next'
import type { EmployeeCard } from '@/features/employeeCard/types.card'
import { CardSection } from './CardSection'

export interface SurveysSectionProps {
  card: EmployeeCard
}

/**
 * Survey answers, loaded from wherever the survey actually ran.
 *
 * An answer still being waited on carries no score, so it shows as pending
 * rather than as zero out of a hundred.
 */
export function SurveysSection({ card }: SurveysSectionProps) {
  const { t, i18n } = useTranslation()

  return (
    <CardSection id="surveys" title={t('pages.employeeCard.sections.surveys')}>
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
              {survey.status === 'pending' || survey.score === null ? (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  {t('pages.employeeCard.surveys.pending')}
                </span>
              ) : (
                <span className="text-foreground text-sm tabular-nums">
                  {survey.max_score ? `${survey.score}/${survey.max_score}` : survey.score}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </CardSection>
  )
}
