-- Synthetic fixtures only. Run in a NEW isolated local database, never production.
DO $$ BEGIN
  IF current_database() NOT LIKE 'akuris_qa_control_delete_%' THEN
    RAISE EXCEPTION 'Use an isolated akuris_qa_control_delete_* test database';
  END IF;
END $$;
CREATE TABLE public.auditorias (id uuid PRIMARY KEY, empresa_id uuid NOT NULL);
CREATE TABLE public.controles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL,
  codigo text, nome text, descricao text, tipo text, status text, criticidade text,
  responsavel_id uuid, proxima_avaliacao date, area text,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
  UNIQUE (empresa_id, codigo)
);
CREATE TABLE public.auditoria_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), auditoria_id uuid REFERENCES public.auditorias(id),
  codigo text, titulo text, descricao text, prioridade text DEFAULT 'media',
  status text DEFAULT 'pendente', responsavel_id uuid, prazo date,
  controle_vinculado_id uuid REFERENCES public.controles(id) ON DELETE SET NULL,
  controle_gerado_automaticamente boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.controles_auditorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  controle_id uuid REFERENCES public.controles(id) ON DELETE CASCADE,
  auditoria_id uuid REFERENCES public.auditorias(id), tipo_relacao text,
  UNIQUE(controle_id, auditoria_id)
);
CREATE TABLE public.auditoria_itens_evidencias (id uuid DEFAULT gen_random_uuid(), item_id uuid REFERENCES public.auditoria_itens(id) ON DELETE CASCADE);
CREATE TABLE public.auditoria_itens_comentarios (id uuid DEFAULT gen_random_uuid(), item_id uuid REFERENCES public.auditoria_itens(id) ON DELETE CASCADE);
CREATE TABLE public.audit_logs (id uuid DEFAULT gen_random_uuid(), record_id uuid, empresa_id uuid, table_name text, action text, old_values jsonb, created_at timestamptz);
INSERT INTO public.auditorias VALUES
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011'),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000022');
INSERT INTO public.auditoria_itens (auditoria_id,codigo,titulo,created_at,updated_at) VALUES
 ('00000000-0000-0000-0000-000000000001','QA-DELETED','Legacy deleted','2026-01-01','2026-01-02'),
 ('00000000-0000-0000-0000-000000000002','QA-DELETED','Legacy deleted','2026-01-01','2026-01-02'),
 ('00000000-0000-0000-0000-000000000001','QA-UNLINKED','Legacy unlinked','2026-01-01','2026-01-02');
INSERT INTO public.audit_logs (record_id,empresa_id,table_name,action,old_values,created_at) VALUES
 ('00000000-0000-0000-0000-000000000099','00000000-0000-0000-0000-000000000011','controles','DELETE','{"codigo":"QA-DELETED","nome":"Legacy deleted"}','2026-01-02');
