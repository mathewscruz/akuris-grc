import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import akurisLogo from "@/assets/akuris-logo.png";
import { useLandingReveal, useCountUp, useScrolled } from "@/hooks/useLandingAnimations";
import { DemoRequestDialog } from "@/components/landing/DemoRequestDialog";
import { SEO } from "@/components/SEO";

const modules = [
  {
    idx: "M.01",
    title: "Gestão de Riscos",
    desc: "Identifique, avalie e trate riscos corporativos em um repositório central. Matriz 5×5 configurável, sugestões de tratamento por IA e indicadores de exposição prontos para o conselho.",
    tags: ["ISO 31000", "COSO ERM"],
  },
  {
    idx: "M.02",
    title: "Gap Analysis Multi-Framework",
    desc: "Avaliação de aderência cruzada a +21 frameworks com scoring automático, planos de ação e histórico de evolução do score por requisito.",
    tags: ["LGPD", "ISO 27001", "SOC 2"],
  },
  {
    idx: "M.03",
    title: "Controles & Evidências",
    desc: "Catálogo unificado com mapeamento cruzado entre frameworks. Um controle implementado uma vez atende a vários padrões — sem retrabalho e sem dúvida sobre o que vale.",
    tags: ["Cross-mapping", "Auditoria"],
  },
  {
    idx: "M.04",
    title: "Privacidade & LGPD",
    desc: "RoPA, DPIA, gestão de titulares, base legal e ciclo de incidentes em um só fluxo. Construído com DPOs, para DPOs, incluindo trilhas exigidas pela ANPD.",
    tags: ["LGPD", "GDPR"],
  },
  {
    idx: "M.05",
    title: "Auditoria Interna",
    desc: "Planeje, execute e acompanhe auditorias com papéis de trabalho, achados e planos de ação. Resultados retroalimentam a matriz de risco automaticamente.",
    tags: ["IIA", "Workpapers"],
  },
  {
    idx: "M.06",
    title: "Due Diligence de Terceiros",
    desc: "Onboarding, questionários, evidências e monitoramento contínuo de fornecedores críticos. Riscos de cadeia integrados ao painel principal.",
    tags: ["TPRM", "Fornecedores"],
  },
  {
    idx: "M.07",
    title: "Contas Privilegiadas",
    desc: "Gestão de acessos críticos com revisão periódica, aprovação multinível e trilha de auditoria completa por sistema e por usuário.",
    tags: ["PAM", "Revisão"],
  },
  {
    idx: "M.08",
    title: "Continuidade & Indicadores",
    desc: "Planos de continuidade, testes documentados e painéis executivos prontos para o C-level: exposição agregada, posturas por unidade e tendências históricas.",
    tags: ["BCM", "Board pack"],
  },
];

const frameworks = [
  ["Privacidade", "LGPD"],
  ["Privacidade", "GDPR"],
  ["Privacidade", "CCPA"],
  ["Privacidade", "HIPAA"],
  ["Segurança", "ISO 27001"],
  ["Segurança", "ISO 27701"],
  ["Segurança", "SOC 2 Type II"],
  ["Segurança", "PCI DSS 4.0"],
  ["Segurança", "NIST CSF 2.0"],
  ["Segurança", "CIS Controls v8"],
  ["Qualidade", "ISO 9001"],
  ["Ambiental", "ISO 14001"],
  ["Risco", "ISO 31000"],
  ["Antissuborno", "ISO 37001"],
  ["TI", "ISO/IEC 20000"],
  ["TI", "ITIL v4"],
  ["Governança", "COBIT 2019"],
  ["Risco", "COSO ERM"],
  ["Controles", "COSO IC"],
  ["Financeiro", "SOX"],
  ["Saúde", "RDC ANVISA"],
  ["Setorial", "Bacen 4.893"],
  ["Setorial", "Susep 638"],
  ["+", "e mais"],
];

