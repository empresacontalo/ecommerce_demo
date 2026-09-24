'use client';

import { createContext, useContext } from 'react';

export interface CampanhaImagem {
  id: string;
  url: string;
  url_paisagem?: string | null;
  url_retrato?: string | null;
  status: string;
  ordem: number;
}

export interface Decoracao {
  id: string;
  tipo: string;
}

export interface CampanhaPublica {
  id: string;
  titulo: string;
  descricao: string | null;
  desconto: string | null;
  canal_padrao: string;
  categoria?: string | null;
}

export interface CampanhaAtivaData {
  campanha: CampanhaPublica | null;
  imagens: CampanhaImagem[];
  decoracoes: Decoracao[];
}

export interface SlideContent {
  imagem: string;
  imagem_paisagem?: string;
  imagem_retrato?: string;
  badge?: string;
  titulo?: string;
  subtitulo?: string;
  cta1_label?: string;
  cta1_link?: string;
  cta2_label?: string;
  cta2_link?: string;
}

export const CAMPANHA_VAZIA: CampanhaAtivaData = { campanha: null, imagens: [], decoracoes: [] };

export const CampanhaCtx = createContext<CampanhaAtivaData>(CAMPANHA_VAZIA);

export function useCampanhaAtiva(): CampanhaAtivaData {
  return useContext(CampanhaCtx);
}

// Converte a campanha ativa em slides no mesmo formato dos slides do CMS,
// para que entrem no carrossel principal da página (ou virem um carrossel
// próprio quando a página não possui um).
export function campanhaParaSlides(campanha: CampanhaPublica, imagens: CampanhaImagem[]): SlideContent[] {
  const aprovadas = imagens
    .filter((i) => i.status === 'aprovada')
    .sort((a, b) => a.ordem - b.ordem);
  return aprovadas.map((img) => ({
    imagem: img.url,
    imagem_paisagem: img.url_paisagem || img.url,
    imagem_retrato: img.url_retrato || img.url,
    badge: campanha.categoria || 'Promoção',
    titulo: campanha.titulo,
    subtitulo: campanha.descricao || undefined,
    cta1_label: campanha.desconto ? `Quero ${campanha.desconto} de desconto` : 'Quero receber meu desconto sem compromisso',
    cta1_link: '#campanha-promocional',
  }));
}
