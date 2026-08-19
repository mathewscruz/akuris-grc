-- Função para criar notificações de contas privilegiadas
CREATE OR REPLACE FUNCTION public.create_conta_notification(
  p_user_id uuid,
  p_title text,
  p_message text,
  p_type text DEFAULT 'warning',
  p_link_to text DEFAULT '/contas-privilegiadas'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    type,
    link_to
  ) VALUES (
    p_user_id,
    p_title,
    p_message,
    p_type,
    p_link_to
  );
END;
$$;

-- Função para verificar e criar alertas de expiração
CREATE OR REPLACE FUNCTION public.check_conta_expiration_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  conta_record RECORD;
  profile_record RECORD;
  days_until_expiration INTEGER;
  alert_message TEXT;
BEGIN
  -- Buscar contas que estão próximas do vencimento e perfis de admin
  FOR conta_record IN 
    SELECT 
      cp.*,
      sp.nome_sistema
    FROM contas_privilegiadas cp
    JOIN sistemas_privilegiados sp ON cp.sistema_id = sp.id
    WHERE cp.data_expiracao IS NOT NULL 
    AND cp.status = 'ativa'
    AND cp.data_expiracao > CURRENT_DATE
    AND cp.data_expiracao <= CURRENT_DATE + INTERVAL '30 days'
  LOOP
    days_until_expiration := conta_record.data_expiracao - CURRENT_DATE;
    
    -- Buscar admins da empresa para notificar
    FOR profile_record IN 
      SELECT user_id, nome FROM profiles 
      WHERE empresa_id = conta_record.empresa_id 
      AND role IN ('admin', 'super_admin')
    LOOP
      -- Verificar se deve enviar alerta de 30 dias
      IF days_until_expiration <= 30 AND NOT conta_record.alerta_30_dias THEN
        alert_message := format('A conta privilegiada "%s" no sistema "%s" expira em %s dias (%s)', 
                               conta_record.usuario_beneficiario, 
                               conta_record.nome_sistema,
                               days_until_expiration,
                               to_char(conta_record.data_expiracao, 'DD/MM/YYYY'));
        
        PERFORM create_conta_notification(
          profile_record.user_id,
          'Conta Privilegiada Expirando em 30 Dias',
          alert_message,
          'warning'
        );
      END IF;
      
      -- Verificar se deve enviar alerta de 15 dias
      IF days_until_expiration <= 15 AND NOT conta_record.alerta_15_dias THEN
        alert_message := format('URGENTE: A conta privilegiada "%s" no sistema "%s" expira em %s dias (%s)', 
                               conta_record.usuario_beneficiario, 
                               conta_record.nome_sistema,
                               days_until_expiration,
                               to_char(conta_record.data_expiracao, 'DD/MM/YYYY'));
        
        PERFORM create_conta_notification(
          profile_record.user_id,
          'Conta Privilegiada Expirando em 15 Dias',
          alert_message,
          'error'
        );
      END IF;
      
      -- Verificar se deve enviar alerta de 7 dias
      IF days_until_expiration <= 7 AND NOT conta_record.alerta_7_dias THEN
        alert_message := format('CRÍTICO: A conta privilegiada "%s" no sistema "%s" expira em %s dias (%s)', 
                               conta_record.usuario_beneficiario, 
                               conta_record.nome_sistema,
                               days_until_expiration,
                               to_char(conta_record.data_expiracao, 'DD/MM/YYYY'));
        
        PERFORM create_conta_notification(
          profile_record.user_id,
          'Conta Privilegiada Expirando em 7 Dias',
          alert_message,
          'error'
        );
      END IF;
    END LOOP;
    
    -- Atualizar flags de alerta apenas uma vez por conta
    IF days_until_expiration <= 30 AND NOT conta_record.alerta_30_dias THEN
      UPDATE contas_privilegiadas SET alerta_30_dias = true WHERE id = conta_record.id;
    END IF;
    IF days_until_expiration <= 15 AND NOT conta_record.alerta_15_dias THEN
      UPDATE contas_privilegiadas SET alerta_15_dias = true WHERE id = conta_record.id;
    END IF;
    IF days_until_expiration <= 7 AND NOT conta_record.alerta_7_dias THEN
      UPDATE contas_privilegiadas SET alerta_7_dias = true WHERE id = conta_record.id;
    END IF;
  END LOOP;
  
  -- Marcar contas expiradas como inativas
  UPDATE contas_privilegiadas 
  SET status = 'expirada'
  WHERE data_expiracao < CURRENT_DATE 
  AND status = 'ativa';
END;
$$;

-- Função para verificar se uma conta privilegiada pertence à empresa do usuário
CREATE OR REPLACE FUNCTION public.conta_privilegiada_pertence_empresa(conta_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM contas_privilegiadas 
    WHERE id = conta_id AND empresa_id = get_user_empresa_id()
  );
$$;