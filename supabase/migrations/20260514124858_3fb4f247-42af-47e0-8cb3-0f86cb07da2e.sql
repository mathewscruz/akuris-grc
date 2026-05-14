INSERT INTO public.blog_posts (slug, titulo, resumo, conteudo_md, autor, tags, framework_slug, seo_title, seo_description, published, published_at) VALUES
('guia-completo-lgpd-2026','Guia Completo da LGPD em 2026: o que sua empresa precisa saber','Visão prática da LGPD: princípios, bases legais, direitos do titular, ROPA, DPO, sanções e checklist de adequação.',
$md$## O que é a LGPD
A Lei Geral de Proteção de Dados (Lei 13.709/2018) regula o tratamento de dados pessoais no Brasil, alinhada ao GDPR europeu.

## Princípios fundamentais
- Finalidade, adequação e necessidade
- Livre acesso e qualidade dos dados
- Transparência, segurança e prevenção
- Não discriminação e responsabilização

## Bases legais (Art. 7º e 11)
Consentimento, cumprimento de obrigação legal, execução de contrato, legítimo interesse, proteção da vida, exercício regular de direitos, entre outras.

## Direitos do titular
Confirmação, acesso, correção, anonimização, portabilidade, eliminação, revogação de consentimento e informação sobre compartilhamento.

## ROPA — Registro de Operações
Inventário obrigatório de tratamentos, com finalidade, base legal, retenção e compartilhamentos.

## DPO (Encarregado)
Ponto focal entre controlador, titulares e ANPD. Obrigatório na maioria dos casos.

## Sanções
Advertência, multa de até 2% do faturamento (limite R$ 50 milhões/infração), bloqueio e eliminação de dados.

## Checklist mínimo de adequação
1. Mapeamento de dados (ROPA)
2. Política de privacidade pública
3. Bases legais documentadas
4. Canal de atendimento ao titular
5. Plano de resposta a incidentes
6. Contratos com operadores
7. Treinamento contínuo

## Como a Akuris ajuda
A plataforma automatiza ROPA, gestão de incidentes, DSAR e evidências para auditoria — tudo em um único hub GRC.$md$,
'Equipe Akuris', ARRAY['LGPD','privacidade','compliance'], 'lgpd',
'Guia Completo da LGPD 2026 — Adequação Prática',
'Princípios, bases legais, ROPA, DPO e checklist de adequação à LGPD em 2026.',
true, now()),

('iso-27001-em-7-passos','ISO 27001 em 7 passos: do escopo ao certificado','Roteiro pragmático para implantar um SGSI ISO/IEC 27001:2022 e chegar à certificação sem retrabalho.',
$md$## Por que ISO 27001
É o padrão global para Sistemas de Gestão de Segurança da Informação (SGSI), exigido cada vez mais por clientes enterprise.

## Os 7 passos

### 1. Definir escopo e contexto
Identifique unidades, processos e ativos. Documente partes interessadas e requisitos.

### 2. Análise de riscos
Inventário de ativos, ameaças e vulnerabilidades. Cálculo de probabilidade × impacto.

### 3. Declaração de Aplicabilidade (SoA)
93 controles do Anexo A (versão 2022). Justifique inclusões e exclusões.

### 4. Planos de tratamento
Mitigar, transferir, aceitar ou evitar. Defina dono, prazo e evidência.

### 5. Políticas e procedimentos
Política de SI, controle de acesso, criptografia, BCP, fornecedores, RH.

### 6. Operação e monitoramento
Indicadores, auditorias internas, análise crítica pela direção.

### 7. Auditoria de certificação
Estágio 1 (documentação) e Estágio 2 (efetividade). Após aprovação, recertificação a cada 3 anos.

## Erros comuns
- SoA genérica sem evidência
- Riscos sem dono nem prazo
- Treinamento apenas no kickoff
- Indicadores que ninguém revisa

## Ferramenta certa
A Akuris cobre ROPA, riscos, controles, evidências e auditorias com IA, encurtando o caminho até o certificado.$md$,
'Equipe Akuris', ARRAY['ISO 27001','SGSI','segurança da informação'], 'iso-27001',
'ISO 27001 em 7 Passos para Certificação',
'Roteiro prático para implantar a ISO 27001:2022 e obter certificação sem retrabalho.',
true, now()),

