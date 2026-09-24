import { query } from '@/utils/db';
import { getConfiguracao } from '@/app/actions/cms';
import { URLS_PAGAMENTO } from '@/utils/pagamento-consts';
import type { ProvedorPagamento, ModoPagamento } from '@/utils/pagamento-consts';

export type { ProvedorPagamento, ModoPagamento };
export { urlPadrao, DOCS_PAGAMENTO } from '@/utils/pagamento-consts';

export interface ConfigPagamento {
  provedor: ProvedorPagamento;
  modo: ModoPagamento;
  apiUrl: string;
  apiKey: string;
  webhookToken: string;
}

export interface ResultadoCobranca {
  paymentId: string | null;
  invoiceUrl?: string | null;
  pixQrCodePayload?: string | null;
  pixQrCodeUrl?: string | null;
  boletoUrl?: string | null;
  boletoLinha?: string | null;
  raw?: unknown;
}

export interface DadosCliente {
  name: string;
  email: string;
  cpf: string;
  phone: string;
}

export interface DadosCartao {
  number?: string;
  name?: string;
  expiry?: string;
  cvv?: string;
  installments?: number;
  // Endereço do titular do cartão (exigido pelo Asaas para cartão de crédito)
  address?: {
    postalCode: string;
    number: string;
    complement?: string;
    phone?: string;
  };
}

export interface DadosCobranca {
  cliente: DadosCliente;
  valor: number;
  descricao: string;
  metodo: 'pix' | 'credit' | 'boleto';
  pedidoId: string;
  card?: DadosCartao | null;
}

function validarCartao(card?: DadosCartao | null): void {
  if (!card?.number || !card.name || !card.expiry || !card.cvv) {
    throw new Error('Dados do cartão incompletos (número, nome, validade, CVV)');
  }
  if (!card.address?.postalCode || !card.address?.number) {
    throw new Error('Informe o endereço do titular do cartão (CEP e número são obrigatórios).');
  }
}

function parseExpiry(expiry: string): { month: string; year: string } {
  const [m, y] = expiry.split('/');
  return { month: (m || '').padStart(2, '0'), year: (y || '').slice(0, 2) };
}

function detectBrand(number: string): string {
  const n = number.replace(/\D/g, '');
  if (/^4/.test(n)) return 'Visa';
  if (/^5[1-5]/.test(n)) return 'Master';
  if (/^3[47]/.test(n)) return 'Amex';
  if (/^(6011|65|64[4-9])/.test(n)) return 'Discover';
  if (/^3[68]/.test(n)) return 'Diners';
  if (/^6(?:011|5)/.test(n)) return 'Elo';
  if (/^50|^63|^67/.test(n)) return 'Elo';
  return 'Visa';
}

export async function getConfigPagamento(): Promise<ConfigPagamento> {
  const [prov, modo, url, key, wh] = await Promise.all([
    getConfiguracao('pagamento.provedor'),
    getConfiguracao('pagamento.modo'),
    getConfiguracao('pagamento.api_url'),
    getConfiguracao('pagamento.api_key'),
    getConfiguracao('pagamento.webhook_token'),
  ]);

  const provedor = (prov?.valor as ProvedorPagamento) || 'asaas';
  const modoPag = (modo?.valor as ModoPagamento) || 'sandbox';

  return {
    provedor,
    modo: modoPag,
    apiUrl: ((url?.valor as string) || URLS_PAGAMENTO[provedor]?.[modoPag] || URLS_PAGAMENTO.asaas.sandbox).replace(/\/$/, ''),
    apiKey: (key?.valor as string) || process.env.ASAAS_API_KEY || '',
    webhookToken: (wh?.valor as string) || '',
  };
}

/* ═══════════════════════════════════════════════════════════════
   Asaas (v3)
   ═══════════════════════════════════════════════════════════════ */
