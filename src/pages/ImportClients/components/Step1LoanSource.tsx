/**
 * Step 1: Loan Source & Import Type
 */

import { useEffect, useRef } from 'react'
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
import { RadioGroup, RadioItem } from '@/components/ui/Radio'
import { RadioCard } from './RadioCard'
import { useProjects } from '@/features/projects'
import { useSellers, useSellerFactoringAgreements } from '@/features/sellers'
import {
  DEFAULT_SALE_TYPE,
  SALE_TYPES,
  saleTypeByPurchaseDate,
  saleTypeLabelKey,
  toSaleType,
} from '@/features/sellers/saleType'
import { useVendorSchemas } from '@/features/imports'
import { useAuthStore } from '@/stores/authStore'
import {
  EMPTY_NEW_FACTORING_AGREEMENT,
  type NewFactoringAgreementInput,
  type SaleTypeConflict,
} from '../utils/newFactoringAgreement'

// The shape moved next to its empty value; re-exported so importers of the step
// keep working.
export type { NewFactoringAgreementInput }

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
  // Set when the upload came back 409 SALE_TYPE_CONFLICT: the wizard returns
  // to this step and says which type the seller's agreement with that number
  // already has. Any edit to the agreement, the seller or the mode clears it,
  // and it is shown only while the seller and the number are still the ones
  // the upload was sent with.
  saleTypeConflict?: SaleTypeConflict | null
  // True once the operator picked the new agreement's type by hand. Until then
  // the type follows the purchase date (the 30.07.2026 boundary); after it, the
  // date no longer moves it. A form flag, not part of the request body. A new
  // seller or mode empties the create block and clears it.
  saleTypeChosen?: boolean
}

interface Step1LoanSourceProps {
  data: Step1Data
  onChange: (data: Partial<Step1Data>) => void
}

