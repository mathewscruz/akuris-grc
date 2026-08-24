/**
 * O campo de CNPJ que confere o que foi escrito.
 *
 * Antes: caixa de texto livre, e a razão social era o que a pessoa digitou.
 * Agora: valida o dígito antes de sair à rede, consulta a Receita, mostra o
 * que encontrou e preenche o resto do formulário a partir daí.
 *
 * O painel que aparece por baixo não é decoração — é a evidência da
 * diligência, e fica gravada com a data em que se olhou. Por isso mostra a
 * data de consulta em vez de a esconder: «está ativa» não prova nada, «em
 * 24/08 estava ativa» prova.
 */
import { useState } from 'react';
import { IconSearch, IconWarning, IconInfo, IconCheck, IconUsers } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ui/status-badge';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDateOnly } from '@/lib/date-utils';
import { logger } from '@/lib/logger';
import {
  cnpjValido,
  formatarCnpj,
  limparCnpj,
  montarConsulta,
  totalDeSancoes,
  type ConsultaCnpj,
  type GravidadeAlerta,
} from '@/lib/cnpj';

interface Props {
  cnpj: string;
  onCnpjChange: (valor: string) => void;
  /** O que a Receita respondeu, quando já se consultou. */
  consulta: ConsultaCnpj | null;
  onConsulta: (c: ConsultaCnpj) => void;
  /** Preenche razão social, endereço, telefone e e-mail a partir do cadastro. */
  onPreencher: (dados: {
    nome: string;
    endereco: string;
    telefone: string;
    email: string;
  }) => void;
}

const TOM_DO_ALERTA: Record<GravidadeAlerta, 'destructive' | 'warning' | 'neutral'> = {
  critica: 'destructive',
  atencao: 'warning',
  informativa: 'neutral',
};