async function cobrancaAsaas(cfg: ConfigPagamento, d: DadosCobranca): Promise<ResultadoCobranca> {
  const headers = { 'Content-Type': 'application/json', access_token: cfg.apiKey };

  const customerRes = await fetch(`${cfg.apiUrl}/customers`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: d.cliente.name,
      email: d.cliente.email,
      cpfCnpj: d.cliente.cpf.replace(/\D/g, ''),
      mobilePhone: d.cliente.phone.replace(/\D/g, ''),
    }),
  });
  const customerData = await customerRes.json();
  if (!customerRes.ok) {
    throw new Error(customerData.errors?.[0]?.description || 'Falha ao criar cliente no Asaas');
  }

  const billingType = d.metodo === 'credit' ? 'CREDIT_CARD' : d.metodo === 'boleto' ? 'BOLETO' : 'PIX';
  const paymentPayload: Record<string, unknown> = {
    customer: customerData.id,
    billingType,
    value: d.valor,
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    description: d.descricao,
    // Permite ao webhook reconciliar a cobrança mesmo se o vínculo
    // asaas_payment_id falhar no checkout (cobrança órfã).
    externalReference: d.pedidoId,
  };

  if (billingType === 'CREDIT_CARD') {
    validarCartao(d.card);
    const { month, year } = parseExpiry(d.card!.expiry!);
    paymentPayload.creditCard = {
      holderName: d.card!.name,
      number: d.card!.number!.replace(/\D/g, ''),
      expiryMonth: month,
      expiryYear: year,
      ccv: d.card!.cvv,
    };
    paymentPayload.creditCardHolderInfo = {
      name: d.card!.name,
      email: d.cliente.email,
      cpfCnpj: d.cliente.cpf.replace(/\D/g, ''),
      postalCode: d.card!.address?.postalCode?.replace(/\D/g, '') || '',
      addressNumber: d.card!.address?.number || '',
      addressComplement: d.card!.address?.complement || undefined,
      phone: d.card!.address?.phone?.replace(/\D/g, '') || d.cliente.phone.replace(/\D/g, ''),
    };
    paymentPayload.installmentCount = d.card!.installments || 1;
    paymentPayload.totalValue = d.valor;
    paymentPayload.installmentValue = Number((d.valor / (d.card!.installments || 1)).toFixed(2));
  }

  const paymentRes = await fetch(`${cfg.apiUrl}/payments`, {
    method: 'POST',
    headers,
    body: JSON.stringify(paymentPayload),
  });
  const paymentData = await paymentRes.json();
  if (!paymentRes.ok) {
    throw new Error(paymentData.errors?.[0]?.description || 'Falha ao criar cobrança no Asaas');
  }

  let pixQrCodePayload: string | null = null;
  let pixQrCodeUrl: string | null = null;
  if (billingType === 'PIX') {
    const pixRes = await fetch(`${cfg.apiUrl}/payments/${paymentData.id}/pixQrCode`, {
      headers: { access_token: cfg.apiKey },
    });
    if (pixRes.ok) {
      const pixData = await pixRes.json();
      pixQrCodePayload = pixData.payload || null;
      pixQrCodeUrl = pixData.encodedImage || null;
    }
  }

  return {
    paymentId: paymentData.id,
    invoiceUrl: paymentData.invoiceUrl ?? null,
    pixQrCodePayload,
    pixQrCodeUrl,
    raw: paymentData,
  };
}

/* ═══════════════════════════════════════════════════════════════
   Getnet (API v1) — OAuth client_credentials + cobranças
   ═══════════════════════════════════════════════════════════════ */
