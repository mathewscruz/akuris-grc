/**
 * DenunciaAnexos — a prova, dos dois lados.
 *
 * A aba só sabia descarregar, e não era descuido de interface: o balde
 * `denuncias-anexos` tinha uma única política, de SELECT. Não havia por onde
 * escrever, embora `tipo_anexo` já previsse `'evidencia'` e `'investigacao'`
 * desde a onda 1 — valores que nada podia produzir.
 *
 * Na prática, tudo o que a apuração recolhe — o e-mail que o RH reencaminhou,
 * a ata da entrevista, o print do sistema — vivia fora do produto, em pastas
 * de rede e caixas de correio. Numa auditoria ao canal é precisamente isso que
 * se pede para ver.
 *
 * O que chega pelo canal e o que o comité junta ficam separados no ecrã: são
 * coisas com valor probatório diferente, e a segunda tem autor.
 */
import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { IconDownload, IconFile, IconUpload, IconDelete, IconLock } from '@/components/icons';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDateTime } from '@/lib/date-utils';
import { toast } from 'sonner';

interface Anexo {
  id: string;
  nome_arquivo: string;
  tipo_arquivo: string | null;
  tamanho_arquivo: number | null;
  arquivo_url: string;
  tipo_anexo: string;
  upload_status: string | null;
  uploaded_by: string | null;
  created_at: string;
}

interface Props {
  denunciaId: string;
  empresaId: string;
  status: string;
  onAtualizado: () => void;
}

const LIMITE_BYTES = 10 * 1024 * 1024;

