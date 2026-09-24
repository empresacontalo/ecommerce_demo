import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { POST } from './route';

// Mocks com vi.hoisted para evitar problemas de hoisting
const { mockQuery, mockGetUser, mockCriarCobranca, mockSalvarIds, mockGetConfigPagamento } = vi.hoisted(() => {
  return {
    mockQuery: vi.fn().mockResolvedValue({ rows: [] }),
    mockGetUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    mockCriarCobranca: vi.fn().mockResolvedValue({ paymentId: 'pay_123', invoiceUrl: 'https://fatura.test', pixQrCodePayload: '000201...', pixQrCodeUrl: 'base64img' }),
    mockSalvarIds: vi.fn().mockResolvedValue(undefined),
    mockGetConfigPagamento: vi.fn().mockResolvedValue({ provedor: 'asaas', modo: 'sandbox', apiUrl: 'https://sandbox.asaas.com/api/v3', apiKey: 'asaas-key-test', webhookToken: '' }),
  };
});

vi.mock('@/utils/db', () => ({
  query: mockQuery,
}));

vi.mock('@/utils/rate-limit', () => ({ rateLimit: async () => ({ ok: true }), _resetRateLimitStore: () => {}, LIMITES_PADRAO: {}, listarLimites: async () => ({}) }));

