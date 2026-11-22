'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Tarja de modo de teste. Exibida no topo do site quando
 * a configuração site.modo = "teste". Em produção, não aparece.
 *
 * A altura real da tarja é medida e publicada em --test-banner-h
 * (usada pelo header/main-content como offset), para que o deslocamento
 * continue correto mesmo quando o texto quebra em duas linhas em
 * resolução baixa (celular) ou em mudanças de orientação/zoom.
 */
export default function SiteModeBanner() {
  const [modo, setModo] = useState<string | null>(null);
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/cms/configuracoes?chave=site.modo');
        const data = res.ok ? await res.json() : null;
        if (active) setModo(data?.valor === 'teste' ? 'teste' : 'producao');
      } catch {
        if (active) setModo('producao');
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const root = document.documentElement;

    if (modo !== 'teste') {
      root.style.removeProperty('--test-banner-h');
      return;
    }

    const el = bannerRef.current;
    if (!el) return;
    const syncHeight = () => {
      root.style.setProperty('--test-banner-h', `${el.offsetHeight}px`);
    };

    syncHeight();
    const ro = new ResizeObserver(syncHeight);
    ro.observe(el);
    window.addEventListener('resize', syncHeight);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', syncHeight);
    };
  }, [modo]);

  if (modo !== 'teste') return null;

  return (
    <div ref={bannerRef} className="test-mode-banner" role="alert">
      <span aria-hidden="true">✨</span>
      <span>Demonstration Showcase — Exploring luxury fragrance collection in preview mode. Checkout and concierge chat active for testing.</span>
      <span aria-hidden="true">🛍️</span>
    </div>
  );
}
