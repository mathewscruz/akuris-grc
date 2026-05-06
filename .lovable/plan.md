## Remover CTA "Criar conta grátis" da tela de login

Apenas o super-admin cria empresas e usuários, então o link público de auto-registro deve sair da tela `/auth`.

### Alterações

1. **`src/pages/Auth.tsx`** — Remover o bloco abaixo (linhas 406-411), eliminando o texto "Não tem uma conta? Criar conta grátis" e o `Link` para `/registro`:
   ```tsx
   <div className="text-center text-xs text-white/45">
     {t('auth.noAccount')} <Link to="/registro">…</Link>
   </div>
   ```
   Se o `import { Link }` ficar sem uso após a remoção, também removê-lo.

2. **Rota `/registro`** — Verificar em `src/App.tsx` se a rota pública de auto-registro ainda existe. Caso exista e seja exclusivamente o fluxo de auto-cadastro de empresa (não o fluxo de convite com token usado pelo super-admin), removê-la para impedir acesso direto via URL. O fluxo de convite seguro (links com token enviados pelo super-admin) deve ser preservado.

3. **i18n** — As chaves `auth.noAccount` e `auth.createFreeAccount` em `src/i18n/pt.ts` e `src/i18n/en.ts` podem permanecer (não impactam) ou serem removidas para limpeza. Sugestão: manter por ora para evitar quebras em outras telas.

### Validação
- Recarregar `/auth` e confirmar que o rodapé do card mostra apenas o copyright Akuris.
- Tentar acessar `/registro` direto pela URL e confirmar comportamento esperado (404 ou redirect para `/auth`).