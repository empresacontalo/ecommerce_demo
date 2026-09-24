// Catálogo de ícones pré-definidos para o logo do header.
// O campo "logo_imagem" aceita: nome de ícone deste catálogo, data URI
// (upload) ou URL de imagem. Nome vazio = logo em texto.

export interface LogoIcone {
  nome: string;
  icone: string;
  label: string;
}

export const LOGO_ICONES: LogoIcone[] = [
  { nome: 'tesoura', icone: '✂️', label: 'Tesoura' },
  { nome: 'cabelo', icone: '💇‍♀️', label: 'Cabelo' },
  { nome: 'barbeiro', icone: '💈', label: 'Barbeiro' },
  { nome: 'espiral', icone: '🌀', label: 'Espiral' },
  { nome: 'brilho', icone: '✨', label: 'Brilho' },
  { nome: 'coroa', icone: '👑', label: 'Coroa' },
  { nome: 'estrela', icone: '🌟', label: 'Estrela' },
  { nome: 'loja', icone: '🏪', label: 'Loja' },
  { nome: 'diamante', icone: '💎', label: 'Diamante' },
  { nome: 'laco', icone: '🎀', label: 'Laço' },
  { nome: 'cereja', icone: '🍒', label: 'Cereja' },
  { nome: 'flor', icone: '🌸', label: 'Flor' },
];

export function isNomeIconeLogo(v: string | null | undefined): boolean {
  return !!v && LOGO_ICONES.some((i) => i.nome === v);
}

export function iconeLogoParaEmoji(v: string | null | undefined): string {
  const found = LOGO_ICONES.find((i) => i.nome === v);
  return found ? found.icone : '✂️';
}
