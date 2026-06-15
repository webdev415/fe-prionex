import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { PRIORITY_LAWYER_META } from '../../../../settings/settingsData'
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

  const priorityRows = useMemo(
    () =>
      PRIORITY_LAWYER_META.map((lawyer) => {
        const assignment =
          draft.priorities.find((item) => item.lawyerId === lawyer.id) ??
          ({ lawyerId: lawyer.id, stars: 0, role: 'off' } as LetterTypePriorityAssignment)
        return { lawyer, assignment }
      }),
    [draft.priorities]
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

      <div className="space-y-2">
        {priorityRows.map(({ lawyer, assignment }) => (
          <div
            key={lawyer.id}
            className="grid gap-3 rounded-xl bg-white px-4 py-3 lg:grid-cols-[minmax(180px,1fr)_auto_auto_auto] lg:items-center"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="bg-secondary-100 text-secondary-800 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold">
                {lawyer.initials}
              </div>
              <div className="min-w-0">
                <p className="text-dark-500 truncate text-[13px] font-semibold">
                  {t(lawyer.nameKey, lawyer.nameFallback)}
                </p>
                <p className="text-light-600 truncate text-[11px]">
                  {t(lawyer.roleKey, lawyer.roleFallback)}
                </p>
              </div>
            </div>

            <p className="text-light-600 text-[12px] lg:text-center">
              {t('pages.lawyerWorkplace.settings.letterTypes.activeLoad', {
                current: lawyer.activeCount,
                max: lawyer.maxActive,
                defaultValue: `${lawyer.activeCount} / ${lawyer.maxActive} active`,
              })}
            </p>

            <LawyerStarRating
              value={assignment.stars}
              onChange={(stars) =>
                onDraftChange(
                  updateLetterTypePriority(draft, lawyer.id, { stars: Math.max(0, stars) })
                )
              }
            />

            <div className="flex lg:justify-end">
              <LawyerRoleBadge
                role={assignment.role}
                onSelect={(role) =>
                  onDraftChange(updateLetterTypePriority(draft, lawyer.id, { role }))
                }
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
