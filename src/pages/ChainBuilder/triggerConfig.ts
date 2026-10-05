export const TRIGGER_TYPES = [
  'tag_change',
  'call_result',
  'date_reached',
  'debt_status',
  'chain_completed',
  'role_action',
] as const

export type TriggerType = (typeof TRIGGER_TYPES)[number]

/**
 * The field each trigger type has to carry. Mirrors the backend's
 * chain_automation.REQUIRED_TRIGGER_FIELD: the API refuses a trigger without
 * it with a 400, and one saved before that is skipped instead of matching
 * every event. Disabling "Add trigger" keeps the form from hitting that 400.
 * Typed over every TriggerType so a new type has to be decided on here.
 */
const REQUIRED_TRIGGER_FIELD: Record<TriggerType, string | null> = {
  tag_change: 'tag_id',
  call_result: 'result_code',
  debt_status: 'status',
  chain_completed: 'source_chain_id',
  // The backend model documents {"field": "promise_date"} for this, but
  // _trigger_matches returns true for date_reached without reading config and
  // no service emits a date_reached event, so there is nothing to require yet.
  date_reached: null,
  // The backend model documents {"role_id": 2} and _trigger_matches reads it,
  // but no service emits a role_action event (chain_event_consumer's
  // EVENT_TO_TRIGGER has no entry for it). Once something does, require role_id
  // here and in the backend's REQUIRED_TRIGGER_FIELD, with an input for it.
  role_action: null,
}

export function isTriggerConfigIncomplete(
  triggerType: TriggerType,
  config: Record<string, string>
): boolean {
  const field = REQUIRED_TRIGGER_FIELD[triggerType]
  return field !== null && !config[field]?.trim()
}

/** The config sent to the backend; values are trimmed the same way the guard reads them. */
export function buildTriggerConfig(config: Record<string, string>): Record<string, unknown> {
  const cfg: Record<string, unknown> = {}
  const tagId = config.tag_id?.trim()
  if (tagId) cfg.tag_id = parseInt(tagId, 10)
  const sourceChainId = config.source_chain_id?.trim()
  if (sourceChainId) cfg.source_chain_id = parseInt(sourceChainId, 10)
  const resultCode = config.result_code?.trim()
  if (resultCode) cfg.result_code = resultCode
  const status = config.status?.trim()
  if (status) cfg.status = status
  return cfg
}
