/**
 * What a participant sees on a group training (KAN-1048).
 *
 * The ticket's second criterion is "the same content is visible to the trainer
 * and to participants — no field that only the author can see", so the
 * canManage={false} case is asserted directly rather than assumed: it is the
 * executable form of that criterion.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GroupTrainingCard } from '../GroupTrainingsTab'
import type { GroupTrainingCardData } from '@/features/training/types/groupTrainings'

const BASE: GroupTrainingCardData = {
  id: 1,
  project_id: 7,
  title: 'Objection handling',
  type: 'webinar',
  location: 'Zoom',
  description: 'Two hours on rebuttals.',
  trainer_id: 42,
  scheduled_at: '2026-09-10T09:00:00Z',
  duration_minutes: 120,
  max_participants: 20,
  meeting_url: 'https://meet.example.com/abc',
  status: 'scheduled',
  created_at: '2026-09-04T09:00:00Z',
  registered_count: 3,
  is_registered: false,
}

function renderCard(over: Partial<GroupTrainingCardData> = {}, canManage = false) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <GroupTrainingCard
        training={{ ...BASE, ...over }}
        canManage={canManage}
        trainerName="Olena"
        onParticipants={vi.fn()}
        onAssign={vi.fn()}
      />
    </QueryClientProvider>
  )
}

describe('GroupTrainingCard — what the participant can see', () => {
  it('shows the description', () => {
    renderCard()
    expect(screen.getByText('Two hours on rebuttals.')).toBeInTheDocument()
  })

  it('shows the meeting link, pointing at the meeting', () => {
    renderCard()
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://meet.example.com/abc')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('shows a participant exactly what it shows the trainer', () => {
    const asParticipant = renderCard({}, false)
    const participantSees = [
      screen.getByText('Two hours on rebuttals.').textContent,
      screen.getByRole('link').getAttribute('href'),
    ]
    asParticipant.unmount()

    renderCard({}, true)
    expect([
      screen.getByText('Two hours on rebuttals.').textContent,
      screen.getByRole('link').getAttribute('href'),
    ]).toEqual(participantSees)
  })

  it('omits the description and the link when the trainer left them empty', () => {
    renderCard({ description: null, meeting_url: null })
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByText('Two hours on rebuttals.')).not.toBeInTheDocument()
  })

  it('does not render a javascript: meeting URL as a link', () => {
    renderCard({ meeting_url: 'javascript:alert(1)' })
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('does not render a scheme-less meeting URL, which would point at our own site', () => {
    renderCard({ meeting_url: 'meet.example.com/abc' })
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
