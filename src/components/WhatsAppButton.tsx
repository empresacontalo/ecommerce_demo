'use client';

import { useEffect, useState } from 'react';
import { getConfig } from '@/utils/empresa';

const MSG_PADRAO = 'Olá! Gostaria de saber mais sobre seus produtos.';

export default function WhatsAppButton() {
  const [link, setLink] = useState('');
  const [msg, setMsg] = useState(MSG_PADRAO);

  useEffect(() => {
    (async () => {
      const wa = await getConfig('whatsapp.numero');
      if (wa?.link) setLink(wa.link);
      const m = await getConfig('whatsapp.mensagem');
      if (typeof m === 'string' && m.trim()) setMsg(m.trim());
    })();
  }, []);

  // White-label: sem número configurado no admin, o botão não aparece.
  if (!link) return null;

  return (
    <a
      href={`${link}?text=${encodeURIComponent(msg)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="whatsapp-float"
      aria-label="Fale conosco pelo WhatsApp"
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.025.507 3.938 1.395 5.617L.02 23.98l6.531-1.314A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-1.875 0-3.66-.506-5.22-1.44l-.375-.22-3.885.78.825-3.81-.248-.39A9.68 9.68 0 0 1 2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75z"/>
      </svg>
    </a>
  );
}
