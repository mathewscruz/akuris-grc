# App do Akuris nas lojas oficiais

## O que você já tem
- App web React + Vite publicado em https://akuris-grc.lovable.app e nos domínios customizados https://www.akuris.com.br, https://akuris.pt, https://akuris.com.br.
- PWA configurado (manifest + ícones `standalone`).

## O que você NÃO tem ainda (e precisa criar)
- **Apple Developer Program** — US$ 99/ano (pessoa física/empresa) ou US$ 299/ano (enterprise). Requer CNPJ/empresa verificada para apps empresariais.
- **Google Play Console** — US$ 25 (taxa única de registro). Pode ser conta pessoal ou organização.
- **Computador macOS com Xcode** — obrigatório para buildar e submeter o app iOS.
- **Android Studio** — obrigatório para buildar o Android App Bundle (AAB).
- **Keystore Android** e certificados de assinatura iOS — criados na sua máquina, não versionados no repo.

## Caminho técnico recomendado

Usaremos **Capacitor** (Ionic) para empacotar o app web existente como um app nativo híbrido simples, sem reescrever a aplicação.

### 1. Instalar e inicializar Capacitor
- Adicionar as dependências:
  - `@capacitor/core`
  - `@capacitor/cli` (dev dependency)
  - `@capacitor/ios`
  - `@capacitor/android`
- Rodar `npx cap init` com:
  - `appId`: `app.lovable.e64d00f71631421abcc886aa27d8fb2a`
  - `appName`: `akuris-grc`
  - `webDir`: `dist`
- Incluir a configuração de hot-reload para o preview do sandbox:
```json
"server": {
  "url": "https://e64d00f7-1631-421a-bcc8-86aa27d8fb2a.lovableproject.com?forceHideBadge=true",
  "cleartext": true
}
```

### 2. Adicionar as plataformas nativas
- `npx cap add ios`
- `npx cap add android`
- Isso cria as pastas `ios/` e `android/` com projetos Xcode e Gradle prontos.

### 3. Garantir build SPA para `dist/`
- Verificar que `vite build` produz `dist/` com `index.html`, assets e manifest/icons.
- Ajustar o service worker do PWA se necessário, pois apps que se comportam como "navegador disfarçado" podem ser rejeitados (Apple guideline 4.2 / Google Play spam policy).

### 4. Ajustar UX para app nativo
- Manter navegação client-side sem reload.
- Evitar zoom em inputs mobile (já parcialmente tratado).
- Garantir safe-area insets para notch/island.
- Testar teclado virtual em formulários longos.
- Verificar se toasts Sonner funcionam dentro da WebView.

### 5. Build e assinatura
#### Android
- Gerar `keystore` (jks) com chave de upload.
- Configurar `signingConfigs.release` no `build.gradle`.
- Buildar AAB via `gradlew bundleRelease` ou Android Studio.
- Fazer upload na Google Play Console.
- Ativar Play App Signing.

#### iOS
- Abrir `ios/App/App.xcworkspace` no Xcode em um Mac.
- Configurar Apple Team, Bundle ID, Signing & Capabilities.
- Definir ícones, launch screen, orientação portrait.
- Buildar Archive e submeter via App Store Connect.
- A Apple pode rejeitar se o app parecer apenas um site genérico; garantir identidade visual forte e funcionalidade clara.

### 6. Ativos obrigatórios para as lojas
- Ícone 1024×1024 base e splash screen.
- Screenshots em vários tamanhos de tela.
- Descrição curta, descrição completa, palavras-chave, política de privacidade.
- Categoria: Negócios / Produtividade.
- Classificação de conteúdo (questionários Apple/Google).
- Conta de contato/suporte.

### 7. Requisitos legais/compliance
- Política de privacidade acessível.
- Termos de uso.
- Declarar dados coletados no Data Safety (Google) e App Privacy (Apple).
- Manter LGPD/GDPR via campo `jurisdicao` já existente.

## Escopo deste plano
1. Instalar e configurar Capacitor no projeto (`capacitor.config.ts`, `package.json`).
2. Adicionar plataformas iOS e Android (`ios/`, `android/`).
3. Ajustar build/UX para evitar rejeição nas lojas.
4. Gerar ícones e splash screens.
5. Documentar passos de build, assinatura e submissão em `docs/PUBLICACAO_LOJAS.md`.
6. NÃO executar a publicação final (requer suas contas e certificados).

## O que NÃO está no escopo
- Recursos nativos complexos (câmera, push, biometria, GPS, background sync).
- Reescrita em React Native / Flutter.
- Backend nativo (Supabase continua servindo tudo).
- Criar as contas de desenvolvedor Apple/Google para você.
- Assinar e submeter o app final nas lojas.

## Entregáveis
- `capacitor.config.ts` configurado.
- Pastas `ios/` e `android/` geradas.
- Scripts `build:android` e `build:ios` no `package.json`.
- Ícones e splash screens gerados.
- Documento `docs/PUBLICACAO_LOJAS.md` com checklist completo.

## Dependências externas que você precisa resolver
1. Criar conta Apple Developer Program (US$ 99/ano).
2. Criar conta Google Play Console (US$ 25 única).
3. Computador Mac com Xcode para iOS.
4. Android Studio instalado.
5. Gerar keystore Android e certificados iOS localmente.

