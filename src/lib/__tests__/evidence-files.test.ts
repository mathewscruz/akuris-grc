import { describe, expect, it, vi, beforeEach } from 'vitest';
import { evidenceObjectName, EVIDENCE_UPLOAD_OPTIONS } from '../evidence-files';
const { from, sign } = vi.hoisted(() => ({ from: vi.fn(), sign: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { storage: { from } } }));
import { downloadStorageFile, extractStoragePath } from '../storage';

beforeEach(() => {
  vi.clearAllMocks();
  from.mockReturnValue({ createSignedUrl: sign });
  sign.mockResolvedValue({ data: { signedUrl: 'https://storage.example/signed' }, error: null });
  vi.spyOn(window, 'open').mockImplementation(() => null);
});

describe('private evidence in any format', () => {
  it.each(['evidence.zip', 'archive.7z', 'mail.eml', 'outlook.msg', 'data.json', 'audit.log',
    'dados.csv', 'slides.pptx', 'run.exe', 'page.html', 'drawing.svg', 'README', '.env'])('accepts %s as opaque data', name => {
    expect(evidenceObjectName(name)).toMatch(/^[a-zA-Z0-9._-]+$/);
    expect(EVIDENCE_UPLOAD_OPTIONS).toEqual({ contentType: 'application/octet-stream', upsert: false });
  });
  it('sanitizes object keys without collisions or path traversal', () => {
    const first = evidenceObjectName('../Relatório / inspeção #1?.msg');
    expect(first).not.toMatch(/[/\\\s?#]/);
    expect(first).toMatch(/\.msg$/);
    expect(evidenceObjectName('evidence.msg')).not.toEqual(evidenceObjectName('evidence.msg'));
    expect(evidenceObjectName('x'.repeat(400) + '.msg').length).toBeLessThan(200);
  });
  it('downloads signed private files with their original name, never a public URL', async () => {
    expect(await downloadStorageFile('auditoria-evidencias', 'item/file.msg', 'Relatório.msg')).toBe(true);
    expect(sign).toHaveBeenCalledWith('item/file.msg', 300, { download: 'Relatório.msg' });
    expect(window.open).toHaveBeenCalledWith('https://storage.example/signed', '_blank', 'noopener,noreferrer');
  });
  it('supports legacy encoded public/signed URLs without losing literal percent in raw keys', () => {
    expect(extractStoragePath('bucket', 'https://old/storage/v1/object/public/bucket/a/relat%C3%B3rio.msg')).toBe('a/relatório.msg');
    expect(extractStoragePath('bucket', 'https://old/storage/v1/object/sign/bucket/a/test%20file.zip?token=old')).toBe('a/test file.zip');
    expect(extractStoragePath('bucket', 'a/50%20complete.msg')).toBe('a/50%20complete.msg');
  });
  it('never opens the original URL when signing is denied', async () => {
    sign.mockResolvedValue({ error: { message: 'denied' }, data: null });
    expect(await downloadStorageFile('bucket', 'tenant/item.html')).toBe(false);
    expect(window.open).not.toHaveBeenCalled();
  });
  it('does not sign an unrelated URL and removes unsafe download header characters', async () => {
    expect(await downloadStorageFile('bucket', 'https://unrelated.example/x')).toBe(false);
    expect(sign).not.toHaveBeenCalled();
    await downloadStorageFile('bucket', 'a/file', 'test\r\n/file.msg');
    expect(sign).toHaveBeenCalledWith('a/file', 300, { download: 'test___file.msg' });
  });
});
