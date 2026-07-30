import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { KanbanTask } from '../../../kanban/kanbanData'
import { KanbanCard } from '../KanbanCard'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, opts?: string | Record<string, unknown>) => {
        if (typeof opts === 'string') return opts
        if (opts && typeof opts === 'object') {
          const template = 'defaultValue' in opts ? String(opts.defaultValue) : key
          return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
            name in opts ? String(opts[name]) : `{{${name}}}`
          )
        }
        return key
      },
      i18n: { language: 'uk' },
    }),
  }
})

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

const baseTask: KanbanTask = {
  id: 'TASK-9',
  taskId: 9,
  type: 'complaint',
  title: 'Grouped complaint',
  clientCode: 'CL-00010',
  clientName: 'Test Client',
  deadline: null,
  closedAt: null,
  priority: 'medium',
  assigneeInitials: 'YD',
  assigneeName: 'Demchuk',
  assigneeUserId: 42,
  columnId: 'in_progress',
  letterId: 'msg-1',
  letterTypeId: 'complaint',
  legalTaskId: 9,
  letterCount: 1,
}

function renderCard(task: KanbanTask) {
  render(<KanbanCard task={task} lawyers={[]} letterTypes={[]} editableLetterTypes={[]} />)
}

describe('KanbanCard — grouped letters badge', () => {
  it('shows the "N листів" badge when a task groups several letters', () => {
    renderCard({ ...baseTask, letterCount: 3 })
    expect(screen.getByText('3 letters')).toBeInTheDocument()
  })

  it('does not render the badge for a single-letter task', () => {
    renderCard({ ...baseTask, letterCount: 1 })
    expect(screen.queryByText(/^\d+ letters$/)).not.toBeInTheDocument()
  })
})
