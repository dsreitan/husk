<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { supabase } from '$lib/supabase';

  export let listId: string;
  export let open = false;

  const dispatch = createEventDispatcher<{ close: void; invited: string; error: string }>();

  let email = '';
  let inviting = false;
  let msg = '';

  async function invite() {
    msg = '';
    const e = email.trim().toLowerCase();
    if (!e || inviting) return;
    inviting = true;
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const res = await fetch(`/lists/${listId}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ email: e, role: 'viewer' }),
      });
      const result = await res.json();
      if (!res.ok) msg = result.error || 'Invitasjon mislyktes';
      else if (result.message) msg = result.message;
      else msg = 'Invitert';
      if (res.ok) {
        dispatch('invited', e);
        email = '';
      }
    } catch (err: any) {
      msg = err?.message || 'Invitasjon mislyktes';
      dispatch('error', msg);
    }
    inviting = false;
  }

  function onBackdropClick() {
    if (inviting) return;
    dispatch('close');
  }

  function stop(e: Event) { e.stopPropagation(); }
</script>

{#if open}
  <div role="button" tabindex="0" aria-label="Lukk invitasjonsmodal" on:click={onBackdropClick}>
    <div role="dialog" aria-modal="true" aria-label="Inviter venn" tabindex="0" on:click|stopPropagation={stop}>
      <header>
        <h2>Inviter venn</h2>
        <button title="Lukk" on:click={() => dispatch('close')} disabled={inviting}>✕</button>
      </header>
      <form on:submit|preventDefault={invite}>
        <input type="email" placeholder="E-postadresse til en venn" bind:value={email} autocomplete="email" />
        <button type="submit" disabled={!email.trim() || inviting}>{inviting ? 'Inviterer…' : 'Inviter'}</button>
      </form>
      {#if msg}
        <p role="alert">{msg}</p>
      {/if}
    </div>
  </div>
{/if}

<style>
  div[role="button"] {
    position: fixed;
    inset: 0;
    background: color-mix(in oklab, canvas 50%, black 20%);
    display: grid;
    place-items: center;
    z-index: 1000;
  }
  [role="dialog"] {
    background: var(--pico-card-background-color, white);
    color: var(--pico-color, black);
    border-radius: 0.5rem;
    padding: 1rem;
    width: min(520px, 92vw);
    box-shadow: 0 10px 30px rgba(0,0,0,.2);
  }
  header { display: flex; justify-content: space-between; align-items: center; }
</style>
