/**
 * Tráfego Pago — Google TAGS.
 *
 * Módulo puro (sem banco/browser) com:
 *  - catálogo das páginas públicas que podem receber tags;
 *  - regras de validação dos campos editados no admin;
 *  - geração dos snippets oficiais (GA4, Google Ads, GTM e HTML personalizado)
 *    que são injetados entre <head></head> no layout raiz.
 */

export type GoogleTagTipo = 'ga4' | 'google_ads' | 'gtm' | 'personalizado';

export interface GoogleTag {
  id: string;
  nome: string;
  tipo: GoogleTagTipo;
  identificador: string;
  codigo: string | null;
  paginas: string[];
  ativo: boolean;
  ordem: number;
}

export interface PaginaDisponivel {
  slug: string;
  label: string;
  rota: string;
}

export const TIPOS_GOOGLE_TAG: GoogleTagTipo[] = ['ga4', 'google_ads', 'gtm', 'personalizado'];

export const TIPO_LABEL: Record<GoogleTagTipo, string> = {
  ga4: 'Google Analytics 4',
  google_ads: 'Google Ads',
  gtm: 'Google Tag Manager',
  personalizado: 'HTML personalizado',
};

/** Páginas públicas do site que podem receber tags no <head>. */
export const PAGINAS_DISPONIVEIS: PaginaDisponivel[] = [
  { slug: 'todas', label: 'Todas as páginas', rota: 'site inteiro' },
  { slug: 'home', label: 'Home', rota: '/' },
  { slug: 'sobre', label: 'Sobre Nós', rota: '/sobre' },
  { slug: 'catalogo', label: 'Catálogo (inclui página de produto)', rota: '/catalogo' },
  { slug: 'encontre-seu-cheiro', label: 'Encontre seu Cheiro', rota: '/encontre-seu-cheiro' },
  { slug: 'galeria', label: 'Galeria', rota: '/galeria' },
  { slug: 'salao', label: 'Salão de Beleza', rota: '/salao' },
  { slug: 'loja/carrinho', label: 'Carrinho', rota: '/loja/carrinho' },
  { slug: 'loja/checkout', label: 'Checkout', rota: '/loja/checkout' },
  { slug: 'minha-conta', label: 'Minha Conta', rota: '/minha-conta' },
];

const SLUGS_DISPONIVEIS = new Set(PAGINAS_DISPONIVEIS.map(p => p.slug));
const ROTAS_POR_SLUG = new Map(PAGINAS_DISPONIVEIS.map(p => [p.slug, p.rota]));

/** Rotas que nunca recebem tag, mesmo com "Todas as páginas" selecionado. */
const ROTAS_EXCLUIDAS = ['/admin', '/auth', '/api'];

/** A navegação pode receber tags? (admin/auth/api nunca recebem.) */
export function paginaPodeReceberTags(pathname: string): boolean {
  if (!pathname) return false;
  const caminho = normalizarPathname(pathname);
  return !ROTAS_EXCLUIDAS.some(r => caminho === r || caminho.startsWith(r + '/'));
}

const PADROES_IDENTIFICADOR: Record<GoogleTagTipo, RegExp | null> = {
  ga4: /^G-[A-Z0-9]{4,20}$/,
  google_ads: /^(?:AW|DC)-[A-Z0-9]{4,20}$/,
  gtm: /^GTM-[A-Z0-9]{4,20}$/,
  personalizado: null,
};

export const LIMITE_CODIGO_TAG = 50_000;
const LIMITE_NOME = 120;

