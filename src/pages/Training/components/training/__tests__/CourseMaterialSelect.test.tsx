/**
 * Picking course materials from the library (KAN-1049, Option A).
 *
 * This replaced typing a material's name into the course form, so the empty
 * state matters more than usual: with nothing in the library the control is a
 * dead end unless it says where materials now come from.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Material } from '@/features/training/types/materials'

const useMaterialsMock = vi.fn()
vi.mock('@/features/training/hooks/useMaterials', () => ({
  useMaterials: (...args: unknown[]) => useMaterialsMock(...args),
}))

import { CourseMaterialSelect } from '../CourseMaterialSelect'

const file: Material = {
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
const link: Material = {
  ...file,
  id: 2,
  title: 'Rebuttals slides',
  kind: 'link',
  url: 'https://slides.example.com/deck',
  mime_type: null,
  size_bytes: null,
  original_filename: null,
  type: 'link',
}

beforeEach(() => {
  useMaterialsMock.mockReset()
  useMaterialsMock.mockReturnValue({
    data: { data: [file, link], total: 2 },
    isLoading: false,
    isError: false,
  })
})

describe('CourseMaterialSelect', () => {
  it('offers links and files from the library alike', () => {
    render(<CourseMaterialSelect selectedIds={[]} onChange={vi.fn()} />)
    expect(screen.getByText('Onboarding deck')).toBeInTheDocument()
    expect(screen.getByText('Rebuttals slides')).toBeInTheDocument()
  })

  it('shows a size for a file and a host for a link', () => {
    render(<CourseMaterialSelect selectedIds={[]} onChange={vi.fn()} />)
    expect(screen.getByText('2 KB')).toBeInTheDocument()
    expect(screen.getByText('slides.example.com')).toBeInTheDocument()
  })

  it('reports the selection back rather than attaching anything itself', () => {
    const onChange = vi.fn()
    render(<CourseMaterialSelect selectedIds={[]} onChange={onChange} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /Rebuttals slides/ }))
    expect(onChange).toHaveBeenCalledWith([2])
  })

  it('deselects an already-picked material', () => {
    const onChange = vi.fn()
    render(<CourseMaterialSelect selectedIds={[1, 2]} onChange={onChange} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /Onboarding deck/ }))
    expect(onChange).toHaveBeenCalledWith([2])
  })

  it('exposes the picked state to assistive tech', () => {
    render(<CourseMaterialSelect selectedIds={[2]} onChange={vi.fn()} />)
    expect(screen.getByRole('checkbox', { name: /Rebuttals slides/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Onboarding deck/ })).not.toBeChecked()
  })

  it('says where materials come from when the library is empty', () => {
    useMaterialsMock.mockReturnValue({
      data: { data: [], total: 0 },
      isLoading: false,
      isError: false,
    })
    render(<CourseMaterialSelect selectedIds={[]} onChange={vi.fn()} />)
    expect(
      screen.getByText('pages.training.training.courses.noMaterialsInLibrary')
    ).toBeInTheDocument()
  })
})

describe('CourseMaterialSelect while a change is in flight', () => {
  it('does not accept a second click', () => {
    // selectedIds comes from the server on the course-edit path, so until the
    // refetch lands the row still shows its old state — an enabled row would
    // repeat the same attach.
    const onChange = vi.fn()
    render(<CourseMaterialSelect selectedIds={[]} onChange={onChange} disabled />)
    fireEvent.click(screen.getByRole('checkbox', { name: /Rebuttals slides/ }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
