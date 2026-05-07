
ALTER TABLE public.planos
  ADD COLUMN IF NOT EXISTS preco_setup numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS setup_observacao text,
  ADD COLUMN IF NOT EXISTS publico_alvo text;

UPDATE public.planos
SET nome = 'Akuris Start',
    preco_mensal = 590.00,
    preco_setup = 1500.00,
    setup_observacao = NULL,
    creditos_franquia = 20,
    publico_alvo = 'Pequenas Empresas (50 - 100)',
    descricao = 'Plano inicial para pequenas empresas (50 a 100 colaboradores).',
    is_destaque = false,
    ordem = 1
WHERE codigo = 'compliance_start';

UPDATE public.planos
SET nome = 'Akuris Manager',
    preco_mensal = 1290.00,
    preco_setup = 3500.00,
    setup_observacao = NULL,
    creditos_franquia = 75,
    publico_alvo = 'Médias Empresas (101 - 499)',
    descricao = 'Plano intermediário para médias empresas (101 a 499 colaboradores).',
    is_destaque = true,
    ordem = 2
WHERE codigo = 'grc_manager';

UPDATE public.planos
SET nome = 'Akuris Full',
    preco_mensal = 2990.00,
    preco_setup = 6000.00,
    setup_observacao = 'A partir de R$ 6.000,00',
    creditos_franquia = 200,
    publico_alvo = 'Empresas Maduras / Alta Demanda (500+)',
    descricao = 'Plano enterprise para empresas maduras ou de alta demanda (500+ colaboradores).',
    is_destaque = false,
    ordem = 3
WHERE codigo = 'governaii_enterprise';
