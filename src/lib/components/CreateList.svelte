<script lang="ts">
  import { supabase } from '$lib/supabase';
  import { user } from '$lib/stores/user';
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';

  let name = '';
  let error = '';
  let loading = false;

  async function createList() {
    error = '';
    const currentUser = get(user);
    if (!currentUser) {
      error = 'You must be logged in.';
      return;
    }
    if (!name.trim()) return;
    loading = true;
    const { data, error: err } = await supabase.from('lists').insert({ name: name.trim(), owner: currentUser.id }).select().single();
    if (err) {
      error = err.message;
    } else if (data) {
      name = '';
      goto(`/lists/${data.id}`);
    }
    loading = false;
  }

  function onSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!loading) createList();
  }
</script>

<form class="create-list" on:submit={onSubmit} aria-label="Create new list">
  <input
    type="text"
    placeholder="New list name"
    bind:value={name}
    aria-disabled={loading}
    aria-label="List name"
  />
  <button type="submit" disabled={loading || !name.trim()}>{loading ? 'Adding…' : 'Add List'}</button>
  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}
</form>

<style>
  .create-list { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: 2rem; width: 100%; }
  input { flex: 1 1 240px; padding: .5rem .6rem; border: 1px solid #bbb; border-radius: 4px; }
  button { padding: .55rem .9rem; border-radius: 4px; border: 1px solid var(--color-theme-1, #ff3e00); background: var(--color-theme-1, #ff3e00); color: #fff; font-weight: 600; cursor: pointer; }
  button[disabled] { opacity: .6; cursor: not-allowed; }
  .error { width: 100%; color: #d00; font-size: .85rem; margin: 0; }
</style>