vi.mock('@/utils/auth/server', () => ({
  createClient: vi.fn(() => Promise.resolve({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

vi.mock('@/utils/pagamentos', () => ({
  getConfigPagamento: mockGetConfigPagamento,
  criarCobranca: mockCriarCobranca,
  salvarIdsPagamento: mockSalvarIds,
}));

describe('Checkout API Route (TDD)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.ASAAS_API_KEY = 'asaas-key-test';

    // Resetar mocks e prover comportamento de estoque padrão de sucesso
    mockQuery.mockReset();
    mockQuery.mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.includes('FROM public.produtos') && sql.includes('WHERE id = $1')) {
        return { rows: [{ id: '1', name: 'Produto Mock', price: 500, slug: 'produto-mock', origin: 'Lattafa', images: null, stock: 10, descontos: null }] };
      }
      if (sql.includes('FROM public.configuracoes') && sql.includes('chave = $1') && params?.[0] === 'descontos.pagamento') {
        return { rows: [{ valor: { pix: 5, credit: 0, boleto: 0 } }] };
      }
      if (sql.includes('FROM public.configuracoes') && sql.includes('chave = $1') && params?.[0] === 'frete.motoboy') {
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO public.orders')) {
        return { rows: [{ id: 'order_test_123' }] };
      }
      return { rows: [] };
    });
    mockGetUser.mockReset().mockResolvedValue({ data: { user: null } });
    mockCriarCobranca.mockReset().mockResolvedValue({ paymentId: 'pay_123', invoiceUrl: 'https://fatura.test', pixQrCodePayload: '000201...', pixQrCodeUrl: 'base64img' });
    mockGetConfigPagamento.mockReset().mockResolvedValue({ provedor: 'asaas', modo: 'sandbox', apiUrl: 'https://sandbox.asaas.com/api/v3', apiKey: 'asaas-key-test', webhookToken: '' });
    mockSalvarIds.mockReset().mockResolvedValue(undefined);
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it('deve retornar 500 se o token de pagamento estiver ausente', async () => {
    mockGetConfigPagamento.mockResolvedValue({ provedor: 'asaas', modo: 'sandbox', apiUrl: 'https://sandbox.asaas.com/api/v3', apiKey: '', webhookToken: '' });

    const req = new Request('http://localhost/api/checkout', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Cliente Teste',
        email: 'cliente@teste.com',
        cpf: '123.456.789-00',
        phone: '(11) 99999-9999',
        items: [{ id: '1', name: 'Cabelo Vietnamita', price: 1000, quantity: 1 }],
        totalPrice: 1025.90,
        paymentMethod: 'pix',
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain('Token de pagamento não configurada');
  });

  it('deve retornar 400 se a criação da cobrança no provedor falhar', async () => {
    mockCriarCobranca.mockRejectedValue(new Error('CPF inválido'));

    const req = new Request('http://localhost/api/checkout', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Cliente Teste',
        email: 'cliente@teste.com',
        cpf: '123.456.789-00',
        phone: '(11) 99999-9999',
        items: [{ id: '1', name: 'Cabelo Vietnamita', price: 1000, quantity: 1 }],
        totalPrice: 1025.90,
        paymentMethod: 'pix',
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('CPF inválido');
  });

  it('deve processar o checkout PIX com sucesso e persistir pedido', async () => {
    const req = new Request('http://localhost/api/checkout', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Bruno Cliente',
        email: 'bruno@cliente.com',
        cpf: '123.456.789-00',
        phone: '(11) 99999-9999',
        items: [
          { id: '1', name: 'Cabelo Brasileiro', price: 500, quantity: 2 },
        ],
        paymentMethod: 'pix',
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.payment.id).toBe('pay_123');
    expect(data.payment.pixQrCodePayload).toBe('000201...');
    expect(data.payment.pixQrCodeUrl).toBe('base64img');
    expect(data.payment.provedor).toBe('asaas');

    // Verifica se chamou a criação de cobrança com os dados corretos
    expect(mockCriarCobranca).toHaveBeenCalledTimes(1);
    const args = mockCriarCobranca.mock.calls[0][0];
    expect(args.metodo).toBe('pix');
    // PIX com 5%: 1000 - 50 = 950 + 25.90 frete = 975.90
    expect(args.valor).toBe(975.9);
    expect(args.cliente.name).toBe('Bruno Cliente');

    // Verifica se persistiu os IDs do pagamento
    expect(mockSalvarIds).toHaveBeenCalledWith(
      'order_test_123',
      'pay_123',
      'https://fatura.test',
      '000201...',
      undefined,
      undefined
    );

    // Verifica se persistiu o pedido via query (produto + config descontos + INSERT + kanban)
    expect(mockQuery).toHaveBeenCalledTimes(5);
    const queryCall = mockQuery.mock.calls[2]; // INSERT INTO orders
    expect(queryCall[0]).toContain('INSERT INTO public.orders');
    
    const params = queryCall[1];
    expect(params).toEqual(expect.arrayContaining([
      null, // user_id is null for guest
      'Bruno Cliente',
      'bruno@cliente.com',
      '123.456.789-00',
      '(11) 99999-9999',
      1000, // subtotal
      50, // discount (5% PIX)
      25.90, // shipping
      975.9, // total
      'pix',
      'RECEBIDO',
    ]));
    
    // O UPDATE dos IDs do pagamento agora é via salvarIdsPagamento (mockado)
    expect(mockSalvarIds).toHaveBeenCalledTimes(1);
  });

  it('deve associar o user_id se o usuário estiver autenticado', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'usr_abc123' } } });

    const mockFetch = vi.fn().mockImplementation(async (url) => {
      if (url.includes('/customers')) {
        return {
          ok: true,
          json: async () => ({ id: 'cus_12345' }),
        };
      }
      if (url.includes('/payments') && url.includes('/pixQrCode')) {
        return {
          ok: true,
          json: async () => ({ payload: 'pix-qr-payload-test', encodedImage: 'pix-image-base64' }),
        };
      }
      if (url.includes('/payments')) {
        return {
          ok: true,
          json: async () => ({ id: 'pay_12345', invoiceUrl: 'http://asaas.com/invoice' }),
        };
      }
      return { ok: false };
    });
    vi.stubGlobal('fetch', mockFetch);

    const req = new Request('http://localhost/api/checkout', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Bruno Cliente',
        email: 'bruno@cliente.com',
        cpf: '123.456.789-00',
        phone: '(11) 99999-9999',
        items: [
          { id: '1', name: 'Cabelo Brasileiro', price: 500, quantity: 2 },
        ],
        paymentMethod: 'pix',
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    expect(mockQuery).toHaveBeenCalledTimes(5); // produto + config descontos + INSERT + kanban (SELECT + INSERT leads)
    const queryCall = mockQuery.mock.calls[2];
    const params = queryCall[1];
    expect(params[0]).toBe('usr_abc123'); // user_id should be associated
  });

  it('deve processar o checkout de Cartão de Crédito sem buscar QR Code Pix', async () => {
    mockCriarCobranca.mockResolvedValue({ paymentId: 'pay_99999', invoiceUrl: 'http://asaas.com/credit-invoice' });

    const req = new Request('http://localhost/api/checkout', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Camila Cartão',
        email: 'camila@cartao.com',
        cpf: '987.654.321-00',
        phone: '(21) 98888-8888',
        items: [
          { id: '2', name: 'Cabelo Vietnamita', price: 1200, quantity: 1 },
        ],
        paymentMethod: 'credit',
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.payment.id).toBe('pay_99999');
    expect(data.payment.pixQrCodePayload).toBeUndefined(); // Cartão não tem QR Code

    // Verifica se persistiu o pedido (produto + config descontos + INSERT + kanban)
    expect(mockQuery).toHaveBeenCalledTimes(5);
    const queryCall = mockQuery.mock.calls[2];
    const params = queryCall[1];
    expect(params).toEqual(expect.arrayContaining([
      'Camila Cartão',
      'camila@cartao.com',
      'credit',
      'RECEBIDO',
    ]));
  });

  it('deve processar o checkout de Retirada na Loja com frete zero', async () => {
    const req = new Request('http://localhost/api/checkout', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Retirante Silva',
        email: 'retirante@teste.com',
        cpf: '111.111.111-11',
        phone: '(11) 98888-8888',
        items: [
          { id: '1', name: 'Cabelo Brasileiro', price: 500, quantity: 2 },
        ],
        paymentMethod: 'pix',
        shippingMethod: 'retirada',
        shippingAddress: null
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);

    expect(mockQuery).toHaveBeenCalledTimes(5); // produto + config descontos + INSERT + kanban (SELECT + INSERT leads)
    const queryCall = mockQuery.mock.calls[2];
    const params = queryCall[1];
    expect(params[6]).toBe(1000); // subtotal
    expect(params[7]).toBe(50); // discount (5% PIX)
    expect(params[8]).toBe(0); // shipping
    expect(params[9]).toBe(950); // total
    expect(params[12]).toBe('retirada'); // shippingMethod
    expect(params[13]).toBeNull(); // shippingAddress
  });

  it('deve processar o checkout de Motoboy para Praia Grande (SP) com frete de R$ 15', async () => {
    const mockAddress = { zip_code: '11701-900', street: 'Av Pres Costa e Silva', number: '501', city: 'Praia Grande', state: 'SP' };

    const req = new Request('http://localhost/api/checkout', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Motoboy Cliente',
        email: 'moto@teste.com',
        cpf: '222.222.222-22',
        phone: '(13) 99999-9999',
        items: [
          { id: '1', name: 'Cabelo Brasileiro', price: 500, quantity: 2 },
        ],
        paymentMethod: 'pix',
        shippingMethod: 'motoboy',
        shippingAddress: mockAddress
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);

    expect(mockQuery).toHaveBeenCalledTimes(6); // produto + descontos + frete + INSERT + kanban (SELECT + INSERT leads)
    const queryCall = mockQuery.mock.calls[3];
    const params = queryCall[1];
    expect(params[6]).toBe(1000); // subtotal
    expect(params[7]).toBe(50); // discount (5% PIX)
    expect(params[8]).toBe(15); // shipping motoboy Praia Grande
    expect(params[9]).toBe(965); // total (1000-50+15)
    expect(params[12]).toBe('motoboy'); // shippingMethod
    expect(params[13]).toBe(JSON.stringify(mockAddress)); // shippingAddress
  });

  it('deve retornar 400 se o produto não tiver estoque suficiente', async () => {
    // Mock da consulta do produto devolvendo estoque insuficiente
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM public.produtos') && sql.includes('WHERE id = $1')) {
        return { rows: [{ id: '1', name: 'Cabelo Vietnamita', price: 1000, slug: 'cabelo-vietnamita', origin: 'Lattafa', images: null, stock: 0 }] };
      }
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/checkout', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Cliente Teste',
        email: 'cliente@teste.com',
        cpf: '123.456.789-00',
        phone: '(11) 99999-9999',
        items: [{ id: '1', name: 'Cabelo Vietnamita', price: 1000, quantity: 5 }],
        paymentMethod: 'pix',
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Estoque insuficiente para o produto "Cabelo Vietnamita"');
  });

  it('não mexe no estoque quando a chamada ao Asaas falha (estoque só debita após pagamento)', async () => {
    // A nova regra: checkout NÃO debita/reverte estoque; só o webhook de pagamento recebido debita.
    let updateEstoque = false;
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM public.produtos') && sql.includes('WHERE id = $1')) {
        return { rows: [{ id: '1', name: 'Cabelo Brasileiro', price: 500, slug: 'cabelo', origin: 'Lattafa', images: null, stock: 10 }] };
      }
      if (sql.includes('UPDATE public.produtos') && sql.includes('SET stock')) {
        updateEstoque = true;
      }
      if (sql.includes('INSERT INTO public.orders')) {
        return { rows: [{ id: 'order_test_123' }] };
      }
      return { rows: [] };
    });

    // Simula falha na criação da cobrança
    mockCriarCobranca.mockRejectedValue(new Error('Asaas offline'));

    const req = new Request('http://localhost/api/checkout', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Cliente Teste',
        email: 'cliente@teste.com',
        cpf: '123.456.789-00',
        phone: '(11) 99999-9999',
        items: [{ id: '1', name: 'Cabelo Brasileiro', price: 500, quantity: 1 }],
        paymentMethod: 'pix',
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Asaas offline');
    // Nenhuma alteração de estoque deve ter ocorrido
    expect(updateEstoque).toBe(false);
  });

  it('aplica desconto de cupom válido de campanha ativa', async () => {
    mockQuery.mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.includes('FROM public.produtos') && sql.includes('WHERE id = $1')) {
        return { rows: [{ id: '1', name: 'Cabelo Brasileiro', price: 500, slug: 'cabelo', origin: 'Lattafa', images: null, stock: 10, descontos: null }] };
      }
      if (sql.includes('FROM public.configuracoes') && sql.includes('chave = $1') && params?.[0] === 'descontos.pagamento') {
        return { rows: [{ valor: { pix: 5, credit: 0, boleto: 0 } }] };
      }
      if (sql.includes('FROM public.campanhas')) {
        // Cupom FRAN15 de campanha ativa, 15% todos os produtos
        return { rows: [{ cupom_codigo: 'FRAN15', desconto: '15%', cupom_escopo: 'todos', cupom_marca: null, cupom_produtos: null }] };
      }
      if (sql.includes('INSERT INTO public.orders')) {
        return { rows: [{ id: 'order_cupom_123' }] };
      }
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/checkout', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Cliente Cupom',
        email: 'cupom@teste.com',
        cpf: '123.456.789-00',
        phone: '(11) 99999-9999',
        items: [
          { id: '1', name: 'Cabelo Brasileiro', price: 500, quantity: 2 },
        ],
        coupon: 'fran15',
        paymentMethod: 'pix',
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    // subtotal 1000; cupom 15% (150) + PIX 5% (50) = 200 → 800 + 25.90 = 825.90
    expect(mockCriarCobranca).toHaveBeenCalledTimes(1);
    expect(mockCriarCobranca.mock.calls[0][0].valor).toBe(825.9);

    // Cupom registrado no pedido + desconto total gravado (cupom + forma)
    const insertCall = mockQuery.mock.calls.find((c) => String(c[0]).includes('INSERT INTO public.orders'));
    expect(insertCall).toBeTruthy();
    const params = insertCall![1] as any[];
    expect(params).toContain('FRAN15');
    expect(params).toContain(200); // discount total: 150 (cupom) + 50 (PIX)
  });

  it('ignora cupom inválido/inexistente (desconto zero, pedido segue)', async () => {
    mockQuery.mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.includes('FROM public.produtos') && sql.includes('WHERE id = $1')) {
        return { rows: [{ id: '1', name: 'Cabelo Brasileiro', price: 500, slug: 'cabelo', origin: 'Lattafa', images: null, stock: 10, descontos: null }] };
      }
      if (sql.includes('FROM public.configuracoes') && sql.includes('chave = $1') && params?.[0] === 'descontos.pagamento') {
        return { rows: [{ valor: { pix: 5, credit: 0, boleto: 0 } }] };
      }
      if (sql.includes('FROM public.campanhas')) {
        return { rows: [] }; // nenhuma campanha ativa com o cupom
      }
      if (sql.includes('INSERT INTO public.orders')) {
        return { rows: [{ id: 'order_no_coupon' }] };
      }
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/checkout', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Cliente Teste',
        email: 'cliente@teste.com',
        cpf: '123.456.789-00',
        phone: '(11) 99999-9999',
        items: [{ id: '1', name: 'Cabelo Brasileiro', price: 500, quantity: 1 }],
        coupon: 'CUPOM_INEXISTENTE',
        paymentMethod: 'pix',
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);
    // 500 - 25 (5% PIX) + 25.90 = 500.90; cupom não vai para o pedido
    expect(mockCriarCobranca.mock.calls[0][0].valor).toBe(500.9);
    const insertCall = mockQuery.mock.calls.find((c) => String(c[0]).includes('INSERT INTO public.orders'));
    expect(insertCall![1]).not.toContain('CUPOM_INEXISTENTE');
  });

  it('cobra R$ 15 de motoboy para Praia Grande (SP)', async () => {
    const response = await POST(reqComFrete('Praia Grande', 'SP', 'motoboy'));
    expect(response.status).toBe(200);
    expect(mockCriarCobranca.mock.calls[0][0].valor).toBe(490); // 500 - 25 (5% PIX) + 15
  });

  it('cobra R$ 25 de motoboy para São Vicente (SP)', async () => {
    const response = await POST(reqComFrete('São Vicente', 'SP', 'motoboy'));
    expect(response.status).toBe(200);
    expect(mockCriarCobranca.mock.calls[0][0].valor).toBe(500); // 475 + 25
  });

  it('cobra R$ 35 de motoboy para Santos (SP)', async () => {
    const response = await POST(reqComFrete('Santos', 'SP', 'motoboy'));
    expect(response.status).toBe(200);
    expect(mockCriarCobranca.mock.calls[0][0].valor).toBe(510); // 475 + 35
  });

  it('recusa motoboy para município fora da área de cobertura', async () => {
    const response = await POST(reqComFrete('Guarujá', 'SP', 'motoboy'));
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('motoboy não disponível');
  });

  it('recusa motoboy fora do estado de São Paulo', async () => {
    const response = await POST(reqComFrete('Praia Grande', 'RJ', 'motoboy'));
    expect(response.status).toBe(400);
  });

  it('cobra PAC padrão 25.90 quando motoboy não disponível e método é pac', async () => {
    const response = await POST(reqComFrete('Curitiba', 'PR', 'pac'));
    expect(response.status).toBe(200);
    expect(mockCriarCobranca.mock.calls[0][0].valor).toBe(500.9); // 500 - 25 (5% PIX) + 25.90
  });

  it('não aplica desconto se derrubar o total abaixo do mínimo do Asaas (R$5)', async () => {
    // Produto R$5 com PIX 5% daria R$4,75 → deve cobrar R$5,00 SEM desconto.
    mockQuery.mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.includes('FROM public.produtos') && sql.includes('WHERE id = $1')) {
        return { rows: [{ id: 'barato', name: 'Barato', price: 5, slug: 'barato', origin: 'Lattafa', images: null, stock: 10, descontos: null }] };
      }
      if (sql.includes('FROM public.configuracoes') && sql.includes('chave = $1') && params?.[0] === 'descontos.pagamento') {
        return { rows: [{ valor: { pix: 5, credit: 0, boleto: 0 } }] };
      }
      if (sql.includes('INSERT INTO public.orders')) {
        return { rows: [{ id: 'order_minimo' }] };
      }
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/checkout', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Cliente Minimo',
        email: 'minimo@teste.com',
        cpf: '123.456.789-00',
        phone: '(11) 99999-9999',
        items: [{ id: 'barato', name: 'Barato', price: 5, quantity: 1 }],
        paymentMethod: 'pix',
        shippingMethod: 'retirada',
        shippingAddress: null,
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);
    // subtotal 5,00; PIX 5% (0,25) daria 4,75 → desconto zerado → cobra 5,00
    expect(mockCriarCobranca.mock.calls[0][0].valor).toBe(5);
    const insertCall = mockQuery.mock.calls.find((c) => String(c[0]).includes('INSERT INTO public.orders'));
    expect(insertCall![1]).toContain(0); // discount gravado = 0
  });

  it('recusa produto com preço abaixo do mínimo do Asaas (R$5)', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM public.produtos') && sql.includes('WHERE id = $1')) {
        return { rows: [{ id: 'barato', name: 'Produto de 3 reais', price: 3, slug: 'barato', origin: 'Lattafa', images: null, stock: 10, descontos: null }] };
      }
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/checkout', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Cliente Teste',
        email: 'cliente@teste.com',
        cpf: '123.456.789-00',
        phone: '(11) 99999-9999',
        items: [{ id: 'barato', name: 'Produto de 3 reais', price: 3, quantity: 1 }],
        paymentMethod: 'pix',
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('mínimo aceito');
  });

  it('motoboy usa a tabela configurada no CMS (frete.motoboy)', async () => {
    // Config do banco: Guarujá R$40 (sai da tabela padrão, que não tem Guarujá)
    mockQuery.mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.includes('FROM public.produtos') && sql.includes('WHERE id = $1')) {
        return { rows: [{ id: '1', name: 'Cabelo Brasileiro', price: 500, slug: 'cabelo', origin: 'Lattafa', images: null, stock: 10, descontos: null }] };
      }
      if (sql.includes('FROM public.configuracoes') && sql.includes('chave = $1') && params?.[0] === 'descontos.pagamento') {
        return { rows: [{ valor: { pix: 5, credit: 0, boleto: 0 } }] };
      }
      if (sql.includes('FROM public.configuracoes') && sql.includes('chave = $1') && params?.[0] === 'frete.motoboy') {
        return { rows: [{ valor: [{ cidade: 'Guarujá', valor: 40 }] }] };
      }
      if (sql.includes('INSERT INTO public.orders')) {
        return { rows: [{ id: 'order_frete_cfg' }] };
      }
      return { rows: [] };
    });

    const response = await POST(reqComFrete('Guarujá', 'SP', 'motoboy'));
    expect(response.status).toBe(200);
    expect(mockCriarCobranca.mock.calls[0][0].valor).toBe(515); // 500 - 25 (5% PIX) + 40
  });

  it('introduz o cliente no kanban (fase Interessado) ao iniciar o checkout', async () => {
    mockQuery.mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.includes('FROM public.produtos') && sql.includes('WHERE id = $1')) {
        return { rows: [{ id: '1', name: 'Cabelo Brasileiro', price: 500, slug: 'cabelo', origin: 'Lattafa', images: null, stock: 10, descontos: null }] };
      }
      if (sql.includes('FROM public.configuracoes') && sql.includes('chave = $1') && params?.[0] === 'descontos.pagamento') {
        return { rows: [{ valor: { pix: 5, credit: 0, boleto: 0 } }] };
      }
      if (sql.includes('INSERT INTO public.orders')) {
        return { rows: [{ id: 'order_kanban' }] };
      }
      if (sql.includes('INSERT INTO public.leads')) {
        return { rows: [{ id: 'lead-kanban-novo' }] };
      }
      return { rows: [] };
    });

    const response = await POST(reqComFrete('Praia Grande', 'SP', 'retirada'));
    expect(response.status).toBe(200);

    const insLead = mockQuery.mock.calls.find((c) => String(c[0]).includes('INSERT INTO public.leads'));
    expect(insLead).toBeTruthy();
    expect(String(insLead![0])).toContain("'Loja', 'Interessado', 80");
    expect(insLead![1][0]).toBe('Cliente Frete');
    // pedido criado fica ligado ao lead do kanban
    const link = mockQuery.mock.calls.find((c) => String(c[0]).includes('UPDATE public.orders SET lead_id'));
    expect(link).toBeTruthy();
    expect(link![1]).toEqual(['lead-kanban-novo', 'order_kanban']);
  });
});

function reqComFrete(city: string, state: string, shippingMethod: string) {
  return new Request('http://localhost/api/checkout', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Cliente Frete',
      email: 'frete@teste.com',
      cpf: '123.456.789-00',
      phone: '(11) 99999-9999',
      items: [{ id: '1', name: 'Cabelo Brasileiro', price: 500, quantity: 1 }],
      paymentMethod: 'pix',
      shippingMethod,
      shippingAddress: {
        zip_code: '11700000',
        street: 'Rua Teste',
        number: '10',
        city,
        state,
      },
    }),
  });
}
