import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/Input'
import { Icons } from '@/lib/icons'
import { searchClients, type EnhancedSearchResult } from '@/api/clientSearchApi'
import { formatMoneyUAHTwoDecimals } from '@/lib/formatters'
import { piiProps } from '@/lib/openreplay/pii'

/** Below this the search matches too much to be useful and costs a round trip. */
const MIN_QUERY_LENGTH = 3
const DEBOUNCE_MS = 300

interface CallClientSearchProps {
  onSelect: (client: EnhancedSearchResult) => void
}

/**
 * Find the client behind a number the CRM does not recognise.
 *
 * An interaction always belongs to a client — `interactions.client_id` is NOT
 * NULL — so without this a call from an unknown number can be written up
 * nowhere at all. The operator finds the client the way they would anywhere
 * else in the CRM, and from there the window behaves as it does for a caller
 * we recognised.
 */
export function CallClientSearch({ onSelect }: CallClientSearchProps) {
  const { t } = useTranslation('common')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<EnhancedSearchResult[]>([])
  const [searching, setSearching] = useState(false)

  const tooShort = query.trim().length < MIN_QUERY_LENGTH

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < MIN_QUERY_LENGTH) return
    // Debounced, and every in-flight answer is discarded once superseded: the
    // operator is typing mid-call, so a slow early request must not land on top
    // of a later one and offer the wrong client to attach the call to.
    let current = true
    const handle = setTimeout(() => {
      setSearching(true)
      searchClients({ q: trimmed, search_type: 'all', limit: 8 })
        .then((response) => {
          if (current) setResults(response.items)
        })
        .catch(() => {
          if (current) setResults([])
        })
        .finally(() => {
          if (current) setSearching(false)
        })
    }, DEBOUNCE_MS)
    return () => {
      current = false
      clearTimeout(handle)
    }
  }, [query])

  // Derived rather than cleared in the effect: a short query has no results by
  // definition, and clearing them from an effect is a render the component does
  // not need.
  const visible = tooShort ? [] : results

  return (
    <div className="flex flex-col gap-2">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t(
          'pages.clients.modals.callDialog.searchClientPlaceholder',
          'Search by name, phone or tax number'
        )}
        aria-label={t('pages.clients.modals.callDialog.searchClient', 'Find the client')}
      />

      {searching && !tooShort && (
        <p className="text-muted-foreground text-center text-xs">
          {t('common.loading', 'Loading...')}
        </p>
      )}

      {visible.map((result) => (
        <button
          key={result.id}
          type="button"
          onClick={() => onSelect(result)}
          className="border-border hover:bg-muted flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors"
        >
          <Icons.User size={16} className="text-muted-foreground shrink-0" aria-hidden />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-foreground truncate text-sm font-medium" {...piiProps}>
              {result.full_name}
            </span>
            <span className="text-muted-foreground truncate text-xs">
              {result.phones[0] ?? result.tax_id}
            </span>
          </span>
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {formatMoneyUAHTwoDecimals(Number(result.total_debt) || 0)}
          </span>
        </button>
      ))}
    </div>
  )
}
