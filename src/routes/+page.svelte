<script lang="ts">
	import UserLists from "$lib/components/UserLists.svelte";
	import CreateList from "$lib/components/CreateList.svelte";
	import LoginForm from "$lib/components/LoginForm.svelte";
	import { user, authReady } from "$lib/stores/user";
</script>

<svelte:head>
	<title>Huskelista</title>
	<meta name="description" content="" />
</svelte:head>

<section>
	{#if !$authReady}
	<div aria-busy="true"></div>
	{:else if !$user}
		<LoginForm />
	{:else}
		<UserLists />
		<CreateList />
	{/if}
</section>
