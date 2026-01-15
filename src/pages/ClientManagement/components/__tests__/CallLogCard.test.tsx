/**
 * CallLogCard Component Tests
 *
 * Tests for the call log card component that displays call history entries.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CallLogCard } from '../CallLogCard'
import * as callStoreModule from '@/stores/callStore'
import { toast } from 'sonner'

// Mock dependencies
vi.mock('@/stores/callStore')
vi.mock('sonner')

describe('CallLogCard', () => {
  const mockSetSelectedCallData = vi.fn()
  const mockSetIsCallRecordingModalOpen = vi.fn()
  const mockSetSelectedSMSData = vi.fn()
  const mockSetIsViewSMSModalOpen = vi.fn()
  const mockSetOpenCallModal = vi.fn()
  const mockIsCallActive = vi.fn()

  const defaultCallProps = {
    title: 'Outgoing Call',
    time: '10:30 AM',
    date: '2025-01-14',
    duration: '05:30',
    status: 'Answered',
    operator: 'Maria Petrenko',
    type: 'Outgoing',
    phone: '+380971234567',
    line: 'White Line',
    clientName: 'Test Client',
    call_id: 'CALL-123',
    setSelectedCallData: mockSetSelectedCallData,
    setIsCallRecordingModalOpen: mockSetIsCallRecordingModalOpen,
  }

  const defaultSMSProps = {
    title: 'SMS Reminder',
    time: '11:00 AM',
    date: '2025-01-14',
    status: 'Delivered',
    message: 'Dear Ivan, this is a reminder about your loan payment.',
    template: 'Payment Reminder',
    operator: 'Svitlana',
    phone: '+380971234567',
    setSelectedSMSData: mockSetSelectedSMSData,
    setIsViewSMSModalOpen: mockSetIsViewSMSModalOpen,
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock useCallStore hook
    vi.mocked(callStoreModule.useCallStore).mockReturnValue({
      setOpenCallModal: mockSetOpenCallModal,
      isCallActive: mockIsCallActive,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    mockIsCallActive.mockReturnValue(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Call Log Card Rendering', () => {
    it('should render call log card with call data', () => {
      render(<CallLogCard {...defaultCallProps} />)

      expect(screen.getByText('10:30 AM')).toBeInTheDocument()
      expect(screen.getByText('Outgoing Call')).toBeInTheDocument()
    })

    it('should render status indicator for answered calls', () => {
      render(<CallLogCard {...defaultCallProps} status="Answered" />)

      expect(screen.getByText(/answered/i)).toBeInTheDocument()
    })

    it('should render status indicator for no answer calls', () => {
      render(<CallLogCard {...defaultCallProps} status="No Answer" />)

      expect(screen.getByText('No Answer')).toBeInTheDocument()
    })

    it('should render call type information', () => {
      render(<CallLogCard {...defaultCallProps} />)

      expect(screen.getByText('Outgoing')).toBeInTheDocument()
    })

    it('should render operator name', () => {
      render(<CallLogCard {...defaultCallProps} />)

      expect(screen.getByText('Maria Petrenko')).toBeInTheDocument()
    })

    it('should render phone number', () => {
      render(<CallLogCard {...defaultCallProps} />)

      expect(screen.getByText('+380971234567')).toBeInTheDocument()
    })

    it('should render line information', () => {
      render(<CallLogCard {...defaultCallProps} />)

      expect(screen.getByText('White Line')).toBeInTheDocument()
    })
  })

  describe('SMS Log Card Rendering', () => {
    it('should render SMS log card with SMS data', () => {
      render(<CallLogCard {...defaultSMSProps} />)

      expect(screen.getByText('11:00 AM')).toBeInTheDocument()
      expect(screen.getByText('SMS Reminder')).toBeInTheDocument()
    })

    it('should render SMS message content', () => {
      render(<CallLogCard {...defaultSMSProps} />)

      expect(
        screen.getByText('Dear Ivan, this is a reminder about your loan payment.')
      ).toBeInTheDocument()
    })

    it('should render template name', () => {
      render(<CallLogCard {...defaultSMSProps} />)

      expect(screen.getByText('Payment Reminder')).toBeInTheDocument()
    })

    it('should render custom message when no template provided', () => {
      render(<CallLogCard {...defaultSMSProps} template={undefined} />)

      expect(screen.getByText('Custom Message')).toBeInTheDocument()
    })

    it('should render status indicator for delivered SMS', () => {
      render(<CallLogCard {...defaultSMSProps} status="Delivered" />)

      expect(screen.getByText(/delivered/i)).toBeInTheDocument()
    })

    it('should render status indicator for failed SMS', () => {
      render(<CallLogCard {...defaultSMSProps} status="Failed" />)

      expect(screen.getByText(/failed/i)).toBeInTheDocument()
    })
  })

  describe('Call Type Translation', () => {
    it('should translate incoming call type', () => {
      render(<CallLogCard {...defaultCallProps} type="Incoming" />)

      expect(screen.getByText(/incoming/i)).toBeInTheDocument()
    })

    it('should translate outgoing call type', () => {
      render(<CallLogCard {...defaultCallProps} type="Outgoing" />)

      expect(screen.getByText('Outgoing')).toBeInTheDocument()
    })
  })

  describe('Click Interactions', () => {
    it('should open call recording modal when call title is clicked', () => {
      render(<CallLogCard {...defaultCallProps} />)

      const titleButton = screen.getByRole('button')
      fireEvent.click(titleButton)

      expect(mockSetSelectedCallData).toHaveBeenCalledWith({
        type: expect.any(String),
        clientName: 'Test Client',
        date: '2025-01-14',
        time: '10:30 AM',
        operator: 'Maria Petrenko',
        duration: '05:30',
        phone: '+380971234567',
        call_id: 'CALL-123',
      })
      expect(mockSetIsCallRecordingModalOpen).toHaveBeenCalledWith(true)
      expect(mockSetOpenCallModal).toHaveBeenCalledWith('call-recording')
    })

    it('should open SMS view modal when SMS title is clicked', () => {
      render(<CallLogCard {...defaultSMSProps} />)

      const titleButton = screen.getByRole('button')
      fireEvent.click(titleButton)

      expect(mockSetSelectedSMSData).toHaveBeenCalledWith({
        date: '2025-01-14',
        time: '11:00 AM',
        template: 'Payment Reminder',
        operator: 'Svitlana',
        status: 'Delivered',
        message: 'Dear Ivan, this is a reminder about your loan payment.',
        phone: '+380971234567',
      })
      expect(mockSetIsViewSMSModalOpen).toHaveBeenCalledWith(true)
    })

    it('should show warning if call is already active', () => {
      mockIsCallActive.mockReturnValue(true)

      render(<CallLogCard {...defaultCallProps} />)

      const titleButton = screen.getByRole('button')
      fireEvent.click(titleButton)

      expect(toast.warning).toHaveBeenCalled()
      expect(mockSetIsCallRecordingModalOpen).not.toHaveBeenCalled()
    })
  })

  describe('Status Color Styling', () => {
    it('should apply success color for answered status', () => {
      const { container } = render(<CallLogCard {...defaultCallProps} status="Answered" />)

      const statusElement = container.querySelector('.text-success-500')
      expect(statusElement).toBeInTheDocument()
    })

    it('should apply error color for no answer status', () => {
      const { container } = render(<CallLogCard {...defaultCallProps} status="No Answer" />)

      const statusElement = container.querySelector('.text-error-500')
      expect(statusElement).toBeInTheDocument()
    })

    it('should apply success color for delivered SMS', () => {
      const { container } = render(<CallLogCard {...defaultSMSProps} status="Delivered" />)

      const statusElement = container.querySelector('.text-success-500')
      expect(statusElement).toBeInTheDocument()
    })

    it('should apply error color for failed SMS', () => {
      const { container } = render(<CallLogCard {...defaultSMSProps} status="Failed" />)

      const statusElement = container.querySelector('.text-error-500')
      expect(statusElement).toBeInTheDocument()
    })
  })

  describe('Icon Rendering', () => {
    it('should render custom icon when provided', () => {
      const icon = <div data-testid="custom-icon">Icon</div>

      render(<CallLogCard {...defaultCallProps} icon={icon} />)

      expect(screen.getByTestId('custom-icon')).toBeInTheDocument()
    })
  })

  describe('Custom Class Names', () => {
    it('should apply custom className', () => {
      const { container } = render(<CallLogCard {...defaultCallProps} className="custom-class" />)

      expect(container.firstChild).toHaveClass('custom-class')
    })
  })

  describe('Edge Cases', () => {
    it('should handle missing optional props gracefully', () => {
      render(
        <CallLogCard
          time="10:30 AM"
          setSelectedCallData={mockSetSelectedCallData}
          setIsCallRecordingModalOpen={mockSetIsCallRecordingModalOpen}
        />
      )

      expect(screen.getByText('10:30 AM')).toBeInTheDocument()
    })

    it('should handle long message text with line clamp', () => {
      const longMessage =
        'This is a very long message that should be clamped to 2 lines in the UI to prevent overflow and maintain proper layout structure.'

      const { container } = render(<CallLogCard {...defaultSMSProps} message={longMessage} />)

      const messageElement = container.querySelector('.line-clamp-2')
      expect(messageElement).toBeInTheDocument()
    })

    it('should handle incoming call type correctly', () => {
      render(<CallLogCard {...defaultCallProps} type="Incoming" />)

      const titleButton = screen.getByRole('button')
      fireEvent.click(titleButton)

      expect(mockSetSelectedCallData).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'Incoming Call',
        })
      )
    })
  })

  describe('Accessibility', () => {
    it('should have clickable button for title', () => {
      render(<CallLogCard {...defaultCallProps} />)

      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
    })

    it('should maintain proper ARIA structure', () => {
      const { container } = render(<CallLogCard {...defaultCallProps} />)

      // SVG should be aria-hidden
      const svg = container.querySelector('svg')
      expect(svg).toHaveAttribute('aria-hidden', 'true')
      expect(svg).toHaveAttribute('focusable', 'false')
    })
  })
})
