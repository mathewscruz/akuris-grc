import { useState } from 'react';
import akurisLogoDarkText from '@/assets/akuris-logo-light.png';

/** The supplied dark wordmark is the fallback on every public, white shell. */
export function CanalBrand({ logoUrl, name }: { logoUrl?: string | null; name: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const customUrl = logoUrl?.trim();
  if (customUrl && customUrl !== failedUrl) {
    return <img src={customUrl} alt={name} onError={() => setFailedUrl(customUrl)} referrerPolicy="no-referrer" />;
  }
  return <img src={akurisLogoDarkText} width={650} height={195} alt="Akuris" />;
}
