import { writable } from 'svelte/store';
import { supabase } from '$lib/supabase';

export const user = writable<any | null>(null);

supabase.auth.getSession().then(({ data }) => {
  user.set(data.session?.user ?? null);
});

supabase.auth.onAuthStateChange((_event, session) => {
  user.set(session?.user ?? null);
});
