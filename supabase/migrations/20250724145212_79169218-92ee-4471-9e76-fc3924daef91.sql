-- Create storage bucket for gap analysis evidences
INSERT INTO storage.buckets (id, name, public) VALUES ('gap-analysis-evidences', 'gap-analysis-evidences', false);

-- Create policies for gap analysis evidences bucket
CREATE POLICY "Users can view their empresa gap analysis evidences" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'gap-analysis-evidences' AND (storage.foldername(name))[1] IN (
  SELECT gap_analysis_assessments.id::text 
  FROM gap_analysis_assessments 
  WHERE empresa_id = get_user_empresa_id()
));

CREATE POLICY "Users can upload gap analysis evidences to their empresa assessments" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'gap-analysis-evidences' AND (storage.foldername(name))[1] IN (
  SELECT gap_analysis_assessments.id::text 
  FROM gap_analysis_assessments 
  WHERE empresa_id = get_user_empresa_id()
));

CREATE POLICY "Users can update gap analysis evidences from their empresa assessments" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'gap-analysis-evidences' AND (storage.foldername(name))[1] IN (
  SELECT gap_analysis_assessments.id::text 
  FROM gap_analysis_assessments 
  WHERE empresa_id = get_user_empresa_id()
));

CREATE POLICY "Users can delete gap analysis evidences from their empresa assessments" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'gap-analysis-evidences' AND (storage.foldername(name))[1] IN (
  SELECT gap_analysis_assessments.id::text 
  FROM gap_analysis_assessments 
  WHERE empresa_id = get_user_empresa_id()
));