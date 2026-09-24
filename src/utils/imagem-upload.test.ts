import { describe, it, expect } from 'vitest';
import { decodificarDataUri, ehIpPrivado, hostnameResolvePrivado } from './imagem-upload';

describe('decodificarDataUri', () => {
  it('decodifica data URI de imagem base64', () => {
    const d = decodificarDataUri('data:image/jpeg;base64,' + Buffer.from('abc').toString('base64'));
    expect(d).not.toBeNull();
    expect(d!.buffer.toString()).toBe('abc');
    expect(d!.mime).toBe('image/jpeg');
  });
  it('rejeita não-imagem e base64 inválida', () => {
    expect(decodificarDataUri('data:text/html;base64,PGh0bWw+')).toBeNull();
    expect(decodificarDataUri('data:image/jpeg;base64,!!!não-base64')).toBeNull();
  });
  it('rejeita data URI acima de 8MB (após decodificar)', () => {
    const grande = 'data:image/png;base64,' + 'A'.repeat(11 * 1024 * 1024);
    expect(decodificarDataUri(grande)).toBeNull();
  });
});

describe('ehIpPrivado', () => {
  it('detecta faixas privadas/reservadas', () => {
    expect(ehIpPrivado('127.0.0.1')).toBe(true);
    expect(ehIpPrivado('10.0.0.5')).toBe(true);
    expect(ehIpPrivado('192.168.1.1')).toBe(true);
    expect(ehIpPrivado('172.16.0.1')).toBe(true);
    expect(ehIpPrivado('172.31.255.254')).toBe(true);
    expect(ehIpPrivado('169.254.10.10')).toBe(true);
    expect(ehIpPrivado('::1')).toBe(true);
    expect(ehIpPrivado('100.64.0.1')).toBe(true);
    expect(ehIpPrivado('224.0.0.1')).toBe(true);
  });
  it('aceita IPs públicos', () => {
    expect(ehIpPrivado('8.8.8.8')).toBe(false);
    expect(ehIpPrivado('189.10.20.30')).toBe(false);
    expect(ehIpPrivado('172.32.0.1')).toBe(false);
  });
});

describe('hostnameResolvePrivado', () => {
  it('detecta hostnames que resolvem para localhost (anti-SSRF)', async () => {
    expect(await hostnameResolvePrivado('http://localhost:3000/x.jpg')).toBe(true);
    expect(await hostnameResolvePrivado('http://127.0.0.1/x.jpg')).toBe(true);
  });
});