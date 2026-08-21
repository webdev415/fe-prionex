/**
 * The opened task panel must be editable (complaint of 04.08, item 8):
 * lawyers never found the small card's "..." menu, so the detail panel now
 * carries the same actions — assignee, type, priority, deadline, status —
 * plus an explicit «Передати в роботу» button.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { KanbanTask } from '../../../kanban/kanbanData'
import type { LegalLawyer, LegalLetterType } from '@/features/lawyerWorkplace'

// The shared setup mock treats t's second argument as options and never applies
// a defaultValue, so the control labels would come back as bare keys.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) =>
      typeof defaultValue === 'string' ? defaultValue : key,
    i18n: { language: 'uk', changeLanguage: vi.fn() },
  }),
  I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

vi.mock('@/features/lawyerWorkplace/hooks/useLegalProfileTimezone', () => ({
  useLegalProfileTimezone: () => 'Europe/Kyiv',
}))

const { KanbanTaskDetailPanel } = await import('../KanbanTaskDetailPanel')

// Radix menus rely on pointer-capture APIs jsdom does not implement.
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn(() => false)
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()
  }
  Element.prototype.scrollIntoView = vi.fn()
})

const task: KanbanTask = {
  id: 'TASK-9',
  taskId: 9,
  type: 'complaint',
  title: 'Legal: Complaint',
  clientCode: 'CL-00010',
  clientName: 'Test Client',
  clientId: 10,
  deadline: null,
  closedAt: null,
  priority: 'medium',
  assigneeInitials: 'YD',
  assigneeName: 'Demchuk',
  assigneeUserId: 7,
  columnId: 'not_defined',
  letterId: null,
  letterTypeId: 'complaint',
  legalTaskId: 9,
  letterCount: 1,
}

const lawyers: LegalLawyer[] = [
  {
    id: 'lw-1',
    user_id: 7,
    display_name: 'Yaroslav Demchuk',
    initials: 'YD',
    role_title: null,
    letter_type_ids: [],
    current_active: 1,
    max_in_flight: 5,
    status: 'online',
    is_active: true,
  },
  {
    id: 'lw-2',
    user_id: 9,
    display_name: 'Olha Petrenko',
    initials: 'OP',
    role_title: null,
    letter_type_ids: [],
    current_active: 0,
    max_in_flight: 5,
    status: 'online',
    is_active: true,
  },
]

function makeLetterType(id: string, name: string, colorId: string): LegalLetterType {
  return {
    id,
    slug: id,
    name,
    color_id: colorId,
    sla_days: 5,
    description: null,
    keyword_hints: [],
    is_active: true,
    letter_count: 0,
    examples: [],
    priorities: [],
  }
}

const letterTypes: LegalLetterType[] = [
  makeLetterType('complaint', 'Скарга', 'red'),
  makeLetterType('inquiry', 'Запит', 'green'),
]

function press(element: HTMLElement) {
  fireEvent.pointerDown(element, { pointerId: 1, pointerType: 'mouse', button: 0, bubbles: true })
  fireEvent.pointerUp(element, { pointerId: 1, pointerType: 'mouse', button: 0, bubbles: true })
  fireEvent.click(element)
}

function renderPanel(overrides: Partial<Parameters<typeof KanbanTaskDetailPanel>[0]> = {}) {
  const onMoveTask = vi.fn()
  const onTaskUpdate = vi.fn()
  render(
    <MemoryRouter>
      <KanbanTaskDetailPanel
        task={task}
        letterTypes={letterTypes}
        lawyers={lawyers}
        editableLetterTypes={letterTypes}
        onMoveTask={onMoveTask}
        onTaskUpdate={onTaskUpdate}
        {...overrides}
      />
    </MemoryRouter>
  )
  return { onMoveTask, onTaskUpdate }
}

describe('KanbanTaskDetailPanel — inline editing', () => {
  it('renders every edit control for an active task', () => {
    renderPanel()

    expect(screen.getByRole('button', { name: 'Change type' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Change priority' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Change assignee' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Set deadline' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Move to' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Передати в роботу/ })).toBeInTheDocument()
  })

  it('stays read-only when no handlers are provided', () => {
    render(
      <MemoryRouter>
        <KanbanTaskDetailPanel task={task} letterTypes={letterTypes} />
      </MemoryRouter>
    )

    expect(screen.queryByRole('button', { name: 'Change priority' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Передати в роботу/ })).not.toBeInTheDocument()
  })

  it('sends the picked priority through onTaskUpdate', async () => {
    const { onTaskUpdate } = renderPanel()

    press(screen.getByRole('button', { name: 'Change priority' }))
    press(await screen.findByText('High'))

    expect(onTaskUpdate).toHaveBeenCalledWith('TASK-9', { priority: 'high' })
  })

  it('sends the picked assignee through onTaskUpdate', async () => {
    const { onTaskUpdate } = renderPanel()

    press(screen.getByRole('button', { name: 'Change assignee' }))
    press(await screen.findByText('Olha Petrenko'))

    expect(onTaskUpdate).toHaveBeenCalledWith('TASK-9', { assigneeUserId: 9 })
  })

  it('sends the picked letter type through onTaskUpdate', async () => {
    const { onTaskUpdate } = renderPanel()

    press(screen.getByRole('button', { name: 'Change type' }))
    press(await screen.findByText('Запит'))

    expect(onTaskUpdate).toHaveBeenCalledWith('TASK-9', { letterTypeId: 'inquiry' })
  })

  it('moves the task to the chosen column through onMoveTask', async () => {
    const { onMoveTask } = renderPanel()

    press(screen.getByRole('button', { name: 'Move to' }))
    press(await screen.findByText('pages.lawyerWorkplace.kanban.columns.completed'))

    expect(onMoveTask).toHaveBeenCalledWith('TASK-9', 'completed')
  })

  it('«Передати в роботу» moves the task to in_progress', () => {
    const { onMoveTask } = renderPanel()

    press(screen.getByRole('button', { name: /Передати в роботу/ }))

    expect(onMoveTask).toHaveBeenCalledWith('TASK-9', 'in_progress')
  })

  it('hides «Передати в роботу» when the task is already in progress', () => {
    renderPanel({ task: { ...task, columnId: 'in_progress' } })

    expect(screen.queryByRole('button', { name: /Передати в роботу/ })).not.toBeInTheDocument()
    // The rest of the editors stay available.
    expect(screen.getByRole('button', { name: 'Move to' })).toBeInTheDocument()
  })
})