/** Normaliza um pathname: sem query/hash, sem barras duplicadas ou finais. */
export function normalizarPathname(pathname: string): string {
  const semQuery = String(pathname || '').split(/[?#]/)[0];
  const colapsado = semQuery.replace(/\/{2,}/g, '/');
  const semBarraFinal = colapsado.replace(/\/+$/, '');
  return semBarraFinal || '/';
}

/** A tag deve entrar no <head> desta navegação? */
export function tagAplicaNaPagina(
  paginas: string[] | null | undefined,
  pathname: string,
): boolean {
  if (!Array.isArray(paginas) || paginas.length === 0) return false;
  if (!paginaPodeReceberTags(pathname)) return false;

  const caminho = normalizarPathname(pathname);

  return paginas.some(slug => {
    if (slug === 'todas') return true;
    const rota = ROTAS_POR_SLUG.get(slug);
    const base = rota && rota.startsWith('/') ? normalizarPathname(rota) : normalizarPathname('/' + String(slug).replace(/^\/+/, ''));
    if (base === '/') return caminho === '/';
    return caminho === base || caminho.startsWith(base + '/');
  });
}

/** Mantém apenas slugs conhecidos; ausente vira ["todas"], inválido vira []. */
export function sanitizarPaginas(valor: unknown): string[] {
  if (!Array.isArray(valor)) return ['todas'];
  const validos: string[] = [];
  for (const bruto of valor) {
    if (typeof bruto !== 'string') continue;
    const slug = bruto.trim();
    if (!SLUGS_DISPONIVEIS.has(slug)) continue;
    if (slug === 'todas') return ['todas'];
    if (!validos.includes(slug)) validos.push(slug);
  }
  return validos;
}

export function validarIdentificador(tipo: GoogleTagTipo, identificador: string): boolean {
  const padrao = PADROES_IDENTIFICADOR[tipo];
  if (!padrao) return true;
  return padrao.test(String(identificador || '').trim().toUpperCase());
}

/**
 * Normaliza o tipo "personalizado": aceita JavaScript puro ou um único
 * `<script>...</script>` (wrapper removido). Tags HTML não são aceitas —
 * o conteúdo é injetado como <script> no <head>, então precisa ser JS.
 */
export function normalizarCodigoPersonalizado(
  bruto: string
): { ok: true; js: string } | { ok: false; erro: string } {
  let codigo = String(bruto || '').trim();

  const wrapper = codigo.match(/^<script\b[^>]*>([\s\S]*)<\/script>$/i);
  if (wrapper) codigo = wrapper[1].trim();

  if (!codigo) {
    return { ok: false, erro: 'Cole o código JavaScript da tag personalizada.' };
  }
  if (/<\/script/i.test(codigo)) {
    return { ok: false, erro: 'O código não pode conter a tag de fechamento </script>.' };
  }
  if (/<\s*\/?\s*[a-zA-Z][a-zA-Z0-9-]*(\s|\/|>)|\s*<!/.test(codigo)) {
    return {
      ok: false,
      erro:
        'Use apenas JavaScript (sem tags HTML). Ao colar um snippet <script>...</script> completo, o wrapper é removido automaticamente.',
    };
  }
  return { ok: true, js: codigo };
}

export interface GoogleTagValidada {
  nome: string;
  tipo: GoogleTagTipo;
  identificador: string;
  codigo: string | null;
  paginas: string[];
  ativo: boolean;
  ordem: number;
}

export type ResultadoValidacaoTag =
  | { ok: true; valor: GoogleTagValidada }
  | { ok: false; erros: string[] };

/** Valida o objeto completo (após merge com o registro existente, no PUT). */
export function validarTagInput(input: Record<string, unknown>): ResultadoValidacaoTag {
  const erros: string[] = [];

  const nome = typeof input.nome === 'string' ? input.nome.trim() : '';
  if (!nome) erros.push('Informe o nome da tag.');
  else if (nome.length > LIMITE_NOME) erros.push(`O nome deve ter no máximo ${LIMITE_NOME} caracteres.`);

  const tipo = input.tipo as GoogleTagTipo;
  if (!TIPOS_GOOGLE_TAG.includes(tipo)) {
    return { ok: false, erros: [...erros, 'Tipo de tag inválido.'] };
  }

  const identificador =
    typeof input.identificador === 'string' ? input.identificador.trim().toUpperCase() : '';
  const codigoBruto = typeof input.codigo === 'string' ? input.codigo.trim() : '';

  let codigo: string | null = null;
  if (tipo === 'personalizado') {
    if (!codigoBruto) {
      erros.push('Cole o código JavaScript da tag personalizada.');
    } else if (codigoBruto.length > LIMITE_CODIGO_TAG) {
      erros.push(`O código deve ter no máximo ${LIMITE_CODIGO_TAG} caracteres.`);
    } else {
      const normalizado = normalizarCodigoPersonalizado(codigoBruto);
      if (!normalizado.ok) erros.push(normalizado.erro);
      else codigo = normalizado.js;
    }
  } else {
    if (codigoBruto) codigo = null;
    if (!validarIdentificador(tipo, identificador)) {
      erros.push('Identificador no formato inválido para o tipo escolhido (ex.: G-XXXX, AW-XXXX, GTM-XXXX).');
    }
  }

  const paginas = sanitizarPaginas(input.paginas);
  if (paginas.length === 0) {
    erros.push('Selecione pelo menos uma página (ou "Todas as páginas").');
  }

  let ativo = true;
  if (input.ativo !== undefined) {
    if (typeof input.ativo !== 'boolean') erros.push('O campo ativo deve ser verdadeiro ou falso.');
    else ativo = input.ativo;
  }
  const ordemBruta = Number(input.ordem ?? 0);
  const ordem = Number.isFinite(ordemBruta) ? Math.trunc(ordemBruta) : 0;

  if (erros.length > 0) return { ok: false, erros };
  return {
    ok: true,
    valor: {
      nome,
      tipo,
      identificador: tipo === 'personalizado' ? '' : identificador,
      codigo,
      paginas,
      ativo,
      ordem,
    },
  };
}

export type BlocoHead =
  | { id: string; tipo: 'script-src'; src: string }
  | { id: string; tipo: 'script-inline'; html: string }
  | { id: string; tipo: 'script-inline'; html: string };

/** Monta os blocos que entram entre <head></head>, preservando a ordem das tags. */
export function montarBlocosHead(tags: GoogleTag[]): BlocoHead[] {
  const blocos: BlocoHead[] = [];
  const gtagIds = tags
    .filter(
      t =>
        (t.tipo === 'ga4' || t.tipo === 'google_ads') &&
        validarIdentificador(t.tipo, t.identificador)
    )
    .map(t => t.identificador);

  let gtagEmitido = false;
  for (const t of tags) {
    if (t.tipo === 'ga4' || t.tipo === 'google_ads') {
      if (!validarIdentificador(t.tipo, t.identificador)) continue;
      if (gtagEmitido) continue;
      gtagEmitido = true;
      blocos.push({
        id: 'gtag-loader',
        tipo: 'script-src',
        src: `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gtagIds[0])}`,
      });
      const configs = gtagIds.map(id => `gtag('config', '${id}');`).join('\n');
      blocos.push({
        id: 'gtag-config',
        tipo: 'script-inline',
        html:
          'window.dataLayer = window.dataLayer || [];\n' +
          'function gtag(){dataLayer.push(arguments);}\n' +
          "gtag('js', new Date());\n" +
          configs,
      });
      continue;
    }

    if (t.tipo === 'gtm' && validarIdentificador('gtm', t.identificador)) {
      blocos.push({
        id: `gtm-${t.id}`,
        tipo: 'script-inline',
        html:
          "(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});" +
          "var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';" +
          "j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;" +
          `f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${t.identificador}');`,
      });
      continue;
    }

    if (t.tipo === 'personalizado' && t.codigo) {
      const normalizado = normalizarCodigoPersonalizado(t.codigo);
      if (normalizado.ok) {
        blocos.push({ id: `custom-${t.id}`, tipo: 'script-inline', html: normalizado.js });
      }
    }
  }

  return blocos;
}

export interface BlocoNoscript {
  id: string;
  gtmId: string;
}

/** Blocos que entram logo após a abertura do <body> (fallback do GTM sem JS). */
export function montarBlocosBody(tags: GoogleTag[]): BlocoNoscript[] {
  return tags
    .filter(t => t.tipo === 'gtm' && validarIdentificador('gtm', t.identificador))
    .map(t => ({ id: `gtm-noscript-${t.id}`, gtmId: t.identificador }));
}
