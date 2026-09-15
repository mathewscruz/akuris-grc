import { implementationSection } from '../../supabase/functions/_shared/requirement-guidance-content';

/** Present existing implementation instructions, not the entire generated article.
 * The full guidance stays available separately; no source content is rewritten. */
export function implementationExcerpt(content: string | null | undefined): string {
  if (!content?.trim()) return '';
  const body = implementationSection(content);
  if (body) {
    const items = body.split(/\n(?=(?:[-*•]|\d+[.)])\s)/).filter(Boolean);
    return items.slice(0, 3).join('\n');
  }
  // A long article without an implementation section belongs in full guidance.
  return !/^##\s/m.test(content) && content.length <= 650 ? content.trim() : '';
}
