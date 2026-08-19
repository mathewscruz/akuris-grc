-- Inserir categorias padrão para empresas existentes
DO $$
DECLARE
    empresa_record RECORD;
    config_exists BOOLEAN;
BEGIN
    -- Para cada empresa no sistema
    FOR empresa_record IN SELECT id FROM empresas LOOP
        -- Verificar se já existe configuração
        SELECT EXISTS(SELECT 1 FROM denuncias_configuracoes WHERE empresa_id = empresa_record.id) INTO config_exists;
        
        -- Se não existe configuração, criar
        IF NOT config_exists THEN
            INSERT INTO denuncias_configuracoes (
                empresa_id,
                token_publico,
                texto_apresentacao,
                politica_privacidade
            ) VALUES (
                empresa_record.id,
                encode(gen_random_bytes(32), 'hex'),
                'Utilize este canal para reportar irregularidades de forma segura e confidencial. Sua denúncia será tratada com total sigilo e imparcialidade.',
                'Ao enviar esta denúncia, você declara que as informações fornecidas são verdadeiras e está ciente de que o tratamento será feito de forma confidencial e em conformidade com as leis vigentes.'
            );
        END IF;

        -- Inserir categorias padrão se não existirem
        INSERT INTO denuncias_categorias (empresa_id, nome, descricao, cor) VALUES
            (empresa_record.id, 'Assédio', 'Casos de assédio moral ou sexual', '#EF4444'),
            (empresa_record.id, 'Corrupção', 'Práticas de corrupção e suborno', '#F97316'),
            (empresa_record.id, 'Fraude', 'Fraudes financeiras ou documentais', '#F59E0B'),
            (empresa_record.id, 'Ética', 'Violações do código de ética', '#3B82F6'),
            (empresa_record.id, 'Discriminação', 'Casos de discriminação', '#8B5CF6'),
            (empresa_record.id, 'Conflito de Interesses', 'Situações de conflito de interesse', '#EC4899'),
            (empresa_record.id, 'Outro', 'Outras irregularidades', '#6B7280')
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;