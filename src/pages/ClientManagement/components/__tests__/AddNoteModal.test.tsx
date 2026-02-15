/**
 * AddNoteModal Component Tests
 *
 * Tests for the interaction creation modal with dynamic type, subtype,
 * and result dropdowns fetched from the interaction service.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AddNoteModal } from '../AddNoteModal'
import * as useNoteInteractionModule from '@/features/clients/hooks/useNoteInteraction'

// Mock scrollIntoView (not available in jsdom)
Element.prototype.scrollIntoView = vi.fn()

// Mock dependencies
vi.mock('@/features/clients/hooks/useNoteInteraction')
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
    i18n: { language: 'en' },
  }),
}))

const mockTypes = [
  {
    id: 36,
    code: 'outgoing',
    name: '2 - Исходящий',
    is_active: true,
    sort_order: 1,
    direction: 'outbound',
  },
  {
    id: 37,
    code: 'incoming',
    name: '1 - Входящий',
    is_active: true,
    sort_order: 2,
    direction: 'inbound',
  },
]

const mockSubtypes = [
  {
    id: 143,
    code: 'contact_client',
    name: 'Контакт с Клиентом',
    type_id: 36,
    is_active: true,
    sort_order: 1,
  },
  { id: 140, code: 'no_answer', name: 'Не отвечает', type_id: 36, is_active: true, sort_order: 2 },
]

const mockResults = [
  {
    id: 235,
    code: 'promise_to_pay',
    name: 'Обещание оплаты',
    is_active: true,
    sort_order: 1,
    is_positive: true,
    requires_promise_date: true,
    requires_promise_amount: true,
    requires_followup: true,
    creates_task: false,
  },
  {
    id: 234,
    code: 'refusal_to_pay',
    name: 'Отказ от оплаты',
    is_active: true,
    sort_order: 2,
    is_positive: false,
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    vi.mocked(useNoteInteractionModule.useInteractionSubtypes).mockReturnValue({
      data: mockSubtypes,
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    vi.mocked(useNoteInteractionModule.useInteractionResults).mockReturnValue({
      data: mockResults,
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
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
  })

  describe('Type Dropdown', () => {
    it('should display type dropdown with label', () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      expect(screen.getByLabelText('Type')).toBeInTheDocument()
    })

    it('should show type options from API', async () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      const typeSelect = screen.getByRole('combobox', { name: 'Type' })
      fireEvent.click(typeSelect)

      await waitFor(() => {
        expect(screen.getByText('2 - Исходящий')).toBeInTheDocument()
        expect(screen.getByText('1 - Входящий')).toBeInTheDocument()
      })
    })

    it('should show loading state while fetching types', () => {
      vi.mocked(useNoteInteractionModule.useInteractionTypes).mockReturnValue({
        data: undefined,
        isLoading: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      expect(screen.getAllByText(/loading/i).length).toBeGreaterThan(0)
    })
  })

  describe('Subtype Dropdown', () => {
    it('should display subtype dropdown with label', () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      expect(screen.getByLabelText('Subtype')).toBeInTheDocument()
    })

    it('should show subtype options from API', async () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      const subtypeSelect = screen.getByRole('combobox', { name: 'Subtype' })
      fireEvent.click(subtypeSelect)

      await waitFor(() => {
        expect(screen.getByText('Контакт с Клиентом')).toBeInTheDocument()
        expect(screen.getByText('Не отвечает')).toBeInTheDocument()
      })
    })
  })

  describe('Result Dropdown', () => {
    it('should display result dropdown with label', () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      expect(screen.getByLabelText('Result')).toBeInTheDocument()
    })

    it('should show result options from API', async () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      const resultSelect = screen.getByRole('combobox', { name: 'Result' })
      fireEvent.click(resultSelect)

      await waitFor(() => {
        expect(screen.getByText('Обещание оплаты')).toBeInTheDocument()
        expect(screen.getByText('Отказ от оплаты')).toBeInTheDocument()
      })
    })
  })

  describe('Conditional Promise Fields', () => {
    it('should not show promise fields initially', () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      expect(screen.queryByLabelText(/promise date/i)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/promise amount/i)).not.toBeInTheDocument()
    })

    it('should show promise fields when result requires them', async () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      // Select result that requires promise
      const resultSelect = screen.getByRole('combobox', { name: 'Result' })
      fireEvent.click(resultSelect)
      const promiseOption = await screen.findByRole('option', { name: 'Обещание оплаты' })
      fireEvent.click(promiseOption)

      await waitFor(() => {
        expect(screen.getByLabelText(/promise date/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/promise amount/i)).toBeInTheDocument()
      })
    })

    it('should not show promise fields when result does not require them', async () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      // Select result that does NOT require promise
      const resultSelect = screen.getByRole('combobox', { name: 'Result' })
      fireEvent.click(resultSelect)
      const refusalOption = await screen.findByRole('option', { name: 'Отказ от оплаты' })
      fireEvent.click(refusalOption)

      await waitFor(() => {
        expect(screen.queryByLabelText(/promise date/i)).not.toBeInTheDocument()
        expect(screen.queryByLabelText(/promise amount/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('Form Submission', () => {
    it('should validate type is selected', async () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      const saveButton = screen.getByRole('button', { name: /save/i })
      fireEvent.click(saveButton)

      expect(mockOnSave).not.toHaveBeenCalled()
    })

    it('should validate subtype is selected', async () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      // Select type only
      const typeSelect = screen.getByRole('combobox', { name: 'Type' })
      fireEvent.click(typeSelect)
      const typeOption = await screen.findByRole('option', { name: '2 - Исходящий' })
      fireEvent.click(typeOption)

      const saveButton = screen.getByRole('button', { name: /save/i })
      fireEvent.click(saveButton)

      expect(mockOnSave).not.toHaveBeenCalled()
    })

    it('should submit with type_id, subtype_id, and summary', async () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      // Select type
      const typeSelect = screen.getByRole('combobox', { name: 'Type' })
      fireEvent.click(typeSelect)
      const typeOption = await screen.findByRole('option', { name: '2 - Исходящий' })
      fireEvent.click(typeOption)

      // Select subtype
      const subtypeSelect = screen.getByRole('combobox', { name: 'Subtype' })
      fireEvent.click(subtypeSelect)
      const subtypeOption = await screen.findByRole('option', { name: 'Контакт с Клиентом' })
      fireEvent.click(subtypeOption)

      // Enter note content
      const noteTextarea = screen.getByRole('textbox')
      fireEvent.change(noteTextarea, { target: { value: 'Test interaction note' } })

      // Submit
      const saveButton = screen.getByRole('button', { name: /save/i })
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          type_id: 36,
          subtype_id: 143,
          result_id: undefined,
          summary: 'Test interaction note',
          promise_to_pay_date: undefined,
          promise_to_pay_amount: undefined,
        })
      })
    })

    it('should reset all fields on modal close', () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      // Enter some data
      const noteTextarea = screen.getByRole('textbox')
      fireEvent.change(noteTextarea, { target: { value: 'Test note' } })

      // Close modal
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      fireEvent.click(cancelButton)

      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  describe('Note Textarea', () => {
    it('should have character counter showing 0/2000 initially', () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      expect(screen.getByText('0/2000')).toBeInTheDocument()
    })

    it('should update character counter as user types', () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      const noteTextarea = screen.getByRole('textbox')
      fireEvent.change(noteTextarea, { target: { value: 'Test note' } })

      expect(screen.getByText('9/2000')).toBeInTheDocument()
    })

    it('should enforce max length of 2000 characters', () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      const noteTextarea = screen.getByRole('textbox')
      expect(noteTextarea).toHaveAttribute('maxLength', '2000')
    })
  })
})
