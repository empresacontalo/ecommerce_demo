import { describe, it, expect } from 'vitest';
import {
  ehLinkValido,
  ehDataUriImagem,
  valorImagemValido,
  tipoArquivoImagem,
  arquivoImagemValido,
} from './imagem';

describe('ehLinkValido', () => {
  it('aceita http/https', () => {
    expect(ehLinkValido('https://exemplo.com/foto.jpg')).toBe(true);
    expect(ehLinkValido('http://exemplo.com/foto.jpg')).toBe(true);
  });
  it('rejeita outros esquemas e textos', () => {
    expect(ehLinkValido('ftp://x.com/foto.jpg')).toBe(false);
    expect(ehLinkValido('javascript:alert(1)')).toBe(false);
    expect(ehLinkValido('não é um link')).toBe(false);
    expect(ehLinkValido('')).toBe(false);
  });
});

describe('ehDataUriImagem', () => {
  it('aceita data URIs de imagem base64', () => {
    expect(ehDataUriImagem('data:image/jpeg;base64,/9j/4AAQ==')).toBe(true);
    expect(ehDataUriImagem('data:image/png;base64,iVBOR==')).toBe(true);
    expect(ehDataUriImagem('data:image/svg+xml;base64,PHN2Zz4=')).toBe(true);
  });
  it('rejeita outras data URIs', () => {
    expect(ehDataUriImagem('data:text/html;base64,PGh0bWw+')).toBe(false);
    expect(ehDataUriImagem('data:image/jpeg,raw')).toBe(false);
  });
});

describe('valorImagemValido', () => {
  it('aceita caminho local, link e data URI', () => {
    expect(valorImagemValido('/images/product-1.jpg')).toBe(true);
    expect(valorImagemValido('https://exemplo.com/foto.jpg')).toBe(true);
    expect(valorImagemValido('data:image/jpeg;base64,')).toBe(true);
  });
  it('rejeita vazio, texto solto e data URI gigante', () => {
    expect(valorImagemValido('')).toBe(false);
    expect(valorImagemValido('foto bonita')).toBe(false);
    expect(valorImagemValido(`data:image/jpeg;base64,${'A'.repeat(6 * 1024 * 1024)}`)).toBe(false);
  });
});

describe('tipoArquivoImagem', () => {
  it('reconhece tipos de imagem', () => {
    expect(tipoArquivoImagem(new File(['x'], 'a.jpg', { type: 'image/jpeg' }))).toBe('jpg');
    expect(tipoArquivoImagem(new File(['x'], 'a.png', { type: 'image/png' }))).toBe('png');
    expect(tipoArquivoImagem(new File(['x'], 'a.webp', { type: 'image/webp' }))).toBe('webp');
    expect(tipoArquivoImagem(new File(['x'], 'a.gif', { type: 'image/gif' }))).toBe('gif');
  });
  it('rejeita não-imagens', () => {
    expect(tipoArquivoImagem(new File(['x'], 'a.pdf', { type: 'application/pdf' }))).toBeNull();
    expect(tipoArquivoImagem(new File(['x'], 'a.mp4', { type: 'video/mp4' }))).toBeNull();
  });
});

describe('arquivoImagemValido', () => {
  it('aceita imagem até 8MB', () => {
    expect(arquivoImagemValido(new File(['x'], 'a.jpg', { type: 'image/jpeg' }))).toBe(true);
  });
  it('rejeita arquivo acima de 8MB', () => {
    const grande = new File([new ArrayBuffer(9 * 1024 * 1024)], 'a.jpg', { type: 'image/jpeg' });
    expect(arquivoImagemValido(grande)).toBe(false);
  });
});