const SALE_TYPE_CONFLICT_ID = 'new-fa-sale-type-conflict'
const SALE_TYPE_HINT_ID = 'new-fa-sale-type-hint'
const PURCHASE_DATE_HINT_ID = 'new-fa-purchase-date-hint'

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
      saleTypeChosen: false,
      saleTypeConflict: null,
    })
  }

  const handleAgreementModeChange = (mode: 'existing' | 'new') => {
    onChange({
      factoringAgreementMode: mode,
      // Clear the OTHER mode's state so submit reads exactly one source.
      factoringAgreementId: mode === 'existing' ? data.factoringAgreementId : '',
      newFactoringAgreement:
        mode === 'new' ? data.newFactoringAgreement : { ...EMPTY_NEW_FACTORING_AGREEMENT },
      saleTypeChosen: false,
      saleTypeConflict: null,
    })
  }

  const handleNewAgreementFieldChange = (
    field: Exclude<keyof NewFactoringAgreementInput, 'sale_type'>,
    value: string
  ) => {
    onChange({
      newFactoringAgreement: {
        ...data.newFactoringAgreement,
        [field]: value,
      },
      saleTypeConflict: null,
    })
  }

  const handleSaleTypeChange = (value: string) => {
    const saleType = toSaleType(value)
    if (!saleType) return
    onChange({
      newFactoringAgreement: { ...data.newFactoringAgreement, sale_type: saleType },
      saleTypeChosen: true,
      saleTypeConflict: null,
    })
  }

  // Until the operator picks the type, it follows the purchase date — so a
  // historical import typed in with its old date is not sent as cession by a
  // default nobody looked at. No date means the default again.
  const handlePurchaseDateChange = (value: string) => {
    const saleType = data.saleTypeChosen
      ? data.newFactoringAgreement.sale_type
      : (saleTypeByPurchaseDate(value) ?? DEFAULT_SALE_TYPE)
    onChange({
      newFactoringAgreement: {
        ...data.newFactoringAgreement,
        contract_purchase_date: value,
        sale_type: saleType,
      },
      saleTypeConflict: null,
    })
  }

  // null for a type the server did not send (not rolled out yet) or does not know.
  const saleTypeLabel = (value: unknown) => {
    const key = saleTypeLabelKey(value)
    return key ? t(key) : null
  }

  // The 409 may land after the operator went back and changed the seller or
  // the number; then it is about an agreement no longer on the form.
  const conflict = data.saleTypeConflict
  const visibleConflict =
    conflict &&
    data.sellerId === conflict.sellerId &&
    data.newFactoringAgreement.agreement_number.trim() === conflict.agreementNumber
      ? conflict
      : null

  // The message names why the agreement cannot take the type. A server from
  // before `reason` sends only the stored type: with one, the agreement has
  // another type already; without one — and for a reason unknown here, or a
  // service caller, which an operator never is — the neutral message.
  const saleTypeConflictMessage = (shown: SaleTypeConflict) => {
    const reason = shown.reason ?? (shown.existingSaleType ? 'stored_type' : null)
    switch (reason) {
      case 'stored_type':
        return t(
          'pages.imports.step1.factoringAgreement.saleTypeConflict',
          'This seller already has an agreement with this number (type: {{existing}}). Pick it under “Pick existing” or enter another number.',
          { existing: t(saleTypeLabelKey(shown.existingSaleType) ?? 'saleType.none') }
        )
      case 'debt_types':
        return t(
          'pages.imports.step1.factoringAgreement.saleTypeConflictReasons.debt_types',
          'This seller already has an agreement with this number without a type, and its debts already carry another type. Pick it under “Pick existing” or enter another number.'
        )
      case 'foreign_project_debts':
        return t(
          'pages.imports.step1.factoringAgreement.saleTypeConflictReasons.foreign_project_debts',
          'This seller already has an agreement with this number without a type, and its debts belong to another project. Pick it under “Pick existing” or enter another number.'
        )
      default:
        return t(
          'pages.imports.step1.factoringAgreement.saleTypeConflictReasons.other',
          'This seller already has an agreement with this number and cannot take the chosen type. Pick it under “Pick existing” or enter another number.'
        )
    }
  }

  // The conflict sends the operator back here from step 2, and the message sits
  // under the create block, possibly below the fold: bring it into view and put
  // the cursor in the number, the field the message asks to change. The focus
  // must not scroll again, or the browser would pull the page up to the number
  // and push the message back out of view.
  const conflictRef = useRef<HTMLParagraphElement>(null)
  const agreementNumberRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!visibleConflict) return
    conflictRef.current?.scrollIntoView?.({ block: 'center' })
    agreementNumberRef.current?.focus({ preventScroll: true })
  }, [visibleConflict])

  // A warning, not a block: a type that disagrees with the purchase date means a
  // slip in one of the two, and only the operator knows which. It can only come
  // from a type picked by hand — until then the type follows the date — and it
  // is shown under both fields, since either may be the one to fix. Each copy
  // has its own id, so the field above it can name it as its description.
  const saleTypeByDate = saleTypeByPurchaseDate(data.newFactoringAgreement.contract_purchase_date)
  const saleTypeContradictsDate =
    saleTypeByDate !== null && saleTypeByDate !== data.newFactoringAgreement.sale_type
  const saleTypeDateHint = (id: string) =>
    saleTypeContradictsDate ? (
      <p id={id} className="text-warning-700 mt-1.5 text-xs">
        {t(
          'pages.imports.step1.factoringAgreement.saleTypeDateHint',
          'The type does not match the purchase date: portfolios bought before 30.07.2026 were bought under factoring, from 30.07.2026 on — under assignment. Check the date or the type.'
        )}
      </p>
    ) : null

  return (
    <div className="space-y-6">
      {/* Loan Source / Metadata Section */}
      <div>
        <h2 className="text-foreground mb-4 text-sm font-medium">
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
              {t('pages.imports.step1.factoringAgreement.title', 'Purchase agreement')}
            </Label>

            {!selectedSellerId ? (
              <p className="text-muted-foreground text-sm font-light">
                {t(
                  'pages.imports.step1.factoringAgreement.pickSellerFirst',
                  'Pick a seller first.'
                )}
              </p>
            ) : (
              <>
                <RadioGroup
                  value={data.factoringAgreementMode}
                  onValueChange={(value) => handleAgreementModeChange(value as 'existing' | 'new')}
                  className="flex flex-col gap-2 sm:flex-row sm:gap-6"
                >
                  <div className="flex items-center gap-2">
                    <RadioItem value="existing" id="factoring-agreement-existing" />
                    <Label
                      htmlFor="factoring-agreement-existing"
                      className="mb-0 cursor-pointer text-sm font-normal"
                    >
                      {t('pages.imports.step1.factoringAgreement.pickExisting', 'Pick existing')}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioItem value="new" id="factoring-agreement-new" />
                    <Label
                      htmlFor="factoring-agreement-new"
                      className="mb-0 cursor-pointer text-sm font-normal"
                    >
                      {t('pages.imports.step1.factoringAgreement.createNew', 'Create new')}
                    </Label>
                  </div>
                </RadioGroup>

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
                        // Existing-agreements list is the only place the
                        // reporting date surfaces on the UI. Show reporting
                        // date first (only when present), then the always-shown
                        // purchase date; both labelled to avoid ambiguity.
                        const purchaseStr = `${t(
                          'pages.imports.step1.factoringAgreement.purchaseDateShort',
                          'purchase'
                        )}: ${fa.contract_purchase_date ?? '—'}`
                        const reportingStr = fa.reporting_date
                          ? `${t(
                              'pages.imports.step1.factoringAgreement.reportingDateShort',
                              'reporting'
                            )}: ${fa.reporting_date}, `
                          : ''
                        // The type rides next to the number only when it is
                        // known: "№ · — — …" would stack two dashes that mean
                        // different things.
                        const typeLabel = saleTypeLabel(fa.sale_type)
                        const typeStr = typeLabel ? ` · ${typeLabel}` : ''
                        return (
                          <SelectItem key={fa.id} value={fa.id.toString()}>
                            {fa.agreement_number}
                            {typeStr} — {lender} ({reportingStr}
                            {purchaseStr})
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                )}

                {data.factoringAgreementMode === 'new' && (
                  <div className="border-border bg-card/50 space-y-3 rounded-md border p-3">
                    {/* The type decides the documents the debtor gets and the words
                        operators may use, so it leads the block. It is chosen for
                        a NEW agreement only: an existing agreement's type is shown
                        in the "Pick existing" mode and is never changed from here. */}
                    <div>
                      <Label htmlFor="new-fa-sale-type" required className="mb-1.5 block">
                        {t('saleType.label', 'Contract type')}
                      </Label>
                      <Select
                        value={data.newFactoringAgreement.sale_type}
                        onValueChange={handleSaleTypeChange}
                      >
                        <SelectTrigger
                          className="w-full"
                          id="new-fa-sale-type"
                          aria-describedby={saleTypeContradictsDate ? SALE_TYPE_HINT_ID : undefined}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SALE_TYPES.map((saleType) => (
                            <SelectItem key={saleType} value={saleType}>
                              {saleTypeLabel(saleType)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {saleTypeDateHint(SALE_TYPE_HINT_ID)}
                    </div>
                    <Input
                      ref={agreementNumberRef}
                      label={t(
                        'pages.imports.step1.factoringAgreement.fields.number',
                        'Agreement number'
                      )}
                      required
                      // The cursor lands here with the conflict: a screen reader
                      // then reads out why along with the field.
                      aria-describedby={visibleConflict ? SALE_TYPE_CONFLICT_ID : undefined}
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
                        <p className="text-muted-foreground mt-1.5 text-xs">
                          {t(
                            'pages.imports.step1.factoringAgreement.fields.previousLenderRequiredHint',
                            'This seller has no legal name on file, so "Who sold" is required.'
                          )}
                        </p>
                      )}
                    </div>
                    <DateSelect
                      id="new-fa-reporting-date"
                      label={t(
                        'pages.imports.step1.factoringAgreement.fields.reportingDate',
                        'Reporting Date'
                      )}
                      required
                      value={
                        data.newFactoringAgreement.reporting_date
                          ? (() => {
                              // Convert UTC datetime ISO back to a Date object that
                              // react-datepicker renders as the correct calendar day in
                              // the user's timezone (mirrors the purchase-date picker).
                              const utcDate = new Date(data.newFactoringAgreement.reporting_date)
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
                          handleNewAgreementFieldChange('reporting_date', '')
                          return
                        }
                        // Store the chosen day as a UTC datetime ISO (noon UTC);
                        // BE strips the time before persisting to the date column.
                        const selectedDate = args.value
                        const year = selectedDate.getFullYear()
                        const month = selectedDate.getMonth()
                        const day = selectedDate.getDate()
                        const utcDate = new Date(Date.UTC(year, month, day, 12, 0, 0))
                        handleNewAgreementFieldChange('reporting_date', utcDate.toISOString())
                      }}
                      placeholder={t(
                        'pages.imports.step1.factoringAgreement.fields.reportingDatePlaceholder',
                        'Select reporting date'
                      )}
                    />
                    <div>
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
                            handlePurchaseDateChange('')
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
                          handlePurchaseDateChange(utcDate.toISOString())
                        }}
                        placeholder={t(
                          'pages.imports.step1.factoringAgreement.fields.contractPurchaseDatePlaceholder',
                          'Select contract purchase date'
                        )}
                      />
                      {/* Not tied to the date input: DateSelect takes no
                          aria-describedby, so a screen reader hears this one
                          through the type field's copy. */}
                      {saleTypeDateHint(PURCHASE_DATE_HINT_ID)}
                    </div>
                  </div>
                )}

                {/* Under the block, not over "Next": nothing here is blocked. The
                    advice is the existing agreement or another number — never
                    "switch the type": an agreement without a type has none to
                    switch to, and with a matching type the server silently
                    returns the old agreement and the dates typed here are lost. */}
                {data.factoringAgreementMode === 'new' && visibleConflict && (
                  <p
                    ref={conflictRef}
                    id={SALE_TYPE_CONFLICT_ID}
                    role="alert"
                    className="text-error-500 text-sm"
                  >
                    {saleTypeConflictMessage(visibleConflict)}
                  </p>
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
            <div className="text-muted-foreground absolute right-3 bottom-3 text-xs">
              {data.comment.length}/100
            </div>
          </div>
        </div>
      </div>

      {/* Import Type Section */}
      <div>
        <h2 className="text-foreground mb-4 text-sm font-medium">
          {t('pages.imports.step1.importType')}
        </h2>

        <RadioGroup
          value={data.importType}
          onValueChange={(value) => onChange({ importType: value as 'simple' | 'vendor' })}
          className="flex flex-col gap-4 sm:flex-row"
        >
          <RadioCard
            value="simple"
            title={t('pages.imports.step1.simpleClientCsv')}
            description={t('pages.imports.step1.simpleClientCsvDesc')}
            className="flex-1"
          />

          <RadioCard
            value="vendor"
            title={t('pages.imports.step1.vendorDump')}
            description={t('pages.imports.step1.vendorDumpDesc')}
            className="flex-1"
          />
        </RadioGroup>

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
