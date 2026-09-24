import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decryptEnvironmentPayload, encryptEnvironmentPayload } from './environment-crypto';

describe('environment payload encryption', () => {
  it('encrypts and decrypts patches without storing plaintext', () => {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const patch = { SMTP_HOST: 'smtp.example.com', JWT_SECRET: 'secret-value' };
    const encrypted = encryptEnvironmentPayload(patch, publicKey.export({ type: 'pkcs1', format: 'pem' }).toString());

    expect(JSON.stringify(encrypted)).not.toContain('secret-value');
    expect(decryptEnvironmentPayload(encrypted, privateKey.export({ type: 'pkcs1', format: 'pem' }).toString())).toEqual(patch);
  });
});
