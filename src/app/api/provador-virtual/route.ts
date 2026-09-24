import { NextResponse } from 'next/server';
import { createClient } from '@/utils/auth/server';
import sharp from 'sharp';

const OPENAI_API_URL = 'https://api.openai.com/v1/images/edits';

/**
 * Monta o prompt dinâmico incluindo o comprimento do cabelo (se disponível no nome do produto).
 */
function buildPrompt(productName?: string): string {
  // Extrair comprimento do nome do produto (ex: "Cabelo Liso Brasileiro 60cm" → "60cm")
  const lengthMatch = productName?.match(/(\d+)\s*cm/i);
  const lengthInfo = lengthMatch ? ` O cabelo deve ter ${lengthMatch[1]}cm de comprimento.` : '';

  return `Troque apenas o cabelo da pessoa pelo cabelo da segunda imagem.${lengthInfo} Preserve exatamente o rosto, identidade, expressão, olhos, nariz, boca, sobrancelhas, tom de pele e enquadramento. Não altere roupas, fundo ou iluminação. Resultado fotográfico realista.`;
}

/**
 * Redimensiona imagem isometricamente se a menor dimensão > 1024px
 * Retorna Buffer da imagem processada
 */
async function resizeIfNeeded(imageBuffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(imageBuffer).metadata();
  const { width, height } = metadata;

  if (!width || !height) {
    return imageBuffer;
  }

  const minDimension = Math.min(width, height);

  if (minDimension > 1024) {
    // Calcular o fator de escala para que a menor dimensão seja 1024
    const scale = 1024 / minDimension;
    const newWidth = Math.round(width * scale);
    const newHeight = Math.round(height * scale);

    return sharp(imageBuffer)
      .resize(newWidth, newHeight, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
  }

  // Converter para PNG (formato aceito pela API) sem redimensionar
  return sharp(imageBuffer).png().toBuffer();
}

/**
 * Extrai o Buffer de uma string base64 (com ou sem data URI prefix)
 */
function base64ToBuffer(base64String: string): Buffer {
  const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64Data, 'base64');
}

/**
 * Faz download de uma imagem e retorna como Buffer.
 * - Caminhos relativos (ex: /images/product-1.jpg): lê direto do filesystem (public/)
 * - URLs absolutas: faz fetch com validação SSRF de domínio
 */
async function downloadImage(url: string): Promise<Buffer> {
  // Caminho relativo — arquivo local em public/
  if (url.startsWith('/')) {
    const path = await import('path');
    const fs = await import('fs');

    // Em dev: process.cwd()/public, em standalone: pode variar
    const publicDir = path.join(process.cwd(), 'public');
    const filePath = path.join(publicDir, url);

    // Prevenir path traversal (ex: /../../../etc/passwd)
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(publicDir))) {
      throw new Error('Caminho de imagem inválido.');
    }

    if (!fs.existsSync(resolved)) {
      throw new Error(`Imagem não encontrada: ${url}`);
    }

    return fs.readFileSync(resolved);
  }

  // URL absoluta — fetch com validação de domínio
  const parsedUrl = new URL(url);
  const allowedHosts = new Set<string>();

  const addHost = (envVal?: string) => {
    if (envVal) {
      try {
        const u = new URL(envVal);
        allowedHosts.add(u.hostname);
      } catch {
        allowedHosts.add(envVal);
      }
    }
  };

  addHost(process.env.NEXT_PUBLIC_SITE_URL);
  addHost(process.env.API_EXTERNAL_URL);
  addHost(process.env.SITE_URL);
  allowedHosts.add('localhost');
  allowedHosts.add('127.0.0.1');

  if (!allowedHosts.has(parsedUrl.hostname)) {
    throw new Error(`Domínio da imagem não autorizado: ${parsedUrl.hostname}`);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Falha ao baixar imagem do catálogo: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// POST — Gera imagem com GPT Image 2
export async function POST(req: Request) {
  try {
    const API_KEY = process.env.OPENAI_API_KEY;
    if (!API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY não configurada' }, { status: 500 });
    }

    // Autenticar usuário
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado. Faça login para usar o Provador Virtual.' }, { status: 401 });
    }

    const { userPhotoBase64, productImageUrl, productName } = await req.json();

    if (!userPhotoBase64 || !productImageUrl) {
      return NextResponse.json(
        { error: 'Envie sua foto e selecione um cabelo do catálogo.' },
        { status: 400 }
      );
    }

    // Validar se a foto fornecida é uma imagem data URI válida
    if (!userPhotoBase64.startsWith('data:image/')) {
      return NextResponse.json(
        { error: 'Formato de imagem inválido. A foto deve ser um data URI.' },
        { status: 400 }
      );
    }

    // 1. Processar a foto do usuário
    const userImageRaw = base64ToBuffer(userPhotoBase64);

    // Validar tamanho (5MB máximo para o binário)
    if (userImageRaw.length > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Imagem muito grande. Máximo: 5MB.' }, { status: 400 });
    }

    // 2. Redimensionar isometricamente se necessário
    const userImageResized = await resizeIfNeeded(userImageRaw);

    // 3. Baixar e processar imagem do cabelo do catálogo
    const hairImageRaw = await downloadImage(productImageUrl);
    const hairImageProcessed = await sharp(hairImageRaw).png().toBuffer();

    // 4. Chamar a API OpenAI GPT Image 2 (multipart/form-data com múltiplas imagens)
    const formData = new FormData();

    // Primeira imagem: foto do usuário
    const userBlob = new Blob([new Uint8Array(userImageResized)], { type: 'image/png' });
    formData.append('image[]', userBlob, 'user_photo.png');

    // Segunda imagem: cabelo do catálogo
    const hairBlob = new Blob([new Uint8Array(hairImageProcessed)], { type: 'image/png' });
    formData.append('image[]', hairBlob, 'hair_reference.png');

    formData.append('prompt', buildPrompt(productName));
    formData.append('model', 'gpt-image-2');
    formData.append('n', '1');
    formData.append('size', '1024x1024');
    formData.append('quality', 'low');

    const openaiResponse = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: formData,
      signal: AbortSignal.timeout(90000), // 90 seconds timeout
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json().catch(() => ({}));
      const errorMessage = errorData?.error?.message || `OpenAI API error: ${openaiResponse.status}`;
      console.error('[ProvadorVirtual] OpenAI Error:', errorMessage);
      return NextResponse.json(
        { error: `Erro ao gerar imagem: ${errorMessage}` },
        { status: 502 }
      );
    }

    const result = await openaiResponse.json();

    // A API retorna b64_json ou url
    const generatedImage = result.data?.[0]?.b64_json || result.data?.[0]?.url;

    if (!generatedImage) {
      return NextResponse.json({ error: 'Nenhuma imagem foi gerada.' }, { status: 500 });
    }

    // Se retornou b64_json, enviar como base64. Se retornou url, enviar a url.
    const isBase64 = !!result.data?.[0]?.b64_json;

    return NextResponse.json({
      success: true,
      image: isBase64 ? `data:image/png;base64,${generatedImage}` : generatedImage,
      isBase64,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('[ProvadorVirtual] Error:', message);

    if (message.includes('timed out') || message.includes('timeout')) {
      return NextResponse.json(
        { error: 'A geração da imagem demorou demais. Tente novamente.' },
        { status: 504 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
