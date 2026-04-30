import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { useCallsByPhone } from '@/features/actionAnalysis'
import type { CallMonitoringItem } from '@/features/actionAnalysis'
import { CallsTable } from './CallsTable'

interface Props {
  onPlayRecording: (call: CallMonitoringItem) => void
}

export function PhoneSearchPanel({ onPlayRecording }: Props) {
  const { t } = useTranslation('common')
  const [draft, setDraft] = useState('')
  const [phone, setPhone] = useState('')

  const { data, isFetching, error } = useCallsByPhone(phone, 'date_desc', phone.length >= 3)

  const summary = data?.summary
  const calls = data?.calls ?? []

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-medium text-gray-800">
        {t('pages.actionAnalysis.phoneSearch.title', 'Phone number search')}
      </h3>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="tel"
          inputMode="tel"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('pages.actionAnalysis.phoneSearch.placeholder', 'Enter phone number')}
          className="h-10 flex-1 rounded-md border border-gray-300 bg-white px-3 text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter') setPhone(draft.trim())
          }}
        />
        <Button
          variant="primary"
          size="sm"
          onClick={() => setPhone(draft.trim())}
          disabled={draft.trim().length < 3}
        >
          <Icons.Search size={16} className="mr-1" strokeWidth={1.5} />
          {t('pages.actionAnalysis.phoneSearch.search', 'Search')}
        </Button>
      </div>

      {phone && (
        <div className="mt-4 flex flex-col gap-3">
          {error ? (
            <div className="rounded-md border border-error-200 bg-error-50 p-3 text-sm text-error-700">
              {t('pages.actionAnalysis.errors.loadFailed', 'Failed to load calls')}
            </div>
          ) : (
            <>
              {summary && (
                <div className="text-sm text-gray-600">
                  {t('pages.actionAnalysis.phoneSearch.summary', {
                    defaultValue: '{{total}} call(s), {{answered}} answered',
                    total: summary.total_calls,
                    answered: summary.answered_calls,
                  })}
                </div>
              )}
              <CallsTable data={calls} loading={isFetching} onPlayRecording={onPlayRecording} />
            </>
          )}
        </div>
      )}
    </div>
  )
}