export function ConsultaReceita({
  cnpj,
  onCnpjChange,
  consulta,
  onConsulta,
  onPreencher,
}: Props) {
  const { t } = useLanguage();
  const [consultando, setConsultando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const digitos = limparCnpj(cnpj);
  const podeConsultar = cnpjValido(digitos) && !consultando;
  /* Só reclama depois de a pessoa ter escrito os catorze — avisar a meio da
     digitação é um campo que grita enquanto se escreve. */
  const digitadoErrado = digitos.length === 14 && !cnpjValido(digitos);

  const consultar = async () => {
    setConsultando(true);
    setErro(null);
    try {
      const { data, error } = await supabase.functions.invoke('consultar-cnpj', {
        body: { cnpj: digitos },
      });
      if (error) throw error;
      if (data?.erro) {
        setErro(t(`dueDiligence.receita.erro.${data.erro}`));
        return;
      }

      const montada = montarConsulta(data);
      onConsulta(montada);
      onCnpjChange(formatarCnpj(digitos));
      onPreencher({
        nome: montada.cadastro.razao_social ?? '',
        endereco: montada.cadastro.endereco ?? '',
        telefone: montada.cadastro.telefone ?? '',
        email: montada.cadastro.email ?? '',
      });
    } catch (e) {
      logger.error('Falha ao consultar CNPJ', {
        module: 'due-diligence',
        error: e instanceof Error ? e.message : String(e),
      });
      setErro(t('dueDiligence.receita.erro.fonte_indisponivel'));
    } finally {
      setConsultando(false);
    }
  };

  const sancoes = totalDeSancoes(consulta?.sancoes);

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="cnpj">{t('dueDiligence.fornecedoresManager.fieldCnpj')}</Label>
        <div className="flex gap-2">
          <Input
            id="cnpj"
            value={cnpj}
            inputMode="numeric"
            placeholder="00.000.000/0000-00"
            onChange={(e) => onCnpjChange(e.target.value)}
            onBlur={() => cnpjValido(cnpj) && onCnpjChange(formatarCnpj(cnpj))}
            aria-invalid={digitadoErrado || undefined}
          />
          <Button
            type="button"
            variant="outline"
            onClick={consultar}
            disabled={!podeConsultar}
            className="shrink-0 gap-1.5"
          >
            <IconSearch className="h-4 w-4" />
            {consultando
              ? t('dueDiligence.receita.consultando')
              : t('dueDiligence.receita.consultar')}
          </Button>
        </div>
        {digitadoErrado && (
          <p className="mt-1 text-xs text-destructive">{t('dueDiligence.receita.digitoInvalido')}</p>
        )}
        {erro && <p className="mt-1 text-xs text-destructive">{erro}</p>}
      </div>

      {consulta && (
        <div className="rounded-lg border bg-card text-sm">
          <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
            <span className="font-medium">{consulta.cadastro.razao_social}</span>
            {consulta.cadastro.situacao_cadastral && (
              <StatusBadge
                tone={consulta.cadastro.situacao_cadastral === 'ATIVA' ? 'success' : 'destructive'}
              >
                {consulta.cadastro.situacao_cadastral}
              </StatusBadge>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              {t('dueDiligence.receita.consultadoEm', {
                data: formatDateOnly(consulta.consultado_em),
              })}
            </span>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-3 py-2 text-xs sm:grid-cols-3">
            {consulta.cadastro.nome_fantasia && (
              <Campo rotulo={t('dueDiligence.receita.nomeFantasia')} valor={consulta.cadastro.nome_fantasia} />
            )}
            <Campo
              rotulo={t('dueDiligence.receita.abertura')}
              valor={consulta.cadastro.abertura ? formatDateOnly(consulta.cadastro.abertura) : null}
            />
            <Campo rotulo={t('dueDiligence.receita.porte')} valor={consulta.cadastro.porte} />
            <Campo
              rotulo={t('dueDiligence.receita.naturezaJuridica')}
              valor={consulta.cadastro.natureza_juridica}
            />
            <Campo
              rotulo={t('dueDiligence.receita.cnae')}
              valor={consulta.cadastro.cnae_principal?.descricao}
            />
            <Campo
              rotulo={t('dueDiligence.receita.matrizFilial')}
              valor={consulta.cadastro.matriz_filial}
            />
          </dl>

          {consulta.socios.length > 0 && (
            <div className="border-t px-3 py-2">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <IconUsers className="h-3.5 w-3.5" />
                {t('dueDiligence.receita.socios', { total: consulta.socios.length })}
              </p>
              <ul className="space-y-0.5 text-xs">
                {consulta.socios.slice(0, 8).map((s, i) => (
                  <li key={`${s.nome}-${i}`} className="flex flex-wrap gap-x-2">
                    <span>{s.nome}</span>
                    {s.qualificacao && (
                      <span className="text-muted-foreground">— {s.qualificacao}</span>
                    )}
                  </li>
                ))}
                {consulta.socios.length > 8 && (
                  <li className="text-muted-foreground">
                    {t('dueDiligence.receita.maisSocios', { total: consulta.socios.length - 8 })}
                  </li>
                )}
              </ul>
            </div>
          )}

          {/*
            As sanções têm três respostas possíveis, e as três aparecem. «Não
            verificado» não é o mesmo que «nada encontrado», e o ecrã não pode
            deixar confundir os dois: quem lê só vê a cor.
          */}
          <div className="flex items-start gap-1.5 border-t px-3 py-2 text-xs">
            {sancoes === null ? (
              <>
                <IconInfo className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {consulta.sancoes.motivo === 'falha_consulta'
                    ? t('dueDiligence.receita.sancoesFalha')
                    : t('dueDiligence.receita.sancoesSemChave')}
                </span>
              </>
            ) : sancoes === 0 ? (
              <>
                <IconCheck className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">{t('dueDiligence.receita.sancoesLimpo')}</span>
              </>
            ) : (
              <>
                <IconWarning className="h-3.5 w-3.5 mt-0.5 shrink-0 text-destructive" />
                <span className="font-medium text-destructive">
                  {t('dueDiligence.receita.sancoesEncontradas', { total: sancoes })}
                </span>
              </>
            )}
          </div>

          {consulta.alertas.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-t px-3 py-2">
              {consulta.alertas.map((a) => (
                <StatusBadge key={a.chave} tone={TOM_DO_ALERTA[a.gravidade]}>
                  {t(`dueDiligence.receita.alerta.${a.chave}`)}
                </StatusBadge>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor?: string | null }) {
  if (!valor) return null;
  return (
    <div>
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className="font-medium">{valor}</dd>
    </div>
  );
}
