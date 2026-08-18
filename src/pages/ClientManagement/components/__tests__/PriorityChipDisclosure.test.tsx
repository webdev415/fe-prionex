/**
 * The priority chip as a disclosure control (KAN-786 follow-up).
 *
 * The client card's priority chip now opens the v3 priority panel beneath it.
 * The chip components stay presentational — they take a `trailing` slot and
 * know nothing about disclosure — so what is worth pinning here is that the
 * slot renders, and that the four other places using these chips are not
 * dragged into interactivity by the change.
 */
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { V3BucketBadge } from '@/pages/OperatorWorkList/components/V3BucketBadge'
import { NotScoredBadge } from '../NotScoredBadge'

describe('priority chips', () => {
  it('render nothing extra when no trailing slot is passed', () => {
    // The list, the work list and the priority cards all render these chips as
    // plain labels; adding the slot must not give them an arrow or a button.
    const { container } = render(<V3BucketBadge bucket="CRIT" />)
    expect(screen.getByText('Call first')).toBeInTheDocument()
    expect(container.querySelector('button')).toBeNull()
    expect(container.querySelector('svg')).toBeNull()
  })

  it('render the trailing slot inside the pill', () => {
    render(<V3BucketBadge bucket="CRIT" trailing={<span>▾</span>} />)
    const pill = screen.getByText('Call first')
    // Inside the pill, not a sibling of it — the arrow reads as part of the
    // chip rather than as loose decoration next to it.
    expect(pill).toHaveTextContent('▾')
  })

  it('render the trailing slot on the not-scored chip too', () => {
    // Not-scored clients still have a panel to disclose (it explains why they
    // have no priority), so this chip needs the arrow as well.
    render(<NotScoredBadge trailing={<span>▾</span>} />)
    expect(screen.getByText(/Not scored/)).toHaveTextContent('▾')
  })
})

/**
 * Mirrors how ClientDetailPage wires the chip to the panel: a button around the
 * badge, with the arrow in the badge's slot.
 */
function Disclosure({ onToggle }: { onToggle?: () => void } = {}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="panel"
        onClick={() => {
          setOpen(!open)
          onToggle?.()
        }}
      >
        <V3BucketBadge bucket="CRIT" trailing={<span aria-hidden="true">▾</span>} />
      </button>
      {open && <div id="panel">v3 Priority</div>}
    </>
  )
}

describe('chip disclosure wiring', () => {
  it('starts collapsed and toggles the panel', async () => {
    const user = userEvent.setup()
    render(<Disclosure />)

    const chip = screen.getByRole('button')
    expect(chip).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('v3 Priority')).not.toBeInTheDocument()

    await user.click(chip)
    expect(chip).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('v3 Priority')).toBeInTheDocument()

    await user.click(chip)
    expect(screen.queryByText('v3 Priority')).not.toBeInTheDocument()
  })

  it('is reachable by keyboard', async () => {
    // The chip was a span before this change; as a control it has to be
    // focusable and operable without a mouse.
    const onToggle = vi.fn()
    const user = userEvent.setup()
    render(<Disclosure onToggle={onToggle} />)

    await user.tab()
    expect(screen.getByRole('button')).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onToggle).toHaveBeenCalled()
  })
})
