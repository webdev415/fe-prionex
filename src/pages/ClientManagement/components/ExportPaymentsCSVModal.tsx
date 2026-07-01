/**
 * Export Payments to CSV Modal
 *
 * Modal for filtering and exporting payment data to CSV format.
 */

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { intlLocaleForUiLanguage } from '@/lib/i18n'
import { convertUTCToUserTimezone } from '@/lib/formatters'
import { useAuthStore } from '@/stores/authStore'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { DateSelect } from '@/components/ui/DateSelect'
import { Checkbox } from '@/components/ui/Checkbox'
import { RadioGroup, RadioItem } from '@/components/ui/Radio'
import { Label } from '@/components/ui/Label'
import { Icons } from '@/lib/icons'

export interface ExportPaymentsCSVModalProps {
  open: boolean
  onClose: () => void
  onExport: (data: {
    startDate: Date | null
    endDate: Date | null
    statuses: string[]
    method: string
    project: string
    columns: string[]
  }) => void
  totalPayments?: number
  totalAmount?: number
  verifiedPayments?: number
  verifiedAmount?: number
  pendingPayments?: number
  pendingAmount?: number
}

const CSV_COLUMNS = [
  { id: 'paymentId', translationKey: 'csvColumnPaymentId', fixed: false },
  { id: 'paymentMethod', translationKey: 'csvColumnPaymentMethod', fixed: false },
  { id: 'clientId', translationKey: 'csvColumnClientId', fixed: false },
  { id: 'verifiedBy', translationKey: 'csvColumnVerifiedBy', fixed: false },
  { id: 'createdAt', translationKey: 'csvColumnCreatedAt', fixed: false },
  { id: 'paymentDate', translationKey: 'csvColumnPaymentDate', fixed: false },
  { id: 'referenceNumber', translationKey: 'csvColumnReferenceNumber', fixed: false },
  { id: 'clientName', translationKey: 'csvColumnClientName', fixed: false },
  { id: 'verificationDate', translationKey: 'csvColumnVerificationDate', fixed: false },
  { id: 'paymentAmount', translationKey: 'csvColumnPaymentAmount', fixed: true },
  { id: 'status', translationKey: 'csvColumnStatus', fixed: true },
  { id: 'projectName', translationKey: 'csvColumnProjectName', fixed: false },
  { id: 'createdBy', translationKey: 'csvColumnCreatedBy', fixed: false },
]

