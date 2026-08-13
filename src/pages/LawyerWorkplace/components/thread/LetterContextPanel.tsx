import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useClient } from '@/features/clients/hooks/useClients'
import { formatCurrency } from '@/lib/formatters'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { KanbanColumnId, KanbanTask } from '../../kanban/kanbanData'
import type { LetterDetail } from '../../types'
import { formatDueDate, formatLegalDeadline } from '../../utils/formatters'
import { useLegalProfileTimezone } from '@/features/lawyerWorkplace/hooks/useLegalProfileTimezone'

/** Slug → chip colour, mirrors the letter-type palette used on the parameters panel. */
const TYPE_COLOURS: Record<string, string> = {
  complaint: 'bg-error-100 text-error-700',
  nbu_inquiry: 'bg-secondary-100 text-secondary-800',
  court_claim: 'bg-warning-100 text-warning-700',
  attorney_request: 'bg-violet-100 text-violet-700',
  inquiry: 'bg-success-100 text-success-700',
}

const COLUMN_LABEL_KEYS: Record<KanbanColumnId, string> = {
  not_defined: 'pages.lawyerWorkplace.kanban.columns.notDefined',
  in_progress: 'pages.lawyerWorkplace.kanban.columns.inProgress',
  overdue: 'pages.lawyerWorkplace.kanban.columns.overdue',
  completed: 'pages.lawyerWorkplace.kanban.columns.completed',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex w-full flex-col gap-2.5">
      <h4 className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        {title}
      </h4>
      <div className="flex w-full flex-col gap-2">{children}</div>
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground shrink-0 text-[12px]">{label}</span>
      <span className="text-foreground min-w-0 text-right text-[12px] font-medium break-words">
        {children}
      </span>
    </div>
  )
}

export interface LetterContextPanelProps {
  letter: LetterDetail
  task?: KanbanTask
}

/**
 * Read-only context rail shown beside the email thread in the kanban drawer.
 * Surfaces the debtor card (ІПН / debt / contract), the letter classification,
 * the kanban assignment and a short thread summary. No mutations — quick actions
 * (generate / attach) live in the composer on the left.
 */
