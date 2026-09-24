import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('Password Utility (TDD)', () => {
  const plainPassword = 'mySecureP@ssw0rd123';
  const wrongPassword = 'wrongPassword';

  describe('hashPassword', () => {
    it('deve gerar um hash diferente da senha original', async () => {
      const hash = await hashPassword(plainPassword);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(plainPassword);
      expect(hash.length).toBeGreaterThan(20);
    });

    it('deve gerar hashes diferentes para a mesma senha (salts diferentes)', async () => {
      const hash1 = await hashPassword(plainPassword);
      const hash2 = await hashPassword(plainPassword);

      expect(hash1).not.toBe(hash2);
    });

    it('deve gerar hash no formato bcrypt ($2a$...)', async () => {
      const hash = await hashPassword(plainPassword);

      expect(hash.startsWith('$2')).toBe(true);
    });
  });

  describe('verifyPassword', () => {
    it('deve retornar true para senha correta', async () => {
      const hash = await hashPassword(plainPassword);
      const result = await verifyPassword(plainPassword, hash);

      expect(result).toBe(true);
    });

    it('deve retornar false para senha incorreta', async () => {
      const hash = await hashPassword(plainPassword);
      const result = await verifyPassword(wrongPassword, hash);

      expect(result).toBe(false);
    });

    it('deve retornar false para hash vazio', async () => {
      const result = await verifyPassword(plainPassword, '');

      expect(result).toBe(false);
    });

    it('deve retornar false para senha vazia', async () => {
      const hash = await hashPassword(plainPassword);
      const result = await verifyPassword('', hash);

      expect(result).toBe(false);
    });
  });
});
