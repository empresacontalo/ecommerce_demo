/**
 * Utilitário CMS - Portal Gerenciável
 *
 * Fornece funções para buscar conteúdo dinâmico do banco de dados.
 * Se o banco não estiver disponível ou as tabelas não existirem,
 * retorna fallback para conteúdo estático/hardcoded.
 */

const CMS_API_BASE = '/api/cms';

interface Pagina {
  id: string;
  slug: string;
  titulo: string;
  meta_description: string | null;
  ativo: boolean;
}

interface Bloco {
  id: string;
  pagina_id: string;
  tipo: string;
  titulo: string | null;
  ordem: number;
  conteudo: Record<string, unknown>;
  ativo: boolean;
}

interface Configuracao {
  chave: string;
  valor: unknown;
}

/** Busca uma página e seus blocos pelo slug */
export async function getPagina(slug: string): Promise<{ pagina: Pagina; blocos: Bloco[] } | null> {
  try {
    const res = await fetch(`${CMS_API_BASE}/paginas?slug=${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 }, // ISR: revalidar a cada 60s
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Busca todos os blocos de uma página */
export async function getBlocos(paginaId: string): Promise<Bloco[]> {
  try {
    const res = await fetch(`${CMS_API_BASE}/blocos?pagina_id=${paginaId}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

/** Busca imagens da galeria */
export async function getGaleria(categoria?: string): Promise<Record<string, unknown>[]> {
  try {
    const params = categoria ? `?categoria=${encodeURIComponent(categoria)}` : '';
    const res = await fetch(`${CMS_API_BASE}/galeria${params}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

/** Busca depoimentos */
export async function getDepoimentos(): Promise<Record<string, unknown>[]> {
  try {
    const res = await fetch(`${CMS_API_BASE}/depoimentos`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

/** Busca uma configuração pelo nome da chave */
export async function getConfiguracao(chave: string): Promise<unknown | null> {
  try {
    const res = await fetch(`${CMS_API_BASE}/configuracoes?chave=${encodeURIComponent(chave)}`, {
      cache: 'no-store', // Configs precisam ser sempre atualizadas
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.valor || null;
  } catch {
    return null;
  }
}

/** Busca campanhas ativas */
export async function getCampanhas(): Promise<Record<string, unknown>[]> {
  try {
    const res = await fetch(`${CMS_API_BASE}/campanhas`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

/**
 * Tipos de blocos suportados:
 *
 * - hero: Banner principal com imagem, título, subtítulo, CTAs
 *   conteudo: { imagem, badge, titulo, subtitulo, cta1_label, cta1_href, cta2_label, cta2_href }
 *
 * - carrossel: Múltiplos slides
 *   conteudo: { slides: [{ imagem, badge, titulo, subtitulo, cta1_label, cta1_href, cta2_label, cta2_href }] }
 *
 * - cards: Cards de produtos/serviços
 *   conteudo: { items: [{ imagem, titulo, descricao, link }] }
 *
 * - texto: Bloco de texto rico
 *   conteudo: { html: string }
 *
 * - cta: Call to action
 *   conteudo: { titulo, texto, botao_label, botao_href, estilo }
 *
 * - galeria: Grid de imagens
 *   conteudo: { categoria: string (opcional - filtra da tabela galeria) }
 *
 * - depoimentos: Depoimentos de clientes (busca da tabela depoimentos)
 *   conteudo: {}
 *
 * - form: Formulário (lead, contato)
 *   conteudo: { tipo: 'lead' | 'contato', titulo, subtitulo, campos: [...], botao_label }
 *
 * - servicos: Lista de serviços com ícones
 *   conteudo: { items: [{ icone, titulo, descricao }] }
 *
 * - diferencial: Diferenciais da marca
 *   conteudo: { items: [{ icone, titulo, descricao }] }
 *
 * - produtos: Vitrine de produtos (busca da API de produtos)
 *   conteudo: { limite: number, categoria: string }
 *
 * - html: HTML customizado
 *   conteudo: { html: string }
 */
