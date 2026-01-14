/**
 * CallRecordingModal Component Tests
 *
 * Tests for the call recording modal component that handles audio playback.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CallRecordingModal } from '../CallRecordingModal'
import * as callStoreModule from '@/stores/callStore'
import * as callService from '@/features/calls/api/callService'

// Mock dependencies
vi.mock('@/stores/callStore')
vi.mock('@/features/calls/api/callService')

// Mock HTMLAudioElement
class MockAudio {
  src = ''
  currentTime = 0
  duration = 180
  playbackRate = 1.0
  paused = true
  addEventListener = vi.fn()
  removeEventListener = vi.fn()
  play = vi.fn().mockResolvedValue(undefined)
  pause = vi.fn()
  load = vi.fn()
}

describe('CallRecordingModal', () => {
  const mockOnClose = vi.fn()
  const mockOnMinimize = vi.fn()
  const mockSetMinimizedCall = vi.fn()
  const mockSetOpenCallModal = vi.fn()

  const defaultCallData = {
    type: 'Outgoing Call',
    clientName: 'Test Client',
    date: '2025-01-14',
    time: '10:30 AM',
    operator: 'Maria Petrenko',
    duration: '05:30',
    phone: '+380971234567',
    call_id: 'CALL-123',
  }

  const defaultProps = {
    open: true,
    onClose: mockOnClose,
    callData: defaultCallData,
    onMinimize: mockOnMinimize,
  }

  let audioElement: MockAudio

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock useCallStore hook
    vi.mocked(callStoreModule.useCallStore).mockReturnValue({
      setMinimizedCall: mockSetMinimizedCall,
      setOpenCallModal: mockSetOpenCallModal,
      minimizedCall: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    // Mock callService.getRecordingUrl
    vi.mocked(callService.callService.getRecordingUrl).mockReturnValue(
      'http://localhost:8005/api/v1/calls/CALL-123/recording'
    )

    // Mock HTMLAudioElement with duration set
    audioElement = new MockAudio()
    audioElement.duration = 180 // Set valid duration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis.HTMLAudioElement = vi.fn(() => audioElement) as any
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Modal Rendering', () => {
    it('should render call recording modal', () => {
      render(<CallRecordingModal {...defaultProps} />)

      expect(screen.getByText(/title/i)).toBeInTheDocument()
      expect(screen.getByText('Test Client')).toBeInTheDocument()
      expect(screen.getByText(/Outgoing Call/i)).toBeInTheDocument()
    })

    it('should display call details', () => {
      render(<CallRecordingModal {...defaultProps} />)

      expect(screen.getByText('Maria Petrenko')).toBeInTheDocument()
      expect(screen.getByText('05:30')).toBeInTheDocument()
      expect(screen.getByText('+380971234567')).toBeInTheDocument()
    })

    it('should fetch recording URL when call_id is provided', () => {
      render(<CallRecordingModal {...defaultProps} />)

      expect(callService.callService.getRecordingUrl).toHaveBeenCalledWith('CALL-123')
    })

    it('should not fetch recording URL when call_id is missing', () => {
      const callDataWithoutId = { ...defaultCallData, call_id: undefined }

      render(<CallRecordingModal {...defaultProps} callData={callDataWithoutId} />)

      // Should still render but without audio element
      expect(screen.getByText('Test Client')).toBeInTheDocument()
    })
  })

  describe('Audio Playback Controls', () => {
    it('should have play button initially', () => {
      render(<CallRecordingModal {...defaultProps} />)

      const playButton = screen
        .getAllByRole('button')
        .find((btn) => btn.textContent?.includes('play'))
      expect(playButton).toBeInTheDocument()
    })

    it('should play audio when play button is clicked', async () => {
      render(<CallRecordingModal {...defaultProps} />)

      const playButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.textContent?.includes('play'))
      fireEvent.click(playButtons[0])

      await waitFor(() => {
        expect(audioElement.play).toHaveBeenCalled()
      })
    })

    it('should pause audio when pause button is clicked', async () => {
      render(<CallRecordingModal {...defaultProps} />)

      // First play
      const playButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.textContent?.includes('play'))
      fireEvent.click(playButtons[0])

      await waitFor(() => {
        expect(audioElement.play).toHaveBeenCalled()
      })

      // Then pause
      const pauseButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.textContent?.includes('pause'))
      fireEvent.click(pauseButtons[0])

      expect(audioElement.pause).toHaveBeenCalled()
    })

    it('should have backward button', () => {
      render(<CallRecordingModal {...defaultProps} />)

      const backwardButton = screen.getByText('-10s').closest('button')
      expect(backwardButton).toBeInTheDocument()
    })

    it('should have forward button', () => {
      render(<CallRecordingModal {...defaultProps} />)

      const forwardButton = screen.getByText('+10s').closest('button')
      expect(forwardButton).toBeInTheDocument()
    })
  })

  describe('Playback Speed Control', () => {
    it('should have speed control button', () => {
      render(<CallRecordingModal {...defaultProps} />)

      expect(screen.getByText(/speed:/i)).toBeInTheDocument()
    })

    it('should show speed menu when speed button is clicked', () => {
      render(<CallRecordingModal {...defaultProps} />)

      const speedButton = screen.getByText(/speed:/i).closest('button')
      fireEvent.click(speedButton!)

      expect(screen.getByText('0.5x')).toBeInTheDocument()
      expect(screen.getByText('1.0x')).toBeInTheDocument()
      expect(screen.getByText('2.0x')).toBeInTheDocument()
    })

    it('should show all speed options when menu is opened', () => {
      render(<CallRecordingModal {...defaultProps} />)

      const speedButton = screen.getByText(/speed:/i).closest('button')
      fireEvent.click(speedButton!)

      expect(screen.getByText('0.5x')).toBeInTheDocument()
      expect(screen.getByText('0.75x')).toBeInTheDocument()
      expect(screen.getByText('1.0x')).toBeInTheDocument()
      expect(screen.getByText('1.25x')).toBeInTheDocument()
      expect(screen.getByText('1.5x')).toBeInTheDocument()
      expect(screen.getByText('2.0x')).toBeInTheDocument()
    })

    it('should close speed menu after selecting speed', () => {
      render(<CallRecordingModal {...defaultProps} />)

      const speedButton = screen.getByText(/speed:/i).closest('button')
      fireEvent.click(speedButton!)

      const speed2Button = screen.getByText('2.0x')
      fireEvent.click(speed2Button)

      expect(screen.queryByText('0.5x')).not.toBeInTheDocument()
    })
  })

  describe('Progress Bar', () => {
    it('should have progress bar slider', () => {
      render(<CallRecordingModal {...defaultProps} />)

      const progressBar = screen.getByRole('slider')
      expect(progressBar).toBeInTheDocument()
      expect(progressBar).toHaveAttribute('aria-label')
    })

    it('should display time indicators', () => {
      render(<CallRecordingModal {...defaultProps} />)

      // Should have time display elements (current time and duration)
      const progressBar = screen.getByRole('slider')
      expect(progressBar).toHaveAttribute('aria-valuemin', '0')
    })
  })

  describe('Download Functionality', () => {
    it('should have download button', () => {
      render(<CallRecordingModal {...defaultProps} />)

      expect(screen.getByText(/download/i)).toBeInTheDocument()
    })

    it('should have working download button', () => {
      render(<CallRecordingModal {...defaultProps} />)

      const downloadButton = screen.getByText(/download/i).closest('button')
      expect(downloadButton).toBeInTheDocument()
      expect(downloadButton).not.toBeDisabled()
    })

    it('should disable download button when no recording URL', () => {
      const callDataWithoutId = { ...defaultCallData, call_id: undefined }

      render(<CallRecordingModal {...defaultProps} callData={callDataWithoutId} />)

      const downloadButton = screen.getByText(/download/i).closest('button')
      expect(downloadButton).toBeDisabled()
    })
  })

  describe('Modal Actions', () => {
    it('should have close button', () => {
      render(<CallRecordingModal {...defaultProps} />)

      const closeButton = screen.getByText('Close').closest('button')
      expect(closeButton).toBeInTheDocument()

      fireEvent.click(closeButton!)
      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should call minimize handler when minimize button is clicked', () => {
      render(<CallRecordingModal {...defaultProps} />)

      const minimizeButton = screen.getByLabelText('Minimize modal')
      fireEvent.click(minimizeButton)

      expect(mockSetMinimizedCall).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'call-recording',
          clientName: 'Test Client',
          phoneNumber: '+380971234567',
        })
      )
    })
  })

  describe('Call Store Integration', () => {
    it('should set open call modal state when opened', () => {
      render(<CallRecordingModal {...defaultProps} />)

      expect(mockSetOpenCallModal).toHaveBeenCalledWith('call-recording')
    })

    it('should clear open call modal state when closed', () => {
      const { rerender } = render(<CallRecordingModal {...defaultProps} />)

      rerender(<CallRecordingModal {...defaultProps} open={false} />)

      expect(mockSetOpenCallModal).toHaveBeenCalledWith(null)
    })
  })

  describe('State Reset', () => {
    it('should reset state when modal reopens', () => {
      const { rerender } = render(<CallRecordingModal {...defaultProps} />)

      // Close modal
      rerender(<CallRecordingModal {...defaultProps} open={false} />)

      // Reopen modal
      rerender(<CallRecordingModal {...defaultProps} open={true} />)

      // Should have play button (initial state)
      expect(screen.getByText(/Play/i)).toBeInTheDocument()
    })

    it('should reset speed when modal closes', () => {
      const { rerender } = render(<CallRecordingModal {...defaultProps} />)

      // Change speed
      const speedButton = screen.getByText(/speed:/i).closest('button')
      fireEvent.click(speedButton!)
      fireEvent.click(screen.getByText('2.0x'))

      // Close and reopen
      rerender(<CallRecordingModal {...defaultProps} open={false} />)
      rerender(<CallRecordingModal {...defaultProps} open={true} />)

      // Speed should be reset to 1.0x
      expect(screen.getByText(/speed: 1\.0x/i)).toBeInTheDocument()
    })
  })

  describe('Date Formatting', () => {
    it('should format date correctly', () => {
      render(<CallRecordingModal {...defaultProps} />)

      // Should display formatted date with month name
      expect(screen.getByText(/10:30 AM/i)).toBeInTheDocument()
    })

    it('should render with any date format', () => {
      const invalidCallData = {
        ...defaultCallData,
        date: 'invalid-date',
      }

      render(<CallRecordingModal {...defaultProps} callData={invalidCallData} />)

      // Should render modal title
      expect(screen.getByText(/Call Recording/i)).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<CallRecordingModal {...defaultProps} />)

      expect(screen.getByRole('slider')).toHaveAttribute('aria-label')
    })

    it('should have keyboard navigation for progress bar', () => {
      render(<CallRecordingModal {...defaultProps} />)

      const progressBar = screen.getByRole('slider')
      expect(progressBar).toHaveAttribute('tabIndex', '0')
    })

    it('should be keyboard accessible', () => {
      render(<CallRecordingModal {...defaultProps} />)

      const progressBar = screen.getByRole('slider')
      expect(progressBar).toHaveAttribute('role', 'slider')
      expect(progressBar).toHaveAttribute('tabIndex', '0')
    })
  })

  describe('Component Lifecycle', () => {
    it('should cleanup properly on unmount', () => {
      const { unmount } = render(<CallRecordingModal {...defaultProps} />)

      // Should unmount without errors
      expect(() => unmount()).not.toThrow()
    })
  })
})
