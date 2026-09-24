import { describe, it, expect } from 'vitest';
import { clausulaOrdemMarcas, ordenarMarcasPorOrdem, MARCA_PADRAO, CHAVE_ORDEM_MARCAS } from './marcas-ordem';

describe('ordenarMarcasPorOrdem', () => {
  it('coloca a ordem configurada primeiro e o restante em A–Z depois', () => {
    const marcas = ['Armaf', 'French Avenue', 'Lattafa', 'Afnan'];
    expect(ordenarMarcasPorOrdem(marcas, ['Lattafa', 'Afnan'])).toEqual(['Lattafa', 'Afnan', 'Armaf', 'French Avenue']);
  });

  it('mantém apenas marcas existentes na lista (ignora ordens de marcas ausentes)', () => {
    const marcas = ['Lattafa', 'Zakat'];
    expect(ordenarMarcasPorOrdem(marcas, ['Orientica', 'Lattafa'])).toEqual(['Lattafa', 'Zakat']);
  });

  it('ordena por A–Z quando a marca não tem posição configurada', () => {
    const marcas = ['Zakat', 'Armaf', 'Afnan'];
    expect(ordenarMarcasPorOrdem(marcas, ['Lattafa'])).toEqual(['Afnan', 'Armaf', 'Zakat']);
  });
});

describe('clausulaOrdemMarcas', () => {
  it('gera cláusula com array_position quando há ordem configurada', () => {
    const cl = clausulaOrdemMarcas(['Lattafa', 'Afnan']);
    expect(cl.sql(2)).toBe('ORDER BY array_position($2::text[], origin) NULLS LAST, name ASC');
    expect(cl.destaque).toEqual(['Lattafa', 'Afnan']);
  });

  it('destaque deve ser transmitido como UM único parâmetro (array), não por spread', () => {
    // Contrato dos callers: `params.push(clausula.destaque)` — o pg recebe 1
    // param do tipo text[]; espalhar (push(...destaque)) quebra o bind.
    const cl = clausulaOrdemMarcas(['Lattafa', 'Afnan', 'Armaf']);
    const params: unknown[] = ['algum-exclude'];
    params.push(cl.destaque);
    expect(params.length).toBe(2);
    expect(params[1]).toEqual(['Lattafa', 'Afnan', 'Armaf']);
    expect(Array.isArray(params[1])).toBe(true);
  });

  it('gera cláusula com CASE pondo a marca padrão em primeiro quando não há ordem', () => {
    const cl = clausulaOrdemMarcas([]);
    expect(cl.sql(1)).toBe(`ORDER BY CASE WHEN origin = '${MARCA_PADRAO}' THEN 0 ELSE 1 END, name ASC`);
  });

  it('permite outra marca padrão (fallback flexível)', () => {
    const cl = clausulaOrdemMarcas([], 'Outra');
    expect(cl.sql(1)).toContain("origin = 'Outra'");
  });

  it('expõe constante da chave de configuração', () => {
    expect(CHAVE_ORDEM_MARCAS).toBe('catalogo.ordem_marcas');
    expect(MARCA_PADRAO).toBe('Lattafa');
  });
});