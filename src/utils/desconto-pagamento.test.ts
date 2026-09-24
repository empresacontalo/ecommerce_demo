import { describe, it, expect } from 'vitest';
import {
  normalizarFormaPagamento,
  percentDescontoEfetivo,
  calcularDescontoFormaPagamento,
  calcularPrecoComDesconto,
} from './desconto-pagamento';

describe('normalizarFormaPagamento', () => {
  it('reconhece pix, credit (cartao) e boleto, case-insensitive', () => {
    expect(normalizarFormaPagamento('pix')).toBe('pix');
    expect(normalizarFormaPagamento('PIX')).toBe('pix');
    expect(normalizarFormaPagamento('credit')).toBe('credit');
    expect(normalizarFormaPagamento('cartao')).toBe('credit');
    expect(normalizarFormaPagamento('boleto')).toBe('boleto');
  });

  it('retorna null para forma desconhecida/vazia', () => {
    expect(normalizarFormaPagamento('')).toBeNull();
    expect(normalizarFormaPagamento(null)).toBeNull();
    expect(normalizarFormaPagamento('outra-coisa')).toBeNull();
  });
});

describe('percentDescontoEfetivo', () => {
  it('usa desconto geral quando o produto não define', () => {
    expect(percentDescontoEfetivo('pix', { pix: 5 }, null)).toBe(5);
  });

  it('usa desconto do produto quando maior que o geral', () => {
    expect(percentDescontoEfetivo('pix', { pix: 5 }, { pix: 8 })).toBe(8);
  });

  it('aplica o MAIOR entre geral e produto', () => {
    expect(percentDescontoEfetivo('pix', { pix: 9 }, { pix: 3 })).toBe(9);
    expect(percentDescontoEfetivo('credit', { credit: 2 }, { credit: 7 })).toBe(7);
  });

  it('rejeita negativos e clampa a 100', () => {
    expect(percentDescontoEfetivo('pix', { pix: -5 }, null)).toBe(0);
    expect(percentDescontoEfetivo('pix', { pix: 150 }, null)).toBe(100);
  });
});

describe('calcularDescontoFormaPagamento', () => {
  const itens = [
    { id: 'a', price: 100, quantity: 2, descontos: { pix: 10 } }, // 200 * 10%
    { id: 'b', price: 50, quantity: 1, descontos: null }, // 50 * (geral 5%) = 2.5
  ];

  it('soma desconto por item respeitando o maior(geral, produto)', () => {
    const r = calcularDescontoFormaPagamento(itens, 'pix', { pix: 5 });
    expect(r.descontoForma).toBe(22.5); // 20 + 2.5
  });

  it('desconto zero para forma sem percentual', () => {
    expect(calcularDescontoFormaPagamento(itens, 'credit', { credit: 0 }).descontoForma).toBe(0);
  });

  it('desconto zero para forma desconhecida ou ausente', () => {
    expect(calcularDescontoFormaPagamento(itens, null, { pix: 5 }).descontoForma).toBe(0);
    expect(calcularDescontoFormaPagamento(itens, 'outra', { pix: 5 }).descontoForma).toBe(0);
  });
});

describe('calcularPrecoComDesconto', () => {
  it('calcula preço com desconto do produto (página do produto)', () => {
    const r = calcularPrecoComDesconto(100, 'pix', { pix: 5 }, { pix: 8 });
    expect(r.percent).toBe(8);
    expect(r.precoComDesconto).toBe(92);
  });

  it('sem desconto → preço cheio', () => {
    expect(calcularPrecoComDesconto(100, 'boleto', { boleto: 0 }, null).precoComDesconto).toBe(100);
  });
});