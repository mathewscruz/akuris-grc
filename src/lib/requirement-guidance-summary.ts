/** Present existing implementation instructions, not the entire generated article.
 * The full guidance stays available separately; no source content is rewritten. */
export function implementationExcerpt(content: string | null | undefined): string {
  if (!content?.trim()) return '';
  const sections = content.split(/^##\s+/m);
  const section = sections.find(part => {
    const heading = part.split('\n')[0];
    return /implementa|practical|how to|action steps/i.test(heading);
  });
  if (section) {
    const body = section.slice(section.indexOf('\n') + 1).trim();
    const items = body.split(/\n(?=(?:[-*•]|\d+[.)])\s)/).filter(Boolean);
    return items.slice(0, 3).join('\n');
  }
  // A long article without an implementation section belongs in full guidance.
  return !/^##\s/m.test(content) && content.length <= 650 ? content.trim() : '';
}
