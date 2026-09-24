'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';

interface GaleriaItem {
  id: string;
  url: string;
  alt: string | null;
  titulo: string;
  categoria: string;
  ativo?: boolean;
  video?: boolean;
}

const CATEGORIES = ['Todos', 'Fotos', 'Vídeos'];

const isVideoUrl = (url: string) => /\.(mp4|webm|mov)(\?.*)?$/i.test(url);

export default function AdminGaleria() {
  const [itens, setItens] = useState<GaleriaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Todos');
  const [selected, setSelected] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'Todos') params.set('categoria', filter);
      const res = await fetch(`/api/admin/galeria?${params.toString()}`);
      if (res.ok) setItens(await res.json());
    } catch { /* noop */ } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { const t = setTimeout(carregar, 0); return () => clearTimeout(t); }, [carregar]);

  const toggleSelect = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const uploadArquivos = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setMsg('');
    let ok = 0;
    for (const file of Array.from(files)) {
      const isVideo = file.type.startsWith('video/');
      if (!file.type.startsWith('image/') && !isVideo) continue;
      const dataUri = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.readAsDataURL(file);
      });
      const categoria = isVideo ? 'Vídeos' : (filter !== 'Todos' ? filter : 'Fotos');
      const res = await fetch('/api/admin/galeria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: dataUri, alt: file.name.replace(/\.[^.]+$/, ''), titulo: file.name.replace(/\.[^.]+$/, ''), categoria }),
      });
      if (res.ok) ok++;
    }
    setUploading(false);
    setMsg(`${ok} arquivo(s) enviado(s)!`);
    setTimeout(() => setMsg(''), 3000);
    carregar();
  };

  const excluirSelecionadas = async () => {
    if (!selected.length || !confirm(`Excluir ${selected.length} item(ns)?`)) return;
    const res = await fetch('/api/admin/galeria', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selected }),
    });
    if (res.ok) {
      setSelected([]);
      setMsg('Itens excluídos!');
      setTimeout(() => setMsg(''), 3000);
      carregar();
    }
  };

  const toggleAtivo = async (item: GaleriaItem) => {
    const res = await fetch('/api/admin/galeria', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, ativo: !(item.ativo ?? true) }),
    });
    if (res.ok) {
      setItens(prev => prev.map(p => p.id === item.id ? { ...p, ativo: !(p.ativo ?? true) } : p));
    }
  };

  const videos = itens.filter(i => i.video).length;

  return (
    <>
      <div className="admin-page-header">
        <div>
          <h2>Gestão de Galeria</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', margin: 0 }}>
            {itens.length} item(ns){videos > 0 ? ` — ${videos} vídeo(s)` : ''} — {itens.filter(i => i.ativo !== false).length} visíveis
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          {selected.length > 0 && (
            <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={excluirSelecionadas}>
              🗑️ Excluir ({selected.length})
            </button>
          )}
          <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer' }}>
            {uploading ? 'Enviando...' : '+ Upload Fotos/Vídeos'}
            <input
              type="file"
              accept="image/*,video/mp4,video/webm,video/quicktime"
              multiple
              hidden
              onChange={e => uploadArquivos(e.target.files)}
            />
          </label>
        </div>
      </div>

      {msg && <p style={{ color: 'var(--color-gold)', marginBottom: 'var(--spacing-md)' }}>{msg}</p>}

      {/* Filters */}
      <div className="admin-card" style={{ marginBottom: 'var(--spacing-lg)', padding: 'var(--spacing-md) var(--spacing-lg)' }}>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
          {CATEGORIES.map(c => (
            <button key={c} className={`btn btn-sm ${filter === c ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--spacing-md)' }}>
        {itens.map(item => (
          <div
            key={item.id}
            className="admin-card"
            style={{
              padding: 0, overflow: 'hidden', cursor: 'pointer',
              border: selected.includes(item.id) ? '2px solid var(--color-gold)' : undefined,
              position: 'relative', opacity: item.ativo === false ? 0.5 : 1,
            }}
            onClick={() => toggleSelect(item.id)}
          >
            <div style={{ position: 'relative', paddingTop: '75%', background: 'var(--color-surface)' }}>
              {item.video || isVideoUrl(item.url) ? (
                <video
                  src={item.url}
                  muted
                  playsInline
                  preload="metadata"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  onMouseEnter={e => e.currentTarget.play()}
                  onMouseLeave={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                />
              ) : (
                <Image
                  src={item.url}
                  alt={item.alt || ''}
                  fill
                  sizes="200px"
                  style={{ objectFit: 'cover' }}
                />
              )}
              {item.video && (
                <div style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, pointerEvents: 'none' }}>▶</div>
              )}
              {selected.includes(item.id) && (
                <div style={{
                  position: 'absolute', top: 8, left: 8,
                  width: 24, height: 24, borderRadius: '50%',
                  background: 'var(--color-gold)', color: '#000',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700
                }}>✓</div>
              )}
            </div>
            <div style={{ padding: 'var(--spacing-sm) var(--spacing-md)' }}>
              <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)', marginBottom: 2 }}>{item.alt || item.titulo || 'Sem título'}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="badge badge-secondary" style={{ fontSize: 10 }}>{item.categoria || 'Fotos'}</span>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                  onClick={e => { e.stopPropagation(); toggleAtivo(item); }}
                  title={(item.ativo ?? true) ? 'Desativar (ocultar)' : 'Ativar (exibir)'}
                >
                  {(item.ativo ?? true) ? '👁️' : '🚫'}
                </button>
              </div>
            </div>
          </div>
        ))}
        {itens.length === 0 && !loading && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '2rem' }}>
            Nenhum item. Clique em &quot;+ Upload Fotos/Vídeos&quot;.
          </div>
        )}
      </div>
      {loading && <p style={{ color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '1rem' }}>Carregando...</p>}
    </>
  );
}
