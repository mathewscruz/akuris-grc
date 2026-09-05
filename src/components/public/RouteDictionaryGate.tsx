import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { isMarketingPath, requireFullDictionaries } from '@/lib/dictionary-registry';

export function RouteDictionaryGate({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  if (!isMarketingPath(pathname)) requireFullDictionaries();
  return children;
}
