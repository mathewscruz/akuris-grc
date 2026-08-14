# Publicar o canal de denúncia: definir o identificador da empresa

## O problema, confirmado

O aviso vermelho está correto, mas leva a um beco sem saída:

- Na base de dados, 5 das 8 empresas têm o identificador público (slug) vazio — entre elas as empresas que estão a usar o canal agora. Sem slug e sem configuração gravada, não existe endereço nenhum para divulgar.
- O botão "Definir identificador da empresa" abre Configurações no separador "Empresas", que só existe para super-administradores.
- Mesmo nesse separador, e também em Configurações > Organização, **não existe nenhum campo para escrever o identificador**. Ou seja: hoje é impossível um administrador publicar o canal pela interface.

## O que vai ser feito

### 1. Campo "Identificador público" em Configurações > Organização
Novo campo visível a administradores, com:
- Sugestão automática a partir do nome da empresa (ex.: "Ilumen Consultoria" → `ilumen-consultoria`).
- Normalização enquanto se escreve (minúsculas, sem acentos, hífens, 3–40 caracteres).
- Verificação de disponibilidade antes de gravar, com mensagem clara se já estiver em uso.
- Pré-visualização do endereço final do canal por baixo do campo.
- Aviso de que alterar o identificador invalida links e QR já divulgados.

### 2. Preenchimento automático dos identificadores em falta
Migração que gera o identificador a partir do nome para as empresas que ainda não o têm (com sufixo numérico em caso de repetição) e garante unicidade no banco (índice único, ignorando maiúsculas). Nada é sobrescrito nas empresas que já têm slug.

### 3. Canal publicável sem passos escondidos
Na aba do canal de denúncia:
- Corrigir o botão do aviso para abrir Configurações > Organização (o separador certo, acessível a administradores).
- Criar a configuração do canal (com token público) na primeira abertura, para que o endereço alternativo por token funcione mesmo antes de o identificador estar definido.
- Deixar de mostrar o cartão de endereço/QR vazio: enquanto não houver endereço, aparece apenas o aviso com o caminho para resolver.

### 4. Idiomas
Todos os textos novos em pt-PT, pt-BR e en, via dicionários i18n — nada escrito diretamente no ecrã.

## Detalhes técnicos

- `src/components/configuracoes/OrganizacaoTab.tsx`: campo `slug` com validação `^[a-z0-9]([a-z0-9-]{1,38})[a-z0-9]$`, verificação de disponibilidade via consulta a `empresas` filtrada por `empresa_id` do perfil e gravação com `.eq('id', empresaId)`. A política de atualização existente já permite ao admin alterar a sua própria empresa.
- Migração: `UPDATE public.empresas SET slug = ...` para linhas com `slug IS NULL`, mais `CREATE UNIQUE INDEX ... ON public.empresas (lower(slug))`.
- `src/components/denuncia/ConfiguracoesDenuncia.tsx`: navegação para `/configuracoes?tab=organizacao`, criação automática da configuração com `gerar_token_publico`, e renderização condicional do bloco endereço/QR.
- Chaves novas em `src/i18n/modules/p3-denuncia.ts` e no módulo de configurações, nos três idiomas.
