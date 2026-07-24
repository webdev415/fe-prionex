/**
 * AiSettingsPage smoke test — the three sections are mocked (each has its
 * own coverage under src/features/aiSettings and src/features/quality); this
 * only checks the page renders its heading and wires up all three.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AiSettingsPage } from '../AiSettingsPage'

vi.mock('@/features/aiSettings/components/AssistantSettingsSection', () => ({
  AssistantSettingsSection: () => <div data-testid="mock-assistant-settings-section" />,
}))
vi.mock('@/features/aiSettings/components/AssistantAccessSection', () => ({
  AssistantAccessSection: () => <div data-testid="mock-assistant-access-section" />,
}))
vi.mock('@/features/quality/components/CallQaSettingsSection', () => ({
  CallQaSettingsSection: () => <div data-testid="mock-call-qa-settings-section" />,
}))

describe('AiSettingsPage', () => {
  it('renders the heading and all three sections', () => {
    render(<AiSettingsPage />)

    expect(screen.getByText('pages.aiSettings.title')).toBeInTheDocument()
    expect(screen.getByText('pages.aiSettings.helper')).toBeInTheDocument()
    expect(screen.getByTestId('mock-assistant-settings-section')).toBeInTheDocument()
    expect(screen.getByTestId('mock-call-qa-settings-section')).toBeInTheDocument()
    expect(screen.getByTestId('mock-assistant-access-section')).toBeInTheDocument()
  })
})
