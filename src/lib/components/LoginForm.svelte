<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { user } from "$lib/stores/user";

  let email = "";
  let password = "";
  let loading = false;
  let error = "";
  let mode: "login" | "signup" = "login";

  async function submit() {
    error = "";
    loading = true;
    const creds = { email: email.trim(), password };
    if (!creds.email || !creds.password) {
      error = "E-post og passord er påkrevd";
      loading = false;
      return;
    }
    const { error: authError } =
      mode === "login"
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
  <form on:submit|preventDefault={submit} aria-label="Innlogging">
    <fieldset>
      <label>
        E-post
        <input type="email" bind:value={email} autocomplete="email" required />
      </label>
      <label>
        Passord
        <input
          name="password"
          type="password"
          bind:value={password}
          autocomplete={"current-password"}
          minlength={6}
          required
        />
      </label>
      {#if error}<span role="alert">{error}</span>{/if}
    </fieldset>

    <button type="submit" disabled={loading}
      >{loading ? "Vennligst vent…" : "Logg inn"}</button
    >
  </form>
  <p>Ingen signup. Spør Dagfinn om invite.</p>
{:else}
  <div>
    <button type="button" on:click={logout}>Logg ut</button>
  </div>
{/if}
