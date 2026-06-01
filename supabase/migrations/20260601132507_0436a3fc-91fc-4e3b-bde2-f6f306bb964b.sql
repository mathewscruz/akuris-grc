INSERT INTO public.user_module_permissions (user_id, module_id, can_access, can_create, can_read, can_update, can_delete)
SELECT p.user_id, '2b2ac3fe-4076-4aae-9702-8d4128996125'::uuid, true, true, true, true,
  CASE WHEN p.role IN ('admin','super_admin') THEN true ELSE false END
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_module_permissions ump
  WHERE ump.user_id = p.user_id
    AND ump.module_id = '2b2ac3fe-4076-4aae-9702-8d4128996125'
);