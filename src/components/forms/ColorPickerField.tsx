/**
 * ColorPickerField Component
 *
 * Reusable color picker with preset colors and custom picker.
 * Uses react-colorful for the color selection UI.
 */

import { memo } from 'react'
import { HexColorPicker } from 'react-colorful'
import { Label } from '@/components/ui/Label'
import { Input } from '@/components/ui/Input'

interface ColorPickerFieldProps {
  value: string
  onChange: (color: string) => void
  label?: string
  error?: string
  presetColors?: string[]
  showPreview?: boolean
  previewText?: string
}

const DEFAULT_PRESET_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#FFA07A',
  '#98D8C8',
  '#F7DC6F',
  '#BB8FCE',
  '#85C1E2',
  '#80D80A',
  '#FF9D00',
  '#DC2626',
  '#DFDFDF',
]

export const ColorPickerField = memo(function ColorPickerField({
  value,
  onChange,
  label,
  error,
  presetColors = DEFAULT_PRESET_COLORS,
  showPreview = true,
  previewText = 'Tag Name',
}: ColorPickerFieldProps) {
  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}

      {/* Preset Colors */}
      <div className="grid grid-cols-12 gap-2">
        {presetColors.map((color) => (
          <button
            key={color}
            type="button"
            className="h-8 w-8 rounded border-2 transition-all hover:scale-110"
            style={{
              backgroundColor: color,
              borderColor: value.toUpperCase() === color.toUpperCase() ? '#05040D' : '#E5E7EB',
              borderWidth: value.toUpperCase() === color.toUpperCase() ? '3px' : '2px',
            }}
            onClick={() => onChange(color.toUpperCase())}
            aria-label={`Select color ${color}`}
          />
        ))}
      </div>

      {/* Custom Color Picker */}
      <div className="flex gap-4">
        <div className="flex-1">
          <HexColorPicker
            color={value}
            onChange={(color) => onChange(color.toUpperCase())}
            style={{ width: '100%', height: '150px' }}
          />
        </div>

        <div className="flex flex-col gap-4">
          {/* Hex Input */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="hex-input" className="text-xs">
              Hex Code
            </Label>
            <div className="w-28">
              <Input
                id="hex-input"
                value={value}
                onChange={(e) => {
                  let val = e.target.value.toUpperCase()
                  // Ensure # prefix
                  if (!val.startsWith('#')) {
                    val = '#' + val
                  }
                  // Limit to 7 characters (#RRGGBB)
                  val = val.slice(0, 7)
                  onChange(val)
                }}
                placeholder="#000000"
                maxLength={7}
                className="font-mono text-sm"
                error={error}
              />
            </div>
          </div>

          {/* Preview Badge */}
          {showPreview && (
            <div className="flex flex-col gap-2">
              <Label className="text-xs">Preview</Label>
              <div
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium"
                style={{
                  backgroundColor: value + '20',
                  borderColor: value,
                  color: value,
                }}
              >
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: value }} />
                <span>{previewText}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})
