/**
 * Step 1: Loan Source & Import Type
 */

import { useTranslation } from 'react-i18next'
import { Textarea } from '@/components/ui/Textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Label } from '@/components/ui/Label'
import { DateSelect } from '@/components/ui/DateSelect'
import { RadioCard } from './RadioCard'
import { useProjects } from '@/features/projects'
import { useSellers } from '@/features/sellers'
import { useAuthStore } from '@/stores/authStore'

export interface Step1Data {
  sellerId: string // Seller ID as string (for Select component compatibility)
  projectCode: string
  purchaseDate: string
  comment: string
  importType: 'simple' | 'vendor'
}

interface Step1LoanSourceProps {
  data: Step1Data
  onChange: (data: Partial<Step1Data>) => void
}

export function Step1LoanSource({ data, onChange }: Step1LoanSourceProps) {
  const { t } = useTranslation('common')
  const userTimezone = useAuthStore((state) => state.user?.timezone)

  // Fetch user's accessible projects (filtered by permissions - admins see all, users see only assigned)
  const { data: projectsData, isLoading: isLoadingProjects } = useProjects({
    page: 1,
    page_size: 100, // Get all accessible projects
    status: 'active', // Only show active projects
  })
  const projects = projectsData?.projects || []

  // Fetch active sellers for dropdown
  const { data: sellersData, isLoading: isLoadingSellers } = useSellers({
    is_active: true,
    limit: 100,
  })
  const sellers = sellersData?.sellers || []

  return (
    <div className="space-y-6">
      {/* Loan Source / Metadata Section */}
      <div>
        <h2 className="text-dark-500 mb-4 text-sm font-medium">
          {t('pages.imports.step1.loanSourceMetadata')}
        </h2>

        <div className="space-y-4">
          {/* First Row: Seller/Creditor and Project Code side by side */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            {/* Seller / Creditor */}
            <div className="flex-1">
              <Label htmlFor="seller-creditor" required className="mb-1.5 block">
                {t('pages.imports.step1.sellerCreditor')}
              </Label>
              <Select
                value={data.sellerId}
                onValueChange={(value) => onChange({ sellerId: value })}
                disabled={isLoadingSellers || sellers.length === 0}
              >
                <SelectTrigger className="w-full" id="seller-creditor">
                  <SelectValue
                    placeholder={
                      isLoadingSellers
                        ? t('pages.imports.step1.placeholders.loadingSellers')
                        : sellers.length === 0
                          ? t('pages.imports.step1.noSellersAvailable')
                          : t('pages.imports.step1.placeholders.selectSellerCreditor')
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {sellers.map((seller) => (
                    <SelectItem key={seller.id} value={seller.id.toString()}>
                      {seller.seller_code} - {seller.seller_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Project Code */}
            <div className="flex-1">
              <Label htmlFor="project-code" required className="mb-1.5 block">
                {t('pages.imports.step1.projectCode')}
              </Label>
              <Select
                value={data.projectCode}
                onValueChange={(value) => onChange({ projectCode: value })}
                disabled={isLoadingProjects || projects.length === 0}
              >
                <SelectTrigger className="w-full" id="project-code">
                  <SelectValue
                    placeholder={
                      isLoadingProjects
                        ? t('pages.imports.step1.placeholders.loadingProjects')
                        : projects.length === 0
                          ? t('pages.imports.step1.noProjectsAvailable')
                          : t('pages.imports.step1.placeholders.selectProjectCode')
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.code}>
                      {project.code} - {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Purchase Date */}
          <div>
            <DateSelect
              id="purchase-date"
              label={t('pages.imports.step1.purchaseDate')}
              required
              value={
                data.purchaseDate
                  ? (() => {
                      // Convert UTC datetime to user's timezone for display
                      if (!data.purchaseDate) return null

                      // Parse UTC datetime string
                      const utcDate = new Date(data.purchaseDate)

                      if (userTimezone) {
                        // Get date components in user's timezone
                        // This ensures the date shown matches what the user expects in their timezone
                        const formatter = new Intl.DateTimeFormat('en-CA', {
                          timeZone: userTimezone,
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                        })

                        const dateStr = formatter.format(utcDate)
                        const [year, month, day] = dateStr.split('-').map(Number)

                        // Create Date object at noon in browser's local timezone
                        // This will be displayed correctly by react-datepicker
                        // The key is we're using the date from user's timezone, not UTC
                        return new Date(year, month - 1, day, 12, 0, 0)
                      }

                      // Fallback: parse UTC date (will show in browser's local timezone)
                      return utcDate
                    })()
                  : null
              }
              onChange={(args) => {
                if (args.value) {
                  // User selects a date - create datetime at start of day (00:00:00) in user's timezone
                  // then convert to UTC for backend storage
                  const selectedDate = args.value
                  const year = selectedDate.getFullYear()
                  const month = selectedDate.getMonth()
                  const day = selectedDate.getDate()

                  if (userTimezone) {
                    // To convert to UTC, we need to:
                    // 1. Create a Date object representing this time in user's timezone
                    // 2. Get the UTC equivalent
                    // Since JavaScript Date works in browser timezone, we use a workaround:
                    // Create date at midnight UTC, then adjust by timezone offset

                    // Better approach: Use Intl API to get UTC time for midnight in user's timezone
                    // Create a date representing the selected date at midnight in user's timezone
                    const tempDate = new Date(
                      `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00Z`
                    )

                    // Get what this date/time is in user's timezone
                    const userTzFormatter = new Intl.DateTimeFormat('en-CA', {
                      timeZone: userTimezone,
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    })

                    const userParts = userTzFormatter.formatToParts(tempDate)
                    const userYear = parseInt(
                      userParts.find((p) => p.type === 'year')?.value || '0'
                    )
                    const userMonth =
                      parseInt(userParts.find((p) => p.type === 'month')?.value || '0') - 1
                    const userDay = parseInt(userParts.find((p) => p.type === 'day')?.value || '0')

                    // If the date matches, use this UTC time
                    if (userYear === year && userMonth === month && userDay === day) {
                      // This UTC time represents noon in user's timezone for this date
                      // For start of day, we need to subtract ~12 hours
                      // Actually, let's use a simpler approach: create at noon UTC
                      const utcDate = new Date(Date.UTC(year, month, day, 12, 0, 0))
                      onChange({ purchaseDate: utcDate.toISOString() })
                    } else {
                      // Date doesn't match, use noon UTC as fallback
                      const utcDate = new Date(Date.UTC(year, month, day, 12, 0, 0))
                      onChange({ purchaseDate: utcDate.toISOString() })
                    }
                  } else {
                    // No timezone: use selected date at noon UTC
                    const utcDate = new Date(Date.UTC(year, month, day, 12, 0, 0))
                    onChange({ purchaseDate: utcDate.toISOString() })
                  }
                } else {
                  onChange({ purchaseDate: '' })
                }
              }}
              placeholder={t('pages.imports.step1.placeholders.selectPurchaseDate')}
            />
          </div>

          {/* Comment */}
          <div className="relative">
            <Textarea
              label={t('pages.imports.step1.comment')}
              placeholder={t('pages.imports.step1.placeholders.placeholderText')}
              value={data.comment}
              onChange={(e) => onChange({ comment: e.target.value })}
              maxLength={100}
              className="pb-8"
            />
            <div className="absolute right-3 bottom-3 text-xs text-gray-500">
              {data.comment.length}/100
            </div>
          </div>
        </div>
      </div>

      {/* Import Type Section */}
      <div>
        <h2 className="text-dark-500 mb-4 text-sm font-medium">
          {t('pages.imports.step1.importType')}
        </h2>

        <div className="flex flex-col gap-4 sm:flex-row">
          <RadioCard
            name="importType"
            value="simple"
            checked={data.importType === 'simple'}
            onChange={(value) => onChange({ importType: value as 'simple' | 'vendor' })}
            title={t('pages.imports.step1.simpleClientCsv')}
            description={t('pages.imports.step1.simpleClientCsvDesc')}
            className="flex-1"
          />

          <RadioCard
            name="importType"
            value="vendor"
            checked={data.importType === 'vendor'}
            onChange={(value) => onChange({ importType: value as 'simple' | 'vendor' })}
            title={t('pages.imports.step1.vendorDump')}
            description={t('pages.imports.step1.vendorDumpDesc')}
            className="flex-1"
          />
        </div>
      </div>
    </div>
  )
}
