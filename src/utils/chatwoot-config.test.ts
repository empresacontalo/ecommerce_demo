import { describe, expect, it } from 'vitest';
import {
  CHATWOOT_BASE_URL,
  CHATWOOT_SETTINGS,
  CHATWOOT_WEBSITE_TOKEN,
} from './chatwoot-config';

describe('Chatwoot configuration', () => {
  it('uses the configured Chatwoot endpoint without hardcoding legacy third-party tokens', () => {
    expect(CHATWOOT_BASE_URL).toBe('https://chat.digitalarea.online');
    expect(CHATWOOT_WEBSITE_TOKEN).not.toBe('imdQDoR7zDeFsatMR3xiseUQ');
  });

  it('matches the provided widget settings', () => {
    expect(CHATWOOT_SETTINGS).toEqual({
      position: 'right',
      type: 'standard',
      hideMessageBubble: true,
      darkMode: 'dark',
      launcherTitle: '',
      locale: 'en',
    });
  });
});
