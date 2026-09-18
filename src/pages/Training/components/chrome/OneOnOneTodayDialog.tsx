import { useTranslation } from 'react-i18next'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { useOneOnOnes } from '@/features/quality/coaching/hooks'
import type { OneOnOneRecord } from '@/features/quality/coaching/types'
import { useOperators } from '@/features/users/hooks'
import { useAuthStore } from '@/stores/authStore'
import { piiProps } from '@/lib/openreplay/pii'

/**
 * "1-on-1 today" drill-down dialog (Tanya's 13.08 complaint: the header tile
 * shows a session exists, but nothing opens — who / when / what topic is
 * invisible).
 *
 * Lists the trainer's sessions scheduled for TODAY: operator name (resolved
 * via the shared operator directory), time, duration, and notes. Mirrors the
 * BE tile counter `_count_one_on_ones_today` (queue_service.py): trainer's
 * own sessions, `status = 'scheduled'`, `date(scheduled_at) = current UTC
 * date` — so the list matches the number on the tile.
 *
 * Data: GET /coaching/one-on-ones (scope=mine). The endpoint has no date
 * filter, so we pull `upcoming_only=false, limit=200` and filter client-side.
 * v1 caveat: the BE orders ascending, so a trainer with >200 historical
 * sessions could see today's rows truncated — the proper fix is a date
 * filter on the BE list endpoint (follow-up).
 */
export interface OneOnOneTodayDialogProps {
  open: boolean
  onClose: () => void
}

/** Same day check in UTC — mirrors BE `func.date(scheduled_at) == current_date`. */
function isTodayUtc(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate()
  )
}

function formatSessionTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function OneOnOneTodayDialog({ open, onClose }: OneOnOneTodayDialogProps) {
  const { t } = useTranslation('common')
  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  // includeInactive: a session may point at a now-blocked operator — we still
  // want their name in the list instead of the `#id` fallback. The dialog is
  // permanently mounted next to the strip, so gate the fetch on `open` (the
  // hook's `enabled` is derived from a non-null projectId).
  const { data: operators = [] } = useOperators(
    open && activeProjectId ? Number(activeProjectId) : null,
    { includeInactive: true }
  )

  const {
    data: sessions,
    isLoading,
    isError,
  } = useOneOnOnes({ scope: 'mine', upcoming_only: false, limit: 200 }, open)

  const todaySessions: OneOnOneRecord[] = (sessions ?? []).filter(
    (s) => s.status === 'scheduled' && isTodayUtc(s.scheduled_at)
  )

  const operatorName = (operatorId: number): string =>
    operators.find((o) => o.id === operatorId)?.full_name ?? `#${operatorId}`

  return (
    <Modal open={open} onClose={onClose} maxWidth="md">
      <ModalHeader title={t('pages.training.inbox.oneOnOneTodayDialog.title', '1-on-1 today')} />
      <ModalContent>
        <div className="flex flex-col gap-2">
          {isLoading ? (
            <p className="px-1 py-2 text-sm text-gray-500">
              {t('pages.training.inbox.oneOnOneTodayDialog.loading', 'Loading sessions…')}
            </p>
          ) : isError ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {t(
                'pages.training.inbox.oneOnOneTodayDialog.loadError',
                'Could not load the sessions. Try again later.'
              )}
            </p>
          ) : todaySessions.length === 0 ? (
            <p className="px-1 py-2 text-sm text-gray-500">
              {t(
                'pages.training.inbox.oneOnOneTodayDialog.empty',
                'No 1-on-1 sessions scheduled for today.'
              )}
            </p>
          ) : (
            todaySessions.map((session) => (
              <div
                key={session.id}
                className="flex flex-col gap-1 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-gray-800">
                    <Icons.User size={14} className="flex-shrink-0 text-gray-500" />
                    <span className="truncate" {...piiProps}>
                      {operatorName(session.operator_id)}
                    </span>
                  </span>
                  <span className="flex flex-shrink-0 items-center gap-1 text-sm text-gray-600">
                    <Icons.Calendar size={14} className="text-gray-500" />
                    {formatSessionTime(session.scheduled_at)}
                    <span className="text-xs text-gray-400">
                      ·{' '}
                      {t('pages.training.inbox.oneOnOneTodayDialog.duration', '{{minutes}} min', {
                        minutes: session.duration_minutes,
                      })}
                    </span>
                  </span>
                </div>
                {session.notes ? (
                  <p className="text-xs whitespace-pre-wrap text-gray-600">{session.notes}</p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </ModalContent>
      <ModalFooter>
        <Button variant="primary" size="md" onClick={onClose} className="rounded-full">
          {t('actions.close', 'Close')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default OneOnOneTodayDialog
