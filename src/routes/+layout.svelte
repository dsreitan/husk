<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { webVitals } from '$lib/vitals';
	import Header from './Header.svelte';
	import '../app.css';
	import { loadLocale } from '$lib/i18n';

	let { data, children } = $props();

	$effect(() => {
		const id = (data as any)?.analyticsId;
		if (id) {
			webVitals({
				path: $page.url.pathname,
				params: $page.params,
				analyticsId: id as string
			});
		}
	});

	// Initialize i18n from server-provided data
	$effect(() => {
		if (data?.locale && data?.messages) {
			// ensure client store sync on navigation too
			loadLocale(data.locale as string, data.messages as any);
		}
	});
</script>

<div class="app">
	<!-- <Header /> -->

	<main>
		{@render children()}
	</main>

	<footer>
	</footer>
</div>

<style>
	.app {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	main {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: 1rem;
		width: 100%;
		max-width: 64rem;
		margin: 0 auto;
		box-sizing: border-box;
	}

	footer {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		padding: 12px;
	}



	@media (min-width: 480px) {
		footer {
			padding: 12px 0;
		}
	}
</style>
