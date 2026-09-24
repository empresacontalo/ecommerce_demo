'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  montarBlocosBody,
  montarBlocosHead,
  TIPO_LABEL,
  type GoogleTag,
  type GoogleTagTipo,
  type PaginaDisponivel,
} from '@/lib/google-tags';

interface TipoDisponivel {
  valor: GoogleTagTipo;
  label: string;
}

interface FormTag {
  nome: string;
  tipo: GoogleTagTipo;
  identificador: string;
  codigo: string;
  paginas: string[];
  ativo: boolean;
  ordem: number;
}

const FORM_VAZIO: FormTag = {
  nome: '',
  tipo: 'ga4',
  identificador: '',
  codigo: '',
  paginas: ['todas'],
  ativo: true,
  ordem: 0,
};

const PLACEHOLDER_ID: Record<GoogleTagTipo, string> = {
  ga4: 'G-8KJZC5J14S',
  google_ads: 'AW-123456789',
  gtm: 'GTM-ABC1234',
  personalizado: '',
};

const AJUDA_ID: Record<GoogleTagTipo, string> = {
  ga4: 'ID de medição do Google Analytics 4 (começa com G-).',
  google_ads: 'ID de conversão/remarketing do Google Ads (AW- ou DC-).',
  gtm: 'ID do contêiner do Google Tag Manager (GTM-). O script do GTM é inserido no <head> e o <noscript> logo após o <body>.',
  personalizado:
    'Cole apenas JavaScript (sem tags HTML). Se colar um snippet <script>...</script> completo, o wrapper é removido automaticamente. Para GA4/Ads/GTM prefira os tipos específicos.',
};

const API = '/api/admin/trafego-pago/google-tags';

