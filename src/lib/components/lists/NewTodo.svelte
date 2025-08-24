<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { supabase } from '$lib/supabase';

  export let listId: string;

  const dispatch = createEventDispatcher<{ added: any; error: string }>();

  let newTask = '';
  let adding = false;
  let error = '';

  async function addTodo() {
    const task = newTask.trim();
    if (!task || adding) return;
    adding = true;
    error = '';
    const temp = {
      id: crypto.randomUUID(),
      list_id: listId,
      task,
      completed: false,
      inserted_at: new Date().toISOString(),
      _pending: true,
    };
    // Notify parent optimistically
    dispatch('added', temp);
    const { data, error: err } = await supabase
      .from('todos')
      .insert({ list_id: listId, task })
      .select()
      .single();
    if (err) {
      error = err.message;
      dispatch('error', error);
    } else if (data) {
      // Replace optimistic with real row
      dispatch('added', { ...data, _replaceOptimisticId: temp.id });
      newTask = '';
    }
    adding = false;
  }

  function onSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!adding) addTodo();
  }
</script>

<form on:submit={onSubmit} aria-label="Ny oppgave">
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
      value={adding ? 'Legger til…' : '+'}
    />
  </fieldset>
  {#if error}<p role="alert">{error}</p>{/if}
</form>
