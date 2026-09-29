/**
 * The archive command of a board (planner story 3.19) as the settings see it
 * (story 5.10, AC4).
 *
 * Contract 0.24.0 has no archive path, although the planner already lists
 * `archive_board` in a board admin's `allowed_actions` (`BoardCard`). A button
 * with nothing to call would be a dead control, so the settings show
 * «Архівувати дошку» only when BOTH the action is allowed AND this command
 * exists. Until the 3.19 contract is vendored (`plannerApi.archiveBoard`, the
 * number of open tasks it reports) there is none: `null`.
 */

/** The board action of the contract's dictionary (`Board.allowed_actions`). */
export const ARCHIVE_BOARD_ACTION = 'archive_board'

export interface ArchiveBoardCommand {
  /** Open tasks of the board: archiving closes them, with a reason. */
  openTasks: number
  pending: boolean
  /** Archive; `reason` is required when there are open tasks. */
  archive: (reason: string | null) => void
}

export function useArchiveBoardCommand(_code: string): ArchiveBoardCommand | null {
  return null
}
