import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/utils/db';
import { getAdminSession } from '@/utils/auth/admin';

const MIMES_ACEITOS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
};

// GET /api/cms/favicon — Serve a imagem do favicon salva no banco (público)
export async function GET() {
  try {
    const cfg = await query('SELECT * FROM public.configuracoes WHERE chave = $1', ['site.favicon']);
    const nome = cfg.rows[0]?.valor?.nome || cfg.rows[0]?.valor || null;
    if (!nome) return new NextResponse(null, { status: 404 });

    const r = await query('SELECT nome, mime, dados FROM public.site_assets WHERE nome = $1', [nome]);
    if (r.rows.length === 0) return new NextResponse(null, { status: 404 });

    const { mime, dados } = r.rows[0];
    return new NextResponse(Buffer.isBuffer(dados) ? dados : Buffer.from(dados), {
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err) {
    console.error('Erro ao servir favicon:', err);
    return new NextResponse(null, { status: 500 });
  }
}

// POST /api/cms/favicon — Upload/renomear favicon (admin)
export async function POST(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const form = await req.formData();
    const arquivo = form.get('arquivo') as File | null;
    const nome = String(form.get('nome') || '').trim();

    const nomeFinal = nome || arquivo?.name || 'favicon.png';
    const nomeLimpo = nomeFinal.replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase();

    if (arquivo) {
      const mime = arquivo.type || 'image/png';
      if (!MIMES_ACEITOS[mime]) {
        return NextResponse.json({ error: 'Formato de imagem não suportado (use png, jpg, webp, svg ou ico)' }, { status: 400 });
      }
      if (arquivo.size > 2 * 1024 * 1024) {
        return NextResponse.json({ error: 'Imagem muito grande (máx 2MB)' }, { status: 400 });
      }
      const bytes = Buffer.from(await arquivo.arrayBuffer());
      await query(
        `INSERT INTO public.site_assets (nome, mime, dados, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (nome) DO UPDATE SET mime = $2, dados = $3, updated_at = NOW()`,
        [nomeLimpo, mime, bytes]
      );
    } else if (!nome) {
      return NextResponse.json({ error: 'Informe um arquivo ou um nome' }, { status: 400 });
    }

    await query(
      `INSERT INTO public.configuracoes (chave, valor, descricao)
       VALUES ('site.favicon', $1, 'Favicon do site (nome do arquivo em site_assets)')
       ON CONFLICT (chave) DO UPDATE SET valor = $1`,
      [JSON.stringify({ nome: nomeLimpo })]
    );

    return NextResponse.json({ nome: nomeLimpo });
  } catch (err) {
    console.error('Erro ao salvar favicon:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// DELETE /api/cms/favicon — Remove o favicon (admin)
export async function DELETE() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const cfg = await query('SELECT * FROM public.configuracoes WHERE chave = $1', ['site.favicon']);
    const nome = cfg.rows[0]?.valor?.nome || cfg.rows[0]?.valor || null;
    if (nome) await query('DELETE FROM public.site_assets WHERE nome = $1', [nome]);
    await query('DELETE FROM public.configuracoes WHERE chave = $1', ['site.favicon']);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Erro ao remover favicon:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
