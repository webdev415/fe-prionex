/** Result pill tones from Figma Action Analysis Tab 1 (`css1.md`). */
export function interactionResultBadgeTone(code: string | null | undefined): string {
  const c = (code ?? '').toLowerCase()
  if (c.includes('promise') || c.includes('payment') || c.includes('paid')) {
    return 'bg-[#F0FDF4] text-[#15803D]'
  }
  if (c.includes('refus') || c.includes('reject') || c.includes('negative')) {
    return 'bg-[#FEF2F2] text-[#B91C1C]'
  }
  if (c.includes('miss') || c.includes('no_answer') || c.includes('unreachable')) {
    return 'bg-[#F3F4F6] text-[#4B5563]'
  }
  if (c.includes('pass') || c.includes('will')) {
    return 'bg-[#F5F3FF] text-[#7C3AED]'
  }
  if (c.includes('positive') || c.includes('agree')) {
    return 'bg-[#EFF6FF] text-[#2563EB]'
  }
  return 'bg-[#F7F7F7] text-[#545454]'
}
