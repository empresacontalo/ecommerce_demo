import { vi, describe, it, expect, beforeEach } from 'vitest';
import { updateProfileMetadata } from './profile';

describe('Profile Metadata Utility (TDD)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('deve retornar erro de validacao se algum campo obrigatorio estiver vazio', async () => {
    // Caso 1: Nome vazio
    vi.stubGlobal('fetch', vi.fn());
    const resName = await updateProfileMetadata('user-1', {
      name: '',
      lastName: 'Silva',
      phone: '(11) 99999-9999',
      cpf: '123.456.789-00',
    });
    expect(resName.success).toBe(false);
    expect(resName.error).toContain('Preencha todos os campos');

    // Caso 2: CPF vazio é permitido (ainda não cadastrado; será validado no backend)
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal('fetch', mockFetch);
    const resCpf = await updateProfileMetadata('user-2', {
      name: 'João',
      lastName: 'Silva',
      phone: '(11) 99999-9999',
      cpf: '',
    });
    expect(resCpf.success).toBe(true);

    // Caso 3: Telefone vazio
    vi.stubGlobal('fetch', vi.fn());
    const resPhone = await updateProfileMetadata('user-3', {
      name: 'João',
      lastName: 'Silva',
      phone: '',
      cpf: '123.456.789-00',
    });
    expect(resPhone.success).toBe(false);
    expect(resPhone.error).toContain('Preencha todos os campos');
  });

  it('deve chamar a API /api/profile com os dados corretos e retornar sucesso', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await updateProfileMetadata('user-4', {
      name: 'João',
      lastName: 'da Silva',
      phone: '(11) 99999-9999',
      cpf: '123.456.789-00',
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'João',
        lastName: 'da Silva',
        phone: '(11) 99999-9999',
        cpf: '123.456.789-00',
      }),
    });
    expect(res.success).toBe(true);
    expect(res.error).toBeUndefined();
  });

  it('deve retornar erro caso a API /api/profile falhe', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Erro ao atualizar perfil.' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await updateProfileMetadata('user-5', {
      name: 'João',
      lastName: 'da Silva',
      phone: '(11) 99999-9999',
      cpf: '123.456.789-00',
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe('Erro ao atualizar perfil.');
  });

  it('deve retornar erro em caso de falha de rede', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const res = await updateProfileMetadata('user-6', {
      name: 'João',
      lastName: 'da Silva',
      phone: '(11) 99999-9999',
      cpf: '123.456.789-00',
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe('Network error');
  });
});
