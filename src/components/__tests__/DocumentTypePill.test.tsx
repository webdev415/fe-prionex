/**
 * Unit tests for the shared DocumentTypePill.
 *
 * The pill mirrors ``TagBadge``: a tinted background (hex + '20'
 * alpha suffix), a solid border in the source hex, solid text in the
 * same hex, and a small colored dot on the left.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DocumentTypePill } from '../DocumentTypePill'

function inlineStyle(el: HTMLElement) {
  return {
    background: el.style.backgroundColor,
    color: el.style.color,
    border: el.style.borderColor,
  }
}

describe('DocumentTypePill', () => {
  it('renders the supplied name', () => {
    render(<DocumentTypePill name="Insurance" hex="#22C55E" />)
    expect(screen.getByText('Insurance')).toBeInTheDocument()
  })

  it('applies the tinted background + solid border + solid text using the source hex', () => {
    render(<DocumentTypePill name="Passport" hex="#3B82F6" />)
    // The name lives inside a nested span; walk up to the pill wrapper
    // which owns the color styles.
    const nameSpan = screen.getByText('Passport')
    const pill = nameSpan.parentElement as HTMLElement
    const { background, color, border } = inlineStyle(pill)
    // jsdom lowercases the hex and normalises `#RRGGBBAA` to rgba(),
    // so compare on non-empty + distinct values rather than exact match.
    expect(background).not.toBe('')
    expect(color).not.toBe('')
    expect(border).not.toBe('')
    // Border and text should match (both are the raw hex); background
    // is the tinted variant and must differ from them.
    expect(border).toBe(color)
    expect(background).not.toBe(border)
  })

  it('renders a small colored dot sibling to the name label', () => {
    render(<DocumentTypePill name="Contract" hex="#10B981" />)
    const nameSpan = screen.getByText('Contract')
    const pill = nameSpan.parentElement as HTMLElement
    // The dot is the first child span; the name is the second.
    const dot = pill.querySelector('span:first-child') as HTMLElement
    expect(dot).toBeInTheDocument()
    expect(dot).not.toBe(nameSpan)
    expect(dot.style.backgroundColor).not.toBe('')
    // Dot uses the pure hex, so it should match the border/text color
    // (which are also the pure hex) — distinguishing the dot from the
    // tinted pill background.
    const { background: pillBg } = inlineStyle(pill)
    expect(dot.style.backgroundColor).not.toBe(pillBg)
  })

  it('produces distinct pill styles for distinct hex inputs', () => {
    const { unmount } = render(<DocumentTypePill name="A" hex="#FF0000" />)
    const redPill = screen.getByText('A').parentElement as HTMLElement
    const redColor = redPill.style.color
    unmount()
    render(<DocumentTypePill name="A" hex="#00FF00" />)
    const greenPill = screen.getByText('A').parentElement as HTMLElement
    expect(greenPill.style.color).not.toBe(redColor)
  })

  it('adds italic + opacity class when isHidden is true', () => {
    render(<DocumentTypePill name="Old" hex="#64748B" isHidden />)
    const nameSpan = screen.getByText('Old')
    const pill = nameSpan.parentElement as HTMLElement
    expect(pill.className).toMatch(/italic/)
    expect(pill.className).toMatch(/opacity/)
  })

  it('omits the italic + opacity class when isHidden is falsy', () => {
    render(<DocumentTypePill name="Fresh" hex="#64748B" />)
    const nameSpan = screen.getByText('Fresh')
    const pill = nameSpan.parentElement as HTMLElement
    expect(pill.className).not.toMatch(/italic/)
    expect(pill.className).not.toMatch(/opacity/)
  })

  it('handles edge-case colors (pure white and pure black) without crashing', () => {
    const { unmount } = render(<DocumentTypePill name="W" hex="#FFFFFF" />)
    expect(screen.getByText('W')).toBeInTheDocument()
    unmount()
    render(<DocumentTypePill name="B" hex="#000000" />)
    expect(screen.getByText('B')).toBeInTheDocument()
  })
})
