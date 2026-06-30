import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useLegalLawyers } from '@/features/lawyerWorkplace/hooks/useLegalInbox'
import { useLawyerWorkplaceLayout } from '../../../../context/lawyerWorkplaceLayout'
import type { LetterTypeConfig, LetterTypePriorityAssignment } from '../../../../settings/types'
import { updateLetterTypePriority } from '../../../../settings/utils/letterTypeHelpers'
import { LawyerRoleBadge } from './LawyerRoleBadge'
import { LawyerStarRating } from './LawyerStarRating'
import { LetterTypeDetailSectionHeader } from './LetterTypeDetailSectionHeader'

interface LetterTypePrioritySectionProps {
  draft: LetterTypeConfig
  onDraftChange: (draft: LetterTypeConfig) => void
}

export function LetterTypePrioritySection({
  draft,
  onDraftChange,
}: LetterTypePrioritySectionProps) {
  const { t } = useTranslation('common')
  const { isCompact } = useLawyerWorkplaceLayout()
  const { data: lawyersData, isLoading } = useLegalLawyers()

  const lawyers = useMemo(
    () => (lawyersData?.items ?? []).filter((lawyer) => lawyer.is_active),
    [lawyersData?.items]
  )

  const priorityRows = useMemo(
    () =>
      lawyers.map((lawyer) => {
        const assignment =
          draft.priorities.find((item) => item.lawyerId === lawyer.id) ??
          ({ lawyerId: lawyer.id, stars: 0, role: 'off' } as LetterTypePriorityAssignment)
        return { lawyer, assignment }
      }),
    [draft.priorities, lawyers]
  )

  return (
    <section>
      <LetterTypeDetailSectionHeader
        title={t(
          'pages.lawyerWorkplace.settings.letterTypes.priorityAssignment',
          'Priority assignment'
        )}
        hint={t(
          'pages.lawyerWorkplace.settings.letterTypes.priorityHint',
          '★ = how strongly this lawyer should be preferred for this type'
        )}
      />

      {isLoading && (
        <p className="text-light-600 text-[13px]">
          {t('pages.lawyerWorkplace.settings.loadingLawyers', 'Loading lawyers…')}
        </p>
      )}

      {!isLoading && priorityRows.length === 0 && (
        <p className="text-light-600 text-[13px]">
          {t('pages.lawyerWorkplace.settings.noLawyers', 'No active lawyers configured')}
        </p>
      )}

      <div className="space-y-2">
        {priorityRows.map(({ lawyer, assignment }) => (
          <div
            key={lawyer.id}
            className={cn(
              'grid gap-3 rounded-xl bg-white px-4 py-3',
              isCompact
                ? 'grid-cols-1'
                : 'lg:grid-cols-[minmax(180px,1fr)_auto_auto_auto] lg:items-center'
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="bg-secondary-100 text-secondary-800 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold">
                {lawyer.initials}
              </div>
              <div className="min-w-0">
                <p className="text-dark-500 truncate text-[13px] font-semibold">
                  {lawyer.display_name}
                </p>
                <p className="text-light-600 truncate text-[11px]">
                  {lawyer.role_title ??
                    t('pages.lawyerWorkplace.settings.lawyers.noRole', 'Legal team')}
                </p>
              </div>
            </div>

            <p className={cn('text-light-600 text-[12px]', !isCompact && 'lg:text-center')}>
              {t('pages.lawyerWorkplace.settings.letterTypes.activeLoad', {
                current: lawyer.current_active,
                max: lawyer.max_in_flight,
                defaultValue: `${lawyer.current_active} / ${lawyer.max_in_flight} active`,
              })}
            </p>

            <div
              className={cn(
                'flex items-center gap-3',
                isCompact ? 'justify-between' : 'lg:contents'
              )}
            >
              <LawyerStarRating
                value={assignment.stars}
                onChange={(stars) =>
                  onDraftChange(
                    updateLetterTypePriority(draft, lawyer.id, { stars: Math.max(0, stars) })
                  )
                }
              />

              <div className={cn('flex', !isCompact && 'lg:justify-end')}>
                <LawyerRoleBadge
                  role={assignment.role}
                  onSelect={(role) =>
                    onDraftChange(updateLetterTypePriority(draft, lawyer.id, { role }))
                  }
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
