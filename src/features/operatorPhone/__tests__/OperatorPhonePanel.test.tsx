import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The panel must never frame a guessed origin: useOperatorPhone posts the
// operator's phone JWT to it. These tests pin that an unconfigured build
// renders nothing at all rather than falling back to some default host.

const constantsMock = vi.hoisted(() => ({
  OPERATOR_PHONE_URL: 'https://webrtc.example.test',
  OPERATOR_PHONE_ORIGIN: 'https://webrtc.example.test',
  OPERATOR_PHONE_CONFIGURED: true,
}))

vi.mock('../constants', () => constantsMock)

const props = () => ({
  iframeRef: createRef<HTMLIFrameElement>(),
  status: 'ready' as const,
  aor: 'operator-c22-u4',
})

describe('OperatorPhonePanel', () => {
  beforeEach(() => {
    vi.resetModules()
    constantsMock.OPERATOR_PHONE_CONFIGURED = true
  })

  it('mounts the hidden iframe at the configured phone origin', async () => {
    const { OperatorPhonePanel } = await import('../components/OperatorPhonePanel')
    const { container } = render(<OperatorPhonePanel {...props()} />)

    const iframe = container.querySelector('iframe')
    expect(iframe).not.toBeNull()
    expect(iframe?.getAttribute('src')).toBe('https://webrtc.example.test')
    expect(screen.queryByText(/operator-c22-u4/)).not.toBeNull()
  })

  it('renders nothing when no phone origin is configured', async () => {
    constantsMock.OPERATOR_PHONE_CONFIGURED = false
    const { OperatorPhonePanel } = await import('../components/OperatorPhonePanel')
    const { container } = render(<OperatorPhonePanel {...props()} />)

    expect(container.querySelector('iframe')).toBeNull()
    expect(container).toBeEmptyDOMElement()
  })
})
