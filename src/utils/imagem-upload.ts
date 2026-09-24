import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { lookup } from 'node:dns/promises';
import sharp from 'sharp';
import { query } from '@/utils/db'

export const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), 'public', 'uploads');
export const UPLOADS_PUBLIC_PREFIX = '/uploads';

export const MAX_ARQUIVO_BYTES = 8 * 1024 * 1024; // 8MB (arquivo/baixado/decodificado)
export const LADO_MAXIMO_PX = 1200;
export const UPLOAD_TIMEOUT_MS = 20000;

/** Garante que o diretório de uploads existe (volume persistente em produção). */
export async function garantirDiretorioUploads(): Promise<void> {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
}

/** Decodifica uma data URI de imagem base64 (com limite de tamanho). */
export function decodificarDataUri(dataUri: string): { buffer: Buffer; mime: string } | null {
  const match = /^data:(image\/(?:jpeg|png|webp|gif|avif|svg\+xml));base64,([\s\S]+)$/.exec(dataUri);
  if (!match) return null;
  const base64 = match[2].trim();
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) return null; // base64 estrito
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length === 0 || buffer.length > MAX_ARQUIVO_BYTES) return null;
  return { buffer, mime: match[1] };
}

function numeroEmFaixa(n: number, min: number, max: number): boolean {
  return n >= min && n <= max;
}

/** True se o IP é privado/reservado/metadado (proteção contra SSRF). */
export function ehIpPrivado(ip: string): boolean {
  const limpo = ip.replace(/^\[|\]$/g, '');
  if (limpo === '::1' || limpo === 'localhost') return true;
  if (limpo.startsWith('::ffff:')) {
    return ehIpPrivado(limpo.slice('::ffff:'.length));
  }
  if (limpo.includes(':')) return true; // IPv6 — rejeitar por simplicidade/segurança
  const partes = limpo.split('.').map(Number);
  if (partes.length !== 4 || partes.some((p) => Number.isNaN(p))) return true;
  const [a, b] = partes;
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 100 && numeroEmFaixa(b, 64, 127)) return true; // CGNAT
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && numeroEmFaixa(b, 16, 31)) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true; // multicast/reservado
  return false;
}

/** Resolve o hostname da URL e retorna true se algum endereço for privado. */
export async function hostnameResolvePrivado(url: string): Promise<boolean> {
  const u = new URL(url);
  const host = u.hostname;
  if (/^[\d.]+$/.test(host) || host.includes(':')) return ehIpPrivado(host);
  const enderecos = await lookup(host, { all: true }).catch(() => []);
  if (enderecos.length === 0) return true;
  return enderecos.some((a) => ehIpPrivado(a.address));
}

/** Baixa uma imagem de uma URL pública (com limite de tamanho e anti-SSRF). */
export async function baixarImagem(url: string): Promise<Buffer> {
  const u = new URL(url);
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('Informe um link http(s) válido');
  }
  if (await hostnameResolvePrivado(url)) {
    throw new Error('O link não pode apontar para endereços internos ou locais');
  }
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    headers: { 'User-Agent': 'Mozilla/5.0 (Fragrance E-commerce Demo; product image fetcher)' },
  });
  if (!res.ok) throw new Error(`Falha ao baixar a imagem (HTTP ${res.status})`);

  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  if (!contentType.startsWith('image/')) {
    throw new Error('O link não aponta para uma imagem válida');
  }
  const contentLength = Number(res.headers.get('content-length') || '0');
  if (contentLength > MAX_ARQUIVO_BYTES) {
    throw new Error('Imagem muito grande (máx. 8MB)');
  }
  const leitor = res.body?.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  while (leitor) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.length;
    if (total > MAX_ARQUIVO_BYTES) {
      await leitor.cancel();
      throw new Error('Imagem muito grande (máx. 8MB)');
    }
    partes.push(value);
  }
  return Buffer.concat(partes);
}

/**
 * Normaliza a imagem (redimensiona para o lado máximo, converte para WebP
 * com qualidade 85) e grava como arquivo <uuid>.webp no diretório de uploads.
 * Retorna o caminho público local (ex: /uploads/abc.webp).
 */
export async function salvarImagemWebp(buffer: Buffer): Promise<string> {
  await garantirDiretorioUploads();
  const nome = `${randomUUID()}.webp`;
  const destino = path.join(UPLOADS_DIR, nome);
  const processada = await sharp(buffer, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize({ width: LADO_MAXIMO_PX, height: LADO_MAXIMO_PX, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();
  await fs.writeFile(destino, processada);
  return `${UPLOADS_PUBLIC_PREFIX}/${nome}`;
}

/**
 * Remove do servidor os arquivos de upload que não estão referenciados em
 * NENHUMA parte do site (produtos, blocos, páginas, campanhas, depoimentos,
 * galeria ou configurações) — ou seja, imagens substituídas ou de produtos
 * que não existem mais. Retorna a quantidade removida.
 */
export async function removerImagensOrfasUploads(): Promise<number> {
  try {
    const arquivos = await fs.readdir(UPLOADS_DIR).catch(() => []);
    let removidos = 0;
    for (const nome of arquivos) {
      if (!/^[0-9a-f-]{36}\.webp$/.test(nome)) continue; // somente arquivos gerados por nós
      const padrao = `%${UPLOADS_PUBLIC_PREFIX}/${nome}%`;
      const [produtos, blocos, paginas, campanhas, depoimentos, galeria, configuracoes] = await Promise.all([
        query('SELECT 1 FROM public.produtos WHERE images::text ILIKE $1 LIMIT 1', [padrao]),
        query('SELECT 1 FROM public.blocos WHERE conteudo::text ILIKE $1 LIMIT 1', [padrao]),
        query('SELECT 1 FROM public.paginas WHERE meta_description ILIKE $1 LIMIT 1', [padrao]),
        query('SELECT 1 FROM public.campanhas WHERE imagem_url ILIKE $1 OR link_url ILIKE $1 LIMIT 1', [padrao]),
        query('SELECT 1 FROM public.depoimentos WHERE foto_url ILIKE $1 LIMIT 1', [padrao]),
        query('SELECT 1 FROM public.galeria WHERE url ILIKE $1 LIMIT 1', [padrao]),
        query('SELECT 1 FROM public.configuracoes WHERE valor::text ILIKE $1 LIMIT 1', [padrao]),
      ]);
      const referenciado = [produtos, blocos, paginas, campanhas, depoimentos, galeria, configuracoes]
        .some((r) => r.rows.length > 0);
      if (!referenciado) {
        await fs.unlink(path.join(UPLOADS_DIR, nome)).catch(() => {});
        removidos++;
      }
    }
    return removidos;
  } catch (err) {
    console.error('[imagem-upload] falha na limpeza de órfãs:', err instanceof Error ? err.message : err);
    return 0;
  }
}