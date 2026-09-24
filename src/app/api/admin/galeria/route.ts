import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/utils/db';
import { getAdminSession } from '@/utils/auth/admin';

/**
 * Gestão de Galeria via bloco CMS (fonte real da página /galeria).
 * O admin legado usava a tabela public.galeria, que ficou vazia —
 * o conteúdo público vive em blocos.tipo='galeria' (conteudo.itens).
 */

interface GaleriaItem {
  url: string;
  categoria: string;
  titulo: string;
  alt?: string;
  ativo?: boolean;
}

async function getBlocoGaleria() {
  const { rows } = await query(
    `SELECT b.id, b.titulo, b.conteudo
     FROM public.blocos b
     JOIN public.paginas p ON p.id = b.pagina_id
     WHERE p.slug = 'galeria' AND b.tipo = 'galeria'
     ORDER BY b.ordem
     LIMIT 1`
  );
  return rows[0] || null;
}

async function atualizarBloco(blocoId: string, conteudo: Record<string, unknown>) {
  await query(
    `UPDATE public.blocos SET conteudo = $1, updated_at = NOW() WHERE id = $2`,
    [JSON.stringify(conteudo), blocoId]
  );
}

const isVideoUrl = (url: string) => /\.(mp4|webm|mov)(\?.*)?$/i.test(url);

// GET /api/admin/galeria — Lista itens do bloco CMS (fotos + vídeos)
export async function GET(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const bloco = await getBlocoGaleria();
    if (!bloco) return NextResponse.json([]);

    const itens: GaleriaItem[] = bloco.conteudo?.itens || [];
    const { searchParams } = new URL(req.url);
    const categoria = (searchParams.get('categoria') || '').trim();

    const filtrados = itens
      .map((item, i) => ({ ...item, id: String(i), video: isVideoUrl(item.url) }))
      .filter((item) => !categoria || categoria === 'Todos' || item.categoria === categoria);

    return NextResponse.json(filtrados);
  } catch (err) {
    console.error('Erro ao listar galeria:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// POST /api/admin/galeria — Adiciona foto ou vídeo ao bloco
export async function POST(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { url, alt, categoria, titulo } = await req.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'url é obrigatória' }, { status: 400 });
    }
    if (!/^(https?:\/\/|data:image\/|data:video\/|\/)/.test(url)) {
      return NextResponse.json({ error: 'url deve ser http(s), data ou caminho local' }, { status: 400 });
    }
    const limite = isVideoUrl(url) ? 100_000_000 : 5_000_000; // vídeo até 100MB
    if (url.length > limite) {
      return NextResponse.json({ error: 'Arquivo muito grande.' }, { status: 400 });
    }

    const bloco = await getBlocoGaleria();
    if (!bloco) return NextResponse.json({ error: 'Bloco de galeria não encontrado' }, { status: 404 });

    const conteudo = { ...(bloco.conteudo || {}) };
    const itens: GaleriaItem[] = conteudo.itens || [];
    const novaCategoria = categoria || (isVideoUrl(url) ? 'Vídeos' : 'Fotos');

    itens.push({
      url,
      titulo: titulo || alt || `Item ${itens.length + 1}`,
      alt: alt || null,
      categoria: novaCategoria,
      ativo: true,
    });

    // Atualiza a lista de categorias do filtro público
    const cats = (String(conteudo.categorias || 'Todos').split(',').map((c: string) => c.trim()));
    if (!cats.includes(novaCategoria)) cats.push(novaCategoria);
    conteudo.categorias = cats.join(',');
    conteudo.itens = itens;

    await atualizarBloco(bloco.id, conteudo);
    return NextResponse.json({ ...itens[itens.length - 1], id: String(itens.length - 1) }, { status: 201 });
  } catch (err) {
    console.error('Erro ao adicionar item:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// PUT /api/admin/galeria — Atualiza item (alt/categoria/ordem/ativo)
export async function PUT(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { id, alt, categoria, titulo, ativo } = await req.json();
    if (id === undefined || id === null || id === '') {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const bloco = await getBlocoGaleria();
    if (!bloco) return NextResponse.json({ error: 'Bloco de galeria não encontrado' }, { status: 404 });

    const conteudo = { ...(bloco.conteudo || {}) };
    const itens: GaleriaItem[] = conteudo.itens || [];
    const idx = Number(id);
    if (!itens[idx]) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 });

    if (alt !== undefined) itens[idx].alt = alt;
    if (titulo !== undefined) itens[idx].titulo = titulo;
    if (categoria !== undefined) itens[idx].categoria = categoria;
    if (ativo !== undefined) itens[idx].ativo = Boolean(ativo);

    conteudo.itens = itens;
    await atualizarBloco(bloco.id, conteudo);
    return NextResponse.json({ ...itens[idx], id: String(idx) });
  } catch (err) {
    console.error('Erro ao atualizar item:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// DELETE /api/admin/galeria — Exclui itens (um id ou lista)
export async function DELETE(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { id, ids } = await req.json();
    const lista: number[] = (ids || (id !== undefined ? [id] : [])).map((x: unknown) => Number(String(x)));
    if (lista.length === 0) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });

    const bloco = await getBlocoGaleria();
    if (!bloco) return NextResponse.json({ error: 'Bloco de galeria não encontrado' }, { status: 404 });

    const conteudo = { ...(bloco.conteudo || {}) };
    const itens: GaleriaItem[] = conteudo.itens || [];
    const indices = new Set(lista.filter((i) => i >= 0 && i < itens.length));

    conteudo.itens = itens.filter((_: GaleriaItem, i: number) => !indices.has(i));
    await atualizarBloco(bloco.id, conteudo);
    return NextResponse.json({ success: true, excluidos: indices.size });
  } catch (err) {
    console.error('Erro ao excluir itens:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
