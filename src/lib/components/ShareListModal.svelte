<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { supabase } from "$lib/supabase";
  import Modal from "./Modal.svelte";

  export let listId: string;
  export let open = false;

  const dispatch = createEventDispatcher<{
    close: void;
    invited: string;
    error: string;
  }>();

  let email = "";
  let inviting = false;
  let msg = "";

  async function invite() {
    msg = "";
    const e = email.trim().toLowerCase();
    if (!e || inviting) return;
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
        body: JSON.stringify({ email: e, role: "viewer" }),
      });
      const result = await res.json();
      if (!res.ok) msg = result.error || "Invitasjon mislyktes";
      else if (result.message) msg = result.message;
      else msg = "Invitert";
      if (res.ok) {
        dispatch("invited", e);
        email = "";
      }
    } catch (err: any) {
      msg = err?.message || "Invitasjon mislyktes";
      dispatch("error", msg);
    }
    inviting = false;
  }
</script>

<Modal bind:open title="Del liste" on:close={() => (open = false)}>
  <form on:submit|preventDefault={invite}>
    <input
      type="email"
      placeholder="E-postadresse til en venn"
      bind:value={email}
      autocomplete="email"
    />
    <button type="submit" disabled={!email.trim() || inviting}
      >{inviting ? "Inviterer…" : "Inviter"}</button
    >
  </form>
  {#if msg}
    <p role="alert">{msg}</p>
  {/if}
  <button slot="footer" on:click={() => (open = false)}>Close</button>
</Modal>
