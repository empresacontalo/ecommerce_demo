-- Adiciona coluna stock à tabela public.produtos
ALTER TABLE public.produtos 
ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 10;

-- Atualiza stock_status com base na quantidade de estoque
UPDATE public.produtos 
SET stock_status = CASE 
  WHEN stock > 0 THEN 'Em estoque' 
  ELSE 'Indisponível' 
END;