export function LetterContextPanel({ letter, task }: LetterContextPanelProps) {
  const { t, i18n } = useTranslation('common')
  const lang = i18n.language
  const timezone = useLegalProfileTimezone()

  const clientId = useMemo(() => {
    const fromReply = letter.replyContext.clientId
    if (fromReply != null && fromReply > 0) return fromReply
    const fromParams = letter.parameters.clientId ? Number(letter.parameters.clientId) : NaN
    if (Number.isFinite(fromParams) && fromParams > 0) return fromParams
    const fromLetter = letter.clientId ? Number(letter.clientId) : NaN
    return Number.isFinite(fromLetter) && fromLetter > 0 ? fromLetter : null
  }, [letter])

  const hasClient = clientId != null
  const { data: client } = useClient(clientId ?? 0, hasClient)

  const clientName =
    letter.clientName ??
    (client
      ? [client.last_name, client.first_name, client.middle_name]
          .filter(Boolean)
          .join(' ')
          .trim() || null
      : null)
  const clientCode = letter.clientCode ?? (clientId != null ? `CL-${clientId}` : null)
  const contractLabel = letter.parameters.contractLabel?.trim() || null

  const typeLabel = letter.letterTypeLabel ?? letter.parameters.letterType ?? null
  const typeSlug = letter.letterType ?? letter.parameters.letterType ?? ''
  const typeColour = TYPE_COLOURS[typeSlug] ?? 'bg-muted text-muted-foreground'

  const dueDate = letter.parameters.dueDate?.trim() || null
  const dueDateHint = letter.parameters.dueDateHint?.trim() || null
  const deadlineFallback = task?.deadline ?? null

  const lawyerLabel = letter.parameters.lawyerLabel?.trim() || task?.assigneeName?.trim() || null
  const columnId = task?.columnId ?? null
  const legalTaskId = letter.legalTaskId ?? (task ? task.legalTaskId : null)
  const letterCount = task?.letterCount ?? 1
  const messageCount = letter.thread.length

  const dash = t('pages.lawyerWorkplace.context.empty', '—')

  return (
    <div className="bg-card flex h-full w-full min-w-0 flex-col overflow-y-auto">
      <div className="flex w-full flex-col gap-5 px-4 py-4">
        <div className="flex items-center gap-2">
          <Icons.Info size={16} strokeWidth={1.5} className="text-muted-foreground" />
          <span className="text-foreground text-[13px] font-medium">
            {t('pages.lawyerWorkplace.context.title', 'Letter context')}
          </span>
        </div>

        {/* 1. Client */}
        <Section title={t('pages.lawyerWorkplace.context.client.title', 'Client')}>
          {hasClient ? (
            <>
              <Row label={t('pages.lawyerWorkplace.context.client.name', 'Full name')}>
                {clientName ?? dash}
              </Row>
              <Row label={t('pages.lawyerWorkplace.context.client.code', 'Client code')}>
                {clientCode ?? dash}
              </Row>
              <Row label={t('pages.lawyerWorkplace.context.client.tin', 'TIN')}>
                {client?.tax_id?.trim() || dash}
              </Row>
              <Row label={t('pages.lawyerWorkplace.context.client.debt', 'Outstanding debt')}>
                {client?.total_debt != null ? formatCurrency(client.total_debt) : dash}
              </Row>
              <Row label={t('pages.lawyerWorkplace.context.client.contract', 'Contract №')}>
                {contractLabel ?? dash}
              </Row>
              <Row label={t('pages.lawyerWorkplace.context.client.status', 'Status')}>
                {client?.status?.trim() || dash}
              </Row>
              {clientId != null && (
                <Link
                  to={`/dashboard/clients/${clientId}`}
                  className="text-primary-700 hover:text-primary-800 mt-1 inline-flex items-center gap-1 text-[12px] font-medium"
                >
                  <Icons.ArrowRight02 size={13} strokeWidth={1.5} />
                  {t('pages.lawyerWorkplace.context.client.openCard', 'Open client card')}
                </Link>
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-[12px]">
              {t('pages.lawyerWorkplace.context.client.notIdentified', 'Client not identified')}
            </p>
          )}
        </Section>

        {/* 2. Classification */}
        <Section title={t('pages.lawyerWorkplace.context.classification.title', 'Classification')}>
          <Row label={t('pages.lawyerWorkplace.context.classification.type', 'Letter type')}>
            {typeLabel ? (
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium',
                  typeColour
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                {typeLabel}
              </span>
            ) : (
              dash
            )}
          </Row>
          <Row label={t('pages.lawyerWorkplace.context.classification.referenceId', 'Incoming №')}>
            {letter.referenceId || dash}
          </Row>
          <Row label={t('pages.lawyerWorkplace.context.classification.receivedAt', 'Received')}>
            {letter.receivedAt ? formatDueDate(letter.receivedAt, lang) : dash}
          </Row>
          <Row label={t('pages.lawyerWorkplace.context.classification.deadline', 'Deadline / SLA')}>
            {dueDate ? (
              <span className="inline-flex flex-col items-end">
                <span>{formatLegalDeadline(dueDate, lang, timezone)}</span>
                {dueDateHint && <span className="text-error-500 text-[11px]">{dueDateHint}</span>}
              </span>
            ) : deadlineFallback ? (
              formatLegalDeadline(deadlineFallback, lang, timezone)
            ) : (
              dash
            )}
          </Row>
        </Section>

        {/* 3. Assignment */}
        <Section title={t('pages.lawyerWorkplace.context.assignment.title', 'Assignment')}>
          <Row label={t('pages.lawyerWorkplace.context.assignment.lawyer', 'Responsible lawyer')}>
            {lawyerLabel ?? dash}
          </Row>
          <Row label={t('pages.lawyerWorkplace.context.assignment.taskStatus', 'Task status')}>
            {columnId ? t(COLUMN_LABEL_KEYS[columnId], columnId) : letter.status}
          </Row>
          {legalTaskId != null && legalTaskId > 0 && (
            <Row label={t('pages.lawyerWorkplace.context.assignment.kanbanTask', 'Kanban task')}>
              #{legalTaskId}
            </Row>
          )}
        </Section>

        {/* 4. History */}
        <Section title={t('pages.lawyerWorkplace.context.history.title', 'History')}>
          <Row label={t('pages.lawyerWorkplace.context.history.letterCount', 'Letters')}>
            {letterCount}
          </Row>
          <Row
            label={t('pages.lawyerWorkplace.context.history.messageCount', 'Messages in thread')}
          >
            {messageCount}
          </Row>
        </Section>
      </div>
    </div>
  )
}
