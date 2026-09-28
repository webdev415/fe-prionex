import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DialerQueue } from '@/features/dialer'

// The settings under test are all upstream-validated: a queue that trips the
// gateway's ranges cannot sync a campaign, and telephony_type cannot be changed
// after creation. These tests pin that the form can express them and that edit
// mode does not offer to change the immutable one.

const createMutate = vi.fn().mockResolvedValue({})
const updateMutate = vi.fn().mockResolvedValue({})

vi.mock('@/features/dialer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/dialer')>()
  return {
    ...actual,
    useCreateDialerQueue: () => ({ mutateAsync: createMutate }),
    useUpdateDialerQueue: () => ({ mutateAsync: updateMutate }),
  }
})

vi.mock('@/features/departments', () => ({
  useDepartments: () => ({ data: { departments: [{ id: 17, name: 'test-dept' }] } }),
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ user: { active_project_id: '1' } }),
}))

const { QueueFormModal } = await import('../QueueFormModal')

function makeQueue(overrides: Partial<DialerQueue> = {}): DialerQueue {
  return {
    id: 3,
    name: 'Test_queue2',
    department_ids: [17],
    department_names: ['test-dept'],
    access_groups: [],
    priority: 3,
    telephony_type: 'grey',
    sim_card_limit: 4,
    aggressiveness: 2,
    wait_time_seconds: 5,
    max_client_wait_seconds: 30,
    answer_mode: 'auto',
    max_attempts: 3,
    retry_delay_failed_seconds: 60,
    retry_delay_no_answer_seconds: 0,
    retry_delay_busy_seconds: 0,
    status: 'active',
    is_active: true,
    ...overrides,
  } as DialerQueue
}

// The global i18n mock in src/test/setup.ts returns the KEY, not the fallback,
// so every label renders as its translation key.
describe('QueueFormModal — dialing settings', () => {
  beforeEach(() => {
    createMutate.mockClear()
    updateMutate.mockClear()
  })

  it('offers telephony type on create, because it cannot be set afterwards', () => {
    render(<QueueFormModal open onClose={() => {}} />)
    expect(screen.getByLabelText('dialer.queueForm.telephonyType')).toBeTruthy()
  })

  it('does not offer to change telephony type when editing', () => {
    render(<QueueFormModal open queue={makeQueue()} onClose={() => {}} />)
    expect(screen.queryByLabelText('dialer.queueForm.telephonyType')).toBeNull()
    // The value is still shown, marked as fixed.
    expect(screen.getByText('dialer.queueForm.immutable')).toBeTruthy()
  })

  it('exposes the upstream-validated settings that used to be uneditable', () => {
    render(<QueueFormModal open queue={makeQueue()} onClose={() => {}} />)
    expect(screen.getByLabelText('dialer.queueForm.priority')).toHaveValue(3)
    expect(screen.getByLabelText('dialer.queueForm.simCardLimit')).toHaveValue(4)
  })

  it('defaults a new queue to a retrying policy, not dial-once', () => {
    render(<QueueFormModal open onClose={() => {}} />)
    // The gateway reads max_attempts=0 as dial-once, which permanently exhausts
    // a number on the first transient line failure. The default must retry.
    expect(screen.getByLabelText('dialer.queueForm.maxAttempts')).toHaveValue(3)
    expect(screen.getByLabelText('dialer.queueForm.retryDelayFailed')).toHaveValue(60)
  })

  it('sends only what changed, and never the immutable telephony_type', async () => {
    render(<QueueFormModal open queue={makeQueue()} onClose={() => {}} />)

    // Touch one field. Everything else must stay out of the payload: `queue` is
    // a paged list row, so an untouched setting the DTO omitted would otherwise
    // be written back from a client-side default.
    fireEvent.change(screen.getByLabelText('dialer.queueForm.maxAttempts'), {
      target: { value: '5' },
    })
    fireEvent.click(screen.getByText('dialer.queueForm.save'))

    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1))
    const { payload } = updateMutate.mock.calls[0][0]
    expect(payload).toEqual({ max_attempts: 5 })
    expect(payload).not.toHaveProperty('telephony_type')
    expect(payload).not.toHaveProperty('priority')
  })

  it('sends the full configuration on create, telephony_type included', async () => {
    render(<QueueFormModal open onClose={() => {}} />)

    // The pre-existing fields have unassociated labels, so query the placeholder.
    fireEvent.change(screen.getByPlaceholderText('dialer.queueForm.namePlaceholder'), {
      target: { value: 'Smoke queue' },
    })
    fireEvent.click(screen.getByText('dialer.queueForm.create'))

    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1))
    const payload = createMutate.mock.calls[0][0]
    expect(payload).toMatchObject({
      name: 'Smoke queue',
      telephony_type: 'white',
      priority: 3,
      sim_card_limit: 4,
      // Never the dial-once value the gateway would otherwise apply.
      max_attempts: 3,
      retry_delay_failed_seconds: 60,
    })
  })

  it('blocks submit and explains why when a numeric field is cleared', async () => {
    render(<QueueFormModal open queue={makeQueue()} onClose={() => {}} />)

    // valueAsNumber turns an empty input into NaN; without a visible message the
    // user just sees a dead Save button.
    fireEvent.change(screen.getByLabelText('dialer.queueForm.priority'), {
      target: { value: '' },
    })
    fireEvent.click(screen.getByText('dialer.queueForm.save'))

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(updateMutate).not.toHaveBeenCalled()
  })
})
