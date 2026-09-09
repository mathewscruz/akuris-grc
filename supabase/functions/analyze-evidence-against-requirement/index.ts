import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleEvidenceAnalysis } from '../_shared/evidence-analysis-handler.ts';
serve(handleEvidenceAnalysis);
