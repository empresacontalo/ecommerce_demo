import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { query } from '@/utils/db';
import { ENVIRONMENT_MANIFEST } from '@/utils/environment-manifest';
import type { DadosCartao } from '@/utils/pagamentos';
import { exigirEscopoAdmin, type EscopoMCP } from '@/lib/mcp/auth';
import { registrarAuditoria, rotuloConfiguracao } from '@/utils/audit';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuid(v: unknown, campo = 'id'): string {
  if (typeof v !== 'string' || !UUID_RE.test(v)) {
    throw new Error(`${campo} deve ser um UUID válido`);
  }
  return v;
}

function resposta(data: unknown) {
  return { content: [{ type: 'text' as const, text: typeof data === 'string' ? data : JSON.stringify(data ?? null) }] };
}

type ToolResult = ReturnType<typeof resposta>;

function asyncOk(fn: () => Promise<unknown>): () => Promise<ToolResult> {
  return async () => resposta(await fn());
}

export function registerTools(
  server: McpServer,
  escopo: EscopoMCP = 'admin',
  req?: Request | null,
  nomeToken?: string,
) {
  /* Guard: bloqueia ferramentas que alteram dados quando o token é de vendas */
  const admin = (ferramenta: string) => exigirEscopoAdmin(escopo, ferramenta);

  /* Auditoria das ferramentas executadas pela IA (detalhe explicativo, sem dados sensíveis) */
  const responsavelNome = nomeToken || (escopo === 'vendas' ? 'Token de vendas' : 'Token mestre');
  const audit = (acao: string, resumo: string, detalhe: string) =>
    registrarAuditoria({ responsavelTipo: 'mcp', responsavelNome, acao, resumo, detalhe }, req);

  /* ───────────────────────── Dashboard (leitura) ───────────────────────── */

  server.registerTool('dashboard_resumo', {
    title: 'Resumo do painel (dashboard)',
    description: 'Retorna estatísticas do painel administrativo: vendas do mês, pedidos, clientes, leads novos e agendamentos de hoje.',
  }, asyncOk(async () => {
    const [{ rows: vendasMes }, { rows: pedidos }, { rows: clientes }, { rows: leads }, { rows: agendamentos }] = await Promise.all([
      query(`SELECT COALESCE(SUM(total), 0) AS total FROM public.orders WHERE status <> 'Cancelado' AND created_at >= date_trunc('month', CURRENT_DATE)`),
      query(`SELECT COUNT(*) AS total FROM public.orders`),
      query(`SELECT COUNT(*) AS total FROM public.users`),
      query(`SELECT COUNT(*) AS total FROM public.leads WHERE created_at >= date_trunc('month', CURRENT_DATE)`),
      query(`SELECT COUNT(*) AS total FROM public.agendamentos WHERE scheduled_at::date = CURRENT_DATE`),
    ]);
    return {
      vendas_mes: Number(vendasMes[0]?.total || 0),
      pedidos: Number(pedidos[0]?.total || 0),
      clientes: Number(clientes[0]?.total || 0),
      leads_mes: Number(leads[0]?.total || 0),
      agendamentos_hoje: Number(agendamentos[0]?.total || 0),
    };
  }));

  server.registerTool('ler_ambiente', {
    title: 'Status das variáveis de ambiente',
    description: 'Lista as variáveis de ambiente da stack e seu estado de configuração (nome, escopo, fonte, se configurada, drift). NUNCA retorna valores de segredos.',
  }, asyncOk(async () => {
    const revision = await query(
      `SELECT metadata FROM public.environment_revisions
       WHERE environment_name = 'production' ORDER BY created_at DESC LIMIT 1`
    );
    const metadata = revision.rows[0]?.metadata || {};
    return ENVIRONMENT_MANIFEST.map((def) => ({
      chave: def.key,
      descricao: def.description,
      escopo: def.scope,
      sensivel: def.sensitive,
      configurada: metadata[def.key]?.configured ?? null,
      fonte: metadata[def.key]?.source ?? 'unknown',
      drift: metadata[def.key]?.drift ?? null,
    }));
  }));

  /* ───────────────────────── Páginas ───────────────────────── */

  server.registerTool('listar_paginas', {
    title: 'Listar páginas',
    description: 'Lista todas as páginas do site (slug, título, meta descrição, ativo), incluindo inativas.',
  }, asyncOk(async () => (await query('SELECT id, slug, titulo, meta_description, ativo, created_at FROM public.paginas ORDER BY titulo')).rows));

  server.registerTool('criar_pagina', {
    title: 'Criar página',
    description: 'Cria uma página no CMS.',
    inputSchema: z.object({
      slug: z.string().min(1).describe('Slug único da página (ex: sobre)'),
      titulo: z.string().min(1).describe('Título da página'),
      meta_description: z.string().optional(),
      ativo: z.boolean().optional().describe('Se a página fica visível no site (padrão: true)'),
    }),
  }, async ({ slug, titulo, meta_description, ativo }) => {
      admin('criar_pagina');
    const { rows } = await query(
      `INSERT INTO public.paginas (slug, titulo, meta_description, ativo)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [slug, titulo, meta_description || null, ativo ?? true]
    );
    await audit('pagina', 'Página criada', `Uma nova página chamada "${titulo}" foi criada no site.`);
    return resposta(rows[0]);
  });

  server.registerTool('atualizar_pagina', {
    title: 'Atualizar página',
    description: 'Atualiza título, meta descrição ou ativação de uma página.',
    inputSchema: z.object({
      id: z.string().describe('UUID da página'),
      titulo: z.string().optional(),
      meta_description: z.string().nullable().optional(),
      ativo: z.boolean().optional(),
    }),
  }, async ({ id, titulo, meta_description, ativo }) => {
      admin('atualizar_pagina');
    const idv = uuid(id, 'id');
    const { rows } = await query(
      `UPDATE public.paginas
       SET titulo = COALESCE($2, titulo),
           meta_description = COALESCE($3, meta_description),
           ativo = COALESCE($4, ativo),
           updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [idv, titulo || null, meta_description ?? null, ativo ?? null]
    );
    if (!rows.length) throw new Error('Página não encontrada');
    await audit('pagina', 'Página atualizada', `A página "${rows[0].titulo || 'sem título'}" foi editada.`);
    return resposta(rows[0]);
  });

  server.registerTool('excluir_pagina', {
    title: 'Excluir página',
    description: 'Exclui uma página e seus blocos do CMS.',
    inputSchema: z.object({ id: z.string().describe('UUID da página') }),
  }, async ({ id }) => {
      admin('excluir_pagina');
    const idv = uuid(id, 'id');
    await query('DELETE FROM public.blocos WHERE pagina_id = $1', [idv]);
    const { rowCount } = await query('DELETE FROM public.paginas WHERE id = $1', [idv]);
    if (!rowCount) throw new Error('Página não encontrada');
    await audit('pagina', 'Página excluída', 'Uma página foi removida do site.');
    return resposta({ success: true });
  });

  /* ───────────────────────── Blocos ───────────────────────── */

  server.registerTool('listar_blocos', {
    title: 'Listar blocos de uma página',
    description: 'Lista os blocos (seções) de uma página, na ordem de exibição.',
    inputSchema: z.object({ pagina_id: z.string().describe('UUID da página') }),
  }, async ({ pagina_id }) => {
    const pid = uuid(pagina_id, 'pagina_id');
    return resposta((await query('SELECT id, pagina_id, tipo, titulo, ordem, conteudo, ativo FROM public.blocos WHERE pagina_id = $1 ORDER BY ordem', [pid])).rows);
  });

  server.registerTool('criar_ou_atualizar_bloco', {
    title: 'Criar ou atualizar bloco',
    description: 'Cria um novo bloco (seção) em uma página, ou atualiza um existente (passando id). O campo conteudo é um objeto JSON livre com o conteúdo do bloco.',
    inputSchema: z.object({
      id: z.string().optional().describe('UUID do bloco (para atualizar um existente)'),
      pagina_id: z.string().describe('UUID da página'),
      tipo: z.string().optional().describe('Tipo do bloco (ex: hero, carrossel, servicos, depoimentos, cta, lead, cards, diferenciais, produtos, galeria, form)'),
      titulo: z.string().optional(),
      ordem: z.number().int().optional(),
      conteudo: z.record(z.string(), z.any()).optional(),
      ativo: z.boolean().optional(),
    }),
  }, async ({ id, pagina_id, tipo, titulo, ordem, conteudo, ativo }) => {
      admin('criar_ou_atualizar_bloco');
    const pag = uuid(pagina_id, 'pagina_id');
    if (id) {
      const idv = uuid(id, 'id');
      const { rows } = await query(
        `UPDATE public.blocos
         SET tipo = COALESCE($1, tipo), titulo = COALESCE($2, titulo),
             ordem = COALESCE($3, ordem), conteudo = COALESCE($4, conteudo),
             ativo = COALESCE($5, ativo), updated_at = NOW()
         WHERE id = $6 AND pagina_id = $7 RETURNING *`,
        [tipo || null, titulo || null, ordem ?? null, JSON.stringify(conteudo || {}), ativo ?? null, idv, pag]
      );
      if (!rows.length) throw new Error('Bloco não encontrado');
      await audit('conteudo', 'Seção de conteúdo atualizada', `A seção "${rows[0].titulo || 'sem título'}" foi editada.`);
      return resposta(rows[0]);
    }
    const { rows } = await query(
      `INSERT INTO public.blocos (pagina_id, tipo, titulo, ordem, conteudo, ativo)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [pag, tipo || 'hero', titulo || null, ordem ?? 0, JSON.stringify(conteudo || {}), ativo ?? true]
    );
    await audit('conteudo', 'Seção de conteúdo criada', 'Uma nova seção de conteúdo foi criada em uma página do site.');
    return resposta(rows[0]);
  });

  server.registerTool('excluir_bloco', {
    title: 'Excluir bloco',
    description: 'Remove um bloco (seção) de uma página.',
    inputSchema: z.object({ id: z.string().describe('UUID do bloco') }),
  }, async ({ id }) => {
      admin('excluir_bloco');
    const idv = uuid(id, 'id');
    const { rowCount } = await query('DELETE FROM public.blocos WHERE id = $1', [idv]);
    if (!rowCount) throw new Error('Bloco não encontrado');
    await audit('conteudo', 'Seção de conteúdo excluída', 'Uma seção de conteúdo foi removida.');
    return resposta({ success: true });
  });

  /* ───────────────────────── Configurações ───────────────────────── */

  server.registerTool('listar_configuracoes', {
    title: 'Listar configurações',
    description: 'Lista todas as configurações do site (chave, valor, descrição).',
  }, asyncOk(async () => (await query('SELECT * FROM public.configuracoes ORDER BY chave ASC')).rows));

  server.registerTool('salvar_configuracao', {
    title: 'Salvar configuração',
    description: 'Cria ou atualiza uma configuração (upsert por chave). Ex: header.logo, whatsapp.numero, footer.contato.telefone, chatwoot.url, chatwoot.token.',
    inputSchema: z.object({
      chave: z.string().min(1).describe('Chave da configuração'),
      valor: z.any().describe('Valor (texto, número, objeto ou lista — convertido para JSON)'),
      descricao: z.string().optional(),
    }),
  }, async ({ chave, valor, descricao }) => {
      admin('salvar_configuracao');
    const { rows } = await query(
      `INSERT INTO public.configuracoes (chave, valor, descricao)
       VALUES ($1, $2, $3)
       ON CONFLICT (chave) DO UPDATE SET valor = $2, descricao = COALESCE($3, public.configuracoes.descricao)
       RETURNING *`,
      [chave, JSON.stringify(valor), descricao || null]
    );
    await audit('configuracao', `Configuração alterada: ${rotuloConfiguracao(chave)}`, `O valor de "${rotuloConfiguracao(chave)}" foi salvo e já está ativo no site.`);
    return resposta(rows[0]);
  });

  server.registerTool('excluir_configuracao', {
    title: 'Excluir configuração',
    description: 'Remove uma configuração pelo id.',
    inputSchema: z.object({ id: z.string().describe('UUID da configuração') }),
  }, async ({ id }) => {
      admin('excluir_configuracao');
    const idv = uuid(id, 'id');
    await query('DELETE FROM public.configuracoes WHERE id = $1', [idv]);
    await audit('configuracao', 'Configuração excluída', 'Uma configuração interna do site foi removida.');
    return resposta({ success: true });
  });

  /* ───────────────────────── Depoimentos ───────────────────────── */

  server.registerTool('listar_depoimentos', {
    title: 'Listar depoimentos',
    description: 'Lista os depoimentos do site (nome, texto, estrelas, foto, ordem, ativo).',
  }, asyncOk(async () => (await query('SELECT * FROM public.depoimentos ORDER BY ordem ASC, created_at DESC')).rows));

  server.registerTool('criar_depoimento', {
    title: 'Criar depoimento',
    description: 'Adiciona um depoimento de cliente.',
    inputSchema: z.object({
      nome: z.string().min(1),
      texto: z.string().min(1),
      foto_url: z.string().optional(),
      estrelas: z.number().int().min(1).max(5).optional(),
      ordem: z.number().int().optional(),
      ativo: z.boolean().optional(),
    }),
  }, async ({ nome, texto, foto_url, estrelas, ordem, ativo }) => {
      admin('criar_depoimento');
    const { rows } = await query(
      `INSERT INTO public.depoimentos (nome, texto, foto_url, estrelas, ordem, ativo)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nome, texto, foto_url || null, estrelas ?? 5, ordem ?? 0, ativo ?? true]
    );
    await audit('depoimento', 'Depoimento criado', `Um novo depoimento de "${nome}" foi publicado no site.`);
    return resposta(rows[0]);
  });

  server.registerTool('atualizar_depoimento', {
    title: 'Atualizar depoimento',
    description: 'Atualiza um depoimento existente.',
    inputSchema: z.object({
      id: z.string(),
      nome: z.string().optional(),
      texto: z.string().optional(),
      foto_url: z.string().nullable().optional(),
      estrelas: z.number().int().min(1).max(5).nullable().optional(),
      ordem: z.number().int().nullable().optional(),
      ativo: z.boolean().nullable().optional(),
    }),
  }, async ({ id, nome, texto, foto_url, estrelas, ordem, ativo }) => {
      admin('atualizar_depoimento');
    const idv = uuid(id, 'id');
    const { rows } = await query(
      `UPDATE public.depoimentos
       SET nome = COALESCE($2, nome), texto = COALESCE($3, texto),
           foto_url = COALESCE($4, foto_url), estrelas = COALESCE($5, estrelas),
           ordem = COALESCE($6, ordem), ativo = COALESCE($7, ativo)
       WHERE id = $1 RETURNING *`,
      [idv, nome || null, texto || null, foto_url ?? null, estrelas ?? null, ordem ?? null, ativo ?? null]
    );
    if (!rows.length) throw new Error('Depoimento não encontrado');
    await audit('depoimento', 'Depoimento atualizado', `O depoimento de "${rows[0].nome || 'um cliente'}" foi editado.`);
    return resposta(rows[0]);
  });

  server.registerTool('excluir_depoimento', {
    title: 'Excluir depoimento',
    description: 'Remove um depoimento pelo id.',
    inputSchema: z.object({ id: z.string() }),
  }, async ({ id }) => {
      admin('excluir_depoimento');
    const idv = uuid(id, 'id');
    await query('DELETE FROM public.depoimentos WHERE id = $1', [idv]);
    await audit('depoimento', 'Depoimento excluído', 'Um depoimento foi removido do site.');
    return resposta({ success: true });
  });

  /* ───────────────────────── Galeria ───────────────────────── */

  server.registerTool('listar_galeria', {
    title: 'Listar galeria',
    description: 'Lista as fotos da galeria (filtro opcional por categoria).',
    inputSchema: z.object({ categoria: z.string().optional() }),
  }, async ({ categoria }) => {
    if (categoria && categoria !== 'Todos') {
      return resposta((await query('SELECT * FROM public.galeria WHERE categoria = $1 ORDER BY ordem ASC, created_at DESC', [categoria])).rows);
    }
    return resposta((await query('SELECT * FROM public.galeria ORDER BY ordem ASC, created_at DESC')).rows);
  });

  server.registerTool('adicionar_galeria', {
    title: 'Adicionar foto à galeria',
    description: 'Adiciona uma foto (URL, caminho local ou data URI base64) à galeria.',
    inputSchema: z.object({
      url: z.string().describe('URL (http/https), caminho local (/images/...) ou data:image base64'),
      alt: z.string().optional(),
      categoria: z.string().optional().describe('Categoria da foto (padrão: Geral)'),
      ordem: z.number().optional(),
    }),
  }, async ({ url, alt, categoria, ordem }) => {
      admin('adicionar_galeria');
    if (!/^(https?:\/\/|data:image\/|\/)/.test(url)) throw new Error('url deve ser http(s), data:image ou caminho local');
    if (url.length > 5_000_000) throw new Error('Imagem muito grande. Máximo ~5MB.');
    const novaOrdem = ordem ?? Number((await query('SELECT COALESCE(MIN(ordem), 0) AS min_ordem FROM public.galeria')).rows[0].min_ordem) - 1;
    const { rows } = await query(
      `INSERT INTO public.galeria (url, alt, categoria, ordem) VALUES ($1, $2, $3, $4) RETURNING *`,
      [url, alt || null, categoria || 'Geral', novaOrdem]
    );
    await audit('galeria', 'Foto adicionada à galeria', 'Uma foto foi adicionada à galeria do site.');
    return resposta(rows[0]);
  });

  server.registerTool('atualizar_galeria', {
    title: 'Atualizar foto da galeria',
    description: 'Atualiza alt, categoria, ordem ou ativo de uma foto.',
    inputSchema: z.object({
      id: z.string(),
      alt: z.string().nullable().optional(),
      categoria: z.string().nullable().optional(),
      ordem: z.number().nullable().optional(),
      ativo: z.boolean().nullable().optional(),
    }),
  }, async ({ id, alt, categoria, ordem, ativo }) => {
      admin('atualizar_galeria');
    const idv = uuid(id, 'id');
    const { rows } = await query(
      `UPDATE public.galeria
       SET alt = COALESCE($2, alt), categoria = COALESCE($3, categoria),
           ordem = COALESCE($4, ordem), ativo = COALESCE($5, ativo), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [idv, alt ?? null, categoria || null, ordem ?? null, ativo ?? null]
    );
    if (!rows.length) throw new Error('Foto não encontrada');
    await audit('galeria', 'Foto da galeria atualizada', 'Uma foto da galeria foi editada (legenda, categoria ou ordem).');
    return resposta(rows[0]);
  });

  server.registerTool('excluir_galeria', {
    title: 'Excluir fotos da galeria',
    description: 'Exclui uma ou várias fotos da galeria pelos ids.',
    inputSchema: z.object({ ids: z.array(z.string()).min(1) }),
  }, async ({ ids }) => {
      admin('excluir_galeria');
    const lista = ids.map((i) => uuid(i, 'id'));
    await query('DELETE FROM public.galeria WHERE id = ANY($1::uuid[])', [lista]);
    await audit('galeria', 'Fotos excluídas da galeria', `${lista.length} foto(s) foram removidas da galeria.`);
    return resposta({ success: true, excluidos: lista.length });
  });

  /* ───────────────────────── Campanhas ───────────────────────── */

  server.registerTool('listar_campanhas', {
    title: 'Listar campanhas',
    description: 'Lista as campanhas (ativas e todas, com filtro opcional).',
    inputSchema: z.object({ somente_ativas: z.boolean().optional() }),
  }, async ({ somente_ativas }) => {
    const sql = somente_ativas
      ? `SELECT * FROM public.campanhas WHERE ativo=true AND (data_inicio IS NULL OR data_inicio<=NOW()) AND (data_fim IS NULL OR data_fim>=NOW()) ORDER BY created_at DESC`
      : `SELECT * FROM public.campanhas ORDER BY created_at DESC`;
    return resposta((await query(sql)).rows);
  });

  server.registerTool('criar_campanha', {
    title: 'Criar campanha',
    description: 'Cria uma campanha (ex: família, desconto, banner). Campos conforme o painel.',
    inputSchema: z.object({
      titulo: z.string().min(1).describe('Título da campanha'),
      descricao: z.string().nullable().optional(),
      imagem_url: z.string().nullable().optional(),
      link_url: z.string().nullable().optional(),
      tipo: z.string().optional().describe('Ex: banner, cta, bloco'),
      tipo_campanha: z.string().optional().describe('Ex: global, familia, desconto'),
      categoria: z.string().nullable().optional(),
      prioridade: z.number().int().optional(),
      mensagem_prompt: z.string().nullable().optional().describe('Instrução de mensagem para o follow-up'),
      canal_padrao: z.string().optional().describe('Ex: whatsapp'),
      follow_up_horas: z.number().int().optional(),
      desconto: z.union([z.string(), z.number()]).nullable().optional(),
      data_inicio: z.string().nullable().optional().describe('Data ISO (YYYY-MM-DD) — nula = sem início'),
      data_fim: z.string().nullable().optional().describe('Data ISO (YYYY-MM-DD) — nula = sem fim'),
      ativo: z.boolean().optional(),
    }),
  }, async (args) => {
      admin('criar_campanha');
    const { titulo, descricao, imagem_url, link_url, tipo, tipo_campanha, categoria, prioridade,
            mensagem_prompt, canal_padrao, follow_up_horas, desconto, data_inicio, data_fim, ativo } = args;
    const { rows } = await query(
      `INSERT INTO public.campanhas
         (titulo, descricao, imagem_url, link_url, tipo, tipo_campanha, categoria,
          prioridade, mensagem_prompt, canal_padrao, follow_up_horas, desconto,
          data_inicio, data_fim, ativo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [titulo, descricao ?? null, imagem_url ?? null, link_url ?? null, tipo || 'banner',
       tipo_campanha || 'global', categoria ?? null, prioridade ?? 0, mensagem_prompt ?? null,
       canal_padrao || 'whatsapp', follow_up_horas ?? 24, desconto ?? null,
       data_inicio ?? null, data_fim ?? null, ativo ?? true]
    );
    await query(
      `INSERT INTO public.campanha_historico (campanha_id, acao, detalhes) VALUES ($1,'criada',$2)`,
      [rows[0].id, JSON.stringify({ titulo })]
    );
    await audit('campanha', 'Campanha criada', `A campanha "${titulo}" foi criada.`);
    return resposta(rows[0]);
  });

  server.registerTool('atualizar_campanha', {
    title: 'Atualizar campanha',
    description: 'Atualiza campos de uma campanha existente (somente os informados).',
    inputSchema: z.object({
      id: z.string(),
      titulo: z.string().optional(),
      descricao: z.string().nullable().optional(),
      imagem_url: z.string().nullable().optional(),
      link_url: z.string().nullable().optional(),
      tipo: z.string().nullable().optional(),
      tipo_campanha: z.string().nullable().optional(),
      categoria: z.string().nullable().optional(),
      prioridade: z.number().int().nullable().optional(),
      mensagem_prompt: z.string().nullable().optional(),
      canal_padrao: z.string().nullable().optional(),
      follow_up_horas: z.number().int().nullable().optional(),
      desconto: z.union([z.string(), z.number()]).nullable().optional(),
      data_inicio: z.string().nullable().optional(),
      data_fim: z.string().nullable().optional(),
      ativo: z.boolean().optional(),
    }),
  }, async (args) => {
      admin('atualizar_campanha');
    const idv = uuid(args.id, 'id');
    const campos: [string, unknown][] = [
      ['titulo', args.titulo], ['descricao', args.descricao], ['imagem_url', args.imagem_url],
      ['link_url', args.link_url], ['tipo', args.tipo], ['tipo_campanha', args.tipo_campanha],
      ['categoria', args.categoria], ['prioridade', args.prioridade], ['mensagem_prompt', args.mensagem_prompt],
      ['canal_padrao', args.canal_padrao], ['follow_up_horas', args.follow_up_horas], ['desconto', args.desconto],
      ['data_inicio', args.data_inicio], ['data_fim', args.data_fim],
    ];
    const sets: string[] = [];
    const vals: unknown[] = [idv];
    for (const [col, val] of campos) {
      if (val !== undefined) {
        sets.push(`${col} = $${vals.length + 1}`);
        vals.push(val ?? null);
      }
    }
    if (args.ativo !== undefined) { sets.push(`ativo = $${vals.length + 1}`); vals.push(args.ativo); }
    if (!sets.length) throw new Error('Nada para atualizar');
    const { rows } = await query(
      `UPDATE public.campanhas SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      vals
    );
    if (!rows.length) throw new Error('Campanha não encontrada');
    await query(
      `INSERT INTO public.campanha_historico (campanha_id, acao, detalhes) VALUES ($1,'atualizada',$2)`,
      [idv, JSON.stringify(sets)]
    );
    await audit('campanha', 'Campanha atualizada', 'Uma campanha foi atualizada (título, período, desconto ou visibilidade).');
    return resposta(rows[0]);
  });

  server.registerTool('excluir_campanha', {
    title: 'Excluir campanha',
    description: 'Remove uma campanha.',
    inputSchema: z.object({ id: z.string() }),
  }, async ({ id }) => {
      admin('excluir_campanha');
    const idv = uuid(id, 'id');
    await query('DELETE FROM public.campanhas WHERE id = $1', [idv]);
    await audit('campanha', 'Campanha excluída', 'Uma campanha foi removida.');
    return resposta({ success: true });
  });

  server.registerTool('listar_leads_campanha', {
    title: 'Listar leads/preenchimentos de uma campanha',
    description: 'Lista os contatos (leads) que preencheram uma campanha.',
    inputSchema: z.object({ campanha_id: z.string() }),
  }, async ({ campanha_id }) => {
    const cid = uuid(campanha_id, 'campanha_id');
    const { rows } = await query(
      `SELECT * FROM public.campanha_contatos WHERE campanha_id = $1 ORDER BY created_at DESC LIMIT 500`,
      [cid]
    );
    return resposta(rows);
  });

  /* ───────────────────────── Produtos ───────────────────────── */

  server.registerTool('listar_produtos', {
    title: 'Listar produtos',
    description: 'Lista os produtos do catálogo (nome, preço, estoque, categoria, origem).',
  }, asyncOk(async () => (await query('SELECT * FROM public.produtos ORDER BY name ASC')).rows));

  function slugify(name: string): string {
    return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
  }

  server.registerTool('criar_produto', {
    title: 'Criar produto',
    description: 'Cria um produto no catálogo.',
    inputSchema: z.object({
      name: z.string().min(1),
      price: z.number().nonnegative(),
      origin: z.string().optional(),
      stock: z.number().int().min(0).optional(),
      length: z.string().optional().describe('Comprimento (ex: 60cm)'),
      description: z.string().optional(),
      category: z.string().optional().describe('Categoria (ex: Cabelo, Acessório)'),
      images: z.array(z.string()).optional(),
      badge: z.string().nullable().optional(),
      price_old: z.number().nullable().optional(),
    }),
  }, async ({ name, price, origin, stock, length, description, category, images, badge, price_old }) => {
      admin('criar_produto');
    const stockVal = Math.max(0, Number(stock ?? 0) || 0);
    const { rows } = await query(
      `INSERT INTO public.produtos (name, slug, origin, price, stock, stock_status, length, description, category, images, badge, price_old)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [name, slugify(name), origin || 'Brasileiro', price, stockVal, stockVal > 0 ? 'Em estoque' : 'Indisponível',
       length || '60cm', description || '', category || 'Cabelo',
       images && images.length ? images : ['/images/placeholder.png'], badge ?? null, price_old ?? null]
    );
    await audit('produto', 'Produto cadastrado', `O produto "${name}" foi cadastrado na loja.`);
    return resposta(rows[0]);
  });

  server.registerTool('atualizar_produto', {
    title: 'Atualizar produto',
    description: 'Atualiza um produto existente.',
    inputSchema: z.object({
      id: z.string(),
      name: z.string().optional(),
      price: z.number().nonnegative().optional(),
      origin: z.string().nullable().optional(),
      stock: z.number().int().min(0).nullable().optional(),
      length: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
      category: z.string().nullable().optional(),
      images: z.array(z.string()).nullable().optional(),
      badge: z.string().nullable().optional(),
      price_old: z.number().nullable().optional(),
    }),
  }, async ({ id, name, price, origin, stock, length, description, category, images, badge, price_old }) => {
      admin('atualizar_produto');
    const idv = uuid(id, 'id');
    const { rows: cur } = await query('SELECT * FROM public.produtos WHERE id = $1', [idv]);
    if (!cur.length) throw new Error('Produto não encontrado');
    const atual = cur[0];
    const novoNome = name ?? atual.name;
    const stockVal = stock !== undefined && stock !== null ? Math.max(0, Number(stock) || 0) : Number(atual.stock ?? 0);
    const priceVal = price ?? atual.price;
    const { rows } = await query(
      `UPDATE public.produtos
       SET name = $1, slug = $2, origin = $3, price = $4, stock = $5, stock_status = $6,
           length = $7, description = $8, category = $9, images = $10, badge = $11, price_old = $12
       WHERE id = $13 RETURNING *`,
      [novoNome, slugify(novoNome), origin ?? atual.origin, priceVal, stockVal,
       stockVal > 0 ? 'Em estoque' : 'Indisponível', length ?? atual.length,
       description ?? atual.description, category ?? atual.category,
       images && images.length ? images : atual.images, badge ?? atual.badge ?? null, price_old ?? atual.price_old ?? null, idv]
    );
    await audit('produto', 'Produto atualizado', `As informações do produto "${rows[0].name || 'cadastrado'}" foram atualizadas.`);
    return resposta(rows[0]);
  });

  server.registerTool('excluir_produto', {
    title: 'Excluir produto',
    description: 'Remove um produto pelo id.',
    inputSchema: z.object({ id: z.string() }),
  }, async ({ id }) => {
      admin('excluir_produto');
    const idv = uuid(id, 'id');
    const { rowCount } = await query('DELETE FROM public.produtos WHERE id = $1', [idv]);
    if (!rowCount) throw new Error('Produto não encontrado');
    await audit('produto', 'Produto excluído', 'Um produto foi removido do catálogo da loja.');
    return resposta({ success: true });
  });

  /* ───────────────────────── Leads ───────────────────────── */

  server.registerTool('listar_leads', {
    title: 'Listar leads',
    description: 'Lista os leads do kanban de vendas. Cada lead traz a fase atual (status), o score e o pedido mais recente (status/total/criado_em) — usado para monitorar o funil e detectar abandono de carrinho pelo tempo sem conclusão (etapa_atualizada_em).',
  }, asyncOk(async () => (await query(
    `SELECT l.*,
       (SELECT json_build_object('id', o.id, 'status', o.status, 'total', o.total_price, 'criado_em', o.created_at)
        FROM public.orders o WHERE o.lead_id = l.id ORDER BY o.created_at DESC LIMIT 1) AS pedido
     FROM public.leads l ORDER BY l.created_at DESC LIMIT 500`
  )).rows));

  server.registerTool('atualizar_status_lead', {
    title: 'Atualizar status de um lead',
    description: 'Altera o status/etapa de um lead (ex: Novo, Contatado, Proposta Enviada, Convertido).',
    inputSchema: z.object({ id: z.string(), status: z.string().min(1) }),
  }, async ({ id, status }) => {
    const idv = uuid(id, 'id');
    const { rows } = await query('UPDATE public.leads SET status = $1 WHERE id = $2 RETURNING *', [status, idv]);
    if (!rows.length) throw new Error('Lead não encontrado');
    await audit('lead', 'Status de contato alterado', `O status de um contato (lead) foi alterado para "${status}".`);
    return resposta(rows[0]);
  });

  /* ───────────────────────── Agendamentos ───────────────────────── */

  server.registerTool('listar_agendamentos', {
    title: 'Listar agendamentos',
    description: 'Lista agendamentos com filtros opcionais por status e busca, ou estatísticas (stats=true).',
    inputSchema: z.object({
      status: z.string().optional().describe('Filtrar por status (ex: Pendente, Confirmado, Concluído, Cancelado)'),
      busca: z.string().optional(),
      stats: z.boolean().optional().describe('Retornar estatísticas (hoje, semana, confirmados, não compareceu, ativos)'),
    }),
  }, async ({ status, busca, stats }) => {
    if (stats) {
      const { rows } = await query(
        `SELECT COUNT(*) FILTER (WHERE scheduled_at::date = CURRENT_DATE) AS hoje,
                COUNT(*) FILTER (WHERE scheduled_at >= date_trunc('week', CURRENT_DATE)) AS semana,
                COUNT(*) FILTER (WHERE status = 'Confirmado') AS confirmados,
                COUNT(*) FILTER (WHERE status = 'Não Compareceu') AS no_show,
                COUNT(*) FILTER (WHERE status <> 'Cancelado') AS ativos
         FROM public.agendamentos`
      );
      return resposta(rows[0]);
    }
    const conds: string[] = [];
    const params: unknown[] = [];
    if (status && status !== 'Todos') { params.push(status); conds.push(`status = $${params.length}`); }
    if (busca) { params.push(`%${busca}%`); conds.push(`(client_name ILIKE $${params.length} OR client_phone ILIKE $${params.length} OR service ILIKE $${params.length})`); }
    let sql = 'SELECT * FROM public.agendamentos';
    if (conds.length) sql += ` WHERE ${conds.join(' AND ')}`;
    sql += ' ORDER BY scheduled_at ASC LIMIT 500';
    return resposta((await query(sql, params)).rows);
  });

  server.registerTool('criar_agendamento', {
    title: 'Criar agendamento',
    description: 'Cria um agendamento (nome, telefone, serviço, data/hora, status, observações, preço).',
    inputSchema: z.object({
      client_name: z.string().min(1),
      client_phone: z.string().min(1),
      service: z.string().min(1),
      scheduled_at: z.string().describe('Data e hora ISO (ex: 2026-08-20T14:30:00)'),
      status: z.string().optional().describe('Padrão: Pendente'),
      notes: z.string().nullable().optional(),
      price: z.number().nullable().optional(),
    }),
  }, async ({ client_name, client_phone, service, scheduled_at, status, notes, price }) => {
    const { rows } = await query(
      `INSERT INTO public.agendamentos (client_name, client_phone, service, scheduled_at, status, notes, price)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [client_name, client_phone, service, scheduled_at, status || 'Pendente', notes ?? null, price ?? null]
    );
    await audit('agendamento', 'Agendamento criado', `Um novo agendamento foi criado para "${client_name}" (${service}).`);
    return resposta(rows[0]);
  });

  server.registerTool('atualizar_agendamento', {
    title: 'Atualizar agendamento',
    description: 'Atualiza um agendamento existente.',
    inputSchema: z.object({
      id: z.string(),
      client_name: z.string().optional(),
      client_phone: z.string().optional(),
      service: z.string().optional(),
      scheduled_at: z.string().optional(),
      status: z.string().optional(),
      notes: z.string().nullable().optional(),
      price: z.number().nullable().optional(),
    }),
  }, async ({ id, client_name, client_phone, service, scheduled_at, status, notes, price }) => {
    const idv = uuid(id, 'id');
    const { rows } = await query(
      `UPDATE public.agendamentos
       SET client_name = COALESCE($2, client_name), client_phone = COALESCE($3, client_phone),
           service = COALESCE($4, service), scheduled_at = COALESCE($5, scheduled_at),
           status = COALESCE($6, status), notes = COALESCE($7, notes), price = COALESCE($8, price)
       WHERE id = $1 RETURNING *`,
      [idv, client_name || null, client_phone || null, service || null, scheduled_at || null,
       status || null, notes ?? null, price ?? null]
    );
    if (!rows.length) throw new Error('Agendamento não encontrado');
    await audit('agendamento', 'Agendamento atualizado', 'Um agendamento foi atualizado (horário, serviço ou status).');
    return resposta(rows[0]);
  });

  server.registerTool('excluir_agendamento', {
    title: 'Excluir agendamento',
    description: 'Remove um agendamento pelo id.',
    inputSchema: z.object({ id: z.string() }),
  }, async ({ id }) => {
      admin('excluir_agendamento');
    const idv = uuid(id, 'id');
    await query('DELETE FROM public.agendamentos WHERE id = $1', [idv]);
    await audit('agendamento', 'Agendamento excluído', 'Um agendamento foi removido.');
    return resposta({ success: true });
  });

  /* ───────────────────────── Pedidos ───────────────────────── */

  server.registerTool('listar_pedidos', {
    title: 'Listar pedidos',
    description: 'Lista pedidos com filtros opcionais por busca (cliente/email/id) e status.',
    inputSchema: z.object({ busca: z.string().optional(), status: z.string().optional(), limite: z.number().int().min(1).max(1000).optional() }),
  }, async ({ busca, status, limite }) => {
    const conds: string[] = [];
    const params: unknown[] = [];
    if (busca) { params.push(`%${busca}%`); conds.push(`(customer_name ILIKE $${params.length} OR customer_email ILIKE $${params.length} OR id::text ILIKE $${params.length})`); }
    if (status && status !== 'Todos') { params.push(status); conds.push(`status = $${params.length}`); }
    let sql = 'SELECT * FROM public.orders';
    if (conds.length) sql += ` WHERE ${conds.join(' AND ')}`;
    sql += ` ORDER BY created_at DESC LIMIT ${Math.min(Math.max(limite ?? 200, 1), 1000)}`;
    return resposta((await query(sql, params)).rows);
  });

  server.registerTool('atualizar_status_pedido', {
    title: 'Atualizar status de pedido',
    description: 'Altera status e forma de envio de um pedido.',
    inputSchema: z.object({
      id: z.string(),
      status: z.string().optional().describe('Ex: Pendente, Pago, Enviado, Entregue, Cancelado'),
      shipping_method: z.string().optional(),
    }),
  }, async ({ id, status, shipping_method }) => {
    const idv = uuid(id, 'id');
    const { rows } = await query(
      `UPDATE public.orders SET status = COALESCE($2, status), shipping_method = COALESCE($3, shipping_method)
       WHERE id = $1 RETURNING *`,
      [idv, status || null, shipping_method || null]
    );
    if (!rows.length) throw new Error('Pedido não encontrado');
    await audit('pedido', 'Status de pedido alterado', `O status de um pedido foi alterado para "${status || 'mantido'}".`);
    return resposta(rows[0]);
  });

  /* ───────────────────────── Usuários admin ───────────────────────── */

  server.registerTool('listar_usuarios_admin', {
    title: 'Listar usuários administrativos',
    description: 'Lista os usuários do painel administrativo com status (pending, approved, blocked).',
    inputSchema: z.object({ status: z.string().optional() }),
  }, async ({ status }) => {
    if (status && status !== 'all') {
      return resposta((await query('SELECT * FROM public.admin_users WHERE status = $1 ORDER BY created_at DESC', [status])).rows);
    }
    return resposta((await query('SELECT * FROM public.admin_users ORDER BY created_at DESC')).rows);
  });

  server.registerTool('atualizar_usuario_admin', {
    title: 'Atualizar usuário administrativo',
    description: 'Aprova, bloqueia ou define o status de um usuário do painel.',
    inputSchema: z.object({
      id: z.string().describe('UUID (ou id do usuário)'),
      status: z.enum(['approved', 'blocked', 'pending']),
    }),
  }, async ({ id, status }) => {
      admin('atualizar_usuario_admin');
    const idv = uuid(id, 'id');
    const { rowCount } = await query(
      `UPDATE public.admin_users SET status = $2 WHERE id = $1`,
      [idv, status]
    );
    if (!rowCount) throw new Error('Usuário não encontrado');
    const statusRotulo = status === 'approved' ? 'aprovado' : status === 'blocked' ? 'bloqueado' : 'aguardando aprovação';
    await audit('usuario', 'Permissão de administrador alterada', `A permissão de um administrador foi alterada para "${statusRotulo}".`);
    return resposta({ success: true, id: idv, status });
  });

  server.registerTool('excluir_usuario_admin', {
    title: 'Excluir usuário administrativo',
    description: 'Remove um usuário do painel pelo id.',
    inputSchema: z.object({ id: z.string() }),
  }, async ({ id }) => {
      admin('excluir_usuario_admin');
    const idv = uuid(id, 'id');
    const { rowCount } = await query('DELETE FROM public.admin_users WHERE id = $1', [idv]);
    if (!rowCount) throw new Error('Usuário não encontrado');
    await audit('usuario', 'Administrador removido', 'Um administrador foi removido do painel.');
    return resposta({ success: true });
  });

  /* ───────────────────────── Carrossel (slides da home) ───────────────────────── */

  server.registerTool('listar_carrossel', {
    title: 'Listar carrossel da home',
    description: 'Retorna todos os slides do carrossel principal da home (imagens, badge, título, subtítulo e CTAs).',
    inputSchema: z.object({}),
  }, async () => {
    const { rows } = await query(
      `SELECT b.id, b.titulo, b.conteudo
       FROM public.blocos b JOIN public.paginas p ON p.id = b.pagina_id
       WHERE p.slug = 'home' AND b.tipo = 'carrossel' ORDER BY b.ordem LIMIT 1`
    );
    if (!rows.length) throw new Error('Carrossel não encontrado na home');
    return resposta({ bloco_id: rows[0].id, slides: rows[0].conteudo?.slides || [] });
  });

  server.registerTool('atualizar_carrossel', {
    title: 'Atualizar carrossel da home',
    description: 'Substitui os slides do carrossel principal da home. Cada slide aceita: imagem (paisagem/fallback), imagem_retrato (celular), badge, titulo, subtitulo, cta1_label, cta1_link, cta2_label, cta2_link e ativo. Imagens podem ser caminhos locais (/images/...), URLs ou data URI de upload.',
    inputSchema: z.object({
      slides: z.array(z.object({
        imagem: z.string().optional(),
        imagem_paisagem: z.string().optional(),
        imagem_retrato: z.string().optional(),
        badge: z.string().optional(),
        titulo: z.string().optional(),
        subtitulo: z.string().optional(),
        cta1_label: z.string().optional(),
        cta1_link: z.string().optional(),
        cta2_label: z.string().optional(),
        cta2_link: z.string().optional(),
        ativo: z.boolean().optional(),
      })),
    }),
  }, async ({ slides }) => {
      admin('atualizar_carrossel');
    if (!slides.length) throw new Error('Informe ao menos um slide');
    const { rows } = await query(
      `SELECT b.id FROM public.blocos b JOIN public.paginas p ON p.id = b.pagina_id
       WHERE p.slug = 'home' AND b.tipo = 'carrossel' ORDER BY b.ordem LIMIT 1`
    );
    if (!rows.length) throw new Error('Carrossel não encontrado na home');
    const { rows: atualizado } = await query(
      `UPDATE public.blocos SET conteudo = $2::jsonb WHERE id = $1 RETURNING conteudo`,
      [rows[0].id, JSON.stringify({ slides })]
    );
    return resposta({ success: true, slides: atualizado[0].conteudo.slides.length });
  });

  /* ───────────────────────── Chat (Chatwoot) e WhatsApp ───────────────────────── */

  server.registerTool('listar_integracoes_contato', {
    title: 'Listar integrações de contato',
    description: 'Retorna as configurações de WhatsApp (número, link, mensagem) e Chat (Chatwoot url/token) usadas no site.',
    inputSchema: z.object({}),
  }, async () => {
    const { rows } = await query("SELECT chave, valor FROM public.configuracoes WHERE chave IN ('whatsapp.numero','whatsapp.mensagem','chatwoot.url','chatwoot.token')");
    const cfg: Record<string, unknown> = {};
    for (const r of rows) cfg[r.chave] = r.valor;
    return resposta(cfg);
  });

  server.registerTool('atualizar_whatsapp', {
    title: 'Atualizar WhatsApp do site',
    description: 'Altera o número/link e a mensagem padrão do WhatsApp (botão flutuante e CTAs).',
    inputSchema: z.object({
      numero: z.string().optional().describe('Número no formato (11) 99999-9999'),
      link: z.string().optional().describe('Link wa.me completo'),
      mensagem: z.string().optional().describe('Texto padrão da saudação'),
    }),
  }, async ({ numero, link, mensagem }) => {
      admin('atualizar_whatsapp');
    const upsert = async (chave: string, valor: unknown) => {
      await query(
        `INSERT INTO public.configuracoes (chave, valor, descricao) VALUES ($1,$2,$3)
         ON CONFLICT (chave) DO UPDATE SET valor = $2`,
        [chave, JSON.stringify(valor), `WhatsApp ${chave}`]
      );
    };
    if (numero !== undefined || link !== undefined) {
      const atual = await query("SELECT valor FROM public.configuracoes WHERE chave='whatsapp.numero'");
      const v = atual.rows[0]?.valor || {};
      if (numero !== undefined) {
        const digits = numero.replace(/\D/g, '');
        const linkGerado = link || `https://wa.me/55${digits}`;
        await upsert('whatsapp.numero', { numero, link: linkGerado });
      } else if (link !== undefined) {
        await upsert('whatsapp.numero', { ...v, link });
      }
    }
    if (mensagem !== undefined) {
      await upsert('whatsapp.mensagem', mensagem);
    }
    return resposta({ success: true });
  });

  server.registerTool('atualizar_chat_chatwoot', {
    title: 'Atualizar Chat (Chatwoot) do site',
    description: 'Altera a URL e o token da caixa de entrada do Chatwoot usados pelos fluxos de chat do site.',
    inputSchema: z.object({
      url: z.string().optional().describe('Ex: https://chat.digitalarea.online'),
      token: z.string().optional().describe('website_token da caixa de entrada'),
    }),
  }, async ({ url, token }) => {
      admin('atualizar_chat_chatwoot');
    const upsert = async (chave: string, valor: unknown) => {
      await query(
        `INSERT INTO public.configuracoes (chave, valor, descricao) VALUES ($1,$2,$3)
         ON CONFLICT (chave) DO UPDATE SET valor = $2`,
        [chave, JSON.stringify(valor), `Chatwoot ${chave}`]
      );
    };
    if (url !== undefined) await upsert('chatwoot.url', url.replace(/\/+$/, ''));
    if (token !== undefined) await upsert('chatwoot.token', token);
    return resposta({ success: true });
  });

  /* ───────────────────────── Pedidos: rastreio + status com notificação ───────────────────────── */

  server.registerTool('atualizar_rastreio_pedido', {
    title: 'Atualizar rastreio e status de pedido',
    description: 'Atualiza código de rastreamento dos Correios, link de acompanhamento do entregador, método de envio e/ou status de um pedido. Se status ou rastreio mudarem, envia e-mail de notificação ao cliente e, quando enviado com rastreio, solicita ao agente de atendimento informar o cliente (template por status: aprovado, em preparação, enviado com código/link, cancelado, devolução).',
    inputSchema: z.object({
      id: z.string().describe('UUID do pedido'),
      status: z.string().optional().describe('RECEBIDO | APROVADO | EM_PREPARACAO | ENVIADO | CANCELADO | DEVOLUCAO'),
      tracking_code: z.string().optional().describe('Código dos Correios, ex: LB123456789BR'),
      tracking_link: z.string().optional().describe('Link para acompanhar a corrida do entregador (ex: rastreio da transportadora)'),
      shipping_method: z.string().optional(),
    }),
  }, async ({ id, status, tracking_code, tracking_link, shipping_method }) => {
    const idv = uuid(id, 'id');
    const antes = await query('SELECT * FROM public.orders WHERE id = $1', [idv]);
    if (!antes.rows.length) throw new Error('Pedido não encontrado');
    const atual = antes.rows[0];
    const statusMudou = status && status !== atual.status;
    const rastreioMudou = (tracking_code !== undefined && tracking_code !== atual.tracking_code)
      || (tracking_link !== undefined && tracking_link !== atual.tracking_link);
    const { rows } = await query(
      `UPDATE public.orders
       SET status = COALESCE($2, status),
           shipping_method = COALESCE($3, shipping_method),
           tracking_code = COALESCE($4, tracking_code),
           tracking_link = COALESCE($5, tracking_link)
       WHERE id = $1 RETURNING *`,
      [idv, status || null, shipping_method || null, tracking_code || null, tracking_link || null]
    );
    if (statusMudou || rastreioMudou) {
      try {
        const { notificarStatusPedido } = await import('@/utils/pedido-emails');
        await notificarStatusPedido({
          id: rows[0].id, customer_name: rows[0].customer_name, customer_email: rows[0].customer_email,
          status: rows[0].status, tracking_code: rows[0].tracking_code, tracking_link: rows[0].tracking_link,
          shipping_method: rows[0].shipping_method, total_price: rows[0].total_price,
        });
      } catch (e: any) {
        console.error('[MCP] Erro ao notificar pedido:', e?.message);
      }
      if (rows[0].status === 'ENVIADO' && (rows[0].tracking_code || rows[0].tracking_link)) {
        try {
          const { solicitarAgenteInformarEnvio } = await import('@/utils/solicitar-agente');
          await solicitarAgenteInformarEnvio({
            pedidoId: rows[0].id,
            clienteNome: rows[0].customer_name,
            clienteEmail: rows[0].customer_email,
            clienteTelefone: rows[0].customer_phone,
          });
        } catch (e: any) {
          console.error('[MCP] Falha ao acionar agente:', e?.message);
        }
      }
    }
    return resposta({ success: true, status: rows[0].status, tracking_code: rows[0].tracking_code, tracking_link: rows[0].tracking_link });
  });

  /* ───────────────────────── Usuários admin: criação ───────────────────────── */

  server.registerTool('criar_usuario_admin', {
    title: 'Criar usuário administrativo',
    description: 'Cria um usuário com acesso ao painel administrativo. Se senha for informada, login por e-mail+senha; caso contrário, login por Google. Envia e-mail de boas-vindas com o método de login.',
    inputSchema: z.object({
      email: z.string().email(),
      nome: z.string().min(2),
      senha: z.string().min(8).optional(),
      status: z.enum(['approved', 'pending']).optional().describe('Padrão approved'),
    }),
  }, async ({ email, nome, senha, status }) => {
      admin('criar_usuario_admin');
    const finalEmail = email.trim().toLowerCase();
    const existing = await query('SELECT id FROM public.users WHERE email = $1', [finalEmail]);
    if (existing.rows.length > 0) throw new Error('Este email já está cadastrado');
    const { hashPassword } = await import('@/utils/auth/password');
    const passwordHash = senha ? await hashPassword(senha) : '';
    const novoStatus = status === 'pending' ? 'pending' : 'approved';
    const { rows } = await query(
      `INSERT INTO public.users (email, password_hash, full_name, role) VALUES ($1,$2,$3,'admin') RETURNING id, email, full_name`,
      [finalEmail, passwordHash, nome.trim()]
    );
    await query(
      `INSERT INTO public.admin_users (id, email, full_name, status) VALUES ($1,$2,$3,$4)
       ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, status = EXCLUDED.status`,
      [rows[0].id, finalEmail, nome.trim(), novoStatus]
    );
    if (novoStatus === 'approved') {
      try {
        const { notificarNovoAdmin } = await import('@/lib/admin-notify');
        await notificarNovoAdmin({ email: finalEmail, nome: nome.trim(), temSenha: !!senha });
      } catch (e: any) {
        console.error('[MCP] Erro ao notificar novo admin:', e?.message);
      }
    }
    return resposta({ success: true, id: rows[0].id, email: finalEmail, status: novoStatus });
  });

  /* ───────────────────────── Geração de imagem por IA ───────────────────────── */

  server.registerTool('gerar_imagem_ia', {
    title: 'Gerar imagem com IA',
    description: 'Gera uma imagem via OpenAI (gpt-image-2) a partir de um prompt e retorna como data URI PNG — pronta para usar em galeria, carrossel ou campanha. Requer OPENAI_API_KEY configurada.',
    inputSchema: z.object({
      prompt: z.string().describe('Descrição detalhada da imagem desejada'),
      tamanho: z.enum(['1024x1024', '1024x1792', '1792x1024']).optional().describe('Padrão 1024x1024'),
    }),
  }, async ({ prompt, tamanho = '1024x1024' }) => {
      admin('gerar_imagem_ia');
    const API_KEY = process.env.OPENAI_API_KEY;
    if (!API_KEY) throw new Error('OPENAI_API_KEY não configurada');
    const openaiRes = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({ model: 'gpt-image-2', prompt, n: 1, size: tamanho, quality: 'low' }),
      signal: AbortSignal.timeout(90000),
    });
    if (!openaiRes.ok) {
      const errData = await openaiRes.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `OpenAI API error: ${openaiRes.status}`);
    }
    const data = await openaiRes.json();
    const b64 = data?.data?.[0]?.b64_json as string | undefined;
    const url = data?.data?.[0]?.url || (b64 ? `data:image/png;base64,${b64}` : undefined);
    if (!url) throw new Error('Nenhuma imagem gerada');
    return resposta({ success: true, imagem: url, dica: 'Use esta imagem em atualizar_carrossel, adicionar_galeria ou campanhas (data URI).' });
  });

  /* ───────────────────────── Venda e backend completo ───────────────────────── */

  server.registerTool('calcular_entrega', {
    title: 'Calcular entrega (frete)',
    description: 'Calcula o custo de entrega e o total de um pedido (subtotal + frete - desconto), de acordo com o método: pac, sedex, motoboy ou retirada (grátis).',
    inputSchema: z.object({
      items: z.array(z.object({ id: z.string(), quantity: z.number().int().min(1) })).min(1),
      shipping_method: z.enum(['pac', 'sedex', 'motoboy', 'retirada']).default('pac'),
      coupon: z.string().optional().describe('Código do cupom, ex: BEMVINDA10'),
    }),
  }, async ({ items, shipping_method, coupon }) => {
    const frete: Record<string, number> = { pac: 25.90, sedex: 48.90, motoboy: 0, retirada: 0 };
    let subtotal = 0;
    const detalhe: { id: string; name?: string; price?: number; quantity: number }[] = [];
    for (const item of items) {
      const idv = uuid(item.id, 'item.id');
      const { rows } = await query('SELECT id, name, price, stock FROM public.produtos WHERE id = $1', [idv]);
      if (!rows.length) throw new Error(`Produto não encontrado: ${item.id}`);
      const p = rows[0];
      if (Number(p.stock ?? 0) < item.quantity) {
        throw new Error(`Estoque insuficiente para "${p.name}" (disponível: ${p.stock})`);
      }
      subtotal += Number(p.price) * item.quantity;
      detalhe.push({ id: p.id, name: p.name, price: Number(p.price), quantity: item.quantity });
    }
    let desconto = 0;
    if (coupon) {
      const { rows } = await query("SELECT valor FROM public.configuracoes WHERE chave='cupons'");
      const cupons = rows[0]?.valor || {};
      const perc = cupons[coupon.toUpperCase()] ?? { BEMVINDA10: 10, FRAN15: 15, ATACADO20: 20 }[coupon.toUpperCase()];
      if (perc) desconto = (subtotal * (Number(perc) / 100));
    }
    const freteVal = frete[shipping_method] ?? 25.90;
    const total = Number((subtotal - desconto + freteVal).toFixed(2));
    return resposta({
      itens: detalhe, subtotal: Number(subtotal.toFixed(2)), desconto: Number(desconto.toFixed(2)),
      frete: freteVal, total, metodo: shipping_method,
    });
  });

  server.registerTool('consultar_produto', {
    title: 'Consultar produto (catálogo)',
    description: 'Consulta um produto por id ou slug, retornando dados completos (preço, estoque, descrição, imagens, categoria, badge).',
    inputSchema: z.object({
      id: z.string().optional(),
      slug: z.string().optional(),
    }),
  }, async ({ id, slug }) => {
    if (!id && !slug) throw new Error('Informe id ou slug');
    const { rows } = id
      ? await query('SELECT * FROM public.produtos WHERE id = $1', [uuid(id)])
      : await query('SELECT * FROM public.produtos WHERE slug = $1', [slug]);
    if (!rows.length) throw new Error('Produto não encontrado');
    return resposta(rows[0]);
  });

  server.registerTool('registrar_cliente', {
    title: 'Registrar cliente',
    description: 'Cria uma conta de cliente no site (users), com login por e-mail+senha ou Google (se nenhuma senha informada). Nome, CPF e telefone podem ser registrados.',
    inputSchema: z.object({
      email: z.string().email(),
      nome: z.string().min(2),
      senha: z.string().min(8).optional(),
      cpf: z.string().optional(),
      phone: z.string().optional(),
    }),
  }, async ({ email, nome, senha, cpf, phone }) => {
    const finalEmail = email.trim().toLowerCase();
    const existing = await query('SELECT id FROM public.users WHERE email = $1', [finalEmail]);
    if (existing.rows.length > 0) throw new Error('Este e-mail já está cadastrado');
    const { hashPassword } = await import('@/utils/auth/password');
    const passwordHash = senha ? await hashPassword(senha) : '';
    const { rows } = await query(
      `INSERT INTO public.users (email, password_hash, full_name, cpf, phone, role)
       VALUES ($1, $2, $3, $4, $5, 'user') RETURNING id, email, full_name, cpf, phone, role`,
      [finalEmail, passwordHash, nome.trim(), cpf?.replace(/\D/g, '') || null, phone?.trim() || null]
    );
    return resposta({ success: true, cliente: rows[0], login: senha ? 'email+senha' : 'google' });
  });

  server.registerTool('registrar_endereco', {
    title: 'Registrar endereço de cliente',
    description: 'Cadastra ou atualiza o endereço de um cliente (identificado por e-mail). Se is_default, desmarca os demais do mesmo cliente.',
    inputSchema: z.object({
      email: z.string().email(),
      zip_code: z.string().min(8),
      street: z.string().min(2),
      number: z.string().min(1),
      complement: z.string().optional(),
      neighborhood: z.string().min(2),
      city: z.string().min(2),
      state: z.string().length(2),
      label: z.string().optional(),
      is_default: z.boolean().optional(),
    }),
  }, async ({ email, zip_code, street, number, complement, neighborhood, city, state, label, is_default }) => {
    const { rows: user } = await query('SELECT id FROM public.users WHERE email = $1', [email.trim().toLowerCase()]);
    if (!user.length) throw new Error('Cliente não encontrado. Use registrar_cliente primeiro.');
    const userId = user[0].id;
    if (is_default) {
      await query('UPDATE public.user_addresses SET is_default = false WHERE user_id = $1', [userId]);
    }
    const { rows } = await query(
      `INSERT INTO public.user_addresses (user_id, zip_code, street, number, complement, neighborhood, city, state, label, is_default)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [userId, zip_code, street, number, complement || '', neighborhood, city, state.toUpperCase(), label || 'Principal', !!is_default]
    );
    return resposta({ success: true, endereco: rows[0] });
  });

  server.registerTool('dar_baixa_produto', {
    title: 'Dar baixa em produto (estoque)',
    description: 'Reduz (ou ajusta) o estoque de produtos. quantidade (inteiro positivo) debita; use estoque_total para definir valor absoluto. Atualiza stock_status automaticamente.',
    inputSchema: z.object({
      id: z.string(),
      quantidade: z.number().int().min(1).optional().describe('Quantidade a debitar do estoque'),
      estoque_total: z.number().int().min(0).optional().describe('Define o estoque absoluto (substitui o atual)'),
    }),
  }, async ({ id, quantidade, estoque_total }) => {
    const idv = uuid(id, 'id');
    const { rows: cur } = await query('SELECT id, name, stock FROM public.produtos WHERE id = $1', [idv]);
    if (!cur.length) throw new Error('Produto não encontrado');
    const stockAtual = Number(cur[0].stock ?? 0);
    let novoEstoque = stockAtual;
    if (estoque_total !== undefined) novoEstoque = estoque_total;
    else if (quantidade !== undefined) {
      if (quantidade > stockAtual) throw new Error(`Estoque insuficiente: disponível ${stockAtual}`);
      novoEstoque = stockAtual - quantidade;
    } else throw new Error('Informe quantidade ou estoque_total');
    const { rows } = await query(
      `UPDATE public.produtos SET stock = $2,
         stock_status = CASE WHEN $2 > 0 THEN 'Em estoque' ELSE 'Indisponível' END
       WHERE id = $1 RETURNING id, name, stock, stock_status`,
      [idv, novoEstoque]
    );
    return resposta({ success: true, produto: rows[0], baixa: quantidade ?? null, anterior: stockAtual });
  });

  server.registerTool('realizar_venda', {
    title: 'Realizar venda (checkout completo)',
    description: 'Executa uma venda igual ao checkout do site: valida e debita estoque, cria pedido (RECEBIDO) e cobrança no provedor (PIX/cartão/boleto via Asaas). Retorna QR PIX, boleto ou fatura para o cliente pagar. DISPARA COBRANÇA REAL — confirme com o usuário antes.',
    inputSchema: z.object({
      nome: z.string().min(2),
      email: z.string().email(),
      cpf: z.string().min(11),
      phone: z.string().min(8),
      items: z.array(z.object({ id: z.string(), quantity: z.number().int().min(1) })).min(1),
      payment_method: z.enum(['pix', 'credit', 'boleto']).default('pix'),
      shipping_method: z.enum(['pac', 'sedex', 'motoboy', 'retirada']).default('pac'),
      shipping_address: z.object({
        street: z.string().optional(), number: z.string().optional(), complement: z.string().optional(),
        neighborhood: z.string().optional(), city: z.string().optional(), state: z.string().optional(),
        zip_code: z.string().optional(), cep: z.string().optional(),
      }).optional(),
      coupon: z.string().optional(),
      card: z.object({
        number: z.string().optional(), name: z.string().optional(), expiry: z.string().optional(),
        cvv: z.string().optional(), installments: z.number().int().min(1).max(12).optional(),
        address: z.object({ postalCode: z.string().optional(), number: z.string().optional(), complement: z.string().optional(), phone: z.string().optional() }).optional(),
      }).optional(),
    }),
  }, async (args) => {
    const { nome, email, cpf, phone, items, payment_method, shipping_method, shipping_address, coupon, card } = args;
    const { getConfigPagamento, criarCobranca, salvarIdsPagamento } = await import('@/utils/pagamentos');
    const pagamento = await getConfigPagamento();
    if (!pagamento.apiKey) throw new Error('Token de pagamento não configurado');

    // 1. Valida + debita estoque (preço vem do banco — nunca do cliente)
    const decremented: { id: string; quantity: number; price: number; name?: string; slug?: string; origin?: string; image?: string }[] = [];
    for (const item of items) {
      const { rows } = await query(
        `UPDATE public.produtos SET stock = stock - $1,
             stock_status = CASE WHEN stock - $1 > 0 THEN 'Em estoque' ELSE 'Indisponível' END
         WHERE id = $2 AND stock >= $1 RETURNING stock, name, price, slug, origin, images`,
        [item.quantity, uuid(item.id, 'item.id')]
      );
      if (!rows.length) {
        for (const dec of decremented) await query('UPDATE public.produtos SET stock = stock + $1 WHERE id = $2', [dec.quantity, dec.id]);
        throw new Error(`Estoque insuficiente ou produto inválido: ${item.id}`);
      }
      const p = rows[0];
      const imagem = Array.isArray(p.images) && p.images.length > 0
        ? (typeof p.images[0] === 'string' ? p.images[0] : (p.images[0]?.url || ''))
        : `/produtos/${p.slug || item.id}.jpg`;
      decremented.push({
        id: item.id,
        quantity: item.quantity,
        price: Number(p.price),
        name: p.name || 'Produto',
        slug: p.slug || '',
        origin: p.origin || '',
        image: imagem,
      });
    }
    const revert = async () => {
      for (const dec of decremented) await query('UPDATE public.produtos SET stock = stock + $1 WHERE id = $2', [dec.quantity, dec.id]);
    };

    try {
      // 2. Totais (mesma regra do site)
      const subtotal = decremented.reduce((s, i) => s + i.price * i.quantity, 0);
      const cupons: Record<string, number> = { BEMVINDA10: 10, FRAN15: 15, ATACADO20: 20 };
      const desconto = coupon && cupons[coupon.toUpperCase()] ? subtotal * (cupons[coupon.toUpperCase()] / 100) : 0;
      const frete = shipping_method === 'sedex' ? 48.90 : shipping_method === 'motoboy' || shipping_method === 'retirada' ? 0 : 25.90;
      const total = Number((subtotal - desconto + frete).toFixed(2));
      if (total <= 0) { await revert(); throw new Error('Total inválido (menor ou igual a zero)'); }

      // 3. Pedido
      const { rows: orderRows } = await query(
        `INSERT INTO public.orders (customer_name, customer_email, customer_cpf, customer_phone, items, subtotal, discount, shipping, total_price, payment_method, status, shipping_method, shipping_address)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'RECEBIDO',$11,$12) RETURNING id`,
        [nome, email, cpf, phone, JSON.stringify(decremented), subtotal, desconto, frete, total, payment_method, shipping_method, shipping_address ? JSON.stringify(shipping_address) : null]
      );
      const orderId = orderRows[0].id;

      // 4. Cobrança no provedor
      const resultado = await criarCobranca({
        cliente: { name: nome, email, cpf, phone },
        valor: total,
        descricao: `Pedido #${orderId} - ${items.length} itens`,
        metodo: payment_method,
        pedidoId: orderId,
        card: (card as DadosCartao) ?? null,
      });

      // 5. Persiste IDs do pagamento
      try {
        await salvarIdsPagamento(orderId, resultado.paymentId, resultado.invoiceUrl, resultado.pixQrCodePayload ?? resultado.pixQrCodeUrl ?? null, resultado.boletoUrl, resultado.boletoLinha);
      } catch (e: any) { console.error('[MCP] salvar ids:', e?.message); }

      return resposta({ success: true, pedido_id: orderId, pagamento: resultado });
    } catch (e: any) {
      await revert();
      throw e;
    }
  });

  /* ───────────────────────── Identidade: favicon ───────────────────────── */

  server.registerTool('listar_favicon', {
    title: 'Listar favicon do site',
    description: 'Retorna o nome do favicon atual configurado (identidade visual).',
    inputSchema: z.object({}),
  }, async () => {
    const { rows } = await query("SELECT valor FROM public.configuracoes WHERE chave = 'site.favicon'");
    return resposta({ favicon: rows[0]?.valor || null });
  });

  server.registerTool('atualizar_favicon', {
    title: 'Atualizar favicon do site',
    description: 'Substitui o favicon do site. Aceita nome_existente (usa um asset já salvo em site_assets) ou dados (data URI PNG/JPEG/WEBP/SVG/ICO). Altera a identidade visual globalmente.',
    inputSchema: z.object({
      nome_existente: z.string().optional().describe('Nome de um asset já salvo em site_assets'),
      dados: z.string().optional().describe('Data URI da imagem (ex: data:image/png;base64,...) ou URL http(s) da imagem'),
    }),
  }, async ({ nome_existente, dados }) => {
    admin('atualizar_favicon');
    const MIME_MAP: Record<string, string> = {
      'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg',
      'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico',
    };
    let nomeLimpo = nome_existente;
    let bytes: Buffer | null = null;
    let mime: string | null = null;

    if (dados) {
      // data URI ou URL remota
      if (dados.startsWith('data:image/')) {
        const m = dados.match(/^data:([^;]+);base64,([\s\S]*)$/);
        if (!m) throw new Error('Data URI inválida (somente base64)');
        mime = m[1];
        bytes = Buffer.from(m[2], 'base64');
        const ext = MIME_MAP[mime] || 'png';
        nomeLimpo = `favicon-mcp.${ext}`;
      } else if (/^https?:\/\//.test(dados)) {
        const res = await fetch(dados, { signal: AbortSignal.timeout(20000) });
        if (!res.ok) throw new Error(`Falha ao baixar imagem: HTTP ${res.status}`);
        bytes = Buffer.from(await res.arrayBuffer());
        mime = res.headers.get('content-type') || 'image/png';
        const ext = MIME_MAP[mime?.split(';')[0] || ''] || 'png';
        nomeLimpo = `favicon-mcp.${ext}`;
      } else {
        throw new Error('dados deve ser data URI (data:image/...) ou URL http(s)');
      }
      if (bytes.length > 2 * 1024 * 1024) throw new Error('Imagem muito grande (máx 2MB)');
      await query(
        `INSERT INTO public.site_assets (nome, mime, dados, updated_at)
         VALUES ($1,$2,$3,NOW())
         ON CONFLICT (nome) DO UPDATE SET mime = $2, dados = $3, updated_at = NOW()`,
        [nomeLimpo, mime, bytes]
      );
    } else if (!nomeLimpo) {
      throw new Error('Informe nome_existente ou dados (data URI/URL)');
    }

    await query(
      `INSERT INTO public.configuracoes (chave, valor, descricao)
       VALUES ('site.favicon', $1, 'Favicon do site (nome do arquivo em site_assets)')
       ON CONFLICT (chave) DO UPDATE SET valor = $1`,
      [JSON.stringify({ nome: nomeLimpo })]
    );
    return resposta({ success: true, favicon: nomeLimpo });
  });

  /* ───────────────────────── Cópia / restauração do site ───────────────────────── */

  server.registerTool('listar_snapshots_site', {
    title: 'Listar cópias (backups) do site',
    description: 'Lista os snapshots/backups do conteúdo do site disponíveis para restauração, com data e tamanho.',
    inputSchema: z.object({}),
  }, async () => {
    const { listarBackups } = await import('@/lib/backups/backups');
    return resposta(await listarBackups());
  });

  server.registerTool('criar_snapshot_site', {
    title: 'Criar cópia do site (snapshot)',
    description: 'Gera um snapshot de TODO o conteúdo gerenciável do site (páginas, blocos, configurações, produtos, campanhas, galeria, depoimentos, leads, agendamentos, pedidos) — útil antes de reformular a identidade para poder voltar atrás.',
    inputSchema: z.object({
      nome: z.string().optional().describe('Descrição da cópia (ex: "Antes da reformulação 2026-08")'),
    }),
  }, async ({ nome }) => {
    admin('criar_snapshot_site');
    const { criarBackup } = await import('@/lib/backups/backups');
    const backup = await criarBackup(nome || '', 'mcp');
    return resposta({ success: true, snapshot: { id: backup.id, nome: backup.nome, criado_em: backup.created_at, tamanho_bytes: backup.tamanho_bytes } });
  });

  server.registerTool('restaurar_snapshot_site', {
    title: 'Restaurar cópia do site',
    description: 'SUBSTITUI todo o conteúdo atual do site (páginas, blocos, configs, produtos, campanhas, galeria, depoimentos, leads, agendamentos, pedidos) pelo conteúdo de um snapshot. IRREVERSÍVEL — confirme com o usuário. Recomenda-se criar um snapshot antes.',
    inputSchema: z.object({
      id: z.string().describe('UUID do snapshot (use listar_snapshots_site)'),
    }),
  }, async ({ id }) => {
    admin('restaurar_snapshot_site');
    const { obterBackup, restaurarConteudo } = await import('@/lib/backups/backups');
    const backup = await obterBackup(id);
    const resultado = await restaurarConteudo(backup.payload);
    return resposta({ success: true, restaurado: resultado });
  });
}