export function ExportPaymentsCSVModal({
  open,
  onClose,
  onExport,
  totalPayments = 0,
  totalAmount = 0,
  verifiedPayments = 0,
  verifiedAmount = 0,
  pendingPayments = 0,
  pendingAmount = 0,
}: ExportPaymentsCSVModalProps) {
  const { t, i18n } = useTranslation('common')
  const userTimezone = useAuthStore((state) => state.user?.timezone)

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    if (isNaN(num)) return '₴ 0.00'
    const locale = intlLocaleForUiLanguage(i18n.language)
    return `₴ ${num.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }
  // Default to no date filter so all payments are exported unless user chooses a range
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [statuses, setStatuses] = useState<string[]>(['Verified'])
  const [method, setMethod] = useState<string>('All')
  const [project, setProject] = useState<string>('All Projects')
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    new Set(CSV_COLUMNS.map((col) => col.id))
  )

  // Calculate preview data based on filters
  const previewData = useMemo(() => {
    // Base stats from parent (real data, not mock)
    const baseVerifiedCount = verifiedPayments
    const basePendingCount = pendingPayments
    const baseCancelledCount = Math.max(0, totalPayments - baseVerifiedCount - basePendingCount)

    const baseVerifiedAmount = verifiedAmount
    const basePendingAmount = pendingAmount
    const baseCancelledAmount = Math.max(0, totalAmount - baseVerifiedAmount - basePendingAmount)

    const includeVerified = statuses.includes('Verified')
    const includePending = statuses.includes('Pending')
    const includeCancelled = statuses.includes('Cancelled')

    const verifiedCount = includeVerified ? baseVerifiedCount : 0
    const pendingCount = includePending ? basePendingCount : 0
    const cancelledCount = includeCancelled ? baseCancelledCount : 0

    const verifiedAmountFiltered = includeVerified ? baseVerifiedAmount : 0
    const pendingAmountFiltered = includePending ? basePendingAmount : 0
    const cancelledAmountFiltered = includeCancelled ? baseCancelledAmount : 0

    const matchingPayments = verifiedCount + pendingCount + cancelledCount

    const totalAmountFiltered =
      verifiedAmountFiltered + pendingAmountFiltered + cancelledAmountFiltered

    const totalForPercentage = verifiedCount + pendingCount
    const verifiedPercentage =
      totalForPercentage > 0 ? Math.round((verifiedCount / totalForPercentage) * 100) : 0
    const pendingPercentage =
      totalForPercentage > 0 ? Math.round((pendingCount / totalForPercentage) * 100) : 0

    // Rough estimate: assume ~150 bytes per row (CSV) + header
    const estimatedBytes = Math.max(1, matchingPayments) * 150 + 200
    const estimatedFileSize = `~${Math.max(1, Math.round(estimatedBytes / 1024))} KB`

    return {
      matchingPayments,
      totalAmount: totalAmountFiltered,
      verifiedCount,
      verifiedAmount: verifiedAmountFiltered,
      verifiedPercentage,
      pendingCount,
      pendingAmount: pendingAmountFiltered,
      pendingPercentage,
      estimatedFileSize,
    }
  }, [
    statuses,
    totalPayments,
    totalAmount,
    verifiedPayments,
    verifiedAmount,
    pendingPayments,
    pendingAmount,
  ])

  const handleQuickRange = (range: 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisYear') => {
    const now = new Date()
    let start: Date
    let end: Date = new Date(now)

    switch (range) {
      case 'thisMonth':
        start = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'lastMonth':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        end = new Date(now.getFullYear(), now.getMonth(), 0)
        break
      case 'thisQuarter': {
        const quarter = Math.floor(now.getMonth() / 3)
        start = new Date(now.getFullYear(), quarter * 3, 1)
        break
      }
      case 'thisYear':
        start = new Date(now.getFullYear(), 0, 1)
        break
    }

    setStartDate(start)
    setEndDate(end)
  }

  const handleStatusChange = (status: string, checked: boolean) => {
    if (checked) {
      setStatuses([...statuses, status])
    } else {
      setStatuses(statuses.filter((s) => s !== status))
    }
  }

  const handleExport = () => {
    onExport({
      startDate,
      endDate,
      statuses,
      method,
      project,
      columns: Array.from(selectedColumns),
    })
    onClose()
  }

  const handleClose = () => {
    // Reset to defaults (no date filter, verified only)
    setStartDate(null)
    setEndDate(null)
    setStatuses(['Verified'])
    setMethod('All')
    setProject('All Projects')
    setSelectedColumns(new Set(CSV_COLUMNS.map((col) => col.id)))
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex items-center justify-center gap-2.5 rounded-full p-2.5">
            <Icons.Csv02 size={20} className="text-dark-500" strokeWidth={1.5} />
          </div>
        }
        title={t('pages.clients.modals.exportPaymentsCSV.title')}
        className="pb-6"
      />
      <ModalContent className="max-h-[calc(90vh-300px)] sm:max-h-[calc(90vh-200px)]">
        {/* Export Filters Section */}
        <div className="mb-4 flex flex-col items-start gap-2 self-stretch">
          <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
            {t('pages.clients.modals.exportPaymentsCSV.exportFilters')}
          </span>
          <div className="flex flex-col items-start justify-center gap-3 self-stretch rounded-xl border border-white bg-white/50 p-4 sm:p-5 sm:px-6">
            <div className="flex flex-col items-start gap-2 self-stretch">
              {/* Date Range */}
              <div className="flex flex-col items-start gap-3 self-stretch sm:flex-row sm:items-center sm:gap-5">
                <Label className="text-dark-500 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                  {t('pages.clients.modals.exportPaymentsCSV.dateRange')}
                </Label>
                <div className="flex w-full flex-1 items-center gap-2 self-stretch sm:gap-3">
                  <DateSelect
                    value={startDate}
                    onChange={({ value }) => setStartDate(value)}
                    placeholder={t('pages.clients.modals.exportPaymentsCSV.startDate')}
                    allowManualInput
                    format="dd.MM.yyyy"
                    className="flex-1"
                  />
                  <span className="text-xs leading-[155%] font-medium tracking-[-0.32px] text-gray-700 sm:text-base">
                    -
                  </span>
                  <DateSelect
                    value={endDate}
                    onChange={({ value }) => setEndDate(value)}
                    placeholder={t('pages.clients.modals.exportPaymentsCSV.endDate')}
                    allowManualInput
                    format="dd.MM.yyyy"
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="flex flex-1 items-center gap-4 self-stretch">
                <div className="h-px w-full bg-gray-200" />
                <span className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px] whitespace-nowrap">
                  {t('pages.clients.modals.exportPaymentsCSV.quickRanges')}
                </span>
                <div className="h-px w-full bg-gray-200" />
              </div>
              <div className="grid grid-cols-2 items-start gap-2 self-stretch sm:flex sm:gap-2">
                <Button
                  variant="white-secondary"
                  size="md"
                  onClick={() => handleQuickRange('thisMonth')}
                  className="w-full flex-1 rounded-md shadow-xs sm:w-auto"
                >
                  {t('pages.clients.modals.exportPaymentsCSV.thisMonth')}
                </Button>
                <Button
                  variant="white-secondary"
                  size="md"
                  onClick={() => handleQuickRange('lastMonth')}
                  className="w-full flex-1 rounded-md shadow-xs sm:w-auto"
                >
                  {t('pages.clients.modals.exportPaymentsCSV.lastMonth')}
                </Button>
                <Button
                  variant="white-secondary"
                  size="md"
                  onClick={() => handleQuickRange('thisQuarter')}
                  className="w-full flex-1 rounded-md shadow-xs sm:w-auto"
                >
                  {t('pages.clients.modals.exportPaymentsCSV.thisQuarter')}
                </Button>
                <Button
                  variant="white-secondary"
                  size="md"
                  onClick={() => handleQuickRange('thisYear')}
                  className="w-full flex-1 rounded-md shadow-xs sm:w-auto"
                >
                  {t('pages.clients.modals.exportPaymentsCSV.thisYear')}
                </Button>
              </div>
            </div>

            {/* Status Checkboxes */}
            <div className="flex flex-col items-start justify-center gap-1 self-stretch">
              <Label className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                {t('pages.clients.modals.exportPaymentsCSV.statusLabel')}
              </Label>
              <div className="flex flex-col items-start gap-2 self-stretch sm:flex-row sm:gap-2">
                <div className="flex flex-1 items-center gap-1">
                  <Checkbox
                    checked={statuses.includes('Verified')}
                    onCheckedChange={(checked) => handleStatusChange('Verified', checked === true)}
                    id="status-verified"
                  />
                  <Label
                    htmlFor="status-verified"
                    className="cursor-pointer text-xs font-light text-gray-950 sm:text-sm"
                  >
                    {t('pages.clients.modals.exportPaymentsCSV.verified')}
                  </Label>
                </div>
                <div className="flex flex-1 items-center gap-1">
                  <Checkbox
                    checked={statuses.includes('Pending')}
                    onCheckedChange={(checked) => handleStatusChange('Pending', checked === true)}
                    id="status-pending"
                  />
                  <Label
                    htmlFor="status-pending"
                    className="cursor-pointer text-xs font-light text-gray-950 sm:text-sm"
                  >
                    {t('pages.clients.modals.exportPaymentsCSV.pending')}
                  </Label>
                </div>
                <div className="flex flex-1 items-center gap-1">
                  <Checkbox
                    checked={statuses.includes('Cancelled')}
                    onCheckedChange={(checked) => handleStatusChange('Cancelled', checked === true)}
                    id="status-cancelled"
                  />
                  <Label
                    htmlFor="status-cancelled"
                    className="cursor-pointer text-xs font-light text-gray-950 sm:text-sm"
                  >
                    {t('pages.clients.modals.exportPaymentsCSV.cancelled')}
                  </Label>
                </div>
              </div>
            </div>

            {/* Payment Method Radio */}
            <div className="flex flex-col items-start justify-center gap-1 self-stretch">
              <Label className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                {t('pages.clients.modals.exportPaymentsCSV.paymentMethodLabel')}
              </Label>
              <RadioGroup
                value={method}
                onValueChange={setMethod}
                className="flex flex-col items-start gap-2 self-stretch sm:flex-row"
              >
                <div className="flex flex-1 items-center gap-1">
                  <RadioItem value="All" id="method-all" />
                  <Label
                    htmlFor="method-all"
                    className="cursor-pointer text-xs font-light text-gray-950 sm:text-sm"
                  >
                    {t('pages.clients.modals.exportPaymentsCSV.all')}
                  </Label>
                </div>
                <div className="flex flex-1 items-center gap-1">
                  {/* Value matches frontend payment method label so we can map to backend */}
                  <RadioItem value="Bank Transfer" id="method-bank" />
                  <Label
                    htmlFor="method-bank"
                    className="cursor-pointer text-xs font-light text-gray-950 sm:text-sm"
                  >
                    {t('pages.clients.modals.exportPaymentsCSV.bankOnly')}
                  </Label>
                </div>
                <div className="flex flex-1 items-center gap-1">
                  {/* Value matches frontend payment method label so we can map to backend */}
                  <RadioItem value="Other" id="method-other" />
                  <Label
                    htmlFor="method-other"
                    className="cursor-pointer text-xs font-light text-gray-950 sm:text-sm"
                  >
                    {t('pages.clients.modals.exportPaymentsCSV.otherOnly')}
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Project Radio */}
            <div className="flex flex-col items-start justify-center gap-1 self-stretch">
              <Label className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                {t('pages.clients.modals.exportPaymentsCSV.project')}
              </Label>
              <RadioGroup
                value={project}
                onValueChange={setProject}
                className="flex flex-col items-start gap-2 self-stretch sm:flex-row"
              >
                <div className="flex flex-1 items-center gap-1">
                  <RadioItem value="All Projects" id="project-all" />
                  <Label
                    htmlFor="project-all"
                    className="cursor-pointer text-xs font-light text-gray-950 sm:text-sm"
                  >
                    {t('pages.clients.modals.exportPaymentsCSV.allProjects')}
                  </Label>
                </div>
                <div className="flex flex-1 items-center gap-1">
                  <RadioItem value="PrivatBank" id="project-privatbank" />
                  <Label
                    htmlFor="project-privatbank"
                    className="cursor-pointer text-xs font-light text-gray-950 sm:text-sm"
                  >
                    {t('pages.clients.modals.exportPaymentsCSV.privatBank')}
                  </Label>
                </div>
                <div className="flex flex-1 items-center gap-1">
                  <RadioItem value="Mono" id="project-mono" />
                  <Label
                    htmlFor="project-mono"
                    className="cursor-pointer text-xs font-light text-gray-950 sm:text-sm"
                  >
                    {t('pages.clients.modals.exportPaymentsCSV.mono')}
                  </Label>
                </div>
                <div className="flex flex-1 items-center gap-1">
                  <RadioItem value="Other" id="project-other" />
                  <Label
                    htmlFor="project-other"
                    className="cursor-pointer text-xs font-light text-gray-950 sm:text-sm"
                  >
                    {t('pages.clients.modals.exportPaymentsCSV.other')}
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </div>

        {/* Export Preview Section */}
        <div className="mb-4 flex flex-col items-start gap-2 self-stretch">
          <div className="flex items-start justify-between self-stretch">
            <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
              {t('pages.clients.modals.exportPaymentsCSV.exportPreview')}
            </span>
            <span className="text-sm leading-[150%] font-light tracking-[-0.28px] text-gray-700">
              {t('pages.clients.modals.exportPaymentsCSV.basedOnCurrentFilters')}
            </span>
          </div>
          <div className="flex flex-col items-start justify-center gap-3 self-stretch rounded-xl border border-white/100 bg-white/50 p-4 sm:p-5 sm:px-6">
            <div className="flex flex-col items-start gap-4 self-stretch sm:flex-row sm:items-center sm:gap-4">
              <div className="flex flex-1 flex-col items-start gap-2 p-0">
                <div className="flex items-start gap-6 self-stretch">
                  <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                    {t('pages.clients.modals.exportPaymentsCSV.matchingPayments')}{' '}
                    <span className="font-medium">{previewData.matchingPayments}</span>
                  </span>
                </div>
                <div className="flex items-start gap-6 self-stretch">
                  <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                    {t('pages.clients.modals.exportPaymentsCSV.totalAmount')}{' '}
                    <span className="font-medium">{formatCurrency(previewData.totalAmount)}</span>
                  </span>
                </div>
              </div>
              <div className="hidden h-[50px] w-px bg-gray-200 sm:block"></div>
              <div className="h-px w-full bg-gray-200 sm:hidden"></div>
              <div className="flex flex-1 flex-col items-start gap-2 p-0">
                <div className="flex items-start gap-6 self-stretch">
                  <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                    {t('pages.clients.modals.exportPaymentsCSV.dates')}{' '}
                    <span className="font-medium">
                      {startDate
                        ? convertUTCToUserTimezone(
                            startDate.toISOString().split('T')[0],
                            userTimezone
                          )
                        : ''}{' '}
                      {t('pages.clients.modals.exportPaymentsCSV.to')}{' '}
                      {endDate
                        ? convertUTCToUserTimezone(
                            endDate.toISOString().split('T')[0],
                            userTimezone
                          )
                        : ''}
                    </span>
                  </span>
                </div>
                <div className="flex items-start gap-6 self-stretch">
                  <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                    {t('pages.clients.modals.exportPaymentsCSV.estimatedFileSize')}{' '}
                    <span className="font-medium">{previewData.estimatedFileSize}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Status Breakdown Cards */}
            <div className="flex flex-col items-start gap-3 self-stretch sm:flex-row sm:gap-5">
              {/* {previewData.verifiedCount > 0 && ( */}
              <div className="relative flex w-full flex-1 flex-col items-start gap-1 overflow-hidden rounded-xl border border-white bg-white px-0 py-3 sm:w-auto">
                <div className="flex flex-row items-start justify-between gap-2 self-stretch px-4 px-6">
                  <div className="mb-2 flex items-center gap-2">
                    <Icons.AddInvoice size={16} className="text-gray-700 sm:size-[18px]" />
                    <span className="text-xs leading-[150%] font-medium tracking-[-0.28px] text-gray-700 sm:text-sm">
                      {t('pages.clients.modals.exportPaymentsCSV.verified')}
                    </span>
                  </div>
                  <span className="text-xs leading-[150%] font-medium tracking-[-0.28px] text-gray-700 sm:text-sm">
                    {previewData.verifiedCount}
                  </span>
                </div>
                <div className="flex flex-row items-start justify-between gap-2 self-stretch px-4 px-6">
                  <span className="text-dark-500 text-center text-base leading-[150%] font-medium tracking-[-0.36px] sm:text-[18px]">
                    {formatCurrency(previewData.verifiedAmount)}
                  </span>
                  <span className="text-dark-500 text-center text-base leading-[150%] font-medium tracking-[-0.36px] sm:text-[18px]">
                    {previewData.verifiedPercentage}%
                  </span>
                </div>
                <div className="from-primary-300 to-secondary-800 absolute bottom-0 h-[3px] w-full bg-gradient-to-r"></div>
              </div>
              {/* )} */}
              {/* {previewData.pendingCount > 0 && ( */}
              <div className="flex w-full flex-1 flex-col items-start gap-1 rounded-xl border border-gray-100 bg-white px-0 py-3 sm:w-auto">
                <div className="flex flex-row items-start justify-between gap-2 self-stretch px-4 px-6">
                  <div className="mb-2 flex items-center gap-2">
                    <Icons.Invoice01 size={16} className="text-gray-700 sm:size-[18px]" />
                    <span className="text-xs leading-[150%] font-medium tracking-[-0.28px] text-gray-700 sm:text-sm">
                      {t('pages.clients.modals.exportPaymentsCSV.pending')}
                    </span>
                  </div>
                  <span className="text-xs leading-[150%] font-medium tracking-[-0.28px] text-gray-700 sm:text-sm">
                    {previewData.pendingCount}
                  </span>
                </div>
                <div className="flex flex-row items-start justify-between gap-2 self-stretch px-4 px-6">
                  <span className="text-dark-500 text-center text-base leading-[150%] font-medium tracking-[-0.36px] sm:text-[18px]">
                    {formatCurrency(previewData.pendingAmount)}
                  </span>
                  <span className="text-dark-500 text-center text-base leading-[150%] font-medium tracking-[-0.36px] sm:text-[18px]">
                    {previewData.pendingPercentage}%
                  </span>
                </div>
              </div>
              {/* )} */}
            </div>
          </div>
        </div>

        {/* CSV Columns Section */}
        <div className="flex flex-col flex-wrap items-start gap-2 self-stretch">
          <div className="flex items-start justify-between self-stretch">
            <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
              {t('pages.clients.modals.exportPaymentsCSV.csvColumns')}
            </span>
            <span className="text-sm leading-[150%] font-light tracking-[-0.28px] text-gray-700">
              {t('pages.clients.modals.exportPaymentsCSV.fixed')}
            </span>
          </div>
          <div className="flex flex-wrap items-start gap-1.5 self-stretch rounded-xl border border-white bg-white/50 p-4 sm:p-5 sm:px-6">
            {CSV_COLUMNS.map((column) => (
              <div
                key={column.id}
                className="flex min-w-[140px] flex-1 items-center gap-1 sm:min-w-[120px]"
              >
                <Icons.Tick02 size={18} className="text-secondary-800 sm:size-5" />
                <span className="text-dark-500 w-full text-xs leading-[150%] font-light tracking-[-0.28px] sm:w-[120px] sm:text-sm">
                  {t(`pages.clients.modals.exportPaymentsCSV.${column.translationKey}`)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </ModalContent>
      <ModalFooter className="flex flex-col items-stretch gap-3 border-none sm:flex-row sm:justify-between">
        <Button variant="cancel" onClick={handleClose} className="h-12 w-full rounded-md">
          {t('pages.clients.modals.recordPayment.cancel')}
        </Button>
        <Button
          variant="primary"
          leftIcon={<Icons.FileDownload size={18} className="sm:size-5" />}
          onClick={handleExport}
          className="h-12 w-full rounded-md"
        >
          {t('pages.clients.modals.exportPaymentsCSV.downloadCSV')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
