import { describe, it, expect } from 'vitest';
import {
  gerarCodigoCupom,
  parseDescontoPercent,
  produtoElegivel,
  calcularDescontoCupom,
  LIMITE_CODIGO_CUPOM,
} from './cupons';

describe('gerarCodigoCupom', () => {
  it('gera código a partir do título, uppercase, sem acentos/espaços', () => {
    expect(gerarCodigoCupom('Dia dos Pais 2026')).toBe('DIADOSPAIS2026');
  });

  it('limita ao máximo de 16 caracteres', () => {
    expect(gerarCodigoCupom('Promoção Especial de Verão São Paulo').length).toBeLessThanOrEqual(LIMITE_CODIGO_CUPOM);
    expect(gerarCodigoCupom('12345678901234567890').length).toBe(16);
  });

  it('remove acentos e símbolos', () => {
    expect(gerarCodigoCupom('Ação & Cupom #1!')).toBe('ACAOCUPOM1');
  });

  it('tem fallback quando o título não gera letras/números', () => {
    expect(gerarCodigoCupom('***')).toBe('CUPOM');
    expect(gerarCodigoCupom('')).toBe('CUPOM');
  });
});

describe('parseDescontoPercent', () => {
  it('extrai percentual de texto com %', () => {
    expect(parseDescontoPercent('15%')).toBe(15);
  });

  it('aceita vírgula e decimais', () => {
    expect(parseDescontoPercent('12,5%')).toBe(12.5);
    expect(parseDescontoPercent('10')).toBe(10);
  });

  it('retorna 0 para vazio/inválido', () => {
    expect(parseDescontoPercent(null)).toBe(0);
    expect(parseDescontoPercent('')).toBe(0);
    expect(parseDescontoPercent('abc')).toBe(0);
  });
});

describe('produtoElegivel', () => {
  const base = { escopo: 'todos' as const, marca: null, produtos: [] };

  it('escopo todos: qualquer produto é elegível', () => {
    expect(produtoElegivel('Lattafa', 'p1', base)).toBe(true);
    expect(produtoElegivel(null, 'p2', base)).toBe(true);
  });

  it('escopo marca: só produtos da marca (case-insensitive)', () => {
    const cupom = { escopo: 'marca' as const, marca: 'Lattafa', produtos: [] };
    expect(produtoElegivel('Lattafa', 'p1', cupom)).toBe(true);
    expect(produtoElegivel('lattafa', 'p2', cupom)).toBe(true);
    expect(produtoElegivel('Armaf', 'p3', cupom)).toBe(false);
  });

  it('escopo produtos: só os da lista', () => {
    const cupom = { escopo: 'produtos' as const, marca: null, produtos: ['a', 'b'] };
    expect(produtoElegivel('Lattafa', 'a', cupom)).toBe(true);
    expect(produtoElegivel('Qualquer', 'c', cupom)).toBe(false);
  });
});

describe('calcularDescontoCupom', () => {
  const itens = [
    { id: 'p1', origin: 'Lattafa', price: 100, quantity: 2 }, // 200
    { id: 'p2', origin: 'Armaf', price: 50, quantity: 1 }, // 50
  ];

  it('escopo todos: desconto sobre todo o subtotal', () => {
    const cupom = { codigo: 'X', descontoPercent: 15, escopo: 'todos' as const, marca: null, produtos: [] };
    const r = calcularDescontoCupom(itens, cupom);
    expect(r.subtotalElegivel).toBe(250);
    expect(r.descontoValor).toBe(37.5);
  });

  it('escopo marca: desconto só sobre itens da marca', () => {
    const cupom = { codigo: 'X', descontoPercent: 10, escopo: 'marca' as const, marca: 'Armaf', produtos: [] };
    const r = calcularDescontoCupom(itens, cupom);
    expect(r.subtotalElegivel).toBe(50);
    expect(r.descontoValor).toBe(5);
  });

  it('escopo produtos: desconto só sobre os listados', () => {
    const cupom = { codigo: 'X', descontoPercent: 20, escopo: 'produtos' as const, marca: null, produtos: ['p1'] };
    const r = calcularDescontoCupom(itens, cupom);
    expect(r.subtotalElegivel).toBe(200);
    expect(r.descontoValor).toBe(40);
  });

  it('clamp de percentual fora de 0–100', () => {
    const cupom = { codigo: 'X', descontoPercent: 200, escopo: 'todos' as const, marca: null, produtos: [] };
    expect(calcularDescontoCupom(itens, cupom).descontoValor).toBe(250);
  });
});