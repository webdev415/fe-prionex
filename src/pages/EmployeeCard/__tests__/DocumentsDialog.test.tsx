import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { EmployeeCard } from '@/features/employeeCard/types.card'

const api = vi.hoisted(() => ({
  uploadDocument: vi.fn(),
  deleteDocument: vi.fn(),
  updateInterviewComment: vi.fn(),
}))

vi.mock('@/features/employeeCard/api/employeeCardApi', () => api)

const { DocumentsDialog } = await import('../components/dialogs/DocumentsDialog')

function card(overrides: Partial<EmployeeCard> = {}): EmployeeCard {
  return {
    header: {
      id: 7,
      full_name: 'Kovalchuk Olena',
      last_name: 'Kovalchuk',
      first_name: 'Olena',
      middle_name: null,
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
      telegram: null,
      city: null,
      address: null,
      nova_poshta_branch: null,
      referral_source: null,
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
    api.updateInterviewComment.mockReset().mockImplementation((_id, comment) => ({
      ...card(),
      interview_comment: comment,
    }))
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

/*
 * The section displays this comment, so somewhere has to write it. Before
 * this it was displayed and nothing anywhere could change it - the endpoint
 * and the hook both existed and neither was ever called.
 */
describe('DocumentsDialog: the interview comment', () => {
  beforeEach(() => {
    api.uploadDocument.mockReset().mockResolvedValue({})
    api.deleteDocument.mockReset().mockResolvedValue(undefined)
    api.updateInterviewComment.mockReset().mockImplementation((_id, comment) => ({
      ...card(),
      interview_comment: comment,
    }))
  })

  const box = () => screen.getByLabelText('pages.employeeCard.documents.interviewComment')
  const saveButton = () => screen.queryByRole('button', { name: 'actions.save' })

  it('opens with the comment already on the card', () => {
    show(card({ interview_comment: 'Confident, communicative.' }))

    expect(box()).toHaveValue('Confident, communicative.')
  })

  it('sends the comment somebody typed', async () => {
    show(card())

    await userEvent.type(box(), 'Recommend for the operator role')
    await userEvent.click(saveButton() as HTMLElement)

    await waitFor(() =>
      expect(api.updateInterviewComment).toHaveBeenCalledWith(7, 'Recommend for the operator role')
    )
  })

  it('does not send the whitespace around what was typed', async () => {
    show(card())

    await userEvent.type(box(), '   Recommended.   ')
    await userEvent.click(saveButton() as HTMLElement)

    await waitFor(() => expect(api.updateInterviewComment).toHaveBeenCalledWith(7, 'Recommended.'))
  })

  it('sends an emptied comment as null, so it can be taken back', async () => {
    show(card({ interview_comment: 'Written in error' }))

    await userEvent.clear(box())
    await userEvent.click(saveButton() as HTMLElement)

    await waitFor(() => expect(api.updateInterviewComment).toHaveBeenCalledWith(7, null))
  })

  /*
   * Files here save themselves the moment they are chosen. The comment cannot
   * work that way - somebody is part way through a sentence - so it keeps its
   * own button, and the button only appears once there is something to save.
   */
  it('keeps its save button away until the comment has changed', async () => {
    show(card({ interview_comment: 'Confident, communicative.' }))

    expect(saveButton()).toBeNull()

    await userEvent.type(box(), ' Recommended.')

    expect(saveButton()).toBeInTheDocument()
  })

  it('says what the server said when it refuses the comment', async () => {
    api.updateInterviewComment.mockRejectedValue({
      response: { data: { detail: 'Comment is too long' } },
    })
    show(card())

    await userEvent.type(box(), 'x')
    await userEvent.click(saveButton() as HTMLElement)

    expect(await screen.findByRole('alert')).toHaveTextContent('Comment is too long')
  })

  it('leaves the files alone when only the comment is saved', async () => {
    show(card({ documents: [CV] }))

    await userEvent.type(box(), 'Fine')
    await userEvent.click(saveButton() as HTMLElement)

    await waitFor(() => expect(api.updateInterviewComment).toHaveBeenCalled())
    expect(api.uploadDocument).not.toHaveBeenCalled()
    expect(api.deleteDocument).not.toHaveBeenCalled()
  })
})
