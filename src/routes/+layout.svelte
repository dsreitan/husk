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

	<!-- <Header /> -->
	 <header>head</header>

	<main>
		{@render children()}
	</main>

	<footer>
		foot
		<div class="grid">
  <div>1</div>
  <div>2</div>
  <div>3</div>
  <div>4</div>
</div>
	</footer>
