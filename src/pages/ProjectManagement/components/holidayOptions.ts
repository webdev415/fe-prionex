interface Option {
  id: string
  name: string
}

/**
 * Prepends an explicit "none" entry to a select's options.
 *
 * SearchableSelect renders only what it is given and has no clear affordance,
 * so without this a holiday country could be set but never unset — making "no
 * holiday calendar", a supported state, reachable only by never choosing one.
 */
export function withNoneOption(options: Option[], noneLabel: string): Option[] {
  return [{ id: '', name: noneLabel }, ...options]
}
