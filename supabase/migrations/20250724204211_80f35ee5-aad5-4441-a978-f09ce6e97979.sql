-- Políticas RLS para acesso público ao canal de denúncias

-- 1. Permitir acesso público à tabela empresas para busca por slug
CREATE POLICY "Public access to active companies by slug"
ON public.empresas
FOR SELECT
TO anon
USING (ativo = true);

-- 2. Permitir acesso público às categorias de denúncias
CREATE POLICY "Public access to active denuncia categories"
ON public.denuncias_categorias
FOR SELECT
TO anon
USING (ativo = true);

-- 3. Permitir acesso público às configurações de denúncias
CREATE POLICY "Public access to denuncia configurations"
ON public.denuncias_configuracoes
FOR SELECT
TO anon
USING (true);

-- 4. Permitir inserção pública de denúncias
CREATE POLICY "Public insert for denuncias"
ON public.denuncias
FOR INSERT
TO anon
WITH CHECK (true);

-- 5. Permitir consulta pública de denúncias por protocolo
CREATE POLICY "Public select denuncias by protocol"
ON public.denuncias
FOR SELECT
TO anon
USING (true);

-- 6. Permitir acesso público às movimentações de denúncias
CREATE POLICY "Public access to denuncia movements"
ON public.denuncias_movimentacoes
FOR SELECT
TO anon
USING (true);