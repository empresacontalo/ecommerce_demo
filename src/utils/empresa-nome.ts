import { getConfiguracao } from '@/app/actions/cms';

/**
 * Nome da empresa cadastrado em /admin > configurações > dados da empresa.
 * Server-only (usa o banco). Fallback neutro (white-label) quando vazio.
 */
export async function getNomeEmpresa(): Promise<string> {
  try {
    const logo = await getConfiguracao('header.logo');
    const valor = logo?.valor as { texto?: string } | null | undefined;
    return valor?.texto?.trim() || '';
  } catch {
    return '';
  }
}

/** Nome usado em mensagens/assuntos; cai para genérico se não configurado */
export async function getNomeEmpresaOu(padrao: string): Promise<string> {
  const nome = await getNomeEmpresa();
  return nome || padrao;
}
