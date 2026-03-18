import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IncomingCallPopup } from '../IncomingCallPopup'
import type { IncomingCallData } from '../../types'

describe('IncomingCallPopup', () => {
  const mockOnAnswer = vi.fn()
  const mockOnReject = vi.fn()
  const mockOnDismiss = vi.fn()

  const mockCallWithLoans: IncomingCallData = {
    call_id: '123e4567-e89b-12d3-a456-426614174000',
    customer_phone: '+380501234567',
    agent_extension: '1004',
    client_name: 'Коваленко Іван Петрович',
    loan_count: 2,
    total_debt: '8000.0',
    loans: [
      {
        loan_id: 456,
        contract_number: 'LOAN-2024-001',
        remaining_debt: '5000.0',
        status: 'active',
      },
      {
        loan_id: 457,
        contract_number: 'LOAN-2024-002',
        remaining_debt: '3000.0',
        status: 'active',
      },
    ],
  }

  const mockCallNoLoans: IncomingCallData = {
    call_id: '123e4567-e89b-12d3-a456-426614174000',
    customer_phone: '+380501234567',
    agent_extension: '1004',
    loan_count: 0,
    total_debt: '0',
    loans: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render incoming call popup with customer information', () => {
    render(
      <IncomingCallPopup
        callData={mockCallWithLoans}
        onAnswer={mockOnAnswer}
        onReject={mockOnReject}
        onDismiss={mockOnDismiss}
      />
    )

    expect(screen.getByText(/Incoming Call/i)).toBeInTheDocument()
    expect(screen.getByText('+380501234567')).toBeInTheDocument()
    expect(screen.getByText('Коваленко Іван Петрович')).toBeInTheDocument()
  })

  it('should display loan count and total debt', () => {
    render(
      <IncomingCallPopup
        callData={mockCallWithLoans}
        onAnswer={mockOnAnswer}
        onReject={mockOnReject}
        onDismiss={mockOnDismiss}
      />
    )

    expect(screen.getByText(/2.*loans/i)).toBeInTheDocument()
    // Check for formatted currency (with spaces as thousands separator)
    expect(screen.getByText(/8.*000/)).toBeInTheDocument()
  })

  it('should display list of loans with details', () => {
    render(
      <IncomingCallPopup
        callData={mockCallWithLoans}
        onAnswer={mockOnAnswer}
        onReject={mockOnReject}
        onDismiss={mockOnDismiss}
      />
    )

    expect(screen.getByText('LOAN-2024-001')).toBeInTheDocument()
    expect(screen.getByText('LOAN-2024-002')).toBeInTheDocument()
    // Check for formatted currency amounts (with UAH symbol)
    expect(screen.getByText(/5.*000/)).toBeInTheDocument()
    expect(screen.getByText(/3.*000/)).toBeInTheDocument()
  })

  it('should call onAnswer when answer button clicked', async () => {
    const user = userEvent.setup()

    render(
      <IncomingCallPopup
        callData={mockCallWithLoans}
        onAnswer={mockOnAnswer}
        onReject={mockOnReject}
        onDismiss={mockOnDismiss}
      />
    )

    const answerButton = screen.getByRole('button', { name: /answer/i })
    await user.click(answerButton)

    expect(mockOnAnswer).toHaveBeenCalledTimes(1)
    expect(mockOnAnswer).toHaveBeenCalledWith(mockCallWithLoans.call_id)
  })

  it('should call onReject when reject button clicked', async () => {
    const user = userEvent.setup()

    render(
      <IncomingCallPopup
        callData={mockCallWithLoans}
        onAnswer={mockOnAnswer}
        onReject={mockOnReject}
        onDismiss={mockOnDismiss}
      />
    )

    const rejectButton = screen.getByRole('button', { name: /reject/i })
    await user.click(rejectButton)

    expect(mockOnReject).toHaveBeenCalledTimes(1)
    expect(mockOnReject).toHaveBeenCalledWith(mockCallWithLoans.call_id)
  })

  it('should call onDismiss when dismiss button clicked', async () => {
    const user = userEvent.setup()

    render(
      <IncomingCallPopup
        callData={mockCallWithLoans}
        onAnswer={mockOnAnswer}
        onReject={mockOnReject}
        onDismiss={mockOnDismiss}
      />
    )

    const dismissButton = screen.getByRole('button', { name: /close/i })
    await user.click(dismissButton)

    expect(mockOnDismiss).toHaveBeenCalledTimes(1)
  })

  it('should handle call with no loans gracefully', () => {
    render(
      <IncomingCallPopup
        callData={mockCallNoLoans}
        onAnswer={mockOnAnswer}
        onReject={mockOnReject}
        onDismiss={mockOnDismiss}
      />
    )

    expect(screen.getByText('+380501234567')).toBeInTheDocument()
    expect(screen.getByText(/0.*loans/i)).toBeInTheDocument()
    expect(screen.queryByText(/LOAN-/)).not.toBeInTheDocument()
  })

  it('should handle call without client name', () => {
    const callWithoutName: IncomingCallData = {
      ...mockCallNoLoans,
      client_name: undefined,
    }

    render(
      <IncomingCallPopup
        callData={callWithoutName}
        onAnswer={mockOnAnswer}
        onReject={mockOnReject}
        onDismiss={mockOnDismiss}
      />
    )

    expect(screen.getByText('+380501234567')).toBeInTheDocument()
    expect(screen.queryByText('Коваленко')).not.toBeInTheDocument()
  })

  it('should have proper ARIA attributes for accessibility', () => {
    render(
      <IncomingCallPopup
        callData={mockCallWithLoans}
        onAnswer={mockOnAnswer}
        onReject={mockOnReject}
        onDismiss={mockOnDismiss}
      />
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-labelledby')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('should have accessible button labels', () => {
    render(
      <IncomingCallPopup
        callData={mockCallWithLoans}
        onAnswer={mockOnAnswer}
        onReject={mockOnReject}
        onDismiss={mockOnDismiss}
      />
    )

    expect(screen.getByRole('button', { name: /answer/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
  })

  it('should support keyboard navigation', async () => {
    const user = userEvent.setup()

    render(
      <IncomingCallPopup
        callData={mockCallWithLoans}
        onAnswer={mockOnAnswer}
        onReject={mockOnReject}
        onDismiss={mockOnDismiss}
      />
    )

    const answerButton = screen.getByRole('button', { name: /answer/i })

    // Tab through buttons - close button is first, then answer button
    await user.tab() // Close button
    await user.tab() // Answer button
    expect(answerButton).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(mockOnAnswer).toHaveBeenCalledTimes(1)
  })

  it('should display formatted currency', () => {
    render(
      <IncomingCallPopup
        callData={mockCallWithLoans}
        onAnswer={mockOnAnswer}
        onReject={mockOnReject}
        onDismiss={mockOnDismiss}
      />
    )

    // Check for formatted amounts (with thousands separator or decimal)
    // Ukrainian format uses spaces as thousand separators: ₴8 000,00
    const totalDebtElements = screen.getAllByText(/8.*000/)
    expect(totalDebtElements.length).toBeGreaterThan(0)
  })

  it('should show active loan status', () => {
    render(
      <IncomingCallPopup
        callData={mockCallWithLoans}
        onAnswer={mockOnAnswer}
        onReject={mockOnReject}
        onDismiss={mockOnDismiss}
      />
    )

    const loans = screen.getAllByText(/active/i)
    expect(loans).toHaveLength(2)
  })

  it('should apply proper styling classes', () => {
    render(
      <IncomingCallPopup
        callData={mockCallWithLoans}
        onAnswer={mockOnAnswer}
        onReject={mockOnReject}
        onDismiss={mockOnDismiss}
      />
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveClass('fixed', 'top-4', 'right-4', 'z-50')
  })

  it('should render with proper structure for loan list', () => {
    render(
      <IncomingCallPopup
        callData={mockCallWithLoans}
        onAnswer={mockOnAnswer}
        onReject={mockOnReject}
        onDismiss={mockOnDismiss}
      />
    )

    // Check that loans are rendered in a list
    const loanElements = screen.getAllByText(/LOAN-2024-/)
    expect(loanElements).toHaveLength(2)
  })
})
