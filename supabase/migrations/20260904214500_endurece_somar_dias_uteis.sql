-- O resultado de EXTRACT sobre timestamptz depende do fuso da sessão, portanto
-- a função é STABLE (não IMMUTABLE). O search_path explícito também impede que
-- objetos homónimos de schemas controlados pelo chamador sejam resolvidos.
ALTER FUNCTION public.somar_dias_uteis(timestamp with time zone, integer)
  STABLE
  SET search_path = pg_catalog, public, pg_temp;
