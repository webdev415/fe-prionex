import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useLawyerWorkplaceLayout } from '../../../../context/lawyerWorkplaceLayout'
import type { LetterTypeConfig } from '../../../../settings/types'
import { LetterTypeDetailSectionHeader } from './LetterTypeDetailSectionHeader'

const inputClassName =
  'text-dark-500 focus:border-primary-400 h-11 w-full rounded-md border border-border bg-input px-3 text-[13px] outline-none disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-light-700'

interface LetterTypeBasicInfoSectionProps {
  draft: LetterTypeConfig
  onDraftChange: (draft: LetterTypeConfig) => void
  readOnly?: boolean
}

export function LetterTypeBasicInfoSection({
  draft,
  onDraftChange,
  readOnly = false,
}: LetterTypeBasicInfoSectionProps) {
  const { t } = useTranslation('common')
  const { isCompact } = useLawyerWorkplaceLayout()

  return (
    <section>
      <LetterTypeDetailSectionHeader
        title={t('pages.lawyerWorkplace.settings.letterTypes.basicInfo', 'Basic info')}
      />

      <div className="flex w-full flex-col gap-4">
        <div
          className={cn(
            'flex w-full gap-4',
            isCompact ? 'flex-col' : 'flex-row items-center gap-5'
          )}
        >
          <div className="flex w-full flex-col gap-2">
            <label className="text-dark-500 text-[12px] font-medium">
              {t('pages.lawyerWorkplace.settings.letterTypes.displayName', 'Display name')}
            </label>
            <input
              type="text"
              value={t(draft.nameKey, draft.nameFallback)}
              disabled={readOnly}
              readOnly={readOnly}
              onChange={(e) => {
                if (readOnly) return
                onDraftChange({
                  ...draft,
                  nameFallback: e.target.value,
                  nameKey: `custom:${draft.id}`,
                })
              }}
              className={inputClassName}
            />
          </div>

          <div className="flex w-full flex-col gap-2">
            <label className="text-dark-500 text-[12px] font-medium">
              {t('pages.lawyerWorkplace.settings.letterTypes.responseSla', 'Response SLA')}
            </label>
            <div className="relative">
              <input
                type="number"
                min={1}
                value={draft.slaDays}
                disabled={readOnly}
                readOnly={readOnly}
                onChange={(e) => {
                  if (readOnly) return
                  onDraftChange({ ...draft, slaDays: Number(e.target.value) || 1 })
                }}
                className={cn(inputClassName, 'pr-24')}
              />
              <span className="text-light-400 pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[12px] font-light">
                {t('pages.lawyerWorkplace.settings.letterTypes.businessDays', 'business days')}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-dark-500 text-[12px] font-medium">
            {t('pages.lawyerWorkplace.settings.letterTypes.description', 'Description')}
          </label>
          <input
            value={t(draft.descriptionKey, draft.descriptionFallback)}
            disabled={readOnly}
            readOnly={readOnly}
            onChange={(e) => {
              if (readOnly) return
              onDraftChange({
                ...draft,
                descriptionFallback: e.target.value,
                descriptionKey: `custom-desc:${draft.id}`,
              })
            }}
            className={cn(inputClassName, 'h-auto py-2.5')}
          />
        </div>
      </div>
    </section>
  )
}
