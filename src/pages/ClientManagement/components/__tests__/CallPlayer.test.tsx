/**
 * CallPlayer resilience tests (KAN-1030 — silent hang on truncated recordings).
 *
 * The server sometimes answers 200 and cuts the body short (KAN-1023); the
 * player must not spin silently or play a cut-off blob. Covered here:
 *  - a truncated / failed download shows a readable error with a Retry button,
 *    and Retry re-fetches the recording;
 *  - switching to another dialog (or unmounting) aborts the in-flight request;
 *  - download progress is surfaced while the blob streams;
 *  - a successful load still renders the audio element and plays.
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  vi,
  type MockInstance,
} from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AxiosError } from 'axios'
import { CallPlayer } from '../CallPlayer'
import {
  callService,
  RecordingTruncatedError,
  type FetchRecordingOptions,
} from '@/features/calls/api/callService'

const TRUNCATED_KEY = 'pages.clients.modals.callRecording.loadTruncated'
const FAILED_KEY = 'pages.clients.modals.callRecording.loadFailed'
const NO_RECORDING_KEY = 'pages.clients.modals.callRecording.noRecording'
// The global i18n test mock maps these two keys to readable text.
const PLAY_TEXT = 'Play'
const PAUSE_TEXT = 'Pause'

const audioBlob = () => new Blob([new Uint8Array(64)], { type: 'audio/mpeg' })

let fetchSpy: MockInstance<typeof callService.fetchRecordingBlob>

beforeAll(() => {
  // jsdom has no object-URL implementation.
  URL.createObjectURL = vi.fn(() => 'blob:mock-url') as typeof URL.createObjectURL
  URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL
})

beforeEach(() => {
  fetchSpy = vi.spyOn(callService, 'fetchRecordingBlob')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CallPlayer — truncated / failed download', () => {
  it('shows a readable error with Retry when the body is cut short, and Retry re-fetches', async () => {
    fetchSpy.mockResolvedValue(audioBlob())
    fetchSpy.mockRejectedValueOnce(new RecordingTruncatedError(9_370_000, 392_000))

    const { container } = render(<CallPlayer callId="CALL-1" />)

    // Truncation is reported, not played silently.
    expect(await screen.findByText(TRUNCATED_KEY)).toBeInTheDocument()
    expect(container.querySelector('audio')).not.toBeInTheDocument()

    // Retry re-runs the fetch and recovers.
    fireEvent.click(screen.getByTestId('call-player-retry'))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(container.querySelector('audio')).toBeInTheDocument())
    expect(screen.queryByText(TRUNCATED_KEY)).not.toBeInTheDocument()
    expect(screen.queryByTestId('call-player-retry')).not.toBeInTheDocument()
  })

  it('shows the generic error with Retry on an unexpected failure', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(audioBlob())

    render(<CallPlayer callId="CALL-1" />)

    expect(await screen.findByText(FAILED_KEY)).toBeInTheDocument()
    expect(screen.getByTestId('call-player-retry')).toBeInTheDocument()
  })
})

describe('CallPlayer — cancellation', () => {
  it('aborts the in-flight download when the dialog changes', async () => {
    const signals: (AbortSignal | undefined)[] = []
    fetchSpy.mockImplementation((_callId: string, options?: FetchRecordingOptions) => {
      signals.push(options?.signal)
      return new Promise<Blob>(() => {}) // never settles — a big blob still streaming
    })

    const { rerender } = render(<CallPlayer callId="CALL-1" />)
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    expect(signals[0]?.aborted).toBe(false)

    rerender(<CallPlayer callId="CALL-2" />)

    // The first request is cancelled; a fresh one starts for the new dialog.
    expect(signals[0]?.aborted).toBe(true)
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    expect(signals[1]?.aborted).toBe(false)
  })

  it('aborts the in-flight download on unmount', async () => {
    const signals: (AbortSignal | undefined)[] = []
    fetchSpy.mockImplementation((_callId: string, options?: FetchRecordingOptions) => {
      signals.push(options?.signal)
      return new Promise<Blob>(() => {})
    })

    const { unmount } = render(<CallPlayer callId="CALL-1" />)
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))

    unmount()
    expect(signals[0]?.aborted).toBe(true)
  })
})

describe('CallPlayer — download progress', () => {
  it('shows the streamed percentage while the blob downloads', async () => {
    fetchSpy.mockImplementation((_callId: string, options?: FetchRecordingOptions) => {
      options?.onProgress?.({ loadedBytes: 4_500_000, totalBytes: 9_000_000 })
      return new Promise<Blob>(() => {})
    })

    render(<CallPlayer callId="CALL-1" />)

    expect(await screen.findByTestId('call-player-progress')).toHaveTextContent('50%')
  })
})

describe('CallPlayer — successful load', () => {
  it('renders the audio element and plays as before', async () => {
    fetchSpy.mockResolvedValue(audioBlob())
    const onDurationChange = vi.fn()

    const { container } = render(<CallPlayer callId="CALL-1" onDurationChange={onDurationChange} />)

    await waitFor(() => expect(container.querySelector('audio')).toBeInTheDocument())
    const audio = container.querySelector('audio') as HTMLAudioElement
    expect(audio).toHaveAttribute('src', 'blob:mock-url')

    // Metadata arrives → spinner clears, duration propagates.
    Object.defineProperty(audio, 'duration', { value: 60, configurable: true })
    fireEvent.loadedMetadata(audio)
    expect(onDurationChange).toHaveBeenCalledWith(60_000)

    const playMock = vi
      .spyOn(window.HTMLMediaElement.prototype, 'play')
      .mockResolvedValue(undefined)
    const playButton = screen.getByText(PLAY_TEXT).closest('button') as HTMLButtonElement
    expect(playButton).not.toBeDisabled()
    fireEvent.click(playButton)

    expect(playMock).toHaveBeenCalled()
    expect(screen.getByText(PAUSE_TEXT)).toBeInTheDocument()
  })
})

// A call whose row carries no recording_path is answered 404 by call-service
// ("No recording available for call …"). That is permanent: the trainer must be
// told so plainly, and never offered a Retry that cannot succeed (KAN-1030).
const notFound = () =>
  new AxiosError('Not Found', 'ERR_BAD_REQUEST', undefined, null, {
    status: 404,
    statusText: 'Not Found',
    data: { detail: 'No recording available for call CALL-1' },
    headers: {},
    config: {} as never,
  })

describe('CallPlayer — the call has no recording', () => {
  it('says so and never asks the server when has_recording is false', async () => {
    render(<CallPlayer callId="CALL-1" hasRecording={false} />)

    expect(await screen.findByText(NO_RECORDING_KEY)).toBeInTheDocument()
    // The absence is known up front — requesting the blob can only 404.
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(screen.queryByTestId('call-player-retry')).not.toBeInTheDocument()
  })

  it('says so, without a Retry button, when the server answers 404', async () => {
    fetchSpy.mockRejectedValue(notFound())

    render(<CallPlayer callId="CALL-1" />)

    expect(await screen.findByText(NO_RECORDING_KEY)).toBeInTheDocument()
    expect(screen.queryByText(FAILED_KEY)).not.toBeInTheDocument()
    expect(screen.queryByTestId('call-player-retry')).not.toBeInTheDocument()
  })
})
