-- Módulo campanhas · imagens por orientação (paisagem/retrato)
-- Faz para o carrossel de campanha o mesmo que o carrossel do CMS já faz:
-- a imagem pode ter uma variante paisagem e/ou retrato, editável via admin.
-- Novas colunas são opcionais: sem valor, usa-se a `url` (comportamento atual).

ALTER TABLE public.campanha_imagens ADD COLUMN IF NOT EXISTS url_paisagem text;
ALTER TABLE public.campanha_imagens ADD COLUMN IF NOT EXISTS url_retrato text;
