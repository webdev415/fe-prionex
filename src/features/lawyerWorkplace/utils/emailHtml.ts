/** Strip the most dangerous constructs before rendering server-sanitized email HTML. */
export function sanitizeEmailHtmlForDisplay(html: string): string {
  return html
    .replace(/<(script|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|iframe|object|embed)\b[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
}

export function looksLikeHtml(value: string): boolean {
  return /<(?:!doctype|html|head|body|div|table|tr|td|th|p|br|span|a|img|style)\b/i.test(value)
}
