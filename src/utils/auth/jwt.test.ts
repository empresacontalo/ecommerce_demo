import { vi, describe, it, expect, beforeEach } from 'vitest';
import { signToken, verifyToken } from './jwt';

// Mock next/headers for getSession
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn((name: string) => {
      if (name === 'portal-auth-token') return null;
      return undefined;
    }),
  })),
}));

describe('JWT Utility (TDD)', () => {
  const mockPayload = {
    sub: 'user-123',
    email: 'test@example.com',
    role: 'user',
  };

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-for-hs256';
    process.env.JWT_EXPIRY = '3600';
  });

  describe('signToken', () => {
    it('deve gerar um token JWT válido', async () => {
      const token = await signToken(mockPayload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT tem 3 partes
    });

    it('deve gerar tokens diferentes para payloads diferentes', async () => {
      const token1 = await signToken(mockPayload);
      const token2 = await signToken({ ...mockPayload, sub: 'user-456' });

      expect(token1).not.toBe(token2);
    });
  });

  describe('verifyToken', () => {
    it('deve verificar um token válido e retornar o payload', async () => {
      const token = await signToken(mockPayload);
      const payload = await verifyToken(token);

      expect(payload).not.toBeNull();
      expect(payload!.sub).toBe('user-123');
      expect(payload!.email).toBe('test@example.com');
      expect(payload!.role).toBe('user');
    });

    it('deve retornar null para token inválido', async () => {
      const result = await verifyToken('invalid-token');
      expect(result).toBeNull();
    });

    it('deve retornar null para token vazio', async () => {
      const result = await verifyToken('');
      expect(result).toBeNull();
    });

    it('deve retornar null para token malformado', async () => {
      const result = await verifyToken('abc.def');
      expect(result).toBeNull();
    });
  });
});
