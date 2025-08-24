<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { supabase } from "$lib/supabase";
  import { user } from "$lib/stores/user";
  import { get } from "svelte/store";
  import { goto } from "$app/navigation";
  import ArrowLeft from "phosphor-svelte/lib/ArrowLeft";
  import UserPlus from "phosphor-svelte/lib/UserPlus";
  import Sparkle from "phosphor-svelte/lib/Sparkle";

  let listId = "";
  let listName = "";
  let todos: any[] = [];
  let loading = true;
  let adding = false;
  let newTask = "";
  let error = "";
  let channel: ReturnType<typeof supabase.channel> | null = null;
  // grouping state
  let showCompleted = true;
  // --- suggestions modal state ---
  let showSuggest = false;
  let topic = "";
  let generating = false;
  let genError = "";
  let suggestions: string[] = [];
  let savingSuggestions = false;
  // --- end suggestions modal state ---
  // --- invite state ---
  let ownerId: string | null = null;
  let inviteUserEmail = "";
  let inviting = false;
  let inviteMsg = "";
  // --- end invite state ---
  let realtimeStatus: string = "";

  async function loadList() {
    error = "";
    const { data, error: err } = await supabase
      .from("lists")
      .select("*")
      .eq("id", listId)
      .single();
    if (err) {
      error = err.message;
      return;
    }
    listName = data.name;
    ownerId = data.owner;
  }

  async function loadTodos() {
    error = "";
    loading = true;
    const { data, error: err } = await supabase
      .from("todos")
      .select("*")
      .eq("list_id", listId)
      .order("inserted_at", { ascending: false });
    if (err) error = err.message;
    else todos = data || [];
    loading = false;
  }

  async function addTodo() {
    const task = newTask.trim();
    if (!task || adding) return;
    adding = true;
    error = "";
    const tempId = crypto.randomUUID();
    const optimistic = {
      id: tempId,
      list_id: listId,
      task,
      completed: false,
      inserted_at: new Date().toISOString(),
      _pending: true,
    };
    todos = [optimistic, ...todos];
    const { error: err, data } = await supabase
      .from("todos")
      .insert({ list_id: listId, task })
      .select()
      .single();
    if (err) {
      error = err.message;
      todos = todos.filter((t) => t.id !== tempId);
    } else if (data) {
      todos = todos.map((t) => (t.id === tempId ? data : t));
      newTask = "";
    }
    adding = false;
  }

  async function toggle(todo: any) {
    const updated = { ...todo, completed: !todo.completed };
    todos = todos.map((t) => (t.id === todo.id ? updated : t));
    const { error: err } = await supabase
      .from("todos")
      .update({ completed: updated.completed })
      .eq("id", todo.id);
    if (err) {
      todos = todos.map((t) => (t.id === todo.id ? todo : t));
      error = err.message;
    }
  }

  // derived groupings
  $: activeTodos = todos.filter((t) => !t.completed);
  $: completedTodos = todos.filter((t) => t.completed);
  function toggleCompletedVisibility() {
    showCompleted = !showCompleted;
  }

  // --- enhanced realtime ---
  function applyChange(payload: any) {
    if (payload.eventType === "INSERT") {
      const row = payload.new as any;
      if (!todos.find((t) => t.id === row.id)) todos = [row, ...todos];
    } else if (payload.eventType === "UPDATE") {
      const row = payload.new as any;
      todos = todos.map((t) => (t.id === row.id ? row : t));
    } else if (payload.eventType === "DELETE") {
      const row = payload.old as any;
      todos = todos.filter((t) => t.id !== row.id);
    }
  }
  async function setupRealtime() {
    if (!listId) return;
    if (channel) {
      supabase.removeChannel(channel);
      channel = null;
    }
    realtimeStatus = "subscribing";
    channel = supabase.channel(`todos-${listId}`).on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "todos",
        filter: `list_id=eq.${listId}`,
      },
      applyChange,
    );

    // Wait for status
    await new Promise<void>((resolve) => {
      channel!.subscribe((status) => {
        realtimeStatus = status;
        if (status === "SUBSCRIBED") resolve();
        if (status === "CHANNEL_ERROR" || status === "CLOSED") resolve();
      });
    });
  }
  // --- end enhanced realtime ---

  function ensureAuth() {
    if (!get(user)) goto("/");
  }

  const unsubscribeUser = user.subscribe((u) => {
    // re-auth channel if token changes (user login/logout)
    if (channel) setupRealtime();
  });

  onMount(() => {
    listId = ($page.params.id || "") as string;
    ensureAuth();
    loadList();
    loadTodos();
    setupRealtime();
    window.addEventListener("focus", refetchOnFocus);
    return () => {
      if (channel) supabase.removeChannel(channel);
      unsubscribeUser();
      window.removeEventListener("focus", refetchOnFocus);
    };
  });

  function refetchOnFocus() {
    // Light resync to catch any missed events (e.g., tab was asleep)
    loadTodos();
  }

  async function invite() {
    inviteMsg = "";
    const email = inviteUserEmail.trim().toLowerCase();
    if (!email || inviting) return;
    inviting = true;
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const res = await fetch(`/lists/${listId}/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ email, role: "viewer" }),
      });
      const result = await res.json();
      if (!res.ok) inviteMsg = result.error || "Invite failed";
      else if (result.message) inviteMsg = result.message;
      else inviteMsg = "Invited";
      if (res.ok) inviteUserEmail = "";
    } catch (e: any) {
      inviteMsg = e.message || "Invite failed";
    }
    inviting = false;
  }

  // --- suggestions modal logic ---
  function openSuggest() {
    showSuggest = true;
    topic = "";
    suggestions = [];
    genError = "";
  }
  function closeSuggest() {
    if (savingSuggestions || generating) return; // avoid closing mid-action
    showSuggest = false;
  }
  function onBackdropKeydown(e: KeyboardEvent) {
    // Only act if the backdrop itself has focus (not children)
    if (e.target !== e.currentTarget) return;
    if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      closeSuggest();
    }
  }
  function onDialogKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      e.preventDefault();
      closeSuggest();
    }
  }
  async function generateSuggestions() {
    const q = topic.trim();
    if (!q || generating) return;
    genError = "";
    generating = true;
    suggestions = [];
    try {
      // Instruct the model to return only a comma-separated list
      const res = await fetch(
        `/api/generate?prompt=${encodeURIComponent(`Suggest 6 short, actionable todo items related to "${q}". Return ONLY a single comma-separated list without numbering or extra text.`)}`,
      );
      const data = await res.json().catch(() => ({}));
      const text: string = (data?.title ?? data?.text ?? "").toString();
      if (!res.ok || !text) {
        genError = data?.error || "Ingen forslag";
        return;
      }
      const parsed = text
        .replace(/\n+/g, ",")
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
      suggestions = Array.from(new Set(parsed));
      if (suggestions.length === 0) genError = "Ingen forslag";
    } catch (e: any) {
      genError = e?.message || "Feil under generering";
    } finally {
      generating = false;
    }
  }
  function removeSuggestion(idx: number) {
    suggestions = suggestions.filter((_, i) => i !== idx);
  }
  async function saveSuggestions() {
    if (!suggestions.length || savingSuggestions) return;
    savingSuggestions = true;
    error = "";
    // optimistic insert for each suggestion
    const temps = suggestions.map((task) => ({
      id: crypto.randomUUID(),
      list_id: listId,
      task,
      completed: false,
      inserted_at: new Date().toISOString(),
      _pending: true,
    }));
    todos = [...temps, ...todos];
    try {
      const { data, error: err } = await supabase
        .from("todos")
        .insert(suggestions.map((task) => ({ list_id: listId, task })))
        .select();
      if (err) {
        error = err.message;
        // remove temps on error
        const tempIds = new Set(temps.map((t) => t.id));
        todos = todos.filter((t) => !tempIds.has(t.id));
      } else if (Array.isArray(data)) {
        // replace temps with real rows by task match (best-effort)
        const byTask = new Map<string, any[]>();
        for (const row of data) {
          const arr = byTask.get(row.task) || [];
          arr.push(row);
          byTask.set(row.task, arr);
        }
        todos = todos.map((t) => {
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

<svelte:head
  ><title>{listName ? listName + " – Todos" : "List"}</title></svelte:head
>

<div>
  <nav>
    <ul>
      <li><a href="/"><ArrowLeft size="24" /></a></li>
    </ul>
    <ul>
      <li>
        <button class="outline"><UserPlus size="24" /></button>
      </li>
      <li>
        <button class=""><Sparkle size="24" /></button>
      </li>
    </ul>
  </nav>
  <h1>{listName || "..."}</h1>
  <form on:submit|preventDefault={addTodo}>
    <!-- svelte-ignore a11y_no_redundant_roles -->
    <fieldset role="group">
      <input
        placeholder="Ny oppgave"
        bind:value={newTask}
        aria-label="Ny oppgave"
      />
      <input
        type="submit"
        disabled={!newTask.trim() || adding}
        value={adding ? "Legger til…" : "+"}
      />
      <input type="button" value="✨" on:click={openSuggest} />
    </fieldset>
  </form>
  {#if error}<p role="alert">{error}</p>{/if}
  {#if loading}
    <p>Laster oppgaver…</p>
  {:else if todos.length === 0}
    <p>Ingen oppgaver ennå.</p>
  {:else}
    <ul aria-live="polite">
      {#each activeTodos as todo (todo.id)}
        <li>
          <button
            type="button"
            on:click={() => toggle(todo)}
            title="Bytt fullført"
          >
            <input type="checkbox" checked={todo.completed} readonly />
            <span>{todo.task}</span>
            {#if todo._pending}<em>(venter)</em>{/if}
          </button>
        </li>
      {/each}

      {#if completedTodos.length}
        <li aria-hidden="false">
          <button
            type="button"
            on:click={toggleCompletedVisibility}
            aria-expanded={showCompleted}
          >
            {showCompleted
              ? `Skjul fullførte (${completedTodos.length})`
              : `Vis fullførte (${completedTodos.length})`}
          </button>
        </li>

        {#if showCompleted}
          {#each completedTodos as todo (todo.id)}
            <li>
              <button
                type="button"
                on:click={() => toggle(todo)}
                title="Bytt fullført"
              >
                <input type="checkbox" checked={todo.completed} readonly />
                <span>{todo.task}</span>
                {#if todo._pending}<em>Laster</em>{/if}
              </button>
            </li>
          {/each}
        {/if}
      {/if}
    </ul>
  {/if}

  {#if ownerId && get(user)?.id === ownerId}
    <form on:submit|preventDefault={invite}>
      <!-- svelte-ignore a11y_no_redundant_roles -->
      <fieldset role="group">
        <input
          type="email"
          name="email"
          placeholder="E-postadresse til en venn"
          bind:value={inviteUserEmail}
          autocomplete="email"
        />
        <input
          type="submit"
          disabled={!inviteUserEmail.trim() || inviting}
          value={inviting ? "Inviterer…" : "Inviter"}
        />
      </fieldset>
    </form>
    {#if inviteMsg}<p>{inviteMsg}</p>{/if}
  {/if}

  {#if showSuggest}
    <div
      role="button"
      tabindex="0"
      aria-label="Close suggestions modal"
      on:click|stopPropagation={closeSuggest}
      on:keydown={onBackdropKeydown}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Generer forslag"
        tabindex="0"
        on:click|stopPropagation
        on:keydown|stopPropagation={onDialogKeydown}
      >
        <header>
          <h2>Generer forslag</h2>
          <button
            title="Lukk"
            on:click={closeSuggest}
            disabled={generating || savingSuggestions}>✕</button
          >
        </header>
        <form on:submit|preventDefault={generateSuggestions}>
          <input
            placeholder="f.eks. tilbehør til fisk"
            bind:value={topic}
            aria-label="Suggestion topic"
          />
          <button type="submit" disabled={!topic.trim() || generating}
            >{generating ? "Genererer…" : "Generer"}</button
          >
        </form>
        {#if genError}
          <p role="alert">{genError || "Ingen forslag returnert"}</p>
        {/if}
        {#if suggestions.length}
          <ul>
            {#each suggestions as s, i}
              <li>
                <span>{s}</span>
                <button title="Fjern" on:click={() => removeSuggestion(i)}
                  >✕</button
                >
              </li>
            {/each}
          </ul>
        {/if}
        <footer>
          <button
            type="button"
            on:click={saveSuggestions}
            disabled={!suggestions.length || savingSuggestions}
            >{savingSuggestions ? "Lagrer…" : "Lagre i liste"}</button
          >
          <button
            type="button"
            on:click={closeSuggest}
            disabled={savingSuggestions}>Avbryt</button
          >
        </footer>
      </div>
    </div>
  {/if}
</div>
