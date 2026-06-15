interface LetterTypeDetailSectionHeaderProps {
  title: string
  hint?: string
}

export function LetterTypeDetailSectionHeader({ title, hint }: LetterTypeDetailSectionHeaderProps) {
  return (
    <div className="mb-4 flex flex-col items-start gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
      <h3 className="text-dark-500 text-[14px] font-semibold">{title}</h3>
      {hint ? <span className="text-light-600 text-[11px] sm:text-right">{hint}</span> : null}
    </div>
  )
}
