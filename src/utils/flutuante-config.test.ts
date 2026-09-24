import { describe, expect, it } from 'vitest';
import {
  FLUTUANTE_DEFAULTS,
  configFlutuanteParaValor,
  normalizarConfigFlutuante,
} from './flutuante-config';

describe('flutuante-config', () => {
  it('aplica defaults quando não há configuração salva', () => {
    const cfg = normalizarConfigFlutuante(null);
    expect(cfg).toEqual({ ...FLUTUANTE_DEFAULTS });
  });

  it('aplica defaults para valores inválidos', () => {
    const cfg = normalizarConfigFlutuante({ ativo: 'sim', texto: '  ', icone: '', duracao_s: -5, atraso_ms: NaN });
    expect(cfg.ativo).toBe(true);
    expect(cfg.texto).toBe(FLUTUANTE_DEFAULTS.texto);
    expect(cfg.icone).toBe(FLUTUANTE_DEFAULTS.icone);
    expect(cfg.duracao_s).toBe(FLUTUANTE_DEFAULTS.duracao_s);
    expect(cfg.atraso_ms).toBe(FLUTUANTE_DEFAULTS.atraso_ms);
  });

  it('normaliza duração zero (ilimitado) e campos válidos', () => {
    const cfg = normalizarConfigFlutuante({
      ativo: false,
      texto: ' Fale com a gente! ',
      icone: '💬',
      duracao_s: 0,
      atraso_ms: 1000,
    });
    expect(cfg).toEqual({ ativo: false, texto: 'Fale com a gente!', icone: '💬', duracao_s: 0, atraso_ms: 1000 });
  });

  it('serializa para o formato salvo no CMS', () => {
    const valor = configFlutuanteParaValor({ ativo: true, texto: 'X', icone: '👉', duracao_s: 30, atraso_ms: 2000 });
    expect(valor).toEqual({ ativo: true, texto: 'X', icone: '👉', duracao_s: 30, atraso_ms: 2000 });
  });
});