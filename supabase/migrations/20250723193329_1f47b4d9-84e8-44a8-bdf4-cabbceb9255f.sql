-- Limpar perguntas duplicadas dos templates padrão
DELETE FROM due_diligence_questions 
WHERE template_id = 'ab21eb46-ec56-46c6-8280-57a2e2a4cc26' 
AND ordem > 70;

DELETE FROM due_diligence_questions 
WHERE template_id = '3ff303c2-257f-449f-a7d0-9d73447eb8fd' 
AND ordem > 30;