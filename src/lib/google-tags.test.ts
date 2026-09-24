import { describe, it, expect } from 'vitest';
import {
  normalizarPathname,
  paginaPodeReceberTags,
  tagAplicaNaPagina,
  sanitizarPaginas,
  validarIdentificador,
  validarTagInput,
  montarBlocosHead,
  montarBlocosBody,
  PAGINAS_DISPONIVEIS,
  type GoogleTag,
} from './google-tags';

const tag = (over: Partial<GoogleTag> = {}): GoogleTag => ({
  id: 'tag-1',
  nome: 'GA4 principal',
  tipo: 'ga4',
  identificador: 'G-ABC1234567',
  codigo: null,
  paginas: ['todas'],
  ativo: true,
  ordem: 0,
  ...over,
});

describe('normalizarPathname', () => {
  it('remove barra final e normaliza barras duplicadas', () => {
    expect(normalizarPathname('/catalogo/')).toBe('/catalogo');
    expect(normalizarPathname('//catalogo///produto//x/')).toBe('/catalogo/produto/x');
  });

  it('mantém a raiz como /', () => {
    expect(normalizarPathname('/')).toBe('/');
    expect(normalizarPathname('')).toBe('/');
  });

  it('descarta query string e hash', () => {
    expect(normalizarPathname('/catalogo?busca=perfume#topo')).toBe('/catalogo');
  });
});

describe('tagAplicaNaPagina', () => {
  it('todas aplica em qualquer página pública', () => {
    expect(tagAplicaNaPagina(['todas'], '/')).toBe(true);
    expect(tagAplicaNaPagina(['todas'], '/catalogo/produto/abc')).toBe(true);
  });

  it('home só aplica na raiz', () => {
    expect(tagAplicaNaPagina(['home'], '/')).toBe(true);
    expect(tagAplicaNaPagina(['home'], '/sobre')).toBe(false);
  });

  it('slug cobre a própria página e subpáginas (catálogo inclui produto)', () => {
    expect(tagAplicaNaPagina(['catalogo'], '/catalogo')).toBe(true);
    expect(tagAplicaNaPagina(['catalogo'], '/catalogo/')).toBe(true);
    expect(tagAplicaNaPagina(['catalogo'], '/catalogo/produto/perfume-x')).toBe(true);
    expect(tagAplicaNaPagina(['catalogo'], '/catalogox')).toBe(false);
  });

  it('várias páginas: aplica se qualquer uma casar', () => {
    expect(tagAplicaNaPagina(['sobre', 'galeria'], '/galeria')).toBe(true);
    expect(tagAplicaNaPagina(['sobre', 'galeria'], '/contato')).toBe(false);
  });

  it('nunca injeta em admin/auth', () => {
    expect(tagAplicaNaPagina(['todas'], '/admin/trafego-pago')).toBe(false);
    expect(tagAplicaNaPagina(['todas'], '/auth/login')).toBe(false);
  });

  it('lista vazia ou inválida não aplica', () => {
    expect(tagAplicaNaPagina([], '/')).toBe(false);
    expect(tagAplicaNaPagina(null, '/')).toBe(false);
    expect(tagAplicaNaPagina(undefined, '/')).toBe(false);
  });
});

describe('paginaPodeReceberTags', () => {
  it('libera páginas públicas e bloqueia admin/auth/api (inclusive vazio)', () => {
    expect(paginaPodeReceberTags('/')).toBe(true);
    expect(paginaPodeReceberTags('/catalogo/produto/x')).toBe(true);
    expect(paginaPodeReceberTags('/admin/trafego-pago')).toBe(false);
    expect(paginaPodeReceberTags('/auth/login')).toBe(false);
    expect(paginaPodeReceberTags('/api/ready')).toBe(false);
    expect(paginaPodeReceberTags('')).toBe(false);
  });
});

