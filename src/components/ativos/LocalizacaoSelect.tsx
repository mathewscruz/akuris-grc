import React, { useState, useEffect } from 'react';
import { IconAdd, IconCheck } from '@/components/icons';
;
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { toast } from '@/lib/toast';
import { useLanguage } from '@/contexts/LanguageContext';

interface Localizacao {
  id: string;
  nome: string;
  descricao: string | null;
}

interface LocalizacaoSelectProps {
  value: string;
  onValueChange: (value: string) => void;
}

const LocalizacaoSelect = ({ value, onValueChange }: LocalizacaoSelectProps) => {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const [localizacoes, setLocalizacoes] = useState<Localizacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    descricao: ''
  });

  useEffect(() => {
    fetchLocalizacoes();
  }, []);

  const fetchLocalizacoes = async () => {
    try {
      const { data, error } = await supabase
        .from('ativos_localizacoes')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      setLocalizacoes(data || []);
    } catch (error) {
      console.error('Error fetching localizacoes:', error);
      toast.error(t('contratosAtivos.localizacaoSelect.toastLoadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!profile?.empresa_id) {
      toast.error(t('contratosAtivos.localizacaoSelect.toastNoEmpresa'));
      return;
    }

    try {
      const { data, error } = await supabase
        .from('ativos_localizacoes')
        .insert({
          nome: formData.nome,
          descricao: formData.descricao || null,
          empresa_id: profile.empresa_id
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(t('contratosAtivos.localizacaoSelect.toastCreateSuccess'));
      setLocalizacoes(prev => [...prev, data]);
      onValueChange(data.nome);
      setIsDialogOpen(false);
      setFormData({ nome: '', descricao: '' });
    } catch (error: any) {
      console.error('Error creating localizacao:', error);
      toast.error(error.message || t('contratosAtivos.localizacaoSelect.toastCreateError'));
    }
  };

  if (loading) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder={t('contratosAtivos.localizacaoSelect.placeholderLoading')} />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <div className="flex gap-2">
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder={t('contratosAtivos.localizacaoSelect.placeholderSelect')} />
        </SelectTrigger>
        <SelectContent>
          {/*
            A localização guardada aparece mesmo quando não está no cadastro.

            O Radix desenha o item que corresponde ao valor; sem item, desenha
            NADA — nem o valor, nem o placeholder. Medido na base local: os
            activos guardam `Cloud`, `Datacenter`, `Datacenter SP` e
            `Escritório`, e o cadastro só tem `Datacenter SP` e
            `Almoxarifado - BH`. Três em cada quatro activos abriam a edição
            com o campo de localização em branco, como se não tivessem
            nenhuma — e vieram de importação, onde a localização é texto livre.
          */}
          {value && !localizacoes.some((l) => l.nome === value) && (
            <SelectItem value={value}>{value}</SelectItem>
          )}
          {localizacoes.map((localizacao) => (
            <SelectItem key={localizacao.id} value={localizacao.nome}>
              {localizacao.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon" aria-label={t('common.add')} title={t('common.add')}>
            <IconAdd className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('contratosAtivos.localizacaoSelect.newLocationTitle')}</DialogTitle>
            <DialogDescription>
              {t('contratosAtivos.localizacaoSelect.newLocationDescription')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">{t('contratosAtivos.localizacaoSelect.labelName')}</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData(prev => ({...prev, nome: e.target.value}))}
                placeholder={t('contratosAtivos.localizacaoSelect.namePlaceholder')}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="descricao">{t('contratosAtivos.localizacaoSelect.labelDescription')}</Label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData(prev => ({...prev, descricao: e.target.value}))}
                placeholder={t('contratosAtivos.localizacaoSelect.descriptionPlaceholder')}
                rows={3}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                {t('contratosAtivos.common.cancel')}
              </Button>
              <Button type="submit">
                <IconCheck className="h-4 w-4 mr-2" />
                {t('contratosAtivos.localizacaoSelect.createButton')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LocalizacaoSelect;