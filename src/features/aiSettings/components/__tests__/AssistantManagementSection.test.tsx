/**
 * AssistantManagementSection tests — the editable half of the AI settings
 * page (persona / prompt append / skills).
 *
 * The overview GET and the three admin PUTs are mocked at the API layer
 * (src/test/mocks/*); the hooks, the react-query cache and the components
 * are real, so a test that says "the toggle updates state" is actually
 * exercising the optimistic write + response reseed, not a stub.
 *
 * The i18n mock in src/test/setup.ts returns the key for anything it does
 * not know, so assertions on our strings assert keys.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AssistantManagementSection } from '../AssistantManagementSection'
import { assistantOverviewTestMocks } from '@/test/mocks/assistantOverview'
import { assistantAdminTestMocks } from '@/test/mocks/assistantAdmin'
import { useHasPermission } from '@/hooks'
import type { AssistantOverview } from '../../api/assistantOverviewService'

const { mockGetAssistantOverview } = assistantOverviewTestMocks
const { mockUpdateAssistantSkill, mockUpdateAssistantPromptAppend, mockUpdateAssistantPersona } =
  assistantAdminTestMocks

const authState = { isAuthenticated: true }

vi.mock('@/hooks', () => ({
  useHasPermission: vi.fn(),
  useHasAnyPermission: vi.fn(() => false),
  useHasAllPermissions: vi.fn(() => false),
}))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { isAuthenticated: boolean }) => unknown) => selector(authState),
}))
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const mockUseHasPermission = vi.mocked(useHasPermission)

function overview(): AssistantOverview {
  return {
    config: {
      model: '31b-thinking',
      commit: 'abc1234',
      flags: {
        thinking_mode_enabled: true,
        skills_enabled: true,
        hooks_enabled: false,
        crm_mode: true,
        memory_enabled: true,
        knowledge_enabled: false,
        query_router_enabled: true,
        answer_eval_enabled: false,
        tts_normalize_enabled: true,
        corrector_enabled: false,
        rbac_scope_enabled: true,
        call_qa_enabled: true,
      },
      limits: {
        max_turns: 12,
        turn_deadline_s: 45,
        sql_max_rows: 500,
        prompt_append_limit: 2000,
      },
      manifest: { skills: ['draft_tools'] },
    },
    prompts: {
      persona: {
        name: 'Роша',
        role: 'operator assistant',
        tone: 'formal',
        language: 'uk',
        apply: 'gw-restart',
      },
      prompt0_append: {
        text: 'Базовая надстройка',
        length: 18,
        limit: 120,
        apply: 'hot-reload',
      },
      skills: [
        {
          name: 'search_clients',
          text: 'skill body 1',
          apply: 'hot-reload',
          enabled: true,
          description: 'Поиск клиентов',
        },
        { name: 'draft_tools', text: 'skill body 2', apply: 'gw-restart', enabled: false },
      ],
      knowledge: { apply: 'reseed', files: ['assistant_knowledge.md'] },
    },
  }
}

function httpError(status: number, data: unknown) {
  return Object.assign(new Error(`HTTP ${status}`), { response: { status, data } })
}

function renderSection() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <AssistantManagementSection />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  mockGetAssistantOverview.mockReset()
  mockUpdateAssistantSkill.mockReset()
  mockUpdateAssistantPromptAppend.mockReset()
  mockUpdateAssistantPersona.mockReset()
  mockUseHasPermission.mockReset()
  authState.isAuthenticated = true
  mockUseHasPermission.mockReturnValue(true)
  mockGetAssistantOverview.mockResolvedValue(overview())
})

describe('AssistantManagementSection', () => {
  it('stays hidden without the manage_ai_settings permission', () => {
    mockUseHasPermission.mockReturnValue(false)
    renderSection()
    expect(screen.queryByTestId('assistant-management-section')).not.toBeInTheDocument()
  })

  it('lists every skill, marking the disabled one instead of hiding it', async () => {
    renderSection()

    await waitFor(() => expect(screen.getByTestId('assistant-skills-card')).toBeInTheDocument())

    expect(screen.getByTestId('assistant-skill-row-search_clients')).toBeInTheDocument()
    expect(screen.getByTestId('assistant-skill-row-draft_tools')).toBeInTheDocument()
    expect(screen.getByText('Поиск клиентов')).toBeInTheDocument()

    // Only the disabled skill carries the badge.
    expect(screen.getByTestId('assistant-skill-off-badge-draft_tools')).toBeInTheDocument()
    expect(screen.queryByTestId('assistant-skill-off-badge-search_clients')).not.toBeInTheDocument()

    const switches = screen.getAllByRole('switch')
    expect(switches[0]).toHaveAttribute('aria-checked', 'true')
    expect(switches[1]).toHaveAttribute('aria-checked', 'false')
  })

  it('sends the PUT on toggle and repaints from the response', async () => {
    const after = overview()
    after.prompts.skills[0].enabled = false
    mockUpdateAssistantSkill.mockResolvedValue(after)

    renderSection()
    await waitFor(() => expect(screen.getByTestId('assistant-skills-card')).toBeInTheDocument())

    await userEvent.click(screen.getAllByRole('switch')[0])

    await waitFor(() =>
      expect(mockUpdateAssistantSkill).toHaveBeenCalledWith('search_clients', false)
    )
    await waitFor(() =>
      expect(screen.getByTestId('assistant-skill-off-badge-search_clients')).toBeInTheDocument()
    )
    expect(screen.getAllByRole('switch')[0]).toHaveAttribute('aria-checked', 'false')
  })

  it('rolls the toggle back when the PUT fails', async () => {
    mockUpdateAssistantSkill.mockRejectedValue(
      httpError(404, { detail: { code: 'unknown_skill' } })
    )

    renderSection()
    await waitFor(() => expect(screen.getByTestId('assistant-skills-card')).toBeInTheDocument())

    await userEvent.click(screen.getAllByRole('switch')[0])

    await waitFor(() => expect(mockUpdateAssistantSkill).toHaveBeenCalled())
    await waitFor(() =>
      expect(screen.getAllByRole('switch')[0]).toHaveAttribute('aria-checked', 'true')
    )
    expect(screen.queryByTestId('assistant-skill-off-badge-search_clients')).not.toBeInTheDocument()
  })

  it('shows the server 422 text and keeps the typed prompt', async () => {
    mockUpdateAssistantPromptAppend.mockRejectedValue(
      httpError(422, { detail: 'Шаблон містить заборонену інструкцію' })
    )

    renderSection()
    await waitFor(() =>
      expect(screen.getByTestId('assistant-prompt-append-card')).toBeInTheDocument()
    )

    const textarea = screen.getByTestId('assistant-prompt-append-input')
    await userEvent.clear(textarea)
    await userEvent.type(textarea, 'Новый текст')

    await userEvent.click(screen.getByText('pages.aiSettings.management.prompt.save'))

    await waitFor(() =>
      expect(screen.getByText('Шаблон містить заборонену інструкцію')).toBeInTheDocument()
    )
    expect(textarea).toHaveValue('Новый текст')
  })

  it('counts characters against the server-supplied limit and blocks saving past it', async () => {
    renderSection()
    await waitFor(() =>
      expect(screen.getByTestId('assistant-prompt-append-card')).toBeInTheDocument()
    )

    // limit 120 comes from prompt0_append.limit, not from config.limits
    // (2000) and not from a constant in the component.
    expect(screen.getByTestId('assistant-prompt-append-counter')).toHaveTextContent('18/120')

    const textarea = screen.getByTestId('assistant-prompt-append-input')
    await userEvent.clear(textarea)
    await userEvent.paste('x'.repeat(121))

    expect(screen.getByTestId('assistant-prompt-append-counter')).toHaveTextContent('121/120')
    expect(
      screen.getByText('pages.aiSettings.management.prompt.save').closest('button')
    ).toBeDisabled()
    expect(mockUpdateAssistantPromptAppend).not.toHaveBeenCalled()
  })

  it('saves the prompt and repaints from the response', async () => {
    const after = overview()
    after.prompts.prompt0_append.text = 'Новый текст'
    mockUpdateAssistantPromptAppend.mockResolvedValue(after)

    renderSection()
    await waitFor(() =>
      expect(screen.getByTestId('assistant-prompt-append-card')).toBeInTheDocument()
    )

    const textarea = screen.getByTestId('assistant-prompt-append-input')
    await userEvent.clear(textarea)
    await userEvent.type(textarea, 'Новый текст')
    await userEvent.click(screen.getByText('pages.aiSettings.management.prompt.save'))

    await waitFor(() => expect(mockUpdateAssistantPromptAppend).toHaveBeenCalledWith('Новый текст'))
    await waitFor(() =>
      expect(
        screen.getByText('pages.aiSettings.management.prompt.save').closest('button')
      ).toBeDisabled()
    )
  })

  it('patches only the persona fields that changed', async () => {
    mockUpdateAssistantPersona.mockResolvedValue(overview())

    renderSection()
    await waitFor(() => expect(screen.getByTestId('assistant-persona-card')).toBeInTheDocument())

    const tone = screen.getByTestId('assistant-persona-field-tone')
    await userEvent.clear(tone)
    await userEvent.type(tone, 'friendly')
    await userEvent.click(screen.getByText('pages.aiSettings.management.persona.save'))

    await waitFor(() =>
      expect(mockUpdateAssistantPersona).toHaveBeenCalledWith({ tone: 'friendly' })
    )
  })

  it('surfaces a plain unavailable message when the brain is down', async () => {
    mockUpdateAssistantPersona.mockRejectedValue(
      httpError(503, { detail: { code: 'brain_unreachable' } })
    )

    renderSection()
    await waitFor(() => expect(screen.getByTestId('assistant-persona-card')).toBeInTheDocument())

    const tone = screen.getByTestId('assistant-persona-field-tone')
    await userEvent.clear(tone)
    await userEvent.type(tone, 'friendly')
    await userEvent.click(screen.getByText('pages.aiSettings.management.persona.save'))

    await waitFor(() =>
      expect(screen.getByTestId('assistant-persona-error')).toHaveTextContent(
        'pages.aiSettings.management.errors.unavailable'
      )
    )
  })

  it('replaces the editors with one warning card when the overview itself fails', async () => {
    mockGetAssistantOverview.mockRejectedValue(
      httpError(502, { detail: { code: 'brain_unreachable' } })
    )

    renderSection()

    await waitFor(() =>
      expect(screen.getByTestId('assistant-management-unavailable')).toBeInTheDocument()
    )
    expect(screen.queryByTestId('assistant-skills-card')).not.toBeInTheDocument()
    expect(screen.queryByTestId('assistant-prompt-append-card')).not.toBeInTheDocument()
    expect(screen.queryByTestId('assistant-persona-card')).not.toBeInTheDocument()
  })
})
