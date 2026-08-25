import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import akurisLogo from "@/assets/akuris-logo.png";
import { useLandingReveal, useCountUp, useScrolled } from "@/hooks/useLandingAnimations";
import { DemoRequestDialog } from "@/components/landing/DemoRequestDialog";
import { SEO } from "@/components/SEO";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSelector } from "@/components/LanguageSelector";

type Translate = (key: string) => string;

const buildModules = (t: Translate) => [
  { idx: "M.01", title: t("publico.landing.modulos.m1Title"), desc: t("publico.landing.modulos.m1Desc"), tags: ["ISO 31000", "COSO ERM"] },
  { idx: "M.02", title: t("publico.landing.modulos.m2Title"), desc: t("publico.landing.modulos.m2Desc"), tags: ["LGPD", "ISO 27001", "SOC 2"] },
  { idx: "M.03", title: t("publico.landing.modulos.m3Title"), desc: t("publico.landing.modulos.m3Desc"), tags: [t("publico.landing.modulos.tagCrossMapping"), t("publico.landing.modulos.tagAuditoria")] },
  { idx: "M.04", title: t("publico.landing.modulos.m4Title"), desc: t("publico.landing.modulos.m4Desc"), tags: ["LGPD", "GDPR"] },
  { idx: "M.05", title: t("publico.landing.modulos.m5Title"), desc: t("publico.landing.modulos.m5Desc"), tags: ["IIA", "Workpapers"] },
  { idx: "M.06", title: t("publico.landing.modulos.m6Title"), desc: t("publico.landing.modulos.m6Desc"), tags: ["TPRM", t("publico.landing.modulos.tagFornecedores")] },
  { idx: "M.07", title: t("publico.landing.modulos.m7Title"), desc: t("publico.landing.modulos.m7Desc"), tags: ["PAM", t("publico.landing.modulos.tagRevisao")] },
  { idx: "M.08", title: t("publico.landing.modulos.m8Title"), desc: t("publico.landing.modulos.m8Desc"), tags: ["BCM", "Board pack"] },
];

const buildFrameworks = (t: Translate): [string, string][] => {
  const f = (k: string) => t(`publico.landing.frameworks.${k}`);
  return [
    [f("famPrivacidade"), "LGPD"],
    [f("famPrivacidade"), "GDPR"],
    [f("famPrivacidade"), "CCPA"],
    [f("famPrivacidade"), "HIPAA"],
    [f("famSeguranca"), "ISO 27001"],
    [f("famSeguranca"), "ISO 27701"],
    [f("famSeguranca"), "SOC 2 Type II"],
    [f("famSeguranca"), "PCI DSS 4.0"],
    [f("famSeguranca"), "NIST CSF 2.0"],
    [f("famSeguranca"), "CIS Controls v8"],
    [f("famQualidade"), "ISO 9001"],
    [f("famAmbiental"), "ISO 14001"],
    [f("famRisco"), "ISO 31000"],
    [f("famAntissuborno"), "ISO 37001"],
    [f("famTi"), "ISO/IEC 20000"],
    [f("famTi"), "ITIL v4"],
    [f("famGovernanca"), "COBIT 2019"],
    [f("famRisco"), "COSO ERM"],
    [f("famControles"), "COSO IC"],
    [f("famFinanceiro"), "SOX"],
    [f("famSaude"), "RDC ANVISA"],
    [f("famSetorial"), "Bacen 4.893"],
    [f("famSetorial"), "Susep 638"],
    ["+", f("eMais")],
  ];
};

const LandingPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [demoOpen, setDemoOpen] = useState(false);
  /* A navegação some abaixo de 1024px e não tinha substituto — numa página de
     coluna única com âncoras, isso é ficar sem navegação nenhuma. */
  const [menuAberto, setMenuAberto] = useState(false);

  const modules = useMemo(() => buildModules(t), [t]);
  const frameworks = useMemo(() => buildFrameworks(t), [t]);

  useEffect(() => {
    document.documentElement.classList.add("lp-html");
    return () => document.documentElement.classList.remove("lp-html");
  }, []);

  useLandingReveal();
  const scrolled = useScrolled(64);
  const score = useCountUp(87, 1200);

  const scrollTo = (id: string) => {
    /* Fecha a gaveta antes de rolar: deixá-la aberta esconderia justamente o
       sítio para onde a pessoa acabou de pedir para ir. */
    setMenuAberto(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /** As secções da página, num sítio só — barra e gaveta dizem o mesmo. */
  const SECOES = [
    { id: "produto", rotulo: t("publico.landing.nav.produto") },
    { id: "modulos", rotulo: t("publico.landing.nav.modulos") },
    { id: "frameworks", rotulo: t("publico.landing.nav.frameworks") },
    { id: "seguranca", rotulo: t("publico.landing.nav.seguranca") },
    { id: "contato", rotulo: t("publico.landing.nav.contato") },
  ];

  return (
    <div className="lp-root">
      <SEO
        title={t("publico.landing.seoTitle")}
        description={t("publico.landing.seoDesc")}
        canonical="/"
      />
      {/* NAV */}
      <header className={`lp-nav ${scrolled ? "scrolled" : ""}`}>
        <div className="lp-container lp-nav-inner">
          <a href="#topo" className="lp-nav-brand" aria-label="Akuris">
            <img src={akurisLogo} alt="Akuris" />
          </a>
          <nav className="lp-nav-links" aria-label={t("publico.landing.nav.principal")}>
            {SECOES.map((s) => (
              <button key={s.id} onClick={() => scrollTo(s.id)}>
                {s.rotulo}
              </button>
            ))}
          </nav>
          <div className="lp-nav-cta">
            <span className="lp-nav-lang">
              <LanguageSelector variant="dark" />
            </span>
            <button className="lp-btn lp-btn-ghost" onClick={() => navigate("/auth")}>
              {t("publico.landing.nav.acessar")}
            </button>
            <button className="lp-btn lp-btn-primary" onClick={() => setDemoOpen(true)}>
              {t("publico.landing.nav.demo")} <span className="arr">→</span>
            </button>
            <button
              type="button"
              className="lp-nav-toggle"
              aria-expanded={menuAberto}
              aria-controls="lp-menu"
              aria-label={t("publico.landing.nav.menu")}
              onClick={() => setMenuAberto((a) => !a)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>

        <div id="lp-menu" className={menuAberto ? "lp-nav-drawer aberto" : "lp-nav-drawer"}>
          <div className="lp-container">
            <nav aria-label={t("publico.landing.nav.principal")}>
              {SECOES.map((s) => (
                <button key={s.id} onClick={() => scrollTo(s.id)}>
                  {s.rotulo}
                </button>
              ))}
            </nav>
            <button
              className="lp-btn lp-btn-ghost"
              onClick={() => {
                setMenuAberto(false);
                navigate("/auth");
              }}
            >
              {t("publico.landing.nav.acessar")}
            </button>
            {/* O idioma sai da barra e vem para cá: é escolha rara, e na barra
                estava a disputar espaço com o botão que traz a demonstração. */}
            <div className="lp-nav-drawer-lang">
              <LanguageSelector variant="dark" />
            </div>
          </div>
        </div>
      </header>

      <main>
      {/* HERO */}
      <section className="lp-hero" id="produto">
        <div className="lp-container lp-hero-grid">
          <div>
            <h1>
              {t("publico.landing.hero.titulo")} <em>{t("publico.landing.hero.tituloEm")}</em>
            </h1>
            <p className="lede">{t("publico.landing.hero.lede")}</p>
            <div className="lp-hero-cta">
              <button className="lp-btn lp-btn-primary" onClick={() => setDemoOpen(true)}>
                {t("publico.landing.hero.ctaDemo")} <span className="arr">→</span>
              </button>
              <button className="lp-btn lp-btn-ghost" onClick={() => scrollTo("modulos")}>
                {t("publico.landing.hero.ctaConhecer")}
              </button>
            </div>

            <div className="lp-hero-meta" role="group" aria-label={t("publico.landing.hero.indicadores")}>
              <div>
                <span className="k">+20</span>
                <span className="l">{t("publico.landing.hero.kpiFrameworks")}</span>
              </div>
              <div>
                <span className="k">87%</span>
                <span className="l">{t("publico.landing.hero.kpiAderencia")}</span>
              </div>
              <div>
                <span className="k">−64%</span>
                <span className="l">{t("publico.landing.hero.kpiTempo")}</span>
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
                <span className="t">{t("publico.landing.hero.posturaIso")}</span>
                <span className="dot" />
              </div>
              <div className="score">
                {score.value}<sup>/100</sup>
              </div>
              <div className="bars">
                {([
                  [t("publico.landing.hero.barControles"), 92, false],
                  [t("publico.landing.hero.barEvidencias"), 78, false],
                  [t("publico.landing.hero.barRiscos"), 84, false],
                  [t("publico.landing.hero.barTreinamento"), 71, true],
                ] as [string, number, boolean][]).map(([lab, v, warn], i) => (
                  <div className="bar" key={lab}>
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
                <span className="t">{t("publico.landing.hero.matriz")}</span>
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
                <span>{t("publico.landing.hero.matrizAtivos")}</span>
                <span>{t("publico.landing.hero.matrizCriticos")}</span>
              </div>
            </div>

            {/* Timeline */}
            <div className="lp-card lp-vis-c" data-reveal style={{ ["--lp-reveal-delay" as string]: "240ms" }}>
              <div className="lp-card-title">
                <span className="t">{t("publico.landing.hero.atividade")}</span>
                <span className="t lp-mono" style={{ color: "var(--lp-text-3)" }}>14:32</span>
              </div>
              <div className="lp-timeline">
                {([
                  ["14:31", t("publico.landing.hero.ev1"), "ok", t("publico.landing.hero.evOk")],
                  ["13:48", t("publico.landing.hero.ev2"), "pen", t("publico.landing.hero.evPend")],
                  ["13:02", t("publico.landing.hero.ev3"), "ok", t("publico.landing.hero.evOk")],
                  ["12:14", t("publico.landing.hero.ev4"), "rev", t("publico.landing.hero.evRev")],
                ] as [string, string, string, string][]).map(([d, txt, s, lab]) => (
                  <div className="row" key={d}>
                    <span className="d">{d}</span>
                    <span className="tx">{txt}</span>
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
            <span className="lp-eyebrow">{t("publico.landing.modulos.eyebrow")}</span>
            <h2>
              {t("publico.landing.modulos.titulo")} <em>{t("publico.landing.modulos.tituloEm")}</em>
            </h2>
          </div>
          <div className="lp-modules">
            {modules.map((m) => (
              <div className="lp-module" key={m.idx}>
                <span className="idx lp-mono">{m.idx}</span>
                <h3>{m.title}</h3>
                <p className="desc">{m.desc}</p>
                <div className="tags">
                  {m.tags.map((tag) => (
                    <span className="lp-tag" key={tag}>{tag}</span>
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
            <span className="lp-eyebrow">{t("publico.landing.comoFunciona.eyebrow")}</span>
            <h2>
              {t("publico.landing.comoFunciona.titulo")} <em>{t("publico.landing.comoFunciona.tituloEm")}</em>
            </h2>
          </div>
          <div className="lp-flow">
            {([
              [t("publico.landing.comoFunciona.p1Num"), t("publico.landing.comoFunciona.p1Title"), t("publico.landing.comoFunciona.p1Desc"), true],
              [t("publico.landing.comoFunciona.p2Num"), t("publico.landing.comoFunciona.p2Title"), t("publico.landing.comoFunciona.p2Desc"), true],
              [t("publico.landing.comoFunciona.p3Num"), t("publico.landing.comoFunciona.p3Title"), t("publico.landing.comoFunciona.p3Desc"), true],
              [t("publico.landing.comoFunciona.p4Num"), t("publico.landing.comoFunciona.p4Title"), t("publico.landing.comoFunciona.p4Desc"), false],
            ] as [string, string, string, boolean][]).map(([num, h, p, active]) => (
              <div className={`lp-step ${active ? "active" : ""}`} key={num}>
                <span className="num">{num}</span>
                <h4>{h}</h4>
                <p>{p}</p>
              </div>
            ))}
          </div>
          {/*
            Estes quatro números (−64%, 3,8×, +42%, 12 semanas) estavam sob o
            rótulo «Resultado», sem fonte, metodologia nem amostra. Num produto
            de compliance vendido a compliance officers, uma alegação
            quantitativa sem substanciação é risco de publicidade enganosa --
            e contradiz o que o próprio produto ensina.

            Enquanto não houver dados de clientes para os sustentar, ficam
            identificados como cenário ilustrativo. Substituir por números
            medidos é uma melhoria; deixá-los a passar por medidos, não.
          */}
          <p className="lp-metrics-nota">{t("publico.landing.metricas.nota")}</p>
        </div>
      </section>

      {/* AUTONOMIA EM CONFORMIDADE */}
      <section className="lp-section lp-autonomia">
        <div className="lp-container">
          <div className="lp-section-head" data-reveal>
            <span className="lp-eyebrow">{t("publico.landing.autonomia.eyebrow")}</span>
          </div>

          <div className="lp-hero-grid lp-autonomia-grid">
            <div data-reveal>
              <h2 className="lp-autonomia-title">
                {t("publico.landing.autonomia.tituloPre")}{" "}
                <s>{t("publico.landing.autonomia.tituloRisco")}</s>{" "}
                {t("publico.landing.autonomia.tituloMid")}{" "}
                <em>{t("publico.landing.autonomia.tituloEm")}</em>
              </h2>
              <p className="lede">{t("publico.landing.autonomia.lede")}</p>
            </div>

            {/*
              Ilustração, não leitura ao vivo.

              Este cartão mostra um índice de 87/100 e barras de 92/88/81 --
              todos literais no código -- e trazia por cima o selo «● Atualizado
              agora». Um dado estático a afirmar que acabou de ser medido. Era
              também o único mockup da página sem `aria-hidden`: um leitor de
              ecrã anunciava-o como conteúdo real.

              Agora diz o que é, e sai da árvore de acessibilidade como os
              outros mockups (hero, matriz de risco, feed).
            */}
            <div
              className="lp-card lp-posture lp-posture-xl"
              data-reveal
              aria-hidden="true"
              style={{ ["--lp-reveal-delay" as string]: "120ms" }}
            >
              <div className="lp-card-title">
                <span className="t">{t("publico.landing.autonomia.posturaTitulo")}</span>
                <span className="t">{t("publico.landing.autonomia.exemplo")}</span>
              </div>
              <div className="score">
                87<sup>/100</sup>
              </div>
              <p className="lp-posture-sub">{t("publico.landing.autonomia.sub")}</p>
              <div className="bars lp-posture-rows">
                {([
                  [t("publico.landing.autonomia.rowIso"), 92],
                  [t("publico.landing.autonomia.rowLgpd"), 88],
                  [t("publico.landing.autonomia.rowSoc"), 81],
                ] as [string, number][]).map(([lab, v]) => (
                  <div className="lp-bar-row" key={lab}>
                    <span className="lab">{lab}</span>
                    <span className="v">
                      {v}% <span className="chk" aria-hidden="true">✓</span>
                    </span>
                  </div>
                ))}
              </div>
              <div className="lp-posture-foot">
                <span>{t("publico.landing.autonomia.footConsultor")}</span>
                <span>{t("publico.landing.autonomia.footPlanilha")}</span>
                <span>{t("publico.landing.autonomia.footEspera")}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FRAMEWORKS */}
      <section className="lp-section" id="frameworks">
        <div className="lp-container">
          <div className="lp-section-head" data-reveal>
            <span className="lp-eyebrow">{t("publico.landing.frameworks.eyebrow")}</span>
            <h2>
              {t("publico.landing.frameworks.titulo")} <em>{t("publico.landing.frameworks.tituloEm")}</em>
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
            <span className="lp-eyebrow">{t("publico.landing.metricas.eyebrow")}</span>
            <h2>
              {t("publico.landing.metricas.titulo")} <em>{t("publico.landing.metricas.tituloEm")}</em>
            </h2>
          </div>
          <div className="lp-metrics">
            {([
              ["−64", "%", t("publico.landing.metricas.m1Label"), t("publico.landing.metricas.m1Desc")],
              ["3,8", "×", t("publico.landing.metricas.m2Label"), t("publico.landing.metricas.m2Desc")],
              ["+42", "%", t("publico.landing.metricas.m3Label"), t("publico.landing.metricas.m3Desc")],
              ["12", t("publico.landing.metricas.m4Sup"), t("publico.landing.metricas.m4Label"), t("publico.landing.metricas.m4Desc")],
            ] as [string, string, string, string][]).map(([v, sup, l, p]) => (
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
            <span className="lp-eyebrow">{t("publico.landing.seguranca.eyebrow")}</span>
            <h2>
              {t("publico.landing.seguranca.titulo")} <em>{t("publico.landing.seguranca.tituloEm")}</em>
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
              <h4>{t("publico.landing.seguranca.c1Title")}</h4>
              <p>{t("publico.landing.seguranca.c1Desc")}</p>
            </div>
            <div className="lp-sec-card">
              <div className="badge">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="2.5" y="6.5" width="11" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M5 6.5 V4.5 C5 3 6.3 2 8 2 C9.7 2 11 3 11 4.5 V6.5" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              </div>
              <h4>{t("publico.landing.seguranca.c2Title")}</h4>
              <p>{t("publico.landing.seguranca.c2Desc")}</p>
            </div>
            <div className="lp-sec-card">
              <div className="badge">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2 L14 5 V11 L8 14 L2 11 V5 Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                  <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              </div>
              <h4>{t("publico.landing.seguranca.c3Title")}</h4>
              <p>{t("publico.landing.seguranca.c3Desc")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-section-head" data-reveal>
            <span className="lp-eyebrow">{t("publico.landing.faq.eyebrow")}</span>
            <h2>{t("publico.landing.faq.titulo")} <em>{t("publico.landing.faq.tituloEm")}</em></h2>
          </div>
          <div className="lp-faq-list">
            {([
              [t("publico.landing.faq.q1"), t("publico.landing.faq.a1")],
              [t("publico.landing.faq.q2"), t("publico.landing.faq.a2")],
              [t("publico.landing.faq.q3"), t("publico.landing.faq.a3")],
              [t("publico.landing.faq.q4"), t("publico.landing.faq.a4")],
              [t("publico.landing.faq.q5"), t("publico.landing.faq.a5")],
              [t("publico.landing.faq.q6"), t("publico.landing.faq.a6")],
            ] as [string, string][]).map(([q, a], i) => (
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
              <span className="lp-eyebrow">{t("publico.landing.cta.eyebrow")}</span>
              <h2>
                {t("publico.landing.cta.titulo")} <em>{t("publico.landing.cta.tituloEm")}</em>
              </h2>
            </div>
            <div className="lp-cta-meta">
              <span className="lp-cta-meta-eyebrow">{t("publico.landing.cta.meta")}</span>
              <button type="button" className="lp-btn-pill" onClick={() => setDemoOpen(true)}>
                {t("publico.landing.cta.botao")} <span className="arr">→</span>
              </button>
            </div>
          </div>
        </div>
      </section>
      </main>

      <DemoRequestDialog open={demoOpen} onOpenChange={setDemoOpen} />

      {/* FOOTER */}
      <footer style={{ background: "var(--lp-ink-0)" }}>
        <div className="lp-container">
          <div className="lp-foot">
            <div className="lp-foot-mark">
              <img src={akurisLogo} alt="Akuris" className="h-8 w-auto" />
              <p>{t("publico.landing.footer.tagline")}</p>
            </div>
            <div>
              <h5>{t("publico.landing.footer.produto")}</h5>
              <ul>
                <li><button onClick={() => scrollTo("modulos")}>{t("publico.landing.nav.modulos")}</button></li>
                <li><button onClick={() => scrollTo("frameworks")}>{t("publico.landing.nav.frameworks")}</button></li>
                <li><button onClick={() => scrollTo("seguranca")}>{t("publico.landing.nav.seguranca")}</button></li>
              </ul>
            </div>
            <div>
              <h5>{t("publico.landing.footer.empresa")}</h5>
              <ul>
                <li><button onClick={() => scrollTo("contato")}>{t("publico.landing.nav.contato")}</button></li>
                <li><button onClick={() => navigate("/auth")}>{t("publico.landing.nav.acessar")}</button></li>
                <li><a href="/politica-privacidade">{t("publico.landing.footer.politica")}</a></li>
              </ul>
            </div>
            <div>
              <h5>{t("publico.landing.footer.contato")}</h5>
              <ul>
                <li><a href="mailto:contato@akuris.com.br">contato@akuris.com.br</a></li>
                <li><a href="https://akuris.com.br">akuris.com.br</a></li>
              </ul>
            </div>
          </div>
          <div className="lp-foot-bottom">
            <span>© {new Date().getFullYear()} Akuris · {t("publico.landing.footer.direitos")}</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
