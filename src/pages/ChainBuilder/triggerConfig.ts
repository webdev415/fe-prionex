/**
 * The field each trigger type has to carry. The backend treats a trigger
 * without it as "match any event" (chain_automation._trigger_matches), so an
 * empty tag_change trigger would start the chain on every tag assignment.
 * Types not listed here have no field to fill in.
 */
const REQUIRED_TRIGGER_FIELD: Record<string, string> = {
  tag_change: 'tag_id',
  call_result: 'result_code',
  debt_status: 'status',
  chain_completed: 'source_chain_id',
}

export function isTriggerConfigIncomplete(
  triggerType: string,
  config: Record<string, string>
): boolean {
  const field = REQUIRED_TRIGGER_FIELD[triggerType]
  return field !== undefined && !config[field]?.trim()
}
