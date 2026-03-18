/**
 * AddNoteModal Component Tests
 *
 * Tests the 4-step cascading interaction modal:
 *   Step 1 — Type
 *   Step 2 — Channel (hidden until type selected; hidden for Searching)
 *   Step 3 — Contact Type (hidden until channel selected; auto-set for Mail/Chat)
 *   Step 4 — Result (hidden until upstream steps complete; filtered by rules)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AddNoteModal } from '../AddNoteModal'
import * as useNoteInteractionModule from '@/features/clients/hooks/useNoteInteraction'

// Mock scrollIntoView (not available in jsdom)
Element.prototype.scrollIntoView = vi.fn()

vi.mock('@/features/clients/hooks/useNoteInteraction')
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) => {
      if (typeof fallback === 'string') return fallback || key
      if (fallback && typeof fallback === 'object' && 'defaultValue' in fallback) {
        return (fallback.defaultValue as string) || key
      }
      return key
    },
    i18n: { language: 'en' },
  }),
}))

const mockTypes = [
  { id: 1, code: 'INCOMING', name: 'Incoming', is_active: true, sort_order: 1 },
  { id: 2, code: 'OUTGOING', name: 'Outgoing', is_active: true, sort_order: 2 },
  { id: 3, code: 'SEARCHING', name: 'Searching', is_active: true, sort_order: 3 },
]

const mockChannels = [
  { id: 1, code: 'CALL', name: 'Call', is_active: true, sort_order: 1 },
  { id: 2, code: 'MESSENGER', name: 'Messenger', is_active: true, sort_order: 2 },
  { id: 3, code: 'MAIL', name: 'Mail', is_active: true, sort_order: 3 },
  { id: 4, code: 'CHAT', name: 'Chat', is_active: true, sort_order: 4 },
]

const mockContactTypes = [
  { id: 1, code: 'CLIENT', name: 'Client', is_active: true, sort_order: 1 },
  { id: 2, code: 'THIRD_PERSON', name: '3rd Person', is_active: true, sort_order: 2 },
  { id: 3, code: 'RELATIVE', name: 'Relative', is_active: true, sort_order: 3 },
]

const mockResults = [
  {
    id: 4,
    code: 'AGREEMENT',
    name: 'Agreement',
    is_active: true,
    sort_order: 1,
    is_positive: true,
    requires_promise_date: true,
    requires_promise_amount: true,
    requires_followup: true,
    creates_task: false,
  },
  {
    id: 3,
    code: 'REFUSAL_TO_PAY',
    name: 'Refusal to pay',
    is_active: true,
    sort_order: 2,
    is_positive: false,
    requires_promise_date: false,
    requires_promise_amount: false,
    requires_followup: false,
    creates_task: false,
  },
]

const mockSearchingResults = [
  {
    id: 16,
    code: 'NO_NUMBERS',
    name: 'No numbers',
    is_active: true,
    sort_order: 1,
    is_positive: false,
    requires_promise_date: false,
    requires_promise_amount: false,
    requires_followup: false,
    creates_task: false,
  },
  {
    id: 17,
    code: 'NUMBERS_FOUND',
    name: 'Numbers found',
    is_active: true,
    sort_order: 2,
    is_positive: true,
    requires_promise_date: false,
    requires_promise_amount: false,
    requires_followup: false,
    creates_task: false,
  },
]

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('AddNoteModal', () => {
  const mockOnClose = vi.fn()
  const mockOnSave = vi.fn()

  const defaultProps = {
    open: true,
    onClose: mockOnClose,
    phoneNumber: '+380501234567',
    clientId: 123,
    onSave: mockOnSave,
  }

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(useNoteInteractionModule.useInteractionTypes).mockReturnValue({
      data: mockTypes,
      isLoading: false,
    } as never)

    vi.mocked(useNoteInteractionModule.useInteractionSubtypes).mockReturnValue({
      data: mockChannels,
      isLoading: false,
    } as never)

    vi.mocked(useNoteInteractionModule.useInteractionContactTypes).mockReturnValue({
      data: mockContactTypes,
      isLoading: false,
    } as never)

    vi.mocked(useNoteInteractionModule.useInteractionResults).mockReturnValue({
      data: mockResults,
      isLoading: false,
    } as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Modal Structure', () => {
    it('should display modal with title', () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })
      expect(screen.getByText('pages.clients.modals.addNote.title')).toBeInTheDocument()
    })

    it('should display phone number', () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })
      expect(screen.getByText('+380501234567')).toBeInTheDocument()
    })

    it('should show only Type dropdown initially', () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })
      expect(screen.getByLabelText('Type')).toBeInTheDocument()
      expect(screen.queryByLabelText('Channel')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Contact type')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Result')).not.toBeInTheDocument()
    })
  })

  describe('Step 1 — Type', () => {
    it('should display type options from API', async () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      fireEvent.click(screen.getByRole('combobox', { name: 'Type' }))

      await waitFor(() => {
        expect(screen.getByText('Incoming')).toBeInTheDocument()
        expect(screen.getByText('Outgoing')).toBeInTheDocument()
        expect(screen.getByText('Searching')).toBeInTheDocument()
      })
    })

    it('should show loading state while fetching types', () => {
      vi.mocked(useNoteInteractionModule.useInteractionTypes).mockReturnValue({
        data: undefined,
        isLoading: true,
      } as never)

      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })
      expect(screen.getAllByText(/loading/i).length).toBeGreaterThan(0)
    })
  })

  describe('Step 2 — Channel', () => {
    it('should show channel dropdown after type is selected', async () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      fireEvent.click(screen.getByRole('combobox', { name: 'Type' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Incoming' }))

      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: 'Channel' })).toBeInTheDocument()
      })
    })

    it('should NOT show channel dropdown for Searching type', async () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      fireEvent.click(screen.getByRole('combobox', { name: 'Type' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Searching' }))

      await waitFor(() => {
        expect(screen.queryByLabelText('Communication channel')).not.toBeInTheDocument()
      })
    })

    it('should display channel options', async () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      fireEvent.click(screen.getByRole('combobox', { name: 'Type' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Outgoing' }))

      fireEvent.click(screen.getByRole('combobox', { name: 'Channel' }))

      await waitFor(() => {
        expect(screen.getByText('Call')).toBeInTheDocument()
        expect(screen.getByText('Messenger')).toBeInTheDocument()
        expect(screen.getByText('Mail')).toBeInTheDocument()
        expect(screen.getByText('Chat')).toBeInTheDocument()
      })
    })

    it('should clear channel and downstream when type changes', async () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      // Select Outgoing → Call
      fireEvent.click(screen.getByRole('combobox', { name: 'Type' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Outgoing' }))
      fireEvent.click(screen.getByRole('combobox', { name: 'Channel' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Call' }))

      // Change type — channel should disappear and re-appear empty
      fireEvent.click(screen.getByRole('combobox', { name: 'Type' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Incoming' }))

      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: 'Channel' })).toBeInTheDocument()
        expect(screen.queryByRole('combobox', { name: 'Contact type' })).not.toBeInTheDocument()
      })
    })
  })

  describe('Step 3 — Contact Type', () => {
    it('should show contact type dropdown after Call channel is selected', async () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      fireEvent.click(screen.getByRole('combobox', { name: 'Type' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Outgoing' }))
      fireEvent.click(screen.getByRole('combobox', { name: 'Channel' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Call' }))

      await waitFor(() => {
        expect(screen.getByLabelText('Contact type')).toBeInTheDocument()
      })
    })

    it('should NOT show contact type dropdown for Mail channel (auto-sets Relative)', async () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      fireEvent.click(screen.getByRole('combobox', { name: 'Type' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Outgoing' }))
      fireEvent.click(screen.getByRole('combobox', { name: 'Channel' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Mail' }))

      await waitFor(() => {
        expect(screen.queryByLabelText('Contact type')).not.toBeInTheDocument()
        // Result should appear immediately after Mail (Relative is auto-set)
        expect(screen.getByLabelText('Result')).toBeInTheDocument()
      })
    })

    it('should NOT show contact type dropdown for Chat channel', async () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      fireEvent.click(screen.getByRole('combobox', { name: 'Type' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Outgoing' }))
      fireEvent.click(screen.getByRole('combobox', { name: 'Channel' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Chat' }))

      await waitFor(() => {
        expect(screen.queryByLabelText('Contact type')).not.toBeInTheDocument()
        expect(screen.getByLabelText('Result')).toBeInTheDocument()
      })
    })

    it('should display Client, 3rd Person, Relative options', async () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      fireEvent.click(screen.getByRole('combobox', { name: 'Type' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Outgoing' }))
      fireEvent.click(screen.getByRole('combobox', { name: 'Channel' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Messenger' }))
      fireEvent.click(screen.getByRole('combobox', { name: 'Contact type' }))

      await waitFor(() => {
        expect(screen.getByText('Client')).toBeInTheDocument()
        expect(screen.getByText('3rd Person')).toBeInTheDocument()
        expect(screen.getByText('Relative')).toBeInTheDocument()
      })
    })
  })

  describe('Step 4 — Result', () => {
    it('should show result dropdown after all upstream steps are complete (Call flow)', async () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      fireEvent.click(screen.getByRole('combobox', { name: 'Type' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Outgoing' }))
      fireEvent.click(screen.getByRole('combobox', { name: 'Channel' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Call' }))
      fireEvent.click(screen.getByRole('combobox', { name: 'Contact type' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Client' }))

      await waitFor(() => {
        expect(screen.getByLabelText('Result')).toBeInTheDocument()
      })
    })

    it('should show result dropdown directly after type for Searching', async () => {
      vi.mocked(useNoteInteractionModule.useInteractionResults).mockReturnValue({
        data: mockSearchingResults,
        isLoading: false,
      } as never)

      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      fireEvent.click(screen.getByRole('combobox', { name: 'Type' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Searching' }))

      await waitFor(() => {
        expect(screen.getByLabelText('Result')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('combobox', { name: 'Result' }))
      await waitFor(() => {
        expect(screen.getByText('No numbers')).toBeInTheDocument()
        expect(screen.getByText('Numbers found')).toBeInTheDocument()
      })
    })

    it('should show result options from filtered API', async () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      fireEvent.click(screen.getByRole('combobox', { name: 'Type' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Outgoing' }))
      fireEvent.click(screen.getByRole('combobox', { name: 'Channel' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Call' }))
      fireEvent.click(screen.getByRole('combobox', { name: 'Contact type' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Client' }))

      fireEvent.click(screen.getByRole('combobox', { name: 'Result' }))
      await waitFor(() => {
        expect(screen.getByText('Agreement')).toBeInTheDocument()
        expect(screen.getByText('Refusal to pay')).toBeInTheDocument()
      })
    })
  })

  describe('Conditional Promise Fields', () => {
    async function selectFullPath() {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      fireEvent.click(screen.getByRole('combobox', { name: 'Type' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Outgoing' }))
      fireEvent.click(screen.getByRole('combobox', { name: 'Channel' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Call' }))
      fireEvent.click(screen.getByRole('combobox', { name: 'Contact type' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Client' }))
    }

    it('should not show promise fields initially', () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })
      expect(screen.queryByLabelText(/promise date/i)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/promise amount/i)).not.toBeInTheDocument()
    })

    it('should show promise fields when result requires them', async () => {
      await selectFullPath()

      fireEvent.click(screen.getByRole('combobox', { name: 'Result' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Agreement' }))

      await waitFor(() => {
        expect(screen.getByLabelText(/promise date/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/promise amount/i)).toBeInTheDocument()
      })
    })

    it('should not show promise fields when result does not require them', async () => {
      await selectFullPath()

      fireEvent.click(screen.getByRole('combobox', { name: 'Result' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Refusal to pay' }))

      await waitFor(() => {
        expect(screen.queryByLabelText(/promise date/i)).not.toBeInTheDocument()
        expect(screen.queryByLabelText(/promise amount/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('Form Validation', () => {
    it('should not submit when type is not selected', async () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      fireEvent.click(screen.getByRole('button', { name: /save/i }))
      expect(mockOnSave).not.toHaveBeenCalled()
    })

    it('should not submit when channel is not selected (non-Searching type)', async () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      fireEvent.click(screen.getByRole('combobox', { name: 'Type' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Outgoing' }))

      fireEvent.click(screen.getByRole('button', { name: /save/i }))
      expect(mockOnSave).not.toHaveBeenCalled()
    })

    it('should not submit when contact type is not selected (Call/Messenger channel)', async () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      fireEvent.click(screen.getByRole('combobox', { name: 'Type' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Outgoing' }))
      fireEvent.click(screen.getByRole('combobox', { name: 'Channel' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Call' }))

      fireEvent.click(screen.getByRole('button', { name: /save/i }))
      expect(mockOnSave).not.toHaveBeenCalled()
    })
  })

  describe('Form Submission', () => {
    it('should submit with type_id, subtype_id, contact_type_id (Call flow)', async () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      fireEvent.click(screen.getByRole('combobox', { name: 'Type' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Outgoing' }))
      fireEvent.click(screen.getByRole('combobox', { name: 'Channel' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Call' }))
      fireEvent.click(screen.getByRole('combobox', { name: 'Contact type' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Client' }))

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Test note' } })
      fireEvent.click(screen.getByRole('button', { name: /save/i }))

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          type_id: 2,
          subtype_id: 1,
          contact_type_id: 1,
          result_id: undefined,
          summary: 'Test note',
          promise_to_pay_date: undefined,
          promise_to_pay_amount: undefined,
        })
      })
    })

    it('should submit with auto-set Relative contact_type_id for Mail channel', async () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      fireEvent.click(screen.getByRole('combobox', { name: 'Type' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Outgoing' }))
      fireEvent.click(screen.getByRole('combobox', { name: 'Channel' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Mail' }))

      fireEvent.click(screen.getByRole('button', { name: /save/i }))

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            type_id: 2,
            subtype_id: 3,
            contact_type_id: 3, // Relative id
          })
        )
      })
    })

    it('should submit without subtype_id and contact_type_id for Searching type', async () => {
      vi.mocked(useNoteInteractionModule.useInteractionResults).mockReturnValue({
        data: mockSearchingResults,
        isLoading: false,
      } as never)

      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      fireEvent.click(screen.getByRole('combobox', { name: 'Type' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Searching' }))

      fireEvent.click(screen.getByRole('button', { name: /save/i }))

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            type_id: 3,
            subtype_id: undefined,
            contact_type_id: undefined,
          })
        )
      })
    })

    it('should reset all fields on modal close', () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Test note' } })
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  describe('Note Textarea', () => {
    it('should show character counter 0/2000 initially', () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })
      expect(screen.getByText('0/2000')).toBeInTheDocument()
    })

    it('should update character counter as user types', () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Test note' } })
      expect(screen.getByText('9/2000')).toBeInTheDocument()
    })

    it('should enforce max length of 2000 characters', () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })
      expect(screen.getByRole('textbox')).toHaveAttribute('maxLength', '2000')
    })
  })
})
