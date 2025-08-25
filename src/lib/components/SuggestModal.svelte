<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { supabase } from "$lib/supabase";
  import Modal from "./Modal.svelte";

  export let listId: string;
  export let open = false;

  const dispatch = createEventDispatcher<{
    close: void;
    saved: number;
    error: string;
  }>();

  let topic = "";
  let generating = false;
  let genError = "";
  let suggestions: string[] = [];
  let saving = false;

  function reset() {
    topic = "";
    genError = "";
    suggestions = [];
  }

  function close() {
    if (saving || generating) return;
    open = false; // update parent via bind:open
    dispatch("close");
    reset();
  }

  function onBackdropKeydown(e: KeyboardEvent) {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      close();
    }
  }

  async function generateSuggestions() {
    const q = topic.trim();
    if (!q || generating) return;
    genError = "";
    generating = true;
    suggestions = [];
    try {
      const res = await fetch(
        `/api/generate?prompt=${encodeURIComponent(`Suggest 6 short, actionable todo items related to "${q}". Return ONLY a single comma-separated list without numbering or extra text.`)}`,
      );
      const data = await res.json().catch(() => ({}));
      const text: string = (data?.title ?? data?.text ?? "").toString();
      if (!res.ok || !text) {
        genError = data?.error || "Ingen forslag returnert";
        return;
      }
      const parsed = text
        .replace(/\n+/g, ",")
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
      suggestions = Array.from(new Set(parsed));
      if (suggestions.length === 0) genError = "Ingen forslag tolket";
    } catch (e: any) {
      genError = e?.message || "Klarte ikke å generere forslag";
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
        .from("todos")
        .insert(suggestions.map((task) => ({ list_id: listId, task })))
        .select();
      if (error) throw new Error(error.message);
      dispatch("saved", Array.isArray(data) ? data.length : 0);
      close();
    } catch (e: any) {
      genError = e?.message || "Noe gikk galt under lagring";
      dispatch("error", genError);
    } finally {
      saving = false;
    }
  }
</script>

<Modal bind:open title="Generer forslag" on:close={() => (open = false)}>
  <form on:submit|preventDefault={generateSuggestions}>
    <fieldset role="group">
      <input
        placeholder="f.eks. tilbehør til fisk"
        bind:value={topic}
        aria-label="Forslagstema"
      />
      <button type="submit" disabled={!topic.trim() || generating}
        >{generating ? "Genererer…" : "Generer"}</button
      >
    </fieldset>
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
  <div slot="footer">
    <button class="secondary" on:click={close} disabled={saving || generating}>
      Avbryt
    </button>
    <button
      type="button"
      on:click={save}
      disabled={!suggestions.length || saving}
      >{saving ? "Lagrer…" : "Lagre i liste"}</button
    >
  </div>
</Modal>
