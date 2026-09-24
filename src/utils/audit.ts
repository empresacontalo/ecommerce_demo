import { query } from '@/utils/db'

export type ResponsavelTipo = 'admin' | 'mcp'

export interface AuditoriaDados {
  responsavelTipo: ResponsavelTipo
  responsavelNome: string
  acao: string
  resumo: string
  detalhe: string
}

export interface InfoDispositivo {
  ip: string | null
  navegador: string | null
  sistema_operacional: string | null
  localizacao: string | null
}

export const AUDIT_RETENCAO_DIAS = 7

/**
 * Registra um log de auditoria. Nunca lança exceção: se o registro falhar,
 * apenas loga no servidor — a operação principal não pode ser afetada.
 *
 * `resumo` é a linha curta da lista; `detalhe` é o texto por extenso exibido
 * no popup. NENHUM dos dois deve conter dados sensíveis (nomes de tabelas,
 * senhas, chaves de API) — use os rótulos amigáveis de `rotuloConfiguracao`
 * e textos explicativos para o dono do site.
 *
 * `req` (opcional) fornece o contexto do dispositivo: IP, navegador, sistema
 * operacional e localização aproximada (best-effort, com cache por IP).
 */
export async function registrarAuditoria(
  dados: AuditoriaDados,
  req?: Request | null,
): Promise<void> {
  try {
    const dispositivo = req ? capturarInfoDispositivo(req) : vazioDispositivo()
    const localizacao = await geoLocalizacao(dispositivo.ip)
    await query(
      `INSERT INTO public.audit_logs
         (responsavel_tipo, responsavel_nome, acao, resumo, detalhe, expira_em, ip, navegador, sistema_operacional, localizacao)
       VALUES ($1, $2, $3, $4, $5, NOW() + ($6 || ' days')::interval, $7, $8, $9, $10)`,
      [
        dados.responsavelTipo,
        dados.responsavelNome,
        dados.acao,
        dados.resumo,
        dados.detalhe,
        String(AUDIT_RETENCAO_DIAS),
        dispositivo.ip,
        dispositivo.navegador,
        dispositivo.sistema_operacional,
        localizacao,
      ],
    )
  } catch (err) {
    console.error('[audit] falha ao registrar auditoria:', err instanceof Error ? err.message : err)
  }
}

/** Remove logs de auditoria expirados (retenção de 7 dias). */
export async function purgarAuditLogs(): Promise<number> {
  try {
    const { rowCount } = await query('DELETE FROM public.audit_logs WHERE expira_em < NOW()')
    return rowCount ?? 0
  } catch (err) {
    console.error('[audit] falha ao purgar auditoria:', err instanceof Error ? err.message : err)
    return 0
  }
}

function vazioDispositivo(): InfoDispositivo {
  return { ip: null, navegador: null, sistema_operacional: null, localizacao: null }
}

/** Extrai IP cliente (x-forwarded-for do Nginx Proxy Manager) e identifica navegador/SO pelo User-Agent. */
export function capturarInfoDispositivo(req: Request): InfoDispositivo {
  const ip = extrairIp(req)
  const ua = req.headers.get('user-agent') || ''
  const { navegador, sistema_operacional } = parseUA(ua)
  return { ip, navegador, sistema_operacional, localizacao: null }
}

function extrairIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const primeiro = forwarded.split(',')[0]?.trim()
    if (primeiro) return primeiro
  }
  return req.headers.get('x-real-ip')
}

function parseUA(ua: string): { navegador: string; sistema_operacional: string } {
  const u = ua.toLowerCase()
  let navegador = 'Desconhecido'
  if (/edg(e|a|ios)\//.test(u)) navegador = 'Edge'
  else if (/opr\//.test(u) || /opera/.test(u)) navegador = 'Opera'
  else if (/chrome\//.test(u)) navegador = 'Chrome'
  else if (/firefox\//.test(u)) navegador = 'Firefox'
  else if (/safari\//.test(u)) navegador = 'Safari'
  else if (/iphone|ipad|ios/.test(u) && /webkit/.test(u)) navegador = 'Safari (iOS)'
  else if (/curl\/|wget\/|python-requests/.test(u)) navegador = 'Ferramenta automatizada'
  else if (/mcp|claude|cursor|codex/.test(u)) navegador = 'Cliente de IA'

  let sistemaOperacional = 'Desconhecido'
  if (/windows nt 10/.test(u)) sistemaOperacional = 'Windows 10/11'
  else if (/windows/.test(u)) sistemaOperacional = 'Windows'
  else if (/android/.test(u)) sistemaOperacional = 'Android'
  else if (/iphone|ipad|ios/.test(u)) sistemaOperacional = 'iOS'
  else if (/mac os x/.test(u)) sistemaOperacional = 'macOS'
  else if (/linux/.test(u)) sistemaOperacional = 'Linux'

  return { navegador, sistema_operacional: sistemaOperacional }
}

/* ─────────── Geolocalização best-effort (com cache e timeout) ─────────── */

const geoCache = new Map<string, string>()
const GEO_TIMEOUT_MS = 1200

function ipPrivado(ip: string): boolean {
  return (
    ip === '::1' ||
    /^127\./.test(ip) ||
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip) ||
    /^fc|^fd/.test(ip)
  )
}

async function geoLocalizacao(ip: string | null): Promise<string | null> {
  if (!ip || ipPrivado(ip)) return ip ? 'Rede local' : null
  const cached = geoCache.get(ip)
  if (cached) return cached
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), GEO_TIMEOUT_MS)
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city`,
      { signal: controller.signal },
    ).catch(() => null)
    clearTimeout(timer)
    if (!res) return null
    const data = (await res.json().catch(() => null)) as
      | { status?: string; country?: string; regionName?: string; city?: string }
      | null
    if (data?.status !== 'success') return null
    const texto = [data.city, data.regionName, data.country].filter(Boolean).join(', ')
    if (texto) geoCache.set(ip, texto)
    return texto
  } catch {
    return null
  }
}

/**
 * Mapa de chaves de configuração → rótulo amigável para o dono do site.
 * NÃO revela a chave interna (ex: "pagamento.api_key" vira "meio de pagamento").
 */
const CHAVE_ROTULO: Record<string, string> = {
  'header.logo': 'logotipo',
  'header.logo_imagem': 'imagem do logotipo',
  'footer.endereco': 'endereço de contato',
  'footer.contato.telefone': 'telefone de contato',
  'footer.contato.instagram': 'perfil do Instagram',
  'footer.contato.whatsapp': 'número do WhatsApp do rodapé',
  'agente.': 'conexão com o agente de atendimento',
  'footer.horario': 'horários de funcionamento',
  'whatsapp.numero': 'número do WhatsApp',
  'whatsapp.mensagem': 'mensagem padrão do WhatsApp',
  'empresa.email': 'e-mail de contato',
  'empresa.facebook': 'perfil do Facebook',
  'site.hero_imagem_paginas': 'imagem de destaque das páginas internas',
  'site.modo': 'modo de funcionamento do site',
  'catalogo.ordem_marcas': 'ordem de exibição das marcas no catálogo',
  'frete.motoboy': 'municípios e taxa do frete por motoboy',
  'tema.ativo': 'tema visual',
  'tema.paleta': 'paleta de cores do tema',
  'pagamento.': 'meio de pagamento',
  'chatwoot.': 'atendimento on-line',
}

export function rotuloConfiguracao(chave: string): string {
  for (const [prefixo, rotulo] of Object.entries(CHAVE_ROTULO)) {
    if (chave === prefixo || chave.startsWith(prefixo)) return rotulo
  }
  return 'configuração interna'
}