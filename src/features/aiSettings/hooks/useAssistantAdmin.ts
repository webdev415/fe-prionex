/**
 * Write hooks for the assistant admin section.
 *
 * All three endpoints answer with the `prompts` object alone, so every
 * success MERGES it into the cached overview — replacing the cache entry
 * outright would drop `config` (model, flags, limits) and blank the
 * read-only internals card rendered off the same key.
 *
 * Merging beats invalidating: the server state is already in hand, and a
 * refetch would briefly repaint the pre-edit value. If the cache is somehow
 * empty (a write racing the very first load), there is no `config` to merge
 * into, so that case falls back to a refetch.
 *
 * Only the skill toggle is optimistic. A switch that waits a round trip
 * before moving reads as broken, and the rollback is exact (the whole
 * previous overview is restored). Prompt and persona edits keep the user's
 * own text on screen while saving, so there is nothing to anticipate.
 */
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'

import {
  updateAssistantPersona,
  updateAssistantPromptAppend,
  updateAssistantSkill,
  type PersonaPatch,
} from '../api/assistantAdminService'
import {
  assistantOverviewKey,
  type AssistantOverview,
  type OverviewPrompts,
} from '../api/assistantOverviewService'

function applyPrompts(queryClient: QueryClient, prompts: OverviewPrompts) {
  const current = queryClient.getQueryData<AssistantOverview>(assistantOverviewKey)

  if (!current) {
    void queryClient.invalidateQueries({ queryKey: assistantOverviewKey })
    return
  }

  queryClient.setQueryData<AssistantOverview>(assistantOverviewKey, { ...current, prompts })
}

interface SkillToggleVars {
  name: string
  enabled: boolean
}

interface SkillToggleContext {
  previous?: AssistantOverview
}

export function useUpdateAssistantSkill() {
  const queryClient = useQueryClient()

  return useMutation<OverviewPrompts, unknown, SkillToggleVars, SkillToggleContext>({
    mutationFn: ({ name, enabled }) => updateAssistantSkill(name, enabled),
    onMutate: async ({ name, enabled }) => {
      // Without this an in-flight overview refetch could land after the
      // optimistic write and resurrect the pre-toggle value.
      await queryClient.cancelQueries({ queryKey: assistantOverviewKey })
      const previous = queryClient.getQueryData<AssistantOverview>(assistantOverviewKey)

      if (previous) {
        queryClient.setQueryData<AssistantOverview>(assistantOverviewKey, {
          ...previous,
          prompts: {
            ...previous.prompts,
            skills: previous.prompts.skills.map((skill) =>
              skill.name === name ? { ...skill, enabled } : skill
            ),
          },
        })
      }

      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(assistantOverviewKey, context.previous)
      }
    },
    onSuccess: (prompts) => applyPrompts(queryClient, prompts),
  })
}

export function useUpdateAssistantPromptAppend() {
  const queryClient = useQueryClient()

  return useMutation<OverviewPrompts, unknown, string>({
    mutationFn: (template) => updateAssistantPromptAppend(template),
    onSuccess: (prompts) => applyPrompts(queryClient, prompts),
  })
}

export function useUpdateAssistantPersona() {
  const queryClient = useQueryClient()

  return useMutation<OverviewPrompts, unknown, PersonaPatch>({
    mutationFn: (patch) => updateAssistantPersona(patch),
    onSuccess: (prompts) => applyPrompts(queryClient, prompts),
  })
}
