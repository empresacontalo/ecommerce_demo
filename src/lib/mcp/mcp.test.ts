import { describe, expect, it } from 'vitest';
import { isMCPAuthorized } from './auth';
import { createMcpServer } from './server';

describe('mcp auth', () => {
  it('recusa sem token configurado', async () => {
    delete process.env.MCP_ADMIN_TOKEN;
    const req = new Request('https://x/api/mcp', {
      headers: { authorization: 'Bearer abc' },
    });
    expect((await isMCPAuthorized(req)).ok).toBe(false);
  });

  it('aceita token correto e recusa inválido', async () => {
    process.env.MCP_ADMIN_TOKEN = 'token-secreto';
    const ok = new Request('https://x/api/mcp', {
      headers: { authorization: 'Bearer token-secreto' },
    });
    const bad = new Request('https://x/api/mcp', {
      headers: { authorization: 'Bearer errado' },
    });
    const none = new Request('https://x/api/mcp');
    expect((await isMCPAuthorized(ok)).ok).toBe(true);
    expect((await isMCPAuthorized(ok)).escopo).toBe('admin');
    expect((await isMCPAuthorized(bad)).ok).toBe(false);
    expect((await isMCPAuthorized(none)).ok).toBe(false);
    delete process.env.MCP_ADMIN_TOKEN;
  });
});

describe('mcp server', () => {
  it('registra as ferramentas do painel', () => {
    process.env.MCP_ADMIN_TOKEN = 'x';
    const server = createMcpServer();
    const registered = (server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools;
    const names = Object.keys(registered);
    expect(names.length).toBeGreaterThan(10);
    expect(names).toEqual(expect.arrayContaining([
      'listar_paginas',
      'criar_ou_atualizar_bloco',
      'salvar_configuracao',
      'criar_produto',
      'listar_agendamentos',
      'atualizar_status_lead',
      'dashboard_resumo',
      'ler_ambiente',
    ]));
  });
});