describe('sanitizarPaginas', () => {
  it('mantém apenas slugs conhecidos e remove duplicados', () => {
    expect(sanitizarPaginas(['sobre', 'sobre', 'catalogo', 'inexistente'])).toEqual(['sobre', 'catalogo']);
  });

  it('todas tem prioridade e zera as demais', () => {
    expect(sanitizarPaginas(['sobre', 'todas'])).toEqual(['todas']);
  });

  it('ausente/ não-array vira todas; lista vazia ou só inválidos vira []', () => {
    expect(sanitizarPaginas(null)).toEqual(['todas']);
    expect(sanitizarPaginas('sobre')).toEqual(['todas']);
    expect(sanitizarPaginas([])).toEqual([]);
    expect(sanitizarPaginas(['inexistente'])).toEqual([]);
  });

  it('catálogo de páginas expõe todas + rotas reais', () => {
    const slugs = PAGINAS_DISPONIVEIS.map(p => p.slug);
    expect(slugs).toContain('todas');
    expect(slugs).toContain('home');
    expect(slugs).toContain('catalogo');
    expect(slugs).toContain('loja/checkout');
  });
});

describe('validarIdentificador', () => {
  it('aceita IDs válidos por tipo', () => {
    expect(validarIdentificador('ga4', 'G-8KJZC5J14S')).toBe(true);
    expect(validarIdentificador('gtm', 'GTM-ABC123')).toBe(true);
    expect(validarIdentificador('google_ads', 'AW-123456789')).toBe(true);
    expect(validarIdentificador('google_ads', 'DC-123456789')).toBe(true);
  });

  it('rejeita ID de outro tipo ou malformado', () => {
    expect(validarIdentificador('ga4', 'GTM-ABC123')).toBe(false);
    expect(validarIdentificador('ga4', 'G-')).toBe(false);
    expect(validarIdentificador('gtm', 'G-ABC123')).toBe(false);
    expect(validarIdentificador('google_ads', 'G-ABC123')).toBe(false);
    expect(validarIdentificador('personalizado', 'qualquer')).toBe(true);
  });
});

