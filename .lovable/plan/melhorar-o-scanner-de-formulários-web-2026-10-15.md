# Melhorar o Scanner de Formulários Web

Escopo: apenas o popup "Scanner de Formulários Web" (Privacidade / Mapeamento de dados). Sem mudança no servidor nem no banco.

## 1. Durante a busca (animações)
- Substituir o cartão simples de "Escaneando página..." por um painel de progresso em etapas, com ícone Akuris pulsando e a URL sendo analisada:
  1. Conectando ao site
  2. Lendo a página (ou descobrindo páginas do domínio)
  3. Identificando formulários
  4. Classificando dados pessoais
- Etapas avançam por tempo estimado (concluídas com check, atual pulsando, futuras apagadas); a barra só chega a 100% quando o resultado real chega — nunca finge ter acabado.
- Prévia "fantasma" dos 4 indicadores e da lista em pulsação suave (sem spinners/skeletons proibidos — usa o mesmo pulso do AkurisPulse).
- Bloco de URL/modo fica compacto e desabilitado durante a busca; botão mostra "Escaneando…".
- Ao terminar: indicadores contam de 0 até o valor e as seções entram em cascata (fade + leve subida). Respeita "reduzir movimento" do sistema.

## 2. Estrutura do resultado
- Cabeçalho do resultado: favicon/título do site, link, data/hora do scan e botão "Escanear novamente".
- Faixa de indicadores no padrão do sistema (StatStrip): Formulários, Campos, Sensíveis, Críticos — com cor só onde há risco (Sensíveis/Críticos > 0).
- Alerta contextual no topo quando houver campos sensíveis/críticos (ex.: "1 campo sensível coletado sem categoria definida — revise antes de importar"), usando a jurisdição da empresa (LGPD/RGPD) em vez de texto fixo.
- Formulários: primeiro já vem aberto; título amigável (corrige "name" virar nome do formulário quando não há nome real → "Formulário 1"), chips de método, nº de campos e nº de sensíveis.
- Campos em lista de cartões compactos em vez de tabela larga: checkbox, nome + placeholder, tipo HTML discreto, tipo de dado, categoria e chip de sensibilidade; ordenados críticos → sensíveis → comuns.
- Filtro rápido por sensibilidade (Todos / Sensíveis / Críticos) e "Selecionar todos" com contador ("3 de 5 selecionados"), checkbox de grupo por formulário.
- Modo domínio: páginas agrupadas com contagem e páginas sem formulário recolhidas em "N páginas sem formulários".
- Estado vazio ilustrado quando nada é encontrado, com dica para tentar "Descobrir todo o domínio".
- Erro exibido dentro do popup (com "Tentar novamente"), não só em toast.

## 3. Rodapé e fluxo
- Rodapé fixo com "Fechar" e botão primário "Importar N campos" (desabilitado com 0), em vez de só "Fechar".
- Enter dispara o scan; URL sem "https://" é normalizada e validada antes de enviar.
- Espaçamentos corrigidos (chips não colados, seções respirando), layout em tela cheia no celular.

## Detalhes técnicos
- Arquivo: `src/components/dados/UrlScannerDialog.tsx`; possivelmente extrair `ScanProgressSteps` e `ScannedFieldRow` em `src/components/dados/url-scanner/`.
- Reusa `DialogShell`, `StatStrip`, `Chip/StatusBadge`, `AkurisPulse`, `EmptyState`, `useJurisdicao`; `logger` no lugar de `console.error`.
- Novas strings em PT-BR/pt-PT/EN em `src/i18n/modules/dados-dialogs.ts` com teste de paridade.
- Teste pequeno para a ordenação por sensibilidade e normalização da URL.
