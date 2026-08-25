-- As preferências de notificação passam a existir de facto.
--
-- ## O que estava lá
--
-- O perfil tinha três controlos — «Email», «In-App» e «Frequência: Tempo real /
-- Diário / Semanal» — gravados em `localStorage`. Nenhum outro ficheiro do
-- produto lia essa chave. Consequências, todas verificadas:
--
--   · desligar «Email» não impedia um único envio (o servidor nunca vê o
--     `localStorage` do navegador de ninguém);
--   · desligar «In-App» não filtrava nada no sino;
--   · «Diário/Semanal» não existe como funcionalidade em lado nenhum;
--   · e era por NAVEGADOR: mudar de máquina apagava a escolha.
--
-- É o pior tipo de fachada — um controlo com forma de consentimento. A pessoa
-- desliga, acredita que desligou, e continua a receber.
--
-- ## O que fica, e o que sai
--
-- Ficam as duas que se conseguem cumprir, agora numa coluna do perfil: o
-- servidor passa a poder lê-las, e a escolha segue a pessoa entre máquinas.
--
-- Sai a «frequência». Não há digest no produto, e oferecer a escolha entre três
-- cadências quando as três fazem a mesma coisa é repetir o problema com outra
-- roupa. Quando houver digest, volta.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notificar_por_email boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notificar_na_aplicacao boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.notificar_por_email IS
  'A pessoa quer receber e-mail de notificação. Nasce ligado: não se corta comunicação a quem nunca escolheu.';

COMMENT ON COLUMN public.profiles.notificar_na_aplicacao IS
  'A pessoa quer notificações no sino. Nasce ligado.';

DO $$
BEGIN
  RAISE NOTICE 'preferências de notificação: saem do localStorage para o perfil';
END $$;
