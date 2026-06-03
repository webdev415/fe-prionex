/**
 * Step 1: Loan Source & Import Type
 */

import { useEffect } from 'react'
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
import { useSellers, useSellerFactoringAgreements } from '@/features/sellers'
import { useVendorSchemas } from '@/features/imports'
import { useAuthStore } from '@/stores/authStore'

export interface NewFactoringAgreementInput {
  agreement_number: string
  previous_lender: string
  contract_purchase_date: string
}

export interface Step1Data {
  sellerId: string // Seller ID as string (for Select component compatibility)
  projectCode: string
  comment: string
  importType: 'simple' | 'vendor'
  // Vendor flow only — vendor_schemas.code chosen on upload.
  schemaCode?: string
  // Factoring agreement selection (simple flow). The wizard enforces
  // exactly one of `factoringAgreementId` (pick existing) or
  // `newFactoringAgreement` (create new) before allowing step 2.
  factoringAgreementMode: 'existing' | 'new'
  factoringAgreementId: string
  newFactoringAgreement: NewFactoringAgreementInput
  // Derived: legal_name of the currently-selected seller, or null.
  // Lets isStep1Valid require "Who sold" in create-new mode when null —
  // without a legal_name the BE has no fallback for previous_lender, so
  // leaving the field blank would create an agreement with NULL who-sold.
  selectedSellerLegalName: string | null
}

