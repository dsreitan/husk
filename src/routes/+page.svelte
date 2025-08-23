<script lang="ts">
	import welcome from "$lib/images/svelte-welcome.webp";
	import welcomeFallback from "$lib/images/svelte-welcome.png";
	import UserLists from "$lib/components/UserLists.svelte";
	import CreateList from "$lib/components/CreateList.svelte";
	import LoginForm from "$lib/components/LoginForm.svelte";
	import { user, authReady } from "$lib/stores/user";
	import { t } from "$lib/i18n";
</script>

<svelte:head>
	<title>{t("app.home.title")}</title>
	<meta name="description" content={t("app.home.description")} />
</svelte:head>

<section>
	{#if !$authReady}
		<p>{t("app.loading.session")}</p>
	{:else if !$user}
		<LoginForm />
	{:else}
		<CreateList />
		<UserLists />
	{/if}
</section>
