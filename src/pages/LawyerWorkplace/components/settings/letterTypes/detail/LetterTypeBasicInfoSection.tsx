import { useTranslation } from 'react-i18next'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { cn } from '@/lib/utils'
import { useLawyerWorkplaceLayout } from '../../../../context/lawyerWorkplaceLayout'
import type { LetterTypeConfig, SlaDayType } from '../../../../settings/types'
import { LetterTypeDetailSectionHeader } from './LetterTypeDetailSectionHeader'

const inputClassName =
  'text-foreground focus:border-primary-400 h-11 w-full rounded-md border border-border bg-input px-3 text-[13px] outline-none disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground'

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
            <label className="text-foreground text-[12px] font-medium">
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
            <label className="text-foreground text-[12px] font-medium">
              {t('pages.lawyerWorkplace.settings.letterTypes.responseSla', 'Response SLA')}
            </label>
            <div className="flex items-center gap-2">
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
                className={cn(inputClassName, 'w-20 shrink-0')}
                aria-label={t(
                  'pages.lawyerWorkplace.settings.letterTypes.responseSla',
                  'Response SLA'
                )}
              />
              <Select
                value={draft.slaDayType}
                disabled={readOnly}
                onValueChange={(value) => {
                  if (readOnly) return
                  onDraftChange({ ...draft, slaDayType: value as SlaDayType })
                }}
              >
                <SelectTrigger
                  className="h-11 flex-1 rounded-md"
                  aria-label={t(
                    'pages.lawyerWorkplace.settings.letterTypes.slaDayTypeLabel',
                    'SLA day type'
                  )}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="working">
                    {t(
                      'pages.lawyerWorkplace.settings.letterTypes.slaDayTypeWorking',
                      'Working days'
                    )}
                  </SelectItem>
                  <SelectItem value="calendar">
                    {t(
                      'pages.lawyerWorkplace.settings.letterTypes.slaDayTypeCalendar',
                      'Calendar days'
                    )}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-foreground text-[12px] font-medium">
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
