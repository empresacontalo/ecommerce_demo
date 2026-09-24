import { describe, it, expect } from 'vitest';
import { rotuloConfiguracao, capturarInfoDispositivo, purgarAuditLogs } from './audit';

describe('rotuloConfiguracao', () => {
  it('não revela chaves sensíveis de pagamento', () => {
    expect(rotuloConfiguracao('pagamento.api_key')).toBe('meio de pagamento');
    expect(rotuloConfiguracao('pagamento.webhook_token')).toBe('meio de pagamento');
  });

  it('não revela chaves do chatwoot', () => {
    expect(rotuloConfiguracao('chatwoot.token')).toBe('atendimento on-line');
  });

  it('mapeia chaves conhecidas para rótulos amigáveis', () => {
    expect(rotuloConfiguracao('header.logo')).toBe('logotipo');
    expect(rotuloConfiguracao('whatsapp.numero')).toBe('número do WhatsApp');
    expect(rotuloConfiguracao('footer.horario')).toBe('horários de funcionamento');
    expect(rotuloConfiguracao('catalogo.ordem_marcas')).toBe('ordem de exibição das marcas no catálogo');
  });

  it('retorna rótulo genérico para chaves desconhecidas (sem expor a chave)', () => {
    expect(rotuloConfiguracao('segredo.muito.secreto')).toBe('configuração interna');
  });
});

describe('capturarInfoDispositivo', () => {
  it('extrai IP do x-forwarded-for (primeiro da cadeia)', () => {
    const req = new Request('http://localhost/api/x', {
      headers: { 'x-forwarded-for': '189.10.20.30, 10.0.0.1', 'user-agent': 'Mozilla/5.0' },
    });
    expect(capturarInfoDispositivo(req).ip).toBe('189.10.20.30');
  });

  it('identifica navegador e sistema operacional pelo User-Agent', () => {
    const casos: Array<[string, string, string]> = [
      ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', 'Chrome', 'Windows 10/11'],
      ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15', 'Safari', 'macOS'],
      ['Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0', 'Firefox', 'Windows 10/11'],
      ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36', 'Chrome', 'Android'],
      ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148', 'Safari (iOS)', 'iOS'],
    ];
    for (const [ua, navegador, so] of casos) {
      const req = new Request('http://localhost/api/x', { headers: { 'user-agent': ua } });
      const info = capturarInfoDispositivo(req);
      expect(info.navegador).toBe(navegador);
      expect(info.sistema_operacional).toBe(so);
    }
  });

  it('trata chamadas de ferramentas/IA', () => {
    const req = new Request('http://localhost/api/mcp', {
      headers: { 'user-agent': 'claude-ai/1.0' },
    });
    const info = capturarInfoDispositivo(req);
    expect(info.navegador).toBe('Cliente de IA');
  });
});

describe('purgarAuditLogs', () => {
  it('não lança exceção sem banco disponível', async () => {
    const resultado = await purgarAuditLogs();
    expect(resultado).toBe(0);
  });
});