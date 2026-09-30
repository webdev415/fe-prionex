/**
 * The DOM id of an operator's name cell in the «Обіцянки по операторах»
 * table — the scroll target of a `?opu=` link (see `OperatorPromisesTab`).
 * A module of its own so the table file keeps exporting only components
 * (react-refresh) while the tab and the table read the same spelling.
 */
export function operatorPromisesRowAnchorId(userId: number): string {
  return `operator-promises-row-${userId}`
}
