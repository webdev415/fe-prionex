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

// Spread the real module so the mock cannot drift from it: naming a hook that
// does not exist, or omitting one the component imports, would otherwise sit
// here undetected until someone renders a part of the tab this test does not.
vi.mock('@/features/training/hooks/useGroupTrainings', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/training/hooks/useGroupTrainings')>()),
  useCreateGroupTraining: () => ({ mutate: createMutate, isPending: false }),
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

  // safeHttpUrl rejects a scheme-less value when rendering, so saving one would
  // store a link nobody can ever see — worse than the bug it replaced, because
  // the trainer gets a success toast either way.
  it('refuses to save a meeting URL with no scheme', () => {
    render(<ScheduleTrainingDialog onClose={vi.fn()} />)

    fill('pages.training.groupTrainings.title', 'Objection handling')
    fill('pages.training.groupTrainings.scheduledAt', '2026-09-10T09:00')
    fill('pages.training.groupTrainings.meetingUrl', 'meet.google.com/abc')

    expect(screen.getByText('pages.training.groupTrainings.meetingUrlInvalid')).toBeInTheDocument()
    fireEvent.click(screen.getByText('pages.training.groupTrainings.scheduleConfirm'))
    expect(createMutate).not.toHaveBeenCalled()
  })

  it('saves a meeting URL that carries its scheme', () => {
    render(<ScheduleTrainingDialog onClose={vi.fn()} />)

    fill('pages.training.groupTrainings.title', 'Objection handling')
    fill('pages.training.groupTrainings.scheduledAt', '2026-09-10T09:00')
    fill('pages.training.groupTrainings.meetingUrl', 'https://meet.google.com/abc')

    expect(
      screen.queryByText('pages.training.groupTrainings.meetingUrlInvalid')
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('pages.training.groupTrainings.scheduleConfirm'))
    expect(createMutate.mock.calls[0][0]).toMatchObject({
      meeting_url: 'https://meet.google.com/abc',
    })
  })
})