function formatarTamanho(bytes: number | null): string {
  if (!bytes) return '—';
  const unidades = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(1))} ${unidades[i]}`;
}

export function DenunciaAnexos({ denunciaId, empresaId, status, onAtualizado }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);

  const chave = ['denuncia-anexos', denunciaId];

  const { data: anexos = [], isLoading } = useQuery({
    queryKey: chave,
    enabled: !!denunciaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('denuncias_anexos')
        .select('*')
        .eq('denuncia_id', denunciaId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Anexo[];
    },
  });

  const { data: nomes = {} } = useQuery({
    queryKey: ['denuncia-anexos-autores', denunciaId, anexos.length],
    enabled: anexos.some((a) => a.uploaded_by),
    queryFn: async () => {
      const ids = Array.from(new Set(anexos.map((a) => a.uploaded_by).filter(Boolean) as string[]));
      const { data } = await supabase.from('profiles').select('user_id, nome').in('user_id', ids);
      return Object.fromEntries((data ?? []).map((p) => [p.user_id, p.nome ?? '']));
    },
  });

  const doCanal = anexos.filter((a) => a.tipo_anexo === 'denuncia');
  const daApuracao = anexos.filter((a) => a.tipo_anexo !== 'denuncia');

  const enviar = async (ficheiros: FileList | null) => {
    if (!ficheiros?.length) return;
    setEnviando(true);
    const falharam: string[] = [];

    for (const ficheiro of Array.from(ficheiros)) {
      if (ficheiro.size > LIMITE_BYTES) {
        falharam.push(ficheiro.name);
        continue;
      }
      try {
        const ext = ficheiro.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? 'bin';
        /* O caminho é o que a política do balde lê: empresa/denúncia/ficheiro. */
        const caminho = `${empresaId}/${denunciaId}/${crypto.randomUUID()}.${ext}`;

        const { error: erroUpload } = await supabase.storage
          .from('denuncias-anexos')
          .upload(caminho, ficheiro, { contentType: ficheiro.type || undefined });
        if (erroUpload) throw erroUpload;

        const { error: erroLinha } = await supabase.from('denuncias_anexos').insert({
          denuncia_id: denunciaId,
          nome_arquivo: ficheiro.name.slice(0, 255),
          tipo_arquivo: ficheiro.type || null,
          tamanho_arquivo: ficheiro.size,
          arquivo_url: caminho,
          tipo_anexo: 'investigacao',
          upload_status: 'concluido',
          uploaded_by: user?.id ?? null,
        });
        if (erroLinha) throw erroLinha;

        /* A trilha vê a prova entrar. */
        const { error: erroTrilha } = await supabase.from('denuncias_movimentacoes').insert({
          denuncia_id: denunciaId,
          acao: 'evidencia_anexada',
          status_anterior: status,
          status_novo: status,
          observacoes: ficheiro.name.slice(0, 255),
          visibilidade: 'interna',
          usuario_id: user?.id ?? null,
        });
        if (erroTrilha) throw erroTrilha;
      } catch {
        falharam.push(ficheiro.name);
      }
    }

    setEnviando(false);
    if (entrada.current) entrada.current.value = '';
    queryClient.invalidateQueries({ queryKey: chave });
    onAtualizado();

    if (falharam.length === 0) {
      toast.success(t('denunciasAdmin.anexos.enviado'));
    } else {
      toast.error(t('denunciasAdmin.anexos.erroEnviar', { nomes: falharam.join(', ') }));
    }
  };

  const descarregar = async (anexo: Anexo) => {
    const { data, error } = await supabase.storage
      .from('denuncias-anexos')
      .download(anexo.arquivo_url);
    if (error || !data) {
      toast.error(t('denunciasAdmin.dialog.errorDownload'));
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = anexo.nome_arquivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /* Só o que a apuração juntou. O que veio pelo canal é o relato: apagá-lo
     seria apagar prova de quem denunciou, e isso não se oferece num botão. */
  const remover = async (anexo: Anexo) => {
    try {
      const { error: erroFicheiro } = await supabase.storage
        .from('denuncias-anexos')
        .remove([anexo.arquivo_url]);
      if (erroFicheiro) throw erroFicheiro;

      const { error } = await supabase.from('denuncias_anexos').delete().eq('id', anexo.id);
      if (error) throw error;

      const { error: erroTrilha } = await supabase.from('denuncias_movimentacoes').insert({
        denuncia_id: denunciaId,
        acao: 'evidencia_removida',
        status_anterior: status,
        status_novo: status,
        observacoes: anexo.nome_arquivo,
        visibilidade: 'interna',
        usuario_id: user?.id ?? null,
      });
      if (erroTrilha) throw erroTrilha;

      queryClient.invalidateQueries({ queryKey: chave });
      onAtualizado();
      toast.success(t('denunciasAdmin.anexos.removido'));
    } catch {
      toast.error(t('denunciasAdmin.anexos.erroRemover'));
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <AkurisPulse size={32} />
      </div>
    );
  }

  const lista = (itens: Anexo[], podeRemover: boolean) => (
    <ol className="overflow-hidden rounded-lg border border-border bg-card">
      {itens.map((anexo, i) => (
        <li
          key={anexo.id}
          className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-border' : ''}`}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
            <IconFile className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">
              {anexo.nome_arquivo}
            </span>
            <span className="block text-micro text-muted-foreground">
              {formatarTamanho(anexo.tamanho_arquivo)} · {formatDateTime(anexo.created_at)}
              {anexo.uploaded_by && nomes[anexo.uploaded_by]
                ? ` · ${t('denunciasAdmin.apuracao.por', { nome: nomes[anexo.uploaded_by] })}`
                : ''}
              {anexo.upload_status === 'pendente'
                ? ` · ${t('denunciasAdmin.anexos.pendente')}`
                : ''}
            </span>
          </span>
          <Button variant="ghost" size="sm" onClick={() => descarregar(anexo)}>
            <IconDownload className="h-4 w-4" strokeWidth={1.5} />
          </Button>
          {podeRemover && (
            <Button variant="ghost" size="sm" onClick={() => remover(anexo)}>
              <IconDelete className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          )}
        </li>
      ))}
    </ol>
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">
          {t('denunciasAdmin.anexos.doCanal')}
        </p>
        <p className="mb-2 text-micro text-muted-foreground">
          {t('denunciasAdmin.anexos.doCanalAjuda')}
        </p>
        {doCanal.length > 0 ? (
          lista(doCanal, false)
        ) : (
          <p className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
            {t('denunciasAdmin.anexos.semAnexosCanal')}
          </p>
        )}
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">
            {t('denunciasAdmin.anexos.daApuracao')}
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={enviando}
            onClick={() => entrada.current?.click()}
          >
            <IconUpload className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.5} />
            {enviando ? t('denunciasAdmin.anexos.enviando') : t('denunciasAdmin.anexos.juntar')}
          </Button>
          <input
            ref={entrada}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt,.eml,.msg"
            onChange={(e) => enviar(e.target.files)}
          />
        </div>
        <p className="mb-2 flex items-start gap-1.5 text-micro text-muted-foreground">
          <IconLock className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={1.5} />
          {t('denunciasAdmin.anexos.daApuracaoAjuda')}
        </p>
        {daApuracao.length > 0 ? (
          lista(daApuracao, true)
        ) : (
          <p className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
            {t('denunciasAdmin.anexos.semAnexosApuracao')}
          </p>
        )}
      </div>
    </div>
  );
}
