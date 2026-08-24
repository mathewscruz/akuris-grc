/**
 * Organização — identidade da empresa e mais nada.
 *
 * Tinha também um cartão de «Instalar aplicação» (o convite a instalar o PWA) e
 * um de «Configuração de Email» com um botão de envio de teste. Saíram os dois:
 * nenhum é definição da organização, e a aba existe para o que a empresa É —
 * contexto, endereço público e marca.
 *
 * Os componentes ficam no histórico do git, caso a decisão se inverta.
 */
import { CompanyContextSettings } from './CompanyContextSettings';
import { CompanySlugSettings } from './CompanySlugSettings';
import { CompanyLogoUpload } from './CompanyLogoUpload';

export function OrganizacaoTab() {
  return (
    <div className="space-y-6">
      <CompanyContextSettings />

      <CompanySlugSettings />

      <CompanyLogoUpload />
    </div>
  );
}
