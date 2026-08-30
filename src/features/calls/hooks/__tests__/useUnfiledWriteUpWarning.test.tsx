/**
 * The handover warning, driven through a real parent/child pair.
 *
 * The first version of this feature was dead on arrival and its unit tests
 * still passed: React flushes a child's effects before its parent's, so the
 * newly mounted window reported its own empty draft before the parent read the
 * answer, and the warning could never fire. Nothing here mocks that ordering —
 * a child component reports, exactly as the call window does.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import { useEffect } from 'react'
import { toast } from 'sonner'

import { useUnfiledWriteUpWarning } from '../useUnfiledWriteUpWarning'

vi.mock('sonner', () => ({
  toast: { warning: vi.fn(), success: vi.fn(), error: vi.fn() },
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}))

/** Stands in for the call window: reports its own draft state on mount. */
function Window({
  callId,
  unfiled,
  report,
}: {
  callId: string
  unfiled: boolean
  report: (callId: string, unfiled: boolean) => void
}) {
  useEffect(() => {
    report(callId, unfiled)
  }, [callId, unfiled, report])
  return null
}

function Layout({ callId, unfiled }: { callId: string | null; unfiled: boolean }) {
  const report = useUnfiledWriteUpWarning(callId)
  // Keyed per call, exactly as DashboardLayout keys the container — which is
  // what makes the successor mount and report inside the same commit.
  return callId ? <Window key={callId} callId={callId} unfiled={unfiled} report={report} /> : null
}

describe('warning that a write-up was never filed', () => {
  beforeEach(() => vi.clearAllMocks())

  it('warns when the next call takes over an unfiled write-up', () => {
    const { rerender } = render(<Layout callId="call-1" unfiled />)
    // The successor mounts and reports its own empty draft in the same commit,
    // before the parent effect runs. That is the whole trap.
    rerender(<Layout callId="call-2" unfiled={false} />)

    expect(toast.warning).toHaveBeenCalledTimes(1)
  })

  it('says nothing when the previous call was written up', () => {
    const { rerender } = render(<Layout callId="call-1" unfiled={false} />)
    rerender(<Layout callId="call-2" unfiled={false} />)

    expect(toast.warning).not.toHaveBeenCalled()
  })

  it('says nothing when the window simply closes', () => {
    const { rerender } = render(<Layout callId="call-1" unfiled />)
    rerender(<Layout callId={null} unfiled={false} />)

    // Closing a window is a decision, not a loss to report back to the operator.
    expect(toast.warning).not.toHaveBeenCalled()
  })

  it('warns once, not on every later render', () => {
    const { rerender } = render(<Layout callId="call-1" unfiled />)
    rerender(<Layout callId="call-2" unfiled={false} />)
    rerender(<Layout callId="call-2" unfiled={false} />)

    expect(toast.warning).toHaveBeenCalledTimes(1)
  })
})
