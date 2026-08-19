/**
 * Escolha do fornecedor a avaliar.
 *
 * Chamava-se "Selector" e eram dois campos de texto livre: o nome e o e-mail
 * eram digitados à mão, sem qualquer referência ao cadastro. Era a origem de
 * um problema estrutural — a avaliação ficava ligada ao fornecedor apenas por
 * igualdade de e-mail, portanto mudar o contacto órfã o histórico, um
 * fornecedor sem e-mail nunca mostrava avaliação nenhuma, e dois que
 * partilhassem o endereço do gestor de conta fundiam os scores.
 *
 * Agora escolhe-se do registo (o `EntidadeSelect` que o resto do produto usa)
 * e é isso que grava `fornecedor_id`. O nome e o e-mail continuam editáveis:
 * são o registo de para quem e para onde o questionário foi enviado naquele
 * dia, e há o caso legítimo de avaliar um terceiro ainda não cadastrado.
 */
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { EntidadeSelect } from '@/components/common/EntidadeSelect';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

export interface FornecedorValue {
  id?: string | null;
  nome: string;
  email: string;
}

interface FornecedorSelectorProps {
  value: FornecedorValue;
  onChange: (value: FornecedorValue) => void;
}

export function FornecedorSelector({ value, onChange }: FornecedorSelectorProps) {
  const { t } = useLanguage();
  const [avulso, setAvulso] = useState(false);

  const escolher = async (id: string, row?: { titulo?: string }) => {
    if (!id) {
      onChange({ id: null, nome: '', email: '' });
      return;
    }
    // O registo de entidades não traz o e-mail; é preciso ir buscá-lo para
    // preencher o destinatário do convite.
    const { data } = await supabase
      .from('fornecedores')
      .select('nome, email')
      .eq('id', id)
      .maybeSingle();
    onChange({ id, nome: data?.nome ?? row?.titulo ?? '', email: data?.email ?? '' });
  };

  return (
    <div className="space-y-3">
      {!avulso ? (
        <div className="space-y-2">
          <Label>{t('dueDiligence.fornecedorSelector.pickLabel')}</Label>
          <EntidadeSelect
            entidade="fornecedor"
            value={value.id ?? undefined}
            onValueChange={escolher}
            placeholder={t('dueDiligence.fornecedorSelector.pickPlaceholder')}
          />
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => { setAvulso(true); onChange({ id: null, nome: '', email: '' }); }}
          >
            {t('dueDiligence.fornecedorSelector.notRegistered')}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0"
          onClick={() => setAvulso(false)}
        >
          {t('dueDiligence.fornecedorSelector.backToRegistry')}
        </Button>
      )}

      <div className="space-y-2">
        <Label htmlFor="fornecedor_nome">{t('dueDiligence.fornecedorSelector.nameLabel')}</Label>
        <Input
          id="fornecedor_nome"
          value={value.nome}
          onChange={(e) => onChange({ ...value, nome: e.target.value })}
          placeholder={t('dueDiligence.fornecedorSelector.namePlaceholder')}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="fornecedor_email">{t('dueDiligence.fornecedorSelector.emailLabel')}</Label>
        <Input
          id="fornecedor_email"
          type="email"
          value={value.email}
          onChange={(e) => onChange({ ...value, email: e.target.value })}
          placeholder={t('dueDiligence.fornecedorSelector.emailPlaceholder')}
        />
      </div>
    </div>
  );
}
