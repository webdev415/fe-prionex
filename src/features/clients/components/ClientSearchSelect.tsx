import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { searchClients, type SearchType } from '@/api/clientSearchApi'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { useDebounce } from '@/hooks/useDebounce'
import { Icons } from '@/lib/icons'

const SEARCH_TYPES: { value: SearchType; labelKey: string; fallback: string }[] = [
  { value: 'phone', labelKey: 'search.phoneNumber', fallback: 'Phone number' },
  { value: 'name', labelKey: 'search.fullName', fallback: 'Full name' },
  { value: 'email', labelKey: 'search.email', fallback: 'Email' },
  { value: 'tin', labelKey: 'search.tin', fallback: 'TIN' },
  { value: 'contract_number', labelKey: 'search.contractNumber', fallback: 'Contract number' },
]

/** `CL-00042 · Ivan Petrenko` — matches the label style used across the workplace. */
function formatClientLabel(item: {
  id: number
  full_name?: string | null
  first_name?: string | null
  last_name?: string | null
}): string {
  const code = `CL-${String(item.id).padStart(5, '0')}`
  const name =
    item.full_name?.trim() || [item.first_name, item.last_name].filter(Boolean).join(' ').trim()
  return name ? `${code} · ${name}` : code
}

export interface ClientSearchSelectProps {
  /** Selected client id as a string (`''` when none). Controlled by the parent. */
  value: string
  /** Fires with the picked client id and its display label. */
  onChange: (clientId: string, label: string) => void
  /** Display label for the current `value` (so the trigger shows a name without a fetch). */
  label?: string
  /** Gate the search query (e.g. only while a modal is open). Defaults to true. */
  enabled?: boolean
  placeholder?: string
  className?: string
}

/**
 * Reusable "find any client" picker: a search-type switch (phone / name / email /
 * TIN / contract) feeding a debounced global client search into a SearchableSelect.
 * Fully controlled — the parent owns `value`/`label`; this component only reports
 * selections. Extracted from the documents modal pattern so any flow can attach a
 * document from an arbitrary client, not just the one bound to the current record.
 */
export function ClientSearchSelect({
  value,
  onChange,
  label,
  enabled = true,
  placeholder,
  className,
}: ClientSearchSelectProps) {
  const { t } = useTranslation('common')
  const [search, setSearch] = useState('')
  const [searchType, setSearchType] = useState<SearchType>('name')
  const debouncedSearch = useDebounce(search, 300)

  const { data, isFetching } = useQuery({
    queryKey: ['client-search-select', searchType, debouncedSearch],
    queryFn: () => searchClients({ q: debouncedSearch, search_type: searchType, limit: 20 }),
    enabled: enabled && debouncedSearch.length >= 2,
    staleTime: 30_000,
  })

  const options = useMemo(() => {
    const results = (data?.items ?? []).map((item) => ({
      id: String(item.id),
      name: formatClientLabel(item),
    }))

    if (debouncedSearch.length < 2) {
      return value && label ? [{ id: value, name: label }] : []
    }
    if (value && label && !results.some((option) => option.id === value)) {
      return [{ id: value, name: label }, ...results]
    }
    return results
  }, [data?.items, debouncedSearch, label, value])

  const activeSearchType = SEARCH_TYPES.find((opt) => opt.value === searchType)
  const searchTypeLabel = activeSearchType
    ? t(activeSearchType.labelKey, activeSearchType.fallback)
    : t('search.fullName', 'Full name')

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-end">
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="text-foreground border-border bg-input flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-[12px] font-light outline-none"
            >
              <Icons.Search size={12} strokeWidth={1.5} className="text-muted-foreground" />
              {searchTypeLabel}
              <Icons.ArrowDown size={13} strokeWidth={1.5} className="text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[160px]">
            {SEARCH_TYPES.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                className="cursor-pointer text-[13px]"
                onClick={() => {
                  setSearchType(opt.value)
                  setSearch('')
                }}
              >
                {t(opt.labelKey, opt.fallback)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <SearchableSelect
        obscured
        options={options}
        value={value}
        onValueChange={(val) => {
          const option = options.find((item) => item.id === val)
          onChange(val, option?.name ?? '')
          setSearch('')
        }}
        onSearchChange={setSearch}
        isLoading={isFetching}
        emptySearchHint={t('search.clientSearchHint', 'Type 2+ characters to search…')}
        placeholder={placeholder ?? t('search.selectClient', 'Select client')}
      />
    </div>
  )
}
