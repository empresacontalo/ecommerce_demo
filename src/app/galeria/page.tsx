import { getBlocosPorSlug, isPaginaAtiva } from '@/app/actions/cms';
import CmsBlockRenderer from '@/components/CmsBlockRenderer';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function GaleriaPage() {
  if (!(await isPaginaAtiva('galeria'))) notFound();
  const blocos = await getBlocosPorSlug('galeria');
  if (!blocos.length) return <div style={{ padding:'4rem', textAlign:'center', color:'var(--color-text-tertiary)' }}>Page under construction.</div>;
  return <CmsBlockRenderer blocos={blocos} />;
}
