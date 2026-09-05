/** Parse each URL independently so optional lastmod cannot swallow the next entry. */
export function readCachedBlogEntries(xml: string) {
  return [...xml.matchAll(/<url>\s*([\s\S]*?)<\/url>/g)].flatMap(([, block]) => {
    const path = block.match(/<loc>https:\/\/akuris\.pt(\/blog\/[^<]+)<\/loc>/)?.[1];
    if (!path) return [];
    const lastmod = block.match(/<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>/)?.[1];
    return [{ path, ...(lastmod ? { lastmod } : {}), changefreq: 'monthly' as const, priority: '0.7' }];
  });
}
