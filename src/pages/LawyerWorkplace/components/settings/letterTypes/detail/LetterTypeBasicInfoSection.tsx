import { useTranslation } from 'react-i18next'
import type { LetterTypeConfig } from '../../../../settings/types'
import { LetterTypeDetailSectionHeader } from './LetterTypeDetailSectionHeader'

interface LetterTypeBasicInfoSectionProps {
  draft: LetterTypeConfig
  onDraftChange: (draft: LetterTypeConfig) => void
}

export function LetterTypeBasicInfoSection({
  draft,
  onDraftChange,
}: LetterTypeBasicInfoSectionProps) {
  const { t } = useTranslation('common')

  return (
    <section>
      <LetterTypeDetailSectionHeader
        title={t('pages.lawyerWorkplace.settings.letterTypes.basicInfo', 'Basic info')}
      />

      <div className="flex w-full flex-col gap-4">
        <div className="flex w-full flex-row items-center gap-5">
          <div className="flex w-full flex-col gap-2">
            <label className="text-dark-500 text-[12px] font-medium">
              {t('pages.lawyerWorkplace.settings.letterTypes.displayName', 'Display name')}
            </label>
            <input
              type="text"
              value={t(draft.nameKey, draft.nameFallback)}
              onChange={(e) =>
                onDraftChange({
                  ...draft,
                  nameFallback: e.target.value,
                  nameKey: `custom:${draft.id}`,
                })
              }
              className="text-dark-500 focus:border-primary-400 h-11 w-full rounded-md border border-gray-200 bg-white px-3 text-[13px] outline-none"
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
                onChange={(e) => onDraftChange({ ...draft, slaDays: Number(e.target.value) || 1 })}
                className="text-dark-500 focus:border-primary-400 h-11 w-full rounded-md border border-gray-200 bg-white px-3 pr-24 text-[13px] outline-none"
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
            onChange={(e) =>
              onDraftChange({
                ...draft,
                descriptionFallback: e.target.value,
                descriptionKey: `custom-desc:${draft.id}`,
              })
            }
            className="text-dark-500 focus:border-primary-400 w-full resize-none rounded-md border border-gray-200 bg-white px-3 py-2.5 text-[13px] outline-none"
          />
        </div>
      </div>
    </section>
  )
}
