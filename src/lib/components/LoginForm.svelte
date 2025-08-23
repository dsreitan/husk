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
  <form on:submit|preventDefault={submit} aria-label="Auth form">
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
  {#if error}<p role="alert">{error}</p>{/if}
    <button type="submit" disabled={loading}>{loading ? 'Please wait…' : (mode === 'login' ? 'Log in' : 'Create account')}</button>
    <button type="button" on:click={() => mode = mode === 'login' ? 'signup' : 'login'} disabled={loading}>
      {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Log in'}
    </button>
  </form>
{:else}
  <div>
    <button type="button" on:click={logout}>Log out</button>
  </div>
{/if}

