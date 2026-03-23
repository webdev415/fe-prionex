/**
 * PayloadSchemaEditor Component
 *
 * Simple textarea-based JSON Schema editor with live validation.
 * Shows a validation status indicator (valid/invalid JSON).
 */

import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'

export interface PayloadSchemaEditorProps {
  value: Record<string, unknown> | undefined
  onChange: (schema: Record<string, unknown> | undefined) => void
  error?: string
}

export function PayloadSchemaEditor({ value, onChange, error }: PayloadSchemaEditorProps) {
  const { t } = useTranslation('common')

  const [rawText, setRawText] = useState(() => (value ? JSON.stringify(value, null, 2) : ''))
  const [parseError, setParseError] = useState<string | null>(null)

  // Sync rawText when the external value changes (e.g. form reset)
  // Using render-time state derivation instead of useEffect to avoid cascading renders
  const [prevValue, setPrevValue] = useState(value)
  if (prevValue !== value) {
    setPrevValue(value)
    setRawText(value ? JSON.stringify(value, null, 2) : '')
    setParseError(null)
  }

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value
      setRawText(text)

      if (!text.trim()) {
        setParseError(null)
        onChange(undefined)
        return
      }

      try {
        const parsed = JSON.parse(text)
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          setParseError(t('pages.tags.payloadSchema.mustBeObject', 'Schema must be a JSON object'))
          return
        }
        setParseError(null)
        onChange(parsed as Record<string, unknown>)
      } catch (err) {
        setParseError(
          t('pages.tags.payloadSchema.invalidJson', 'Invalid JSON: {{message}}', {
            message: (err as SyntaxError).message,
          })
        )
      }
    },
    [onChange, t]
  )

  const displayError = error ?? parseError

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{t('pages.tags.payloadSchema.title', 'Payload Schema (JSON)')}</Label>
        {rawText.trim() && !displayError && (
          <span className="bg-success-100 text-success-700 rounded px-1.5 py-0.5 text-[10px] font-medium">
            {t('pages.tags.payloadSchema.valid', 'Valid JSON')}
          </span>
        )}
        {displayError && (
          <span className="bg-error-100 text-error-600 rounded px-1.5 py-0.5 text-[10px] font-medium">
            {t('pages.tags.payloadSchema.invalid', 'Invalid')}
          </span>
        )}
      </div>

      <Textarea
        value={rawText}
        onChange={handleChange}
        placeholder={`{\n  "type": "object",\n  "properties": {\n    "amount": { "type": "number" }\n  }\n}`}
        textareaSize="lg"
        variant={displayError ? 'error' : 'default'}
        className="font-mono text-xs"
        rows={8}
      />

      {displayError && (
        <p className="text-error-500 text-xs" role="alert">
          {displayError}
        </p>
      )}
    </div>
  )
}
