import { getConfiguracao } from '@/app/actions/cms';

/**
 * Rate limiting por IP em memória, com limites configuráveis no banco
 * (chaves `rate_limit.<id>.max` e `rate_limit.<id>.window_ms`) e fallback
 * para os valores padrão de cada endpoint.
 *
 * Padrão de uso:
 *   const rl = await rateLimit(req, 'login');
 *   if (!rl.ok) return NextResponse.json({ error: rl.erro }, { status: 429 });
 */

interface LimiteRateLimit {
  max: number;
  windowMs: number;
}

const LIMITES_PADRAO: Record<string, LimiteRateLimit> = {
  login: { max: 30, windowMs: 15 * 60_000 },      // força bruta de senha
  checkout: { max: 15, windowMs: 5 * 60_000 },    // abuso de criação de pedidos
  contato: { max: 9, windowMs: 10 * 60_000 },     // flood de e-mails
  desconto: { max: 6, windowMs: 60_000 },         // disparo de IA paga
  leads: { max: 15, windowMs: 60_000 },           // formulário de captura
};

const registros = new Map<string, number[]>();

// cache curto das configurações (evita query no banco a cada request)
let cacheLimites: Record<string, LimiteRateLimit> | null = null;
let cacheExpiraEm = 0;
const CACHE_TTL_MS = 10_000;

export function _resetRateLimitStore() {
  registros.clear();
  cacheLimites = null;
  cacheExpiraEm = 0;
}

async function carregarLimites(): Promise<Record<string, LimiteRateLimit>> {
  const agora = Date.now();
  if (cacheLimites && agora < cacheExpiraEm) return cacheLimites;

  try {
    const limites: Record<string, LimiteRateLimit> = {};
    for (const id of Object.keys(LIMITES_PADRAO)) {
      const [maxCfg, windowCfg] = await Promise.all([
        getConfiguracao(`rate_limit.${id}.max`),
        getConfiguracao(`rate_limit.${id}.window_ms`),
      ]);
      limites[id] = {
        max: Math.max(1, Number(maxCfg?.valor ?? LIMITES_PADRAO[id].max)),
        windowMs: Math.max(1_000, Number(windowCfg?.valor ?? LIMITES_PADRAO[id].windowMs)),
      };
    }
    cacheLimites = limites;
    cacheExpiraEm = agora + CACHE_TTL_MS;
    return limites;
  } catch {
    // Banco indisponível: usa os padrões em vez de derrubar o endpoint
    return { ...LIMITES_PADRAO };
  }
}

function obterIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

/**
 * Verifica se a requisição do IP está dentro do limite.
 * Retorna { ok } ou { ok: false, erro } com a mensagem padrão de 429.
 */
export async function rateLimit(req: Request, id: string): Promise<{ ok: boolean; erro?: string }> {
  const limite = (await carregarLimites())[id] || LIMITES_PADRAO[id];
  const ip = obterIp(req);
  const agora = Date.now();

  const janela = (registros.get(ip) || []).filter((t) => agora - t < limite.windowMs);
  if (janela.length >= limite.max) {
    registros.set(ip, janela);
    return { ok: false, erro: 'Muitas tentativas. Aguarde um instante.' };
  }
  janela.push(agora);
  registros.set(ip, janela);
  return { ok: true };
}

/** Lista os limites atuais (padrão + override do banco) para o painel admin. */
export async function listarLimites(): Promise<Record<string, { id: string; max: number; windowMs: number }>> {
  const limites = await carregarLimites();
  const saida: Record<string, { id: string; max: number; windowMs: number }> = {};
  for (const id of Object.keys(LIMITES_PADRAO)) {
    saida[id] = { id, ...limites[id] };
  }
  return saida;
}

export { LIMITES_PADRAO };