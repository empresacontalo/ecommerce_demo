'use client';

import { useState, useEffect } from 'react';
import Script from 'next/script';
import {
  CHATWOOT_BASE_URL,
  CHATWOOT_SETTINGS,
  CHATWOOT_WEBSITE_TOKEN,
} from '@/utils/chatwoot-config';
import { getConfig } from '@/utils/empresa';

type ChatwootWindow = Window & {
  $chatwoot?: { toggle: () => void };
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
  // Config dinâmica: prioriza o que estiver salvo no CMS (alterável via
  // MCP/painel) e usa as constantes do código como fallback.
  const [chatwoot, setChatwoot] = useState<{ baseUrl: string; token: string }>({
    baseUrl: CHATWOOT_BASE_URL,
    token: CHATWOOT_WEBSITE_TOKEN,
  });

  useEffect(() => {
    (async () => {
      try {
        const [url, token] = await Promise.all([
          getConfig('chatwoot.url'),
          getConfig('chatwoot.token'),
        ]);
        if (url || token) {
          setChatwoot({
            baseUrl: (url as string) || CHATWOOT_BASE_URL,
            token: (token as string) || CHATWOOT_WEBSITE_TOKEN,
          });
        }
      } catch { /* mantém fallback */ }
    })();
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
      <Script
        id="chatwoot-bootstrap"
        dangerouslySetInnerHTML={{
          __html: `window.chatwootSettings = ${JSON.stringify(CHATWOOT_SETTINGS)}; (function(d,t) { var BASE_URL=${JSON.stringify(chatwoot.baseUrl)}; var g=d.createElement(t),s=d.getElementsByTagName(t)[0]; g.src=BASE_URL+"/packs/js/sdk.js"; g.async=true; s.parentNode.insertBefore(g,s); g.onload=function(){ window.chatwootSDK.run({ websiteToken: ${JSON.stringify(chatwoot.token)}, baseUrl: BASE_URL }) } })(document,"script");`,
        }}
      />

      {/* Botão flutuante do chat (sempre visível, acima do WhatsApp) */}
      <button
        className={`chat-toggle ${isOpen ? 'active' : ''}`}
        onClick={toggleChat}
        aria-label={isOpen ? 'Fechar chat' : 'Abrir chat'}
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