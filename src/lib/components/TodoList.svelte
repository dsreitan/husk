<script lang="ts">
  import { supabase } from "$lib/supabase";

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
  let error = "";

  $: activeTodos = todos.filter((t) => !t.completed);
  $: completedTodos = todos.filter((t) => t.completed);

  function toggleCompletedVisibility() {
    showCompleted = !showCompleted;
  }

  async function toggle(todo: Todo) {
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
</script>

{#if error}<p role="alert">{error}</p>{/if}
{#if todos.length === 0}
  <p>Ingen oppgaver ennå.</p>
{:else}
  <section role="list" aria-live="polite">
    {#each activeTodos as todo (todo.id)}
      <div role="listitem">
        <article>
          <input
            type="checkbox"
            checked={todo.completed}
            readonly
            on:click={() => toggle(todo)}
          />
          <span>{todo.task}</span>
        </article>
      </div>
    {/each}
  </section>

  {#if completedTodos.length}
    <hr />
    <section>
      <details name="example">
        <summary>Fullførte</summary>
        <div role="list">
          {#each completedTodos as todo (todo.id)}
            <div role="listitem">
              <article>
                <input
                  type="checkbox"
                  checked={todo.completed}
                  readonly
                  on:click={() => toggle(todo)}
                />
                <span>{todo.task}</span>
              </article>
            </div>
          {/each}
        </div>
      </details>
    </section>
  {/if}
{/if}
