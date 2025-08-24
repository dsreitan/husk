<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { supabase } from '$lib/supabase';

  export let listId: string;
  export let open = false;

  const dispatch = createEventDispatcher<{ close: void; saved: number; error: string }>();

  let topic = '';
  let generating = false;
  let genError = '';
  let suggestions: string[] = [];
  let saving = false;

  function reset() {
    topic = '';
    genError = '';
    suggestions = [];
  }

  function close() {
  if (saving || generating) return;
  open = false; // update parent via bind:open
  dispatch('close');
  reset();
  }

  function onBackdropKeydown(e: KeyboardEvent) {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      close();
    }
  }

  async function generateSuggestions() {
    const q = topic.trim();
    if (!q || generating) return;
    genError = '';
    generating = true;
    suggestions = [];
    try {
      const res = await fetch(
        `/api/generate?prompt=${encodeURIComponent(`Suggest 6 short, actionable todo items related to "${q}". Return ONLY a single comma-separated list without numbering or extra text.`)}`,
      );
      const data = await res.json().catch(() => ({}));
      const text: string = (data?.title ?? data?.text ?? '').toString();
      if (!res.ok || !text) {
        genError = data?.error || 'Ingen forslag returnert';
        return;
      }
      const parsed = text
        .replace(/\n+/g, ',')
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
      suggestions = Array.from(new Set(parsed));
      if (suggestions.length === 0) genError = 'Ingen forslag tolket';
    } catch (e: any) {
      genError = e?.message || 'Klarte ikke å generere forslag';
    } finally {
      generating = false;
    }
  }

  function removeSuggestion(idx: number) {
    suggestions = suggestions.filter((_, i) => i !== idx);
  }

  async function save() {
    if (!suggestions.length || saving) return;
    saving = true;
    try {
      const { data, error } = await supabase
        .from('todos')
        .insert(suggestions.map((task) => ({ list_id: listId, task })))
        .select();
      if (error) throw new Error(error.message);
      dispatch('saved', Array.isArray(data) ? data.length : 0);
      close();
    } catch (e: any) {
      genError = e?.message || 'Noe gikk galt under lagring';
      dispatch('error', genError);
    } finally {
      saving = false;
    }
  }
</script>

{#if open}
  <div role="button" tabindex="0" aria-label="Lukk forslagmodal" on:click={close} on:keydown={onBackdropKeydown}>
    <div role="dialog" aria-modal="true" aria-label="Generer forslag" tabindex="0" on:click|stopPropagation>
      <header>
        <h2>Generer forslag</h2>
        <button title="Lukk" on:click={close} disabled={generating || saving}>✕</button>
      </header>
      <form on:submit|preventDefault={generateSuggestions}>
        <input placeholder="f.eks. tilbehør til fisk" bind:value={topic} aria-label="Forslagstema" />
        <button type="submit" disabled={!topic.trim() || generating}>{generating ? 'Genererer…' : 'Generer'}</button>
      </form>
      {#if genError}
        <p role="alert">{genError}</p>
      {/if}
      {#if suggestions.length}
        <ul>
          {#each suggestions as s, i}
            <li>
              <span>{s}</span>
              <button title="Fjern" on:click={() => removeSuggestion(i)}>✕</button>
            </li>
          {/each}
        </ul>
      {/if}
      <footer>
        <button type="button" on:click={save} disabled={!suggestions.length || saving}>{saving ? 'Lagrer…' : 'Lagre i liste'}</button>
        <button type="button" on:click={close} disabled={saving}>Avbryt</button>
      </footer>
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
    width: min(720px, 92vw);
    box-shadow: 0 10px 30px rgba(0,0,0,.2);
  }
  header { display: flex; justify-content: space-between; align-items: center; }
</style>
