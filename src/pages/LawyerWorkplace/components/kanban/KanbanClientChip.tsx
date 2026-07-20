interface KanbanClientChipProps {
  code: string
}

export function KanbanClientChip({ code }: KanbanClientChipProps) {
  return (
    <span className="bg-muted text-muted-foreground shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium">
      {code}
    </span>
  )
}
