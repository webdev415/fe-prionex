/**
 * One save per deadline, not one per click (KAN-1000).
 *
 * react-datepicker fires onChange when the day is clicked and again when the
 * time slot is. Saving on each produced two writes and two toasts, the first
 * announcing a time the user never chose.
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { KanbanTask } from '../../../kanban/kanbanData'
import type { LegalKanbanTaskPatch } from '@/features/lawyerWorkplace'

const pickerCalls = vi.hoisted(() => [] as Array<(date: Date | null) => void>)

// The shared setup mock treats t's second argument as options and never applies
// a defaultValue, so the menu labels would come back as bare keys.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) =>
      typeof defaultValue === 'string' ? defaultValue : key,
    i18n: { language: 'uk', changeLanguage: vi.fn() },
  }),
  I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

vi.mock('react-datepicker', () => ({
  default: ({ onChange }: { onChange: (date: Date | null) => void }) => {
    pickerCalls.push(onChange)
    return (
      <div data-testid="picker">
        <button type="button" onClick={() => onChange(new Date(2026, 7, 14, 9, 0))}>
          pick-day
        </button>
        <button type="button" onClick={() => onChange(new Date(2026, 7, 14, 6, 0))}>
          pick-time
        </button>
      </div>
    )
  },
}))

const { KanbanCard } = await import('../KanbanCard')

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
  id: 'TASK-1',
  taskId: 1,
  type: 'complaint',
  title: 'Legal: Complaint',
  clientCode: 'CL-00010',
  clientName: 'Test Client',
  clientId: 10,
  deadline: '2026-08-10T09:00:00',
  closedAt: null,
  priority: 'medium',
  assigneeInitials: 'YD',
  assigneeName: 'Demchuk',
  assigneeUserId: 7,
  columnId: 'in_progress',
  letterId: null,
  letterTypeId: 'complaint',
  legalTaskId: 1,
  letterCount: 1,
}

function renderCard(onTaskUpdate: (taskId: string, patch: LegalKanbanTaskPatch) => void) {
  return render(
    <MemoryRouter>
      <KanbanCard
        task={task}
        lawyers={[]}
        letterTypes={[]}
        editableLetterTypes={[]}
        timezone="Europe/Kyiv"
        onTaskUpdate={onTaskUpdate}
      />
    </MemoryRouter>
  )
}

function press(element: HTMLElement) {
  fireEvent.pointerDown(element, { pointerId: 1, pointerType: 'mouse', button: 0, bubbles: true })
  fireEvent.pointerUp(element, { pointerId: 1, pointerType: 'mouse', button: 0, bubbles: true })
  fireEvent.click(element)
}

async function openDeadlinePicker() {
  const kebab = screen.getByRole('button', { name: 'More options' })
  press(kebab)
  const trigger = await screen.findByText('Set deadline')
  press(trigger)
  fireEvent.keyDown(trigger, { key: 'ArrowRight' })
  await screen.findByTestId('picker')
}

describe('KanbanCard deadline picker', () => {
  beforeEach(() => {
    pickerCalls.length = 0
  })

  it('saves once for a day-then-time selection, with the time that was chosen', async () => {
    const onTaskUpdate = vi.fn()
    renderCard(onTaskUpdate)
    await openDeadlinePicker()

    fireEvent.click(screen.getByText('pick-day'))
    fireEvent.click(screen.getByText('pick-time'))
    expect(onTaskUpdate).not.toHaveBeenCalled()

    fireEvent.keyDown(screen.getByTestId('picker'), { key: 'Escape' })

    await waitFor(() => expect(onTaskUpdate).toHaveBeenCalledTimes(1))
    expect(onTaskUpdate).toHaveBeenCalledWith('TASK-1', {
      deadline: '2026-08-14T03:00:00.000Z',
    })
  })

  it('saves nothing when the picker is opened and dismissed untouched', async () => {
    const onTaskUpdate = vi.fn()
    renderCard(onTaskUpdate)
    await openDeadlinePicker()

    fireEvent.keyDown(screen.getByTestId('picker'), { key: 'Escape' })

    await waitFor(() => expect(screen.queryByTestId('picker')).not.toBeInTheDocument())
    expect(onTaskUpdate).not.toHaveBeenCalled()
  })
})
