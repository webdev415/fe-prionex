import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
import { piiProps } from '@/lib/openreplay/pii'

function TimelineIcon({ state }: { state: UbkiLogDetailStep['state'] }) {
  if (state === 'ok') return <MdCheckCircle size={16} className="text-success-500" />
  if (state === 'error') return <MdError size={16} className="text-error-500" />
  return <MdRadioButtonUnchecked size={16} className="text-warning-500" />
}

function CodeBlock({ title, body }: { title: string; body: string }) {
  const { t } = useTranslation('common')
  return (
    <div className="border-border bg-muted overflow-hidden rounded-lg border">
      <div className="border-border flex items-center justify-between border-b px-3 py-1.5">
        <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
          {title}
        </span>
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(body)}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px]"
        >
          <MdContentCopy size={12} /> {t('pages.ubkiIntegration.drawer.codeBlock.copy', 'Copy')}
        </button>
      </div>
      <pre className="text-foreground max-h-48 overflow-auto px-3 py-2 text-[11px] leading-relaxed whitespace-pre-wrap">
        {body}
      </pre>
    </div>
  )
}

function DrawerShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const { t } = useTranslation('common')
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label={t('pages.ubkiIntegration.drawer.closeDrawer', 'Close drawer')}
        onClick={onClose}
        className="absolute inset-0 bg-black/30"
      />
      <aside className="bg-card relative flex h-full w-full max-w-md flex-col shadow-xl">
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
  const { t } = useTranslation('common')
  const { data, isLoading, isError } = useUbkiLogDetail(logId)

  if (isLoading || !data) {
    return (
      <DrawerShell onClose={onClose}>
        <div className="border-border flex items-center justify-between border-b px-5 py-4">
          <h3 className="text-foreground text-sm font-semibold">
            {t('pages.ubkiIntegration.drawer.submissionTitle', {
              defaultValue: 'Submission #{{id}}',
              id: logId,
            })}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="hover:text-foreground text-muted-foreground"
          >
            <MdClose size={20} />
          </button>
        </div>
        <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
          {isError
            ? t('pages.ubkiIntegration.drawer.loadError', 'Failed to load submission.')
            : t('pages.ubkiIntegration.drawer.loading', 'Loading…')}
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
  const { t } = useTranslation('common')
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
            t('pages.ubkiIntegration.drawer.toast.resendSuccess', {
              defaultValue: 'Resent successfully (new submission, request id: {{requestId}}).',
              requestId: res.ubki_request_id ?? '—',
            })
          )
          onClose()
        } else {
          toast.error(
            t('pages.ubkiIntegration.drawer.toast.resendError', {
              defaultValue: 'Resend {{status}}: {{code}} {{message}}',
              status: res.status,
              code: res.error_code ?? '',
              message: res.error_message ?? '',
            }).trim()
          )
        }
      },
      onError: () =>
        toast.error(
          t('pages.ubkiIntegration.drawer.toast.resendFailed', 'Resend failed. Please try again.')
        ),
    })
  }

  // Match the submission log: timestamps follow the UBKI Settings timezone.
  const { data: ubkiSettings } = useUbkiSettings()
  const logTimezone = ubkiSettings?.timezone ?? 'Europe/Kyiv'
  const failed = detail.status === 'error'
  const clientName =
    detail.client_name ??
    t('pages.ubkiIntegration.drawer.clientFallback', {
      defaultValue: 'Client #{{id}}',
      id: detail.client_id,
    })
  const clientTin = detail.client_tin
    ? t('pages.ubkiIntegration.drawer.clientTin', {
        defaultValue: 'TIN {{tin}}',
        tin: detail.client_tin,
      })
    : t('pages.ubkiIntegration.drawer.debtId', {
        defaultValue: 'Debt #{{id}}',
        id: detail.debt_id,
      })
  const creditDate = `${detail.contract_number ?? '—'} · ${formatDateTime(detail.created_at, logTimezone)}`
  const dirty = note !== saved

  return (
    <DrawerShell onClose={onClose}>
      {/* header */}
      <div className="border-border flex items-start justify-between border-b px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                failed ? 'bg-error-50 text-error-700' : 'bg-success-50 text-success-700'
              }`}
            >
              {detail.status}
            </span>
            <h3 className="text-foreground text-sm font-semibold">
              {t('pages.ubkiIntegration.drawer.submissionTitle', {
                defaultValue: 'Submission #{{id}}',
                id: detail.id,
              })}
            </h3>
          </div>
          <p className="text-muted-foreground mt-1 text-xs" {...piiProps}>
            {clientName} · #{detail.client_id} · {clientTin}
          </p>
          <p className="text-muted-foreground text-xs">{creditDate}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="hover:text-foreground text-muted-foreground"
        >
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
          {t('pages.ubkiIntegration.drawer.openClient', 'Open client')}
        </Button>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<MdRefresh size={14} />}
          disabled={resend.isPending}
          onClick={handleResend}
        >
          {resend.isPending
            ? t('pages.ubkiIntegration.drawer.resending', 'Resending…')
            : t('pages.ubkiIntegration.drawer.resend', 'Resend')}
        </Button>
      </div>

      {/* body */}
      <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-5">
        <div>
          <p className="text-foreground mb-2 text-xs font-semibold">
            {t('pages.ubkiIntegration.drawer.timeline.title', 'Submission Timeline')}
          </p>
          <ol className="space-y-3">
            {detail.timeline.map((step, i) => (
              <li key={i} className="flex gap-2">
                <TimelineIcon state={step.state} />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground text-xs font-medium">{step.label}</span>
                    <span className="text-muted-foreground text-[11px]">{step.time}</span>
                  </div>
                  {step.detail && (
                    <p className="text-muted-foreground text-[11px]">{step.detail}</p>
                  )}
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

        <CodeBlock
          title={t(
            'pages.ubkiIntegration.drawer.codeBlock.requestParameters',
            'Request · parameters'
          )}
          body={detail.request_summary}
        />
        <CodeBlock
          title={t('pages.ubkiIntegration.drawer.codeBlock.response', 'Response')}
          body={detail.response_summary}
        />
        <CodeBlock
          title={t('pages.ubkiIntegration.drawer.codeBlock.executionLog', 'Execution log')}
          body={detail.execution_log}
        />

        {/* admin notes */}
        <div>
          <p className="text-foreground mb-1 text-xs font-semibold">
            {t('pages.ubkiIntegration.drawer.adminNotes.title', 'Admin Notes')}
          </p>
          <textarea
            value={note}
            maxLength={100}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t(
              'pages.ubkiIntegration.drawer.adminNotes.placeholder',
              'Add a note about this submission…'
            )}
            className="focus:border-primary-500 border-border text-foreground h-20 w-full resize-none rounded-lg border px-3 py-2 text-xs focus:outline-none"
          />
          <div className="text-muted-foreground text-right text-[11px]">{note.length}/100</div>
          {saveNote.isError && (
            <p className="text-error-600 text-[11px]">
              {t('pages.ubkiIntegration.drawer.adminNotes.saveError', 'Failed to save note.')}
            </p>
          )}
        </div>
      </div>

      {/* footer */}
      <div className="border-border flex justify-end gap-2 border-t px-5 py-3">
        <Button
          variant="outline"
          size="sm"
          disabled={!dirty || saveNote.isPending}
          onClick={() => setNote(saved)}
        >
          {t('pages.ubkiIntegration.drawer.discardChanges', 'Discard changes')}
        </Button>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<MdCheckCircle size={14} />}
          disabled={!dirty || saveNote.isPending}
          onClick={() => saveNote.mutate({ id: detail.id, note })}
        >
          {saveNote.isPending
            ? t('pages.ubkiIntegration.drawer.saving', 'Saving…')
            : t('pages.ubkiIntegration.drawer.saveNote', 'Save Note')}
        </Button>
      </div>
    </DrawerShell>
  )
}
