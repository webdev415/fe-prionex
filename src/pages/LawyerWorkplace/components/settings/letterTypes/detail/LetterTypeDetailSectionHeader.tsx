interface LetterTypeDetailSectionHeaderProps {
  title: string
  hint?: string
}

export function LetterTypeDetailSectionHeader({ title, hint }: LetterTypeDetailSectionHeaderProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-dark-500 text-[14px] font-semibold">{title}</h3>
      {hint ? <span className="text-light-600 text-[11px]">{hint}</span> : null}
    </div>
  )
}
