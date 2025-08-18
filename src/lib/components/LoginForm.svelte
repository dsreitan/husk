<script lang="ts">
  import { supabase } from '$lib/supabase';
  import { user } from '$lib/stores/user';

  let email = '';
  let password = '';
  let loading = false;
  let error = '';
  let mode: 'login' | 'signup' = 'login';

  async function submit() {
    error = '';
    loading = true;
    const creds = { email: email.trim(), password };
    if (!creds.email || !creds.password) {
      error = 'Email and password required';
      loading = false;
      return;
    }
    const { error: authError } = mode === 'login'
      ? await supabase.auth.signInWithPassword(creds)
      : await supabase.auth.signUp(creds);
    if (authError) error = authError.message;
    loading = false;
  }

  async function logout() {
    await supabase.auth.signOut();
  }
</script>

{#if !$user}
  <form class="login-form" on:submit|preventDefault={submit} aria-label="Auth form">
    <h2>{mode === 'login' ? 'Log in' : 'Sign up'}</h2>
    <input
      type="email"
      placeholder="Email"
      bind:value={email}
      autocomplete="email"
      required
    />
    <input
      type="password"
      placeholder="Password"
      bind:value={password}
      autocomplete={mode === 'signup' ? 'new-password' : 'current-password'}
      minlength={6}
      required
    />
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <button type="submit" disabled={loading}>{loading ? 'Please wait…' : (mode === 'login' ? 'Log in' : 'Create account')}</button>
    <button type="button" class="mode" on:click={() => mode = mode === 'login' ? 'signup' : 'login'} disabled={loading}>
      {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Log in'}
    </button>
  </form>
{:else}
  <div class="logged-in-actions">
    <button type="button" on:click={logout}>Log out</button>
  </div>
{/if}

<style>
  .login-form { width: 100%; max-width: 24rem; display: flex; flex-direction: column; gap: .75rem; margin: 2rem auto; padding: 1.5rem; border: 1px solid #ddd; border-radius: 8px; background: rgba(255,255,255,0.65); backdrop-filter: blur(6px); }
  h2 { margin: 0 0 .25rem; font-size: 1.25rem; text-align: center; }
  input { padding: .6rem .75rem; border: 1px solid #bbb; border-radius: 4px; font-size: .95rem; }
  button { padding: .65rem .9rem; border-radius: 4px; border: 1px solid var(--color-theme-1,#ff3e00); background: var(--color-theme-1,#ff3e00); color: #fff; font-weight: 600; cursor: pointer; }
  button[disabled] { opacity: .6; cursor: not-allowed; }
  .mode { background: transparent; color: var(--color-theme-1,#ff3e00); border-color: transparent; text-decoration: underline; }
  .error { margin: 0; color: #d00; font-size: .85rem; }
  .logged-in-actions { display:flex; justify-content:flex-end; margin:1rem 0; }
  .logged-in-actions button { background:#666; border-color:#666; }
</style>
