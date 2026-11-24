CREATE TABLE public.mesh_grupos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL UNIQUE REFERENCES public.empresas(id) ON DELETE CASCADE,
  mesh_id text NOT NULL UNIQUE,
  instalador_url text,
  ultima_sincronizacao timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mesh_grupos TO authenticated;
GRANT ALL ON public.mesh_grupos TO service_role;
ALTER TABLE public.mesh_grupos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mesh_grupos_select_empresa" ON public.mesh_grupos FOR SELECT TO authenticated
  USING (empresa_id = (SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid()));

ALTER TABLE public.ativos
  ADD COLUMN IF NOT EXISTS mesh_node_id text,
  ADD COLUMN IF NOT EXISTS agente_ultimo_contato timestamptz,
  ADD COLUMN IF NOT EXISTS agente_online boolean;
CREATE UNIQUE INDEX IF NOT EXISTS ativos_empresa_mesh_node_uidx ON public.ativos (empresa_id, mesh_node_id) WHERE mesh_node_id IS NOT NULL;