import { describe, it, expect } from 'vitest';
import { statusCampanha, compararPrioridade, normalizarWhatsApp } from '@/utils/campanhas';
import type { Campanha } from '@/utils/campanhas';
import { campanhaParaSlides } from '@/components/campanhas/campanha-context';
import type { CampanhaPublica, CampanhaImagem } from '@/components/campanhas/campanha-context';

const base: Campanha = {
  id: '1',
  titulo: 'Teste',
  descricao: null,
  imagem_url: null,
  link_url: null,
  tipo: 'banner',
  tipo_campanha: 'global',
  categoria: null,
  prioridade: 0,
  mensagem_prompt: null,
  canal_padrao: 'whatsapp',
  follow_up_horas: 24,
  desconto: null,
  criado_por: null,
  data_inicio: null,
  data_fim: null,
  ativo: true,
  created_at: new Date('2026-01-01T00:00:00Z'),
  updated_at: new Date('2026-01-01T00:00:00Z'),
};

describe('statusCampanha', () => {
  it('ativa quando ativo e dentro do período', () => {
    const c = {
      ...base,
      ativo: true,
      data_inicio: new Date('2026-01-01T00:00:00Z'),
      data_fim: new Date('2026-12-31T00:00:00Z'),
    };
    expect(statusCampanha(c, new Date('2026-06-01T00:00:00Z'))).toBe('ativa');
  });

  it('ativa quando ativo sem período definido', () => {
    expect(statusCampanha(base, new Date('2026-06-01T00:00:00Z'))).toBe('ativa');
  });

  it('programada quando ativo e data_inicio futura', () => {
    const c = {
      ...base,
      ativo: true,
      data_inicio: new Date('2026-12-31T00:00:00Z'),
    };
    expect(statusCampanha(c, new Date('2026-06-01T00:00:00Z'))).toBe('programada');
  });

  it('encerrada quando data_fim já passou', () => {
    const c = {
      ...base,
      ativo: true,
      data_fim: new Date('2026-01-15T00:00:00Z'),
    };
    expect(statusCampanha(c, new Date('2026-06-01T00:00:00Z'))).toBe('encerrada');
  });

  it('desativada quando ativo=false mesmo dentro do período', () => {
    const c = {
      ...base,
      ativo: false,
      data_inicio: new Date('2026-01-01T00:00:00Z'),
      data_fim: new Date('2026-12-31T00:00:00Z'),
    };
    expect(statusCampanha(c, new Date('2026-06-01T00:00:00Z'))).toBe('desativada');
  });

  it('desativada quando ativo=false sem período', () => {
    expect(statusCampanha({ ...base, ativo: false }, new Date())).toBe('desativada');
  });
});

describe('compararPrioridade', () => {
  const mk = (over: Partial<Campanha>): Campanha => ({ ...base, ...over });

  it('ativa vem antes de programada', () => {
    const ativa = mk({ ativo: true, prioridade: 10 });
    const programada = mk({ ativo: true, data_inicio: new Date('2030-01-01T00:00:00Z'), prioridade: 1 });
    expect(compararPrioridade(ativa, programada, new Date())).toBeLessThan(0);
  });

  it('prioridade menor (maior prioridade) vem primeiro', () => {
    const a = mk({ ativo: true, prioridade: 1 });
    const b = mk({ ativo: true, prioridade: 5 });
    expect(compararPrioridade(a, b, new Date())).toBeLessThan(0);
  });

  it('empate desempata por created_at mais recente', () => {
    const a = mk({ ativo: true, prioridade: 3, created_at: new Date('2026-02-01T00:00:00Z') });
    const b = mk({ ativo: true, prioridade: 3, created_at: new Date('2026-01-01T00:00:00Z') });
    expect(compararPrioridade(a, b, new Date())).toBeLessThan(0);
  });
});

describe('normalizarWhatsApp', () => {
  it('adiciona DDI 55 a número nacional com DDD', () => {
    expect(normalizarWhatsApp('(11) 99999-9999')).toBe('5511999999999');
  });

  it('mantém número já com DDI 55', () => {
    expect(normalizarWhatsApp('5511999999999')).toBe('5511999999999');
  });

  it('adiciona 55 a número de 10 dígitos', () => {
    expect(normalizarWhatsApp('1199999999')).toBe('551199999999');
  });

  it('trunca números longos (com código de país)', () => {
    expect(normalizarWhatsApp('+55 11 99999-9999')).toBe('5511999999999');
  });

  it('retorna vazio para null/undefined', () => {
    expect(normalizarWhatsApp(null)).toBe('');
    expect(normalizarWhatsApp(undefined)).toBe('');
  });
});

describe('campanhaParaSlides (imagens por orientação)', () => {
  const camp: CampanhaPublica = {
    id: 'c1', titulo: 'Dia do Cliente', descricao: 'Descrição', desconto: '15% OFF',
    canal_padrao: 'whatsapp', categoria: 'cliente',
  };

  it('usa url_paisagem e url_retrato quando definidos', () => {
    const imgs: CampanhaImagem[] = [
      { id: 'i1', url: '/base.jpg', url_paisagem: '/paisagem.jpg', url_retrato: '/retrato.jpg', status: 'aprovada', ordem: 1 },
    ];
    const slides = campanhaParaSlides(camp, imgs);
    expect(slides).toHaveLength(1);
    expect(slides[0].imagem).toBe('/base.jpg');
    expect(slides[0].imagem_paisagem).toBe('/paisagem.jpg');
    expect(slides[0].imagem_retrato).toBe('/retrato.jpg');
  });

  it('usa a url como fallback quando não há variante por orientação', () => {
    const imgs: CampanhaImagem[] = [
      { id: 'i2', url: '/unica.jpg', url_paisagem: null, url_retrato: null, status: 'aprovada', ordem: 1 },
    ];
    const slides = campanhaParaSlides(camp, imgs);
    expect(slides[0].imagem_paisagem).toBe('/unica.jpg');
    expect(slides[0].imagem_retrato).toBe('/unica.jpg');
  });

  it('ignora imagens não aprovadas', () => {
    const imgs: CampanhaImagem[] = [
      { id: 'i3', url: '/pend.jpg', status: 'pendente', ordem: 1 },
      { id: 'i4', url: '/aprov.jpg', status: 'aprovada', ordem: 2 },
    ];
    expect(campanhaParaSlides(camp, imgs)).toHaveLength(1);
  });
});
