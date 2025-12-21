/**
 * Step 1: Loan Source & Import Type
 */

import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/Input'
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

export interface Step1Data {
  sellerCreditor: string
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
  const { data: projectsData } = useProjects({ page: 1, page_size: 100 })
  const projects = projectsData?.projects || []

  return (
    <div className="space-y-6">
      {/* Loan Source / Metadata Section */}
      <div>
        <h2 className="text-dark-500 mb-4 text-sm font-medium">
          {t('pages.imports.step1.loanSourceMetadata')}
        </h2>

        <div className="space-y-4">
          {/* First Row: Seller/Creditor and Project Code side by side */}
          <div className="flex items-end gap-4">
            {/* Seller / Creditor */}
            <div className="flex-1">
              <Label htmlFor="seller-creditor" required className="mb-1.5 block">
                {t('pages.imports.step1.sellerCreditor')}
              </Label>
              <Select
                value={data.sellerCreditor}
                onValueChange={(value) => onChange({ sellerCreditor: value })}
              >
                <SelectTrigger className="w-full" id="seller-creditor">
                  <SelectValue
                    placeholder={t('pages.imports.step1.placeholders.enterProjectName')}
                  />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={String(project.id)}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Project Code */}
            <div className="flex-1">
              <Input
                label={t('pages.imports.step1.projectCode')}
                placeholder={t('pages.imports.step1.placeholders.enterProjectCode')}
                value={data.projectCode}
                onChange={(e) => onChange({ projectCode: e.target.value })}
              />
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

        <div className="flex gap-4">
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
