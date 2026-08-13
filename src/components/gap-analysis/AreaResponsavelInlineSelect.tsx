import React, { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogShell } from "@/components/ui/dialog-shell";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/useDebounce";
import { supabase } from "@/integrations/supabase/client";
import { logger } from '@/lib/logger';
import { useLanguage } from '@/contexts/LanguageContext';

interface AreaResponsavelInlineSelectProps {
  requirementId: string;
  currentArea?: string | null;
  onAreaChange?: (area: string) => void;
}

const AREA_KEYS = [
  "ti", "financeiro", "rh", "juridico", "compliance",
  "auditoriaInterna", "operacoes", "comercial", "marketing", "governanca",
];

export const AreaResponsavelInlineSelect: React.FC<AreaResponsavelInlineSelectProps> = ({
  requirementId,
  currentArea,
  onAreaChange
}) => {
  const { t } = useLanguage();
  const AREAS_PADRAO = AREA_KEYS.map(k => t(`gapAnalysis.areas.${k}`));
  const [customAreas, setCustomAreas] = useState<string[]>([]);
  const [newArea, setNewArea] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedArea, setSelectedArea] = useState(currentArea || "sem_area");
  const { profile } = useAuth();

  const debouncedArea = useDebounce(selectedArea, 500);

  // Carregar áreas customizadas do localStorage
  useEffect(() => {
    if (profile?.empresa_id) {
      const savedAreas = localStorage.getItem(`custom_areas_${profile.empresa_id}`);
      if (savedAreas) {
        try {
          setCustomAreas(JSON.parse(savedAreas));
        } catch (error) {
          logger.error("Erro ao carregar áreas customizadas:", { error: error instanceof Error ? error.message : String(error) });
        }
      }
    }
  }, [profile?.empresa_id]);

  // Sincronizar com prop externa
  useEffect(() => {
    setSelectedArea(currentArea || "sem_area");
  }, [currentArea]);

  // Auto-save quando área é alterada (debounced)
  useEffect(() => {
    if (debouncedArea !== currentArea && requirementId) {
      handleSaveArea(debouncedArea);
    }
  }, [debouncedArea]);

  const handleSaveArea = async (area: string) => {
    try {
      const areaToSave = area === "sem_area" ? null : area;
      const { error } = await supabase
        .from('gap_analysis_requirements')
        .update({ area_responsavel: areaToSave })
        .eq('id', requirementId);

      if (error) throw error;

      onAreaChange?.(area === "sem_area" ? "" : area);
    } catch (error) {
      logger.error('Erro ao salvar área responsável:', { error: error instanceof Error ? error.message : String(error) });
      toast.error(t('gapAnalysis.areas.saveError'));
      // Reverter para valor anterior em caso de erro
      setSelectedArea(currentArea || "sem_area");
    }
  };

  // Salvar áreas customizadas no localStorage
  const saveCustomAreas = (areas: string[]) => {
    if (profile?.empresa_id) {
      localStorage.setItem(`custom_areas_${profile.empresa_id}`, JSON.stringify(areas));
      setCustomAreas(areas);
    }
  };

  const handleAddArea = () => {
    if (!newArea.trim()) {
      toast.error(t('gapAnalysis.areas.enterName'));
      return;
    }

    const allAreas = [...AREAS_PADRAO, ...customAreas];
    if (allAreas.some(area => area.toLowerCase() === newArea.trim().toLowerCase())) {
      toast.error(t('gapAnalysis.areas.alreadyExists'));
      return;
    }

    const updatedAreas = [...customAreas, newArea.trim()];
    saveCustomAreas(updatedAreas);
    setSelectedArea(newArea.trim());
    setNewArea("");
    setIsDialogOpen(false);
    toast.success(t('gapAnalysis.areas.addSuccess'));
  };

  const allAreas = [...AREAS_PADRAO, ...customAreas];

  return (
    <div className="flex items-center gap-1">
      <Select value={selectedArea} onValueChange={setSelectedArea}>
        <SelectTrigger className="min-w-[180px] h-8">
          <SelectValue placeholder={t('gapAnalysis.areas.selectPlaceholder')} />
        </SelectTrigger>
        <SelectContent 
          className="bg-background border-border shadow-lg"
          position="popper"
          side="bottom"
          align="start"
          sideOffset={4}
          style={{ zIndex: 9999 }}
        >
          <SelectItem value="sem_area">{t('gapAnalysis.areas.none')}</SelectItem>
          {allAreas.map((area) => (
            <SelectItem key={area} value={area}>
              {area}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 w-8 p-0 shrink-0"
        onClick={() => setIsDialogOpen(true)}
      >
        <Plus className="h-3 w-3" strokeWidth={1.5}/>
      </Button>
      <DialogShell
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        icon={Plus}
        title={t('gapAnalysis.areas.addNewTitle')}
        size="sm"
        hideFooter
      >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newArea">{t('gapAnalysis.areas.nameLabel')}</Label>
              <div className="flex gap-2">
                <Input
                  id="newArea"
                  value={newArea}
                  onChange={(e) => setNewArea(e.target.value)}
                  placeholder={t('gapAnalysis.areas.namePlaceholder')}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddArea()}
                />
                <Button onClick={handleAddArea} size="sm">
                  <Plus className="h-4 w-4" strokeWidth={1.5}/>
                </Button>
              </div>
            </div>
          </div>
      </DialogShell>
    </div>
  );
};