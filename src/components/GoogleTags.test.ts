import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GoogleTagsHead, GoogleTagsBody } from './GoogleTags';
import type { GoogleTag } from '@/lib/google-tags';

const tag = (over: Partial<GoogleTag> = {}): GoogleTag => ({
  id: 'tag-1',
  nome: 'GA4 principal',
  tipo: 'ga4',
  identificador: 'G-8KJZC5J14S',
  codigo: null,
  paginas: ['todas'],
  ativo: true,
  ordem: 0,
  ...over,
});

describe('GoogleTagsHead (render SSR)', () => {
  it('GA4 gera <script src> com o ID e o script inline de config', () => {
    const html = renderToStaticMarkup(GoogleTagsHead({ tags: [tag()] }));

    expect(html).toContain('async=""');
    expect(html).toContain('src="https://www.googletagmanager.com/gtag/js?id=G-8KJZC5J14S"');
    expect(html).toContain("gtag('config', 'G-8KJZC5J14S')");
  });

  it('personalizado vira um único <script> com JavaScript (sem aninhar <script>)', () => {
    const html = renderToStaticMarkup(
      GoogleTagsHead({
        tags: [tag({ tipo: 'personalizado', identificador: '', codigo: 'console.log("ok")' })],
      })
    );

    expect(html).toBe('<script>console.log("ok")</script>');
    expect(html.match(/<script/g)).toHaveLength(1);
  });

  it('personalizado gravado com wrapper <script> no banco não gera script aninhado', () => {
    const html = renderToStaticMarkup(
      GoogleTagsHead({
        tags: [tag({ tipo: 'personalizado', identificador: '', codigo: '<script>window.x=1</script>' })],
      })
    );

    expect(html).toBe('<script>window.x=1</script>');
  });

  it('GTM gera o loader inline com o ID do contêiner', () => {
    const html = renderToStaticMarkup(
      GoogleTagsHead({ tags: [tag({ tipo: 'gtm', identificador: 'GTM-XYZ123' })] })
    );

    expect(html).toContain('GTM-XYZ123');
    expect(html).toContain('googletagmanager.com/gtm.js');
  });

  it('sem tags não renderiza nada', () => {
    expect(renderToStaticMarkup(GoogleTagsHead({ tags: [] }))).toBe('');
  });
});

describe('GoogleTagsBody (render SSR)', () => {
  it('GTM gera <noscript> com iframe; GA4 não gera nada', () => {
    const htmlGtm = renderToStaticMarkup(
      GoogleTagsBody({ tags: [tag({ tipo: 'gtm', identificador: 'GTM-XYZ123' })] })
    );
    expect(htmlGtm).toContain('<noscript>');
    expect(htmlGtm).toContain('googletagmanager.com/ns.html?id=GTM-XYZ123');

    const htmlGa4 = renderToStaticMarkup(GoogleTagsBody({ tags: [tag()] }));
    expect(htmlGa4).toBe('');
  });
});
