import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { UPLOADS_DIR } from '@/utils/imagem-upload';

export const runtime = 'nodejs';

/**
 * GET /uploads/<uuid>.webp — Serve as imagens de produto gravadas no servidor
 * (diretório de uploads em volume persistente). O Next standalone não serve
 * arquivos adicionados em runtime em public/; por isso esta rota existe.
 * Somente arquivos no formato gerado por nós (uuid.webp); público (as fotos
 * aparecem no site), com cache imutável de 7 dias.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ arquivo: string[] }> },
): Promise<NextResponse> {
  const { arquivo } = await ctx.params;
  const nome = arquivo.join('/');
  if (!/^[0-9a-f-]{36}\.webp$/.test(nome)) {
    return NextResponse.json({ error: 'Não encontrada' }, { status: 404 });
  }
  const caminho = path.join(UPLOADS_DIR, nome);
  const dados = await fs.readFile(caminho).catch(() => null);
  if (!dados) {
    return NextResponse.json({ error: 'Não encontrada' }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(dados), {
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=604800, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}