import { getBlocosPorSlug, getConfiguracao, isPaginaAtiva } from '@/app/actions/cms';
import CmsBlockRenderer from '@/components/CmsBlockRenderer';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const seo = await getConfiguracao('seo.encontre-seu-cheiro');
  const valor = (seo?.valor ?? {}) as Record<string, unknown>;
  return {
    title: typeof valor.title === 'string' && valor.title ? valor.title : 'Find Your Scent — Fragrance E-commerce Demo',
    description: typeof valor.description === 'string' && valor.description ? valor.description : 'Answer a few curated questions and discover your signature luxury fragrance. Personalized recommendations from our collection of world-class perfumes.',
  };
}

export default async function EncontreSeuCheiroPage() {
  if (!(await isPaginaAtiva('encontre-seu-cheiro'))) notFound();
  const blocos = await getBlocosPorSlug('encontre-seu-cheiro');
  if (!blocos.length) return <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>Page under construction.</div>;
  return <CmsBlockRenderer blocos={blocos} />;
}
