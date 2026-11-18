INSERT INTO public.system_modules (name, display_name, description, icon, route_path, is_active, order_index)
SELECT 'relatorios', 'Relatórios', 'Relatórios e exportações consolidadas', 'FileBarChart', '/relatorios', true, 50
WHERE NOT EXISTS (SELECT 1 FROM public.system_modules WHERE name = 'relatorios');

-- Perfis que já dão acesso ao Dashboard passam a incluir Relatórios (leitura/acesso).
INSERT INTO public.permission_profile_modules (profile_id, module_id, can_access, can_read, can_create, can_update, can_delete)
SELECT ppm.profile_id, r.id, true, true, false, false, false
FROM public.permission_profile_modules ppm
JOIN public.system_modules d ON d.id = ppm.module_id AND d.name = 'dashboard'
CROSS JOIN (SELECT id FROM public.system_modules WHERE name = 'relatorios') r
WHERE ppm.can_access
  AND NOT EXISTS (SELECT 1 FROM public.permission_profile_modules x WHERE x.profile_id = ppm.profile_id AND x.module_id = r.id);

-- Permissões derivadas para os utilizadores desses perfis (mesma empresa do perfil).
INSERT INTO public.user_module_permissions (user_id, module_id, can_access, can_read, can_create, can_update, can_delete)
SELECT p.user_id, ppm.module_id, ppm.can_access, ppm.can_read, ppm.can_create, ppm.can_update, ppm.can_delete
FROM public.profiles p
JOIN public.permission_profiles pp ON pp.id = p.permission_profile_id AND (pp.empresa_id IS NULL OR pp.empresa_id = p.empresa_id)
JOIN public.permission_profile_modules ppm ON ppm.profile_id = pp.id
JOIN public.system_modules s ON s.id = ppm.module_id AND s.name = 'relatorios'
WHERE NOT EXISTS (SELECT 1 FROM public.user_module_permissions u WHERE u.user_id = p.user_id AND u.module_id = ppm.module_id);