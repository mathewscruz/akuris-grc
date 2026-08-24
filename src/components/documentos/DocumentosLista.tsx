import React, { type ReactNode } from 'react';
import { IconEdit, IconDelete, IconView, IconMore, IconSuccess, IconRefresh, IconActivity, IconHistory, IconMessage, IconShield } from '@/components/icons';
import { rowOpenProps } from '@/lib/row-interaction';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead, useTableSort } from '@/components/ui/sortable-table-head';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { StatusBadge } from '@/components/ui/status-badge';
import { capitalizeText, formatStatus } from '@/lib/text-utils';
import {
  resolveClassificacaoTone,
  resolveItemStatusTone,
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
  /** Nome já resolvido pelo chamador; a lista só exibe. */
  responsavel_nome?: string | null;
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
    <StatusBadge {...resolveTipoDocumentoTone(tipo)}>
      {capitalizeText(tipo)}
    </StatusBadge>
  );
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
        <IconMore className="h-4 w-4" />
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
          <IconView className="mr-2 h-4 w-4" />
          {t('documentos.lista.preview')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEditar(documento)}>
          <IconEdit className="mr-2 h-4 w-4" />
          {t('documentos.lista.editar')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onVinculacoes(documento)}>
          <IconView className="mr-2 h-4 w-4" />
          {t('documentos.lista.vinculacoes')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onComentarios(documento)}>
          <IconMessage className="mr-2 h-4 w-4" />
          {t('documentos.lista.comentarios')}
        </DropdownMenuItem>
        {documento.requer_aprovacao && (
          <DropdownMenuItem onClick={() => onAprovacao(documento)}>
            <IconSuccess className="mr-2 h-4 w-4" />
            {t('documentos.lista.aprovacao')}
          </DropdownMenuItem>
        )}
        {podeRenovar && (
          <DropdownMenuItem onClick={() => onRenovar(documento)}>
            <IconRefresh className="mr-2 h-4 w-4" />
            {t('documentos.lista.renovarDocumento')}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onHistorico(documento)}>
          <IconHistory className="mr-2 h-4 w-4" />
          {t('documentos.lista.historicoVersoes')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAuditoria(documento)}>
          <IconActivity className="mr-2 h-4 w-4" />
          {t('documentos.lista.trilhaAuditoria')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onExcluir(documento)} className="text-destructive">
          <IconDelete className="mr-2 h-4 w-4" />
          {t('documentos.lista.excluir')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CampoCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1 min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
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
  const { sorted: documentosOrdenados, sort, toggleSort } = useTableSort(documentos);

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
                    <StatusBadge {...resolveItemStatusTone(documento.status)}>
                      {formatStatus(documento.status)}
                    </StatusBadge>
                  </CampoCard>
                  <CampoCard label={t('documentos.lista.validade')}>
                    <span className="whitespace-nowrap">
                      {formatDateOnly(documento.data_vencimento)}
                    </span>
                  </CampoCard>
                  <CampoCard label={t('documentos.lista.classificacao')}>
                    {/* Confidencial mantém a saliência do ícone usada na tabela */}
                    <StatusBadge
                      icon={
                        documento.classificacao === 'confidencial' ? (
                          <IconShield className="h-3 w-3" />
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
                  <CampoCard label={t('documentos.lista.responsavel')}>
                    <span className={documento.responsavel_nome ? '' : 'text-muted-foreground'}>
                      {documento.responsavel_nome || SEM_VALOR}
                    </span>
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
              <SortableTableHead field="nome" sort={sort} onSort={toggleSort}>{t('documentos.lista.nome')}</SortableTableHead>
              <SortableTableHead field="tipo" sort={sort} onSort={toggleSort}>{t('documentos.lista.tipo')}</SortableTableHead>
              <SortableTableHead field="classificacao" sort={sort} onSort={toggleSort}>{t('documentos.lista.classificacao')}</SortableTableHead>
              <SortableTableHead field="status" sort={sort} onSort={toggleSort}>{t('documentos.lista.status')}</SortableTableHead>
              <SortableTableHead field="versao" sort={sort} onSort={toggleSort}>{t('documentos.lista.versao')}</SortableTableHead>
              <SortableTableHead field="data_validade" sort={sort} onSort={toggleSort}>{t('documentos.lista.validade')}</SortableTableHead>
              <SortableTableHead field="responsavel_nome" sort={sort} onSort={toggleSort}>{t('documentos.lista.responsavel')}</SortableTableHead>
              <TableHead className="text-right">{t('documentos.lista.acoes')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vazio ? (
              <TableRow>
                <TableCell colSpan={8} className="p-0">
                  {emptyState}
                </TableCell>
              </TableRow>
            ) : (
              documentosOrdenados.map((documento) => (
                <TableRow key={documento.id} data-focus-id={documento.id} {...rowOpenProps(() => acoes.onPreview(documento), documento.nome)}>
                  <TableCell>
                    {/* Sem tarja de confidencial aqui: a coluna Classificação
                        já mostra o mesmo rótulo na mesma linha. */}
                    <div className="space-y-1">
                      <div className="font-medium">{documento.nome}</div>
                      {documento.descricao && (
                        <div className="text-sm text-muted-foreground line-clamp-1">
                          {documento.descricao}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getTipoBadge(documento.tipo)}</TableCell>
                  <TableCell>
                    <StatusBadge
                      {...resolveClassificacaoTone(documento.classificacao || 'interna')}
                    >
                      {capitalizeText(documento.classificacao || 'interna')}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge {...resolveItemStatusTone(documento.status)}>
                      {formatStatus(documento.status)}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>{formatVersao(documento.versao)}</TableCell>
                  <TableCell>
                    <div className="flex items-center whitespace-nowrap">
                      {formatDateOnly(documento.data_vencimento)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={documento.responsavel_nome ? '' : 'text-muted-foreground'}>
                      {documento.responsavel_nome || SEM_VALOR}
                    </span>
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
