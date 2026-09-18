import { Label } from '@/components/ui/Label'
import { RadioGroup, RadioItem } from '@/components/ui/Radio'

interface ProjectChoiceFieldProps {
  name: string
  label: string
  options: ReadonlyArray<{ value: string; label: string }>
  value: string | undefined
  onChange: (value: string) => void
  disabled?: boolean
  hint?: string
}

export function ProjectChoiceField({
  name,
  label,
  options,
  value,
  onChange,
  disabled,
  hint,
}: ProjectChoiceFieldProps) {
  return (
    <div>
      <Label className="mb-2 block text-sm font-light">{label}</Label>
      <RadioGroup value={value} onValueChange={onChange} disabled={disabled} className="flex gap-6">
        {options.map((option) => (
          <div key={option.value} className="flex items-center gap-2">
            <RadioItem value={option.value} id={`${name}-${option.value}`} />
            <Label
              htmlFor={`${name}-${option.value}`}
              className="mb-0 cursor-pointer text-sm font-light"
            >
              {option.label}
            </Label>
          </div>
        ))}
      </RadioGroup>
      {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
    </div>
  )
}
