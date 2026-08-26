import { render, screen } from '@testing-library/react'
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
})
