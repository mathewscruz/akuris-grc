/**
 * CanalConsultoria — abrir o canal a quem trata dele de fora.
 *
 * É o modelo de receita de quem vende canal de denúncia à parte: uma
 * consultoria licencia N empresas e gere o canal de todas. Sem isto, cada
 * cliente é uma conta separada e a consultoria entra e sai de sessões
 * diferentes o dia inteiro.
 *
 * Duas decisões que este ecrã torna visíveis:
 *
 *  · **A porta abre-se de dentro.** Quem concede é um administrador da empresa
 *    CLIENTE, nunca a consultoria a si própria. Se fosse ao contrário, uma
 *    conta comprometida numa consultoria lia denúncias de qualquer empresa.
 *
 *  · **O alcance é só o canal.** Quem entra por aqui vê as denúncias e mais
 *    nada — nem riscos, nem contratos, nem documentos. Isso está garantido no
 *    banco, não neste ecrã: a permissão passa por `pode_ver_denuncia`, e as
 *    outras 321 políticas do produto continuam a olhar para a empresa do
 *    próprio utilizador.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IconDelete, IconAdd, IconLock } from '@/components/icons';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDateOnly } from '@/lib/date-utils';
import { toast } from 'sonner';

interface Acesso {
  id: string;
  user_id: string;
  papel: string;
  created_at: string;
  nome: string | null;
  email: string | null;
}

export function CanalConsultoria() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { empresaId } = useEmpresaId();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const chave = ['denuncia-consultoria', empresaId];

  const { data: acessos = [] } = useQuery({
    queryKey: chave,
    enabled: !!empresaId,
    queryFn: async () => {
      const { data: linhas } = await supabase
        .from('denuncias_consultoria')
        .select('id, user_id, papel, created_at')
        .eq('empresa_id', empresaId!);
      if (!linhas?.length) return [] as Acesso[];

      const { data: perfis } = await supabase
        .from('profiles')
        .select('user_id, nome, email')
        .in('user_id', linhas.map((l) => l.user_id));

      return linhas.map((l) => {
        const p = perfis?.find((x) => x.user_id === l.user_id);
        return { ...l, nome: p?.nome ?? null, email: p?.email ?? null };
      }) as Acesso[];
    },
  });

  const conceder = async () => {
    const alvo = email.trim().toLowerCase();
    if (!alvo || !empresaId) return;
    setOcupado(true);
    try {
      /*
        Procura por e-mail porque é o que quem concede conhece: a consultoria
        deu um endereço, não um identificador. Se não existir conta, diz-se —
        em vez de gravar um acesso que nunca vai a lado nenhum.
      */
      const { data: perfil } = await supabase
        .from('profiles')
        .select('user_id, nome')
        .ilike('email', alvo)
        .maybeSingle();

      if (!perfil) {
        toast.error(t('denunciasAdmin.consultoria.semConta'));
        return;
      }

      const { error } = await supabase.from('denuncias_consultoria').insert({
        empresa_id: empresaId,
        user_id: perfil.user_id,
        papel: 'gestor',
        concedido_por: user?.id ?? null,
      });
      if (error) throw error;

      setEmail('');
      queryClient.invalidateQueries({ queryKey: chave });
      toast.success(t('denunciasAdmin.consultoria.concedido'));
    } catch {
      toast.error(t('denunciasAdmin.consultoria.erroConceder'));
    } finally {
      setOcupado(false);
    }
  };

  const revogar = async (id: string) => {
    const { error } = await supabase.from('denuncias_consultoria').delete().eq('id', id);
    if (error) return toast.error(t('denunciasAdmin.consultoria.erroRevogar'));
    queryClient.invalidateQueries({ queryKey: chave });
    toast.success(t('denunciasAdmin.consultoria.revogado'));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('denunciasAdmin.consultoria.titulo')}</CardTitle>
        <CardDescription>{t('denunciasAdmin.consultoria.descricao')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {acessos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('denunciasAdmin.consultoria.vazio')}
          </p>
        ) : (
          <ul className="overflow-hidden rounded-lg border border-border">
            {acessos.map((a, i) => (
              <li
                key={a.id}
                className={`flex items-center gap-3 bg-card px-4 py-3 ${i > 0 ? 'border-t border-border' : ''}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {a.nome || a.email || a.user_id.slice(0, 8)}
                  </span>
                  <span className="block text-micro text-muted-foreground">
                    {a.email}
                    {a.email ? ' · ' : ''}
                    {t('denunciasAdmin.consultoria.desde', { data: formatDateOnly(a.created_at) })}
                  </span>
                </span>
                <Button variant="ghost" size="sm" onClick={() => revogar(a.id)}>
                  <IconDelete className="h-4 w-4" strokeWidth={1.5} />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2">
          <Label htmlFor="email-consultoria" className="text-xs">
            {t('denunciasAdmin.consultoria.email')}
          </Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="email-consultoria"
              type="email"
              className="min-w-[16rem] flex-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="pessoa@consultoria.com"
            />
            <Button onClick={conceder} disabled={ocupado || !email.trim()}>
              <IconAdd className="mr-1.5 h-4 w-4" strokeWidth={1.5} />
              {t('denunciasAdmin.consultoria.conceder')}
            </Button>
          </div>
        </div>

        <p className="flex items-start gap-1.5 text-micro leading-relaxed text-muted-foreground">
          <IconLock className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={1.5} />
          {t('denunciasAdmin.consultoria.alcance')}
        </p>
      </CardContent>
    </Card>
  );
}
