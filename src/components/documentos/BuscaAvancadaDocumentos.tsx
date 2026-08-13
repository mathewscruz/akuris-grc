import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface Categoria {
  id: string;
  nome: string;
}

interface FiltrosAvancados {
  nome: string;
  tipo: string;
  categoria: string;
  status: string;
  dataInicio?: Date;
  dataFim?: Date;
  dataVencimentoInicio?: Date;
  dataVencimentoFim?: Date;
  confidencial?: boolean;
  comArquivo?: boolean;
  tags: string;
  tamanhoMin?: number;
  tamanhoMax?: number;
}

interface BuscaAvancadaDocumentosProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSearch: (filters: FiltrosAvancados) => void;
  categorias: Categoria[];
}

export function BuscaAvancadaDocumentos({ 
  open, 
  onOpenChange, 
  onSearch, 
  categorias 
}: BuscaAvancadaDocumentosProps) {
  const { t } = useLanguage();
  const [filters, setFilters] = useState<FiltrosAvancados>({
    nome: '',
    tipo: '',
    categoria: '',
    status: '',
    tags: '',
  });

  const handleSearch = () => {
    // Criar filtros limpos (sem valores vazios)
    const cleanFilters: Partial<FiltrosAvancados> = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== '' && value !== undefined && value !== null) {
        (cleanFilters as any)[key] = value;
      }
    });

    onSearch(cleanFilters as FiltrosAvancados);
    onOpenChange(false);
  };

  const handleReset = () => {
    setFilters({
      nome: '',
      tipo: '',
      categoria: '',
      status: '',
      tags: '',
    });
  };

  const updateFilter = <K extends keyof FiltrosAvancados>(key: K, value: FiltrosAvancados[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const DatePicker = ({ date, onDateChange, placeholder }: { 
    date?: Date; 
    onDateChange: (date: Date | undefined) => void;
    placeholder: string;
  }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={onDateChange}
          initialFocus
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('documentos.dialogs.buscaAvancadaTitulo')}</DialogTitle>
          <DialogDescription>
            {t('documentos.dialogs.buscaAvancadaDescricao')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações Básicas */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t('documentos.dialogs.informacoesBasicas')}</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nome">{t('documentos.dialogs.nomeDocumento')}</Label>
                <Input
                  id="nome"
                  value={filters.nome}
                  onChange={(e) => updateFilter('nome', e.target.value)}
                  placeholder={t('documentos.dialogs.placeholderNomeDocumento')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tipo">{t('documentos.lista.tipo')}</Label>
                <Select value={filters.tipo} onValueChange={(value) => updateFilter('tipo', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('documentos.dialogs.selecioneTipo')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('documentos.lista.todosOsTipos')}</SelectItem>
                    <SelectItem value="politica">{t('documentos.lista.politica')}</SelectItem>
                    <SelectItem value="procedimento">{t('documentos.lista.procedimento')}</SelectItem>
                    <SelectItem value="instrucao">{t('documentos.lista.instrucao')}</SelectItem>
                    <SelectItem value="formulario">{t('documentos.lista.formulario')}</SelectItem>
                    <SelectItem value="certificado">{t('documentos.lista.certificado')}</SelectItem>
                    <SelectItem value="contrato">{t('documentos.lista.contrato')}</SelectItem>
                    <SelectItem value="relatorio">{t('documentos.lista.relatorio')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="categoria">{t('documentos.dialogs.categoria')}</Label>
                <Select value={filters.categoria} onValueChange={(value) => updateFilter('categoria', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('documentos.dialogs.selecioneCategoria')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('documentos.dialogs.todasCategorias')}</SelectItem>
                    {categorias.map((categoria) => (
                      <SelectItem key={categoria.id} value={categoria.nome}>
                        {categoria.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">{t('documentos.lista.status')}</Label>
                <Select value={filters.status} onValueChange={(value) => updateFilter('status', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('documentos.dialogs.selecioneStatus')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('documentos.dialogs.todosStatus')}</SelectItem>
                    <SelectItem value="ativo">{t('documentos.lista.ativo')}</SelectItem>
                    <SelectItem value="inativo">{t('documentos.lista.inativo')}</SelectItem>
                    <SelectItem value="arquivado">{t('documentos.lista.arquivado')}</SelectItem>
                    <SelectItem value="vencido">{t('documentos.lista.vencido')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">{t('documentos.dialogs.tagsSeparadas')}</Label>
              <Input
                id="tags"
                value={filters.tags}
                onChange={(e) => updateFilter('tags', e.target.value)}
                placeholder={t('documentos.dialogs.placeholderTags')}
              />
            </div>
          </div>

          {/* Filtros de Data */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t('documentos.dialogs.filtrosData')}</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('documentos.dialogs.dataCriacaoInicio')}</Label>
                <DatePicker
                  date={filters.dataInicio}
                  onDateChange={(date) => updateFilter('dataInicio', date)}
                  placeholder={t('documentos.dialogs.selecioneData')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('documentos.dialogs.dataCriacaoFim')}</Label>
                <DatePicker
                  date={filters.dataFim}
                  onDateChange={(date) => updateFilter('dataFim', date)}
                  placeholder={t('documentos.dialogs.selecioneData')}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('documentos.dialogs.dataVencimentoInicio')}</Label>
                <DatePicker
                  date={filters.dataVencimentoInicio}
                  onDateChange={(date) => updateFilter('dataVencimentoInicio', date)}
                  placeholder={t('documentos.dialogs.selecioneData')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('documentos.dialogs.dataVencimentoFim')}</Label>
                <DatePicker
                  date={filters.dataVencimentoFim}
                  onDateChange={(date) => updateFilter('dataVencimentoFim', date)}
                  placeholder={t('documentos.dialogs.selecioneData')}
                />
              </div>
            </div>
          </div>

          {/* Filtros de Arquivo */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t('documentos.dialogs.filtrosArquivo')}</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tamanhoMin">{t('documentos.dialogs.tamanhoMinimo')}</Label>
                <Input
                  id="tamanhoMin"
                  type="number"
                  value={filters.tamanhoMin || ''}
                  onChange={(e) => updateFilter('tamanhoMin', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tamanhoMax">{t('documentos.dialogs.tamanhoMaximo')}</Label>
                <Input
                  id="tamanhoMax"
                  type="number"
                  value={filters.tamanhoMax || ''}
                  onChange={(e) => updateFilter('tamanhoMax', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="100"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="confidencial"
                  checked={filters.confidencial || false}
                  onCheckedChange={(checked) => updateFilter('confidencial', checked as boolean)}
                />
                <Label htmlFor="confidencial">{t('documentos.dialogs.apenasConfidenciais')}</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="comArquivo"
                  checked={filters.comArquivo || false}
                  onCheckedChange={(checked) => updateFilter('comArquivo', checked as boolean)}
                />
                <Label htmlFor="comArquivo">{t('documentos.dialogs.apenasComArquivo')}</Label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleReset}>
            {t('documentos.dialogs.limparFiltros')}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('documentos.dialogs.cancelar')}
          </Button>
          <Button onClick={handleSearch}>
            {t('documentos.dialogs.aplicarFiltros')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
