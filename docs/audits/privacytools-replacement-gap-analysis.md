# Substituição da PrivacyTools pelo Akuris

Data da análise: 04/09/2026

## Conclusão executiva

O Akuris já pode substituir a PrivacyTools em clientes que usam principalmente
catálogo de dados, mapeamento e ROPA, avaliações de privacidade, fluxos,
retenção, solicitações de titulares em volume moderado, incidentes e trilha de
auditoria.

A substituição integral ainda depende da cobertura utilizada por cada cliente.
Os principais bloqueadores são gestão de cookies, consentimento transacional,
Data Discovery corporativo, portal avançado do titular, workflow configurável,
BI de privacidade e capacitação.

## Cobertura atual do Akuris

- Catálogo de dados pessoais com hierarquia, sensibilidade, origem e base legal.
- ROPA agrupado em exercícios, dossiê, anexos e importação/exportação Excel.
- Fluxos de dados com origem, destino, transferência e controles.
- RIPD/DPIA, LIA, TIA e Privacy by Design relacionados a riscos e planos.
- Solicitações de titulares com portal público, protocolo, prazos por
  jurisdição, verificação de identidade registrada, responsável, resposta,
  anexos e linha do tempo.
- Detalhamento regulatório de incidentes de privacidade.
- Regras de retenção, legal hold e alertas programados.
- Cadastro de terceiros, consentimentos e portal público básico.
- Scanner de páginas e formulários web com importação para o catálogo.
- Permissões por empresa e trilha de auditoria.

## Lacunas prioritárias

1. **DSAR 2.0:** confirmação por e-mail/OTP, comunicação bidirecional segura,
   arquivos do titular, entrega segura da resposta, templates, roteamento por
   área e indicadores de SLA.
2. **Portal do titular:** identidade visual, domínio próprio, políticas
   publicadas, consentimentos/preferências e área autenticada.
3. **Consentimentos:** API/SDK, formulários incorporáveis, recibos, versionamento
   de finalidade, webhooks, campanhas de renovação e autosserviço de revogação.
4. **Cookies/CMP:** scanner recorrente, categorização, banner, bloqueio prévio,
   centro de preferências, evidências e Google Consent Mode.
5. **Data Discovery corporativo:** conectores para bancos, arquivos, Microsoft
   365 e Google Workspace, classificadores, agendamento e remediação.
6. **Workflow e BI:** gatilhos/condições/ações configuráveis, escalonamento,
   tarefas e painéis executivos específicos de privacidade.
7. **Capacitação:** integração LMS/SCORM ou módulo próprio com trilhas, progresso
   e evidências.

## Estratégia recomendada

1. Criar migrador PrivacyTools -> Akuris preservando vínculos, anexos e
   histórico.
2. Entregar DSAR 2.0, Portal 2.0 e relatórios operacionais.
3. Integrar Privacidade com Documentos, Due Diligence, Planos de Ação e
   Integrações já existentes.
4. Implementar workflow de privacidade e consentimento transacional.
5. Implementar ou integrar uma CMP.
6. Evoluir o scanner atual para Data Discovery corporativo.
7. Adicionar capacitação por integração com LMS antes de desenvolver um LMS
   completo.

## Diretriz de experiência

A página inicial de Privacidade deve ser uma central de trabalho orientada a
pendências e próximas ações, e não apenas um conjunto de abas. As cinco abas
principais e as nove áreas internas da Jornada devem ser progressivamente
consolidadas em: Programa, Inventário e ROPA, Titulares e Consentimentos, e
Riscos/Terceiros/Incidentes.

## Referências públicas da concorrente

- https://www.privacytools.com.br/data-mapping/
- https://www.privacytools.com.br/gestao-de-pedidos-de-titulares/
- https://www.privacytools.com.br/portal-da-privacidade/
- https://www.privacytools.com.br/gestao-de-consentimentos/
- https://www.privacytools.com.br/gestao-de-cookies-e-politicas/
- https://www.privacytools.com.br/data-discovery/
- https://www.privacytools.com.br/workflow/
- https://www.privacytools.com.br/gestao-de-riscos-de-terceiros/
- https://www.privacytools.com.br/capacitacao/

Esta análise compara a implementação atual do Akuris com a documentação pública
da PrivacyTools. Antes de migrar cada cliente, deve-se inventariar os módulos
contratados, integrações, volumes, formatos de exportação e fluxos efetivamente
utilizados no ambiente daquele cliente.
