import { NextResponse } from 'next/server';
import { query } from '@/utils/db';
import { createClient } from '@/utils/auth/server';

// GET — Retorna a foto salva do usuário (se existir)
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { rows } = await query(
      'SELECT photo_base64, updated_at FROM public.user_photos WHERE user_id = $1 LIMIT 1',
      [user.id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ photo: null });
    }

    return NextResponse.json({ photo: rows[0].photo_base64, updatedAt: rows[0].updated_at });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('[ProvadorVirtual/Photo] GET Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST — Salva ou atualiza a foto do usuário (UPSERT)
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { photoBase64 } = await req.json();

    if (!photoBase64 || typeof photoBase64 !== 'string') {
      return NextResponse.json({ error: 'Foto inválida' }, { status: 400 });
    }

    // Validar se a foto fornecida é uma imagem data URI válida
    if (!photoBase64.startsWith('data:image/')) {
      return NextResponse.json({ error: 'Formato de imagem inválido. A foto deve ser um data URI.' }, { status: 400 });
    }

    // Validar tamanho: base64 é ~33% maior que o binário original
    // 5MB binário = ~6.67MB em base64
    const base64SizeBytes = Buffer.byteLength(photoBase64, 'utf8');
    const MAX_SIZE = 7 * 1024 * 1024; // ~7MB em base64 (equivalente a ~5MB binário)
    if (base64SizeBytes > MAX_SIZE) {
      return NextResponse.json({ error: 'Imagem muito grande. Máximo: 5MB.' }, { status: 400 });
    }

    // UPSERT: insere ou atualiza a foto existente
    await query(
      `INSERT INTO public.user_photos (user_id, photo_base64, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET photo_base64 = EXCLUDED.photo_base64, updated_at = NOW()`,
      [user.id, photoBase64]
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('[ProvadorVirtual/Photo] POST Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE — Remove a foto do usuário
export async function DELETE() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    await query('DELETE FROM public.user_photos WHERE user_id = $1', [user.id]);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('[ProvadorVirtual/Photo] DELETE Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
