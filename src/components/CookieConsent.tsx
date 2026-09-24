'use client';

import { useState, useEffect } from 'react';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('fh_consent');
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const acceptAll = () => {
    localStorage.setItem('fh_consent', JSON.stringify({
      essential: true,
      analytics: true,
      timestamp: new Date().toISOString()
    }));
    setVisible(false);
  };

  const acceptEssential = () => {
    localStorage.setItem('fh_consent', JSON.stringify({
      essential: true,
      analytics: false,
      timestamp: new Date().toISOString()
    }));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className={`cookie-banner ${visible ? 'visible' : ''}`} role="dialog" aria-label="Consentimento de cookies">
      <div className="cookie-inner">
        <div className="cookie-text">
          <h4>🍪 Sua privacidade importa</h4>
          <p>
            Utilizamos cookies para melhorar sua experiência e personalizar conteúdo.
            Ao clicar em &quot;Aceitar todos&quot;, você concorda com o uso de cookies conforme nossa{' '}
            <a href="/politica-de-privacidade" style={{ color: 'var(--color-primary)' }}>Política de Privacidade</a>.
          </p>
        </div>
        <div className="cookie-actions">
          <button className="btn btn-ghost btn-sm" onClick={acceptEssential}>
            Apenas essenciais
          </button>
          <button className="btn btn-primary btn-sm" onClick={acceptAll}>
            Aceitar todos
          </button>
        </div>
      </div>
    </div>
  );
}
