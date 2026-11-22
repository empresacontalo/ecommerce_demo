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
    <div className={`cookie-banner ${visible ? 'visible' : ''}`} role="dialog" aria-label="Cookie consent">
      <div className="cookie-inner">
        <div className="cookie-text">
          <h4>🍪 Your Privacy Matters</h4>
          <p>
            We use cookies to optimize your browsing experience and personalize content.
            By clicking &quot;Accept All&quot;, you consent to our use of cookies under our{' '}
            <a href="/politica-de-privacidade" style={{ color: 'var(--color-primary)' }}>Privacy Policy</a>.
          </p>
        </div>
        <div className="cookie-actions">
          <button className="btn btn-ghost btn-sm" onClick={acceptEssential}>
            Essential Only
          </button>
          <button className="btn btn-primary btn-sm" onClick={acceptAll}>
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
}
