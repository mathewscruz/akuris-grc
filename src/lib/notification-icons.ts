/**
 * Mapeia uma notificação (manual ou automática) para o módulo de origem,
 * retornando o ícone proprietário e a label do módulo para a identidade
 * editorial do NotificationCenter e do akurisToast.
 */
import type { ComponentType } from 'react';
import {
  RiscosIcon,
  ControlesIcon,
  AtivosIcon,
  IncidentesIcon,
  GapAnalysisIcon,
  DueDiligenceIcon,
  DocumentosIcon,
  DenunciasIcon,
  IconBell,
  IconHandshake,
  IconShieldCheck,
} from '@/components/icons';

export type NotificationModuleKey =
  | 'riscos'
  | 'documentos'
  | 'contratos'
  | 'controles'
  | 'incidentes'
  | 'ativos'
  | 'aprovacoes'
  | 'gap'
  | 'duediligence'
  | 'denuncias'
  | 'sistema';

// Tipo amplo: aceita tanto ícones proprietários (forwardRef) quanto Lucide.
type AnyIconComponent = ComponentType<any>;

export interface NotificationModuleMeta {
  key: NotificationModuleKey;
  /** Componente de ícone do catálogo Akuris. */
  Icon: AnyIconComponent;
  /** Chave i18n: notifications.modules[key]. */
  i18nKey: string;
}

const MODULE_META: Record<NotificationModuleKey, NotificationModuleMeta> = {
  riscos:       { key: 'riscos',       Icon: RiscosIcon,        i18nKey: 'notifications.modules.riscos' },
  documentos:   { key: 'documentos',   Icon: DocumentosIcon,    i18nKey: 'notifications.modules.documentos' },
  contratos:    { key: 'contratos',    Icon: IconHandshake,     i18nKey: 'notifications.modules.contratos' },
  controles:    { key: 'controles',    Icon: ControlesIcon,     i18nKey: 'notifications.modules.controles' },
  incidentes:   { key: 'incidentes',   Icon: IncidentesIcon,    i18nKey: 'notifications.modules.incidentes' },
  ativos:       { key: 'ativos',       Icon: AtivosIcon,        i18nKey: 'notifications.modules.ativos' },
  aprovacoes:   { key: 'aprovacoes',   Icon: IconShieldCheck,   i18nKey: 'notifications.modules.aprovacoes' },
  gap:          { key: 'gap',          Icon: GapAnalysisIcon,   i18nKey: 'notifications.modules.gap' },
  duediligence: { key: 'duediligence', Icon: DueDiligenceIcon,  i18nKey: 'notifications.modules.duediligence' },
  denuncias:    { key: 'denuncias',    Icon: DenunciasIcon,     i18nKey: 'notifications.modules.denuncias' },
  sistema:      { key: 'sistema',      Icon: IconBell,          i18nKey: 'notifications.modules.sistema' },
};

/**
 * Resolve o módulo de origem a partir do id e/ou link_to da notificação.
 */
export function resolveNotificationModule(
  source: { id?: string | null; link_to?: string | null }
): NotificationModuleMeta {
  const id = (source.id || '').toLowerCase();
  const link = (source.link_to || '').toLowerCase();

  // Aprovações têm prefixo dedicado e devem ser checadas antes de "doc-".
  if (id.startsWith('aprovacao-doc') || link.includes('aprovar=')) return MODULE_META.aprovacoes;

  if (id.startsWith('risco-') || link.startsWith('/riscos')) return MODULE_META.riscos;
  if (id.startsWith('doc-') || link.startsWith('/documentos')) return MODULE_META.documentos;
  if (id.startsWith('contrato-') || link.startsWith('/contratos')) return MODULE_META.contratos;
  if (id.startsWith('controle-') || link.startsWith('/controles')) return MODULE_META.controles;
  if (id.startsWith('incidente-') || link.startsWith('/incidentes')) return MODULE_META.incidentes;

  if (
    id.startsWith('ativo-') ||
    id.startsWith('licenca-') ||
    id.startsWith('chave-') ||
    id.startsWith('manutencao-') ||
    link.startsWith('/ativos')
  ) {
    return MODULE_META.ativos;
  }

  if (link.startsWith('/gap')) return MODULE_META.gap;
  if (link.startsWith('/due-diligence') || link.startsWith('/duediligence')) return MODULE_META.duediligence;
  if (link.startsWith('/denuncia')) return MODULE_META.denuncias;

  return MODULE_META.sistema;
}

export function getModuleMetaByKey(key: NotificationModuleKey): NotificationModuleMeta {
  return MODULE_META[key];
}
