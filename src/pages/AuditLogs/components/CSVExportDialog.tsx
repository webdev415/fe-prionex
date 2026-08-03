/**
 * CSVExportDialog Component
 *
 * Modal dialog for configuring and exporting audit logs to CSV.
 */

import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Icons } from '@/lib/icons'

interface CSVExportDialogProps {
  open: boolean
  totalEntries: number
  onClose: () => void
  onExport: (options: CSVExportOptions) => void
}

export interface CSVExportOptions {
  columns: string[]
  dateFormat: string
  fieldDelimiter: string
  encoding: string
  includeHeaders: boolean
}

const AVAILABLE_COLUMNS = [
  'timestamp',
  'user',
  'action',
  'entityType',
  'entityId',
  'oldValue',
  'newValue',
  'ipAddress',
  'successStatus',
] as const

const DATE_FORMATS = [
  { value: 'YYYY-MM-DD HH:mm:ss', label: 'YYYY-MM-DD HH:mm:ss' },
  { value: 'MM/DD/YYYY HH:mm:ss', label: 'MM/DD/YYYY HH:mm:ss' },
  { value: 'DD-MM-YYYY HH:mm:ss', label: 'DD-MM-YYYY HH:mm:ss' },
]

const FIELD_DELIMITERS = [
  { value: ',', label: 'Comma (,)' },
  { value: ';', label: 'Semicolon (;)' },
  { value: '\t', label: 'Tab' },
]

const ENCODINGS = [
  { value: 'UTF-8', label: 'UTF-8' },
  { value: 'UTF-16', label: 'UTF-16' },
  { value: 'ISO-8859-1', label: 'ISO-8859-1' },
]

export function CSVExportDialog({ open, totalEntries, onClose, onExport }: CSVExportDialogProps) {
  const { t } = useTranslation('common')
  // Default selected columns matching screenshot: timestamp, user, action, entityType, entityId, newValue, ipAddress
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    'timestamp',
    'user',
    'action',
    'entityType',
    'entityId',
    'newValue',
    'ipAddress',
  ])
  const [dateFormat, setDateFormat] = useState('YYYY-MM-DD HH:mm:ss')
  const [fieldDelimiter, setFieldDelimiter] = useState(',')
  const [encoding, setEncoding] = useState('UTF-8')
  const [includeHeaders, setIncludeHeaders] = useState(true)

  const handleColumnToggle = useCallback((column: string) => {
    setSelectedColumns((prev) =>
      prev.includes(column) ? prev.filter((c) => c !== column) : [...prev, column]
    )
  }, [])

  const handleExport = useCallback(() => {
    onExport({
      columns: selectedColumns,
      dateFormat,
      fieldDelimiter,
      encoding,
      includeHeaders,
    })
    onClose()
  }, [selectedColumns, dateFormat, fieldDelimiter, encoding, includeHeaders, onExport, onClose])

  return (
    <Modal open={open} onClose={onClose} maxWidth="lg">
      <ModalHeader
        icon={
          <div className="bg-primary-400 flex h-7 w-7 items-center justify-center rounded-full sm:h-8 sm:w-8">
            <Icons.Csv02 size={18} className="text-foreground" strokeWidth={1.5} />
          </div>
        }
        title={t('pages.auditLogs.csvExport.title')}
        className="border-none pb-4"
      />
      <ModalContent className="max-h-[calc(90vh-250px)]">
        {/* Export Scope Subtitle */}
        <div className="mb-4">
          <p className="text-foreground text-sm leading-[155%] font-light tracking-[-0.32px] sm:text-base">
            {t('pages.auditLogs.csvExport.exportScope', { count: totalEntries })}
          </p>
        </div>
        <div className="bg-border my-2 h-px w-full" />
        <div className="flex flex-col gap-4 sm:gap-6">
          {/* CSV Options Section */}
          <div className="flex flex-col gap-3 sm:gap-4">
            <span className="text-foreground text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
              {t('pages.auditLogs.csvExport.csvOptions')}
            </span>

            <div className="flex flex-col gap-4 sm:gap-6">
              {/* Columns to Include */}
              <div className="flex flex-col gap-2 sm:gap-3">
                <h4 className="text-foreground text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                  {t('pages.auditLogs.csvExport.columnsToInclude')}:
                </h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {AVAILABLE_COLUMNS.map((column) => (
                    <div key={column} className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedColumns.includes(column)}
                        onCheckedChange={() => handleColumnToggle(column)}
                      />
                      <span className="text-foreground text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                        {t(`pages.auditLogs.csvExport.columns.${column}`)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-border my-2 h-px w-full" />

            <div className="flex flex-col gap-3 sm:gap-4">
              {/* Format Settings */}
              <div className="flex flex-col gap-3 sm:gap-4">
                <h4 className="text-foreground text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                  {t('pages.auditLogs.csvExport.formatSettings')}:
                </h4>
                <div className="flex flex-col items-start gap-2 self-stretch">
                  <label className="text-foreground text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                    {t('pages.auditLogs.csvExport.dateFormat')}:
                  </label>
                  <Select value={dateFormat} onValueChange={setDateFormat}>
                    <SelectTrigger className="h-[42px] w-full rounded-md text-xs sm:text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATE_FORMATS.map((format) => (
                        <SelectItem key={format.value} value={format.value}>
                          {format.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col items-start gap-2 self-stretch">
                  <label className="text-foreground text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                    {t('pages.auditLogs.csvExport.fieldDelimiter')}:
                  </label>
                  <Select value={fieldDelimiter} onValueChange={setFieldDelimiter}>
                    <SelectTrigger className="h-[42px] w-full rounded-md text-xs sm:text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_DELIMITERS.map((delimiter) => (
                        <SelectItem key={delimiter.value} value={delimiter.value}>
                          {delimiter.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col items-start gap-2 self-stretch">
                  <label className="text-foreground text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                    {t('pages.auditLogs.csvExport.encoding')}:
                  </label>
                  <Select value={encoding} onValueChange={setEncoding}>
                    <SelectTrigger className="h-[42px] w-full rounded-md text-xs sm:text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ENCODINGS.map((enc) => (
                        <SelectItem key={enc.value} value={enc.value}>
                          {enc.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Include Column Headers */}
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={includeHeaders}
                  onCheckedChange={(checked) => setIncludeHeaders(checked === true)}
                />
                <span className="text-foreground text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                  {t('pages.auditLogs.csvExport.includeHeaders')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </ModalContent>
      <ModalFooter className="flex flex-col gap-3 self-stretch">
        <div className="flex w-full flex-col items-center gap-3 self-stretch sm:flex-row">
          <Button
            type="button"
            variant="cancel"
            onClick={onClose}
            className="h-12 w-full rounded-md"
          >
            {t('actions.cancel')}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleExport}
            className="h-12 w-full rounded-md"
          >
            {t('pages.auditLogs.csvExport.exportDownload')}
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  )
}
