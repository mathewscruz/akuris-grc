import React, { Suspense, createContext, useCallback, useContext, useMemo, useState } from 'react';

const DocGenDialog = React.lazy(() => import('@/components/documentos/DocGenDialog').then((module) => ({ default: module.DocGenDialog })));

export type DocGenMode = 'generate' | 'validate';

export interface DocGenRequirementContext {
  requirementId: string;
  requirementCode: string;
  requirementTitle: string;
}

export interface OpenDocGenOptions {
  frameworkId?: string;
  frameworkName?: string;
  mode?: DocGenMode;
  requirementContext?: DocGenRequirementContext;
  /** Called after a document is saved/validated and the user closes the dialog */
  onDone?: () => void;
  /**
   * Chamado quando o documento é gravado a partir de um requisito.
   *
   * Fecha o ciclo: quem gerou a política a partir do requisito não devia ter
   * de a ir buscar ao módulo Documentos para a anexar como prova.
   */
  onDocumentoVinculado?: (documento: { id: string; nome: string; arquivo_url: string | null }) => void;
}

interface DocGenContextValue {
  openDocGen: (options?: OpenDocGenOptions) => void;
  closeDocGen: () => void;
  isOpen: boolean;
}

const DocGenContext = createContext<DocGenContextValue | undefined>(undefined);

/**
 * Single global entry-point for the "Gerador de Documentos (IA)" (DocGen).
 * Use `useDocGen().openDocGen({...})` from anywhere.
 * The dialog itself is mounted exactly once in App.tsx via <DocGenProvider>.
 */
export const DocGenProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [opts, setOpts] = useState<OpenDocGenOptions>({});

  const openDocGen = useCallback((options: OpenDocGenOptions = {}) => {
    setOpts(options);
    setIsOpen(true);
  }, []);

  const closeDocGen = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) {
      opts.onDone?.();
    }
  }, [opts]);

  const value = useMemo<DocGenContextValue>(() => ({
    openDocGen,
    closeDocGen,
    isOpen,
  }), [openDocGen, closeDocGen, isOpen]);

  return (
    <DocGenContext.Provider value={value}>
      {children}
      {isOpen && (
        <Suspense fallback={null}>
          <DocGenDialog
            open={isOpen}
            onOpenChange={handleOpenChange}
            frameworkId={opts.frameworkId}
            frameworkName={opts.frameworkName}
            mode={opts.mode}
            requirementContext={opts.requirementContext}
            onDocumentoVinculado={opts.onDocumentoVinculado}
            onDocumentSaved={opts.onDone}
          />
        </Suspense>
      )}
    </DocGenContext.Provider>
  );
};

export const useDocGen = (): DocGenContextValue => {
  const ctx = useContext(DocGenContext);
  if (!ctx) {
    throw new Error('useDocGen must be used inside <DocGenProvider>');
  }
  return ctx;
};
