import type { CreateContactRequest, UpdateContactRequest } from '../api/types'

export interface ContactFormValues {
  contact_value: string
  contact_type_id: number | null
  comment: string
}

/**
 * Build the request body for creating or updating a contact.
 *
 * One builder for both, because the editor is one form: the caller branches on
 * create vs update *after* the payload exists.
 *
 * `comment` is sent as `null` when empty, never `undefined`. That distinction
 * is the whole bug this function exists to prevent:
 *
 *   - axios drops `undefined` keys, so the field never reaches the server
 *   - the update endpoint uses `model_dump(exclude_unset=True)`, so a field
 *     that did not arrive means "leave the stored value alone"
 *   - clearing a comment therefore silently kept the old one
 *
 * Create was unaffected only by luck: an omitted comment defaults the column to
 * NULL, which is already empty. Sending `null` explicitly is identical there
 * (`ContactCreate.comment` is `Optional[str] = None`), so both paths can share
 * this and create keeps behaving exactly as before.
 *
 * `null` rather than `''` so a cleared comment and a never-set one are the same
 * value in the column, instead of two spellings of empty.
 */
export function buildContactPayload(
  form: ContactFormValues
): CreateContactRequest & UpdateContactRequest {
  return {
    contact_value: form.contact_value.trim(),
    contact_type_id: form.contact_type_id,
    comment: form.comment.trim() || null,
  }
}
