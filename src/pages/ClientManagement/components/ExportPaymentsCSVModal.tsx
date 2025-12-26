/**
 * Export Payments to CSV Modal
 *
 * Modal for filtering and exporting payment data to CSV format.
 */

import { useState, useMemo } from 'react'
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
}

const formatCurrency = (amount: number) => {
  return `₴ ${amount.toLocaleString('uk-UA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

const CSV_COLUMNS = [
  { id: 'paymentId', label: 'Payment ID', fixed: false },
  { id: 'paymentMethod', label: 'Payment Method', fixed: false },
  { id: 'clientId', label: 'Client ID', fixed: false },
  { id: 'verifiedBy', label: 'Verified By', fixed: false },
  { id: 'createdAt', label: 'Created At', fixed: false },
  { id: 'paymentDate', label: 'Payment Date', fixed: false },
  { id: 'referenceNumber', label: 'Reference Number', fixed: false },
  { id: 'clientName', label: 'Client Name', fixed: false },
  { id: 'verificationDate', label: 'Verification Date', fixed: false },
  { id: 'paymentAmount', label: 'Payment Amount', fixed: true },
  { id: 'status', label: 'Status', fixed: true },
  { id: 'projectName', label: 'Project Name', fixed: false },
  { id: 'createdBy', label: 'Created By', fixed: false },
]

export function ExportPaymentsCSVModal({
  open,
  onClose,
  onExport,
  totalPayments = 498,
  totalAmount = 125450.0,
}: ExportPaymentsCSVModalProps) {
  const [startDate, setStartDate] = useState<Date | null>(new Date('2024-11-20'))
  const [endDate, setEndDate] = useState<Date | null>(new Date('2024-11-20'))
  const [statuses, setStatuses] = useState<string[]>(['Verified'])
  const [method, setMethod] = useState<string>('All')
  const [project, setProject] = useState<string>('All Projects')
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    new Set(CSV_COLUMNS.map((col) => col.id))
  )

  // Calculate preview data based on filters
  const previewData = useMemo(() => {
    const verifiedCount = statuses.includes('Verified') ? 340 : 0
    const pendingCount = statuses.includes('Pending') ? 1 : 0
    const verifiedAmount = statuses.includes('Verified') ? 105450.0 : 0
    const pendingAmount = statuses.includes('Pending') ? 5450.0 : 0
    const total = verifiedCount + pendingCount
    const verifiedPercentage = total > 0 ? Math.round((verifiedCount / total) * 100) : 0
    const pendingPercentage = total > 0 ? Math.round((pendingCount / total) * 100) : 0

    return {
      matchingPayments: totalPayments,
      totalAmount,
      verifiedCount,
      verifiedAmount,
      verifiedPercentage,
      pendingCount,
      pendingAmount,
      pendingPercentage,
      estimatedFileSize: '~25 KB',
    }
  }, [statuses, totalPayments, totalAmount])

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
    // Reset to defaults
    setStartDate(new Date('2024-11-20'))
    setEndDate(new Date('2024-11-20'))
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
        title="Export Payments to CSV"
        className="pb-6"
      />
      <ModalContent className="max-h-[calc(90vh-200px)]">
        {/* Export Filters Section */}
        <div className="mb-4 flex flex-col items-start gap-2 self-stretch">
          <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
            Export Filters
          </span>
          <div className="flex flex-col items-start justify-center gap-3 self-stretch rounded-xl border border-white bg-white/50 p-5 px-6">
            <div className="flex flex-col items-start gap-2 self-stretch">
              {/* Date Range */}
              <div className="flex items-center gap-5 self-stretch">
                <Label className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                  Date Range:
                </Label>
                <div className="flex flex-1 items-center gap-3">
                  <DateSelect
                    value={startDate}
                    onChange={({ value }) => setStartDate(value)}
                    placeholder="Start date"
                    className="flex-1"
                  />
                  <span className="text-base leading-[155%] font-medium tracking-[-0.32px] text-gray-700">
                    -
                  </span>
                  <DateSelect
                    value={endDate}
                    onChange={({ value }) => setEndDate(value)}
                    placeholder="End date"
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="flex flex-1 items-center gap-4 self-stretch">
                <div className="h-px w-full bg-gray-200" />
                <span className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px] whitespace-nowrap">
                  Quick Ranges:
                </span>
                <div className="h-px w-full bg-gray-200" />
              </div>
              <div className="flex items-start gap-2 self-stretch">
                <Button
                  variant="white-secondary"
                  size="md"
                  onClick={() => handleQuickRange('thisMonth')}
                  className="flex-1 rounded-md shadow-xs"
                >
                  This Month
                </Button>
                <Button
                  variant="white-secondary"
                  size="md"
                  onClick={() => handleQuickRange('lastMonth')}
                  className="flex-1 rounded-md shadow-xs"
                >
                  Last Month
                </Button>
                <Button
                  variant="white-secondary"
                  size="md"
                  onClick={() => handleQuickRange('thisQuarter')}
                  className="flex-1 rounded-md shadow-xs"
                >
                  This Quarter
                </Button>
                <Button
                  variant="white-secondary"
                  size="md"
                  onClick={() => handleQuickRange('thisYear')}
                  className="flex-1 rounded-md shadow-xs"
                >
                  This Year
                </Button>
              </div>
            </div>

            {/* Status Checkboxes */}
            <div className="flex flex-col items-start justify-center gap-1 self-stretch">
              <Label className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                Status:
              </Label>
              <div className="flex items-start gap-2 self-stretch">
                <div className="flex flex-1 items-center gap-1">
                  <Checkbox
                    checked={statuses.includes('Verified')}
                    onCheckedChange={(checked) => handleStatusChange('Verified', checked === true)}
                    id="status-verified"
                  />
                  <Label
                    htmlFor="status-verified"
                    className="cursor-pointer text-sm font-light text-gray-950"
                  >
                    Verified
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
                    className="cursor-pointer text-sm font-light text-gray-950"
                  >
                    Pending
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
                    className="cursor-pointer text-sm font-light text-gray-950"
                  >
                    Cancelled
                  </Label>
                </div>
              </div>
            </div>

            {/* Payment Method Radio */}
            <div className="flex flex-col items-start justify-center gap-1 self-stretch">
              <Label className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                Payment Method:
              </Label>
              <RadioGroup
                value={method}
                onValueChange={setMethod}
                className="flex items-start gap-2 self-stretch"
              >
                <div className="flex flex-1 items-center gap-1">
                  <RadioItem value="All" id="method-all" />
                  <Label
                    htmlFor="method-all"
                    className="cursor-pointer text-sm font-light text-gray-950"
                  >
                    All
                  </Label>
                </div>
                <div className="flex flex-1 items-center gap-1">
                  <RadioItem value="Bank Only" id="method-bank" />
                  <Label
                    htmlFor="method-bank"
                    className="cursor-pointer text-sm font-light text-gray-950"
                  >
                    Bank Only
                  </Label>
                </div>
                <div className="flex flex-1 items-center gap-1">
                  <RadioItem value="Other Only" id="method-other" />
                  <Label
                    htmlFor="method-other"
                    className="cursor-pointer text-sm font-light text-gray-950"
                  >
                    Other Only
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Project Radio */}
            <div className="flex flex-col items-start justify-center gap-1 self-stretch">
              <Label className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                Project:
              </Label>
              <RadioGroup
                value={project}
                onValueChange={setProject}
                className="flex items-start gap-2 self-stretch"
              >
                <div className="flex flex-1 items-center gap-1">
                  <RadioItem value="All Projects" id="project-all" />
                  <Label
                    htmlFor="project-all"
                    className="cursor-pointer text-sm font-light text-gray-950"
                  >
                    All Projects
                  </Label>
                </div>
                <div className="flex flex-1 items-center gap-1">
                  <RadioItem value="PrivatBank" id="project-privatbank" />
                  <Label
                    htmlFor="project-privatbank"
                    className="cursor-pointer text-sm font-light text-gray-950"
                  >
                    PrivatBank
                  </Label>
                </div>
                <div className="flex flex-1 items-center gap-1">
                  <RadioItem value="Mono" id="project-mono" />
                  <Label
                    htmlFor="project-mono"
                    className="cursor-pointer text-sm font-light text-gray-950"
                  >
                    Mono
                  </Label>
                </div>
                <div className="flex flex-1 items-center gap-1">
                  <RadioItem value="Other" id="project-other" />
                  <Label
                    htmlFor="project-other"
                    className="cursor-pointer text-sm font-light text-gray-950"
                  >
                    Other
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
              Export Preview
            </span>
            <span className="text-sm leading-[150%] font-light tracking-[-0.28px] text-gray-700">
              Based on current filters
            </span>
          </div>
          <div className="flex flex-col items-start justify-center gap-3 self-stretch rounded-xl border border-white/100 bg-white/50 p-5 px-6">
            <div className="flex items-center gap-4 self-stretch">
              <div className="flex flex-1 flex-col items-start gap-2 p-0">
                <div className="flex items-start gap-6 self-stretch">
                  <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                    Matching Payments:{' '}
                    <span className="font-medium">{previewData.matchingPayments}</span>
                  </span>
                </div>
                <div className="flex items-start gap-6 self-stretch">
                  <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                    Total Amount:{' '}
                    <span className="font-medium">{formatCurrency(previewData.totalAmount)}</span>
                  </span>
                </div>
              </div>
              <div className="flex flex-1 flex-col items-start gap-2 p-0">
                <div className="flex items-start gap-6 self-stretch">
                  <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                    Dates:{' '}
                    <span className="font-medium">
                      {startDate?.toISOString().split('T')[0]} to{' '}
                      {endDate?.toISOString().split('T')[0]}
                    </span>
                  </span>
                </div>
                <div className="flex items-start gap-6 self-stretch">
                  <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                    Estimated File Size:{' '}
                    <span className="font-medium">{previewData.estimatedFileSize}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Status Breakdown Cards */}
            <div className="flex items-start gap-5 self-stretch">
              {/* {previewData.verifiedCount > 0 && ( */}
              <div className="relative flex flex-1 flex-col items-start gap-1 overflow-hidden rounded-xl border border-white bg-white px-0 py-3">
                <div className="flex items-start justify-between self-stretch px-6">
                  <div className="mb-2 flex items-center gap-2">
                    <Icons.AddInvoice size={18} className="text-gray-700" />
                    <span className="text-sm leading-[150%] font-medium tracking-[-0.28px] text-gray-700">
                      Verified
                    </span>
                  </div>
                  <span className="text-sm leading-[150%] font-medium tracking-[-0.28px] text-gray-700">
                    {previewData.verifiedCount}
                  </span>
                </div>
                <div className="flex items-start justify-between self-stretch px-6">
                  <span className="text-dark-500 text-center text-[18px] leading-[150%] font-medium tracking-[-0.36px]">
                    {formatCurrency(previewData.verifiedAmount)}
                  </span>
                  <span className="text-dark-500 text-center text-[18px] leading-[150%] font-medium tracking-[-0.36px]">
                    {previewData.verifiedPercentage}%
                  </span>
                </div>
                <div className="from-primary-300 to-secondary-800 absolute bottom-0 h-[3px] w-full bg-gradient-to-r"></div>
              </div>
              {/* )} */}
              {/* {previewData.pendingCount > 0 && ( */}
              <div className="flex flex-1 flex-col items-start gap-1 rounded-xl border border-gray-100 bg-white px-0 py-3">
                <div className="flex items-start justify-between self-stretch px-6">
                  <div className="mb-2 flex items-center gap-2">
                    <Icons.Invoice01 size={18} className="text-gray-700" />
                    <span className="text-sm leading-[150%] font-medium tracking-[-0.28px] text-gray-700">
                      Pending
                    </span>
                  </div>
                  <span className="text-sm leading-[150%] font-medium tracking-[-0.28px] text-gray-700">
                    {previewData.pendingCount}
                  </span>
                </div>
                <div className="flex items-start justify-between self-stretch px-6">
                  <span className="text-dark-500 text-center text-[18px] leading-[150%] font-medium tracking-[-0.36px]">
                    {formatCurrency(previewData.pendingAmount)}
                  </span>
                  <span className="text-dark-500 text-center text-[18px] leading-[150%] font-medium tracking-[-0.36px]">
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
              CSV Columns
            </span>
            <span className="text-sm leading-[150%] font-light tracking-[-0.28px] text-gray-700">
              Fixed
            </span>
          </div>
          <div className="flex flex-wrap items-start gap-1.5 self-stretch rounded-xl border border-white bg-white/50 p-5 px-6">
            {CSV_COLUMNS.map((column) => (
              <div key={column.id} className="flex flex-1 items-center gap-1">
                <Icons.Tick02 size={20} className="text-secondary-800" />
                <span className="text-dark-500 w-[120px] text-sm leading-[150%] font-light tracking-[-0.28px]">
                  {column.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </ModalContent>
      <ModalFooter className="justify-between border-none">
        <Button variant="cancel" onClick={handleClose} className="h-12 flex-1 rounded-md">
          Cancel
        </Button>
        <Button
          variant="primary"
          leftIcon={<Icons.FileDownload size={20} />}
          onClick={handleExport}
          className="h-12 flex-1 rounded-md"
        >
          Download CSV
        </Button>
      </ModalFooter>
    </Modal>
  )
}
