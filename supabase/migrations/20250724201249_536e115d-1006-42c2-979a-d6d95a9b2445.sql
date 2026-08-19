-- Corrigir o slug da empresa Órigo Energia
UPDATE empresas 
SET slug = 'origo-energia' 
WHERE nome = 'Órigo Energia' AND slug = 'rigo energia';