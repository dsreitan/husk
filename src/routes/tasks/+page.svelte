<script lang="ts">
	
// await supabase.from('lists').insert({ name: "Groceries", owner: $user.id });

  import { supabase } from '$lib/supabase';
  import { user } from '$lib/stores/user';
  import { onMount } from 'svelte';

  let tasks = [];
  let error = '';

  onMount(async () => {
    console.log("supa", supabase)
    console.log("user", $user, user)
    const { data, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', $user?.id);
console.log('Tasks fetched:', data);
    if (fetchError) {
      error = fetchError.message;
    } else {
      tasks = data;
    }
  });

  
</script>