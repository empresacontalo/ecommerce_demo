import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/utils/auth/admin';
import {
  baixarImagem,
  decodificarDataUri,
  salvarImagemWebp,
} from '@/utils/imagem-upload';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/admin/imagem-upload — Baixa/decodifica a imagem informada pelo
 * admin (data URI de upload ou link http(s) online), normaliza para WebP e
 * grava no servidor (volume persistente). Retorna o caminho local público
 * (ex: /uploads/<uuid>.webp) — o site nunca aponta para fora.
 *
 * Body: { dataUri?: string } | { url?: string }
 */
export async function POST(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const body = (await req.json().catch(() => null)) as { dataUri?: string; url?: string } | null;
    if (!body) {
      return NextResponse.json({ error: 'Envie uma imagem via upload ou link' }, { status: 400 });
    }

    let buffer: Buffer;
    let origem = '';

    if (typeof body.dataUri === 'string' && body.dataUri) {
      const decodificada = decodificarDataUri(body.dataUri);
      if (!decodificada) {
        return NextResponse.json({ error: 'Imagem inválida ou muito grande (máx. 8MB)' }, { status: 400 });
      }
      buffer = decodificada.buffer;
      origem = decodificada.mime;
    } else if (typeof body.url === 'string' && body.url) {
      if (!/^https?:\/\//.test(body.url)) {
        return NextResponse.json({ error: 'Informe um link http(s) válido' }, { status: 400 });
      }
      try {
        buffer = await baixarImagem(body.url);
      } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Falha ao baixar a imagem' }, { status: 400 });
      }
      origem = 'link online';
    } else {
      return NextResponse.json({ error: 'Envie uma imagem via upload ou link' }, { status: 400 });
    }

    const urlLocal = await salvarImagemWebp(buffer);
    console.log(`[imagem-upload] ${origem} → ${urlLocal} (por ${admin.email})`);
    return NextResponse.json({ url: urlLocal }, { status: 201 });
  } catch (err) {
    console.error('[imagem-upload] erro:', err);
    return NextResponse.json({ error: 'Erro ao processar a imagem' }, { status: 500 });
  }
}