const LandingPage = () => {
  const navigate = useNavigate();
  const [demoOpen, setDemoOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("lp-html");
    return () => document.documentElement.classList.remove("lp-html");
  }, []);

  useLandingReveal();
  const scrolled = useScrolled(64);
  const score = useCountUp(87, 1200);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="lp-root">
      <SEO
        title="Akuris — Plataforma GRC para Governança, Riscos e Conformidade"
        description="Akuris reúne controles, frameworks, evidências e indicadores em um só lugar. Suporte a +20 frameworks: ISO 27001, LGPD, GDPR, NIST, SOC 2, PCI DSS."
        canonical="/"
      />
      {/* NAV */}
      <header className={`lp-nav ${scrolled ? "scrolled" : ""}`}>
        <div className="lp-container lp-nav-inner">
          <a href="#topo" className="flex items-center gap-3" aria-label="Akuris">
            <img src={akurisLogo} alt="Akuris" className="h-8 w-auto" />
          </a>
          <nav className="lp-nav-links" aria-label="Principal">
            <button onClick={() => scrollTo("produto")}>Produto</button>
            <button onClick={() => scrollTo("modulos")}>Módulos</button>
            <button onClick={() => scrollTo("frameworks")}>Frameworks</button>
            <button onClick={() => scrollTo("seguranca")}>Segurança</button>
            <button onClick={() => scrollTo("contato")}>Contato</button>
          </nav>
          <div className="lp-nav-cta">
            <button className="lp-btn lp-btn-ghost" onClick={() => navigate("/auth")}>
              Acessar plataforma
            </button>
            <button className="lp-btn lp-btn-primary" onClick={() => setDemoOpen(true)}>
              Solicitar demo <span className="arr">→</span>
            </button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="lp-hero" id="produto">
        <div className="lp-container lp-hero-grid">
          <div>
            
            <h1>
              Governança, riscos e&nbsp;compliance em um <em>único lugar.</em>
            </h1>
            <p className="lede">
              O Akuris reúne controles, frameworks, evidências e indicadores em
              uma plataforma só, para que times de compliance e DPOs decidam com
              clareza, não com planilhas.
            </p>
            <div className="lp-hero-cta">
              <button className="lp-btn lp-btn-primary" onClick={() => setDemoOpen(true)}>
                Solicitar demonstração <span className="arr">→</span>
              </button>
              <button className="lp-btn lp-btn-ghost" onClick={() => scrollTo("modulos")}>
                Conhecer a plataforma
              </button>
            </div>

            <div className="lp-hero-meta" role="group" aria-label="Indicadores">
              <div>
                <span className="k">+20</span>
                <span className="l">Frameworks suportados</span>
              </div>
              <div>
                <span className="k">87%</span>
                <span className="l">Aderência média pós-implantação</span>
              </div>
              <div>
                <span className="k">−64%</span>
                <span className="l">Tempo gasto em auditorias</span>
              </div>
            </div>
          </div>

          <div className="lp-hero-vis" aria-hidden="true">
            {/* Posture */}
            <div
              className="lp-card lp-vis-a lp-posture"
              ref={score.ref as React.RefObject<HTMLDivElement>}
              data-reveal
            >
              <div className="lp-card-title">
                <span className="t">Postura · ISO 27001</span>
                <span className="dot" />
              </div>
              <div className="score">
                {score.value}<sup>/100</sup>
              </div>
              <div className="bars">
                {[
                  ["Controles", 92, false],
                  ["Evidências", 78, false],
                  ["Riscos", 84, false],
                  ["Treinamento", 71, true],
                ].map(([lab, v, warn], i) => (
                  <div className="bar" key={lab as string}>
                    <span className="lab">{lab}</span>
                    <span className="track">
                      <span
                        className="fill"
                        style={{
                          width: `${v}%`,
                          background: warn ? "var(--lp-warn)" : "var(--lp-accent)",
                          ["--bar-delay" as string]: `${200 + i * 120}ms`,
                        }}
                      />
                    </span>
                    <span className="v">{v}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Matrix */}
            <div className="lp-card lp-vis-b" data-reveal style={{ ["--lp-reveal-delay" as string]: "120ms" }}>
              <div className="lp-card-title">
                <span className="t">Matriz de risco · 5 × 5</span>
                <span className="dot" />
              </div>
              <div className="lp-matrix">
                {[
                  "", "", "l1", "l1", "l2", "l2", "l3", "warn",
                  "", "l1", "l1", "l2", "l2", "l3", "l3", "warn",
                  "l1", "l1", "l2", "l2", "l2", "l3", "warn", "warn",
                  "l1", "l2", "l2", "l2", "l3", "l3", "warn", "warn",
                ].map((cls, i) => (
                  <div key={i} className={`c ${cls}`} />
                ))}
              </div>
              <div className="lp-matrix-foot">
                <span>24 riscos ativos</span>
                <span>3 críticos</span>
              </div>
            </div>

            {/* Timeline */}
            <div className="lp-card lp-vis-c" data-reveal style={{ ["--lp-reveal-delay" as string]: "240ms" }}>
              <div className="lp-card-title">
                <span className="t">Atividade recente</span>
                <span className="t lp-mono" style={{ color: "var(--lp-text-3)" }}>14:32</span>
              </div>
              <div className="lp-timeline">
                {[
                  ["14:31", "Controle ISO 27001 A.9 atualizado", "ok", "OK"],
                  ["13:48", "Risco identificado: Phishing", "pen", "Pend."],
                  ["13:02", "Documento LGPD aprovado", "ok", "OK"],
                  ["12:14", "Revisão de fornecedores Q2", "rev", "Rev."],
                ].map(([d, t, s, lab]) => (
                  <div className="row" key={d}>
                    <span className="d">{d}</span>
                    <span className="tx">{t}</span>
                    <span className={`s ${s}`}>{lab}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MÓDULOS */}
      <section className="lp-section" id="modulos">
        <div className="lp-container">
          <div className="lp-section-head" data-reveal>
            <span className="lp-eyebrow">Módulos</span>
            <h2>
              Uma plataforma única, <em>oito disciplinas conectadas.</em>
            </h2>
          </div>
          <div className="lp-modules">
            {modules.map((m) => (
              <div className="lp-module" key={m.idx}>
                <span className="idx lp-mono">{m.idx}</span>
                <h3>{m.title}</h3>
                <p className="desc">{m.desc}</p>
                <div className="tags">
                  {m.tags.map((t) => (
                    <span className="lp-tag" key={t}>{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-section-head" data-reveal>
            <span className="lp-eyebrow">Como funciona</span>
            <h2>
              Da implantação ao painel do conselho, <em>em quatro movimentos.</em>
            </h2>
          </div>
          <div className="lp-flow">
            {[
              ["PASSO 01 · DIAGNÓSTICO", "Mapeamos o que já existe", "Workshops com seu time extraem controles, riscos e evidências dos sistemas legados — sem refazer do zero.", true],
              ["PASSO 02 · IMPLANTAÇÃO", "Configuramos os frameworks", "Importamos os padrões aplicáveis e ligamos os controles cruzados. Sem consultoria infinita.", true],
              ["PASSO 03 · OPERAÇÃO", "Time roda a plataforma", "Tarefas, evidências e revisões fluem na ferramenta. Lembretes, SLAs e aprovações garantem que nada cai entre cadeiras.", true],
              ["PASSO 04 · GOVERNANÇA", "Conselho enxerga em tempo real", "Indicadores agregados, posturas por unidade e exposição de risco em um painel pronto para a próxima reunião.", false],
            ].map(([num, h, p, active]) => (
              <div className={`lp-step ${active ? "active" : ""}`} key={num as string}>
                <span className="num">{num}</span>
                <h4>{h}</h4>
                <p>{p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AUTONOMIA EM CONFORMIDADE */}
      <section className="lp-section lp-autonomia">
        <div className="lp-container">
          <div className="lp-section-head" data-reveal>
            <span className="lp-eyebrow">Autonomia em conformidade</span>
          </div>

          <div className="lp-hero-grid lp-autonomia-grid">
            <div data-reveal>
              <h2 className="lp-autonomia-title">
                Pare de <s>esperar a auditoria externa</s> para descobrir{" "}
                <em>onde sua empresa está vulnerável.</em>
              </h2>
              <p className="lede">
                Auditoria externa é fotografia: cara, anual e sempre desatualizada.
                O Akuris é o espelho que sua organização olha todos os dias. Saiba
                seu nível real de conformidade agora, não daqui a oito meses,
                quando a não conformidade já virou multa.
              </p>
            </div>

            <div
              className="lp-card lp-posture lp-posture-xl"
              data-reveal
              style={{ ["--lp-reveal-delay" as string]: "120ms" }}
            >
              <div className="lp-card-title">
                <span className="t">Postura consolidada</span>
                <span className="t lp-live">● Atualizado agora</span>
              </div>
              <div className="score">
                87<sup>/100</sup>
              </div>
              <p className="lp-posture-sub">
                +12 pontos vs. último trimestre, sem auditor externo na sala.
              </p>
              <div className="bars lp-posture-rows">
                {[
                  ["ISO 27001 · Anexo A", 92],
                  ["LGPD · Art. 50 (boas práticas)", 88],
                  ["SOC 2 Type II · Segurança", 81],
                ].map(([lab, v]) => (
                  <div className="lp-bar-row" key={lab as string}>
                    <span className="lab">{lab}</span>
                    <span className="v">
                      {v}% <span className="chk" aria-hidden="true">✓</span>
                    </span>
                  </div>
                ))}
              </div>
              <div className="lp-posture-foot">
                <span>Sem consultor externo</span>
                <span>Sem planilha</span>
                <span>Sem espera</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FRAMEWORKS */}
      <section className="lp-section" id="frameworks">
        <div className="lp-container">
          <div className="lp-section-head" data-reveal>
            <span className="lp-eyebrow">Frameworks &amp; regulações</span>
            <h2>
              Seu mapa, atendido. <em>De LGPD a SOC 2.</em>
            </h2>
          </div>
          <div className="lp-fw-grid">
            {frameworks.map(([fam, nm]) => (
              <div className="lp-fw" key={nm}>
                <span className="fam">{fam}</span>
                <span className="nm">{nm}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MÉTRICAS */}
      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-section-head" data-reveal>
            <span className="lp-eyebrow">Resultado</span>
            <h2>
              Não é dashboard. <em>É decisão informada, em horas — não em semanas.</em>
            </h2>
          </div>
          <div className="lp-metrics">
            {[
              ["−64", "%", "Tempo em auditoria", "Evidências centralizadas e versionadas reduzem o ciclo de auditoria de meses para semanas."],
              ["3,8", "×", "Velocidade de resposta", "Perguntas do board, do regulador ou do cliente respondidas em minutos com dados confiáveis."],
              ["+42", "%", "Aderência média", "Controles cruzados eliminam lacunas que passavam despercebidas entre frameworks."],
              ["12", "sem.", "Implantação típica", "Times médios entram em operação plena em até doze semanas, com acompanhamento dedicado."],
            ].map(([v, sup, l, p]) => (
              <div className="lp-metric" key={l}>
                <div className="v">
                  {v}<sup>{sup}</sup>
                </div>
                <div className="l">{l}</div>
                <p>{p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SEGURANÇA */}
      <section className="lp-section" id="seguranca">
        <div className="lp-container">
          <div className="lp-section-head" data-reveal>
            <span className="lp-eyebrow">O Akuris por dentro</span>
            <h2>
              Construímos a plataforma que <em>nós mesmos auditaríamos.</em>
            </h2>
          </div>
          <div className="lp-sec-grid">
            <div className="lp-sec-card">
              <div className="badge">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1 L14 4 V8 C14 11 11 14 8 15 C5 14 2 11 2 8 V4 Z" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M5.5 8.2 L7.2 9.8 L10.7 6.3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h4>ISO 27001 + SOC 2 alinhados</h4>
              <p>Operamos sob os mesmos padrões que ajudamos nossos clientes a sustentar — políticas, controles e evidências auditáveis.</p>
            </div>
            <div className="lp-sec-card">
              <div className="badge">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="2.5" y="6.5" width="11" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M5 6.5 V4.5 C5 3 6.3 2 8 2 C9.7 2 11 3 11 4.5 V6.5" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              </div>
              <h4>Dados em território nacional</h4>
              <p>Hospedagem em datacenters certificados no Brasil, com criptografia em trânsito e em repouso, e segregação multi-tenant.</p>
            </div>
            <div className="lp-sec-card">
              <div className="badge">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2 L14 5 V11 L8 14 L2 11 V5 Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                  <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              </div>
              <h4>LGPD by design</h4>
              <p>RoPA interno, DPO designado, programa de privacidade ativo. A plataforma que vende compliance, vive compliance.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-section-head" data-reveal>
            <span className="lp-eyebrow">Perguntas frequentes</span>
            <h2>O que perguntam <em>antes da demo.</em></h2>
          </div>
          <div className="lp-faq-list">
            {[
              ["Quanto tempo leva para implantar o Akuris?", "A média entre nossos clientes é de 12 semanas até a operação plena, divididas em diagnóstico, configuração de frameworks e adoção orientada. Times menores operam em até 6 semanas."],
              ["O Akuris substitui meu time de compliance?", "Não. O Akuris substitui as planilhas, e-mails e reuniões que tomam 70% do tempo do time. O que sobra é o que importa: análise crítica e decisão."],
              ["Conseguimos importar nossos controles e riscos atuais?", "Sim. Importamos planilhas, exportações de outros GRCs e bases legadas no kickoff. O modelo de dados reflete sua taxonomia atual, não a nossa."],
              ["E se eu adotar um novo framework no futuro?", "Cada novo padrão entra como camada sobre os controles que você já tem. Os controles cruzados são detectados automaticamente."],
              ["Como funciona o modelo comercial?", "Assinatura anual baseada em usuários ativos e módulos contratados. Sem cobrança por framework, sem cobrança por evidência. Detalhes na conversa."],
              ["Vocês integram com nossas ferramentas?", "Integrações com SSO (Azure AD, Google Workspace), webhooks e exportação via API REST. Conectores adicionais sob demanda."],
            ].map(([q, a], i) => (
              <details className="lp-faq" key={q} open={i === 0}>
                <summary>
                  {q}
                  <span className="plus" aria-hidden="true" />
                </summary>
                <div className="body">{a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BAND */}
      <section className="lp-cta lp-cta-band" id="contato">
        <div className="lp-container">
          <div className="lp-cta-band-grid" data-reveal>
            <div>
              <span className="lp-eyebrow">Vamos conversar</span>
              <h2>
                Mostre a sua matriz de risco. <em>Nós mostramos onde o Akuris encaixa.</em>
              </h2>
            </div>
            <div className="lp-cta-meta">
              <span className="lp-cta-meta-eyebrow">Demonstração · 30 minutos</span>
              <button type="button" className="lp-btn-pill" onClick={() => setDemoOpen(true)}>
                Solicitar demonstração <span className="arr">→</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <DemoRequestDialog open={demoOpen} onOpenChange={setDemoOpen} />


      {/* FOOTER */}
      <footer style={{ background: "var(--lp-ink-0)" }}>
        <div className="lp-container">
          <div className="lp-foot">
            <div className="lp-foot-mark">
              <img src={akurisLogo} alt="Akuris" className="h-8 w-auto" />
              <p>Plataforma brasileira de Governança, Riscos e Compliance para times que precisam responder com clareza, em qualquer framework.</p>
            </div>
            <div>
              <h5>Produto</h5>
              <ul>
                <li><button onClick={() => scrollTo("modulos")}>Módulos</button></li>
                <li><button onClick={() => scrollTo("frameworks")}>Frameworks</button></li>
                <li><button onClick={() => scrollTo("seguranca")}>Segurança</button></li>
              </ul>
            </div>
            <div>
              <h5>Empresa</h5>
              <ul>
                <li><button onClick={() => scrollTo("contato")}>Contato</button></li>
                <li><button onClick={() => navigate("/auth")}>Acessar plataforma</button></li>
                <li><a href="/politica-privacidade">Política de privacidade</a></li>
              </ul>
            </div>
            <div>
              <h5>Contato</h5>
              <ul>
                <li><a href="mailto:contato@akuris.com.br">contato@akuris.com.br</a></li>
                <li><a href="https://akuris.com.br">akuris.com.br</a></li>
              </ul>
            </div>
          </div>
          <div className="lp-foot-bottom">
            <span>© {new Date().getFullYear()} Akuris · Todos os direitos reservados</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
