/**
 * Write hooks for the assistant admin section.
 *
 * All three endpoints answer with a full overview body, so every success
 * seeds `assistantOverviewKey` from the response rather than invalidating:
 * the server state is already in hand, and a refetch would briefly show the
 * pre-edit value through the read-only cards rendered from the same key.
 *
 * Only the skill toggle is optimistic. A switch that waits a round trip
 * before moving reads as broken, and the rollback is exact (the whole
 * previous overview is restored). Prompt and persona edits keep the user's
 * own text on screen while saving, so there is nothing to anticipate.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  updateAssistantPersona,
  updateAssistantPromptAppend,
  updateAssistantSkill,
  type PersonaPatch,
} from '../api/assistantAdminService'
import { assistantOverviewKey, type AssistantOverview } from '../api/assistantOverviewService'

interface SkillToggleVars {
  name: string
  enabled: boolean
}

interface SkillToggleContext {
  previous?: AssistantOverview
}

export function useUpdateAssistantSkill() {
  const queryClient = useQueryClient()

  return useMutation<AssistantOverview, unknown, SkillToggleVars, SkillToggleContext>({
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
    onSuccess: (data) => {
      queryClient.setQueryData(assistantOverviewKey, data)
    },
  })
}

export function useUpdateAssistantPromptAppend() {
  const queryClient = useQueryClient()

  return useMutation<AssistantOverview, unknown, string>({
    mutationFn: (text) => updateAssistantPromptAppend(text),
    onSuccess: (data) => {
      queryClient.setQueryData(assistantOverviewKey, data)
    },
  })
}

export function useUpdateAssistantPersona() {
  const queryClient = useQueryClient()

  return useMutation<AssistantOverview, unknown, PersonaPatch>({
    mutationFn: (patch) => updateAssistantPersona(patch),
    onSuccess: (data) => {
      queryClient.setQueryData(assistantOverviewKey, data)
    },
  })
}
