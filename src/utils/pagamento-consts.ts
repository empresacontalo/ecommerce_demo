export type ProvedorPagamento = 'asaas' | 'getnet' | 'cielo';
export type ModoPagamento = 'sandbox' | 'producao';

export const URLS_PAGAMENTO: Record<ProvedorPagamento, Record<ModoPagamento, string>> = {
  asaas: {
    sandbox: 'https://sandbox.asaas.com/api/v3',
    producao: 'https://www.asaas.com/api/v3',
  },
  getnet: {
    sandbox: 'https://api-sandbox.getnet.com.br',
    producao: 'https://api.getnet.com.br',
  },
  cielo: {
    sandbox: 'https://apisandbox.cieloecommerce.cielo.com.br',
    producao: 'https://api.cieloecommerce.cielo.com.br',
  },
};

export const DOCS_PAGAMENTO: Record<ProvedorPagamento, { label: string; url: string }> = {
  asaas: {
    label: 'Como criar o token no Asaas (Developers)',
    url: 'https://www.asaas.com/developers',
  },
  getnet: {
    label: 'Getnet Dev — credenciais, tokens e sandbox',
    url: 'https://dev.getnet.com.br/',
  },
  cielo: {
    label: 'Cielo eCommerce — como obter MerchantId e MerchantKey',
    url: 'https://developercielo.github.io/manual/cielo-ecommerce/',
  },
};

export function urlPadrao(provedor: ProvedorPagamento, modo: ModoPagamento): string {
  return URLS_PAGAMENTO[provedor]?.[modo] || URLS_PAGAMENTO.asaas.sandbox;
}
