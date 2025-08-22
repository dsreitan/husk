import { writable, get } from 'svelte/store';

export type Messages = Record<string, string>;

export const locale = writable<string>('en');
export const messages = writable<Messages>({});

function format(template: string, params?: Record<string, unknown>): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (_, k) => {
    const v = (params as Record<string, unknown>)[k];
    return v == null ? '' : String(v);
  });
}

export function t(key: string, params?: Record<string, unknown>): string {
  const dict = get(messages);
  const msg = dict[key] ?? key;
  return format(msg, params);
}

export function tn(baseKey: string, count: number, params?: Record<string, unknown>): string {
  const dict = get(messages);
  const key = count === 1 ? `${baseKey}.one` : `${baseKey}.other`;
  const msg = dict[key] ?? (count === 1 ? '{count} item' : '{count} items');
  return format(msg, { count, ...(params || {}) });
}

export async function loadLocale(newLocale: string, preload?: Messages) {
  locale.set(newLocale);
  if (preload && Object.keys(preload).length) {
    messages.set(preload);
    return;
  }
  try {
    const mod = await import(`./locales/${newLocale}`);
    messages.set((mod as { messages: Messages }).messages);
  } catch {
    const mod = await import('./locales/en');
    messages.set((mod as { messages: Messages }).messages);
    locale.set('en');
  }
}
