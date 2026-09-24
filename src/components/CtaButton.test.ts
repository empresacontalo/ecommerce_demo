import { describe, expect, it } from 'vitest';
import { isChatHref, isWhatsappHref } from './CtaButton';

describe('CtaButton href helpers', () => {
  it('reconhece links do chat', () => {
    expect(isChatHref('chat:agendar')).toBe(true);
    expect(isChatHref('chat')).toBe(true);
    expect(isChatHref('/loja')).toBe(false);
    expect(isChatHref(null)).toBe(false);
  });

  it('reconhece links whatsapp: (número do admin)', () => {
    expect(isWhatsappHref('whatsapp:')).toBe(true);
    expect(isWhatsappHref('whatsapp')).toBe(true);
    expect(isWhatsappHref('https://wa.me/5513991386387')).toBe(false);
    expect(isWhatsappHref('/catalogo')).toBe(false);
    expect(isWhatsappHref(null)).toBe(false);
    expect(isWhatsappHref(undefined)).toBe(false);
  });
});