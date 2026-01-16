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
              value={data.purchaseDate}
              onChange={(args) => {
                const dateStr = args.value ? args.value.toISOString().split('T')[0] : ''
                onChange({ purchaseDate: dateStr })
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
