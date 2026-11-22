'use client';

import { useState, useEffect } from 'react';
import {
  CHATWOOT_BASE_URL,
  CHATWOOT_SETTINGS,
  CHATWOOT_WEBSITE_TOKEN,
} from '@/utils/chatwoot-config';

type ChatwootWindow = Window & {
  $chatwoot?: { toggle: () => void };
  chatwootSettings?: typeof CHATWOOT_SETTINGS;
  chatwootSDK?: { run: (opts: { websiteToken: string; baseUrl: string }) => void };
};

/**
 * Abre o chat com uma mensagem pré-enviada (ex: produto sem estoque).
 * Cria a conversa via API, grava o cookie cw_conversation e abre o widget.
 * Não destrói o widget — apenas abre (evita o launcher sumir).
 */
export async function abrirChatComMensagem({ nome, descricao, mensagem }: { nome: string; descricao?: string; mensagem?: string }) {
  const w = window as ChatwootWindow;
  try {
    const res = await fetch('/api/chatwoot/pedir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, descricao: descricao || '', mensagem: mensagem || '' }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.authToken) {
        document.cookie = `cw_conversation=${data.authToken}; path=/; max-age=31536000; SameSite=Lax`;
      }
    }
  } catch {
    // fallback: apenas abre o chat
  }

  // Abre o chat uma única vez (evita toggle duplo que abriria e fecharia).
  let aberto = false;
  const abrirChat = () => {
    if (aberto) return;
    if (w.$chatwoot) {
      aberto = true;
      try {
        w.$chatwoot.toggle();
      } catch { /* ignora falha de toggle */ }
    }
  };

  if (w.$chatwoot) {
    abrirChat();
    return;
  }
  window.addEventListener('chatwoot:ready', abrirChat, { once: true });
  // Fallback caso o evento 'chatwoot:ready' não dispare.
  setTimeout(abrirChat, 3000);
}

/**
 * Abre o chat direcionado para atendimento. O atendimento é feito pela
 * equipe via chat (Chatwoot); o site apenas direciona o cliente.
 */
export async function abrirChatAgendamento() {
  await abrirChatComMensagem({
    nome: 'Atendimento',
    mensagem: 'Olá! Gostaria de mais informações. 😊',
  });
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadChatwoot = async () => {
      let baseUrl = CHATWOOT_BASE_URL;
      let token = CHATWOOT_WEBSITE_TOKEN;

      try {
        const res = await fetch('/api/chatwoot/pedir', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data?.baseUrl) baseUrl = String(data.baseUrl).replace(/\/$/, '');
          if (data?.websiteToken) token = String(data.websiteToken);
        }
      } catch {
        /* mantém fallback */
      }

      if (cancelled || !baseUrl || !token) return;

      const w = window as ChatwootWindow;
      w.chatwootSettings = CHATWOOT_SETTINGS;

      if (w.chatwootSDK) {
        w.chatwootSDK.run({ websiteToken: token, baseUrl });
        return;
      }

      const existing = document.getElementById('chatwoot-sdk-script') as HTMLScriptElement | null;
      if (existing) return;

      const script = document.createElement('script');
      script.id = 'chatwoot-sdk-script';
      script.src = `${baseUrl}/packs/js/sdk.js`;
      script.async = true;
      script.onload = () => {
        if (!cancelled && w.chatwootSDK) {
          w.chatwootSDK.run({ websiteToken: token, baseUrl });
        }
      };
      document.head.appendChild(script);
    };

    loadChatwoot();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleClose = () => setIsOpen(false);
    const handleOpen = () => setIsOpen(true);

    window.addEventListener('chatwoot:close', handleClose);
    window.addEventListener('chatwoot:open', handleOpen);

    return () => {
      window.removeEventListener('chatwoot:close', handleClose);
      window.removeEventListener('chatwoot:open', handleOpen);
    };
  }, []);

  const toggleChat = () => {
    const w = window as ChatwootWindow;
    if (w.$chatwoot) {
      w.$chatwoot.toggle();
    } else {
      window.addEventListener('chatwoot:ready', () => w.$chatwoot?.toggle(), { once: true });
    }
  };

  return (
    <>
      {/* Botão flutuante do chat (sempre visível, acima do WhatsApp) */}
      <button
        className={`chat-toggle ${isOpen ? 'active' : ''}`}
        onClick={toggleChat}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        {isOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>
    </>
  );
}