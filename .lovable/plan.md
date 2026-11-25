# Sinal de concluído e borda roxa nos ícones de importação

## O que o usuário vai ver
1. **Ao terminar a importação:** o percentual some e aparece um pequeno sinal de concluído (✓ roxo) sobre o logotipo, por cerca de 2 segundos, com uma animação suave. O texto de ajuda passa a dizer "Importação concluída".
2. **Depois:** o ✓ some e o logotipo fica com uma borda roxa fixa. Ela indica que esse módulo já foi importado ao menos uma vez, inclusive em visitas futuras à página.
3. **Ainda não importado:** continua igual, com o anel roxo girando.
4. **Importando:** continua igual, com o ícone opaco e o percentual.

## Detalhes técnicos
- `src/components/integracoes/ImportarIntegracaoBadge.tsx`:
  - novo estado `justDone`, ligado quando a importação termina (no `useEffect` que hoje detecta `wasActive` → sem execução) e desligado após cerca de 2 s;
  - classe `is-done` enquanto o ✓ aparece;
  - um `<span className="akuris-import-check">` com ícone de check do catálogo `@/components/icons` (traço 1.5).
- A borda roxa usa o estado já existente `importado` (módulo em `settings.imported_modules`), sem nenhum dado novo.
- `src/index.css`:
  - `.is-synced`: tira a opacidade de 0,85 e usa `border: 1.5px solid hsl(var(--primary))`;
  - `.is-done .akuris-import-check`: selo de check sobre o logo, com animação de entrada;
  - com movimento reduzido, a animação é desligada.
- Texto PT/EN `integracaoImport.concluido` em `src/i18n/modules/agente-inventario.ts`.
- Vale para todos os módulos que usam o mesmo ícone: Ativos, Revisão de Acessos e Biblioteca de evidências.
