/**
 * The create dialog must SEND what it collects (KAN-1048).
 *
 * The description shipped broken once already — stored on create and dropped
 * from every response — and no test covered the round trip. This covers the
 * half that lives here: whatever the trainer types reaches the request body.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const createMutate = vi.fn()

vi.mock('@/features/training/hooks/useGroupTrainings', () => ({
  useCreateGroupTraining: () => ({ mutate: createMutate, isPending: false }),
  useGroupTrainings: () => ({ data: undefined, isLoading: false }),
  useCancelGroupTraining: () => ({ mutate: vi.fn(), isPending: false }),
  useGroupTrainingParticipants: () => ({ data: undefined, isLoading: false }),
  useAssignParticipants: () => ({ mutate: vi.fn(), isPending: false }),
  useRegisterForTraining: () => ({ mutate: vi.fn(), isPending: false }),
  useUnregisterFromTraining: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateGroupTraining: () => ({ mutate: vi.fn(), isPending: false }),
}))

import { ScheduleTrainingDialog } from '../GroupTrainingsTab'

beforeEach(() => createMutate.mockClear())

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label, { selector: 'input, textarea' }), {
    target: { value },
  })
}

describe('ScheduleTrainingDialog', () => {
  it('sends the description the trainer typed', () => {
    render(<ScheduleTrainingDialog onClose={vi.fn()} />)

    fill('pages.training.groupTrainings.title', 'Objection handling')
    fill('pages.training.groupTrainings.scheduledAt', '2026-09-10T09:00')
    fill('pages.training.groupTrainings.description', 'Two hours on rebuttals.')

    fireEvent.click(screen.getByText('pages.training.groupTrainings.scheduleConfirm'))

    expect(createMutate).toHaveBeenCalledTimes(1)
    expect(createMutate.mock.calls[0][0]).toMatchObject({
      title: 'Objection handling',
      description: 'Two hours on rebuttals.',
    })
  })

  it('sends null rather than an empty string when the description is left blank', () => {
    render(<ScheduleTrainingDialog onClose={vi.fn()} />)

    fill('pages.training.groupTrainings.title', 'Objection handling')
    fill('pages.training.groupTrainings.scheduledAt', '2026-09-10T09:00')

    fireEvent.click(screen.getByText('pages.training.groupTrainings.scheduleConfirm'))

    expect(createMutate.mock.calls[0][0]).toMatchObject({ description: null })
  })
})
