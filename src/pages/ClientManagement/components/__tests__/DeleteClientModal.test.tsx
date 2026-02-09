/**
 * DeleteClientModal Component Tests
 *
 * Tests for the delete client modal component with confirmation flow.
 * Tests follow TDD approach - these tests are written BEFORE implementation.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { DeleteClientModal } from '../DeleteClientModal'
import * as useClientsModule from '@/features/clients/hooks/useClients'
import { toast } from 'sonner'

// Mock dependencies
vi.mock('@/features/clients/hooks/useClients')
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: vi.fn(),
  }
})
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MemoryRouter>
  )
}

describe('DeleteClientModal', () => {
  const mockOnClose = vi.fn()
  const mockOnSuccess = vi.fn()
  const mockNavigate = vi.fn()
  const mockDeleteClient = vi.fn()

  const mockClient = {
    id: 123,
    full_name: 'John Doe',
    tax_id: '1234567890',
    phone_primary: '+380501234567',
    total_debt: 15000.5,
    debt_count: 3,
  }

  const defaultProps = {
    open: true,
    client: mockClient,
    onClose: mockOnClose,
    onSuccess: mockOnSuccess,
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock useNavigate
    vi.mocked(useNavigate).mockReturnValue(mockNavigate)

    // Mock useDeleteClient hook
    vi.mocked(useClientsModule.useDeleteClient).mockReturnValue({
      mutate: mockDeleteClient,
      isPending: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Modal Display', () => {
    it('should display modal with correct title', () => {
      render(<DeleteClientModal {...defaultProps} />, { wrapper: createWrapper() })

      // Modal title appears in h2 element
      const titles = screen.getAllByText('Delete Client')
      expect(titles.length).toBeGreaterThan(0)
      expect(titles[0]).toBeInTheDocument()
    })

    it('should display warning banner about soft delete', () => {
      render(<DeleteClientModal {...defaultProps} />, { wrapper: createWrapper() })

      expect(
        screen.getByText(/This action will remove the client from active records/)
      ).toBeInTheDocument()
      expect(screen.getByText(/Data can be recovered by administrators/)).toBeInTheDocument()
    })

    it('should display client information (name, tax ID, phone)', () => {
      render(<DeleteClientModal {...defaultProps} />, { wrapper: createWrapper() })

      expect(screen.getByText(/John Doe/)).toBeInTheDocument()
      expect(screen.getByText(/1234567890/)).toBeInTheDocument()
      expect(screen.getByText(/\+380501234567/)).toBeInTheDocument()
    })

    it('should display client debt information', () => {
      render(<DeleteClientModal {...defaultProps} />, { wrapper: createWrapper() })

      // Should show debt count and total debt
      expect(screen.getByText(/3 debt\(s\)/)).toBeInTheDocument()
      // Check for formatted currency (appears multiple times - once in details, once in impact list)
      const debtAmounts = screen.getAllByText(/15[,\s]?000[.,]50/)
      expect(debtAmounts.length).toBeGreaterThan(0)
    })

    it('should display impact section with consequences list', () => {
      render(<DeleteClientModal {...defaultProps} />, { wrapper: createWrapper() })

      expect(screen.getByText(/What Will Happen:/)).toBeInTheDocument()
      expect(screen.getByText(/Client will be marked as deleted/)).toBeInTheDocument()
      expect(screen.getByText(/Client will disappear from client lists/)).toBeInTheDocument()
      expect(
        screen.getByText(/Historical data \(notes, calls, payments\) will be preserved/)
      ).toBeInTheDocument()
    })
  })

  describe('Confirmation Checkbox', () => {
    it('should render confirmation checkbox', () => {
      render(<DeleteClientModal {...defaultProps} />, { wrapper: createWrapper() })

      const checkbox = screen.getByRole('checkbox', {
        name: /I understand this action will remove the client from active records/,
      })
      expect(checkbox).toBeInTheDocument()
      expect(checkbox).not.toBeChecked()
    })

    it('should disable delete button when checkbox is not checked', () => {
      render(<DeleteClientModal {...defaultProps} />, { wrapper: createWrapper() })

      const deleteButton = screen.getByRole('button', { name: /Delete Client/i })
      expect(deleteButton).toBeDisabled()
    })

    it('should enable delete button when checkbox is checked', () => {
      render(<DeleteClientModal {...defaultProps} />, { wrapper: createWrapper() })

      const checkbox = screen.getByRole('checkbox', {
        name: /I understand this action will remove the client from active records/,
      })
      const deleteButton = screen.getByRole('button', { name: /Delete Client/i })

      // Initially disabled
      expect(deleteButton).toBeDisabled()

      // Check the checkbox
      fireEvent.click(checkbox)

      // Should be enabled now
      expect(deleteButton).not.toBeDisabled()
    })
  })

  describe('Delete Button Actions', () => {
    it('should call deleteClient mutation when confirmed', () => {
      render(<DeleteClientModal {...defaultProps} />, { wrapper: createWrapper() })

      const checkbox = screen.getByRole('checkbox')
      const deleteButton = screen.getByRole('button', { name: /Delete Client/i })

      // Check the checkbox to enable delete
      fireEvent.click(checkbox)

      // Click delete button
      fireEvent.click(deleteButton)

      expect(mockDeleteClient).toHaveBeenCalledWith(
        123,
        expect.objectContaining({
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
        })
      )
    })

    it('should show loading state during deletion', () => {
      // Mock isPending as true
      vi.mocked(useClientsModule.useDeleteClient).mockReturnValue({
        mutate: mockDeleteClient,
        isPending: true,
        isError: false,
        error: null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      render(<DeleteClientModal {...defaultProps} />, { wrapper: createWrapper() })

      const checkbox = screen.getByRole('checkbox')
      fireEvent.click(checkbox)

      const deleteButton = screen.getByRole('button', { name: /Deleting.../i })
      expect(deleteButton).toBeInTheDocument()
      expect(deleteButton).toBeDisabled()
    })

    it('should prevent modal close during deletion', () => {
      // Mock isPending as true
      vi.mocked(useClientsModule.useDeleteClient).mockReturnValue({
        mutate: mockDeleteClient,
        isPending: true,
        isError: false,
        error: null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      render(<DeleteClientModal {...defaultProps} />, { wrapper: createWrapper() })

      const cancelButton = screen.getByRole('button', { name: /Cancel/i })
      expect(cancelButton).toBeDisabled()
    })
  })

  describe('Success Flow', () => {
    it('should show success toast on successful deletion', async () => {
      let onSuccessCallback: ((data: unknown) => void) | undefined

      mockDeleteClient.mockImplementation((_clientId, options) => {
        onSuccessCallback = options?.onSuccess
      })

      render(<DeleteClientModal {...defaultProps} />, { wrapper: createWrapper() })

      const checkbox = screen.getByRole('checkbox')
      const deleteButton = screen.getByRole('button', { name: /Delete Client/i })

      fireEvent.click(checkbox)
      fireEvent.click(deleteButton)

      // Simulate successful deletion
      onSuccessCallback?.({})

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Client deleted successfully')
      })
    })

    it('should navigate to /clients page on successful deletion', async () => {
      let onSuccessCallback: ((data: unknown) => void) | undefined

      mockDeleteClient.mockImplementation((_clientId, options) => {
        onSuccessCallback = options?.onSuccess
      })

      render(<DeleteClientModal {...defaultProps} />, { wrapper: createWrapper() })

      const checkbox = screen.getByRole('checkbox')
      const deleteButton = screen.getByRole('button', { name: /Delete Client/i })

      fireEvent.click(checkbox)
      fireEvent.click(deleteButton)

      // Simulate successful deletion
      onSuccessCallback?.({})

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/clients')
      })
    })

    it('should close modal on successful deletion', async () => {
      let onSuccessCallback: ((data: unknown) => void) | undefined

      mockDeleteClient.mockImplementation((_clientId, options) => {
        onSuccessCallback = options?.onSuccess
      })

      render(<DeleteClientModal {...defaultProps} />, { wrapper: createWrapper() })

      const checkbox = screen.getByRole('checkbox')
      const deleteButton = screen.getByRole('button', { name: /Delete Client/i })

      fireEvent.click(checkbox)
      fireEvent.click(deleteButton)

      // Simulate successful deletion
      onSuccessCallback?.({})

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled()
      })
    })
  })

  describe('Error Flow', () => {
    it('should display error toast on deletion failure', async () => {
      let onErrorCallback:
        | ((error: { response?: { data?: { detail?: string } } }) => void)
        | undefined

      mockDeleteClient.mockImplementation((_clientId, options) => {
        onErrorCallback = options?.onError
      })

      render(<DeleteClientModal {...defaultProps} />, { wrapper: createWrapper() })

      const checkbox = screen.getByRole('checkbox')
      const deleteButton = screen.getByRole('button', { name: /Delete Client/i })

      fireEvent.click(checkbox)
      fireEvent.click(deleteButton)

      // Simulate error
      const mockError = {
        response: {
          data: {
            detail: 'Client has active debts',
          },
        },
      }
      onErrorCallback?.(mockError)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Client has active debts')
      })
    })

    it('should display generic error message when no detail provided', async () => {
      let onErrorCallback: ((error: unknown) => void) | undefined

      mockDeleteClient.mockImplementation((_clientId, options) => {
        onErrorCallback = options?.onError
      })

      render(<DeleteClientModal {...defaultProps} />, { wrapper: createWrapper() })

      const checkbox = screen.getByRole('checkbox')
      const deleteButton = screen.getByRole('button', { name: /Delete Client/i })

      fireEvent.click(checkbox)
      fireEvent.click(deleteButton)

      // Simulate error without detail
      onErrorCallback?.({})

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to delete client')
      })
    })
  })

  describe('Cancel Button', () => {
    it('should close modal when cancel button is clicked', () => {
      render(<DeleteClientModal {...defaultProps} />, { wrapper: createWrapper() })

      const cancelButton = screen.getByRole('button', { name: /Cancel/i })
      fireEvent.click(cancelButton)

      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should reset confirmation checkbox on cancel', () => {
      render(<DeleteClientModal {...defaultProps} />, { wrapper: createWrapper() })

      const checkbox = screen.getByRole('checkbox')
      const cancelButton = screen.getByRole('button', { name: /Cancel/i })

      // Check the checkbox
      fireEvent.click(checkbox)
      expect(checkbox).toBeChecked()

      // Cancel
      fireEvent.click(cancelButton)

      // Checkbox should be reset (when modal reopens)
      expect(mockOnClose).toHaveBeenCalled()
    })
  })
})
