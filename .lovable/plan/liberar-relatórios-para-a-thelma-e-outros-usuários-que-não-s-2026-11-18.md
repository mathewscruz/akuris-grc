# Liberar "Relatórios" para a Thelma (e outros usuários que não são super admin)

## O que está acontecendo
- A Thelma (Vitru) é **admin**, está ativa, e o plano da empresa (Akuris Full) inclui Relatórios.
- O problema: "Relatórios" **não aparece na lista de módulos** usada pelos perfis de permissão. Por isso, nenhum perfil consegue liberar esse módulo.
- A página de Relatórios também está configurada para **não** usar o papel do usuário como alternativa. Resultado: quem não tem uma permissão específica é bloqueado, mesmo sendo admin. Só super admins (como o Henrique) conseguem entrar.
- Ou seja, isso afeta **todos os usuários que não são super admin**, não só a Thelma.

## O que será feito
1. Adicionar "Relatórios" à lista de módulos, para que ele apareça nas telas de perfil de permissão (em PT e EN).
2. Liberar Relatórios em todos os perfis de permissão que já existem e dão acesso ao Dashboard. Assim, a Thelma e os colegas dela entram sem que ninguém precise reconfigurar nada. A regra continua a mesma: as permissões de cada usuário vêm do perfil.
3. Novos perfis passam a mostrar Relatórios como um módulo que pode ser ligado ou desligado.
4. Adicionar um teste: um admin com Relatórios no perfil consegue entrar; sem Relatórios no perfil, é bloqueado.

## Detalhes técnicos
- Migration: inserir `relatorios` em `system_modules`. Depois, preencher `permission_profile_modules` (perfis que já têm `dashboard`) e `user_module_permissions` derivadas, com escopo por empresa e sem duplicar registros já existentes.
- Manter `fallbackToRoleCheck={false}` na rota, porque o acesso continua governado pelo perfil.
- Validar consultando as permissões da Thelma (`b72c2b3f-…`) depois da migration.
