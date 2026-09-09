import { createClient } from "npm:@supabase/supabase-js@2";
import { authorizedScheduledJob } from "../_shared/scheduled-job.ts";
import { processIntegrationRun } from "../_shared/integration-runner.ts";
import { integrationReleaseResponse } from "../_shared/integration-release.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response(null, { status: 405 });
  const unavailable = integrationReleaseResponse();
  if (unavailable) return unavailable;
  if (!authorizedScheduledJob(req, Deno.env.get("INTEGRATION_WORKER_TOKEN")))
    return new Response(null, { status: 401 });
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const scheduled = await db.rpc("integration_schedule_due");
  if (scheduled.error)
    return Response.json({ error: "schedule_failed" }, { status: 500 });
  const work = async () => {
    await Promise.all([
      processIntegrationRun(db),
      processIntegrationRun(db),
      processIntegrationRun(db),
    ]);
  };
  // Lease/queue survives request termination and a later tick resumes the run.
  const runtime = (
    globalThis as unknown as {
      EdgeRuntime?: { waitUntil(promise: Promise<unknown>): void };
    }
  ).EdgeRuntime;
  if (runtime) runtime.waitUntil(work());
  else await work();
  return Response.json({ accepted: true });
});
