import './auth.css';
import type { Metadata } from 'next';
import { getConfiguracao } from '@/app/actions/cms';
import { EMPRESA_NOME_PADRAO } from '@/utils/empresa-default';

export async function generateMetadata(): Promise<Metadata> {
  const logo = await getConfiguracao('header.logo');
  const nome = logo?.texto || EMPRESA_NOME_PADRAO;
  return {
    title: `Entrar — ${nome}`,
    description: `Acesse sua conta na ${nome} para gerenciar pedidos e agendamentos.`,
    robots: 'noindex',
  };
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
