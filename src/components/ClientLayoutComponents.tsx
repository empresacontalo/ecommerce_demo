'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import CookieConsent from "@/components/CookieConsent";
import WhatsAppButton from "@/components/WhatsAppButton";
import ShareButton from "@/components/ShareButton";
import CartSidebar from "@/components/CartSidebar";
import ChatWidget from "@/components/ChatWidget";
import ScrollReveal from "./ScrollReveal";
import SiteModeBanner from "@/components/SiteModeBanner";
import MensagemFlutuante from "@/components/campanhas/MensagemFlutuante";
import { getConfig } from '@/utils/empresa';

export default function ClientLayoutComponents({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const isAdmin = pathname.startsWith('/admin');

  // Imagem de fundo dos heróis das páginas internas (editável no admin → Configurações).
  // Publica o valor em --page-hero-image, consumido pelo CSS (.about-hero).
  useEffect(() => {
    (async () => {
      try {
        const v = await getConfig('site.hero_imagem_paginas');
        const url = typeof v === 'string' && v.trim() ? v.trim() : '';
        if (url) document.documentElement.style.setProperty('--page-hero-image', `url(${url})`);
      } catch { /* mantém fallback do CSS */ }
    })();
  }, []);

  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <>
      <SiteModeBanner />
      <Header />
      <ScrollReveal />
      <main className="main-content">
        {children}
      </main>
      <Footer />
      <CartSidebar />
      <ChatWidget />
      <CookieConsent />
      <WhatsAppButton />
      <MensagemFlutuante />
      <ShareButton />
    </>
  );
}
