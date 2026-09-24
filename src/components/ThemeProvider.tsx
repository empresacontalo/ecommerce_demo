'use client';

import { useEffect } from 'react';

/**
 * Chaves da paleta configuráveis (prefixo --color- é adicionado ao aplicar).
 */
export const PALETTE_KEYS = [
  'primary', 'primary-light', 'primary-dark', 'primary-hover', 'primary-rgb',
  'secondary', 'secondary-light', 'secondary-dark',
  'gold', 'gold-light', 'gold-dark',
  'dark', 'dark-soft', 'light', 'light-warm',
  'surface', 'surface-alt',
  'text', 'text-secondary', 'text-tertiary', 'text-inverse',
  'border', 'border-light', 'border-hover',
  'success', 'warning', 'error', 'info',
] as const;

export type PaletteTheme = 'dark' | 'light';
export type Palette = Record<string, string>;
export type Palettes = Record<PaletteTheme, Palette>;

export const DEFAULT_PALETTES: Palettes = {
  dark: {
    'primary': '#FFD700',
    'primary-light': '#FFE44D',
    'primary-dark': '#CCAC00',
    'primary-hover': '#FFC800',
    'primary-rgb': '255, 215, 0',
    'secondary': '#c9c6c5',
    'secondary-light': '#e5e2e1',
    'secondary-dark': '#4a4949',
    'gold': '#FFD700',
    'gold-light': '#FFE44D',
    'gold-dark': '#CCAC00',
    'dark': '#16130B',
    'dark-soft': '#231F17',
    'light': '#EAE1D4',
    'light-warm': '#D0C5AF',
    'surface': '#231F17',
    'surface-alt': '#2D2A21',
    'text': '#EAE1D4',
    'text-secondary': '#D0C5AF',
    'text-tertiary': '#99907C',
    'text-inverse': '#16130B',
    'border': '#4D4635',
    'border-light': '#38342B',
    'border-hover': '#99907C',
    'success': '#1D9E75',
    'warning': '#D4AF37',
    'error': '#ffb4ab',
    'info': '#3B82F6',
  },
  light: {
    'primary': '#B8860B',
    'primary-light': '#D4A017',
    'primary-dark': '#7A5E00',
    'primary-hover': '#C99700',
    'primary-rgb': '184, 134, 11',
    'secondary': '#8A8170',
    'secondary-light': '#A89F8B',
    'secondary-dark': '#5C5544',
    'gold': '#B8860B',
    'gold-light': '#D4A017',
    'gold-dark': '#7A5E00',
    'dark': '#F7F4EE',
    'dark-soft': '#FFFFFF',
    'light': '#1F1B12',
    'light-warm': '#4A4333',
    'surface': '#FFFFFF',
    'surface-alt': '#F0EADF',
    'text': '#1F1B12',
    'text-secondary': '#5C5544',
    'text-tertiary': '#8A8170',
    'text-inverse': '#FFFFFF',
    'border': '#D8D0BE',
    'border-light': '#E5DED0',
    'border-hover': '#A89F8B',
    'success': '#1D9E75',
    'warning': '#B8860B',
    'error': '#B3261E',
    'info': '#3B82F6',
  },
};

/** Aplica a paleta no :root do documento */
export function applyPalette(theme: PaletteTheme, palettes?: Palettes | null) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  const palette = palettes?.[theme] || DEFAULT_PALETTES[theme];
  for (const key of PALETTE_KEYS) {
    const value = palette[key];
    if (value) root.style.setProperty(`--color-${key}`, value);
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', palette.dark ?? '#16130B');
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    (async () => {
      try {
        const [ativoRes, paletaRes] = await Promise.all([
          fetch('/api/cms/configuracoes?chave=tema.ativo'),
          fetch('/api/cms/configuracoes?chave=tema.paleta'),
        ]);
        const ativo = ativoRes.ok ? (await ativoRes.json()).valor : 'dark';
        const paleta = paletaRes.ok ? (await paletaRes.json()).valor : null;
        applyPalette(ativo === 'light' ? 'light' : 'dark', paleta);
      } catch {
        applyPalette('dark');
      }
    })();
  }, []);

  return <>{children}</>;
}
