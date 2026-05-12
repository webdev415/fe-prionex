import axios from 'axios'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Icons } from '@/lib/icons'
import { useExportTimeline, useTimeline, type TimelineEventDto } from '@/features/operatorAnalytics'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { readTimelineBarState, writeTimelineBarState } from '../lib/analyticsUrlState'

function formatOffset(seconds?: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—'
  const sign = seconds < 0 ? '-' : ''
  const abs = Math.abs(Math.round(seconds))
  const mins = Math.floor(abs / 60)
  const secs = abs % 60
  return `${sign}${mins}:${String(secs).padStart(2, '0')}`
}

export function TimelineTab() {
  const { t } = useTranslation('common')
  const [searchParams, setSearchParams] = useSearchParams()
  const urlState = readTimelineBarState(searchParams)

  const [draftCallId, setDraftCallId] = useState(urlState.call_id ?? '')

  const callId = urlState.call_id ?? null
  const { data, isPending, isError, error } = useTimeline(callId, !!callId)
  const exportMutation = useExportTimeline()

  // 422 means the supplied call_id didn't parse as a UUID. Anything else is a
  // generic server/network failure.
  const isInvalidCallId = isError && axios.isAxiosError(error) && error.response?.status === 422

  const handleApply = () => {
    const trimmed = draftCallId.trim() || undefined
    setSearchParams(writeTimelineBarState(searchParams, { call_id: trimmed }), {
      replace: true,
    })
  }

  const handleExport = async () => {
    if (!callId) return
    try {
      await exportMutation.mutateAsync({ call_id: callId })
    } catch (err) {
      console.error('Timeline export failed', err)
      toast.error(t('pages.actionAnalysis.errors.exportFailed', 'Export failed'))
    }
  }

  const events = useMemo<TimelineEventDto[]>(() => data?.events ?? [], [data])

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl bg-white/50 p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
          <div className="flex flex-1 flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium sm:text-sm">
              {t('pages.actionAnalysis.timeline.callId', 'Call ID')}
            </span>
            <Input
              type="text"
              className="h-[45px]"
              placeholder={t(
                'pages.actionAnalysis.timeline.callIdPlaceholder',
                'Paste a call UUID to load the timeline'
              )}
              value={draftCallId}
              onChange={(e) => setDraftCallId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleApply()
              }}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={handleApply}
            className="h-[45px] sm:px-8"
          >
            {t('pages.actionAnalysis.timeline.load', 'Load')}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleExport}
            disabled={!callId || exportMutation.isPending || events.length === 0}
            leftIcon={<Icons.Download size={16} className="text-dark-500" />}
            className="h-[45px] rounded-full sm:px-6"
          >
            {exportMutation.isPending
              ? t('pages.actionAnalysis.actions.exporting', 'Exporting…')
              : t('pages.actionAnalysis.actions.exportExcel', 'Export to Excel')}
          </Button>
        </div>
      </div>

      {!callId ? (
        <div className="rounded-xl bg-white/50 p-6 text-center text-sm text-gray-500 shadow-sm">
          {t(
            'pages.actionAnalysis.timeline.empty',
            'Enter a call ID above to inspect its operator action timeline.'
          )}
        </div>
      ) : isError ? (
        <div className="rounded-xl bg-red-50 p-6 text-center text-sm text-red-700 shadow-sm">
          {isInvalidCallId
            ? t(
                'pages.actionAnalysis.errors.invalidCallId',
                'Invalid Call ID. Paste a full call UUID (36 characters).'
              )
            : t('pages.actionAnalysis.errors.loadTimelineFailed', 'Failed to load the timeline.')}
        </div>
      ) : isPending ? (
        <div className="overflow-x-auto rounded-xl bg-white/80 shadow-sm">
          <TableSkeleton columns={4} rows={8} className="w-full" />
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-xl bg-white/50 p-6 text-center text-sm text-gray-500 shadow-sm">
          {t(
            'pages.actionAnalysis.timeline.noEvents',
            'No tracking events recorded for this call.'
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white/80 shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left text-xs text-gray-600 uppercase">
              <tr>
                <th className="px-4 py-2">
                  {t('pages.actionAnalysis.timeline.columns.offset', 'Offset')}
                </th>
                <th className="px-4 py-2">
                  {t('pages.actionAnalysis.timeline.columns.event', 'Event')}
                </th>
                <th className="px-4 py-2">
                  {t('pages.actionAnalysis.timeline.columns.page', 'Page')}
                </th>
                <th className="px-4 py-2">
                  {t('pages.actionAnalysis.timeline.columns.timestamp', 'Timestamp')}
                </th>
              </tr>
            </thead>
            <tbody>
              {events.map((event, index) => (
                <tr key={`${event.ts}-${index}`} className="border-t border-gray-100">
                  <td className="px-4 py-2 font-mono text-xs text-gray-700">
                    {formatOffset(event.offset_seconds)}
                  </td>
                  <td className="px-4 py-2 font-medium text-gray-800">{event.event_type}</td>
                  <td className="px-4 py-2 text-gray-600">{event.page_ref ?? '—'}</td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">
                    {new Date(event.ts).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
