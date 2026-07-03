interface KanbanClientChipProps {
  code: string
}

export function KanbanClientChip({ code }: KanbanClientChipProps) {
  return (
    <span className="shrink-0 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
      {code}
    </span>
  )
}
