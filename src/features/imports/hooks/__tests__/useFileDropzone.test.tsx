import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { toast } from 'sonner'
import { useFileDropzone } from '../useFileDropzone'

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}))

const MB = 1024 * 1024

function file(name: string, sizeBytes = 1024): File {
  const f = new File(['x'], name, { type: 'text/csv' })
  Object.defineProperty(f, 'size', { value: sizeBytes })
  return f
}

function setup(onFileSelected = vi.fn()) {
  const { result } = renderHook(() =>
    useFileDropzone({
      accept: ['.csv', '.xlsx'],
      maxBytes: 10 * MB,
      onFileSelected,
      errorScope: 'pages.imports.contactTagAssignment.upload',
    })
  )
  return { result, onFileSelected }
}

function dragEvent(type: string, files: File[] = []) {
  return {
    type,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    dataTransfer: { files },
  } as unknown as React.DragEvent
}

describe('useFileDropzone', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('validateFile', () => {
    it('accepts the configured extensions, case-insensitively', () => {
      const { result } = setup()
      expect(result.current.validateFile(file('a.csv'))).toBeNull()
      expect(result.current.validateFile(file('B.XLSX'))).toBeNull()
    })

    it('rejects any other extension', () => {
      // Asserts the i18n KEY, not the English copy: the test harness's t()
      // returns the key, and the key is the contract anyway.
      const { result } = setup()
      expect(result.current.validateFile(file('a.pdf'))).toMatch(/onlyCsvOrXlsx$/)
      // No extension at all — endsWith would pass a naive startsWith check.
      expect(result.current.validateFile(file('csv'))).toMatch(/onlyCsvOrXlsx$/)
    })

    it('rejects a file over the size limit but accepts one exactly at it', () => {
      const { result } = setup()
      expect(result.current.validateFile(file('a.csv', 10 * MB))).toBeNull()
      expect(result.current.validateFile(file('a.csv', 10 * MB + 1))).toMatch(/fileTooLarge$/)
    })
  })

  describe('drag state', () => {
    it('turns on for dragenter and dragover, off for dragleave', () => {
      const { result } = setup()
      expect(result.current.dragActive).toBe(false)

      act(() => result.current.handleDrag(dragEvent('dragenter')))
      expect(result.current.dragActive).toBe(true)

      act(() => result.current.handleDrag(dragEvent('dragleave')))
      expect(result.current.dragActive).toBe(false)

      act(() => result.current.handleDrag(dragEvent('dragover')))
      expect(result.current.dragActive).toBe(true)
    })

    it('clears on drop, so the panel does not stay highlighted', () => {
      const { result } = setup()
      act(() => result.current.handleDrag(dragEvent('dragover')))
      expect(result.current.dragActive).toBe(true)

      act(() => result.current.handleDrop(dragEvent('drop', [file('a.csv')])))
      expect(result.current.dragActive).toBe(false)
    })
  })

  describe('selection', () => {
    it('passes a valid dropped file through', () => {
      const { result, onFileSelected } = setup()
      const f = file('a.csv')
      act(() => result.current.handleDrop(dragEvent('drop', [f])))
      expect(onFileSelected).toHaveBeenCalledWith(f)
      expect(toast.error).not.toHaveBeenCalled()
    })

    it('toasts and does NOT pass on an invalid dropped file', () => {
      const { result, onFileSelected } = setup()
      act(() => result.current.handleDrop(dragEvent('drop', [file('a.pdf')])))
      expect(onFileSelected).not.toHaveBeenCalled()
      expect(toast.error).toHaveBeenCalledTimes(1)
    })

    it('ignores a drop with no file rather than throwing', () => {
      const { result, onFileSelected } = setup()
      act(() => result.current.handleDrop(dragEvent('drop', [])))
      expect(onFileSelected).not.toHaveBeenCalled()
      expect(toast.error).not.toHaveBeenCalled()
    })

    it('clears the input value so the same file can be re-picked', () => {
      // Without this, choosing the same file after a failed upload fires no
      // change event and the panel looks dead.
      const { result, onFileSelected } = setup()
      const input = { files: [file('a.csv')], value: 'C:\\fakepath\\a.csv' }
      act(() =>
        result.current.handleFileChange({
          target: input,
        } as unknown as React.ChangeEvent<HTMLInputElement>)
      )
      expect(onFileSelected).toHaveBeenCalled()
      expect(input.value).toBe('')
    })

    it('clears the input value even when validation fails', () => {
      const { result, onFileSelected } = setup()
      const input = { files: [file('a.pdf')], value: 'C:\\fakepath\\a.pdf' }
      act(() =>
        result.current.handleFileChange({
          target: input,
        } as unknown as React.ChangeEvent<HTMLInputElement>)
      )
      expect(onFileSelected).not.toHaveBeenCalled()
      expect(input.value).toBe('')
    })
  })
})
