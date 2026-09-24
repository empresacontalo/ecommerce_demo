'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { statusCampanha } from '@/utils/campanhas';
import { arquivoImagemValido, ehLinkValido, redimensionarImagemParaEnvio } from '@/utils/imagem';

interface Campanha {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  tipo_campanha: string;
  categoria: string | null;
  prioridade: number;
  canal_padrao: string;
  follow_up_horas: number;
  desconto: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  ativo: boolean;
  cupom_codigo: string | null;
  cupom_escopo: string;
  cupom_marca: string | null;
  cupom_produtos: string[] | null;
  qtd_imagens?: string;
  qtd_leads?: string;
}

interface Imagem {
  id: string;
  url: string;
  url_paisagem?: string;
  url_retrato?: string;
  ordem: number;
  status: string;
  criada_por_ia: boolean;
}

interface Lead {
  id: string;
  nome: string;
  whatsapp: string | null;
  email: string | null;
  canal_preferido: string;
  status_comunicacao: string;
  criado_em: string;
}

interface Historico {
  id: string;
  acao: string;
  detalhes: string | null;
  criado_em: string;
}

const STATUS_COLORS: Record<string, string> = {
  ativa: 'badge-success',
  programada: 'badge-warning',
  encerrada: 'badge-secondary',
  desativada: 'badge-secondary',
};

const TIPOS_CATEGORIA = ['', 'dia_das_maes', 'dia_dos_pais', 'black_friday', 'natal', 'aniversario', 'casamento', 'namoro', 'compromisso', 'outra'];

const DECORACOES_TIPOS = [
  { nome: 'grinalda', icone: '🌿', label: 'Grinalda' },
  { nome: 'baloes', icone: '🎈', label: 'Balões' },
  { nome: 'rosas', icone: '🌹', label: 'Rosas' },
  { nome: 'coracoes', icone: '❤️', label: 'Corações' },
  { nome: 'cupido', icone: '🏹', label: 'Cupido' },
  { nome: 'tema_maes', icone: '🌸', label: 'Dia das Mães' },
  { nome: 'tema_pais', icone: '👔', label: 'Dia dos Pais' },
  { nome: 'tema_black_friday', icone: '🛍️', label: 'Black Friday' },
  { nome: 'tema_natal', icone: '🎄', label: 'Natal' },
  { nome: 'outro', icone: '✨', label: 'Outro' },
];

interface Decoracao {
  id: string;
  tipo: string;
}

function statusCampanhaLocal(c: { ativo: boolean; data_inicio?: string | null; data_fim?: string | null }): string {
  return statusCampanha({
    id: '', titulo: '', descricao: null, imagem_url: null, link_url: null, tipo: 'banner',
    tipo_campanha: 'global', categoria: null, prioridade: 0, mensagem_prompt: null,
    canal_padrao: 'whatsapp', follow_up_horas: 24, desconto: null, criado_por: null,
    data_inicio: c.data_inicio || null,
    data_fim: c.data_fim || null,
    ativo: c.ativo,
    created_at: new Date(), updated_at: new Date(),
  });
}

const formStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.6rem 0.75rem',
  borderRadius: '8px',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  fontSize: '0.9rem',
};

