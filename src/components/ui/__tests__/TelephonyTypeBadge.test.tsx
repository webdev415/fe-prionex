/**
 * Tests for the shared TelephonyTypeBadge component (KAN-482).
 * The i18n mock in src/test/setup.ts returns translation keys verbatim
 * when no entry exists, so we assert against keys for the badge label.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { TelephonyTypeBadge } from '../TelephonyTypeBadge'

describe('TelephonyTypeBadge', () => {
  it('renders the White label for outbound white calls', () => {
    render(<TelephonyTypeBadge type="white" direction="outbound" />)
    expect(screen.getByText('pages.actionAnalysis.telephonyType.white')).toBeInTheDocument()
  })

  it('renders the Grey label for outbound grey calls', () => {
    render(<TelephonyTypeBadge type="grey" direction="outbound" />)
    expect(screen.getByText('pages.actionAnalysis.telephonyType.grey')).toBeInTheDocument()
  })

  it('renders an em-dash for unknown', () => {
    render(<TelephonyTypeBadge type="unknown" direction="outbound" />)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByText('pages.actionAnalysis.telephonyType.white')).not.toBeInTheDocument()
  })

  it('renders an em-dash for inbound regardless of stored type', () => {
    // Defense-in-depth: even if a stray inbound row carries 'white' or
    // 'grey' via DB drift, the UI must still hide it.
    const { rerender } = render(<TelephonyTypeBadge type="white" direction="inbound" />)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByText('pages.actionAnalysis.telephonyType.white')).not.toBeInTheDocument()

    rerender(<TelephonyTypeBadge type="grey" direction="inbound" />)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByText('pages.actionAnalysis.telephonyType.grey')).not.toBeInTheDocument()
  })

  it('renders an em-dash when type is null/undefined', () => {
    render(<TelephonyTypeBadge type={null} direction="outbound" />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
