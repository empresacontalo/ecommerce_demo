export const CHATWOOT_BASE_URL =
  process.env.NEXT_PUBLIC_CHATWOOT_BASE_URL || 'https://chat.digitalarea.online';
export const CHATWOOT_WEBSITE_TOKEN =
  process.env.NEXT_PUBLIC_CHATWOOT_WEBSITE_TOKEN || '';

export const CHATWOOT_SETTINGS = {
  position: 'right',
  type: 'standard',
  hideMessageBubble: true,
  darkMode: 'dark',
  launcherTitle: '',
  locale: 'en',
} as const;
