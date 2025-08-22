import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  const locale = locals.locale ?? 'en';

  const mod = locale === 'nb'
    ? await import('$lib/i18n/locales/nb')
    : await import('$lib/i18n/locales/en');

  return { locale, messages: mod.messages };
};
