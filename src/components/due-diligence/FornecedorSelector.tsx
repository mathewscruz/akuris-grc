import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';

interface FornecedorValue {
  nome: string;
  email: string;
}

interface FornecedorSelectorProps {
  value: FornecedorValue;
  onChange: (value: FornecedorValue) => void;
}

export function FornecedorSelector({ value, onChange }: FornecedorSelectorProps) {
  const { t } = useLanguage();
  return (
    <div className="space-y-3">
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
