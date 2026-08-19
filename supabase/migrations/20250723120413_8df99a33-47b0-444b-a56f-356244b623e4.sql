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
  -- Buscar contas que estão próximas do vencimento
  FOR conta_record IN 
    SELECT 
      cp.*,
      sp.nome_sistema,
      p.user_id,
      p.nome as usuario_nome
    FROM contas_privilegiadas cp
    JOIN sistemas_privilegiados sp ON cp.sistema_id = sp.id
    JOIN profiles p ON p.empresa_id = cp.empresa_id AND p.role IN ('admin', 'super_admin')
    WHERE cp.data_expiracao IS NOT NULL 
    AND cp.status = 'ativa'
    AND cp.data_expiracao > CURRENT_DATE
    AND cp.data_expiracao <= CURRENT_DATE + INTERVAL '30 days'
  LOOP
    days_until_expiration := cp.data_expiracao - CURRENT_DATE;
    
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
      
      UPDATE contas_privilegiadas 
      SET alerta_30_dias = true 
      WHERE id = conta_record.id;
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
      
      UPDATE contas_privilegiadas 
      SET alerta_15_dias = true 
      WHERE id = conta_record.id;
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
      
      UPDATE contas_privilegiadas 
      SET alerta_7_dias = true 
      WHERE id = conta_record.id;
    END IF;
  END LOOP;
  
  -- Marcar contas expiradas como inativas
  UPDATE contas_privilegiadas 
  SET status = 'expirada'
  WHERE data_expiracao < CURRENT_DATE 
  AND status = 'ativa';
END;
$$;

-- Função para verificar aprovações pendentes
CREATE OR REPLACE FUNCTION public.check_pending_approvals_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  approval_record RECORD;
  profile_record RECORD;
  days_pending INTEGER;
  alert_message TEXT;
BEGIN
  -- Buscar aprovações pendentes há mais de 3 dias
  FOR approval_record IN 
    SELECT 
      ca.*,
      cp.usuario_beneficiario,
      sp.nome_sistema,
      p.user_id,
      p.nome as aprovador_nome
    FROM contas_aprovacoes ca
    JOIN contas_privilegiadas cp ON ca.conta_id = cp.id
    JOIN sistemas_privilegiados sp ON cp.sistema_id = sp.id
    JOIN profiles p ON ca.aprovador_id = p.user_id
    WHERE ca.status = 'pendente'
    AND ca.created_at <= CURRENT_TIMESTAMP - INTERVAL '3 days'
  LOOP
    days_pending := EXTRACT(days FROM (CURRENT_TIMESTAMP - approval_record.created_at));
    
    alert_message := format('Você tem uma aprovação pendente há %s dias para a conta "%s" no sistema "%s"', 
                           days_pending,
                           approval_record.usuario_beneficiario, 
                           approval_record.nome_sistema);
    
    PERFORM create_conta_notification(
      approval_record.user_id,
      'Aprovação Pendente - Conta Privilegiada',
      alert_message,
      'info'
    );
  END LOOP;
END;
$$;

-- Trigger para criar notificação quando nova conta precisar de aprovação
CREATE OR REPLACE FUNCTION public.notify_new_approval_needed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  approval_record RECORD;
  conta_record RECORD;
  sistema_record RECORD;
  alert_message TEXT;
BEGIN
  -- Buscar dados da conta e sistema
  SELECT * INTO conta_record FROM contas_privilegiadas WHERE id = NEW.conta_id;
  SELECT * INTO sistema_record FROM sistemas_privilegiados WHERE id = conta_record.sistema_id;
  
  alert_message := format('Nova solicitação de aprovação para conta privilegiada "%s" no sistema "%s"', 
                         conta_record.usuario_beneficiario, 
                         sistema_record.nome_sistema);
  
  PERFORM create_conta_notification(
    NEW.aprovador_id,
    'Nova Aprovação Necessária',
    alert_message,
    'info'
  );
  
  RETURN NEW;
END;
$$;

-- Criar trigger para notificações de novas aprovações
DROP TRIGGER IF EXISTS trigger_notify_new_approval ON contas_aprovacoes;
CREATE TRIGGER trigger_notify_new_approval
  AFTER INSERT ON contas_aprovacoes
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_approval_needed();