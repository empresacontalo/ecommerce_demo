import { describe, expect, it } from 'vitest';
import { compactarPayload, descompactarPayload, TABELAS_CONTEUDO } from './backups';

describe('backups helpers', () => {
  const payload = {
    versao: 1,
    criado_em: '2026-08-18T00:00:00.000Z',
    tabelas: { paginas: [{ id: 'a', slug: 'x', titulo: 'X' }] },
  };

  it('compacta e descompacta preservando os dados', () => {
    const buf = compactarPayload(payload as never);
    expect(buf.length).toBeGreaterThan(0);
    const voltou = descompactarPayload(buf);
    expect(voltou).toEqual(payload);
  });

  it('aceita JSON sem compactação', () => {
    const json = Buffer.from(JSON.stringify(payload));
    expect(descompactarPayload(json)).toEqual(payload);
  });

  it('rejeita conteúdo inválido', () => {
    expect(() => descompactarPayload(Buffer.from('não é json'))).toThrow();
  });

  it('cobre as tabelas de conteúdo do site', () => {
    expect(TABELAS_CONTEUDO).toEqual(expect.arrayContaining([
      'paginas', 'blocos', 'configuracoes', 'depoimentos', 'galeria',
      'campanhas', 'produtos', 'leads', 'agendamentos', 'orders',
    ]));
  });
});