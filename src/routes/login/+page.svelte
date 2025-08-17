<script lang="ts">
  import { supabase } from '$lib/supabase';

  let email = '';
  let password = '';

  async function login() {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
  }

  async function signup() {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) alert(error.message);
  }
</script>

<div class="p-4 max-w-sm mx-auto">
  <input bind:value={email} placeholder="Email" class="border p-2 w-full mb-2" />
  <input bind:value={password} type="password" placeholder="Password" class="border p-2 w-full mb-2" />
  <button on:click={login} class="bg-blue-500 text-white px-4 py-2 rounded w-full">Log in</button>
  <button on:click={signup} class="mt-2 bg-green-500 text-white px-4 py-2 rounded w-full">Sign up</button>
</div>