('soc-2-vs-iso-27001','SOC 2 vs ISO 27001: qual escolher (ou os dois)?','Comparativo objetivo entre SOC 2 Type II e ISO 27001 — escopo, custo, mercado e quando rodar em paralelo.',
$md$## Resumo executivo
- **ISO 27001** — padrão internacional, certificável, foco em SGSI.
- **SOC 2** — relatório de auditoria AICPA (EUA), foco em Trust Services Criteria.

## Comparativo

| Critério | ISO 27001 | SOC 2 Type II |
|---|---|---|
| Origem | ISO/IEC | AICPA |
| Resultado | Certificado | Relatório de auditor |
| Validade | 3 anos | Período observado (6-12 meses) |
| Mercado primário | Europa, Brasil, Ásia | EUA |
| Foco | SGSI completo | Controles operacionais |

## Quando escolher cada um
- Vendendo para Europa/Brasil → ISO 27001
- Vendendo SaaS para EUA → SOC 2
- Enterprise global → ambos, em paralelo (sobreposição de ~70% dos controles)

## Sinergia
A maioria dos controles ISO Anexo A mapeiam para SOC 2 Common Criteria. Reaproveite políticas, evidências e auditorias internas.

## Como a Akuris acelera
Mapeamento cruzado entre frameworks, gap analysis com IA e gestão única de evidências — uma evidência cobre vários controles.$md$,
'Equipe Akuris', ARRAY['SOC 2','ISO 27001','compliance'], 'soc-2',
'SOC 2 vs ISO 27001: Comparativo Definitivo',
'Quando escolher SOC 2, ISO 27001 ou ambos — comparativo de escopo, custo e mercado.',
true, now()),

('como-fazer-gap-analysis','Como fazer um Gap Analysis de compliance que gera ação','Metodologia de gap analysis ponderada, com pesos por requisito e plano de ação priorizado.',
$md$## O que é Gap Analysis
Avaliação estruturada da distância entre o estado atual e os requisitos de um framework (ISO, LGPD, SOC 2, NIST...).

## Metodologia em 5 etapas

### 1. Selecionar framework e escopo
Defina padrão, unidades e processos cobertos.

### 2. Mapear requisitos com peso
Nem todo controle vale o mesmo. Atribua peso por criticidade.

### 3. Avaliar conformidade
Escala objetiva: Conforme, Parcial, Não conforme, N/A.

### 4. Calcular score ponderado
Score = Σ(conformidade × peso) / Σ(peso aplicável). Exclua N/A do denominador.

### 5. Plano de ação priorizado
Maior gap × maior peso = primeira ação. Dono, prazo, evidência esperada.

## Sinais de gap analysis ruim
- Score sem peso (média simples)
- Sem N/A — força conformidade artificial
- Plano de ação genérico ("revisar política")
- Sem reavaliação periódica

## Vantagem com IA
A Akuris analisa evidências contra requisitos e sugere o status automaticamente, reduzindo o tempo de gap analysis em até 70%.$md$,
'Equipe Akuris', ARRAY['gap analysis','compliance','GRC'], NULL,
'Como Fazer Gap Analysis de Compliance que Gera Ação',
'Metodologia ponderada de gap analysis com plano de ação priorizado para frameworks GRC.',
true, now()),

('ropa-registro-tratamento-dados','ROPA: como construir e manter o Registro de Operações de Tratamento','Guia objetivo do ROPA exigido pela LGPD/GDPR — campos obrigatórios, governança e armadilhas.',
$md$## O que é o ROPA
Registro das atividades de tratamento de dados pessoais. Obrigatório pela LGPD (Art. 37) e GDPR (Art. 30).

## Campos obrigatórios
- Identificação do controlador/operador e DPO
- Finalidade do tratamento
- Categorias de dados e titulares
- Base legal
- Compartilhamentos (incluindo internacionais)
- Prazo de retenção
- Medidas de segurança aplicadas

## Como construir

### 1. Inventário de processos
Entreviste áreas: RH, Marketing, Vendas, Financeiro, TI.

### 2. Categorize tratamentos
Um processo = uma ou mais operações (coleta, armazenamento, compartilhamento...).

### 3. Vincule a sistemas e fornecedores
Mapeie o fluxo do dado de ponta a ponta.

### 4. Aprovação e versionamento
DPO valida; mantenha histórico de mudanças.

## Manutenção
- Revisão trimestral
- Gatilho a cada novo sistema/fornecedor
- Gatilho a cada nova finalidade

## Armadilhas
- ROPA em planilha desatualizada
- Sem campo de retenção
- Sem vínculo com base legal
- Sem responsável por processo

## Akuris e ROPA
Inventário vivo, vínculo automático com fornecedores, riscos e incidentes — tudo auditável.$md$,
'Equipe Akuris', ARRAY['LGPD','ROPA','privacidade'], 'lgpd',
'ROPA: Guia Prático do Registro de Tratamento de Dados',
'Como construir e manter o ROPA exigido pela LGPD e GDPR — campos, governança e armadilhas.',
true, now())
ON CONFLICT (slug) DO NOTHING;