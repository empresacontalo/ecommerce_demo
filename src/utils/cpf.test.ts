import { describe, it, expect } from 'vitest';
import { validarCpf, formatarCpf } from '@/utils/cpf';

describe('validarCpf', () => {
  it('aceita CPF válido (formato com pontuação)', () => {
    expect(validarCpf('529.982.247-25')).toBe(true);
  });

  it('aceita CPF válido (somente dígitos)', () => {
    expect(validarCpf('52998224725')).toBe(true);
  });

  it('rejeita dígitos repetidos', () => {
    expect(validarCpf('111.111.111-11')).toBe(false);
    expect(validarCpf('000.000.000-00')).toBe(false);
  });

  it('rejeita primeiro dígito verificador errado', () => {
    expect(validarCpf('529.982.247-15')).toBe(false);
  });

  it('rejeita segundo dígito verificador errado', () => {
    expect(validarCpf('529.982.247-26')).toBe(false);
  });

  it('rejeita tamanho incorreto', () => {
    expect(validarCpf('123')).toBe(false);
    expect(validarCpf('123456789012')).toBe(false);
  });

  it('rejeita null/undefined/vazio', () => {
    expect(validarCpf(null)).toBe(false);
    expect(validarCpf(undefined)).toBe(false);
    expect(validarCpf('')).toBe(false);
  });
});

describe('formatarCpf', () => {
  it('formata 11 dígitos', () => {
    expect(formatarCpf('52998224725')).toBe('529.982.247-25');
  });

  it('formata parcialmente', () => {
    expect(formatarCpf('529')).toBe('529');
    expect(formatarCpf('529982')).toBe('529.982');
    expect(formatarCpf('529982247')).toBe('529.982.247');
  });

  it('ignora caracteres não numéricos', () => {
    expect(formatarCpf('529.982.247-25')).toBe('529.982.247-25');
  });
});
