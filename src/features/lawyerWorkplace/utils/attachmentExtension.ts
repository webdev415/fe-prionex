/** Display label for an attachment badge (uppercase file extension, or fallback). */
export function getFilenameExtensionLabel(filename: string): string {
  const trimmed = filename.trim()
  const lastDot = trimmed.lastIndexOf('.')
  if (lastDot <= 0 || lastDot === trimmed.length - 1) {
    return 'FILE'
  }
  return trimmed.slice(lastDot + 1).toUpperCase()
}
