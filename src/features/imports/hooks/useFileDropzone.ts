import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

/**
 * Drag-and-drop + validation for the bulk-import upload panels.
 *
 * Extracted because the client-tag and contact-tag upload components carried
 * byte-identical copies of this logic. Two copies of a validation rule drift:
 * a fix to the accepted extensions or the size limit has to be found and made
 * twice, and the second one gets missed.
 *
 * Only the behaviour is shared. Each panel keeps its own markup, because they
 * differ in more than strings and the components have no test coverage to
 * refactor against.
 */
export interface FileDropzoneOptions {
  /** Lower-case extensions, including the dot. */
  accept: string[]
  maxBytes: number
  onFileSelected: (file: File) => void
  /** i18n prefix for the two error strings, e.g. the panel's own namespace. */
  errorScope: string
}

export interface FileDropzone {
  dragActive: boolean
  validateFile: (file: File) => string | null
  handleDrag: (e: React.DragEvent) => void
  handleDrop: (e: React.DragEvent) => void
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function useFileDropzone({
  accept,
  maxBytes,
  onFileSelected,
  errorScope,
}: FileDropzoneOptions): FileDropzone {
  const { t } = useTranslation('common')
  const [dragActive, setDragActive] = useState(false)

  const validateFile = useCallback(
    (file: File): string | null => {
      const lower = file.name.toLowerCase()
      if (!accept.some((ext) => lower.endsWith(ext))) {
        return t(
          `${errorScope}.errors.onlyCsvOrXlsx`,
          'Only CSV or Excel (.xlsx) files are accepted.'
        )
      }
      if (file.size > maxBytes) {
        return t(`${errorScope}.errors.fileTooLarge`, {
          defaultValue: 'File too large ({{size}} MB). Maximum is 10 MB.',
          size: (file.size / (1024 * 1024)).toFixed(1),
        })
      }
      return null
    },
    [t, errorScope, accept, maxBytes]
  )

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const accept_ = useCallback(
    (file: File | undefined | null) => {
      if (!file) return
      const error = validateFile(file)
      if (error) {
        toast.error(error)
        return
      }
      onFileSelected(file)
    },
    [onFileSelected, validateFile]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)
      accept_(e.dataTransfer.files?.[0])
    },
    [accept_]
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      accept_(e.target.files?.[0])
      // Cleared so re-selecting the same file after a failed upload still
      // fires a change event.
      e.target.value = ''
    },
    [accept_]
  )

  return { dragActive, validateFile, handleDrag, handleDrop, handleFileChange }
}
