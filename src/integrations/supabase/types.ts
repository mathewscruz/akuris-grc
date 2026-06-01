export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      access_review_history: {
        Row: {
          acao_tomada: string
          conta_id: string
          created_at: string
          data_revisao: string
          decisao: string
          email_beneficiario: string | null
          empresa_id: string
          id: string
          justificativa_revisor: string | null
          nivel_privilegio: string
          review_id: string
          revisado_por: string | null
          sistema_nome: string
          tipo_acesso: string
          usuario_beneficiario: string
        }
        Insert: {
          acao_tomada: string
          conta_id: string
          created_at?: string
          data_revisao: string
          decisao: string
          email_beneficiario?: string | null
          empresa_id: string
          id?: string
          justificativa_revisor?: string | null
          nivel_privilegio: string
          review_id: string
          revisado_por?: string | null
          sistema_nome: string
          tipo_acesso: string
          usuario_beneficiario: string
        }
        Update: {
          acao_tomada?: string
          conta_id?: string
          created_at?: string
          data_revisao?: string
          decisao?: string
          email_beneficiario?: string | null
          empresa_id?: string
          id?: string
          justificativa_revisor?: string | null
          nivel_privilegio?: string
          review_id?: string
          revisado_por?: string | null
          sistema_nome?: string
          tipo_acesso?: string
          usuario_beneficiario?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_review_history_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas_privilegiadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_review_history_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_review_history_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "access_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_review_history_revisado_por_fkey"
            columns: ["revisado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      access_review_items: {
        Row: {
          conta_id: string
          created_at: string
          data_concessao: string | null
          data_expiracao: string | null
          data_revisao: string | null
          decisao: string
          email_beneficiario: string | null
          id: string
          justificativa_original: string | null
          justificativa_revisor: string | null
          nivel_privilegio: string
          nova_data_expiracao: string | null
          observacoes_revisor: string | null
          review_id: string
          revisado_por: string | null
          tipo_acesso: string
          updated_at: string
          usuario_beneficiario: string
        }
        Insert: {
          conta_id: string
          created_at?: string
          data_concessao?: string | null
          data_expiracao?: string | null
          data_revisao?: string | null
          decisao?: string
          email_beneficiario?: string | null
          id?: string
          justificativa_original?: string | null
          justificativa_revisor?: string | null
          nivel_privilegio: string
          nova_data_expiracao?: string | null
          observacoes_revisor?: string | null
          review_id: string
          revisado_por?: string | null
          tipo_acesso: string
          updated_at?: string
          usuario_beneficiario: string
        }
        Update: {
          conta_id?: string
          created_at?: string
          data_concessao?: string | null
          data_expiracao?: string | null
          data_revisao?: string | null
          decisao?: string
          email_beneficiario?: string | null
          id?: string
          justificativa_original?: string | null
          justificativa_revisor?: string | null
          nivel_privilegio?: string
          nova_data_expiracao?: string | null
          observacoes_revisor?: string | null
          review_id?: string
          revisado_por?: string | null
          tipo_acesso?: string
          updated_at?: string
          usuario_beneficiario?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_review_items_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas_privilegiadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_review_items_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "access_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_review_items_revisado_por_fkey"
            columns: ["revisado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      access_reviews: {
        Row: {
          contas_aprovadas: number
          contas_revisadas: number
          contas_revogadas: number
          created_at: string
          created_by: string
          data_conclusao: string | null
          data_criacao: string
          data_inicio: string
          data_limite: string
          descricao: string | null
          empresa_id: string
          id: string
          link_token: string | null
          nome_revisao: string
          observacoes: string | null
          responsavel_revisao: string
          sistema_id: string
          status: string
          tipo_revisao: string
          total_contas: number
          updated_at: string
        }
        Insert: {
          contas_aprovadas?: number
          contas_revisadas?: number
          contas_revogadas?: number
          created_at?: string
          created_by: string
          data_conclusao?: string | null
          data_criacao?: string
          data_inicio?: string
          data_limite: string
          descricao?: string | null
          empresa_id: string
          id?: string
          link_token?: string | null
          nome_revisao: string
          observacoes?: string | null
          responsavel_revisao: string
          sistema_id: string
          status?: string
          tipo_revisao: string
          total_contas?: number
          updated_at?: string
        }
        Update: {
          contas_aprovadas?: number
          contas_revisadas?: number
          contas_revogadas?: number
          created_at?: string
          created_by?: string
          data_conclusao?: string | null
          data_criacao?: string
          data_inicio?: string
          data_limite?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          link_token?: string | null
          nome_revisao?: string
          observacoes?: string | null
          responsavel_revisao?: string
          sistema_id?: string
          status?: string
          tipo_revisao?: string
          total_contas?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_reviews_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "access_reviews_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_reviews_responsavel_revisao_fkey"
            columns: ["responsavel_revisao"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "access_reviews_sistema_id_fkey"
            columns: ["sistema_id"]
            isOneToOne: false
            referencedRelation: "sistemas_privilegiados"
            referencedColumns: ["id"]
          },
        ]
      }
      api_inbound_webhooks: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          created_by: string | null
          descricao: string | null
          empresa_id: string
          id: string
          mapeamento_campos: Json | null
          modulo_destino: string
          nome: string
          tipo_evento: string
          total_recebidos: number | null
          ultimo_recebimento: string | null
          updated_at: string | null
          webhook_token: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          empresa_id: string
          id?: string
          mapeamento_campos?: Json | null
          modulo_destino: string
          nome: string
          tipo_evento: string
          total_recebidos?: number | null
          ultimo_recebimento?: string | null
          updated_at?: string | null
          webhook_token: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          mapeamento_campos?: Json | null
          modulo_destino?: string
          nome?: string
          tipo_evento?: string
          total_recebidos?: number | null
          ultimo_recebimento?: string | null
          updated_at?: string | null
          webhook_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_inbound_webhooks_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          api_key: string
          ativo: boolean | null
          created_at: string | null
          created_by: string | null
          empresa_id: string
          expires_at: string | null
          id: string
          ip_whitelist: string[] | null
          nome: string
          permissoes: string[] | null
          prefixo: string
          rate_limit_por_minuto: number | null
          total_requisicoes: number | null
          ultimo_uso: string | null
          updated_at: string | null
        }
        Insert: {
          api_key: string
          ativo?: boolean | null
          created_at?: string | null
          created_by?: string | null
          empresa_id: string
          expires_at?: string | null
          id?: string
          ip_whitelist?: string[] | null
          nome: string
          permissoes?: string[] | null
          prefixo: string
          rate_limit_por_minuto?: number | null
          total_requisicoes?: number | null
          ultimo_uso?: string | null
          updated_at?: string | null
        }
        Update: {
          api_key?: string
          ativo?: boolean | null
          created_at?: string | null
          created_by?: string | null
          empresa_id?: string
          expires_at?: string | null
          id?: string
          ip_whitelist?: string[] | null
          nome?: string
          permissoes?: string[] | null
          prefixo?: string
          rate_limit_por_minuto?: number | null
          total_requisicoes?: number | null
          ultimo_uso?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      api_request_logs: {
        Row: {
          api_key_id: string | null
          created_at: string | null
          empresa_id: string
          endpoint: string
          id: string
          ip_address: unknown
          metodo: string
          request_body: Json | null
          response_time_ms: number | null
          status_code: number | null
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string | null
          empresa_id: string
          endpoint: string
          id?: string
          ip_address?: unknown
          metodo: string
          request_body?: Json | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string | null
          empresa_id?: string
          endpoint?: string
          id?: string
          ip_address?: unknown
          metodo?: string
          request_body?: Json | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_request_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_request_logs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_agents: {
        Row: {
          agent_token: string
          created_at: string | null
          empresa_id: string
          hostname: string
          id: string
          installed_at: string | null
          ip_address: unknown
          last_heartbeat: string | null
          mac_address: string | null
          operating_system: string | null
          os_version: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          agent_token: string
          created_at?: string | null
          empresa_id: string
          hostname: string
          id?: string
          installed_at?: string | null
          ip_address?: unknown
          last_heartbeat?: string | null
          mac_address?: string | null
          operating_system?: string | null
          os_version?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_token?: string
          created_at?: string | null
          empresa_id?: string
          hostname?: string
          id?: string
          installed_at?: string | null
          ip_address?: unknown
          last_heartbeat?: string | null
          mac_address?: string | null
          operating_system?: string | null
          os_version?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_agents_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      ativos: {
        Row: {
          cliente: string | null
          created_at: string
          criticidade: string | null
          data_aquisicao: string | null
          descricao: string | null
          empresa_id: string
          fornecedor: string | null
          id: string
          imei: string | null
          localizacao: string | null
          nome: string
          proprietario: string | null
          quantidade: number | null
          status: string | null
          tags: string[] | null
          tipo: string
          updated_at: string
          valor_negocio: string | null
          versao: string | null
        }
        Insert: {
          cliente?: string | null
          created_at?: string
          criticidade?: string | null
          data_aquisicao?: string | null
          descricao?: string | null
          empresa_id: string
          fornecedor?: string | null
          id?: string
          imei?: string | null
          localizacao?: string | null
          nome: string
          proprietario?: string | null
          quantidade?: number | null
          status?: string | null
          tags?: string[] | null
          tipo: string
          updated_at?: string
          valor_negocio?: string | null
          versao?: string | null
        }
        Update: {
          cliente?: string | null
          created_at?: string
          criticidade?: string | null
          data_aquisicao?: string | null
          descricao?: string | null
          empresa_id?: string
          fornecedor?: string | null
          id?: string
          imei?: string | null
          localizacao?: string | null
          nome?: string
          proprietario?: string | null
          quantidade?: number | null
          status?: string | null
          tags?: string[] | null
          tipo?: string
          updated_at?: string
          valor_negocio?: string | null
          versao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ativos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      ativos_chaves_criptograficas: {
        Row: {
          algoritmo: string | null
          ambiente: string
          arquivo_publico_url: string | null
          created_at: string | null
          created_by: string | null
          criticidade: string | null
          data_criacao: string
          data_proxima_rotacao: string
          data_ultima_rotacao: string | null
          empresa_id: string
          id: string
          localizacao: string
          nome: string
          observacoes: string | null
          periodicidade_rotacao: string | null
          responsavel: string | null
          rotacao_automatica: boolean | null
          sistema_aplicacao: string | null
          status: string | null
          tags: string[] | null
          tipo_chave: string
          updated_at: string | null
        }
        Insert: {
          algoritmo?: string | null
          ambiente: string
          arquivo_publico_url?: string | null
          created_at?: string | null
          created_by?: string | null
          criticidade?: string | null
          data_criacao: string
          data_proxima_rotacao: string
          data_ultima_rotacao?: string | null
          empresa_id: string
          id?: string
          localizacao: string
          nome: string
          observacoes?: string | null
          periodicidade_rotacao?: string | null
          responsavel?: string | null
          rotacao_automatica?: boolean | null
          sistema_aplicacao?: string | null
          status?: string | null
          tags?: string[] | null
          tipo_chave: string
          updated_at?: string | null
        }
        Update: {
          algoritmo?: string | null
          ambiente?: string
          arquivo_publico_url?: string | null
          created_at?: string | null
          created_by?: string | null
          criticidade?: string | null
          data_criacao?: string
          data_proxima_rotacao?: string
          data_ultima_rotacao?: string | null
          empresa_id?: string
          id?: string
          localizacao?: string
          nome?: string
          observacoes?: string | null
          periodicidade_rotacao?: string | null
          responsavel?: string | null
          rotacao_automatica?: boolean | null
          sistema_aplicacao?: string | null
          status?: string | null
          tags?: string[] | null
          tipo_chave?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ativos_licencas: {
        Row: {
          arquivo_nome: string | null
          arquivo_url: string | null
          created_at: string | null
          created_by: string | null
          criticidade: string | null
          data_aquisicao: string | null
          data_inicio: string
          data_renovacao: string | null
          data_vencimento: string
          departamento: string | null
          empresa_id: string
          fornecedor: string | null
          id: string
          nome: string
          numero_licenca: string | null
          observacoes: string | null
          periodicidade: string | null
          quantidade_licencas: number | null
          renovacao_automatica: boolean | null
          responsavel: string | null
          status: string | null
          tags: string[] | null
          tipo_licenca: string
          updated_at: string | null
          valor_aquisicao: number | null
          valor_renovacao: number | null
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          created_at?: string | null
          created_by?: string | null
          criticidade?: string | null
          data_aquisicao?: string | null
          data_inicio: string
          data_renovacao?: string | null
          data_vencimento: string
          departamento?: string | null
          empresa_id: string
          fornecedor?: string | null
          id?: string
          nome: string
          numero_licenca?: string | null
          observacoes?: string | null
          periodicidade?: string | null
          quantidade_licencas?: number | null
          renovacao_automatica?: boolean | null
          responsavel?: string | null
          status?: string | null
          tags?: string[] | null
          tipo_licenca: string
          updated_at?: string | null
          valor_aquisicao?: number | null
          valor_renovacao?: number | null
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          created_at?: string | null
          created_by?: string | null
          criticidade?: string | null
          data_aquisicao?: string | null
          data_inicio?: string
          data_renovacao?: string | null
          data_vencimento?: string
          departamento?: string | null
          empresa_id?: string
          fornecedor?: string | null
          id?: string
          nome?: string
          numero_licenca?: string | null
          observacoes?: string | null
          periodicidade?: string | null
          quantidade_licencas?: number | null
          renovacao_automatica?: boolean | null
          responsavel?: string | null
          status?: string | null
          tags?: string[] | null
          tipo_licenca?: string
          updated_at?: string | null
          valor_aquisicao?: number | null
          valor_renovacao?: number | null
        }
        Relationships: []
      }
      ativos_localizacoes: {
        Row: {
          ativo: boolean | null
          created_at: string
          descricao: string | null
          empresa_id: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          descricao?: string | null
          empresa_id: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      ativos_manutencoes: {
        Row: {
          ativo_id: string
          created_at: string
          created_by: string | null
          criticidade: string | null
          custo: number | null
          data_conclusao: string | null
          data_manutencao: string
          data_prevista_conclusao: string | null
          descricao: string
          empresa_id: string
          fornecedor: string | null
          id: string
          observacoes: string | null
          proxima_manutencao: string | null
          responsavel: string | null
          status: string
          tipo_manutencao: string
          updated_at: string
        }
        Insert: {
          ativo_id: string
          created_at?: string
          created_by?: string | null
          criticidade?: string | null
          custo?: number | null
          data_conclusao?: string | null
          data_manutencao: string
          data_prevista_conclusao?: string | null
          descricao: string
          empresa_id: string
          fornecedor?: string | null
          id?: string
          observacoes?: string | null
          proxima_manutencao?: string | null
          responsavel?: string | null
          status?: string
          tipo_manutencao: string
          updated_at?: string
        }
        Update: {
          ativo_id?: string
          created_at?: string
          created_by?: string | null
          criticidade?: string | null
          custo?: number | null
          data_conclusao?: string | null
          data_manutencao?: string
          data_prevista_conclusao?: string | null
          descricao?: string
          empresa_id?: string
          fornecedor?: string | null
          id?: string
          observacoes?: string | null
          proxima_manutencao?: string | null
          responsavel?: string | null
          status?: string
          tipo_manutencao?: string
          updated_at?: string
        }
        Relationships: []
      }
      ativos_notificacoes_enviadas: {
        Row: {
          canal: string
          destinatario_email: string | null
          empresa_id: string
          enviado_em: string | null
          id: string
          modulo: string
          registro_id: string
          status: string | null
          tipo_notificacao: string
        }
        Insert: {
          canal: string
          destinatario_email?: string | null
          empresa_id: string
          enviado_em?: string | null
          id?: string
          modulo: string
          registro_id: string
          status?: string | null
          tipo_notificacao: string
        }
        Update: {
          canal?: string
          destinatario_email?: string | null
          empresa_id?: string
          enviado_em?: string | null
          id?: string
          modulo?: string
          registro_id?: string
          status?: string | null
          tipo_notificacao?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          changed_fields: string[] | null
          created_at: string | null
          empresa_id: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          record_id: string
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: string[] | null
          created_at?: string | null
          empresa_id: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id: string
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: string[] | null
          created_at?: string | null
          empresa_id?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      auditoria_achados: {
        Row: {
          area_afetada: string | null
          auditoria_id: string
          causa_raiz: string | null
          created_at: string | null
          criticidade: string
          descricao: string
          id: string
          impacto: string | null
          status: string
          tipo: string
          titulo: string
          trabalho_id: string | null
          updated_at: string | null
        }
        Insert: {
          area_afetada?: string | null
          auditoria_id: string
          causa_raiz?: string | null
          created_at?: string | null
          criticidade?: string
          descricao: string
          id?: string
          impacto?: string | null
          status?: string
          tipo: string
          titulo: string
          trabalho_id?: string | null
          updated_at?: string | null
        }
        Update: {
          area_afetada?: string | null
          auditoria_id?: string
          causa_raiz?: string | null
          created_at?: string | null
          criticidade?: string
          descricao?: string
          id?: string
          impacto?: string | null
          status?: string
          tipo?: string
          titulo?: string
          trabalho_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_achados_auditoria_id_fkey"
            columns: ["auditoria_id"]
            isOneToOne: false
            referencedRelation: "auditorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditoria_achados_trabalho_id_fkey"
            columns: ["trabalho_id"]
            isOneToOne: false
            referencedRelation: "auditoria_trabalhos"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_areas_sistemas: {
        Row: {
          auditoria_id: string | null
          created_at: string
          descricao: string | null
          empresa_id: string
          id: string
          nome: string
          tipo: string | null
          updated_at: string
        }
        Insert: {
          auditoria_id?: string | null
          created_at?: string
          descricao?: string | null
          empresa_id: string
          id?: string
          nome: string
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          auditoria_id?: string | null
          created_at?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          tipo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_areas_sistemas_auditoria_id_fkey"
            columns: ["auditoria_id"]
            isOneToOne: false
            referencedRelation: "auditorias"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_evidencias: {
        Row: {
          achado_id: string | null
          arquivo_nome: string | null
          arquivo_tamanho: number | null
          arquivo_tipo: string | null
          arquivo_url: string | null
          auditoria_id: string | null
          created_at: string | null
          created_by: string | null
          descricao: string | null
          id: string
          nome: string
          tipo: string
          trabalho_id: string | null
        }
        Insert: {
          achado_id?: string | null
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_tipo?: string | null
          arquivo_url?: string | null
          auditoria_id?: string | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome: string
          tipo: string
          trabalho_id?: string | null
        }
        Update: {
          achado_id?: string | null
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_tipo?: string | null
          arquivo_url?: string | null
          auditoria_id?: string | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          tipo?: string
          trabalho_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_evidencias_achado_id_fkey"
            columns: ["achado_id"]
            isOneToOne: false
            referencedRelation: "auditoria_achados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditoria_evidencias_auditoria_id_fkey"
            columns: ["auditoria_id"]
            isOneToOne: false
            referencedRelation: "auditorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditoria_evidencias_trabalho_id_fkey"
            columns: ["trabalho_id"]
            isOneToOne: false
            referencedRelation: "auditoria_trabalhos"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_itens: {
        Row: {
          area_sistema_id: string | null
          auditoria_id: string
          codigo: string
          controle_vinculado_id: string | null
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          observacoes: string | null
          prazo: string | null
          prioridade: string
          responsavel_id: string | null
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          area_sistema_id?: string | null
          auditoria_id: string
          codigo: string
          controle_vinculado_id?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          observacoes?: string | null
          prazo?: string | null
          prioridade?: string
          responsavel_id?: string | null
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          area_sistema_id?: string | null
          auditoria_id?: string
          codigo?: string
          controle_vinculado_id?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          observacoes?: string | null
          prazo?: string | null
          prioridade?: string
          responsavel_id?: string | null
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_itens_area_sistema_id_fkey"
            columns: ["area_sistema_id"]
            isOneToOne: false
            referencedRelation: "auditoria_areas_sistemas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditoria_itens_auditoria_id_fkey"
            columns: ["auditoria_id"]
            isOneToOne: false
            referencedRelation: "auditorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditoria_itens_controle_vinculado_id_fkey"
            columns: ["controle_vinculado_id"]
            isOneToOne: false
            referencedRelation: "controles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditoria_itens_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      auditoria_itens_comentarios: {
        Row: {
          comentario: string
          created_at: string
          id: string
          item_id: string
          mencoes: string[] | null
          user_id: string
        }
        Insert: {
          comentario: string
          created_at?: string
          id?: string
          item_id: string
          mencoes?: string[] | null
          user_id: string
        }
        Update: {
          comentario?: string
          created_at?: string
          id?: string
          item_id?: string
          mencoes?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_itens_comentarios_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "auditoria_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_itens_evidencias: {
        Row: {
          arquivo_nome: string | null
          arquivo_tamanho: number | null
          arquivo_tipo: string | null
          arquivo_url: string | null
          created_at: string
          descricao: string | null
          id: string
          item_id: string
          nome: string
          uploaded_by: string | null
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_tipo?: string | null
          arquivo_url?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          item_id: string
          nome: string
          uploaded_by?: string | null
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_tipo?: string | null
          arquivo_url?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          item_id?: string
          nome?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_itens_evidencias_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "auditoria_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_recomendacoes: {
        Row: {
          achado_id: string
          created_at: string | null
          data_implementacao: string | null
          descricao: string
          evidencia_implementacao: string | null
          id: string
          observacoes: string | null
          prazo_implementacao: string | null
          prioridade: string
          responsavel: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          achado_id: string
          created_at?: string | null
          data_implementacao?: string | null
          descricao: string
          evidencia_implementacao?: string | null
          id?: string
          observacoes?: string | null
          prazo_implementacao?: string | null
          prioridade?: string
          responsavel?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          achado_id?: string
          created_at?: string | null
          data_implementacao?: string | null
          descricao?: string
          evidencia_implementacao?: string | null
          id?: string
          observacoes?: string | null
          prazo_implementacao?: string | null
          prioridade?: string
          responsavel?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_recomendacoes_achado_id_fkey"
            columns: ["achado_id"]
            isOneToOne: false
            referencedRelation: "auditoria_achados"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_trabalhos: {
        Row: {
          auditoria_id: string
          conclusoes: string | null
          created_at: string | null
          data_conclusao: string | null
          data_inicio: string | null
          descricao: string | null
          id: string
          nome: string
          observacoes: string | null
          responsavel: string | null
          status: string
          tipo: string
          updated_at: string | null
        }
        Insert: {
          auditoria_id: string
          conclusoes?: string | null
          created_at?: string | null
          data_conclusao?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          responsavel?: string | null
          status?: string
          tipo: string
          updated_at?: string | null
        }
        Update: {
          auditoria_id?: string
          conclusoes?: string | null
          created_at?: string | null
          data_conclusao?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          responsavel?: string | null
          status?: string
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_trabalhos_auditoria_id_fkey"
            columns: ["auditoria_id"]
            isOneToOne: false
            referencedRelation: "auditorias"
            referencedColumns: ["id"]
          },
        ]
      }
      auditorias: {
        Row: {
          auditor_equipe: string[] | null
          auditor_responsavel: string | null
          created_at: string | null
          created_by: string | null
          data_fim_prevista: string | null
          data_fim_real: string | null
          data_inicio: string | null
          descricao: string | null
          empresa_id: string
          escopo: string | null
          framework: string | null
          id: string
          metodologia: string | null
          nome: string
          objetivos: string | null
          prioridade: string
          status: string
          tipo: string
          updated_at: string | null
        }
        Insert: {
          auditor_equipe?: string[] | null
          auditor_responsavel?: string | null
          created_at?: string | null
          created_by?: string | null
          data_fim_prevista?: string | null
          data_fim_real?: string | null
          data_inicio?: string | null
          descricao?: string | null
          empresa_id: string
          escopo?: string | null
          framework?: string | null
          id?: string
          metodologia?: string | null
          nome: string
          objetivos?: string | null
          prioridade?: string
          status?: string
          tipo: string
          updated_at?: string | null
        }
        Update: {
          auditor_equipe?: string[] | null
          auditor_responsavel?: string | null
          created_at?: string | null
          created_by?: string | null
          data_fim_prevista?: string | null
          data_fim_real?: string | null
          data_inicio?: string | null
          descricao?: string | null
          empresa_id?: string
          escopo?: string | null
          framework?: string | null
          id?: string
          metodologia?: string | null
          nome?: string
          objetivos?: string | null
          prioridade?: string
          status?: string
          tipo?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          autor: string
          capa_url: string | null
          conteudo_md: string
          created_at: string
          framework_slug: string | null
          id: string
          published: boolean
          published_at: string | null
          resumo: string
          seo_description: string | null
          seo_title: string | null
          slug: string
          tags: string[]
          titulo: string
          updated_at: string
        }
        Insert: {
          autor?: string
          capa_url?: string | null
          conteudo_md: string
          created_at?: string
          framework_slug?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          resumo: string
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          tags?: string[]
          titulo: string
          updated_at?: string
        }
        Update: {
          autor?: string
          capa_url?: string | null
          conteudo_md?: string
          created_at?: string
          framework_slug?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          resumo?: string
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          tags?: string[]
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      changelog_entries: {
        Row: {
          created_at: string | null
          id: string
          items: Json
          release_date: string
          version: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          items?: Json
          release_date?: string
          version: string
        }
        Update: {
          created_at?: string | null
          id?: string
          items?: Json
          release_date?: string
          version?: string
        }
        Relationships: []
      }
      compliance_templates: {
        Row: {
          checklist: Json
          created_at: string | null
          descricao: string | null
          empresa_id: string
          framework: string
          id: string
          nome: string
          updated_at: string | null
        }
        Insert: {
          checklist: Json
          created_at?: string | null
          descricao?: string | null
          empresa_id: string
          framework: string
          id?: string
          nome: string
          updated_at?: string | null
        }
        Update: {
          checklist?: Json
          created_at?: string | null
          descricao?: string | null
          empresa_id?: string
          framework?: string
          id?: string
          nome?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      contact_form_submissions: {
        Row: {
          company: string | null
          created_at: string | null
          email: string
          id: string
          message: string
          name: string
          phone: string | null
          processed_at: string | null
          status: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string | null
          email: string
          id?: string
          message: string
          name: string
          phone?: string | null
          processed_at?: string | null
          status?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string | null
          email?: string
          id?: string
          message?: string
          name?: string
          phone?: string | null
          processed_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      contas_aprovacoes: {
        Row: {
          aprovador_id: string
          comentarios: string | null
          conta_id: string
          created_at: string | null
          data_aprovacao: string | null
          id: string
          nivel_aprovacao: number | null
          status: string
        }
        Insert: {
          aprovador_id: string
          comentarios?: string | null
          conta_id: string
          created_at?: string | null
          data_aprovacao?: string | null
          id?: string
          nivel_aprovacao?: number | null
          status?: string
        }
        Update: {
          aprovador_id?: string
          comentarios?: string | null
          conta_id?: string
          created_at?: string | null
          data_aprovacao?: string | null
          id?: string
          nivel_aprovacao?: number | null
          status?: string
        }
        Relationships: []
      }
      contas_auditoria: {
        Row: {
          acao: string
          conta_id: string
          data_acao: string | null
          detalhes_alteracao: Json | null
          id: string
          ip_address: unknown
          user_agent: string | null
          usuario_id: string | null
        }
        Insert: {
          acao: string
          conta_id: string
          data_acao?: string | null
          detalhes_alteracao?: Json | null
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          conta_id?: string
          data_acao?: string | null
          detalhes_alteracao?: Json | null
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          usuario_id?: string | null
        }
        Relationships: []
      }
      contas_privilegiadas: {
        Row: {
          alerta_15_dias: boolean | null
          alerta_30_dias: boolean | null
          alerta_7_dias: boolean | null
          aprovado_por: string | null
          concedido_por: string | null
          created_at: string | null
          created_by: string | null
          data_aprovacao: string | null
          data_concessao: string
          data_expiracao: string | null
          email_beneficiario: string | null
          empresa_id: string
          id: string
          justificativa_negocio: string
          nivel_privilegio: string
          observacoes: string | null
          renovavel: boolean | null
          sistema_id: string
          status: string
          tipo_acesso: string
          updated_at: string | null
          usuario_beneficiario: string
        }
        Insert: {
          alerta_15_dias?: boolean | null
          alerta_30_dias?: boolean | null
          alerta_7_dias?: boolean | null
          aprovado_por?: string | null
          concedido_por?: string | null
          created_at?: string | null
          created_by?: string | null
          data_aprovacao?: string | null
          data_concessao: string
          data_expiracao?: string | null
          email_beneficiario?: string | null
          empresa_id: string
          id?: string
          justificativa_negocio: string
          nivel_privilegio: string
          observacoes?: string | null
          renovavel?: boolean | null
          sistema_id: string
          status?: string
          tipo_acesso: string
          updated_at?: string | null
          usuario_beneficiario: string
        }
        Update: {
          alerta_15_dias?: boolean | null
          alerta_30_dias?: boolean | null
          alerta_7_dias?: boolean | null
          aprovado_por?: string | null
          concedido_por?: string | null
          created_at?: string | null
          created_by?: string | null
          data_aprovacao?: string | null
          data_concessao?: string
          data_expiracao?: string | null
          email_beneficiario?: string | null
          empresa_id?: string
          id?: string
          justificativa_negocio?: string
          nivel_privilegio?: string
          observacoes?: string | null
          renovavel?: boolean | null
          sistema_id?: string
          status?: string
          tipo_acesso?: string
          updated_at?: string | null
          usuario_beneficiario?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_contas_privilegiadas_sistema"
            columns: ["sistema_id"]
            isOneToOne: false
            referencedRelation: "sistemas_privilegiados"
            referencedColumns: ["id"]
          },
        ]
      }
      continuidade_planos: {
        Row: {
          created_at: string
          created_by: string | null
          data_ultima_revisao: string | null
          descricao: string | null
          empresa_id: string
          escopo: string | null
          id: string
          nome: string
          objetivos: string | null
          proxima_revisao: string | null
          responsavel_id: string | null
          rpo_horas: number | null
          rto_horas: number | null
          status: string
          tipo: string
          updated_at: string
          versao: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_ultima_revisao?: string | null
          descricao?: string | null
          empresa_id: string
          escopo?: string | null
          id?: string
          nome: string
          objetivos?: string | null
          proxima_revisao?: string | null
          responsavel_id?: string | null
          rpo_horas?: number | null
          rto_horas?: number | null
          status?: string
          tipo?: string
          updated_at?: string
          versao?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_ultima_revisao?: string | null
          descricao?: string | null
          empresa_id?: string
          escopo?: string | null
          id?: string
          nome?: string
          objetivos?: string | null
          proxima_revisao?: string | null
          responsavel_id?: string | null
          rpo_horas?: number | null
          rto_horas?: number | null
          status?: string
          tipo?: string
          updated_at?: string
          versao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "continuidade_planos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "continuidade_planos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuidade_planos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      continuidade_tarefas: {
        Row: {
          created_at: string
          descricao: string | null
          empresa_id: string
          id: string
          ordem: number | null
          plano_id: string
          prazo: string | null
          prioridade: string
          responsavel_id: string | null
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          empresa_id: string
          id?: string
          ordem?: number | null
          plano_id: string
          prazo?: string | null
          prioridade?: string
          responsavel_id?: string | null
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          ordem?: number | null
          plano_id?: string
          prazo?: string | null
          prioridade?: string
          responsavel_id?: string | null
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "continuidade_tarefas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuidade_tarefas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "continuidade_planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuidade_tarefas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      continuidade_testes: {
        Row: {
          created_at: string
          created_by: string | null
          data_teste: string
          descricao: string | null
          empresa_id: string
          id: string
          licoes_aprendidas: string | null
          observacoes: string | null
          participantes: string[] | null
          plano_id: string
          resultado: string | null
          tipo_teste: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_teste: string
          descricao?: string | null
          empresa_id: string
          id?: string
          licoes_aprendidas?: string | null
          observacoes?: string | null
          participantes?: string[] | null
          plano_id: string
          resultado?: string | null
          tipo_teste?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_teste?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          licoes_aprendidas?: string | null
          observacoes?: string | null
          participantes?: string[] | null
          plano_id?: string
          resultado?: string | null
          tipo_teste?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "continuidade_testes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "continuidade_testes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuidade_testes_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "continuidade_planos"
            referencedColumns: ["id"]
          },
        ]
      }
      continuidade_vinculos: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          plano_id: string
          registro_id: string
          tipo_vinculo: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          plano_id: string
          registro_id: string
          tipo_vinculo: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          plano_id?: string
          registro_id?: string
          tipo_vinculo?: string
        }
        Relationships: [
          {
            foreignKeyName: "continuidade_vinculos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuidade_vinculos_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "continuidade_planos"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_aditivos: {
        Row: {
          aprovado_por: string | null
          contrato_id: string
          created_at: string
          created_by: string | null
          data_assinatura: string | null
          data_fim_anterior: string | null
          data_fim_nova: string | null
          data_inicio_anterior: string | null
          data_inicio_nova: string | null
          id: string
          justificativa: string | null
          motivo: string
          numero_aditivo: string
          status: string
          tipo: string
          updated_at: string
          valor_anterior: number | null
          valor_novo: number | null
        }
        Insert: {
          aprovado_por?: string | null
          contrato_id: string
          created_at?: string
          created_by?: string | null
          data_assinatura?: string | null
          data_fim_anterior?: string | null
          data_fim_nova?: string | null
          data_inicio_anterior?: string | null
          data_inicio_nova?: string | null
          id?: string
          justificativa?: string | null
          motivo: string
          numero_aditivo: string
          status?: string
          tipo: string
          updated_at?: string
          valor_anterior?: number | null
          valor_novo?: number | null
        }
        Update: {
          aprovado_por?: string | null
          contrato_id?: string
          created_at?: string
          created_by?: string | null
          data_assinatura?: string | null
          data_fim_anterior?: string | null
          data_fim_nova?: string | null
          data_inicio_anterior?: string | null
          data_inicio_nova?: string | null
          id?: string
          justificativa?: string | null
          motivo?: string
          numero_aditivo?: string
          status?: string
          tipo?: string
          updated_at?: string
          valor_anterior?: number | null
          valor_novo?: number | null
        }
        Relationships: []
      }
      contrato_documentos: {
        Row: {
          arquivo_nome: string | null
          arquivo_tamanho: number | null
          arquivo_tipo: string | null
          arquivo_url: string | null
          contrato_id: string
          created_at: string
          data_upload: string | null
          descricao: string | null
          id: string
          is_current_version: boolean | null
          nome: string
          tipo: string
          uploaded_by: string | null
          versao: number | null
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_tipo?: string | null
          arquivo_url?: string | null
          contrato_id: string
          created_at?: string
          data_upload?: string | null
          descricao?: string | null
          id?: string
          is_current_version?: boolean | null
          nome: string
          tipo: string
          uploaded_by?: string | null
          versao?: number | null
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_tipo?: string | null
          arquivo_url?: string | null
          contrato_id?: string
          created_at?: string
          data_upload?: string | null
          descricao?: string | null
          id?: string
          is_current_version?: boolean | null
          nome?: string
          tipo?: string
          uploaded_by?: string | null
          versao?: number | null
        }
        Relationships: []
      }
      contrato_marcos: {
        Row: {
          alerta_antecedencia: number | null
          contrato_id: string
          created_at: string
          data_prevista: string
          data_realizada: string | null
          descricao: string | null
          id: string
          nome: string
          observacoes: string | null
          responsavel: string | null
          status: string
          tipo: string
          updated_at: string
          valor: number | null
        }
        Insert: {
          alerta_antecedencia?: number | null
          contrato_id: string
          created_at?: string
          data_prevista: string
          data_realizada?: string | null
          descricao?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          responsavel?: string | null
          status?: string
          tipo: string
          updated_at?: string
          valor?: number | null
        }
        Update: {
          alerta_antecedencia?: number | null
          contrato_id?: string
          created_at?: string
          data_prevista?: string
          data_realizada?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          responsavel?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          valor?: number | null
        }
        Relationships: []
      }
      contratos: {
        Row: {
          area_solicitante: string | null
          clausulas_especiais: string | null
          confidencial: boolean | null
          created_at: string
          created_by: string | null
          data_assinatura: string | null
          data_fim: string | null
          data_inicio: string | null
          empresa_id: string
          fornecedor_id: string
          gestor_contrato: string | null
          id: string
          moeda: string | null
          nome: string
          numero_contrato: string
          objeto: string | null
          observacoes: string | null
          penalidades: string | null
          prazo_renovacao: number | null
          renovacao_automatica: boolean | null
          sla_principal: string | null
          status: string
          tipo: string
          updated_at: string
          valor: number | null
        }
        Insert: {
          area_solicitante?: string | null
          clausulas_especiais?: string | null
          confidencial?: boolean | null
          created_at?: string
          created_by?: string | null
          data_assinatura?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          empresa_id: string
          fornecedor_id: string
          gestor_contrato?: string | null
          id?: string
          moeda?: string | null
          nome: string
          numero_contrato: string
          objeto?: string | null
          observacoes?: string | null
          penalidades?: string | null
          prazo_renovacao?: number | null
          renovacao_automatica?: boolean | null
          sla_principal?: string | null
          status?: string
          tipo: string
          updated_at?: string
          valor?: number | null
        }
        Update: {
          area_solicitante?: string | null
          clausulas_especiais?: string | null
          confidencial?: boolean | null
          created_at?: string
          created_by?: string | null
          data_assinatura?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          empresa_id?: string
          fornecedor_id?: string
          gestor_contrato?: string | null
          id?: string
          moeda?: string | null
          nome?: string
          numero_contrato?: string
          objeto?: string | null
          observacoes?: string | null
          penalidades?: string | null
          prazo_renovacao?: number | null
          renovacao_automatica?: boolean | null
          sla_principal?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          valor?: number | null
        }
        Relationships: []
      }
      controles: {
        Row: {
          area: string | null
          categoria_id: string | null
          codigo: string | null
          created_at: string
          criticidade: string
          data_implementacao: string | null
          descricao: string | null
          empresa_id: string
          frequencia: string | null
          id: string
          nome: string
          processo_backup: string | null
          proxima_avaliacao: string | null
          responsavel_backup: string | null
          responsavel_id: string | null
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          area?: string | null
          categoria_id?: string | null
          codigo?: string | null
          created_at?: string
          criticidade?: string
          data_implementacao?: string | null
          descricao?: string | null
          empresa_id: string
          frequencia?: string | null
          id?: string
          nome: string
          processo_backup?: string | null
          proxima_avaliacao?: string | null
          responsavel_backup?: string | null
          responsavel_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          area?: string | null
          categoria_id?: string | null
          codigo?: string | null
          created_at?: string
          criticidade?: string
          data_implementacao?: string | null
          descricao?: string | null
          empresa_id?: string
          frequencia?: string | null
          id?: string
          nome?: string
          processo_backup?: string | null
          proxima_avaliacao?: string | null
          responsavel_backup?: string | null
          responsavel_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "controles_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "controles_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_controles_responsavel"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      controles_ativos: {
        Row: {
          ativo_id: string
          controle_id: string
          created_at: string
          id: string
          observacoes: string | null
          tipo_protecao: string
        }
        Insert: {
          ativo_id: string
          controle_id: string
          created_at?: string
          id?: string
          observacoes?: string | null
          tipo_protecao?: string
        }
        Update: {
          ativo_id?: string
          controle_id?: string
          created_at?: string
          id?: string
          observacoes?: string | null
          tipo_protecao?: string
        }
        Relationships: [
          {
            foreignKeyName: "controles_ativos_ativo_id_fkey"
            columns: ["ativo_id"]
            isOneToOne: false
            referencedRelation: "ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controles_ativos_controle_id_fkey"
            columns: ["controle_id"]
            isOneToOne: false
            referencedRelation: "controles"
            referencedColumns: ["id"]
          },
        ]
      }
      controles_auditorias: {
        Row: {
          auditoria_id: string
          controle_id: string
          created_at: string | null
          id: string
          observacoes: string | null
          tipo_relacao: string | null
          updated_at: string | null
        }
        Insert: {
          auditoria_id: string
          controle_id: string
          created_at?: string | null
          id?: string
          observacoes?: string | null
          tipo_relacao?: string | null
          updated_at?: string | null
        }
        Update: {
          auditoria_id?: string
          controle_id?: string
          created_at?: string | null
          id?: string
          observacoes?: string | null
          tipo_relacao?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "controles_auditorias_auditoria_id_fkey"
            columns: ["auditoria_id"]
            isOneToOne: false
            referencedRelation: "auditorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controles_auditorias_controle_id_fkey"
            columns: ["controle_id"]
            isOneToOne: false
            referencedRelation: "controles"
            referencedColumns: ["id"]
          },
        ]
      }
      controles_categorias: {
        Row: {
          cor: string | null
          created_at: string
          descricao: string | null
          empresa_id: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          cor?: string | null
          created_at?: string
          descricao?: string | null
          empresa_id: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          cor?: string | null
          created_at?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      controles_comentarios: {
        Row: {
          comentario: string
          controle_id: string
          created_at: string
          id: string
          mencoes: string[] | null
          user_id: string
        }
        Insert: {
          comentario: string
          controle_id: string
          created_at?: string
          id?: string
          mencoes?: string[] | null
          user_id: string
        }
        Update: {
          comentario?: string
          controle_id?: string
          created_at?: string
          id?: string
          mencoes?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "controles_comentarios_controle_id_fkey"
            columns: ["controle_id"]
            isOneToOne: false
            referencedRelation: "controles"
            referencedColumns: ["id"]
          },
        ]
      }
      controles_evidencias: {
        Row: {
          arquivo_nome: string | null
          arquivo_tamanho: number | null
          arquivo_tipo: string | null
          arquivo_url: string | null
          controle_id: string
          controle_teste_id: string | null
          created_at: string | null
          created_by: string | null
          descricao: string | null
          id: string
          is_current_version: boolean | null
          nome: string
          updated_at: string | null
          versao: number | null
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_tipo?: string | null
          arquivo_url?: string | null
          controle_id: string
          controle_teste_id?: string | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          id?: string
          is_current_version?: boolean | null
          nome: string
          updated_at?: string | null
          versao?: number | null
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_tipo?: string | null
          arquivo_url?: string | null
          controle_id?: string
          controle_teste_id?: string | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          id?: string
          is_current_version?: boolean | null
          nome?: string
          updated_at?: string | null
          versao?: number | null
        }
        Relationships: []
      }
      controles_riscos: {
        Row: {
          controle_id: string
          created_at: string
          eficacia_estimada: string | null
          id: string
          observacoes: string | null
          risco_id: string
          tipo_vinculacao: string
        }
        Insert: {
          controle_id: string
          created_at?: string
          eficacia_estimada?: string | null
          id?: string
          observacoes?: string | null
          risco_id: string
          tipo_vinculacao?: string
        }
        Update: {
          controle_id?: string
          created_at?: string
          eficacia_estimada?: string | null
          id?: string
          observacoes?: string | null
          risco_id?: string
          tipo_vinculacao?: string
        }
        Relationships: [
          {
            foreignKeyName: "controles_riscos_controle_id_fkey"
            columns: ["controle_id"]
            isOneToOne: false
            referencedRelation: "controles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controles_riscos_risco_id_fkey"
            columns: ["risco_id"]
            isOneToOne: false
            referencedRelation: "riscos"
            referencedColumns: ["id"]
          },
        ]
      }
      controles_testes: {
        Row: {
          controle_id: string
          created_at: string
          data_teste: string
          evidencias: string | null
          id: string
          observacoes: string | null
          proxima_avaliacao: string | null
          resultado: string
          testador: string | null
          updated_at: string
        }
        Insert: {
          controle_id: string
          created_at?: string
          data_teste: string
          evidencias?: string | null
          id?: string
          observacoes?: string | null
          proxima_avaliacao?: string | null
          resultado: string
          testador?: string | null
          updated_at?: string
        }
        Update: {
          controle_id?: string
          created_at?: string
          data_teste?: string
          evidencias?: string | null
          id?: string
          observacoes?: string | null
          proxima_avaliacao?: string | null
          resultado?: string
          testador?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "controles_testes_controle_id_fkey"
            columns: ["controle_id"]
            isOneToOne: false
            referencedRelation: "controles"
            referencedColumns: ["id"]
          },
        ]
      }
      creditos_consumo: {
        Row: {
          created_at: string | null
          descricao: string | null
          empresa_id: string
          funcionalidade: string
          id: string
          quantidade: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          empresa_id: string
          funcionalidade: string
          id?: string
          quantidade?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          empresa_id?: string
          funcionalidade?: string
          id?: string
          quantidade?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creditos_consumo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      dados_descobertas: {
        Row: {
          campos_criticos: number | null
          campos_importados: number | null
          campos_sensiveis: number | null
          created_at: string
          created_by: string | null
          empresa_id: string
          id: string
          resultado_scan: Json | null
          status: string | null
          titulo_pagina: string | null
          total_campos: number | null
          total_formularios: number | null
          url: string
        }
        Insert: {
          campos_criticos?: number | null
          campos_importados?: number | null
          campos_sensiveis?: number | null
          created_at?: string
          created_by?: string | null
          empresa_id: string
          id?: string
          resultado_scan?: Json | null
          status?: string | null
          titulo_pagina?: string | null
          total_campos?: number | null
          total_formularios?: number | null
          url: string
        }
        Update: {
          campos_criticos?: number | null
          campos_importados?: number | null
          campos_sensiveis?: number | null
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          id?: string
          resultado_scan?: Json | null
          status?: string | null
          titulo_pagina?: string | null
          total_campos?: number | null
          total_formularios?: number | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "dados_descobertas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      dados_fluxos: {
        Row: {
          aprovacao_necessaria: boolean | null
          created_at: string
          criptografia_transit: boolean | null
          dados_pessoais_id: string
          empresa_id: string
          frequencia: string | null
          id: string
          mapeamento_campos: Json | null
          nome_fluxo: string
          observacoes: string | null
          responsavel_fluxo: string | null
          sistema_destino: string
          sistema_origem: string
          status: string
          tipo_transferencia: string
          updated_at: string
          volume_aproximado: string | null
        }
        Insert: {
          aprovacao_necessaria?: boolean | null
          created_at?: string
          criptografia_transit?: boolean | null
          dados_pessoais_id: string
          empresa_id: string
          frequencia?: string | null
          id?: string
          mapeamento_campos?: Json | null
          nome_fluxo: string
          observacoes?: string | null
          responsavel_fluxo?: string | null
          sistema_destino: string
          sistema_origem: string
          status?: string
          tipo_transferencia: string
          updated_at?: string
          volume_aproximado?: string | null
        }
        Update: {
          aprovacao_necessaria?: boolean | null
          created_at?: string
          criptografia_transit?: boolean | null
          dados_pessoais_id?: string
          empresa_id?: string
          frequencia?: string | null
          id?: string
          mapeamento_campos?: Json | null
          nome_fluxo?: string
          observacoes?: string | null
          responsavel_fluxo?: string | null
          sistema_destino?: string
          sistema_origem?: string
          status?: string
          tipo_transferencia?: string
          updated_at?: string
          volume_aproximado?: string | null
        }
        Relationships: []
      }
      dados_mapeamento: {
        Row: {
          ativo_id: string
          controles_acesso: string | null
          created_at: string
          criptografia_aplicada: boolean | null
          dados_pessoais_id: string
          frequencia_acesso: string | null
          id: string
          localizacao_dados: string | null
          observacoes: string | null
          tipo_armazenamento: string
          updated_at: string
          volume_aproximado: string | null
        }
        Insert: {
          ativo_id: string
          controles_acesso?: string | null
          created_at?: string
          criptografia_aplicada?: boolean | null
          dados_pessoais_id: string
          frequencia_acesso?: string | null
          id?: string
          localizacao_dados?: string | null
          observacoes?: string | null
          tipo_armazenamento?: string
          updated_at?: string
          volume_aproximado?: string | null
        }
        Update: {
          ativo_id?: string
          controles_acesso?: string | null
          created_at?: string
          criptografia_aplicada?: boolean | null
          dados_pessoais_id?: string
          frequencia_acesso?: string | null
          id?: string
          localizacao_dados?: string | null
          observacoes?: string | null
          tipo_armazenamento?: string
          updated_at?: string
          volume_aproximado?: string | null
        }
        Relationships: []
      }
      dados_pessoais: {
        Row: {
          base_legal: string
          categoria_dados: string
          created_at: string
          created_by: string | null
          descricao: string | null
          empresa_id: string
          finalidade_tratamento: string
          forma_coleta: string | null
          id: string
          nome: string
          observacoes: string | null
          origem_coleta: string | null
          prazo_retencao: string | null
          sensibilidade: string
          tipo_dados: string
          updated_at: string
        }
        Insert: {
          base_legal: string
          categoria_dados: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id: string
          finalidade_tratamento: string
          forma_coleta?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          origem_coleta?: string | null
          prazo_retencao?: string | null
          sensibilidade?: string
          tipo_dados: string
          updated_at?: string
        }
        Update: {
          base_legal?: string
          categoria_dados?: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string
          finalidade_tratamento?: string
          forma_coleta?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          origem_coleta?: string | null
          prazo_retencao?: string | null
          sensibilidade?: string
          tipo_dados?: string
          updated_at?: string
        }
        Relationships: []
      }
      dados_solicitacoes_titular: {
        Row: {
          canal_solicitacao: string | null
          created_at: string
          dados_solicitados: string | null
          dados_titular: Json
          data_resposta: string | null
          data_solicitacao: string
          empresa_id: string
          evidencias_atendimento: string | null
          id: string
          justificativa: string | null
          observacoes_internas: string | null
          prazo_resposta: string
          responsavel_analise: string | null
          resposta_titular: string | null
          status: string
          tipo_solicitacao: string
          updated_at: string
        }
        Insert: {
          canal_solicitacao?: string | null
          created_at?: string
          dados_solicitados?: string | null
          dados_titular: Json
          data_resposta?: string | null
          data_solicitacao?: string
          empresa_id: string
          evidencias_atendimento?: string | null
          id?: string
          justificativa?: string | null
          observacoes_internas?: string | null
          prazo_resposta: string
          responsavel_analise?: string | null
          resposta_titular?: string | null
          status?: string
          tipo_solicitacao: string
          updated_at?: string
        }
        Update: {
          canal_solicitacao?: string | null
          created_at?: string
          dados_solicitados?: string | null
          dados_titular?: Json
          data_resposta?: string | null
          data_solicitacao?: string
          empresa_id?: string
          evidencias_atendimento?: string | null
          id?: string
          justificativa?: string | null
          observacoes_internas?: string | null
          prazo_resposta?: string
          responsavel_analise?: string | null
          resposta_titular?: string | null
          status?: string
          tipo_solicitacao?: string
          updated_at?: string
        }
        Relationships: []
      }
      denuncias: {
        Row: {
          anonima: boolean | null
          categoria_id: string | null
          created_at: string | null
          data_atribuicao: string | null
          data_conclusao: string | null
          data_inicio_investigacao: string | null
          descricao: string
          email_denunciante: string | null
          empresa_id: string
          gravidade: string | null
          id: string
          ip_origem: unknown
          nome_denunciante: string | null
          parecer_final: string | null
          politica_aceita: boolean | null
          protocolo: string
          responsavel_id: string | null
          status: string | null
          titulo: string
          token_publico: string
          updated_at: string | null
          user_agent: string | null
        }
        Insert: {
          anonima?: boolean | null
          categoria_id?: string | null
          created_at?: string | null
          data_atribuicao?: string | null
          data_conclusao?: string | null
          data_inicio_investigacao?: string | null
          descricao: string
          email_denunciante?: string | null
          empresa_id: string
          gravidade?: string | null
          id?: string
          ip_origem?: unknown
          nome_denunciante?: string | null
          parecer_final?: string | null
          politica_aceita?: boolean | null
          protocolo: string
          responsavel_id?: string | null
          status?: string | null
          titulo: string
          token_publico: string
          updated_at?: string | null
          user_agent?: string | null
        }
        Update: {
          anonima?: boolean | null
          categoria_id?: string | null
          created_at?: string | null
          data_atribuicao?: string | null
          data_conclusao?: string | null
          data_inicio_investigacao?: string | null
          descricao?: string
          email_denunciante?: string | null
          empresa_id?: string
          gravidade?: string | null
          id?: string
          ip_origem?: unknown
          nome_denunciante?: string | null
          parecer_final?: string | null
          politica_aceita?: boolean | null
          protocolo?: string
          responsavel_id?: string | null
          status?: string | null
          titulo?: string
          token_publico?: string
          updated_at?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "denuncias_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "denuncias_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_denuncias_responsavel"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      denuncias_anexos: {
        Row: {
          arquivo_url: string | null
          created_at: string | null
          denuncia_id: string
          id: string
          movimentacao_id: string | null
          nome_arquivo: string
          tamanho_arquivo: number | null
          tipo_anexo: string | null
          tipo_arquivo: string
          uploaded_by: string | null
        }
        Insert: {
          arquivo_url?: string | null
          created_at?: string | null
          denuncia_id: string
          id?: string
          movimentacao_id?: string | null
          nome_arquivo: string
          tamanho_arquivo?: number | null
          tipo_anexo?: string | null
          tipo_arquivo: string
          uploaded_by?: string | null
        }
        Update: {
          arquivo_url?: string | null
          created_at?: string | null
          denuncia_id?: string
          id?: string
          movimentacao_id?: string | null
          nome_arquivo?: string
          tamanho_arquivo?: number | null
          tipo_anexo?: string | null
          tipo_arquivo?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "denuncias_anexos_denuncia_id_fkey"
            columns: ["denuncia_id"]
            isOneToOne: false
            referencedRelation: "denuncias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "denuncias_anexos_movimentacao_id_fkey"
            columns: ["movimentacao_id"]
            isOneToOne: false
            referencedRelation: "denuncias_movimentacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      denuncias_categorias: {
        Row: {
          ativo: boolean | null
          cor: string | null
          created_at: string | null
          descricao: string | null
          empresa_id: string
          id: string
          nome: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          nome: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      denuncias_configuracoes: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          emails_notificacao: string[] | null
          empresa_id: string
          id: string
          notificar_administradores: boolean | null
          permitir_anonimas: boolean | null
          politica_privacidade: string | null
          requerer_email: boolean | null
          texto_apresentacao: string | null
          token_publico: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          emails_notificacao?: string[] | null
          empresa_id?: string
          id?: string
          notificar_administradores?: boolean | null
          permitir_anonimas?: boolean | null
          politica_privacidade?: string | null
          requerer_email?: boolean | null
          texto_apresentacao?: string | null
          token_publico: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          emails_notificacao?: string[] | null
          empresa_id?: string
          id?: string
          notificar_administradores?: boolean | null
          permitir_anonimas?: boolean | null
          politica_privacidade?: string | null
          requerer_email?: boolean | null
          texto_apresentacao?: string | null
          token_publico?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      denuncias_movimentacoes: {
        Row: {
          acao: string
          created_at: string | null
          denuncia_id: string
          id: string
          observacoes: string | null
          status_anterior: string | null
          status_novo: string | null
          usuario_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string | null
          denuncia_id: string
          id?: string
          observacoes?: string | null
          status_anterior?: string | null
          status_novo?: string | null
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string | null
          denuncia_id?: string
          id?: string
          observacoes?: string | null
          status_anterior?: string | null
          status_novo?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "denuncias_movimentacoes_denuncia_id_fkey"
            columns: ["denuncia_id"]
            isOneToOne: false
            referencedRelation: "denuncias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_movimentacoes_usuario"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      docgen_conversations: {
        Row: {
          contexto: Json | null
          created_at: string
          empresa_id: string
          id: string
          mensagens: Json
          status: string
          tipo_documento_identificado: string | null
          titulo: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          contexto?: Json | null
          created_at?: string
          empresa_id: string
          id?: string
          mensagens?: Json
          status?: string
          tipo_documento_identificado?: string | null
          titulo?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          contexto?: Json | null
          created_at?: string
          empresa_id?: string
          id?: string
          mensagens?: Json
          status?: string
          tipo_documento_identificado?: string | null
          titulo?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      docgen_feedback_implicit: {
        Row: {
          conversation_id: string
          created_at: string
          documento_salvo: boolean | null
          empresa_id: string
          id: string
          padroes_identificados: Json | null
          qualidade_estimada: number | null
          revisoes_necessarias: number | null
          tempo_geracao: number | null
        }
        Insert: {
          conversation_id: string
          created_at?: string
          documento_salvo?: boolean | null
          empresa_id: string
          id?: string
          padroes_identificados?: Json | null
          qualidade_estimada?: number | null
          revisoes_necessarias?: number | null
          tempo_geracao?: number | null
        }
        Update: {
          conversation_id?: string
          created_at?: string
          documento_salvo?: boolean | null
          empresa_id?: string
          id?: string
          padroes_identificados?: Json | null
          qualidade_estimada?: number | null
          revisoes_necessarias?: number | null
          tempo_geracao?: number | null
        }
        Relationships: []
      }
      docgen_generated_docs: {
        Row: {
          conteudo: Json
          conversation_id: string
          created_at: string
          created_by: string | null
          documento_id: string | null
          empresa_id: string
          framework_vinculado: string | null
          id: string
          layout_id: string | null
          nome: string
          status: string
          template_id: string | null
          tipo_documento: string
          updated_at: string
        }
        Insert: {
          conteudo: Json
          conversation_id: string
          created_at?: string
          created_by?: string | null
          documento_id?: string | null
          empresa_id: string
          framework_vinculado?: string | null
          id?: string
          layout_id?: string | null
          nome: string
          status?: string
          template_id?: string | null
          tipo_documento: string
          updated_at?: string
        }
        Update: {
          conteudo?: Json
          conversation_id?: string
          created_at?: string
          created_by?: string | null
          documento_id?: string | null
          empresa_id?: string
          framework_vinculado?: string | null
          id?: string
          layout_id?: string | null
          nome?: string
          status?: string
          template_id?: string | null
          tipo_documento?: string
          updated_at?: string
        }
        Relationships: []
      }
      docgen_layouts: {
        Row: {
          classificacao_padrao: string | null
          cores: Json | null
          created_at: string
          created_by: string | null
          descricao: string | null
          empresa_id: string
          fontes: Json | null
          footer_config: Json
          frequencia_revisao: string | null
          header_config: Json
          id: string
          is_default: boolean | null
          logo_url: string | null
          nome: string
          responsaveis_padrao: Json | null
          updated_at: string
        }
        Insert: {
          classificacao_padrao?: string | null
          cores?: Json | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id: string
          fontes?: Json | null
          footer_config?: Json
          frequencia_revisao?: string | null
          header_config?: Json
          id?: string
          is_default?: boolean | null
          logo_url?: string | null
          nome: string
          responsaveis_padrao?: Json | null
          updated_at?: string
        }
        Update: {
          classificacao_padrao?: string | null
          cores?: Json | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string
          fontes?: Json | null
          footer_config?: Json
          frequencia_revisao?: string | null
          header_config?: Json
          id?: string
          is_default?: boolean | null
          logo_url?: string | null
          nome?: string
          responsaveis_padrao?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      docgen_learning_patterns: {
        Row: {
          contexto_aplicacao: Json | null
          created_at: string
          empresa_id: string
          id: string
          numero_usos: number | null
          pergunta_padrao: string
          taxa_sucesso: number | null
          tipo_documento: string
          updated_at: string
        }
        Insert: {
          contexto_aplicacao?: Json | null
          created_at?: string
          empresa_id: string
          id?: string
          numero_usos?: number | null
          pergunta_padrao: string
          taxa_sucesso?: number | null
          tipo_documento: string
          updated_at?: string
        }
        Update: {
          contexto_aplicacao?: Json | null
          created_at?: string
          empresa_id?: string
          id?: string
          numero_usos?: number | null
          pergunta_padrao?: string
          taxa_sucesso?: number | null
          tipo_documento?: string
          updated_at?: string
        }
        Relationships: []
      }
      docgen_templates: {
        Row: {
          campos_obrigatorios: Json | null
          conhecimento_especializado: Json | null
          created_at: string
          empresa_id: string
          estrutura: Json
          frameworks_relacionados: string[] | null
          id: string
          is_system: boolean | null
          nome: string
          perguntas_sequenciais: Json | null
          secoes_obrigatorias: Json | null
          tipo_documento: string
          tooltips: Json | null
          updated_at: string
        }
        Insert: {
          campos_obrigatorios?: Json | null
          conhecimento_especializado?: Json | null
          created_at?: string
          empresa_id: string
          estrutura: Json
          frameworks_relacionados?: string[] | null
          id?: string
          is_system?: boolean | null
          nome: string
          perguntas_sequenciais?: Json | null
          secoes_obrigatorias?: Json | null
          tipo_documento: string
          tooltips?: Json | null
          updated_at?: string
        }
        Update: {
          campos_obrigatorios?: Json | null
          conhecimento_especializado?: Json | null
          created_at?: string
          empresa_id?: string
          estrutura?: Json
          frameworks_relacionados?: string[] | null
          id?: string
          is_system?: boolean | null
          nome?: string
          perguntas_sequenciais?: Json | null
          secoes_obrigatorias?: Json | null
          tipo_documento?: string
          tooltips?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      documentos: {
        Row: {
          aprovado_por: string | null
          arquivo_nome: string | null
          arquivo_tamanho: number | null
          arquivo_tipo: string | null
          arquivo_url: string | null
          arquivo_url_externa: string | null
          classificacao: string | null
          created_at: string
          created_by: string | null
          data_aprovacao: string | null
          data_vencimento: string | null
          descricao: string | null
          empresa_id: string
          id: string
          is_current_version: boolean | null
          nome: string
          requer_aprovacao: boolean | null
          status: string | null
          tags: string[] | null
          tipo: string
          updated_at: string
          versao: number | null
        }
        Insert: {
          aprovado_por?: string | null
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_tipo?: string | null
          arquivo_url?: string | null
          arquivo_url_externa?: string | null
          classificacao?: string | null
          created_at?: string
          created_by?: string | null
          data_aprovacao?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          empresa_id: string
          id?: string
          is_current_version?: boolean | null
          nome: string
          requer_aprovacao?: boolean | null
          status?: string | null
          tags?: string[] | null
          tipo?: string
          updated_at?: string
          versao?: number | null
        }
        Update: {
          aprovado_por?: string | null
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_tipo?: string | null
          arquivo_url?: string | null
          arquivo_url_externa?: string | null
          classificacao?: string | null
          created_at?: string
          created_by?: string | null
          data_aprovacao?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          is_current_version?: boolean | null
          nome?: string
          requer_aprovacao?: boolean | null
          status?: string | null
          tags?: string[] | null
          tipo?: string
          updated_at?: string
          versao?: number | null
        }
        Relationships: []
      }
      documentos_aprovacoes: {
        Row: {
          aprovador_id: string
          comentarios: string | null
          created_at: string
          data_aprovacao: string | null
          data_solicitacao: string | null
          documento_id: string
          id: string
          notificacao_enviada: boolean | null
          solicitado_por: string | null
          status: string
          tipo_acao: string | null
        }
        Insert: {
          aprovador_id: string
          comentarios?: string | null
          created_at?: string
          data_aprovacao?: string | null
          data_solicitacao?: string | null
          documento_id: string
          id?: string
          notificacao_enviada?: boolean | null
          solicitado_por?: string | null
          status?: string
          tipo_acao?: string | null
        }
        Update: {
          aprovador_id?: string
          comentarios?: string | null
          created_at?: string
          data_aprovacao?: string | null
          data_solicitacao?: string | null
          documento_id?: string
          id?: string
          notificacao_enviada?: boolean | null
          solicitado_por?: string | null
          status?: string
          tipo_acao?: string | null
        }
        Relationships: []
      }
      documentos_categorias: {
        Row: {
          cor: string | null
          created_at: string
          descricao: string | null
          empresa_id: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          cor?: string | null
          created_at?: string
          descricao?: string | null
          empresa_id: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          cor?: string | null
          created_at?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      documentos_comentarios: {
        Row: {
          comentario: string
          created_at: string
          documento_id: string
          id: string
          user_id: string
        }
        Insert: {
          comentario: string
          created_at?: string
          documento_id: string
          id?: string
          user_id: string
        }
        Update: {
          comentario?: string
          created_at?: string
          documento_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      documentos_historico: {
        Row: {
          aprovado_por: string | null
          arquivo_nome: string | null
          arquivo_tamanho: number | null
          arquivo_tipo: string | null
          arquivo_url: string | null
          created_at: string | null
          created_by: string | null
          data_aprovacao: string | null
          data_vencimento: string | null
          documento_id: string
          id: string
          observacoes: string | null
          status: string
          versao: number
        }
        Insert: {
          aprovado_por?: string | null
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_tipo?: string | null
          arquivo_url?: string | null
          created_at?: string | null
          created_by?: string | null
          data_aprovacao?: string | null
          data_vencimento?: string | null
          documento_id: string
          id?: string
          observacoes?: string | null
          status: string
          versao: number
        }
        Update: {
          aprovado_por?: string | null
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_tipo?: string | null
          arquivo_url?: string | null
          created_at?: string | null
          created_by?: string | null
          data_aprovacao?: string | null
          data_vencimento?: string | null
          documento_id?: string
          id?: string
          observacoes?: string | null
          status?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "documentos_historico_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_vinculacoes: {
        Row: {
          created_at: string
          documento_id: string
          id: string
          modulo: string
          observacoes: string | null
          tipo_vinculacao: string | null
          vinculo_id: string
        }
        Insert: {
          created_at?: string
          documento_id: string
          id?: string
          modulo: string
          observacoes?: string | null
          tipo_vinculacao?: string | null
          vinculo_id: string
        }
        Update: {
          created_at?: string
          documento_id?: string
          id?: string
          modulo?: string
          observacoes?: string | null
          tipo_vinculacao?: string | null
          vinculo_id?: string
        }
        Relationships: []
      }
      due_diligence_assessments: {
        Row: {
          created_at: string
          created_by: string | null
          data_conclusao: string | null
          data_envio: string | null
          data_expiracao: string | null
          data_inicio: string | null
          empresa_id: string
          fornecedor_email: string
          fornecedor_nome: string
          id: string
          link_token: string
          observacoes: string | null
          score_final: number | null
          status: string
          template_id: string
          ultimo_lembrete_enviado: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_conclusao?: string | null
          data_envio?: string | null
          data_expiracao?: string | null
          data_inicio?: string | null
          empresa_id: string
          fornecedor_email: string
          fornecedor_nome: string
          id?: string
          link_token: string
          observacoes?: string | null
          score_final?: number | null
          status?: string
          template_id: string
          ultimo_lembrete_enviado?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_conclusao?: string | null
          data_envio?: string | null
          data_expiracao?: string | null
          data_inicio?: string | null
          empresa_id?: string
          fornecedor_email?: string
          fornecedor_nome?: string
          id?: string
          link_token?: string
          observacoes?: string | null
          score_final?: number | null
          status?: string
          template_id?: string
          ultimo_lembrete_enviado?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "due_diligence_assessments_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "due_diligence_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      due_diligence_integration_logs: {
        Row: {
          assessment_id: string
          empresa_id: string
          erro_mensagem: string | null
          executed_at: string
          id: string
          integration_id: string
          resultado: Json | null
          status: string
        }
        Insert: {
          assessment_id: string
          empresa_id: string
          erro_mensagem?: string | null
          executed_at?: string
          id?: string
          integration_id: string
          resultado?: Json | null
          status?: string
        }
        Update: {
          assessment_id?: string
          empresa_id?: string
          erro_mensagem?: string | null
          executed_at?: string
          id?: string
          integration_id?: string
          resultado?: Json | null
          status?: string
        }
        Relationships: []
      }
      due_diligence_integrations: {
        Row: {
          acao: string
          ativo: boolean | null
          condicao: string
          created_at: string
          descricao: string | null
          empresa_id: string
          id: string
          nome: string
          parametros_acao: Json | null
          tipo_integracao: string
          updated_at: string
          valor_condicao: string
        }
        Insert: {
          acao: string
          ativo?: boolean | null
          condicao: string
          created_at?: string
          descricao?: string | null
          empresa_id: string
          id?: string
          nome: string
          parametros_acao?: Json | null
          tipo_integracao: string
          updated_at?: string
          valor_condicao: string
        }
        Update: {
          acao?: string
          ativo?: boolean | null
          condicao?: string
          created_at?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          parametros_acao?: Json | null
          tipo_integracao?: string
          updated_at?: string
          valor_condicao?: string
        }
        Relationships: []
      }
      due_diligence_questions: {
        Row: {
          configuracoes: Json | null
          created_at: string
          descricao: string | null
          id: string
          obrigatoria: boolean
          opcoes: Json | null
          ordem: number
          peso: number | null
          secao: string | null
          template_id: string
          tipo: string
          titulo: string
        }
        Insert: {
          configuracoes?: Json | null
          created_at?: string
          descricao?: string | null
          id?: string
          obrigatoria?: boolean
          opcoes?: Json | null
          ordem?: number
          peso?: number | null
          secao?: string | null
          template_id: string
          tipo: string
          titulo: string
        }
        Update: {
          configuracoes?: Json | null
          created_at?: string
          descricao?: string | null
          id?: string
          obrigatoria?: boolean
          opcoes?: Json | null
          ordem?: number
          peso?: number | null
          secao?: string | null
          template_id?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "due_diligence_questions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "due_diligence_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      due_diligence_responses: {
        Row: {
          arquivo_url: string | null
          assessment_id: string
          created_at: string
          evidencia: string | null
          id: string
          justificativa: string | null
          pontuacao: number | null
          question_id: string
          resposta: string | null
          resposta_arquivo_nome: string | null
          resposta_arquivo_url: string | null
          updated_at: string
        }
        Insert: {
          arquivo_url?: string | null
          assessment_id: string
          created_at?: string
          evidencia?: string | null
          id?: string
          justificativa?: string | null
          pontuacao?: number | null
          question_id: string
          resposta?: string | null
          resposta_arquivo_nome?: string | null
          resposta_arquivo_url?: string | null
          updated_at?: string
        }
        Update: {
          arquivo_url?: string | null
          assessment_id?: string
          created_at?: string
          evidencia?: string | null
          id?: string
          justificativa?: string | null
          pontuacao?: number | null
          question_id?: string
          resposta?: string | null
          resposta_arquivo_nome?: string | null
          resposta_arquivo_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "due_diligence_responses_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "due_diligence_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "due_diligence_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "due_diligence_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      due_diligence_scores: {
        Row: {
          assessment_id: string
          classificacao: string | null
          created_at: string
          id: string
          observacoes_ia: string | null
          score_breakdown: Json
          score_total: number
          updated_at: string
        }
        Insert: {
          assessment_id: string
          classificacao?: string | null
          created_at?: string
          id?: string
          observacoes_ia?: string | null
          score_breakdown?: Json
          score_total?: number
          updated_at?: string
        }
        Update: {
          assessment_id?: string
          classificacao?: string | null
          created_at?: string
          id?: string
          observacoes_ia?: string | null
          score_breakdown?: Json
          score_total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "due_diligence_scores_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: true
            referencedRelation: "due_diligence_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      due_diligence_templates: {
        Row: {
          ativo: boolean
          categoria: string
          created_at: string
          created_by: string | null
          descricao: string | null
          empresa_id: string
          id: string
          nome: string
          padrao: boolean | null
          updated_at: string
          versao: number
        }
        Insert: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id: string
          id?: string
          nome: string
          padrao?: boolean | null
          updated_at?: string
          versao?: number
        }
        Update: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          padrao?: boolean | null
          updated_at?: string
          versao?: number
        }
        Relationships: []
      }
      email_campanha_logs: {
        Row: {
          campanha_id: string
          created_at: string
          email: string
          erro: string | null
          id: string
          status: string
        }
        Insert: {
          campanha_id: string
          created_at?: string
          email: string
          erro?: string | null
          id?: string
          status: string
        }
        Update: {
          campanha_id?: string
          created_at?: string
          email?: string
          erro?: string | null
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campanha_logs_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "email_campanhas"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campanhas: {
        Row: {
          assunto: string
          conteudo_html: string
          created_at: string
          criado_por: string
          enviado_em: string | null
          erro: string | null
          id: string
          imagem_url: string | null
          status: string
          total_destinatarios: number
          total_enviados: number
          total_falhados: number
          updated_at: string
        }
        Insert: {
          assunto: string
          conteudo_html?: string
          created_at?: string
          criado_por: string
          enviado_em?: string | null
          erro?: string | null
          id?: string
          imagem_url?: string | null
          status?: string
          total_destinatarios?: number
          total_enviados?: number
          total_falhados?: number
          updated_at?: string
        }
        Update: {
          assunto?: string
          conteudo_html?: string
          created_at?: string
          criado_por?: string
          enviado_em?: string | null
          erro?: string | null
          id?: string
          imagem_url?: string | null
          status?: string
          total_destinatarios?: number
          total_enviados?: number
          total_falhados?: number
          updated_at?: string
        }
        Relationships: []
      }
      empresa_reminder_settings: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          max_reminders: number
          reminder_intervals: number[]
          reminders_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          max_reminders?: number
          reminder_intervals?: number[]
          reminders_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          max_reminders?: number
          reminder_intervals?: number[]
          reminders_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      empresas: {
        Row: {
          ativo: boolean
          cnpj: string | null
          contato: string | null
          created_at: string
          creditos_consumidos: number | null
          data_alvo_certificacao: string | null
          data_fim_assinatura: string | null
          data_inicio_assinatura: string | null
          data_inicio_ciclo: string | null
          data_inicio_trial: string | null
          id: string
          logo_url: string | null
          nome: string
          objetivo_compliance: string | null
          plano_id: string | null
          porte_empresa: string | null
          setor_atuacao: string | null
          slug: string | null
          status_licenca: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          contato?: string | null
          created_at?: string
          creditos_consumidos?: number | null
          data_alvo_certificacao?: string | null
          data_fim_assinatura?: string | null
          data_inicio_assinatura?: string | null
          data_inicio_ciclo?: string | null
          data_inicio_trial?: string | null
          id?: string
          logo_url?: string | null
          nome: string
          objetivo_compliance?: string | null
          plano_id?: string | null
          porte_empresa?: string | null
          setor_atuacao?: string | null
          slug?: string | null
          status_licenca?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          contato?: string | null
          created_at?: string
          creditos_consumidos?: number | null
          data_alvo_certificacao?: string | null
          data_fim_assinatura?: string | null
          data_inicio_assinatura?: string | null
          data_inicio_ciclo?: string | null
          data_inicio_trial?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          objetivo_compliance?: string | null
          plano_id?: string | null
          porte_empresa?: string | null
          setor_atuacao?: string | null
          slug?: string | null
          status_licenca?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_library: {
        Row: {
          arquivo_hash: string | null
          arquivo_nome: string | null
          arquivo_tamanho: number | null
          arquivo_tipo: string | null
          arquivo_url: string | null
          created_at: string
          created_by: string | null
          descricao: string | null
          empresa_id: string
          id: string
          link_externo: string | null
          nome: string
          origem_evaluation_id: string | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          arquivo_hash?: string | null
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_tipo?: string | null
          arquivo_url?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id: string
          id?: string
          link_externo?: string | null
          nome: string
          origem_evaluation_id?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          arquivo_hash?: string | null
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_tipo?: string | null
          arquivo_url?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          link_externo?: string | null
          nome?: string
          origem_evaluation_id?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_library_origem_evaluation_id_fkey"
            columns: ["origem_evaluation_id"]
            isOneToOne: false
            referencedRelation: "gap_analysis_evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_library_links: {
        Row: {
          aceito_em: string | null
          aceito_por: string | null
          created_at: string
          created_by: string | null
          empresa_id: string
          evaluation_id: string
          evidence_id: string
          framework_id: string
          ia_justificativa: string | null
          ia_score: number | null
          id: string
          requirement_id: string
          updated_at: string
          vinculo_tipo: string
        }
        Insert: {
          aceito_em?: string | null
          aceito_por?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id: string
          evaluation_id: string
          evidence_id: string
          framework_id: string
          ia_justificativa?: string | null
          ia_score?: number | null
          id?: string
          requirement_id: string
          updated_at?: string
          vinculo_tipo?: string
        }
        Update: {
          aceito_em?: string | null
          aceito_por?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          evaluation_id?: string
          evidence_id?: string
          framework_id?: string
          ia_justificativa?: string | null
          ia_score?: number | null
          id?: string
          requirement_id?: string
          updated_at?: string
          vinculo_tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_library_links_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "gap_analysis_evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_library_links_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence_library"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          avaliacao_risco: string | null
          categoria: string | null
          cnpj: string | null
          contato_responsavel: string | null
          created_at: string
          data_cadastro: string | null
          email: string | null
          empresa_id: string
          endereco: string | null
          id: string
          nome: string
          observacoes: string | null
          status: string
          telefone: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          avaliacao_risco?: string | null
          categoria?: string | null
          cnpj?: string | null
          contato_responsavel?: string | null
          created_at?: string
          data_cadastro?: string | null
          email?: string | null
          empresa_id: string
          endereco?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          status?: string
          telefone?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          avaliacao_risco?: string | null
          categoria?: string | null
          cnpj?: string | null
          contato_responsavel?: string | null
          created_at?: string
          data_cadastro?: string | null
          email?: string | null
          empresa_id?: string
          endereco?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          status?: string
          telefone?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      gap_analysis_adherence_assessments: {
        Row: {
          analise_detalhada: string | null
          created_at: string
          created_by: string | null
          descricao: string | null
          documento_id: string | null
          documento_nome: string | null
          documento_tipo: string | null
          empresa_id: string
          framework_id: string
          framework_nome: string | null
          framework_versao: string | null
          gaps_identificados: Json | null
          id: string
          metadados_analise: Json | null
          nome_analise: string
          percentual_conformidade: number | null
          pontos_fortes: Json | null
          pontos_melhoria: Json | null
          recomendacoes: Json | null
          resultado_geral: string | null
          status: string
          updated_at: string
        }
        Insert: {
          analise_detalhada?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          documento_id?: string | null
          documento_nome?: string | null
          documento_tipo?: string | null
          empresa_id: string
          framework_id: string
          framework_nome?: string | null
          framework_versao?: string | null
          gaps_identificados?: Json | null
          id?: string
          metadados_analise?: Json | null
          nome_analise: string
          percentual_conformidade?: number | null
          pontos_fortes?: Json | null
          pontos_melhoria?: Json | null
          recomendacoes?: Json | null
          resultado_geral?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          analise_detalhada?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          documento_id?: string | null
          documento_nome?: string | null
          documento_tipo?: string | null
          empresa_id?: string
          framework_id?: string
          framework_nome?: string | null
          framework_versao?: string | null
          gaps_identificados?: Json | null
          id?: string
          metadados_analise?: Json | null
          nome_analise?: string
          percentual_conformidade?: number | null
          pontos_fortes?: Json | null
          pontos_melhoria?: Json | null
          recomendacoes?: Json | null
          resultado_geral?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gap_analysis_adherence_assessments_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gap_analysis_adherence_assessments_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gap_analysis_adherence_assessments_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "gap_analysis_frameworks"
            referencedColumns: ["id"]
          },
        ]
      }
      gap_analysis_adherence_details: {
        Row: {
          assessment_id: string
          created_at: string
          evidencias_encontradas: string | null
          gaps_especificos: string | null
          id: string
          justificativa_relevancia: string | null
          observacoes_ia: string | null
          requirement_id: string
          requisito_codigo: string | null
          requisito_titulo: string | null
          score_conformidade: number | null
          status_aderencia: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          evidencias_encontradas?: string | null
          gaps_especificos?: string | null
          id?: string
          justificativa_relevancia?: string | null
          observacoes_ia?: string | null
          requirement_id: string
          requisito_codigo?: string | null
          requisito_titulo?: string | null
          score_conformidade?: number | null
          status_aderencia: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          evidencias_encontradas?: string | null
          gaps_especificos?: string | null
          id?: string
          justificativa_relevancia?: string | null
          observacoes_ia?: string | null
          requirement_id?: string
          requisito_codigo?: string | null
          requisito_titulo?: string | null
          score_conformidade?: number | null
          status_aderencia?: string
        }
        Relationships: [
          {
            foreignKeyName: "gap_analysis_adherence_details_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "gap_analysis_adherence_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gap_analysis_adherence_details_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "gap_analysis_requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      gap_analysis_assessments: {
        Row: {
          created_at: string
          created_by: string | null
          data_conclusao: string | null
          data_inicio: string | null
          data_prevista_conclusao: string | null
          descricao: string | null
          empresa_id: string
          framework_id: string
          id: string
          nome: string
          percentual_conclusao: number | null
          responsavel_geral: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_conclusao?: string | null
          data_inicio?: string | null
          data_prevista_conclusao?: string | null
          descricao?: string | null
          empresa_id: string
          framework_id: string
          id?: string
          nome: string
          percentual_conclusao?: number | null
          responsavel_geral?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_conclusao?: string | null
          data_inicio?: string | null
          data_prevista_conclusao?: string | null
          descricao?: string | null
          empresa_id?: string
          framework_id?: string
          id?: string
          nome?: string
          percentual_conclusao?: number | null
          responsavel_geral?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gap_analysis_assessments_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "gap_analysis_frameworks"
            referencedColumns: ["id"]
          },
        ]
      }
      gap_analysis_assignments: {
        Row: {
          assessment_id: string
          assigned_by: string
          assigned_to: string
          created_at: string
          data_conclusao: string | null
          id: string
          instrucoes: string | null
          notificado_em: string | null
          observacoes_conclusao: string | null
          prazo: string | null
          requirement_id: string
          status: string
          updated_at: string
        }
        Insert: {
          assessment_id: string
          assigned_by: string
          assigned_to: string
          created_at?: string
          data_conclusao?: string | null
          id?: string
          instrucoes?: string | null
          notificado_em?: string | null
          observacoes_conclusao?: string | null
          prazo?: string | null
          requirement_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          assessment_id?: string
          assigned_by?: string
          assigned_to?: string
          created_at?: string
          data_conclusao?: string | null
          id?: string
          instrucoes?: string | null
          notificado_em?: string | null
          observacoes_conclusao?: string | null
          prazo?: string | null
          requirement_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gap_analysis_assignments_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "gap_analysis_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gap_analysis_assignments_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "gap_analysis_requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      gap_analysis_audit_log: {
        Row: {
          campo_alterado: string
          created_at: string
          empresa_id: string
          evaluation_id: string
          framework_id: string
          id: string
          requirement_id: string
          user_id: string | null
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          campo_alterado: string
          created_at?: string
          empresa_id: string
          evaluation_id: string
          framework_id: string
          id?: string
          requirement_id: string
          user_id?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          campo_alterado?: string
          created_at?: string
          empresa_id?: string
          evaluation_id?: string
          framework_id?: string
          id?: string
          requirement_id?: string
          user_id?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gap_analysis_audit_log_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      gap_analysis_evaluations: {
        Row: {
          action_preview: string | null
          assessment_id: string | null
          conformity_status: string | null
          created_at: string
          created_by: string | null
          data_avaliacao: string | null
          diagnostic_answers: Json | null
          empresa_id: string
          evidence_files: Json | null
          evidence_implemented: string | null
          evidence_status: string | null
          framework_id: string | null
          id: string
          observacoes: string | null
          plano_acao: string | null
          plano_acao_id: string | null
          pontuacao: number | null
          prazo_implementacao: string | null
          requirement_id: string
          responsavel_avaliacao: string | null
          responsible_area: string | null
          status: string
          updated_at: string
        }
        Insert: {
          action_preview?: string | null
          assessment_id?: string | null
          conformity_status?: string | null
          created_at?: string
          created_by?: string | null
          data_avaliacao?: string | null
          diagnostic_answers?: Json | null
          empresa_id?: string
          evidence_files?: Json | null
          evidence_implemented?: string | null
          evidence_status?: string | null
          framework_id?: string | null
          id?: string
          observacoes?: string | null
          plano_acao?: string | null
          plano_acao_id?: string | null
          pontuacao?: number | null
          prazo_implementacao?: string | null
          requirement_id: string
          responsavel_avaliacao?: string | null
          responsible_area?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          action_preview?: string | null
          assessment_id?: string | null
          conformity_status?: string | null
          created_at?: string
          created_by?: string | null
          data_avaliacao?: string | null
          diagnostic_answers?: Json | null
          empresa_id?: string
          evidence_files?: Json | null
          evidence_implemented?: string | null
          evidence_status?: string | null
          framework_id?: string | null
          id?: string
          observacoes?: string | null
          plano_acao?: string | null
          plano_acao_id?: string | null
          pontuacao?: number | null
          prazo_implementacao?: string | null
          requirement_id?: string
          responsavel_avaliacao?: string | null
          responsible_area?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gap_analysis_evaluations_plano_acao_id_fkey"
            columns: ["plano_acao_id"]
            isOneToOne: false
            referencedRelation: "planos_acao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gap_analysis_evaluations_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "gap_analysis_requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      gap_analysis_evidences: {
        Row: {
          arquivo_nome: string | null
          arquivo_tamanho: number | null
          arquivo_tipo: string | null
          arquivo_url: string | null
          created_at: string
          created_by: string | null
          descricao: string | null
          evaluation_id: string
          id: string
          link_externo: string | null
          nome: string
          tipo: string
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_tipo?: string | null
          arquivo_url?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          evaluation_id: string
          id?: string
          link_externo?: string | null
          nome: string
          tipo?: string
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_tipo?: string | null
          arquivo_url?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          evaluation_id?: string
          id?: string
          link_externo?: string | null
          nome?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "gap_analysis_evidences_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "gap_analysis_evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      gap_analysis_frameworks: {
        Row: {
          created_at: string
          created_by: string | null
          descricao: string | null
          empresa_id: string | null
          id: string
          is_template: boolean | null
          nome: string
          tipo: string
          tipo_framework: string | null
          updated_at: string
          versao: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          is_template?: boolean | null
          nome: string
          tipo?: string
          tipo_framework?: string | null
          updated_at?: string
          versao?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          is_template?: boolean | null
          nome?: string
          tipo?: string
          tipo_framework?: string | null
          updated_at?: string
          versao?: string | null
        }
        Relationships: []
      }
      gap_analysis_requirements: {
        Row: {
          area_responsavel: string | null
          categoria: string | null
          codigo: string | null
          created_at: string
          descricao: string | null
          exemplos_evidencias: string | null
          framework_id: string
          id: string
          obrigatorio: boolean | null
          ordem: number | null
          orientacao_implementacao: string | null
          perguntas_diagnostico: string | null
          peso: number | null
          titulo: string
          updated_at: string
        }
        Insert: {
          area_responsavel?: string | null
          categoria?: string | null
          codigo?: string | null
          created_at?: string
          descricao?: string | null
          exemplos_evidencias?: string | null
          framework_id: string
          id?: string
          obrigatorio?: boolean | null
          ordem?: number | null
          orientacao_implementacao?: string | null
          perguntas_diagnostico?: string | null
          peso?: number | null
          titulo: string
          updated_at?: string
        }
        Update: {
          area_responsavel?: string | null
          categoria?: string | null
          codigo?: string | null
          created_at?: string
          descricao?: string | null
          exemplos_evidencias?: string | null
          framework_id?: string
          id?: string
          obrigatorio?: boolean | null
          ordem?: number | null
          orientacao_implementacao?: string | null
          perguntas_diagnostico?: string | null
          peso?: number | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gap_analysis_requirements_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "gap_analysis_frameworks"
            referencedColumns: ["id"]
          },
        ]
      }
      gap_analysis_score_history: {
        Row: {
          created_at: string | null
          empresa_id: string
          evaluated_requirements: number
          framework_id: string
          id: string
          recorded_at: string | null
          score: number
          total_requirements: number
        }
        Insert: {
          created_at?: string | null
          empresa_id: string
          evaluated_requirements: number
          framework_id: string
          id?: string
          recorded_at?: string | null
          score: number
          total_requirements: number
        }
        Update: {
          created_at?: string | null
          empresa_id?: string
          evaluated_requirements?: number
          framework_id?: string
          id?: string
          recorded_at?: string | null
          score?: number
          total_requirements?: number
        }
        Relationships: [
          {
            foreignKeyName: "gap_analysis_score_history_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gap_analysis_score_history_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "gap_analysis_frameworks"
            referencedColumns: ["id"]
          },
        ]
      }
      gap_analysis_soa: {
        Row: {
          aplicavel: boolean
          created_at: string
          empresa_id: string
          framework_id: string
          id: string
          justificativa: string | null
          requirement_id: string
          updated_at: string
        }
        Insert: {
          aplicavel?: boolean
          created_at?: string
          empresa_id: string
          framework_id: string
          id?: string
          justificativa?: string | null
          requirement_id: string
          updated_at?: string
        }
        Update: {
          aplicavel?: boolean
          created_at?: string
          empresa_id?: string
          framework_id?: string
          id?: string
          justificativa?: string | null
          requirement_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gap_analysis_soa_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gap_analysis_soa_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "gap_analysis_frameworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gap_analysis_soa_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "gap_analysis_requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      gap_evaluation_risks: {
        Row: {
          created_at: string | null
          evaluation_id: string
          id: string
          risco_id: string
        }
        Insert: {
          created_at?: string | null
          evaluation_id: string
          id?: string
          risco_id: string
        }
        Update: {
          created_at?: string | null
          evaluation_id?: string
          id?: string
          risco_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gap_evaluation_risks_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "gap_analysis_evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gap_evaluation_risks_risco_id_fkey"
            columns: ["risco_id"]
            isOneToOne: false
            referencedRelation: "riscos"
            referencedColumns: ["id"]
          },
        ]
      }
      incidentes: {
        Row: {
          ativos_afetados: string[] | null
          categoria: string | null
          created_at: string
          created_by: string | null
          criticidade: string
          dados_afetados: string | null
          data_deteccao: string
          data_ocorrencia: string | null
          data_resolucao: string | null
          descricao: string | null
          empresa_id: string
          id: string
          impacto_estimado: string | null
          origem_deteccao: string | null
          responsavel_deteccao: string | null
          responsavel_tratamento: string | null
          riscos_relacionados: string[] | null
          sistemas_afetados: string[] | null
          status: string
          tipo_incidente: string
          titulo: string
          updated_at: string
        }
        Insert: {
          ativos_afetados?: string[] | null
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          criticidade?: string
          dados_afetados?: string | null
          data_deteccao?: string
          data_ocorrencia?: string | null
          data_resolucao?: string | null
          descricao?: string | null
          empresa_id: string
          id?: string
          impacto_estimado?: string | null
          origem_deteccao?: string | null
          responsavel_deteccao?: string | null
          responsavel_tratamento?: string | null
          riscos_relacionados?: string[] | null
          sistemas_afetados?: string[] | null
          status?: string
          tipo_incidente?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          ativos_afetados?: string[] | null
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          criticidade?: string
          dados_afetados?: string | null
          data_deteccao?: string
          data_ocorrencia?: string | null
          data_resolucao?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          impacto_estimado?: string | null
          origem_deteccao?: string | null
          responsavel_deteccao?: string | null
          responsavel_tratamento?: string | null
          riscos_relacionados?: string[] | null
          sistemas_afetados?: string[] | null
          status?: string
          tipo_incidente?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      incidentes_comunicacoes: {
        Row: {
          created_at: string
          created_by: string | null
          data_comunicacao: string
          destinatario: string
          id: string
          incidente_id: string
          meio_comunicacao: string
          observacoes: string | null
          template_usado: string | null
          tipo_comunicacao: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_comunicacao?: string
          destinatario: string
          id?: string
          incidente_id: string
          meio_comunicacao?: string
          observacoes?: string | null
          template_usado?: string | null
          tipo_comunicacao: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_comunicacao?: string
          destinatario?: string
          id?: string
          incidente_id?: string
          meio_comunicacao?: string
          observacoes?: string | null
          template_usado?: string | null
          tipo_comunicacao?: string
        }
        Relationships: []
      }
      incidentes_evidencias: {
        Row: {
          arquivo_nome: string | null
          arquivo_tamanho: number | null
          arquivo_tipo: string | null
          arquivo_url: string | null
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          incidente_id: string
          nome: string
          tipo_evidencia: string
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_tipo?: string | null
          arquivo_url?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          incidente_id: string
          nome: string
          tipo_evidencia?: string
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_tipo?: string | null
          arquivo_url?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          incidente_id?: string
          nome?: string
          tipo_evidencia?: string
        }
        Relationships: []
      }
      incidentes_tratamentos: {
        Row: {
          created_at: string
          created_by: string | null
          data_conclusao: string | null
          data_prazo: string | null
          descricao: string
          id: string
          incidente_id: string
          observacoes: string | null
          responsavel_id: string | null
          status: string
          tipo_acao: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_conclusao?: string | null
          data_prazo?: string | null
          descricao: string
          id?: string
          incidente_id: string
          observacoes?: string | null
          responsavel_id?: string | null
          status?: string
          tipo_acao?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_conclusao?: string | null
          data_prazo?: string | null
          descricao?: string
          id?: string
          incidente_id?: string
          observacoes?: string | null
          responsavel_id?: string | null
          status?: string
          tipo_acao?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      integracoes_config: {
        Row: {
          configuracoes: Json | null
          created_at: string
          created_by: string | null
          credenciais_encrypted: string | null
          empresa_id: string
          erro_ultima_sincronizacao: string | null
          id: string
          nome_exibicao: string
          status: string
          tipo_integracao: string
          ultima_sincronizacao: string | null
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          configuracoes?: Json | null
          created_at?: string
          created_by?: string | null
          credenciais_encrypted?: string | null
          empresa_id: string
          erro_ultima_sincronizacao?: string | null
          id?: string
          nome_exibicao: string
          status?: string
          tipo_integracao: string
          ultima_sincronizacao?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          configuracoes?: Json | null
          created_at?: string
          created_by?: string | null
          credenciais_encrypted?: string | null
          empresa_id?: string
          erro_ultima_sincronizacao?: string | null
          id?: string
          nome_exibicao?: string
          status?: string
          tipo_integracao?: string
          ultima_sincronizacao?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integracoes_config_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      integracoes_webhook_logs: {
        Row: {
          created_at: string
          empresa_id: string
          evento: string
          id: string
          integracao_id: string | null
          payload: Json | null
          resposta: string | null
          status_code: number | null
          sucesso: boolean | null
        }
        Insert: {
          created_at?: string
          empresa_id: string
          evento: string
          id?: string
          integracao_id?: string | null
          payload?: Json | null
          resposta?: string | null
          status_code?: number | null
          sucesso?: boolean | null
        }
        Update: {
          created_at?: string
          empresa_id?: string
          evento?: string
          id?: string
          integracao_id?: string | null
          payload?: Json | null
          resposta?: string | null
          status_code?: number | null
          sucesso?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "integracoes_webhook_logs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integracoes_webhook_logs_integracao_id_fkey"
            columns: ["integracao_id"]
            isOneToOne: false
            referencedRelation: "integracoes_config"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_codes: {
        Row: {
          attempts: number
          code: string
          created_at: string
          empresa_id: string
          expires_at: string
          id: string
          used: boolean
          user_id: string
        }
        Insert: {
          attempts?: number
          code: string
          created_at?: string
          empresa_id: string
          expires_at?: string
          id?: string
          used?: boolean
          user_id: string
        }
        Update: {
          attempts?: number
          code?: string
          created_at?: string
          empresa_id?: string
          expires_at?: string
          id?: string
          used?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mfa_codes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_sessions: {
        Row: {
          created_at: string
          empresa_id: string
          expires_at: string
          id: string
          ip_hint: string | null
          user_id: string
          verified_at: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          expires_at?: string
          id?: string
          ip_hint?: string | null
          user_id: string
          verified_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          expires_at?: string
          id?: string
          ip_hint?: string | null
          user_id?: string
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mfa_sessions_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link_to: string | null
          message: string | null
          metadata: Json | null
          read: boolean | null
          title: string
          type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link_to?: string | null
          message?: string | null
          metadata?: Json | null
          read?: boolean | null
          title: string
          type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link_to?: string | null
          message?: string | null
          metadata?: Json | null
          read?: boolean | null
          title?: string
          type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      onboarding_progress: {
        Row: {
          completed: boolean
          created_at: string
          current_step: number
          dismissed: boolean
          empresa_id: string
          id: string
          steps_completed: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          current_step?: number
          dismissed?: boolean
          empresa_id: string
          id?: string
          steps_completed?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          current_step?: number
          dismissed?: boolean
          empresa_id?: string
          id?: string
          steps_completed?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_progress_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_profile_modules: {
        Row: {
          can_access: boolean
          can_create: boolean
          can_delete: boolean
          can_read: boolean
          can_update: boolean
          id: string
          module_id: string
          profile_id: string
        }
        Insert: {
          can_access?: boolean
          can_create?: boolean
          can_delete?: boolean
          can_read?: boolean
          can_update?: boolean
          id?: string
          module_id: string
          profile_id: string
        }
        Update: {
          can_access?: boolean
          can_create?: boolean
          can_delete?: boolean
          can_read?: boolean
          can_update?: boolean
          id?: string
          module_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_profile_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "system_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_profile_modules_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "permission_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_profiles: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          empresa_id: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          empresa_id: string
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          empresa_id?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_profiles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      planos: {
        Row: {
          ativo: boolean | null
          codigo: string
          cor_primaria: string | null
          created_at: string | null
          creditos_franquia: number
          descricao: string | null
          icone: string | null
          id: string
          is_destaque: boolean
          limite_usuarios: number | null
          modulos_habilitados: Json
          moeda: string
          nome: string
          ordem: number
          preco_anual: number
          preco_mensal: number
          preco_setup: number | null
          publico_alvo: string | null
          recursos_destacados: Json
          setup_observacao: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          codigo: string
          cor_primaria?: string | null
          created_at?: string | null
          creditos_franquia: number
          descricao?: string | null
          icone?: string | null
          id?: string
          is_destaque?: boolean
          limite_usuarios?: number | null
          modulos_habilitados?: Json
          moeda?: string
          nome: string
          ordem?: number
          preco_anual?: number
          preco_mensal?: number
          preco_setup?: number | null
          publico_alvo?: string | null
          recursos_destacados?: Json
          setup_observacao?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          codigo?: string
          cor_primaria?: string | null
          created_at?: string | null
          creditos_franquia?: number
          descricao?: string | null
          icone?: string | null
          id?: string
          is_destaque?: boolean
          limite_usuarios?: number | null
          modulos_habilitados?: Json
          moeda?: string
          nome?: string
          ordem?: number
          preco_anual?: number
          preco_mensal?: number
          preco_setup?: number | null
          publico_alvo?: string | null
          recursos_destacados?: Json
          setup_observacao?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      planos_acao: {
        Row: {
          created_at: string
          created_by: string | null
          data_conclusao: string | null
          descricao: string | null
          empresa_id: string
          id: string
          modulo_origem: string | null
          observacoes: string | null
          prazo: string | null
          prioridade: string
          registro_origem_id: string | null
          registro_origem_titulo: string | null
          responsavel_id: string | null
          status: string
          tags: string[] | null
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_conclusao?: string | null
          descricao?: string | null
          empresa_id: string
          id?: string
          modulo_origem?: string | null
          observacoes?: string | null
          prazo?: string | null
          prioridade?: string
          registro_origem_id?: string | null
          registro_origem_titulo?: string | null
          responsavel_id?: string | null
          status?: string
          tags?: string[] | null
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_conclusao?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          modulo_origem?: string | null
          observacoes?: string | null
          prazo?: string | null
          prioridade?: string
          registro_origem_id?: string | null
          registro_origem_titulo?: string | null
          responsavel_id?: string | null
          status?: string
          tags?: string[] | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planos_acao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      planos_acao_comentarios: {
        Row: {
          comentario: string
          created_at: string
          id: string
          plano_id: string
          user_id: string
        }
        Insert: {
          comentario: string
          created_at?: string
          id?: string
          plano_id: string
          user_id: string
        }
        Update: {
          comentario?: string
          created_at?: string
          id?: string
          plano_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planos_acao_comentarios_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos_acao"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ativo: boolean
          created_at: string
          email: string
          empresa_id: string | null
          foto_url: string | null
          id: string
          invitation_link: string | null
          invitation_sent_at: string | null
          nome: string
          permission_profile_id: string | null
          preferred_locale: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email: string
          empresa_id?: string | null
          foto_url?: string | null
          id?: string
          invitation_link?: string | null
          invitation_sent_at?: string | null
          nome: string
          permission_profile_id?: string | null
          preferred_locale?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string
          empresa_id?: string | null
          foto_url?: string | null
          id?: string
          invitation_link?: string | null
          invitation_sent_at?: string | null
          nome?: string
          permission_profile_id?: string | null
          preferred_locale?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_permission_profile_id_fkey"
            columns: ["permission_profile_id"]
            isOneToOne: false
            referencedRelation: "permission_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_colunas: {
        Row: {
          cor: string | null
          created_at: string
          id: string
          is_concluido: boolean
          nome: string
          ordem: number
          projeto_id: string
          wip_limit: number | null
        }
        Insert: {
          cor?: string | null
          created_at?: string
          id?: string
          is_concluido?: boolean
          nome: string
          ordem?: number
          projeto_id: string
          wip_limit?: number | null
        }
        Update: {
          cor?: string | null
          created_at?: string
          id?: string
          is_concluido?: boolean
          nome?: string
          ordem?: number
          projeto_id?: string
          wip_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projeto_colunas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_membros: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          papel: Database["public"]["Enums"]["projeto_membro_papel"]
          projeto_id: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          papel?: Database["public"]["Enums"]["projeto_membro_papel"]
          projeto_id: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          papel?: Database["public"]["Enums"]["projeto_membro_papel"]
          projeto_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_membros_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_tarefa_anexos: {
        Row: {
          created_at: string
          id: string
          nome: string
          storage_path: string
          tamanho_bytes: number | null
          tarefa_id: string
          tipo: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          storage_path: string
          tamanho_bytes?: number | null
          tarefa_id: string
          tipo?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          storage_path?: string
          tamanho_bytes?: number | null
          tarefa_id?: string
          tipo?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projeto_tarefa_anexos_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "projeto_tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_tarefa_atividade: {
        Row: {
          campo: string
          created_at: string
          id: string
          tarefa_id: string
          user_id: string | null
          valor_antigo: string | null
          valor_novo: string | null
        }
        Insert: {
          campo: string
          created_at?: string
          id?: string
          tarefa_id: string
          user_id?: string | null
          valor_antigo?: string | null
          valor_novo?: string | null
        }
        Update: {
          campo?: string
          created_at?: string
          id?: string
          tarefa_id?: string
          user_id?: string | null
          valor_antigo?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projeto_tarefa_atividade_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "projeto_tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_tarefa_checklist: {
        Row: {
          concluido: boolean
          created_at: string
          id: string
          ordem: number
          tarefa_id: string
          texto: string
        }
        Insert: {
          concluido?: boolean
          created_at?: string
          id?: string
          ordem?: number
          tarefa_id: string
          texto: string
        }
        Update: {
          concluido?: boolean
          created_at?: string
          id?: string
          ordem?: number
          tarefa_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_tarefa_checklist_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "projeto_tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_tarefa_comentarios: {
        Row: {
          conteudo: string
          created_at: string
          id: string
          mencionados: string[] | null
          tarefa_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conteudo: string
          created_at?: string
          id?: string
          mencionados?: string[] | null
          tarefa_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conteudo?: string
          created_at?: string
          id?: string
          mencionados?: string[] | null
          tarefa_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_tarefa_comentarios_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "projeto_tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_tarefa_dependencias: {
        Row: {
          created_at: string
          depende_de_tarefa_id: string
          id: string
          tarefa_id: string
          tipo: Database["public"]["Enums"]["projeto_dependencia_tipo"]
        }
        Insert: {
          created_at?: string
          depende_de_tarefa_id: string
          id?: string
          tarefa_id: string
          tipo?: Database["public"]["Enums"]["projeto_dependencia_tipo"]
        }
        Update: {
          created_at?: string
          depende_de_tarefa_id?: string
          id?: string
          tarefa_id?: string
          tipo?: Database["public"]["Enums"]["projeto_dependencia_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "projeto_tarefa_dependencias_depende_de_tarefa_id_fkey"
            columns: ["depende_de_tarefa_id"]
            isOneToOne: false
            referencedRelation: "projeto_tarefas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_tarefa_dependencias_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "projeto_tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_tarefa_seguidores: {
        Row: {
          created_at: string
          id: string
          tarefa_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tarefa_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tarefa_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_tarefa_seguidores_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "projeto_tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_tarefa_vinculos: {
        Row: {
          created_at: string
          criado_por: string | null
          entidade_id: string
          entidade_tipo: Database["public"]["Enums"]["projeto_vinculo_entidade"]
          id: string
          tarefa_id: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          entidade_id: string
          entidade_tipo: Database["public"]["Enums"]["projeto_vinculo_entidade"]
          id?: string
          tarefa_id: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          entidade_id?: string
          entidade_tipo?: Database["public"]["Enums"]["projeto_vinculo_entidade"]
          id?: string
          tarefa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_tarefa_vinculos_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "projeto_tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_tarefas: {
        Row: {
          bloqueada: boolean
          coluna_id: string | null
          concluida_em: string | null
          created_at: string
          criador_id: string | null
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          estimativa_horas: number | null
          id: string
          ordem: number
          parent_task_id: string | null
          prazo: string | null
          prioridade: Database["public"]["Enums"]["projeto_tarefa_prioridade"]
          progresso_pct: number
          projeto_id: string
          responsavel_id: string | null
          tags: string[] | null
          tempo_gasto_horas: number | null
          titulo: string
          updated_at: string
        }
        Insert: {
          bloqueada?: boolean
          coluna_id?: string | null
          concluida_em?: string | null
          created_at?: string
          criador_id?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          estimativa_horas?: number | null
          id?: string
          ordem?: number
          parent_task_id?: string | null
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["projeto_tarefa_prioridade"]
          progresso_pct?: number
          projeto_id: string
          responsavel_id?: string | null
          tags?: string[] | null
          tempo_gasto_horas?: number | null
          titulo: string
          updated_at?: string
        }
        Update: {
          bloqueada?: boolean
          coluna_id?: string | null
          concluida_em?: string | null
          created_at?: string
          criador_id?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          estimativa_horas?: number | null
          id?: string
          ordem?: number
          parent_task_id?: string | null
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["projeto_tarefa_prioridade"]
          progresso_pct?: number
          projeto_id?: string
          responsavel_id?: string | null
          tags?: string[] | null
          tempo_gasto_horas?: number | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_tarefas_coluna_id_fkey"
            columns: ["coluna_id"]
            isOneToOne: false
            referencedRelation: "projeto_colunas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_tarefas_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "projeto_tarefas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_tarefas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      projetos: {
        Row: {
          configuracoes: Json | null
          cor: string | null
          created_at: string
          created_by: string | null
          data_fim_prevista: string | null
          data_inicio: string | null
          descricao: string | null
          empresa_id: string
          icone: string | null
          id: string
          nome: string
          owner_id: string
          status: Database["public"]["Enums"]["projeto_status"]
          updated_at: string
        }
        Insert: {
          configuracoes?: Json | null
          cor?: string | null
          created_at?: string
          created_by?: string | null
          data_fim_prevista?: string | null
          data_inicio?: string | null
          descricao?: string | null
          empresa_id: string
          icone?: string | null
          id?: string
          nome: string
          owner_id: string
          status?: Database["public"]["Enums"]["projeto_status"]
          updated_at?: string
        }
        Update: {
          configuracoes?: Json | null
          cor?: string | null
          created_at?: string
          created_by?: string | null
          data_fim_prevista?: string | null
          data_inicio?: string | null
          descricao?: string | null
          empresa_id?: string
          icone?: string | null
          id?: string
          nome?: string
          owner_id?: string
          status?: Database["public"]["Enums"]["projeto_status"]
          updated_at?: string
        }
        Relationships: []
      }
      relatorio_agendamentos: {
        Row: {
          ativo: boolean
          created_at: string
          destinatarios: string[]
          dia_envio: number | null
          empresa_id: string
          frequencia: string
          id: string
          proximo_envio: string | null
          relatorio_id: string
          ultimo_envio: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          destinatarios?: string[]
          dia_envio?: number | null
          empresa_id: string
          frequencia: string
          id?: string
          proximo_envio?: string | null
          relatorio_id: string
          ultimo_envio?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          destinatarios?: string[]
          dia_envio?: number | null
          empresa_id?: string
          frequencia?: string
          id?: string
          proximo_envio?: string | null
          relatorio_id?: string
          ultimo_envio?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "relatorio_agendamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorio_agendamentos_relatorio_id_fkey"
            columns: ["relatorio_id"]
            isOneToOne: false
            referencedRelation: "relatorios_customizados"
            referencedColumns: ["id"]
          },
        ]
      }
      relatorios_customizados: {
        Row: {
          configuracao: Json
          created_at: string
          created_by: string | null
          descricao: string | null
          empresa_id: string
          id: string
          nome: string
          status: string
          template_base: string | null
          tipo: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          configuracao?: Json
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id: string
          id?: string
          nome: string
          status?: string
          template_base?: string | null
          tipo?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          configuracao?: Json
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          status?: string
          template_base?: string | null
          tipo?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relatorios_customizados_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      relatorios_salvos: {
        Row: {
          configuracao: Json
          created_at: string | null
          created_by: string | null
          empresa_id: string
          id: string
          nome: string
          tipo: string
          updated_at: string | null
        }
        Insert: {
          configuracao: Json
          created_at?: string | null
          created_by?: string | null
          empresa_id: string
          id?: string
          nome: string
          tipo: string
          updated_at?: string | null
        }
        Update: {
          configuracao?: Json
          created_at?: string | null
          created_by?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          tipo?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      riscos: {
        Row: {
          aceito: boolean | null
          aprovador_aceite: string | null
          aprovador_id: string | null
          categoria_id: string | null
          causas: string | null
          comentarios_aprovacao: string | null
          consequencias: string | null
          controles_existentes: string | null
          created_at: string
          created_by: string | null
          data_aceite: string | null
          data_aprovacao: string | null
          data_avaliacao: string | null
          data_envio_aprovacao: string | null
          data_identificacao: string
          data_proxima_revisao: string | null
          descricao: string | null
          empresa_id: string
          historico_aprovacao: Json | null
          id: string
          impacto_inicial: string
          impacto_residual: string | null
          justificativa_aceite: string | null
          matriz_id: string | null
          nivel_risco_inicial: string
          nivel_risco_residual: string | null
          nome: string
          probabilidade_inicial: string
          probabilidade_residual: string | null
          responsavel: string | null
          status: string
          status_aceite: string | null
          status_aprovacao: string | null
          updated_at: string
        }
        Insert: {
          aceito?: boolean | null
          aprovador_aceite?: string | null
          aprovador_id?: string | null
          categoria_id?: string | null
          causas?: string | null
          comentarios_aprovacao?: string | null
          consequencias?: string | null
          controles_existentes?: string | null
          created_at?: string
          created_by?: string | null
          data_aceite?: string | null
          data_aprovacao?: string | null
          data_avaliacao?: string | null
          data_envio_aprovacao?: string | null
          data_identificacao?: string
          data_proxima_revisao?: string | null
          descricao?: string | null
          empresa_id: string
          historico_aprovacao?: Json | null
          id?: string
          impacto_inicial: string
          impacto_residual?: string | null
          justificativa_aceite?: string | null
          matriz_id?: string | null
          nivel_risco_inicial: string
          nivel_risco_residual?: string | null
          nome: string
          probabilidade_inicial: string
          probabilidade_residual?: string | null
          responsavel?: string | null
          status?: string
          status_aceite?: string | null
          status_aprovacao?: string | null
          updated_at?: string
        }
        Update: {
          aceito?: boolean | null
          aprovador_aceite?: string | null
          aprovador_id?: string | null
          categoria_id?: string | null
          causas?: string | null
          comentarios_aprovacao?: string | null
          consequencias?: string | null
          controles_existentes?: string | null
          created_at?: string
          created_by?: string | null
          data_aceite?: string | null
          data_aprovacao?: string | null
          data_avaliacao?: string | null
          data_envio_aprovacao?: string | null
          data_identificacao?: string
          data_proxima_revisao?: string | null
          descricao?: string | null
          empresa_id?: string
          historico_aprovacao?: Json | null
          id?: string
          impacto_inicial?: string
          impacto_residual?: string | null
          justificativa_aceite?: string | null
          matriz_id?: string | null
          nivel_risco_inicial?: string
          nivel_risco_residual?: string | null
          nome?: string
          probabilidade_inicial?: string
          probabilidade_residual?: string | null
          responsavel?: string | null
          status?: string
          status_aceite?: string | null
          status_aprovacao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "riscos_aprovador_aceite_fkey"
            columns: ["aprovador_aceite"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "riscos_aprovador_id_fkey"
            columns: ["aprovador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "riscos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "riscos_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riscos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riscos_matriz_id_fkey"
            columns: ["matriz_id"]
            isOneToOne: false
            referencedRelation: "riscos_matrizes"
            referencedColumns: ["id"]
          },
        ]
      }
      riscos_anexos: {
        Row: {
          created_at: string
          created_by: string | null
          empresa_id: string
          id: string
          nome_arquivo: string
          risco_id: string
          tamanho_arquivo: number | null
          tipo_anexo: string
          tipo_arquivo: string | null
          url_arquivo: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          empresa_id: string
          id?: string
          nome_arquivo: string
          risco_id: string
          tamanho_arquivo?: number | null
          tipo_anexo?: string
          tipo_arquivo?: string | null
          url_arquivo: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          id?: string
          nome_arquivo?: string
          risco_id?: string
          tamanho_arquivo?: number | null
          tipo_anexo?: string
          tipo_arquivo?: string | null
          url_arquivo?: string
        }
        Relationships: []
      }
      riscos_aprovacoes_notificacoes: {
        Row: {
          aprovador_id: string | null
          created_at: string | null
          empresa_id: string | null
          id: string
          lida: boolean | null
          risco_id: string | null
          solicitante_id: string | null
          tipo_notificacao: string | null
        }
        Insert: {
          aprovador_id?: string | null
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          lida?: boolean | null
          risco_id?: string | null
          solicitante_id?: string | null
          tipo_notificacao?: string | null
        }
        Update: {
          aprovador_id?: string | null
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          lida?: boolean | null
          risco_id?: string | null
          solicitante_id?: string | null
          tipo_notificacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "riscos_aprovacoes_notificacoes_aprovador_id_fkey"
            columns: ["aprovador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "riscos_aprovacoes_notificacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riscos_aprovacoes_notificacoes_risco_id_fkey"
            columns: ["risco_id"]
            isOneToOne: false
            referencedRelation: "riscos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riscos_aprovacoes_notificacoes_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      riscos_ativos: {
        Row: {
          ativo_id: string
          created_at: string
          id: string
          observacao: string | null
          risco_id: string
        }
        Insert: {
          ativo_id: string
          created_at?: string
          id?: string
          observacao?: string | null
          risco_id: string
        }
        Update: {
          ativo_id?: string
          created_at?: string
          id?: string
          observacao?: string | null
          risco_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "riscos_ativos_ativo_id_fkey"
            columns: ["ativo_id"]
            isOneToOne: false
            referencedRelation: "ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riscos_ativos_risco_id_fkey"
            columns: ["risco_id"]
            isOneToOne: false
            referencedRelation: "riscos"
            referencedColumns: ["id"]
          },
        ]
      }
      riscos_categorias: {
        Row: {
          cor: string | null
          created_at: string
          descricao: string | null
          empresa_id: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          cor?: string | null
          created_at?: string
          descricao?: string | null
          empresa_id: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          cor?: string | null
          created_at?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "riscos_categorias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      riscos_historico_avaliacoes: {
        Row: {
          avaliado_por: string | null
          created_at: string
          empresa_id: string
          id: string
          impacto: string
          nivel_risco: string
          observacoes: string | null
          probabilidade: string
          risco_id: string
          tipo: string
        }
        Insert: {
          avaliado_por?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          impacto: string
          nivel_risco: string
          observacoes?: string | null
          probabilidade: string
          risco_id: string
          tipo?: string
        }
        Update: {
          avaliado_por?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          impacto?: string
          nivel_risco?: string
          observacoes?: string | null
          probabilidade?: string
          risco_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "riscos_historico_avaliacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riscos_historico_avaliacoes_risco_id_fkey"
            columns: ["risco_id"]
            isOneToOne: false
            referencedRelation: "riscos"
            referencedColumns: ["id"]
          },
        ]
      }
      riscos_matriz_configuracao: {
        Row: {
          created_at: string
          escala_impacto: Json
          escala_probabilidade: Json
          id: string
          matriz_id: string
          metodo_calculo: string
          niveis_risco: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          escala_impacto: Json
          escala_probabilidade: Json
          id?: string
          matriz_id: string
          metodo_calculo?: string
          niveis_risco: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          escala_impacto?: Json
          escala_probabilidade?: Json
          id?: string
          matriz_id?: string
          metodo_calculo?: string
          niveis_risco?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "riscos_matriz_configuracao_matriz_id_fkey"
            columns: ["matriz_id"]
            isOneToOne: false
            referencedRelation: "riscos_matrizes"
            referencedColumns: ["id"]
          },
        ]
      }
      riscos_matrizes: {
        Row: {
          created_at: string
          descricao: string | null
          empresa_id: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          empresa_id: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "riscos_matrizes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      riscos_tratamentos: {
        Row: {
          created_at: string
          custo: number | null
          data_conclusao: string | null
          data_inicio: string | null
          descricao: string
          eficacia: string | null
          id: string
          prazo: string | null
          responsavel: string | null
          risco_id: string
          status: string
          tipo_tratamento: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custo?: number | null
          data_conclusao?: string | null
          data_inicio?: string | null
          descricao: string
          eficacia?: string | null
          id?: string
          prazo?: string | null
          responsavel?: string | null
          risco_id: string
          status?: string
          tipo_tratamento: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custo?: number | null
          data_conclusao?: string | null
          data_inicio?: string | null
          descricao?: string
          eficacia?: string | null
          id?: string
          prazo?: string | null
          responsavel?: string | null
          risco_id?: string
          status?: string
          tipo_tratamento?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "riscos_tratamentos_risco_id_fkey"
            columns: ["risco_id"]
            isOneToOne: false
            referencedRelation: "riscos"
            referencedColumns: ["id"]
          },
        ]
      }
      ropa_dados_vinculados: {
        Row: {
          created_at: string
          dados_pessoais_id: string
          finalidade_especifica: string | null
          id: string
          observacoes: string | null
          ropa_id: string
        }
        Insert: {
          created_at?: string
          dados_pessoais_id: string
          finalidade_especifica?: string | null
          id?: string
          observacoes?: string | null
          ropa_id: string
        }
        Update: {
          created_at?: string
          dados_pessoais_id?: string
          finalidade_especifica?: string | null
          id?: string
          observacoes?: string | null
          ropa_id?: string
        }
        Relationships: []
      }
      ropa_registros: {
        Row: {
          adequacao_destino: string | null
          base_legal: string
          categoria_titulares: string
          compartilhamento_dados: string | null
          controlador_conjunto: string | null
          created_at: string
          created_by: string | null
          data_fim: string | null
          data_inicio: string | null
          empresa_id: string
          encarregado_dados: string | null
          finalidade: string
          id: string
          medidas_seguranca: string | null
          nome_tratamento: string
          observacoes: string | null
          operador_dados: string | null
          origem_dados: string | null
          pais_destino: string | null
          prazo_retencao: string
          responsavel_tratamento: string | null
          status: string
          transferencia_internacional: boolean | null
          updated_at: string
        }
        Insert: {
          adequacao_destino?: string | null
          base_legal: string
          categoria_titulares: string
          compartilhamento_dados?: string | null
          controlador_conjunto?: string | null
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          empresa_id: string
          encarregado_dados?: string | null
          finalidade: string
          id?: string
          medidas_seguranca?: string | null
          nome_tratamento: string
          observacoes?: string | null
          operador_dados?: string | null
          origem_dados?: string | null
          pais_destino?: string | null
          prazo_retencao: string
          responsavel_tratamento?: string | null
          status?: string
          transferencia_internacional?: boolean | null
          updated_at?: string
        }
        Update: {
          adequacao_destino?: string | null
          base_legal?: string
          categoria_titulares?: string
          compartilhamento_dados?: string | null
          controlador_conjunto?: string | null
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          empresa_id?: string
          encarregado_dados?: string | null
          finalidade?: string
          id?: string
          medidas_seguranca?: string | null
          nome_tratamento?: string
          observacoes?: string | null
          operador_dados?: string | null
          origem_dados?: string | null
          pais_destino?: string | null
          prazo_retencao?: string
          responsavel_tratamento?: string | null
          status?: string
          transferencia_internacional?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      sistemas_privilegiados: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          created_at: string | null
          criticidade: string
          empresa_id: string
          icone: string | null
          id: string
          imagem_url: string | null
          nome_sistema: string
          observacoes: string | null
          responsavel_sistema: string | null
          tipo_sistema: string
          updated_at: string | null
          url_sistema: string | null
        }
        Insert: {
          ativo?: boolean | null
          categoria?: string | null
          created_at?: string | null
          criticidade?: string
          empresa_id: string
          icone?: string | null
          id?: string
          imagem_url?: string | null
          nome_sistema: string
          observacoes?: string | null
          responsavel_sistema?: string | null
          tipo_sistema: string
          updated_at?: string | null
          url_sistema?: string | null
        }
        Update: {
          ativo?: boolean | null
          categoria?: string | null
          created_at?: string | null
          criticidade?: string
          empresa_id?: string
          icone?: string | null
          id?: string
          imagem_url?: string | null
          nome_sistema?: string
          observacoes?: string | null
          responsavel_sistema?: string | null
          tipo_sistema?: string
          updated_at?: string | null
          url_sistema?: string | null
        }
        Relationships: []
      }
      sistemas_usuarios: {
        Row: {
          ativo: boolean | null
          cargo: string | null
          created_at: string | null
          created_by: string | null
          data_concessao: string | null
          data_expiracao: string | null
          departamento: string | null
          email_usuario: string | null
          empresa_id: string
          id: string
          justificativa: string | null
          nivel_privilegio: string | null
          nome_usuario: string
          observacoes: string | null
          sistema_id: string
          tipo_acesso: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          cargo?: string | null
          created_at?: string | null
          created_by?: string | null
          data_concessao?: string | null
          data_expiracao?: string | null
          departamento?: string | null
          email_usuario?: string | null
          empresa_id: string
          id?: string
          justificativa?: string | null
          nivel_privilegio?: string | null
          nome_usuario: string
          observacoes?: string | null
          sistema_id: string
          tipo_acesso?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          cargo?: string | null
          created_at?: string | null
          created_by?: string | null
          data_concessao?: string | null
          data_expiracao?: string | null
          departamento?: string | null
          email_usuario?: string | null
          empresa_id?: string
          id?: string
          justificativa?: string | null
          nivel_privilegio?: string | null
          nome_usuario?: string
          observacoes?: string | null
          sistema_id?: string
          tipo_acesso?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sistemas_usuarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sistemas_usuarios_sistema_id_fkey"
            columns: ["sistema_id"]
            isOneToOne: false
            referencedRelation: "sistemas_privilegiados"
            referencedColumns: ["id"]
          },
        ]
      }
      system_modules: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          order_index: number | null
          parent_module_id: string | null
          route_path: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          order_index?: number | null
          parent_module_id?: string | null
          route_path?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          order_index?: number | null
          parent_module_id?: string | null
          route_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_modules_parent_module_id_fkey"
            columns: ["parent_module_id"]
            isOneToOne: false
            referencedRelation: "system_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      temporary_passwords: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          is_temporary: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_temporary?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_temporary?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      trial_reminders_sent: {
        Row: {
          empresa_id: string
          id: string
          milestone: string
          recipient_email: string | null
          sent_at: string
        }
        Insert: {
          empresa_id: string
          id?: string
          milestone: string
          recipient_email?: string | null
          sent_at?: string
        }
        Update: {
          empresa_id?: string
          id?: string
          milestone?: string
          recipient_email?: string | null
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_reminders_sent_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invitation_reminders: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          last_reminder_sent: string | null
          next_reminder_due: string | null
          reminder_count: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          last_reminder_sent?: string | null
          next_reminder_due?: string | null
          reminder_count?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          last_reminder_sent?: string | null
          next_reminder_due?: string | null
          reminder_count?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_module_permissions: {
        Row: {
          can_access: boolean | null
          can_create: boolean | null
          can_delete: boolean | null
          can_read: boolean | null
          can_update: boolean | null
          created_at: string
          granted_at: string | null
          granted_by: string | null
          id: string
          module_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_access?: boolean | null
          can_create?: boolean | null
          can_delete?: boolean | null
          can_read?: boolean | null
          can_update?: boolean | null
          created_at?: string
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          module_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_access?: boolean | null
          can_create?: boolean | null
          can_delete?: boolean | null
          can_read?: boolean | null
          can_update?: boolean | null
          created_at?: string
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          module_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_module_permissions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "system_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      denuncias_configuracoes_public: {
        Row: {
          ativo: boolean | null
          empresa_id: string | null
          id: string | null
          permitir_anonimas: boolean | null
          politica_privacidade: string | null
          requerer_email: boolean | null
          texto_apresentacao: string | null
          token_publico: string | null
        }
        Insert: {
          ativo?: boolean | null
          empresa_id?: string | null
          id?: string | null
          permitir_anonimas?: boolean | null
          politica_privacidade?: string | null
          requerer_email?: boolean | null
          texto_apresentacao?: string | null
          token_publico?: string | null
        }
        Update: {
          ativo?: boolean | null
          empresa_id?: string | null
          id?: string | null
          permitir_anonimas?: boolean | null
          politica_privacidade?: string | null
          requerer_email?: boolean | null
          texto_apresentacao?: string | null
          token_publico?: string | null
        }
        Relationships: []
      }
      denuncias_configuracoes_publicas: {
        Row: {
          ativo: boolean | null
          empresa_id: string | null
          id: string | null
          permitir_anonimas: boolean | null
          politica_privacidade: string | null
          requerer_email: boolean | null
          texto_apresentacao: string | null
        }
        Insert: {
          ativo?: boolean | null
          empresa_id?: string | null
          id?: string | null
          permitir_anonimas?: boolean | null
          politica_privacidade?: string | null
          requerer_email?: boolean | null
          texto_apresentacao?: string | null
        }
        Update: {
          ativo?: boolean | null
          empresa_id?: string | null
          id?: string | null
          permitir_anonimas?: boolean | null
          politica_privacidade?: string | null
          requerer_email?: boolean | null
          texto_apresentacao?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_default_permissions_for_user: {
        Args: { user_id_param: string }
        Returns: undefined
      }
      apply_permission_profile: {
        Args: { _profile_id: string; _user_id: string }
        Returns: undefined
      }
      assessment_pertence_empresa: {
        Args: { assessment_id: string }
        Returns: boolean
      }
      auditoria_item_pertence_empresa: {
        Args: { item_id: string }
        Returns: boolean
      }
      auditoria_pertence_empresa: {
        Args: { auditoria_id: string }
        Returns: boolean
      }
      calculate_due_diligence_score: {
        Args: { assessment_id_param: string }
        Returns: undefined
      }
      can_access_projeto: { Args: { _projeto_id: string }; Returns: boolean }
      can_access_tarefa: { Args: { _tarefa_id: string }; Returns: boolean }
      can_update_assessment_via_token: {
        Args: { assessment_link_token: string }
        Returns: boolean
      }
      check_company_user_limit: { Args: { _empresa_id: string }; Returns: Json }
      check_trial_expiration: { Args: never; Returns: undefined }
      cleanup_expired_mfa_codes: { Args: never; Returns: undefined }
      consume_ai_credit: {
        Args: {
          p_descricao?: string
          p_empresa_id: string
          p_funcionalidade: string
          p_user_id: string
        }
        Returns: boolean
      }
      conta_privilegiada_pertence_empresa: {
        Args: { conta_id: string }
        Returns: boolean
      }
      contrato_pertence_empresa: {
        Args: { contrato_id: string }
        Returns: boolean
      }
      controle_pertence_empresa: {
        Args: { controle_id: string }
        Returns: boolean
      }
      create_audit_log: {
        Args: {
          p_action: string
          p_changed_fields?: string[]
          p_new_values?: Json
          p_old_values?: Json
          p_record_id: string
          p_table_name: string
        }
        Returns: undefined
      }
      dados_pessoais_pertence_empresa: {
        Args: { dados_id: string }
        Returns: boolean
      }
      debug_user_context: { Args: never; Returns: Json }
      denuncia_pertence_empresa: {
        Args: { denuncia_id: string }
        Returns: boolean
      }
      documento_pertence_empresa: {
        Args: { documento_id: string }
        Returns: boolean
      }
      evaluation_pertence_empresa: {
        Args: { evaluation_id: string }
        Returns: boolean
      }
      generate_temp_password: { Args: never; Returns: string }
      gerar_protocolo_denuncia: { Args: never; Returns: string }
      gerar_token_publico: { Args: never; Returns: string }
      gerar_token_revisao: { Args: never; Returns: string }
      get_agent_token: { Args: { _id: string }; Returns: string }
      get_api_key_full: { Args: { _id: string }; Returns: string }
      get_assessment_empresa_info: {
        Args: { p_token: string }
        Returns: {
          assessment_id: string
          data_expiracao: string
          empresa_id: string
          empresa_logo_url: string
          empresa_nome: string
        }[]
      }
      get_denuncia_config_publica: {
        Args: { p_empresa_id: string }
        Returns: {
          empresa_id: string
          permitir_anonimas: boolean
          politica_privacidade: string
          texto_apresentacao: string
        }[]
      }
      get_empresa_by_slug: { Args: { empresa_slug: string }; Returns: string }
      get_profiles_by_text_ids: {
        Args: { text_ids: string[] }
        Returns: {
          foto_url: string
          nome: string
          user_id: string
        }[]
      }
      get_user_empresa_id:
        | { Args: never; Returns: string }
        | { Args: { _user_id: string }; Returns: string }
      get_user_invitation_link: { Args: { _user_id: string }; Returns: string }
      has_admin_role: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_super_admin_role: { Args: never; Returns: boolean }
      incidente_pertence_empresa: {
        Args: { incidente_id: string }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_admin_or_super_admin: { Args: never; Returns: boolean }
      is_projeto_member: {
        Args: { _projeto_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: never; Returns: boolean }
      matriz_pertence_empresa: { Args: { matriz_id: string }; Returns: boolean }
      popular_ativos_demo: {
        Args: { p_empresa_id: string; p_user_id: string }
        Returns: number
      }
      popular_categorias_base: {
        Args: { p_empresa_id: string }
        Returns: undefined
      }
      popular_controles_demo: {
        Args: { p_empresa_id: string; p_user_id: string }
        Returns: number
      }
      popular_dados_demonstracao: { Args: never; Returns: Json }
      popular_dados_demonstracao_direto: {
        Args: { p_empresa_id: string; p_user_id: string }
        Returns: Json
      }
      popular_documentos_demo: {
        Args: { p_empresa_id: string; p_user_id: string }
        Returns: number
      }
      popular_incidentes_demo: {
        Args: { p_empresa_id: string; p_user_id: string }
        Returns: number
      }
      popular_riscos_demo: {
        Args: { p_empresa_id: string; p_user_id: string }
        Returns: number
      }
      projeto_pertence_empresa: {
        Args: { _projeto_id: string }
        Returns: boolean
      }
      requirement_pertence_empresa: {
        Args: { requirement_id: string }
        Returns: boolean
      }
      review_pertence_empresa: {
        Args: { review_id_param: string }
        Returns: boolean
      }
      risco_pertence_empresa: { Args: { risco_id: string }; Returns: boolean }
      ropa_pertence_empresa: { Args: { ropa_id: string }; Returns: boolean }
      validate_denuncia_token: { Args: { p_token: string }; Returns: string }
    }
    Enums: {
      app_role: "user" | "admin" | "super_admin"
      projeto_dependencia_tipo: "FS" | "SS" | "FF" | "SF"
      projeto_membro_papel: "owner" | "admin" | "membro" | "viewer"
      projeto_status: "ativo" | "pausado" | "concluido" | "arquivado"
      projeto_tarefa_prioridade: "baixa" | "media" | "alta" | "critica"
      projeto_vinculo_entidade:
        | "risco"
        | "controle"
        | "incidente"
        | "auditoria"
        | "auditoria_item"
        | "gap_requirement"
        | "gap_assessment"
        | "contrato"
        | "fornecedor"
        | "due_diligence"
        | "documento"
        | "ativo"
        | "denuncia"
        | "plano_acao"
        | "dados_pessoais"
        | "conta_privilegiada"
        | "continuidade"
      user_role: "super_admin" | "admin" | "user" | "readonly"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["user", "admin", "super_admin"],
      projeto_dependencia_tipo: ["FS", "SS", "FF", "SF"],
      projeto_membro_papel: ["owner", "admin", "membro", "viewer"],
      projeto_status: ["ativo", "pausado", "concluido", "arquivado"],
      projeto_tarefa_prioridade: ["baixa", "media", "alta", "critica"],
      projeto_vinculo_entidade: [
        "risco",
        "controle",
        "incidente",
        "auditoria",
        "auditoria_item",
        "gap_requirement",
        "gap_assessment",
        "contrato",
        "fornecedor",
        "due_diligence",
        "documento",
        "ativo",
        "denuncia",
        "plano_acao",
        "dados_pessoais",
        "conta_privilegiada",
        "continuidade",
      ],
      user_role: ["super_admin", "admin", "user", "readonly"],
    },
  },
} as const
