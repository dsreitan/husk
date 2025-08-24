import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  const locale = locals.locale ?? 'en';

  return { locale };
};
