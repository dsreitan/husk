<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { user } from "$lib/stores/user";
  import { get } from "svelte/store";
  import { goto } from "$app/navigation";

  let name = "";
  let error = "";
  let loading = false;

  async function createList() {
    error = "";
    const currentUser = get(user);
    if (!currentUser) {
  error = "Du må være innlogget.";
      return;
    }
    if (!name.trim()) return;
    loading = true;
    const { data, error: err } = await supabase
      .from("lists")
      .insert({ name: name.trim(), owner: currentUser.id })
      .select()
      .single();
    if (err) {
      error = err.message;
    } else if (data) {
      name = "";
      goto(`/lists/${data.id}`);
    }
    loading = false;
  }

  function onSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!loading) createList();
  }
</script>

<form on:submit={onSubmit} aria-label="Create new list">
  <fieldset role="group">
    <input
      type="text"
  placeholder="Ny liste"
      bind:value={name}
      aria-disabled={loading}
      aria-label="List name"
    />
    <input
      type="submit"
  value={loading ? "Legger til…" : "Legg til liste"}
      disabled={loading || !name.trim()}
    />
    {#if error}
      <p role="alert">{error}</p>
    {/if}
  </fieldset>
</form>
