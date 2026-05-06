## Avaliação da Opção C — Logos oficiais da internet

Avaliei os 24 frameworks ativos (ISO 9001/14001/27001/27701/31000/37301/20000/62443, NIST CSF, NIST SP 800-82, COBIT, COSO ERM, COSO IC, DORA, NIS2, GDPR, LGPD, CCPA, HIPAA, SOX, PCI DSS, SOC 2, ITIL, CIS Controls).

### Por que C é problemática (honestamente)

1. **Direitos autorais reais**: ISO, NIST, ISACA (COBIT), AICPA (SOC 2), PCI SSC, AXELOS (ITIL), CIS — todos têm marcas registradas com restrições explícitas de uso. A maioria proíbe uso do logo sem licença/parceria. Risco jurídico concreto para uma plataforma comercial de GRC.
2. **Ausência de CDN oficial**: nenhum desses órgãos publica logos em CDN público estável. Só existem em PDFs/sites institucionais com hotlink bloqueado ou URLs que mudam.
3. **Qualidade visual**: logos coloridos e em proporções diferentes quebram a grid editorial Akuris (Navy + Purple). Em dark mode, vários ficariam ilegíveis (logos pretos sobre fundo escuro).
4. **Frameworks sem logo próprio**: LGPD, GDPR, CCPA, SOX, HIPAA, DORA, NIS2 são **leis/regulamentos**, não têm logo oficial — só brasão de governo (que não pode ser usado comercialmente).

### Caminho híbrido recomendado (C parcial + B)

Em vez de descartar C, faço o que é **legal e visualmente coerente**:

**Tier 1 — Logos seguros via Simple Icons / Wikimedia Commons (CC/PD)**
Buscar via `lov-fetch-website` em fontes de domínio público:
- ISO family → símbolo ISO da Wikimedia (uso editorial permitido)
- NIST/NIST SP → seal NIST (US Gov, domínio público)
- PCI DSS → logo PCI SSC (Wikimedia, marca registrada mas uso editorial OK)
- SOC 2 → selo AICPA (uso editorial)
- ITIL, COBIT, CIS → Wikimedia quando disponível em SVG

Salvar localmente em `src/assets/frameworks/` como SVG otimizado (não hotlink). Isso evita quebra de URL e respeita "fair use editorial" para identificação da norma.

**Tier 2 — Badge tipográfico Akuris (Plano B original)**
Para os frameworks que são **leis** (LGPD, GDPR, CCPA, SOX, HIPAA, DORA, NIS2) ou sem logo licenciável: badge tipográfico com paleta semântica:
- Privacidade (LGPD/GDPR/CCPA/HIPAA/ISO 27701) → Purple Akuris
- Segurança (ISO 27001, NIST, PCI, CIS, SOC 2, NIS2, DORA) → Steel Blue
- Qualidade/Gestão (ISO 9001/14001/20000, ITIL, COBIT, COSO, SOX) → Slate
- Risco (ISO 31000, COSO ERM) → Amber sóbrio

### Implementação

1. Criar `src/assets/frameworks/` com SVGs verificados (~10 logos seguros baixados manualmente da Wikimedia/sites oficiais via `lov-fetch-website`).
2. Criar `src/lib/framework-brand.ts` com mapa: `{ slug → { logoSrc?, acronym, tone, fullName } }`.
3. Criar `src/components/frameworks/FrameworkBadge.tsx`:
   - Se `logoSrc` existe → renderiza `<img>` em chip 40x40 com fundo branco sutil (para logos coloridos respirarem no dark)
   - Senão → fallback tipográfico (acrônimo + tom semântico)
   - Variantes: `sm` (24px), `md` (40px), `lg` (64px)
4. Substituir ícones genéricos em:
   - `FrameworksOverviewCard.tsx` (Dashboard)
   - Listagem de frameworks em Gap Analysis
   - Header do diálogo de avaliação
5. Adicionar coluna `logo_url TEXT` em `gap_analysis_frameworks` (opcional, para super-admin sobrescrever no futuro).

### O que NÃO farei

- Não vou hotlinkar logos de sites de terceiros (quebra + risco legal).
- Não vou usar logos de leis/governo como se fossem marca (LGPD não tem logo).
- Não vou inventar logo para framework que não tem identidade visual pública.

### Resultado esperado

~10 frameworks com logo oficial autêntico (ISO, NIST, PCI, SOC 2, ITIL, COBIT, CIS, etc.) + ~14 com badge tipográfico Akuris coerente. Visual consistente, legalmente defensável, sem dependência de URLs externas.

Se preferir o caminho 100% B (só badges tipográficos, zero risco legal), me avise. Caso contrário, sigo com o híbrido acima.