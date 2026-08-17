# App do Akuris nas lojas oficiais

## O que você já tem
- App web React + Vite publicado em https://akuris-grc.lovable.app e nos domínios customizados https://www.akuris.com.br, https://akuris.pt, https://akuris.com.br.
- PWA configurado (manifest + ícones `standalone`).
- Contas Apple Developer Program e Google Play Console já existentes.

## O que falta
Para ir às lojas oficiais com um app híbrido simples, a rota mais rápida e barata é **Capacitor** (Ionic): ele empacota o site como um app nativo, usando WebView, sem reescrever a aplicação.

## Caminho técnico recomendado

### 1. Preparar o projeto para Capacitor
- Adicionar `@capacitor/core`, `@capacitor/cli`, `@capacitor/android` e `@capacitor/ios` como dev dependencies.
- Criar `capacitor.config.ts` apontando `webDir` para `dist` e `server.url` opcionalmente para o domínio publicado (modo híbrido simples).
- Garantir que `build` produza um `dist/` válido e que o manifest/icons estejam copiados para lá.
- Remover/ajustar o service worker do PWA, se ele cachear HTML, porque a Apple e o Google rejeitam apps que se comportam como "navegador em disguise" (App Store guideline 4.2 / Play Store spam policy).

### 2. Gerar as plataformas nativas
- `capacitor add android` e `capacitor add ios`.
- Isso cria as pastas `android/` e `ios/` com projetos Gradle/Xcode prontos.
- Configurar `bundleId` (ex: `com.akuris.app`) e `appName` (ex: `Akuris GRC`).

### 3. Ajustar UX para app nativo
- Garantir que a navegação funcione sem reload da página (SPA).
- Bloquear zoom duplo em inputs mobile (`maximum-scale=1` ou font-size 16px já existentes).
- Remover links externos que abram no browser nativo sem aviso; usar `CapacitorBrowser` ou `InAppBrowser` se necessário.
- Verificar teclado virtual em formulários longos (scroll ajustado, safe-area insets).
- Garantir que toda notificação/toast funcione dentro da WebView (Sonner já deve funcionar, mas testar).

### 4. Build e assinatura
#### Android
- Gerar `keystore` (jks) com chave de upload.
- Configurar `build.gradle` com `signingConfigs.release`.
- Buildar AAB (Android App Bundle) via Android Studio ou `gradlew bundleRelease`.
- Fazer upload na Google Play Console (Internal → Closed → Open/Production).
- Ativar Play App Signing (obrigatório para novos apps).

#### iOS
- Abrir o projeto `ios/App/App.xcworkspace` no Xcode.
- Configurar Team, Bundle Identifier, Signing & Capabilities.
- Definir ícones, launch screen, orientação portrait.
- Buildar Archive e submeter via App Store Connect (TestFlight → App Store).
- Garantir que o app não use WebView para conteúdo genérico da web sem valor nativo — a Apple pode rejeitar por guideline 4.2. O app deve ter identidade visual, funcionalidade clara e após login, tudo funcional (não pode ser só um site genérico).

### 5. Ativos obrigatórios para as lojas
- Ícone de app: 1024×1024 base, gerando todos os tamanhos via `capacitor-assets` ou Xcode/Android Studio.
- Splash screen / Launch screen.
- Screenshots de 5 a 10 telas para cada tamanho de tela (iPhone, iPad, Android phones/tablets).
- Descrição curta, descrição completa, palavras-chave, política de privacidade URL.
- Categoria: Negócios / Produtividade.
- Classificação de conteúdo (questionário do Google Play e App Store).
- Conta de contato e suporte.

### 6. Requisitos legais/compliance
- Política de privacidade acessível (Akuris já tem).
- Termos de uso.
- Se coletar dados sensíveis: declarar no Data Safety (Google) e App Privacy (Apple).
- LGPD/GDPR: manter o campo `jurisdicao` já existente e respeitar a escolha da empresa.
- Se usar autenticação, não hardcodear credenciais (já segue o padrão do projeto).

## Escopo deste plano
1. Adicionar e configurar Capacitor no projeto.
2. Criar `capacitor.config.ts` e ajustar o build para produzir artefatos nativos.
3. Ajustar pequenos pontos de UX para evitar rejeição nas lojas (zoom, links externos, navegação).
4. Documentar passos de build e assinatura Android/iOS (não executar a publicação final, pois exige certificados e contas reais).
5. Preparar assets de ícone e splash screen para ambas as lojas.

## O que NÃO está no escopo
- Recursos nativos complexos (câmera, push, biometria, background sync, GPS). Se depois quiser, cada um vira um plugin Capacitor separado.
- Reescrita do app em React Native / Flutter.
- Backend nativo (o Supabase atual continua servindo tudo).
- Publicação final nas contas: entregamos o projeto pronto para você assinar e submeter.

## Entregáveis
- `capacitor.config.ts` configurado.
- Pastas `android/` e `ios/` geradas.
- Scripts `build:android` e `build:ios` no `package.json`.
- Ícones e splash screens gerados.
- Documento `docs/PUBLICACAO_LOJAS.md` com passos de assinatura, build e submissão.
- Checklist de validação antes do envio para Apple/Google.

## Dependências externas
- Node.js, Android Studio, Xcode (só no Mac para iOS), JDK 17+, CocoaPods.
- Contas Apple Developer Program e Google Play Console (você já tem).
- Keystore Android e certificado de distribuição iOS (você precisa criar/gerenciar na sua máquina, não armazenamos no repo).