describe('validarTagInput', () => {
  const base = {
    nome: 'GA4 principal',
    tipo: 'ga4' as const,
    identificador: 'g-8kjzc5j14s',
    codigo: null,
    paginas: ['todas'],
    ativo: true,
    ordem: 0,
  };

  it('normaliza identificador para maiúsculas', () => {
    const r = validarTagInput(base);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor.identificador).toBe('G-8KJZC5J14S');
  });

  it('exige nome', () => {
    const r = validarTagInput({ ...base, nome: '  ' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.join(' ')).toMatch(/nome/i);
  });

  it('exige identificador no formato do tipo', () => {
    const r = validarTagInput({ ...base, identificador: 'G-ABC' });
    expect(r.ok).toBe(false);
  });

  it('tipo personalizado exige código e dispensa identificador', () => {
    const semCodigo = validarTagInput({ ...base, tipo: 'personalizado', identificador: '' });
    expect(semCodigo.ok).toBe(false);

    const comCodigo = validarTagInput({
      ...base,
      tipo: 'personalizado',
      identificador: '',
      codigo: '<script>console.log("ok")</script>',
    });
    expect(comCodigo.ok).toBe(true);
    if (comCodigo.ok) {
      expect(comCodigo.valor.tipo).toBe('personalizado');
      expect(comCodigo.valor.codigo).toBe('console.log("ok")');
    }
  });

  it('personalizado rejeita tags HTML (só JavaScript é aceito)', () => {
    const r = validarTagInput({
      ...base,
      tipo: 'personalizado',
      identificador: '',
      codigo: '<meta name="google-site-verification" content="x">',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.join(' ')).toMatch(/JavaScript/i);
  });

  it('rejeita lista de páginas totalmente inválida', () => {
    const r = validarTagInput({ ...base, paginas: ['hacker'] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.join(' ')).toMatch(/página/i);
  });

  it('rejeita ativo não-booleano', () => {
    const r = validarTagInput({ ...base, ativo: 'false' });
    expect(r.ok).toBe(false);
  });

  it('rejeita código gigante', () => {
    const r = validarTagInput({
      ...base,
      tipo: 'personalizado',
      identificador: '',
      codigo: 'x'.repeat(60_000),
    });
    expect(r.ok).toBe(false);
  });

  it('sanitiza páginas desconhecidas', () => {
    const r = validarTagInput({ ...base, paginas: ['home', 'hacker'] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor.paginas).toEqual(['home']);
  });

  it('rejeita tipo desconhecido', () => {
    const r = validarTagInput({ ...base, tipo: 'facebook_pixel' });
    expect(r.ok).toBe(false);
  });
});

describe('montarBlocosHead', () => {
  it('GA4 gera loader gtag + config', () => {
    const blocos = montarBlocosHead([tag()]);
    const src = blocos.find(b => b.tipo === 'script-src');
    expect(src).toBeTruthy();
    if (src && src.tipo === 'script-src') {
      expect(src.src).toContain('googletagmanager.com/gtag/js');
      expect(src.src).toContain('G-ABC1234567');
    }
    const inline = blocos.find(b => b.tipo === 'script-inline');
    expect(inline).toBeTruthy();
    if (inline && inline.tipo === 'script-inline') {
      expect(inline.html).toContain("gtag('config', 'G-ABC1234567')");
      expect(inline.html).toContain('dataLayer');
    }
  });

  it('GA4 + Google Ads compartilham um único loader e configuram os dois', () => {
    const blocos = montarBlocosHead([
      tag(),
      tag({ id: 'tag-2', tipo: 'google_ads', identificador: 'AW-123456789' }),
    ]);
    const loaders = blocos.filter(b => b.tipo === 'script-src');
    expect(loaders).toHaveLength(1);
    const inline = blocos.find(b => b.tipo === 'script-inline');
    if (inline && inline.tipo === 'script-inline') {
      expect(inline.html).toContain("gtag('config', 'G-ABC1234567')");
      expect(inline.html).toContain("gtag('config', 'AW-123456789')");
    }
  });

  it('GTM gera o loader oficial com o ID', () => {
    const blocos = montarBlocosHead([tag({ tipo: 'gtm', identificador: 'GTM-XYZ123' })]);
    expect(blocos).toHaveLength(1);
    const b = blocos[0];
    expect(b.tipo).toBe('script-inline');
    if (b.tipo === 'script-inline') {
      expect(b.html).toContain('GTM-XYZ123');
      expect(b.html).toContain('googletagmanager.com/gtm.js');
    }
  });

  it('personalizado emite JavaScript normalizado (nunca HTML cru)', () => {
    const blocos = montarBlocosHead([
      tag({ tipo: 'personalizado', identificador: '', codigo: '<script>window.x=1</script>' }),
    ]);
    expect(blocos).toHaveLength(1);
    expect(blocos[0].tipo).toBe('script-inline');
    if (blocos[0].tipo === 'script-inline') {
      expect(blocos[0].html).toBe('window.x=1');
      expect(blocos[0].html).not.toContain('<script');
    }
  });

  it('ignora personalizado inválido (HTML) e identificador fora do padrão', () => {
    const blocos = montarBlocosHead([
      tag({ id: 'a', tipo: 'personalizado', identificador: '', codigo: '<div>x</div>' }),
      tag({ id: 'b', tipo: 'ga4', identificador: 'G-XX' }),
      tag({ id: 'c', tipo: 'gtm', identificador: 'qualquer-coisa' }),
    ]);
    expect(blocos).toHaveLength(0);
  });

  it('mantém a ordem de entrada das tags', () => {
    const blocos = montarBlocosHead([
      tag({ id: 'a', tipo: 'personalizado', identificador: '', codigo: 'window.a=1' }),
      tag({ id: 'b', tipo: 'gtm', identificador: 'GTM-AAA111' }),
    ]);
    expect(blocos.map(b => b.id)).toEqual(['custom-a', 'gtm-b']);
  });
});

describe('montarBlocosBody', () => {
  it('GTM gera noscript com iframe; outras tags não geram', () => {
    const blocos = montarBlocosBody([
      tag(),
      tag({ id: 'tag-2', tipo: 'gtm', identificador: 'GTM-XYZ123' }),
    ]);
    expect(blocos).toHaveLength(1);
    expect(blocos[0].gtmId).toBe('GTM-XYZ123');
  });
});
