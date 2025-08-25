<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let open = false;
  export let id = "";
  export let title = "";
  export let closeOnEsc = true;
  export let closeOnBackdrop = true;

  const dispatch = createEventDispatcher();
  let dialogEl: HTMLDialogElement;

  function show() {
    dialogEl.showModal();
    document.documentElement.classList.add("modal-is-open");
  }

  function close() {
    // Add Pico's "closing" class for transition
    document.documentElement.classList.add("modal-is-closing");

    // Wait for animation, then fully close
    dialogEl.addEventListener(
      "animationend",
      () => {
        dialogEl.close();
        document.documentElement.classList.remove("modal-is-open");
        document.documentElement.classList.remove("modal-is-closing");
        dispatch("close");
      },
      { once: true },
    );
  }

  $: if (dialogEl) {
    if (open && !dialogEl.open) {
      show();
    } else if (!open && dialogEl.open) {
      close();
    }
  }

  function handleEsc(e: Event) {
    if (!closeOnEsc) return;
    e.preventDefault();
    close();
  }

  function handleBackdrop(e: MouseEvent) {
    if (!closeOnBackdrop) return;
    if (e.target === dialogEl) close();
  }
</script>

<dialog
  bind:this={dialogEl}
  {id}
  on:cancel={handleEsc}
  on:click={handleBackdrop}
>
  <article>
    {#if title}
      <header>
        <button type="button" class="close" aria-label="Close" on:click={close}
        ></button>
        <h3>{title}</h3>
      </header>
    {/if}
    <section>
      <slot />
    </section>
    <footer>
      <slot name="footer" />
    </footer>
  </article>
</dialog>
