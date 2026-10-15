# Descrições dos requisitos dos frameworks: carregar, guardar e reaproveitar

## O que já verifiquei
- O sistema já foi pensado para guardar a descrição no banco depois da primeira geração e reaproveitá-la nas próximas vezes. Essa geração não desconta créditos de IA do cliente.
- Na prática, quase nada está guardado. De cerca de 1.700 requisitos, só 85 têm descrição em português e 33 em inglês:

| Framework | Requisitos | Com descrição (PT) | Com descrição (EN) |
|---|---|---|---|
| ISO/IEC 27001 | 121 | 34 | 1 |
| SOC 2 | 61 | 5 | 2 |
| LGPD | 54 | 1 | 0 |
| PCI DSS | 247 | 0 | 0 |
| CRA | 30 | 30 | 30 |
| Demais (cerca de 20 frameworks) | ~1.200 | praticamente 0 | 0 |

- Os registros recentes do serviço de geração mostram só que ele é iniciado, sem erro. A causa exata da falha **ainda não está confirmada**.

## O que vou fazer
1. **Descobrir a causa:** chamar a geração para um requisito real e ler a resposta. Suspeitas principais:
   - a chave de IA não está configurada no seu Supabase;
   - o limite de 1 geração a cada 2 minutos por requisito deixa a tela em espera até desistir;
   - a resposta da IA não passa na conferência de qualidade e não é guardada.
2. **Corrigir** a causa encontrada, sem mudar a regra: gera uma vez, guarda no banco e sempre reaproveita.
3. **Preencher o catálogo inteiro de uma vez,** em português e inglês, para todos os frameworks.
   - Assim o cliente já encontra a descrição pronta ao clicar, sem espera.
   - O custo fica na plataforma (crédito da Lovable), nunca no saldo de IA do cliente.
4. **Tela enquanto falta descrição:** em vez do texto básico, mostrar "Preparando orientação…" com o loader do Akuris e preencher sozinho quando ficar pronto. Se falhar, mostrar um botão "Tentar novamente", sem descontar créditos.
5. **Validar:**
   - abrir requisitos da ISO 27001, LGPD e PCI DSS em PT e EN;
   - confirmar que a segunda abertura lê do banco, sem nova geração;
   - confirmar que nenhum crédito de IA da empresa foi consumido.

## Detalhes técnicos
- A função `populate-requirement-guidance` já não chama `consume_ai_credit`. Manter assim e adicionar um teste que garante isso.
- O hook `useOrientacaoRequisito` lê primeiro as colunas `orientacao_implementacao`, `exemplos_evidencias` e `perguntas_diagnostico` (e as versões `_en`) e só chama a função quando falta algo. Manter esse fluxo e ajustar o tempo de espera ou as novas tentativas conforme a causa.
- Preenchimento em lote: o modo por framework (`framework_id` + `batch_size`, só super admin) já existe. Executar em ciclos até `remaining = 0` em cada idioma, guiado pelo script `scripts/aquecer-orientacao.mjs`, com a sua sessão de super admin, porque o acesso de teste não está disponível neste projeto.
- Nenhuma mudança de estrutura no banco. Os dados ficam no catálogo global de requisitos (sem `empresa_id`, partilhado por todas as empresas, como hoje). Respostas e avaliações de cada empresa continuam isoladas.
