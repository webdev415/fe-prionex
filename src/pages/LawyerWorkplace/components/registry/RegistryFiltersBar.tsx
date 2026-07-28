import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { DateSelect } from '@/components/ui/DateSelect'
import { Label } from '@/components/ui/Label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { useLegalLawyers, useLegalLetterTypes } from '@/features/lawyerWorkplace'
import { Icons } from '@/lib/icons'

const ALL_VALUE = 'all'

function parseDateString(value: string): Date | null {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function formatDateString(value: Date | null): string {
  if (!value) return ''
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export interface RegistryFiltersBarProps {
  dateFrom: string
  dateTo: string
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
  letterTypeId: string
  onLetterTypeIdChange: (value: string) => void
  search: string
  onSearchChange: (value: string) => void
  /** Outgoing registry only — responsible-lawyer filter. */
  showLawyerFilter?: boolean
  lawyerId?: string
  onLawyerIdChange?: (value: string) => void
  onExport: () => void
  isExporting: boolean
  exportDisabled?: boolean
  enabled?: boolean
}

export function RegistryFiltersBar({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  letterTypeId,
  onLetterTypeIdChange,
  search,
  onSearchChange,
  showLawyerFilter = false,
  lawyerId = '',
  onLawyerIdChange,
  onExport,
  isExporting,
  exportDisabled = false,
  enabled = true,
}: RegistryFiltersBarProps) {
  const { t } = useTranslation('common')

  const { data: letterTypesData } = useLegalLetterTypes({ enabled })
  const { data: lawyersData } = useLegalLawyers({
    enabled: enabled && showLawyerFilter,
    scopedToActiveProject: true,
  })

  const letterTypes = useMemo(() => letterTypesData?.items ?? [], [letterTypesData?.items])
  const lawyers = useMemo(() => lawyersData?.items ?? [], [lawyersData?.items])

  return (
    <div className="border-border bg-card/50 flex flex-col gap-4 rounded-xl border p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label className="text-foreground text-xs font-medium">
            {t('pages.lawyerWorkplace.registry.filters.from', 'From')}
          </Label>
          <DateSelect
            value={parseDateString(dateFrom)}
            onChange={({ value }) => onDateFromChange(formatDateString(value))}
            max={parseDateString(dateTo) || undefined}
            placeholder={t('pages.lawyerWorkplace.registry.filters.selectStartDate', 'Start date')}
            allowManualInput
            format="dd.MM.yyyy"
            className="[&_input]:h-[42px] [&_input]:text-xs [&_input]:font-normal"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-foreground text-xs font-medium">
            {t('pages.lawyerWorkplace.registry.filters.to', 'To')}
          </Label>
          <DateSelect
            value={parseDateString(dateTo)}
            onChange={({ value }) => onDateToChange(formatDateString(value))}
            min={parseDateString(dateFrom) || undefined}
            placeholder={t('pages.lawyerWorkplace.registry.filters.selectEndDate', 'End date')}
            allowManualInput
            format="dd.MM.yyyy"
            className="[&_input]:h-[42px] [&_input]:text-xs [&_input]:font-normal"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-foreground text-xs font-medium">
            {t('pages.lawyerWorkplace.registry.filters.category', 'Category')}
          </Label>
          <Select
            value={letterTypeId || ALL_VALUE}
            onValueChange={(v) => onLetterTypeIdChange(v === ALL_VALUE ? '' : v)}
          >
            <SelectTrigger className="h-[42px] w-full text-xs">
              <SelectValue
                placeholder={t(
                  'pages.lawyerWorkplace.registry.filters.allCategories',
                  'All categories'
                )}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>
                {t('pages.lawyerWorkplace.registry.filters.allCategories', 'All categories')}
              </SelectItem>
              {letterTypes.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {showLawyerFilter && (
          <div className="flex flex-col gap-1.5">
            <Label className="text-foreground text-xs font-medium">
              {t('pages.lawyerWorkplace.registry.filters.lawyer', 'Responsible')}
            </Label>
            <Select
              value={lawyerId || ALL_VALUE}
              onValueChange={(v) => onLawyerIdChange?.(v === ALL_VALUE ? '' : v)}
            >
              <SelectTrigger className="h-[42px] w-full text-xs">
                <SelectValue
                  placeholder={t(
                    'pages.lawyerWorkplace.registry.filters.allLawyers',
                    'All lawyers'
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>
                  {t('pages.lawyerWorkplace.registry.filters.allLawyers', 'All lawyers')}
                </SelectItem>
                {lawyers.map((lawyer) => (
                  <SelectItem key={lawyer.id} value={String(lawyer.user_id)}>
                    {lawyer.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex w-full flex-col gap-1.5 sm:max-w-[340px]">
          <Label className="text-foreground text-xs font-medium">
            {t('pages.lawyerWorkplace.registry.filters.search', 'Search')}
          </Label>
          <div className="relative">
            <Icons.Search
              size={14}
              strokeWidth={1.5}
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t(
                'pages.lawyerWorkplace.registry.filters.searchPlaceholder',
                'Search by number, email, summary…'
              )}
              className="text-foreground focus:border-primary-400 border-border bg-input placeholder:text-muted-foreground h-[42px] w-full rounded-[8px] border py-2 pr-3 pl-9 text-xs outline-none"
            />
          </div>
        </div>

        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={onExport}
          disabled={isExporting || exportDisabled}
          leftIcon={<Icons.Csv02 size={18} />}
          className="h-[42px] shrink-0"
        >
          {isExporting
            ? t('pages.lawyerWorkplace.registry.export.exporting', 'Exporting…')
            : t('pages.lawyerWorkplace.registry.export.button', 'Export (CSV)')}
        </Button>
      </div>
    </div>
  )
}
