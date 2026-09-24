// Configuração do convite flutuante ao chat e redes sociais.
// Chave CMS: flutuante (objeto JSON) — editável em Admin > Configurações > Convite ao chat e redes.
export const FLUTUANTE_DEFAULTS = {
  ativo: true,
  texto: 'Pegue seu desconto sem compromisso por um de nossos canais',
  icone: '👉',
  // Duração em segundos que o convite fica visível; 0 = permanece até ser fechado/manual.
  duracao_s: 20,
  // Atraso em ms até o convite aparecer.
  atraso_ms: 4000,
} as const;

export interface FlutuanteConfig {
  ativo: boolean;
  texto: string;
  icone: string;
  duracao_s: number;
  atraso_ms: number;
}

/**
 * Normaliza o valor salvo no CMS (objeto) para a configuração completa,
 * aplicando defaults para campos ausentes/inválidos.
 */
export function normalizarConfigFlutuante(valor: unknown): FlutuanteConfig {
  if (!valor || typeof valor !== 'object') return { ...FLUTUANTE_DEFAULTS };
  const v = valor as Record<string, unknown>;

  const ok = (x: unknown, tipo: 'string' | 'number' | 'boolean') => typeof x === tipo;

  const texto = ok(v.texto, 'string') && String(v.texto).trim() ? String(v.texto).trim() : FLUTUANTE_DEFAULTS.texto;
  const icone = ok(v.icone, 'string') && String(v.icone).trim() ? String(v.icone).trim() : FLUTUANTE_DEFAULTS.icone;
  const duracao = ok(v.duracao_s, 'number') && Number.isFinite(Number(v.duracao_s)) && Number(v.duracao_s) >= 0
    ? Math.round(Number(v.duracao_s))
    : FLUTUANTE_DEFAULTS.duracao_s;
  const atraso = ok(v.atraso_ms, 'number') && Number.isFinite(Number(v.atraso_ms)) && Number(v.atraso_ms) >= 0
    ? Math.round(Number(v.atraso_ms))
    : FLUTUANTE_DEFAULTS.atraso_ms;

  return {
    ativo: ok(v.ativo, 'boolean') ? Boolean(v.ativo) : FLUTUANTE_DEFAULTS.ativo,
    texto,
    icone,
    duracao_s: duracao,
    atraso_ms: atraso,
  };
}

/** Ajudante para o painel: JSON de exibição do valor salvo (sem mutar o estado em vivo). */
export function configFlutuanteParaValor(cfg: FlutuanteConfig): Record<string, unknown> {
  return {
    ativo: cfg.ativo,
    texto: cfg.texto,
    icone: cfg.icone,
    duracao_s: cfg.duracao_s,
    atraso_ms: cfg.atraso_ms,
  };
}