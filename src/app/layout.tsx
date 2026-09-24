import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./components.css";
import "./home.css";
import "./checkout.css";
import "@/components/layout/header.css";
import { CartProvider } from "@/context/CartContext";
import ClientLayoutComponents from "@/components/ClientLayoutComponents";
import ThemeProvider from "@/components/ThemeProvider";
import { getConfiguracao } from "@/app/actions/cms";
import { getGoogleTagsDaPagina } from "@/app/actions/google-tags";
import { GoogleTagsHead, GoogleTagsBody } from "@/components/GoogleTags";
import { EMPRESA_NOME_PADRAO } from "@/utils/empresa-default";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ecommerce.digitalarea.online";

export async function generateMetadata(): Promise<Metadata> {
  const [logo, seo] = await Promise.all([
    getConfiguracao('header.logo'),
    getConfiguracao('seo.home'),
  ]);
  const logoValor = logo?.valor as { texto?: string; subtitulo?: string } | null | undefined;
  const nome = logoValor?.texto || EMPRESA_NOME_PADRAO;
  const subtitulo = logoValor?.subtitulo || '';
  const seoValor = (seo?.valor ?? {}) as Record<string, unknown>;
  const seoTitulo = typeof seoValor.title === 'string' && seoValor.title ? seoValor.title : '';
  const seoDesc = typeof seoValor.description === 'string' && seoValor.description ? seoValor.description : '';
  const title = seoTitulo || (nome ? `${nome}${subtitulo ? ` — ${subtitulo}` : ''}` : EMPRESA_NOME_PADRAO);
  const description = seoDesc || (nome ? `${nome} — ${subtitulo}`.trim() : '');
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: "en_US",
      url: siteUrl,
      siteName: nome || EMPRESA_NOME_PADRAO,
    },
    icons: {
      icon: [
        { url: '/favicon.ico', type: 'image/x-icon' },
        { url: '/icon.svg', type: 'image/svg+xml' },
      ],
      apple: '/apple-icon.png',
    },
    robots: { index: true, follow: true },
    alternates: { canonical: siteUrl },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Pathname definido no middleware (x-pathname) — usado para escolher as
  // Google TAGS de Tráfego Pago que entram no <head> desta página.
  const pathname = (await headers()).get('x-pathname') || '';
  const googleTags = await getGoogleTagsDaPagina(pathname);

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="theme-color" content="#16130B" />
        <GoogleTagsHead tags={googleTags} />
      </head>
      <body>
        <GoogleTagsBody tags={googleTags} />
        <ThemeProvider>
          <CartProvider>
            <ClientLayoutComponents>
              {children}
            </ClientLayoutComponents>
          </CartProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
