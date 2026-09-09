-- The initial publication is a coming-soon catalog, not an operational rollout.
-- Keep the job definition for future activation; do not touch any legacy job.
DO $$
DECLARE collection_job bigint;
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    FOR collection_job IN
      SELECT jobid FROM cron.job WHERE jobname = 'integration-collections' AND active
    LOOP
      PERFORM cron.alter_job(collection_job, active := false);
    END LOOP;
  END IF;
END $$;
