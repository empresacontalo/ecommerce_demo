'use client';

type ConfigMap = Record<string, unknown>;

let cache: ConfigMap | null = null;
let inflight: Promise<ConfigMap> | null = null;

/**
 * Busca todas as configurações (Dados da Empresa) uma única vez por sessão.
 * Retorna mapa chave → valor.
 */
export async function getConfigs(): Promise<ConfigMap> {
  if (cache) return cache;
  if (!inflight) {
    inflight = (async () => {
      try {
        const res = await fetch('/api/cms/configuracoes', { cache: 'no-store' });
        if (!res.ok) return {};
        const rows = await res.json();
        const map: ConfigMap = {};
        for (const r of rows) map[r.chave] = r.valor;
        cache = map;
        return map;
      } catch {
        return {};
      }
    })();
  }
  return inflight;
}

/** Busca o valor de uma chave (e opcionalmente um campo do objeto) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getConfig(chave: string, campo?: string): Promise<any> {
  const cfg = await getConfigs();
  const v = cfg[chave];
  if (campo && v && typeof v === 'object') return (v as Record<string, unknown>)[campo];
  return v;
}

/**
 * Aliases amigáveis para tokens em conteúdos.
 * Ex: {{nome.empresa}} → header.logo.texto
 */
export const TOKEN_ALIASES: Record<string, string> = {
  'nome.empresa': 'header.logo.texto',
  'empresa.nome': 'header.logo.texto',
  'nome': 'header.logo.texto',
  'nome.subtitulo': 'header.logo.subtitulo',
  'subtitulo': 'header.logo.subtitulo',
  'telefone': 'footer.contato.telefone.numero',
  'whatsapp': 'whatsapp.numero.numero',
  'whatsapp.link': 'whatsapp.numero.link',
  'email': 'empresa.email',
  'endereco': 'footer.endereco.linha1',
  'endereco2': 'footer.endereco.linha2',
  'cidade': 'footer.endereco.cidade',
  'cep': 'footer.endereco.cep',
  'instagram': 'footer.contato.instagram.usuario',
  'facebook': 'empresa.facebook.usuario',
  'horario.semana': 'footer.horario.semana',
  'horario.sabado': 'footer.horario.sabado',
  'horario.domingo': 'footer.horario.domingo',
};

/**
 * Substitui tokens {{token}} em um texto usando as configurações carregadas.
 * Suporta aliases ({{nome.empresa}}) e chaves reais ({{header.logo.texto}},
 * {{footer.endereco.linha1}}, {{whatsapp.numero.link}}...).
 */
export function resolveTokens(text: string, cfg: ConfigMap): string {
  return text.replace(/\{\{([\w.-]+)\}\}/g, (m: string, token: string) => {
    const path = TOKEN_ALIASES[token] || token;
    const parts = path.split('.');
    for (let i = parts.length; i >= 1; i--) {
      const chave = parts.slice(0, i).join('.');
      if (cfg[chave] !== undefined) {
        let v: unknown = cfg[chave];
        for (const f of parts.slice(i)) v = (v as Record<string, unknown>)?.[f];
        return v !== undefined && v !== null ? String(v) : m;
      }
    }
    return m;
  });
}
