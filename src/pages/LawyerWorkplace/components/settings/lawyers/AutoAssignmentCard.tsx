import { Trans, useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { useLawyerWorkplaceLayout } from '../../../context/lawyerWorkplaceLayout'

type StepConfig = {
  badgeKey: string
  badgeFallback: string
  titleKey: string
  titleFallback: string
  descriptionKey: string
  descriptionFallback: string
  badgeClass: string
  variant?: 'fallback'
  titleAfterKey?: string
  titleAfterFallback?: string
}

export function AutoAssignmentCard() {
  const { t } = useTranslation('common')
  const { isCompact } = useLawyerWorkplaceLayout()

  const steps: StepConfig[] = [
    {
      badgeKey: 'pages.lawyerWorkplace.settings.lawyers.steps.step1Badge',
      badgeFallback: 'STEP 1',
      titleKey: 'pages.lawyerWorkplace.settings.lawyers.steps.step1Title',
      titleFallback: 'Specialization match',
      descriptionKey: 'pages.lawyerWorkplace.settings.lawyers.steps.step1Desc',
      descriptionFallback:
        'Lawyers whose specialization includes this letter type (★ rating in their profile)',
      badgeClass: 'bg-secondary-100 text-secondary-800',
    },
    {
      badgeKey: 'pages.lawyerWorkplace.settings.lawyers.steps.step2Badge',
      badgeFallback: 'STEP 2',
      titleKey: 'pages.lawyerWorkplace.settings.lawyers.steps.step2Title',
      titleFallback: 'Pick lowest load',
      descriptionKey: 'pages.lawyerWorkplace.settings.lawyers.steps.step2Desc',
      descriptionFallback:
        'Among specialists under their cap, assign to whoever has fewest active tasks.',
      badgeClass: 'bg-secondary-100 text-secondary-800',
    },
    {
      badgeKey: 'pages.lawyerWorkplace.settings.lawyers.steps.fallbackBadge',
      badgeFallback: 'FALLBACK',
      titleKey: 'pages.lawyerWorkplace.settings.lawyers.steps.fallbackTitleBefore',
      titleFallback: 'All specialists full',
      titleAfterKey: 'pages.lawyerWorkplace.settings.lawyers.steps.fallbackTitleAfter',
      titleAfterFallback: 'round-robin',
      descriptionKey: 'pages.lawyerWorkplace.settings.lawyers.steps.fallbackDesc',
      descriptionFallback:
        'If every specialist hit their cap, the next available lawyer (any specialization) gets the task.',
      badgeClass: 'bg-warning-100 text-warning-700',
      variant: 'fallback',
    },
  ]

  return (
    <div className="rounded-xl bg-white/50 p-5 sm:p-6">
      <h2 className="text-dark-500 mb-2 text-[15px] font-medium">
        {t('pages.lawyerWorkplace.settings.lawyers.autoAssignmentTitle', 'Assignment algorithm')}
      </h2>
      <p className="text-light-600 mb-5 text-[12px] leading-relaxed">
        <Trans
          i18nKey="pages.lawyerWorkplace.settings.lawyers.autoAssignmentDesc"
          components={{ strong: <span className="font-semibold" /> }}
        />
      </p>

      <div className={cn('grid gap-3', isCompact ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-3')}>
        {steps.map((step) => (
          <div key={step.titleKey} className="flex flex-col gap-2 rounded-xl bg-white p-4">
            <div className="flex flex-row items-start justify-between gap-2">
              {step.variant === 'fallback' ? (
                <h3 className="text-warning-700 flex min-w-0 items-center gap-1 text-[13px] font-medium">
                  <span>{t(step.titleKey, step.titleFallback)}</span>
                  <Icons.ArrowRight02 size={12} strokeWidth={1.5} className="shrink-0" />
                  <span>{t(step.titleAfterKey!, step.titleAfterFallback!)}</span>
                </h3>
              ) : (
                <h3 className="text-dark-500 text-[13px] font-medium">
                  {t(step.titleKey, step.titleFallback)}
                </h3>
              )}
              <span
                className={cn(
                  'inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-normal tracking-wide',
                  step.badgeClass
                )}
              >
                {t(step.badgeKey, step.badgeFallback)}
              </span>
            </div>

            <p className="text-light-600 text-[11px] leading-relaxed">
              {t(step.descriptionKey, step.descriptionFallback)}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
