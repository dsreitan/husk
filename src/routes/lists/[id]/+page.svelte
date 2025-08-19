<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { supabase } from '$lib/supabase';
  import { user } from '$lib/stores/user';
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';

  let listId = '';
  let listName = '';
  let todos: any[] = [];
  let loading = true;
  let adding = false;
  let newTask = '';
  let error = '';
  let channel: ReturnType<typeof supabase.channel> | null = null;

  async function loadList() {
    error = '';
    const { data, error: err } = await supabase.from('lists').select('*').eq('id', listId).single();
    if (err) { error = err.message; return; }
    listName = data.name;
  }

  async function loadTodos() {
    error = '';
    loading = true;
    const { data, error: err } = await supabase
      .from('todos')
      .select('*')
      .eq('list_id', listId)
      .order('inserted_at', { ascending: false });
    if (err) error = err.message; else todos = data || [];
    loading = false;
  }

  async function addTodo() {
    const task = newTask.trim();
    if (!task || adding) return;
  adding = true; error = '';
    const tempId = crypto.randomUUID();
    const optimistic = { id: tempId, list_id: listId, task, completed: false, inserted_at: new Date().toISOString(), _pending: true };
    todos = [optimistic, ...todos];
    const { error: err, data } = await supabase.from('todos').insert({ list_id: listId, task }).select().single();
    if (err) {
      error = err.message;
      todos = todos.filter(t => t.id !== tempId);
    } else if (data) {
      todos = todos.map(t => t.id === tempId ? data : t);
      newTask='';
    }
    adding = false;
  }

  async function toggle(todo: any) {
    const updated = { ...todo, completed: !todo.completed };
    todos = todos.map(t => t.id === todo.id ? updated : t);
    const { error: err } = await supabase.from('todos').update({ completed: updated.completed }).eq('id', todo.id);
    if (err) {
      todos = todos.map(t => t.id === todo.id ? todo : t);
      error = err.message;
    }
  }

  function setupRealtime() {
    if (channel) supabase.removeChannel(channel);
    channel = supabase
      .channel(`todos-${listId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos', filter: `list_id=eq.${listId}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new as any;
          if (!todos.find(t => t.id === row.id)) todos = [row, ...todos];
        } else if (payload.eventType === 'UPDATE') {
          const row = payload.new as any;
          todos = todos.map(t => t.id === row.id ? row : t);
        } else if (payload.eventType === 'DELETE') {
          const row = payload.old as any;
          todos = todos.filter(t => t.id !== row.id);
        }
      })
      .subscribe();
  }

  function ensureAuth() {
    if (!get(user)) goto('/');
  }

  onMount(() => {
    listId = ($page.params.id || '') as string;
    ensureAuth();
    loadList();
    loadTodos();
    setupRealtime();
    return () => { if (channel) supabase.removeChannel(channel); };
  });
</script>

<svelte:head><title>{listName ? listName + ' – Todos' : 'List'} </title></svelte:head>

<div class="list-page">
  <nav class="crumbs"><a href="/">← Lists</a></nav>
  <h1>{listName || '...'}</h1>
  <form class="add" on:submit|preventDefault={addTodo}>
    <input placeholder="New todo" bind:value={newTask} aria-label="New todo" />
    <button type="submit" disabled={!newTask.trim() || adding}>{adding ? 'Adding…' : 'Add'}</button>
  </form>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if loading}
    <p>Loading todos…</p>
  {:else if todos.length === 0}
    <p>No todos yet.</p>
  {:else}
    <ul class="todos" aria-live="polite">
      {#each todos as todo (todo.id)}
        <li class:completed={todo.completed}>
          <button type="button" class="todo-btn" on:click={() => toggle(todo)} title="Toggle complete">
            <input type="checkbox" checked={todo.completed} readonly />
            <span>{todo.task}</span>
            {#if todo._pending}<em class="pending">(pending)</em>{/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .list-page { max-width: 42rem; margin: 0 auto; display: flex; flex-direction: column; gap: 1rem; }
  .crumbs a { text-decoration: none; font-size: .85rem; }
  form.add { display: flex; gap: .5rem; }
  form.add input { flex:1; padding:.55rem .7rem; border:1px solid #bbb; border-radius:4px; }
  form.add button { padding:.55rem .9rem; border-radius:4px; border:1px solid var(--color-theme-1,#ff3e00); background: var(--color-theme-1,#ff3e00); color:#fff; font-weight:600; }
  ul.todos { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:.4rem; }
  ul.todos li { display:flex; align-items:center; gap:.6rem; padding:.5rem .6rem; border:1px solid #ddd; border-radius:6px; cursor:pointer; background:#fff; }
  ul.todos li.completed { opacity:.65; text-decoration: line-through; }
  ul.todos li input { pointer-events:none; }
  .error { color:#d00; }
  .pending { font-size:.75rem; color:#888; margin-left:.25rem; }
</style>
