import React, { useState } from 'react';
import { Search, Filter, X, CalendarIcon, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useLanguage } from '@/contexts/LanguageContext';

interface FiltroAvancado {
  termo: string;
  status: string[];
  tipo: string[];
  fornecedor: string[];
  dataInicioFrom?: Date;
  dataInicioTo?: Date;
  dataFimFrom?: Date;
  dataFimTo?: Date;
  valorMin?: number;
  valorMax?: number;
  renovacaoAutomatica?: boolean;
  confidencial?: boolean;
  vencendoEm?: number; // dias
}

interface BuscaAvancadaProps {
  filtros: FiltroAvancado;
  onFiltrosChange: (filtros: FiltroAvancado) => void;
  fornecedores: Array<{ id: string; nome: string }>;
}

export default function BuscaAvancada({ filtros, onFiltrosChange, fornecedores }: BuscaAvancadaProps) {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();

  const statusOptions = [
    { value: 'rascunho', label: t('contratosAtivos.buscaAvancada.statusRascunho') },
    { value: 'ativo', label: t('contratosAtivos.buscaAvancada.statusAtivo') },
    { value: 'suspenso', label: t('contratosAtivos.buscaAvancada.statusSuspenso') },
    { value: 'encerrado', label: t('contratosAtivos.buscaAvancada.statusEncerrado') },
    { value: 'cancelado', label: t('contratosAtivos.buscaAvancada.statusCancelado') }
  ];

  const tipoOptions = [
    { value: 'prestacao_servicos', label: t('contratosAtivos.buscaAvancada.typePrestacaoServicos') },
    { value: 'fornecimento', label: t('contratosAtivos.buscaAvancada.typeFornecimento') },
    { value: 'locacao', label: t('contratosAtivos.buscaAvancada.typeLocacao') },
    { value: 'licenciamento', label: t('contratosAtivos.buscaAvancada.typeLicenciamento') },
    { value: 'manutencao', label: t('contratosAtivos.buscaAvancada.typeManutencao') },
    { value: 'consultoria', label: t('contratosAtivos.buscaAvancada.typeConsultoria') },
    { value: 'outros', label: t('contratosAtivos.buscaAvancada.typeOutros') }
  ];

  const handleFiltroChange = (campo: keyof FiltroAvancado, valor: any) => {
    onFiltrosChange({
      ...filtros,
      [campo]: valor
    });
  };

  const handleMultiSelectChange = (campo: 'status' | 'tipo' | 'fornecedor', valor: string) => {
    const arrayAtual = filtros[campo] || [];
    const novoArray = arrayAtual.includes(valor)
      ? arrayAtual.filter(item => item !== valor)
      : [...arrayAtual, valor];
    
    handleFiltroChange(campo, novoArray);
  };

  const limparFiltros = () => {
    onFiltrosChange({
      termo: '',
      status: [],
      tipo: [],
      fornecedor: []
    });
  };

  const contarFiltrosAtivos = () => {
    let count = 0;
    if (filtros.termo) count++;
    if (filtros.status?.length) count++;
    if (filtros.tipo?.length) count++;
    if (filtros.fornecedor?.length) count++;
    if (filtros.dataInicioFrom || filtros.dataInicioTo) count++;
    if (filtros.dataFimFrom || filtros.dataFimTo) count++;
    if (filtros.valorMin || filtros.valorMax) count++;
    if (filtros.renovacaoAutomatica !== undefined) count++;
    if (filtros.confidencial !== undefined) count++;
    if (filtros.vencendoEm) count++;
    return count;
  };

  const renderBadgeFiltros = () => {
    const badges = [];
    
    if (filtros.status?.length) {
      badges.push(
        <Badge key="status" variant="secondary" className="gap-1">
          {t('contratosAtivos.buscaAvancada.badgeStatus').replace('{count}', String(filtros.status.length))}
          <X 
            className="h-3 w-3 cursor-pointer" 
            onClick={() => handleFiltroChange('status', [])}
          />
        </Badge>
      );
    }
    
    if (filtros.tipo?.length) {
      badges.push(
        <Badge key="tipo" variant="secondary" className="gap-1">
          {t('contratosAtivos.buscaAvancada.badgeType').replace('{count}', String(filtros.tipo.length))}
          <X 
            className="h-3 w-3 cursor-pointer" 
            onClick={() => handleFiltroChange('tipo', [])}
          />
        </Badge>
      );
    }
    
    if (filtros.fornecedor?.length) {
      badges.push(
        <Badge key="fornecedor" variant="secondary" className="gap-1">
          {t('contratosAtivos.buscaAvancada.badgeSupplier').replace('{count}', String(filtros.fornecedor.length))}
          <X 
            className="h-3 w-3 cursor-pointer" 
            onClick={() => handleFiltroChange('fornecedor', [])}
          />
        </Badge>
      );
    }

    if (filtros.vencendoEm) {
      badges.push(
        <Badge key="vencimento" variant="secondary" className="gap-1">
          {t('contratosAtivos.buscaAvancada.badgeExpiring').replace('{days}', String(filtros.vencendoEm))}
          <X 
            className="h-3 w-3 cursor-pointer" 
            onClick={() => handleFiltroChange('vencendoEm', undefined)}
          />
        </Badge>
      );
    }
    
    return badges;
  };

  const filtrosAtivos = contarFiltrosAtivos();

  return (
    <div className="space-y-4">
      {/* Busca Principal */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder={t('contratosAtivos.buscaAvancada.searchPlaceholder')}
            value={filtros.termo}
            onChange={(e) => handleFiltroChange('termo', e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="relative">
              <Filter className="h-4 w-4 mr-2" />
              {t('contratosAtivos.buscaAvancada.advancedFiltersButton')}
              {filtrosAtivos > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 text-xs"
                >
                  {filtrosAtivos}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-96 p-0" align="end">
            <Card className="border-0 shadow-none">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{t('contratosAtivos.buscaAvancada.advancedFiltersButton')}</CardTitle>
                  <Button variant="ghost" size="sm" onClick={limparFiltros}>
                    {t('contratosAtivos.buscaAvancada.clearAllButton')}
                  </Button>
                </div>
                <CardDescription>
                  {t('contratosAtivos.buscaAvancada.panelDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Status */}
                <div>
                  <label className="text-sm font-medium mb-2 block">{t('contratosAtivos.buscaAvancada.statusLabel')}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {statusOptions.map(option => (
                      <label key={option.value} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filtros.status?.includes(option.value)}
                          onChange={() => handleMultiSelectChange('status', option.value)}
                          className="rounded"
                        />
                        <span className="text-sm">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Tipo */}
                <div>
                  <label className="text-sm font-medium mb-2 block">{t('contratosAtivos.buscaAvancada.typeLabel')}</label>
                  <div className="grid grid-cols-1 gap-2">
                    {tipoOptions.map(option => (
                      <label key={option.value} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filtros.tipo?.includes(option.value)}
                          onChange={() => handleMultiSelectChange('tipo', option.value)}
                          className="rounded"
                        />
                        <span className="text-sm">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Fornecedor */}
                <div>
                  <label className="text-sm font-medium mb-2 block">{t('contratosAtivos.buscaAvancada.supplierLabel')}</label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {fornecedores.map(fornecedor => (
                      <label key={fornecedor.id} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filtros.fornecedor?.includes(fornecedor.id)}
                          onChange={() => handleMultiSelectChange('fornecedor', fornecedor.id)}
                          className="rounded"
                        />
                        <span className="text-sm">{fornecedor.nome}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Datas */}
                <div>
                  <label className="text-sm font-medium mb-2 block">{t('contratosAtivos.buscaAvancada.startDateLabel')}</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("justify-start text-left font-normal", !filtros.dataInicioFrom && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {filtros.dataInicioFrom ? format(filtros.dataInicioFrom, "dd/MM/yyyy", { locale: ptBR }) : t('contratosAtivos.buscaAvancada.fromPlaceholder')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={filtros.dataInicioFrom} onSelect={(date) => handleFiltroChange('dataInicioFrom', date)} className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("justify-start text-left font-normal", !filtros.dataInicioTo && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {filtros.dataInicioTo ? format(filtros.dataInicioTo, "dd/MM/yyyy", { locale: ptBR }) : t('contratosAtivos.buscaAvancada.toPlaceholder')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={filtros.dataInicioTo} onSelect={(date) => handleFiltroChange('dataInicioTo', date)} className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">{t('contratosAtivos.buscaAvancada.endDateLabel')}</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("justify-start text-left font-normal", !filtros.dataFimFrom && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {filtros.dataFimFrom ? format(filtros.dataFimFrom, "dd/MM/yyyy", { locale: ptBR }) : t('contratosAtivos.buscaAvancada.fromPlaceholder')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={filtros.dataFimFrom} onSelect={(date) => handleFiltroChange('dataFimFrom', date)} className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("justify-start text-left font-normal", !filtros.dataFimTo && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {filtros.dataFimTo ? format(filtros.dataFimTo, "dd/MM/yyyy", { locale: ptBR }) : t('contratosAtivos.buscaAvancada.toPlaceholder')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={filtros.dataFimTo} onSelect={(date) => handleFiltroChange('dataFimTo', date)} className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <Separator />

                {/* Valor */}
                <div>
                  <label className="text-sm font-medium mb-2 block">{t('contratosAtivos.buscaAvancada.valueLabel')}</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      placeholder={t('contratosAtivos.buscaAvancada.minValuePlaceholder')}
                      value={filtros.valorMin || ''}
                      onChange={(e) => handleFiltroChange('valorMin', e.target.value ? Number(e.target.value) : undefined)}
                    />
                    <Input
                      type="number"
                      placeholder={t('contratosAtivos.buscaAvancada.maxValuePlaceholder')}
                      value={filtros.valorMax || ''}
                      onChange={(e) => handleFiltroChange('valorMax', e.target.value ? Number(e.target.value) : undefined)}
                    />
                  </div>
                </div>

                <Separator />

                {/* Vencimento */}
                <div>
                  <label className="text-sm font-medium mb-2 block">{t('contratosAtivos.buscaAvancada.expirationLabel')}</label>
                  <Select 
                    value={filtros.vencendoEm?.toString() || 'all'} 
                    onValueChange={(value) => handleFiltroChange('vencendoEm', value === 'all' ? undefined : Number(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('contratosAtivos.buscaAvancada.expirationPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('contratosAtivos.buscaAvancada.expirationAll')}</SelectItem>
                      <SelectItem value="7">{t('contratosAtivos.buscaAvancada.expiration7')}</SelectItem>
                      <SelectItem value="15">{t('contratosAtivos.buscaAvancada.expiration15')}</SelectItem>
                      <SelectItem value="30">{t('contratosAtivos.buscaAvancada.expiration30')}</SelectItem>
                      <SelectItem value="60">{t('contratosAtivos.buscaAvancada.expiration60')}</SelectItem>
                      <SelectItem value="90">{t('contratosAtivos.buscaAvancada.expiration90')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Flags */}
                <div className="space-y-3">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filtros.renovacaoAutomatica === true}
                      onChange={(e) => handleFiltroChange('renovacaoAutomatica', e.target.checked ? true : undefined)}
                      className="rounded"
                    />
                    <span className="text-sm">{t('contratosAtivos.buscaAvancada.autoRenewalLabel')}</span>
                  </label>
                  
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filtros.confidencial === true}
                      onChange={(e) => handleFiltroChange('confidencial', e.target.checked ? true : undefined)}
                      className="rounded"
                    />
                    <span className="text-sm">{t('contratosAtivos.buscaAvancada.confidentialLabel')}</span>
                  </label>
                </div>
              </CardContent>
            </Card>
          </PopoverContent>
        </Popover>
      </div>

      {/* Badges de Filtros Ativos */}
      {filtrosAtivos > 0 && (
        <div className="flex flex-wrap gap-2">
          {renderBadgeFiltros()}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={limparFiltros}
            className="h-6 px-2 text-xs"
          >
            {t('contratosAtivos.buscaAvancada.clearAllFilters')}
          </Button>
        </div>
      )}
    </div>
  );
}