ALTER TABLE public.integration_connections DROP CONSTRAINT integration_connections_provider_check;
ALTER TABLE public.integration_connections ADD CONSTRAINT integration_connections_provider_check CHECK (provider = ANY (ARRAY['microsoft','microsoft365','entra_id','intune','aws','github','sharepoint','onedrive','google_drive']));
ALTER TABLE public.ativos ADD COLUMN IF NOT EXISTS intune_device_id text;
CREATE UNIQUE INDEX IF NOT EXISTS ativos_empresa_intune_uidx ON public.ativos(empresa_id, intune_device_id) WHERE intune_device_id IS NOT NULL;