import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  MdClose,
  MdContentCopy,
  MdOutlinePersonOutline,
  MdRefresh,
  MdCheckCircle,
  MdError,
  MdRadioButtonUnchecked,
} from 'react-icons/md'
import { Button } from '@/components/ui/Button'
import { formatDateTime } from '@/lib/formatters'
import {
  useUbkiLogDetail,
  useSaveUbkiLogNote,
  useResendSubmission,
  useUbkiSettings,
  type UbkiLogDetail,
  type UbkiLogDetailStep,
} from '../api'

function TimelineIcon({ state }: { state: UbkiLogDetailStep['state'] }) {
  if (state === 'ok') return <MdCheckCircle size={16} className="text-success-500" />
  if (state === 'error') return <MdError size={16} className="text-error-500" />
  return <MdRadioButtonUnchecked size={16} className="text-warning-500" />
}

function CodeBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-800 bg-[#0f1420]">
      <div className="flex items-center justify-between border-b border-gray-800 px-3 py-1.5">
        <span className="text-[11px] font-medium tracking-wide text-gray-400 uppercase">
          {title}
        </span>
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(body)}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-gray-400 hover:text-white"
        >
          <MdContentCopy size={12} /> Copy
        </button>
      </div>
      <pre className="max-h-48 overflow-auto px-3 py-2 text-[11px] leading-relaxed whitespace-pre-wrap text-gray-300">
        {body}
      </pre>
    </div>
  )
}

function DrawerShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close drawer"
        onClick={onClose}
        className="absolute inset-0 bg-black/30"
      />
      <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        {children}
      </aside>
    </div>
  )
}

/**
 * Right-side drawer showing a submission's full report. Fetches the detail by
 * id when ``logId`` is set. Payloads are readable summaries derived from the
 * stored log (raw XML isn't captured); the admin note is persisted.
 */
export function SubmissionDrawer({
  logId,
  onClose,
}: {
  logId: string | null
  onClose: () => void
}) {
  if (!logId) return null
  return <SubmissionDrawerLoader logId={logId} onClose={onClose} />
}

function SubmissionDrawerLoader({ logId, onClose }: { logId: string; onClose: () => void }) {
  const { data, isLoading, isError } = useUbkiLogDetail(logId)

  if (isLoading || !data) {
    return (
      <DrawerShell onClose={onClose}>
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h3 className="text-dark-500 text-sm font-semibold">Submission #{logId}</h3>
          <button type="button" onClick={onClose} className="hover:text-dark-500 text-gray-400">
            <MdClose size={20} />
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center text-sm text-gray-500">
          {isError ? 'Failed to load submission.' : 'Loading…'}
        </div>
      </DrawerShell>
    )
  }
  // Key by id so the note field re-initialises when switching rows.
  return <SubmissionDrawerContent key={data.id} detail={data} onClose={onClose} />
}

