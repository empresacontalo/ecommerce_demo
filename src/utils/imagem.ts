/**
 * Utilitários de imagem para upload no painel admin.
 * Segue o padrão do projeto (galeria/carrossel): foto vira data URI base64
 * persistida no banco. Aqui as fotos são redimensionadas no navegador para
 * não pesar no banco nem nas listagens.
 */

export const IMAGEM_MAX_BYTES = 8 * 1024 * 1024; // 8MB (arquivo original)
export const IMAGEM_MAX_LADO = 1200; // px no lado maior após redimensionar
export const DATA_URI_MAX_BYTES = 5 * 1024 * 1024; // 5MB (data URI persistida)

export type TipoImagemArquivo = 'jpg' | 'png' | 'webp' | 'gif' | 'avif' | 'svg' | 'outro';

/** Valida que a string é um link http/https de imagem. */
export function ehLinkValido(valor: string): boolean {
  try {
    const u = new URL(valor);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Valida que a string é uma data URI de imagem (ex: data:image/jpeg;base64,...). */
export function ehDataUriImagem(valor: string): boolean {
  return /^data:image\/(jpeg|png|webp|gif|avif|svg\+xml);base64,/i.test(valor);
}

/** Valida um valor aceitável para o campo de imagem do produto. */
export function valorImagemValido(valor: string): boolean {
  if (!valor) return false;
  if (valor.startsWith('/')) return true; // caminho local (padrões do tema)
  if (ehDataUriImagem(valor)) return valor.length <= DATA_URI_MAX_BYTES;
  return ehLinkValido(valor);
}

export function tipoArquivoImagem(file: File): TipoImagemArquivo | null {
  const tipo = file.type.toLowerCase();
  if (tipo === 'image/jpeg' || tipo === 'image/jpg') return 'jpg';
  if (tipo === 'image/png') return 'png';
  if (tipo === 'image/webp') return 'webp';
  if (tipo === 'image/gif') return 'gif';
  if (tipo === 'image/avif') return 'avif';
  if (tipo === 'image/svg+xml') return 'svg';
  return null;
}

export function arquivoImagemValido(file: File): boolean {
  return tipoArquivoImagem(file) !== null && file.size <= IMAGEM_MAX_BYTES;
}

/** Lê o arquivo como data URI (sem redimensionar). */
export function lerArquivoComoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo'));
    reader.readAsDataURL(file);
  });
}

/**
 * Redimensiona a imagem no navegador (canvas) para que o lado maior tenha
 * no máximo `maxLado` px, mantendo a proporção, e devolve uma data URI
 * WebP/JPEG comprimida. SVG é devolvido como está (não é rasterizável).
 */
export async function redimensionarImagemParaEnvio(
  file: File,
  maxLado = IMAGEM_MAX_LADO,
  qualidade = 0.85,
): Promise<string> {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    throw new Error('Redimensionamento disponível apenas no navegador');
  }
  const tipo = tipoArquivoImagem(file);
  if (!tipo) throw new Error('O arquivo não é uma imagem suportada (JPG, PNG, WEBP, GIF, AVIF ou SVG)');
  if (tipo === 'svg' || tipo === 'gif') {
    return lerArquivoComoDataUrl(file);
  }

  const dataUrl = await lerArquivoComoDataUrl(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Falha ao processar a imagem'));
    el.src = dataUrl;
  });

  const escala = Math.min(1, maxLado / Math.max(img.naturalWidth, img.naturalHeight));
  const largura = Math.max(1, Math.round(img.naturalWidth * escala));
  const altura = Math.max(1, Math.round(img.naturalHeight * escala));

  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Navegador sem suporte a canvas');
  ctx.drawImage(img, 0, 0, largura, altura);

  try {
    return canvas.toDataURL('image/webp', qualidade);
  } catch {
    return canvas.toDataURL('image/jpeg', qualidade);
  }
}