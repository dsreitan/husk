import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ request, cookies }) => {
  const cookieLocale = cookies.get('locale');
  const accept = request.headers.get('accept-language') || '';
  const primary = accept.split(',')[0]?.trim().toLowerCase();
  const fromHeader2 = primary?.slice(0, 2);
  const raw = (cookieLocale || fromHeader2 || 'nb').toLowerCase();
  const supported = new Set(['en', 'nb']);
  // Map generic 'no' to 'nb'
  const normalized = raw === 'no' ? 'nb' : raw;
  const locale = supported.has(normalized) ? normalized : 'nb';

  const mod = locale === 'nb'
    ? await import('$lib/i18n/locales/nb')
    : await import('$lib/i18n/locales/en');

  return { locale, messages: mod.messages };
};
