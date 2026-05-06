import { useState, useEffect } from "react";
import { DashboardMockup } from "@/components/landing/DashboardMockup";
import akurisLogo from "@/assets/akuris-logo.png";
import flagBrazil from "@/assets/flag-brazil.png";
import flagPortugal from "@/assets/flag-portugal.png";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Shield,
  FileCheck,
  Users,
  Lock,
  FileText,
  AlertTriangle,
  Database,
  ArrowRight,
  Menu,
  X,
  CheckCircle2,
  Target,
  Settings,
  BarChart3,
  BookOpen,
} from "lucide-react";

const LandingPage = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    message: "",
  });
  const [honeypot, setHoneypot] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<number | null>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("lp-visible");
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll(".lp-fade-up").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (honeypot) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("send-contact-email", {
        body: formData,
      });
      if (error) throw error;
      toast.success("Mensagem enviada. Nosso time retorna em até 1 dia útil.");
      setFormData({ name: "", email: "", company: "", phone: "", message: "" });
    } catch {
      toast.error("Não foi possível enviar agora. Tente novamente em instantes.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const modules = [
    {
      icon: AlertTriangle,
      title: "Gestão de Riscos",
      description: "Matriz de calor, sugestões de tratamento por IA, workflow de aprovação e monitoramento contínuo.",
      details: "Com o módulo de Gestão de Riscos você pode:\n\n• Criar matriz de calor personalizada\n• Receber sugestões de tratamento via IA\n• Configurar workflows de aprovação multinível\n• Monitorar riscos em tempo real\n• Gerar relatórios executivos\n• Vincular riscos a controles e frameworks",
    },
    {
      icon: Shield,
      title: "Gap Analysis",
      description: "Avalie aderência a 21 frameworks (ISO 27001, LGPD, NIST CSF 2.0, SOC 2, PCI DSS) com scoring automático.",
      details: "Com o módulo de Gap Analysis você pode:\n\n• Avaliar aderência a +20 frameworks globais\n• Dashboards interativos com gráficos radar\n• Planos de ação com prazos e responsáveis\n• Histórico de evolução de score\n• Exportação de relatórios PDF executivos",
    },
    {
      icon: FileCheck,
      title: "Controles Internos",
      description: "Auditorias, evidências, testes de efetividade e trilha completa com responsáveis e prazos.",
      details: "Com o módulo de Controles Internos você pode:\n\n• Categorizar controles por área e criticidade\n• Atribuir responsáveis e backups\n• Definir frequência de avaliação\n• Vincular controles a auditorias e riscos\n• Acompanhar testes de efetividade\n• Anexar evidências e documentação",
    },
    {
      icon: Users,
      title: "Contas Privilegiadas",
      description: "Gestão de acessos críticos com revisão periódica, aprovação multinível e auditoria completa.",
      details: "Com o módulo de Contas Privilegiadas você pode:\n\n• Gerenciar acessos privilegiados por sistema\n• Workflows de aprovação multinível\n• Revisões periódicas de acesso\n• Alertas de expiração\n• Trilha de auditoria completa\n• Integração com revisão de acessos",
    },
    {
      icon: Database,
      title: "Proteção de Dados",
      description: "Inventário ROPA, mapeamento de tratamento e portal de atendimento a titulares (LGPD/GDPR).",
      details: "Com o módulo de Proteção de Dados você pode:\n\n• Mapear dados pessoais por processo\n• Gerar ROPA automatizado\n• Visualizar fluxos de dados entre sistemas\n• Gerenciar solicitações de titulares\n• Controlar bases legais e finalidades\n• Conformidade LGPD e GDPR integrada",
    },
    {
      icon: FileText,
      title: "Documentos",
      description: "Repositório centralizado com versionamento, aprovação, controle de validade e geração por IA.",
      details: "Com o módulo de Documentos você pode:\n\n• Controle completo de versões\n• Workflow de aprovação configurável\n• Alertas de renovação automáticos\n• Gerador de Documentos com IA\n• Validação de evidências por IA\n• Categorização e busca avançada",
    },
    {
      icon: Lock,
      title: "Canal de Denúncia",
      description: "Formulário externo anônimo, gestão do ciclo, categorização e comunicação segura com denunciantes.",
      details: "Com o Canal de Denúncia você pode:\n\n• Formulário externo anônimo\n• Gestão completa do ciclo de vida\n• Categorização por tipo e gravidade\n• Comunicação segura com denunciantes\n• Relatórios de acompanhamento\n• Conformidade com legislação anticorrupção",
    },
    {
      icon: Target,
      title: "Due Diligence",
      description: "Avaliação de fornecedores com questionários, scoring de risco e integração com contratos.",
      details: "Com o módulo de Due Diligence você pode:\n\n• Avaliar fornecedores com questionários personalizados\n• Score de risco automático\n• Templates reutilizáveis\n• Integração com contratos\n• Relatórios de avaliação\n• Monitoramento contínuo de terceiros",
    },
  ];

  const frameworks = [
    "ISO 27001", "LGPD", "GDPR", "NIST CSF 2.0", "SOC 2",
    "PCI DSS 4.0", "ISO 27701", "COBIT 2019", "CIS Controls v8", "ISO 31000",
  ];

  const howItWorks = [
    {
      step: "01",
      icon: Settings,
      title: "Configure seus frameworks",
      description: "Selecione as regulamentações relevantes ao seu negócio. LGPD, ISO 27001, SOC 2, NIST e mais 17 frameworks prontos para uso.",
    },
    {
      step: "02",
      icon: BarChart3,
      title: "Avalie sua conformidade",
      description: "Responda aos requisitos com guidance estruturada, anexe evidências e acompanhe seu score de aderência em tempo real.",
    },
    {
      step: "03",
      icon: Target,
      title: "Gerencie e evolua",
      description: "Crie planos de ação, atribua responsáveis e monitore a evolução da maturidade da sua governança ao longo do tempo.",
    },
  ];

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) element.scrollIntoView({ behavior: "smooth" });
    setIsMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#0A1628] text-white overflow-x-hidden">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:bg-[#7552FF] focus:text-white focus:px-4 focus:py-2 focus:rounded-md">
        Pular para o conteúdo principal
      </a>

      {/* HEADER */}
      <header
        role="banner"
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-[#0A1628]/80 backdrop-blur-md border-b border-white/[0.06] py-3"
            : "bg-transparent py-4"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <img
              src={akurisLogo}
              alt="Akuris — Plataforma de Governança, Riscos e Conformidade"
              className="h-10 sm:h-11 w-auto"
              loading="eager"
            />

            <nav className="hidden md:flex items-center gap-8" role="navigation" aria-label="Navegação principal">
              <button onClick={() => scrollToSection("modulos")} className="text-sm text-white/65 hover:text-white transition-colors">Módulos</button>
              <button onClick={() => scrollToSection("como-funciona")} className="text-sm text-white/65 hover:text-white transition-colors">Como funciona</button>
              <button onClick={() => scrollToSection("contato")} className="text-sm text-white/65 hover:text-white transition-colors">Contato</button>
              <Link to="/auth">
                <button className="h-9 px-4 rounded-md text-sm font-medium border border-white/[0.12] bg-white/[0.02] text-white/85 hover:bg-white/[0.06] hover:border-white/20 transition-all">
                  Acessar plataforma
                </button>
              </Link>
            </nav>

            <button
              className="md:hidden text-white p-2"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-expanded={isMenuOpen}
              aria-label={isMenuOpen ? "Fechar menu" : "Abrir menu"}
            >
              {isMenuOpen ? <X className="h-6 w-6" strokeWidth={1.5} /> : <Menu className="h-6 w-6" strokeWidth={1.5} />}
            </button>
          </div>

          {isMenuOpen && (
            <nav className="md:hidden mt-4 pb-4 border-t border-white/[0.08] pt-4 space-y-3">
              <button onClick={() => scrollToSection("modulos")} className="block w-full text-left text-white/70 hover:text-white py-2">Módulos</button>
              <button onClick={() => scrollToSection("como-funciona")} className="block w-full text-left text-white/70 hover:text-white py-2">Como funciona</button>
              <button onClick={() => scrollToSection("contato")} className="block w-full text-left text-white/70 hover:text-white py-2">Contato</button>
              <Link to="/auth" className="block">
                <button className="w-full h-10 px-4 rounded-md text-sm font-medium border border-white/[0.12] bg-white/[0.02] text-white/85 hover:bg-white/[0.06] transition-all">
                  Acessar plataforma
                </button>
              </Link>
            </nav>
          )}
        </div>
      </header>

      <main id="main-content" role="main">

        {/* HERO */}
        <section
          className="relative min-h-[90vh] flex items-center pt-28 pb-16"
          aria-labelledby="hero-title"
          style={{
            backgroundImage: `radial-gradient(ellipse 70% 55% at 50% 30%, rgba(117,82,255,0.10) 0%, transparent 65%)`,
          }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-16 items-center">
              <div className="text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] mb-6 lp-fade-up lp-visible">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#7552FF]" />
                  <span className="text-[11px] uppercase tracking-[0.14em] text-white/65 font-medium">
                    GRC Platform · ISO 27001 · LGPD · SOC 2
                  </span>
                </div>

                <h1 id="hero-title" className="text-4xl sm:text-5xl lg:text-[3.25rem] xl:text-[3.75rem] font-semibold leading-[1.05] tracking-tight mb-6 lp-fade-up lp-visible">
                  A plataforma única de Governança, Riscos e{" "}
                  <span className="text-[#7552FF]">Conformidade</span> para empresas que levam compliance a sério.
                </h1>

                <p className="text-base sm:text-lg text-white/60 max-w-xl mb-9 lp-fade-up lp-visible leading-relaxed mx-auto lg:mx-0">
                  Centralize riscos, controles, frameworks e auditorias em um único ambiente — com guidance estruturada e artefatos prontos para auditoria.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-10 lp-fade-up lp-visible">
                  <Button
                    size="lg"
                    onClick={() => scrollToSection("contato")}
                    className="bg-[#7552FF] hover:bg-[#8B6FFF] text-white text-sm font-semibold px-7 h-12 w-full sm:w-auto"
                  >
                    Solicitar demonstração
                    <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.75} />
                  </Button>
                  <Button
                    size="lg"
                    variant="ghost"
                    onClick={() => scrollToSection("modulos")}
                    className="text-sm font-medium text-white/75 hover:text-white hover:bg-white/[0.04] px-6 h-12 w-full sm:w-auto"
                  >
                    Ver módulos
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 justify-center lg:justify-start text-[11px] uppercase tracking-[0.12em] text-white/35 lp-fade-up lp-visible">
                  <span>Hospedagem BR & UE</span>
                  <span className="w-1 h-1 rounded-full bg-white/20" />
                  <span>LGPD Ready</span>
                  <span className="w-1 h-1 rounded-full bg-white/20" />
                  <span>Suporte humano</span>
                </div>
              </div>

              <div className="lp-fade-up lp-visible hidden md:block">
                <DashboardMockup />
              </div>
            </div>
          </div>
        </section>

        {/* FRAMEWORKS — grid estático */}
        <section className="relative py-14 border-t border-white/[0.06]" aria-label="Frameworks suportados">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/40 mb-6 font-medium">
              Frameworks suportados nativamente
            </p>
            <div className="flex flex-wrap justify-center gap-2.5">
              {frameworks.map((fw) => (
                <span
                  key={fw}
                  className="px-3.5 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] text-white/60 text-xs font-medium tracking-wide"
                >
                  {fw}
                </span>
              ))}
              <span className="px-3.5 py-1.5 rounded-full text-white/40 text-xs font-medium">
                + 11 outros
              </span>
            </div>
          </div>
        </section>

        {/* MÓDULOS */}
        <section id="modulos" className="relative py-20 sm:py-24 lg:py-28 border-t border-white/[0.06]" aria-labelledby="modulos-title">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-14 lp-fade-up">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#7552FF] mb-3 font-medium">
                O que está incluso
              </p>
              <h2 id="modulos-title" className="text-3xl sm:text-4xl lg:text-[2.75rem] font-semibold tracking-tight mb-4 leading-tight">
                Oito módulos integrados, uma única fonte de verdade.
              </h2>
              <p className="text-white/55 text-base leading-relaxed">
                Tudo o que sua área de governança, riscos e compliance precisa para operar — sem planilhas, sem ferramentas avulsas.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-white/[0.06] rounded-xl overflow-hidden border border-white/[0.06] lp-fade-up">
              {modules.map((mod, index) => (
                <article
                  key={index}
                  className="group relative bg-[#0A1628] p-6 hover:bg-[#0F1B33] transition-colors duration-200"
                >
                  <span className="absolute top-5 right-5 text-[10px] font-mono text-white/25 tracking-wider">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <mod.icon className="h-6 w-6 text-[#7552FF] mb-5" strokeWidth={1.5} />
                  <h3 className="text-base font-semibold tracking-tight mb-2 text-white/90">{mod.title}</h3>
                  <p className="text-white/50 text-[13px] leading-relaxed mb-5">{mod.description}</p>
                  <button
                    onClick={() => setSelectedFeature(index)}
                    className="text-[#7552FF] text-xs font-medium hover:text-[#8B6FFF] transition-colors inline-flex items-center gap-1"
                  >
                    Saiba mais <span aria-hidden>→</span>
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Feature Detail Dialog */}
        <Dialog open={selectedFeature !== null} onOpenChange={() => setSelectedFeature(null)}>
          <DialogContent className="bg-[#0F2340] border-white/[0.08] text-white max-w-lg">
            {selectedFeature !== null && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3 text-xl">
                    <div className="w-10 h-10 rounded-lg bg-[#0A1628] border border-white/[0.08] flex items-center justify-center">
                      {(() => { const Icon = modules[selectedFeature].icon; return <Icon className="h-5 w-5 text-[#7552FF]" strokeWidth={1.5} />; })()}
                    </div>
                    {modules[selectedFeature].title}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-white/70">{modules[selectedFeature].description}</p>
                  <div className="p-4 rounded-xl bg-[#0A1628] border border-white/[0.08]">
                    <p className="text-sm text-white/70 whitespace-pre-line leading-relaxed">
                      {modules[selectedFeature].details}
                    </p>
                  </div>
                  <Button
                    onClick={() => { setSelectedFeature(null); scrollToSection("contato"); }}
                    className="w-full bg-[#7552FF] hover:bg-[#8B6FFF]"
                  >
                    Falar com especialista
                    <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.75} />
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* COMO FUNCIONA — editorial */}
        <section id="como-funciona" className="relative py-20 sm:py-24 lg:py-28 border-t border-white/[0.06] bg-[#0D1F37]" aria-labelledby="como-funciona-title">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-14 lp-fade-up">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#7552FF] mb-3 font-medium">
                Como funciona
              </p>
              <h2 id="como-funciona-title" className="text-3xl sm:text-4xl lg:text-[2.75rem] font-semibold tracking-tight mb-4 leading-tight">
                Três passos para colocar a sua governança em ordem.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lp-fade-up">
              {howItWorks.map((item) => (
                <div key={item.step} className="relative">
                  <div className="relative">
                    <span className="absolute -top-4 -left-2 text-7xl font-bold text-[#7552FF]/15 select-none leading-none">
                      {item.step}
                    </span>
                    <div className="relative pt-8 pl-2">
                      <item.icon className="h-6 w-6 text-[#7552FF] mb-5" strokeWidth={1.5} />
                      <h3 className="text-lg font-semibold text-white/90 mb-3 tracking-tight">{item.title}</h3>
                      <p className="text-white/55 text-sm leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* GAP ANALYSIS DESTAQUE */}
        <section className="relative py-24 sm:py-28 lg:py-32 border-t border-white/[0.06] overflow-hidden" aria-labelledby="gap-analysis-title">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-[#7552FF]/[0.04] rounded-full blur-[140px] pointer-events-none" />

          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 lp-fade-up">
            <div className="max-w-3xl mb-14">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#7552FF] mb-3 font-medium">
                Gap Analysis
              </p>
              <h2 id="gap-analysis-title" className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight mb-5 leading-[1.1]">
                Avalie a aderência da sua empresa a 21 frameworks. Sem consultoria externa.
              </h2>
              <p className="text-white/60 text-base sm:text-lg leading-relaxed">
                Da ISO 27001 à LGPD, conduza internamente o seu programa de conformidade com guidance estruturada por requisito e artefatos prontos para auditoria.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              {[
                {
                  icon: Shield,
                  title: "21 frameworks prontos",
                  desc: "ISO 27001, LGPD, NIST CSF, SOC 2, GDPR, PCI DSS e mais. Estruturados, versionados e mantidos pela equipe Akuris.",
                },
                {
                  icon: BookOpen,
                  title: "Guidance por requisito",
                  desc: "Cada controle vem com orientação prática: o que fazer, como evidenciar e o que entregar para o auditor.",
                },
                {
                  icon: FileCheck,
                  title: "Artefatos sob demanda",
                  desc: "Statement of Applicability, planos de remediação e relatórios executivos gerados a partir dos seus dados.",
                },
              ].map((b) => (
                <div key={b.title} className="p-7 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-[#7552FF]/30 transition-colors">
                  <b.icon className="h-6 w-6 text-[#7552FF] mb-5" strokeWidth={1.5} />
                  <h3 className="text-white/90 font-semibold text-base tracking-tight mb-2">{b.title}</h3>
                  <p className="text-white/55 text-sm leading-relaxed">{b.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CONTATO */}
        <section id="contato" className="relative py-20 sm:py-24 lg:py-28 border-t border-white/[0.06]" aria-labelledby="contato-title">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-12 lg:gap-16">
              <div className="space-y-8 lp-fade-up">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[#7552FF] mb-3 font-medium">
                    Fale com a gente
                  </p>
                  <h2 id="contato-title" className="text-3xl sm:text-4xl lg:text-[2.75rem] font-semibold tracking-tight leading-tight mb-5">
                    Pronto para ver o Akuris em ação?
                  </h2>
                  <p className="text-white/60 text-base leading-relaxed">
                    Agende uma conversa de 30 minutos. Mostramos a plataforma com dados reais e respondemos como ela se encaixa no seu cenário.
                  </p>
                </div>

                <div className="space-y-3">
                  {[
                    "Demonstração personalizada da plataforma",
                    "Avaliação inicial sem compromisso",
                    "Implantação assistida por especialistas",
                  ].map((text, i) => (
                    <div key={i} className="flex items-center gap-3 text-white/75 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-[#7552FF] shrink-0" strokeWidth={1.75} />
                      <span>{text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative z-20 bg-white/[0.02] rounded-xl p-6 sm:p-8 border border-white/[0.08] lp-fade-up">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <input
                    type="text"
                    name="website"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                    className="absolute opacity-0 h-0 w-0 pointer-events-none"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="contact-name" className="block text-xs font-medium text-white/65 mb-2 tracking-wide">Nome</label>
                      <Input id="contact-name" name="name" value={formData.name} onChange={handleInputChange} required placeholder="Seu nome" className="h-11 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/30 focus:border-[#7552FF] focus:ring-1 focus:ring-[#7552FF]/30" />
                    </div>
                    <div>
                      <label htmlFor="contact-email" className="block text-xs font-medium text-white/65 mb-2 tracking-wide">Email corporativo</label>
                      <Input id="contact-email" name="email" type="email" value={formData.email} onChange={handleInputChange} required placeholder="voce@empresa.com" className="h-11 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/30 focus:border-[#7552FF] focus:ring-1 focus:ring-[#7552FF]/30" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="contact-company" className="block text-xs font-medium text-white/65 mb-2 tracking-wide">Empresa</label>
                      <Input id="contact-company" name="company" value={formData.company} onChange={handleInputChange} required placeholder="Nome da empresa" className="h-11 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/30 focus:border-[#7552FF] focus:ring-1 focus:ring-[#7552FF]/30" />
                    </div>
                    <div>
                      <label htmlFor="contact-phone" className="block text-xs font-medium text-white/65 mb-2 tracking-wide">Telefone</label>
                      <Input id="contact-phone" name="phone" value={formData.phone} onChange={handleInputChange} required placeholder="(00) 00000-0000" className="h-11 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/30 focus:border-[#7552FF] focus:ring-1 focus:ring-[#7552FF]/30" />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="contact-message" className="block text-xs font-medium text-white/65 mb-2 tracking-wide">Como podemos ajudar?</label>
                    <Textarea id="contact-message" name="message" value={formData.message} onChange={handleInputChange} required placeholder="Conte um pouco sobre seu cenário, frameworks de interesse, tamanho do time..." rows={4} className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/30 focus:border-[#7552FF] focus:ring-1 focus:ring-[#7552FF]/30 resize-none" />
                  </div>

                  <Button type="submit" disabled={isSubmitting} className="w-full h-12 bg-[#7552FF] hover:bg-[#8B6FFF] text-white text-sm font-semibold">
                    {isSubmitting ? "Enviando..." : "Falar com especialista"}
                    <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.75} />
                  </Button>

                  <p className="text-[11px] text-white/40 leading-relaxed text-center">
                    Resposta em até 1 dia útil. Seus dados são tratados conforme a LGPD.
                  </p>
                </form>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="relative py-14 border-t border-white/[0.06]" role="contentinfo">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-10">
            <div className="sm:col-span-2 lg:col-span-1">
              <img src={akurisLogo} alt="Akuris" className="h-10 w-auto mb-4" loading="lazy" />
              <p className="text-white/50 text-sm leading-relaxed max-w-xs">
                Plataforma de Governança, Riscos e Conformidade para empresas que tratam compliance como prioridade estratégica.
              </p>
            </div>

            <div>
              <h4 className="text-[11px] uppercase tracking-[0.16em] text-white/40 mb-4 font-medium">Produto</h4>
              <ul className="space-y-2.5">
                <li><button onClick={() => scrollToSection("modulos")} className="text-white/65 hover:text-white text-sm transition-colors">Módulos</button></li>
                <li><button onClick={() => scrollToSection("como-funciona")} className="text-white/65 hover:text-white text-sm transition-colors">Como funciona</button></li>
                <li><button onClick={() => scrollToSection("contato")} className="text-white/65 hover:text-white text-sm transition-colors">Solicitar demo</button></li>
              </ul>
            </div>

            <div>
              <h4 className="text-[11px] uppercase tracking-[0.16em] text-white/40 mb-4 font-medium">Empresa</h4>
              <ul className="space-y-2.5">
                <li><Link to="/politica-privacidade" className="text-white/65 hover:text-white text-sm transition-colors">Política de privacidade</Link></li>
                <li><button onClick={() => scrollToSection("contato")} className="text-white/65 hover:text-white text-sm transition-colors">Suporte</button></li>
                <li><Link to="/auth" className="text-white/65 hover:text-white text-sm transition-colors">Acessar plataforma</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-[11px] uppercase tracking-[0.16em] text-white/40 mb-4 font-medium">Onde estamos</h4>
              <ul className="space-y-2.5">
                <li className="flex items-center gap-2 text-white/65 text-sm">
                  <img src={flagBrazil} alt="Brasil" className="h-3.5 w-auto shrink-0 rounded-[1px]" loading="lazy" />
                  São Paulo · Brasil
                </li>
                <li className="flex items-center gap-2 text-white/65 text-sm">
                  <img src={flagPortugal} alt="Portugal" className="h-3.5 w-auto shrink-0 rounded-[1px]" loading="lazy" />
                  Porto · Portugal
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-white/40 text-xs">
              © {new Date().getFullYear()} Akuris. Todos os direitos reservados.
            </p>
            <div className="flex items-center gap-5 text-[11px] uppercase tracking-[0.14em] text-white/35">
              <span>LGPD Ready</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span>Hospedagem BR & UE</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span>SLA 99,9%</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
