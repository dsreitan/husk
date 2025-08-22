<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { supabase } from '$lib/supabase';
  import { user } from '$lib/stores/user';
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import { t } from '$lib/i18n';

  let listId = '';
  let listName = '';
  let todos: any[] = [];
  let loading = true;
  let adding = false;
  let newTask = '';
  let error = '';
  let channel: ReturnType<typeof supabase.channel> | null = null;
  // --- suggestions modal state ---
  let showSuggest = false;
  let topic = '';
  let generating = false;
  let genError = '';
  let suggestions: string[] = [];
  let savingSuggestions = false;
  // --- end suggestions modal state ---
  // --- invite state ---
  let ownerId: string | null = null;
  let inviteUserEmail = '';
  let inviting = false;
  let inviteMsg = '';
  // --- end invite state ---
  let realtimeStatus: string = '';

  async function loadList() {
    error = '';
    const { data, error: err } = await supabase.from('lists').select('*').eq('id', listId).single();
    if (err) { error = err.message; return; }
    listName = data.name;
    ownerId = data.owner;
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

  // --- enhanced realtime ---
  function applyChange(payload: any) {
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
  }
  async function setupRealtime() {
    if (!listId) return;
    if (channel) {
      supabase.removeChannel(channel);
      channel = null;
    }
    realtimeStatus = 'subscribing';
    channel = supabase
      .channel(`todos-${listId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos', filter: `list_id=eq.${listId}` }, applyChange);

    // Wait for status
    await new Promise<void>((resolve) => {
      channel!.subscribe((status) => {
        realtimeStatus = status;
        if (status === 'SUBSCRIBED') resolve();
        if (status === 'CHANNEL_ERROR' || status === 'CLOSED') resolve();
      });
    });
  }
  // --- end enhanced realtime ---

  function ensureAuth() { if (!get(user)) goto('/'); }

  const unsubscribeUser = user.subscribe(u => {
    // re-auth channel if token changes (user login/logout)
    if (channel) setupRealtime();
  });

  onMount(() => {
    listId = ($page.params.id || '') as string;
    ensureAuth();
    loadList();
    loadTodos();
    setupRealtime();
    window.addEventListener('focus', refetchOnFocus);
    return () => { if (channel) supabase.removeChannel(channel); unsubscribeUser(); window.removeEventListener('focus', refetchOnFocus); };
  });

  function refetchOnFocus() {
    // Light resync to catch any missed events (e.g., tab was asleep)
    loadTodos();
  }

  async function invite() {
    inviteMsg = '';
    const email = inviteUserEmail.trim().toLowerCase();
    if (!email || inviting) return;
    inviting = true;
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const res = await fetch(`/lists/${listId}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({ email, role: 'viewer' })
      });
      const result = await res.json();
      if (!res.ok) inviteMsg = result.error || 'Invite failed';
      else if (result.message) inviteMsg = result.message;
      else inviteMsg = 'Invited';
      if (res.ok) inviteUserEmail = '';
    } catch (e: any) {
      inviteMsg = e.message || 'Invite failed';
    }
    inviting = false;
  }

  // --- suggestions modal logic ---
  function openSuggest() {
    showSuggest = true;
    topic = '';
    suggestions = [];
    genError = '';
  }
  function closeSuggest() {
    if (savingSuggestions || generating) return; // avoid closing mid-action
    showSuggest = false;
  }
  function onBackdropKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      closeSuggest();
    }
  }
  function onDialogKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      e.preventDefault();
      closeSuggest();
    }
  }
  async function generateSuggestions() {
    const q = topic.trim();
    if (!q || generating) return;
    genError = '';
    generating = true;
    suggestions = [];
    try {
      // Instruct the model to return only a comma-separated list
      const res = await fetch(`/api/generate?prompt=${encodeURIComponent(`Suggest 6 short, actionable todo items related to "${q}". Return ONLY a single comma-separated list without numbering or extra text.`)}`);
      const data = await res.json().catch(() => ({}));
      const text: string = (data?.title ?? data?.text ?? '').toString();
      if (!res.ok || !text) {
        genError = data?.error || t('suggest.error.none');
        return;
      }
      const parsed = text
        .replace(/\n+/g, ',')
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
  suggestions = Array.from(new Set(parsed));
  if (suggestions.length === 0) genError = t('suggest.error.parse');
    } catch (e: any) {
  genError = e?.message || t('suggest.error.failed');
    } finally {
      generating = false;
    }
  }
  function removeSuggestion(idx: number) {
    suggestions = suggestions.filter((_, i) => i !== idx);
  }
  async function saveSuggestions() {
    if (!suggestions.length || savingSuggestions) return;
    savingSuggestions = true; error = '';
    // optimistic insert for each suggestion
    const temps = suggestions.map((task) => ({ id: crypto.randomUUID(), list_id: listId, task, completed: false, inserted_at: new Date().toISOString(), _pending: true }));
    todos = [...temps, ...todos];
    try {
      const { data, error: err } = await supabase.from('todos').insert(
        suggestions.map((task) => ({ list_id: listId, task }))
      ).select();
      if (err) {
        error = err.message;
        // remove temps on error
        const tempIds = new Set(temps.map(t => t.id));
        todos = todos.filter(t => !tempIds.has(t.id));
      } else if (Array.isArray(data)) {
        // replace temps with real rows by task match (best-effort)
        const byTask = new Map<string, any[]>();
        for (const row of data) {
          const arr = byTask.get(row.task) || [];
          arr.push(row);
          byTask.set(row.task, arr);
        }
        todos = todos.map(t => {
          if (!t._pending) return t;
          const arr = byTask.get(t.task);
          if (arr && arr.length) return arr.shift()!;
          return t; // fallback; realtime may update it soon
        });
      }
      showSuggest = false;
    } finally {
      savingSuggestions = false;
    }
  }
  // --- end suggestions modal logic ---
