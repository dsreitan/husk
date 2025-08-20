import { writable } from 'svelte/store';
import { supabase } from '$lib/supabase';
import { browser } from '$app/environment';

// user: null means explicitly logged out; authReady indicates we've completed initial fetch
export const user = writable<any | null>(null);
export const authReady = writable(false);

// We only resolve auth readiness in the browser so SSR never renders the logged-out UI and then swaps (avoids flash)
if (browser) {
  let initialized = false;
  supabase.auth.getSession().then(({ data }) => {
    user.set(data.session?.user ?? null);
    initialized = true;
    authReady.set(true);
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    user.set(session?.user ?? null);
    if (!initialized) {
      initialized = true;
      authReady.set(true);
    }
  });
}
