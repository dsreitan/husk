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
  import NewTodo from "$lib/components/lists/NewTodo.svelte";
  import TodoList from "$lib/components/lists/TodoList.svelte";
  import SuggestModal from "$lib/components/lists/SuggestModal.svelte";
  import ShareListModal from "$lib/components/lists/ShareListModal.svelte";

  let listId = "";
  let listName = "";
  let todos: any[] = [];
  let loading = true;
  let error = "";
  let channel: ReturnType<typeof supabase.channel> | null = null;
  // --- invite state ---
  let ownerId: string | null = null;
  let showInvite = false;
  let showSuggest = false;
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

  function onTodoAdded(e: CustomEvent<any>) {
    const row = e.detail;
    if (row && row._replaceOptimisticId) {
      const id = row._replaceOptimisticId;
      delete row._replaceOptimisticId;
      todos = todos.map((t) => (t.id === id ? row : t));
    } else if (row) {
      todos = [row, ...todos];
    }
  }
  function onTodoAddError(e: CustomEvent<string>) {
    error = e.detail || "Kunne ikke legge til";
  }

  // list interaction handled in TodoList component (two-way bind:todos)

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

  function onInvited() {
    showInvite = false;
  }

  // suggestions handled in SuggestModal component
  function onSuggestSaved() {
    // reload to reflect new todos
    loadTodos();
    showSuggest = false;
  }
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
        <button class="outline" on:click={() => (showInvite = true)}>
          <UserPlus size="24" />
        </button>
      </li>
      <li>
        <button class="primary" on:click={() => (showSuggest = true)}>
          <Sparkle size="24" />
        </button>
      </li>
    </ul>
  </nav>

  <h1>{listName || "..."}</h1>

  <NewTodo {listId} on:added={onTodoAdded} on:error={onTodoAddError} />

  {#if error}<p role="alert">{error}</p>{/if}
  {#if loading}
    <p>Laster oppgaver…</p>
  {:else}
    <TodoList bind:todos />
  {/if}

  <ShareListModal {listId} bind:open={showInvite} on:invited={onInvited} />
  <SuggestModal {listId} bind:open={showSuggest} on:saved={onSuggestSaved} />
</div>
