import { describe, expect, it } from 'vitest';
import {
  ENVIRONMENT_MANIFEST,
  getEnvironmentDefinition,
  validateEnvironmentPatch,
} from './environment-manifest';

describe('environment manifest', () => {
  it('covers every Portainer stack input without exposing values', () => {
    const names = ENVIRONMENT_MANIFEST.map((item) => item.key);
    expect(names).toEqual(expect.arrayContaining([
      'JWT_SECRET',
      'OPENAI_API_KEY',
      'SMTP_HOST',
      'POSTGRES_PASSWORD',
      'NEXT_PUBLIC_SITE_URL',
      'CRON_SECRET',
    ]));
    expect(ENVIRONMENT_MANIFEST.every((item) => !('value' in item))).toBe(true);
  });

  it('classifies secrets and build-time variables', () => {
    expect(getEnvironmentDefinition('JWT_SECRET')).toMatchObject({
      sensitive: true,
      impact: 'stack_redeploy',
    });
    expect(getEnvironmentDefinition('NEXT_PUBLIC_SITE_URL')).toMatchObject({
      sensitive: false,
      impact: 'image_rebuild',
    });
  });

  it('rejects unknown keys and invalid values', () => {
    expect(validateEnvironmentPatch({ UNKNOWN_KEY: 'x' })).toMatchObject({
      valid: false,
      errors: expect.arrayContaining([expect.stringContaining('UNKNOWN_KEY')]),
    });
    expect(validateEnvironmentPatch({ SMTP_PORT: 'not-a-port' }).valid).toBe(false);
    expect(validateEnvironmentPatch({ JWT_SECRET: 'short' }).valid).toBe(false);
  });

  it('accepts valid runtime values and reports maximum impact', () => {
    const result = validateEnvironmentPatch({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      NEXT_PUBLIC_SITE_URL: 'https://example.com',
      JWT_SECRET: 'a'.repeat(64),
    });
    expect(result).toMatchObject({ valid: true, impact: 'image_rebuild' });
    expect(result.keys).toEqual(expect.arrayContaining(['SMTP_HOST', 'SMTP_PORT', 'NEXT_PUBLIC_SITE_URL', 'JWT_SECRET']));
  });
});