</script>

<svelte:head><title>{listName ? listName + ' – Todos' : 'List'} </title></svelte:head>

<div class="list-page">
  <nav class="crumbs"><a href="/">{t('list.breadcrumb.back')}</a></nav>
  <h1>{listName || '...'}</h1>
  {#if ownerId && get(user)?.id === ownerId}
    <form class="invite" on:submit|preventDefault={invite}>
  <input type="email" placeholder={t('list.invite.placeholder')} bind:value={inviteUserEmail} aria-label="User email to invite" />
  <button type="submit" disabled={!inviteUserEmail.trim() || inviting}>{inviting ? t('list.invite.submitting') : t('list.invite.submit')}</button>
    </form>
    {#if inviteMsg}<p class="invite-msg">{inviteMsg}</p>{/if}
  {/if}
  <form class="add" on:submit|preventDefault={addTodo}>
    <input placeholder={t('todo.new.placeholder')} bind:value={newTask} aria-label="New todo" />
  <button type="submit" disabled={!newTask.trim() || adding}>{adding ? t('todo.adding') : t('todo.add')}</button>
  <button type="button" class="secondary" on:click={openSuggest}>{t('suggest.button')}</button>
  </form>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if loading}
  <p>{t('todo.loading')}</p>
  {:else if todos.length === 0}
  <p>{t('todo.empty')}</p>
  {:else}
    <ul class="todos" aria-live="polite">
      {#each todos as todo (todo.id)}
        <li class:completed={todo.completed}>
          <button type="button" class="todo-btn" on:click={() => toggle(todo)} title={t('todo.toggle.title')}>
            <input type="checkbox" checked={todo.completed} readonly />
            <span>{todo.task}</span>
            {#if todo._pending}<em class="pending">{t('todo.pending')}</em>{/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  {#if showSuggest}
    <div class="modal-backdrop" role="button" tabindex="0" aria-label="Close suggestions modal" on:click|stopPropagation={closeSuggest} on:keydown={onBackdropKeydown}>
      <div class="modal" role="dialog" aria-modal="true" aria-label={t('suggest.modal.title')} tabindex="0" on:click|stopPropagation on:keydown={onDialogKeydown}>
        <header class="modal-header">
          <h2>{t('suggest.modal.title')}</h2>
          <button class="icon" title={t('suggest.modal.close')} on:click={closeSuggest} disabled={generating || savingSuggestions}>✕</button>
        </header>
        <form class="generate" on:submit|preventDefault={generateSuggestions}>
          <input placeholder={t('suggest.topic.placeholder')} bind:value={topic} aria-label="Suggestion topic" />
          <button type="submit" disabled={!topic.trim() || generating}>{generating ? t('suggest.generating') : t('suggest.generate')}</button>
        </form>
        {#if genError}
          <p class="error" role="alert">{genError}</p>
        {/if}
        {#if suggestions.length}
          <ul class="suggestions">
            {#each suggestions as s, i}
              <li>
                <span>{s}</span>
                <button class="icon" title={t('suggest.remove')} on:click={() => removeSuggestion(i)}>✕</button>
              </li>
            {/each}
          </ul>
        {/if}
        <footer class="modal-actions">
          <button type="button" class="primary" on:click={saveSuggestions} disabled={!suggestions.length || savingSuggestions}>{savingSuggestions ? t('suggest.saving') : t('suggest.save')}</button>
          <button type="button" class="secondary" on:click={closeSuggest} disabled={savingSuggestions}>{t('suggest.cancel')}</button>
        </footer>
      </div>
    </div>
  {/if}
</div>

<style>
  .list-page { max-width: 42rem; margin: 0 auto; display: flex; flex-direction: column; gap: 1rem; }
  .crumbs a { text-decoration: none; font-size: .85rem; }
  form.add, form.invite { display: flex; gap: .5rem; }
  form.add input, form.invite input { flex:1; padding:.55rem .7rem; border:1px solid #bbb; border-radius:4px; }
  form.add button, form.invite button { padding:.55rem .9rem; border-radius:4px; border:1px solid var(--color-theme-1,#ff3e00); background: var(--color-theme-1,#ff3e00); color:#fff; font-weight:600; }
  .secondary { background:#fff; color: var(--color-theme-1,#ff3e00); }
  ul.todos { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:.4rem; }
  ul.todos li { display:flex; align-items:center; gap:.6rem; padding:.5rem .6rem; border:1px solid #ddd; border-radius:6px; cursor:pointer; background:#fff; }
  ul.todos li.completed { opacity:.65; text-decoration: line-through; }
  ul.todos li input { pointer-events:none; }
  .error { color:#d00; }
  .pending { font-size:.75rem; color:#888; margin-left:.25rem; }
  .invite-msg { font-size:.75rem; color:#555; margin-top:-.5rem; }

  /* modal */
  .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.35); display:flex; align-items:center; justify-content:center; padding:1rem; z-index: 1000; }
  .modal { background:#fff; width: min(640px, 100%); border-radius: 8px; border:1px solid #ddd; box-shadow: 0 10px 30px rgba(0,0,0,.2); display:flex; flex-direction:column; gap:.75rem; padding:1rem; }
  .modal-header { display:flex; align-items:center; justify-content:space-between; }
  .modal-header h2 { margin:0; font-size:1.1rem; }
  .icon { background:#f5f5f5; color:#333; border:1px solid #ccc; border-radius:6px; padding:.35rem .5rem; }
  form.generate { display:flex; gap:.5rem; }
  form.generate input { flex:1; padding:.5rem .7rem; border:1px solid #bbb; border-radius:4px; }
  ul.suggestions { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:.4rem; max-height: 40vh; overflow:auto; }
  ul.suggestions li { display:flex; align-items:center; justify-content:space-between; gap:.5rem; border:1px solid #eee; border-radius:6px; padding:.5rem .6rem; }
  .modal-actions { display:flex; gap:.5rem; justify-content:flex-end; }
  .primary { background: var(--color-theme-1,#ff3e00); color:#fff; border:1px solid var(--color-theme-1,#ff3e00); }
</style>
