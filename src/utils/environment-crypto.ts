import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  publicEncrypt,
  privateDecrypt,
  constants,
} from 'node:crypto';

export interface EncryptedEnvironmentPayload {
  encryptedPayload: string;
  encryptedKey: string;
  iv: string;
  tag: string;
}

export function encryptEnvironmentPayload(
  payload: Record<string, string>,
  publicKey: string,
): EncryptedEnvironmentPayload {
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const encryptedKey = publicEncrypt(
    { key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    key,
  );

  return {
    encryptedPayload: encrypted.toString('base64'),
    encryptedKey: encryptedKey.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

export function decryptEnvironmentPayload(
  payload: EncryptedEnvironmentPayload,
  privateKey: string,
): Record<string, string> {
  const key = privateDecrypt(
    { key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(payload.encryptedKey, 'base64'),
  );
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.encryptedPayload, 'base64')),
    decipher.final(),
  ]);
  const parsed: unknown = JSON.parse(plaintext.toString('utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Payload de ambiente inválido');
  }
  return parsed as Record<string, string>;
}
