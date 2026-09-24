import { describe, expect, it, afterEach } from 'vitest';
import { gerarToken, hashToken, criptografarToken, descriptografarToken, expiracaoPorDuracao } from './tokens';

describe('mcp tokens helpers', () => {
  afterEach(() => { delete process.env.MCP_ADMIN_TOKEN; delete process.env.CRON_SECRET; });

  it('gera token em hex com 64 caracteres', () => {
    const t = gerarToken();
    expect(t).toMatch(/^[0-9a-f]{64}$/);
    expect(t).not.toBe(gerarToken());
  });

  it('criptografa/descriptografa mantendo o texto original', () => {
    process.env.MCP_ADMIN_TOKEN = 'chave-teste';
    const token = gerarToken();
    const enc = criptografarToken(token);
    expect(enc).not.toContain(token);
    expect(descriptografarToken(enc)).toBe(token);
  });

  it('hash não expõe o token', () => {
    const token = gerarToken();
    const h = hashToken(token);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain(token);
  });

  it('calcula expiração por duração (1m/3m/12m/never)', () => {
    const agora = Date.now();
    expect(expiracaoPorDuracao('1m')!.getTime()).toBeGreaterThan(agora);
    expect(expiracaoPorDuracao('3m')!.getTime()).toBeGreaterThan(agora);
    expect(expiracaoPorDuracao('12m')!.getTime()).toBeGreaterThan(agora);
    expect(expiracaoPorDuracao('never')).toBeNull();
    expect(() => expiracaoPorDuracao('2m')).toThrow();
  });
});