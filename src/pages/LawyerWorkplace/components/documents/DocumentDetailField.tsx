import type { ReactNode } from 'react'

interface DocumentDetailFieldProps {
  label: string
  children: ReactNode
}

export function DocumentDetailField({ label, children }: DocumentDetailFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        {label}
      </span>
      <div className="text-foreground text-[13px]">{children}</div>
    </div>
  )
}
