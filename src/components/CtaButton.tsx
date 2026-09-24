'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { abrirChatAgendamento } from '@/components/ChatWidget';
import { getConfig } from '@/utils/empresa';

export function isChatHref(href?: string | null): boolean {
  return !!href && (href.startsWith('chat:') || href === 'chat');
}

/**
 * Link "whatsapp:" resolve dinamicamente o número configurado em
 * Admin > Configurações > Dados da Empresa (whatsapp.numero + whatsapp.mensagem),
 * garantindo que os botões sempre apontem para o WhatsApp correto.
 */
export function isWhatsappHref(href?: string | null): boolean {
  return !!href && (href === 'whatsapp' || href.startsWith('whatsapp:'));
}

/**
 * Botão/Link de CTA. Se o href iniciar com `chat:` abre o chat do site
 * (ex: `chat:agendar` direciona o cliente para combinar o agendamento no chat).
 * Se for `whatsapp:` (ou `whatsapp`), abre o número configurado no admin.
 * URLs http(s) abrem em nova aba; demais são navegação interna.
 */
export default function CtaButton({
  href,
  className,
  children,
  style,
  ariaLabel,
  onClick,
}: {
  href?: string | null;
  className?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  ariaLabel?: string;
  onClick?: () => void;
}) {
  const h = href || '#';
  const [waLink, setWaLlink] = useState<string | null>(null);
  const [waMsg, setWaMsg] = useState('');

  useEffect(() => {
    if (!isWhatsappHref(h)) return;
    (async () => {
      try {
        const wa = await getConfig('whatsapp.numero');
        const m = await getConfig('whatsapp.mensagem');
        if (wa?.link) setWaLlink(String(wa.link));
        if (typeof m === 'string' && m.trim()) setWaMsg(m.trim());
      } catch { /* sem número configurado */ }
    })();
  }, [h]);

  if (isChatHref(h)) {
    return (
      <button type="button" className={className} style={style} aria-label={ariaLabel} onClick={() => { onClick?.(); abrirChatAgendamento(); }}>
        {children}
      </button>
    );
  }

  // whatsapp: → resolve o número do admin (link + mensagem padrão).
  if (isWhatsappHref(h)) {
    if (!waLink) return null;
    const sep = waLink.includes('?') ? '&' : '?';
    const url = waMsg ? `${waLink}${sep}text=${encodeURIComponent(waMsg)}` : waLink;
    return (
      <a href={url} className={className} style={style} onClick={onClick} target="_blank" rel="noopener noreferrer" aria-label={ariaLabel}>
        {children}
      </a>
    );
  }

  if (/^https?:\/\//i.test(h)) {
    return (
      <a href={h} className={className} style={style} onClick={onClick} target="_blank" rel="noopener noreferrer" aria-label={ariaLabel}>
        {children}
      </a>
    );
  }
  return (
    <Link href={h} className={className} style={style} onClick={onClick} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}