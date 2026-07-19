import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SearchType } from '@/api/clientSearchApi'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Label } from '@/components/ui/Label'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import type { LegalClientContractItem } from '@/features/lawyerWorkplace/api/types'
import { useLegalClientSearch } from '@/features/lawyerWorkplace/hooks/useLegalClientSearch'
import { useDebounce } from '@/hooks/useDebounce'
import { Icons } from '@/lib/icons'

type ModalScope = 'generate' | 'incoming'

const CLIENT_SEARCH_TYPES: { value: SearchType; labelKey: string; fallback: string }[] = [
  { value: 'phone', labelKey: 'search.phoneNumber', fallback: 'Phone number' },
  { value: 'name', labelKey: 'search.fullName', fallback: 'Full name' },
  { value: 'email', labelKey: 'search.email', fallback: 'Email' },
  { value: 'tin', labelKey: 'search.tin', fallback: 'TIN' },
  { value: 'contract_number', labelKey: 'search.contractNumber', fallback: 'Contract number' },
]

interface DocumentClientContractFieldsProps {
  scope: ModalScope
  enabled: boolean
  clientId: string
  onClientIdChange: (clientId: string) => void
  contracts: LegalClientContractItem[]
  contractsLoading: boolean
  contractNumber: string
  onContractNumberChange: (contractNumber: string) => void
  requiresSelection: boolean
}

function DocumentClientContractFieldsContent({
  scope,
  clientId,
  onClientIdChange,
  contracts,
  contractsLoading,
  contractNumber,
  onContractNumberChange,
  requiresSelection,
}: Omit<DocumentClientContractFieldsProps, 'enabled'>) {
  const { t } = useTranslation('common')
  const baseKey = `pages.lawyerWorkplace.documents.modals.${scope}`

  const [clientSearch, setClientSearch] = useState('')
  const [searchType, setSearchType] = useState<SearchType>('name')
  const [selectedClientLabel, setSelectedClientLabel] = useState('')
  const debouncedClientSearch = useDebounce(clientSearch, 300)

  const { data: clientsData, isFetching: clientsLoading } = useLegalClientSearch(
    debouncedClientSearch,
    { enabled: debouncedClientSearch.length >= 2, searchType }
  )

  const clientOptions = useMemo(() => {
    const searchResults = (clientsData?.items ?? []).map((client) => {
      const code = `CL-${String(client.id).padStart(5, '0')}`
      const name = [client.first_name, client.last_name].filter(Boolean).join(' ')
      return { id: String(client.id), name: name ? `${code} · ${name}` : code }
    })

    if (debouncedClientSearch.length < 2) {
      if (clientId && selectedClientLabel) {
        return [{ id: clientId, name: selectedClientLabel }]
      }
      return []
    }

    if (
      clientId &&
      selectedClientLabel &&
      !searchResults.some((option) => option.id === clientId)
    ) {
      return [{ id: clientId, name: selectedClientLabel }, ...searchResults]
    }

    return searchResults
  }, [clientId, clientsData?.items, debouncedClientSearch, selectedClientLabel])

  const activeSearchType = CLIENT_SEARCH_TYPES.find((opt) => opt.value === searchType)
  const searchTypeLabel = activeSearchType
    ? t(activeSearchType.labelKey, activeSearchType.fallback)
    : t('search.fullName', 'Full name')

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-dark-500 text-[12px] font-normal">
            {t(`${baseKey}.client`, 'Client')}
          </Label>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="text-dark-500 border-border bg-input flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-[12px] font-light outline-none"
              >
                <Icons.Search size={12} strokeWidth={1.5} className="text-gray-400" />
                {searchTypeLabel}
                <Icons.ArrowDown size={13} strokeWidth={1.5} className="text-gray-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[160px]">
              {CLIENT_SEARCH_TYPES.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  className="cursor-pointer text-[13px]"
                  onClick={() => {
                    setSearchType(opt.value)
                    setClientSearch('')
                  }}
                >
                  {t(opt.labelKey, opt.fallback)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <SearchableSelect
          options={clientOptions}
          value={clientId}
          onValueChange={(val) => {
            const option = clientOptions.find((item) => item.id === val)
            onClientIdChange(val)
            setSelectedClientLabel(option?.name ?? '')
            setClientSearch('')
          }}
          onSearchChange={setClientSearch}
          isLoading={clientsLoading}
          emptySearchHint={t(`${baseKey}.clientSearchHint`, 'Type 2+ characters to search…')}
          placeholder={t(`${baseKey}.selectClient`, 'Select client')}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-dark-500 text-[12px] font-normal">
          {t(`${baseKey}.contract`, 'Contract')}
        </Label>
        {!clientId ? (
          <p className="text-light-600 h-10 rounded-[8px] border border-gray-200 bg-gray-50 px-3 py-2 text-[13px] font-light">
            {t(`${baseKey}.selectClientFirst`, 'Select a client to load contracts')}
          </p>
        ) : requiresSelection ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="text-dark-500 border-border bg-input flex h-10 w-full items-center justify-between rounded-[8px] border px-3 text-[13px] font-light"
              >
                <span>
                  {contractNumber ||
                    (contractsLoading
                      ? t('pages.lawyerWorkplace.parameters.contractLoading', 'Loading contracts…')
                      : t('pages.lawyerWorkplace.parameters.selectContract', 'Select contract'))}
                </span>
                <Icons.ArrowDown size={16} strokeWidth={1.5} className="text-light-500" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-[var(--radix-dropdown-menu-trigger-width)]"
            >
              {contracts.map((contract) => {
                const number = contract.contract_number?.trim()
                if (!number) return null
                return (
                  <DropdownMenuItem
                    key={number}
                    onClick={() => onContractNumberChange(number)}
                    className="cursor-pointer"
                  >
                    {number}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <p className="text-dark-500 border-border bg-input h-10 rounded-[8px] border px-3 py-2 text-[13px] font-light">
            {contractsLoading
              ? t('pages.lawyerWorkplace.parameters.contractLoading', 'Loading contracts…')
              : contractNumber || t('pages.lawyerWorkplace.parameters.noContracts', 'No contracts')}
          </p>
        )}
      </div>
    </>
  )
}

export function DocumentClientContractFields({
  enabled,
  scope,
  ...props
}: DocumentClientContractFieldsProps) {
  if (!enabled) {
    return null
  }

  return <DocumentClientContractFieldsContent key={scope} scope={scope} {...props} />
}
