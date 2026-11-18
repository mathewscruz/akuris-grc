# Relatórios: completar e melhorar a geração

A área tem 13 modelos (executivo, conformidade, riscos, incidentes, privacidade, ISO 27001, continuidade, contratos, ativos, auditoria interna, fornecedores, documentos, denúncias), todos isolados por empresa. Mas há problemas que fazem o relatório parecer completo quando não está.

## 1. Opções que hoje não fazem nada
- **Período** (ex.: últimos 30/90 dias): passa a filtrar de fato os dados do PDF e da pré-visualização.
- **Incluir detalhes**: desligado gera só indicadores; ligado inclui as tabelas.
- **Público** (executivo/técnico): executivo mostra resumo e top 10; técnico, listas completas.

## 2. Relatório "vazio" quando houve erro
Hoje, se uma consulta falha, o PDF sai com zeros como se fosse real. Passa a mostrar erro e "Tentar novamente", sem gerar o arquivo.

## 3. Layout do PDF
- Texto longo nas tabelas deixa de ser cortado: a linha cresce para mostrar tudo.
- Cabeçalho da tabela repete em cada nova página.
- Seções curtas não abrem página nova sozinhas.
- Capa e cabeçalho com nome (e logo, se houver) da empresa cliente; rodapé com página X de Y e data.
- Textos fixos do PDF ("Página", "Gerado em", "Empresa") em PT/EN; acentos corrigidos nos rótulos.
- Resumo visual: barras simples por estado/severidade com a paleta neutra do sistema.

## 4. Privacidade conforme a jurisdição
O relatório de privacidade usa LGPD/ANPD ou RGPD/autoridade conforme a configuração da empresa.

## 5. Novos modelos
- **Planos de ação**: abertos, atrasados, por responsável e origem.
- **Revisão de acessos**: campanhas, decisões, acessos revogados.
- **Projetos**: progresso, atrasos e marcos por projeto.

## 6. Agendamento
Primeiro verificar se os envios agendados chegam de facto. Se não houver envio automático, criar o envio diário que gera o PDF e manda por e-mail aos destinatários, com aviso no sino. Validar e-mails e usar dia da semana (seg–dom) para frequência semanal.

## Detalhes técnicos
- `generateTemplatePDF.ts`: recebe `periodo_dias`, `publico`, `incluir_detalhes`; fetchers lançam erro em `error`; células com altura por `splitTextToSize`; re-desenho do header no page break.
- `pdf-utils.ts`: strings via dicionário PT/EN; capa com `empresa.nome`/logo.
- Privacidade via jurisdição da empresa (mesma regra de `useJurisdicao`).
- Cache de fornecedores com chave por `empresa_id`.
- Agendamento: edge function + cron, reutilizando o gerador e registrando `ultimo_envio`/`proximo_envio`; notificação no sino.
- Testes: período filtra datas; erro de consulta não gera PDF; cálculo do próximo envio semanal/mensal.
