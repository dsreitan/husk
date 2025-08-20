<script lang="ts">
	import welcome from "$lib/images/svelte-welcome.webp";
	import welcomeFallback from "$lib/images/svelte-welcome.png";
	import UserLists from "$lib/components/UserLists.svelte";
	import CreateList from "$lib/components/CreateList.svelte";
	import LoginForm from "$lib/components/LoginForm.svelte";
	import { user, authReady } from "$lib/stores/user";
</script>

<svelte:head>
	<title>Home</title>
	<meta name="description" content="Svelte demo app" />
</svelte:head>

<section>
	{#if !$authReady}
		<p>Loading session...</p>
	{:else if !$user}
		<LoginForm />
	{:else}
		<CreateList />
		<UserLists />
	{/if}
</section>

<style>
	section {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		flex: 0.6;
	}
</style>
