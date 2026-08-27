import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { EmployeeCard } from '@/features/employeeCard/types.card'

const api = vi.hoisted(() => ({
  uploadDocument: vi.fn(),
  deleteDocument: vi.fn(),
}))

vi.mock('@/features/employeeCard/api/employeeCardApi', () => api)

const { DocumentsDialog } = await import('../components/dialogs/DocumentsDialog')

function card(overrides: Partial<EmployeeCard> = {}): EmployeeCard {
  return {
    header: {
      id: 7,
      full_name: 'Olena Kovalchuk',
      status: 'active',
      work_format: null,
      avatar_url: null,
      phone: null,
      email: null,
      position: null,
      department: null,
      manager: null,
      manager_user_id: null,
      hired_at: null,
      telegram: null,
    },
    personal: {
      date_of_birth: null,
      gender: null,
      citizenship: null,
      telegram: null,
      city: null,
      address: null,
      nova_poshta_branch: null,
      referral_source: null,
      tax_id: null,
      passport: null,
    },
    work: {
      project_id: null,
      project_name: null,
      department: null,
      department_id: null,
      position: null,
      role_id: null,
      manager: null,
      hired_at: null,
    },
    contacts: [],
    children: [],
    additional: { military_status: null, visa_status: null, educations: [], languages: [] },
    documents: [],
    surveys: [],
    interview_comment: null,
    can_edit: true,
    ...overrides,
  }
}

function show(given: EmployeeCard) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <DocumentsDialog card={given} projectId={null} open onClose={vi.fn()} />
    </QueryClientProvider>
  )
}

const CV = {
  id: 11,
  kind: 'cv',
  original_filename: 'CV.pdf',
  content_type: 'application/pdf',
  size_bytes: 1024,
  uploaded_at: '2024-03-10T00:00:00Z',
}

describe('DocumentsDialog', () => {
  beforeEach(() => {
    api.uploadDocument.mockReset().mockResolvedValue({})
    api.deleteDocument.mockReset().mockResolvedValue(undefined)
  })

  it('sends a chosen file straight away rather than waiting for a save', async () => {
    show(card())

    const file = new File(['%PDF-1.7'], 'CV.pdf', { type: 'application/pdf' })
    await userEvent.upload(screen.getByLabelText('pages.employeeCard.dialogs.attachFile'), file)

    await waitFor(() => expect(api.uploadDocument).toHaveBeenCalledWith(7, file))
  })

  it('shows what the server said about a file it will not take', async () => {
    // A file named .pdf whose bytes are not one: the extension gets it past
    // the picker, and only the server can tell it is not a document.
    api.uploadDocument.mockRejectedValue({
      response: { data: { detail: 'The document must be one of: application/pdf' } },
    })
    show(card())

    await userEvent.upload(
      screen.getByLabelText('pages.employeeCard.dialogs.attachFile'),
      new File(['<?php ?>'], 'notes.pdf', { type: 'application/pdf' })
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('must be one of')
  })

  it('removes the one that was asked for', async () => {
    show(card({ documents: [CV] }))

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(api.deleteDocument).toHaveBeenCalledWith(7, 11))
  })

  it('says so when nothing is attached yet', () => {
    show(card())

    expect(screen.getByText('pages.employeeCard.documents.none')).toBeInTheDocument()
  })
})
