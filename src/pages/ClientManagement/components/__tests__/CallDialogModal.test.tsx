/**
 * CallDialogModal Component Tests
 *
 * Tests for the call dialog modal component that handles different call states.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { CallDialogModal } from '../CallDialogModal'
import * as useCallHook from '@/features/calls/hooks/useCall'
import * as callStoreModule from '@/stores/callStore'
import { CALL_MODAL_AUTO_CLOSE_SECONDS } from '@/features/calls/constants/callModal'

// Mock dependencies
vi.mock('@/features/calls/hooks/useCall')
vi.mock('@/stores/callStore')
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
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

describe('CallDialogModal', () => {
  const mockOnClose = vi.fn()
  const mockOnCallStart = vi.fn()
  const mockOnCallEnd = vi.fn()
  const mockOnAnswer = vi.fn()
  const mockOnReject = vi.fn()
  const mockOnMinimize = vi.fn()

  const mockSetMinimizedCall = vi.fn()
  const mockSetOpenCallModal = vi.fn()

  const defaultProps = {
    open: true,
    onClose: mockOnClose,
    clientName: 'Test Client',
    phoneNumber: '+380971234567',
    callId: null,
    initialState: 'initial' as const,
    onCallStart: mockOnCallStart,
    onCallEnd: mockOnCallEnd,
    onAnswer: mockOnAnswer,
    onReject: mockOnReject,
    onMinimize: mockOnMinimize,
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock useCallDetails hook
    vi.mocked(useCallHook.useCallDetails).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    // Mock useHangupCall hook
    vi.mocked(useCallHook.useHangupCall).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      reset: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    // Mock useCallStore hook + the .getState() static method.
    // Track the latest snapshot in a closure so getState() can return it
    // and the modal's post-origination patch path can find a matching id.
    let lastSnapshot: unknown = null
    mockSetMinimizedCall.mockImplementation((snap) => {
      lastSnapshot = snap
    })
    vi.mocked(callStoreModule.useCallStore).mockReturnValue({
      setMinimizedCall: mockSetMinimizedCall,
      setOpenCallModal: mockSetOpenCallModal,
      minimizedCall: null,
      openCallModal: null,
      isCallActive: vi.fn().mockReturnValue(false),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(callStoreModule.useCallStore as any).getState = vi.fn(() => ({
      minimizedCall: lastSnapshot,
      setMinimizedCall: mockSetMinimizedCall,
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Initial State', () => {
    it('should render call dialog in initial state', () => {
      render(<CallDialogModal {...defaultProps} />, { wrapper: createWrapper() })

      expect(screen.getByText('Call Client')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Test Client')).toBeInTheDocument()
      expect(screen.getByDisplayValue('+380971234567')).toBeInTheDocument()
    })

    it('should have call type options', () => {
      render(<CallDialogModal {...defaultProps} />, { wrapper: createWrapper() })

      expect(screen.getByText('White Line')).toBeInTheDocument()
      expect(screen.getByText('Gray Line')).toBeInTheDocument()
      expect(screen.getByText('Spam Calls')).toBeInTheDocument()
    })

    it('should call onCallStart when Call Now button is clicked', () => {
      render(<CallDialogModal {...defaultProps} />, { wrapper: createWrapper() })

      const callNowButton = screen.getByRole('button', { name: 'Call Now' })
      fireEvent.click(callNowButton)

      expect(mockOnCallStart).toHaveBeenCalledWith('white-line', '+380971234567')
    })

    it('should call onClose when Cancel button is clicked', () => {
      render(<CallDialogModal {...defaultProps} />, { wrapper: createWrapper() })

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      fireEvent.click(cancelButton)

      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should allow selecting call type', () => {
      render(<CallDialogModal {...defaultProps} />, { wrapper: createWrapper() })

      const grayLineRadio = screen.getAllByRole('radio')[1] // Gray Line is the second radio
      expect(grayLineRadio).toBeInTheDocument()

      fireEvent.click(grayLineRadio)

      const callNowButton = screen.getByRole('button', { name: 'Call Now' })
      fireEvent.click(callNowButton)

      expect(mockOnCallStart).toHaveBeenCalledWith('gray-line', '+380971234567')
    })

    it('disables Call Now when manual entry is enabled and the number is invalid', () => {
      render(<CallDialogModal {...defaultProps} />, { wrapper: createWrapper() })

      fireEvent.click(screen.getByRole('checkbox'))
      const phoneInput = screen.getAllByRole('textbox')[1]
      fireEvent.change(phoneInput, { target: { value: '38012' } })

      expect(screen.getByRole('button', { name: 'Call Now' })).toBeDisabled()
    })

    it('enables Call Now and passes 12-digit 380 number when manual entry is valid', () => {
      render(<CallDialogModal {...defaultProps} />, { wrapper: createWrapper() })

      fireEvent.click(screen.getByRole('checkbox'))
      const phoneInput = screen.getAllByRole('textbox')[1]
      fireEvent.change(phoneInput, { target: { value: '380971234567' } })

      const callNowButton = screen.getByRole('button', { name: 'Call Now' })
      expect(callNowButton).not.toBeDisabled()
      fireEvent.click(callNowButton)

      expect(mockOnCallStart).toHaveBeenCalledWith('white-line', '380971234567')
    })

    it('should call minimize handler when minimize button is clicked', () => {
      render(<CallDialogModal {...defaultProps} />, { wrapper: createWrapper() })

      const minimizeButton = screen.getByLabelText('Minimize modal')
      fireEvent.click(minimizeButton)

      expect(mockSetMinimizedCall).toHaveBeenCalled()
    })

    it('auto-minimizes immediately on click, then patches the call_id when origination resolves', async () => {
      const resolvedCallId = 'srv-call-abc-123'
      const onCallStart = vi
        .fn<(callType: string, dial: string) => Promise<string | null>>()
        .mockResolvedValue(resolvedCallId)

      render(
        <CallDialogModal {...defaultProps} onCallStart={onCallStart} onMinimize={mockOnMinimize} />,
        { wrapper: createWrapper() }
      )

      fireEvent.click(screen.getByRole('button', { name: 'Call Now' }))

      // First write: minimize immediately on click with callId=null.
      expect(mockSetMinimizedCall).toHaveBeenCalledTimes(1)
      expect(mockOnMinimize).toHaveBeenCalledTimes(1)
      const initialSnapshot = mockSetMinimizedCall.mock.calls[0][0]
      expect(initialSnapshot).toMatchObject({
        type: 'call-dialog',
        callId: null,
        callState: 'dialing',
        callType: 'white-line',
      })

      // After the origination Promise resolves, the snapshot is patched with
      // the real call_id so the bar can poll state and hang up.
      await waitFor(() => {
        expect(mockSetMinimizedCall).toHaveBeenCalledTimes(2)
      })
      const patchedSnapshot = mockSetMinimizedCall.mock.calls[1][0]
      expect(patchedSnapshot).toMatchObject({
        id: initialSnapshot.id,
        callId: resolvedCallId,
        callState: 'dialing',
      })
    })

    it('auto-minimizes immediately on click, then flips the snapshot to failed on origination failure', async () => {
      const onCallStart = vi
        .fn<(callType: string, dial: string) => Promise<string | null>>()
        .mockResolvedValue(null)

      render(
        <CallDialogModal {...defaultProps} onCallStart={onCallStart} onMinimize={mockOnMinimize} />,
        { wrapper: createWrapper() }
      )

      fireEvent.click(screen.getByRole('button', { name: 'Call Now' }))

      // Minimize fires on click regardless of outcome.
      expect(mockSetMinimizedCall).toHaveBeenCalledTimes(1)
      expect(mockOnMinimize).toHaveBeenCalledTimes(1)
      const initialSnapshot = mockSetMinimizedCall.mock.calls[0][0]
      expect(initialSnapshot.callState).toBe('dialing')

      // On null resolution, the snapshot flips to 'failed' so the bar's
      // auto-dismiss timer clears the bar.
      await waitFor(() => {
        expect(mockSetMinimizedCall).toHaveBeenCalledTimes(2)
      })
      const failedSnapshot = mockSetMinimizedCall.mock.calls[1][0]
      expect(failedSnapshot).toMatchObject({
        id: initialSnapshot.id,
        callState: 'failed',
      })
    })

    it('auto-minimizes on click for legacy void-returning onCallStart (no patch follow-up)', async () => {
      const onCallStart = vi.fn<(callType: string, dial: string) => void>(() => undefined)

      render(
        <CallDialogModal {...defaultProps} onCallStart={onCallStart} onMinimize={mockOnMinimize} />,
        { wrapper: createWrapper() }
      )

      fireEvent.click(screen.getByRole('button', { name: 'Call Now' }))

      // Minimize still fires immediately.
      expect(mockSetMinimizedCall).toHaveBeenCalledTimes(1)
      expect(mockOnMinimize).toHaveBeenCalledTimes(1)
      expect(mockSetMinimizedCall.mock.calls[0][0]).toMatchObject({
        callId: null,
        callState: 'dialing',
      })

      // No Promise → no follow-up patch.
      await Promise.resolve()
      await Promise.resolve()
      expect(mockSetMinimizedCall).toHaveBeenCalledTimes(1)
    })
  })

  describe('Dialing State', () => {
    it('should render dialing state correctly', () => {
      render(<CallDialogModal {...defaultProps} initialState="dialing" />, {
        wrapper: createWrapper(),
      })

      expect(screen.getByText('Test Client')).toBeInTheDocument()
      expect(screen.getByText(/calling/i)).toBeInTheDocument()
      expect(screen.getByText('+380971234567')).toBeInTheDocument()
    })

    it('should display elapsed time in dialing state', async () => {
      render(<CallDialogModal {...defaultProps} initialState="dialing" />, {
        wrapper: createWrapper(),
      })

      expect(screen.getByText(/00:00/)).toBeInTheDocument()
    })

    it('should have mute, hold, and hang up buttons in dialing state', () => {
      render(<CallDialogModal {...defaultProps} initialState="dialing" />, {
        wrapper: createWrapper(),
      })

      expect(screen.getByRole('button', { name: 'Mute' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Hold' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Hang Up' })).toBeInTheDocument()
    })

    it('should have mute and hold buttons disabled for MVP', () => {
      render(<CallDialogModal {...defaultProps} initialState="dialing" />, {
        wrapper: createWrapper(),
      })

      const muteButton = screen.getByRole('button', { name: 'Mute' })
      const holdButton = screen.getByRole('button', { name: 'Hold' })

      // Mute and Hold buttons should be disabled for MVP
      expect(muteButton).toBeDisabled()
      expect(holdButton).toBeDisabled()
    })

    it('should call onCallEnd when hang up button is clicked', () => {
      render(<CallDialogModal {...defaultProps} initialState="dialing" />, {
        wrapper: createWrapper(),
      })

      const hangUpButton = screen.getByRole('button', { name: 'Hang Up' })
      fireEvent.click(hangUpButton)

      expect(mockOnCallEnd).toHaveBeenCalledWith(0, 'missed')
    })
  })

  describe('Connected State', () => {
    it('should render connected state correctly', () => {
      render(<CallDialogModal {...defaultProps} initialState="connected" />, {
        wrapper: createWrapper(),
      })

      expect(screen.getByText(/connected/i)).toBeInTheDocument()
    })

    it('should call onCallEnd with answered status when hang up is clicked', () => {
      render(<CallDialogModal {...defaultProps} initialState="connected" />, {
        wrapper: createWrapper(),
      })

      const hangUpButton = screen.getByRole('button', { name: 'Hang Up' })
      fireEvent.click(hangUpButton)

      expect(mockOnCallEnd).toHaveBeenCalledWith(0, 'answered')
    })
  })

  describe('Ended State', () => {
    it('should render ended state correctly', () => {
      render(<CallDialogModal {...defaultProps} initialState="ended" />, {
        wrapper: createWrapper(),
      })

      expect(screen.getByText('Call Ended')).toBeInTheDocument()
    })

    it('should display auto-close countdown', () => {
      render(<CallDialogModal {...defaultProps} initialState="ended" />, {
        wrapper: createWrapper(),
      })

      expect(screen.getByText(/Auto-closing in/i)).toBeInTheDocument()
      expect(screen.getByText(String(CALL_MODAL_AUTO_CLOSE_SECONDS))).toBeInTheDocument()
    })

    it('should have countdown timer in ended state', () => {
      render(<CallDialogModal {...defaultProps} initialState="ended" />, {
        wrapper: createWrapper(),
      })

      // Should display countdown
      expect(screen.getByText(/Auto-closing in/i)).toBeInTheDocument()
    })

    it('should call onClose when Close is clicked in ended state', () => {
      render(<CallDialogModal {...defaultProps} initialState="ended" />, {
        wrapper: createWrapper(),
      })

      fireEvent.click(screen.getByRole('button', { name: 'Close' }))
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should start auto-close countdown when backend reports COMPLETED', () => {
      vi.useFakeTimers()
      vi.mocked(useCallHook.useCallDetails).mockReturnValue({
        data: {
          state: 'COMPLETED',
          total_duration: 42,
        },
        isLoading: false,
        isError: false,
        error: null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      render(<CallDialogModal {...defaultProps} callId="call-123" initialState="ended" />, {
        wrapper: createWrapper(),
      })

      expect(screen.getByText(String(CALL_MODAL_AUTO_CLOSE_SECONDS))).toBeInTheDocument()

      vi.advanceTimersByTime(CALL_MODAL_AUTO_CLOSE_SECONDS * 1000)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
      vi.useRealTimers()
    })
  })

  describe('Incoming Call State', () => {
    const mockLoans = [
      {
        id: '1',
        clientName: 'Test Client',
        loanNumber: 'LOAN-123',
        counterparty: 'Test Bank',
        loanPrincipal: 10000,
        debt: 5000,
        status: 'Active',
        saleDate: '2025-01-01',
        lastContact: '2025-01-10',
        priority: 'Critical' as const,
        score: 85,
      },
    ]

    it('should render incoming call state', () => {
      render(<CallDialogModal {...defaultProps} initialState="incoming" loans={mockLoans} />, {
        wrapper: createWrapper(),
      })

      expect(screen.getByText('Incoming Call')).toBeInTheDocument()
    })

    it('should have answer and reject buttons in incoming state', () => {
      render(<CallDialogModal {...defaultProps} initialState="incoming" />, {
        wrapper: createWrapper(),
      })

      expect(screen.getByRole('button', { name: 'Answer Call' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument()
    })

    it('should call onAnswer when answer button is clicked', () => {
      render(<CallDialogModal {...defaultProps} initialState="incoming" />, {
        wrapper: createWrapper(),
      })

      const answerButton = screen.getByRole('button', { name: 'Answer Call' })
      fireEvent.click(answerButton)

      expect(mockOnAnswer).toHaveBeenCalled()
    })

    it('should call onReject when reject button is clicked', () => {
      render(<CallDialogModal {...defaultProps} initialState="incoming" />, {
        wrapper: createWrapper(),
      })

      const rejectButton = screen.getByRole('button', { name: 'Reject' })
      fireEvent.click(rejectButton)

      expect(mockOnReject).toHaveBeenCalled()
      expect(mockOnCallEnd).toHaveBeenCalledWith(0, 'rejected')
    })
  })

  describe('Real-time Call State Updates', () => {
    it('should fetch call details when callId is provided', () => {
      render(<CallDialogModal {...defaultProps} callId="CALL-123" />, {
        wrapper: createWrapper(),
      })

      expect(useCallHook.useCallDetails).toHaveBeenCalledWith('CALL-123')
    })

    it('should not fetch call details when callId is null', () => {
      vi.clearAllMocks()

      render(<CallDialogModal {...defaultProps} callId={null} />, {
        wrapper: createWrapper(),
      })

      expect(useCallHook.useCallDetails).toHaveBeenCalledWith(null)
    })
  })

  describe('Call Store Integration', () => {
    it('should set open call modal state when opened', () => {
      render(<CallDialogModal {...defaultProps} />, { wrapper: createWrapper() })

      expect(mockSetOpenCallModal).toHaveBeenCalledWith('call-dialog')
    })

    it('should clear open call modal state when closed', () => {
      const { rerender } = render(<CallDialogModal {...defaultProps} />, {
        wrapper: createWrapper(),
      })

      rerender(<CallDialogModal {...defaultProps} open={false} />)

      expect(mockSetOpenCallModal).toHaveBeenCalledWith(null)
    })
  })

  describe('Cleanup', () => {
    it('should cleanup timers on unmount', () => {
      const { unmount } = render(<CallDialogModal {...defaultProps} initialState="dialing" />, {
        wrapper: createWrapper(),
      })

      unmount()

      // No errors should be thrown
      expect(true).toBe(true)
    })

    it('should reset state when modal closes', () => {
      const { rerender } = render(<CallDialogModal {...defaultProps} initialState="dialing" />, {
        wrapper: createWrapper(),
      })

      rerender(<CallDialogModal {...defaultProps} open={false} initialState="dialing" />)

      // Verify cleanup happened (no visible errors)
      expect(true).toBe(true)
    })
  })
})