export default function AdminCampanhas() {
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<Campanha | null>(null);
  const [nova, setNova] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [aba, setAba] = useState<{ id: string; nome: string; aba: 'imagens' | 'leads' | 'historico' | 'decoracoes' } | null>(null);
  const [imagens, setImagens] = useState<Imagem[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [decoracoes, setDecoracoes] = useState<Decoracao[]>([]);
const [historico, setHistorico] = useState<Historico[]>([]);
  const [msg, setMsg] = useState('');
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);
  const [uploadLink, setUploadLink] = useState('');
  const [enviandoLink, setEnviandoLink] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [produtos, setProdutos] = useState<{ id: string; name: string; origin: string | null }[]>([]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cms/campanhas?admin=1');
      if (res.ok) setCampanhas(await res.json());
    } catch { /* noop */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { const t = setTimeout(carregar, 0); return () => clearTimeout(t); }, [carregar]);

  // Produtos do catálogo (para escolher marca e lista de produtos do cupom)
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/admin/produtos', { cache: 'no-store' });
        if (res.ok && active) {
          const data = (await res.json()) as { id: string; name: string; origin: string | null }[];
          setProdutos(Array.isArray(data) ? data : []);
        }
      } catch { /* noop */ }
    })();
    return () => { active = false; };
  }, []);

  // Marcas distintas do catálogo, em ordem alfabética
  const marcas = Array.from(new Set(produtos.map((p) => p.origin).filter((o): o is string => !!o && o.trim().length > 0)))
    .sort((a, b) => a.localeCompare(b, 'pt'));

  const gerarCupom = () => {
    const titulo = form['titulo'] || '';
    const base = titulo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const novo = (base || 'CUPOM').slice(0, 16);
    setForm((p) => ({ ...p, cupom_codigo: novo }));
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, unknown> = { ...form };
    body.ativo = form.ativo === 'true';
    body.prioridade = Number(form.prioridade || 0);
    body.follow_up_horas = Number(form.follow_up_horas || 24);
    // Escopo de cupom: encaminha marca/produtos somente quando aplicáveis
    if (form.cupom_escopo === 'produtos') {
      try {
        const lista = JSON.parse(form['cupom_produtos'] || '[]');
        body.cupom_produtos = Array.isArray(lista) ? lista : [];
      } catch {
        body.cupom_produtos = [];
      }
    } else {
      body.cupom_produtos = [];
      if (form.cupom_escopo !== 'marca') body.cupom_marca = null;
    }
    const url = editando ? '/api/cms/campanhas' : '/api/cms/campanhas';
    const method = editando ? 'PUT' : 'POST';
    if (editando) body.id = editando.id;
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) {
      setNova(false);
      setEditando(null);
      setForm({});
      carregar();
    } else {
      const d = await res.json().catch(() => ({}));
      setMsg(d?.error || 'Erro ao salvar');
    }
  };

  const toggleAtivo = async (c: Campanha) => {
    const res = await fetch('/api/cms/campanhas', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id, ativo: !c.ativo }),
    });
    if (res.ok) carregar();
  };

  const excluir = async (c: Campanha) => {
    if (!confirm(`Excluir a campanha "${c.titulo}"?`)) return;
    await fetch('/api/cms/campanhas', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id }),
    });
    carregar();
  };

  const abrir = async (c: Campanha, aba: 'imagens' | 'leads' | 'historico' | 'decoracoes') => {
    setAba({ id: c.id, nome: c.titulo, aba });
    setImagens([]); setLeads([]); setHistorico([]); setDecoracoes([]);
    if (aba === 'imagens') {
      const r = await fetch(`/api/cms/campanhas/${c.id}/imagens`);
      if (r.ok) setImagens(await r.json());
    } else if (aba === 'leads') {
      const r = await fetch(`/api/cms/campanhas/${c.id}/leads`);
      if (r.ok) {
        const d = await r.json();
        setLeads(d.leads || []);
      }
    } else if (aba === 'historico') {
      const r = await fetch(`/api/cms/campanhas/${c.id}/historico`);
      if (r.ok) setHistorico(await r.json());
    } else if (aba === 'decoracoes') {
      const r = await fetch(`/api/cms/campanhas/${c.id}/decoracoes`);
      if (r.ok) setDecoracoes(await r.json());
    }
  };

  const gerarImagemIA = async (prompt: string) => {
    if (!aba) return;
    const r = await fetch(`/api/cms/campanhas/${aba.id}/imagens/gerar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setMsg(d?.error || 'Erro ao gerar imagem');
      return;
    }
    setImagens((p) => [d, ...p]);
  };

  /** Envia a imagem (data URI de upload ou link online) ao servidor e adiciona na campanha. */
  const adicionarImagemCampanha = async (origem: { dataUri?: string; url?: string }) => {
    if (!aba) return;
    try {
      const up = await fetch('/api/admin/imagem-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(origem),
      });
      const upData = await up.json().catch(() => ({}));
      if (!up.ok) throw new Error(upData?.error || `Falha ao processar a imagem (HTTP ${up.status})`);
      const r = await fetch(`/api/cms/campanhas/${aba.id}/imagens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: upData.url, status: 'aprovada', criada_por_ia: false }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'Erro ao adicionar imagem na campanha');
      setImagens((p) => [d, ...p]);
      setMsg('Imagem adicionada!');
      setTimeout(() => setMsg(''), 2500);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Erro ao adicionar imagem');
    }
  };

  const escolherArquivo = async (file: File | null | undefined) => {
    if (!file) return;
    if (!arquivoImagemValido(file)) {
      setMsg('Envie uma imagem (JPG, PNG, WEBP, GIF, AVIF ou SVG) de até 8MB.');
      return;
    }
    setEnviandoArquivo(true);
    try {
      const dataUri = await redimensionarImagemParaEnvio(file);
      await adicionarImagemCampanha({ dataUri });
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Falha ao processar a imagem.');
    } finally {
      setEnviandoArquivo(false);
    }
  };

  const usarLinkImagem = async () => {
    const link = uploadLink.trim();
    if (!link) return;
    if (!ehLinkValido(link)) {
      setMsg('Informe um link válido começando com http:// ou https://');
      return;
    }
    setEnviandoLink(true);
    try {
      await adicionarImagemCampanha({ url: link });
      setUploadLink('');
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Falha ao baixar a imagem do link.');
    } finally {
      setEnviandoLink(false);
    }
  };

  const aprovarImagem = async (img: Imagem, status: string) => {
    if (!aba) return;
    const r = await fetch(`/api/cms/campanhas/${aba.id}/imagens`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imagem_id: img.id, status }),
    });
    if (r.ok) setImagens((p) => p.map((i) => (i.id === img.id ? { ...i, status } : i)));
  };

  const reordenar = async (img: Imagem, dir: number) => {
    if (!aba) return;
    const idx = imagens.findIndex((i) => i.id === img.id);
    const alvo = imagens[idx + dir];
    if (!alvo) return;
    const r1 = await fetch(`/api/cms/campanhas/${aba.id}/imagens`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imagem_id: img.id, ordem: alvo.ordem }),
    });
    const r2 = await fetch(`/api/cms/campanhas/${aba.id}/imagens`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imagem_id: alvo.id, ordem: img.ordem }),
    });
    if (r1.ok && r2.ok) {
      const nova = [...imagens];
      nova[idx] = alvo; nova[idx + dir] = img;
      setImagens(nova);
    }
  };

  const excluirImagem = async (img: Imagem) => {
    if (!aba || !confirm('Excluir esta imagem?')) return;
    const r = await fetch(`/api/cms/campanhas/${aba.id}/imagens`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imagem_id: img.id }),
    });
    if (r.ok) setImagens((p) => p.filter((i) => i.id !== img.id));
  };

  const salvarUrlOrientacao = async (img: Imagem, campo: 'url_paisagem' | 'url_retrato', valor: string) => {
    if (!aba) return;
    const r = await fetch(`/api/cms/campanhas/${aba.id}/imagens`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imagem_id: img.id, [campo]: valor }),
    });
    if (r.ok) {
      setImagens((p) => p.map((i) => (i.id === img.id ? { ...i, [campo]: valor } : i)));
      setMsg('URLs da imagem atualizadas');
    } else {
      const d = await r.json().catch(() => ({}));
      setMsg(d?.error || 'Erro ao salvar URL');
    }
  };

  const followUpManual = async (lead: Lead) => {
    if (!aba || !confirm(`Enviar follow-up automático por IA para ${lead.nome}?`)) return;
    const r = await fetch(`/api/cms/campanhas/${aba.id}/followup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: lead.id }),
    });
    const d = await r.json().catch(() => ({}));
    setMsg(r.ok ? 'Follow-up enviado' : d?.error || 'Erro no follow-up');
    abrir({ id: aba.id, titulo: aba.nome, ativo: true, data_inicio: null, data_fim: null } as Campanha, 'leads');
  };

  const editarCampanha = (c: Campanha) => {
    setEditando(c);
    setNova(true);
    setForm({
      titulo: c.titulo,
      descricao: c.descricao || '',
      tipo_campanha: c.tipo_campanha,
      categoria: c.categoria || '',
      desconto: c.desconto || '',
      prioridade: String(c.prioridade),
      canal_padrao: c.canal_padrao,
      follow_up_horas: String(c.follow_up_horas),
      data_inicio: c.data_inicio ? c.data_inicio.slice(0, 16) : '',
      data_fim: c.data_fim ? c.data_fim.slice(0, 16) : '',
      mensagem_prompt: '',
      ativo: String(c.ativo),
      cupom_codigo: c.cupom_codigo || '',
      cupom_escopo: c.cupom_escopo || 'todos',
      cupom_marca: c.cupom_marca || '',
      cupom_produtos: JSON.stringify(c.cupom_produtos || []),
    });
  };

  const formCampo = (k: string, label: string, tipo = 'text', opcoes?: string[]) => (
    <div className="input-group">
      <label>{label}</label>
      {opcoes
        ? (
          <select style={formStyle} value={form[k] ?? ''} onChange={(e) => setForm((p) => ({ ...p, [k]: e.target.value }))}>
            {opcoes.map((o) => <option key={o} value={o}>{o || '—'}</option>)}
          </select>
        )
        : tipo === 'textarea'
          ? <textarea style={{ ...formStyle, minHeight: 80 }} value={form[k] ?? ''} onChange={(e) => setForm((p) => ({ ...p, [k]: e.target.value }))} />
          : <input style={formStyle} type={tipo} value={form[k] ?? ''} onChange={(e) => setForm((p) => ({ ...p, [k]: e.target.value }))} />}
    </div>
  );

  if (aba) {
    return (
      <div className="admin-page-header">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => setAba(null)}>← Voltar</button>
          <h2>{aba.nome}</h2>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['imagens', 'leads', 'historico', 'decoracoes'] as const).map((a) => (
            <button key={a} className={`btn btn-sm ${aba.aba === a ? 'btn-primary' : 'btn-ghost'}`} onClick={() => abrir({ id: aba.id, titulo: aba.nome, ativo: true } as Campanha, a)}>
              {a}
            </button>
          ))}
        </div>

        {aba.aba === 'imagens' && (
          <div className="admin-card" style={{ marginTop: 'var(--spacing-lg)' }}>
            <h3 style={{ marginBottom: 'var(--spacing-md)' }}>Carrossel de imagens</h3>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: 'var(--spacing-md)', flexWrap: 'wrap' }}>
              <input
                id="ia-prompt"
                placeholder="Prompt da imagem (IA)... ex: cabelo liso castanho em manequim"
                style={{ ...formStyle, flex: 1, minWidth: 220 }}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    await gerarImagemIA((e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
              />
              <button
                className="btn btn-gold btn-sm"
                onClick={async () => {
                  const inp = document.getElementById('ia-prompt') as HTMLInputElement;
                  if (inp?.value) { await gerarImagemIA(inp.value); inp.value = ''; }
                }}
              >
                ✨ Gerar com IA
              </button>
            </div>

            {/* Upload: dispositivo ou link da internet */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: 'var(--spacing-md)', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml"
                style={{ display: 'none' }}
                onChange={(e) => { escolherArquivo(e.target.files?.[0]); e.target.value = ''; }}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={enviandoArquivo}
                onClick={() => fileInputRef.current?.click()}
              >
                {enviandoArquivo ? '⏳ Enviando...' : '📤 Enviar do dispositivo'}
              </button>
              <input
                type="text"
                className="input"
                placeholder="ou cole o link de uma imagem da internet..."
                style={{ ...formStyle, flex: 1, minWidth: 220 }}
                value={uploadLink}
                onChange={(e) => setUploadLink(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); usarLinkImagem(); } }}
              />
              <button type="button" className="btn btn-ghost btn-sm" disabled={enviandoLink} onClick={usarLinkImagem}>
                {enviandoLink ? '⏳ Baixando...' : '🌐 Usar link'}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--spacing-md)' }}>
              {imagens.map((img, i) => (
                <div key={img.id} className="card" style={{ padding: 'var(--spacing-sm)' }}>
                  <img src={img.url} alt="" style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8, background: '#eee' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                    <span className={`badge ${img.status === 'aprovada' ? 'badge-success' : img.status === 'pendente' ? 'badge-warning' : 'badge-secondary'}`}>
                      {img.status}{img.criada_por_ia ? ' (IA)' : ''}
                    </span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>ordem {img.ordem}</span>
                  </div>
                  <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                    <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>URL paisagem (opcional)</label>
                    <input
                      className="input"
                      style={{ ...formStyle, fontSize: 'var(--text-xs)', padding: '4px 6px' }}
                      defaultValue={img.url_paisagem || ''}
                      placeholder="/images/...-paisagem.jpg"
                      onBlur={(e) => salvarUrlOrientacao(img, 'url_paisagem', e.target.value)}
                    />
                    <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>URL retrato (opcional)</label>
                    <input
                      className="input"
                      style={{ ...formStyle, fontSize: 'var(--text-xs)', padding: '4px 6px' }}
                      defaultValue={img.url_retrato || ''}
                      placeholder="/images/...-retrato.jpg"
                      onBlur={(e) => salvarUrlOrientacao(img, 'url_retrato', e.target.value)}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                    <button className="btn btn-ghost btn-sm" disabled={i === 0} onClick={() => reordenar(img, -1)}>←</button>
                    <button className="btn btn-ghost btn-sm" disabled={i === imagens.length - 1} onClick={() => reordenar(img, 1)}>→</button>
                    {img.status !== 'aprovada' && <button className="btn btn-primary btn-sm" onClick={() => aprovarImagem(img, 'aprovada')}>Aprovar</button>}
                    {img.status !== 'rejeitada' && <button className="btn btn-ghost btn-sm" onClick={() => aprovarImagem(img, 'rejeitada')}>Rejeitar</button>}
                    <button className="btn btn-ghost btn-sm" onClick={() => excluirImagem(img)}>🗑</button>
                  </div>
                </div>
              ))}
              {imagens.length === 0 && <p style={{ color: 'var(--color-text-secondary)' }}>Nenhuma imagem. Envie do dispositivo, use um link da internet ou gere com IA.</p>}
            </div>
          </div>
        )}

        {aba.aba === 'leads' && (
          <div className="admin-card" style={{ marginTop: 'var(--spacing-lg)' }}>
            <h3 style={{ marginBottom: 'var(--spacing-md)' }}>Leads capturados</h3>
            <div className="table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr><th>Nome</th><th>WhatsApp</th><th>E-mail</th><th>Canal</th><th>Status</th><th>Data</th><th>Ações</th></tr>
                </thead>
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.id}>
                      <td style={{ fontWeight: 600 }}>{l.nome}</td>
                      <td style={{ fontSize: 'var(--text-sm)' }}>{l.whatsapp || '—'}</td>
                      <td style={{ fontSize: 'var(--text-sm)' }}>{l.email || '—'}</td>
                      <td style={{ fontSize: 'var(--text-sm)' }}>{l.canal_preferido}</td>
                      <td><span className={`badge ${l.status_comunicacao === 'respondida' ? 'badge-success' : l.status_comunicacao === 'sem_resposta' ? 'badge-warning' : 'badge-secondary'}`}>{l.status_comunicacao}</span></td>
                      <td style={{ fontSize: 'var(--text-sm)' }}>{new Date(l.criado_em).toLocaleDateString('pt-BR')}</td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => followUpManual(l)}>🤖 Follow-up IA</button>
                      </td>
                    </tr>
                  ))}
                  {leads.length === 0 && <tr><td colSpan={7} style={{ color: 'var(--color-text-secondary)' }}>Nenhum lead capturado ainda.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {aba.aba === 'historico' && (
          <div className="admin-card" style={{ marginTop: 'var(--spacing-lg)' }}>
            <h3 style={{ marginBottom: 'var(--spacing-md)' }}>Histórico de alterações</h3>
            <div className="table-wrapper">
              <table className="admin-table">
                <thead><tr><th>Ação</th><th>Detalhes</th><th>Data</th></tr></thead>
                <tbody>
                  {historico.map((h) => (
                    <tr key={h.id}>
                      <td><span className="badge badge-info">{h.acao}</span></td>
                      <td style={{ fontSize: 'var(--text-sm)' }}>{h.detalhes ? JSON.stringify(h.detalhes) : '—'}</td>
                      <td style={{ fontSize: 'var(--text-sm)' }}>{new Date(h.criado_em).toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                  {historico.length === 0 && <tr><td colSpan={3} style={{ color: 'var(--color-text-secondary)' }}>Sem registros.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {aba.aba === 'decoracoes' && (
          <div className="admin-card" style={{ marginTop: 'var(--spacing-lg)' }}>
            <h3 style={{ marginBottom: 'var(--spacing-md)' }}>Templates decorativos</h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--spacing-lg)' }}>
              Elementos visuais exibidos sobre a seção da campanha. Novos temas são só novas linhas — sem alterar código.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: 'var(--spacing-lg)' }}>
              {DECORACOES_TIPOS.map(t => (
                <button
                  key={t.nome}
                  className="btn btn-ghost btn-sm"
                  onClick={async () => {
                    const r = await fetch(`/api/cms/campanhas/${aba.id}/decoracoes`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ tipo: t.nome }),
                    });
                    const d = await r.json().catch(() => ({}));
                    if (r.ok) {
                      setDecoracoes(p => [...p, d]);
                      setMsg(`Decoração "${t.label}" adicionada!`);
                      setTimeout(() => setMsg(''), 3000);
                    } else {
                      setMsg(d?.error || 'Erro ao adicionar');
                    }
                  }}
                >
                  {t.icone} {t.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {decoracoes.map(d => (
                <span
                  key={d.id}
                  className="btn btn-secondary btn-sm"
                  style={{ cursor: 'default', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {DECORACOES_TIPOS.find(t => t.nome === d.tipo)?.icone || '✨'} {DECORACOES_TIPOS.find(t => t.nome === d.tipo)?.label || d.tipo}
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '0 4px', color: '#ef4444' }}
                    onClick={async () => {
                      await fetch(`/api/cms/campanhas/${aba.id}/decoracoes`, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ decoracao_id: d.id }),
                      });
                      setDecoracoes(p => p.filter(x => x.id !== d.id));
                    }}
                  >
                    ✕
                  </button>
                </span>
              ))}
              {decoracoes.length === 0 && (
                <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>Nenhum elemento decorativo. Clique em um tema acima para adicionar.</p>
              )}
            </div>
          </div>
        )}
        {msg && <p style={{ color: 'var(--color-gold)' }}>{msg}</p>}
      </div>
    );
  }

  return (
    <>
      <div className="admin-page-header">
        <div>
          <h2>Gestão de Campanhas</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', margin: 0 }}>
            Crie, agende, publique e acompanhe campanhas promocionais
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => { setNova(!nova); setEditando(null); setForm({ ativo: 'true', prioridade: '0', follow_up_horas: '24', canal_padrao: 'whatsapp', tipo_campanha: 'global' }); }}>
          + Nova Campanha
        </button>
      </div>

      {nova && (
        <div className="admin-card" style={{ marginBottom: 'var(--spacing-lg)' }}>
          <h3 style={{ marginBottom: 'var(--spacing-lg)' }}>Nova Campanha</h3>
          <form onSubmit={salvar} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--spacing-md)' }}>
            {formCampo('titulo', 'Título *')}
            {formCampo('descricao', 'Descrição', 'textarea')}
            {formCampo('tipo_campanha', 'Tipo', 'select', ['global', 'pessoal', 'promocional'])}
            {formCampo('categoria', 'Categoria', 'select', TIPOS_CATEGORIA)}
            {formCampo('desconto', 'Desconto (ex: 15%)')}

            <div className="input-group">
              <label>Cupom de desconto (código)</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  style={formStyle}
                  value={form['cupom_codigo'] ?? ''}
                  maxLength={16}
                  onChange={(e) => setForm((p) => ({ ...p, cupom_codigo: e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase() }))}
                  placeholder="Ex: DIADOSPAIS"
                  disabled={!form['desconto']}
                />
                <button type="button" className="btn btn-ghost btn-sm" onClick={gerarCupom} disabled={!form['desconto']} title="Gerar a partir do título (máx. 16)">
                  ⚡
                </button>
              </div>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                O cliente deve digitar no carrinho. Não é ativado sozinho — o atendente compartilha pelo chat ou WhatsApp.
              </span>
            </div>

            <div className="input-group">
              <label>Aplicar cupom a</label>
              <select style={formStyle} value={form['cupom_escopo'] ?? 'todos'} onChange={(e) => setForm((p) => ({ ...p, cupom_escopo: e.target.value }))} disabled={!form['desconto']}>
                <option value="todos">Todos os produtos</option>
                <option value="marca">Uma marca</option>
                <option value="produtos">Uma lista de produtos</option>
              </select>
            </div>

            {(form['cupom_escopo'] ?? 'todos') === 'marca' && (
              <div className="input-group">
                <label>Marca</label>
                <select style={formStyle} value={form['cupom_marca'] ?? ''} onChange={(e) => setForm((p) => ({ ...p, cupom_marca: e.target.value }))} required>
                  <option value="">Selecione a marca</option>
                  {marcas.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            )}

            {(form['cupom_escopo'] ?? 'todos') === 'produtos' && (
              <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                <label>Produtos com desconto</label>
                <textarea
                  style={{ ...formStyle, minHeight: 90 }}
                  value={form['cupom_produtos'] ?? '[]'}
                  onChange={(e) => setForm((p) => ({ ...p, cupom_produtos: e.target.value }))}
                  placeholder='["id-do-produto-1", "id-do-produto-2"] — cole os IDs (uma lista por vez)'
                  required
                />
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                  Informe os IDs dos produtos entre aspas, separados por vírgula, dentro de colchetes. Ex:{' '}
                  {String.fromCharCode(91)}&quot;aaa&quot;,&quot;bbb&quot;{String.fromCharCode(93)}
                </span>
              </div>
            )}

            {formCampo('prioridade', 'Prioridade (menor = maior)', 'number')}
            {formCampo('canal_padrao', 'Canal padrão', 'select', ['whatsapp', 'chat', 'email'])}
            {formCampo('follow_up_horas', 'Follow-up após (horas)', 'number')}
            {formCampo('data_inicio', 'Início (programar)', 'datetime-local')}
            {formCampo('data_fim', 'Término (encerrar automático)', 'datetime-local')}
            {formCampo('mensagem_prompt', 'Orientação da mensagem IA', 'textarea')}
            <div className="input-group">
              <label>Ativa</label>
              <select style={formStyle} value={form.ativo ?? 'true'} onChange={(e) => setForm((p) => ({ ...p, ativo: e.target.value }))}>
                <option value="true">Sim</option>
                <option value="false">Não</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 'var(--spacing-sm)' }}>
              <button type="submit" className="btn btn-primary">Salvar</button>
              <button type="button" className="btn btn-ghost" onClick={() => setNova(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div className="admin-card">
        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Campanha</th><th>Tipo</th><th>Prioridade</th><th>Período</th><th>Status</th><th>Imagens</th><th>Leads</th><th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {campanhas.map((c) => {
                const st = statusCampanhaLocal(c);
                return (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.titulo}</div>
                      {c.desconto && <span className="badge badge-gold">{c.desconto}</span>}
                      {c.cupom_codigo && (
                        <span className="badge badge-secondary" style={{ marginLeft: 4 }}>
                          🏷️ {c.cupom_codigo}
                          {c.cupom_escopo === 'marca' && c.cupom_marca ? ` (${c.cupom_marca})` : c.cupom_escopo === 'produtos' ? ' (produtos)' : ''}
                        </span>
                      )}
                      {c.categoria && <span className="badge badge-secondary" style={{ marginLeft: 4 }}>{c.categoria}</span>}
                    </td>
                    <td style={{ fontSize: 'var(--text-sm)' }}>{c.tipo_campanha}</td>
                    <td>{c.prioridade}</td>
                    <td style={{ fontSize: 'var(--text-sm)' }}>
                      {c.data_inicio ? new Date(c.data_inicio).toLocaleDateString('pt-BR') : '—'}
                      {' → '}
                      {c.data_fim ? new Date(c.data_fim).toLocaleDateString('pt-BR') : '∞'}
                    </td>
                    <td><span className={`badge ${STATUS_COLORS[st] || 'badge-secondary'}`}>{st}</span></td>
                    <td>{c.qtd_imagens || 0}</td>
                    <td>{c.qtd_leads || 0}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => editarCampanha(c)}>
                          Editar
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => abrir(c, 'imagens')}>Imagens</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => abrir(c, 'leads')}>Leads</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => abrir(c, 'historico')}>Histórico</button>
                        <button className={`btn btn-ghost btn-sm`} style={{ color: c.ativo ? 'var(--color-gold)' : undefined }} onClick={() => toggleAtivo(c)}>
                          {c.ativo ? 'Desativar' : 'Ativar'}
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger, #dc2626)' }} onClick={() => excluir(c)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {campanhas.length === 0 && !loading && (
                <tr><td colSpan={8} style={{ color: 'var(--color-text-secondary)' }}>Nenhuma campanha cadastrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