async function getnetAccessToken(cfg: ConfigPagamento): Promise<{ token: string; sellerId: string }> {
  // apiKey pode ser "client_id:client_secret:seller_id"
  const parts = cfg.apiKey.split(':');
  const clientId = parts[0] || '';
  const clientSecret = parts[1] || '';
  const sellerId = parts[2] || '';
  if (!clientId || !clientSecret) {
    throw new Error('Getnet: informe client_id:client_secret:seller_id no campo de token');
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(`${cfg.apiUrl}/auth/oauth/v2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.error || 'Falha ao obter token Getnet');
  }
  return { token: data.access_token, sellerId };
}

async function cobrancaGetnet(cfg: ConfigPagamento, d: DadosCobranca): Promise<ResultadoCobranca> {
  const { token, sellerId } = await getnetAccessToken(cfg);
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    seller_id: sellerId,
  };

  const order = { order_id: `pedido-${d.pedidoId}`, amount: Math.round(d.valor * 100), currency: 'BRL' };
  const customer = {
    customer_id: `cli-${d.pedidoId}`,
    first_name: d.cliente.name.split(' ')[0],
    last_name: d.cliente.name.split(' ').slice(1).join(' ') || 'Cliente',
    email: d.cliente.email,
    document_type: 'CPF',
    document_number: d.cliente.cpf.replace(/\D/g, ''),
    phone_number: d.cliente.phone.replace(/\D/g, ''),
  };

  if (d.metodo === 'pix') {
    const res = await fetch(`${cfg.apiUrl}/v1/payments/pix`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        seller_id: sellerId,
        amount: Math.round(d.valor * 100),
        order,
        customer,
        pix: { expiration_time: 900 },
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_message || data.message || 'Falha ao gerar PIX Getnet');
    return {
      paymentId: data.payment_id || data.paymentId || null,
      pixQrCodePayload: data.qrcode_string || data.qr_code || data.payload || null,
      pixQrCodeUrl: data.qrcode || null,
      raw: data,
    };
  }

  if (d.metodo === 'boleto') {
    const res = await fetch(`${cfg.apiUrl}/v1/payments/boleto`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        seller_id: sellerId,
        amount: Math.round(d.valor * 100),
        order,
        customer,
        boleto: { our_number: `0000${String(d.pedidoId).slice(0, 9)}`, expiration_date: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10) },
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_message || data.message || 'Falha ao gerar boleto Getnet');
    return {
      paymentId: data.payment_id || null,
      boletoUrl: data.boleto_link || null,
      boletoLinha: data.typeful_line || data.boleto_barcode || null,
      raw: data,
    };
  }

  if (d.metodo === 'credit') {
    validarCartao(d.card);
    const { month, year } = parseExpiry(d.card!.expiry!);
    const res = await fetch(`${cfg.apiUrl}/v1/payments/credit`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        seller_id: sellerId,
        amount: Math.round(d.valor * 100),
        order,
        customer,
        card: {
          number_token: d.card!.number!.replace(/\D/g, ''),
          cardholder_name: d.card!.name,
          expiration_month: month,
          expiration_year: year,
          security_code: d.card!.cvv,
        },
        credit: {
          delayed: false,
          authenticated: false,
          pre_authorization: false,
          save_card: false,
          transaction_type: 'FULL',
          number_installments: d.card!.installments || 1,
          soft_descriptor: d.descricao.slice(0, 13),
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_message || data.message || 'Falha na transação de cartão Getnet');
    return {
      paymentId: data.payment_id || data.paymentId || null,
      invoiceUrl: null,
      raw: data,
    };
  }

  throw new Error('Método de pagamento não suportado pela Getnet');
}

/* ═══════════════════════════════════════════════════════════════
   Cielo (API 3.0) — MerchantId + MerchantKey
   ═══════════════════════════════════════════════════════════════ */
async function cobrancaCielo(cfg: ConfigPagamento, d: DadosCobranca): Promise<ResultadoCobranca> {
  const parts = cfg.apiKey.split(':');
  const merchantId = parts[0] || '';
  const merchantKey = parts[1] || '';
  if (!merchantId || !merchantKey) {
    throw new Error('Cielo: informe MerchantId:MerchantKey no campo de token');
  }
  const headers = {
    'Content-Type': 'application/json',
    MerchantId: merchantId,
    MerchantKey: merchantKey,
  };

  const tipo = d.metodo === 'pix' ? 'Pix' : d.metodo === 'boleto' ? 'Boleto' : 'CreditCard';
  const payload: Record<string, unknown> = {
    MerchantOrderId: `pedido-${d.pedidoId}`,
    Customer: {
      Name: d.cliente.name,
      Identity: d.cliente.cpf.replace(/\D/g, ''),
      Email: d.cliente.email,
      Phone: d.cliente.phone.replace(/\D/g, ''),
    },
    Payment: {
      Type: tipo,
      Amount: Math.round(d.valor * 100),
      Provider: 'Cielo',
      Capture: true,
      Interest: 'ByMerchant',
      Installments: 1,
    },
  };

  if (d.metodo === 'boleto') {
    (payload.Payment as Record<string, unknown>).Instructions = 'Pagável em qualquer banco até o vencimento';
  }

  if (d.metodo === 'credit') {
    validarCartao(d.card);
    const { month, year } = parseExpiry(d.card!.expiry!);
    (payload.Payment as Record<string, unknown>).Installments = d.card!.installments || 1;
    (payload.Payment as Record<string, unknown>).CreditCard = {
      CardNumber: d.card!.number!.replace(/\D/g, ''),
      Holder: d.card!.name,
      ExpirationDate: `${year}/${month}`,
      SecurityCode: d.card!.cvv,
      Brand: detectBrand(d.card!.number!),
      SaveCard: false,
    };
  }

  const res = await fetch(`${cfg.apiUrl}/1/sales/`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || (data.Payment && ['Denied', 'Aborted'].includes(data.Payment.Status?.toString?.() === '0' ? 'Denied' : ''))) {
    const msg = data.Payment?.ReturnMessage || data.Payment?.ProviderReturnMessage || data.Message || 'Falha na Cielo';
    throw new Error(msg);
  }

  const payment = data.Payment || {};
  return {
    paymentId: payment.PaymentId || null,
    invoiceUrl: null,
    pixQrCodePayload: payment.QrCodeString || payment.QrCodeContent || null,
    pixQrCodeUrl: payment.QrCodeBase64 || payment.QrCodeImage || null,
    boletoUrl: payment.BoletoUrl || payment.Url || null,
    boletoLinha: payment.DigitableLine || payment.BoletoNumber || null,
    raw: data,
  };
}

/* ═══════════════════════════════════════════════════════════════
   Dispatch por provedor
   ═══════════════════════════════════════════════════════════════ */
export async function criarCobranca(d: DadosCobranca, cfg?: ConfigPagamento): Promise<ResultadoCobranca> {
  const config = cfg || (await getConfigPagamento());

  switch (config.provedor) {
    case 'getnet':
      return cobrancaGetnet(config, d);
    case 'cielo':
      return cobrancaCielo(config, d);
    case 'asaas':
    default:
      return cobrancaAsaas(config, d);
  }
}

export async function salvarIdsPagamento(
  pedidoId: string,
  paymentId: string | null,
  invoiceUrl: string | null | undefined,
  pixPayload: string | null | undefined,
  boletoUrl: string | null | undefined,
  boletoLinha: string | null | undefined
): Promise<void> {
  await query(
    `UPDATE public.orders
     SET asaas_payment_id = $2, asaas_invoice_url = $3, pix_qr_code = $4,
         boleto_url = $5, boleto_linha_digitavel = $6
     WHERE id = $1`,
    [pedidoId, paymentId, invoiceUrl ?? null, pixPayload ?? null, boletoUrl ?? null, boletoLinha ?? null]
  );
}
