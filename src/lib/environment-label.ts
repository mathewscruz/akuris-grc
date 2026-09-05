import { formatStatus } from './text-utils';

export function environmentLabel(value: string | null | undefined, t: (key: string) => string) {
  if (!value) return '—';
  const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const keys: Record<string, string> = { producao: 'production', production: 'production', homologacao: 'staging', staging: 'staging', desenvolvimento: 'development', development: 'development', teste: 'testing', testing: 'testing' };
  return keys[normalized] ? t(`experience.environments.${keys[normalized]}`) : formatStatus(value);
}
