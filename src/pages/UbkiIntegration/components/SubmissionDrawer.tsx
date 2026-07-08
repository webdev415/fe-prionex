import { useState } from 'react'
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
import type { SubmissionDetail, TimelineStep } from '../mockData'

function TimelineIcon({ state }: { state: TimelineStep['state'] }) {
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

/**
 * Right-side drawer showing a submission's full report. Closed when
 * ``detail`` is null. Payloads/timeline/notes are mock today
 * (// TODO(ubki-backend)); Resend maps to POST /api/v1/ubki/submit.
 */
export function SubmissionDrawer({
  detail,
  onClose,
}: {
  detail: SubmissionDetail | null
  onClose: () => void
}) {
  if (!detail) return null
  // Key by id so note state re-initializes from the new detail on open/switch,
  // avoiding a setState-in-effect sync.
  return <SubmissionDrawerContent key={detail.id} detail={detail} onClose={onClose} />
}

function SubmissionDrawerContent({
  detail,
  onClose,
}: {
  detail: SubmissionDetail
  onClose: () => void
}) {
  const [note, setNote] = useState(detail.adminNotes ?? '')
  const failed = detail.status === 'failed'

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close drawer"
        onClick={onClose}
        className="absolute inset-0 bg-black/30"
      />
      <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl">
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
              {detail.clientName} · {detail.clientId} · {detail.clientTin}
            </p>
            <p className="text-xs text-gray-400">{detail.creditDate}</p>
          </div>
          <button type="button" onClick={onClose} className="hover:text-dark-500 text-gray-400">
            <MdClose size={20} />
          </button>
        </div>

        {/* actions */}
        <div className="flex gap-2 px-5 py-3">
          <Button variant="outline" size="sm" leftIcon={<MdOutlinePersonOutline size={14} />}>
            Open client
          </Button>
          {/* TODO(ubki-backend): Resend → POST /api/v1/ubki/submit */}
          <Button variant="primary" size="sm" leftIcon={<MdRefresh size={14} />}>
            Resend
          </Button>
        </div>

        {/* body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-5">
          {/* timeline */}
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

          {detail.errorBanner && (
            <div className="border-error-200 bg-error-50 rounded-lg border px-3 py-2">
              <p className="text-error-700 text-xs font-semibold">{detail.errorBanner.code}</p>
              <p className="text-error-600 text-[11px]">{detail.errorBanner.message}</p>
            </div>
          )}

          <CodeBlock title="Request payload · XML · Outbound" body={detail.requestPayload} />
          <CodeBlock title="Response" body={detail.responsePayload} />
          <CodeBlock title="Execution log" body={detail.executionLog} />

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
          </div>
        </div>

        {/* footer */}
        <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            Discard changes
          </Button>
          {/* TODO(ubki-backend): persist note → PATCH log row */}
          <Button variant="primary" size="sm" leftIcon={<MdCheckCircle size={14} />}>
            Save Note
          </Button>
        </div>
      </aside>
    </div>
  )
}
