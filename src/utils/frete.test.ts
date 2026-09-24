import { describe, it, expect } from 'vitest';
import {
  calcularFreteMotoboy, motoboyDisponivel, parseTabelaMotoboy,
  MOTOBOY_PRAIA_GRANDE, MOTOBOY_SAO_VICENTE, MOTOBOY_SANTOS,
} from './frete';

describe('calcularFreteMotoboy', () => {
  it('Praia Grande (SP) → R$ 15 (padrão)', () => {
    expect(calcularFreteMotoboy('Praia Grande', 'SP')).toEqual({ disponivel: true, valor: MOTOBOY_PRAIA_GRANDE, municipio: 'Praia Grande' });
  });

  it('São Vicente (SP) → R$ 25 (padrão)', () => {
    expect(calcularFreteMotoboy('São Vicente', 'SP')).toEqual({ disponivel: true, valor: MOTOBOY_SAO_VICENTE, municipio: 'São Vicente' });
  });

  it('Santos (SP) → R$ 35 (padrão)', () => {
    expect(calcularFreteMotoboy('Santos', 'SP')).toEqual({ disponivel: true, valor: MOTOBOY_SANTOS, municipio: 'Santos' });
  });

  it('aceita variações de caixa e acentos (cidade) e UF minúscula', () => {
    expect(calcularFreteMotoboy('SAO VICENTE', 'sp').valor).toBe(MOTOBOY_SAO_VICENTE);
    expect(calcularFreteMotoboy('santos', 'sp').valor).toBe(MOTOBOY_SANTOS);
  });

  it('município fora da área → não disponível', () => {
    expect(calcularFreteMotoboy('Guarujá', 'SP').disponivel).toBe(false);
    expect(calcularFreteMotoboy('Praia Grande do Norte', 'RN').disponivel).toBe(false);
    expect(calcularFreteMotoboy('Cubatão', 'SP').disponivel).toBe(false);
    expect(calcularFreteMotoboy('', 'SP').disponivel).toBe(false);
    expect(calcularFreteMotoboy(null, null).disponivel).toBe(false);
  });

  it('mesmo nome de cidade em outro estado → não disponível quando UF explícita', () => {
    expect(calcularFreteMotoboy('Santos', 'PR').disponivel).toBe(false);
  });

  it('motoboyDisponivel é o atalho booleano', () => {
    expect(motoboyDisponivel('Praia Grande', 'SP')).toBe(true);
    expect(motoboyDisponivel('Rio de Janeiro', 'RJ')).toBe(false);
  });
});

describe('Tabela configurável (frete.motoboy)', () => {
  const tabelaCustom = { 'guaruja': 40, 'cubatao': 20 };

  it('usa a tabela recebida em vez da padrão', () => {
    expect(calcularFreteMotoboy('Guarujá', 'SP', tabelaCustom)).toEqual({ disponivel: true, valor: 40, municipio: 'Guarujá' });
    expect(calcularFreteMotoboy('Cubatão', 'SP', tabelaCustom)).toEqual({ disponivel: true, valor: 20, municipio: 'Cubatão' });
    // Praia Grande não está na tabela custom → indisponível
    expect(calcularFreteMotoboy('Praia Grande', 'SP', tabelaCustom).disponivel).toBe(false);
  });

  it('parseTabelaMotoboy: converte array [{cidade, valor}]', () => {
    expect(parseTabelaMotoboy([{ cidade: 'Praia Grande', valor: 15 }, { cidade: 'São Vicente', valor: '25' }]))
      .toEqual({ 'praia grande': 15, 'sao vicente': 25 });
  });

  it('parseTabelaMotoboy: aceita objeto chave:valor', () => {
    expect(parseTabelaMotoboy({ 'Santos': 35, 'Cubatão': 20 }))
      .toEqual({ santos: 35, 'cubatao': 20 });
  });

  it('parseTabelaMotoboy: retorna null para inválidos/vazios', () => {
    expect(parseTabelaMotoboy(null)).toBeNull();
    expect(parseTabelaMotoboy('texto')).toBeNull();
    expect(parseTabelaMotoboy([])).toBeNull();
    expect(parseTabelaMotoboy([{ cidade: '', valor: 10 }])).toBeNull();
  });

  it('entrada com valor 0 (motoboy grátis) é válida', () => {
    expect(calcularFreteMotoboy('Santos', 'SP', { santos: 0 })).toEqual({ disponivel: true, valor: 0, municipio: 'Santos' });
  });
});