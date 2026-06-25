import type { TAChainStep, TAChainStepIn } from '@/features/taChains/api/types'

/**
 * Map a chain's persisted steps (`TAChainStep`) into the editable input shape
 * (`TAChainStepIn`) used to seed the edit form's state.
 *
 * Every field the backend round-trips MUST be copied here. In particular
 * `show_closed_credits`: if it is omitted, editing the chain — even just
 * renaming it — re-submits the steps without the flag, the backend
 * `TAChainStepIn` schema defaults it to `false`, and the value is silently
 * wiped on every credit step (the checkbox shows unchecked, so the admin never
 * sees the loss; operators then stop seeing closed loans in the picker).
 * See audit fe-14 / "silent data loss".
 */
export function taChainStepsToInput(steps?: TAChainStep[]): TAChainStepIn[] {
  return (
    steps?.map((s) => ({
      target_action_id: s.target_action_id,
      is_required: s.is_required,
      delay_minutes: s.delay_minutes,
      not_in_the_past: s.not_in_the_past,
      contact_source: s.contact_source,
      show_closed_credits: s.show_closed_credits ?? false,
    })) ?? []
  )
}