const EMPTY_NEW_FACTORING_AGREEMENT: NewFactoringAgreementInput = {
  agreement_number: '',
  previous_lender: '',
  contract_purchase_date: '',
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

  // Vendor flow: fetch active vendor schemas. Only used / shown when the
  // "vendor" radio is selected. Default-select the first option as soon as
  // the user picks vendor and we don't yet have a schemaCode set.
  const { data: vendorSchemas = [], isLoading: isLoadingVendorSchemas } = useVendorSchemas()
  const isVendor = data.importType === 'vendor'

  // Selected seller — drives the auto-pull legal_name display AND the
  // existing-agreements dropdown's query key.
  const selectedSellerId = data.sellerId ? parseInt(data.sellerId, 10) : null
  const selectedSeller = selectedSellerId
    ? sellers.find((s) => s.id === selectedSellerId)
    : undefined

  // Existing-agreement dropdown — uses includeEmpty so just-created
  // agreements (zero debts yet) remain pickable for any operator.
  // Wizard dropdown needs ALL agreements (operators search/scroll the
  // full list). The endpoint is paginated; pass limit=1000 to retrieve
  // the full set (worst seller has 763 agreements, well under the cap).
  // include_count=false skips the per-row debt_count subquery since the
  // dropdown never displays the count — this drops the wizard call from
  // ~2.1s to ~50ms for high-debt sellers like Егроши Ком.
  const { data: factoringAgreementsPage, isLoading: isLoadingAgreements } =
    useSellerFactoringAgreements(selectedSellerId, {
      limit: 1000,
      include_count: false,
    })
  const factoringAgreements = factoringAgreementsPage?.items ?? []

  // Keep the derived `selectedSellerLegalName` in sync with the seller
  // dropdown selection. Runs on initial mount AND when the sellers list
  // arrives async (pre-populated sellerId without a loaded sellers list
  // would otherwise leave the field stale at null).
  useEffect(() => {
    const legal = selectedSeller?.legal_name ?? null
    if (legal !== data.selectedSellerLegalName) {
      onChange({ selectedSellerLegalName: legal })
    }
  }, [selectedSeller?.legal_name, data.selectedSellerLegalName, onChange])

  const handleSellerChange = (value: string) => {
    // Reset agreement selection when seller changes — locked answer to
    // wizard open question #3. Stale agreement-for-different-seller
    // would either fail BE validation or link debts to the wrong row.
    onChange({
      sellerId: value,
      factoringAgreementId: '',
      newFactoringAgreement: { ...EMPTY_NEW_FACTORING_AGREEMENT },
    })
  }

  const handleAgreementModeChange = (mode: 'existing' | 'new') => {
    onChange({
      factoringAgreementMode: mode,
      // Clear the OTHER mode's state so submit reads exactly one source.
      factoringAgreementId: mode === 'existing' ? data.factoringAgreementId : '',
      newFactoringAgreement:
        mode === 'new' ? data.newFactoringAgreement : { ...EMPTY_NEW_FACTORING_AGREEMENT },
    })
  }

  const handleNewAgreementFieldChange = (
    field: keyof NewFactoringAgreementInput,
    value: string
  ) => {
    onChange({
      newFactoringAgreement: {
        ...data.newFactoringAgreement,
        [field]: value,
      },
    })
  }

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
                {selectedSeller?.legal_name && (
                  <span className="ml-2 font-normal">
                    {t('pages.imports.step1.legalNameInline', {
                      legalName: selectedSeller.legal_name,
                      defaultValue: '(Legal name: {{legalName}})',
                    })}
                  </span>
                )}
              </Label>
              <Select
                value={data.sellerId}
                onValueChange={handleSellerChange}
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

          {/* Factoring agreement (both simple and vendor flows) */}
          <div className="space-y-3">
            <Label required className="mb-1.5 block">
              {t('pages.imports.step1.factoringAgreement.title', 'Factoring agreement')}
            </Label>

            {!selectedSellerId ? (
              <p className="text-sm font-light text-gray-500">
                {t(
                  'pages.imports.step1.factoringAgreement.pickSellerFirst',
                  'Pick a seller first.'
                )}
              </p>
            ) : (
              <>
                <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="factoringAgreementMode"
                      value="existing"
                      checked={data.factoringAgreementMode === 'existing'}
                      onChange={() => handleAgreementModeChange('existing')}
                    />
                    {t('pages.imports.step1.factoringAgreement.pickExisting', 'Pick existing')}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="factoringAgreementMode"
                      value="new"
                      checked={data.factoringAgreementMode === 'new'}
                      onChange={() => handleAgreementModeChange('new')}
                    />
                    {t('pages.imports.step1.factoringAgreement.createNew', 'Create new')}
                  </label>
                </div>

                {data.factoringAgreementMode === 'existing' && (
                  <Select
                    value={data.factoringAgreementId}
                    onValueChange={(value) => onChange({ factoringAgreementId: value })}
                    disabled={isLoadingAgreements}
                  >
                    <SelectTrigger className="w-full" id="factoring-agreement-id">
                      <SelectValue
                        placeholder={
                          isLoadingAgreements
                            ? t('pages.imports.step1.factoringAgreement.loading', 'Loading…')
                            : factoringAgreements.length === 0
                              ? t(
                                  'pages.imports.step1.factoringAgreement.emptyForSeller',
                                  'No agreements yet — create one'
                                )
                              : t(
                                  'pages.imports.step1.factoringAgreement.selectExisting',
                                  'Select agreement'
                                )
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {factoringAgreements.map((fa) => {
                        const lender = fa.previous_lender ?? '—'
                        const dateStr = fa.contract_purchase_date ?? '—'
                        return (
                          <SelectItem key={fa.id} value={fa.id.toString()}>
                            {fa.agreement_number} — {lender} ({dateStr})
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                )}

                {data.factoringAgreementMode === 'new' && (
                  <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3">
                    <Input
                      label={t(
                        'pages.imports.step1.factoringAgreement.fields.number',
                        'Agreement number'
                      )}
                      required
                      value={data.newFactoringAgreement.agreement_number}
                      onChange={(e) =>
                        handleNewAgreementFieldChange('agreement_number', e.target.value)
                      }
                      maxLength={100}
                    />
                    <div>
                      <Input
                        label={t(
                          'pages.imports.step1.factoringAgreement.fields.previousLender',
                          'Who sold'
                        )}
                        required={!selectedSeller?.legal_name}
                        value={data.newFactoringAgreement.previous_lender}
                        onChange={(e) =>
                          handleNewAgreementFieldChange('previous_lender', e.target.value)
                        }
                        maxLength={255}
                        placeholder={
                          selectedSeller?.legal_name
                            ? t(
                                'pages.imports.step1.factoringAgreement.fields.previousLenderPlaceholderWithFallback',
                                "If left blank, the seller's legal name will be inserted."
                              )
                            : t(
                                'pages.imports.step1.factoringAgreement.fields.previousLenderPlaceholderGeneric',
                                'Enter the entity that sold the debt'
                              )
                        }
                      />
                      {!selectedSeller?.legal_name && (
                        <p className="mt-1.5 text-xs text-gray-500">
                          {t(
                            'pages.imports.step1.factoringAgreement.fields.previousLenderRequiredHint',
                            'This seller has no legal name on file, so "Who sold" is required.'
                          )}
                        </p>
                      )}
                    </div>
                    <DateSelect
                      id="new-fa-contract-purchase-date"
                      label={t(
                        'pages.imports.step1.factoringAgreement.fields.contractPurchaseDate',
                        'Contract purchase date'
                      )}
                      required
                      value={
                        data.newFactoringAgreement.contract_purchase_date
                          ? (() => {
                              // Convert UTC datetime ISO back to a Date object that
                              // react-datepicker renders as the correct calendar day in
                              // the user's timezone (mirrors the old top-level picker's
                              // timezone-aware display logic).
                              const utcDate = new Date(
                                data.newFactoringAgreement.contract_purchase_date
                              )
                              if (userTimezone) {
                                const formatter = new Intl.DateTimeFormat('en-CA', {
                                  timeZone: userTimezone,
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                })
                                const dateStr = formatter.format(utcDate)
                                const [year, month, day] = dateStr.split('-').map(Number)
                                return new Date(year, month - 1, day, 12, 0, 0)
                              }
                              return utcDate
                            })()
                          : null
                      }
                      onChange={(args) => {
                        if (!args.value) {
                          handleNewAgreementFieldChange('contract_purchase_date', '')
                          return
                        }
                        // Mirror the old picker — store the chosen day as a UTC
                        // datetime ISO (noon UTC). BE strips the time portion
                        // before persisting to the date column.
                        const selectedDate = args.value
                        const year = selectedDate.getFullYear()
                        const month = selectedDate.getMonth()
                        const day = selectedDate.getDate()
                        const utcDate = new Date(Date.UTC(year, month, day, 12, 0, 0))
                        handleNewAgreementFieldChange(
                          'contract_purchase_date',
                          utcDate.toISOString()
                        )
                      }}
                      placeholder={t(
                        'pages.imports.step1.factoringAgreement.fields.contractPurchaseDatePlaceholder',
                        'Select contract purchase date'
                      )}
                    />
                  </div>
                )}
              </>
            )}
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

        {isVendor && (
          <div className="mt-4">
            <Label htmlFor="vendor-schema-code" required className="mb-1.5 block">
              {t('pages.imports.step1.vendorSchema', 'Vendor schema')}
            </Label>
            <Select
              value={data.schemaCode ?? ''}
              onValueChange={(value) => onChange({ schemaCode: value })}
              disabled={isLoadingVendorSchemas || vendorSchemas.length === 0}
            >
              <SelectTrigger className="w-full" id="vendor-schema-code">
                <SelectValue
                  placeholder={
                    isLoadingVendorSchemas
                      ? t('pages.imports.step1.placeholders.loadingVendorSchemas', 'Loading…')
                      : vendorSchemas.length === 0
                        ? t(
                            'pages.imports.step1.noVendorSchemasAvailable',
                            'No vendor schemas configured'
                          )
                        : t(
                            'pages.imports.step1.placeholders.selectVendorSchema',
                            'Select vendor schema'
                          )
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {vendorSchemas.map((s) => (
                  <SelectItem key={s.code} value={s.code}>
                    {s.display_name} ({s.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  )
}
