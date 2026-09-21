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
/** A known field type that is not the one this flag needs. */
function dropsFlag(fieldType: string | null | undefined, needed: 'date' | 'amount') {
  return !!fieldType && fieldType !== needed
}

export function taChainStepsToInput(steps?: TAChainStep[]): TAChainStepIn[] {
  return (
    steps?.map((s) => ({
      target_action_id: s.target_action_id,
      is_required: s.is_required,
      delay_minutes: s.delay_minutes,
      not_in_the_past: s.not_in_the_past,
      contact_source: s.contact_source,
      show_closed_credits: s.show_closed_credits ?? false,
      // KAN-1069. Every field here is copied one by one, so a new step setting
      // that is not listed silently reads back as its default — the chain saves
      // correctly and reopens showing the boxes unticked, which is what the
      // admin reports as "it did not save".
      //
      // A flag the step's CURRENT type cannot carry is dropped on the way in.
      // The editor clears these on retype now, but a chain saved before that
      // fix can still hold one, and such a flag is invisible — its checkbox
      // only renders for date / amount — while the server refuses the chain on
      // save. Dropping it here means opening the chain is enough to repair it.
      //
      // Only when the type is KNOWN and wrong. `target_action_field_type` is
      // nullable, and throwing a flag away because the type did not come back
      // would turn a thin response into silent data loss — the failure the
      // comment above is about, arrived at from the other side.
      is_promise_date: dropsFlag(s.target_action_field_type, 'date')
        ? false
        : (s.is_promise_date ?? false),
      is_promise_amount: dropsFlag(s.target_action_field_type, 'amount')
        ? false
        : (s.is_promise_amount ?? false),
    })) ?? []
  )
}
