/**
 * AssistantManagementSection tests — the editable half of the AI settings
 * page (persona / prompt append / skills).
 *
 * The overview GET and the three admin PUTs are mocked at the API layer
 * (src/test/mocks/*); the hooks, the react-query cache and the components
 * are real, so a test that says "the toggle updates state" is actually
 * exercising the optimistic write + response merge, not a stub.
 *
 * The PUT stubs resolve with a bare `prompts` object, matching the bridge
 * (api-prionex#1113) — the endpoints do NOT echo the `{config, prompts}`
 * envelope that GET /overview returns.
 *
 * The i18n mock in src/test/setup.ts returns the key for anything it does
 * not know, so assertions on our strings assert keys.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AssistantManagementSection } from '../AssistantManagementSection'
import { AssistantInternalsSection } from '../AssistantInternalsSection'
import { assistantOverviewTestMocks } from '@/test/mocks/assistantOverview'
import { assistantAdminTestMocks } from '@/test/mocks/assistantAdmin'
import { useHasPermission } from '@/hooks'
import type { AssistantOverview, OverviewPrompts } from '../../api/assistantOverviewService'

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

function prompts(): OverviewPrompts {
  return {
    persona: {
      name: 'Роша',
      role: 'operator assistant',
      tone: 'formal',
      language: 'uk',
      apply: 'gw-restart',
      overridden: false,
    },
    prompt0_append: {
      template: 'Ти — {name}, {role}.',
      text: 'Ти — Роша, operator assistant.',
      length: 30,
      limit: 4000,
      apply: 'hot-reload',
      overridden: true,
      error: null,
    },
    skills: [
      { name: 'search_clients', text: 'skill body 1', apply: 'hot-reload', enabled: true },
      { name: 'draft_tools', text: 'skill body 2', apply: 'gw-restart', enabled: false },
    ],
    knowledge: { apply: 'reseed', files: ['assistant_knowledge.md'] },
  }
}

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
        prompt_append_limit: 4000,
      },
      manifest: { skills: ['draft_tools'] },
    },
    prompts: prompts(),
  }
}

function httpError(status: number, data: unknown) {
  return Object.assign(new Error(`HTTP ${status}`), { response: { status, data } })
}

function renderSection(extra?: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <AssistantManagementSection />
      {extra}
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

    // Only the disabled skill carries the badge.
    expect(screen.getByTestId('assistant-skill-off-badge-draft_tools')).toBeInTheDocument()
    expect(screen.queryByTestId('assistant-skill-off-badge-search_clients')).not.toBeInTheDocument()

    const switches = screen.getAllByRole('switch')
    expect(switches[0]).toHaveAttribute('aria-checked', 'true')
    expect(switches[1]).toHaveAttribute('aria-checked', 'false')
  })

  it('sends the PUT on toggle and repaints from the response', async () => {
    const after = prompts()
    after.skills[0].enabled = false
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

  it('keeps config intact when merging a write response', async () => {
    // The PUTs answer with `prompts` alone. Overwriting the cache entry with
    // that body would drop `config` and blank the internals card, which
    // reads the same query key.
    mockUpdateAssistantPersona.mockResolvedValue(prompts())

    renderSection(<AssistantInternalsSection />)
    await waitFor(() => expect(screen.getByTestId('assistant-persona-card')).toBeInTheDocument())
    expect(screen.getByText('31b-thinking')).toBeInTheDocument()

    const tone = screen.getByTestId('assistant-persona-field-tone')
    await userEvent.clear(tone)
    await userEvent.type(tone, 'friendly')
    await userEvent.click(screen.getByText('pages.aiSettings.management.persona.save'))

    await waitFor(() => expect(mockUpdateAssistantPersona).toHaveBeenCalled())
    expect(screen.getByTestId('assistant-internals-config')).toBeInTheDocument()
    expect(screen.getByText('31b-thinking')).toBeInTheDocument()
  })

  it('rolls the toggle back when the PUT fails', async () => {
    mockUpdateAssistantSkill.mockRejectedValue(
      httpError(404, { detail: 'навык не найден: nosuch' })
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

  it('edits and sends the raw template, not the rendered text', async () => {
    const after = prompts()
    after.prompt0_append.template = 'Новый шаблон'
    mockUpdateAssistantPromptAppend.mockResolvedValue(after)

    renderSection()
    await waitFor(() =>
      expect(screen.getByTestId('assistant-prompt-append-card')).toBeInTheDocument()
    )

    // The editor is seeded from `template` — the rendered `text` would bake
    // the substituted persona name into the stored template on save.
    const textarea = screen.getByTestId('assistant-prompt-append-input')
    expect(textarea).toHaveValue('Ти — {name}, {role}.')

    await userEvent.clear(textarea)
    await userEvent.type(textarea, 'Новый шаблон')
    await userEvent.click(screen.getByText('pages.aiSettings.management.prompt.save'))

    await waitFor(() =>
      expect(mockUpdateAssistantPromptAppend).toHaveBeenCalledWith('Новый шаблон')
    )
  })

  it('shows the server 422 text and keeps the typed prompt', async () => {
    mockUpdateAssistantPromptAppend.mockRejectedValue(
      httpError(422, { detail: 'надстройка длиннее лимита: 4200 > 4000' })
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
      expect(screen.getByText('надстройка длиннее лимита: 4200 > 4000')).toBeInTheDocument()
    )
    expect(textarea).toHaveValue('Новый текст')
  })

  it('reports the rendered length from the server and never blocks Save locally', async () => {
    renderSection()
    await waitFor(() =>
      expect(screen.getByTestId('assistant-prompt-append-card')).toBeInTheDocument()
    )

    // 30 is the RENDERED length reported by the brain, not the 20-character
    // template in the box — the limit is checked after substitution.
    expect(screen.getByTestId('assistant-prompt-append-counter')).toHaveTextContent('30/4000')

    const textarea = screen.getByTestId('assistant-prompt-append-input')
    await userEvent.clear(textarea)
    await userEvent.paste('x'.repeat(4200))

    // Over the limit by any local measure, yet Save stays live: only the
    // brain can measure the render, and it answers 422 with a reason.
    expect(
      screen.getByText('pages.aiSettings.management.prompt.save').closest('button')
    ).toBeEnabled()
    expect(screen.getByTestId('assistant-prompt-append-counter')).toHaveTextContent(
      'pages.aiSettings.management.prompt.counterStale'
    )
  })

  it('surfaces the render error when the stored template is broken', async () => {
    const broken = overview()
    broken.prompts.prompt0_append.error = "KeyError: 'nome'"
    mockGetAssistantOverview.mockResolvedValue(broken)

    renderSection()

    await waitFor(() =>
      expect(screen.getByTestId('assistant-prompt-append-render-error')).toBeInTheDocument()
    )
    expect(
      within(screen.getByTestId('assistant-prompt-append-render-error')).getByText(
        "KeyError: 'nome'"
      )
    ).toBeInTheDocument()
  })

  it('patches only the persona fields that changed', async () => {
    mockUpdateAssistantPersona.mockResolvedValue(prompts())

    renderSection()
    await waitFor(() => expect(screen.getByTestId('assistant-persona-card')).toBeInTheDocument())

    const tone = screen.getByTestId('assistant-persona-field-tone')
    await userEvent.clear(tone)
    await userEvent.type(tone, 'friendly')
    await userEvent.click(screen.getByText('pages.aiSettings.management.persona.save'))

    // Derived fields must not ride along — the endpoint rejects extras.
    await waitFor(() =>
      expect(mockUpdateAssistantPersona).toHaveBeenCalledWith({ tone: 'friendly' })
    )
  })

  it('surfaces a plain unavailable message when the brain is down', async () => {
    mockUpdateAssistantPersona.mockRejectedValue(
      httpError(502, { detail: { code: 'brain_unreachable' } })
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
