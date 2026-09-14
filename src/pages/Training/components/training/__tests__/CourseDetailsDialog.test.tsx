/**
 * Course details: attaching and detaching library materials (KAN-1049).
 *
 * This wiring is where two review rounds found self-inflicted defects — a
 * repair control that failed silently, and a guard that cleared before the
 * data it guarded was correct. Both were invisible to the component-level
 * tests because both live at the call site, so they are pinned here.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { CourseCardData } from '@/features/training/types/courses'
import type { Material } from '@/features/training/types/materials'

const attachMutate = vi.fn()
const detachMutate = vi.fn()
const toastError = vi.fn()
let attachState = { isPending: false }
let detachState = { isPending: false }
let attachedState: { data: { data: Material[] } | undefined; isFetching: boolean }

vi.mock('sonner', () => ({
  toast: { error: (...a: unknown[]) => toastError(...a), success: vi.fn() },
}))
vi.mock('@/features/training/hooks/useMaterials', () => ({
  useMaterialsForTarget: () => attachedState,
  useAttachMaterial: () => ({ ...attachState, mutate: attachMutate }),
  useDetachMaterial: () => ({ ...detachState, mutate: detachMutate }),
  useMaterials: () => ({ data: { data: [material] }, isLoading: false }),
}))
vi.mock('@/features/training/hooks/useCourses', () => ({
  useCourse: () => ({ data: undefined }),
  useUpdateCourse: () => ({ mutate: vi.fn(), isPending: false }),
  useArchiveCourse: () => ({ mutate: vi.fn(), isPending: false }),
  useCourses: () => ({ data: undefined }),
  useCreateCourse: () => ({ mutate: vi.fn(), isPending: false }),
  useEnrollCourse: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('@/features/users/hooks', () => ({ useOperators: () => ({ data: [] }) }))
vi.mock('@/hooks', () => ({ useHasPermission: () => true }))
vi.mock('@/stores/authStore', () => ({ useAuthStore: () => ({ user: { id: 1 } }) }))

import { CourseDetailsDialog } from '../CoursesCatalogTab'

const material: Material = {
  id: 1,
  project_id: 7,
  uploaded_by_user_id: 42,
  title: 'Onboarding deck',
  description: null,
  kind: 'file',
  url: null,
  mime_type: 'application/pdf',
  size_bytes: 2048,
  original_filename: 'deck.pdf',
  category_id: null,
  tags: null,
  created_at: '2026-09-10T09:00:00Z',
  updated_at: '2026-09-10T09:00:00Z',
  type: 'pdf',
}
const course = {
  id: 5,
  title: 'Soft skills',
  description: null,
  category: 'Soft Skills',
  level: 'basic',
  lessons: [],
  materials: [],
} as unknown as CourseCardData

const ADD = 'pages.training.training.courses.addMaterials'

function open(canManage = true) {
  render(<CourseDetailsDialog course={course} canManage={canManage} onClose={vi.fn()} />)
  fireEvent.click(screen.getByText(ADD))
}

beforeEach(() => {
  vi.clearAllMocks()
  attachState = { isPending: false }
  detachState = { isPending: false }
  attachedState = { data: { data: [] }, isFetching: false }
})

describe('CourseDetailsDialog materials', () => {
  it('attaches a material the trainer picks', () => {
    open()
    fireEvent.click(screen.getByRole('checkbox', { name: /Onboarding deck/ }))
    expect(attachMutate).toHaveBeenCalledTimes(1)
    expect(attachMutate.mock.calls[0][0]).toMatchObject({
      materialId: 1,
      targetId: 5,
      targetType: 'course',
    })
  })

  it('reports a failed attach instead of letting the row spring back in silence', () => {
    open()
    fireEvent.click(screen.getByRole('checkbox', { name: /Onboarding deck/ }))
    const onError = attachMutate.mock.calls[0][1]?.onError
    expect(onError, 'attach was fired with no onError handler').toBeTypeOf('function')
    onError(new Error('boom'))
    expect(toastError).toHaveBeenCalledWith('pages.training.training.materials.errors.attach')
  })

  it('reports a failed detach', () => {
    attachedState = { data: { data: [material] }, isFetching: false }
    open()
    fireEvent.click(screen.getByRole('checkbox', { name: /Onboarding deck/ }))
    const onError = detachMutate.mock.calls[0][1]?.onError
    expect(onError, 'detach was fired with no onError handler').toBeTypeOf('function')
    onError(new Error('boom'))
    expect(toastError).toHaveBeenCalledWith('pages.training.training.materials.errors.detach')
  })

  it('refuses a second click while the attach is still in flight', () => {
    attachState = { isPending: true }
    open()
    fireEvent.click(screen.getByRole('checkbox', { name: /Onboarding deck/ }))
    expect(attachMutate).not.toHaveBeenCalled()
  })

  // The regression: isPending clears when the server answers, but selectedIds
  // is only correct once the invalidated query has refetched. Re-enabling in
  // that window lets a click repeat an attach that already succeeded.
  it('stays disabled after the mutation settles, until the refetch lands', () => {
    attachState = { isPending: false }
    attachedState = { data: { data: [] }, isFetching: true }
    open()
    fireEvent.click(screen.getByRole('checkbox', { name: /Onboarding deck/ }))
    expect(attachMutate).not.toHaveBeenCalled()
  })

  it('hides the add control from someone who cannot manage courses', () => {
    render(<CourseDetailsDialog course={course} canManage={false} onClose={vi.fn()} />)
    expect(screen.queryByText(ADD)).toBeNull()
  })
})
