import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import akurisLogo from "@/assets/akuris-logo.png";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSelector } from "@/components/LanguageSelector";
import { IconArrowLeft, IconShield, IconMail, IconPin } from '@/components/icons';
import { SEO } from '@/components/SEO';

const PoliticaPrivacidade = () => {
  const { t, locale } = useLanguage();
  const p = (key: string) => t(`publico.privacidade.${key}`);

  return (
    <div className="min-h-screen bg-[#0A1628] text-white">
      <SEO title={`${p("titulo")} | Akuris`} description="Conheça como a Akuris trata dados pessoais, atende direitos de titulares e protege informações." canonical="/politica-privacidade" />
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0A1628]/90 backdrop-blur-xl border-b border-white/5 py-4">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex min-h-[44px] min-w-0 items-center gap-2 text-muted-foreground hover:text-white transition-colors">
              <IconArrowLeft className="h-5 w-5 shrink-0" />
              <span className="truncate">{p("voltar")}</span>
            </Link>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <LanguageSelector variant="dark" />
              <img src={akurisLogo} alt="Akuris" className="h-8 w-auto sm:h-10" />
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Title */}
          <div className="text-center mb-12">
            <IconShield className="inline-block h-10 w-10 text-info mb-6" />
            <h1 className="text-3xl sm:text-4xl font-bold mb-4">{p("titulo")}</h1>
            <p className="text-muted-foreground">
              {p("atualizacao")}:{" "}
              {new Date().toLocaleDateString(locale === "en" ? "en-US" : "pt-BR", {
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>

          {/* Content sections */}
          <div className="space-y-10 text-muted-foreground">
            <section>
              <h2 className="text-xl font-semibold text-white mb-4">{p("s1")}</h2>
              <p className="leading-relaxed">{p("s1p1")}</p>
              <p className="leading-relaxed mt-4">{p("s1p2")}</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">{p("s2")}</h2>
              <p className="leading-relaxed mb-4">{p("s2p1")}</p>
              <div className="bg-white/5 rounded-lg p-6 space-y-3 border border-white/10">
                <div className="flex items-center gap-3">
                  <IconMail className="h-5 w-5 text-info" />
                  <span>privacidade@akuris.com.br</span>
                </div>
                <div className="flex items-center gap-3">
                  <IconPin className="h-5 w-5 text-info" />
                  <span>{p("s2local")}</span>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">{p("s3")}</h2>
              <p className="leading-relaxed mb-4">{p("s3p1")}</p>

              <div className="space-y-4">
                <div className="bg-white/5 rounded-lg p-5 border border-white/10">
                  <h3 className="font-semibold text-white mb-2">{p("dadosCadastro")}</h3>
                  <p className="text-sm">{p("dadosCadastroDesc")}</p>
                </div>

                <div className="bg-white/5 rounded-lg p-5 border border-white/10">
                  <h3 className="font-semibold text-white mb-2">{p("dadosUso")}</h3>
                  <p className="text-sm">{p("dadosUsoDesc")}</p>
                </div>

                <div className="bg-white/5 rounded-lg p-5 border border-white/10">
                  <h3 className="font-semibold text-white mb-2">{p("dadosComunicacao")}</h3>
                  <p className="text-sm">{p("dadosComunicacaoDesc")}</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">{p("s4")}</h2>
              <p className="leading-relaxed mb-4">{p("s4p1")}</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                {["fin1", "fin2", "fin3", "fin4", "fin5", "fin6", "fin7"].map((k) => (
                  <li key={k}>{p(k)}</li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">{p("s5")}</h2>
              <p className="leading-relaxed mb-4">{p("s5p1")}</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                {[
                  ["baseContrato", "baseContratoDesc"],
                  ["baseInteresse", "baseInteresseDesc"],
                  ["baseConsentimento", "baseConsentimentoDesc"],
                  ["baseLegal", "baseLegalDesc"],
                ].map(([label, desc]) => (
                  <li key={label}>
                    <strong className="text-white">{p(label)}</strong> {p(desc)}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">{p("s6")}</h2>
              <p className="leading-relaxed mb-4">{p("s6p1")}</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                {[
                  ["compPrestadores", "compPrestadoresDesc"],
                  ["compAutoridades", "compAutoridadesDesc"],
                ].map(([label, desc]) => (
                  <li key={label}>
                    <strong className="text-white">{p(label)}</strong> {p(desc)}
                  </li>
                ))}
              </ul>
              <p className="leading-relaxed mt-4">{p("s6p2")}</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">{p("s7")}</h2>
              <p className="leading-relaxed mb-4">{p("s7p1")}</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                {["seg1", "seg2", "seg3", "seg4", "seg5", "seg6"].map((k) => (
                  <li key={k}>{p(k)}</li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">{p("s8")}</h2>
              <p className="leading-relaxed">{p("s8p1")}</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">{p("s9")}</h2>
              <p className="leading-relaxed mb-4">{p("s9p1")}</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                {["dir1", "dirAcesso", "dir2", "dir3", "dirPortabilidade", "dir4", "dir5", "dir6"].map((k) => (
                  <li key={k}>{p(k)}</li>
                ))}
              </ul>
              <p className="leading-relaxed mt-4">
                {p("s9p2")} <span className="text-info">privacidade@akuris.com.br</span>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">{p("s10")}</h2>
              <p className="leading-relaxed mb-4">{p("s10p1")}</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                {["cook1", "cook2", "cook3"].map((k) => (
                  <li key={k}>{p(k)}</li>
                ))}
              </ul>
              <p className="leading-relaxed mt-4">{p("s10p2")}</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">{p("s11")}</h2>
              <p className="leading-relaxed">{p("s11p1")}</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">{p("s12")}</h2>
              <p className="leading-relaxed mb-4">{p("s12p1")}</p>
              <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                <p className="font-semibold text-white mb-2">{p("dpo")}</p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-3">
                    <IconMail className="h-4 w-4 text-info" />
                    <span>dpo@akuris.com.br</span>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Back button */}
          <div className="mt-12 text-center">
            <Link to="/">
              <Button variant="outline" className="border-info/60 text-info hover:bg-info/20 hover:text-white">
                <IconArrowLeft className="h-4 w-4 mr-2" />
                {p("voltar")}
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} Akuris. {p("direitosReservados")}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default PoliticaPrivacidade;
