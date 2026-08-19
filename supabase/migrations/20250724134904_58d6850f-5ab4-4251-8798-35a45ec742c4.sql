-- Restaurar permissões de forma manual para os usuários afetados

-- Restaurar permissões para Mathews (super_admin) - ID: 10b38ac6-2dc6-44c0-8db7-49b01adcb9a5
INSERT INTO public.user_module_permissions (user_id, module_id, can_access, can_create, can_read, can_update, can_delete)
SELECT 
  '10b38ac6-2dc6-44c0-8db7-49b01adcb9a5'::uuid as user_id,
  sm.id as module_id,
  true as can_access,
  true as can_create, 
  true as can_read,
  true as can_update,
  true as can_delete
FROM public.system_modules sm 
WHERE sm.is_active = true
ON CONFLICT (user_id, module_id) DO UPDATE SET
  can_access = EXCLUDED.can_access,
  can_create = EXCLUDED.can_create,
  can_read = EXCLUDED.can_read,
  can_update = EXCLUDED.can_update,
  can_delete = EXCLUDED.can_delete;

-- Restaurar permissões para Mathews Órigo (admin) - ID: c26e73bb-e9ae-42c0-8ff3-a0aef7c8c00a
INSERT INTO public.user_module_permissions (user_id, module_id, can_access, can_create, can_read, can_update, can_delete)
SELECT 
  'c26e73bb-e9ae-42c0-8ff3-a0aef7c8c00a'::uuid as user_id,
  sm.id as module_id,
  true as can_access,
  true as can_create, 
  true as can_read,
  true as can_update,
  CASE WHEN sm.name != 'configuracoes' THEN true ELSE false END as can_delete
FROM public.system_modules sm 
WHERE sm.is_active = true
ON CONFLICT (user_id, module_id) DO UPDATE SET
  can_access = EXCLUDED.can_access,
  can_create = EXCLUDED.can_create,
  can_read = EXCLUDED.can_read,
  can_update = EXCLUDED.can_update,
  can_delete = EXCLUDED.can_delete;