<script lang="ts">
  import { supabase } from '$lib/supabase';

  export type Todo = {
    id: string;
    list_id: string;
    task: string;
    completed: boolean;
    inserted_at: string;
    _pending?: boolean;
  };

  export let todos: Todo[] = [];

  let showCompleted = true;
  let error = '';

  $: activeTodos = todos.filter((t) => !t.completed);
  $: completedTodos = todos.filter((t) => t.completed);

  function toggleCompletedVisibility() {
    showCompleted = !showCompleted;
  }

  async function toggle(todo: Todo) {
    const updated = { ...todo, completed: !todo.completed };
    todos = todos.map((t) => (t.id === todo.id ? updated : t));
    const { error: err } = await supabase
      .from('todos')
      .update({ completed: updated.completed })
      .eq('id', todo.id);
    if (err) {
      todos = todos.map((t) => (t.id === todo.id ? todo : t));
      error = err.message;
    }
  }
</script>

{#if error}<p role="alert">{error}</p>{/if}
{#if todos.length === 0}
  <p>Ingen oppgaver ennå.</p>
{:else}
  <ul aria-live="polite">
    {#each activeTodos as todo (todo.id)}
      <li>
        <button type="button" on:click={() => toggle(todo)} title="Bytt fullført">
          <input type="checkbox" checked={todo.completed} readonly />
          <span>{todo.task}</span>
          {#if todo._pending}<em>(venter)</em>{/if}
        </button>
      </li>
    {/each}

    {#if completedTodos.length}
      <li aria-hidden="false">
        <button type="button" on:click={toggleCompletedVisibility} aria-expanded={showCompleted}>
          {showCompleted
            ? `Skjul fullførte (${completedTodos.length})`
            : `Vis fullførte (${completedTodos.length})`}
        </button>
      </li>

      {#if showCompleted}
        {#each completedTodos as todo (todo.id)}
          <li>
            <button type="button" on:click={() => toggle(todo)} title="Bytt fullført">
              <input type="checkbox" checked={todo.completed} readonly />
              <span>{todo.task}</span>
              {#if todo._pending}<em>(venter)</em>{/if}
            </button>
          </li>
        {/each}
      {/if}
    {/if}
  </ul>
{/if}
