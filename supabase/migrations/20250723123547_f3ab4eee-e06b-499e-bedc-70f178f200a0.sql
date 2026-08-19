-- Fix storage policies - remove array syntax that's not supported

-- Storage policies for due diligence documents
CREATE POLICY "Users can view due diligence documents from their empresa"
ON storage.objects FOR SELECT
USING (bucket_id = 'due-diligence-docs' AND 
  EXISTS (
    SELECT 1 FROM due_diligence_assessments a 
    WHERE a.empresa_id = get_user_empresa_id() 
    AND split_part(name, '/', 1) = a.id::text
  )
);

CREATE POLICY "Public can upload due diligence documents via valid assessment"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'due-diligence-docs' AND 
  EXISTS (
    SELECT 1 FROM due_diligence_assessments a 
    WHERE a.status IN ('enviado', 'em_andamento')
    AND split_part(name, '/', 1) = a.id::text
  )
);

CREATE POLICY "Users can update due diligence documents from their empresa"
ON storage.objects FOR UPDATE
USING (bucket_id = 'due-diligence-docs' AND 
  EXISTS (
    SELECT 1 FROM due_diligence_assessments a 
    WHERE a.empresa_id = get_user_empresa_id() 
    AND split_part(name, '/', 1) = a.id::text
  )
);

CREATE POLICY "Users can delete due diligence documents from their empresa"
ON storage.objects FOR DELETE
USING (bucket_id = 'due-diligence-docs' AND 
  EXISTS (
    SELECT 1 FROM due_diligence_assessments a 
    WHERE a.empresa_id = get_user_empresa_id() 
    AND split_part(name, '/', 1) = a.id::text
  )
);

-- Add missing unique constraint for scores (one score per assessment)
ALTER TABLE public.due_diligence_scores ADD CONSTRAINT unique_score_per_assessment UNIQUE (assessment_id);