export default function AdminTrafegoPago() {
  const [tags, setTags] = useState<GoogleTag[]>([]);
  const [paginas, setPaginas] = useState<PaginaDisponivel[]>([]);
  const [tipos, setTipos] = useState<TipoDisponivel[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [msg, setMsg] = useState('');

  const [formAberto, setFormAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<FormTag>(FORM_VAZIO);
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);
  const avisoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (avisoTimer.current) clearTimeout(avisoTimer.current);
    };
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API, { cache: 'no-store' });
      if (res.status === 401) {
        setErro('Sessão expirada. Entre novamente para gerenciar as tags.');
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error || 'Falha ao carregar as tags.');
        return;
      }
      setTags(data.tags || []);
      setPaginas(data.paginas || []);
      setTipos(data.tipos || []);
      setErro('');
    } catch {
      setErro('Falha de conexão ao carregar as tags.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(carregar, 0);
    return () => clearTimeout(t);
  }, [carregar]);

  function aviso(texto: string) {
    if (avisoTimer.current) clearTimeout(avisoTimer.current);
    setMsg(texto);
    avisoTimer.current = setTimeout(() => setMsg(''), 3500);
  }

  function abrirNova() {
    setEditandoId(null);
    setForm(FORM_VAZIO);
    setErro('');
    setFormAberto(true);
  }

  function abrirEdicao(tag: GoogleTag) {
    setEditandoId(tag.id);
    setForm({
      nome: tag.nome,
      tipo: tag.tipo,
      identificador: tag.identificador || '',
      codigo: tag.codigo || '',
      paginas: tag.paginas?.length ? tag.paginas : ['todas'],
      ativo: tag.ativo,
      ordem: tag.ordem || 0,
    });
    setErro('');
    setFormAberto(true);
  }

  function fecharForm() {
    setFormAberto(false);
    setEditandoId(null);
    setForm(FORM_VAZIO);
  }

  function alternarPagina(slug: string) {
    setForm(prev => {
      if (slug === 'todas') return { ...prev, paginas: ['todas'] };
      const semTodas = prev.paginas.filter(p => p !== 'todas');
      const proximas = semTodas.includes(slug)
        ? semTodas.filter(p => p !== slug)
        : [...semTodas, slug];
      return { ...prev, paginas: proximas.length ? proximas : ['todas'] };
    });
  }

  async function salvar() {
    setSalvando(true);
    setErro('');
    try {
      const payload = editandoId ? { id: editandoId, ...form } : form;
      const res = await fetch(API, {
        method: editandoId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(data.error || 'Não foi possível salvar a tag.');
        return;
      }
      aviso(editandoId ? 'Tag atualizada!' : 'Tag criada!');
      fecharForm();
      carregar();
    } catch {
      setErro('Falha de conexão ao salvar a tag.');
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(tag: GoogleTag) {
    if (ocupadoId) return;
    setOcupadoId(tag.id);
    setErro('');
    try {
      const res = await fetch(API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tag.id, ativo: !tag.ativo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(data.error || 'Não foi possível alterar o status.');
        return;
      }
      const ativo = typeof data.ativo === 'boolean' ? data.ativo : !tag.ativo;
      setTags(prev => prev.map(t => (t.id === tag.id ? { ...t, ativo } : t)));
      aviso(ativo ? 'Tag ativada!' : 'Tag desativada.');
    } catch {
      setErro('Falha de conexão ao alterar o status.');
    } finally {
      setOcupadoId(null);
    }
  }

  async function excluir(tag: GoogleTag) {
    if (!confirm(`Excluir a tag "${tag.nome}"? Essa ação não pode ser desfeita.`)) return;
    setOcupadoId(tag.id);
    setErro('');
    try {
      const res = await fetch(API, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tag.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(data.error || 'Não foi possível excluir a tag.');
        return;
      }
      setTags(prev => prev.filter(t => t.id !== tag.id));
      aviso('Tag excluída.');
    } catch {
      setErro('Falha de conexão ao excluir a tag.');
    } finally {
      setOcupadoId(null);
    }
  }

  const preview = useMemo(() => {
    const tagPreview: GoogleTag = {
      id: 'preview',
      nome: form.nome || 'Prévia',
      tipo: form.tipo,
      identificador: form.identificador,
      codigo: form.tipo === 'personalizado' ? form.codigo : null,
      paginas: form.paginas,
      ativo: form.ativo,
      ordem: form.ordem,
    };
    return montarBlocosHead([tagPreview])
      .map(b => (b.tipo === 'script-src' ? `<script async src="${b.src}"></script>` : b.html))
      .concat(
        montarBlocosBody([tagPreview]).map(
          n =>
            `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${n.gtmId}" height="0" width="0"></iframe></noscript>  ← logo após <body>`
        )
      )
      .join('\n');
  }, [form]);

  function rotuloPaginas(tag: GoogleTag): string {
    if (tag.paginas?.includes('todas')) return 'Todas as páginas';
    return (tag.paginas || [])
      .map(slug => paginas.find(p => p.slug === slug)?.label || slug)
      .join(' • ');
  }

  return (
    <>
      <div className="admin-page-header">
        <div>
          <h2>Tráfego Pago</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', margin: 0 }}>
            Google TAGS — {tags.length} cadastrada(s), {tags.filter(t => t.ativo).length} ativa(s)
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={abrirNova}>
          + Nova Tag
        </button>
      </div>

      {msg && (
        <p role="status" aria-live="polite" style={{ color: 'var(--color-gold)', marginBottom: 'var(--spacing-md)' }}>
          {msg}
        </p>
      )}
      {erro && !formAberto && (
        <p role="alert" style={{ color: '#ef4444', marginBottom: 'var(--spacing-md)' }}>{erro}</p>
      )}

      {formAberto && (
        <div className="admin-card" style={{ marginBottom: 'var(--spacing-lg)' }}>
          <h3 style={{ marginTop: 0 }}>{editandoId ? 'Editar tag' : 'Nova tag do Google'}</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--spacing-md)' }}>
            <div>
              <label className="label" htmlFor="gt-nome">Nome</label>
              <input
                id="gt-nome"
                className="input"
                placeholder="Ex.: Google Analytics 4"
                value={form.nome}
                onChange={e => setForm({ ...form, nome: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="gt-tipo">Tipo</label>
              <select
                id="gt-tipo"
                className="input"
                value={form.tipo}
                onChange={e => setForm({ ...form, tipo: e.target.value as GoogleTagTipo })}
              >
                {tipos.map(t => (
                  <option key={t.valor} value={t.valor}>{t.label}</option>
                ))}
              </select>
            </div>
            {form.tipo !== 'personalizado' && (
              <div>
                <label className="label" htmlFor="gt-id">Identificador</label>
                <input
                  id="gt-id"
                  className="input"
                  placeholder={PLACEHOLDER_ID[form.tipo]}
                  value={form.identificador}
                  onChange={e => setForm({ ...form, identificador: e.target.value })}
                />
              </div>
            )}
            <div>
              <label className="label" htmlFor="gt-ordem">Ordem de injeção</label>
              <input
                id="gt-ordem"
                className="input"
                type="number"
                value={form.ordem}
                onChange={e => setForm({ ...form, ordem: Number(e.target.value) })}
              />
            </div>
          </div>

          <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)', marginTop: 6 }}>
            {AJUDA_ID[form.tipo]}
          </p>

          {form.tipo === 'personalizado' && (
            <div style={{ marginTop: 'var(--spacing-md)' }}>
              <label className="label" htmlFor="gt-codigo">Código JavaScript</label>
              <textarea
                id="gt-codigo"
                className="input"
                rows={6}
                style={{ fontFamily: 'monospace', fontSize: 12 }}
                placeholder={'window.dataLayer = window.dataLayer || [];\n// ou cole <script>...</script> completo'}
                value={form.codigo}
                onChange={e => setForm({ ...form, codigo: e.target.value })}
              />
            </div>
          )}

          <div style={{ marginTop: 'var(--spacing-md)' }}>
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="label" style={{ padding: 0 }}>
                Inserir no &lt;head&gt; destas páginas
              </legend>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)', marginTop: 6 }}>
                {paginas.map(p => (
                  <label
                    key={p.slug}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                      fontSize: 'var(--text-sm)', padding: '4px 10px', borderRadius: 999,
                      border: '1px solid var(--color-border-light)',
                      background: form.paginas.includes(p.slug) ? 'var(--color-gold)' : 'transparent',
                      color: form.paginas.includes(p.slug) ? '#16130B' : 'inherit',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={form.paginas.includes(p.slug)}
                      onChange={() => alternarPagina(p.slug)}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'var(--spacing-md)' }}>
            <input
              id="gt-ativo"
              type="checkbox"
              checked={form.ativo}
              onChange={e => setForm({ ...form, ativo: e.target.checked })}
            />
            <label htmlFor="gt-ativo" style={{ fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
              Tag ativa (inserida no site)
            </label>
          </div>

          {preview && (
            <div style={{ marginTop: 'var(--spacing-md)' }}>
              <span className="label">Prévia do snippet que será inserido no &lt;head&gt;</span>
              <pre style={{
                background: '#16130B', color: '#e5d9b6', padding: 'var(--spacing-md)',
                borderRadius: 8, fontSize: 11, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              }}>
                {preview}
              </pre>
            </div>
          )}

          {erro && (
            <p role="alert" style={{ color: '#ef4444', marginTop: 'var(--spacing-md)' }}>{erro}</p>
          )}

          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-lg)' }}>
            <button className="btn btn-primary" onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Criar tag'}
            </button>
            <button className="btn btn-ghost" onClick={fecharForm} disabled={salvando}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="admin-card" style={{ overflowX: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>Google TAGS</h3>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginTop: 0 }}>
          Todas as tags ativas abaixo são inseridas entre as tags <code>&lt;head&gt;&lt;/head&gt;</code> das
          páginas marcadas. As tags ficam disponíveis no site imediatamente após salvar.
        </p>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Tipo</th>
              <th>Identificador</th>
              <th>Páginas</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {tags.map(tag => (
              <tr key={tag.id} style={{ opacity: tag.ativo ? 1 : 0.5 }}>
                <td style={{ fontWeight: 500 }}>{tag.nome}</td>
                <td><span className="badge badge-secondary">{TIPO_LABEL[tag.tipo] || tag.tipo}</span></td>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                  {tag.tipo === 'personalizado' ? 'JavaScript personalizado' : tag.identificador}
                </td>
                <td style={{ fontSize: 'var(--text-sm)' }}>{rotuloPaginas(tag)}</td>
                <td>
                  <span className={`badge ${tag.ativo ? 'badge-success' : 'badge-secondary'}`}>
                    {tag.ativo ? 'Ativa' : 'Desativada'}
                  </span>
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    aria-label={tag.ativo ? `Desativar ${tag.nome}` : `Ativar ${tag.nome}`}
                    title={tag.ativo ? 'Desativar' : 'Ativar'}
                    disabled={ocupadoId === tag.id}
                    onClick={() => alternarAtivo(tag)}
                  >
                    {tag.ativo ? '⏸' : '▶'}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    aria-label={`Editar ${tag.nome}`}
                    title="Editar"
                    disabled={ocupadoId === tag.id}
                    onClick={() => abrirEdicao(tag)}
                  >
                    ✏️
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ color: '#ef4444' }}
                    aria-label={`Excluir ${tag.nome}`}
                    title="Excluir"
                    disabled={ocupadoId === tag.id}
                    onClick={() => excluir(tag)}
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
            {tags.length === 0 && !loading && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '2rem' }}>
                  Nenhuma tag cadastrada. Clique em &quot;+ Nova Tag&quot;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {loading && (
          <p style={{ color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '1rem' }}>
            Carregando...
          </p>
        )}
      </div>
    </>
  );
}
