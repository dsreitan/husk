<script lang="ts">
	import "../app.css";
	import { page } from "$app/stores";
	import { webVitals } from "$lib/vitals";
	import { loadLocale } from "$lib/i18n";

	let { data, children } = $props();

	$effect(() => {
		const id = (data as any)?.analyticsId;
		if (id) {
			webVitals({
				path: $page.url.pathname,
				params: $page.params,
				analyticsId: id as string,
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

<main class="container">
	{@render children()}
</main>