function SubmissionDrawerContent({
  detail,
  onClose,
}: {
  detail: UbkiLogDetail
  onClose: () => void
}) {
  const saved = detail.admin_note ?? ''
  const [note, setNote] = useState(saved)
  const saveNote = useSaveUbkiLogNote()
  const resend = useResendSubmission()
  const navigate = useNavigate()

  const openClient = () => {
    onClose()
    navigate(`/dashboard/clients/${detail.client_id}`)
  }

  const handleResend = () => {
    resend.mutate(detail.debt_id, {
      onSuccess: (res) => {
        const ok = res.status === 'success'
        if (ok) {
          // A resend creates a NEW submission; this row (the old attempt) stays
          // as history. Close the drawer so the stale error view goes away —
          // the refreshed list shows the new successful submission.
          toast.success(
            `Resent successfully (new submission, request id: ${res.ubki_request_id ?? '—'}).`
          )
          onClose()
        } else {
          toast.error(
            `Resend ${res.status}: ${res.error_code ?? ''} ${res.error_message ?? ''}`.trim()
          )
        }
      },
      onError: () => toast.error('Resend failed. Please try again.'),
    })
  }

  // Match the submission log: timestamps follow the UBKI Settings timezone.
  const { data: ubkiSettings } = useUbkiSettings()
  const logTimezone = ubkiSettings?.timezone ?? 'Europe/Kyiv'
  const failed = detail.status === 'error'
  const clientName = detail.client_name ?? `Client #${detail.client_id}`
  const clientTin = detail.client_tin ? `TIN ${detail.client_tin}` : `Debt #${detail.debt_id}`
  const creditDate = `${detail.contract_number ?? '—'} · ${formatDateTime(detail.created_at, logTimezone)}`
  const dirty = note !== saved

  return (
    <DrawerShell onClose={onClose}>
      {/* header */}
      <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                failed ? 'bg-error-50 text-error-700' : 'bg-success-50 text-success-700'
              }`}
            >
              {detail.status}
            </span>
            <h3 className="text-dark-500 text-sm font-semibold">Submission #{detail.id}</h3>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {clientName} · #{detail.client_id} · {clientTin}
          </p>
          <p className="text-xs text-gray-400">{creditDate}</p>
        </div>
        <button type="button" onClick={onClose} className="hover:text-dark-500 text-gray-400">
          <MdClose size={20} />
        </button>
      </div>

      {/* actions */}
      <div className="flex gap-2 px-5 py-3">
        <Button
          variant="outline"
          size="sm"
          leftIcon={<MdOutlinePersonOutline size={14} />}
          onClick={openClient}
        >
          Open client
        </Button>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<MdRefresh size={14} />}
          disabled={resend.isPending}
          onClick={handleResend}
        >
          {resend.isPending ? 'Resending…' : 'Resend'}
        </Button>
      </div>

      {/* body */}
      <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-5">
        <div>
          <p className="text-dark-500 mb-2 text-xs font-semibold">Submission Timeline</p>
          <ol className="space-y-3">
            {detail.timeline.map((step, i) => (
              <li key={i} className="flex gap-2">
                <TimelineIcon state={step.state} />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-dark-500 text-xs font-medium">{step.label}</span>
                    <span className="text-[11px] text-gray-400">{step.time}</span>
                  </div>
                  {step.detail && <p className="text-[11px] text-gray-500">{step.detail}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>

        {detail.error_code && (
          <div className="border-error-200 bg-error-50 rounded-lg border px-3 py-2">
            <p className="text-error-700 text-xs font-semibold">{detail.error_code}</p>
            {detail.error_message && (
              <p className="text-error-600 text-[11px]">{detail.error_message}</p>
            )}
          </div>
        )}

        <CodeBlock title="Request · parameters" body={detail.request_summary} />
        <CodeBlock title="Response" body={detail.response_summary} />
        <CodeBlock title="Execution log" body={detail.execution_log} />

        {/* admin notes */}
        <div>
          <p className="text-dark-500 mb-1 text-xs font-semibold">Admin Notes</p>
          <textarea
            value={note}
            maxLength={100}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note about this submission…"
            className="focus:border-primary-500 h-20 w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 focus:outline-none"
          />
          <div className="text-right text-[11px] text-gray-400">{note.length}/100</div>
          {saveNote.isError && <p className="text-error-600 text-[11px]">Failed to save note.</p>}
        </div>
      </div>

      {/* footer */}
      <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-3">
        <Button
          variant="outline"
          size="sm"
          disabled={!dirty || saveNote.isPending}
          onClick={() => setNote(saved)}
        >
          Discard changes
        </Button>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<MdCheckCircle size={14} />}
          disabled={!dirty || saveNote.isPending}
          onClick={() => saveNote.mutate({ id: detail.id, note })}
        >
          {saveNote.isPending ? 'Saving…' : 'Save Note'}
        </Button>
      </div>
    </DrawerShell>
  )
}
