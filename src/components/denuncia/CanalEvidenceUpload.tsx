import { useRef, useState } from 'react';
import { Paperclip, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { canalFileMime } from '@/lib/canal-report-form';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

export function CanalEvidenceUpload({ denunciaId, codigo }: { denunciaId: string; codigo: string }) {
  const { t } = useLanguage();
  const [items, setItems] = useState<{ file: File; status: 'pending' | 'done' | 'failed' }[]>([]);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const lock = useRef(false);
  const send = async () => {
    if (lock.current) return;
    lock.current = true;
    const pending = items.filter((item) => item.status !== 'done');
    try {
      for (const [index, item] of pending.entries()) {
        setProgress({ current: index + 1, total: pending.length });
        try {
          const { data: request, error: requestError } = await supabase.functions.invoke('create-denuncia', { body: {
            action: 'anexo_url', denuncia_id: denunciaId, codigo, nome: item.file.name, tipo: canalFileMime(item.file), tamanho: item.file.size,
          } });
          if (requestError || request?.error || !request?.token) throw new Error('upload_unavailable');
          const { error: uploadError } = await supabase.storage.from('denuncias-anexos').uploadToSignedUrl(request.caminho, request.token, item.file);
          if (uploadError) throw uploadError;
          const { data: confirmed, error: confirmError } = await supabase.functions.invoke('create-denuncia', { body: {
            action: 'anexo_confirmar', denuncia_id: denunciaId, codigo, anexo_id: request.anexo_id,
          } });
          if (confirmError || confirmed?.error) throw new Error('upload_not_confirmed');
          setItems((current) => current.map((entry) => entry === item ? { ...entry, status: 'done' } : entry));
        } catch {
          setItems((current) => current.map((entry) => entry === item ? { ...entry, status: 'failed' } : entry));
        }
      }
    } finally { setProgress(null); lock.current = false; }
  };
  return <section className="canal-case-section">
    <h2>{t('canalExperience.extraEvidence')}</h2><p className="canal-note">{t('canalExperience.extraEvidenceHint')}</p>
    <div className="canal-upload mt-5"><Paperclip aria-hidden="true" /><div className="min-w-0 flex-1"><label htmlFor="canal-follow-up-files">{t('publicPortal.denunciaForm.attachCta')}</label><p className="canal-note">{t('canalExperience.fileTypes')}</p></div>
      <input id="canal-follow-up-files" className="sr-only" type="file" multiple disabled={!!progress} accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" aria-label={t('publicPortal.denunciaForm.attach')}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []); event.target.value = ''; setError('');
          if (items.length + files.length > 5) { setError(t('publicPortal.denunciaForm.maxFiles')); return; }
          const invalid = files.find((file) => !file.size || file.size > 10 * 1024 * 1024 || !canalFileMime(file));
          if (invalid) { setError(t(invalid.size > 10 * 1024 * 1024 ? 'publicPortal.denunciaForm.fileTooLarge' : 'canalExperience.invalidFile', { name: invalid.name })); return; }
          setItems((current) => [...current, ...files.map((file) => ({ file, status: 'pending' as const }))]);
        }} />
    </div>
    <p className="canal-note">{t('publicPortal.denunciaForm.anexoMetadados')}</p>
    {error && <p role="alert" className="canal-error">{error}</p>}
    <ul className="mt-4 space-y-3" aria-live="polite">{items.map((item, index) => <li key={index} className="flex items-center gap-3 text-sm">
      {item.status === 'done' && <Check className="h-4 w-4 text-state-done" aria-hidden="true" />}<div className="min-w-0 flex-1"><span className="break-all">{item.file.name}</span>{item.status !== 'pending' && <p className={item.status === 'done' ? 'text-state-done text-xs' : 'text-destructive text-xs'}>{t(item.status === 'done' ? 'canalExperience.uploaded' : 'canalExperience.uploadFailed')}</p>}</div>
      {item.status !== 'done' && <Button variant="ghost" size="icon" disabled={!!progress} aria-label={t('canalExperience.removeFile', { name: item.file.name })} onClick={() => setItems((current) => current.filter((_, i) => i !== index))}><X size={16} /></Button>}
    </li>)}</ul>
    {items.some((item) => item.status !== 'done') && <Button className="mt-4 canal-cta" disabled={!!progress} onClick={send}>{progress ? t('canalExperience.uploading', progress) : t('canalExperience.sendFiles')}</Button>}
  </section>;
}
