import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { formatDateTime, formatTaskDueDateForDisplay } from '@/lib/formatters'
import type { TaskHistoryItem, TaskHistorySort } from '@/features/training'

type Row = TaskHistoryItem & { id: number }

interface Props {
  data: TaskHistoryItem[]
  userTimezone?: string | null
  sort: TaskHistorySort
  onSortChange: (next: TaskHistorySort) => void
}

const SORT_OPTIONS: TaskHistorySort[] = [
  'created_at_desc',
  'created_at_asc',
  'due_date_asc',
  'due_date_desc',
]

const PRIORITY_BADGE: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  normal: 'bg-blue-100 text-blue-700',
  high: 'bg-warning-50 text-warning-700',
  urgent: 'bg-error-50 text-error-700',
  critical: 'bg-error-100 text-error-800',
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-success-50 text-success-700',
  cancelled: 'bg-gray-100 text-gray-500',
  extended: 'bg-warning-50 text-warning-700',
  rejected: 'bg-error-50 text-error-700',
  incoming_line_result: 'bg-blue-50 text-blue-700',
}

function splitDueDate(
  isoDate: string | null | undefined,
  timezone?: string | null
): { date: string; time: string } {
  if (!isoDate) return { date: '—', time: '—' }
  const formatted = formatTaskDueDateForDisplay(isoDate, timezone)
  if (formatted === '—') return { date: '—', time: '—' }
  const [date, time] = formatted.split(' ')
  return { date: date ?? '—', time: time ?? '—' }
}

export function TaskHistoryTable({ data, userTimezone, sort, onSortChange }: Props) {
  const { t } = useTranslation('common')

  const rows: Row[] = data.map((i) => ({ ...i, id: i.id }))

  const columns: Column<Row>[] = [
    {
      key: 'createdDate',
      header: t('pages.training.columns.createdDate', 'Created date'),
      render: (r) => (
        <span className="text-sm text-gray-700">
          {r.created_at ? formatDateTime(r.created_at, userTimezone) : '—'}
        </span>
      ),
    },
    {
      key: 'clientId',
      header: t('pages.training.columns.clientId', 'Client ID'),
      render: (r) =>
        r.client_id == null ? (
          <span className="text-sm text-gray-700">—</span>
        ) : (
          <Link
            to={`/dashboard/clients/${r.client_id}`}
            className="text-primary-600 text-sm hover:underline"
          >
            #{r.client_id}
          </Link>
        ),
    },
    {
      key: 'author',
      header: t('pages.training.columns.author', 'Author'),
      render: (r) => <span className="text-sm text-gray-700">{r.created_by_name ?? '—'}</span>,
    },
    {
      key: 'assignee',
      header: t('pages.training.columns.assignee', 'Assignee'),
      render: (r) => <span className="text-sm text-gray-700">{r.assigned_to_username ?? '—'}</span>,
    },
    {
      key: 'priority',
      header: t('pages.training.columns.priority', 'Priority'),
      render: (r) => {
        const cls = PRIORITY_BADGE[r.priority as string] ?? 'bg-gray-100 text-gray-600'
        return (
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
            {t(`pages.training.filters.priorities.${r.priority}`, String(r.priority))}
          </span>
        )
      },
    },
    {
      key: 'status',
      header: t('pages.training.columns.status', 'Status'),
      render: (r) => {
        const cls = STATUS_BADGE[r.status as string] ?? 'bg-gray-100 text-gray-600'
        return (
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
            {t(`pages.training.filters.statuses.${r.status}`, String(r.status))}
          </span>
        )
      },
    },
    {
      key: 'topic',
      header: t('pages.training.columns.topic', 'Topic'),
      render: (r) => (
        <span className="text-sm text-gray-700" title={r.subject_name ?? undefined}>
          {r.subject_name ?? '—'}
        </span>
      ),
    },
    {
      key: 'dueDate',
      header: t('pages.training.columns.dueDate', 'Due date'),
      render: (r) => {
        const { date } = splitDueDate(r.due_date, userTimezone)
        return <span className="text-sm text-gray-700">{date}</span>
      },
    },
    {
      key: 'dueTime',
      header: t('pages.training.columns.dueTime', 'Due time'),
      render: (r) => {
        const { time } = splitDueDate(r.due_date, userTimezone)
        return <span className="text-sm text-gray-700">{time}</span>
      },
    },
  ]

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-end gap-2">
        <span className="text-xs text-gray-500">
          {t('pages.training.filters.sortBy', 'Sort by')}
        </span>
        <Select value={sort} onValueChange={(v) => onSortChange(v as TaskHistorySort)}>
          <SelectTrigger
            aria-label={t('pages.training.filters.sortBy', 'Sort by')}
            className="h-9 w-56"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {t(`pages.training.filters.sortOptions.${opt}`, opt)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DataTable
        columns={columns}
        data={rows}
        emptyMessage={t('pages.training.taskHistoryEmpty', 'No tasks match the current filters')}
      />
    </div>
  )
}
