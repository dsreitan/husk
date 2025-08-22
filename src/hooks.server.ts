import type { Handle } from '@sveltejs/kit';

const supported = new Set(['en', 'nb']);

function detect(request: Request, cookieLocale?: string | null): 'en' | 'nb' {
    return 'nb'; //TODO: add lang button to switch
  const accept = request.headers.get('accept-language') || '';
  const primary = accept.split(',')[0]?.trim().toLowerCase();
  const fromHeader2 = primary?.slice(0, 2);
  const raw = (cookieLocale || fromHeader2 || 'en').toLowerCase();
  const normalized = raw === 'no' ? 'nb' : raw;
  const locale = supported.has(normalized) ? (normalized as 'en' | 'nb') : 'nb';
  
  return locale;
}

export const handle: Handle = async ({ event, resolve }) => {
  const cookieLocale = event.cookies.get('locale');
  const locale = detect(event.request, cookieLocale);
  event.locals.locale = locale;
  // proceed normally
  return resolve(event);
};
