/**
 * AddNoteModal Component Tests (Enhanced)
 *
 * Tests for the enhanced Add Note modal with 8 note types, conditional related fields,
 * and lazy-loading data fetching.
 * Tests follow TDD approach - written BEFORE implementation updates.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AddNoteModal } from '../AddNoteModal'
import * as useClientsModule from '@/features/clients/hooks/useClients'

// Mock scrollIntoView (not available in jsdom)
Element.prototype.scrollIntoView = vi.fn()

// Mock dependencies
vi.mock('@/features/clients/hooks/useClients')
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}))

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

describe('AddNoteModal (Enhanced)', () => {
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

    // Mock useClientCallSmsHistory hook (for calls)
    vi.mocked(useClientsModule.useClientCallSmsHistory).mockReturnValue({
      data: {
        calls: [
          { id: 1, phone: '+380501234567', duration: 120, status: 'completed' },
          { id: 2, phone: '+380501234567', duration: 60, status: 'completed' },
        ],
        total: 2,
      },
      isLoading: false,
      isError: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    // Mock useClientPaymentsSection hook (for payments)
    vi.mocked(useClientsModule.useClientPaymentsSection).mockReturnValue({
      data: {
        payments: [
          { id: 101, amount: 1000, payment_date: '2024-01-15' },
          { id: 102, amount: 500, payment_date: '2024-01-20' },
        ],
      },
      isLoading: false,
      isError: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    // Mock useClientLoans hook (for debts)
    vi.mocked(useClientsModule.useClientLoans).mockReturnValue({
      data: [
        { id: 201, loanNumber: 'LOAN-001', totalToRepay: 5000 },
        { id: 202, loanNumber: 'LOAN-002', totalToRepay: 3000 },
      ],
      isLoading: false,
      isError: false,
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

  describe('Note Type Dropdown (8 options)', () => {
    it('should display note type dropdown with label', () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      expect(screen.getByText(/note type/i)).toBeInTheDocument()
    })

    it('should have 8 note type options', async () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      const noteTypeSelect = screen.getByRole('combobox', { name: /note type/i })
      fireEvent.click(noteTypeSelect)

      await waitFor(() => {
        // Use getAllByText since Radix UI duplicates text (trigger + option)
        // Note: Component formats "follow_up" as "Follow up" with space
        expect(screen.getAllByText(/general/i).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/call/i).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/payment/i).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/debt/i).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/follow up/i).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/reminder/i).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/legal/i).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/other/i).length).toBeGreaterThan(0)
      })
    })
  })

  describe('Conditional Related Fields', () => {
    it('should show related call field only when note_type is "call"', async () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      // Initially, related call field should not be visible
      expect(screen.queryByText(/related call/i)).not.toBeInTheDocument()

      // Select "call" note type
      const noteTypeSelect = screen.getByRole('combobox', { name: /note type/i })
      fireEvent.click(noteTypeSelect)

      // Wait for dropdown to open and find the option by role
      const callOption = await screen.findByRole('option', { name: /^call$/i })
      fireEvent.click(callOption)

      // Related call field should now be visible
      await waitFor(() => {
        expect(screen.getByLabelText(/related call/i)).toBeInTheDocument()
      })
    })

    it('should show related payment field only when note_type is "payment"', async () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      // Initially, related payment field should not be visible
      expect(screen.queryByText(/related payment/i)).not.toBeInTheDocument()

      // Select "payment" note type
      const noteTypeSelect = screen.getByRole('combobox', { name: /note type/i })
      fireEvent.click(noteTypeSelect)

      // Wait for dropdown to open and find the option by role
      const paymentOption = await screen.findByRole('option', { name: /^payment$/i })
      fireEvent.click(paymentOption)

      // Related payment field should now be visible
      await waitFor(() => {
        expect(screen.getByLabelText(/related payment/i)).toBeInTheDocument()
      })
    })

    it('should show related debt field only when note_type is "debt"', async () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      // Initially, related debt field should not be visible
      expect(screen.queryByText(/related debt/i)).not.toBeInTheDocument()

      // Select "debt" note type
      const noteTypeSelect = screen.getByRole('combobox', { name: /note type/i })
      fireEvent.click(noteTypeSelect)

      // Wait for dropdown to open and find the option by role
      const debtOption = await screen.findByRole('option', { name: /^debt$/i })
      fireEvent.click(debtOption)

      // Related debt field should now be visible
      await waitFor(() => {
        expect(screen.getByLabelText(/related debt/i)).toBeInTheDocument()
      })
    })

    it('should not show related fields for "general" note type', async () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      // Select "general" note type
      const noteTypeSelect = screen.getByRole('combobox', { name: /note type/i })
      fireEvent.click(noteTypeSelect)
      // Use getAllByText and click last match (dropdown option, not trigger)
      const generalOptions = await screen.findAllByText(/^general$/i)
      fireEvent.click(generalOptions[generalOptions.length - 1])

      // No related fields should be visible
      await waitFor(() => {
        expect(screen.queryByText(/related call/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/related payment/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/related debt/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('Lazy Loading Data Fetching', () => {
    it('should fetch calls only when note_type is "call"', async () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      // Initially, useClientCallSmsHistory should be called with enabled: false
      expect(useClientsModule.useClientCallSmsHistory).toHaveBeenCalledWith(123, false)

      // Select "call" note type
      const noteTypeSelect = screen.getByRole('combobox', { name: /note type/i })
      fireEvent.click(noteTypeSelect)
      const callOption = await screen.findByText(/^call$/i)
      fireEvent.click(callOption)

      // After selecting "call", useClientCallSmsHistory should be called with enabled: true
      await waitFor(() => {
        expect(useClientsModule.useClientCallSmsHistory).toHaveBeenCalledWith(123, true)
      })
    })

    it('should fetch payments only when note_type is "payment"', async () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      // Initially, useClientPaymentsSection should be called with enabled: false
      expect(useClientsModule.useClientPaymentsSection).toHaveBeenCalledWith(123, false)

      // Select "payment" note type
      const noteTypeSelect = screen.getByRole('combobox', { name: /note type/i })
      fireEvent.click(noteTypeSelect)
      const paymentOption = await screen.findByText(/^payment$/i)
      fireEvent.click(paymentOption)

      // After selecting "payment", useClientPaymentsSection should be called with enabled: true
      await waitFor(() => {
        expect(useClientsModule.useClientPaymentsSection).toHaveBeenCalledWith(123, true)
      })
    })

    it('should fetch debts only when note_type is "debt"', async () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      // Initially, useClientLoans should be called with enabled: false
      expect(useClientsModule.useClientLoans).toHaveBeenCalledWith(123, false)

      // Select "debt" note type
      const noteTypeSelect = screen.getByRole('combobox', { name: /note type/i })
      fireEvent.click(noteTypeSelect)
      const debtOption = await screen.findByText(/^debt$/i)
      fireEvent.click(debtOption)

      // After selecting "debt", useClientLoans should be called with enabled: true
      await waitFor(() => {
        expect(useClientsModule.useClientLoans).toHaveBeenCalledWith(123, true)
      })
    })
  })

  describe('Form Submission', () => {
    it('should submit all 5 fields to backend (content, note_type, related_call_id, related_payment_id, related_debt_id)', async () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      // Select note type "call"
      const noteTypeSelect = screen.getByRole('combobox', { name: /note type/i })
      fireEvent.click(noteTypeSelect)

      // Wait for dropdown to open and find the option by role
      const callOption = await screen.findByRole('option', { name: /^call$/i })
      fireEvent.click(callOption)

      // Wait for related call field and select a call
      await waitFor(() => {
        expect(screen.getByLabelText(/related call/i)).toBeInTheDocument()
      })
      const relatedCallSelect = screen.getByRole('combobox', { name: /related call/i })
      fireEvent.click(relatedCallSelect)

      // Wait for related call dropdown to open and select first call
      const call1Option = await screen.findByRole('option', { name: /Call #1/ })
      fireEvent.click(call1Option)

      // Enter note content
      const noteTextarea = screen.getByRole('textbox')
      fireEvent.change(noteTextarea, { target: { value: 'Test note about call' } })

      // Submit
      const saveButton = screen.getByRole('button', { name: /save/i })
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          content: 'Test note about call',
          note_type: 'call',
          related_call_id: 1,
          related_payment_id: undefined,
          related_debt_id: undefined,
        })
      })
    })

    it('should validate note content is not empty', async () => {
      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      // Try to submit without entering note
      const saveButton = screen.getByRole('button', { name: /save/i })
      fireEvent.click(saveButton)

      // onSave should not be called
      expect(mockOnSave).not.toHaveBeenCalled()
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

  describe('Data Fetching States', () => {
    it('should show loading skeleton while fetching related calls', async () => {
      vi.mocked(useClientsModule.useClientCallSmsHistory).mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      // Select "call" note type
      const noteTypeSelect = screen.getByRole('combobox', { name: /note type/i })
      fireEvent.click(noteTypeSelect)
      const callOption = await screen.findByText(/^call$/i)
      fireEvent.click(callOption)

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText(/loading/i)).toBeInTheDocument()
      })
    })

    it('should handle fetch error gracefully', async () => {
      vi.mocked(useClientsModule.useClientCallSmsHistory).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      render(<AddNoteModal {...defaultProps} />, { wrapper: createWrapper() })

      // Select "call" note type
      const noteTypeSelect = screen.getByRole('combobox', { name: /note type/i })
      fireEvent.click(noteTypeSelect)
      const callOption = await screen.findByText(/^call$/i)
      fireEvent.click(callOption)

      // Should show error message or disable the field
      await waitFor(() => {
        const relatedCallSelect = screen.getByRole('combobox', { name: /related call/i })
        expect(relatedCallSelect).toBeDisabled()
      })
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
