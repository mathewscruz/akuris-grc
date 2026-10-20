CREATE TABLE public.ia_uso_modelos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NULL,
  funcionalidade text NOT NULL DEFAULT 'desconhecida',
  modelo text NOT NULL,
  reserva boolean NOT NULL DEFAULT false,
  tokens_entrada integer NULL,
  tokens_saida integer NULL,
  duracao_ms integer NULL,
  sucesso boolean NOT NULL DEFAULT true,
  status_http integer NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ia_uso_modelos TO authenticated;
GRANT ALL ON public.ia_uso_modelos TO service_role;
ALTER TABLE public.ia_uso_modelos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admin lê uso de IA" ON public.ia_uso_modelos
  FOR SELECT TO authenticated USING (public.is_super_admin());
CREATE INDEX ia_uso_modelos_created_modelo_idx ON public.ia_uso_modelos (created_at, modelo);