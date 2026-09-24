import { getBlocosPorSlug, isPaginaAtiva } from '@/app/actions/cms';
import CmsPage from '@/components/CmsPage';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  if (!(await isPaginaAtiva('home'))) notFound();
  const blocos = await getBlocosPorSlug('home');
  return <CmsPage blocos={blocos} slug="home" />;
}
