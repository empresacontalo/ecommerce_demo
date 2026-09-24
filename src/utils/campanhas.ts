export interface Campanha {
  id: string;
  titulo: string;
  descricao: string | null;
  imagem_url: string | null;
  link_url: string | null;
  tipo: string;
  tipo_campanha: string;
  categoria: string | null;
  prioridade: number;
  mensagem_prompt: string | null;
  canal_padrao: string;
  follow_up_horas: number;
  desconto: string | null;
  criado_por: string | null;
  data_inicio: Date | string | null;
  data_fim: Date | string | null;
  ativo: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export type StatusCampanha =
  | 'rascunho'
  | 'programada'
  | 'ativa'
  | 'encerrada'
  | 'desativada';

function toDate(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  return v instanceof Date ? v : new Date(v);
}

export function statusCampanha(c: Campanha, now: Date = new Date()): StatusCampanha {
  if (!c.ativo) return 'desativada';

  const inicio = toDate(c.data_inicio);
  const fim = toDate(c.data_fim);

  if (inicio && inicio > now) return 'programada';
  if (fim && fim < now) return 'encerrada';

  return 'ativa';
}

export function isCampanhaElegivel(c: Campanha, now: Date = new Date()): boolean {
  return statusCampanha(c, now) === 'ativa';
}

export function compararPrioridade(a: Campanha, b: Campanha, now: Date = new Date()): number {
  const rank = { ativa: 0, programada: 1, encerrada: 2, desativada: 3, rascunho: 4 } as const;
  const ra = rank[statusCampanha(a, now)];
  const rb = rank[statusCampanha(b, now)];
  if (ra !== rb) return ra - rb;

  if (a.prioridade !== b.prioridade) return a.prioridade - b.prioridade;

  const ta = toDate(a.created_at)?.getTime() ?? 0;
  const tb = toDate(b.created_at)?.getTime() ?? 0;
  return tb - ta;
}

export function ordenarCampanhas(lista: Campanha[], now: Date = new Date()): Campanha[] {
  return [...lista].sort((a, b) => compararPrioridade(a, b, now));
}

export function getCampanhaElegivel(
  lista: Campanha[],
  now: Date = new Date()
): Campanha | null {
  const elegiveis = lista.filter((c) => isCampanhaElegivel(c, now));
  if (elegiveis.length === 0) return null;
  return ordenarCampanhas(elegiveis, now)[0];
}

// Normaliza número de WhatsApp para E.164 (DDI 55 implícito quando ausente)
export function normalizarWhatsApp(v: string | null | undefined): string {
  const d = (v || '').replace(/\D/g, '');
  if (d.length <= 9) return d;
  if (d.length === 10) return `55${d}`;
  if (d.length === 11) return `55${d}`;
  if (d.length === 12 && d.startsWith('55')) return d;
  if (d.length >= 13) return d.slice(0, 13);
  return d;
}
