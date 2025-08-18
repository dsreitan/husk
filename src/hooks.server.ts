import type { Handle } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';

// Create a lightweight server-side supabase client per request when needed
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const handle: Handle = async ({ event, resolve }) => {
  try {
    const auth = event.request.headers.get('authorization');
    if (auth?.startsWith('Bearer ')) {
      const token = auth.slice(7);
      const supabase = createClient(supabaseUrl, supabaseAnon);
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user) {
        (event.locals as any).user = { id: data.user.id, email: data.user.email };
      }
    }
  } catch (e) {
    // swallow - auth optional
  }
  return resolve(event);
};
