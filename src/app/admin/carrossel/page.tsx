'use client';

import { useCallback, useEffect, useState } from 'react';

interface Slide {
  id?: string;
  imagem?: string;
  imagem_paisagem?: string;
  imagem_retrato?: string;
  badge?: string;
  titulo?: string;
  subtitulo?: string;
  cta1_label?: string;
  cta1_link?: string;
  cta2_label?: string;
  cta2_link?: string;
  ativo?: boolean;
}

const u = () => typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `s${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export default function AdminCarrossel() {
  const [blocoId, setBlocoId] = useState<string | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [erroCarga, setErroCarga] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    setErroCarga('');
    try {
      const res = await fetch('/api/admin/carrossel');
      if (res.status === 401) { setErroCarga('Não autorizado'); return; }
      if (res.status === 404) { setErroCarga('Bloco de carrossel não encontrado na home'); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setBlocoId(data.id);
      const conteudo = data.conteudo?.slides || [];
      setSlides(conteudo.map((s: Slide, i: number) => ({ ...s, id: s.id || `${i}_${u()}`, ativo: s.ativo !== false })));
    } catch (e: any) {
      console.error('Erro ao carregar carrossel:', e);
      setErroCarga(e.message || 'Erro ao carregar carrossel');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const salvar = async () => {
    if (!blocoId) return;
    setSalvando(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/carrossel', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slides: slides.map(({ id, ...s }) => ({ ...s, ativo: s.ativo !== false })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setMsg({ tipo: 'ok', texto: 'Carrossel salvo! O site atualiza em até 60s. (Ctrl+F5 para forçar) ✅' });
      setTimeout(() => setMsg(null), 5000);
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: `Erro ao salvar: ${e.message}` });
    } finally {
      setSalvando(false);
    }
  };

  const mover = (idx: number, dir: -1 | 1) => {
    setSlides(prev => {
      const next = [...prev];
      const alvo = idx + dir;
      if (alvo < 0 || alvo >= next.length) return prev;
      [next[idx], next[alvo]] = [next[alvo], next[idx]];
      return next;
    });
  };

  const set = (idx: number, campo: keyof Slide, valor: string | boolean) =>
    setSlides(prev => prev.map((s, i) => i === idx ? { ...s, [campo]: valor } : s));

  const [uploading, setUploading] = useState<number | null>(null);

  const uploadArquivo = (idx: number, campo: 'imagem_paisagem' | 'imagem_retrato' | 'imagem', file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMsg({ tipo: 'erro', texto: 'O arquivo precisa ser uma imagem (JPG, PNG, WEBP).' });
      setTimeout(() => setMsg(null), 4000);
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setMsg({ tipo: 'erro', texto: 'Imagem muito grande (máx. 8MB).' });
      setTimeout(() => setMsg(null), 4000);
      return;
    }
    setUploading(idx);
    const reader = new FileReader();
    reader.onload = () => {
      set(idx, campo, String(reader.result || ''));
      setUploading(null);
      setMsg({ tipo: 'ok', texto: 'Imagem carregada! Salve o carrossel para publicar.' });
      setTimeout(() => setMsg(null), 4000);
    };
    reader.onerror = () => {
      setUploading(null);
      setMsg({ tipo: 'erro', texto: 'Falha ao ler o arquivo.' });
    };
    reader.readAsDataURL(file);
  };

  const novoSlide = () =>
    setSlides(prev => [...prev, { id: u(), ativo: true, cta1_label: 'Ver Catálogo', cta1_link: '/catalogo' }]);

  const excluir = (idx: number) => {
    if (!confirm('Excluir este slide?')) return;
    setSlides(prev => prev.filter((_, i) => i !== idx));
  };

  const [zoomImg, setZoomImg] = useState<string | null>(null);

  useEffect(() => {
    if (!zoomImg) return;
    const fechar = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoomImg(null); };
    window.addEventListener('keydown', fechar);
    return () => window.removeEventListener('keydown', fechar);
  }, [zoomImg]);

  const CampoImagem = ({ idx, campo, label, placeholder }: { idx: number; campo: 'imagem_paisagem' | 'imagem_retrato' | 'imagem'; label: string; placeholder: string }) => {
    const valor = slides[idx]?.[campo] || '';
    const idInput = `${campo}-${idx}`;
    return (
      <div className="col-span-2">
        <label className="label">{label}</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="text" className="input" placeholder={placeholder} value={valor} onChange={e => set(idx, campo, e.target.value)} />
          <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {uploading === idx ? '⏳' : '📤 Upload'}
            <input type="file" accept="image/*" style={{ display: 'none' }} id={idInput}
              onChange={e => { uploadArquivo(idx, campo, e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        </div>
        {valor && (
          <div style={{ marginTop: 6, cursor: 'zoom-in' }} title="Clique para visualizar em tamanho real" onClick={() => setZoomImg(valor)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={valor} alt="" style={{ width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 8 }} onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3'; }} />
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="admin-page-header">
        <div>
          <h2>Carrossel da Home</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', margin: 0 }}>
            {slides.length} slide(s) — ordem e conteúdo do banner principal
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={novoSlide}>+ Novo Slide</button>
          <button className="btn btn-primary btn-sm" onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : '💾 Salvar Carrossel'}
          </button>
        </div>
      </div>

      {msg && (
        <p style={{ marginBottom: 'var(--spacing-md)', color: msg.tipo === 'ok' ? 'var(--color-gold)' : 'var(--color-error)' }}>
          {msg.texto}
        </p>
      )}

      {loading ? (
        <p style={{ color: 'var(--color-text-tertiary)', padding: '2rem', textAlign: 'center' }}>Carregando...</p>
      ) : erroCarga ? (
        <div className="admin-card" style={{ color: 'var(--color-error)' }}>
          <p>{erroCarga}</p>
          <button className="btn btn-ghost btn-sm" onClick={carregar}>Tentar novamente</button>
        </div>
      ) : (
        slides.map((s, i) => (
          <div key={s.id} className="admin-card" style={{ marginBottom: 'var(--spacing-lg)', border: s.ativo ? undefined : '1px dashed var(--color-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="badge badge-secondary" style={{ minWidth: 28, textAlign: 'center' }}>{i + 1}</span>
                <h3 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>{s.titulo || `Slide ${i + 1}`}</h3>
                {!s.ativo && <span className="badge badge-warning">inativo</span>}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!s.ativo} onChange={e => set(i, 'ativo', e.target.checked)} />
                  Ativo
                </label>
                <button className="btn btn-ghost btn-sm" style={{ padding: '4px 10px' }} onClick={() => mover(i, -1)} disabled={i === 0} title="Mover para cima">↑</button>
                <button className="btn btn-ghost btn-sm" style={{ padding: '4px 10px' }} onClick={() => mover(i, 1)} disabled={i === slides.length - 1} title="Mover para baixo">↓</button>
                <button className="btn btn-ghost btn-sm" style={{ padding: '4px 10px', color: '#ef4444' }} onClick={() => excluir(i)}>🗑</button>
              </div>
            </div>

            <div className="checkout-grid" style={{ gap: 'var(--spacing-md)' }}>
              <CampoImagem idx={i} campo="imagem_paisagem" label="Imagem (paisagem — desktop)" placeholder="/images/carrossel/slide-01-paisagem.jpg" />
              <CampoImagem idx={i} campo="imagem_retrato" label="Imagem (retrato — celular)" placeholder="/images/carrossel/slide-01-retrato.jpg" />
              <CampoImagem idx={i} campo="imagem" label="Imagem (fallback geral)" placeholder="/images/carrossel/slide-01-paisagem.jpg" />
              <div>
                <label className="label">Badge</label>
                <input type="text" className="input" placeholder="✨ Nova coleção" value={s.badge || ''} onChange={e => set(i, 'badge', e.target.value)} />
              </div>
              <div>
                <label className="label">Título</label>
                <input type="text" className="input" placeholder="Título do slide" value={s.titulo || ''} onChange={e => set(i, 'titulo', e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="label">Subtítulo</label>
                <input type="text" className="input" placeholder="Descrição curta" value={s.subtitulo || ''} onChange={e => set(i, 'subtitulo', e.target.value)} />
              </div>
              <div>
                <label className="label">Botão 1 — Texto</label>
                <input type="text" className="input" placeholder="Ver Catálogo" value={s.cta1_label || ''} onChange={e => set(i, 'cta1_label', e.target.value)} />
              </div>
              <div>
                <label className="label">Botão 1 — Link</label>
                <input type="text" className="input" placeholder="/catalogo" value={s.cta1_link || ''} onChange={e => set(i, 'cta1_link', e.target.value)} />
              </div>
              <div>
                <label className="label">Botão 2 — Texto</label>
                <input type="text" className="input" placeholder="Fale no WhatsApp" value={s.cta2_label || ''} onChange={e => set(i, 'cta2_label', e.target.value)} />
              </div>
              <div>
                <label className="label">Botão 2 — Link</label>
                <input type="text" className="input" placeholder="whatsapp: (usa o número do Admin) ou https://wa.me/..." value={s.cta2_link || ''} onChange={e => set(i, 'cta2_link', e.target.value)} />
              </div>
            </div>
          </div>
        ))
      )}

      {slides.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 'var(--spacing-md)' }}>
          <button className="btn btn-ghost btn-sm" onClick={novoSlide}>+ Novo Slide</button>
          <button className="btn btn-primary" onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : '💾 Salvar Carrossel'}
          </button>
        </div>
      )}

      {zoomImg && (
        <div
          onClick={() => setZoomImg(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24, cursor: 'zoom-out',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoomImg}
            alt="Visualização em tamanho real"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '100vw', maxHeight: '100vh',
              width: 'auto', height: 'auto',
              objectFit: 'contain', borderRadius: 4,
            }}
          />
          <button
            onClick={() => setZoomImg(null)}
            aria-label="Fechar visualização"
            title="Fechar (Esc)"
            style={{
              position: 'fixed', top: 16, right: 16,
              width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)', color: '#fff',
              border: '1px solid rgba(255,255,255,0.4)',
              fontSize: '1.4rem', lineHeight: 1, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 10000,
            }}
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}