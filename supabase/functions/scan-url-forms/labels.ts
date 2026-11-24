/** Read label associations as literal strings, never as executable regex. */
export function formLabel(html: string, id: string): string {
  if (!id) return '';
  for (const match of html.matchAll(/<label\b([^>]*)>([^<]*)<\/label\s*>/gi)) {
    const target = match[1].match(/\bfor\s*=\s*["']([^"']*)["']/i)?.[1];
    if (target === id) return match[2].trim();
  }
  return '';
}