import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { useLegalProfileTimezone } from '@/features/lawyerWorkplace/hooks/useLegalProfileTimezone'
import {
  formatLegalDueDateTime,
  parseLegalDueDate,
} from '@/features/lawyerWorkplace/utils/legalDueDate'
import type { LegalLetterType } from '@/features/lawyerWorkplace'
import type { KanbanTask } from '../../kanban/kanbanData'
import { resolveKanbanTypeBadgeProps } from './constants'
import { KanbanAssigneeChip } from './KanbanAssigneeChip'
import { KanbanClientChip } from './KanbanClientChip'
import { KanbanPriorityOption } from './KanbanPriorityOption'
import { KanbanTypeBadge } from './KanbanTypeBadge'

interface KanbanTaskDetailPanelProps {
  task: KanbanTask
  letterTypes?: LegalLetterType[]
}

export function KanbanTaskDetailPanel({ task, letterTypes = [] }: KanbanTaskDetailPanelProps) {
  const { t } = useTranslation('common')
  const timezone = useLegalProfileTimezone()
  const deadline = parseLegalDueDate(task.deadline)
  const typeBadge = resolveKanbanTypeBadgeProps(task.letterTypeId, letterTypes, task.type)

  return (
    <div className="bg-muted/50 flex h-full min-h-0 flex-col overflow-y-auto px-5 py-6">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
        <div className="bg-card border-border rounded-xl border p-4 shadow-sm">
          <div className="mb-3 flex items-start justify-between gap-3">
            <KanbanTypeBadge
              type={typeBadge.type}
              label={typeBadge.label}
              colorId={typeBadge.colorId}
            />
            <span className="text-muted-foreground text-[10px] font-medium tracking-wide">
              {task.id}
            </span>
          </div>
          <h2 className="text-foreground text-[15px] leading-snug font-semibold">{task.title}</h2>
        </div>

        <div className="bg-card border-border rounded-xl border p-4 shadow-sm">
          <dl className="grid gap-3 text-[13px]">
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                {t('pages.lawyerWorkplace.parameters.client', 'Client')}
              </dt>
              <dd className="text-foreground flex min-w-0 items-center gap-1.5">
                {task.clientCode ? (
                  <>
                    <KanbanClientChip code={task.clientCode} />
                    {task.clientName ? (
                      <span className="text-muted-foreground truncate">{task.clientName}</span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-muted-foreground italic">
                    {t('pages.lawyerWorkplace.letterItem.unidentified', 'unidentified')}
                  </span>
                )}
              </dd>
            </div>

            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                {t('pages.lawyerWorkplace.kanban.createTask.priority', 'Priority')}
              </dt>
              <dd>
                <KanbanPriorityOption priority={task.priority} />
              </dd>
            </div>

            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                {t('pages.lawyerWorkplace.parameters.dueDate', 'Due date')}
              </dt>
              <dd className="text-foreground">
                {deadline ? (
                  formatLegalDueDateTime(task.deadline, timezone)
                ) : (
                  <span className="text-muted-foreground italic">
                    {t('pages.lawyerWorkplace.kanban.noDeadline', 'no deadline set')}
                  </span>
                )}
              </dd>
            </div>

            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                {t('pages.lawyerWorkplace.parameters.lawyer', 'Lawyer')}
              </dt>
              <dd>
                <KanbanAssigneeChip
                  initials={task.assigneeInitials}
                  name={task.assigneeName}
                  assigneeUserId={task.assigneeUserId}
                />
              </dd>
            </div>
          </dl>
        </div>

        <div className="border-warning-200 bg-warning-50 flex items-start gap-2.5 rounded-xl border px-4 py-3">
          <Icons.Info size={18} strokeWidth={1.5} className="text-warning-700 mt-0.5 shrink-0" />
          <p className="text-warning-900 text-[12px] leading-relaxed">
            {t(
              'pages.lawyerWorkplace.kanban.noEmailThread',
              'This task has no linked email thread. Details above come from the kanban task only.'
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
