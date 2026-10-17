# Configurações: visão geral em cartões (opção B)

## O que muda para o usuário
Ao abrir Configurações, aparece uma **página inicial**, sem cair direto em Usuários:

```text
Configurações                                    [Buscar uma configuração…]
┌──────────────────────────────────────────────────────────────────────────┐
│ ◔ Configuração 4 de 6 concluída  ▓▓▓▓▓▓░░░  │ Pendências                 │
│                                             │ • Logo da empresa [Resolver]│
│                                             │ • Canal de denúncia [Resolver]│
└──────────────────────────────────────────────────────────────────────────┘
CONTA
[Usuários · 12 usuários] [Organização · Logo pendente] [Assinatura · Plano Full]
PLATAFORMA
[Integrações · 2 conectadas] [Canal de denúncia · Ativo] [Trust Center · Publicado]
ADMINISTRAÇÃO AKURIS (só super admin)
[Empresas] [Planos] [Financeiro IA] [Novidades] [Notícias] [Traduções] [Blog] [Solicitações]
```

- **Cartões de cada área:**
  - cada cartão mostra ícone, nome, uma frase do que se faz ali e um selo com o **estado real** da área (por exemplo "12 usuários", "2 conectadas", "Logo pendente" ou "Publicado");
  - um clique abre a área.
- **Progresso e pendências:**
  - o progresso conta só o que dá para medir: usuários convidados além do próprio admin, logo enviado, endereço da empresa definido, ao menos uma integração conectada, canal de denúncia ativo e Trust Center publicado;
  - cada pendência tem um botão "Resolver", que leva direto à área certa.
- **Busca:** filtra os cartões pelo nome, pela descrição e por palavras-chave (por exemplo, "MFA" encontra Usuários e "logo" encontra Organização), ignorando acentos.
- **Dentro de uma área:**
  - o topo mostra "← Configurações / Usuários", com ícone, título e descrição da área;
  - o menu lateral atual continua, mas com os mesmos grupos (Conta, Plataforma, Administração), para trocar de área sem voltar;
  - o conteúdo fica num bloco só, sem cartão dentro de cartão.
- **Quem vê o quê:**
  - usuário comum: só Usuários e Assinatura;
  - administrador: as áreas de Conta e Plataforma;
  - super admin: também o grupo Administração Akuris.
- **Endereços antigos:** os links com `?tab=` continuam abrindo direto a área certa.
- **Celular:** os cartões ficam numa coluna, e a busca fica no topo.

## Detalhes técnicos
- Novo `src/components/configuracoes/ConfiguracoesVisaoGeral.tsx` (cartões, busca e faixa de progresso), mais o catálogo `src/lib/configuracoes/secoes.ts` com id, grupo, ícone, chave i18n de título, descrição e palavras-chave, e papel mínimo de cada seção.
- O hook `useConfiguracoesStatus(empresaId)` usa React Query com chave por empresa e, em todas as consultas, `.eq('empresa_id')`:
  - contagem de `profiles`;
  - `empresas.logo_url` e `slug`;
  - `useConexoesAtivas` (reaproveitado);
  - estado do canal de denúncia e do Trust Center, lidos da mesma fonte que as abas atuais já usam (confirmar na implementação);
  - plano atual.
- A função pura `calcularProgressoConfiguracao(status)` ganha teste: cada item conta só quando foi medido, e um item sem dados não conta como concluído.
- `Configuracoes.tsx`:
  - sem `?tab=`, mostra a visão geral;
  - com `?tab=`, mostra o cabeçalho da seção e o menu agrupado, que é o atual reorganizado pelo catálogo;
  - os cartões e invólucros extras em Planos, Integrações e Assinatura são removidos.
- Selos com `<StatusBadge/>`/`<Chip/>`, ícones de `@/components/icons` e roxo só em ações. Textos novos em PT e EN.
- Validar com typecheck, o teste novo e o teste de chaves de tradução.
