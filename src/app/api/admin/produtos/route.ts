import { getAdminSession } from '@/utils/auth/admin'
import { query } from '@/utils/db'
import { registrarAuditoria } from '@/utils/audit'
import { valorImagemValido } from '@/utils/imagem'
import { removerImagensOrfasUploads } from '@/utils/imagem-upload'
import { VALOR_MINIMO_VENDA } from '@/utils/desconto-pagamento'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const admin = await getAdminSession()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { rows } = await query(
      'SELECT * FROM public.produtos ORDER BY name ASC'
    )

    return NextResponse.json(rows)
  } catch (err: any) {
    console.error('Erro inesperado na API Admin Produtos:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const admin = await getAdminSession()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, origin, price, stock, length, description, category, images, badge, price_old, descontos } = body

    if (!name || price === undefined) {
      return NextResponse.json({ error: 'Nome e preço são obrigatórios' }, { status: 400 })
    }

    const precoVal = Number(price)
    if (!Number.isFinite(precoVal) || precoVal < VALOR_MINIMO_VENDA) {
      return NextResponse.json(
        { error: `O preço mínimo de um produto é R$ ${VALOR_MINIMO_VENDA.toFixed(2)} (limite do Asaas para gerar cobrança).` },
        { status: 400 }
      )
    }

    const imagensValidas = images && images.length > 0
      ? images.every((img: string) => typeof img === 'string' && valorImagemValido(img))
      : true
    if (!imagensValidas) {
      return NextResponse.json(
        { error: 'Cada imagem deve ser um link http(s), um caminho local ou um upload de imagem válido' },
        { status: 400 }
      )
    }
    if (images && images.length > 10) {
      return NextResponse.json({ error: 'O produto pode ter no máximo 10 fotos' }, { status: 400 })
    }

    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')

    const stockVal = Math.max(0, parseInt(String(stock ?? '0'), 10) || 0)
    const stockStatus = stockVal > 0 ? 'Em estoque' : 'Indisponível'

    const { rows } = await query(
      `INSERT INTO public.produtos (
        name, slug, origin, price, stock, stock_status, length, description, category, images, badge, price_old, descontos
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        name,
        slug,
        origin || 'Brasileiro',
        price,
        stockVal,
        stockStatus,
        length || '60cm',
        description || '',
        category || 'Cabelo',
        images && images.length > 0 ? images : ['/images/placeholder.png'],
        badge || null,
        price_old || null,
        descontos && typeof descontos === 'object' && !Array.isArray(descontos) ? descontos : null
      ]
    );

    await registrarAuditoria({
      responsavelTipo: 'admin',
      responsavelNome: admin.email || admin.id,
      acao: 'produto',
      resumo: 'Produto cadastrado',
      detalhe: `O produto "${name}" foi cadastrado na loja.`,
    }, request);

    return NextResponse.json(rows[0])
  } catch (err: any) {
    console.error('Erro ao criar produto:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const admin = await getAdminSession()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, name, origin, price, stock, length, description, category, images, badge, price_old, descontos } = body

    if (!id || !name || price === undefined) {
      return NextResponse.json({ error: 'ID, Nome e preço são obrigatórios' }, { status: 400 })
    }

    const precoVal = Number(price)
    if (!Number.isFinite(precoVal) || precoVal < VALOR_MINIMO_VENDA) {
      return NextResponse.json(
        { error: `O preço mínimo de um produto é R$ ${VALOR_MINIMO_VENDA.toFixed(2)} (limite do Asaas para gerar cobrança).` },
        { status: 400 }
      )
    }

    const imagensValidas = images && images.length > 0
      ? images.every((img: string) => typeof img === 'string' && valorImagemValido(img))
      : true
    if (!imagensValidas) {
      return NextResponse.json(
        { error: 'Cada imagem deve ser um link http(s), um caminho local ou um upload de imagem válido' },
        { status: 400 }
      )
    }
    if (images && images.length > 10) {
      return NextResponse.json({ error: 'O produto pode ter no máximo 10 fotos' }, { status: 400 })
    }

    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')

    const stockVal = Math.max(0, parseInt(String(stock ?? '0'), 10) || 0)
    const stockStatus = stockVal > 0 ? 'Em estoque' : 'Indisponível'

    const { rows } = await query(
      `UPDATE public.produtos
       SET name = $1, slug = $2, origin = $3, price = $4, stock = $5, stock_status = $6, length = $7, description = $8, category = $9, images = $10, badge = $11, price_old = $12, descontos = $14
       WHERE id = $13
       RETURNING *`,
      [
        name,
        slug,
        origin,
        price,
        stockVal,
        stockStatus,
        length,
        description,
        category,
        images && images.length > 0 ? images : ['/images/placeholder.png'],
        badge,
        price_old,
        id,
        descontos && typeof descontos === 'object' && !Array.isArray(descontos) ? descontos : null
      ]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
    }

    await registrarAuditoria({
      responsavelTipo: 'admin',
      responsavelNome: admin.email || admin.id,
      acao: 'produto',
      resumo: 'Produto atualizado',
      detalhe: `As informações do produto "${rows[0].name || name}" foram editadas (preço, estoque, descrição, imagens ou etiquetas).`,
    }, request);

    // Imagens substituídas/removidas que não são mais usadas em nenhuma parte
    // do site são excluídas do servidor.
    removerImagensOrfasUploads().catch((e) => console.error('[produtos] limpeza de órfãs:', e));

    return NextResponse.json(rows[0])
  } catch (err: any) {
    console.error('Erro ao atualizar produto:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = await getAdminSession()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
    }

    const { rowCount } = await query(
      'DELETE FROM public.produtos WHERE id = $1',
      [id]
    );

    if (rowCount === 0) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
    }

    await registrarAuditoria({
      responsavelTipo: 'admin',
      responsavelNome: admin.email || admin.id,
      acao: 'produto',
      resumo: 'Produto excluído',
      detalhe: 'Um produto foi removido do catálogo da loja.',
    }, request);

    // Fotos do produto excluído viram órfãs (se não usadas em outro produto)
    // e são removidas do servidor.
    removerImagensOrfasUploads().catch((e) => console.error('[produtos] limpeza de órfãs:', e));

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Erro ao excluir produto:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
