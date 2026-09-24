import { getBlocosPorSlug, getConfiguracao, isPaginaAtiva } from '@/app/actions/cms';
import CmsBlockRenderer from '@/components/CmsBlockRenderer';
import { notFound } from 'next/navigation';
import { EMPRESA_NOME_PADRAO } from '@/utils/empresa-default';

export const dynamic = 'force-dynamic';

export default async function SobrePage() {
  if (!(await isPaginaAtiva('sobre'))) notFound();
  const [blocos, logo] = await Promise.all([
    getBlocosPorSlug('sobre'),
    getConfiguracao('header.logo'),
  ]);
  const nome = logo?.texto || EMPRESA_NOME_PADRAO;
  if (!blocos.length) return <div style={{ padding:'4rem', textAlign:'center', color:'var(--color-text-tertiary)' }}>Página em construção.</div>;
  return <CmsBlockRenderer blocos={blocos} />;
}
