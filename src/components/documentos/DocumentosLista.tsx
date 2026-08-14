import React, { type ReactNode } from 'react';
import { rowOpenProps } from '@/lib/row-interaction';
import {
  Activity,
  CheckCircle,
  Edit,
  Eye,
  History,
  MessageSquare,
  MoreHorizontal,
  RefreshCw,
  Shield,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { StatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { capitalizeText, formatStatus } from '@/lib/text-utils';
import {
  resolveClassificacaoTone,
  resolveItemStatusTone,
  resolveRevisaoTone,
  resolveTipoDocumentoTone,
} from '@/lib/status-tone';
import { formatDateOnly } from '@/lib/date-utils';
import { useLanguage } from '@/contexts/LanguageContext';

/** Campos anuláveis espelham o schema do Supabase (colunas sem NOT NULL). */
export interface DocumentoListaItem {
  id: string;
  nome: string;
  descricao?: string | null;
  tipo: string;
  classificacao?: string | null;
  status: string;
  versao?: number | null;
  data_vencimento?: string | null;
  requer_aprovacao?: boolean | null;
}

const SEM_VALOR = '-';

function formatVersao(versao?: number | null): string {
  return versao == null ? SEM_VALOR : `v${versao}`;
}

interface DocumentoAcoesProps<T extends DocumentoListaItem = DocumentoListaItem> {
  onPreview: (documento: T) => void;
  onEditar: (documento: T) => void;
  onVinculacoes: (documento: T) => void;
  onComentarios: (documento: T) => void;
  onAprovacao: (documento: T) => void;
  onRenovar: (documento: T) => void;
  onHistorico: (documento: T) => void;
  onAuditoria: (documento: T) => void;
  onExcluir: (documento: T) => void;
}

export interface DocumentosListaProps<T extends DocumentoListaItem = DocumentoListaItem>
  extends DocumentoAcoesProps<T> {
  documentos: T[];
  /** Estado vazio compartilhado pelas duas representações */
  emptyState: ReactNode;
  podeRenovar: (documento: T) => boolean;
}

function getTipoBadge(tipo: string) {
  return (
    <StatusBadge size="sm" {...resolveTipoDocumentoTone(tipo)}>
      {capitalizeText(tipo)}
    </StatusBadge>
  );
}

function getVencimentoBadge(dataVencimento: string | null | undefined, vencidoLabel: string) {
  if (!dataVencimento) return null;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataVenc = new Date(dataVencimento + 'T00:00:00');
  const diffDays = Math.ceil((dataVenc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return (
      <StatusBadge size="sm" {...resolveRevisaoTone(diffDays)} className="ml-2">
        {vencidoLabel}
      </StatusBadge>
    );
  }
  if (diffDays <= 30) {
    return (
      <StatusBadge size="sm" {...resolveRevisaoTone(diffDays)} className="ml-2">
        {diffDays}d
      </StatusBadge>
    );
  }
  return null;
}

interface DocumentoAcoesMenuProps<T extends DocumentoListaItem>
  extends DocumentoAcoesProps<T> {
  documento: T;
  podeRenovar: boolean;
  /** Tooltip só faz sentido em ponteiro (desktop) */
  withTooltip?: boolean;
}

/**
 * Menu de ações do documento — idêntico na tabela (desktop) e nos cards (mobile),
 * garantindo o mesmo contrato de teclado/leitor de tela nas duas representações.
 */
export function DocumentoAcoesMenu<T extends DocumentoListaItem>({
  documento,
  podeRenovar,
  withTooltip = false,
  onPreview,
  onEditar,
  onVinculacoes,
  onComentarios,
  onAprovacao,
  onRenovar,
  onHistorico,
  onAuditoria,
  onExcluir,
}: DocumentoAcoesMenuProps<T>) {
  const { t } = useLanguage();
  const trigger = (
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" className="h-8 w-8 p-0">
        <span className="sr-only">{t('documentos.lista.acoesDocumento', { nome: documento.nome })}</span>
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
  );

  return (
    <DropdownMenu>
      {withTooltip ? (
        // TooltipProvider local: o menu funciona mesmo se o consumidor não
        // envolver a árvore num provider (aninhar providers é suportado).
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>{trigger}</TooltipTrigger>
            <TooltipContent>{t('documentos.lista.acoes')}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        trigger
      )}
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onPreview(documento)}>
          <Eye className="mr-2 h-4 w-4" />
          {t('documentos.lista.preview')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEditar(documento)}>
          <Edit className="mr-2 h-4 w-4" />
          {t('documentos.lista.editar')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onVinculacoes(documento)}>
          <Eye className="mr-2 h-4 w-4" />
          {t('documentos.lista.vinculacoes')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onComentarios(documento)}>
          <MessageSquare className="mr-2 h-4 w-4" />
          {t('documentos.lista.comentarios')}
        </DropdownMenuItem>
        {documento.requer_aprovacao && (
          <DropdownMenuItem onClick={() => onAprovacao(documento)}>
            <CheckCircle className="mr-2 h-4 w-4" />
            {t('documentos.lista.aprovacao')}
          </DropdownMenuItem>
        )}
        {podeRenovar && (
          <DropdownMenuItem onClick={() => onRenovar(documento)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t('documentos.lista.renovarDocumento')}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onHistorico(documento)}>
          <History className="mr-2 h-4 w-4" />
          {t('documentos.lista.historicoVersoes')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAuditoria(documento)}>
          <Activity className="mr-2 h-4 w-4" />
          {t('documentos.lista.trilhaAuditoria')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onExcluir(documento)} className="text-red-600">
          <Trash2 className="mr-2 h-4 w-4" />
          {t('documentos.lista.excluir')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CampoCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1 min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="flex items-center text-sm">{children}</dd>
    </div>
  );
}

/**
 * Listagem de documentos responsiva (AKURIS QA-001).
 *
 * Abaixo de `md` a tabela de sete colunas empurrava Status, Versão, Validade e o
 * menu de Ações para fora da área visível, sem affordance de rolagem. Nessa
 * faixa renderizamos cards empilhados com pares rótulo-valor; de `md` para cima
 * a tabela original é preservada sem alterações de comportamento.
 */
export function DocumentosLista<T extends DocumentoListaItem>({
  documentos,
  emptyState,
  podeRenovar,
  ...acoes
}: DocumentosListaProps<T>) {
  const { t } = useLanguage();
  const vazio = documentos.length === 0;

  return (
    <>
      {/* Mobile (< md): cards empilhados */}
      <div className="md:hidden" data-testid="documentos-lista-mobile">
        {vazio ? (
          emptyState
        ) : (
          <ul role="list" className="divide-y divide-border">
            {documentos.map((documento) => (
              <li
                key={documento.id}
                data-focus-id={documento.id}
                {...(() => {
                  const props = rowOpenProps(() => acoes.onPreview(documento), documento.nome);
                  return { ...props, className: `px-4 py-4 ${props.className}` };
                })()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium leading-snug break-words">{documento.nome}</p>
                    {documento.descricao && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {documento.descricao}
                      </p>
                    )}
                    <div className="pt-1">{getTipoBadge(documento.tipo)}</div>
                  </div>
                  <div className="flex-shrink-0">
                    <DocumentoAcoesMenu
                      documento={documento}
                      podeRenovar={podeRenovar(documento)}
                      {...acoes}
                    />
                  </div>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                  <CampoCard label={t('documentos.lista.status')}>
                    <StatusBadge size="sm" {...resolveItemStatusTone(documento.status)}>
                      {formatStatus(documento.status)}
                    </StatusBadge>
                  </CampoCard>
                  <CampoCard label={t('documentos.lista.validade')}>
                    <span className="whitespace-nowrap">
                      {formatDateOnly(documento.data_vencimento)}
                    </span>
                    {getVencimentoBadge(documento.data_vencimento, t('documentos.lista.vencido'))}
                  </CampoCard>
                  <CampoCard label={t('documentos.lista.classificacao')}>
                    {/* Confidencial mantém a saliência do ícone usada na tabela */}
                    <StatusBadge
                      size="sm"
                      icon={
                        documento.classificacao === 'confidencial' ? (
                          <Shield className="h-3 w-3" />
                        ) : undefined
                      }
                      {...resolveClassificacaoTone(documento.classificacao || 'interna')}
                    >
                      {capitalizeText(documento.classificacao || 'interna')}
                    </StatusBadge>
                  </CampoCard>
                  <CampoCard label={t('documentos.lista.versao')}>
                    <span>{formatVersao(documento.versao)}</span>
                  </CampoCard>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Desktop (>= md): tabela original */}
      <div className="hidden md:block" data-testid="documentos-tabela-desktop">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('documentos.lista.nome')}</TableHead>
              <TableHead>{t('documentos.lista.tipo')}</TableHead>
              <TableHead>{t('documentos.lista.classificacao')}</TableHead>
              <TableHead>{t('documentos.lista.status')}</TableHead>
              <TableHead>{t('documentos.lista.versao')}</TableHead>
              <TableHead>{t('documentos.lista.validade')}</TableHead>
              <TableHead className="text-right">{t('documentos.lista.acoes')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vazio ? (
              <TableRow>
                <TableCell colSpan={7} className="p-0">
                  {emptyState}
                </TableCell>
              </TableRow>
            ) : (
              documentos.map((documento) => (
                <TableRow key={documento.id} data-focus-id={documento.id} {...rowOpenProps(() => acoes.onPreview(documento), documento.nome)}>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">{documento.nome}</div>
                      {documento.descricao && (
                        <div className="text-sm text-muted-foreground line-clamp-1">
                          {documento.descricao}
                        </div>
                      )}
                      {documento.classificacao === 'confidencial' && (
                        <Badge variant="destructive" className="text-xs">
                          <Shield className="h-3 w-3 mr-1" />
                          {t('documentos.lista.confidencial')}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getTipoBadge(documento.tipo)}</TableCell>
                  <TableCell>
                    <StatusBadge
                      size="sm"
                      {...resolveClassificacaoTone(documento.classificacao || 'interna')}
                    >
                      {capitalizeText(documento.classificacao || 'interna')}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge size="sm" {...resolveItemStatusTone(documento.status)}>
                      {formatStatus(documento.status)}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>{formatVersao(documento.versao)}</TableCell>
                  <TableCell>
                    <div className="flex items-center whitespace-nowrap">
                      {formatDateOnly(documento.data_vencimento)}
                      {getVencimentoBadge(documento.data_vencimento, t('documentos.lista.vencido'))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DocumentoAcoesMenu
                      documento={documento}
                      podeRenovar={podeRenovar(documento)}
                      withTooltip
                      {...acoes}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
