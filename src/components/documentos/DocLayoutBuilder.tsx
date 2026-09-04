import React from 'react';
import { IconAdd, IconDelete, IconArrowDown, IconArrowUp } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLanguage } from '@/contexts/LanguageContext';

interface DocSection {
  nome: string;
  conteudo: string;
}

interface DocContent {
  titulo: string;
  versao?: string;
  data_criacao?: string;
  secoes: DocSection[];
  metadados?: Record<string, any>;
}

interface DocLayoutBuilderProps {
  value: DocContent;
  onChange: (next: DocContent) => void;
}

const move = <T,>(arr: T[], from: number, to: number) => {
  const copy = arr.slice();
  const item = copy.splice(from, 1)[0];
  copy.splice(to, 0, item);
  return copy;
};

const DocLayoutBuilder: React.FC<DocLayoutBuilderProps> = ({ value, onChange }) => {
  const { t } = useLanguage();
  const setMeta = (k: string, v: any) => onChange({ ...value, metadados: { ...(value.metadados || {}), [k]: v } });
  const setSection = (idx: number, patch: Partial<DocSection>) => {
    const next = value.secoes.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onChange({ ...value, secoes: next });
  };

  const addSection = () => {
    const next = [...(value.secoes || []), { nome: t('sweepDocumentos.docLayoutBuilder.novaSecaoDefault'), conteudo: '' }];
    onChange({ ...value, secoes: next });
  };

  const removeSection = (idx: number) => {
    const next = value.secoes.filter((_, i) => i !== idx);
    onChange({ ...value, secoes: next });
  };

  const moveUp = (idx: number) => {
    if (idx <= 0) return;
    onChange({ ...value, secoes: move(value.secoes, idx, idx - 1) });
  };

  const moveDown = (idx: number) => {
    if (idx >= value.secoes.length - 1) return;
    onChange({ ...value, secoes: move(value.secoes, idx, idx + 1) });
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <Card>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('documentosExtras.layoutBuilder.titulo')}</label>
            <Input value={value.titulo || ''} onChange={(e) => onChange({ ...value, titulo: e.target.value })} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('documentosExtras.layoutBuilder.versao')}</label>
            <Input value={value.versao || ''} onChange={(e) => onChange({ ...value, versao: e.target.value })} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('documentosExtras.layoutBuilder.classificacao')}</label>
            <Select value={value.metadados?.classificacao || 'Interno'} onValueChange={(v) => setMeta('classificacao', v)}>
              <SelectTrigger>
                <SelectValue placeholder={t('documentosExtras.layoutBuilder.selecione')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Público">{t('documentosExtras.layoutBuilder.classificacaoPublico')}</SelectItem>
                <SelectItem value="Interno">{t('documentosExtras.layoutBuilder.classificacaoInterno')}</SelectItem>
                <SelectItem value="Confidencial">{t('documentosExtras.layoutBuilder.classificacaoConfidencial')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('documentosExtras.layoutBuilder.layout')}</label>
            <Select value={value.metadados?.layout || 'classico'} onValueChange={(v) => setMeta('layout', v)}>
              <SelectTrigger>
                <SelectValue placeholder={t('documentosExtras.layoutBuilder.layout')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="classico">{t('documentosExtras.layoutBuilder.layoutClassico')}</SelectItem>
                <SelectItem value="moderno">{t('documentosExtras.layoutBuilder.layoutModerno')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('documentosExtras.layoutBuilder.posicaoLogo')}</label>
            <Select value={value.metadados?.logo_posicao || 'esquerda'} onValueChange={(v) => setMeta('logo_posicao', v)}>
              <SelectTrigger>
                <SelectValue placeholder={t('documentosExtras.layoutBuilder.posicao')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="esquerda">{t('documentosExtras.layoutBuilder.posicaoEsquerda')}</SelectItem>
                <SelectItem value="centro">{t('documentosExtras.layoutBuilder.posicaoCentro')}</SelectItem>
                <SelectItem value="direita">{t('documentosExtras.layoutBuilder.posicaoDireita')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('documentosExtras.layoutBuilder.alturaLogo')}</label>
            <Input type="number" min={24} max={160} value={value.metadados?.logo_altura || 48} onChange={(e) => setMeta('logo_altura', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h4 className="font-semibold">{t('documentosExtras.layoutBuilder.secoes')}</h4>
        <Button size="sm" className="gap-1" onClick={addSection}>
          <IconAdd className="h-4 w-4" /> {t('documentosExtras.layoutBuilder.novaSecao')}
        </Button>
      </div>

      <ScrollArea className="h-[48vh] pr-2">
        <div className="space-y-4">
          {value.secoes?.map((s, idx) => (
            <Card key={idx} className="border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={s.nome}
                    onChange={(e) => setSection(idx, { nome: e.target.value })}
                  />
                  <div className="ml-auto flex gap-1">
                    <Button variant="outline" size="icon" onClick={() => moveUp(idx)} aria-label={t('documentosExtras.layoutBuilder.moverParaCima')}>
                      <IconArrowUp className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => moveDown(idx)} aria-label={t('documentosExtras.layoutBuilder.moverParaBaixo')}>
                      <IconArrowDown className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="icon" onClick={() => removeSection(idx)} aria-label={t('documentosExtras.layoutBuilder.removerSecao')}>
                      <IconDelete className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={s.conteudo}
                  onChange={(e) => setSection(idx, { conteudo: e.target.value })}
                  className="min-h-[120px] resize-y"
                />
              </CardContent>
            </Card>
          ))}
          {(!value.secoes || value.secoes.length === 0) && (
            <p className="text-sm text-muted-foreground">{t('documentosExtras.layoutBuilder.nenhumaSecao')}</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default DocLayoutBuilder;
