import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
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
  readOnly?: boolean
}

export function LetterTypePrioritySection({
  draft,
  onDraftChange,
  readOnly = false,
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

      {isLoading ? (
        <>
          <span className="sr-only">
            {t('pages.lawyerWorkplace.settings.loadingLawyers', 'Loading lawyers…')}
          </span>
          <div className="space-y-2" aria-hidden="true">
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={index}
                className={cn(
                  'bg-card grid gap-3 rounded-xl px-4 py-3',
                  isCompact
                    ? 'grid-cols-1'
                    : 'lg:grid-cols-[minmax(180px,1fr)_auto_auto_auto] lg:items-center'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="bg-muted h-9 w-9 shrink-0 animate-pulse rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="bg-muted h-3.5 w-28 animate-pulse rounded" />
                    <div className="bg-muted h-3 w-20 animate-pulse rounded" />
                  </div>
                </div>
                <div className="bg-muted h-3 w-16 animate-pulse rounded" />
                <div className="flex gap-1">
                  {Array.from({ length: 4 }).map((__, starIndex) => (
                    <div key={starIndex} className="bg-muted h-4 w-4 animate-pulse rounded" />
                  ))}
                </div>
                <div className="bg-muted h-7 w-20 animate-pulse rounded-full" />
              </div>
            ))}
          </div>
        </>
      ) : null}

      {!isLoading && priorityRows.length === 0 ? (
        <div className="border-border bg-card flex flex-col items-center justify-center rounded-xl border border-dashed px-4 py-8 text-center">
          <div className="bg-muted mb-3 flex h-10 w-10 items-center justify-center rounded-full">
            <Icons.UserMultiple02 size={18} strokeWidth={1.5} className="text-muted-foreground" />
          </div>
          <p className="text-foreground text-[13px] font-medium">
            {t(
              'pages.lawyerWorkplace.settings.letterTypes.priorityEmpty.title',
              'No lawyers to assign'
            )}
          </p>
          <p className="text-muted-foreground mt-1 max-w-sm text-[12px] leading-relaxed">
            {t(
              'pages.lawyerWorkplace.settings.letterTypes.priorityEmpty.description',
              'Add lawyers in the Lawyers tab, then set star ratings and roles for this letter type.'
            )}
          </p>
        </div>
      ) : null}

      {!isLoading ? (
        <div className="space-y-2">
          {priorityRows.map(({ lawyer, assignment }) => (
            <div
              key={lawyer.id}
              className={cn(
                'bg-card grid gap-3 rounded-xl px-4 py-3',
                readOnly && 'bg-muted/80',
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
                  <p className="text-foreground truncate text-[13px] font-semibold">
                    {lawyer.display_name}
                  </p>
                  <p className="text-muted-foreground truncate text-[11px]">
                    {lawyer.role_title ??
                      t('pages.lawyerWorkplace.settings.lawyers.noRole', 'Legal team')}
                  </p>
                </div>
              </div>

              <p
                className={cn('text-muted-foreground text-[12px]', !isCompact && 'lg:text-center')}
              >
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
                  disabled={readOnly}
                  onChange={(stars) =>
                    onDraftChange(
                      updateLetterTypePriority(draft, lawyer.id, { stars: Math.max(0, stars) })
                    )
                  }
                />

                <div className={cn('flex', !isCompact && 'lg:justify-end')}>
                  <LawyerRoleBadge
                    role={assignment.role}
                    disabled={readOnly}
                    onSelect={(role) =>
                      onDraftChange(updateLetterTypePriority(draft, lawyer.id, { role }))
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}
