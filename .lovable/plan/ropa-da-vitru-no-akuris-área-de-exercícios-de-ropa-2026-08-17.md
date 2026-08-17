# ROPA da Vitru no Akuris + área de Exercícios de ROPA

## O que verifiquei

- A planilha `ROPA_Vitru_v1_1-2.xlsx` tem 7 abas de processo (Processo 1 a 7) mais o "Dashboard ROPA" consolidado, no formato Categoria / Campo / Descrição / Valor — exatamente o formato que o importador atual do Akuris já lê.
- Todos os campos da planilha (identificação, finalidade, dados, tratamento, base legal, partilha, segurança, ciclo de vida, risco) já existem como colunas em `ropa_registros`.
- O utilizador `mathews@akuris.com.br` pertence à empresa **VITRU BRASIL EMPREENDS., PARTICS. E COM. S.A**, que hoje tem **0 registos de ROPA**.
- Existe o bucket privado `dados-documentos`, que serve para anexar o Excel e o relatório executivo.
- Não existe hoje nenhuma tabela que represente o "exercício de ROPA" (o trabalho feito: nome, data, responsável, âmbito, anexos). É isso que falta.

## O que será feito

### 1. Nova área "Exercícios de ROPA" no módulo de Privacidade

Uma nova aba dentro de Privacidade onde se regista cada levantamento de ROPA realizado:

- Nome do exercício (ex.: "ROPA Vitru v1.1")
- Versão, data de realização, período de referência
- Responsável pelo exercício e Encarregado (DPO) — escolhidos por seletor de utilizador, nunca texto livre
- Âmbito/unidades analisadas e metodologia
- Estado (em curso, concluído, aprovado)
- Notas e conclusões

Cada exercício mostra os processos (registos ROPA) que lhe pertencem, com contagem, e permite abrir cada processo.

### 2. Anexos do exercício

Dentro do exercício, uma zona de anexos com upload para o bucket privado `dados-documentos`:

- Relatório executivo (PDF/DOCX)
- Planilha original (XLSX)
- Qualquer evidência adicional

Cada anexo guarda tipo, nome, tamanho, quem carregou e data; download e remoção pela própria interface.

### 3. Importação ligada ao exercício

O botão de importar planilha passa a pedir (ou criar) o exercício de destino, e a planilha carregada fica automaticamente guardada como anexo desse exercício. A exportação continua a funcionar como hoje, podendo ser filtrada por exercício.

### 4. Carregar o ROPA da Vitru

Os 7 processos da planilha serão inseridos para a empresa da Vitru, ligados a um exercício "ROPA Vitru v1.1" criado em nome do `mathews@akuris.com.br`, com todos os campos preenchidos a partir da planilha (finalidade, dados tratados, base legal e justificação, partilhas, transferência internacional, medidas de segurança, retenção, descarte, decisão automatizada).

## Detalhes técnicos

- Migração: tabela `ropa_exercicios` (empresa_id, nome, versao, data_realizacao, periodo_inicio/fim, responsavel_id, dpo_id, escopo, metodologia, status, conclusoes, timestamps) e `ropa_exercicio_anexos` (exercicio_id, empresa_id, tipo, nome_arquivo, caminho, mime, tamanho, uploaded_by). Coluna `exercicio_id` em `ropa_registros` (nullable, ON DELETE SET NULL).
- GRANTs para `authenticated`/`service_role` e RLS por `empresa_id = get_user_empresa_id()`, seguindo o padrão dos restantes módulos; políticas de storage em `dados-documentos` com prefixo por `empresa_id`.
- Frontend: `ExerciciosRopaTab.tsx`, `RopaExercicioDialog.tsx` e `RopaExercicioAnexos.tsx` em `src/components/dados/`, seguindo o esqueleto canónico (PageHeader/Tabs/StatStrip/Card + ModuleToolbar), `StatusBadge`, `AkurisPulse`, `DataTable` com clique de linha e `UserSelect` para responsáveis.
- Todo o texto novo em pt-PT, pt-BR e en via `t()`; terminologia de privacidade lida de `useJurisdicao()`.
- Inserção dos dados da Vitru feita por script de dados isolado, apenas para `empresa_id` da Vitru.
