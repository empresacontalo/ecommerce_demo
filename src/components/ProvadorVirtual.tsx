'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/utils/auth/client';
import { getConfig } from '@/utils/empresa';
import { EMPRESA_NOME_PADRAO } from '@/utils/empresa-default';

interface CatalogProduct {
  id: string;
  name: string;
  slug: string;
  origin: string;
  images: string[];
}

export default function ProvadorVirtualPage({ mostrarHero = true }: { mostrarHero?: boolean }) {
  const supabase = createClient();

  // Auth state
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Photo state
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Catalog state
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pageUrl = typeof window !== 'undefined' ? window.location.href : '';

  // ── Auth Check ──
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser ? { id: authUser.id } : null);
      setAuthLoading(false);
    };
    checkAuth();
  }, [supabase]);

  // ── Load persisted photo + catalog ──
  useEffect(() => {
    if (!user) return;

    // Load user photo
    fetch('/api/provador-virtual/photo')
      .then(r => r.json())
      .then(data => {
        if (data.photo) setUserPhoto(data.photo);
      })
      .catch(console.error);

    // Load catalog products (catalogLoading starts as true via initial state)
    fetch('/api/produtos')
      .then(r => r.json())
      .then((data: CatalogProduct[]) => {
        if (Array.isArray(data)) {
          setProducts(data.filter(p => p.images && p.images.length > 0));
        }
      })
      .catch(console.error)
      .finally(() => setCatalogLoading(false));
  }, [user]);

  // ── Upload handler ──
  const handleFileSelect = useCallback(async (file: File) => {
    setError(null);

    if (!file.type.startsWith('image/')) {
      setError('Selecione um arquivo de imagem válido.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Imagem muito grande. Máximo: 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setUserPhoto(base64);

      // Persist photo
      try {
        await fetch('/api/provador-virtual/photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photoBase64: base64 }),
        });
      } catch (err) {
        console.error('Erro ao salvar foto:', err);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  // ── Drag & Drop ──
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  // ── Generate ──
  const handleGenerate = async () => {
    if (!userPhoto || !selectedProduct) return;

    setGenerating(true);
    setError(null);
    setResultImage(null);

    try {
      const res = await fetch('/api/provador-virtual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPhotoBase64: userPhoto,
          productImageUrl: selectedProduct.images[0],
          productName: selectedProduct.name,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || 'Erro ao gerar imagem.');
        return;
      }

      setResultImage(data.image);
    } catch (err) {
      console.error('Erro ao gerar:', err);
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setGenerating(false);
    }
  };

  // ── Share handlers ──
  const [empresaNome, setEmpresaNome] = useState(EMPRESA_NOME_PADRAO);

  useEffect(() => {
    (async () => {
      const logo = await getConfig('header.logo');
      if (logo?.texto) setEmpresaNome(logo.texto);
    })();
  }, []);

  const invitationText = `Experimente os cabelos da ${empresaNome} você também, use o provador virtual gratuitamente!`;
  const shareText = encodeURIComponent(`${invitationText} Acesse: ${pageUrl}`);

  const handleDownload = () => {
    if (!resultImage) return;
    const link = document.createElement('a');
    link.href = resultImage;
    link.download = 'provador-virtual.png';
    link.click();
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${invitationText} Acesse o provador virtual: ${pageUrl}`);
      alert('Convite e link copiados com sucesso!');
    } catch { /* ignore */ }
  };

  const handleNativeShare = async () => {
    if (!navigator.share) return;
    try {
      const shareData: ShareData = {
        title: `Provador Virtual - ${empresaNome}`,
        text: invitationText,
        url: pageUrl,
      };

      if (resultImage) {
        try {
          const response = await fetch(resultImage);
          const blob = await response.blob();
          const file = new File([blob], 'provador.png', { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            shareData.files = [file];
          }
        } catch (e) {
          console.error('Error preparing image for native share:', e);
        }
      }

      await navigator.share(shareData);
    } catch { /* user cancelled */ }
  };

  const handleInstagramShare = async () => {
    try {
      let copied = false;
      if (resultImage) {
        try {
          const response = await fetch(resultImage);
          const blob = await response.blob();
          
          const items: Record<string, Blob> = {
            [blob.type]: blob,
          };
          
          const textBlob = new Blob([`${invitationText} Acesse: ${pageUrl}`], { type: 'text/plain' });
          items['text/plain'] = textBlob;
          
          await navigator.clipboard.write([new ClipboardItem(items)]);
          copied = true;
          alert('Imagem e convite copiados para a área de transferência! Cole nos Stories ou Direct do Instagram.');
        } catch (err) {
          console.error('Clipboard write error:', err);
        }
      }
      
      if (!copied) {
        await navigator.clipboard.writeText(`${invitationText} Acesse: ${pageUrl}`);
        alert('Link do convite copiado! Cole no Instagram.');
      }
      
      window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
    } catch {
      window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
    }
  };

  // ── Render ──

  if (authLoading) {
    return (
      <section className="section" style={{ textAlign: 'center', padding: '100px 0' }}>
        <div className="container">Carregando...</div>
      </section>
    );
  }

  return (
    <>
      {/* Hero (usado apenas quando a página não tem blocos no CMS) */}
      {mostrarHero && (
        <section className="section about-hero">
          <div className="container">
            <span className="badge badge-gold" style={{ marginBottom: 'var(--spacing-md)' }}>Provador Virtual</span>
            <h1>Experimente Antes de Comprar</h1>
            <p className="subtitle" style={{ maxWidth: '600px', margin: '0 auto' }}>
              Faça upload da sua foto e veja como ficaria com nossos cabelos naturais — resultado gerado por IA
            </p>
            <span className="gold-line" />
          </div>
        </section>
      )}

      <section className="section">
        <div className="container">
          {/* Auth Gate */}
          {!user ? (
            <div className="provador-auth-gate">
              <div className="icon">🔒</div>
              <h3>Faça Login para Usar o Provador Virtual</h3>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                Entre na sua conta para experimentar nossos cabelos e salvar suas fotos para futuras visitas.
              </p>
              <Link href="/auth/login?next=/provador-virtual" className="btn btn-gold btn-lg">
                Entrar na Minha Conta
              </Link>
              <p style={{ marginTop: 'var(--spacing-md)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                Não tem conta? <Link href="/auth/registro?next=/provador-virtual" style={{ color: 'var(--color-primary)' }}>Cadastre-se grátis</Link>
              </p>
            </div>
          ) : (
            <>
              {error && <div className="provador-error" style={{ marginBottom: 'var(--spacing-xl)' }}>{error}</div>}

              <div className="provador-container">
                {/* Left: Upload */}
                <div>
                  <h3 style={{ marginBottom: 'var(--spacing-lg)' }}>📷 Sua Foto</h3>
                  <div
                    className={`provador-upload-area ${userPhoto ? 'has-photo' : ''} ${isDragging ? 'dragover' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => !userPhoto && fileInputRef.current?.click()}
                  >
                    {userPhoto ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={userPhoto} alt="Sua foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div className="provador-upload-actions">
                          <label className="btn btn-ghost btn-sm" style={{ flex: 1, background: 'rgba(22,19,11,0.85)', cursor: 'pointer', textAlign: 'center', backdropFilter: 'blur(8px)' }}>
                            📷 Trocar Foto
                            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleInputChange} style={{ display: 'none' }} />
                          </label>
                        </div>
                      </>
                    ) : (
                      <div className="provador-upload-placeholder">
                        <div className="icon">🪞</div>
                        <h3 style={{ marginBottom: 'var(--spacing-md)' }}>Envie sua foto</h3>
                        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-lg)', fontSize: 'var(--text-sm)' }}>
                          Arraste e solte ou clique para selecionar uma foto de frente (máx. 5MB)
                        </p>
                        <span className="btn btn-primary btn-lg">📷 Fazer Upload</span>
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleInputChange} style={{ display: 'none' }} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Sidebar */}
                <div className="provador-sidebar">
                  <div>
                    <h3 style={{ marginBottom: 'var(--spacing-lg)' }}>💇‍♀️ Escolha o Cabelo</h3>
                    {catalogLoading ? (
                      <p style={{ color: 'var(--color-text-secondary)' }}>Carregando catálogo...</p>
                    ) : products.length === 0 ? (
                      <p style={{ color: 'var(--color-text-secondary)' }}>Nenhum produto disponível no catálogo.</p>
                    ) : (
                      <div className="provador-catalog-grid">
                        {products.map(product => (
                          <button
                            key={product.id}
                            className={`provador-catalog-item ${selectedProduct?.id === product.id ? 'selected' : ''}`}
                            onClick={() => setSelectedProduct(product)}
                            title={product.name}
                            aria-label={`Selecionar ${product.name}`}
                          >
                            <Image
                              src={product.images[0]}
                              alt={product.name}
                              width={120}
                              height={120}
                              className="item-image"
                            />
                            <div className="item-name">{product.name}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Selected summary */}
                  {selectedProduct && (
                    <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 'var(--spacing-lg)', border: '1px solid var(--color-primary)', display: 'flex', gap: 'var(--spacing-md)', alignItems: 'center' }}>
                      <Image src={selectedProduct.images[0]} alt={selectedProduct.name} width={56} height={56} style={{ borderRadius: 'var(--radius-md)', objectFit: 'cover' }} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{selectedProduct.name}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{selectedProduct.origin}</div>
                      </div>
                    </div>
                  )}

                  {/* Generate CTA */}
                  <button
                    className="btn btn-gold provador-generate-btn"
                    disabled={!userPhoto || !selectedProduct || generating}
                    onClick={handleGenerate}
                  >
                    {generating ? '✨ Gerando...' : '✨ Gerar Meu Novo Visual'}
                  </button>

                  {!userPhoto && !selectedProduct && (
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
                      Envie sua foto e selecione um cabelo para gerar o resultado
                    </p>
                  )}
                </div>
              </div>

              {/* Loading */}
              {generating && (
                <div className="provador-loading">
                  <div className="provador-spinner" />
                  <p>✨ Gerando seu novo visual...</p>
                  <p className="subtitle">Isso pode levar até 30 segundos</p>
                </div>
              )}

              {/* Result */}
              {resultImage && !generating && (
                <div className="provador-result">
                  <div className="section-header">
                    <h2>Seu Novo Visual</h2>
                    <span className="gold-line" />
                  </div>

                  <div className="provador-result-grid">
                    <div className="provador-result-card">
                      <div className="provador-result-label">Antes</div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={userPhoto || ''} alt="Foto original" className="provador-result-image" />
                    </div>
                    <div className="provador-result-card highlight">
                      <div className="provador-result-label">Depois — com {selectedProduct?.name}</div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={resultImage} alt="Resultado gerado" className="provador-result-image" />
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'center', marginTop: 'var(--spacing-xl)', flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" onClick={handleGenerate}>
                      🔄 Gerar Novamente
                    </button>
                    <button className="btn btn-secondary" onClick={() => { setSelectedProduct(null); setResultImage(null); }}>
                      💇‍♀️ Escolher Outro Cabelo
                    </button>
                    <button className="btn btn-ghost" onClick={handleDownload}>
                      📥 Download
                    </button>
                  </div>

                  {/* Share Bar */}
                  <div style={{ marginTop: 'var(--spacing-xl)' }}>
                    <p style={{ textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-md)' }}>
                      Compartilhe seu resultado
                    </p>
                    <div className="provador-share-bar">
                      {/* Instagram */}
                      <button onClick={handleInstagramShare} className="provador-share-btn" title="Instagram" aria-label="Compartilhar no Instagram">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
                      </button>
                      {/* Facebook */}
                      <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}&quote=${encodeURIComponent(invitationText)}`} target="_blank" rel="noopener noreferrer" className="provador-share-btn" title="Facebook" aria-label="Compartilhar no Facebook">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                      </a>
                      {/* X (Twitter) */}
                      <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(invitationText)}`} target="_blank" rel="noopener noreferrer" className="provador-share-btn" title="X (Twitter)" aria-label="Compartilhar no X">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                      </a>
                      {/* WhatsApp */}
                      <a href={`https://api.whatsapp.com/send?text=${shareText}`} target="_blank" rel="noopener noreferrer" className="provador-share-btn" title="WhatsApp" aria-label="Compartilhar no WhatsApp">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.025.507 3.938 1.395 5.617L.02 23.98l6.531-1.314A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-1.875 0-3.66-.506-5.22-1.44l-.375-.22-3.885.78.825-3.81-.248-.39A9.68 9.68 0 0 1 2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75z"/></svg>
                      </a>
                      {/* Telegram */}
                      <a href={`https://t.me/share/url?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(invitationText)}`} target="_blank" rel="noopener noreferrer" className="provador-share-btn" title="Telegram" aria-label="Compartilhar no Telegram">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                      </a>
                      {/* E-mail */}
                      <a href={`mailto:?subject=${encodeURIComponent(`Provador Virtual - ${empresaNome}`)}&body=${encodeURIComponent(`${invitationText}\n\n${pageUrl}`)}`} className="provador-share-btn" title="E-mail" aria-label="Compartilhar por E-mail">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                      </a>
                      {/* Copy Link */}
                      <button onClick={handleCopyLink} className="provador-share-btn" title="Copiar Link" aria-label="Copiar link">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                      </button>
                      {/* Web Share API (mobile) */}
                      {typeof navigator !== 'undefined' && 'share' in navigator && (
                        <button onClick={handleNativeShare} className="provador-share-btn" title="Mais opções" aria-label="Compartilhar">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* CTA to buy */}
                  {selectedProduct && (
                    <div style={{ textAlign: 'center', marginTop: 'var(--spacing-2xl)' }}>
                      <Link href={`/catalogo/produto/${selectedProduct.slug}`} className="btn btn-gold btn-lg">
                        ❤️ Gostei! Quero Comprar — {selectedProduct.name}
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
